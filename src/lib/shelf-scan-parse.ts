// Parses vision-model output into DetectedMedicine[].
// Handles strict JSON, broken JSON, markdown fences, and plain-text lists.

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
  parseMethod: "json" | "regex" | "plaintext" | "none";
  rawPreview: string | null;
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

const MEDICINE_LINE_RE =
  /\b(\d+\s*mg|\d+\s*ml|\d+\s*gm|\d+\s*%|tablet|capsule|cream|ointment|syrup|gel|drops|injection|suspension)\b/i;

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

/** Strip trailing commas and other common LLM JSON mistakes. */
function repairJson(text: string): string {
  return text
    .replace(/,\s*([\]}])/g, "$1")
    .replace(/\bundefined\b/g, "null")
    .replace(/\bNaN\b/g, "null");
}

/** Extract balanced {...} or [...] substrings (avoids greedy-regex failures). */
function extractBalancedSegments(text: string): string[] {
  const segments: string[] = [];
  for (const [open, close] of [
    ["{", "}"],
    ["[", "]"],
  ] as const) {
    let depth = 0;
    let start = -1;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === open) {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === close) {
        depth--;
        if (depth === 0 && start >= 0) {
          segments.push(text.slice(start, i + 1));
          start = -1;
        }
      }
    }
  }
  // Prefer longer segments first (more likely to be the full payload)
  return segments.sort((a, b) => b.length - a.length);
}

function unwrapParsed(parsed: unknown): unknown {
  if (typeof parsed === "string") {
    const inner = tryParseJson(parsed.trim());
    if (inner !== null) return unwrapParsed(inner);
  }
  return parsed;
}

function detectionsFromParsed(
  parsed: unknown
): { detections: DetectedMedicine[]; key: string | null; rawCount: number } | null {
  const unwrapped = unwrapParsed(parsed);
  const extracted = extractMedicineArray(unwrapped);
  if (!extracted) return null;

  const detections = dedupeDetections(
    extracted.items
      .map((item) =>
        item && typeof item === "object" ? itemToDetection(item as Record<string, unknown>) : null
      )
      .filter((d): d is DetectedMedicine => d !== null)
  );

  return {
    detections,
    key: extracted.key,
    rawCount: extracted.items.length,
  };
}

/** Pull medicine names from broken JSON text via regex (common when output is truncated). */
function parseRegexFallback(text: string): DetectedMedicine[] {
  const names = new Map<string, DetectedMedicine>();

  const fieldPatterns = [
    /"(?:brand_name|brandName|full_name|fullName|medicine_name|name)"\s*:\s*"((?:[^"\\]|\\.)*)"/gi,
    /'(?:brand_name|brandName|full_name|fullName|name)'\s*:\s*'([^']+)'/gi,
  ];

  for (const pattern of fieldPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].replace(/\\"/g, '"').trim();
      if (name.length >= 2 && name.length <= 120) {
        names.set(name.toLowerCase(), { name, confidence: 0.55 });
      }
    }
  }

  return Array.from(names.values());
}

/** Parse bullet/numbered plain-text lists (Claude-style prose responses). */
function parsePlainTextFallback(text: string): DetectedMedicine[] {
  const results: DetectedMedicine[] = [];
  const skipLine =
    /^(here|the following|total|json|note|i can|i see|based on|medicines?:|products?:|output|result)/i;

  for (const rawLine of text.split(/\n+/)) {
    let line = rawLine.trim();
    if (!line || line.length < 3) continue;

    // "- Napa 500mg Tablet" / "1. Seclo 20mg" / "* Clovate Cream"
    line = line
      .replace(/^[\s*\-•]+/, "")
      .replace(/^\d+[.)]\s*/, "")
      .replace(/^["'`]+|["'`]+$/g, "")
      .trim();

    if (!line || line.length > 120) continue;
    if (skipLine.test(line)) continue;
    if (/^[\[{]/.test(line)) continue;

    const looksLikeMedicine =
      MEDICINE_LINE_RE.test(line) ||
      (/^[A-Za-z\u0980-\u09FF]/.test(line) && line.split(/\s+/).length <= 12);

    if (looksLikeMedicine) {
      results.push({ name: line, confidence: 0.45 });
    }
  }

  return dedupeDetections(results);
}

function tryAllJsonParses(text: string): { detections: DetectedMedicine[]; key: string | null; rawCount: number } | null {
  const candidates = new Set<string>();
  candidates.add(text.trim());

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) candidates.add(fenceMatch[1].trim());

  for (const segment of extractBalancedSegments(text)) {
    candidates.add(segment);
    candidates.add(repairJson(segment));
  }

  for (const candidate of candidates) {
    let parsed = tryParseJson(candidate);
    if (!parsed) parsed = tryParseJson(repairJson(candidate));
    if (!parsed) continue;

    const result = detectionsFromParsed(parsed);
    if (result && result.detections.length > 0) return result;
  }

  // Parsed OK but empty medicines[] — still counts as JSON success path
  for (const candidate of candidates) {
    const parsed = tryParseJson(candidate) ?? tryParseJson(repairJson(candidate));
    if (!parsed) continue;
    const result = detectionsFromParsed(parsed);
    if (result) return result;
  }

  return null;
}

function preview(raw: string): string {
  const p = raw.trim().replace(/\s+/g, " ").substring(0, 220);
  return p.length < raw.trim().length ? `${p}…` : p;
}

/** Parse vision model output into medicines + diagnostic for empty-result debugging. */
export function parseShelfScanResponse(raw: string): ShelfParseResult {
  const baseDiagnostic = (
    message: string,
    overrides: Partial<ShelfParseDiagnostic> = {}
  ): ShelfParseDiagnostic => ({
    parseFailed: true,
    modelReturnedEmpty: false,
    rawMedicineCount: 0,
    arrayKeyUsed: null,
    parseMethod: "none",
    rawPreview: raw?.trim() ? preview(raw) : null,
    message,
    ...overrides,
  });

  if (!raw?.trim()) {
    return {
      detections: [],
      diagnostic: baseDiagnostic(
        "AI returned empty text — check model, API key, and Disable Thinking setting."
      ),
    };
  }

  const text = raw.trim();

  // 1) Strict / repaired JSON
  const jsonResult = tryAllJsonParses(text);
  if (jsonResult) {
    if (jsonResult.detections.length > 0) {
      return {
        detections: jsonResult.detections,
        diagnostic: {
          parseFailed: false,
          modelReturnedEmpty: false,
          rawMedicineCount: jsonResult.rawCount,
          arrayKeyUsed: jsonResult.key,
          parseMethod: "json",
          rawPreview: preview(raw),
          message: `Parsed ${jsonResult.detections.length} medicine(s) from JSON (${jsonResult.key}).`,
        },
      };
    }

    return {
      detections: [],
      diagnostic: {
        parseFailed: false,
        modelReturnedEmpty: jsonResult.rawCount === 0,
        rawMedicineCount: jsonResult.rawCount,
        arrayKeyUsed: jsonResult.key,
        parseMethod: "json",
        rawPreview: preview(raw),
        message:
          jsonResult.rawCount === 0
            ? "AI returned valid JSON but reported zero medicines — try clearer label-facing photos."
            : "AI returned medicine entries in JSON but none had readable names.",
      },
    };
  }

  // 2) Regex salvage from broken JSON / truncated output
  const regexDetections = parseRegexFallback(text);
  if (regexDetections.length > 0) {
    return {
      detections: regexDetections,
      diagnostic: {
        parseFailed: false,
        modelReturnedEmpty: false,
        rawMedicineCount: regexDetections.length,
        arrayKeyUsed: "(regex salvage)",
        parseMethod: "regex",
        rawPreview: preview(raw),
        message: `Recovered ${regexDetections.length} medicine(s) from partially broken AI JSON.`,
      },
    };
  }

  // 3) Plain-text list (how Claude often responds)
  const plainDetections = parsePlainTextFallback(text);
  if (plainDetections.length > 0) {
    return {
      detections: plainDetections,
      diagnostic: {
        parseFailed: false,
        modelReturnedEmpty: false,
        rawMedicineCount: plainDetections.length,
        arrayKeyUsed: "(plain text)",
        parseMethod: "plaintext",
        rawPreview: preview(raw),
        message: `Extracted ${plainDetections.length} medicine(s) from plain-text AI response.`,
      },
    };
  }

  return {
    detections: [],
    diagnostic: baseDiagnostic(
      `Could not parse AI response. Preview: "${preview(raw)}" — reset prompts to defaults or switch to gemini-2.0-flash.`,
      { parseFailed: true }
    ),
  };
}
