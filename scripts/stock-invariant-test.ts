// =============================================================================
// InventoryOS — CCTV Stock Invariant Test (Fix 5)
// =============================================================================
//
// Verifies that the CCTV stock calculation system is self-consistent.
// For every CCTV product in the database, asserts:
//
//   Serial-tracked products:
//     CCTVProduct.stock == COUNT(CCTVSerialItem WHERE status = 'IN_STOCK')
//
//   Non-serial products:
//     CCTVProduct.stock == Σ(CCTVPurchaseItem.quantity) − Σ(CCTVSaleItem.quantity)
//
// Any mismatch is a data inconsistency — a regression in the stock
// calculation logic, or a historical data issue from before the §1 /
// §3 / Fix 3 / Fix 4 fixes were applied.
//
// The script exits with code 0 if all invariants hold, or code 1 if
// any mismatches are found (suitable for CI).
//
// Usage:
//   bunx tsx scripts/stock-invariant-test.ts
//
// Or with a custom database URL:
//   DATABASE_URL="postgresql://..." bunx tsx scripts/stock-invariant-test.ts
//
// Options:
//   --fix     Attempt to auto-repair mismatches by updating
//             CCTVProduct.stock to match the computed value.
//             (Dry-run by default — does NOT write unless --fix is passed.)
//
//   --verbose Print every product checked (not just mismatches).
//
// =============================================================================

import { db } from "../src/lib/db";

// ── CLI flags ──
const args = process.argv.slice(2);
const SHOULD_FIX = args.includes("--fix");
const VERBOSE = args.includes("--verbose") || args.includes("-v");

// ── Types ──
interface Mismatch {
  productId: string;
  productName: string;
  serialTracked: boolean;
  recordedStock: number;
  computedStock: number;
  difference: number;
}

// ── Main ──
async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  CCTV Stock Invariant Test (Fix 5)");
  console.log("═══════════════════════════════════════════════════════════");
  console.log();

  // Load all active CCTV products
  const products = await db.cCTVProduct.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      brand: true,
      stock: true,
      serialTracked: true,
    },
    orderBy: { name: "asc" },
  });

  console.log(`Checking ${products.length} active CCTV product(s)...`);
  if (SHOULD_FIX) {
    console.log("⚠️  --fix mode: WILL update CCTVProduct.stock to match computed value.");
  } else {
    console.log("Dry-run mode: will NOT write any changes. Pass --fix to auto-repair.");
  }
  console.log();

  const mismatches: Mismatch[] = [];
  let checked = 0;
  let passed = 0;

  for (const product of products) {
    checked++;
    let computedStock: number;

    if (product.serialTracked) {
      // ── Invariant 1: serial-tracked ──
      // CCTVProduct.stock should equal the count of IN_STOCK serials.
      const inStockCount = await db.cCTVSerialItem.count({
        where: {
          businessId: undefined as any, // not needed — productId is globally unique via cuid
          productId: product.id,
          status: "IN_STOCK",
        },
      });
      computedStock = inStockCount;
    } else {
      // ── Invariant 2: non-serial ──
      // CCTVProduct.stock should equal total purchased − total sold.
      const purchaseItems = await db.cCTVPurchaseItem.findMany({
        where: { productId: product.id },
        select: { quantity: true },
      });
      const saleItems = await db.cCTVSaleItem.findMany({
        where: { productId: product.id },
        select: { quantity: true },
      });
      const totalPurchased = purchaseItems.reduce((s, x) => s + x.quantity, 0);
      const totalSold = saleItems.reduce((s, x) => s + x.quantity, 0);
      computedStock = totalPurchased - totalSold;
    }

    const recordedStock = product.stock;
    const difference = recordedStock - computedStock;

    if (difference !== 0) {
      mismatches.push({
        productId: product.id,
        productName: `${product.name} (${product.brand})`,
        serialTracked: product.serialTracked,
        recordedStock,
        computedStock,
        difference,
      });
    } else {
      passed++;
    }

    if (VERBOSE) {
      const status = difference === 0 ? "✅" : "❌";
      const type = product.serialTracked ? "serial" : "non-serial";
      console.log(
        `  ${status} ${product.name} (${product.brand}) [${type}] recorded=${recordedStock} computed=${computedStock}`
      );
    }
  }

  // ── Report ──
  console.log();
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Results: ${passed}/${checked} passed, ${mismatches.length} mismatch(es)`);
  console.log("═══════════════════════════════════════════════════════════");

  if (mismatches.length > 0) {
    console.log();
    console.log("Mismatches:");
    console.log();
    for (const m of mismatches) {
      const type = m.serialTracked ? "serial" : "non-serial";
      console.log(
        `  ❌ ${m.productName} [${type}]`
      );
      console.log(
        `     recorded stock: ${m.recordedStock}`
      );
      console.log(
        `     computed stock: ${m.computedStock} (${m.serialTracked ? "IN_STOCK serial count" : "purchased − sold"})`
      );
      console.log(
        `     difference:     ${m.difference > 0 ? "+" : ""}${m.difference}`
      );
      console.log();

      if (SHOULD_FIX) {
        await db.cCTVProduct.update({
          where: { id: m.productId },
          data: { stock: m.computedStock },
        });
        console.log(`     ✅ FIXED: stock updated to ${m.computedStock}`);
        console.log();
      }
    }

    if (SHOULD_FIX) {
      console.log(`Repaired ${mismatches.length} product(s). Re-run without --fix to verify.`);
    } else {
      console.log("Run with --fix to auto-repair (updates CCTVProduct.stock to match computed value).");
    }
    console.log();
    console.log("⚠️  Mismatches may be caused by:");
    console.log("  - Historical data from before §1 / Fix 3 (serial stock not decremented on sale)");
    console.log("  - Manual DB edits that bypassed the audit trail");
    console.log("  - Bugs in the stock calculation logic (regression)");
    process.exit(1);
  } else {
    console.log();
    console.log("✅ All stock invariants hold. No mismatches found.");
    process.exit(0);
  }
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(2);
  })
  .finally(async () => {
    await db.$disconnect();
  });
