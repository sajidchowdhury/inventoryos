// POST /api/businesses/[id]/ai/chat
// Natural language chat about pharmacy inventory — queries real data
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();
    const { message, history = [] } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // ── Gather relevant data based on the query ──
    const now = new Date();
    const monthStart = new Date(now); monthStart.setMonth(monthStart.getMonth() - 1);
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

    // Fetch comprehensive data for the AI to answer questions
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

    // Get top 5 products by stock for product queries
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

    // ── Call LLM ──
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

    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: "disabled" },
    });

    const aiResponse = completion.choices[0]?.message?.content;

    return NextResponse.json({
      success: true,
      response: aiResponse,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return NextResponse.json({ error: "Failed to get AI response" }, { status: 500 });
  }
}
