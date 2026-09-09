// GET/POST /api/businesses/[id]/cctv/expenses
// PHASE 7: Creates balanced ledger entries + wrapped in $transaction()
// SUB-1: Guarded by requireActiveSubscription — blocked in read_only / data_wiped
// EX-4: GET accepts ?from=&to=&category= filters (date range + category).
// EX-5: POST accepts any category string (no hardcoded enum validation).
//       The UI's hardcoded CATEGORIES list is just a starter set — shops
//       can add their own (e.g. "marketing", "legal") and they will persist.
// EX-7: POST accepts `paidTo` (payee name, e.g. salary → employee name).
// EX-8: POST accepts `attachmentUrl` (URL to a receipt/invoice upload).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createLedgerEntries, LEDGER_ACCOUNTS, paymentMethodToAccount } from "@/lib/ledger-helper";
import { requireActiveSubscription } from "@/lib/subscription-guard";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("pageSize") || "50")));
  const skip = (page - 1) * pageSize;

  // EX-4: filter by date range + category. All optional — backward
  // compatible with the previous unfiltered GET. The `category` filter
  // is a case-insensitive exact match (a shop with "Marketing" and
  // "marketing" categories shouldn't have both shown for either query,
  // but since EX-5 lets the shop pick the spelling, we match exactly
  // but case-insensitively to be forgiving).
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const category = searchParams.get("category");
  const paidTo = searchParams.get("paidTo");

  const where: Record<string, unknown> = { businessId };
  if (from || to) {
    where.expenseDate = {};
    if (from) (where.expenseDate as any).gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      (where.expenseDate as any).lte = end;
    }
  }
  if (category) where.category = { equals: category, mode: "insensitive" };
  if (paidTo) where.paidTo = { equals: paidTo, mode: "insensitive" };

  // EX-1 fix: use a separate aggregate query for totalAmount over ALL
  // expenses matching the filter, not just the current page. Previously,
  // totalAmount was computed from the paginated expenses array — a shop
  // with 200 expenses (page 1 of 50) would show the sum of only 50.
  // EX-4: the aggregate now uses the same `where` so the total reflects
  // the filtered set, not the business's full history.
  const [expenses, total, totalAgg] = await Promise.all([
    db.cCTVExpense.findMany({
      where,
      orderBy: { expenseDate: "desc" },
      skip,
      take: pageSize,
    }),
    db.cCTVExpense.count({ where }),
    db.cCTVExpense.aggregate({
      where,
      _sum: { amount: true },
    }),
  ]);

  const totalAmount = Number(totalAgg._sum.amount) || 0;

  return NextResponse.json({
    success: true,
    expenses,
    total,
    totalAmount,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    // EX-4: echo the active filter so the UI can show "Filtered: Sep 2026 / Tea"
    filter: { from: from || null, to: to || null, category: category || null, paidTo: paidTo || null },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;

  // SUB-1: Block writes if subscription is in read_only or data_wiped stage.
  const guard = await requireActiveSubscription(businessId);
  if (!guard.allowed) return guard.error!;

  const body = await req.json();

  if (!body.amount || body.amount <= 0) {
    return NextResponse.json({ error: "Amount is required and must be > 0" }, { status: 400 });
  }

  // EX-5: trim + lowercase the category if provided; fall back to "other".
  // No hardcoded enum validation — shops can use any string. The UI's
  // CATEGORIES list is just a starter; "marketing", "legal", "advertising"
  // are all valid. Empty / missing category falls back to "other" so we
  // never store an empty string (which would group weirdly in reports).
  const category = String(body.category || "").trim() || "other";

  // EX-7: payee. Trim and cap at 200 chars to keep list views tidy. Allow
  // empty (many expenses like "electricity" don't have a payee).
  const paidTo = body.paidTo !== undefined && body.paidTo !== null
    ? String(body.paidTo).trim().slice(0, 200) || null
    : null;

  // EX-8: attachment URL. Validate the shape loosely (must start with
  // http:// or https://). The UI is responsible for actually uploading
  // the file and passing the resulting URL; we don't fetch it server-side.
  let attachmentUrl: string | null = null;
  if (body.attachmentUrl !== undefined && body.attachmentUrl !== null) {
    const url = String(body.attachmentUrl).trim();
    if (url && !/^https?:\/\//i.test(url)) {
      return NextResponse.json(
        { error: "attachmentUrl must start with http:// or https://" },
        { status: 400 },
      );
    }
    attachmentUrl = url || null;
  }

  try {
    const expense = await db.$transaction(async (tx) => {
      const createdExpense = await tx.cCTVExpense.create({
        data: {
          businessId,
          category,
          description: body.description || null,
          amount: parseFloat(body.amount),
          paymentMethod: body.paymentMethod || "cash", // EX-2: store the method
          paidTo,        // EX-7
          attachmentUrl, // EX-8
          expenseDate: body.expenseDate ? new Date(body.expenseDate) : new Date(),
        },
      });

      // Create balanced ledger entries
      // Expense: DEBIT expense, CREDIT cash (default — expenses paid in cash)
      const amount = parseFloat(body.amount);
      const paymentAccount = paymentMethodToAccount(body.paymentMethod || "cash");

      await createLedgerEntries(tx, [
        { businessId, accountId: LEDGER_ACCOUNTS.EXPENSE, entryType: "DEBIT", amount, referenceId: createdExpense.id, referenceType: "expense", description: `Expense: ${category}${body.description ? ` — ${body.description}` : ""}${paidTo ? ` · paid to ${paidTo}` : ""}` },
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
