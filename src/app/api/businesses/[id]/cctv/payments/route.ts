// POST /api/businesses/[id]/cctv/payments
// Record a payment — customer payment or supplier payment
// PHASE 7: Creates balanced ledger entries + wrapped in $transaction()
// PM-1 fix: referenceId/referenceType now stored + validated.
// PM-3 fix: linked sale/purchase paidAmount/dueAmount now updated.
// PM-4 fix: paymentMethod validated against known enum.
// PM-5 fix: discounts now stored with type='customer_discount'/'supplier_discount'
//   (was remapped to 'customer_payment' + notes='[DISCOUNT] ...'). The UI
//   can now filter by type directly without parsing the notes prefix.
// PM-7 fix: paymentMethod enum expanded to include 'card' and 'cheque'.
// PM-8 fix: accepts an `allocations` array to split a single payment across
//   multiple sales/purchases. Each allocation has { referenceId, referenceType, amount }.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createLedgerEntries, LEDGER_ACCOUNTS, paymentMethodToAccount } from "@/lib/ledger-helper";

// PM-4 + PM-7: valid payment methods. Added 'card' (POS terminal) and
// 'cheque' for Bangladesh CCTV shops that take those.
const VALID_PAYMENT_METHODS = new Set(["cash", "bank", "bkash", "nagad", "card", "cheque"]);

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const partyId = searchParams.get("partyId");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { businessId };
  if (type) where.type = type;
  if (partyId) {
    where.OR = [
      { customerId: partyId },
      { supplierId: partyId },
    ];
  }

  const [payments, total] = await Promise.all([
    db.cCTVPayment.findMany({
      where,
      orderBy: { paymentDate: "desc" },
      skip,
      take: pageSize,
    }),
    db.cCTVPayment.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    payments,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const body = await req.json();

  if (!body.amount || body.amount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
  }

  if (!body.type) {
    return NextResponse.json({ error: "Payment type is required (customer_payment, supplier_payment, customer_discount, supplier_discount)" }, { status: 400 });
  }

  // PM-4 + PM-7: validate paymentMethod
  const paymentMethod = body.paymentMethod || "cash";
  if (!VALID_PAYMENT_METHODS.has(paymentMethod)) {
    return NextResponse.json(
      { error: `Invalid payment method '${paymentMethod}'. Must be one of: cash, bank, bkash, nagad, card, cheque` },
      { status: 400 }
    );
  }

  const isDiscount = body.type === "customer_discount" || body.type === "supplier_discount";
  // PM-5: store the discount type directly (was remapping to 'customer_payment'
  // + notes='[DISCOUNT] ...'). The UI can now filter by type without parsing.
  const storedType = body.type;
  const notes = body.notes || null;

  // PM-1: extract referenceId + referenceType (single-link, for backward compat)
  const referenceId = body.referenceId || null;
  const referenceType = body.referenceType || null;

  // PM-8: partial allocation. If `allocations` is provided, it's an array of
  // { referenceId, referenceType, amount }. The sum of allocation amounts
  // must equal the total payment amount. We validate this up-front.
  const allocations: { referenceId: string; referenceType: string; amount: number }[] = Array.isArray(body.allocations) ? body.allocations : [];
  if (allocations.length > 0) {
    const allocSum = allocations.reduce((s, a) => s + Number(a.amount), 0);
    if (Math.abs(allocSum - parseFloat(body.amount)) > 0.01) {
      return NextResponse.json(
        { error: `Allocation total (৳${allocSum}) does not match payment amount (৳${body.amount})` },
        { status: 400 },
      );
    }
    for (const a of allocations) {
      if (!a.referenceId || !a.referenceType || !a.amount || a.amount <= 0) {
        return NextResponse.json(
          { error: "Each allocation must have referenceId, referenceType, and a positive amount" },
          { status: 400 },
        );
      }
    }
  }

  try {
    const payment = await db.$transaction(async (tx) => {
      const createdPayment = await tx.cCTVPayment.create({
        data: {
          businessId,
          type: storedType,  // PM-5: store the actual type (customer_discount, etc.)
          customerId: body.customerId || null,
          supplierId: body.supplierId || null,
          amount: parseFloat(body.amount),
          paymentMethod,
          paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
          notes,
          // PM-1: store the reference link so the payment isn't "floating"
          // PM-8: if allocations exist, the primary referenceId is the first
          // allocation (so the payment row still has a link). The remaining
          // allocations are applied below in the loop.
          referenceId: allocations.length > 0 ? allocations[0].referenceId : referenceId,
          referenceType: allocations.length > 0 ? allocations[0].referenceType : referenceType,
        },
      });

      // ── PM-3 + PM-8: Update linked sale(s)/purchase(s) ──
      const amount = parseFloat(body.amount);

      if (!isDiscount) {
        // Build the list of references to apply: either the allocations
        // array (PM-8) or a single reference (PM-1/PM-3).
        const refsToApply = allocations.length > 0
          ? allocations
          : (referenceId ? [{ referenceId, referenceType, amount }] : []);

        for (const ref of refsToApply) {
          if (storedType === "customer_payment") {
            // Link to a sale — update paidAmount + dueAmount
            const sale = await tx.cCTVSale.findFirst({
              where: { id: ref.referenceId, businessId },
              select: { id: true, paidAmount: true, dueAmount: true, totalAmount: true },
            });
            if (sale) {
              const newPaid = Number(sale.paidAmount) + Number(ref.amount);
              const newDue = Math.max(0, Number(sale.totalAmount) - newPaid);
              await tx.cCTVSale.update({
                where: { id: sale.id },
                data: {
                  paidAmount: newPaid,
                  dueAmount: newDue,
                  paymentType: newDue > 0 ? "credit" : "cash",
                },
              });
            }
          } else if (storedType === "supplier_payment") {
            // Link to a purchase — update paidAmount + dueAmount
            const purchase = await tx.cCTVPurchase.findFirst({
              where: { id: ref.referenceId, businessId },
              select: { id: true, paidAmount: true, dueAmount: true, totalAmount: true },
            });
            if (purchase) {
              const newPaid = Number(purchase.paidAmount) + Number(ref.amount);
              const newDue = Math.max(0, Number(purchase.totalAmount) - newPaid);
              await tx.cCTVPurchase.update({
                where: { id: purchase.id },
                data: {
                  paidAmount: newPaid,
                  dueAmount: newDue,
                },
              });
            }
          }
        }
      }

      // Create balanced ledger entries
      const paymentAccount = paymentMethodToAccount(paymentMethod);
      const isCustomer = storedType === "customer_payment";
      const isCustomerDiscount = storedType === "customer_discount";
      const isSupplierDiscount = storedType === "supplier_discount";

      if (isCustomerDiscount) {
        // Customer discount: reduces receivable
        // DEBIT discount_given, CREDIT customer_receivable
        await createLedgerEntries(tx, [
          { businessId, accountId: LEDGER_ACCOUNTS.DISCOUNT_GIVEN, entryType: "DEBIT", amount, referenceId: createdPayment.id, referenceType: "payment", description: `Customer discount` },
          { businessId, accountId: LEDGER_ACCOUNTS.CUSTOMER_RECEIVABLE, entryType: "CREDIT", amount, referenceId: createdPayment.id, referenceType: "payment", description: `Discount reduces receivable` },
        ]);
      } else if (isSupplierDiscount) {
        // Supplier discount: reduces payable
        // DEBIT supplier_payable, CREDIT discount_given (contra-revenue)
        await createLedgerEntries(tx, [
          { businessId, accountId: LEDGER_ACCOUNTS.SUPPLIER_PAYABLE, entryType: "DEBIT", amount, referenceId: createdPayment.id, referenceType: "payment", description: `Supplier discount reduces payable` },
          { businessId, accountId: LEDGER_ACCOUNTS.DISCOUNT_GIVEN, entryType: "CREDIT", amount, referenceId: createdPayment.id, referenceType: "payment", description: `Discount received from supplier` },
        ]);
      } else if (isCustomer) {
        // Customer payment: DEBIT cash, CREDIT customer_receivable
        await createLedgerEntries(tx, [
          { businessId, accountId: paymentAccount, entryType: "DEBIT", amount, referenceId: createdPayment.id, referenceType: "payment", description: `Customer payment via ${paymentMethod}` },
          { businessId, accountId: LEDGER_ACCOUNTS.CUSTOMER_RECEIVABLE, entryType: "CREDIT", amount, referenceId: createdPayment.id, referenceType: "payment", description: `Reduces customer receivable` },
        ]);
      } else {
        // Supplier payment: DEBIT supplier_payable, CREDIT cash
        await createLedgerEntries(tx, [
          { businessId, accountId: LEDGER_ACCOUNTS.SUPPLIER_PAYABLE, entryType: "DEBIT", amount, referenceId: createdPayment.id, referenceType: "payment", description: `Reduces supplier payable` },
          { businessId, accountId: paymentAccount, entryType: "CREDIT", amount, referenceId: createdPayment.id, referenceType: "payment", description: `Supplier payment via ${paymentMethod}` },
        ]);
      }

      return createdPayment;
    });

    return NextResponse.json({ success: true, payment }, { status: 201 });
  } catch (err: any) {
    console.error("[cctv/payments] Transaction failed:", err);
    const msg = err?.message || "Failed to record payment";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
