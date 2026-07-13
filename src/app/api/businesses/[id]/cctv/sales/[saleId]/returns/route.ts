// POST /api/businesses/[id]/cctv/sales/[saleId]/returns
// Phase 2A: CCTV Sales Return Flow
// Creates a return record, restores serial items, adjusts sale totals.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface ReturnItemInput {
  saleItemId: string;
  quantity: number;
  refundAmount: number;
  serialItemId?: string;        // For serial-tracked items — which specific serial
  serialRestoredTo?: string;    // "IN_STOCK" or "RETURNED"
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; saleId: string }> },
) {
  try {
    const { id: businessId, saleId } = await params;
    const body = await req.json();

    const items: ReturnItemInput[] = body.items;
    const refundMethod: string | undefined = body.refundMethod;
    const refundReference: string | undefined = body.refundReference;
    const reason: string | undefined = body.reason;
    const notes: string | undefined = body.notes;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    // Validate refund method if provided
    const VALID_METHODS = ["CASH", "CARD", "BKASH", "NAGAD", "ROCKET", "STORE_CREDIT", "NO_REFUND"];
    if (refundMethod && !VALID_METHODS.includes(refundMethod)) {
      return NextResponse.json({ error: "Invalid refund method" }, { status: 400 });
    }

    // Fetch sale with active items and product info
    const sale = await db.mSSale.findFirst({
      where: { id: saleId, businessId, isActive: true },
      include: {
        items: {
          where: { isActive: true },
          include: {
            product: { select: { id: true, name: true, serialTracked: true } },
            serialItem: { select: { id: true, serialNumber: true, status: true } },
          },
        },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // Validate each return item
    for (const ri of items) {
      if (!ri.saleItemId || ri.quantity <= 0) {
        return NextResponse.json({ error: "Each item needs a valid saleItemId and quantity > 0" }, { status: 400 });
      }
      if (ri.refundAmount < 0) {
        return NextResponse.json({ error: "Refund amount cannot be negative" }, { status: 400 });
      }

      const saleItem = sale.items.find((si) => si.id === ri.saleItemId);
      if (!saleItem) {
        return NextResponse.json({ error: `Sale item ${ri.saleItemId} not found` }, { status: 404 });
      }

      // For serial-tracked items, quantity must be 1
      if (saleItem.serialItemId && ri.quantity !== 1) {
        return NextResponse.json({ error: `Serial-tracked items can only return quantity 1` }, { status: 400 });
      }

      // For serial-tracked items, the provided serialItemId must match
      if (saleItem.serialItemId && ri.serialItemId && ri.serialItemId !== saleItem.serialItemId) {
        return NextResponse.json({ error: `Serial item mismatch for ${saleItem.productName}` }, { status: 400 });
      }

      // For non-serial items, check quantity doesn't exceed original
      if (!saleItem.serialItemId && ri.quantity > saleItem.quantity) {
        return NextResponse.json({
          error: `Cannot return ${ri.quantity} of ${saleItem.productName} (sold: ${saleItem.quantity})`,
        }, { status: 400 });
      }

      // Validate serial item status if provided
      if (saleItem.serialItem && saleItem.serialItem.status !== "SOLD") {
        return NextResponse.json({
          error: `Serial item ${saleItem.serialItem.serialNumber} is not SOLD (current: ${saleItem.serialItem.status})`,
        }, { status: 400 });
      }
    }

    // Check for duplicate saleItemIds in the request
    const saleItemIds = items.map((i) => i.saleItemId);
    if (new Set(saleItemIds).size !== saleItemIds.length) {
      return NextResponse.json({ error: "Duplicate sale items in return request" }, { status: 400 });
    }

    // ── Generate return code ──
    const year = new Date().getFullYear();
    const prefix = `RET-${year}-`;
    const lastReturn = await db.mSReturn.findFirst({
      where: {
        businessId,
        returnCode: { startsWith: prefix },
        isActive: true,
      },
      orderBy: { returnCode: "desc" },
      select: { returnCode: true },
    });

    let seq = 1;
    if (lastReturn) {
      const parts = lastReturn.returnCode.split("-");
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
    const returnCode = `${prefix}${String(seq).padStart(4, "0")}`;

    // ── Execute return in transaction ──
    const result = await db.$transaction(async (tx) => {
      // Create return record
      const returnRecord = await tx.cCTVReturn.create({
        data: {
          businessId,
          saleId,
          returnCode,
          status: "COMPLETED",
          refundMethod: refundMethod || null,
          refundAmount: 0, // will update after calculating
          refundReference: refundReference || null,
          customerName: sale.customerName,
          customerPhone: sale.customerPhone || null,
          reason: reason || null,
          notes: notes || null,
        },
      });

      let totalRefund = 0;
      const createdReturnItems: string[] = [];

      for (const ri of items) {
        const saleItem = sale.items.find((si) => si.id === ri.saleItemId)!;
        const serialRestoredTo = ri.serialRestoredTo || "RETURNED";

        // Create return item
        await tx.cCTVReturnItem.create({
          data: {
            businessId,
            returnId: returnRecord.id,
            saleItemId: ri.saleItemId,
            saleId,
            productId: saleItem.productId,
            productName: saleItem.productName,
            productBrand: saleItem.productBrand || null,
            serialItemId: saleItem.serialItemId || ri.serialItemId || null,
            quantity: ri.quantity,
            unitPrice: saleItem.unitPrice,
            refundAmount: ri.refundAmount,
            serialRestoredTo: saleItem.serialItemId ? serialRestoredTo : null,
          },
        });
        createdReturnItems.push(ri.saleItemId);

        totalRefund += ri.refundAmount;

        // ── Restore serial item ──
        if (saleItem.serialItemId && saleItem.serialItem) {
          await tx.cCTVSerialItem.update({
            where: { id: saleItem.serialItemId },
            data: {
              status: serialRestoredTo,
              saleId: null,
              customerName: null,
              customerPhone: null,
              warrantyStart: null,
              warrantyEnd: null,
            },
          });

          await tx.cCTVSerialItemHistory.create({
            data: {
              businessId,
              serialItemId: saleItem.serialItemId,
              fromStatus: "SOLD",
              toStatus: serialRestoredTo,
              event: "RETURNED",
              referenceId: returnRecord.id,
              referenceType: "RETURN",
              notes: reason
                ? `Returned from ${sale.saleCode}: ${reason}`
                : `Returned from ${sale.saleCode}`,
            },
          });
        }

        // ── Restore stock for non-serial products ──
        if (!saleItem.serialItemId) {
          await tx.cCTVProduct.update({
            where: { id: saleItem.productId },
            data: { stock: { increment: ri.quantity } },
          });
        }
      }

      // Update total refund on return record
      await tx.cCTVReturn.update({
        where: { id: returnRecord.id },
        data: { refundAmount: totalRefund },
      });

      // ── Adjust sale totals ──
      // Recalculate: reduce sale subtotal and totalDue by returned amounts
      const returnedSubtotal = items.reduce((sum, ri) => {
        const si = sale.items.find((s) => s.id === ri.saleItemId)!;
        return sum + (si.unitPrice * ri.quantity);
      }, 0);

      const newSubtotal = Math.max(0, sale.subtotal - returnedSubtotal);
      // Adjust discount proportionally or keep as-is
      const proportion = sale.subtotal > 0 ? newSubtotal / sale.subtotal : 0;
      const newDiscount = sale.subtotal > 0 ? sale.discountAmount * proportion : sale.discountAmount;
      const newTotalDue = Math.max(0, sale.totalDue - totalRefund);

      // If all items returned, mark sale as completed/void
      const allItemsReturned = sale.items.every((si) =>
        createdReturnItems.includes(si.id) && !si.serialItemId
          ? items.find((ri) => ri.saleItemId === si.id)?.quantity === si.quantity
          : createdReturnItems.includes(si.id)
      );

      await tx.cCTVSale.update({
        where: { id: saleId },
        data: {
          subtotal: Math.round(newSubtotal * 100) / 100,
          discountAmount: Math.round(newDiscount * 100) / 100,
          totalDue: Math.round(newTotalDue * 100) / 100,
          // Keep status as-is unless fully returned
          ...(allItemsReturned ? { status: "PENDING", completedAt: null } : {}),
        },
      });

      return { returnRecord, totalRefund, itemsCreated: createdReturnItems.length };
    });

    return NextResponse.json({
      success: true,
      return: {
        id: result.returnRecord.id,
        returnCode: result.returnRecord.returnCode,
        refundAmount: result.totalRefund,
        itemsCreated: result.itemsCreated,
      },
    }, { status: 201 });

  } catch (error) {
    console.error("CCTV Return error:", error);
    return NextResponse.json({ error: "Return failed. Please try again." }, { status: 500 });
  }
}