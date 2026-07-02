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

/** Generate a secure random opaque token (phone-proof / trusted-device). */
export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Unambiguous alphabet — no 0/O/1/I/L to keep shop codes easy to read & type.
const SHOP_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Generate a human-friendly, globally-unique-ish shop code such as "PHA-XK7T".
 * The prefix is derived from the business type slug; uniqueness is enforced by
 * the DB unique constraint (callers should retry on collision).
 */
export function generateShopCode(businessTypeSlug?: string): string {
  const prefix = (businessTypeSlug || "SHP")
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
  let suffix = "";
  const bytes = crypto.randomBytes(4);
  for (let i = 0; i < 4; i++) {
    suffix += SHOP_CODE_ALPHABET[bytes[i] % SHOP_CODE_ALPHABET.length];
  }
  return `${prefix}-${suffix}`;
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
