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

  // Create repair record
  const repair = await db.cCTVRepair.create({
    data: {
      businessId,
      serialNumber: body.serialNumber,
      serialItemId: serialItem?.id || null,
      productId: serialItem?.product?.id || body.productId || null,
      productName: serialItem?.product?.name || body.productName || null,
      customerId,
      customerName: body.customerName || null,
      customerPhone: body.customerPhone || null,
      issue: body.issue,
      status: "received",
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

    // Create history entry
    await db.cCTVSerialHistory.create({
      data: {
        businessId,
        serialItemId: serialItem.id,
        serialNumber: body.serialNumber,
        productId: serialItem.productId,
        productName: serialItem.product?.name || null,
        eventType: "REPAIR_RECEIVED",
        description: `Received for repair — Issue: ${body.issue}${body.customerName ? ` · Customer: ${body.customerName}` : ""}`,
        referenceId: repair.id,
        referenceType: "repair",
        eventDate: new Date(),
      },
    });
  }

  return NextResponse.json({ success: true, repair }, { status: 201 });
}
