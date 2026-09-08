// GET /api/businesses/[id]/cctv/repairs/[repairId] — get single repair
// PATCH /api/businesses/[id]/cctv/repairs/[repairId] — update status, notes, cost
// Status transitions: received → in_repair → ready → returned (in-house repair)
// OR: received → sent_to_supplier → replaced → closed (supplier replacement)
// SUB-1: Guarded by requireActiveSubscription — blocked in read_only / data_wiped
// RP-3 fix: state machine enforces allowed transitions.
// RP-4 fix: serial status on 'ready' is IN_REPAIR (not IN_STOCK) — customer's
//   property must NOT become sellable inventory.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveSubscription } from "@/lib/subscription-guard";

// RP-3: Allowed status transitions.
// Key = current status, value = array of allowed next statuses.
// Terminal statuses (returned, replaced, closed) allow no transitions
// (except closed, which is a no-op cleanup).
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  received: ["in_repair", "sent_to_supplier", "closed"],
  in_repair: ["ready", "sent_to_supplier", "closed"],
  ready: ["returned", "closed"],
  sent_to_supplier: ["replaced", "closed"],
  replaced: ["closed"],
  returned: [],   // terminal — can't revive
  closed: [],     // terminal
};

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

  // SUB-1: Block writes if subscription is in read_only or data_wiped stage.
  const guard = await requireActiveSubscription(businessId);
  if (!guard.allowed) return guard.error!;

  const body = await req.json();

  const repair = await db.cCTVRepair.findFirst({
    where: { id: repairId, businessId },
  });

  if (!repair) {
    return NextResponse.json({ error: "Repair not found" }, { status: 404 });
  }

  const previousStatus = repair.status;
  const newStatus = body.status || previousStatus;

  // RP-3 fix: validate the transition is allowed by the state machine.
  // If the status is not changing (e.g. just updating notes/cost), allow it.
  if (body.status && newStatus !== previousStatus) {
    const allowed = ALLOWED_TRANSITIONS[previousStatus] || [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        { error: `Cannot transition repair from '${previousStatus}' to '${newStatus}'. Allowed transitions from '${previousStatus}': ${allowed.length > 0 ? allowed.join(", ") : "none (terminal status)"}.` },
        { status: 400 }
      );
    }
  }

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
        // RP-4 fix: 'ready' now sets serial to IN_REPAIR (not IN_STOCK).
        // The serial is still owned by the customer — it's NOT sellable
        // inventory. The "ready for pickup" state is surfaced via the
        // repair's status field (status: "ready"), NOT via the serial's
        // status. The Stock Report's IN_STOCK count won't include it
        // (correct — it's not sellable). The POS won't find it via
        // ?status=IN_STOCK (correct — can't sell customer's property).
        let serialStatus: string | null = null;
        if (newStatus === "in_repair") serialStatus = "IN_REPAIR";
        else if (newStatus === "ready") serialStatus = "IN_REPAIR"; // RP-4: was IN_STOCK
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
