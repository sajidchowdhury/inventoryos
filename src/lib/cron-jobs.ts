// ── InventoryOS: Cron Job System (Gap 8 — Background KPIs / Maintenance) ──
//
// Three background jobs, designed to be triggered by an external scheduler
// (Vercel Cron, systemd timer, k8s CronJob, or a simple curl-on-a-clock).
// Each job writes a CronJobLog row to the database so operators can inspect
// run history, durations, and failures from /api/super-admin/cron-jobs.
//
//   runNightlyStatsJob()        — snapshot yesterday's KPIs into BusinessDailyStats
//   runHourlySubscriptionsJob() — auto-suspend expired paid subscriptions
//   runDailyMaintenanceJob()    — prune old logs / expired tokens / expired cache
//
// All jobs share the same lifecycle:
//   1. Insert CronJobLog { status: "running" }
//   2. Do the work, appending to a log buffer
//   3. Update CronJobLog → { status: "success" | "failed", durationMs, businessesProcessed,
//                              recordsWritten, errorMessage?, log }

import { db } from "./db";
import { cache } from "./cache";

// ── Job Names (stored in CronJobLog.jobName) ──
export const CRON_JOB_NAMES = {
  NIGHTLY_STATS: "nightly-stats",
  HOURLY_SUBSCRIPTIONS: "hourly-subscriptions",
  DAILY_MAINTENANCE: "daily-maintenance",
  WEEKLY_AI_HEALTH: "weekly-ai-health",
} as const;

export type CronJobName = (typeof CRON_JOB_NAMES)[keyof typeof CRON_JOB_NAMES];

// ── Schedules (informational — surfaced via getCronJobStatuses / docs) ──
export const CRON_JOB_SCHEDULES: Record<
  CronJobName,
  { schedule: string; description: string }
> = {
  [CRON_JOB_NAMES.NIGHTLY_STATS]: {
    schedule: "0 1 * * *", // 01:00 UTC daily
    description:
      "Snapshot yesterday's KPIs (sales, purchases, payments, inventory, expiry, customers/suppliers, AI usage) for every active business into BusinessDailyStats.",
  },
  [CRON_JOB_NAMES.HOURLY_SUBSCRIPTIONS]: {
    schedule: "0 * * * *", // top of every hour
    description:
      "Auto-suspend businesses whose subscriptionEnd has passed while still in trial/active status (skips free tier). Disables AI for suspended pro_ai businesses.",
  },
  [CRON_JOB_NAMES.DAILY_MAINTENANCE]: {
    schedule: "30 1 * * *", // 01:30 UTC daily
    description:
      "Prune old CronJobLog (>90d), NotificationLog (>30d), expired OTPs, expired Sessions, and expired AIResponseCache entries.",
  },
  [CRON_JOB_NAMES.WEEKLY_AI_HEALTH]: {
    schedule: "0 6 * * 1", // 06:00 UTC every Monday
    description:
      "Phase 5: Send weekly AI health summary email to all notification recipients. Includes this week's cost, top spenders, error rate, kill-switch triggers, and any health issues that need attention.",
  },
};

// ── Helpers ──

/** Returns midnight UTC for a given Date (the day-of-month boundary in UTC). */
function midnightUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Append a timestamped line to a log buffer. */
function logLine(lines: string[], message: string): void {
  const ts = new Date().toISOString();
  lines.push(`[${ts}] ${message}`);
  // Echo to stdout so container logs capture job progress
  // eslint-disable-next-line no-console
  console.log(`[cron] ${message}`);
}

/** Truncate a string to fit in a TEXT column (SQLite has no real limit, but we cap at 64KB). */
function truncateLog(s: string, maxLen = 64_000): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 200) + `\n…[truncated, ${s.length - maxLen + 200} chars omitted]`;
}

// ── Job #1: Nightly Stats ──
// Snapshots YESTERDAY's KPIs for every active business into BusinessDailyStats
// (uses upsert keyed on @@unique([businessId, date])).
export async function runNightlyStatsJob(): Promise<void> {
  const startedAt = new Date();
  const startMs = Date.now();
  const log: string[] = [];
  logLine(log, "nightly-stats: starting");

  // Compute yesterday's UTC day range
  const now = new Date();
  const yesterday = midnightUTC(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const dayStart = yesterday; // 00:00:00.000 UTC
  const dayEnd = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1); // 23:59:59.999 UTC

  let cronLogId: string | null = null;
  try {
    const created = await db.cronJobLog.create({
      data: {
        jobName: CRON_JOB_NAMES.NIGHTLY_STATS,
        status: "running",
        startedAt,
      },
    });
    cronLogId = created.id;
    logLine(log, `nightly-stats: created log ${cronLogId}`);
    logLine(log, `nightly-stats: snapshotting for UTC day ${dayStart.toISOString()}`);

    // Active businesses only — suspended/cancelled businesses don't get snapshots
    const businesses = await db.business.findMany({
      where: { isActive: true },
      select: { id: true, name: true, subscriptionTier: true },
    });
    logLine(log, `nightly-stats: ${businesses.length} active businesses to process`);

    let recordsWritten = 0;
    let errors = 0;

    for (const biz of businesses) {
      try {
        // ── Sales (yesterday, completed only) ──
        const salesAgg = await db.sale.aggregate({
          where: {
            businessId: biz.id,
            status: "completed",
            createdAt: { gte: dayStart, lte: dayEnd },
          },
          _sum: { totalAmount: true, discountAmount: true },
          _count: true,
        });

        // ── Returns / refunds (yesterday) ──
        const returnsAgg = await db.return.aggregate({
          where: {
            businessId: biz.id,
            createdAt: { gte: dayStart, lte: dayEnd },
          },
          _sum: { refundAmount: true },
          _count: true,
        });

        // ── Purchases (yesterday, not cancelled) ──
        const purchasesAgg = await db.purchase.aggregate({
          where: {
            businessId: biz.id,
            status: { not: "cancelled" },
            createdAt: { gte: dayStart, lte: dayEnd },
          },
          _sum: { totalAmount: true },
          _count: true,
        });

        // ── Payments in (yesterday — payments are inbound from customers) ──
        const paymentsAgg = await db.payment.aggregate({
          where: {
            businessId: biz.id,
            createdAt: { gte: dayStart, lte: dayEnd },
          },
          _sum: { amount: true },
          _count: true,
        });

        // ── Inventory snapshot (current state at time of run) ──
        const [productCount, lowStockCount, outOfStockCount, batchCount] = await Promise.all([
          db.product.count({ where: { businessId: biz.id, isActive: true } }),
          db.product.count({
            where: {
              businessId: biz.id,
              isActive: true,
              inventory: { quantity: { lte: 10 } },
            },
          }),
          db.product.count({
            where: {
              businessId: biz.id,
              isActive: true,
              inventory: { quantity: { lte: 0 } },
            },
          }),
          db.batch.count({ where: { businessId: biz.id } }),
        ]);

        // ── Expiry snapshot ──
        const expiryThreshold = new Date(dayStart.getTime() + 90 * 24 * 60 * 60 * 1000);
        const [nearExpiryCount, expiredCount] = await Promise.all([
          db.batch.count({
            where: {
              businessId: biz.id,
              quantity: { gt: 0 },
              status: { notIn: ["expired", "destroyed"] },
              expiryDate: { gte: dayStart, lte: expiryThreshold },
            },
          }),
          db.batch.count({
            where: {
              businessId: biz.id,
              quantity: { gt: 0 },
              status: "expired",
            },
          }),
        ]);

        // ── Inventory valuation (cost + MRP) ──
        const batchesWithValue = await db.batch.findMany({
          where: { businessId: biz.id, quantity: { gt: 0 }, status: { not: "destroyed" } },
          select: { quantity: true, purchasePrice: true, mrp: true },
        });
        const inventoryCostValue = batchesWithValue.reduce(
          (sum, b) => sum + (b.purchasePrice || 0) * b.quantity,
          0
        );
        const inventoryMrpValue = batchesWithValue.reduce(
          (sum, b) => sum + (b.mrp || 0) * b.quantity,
          0
        );

        // ── Customers / suppliers counts ──
        const [customerCount, supplierCount] = await Promise.all([
          db.customer.count({ where: { businessId: biz.id } }),
          db.supplier.count({ where: { businessId: biz.id } }),
        ]);

        // ── Receivables (sales with partial/unpaid status) ──
        const receivablesAgg = await db.sale.aggregate({
          where: {
            businessId: biz.id,
            paymentStatus: { in: ["partial", "unpaid"] },
          },
          _sum: { totalAmount: true, paidAmount: true },
        });
        const receivablesTotal =
          (receivablesAgg._sum.totalAmount || 0) - (receivablesAgg._sum.paidAmount || 0);

        // ── Payables (supplier balances) ──
        const payablesAgg = await db.supplier.aggregate({
          where: { businessId: biz.id, balance: { gt: 0 } },
          _sum: { balance: true },
        });
        const payablesTotal = payablesAgg._sum.balance || 0;

        // ── AI usage (yesterday) ──
        const aiAgg = await db.aIUsageLog.aggregate({
          where: {
            businessId: biz.id,
            createdAt: { gte: dayStart, lte: dayEnd },
          },
          _sum: { tokensUsed: true, costEstimate: true },
          _count: true,
        });

        // ── Upsert daily stats (keyed on businessId + date) ──
        await db.businessDailyStats.upsert({
          where: {
            businessId_date: { businessId: biz.id, date: dayStart },
          },
          create: {
            businessId: biz.id,
            date: dayStart,
            salesTotal: salesAgg._sum.totalAmount || 0,
            salesCount: salesAgg._count,
            salesDiscount: salesAgg._sum.discountAmount || 0,
            salesReturns: returnsAgg._sum.refundAmount || 0,
            salesReturnsCount: returnsAgg._count,
            purchasesTotal: purchasesAgg._sum.totalAmount || 0,
            purchasesCount: purchasesAgg._count,
            paymentsIn: paymentsAgg._sum.amount || 0,
            paymentsOut: 0, // supplier payments not tracked in Payment table
            productCount,
            lowStockCount,
            outOfStockCount,
            batchCount,
            nearExpiryCount,
            expiredCount,
            inventoryCostValue,
            inventoryMrpValue,
            customerCount,
            supplierCount,
            receivablesTotal,
            payablesTotal,
            aiCalls: aiAgg._count,
            aiTokens: aiAgg._sum.tokensUsed || 0,
            aiCost: aiAgg._sum.costEstimate || 0,
          },
          update: {
            salesTotal: salesAgg._sum.totalAmount || 0,
            salesCount: salesAgg._count,
            salesDiscount: salesAgg._sum.discountAmount || 0,
            salesReturns: returnsAgg._sum.refundAmount || 0,
            salesReturnsCount: returnsAgg._count,
            purchasesTotal: purchasesAgg._sum.totalAmount || 0,
            purchasesCount: purchasesAgg._count,
            paymentsIn: paymentsAgg._sum.amount || 0,
            paymentsOut: 0,
            productCount,
            lowStockCount,
            outOfStockCount,
            batchCount,
            nearExpiryCount,
            expiredCount,
            inventoryCostValue,
            inventoryMrpValue,
            customerCount,
            supplierCount,
            receivablesTotal,
            payablesTotal,
            aiCalls: aiAgg._count,
            aiTokens: aiAgg._sum.tokensUsed || 0,
            aiCost: aiAgg._sum.costEstimate || 0,
          },
        });

        recordsWritten++;
      } catch (bizErr) {
        errors++;
        const msg = bizErr instanceof Error ? bizErr.message : String(bizErr);
        logLine(log, `nightly-stats: ERROR for business ${biz.id} (${biz.name}): ${msg}`);
      }
    }

    // ── Clear cached dashboards — fresh KPIs just landed ──
    try {
      // Invalidate all per-business dashboard caches (uses prefix scan in Redis,
      // or full iteration in MemoryCache). Daily stats feed dashboard charts.
      await cache.invalidatePrefix("biz:");
      logLine(log, "nightly-stats: cleared dashboard cache");
    } catch (cacheErr) {
      const msg = cacheErr instanceof Error ? cacheErr.message : String(cacheErr);
      logLine(log, `nightly-stats: cache invalidation failed (non-fatal): ${msg}`);
    }

    const durationMs = Date.now() - startMs;
    logLine(
      log,
      `nightly-stats: completed — businesses=${businesses.length} records=${recordsWritten} errors=${errors} durationMs=${durationMs}`
    );

    await db.cronJobLog.update({
      where: { id: cronLogId! },
      data: {
        status: "success",
        finishedAt: new Date(),
        durationMs,
        businessesProcessed: businesses.length,
        recordsWritten,
        log: truncateLog(log.join("\n")),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logLine(log, `nightly-stats: FATAL — ${msg}`);
    if (cronLogId) {
      try {
        await db.cronJobLog.update({
          where: { id: cronLogId },
          data: {
            status: "failed",
            finishedAt: new Date(),
            durationMs: Date.now() - startMs,
            errorMessage: truncateLog(msg),
            log: truncateLog(log.join("\n")),
          },
        });
      } catch {
        // best-effort
      }
    }
    throw err;
  }
}

// ── Job #2: Hourly Subscription Suspension ──
// Auto-suspends businesses whose subscription has lapsed.
export async function runHourlySubscriptionsJob(): Promise<void> {
  const startedAt = new Date();
  const startMs = Date.now();
  const log: string[] = [];
  logLine(log, "hourly-subscriptions: starting");

  let cronLogId: string | null = null;
  try {
    const created = await db.cronJobLog.create({
      data: {
        jobName: CRON_JOB_NAMES.HOURLY_SUBSCRIPTIONS,
        status: "running",
        startedAt,
      },
    });
    cronLogId = created.id;
    logLine(log, `hourly-subscriptions: created log ${cronLogId}`);

    const now = new Date();

    // Find businesses that:
    //   - have subscriptionEnd < now (expired)
    //   - are still in "trial" or "active" status (not already suspended/cancelled)
    //   - are NOT free tier (free tier never expires)
    const expired = await db.business.findMany({
      where: {
        subscriptionEnd: { lt: now },
        subscriptionStatus: { in: ["trial", "active"] },
        subscriptionTier: { not: "free" },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        subscriptionEnd: true,
        aiEnabled: true,
      },
    });
    logLine(
      log,
      `hourly-subscriptions: ${expired.length} businesses with lapsed paid subscriptions`
    );

    let recordsWritten = 0;
    let aiDisabled = 0;

    for (const biz of expired) {
      // Suspend + (for pro_ai) disable AI
      const shouldDisableAi = biz.subscriptionTier === "pro_ai" && biz.aiEnabled;
      await db.business.update({
        where: { id: biz.id },
        data: {
          subscriptionStatus: "suspended",
          aiEnabled: shouldDisableAi ? false : biz.aiEnabled,
        },
      });
      recordsWritten++;
      if (shouldDisableAi) aiDisabled++;

      logLine(
        log,
        `hourly-subscriptions: suspended ${biz.id} (${biz.name}) — tier=${biz.subscriptionTier} prevStatus=${biz.subscriptionStatus} aiDisabled=${shouldDisableAi}`
      );
    }

    const durationMs = Date.now() - startMs;
    logLine(
      log,
      `hourly-subscriptions: completed — suspended=${recordsWritten} aiDisabled=${aiDisabled} durationMs=${durationMs}`
    );

    await db.cronJobLog.update({
      where: { id: cronLogId! },
      data: {
        status: "success",
        finishedAt: new Date(),
        durationMs,
        businessesProcessed: recordsWritten,
        recordsWritten,
        log: truncateLog(log.join("\n")),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logLine(log, `hourly-subscriptions: FATAL — ${msg}`);
    if (cronLogId) {
      try {
        await db.cronJobLog.update({
          where: { id: cronLogId },
          data: {
            status: "failed",
            finishedAt: new Date(),
            durationMs: Date.now() - startMs,
            errorMessage: truncateLog(msg),
            log: truncateLog(log.join("\n")),
          },
        });
      } catch {
        // best-effort
      }
    }
    throw err;
  }
}

// ── Job #3: Daily Maintenance (prune old data) ──
export async function runDailyMaintenanceJob(): Promise<void> {
  const startedAt = new Date();
  const startMs = Date.now();
  const log: string[] = [];
  logLine(log, "daily-maintenance: starting");

  let cronLogId: string | null = null;
  try {
    const created = await db.cronJobLog.create({
      data: {
        jobName: CRON_JOB_NAMES.DAILY_MAINTENANCE,
        status: "running",
        startedAt,
      },
    });
    cronLogId = created.id;
    logLine(log, `daily-maintenance: created log ${cronLogId}`);

    const now = new Date();
    const cutoffCronJobLog = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // >90d
    const cutoffNotificationLog = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // >30d

    let recordsWritten = 0;

    // ── 1. Prune old CronJobLog entries (>90d) ──
    const deletedCronLogs = await db.cronJobLog.deleteMany({
      where: { startedAt: { lt: cutoffCronJobLog } },
    });
    recordsWritten += deletedCronLogs.count;
    logLine(log, `daily-maintenance: deleted ${deletedCronLogs.count} old CronJobLog rows (>90d)`);

    // ── 2. Prune old NotificationLog entries (>30d) ──
    const deletedNotifications = await db.notificationLog.deleteMany({
      where: { createdAt: { lt: cutoffNotificationLog } },
    });
    recordsWritten += deletedNotifications.count;
    logLine(
      log,
      `daily-maintenance: deleted ${deletedNotifications.count} old NotificationLog rows (>30d)`
    );

    // ── 3. Prune expired OTPs ──
    const deletedOtps = await db.otpVerification.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    recordsWritten += deletedOtps.count;
    logLine(log, `daily-maintenance: deleted ${deletedOtps.count} expired OTPs`);

    // ── 4. Prune expired Sessions ──
    const deletedSessions = await db.session.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    recordsWritten += deletedSessions.count;
    logLine(log, `daily-maintenance: deleted ${deletedSessions.count} expired Sessions`);

    // ── 5. Prune expired AIResponseCache entries ──
    const deletedAiCache = await db.aIResponseCache.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    recordsWritten += deletedAiCache.count;
    logLine(
      log,
      `daily-maintenance: deleted ${deletedAiCache.count} expired AIResponseCache entries`
    );

    const durationMs = Date.now() - startMs;
    logLine(
      log,
      `daily-maintenance: completed — totalDeleted=${recordsWritten} durationMs=${durationMs}`
    );

    await db.cronJobLog.update({
      where: { id: cronLogId! },
      data: {
        status: "success",
        finishedAt: new Date(),
        durationMs,
        businessesProcessed: 0,
        recordsWritten,
        log: truncateLog(log.join("\n")),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logLine(log, `daily-maintenance: FATAL — ${msg}`);
    if (cronLogId) {
      try {
        await db.cronJobLog.update({
          where: { id: cronLogId },
          data: {
            status: "failed",
            finishedAt: new Date(),
            durationMs: Date.now() - startMs,
            errorMessage: truncateLog(msg),
            log: truncateLog(log.join("\n")),
          },
        });
      } catch {
        // best-effort
      }
    }
    throw err;
  }
}

// ── runWeeklyAiHealthJob (Phase 5) ──
// Sends a weekly AI health summary email to all configured notification recipients.
// Schedule: 06:00 UTC every Monday (external scheduler must trigger POST /api/cron/weekly-ai-health).
//
// The email includes:
//   - This week's total AI cost + comparison to last week
//   - Top 3 spenders
//   - Error rate
//   - Kill-switch triggers this week
//   - Active kill-switches (if any)
//   - Health status (healthy / watch / action_needed)
//
// If no recipients are configured, the job logs a warning and exits successfully
// (no email sent, but the cron job still records a successful run).
export async function runWeeklyAiHealthJob(): Promise<void> {
  const jobName = CRON_JOB_NAMES.WEEKLY_AI_HEALTH;
  const log: string[] = [];
  const startedAt = new Date();
  log.push(`[${startedAt.toISOString()}] Starting weekly AI health email job`);

  // Insert running status
  const cronLog = await db.cronJobLog.create({
    data: {
      jobName,
      status: "running",
      startedAt,
      log: log.join("\n"),
    },
  });

  try {
    // Dynamic import to avoid circular dependency (email.ts imports db, cron-jobs.ts imports db)
    const { sendEmail, getActiveRecipientEmails } = await import("./email");
    const { getActiveKillSwitches } = await import("./ai-kill-switch");

    const recipients = await getActiveRecipientEmails();
    log.push(`Found ${recipients.length} notification recipient(s)`);

    if (recipients.length === 0) {
      log.push("No recipients configured — skipping email send. Job completed successfully.");
      await db.cronJobLog.update({
        where: { id: cronLog.id },
        data: {
          status: "success",
          durationMs: Date.now() - startedAt.getTime(),
          log: log.join("\n"),
        },
      });
      return;
    }

    // ── Gather metrics ──
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [thisWeekAgg, lastWeekAgg, thisWeekCalls, thisWeekErrors, topSpenders, activeKillSwitches] = await Promise.all([
      db.aIUsageLog.aggregate({
        where: { createdAt: { gte: weekAgo } },
        _sum: { costEstimate: true },
      }),
      db.aIUsageLog.aggregate({
        where: { createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
        _sum: { costEstimate: true },
      }),
      db.aIUsageLog.count({ where: { createdAt: { gte: weekAgo } } }),
      db.aIUsageLog.count({ where: { createdAt: { gte: weekAgo }, success: false } }),
      db.aIUsageLog.groupBy({
        by: ["businessId"],
        where: { createdAt: { gte: weekAgo } },
        _sum: { costEstimate: true },
        _count: true,
        orderBy: { _sum: { costEstimate: "desc" } },
        take: 3,
      }),
      getActiveKillSwitches(),
    ]);

    // Fetch business names for top spenders
    const topSpenderIds = topSpenders.map((s) => s.businessId);
    const topSpenderBusinesses = topSpenderIds.length > 0
      ? await db.business.findMany({
          where: { id: { in: topSpenderIds } },
          select: { id: true, name: true },
        })
      : [];
    const businessMap = new Map(topSpenderBusinesses.map((b) => [b.id, b.name]));

    const thisWeekCost = thisWeekAgg._sum.costEstimate || 0;
    const lastWeekCost = lastWeekAgg._sum.costEstimate || 0;
    const costGrowth = lastWeekCost > 0 ? ((thisWeekCost - lastWeekCost) / lastWeekCost) * 100 : 0;
    const errorRate = thisWeekCalls > 0 ? (thisWeekErrors / thisWeekCalls) * 100 : 0;

    // ── Determine health status ──
    let healthStatus = "✅ Healthy";
    const issues: string[] = [];
    if (activeKillSwitches.length > 0) {
      healthStatus = "🚨 Action Needed";
      issues.push(`${activeKillSwitches.length} active kill-switch(es) — investigate immediately`);
    }
    if (errorRate > 5 && thisWeekCalls > 10) {
      healthStatus = "🚨 Action Needed";
      issues.push(`Error rate is ${errorRate.toFixed(1)}% (threshold 5%) — check Sentry`);
    }
    if (costGrowth > 100 && thisWeekCalls > 20) {
      if (healthStatus === "✅ Healthy") healthStatus = "⚠️ Watch";
      issues.push(`Cost grew ${costGrowth.toFixed(0)}% vs last week — check for abusers`);
    }
    if (issues.length === 0) {
      issues.push("All metrics within expected ranges. No action needed this week.");
    }

    log.push(`Health status: ${healthStatus}`);
    log.push(`This week cost: ৳${thisWeekCost.toFixed(2)} (last week: ৳${lastWeekCost.toFixed(2)}, growth: ${costGrowth.toFixed(1)}%)`);
    log.push(`This week calls: ${thisWeekCalls}, errors: ${thisWeekErrors} (${errorRate.toFixed(1)}%)`);
    log.push(`Active kill-switches: ${activeKillSwitches.length}`);

    // ── Build email HTML ──
    const topSpendersHtml = topSpenders.map((s, i) => {
      const name = businessMap.get(s.businessId) || "Unknown";
      const cost = s._sum.costEstimate || 0;
      return `<tr><td>${i + 1}</td><td>${name}</td><td>৳${cost.toFixed(2)}</td><td>${s._count}</td></tr>`;
    }).join("");

    const issuesHtml = issues.map((i) => `<li>${i}</li>`).join("");

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #7c3aed;">📊 Weekly AI Health Report</h1>
        <p style="color: #6b7280; font-size: 14px;">Generated: ${now.toISOString()}</p>

        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <h2 style="margin: 0 0 8px 0; font-size: 20px;">${healthStatus}</h2>
          <ul style="margin: 0; padding-left: 20px;">${issuesHtml}</ul>
        </div>

        <h3>📈 This Week's Metrics</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
          <tr style="background: #f9fafb;"><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>This Week Cost</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">৳${thisWeekCost.toFixed(2)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Last Week Cost</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">৳${lastWeekCost.toFixed(2)}</td></tr>
          <tr style="background: #f9fafb;"><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Growth Rate</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb; ${costGrowth > 100 ? "color: #dc2626; font-weight: bold;" : ""}">${costGrowth > 0 ? "+" : ""}${costGrowth.toFixed(1)}%</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Calls This Week</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${thisWeekCalls}</td></tr>
          <tr style="background: #f9fafb;"><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Error Rate</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb; ${errorRate > 5 ? "color: #dc2626; font-weight: bold;" : ""}">${errorRate.toFixed(1)}%</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Active Kill-Switches</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb; ${activeKillSwitches.length > 0 ? "color: #dc2626; font-weight: bold;" : ""}">${activeKillSwitches.length}</td></tr>
        </table>

        ${topSpenders.length > 0 ? `
        <h3>🏆 Top 3 Spenders This Week</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
          <tr style="background: #f9fafb;"><th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">#</th><th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Business</th><th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Cost</th><th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Calls</th></tr>
          ${topSpendersHtml}
        </table>
        ` : ""}

        <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="font-size: 12px; color: #6b7280;">
          This is an automated weekly report from InventoryOS Phase 5 Operations.
          You received this email because you are configured as a notification recipient.
          <br><br>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/admin" style="color: #7c3aed;">Open Super Admin Dashboard</a>
        </p>
      </div>
    `;

    // ── Send email ──
    const result = await sendEmail({
      to: recipients,
      subject: `📊 InventoryOS Weekly AI Health — ${healthStatus} — ${now.toLocaleDateString()}`,
      html,
      text: `Weekly AI Health Report\n\nStatus: ${healthStatus}\nThis week cost: ৳${thisWeekCost.toFixed(2)}\nLast week: ৳${lastWeekCost.toFixed(2)}\nGrowth: ${costGrowth.toFixed(1)}%\nCalls: ${thisWeekCalls}\nErrors: ${thisWeekErrors} (${errorRate.toFixed(1)}%)\nActive kill-switches: ${activeKillSwitches.length}\n\nIssues:\n${issues.map((i) => `- ${i}`).join("\n")}`,
    });

    log.push(`Email send result: sent=${result.sent}, fallbackUsed=${result.fallbackUsed || false}, error=${result.error || "none"}`);

    await db.cronJobLog.update({
      where: { id: cronLog.id },
      data: {
        status: "success",
        durationMs: Date.now() - startedAt.getTime(),
        businessesProcessed: recipients.length,
        recordsWritten: result.sent ? 1 : 0,
        log: log.join("\n"),
      },
    });
  } catch (err) {
    log.push(`[ERROR] ${err instanceof Error ? err.message : String(err)}`);
    await db.cronJobLog.update({
      where: { id: cronLog.id },
      data: {
        status: "failed",
        durationMs: Date.now() - startedAt.getTime(),
        errorMessage: err instanceof Error ? err.message : String(err),
        log: log.join("\n"),
      },
    });
    throw err;
  }
}

// ── Status Inspector (used by super-admin UI) ──
export interface CronJobStatus {
  jobName: CronJobName;
  schedule: string;
  description: string;
  latestRun: {
    id: string;
    status: "running" | "success" | "failed" | string;
    startedAt: Date;
    finishedAt: Date | null;
    durationMs: number | null;
    businessesProcessed: number;
    recordsWritten: number;
    errorMessage: string | null;
  } | null;
  totalRuns: number;
  recentFailures: Array<{
    id: string;
    startedAt: Date;
    durationMs: number | null;
    errorMessage: string | null;
  }>;
}

export async function getCronJobStatuses(): Promise<CronJobStatus[]> {
  const jobNames = Object.values(CRON_JOB_NAMES);
  const out: CronJobStatus[] = [];

  for (const jobName of jobNames) {
    const [latest, totalAgg, recentFailures] = await Promise.all([
      db.cronJobLog.findFirst({
        where: { jobName },
        orderBy: { startedAt: "desc" },
      }),
      db.cronJobLog.aggregate({
        where: { jobName },
        _count: true,
      }),
      db.cronJobLog.findMany({
        where: { jobName, status: "failed" },
        orderBy: { startedAt: "desc" },
        take: 5,
        select: { id: true, startedAt: true, durationMs: true, errorMessage: true },
      }),
    ]);

    out.push({
      jobName,
      schedule: CRON_JOB_SCHEDULES[jobName].schedule,
      description: CRON_JOB_SCHEDULES[jobName].description,
      latestRun: latest
        ? {
            id: latest.id,
            status: latest.status,
            startedAt: latest.startedAt,
            finishedAt: latest.finishedAt,
            durationMs: latest.durationMs,
            businessesProcessed: latest.businessesProcessed,
            recordsWritten: latest.recordsWritten,
            errorMessage: latest.errorMessage,
          }
        : null,
      totalRuns: totalAgg._count,
      recentFailures: recentFailures.map((f) => ({
        id: f.id,
        startedAt: f.startedAt,
        durationMs: f.durationMs,
        errorMessage: f.errorMessage,
      })),
    });
  }

  return out;
}

// ── Convenience: run all jobs (used by /api/super-admin/cron/run-all) ──
export async function runAllCronJobs(): Promise<{
  nightlyStats: { ok: boolean; error?: string };
  hourlySubscriptions: { ok: boolean; error?: string };
  dailyMaintenance: { ok: boolean; error?: string };
  weeklyAiHealth: { ok: boolean; error?: string };
}> {
  const result = {
    nightlyStats: { ok: true as boolean, error: undefined as string | undefined },
    hourlySubscriptions: { ok: true as boolean, error: undefined as string | undefined },
    dailyMaintenance: { ok: true as boolean, error: undefined as string | undefined },
    weeklyAiHealth: { ok: true as boolean, error: undefined as string | undefined },
  };

  try {
    await runNightlyStatsJob();
  } catch (e) {
    result.nightlyStats = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  try {
    await runHourlySubscriptionsJob();
  } catch (e) {
    result.hourlySubscriptions = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  try {
    await runDailyMaintenanceJob();
  } catch (e) {
    result.dailyMaintenance = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  try {
    await runWeeklyAiHealthJob();
  } catch (e) {
    result.weeklyAiHealth = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  return result;
}
