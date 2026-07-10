// POST /api/businesses/[id]/alerts/digest
// Generates an alert digest suitable for email/SMS — also logs notifications
// Designed for cron job invocation
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;
    const body = await req.json().catch(() => ({}));
    const period = body.period || "daily"; // daily, weekly, monthly

    // Optional cron secret protection
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const provided = req.headers.get("x-cron-secret");
      if (provided !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Fetch preferences
    let prefs = await db.alertPreference.findUnique({ where: { businessId } });
    if (!prefs) {
      prefs = await db.alertPreference.create({ data: { businessId } });
    }

    // Check if digest should be sent based on frequency
    if (prefs.digestFrequency === "none") {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "Digest frequency set to 'none'",
      });
    }
    if (prefs.digestFrequency !== period) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: `Digest frequency is '${prefs.digestFrequency}', requested '${period}'`,
      });
    }

    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { name: true },
    });

    // Fetch all current alerts (reuse combined-alerts logic inline for simplicity)
    const now = new Date();
    const periodStart = new Date();
    if (period === "weekly") periodStart.setDate(periodStart.getDate() - 7);
    else if (period === "monthly") periodStart.setMonth(periodStart.getMonth() - 1);
    else periodStart.setHours(0, 0, 0, 0);

    // Low stock alerts
    const lowStockProducts = prefs.lowStockEnabled
      ? await db.product.findMany({
          where: {
            businessId,
            isActive: true,
            inventory: { quantity: { lte: prefs.lowStockThreshold } },
          },
          include: { inventory: true },
        })
      : [];

    // Expiry alerts
    const expiryBatches = await db.batch.findMany({
      where: {
        businessId,
        quantity: { gt: 0 },
        status: { in: ["active", "near_expiry", "expired"] },
      },
      include: {
        product: { select: { id: true, name: true, unit: true, mrp: true } },
      },
      orderBy: { expiryDate: "asc" },
    });

    // Quarantine alerts
    const quarantinedBatches = prefs.quarantineAlerts
      ? await db.batch.findMany({
          where: { businessId, status: "quarantined", quantity: { gt: 0 } },
          include: { product: { select: { id: true, name: true, unit: true, mrp: true } } },
        })
      : [];

    // Build digest sections
    const expiredBatches = [];
    const criticalBatches = [];
    const warningBatches = [];
    const noticeBatches = [];

    for (const batch of expiryBatches) {
      const days = Math.floor((batch.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const value = (batch.mrp || 0) * batch.quantity;
      const entry = {
        productName: batch.product.name,
        batchNo: batch.batchNo,
        expiryDate: batch.expiryDate.toISOString().split("T")[0],
        daysUntilExpiry: days,
        quantity: batch.quantity,
        unit: batch.product.unit,
        value,
      };

      if (days < 0) expiredBatches.push(entry);
      else if (days <= prefs.expiryCriticalDays) criticalBatches.push(entry);
      else if (days <= prefs.expiryWarningDays) warningBatches.push(entry);
      else if (days <= prefs.expiryNoticeDays) noticeBatches.push(entry);
    }

    // Log notifications (dedup by type+entityId within last 24h)
    const notificationsCreated = [];
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const batch of expiredBatches) {
      const existing = await db.notificationLog.findFirst({
        where: {
          businessId,
          type: "expiry_expired",
          entityId: batch.batchNo,
          createdAt: { gte: yesterday },
        },
      });
      if (!existing) {
        const notif = await db.notificationLog.create({
          data: {
            businessId,
            type: "expiry_expired",
            severity: "critical",
            title: "Expired Stock",
            message: `${batch.productName} — Batch #${batch.batchNo} expired ${Math.abs(batch.daysUntilExpiry)}d ago (${batch.quantity} ${batch.unit})`,
            entityType: "batch",
            entityId: batch.batchNo,
          },
        });
        notificationsCreated.push(notif);
      }
    }

    for (const batch of criticalBatches) {
      const existing = await db.notificationLog.findFirst({
        where: {
          businessId,
          type: "expiry_critical",
          entityId: batch.batchNo,
          createdAt: { gte: yesterday },
        },
      });
      if (!existing) {
        const notif = await db.notificationLog.create({
          data: {
            businessId,
            type: "expiry_critical",
            severity: "critical",
            title: `Expires in ${batch.daysUntilExpiry}d`,
            message: `${batch.productName} — Batch #${batch.batchNo} — ${batch.quantity} ${batch.unit} — ৳${batch.value.toFixed(2)} at risk`,
            entityType: "batch",
            entityId: batch.batchNo,
          },
        });
        notificationsCreated.push(notif);
      }
    }

    // Low stock notifications
    for (const product of lowStockProducts) {
      const qty = product.inventory?.quantity ?? 0;
      const existing = await db.notificationLog.findFirst({
        where: {
          businessId,
          type: "low_stock",
          entityId: product.id,
          createdAt: { gte: yesterday },
        },
      });
      if (!existing) {
        const notif = await db.notificationLog.create({
          data: {
            businessId,
            type: "low_stock",
            severity: qty === 0 ? "critical" : "warning",
            title: qty === 0 ? "Out of Stock" : "Low Stock",
            message: `${product.name} — ${qty} ${product.unit} remaining`,
            entityType: "product",
            entityId: product.id,
          },
        });
        notificationsCreated.push(notif);
      }
    }

    // Build digest
    const digest = {
      businessName: business?.name,
      period,
      generatedAt: now.toISOString(),
      periodStart: periodStart.toISOString(),
      summary: {
        expired: expiredBatches.length,
        critical: criticalBatches.length,
        warning: warningBatches.length,
        notice: noticeBatches.length,
        lowStock: lowStockProducts.length,
        quarantined: quarantinedBatches.length,
        totalValueAtRisk: [...expiredBatches, ...criticalBatches, ...warningBatches]
          .reduce((sum, b) => sum + b.value, 0),
      },
      sections: {
        expired: expiredBatches,
        critical: criticalBatches,
        warning: warningBatches,
        notice: noticeBatches,
        lowStock: lowStockProducts.map((p) => ({
          productName: p.name,
          quantity: p.inventory?.quantity ?? 0,
          unit: p.unit,
        })),
        quarantined: quarantinedBatches.map((b) => ({
          productName: b.product.name,
          batchNo: b.batchNo,
          quantity: b.quantity,
          unit: b.product.unit,
        })),
      },
      notificationsCreated: notificationsCreated.length,
      deliveryTargets: {
        email: prefs.emailEnabled ? prefs.email : null,
        sms: prefs.smsEnabled ? prefs.phone : null,
      },
    };

    // In a real system, we'd send email/SMS here
    // For now, just log the digest size
    console.log(`[Digest] ${business?.name} (${period}): ${notificationsCreated.length} new notifications, ${digest.summary.totalValueAtRisk.toFixed(2)} BDT at risk`);

    return NextResponse.json({
      success: true,
      digest,
    });
  } catch (error) {
    console.error("Alert digest error:", error);
    return NextResponse.json({ error: "Failed to generate digest" }, { status: 500 });
  }
}
