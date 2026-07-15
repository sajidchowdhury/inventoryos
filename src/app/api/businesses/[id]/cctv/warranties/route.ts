// GET /api/businesses/[id]/cctv/warranties
// Returns warranty dashboard data:
//  - Stats: active, expiring soon (30 days), expired, repairs in progress
//  - List of warranty-tracked serial items with status
//  - Active repairs under warranty
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter"); // active, expiring, expired, all

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Fetch all SOLD serial items that have warranty end date
  const allSerials = await db.cCTVSerialItem.findMany({
    where: {
      businessId,
      warrantyEnd: { not: null },
      status: { in: ["SOLD", "IN_REPAIR", "SENT_TO_SUPPLIER", "RETURNED_TO_CUSTOMER"] },
    },
    include: {
      product: {
        select: { id: true, name: true, brand: true, model: true },
      },
    },
    orderBy: { warrantyEnd: "asc" },
  });

  // Categorize
  const active = allSerials.filter((s) => s.warrantyEnd && new Date(s.warrantyEnd) > now);
  const expiring = active.filter((s) => s.warrantyEnd && new Date(s.warrantyEnd) <= thirtyDaysFromNow);
  const expired = allSerials.filter((s) => s.warrantyEnd && new Date(s.warrantyEnd) <= now);

  // Active repairs under warranty
  const repairsInProgress = await db.cCTVRepair.findMany({
    where: {
      businessId,
      status: { in: ["received", "in_repair", "ready", "sent_to_supplier"] },
    },
    orderBy: { receivedDate: "desc" },
    take: 50,
  });

  // Apply filter to serial list if provided
  let filteredSerials = allSerials;
  if (filter === "active") {
    filteredSerials = active;
  } else if (filter === "expiring") {
    filteredSerials = expiring;
  } else if (filter === "expired") {
    filteredSerials = expired;
  }

  return NextResponse.json({
    success: true,
    stats: {
      total: allSerials.length,
      active: active.length,
      expiring: expiring.length,
      expired: expired.length,
      repairsInProgress: repairsInProgress.length,
      warrantyRepairsInProgress: repairsInProgress.filter((r) => r.underWarranty).length,
    },
    serials: filteredSerials,
    repairs: repairsInProgress,
  });
}
