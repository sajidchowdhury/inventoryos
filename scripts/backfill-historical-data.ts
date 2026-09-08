// =============================================================================
// InventoryOS — Historical Data Backfill Script
// =============================================================================
//
// Fixes two categories of historical data issues caused by bugs that have
// since been fixed in code:
//
// 1. PL-1 / E-6: SaleItem.costPrice = 0 for estimate-converted sales
//    (pre-E-6 fix). The convert endpoint now fetches the product's
//    costPrice, but historical converted sales still have 0. This makes
//    the P&L report overstate profit by 100% margin on those sales.
//    Fix: recompute costPrice from the product's current costPrice.
//
// 2. CL-2 / SL-1 / PM-3: Sale.paidAmount / Purchase.paidAmount not
//    updated by standalone payments (pre-PM-3 fix). The /payments
//    endpoint now updates the linked sale/purchase, but historical
//    standalone payments (created before the PM-3 fix) didn't update
//    the sale/purchase records. This means the customer-list and
//    supplier-list balances may be stale.
//    Fix: recompute paidAmount/dueAmount from the actual payment records.
//
// Usage:
//   bunx tsx scripts/backfill-historical-data.ts           # dry-run
//   bunx tsx scripts/backfill-historical-data.ts --fix      # apply fixes
//   bunx tsx scripts/backfill-historical-data.ts --verbose  # print every fix
//
// =============================================================================

import { db } from "../src/lib/db";

const args = process.argv.slice(2);
const SHOULD_FIX = args.includes("--fix");
const VERBOSE = args.includes("--verbose") || args.includes("-v");

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Historical Data Backfill Script");
  console.log("═══════════════════════════════════════════════════════════");
  console.log();

  if (SHOULD_FIX) {
    console.log("⚠️  --fix mode: WILL update records.");
  } else {
    console.log("Dry-run mode: will NOT write any changes. Pass --fix to apply.");
  }
  console.log();

  // ── 1. Fix SaleItem.costPrice = 0 for converted sales ──
  console.log("── 1. Recomputing SaleItem.costPrice for converted sales ──");

  // Find all SaleItems with costPrice = 0 that have a real productId
  const zeroCostItems = await db.cCTVSaleItem.findMany({
    where: {
      costPrice: 0,
      productId: { not: "unknown" },
    },
    select: { id: true, productId: true, productName: true, quantity: true, saleId: true },
  });

  console.log(`  Found ${zeroCostItems.length} SaleItem(s) with costPrice = 0 and a linked product.`);

  let costFixed = 0;
  for (const item of zeroCostItems) {
    const product = await db.cCTVProduct.findUnique({
      where: { id: item.productId },
      select: { costPrice: true, name: true },
    });

    if (product && Number(product.costPrice) > 0) {
      if (VERBOSE) {
        console.log(`  ❌ ${item.productName} — costPrice=0 → product.costPrice=${Number(product.costPrice)}`);
      }
      if (SHOULD_FIX) {
        await db.cCTVSaleItem.update({
          where: { id: item.id },
          data: { costPrice: product.costPrice },
        });
      }
      costFixed++;
    }
  }
  console.log(`  ${SHOULD_FIX ? "Fixed" : "Would fix"} ${costFixed} SaleItem(s).`);
  console.log();

  // ── 2. Recompute Sale.paidAmount/dueAmount from payments ──
  console.log("── 2. Recomputing Sale.paidAmount/dueAmount from payments ──");

  const sales = await db.cCTVSale.findMany({
    select: { id: true, invoiceNo: true, totalAmount: true, paidAmount: true, dueAmount: true },
  });

  console.log(`  Checking ${sales.length} sale(s)...`);

  let salesFixed = 0;
  for (const sale of sales) {
    // Sum all payments linked to this sale
    const payments = await db.cCTVPayment.findMany({
      where: {
        businessId: undefined as any, // not needed for global query
        type: { in: ["sale", "customer_payment"] },
        referenceId: sale.id,
      },
      select: { amount: true },
    });

    const computedPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
    const recordedPaid = Number(sale.paidAmount);
    const totalAmount = Number(sale.totalAmount);
    const computedDue = Math.max(0, totalAmount - computedPaid);

    if (computedPaid !== recordedPaid || computedDue !== Number(sale.dueAmount)) {
      if (VERBOSE) {
        console.log(`  ❌ Sale ${sale.invoiceNo || sale.id.slice(-8)} — recorded paid=${recordedPaid} due=${Number(sale.dueAmount)} → computed paid=${computedPaid} due=${computedDue}`);
      }
      if (SHOULD_FIX) {
        await db.cCTVSale.update({
          where: { id: sale.id },
          data: {
            paidAmount: computedPaid,
            dueAmount: computedDue,
            paymentType: computedDue > 0 ? "credit" : "cash",
          },
        });
      }
      salesFixed++;
    }
  }
  console.log(`  ${SHOULD_FIX ? "Fixed" : "Would fix"} ${salesFixed} sale(s).`);
  console.log();

  // ── 3. Recompute Purchase.paidAmount/dueAmount from payments ──
  console.log("── 3. Recomputing Purchase.paidAmount/dueAmount from payments ──");

  const purchases = await db.cCTVPurchase.findMany({
    select: { id: true, invoiceNo: true, totalAmount: true, paidAmount: true, dueAmount: true },
  });

  console.log(`  Checking ${purchases.length} purchase(s)...`);

  let purchasesFixed = 0;
  for (const purchase of purchases) {
    const payments = await db.cCTVPayment.findMany({
      where: {
        type: { in: ["purchase", "supplier_payment"] },
        referenceId: purchase.id,
      },
      select: { amount: true },
    });

    const computedPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
    const recordedPaid = Number(purchase.paidAmount);
    const totalAmount = Number(purchase.totalAmount);
    const computedDue = Math.max(0, totalAmount - computedPaid);

    if (computedPaid !== recordedPaid || computedDue !== Number(purchase.dueAmount)) {
      if (VERBOSE) {
        console.log(`  ❌ Purchase ${purchase.invoiceNo || purchase.id.slice(-8)} — recorded paid=${recordedPaid} due=${Number(purchase.dueAmount)} → computed paid=${computedPaid} due=${computedDue}`);
      }
      if (SHOULD_FIX) {
        await db.cCTVPurchase.update({
          where: { id: purchase.id },
          data: {
            paidAmount: computedPaid,
            dueAmount: computedDue,
          },
        });
      }
      purchasesFixed++;
    }
  }
  console.log(`  ${SHOULD_FIX ? "Fixed" : "Would fix"} ${purchasesFixed} purchase(s).`);
  console.log();

  // ── Summary ──
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Summary:`);
  console.log(`    SaleItem costPrice fixed:  ${costFixed}`);
  console.log(`    Sale paidAmount fixed:     ${salesFixed}`);
  console.log(`    Purchase paidAmount fixed: ${purchasesFixed}`);
  console.log("═══════════════════════════════════════════════════════════");

  if (!SHOULD_FIX && (costFixed > 0 || salesFixed > 0 || purchasesFixed > 0)) {
    console.log();
    console.log("Run with --fix to apply these changes.");
  } else if (SHOULD_FIX) {
    console.log();
    console.log("✅ All fixes applied. Re-run without --fix to verify.");
  } else {
    console.log();
    console.log("✅ No fixes needed. All data is consistent.");
  }

  process.exit(0);
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(2);
  })
  .finally(async () => {
    await db.$disconnect();
  });
