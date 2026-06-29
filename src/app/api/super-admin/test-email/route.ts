// ── POST /api/super-admin/test-email ──
// Sends a test email to all configured notification recipients.
// Verifies SMTP is working before relying on it for alerts.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail, getActiveRecipientEmails, isEmailConfigured, getFromAddress } from "@/lib/email";

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

export async function POST(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const recipients = await getActiveRecipientEmails();

    if (recipients.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No notification recipients configured. Add at least one email in the Alerts tab first.",
      }, { status: 400 });
    }

    if (!await isEmailConfigured()) {
      return NextResponse.json({
        success: false,
        error: "SMTP not configured. Go to /admin/api-setup → SMTP tab to set SMTP credentials.",
        smtpConfigured: false,
      }, { status: 400 });
    }

    const fromAddr = await getFromAddress();

    const result = await sendEmail({
      to: recipients,
      subject: "\u2705 InventoryOS Test Email \u2014 SMTP Working",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;">
          <h1 style="color:#10b981;">\u2705 Test Email Successful</h1>
          <p>This email confirms that SMTP is configured correctly and InventoryOS can send emails.</p>
          <p><strong>From:</strong> ${fromAddr}</p>
          <p><strong>To:</strong> ${recipients.join(", ")}</p>
          <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
          <p style="font-size:12px;color:#6b7280;">
            You will now receive: kill-switch alerts, weekly AI health reports, and scheduled pharmacy report deliveries.
          </p>
        </div>
      `,
      text: `Test Email Successful\n\nSMTP is configured correctly.\nFrom: ${fromAddr}\nTo: ${recipients.join(", ")}\nSent: ${new Date().toISOString()}`,
    });

    if (result.sent) {
      return NextResponse.json({
        success: true,
        message: `Test email sent to ${recipients.length} recipient(s)`,
        recipients,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || "Email send failed",
        fallbackUsed: result.fallbackUsed,
      }, { status: 500 });
    }
  } catch (error) {
    console.error("[test-email] failed:", error);
    return NextResponse.json({ error: "Failed to send test email" }, { status: 500 });
  }
}
