// GET /api/businesses/[id]/cctv/ledger?from=X&to=Y
// Aggregates all financial transactions into a chronological day book with running balance.
// CSV export via ?format=csv query param.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface LedgerEntry {
  id: string;
  date: string;
  type: string;
  typeLabel: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  reference?: string | null;
  category?: string;
  method?: string;
  sourceId: string;
  linkedId?: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;

    const fromStr = url.searchParams.get("from") || "";
    const toStr = url.searchParams.get("to") || "";
    const format = url.searchParams.get("format") || "json";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "200");
    const skip = (page - 1) * limit;

    // Date range — default: current month
    const now = new Date();
    const from = fromStr ? new Date(fromStr) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = toStr ? (() => { const d = new Date(toStr); d.setHours(23, 59, 59, 999); return d; })()
                     : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // ── 1. Customer Payments (CREDIT — money in) ──
    const customerPayments = await db.cCTVPayment.findMany({
      where: { businessId, isActive: true, createdAt: { gte: from, lte: to } },
      include: {
        sale: { select: { saleCode: true, customerName: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // ── 2. Expenses (DEBIT — money out) ──
    const expenses = await db.cCTVExpense.findMany({
      where: { businessId, isActive: true, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
    });

    // ── 3. Returns / Refunds (DEBIT — money out) ──
    const returns = await db.cCTVReturn.findMany({
      where: { businessId, refundAmount: { gt: 0 }, createdAt: { gte: from, lte: to } },
      select: {
        id: true, returnCode: true, refundAmount: true, refundMethod: true,
        refundReference: true, customerName: true, saleId: true, createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // ── 4. Purchase Payments (DEBIT — money out to suppliers) ──
    // Since we don't have individual purchase payment records, we show CCTVPurchase
    // entries where paidAmount > 0. The createdAt approximates when payment was made.
    const purchases = await db.cCTVPurchase.findMany({
      where: {
        businessId,
        status: { not: "cancelled" },
        paidAmount: { gt: 0 },
        createdAt: { gte: from, lte: to },
      },
      include: {
        supplier: { select: { name: true, code: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // ── Merge into unified entries ──
    const entries: Array<{
      date: Date;
      entry: Omit<LedgerEntry, "balance">;
    }> = [];

    // Customer payments
    for (const p of customerPayments) {
      entries.push({
        date: p.createdAt,
        entry: {
          id: `pay-${p.id}`,
          date: p.createdAt.toISOString(),
          type: "SALE_PAYMENT",
          typeLabel: "Sale Payment",
          description: `${p.sale?.saleCode || "Sale"} — ${p.sale?.customerName || "Customer"}`,
          debit: 0,
          credit: p.amount,
          balance: 0, // computed below
          reference: p.referenceNumber || null,
          method: p.method,
          sourceId: p.id,
          linkedId: p.saleId,
        },
      });
    }

    // Expenses
    for (const e of expenses) {
      const catLabel: Record<string, string> = {
        RENT: "Rent", SALARY: "Salary", TRANSPORT: "Transport",
        UTILITY: "Utility", MISC: "Misc",
      };
      entries.push({
        date: e.date,
        entry: {
          id: `exp-${e.id}`,
          date: e.date.toISOString(),
          type: "EXPENSE",
          typeLabel: "Expense",
          description: e.description || `${catLabel[e.category] || e.category}`,
          debit: e.amount,
          credit: 0,
          balance: 0,
          reference: e.reference || null,
          category: e.category,
          method: e.paymentMethod || undefined,
          sourceId: e.id,
        },
      });
    }

    // Returns
    for (const r of returns) {
      entries.push({
        date: r.createdAt,
        entry: {
          id: `ret-${r.id}`,
          date: r.createdAt.toISOString(),
          type: "RETURN_REFUND",
          typeLabel: "Return Refund",
          description: `${r.returnCode} — ${r.customerName || "Customer"}`,
          debit: r.refundAmount,
          credit: 0,
          balance: 0,
          reference: r.refundReference || null,
          method: r.refundMethod,
          sourceId: r.id,
          linkedId: r.saleId,
        },
      });
    }

    // Purchases (approximate: treat createdAt as payment date)
    for (const p of purchases) {
      entries.push({
        date: p.createdAt,
        entry: {
          id: `pur-${p.id}`,
          date: p.createdAt.toISOString(),
          type: "PURCHASE_PAYMENT",
          typeLabel: "Purchase Payment",
          description: `${p.purchaseNo}${p.supplier ? ` — ${p.supplier.name}` : ""}`,
          debit: p.paidAmount,
          credit: 0,
          balance: 0,
          reference: p.invoiceNo || null,
          method: undefined,
          sourceId: p.id,
          linkedId: p.supplierId || undefined,
        },
      });
    }

    // Sort chronologically, then by id for stable ordering
    entries.sort((a, b) => {
      const dateDiff = a.date.getTime() - b.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.entry.id.localeCompare(b.entry.id);
    });

    // ── Compute running balance ──
    // Opening balance = sum of all credits - debits BEFORE the from date
    const [priorPayments, priorExpenses, priorReturns, priorPurchases] = await Promise.all([
      db.cCTVPayment.aggregate({
        where: { businessId, isActive: true, createdAt: { lt: from } },
        _sum: { amount: true },
      }),
      db.cCTVExpense.aggregate({
        where: { businessId, isActive: true, date: { lt: from } },
        _sum: { amount: true },
      }),
      db.cCTVReturn.aggregate({
        where: { businessId, refundAmount: { gt: 0 }, createdAt: { lt: from } },
        _sum: { refundAmount: true },
      }),
      db.cCTVPurchase.aggregate({
        where: { businessId, status: { not: "cancelled" }, paidAmount: { gt: 0 }, createdAt: { lt: from } },
        _sum: { paidAmount: true },
      }),
    ]);

    const openingBalance =
      (priorPayments._sum.amount || 0) -
      (priorExpenses._sum.amount || 0) -
      (priorReturns._sum.refundAmount || 0) -
      (priorPurchases._sum.paidAmount || 0);

    let runningBalance = openingBalance;
    const ledgerEntries: LedgerEntry[] = entries.map((e) => {
      runningBalance += e.entry.credit - e.entry.debit;
      return { ...e.entry, balance: runningBalance };
    });

    // ── Summary stats ──
    const totalCredit = ledgerEntries.reduce((s, e) => s + e.credit, 0);
    const totalDebit = ledgerEntries.reduce((s, e) => s + e.debit, 0);
    const closingBalance = openingBalance + totalCredit - totalDebit;

    // Type breakdown
    const typeBreakdown = ledgerEntries.reduce((acc, e) => {
      if (!acc[e.type]) acc[e.type] = { count: 0, credit: 0, debit: 0 };
      acc[e.type].count++;
      acc[e.type].credit += e.credit;
      acc[e.type].debit += e.debit;
      return acc;
    }, {} as Record<string, { count: number; credit: number; debit: number }>);

    // ── CSV export ──
    if (format === "csv") {
      const header = "Date,Type,Description,Debit, Credit,Balance,Method,Reference\n";
      const rows = ledgerEntries.map((e) => {
        const date = new Date(e.date).toLocaleDateString("en-GB");
        const desc = `"${(e.description || "").replace(/"/g, '""')}"`;
        return `${date},${e.typeLabel},${desc},${e.debit > 0 ? e.debit.toFixed(2) : ""},${e.credit > 0 ? e.credit.toFixed(2) : ""},${e.balance.toFixed(2)},${e.method || ""},${e.reference || ""}`;
      }).join("\n");

      const csv = header + rows;
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="ledger_${fromStr || "start"}_${toStr || "end"}.csv"`,
        },
      });
    }

    // ── Paginated response ──
    const total = ledgerEntries.length;
    const paginatedEntries = ledgerEntries.slice(skip, skip + limit);

    return NextResponse.json({
      success: true,
      from: from.toISOString(),
      to: to.toISOString(),
      openingBalance,
      closingBalance,
      totalCredit,
      totalDebit,
      netFlow: totalCredit - totalDebit,
      entryCount: total,
      typeBreakdown,
      entries: paginatedEntries,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Ledger API error:", error);
    return NextResponse.json({ error: "Failed to fetch ledger" }, { status: 500 });
  }
}