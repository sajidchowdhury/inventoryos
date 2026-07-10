// GET /api/businesses/[id]/shelf-scans
// Scan history for the Shelf Scanner. Returns recent ShelfScan rows with
// aggregated item stats (total items, applied items, fully-applied flag) so
// the UI can render a history list without N+1 queries.
//
// Query params:
//   ?limit=20   — max scans to return (1–50, default 20)
//
// Response:
//   {
//     success: true,
//     scans: [{
//       id, imageCount, detectedCount, matchedCount, tokensUsed, createdAt,
//       totalItems: number,
//       appliedItems: number,   // items with appliedAt != null
//       fullyApplied: boolean,  // all items applied
//     }]
//   }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: businessId } = await params;

  try {
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    let limit = DEFAULT_LIMIT;
    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (isNaN(parsed) || parsed < 1) {
        return NextResponse.json(
          { error: "limit must be a positive integer." },
          { status: 400 }
        );
      }
      limit = Math.min(parsed, MAX_LIMIT);
    }

    // Fetch scans + their item counts in one query using include + _count.
    // _count with a filter would need a raw query in Prisma; instead we fetch
    // the items aggregate inline. For the history list this is fine — scans
    // are capped at `limit` and each scan's items are bounded (max ~30 detections).
    const scans = await db.shelfScan.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        items: {
          select: {
            id: true,
            appliedAt: true,
            newQuantity: true,
          },
        },
      },
    });

    const result = scans.map((scan) => {
      const totalItems = scan.items.length;
      const appliedItems = scan.items.filter((it) => it.appliedAt !== null).length;
      return {
        id: scan.id,
        imageCount: scan.imageCount,
        detectedCount: scan.detectedCount,
        matchedCount: scan.matchedCount,
        tokensUsed: scan.tokensUsed,
        createdAt: scan.createdAt.toISOString(),
        totalItems,
        appliedItems,
        fullyApplied: totalItems > 0 && appliedItems === totalItems,
      };
    });

    return NextResponse.json({
      success: true,
      scans: result,
    });
  } catch (error) {
    console.error("Shelf scan history error:", error);
    return NextResponse.json(
      { error: "Failed to load scan history." },
      { status: 500 }
    );
  }
}
