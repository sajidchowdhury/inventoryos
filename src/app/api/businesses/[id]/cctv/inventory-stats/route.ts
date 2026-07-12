// GET /api/businesses/[id]/cctv/inventory-stats
// Returns dashboard stats for CCTV Inventory Hub:
//   - totalSerialItems, totalProducts, totalStockValue
//   - categoryBreakdown (name, slug, icon, color, productCount, serialCount, stockValue)
//   - lowStockProducts (name, brand, stock, minStock)
//   - search results (if ?q= query param provided)
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
    const searchQuery = url.searchParams.get("q")?.trim() || "";

    // ── 1. Total serial items (active, in-stock statuses) ──
    const serialCounts = await db.cCTVSerialItem.groupBy({
      by: ["productId"],
      where: {
        businessId,
        isActive: true,
        status: { in: ["IN_STOCK", "IN_TRANSIT"] },
      },
      _count: { id: true },
      _sum: { costPrice: true },
    });

    // Map productId → { count, totalCost }
    const serialMap = new Map<
      string,
      { count: number; totalCost: number }
    >();
    let totalSerialItems = 0;
    for (const row of serialCounts) {
      const count = row._count.id;
      const totalCost = row._sum.costPrice || 0;
      serialMap.set(row.productId, { count, totalCost });
      totalSerialItems += count;
    }

    // ── 2. Category breakdown ──
    const categories = await db.cCTVCategory.findMany({
      where: { businessId, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        color: true,
        sortOrder: true,
        products: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            stock: true,
            costPrice: true,
            serialTracked: true,
            minStock: true,
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    let totalProducts = 0;
    let totalStockValue = 0;

    const categoryBreakdown = categories.map((cat) => {
      let catSerialCount = 0;
      let catStockValue = 0;
      let catProductCount = 0;

      for (const prod of cat.products) {
        catProductCount++;
        totalProducts++;

        if (prod.serialTracked) {
          const s = serialMap.get(prod.id);
          if (s) {
            catSerialCount += s.count;
            catStockValue += s.totalCost;
          }
        } else {
          // Non-serial: use product.stock field
          catStockValue += prod.costPrice * prod.stock;
        }
      }

      totalStockValue += catStockValue;

      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon,
        color: cat.color,
        productCount: catProductCount,
        serialCount: catSerialCount,
        stockValue: catStockValue,
      };
    });

    // Also count products without a category
    const uncatProducts = await db.cCTVProduct.findMany({
      where: { businessId, isActive: true, categoryId: null },
      select: { id: true, stock: true, costPrice: true, serialTracked: true },
    });
    for (const prod of uncatProducts) {
      totalProducts++;
      if (prod.serialTracked) {
        const s = serialMap.get(prod.id);
        if (s) totalStockValue += s.totalCost;
      } else {
        totalStockValue += prod.costPrice * prod.stock;
      }
    }

    // ── 3. Low stock products ──
    const lowStockProducts = await db.cCTVProduct.findMany({
      where: {
        businessId,
        isActive: true,
        minStock: { gt: 0 },
        // For non-serial products: stock <= minStock
        // For serial-tracked products: count of IN_STOCK serials <= minStock
      },
      select: {
        id: true,
        name: true,
        brand: true,
        stock: true,
        minStock: true,
        serialTracked: true,
        costPrice: true,
        sellPrice: true,
      },
      take: 20,
      orderBy: { stock: "asc" },
    });

    // Filter for actual low stock
    const lowStock = lowStockProducts
      .map((p) => {
        let effectiveStock: number;
        if (p.serialTracked) {
          const s = serialMap.get(p.id);
          effectiveStock = s ? s.count : 0;
        } else {
          effectiveStock = p.stock;
        }
        return { ...p, effectiveStock };
      })
      .filter((p) => p.effectiveStock <= p.minStock)
      .slice(0, 10);

    // ── 4. Search results (if query provided) ──
    let searchResults: Array<{
      id: string;
      name: string;
      brand: string | null;
      serialNumber?: string;
      stock: number;
      sellPrice: number;
      serialTracked: boolean;
    }> | null = null;

    if (searchQuery.length >= 2) {
      const productHits = await db.cCTVProduct.findMany({
        where: {
          businessId,
          isActive: true,
          OR: [
            { name: { contains: searchQuery, mode: "insensitive" } },
            { brand: { contains: searchQuery, mode: "insensitive" } },
            { model: { contains: searchQuery, mode: "insensitive" } },
            { sku: { contains: searchQuery, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          name: true,
          brand: true,
          stock: true,
          sellPrice: true,
          serialTracked: true,
        },
        take: 15,
      });

      const serialHits = await db.cCTVSerialItem.findMany({
        where: {
          businessId,
          isActive: true,
          status: { in: ["IN_STOCK", "IN_TRANSIT"] },
          OR: [
            { serialNumber: { contains: searchQuery, mode: "insensitive" } },
            { imei: { contains: searchQuery, mode: "insensitive" } },
          ],
        },
        // NOTE: Prisma 6 disallows using `select` and `include` together.
        // Put the relation inside `select` instead.
        select: {
          id: true,
          serialNumber: true,
          productId: true,
          costPrice: true,
          product: {
            select: {
              name: true,
              brand: true,
              sellPrice: true,
              serialTracked: true,
              stock: true,
            },
          },
        },
        take: 10,
      });

      searchResults = [
        ...productHits.map((p) => ({
          id: p.id,
          name: p.name,
          brand: p.brand,
          stock: p.stock,
          sellPrice: p.sellPrice,
          serialTracked: p.serialTracked,
        })),
        ...serialHits.map((s) => ({
          id: s.product.id,
          name: s.product.name,
          brand: s.product.brand,
          serialNumber: s.serialNumber,
          stock: s.product.stock,
          sellPrice: s.product.sellPrice,
          serialTracked: s.product.serialTracked,
        })),
      ];
    }

    return NextResponse.json({
      success: true,
      totalSerialItems,
      totalProducts,
      totalStockValue,
      categoryBreakdown,
      lowStock,
      searchResults,
    });
  } catch (error) {
    console.error("Inventory Stats API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory stats" },
      { status: 500 }
    );
  }
}