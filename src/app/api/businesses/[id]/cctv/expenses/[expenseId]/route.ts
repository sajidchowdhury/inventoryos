// GET/PATCH/DELETE /api/businesses/[id]/cctv/expenses/[expenseId]
// EX-3: Expense edit and delete endpoints (previously missing).
//
// GET: returns a single expense by id (must match businessId).
// PATCH: edits category, description, amount, paymentMethod, expenseDate.
//   Guarded by SUB-1. When amount or paymentMethod changes, creates
//   reversing ledger entries for the old values + new ledger entries
//   for the new values, so the books stay balanced.
// DELETE: hard-deletes the expense + creates reversing ledger entries
//   to undo the original. Guarded by SUB-1.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveSubscription } from "@/lib/subscription-guard";
import { createLedgerEntries, LEDGER_ACCOUNTS, paymentMethodToAccount } from "@/lib/ledger-helper";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  const { id: businessId, expenseId } = await params;

  const expense = await db.cCTVExpense.findFirst({
    where: { id: expenseId, businessId },
  });

  if (!expense) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, expense });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  const { id: businessId, expenseId } = await params;

  const guard = await requireActiveSubscription(businessId);
  if (!guard.allowed) return guard.error!;

  const body = await req.json();

  const existing = await db.cCTVExpense.findFirst({
    where: { id: expenseId, businessId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.category !== undefined) updateData.category = body.category;
  if (body.description !== undefined) updateData.description = body.description || null;
  if (body.amount !== undefined) updateData.amount = body.amount;
  if (body.paymentMethod !== undefined) updateData.paymentMethod = body.paymentMethod;
  if (body.expenseDate !== undefined) updateData.expenseDate = new Date(body.expenseDate);

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const updated = await db.$transaction(async (tx) => {
      // If amount or paymentMethod changed, reverse the old ledger entries
      // and create new ones.
      const oldAmount = Number(existing.amount);
      const oldMethod = existing.paymentMethod || "cash";
      const newAmount = body.amount !== undefined ? parseFloat(body.amount) : oldAmount;
      const newMethod = body.paymentMethod || oldMethod;

      if (oldAmount !== newAmount || oldMethod !== newMethod) {
        // Reverse old entries: CREDIT expense (undo DEBIT), DEBIT cash (undo CREDIT)
        const oldPaymentAccount = paymentMethodToAccount(oldMethod);
        await createLedgerEntries(tx, [
          {
            businessId,
            accountId: LEDGER_ACCOUNTS.EXPENSE,
            entryType: "CREDIT",
            amount: oldAmount,
            referenceId: expenseId,
            referenceType: "expense",
            description: `Reversing original expense (edit)`,
          },
          {
            businessId,
            accountId: oldPaymentAccount,
            entryType: "DEBIT",
            amount: oldAmount,
            referenceId: expenseId,
            referenceType: "expense",
            description: `Reversing original expense payment (edit)`,
          },
        ]);

        // Create new entries: DEBIT expense, CREDIT new payment account
        const newPaymentAccount = paymentMethodToAccount(newMethod);
        await createLedgerEntries(tx, [
          {
            businessId,
            accountId: LEDGER_ACCOUNTS.EXPENSE,
            entryType: "DEBIT",
            amount: newAmount,
            referenceId: expenseId,
            referenceType: "expense",
            description: `Expense (edited): ${body.category || existing.category}${body.description ? ` — ${body.description}` : ""}`,
          },
          {
            businessId,
            accountId: newPaymentAccount,
            entryType: "CREDIT",
            amount: newAmount,
            referenceId: expenseId,
            referenceType: "expense",
            description: `Paid via ${newMethod} (edited)`,
          },
        ]);
      }

      const updatedExpense = await tx.cCTVExpense.update({
        where: { id: expenseId },
        data: updateData,
      });

      return updatedExpense;
    });

    return NextResponse.json({ success: true, expense: updated });
  } catch (err: any) {
    console.error("[cctv/expenses PATCH] Transaction failed:", err);
    return NextResponse.json({ error: err?.message || "Failed to update expense" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  const { id: businessId, expenseId } = await params;

  const guard = await requireActiveSubscription(businessId);
  if (!guard.allowed) return guard.error!;

  const existing = await db.cCTVExpense.findFirst({
    where: { id: expenseId, businessId },
    select: { id: true, amount: true, paymentMethod: true, category: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  try {
    await db.$transaction(async (tx) => {
      // Reverse the original ledger entries before deleting
      const oldAmount = Number(existing.amount);
      const oldMethod = existing.paymentMethod || "cash";
      const oldPaymentAccount = paymentMethodToAccount(oldMethod);

      await createLedgerEntries(tx, [
        {
          businessId,
          accountId: LEDGER_ACCOUNTS.EXPENSE,
          entryType: "CREDIT",
          amount: oldAmount,
          referenceId: expenseId,
          referenceType: "expense",
          description: `Reversing deleted expense: ${existing.category}`,
        },
        {
          businessId,
          accountId: oldPaymentAccount,
          entryType: "DEBIT",
          amount: oldAmount,
          referenceId: expenseId,
          referenceType: "expense",
          description: `Reversing deleted expense payment via ${oldMethod}`,
        },
      ]);

      await tx.cCTVExpense.delete({
        where: { id: expenseId },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Expense deleted. Ledger entries reversed.",
    });
  } catch (err: any) {
    console.error("[cctv/expenses DELETE] Transaction failed:", err);
    return NextResponse.json({ error: err?.message || "Failed to delete expense" }, { status: 500 });
  }
}
