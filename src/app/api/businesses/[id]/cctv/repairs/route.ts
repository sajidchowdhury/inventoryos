// GET /api/businesses/[id]/cctv/repairs?status=xxx
// POST /api/businesses/[id]/cctv/repairs — create a new repair (receive product from customer)
// PHASE 1: Wrapped in $transaction() for atomic safety
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

  try {
    // ── PHASE 1: All operations in a single transaction ──
    const result = await db.$transaction(async (tx) => {
      // Look up the serial item
      const serialItem = await tx.cCTVSerialItem.findFirst({
        where: { businessId, serialNumber: body.serialNumber },
        include: { product: { select: { id: true, name: true } } },
      });

      // Auto-detect warranty status
      let underWarranty = false;
      let warrantyExpiryDate: Date | null = null;
      if (serialItem?.warrantyEnd) {
        warrantyExpiryDate = serialItem.warrantyEnd;
        underWarranty = new Date(serialItem.warrantyEnd) > new Date();
      }

      // Find or create customer
      let customerId = body.customerId || null;
      if (!customerId && body.customerPhone) {
        const existing = await tx.cCTVCustomer.findFirst({
          where: { businessId, phone: body.customerPhone },
        });
        if (existing) {
          customerId = existing.id;
        } else if (body.customerName) {
          const newCustomer = await tx.cCTVCustomer.create({
            data: {
              businessId,
              name: body.customerName,
              phone: body.customerPhone,
            },
          });
          customerId = newCustomer.id;
        }
      }

      // Generate token number
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const datePrefix = `R${yy}${mm}${dd}`;

      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      const todayCount = await tx.cCTVRepair.count({
        where: {
          businessId,
          receivedDate: { gte: startOfDay, lte: endOfDay },
        },
      });
      const tokenNo = `${datePrefix}${String(todayCount + 1).padStart(2, "0")}`;

      // 1. Create repair record
      const repair = await tx.cCTVRepair.create({
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

      // 2. Update serial status to IN_REPAIR
      if (serialItem) {
        await tx.cCTVSerialItem.update({
          where: { id: serialItem.id },
          data: { status: "IN_REPAIR" },
        });

        // 3. Create history entry INSIDE transaction (no try/catch)
        await tx.cCTVSerialHistory.create({
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
      }

      return { repair, tokenNo };
    });

    return NextResponse.json({ success: true, repair: result.repair, tokenNo: result.tokenNo }, { status: 201 });
  } catch (err: any) {
    console.error("[cctv/repairs] Transaction failed:", err);
    const msg = err?.message || "Failed to create repair";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
