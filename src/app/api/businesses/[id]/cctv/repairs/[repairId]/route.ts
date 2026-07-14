// GET /api/businesses/[id]/cctv/repairs/[repairId] — get single repair
// PATCH /api/businesses/[id]/cctv/repairs/[repairId] — update status, notes, cost
// Status transitions: received → in_repair → ready → returned (in-house repair)
// OR: received → sent_to_supplier → replaced → closed (supplier replacement)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; repairId: string }> }) {
  const { id: businessId, repairId } = await params;

  const repair = await db.cCTVRepair.findFirst({
    where: { id: repairId, businessId },
  });

  if (!repair) {
    return NextResponse.json({ error: "Repair not found" }, { status: 404 });
  }

  // Also fetch linked replacement (if any)
  const replacement = repair.replacementId
    ? await db.cCTVSupplierReplacement.findUnique({ where: { id: repair.replacementId } })
    : null;

  // Fetch history for this serial
  const history = await db.cCTVSerialHistory.findMany({
    where: {
      businessId,
      OR: [
        { serialItemId: repair.serialItemId },
        { serialNumber: repair.serialNumber },
      ],
    },
    orderBy: { eventDate: "desc" },
  });

  return NextResponse.json({ success: true, repair, replacement, history });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; repairId: string }> }) {
  const { id: businessId, repairId } = await params;
  const body = await req.json();

  const repair = await db.cCTVRepair.findFirst({
    where: { id: repairId, businessId },
  });

  if (!repair) {
    return NextResponse.json({ error: "Repair not found" }, { status: 404 });
  }

  const previousStatus = repair.status;
  const newStatus = body.status || previousStatus;

  // Update repair record with timestamps based on status transition
  const updateData: Record<string, unknown> = {};
  if (body.status) updateData.status = body.status;
  if (body.repairNotes !== undefined) updateData.repairNotes = body.repairNotes;
  if (body.repairCost !== undefined) updateData.repairCost = parseFloat(body.repairCost) || 0;
  if (body.issue !== undefined) updateData.issue = body.issue;

  if (newStatus === "in_repair" && !repair.repairStartDate) {
    updateData.repairStartDate = new Date();
  }
  if (newStatus === "ready" && !repair.readyDate) {
    updateData.readyDate = new Date();
  }
  if (newStatus === "returned" && !repair.returnedDate) {
    updateData.returnedDate = new Date();
  }

  try {
    // ── PHASE 1: Wrap repair update + history + serial update in transaction ──
    const updated = await db.$transaction(async (tx) => {
      const updatedRepair = await tx.cCTVRepair.update({
        where: { id: repairId },
        data: updateData,
      });

      // Create history entry on status change
      if (newStatus !== previousStatus && repair.serialItemId) {
        let eventType = "NOTE";
        let description = `Status changed: ${previousStatus} → ${newStatus}`;

        if (newStatus === "in_repair") {
          eventType = "REPAIR_DONE";
          description = `Repair started${body.repairNotes ? ` — ${body.repairNotes}` : ""}`;
        } else if (newStatus === "ready") {
          eventType = "REPAIR_DONE";
          description = `Repair complete — ready for pickup${body.repairCost ? ` · Cost: ৳${body.repairCost}` : ""}`;
        } else if (newStatus === "returned") {
          eventType = "RETURNED_TO_CUSTOMER";
          description = `Returned to customer${repair.customerName ? ` (${repair.customerName})` : ""}`;
        } else if (newStatus === "sent_to_supplier") {
          eventType = "SENT_TO_SUPPLIER";
          description = `Sent to supplier for replacement`;
        } else if (newStatus === "replaced") {
          eventType = "REPLACED";
          description = `Replaced by supplier (new serial issued)`;
        } else if (newStatus === "closed") {
          eventType = "NOTE";
          description = `Repair job closed`;
        }

        // History INSIDE transaction (no try/catch)
        await tx.cCTVSerialHistory.create({
          data: {
            businessId,
            serialItemId: repair.serialItemId,
            serialNumber: repair.serialNumber,
            productId: repair.productId,
            productName: repair.productName,
            eventType,
            description,
            referenceId: repairId,
            referenceType: "repair",
            notes: body.repairNotes || null,
            eventDate: new Date(),
          },
        });

        // Update serial status based on new repair status
        let serialStatus: string | null = null;
        if (newStatus === "in_repair") serialStatus = "IN_REPAIR";
        else if (newStatus === "ready") serialStatus = "IN_STOCK";
        else if (newStatus === "returned") serialStatus = "RETURNED_TO_CUSTOMER";
        else if (newStatus === "sent_to_supplier") serialStatus = "SENT_TO_SUPPLIER";
        else if (newStatus === "replaced") serialStatus = "REPLACED";

        if (serialStatus) {
          await tx.cCTVSerialItem.updateMany({
            where: { id: repair.serialItemId },
            data: { status: serialStatus },
          });
        }
      }

      return updatedRepair;
    });

    return NextResponse.json({ success: true, repair: updated });
  } catch (err: any) {
    console.error("[cctv/repairs] PATCH transaction failed:", err);
    const msg = err?.message || "Failed to update repair";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
