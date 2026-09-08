// GET /api/businesses/[id]/cctv/reports/supplier-ledger?supplierId=xxx&from=&to=
// SL-3 fix: added ?from=&to= date filter for the per-supplier detail.
// SL-4 fix: N+1 → groupBy aggregation on the list endpoint.
// SL-8 fix: opening balance carried forward for date ranges.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const supplierId = searchParams.get("supplierId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!supplierId) {
    // List all suppliers with their balances
    // SL-4 fix: replaced N+1 queries (one findMany per supplier) with
    // a single groupBy aggregation. 500 suppliers = 2 queries instead
    // of 501.
    const suppliers = await db.cCTVSupplier.findMany({
      where: { businessId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true, openingBalance: true },
    });

    // Single aggregation query: group purchases by supplierId
    const purchasesBySupplier = await db.cCTVPurchase.groupBy({
      by: ["supplierId"],
      where: { businessId },
      _sum: { totalAmount: true, paidAmount: true },
    });

    // Build a lookup map: supplierId → { totalPurchases, totalPaid }
    const balanceMap = new Map<string, { totalPurchases: number; totalPaid: number }>();
    for (const row of purchasesBySupplier) {
      if (row.supplierId) {
        balanceMap.set(row.supplierId, {
          totalPurchases: Number(row._sum.totalAmount) || 0,
          totalPaid: Number(row._sum.paidAmount) || 0,
        });
      }
    }

    // Merge supplier data with balances
    const suppliersWithBalance = suppliers.map((s) => {
      const purchases = balanceMap.get(s.id) || { totalPurchases: 0, totalPaid: 0 };
      const balance = Number(s.openingBalance) + purchases.totalPurchases - purchases.totalPaid;
      return { ...s, balance, totalPurchases: purchases.totalPurchases, totalPaid: purchases.totalPaid };
    });

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

  // SL-3/SL-8 fix: compute date range + opening balance as carry-forward
  const startDate = from ? new Date(from) : null;
  const endDate = to ? new Date(to) : null;
  if (endDate) endDate.setHours(23, 59, 59, 999);

  let openingBalance: number;
  if (startDate) {
    // Compute balance as of the day before "from"
    const dayBefore = new Date(startDate);
    dayBefore.setHours(23, 59, 59, 999);
    dayBefore.setDate(dayBefore.getDate() - 1);

    const [priorPurchases, priorPayments] = await Promise.all([
      db.cCTVPurchase.aggregate({
        where: { businessId, supplierId, purchaseDate: { lte: dayBefore } },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      db.cCTVPayment.aggregate({
        where: { businessId, supplierId, type: "supplier_payment", paymentDate: { lte: dayBefore } },
        _sum: { amount: true },
      }),
    ]);

    const priorPurchasesTotal = Number(priorPurchases._sum.totalAmount) || 0;
    const priorPurchasesPaid = Number(priorPurchases._sum.paidAmount) || 0;
    openingBalance = Number(supplier.openingBalance) + priorPurchasesTotal - priorPurchasesPaid;

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
    openingBalance = Number(supplier.openingBalance);
    if (openingBalance > 0) {
      entries.push({
        date: supplier.createdAt.toISOString().split("T")[0],
        description: "Opening Balance",
        debit: openingBalance,
        credit: 0,
        balance: openingBalance,
        type: "opening",
      });
    }
  }

  // Purchases (debit — we owe more)
  // SL-3 fix: filter by date range if provided
  const purchasesWhere: Record<string, unknown> = { businessId, supplierId };
  if (startDate || endDate) {
    purchasesWhere.purchaseDate = {};
    if (startDate) purchasesWhere.purchaseDate.gte = startDate;
    if (endDate) purchasesWhere.purchaseDate.lte = endDate;
  }

  const purchases = await db.cCTVPurchase.findMany({
    where: purchasesWhere,
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
  // SL-3 fix: filter by date range if provided
  const paymentsWhere: Record<string, unknown> = { businessId, supplierId, type: "supplier_payment" };
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

  // Sort by date, then by type priority within the same date.
  // SL-7 fix: same as CL-6 — stable secondary sort by type.
  // opening → purchase → payment → everything else.
  const TYPE_PRIORITY: Record<string, number> = {
    opening: 0,
    purchase: 1,
    payment: 2,
  };
  entries.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    const aPrio = TYPE_PRIORITY[a.type] ?? 99;
    const bPrio = TYPE_PRIORITY[b.type] ?? 99;
    return aPrio - bPrio;
  });

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
    supplier: { id: supplier.id, name: supplier.name, phone: supplier.phone },
    entries,
    summary: {
      totalDebit,
      totalCredit,
      balance: runningBalance,
      entryCount: entries.length,
      dateRange: { from: from || null, to: to || null },
    },
  });
}
