// POST /api/businesses/[id]/ai/expiry-optimizer
// Analyzes near-expiry batches and recommends optimal actions using LLM
//
// Gap integrations:
//   • Gap 1/7 — Rate Limiter : checkAILimit() gates the LLM call per business quota
//   • Gap 9 — AI Cache       : getCachedResponse() returns prior recommendations if batch data unchanged
//   • Gap 4 — Error Fallback : buildFallback()/classifyError() shape every failure mode
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  normalizeQuery,
  computeDataHash,
  getCachedResponse,
  setCachedResponse,
} from "@/lib/ai-cache";
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

const FEATURE = "expiry-optimizer";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const now = new Date();

  try {
    // ── 1. Rate limit check (Gap 1/7) ──
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

    // ── 2. Fetch batches (capped by configurable maxInputBatches) ──
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    // Load AI config early so we can apply maxInputBatches to the query.
    // Default is 50 — prevents a 500-batch pharmacy from sending a 35K-token prompt.
    const aiConfig = await getAiConfig("expiry-optimizer");
    const batchTake = aiConfig.maxInputBatches ?? 50;

    // Fetch batches expiring within 90 days (or already expired) with stock.
    // Capped to the configured limit, ordered by expiry ASC so the most urgent
    // batches are always analyzed first.
    const batches = await db.batch.findMany({
      where: {
        businessId,
        quantity: { gt: 0 },
        status: { in: ["active", "near_expiry", "expired"] },
        expiryDate: { lte: ninetyDaysFromNow },
      },
      include: {
        product: {
          select: {
            id: true, name: true, genericName: true, strength: true,
            unit: true, mrp: true, manufacturer: true,
            scheduleType: true, isPrescription: true,
            category: { select: { name: true, color: true } },
          },
        },
      },
      orderBy: { expiryDate: "asc" },
      take: batchTake,
    });

    if (batches.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No batches expiring within 90 days. Your inventory is healthy!",
        recommendations: [],
        summary: { totalBatches: 0, totalValueAtRisk: 0, criticalCount: 0 },
        cache: { hit: false },
        remaining: limitCheck.remaining,
      });
    }

    // Calculate data for each batch
    const batchData = batches.map((batch) => {
      const daysUntilExpiry = Math.floor(
        (batch.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const valueAtRisk = (batch.mrp || 0) * batch.quantity;
      const costValue = (batch.purchasePrice || 0) * batch.quantity;

      return {
        batchId: batch.id,
        batchNo: batch.batchNo,
        productId: batch.product.id,
        productName: batch.product.name,
        genericName: batch.product.genericName,
        strength: batch.product.strength,
        manufacturer: batch.product.manufacturer,
        category: batch.product.category,
        unit: batch.product.unit,
        mrp: batch.mrp,
        purchasePrice: batch.purchasePrice,
        scheduleType: batch.product.scheduleType,
        isPrescription: batch.product.isPrescription,
        quantity: batch.quantity,
        expiryDate: batch.expiryDate.toISOString().split("T")[0],
        daysUntilExpiry,
        status: batch.status,
        valueAtRisk: Math.round(valueAtRisk * 100) / 100,
        costValue: Math.round(costValue * 100) / 100,
      };
    });

    // Calculate total value at risk
    const totalValueAtRisk = batchData.reduce((sum, b) => sum + b.valueAtRisk, 0);
    const expiredBatches = batchData.filter((b) => b.daysUntilExpiry < 0);
    const criticalBatches = batchData.filter((b) => b.daysUntilExpiry >= 0 && b.daysUntilExpiry <= 7);
    const warningBatches = batchData.filter((b) => b.daysUntilExpiry > 7 && b.daysUntilExpiry <= 30);
    const noticeBatches = batchData.filter((b) => b.daysUntilExpiry > 30 && b.daysUntilExpiry <= 90);

    // ── 3. Cache check (Gap 9) ──
    const normalizedQuery = normalizeQuery(FEATURE);
    const dataHash = computeDataHash(batchData);
    const cached = await getCachedResponse(businessId, FEATURE, normalizedQuery, dataHash);
    if (cached) {
      // Re-hydrate recommendations from the cached raw LLM response.
      let cachedRecommendations: Array<Record<string, unknown>> = [];
      try {
        const jsonMatch = cached.response.match(/\[[\s\S]*\]/);
        cachedRecommendations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      } catch {
        cachedRecommendations = [];
      }

      // Merge batch data with cached recommendations (same logic as the live path)
      const enrichedRecommendations = batchData.map((batch) => {
        const rec = cachedRecommendations.find((r) => r.batchId === batch.batchId) || ({} as Record<string, unknown>);
        return {
          ...batch,
          action: (rec.action as string) || (batch.daysUntilExpiry < 0 ? "dispose" : "sell_priority"),
          discountPercent: (rec.discountPercent as number | null) ?? null,
          reason: (rec.reason as string) || "No recommendation available",
          urgency: (rec.urgency as string) || (batch.daysUntilExpiry < 0 ? "critical" : batch.daysUntilExpiry <= 7 ? "critical" : batch.daysUntilExpiry <= 30 ? "high" : "medium"),
          estimatedRecovery: (rec.estimatedRecovery as string) || "Unknown",
        };
      });

      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      enrichedRecommendations.sort((a, b) => {
        const uDiff = urgencyOrder[a.urgency as keyof typeof urgencyOrder] - urgencyOrder[b.urgency as keyof typeof urgencyOrder];
        if (uDiff !== 0) return uDiff;
        return a.daysUntilExpiry - b.daysUntilExpiry;
      });

      const actionSummary = enrichedRecommendations.reduce((acc, r) => {
        acc[r.action] = (acc[r.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      await logAIUsage(businessId, "expiry-optimizer-cache", 0, true);

      return NextResponse.json({
        success: true,
        generatedAt: cached.cachedAt,
        summary: {
          totalBatches: batchData.length,
          totalValueAtRisk: Math.round(totalValueAtRisk * 100) / 100,
          expiredCount: expiredBatches.length,
          criticalCount: criticalBatches.length,
          warningCount: warningBatches.length,
          noticeCount: noticeBatches.length,
          actionSummary,
        },
        recommendations: enrichedRecommendations,
        cache: {
          hit: true,
          cachedAt: cached.cachedAt,
          originalTokensUsed: cached.tokensUsed,
        },
        remaining: limitCheck.remaining,
      });
    }

    // ── 4. Call LLM for action recommendations ──
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const systemPrompt = `You are a pharmaceutical inventory optimization expert. Analyze the provided batch expiry data and recommend specific actions for each batch.

For each batch, recommend ONE of these actions:
- "sell_priority" — Prioritize selling via FEFO (for batches with enough time)
- "discount" — Offer a discount to sell faster (specify percentage)
- "return_supplier" — Return to supplier if possible (for batches that won't sell in time)
- "donate" — Donate to charity/NGO (for near-expiry that can't be sold)
- "dispose" — Safe disposal (for expired batches)
- "quarantine" — Quarantine for quality review

Return a JSON array where each element has:
{
  "batchId": "the batch ID",
  "action": "one of the actions above",
  "discountPercent": number or null (only if action is "discount"),
  "reason": "Short explanation of why this action",
  "urgency": "critical" | "high" | "medium" | "low",
  "estimatedRecovery": "How much money can be recovered (e.g., '60% via discount' or 'Full refund from supplier')"
}

Consider:
- Days until expiry (expired batches must be disposed)
- Quantity vs. likely sell-through rate
- Prescription vs OTC (OTC easier to discount)
- Schedule type (Schedule H/X have stricter rules)
- Value at risk (higher value = more effort to recover)

Be practical and pharmacy-specific. Return only the JSON array.`;

    const userContent = `Analyze these expiring batches:\n\n${JSON.stringify(batchData, null, 2)}`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      thinking: { type: "disabled" },
      max_tokens: aiConfig.maxOutputTokens,
    });

    const response = completion.choices[0]?.message?.content || "";

    // Parse recommendations
    let recommendations: Array<Record<string, unknown>>;
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      recommendations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      recommendations = [];
    }

    // Merge batch data with recommendations
    const enrichedRecommendations = batchData.map((batch) => {
      const rec = recommendations.find((r) => r.batchId === batch.batchId) || ({} as Record<string, unknown>);
      return {
        ...batch,
        action: (rec.action as string) || (batch.daysUntilExpiry < 0 ? "dispose" : "sell_priority"),
        discountPercent: (rec.discountPercent as number | null) ?? null,
        reason: (rec.reason as string) || "No recommendation available",
        urgency: (rec.urgency as string) || (batch.daysUntilExpiry < 0 ? "critical" : batch.daysUntilExpiry <= 7 ? "critical" : batch.daysUntilExpiry <= 30 ? "high" : "medium"),
        estimatedRecovery: (rec.estimatedRecovery as string) || "Unknown",
      };
    });

    // Sort by urgency then by days until expiry
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    enrichedRecommendations.sort((a, b) => {
      const uDiff = urgencyOrder[a.urgency as keyof typeof urgencyOrder] - urgencyOrder[b.urgency as keyof typeof urgencyOrder];
      if (uDiff !== 0) return uDiff;
      return a.daysUntilExpiry - b.daysUntilExpiry;
    });

    // Summary by action
    const actionSummary = enrichedRecommendations.reduce((acc, r) => {
      acc[r.action] = (acc[r.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // ── 5. Log + cache write ──
    const sdkTokens =
      (completion as { usage?: { total_tokens?: number } })?.usage?.total_tokens;
    const totalTokens =
      typeof sdkTokens === "number" && sdkTokens > 0
        ? sdkTokens
        : estimateTokens(systemPrompt) + estimateTokens(userContent) + estimateTokens(response);

    await logAIUsage(businessId, FEATURE, totalTokens, true);

    // Cache the raw LLM response so the merge logic can re-run on cache hit
    // (batch data may differ slightly even with same hash, but the recommendations
    // are stable for the same batch IDs).
    await setCachedResponse(businessId, FEATURE, normalizedQuery, dataHash, response, totalTokens);

    return NextResponse.json({
      success: true,
      generatedAt: now.toISOString(),
      summary: {
        totalBatches: batchData.length,
        totalValueAtRisk: Math.round(totalValueAtRisk * 100) / 100,
        expiredCount: expiredBatches.length,
        criticalCount: criticalBatches.length,
        warningCount: warningBatches.length,
        noticeCount: noticeBatches.length,
        actionSummary,
      },
      recommendations: enrichedRecommendations,
      cache: { hit: false },
      tokensUsed: totalTokens,
      remaining: limitCheck.remaining,
    });
  } catch (error) {
    console.error("Expiry optimizer error:", error);

    await logAIUsage(
      businessId,
      FEATURE,
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
