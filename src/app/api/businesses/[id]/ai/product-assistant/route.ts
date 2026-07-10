// POST /api/businesses/[id]/ai/product-assistant
// AI-powered product assistant: auto-generate descriptions, detect interactions, suggest categories
//
// Gap integrations:
//   • Gap 1/7 — Rate Limiter : checkAILimit() gates each LLM call per business quota
//   • Gap 4 — Error Fallback : buildFallback()/classifyError() shape every failure mode
//   • No AI cache — product-specific queries (per-product prompts) are too varied to cache
//     effectively, and the cost of a stale description/interaction-check is too high.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  checkAILimit,
  logAIUsage,
  estimateTokens,
} from "@/lib/ai-rate-limit";
import {
  buildFallback,
  classifyError,
  classifyRateLimitByType,
} from "@/lib/ai-fallback";
import { getAiConfig } from "@/lib/ai-config";
import {
  normalizeQuery,
  computeDataHash,
  getCachedResponse,
  setCachedResponse,
} from "@/lib/ai-cache";

// 7-day cache TTL for deterministic product-assistant actions.
// generate_description and suggest_category are product-specific and the
// answers don't change day-to-day, so a longer TTL is safe and saves tokens.
// check_interactions and suggest_dosage remain uncached (24h default would
// apply if they used the cache) because they depend on patient-specific inputs.
const PRODUCT_ASSISTANT_CACHE_TTL_HOURS = 24 * 7; // 7 days

const VALID_ACTIONS = [
  "generate_description",
  "check_interactions",
  "suggest_category",
  "suggest_dosage",
] as const;
type AssistantAction = (typeof VALID_ACTIONS)[number];

function featureFor(action: AssistantAction): string {
  return `product-assistant:${action}`;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;

  try {
    const body = await req.json();
    const { action, productId, productData } = body;

    // Validate action before consuming any quota.
    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        {
          error: `Unknown action. Use: ${VALID_ACTIONS.join(", ")}`,
        },
        { status: 400 }
      );
    }
    const typedAction = action as AssistantAction;
    const feature = featureFor(typedAction);

    // ── 1. Rate limit check (Gap 1/7) ──
    const limitCheck = await checkAILimit(businessId);
    if (!limitCheck.allowed) {
      const fallbackReason = classifyRateLimitByType(limitCheck.limitType, limitCheck.reason);
      const fallback = buildFallback(fallbackReason, {
        retryAfterSeconds: limitCheck.retryAfterSeconds,
        errorMessage: limitCheck.reason,
      });
      await logAIUsage(businessId, feature, 0, false, `rate_limited:${limitCheck.limitType}`);

      return NextResponse.json(
        {
          success: false,
          ...fallback,
          error: fallback.fallbackMessage,
          type: "rate_limit",
          limitType: limitCheck.limitType,
          remaining: limitCheck.remaining,
        },
        {
          status: 429,
          headers: limitCheck.retryAfterSeconds
            ? { "Retry-After": String(limitCheck.retryAfterSeconds) }
            : undefined,
        }
      );
    }

    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    // Load configurable AI limits for this feature (max_tokens + maxInputProducts)
    const aiConfig = await getAiConfig("product-assistant");
    const maxProducts = aiConfig.maxInputProducts ?? 20;

    // ── 2. Dispatch by action — each path makes its own LLM call ──

    // ── Action: Generate product description ──
    if (typedAction === "generate_description") {
      const product = productData || (productId
        ? await db.product.findFirst({
            where: { id: productId, businessId },
            select: { name: true, genericName: true, strength: true, dosageForm: true, manufacturer: true, scheduleType: true, isPrescription: true },
          })
        : null);

      if (!product) {
        return NextResponse.json({ error: "Product data required" }, { status: 400 });
      }

      // ── Cache lookup (7-day TTL) ──
      // Product descriptions are deterministic given the product fields, so we
      // cache them for 7 days. Key includes the product field hash so any edit
      // to the product (name, generic, strength, etc.) invalidates the cache.
      const cacheKey = `${product.name}|${product.genericName || ""}|${product.strength || ""}|${product.dosageForm || ""}|${product.manufacturer || ""}|${product.scheduleType || ""}|${product.isPrescription}`;
      const cacheQuery = normalizeQuery(`${typedAction}:${product.name}`);
      const cacheHash = computeDataHash(cacheKey);

      const cached = await getCachedResponse(businessId, feature, cacheQuery, cacheHash);
      if (cached) {
        // Log a zero-token cache hit so usage dashboards see the activity.
        await logAIUsage(businessId, `${feature}-cache`, 0, true);
        return NextResponse.json({
          success: true,
          description: cached.response,
          tokensUsed: 0,
          cache: { hit: true, cachedAt: cached.cachedAt },
          remaining: limitCheck.remaining,
        });
      }

      const systemPrompt = `You are a pharmaceutical product catalog expert. Generate a concise, professional product description for a pharmacy inventory system. Include: what it treats, common uses, key warnings. Keep it under 100 words. Do not include dosing instructions.`;
      const userContent = `Product: ${product.name}\nGeneric: ${product.genericName || "Unknown"}\nStrength: ${product.strength || "Unknown"}\nForm: ${product.dosageForm || "Unknown"}\nManufacturer: ${product.manufacturer || "Unknown"}\nSchedule: ${product.scheduleType || "OTC"}\nPrescription required: ${product.isPrescription ? "Yes" : "No"}`;

      const completion = await zai.chat.completions.create({
        messages: [
          { role: "assistant", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        thinking: { type: "disabled" },
        max_tokens: aiConfig.maxOutputTokens,
      });

      const description = completion.choices[0]?.message?.content || "";
      const tokens = extractTokens(completion, systemPrompt, userContent, description);

      await logAIUsage(businessId, feature, tokens, true);

      // ── Cache write (7-day TTL) ──
      if (description) {
        await setCachedResponse(
          businessId,
          feature,
          cacheQuery,
          cacheHash,
          description,
          tokens,
          PRODUCT_ASSISTANT_CACHE_TTL_HOURS
        );
      }

      return NextResponse.json({
        success: true,
        description,
        tokensUsed: tokens,
        cache: { hit: false },
        remaining: limitCheck.remaining,
      });
    }

    // ── Action: Check drug interactions ──
    if (typedAction === "check_interactions") {
      const { products, conditions } = body;

      if (!Array.isArray(products) || products.length === 0) {
        return NextResponse.json({ error: "Products array required" }, { status: 400 });
      }

      // Cap on medications per request — prevents a single abuser from sending
      // 100+ meds and burning 6,500+ tokens of input + 3,000+ tokens of output.
      // Value is configurable from super-admin panel (default 20).
      if (products.length > maxProducts) {
        return NextResponse.json(
          {
            error: `Too many products in a single request (max ${maxProducts}). Received ${products.length}. Please split the request into smaller batches.`,
            maxAllowed: maxProducts,
            received: products.length,
          },
          { status: 400 }
        );
      }

      const systemPrompt = `You are a clinical pharmacist. Analyze the provided medications and patient conditions for potential drug interactions, contraindications, and safety concerns.

Return a JSON object:
{
  "riskLevel": "none" | "low" | "moderate" | "high" | "severe",
  "interactions": [
    {
      "severity": "mild" | "moderate" | "severe",
      "description": "What the interaction is",
      "recommendation": "What to do about it"
    }
  ],
  "conditionWarnings": [
    {
      "condition": "The patient condition",
      "warning": "Why this medication may be problematic",
      "recommendation": "What to suggest instead"
    }
  ],
  "generalAdvice": "Overall safety recommendation"
}

If no interactions found, return empty arrays and riskLevel "none". Be thorough but practical.`;
      const userContent = `Medications being dispensed:\n${JSON.stringify(products, null, 2)}\n\nPatient conditions/allergies:\n${JSON.stringify(conditions || [], null, 2)}`;

      const completion = await zai.chat.completions.create({
        messages: [
          { role: "assistant", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        thinking: { type: "disabled" },
        max_tokens: aiConfig.maxOutputTokens,
      });

      const response = completion.choices[0]?.message?.content || "";
      let result;
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : { generalAdvice: response };
      } catch {
        result = { generalAdvice: response };
      }

      const tokens = extractTokens(completion, systemPrompt, userContent, response);
      await logAIUsage(businessId, feature, tokens, true);

      return NextResponse.json({
        success: true,
        interactionCheck: result,
        tokensUsed: tokens,
        remaining: limitCheck.remaining,
      });
    }

    // ── Action: Suggest category ──
    if (typedAction === "suggest_category") {
      const { productName, genericName } = body;

      // ── Cache lookup (7-day TTL) ──
      // Category suggestions are deterministic given (productName, genericName),
      // so we cache them for 7 days.
      const cacheKey = `${productName || ""}|${genericName || ""}`;
      const cacheQuery = normalizeQuery(`${typedAction}:${productName || ""}:${genericName || ""}`);
      const cacheHash = computeDataHash(cacheKey);

      const cached = await getCachedResponse(businessId, feature, cacheQuery, cacheHash);
      if (cached) {
        await logAIUsage(businessId, `${feature}-cache`, 0, true);
        try {
          const cachedResult = JSON.parse(cached.response);
          return NextResponse.json({
            success: true,
            suggestion: cachedResult,
            tokensUsed: 0,
            cache: { hit: true, cachedAt: cached.cachedAt },
            remaining: limitCheck.remaining,
          });
        } catch {
          // Cached response wasn't valid JSON — fall through to LLM
        }
      }

      const systemPrompt = `You are a pharmacy categorization expert. Given a product name and generic name, suggest the most appropriate pharmacy category. Respond in JSON:
{
  "suggestedCategory": "category name",
  "suggestedType": "medicine" | "surgical" | "cosmetic" | "supplement" | "baby-care" | "other",
  "suggestedColor": "hex color code",
  "confidence": "high" | "medium" | "low",
  "reason": "why this category"
}

Common pharmacy categories: Antibiotics, Pain & Fever, Cold & Flu, Digestive Health, Diabetes, Heart & BP, Vitamins & Supplements, Skin Care, Eye & Ear, Baby Care, Surgical Items, Cosmetics & Beauty, Personal Care, First Aid, Herbal & Homeopathy, Medical Devices, Orthopedic, Respiratory.`;
      const userContent = `Product: ${productName || "Unknown"}\nGeneric: ${genericName || "Unknown"}`;

      const completion = await zai.chat.completions.create({
        messages: [
          { role: "assistant", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        thinking: { type: "disabled" },
        max_tokens: aiConfig.maxOutputTokens,
      });

      const response = completion.choices[0]?.message?.content || "";
      let result;
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch {
        result = {};
      }

      const tokens = extractTokens(completion, systemPrompt, userContent, response);
      await logAIUsage(businessId, feature, tokens, true);

      // ── Cache write (7-day TTL) ──
      if (response) {
        await setCachedResponse(
          businessId,
          feature,
          cacheQuery,
          cacheHash,
          response, // store the raw LLM response (JSON string)
          tokens,
          PRODUCT_ASSISTANT_CACHE_TTL_HOURS
        );
      }

      return NextResponse.json({
        success: true,
        suggestion: result,
        tokensUsed: tokens,
        cache: { hit: false },
        remaining: limitCheck.remaining,
      });
    }

    // ── Action: Suggest dosage info ──
    if (typedAction === "suggest_dosage") {
      const { genericName, strength, dosageForm } = body;

      const systemPrompt = `You are a clinical pharmacist. Provide standard dosage information for the given medication. Return JSON:
{
  "adultDose": "Standard adult dosage",
  "pediatricDose": "Standard pediatric dosage (if applicable)",
  "maxDailyDose": "Maximum daily dose",
  "commonSideEffects": ["effect1", "effect2", "effect3"],
  "keyWarnings": ["warning1", "warning2"],
  "storageAdvice": "How to store"
}
Keep it concise and factual. Do not include specific brand recommendations.`;
      const userContent = `Generic: ${genericName || "Unknown"}\nStrength: ${strength || "Unknown"}\nForm: ${dosageForm || "Unknown"}`;

      const completion = await zai.chat.completions.create({
        messages: [
          { role: "assistant", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        thinking: { type: "disabled" },
        max_tokens: aiConfig.maxOutputTokens,
      });

      const response = completion.choices[0]?.message?.content || "";
      let result;
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch {
        result = {};
      }

      const tokens = extractTokens(completion, systemPrompt, userContent, response);
      await logAIUsage(businessId, feature, tokens, true);

      return NextResponse.json({
        success: true,
        dosageInfo: result,
        tokensUsed: tokens,
        remaining: limitCheck.remaining,
      });
    }

    // Should be unreachable thanks to the early VALID_ACTIONS check, but keep
    // the original 400 response shape as a safety net.
    return NextResponse.json(
      { error: `Unknown action. Use: ${VALID_ACTIONS.join(", ")}` },
      { status: 400 }
    );
  } catch (error) {
    console.error("Product assistant error:", error);

    // We don't know which action triggered the failure here, but the catch
    // wraps all of them — log under the generic feature name so usage stats
    // still capture the failed attempt.
    await logAIUsage(
      businessId,
      "product-assistant",
      0,
      false,
      error instanceof Error ? error.message : String(error)
    ).catch(() => undefined);

    const reason = classifyError(error);
    const fallback = buildFallback(reason, {
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        ...fallback,
        error: fallback.fallbackMessage,
        type: "llm_error",
      },
      { status: 500 }
    );
  }
}

// ── Helpers ──

/**
 * Extract total tokens from an LLM completion, falling back to a heuristic
 * estimate (system + user + response) when the SDK doesn't report usage.
 */
function extractTokens(
  completion: unknown,
  systemPrompt: string,
  userContent: string,
  response: string
): number {
  const c = completion as { usage?: { total_tokens?: number } };
  const sdkTokens: unknown = c?.usage?.total_tokens;
  if (typeof sdkTokens === "number" && sdkTokens > 0) return sdkTokens;
  return (
    estimateTokens(systemPrompt) +
    estimateTokens(userContent) +
    estimateTokens(response)
  );
}
