// ── GET / POST / DELETE /api/super-admin/kill-switch/recipients ──
// Manage up to 3 notification email addresses.
// Auth: super-admin Bearer token.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email";

async function verifySuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  try {
    const session = await db.superAdminSession.findUnique({
      where: { token },
      select: {
        superAdminId: true, expiresAt: true,
        superAdmin: { select: { id: true, isActive: true, username: true } },
      },
    });
    if (!session || !session.superAdmin.isActive || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

const MAX_RECIPIENTS = 3;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const recipients = await db.notificationRecipient.findMany({
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      success: true,
      recipients,
      maxAllowed: MAX_RECIPIENTS,
      smtpConfigured: isEmailConfigured(),
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load recipients" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { email, label } = await req.json();
    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Valid email address required" }, { status: 400 });
    }
    const count = await db.notificationRecipient.count();
    if (count >= MAX_RECIPIENTS) {
      return NextResponse.json({ error: `Maximum ${MAX_RECIPIENTS} recipients allowed. Delete one first.` }, { status: 400 });
    }
    const existing = await db.notificationRecipient.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "This email is already a recipient" }, { status: 400 });
    }
    const recipient = await db.notificationRecipient.create({
      data: { email: email.toLowerCase(), label: label || null },
    });
    return NextResponse.json({ success: true, recipient });
  } catch (error) {
    return NextResponse.json({ error: "Failed to add recipient" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Recipient id required" }, { status: 400 });
    await db.notificationRecipient.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete recipient" }, { status: 500 });
  }
}
