// GET /api/businesses/[id]/reports/stock
// Stock Report: returns comprehensive stock data with category breakdown,
// product-level stock info, and summary stats.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const categoryId = url.searchParams.get("categoryId") || "";
    const search = url.searchParams.get("q")?.trim() || "";
    const statusFilter = url.searchParams.get("status") || "";

    // ── Summary stats ──
    const totalProducts = await db.mSProduct.count({
      where: { businessId, isActive: true },
    });

    // Count serial items by status
    const serialStatusCounts = await db.mSSerialItem.groupBy({
      by: ["status"],
      where: { businessId, isActive: true },
      _count: { id: true },
    });
    const statusCountMap: Record<string, number> = {};
    let totalInStock = 0;
    for (const row of serialStatusCounts) {
      statusCountMap[row.status] = row._count.id;
      if (row.status === "IN_STOCK" || row.status === "IN_TRANSIT") {
        totalInStock += row._count.id;
      }
    }

    // Total stock value
    const serialValueAgg = await db.mSSerialItem.aggregate({
      where: {
        businessId,
        isActive: true,
        status: { in: ["IN_STOCK", "IN_TRANSIT"] },
      },
      _sum: { costPrice: true, sellPrice: true },
    });
    const totalCostValue = serialValueAgg._sum.costPrice || 0;
    const totalSellValue = serialValueAgg._sum.sellPrice || 0;

    // Non-serial products value
    const nonSerialProducts = await db.mSProduct.findMany({
      where: { businessId, isActive: true, serialTracked: false },
      select: { stock: true, costPrice: true, sellPrice: true },
    });
    let nonSerialCostValue = 0;
    let nonSerialSellValue = 0;
    let nonSerialStock = 0;
    for (const p of nonSerialProducts) {
      nonSerialCostValue += p.costPrice * p.stock;
      nonSerialSellValue += p.sellPrice * p.stock;
      nonSerialStock += p.stock;
    }

    const grandCostValue = totalCostValue + nonSerialCostValue;
    const grandSellValue = totalSellValue + nonSerialSellValue;

    // ── Category breakdown ──
    const categories = await db.mSCategory.findMany({
      where: { businessId, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        color: true,
        products: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            stock: true,
            costPrice: true,
            sellPrice: true,
            serialTracked: true,
            brand: true,
            model: true,
            minStock: true,
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    // Build product stock data with serial counts
    const serialCountsByProduct = await db.mSSerialItem.groupBy({
      by: ["productId", "status"],
      where: {
        businessId,
        isActive: true,
      },
      _count: { id: true },
      _sum: { costPrice: true, sellPrice: true },
    });

    // Map: productId → status → { count, totalCost, totalSell }
    type StockInfo = { count: number; totalCost: number; totalSell: number };
    const productStockMap = new Map<string, Map<string, StockInfo>>();
    for (const row of serialCountsByProduct) {
      if (!productStockMap.has(row.productId)) {
        productStockMap.set(row.productId, new Map());
      }
      productStockMap.get(row.productId)!.set(row.status, {
        count: row._count.id,
        totalCost: row._sum.costPrice || 0,
        totalSell: row._sum.sellPrice || 0,
      });
    }

    function getProductStockInfo(product: {
      id: string;
      name: string;
      stock: number;
      costPrice: number;
      sellPrice: number;
      serialTracked: boolean;
      brand: string | null;
      model: string | null;
      minStock: number;
    }) {
      const statusMap = productStockMap.get(product.id);

      if (product.serialTracked && statusMap) {
        const inStock = statusMap.get("IN_STOCK");
        const inTransit = statusMap.get("IN_TRANSIT");
        const sold = statusMap.get("SOLD");
        const installed = statusMap.get("INSTALLED");
        const damaged = statusMap.get("DAMAGED");
        const returned = statusMap.get("RETURNED");

        const availableCount = (inStock?.count || 0) + (inTransit?.count || 0);
        const costValue = (inStock?.totalCost || 0) + (inTransit?.totalCost || 0);
        const sellValue = (inStock?.totalSell || 0) + (inTransit?.totalSell || 0);
        const totalSerials = Array.from(statusMap.values()).reduce((s, v) => s + v.count, 0);

        return {
          productId: product.id,
          productName: product.name,
          brand: product.brand,
          model: product.model,
          serialTracked: true,
          available: availableCount,
          inStock: inStock?.count || 0,
          inTransit: inTransit?.count || 0,
          sold: sold?.count || 0,
          installed: installed?.count || 0,
          damaged: damaged?.count || 0,
          returned: returned?.count || 0,
          totalSerials,
          costPrice: product.costPrice,
          sellPrice: product.sellPrice,
          costValue,
          sellValue,
          minStock: product.minStock,
          isLowStock: product.minStock > 0 && availableCount <= product.minStock,
          isOutOfStock: availableCount === 0 && totalSerials === 0,
        };
      } else if (product.serialTracked) {
        // Serial tracked but no serial items yet
        return {
          productId: product.id,
          productName: product.name,
          brand: product.brand,
          model: product.model,
          serialTracked: true,
          available: 0,
          inStock: 0,
          inTransit: 0,
          sold: 0,
          installed: 0,
          damaged: 0,
          returned: 0,
          totalSerials: 0,
          costPrice: product.costPrice,
          sellPrice: product.sellPrice,
          costValue: 0,
          sellValue: 0,
          minStock: product.minStock,
          isLowStock: false,
          isOutOfStock: true,
        };
      } else {
        // Non-serial product
        const available = product.stock;
        return {
          productId: product.id,
          productName: product.name,
          brand: product.brand,
          model: product.model,
          serialTracked: false,
          available,
          inStock: available,
          inTransit: 0,
          sold: 0,
          installed: 0,
          damaged: 0,
          returned: 0,
          totalSerials: 0,
          costPrice: product.costPrice,
          sellPrice: product.sellPrice,
          costValue: product.costPrice * available,
          sellValue: product.sellPrice * available,
          minStock: product.minStock,
          isLowStock: product.minStock > 0 && available <= product.minStock,
          isOutOfStock: available === 0,
        };
      }
    }

    // Build report data
    let allProducts: ReturnType<typeof getProductStockInfo>[] = [];

    for (const cat of categories) {
      for (const prod of cat.products) {
        allProducts.push(getProductStockInfo(prod));
      }
    }

    // Uncategorized products
    const uncatProducts = await db.mSProduct.findMany({
      where: { businessId, isActive: true, categoryId: null },
      select: {
        id: true,
        name: true,
        stock: true,
        costPrice: true,
        sellPrice: true,
        serialTracked: true,
        brand: true,
        model: true,
        minStock: true,
      },
    });
    for (const prod of uncatProducts) {
      allProducts.push(getProductStockInfo(prod));
    }

    // Apply filters
    if (categoryId) {
      const cat = categories.find((c) => c.id === categoryId);
      if (cat) {
        const catProductIds = new Set(cat.products.map((p) => p.id));
        allProducts = allProducts.filter((p) => catProductIds.has(p.productId));
      }
    }

    if (search) {
      const q = search.toLowerCase();
      allProducts = allProducts.filter(
        (p) =>
          p.productName.toLowerCase().includes(q) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.model && p.model.toLowerCase().includes(q))
      );
    }

    if (statusFilter === "low-stock") {
      allProducts = allProducts.filter((p) => p.isLowStock);
    } else if (statusFilter === "out-of-stock") {
      allProducts = allProducts.filter((p) => p.isOutOfStock);
    } else if (statusFilter === "in-stock") {
      allProducts = allProducts.filter((p) => p.available > 0);
    }

    // Category summary for the report
    const categorySummary = categories.map((cat) => {
      const catProductIds = new Set(cat.products.map((p) => p.id));
      const catProducts = allProducts.filter((p) => catProductIds.has(p.productId));
      const catCostValue = catProducts.reduce((s, p) => s + p.costValue, 0);
      const catSellValue = catProducts.reduce((s, p) => s + p.sellValue, 0);
      const catAvailable = catProducts.reduce((s, p) => s + p.available, 0);
      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon,
        color: cat.color,
        productCount: catProducts.length,
        totalAvailable: catAvailable,
        costValue: catCostValue,
        sellValue: catSellValue,
      };
    });

    // Low stock count
    const lowStockCount = allProducts.filter((p) => p.isLowStock).length;
    const outOfStockCount = allProducts.filter((p) => p.isOutOfStock).length;

    return NextResponse.json({
      success: true,
      summary: {
        totalProducts,
        totalInStock: totalInStock + nonSerialStock,
        totalSerialItems: serialStatusCounts.reduce((s, r) => s + r._count.id, 0),
        totalCostValue: grandCostValue,
        totalSellValue: grandSellValue,
        lowStockCount,
        outOfStockCount,
        potentialProfit: grandSellValue - grandCostValue,
      },
      categorySummary,
      products: allProducts,
    });
  } catch (error) {
    console.error("Stock Report API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock report" },
      { status: 500 }
    );
  }
}