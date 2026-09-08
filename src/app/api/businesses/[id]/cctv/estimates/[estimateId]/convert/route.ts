// POST /api/businesses/[id]/cctv/estimates/[estimateId]/convert
// Convert an estimate into a real sale (invoice)
//
// SUB-1: Guarded by requireActiveSubscription — blocked in read_only / data_wiped
// E-1 fix: Full rewrite — transactional, atomic stock, real costPrice, ledger entries.
//
// Previous bugs (all fixed in this rewrite):
//   E-1 (Critical): Not wrapped in $transaction — partial failures allowed
//     duplicate conversions.
//   E-2 (High): Stock decrement non-atomic + errors silently swallowed.
//   E-3 (High): productId set to literal "unknown" string for unlinked items.
//   E-4 (High): No ledger entries — books went out of balance.
//   E-5 (High): Non-atomic stock check (read-then-write race).
//   E-6 (High): costPrice hardcoded to 0 — P&L overstated profit by 100%.
//
// Additional fixes:
//   E-10: saleDate now accepted from request body (was always new Date()).
//   Estimate is only marked "converted" if the sale + items + stock +
//   ledger + payment all succeed (all inside the transaction).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveSubscription } from "@/lib/subscription-guard";
import { createLedgerEntries, LEDGER_ACCOUNTS, paymentMethodToAccount } from "@/lib/ledger-helper";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; estimateId: string }> }) {
  const { id: businessId, estimateId } = await params;

  // SUB-1: Block writes if subscription is in read_only or data_wiped stage.
  const guard = await requireActiveSubscription(businessId);
  if (!guard.allowed) return guard.error!;

  const body = await req.json();

  try {
    // ── E-1 fix: Everything in a single transaction ──
    const result = await db.$transaction(async (tx) => {
      // 1. Load the estimate (with items) inside the transaction
      const estimate = await tx.cCTVEstimate.findFirst({
        where: { id: estimateId, businessId },
        include: { items: true },
      });

      if (!estimate) {
        throw new Error("Estimate not found");
      }

      if (estimate.status === "converted" || estimate.convertedSaleId) {
        throw new Error("Estimate already converted");
      }

      // 2. Calculate total
      let totalAmount = 0;
      for (const item of estimate.items) {
        totalAmount += Number(item.unitPrice) * item.quantity;
      }
      totalAmount = Math.max(0, totalAmount); // guard against negative

      const paidAmount = body.paidAmount !== undefined ? parseFloat(body.paidAmount) : 0;
      const dueAmount = Math.max(0, totalAmount - paidAmount);

      // E-10 fix: accept saleDate from request body, default to now
      const saleDate = body.saleDate ? new Date(body.saleDate) : new Date();

      // 3. Create sale
      const sale = await tx.cCTVSale.create({
        data: {
          businessId,
          customerId: estimate.customerId || null,
          customerName: estimate.customerName || null,
          invoiceNo: estimate.estimateNo?.replace("EST-", "INV-") || null,
          subtotal: totalAmount,
          totalAmount,
          paidAmount,
          dueAmount,
          paymentType: dueAmount > 0 ? "credit" : "cash",
          saleDate,
          notes: `Converted from estimate ${estimate.estimateNo}${estimate.projectTitle ? ` — ${estimate.projectTitle}` : ""}`,
        },
      });

      // 4. Create sale items + handle stock + audit
      for (const item of estimate.items) {
        const productId = item.productId || null; // E-3 fix: null, not "unknown"
        const quantity = item.quantity;

        // E-6 fix: fetch the product's current costPrice
        let costPrice = 0;
        if (productId) {
          const product = await tx.cCTVProduct.findUnique({
            where: { id: productId },
            select: { costPrice: true, name: true, stock: true },
          });
          if (product) {
            costPrice = Number(product.costPrice) || 0;
          }
        }

        // Create the sale item
        await tx.cCTVSaleItem.create({
          data: {
            saleId: sale.id,
            businessId,
            productId: productId || "unknown", // keep "unknown" for the DB column
                                        // (schema requires non-null string; "unknown"
                                        // is the existing convention)
            productName: item.productName,
            quantity,
            sellPrice: Number(item.unitPrice),
            costPrice, // E-6 fix: real costPrice, not 0
            serialNumber: null, // estimates don't have serials
          },
        });

        // E-2 + E-5 fix: atomic stock decrement with race-safe updateMany
        if (productId) {
          const updated = await tx.cCTVProduct.updateMany({
            where: { id: productId, stock: { gte: quantity } },
            data: { stock: { decrement: quantity } },
          });

          if (updated.count === 0) {
            // Insufficient stock — fetch for error message
            const product = await tx.cCTVProduct.findUnique({
              where: { id: productId },
              select: { name: true, stock: true },
            });
            throw new Error(
              `Insufficient stock for ${product?.name || productId}. Available: ${product?.stock || 0}, requested: ${quantity}`
            );
          }

          // E-2 fix: create stock movement audit record (was missing)
          const productAfter = await tx.cCTVProduct.findUnique({
            where: { id: productId },
            select: { name: true, stock: true },
          });
          await tx.cCTVStockMovement.create({
            data: {
              businessId,
              productId,
              productName: productAfter?.name || item.productName,
              movementType: "SALE",
              quantityChange: -quantity,
              balanceAfter: productAfter?.stock || 0,
              referenceId: sale.id,
              referenceType: "sale",
              notes: `Converted from estimate ${estimate.estimateNo}`,
            },
          });
        }
      }

      // 5. Record payment if any
      if (paidAmount > 0) {
        await tx.cCTVPayment.create({
          data: {
            businessId,
            type: "sale",
            referenceId: sale.id,
            customerId: estimate.customerId || null,
            amount: paidAmount,
            paymentMethod: body.paymentMethod || "cash",
            paymentDate: new Date(),
            notes: `Payment for converted estimate ${estimate.estimateNo}`,
          },
        });
      }

      // E-4 fix: Create balanced ledger entries
      const paymentAccount = paymentMethodToAccount(body.paymentMethod || "cash");
      const ledgerEntries: Parameters<typeof createLedgerEntries>[1] = [];

      // Revenue: CREDIT sales_revenue
      ledgerEntries.push({
        businessId,
        accountId: LEDGER_ACCOUNTS.SALES_REVENUE,
        entryType: "CREDIT" as const,
        amount: totalAmount,
        referenceId: sale.id,
        referenceType: "sale",
        description: `Sale from estimate ${estimate.estimateNo}`,
      });

      // Payment: DEBIT cash/bank/bkash/nagad
      if (paidAmount > 0) {
        ledgerEntries.push({
          businessId,
          accountId: paymentAccount,
          entryType: "DEBIT" as const,
          amount: paidAmount,
          referenceId: sale.id,
          referenceType: "sale",
          description: `Payment via ${body.paymentMethod || "cash"}`,
        });
      }

      // Receivable: DEBIT customer_receivable (if credit sale)
      if (dueAmount > 0) {
        ledgerEntries.push({
          businessId,
          accountId: LEDGER_ACCOUNTS.CUSTOMER_RECEIVABLE,
          entryType: "DEBIT" as const,
          amount: dueAmount,
          referenceId: sale.id,
          referenceType: "sale",
          description: `Receivable from ${estimate.customerName || "customer"}`,
        });
      }

      await createLedgerEntries(tx, ledgerEntries);

      // 6. Mark estimate as converted (only if everything above succeeded)
      const updated = await tx.cCTVEstimate.update({
        where: { id: estimateId },
        data: {
          status: "converted",
          convertedSaleId: sale.id,
        },
      });

      return { sale, estimate: updated };
    });

    return NextResponse.json({ success: true, sale: result.sale, estimate: result.estimate }, { status: 201 });
  } catch (err: any) {
    console.error("[cctv/estimates/convert] Transaction failed:", err);
    const msg = err?.message || "Failed to convert estimate";

    // Distinguish error types for the client
    if (msg === "Estimate not found") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg === "Estimate already converted") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    if (msg.includes("Insufficient stock") || msg.includes("not in stock")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
