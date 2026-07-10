// ── GET / PATCH /api/super-admin/businesses/[businessId]/contacts ──
// Get or update a business's owner email + WhatsApp number.
// Used by the ContactsCard component for inline editing.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBusinessContact, updateBusinessContact } from "@/lib/business-contacts";

async function verifySuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  try {
    const session = await db.superAdminSession.findUnique({
      where: { token },
      select: { superAdminId: true, expiresAt: true, superAdmin: { select: { id: true, isActive: true, username: true } } },
    });
    if (!session || !session.superAdmin.isActive || session.expiresAt.getTime() <= Date.now()) return null;
    return session;
  } catch { return null; }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ businessId: string }> }) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessId } = await params;
  const contact = await getBusinessContact(businessId);
  if (!contact) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  return NextResponse.json({ success: true, contact });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ businessId: string }> }) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessId } = await params;
  try {
    const body = await req.json();
    const { ownerEmail, ownerWhatsapp } = body;

    const result = await updateBusinessContact(businessId, { ownerEmail, ownerWhatsapp });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Return updated contact
    const contact = await getBusinessContact(businessId);
    return NextResponse.json({ success: true, contact });
  } catch (error) {
    console.error("[contacts] PATCH failed:", error);
    return NextResponse.json({ error: "Failed to update contact" }, { status: 500 });
  }
}
