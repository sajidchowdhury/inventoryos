// GET /api/businesses/[id]/expiry-stats
// Returns aggregated expiry statistics for the full expiry dashboard
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const daysAhead = parseInt(url.searchParams.get("days") || "90"); // default window

    const now = new Date();
    const futureLimit = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    // Fetch all batches with stock (exclude destroyed)
    const batches = await db.batch.findMany({
      where: {
        businessId,
        quantity: { gt: 0 },
        status: { not: "destroyed" },
      },
      include: {
        product: {
          select: {
            id: true, name: true, genericName: true, strength: true,
            manufacturer: true, unit: true, mrp: true,
            category: { select: { id: true, name: true, color: true } },
          },
        },
      },
      orderBy: { expiryDate: "asc" },
    });

    // Bucket definitions
    const buckets = {
      expired: { count: 0, quantity: 0, value: 0, batches: [] as typeof batches },
      critical_7d: { count: 0, quantity: 0, value: 0, batches: [] as typeof batches },
      critical_30d: { count: 0, quantity: 0, value: 0, batches: [] as typeof batches },
      warning_90d: { count: 0, quantity: 0, value: 0, batches: [] as typeof batches },
      safe: { count: 0, quantity: 0, value: 0, batches: [] as typeof batches },
      quarantined: { count: 0, quantity: 0, value: 0, batches: [] as typeof batches },
    };

    let totalValueAtRisk = 0;
    let totalUnits = 0;
    let totalUnitsAtRisk = 0; // expiring within window or expired

    // Manufacturer breakdown
    const manufacturerStats = new Map<string, { count: number; quantity: number; value: number }>();

    // Category breakdown
    const categoryStats = new Map<string, { name: string; color: string; count: number; quantity: number; value: number }>();

    // Timeline buckets (next 30 days, by week)
    const timeline = [];
    for (let week = 0; week < 13; week++) { // 13 weeks = ~3 months
      const weekStart = new Date(now.getTime() + week * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      timeline.push({
        weekLabel: `Week ${week + 1}`,
        weekStart: weekStart.toISOString().split("T")[0],
        weekEnd: weekEnd.toISOString().split("T")[0],
        count: 0,
        quantity: 0,
        value: 0,
      });
    }

    for (const batch of batches) {
      const expiry = batch.expiryDate;
      const daysUntilExpiry = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const unitPrice = batch.mrp || batch.purchasePrice || batch.product.mrp || 0;
      const value = unitPrice * batch.quantity;

      totalUnits += batch.quantity;

      // Manufacturer aggregation
      const mfr = batch.product.manufacturer || "Unknown";
      const mfrEntry = manufacturerStats.get(mfr) || { count: 0, quantity: 0, value: 0 };
      mfrEntry.count++;
      mfrEntry.quantity += batch.quantity;
      mfrEntry.value += value;
      manufacturerStats.set(mfr, mfrEntry);

      // Category aggregation
      const catName = batch.product.category?.name || "Uncategorized";
      const catColor = batch.product.category?.color || "#6b7280";
      const catEntry = categoryStats.get(catName) || { name: catName, color: catColor, count: 0, quantity: 0, value: 0 };
      catEntry.count++;
      catEntry.quantity += batch.quantity;
      catEntry.value += value;
      categoryStats.set(catName, catEntry);

      // Bucket assignment
      let bucketKey: keyof typeof buckets;
      if (batch.status === "quarantined") {
        bucketKey = "quarantined";
      } else if (daysUntilExpiry < 0) {
        bucketKey = "expired";
        totalUnitsAtRisk += batch.quantity;
        totalValueAtRisk += value;
      } else if (daysUntilExpiry <= 7) {
        bucketKey = "critical_7d";
        totalUnitsAtRisk += batch.quantity;
        totalValueAtRisk += value;
      } else if (daysUntilExpiry <= 30) {
        bucketKey = "critical_30d";
        totalUnitsAtRisk += batch.quantity;
        totalValueAtRisk += value;
      } else if (daysUntilExpiry <= 90) {
        bucketKey = "warning_90d";
        totalUnitsAtRisk += batch.quantity;
        totalValueAtRisk += value;
      } else {
        bucketKey = "safe";
      }

      buckets[bucketKey].count++;
      buckets[bucketKey].quantity += batch.quantity;
      buckets[bucketKey].value += value;
      buckets[bucketKey].batches.push(batch);

      // Timeline population (only for next 90 days, exclude expired & quarantined)
      if (daysUntilExpiry >= 0 && daysUntilExpiry <= 90 && batch.status !== "quarantined") {
        const weekIdx = Math.floor(daysUntilExpiry / 7);
        if (weekIdx >= 0 && weekIdx < timeline.length) {
          timeline[weekIdx].count++;
          timeline[weekIdx].quantity += batch.quantity;
          timeline[weekIdx].value += value;
        }
      }
    }

    // Convert maps to sorted arrays
    const manufacturerBreakdown = Array.from(manufacturerStats.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // top 10

    const categoryBreakdown = Array.from(categoryStats.values())
      .sort((a, b) => b.value - a.value);

    return NextResponse.json({
      success: true,
      windowDays: daysAhead,
      generatedAt: now.toISOString(),
      summary: {
        totalBatches: batches.length,
        totalUnits,
        totalUnitsAtRisk,
        totalValueAtRisk,
        totalValue: Object.values(buckets).reduce((sum, b) => sum + b.value, 0),
      },
      buckets: {
        expired: { ...buckets.expired, batches: undefined },
        critical_7d: { ...buckets.critical_7d, batches: undefined },
        critical_30d: { ...buckets.critical_30d, batches: undefined },
        warning_90d: { ...buckets.warning_90d, batches: undefined },
        safe: { ...buckets.safe, batches: undefined },
        quarantined: { ...buckets.quarantined, batches: undefined },
      },
      timeline,
      manufacturerBreakdown,
      categoryBreakdown,
      // Include the actual batches for the list view (limit to first 50 for performance)
      batches: batches.slice(0, 50).map((b) => ({
        id: b.id,
        batchNo: b.batchNo,
        expiryDate: b.expiryDate,
        quantity: b.quantity,
        mrp: b.mrp,
        purchasePrice: b.purchasePrice,
        status: b.status,
        product: b.product,
        daysUntilExpiry: Math.floor((b.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      })),
    });
  } catch (error) {
    console.error("Expiry stats error:", error);
    return NextResponse.json({ error: "Failed to fetch expiry stats" }, { status: 500 });
  }
}
