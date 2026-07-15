// GET/POST /api/businesses/[id]/cctv/expenses
// PHASE 7: Creates balanced ledger entries + wrapped in $transaction()
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createLedgerEntries, LEDGER_ACCOUNTS, paymentMethodToAccount } from "@/lib/ledger-helper";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 50;
  const skip = (page - 1) * limit;

  const [expenses, total] = await Promise.all([
    db.cCTVExpense.findMany({
      where: { businessId },
      orderBy: { expenseDate: "desc" },
      skip,
      take: limit,
    }),
    db.cCTVExpense.count({ where: { businessId } }),
  ]);

  const totalAmount = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return NextResponse.json({
    success: true,
    expenses,
    total,
    totalAmount,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const body = await req.json();

  if (!body.amount || body.amount <= 0) {
    return NextResponse.json({ error: "Amount is required and must be > 0" }, { status: 400 });
  }

  try {
    const expense = await db.$transaction(async (tx) => {
      const createdExpense = await tx.cCTVExpense.create({
        data: {
          businessId,
          category: body.category || "other",
          description: body.description || null,
          amount: parseFloat(body.amount),
          expenseDate: body.expenseDate ? new Date(body.expenseDate) : new Date(),
        },
      });

      // Create balanced ledger entries
      // Expense: DEBIT expense, CREDIT cash (default — expenses paid in cash)
      const amount = parseFloat(body.amount);
      const paymentAccount = paymentMethodToAccount(body.paymentMethod || "cash");

      await createLedgerEntries(tx, [
        { businessId, accountId: LEDGER_ACCOUNTS.EXPENSE, entryType: "DEBIT", amount, referenceId: createdExpense.id, referenceType: "expense", description: `Expense: ${body.category || "other"}${body.description ? ` — ${body.description}` : ""}` },
        { businessId, accountId: paymentAccount, entryType: "CREDIT", amount, referenceId: createdExpense.id, referenceType: "expense", description: `Paid via ${body.paymentMethod || "cash"}` },
      ]);

      return createdExpense;
    });

    return NextResponse.json({ success: true, expense }, { status: 201 });
  } catch (err: any) {
    console.error("[cctv/expenses] Transaction failed:", err);
    const msg = err?.message || "Failed to create expense";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
