// GET /api/businesses/[id]/cctv/reports/stock
// Returns current stock levels for all products with values and low stock alerts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;

  const products = await db.cCTVProduct.findMany({
    where: { businessId, isActive: true },
    include: { category: { select: { name: true } } },
    orderBy: { stock: "asc" },
  });

  // For serial-tracked products, count IN_STOCK serials
  const stockRows = await Promise.all(
    products.map(async (p) => {
      let effectiveStock = p.stock;
      if (p.serialTracked) {
        const serialCount = await db.cCTVSerialItem.count({
          where: { businessId, productId: p.id, status: "IN_STOCK" },
        });
        effectiveStock = serialCount;
      }
      return {
        id: p.id,
        name: p.name,
        brand: p.brand,
        model: p.model,
        category: p.category?.name || null,
        stock: effectiveStock,
        minStock: p.minStock,
        costPrice: p.costPrice,
        sellPrice: p.sellPrice,
        costValue: effectiveStock * Number(p.costPrice),
        sellValue: effectiveStock * Number(p.sellPrice),
        serialTracked: p.serialTracked,
        unit: p.unit,
        isLowStock: p.minStock > 0 && effectiveStock <= p.minStock,
      };
    })
  );

  const totalProducts = stockRows.length;
  const totalStockValue = stockRows.reduce((s, r) => s + r.costValue, 0);
  const totalSellValue = stockRows.reduce((s, r) => s + r.sellValue, 0);
  const lowStockCount = stockRows.filter((r) => r.isLowStock).length;
  const outOfStockCount = stockRows.filter((r) => r.stock === 0).length;

  return NextResponse.json({
    success: true,
    products: stockRows,
    summary: {
      totalProducts,
      totalStockValue,
      totalSellValue,
      lowStockCount,
      outOfStockCount,
    },
  });
}
