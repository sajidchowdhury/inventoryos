// GET/PATCH /api/businesses/[id]/profile
// ST-8: Business profile editing — name, address, phone.
// ST-9: Also includes activePaymentMethods (comma-separated list of
//   active payment methods for this business). The PaymentMethodSelector
//   reads this to decide which methods to show at the POS.
//
// GET: returns the public profile fields (no sensitive data).
// PATCH: updates name/address/phone/activePaymentMethods. Not guarded by
// SUB-1 — a read_only business should still be able to edit its profile.

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
      // ST-9: include activePaymentMethods
      activePaymentMethods: true,
    },
  });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }
  // ST-9: parse the comma-separated string into an array for the UI.
  // Default to all 6 methods if null (backward compat).
  const activeMethods = (business.activePaymentMethods || "cash,bank,bkash,nagad,card,cheque")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return NextResponse.json({ success: true, business: { ...business, activeMethods } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const body = await req.json();

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    updateData.name = name;
  }
  if (body.address !== undefined) updateData.address = String(body.address).trim() || null;
  if (body.phone !== undefined) updateData.phone = String(body.phone).trim() || null;

  // ST-9: update activePaymentMethods. Accept either a comma-separated
  // string or an array of method codes. Validate each against the known
  // set (cash/bank/bkash/nagad/card/cheque). At least one method must
  // remain active.
  if (body.activePaymentMethods !== undefined || body.activeMethods !== undefined) {
    const raw = body.activePaymentMethods || body.activeMethods;
    let methods: string[];
    if (Array.isArray(raw)) {
      methods = raw.map((m: string) => String(m).trim()).filter(Boolean);
    } else {
      methods = String(raw).split(",").map((m) => m.trim()).filter(Boolean);
    }
    // Validate
    const VALID = new Set(["cash", "bank", "bkash", "nagad", "card", "cheque"]);
    const invalid = methods.filter((m) => !VALID.has(m));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid payment methods: ${invalid.join(", ")}. Valid: cash, bank, bkash, nagad, card, cheque` },
        { status: 400 },
      );
    }
    if (methods.length === 0) {
      return NextResponse.json(
        { error: "At least one payment method must be active" },
        { status: 400 },
      );
    }
    updateData.activePaymentMethods = methods.join(",");
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const updated = await db.business.update({
      where: { id: businessId },
      data: updateData,
      select: { id: true, name: true, address: true, phone: true, activePaymentMethods: true },
    });
    // Parse for the response
    const activeMethods = (updated.activePaymentMethods || "cash,bank,bkash,nagad,card,cheque")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    return NextResponse.json({ success: true, business: { ...updated, activeMethods } });
  } catch (err: any) {
    console.error("[businesses/profile] PATCH failed:", err);
    return NextResponse.json({ error: err?.message || "Failed to update profile" }, { status: 500 });
  }
}
