// GET /api/businesses/[id]/cctv/reports/daily-summary?date=2026-07-14
// One-page business summary: purchases, sales, returns, repairs, expenses
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");

  const targetDate = dateStr ? new Date(dateStr) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // 1. Sales
  const sales = await db.cCTVSale.findMany({
    where: { businessId, saleDate: { gte: startOfDay, lte: endOfDay } },
    select: { id: true, totalAmount: true, paidAmount: true, dueAmount: true, customerName: true, paymentType: true, saleDate: true },
    orderBy: { saleDate: "desc" },
  });
  const salesTotal = sales.reduce((s, x) => s + Number(x.totalAmount), 0);
  const salesPaid = sales.reduce((s, x) => s + Number(x.paidAmount), 0);
  const salesDue = sales.reduce((s, x) => s + Number(x.dueAmount), 0);

  // 2. Purchases
  const purchases = await db.cCTVPurchase.findMany({
    where: { businessId, purchaseDate: { gte: startOfDay, lte: endOfDay } },
    select: { id: true, totalAmount: true, paidAmount: true, dueAmount: true, supplierName: true, invoiceNo: true, purchaseDate: true },
    orderBy: { purchaseDate: "desc" },
  });
  const purchaseTotal = purchases.reduce((s, x) => s + Number(x.totalAmount), 0);
  const purchasePaid = purchases.reduce((s, x) => s + Number(x.paidAmount), 0);

  // 3. Expenses
  const expenses = await db.cCTVExpense.findMany({
    where: { businessId, expenseDate: { gte: startOfDay, lte: endOfDay } },
    select: { id: true, category: true, description: true, amount: true, expenseDate: true },
    orderBy: { expenseDate: "desc" },
  });
  const expenseTotal = expenses.reduce((s, x) => s + Number(x.amount), 0);

  // 4. Repairs received
  const repairs = await db.cCTVRepair.findMany({
    where: { businessId, receivedDate: { gte: startOfDay, lte: endOfDay } },
    select: { id: true, tokenNo: true, serialNumber: true, productName: true, customerName: true, underWarranty: true, status: true, repairCost: true },
    orderBy: { receivedDate: "desc" },
  });
  const repairRevenue = repairs.reduce((s, x) => s + Number(x.repairCost), 0);

  // 5. Returns
  const returns = await db.cCTVReturn.findMany({
    where: { businessId, returnDate: { gte: startOfDay, lte: endOfDay } },
    select: { id: true, customerName: true, totalAmount: true, reason: true, returnDate: true },
    orderBy: { returnDate: "desc" },
  });
  const returnTotal = returns.reduce((s, x) => s + Number(x.totalAmount), 0);

  // 6. Customer payments received
  const customerPayments = await db.cCTVPayment.findMany({
    where: { businessId, type: "customer_payment", paymentDate: { gte: startOfDay, lte: endOfDay } },
    select: { id: true, amount: true, paymentMethod: true, paymentDate: true },
  });
  const customerPaymentTotal = customerPayments.reduce((s, x) => s + Number(x.amount), 0);

  // 7. Supplier payments made
  const supplierPayments = await db.cCTVPayment.findMany({
    where: { businessId, type: "supplier_payment", paymentDate: { gte: startOfDay, lte: endOfDay } },
    select: { id: true, amount: true, paymentMethod: true, paymentDate: true },
  });
  const supplierPaymentTotal = supplierPayments.reduce((s, x) => s + Number(x.amount), 0);

  // Calculate net cash flow
  const moneyIn = salesPaid + customerPaymentTotal;
  const moneyOut = purchasePaid + expenseTotal + supplierPaymentTotal + repairRevenue; // repair cost is money we spend (if we pay technician) — but actually repairCost is what customer pays us. Let me reconsider.
  // Actually repairCost is revenue from customer when they pick up. For now, not counting it in moneyIn since it's collected at return time.
  const netMoneyIn = salesPaid + customerPaymentTotal;
  const netMoneyOut = purchasePaid + expenseTotal + supplierPaymentTotal;
  const netCashFlow = netMoneyIn - netMoneyOut;

  return NextResponse.json({
    success: true,
    date: targetDate.toISOString().split("T")[0],
    summary: {
      sales: { count: sales.length, total: salesTotal, paid: salesPaid, due: salesDue },
      purchases: { count: purchases.length, total: purchaseTotal, paid: purchasePaid, due: purchaseTotal - purchasePaid },
      expenses: { count: expenses.length, total: expenseTotal },
      repairs: { count: repairs.length, revenue: repairRevenue, warrantyCount: repairs.filter(r => r.underWarranty).length },
      returns: { count: returns.length, total: returnTotal },
      customerPayments: { count: customerPayments.length, total: customerPaymentTotal },
      supplierPayments: { count: supplierPayments.length, total: supplierPaymentTotal },
      netCashFlow,
      moneyIn: netMoneyIn,
      moneyOut: netMoneyOut,
    },
    details: {
      sales,
      purchases,
      expenses,
      repairs,
      returns,
      customerPayments,
      supplierPayments,
    },
  });
}
