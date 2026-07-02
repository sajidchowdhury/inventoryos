// src/lib/business-contacts.ts
// Phase 5: Centralized business contact management.
//
// Provides a single helper function getBusinessContact() that all features
// (report delivery, subscription notices, onboarding emails) use to get
// the owner's email or WhatsApp number. Falls back gracefully when fields
// are not set.
//
// Also provides validation functions for email and phone format.

import { db } from "./db";

export interface BusinessContact {
  businessId: string;
  businessName: string;
  ownerEmail: string | null;
  ownerWhatsapp: string | null;
  phone: string | null;
  // Resolved contact (with fallbacks applied)
  email: string | null;    // ownerEmail (no fallback — email must be explicit)
  whatsapp: string | null; // ownerWhatsapp → falls back to phone
}

/**
 * Get the contact info for a business.
 * - email: returns ownerEmail (null if not set — no fallback, must be explicit)
 * - whatsapp: returns ownerWhatsapp, falls back to business.phone if not set
 *
 * Used by: report delivery, subscription notices, onboarding emails.
 */
export async function getBusinessContact(businessId: string): Promise<BusinessContact | null> {
  try {
    const business = await db.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        ownerEmail: true,
        ownerWhatsapp: true,
        phone: true,
      },
    });

    if (!business) return null;

    return {
      businessId: business.id,
      businessName: business.name,
      ownerEmail: business.ownerEmail,
      ownerWhatsapp: business.ownerWhatsapp,
      phone: business.phone,
      email: business.ownerEmail, // No fallback — must be explicitly set
      whatsapp: business.ownerWhatsapp || business.phone || null, // Fallback to business phone
    };
  } catch (err) {
    console.error("[business-contacts] getBusinessContact failed:", err);
    return null;
  }
}

/**
 * Get contacts for ALL businesses (for the Global Dashboard contacts list).
 */
export async function getAllBusinessContacts(): Promise<BusinessContact[]> {
  try {
    const businesses = await db.business.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        ownerEmail: true,
        ownerWhatsapp: true,
        phone: true,
        subscriptionTier: true,
      },
      orderBy: { name: "asc" },
    });

    return businesses.map((b) => ({
      businessId: b.id,
      businessName: b.name,
      ownerEmail: b.ownerEmail,
      ownerWhatsapp: b.ownerWhatsapp,
      phone: b.phone,
      email: b.ownerEmail,
      whatsapp: b.ownerWhatsapp || b.phone || null,
    }));
  } catch (err) {
    console.error("[business-contacts] getAllBusinessContacts failed:", err);
    return [];
  }
}

/**
 * Validate an email address.
 * Basic check: must contain @ and a domain with a dot.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate a WhatsApp phone number.
 * Must start with + and be 10-15 digits total.
 */
export function isValidWhatsapp(phone: string): boolean {
  return /^\+\d{10,15}$/.test(phone);
}

/**
 * Update a business's contact info.
 * Validates email and WhatsApp format before saving.
 */
export async function updateBusinessContact(
  businessId: string,
  updates: { ownerEmail?: string | null; ownerWhatsapp?: string | null }
): Promise<{ success: boolean; error?: string }> {
  const data: any = {};

  if (updates.ownerEmail !== undefined) {
    if (updates.ownerEmail && !isValidEmail(updates.ownerEmail)) {
      return { success: false, error: "Invalid email format. Must contain @ and a domain (e.g., owner@pharmacy.com)" };
    }
    data.ownerEmail = updates.ownerEmail || null;
  }

  if (updates.ownerWhatsapp !== undefined) {
    if (updates.ownerWhatsapp && !isValidWhatsapp(updates.ownerWhatsapp)) {
      return { success: false, error: "Invalid WhatsApp number. Must start with + and be 10-15 digits (e.g., +8801712345678)" };
    }
    data.ownerWhatsapp = updates.ownerWhatsapp || null;
  }

  try {
    await db.business.update({
      where: { id: businessId },
      data,
    });
    return { success: true };
  } catch (err) {
    console.error("[business-contacts] updateBusinessContact failed:", err);
    return { success: false, error: "Database update failed" };
  }
}
