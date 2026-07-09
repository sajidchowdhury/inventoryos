// src/lib/purchase-scan-ai.ts
// ── InventoryOS: Purchase Scanner AI wrapper (provider-agnostic) ──
// Mirrors shelf-scan-ai.ts but extracts invoice line items instead of shelf stock.
// Reuses the same vision-provider + salvage-parser patterns.

import type { AiConfigValue } from "@/lib/ai-config";
import { estimateTokens } from "@/lib/ai-rate-limit";
import {
  resolvePurchaseScanSystemPrompt,
  resolvePurchaseScanUserPromptTemplate,
  buildPurchaseScanUserPrompt,
} from "@/lib/purchase-scan-prompts";
import {
  parsePurchaseScanResponse,
  type DetectedInvoiceItem,
  type PurchaseParseDiagnostic,
} from "@/lib/purchase-scan-parse";
import { analyzeWithActiveProvider } from "@/lib/vision-provider";

export type { DetectedInvoiceItem, PurchaseParseDiagnostic };

export interface PurchaseAnalysisResult {
  detections: DetectedInvoiceItem[];
  rawResponse: string;
  tokensUsed: number;
  provider: string;
  diagnostic: PurchaseParseDiagnostic;
}

export type PurchaseScanAiConfig = Pick<
  AiConfigValue,
  | "maxOutputTokens"
  | "systemPrompt"
  | "userPromptTemplate"
  | "temperature"
  | "disableThinking"
>;

/**
 * Analyze an invoice photo and return detected line items.
 * Accepts ONE image per call (P1 design: accumulate in UI across multiple calls).
 */
export async function analyzePurchaseImage(
  images: string[],
  config: PurchaseScanAiConfig
): Promise<PurchaseAnalysisResult> {
  if (!images.length) {
    throw new Error("No image provided for purchase scan");
  }
  if (images.length > 1) {
    // P1 hard limit — one image at a time. UI accumulates across calls.
    throw new Error(`Purchase scan accepts 1 image at a time (got ${images.length})`);
  }

  const systemPrompt = resolvePurchaseScanSystemPrompt(config.systemPrompt);
  const userPromptTemplate = resolvePurchaseScanUserPromptTemplate(config.userPromptTemplate);
  const userPrompt = buildPurchaseScanUserPrompt(userPromptTemplate, images.length);

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

  let { detections, diagnostic } = parsePurchaseScanResponse(result.rawResponse);
  let tokensUsed = result.tokensUsed;

  // If JSON mode returned unparseable text, retry once in plain-text mode
  if (detections.length === 0 && diagnostic.parseFailed) {
    console.warn("[purchase-scan-ai] JSON parse failed, retrying in plain-text mode…", {
      preview: diagnostic.rawPreview,
    });
    const retry = await analyzeWithActiveProvider(
      images,
      { ...callOpts, forceJsonOutput: false },
      systemPrompt,
      userPrompt + "\n\nList every line item from this invoice, one per line. For each item include: product name, quantity, batch number, expiry date, MRP, unit cost — separated by commas."
    );
    const retryParsed = parsePurchaseScanResponse(retry.rawResponse);
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
    console.warn("[purchase-scan-ai] zero detections:", {
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
