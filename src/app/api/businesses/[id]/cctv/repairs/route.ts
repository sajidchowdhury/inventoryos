// GET /api/businesses/[id]/cctv/repairs?status=xxx
// POST /api/businesses/[id]/cctv/repairs — create a new repair (receive product from customer)
// PHASE 1: Wrapped in $transaction() for atomic safety
// SUB-1: Guarded by requireActiveSubscription — blocked in read_only / data_wiped
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveSubscription } from "@/lib/subscription-guard";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { businessId };
  if (status) where.status = status;

  // RP-8: Pagination — previous `take: 100` silently dropped anything past row
  // 100 for shops with 200+ repairs. Now accepts ?page=&pageSize= and returns
  // pagination metadata. Default pageSize=50 to match other CCTV list endpoints.
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("pageSize") || "50") || 50));
  const skip = (page - 1) * pageSize;

  const [repairs, total] = await Promise.all([
    db.cCTVRepair.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.cCTVRepair.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    repairs,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;

  // SUB-1: Block writes if subscription is in read_only or data_wiped stage.
  const guard = await requireActiveSubscription(businessId);
  if (!guard.allowed) return guard.error!;

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
      // RP-1 fix: Look up the serial item with a STATUS CHECK.
      // Only allow receiving for repair if the serial was:
      //   - SOLD (normal: customer bought it, now bringing it back for repair)
      //   - RETURNED_TO_CUSTOMER (re-repair: was repaired before, returned,
      //     now coming back again)
      // Reject if the serial is:
      //   - IN_STOCK (never sold — shouldn't be in a repair)
      //   - IN_REPAIR (already in an open repair — can't have two)
      //   - SENT_TO_SUPPLIER (sent to supplier — not available)
      //   - REPLACED (replaced by supplier — the old serial is dead)
      // If no serial item is found (free-text serial), we still allow
      // the repair (the shop might be repairing a product bought elsewhere).
      const serialItem = await tx.cCTVSerialItem.findFirst({
        where: {
          businessId,
          serialNumber: body.serialNumber,
          status: { in: ["SOLD", "RETURNED_TO_CUSTOMER"] },
        },
        include: { product: { select: { id: true, name: true } } },
      });

      // If no serial found with the right status, check if one exists
      // with a wrong status — give a helpful error message.
      if (!serialItem) {
        const existingSerial = await tx.cCTVSerialItem.findFirst({
          where: { businessId, serialNumber: body.serialNumber },
          select: { status: true },
        });
        if (existingSerial) {
          throw new Error(
            `Serial ${body.serialNumber} cannot be received for repair (current status: ${existingSerial.status}). Only SOLD or RETURNED_TO_CUSTOMER serials can be repaired.`
          );
        }
        // No serial item at all — proceed without one (free-text repair).
        // The shop might be repairing a product bought elsewhere.
      }

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
    // RP-1: serial status check errors return 400 (not 500)
    const status = msg.includes("cannot be received for repair") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
