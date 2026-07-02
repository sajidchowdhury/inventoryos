// POST /api/businesses/[id]/batches/auto-sync
// Public endpoint designed for cron job invocation
// Recalculates all batch statuses and returns a summary
// Optional header: X-Cron-Secret for production protection
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

    // Optional secret check (for production cron security)
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const provided = req.headers.get("x-cron-secret");
      if (provided !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const batches = await db.batch.findMany({
      where: { businessId },
      select: { id: true, batchNo: true, expiryDate: true, status: true, quantity: true },
    });

    const changes = [];
    let expiredCount = 0;
    let nearExpiryCount = 0;
    let activeCount = 0;
    let quarantinedCount = 0;
    let destroyedCount = 0;

    for (const batch of batches) {
      // Don't touch quarantined or destroyed batches
      if (batch.status === "quarantined" || batch.status === "destroyed") {
        if (batch.status === "quarantined") quarantinedCount++;
        else destroyedCount++;
        continue;
      }

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
          quantity: batch.quantity,
        });
      }

      if (correctStatus === "expired") expiredCount++;
      else if (correctStatus === "near_expiry") nearExpiryCount++;
      else activeCount++;
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      businessId,
      summary: {
        totalBatches: batches.length,
        statusChanges: changes.length,
        byStatus: {
          active: activeCount,
          near_expiry: nearExpiryCount,
          expired: expiredCount,
          quarantined: quarantinedCount,
          destroyed: destroyedCount,
        },
      },
      changes,
    });
  } catch (error) {
    console.error("Auto-sync error:", error);
    return NextResponse.json({ error: "Failed to auto-sync batches" }, { status: 500 });
  }
}

// GET endpoint to check sync status without performing sync
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;

    const batches = await db.batch.findMany({
      where: { businessId },
      select: { id: true, status: true, expiryDate: true, quantity: true },
    });

    let needsUpdate = 0;
    const statusCounts = {
      active: 0,
      near_expiry: 0,
      expired: 0,
      quarantined: 0,
      destroyed: 0,
    };

    for (const batch of batches) {
      statusCounts[batch.status as keyof typeof statusCounts] =
        (statusCounts[batch.status as keyof typeof statusCounts] || 0) + 1;

      // Check if status would change
      if (batch.status !== "quarantined" && batch.status !== "destroyed") {
        const correctStatus = calculateBatchStatus(batch.expiryDate);
        if (batch.status !== correctStatus) needsUpdate++;
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalBatches: batches.length,
      batchesNeedingUpdate: needsUpdate,
      currentStatusCounts: statusCounts,
    });
  } catch (error) {
    console.error("Sync status check error:", error);
    return NextResponse.json({ error: "Failed to check sync status" }, { status: 500 });
  }
}
