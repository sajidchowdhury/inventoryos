// POST /api/businesses/[id]/catalog/subscribe
// Subscribe to products from the master catalog. Creates Product rows
// linked to MasterProducts with initial stock + selling price.
//
// Body: {
//   items: [
//     { masterProductId: "xxx", stockQty: 100, sellingPrice: 8.50, reorderLevel: 20, rackNo: "A1" },
//     { masterProductId: "yyy", stockQty: 50, sellingPrice: 12.00, reorderLevel: 10 },
//     ...
//   ]
// }
//
// Returns: { created, skipped, errors }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureScdProductSummary } from "@/lib/scd";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;

  try {
    const body = await req.json();
    const items: Array<{
      masterProductId: string;
      stockQty?: number;
      sellingPrice?: number;
      reorderLevel?: number;
      rackNo?: string;
    }> = body.items || [];

    if (items.length === 0) {
      return NextResponse.json({ error: "items array is required" }, { status: 400 });
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    const products: Array<{
      id: string;
      masterProductId: string;
      name: string;
      strength: string | null;
      dosageForm: string | null;
      manufacturer: string | null;
      unit: string;
      rackNo: string | null;
      reorderLevel: number;
      sellingPrice: number | null;
      mrp: number | null;
      currentStock: number;
    }> = [];

    for (const item of items) {
      try {
        const { masterProductId, stockQty = 0, sellingPrice, reorderLevel = 0, rackNo } = item;

        if (!masterProductId) { skipped++; continue; }

        // Check if already subscribed
        const existing = await db.product.findFirst({
          where: { businessId, masterProductId },
        });

        if (existing) {
          const inv = await db.inventory.findFirst({
            where: { businessId, productId: existing.id },
            select: { quantity: true },
          });
          products.push({
            id: existing.id,
            masterProductId,
            name: existing.name,
            strength: existing.strength,
            dosageForm: existing.dosageForm,
            manufacturer: existing.manufacturer,
            unit: existing.unit,
            rackNo: existing.rackNo,
            reorderLevel: existing.reorderLevel,
            sellingPrice: existing.sellingPrice,
            mrp: existing.mrp,
            currentStock: inv?.quantity ?? 0,
          });
          // Reactivate if was inactive
          if (!existing.isActive) {
            await db.product.update({ where: { id: existing.id }, data: { isActive: true } });
            created++;
          } else {
            skipped++;
          }
          continue;
        }

        // Fetch master product for metadata
        const masterProduct = await db.masterProduct.findUnique({
          where: { id: masterProductId },
        });

        if (!masterProduct) {
          errors.push(`Master product ${masterProductId} not found`);
          skipped++;
          continue;
        }

        // Find or create a category for this product
        let categoryId: string | null = null;
        if (masterProduct.categoryName) {
          let category = await db.category.findFirst({
            where: { businessId, name: masterProduct.categoryName },
          });
          if (!category) {
            category = await db.category.create({
              data: {
                businessId,
                name: masterProduct.categoryName,
                slug: masterProduct.categoryName.toLowerCase().replace(/\s+/g, "-"),
                type: "medicine",
                isActive: true,
              },
            });
          }
          categoryId = category.id;
        }

        // Create the Product row linked to MasterProduct
        const product = await db.product.create({
          data: {
            businessId,
            categoryId,
            name: masterProduct.name,
            genericName: masterProduct.genericName,
            barcode: masterProduct.barcode,
            productType: "medicine",
            unit: masterProduct.unit,
            stripSize: masterProduct.stripSize,
            boxSize: masterProduct.boxSize,
            strength: masterProduct.strength,
            dosageForm: masterProduct.dosageForm,
            manufacturer: masterProduct.manufacturerStr,
            scheduleType: masterProduct.scheduleType,
            hsnCode: masterProduct.hsnCode,
            vatRate: masterProduct.vatRate,
            mrp: masterProduct.defaultMrp,
            masterProductId,
            sellingPrice: sellingPrice || masterProduct.defaultMrp,
            reorderLevel,
            rackNo: rackNo || null,
            isActive: true,
          },
        });

        // Create Inventory row with initial stock
        await db.inventory.create({
          data: {
            businessId,
            productId: product.id,
            quantity: stockQty,
            minStock: 0,
          },
        });

        products.push({
          id: product.id,
          masterProductId,
          name: product.name,
          strength: product.strength,
          dosageForm: product.dosageForm,
          manufacturer: product.manufacturer,
          unit: product.unit,
          rackNo: product.rackNo,
          reorderLevel: product.reorderLevel,
          sellingPrice: product.sellingPrice,
          mrp: product.mrp,
          currentStock: stockQty,
        });
        try {
          await ensureScdProductSummary(businessId, product.id);
        } catch (scdErr) {
          console.error("SCD summary for catalog product:", scdErr);
        }
        created++;
      } catch (err) {
        errors.push(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `${created} products added to your inventory, ${skipped} skipped`,
      created,
      skipped,
      products,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error("[catalog/subscribe] failed:", error);
    return NextResponse.json({ error: "Subscribe failed" }, { status: 500 });
  }
}
