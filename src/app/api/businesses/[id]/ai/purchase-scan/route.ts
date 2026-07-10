// POST /api/businesses/[id]/ai/purchase-scan
// AI vision purchase invoice scanner: receive ONE invoice photo, detect line items
// (productName, genericName, quantity, unit, batchNo, expiryDate, mfgDate, mrp, unitCost),
// match each against the product catalog, and return the structured result for the
// UI to add to the purchase cart.
//
// This endpoint ONLY READS Product + MasterProduct. It NEVER writes to Purchase,
// Product, or Inventory — the user reviews the detected items and submits via the
// existing POST /api/businesses/[id]/purchases endpoint.
//
// P1 design: ONE image per call. The UI accumulates results across multiple calls
// to build the full purchase (matches the proven shelf scanner pattern).
//
// AI defense stack integration (mirrors shelf-scan/route.ts):
//   • checkAILimit() — rate limit + tier gate + kill switch + circuit breaker
//   • logAIUsage()   — success/failure tracking for the super-admin dashboard
//   • buildFallback() — bilingual error messages on failure
//   • No AI cache — image content is never cacheable

import { NextRequest, NextResponse } from "next/server";
import {
  checkAILimit,
  logAIUsage,
} from "@/lib/ai-rate-limit";
import {
  buildFallback,
  classifyError,
  classifyRateLimitByType,
} from "@/lib/ai-fallback";
import { getAiConfig } from "@/lib/ai-config";
import { analyzePurchaseImage } from "@/lib/purchase-scan-ai";
import { matchPurchaseDetections } from "@/lib/purchase-scan-match";

const FEATURE = "purchase-scan";

// ── Limits ──
const MIN_IMAGES = 1;
const MAX_IMAGES = 1; // P1: one image at a time — UI accumulates across calls
const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6 MB per image (base64 length)

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: businessId } = await params;

  try {
    // ── 1. Parse + validate the request body ──
    const body = await req.json();
    const { image } = body as { image?: unknown };

    if (typeof image !== "string" || !image) {
      return NextResponse.json(
        {
          error: "Please upload one invoice photo (base64 data URL or HTTP URL).",
        },
        { status: 400 }
      );
    }

    const images = [image]; // P1: single image
    if (images.length < MIN_IMAGES) {
      return NextResponse.json(
        { error: `At least ${MIN_IMAGES} photo is required.` },
        { status: 400 }
      );
    }
    if (images.length > MAX_IMAGES) {
      return NextResponse.json(
        { error: `Purchase scan accepts ${MAX_IMAGES} photo at a time. Scan another page separately — items accumulate in the cart.` },
        { status: 400 }
      );
    }

    // Validate image size
    if (image.length > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Image exceeds the 6 MB limit. Please use a smaller photo." },
        { status: 400 }
      );
    }

    console.log(`[purchase-scan] image: ${image.length} chars, prefix: ${image.substring(0, 40)}`);

    // ── 2. Rate limit check (9-tier AI defense stack) ──
    const limitCheck = await checkAILimit(businessId);
    if (!limitCheck.allowed) {
      const fallbackReason = classifyRateLimitByType(limitCheck.limitType, limitCheck.reason);
      const fallback = buildFallback(fallbackReason, {
        retryAfterSeconds: limitCheck.retryAfterSeconds,
        errorMessage: limitCheck.reason,
      });
      await logAIUsage(businessId, FEATURE, 0, false, `rate_limited:${limitCheck.limitType}`);

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

    // ── 3. Load configurable AI limits ──
    const aiConfig = await getAiConfig(FEATURE);

    // ── 4. Call the vision model ──
    let analysis;
    try {
      analysis = await analyzePurchaseImage(images, {
        maxOutputTokens: aiConfig.maxOutputTokens,
        systemPrompt: aiConfig.systemPrompt ?? null,
        userPromptTemplate: aiConfig.userPromptTemplate ?? null,
        temperature: aiConfig.temperature ?? 0.1,
        disableThinking: aiConfig.disableThinking ?? true,
      });
    } catch (vlmError) {
      const vlmErrMsg = vlmError instanceof Error ? vlmError.message : String(vlmError);
      console.error("[purchase-scan] VLM call failed:", vlmErrMsg);
      await logAIUsage(businessId, FEATURE, 0, false, vlmErrMsg);

      return NextResponse.json(
        {
          success: false,
          error: `AI vision analysis failed: ${vlmErrMsg}`,
          type: "llm_error",
        },
        { status: 500 }
      );
    }

    const { detections, rawResponse, tokensUsed, diagnostic, provider } = analysis;

    if (detections.length === 0) {
      console.warn(`[purchase-scan] zero detections`, {
        provider,
        diagnostic,
        rawLen: rawResponse.length,
        rawSnippet: rawResponse.substring(0, 400),
      });
    }

    // ── 5. DB matching pass ──
    // For each detected item, try to find a client Product (this business's
    // inventory) first; if not found, try the MasterProduct catalog. Tag the
    // item's matchedMethod so the UI knows whether to show "matched" or "link manually".
    const items = await matchPurchaseDetections(businessId, detections);

    // ── 6. Log successful usage ──
    await logAIUsage(businessId, FEATURE, tokensUsed, true);

    // ── 7. Return the full match set for the UI to render ──
    const matchedCount = items.filter(
      (it) => it.matchedMethod === "ai" && it.productId
    ).length;
    const masterCatalogCount = items.filter(
      (it) => it.matchedMethod === "master-catalog"
    ).length;
    const unmatchedCount = items.filter(
      (it) => it.matchedMethod === "unmatched"
    ).length;

    return NextResponse.json({
      success: true,
      scan: {
        detectedCount: detections.length,
        matchedCount,
        masterCatalogCount,
        unmatchedCount,
        tokensUsed,
        provider,
        diagnostic: {
          parseMethod: diagnostic.parseMethod,
          parseFailed: diagnostic.parseFailed,
          message: diagnostic.message,
        },
      },
      items,
    });
  } catch (error) {
    console.error("[purchase-scan] unhandled error:", error);
    const fallbackReason = classifyError(error);
    const fallback = buildFallback(fallbackReason, {
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        success: false,
        error: fallback.fallbackMessage,
        type: "server_error",
      },
      { status: 500 }
    );
  }
}
