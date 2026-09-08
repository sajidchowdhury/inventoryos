// GET/PATCH/DELETE /api/businesses/[id]/cctv/suppliers/[supplierId]
// SL-5: Supplier edit and delete endpoints (previously missing entirely).
//
// GET: returns a single supplier by id (must match businessId).
// PATCH: edits editable fields (name, phone, address, openingBalance).
// DELETE: rejects if the supplier has purchases/payments (same pattern
//   as customer delete). Hard-delete only if no references exist.
//
// SUB-1: PATCH and DELETE are guarded by requireActiveSubscription.
//   GET is NOT guarded.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveSubscription } from "@/lib/subscription-guard";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; supplierId: string }> }
) {
  const { id: businessId, supplierId } = await params;

  const supplier = await db.cCTVSupplier.findFirst({
    where: { id: supplierId, businessId },
  });

  if (!supplier) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, supplier });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; supplierId: string }> }
) {
  const { id: businessId, supplierId } = await params;

  const guard = await requireActiveSubscription(businessId);
  if (!guard.allowed) return guard.error!;

  const body = await req.json();

  const existing = await db.cCTVSupplier.findFirst({
    where: { id: supplierId, businessId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.phone !== undefined) updateData.phone = body.phone || "";
  if (body.address !== undefined) updateData.address = body.address || null;
  if (body.openingBalance !== undefined) updateData.openingBalance = body.openingBalance;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await db.cCTVSupplier.update({
    where: { id: supplierId },
    data: updateData,
  });

  return NextResponse.json({ success: true, supplier: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; supplierId: string }> }
) {
  const { id: businessId, supplierId } = await params;

  const guard = await requireActiveSubscription(businessId);
  if (!guard.allowed) return guard.error!;

  const existing = await db.cCTVSupplier.findFirst({
    where: { id: supplierId, businessId },
    select: { id: true, name: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  // Check if the supplier has any references (purchases, payments)
  const [purchaseCount, paymentCount, replacementCount] = await Promise.all([
    db.cCTVPurchase.count({ where: { supplierId } }),
    db.cCTVPayment.count({ where: { supplierId } }),
    db.cCTVSupplierReplacement.count({ where: { supplierId } }),
  ]);

  const hasReferences = purchaseCount > 0 || paymentCount > 0 || replacementCount > 0;

  if (hasReferences) {
    return NextResponse.json({
      error: "Cannot delete this supplier because they have existing purchases, payments, or replacements. Please rename the supplier instead (e.g. prefix with '[DELETED]') or contact support.",
    }, { status: 400 });
  }

  // Hard-delete: no references, safe to remove
  await db.cCTVSupplier.delete({
    where: { id: supplierId },
  });

  return NextResponse.json({
    success: true,
    message: "Supplier permanently deleted (no existing purchases/payments/replacements).",
    deleted: true,
  });
}
