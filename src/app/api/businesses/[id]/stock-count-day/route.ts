// GET/POST /api/businesses/[id]/stock-count-day
import { NextRequest, NextResponse } from "next/server";
import {
  createStockCountDay,
  getCurrentStockCountDay,
  getStockCountDayDetail,
} from "@/lib/scd";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: businessId } = await params;
  const url = new URL(req.url);
  const scdId = url.searchParams.get("scdId");

  try {
    if (scdId) {
      const detail = await getStockCountDayDetail(scdId, businessId);
      if (!detail) {
        return NextResponse.json({ error: "Stock Count Day not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, scd: detail });
    }

    const [current, history] = await Promise.all([
      getCurrentStockCountDay(businessId),
      db.stockCountDay.findMany({
        where: { businessId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          name: true,
          status: true,
          startedAt: true,
          closedAt: true,
          appliedAt: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({ success: true, active: current, history });
  } catch (error) {
    console.error("Get stock count day error:", error);
    return NextResponse.json({ error: "Failed to load Stock Count Day" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: businessId } = await params;
  try {
    const body = await req.json();
    const zoneIds = Array.isArray(body.zoneIds) ? body.zoneIds as string[] : [];
    if (zoneIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one storage zone to count" },
        { status: 400 }
      );
    }

    const result = await createStockCountDay(businessId, {
      name: body.name,
      zoneIds,
      startedBy: body.startedBy,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, scd: result.scd }, { status: 201 });
  } catch (error) {
    console.error("Create stock count day error:", error);
    return NextResponse.json({ error: "Failed to create Stock Count Day" }, { status: 500 });
  }
}
