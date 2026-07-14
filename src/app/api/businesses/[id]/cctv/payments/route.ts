// POST /api/businesses/[id]/cctv/payments
// Record a payment — customer payment or supplier payment
// PHASE 7: Creates balanced ledger entries + wrapped in $transaction()
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createLedgerEntries, LEDGER_ACCOUNTS, paymentMethodToAccount } from "@/lib/ledger-helper";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const partyId = searchParams.get("partyId");

  const where: Record<string, unknown> = { businessId };
  if (type) where.type = type;
  if (partyId) {
    where.OR = [
      { customerId: partyId },
      { supplierId: partyId },
    ];
  }

  const payments = await db.cCTVPayment.findMany({
    where,
    orderBy: { paymentDate: "desc" },
    take: 50,
  });

  return NextResponse.json({ success: true, payments });
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

  try {
    const payment = await db.$transaction(async (tx) => {
      const createdPayment = await tx.cCTVPayment.create({
        data: {
          businessId,
          type: storedType,
          customerId: body.customerId || null,
          supplierId: body.supplierId || null,
          amount: parseFloat(body.amount),
          paymentMethod: body.paymentMethod || "cash",
          paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
          notes,
        },
      });

      // Create balanced ledger entries
      const amount = parseFloat(body.amount);
      const paymentAccount = paymentMethodToAccount(body.paymentMethod || "cash");
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
            { businessId, accountId: paymentAccount, entryType: "DEBIT", amount, referenceId: createdPayment.id, referenceType: "payment", description: `Customer payment via ${body.paymentMethod || "cash"}` },
            { businessId, accountId: LEDGER_ACCOUNTS.CUSTOMER_RECEIVABLE, entryType: "CREDIT", amount, referenceId: createdPayment.id, referenceType: "payment", description: `Reduces customer receivable` },
          ]);
        } else {
          // Supplier payment: DEBIT supplier_payable, CREDIT cash
          await createLedgerEntries(tx, [
            { businessId, accountId: LEDGER_ACCOUNTS.SUPPLIER_PAYABLE, entryType: "DEBIT", amount, referenceId: createdPayment.id, referenceType: "payment", description: `Reduces supplier payable` },
            { businessId, accountId: paymentAccount, entryType: "CREDIT", amount, referenceId: createdPayment.id, referenceType: "payment", description: `Supplier payment via ${body.paymentMethod || "cash"}` },
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
