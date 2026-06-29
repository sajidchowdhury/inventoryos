"use client";

// ── SuperAdminHelp ──
// Phase 4: Off-canvas help panel that explains EVERY feature in the super admin
// dashboard. For each feature: what it is, what happens if not configured,
// why you need it, and how to use it.
//
// Opens via a "Help" button in the admin header. Uses a Sheet (slide-out drawer).

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert, Settings2, Mail, Activity, AlertTriangle,
  DollarSign, Users, Zap, Clock, CalendarClock, Play,
  TrendingUp, Building2, Sparkles, HelpCircle, Send,
  LayoutDashboard, Pill,
} from "lucide-react";

export interface HelpEntry {
  id: string;
  title: string;
  icon: any;
  category: "Monitoring" | "Configuration" | "Alerts" | "Operations";
  whatItIs: string;
  whatHappensIfNotSet: string;
  whyYouNeedIt: string;
  howToUse: string;
}

const HELP_ENTRIES: HelpEntry[] = [
  // ── Monitoring ──
  {
    id: "summary-cards",
    title: "Summary Cards",
    icon: Building2,
    category: "Monitoring",
    whatItIs: "The 4 cards at the top of the dashboard showing total businesses, active subscriptions, suspended accounts, and total AI cost today.",
    whatHappensIfNotSet: "These are read-only metrics — no configuration needed. They always show live data from the database.",
    whyYouNeedIt: "Gives you a 5-second health check of the platform. If 'Suspended' spikes, the hourly subscription cron may be over-suspending. If 'AI Cost Today' is unexpectedly high, investigate before the monthly invoice arrives.",
    howToUse: "Just glance at them. Click 'Refresh' in the header to pull fresh data. No action required.",
  },
  {
    id: "ai-cost-today",
    title: "AI Cost Today",
    icon: DollarSign,
    category: "Monitoring",
    whatItIs: "Card showing today's platform-wide AI spend in BDT, with a 7-day trend chart.",
    whatHappensIfNotSet: "Read-only metric. No configuration needed.",
    whyYouNeedIt: "This is your daily burn rate. If it suddenly jumps 3x with no new customers, something is wrong — likely a cache bug or an abuser. Compare to the 7-day trend to spot anomalies.",
    howToUse: "Check daily. If the number exceeds 1,000 BDT/day with fewer than 50 pharmacies, investigate the Top Spenders card to find who's burning tokens.",
  },
  {
    id: "top-spenders",
    title: "Top Spenders",
    icon: TrendingUp,
    category: "Monitoring",
    whatItIs: "List of the top 5 businesses by AI spend today and this month.",
    whatHappensIfNotSet: "Read-only. No configuration needed.",
    whyYouNeedIt: "Identifies which pharmacies are consuming the most AI resources. If one pharmacy is spending 10x the average, they're either a power user (good — consider upselling Enterprise) or an abuser (bad — consider suspending).",
    howToUse: "Click a business name to see their details. Use the 'Suspend AI' button if you suspect abuse.",
  },
  {
    id: "sql-router",
    title: "SQL Router Hit Rate",
    icon: Zap,
    category: "Monitoring",
    whatItIs: "Shows what percentage of AI chat queries were answered by the SQL Router (free, zero-token shortcuts) vs. the LLM.",
    whatHappensIfNotSet: "Read-only. The SQL Router is always active and intercepts 20 common question patterns automatically.",
    whyYouNeedIt: "Higher hit rate = lower cost. If the hit rate drops below 30%, users may be asking questions the router doesn't recognize — consider adding more patterns to src/lib/sql-router.ts.",
    howToUse: "Monitor weekly. A healthy rate is 40-60%. If it drops, check what questions users are asking and add patterns.",
  },
  {
    id: "feature-usage",
    title: "Feature Usage Breakdown",
    icon: Activity,
    category: "Monitoring",
    whatItIs: "Bar chart showing AI calls per feature (chat, insights, expiry-optimizer, product-assistant, forecast, reorder).",
    whatHappensIfNotSet: "Read-only. No configuration needed.",
    whyYouNeedIt: "Shows which AI features are actually being used. If 'insights' has 0 calls after a month, users may not know it exists — consider UI improvements or onboarding tips.",
    howToUse: "Check weekly. Compare to your cost model — if a feature costs more than expected relative to its usage, it may need optimization.",
  },
  {
    id: "usage-7days",
    title: "7-Day Usage Trend",
    icon: CalendarClock,
    category: "Monitoring",
    whatItIs: "Line chart showing daily AI cost and call count over the last 7 days.",
    whatHappensIfNotSet: "Read-only. No configuration needed.",
    whyYouNeedIt: "Spot trends and anomalies. A gradual upward trend = growth (good). A sudden spike = potential abuse or bug. A sudden drop = possible Z.ai outage.",
    howToUse: "Check weekly. Look for day-of-week patterns (e.g., pharmacies may use AI more on Mondays after weekend restocking).",
  },
  {
    id: "abuse-alerts",
    title: "Abuse Alerts",
    icon: AlertTriangle,
    category: "Monitoring",
    whatItIs: "Red card showing businesses that have triggered abuse thresholds (e.g., >80% of rate limits).",
    whatHappensIfNotSet: "Read-only. Abuse detection runs automatically based on AIUsageLog data.",
    whyYouNeedIt: "Early warning system for potential abuse. A business on this list isn't necessarily malicious — they may just be a heavy user. But if you see a free-tier trial account here, it's likely abuse.",
    howToUse: "Click 'Suspend AI' to immediately block a suspicious business. They can still use non-AI features. Investigate before permanently banning.",
  },

  // ── Configuration ──
  {
    id: "ai-config",
    title: "AI Configuration",
    icon: Settings2,
    category: "Configuration",
    whatItIs: "Editable settings for each AI feature: max output tokens, max input batches (expiry-optimizer), max input products (product-assistant).",
    whatHappensIfNotSet: "Falls back to hardcoded defaults: chat=1024 tokens, insights=2048, expiry-optimizer=2048+50 batches, product-assistant=512+20 meds. These are safe values that prevent cost leaks.",
    whyYouNeedIt: "Lets you tune AI cost vs. quality without redeploying. Lower max_tokens = cheaper but shorter responses. Higher maxInputBatches = more context but higher cost per call.",
    howToUse: "Click 'Save' per feature after editing. Changes take effect on the NEXT AI call (no restart needed). Click 'Reset all to defaults' to restore safe values. Range validation prevents invalid values.",
  },
  {
    id: "kill-switch-thresholds",
    title: "Kill-Switch Thresholds",
    icon: ShieldAlert,
    category: "Configuration",
    whatItIs: "4 configurable triggers that auto-disable AI when cost or error thresholds are crossed: per-pharmacy monthly cost, per-pharmacy 24h tokens, platform monthly cost, Z.ai error rate.",
    whatHappensIfNotSet: "Falls back to defaults: 200 BDT/pharmacy/month, 50K tokens/pharmacy/24h, 100K BDT/platform/month, 10% error rate/hour. These are conservative values from the AI Features Report.",
    whyYouNeedIt: "This is your financial safety net. Without it, a single bug or abuser could burn your entire Z.ai budget before you notice. The kill-switch auto-blocks AI and emails you when thresholds are crossed.",
    howToUse: "Set thresholds based on your scale. At 1-10 pharmacies, the defaults are fine. As you grow, raise platform_monthly to avoid false positives. Disable a trigger by unchecking 'Active' — use with caution. Always configure Notification Recipients (below) so you get emailed when a trigger fires.",
  },
  {
    id: "notification-recipients",
    title: "Notification Recipients",
    icon: Mail,
    category: "Configuration",
    whatItIs: "Up to 3 email addresses that receive kill-switch alerts. When a trigger fires, all active recipients are emailed simultaneously.",
    whatHappensIfNotSet: "If no recipients are configured, kill-switch alerts are logged to NotificationLog only — you won't get an email. You'd have to manually check /admin to discover the alert.",
    whyYouNeedIt: "Without email alerts, you could miss a kill-switch trigger for hours or days. With email, you're notified within 5 minutes and can investigate immediately. The first recipient should be the founder; add a CTO or on-call engineer as the 2nd/3rd.",
    howToUse: "Add up to 3 emails with optional labels (e.g., 'Founder', 'CTO'). Each email must be unique. To remove a recipient, click the trash icon. Note: SMTP must be configured via environment variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) for emails to actually send — otherwise they're logged to NotificationLog as a fallback.",
  },

  // ── Operations ──
  {
    id: "background-jobs",
    title: "Background Jobs (Cron)",
    icon: Play,
    category: "Operations",
    whatItIs: "3 scheduled background jobs: nightly-stats (01:00 UTC — snapshots KPIs), hourly-subscriptions (auto-suspends expired), daily-maintenance (01:30 UTC — prunes old logs).",
    whatHappensIfNotSet: "The cron endpoints exist but require an EXTERNAL scheduler (Vercel Cron, systemd timer, or cron-job.org) to actually trigger them. Without a scheduler, the jobs never run and the database grows unbounded.",
    whyYouNeedIt: "Without nightly-stats, the 7-day trend chart is empty. Without hourly-subscriptions, expired trials keep using AI indefinitely. Without daily-maintenance, the database grows by ~1MB/month from stale logs. All 3 are essential for platform health.",
    howToUse: "Click 'Run Now' to trigger any job manually (useful for testing). In production, configure an external cron to hit POST /api/cron/{jobName} with the x-cron-secret header. Schedule: nightly-stats at 01:00 UTC, hourly-subscriptions at :00 every hour, daily-maintenance at 01:30 UTC.",
  },
  {
    id: "business-list",
    title: "Business List",
    icon: Users,
    category: "Operations",
    whatItIs: "Searchable list of all pharmacies on the platform with their tier, status, AI usage, and quick actions (toggle AI, edit).",
    whatHappensIfNotSet: "Read-only list. No configuration needed.",
    whyYouNeedIt: "Your primary tool for managing customers. Use it to upgrade tiers, suspend accounts, toggle AI access, and investigate usage patterns.",
    howToUse: "Search by name or email. Click 'Edit' to change tier/status/AI limits. Click the AI toggle to enable/disable AI for a specific business (overrides tier). Use 'Suspend AI' from the Abuse Alerts card for quick action.",
  },
  {
    id: "edit-business",
    title: "Edit Business Dialog",
    icon: Building2,
    category: "Operations",
    whatItIs: "Dialog for editing a business's subscription tier, status, AI flag, AI rate limits, and subscription dates.",
    whatHappensIfNotSet: "Defaults: tier=free, status=trial, aiEnabled=false, aiDailyLimit=50, aiMonthlyLimit=1000, aiTokenBudget=500000.",
    whyYouNeedIt: "Use this to upgrade customers to Pro+AI after they pay, extend trial periods, or manually adjust rate limits for Enterprise customers who need higher quotas.",
    howToUse: "Click 'Edit' on any business in the Business List. Changes save immediately. Be careful with aiTokenBudget — setting it to 0 means 'use platform default' (500K), NOT 'disable AI'. To disable AI, uncheck the aiEnabled flag.",
  },

  // ── Phase 5: Operations Health ──
  {
    id: "ops-health",
    title: "Phase 5: Operations Health Dashboard",
    icon: Activity,
    category: "Monitoring",
    whatItIs: "A consolidated dashboard showing weekly + monthly + quarterly AI cost metrics. Includes health status banner, this week vs last week comparison, top spenders, monthly actual-vs-estimated cost per feature, tier mix, and quarterly reminders.",
    whatHappensIfNotSet: "Read-only dashboard. No configuration needed — it pulls live data from AIUsageLog, KillSwitch, and Business tables. Always available at /admin.",
    whyYouNeedIt: "This IS Phase 5 of the AI cost-control roadmap. It surfaces the exact metrics you need to check every Monday (weekly review), on the 1st of each month (monthly comparison), and quarterly (Z.ai pricing re-evaluation). Without it, you'd have to manually query the database to know if AI cost is healthy.",
    howToUse: "Check the health status banner first — if it says 'Action Needed', read the issues list and address them. Review the weekly metrics every Monday. On the 1st of each month, check the Monthly Comparison table for any feature with 'Investigate' status (>2x cost estimate). Quarterly reminders appear in the first week of each quarter.",
  },
  {
    id: "weekly-ai-health-email",
    title: "Weekly AI Health Email (Cron Job)",
    icon: Send,
    category: "Operations",
    whatItIs: "Automated email sent every Monday at 06:00 UTC to all configured notification recipients. Includes this week's cost, top 3 spenders, error rate, active kill-switches, and a health status (Healthy / Watch / Action Needed).",
    whatHappensIfNotSet: "If no external scheduler triggers POST /api/cron/weekly-ai-health, the email never sends. You'd have to manually check /admin every Monday. If no recipients are configured, the job runs but skips the email (logs a warning).",
    whyYouNeedIt: "This is the 'set it and forget it' layer of Phase 5. Instead of remembering to log into /admin every Monday, you get a summary in your inbox. If everything is healthy, you can skip the dashboard visit. If the email says 'Action Needed', you know to investigate immediately.",
    howToUse: "1) Configure SMTP env vars (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS). 2) Add at least 1 notification recipient in the Notification Recipients card. 3) Set up an external scheduler (Vercel Cron, systemd, cron-job.org) to hit POST /api/cron/weekly-ai-health every Monday at 06:00 UTC with the x-cron-secret header. 4) To test immediately, use the Background Jobs card 'Run Now' button or hit the endpoint with your super-admin Bearer token.",
  },

  // ── Phase 6: Multi-Project Architecture ──
  {
    id: "global-dashboard-v2",
    title: "Global Dashboard (Multi-Project)",
    icon: LayoutDashboard,
    category: "Monitoring",
    whatItIs: "The landing page after login. Shows cross-project metrics (total businesses, AI cost, platform health), API health banner, setup progress checklist, and a project selector grid with all 7 business types.",
    whatHappensIfNotSet: "Read-only dashboard. No configuration needed. Always shows live data from all projects combined.",
    whyYouNeedIt: "Gives you a 10-second overview of the entire platform. If any API component is down (SMTP, Z.ai, database, cron), the health banner shows it immediately. The setup progress widget guides new deployments through 9 configuration steps in order.",
    howToUse: "Check the API Health Banner first — any red card means infrastructure needs attention. Check Setup Progress — incomplete steps link to /admin/api-setup. Click a project card to drill into a project-specific dashboard.",
  },
  {
    id: "project-dashboards",
    title: "Project-Specific Dashboards",
    icon: Building2,
    category: "Operations",
    whatItIs: "Each business type (Pharmacy, CC Camera, etc.) has its own dashboard at /admin/{type}. Shows only data for that business type: schedules, reports, contacts, and metrics filtered by businessTypeId.",
    whatHappensIfNotSet: "If you navigate to a project dashboard that isn't active (e.g., CC Camera), you'll see a 'Coming Soon' placeholder with planned features.",
    whyYouNeedIt: "When InventoryOS launches its second business type, the admin needs to see pharmacy data and CCTV data separately — not mixed in one list. Project dashboards provide this separation without losing the global cross-project view.",
    howToUse: "Click a project card on the Global Dashboard, or use the sidebar navigation. Each project dashboard has the same structure (schedules, reports, contacts) but filtered to that project. Use the sidebar to switch between projects.",
  },
  {
    id: "schedule-project-scope",
    title: "Schedule Project Scope",
    icon: Pill,
    category: "Configuration",
    whatItIs: "When creating a report schedule, you can choose 'All Projects' (cross-project, targets all business types) or a specific project like 'Pharmacy Only'. This filters which businesses receive reports from that schedule.",
    whatHappensIfNotSet: "Defaults to 'All Projects' (null). The schedule will target all active Pro+AI businesses regardless of type. This is backward-compatible with existing schedules.",
    whyYouNeedIt: "A pharmacy report (with Eid occasion predictions, expiry optimizer data) is meaningless to a CC camera business. Project scope ensures the right reports go to the right businesses.",
    howToUse: "In the Schedule Builder form, section 4.5 'Project Scope' has two buttons: 'All Projects' and 'Pharmacy Only'. Select the appropriate one before saving. When more business types are activated, additional project buttons will appear.",
  },
  {
    id: "owner-contacts",
    title: "Owner Contacts (Email & WhatsApp)",
    icon: Users,
    category: "Configuration",
    whatItIs: "Manage each business owner's email address and WhatsApp number. Used for report delivery, subscription notices, and onboarding emails. Email has no fallback; WhatsApp falls back to business.phone.",
    whatHappensIfNotSet: "If ownerEmail is not set, report delivery via email is skipped with a 'No email address on file' error. The report is still generated and viewable in /admin, but not delivered. If ownerWhatsapp is not set, WhatsApp delivery falls back to the business phone number.",
    whyYouNeedIt: "Without correct owner contacts, the weekly report (the client retention hook) never reaches the client. This is the single most important configuration for the report scheduling feature to deliver value.",
    howToUse: "On the Global Dashboard or Pharmacy Dashboard, find the 'Owner Contacts' card. Click the edit (pencil) icon next to a business. Enter the email and/or WhatsApp number. Email must contain @ and a domain. WhatsApp must start with + and be 10-15 digits. Click Save.",
  },
  {
    id: "api-setup-page-v2",
    title: "API Setup Page (6 Tabs)",
    icon: Settings2,
    category: "Configuration",
    whatItIs: "A dedicated page at /admin/api-setup with 6 tabs: SMTP, AI, Database, Cron, Alerts, Kill-Switch. Consolidates all cross-project infrastructure configuration in one place.",
    whatHappensIfNotSet: "If any tab is not configured, the corresponding feature will not work: no SMTP = no email delivery, no cron secret = no background jobs, no recipients = no alerts. The Global Dashboard's Setup Progress widget shows which tabs need attention.",
    whyYouNeedIt: "Before setting up any project-specific configuration, the admin must configure cross-project infrastructure first. The API Setup page enforces this order with the 9-step setup checklist on the Global Dashboard.",
    howToUse: "Navigate to /admin/api-setup via the sidebar. Click through the 6 tabs. Each tab has a help icon explaining what it configures. The SMTP tab has a 'Send Test Email' button to verify email delivery works.",
  },
  {
    id: "cron-optimization",
    title: "Cron Optimization (Merged Worker)",
    icon: Clock,
    category: "Operations",
    whatItIs: "Phase 4 merged the report-generator-worker and report-delivery-worker into a single report-worker that runs every 2 minutes. The schedule checker was changed from every 15 minutes to every 1 hour. Total daily cron triggers reduced by 58%.",
    whatHappensIfNotSet: "If the external scheduler is not configured, no background jobs run. Reports won't be generated or delivered. The Cron tab in API Setup shows which jobs have been triggered recently.",
    whyYouNeedIt: "Fewer cron triggers = less load on the BDIX server. The merged worker also simplifies the external scheduler configuration (one endpoint instead of two). The old separate endpoints are kept for backward compatibility.",
    howToUse: "Configure your external scheduler (cron-job.org, Vercel Cron, systemd) to hit: POST /api/cron/report-worker every 2 minutes, POST /api/cron/report-schedule-checker every 1 hour, POST /api/cron/hourly-subscriptions every 1 hour, POST /api/cron/nightly-stats at 01:00 UTC, POST /api/cron/daily-maintenance at 01:30 UTC, POST /api/cron/weekly-ai-health on Mondays at 06:00 UTC. All require the x-cron-secret header.",
  },
  {
    id: "multi-project-filtering",
    title: "Multi-Project Filtering",
    icon: Sparkles,
    category: "Configuration",
    whatItIs: "All super-admin API endpoints support a businessTypeId query parameter for filtering by project. Schedules, generated reports, and businesses can all be filtered to a specific business type (pharmacy, cctv, etc.).",
    whatHappensIfNotSet: "Without the filter, all data from all business types is returned mixed together. This is fine when only pharmacy is active, but becomes unmanageable when multiple business types are live.",
    whyYouNeedIt: "When InventoryOS launches its second business type, the admin needs to see pharmacy schedules separately from CCTV schedules. The businessTypeId filter provides this separation without duplicating endpoints or UI components.",
    howToUse: "The filter is applied automatically when you navigate to a project dashboard (e.g., /admin/pharmacy adds businessTypeId=pharmacy to all API calls). For manual API access, add ?businessTypeId=pharmacy to any super-admin endpoint URL.",
  },
];

const CATEGORIES = ["Monitoring", "Configuration", "Operations", "Alerts"] as const;

export function SuperAdminHelp({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2 text-2xl">
            <HelpCircle className="h-6 w-6 text-purple-600" />
            Super Admin Help
          </SheetTitle>
          <SheetDescription>
            Everything in the super admin dashboard explained: what each feature is,
            what happens if you don't configure it, and why you need it.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-8 pb-8">
          {CATEGORIES.map((category) => {
            const entries = HELP_ENTRIES.filter((e) => e.category === category);
            if (entries.length === 0) return null;
            return (
              <div key={category}>
                <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  {category}
                </h3>
                <div className="space-y-4">
                  {entries.map((entry) => {
                    const Icon = entry.icon;
                    return (
                      <div
                        key={entry.id}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center shrink-0">
                            <Icon className="h-5 w-5 text-purple-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-base">{entry.title}</h4>
                            <Badge variant="outline" className="mt-1 text-xs">{entry.category}</Badge>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm pl-13">
                          <div>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">What it is: </span>
                            <span className="text-slate-600 dark:text-slate-400">{entry.whatItIs}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-amber-700 dark:text-amber-400">If not configured: </span>
                            <span className="text-slate-600 dark:text-slate-400">{entry.whatHappensIfNotSet}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">Why you need it: </span>
                            <span className="text-slate-600 dark:text-slate-400">{entry.whyYouNeedIt}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-blue-700 dark:text-blue-400">How to use: </span>
                            <span className="text-slate-600 dark:text-slate-400">{entry.howToUse}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
