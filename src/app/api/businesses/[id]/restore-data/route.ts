// POST /api/businesses/[id]/restore-data
// P2: Restore soft-deleted data after a payment is processed.
// Clears dataSoftDeletedAt + resets subscriptionStage to "active".
// Called after a successful payment match (P3) or manual super-admin override (P4).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canRestoreData, restoreBusinessData } from "@/lib/subscription-guard";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: businessId } = await params;

  try {
    const business = await db.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        subscriptionStage: true,
        dataSoftDeletedAt: true,
        dataPurgeDate: true,
        subscriptionEnd: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    if (!business.dataSoftDeletedAt) {
      return NextResponse.json({
        success: true,
        message: "Data is not soft-deleted — no restore needed.",
        stage: business.subscriptionStage,
      });
    }

    const canRestore = await canRestoreData(businessId);
    if (!canRestore) {
      return NextResponse.json(
        {
          error: "Data cannot be restored — the 30-day recovery window has passed and data has been permanently purged.",
          type: "restore_window_expired",
          dataPurgeDate: business.dataPurgeDate,
        },
        { status: 410 }
      );
    }

    await restoreBusinessData(businessId);

    return NextResponse.json({
      success: true,
      message: "Data restored successfully. Full access has been re-enabled.",
      stage: "active",
    });
  } catch (error) {
    console.error("Restore data error:", error);
    return NextResponse.json({ error: "Failed to restore data" }, { status: 500 });
  }
}
