// GET /api/businesses/[id]/ai/reorder
// Smart reorder suggestions based on sales velocity, stock levels, and lead time
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;

    // Fetch all active products with inventory + batches
    const products = await db.product.findMany({
      where: { businessId, isActive: true },
      include: {
        inventory: true,
        category: { select: { name: true, color: true } },
        batches: {
          where: { quantity: { gt: 0 }, status: { in: ["active", "near_expiry"] } },
          select: { quantity: true, expiryDate: true, purchasePrice: true },
        },
      },
    });

    // Fetch last 30 days of sales for velocity calculation
    const monthStart = new Date();
    monthStart.setMonth(monthStart.getMonth() - 1);

    const saleItems = await db.saleItem.findMany({
      where: {
        businessId,
        sale: { status: "completed", createdAt: { gte: monthStart } },
      },
      select: { productId: true, quantity: true },
    });

    // Calculate sales velocity per product
    const velocityMap = new Map<string, { totalSold: number; lastSaleDate: Date | null }>();
    saleItems.forEach((item) => {
      const existing = velocityMap.get(item.productId) || { totalSold: 0, lastSaleDate: null };
      existing.totalSold += item.quantity;
      velocityMap.set(item.productId, existing);
    });

    const now = new Date();
    const suggestions = [];

    for (const product of products) {
      const currentStock = product.inventory?.quantity || 0;
      const velocity = velocityMap.get(product.id);
      const totalSold30d = velocity?.totalSold || 0;
      const dailyVelocity = totalSold30d / 30; // units per day
      const reorderLevel = product.reorderLevel || 10;
      const minStock = product.minStock || 5;
      // Days of stock remaining
      const daysOfStock = dailyVelocity > 0 ? Math.floor(currentStock / dailyVelocity) : 999;

      // Determine if reorder needed
      let urgency: "critical" | "high" | "medium" | "low" | null = null;
      let reason = "";

      if (currentStock <= 0) {
        urgency = "critical";
        reason = "Out of stock — no inventory available";
      } else if (currentStock <= minStock) {
        urgency = "critical";
        reason = `Below minimum stock (${minStock} ${product.unit})`;
      } else if (currentStock <= reorderLevel) {
        urgency = "high";
        reason = `Below reorder level (${reorderLevel} ${product.unit})`;
      } else if (dailyVelocity > 0 && daysOfStock <= 14) {
        urgency = "medium";
        reason = `Only ${daysOfStock} days of stock left (selling ${dailyVelocity.toFixed(1)}/day)`;
      } else if (dailyVelocity > 0 && daysOfStock <= 30) {
        urgency = "low";
        reason = `${daysOfStock} days of stock left (selling ${dailyVelocity.toFixed(1)}/day)`;
      }

      if (urgency) {
        // Calculate suggested order quantity (cover next 60 days)
        const suggestedQty = Math.max(
          Math.ceil(dailyVelocity * 60), // 60 days of supply
          product.maxStock || reorderLevel * 3, // or 3x reorder level
          20 // minimum 20 units
        );

        // Estimate cost
        const avgPurchasePrice = product.batches.length > 0
          ? product.batches.reduce((sum, b) => sum + (b.purchasePrice || 0), 0) / product.batches.length
          : 0;
        const estimatedCost = suggestedQty * avgPurchasePrice;

        // Check for near-expiry batches
        const nearExpiryBatches = product.batches.filter((b) => {
          const days = Math.floor((b.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return days <= 90;
        });

        suggestions.push({
          productId: product.id,
          productName: product.name,
          genericName: product.genericName,
          manufacturer: product.manufacturer,
          category: product.category,
          unit: product.unit,
          currentStock,
          reorderLevel,
          minStock,
          maxStock: product.maxStock || 0,
          urgency,
          reason,
          // Velocity data
          soldLast30Days: totalSold30d,
          dailyVelocity: Math.round(dailyVelocity * 10) / 10,
          daysOfStock: daysOfStock === 999 ? null : daysOfStock,
          // Suggestion
          suggestedOrderQty: suggestedQty,
          estimatedCost: Math.round(estimatedCost * 100) / 100,
          avgPurchasePrice: Math.round(avgPurchasePrice * 100) / 100,
          // Warnings
          hasNearExpiryBatches: nearExpiryBatches.length > 0,
          nearExpiryBatchCount: nearExpiryBatches.length,
          lastSaleDays: null,
        });
      }
    }

    // Sort by urgency (critical first)
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    suggestions.sort((a, b) => urgencyOrder[a.urgency as keyof typeof urgencyOrder] - urgencyOrder[b.urgency as keyof typeof urgencyOrder]);

    // Summary
    const summary = {
      totalSuggestions: suggestions.length,
      critical: suggestions.filter((s) => s.urgency === "critical").length,
      high: suggestions.filter((s) => s.urgency === "high").length,
      medium: suggestions.filter((s) => s.urgency === "medium").length,
      low: suggestions.filter((s) => s.urgency === "low").length,
      totalEstimatedCost: suggestions.reduce((sum, s) => sum + s.estimatedCost, 0),
      outOfStock: suggestions.filter((s) => s.currentStock <= 0).length,
    };

    return NextResponse.json({
      success: true,
      summary,
      suggestions,
    });
  } catch (error) {
    console.error("Reorder suggestions error:", error);
    return NextResponse.json({ error: "Failed to generate reorder suggestions" }, { status: 500 });
  }
}
