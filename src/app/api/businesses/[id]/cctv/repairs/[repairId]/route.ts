// GET /api/businesses/[id]/cctv/repairs/[repairId] — get single repair
// PATCH /api/businesses/[id]/cctv/repairs/[repairId] — update status, notes, cost
// Status transitions: received → in_repair → ready → returned (in-house repair)
// OR: received → sent_to_supplier → replaced → closed (supplier replacement)
// SUB-1: Guarded by requireActiveSubscription — blocked in read_only / data_wiped
// RP-3 fix: state machine enforces allowed transitions.
// RP-4 fix: serial status on 'ready' is IN_REPAIR (not IN_STOCK) — customer's
//   property must NOT become sellable inventory.
// RP-7 fix: when transitioning to 'returned' with repairCost > 0, creates a
//   CCTVPayment + ledger entries so repair revenue hits the books.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveSubscription } from "@/lib/subscription-guard";
import { createLedgerEntries, LEDGER_ACCOUNTS, paymentMethodToAccount } from "@/lib/ledger-helper";

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
      // RP-9: explicit guard for null serialItemId. If the repair was
      // created with a free-text serial (no matching CCTVSerialItem row),
      // `repair.serialItemId` is null. Previously the code did:
      //   await tx.cCTVSerialHistory.create({ data: { serialItemId: repair.serialItemId, ... } })
      //   await tx.cCTVSerialItem.updateMany({ where: { id: repair.serialItemId }, ... })
      // The history.create with serialItemId=null was a no-op (it inserts
      // a history row with NULL serialItemId — fine, but not useful for
      // the timeline). The updateMany with where.id=null silently
      // updated 0 rows (Prisma doesn't throw on null PK). The code worked
      // correctly in practice but the intent was unclear.
      //
      // Now: we still write a history entry (it's useful even without a
      // serialItemId — the description identifies the repair), but we
      // GUARD the serial update so we never run an updateMany with a
      // null PK. The result is the same; the code is now explicit.
      if (newStatus !== previousStatus) {
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

        // History INSIDE transaction (no try/catch).
        // RP-9: even when serialItemId is null, write the history row —
        // the serialNumber + repairId are enough to identify the event.
        await tx.cCTVSerialHistory.create({
          data: {
            businessId,
            serialItemId: repair.serialItemId,  // may be null — that's OK
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

        // Update serial status based on new repair status.
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

        // RP-9: explicit guard — only run the updateMany when we have
        // BOTH a serialItemId AND a serialStatus to set. Skipping the
        // update when serialItemId is null is the correct behavior: a
        // free-text repair has no serial row to update, and Prisma's
        // updateMany({ where: { id: null } }) would silently update 0
        // rows anyway — making the intent explicit prevents future
        // maintainers from being confused.
        if (serialStatus && repair.serialItemId) {
          await tx.cCTVSerialItem.updateMany({
            where: { id: repair.serialItemId },
            data: { status: serialStatus },
          });
        }
      }

      // ── RP-7 fix: Create repair payment + ledger entries ──
      // When the repair transitions to 'returned' (customer picks up the
      // product and pays), and the repairCost > 0, create:
      //   1. A CCTVPayment record (type: "customer_payment", referenceId:
      //      repairId, referenceType: "repair") — so the repair payment
      //      shows up in the Cash Book, Daily Summary, and Customer Ledger.
      //   2. Balanced ledger entries: DEBIT cash/receivable, CREDIT
      //      sales_revenue (using sales_revenue since there's no separate
      //      repair_revenue account in LEDGER_ACCOUNTS — a future
      //      enhancement could add one).
      //
      // For warranty repairs (repairCost = 0), no payment or ledger
      // entries are created — the repair is free.
      //
      // The repairCost used is the UPDATED cost (from body.repairCost if
      // provided, or the existing repair.repairCost).
      if (newStatus === "returned" && previousStatus !== "returned") {
        const effectiveRepairCost =
          body.repairCost !== undefined
            ? parseFloat(body.repairCost) || 0
            : Number(updatedRepair.repairCost) || 0;

        if (effectiveRepairCost > 0) {
          const paymentMethod = body.paymentMethod || "cash";

          // 1. Create the payment record
          await tx.cCTVPayment.create({
            data: {
              businessId,
              type: "customer_payment",
              customerId: repair.customerId || null,
              amount: effectiveRepairCost,
              paymentMethod,
              paymentDate: new Date(),
              notes: `Repair payment — ${repair.tokenNo || repairId} — ${repair.serialNumber}`,
              referenceId: repairId,
              referenceType: "repair",
            },
          });

          // 2. Create balanced ledger entries
          const paymentAccount = paymentMethodToAccount(paymentMethod);
          await createLedgerEntries(tx, [
            {
              businessId,
              accountId: paymentAccount,
              entryType: "DEBIT",
              amount: effectiveRepairCost,
              referenceId: repairId,
              referenceType: "repair",
              description: `Repair payment via ${paymentMethod} — ${repair.tokenNo || repairId}`,
            },
            {
              businessId,
              accountId: LEDGER_ACCOUNTS.SALES_REVENUE,
              entryType: "CREDIT",
              amount: effectiveRepairCost,
              referenceId: repairId,
              referenceType: "repair",
              description: `Repair revenue — ${repair.tokenNo || repairId} — ${repair.serialNumber}`,
            },
          ]);
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

// ── RP-10: DELETE — soft-delete a repair that was created in error ──
//
// Previously: a repair created in error could not be deleted — only
// "closed". Once a token number was generated, it was permanently in
// the audit trail. This was a deliberate design decision for audit
// integrity, but it cluttered the repair list with mistakes (e.g.
// clerk types the wrong serial, customer name spelled wrong, wrong
// product received).
//
// Now: a DELETE endpoint allows deleting a repair that is still in
// `received` status (no work done, no repairCost recorded, no payment
// collected). The DELETE:
//   1. Restores the serial's status to SOLD (or RETURNED_TO_CUSTOMER
//      if the most recent pre-repair history event was a return).
//   2. Writes a `REPAIR_DELETED` history entry for audit.
//   3. Hard-deletes the repair row (no `dataSoftDeletedAt` field on
//      CCTVRepair — the audit trail is preserved via the history).
//
// Restrictions (audited + rejected with 400):
//   - status must be "received" — any further-along repair (in_repair,
//     ready, returned, replaced, closed) is irreversible.
//   - repairCost must be 0 (no payment collected that would need refunding).
//
// Returns 200 on success; 404 if the repair doesn't exist; 400 if the
// repair is too far along to safely delete.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; repairId: string }> }
) {
  const { id: businessId, repairId } = await params;

  // SUB-1: Block writes if subscription is in read_only or data_wiped stage.
  const guard = await requireActiveSubscription(businessId);
  if (!guard.allowed) return guard.error!;

  const repair = await db.cCTVRepair.findFirst({
    where: { id: repairId, businessId },
  });

  if (!repair) {
    return NextResponse.json({ error: "Repair not found" }, { status: 404 });
  }

  // RP-10: only `received` repairs can be deleted. Anything further
  // along has work done, payments collected, or supplier handoffs that
  // are irreversible.
  if (repair.status !== "received") {
    return NextResponse.json(
      {
        error: `Cannot delete repair in status '${repair.status}'. Only repairs in 'received' status (no work done yet) can be deleted. Use the "Close" action instead.`,
      },
      { status: 400 },
    );
  }

  // RP-10: refuse to delete if a repairCost was recorded (even in
  // received status, a tech could have entered an estimate that the
  // customer has already mentally agreed to — leaving a stale cost
  // without the repair row is confusing). Force the user to clear
  // the cost first via PATCH.
  if (Number(repair.repairCost) > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete repair with repairCost ৳${Number(repair.repairCost)}. Set repairCost to 0 first (via PATCH), then delete.`,
      },
      { status: 400 },
    );
  }

  try {
    await db.$transaction(async (tx) => {
      // 1. Restore the serial's status. Since RP-1 only allowed receiving
      // for repair if the serial was SOLD or RETURNED_TO_CUSTOMER, we
      // look at the most recent pre-repair history event to figure out
      // which one to restore. The history row created at REPAIR_RECEIVED
      // is the marker — anything before it (sorted by eventDate desc)
      // is the pre-repair state. If we can't find it, default to SOLD
      // (the common case).
      let restoredStatus = "SOLD";  // safe default
      if (repair.serialItemId) {
        // Find the most recent event BEFORE this repair's REPAIR_RECEIVED
        // event. We look for any event with referenceId != repairId that
        // involves this serialItemId, sorted by eventDate desc.
        const preRepairEvent = await tx.cCTVSerialHistory.findFirst({
          where: {
            serialItemId: repair.serialItemId,
            referenceId: { not: repairId },
            eventDate: { lt: repair.receivedDate },
          },
          orderBy: { eventDate: "desc" },
          select: { eventType: true },
        });
        if (preRepairEvent?.eventType === "RETURNED_TO_CUSTOMER") {
          restoredStatus = "RETURNED_TO_CUSTOMER";
        }
        // If the most recent pre-repair event was SOLD, leave the default.
        // (If it was something else like PURCHASED, the serial shouldn't
        // have been eligible for repair per RP-1, so we default to SOLD
        // — the customer owns it.)

        await tx.cCTVSerialItem.update({
          where: { id: repair.serialItemId },
          data: { status: restoredStatus },
        });
      }

      // 2. Write a REPAIR_DELETED history entry so the audit trail
      // explains why the serial's status jumped back. The referenceId
      // is the (about-to-be-deleted) repairId; the description records
      // the token number + reason.
      if (repair.serialItemId || repair.serialNumber) {
        await tx.cCTVSerialHistory.create({
          data: {
            businessId,
            serialItemId: repair.serialItemId,
            serialNumber: repair.serialNumber,
            productId: repair.productId,
            productName: repair.productName,
            eventType: "NOTE",
            description: `Repair deleted (token: ${repair.tokenNo || "—"}, restored serial to ${restoredStatus}). Reason: created in error.`,
            referenceId: repairId,
            referenceType: "repair",
            eventDate: new Date(),
          },
        });
      }

      // 3. Hard-delete the repair row. The token number can be reused
      // (the @unique constraint is per-row, and the row is gone), but
      // in practice the same-day sequence counter will skip it on the
      // next POST because we count by receivedDate range, not by token.
      // (The deleted repair's receivedDate is no longer in the count.)
      await tx.cCTVRepair.delete({
        where: { id: repairId },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Repair ${repair.tokenNo || repairId} deleted. Serial status restored.`,
    });
  } catch (err: any) {
    console.error("[cctv/repairs DELETE] Transaction failed:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to delete repair" },
      { status: 500 },
    );
  }
}
