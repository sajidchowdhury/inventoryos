// ── GET / PUT /api/super-admin/smtp-config ──
// Read and update SMTP configuration stored in the database.
// This replaces the old environment-variable-only approach.
// The admin can now set SMTP credentials from /admin/api-setup → SMTP tab.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSmtpStatus, refreshSmtpCache } from "@/lib/email";

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
    if (!session || !session.superAdmin.isActive || session.expiresAt.getTime() <= Date.now()) return null;
    return session;
  } catch { return null; }
}

// GET — return current SMTP config (password masked)
export async function GET(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const status = await getSmtpStatus();
    // If configured via DB, return full config (but mask password)
    const dbConfig = await db.smtpConfig.findUnique({ where: { id: "default" } });

    return NextResponse.json({
      success: true,
      configured: status.configured,
      source: status.source,
      config: dbConfig ? {
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password ? "••••••••" : "", // masked
        fromEmail: dbConfig.fromEmail,
        fromName: dbConfig.fromName,
        isActive: dbConfig.isActive,
        updatedAt: dbConfig.updatedAt,
        updatedBy: dbConfig.updatedBy,
      } : null,
      envFallback: {
        host: process.env.SMTP_HOST || null,
        port: process.env.SMTP_PORT || null,
        user: process.env.SMTP_USER || null,
        from: process.env.SMTP_FROM || null,
      },
    });
  } catch (error) {
    console.error("[smtp-config] GET failed:", error);
    return NextResponse.json({ error: "Failed to load SMTP config" }, { status: 500 });
  }
}

// PUT — update SMTP config (creates if doesn't exist)
export async function PUT(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { host, port, user, password, fromEmail, fromName, isActive } = body;

    // Validate required fields
    if (!host || !user) {
      return NextResponse.json({ error: "host and user are required" }, { status: 400 });
    }
    // If creating new config, password is required. If updating, password is optional (keep existing).
    const existing = await db.smtpConfig.findUnique({ where: { id: "default" } });
    if (!existing && !password) {
      return NextResponse.json({ error: "password is required when setting up SMTP for the first time" }, { status: 400 });
    }

    // Validate port
    const portNum = parseInt(String(port || 587), 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return NextResponse.json({ error: "port must be a number between 1 and 65535" }, { status: 400 });
    }

    // Validate email format if fromEmail is provided
    if (fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
      return NextResponse.json({ error: "fromEmail must be a valid email address" }, { status: 400 });
    }

    // Upsert: if password is "••••••••" (masked), keep the existing password
    const actualPassword = (password && password !== "••••••••") ? password : existing?.password || "";

    const config = await db.smtpConfig.upsert({
      where: { id: "default" },
      update: {
        host,
        port: portNum,
        user,
        ...(password && password !== "••••••••" && { password }),
        fromEmail: fromEmail || null,
        fromName: fromName || "InventoryOS",
        isActive: isActive ?? true,
        updatedBy: session.superAdmin.username,
      },
      create: {
        id: "default",
        host,
        port: portNum,
        user,
        password: actualPassword,
        fromEmail: fromEmail || null,
        fromName: fromName || "InventoryOS",
        isActive: isActive ?? true,
        updatedBy: session.superAdmin.username,
      },
    });

    // Refresh the email module's cache so new settings take effect immediately
    refreshSmtpCache();

    return NextResponse.json({
      success: true,
      message: "SMTP configuration saved. Email delivery is now active.",
      config: {
        host: config.host,
        port: config.port,
        user: config.user,
        fromEmail: config.fromEmail,
        fromName: config.fromName,
        isActive: config.isActive,
        updatedAt: config.updatedAt,
        updatedBy: config.updatedBy,
      },
    });
  } catch (error) {
    console.error("[smtp-config] PUT failed:", error);
    return NextResponse.json({ error: "Failed to save SMTP config" }, { status: 500 });
  }
}

// DELETE — deactivate SMTP config (soft delete via isActive=false)
export async function DELETE(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await db.smtpConfig.updateMany({
      where: { id: "default" },
      data: { isActive: false, updatedBy: session.superAdmin.username },
    });
    refreshSmtpCache();
    return NextResponse.json({ success: true, message: "SMTP config deactivated. Emails will be logged to console." });
  } catch (error) {
    return NextResponse.json({ error: "Failed to deactivate SMTP config" }, { status: 500 });
  }
}
