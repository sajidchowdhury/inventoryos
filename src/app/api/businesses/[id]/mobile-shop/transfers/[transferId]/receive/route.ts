// POST /api/businesses/[id]/mobile-shop/transfers/[transferId]/receive
// IN_TRANSIT → RECEIVED: Move serial items to IN_STOCK at destination branch
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; transferId: string }> }
) {
  try {
    const { id: businessId, transferId } = await params;

    const transfer = await db.mSTransfer.findFirst({
      where: { id: transferId, businessId, status: "IN_TRANSIT" },
      include: {
        items: true,
        toBranch: { select: { id: true, name: true } },
      },
    });

    if (!transfer) {
      return NextResponse.json({ error: "Transfer not found or not in IN_TRANSIT status" }, { status: 404 });
    }

    const destBranchName = transfer.toBranch.name;

    for (const item of transfer.items) {
      // Move serial item to IN_STOCK at destination branch
      await db.mSSerialItem.update({
        where: { id: item.serialItemId },
        data: {
          status: "IN_STOCK",
          branchId: transfer.toBranchId,
        },
      });

      // Create history entry
      await db.mSSerialItemHistory.create({
        data: {
          businessId,
          serialItemId: item.serialItemId,
          fromStatus: "IN_TRANSIT",
          toStatus: "IN_STOCK",
          event: "TRANSFERRED",
          referenceId: transferId,
          referenceType: "TRANSFER",
          notes: `Received at ${destBranchName} via ${transfer.transferCode}`,
        },
      });

      // Update transfer item status
      await db.mSTransferItem.update({
        where: { id: item.id },
        data: { status: "RECEIVED" },
      });
    }

    // Update transfer
    const updated = await db.mSTransfer.update({
      where: { id: transferId },
      data: {
        status: "RECEIVED",
        receivedAt: new Date(),
      },
      include: {
        fromBranch: { select: { id: true, name: true, code: true } },
        toBranch: { select: { id: true, name: true, code: true } },
        _count: { select: { items: true } },
      },
    });

    // Sync product stock counts
    const serialItems = await db.mSSerialItem.findMany({
      where: { id: { in: transfer.items.map((i) => i.serialItemId) } },
      select: { productId: true },
    });
    const uniqueProductIds = [...new Set(serialItems.map((si) => si.productId))];

    for (const productId of uniqueProductIds) {
      const inStockCount = await db.mSSerialItem.count({
        where: { productId, businessId, status: "IN_STOCK", isActive: true },
      });
      await db.mSProduct.update({
        where: { id: productId },
        data: { stock: inStockCount },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Receive transfer error:", error);
    return NextResponse.json({ error: "Failed to receive transfer" }, { status: 500 });
  }
}