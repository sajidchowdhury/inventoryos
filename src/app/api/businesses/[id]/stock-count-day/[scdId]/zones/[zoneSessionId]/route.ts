// GET/PATCH /api/businesses/[id]/stock-count-day/[scdId]/zones/[zoneSessionId]
// PATCH: { action: "start" | "close" | "count", productId?, countedQty?, userId? }
import { NextRequest, NextResponse } from "next/server";
import {
  closeZoneSession,
  getZoneSessionDetail,
  startZoneCounting,
  upsertZoneCountLine,
} from "@/lib/scd";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; scdId: string; zoneSessionId: string }> }
) {
  const { id: businessId, zoneSessionId } = await params;
  try {
    const result = await getZoneSessionDetail(zoneSessionId, businessId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Get zone session error:", error);
    return NextResponse.json({ error: "Failed to load zone session" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; scdId: string; zoneSessionId: string }> }
) {
  const { id: businessId, zoneSessionId } = await params;
  try {
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case "start": {
        const result = await startZoneCounting(zoneSessionId, businessId);
        if (!result.ok) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true, ...result });
      }
      case "close": {
        const result = await closeZoneSession(zoneSessionId, businessId, body.userId);
        if (!result.ok) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        const detail = await getZoneSessionDetail(zoneSessionId, businessId);
        return NextResponse.json({ success: true, ...detail });
      }
      case "count": {
        const qty = parseFloat(body.countedQty);
        if (!body.productId || isNaN(qty) || qty < 0) {
          return NextResponse.json(
            { error: "productId and non-negative countedQty are required" },
            { status: 400 }
          );
        }
        const result = await upsertZoneCountLine(businessId, zoneSessionId, {
          productId: body.productId,
          countedQty: qty,
          detectedName: body.detectedName,
          confidence: body.confidence,
          shelfScanItemId: body.shelfScanItemId,
          countedBy: body.userId,
          notes: body.notes,
        });
        if (!result.ok) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        const detail = await getZoneSessionDetail(zoneSessionId, businessId);
        return NextResponse.json({ success: true, line: result.line, ...detail });
      }
      default:
        return NextResponse.json(
          { error: 'action must be "start", "close", or "count"' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Zone session action error:", error);
    return NextResponse.json({ error: "Failed to update zone session" }, { status: 500 });
  }
}
