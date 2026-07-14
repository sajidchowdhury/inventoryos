// GET/PUT /api/businesses/[id]/mobile-shop/serial-items/[serialItemId]
// Get a single serial item with product info and history
// PUT: Change status (with history tracking)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const VALID_STATUSES = [
  "IN_STOCK", "IN_TRANSIT", "SOLD", "INSTALLED",
  "IN_REPAIR", "RETURNED", "WARRANTY_ACTIVE", "WARRANTY_EXPIRED",
  "DEFECTIVE", "DISPOSED", "CONSUMED",
] as const;

// Map status transitions to sensible event names
function deriveEvent(from: string, to: string): string {
  if (from === to) return "STATUS_CHANGED";
  const map: Record<string, string> = {
    IN_REPAIR: "REPAIR_START",
    INSTALLED: "INSTALLED",
    SOLD: "SOLD",
    RETURNED: "RETURNED",
    DEFECTIVE: "DISPOSED",
    DISPOSED: "DISPOSED",
    CONSUMED: "CONSUMED",
  };
  // If going back to IN_STOCK from REPAIR, it's REPAIR_COMPLETE
  if (from === "IN_REPAIR" && to === "IN_STOCK") return "REPAIR_COMPLETE";
  // If going to DEFECTIVE, it's DISPOSED
  if (to === "DEFECTIVE") return "DISPOSED";
  return map[to] || "STATUS_CHANGED";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; serialItemId: string }> }
) {
  try {
    const { id: businessId, serialItemId } = await params;

    const item = await db.mSSerialItem.findFirst({
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

// PUT: Change serial item status with history tracking
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; serialItemId: string }> }
) {
  try {
    const { id: businessId, serialItemId } = await params;
    const body = await req.json();

    const { status, notes } = body as { status?: string; notes?: string };

    if (!status || !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }

    // Fetch current item
    const item = await db.mSSerialItem.findFirst({
      where: { id: serialItemId, businessId, isActive: true },
    });

    if (!item) {
      return NextResponse.json({ error: "Serial item not found" }, { status: 404 });
    }

    const fromStatus = item.status;
    const toStatus = status;

    // Don't record history if status hasn't changed
    if (fromStatus === toStatus) {
      return NextResponse.json({ message: "Status unchanged", item });
    }

    const event = deriveEvent(fromStatus, toStatus);

    // Update serial item status + create history entry in a transaction
    const [updated] = await db.$transaction([
      db.mSSerialItem.update({
        where: { id: serialItemId },
        data: { status: toStatus },
      }),
      db.mSSerialItemHistory.create({
        data: {
          businessId,
          serialItemId,
          fromStatus,
          toStatus,
          event,
          notes: notes?.trim() || null,
        },
      }),
    ]);

    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    console.error("Update serial item error:", error);
    return NextResponse.json({ error: "Failed to update serial item" }, { status: 500 });
  }
}