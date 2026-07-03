// src/lib/vision-provider.ts
// ── InventoryOS: Swappable vision AI provider ──
//
// Reads the active provider from the AiProvider table and routes shelf images
// to the right backend (Gemini, Z.ai vision, or Z.ai GLM-OCR).
//
// Z.ai models:
//   glm-ocr          → POST /layout_parsing (OCR) + chat structuring step
//   glm-4.6v-flash   → POST /chat/completions (multimodal vision)

import { db } from "@/lib/db";
import {
  isZaiOcrModel,
  normalizeZaiVisionModel,
  ZAI_OCR_STRUCTURE_MODEL,
  zaiVisionModelHint,
} from "@/lib/zai-vision-models";
import { GEMINI_SHELF_RESPONSE_SCHEMA } from "@/lib/shelf-scan-schema";

export interface VisionDetection {
  name: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  confidence: number;
}

export interface VisionAnalysisResult {
  detections: VisionDetection[];
  rawResponse: string;
  tokensUsed: number;
  provider: string;
}

/** Tunable per-scan options (from Admin → Shelf Scanner config). */
export interface VisionCallOptions {
  maxTokens: number;
  temperature?: number;
  /** Disable Gemini 2.5+ internal reasoning (default true for shelf scans). */
  disableThinking?: boolean;
  /** Request JSON output from providers that support it (default true). */
  forceJsonOutput?: boolean;
}

interface ActiveProvider {
  provider: string;
  apiKey: string | null;
  baseUrl: string | null;
  model: string | null;
}

export async function getActiveVisionProvider(): Promise<ActiveProvider | null> {
  try {
    const row = await db.aiProvider.findFirst({
      where: { isActive: true },
    });
    if (!row || !row.apiKey) return null;
    return {
      provider: row.provider,
      apiKey: row.apiKey,
      baseUrl: row.baseUrl,
      model: row.model,
    };
  } catch (err) {
    console.error("[vision-provider] failed to read active provider:", err);
    return null;
  }
}

export async function analyzeWithActiveProvider(
  images: string[],
  options: VisionCallOptions,
  systemPrompt: string,
  userPrompt: string
): Promise<VisionAnalysisResult> {
  const provider = await getActiveVisionProvider();
  if (!provider) {
    throw new Error(
      "No AI vision provider configured. Go to Admin → API Setup → AI Providers to set an API key and activate a provider (Gemini or Z.ai)."
    );
  }

  const callOpts: VisionCallOptions = {
    temperature: 0.1,
    disableThinking: true,
    forceJsonOutput: true,
    ...options,
  };

  switch (provider.provider) {
    case "gemini":
      return analyzeWithGemini(images, callOpts, systemPrompt, userPrompt, provider.apiKey!, provider.model);
    case "zai":
      return analyzeWithZai(images, callOpts, systemPrompt, userPrompt, provider.apiKey!, provider.baseUrl, provider.model);
    default:
      throw new Error(`Unknown vision provider: "${provider.provider}"`);
  }
}

// ── Gemini ──

/** Gemini 2.5+ models spend "thinking" tokens from the same output budget. */
function isGeminiThinkingModel(model: string): boolean {
  const m = model.toLowerCase();
  return /gemini-2\.5|gemini-2-5|gemini-3/.test(m);
}

/** Collect visible text from all response parts (skip internal thought parts). */
function extractGeminiText(candidate: unknown): string {
  const parts = (candidate as { content?: { parts?: unknown[] } })?.content?.parts;
  if (!Array.isArray(parts)) return "";

  const nonThought: string[] = [];
  const allText: string[] = [];

  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const p = part as { thought?: boolean; text?: string };
    if (typeof p.text !== "string" || !p.text.trim()) continue;
    allText.push(p.text.trim());
    if (p.thought !== true) {
      nonThought.push(p.text.trim());
    }
  }

  // Prefer non-thought parts; fall back to all text if model didn't flag thoughts
  const joined = (nonThought.length ? nonThought : allText).join("\n");
  return joined.trim();
}

async function analyzeWithGemini(
  images: string[],
  options: VisionCallOptions,
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  model: string | null
): Promise<VisionAnalysisResult> {
  const { maxTokens, temperature = 0.1, disableThinking = true, forceJsonOutput = true } = options;

  // Images FIRST — multimodal models read labels better when photos precede the instruction.
  const parts: Array<Record<string, unknown>> = [];

  for (let i = 0; i < images.length; i++) {
    const dataUrl = images[i];
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!match) {
      throw new Error(`Invalid image data URL format for image ${i + 1}`);
    }
    parts.push({
      inlineData: {
        mimeType: match[1],
        data: match[2],
      },
    });
  }

  parts.push({ text: userPrompt });

  const geminiModel = model || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: maxTokens,
    temperature,
  };
  if (forceJsonOutput) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = GEMINI_SHELF_RESPONSE_SCHEMA;
  }
  if (isGeminiThinkingModel(geminiModel)) {
    // Always disable thinking for shelf OCR — reasoning burns tokens without helping label reading.
    generationConfig.thinkingConfig = { thinkingBudget: disableThinking ? 0 : 512 };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts }],
      generationConfig,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (HTTP ${response.status}): ${errText.substring(0, 300)}`);
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  const rawResponse = extractGeminiText(candidate);
  const tokensUsed = (data?.usageMetadata?.totalTokenCount as number) ?? 0;

  if (!rawResponse) {
    const finishReason = candidate?.finishReason ?? "unknown";
    const blockReason = data?.promptFeedback?.blockReason;
    const thoughtsTokens = data?.usageMetadata?.thoughtsTokenCount;
    console.error("[vision-provider] Gemini empty response:", {
      model: geminiModel,
      finishReason,
      blockReason,
      thoughtsTokens,
      candidatesTokenCount: data?.usageMetadata?.candidatesTokenCount,
    });
    const hints: string[] = [];
    if (finishReason === "MAX_TOKENS") {
      hints.push("Increase Max Output Tokens for Shelf Scanner in Admin → AI Configuration (try 4096+).");
    }
    if (isGeminiThinkingModel(geminiModel) && (thoughtsTokens ?? 0) > 0) {
      hints.push("Gemini 2.5 thinking consumed the output budget — this is now auto-disabled for shelf scans.");
    }
    if (blockReason) {
      hints.push(`Content blocked by safety filter (${blockReason}).`);
    }
    throw new Error(
      `Gemini returned no text (finishReason=${finishReason}). ${hints.join(" ") || "Check your API key and model name."}`
    );
  }

  console.log(
    `[vision-provider] Gemini ${geminiModel}: ${images.length} image(s), ${rawResponse.length} chars response, ${tokensUsed} tokens`
  );

  return {
    detections: [],
    rawResponse,
    tokensUsed,
    provider: "gemini",
  };
}

// ── Z.ai ──

const ZAI_DEFAULT_BASE_URL = "https://api.z.ai/api/paas/v4";

async function analyzeWithZai(
  images: string[],
  options: VisionCallOptions,
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  baseUrl: string | null,
  model: string | null
): Promise<VisionAnalysisResult> {
  const visionModel = normalizeZaiVisionModel(model);
  if (visionModel !== (model ?? "").trim().toLowerCase() && model) {
    console.warn(
      `[vision-provider] normalized Z.ai model "${model}" → "${visionModel}"`
    );
  }

  if (isZaiOcrModel(visionModel)) {
    return analyzeWithZaiOcr(
      images,
      options,
      systemPrompt,
      userPrompt,
      apiKey,
      baseUrl
    );
  }

  return analyzeWithZaiVision(
    images,
    options,
    systemPrompt,
    userPrompt,
    apiKey,
    baseUrl,
    visionModel
  );
}

/** GLM-OCR: layout_parsing per image, then text LLM structures medicines. */
async function analyzeWithZaiOcr(
  images: string[],
  options: VisionCallOptions,
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  baseUrl: string | null
): Promise<VisionAnalysisResult> {
  const base = (baseUrl || ZAI_DEFAULT_BASE_URL).replace(/\/$/, "");
  const ocrUrl = `${base}/layout_parsing`;

  const ocrSections: string[] = [];
  let ocrTokens = 0;

  for (let i = 0; i < images.length; i++) {
    const response = await fetch(ocrUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "glm-ocr",
        file: images[i],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `Z.ai GLM-OCR error on image ${i + 1} (HTTP ${response.status}): ${errText.substring(0, 300)}`
      );
    }

    const data = await response.json();
    const md = typeof data.md_results === "string" ? data.md_results.trim() : "";
    const layoutText = extractLayoutText(data.layout_details);
    const combined = [md, layoutText].filter(Boolean).join("\n");
    ocrSections.push(`### Photo ${i + 1}\n${combined || "(no text detected)"}`);
    ocrTokens += data?.usage?.total_tokens ?? 0;
  }

  const ocrText = ocrSections.join("\n\n");
  console.log(`[vision-provider] GLM-OCR extracted ${ocrText.length} chars from ${images.length} image(s)`);

  const structurePrompt = [
    "The following text was extracted by GLM-OCR from pharmacy shelf photos.",
    "The text may be in English, Bangla (বাংলা), or mixed. Use ONLY this OCR text to identify medicines.",
    "",
    "=== OCR TEXT START ===",
    ocrText,
    "=== OCR TEXT END ===",
    "",
    userPrompt,
  ].join("\n");

  const structured = await zaiChatCompletion(
    apiKey,
    base,
    ZAI_OCR_STRUCTURE_MODEL,
    systemPrompt,
    structurePrompt,
    options
  );

  if (!structured.content.trim()) {
    throw new Error(
      "Z.ai GLM-OCR structuring step returned empty text. Try increasing Max Output Tokens or simplifying the prompt."
    );
  }

  return {
    detections: [],
    rawResponse: structured.content,
    tokensUsed: ocrTokens + structured.tokensUsed,
    provider: "zai-glm-ocr",
  };
}

/** Standard multimodal vision via /chat/completions. */
async function analyzeWithZaiVision(
  images: string[],
  options: VisionCallOptions,
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  baseUrl: string | null,
  visionModel: string
): Promise<VisionAnalysisResult> {
  const base = (baseUrl || ZAI_DEFAULT_BASE_URL).replace(/\/$/, "");

  const content: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
  > = [
    { type: "text", text: userPrompt },
    ...images.map((img) => ({ type: "image_url" as const, image_url: { url: img } })),
  ];

  const result = await zaiChatCompletion(apiKey, base, visionModel, systemPrompt, content, options, true);

  if (!result.content.trim()) {
    const reason = result.finishReason ?? "unknown";
    throw new Error(
      `Z.ai vision returned empty text (finish_reason=${reason}). Increase Max Output Tokens or disable reasoning on the model.`
    );
  }

  return {
    detections: [],
    rawResponse: result.content,
    tokensUsed: result.tokensUsed,
    provider: "zai",
  };
}

async function zaiChatCompletion(
  apiKey: string,
  base: string,
  model: string,
  systemPrompt: string,
  userContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>,
  options: VisionCallOptions,
  multimodal = false
): Promise<{ content: string; tokensUsed: number; finishReason?: string }> {
  const { maxTokens, temperature = 0.1, forceJsonOutput = true } = options;
  const url = `${base}/chat/completions`;

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: multimodal && Array.isArray(userContent)
          ? userContent
          : typeof userContent === "string"
            ? userContent
            : String(userContent),
      },
    ],
    max_tokens: maxTokens,
    temperature,
  };
  if (forceJsonOutput) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    const isUnknownModel =
      response.status === 400 &&
      (errText.includes('"code":"1211"') || errText.includes("Unknown Model"));
    const hint = isUnknownModel ? ` ${zaiVisionModelHint(model)}` : "";
    throw new Error(
      `Z.ai API error (HTTP ${response.status}): ${errText.substring(0, 300)}${hint}`
    );
  }

  const data = await response.json();
  return {
    content: data?.choices?.[0]?.message?.content ?? "",
    tokensUsed: data?.usage?.total_tokens ?? 0,
    finishReason: data?.choices?.[0]?.finish_reason,
  };
}

function extractLayoutText(layoutDetails: unknown): string {
  if (!Array.isArray(layoutDetails)) return "";

  const lines: string[] = [];
  for (const page of layoutDetails) {
    if (!Array.isArray(page)) continue;
    for (const el of page) {
      if (!el || typeof el !== "object") continue;
      const item = el as Record<string, unknown>;
      if (item.label === "text" && typeof item.content === "string") {
        const text = item.content.trim();
        if (text) lines.push(text);
      }
    }
  }
  return lines.join("\n");
}