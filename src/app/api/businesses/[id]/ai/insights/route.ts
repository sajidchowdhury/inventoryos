// POST /api/businesses/[id]/ai/insights
// Gathers business data, sends to LLM, returns AI-generated insights & recommendations
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;

    // ── Gather business data for AI analysis ──
    const now = new Date();
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

    // ── Call LLM for insights ──
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const systemPrompt = `You are an AI pharmacy business analyst. Analyze the provided pharmacy data and generate actionable insights in JSON format.

Return a JSON object with this exact structure:
{
  "summary": "2-3 sentence executive summary of business health",
  "healthScore": number 1-100,
  "healthLabel": "Excellent" | "Good" | "Fair" | "Needs Attention" | "Critical",
  "insights": [
    {
      "type": "success" | "warning" | "danger" | "info" | "tip",
      "category": "Sales" | "Inventory" | "Expiry" | "Customers" | "Purchases" | "Financial",
      "title": "Short title",
      "description": "Detailed explanation with specific numbers",
      "action": "Recommended action to take"
    }
  ],
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "title": "Short title",
      "description": "What to do and why",
      "expectedImpact": "What benefit this will bring"
    }
  ]
}

Generate 5-8 insights and 3-5 recommendations. Be specific with numbers from the data. Focus on actionable pharmacy-specific advice.`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: systemPrompt },
        { role: "user", content: `Analyze this pharmacy data:\n\n${JSON.stringify(dataSummary, null, 2)}` },
      ],
      thinking: { type: "disabled" },
    });

    const response = completion.choices[0]?.message?.content;

    // Parse JSON from response
    let insights;
    try {
      // Extract JSON from response (handle if wrapped in markdown code blocks)
      const jsonMatch = response?.match(/\{[\s\S]*\}/);
      insights = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(response || "{}");
    } catch {
      // Fallback if JSON parsing fails
      insights = {
        summary: response?.substring(0, 200) || "Unable to generate insights",
        healthScore: 50,
        healthLabel: "Fair",
        insights: [],
        recommendations: [],
        rawResponse: response,
      };
    }

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
    });
  } catch (error) {
    console.error("AI insights error:", error);
    return NextResponse.json({ error: "Failed to generate AI insights" }, { status: 500 });
  }
}
