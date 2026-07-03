// src/lib/shelf-scan-ai.ts
// ── InventoryOS: Shelf Scanner AI wrapper (provider-agnostic) ──
//
// Prompts are editable from Admin → API Setup → Shelf Scanner.
// The API call is delegated to vision-provider.ts (Gemini, Z.ai, etc).

import type { AiConfigValue } from "@/lib/ai-config";
import { estimateTokens } from "@/lib/ai-rate-limit";
import {
  buildShelfUserPrompt,
  resolveShelfSystemPrompt,
  resolveShelfUserPromptTemplate,
} from "@/lib/shelf-scan-prompts";
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

export type ShelfScannerAiConfig = Pick<
  AiConfigValue,
  | "maxOutputTokens"
  | "systemPrompt"
  | "userPromptTemplate"
  | "temperature"
  | "disableThinking"
>;

/**
 * Analyze shelf photos and return a deduplicated list of detected medicines.
 */
export async function analyzeShelfImages(
  images: string[],
  config: ShelfScannerAiConfig
): Promise<ShelfAnalysisResult> {
  if (!images.length) {
    throw new Error("No images provided for shelf analysis");
  }

  const systemPrompt = resolveShelfSystemPrompt(config.systemPrompt);
  const userPromptTemplate = resolveShelfUserPromptTemplate(config.userPromptTemplate);
  const userPrompt = buildShelfUserPrompt(userPromptTemplate, images.length);

  const result = await analyzeWithActiveProvider(
    images,
    {
      maxTokens: config.maxOutputTokens,
      temperature: config.temperature ?? 0.1,
      disableThinking: config.disableThinking ?? true,
      forceJsonOutput: true,
    },
    systemPrompt,
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
      : estimateTokens(systemPrompt) + estimateTokens(userPrompt) + estimateTokens(result.rawResponse);

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
