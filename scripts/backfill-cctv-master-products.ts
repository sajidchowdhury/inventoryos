// =============================================================================
// Phase 3E — Backfill existing CCTV products to the master catalog
// =============================================================================
//
// This script iterates over every CCTVProduct in the database, normalizes the
// brand and model fields, and searches the CCTVMasterProduct table for a
// matching entry by normalized (brand, model). If a match is found, it sets
// the CCTVProduct's masterProductId to the matched master product's id.
//
// For CCTVProducts with no match:
//   - If the brand is non-empty and not "Generic", a new CCTVMasterProduct
//     is created with isApproved: false (pending admin review) and the
//     CCTVProduct is linked to it. This populates the admin review queue.
//   - If the brand is empty or "Generic", the CCTVProduct is left with
//     masterProductId: null (it remains a private product).
//
// The script is IDEMPOTENT — running it twice produces the same result.
// Already-linked products are skipped.
//
// Usage:
//   bunx tsx scripts/backfill-cctv-master-products.ts
//
// Or with a custom database URL:
//   DATABASE_URL="postgresql://..." bunx tsx scripts/backfill-cctv-master-products.ts
//
// =============================================================================

import { db } from "../src/lib/db";

// ── Helpers ──

function normalizeBrand(brand: string): string {
  return brand.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeModel(model: string | null | undefined): string {
  if (!model) return "";
  return model.trim().toLowerCase().replace(/\s+/g, " ");
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Main ──

async function main() {
  console.log("=== Phase 3E: Backfill CCTV Products to Master Catalog ===\n");

  // Fetch all CCTV products (active and inactive — we want to backfill everything)
  const cctvProducts = await db.cCTVProduct.findMany({
    select: {
      id: true,
      businessId: true,
      name: true,
      brand: true,
      model: true,
      sku: true,
      description: true,
      hsnCode: true,
      unit: true,
      serialTracked: true,
      warrantyMonths: true,
      vatRate: true,
      mrp: true,
      imageUrl: true,
      masterProductId: true,
      categoryId: true,
      category: { select: { id: true, name: true } },
    },
  });

  console.log(`Found ${cctvProducts.length} CCTV products to process\n`);

  // Fetch all master products (active only — we want to match against approved entries)
  const masterProducts = await db.cCTVMasterProduct.findMany({
    where: { isActive: true },
    select: { id: true, name: true, brand: true, model: true },
  });

  console.log(`Found ${masterProducts.length} master catalog entries to match against\n`);

  // Build a lookup map: normalized (brand, model) → master product id
  const masterMap = new Map<string, string>();
  for (const mp of masterProducts) {
    const key = `${normalizeBrand(mp.brand)}|${normalizeModel(mp.model)}`;
    masterMap.set(key, mp.id);
  }

  let alreadyLinked = 0;
  let matched = 0;
  let suggested = 0;
  let skippedGeneric = 0;
  const errors: string[] = [];

  for (const p of cctvProducts) {
    try {
      // Skip if already linked
      if (p.masterProductId) {
        alreadyLinked++;
        continue;
      }

      const normBrand = normalizeBrand(p.brand);
      const normModel = normalizeModel(p.model);

      // Try exact (brand, model) match
      let masterId = masterMap.get(`${normBrand}|${normModel}`);

      // If no model match, try (brand, name) — sometimes the model is stored in the name
      if (!masterId && normModel) {
        // Try matching brand + first part of name as model
        const nameParts = p.name.trim().toLowerCase().split(/\s+/);
        if (nameParts.length > 1) {
          // Try the first 2-3 words as a potential model number
          for (const partCount of [2, 3, 1]) {
            const possibleModel = nameParts.slice(0, partCount).join(" ");
            masterId = masterMap.get(`${normBrand}|${possibleModel}`);
            if (masterId) break;
          }
        }
      }

      if (masterId) {
        // Match found — link it
        await db.cCTVProduct.update({
          where: { id: p.id },
          data: { masterProductId: masterId },
        });
        matched++;
        console.log(`  ✅ MATCHED: ${p.brand} ${p.model || p.name} → master ${masterId}`);
        continue;
      }

      // No match found — check if we should suggest a new master product
      const isGeneric = !p.brand.trim() || normBrand === "generic" || normBrand === "n/a";

      if (isGeneric) {
        // Skip generic items — they don't belong in the master catalog
        skippedGeneric++;
        continue;
      }

      // Suggest a new master product (pending admin review)
      // Use model if available, otherwise use the name (minus the brand prefix)
      let modelForMaster = p.model?.trim() || "";
      if (!modelForMaster) {
        // Try to extract a model from the name (remove the brand prefix)
        const nameWithoutBrand = p.name.replace(new RegExp(`^${p.brand}\\s*`, "i"), "").trim();
        modelForMaster = nameWithoutBrand || p.name;
      }

      // Check if a pending (unapproved) master product already exists for this (brand, model)
      const existingPending = await db.cCTVMasterProduct.findFirst({
        where: {
          brand: p.brand.trim(),
          model: modelForMaster,
          isApproved: false,
        },
        select: { id: true },
      });

      if (existingPending) {
        // Link to the existing pending master product
        await db.cCTVProduct.update({
          where: { id: p.id },
          data: { masterProductId: existingPending.id },
        });
        suggested++;
        console.log(`  📝 LINKED TO PENDING: ${p.brand} ${modelForMaster} → pending master ${existingPending.id}`);
        continue;
      }

      // Create a new pending master product
      const newMaster = await db.cCTVMasterProduct.create({
        data: {
          name: p.name,
          brand: p.brand.trim(),
          model: modelForMaster,
          sku: p.sku || null,
          description: p.description || null,
          hsnCode: p.hsnCode || null,
          defaultCategoryName: p.category?.name || null,
          defaultWarrantyMonths: p.warrantyMonths || 0,
          defaultSerialTracked: p.serialTracked,
          defaultUnit: p.unit || "piece",
          defaultImageUrl: p.imageUrl || null,
          defaultVatRate: p.vatRate || 0,
          defaultMrp: p.mrp || null,
          isApproved: false, // pending admin review
          submittedByBusinessId: p.businessId,
          isActive: true,
        },
      });

      await db.cCTVProduct.update({
        where: { id: p.id },
        data: { masterProductId: newMaster.id },
      });
      suggested++;
      console.log(`  ✨ SUGGESTED: ${p.brand} ${modelForMaster} → new pending master ${newMaster.id}`);
    } catch (err) {
      const msg = `Error processing product ${p.id} (${p.brand} ${p.model}): ${err instanceof Error ? err.message : "Unknown"}`;
      errors.push(msg);
      console.error(`  ❌ ${msg}`);
    }
  }

  // ── Summary ──
  console.log("\n=== Backfill Summary ===\n");
  console.log(`Total CCTV products processed: ${cctvProducts.length}`);
  console.log(`  Already linked (skipped):     ${alreadyLinked}`);
  console.log(`  Matched to existing master:   ${matched}`);
  console.log(`  Suggested new (pending):       ${suggested}`);
  console.log(`  Skipped (generic/no brand):    ${skippedGeneric}`);
  console.log(`  Errors:                        ${errors.length}`);
  if (errors.length > 0) {
    console.log("\nErrors (first 10):");
    errors.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
  }

  const linkedTotal = alreadyLinked + matched + suggested;
  const linkRate = cctvProducts.length > 0
    ? ((linkedTotal / cctvProducts.length) * 100).toFixed(1)
    : "0.0";
  console.log(`\nLink rate: ${linkedTotal}/${cctvProducts.length} (${linkRate}%)`);

  if (suggested > 0) {
    console.log(`\n📝 ${suggested} new master products were created with isApproved=false.`);
    console.log("   An admin should review them at /admin/catalog/cctv (Pending Review tab).");
  }

  console.log("\n✅ Backfill complete.");
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
