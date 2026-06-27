// GET /api/businesses/[id]/combined-alerts
// Returns all active alerts: low stock, expiry (using business's thresholds), quarantine
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;

    // Fetch alert preferences (create default if missing)
    let prefs = await db.alertPreference.findUnique({ where: { businessId } });
    if (!prefs) {
      prefs = await db.alertPreference.create({ data: { businessId } });
    }

    const now = new Date();
    const alerts = [];

    // ── 1. LOW STOCK ALERTS ──
    if (prefs.lowStockEnabled) {
      const lowStockProducts = await db.product.findMany({
        where: {
          businessId,
          isActive: true,
          inventory: {
            quantity: { lte: prefs.lowStockThreshold },
          },
        },
        include: {
          inventory: true,
          category: { select: { name: true, color: true } },
        },
        orderBy: { name: "asc" },
      });

      lowStockProducts.forEach((product) => {
        const qty = product.inventory?.quantity ?? 0;
        alerts.push({
          id: `low_stock_${product.id}`,
          type: "low_stock",
          severity: qty === 0 ? "critical" : "warning",
          title: qty === 0 ? "Out of Stock" : "Low Stock",
          message: `${product.name}${product.genericName ? ` (${product.genericName})` : ""} — ${qty} ${product.unit} remaining`,
          entityType: "product",
          entityId: product.id,
          productName: product.name,
          quantity: qty,
          unit: product.unit,
          category: product.category,
          createdAt: product.inventory?.updatedAt || now,
        });
      });
    }

    // ── 2. EXPIRY ALERTS ──
    const expiryBatches = await db.batch.findMany({
      where: {
        businessId,
        quantity: { gt: 0 },
        status: { in: ["active", "near_expiry", "expired"] },
      },
      include: {
        product: {
          select: {
            id: true, name: true, genericName: true, strength: true,
            unit: true, mrp: true, manufacturer: true,
            category: { select: { name: true, color: true } },
          },
        },
      },
      orderBy: { expiryDate: "asc" },
    });

    expiryBatches.forEach((batch) => {
      const daysUntilExpiry = Math.floor(
        (batch.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      let severity: "critical" | "warning" | "info" | null = null;
      let type = "";
      let title = "";

      if (daysUntilExpiry < 0) {
        severity = "critical";
        type = "expiry_expired";
        title = "Expired";
      } else if (daysUntilExpiry <= prefs.expiryCriticalDays) {
        severity = "critical";
        type = "expiry_critical";
        title = `Expires in ${daysUntilExpiry}d`;
      } else if (daysUntilExpiry <= prefs.expiryWarningDays) {
        severity = "warning";
        type = "expiry_warning";
        title = `Expires in ${daysUntilExpiry}d`;
      } else if (daysUntilExpiry <= prefs.expiryNoticeDays) {
        severity = "info";
        type = "expiry_notice";
        title = `Expires in ${daysUntilExpiry}d`;
      }

      if (severity) {
        const value = (batch.mrp || 0) * batch.quantity;
        alerts.push({
          id: `expiry_${batch.id}`,
          type,
          severity,
          title,
          message: `${batch.product.name} — Batch #${batch.batchNo} — ${batch.quantity} ${batch.product.unit} — ৳${value.toFixed(2)} at risk`,
          entityType: "batch",
          entityId: batch.id,
          productId: batch.product.id,
          productName: batch.product.name,
          batchNo: batch.batchNo,
          expiryDate: batch.expiryDate,
          daysUntilExpiry,
          quantity: batch.quantity,
          unit: batch.product.unit,
          valueAtRisk: value,
          category: batch.product.category,
          createdAt: batch.createdAt,
        });
      }
    });

    // ── 3. QUARANTINE ALERTS ──
    if (prefs.quarantineAlerts) {
      const quarantinedBatches = await db.batch.findMany({
        where: {
          businessId,
          status: "quarantined",
          quantity: { gt: 0 },
        },
        include: {
          product: {
            select: {
              id: true, name: true, unit: true, mrp: true,
              category: { select: { name: true, color: true } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      quarantinedBatches.forEach((batch) => {
        const value = (batch.mrp || 0) * batch.quantity;
        alerts.push({
          id: `quarantine_${batch.id}`,
          type: "quarantine",
          severity: "warning",
          title: "Quarantined",
          message: `${batch.product.name} — Batch #${batch.batchNo} — ${batch.quantity} ${batch.product.unit} quarantined (৳${value.toFixed(2)} held)`,
          entityType: "batch",
          entityId: batch.id,
          productId: batch.product.id,
          productName: batch.product.name,
          batchNo: batch.batchNo,
          quantity: batch.quantity,
          unit: batch.product.unit,
          valueHeld: value,
          category: batch.product.category,
          createdAt: batch.updatedAt,
        });
      });
    }

    // Sort by severity (critical first), then by recency
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => {
      const sevA = severityOrder[a.severity as keyof typeof severityOrder] ?? 99;
      const sevB = severityOrder[b.severity as keyof typeof severityOrder] ?? 99;
      if (sevA !== sevB) return sevA - sevB;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Summary counts
    const summary = {
      total: alerts.length,
      critical: alerts.filter((a) => a.severity === "critical").length,
      warning: alerts.filter((a) => a.severity === "warning").length,
      info: alerts.filter((a) => a.severity === "info").length,
      byType: {
        low_stock: alerts.filter((a) => a.type === "low_stock").length,
        expiry_expired: alerts.filter((a) => a.type === "expiry_expired").length,
        expiry_critical: alerts.filter((a) => a.type === "expiry_critical").length,
        expiry_warning: alerts.filter((a) => a.type === "expiry_warning").length,
        expiry_notice: alerts.filter((a) => a.type === "expiry_notice").length,
        quarantine: alerts.filter((a) => a.type === "quarantine").length,
      },
      totalValueAtRisk: alerts
        .reduce((sum, a) => sum + (a.valueAtRisk || a.valueHeld || 0), 0),
    };

    return NextResponse.json({
      success: true,
      preferences: {
        expiryCriticalDays: prefs.expiryCriticalDays,
        expiryWarningDays: prefs.expiryWarningDays,
        expiryNoticeDays: prefs.expiryNoticeDays,
        lowStockThreshold: prefs.lowStockThreshold,
      },
      summary,
      alerts,
    });
  } catch (error) {
    console.error("Combined alerts error:", error);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}
