// POST /api/businesses/[id]/ai/insights
// Gathers business data, sends to LLM, returns AI-generated insights & recommendations
//
// Gap integrations:
//   • Gap 1/7 — Rate Limiter : checkAILimit() gates the LLM call per business quota
//   • Gap 9 — AI Cache       : getCachedResponse() returns prior insights if data unchanged
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

const FEATURE = "insights";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const now = new Date();

  try {
    // ── 1. Rate limit check (Gap 1/7) — insights has no SQL router shortcut ──
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

    // ── 2. Gather business data for AI analysis ──
    const monthStart = new Date(now); monthStart.setMonth(monthStart.getMonth() - 1);

    // Sales data
    const [monthSales, todaySales] = await Promise.all([
      db.sale.aggregate({
        where: { businessId, status: "completed", createdAt: { gte: monthStart } },
        _sum: { totalAmount: true, discountAmount: true },
        _count: true,
      }),
      db.sale.aggregate({
        where: { businessId, status: "completed", createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
        _sum: { totalAmount: true },
        _count: true,
      }),
    ]);

    // Top products
    const topProducts = await db.saleItem.groupBy({
      by: ["productId", "productName"],
      where: { businessId, sale: { status: "completed", createdAt: { gte: monthStart } } },
      _sum: { quantity: true, totalPrice: true },
      _count: true,
      orderBy: { _sum: { totalPrice: "desc" } },
      take: 10,
    });

    // Inventory data
    const lowStockProducts = await db.product.findMany({
      where: { businessId, isActive: true, inventory: { quantity: { lte: 10 } } },
      include: { inventory: true, category: { select: { name: true } } },
      take: 10,
    });

    // Expiry data
    const expiringBatches = await db.batch.findMany({
      where: {
        businessId, quantity: { gt: 0 },
        status: { in: ["active", "near_expiry", "expired"] },
      },
      include: { product: { select: { name: true, unit: true } } },
      orderBy: { expiryDate: "asc" },
      take: 10,
    });

    // Purchase data
    const monthPurchases = await db.purchase.aggregate({
      where: { businessId, status: { not: "cancelled" }, createdAt: { gte: monthStart } },
      _sum: { totalAmount: true },
      _count: true,
    });

    // Returns
    const monthReturns = await db.return.aggregate({
      where: { businessId, createdAt: { gte: monthStart } },
      _sum: { refundAmount: true },
      _count: true,
    });

    // Customer data
    const totalCustomers = await db.customer.count({ where: { businessId, isActive: true } });

    // Compile data summary for AI
    const dataSummary = {
      business: "Pharmacy",
      period: "Last 30 days",
      sales: {
        monthTotal: monthSales._sum.totalAmount || 0,
        monthCount: monthSales._count,
        todayTotal: todaySales._sum.totalAmount || 0,
        todayCount: todaySales._count,
        avgSaleValue: monthSales._count > 0 ? (monthSales._sum.totalAmount || 0) / monthSales._count : 0,
        totalDiscounts: monthSales._sum.discountAmount || 0,
      },
      purchases: {
        monthTotal: monthPurchases._sum.totalAmount || 0,
        monthCount: monthPurchases._count,
      },
      returns: {
        monthRefund: monthReturns._sum.refundAmount || 0,
        monthCount: monthReturns._count,
      },
      inventory: {
        lowStockCount: lowStockProducts.length,
        lowStockProducts: lowStockProducts.map((p) => ({
          name: p.name,
          stock: p.inventory?.quantity || 0,
          category: p.category?.name,
          reorderLevel: p.reorderLevel,
        })),
      },
      expiry: {
        expiringBatches: expiringBatches.map((b) => ({
          product: b.product.name,
          batchNo: b.batchNo,
          expiry: b.expiryDate.toISOString().split("T")[0],
          quantity: b.quantity,
          status: b.status,
        })),
      },
      topProducts: topProducts.map((p) => ({
        name: p.productName,
        quantitySold: p._sum.quantity,
        revenue: p._sum.totalPrice,
      })),
      customers: { total: totalCustomers },
    };

    // ── 3. Cache check (Gap 9) — same data + same feature → reuse prior insights ──
    const normalizedQuery = normalizeQuery(FEATURE);
    const dataHash = computeDataHash(dataSummary);
    const cached = await getCachedResponse(businessId, FEATURE, normalizedQuery, dataHash);
    if (cached) {
      // Cache hit → no LLM call, no quota charge.
      let cachedInsights: unknown;
      try {
        const jsonMatch = cached.response.match(/\{[\s\S]*\}/);
        cachedInsights = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(cached.response || "{}");
      } catch {
        cachedInsights = {
          summary: cached.response.substring(0, 200) || "Cached insights unavailable",
          healthScore: 50,
          healthLabel: "Fair",
          insights: [],
          recommendations: [],
        };
      }

      await logAIUsage(businessId, "insights-cache", 0, true);

      return NextResponse.json({
        success: true,
        insights: cachedInsights,
        generatedAt: cached.cachedAt,
        dataPoints: {
          salesAnalyzed: monthSales._count,
          productsAnalyzed: topProducts.length,
          lowStockItems: lowStockProducts.length,
          expiringBatches: expiringBatches.length,
        },
        cache: {
          hit: true,
          cachedAt: cached.cachedAt,
          originalTokensUsed: cached.tokensUsed,
        },
        remaining: limitCheck.remaining,
      });
    }

    // ── 4. Call LLM for insights ──
    // System prompt kept lean (~300 tokens) to reduce per-call cost.
    // The JSON schema contract is preserved so the client parser still works.
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const systemPrompt = `You are a pharmacy business analyst. Return ONLY JSON:
{"summary":"2-3 sentence executive summary","healthScore":1-100,"healthLabel":"Excellent"|"Good"|"Fair"|"Needs Attention"|"Critical","insights":[{"type":"success"|"warning"|"danger"|"info"|"tip","category":"Sales"|"Inventory"|"Expiry"|"Customers"|"Purchases"|"Financial","title":"short","description":"with specific numbers","action":"recommended action"}],"recommendations":[{"priority":"high"|"medium"|"low","title":"short","description":"what and why","expectedImpact":"benefit"}]}

Generate 5-8 insights and 3-5 recommendations. Use specific numbers from the data. Be actionable and pharmacy-specific.`;

    const userContent = `Analyze this pharmacy data:\n\n${JSON.stringify(dataSummary, null, 2)}`;

    // ── Call the LLM (with configurable max_tokens cap) ──
    const aiConfig = await getAiConfig("insights");

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      thinking: { type: "disabled" },
      max_tokens: aiConfig.maxOutputTokens,
    });

    const response = completion.choices[0]?.message?.content || "";

    // Parse JSON from response
    let insights;
    try {
      // Extract JSON from response (handle if wrapped in markdown code blocks)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      insights = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(response || "{}");
    } catch {
      // Fallback if JSON parsing fails
      insights = {
        summary: response.substring(0, 200) || "Unable to generate insights",
        healthScore: 50,
        healthLabel: "Fair",
        insights: [],
        recommendations: [],
        rawResponse: response,
      };
    }

    // ── 5. Log + cache write ──
    const sdkTokens =
      (completion as { usage?: { total_tokens?: number } })?.usage?.total_tokens;
    const totalTokens =
      typeof sdkTokens === "number" && sdkTokens > 0
        ? sdkTokens
        : estimateTokens(systemPrompt) + estimateTokens(userContent) + estimateTokens(response);

    await logAIUsage(businessId, FEATURE, totalTokens, true);

    // Cache the raw LLM response string (not the parsed object) so cache
    // consumers can re-parse on read.
    await setCachedResponse(businessId, FEATURE, normalizedQuery, dataHash, response, totalTokens);

    return NextResponse.json({
      success: true,
      insights,
      generatedAt: now.toISOString(),
      dataPoints: {
        salesAnalyzed: monthSales._count,
        productsAnalyzed: topProducts.length,
        lowStockItems: lowStockProducts.length,
        expiringBatches: expiringBatches.length,
      },
      cache: { hit: false },
      tokensUsed: totalTokens,
      remaining: limitCheck.remaining,
    });
  } catch (error) {
    console.error("AI insights error:", error);

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
