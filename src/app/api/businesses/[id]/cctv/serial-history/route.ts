// GET /api/businesses/[id]/cctv/serial-history?search=xxx
// Search serial items by serial number, return matching items with full history timeline.
// If no search query, return recent history entries (latest 50).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") || "").trim();

  // If search query provided, find matching serial items + their history
  if (search) {
    // Find serial items matching the search (case-insensitive contains)
    const serialItems = await db.cCTVSerialItem.findMany({
      where: {
        businessId,
        serialNumber: { contains: search, mode: "insensitive" },
      },
      include: {
        product: {
          select: { id: true, name: true, brand: true, model: true, warrantyMonths: true },
        },
      },
      take: 20,
      orderBy: { createdAt: "desc" },
    });

    // For each serial item, fetch its full history timeline
    const results = await Promise.all(
      serialItems.map(async (item) => {
        const history = await db.cCTVSerialHistory.findMany({
          where: {
            businessId,
            OR: [
              { serialItemId: item.id },
              { serialNumber: item.serialNumber },
            ],
          },
          orderBy: { eventDate: "desc" },
        });

        // Check if this serial was replaced by another (i.e. it has a replacement)
        const replacement = await db.cCTVSupplierReplacement.findFirst({
          where: {
            businessId,
            originalSerialItemId: item.id,
          },
          orderBy: { createdAt: "desc" },
        });

        // Check if this serial is itself a replacement for another serial
        const isReplacementFor = item.replacesSerialId
          ? await db.cCTVSerialItem.findUnique({
              where: { id: item.replacesSerialId },
              select: { id: true, serialNumber: true, status: true },
            })
          : null;

        return {
          ...item,
          history,
          replacement,
          isReplacementFor,
        };
      })
    );

    return NextResponse.json({
      success: true,
      search,
      results,
      count: results.length,
    });
  }

  // No search — return recent history entries
  const recentHistory = await db.cCTVSerialHistory.findMany({
    where: { businessId },
    orderBy: { eventDate: "desc" },
    take: 50,
    include: {
      serialItem: {
        select: { id: true, status: true, productId: true },
      },
    },
  });

  return NextResponse.json({
    success: true,
    recentHistory,
    count: recentHistory.length,
  });
}
