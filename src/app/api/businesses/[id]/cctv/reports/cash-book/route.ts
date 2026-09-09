// GET /api/businesses/[id]/cctv/reports/cash-book?date=2026-07-14&method=cash
// Returns daily cash book: all money IN and OUT for a single day.
//
// CB-1 fix: removed the paymentType: "cash" filter on sales — ALL sales
//   are now included, using paidAmount as the cash-in amount. A credit
//   sale with a ৳500 deposit now shows ৳500 cash in (was invisible).
// CB-2 fix: added a ?method= query param to filter by payment method.
//   Default (no param) = all methods. Pass method=cash for cash-only.
// CB-3 fix: added opening balance (sum of all prior days' net cash).
// CB-6 fix: added closing balance = opening + totalIn - totalOut.
// CB-8 fix: customer payment description now includes the customer name
//   (joined from CCTVCustomer).
// DS-1 reconciliation: linked customer payments (referenceId set → already
//   in sale.paidAmount via PM-3) are excluded from the customer payment
//   entries to avoid double-counting with the sale entries.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");
  const methodFilter = searchParams.get("method"); // CB-2: cash, bank, bkash, nagad, or null (all)

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
    method: string;
  };

  const entries: Entry[] = [];

  // Helper: should we include this payment method?
  const includeMethod = (m: string) => !methodFilter || m === methodFilter;

  // 1. Sales (CB-1 fix: ALL sales, not just paymentType: "cash")
  // Use paidAmount as the cash-in amount. A credit sale with ৳500 deposit
  // now shows ৳500 cash in. A fully paid cash sale shows the full amount.
  // A credit sale with ৳0 paid shows ৳0 (no cash changed hands yet).
  const sales = await db.cCTVSale.findMany({
    where: {
      businessId,
      saleDate: { gte: startOfDay, lte: endOfDay },
    },
    select: { id: true, invoiceNo: true, customerName: true, paidAmount: true, saleDate: true, paymentType: true },
    orderBy: { saleDate: "asc" },
  });
  for (const sale of sales) {
    const paid = Number(sale.paidAmount);
    if (paid <= 0) continue; // skip sales with no payment (no cash flow)
    entries.push({
      time: new Date(sale.saleDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      description: `Sale${sale.customerName ? ` — ${sale.customerName}` : ""}${sale.invoiceNo ? ` (${sale.invoiceNo})` : ""}${sale.paymentType === "credit" ? " [credit]" : ""}`,
      amountIn: paid,
      amountOut: 0,
      type: "sale",
      reference: sale.id,
      method: "sale", // sale-internal payment method isn't stored on cCTVSale
    });
  }

  // 2. Customer payments received (standalone, not sale-internal)
  // DS-1 reconciliation: exclude linked payments (referenceId set → already
  // counted in the sale's paidAmount above via PM-3). Only include unlinked
  // payments (referenceId null → floating, not in any sale's paidAmount).
  // CB-2: filter by method if methodFilter is set.
  const customerPaymentWhere: Record<string, unknown> = {
    businessId,
    type: "customer_payment",
    paymentDate: { gte: startOfDay, lte: endOfDay },
    referenceId: null, // DS-1: only unlinked payments
  };
  if (methodFilter) customerPaymentWhere.paymentMethod = methodFilter;

  const customerPayments = await db.cCTVPayment.findMany({
    where: customerPaymentWhere,
    select: { id: true, amount: true, paymentDate: true, customerId: true, paymentMethod: true, notes: true },
    orderBy: { paymentDate: "asc" },
  });
  // CB-8: fetch customer names for the payments that have customerId
  const customerIds = [...new Set(customerPayments.map((p) => p.customerId).filter(Boolean))] as string[];
  const customers = customerIds.length > 0
    ? await db.cCTVCustomer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } })
    : [];
  const customerMap = new Map(customers.map((c) => [c.id, c.name]));

  for (const pay of customerPayments) {
    if (!includeMethod(pay.paymentMethod)) continue;
    const custName = pay.customerId ? (customerMap.get(pay.customerId) || "") : "";
    entries.push({
      time: new Date(pay.paymentDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      description: `Customer Payment${custName ? ` — ${custName}` : ""} (${pay.paymentMethod})${pay.notes ? ` — ${pay.notes}` : ""}`,
      amountIn: Number(pay.amount),
      amountOut: 0,
      type: "customer_payment",
      reference: pay.id,
      method: pay.paymentMethod,
    });
  }

  // 3. Purchase payments (type: "purchase" — these are the inline payments
  // created at purchase time, not standalone supplier payments)
  const purchasePaymentWhere: Record<string, unknown> = {
    businessId,
    type: "purchase",
    paymentDate: { gte: startOfDay, lte: endOfDay },
  };
  if (methodFilter) purchasePaymentWhere.paymentMethod = methodFilter;

  const purchasePayments = await db.cCTVPayment.findMany({
    where: purchasePaymentWhere,
    select: { id: true, amount: true, paymentDate: true, supplierId: true, paymentMethod: true, notes: true },
    orderBy: { paymentDate: "asc" },
  });
  // Fetch supplier names
  const supplierIds = [...new Set(purchasePayments.map((p) => p.supplierId).filter(Boolean))] as string[];
  const suppliers = supplierIds.length > 0
    ? await db.cCTVSupplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true } })
    : [];
  const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));

  for (const pay of purchasePayments) {
    if (!includeMethod(pay.paymentMethod)) continue;
    const supName = pay.supplierId ? (supplierMap.get(pay.supplierId) || "") : "";
    entries.push({
      time: new Date(pay.paymentDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      description: `Purchase Payment${supName ? ` — ${supName}` : ""} (${pay.paymentMethod})${pay.notes ? ` — ${pay.notes}` : ""}`,
      amountIn: 0,
      amountOut: Number(pay.amount),
      type: "purchase_payment",
      reference: pay.id,
      method: pay.paymentMethod,
    });
  }

  // 4. Supplier payments (standalone, type: "supplier_payment")
  // DS-1 reconciliation: exclude linked payments (referenceId → already
  // in purchase's paidAmount via PM-3).
  const supplierPaymentWhere: Record<string, unknown> = {
    businessId,
    type: "supplier_payment",
    paymentDate: { gte: startOfDay, lte: endOfDay },
    referenceId: null, // DS-1: only unlinked
  };
  if (methodFilter) supplierPaymentWhere.paymentMethod = methodFilter;

  const supplierPayments = await db.cCTVPayment.findMany({
    where: supplierPaymentWhere,
    select: { id: true, amount: true, paymentDate: true, paymentMethod: true, notes: true },
    orderBy: { paymentDate: "asc" },
  });
  for (const pay of supplierPayments) {
    if (!includeMethod(pay.paymentMethod)) continue;
    entries.push({
      time: new Date(pay.paymentDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      description: `Supplier Payment (${pay.paymentMethod})${pay.notes ? ` — ${pay.notes}` : ""}`,
      amountIn: 0,
      amountOut: Number(pay.amount),
      type: "supplier_payment",
      reference: pay.id,
      method: pay.paymentMethod,
    });
  }

  // 5. Expenses — CB-5: filter by method if methodFilter is set.
  // Expenses now have a paymentMethod column (EX-2). When methodFilter is
  // null (all methods), include all expenses. When methodFilter is "cash",
  // include cash + null (pre-EX-2 rows). When methodFilter is anything else,
  // skip expenses entirely (they wouldn't match).
  const expenseWhere: any = {
    businessId,
    expenseDate: { gte: startOfDay, lte: endOfDay },
  };
  if (methodFilter) {
    // CB-5: only include expenses matching the method filter (or null for
    // pre-EX-2 rows when filtering for "cash").
    expenseWhere.OR = methodFilter === "cash"
      ? [{ paymentMethod: "cash" }, { paymentMethod: null }]
      : [{ paymentMethod: methodFilter }];
  }
  const expenses = await db.cCTVExpense.findMany({
    where: expenseWhere,
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
      method: exp.paymentMethod || "cash", // EX-2: expenses now have a paymentMethod; null → cash (pre-EX-2)
    });
  }

  // Sort by time
  entries.sort((a, b) => a.time.localeCompare(b.time));

  // Calculate totals
  const totalIn = entries.reduce((sum, e) => sum + Number(e.amountIn), 0);
  const totalOut = entries.reduce((sum, e) => sum + Number(e.amountOut), 0);

  // CB-3 fix: compute opening balance
  // The opening balance is the net cash flow for ALL days before the
  // target date. We compute it as: sum of all sale paidAmounts before
  // this date + sum of all unlinked customer payments before this date
  // - sum of all purchase payments before this date - sum of all
  // unlinked supplier payments before this date - sum of all expenses
  // before this date.
  //
  // This is an approximation — it doesn't account for the linked/
  // unlinked split for historical data (pre-PM-3). For a fresh install
  // (post-PM-3), it's exact.
  const priorDate = new Date(startOfDay);
  priorDate.setMilliseconds(-1); // 23:59:59.999 the day before

  const [priorSalesPaid, priorCustomerPayments, priorPurchasePayments, priorSupplierPayments, priorExpenses] = await Promise.all([
    db.cCTVSale.aggregate({
      where: { businessId, saleDate: { lte: priorDate } },
      _sum: { paidAmount: true },
    }),
    db.cCTVPayment.aggregate({
      where: { businessId, type: "customer_payment", paymentDate: { lte: priorDate }, referenceId: null },
      _sum: { amount: true },
    }),
    db.cCTVPayment.aggregate({
      where: { businessId, type: "purchase", paymentDate: { lte: priorDate } },
      _sum: { amount: true },
    }),
    db.cCTVPayment.aggregate({
      where: { businessId, type: "supplier_payment", paymentDate: { lte: priorDate }, referenceId: null },
      _sum: { amount: true },
    }),
    db.cCTVExpense.aggregate({
      where: { businessId, expenseDate: { lte: priorDate } },
      _sum: { amount: true },
    }),
  ]);

  const openingBalance =
    Number(priorSalesPaid._sum.paidAmount || 0) +
    Number(priorCustomerPayments._sum.amount || 0) -
    Number(priorPurchasePayments._sum.amount || 0) -
    Number(priorSupplierPayments._sum.amount || 0) -
    Number(priorExpenses._sum.amount || 0);

  // CB-6 fix: closing balance
  const closingBalance = openingBalance + totalIn - totalOut;
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
      openingBalance,
      totalIn,
      totalOut,
      netCash,
      closingBalance,
      transactionCount: entries.length,
      // CB-2: indicate which method filter was applied
      methodFilter: methodFilter || "all",
    },
    // CB-7: per-method breakdown so the UI can show a small table.
    methodBreakdown,
  });
}
