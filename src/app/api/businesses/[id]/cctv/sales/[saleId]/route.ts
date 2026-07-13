// GET/DELETE /api/businesses/[id]/cctv/sales/[saleId]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: Single sale with items (include product) and payments
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; saleId: string }> },
) {
  try {
    const { id: businessId, saleId } = await params;

    const sale = await db.mSSale.findFirst({
      where: { id: saleId, businessId, isActive: true },
      include: {
        items: {
          where: { isActive: true },
          include: {
            product: { select: { id: true, name: true, brand: true, imageUrl: true, serialTracked: true } },
            serialItem: { select: { id: true, serialNumber: true, imei: true, status: true, grade: true } },
            kit: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        payments: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    return NextResponse.json(sale);
  } catch (error) {
    console.error("Get sale error:", error);
    return NextResponse.json({ error: "Failed to get sale" }, { status: 500 });
  }
}

// DELETE: Soft-delete sale, items, payments, restore serial items
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; saleId: string }> },
) {
  try {
    const { id: businessId, saleId } = await params;

    const sale = await db.mSSale.findFirst({
      where: { id: saleId, businessId, isActive: true },
      include: {
        items: {
          where: { isActive: true },
          include: {
            serialItem: { select: { id: true, status: true, productId: true } },
            product: { select: { id: true, serialTracked: true } },
          },
        },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      // Soft-delete all active payments
      await tx.cCTVPayment.updateMany({
        where: { saleId, businessId, isActive: true },
        data: { isActive: false },
      });

      // Process each sale item
      for (const item of sale.items) {
        // Soft-delete the item
        await tx.cCTVSaleItem.update({
          where: { id: item.id },
          data: { isActive: false },
        });

        // Restore serial item if it was sold via this sale
        if (item.serialItem && item.serialItem.status === "SOLD") {
          await tx.cCTVSerialItem.update({
            where: { id: item.serialItem.id },
            data: {
              status: "IN_STOCK",
              saleId: null,
              customerName: null,
              customerPhone: null,
            },
          });

          await tx.cCTVSerialItemHistory.create({
            data: {
              businessId,
              serialItemId: item.serialItem.id,
              fromStatus: "SOLD",
              toStatus: "IN_STOCK",
              event: "RETURNED",
              referenceId: saleId,
              referenceType: "SALE",
              notes: `Sale ${sale.saleCode} deleted — item returned to stock`,
            },
          });
        }

        // Restore stock for non-serial-tracked products
        if (!item.product.serialTracked) {
          await tx.cCTVProduct.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      // Soft-delete the sale
      await tx.cCTVSale.update({
        where: { id: saleId },
        data: { isActive: false, completedAt: null },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete sale error:", error);
    return NextResponse.json({ error: "Failed to delete sale" }, { status: 500 });
  }
}