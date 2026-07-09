// GET /api/businesses/[id]/cctv/serial-items/[serialItemId]
// Get a single serial item with product info and history
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; serialItemId: string }> }
) {
  try {
    const { id: businessId, serialItemId } = await params;

    const item = await db.cCTVSerialItem.findFirst({
      where: { id: serialItemId, businessId, isActive: true },
      include: {
        product: {
          select: { id: true, name: true, brand: true, model: true, sku: true, imageUrl: true, sellPrice: true, costPrice: true },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Serial item not found" }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error("Get serial item error:", error);
    return NextResponse.json({ error: "Failed to get serial item" }, { status: 500 });
  }
}