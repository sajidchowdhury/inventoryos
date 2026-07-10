// POST /api/businesses/[id]/batches/sync-status
// Recalculate status for all batches based on current expiry dates
// Optional body: { batchIds?: string[] } to sync specific batches only
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function calculateBatchStatus(expiryDate: Date): string {
  const diffDays = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "expired";
  if (diffDays <= 90) return "near_expiry";
  return "active";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;
    const body = await req.json().catch(() => ({}));

    const where: Record<string, unknown> = { businessId };
    if (Array.isArray(body.batchIds) && body.batchIds.length > 0) {
      where.id = { in: body.batchIds };
    }

    const batches = await db.batch.findMany({
      where,
      select: { id: true, batchNo: true, expiryDate: true, status: true, quantity: true },
    });

    const changes = [];
    const unchanged = [];
    let expiredCount = 0;
    let nearExpiryCount = 0;
    let activeCount = 0;

    for (const batch of batches) {
      const correctStatus = calculateBatchStatus(batch.expiryDate);

      if (batch.status !== correctStatus) {
        await db.batch.update({
          where: { id: batch.id },
          data: { status: correctStatus },
        });

        changes.push({
          batchId: batch.id,
          batchNo: batch.batchNo,
          oldStatus: batch.status,
          newStatus: correctStatus,
          expiryDate: batch.expiryDate,
          quantity: batch.quantity,
        });
      } else {
        unchanged.push({
          batchId: batch.id,
          batchNo: batch.batchNo,
          status: batch.status,
        });
      }

      if (correctStatus === "expired") expiredCount++;
      else if (correctStatus === "near_expiry") nearExpiryCount++;
      else activeCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${batches.length} batches: ${changes.length} status changes`,
      summary: {
        totalBatches: batches.length,
        changed: changes.length,
        unchanged: unchanged.length,
        byStatus: {
          active: activeCount,
          near_expiry: nearExpiryCount,
          expired: expiredCount,
        },
      },
      changes,
    });
  } catch (error) {
    console.error("Sync batch status error:", error);
    return NextResponse.json({ error: "Failed to sync batch statuses" }, { status: 500 });
  }
}
