// GET /api/businesses/[id]/reports/fefo-overrides
// Returns FEFO override audit trail for DGDA compliance (Gap 11)
//
// Query params:
//   ?startDate=2026-01-01&endDate=2026-12-31  — date range filter
//   ?userId=<id>                              — filter by user
//   ?productId=<id>                           — filter by product
//   ?format=csv                               — CSV export
//
// Response: { success, summary: { totalOverrides, uniqueProducts, uniqueUsers }, overrides: [...] }
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;
    const { searchParams } = new URL(req.url);

    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const userId = searchParams.get("userId");
    const productId = searchParams.get("productId");
    const format = searchParams.get("format");

    // Build where clause
    const where: Record<string, unknown> = { businessId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        (where.createdAt as Record<string, unknown>).lte = end;
      }
    }
    if (userId) where.userId = userId;
    if (productId) where.productId = productId;

    const overrides = await db.fefoOverride.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500, // limit to 500 for performance
      select: {
        id: true,
        productId: true,
        productName: true,
        selectedBatchId: true,
        selectedBatchNo: true,
        expectedBatchId: true,
        expectedBatchNo: true,
        userId: true,
        userName: true,
        reason: true,
        saleId: true,
        saleItemId: true,
        createdAt: true,
      },
    });

    // Summary stats
    const uniqueProducts = new Set(overrides.map(o => o.productId)).size;
    const uniqueUsers = new Set(overrides.map(o => o.userId).filter(Boolean)).size;

    // Group by user (to detect patterns)
    const byUser: Record<string, { userName: string; count: number }> = {};
    for (const o of overrides) {
      const key = o.userId || "unknown";
      if (!byUser[key]) {
        byUser[key] = { userName: o.userName || "Unknown", count: 0 };
      }
      byUser[key].count++;
    }
    const userBreakdown = Object.entries(byUser)
      .map(([userId, data]) => ({ userId, userName: data.userName, count: data.count }))
      .sort((a, b) => b.count - a.count);

    // CSV export
    if (format === "csv") {
      const headers = ["Date", "Product", "Selected Batch", "Expected Batch (FEFO)", "User", "Reason", "Sale ID"];
      const rows = overrides.map(o => [
        o.createdAt.toISOString().split("T")[0],
        `"${o.productName}"`,
        o.selectedBatchNo,
        o.expectedBatchNo,
        `"${o.userName || "Unknown"}"`,
        `"${o.reason.replace(/"/g, '""')}"`,
        o.saleId || "",
      ].join(","));
      const csv = [headers.join(","), ...rows].join("\n");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="fefo-overrides-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalOverrides: overrides.length,
        uniqueProducts,
        uniqueUsers,
      },
      userBreakdown,
      overrides: overrides.map(o => ({
        id: o.id,
        productId: o.productId,
        productName: o.productName,
        selectedBatchId: o.selectedBatchId,
        selectedBatchNo: o.selectedBatchNo,
        expectedBatchId: o.expectedBatchId,
        expectedBatchNo: o.expectedBatchNo,
        userId: o.userId,
        userName: o.userName,
        reason: o.reason,
        saleId: o.saleId,
        saleItemId: o.saleItemId,
        createdAt: o.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("FEFO override report error:", error);
    return NextResponse.json({ error: "Failed to fetch FEFO override report" }, { status: 500 });
  }
}
