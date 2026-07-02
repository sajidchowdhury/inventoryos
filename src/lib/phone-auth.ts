// ── InventoryOS: Phone-based auth helpers ──
// Shared logic for the "I own a business" door (OTP + trusted device).
// Keeps verify-otp and trusted-device consistent.

import { db } from "@/lib/db";
import { generateOpaqueToken } from "@/lib/auth";

// Lifetimes
const PHONE_TOKEN_TTL_MS = 10 * 60 * 1000;        // 10 minutes (short-lived OTP proof)
const TRUSTED_DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface OwnerBusiness {
  id: string;
  name: string;
  address: string | null;
  shopCode: string | null;
  businessType: { slug: string; name: string; color: string; icon: string };
  hasCredentials: boolean;
  businessUsers: { id: string; username: string; role: string }[];
}

/** List the active businesses owned by this phone-user (shape used by the UI). */
export async function listOwnerBusinesses(userId: string): Promise<OwnerBusiness[]> {
  const businesses = await db.business.findMany({
    where: { userId, isActive: true },
    include: {
      businessType: { select: { slug: true, name: true, color: true, icon: true } },
      businessUsers: {
        where: { isActive: true },
        select: { id: true, username: true, role: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return businesses.map((b) => ({
    id: b.id,
    name: b.name,
    address: b.address,
    shopCode: b.shopCode,
    businessType: b.businessType,
    hasCredentials: b.businessUsers.length > 0,
    businessUsers: b.businessUsers,
  }));
}

/**
 * Issue a short-lived phone-proof token. Required by owner-login so a raw
 * userId from the client can never be used to enter a shop without OTP.
 */
export async function issuePhoneToken(userId: string): Promise<string> {
  const token = generateOpaqueToken();
  await db.phoneAuthToken.create({
    data: { userId, token, expiresAt: new Date(Date.now() + PHONE_TOKEN_TTL_MS) },
  });
  return token;
}

/** Validate a phone-proof token; returns the userId or null if invalid/expired. */
export async function verifyPhoneToken(token: string): Promise<string | null> {
  if (!token) return null;
  const record = await db.phoneAuthToken.findFirst({
    where: { token, expiresAt: { gt: new Date() } },
  });
  return record?.userId ?? null;
}

/** Create a long-lived trusted-device token for skip-OTP returns. */
export async function createTrustedDevice(
  userId: string,
  deviceInfo: string | null
): Promise<string> {
  const token = generateOpaqueToken();
  await db.trustedDevice.create({
    data: {
      userId,
      token,
      deviceInfo,
      expiresAt: new Date(Date.now() + TRUSTED_DEVICE_TTL_MS),
    },
  });
  return token;
}
