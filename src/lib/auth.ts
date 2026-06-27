// ── InventoryOS: Auth Utilities ──
// Helper functions for authentication and session management

import bcrypt from "bcryptjs";
import crypto from "crypto";

const SALT_ROUNDS = 12;

/** Hash a plain-text password using bcrypt */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/** Verify a plain-text password against a bcrypt hash */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Generate a secure random session token */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Generate a 4-digit OTP code */
export function generateOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/** Validate BD phone number format (+8801XXXXXXXXX or 01XXXXXXXXX) */
export function isValidBdPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  return /^(\+880|880|0)1[3-9]\d{8}$/.test(cleaned);
}

/** Normalize a BD phone number to +8801XXXXXXXXX format */
export function normalizeBdPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+880")) return cleaned;
  if (cleaned.startsWith("880")) return `+${cleaned}`;
  if (cleaned.startsWith("0")) return `+88${cleaned}`;
  return `+880${cleaned}`;
}
