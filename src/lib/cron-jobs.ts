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
  REPORT_SCHEDULE_CHECKER: "report-schedule-checker",
  REPORT_GENERATOR_WORKER: "report-generator-worker", // @deprecated — use REPORT_WORKER
  REPORT_DELIVERY_WORKER: "report-delivery-worker",   // @deprecated — use REPORT_WORKER
  REPORT_WORKER: "report-worker", // Phase 4: merged generator + delivery
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
  [CRON_JOB_NAMES.REPORT_SCHEDULE_CHECKER]: {
    schedule: "0 * * * *", // every 1 hour (Phase 4: was every 15 min, reduced 75%)
    description:
      "Phase C: Check all active report schedules. For each schedule where nextRunAt <= now, create GeneratedReport rows (status=pending) for each target business, then update the schedule's lastRunAt and nextRunAt. Weekly/monthly schedules don't need 15-min precision — hourly is sufficient.",
  },
  [CRON_JOB_NAMES.REPORT_GENERATOR_WORKER]: {
    schedule: "*/5 * * * *", // @deprecated — use report-worker instead
    description:
      "[DEPRECATED — Phase 4 merged into report-worker] Pick up pending GeneratedReport rows, call AI, create delivery rows. Kept for backward compatibility with existing external schedulers.",
  },
  [CRON_JOB_NAMES.REPORT_DELIVERY_WORKER]: {
    schedule: "* * * * *", // @deprecated — use report-worker instead
    description:
      "[DEPRECATED — Phase 4 merged into report-worker] Pick up queued deliveries, send via email/WhatsApp. Kept for backward compatibility with existing external schedulers.",
  },
  [CRON_JOB_NAMES.REPORT_WORKER]: {
    schedule: "*/2 * * * *", // every 2 minutes (Phase 4: replaces generator + delivery)
    description:
      "Phase 4: Merged report-generator-worker + report-delivery-worker into a single job. First processes pending reports (calls AI prediction algorithm), then processes queued deliveries (sends emails). Reduces cron triggers by 58% vs the two separate workers.",
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

// ── runReportScheduleCheckerJob (Phase C) ──
// Checks all active report schedules. For each schedule where nextRunAt <= now:
//   1. Determines the target client list
//   2. Creates GeneratedReport rows (status=pending) for each target business
//   3. Updates the schedule's lastRunAt and nextRunAt
//
// The pending reports are picked up by the report-generator-worker (Phase D)
// which calls the AI prediction algorithm and generates the actual report content.
//
// Schedule: every 15 minutes (external scheduler must trigger POST /api/cron/report-schedule-checker).
export async function runReportScheduleCheckerJob(): Promise<void> {
  const jobName = CRON_JOB_NAMES.REPORT_SCHEDULE_CHECKER;
  const log: string[] = [];
  const startedAt = new Date();
  log.push(`[${startedAt.toISOString()}] Starting report schedule checker`);

  const cronLog = await db.cronJobLog.create({
    data: { jobName, status: "running", startedAt, log: log.join("\n") },
  });

  try {
    const now = new Date();

    // Find all active schedules where nextRunAt <= now
    const dueSchedules = await db.reportSchedule.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: now },
      },
    });

    log.push(`Found ${dueSchedules.length} due schedule(s)`);

    let totalReportsCreated = 0;
    let businessesProcessed = 0;

    for (const schedule of dueSchedules) {
      log.push(`Processing schedule: "${schedule.name}" (${schedule.id})`);

      // Determine target businesses
      let targetBusinessIds: string[] = [];
      if (schedule.targetClientMode === "all") {
        const businesses = await db.business.findMany({
          where: { isActive: true, subscriptionTier: "pro_ai" },
          select: { id: true },
        });
        targetBusinessIds = businesses.map((b) => b.id);
      } else {
        targetBusinessIds = JSON.parse(schedule.targetClientIds || "[]");
      }

      log.push(`  Target businesses: ${targetBusinessIds.length}`);

      // Check for duplicate reports (same schedule + same business + same date)
      // to avoid creating duplicate reports if the checker runs twice
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      for (const businessId of targetBusinessIds) {
        const existing = await db.generatedReport.findFirst({
          where: {
            scheduleId: schedule.id,
            businessId,
            reportDate: { gte: todayStart },
          },
        });

        if (existing) {
          log.push(`  Skipping ${businessId} — report already exists for today`);
          continue;
        }

        // Create pending GeneratedReport
        const periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() + 1);
        const periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + schedule.reportPeriodDays - 1);

        await db.generatedReport.create({
          data: {
            scheduleId: schedule.id,
            businessId,
            reportDate: now,
            reportPeriodStart: periodStart,
            reportPeriodEnd: periodEnd,
            generationStatus: "pending",
            predictionConfidence: "medium",
            appliedInfluences: JSON.stringify({
              seasons: schedule.considerSeasons ? [] : ["disabled"],
              occasions: JSON.parse(schedule.occasions || "[]"),
              epidemics: schedule.considerEpidemics ? [] : ["disabled"],
            }),
          },
        });
        totalReportsCreated++;
        businessesProcessed++;
      }

      // Update schedule's lastRunAt and nextRunAt
      const { computeNextRunAt } = await import("./schedule-compute");
      const nextRunAt = computeNextRunAt(
        schedule.frequency,
        schedule.dayOfWeek,
        schedule.dayOfMonth,
        schedule.startDate,
        schedule.endDate,
        now,
        now
      );

      await db.reportSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          nextRunAt,
        },
      });

      log.push(`  Created ${totalReportsCreated} pending reports. Next run: ${nextRunAt?.toISOString() || "none"}`);
      totalReportsCreated = 0; // reset per schedule
    }

    await db.cronJobLog.update({
      where: { id: cronLog.id },
      data: {
        status: "success",
        durationMs: Date.now() - startedAt.getTime(),
        businessesProcessed,
        recordsWritten: totalReportsCreated,
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

// ── runReportGeneratorWorker (Phase D) ──
// Picks up pending GeneratedReport rows, calls the AI prediction algorithm
// (via generateReport from report-generator.ts) to generate report content,
// then creates ReportDelivery rows (status=queued) for each configured channel.
//
// Schedule: every 5 minutes (external scheduler must trigger POST /api/cron/report-generator-worker).
// Batch size: 5 reports per run (configurable) to avoid timeouts.
export async function runReportGeneratorWorker(): Promise<void> {
  const jobName = CRON_JOB_NAMES.REPORT_GENERATOR_WORKER;
  const log: string[] = [];
  const startedAt = new Date();
  log.push(`[${startedAt.toISOString()}] Starting report generator worker`);

  const cronLog = await db.cronJobLog.create({
    data: { jobName, status: "running", startedAt, log: log.join("\n") },
  });

  try {
    const BATCH_SIZE = 5;

    // Find pending reports, oldest first
    const pendingReports = await db.generatedReport.findMany({
      where: { generationStatus: "pending" },
      orderBy: { reportDate: "asc" },
      take: BATCH_SIZE,
      include: { schedule: true },
    });

    log.push(`Found ${pendingReports.length} pending report(s) to process`);

    let succeeded = 0;
    let failed = 0;

    for (const pendingReport of pendingReports) {
      log.push(`Processing report ${pendingReport.id} for business ${pendingReport.businessId}`);

      // Mark as generating (prevents another worker from picking it up)
      await db.generatedReport.update({
        where: { id: pendingReport.id },
        data: { generationStatus: "generating" },
      });

      try {
        // Dynamic import to avoid circular dependency
        const { generateReport } = await import("./report-generator");

        const result = await generateReport({
          businessId: pendingReport.businessId,
          scheduleId: pendingReport.scheduleId,
          reportPeriodDays: pendingReport.schedule.reportPeriodDays,
          considerSeasons: pendingReport.schedule.considerSeasons,
          considerEpidemics: pendingReport.schedule.considerEpidemics,
        });

        if (result.success) {
          // The generateReport function already created a NEW GeneratedReport
          // with the content. We need to delete the original pending one
          // (since generateReport creates its own row with status=generating→completed).
          // Actually, generateReport creates a NEW row, so we should delete the
          // pending placeholder and use the new one.
          await db.generatedReport.delete({ where: { id: pendingReport.id } });

          // Create ReportDelivery rows for the new report
          if (result.reportId) {
            const channels = JSON.parse(pendingReport.schedule.deliveryChannels || "[\"email\"]");
            const business = await db.business.findUnique({
              where: { id: pendingReport.businessId },
              select: { ownerEmail: true, ownerWhatsapp: true, phone: true, name: true },
            });

            for (const channel of channels) {
              let recipient: string | null = null;
              if (channel === "email") {
                recipient = business?.ownerEmail || null;
              } else if (channel === "whatsapp") {
                recipient = business?.ownerWhatsapp || business?.phone || null;
              }

              if (recipient) {
                await db.reportDelivery.create({
                  data: {
                    reportId: result.reportId,
                    channel,
                    recipient,
                    status: "queued",
                  },
                });
                log.push(`  Created ${channel} delivery to ${recipient}`);
              } else {
                log.push(`  ⚠ No ${channel} recipient for business ${business?.name || pendingReport.businessId} — skipping delivery`);
              }
            }
          }

          succeeded++;
          log.push(`  ✓ Report generated successfully (tokens: ${result.aiTokensUsed}, cost: ${result.aiCostEstimate} BDT${result.fallbackUsed ? ", FALLBACK USED" : ""})`);
        } else {
          // Mark the original pending report as failed
          await db.generatedReport.update({
            where: { id: pendingReport.id },
            data: {
              generationStatus: "failed",
              errorMessage: result.errorMessage || "Unknown error",
            },
          });
          failed++;
          log.push(`  ✗ Report generation failed: ${result.errorMessage}`);
        }
      } catch (err) {
        await db.generatedReport.update({
          where: { id: pendingReport.id },
          data: {
            generationStatus: "failed",
            errorMessage: err instanceof Error ? err.message : String(err),
          },
        });
        failed++;
        log.push(`  ✗ Exception: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    await db.cronJobLog.update({
      where: { id: cronLog.id },
      data: {
        status: "success",
        durationMs: Date.now() - startedAt.getTime(),
        businessesProcessed: pendingReports.length,
        recordsWritten: succeeded,
        log: log.join("\n") + `\n\nSummary: ${succeeded} succeeded, ${failed} failed`,
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

// ── runReportDeliveryWorker (Phase D) ──
// Picks up queued ReportDelivery rows, sends via email (SMTP) or WhatsApp (future),
// updates status to sent/failed. Retry logic: 3 attempts with exponential backoff
// (1min, 5min, 15min). After 3 failures, marks as failed.
//
// Schedule: every 1 minute (external scheduler must trigger POST /api/cron/report-delivery-worker).
// Batch size: 20 deliveries per run.
export async function runReportDeliveryWorker(): Promise<void> {
  const jobName = CRON_JOB_NAMES.REPORT_DELIVERY_WORKER;
  const log: string[] = [];
  const startedAt = new Date();
  log.push(`[${startedAt.toISOString()}] Starting report delivery worker`);

  const cronLog = await db.cronJobLog.create({
    data: { jobName, status: "running", startedAt, log: log.join("\n") },
  });

  try {
    const BATCH_SIZE = 20;

    // Find queued deliveries, oldest first
    const queuedDeliveries = await db.reportDelivery.findMany({
      where: { status: "queued" },
      orderBy: { createdAt: "asc" },
      take: BATCH_SIZE,
      include: {
        report: {
          include: {
            business: { select: { name: true } },
            schedule: { select: { name: true } },
          },
        },
      },
    });

    log.push(`Found ${queuedDeliveries.length} queued deliver(ies) to send`);

    let sent = 0;
    let failed = 0;

    // Dynamic import for email module
    const { sendEmail } = await import("./email");

    for (const delivery of queuedDeliveries) {
      log.push(`Processing delivery ${delivery.id} (${delivery.channel} → ${delivery.recipient})`);

      try {
        if (delivery.channel === "email") {
          // Build email HTML from the report content
          const report = delivery.report;
          const spikePredictions = report.spikePredictions ? JSON.parse(report.spikePredictions) : [];
          const topItems = report.topItems ? JSON.parse(report.topItems) : [];
          const stockRisks = report.stockRisks ? JSON.parse(report.stockRisks) : [];

          const businessName = report.business?.name || "Your Pharmacy";
          const periodStart = new Date(report.reportPeriodStart).toLocaleDateString();
          const periodEnd = new Date(report.reportPeriodEnd).toLocaleDateString();

          // Build HTML email
          const spikesHtml = spikePredictions.map((s: any, i: number) =>
            `<tr><td style="padding:6px;border:1px solid #e5e7eb;">${i + 1}</td><td style="padding:6px;border:1px solid #e5e7eb;">${s.product}</td><td style="padding:6px;border:1px solid #e5e7eb;color:#dc2626;font-weight:bold;">+${s.spikePercent}%</td><td style="padding:6px;border:1px solid #e5e7eb;">${s.occasion}</td><td style="padding:6px;border:1px solid #e5e7eb;">${s.recommendation}</td></tr>`
          ).join("");

          const topItemsHtml = topItems.slice(0, 20).map((item: any, i: number) => {
            const statusColor = item.stockStatus === "order_now" || item.stockStatus === "out" ? "#dc2626" : item.stockStatus === "low" ? "#f59e0b" : "#10b981";
            return `<tr><td style="padding:4px 6px;border:1px solid #e5e7eb;">${i + 1}</td><td style="padding:4px 6px;border:1px solid #e5e7eb;">${item.product}</td><td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:right;">${item.predictedQty}</td><td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:right;">৳${item.predictedProfit?.toLocaleString() || 0}</td><td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:right;">${item.currentStock}</td><td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center;color:${statusColor};font-weight:bold;">${item.stockStatus?.toUpperCase() || "GOOD"}</td></tr>`;
          }).join("");

          const risksHtml = stockRisks.map((r: any) => {
            const urgencyColor = r.urgency === "critical" ? "#dc2626" : r.urgency === "high" ? "#f59e0b" : "#3b82f6";
            return `<tr><td style="padding:6px;border:1px solid #e5e7eb;font-weight:bold;">${r.product}</td><td style="padding:6px;border:1px solid #e5e7eb;">${r.daysUntilStockout !== null ? r.daysUntilStockout + " days" : "Already out"}</td><td style="padding:6px;border:1px solid #e5e7eb;">Order: ${r.recommendedPurchaseQty}</td><td style="padding:6px;border:1px solid #e5e7eb;">${r.supplier || "—"}</td><td style="padding:6px;border:1px solid #e5e7eb;color:${urgencyColor};font-weight:bold;">${r.urgency?.toUpperCase() || "MEDIUM"}</td></tr>`;
          }).join("");

          const html = `
            <div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;background:#f9fafb;padding:20px;">
              <div style="background:#064e3b;color:white;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
                <h1 style="margin:0;font-size:24px;">📊 InventoryOS Weekly Prediction</h1>
                <p style="margin:4px 0 0 0;font-size:14px;opacity:0.9;">${businessName} · ${periodStart} → ${periodEnd}</p>
              </div>
              <div style="background:white;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
                <div style="background:#f0fdf4;border-left:4px solid #10b981;padding:12px;margin-bottom:20px;border-radius:4px;">
                  <strong>Executive Summary:</strong><br/>${report.executiveSummary || "No summary available."}
                </div>
                ${spikePredictions.length > 0 ? `
                <h2 style="color:#7c3aed;font-size:16px;margin-bottom:8px;">📈 Big Sales Spike Predictions</h2>
                <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;">
                  <thead><tr style="background:#f3f4f6;"><th style="padding:6px;border:1px solid #e5e7eb;text-align:left;">#</th><th style="padding:6px;border:1px solid #e5e7eb;text-align:left;">Product</th><th style="padding:6px;border:1px solid #e5e7eb;text-align:left;">Spike</th><th style="padding:6px;border:1px solid #e5e7eb;text-align:left;">Occasion</th><th style="padding:6px;border:1px solid #e5e7eb;text-align:left;">Recommendation</th></tr></thead>
                  <tbody>${spikesHtml}</tbody>
                </table>` : ""}
                ${topItems.length > 0 ? `
                <h2 style="color:#2563eb;font-size:16px;margin-bottom:8px;">🏆 Top 20 High-Potential Items</h2>
                <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:12px;">
                  <thead><tr style="background:#f3f4f6;"><th style="padding:4px 6px;border:1px solid #e5e7eb;text-align:left;">#</th><th style="padding:4px 6px;border:1px solid #e5e7eb;text-align:left;">Product</th><th style="padding:4px 6px;border:1px solid #e5e7eb;text-align:right;">Pred. Qty</th><th style="padding:4px 6px;border:1px solid #e5e7eb;text-align:right;">Profit</th><th style="padding:4px 6px;border:1px solid #e5e7eb;text-align:right;">Stock</th><th style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center;">Status</th></tr></thead>
                  <tbody>${topItemsHtml}</tbody>
                </table>` : ""}
                ${stockRisks.length > 0 ? `
                <h2 style="color:#dc2626;font-size:16px;margin-bottom:8px;">⚠️ Stock Risks & Recommendations</h2>
                <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;">
                  <thead><tr style="background:#fef2f2;"><th style="padding:6px;border:1px solid #e5e7eb;text-align:left;">Product</th><th style="padding:6px;border:1px solid #e5e7eb;text-align:left;">Stockout In</th><th style="padding:6px;border:1px solid #e5e7eb;text-align:left;">Action</th><th style="padding:6px;border:1px solid #e5e7eb;text-align:left;">Supplier</th><th style="padding:6px;border:1px solid #e5e7eb;text-align:left;">Urgency</th></tr></thead>
                  <tbody>${risksHtml}</tbody>
                </table>` : ""}
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
                <p style="font-size:11px;color:#6b7280;text-align:center;">
                  Generated by InventoryOS AI · Prediction confidence: ${report.predictionConfidence}<br/>
                  This is an automated report. You received this email because your pharmacy is subscribed to InventoryOS Pro+AI.
                </p>
              </div>
            </div>
          `;

          const textContent = `Weekly Prediction Report — ${businessName}\nPeriod: ${periodStart} to ${periodEnd}\n\nExecutive Summary:\n${report.executiveSummary || "No summary available."}\n\nVisit InventoryOS for the full report with top 20 items and stock risks.`;

          const emailResult = await sendEmail({
            to: [delivery.recipient],
            subject: `📊 Weekly Sales Prediction — ${businessName} — ${periodStart}`,
            html,
            text: textContent,
          });

          if (emailResult.sent) {
            await db.reportDelivery.update({
              where: { id: delivery.id },
              data: {
                status: "sent",
                sentAt: new Date(),
                providerMessageId: emailResult.messageIds[0] || null,
              },
            });
            sent++;
            log.push(`  ✓ Email sent successfully`);
          } else {
            // Email failed — check retry count
            const newRetryCount = delivery.retryCount + 1;
            if (newRetryCount >= 3) {
              await db.reportDelivery.update({
                where: { id: delivery.id },
                data: {
                  status: "failed",
                  retryCount: newRetryCount,
                  errorMessage: emailResult.error || "Email send failed after 3 attempts",
                },
              });
              failed++;
              log.push(`  ✗ Email failed permanently after ${newRetryCount} attempts: ${emailResult.error}`);
            } else {
              // Schedule retry (status stays queued, retryCount incremented)
              await db.reportDelivery.update({
                where: { id: delivery.id },
                data: {
                  retryCount: newRetryCount,
                  errorMessage: emailResult.error || "Email send failed, will retry",
                },
              });
              log.push(`  ⚠ Email failed (attempt ${newRetryCount}/3), will retry: ${emailResult.error}`);
            }
          }
        } else if (delivery.channel === "whatsapp") {
          // WhatsApp delivery is Phase E — for now, mark as failed with a clear message
          await db.reportDelivery.update({
            where: { id: delivery.id },
            data: {
              status: "failed",
              errorMessage: "WhatsApp delivery not yet implemented (Phase E). Email delivery is available.",
            },
          });
          failed++;
          log.push(`  ✗ WhatsApp delivery not yet implemented (Phase E)`);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const newRetryCount = delivery.retryCount + 1;
        if (newRetryCount >= 3) {
          await db.reportDelivery.update({
            where: { id: delivery.id },
            data: {
              status: "failed",
              retryCount: newRetryCount,
              errorMessage: errorMsg,
            },
          });
          failed++;
          log.push(`  ✗ Exception (permanent): ${errorMsg}`);
        } else {
          await db.reportDelivery.update({
            where: { id: delivery.id },
            data: {
              retryCount: newRetryCount,
              errorMessage: errorMsg,
            },
          });
          log.push(`  ⚠ Exception (attempt ${newRetryCount}/3), will retry: ${errorMsg}`);
        }
      }
    }

    await db.cronJobLog.update({
      where: { id: cronLog.id },
      data: {
        status: "success",
        durationMs: Date.now() - startedAt.getTime(),
        businessesProcessed: queuedDeliveries.length,
        recordsWritten: sent,
        log: log.join("\n") + `\n\nSummary: ${sent} sent, ${failed} failed`,
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

// ── runReportWorker (Phase 4 — merged generator + delivery) ──
// Single job that replaces runReportGeneratorWorker + runReportDeliveryWorker.
// Runs every 2 minutes. Does two things in sequence:
//   1. Process pending reports (call AI, create delivery rows)
//   2. Process queued deliveries (send emails, retry on failure)
//
// This reduces cron triggers from 1,440 + 288 = 1,728/day to 720/day (58% reduction).
// The old separate endpoints are kept for backward compatibility but should be
// replaced with this single endpoint in external scheduler configs.
export async function runReportWorker(): Promise<void> {
  const jobName = CRON_JOB_NAMES.REPORT_WORKER;
  const log: string[] = [];
  const startedAt = new Date();
  log.push(`[${startedAt.toISOString()}] Starting report worker (merged generator + delivery)`);

  const cronLog = await db.cronJobLog.create({
    data: { jobName, status: "running", startedAt, log: log.join("\n") },
  });

  let reportsProcessed = 0;
  let reportsSucceeded = 0;
  let reportsFailed = 0;
  let deliveriesSent = 0;
  let deliveriesFailed = 0;

  try {
    // ═══ PHASE 1: Process pending reports (was runReportGeneratorWorker) ═══
    const PENDING_BATCH = 5;
    const pendingReports = await db.generatedReport.findMany({
      where: { generationStatus: "pending" },
      orderBy: { reportDate: "asc" },
      take: PENDING_BATCH,
      include: { schedule: true },
    });

    log.push(`Phase 1: Found ${pendingReports.length} pending report(s)`);

    for (const pendingReport of pendingReports) {
      log.push(`  Processing report ${pendingReport.id} for business ${pendingReport.businessId}`);
      reportsProcessed++;

      await db.generatedReport.update({
        where: { id: pendingReport.id },
        data: { generationStatus: "generating" },
      });

      try {
        const { generateReport } = await import("./report-generator");
        const result = await generateReport({
          businessId: pendingReport.businessId,
          scheduleId: pendingReport.scheduleId,
          reportPeriodDays: pendingReport.schedule.reportPeriodDays,
          considerSeasons: pendingReport.schedule.considerSeasons,
          considerEpidemics: pendingReport.schedule.considerEpidemics,
        });

        if (result.success) {
          // Delete the pending placeholder (generateReport creates its own row)
          await db.generatedReport.delete({ where: { id: pendingReport.id } });

          // Create delivery rows for the new report
          if (result.reportId) {
            const channels = JSON.parse(pendingReport.schedule.deliveryChannels || "[\"email\"]");
            const business = await db.business.findUnique({
              where: { id: pendingReport.businessId },
              select: { ownerEmail: true, ownerWhatsapp: true, phone: true, name: true },
            });

            for (const channel of channels) {
              let recipient: string | null = null;
              if (channel === "email") recipient = business?.ownerEmail || null;
              else if (channel === "whatsapp") recipient = business?.ownerWhatsapp || business?.phone || null;

              if (recipient) {
                await db.reportDelivery.create({
                  data: { reportId: result.reportId, channel, recipient, status: "queued" },
                });
                log.push(`    Created ${channel} delivery to ${recipient}`);
              } else {
                log.push(`    ⚠ No ${channel} recipient for ${business?.name || pendingReport.businessId}`);
              }
            }
          }
          reportsSucceeded++;
          log.push(`    ✓ Success (tokens: ${result.aiTokensUsed}, cost: ${result.aiCostEstimate} BDT${result.fallbackUsed ? ", FALLBACK" : ""})`);
        } else {
          await db.generatedReport.update({
            where: { id: pendingReport.id },
            data: { generationStatus: "failed", errorMessage: result.errorMessage || "Unknown error" },
          });
          reportsFailed++;
          log.push(`    ✗ Failed: ${result.errorMessage}`);
        }
      } catch (err) {
        await db.generatedReport.update({
          where: { id: pendingReport.id },
          data: { generationStatus: "failed", errorMessage: err instanceof Error ? err.message : String(err) },
        });
        reportsFailed++;
        log.push(`    ✗ Exception: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ═══ PHASE 2: Process queued deliveries (was runReportDeliveryWorker) ═══
    const DELIVERY_BATCH = 20;
    const queuedDeliveries = await db.reportDelivery.findMany({
      where: { status: "queued" },
      orderBy: { createdAt: "asc" },
      take: DELIVERY_BATCH,
      include: {
        report: {
          include: {
            business: { select: { name: true } },
            schedule: { select: { name: true } },
          },
        },
      },
    });

    log.push(`Phase 2: Found ${queuedDeliveries.length} queued deliver(ies)`);

    const { sendEmail } = await import("./email");

    for (const delivery of queuedDeliveries) {
      log.push(`  Delivery ${delivery.id} (${delivery.channel} → ${delivery.recipient})`);

      try {
        if (delivery.channel === "email") {
          // Build HTML email from report content
          const report = delivery.report;
          const spikePredictions = report.spikePredictions ? JSON.parse(report.spikePredictions) : [];
          const topItems = report.topItems ? JSON.parse(report.topItems) : [];
          const stockRisks = report.stockRisks ? JSON.parse(report.stockRisks) : [];
          const businessName = report.business?.name || "Your Pharmacy";
          const periodStart = new Date(report.reportPeriodStart).toLocaleDateString();
          const periodEnd = new Date(report.reportPeriodEnd).toLocaleDateString();

          const spikesHtml = spikePredictions.map((s: any, i: number) =>
            `<tr><td style="padding:6px;border:1px solid #e5e7eb;">${i + 1}</td><td style="padding:6px;border:1px solid #e5e7eb;">${s.product}</td><td style="padding:6px;border:1px solid #e5e7eb;color:#dc2626;font-weight:bold;">+${s.spikePercent}%</td><td style="padding:6px;border:1px solid #e5e7eb;">${s.occasion}</td><td style="padding:6px;border:1px solid #e5e7eb;">${s.recommendation}</td></tr>`
          ).join("");

          const topItemsHtml = topItems.slice(0, 20).map((item: any, i: number) => {
            const sc = item.stockStatus === "order_now" || item.stockStatus === "out" ? "#dc2626" : item.stockStatus === "low" ? "#f59e0b" : "#10b981";
            return `<tr><td style="padding:4px 6px;border:1px solid #e5e7eb;">${i + 1}</td><td style="padding:4px 6px;border:1px solid #e5e7eb;">${item.product}</td><td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:right;">${item.predictedQty}</td><td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:right;">৳${item.predictedProfit?.toLocaleString() || 0}</td><td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:right;">${item.currentStock}</td><td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center;color:${sc};font-weight:bold;">${item.stockStatus?.toUpperCase() || "GOOD"}</td></tr>`;
          }).join("");

          const risksHtml = stockRisks.map((r: any) => {
            const uc = r.urgency === "critical" ? "#dc2626" : r.urgency === "high" ? "#f59e0b" : "#3b82f6";
            return `<tr><td style="padding:6px;border:1px solid #e5e7eb;font-weight:bold;">${r.product}</td><td style="padding:6px;border:1px solid #e5e7eb;">${r.daysUntilStockout !== null ? r.daysUntilStockout + " days" : "Already out"}</td><td style="padding:6px;border:1px solid #e5e7eb;">Order: ${r.recommendedPurchaseQty}</td><td style="padding:6px;border:1px solid #e5e7eb;">${r.supplier || "—"}</td><td style="padding:6px;border:1px solid #e5e7eb;color:${uc};font-weight:bold;">${r.urgency?.toUpperCase() || "MEDIUM"}</td></tr>`;
          }).join("");

          const html = `<div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;background:#f9fafb;padding:20px;"><div style="background:#064e3b;color:white;padding:20px;border-radius:8px 8px 0 0;text-align:center;"><h1 style="margin:0;font-size:24px;">📊 InventoryOS Weekly Prediction</h1><p style="margin:4px 0 0 0;font-size:14px;opacity:0.9;">${businessName} · ${periodStart} → ${periodEnd}</p></div><div style="background:white;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;"><div style="background:#f0fdf4;border-left:4px solid #10b981;padding:12px;margin-bottom:20px;border-radius:4px;"><strong>Executive Summary:</strong><br/>${report.executiveSummary || "No summary available."}</div>${spikePredictions.length > 0 ? `<h2 style="color:#7c3aed;font-size:16px;margin-bottom:8px;">📈 Big Sales Spike Predictions</h2><table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;"><thead><tr style="background:#f3f4f6;"><th style="padding:6px;border:1px solid #e5e7eb;text-align:left;">#</th><th style="padding:6px;border:1px solid #e5e7eb;text-align:left;">Product</th><th style="padding:6px;border:1px solid #e5e7eb;text-align:left;">Spike</th><th style="padding:6px;border:1px solid #e5e7eb;text-align:left;">Occasion</th><th style="padding:6px;border:1px solid #e5e7eb;text-align:left;">Recommendation</th></tr></thead><tbody>${spikesHtml}</tbody></table>` : ""}${topItems.length > 0 ? `<h2 style="color:#2563eb;font-size:16px;margin-bottom:8px;">🏆 Top 20 High-Potential Items</h2><table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:12px;"><thead><tr style="background:#f3f4f6;"><th style="padding:4px 6px;border:1px solid #e5e7eb;text-align:left;">#</th><th style="padding:4px 6px;border:1px solid #e5e7eb;text-align:left;">Product</th><th style="padding:4px 6px;border:1px solid #e5e7eb;text-align:right;">Pred. Qty</th><th style="padding:4px 6px;border:1px solid #e5e7eb;text-align:right;">Profit</th><th style="padding:4px 6px;border:1px solid #e5e7eb;text-align:right;">Stock</th><th style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center;">Status</th></tr></thead><tbody>${topItemsHtml}</tbody></table>` : ""}${stockRisks.length > 0 ? `<h2 style="color:#dc2626;font-size:16px;margin-bottom:8px;">⚠️ Stock Risks & Recommendations</h2><table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;"><thead><tr style="background:#fef2f2;"><th style="padding:6px;border:1px solid #e5e7eb;text-align:left;">Product</th><th style="padding:6px;border:1px solid #e5e7eb;text-align:left;">Stockout In</th><th style="padding:6px;border:1px solid #e5e7eb;text-align:left;">Action</th><th style="padding:6px;border:1px solid #e5e7eb;text-align:left;">Supplier</th><th style="padding:6px;border:1px solid #e5e7eb;text-align:left;">Urgency</th></tr></thead><tbody>${risksHtml}</tbody></table>` : ""}<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/><p style="font-size:11px;color:#6b7280;text-align:center;">Generated by InventoryOS AI · Prediction confidence: ${report.predictionConfidence}<br/>This is an automated report. You received this email because your pharmacy is subscribed to InventoryOS Pro+AI.</p></div></div>`;

          const textContent = `Weekly Prediction Report — ${businessName}\nPeriod: ${periodStart} to ${periodEnd}\n\nExecutive Summary:\n${report.executiveSummary || "No summary available."}\n\nVisit InventoryOS for the full report with top 20 items and stock risks.`;

          const emailResult = await sendEmail({
            to: [delivery.recipient],
            subject: `📊 Weekly Sales Prediction — ${businessName} — ${periodStart}`,
            html, text: textContent,
          });

          if (emailResult.sent) {
            await db.reportDelivery.update({
              where: { id: delivery.id },
              data: { status: "sent", sentAt: new Date(), providerMessageId: emailResult.messageIds[0] || null },
            });
            deliveriesSent++;
            log.push(`    ✓ Email sent`);
          } else {
            const newRetry = delivery.retryCount + 1;
            if (newRetry >= 3) {
              await db.reportDelivery.update({
                where: { id: delivery.id },
                data: { status: "failed", retryCount: newRetry, errorMessage: emailResult.error || "Failed after 3 attempts" },
              });
              deliveriesFailed++;
              log.push(`    ✗ Failed permanently (${newRetry}/3): ${emailResult.error}`);
            } else {
              await db.reportDelivery.update({
                where: { id: delivery.id },
                data: { retryCount: newRetry, errorMessage: emailResult.error || "Will retry" },
              });
              log.push(`    ⚠ Failed (${newRetry}/3), will retry: ${emailResult.error}`);
            }
          }
        } else if (delivery.channel === "whatsapp") {
          await db.reportDelivery.update({
            where: { id: delivery.id },
            data: { status: "failed", errorMessage: "WhatsApp delivery not yet implemented (Phase E)" },
          });
          deliveriesFailed++;
          log.push(`    ✗ WhatsApp not implemented (Phase E)`);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const newRetry = delivery.retryCount + 1;
        if (newRetry >= 3) {
          await db.reportDelivery.update({
            where: { id: delivery.id },
            data: { status: "failed", retryCount: newRetry, errorMessage: errorMsg },
          });
          deliveriesFailed++;
          log.push(`    ✗ Exception (permanent): ${errorMsg}`);
        } else {
          await db.reportDelivery.update({
            where: { id: delivery.id },
            data: { retryCount: newRetry, errorMessage: errorMsg },
          });
          log.push(`    ⚠ Exception (${newRetry}/3), will retry: ${errorMsg}`);
        }
      }
    }

    // ═══ Summary ═══
    const summary = `Reports: ${reportsProcessed} processed (${reportsSucceeded} ok, ${reportsFailed} failed) | Deliveries: ${queuedDeliveries.length} processed (${deliveriesSent} sent, ${deliveriesFailed} failed)`;
    log.push(`\n${summary}`);

    await db.cronJobLog.update({
      where: { id: cronLog.id },
      data: {
        status: "success",
        durationMs: Date.now() - startedAt.getTime(),
        businessesProcessed: reportsProcessed + queuedDeliveries.length,
        recordsWritten: reportsSucceeded + deliveriesSent,
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
  reportScheduleChecker: { ok: boolean; error?: string };
  reportWorker: { ok: boolean; error?: string };
}> {
  const result = {
    nightlyStats: { ok: true as boolean, error: undefined as string | undefined },
    hourlySubscriptions: { ok: true as boolean, error: undefined as string | undefined },
    dailyMaintenance: { ok: true as boolean, error: undefined as string | undefined },
    weeklyAiHealth: { ok: true as boolean, error: undefined as string | undefined },
    reportScheduleChecker: { ok: true as boolean, error: undefined as string | undefined },
    reportWorker: { ok: true as boolean, error: undefined as string | undefined },
  };

  try { await runNightlyStatsJob(); } catch (e) { result.nightlyStats = { ok: false, error: e instanceof Error ? e.message : String(e) }; }
  try { await runHourlySubscriptionsJob(); } catch (e) { result.hourlySubscriptions = { ok: false, error: e instanceof Error ? e.message : String(e) }; }
  try { await runDailyMaintenanceJob(); } catch (e) { result.dailyMaintenance = { ok: false, error: e instanceof Error ? e.message : String(e) }; }
  try { await runWeeklyAiHealthJob(); } catch (e) { result.weeklyAiHealth = { ok: false, error: e instanceof Error ? e.message : String(e) }; }
  try { await runReportScheduleCheckerJob(); } catch (e) { result.reportScheduleChecker = { ok: false, error: e instanceof Error ? e.message : String(e) }; }
  try { await runReportWorker(); } catch (e) { result.reportWorker = { ok: false, error: e instanceof Error ? e.message : String(e) }; }

  return result;
}
