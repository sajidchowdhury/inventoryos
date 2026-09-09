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
      amountIn: Number(sale.paidAmount),
      amountOut: 0,
      type: "sale",
      reference: sale.id,
    });
  }

  // 2. Customer payments received (all methods: cash, bank, bkash, nagad)
  const customerPayments = await db.cCTVPayment.findMany({
    where: {
      businessId,
      type: "customer_payment",
      paymentDate: { gte: startOfDay, lte: endOfDay },
    },
    select: { id: true, amount: true, paymentDate: true, customerId: true, paymentMethod: true, notes: true },
    orderBy: { paymentDate: "asc" },
  });
  for (const pay of customerPayments) {
    entries.push({
      time: new Date(pay.paymentDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      description: `Customer Payment (${pay.paymentMethod})${pay.notes ? ` — ${pay.notes}` : ""}`,
      amountIn: Number(pay.amount),
      amountOut: 0,
      type: "customer_payment",
      reference: pay.id,
    });
  }

  // 3. Purchases (paid for purchases — all methods)
  const purchasePayments = await db.cCTVPayment.findMany({
    where: {
      businessId,
      type: "purchase",
      paymentDate: { gte: startOfDay, lte: endOfDay },
    },
    select: { id: true, amount: true, paymentDate: true, supplierId: true, paymentMethod: true, notes: true },
    orderBy: { paymentDate: "asc" },
  });
  for (const pay of purchasePayments) {
    entries.push({
      time: new Date(pay.paymentDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      description: `Purchase Payment (${pay.paymentMethod})${pay.notes ? ` — ${pay.notes}` : ""}`,
      amountIn: 0,
      amountOut: Number(pay.amount),
      type: "purchase_payment",
      reference: pay.id,
    });
  }

  // 4. Supplier payments (all methods)
  const supplierPayments = await db.cCTVPayment.findMany({
    where: {
      businessId,
      type: "supplier_payment",
      paymentDate: { gte: startOfDay, lte: endOfDay },
    },
    select: { id: true, amount: true, paymentDate: true, paymentMethod: true, notes: true },
    orderBy: { paymentDate: "asc" },
  });
  for (const pay of supplierPayments) {
    entries.push({
      time: new Date(pay.paymentDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      description: `Supplier Payment (${pay.paymentMethod})${pay.notes ? ` — ${pay.notes}` : ""}`,
      amountIn: 0,
      amountOut: Number(pay.amount),
      type: "supplier_payment",
      reference: pay.id,
    });
  }

  // 5. Expenses — CB-5: filter by paymentMethod so a bKash expense doesn't
  // appear as cash-out. The Cash Book shows cash flow PER METHOD; without
  // this filter, a bKash expense would inflate the cash total.
  // Default to "cash" if no paymentMethod on the expense row (backward
  // compat with pre-EX-2 rows that had no paymentMethod column).
  const expenses = await db.cCTVExpense.findMany({
    where: {
      businessId,
      expenseDate: { gte: startOfDay, lte: endOfDay },
      // CB-5: only include cash expenses in the cash book. The Cash Book
      // is per-method — bKash/bank expenses belong in their own books.
      // (If the user wants all expenses regardless of method, they can
      // use the Expense Summary report.)
      OR: [
        { paymentMethod: "cash" },
        { paymentMethod: null },  // pre-EX-2 rows default to cash
      ],
    },
    select: { id: true, category: true, description: true, amount: true, expenseDate: true, paymentMethod: true },
    orderBy: { expenseDate: "asc" },
  });
  for (const exp of expenses) {
    entries.push({
      time: new Date(exp.expenseDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      description: `Expense — ${exp.category}${exp.description ? `: ${exp.description}` : ""}`,
      amountIn: 0,
      amountOut: Number(exp.amount),
      type: "expense",
      reference: exp.id,
    });
  }

  // Sort by time
  entries.sort((a, b) => a.time.localeCompare(b.time));

  // Calculate totals
  const totalIn = entries.reduce((sum, e) => sum + Number(e.amountIn), 0);
  const totalOut = entries.reduce((sum, e) => sum + Number(e.amountOut), 0);
  const netCash = totalIn - totalOut;

  // ── CB-7: per-method breakdown ──
  // A shop wanting "cash in by method" (cash vs bKash vs bank) can now
  // see it directly instead of summing manually. We bucket the day's
  // customer + supplier + repair payments by paymentMethod.
  const methodBreakdown: Record<string, { in: number; out: number }> = {};
  const addMethod = (method: string, isOut: boolean, amount: number) => {
    if (!method) method = "cash";  // pre-EX-2 fallback
    if (!methodBreakdown[method]) methodBreakdown[method] = { in: 0, out: 0 };
    if (isOut) methodBreakdown[method].out += amount;
    else methodBreakdown[method].in += amount;
  };
  // Customer payments (in)
  for (const pay of customerPayments) addMethod(pay.paymentMethod || "cash", false, Number(pay.amount));
  // Purchase + supplier payments (out)
  for (const pay of purchasePayments) addMethod(pay.paymentMethod || "cash", true, Number(pay.amount));
  for (const pay of supplierPayments) addMethod(pay.paymentMethod || "cash", true, Number(pay.amount));
  // Expenses (out — cash only per CB-5)
  for (const exp of expenses) addMethod(exp.paymentMethod || "cash", true, Number(exp.amount));

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
    // CB-7: per-method breakdown so the UI can show a small table.
    methodBreakdown,
  });
}
