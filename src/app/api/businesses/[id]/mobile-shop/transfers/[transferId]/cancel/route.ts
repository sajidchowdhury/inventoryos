// POST /api/businesses/[id]/mobile-shop/transfers/[transferId]/cancel
// DRAFT or IN_TRANSIT → CANCELLED: Return items to source
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; transferId: string }> }
) {
  try {
    const { id: businessId, transferId } = await params;

    const transfer = await db.mSTransfer.findFirst({
      where: {
        id: transferId,
        businessId,
        status: { in: ["DRAFT", "IN_TRANSIT"] },
      },
      include: { items: true },
    });

    if (!transfer) {
      return NextResponse.json(
        { error: "Transfer not found or cannot be cancelled (only DRAFT/IN_TRANSIT can be cancelled)" },
        { status: 404 }
      );
    }

    for (const item of transfer.items) {
      const serialItem = await db.mSSerialItem.findFirst({
        where: { id: item.serialItemId, businessId },
        select: { status: true },
      });

      if (!serialItem) continue;

      // If items were sent (IN_TRANSIT), return them to IN_STOCK at source
      if (serialItem.status === "IN_TRANSIT") {
        await db.mSSerialItem.update({
          where: { id: item.serialItemId },
          data: { status: "IN_STOCK" },
        });

        await db.mSSerialItemHistory.create({
          data: {
            businessId,
            serialItemId: item.serialItemId,
            fromStatus: "IN_TRANSIT",
            toStatus: "IN_STOCK",
            event: "TRANSFERRED",
            referenceId: transferId,
            referenceType: "TRANSFER",
            notes: `Transfer ${transfer.transferCode} cancelled — returned to source`,
          },
        });
      }

      // Mark transfer item as returned
      await db.mSTransferItem.update({
        where: { id: item.id },
        data: { status: "RETURNED" },
      });
    }

    // Update transfer
    const updated = await db.mSTransfer.update({
      where: { id: transferId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
      include: {
        fromBranch: { select: { id: true, name: true, code: true } },
        toBranch: { select: { id: true, name: true, code: true } },
        _count: { select: { items: true } },
      },
    });

    // Sync product stock counts (items may have returned to IN_STOCK)
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
    console.error("Cancel transfer error:", error);
    return NextResponse.json({ error: "Failed to cancel transfer" }, { status: 500 });
  }
}