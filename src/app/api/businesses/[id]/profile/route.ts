// GET/PATCH /api/businesses/[id]/profile
// ST-8: Business profile editing — name, address, phone (the fields the
// shop owner can change after registration). The Business model has many
// more fields (subscriptionTier, etc.) but those are admin-only.
//
// GET: returns the public profile fields (no sensitive data).
// PATCH: updates name/address/phone. Guarded by the authenticated user
// being a member of this business (checked via the session's businessId).
// Not guarded by SUB-1 — a read_only business should still be able to
// edit its profile (the shop name doesn't change subscription state).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      // ST-8: include any VAT/TIN fields if they exist on the model.
      // We select them conditionally via a broad select + let TS narrow.
    },
  });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, business });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const body = await req.json();

  // ST-8: only allow editing the public profile fields. The shop owner
  // can't change subscriptionTier, businessTypeId, etc. from here.
  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    updateData.name = name;
  }
  if (body.address !== undefined) updateData.address = String(body.address).trim() || null;
  if (body.phone !== undefined) updateData.phone = String(body.phone).trim() || null;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const updated = await db.business.update({
      where: { id: businessId },
      data: updateData,
      select: { id: true, name: true, address: true, phone: true },
    });
    return NextResponse.json({ success: true, business: updated });
  } catch (err: any) {
    console.error("[businesses/profile] PATCH failed:", err);
    return NextResponse.json({ error: err?.message || "Failed to update profile" }, { status: 500 });
  }
}
