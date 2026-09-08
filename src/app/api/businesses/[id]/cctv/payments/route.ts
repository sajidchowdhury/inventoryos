// POST /api/businesses/[id]/cctv/payments
// Record a payment — customer payment or supplier payment
// PHASE 7: Creates balanced ledger entries + wrapped in $transaction()
// PM-1 fix: referenceId/referenceType now stored + validated.
// PM-3 fix: linked sale/purchase paidAmount/dueAmount now updated.
// PM-4 fix: paymentMethod validated against known enum.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createLedgerEntries, LEDGER_ACCOUNTS, paymentMethodToAccount } from "@/lib/ledger-helper";

// PM-4: valid payment methods
const VALID_PAYMENT_METHODS = new Set(["cash", "bank", "bkash", "nagad"]);

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

  // PM-4: validate paymentMethod
  const paymentMethod = body.paymentMethod || "cash";
  if (!VALID_PAYMENT_METHODS.has(paymentMethod)) {
    return NextResponse.json(
      { error: `Invalid payment method '${paymentMethod}'. Must be one of: cash, bank, bkash, nagad` },
      { status: 400 }
    );
  }

  const isDiscount = body.type === "customer_discount" || body.type === "supplier_discount";
  let storedType = body.type;
  let notes = body.notes || null;
  if (body.type === "customer_discount") {
    storedType = "customer_payment";
    notes = `[DISCOUNT] ${body.notes || "Discount adjusted"}`;
  } else if (body.type === "supplier_discount") {
    storedType = "supplier_payment";
    notes = `[DISCOUNT] ${body.notes || "Discount adjusted"}`;
  }

  // PM-1: extract referenceId + referenceType
  const referenceId = body.referenceId || null;
  const referenceType = body.referenceType || null;

  try {
    const payment = await db.$transaction(async (tx) => {
      const createdPayment = await tx.cCTVPayment.create({
        data: {
          businessId,
          type: storedType,
          customerId: body.customerId || null,
          supplierId: body.supplierId || null,
          amount: parseFloat(body.amount),
          paymentMethod,
          paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
          notes,
          // PM-1: store the reference link so the payment isn't "floating"
          referenceId,
          referenceType,
        },
      });

      // ── PM-3: Update the linked sale/purchase ──
      // When a customer payment has a referenceId pointing to a sale,
      // update that sale's paidAmount (increment) and dueAmount (decrement).
      // Same for supplier payments linked to purchases.
      // This ensures the Sales History list, Due Collection report, and
      // Customer Ledger all show the correct paid/due after a payment.
      const amount = parseFloat(body.amount);

      if (!isDiscount && referenceId) {
        if (storedType === "customer_payment") {
          // Link to a sale — update paidAmount + dueAmount
          // Only if referenceType is "sale" or the sale exists
          const sale = await tx.cCTVSale.findFirst({
            where: { id: referenceId, businessId },
            select: { id: true, paidAmount: true, dueAmount: true, totalAmount: true },
          });
          if (sale) {
            const newPaid = Number(sale.paidAmount) + amount;
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
          // If the sale doesn't exist, the payment is unlinked — that's
          // allowed (the user might be paying against multiple invoices).
        } else if (storedType === "supplier_payment") {
          // Link to a purchase — update paidAmount + dueAmount
          const purchase = await tx.cCTVPurchase.findFirst({
            where: { id: referenceId, businessId },
            select: { id: true, paidAmount: true, dueAmount: true, totalAmount: true },
          });
          if (purchase) {
            const newPaid = Number(purchase.paidAmount) + amount;
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

      // Create balanced ledger entries
      const paymentAccount = paymentMethodToAccount(paymentMethod);
      const isCustomer = storedType === "customer_payment";

      if (isDiscount) {
        // Discount: DEBIT discount_given (customer) or CREDIT supplier_payable (supplier)
        if (isCustomer) {
          // Customer discount: reduces receivable
          // DEBIT discount_given, CREDIT customer_receivable
          await createLedgerEntries(tx, [
            { businessId, accountId: LEDGER_ACCOUNTS.DISCOUNT_GIVEN, entryType: "DEBIT", amount, referenceId: createdPayment.id, referenceType: "payment", description: `Customer discount` },
            { businessId, accountId: LEDGER_ACCOUNTS.CUSTOMER_RECEIVABLE, entryType: "CREDIT", amount, referenceId: createdPayment.id, referenceType: "payment", description: `Discount reduces receivable` },
          ]);
        } else {
          // Supplier discount: reduces payable
          // DEBIT supplier_payable, CREDIT discount_given (contra-revenue)
          await createLedgerEntries(tx, [
            { businessId, accountId: LEDGER_ACCOUNTS.SUPPLIER_PAYABLE, entryType: "DEBIT", amount, referenceId: createdPayment.id, referenceType: "payment", description: `Supplier discount reduces payable` },
            { businessId, accountId: LEDGER_ACCOUNTS.DISCOUNT_GIVEN, entryType: "CREDIT", amount, referenceId: createdPayment.id, referenceType: "payment", description: `Discount received from supplier` },
          ]);
        }
      } else {
        // Regular payment
        if (isCustomer) {
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
