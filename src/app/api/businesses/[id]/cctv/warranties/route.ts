// GET /api/businesses/[id]/cctv/warranties
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function computeWarrantyStatus(warrantyEnd: Date, now: Date, expiringDays: number) {
  const endMs = warrantyEnd.getTime();
  const nowMs = now.getTime();
  const expiringThreshold = nowMs + expiringDays * MS_PER_DAY;

  if (endMs <= nowMs) return "EXPIRED" as const;
  if (endMs <= expiringThreshold) return "EXPIRING_SOON" as const;
  return "ACTIVE" as const;
}

type WarrantyStatus = "ACTIVE" | "EXPIRING_SOON" | "EXPIRED";

// GET: List warranties (serial items that have been sold with warrantyEnd set)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() || "";
    const status = url.searchParams.get("status")?.trim() || "";
    const days = parseInt(url.searchParams.get("days") || "90", 10) || 90;

    const now = new Date();

    // Base where clause: sold/installed serial items with warrantyEnd
    const where: Record<string, unknown> = {
      businessId,
      isActive: true,
      warrantyEnd: { not: null },
      status: { in: ["SOLD", "WARRANTY_ACTIVE", "WARRANTY_EXPIRED", "INSTALLED"] },
    };

    // Search filter on serialNumber/imei/customerName + product.name
    if (search) {
      where.OR = [
        { serialNumber: { contains: search, mode: "insensitive" } },
        { imei: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { product: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Fetch matching items with product relation and claim count
    const items = await db.mSSerialItem.findMany({
      where,
      include: {
        product: {
          select: { name: true, brand: true },
        },
        _count: {
          select: { warrantyClaims: true },
        },
      },
      orderBy: { warrantyEnd: "asc" },
    });

    // Compute warranty status for each item, then filter/sort in memory
    const warranties = items
      .map((item) => {
        const warrantyEnd = item.warrantyEnd!;
        const warrantyStatus = computeWarrantyStatus(warrantyEnd, now, days);
        const daysRemaining = Math.ceil((warrantyEnd.getTime() - now.getTime()) / MS_PER_DAY);

        return {
          id: item.id,
          serialNumber: item.serialNumber,
          imei: item.imei,
          customerName: item.customerName,
          customerPhone: item.customerPhone,
          saleId: item.saleId,
          status: item.status,
          warrantyMonths: item.warrantyMonths,
          warrantyStart: item.warrantyStart,
          warrantyEnd,
          warrantyStatus,
          daysRemaining,
          product: item.product,
          _count: item._count,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      })
      .filter((w) => {
        if (!status) return true;
        return w.warrantyStatus === status;
      });

    return NextResponse.json(warranties);
  } catch (error) {
    console.error("List warranties error:", error);
    return NextResponse.json({ error: "Failed to list warranties" }, { status: 500 });
  }
}