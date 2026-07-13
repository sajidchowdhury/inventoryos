// POST /api/businesses/[id]/catalog/cctv/subscribe
// Subscribe to products from the CCTV master catalog. Creates MSProduct rows
// linked to MSMasterProducts with initial cost/sell price + stock.
//
// Body: {
//   items: [
//     { masterProductId: "xxx", costPrice: 4500, sellPrice: 6000, stockQty: 10 },
//     { masterProductId: "yyy", costPrice: 8500, sellPrice: 11000, stockQty: 5 },
//     ...
//   ]
// }
//
// Returns: { created, skipped, errors, products }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;

  try {
    const body = await req.json();
    const items: Array<{
      masterProductId: string;
      costPrice?: number;
      sellPrice?: number;
      stockQty?: number;
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
      brand: string;
      model: string | null;
      costPrice: number;
      sellPrice: number;
      stock: number;
    }> = [];

    for (const item of items) {
      try {
        const { masterProductId, costPrice = 0, sellPrice = 0, stockQty = 0 } = item;

        if (!masterProductId) { skipped++; continue; }

        // Check if already subscribed
        const existing = await db.mSProduct.findFirst({
          where: { businessId, masterProductId },
        });

        if (existing) {
          products.push({
            id: existing.id,
            masterProductId,
            name: existing.name,
            brand: existing.brand,
            model: existing.model,
            costPrice: existing.costPrice,
            sellPrice: existing.sellPrice,
            stock: existing.stock,
          });
          // Reactivate if was inactive
          if (!existing.isActive) {
            await db.mSProduct.update({ where: { id: existing.id }, data: { isActive: true } });
            created++;
          } else {
            skipped++;
          }
          continue;
        }

        // Fetch master product for metadata
        const masterProduct = await db.mSMasterProduct.findUnique({
          where: { id: masterProductId },
        });

        if (!masterProduct) {
          errors.push(`Master product ${masterProductId} not found`);
          skipped++;
          continue;
        }

        // Find or create a CCTV category for this product
        let categoryId: string | null = null;
        if (masterProduct.defaultCategoryName) {
          const slug = masterProduct.defaultCategoryName
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");
          let category = await db.mSCategory.findFirst({
            where: { businessId, slug },
          });
          if (!category) {
            category = await db.mSCategory.create({
              data: {
                businessId,
                name: masterProduct.defaultCategoryName,
                slug,
                icon: "Package",
                color: "#7c3aed",
                isActive: true,
              },
            });
          }
          categoryId = category.id;
        }

        // Create the MSProduct row linked to MSMasterProduct
        const product = await db.mSProduct.create({
          data: {
            businessId,
            categoryId,
            masterProductId,
            name: masterProduct.name,
            brand: masterProduct.brand,
            model: masterProduct.model,
            sku: masterProduct.sku,
            description: masterProduct.description,
            hsnCode: masterProduct.hsnCode,
            costPrice,
            sellPrice,
            mrp: masterProduct.defaultMrp,
            vatRate: masterProduct.defaultVatRate,
            stock: stockQty,
            unit: masterProduct.defaultUnit,
            serialTracked: masterProduct.defaultSerialTracked,
            warrantyMonths: masterProduct.defaultWarrantyMonths,
            imageUrl: masterProduct.defaultImageUrl,
            isActive: true,
          },
        });

        products.push({
          id: product.id,
          masterProductId,
          name: product.name,
          brand: product.brand,
          model: product.model,
          costPrice: product.costPrice,
          sellPrice: product.sellPrice,
          stock: product.stock,
        });
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
    console.error("[catalog/cctv/subscribe] failed:", error);
    return NextResponse.json({ error: "Subscribe failed" }, { status: 500 });
  }
}
