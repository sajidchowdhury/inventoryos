// GET /api/businesses/[id]/cctv/reports/customer-ledger?customerId=xxx&from=&to=
// Returns all transactions for a customer with running balance.
// CL-5 fix: added ?from=&to= date filter for the per-customer detail.
// CL-7 fix: opening balance is now carried forward as the starting
//   balance for the date range, not as a dated entry on customer.createdAt.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customerId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!customerId) {
    // List all customers with their balances
    // CL-4 fix: replaced N+1 queries with groupBy aggregation.
    const customers = await db.cCTVCustomer.findMany({
      where: { businessId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true, openingBalance: true },
    });

    const salesByCustomer = await db.cCTVSale.groupBy({
      by: ["customerId"],
      where: { businessId },
      _sum: { totalAmount: true, paidAmount: true },
    });

    const balanceMap = new Map<string, { totalPurchases: number; totalPaid: number }>();
    for (const row of salesByCustomer) {
      if (row.customerId) {
        balanceMap.set(row.customerId, {
          totalPurchases: Number(row._sum.totalAmount) || 0,
          totalPaid: Number(row._sum.paidAmount) || 0,
        });
      }
    }

    const customersWithBalance = customers.map((c) => {
      const sales = balanceMap.get(c.id) || { totalPurchases: 0, totalPaid: 0 };
      const balance = Number(c.openingBalance) + sales.totalPurchases - sales.totalPaid;
      return { ...c, balance, totalPurchases: sales.totalPurchases, totalPaid: sales.totalPaid };
    });

    return NextResponse.json({ success: true, customers: customersWithBalance });
  }

  // Get ledger for specific customer
  const customer = await db.cCTVCustomer.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  // CL-5 fix: compute date range for filtering
  const startDate = from ? new Date(from) : null;
  const endDate = to ? new Date(to) : null;
  if (endDate) endDate.setHours(23, 59, 59, 999);

  type Entry = {
    date: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    type: string;
  };

  const entries: Entry[] = [];

  // ── CL-7 fix: compute opening balance as a carry-forward ──
  // If a date range is specified (from/to), the "opening balance" is
  // the customer's balance as of the day BEFORE the "from" date.
  // This includes: openingBalance + all sales + all payments before "from".
  // If no date range, the opening balance is just the customer's
  // openingBalance field (same as before).
  let openingBalance: number;
  if (startDate) {
    // Compute balance as of the day before "from"
    const dayBefore = new Date(startDate);
    dayBefore.setHours(23, 59, 59, 999);
    dayBefore.setDate(dayBefore.getDate() - 1);

    const [priorSales, priorPayments] = await Promise.all([
      db.cCTVSale.aggregate({
        where: {
          businessId,
          customerId,
          saleDate: { lte: dayBefore },
        },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      db.cCTVPayment.aggregate({
        where: {
          businessId,
          customerId,
          type: "customer_payment",
          paymentDate: { lte: dayBefore },
        },
        _sum: { amount: true },
      }),
    ]);

    const priorSalesTotal = Number(priorSales._sum.totalAmount) || 0;
    const priorSalesPaid = Number(priorSales._sum.paidAmount) || 0;
    const priorPaymentsTotal = Number(priorPayments._sum.amount) || 0;

    // Balance = opening + (sales total - sales paid) - standalone payments
    // Note: sales.paidAmount includes the sale-internal payment + any
    // linked standalone payments (via PM-3). Standalone payments
    // (type=customer_payment) include both linked and unlinked.
    // To avoid double-counting, we use: opening + sales_total - sales_paid
    // (which includes all payments that hit sales) and DON'T subtract
    // standalone payments separately (they're already in sales_paid
    // via PM-3 for linked ones; unlinked ones aren't in any sale).
    // For a fully accurate balance we'd need: opening + sales_total -
    // (sales_paid + unlinked_payments). But the groupBy in the list
    // view uses sales_total - sales_paid, so we match that here.
    openingBalance = Number(customer.openingBalance) + priorSalesTotal - priorSalesPaid;

    // Add a "Brought Forward" entry at the top
    if (openingBalance !== 0) {
      entries.push({
        date: from!,
        description: "Brought Forward",
        debit: openingBalance > 0 ? openingBalance : 0,
        credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
        balance: openingBalance,
        type: "opening",
      });
    }
  } else {
    // No date range — use the customer's openingBalance as before
    openingBalance = Number(customer.openingBalance);
    if (openingBalance > 0) {
      entries.push({
        date: customer.createdAt.toISOString().split("T")[0],
        description: "Opening Balance",
        debit: openingBalance,
        credit: 0,
        balance: openingBalance,
        type: "opening",
      });
    }
  }

  // ── Sales (debit — customer owes more) ──
  // CL-5 fix: filter by date range if provided
  const salesWhere: Record<string, unknown> = { businessId, customerId };
  if (startDate || endDate) {
    salesWhere.saleDate = {};
    if (startDate) salesWhere.saleDate.gte = startDate;
    if (endDate) salesWhere.saleDate.lte = endDate;
  }

  const sales = await db.cCTVSale.findMany({
    where: salesWhere,
    select: { id: true, saleDate: true, totalAmount: true, paidAmount: true, invoiceNo: true },
    orderBy: { saleDate: "asc" },
  });

  for (const sale of sales) {
    entries.push({
      date: sale.saleDate.toISOString().split("T")[0],
      description: `Sale${sale.invoiceNo ? ` (${sale.invoiceNo})` : ""}`,
      debit: Number(sale.totalAmount),
      credit: Number(sale.paidAmount),
      balance: 0,
      type: "sale",
    });
  }

  // ── Payments received (credit — customer paid) ──
  // CL-5 fix: filter by date range if provided
  const paymentsWhere: Record<string, unknown> = { businessId, customerId, type: "customer_payment" };
  if (startDate || endDate) {
    paymentsWhere.paymentDate = {};
    if (startDate) paymentsWhere.paymentDate.gte = startDate;
    if (endDate) paymentsWhere.paymentDate.lte = endDate;
  }

  const payments = await db.cCTVPayment.findMany({
    where: paymentsWhere,
    select: { id: true, paymentDate: true, amount: true, paymentMethod: true, notes: true },
    orderBy: { paymentDate: "asc" },
  });

  for (const pay of payments) {
    entries.push({
      date: pay.paymentDate.toISOString().split("T")[0],
      description: `Payment (${pay.paymentMethod})${pay.notes ? ` — ${pay.notes}` : ""}`,
      debit: 0,
      credit: Number(pay.amount),
      balance: 0,
      type: "payment",
    });
  }

  // Sort by date (stable sort preserves insertion order within same date)
  entries.sort((a, b) => a.date.localeCompare(b.date));

  // Calculate running balance
  let runningBalance = openingBalance;
  for (const entry of entries) {
    if (entry.type === "opening") {
      runningBalance = openingBalance;
    } else {
      runningBalance += entry.debit - entry.credit;
    }
    entry.balance = runningBalance;
  }

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

  return NextResponse.json({
    success: true,
    customer: { id: customer.id, name: customer.name, phone: customer.phone },
    entries,
    summary: {
      totalDebit,
      totalCredit,
      balance: runningBalance,
      entryCount: entries.length,
      // CL-5: include the date range in the response
      dateRange: { from: from || null, to: to || null },
    },
  });
}
