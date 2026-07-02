// src/lib/vision-provider.ts
// ── InventoryOS: Swappable vision AI provider ──
//
// Reads the active provider from the AiProvider table and routes the image
// analysis call to the right backend (Gemini, Z.ai, or future OpenAI).
//
// The super-admin panel controls which provider is active + stores the API key.
// To add a new provider: add a case to analyzeWithProvider() + a row to the
// AiProvider table.
//
// Current providers:
//   - gemini  → Google Gemini 2.0 Flash (REST API, free tier)
//   - zai     → Z.ai glm-4.6v (z-ai-web-dev-sdk, paid)
//
// Both accept base64 data URLs and return a raw text response that the caller
// parses into a JSON detections array.

import { db } from "@/lib/db";

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

interface ActiveProvider {
  provider: string;
  apiKey: string | null;
  baseUrl: string | null;
}

/**
 * Read the active vision provider from the DB.
 * Returns null if no provider is active or the active one has no API key.
 */
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
    };
  } catch (err) {
    console.error("[vision-provider] failed to read active provider:", err);
    return null;
  }
}

/**
 * Analyze shelf images using the active vision provider.
 * Throws if no provider is configured or the provider's API call fails.
 *
 * @param images    Array of base64 data URLs
 * @param maxTokens Max output tokens (from AiConfig)
 */
export async function analyzeWithActiveProvider(
  images: string[],
  maxTokens: number,
  systemPrompt: string,
  userPrompt: string
): Promise<VisionAnalysisResult> {
  const provider = await getActiveVisionProvider();
  if (!provider) {
    throw new Error(
      "No AI vision provider configured. Go to Admin → API Setup → AI Providers to set an API key and activate a provider (Gemini or Z.ai)."
    );
  }

  switch (provider.provider) {
    case "gemini":
      return analyzeWithGemini(images, maxTokens, systemPrompt, userPrompt, provider.apiKey!);
    case "zai":
      return analyzeWithZai(images, maxTokens, systemPrompt, userPrompt, provider.apiKey!, provider.baseUrl);
    default:
      throw new Error(`Unknown vision provider: "${provider.provider}"`);
  }
}

// ── Gemini (Google AI Studio REST API) ──
// Free tier: https://aistudio.google.com → get API key
// Model: gemini-2.0-flash (fast, supports images, generous free quota)
//
// The request shape:
//   POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=KEY
//   { contents: [{ parts: [{ text }, { inline_data: { mime_type, data } }] }] }

async function analyzeWithGemini(
  images: string[],
  maxTokens: number,
  systemPrompt: string,
  userPrompt: string,
  apiKey: string
): Promise<VisionAnalysisResult> {
  // Build the parts array: system prompt + user prompt + images
  const parts: Array<Record<string, unknown>> = [
    { text: `${systemPrompt}\n\n${userPrompt}` },
  ];

  for (const dataUrl of images) {
    // Parse "data:image/jpeg;base64,..." → { mimeType, data }
    const match = dataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (!match) {
      throw new Error("Invalid image data URL format");
    }
    parts.push({
      inline_data: {
        mime_type: match[1],
        data: match[2],
      },
    });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (HTTP ${response.status}): ${errText.substring(0, 300)}`);
  }

  const data = await response.json();
  const rawResponse: string =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  // Gemini reports usage in promptTokenCount + candidatesTokenCount
  const tokensUsed =
    (data?.usageMetadata?.totalTokenCount as number) ?? 0;

  return {
    detections: [], // caller parses rawResponse into detections
    rawResponse,
    tokensUsed,
    provider: "gemini",
  };
}

// ── Z.ai (GLM-4.6V) ──
// Public API: https://open.bigmodel.cn/api/paas/v4 (China) or
//              https://api.z.ai/api/paas/v4 (international)
// The super-admin sets apiKey + baseUrl in the admin panel.
// Default baseUrl if not set: https://open.bigmodel.cn/api/paas/v4

const ZAI_DEFAULT_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

async function analyzeWithZai(
  images: string[],
  maxTokens: number,
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  baseUrl: string | null
): Promise<VisionAnalysisResult> {
  // Construct the ZAI instance directly with the key from the admin panel.
  // This bypasses getZai()/config-file resolution entirely so the user's
  // own API key + the public endpoint are used.
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = new ZAI({
    baseUrl: baseUrl || ZAI_DEFAULT_BASE_URL,
    apiKey,
  });

  const content: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
  > = [
    { type: "text", text: userPrompt },
    ...images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
  ];

  const completion = await zai.chat.completions.createVision({
    model: "glm-4.6v",
    messages: [
      { role: "assistant", content: [{ type: "text", text: systemPrompt }] },
      { role: "user", content },
    ],
    thinking: { type: "disabled" },
    max_tokens: maxTokens,
  });

  const rawResponse: string =
    (completion as { choices?: Array<{ message?: { content?: string } }> })
      .choices?.[0]?.message?.content ?? "";

  const sdkTokens = (completion as { usage?: { total_tokens?: number } })?.usage?.total_tokens;
  const tokensUsed = typeof sdkTokens === "number" && sdkTokens > 0 ? sdkTokens : 0;

  return {
    detections: [],
    rawResponse,
    tokensUsed,
    provider: "zai",
  };
}
