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
    const customers = await db.cCTVCustomer.findMany({
      where: { businessId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true, openingBalance: true },
    });

    // For each customer, calculate current balance
    const customersWithBalance = await Promise.all(
      customers.map(async (c) => {
        const sales = await db.cCTVSale.findMany({
          where: { businessId, customerId: c.id },
          select: { totalAmount: true, paidAmount: true },
        });
        const totalPurchases = sales.reduce((s, sale) => s + Number(sale.totalAmount), 0);
        const totalPaid = sales.reduce((s, sale) => s + Number(sale.paidAmount), 0);
        const balance = Number(c.openingBalance) + totalPurchases - totalPaid;
        return { ...c, balance, totalPurchases, totalPaid };
      })
    );

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

  // Returns (credit — customer gets money back)
  const returns = await db.cCTVReturn.findMany({
    where: { businessId },
    include: { items: { where: { productId: { in: sales.flatMap(s => [s.id]) } } } },
  });

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
