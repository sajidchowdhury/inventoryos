// src/lib/shelf-scan-ai.ts
// ── InventoryOS: Shelf Scanner AI wrapper (provider-agnostic) ──
//
// This is the SINGLE place that builds the prompt + parses the response.
// The actual API call is delegated to vision-provider.ts which routes to
// whichever provider is active in the super-admin panel (Gemini, Z.ai, etc).
//
// To swap providers: Admin → API Setup → AI Providers → activate one.
// No code changes needed.

import type { AiConfigValue } from "@/lib/ai-config";
import { estimateTokens } from "@/lib/ai-rate-limit";
import { analyzeWithActiveProvider } from "@/lib/vision-provider";

// ── Types ──

export interface DetectedMedicine {
  name: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  confidence: number;
}

export interface ShelfAnalysisResult {
  detections: DetectedMedicine[];
  rawResponse: string;
  tokensUsed: number;
  provider: string;
}

// ── Prompt ──
// Tuned for high recall: partial/upside-down boxes, English + Bangla labels.

const SYSTEM_PROMPT = `You are an expert pharmacy AI assistant specialized in reading medicine boxes from shelf photos.

### Task:
Analyze the given image(s) of a pharmacy shelf and extract ALL visible medicine/product names as accurately as possible.

### Instructions:
1. Carefully examine EVERY medicine box in the image, including partially visible ones. Some boxes may be upside down or at an angle.
2. Labels may be in English, Bangla (বাংলা), or mixed. Read both scripts when visible.
3. Focus on text on the front face of boxes: brand name + strength + dosage form.
4. Prioritize reading:
   - Brand name (e.g., Clovate, Betameson, Fusitop, De-rash, Napa, Seclo)
   - Strength (e.g., 0.05%, 1%, 10mg, 500mg)
   - Dosage form (Cream, Ointment, Gel, Tablet, Capsule, Syrup, Injection, Drops, etc.)
   - Manufacturer if visible on the pack (e.g., Square, Beximco, Incepta)
5. If text is unclear due to angle, lighting, or overlap, still extract your best guess and set confidence to "low" or "medium".
6. Do NOT skip any visible box. Even if only partially visible, extract whatever text you can read.
7. Ignore price tags, shelf labels, barcodes-only strips, and non-medicine items.
8. If the same medicine appears in multiple photos, merge into one entry (keep the highest confidence).
9. When in doubt, INCLUDE the detection rather than omit it — false positives are better than missed medicines.

### Output Format (Strict JSON only — no markdown fences, no extra text):
{
  "total_medicines_detected": number,
  "medicines": [
    {
      "brand_name": "string",
      "strength": "string or null",
      "form": "string or null",
      "full_name": "string",
      "manufacturer": "string or null",
      "confidence": "high | medium | low",
      "notes": "string or null"
    }
  ]
}

Rules for full_name: combine brand + strength + form when readable (e.g., "Clovate 0.05% Cream").
If zero medicines are visible, return: { "total_medicines_detected": 0, "medicines": [] }`;

/**
 * Analyze shelf photos and return a deduplicated list of detected medicines.
 */
export async function analyzeShelfImages(
  images: string[],
  config: Pick<AiConfigValue, "maxOutputTokens">
): Promise<ShelfAnalysisResult> {
  if (!images.length) {
    throw new Error("No images provided for shelf analysis");
  }

  const userPrompt =
    images.length === 1
      ? "Analyze this pharmacy shelf photo. Extract every visible medicine box — including partial, angled, upside-down, English, and Bangla labels. Return the strict JSON object specified."
      : `Analyze these ${images.length} pharmacy shelf photos (same shelf, different angles). Extract every visible medicine box from ALL photos — including partial, angled, upside-down, English, and Bangla labels. Merge duplicates across photos. Return the strict JSON object specified.`;

  const result = await analyzeWithActiveProvider(
    images,
    config.maxOutputTokens,
    SYSTEM_PROMPT,
    userPrompt
  );

  const detections = parseDetections(result.rawResponse);
  if (detections.length === 0 && result.rawResponse.trim()) {
    console.warn(
      "[shelf-scan-ai] VLM returned text but no medicines parsed. Raw snippet:",
      result.rawResponse.substring(0, 500)
    );
  }

  const tokensUsed =
    result.tokensUsed > 0
      ? result.tokensUsed
      : estimateTokens(SYSTEM_PROMPT) + estimateTokens(userPrompt) + estimateTokens(result.rawResponse);

  return {
    detections,
    rawResponse: result.rawResponse,
    tokensUsed,
    provider: result.provider,
  };
}

// ── Helpers ──

/** Map "high" | "medium" | "low" (or numeric) to 0–1 for the UI. */
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

function itemToDetection(obj: Record<string, unknown>): DetectedMedicine | null {
  const brandName = typeof obj.brand_name === "string" ? obj.brand_name.trim() : "";
  const legacyName = typeof obj.name === "string" ? obj.name.trim() : "";
  const fullName = typeof obj.full_name === "string" ? obj.full_name.trim() : "";
  const name = fullName || brandName || legacyName;
  if (!name) return null;

  const strength =
    (typeof obj.strength === "string" && obj.strength.trim()) ||
    undefined;
  const dosageForm =
    (typeof obj.form === "string" && obj.form.trim()) ||
    (typeof obj.dosageForm === "string" && obj.dosageForm.trim()) ||
    undefined;
  const manufacturer =
    (typeof obj.manufacturer === "string" && obj.manufacturer.trim()) ||
    undefined;

  return {
    name,
    strength,
    dosageForm,
    manufacturer,
    confidence: normalizeConfidence(obj.confidence),
  };
}

/**
 * Parse the model response into DetectedMedicine[].
 * Supports the new { medicines: [...] } object and legacy JSON arrays.
 */
function parseDetections(raw: string): DetectedMedicine[] {
  if (!raw) return [];

  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) text = fenceMatch[1].trim();

  // Try full JSON object first (new format)
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      const parsed = JSON.parse(objectMatch[0]) as Record<string, unknown>;
      if (Array.isArray(parsed.medicines)) {
        return dedupeDetections(
          parsed.medicines
            .map((item) =>
              item && typeof item === "object"
                ? itemToDetection(item as Record<string, unknown>)
                : null
            )
            .filter((d): d is DetectedMedicine => d !== null)
        );
      }
    } catch {
      // fall through to array parsing
    }
  }

  // Legacy: bare JSON array
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (!arrayMatch) return [];

  try {
    const parsed = JSON.parse(arrayMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return dedupeDetections(
      parsed
        .map((item) =>
          item && typeof item === "object"
            ? itemToDetection(item as Record<string, unknown>)
            : null
        )
        .filter((d): d is DetectedMedicine => d !== null)
    );
  } catch {
    return [];
  }
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