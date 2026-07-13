// POST /api/businesses/[id]/cctv/transfers/[transferId]/send
// DRAFT → IN_TRANSIT: Move serial items from IN_STOCK to IN_TRANSIT
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; transferId: string }> }
) {
  try {
    const { id: businessId, transferId } = await params;

    const transfer = await db.mSTransfer.findFirst({
      where: { id: transferId, businessId, status: "DRAFT" },
      include: { items: true },
    });

    if (!transfer) {
      return NextResponse.json({ error: "Transfer not found or not in DRAFT status" }, { status: 404 });
    }

    // Move all serial items to IN_TRANSIT
    for (const item of transfer.items) {
      await db.mSSerialItem.update({
        where: { id: item.serialItemId },
        data: { status: "IN_TRANSIT" },
      });

      // Create history entry
      await db.mSSerialItemHistory.create({
        data: {
          businessId,
          serialItemId: item.serialItemId,
          fromStatus: "IN_STOCK",
          toStatus: "IN_TRANSIT",
          event: "TRANSFERRED",
          referenceId: transferId,
          referenceType: "TRANSFER",
          notes: `Sent via ${transfer.transferCode} to ${transfer.toBranchId}`,
        },
      });
    }

    // Update transfer status
    const updated = await db.mSTransfer.update({
      where: { id: transferId },
      data: { status: "IN_TRANSIT" },
      include: {
        fromBranch: { select: { id: true, name: true, code: true } },
        toBranch: { select: { id: true, name: true, code: true } },
        _count: { select: { items: true } },
      },
    });

    // Sync product stock counts
    const affectedProductIds = transfer.items.map((i) => i.serialItemId);
    const serialItems = await db.mSSerialItem.findMany({
      where: { id: { in: affectedProductIds } },
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
    console.error("Send transfer error:", error);
    return NextResponse.json({ error: "Failed to send transfer" }, { status: 500 });
  }
}