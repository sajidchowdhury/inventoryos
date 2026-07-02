// src/lib/shelf-scan-ai.ts
// ── InventoryOS: Shelf Scanner AI wrapper (thin, swappable) ──
//
// This is the SINGLE place that talks to the vision model. The route handler
// (src/app/api/businesses/[id]/ai/shelf-scan/route.ts) calls analyzeShelfImages()
// and stays free of SDK specifics. To swap providers later (Claude 3.5 Sonnet,
// GPT-4o, Gemini Vision), edit only this file — rate-limit / kill-switch /
// usage-logging / cost-control all live above this layer and keep working.
//
// Provider: z-ai-web-dev-sdk (glm-4.6v vision model) — same SDK the rest of the
// app uses, so checkAILimit() / logAIUsage() / AiConfig all apply for free.
//
// Input: 1–3 shelf photos as base64 data URLs (e.g. "data:image/jpeg;base64,...").
// Output: a deduplicated list of detected medicines + the raw model response
// (for debugging/replay) + the token usage figure.

import type { AiConfigValue } from "@/lib/ai-config";
import { estimateTokens } from "@/lib/ai-rate-limit";

// ── Types ──

export interface DetectedMedicine {
  name: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  confidence: number; // 0.0–1.0
}

export interface ShelfAnalysisResult {
  detections: DetectedMedicine[];
  rawResponse: string;
  tokensUsed: number;
}

// ── Prompt ──
// The model is told to return STRICT JSON so the route handler can parse
// without regex guessing. The schema is intentionally narrow: only the fields
// we actually use for DB matching. "confidence" is the model's own read on
// how clearly it could see the label — we use it to decide whether to offer
// "Add Manually" (low confidence) vs auto-match (high confidence).

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
 * @param images  Array of 1–3 base64 data URLs (or HTTP URLs) — the photos to analyze.
 * @param config  AiConfigValue for "shelf-scanner" (provides maxOutputTokens).
 * @throws on SDK failure, empty input, or unparseable response.
 */
export async function analyzeShelfImages(
  images: string[],
  config: Pick<AiConfigValue, "maxOutputTokens">
): Promise<ShelfAnalysisResult> {
  if (!images.length) {
    throw new Error("No images provided for shelf analysis");
  }

  // Lazy import so ioredis / z-ai-web-dev-sdk are only loaded when actually used
  // (matches the pattern in product-assistant/route.ts).
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();

  // Build a single multimodal user message containing all photos. The vision
  // model sees them in order. One combined call is cheaper than N sequential
  // calls and lets the model dedupe across photos itself.
  const content: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: `Identify every medicine visible on this pharmacy shelf. There ${images.length === 1 ? "is 1 photo" : `are ${images.length} photos`}, possibly showing the same shelf from different angles. Return the JSON array as specified.`,
    },
    ...images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
  ];

  // glm-4.6v via createVision. thinking disabled — we want raw JSON, not reasoning.
  const completion = await zai.chat.completions.createVision({
    model: "glm-4.6v",
    messages: [
      { role: "assistant", content: [{ type: "text", text: SYSTEM_PROMPT }] },
      { role: "user", content },
    ],
    thinking: { type: "disabled" },
    max_tokens: config.maxOutputTokens,
  });

  const rawResponse: string =
    (completion as { choices?: Array<{ message?: { content?: string } }> })
      .choices?.[0]?.message?.content ?? "";

  // Parse the JSON array. The model is instructed to return ONLY JSON, but we
  // defensively extract the first [...] block in case it wraps in prose/fences.
  const detections = parseDetections(rawResponse);

  // Token accounting: prefer SDK-reported usage, fall back to heuristic estimate.
  const sdkTokens = (completion as { usage?: { total_tokens?: number } })?.usage?.total_tokens;
  const tokensUsed =
    typeof sdkTokens === "number" && sdkTokens > 0
      ? sdkTokens
      : estimateTokens(SYSTEM_PROMPT) + estimateTokens(JSON.stringify(content)) + estimateTokens(rawResponse);

  return { detections, rawResponse, tokensUsed };
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
    if (!name) continue; // skip entries without a name
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
