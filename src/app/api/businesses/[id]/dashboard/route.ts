// GET /api/businesses/[id]/dashboard
// Unified KPIs across all modules: sales, purchases, inventory, expiry, customers, suppliers
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const now = new Date();

    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now); monthStart.setMonth(monthStart.getMonth() - 1);

    // ── SALES KPIs ──
    const [todaySales, weekSales, monthSales] = await Promise.all([
      db.sale.aggregate({
        where: { businessId, status: "completed", createdAt: { gte: todayStart, lte: todayEnd } },
        _sum: { totalAmount: true, totalQuantity: true },
        _count: true,
      }),
      db.sale.aggregate({
        where: { businessId, status: "completed", createdAt: { gte: weekStart } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      db.sale.aggregate({
        where: { businessId, status: "completed", createdAt: { gte: monthStart } },
        _sum: { totalAmount: true, totalQuantity: true },
        _count: true,
      }),
    ]);

    // ── PURCHASES KPIs ──
    const [todayPurchases, monthPurchases] = await Promise.all([
      db.purchase.aggregate({
        where: { businessId, status: { not: "cancelled" }, createdAt: { gte: todayStart, lte: todayEnd } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      db.purchase.aggregate({
        where: { businessId, status: { not: "cancelled" }, createdAt: { gte: monthStart } },
        _sum: { totalAmount: true },
        _count: true,
      }),
    ]);

    // ── PAYMENTS KPIs ──
    const [todayPayments, monthPayments] = await Promise.all([
      db.payment.aggregate({
        where: { businessId, createdAt: { gte: todayStart, lte: todayEnd } },
        _sum: { amount: true },
        _count: true,
      }),
      db.payment.aggregate({
        where: { businessId, createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
    ]);

    // ── RETURNS KPIs ──
    const monthReturns = await db.return.aggregate({
      where: { businessId, createdAt: { gte: monthStart } },
      _sum: { refundAmount: true },
      _count: true,
    });

    // ── INVENTORY KPIs ──
    const totalProducts = await db.product.count({ where: { businessId, isActive: true } });
    const lowStockProducts = await db.product.count({
      where: {
        businessId, isActive: true,
        inventory: { quantity: { lte: 10 } },
      },
    });
    const outOfStockProducts = await db.product.count({
      where: {
        businessId, isActive: true,
        inventory: { quantity: { lte: 0 } },
      },
    });

    // Overstock count: products where current inventory exceeds maxStock threshold.
    // Only counts products where maxStock > 0 (i.e., the founder has set a threshold).
    // Phase 3 P2 fix: surfaces the previously-unused Product.maxStock column.
    const overstockProducts = await db.product.count({
      where: {
        businessId, isActive: true,
        maxStock: { gt: 0 },
        inventory: { quantity: { gt: 0 } },
      },
    });
    // Note: a precise overstock check (inventory.quantity > product.maxStock) requires
    // a raw query or fetch-and-filter because Prisma can't compare two columns directly.
    // For the dashboard count, we fetch the candidate products and filter in JS.
    let overstockCount = 0;
    if (overstockProducts > 0) {
      const candidates = await db.product.findMany({
        where: {
          businessId, isActive: true,
          maxStock: { gt: 0 },
        },
        select: { maxStock: true, inventory: { select: { quantity: true } } },
      });
      overstockCount = candidates.filter(
        (p) => (p.inventory?.quantity ?? 0) > (p.maxStock || 0)
      ).length;
    }

    // Inventory valuation (cost basis)
    const batches = await db.batch.findMany({
      where: { businessId, quantity: { gt: 0 }, status: { not: "destroyed" } },
      select: { quantity: true, purchasePrice: true, mrp: true },
    });
    const inventoryCostValue = batches.reduce((sum, b) => sum + (b.purchasePrice || 0) * b.quantity, 0);
    const inventoryMRPValue = batches.reduce((sum, b) => sum + (b.mrp || 0) * b.quantity, 0);
    const totalBatchCount = batches.length;

    // ── EXPIRY KPIs ──
    const expiredBatches = await db.batch.count({
      where: { businessId, quantity: { gt: 0 }, status: "expired" },
    });
    const nearExpiryBatches = await db.batch.count({
      where: { businessId, quantity: { gt: 0 }, status: "near_expiry" },
    });
    const quarantinedBatches = await db.batch.count({
      where: { businessId, quantity: { gt: 0 }, status: "quarantined" },
    });

    // Expiry value at risk (next 90 days)
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const expiringBatches = await db.batch.findMany({
      where: {
        businessId, quantity: { gt: 0 },
        status: { in: ["active", "near_expiry", "expired"] },
        expiryDate: { lte: ninetyDaysFromNow },
      },
      select: { quantity: true, mrp: true, purchasePrice: true },
    });
    const expiryValueAtRisk = expiringBatches.reduce(
      (sum, b) => sum + (b.mrp || b.purchasePrice || 0) * b.quantity, 0
    );

    // ── CUSTOMER & SUPPLIER KPIs ──
    const totalCustomers = await db.customer.count({ where: { businessId, isActive: true } });
    const totalSuppliers = await db.supplier.count({ where: { businessId, isActive: true } });

    // Outstanding receivables (customers owe us)
    const outstandingReceivables = await db.sale.aggregate({
      where: { businessId, status: "completed", paymentStatus: { in: ["partial", "unpaid"] } },
      _sum: { totalAmount: true, paidAmount: true },
      _count: true,
    });

    // Outstanding payables (we owe suppliers)
    const outstandingPayables = await db.supplier.aggregate({
      where: { businessId, isActive: true, balance: { gt: 0 } },
      _sum: { balance: true },
      _count: true,
    });

    // ── LAST 7 DAYS TREND (sales vs purchases) ──
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const [salesAgg, purchasesAgg] = await Promise.all([
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

      last7Days.push({
        date: dayStart.toISOString().split("T")[0],
        dayName: dayStart.toLocaleDateString("en-GB", { weekday: "short" }),
        sales: salesAgg._sum.totalAmount || 0,
        salesCount: salesAgg._count,
        purchases: purchasesAgg._sum.totalAmount || 0,
        purchasesCount: purchasesAgg._count,
      });
    }

    // ── PROFIT ESTIMATE (month) ──
    // Revenue = monthSales.totalAmount - monthReturns.refundAmount
    // COGS = sum of (saleItem.quantity × batch.purchasePrice) for this month's sales
    const monthSaleItems = await db.saleItem.findMany({
      where: {
        businessId,
        sale: { status: "completed", createdAt: { gte: monthStart } },
      },
      select: { productId: true, quantity: true, batchId: true, totalPrice: true, productName: true },
    });

    // Fetch batch purchase prices separately (SaleItem has no batch relation)
    const batchIds = [...new Set(monthSaleItems.map((i) => i.batchId).filter(Boolean))] as string[];
    const batchesForCOGS = await db.batch.findMany({
      where: { id: { in: batchIds } },
      select: { id: true, purchasePrice: true },
    });
    const batchPriceMap = new Map(batchesForCOGS.map((b) => [b.id, b.purchasePrice || 0]));

    const monthCOGS = monthSaleItems.reduce((sum, item) => {
      const cost = item.batchId ? batchPriceMap.get(item.batchId) || 0 : 0;
      return sum + item.quantity * cost;
    }, 0);

    const monthRevenue = (monthSales._sum.totalAmount || 0) - (monthReturns._sum.refundAmount || 0);
    const monthGrossProfit = monthRevenue - monthCOGS;
    const monthProfitMargin = monthRevenue > 0 ? (monthGrossProfit / monthRevenue) * 100 : 0;

    return NextResponse.json({
      success: true,
      generatedAt: now.toISOString(),
      sales: {
        today: { total: todaySales._sum.totalAmount || 0, count: todaySales._count, quantity: todaySales._sum.totalQuantity || 0 },
        week: { total: weekSales._sum.totalAmount || 0, count: weekSales._count },
        month: { total: monthSales._sum.totalAmount || 0, count: monthSales._count, quantity: monthSales._sum.totalQuantity || 0 },
      },
      purchases: {
        today: { total: todayPurchases._sum.totalAmount || 0, count: todayPurchases._count },
        month: { total: monthPurchases._sum.totalAmount || 0, count: monthPurchases._count },
      },
      payments: {
        today: { total: todayPayments._sum.amount || 0, count: todayPayments._count },
        month: { total: monthPayments._sum.amount || 0 },
      },
      returns: {
        month: { refund: monthReturns._sum.refundAmount || 0, count: monthReturns._count },
      },
      inventory: {
        totalProducts,
        lowStockProducts,
        outOfStockProducts,
        overstockProducts: overstockCount,
        totalBatches: totalBatchCount,
        costValue: inventoryCostValue,
        mrpValue: inventoryMRPValue,
        potentialProfit: inventoryMRPValue - inventoryCostValue,
      },
      expiry: {
        expiredBatches,
        nearExpiryBatches,
        quarantinedBatches,
        valueAtRisk: expiryValueAtRisk,
      },
      contacts: {
        totalCustomers,
        totalSuppliers,
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
        cashFlow: {
          inflow: todayPayments._sum.amount || 0,
          outflow: todayPurchases._sum.totalAmount || 0,
        },
      },
      profit: {
        monthRevenue,
        monthCOGS,
        monthGrossProfit,
        monthProfitMargin: Math.round(monthProfitMargin * 100) / 100,
      },
      last7Days,
    });
  } catch (error) {
    console.error("Business dashboard error:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
