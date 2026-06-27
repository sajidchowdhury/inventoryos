// GET /api/businesses/[id]/reports/business
// Comprehensive business report: combines sales, purchases, inventory, financials
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const period = url.searchParams.get("period") || "month";

    const now = new Date();
    let startDate = new Date();
    switch (period) {
      case "today": startDate.setHours(0, 0, 0, 0); break;
      case "week": startDate.setDate(startDate.getDate() - 7); break;
      case "month": startDate.setMonth(startDate.getMonth() - 1); break;
      case "quarter": startDate.setMonth(startDate.getMonth() - 3); break;
      case "year": startDate.setFullYear(startDate.getFullYear() - 1); break;
      default: startDate.setMonth(startDate.getMonth() - 1);
    }

    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, address: true, phone: true, businessType: { select: { name: true } } },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Run all aggregations in parallel
    const [
      salesAgg, purchaseAgg, paymentAgg, returnAgg,
      saleItems, batches, customers, suppliers,
      outstandingReceivables, outstandingPayables,
    ] = await Promise.all([
      db.sale.aggregate({
        where: { businessId, status: "completed", createdAt: { gte: startDate } },
        _sum: { totalAmount: true, subtotal: true, discountAmount: true, taxAmount: true, totalQuantity: true },
        _count: true,
      }),
      db.purchase.aggregate({
        where: { businessId, status: { not: "cancelled" }, createdAt: { gte: startDate } },
        _sum: { totalAmount: true, paidAmount: true },
        _count: true,
      }),
      db.payment.aggregate({
        where: { businessId, createdAt: { gte: startDate } },
        _sum: { amount: true },
        _count: true,
      }),
      db.return.aggregate({
        where: { businessId, createdAt: { gte: startDate } },
        _sum: { refundAmount: true },
        _count: true,
      }),
      db.saleItem.findMany({
        where: { businessId, sale: { status: "completed", createdAt: { gte: startDate } } },
        select: { id: true, productId: true, productName: true, quantity: true, totalPrice: true, batchId: true },
      }),
      db.batch.findMany({
        where: { businessId, quantity: { gt: 0 }, status: { not: "destroyed" } },
        select: { quantity: true, purchasePrice: true, mrp: true, status: true },
      }),
      db.customer.count({ where: { businessId, isActive: true } }),
      db.supplier.count({ where: { businessId, isActive: true } }),
      db.sale.aggregate({
        where: { businessId, status: "completed", paymentStatus: { in: ["partial", "unpaid"] } },
        _sum: { totalAmount: true, paidAmount: true },
        _count: true,
      }),
      db.supplier.aggregate({
        where: { businessId, isActive: true, balance: { gt: 0 } },
        _sum: { balance: true },
        _count: true,
      }),
    ]);

    // Fetch batch purchase prices for COGS calculation
    const batchIds = [...new Set(saleItems.map((i) => i.batchId).filter(Boolean))] as string[];
    const batchesForCOGS = await db.batch.findMany({
      where: { id: { in: batchIds } },
      select: { id: true, purchasePrice: true },
    });
    const batchPriceMap = new Map(batchesForCOGS.map((b) => [b.id, b.purchasePrice || 0]));

    // Calculate COGS
    const totalCOGS = saleItems.reduce((sum, item) => {
      const cost = item.batchId ? batchPriceMap.get(item.batchId) || 0 : 0;
      return sum + item.quantity * cost;
    }, 0);

    // Inventory valuation
    const inventoryCost = batches.reduce((sum, b) => sum + (b.purchasePrice || 0) * b.quantity, 0);
    const inventoryMRP = batches.reduce((sum, b) => sum + (b.mrp || 0) * b.quantity, 0);
    const expiredCount = batches.filter((b) => b.status === "expired").length;
    const nearExpiryCount = batches.filter((b) => b.status === "near_expiry").length;

    // Top products
    const topProductsMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const item of saleItems) {
      const existing = topProductsMap.get(item.productId) || { name: item.productName, quantity: 0, revenue: 0 };
      existing.quantity += item.quantity;
      existing.revenue += item.totalPrice;
      topProductsMap.set(item.productId, existing);
    }
    const topProducts = Array.from(topProductsMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Daily breakdown
    const days = period === "today" ? 1 : period === "week" ? 7 : period === "month" ? 30 : period === "quarter" ? 90 : 365;
    const dailyData = [];
    for (let i = days - 1; i >= 0; i -= Math.max(1, Math.floor(days / 30))) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + Math.max(1, Math.floor(days / 30)) - 1);
      dayEnd.setHours(23, 59, 59, 999);

      const [s, p] = await Promise.all([
        db.sale.aggregate({
          where: { businessId, status: "completed", createdAt: { gte: dayStart, lte: dayEnd } },
          _sum: { totalAmount: true },
          _count: true,
        }),
        db.purchase.aggregate({
          where: { businessId, status: { not: "cancelled" }, createdAt: { gte: dayStart, lte: dayEnd } },
          _sum: { totalAmount: true },
          _count: true,
        }),
      ]);

      dailyData.push({
        date: dayStart.toISOString().split("T")[0],
        sales: s._sum.totalAmount || 0,
        salesCount: s._count,
        purchases: p._sum.totalAmount || 0,
        purchasesCount: p._count,
      });
    }

    const netRevenue = (salesAgg._sum.totalAmount || 0) - (returnAgg._sum.refundAmount || 0);
    const grossProfit = netRevenue - totalCOGS;

    const report = {
      generatedAt: now.toISOString(),
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      business: {
        name: business.name,
        address: business.address,
        phone: business.phone,
        type: business.businessType.name,
      },
      executiveSummary: {
        // Sales
        totalSales: salesAgg._sum.totalAmount || 0,
        salesCount: salesAgg._count,
        totalQuantitySold: salesAgg._sum.totalQuantity || 0,
        avgSaleValue: salesAgg._count > 0 ? (salesAgg._sum.totalAmount || 0) / salesAgg._count : 0,
        // Returns
        totalReturns: returnAgg._sum.refundAmount || 0,
        returnsCount: returnAgg._count,
        // Net revenue
        netRevenue,
        // COGS
        totalCOGS,
        cogsPercent: netRevenue > 0 ? (totalCOGS / netRevenue) * 100 : 0,
        // Profit
        grossProfit,
        grossMargin: netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0,
        // Purchases
        totalPurchases: purchaseAgg._sum.totalAmount || 0,
        purchaseCount: purchaseAgg._count,
        // Cash flow
        cashReceived: paymentAgg._sum.amount || 0,
        cashPaidToSuppliers: purchaseAgg._sum.paidAmount || 0,
        netCashFlow: (paymentAgg._sum.amount || 0) - (purchaseAgg._sum.paidAmount || 0),
        // Discounts & Tax
        totalDiscounts: salesAgg._sum.discountAmount || 0,
        totalTax: salesAgg._sum.taxAmount || 0,
      },
      inventory: {
        costValue: inventoryCost,
        mrpValue: inventoryMRP,
        potentialProfit: inventoryMRP - inventoryCost,
        expiredBatches: expiredCount,
        nearExpiryBatches: nearExpiryCount,
        totalBatches: batches.length,
      },
      contacts: {
        totalCustomers: customers,
        totalSuppliers: suppliers,
      },
      financials: {
        receivables: {
          amount: (outstandingReceivables._sum.totalAmount || 0) - (outstandingReceivables._sum.paidAmount || 0),
          count: outstandingReceivables._count,
        },
        payables: {
          amount: outstandingPayables._sum.balance || 0,
          count: outstandingPayables._count,
        },
      },
      topProducts,
      dailyData,
    };

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error("Business report error:", error);
    return NextResponse.json({ error: "Failed to generate business report" }, { status: 500 });
  }
}
