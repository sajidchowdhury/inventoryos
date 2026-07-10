// GET /api/businesses/[id]/reports/inventory-valuation
// Full inventory valuation by product, category, batch with cost & MRP
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const format = req.nextUrl.searchParams.get("format") || "json";

    // Fetch all batches with stock (exclude destroyed)
    const batches = await db.batch.findMany({
      where: { businessId, quantity: { gt: 0 }, status: { not: "destroyed" } },
      include: {
        product: {
          select: {
            id: true, name: true, genericName: true, strength: true,
            unit: true, manufacturer: true,
            category: { select: { id: true, name: true, color: true } },
          },
        },
      },
      orderBy: [{ product: { name: "asc" } }, { expiryDate: "asc" }],
    });

    // Aggregate by product
    const productMap = new Map<string, {
      productId: string;
      productName: string;
      genericName: string | null;
      strength: string | null;
      unit: string;
      manufacturer: string | null;
      category: { id: string; name: string; color: string } | null;
      totalQuantity: number;
      batchCount: number;
      costValue: number;
      mrpValue: number;
      potentialProfit: number;
      batches: Array<{
        batchNo: string;
        quantity: number;
        expiryDate: string;
        status: string;
        purchasePrice: number | null;
        mrp: number | null;
        costValue: number;
        mrpValue: number;
      }>;
    }>();

    // Aggregate by category
    const categoryMap = new Map<string, { name: string; color: string; totalQuantity: number; costValue: number; mrpValue: number; productCount: number }>();

    let grandTotalCost = 0;
    let grandTotalMRP = 0;
    let grandTotalQuantity = 0;
    let totalBatches = 0;

    for (const batch of batches) {
      const cost = batch.purchasePrice || 0;
      const mrp = batch.mrp || 0;
      const costValue = cost * batch.quantity;
      const mrpValue = mrp * batch.quantity;

      grandTotalCost += costValue;
      grandTotalMRP += mrpValue;
      grandTotalQuantity += batch.quantity;
      totalBatches++;

      // Product aggregation
      const prodKey = batch.productId;
      const prod = productMap.get(prodKey) || {
        productId: batch.productId,
        productName: batch.product.name,
        genericName: batch.product.genericName,
        strength: batch.product.strength,
        unit: batch.product.unit,
        manufacturer: batch.product.manufacturer,
        category: batch.product.category,
        totalQuantity: 0,
        batchCount: 0,
        costValue: 0,
        mrpValue: 0,
        potentialProfit: 0,
        batches: [],
      };
      prod.totalQuantity += batch.quantity;
      prod.batchCount++;
      prod.costValue += costValue;
      prod.mrpValue += mrpValue;
      prod.potentialProfit += mrpValue - costValue;
      prod.batches.push({
        batchNo: batch.batchNo,
        quantity: batch.quantity,
        expiryDate: batch.expiryDate.toISOString(),
        status: batch.status,
        purchasePrice: batch.purchasePrice,
        mrp: batch.mrp,
        costValue,
        mrpValue,
      });
      productMap.set(prodKey, prod);

      // Category aggregation
      const catKey = batch.product.category?.id || "uncategorized";
      const cat = categoryMap.get(catKey) || {
        name: batch.product.category?.name || "Uncategorized",
        color: batch.product.category?.color || "#6b7280",
        totalQuantity: 0,
        costValue: 0,
        mrpValue: 0,
        productCount: 0,
      };
      cat.totalQuantity += batch.quantity;
      cat.costValue += costValue;
      cat.mrpValue += mrpValue;
      categoryMap.set(catKey, cat);
    }

    const products = Array.from(productMap.values()).sort((a, b) => b.costValue - a.costValue);
    const categories = Array.from(categoryMap.values()).sort((a, b) => b.costValue - a.costValue);

    // Add unique product count per category
    categories.forEach((cat) => {
      cat.productCount = products.filter((p) => p.category?.name === cat.name).length;
    });

    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalProducts: products.length,
        totalBatches,
        totalQuantity: grandTotalQuantity,
        totalCostValue: grandTotalCost,
        totalMRPValue: grandTotalMRP,
        totalPotentialProfit: grandTotalMRP - grandTotalCost,
        averageMargin: grandTotalCost > 0 ? ((grandTotalMRP - grandTotalCost) / grandTotalCost) * 100 : 0,
      },
      categories,
      products,
    };

    // CSV format
    if (format === "csv") {
      const lines = [
        `InventoryOS Inventory Valuation Report`,
        `Generated: ${new Date().toLocaleString()}`,
        ``,
        `Summary:`,
        `Total Products,${products.length}`,
        `Total Batches,${totalBatches}`,
        `Total Units,${grandTotalQuantity}`,
        `Total Cost Value,৳${grandTotalCost.toFixed(2)}`,
        `Total MRP Value,৳${grandTotalMRP.toFixed(2)}`,
        `Potential Profit,৳${(grandTotalMRP - grandTotalCost).toFixed(2)}`,
        ``,
        `Product,Batch No,Quantity,Unit,Purchase Price,MRP,Cost Value,MRP Value,Profit,Expiry,Status,Category`,
      ];

      for (const product of products) {
        for (const batch of product.batches) {
          lines.push(
            `"${product.productName}",${batch.batchNo},${batch.quantity},${product.unit},${batch.purchasePrice || ""},${batch.mrp || ""},${batch.costValue.toFixed(2)},${batch.mrpValue.toFixed(2)},${(batch.mrpValue - batch.costValue).toFixed(2)},${batch.expiryDate.split("T")[0]},${batch.status},"${product.category?.name || ""}"`
          );
        }
      }

      return new NextResponse(lines.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="inventory_valuation_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error("Inventory valuation error:", error);
    return NextResponse.json({ error: "Failed to generate valuation" }, { status: 500 });
  }
}
