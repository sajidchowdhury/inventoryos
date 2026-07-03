// Parses vision-model JSON into DetectedMedicine[].
// Tolerant of common field-name variants from Gemini, Z.ai, and custom prompts.

export interface DetectedMedicine {
  name: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  confidence: number;
}

export interface ShelfParseDiagnostic {
  parseFailed: boolean;
  modelReturnedEmpty: boolean;
  rawMedicineCount: number;
  arrayKeyUsed: string | null;
  message: string;
}

export interface ShelfParseResult {
  detections: DetectedMedicine[];
  diagnostic: ShelfParseDiagnostic;
}

const MEDICINE_ARRAY_KEYS = [
  "medicines",
  "detected_medicines",
  "medicine_list",
  "items",
  "products",
  "results",
  "detections",
] as const;

function normalizeConfidence(value: unknown): number {
  if (typeof value === "number" && !isNaN(value)) {
    return Math.max(0, Math.min(1, value));
  }
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "high") return 0.9;
    if (v === "medium") return 0.65;
    if (v === "low") return 0.4;
    const num = parseFloat(v);
    if (!isNaN(num)) return Math.max(0, Math.min(1, num));
  }
  return 0.5;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return "";
}

function itemToDetection(obj: Record<string, unknown>): DetectedMedicine | null {
  const brandName = pickString(obj, [
    "brand_name",
    "brandName",
    "brand",
    "medicine_name",
    "medicineName",
    "product_name",
    "productName",
    "title",
    "label",
  ]);
  const fullName = pickString(obj, ["full_name", "fullName", "display_name", "displayName"]);
  const legacyName = pickString(obj, ["name"]);
  const name = fullName || brandName || legacyName;
  if (!name) return null;

  const strength = pickString(obj, ["strength", "dose", "dosage"]) || undefined;
  const dosageForm =
    pickString(obj, ["form", "dosage_form", "dosageForm", "type", "product_form"]) || undefined;
  const manufacturer =
    pickString(obj, ["manufacturer", "manufacturer_name", "manufacturerName", "company"]) ||
    undefined;

  return {
    name,
    strength,
    dosageForm,
    manufacturer,
    confidence: normalizeConfidence(obj.confidence),
  };
}

function extractMedicineArray(
  parsed: unknown
): { items: unknown[]; key: string | null } | null {
  if (Array.isArray(parsed)) {
    return { items: parsed, key: "(root array)" };
  }
  if (!parsed || typeof parsed !== "object") return null;

  const obj = parsed as Record<string, unknown>;
  for (const key of MEDICINE_ARRAY_KEYS) {
    if (Array.isArray(obj[key])) {
      return { items: obj[key] as unknown[], key };
    }
  }
  return null;
}

function dedupeDetections(items: DetectedMedicine[]): DetectedMedicine[] {
  const seen = new Map<string, DetectedMedicine>();
  for (const d of items) {
    const key = `${d.name.toLowerCase()}|${(d.strength || "").toLowerCase()}`;
    const existing = seen.get(key);
    if (!existing || d.confidence > existing.confidence) {
      seen.set(key, d);
    }
  }
  return Array.from(seen.values());
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Parse vision model output into medicines + diagnostic for empty-result debugging. */
export function parseShelfScanResponse(raw: string): ShelfParseResult {
  const emptyDiagnostic = (message: string, overrides: Partial<ShelfParseDiagnostic> = {}): ShelfParseDiagnostic => ({
    parseFailed: true,
    modelReturnedEmpty: false,
    rawMedicineCount: 0,
    arrayKeyUsed: null,
    message,
    ...overrides,
  });

  if (!raw?.trim()) {
    return {
      detections: [],
      diagnostic: emptyDiagnostic("AI returned empty text — check model, API key, and Disable Thinking setting."),
    };
  }

  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) text = fenceMatch[1].trim();

  // Direct parse (best path for responseMimeType: application/json)
  let parsed = tryParseJson(text);

  // Greedy object extract
  if (!parsed) {
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) parsed = tryParseJson(objectMatch[0]);
  }

  // Bare array extract
  if (!parsed) {
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) parsed = tryParseJson(arrayMatch[0]);
  }

  if (!parsed) {
    return {
      detections: [],
      diagnostic: emptyDiagnostic(
        "AI returned text but JSON parsing failed — reset prompts to defaults in Admin.",
        { parseFailed: true }
      ),
    };
  }

  const extracted = extractMedicineArray(parsed);
  if (!extracted) {
    return {
      detections: [],
      diagnostic: emptyDiagnostic(
        "AI JSON had no medicines array — ensure your prompt asks for a \"medicines\" list.",
        { parseFailed: true }
      ),
    };
  }

  const detections = dedupeDetections(
    extracted.items
      .map((item) =>
        item && typeof item === "object" ? itemToDetection(item as Record<string, unknown>) : null
      )
      .filter((d): d is DetectedMedicine => d !== null)
  );

  if (detections.length === 0) {
    return {
      detections: [],
      diagnostic: {
        parseFailed: false,
        modelReturnedEmpty: extracted.items.length === 0,
        rawMedicineCount: extracted.items.length,
        arrayKeyUsed: extracted.key,
        message:
          extracted.items.length === 0
            ? "AI saw the images but reported zero medicines — try gemini-2.0-flash, clearer label-facing photos, or glm-ocr on Z.ai."
            : "AI returned medicine entries but none had readable names — check custom prompt field names (use brand_name / full_name).",
      },
    };
  }

  return {
    detections,
    diagnostic: {
      parseFailed: false,
      modelReturnedEmpty: false,
      rawMedicineCount: extracted.items.length,
      arrayKeyUsed: extracted.key,
      message: `Parsed ${detections.length} medicine(s) from "${extracted.key}".`,
    },
  };
}
