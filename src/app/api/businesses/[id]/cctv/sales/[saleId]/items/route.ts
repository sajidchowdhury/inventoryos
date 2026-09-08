// POST /api/businesses/[id]/cctv/sales/[saleId]/items
// Add a new item to an existing sale (editable invoices)
// Recalculates total, updates due if no new payment
//
// SUB-1: Guarded by requireActiveSubscription — blocked in read_only / data_wiped
// §3 fix: Full rewrite — transactional, atomic stock, serial marking,
//         audit row, ledger entries, invoice discount respected.
//
// Previous bugs (all fixed in this rewrite):
//   1. Not wrapped in $transaction — partial writes on failure
//   2. Stock decrement non-atomic (plain update, no stock >= qty check)
//   3. Serial items not marked SOLD — same serial could be sold twice
//   4. No CCTVStockMovement audit row — Product Movement report missed it
//   5. No ledger entries — books went out of balance
//   6. Invoice discount ignored when recalculating total

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveSubscription } from "@/lib/subscription-guard";
import { createLedgerEntries, LEDGER_ACCOUNTS, paymentMethodToAccount } from "@/lib/ledger-helper";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; saleId: string }> }) {
  const { id: businessId, saleId } = await params;

  // SUB-1: Block writes if subscription is in read_only or data_wiped stage.
  const guard = await requireActiveSubscription(businessId);
  if (!guard.allowed) return guard.error!;

  const body = await req.json();

  if (!body.productName) {
    return NextResponse.json({ error: "Product name is required" }, { status: 400 });
  }

  try {
    // ── §3 fix: Everything in a single transaction ──
    const result = await db.$transaction(async (tx) => {
      // 1. Load the sale (with existing items) inside the transaction
      const sale = await tx.cCTVSale.findFirst({
        where: { id: saleId, businessId },
        include: { items: true },
      });

      if (!sale) {
        throw new Error("Sale not found");
      }

      const quantity = parseInt(body.quantity) || 1;
      const sellPrice = parseFloat(body.sellPrice) || 0;
      const costPrice = parseFloat(body.costPrice) || 0;
      const serialNumber = body.serialNumber || null;
      const productId = body.productId || "unknown";

      // 2. Create the new sale item
      const newItem = await tx.cCTVSaleItem.create({
        data: {
          saleId,
          businessId,
          productId,
          productName: body.productName,
          quantity,
          sellPrice,
          costPrice,
          serialNumber,
        },
      });

      // 3. Handle stock + serial + audit
      if (serialNumber) {
        // ── Serial-tracked item ──
        // Find the serial item (must be IN_STOCK — atomic check)
        const serialItem = await tx.cCTVSerialItem.findFirst({
          where: { businessId, serialNumber, status: "IN_STOCK" },
        });

        if (!serialItem) {
          throw new Error(`Serial ${serialNumber} is not in stock or already sold`);
        }

        // Determine warranty months (same logic as main sale flow)
        let warrantyMonths = body.warrantyMonths || 0;
        if (!warrantyMonths && serialItem.warrantyMonths) {
          warrantyMonths = serialItem.warrantyMonths;
        }
        if (!warrantyMonths && productId !== "unknown") {
          const product = await tx.cCTVProduct.findUnique({
            where: { id: productId },
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
            sellPrice,
            saleDate: new Date(),
            warrantyEnd,
            customerId: sale.customerId || null,
            customerName: sale.customerName || null,
          },
        });

        // Create serial history entry
        await tx.cCTVSerialHistory.create({
          data: {
            businessId,
            serialItemId: serialItem.id,
            serialNumber,
            productId: productId !== "unknown" ? productId : null,
            productName: body.productName,
            eventType: "SOLD",
            description: `Added to sale ${sale.invoiceNo || saleId}${sale.customerName ? ` — ${sale.customerName}` : ""}${warrantyMonths > 0 ? ` · ${warrantyMonths}m warranty` : ""}`,
            referenceId: saleId,
            referenceType: "sale",
            eventDate: new Date(),
          },
        });

        // Decrement product stock by 1 (per §1 fix pattern)
        if (productId !== "unknown") {
          await tx.cCTVProduct.updateMany({
            where: { id: productId, stock: { gte: 1 } },
            data: { stock: { decrement: 1 } },
          });

          // Stock movement audit record
          const productAfter = await tx.cCTVProduct.findUnique({
            where: { id: productId },
            select: { name: true, stock: true },
          });
          await tx.cCTVStockMovement.create({
            data: {
              businessId,
              productId,
              productName: productAfter?.name || body.productName,
              movementType: "SALE",
              quantityChange: -1,
              balanceAfter: productAfter?.stock || 0,
              referenceId: saleId,
              referenceType: "sale",
              notes: `Added to sale ${sale.invoiceNo || saleId} (serial: ${serialNumber})`,
            },
          });
        }
      } else if (productId && productId !== "unknown") {
        // ── Non-serial item with a linked product ──
        // Atomic stock check + decrement (race-safe)
        const updated = await tx.cCTVProduct.updateMany({
          where: { id: productId, stock: { gte: quantity } },
          data: { stock: { decrement: quantity } },
        });

        if (updated.count === 0) {
          const product = await tx.cCTVProduct.findUnique({
            where: { id: productId },
            select: { name: true, stock: true },
          });
          throw new Error(
            `Insufficient stock for ${product?.name || productId}. Available: ${product?.stock || 0}, requested: ${quantity}`
          );
        }

        // Stock movement audit record
        const productAfter = await tx.cCTVProduct.findUnique({
          where: { id: productId },
          select: { name: true, stock: true },
        });
        await tx.cCTVStockMovement.create({
          data: {
            businessId,
            productId,
            productName: productAfter?.name || body.productName,
            movementType: "SALE",
            quantityChange: -quantity,
            balanceAfter: productAfter?.stock || 0,
            referenceId: saleId,
            referenceType: "sale",
            notes: `Added to sale ${sale.invoiceNo || saleId}`,
          },
        });
      }
      // If productId === "unknown" (free-text line item), no stock changes.

      // 4. Recalculate sale total (respecting invoice discount)
      const allItems = [...sale.items, newItem];
      const subtotal = allItems.reduce((sum, item) => sum + (Number(item.sellPrice) * item.quantity), 0);
      const invoiceDiscount = Number(sale.discount) || 0;
      const newTotal = Math.max(0, subtotal - invoiceDiscount);
      const newDue = Math.max(0, newTotal - Number(sale.paidAmount));

      // 5. Update sale totals
      const updatedSale = await tx.cCTVSale.update({
        where: { id: saleId },
        data: {
          subtotal,
          totalAmount: newTotal,
          dueAmount: newDue,
          paymentType: newDue > 0 ? "credit" : "cash",
        },
      });

      // 6. Create ledger entries for the added item's value
      // (The original sale already has ledger entries; we add the delta
      // for the new item so the books stay balanced.)
      const itemRevenue = sellPrice * quantity;
      if (itemRevenue > 0) {
        // Determine payment account: use the sale's original payment method
        // (if known). For credit sales (no payment yet), use receivable.
        const isCreditSale = newDue > 0;
        const ledgerEntries: Parameters<typeof createLedgerEntries>[1] = [];

        // Revenue: CREDIT sales_revenue
        ledgerEntries.push({
          businessId,
          accountId: LEDGER_ACCOUNTS.SALES_REVENUE,
          entryType: "CREDIT" as const,
          amount: itemRevenue,
          referenceId: saleId,
          referenceType: "sale",
          description: `Added item: ${body.productName} (sale ${sale.invoiceNo || saleId})`,
        });

        if (isCreditSale) {
          // Credit sale: DEBIT customer_receivable
          ledgerEntries.push({
            businessId,
            accountId: LEDGER_ACCOUNTS.CUSTOMER_RECEIVABLE,
            entryType: "DEBIT" as const,
            amount: itemRevenue,
            referenceId: saleId,
            referenceType: "sale",
            description: `Receivable for added item — ${sale.customerName || "customer"}`,
          });
        } else {
          // Paid sale: DEBIT the sale's payment method (cash by default)
          // Note: we use "cash" since the original sale's payment method
          // isn't stored on cCTVSale. A future schema change could add it.
          ledgerEntries.push({
            businessId,
            accountId: LEDGER_ACCOUNTS.CASH,
            entryType: "DEBIT" as const,
            amount: itemRevenue,
            referenceId: saleId,
            referenceType: "sale",
            description: `Payment for added item (sale ${sale.invoiceNo || saleId})`,
          });
        }

        await createLedgerEntries(tx, ledgerEntries);
      }

      return { updatedSale, newItem };
    });

    return NextResponse.json({ success: true, sale: result.updatedSale, newItem: result.newItem }, { status: 201 });
  } catch (err: any) {
    console.error("[cctv/sales/[saleId]/items] Transaction failed:", err);
    const msg = err?.message || "Failed to add item to sale";

    // Insufficient stock → 400, not 500
    const status = msg.includes("Insufficient stock") || msg.includes("not in stock") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
