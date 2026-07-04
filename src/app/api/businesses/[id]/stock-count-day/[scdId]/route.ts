// GET/PATCH /api/businesses/[id]/stock-count-day/[scdId]
// PATCH body: { action: "start" | "close" | "apply", userId?: string }
import { NextRequest, NextResponse } from "next/server";
import {
  applyStockCountDay,
  closeStockCountDay,
  getStockCountDayDetail,
  startStockCountDay,
} from "@/lib/scd";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; scdId: string }> }
) {
  const { id: businessId, scdId } = await params;
  try {
    const scd = await getStockCountDayDetail(scdId, businessId);
    if (!scd) {
      return NextResponse.json({ error: "Stock Count Day not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, scd });
  } catch (error) {
    console.error("Get SCD detail error:", error);
    return NextResponse.json({ error: "Failed to load details" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; scdId: string }> }
) {
  const { id: businessId, scdId } = await params;
  try {
    const body = await req.json();
    const action = body.action as string;
    const userId = body.userId as string | undefined;

    switch (action) {
      case "start": {
        const result = await startStockCountDay(scdId, businessId, userId);
        if (!result.ok) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true, scd: result.scd });
      }
      case "close": {
        const result = await closeStockCountDay(scdId, businessId, userId);
        if (!result.ok) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true, scd: result.scd });
      }
      case "apply": {
        const result = await applyStockCountDay(scdId, businessId, userId);
        if (!result.ok) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({
          success: true,
          scd: result.scd,
          applied: result.applied,
          skipped: result.skipped,
        });
      }
      default:
        return NextResponse.json(
          { error: 'action must be "start", "close", or "apply"' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("SCD action error:", error);
    return NextResponse.json({ error: "Failed to update Stock Count Day" }, { status: 500 });
  }
}
