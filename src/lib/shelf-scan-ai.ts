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

  const callOpts = {
    maxTokens: config.maxOutputTokens,
    temperature: config.temperature ?? 0.1,
    disableThinking: config.disableThinking !== false,
  };

  let result = await analyzeWithActiveProvider(
    images,
    { ...callOpts, forceJsonOutput: true },
    systemPrompt,
    userPrompt
  );

  let { detections, diagnostic } = parseShelfScanResponse(result.rawResponse);
  let tokensUsed = result.tokensUsed;

  // If JSON mode returned unparseable text, retry once in plain-text mode
  // (matches how Claude responds — bullet lists instead of strict JSON).
  if (detections.length === 0 && diagnostic.parseFailed) {
    console.warn("[shelf-scan-ai] JSON parse failed, retrying in plain-text mode…", {
      preview: diagnostic.rawPreview,
    });
    const retry = await analyzeWithActiveProvider(
      images,
      { ...callOpts, forceJsonOutput: false },
      systemPrompt,
      userPrompt + "\n\nList every medicine box label you can read. Use a simple bullet list, one medicine per line."
    );
    const retryParsed = parseShelfScanResponse(retry.rawResponse);
    if (retryParsed.detections.length > 0) {
      detections = retryParsed.detections;
      diagnostic = retryParsed.diagnostic;
      result = retry;
      tokensUsed += retry.tokensUsed;
    } else if (!retryParsed.diagnostic.parseFailed) {
      diagnostic = retryParsed.diagnostic;
    }
    tokensUsed = tokensUsed > 0 ? tokensUsed : retry.tokensUsed;
  }

  if (detections.length === 0) {
    console.warn("[shelf-scan-ai] zero detections:", {
      provider: result.provider,
      diagnostic,
      rawSnippet: result.rawResponse.substring(0, 800),
      tokensUsed,
    });
  }

  if (tokensUsed <= 0) {
    tokensUsed =
      estimateTokens(systemPrompt) + estimateTokens(userPrompt) + estimateTokens(result.rawResponse);
  }

  return {
    detections,
    rawResponse: result.rawResponse,
    tokensUsed,
    provider: result.provider,
    diagnostic,
  };
}
