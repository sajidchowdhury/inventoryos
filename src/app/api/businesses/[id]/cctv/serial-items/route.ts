// GET /api/businesses/[id]/cctv/serial-items
// Search serial items by serial number (for sales: type serial -> find product)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";

  const where: Record<string, unknown> = { businessId };
  if (status) where.status = status;
  if (search) {
    where.serialNumber = { contains: search, mode: "insensitive" };
  }

  const items = await db.cCTVSerialItem.findMany({
    where,
    include: {
      product: { select: { id: true, name: true, brand: true, sellPrice: true, costPrice: true, warrantyMonths: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ success: true, items });
}
