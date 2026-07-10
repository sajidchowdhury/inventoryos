// POST /api/businesses/[id]/ai/chat
// Natural language chat about pharmacy inventory — queries real data
//
// Gap integrations:
//   • Gap 8 — SQL Router     : routeQuery() short-circuits common questions (free, no LLM)
//   • Gap 9 — AI Cache       : getCachedResponse() returns prior LLM answer if data unchanged
//   • Gap 1/7 — Rate Limiter : checkAILimit() gates the LLM call per business quota
//   • Gap 4 — Error Fallback : buildFallback()/classifyError() shape every failure mode
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { routeQuery } from "@/lib/sql-router";
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
  getAIUsageStats,
} from "@/lib/ai-rate-limit";
import {
  buildFallback,
  classifyError,
  classifyRateLimitByType,
} from "@/lib/ai-fallback";
import { getAiConfig } from "@/lib/ai-config";

const MAX_MESSAGE_CHARS = 500;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const now = new Date();

  try {
    const body = await req.json();
    const { message, history = [] } = body;

    // ── 1. Validate message ──
    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json(
        { error: `Message too long (max ${MAX_MESSAGE_CHARS} characters)` },
        { status: 400 }
      );
    }

    // ── 2. SQL Router (Gap 8) — runs BEFORE rate limit; SQL queries are free ──
    const sqlRoute = await routeQuery(businessId, message);
    if (sqlRoute.handled && sqlRoute.response) {
      // Log a zero-token success so usage dashboards still see the activity,
      // but the business is NOT charged against daily/monthly/token quotas.
      await logAIUsage(businessId, `sql-router:${sqlRoute.pattern}`, 0, true);

      const usageStats = await getAIUsageStats(businessId).catch(() => null);

      return NextResponse.json({
        success: true,
        response: sqlRoute.response,
        timestamp: now.toISOString(),
        sqlRouter: {
          handled: true,
          pattern: sqlRoute.pattern,
          queryMs: sqlRoute.queryMs,
        },
        cache: { hit: false },
        usage: usageStats
          ? {
              callsToday: usageStats.callsToday,
              callsThisMonth: usageStats.callsThisMonth,
              tokensThisMonth: usageStats.tokensThisMonth,
              remaining: undefined,
            }
          : undefined,
      });
    }

    // ── 3. Fetch data (also needed to compute the cache dataHash) ──
    const monthStart = new Date(now); monthStart.setMonth(monthStart.getMonth() - 1);
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

    const [
      totalProducts, lowStockProducts, outOfStockProducts,
      todaySales, monthSales, monthPurchases,
      expiringBatches, expiredBatches, totalCustomers, totalSuppliers,
      outstandingReceivables, outstandingPayables,
    ] = await Promise.all([
      db.product.count({ where: { businessId, isActive: true } }),
      db.product.count({ where: { businessId, isActive: true, inventory: { quantity: { lte: 10 } } } }),
      db.product.count({ where: { businessId, isActive: true, inventory: { quantity: { lte: 0 } } } }),
      db.sale.aggregate({
        where: { businessId, status: "completed", createdAt: { gte: todayStart } },
        _sum: { totalAmount: true }, _count: true,
      }),
      db.sale.aggregate({
        where: { businessId, status: "completed", createdAt: { gte: monthStart } },
        _sum: { totalAmount: true }, _count: true,
      }),
      db.purchase.aggregate({
        where: { businessId, status: { not: "cancelled" }, createdAt: { gte: monthStart } },
        _sum: { totalAmount: true }, _count: true,
      }),
      db.batch.count({ where: { businessId, quantity: { gt: 0 }, status: "near_expiry" } }),
      db.batch.count({ where: { businessId, quantity: { gt: 0 }, status: "expired" } }),
      db.customer.count({ where: { businessId, isActive: true } }),
      db.supplier.count({ where: { businessId, isActive: true } }),
      db.sale.aggregate({
        where: { businessId, status: "completed", paymentStatus: { in: ["partial", "unpaid"] } },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      db.supplier.aggregate({
        where: { businessId, isActive: true, balance: { gt: 0 } },
        _sum: { balance: true },
      }),
    ]);

    // Get top products by stock for product queries
    const topStockProducts = await db.product.findMany({
      where: { businessId, isActive: true },
      include: { inventory: true, category: { select: { name: true } } },
      orderBy: { name: "asc" },
      take: 20,
    });

    // Get top selling products
    const topSelling = await db.saleItem.groupBy({
      by: ["productName"],
      where: { businessId, sale: { status: "completed", createdAt: { gte: monthStart } } },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    });

    const contextData = {
      business: { type: "Pharmacy", id: businessId },
      currentDateTime: now.toISOString(),
      inventory: {
        totalProducts,
        lowStockProducts,
        outOfStockProducts,
        products: topStockProducts.map((p) => ({
          name: p.name,
          genericName: p.genericName,
          stock: p.inventory?.quantity || 0,
          category: p.category?.name,
          mrp: p.mrp,
          manufacturer: p.manufacturer,
        })),
      },
      sales: {
        today: { total: todaySales._sum.totalAmount || 0, count: todaySales._count },
        thisMonth: { total: monthSales._sum.totalAmount || 0, count: monthSales._count },
        topSelling: topSelling.map((p) => ({
          name: p.productName,
          quantitySold: p._sum.quantity,
          revenue: p._sum.totalPrice,
        })),
      },
      purchases: {
        thisMonth: { total: monthPurchases._sum.totalAmount || 0, count: monthPurchases._count },
      },
      expiry: {
        nearExpiryBatches: expiringBatches,
        expiredBatches: expiredBatches,
      },
      contacts: { customers: totalCustomers, suppliers: totalSuppliers },
      financials: {
        receivables: (outstandingReceivables._sum.totalAmount || 0) - (outstandingReceivables._sum.paidAmount || 0),
        payables: outstandingPayables._sum.balance || 0,
      },
    };

    // ── 4. AI Response Cache (Gap 9) — check before rate limit; cache hits are free ──
    const normalizedQuery = normalizeQuery(message);
    const dataHash = computeDataHash(contextData);
    const cached = await getCachedResponse(businessId, "chat", normalizedQuery, dataHash);
    if (cached) {
      // Cache hit → no LLM call, no quota charge, log a zero-token success.
      await logAIUsage(businessId, "chat-cache", 0, true);

      return NextResponse.json({
        success: true,
        response: cached.response,
        timestamp: now.toISOString(),
        sqlRouter: { handled: false },
        cache: {
          hit: true,
          cachedAt: cached.cachedAt,
          originalTokensUsed: cached.tokensUsed,
        },
      });
    }

    // ── 5. Rate limit check (Gap 1/7) ──
    const limitCheck = await checkAILimit(businessId);
    if (!limitCheck.allowed) {
      const fallbackReason = classifyRateLimitByType(limitCheck.limitType, limitCheck.reason);
      const fallback = buildFallback(fallbackReason, {
        retryAfterSeconds: limitCheck.retryAfterSeconds,
        errorMessage: limitCheck.reason,
      });
      // Log the blocked attempt as a failed call so burst counters stay accurate.
      await logAIUsage(
        businessId,
        "chat",
        0,
        false,
        `rate_limited:${limitCheck.limitType}`
      );

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

    // ── 6. Call LLM ──
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const systemPrompt = `You are an AI assistant for a pharmacy inventory management system called InventoryOS. You help pharmacy owners and staff understand their inventory, sales, and business data.

You have access to REAL, CURRENT pharmacy data (provided below). Answer questions based on this data. Be helpful, concise, and specific with numbers.

When suggesting actions, relate them to the actual data (e.g., "You have 3 products low on stock: Napa, Amodis, Seclo").

Keep responses short and actionable. Use bullet points for lists. Include specific numbers from the data.

CURRENT PHARMACY DATA:
${JSON.stringify(contextData, null, 2)}`;

    // Build messages array with history
    const messages = [
      { role: "assistant", content: systemPrompt },
      ...history.slice(-8).map((h: { role: string; content: string }) => ({
        role: h.role === "ai" ? "assistant" : h.role,
        content: h.content,
      })),
      { role: "user", content: message },
    ];

    // ── 6. Call the LLM (with configurable max_tokens cap) ──
    const aiConfig = await getAiConfig("chat");

    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: "disabled" },
      max_tokens: aiConfig.maxOutputTokens,
    });

    const aiResponse = completion.choices[0]?.message?.content || "";

    // ── 7. Log + cache write ──
    // Prefer the SDK's reported token usage; fall back to a heuristic estimate.
    const sdkTokens =
      (completion as { usage?: { total_tokens?: number } })?.usage?.total_tokens;
    const totalTokens =
      typeof sdkTokens === "number" && sdkTokens > 0
        ? sdkTokens
        : estimateTokens(systemPrompt) + estimateTokens(message) + estimateTokens(aiResponse);

    await logAIUsage(businessId, "chat", totalTokens, true);
    await setCachedResponse(
      businessId,
      "chat",
      normalizedQuery,
      dataHash,
      aiResponse,
      totalTokens
    );

    return NextResponse.json({
      success: true,
      response: aiResponse,
      timestamp: now.toISOString(),
      sqlRouter: { handled: false },
      cache: { hit: false },
      tokensUsed: totalTokens,
      remaining: limitCheck.remaining,
    });
  } catch (error) {
    console.error("AI chat error:", error);

    // Log the failure so burst/quota counters reflect real attempts.
    await logAIUsage(
      businessId,
      "chat",
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
