// GET /api/businesses/[id]/mobile-shop/customers/[customerId]/ledger
// Per-customer financial ledger: sales (debits), payments (credits), returns (credits), running balance.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface LedgerEntry {
  id: string;
  date: string;
  type: "SALE" | "PAYMENT" | "RETURN";
  typeLabel: string;
  description: string;
  debit: number;  // money customer owes (sale amount)
  credit: number; // money customer pays / gets back
  balance: number; // running balance (positive = customer owes us)
  reference?: string;
  linkedId?: string;
}

interface CustomerLedgerResponse {
  success: boolean;
  customerName: string;
  customerPhone: string | null;
  totalDebit: number;  // total sales
  totalCredit: number; // total payments + returns
  currentBalance: number; // positive = customer owes us
  entryCount: number;
  entries: LedgerEntry[];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; customerId: string }> }
) {
  try {
    const { id: businessId, customerId } = await params;

    // ── Fetch customer info ──
    const customer = await db.customer.findUnique({
      where: { id: customerId, businessId },
      select: { id: true, name: true, phone: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // ── 1. Sales (DEBIT — customer owes) ──
    const sales = await db.mSSale.findMany({
      where: { businessId, customerId, isActive: true },
      select: {
        id: true,
        saleCode: true,
        totalDue: true,
        createdAt: true,
        discountAmount: true,
        notes: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // ── 2. Payments (CREDIT — customer pays) ──
    const payments = await db.mSPayment.findMany({
      where: {
        businessId,
        isActive: true,
        sale: { customerId, businessId },
      },
      select: {
        id: true,
        amount: true,
        method: true,
        referenceNumber: true,
        createdAt: true,
        sale: { select: { saleCode: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // ── 3. Returns (CREDIT — customer gets money back) ──
    const returns = await db.mSReturn.findMany({
      where: {
        businessId,
        sale: { customerId, businessId },
        refundAmount: { gt: 0 },
      },
      select: {
        id: true,
        returnCode: true,
        refundAmount: true,
        refundMethod: true,
        refundReference: true,
        createdAt: true,
        sale: { select: { saleCode: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // ── Merge into unified entries ──
    const raw: Array<{ date: Date; entry: Omit<LedgerEntry, "balance"> }> = [];

    for (const s of sales) {
      raw.push({
        date: s.createdAt,
        entry: {
          id: `sale-${s.id}`,
          date: s.createdAt.toISOString(),
          type: "SALE",
          typeLabel: "Purchase",
          description: s.saleCode,
          debit: s.totalDue,
          credit: 0,
          balance: 0,
          reference: s.notes || undefined,
          linkedId: s.id,
        },
      });
    }

    for (const p of payments) {
      raw.push({
        date: p.createdAt,
        entry: {
          id: `pay-${p.id}`,
          date: p.createdAt.toISOString(),
          type: "PAYMENT",
          typeLabel: "Payment",
          description: `Payment — ${p.sale?.saleCode || "Sale"}`,
          debit: 0,
          credit: p.amount,
          balance: 0,
          reference: `${p.method}${p.referenceNumber ? ` #${p.referenceNumber}` : ""}`,
          linkedId: p.id,
        },
      });
    }

    for (const r of returns) {
      raw.push({
        date: r.createdAt,
        entry: {
          id: `ret-${r.id}`,
          date: r.createdAt.toISOString(),
          type: "RETURN",
          typeLabel: "Return",
          description: `${r.returnCode} — ${r.sale?.saleCode || "Sale"}`,
          debit: 0,
          credit: r.refundAmount,
          balance: 0,
          reference: r.refundReference || undefined,
          linkedId: r.id,
        },
      });
    }

    // Sort chronologically, stable by id
    raw.sort((a, b) => {
      const dd = a.date.getTime() - b.date.getTime();
      if (dd !== 0) return dd;
      return a.entry.id.localeCompare(b.entry.id);
    });

    // ── Running balance ──
    // Balance convention: positive = customer owes us, negative = we owe customer
    let runningBalance = 0;
    const entries: LedgerEntry[] = raw.map((r) => {
      // Debit (sale) increases what they owe. Credit (payment/return) decreases it.
      runningBalance += r.entry.debit - r.entry.credit;
      return { ...r.entry, balance: runningBalance };
    });

    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

    const response: CustomerLedgerResponse = {
      success: true,
      customerName: customer.name,
      customerPhone: customer.phone,
      totalDebit,
      totalCredit,
      currentBalance: runningBalance,
      entryCount: entries.length,
      entries,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Customer Ledger API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer ledger" },
      { status: 500 }
    );
  }
}