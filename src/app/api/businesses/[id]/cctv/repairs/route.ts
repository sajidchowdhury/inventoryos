// GET /api/businesses/[id]/cctv/repairs?status=xxx
// POST /api/businesses/[id]/cctv/repairs — create a new repair (receive product from customer)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { businessId };
  if (status) where.status = status;

  const repairs = await db.cCTVRepair.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ success: true, repairs });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const body = await req.json();

  if (!body.serialNumber) {
    return NextResponse.json({ error: "Serial number is required" }, { status: 400 });
  }
  if (!body.issue) {
    return NextResponse.json({ error: "Issue description is required" }, { status: 400 });
  }

  // Look up the serial item to attach product info + verify it belongs to this business
  type SerialItemWithProduct = Awaited<ReturnType<typeof db.cCTVSerialItem.findFirst>> & {
    product?: { id: string; name: string } | null;
  };
  let serialItem: SerialItemWithProduct | null = null;
  if (body.serialNumber) {
    const found = await db.cCTVSerialItem.findFirst({
      where: { businessId, serialNumber: body.serialNumber },
      include: { product: { select: { id: true, name: true } } },
    });
    serialItem = found as SerialItemWithProduct | null;
  }

  // ── Auto-detect warranty status ──
  let underWarranty = false;
  let warrantyExpiryDate: Date | null = null;
  if (serialItem?.warrantyEnd) {
    warrantyExpiryDate = serialItem.warrantyEnd;
    underWarranty = new Date(serialItem.warrantyEnd) > new Date();
  }

  // If customer info provided but no customerId, try to find or create customer
  let customerId = body.customerId || null;
  if (!customerId && body.customerPhone) {
    const existing = await db.cCTVCustomer.findFirst({
      where: { businessId, phone: body.customerPhone },
    });
    if (existing) {
      customerId = existing.id;
    } else if (body.customerName) {
      const newCustomer = await db.cCTVCustomer.create({
        data: {
          businessId,
          name: body.customerName,
          phone: body.customerPhone,
        },
      });
      customerId = newCustomer.id;
    }
  }

  // ── Generate token number: R{YYMMDD}{NN} ──
  // e.g. R26071401 = first repair on 14 July 2026
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const datePrefix = `R${yy}${mm}${dd}`;

  // Count today's repairs to get sequence
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const todayCount = await db.cCTVRepair.count({
    where: {
      businessId,
      receivedDate: { gte: startOfDay, lte: endOfDay },
    },
  });
  const tokenNo = `${datePrefix}${String(todayCount + 1).padStart(2, "0")}`;

  // Create repair record
  const repair = await db.cCTVRepair.create({
    data: {
      businessId,
      tokenNo,
      serialNumber: body.serialNumber,
      serialItemId: serialItem?.id || null,
      productId: serialItem?.product?.id || body.productId || null,
      productName: serialItem?.product?.name || body.productName || null,
      customerId,
      customerName: body.customerName || null,
      customerPhone: body.customerPhone || null,
      issue: body.issue,
      status: "received",
      underWarranty,
      warrantyExpiryDate,
      receivedDate: body.receivedDate ? new Date(body.receivedDate) : new Date(),
      repairNotes: body.repairNotes || null,
    },
  });

  // Update serial status to IN_REPAIR if it exists
  if (serialItem) {
    await db.cCTVSerialItem.update({
      where: { id: serialItem.id },
      data: { status: "IN_REPAIR" },
    });

    // Create history entry (best-effort)
    try {
      await db.cCTVSerialHistory.create({
        data: {
          businessId,
          serialItemId: serialItem.id,
          serialNumber: body.serialNumber,
          productId: serialItem.productId,
          productName: serialItem.product?.name || null,
          eventType: "REPAIR_RECEIVED",
          description: `Received for repair${underWarranty ? " (Under Warranty)" : " (Out of Warranty)"} — Issue: ${body.issue}${body.customerName ? ` · Customer: ${body.customerName}` : ""} · Token: ${tokenNo}`,
          referenceId: repair.id,
          referenceType: "repair",
          eventDate: new Date(),
        },
      });
    } catch (historyErr) {
      console.error("[cctv/repairs] History write failed:", historyErr);
    }
  }

  return NextResponse.json({ success: true, repair, tokenNo }, { status: 201 });
}
