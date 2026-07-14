// GET /api/businesses/[id]/cctv/reports/supplier-ledger?supplierId=xxx
// Returns all transactions for a supplier with running balance
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const supplierId = searchParams.get("supplierId");

  if (!supplierId) {
    // List all suppliers with their balances
    const suppliers = await db.cCTVSupplier.findMany({
      where: { businessId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true, openingBalance: true },
    });

    const suppliersWithBalance = await Promise.all(
      suppliers.map(async (s) => {
        const purchases = await db.cCTVPurchase.findMany({
          where: { businessId, supplierId: s.id },
          select: { totalAmount: true, paidAmount: true },
        });
        const totalPurchases = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
        const totalPaid = purchases.reduce((sum, p) => sum + p.paidAmount, 0);
        const balance = Number(s.openingBalance) + totalPurchases - totalPaid;
        return { ...s, balance, totalPurchases, totalPaid };
      })
    );

    return NextResponse.json({ success: true, suppliers: suppliersWithBalance });
  }

  // Get ledger for specific supplier
  const supplier = await db.cCTVSupplier.findUnique({
    where: { id: supplierId },
  });

  if (!supplier) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  type Entry = {
    date: string;
    description: string;
    debit: number; // we owe more
    credit: number; // we paid
    balance: number;
    type: string;
  };

  const entries: Entry[] = [];

  // Opening balance
  if (Number(supplier.openingBalance) > 0) {
    entries.push({
      date: supplier.createdAt.toISOString().split("T")[0],
      description: "Opening Balance",
      debit: Number(supplier.openingBalance),
      credit: 0,
      balance: Number(supplier.openingBalance),
      type: "opening",
    });
  }

  // Purchases (debit — we owe more)
  const purchases = await db.cCTVPurchase.findMany({
    where: { businessId, supplierId },
    select: { id: true, purchaseDate: true, totalAmount: true, paidAmount: true, invoiceNo: true },
    orderBy: { purchaseDate: "asc" },
  });

  for (const pur of purchases) {
    entries.push({
      date: pur.purchaseDate.toISOString().split("T")[0],
      description: `Purchase${pur.invoiceNo ? ` (${pur.invoiceNo})` : ""}`,
      debit: Number(pur.totalAmount),
      credit: Number(pur.paidAmount),
      balance: 0,
      type: "purchase",
    });
  }

  // Payments made (credit — we paid)
  const payments = await db.cCTVPayment.findMany({
    where: { businessId, supplierId, type: "supplier_payment" },
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

  // Sort by date
  entries.sort((a, b) => a.date.localeCompare(b.date));

  // Calculate running balance
  let runningBalance = supplier.openingBalance;
  for (const entry of entries) {
    if (entry.type === "opening") {
      runningBalance = supplier.openingBalance;
    } else {
      runningBalance += entry.debit - entry.credit;
    }
    entry.balance = runningBalance;
  }

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

  return NextResponse.json({
    success: true,
    supplier: { id: supplier.id, name: supplier.name, phone: supplier.phone },
    entries,
    summary: {
      totalDebit,
      totalCredit,
      balance: runningBalance,
      entryCount: entries.length,
    },
  });
}
