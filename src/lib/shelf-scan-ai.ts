// src/lib/shelf-scan-ai.ts
// ── InventoryOS: Shelf Scanner AI wrapper (provider-agnostic) ──

import type { AiConfigValue } from "@/lib/ai-config";
import { estimateTokens } from "@/lib/ai-rate-limit";
import {
  buildShelfUserPrompt,
  resolveShelfSystemPrompt,
  resolveShelfUserPromptTemplate,
} from "@/lib/shelf-scan-prompts";
import {
  parseShelfScanResponse,
  type DetectedMedicine,
  type ShelfParseDiagnostic,
} from "@/lib/shelf-scan-parse";
import { analyzeWithActiveProvider } from "@/lib/vision-provider";

export type { DetectedMedicine, ShelfParseDiagnostic };

export interface ShelfAnalysisResult {
  detections: DetectedMedicine[];
  rawResponse: string;
  tokensUsed: number;
  provider: string;
  diagnostic: ShelfParseDiagnostic;
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
      disableThinking: config.disableThinking !== false,
      forceJsonOutput: true,
    },
    systemPrompt,
    userPrompt
  );

  const { detections, diagnostic } = parseShelfScanResponse(result.rawResponse);

  if (detections.length === 0) {
    console.warn("[shelf-scan-ai] zero detections:", {
      provider: result.provider,
      diagnostic,
      rawSnippet: result.rawResponse.substring(0, 600),
      tokensUsed: result.tokensUsed,
    });
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
    diagnostic,
  };
}
