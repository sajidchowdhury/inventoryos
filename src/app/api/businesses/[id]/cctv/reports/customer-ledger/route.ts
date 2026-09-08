// GET /api/businesses/[id]/cctv/reports/customer-ledger?customerId=xxx
// Returns all transactions for a customer with running balance
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customerId");

  if (!customerId) {
    // List all customers with their balances
    // CL-4 fix: replaced N+1 queries (one findMany per customer) with
    // a single groupBy aggregation. 5000 customers = 2 queries instead
    // of 5001.
    const customers = await db.cCTVCustomer.findMany({
      where: { businessId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true, openingBalance: true },
    });

    // Single aggregation query: group sales by customerId
    const salesByCustomer = await db.cCTVSale.groupBy({
      by: ["customerId"],
      where: { businessId },
      _sum: { totalAmount: true, paidAmount: true },
    });

    // Build a lookup map: customerId → { totalPurchases, totalPaid }
    const balanceMap = new Map<string, { totalPurchases: number; totalPaid: number }>();
    for (const row of salesByCustomer) {
      if (row.customerId) {
        balanceMap.set(row.customerId, {
          totalPurchases: Number(row._sum.totalAmount) || 0,
          totalPaid: Number(row._sum.paidAmount) || 0,
        });
      }
    }

    // Merge customer data with balances
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

  type Entry = {
    date: string;
    description: string;
    debit: number; // they owe more
    credit: number; // they paid
    balance: number;
    type: string;
  };

  const entries: Entry[] = [];

  // Opening balance
  if (Number(customer.openingBalance) > 0) {
    entries.push({
      date: customer.createdAt.toISOString().split("T")[0],
      description: "Opening Balance",
      debit: Number(customer.openingBalance),
      credit: 0,
      balance: Number(customer.openingBalance),
      type: "opening",
    });
  }

  // Sales (debit — customer owes more)
  const sales = await db.cCTVSale.findMany({
    where: { businessId, customerId },
    select: { id: true, saleDate: true, totalAmount: true, paidAmount: true, invoiceNo: true },
    orderBy: { saleDate: "asc" },
  });

  for (const sale of sales) {
    const due = Number(sale.totalAmount) - Number(sale.paidAmount);
    entries.push({
      date: sale.saleDate.toISOString().split("T")[0],
      description: `Sale${sale.invoiceNo ? ` (${sale.invoiceNo})` : ""}`,
      debit: Number(sale.totalAmount),
      credit: Number(sale.paidAmount),
      balance: 0, // will calculate below
      type: "sale",
    });
  }

  // Payments received (credit — customer paid)
  const payments = await db.cCTVPayment.findMany({
    where: { businessId, customerId, type: "customer_payment" },
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

  // CL-1 fix: removed the broken returns query.
  // The old code did db.cCTVReturn.findMany({ where: { businessId },
  //   include: { items: { where: { productId: { in: sales.flatMap(s => [s.id]) } } } } })
  // which had TWO bugs: (1) it filtered items by productId IN [sale IDs]
  //   (should be saleId, not productId — they're different fields);
  // (2) the result was never appended to the entries array even if it
  //   matched. So returns were silently invisible.
  // Since there is no /cctv/returns/ endpoint (no way to create CCTV
  // returns from the CCTV module), and the query was broken + unused,
  // it's dead code. Removed it entirely. If a CCTV returns feature is
  // added in the future, a new returns query should be written from
  // scratch with the correct join (saleId, not productId) and the
  // results should be appended to entries as credit entries.

  // Sort by date
  entries.sort((a, b) => a.date.localeCompare(b.date));

  // Calculate running balance
  let runningBalance = customer.openingBalance;
  for (const entry of entries) {
    if (entry.type === "opening") {
      runningBalance = customer.openingBalance;
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
    },
  });
}
