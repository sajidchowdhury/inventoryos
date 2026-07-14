// GET /api/businesses/[id]/cctv/dashboard
// Returns real stats for the CCTV dashboard
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;

  // Today's date range
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // Total products
  const totalProducts = await db.cCTVProduct.count({
    where: { businessId, isActive: true },
  });

  // Today's sales
  const todaySales = await db.cCTVSale.findMany({
    where: { businessId, saleDate: { gte: startOfDay, lte: endOfDay } },
    select: { totalAmount: true, paidAmount: true },
  });
  const todaySalesTotal = todaySales.reduce((s, sale) => s + Number(sale.totalAmount), 0);
  const todaySaleCount = todaySales.length;

  // Low stock products
  const products = await db.cCTVProduct.findMany({
    where: { businessId, isActive: true, minStock: { gt: 0 } },
    select: { id: true, stock: true, minStock: true, serialTracked: true },
  });
  let lowStockCount = 0;
  for (const p of products) {
    let effectiveStock = p.stock;
    if (p.serialTracked) {
      effectiveStock = await db.cCTVSerialItem.count({
        where: { businessId, productId: p.id, status: "IN_STOCK" },
      });
    }
    if (effectiveStock <= p.minStock) lowStockCount++;
  }

  // Total stock value (cost)
  const allProducts = await db.cCTVProduct.findMany({
    where: { businessId, isActive: true },
    select: { id: true, stock: true, costPrice: true, serialTracked: true },
  });
  let totalStockValue = 0;
  for (const p of allProducts) {
    let effectiveStock = p.stock;
    if (p.serialTracked) {
      effectiveStock = await db.cCTVSerialItem.count({
        where: { businessId, productId: p.id, status: "IN_STOCK" },
      });
    }
    totalStockValue += effectiveStock * Number(p.costPrice);
  }

  // Total customers
  const totalCustomers = await db.cCTVCustomer.count({ where: { businessId } });

  // Total suppliers
  const totalSuppliers = await db.cCTVSupplier.count({ where: { businessId } });

  // Today's expenses
  const todayExpenses = await db.cCTVExpense.findMany({
    where: { businessId, expenseDate: { gte: startOfDay, lte: endOfDay } },
    select: { amount: true },
  });
  const todayExpensesTotal = todayExpenses.reduce((s, e) => s + Number(e.amount), 0);

  // Recent sales (last 5)
  const recentSales = await db.cCTVSale.findMany({
    where: { businessId },
    select: { id: true, customerName: true, totalAmount: true, saleDate: true, paymentType: true },
    orderBy: { saleDate: "desc" },
    take: 5,
  });

  // Recent purchases (last 5)
  const recentPurchases = await db.cCTVPurchase.findMany({
    where: { businessId },
    select: { id: true, supplierName: true, totalAmount: true, purchaseDate: true },
    orderBy: { purchaseDate: "desc" },
    take: 5,
  });

  return NextResponse.json({
    success: true,
    stats: {
      totalProducts,
      todaySalesTotal,
      todaySaleCount,
      lowStockCount,
      totalStockValue,
      totalCustomers,
      totalSuppliers,
      todayExpensesTotal,
    },
    recentSales,
    recentPurchases,
  });
}
