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
import { analyzeWithActiveProvider, type VisionDetection } from "@/lib/vision-provider";

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

const SYSTEM_PROMPT = `You are a pharmacy inventory assistant specialized in reading medicine packaging from shelf photos.

Look at the shelf image(s) carefully. For EVERY distinct medicine you can identify, return a JSON array. Each element must have exactly these fields:
- "name": brand name as printed (e.g., "Napa Extra"). If only the generic is visible, use that.
- "strength": the strength if readable (e.g., "500mg", "250mg/5ml"), else null.
- "dosageForm": one of "Tablet","Capsule","Syrup","Injection","Cream","Drops","Inhaler","Powder", or null if unclear.
- "manufacturer": the company name if readable (e.g., "Square","Beximco"), else null.
- "confidence": a number from 0.0 to 1.0 reflecting how clearly you could read the label.

Rules:
- Return ONLY the JSON array, no markdown fences, no explanation text.
- Do NOT invent fields. Do NOT include the same medicine twice — if it appears in multiple photos, merge into one entry with your best-read fields and the highest confidence.
- If the image is not a pharmacy shelf or contains zero identifiable medicines, return [].
- Be conservative with confidence: 0.9+ only when every field is clearly legible.`;

/**
 * Analyze shelf photos and return a deduplicated list of detected medicines.
 *
 * @param images  Array of 1–3 base64 data URLs
 * @param config  AiConfigValue for "shelf-scanner" (provides maxOutputTokens)
 * @throws on provider failure, empty input, or unparseable response.
 */
export async function analyzeShelfImages(
  images: string[],
  config: Pick<AiConfigValue, "maxOutputTokens">
): Promise<ShelfAnalysisResult> {
  if (!images.length) {
    throw new Error("No images provided for shelf analysis");
  }

  const userPrompt = `Identify every medicine visible on this pharmacy shelf. There ${images.length === 1 ? "is 1 photo" : `are ${images.length} photos`}, possibly showing the same shelf from different angles. Return the JSON array as specified.`;

  // Delegate to the active provider (Gemini, Z.ai, etc.)
  const result = await analyzeWithActiveProvider(
    images,
    config.maxOutputTokens,
    SYSTEM_PROMPT,
    userPrompt
  );

  // Parse the raw response into detections (same for all providers)
  const detections = parseDetections(result.rawResponse);

  // Token fallback: if the provider didn't report usage, estimate
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

/**
 * Parse the model's response into a clean DetectedMedicine[].
 * Strips markdown fences, extracts the first JSON array, dedupes by name+strength.
 */
function parseDetections(raw: string): DetectedMedicine[] {
  if (!raw) return [];

  let text = raw.trim();
  // Strip ```json ... ``` fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) text = fenceMatch[1].trim();

  // Extract the first JSON array block
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (!arrayMatch) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(arrayMatch[0]);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const cleaned: DetectedMedicine[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const name = typeof obj.name === "string" ? obj.name.trim() : "";
    if (!name) continue;
    cleaned.push({
      name,
      strength: typeof obj.strength === "string" && obj.strength ? obj.strength.trim() : undefined,
      dosageForm: typeof obj.dosageForm === "string" && obj.dosageForm ? obj.dosageForm.trim() : undefined,
      manufacturer:
        typeof obj.manufacturer === "string" && obj.manufacturer ? obj.manufacturer.trim() : undefined,
      confidence:
        typeof obj.confidence === "number" && !isNaN(obj.confidence)
          ? Math.max(0, Math.min(1, obj.confidence))
          : 0,
    });
  }

  // Dedupe by (name + strength) — keep the highest-confidence entry.
  const seen = new Map<string, DetectedMedicine>();
  for (const d of cleaned) {
    const key = `${d.name.toLowerCase()}|${(d.strength || "").toLowerCase()}`;
    const existing = seen.get(key);
    if (!existing || d.confidence > existing.confidence) {
      seen.set(key, d);
    }
  }
  return Array.from(seen.values());
}
