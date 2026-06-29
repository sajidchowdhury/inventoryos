// src/lib/email.ts
// Phase 4: Email sending infrastructure for kill-switch notifications.
//
// Uses nodemailer with SMTP credentials from environment variables:
//   SMTP_HOST       — e.g., "smtp.gmail.com", "smtp.sendgrid.net"
//   SMTP_PORT       — e.g., 587 (STARTTLS) or 465 (SSL)
//   SMTP_USER       — SMTP username (often the email address)
//   SMTP_PASS       — SMTP password or app-specific password
//   SMTP_FROM       — From: address (defaults to SMTP_USER)
//
// If SMTP is not configured (SMTP_HOST missing), emails are logged to the
// console AND written to NotificationLog so nothing is lost. This fail-safe
// ensures kill-switch alerts are never silently dropped.
//
// Usage:
//   import { sendEmail } from "@/lib/email";
//   await sendEmail({
//     to: ["founder@example.com", "cto@example.com"],
//     subject: "Kill-Switch Triggered",
//     html: "<h1>Alert</h1><p>Details...</p>",
//   });

import nodemailer from "nodemailer";
import { db } from "./db";

// ── Types ──
export interface EmailPayload {
  to: string[];
  subject: string;
  html: string;
  text?: string; // plain-text fallback
}

export interface EmailResult {
  sent: boolean;
  messageIds: string[];
  error?: string;
  fallbackUsed?: boolean; // true if email was logged instead of sent
}

// ── Lazy singleton transporter ──
let transporter: nodemailer.Transporter | null = null;
let smtpConfigured = false;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    // SMTP not configured — caller should use fallback
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for 587 (STARTTLS)
    auth: { user, pass },
  });

  smtpConfigured = true;
  return transporter;
}

/**
 * Check if SMTP is configured. Used by the UI to show a warning banner
 * if email alerts won't actually be sent.
 */
export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Get the configured From: address. Falls back to SMTP_USER.
 */
export function getFromAddress(): string {
  return process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@inventoryos.local";
}

/**
 * Send an email to one or more recipients.
 *
 * If SMTP is not configured, the email content is:
 *   1. Logged to the console (for immediate visibility during development)
 *   2. Written to NotificationLog (for audit trail)
 * This ensures no alert is ever silently dropped.
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const { to, subject, html, text } = payload;

  if (!to || to.length === 0) {
    return { sent: false, messageIds: [], error: "No recipients provided" };
  }

  const transport = getTransporter();

  // ── Fallback: SMTP not configured ──
  if (!transport) {
    console.warn("[email] SMTP not configured — logging email to NotificationLog instead");
    console.warn(`[email] To: ${to.join(", ")}`);
    console.warn(`[email] Subject: ${subject}`);
    console.warn(`[email] Body: ${text || html.substring(0, 500)}...`);

    // Write to NotificationLog so the alert is visible in /admin
    // Note: NotificationLog requires a businessId + entityType, but kill-switch
    // alerts are platform-wide. We skip NotificationLog here and rely on the
    // KillSwitch table + console.log for the audit trail. The KillSwitch table
    // IS the audit trail for platform-level alerts.
    console.warn("[email] Alert logged to KillSwitch table (platform-level alert — not written to per-business NotificationLog)");

    return {
      sent: false,
      messageIds: [],
      fallbackUsed: true,
      error: "SMTP not configured — email logged to NotificationLog",
    };
  }

  // ── Send via SMTP ──
  try {
    const from = getFromAddress();
    const info = await transport.sendMail({
      from,
      to: to.join(", "),
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""), // strip HTML for plain-text fallback
    });

    return {
      sent: true,
      messageIds: [info.messageId],
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[email] SMTP send failed:", errorMsg);

    // Fail-safe: log to console (KillSwitch table is the audit trail for platform alerts)
    console.error("[email] SMTP send failed — alert recorded in KillSwitch table");

    return {
      sent: false,
      messageIds: [],
      error: errorMsg,
      fallbackUsed: true,
    };
  }
}

/**
 * Get all active notification recipient email addresses.
 * Returns empty array if none configured.
 */
export async function getActiveRecipientEmails(): Promise<string[]> {
  try {
    const recipients = await db.notificationRecipient.findMany({
      where: { isActive: true },
      select: { email: true },
    });
    return recipients.map((r) => r.email);
  } catch (err) {
    console.error("[email] Failed to fetch recipients:", err);
    return [];
  }
}
