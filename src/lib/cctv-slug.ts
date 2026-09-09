// src/lib/cctv-slug.ts
// Shared slug helper for CCTV category POST + PATCH.
//
// Bug context (C-2 / C-3):
//   - POST: if a category with the same slug already exists, Prisma throws
//     P2002 (because schema has @@unique([businessId, slug])). The UI surfaces
//     this as a generic "Failed" toast. Pre-checking + appending `-2`, `-3`,
//     etc. avoids the collision.
//   - PATCH: previously regenerated the slug from the new name on every
//     rename. If the new name's slug collided with another category, the
//     update threw P2002. Same fix: use the shared unique-slug helper.
//
// This helper is intentionally tiny and DB-coupled (takes a `where` factory
// so it works for any model with a businessId-scoped slug). It does NOT use
// a transaction or lock; for the CCTV category volume (a few dozen per
// shop) the race window is negligible and the @@unique constraint is the
// final safety net.

import { db } from "@/lib/db";

/**
 * Build a URL-safe slug from a free-text name.
 * Lowercases, strips non-[a-z0-9-] chars, collapses runs of separators.
 * Returns "" for empty input (caller should handle).
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Returns a slug unique within the given business. If `baseSlug` is taken,
 * appends `-2`, `-3`, etc. until a free slug is found (caps at -99 to
 * prevent runaway loops).
 *
 * Pass `excludeId` when PATCHing — the category being renamed should not
 * collide with its own existing slug.
 */
export async function uniqueCategorySlug(
  businessId: string,
  baseSlug: string,
  excludeId?: string,
): Promise<string> {
  const safeBase = baseSlug || "category";
  const taken = new Set(
    (
      await db.cCTVCategory.findMany({
        where: { businessId, ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { slug: true },
      })
    ).map((c) => c.slug),
  );
  if (!taken.has(safeBase)) return safeBase;
  for (let i = 2; i <= 99; i++) {
    const candidate = `${safeBase}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  // Extremely unlikely fallback — append a timestamp fragment.
  return `${safeBase}-${Date.now().toString(36).slice(-4)}`;
}
