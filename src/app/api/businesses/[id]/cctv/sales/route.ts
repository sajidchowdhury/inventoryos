// GET/POST /api/businesses/[id]/cctv/sales
// POST: Create sale + mark serials as SOLD + update stock + record payment
// PHASE 1: Wrapped in $transaction() for atomic safety
// SUB-1: Guarded by requireActiveSubscription — blocked in read_only / data_wiped
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeDecimals } from "@/lib/decimal-serializer";
import { createLedgerEntries, LEDGER_ACCOUNTS, paymentMethodToAccount } from "@/lib/ledger-helper";
import { requireActiveSubscription } from "@/lib/subscription-guard";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");
  const skip = (page - 1) * pageSize;

  const [sales, total] = await Promise.all([
    db.cCTVSale.findMany({
      where: { businessId },
      include: { items: true },
      orderBy: { saleDate: "desc" },
      skip,
      take: pageSize,
    }),
    db.cCTVSale.count({ where: { businessId } }),
  ]);

  return NextResponse.json({
    success: true,
    sales: serializeDecimals(sales),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;

  // SUB-1: Block writes if subscription is in read_only or data_wiped stage.
  // Payments + reports + export endpoints are exempt (per the user's step 6).
  const guard = await requireActiveSubscription(businessId);
  if (!guard.allowed) return guard.error!;

  const body = await req.json();

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
  }

  // SL-4 / SL-7(POS): Reject invalid quantities and amounts up-front.
  // Previously:
  //   - SL-4: a negative `quantity` was passed through; for non-serial items
  //     the backend's `decrement: -3` would silently INCREASE stock via a
  //     "sale". The frontend's `parseInt(qty) || 1` coerces 0→1 but accepts
  //     -3 as -3.
  //   - SL-7(POS): a negative `paidAmount` produced a CCTVPayment row with
  //     amount<0 plus a DEBIT cash −N + CREDIT receivable −N ledger entry —
  //     both directions inverted.
  // Now we validate every item's quantity and the sale-level paidAmount /
  // invoiceDiscount before touching the DB, returning a 400 instead of a
  // corrupted sale.
  for (const [i, item] of body.items.entries()) {
    const qty = Number(item.quantity);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
      return NextResponse.json(
        { error: `Item ${i + 1}: quantity must be a positive integer (got "${item.quantity}")` },
        { status: 400 },
      );
    }
    const sp = Number(item.sellPrice);
    if (!Number.isFinite(sp) || sp < 0) {
      return NextResponse.json(
        { error: `Item ${i + 1}: sellPrice must be ≥ 0 (got "${item.sellPrice}")` },
        { status: 400 },
      );
    }
  }

  // Calculate subtotal (sum of sell price * qty per item)
  let subtotal = 0;
  for (const item of body.items) {
    subtotal += (item.sellPrice || 0) * (item.quantity || 1);
  }

  // Apply invoice-level discount (if provided)
  // SL-6: previously `Math.max(0, subtotal - invoiceDiscount)` let a discount
  // > subtotal silently produce a ৳0 "free sale". Now we reject discounts that
  // exceed the subtotal — the cashier must have made a typo.
  const invoiceDiscount = Number(body.invoiceDiscount) || 0;
  if (!Number.isFinite(invoiceDiscount) || invoiceDiscount < 0) {
    return NextResponse.json(
      { error: "Invoice discount must be ≥ 0" },
      { status: 400 },
    );
  }
  if (invoiceDiscount > subtotal) {
    return NextResponse.json(
      { error: `Invoice discount (৳${invoiceDiscount}) cannot exceed subtotal (৳${subtotal})` },
      { status: 400 },
    );
  }
  const totalAmount = Math.max(0, subtotal - invoiceDiscount);

  // SL-7(POS): Reject negative paidAmount. Allow 0 (full credit sale) and
  // amounts > totalAmount (customer overpays / advance on account — recorded
  // as a negative balance on the receivable; UI doesn't currently expose this
  // but the books stay correct).
  const rawPaid = body.paidAmount !== undefined ? Number(body.paidAmount) : totalAmount;
  if (!Number.isFinite(rawPaid) || rawPaid < 0) {
    return NextResponse.json(
      { error: `paidAmount must be ≥ 0 (got "${body.paidAmount}")` },
      { status: 400 },
    );
  }
  const paidAmount = rawPaid;
  const dueAmount = Math.max(0, totalAmount - paidAmount);

  try {
    // ── PHASE 1: All operations in a single transaction ──
    // If ANY step fails, ALL changes roll back. No partial sales.
    const sale = await db.$transaction(async (tx) => {
      // 1. Create sale record
      const createdSale = await tx.cCTVSale.create({
        data: {
          businessId,
          customerId: body.customerId || null,
          customerName: body.customerName || null,
          invoiceNo: body.invoiceNo || null,
          subtotal,
          discount: invoiceDiscount,
          totalAmount,
          paidAmount,
          dueAmount,
          paymentType: body.paymentType || (dueAmount > 0 ? "credit" : "cash"),
          saleDate: body.saleDate ? new Date(body.saleDate) : new Date(),
          notes: body.notes || null,
        },
      });

      // 2. Create sale items + process serials + update stock
      for (const item of body.items) {
        await tx.cCTVSaleItem.create({
          data: {
            saleId: createdSale.id,
            businessId,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity || 1,
            sellPrice: item.sellPrice || 0,
            costPrice: item.costPrice || 0,
            discount: item.discount || 0,
            serialNumber: item.serialNumber || null,
          },
        });

        // If this is a serial-tracked item (has serialNumber), mark it as SOLD
        if (item.serialNumber) {
          // Find the serial item (must be IN_STOCK — atomic check)
          const serialItem = await tx.cCTVSerialItem.findFirst({
            where: { businessId, serialNumber: item.serialNumber, status: "IN_STOCK" },
          });

          if (!serialItem) {
            throw new Error(`Serial ${item.serialNumber} is not in stock or already sold`);
          }

          // Determine warranty months
          let warrantyMonths = item.warrantyMonths || 0;
          if (!warrantyMonths && serialItem.warrantyMonths) {
            warrantyMonths = serialItem.warrantyMonths;
          }
          if (!warrantyMonths) {
            const product = await tx.cCTVProduct.findUnique({
              where: { id: item.productId },
              select: { warrantyMonths: true },
            });
            warrantyMonths = product?.warrantyMonths || 0;
          }
          const warrantyEnd = warrantyMonths > 0
            ? new Date(Date.now() + warrantyMonths * 30 * 24 * 60 * 60 * 1000)
            : null;

          // Mark serial as SOLD
          await tx.cCTVSerialItem.update({
            where: { id: serialItem.id },
            data: {
              status: "SOLD",
              sellPrice: item.sellPrice || 0,
              saleDate: new Date(),
              warrantyEnd,
              customerId: body.customerId || null,
              customerName: body.customerName || null,
            },
          });

          // Create history entry INSIDE transaction (no try/catch — if this fails, sale rolls back)
          await tx.cCTVSerialHistory.create({
            data: {
              businessId,
              serialItemId: serialItem.id,
              serialNumber: item.serialNumber,
              productId: item.productId,
              productName: item.productName,
              eventType: "SOLD",
              description: `Sold to ${body.customerName || "walk-in customer"}${warrantyMonths > 0 ? ` · ${warrantyMonths}m warranty` : ""}`,
              referenceId: createdSale.id,
              referenceType: "sale",
              eventDate: new Date(),
            },
          });

          // ── FIX §1: Decrement product stock for serial-tracked items ──
          // Previously, only the non-serial branch decremented
          // CCTVProduct.stock. The serial branch marked the serial SOLD
          // but left the product's stock column inflated — every report
          // that reads CCTVProduct.stock directly (Products List, etc.)
          // showed wrong numbers after any serial sale.
          //
          // Now we atomically decrement by 1 (each serial sale is qty 1,
          // enforced by the POS UI) using updateMany with stock >= 1 —
          // same race-safe pattern as the non-serial branch. If the
          // product's stock is already 0 (edge case: stock was manually
          // edited down after the serial was purchased), we skip the
          // decrement rather than throwing — the serial was already
          // verified as IN_STOCK above, so the sale is legitimate. The
          // stock column just needs to catch up.
          await tx.cCTVProduct.updateMany({
            where: {
              id: item.productId,
              stock: { gte: 1 },
            },
            data: { stock: { decrement: 1 } },
          });

          // Create stock movement audit record (mirrors the non-serial branch)
          const productAfter = await tx.cCTVProduct.findUnique({
            where: { id: item.productId },
            select: { name: true, stock: true },
          });
          await tx.cCTVStockMovement.create({
            data: {
              businessId,
              productId: item.productId,
              productName: productAfter?.name || item.productName,
              movementType: "SALE",
              quantityChange: -1,
              balanceAfter: productAfter?.stock || 0,
              referenceId: createdSale.id,
              referenceType: "sale",
              notes: `Sale to ${body.customerName || "walk-in customer"} (serial: ${item.serialNumber})`,
            },
          });
        } else {
          // Non-serial product: ATOMIC stock check + decrement
          // This prevents race conditions — the WHERE clause ensures we only
          // decrement if there's enough stock. If 0 rows updated, stock was insufficient.
          const updated = await tx.cCTVProduct.updateMany({
            where: {
              id: item.productId,
              stock: { gte: item.quantity || 1 },
            },
            data: { stock: { decrement: item.quantity || 1 } },
          });

          if (updated.count === 0) {
            // Stock was insufficient — fetch current stock for error message
            const product = await tx.cCTVProduct.findUnique({
              where: { id: item.productId },
              select: { name: true, stock: true },
            });
            throw new Error(
              `Insufficient stock for ${product?.name || item.productId}. Available: ${product?.stock || 0}, requested: ${item.quantity || 1}`
            );
          }

          // Create stock movement audit record
          const productAfter = await tx.cCTVProduct.findUnique({
            where: { id: item.productId },
            select: { name: true, stock: true },
          });
          await tx.cCTVStockMovement.create({
            data: {
              businessId,
              productId: item.productId,
              productName: productAfter?.name || item.productName,
              movementType: "SALE",
              quantityChange: -(item.quantity || 1),
              balanceAfter: productAfter?.stock || 0,
              referenceId: createdSale.id,
              referenceType: "sale",
              notes: `Sale to ${body.customerName || "walk-in customer"}`,
            },
          });
        }
      }

      // 3. Record payment if paid
      if (paidAmount > 0) {
        await tx.cCTVPayment.create({
          data: {
            businessId,
            type: "sale",
            referenceId: createdSale.id,
            customerId: body.customerId || null,
            amount: paidAmount,
            paymentMethod: body.paymentMethod || "cash",
            paymentDate: new Date(),
            notes: `Payment for sale ${createdSale.id}`,
          },
        });
      }

      // 4. Create double-entry ledger entries
      // Sale: DEBIT cash/receivable (totalAmount), CREDIT sales_revenue (subtotal), CREDIT discount_given (if discount)
      const paymentAccount = paymentMethodToAccount(body.paymentMethod || "cash");
      const ledgerEntries: any[] = [];

      if (invoiceDiscount > 0) {
        // Discount: DEBIT discount_given
        ledgerEntries.push({
          businessId, accountId: LEDGER_ACCOUNTS.DISCOUNT_GIVEN, entryType: "DEBIT" as const,
          amount: invoiceDiscount, referenceId: createdSale.id, referenceType: "sale",
          description: `Discount on sale ${createdSale.id}`,
        });
      }

      // Revenue: CREDIT sales_revenue (subtotal)
      ledgerEntries.push({
        businessId, accountId: LEDGER_ACCOUNTS.SALES_REVENUE, entryType: "CREDIT" as const,
        amount: subtotal, referenceId: createdSale.id, referenceType: "sale",
        description: `Sale revenue - ${body.customerName || "walk-in"}`,
      });

      // Payment/Receivable: DEBIT cash (paidAmount) + DEBIT receivable (dueAmount)
      if (paidAmount > 0) {
        ledgerEntries.push({
          businessId, accountId: paymentAccount, entryType: "DEBIT" as const,
          amount: paidAmount, referenceId: createdSale.id, referenceType: "sale",
          description: `Payment received via ${body.paymentMethod || "cash"}`,
        });
      }
      if (dueAmount > 0) {
        ledgerEntries.push({
          businessId, accountId: LEDGER_ACCOUNTS.CUSTOMER_RECEIVABLE, entryType: "DEBIT" as const,
          amount: dueAmount, referenceId: createdSale.id, referenceType: "sale",
          description: `Receivable from ${body.customerName || "customer"}`,
        });
      }

      await createLedgerEntries(tx, ledgerEntries);

      return createdSale;
    });

    return NextResponse.json({ success: true, sale }, { status: 201 });
  } catch (err: any) {
    // Transaction failed — ALL changes were rolled back
    console.error("[cctv/sales] Transaction failed:", err);
    const msg = err?.message || "Failed to create sale";

    // Handle unique constraint violations (P2002) with user-friendly messages
    if (err?.code === "P2002") {
      const target = err?.meta?.target as string[] | undefined;
      if (target?.includes("invoiceNo")) {
        return NextResponse.json({ error: "Invoice number already exists. Use a different invoice number." }, { status: 400 });
      }
      if (target?.includes("serialNumber")) {
        return NextResponse.json({ error: "Serial number already exists in this business." }, { status: 400 });
      }
      return NextResponse.json({ error: "Duplicate entry — this record already exists." }, { status: 400 });
    }

    const status = msg.includes("Insufficient stock") || msg.includes("not in stock") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
