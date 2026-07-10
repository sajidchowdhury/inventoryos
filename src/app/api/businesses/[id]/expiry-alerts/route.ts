// GET /api/businesses/[id]/expiry-alerts
// Returns batches grouped by expiry severity with suggested actions
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    // Fetch batches that need attention: expired OR expiring within 90 days, with stock > 0
    const batches = await db.batch.findMany({
      where: {
        businessId,
        quantity: { gt: 0 },
        OR: [
          { status: "expired" },
          { status: "near_expiry" },
          { expiryDate: { lte: ninetyDaysFromNow } },
        ],
      },
      include: {
        product: {
          select: {
            id: true, name: true, genericName: true, strength: true,
            dosageForm: true, manufacturer: true, unit: true, mrp: true,
            category: { select: { name: true, color: true } },
          },
        },
      },
      orderBy: { expiryDate: "asc" },
    });

    // Group by severity
    const expired = [];
    const critical = []; // < 30 days
    const warning = []; // 30-90 days

    let totalValueAtRisk = 0;

    for (const batch of batches) {
      const daysUntilExpiry = Math.floor(
        (batch.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const valueAtRisk = (batch.mrp || batch.purchasePrice || 0) * batch.quantity;
      totalValueAtRisk += valueAtRisk;

      const alert = {
        batchId: batch.id,
        batchNo: batch.batchNo,
        expiryDate: batch.expiryDate,
        daysUntilExpiry,
        quantity: batch.quantity,
        valueAtRisk,
        status: batch.status,
        product: batch.product,
      };

      if (daysUntilExpiry < 0) {
        expired.push({ ...alert, severity: "expired", suggestedAction: "Dispose / Quarantine" });
      } else if (daysUntilExpiry <= 30) {
        critical.push({ ...alert, severity: "critical", suggestedAction: "Sell first / Discount / Return to supplier" });
      } else {
        warning.push({ ...alert, severity: "warning", suggestedAction: "FEFO priority — sell before others" });
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalAlerts: batches.length,
        expired: expired.length,
        critical: critical.length,
        warning: warning.length,
        totalValueAtRisk,
      },
      groups: {
        expired,
        critical,
        warning,
      },
    });
  } catch (error) {
    console.error("Expiry alerts error:", error);
    return NextResponse.json({ error: "Failed to fetch expiry alerts" }, { status: 500 });
  }
}
