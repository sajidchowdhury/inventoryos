// GET /api/businesses/[id]/transactions
// Returns audit log of all stock movements with filters
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;

    const productId = url.searchParams.get("productId") || "";
    const batchId = url.searchParams.get("batchId") || "";
    const type = url.searchParams.get("type") || ""; // PURCHASE, SALE, ADJUSTMENT, WASTE, RETURN, QUARANTINE, RELEASE
    const startDate = url.searchParams.get("startDate") || "";
    const endDate = url.searchParams.get("endDate") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { businessId };
    if (productId) where.productId = productId;
    if (batchId) where.batchId = batchId;
    if (type) where.type = type;

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      where.createdAt = dateFilter;
    }

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
        include: {
          product: {
            select: {
              id: true, name: true, genericName: true, strength: true, unit: true,
              category: { select: { name: true, color: true } },
            },
          },
          // Note: Transaction has batchId as plain string, not a relation
          // We fetch batch info separately below
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.transaction.count({ where }),
    ]);

    // Fetch batch info for transactions that have a batchId
    const batchIds = [...new Set(
      transactions
        .map((t) => t.batchId)
        .filter((id): id is string => !!id)
    )];

    const batches = batchIds.length > 0
      ? await db.batch.findMany({
          where: { id: { in: batchIds } },
          select: { id: true, batchNo: true, expiryDate: true },
        })
      : [];

    const batchMap = new Map(batches.map((b) => [b.id, b]));

    // Enrich transactions with batch info
    const enrichedTransactions = transactions.map((t) => ({
      ...t,
      batch: t.batchId ? batchMap.get(t.batchId) || null : null,
    }));

    // Summary by type
    const summary = await db.transaction.groupBy({
      by: ["type"],
      where: { businessId },
      _count: true,
      _sum: { quantity: true },
    });

    const summaryMap = summary.reduce((acc, s) => {
      acc[s.type] = { count: s._count, totalQuantity: s._sum.quantity ?? 0 };
      return acc;
    }, {} as Record<string, { count: number; totalQuantity: number }>);

    return NextResponse.json({
      success: true,
      transactions: enrichedTransactions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: summaryMap,
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}
