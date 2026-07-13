// GET /api/businesses/[id]/cctv/reports/cash-book?date=2026-07-14
// Returns daily cash book: all money IN and OUT for a single day
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");

  // Default to today
  const targetDate = dateStr ? new Date(dateStr) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  type Entry = {
    time: string;
    description: string;
    amountIn: number;
    amountOut: number;
    type: string;
    reference: string;
  };

  const entries: Entry[] = [];

  // 1. Sales (cash only — credit sales don't count as cash in)
  const sales = await db.cCTVSale.findMany({
    where: {
      businessId,
      saleDate: { gte: startOfDay, lte: endOfDay },
      paymentType: "cash",
    },
    select: { id: true, invoiceNo: true, customerName: true, paidAmount: true, saleDate: true },
    orderBy: { saleDate: "asc" },
  });
  for (const sale of sales) {
    entries.push({
      time: new Date(sale.saleDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      description: `Sale${sale.customerName ? ` — ${sale.customerName}` : ""}${sale.invoiceNo ? ` (${sale.invoiceNo})` : ""}`,
      amountIn: sale.paidAmount,
      amountOut: 0,
      type: "sale",
      reference: sale.id,
    });
  }

  // 2. Customer payments received (credit payments)
  const customerPayments = await db.cCTVPayment.findMany({
    where: {
      businessId,
      type: "customer_payment",
      paymentDate: { gte: startOfDay, lte: endOfDay },
      paymentMethod: { in: ["cash"] },
    },
    select: { id: true, amount: true, paymentDate: true, customerId: true, notes: true },
    orderBy: { paymentDate: "asc" },
  });
  for (const pay of customerPayments) {
    entries.push({
      time: new Date(pay.paymentDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      description: `Customer Payment${pay.notes ? ` — ${pay.notes}` : ""}`,
      amountIn: pay.amount,
      amountOut: 0,
      type: "customer_payment",
      reference: pay.id,
    });
  }

  // 3. Purchases (cash paid for purchases)
  const purchasePayments = await db.cCTVPayment.findMany({
    where: {
      businessId,
      type: "purchase",
      paymentDate: { gte: startOfDay, lte: endOfDay },
      paymentMethod: { in: ["cash"] },
    },
    select: { id: true, amount: true, paymentDate: true, supplierId: true, notes: true },
    orderBy: { paymentDate: "asc" },
  });
  for (const pay of purchasePayments) {
    entries.push({
      time: new Date(pay.paymentDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      description: `Purchase Payment${pay.notes ? ` — ${pay.notes}` : ""}`,
      amountIn: 0,
      amountOut: pay.amount,
      type: "purchase_payment",
      reference: pay.id,
    });
  }

  // 4. Supplier payments
  const supplierPayments = await db.cCTVPayment.findMany({
    where: {
      businessId,
      type: "supplier_payment",
      paymentDate: { gte: startOfDay, lte: endOfDay },
      paymentMethod: { in: ["cash"] },
    },
    select: { id: true, amount: true, paymentDate: true, notes: true },
    orderBy: { paymentDate: "asc" },
  });
  for (const pay of supplierPayments) {
    entries.push({
      time: new Date(pay.paymentDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      description: `Supplier Payment${pay.notes ? ` — ${pay.notes}` : ""}`,
      amountIn: 0,
      amountOut: pay.amount,
      type: "supplier_payment",
      reference: pay.id,
    });
  }

  // 5. Expenses (all cash expenses)
  const expenses = await db.cCTVExpense.findMany({
    where: {
      businessId,
      expenseDate: { gte: startOfDay, lte: endOfDay },
    },
    select: { id: true, category: true, description: true, amount: true, expenseDate: true },
    orderBy: { expenseDate: "asc" },
  });
  for (const exp of expenses) {
    entries.push({
      time: new Date(exp.expenseDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      description: `Expense — ${exp.category}${exp.description ? `: ${exp.description}` : ""}`,
      amountIn: 0,
      amountOut: exp.amount,
      type: "expense",
      reference: exp.id,
    });
  }

  // Sort by time
  entries.sort((a, b) => a.time.localeCompare(b.time));

  // Calculate totals
  const totalIn = entries.reduce((sum, e) => sum + e.amountIn, 0);
  const totalOut = entries.reduce((sum, e) => sum + e.amountOut, 0);
  const netCash = totalIn - totalOut;

  return NextResponse.json({
    success: true,
    date: targetDate.toISOString().split("T")[0],
    entries,
    summary: {
      totalIn,
      totalOut,
      netCash,
      transactionCount: entries.length,
    },
  });
}
