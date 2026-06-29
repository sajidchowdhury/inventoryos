// src/lib/email.ts
// Email sending infrastructure for kill-switch notifications + report delivery.
//
// Phase 6: SMTP config is now DYNAMIC — stored in the SmtpConfig DB table and
// editable from /admin/api-setup → SMTP tab. Falls back to environment variables
// (SMTP_HOST etc.) if no DB row exists.
//
// If SMTP is not configured (neither DB nor env vars), emails are logged to
// the console so nothing is lost.

import nodemailer from "nodemailer";
import { db } from "./db";

// ── Types ──
export interface EmailPayload {
  to: string[];
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  sent: boolean;
  messageIds: string[];
  error?: string;
  fallbackUsed?: boolean;
}

// ── Cached SMTP config (refreshed every 5 minutes) ──
interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  password: string;
  fromEmail: string | null;
  fromName: string;
  source: "database" | "env" | "none";
}

let cachedSettings: SmtpSettings | null = null;
let cacheExpiry: Date | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load SMTP settings. Checks DB first, then env vars, then returns null.
 */
async function getSmtpSettings(): Promise<SmtpSettings | null> {
  // Check cache
  if (cachedSettings && cacheExpiry && cacheExpiry > new Date()) {
    return cachedSettings;
  }

  try {
    // Try DB first
    const dbConfig = await db.smtpConfig.findUnique({
      where: { id: "default" },
    });

    if (dbConfig && dbConfig.isActive) {
      cachedSettings = {
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        fromEmail: dbConfig.fromEmail,
        fromName: dbConfig.fromName,
        source: "database",
      };
      cacheExpiry = new Date(Date.now() + CACHE_TTL_MS);
      return cachedSettings;
    }
  } catch (err) {
    console.error("[email] Failed to load SmtpConfig from DB:", err);
  }

  // Fall back to environment variables
  const envHost = process.env.SMTP_HOST;
  const envUser = process.env.SMTP_USER;
  const envPass = process.env.SMTP_PASS;

  if (envHost && envUser && envPass) {
    cachedSettings = {
      host: envHost,
      port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
      user: envUser,
      password: envPass,
      fromEmail: process.env.SMTP_FROM || null,
      fromName: "InventoryOS",
      source: "env",
    };
    cacheExpiry = new Date(Date.now() + CACHE_TTL_MS);
    return cachedSettings;
  }

  // Not configured
  cachedSettings = null;
  cacheExpiry = new Date(Date.now() + CACHE_TTL_MS);
  return null;
}

/**
 * Force refresh the cached SMTP settings (called after admin updates config).
 */
export function refreshSmtpCache(): void {
  cachedSettings = null;
  cacheExpiry = null;
}

// ── Transporter (recreated when settings change) ──
let transporter: nodemailer.Transporter | null = null;
let transporterSettingsHash: string | null = null;

async function getTransporter(): Promise<nodemailer.Transporter | null> {
  const settings = await getSmtpSettings();
  if (!settings) return null;

  // Recreate transporter if settings changed
  const hash = `${settings.host}:${settings.port}:${settings.user}`;
  if (transporter && transporterSettingsHash === hash) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    auth: { user: settings.user, pass: settings.password },
  });
  transporterSettingsHash = hash;
  return transporter;
}

/**
 * Check if SMTP is configured (DB or env vars).
 */
export async function isEmailConfigured(): Promise<boolean> {
  const settings = await getSmtpSettings();
  return settings !== null;
}

/**
 * Get SMTP config status for UI display.
 */
export async function getSmtpStatus(): Promise<{
  configured: boolean;
  source: "database" | "env" | "none";
  host: string | null;
  port: number | null;
  user: string | null;
  fromEmail: string | null;
  fromName: string | null;
}> {
  const settings = await getSmtpSettings();
  if (!settings) {
    return {
      configured: false,
      source: "none",
      host: null, port: null, user: null, fromEmail: null, fromName: null,
    };
  }
  return {
    configured: true,
    source: settings.source,
    host: settings.host,
    port: settings.port,
    user: settings.user,
    fromEmail: settings.fromEmail,
    fromName: settings.fromName,
  };
}

/**
 * Get the configured From: address.
 */
export async function getFromAddress(): Promise<string> {
  const settings = await getSmtpSettings();
  if (!settings) return "noreply@inventoryos.local";
  if (settings.fromEmail) {
    return `${settings.fromName} <${settings.fromEmail}>`;
  }
  return settings.user;
}

/**
 * Send an email to one or more recipients.
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const { to, subject, html, text } = payload;

  if (!to || to.length === 0) {
    return { sent: false, messageIds: [], error: "No recipients provided" };
  }

  const transport = await getTransporter();

  // ── Fallback: SMTP not configured ──
  if (!transport) {
    console.warn("[email] SMTP not configured — logging to console");
    console.warn(`[email] To: ${to.join(", ")}`);
    console.warn(`[email] Subject: ${subject}`);
    console.warn(`[email] Body: ${text || html.substring(0, 500)}...`);
    console.warn("[email] Configure SMTP in /admin/api-setup → SMTP tab");

    return {
      sent: false,
      messageIds: [],
      fallbackUsed: true,
      error: "SMTP not configured. Set SMTP credentials in /admin/api-setup → SMTP tab.",
    };
  }

  // ── Send via SMTP ──
  try {
    const from = await getFromAddress();
    const info = await transport.sendMail({
      from,
      to: to.join(", "),
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""),
    });

    return {
      sent: true,
      messageIds: [info.messageId],
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[email] SMTP send failed:", errorMsg);

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
