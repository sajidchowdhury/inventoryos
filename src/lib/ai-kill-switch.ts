// src/lib/ai-kill-switch.ts
// Phase 4: Platform-wide kill-switch with 4 triggers and dynamic thresholds.
//
// Unlike the circuit breaker (Phase 2, per-pharmacy, auto-recovers), the
// kill-switch watches for SYSTEMIC problems that require founder attention.
// When any trigger fires, AI calls are blocked for the affected scope AND
// an email is sent to all configured notification recipients.
//
// 4 triggers (thresholds are DYNAMIC — editable from /admin):
//   1. per_pharmacy_monthly — single business spends > 200 BDT/month (default)
//      Scope: that business only. Manual reset.
//   2. per_pharmacy_24h — single business uses > 50,000 tokens in 24h (default)
//      Scope: that business only. Manual reset.
//   3. platform_monthly — ALL businesses combined spend > 100,000 BDT/month (default)
//      Scope: ALL businesses. Manual reset.
//   4. zai_error_rate — > 10% of AI calls fail in the last hour (default)
//      Scope: ALL businesses. Auto-recovers when error rate < 1% for 30 min.
//
// The check is stateless — it queries AIUsageLog + KillSwitch tables on every
// call. State (active/inactive) is persisted in the KillSwitch table so the
// banner in /admin stays accurate across restarts.

import { db } from "./db";
import { sendEmail, getActiveRecipientEmails, isEmailConfigured } from "./email";

// ── Hardcoded defaults (used only if the KillSwitchThreshold table is empty) ──
export const KILL_SWITCH_DEFAULTS = {
  per_pharmacy_monthly: { threshold: 200, unit: "BDT" },
  per_pharmacy_24h: { threshold: 50000, unit: "tokens" },
  platform_monthly: { threshold: 100000, unit: "BDT" },
  zai_error_rate: { threshold: 10, unit: "%" },
} as const;

export type KillSwitchTrigger = keyof typeof KILL_SWITCH_DEFAULTS;

export interface KillSwitchThresholdValue {
  trigger: KillSwitchTrigger;
  threshold: number;
  unit: string;
  isActive: boolean; // founder can disable a trigger entirely
  updatedAt?: Date;
  updatedBy?: string | null;
}

export interface KillSwitchCheckResult {
  open: boolean;
  trigger?: KillSwitchTrigger;
  actualValue?: number;
  thresholdValue?: number;
  unit?: string;
  scope: "per_pharmacy" | "platform"; // who is blocked
  businessId?: string; // for per_pharmacy scope
  reason?: string;
}

/**
 * Load all 4 kill-switch thresholds from the DB.
 * Falls back to hardcoded defaults if the table is empty or DB is unreachable.
 */
export async function getAllThresholds(): Promise<KillSwitchThresholdValue[]> {
  const triggers: KillSwitchTrigger[] = [
    "per_pharmacy_monthly",
    "per_pharmacy_24h",
    "platform_monthly",
    "zai_error_rate",
  ];

  try {
    const rows = await db.killSwitchThreshold.findMany();
    const rowMap = new Map(rows.map((r) => [r.trigger, r]));

    return triggers.map((trigger) => {
      const row = rowMap.get(trigger);
      const defaults = KILL_SWITCH_DEFAULTS[trigger];
      return {
        trigger,
        threshold: row?.thresholdValue ?? defaults.threshold,
        unit: row?.unit || defaults.unit,
        isActive: row?.isActive ?? true,
        updatedAt: row?.updatedAt,
        updatedBy: row?.updatedBy,
      };
    });
  } catch (err) {
    console.error("[ai-kill-switch] failed to load thresholds, using defaults:", err);
    return triggers.map((trigger) => ({
      trigger,
      threshold: KILL_SWITCH_DEFAULTS[trigger].threshold,
      unit: KILL_SWITCH_DEFAULTS[trigger].unit,
      isActive: true,
    }));
  }
}

/**
 * Check if there's an ACTIVE kill-switch that should block this business.
 *
 * Checks in order:
 *   1. Any active per_pharmacy_monthly kill-switch for this business
 *   2. Any active per_pharmacy_24h kill-switch for this business
 *   3. Any active platform_monthly kill-switch (blocks ALL businesses)
 *   4. Any active zai_error_rate kill-switch (blocks ALL, auto-recovers)
 *
 * Also runs the LIVE checks (current usage vs threshold) to detect new
 * threshold crossings that haven't been recorded yet.
 *
 * Returns { open: true, ... } if the business should be blocked.
 */
export async function checkKillSwitch(
  businessId: string
): Promise<KillSwitchCheckResult> {
  const now = new Date();
  const thresholds = await getAllThresholds();
  const thresholdMap = new Map(thresholds.map((t) => [t.trigger, t]));

  // ── Check 1: Existing active per_pharmacy kill-switches for this business ──
  const existingPerPharmacy = await db.killSwitch.findFirst({
    where: {
      triggeredBy: businessId,
      isActive: true,
      trigger: { in: ["per_pharmacy_monthly", "per_pharmacy_24h"] },
    },
    orderBy: { triggeredAt: "desc" },
  });

  if (existingPerPharmacy) {
    // For zai_error_rate, check if it should auto-recover
    if (existingPerPharmacy.trigger === "zai_error_rate") {
      const recovered = await shouldAutoRecoverZaiErrorRate();
      if (recovered) {
        await db.killSwitch.update({
          where: { id: existingPerPharmacy.id },
          data: { isActive: false, deactivatedAt: now, deactivatedBy: "auto-recovery" },
        });
      } else {
        return {
          open: true,
          trigger: existingPerPharmacy.trigger as KillSwitchTrigger,
          actualValue: existingPerPharmacy.actualValue,
          thresholdValue: existingPerPharmacy.thresholdValue,
          scope: "platform",
          reason: `Kill-switch active (zai_error_rate): ${existingPerPharmacy.actualValue.toFixed(1)}% error rate in last hour (threshold: ${existingPerPharmacy.thresholdValue}%). Auto-recovers when error rate drops below 1% for 30 minutes.`,
        };
      }
    } else {
      // per_pharmacy triggers don't auto-recover
      return {
        open: true,
        trigger: existingPerPharmacy.trigger as KillSwitchTrigger,
        actualValue: existingPerPharmacy.actualValue,
        thresholdValue: existingPerPharmacy.thresholdValue,
        scope: "per_pharmacy",
        businessId,
        reason: `Kill-switch active (${existingPerPharmacy.trigger}): actual ${existingPerPharmacy.actualValue} vs threshold ${existingPerPharmacy.thresholdValue}. Manual reset required.`,
      };
    }
  }

  // ── Check 2: Existing active platform-wide kill-switches ──
  const existingPlatform = await db.killSwitch.findFirst({
    where: {
      triggeredBy: "platform",
      isActive: true,
      trigger: { in: ["platform_monthly", "zai_error_rate"] },
    },
    orderBy: { triggeredAt: "desc" },
  });

  if (existingPlatform) {
    if (existingPlatform.trigger === "zai_error_rate") {
      const recovered = await shouldAutoRecoverZaiErrorRate();
      if (recovered) {
        await db.killSwitch.update({
          where: { id: existingPlatform.id },
          data: { isActive: false, deactivatedAt: now, deactivatedBy: "auto-recovery" },
        });
      } else {
        return {
          open: true,
          trigger: "zai_error_rate",
          actualValue: existingPlatform.actualValue,
          thresholdValue: existingPlatform.thresholdValue,
          scope: "platform",
          reason: `Kill-switch active (zai_error_rate): ${existingPlatform.actualValue.toFixed(1)}% error rate (threshold: ${existingPlatform.thresholdValue}%). Auto-recovers when error rate drops below 1% for 30 min.`,
        };
      }
    } else {
      return {
        open: true,
        trigger: existingPlatform.trigger as KillSwitchTrigger,
        actualValue: existingPlatform.actualValue,
        thresholdValue: existingPlatform.thresholdValue,
        scope: "platform",
        reason: `Kill-switch active (${existingPlatform.trigger}): actual ${existingPlatform.actualValue} BDT vs threshold ${existingPlatform.thresholdValue} BDT. Manual reset required.`,
      };
    }
  }

  // ── Live checks: detect NEW threshold crossings ──
  // Trigger 1: per_pharmacy_monthly
  const t1 = thresholdMap.get("per_pharmacy_monthly")!;
  if (t1.isActive) {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const agg = await db.aIUsageLog.aggregate({
      where: { businessId, createdAt: { gte: monthStart } },
      _sum: { costEstimate: true },
    });
    const monthlyCost = agg._sum.costEstimate || 0;
    if (monthlyCost > t1.threshold) {
      await triggerKillSwitch("per_pharmacy_monthly", t1.threshold, monthlyCost, businessId);
      return {
        open: true,
        trigger: "per_pharmacy_monthly",
        actualValue: monthlyCost,
        thresholdValue: t1.threshold,
        unit: t1.unit,
        scope: "per_pharmacy",
        businessId,
        reason: `Monthly AI cost for this pharmacy (${monthlyCost.toFixed(2)} BDT) exceeded the kill-switch threshold (${t1.threshold} BDT). AI is blocked until the founder resets the switch.`,
      };
    }
  }

  // Trigger 2: per_pharmacy_24h
  const t2 = thresholdMap.get("per_pharmacy_24h")!;
  if (t2.isActive) {
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const agg = await db.aIUsageLog.aggregate({
      where: { businessId, createdAt: { gte: twentyFourHoursAgo } },
      _sum: { tokensUsed: true },
    });
    const tokens24h = agg._sum.tokensUsed || 0;
    if (tokens24h > t2.threshold) {
      await triggerKillSwitch("per_pharmacy_24h", t2.threshold, tokens24h, businessId);
      return {
        open: true,
        trigger: "per_pharmacy_24h",
        actualValue: tokens24h,
        thresholdValue: t2.threshold,
        unit: t2.unit,
        scope: "per_pharmacy",
        businessId,
        reason: `Token usage in the last 24 hours (${tokens24h.toLocaleString()} tokens) exceeded the kill-switch threshold (${t2.threshold.toLocaleString()} tokens). AI is blocked until the founder resets the switch.`,
      };
    }
  }

  // Trigger 3: platform_monthly
  const t3 = thresholdMap.get("platform_monthly")!;
  if (t3.isActive) {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const agg = await db.aIUsageLog.aggregate({
      where: { createdAt: { gte: monthStart } },
      _sum: { costEstimate: true },
    });
    const platformCost = agg._sum.costEstimate || 0;
    if (platformCost > t3.threshold) {
      await triggerKillSwitch("platform_monthly", t3.threshold, platformCost, "platform");
      return {
        open: true,
        trigger: "platform_monthly",
        actualValue: platformCost,
        thresholdValue: t3.threshold,
        unit: t3.unit,
        scope: "platform",
        reason: `Platform-wide monthly AI cost (${platformCost.toFixed(2)} BDT) exceeded the kill-switch threshold (${t3.threshold} BDT). ALL AI features are blocked until the founder resets the switch.`,
      };
    }
  }

  // Trigger 4: zai_error_rate
  const t4 = thresholdMap.get("zai_error_rate")!;
  if (t4.isActive) {
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const [totalCalls, failedCalls] = await Promise.all([
      db.aIUsageLog.count({ where: { createdAt: { gte: oneHourAgo } } }),
      db.aIUsageLog.count({ where: { createdAt: { gte: oneHourAgo }, success: false } }),
    ]);
    if (totalCalls >= 10) {
      // Only check if we have enough data (at least 10 calls in the hour)
      const errorRate = (failedCalls / totalCalls) * 100;
      if (errorRate > t4.threshold) {
        await triggerKillSwitch("zai_error_rate", t4.threshold, errorRate, "platform");
        return {
          open: true,
          trigger: "zai_error_rate",
          actualValue: errorRate,
          thresholdValue: t4.threshold,
          unit: t4.unit,
          scope: "platform",
          reason: `Z.ai API error rate in the last hour (${errorRate.toFixed(1)}%) exceeded the kill-switch threshold (${t4.threshold}%). ALL AI features are in fallback-only mode. Auto-recovers when error rate drops below 1% for 30 minutes.`,
        };
      }
    }
  }

  return { open: false, scope: "per_pharmacy" };
}

/**
 * Record a kill-switch trigger: write to KillSwitch table + send email.
 * Idempotent — if an active kill-switch for the same trigger+scope already
 * exists, don't create a duplicate.
 */
async function triggerKillSwitch(
  trigger: KillSwitchTrigger,
  threshold: number,
  actualValue: number,
  triggeredBy: string
): Promise<void> {
  const now = new Date();

  // Check if there's already an active kill-switch for this trigger+scope
  const existing = await db.killSwitch.findFirst({
    where: { trigger, triggeredBy, isActive: true },
  });
  if (existing) {
    // Already triggered and still active — don't duplicate
    return;
  }

  // Write the KillSwitch record (this IS the audit trail for platform alerts)
  const ks = await db.killSwitch.create({
    data: {
      trigger,
      thresholdValue: threshold,
      actualValue,
      triggeredAt: now,
      triggeredBy,
      isActive: true,
    },
  });

  console.warn(`[ai-kill-switch] TRIGGERED: ${trigger} | actual=${actualValue.toFixed(2)} | threshold=${threshold} | scope=${triggeredBy} | id=${ks.id}`);

  // Send email to all configured recipients
  const recipients = await getActiveRecipientEmails();
  if (recipients.length > 0) {
    const scopeText = triggeredBy === "platform" ? "Platform-wide (ALL pharmacies)" : `Single pharmacy: ${triggeredBy}`;
    const resetInstruction = trigger === "zai_error_rate"
      ? "This trigger auto-recovers when the Z.ai error rate drops below 1% for 30 minutes. No manual action required."
      : "Manual reset required. Log into /admin and click 'Reset Kill Switch'.";

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #dc2626;">⚠️ AI Kill-Switch Triggered</h1>
        <p><strong>Trigger:</strong> ${trigger}</p>
        <p><strong>Threshold:</strong> ${threshold}</p>
        <p><strong>Actual Value:</strong> ${actualValue.toFixed(2)}</p>
        <p><strong>Scope:</strong> ${scopeText}</p>
        <p><strong>Time:</strong> ${now.toISOString()}</p>
        <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
        <p><strong>Action Required:</strong> ${resetInstruction}</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/admin" style="background: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">Open Super Admin Dashboard</a></p>
        <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px;">This is an automated alert from InventoryOS. You received this email because you are configured as a notification recipient in the super admin panel.</p>
      </div>
    `;

    await sendEmail({
      to: recipients,
      subject: `⚠️ InventoryOS Kill-Switch Triggered: ${trigger}`,
      html,
      text: `Kill-Switch Triggered: ${trigger}\nThreshold: ${threshold}\nActual: ${actualValue}\nScope: ${scopeText}\nTime: ${now.toISOString()}\n\n${resetInstruction}`,
    }).catch((err) => {
      console.error("[ai-kill-switch] email send failed (kill-switch still recorded):", err);
    });
  } else {
    console.warn("[ai-kill-switch] No notification recipients configured — kill-switch recorded but no email sent");
  }
}

/**
 * Check if the zai_error_rate kill-switch should auto-recover.
 * Auto-recovers when the error rate in the last 30 minutes is below 1%.
 */
async function shouldAutoRecoverZaiErrorRate(): Promise<boolean> {
  const now = new Date();
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

  const [totalCalls, failedCalls] = await Promise.all([
    db.aIUsageLog.count({ where: { createdAt: { gte: thirtyMinAgo } } }),
    db.aIUsageLog.count({ where: { createdAt: { gte: thirtyMinAgo }, success: false } }),
  ]);

  // Need at least 5 calls in 30 min to make a recovery decision
  if (totalCalls < 5) return false;

  const errorRate = (failedCalls / totalCalls) * 100;
  return errorRate < 1.0;
}

/**
 * Get all active kill-switches (for the /admin banner).
 */
export async function getActiveKillSwitches() {
  return db.killSwitch.findMany({
    where: { isActive: true },
    orderBy: { triggeredAt: "desc" },
  });
}

/**
 * Get recent kill-switch history (for the /admin history table).
 * Returns the last 20 triggers (active + inactive).
 */
export async function getKillSwitchHistory(limit = 20) {
  return db.killSwitch.findMany({
    orderBy: { triggeredAt: "desc" },
    take: limit,
  });
}

/**
 * Reset a kill-switch (super-admin only).
 * Sets isActive=false and records who reset it.
 */
export async function resetKillSwitch(
  id: string,
  resetBy: string,
  notes?: string
): Promise<void> {
  await db.killSwitch.update({
    where: { id },
    data: {
      isActive: false,
      deactivatedAt: new Date(),
      deactivatedBy: resetBy,
      notes: notes || `Reset by ${resetBy}`,
    },
  });
}

/**
 * Update a kill-switch threshold (super-admin only).
 * Uses upsert — creates the row if it doesn't exist.
 */
export async function updateKillSwitchThreshold(
  trigger: KillSwitchTrigger,
  threshold: number,
  isActive: boolean,
  updatedBy: string
): Promise<KillSwitchThresholdValue> {
  const defaults = KILL_SWITCH_DEFAULTS[trigger];

  // Validate
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new Error(`Threshold must be a non-negative number`);
  }

  const row = await db.killSwitchThreshold.upsert({
    where: { trigger },
    update: { thresholdValue: threshold, isActive, updatedBy },
    create: {
      trigger,
      thresholdValue: threshold,
      unit: defaults.unit,
      isActive,
      updatedBy,
    },
  });

  return {
    trigger,
    threshold: row.thresholdValue,
    unit: row.unit,
    isActive: row.isActive,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}
