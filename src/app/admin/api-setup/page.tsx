"use client";

// /admin/api-setup/page.tsx — API Setup page
// Phase 1: Consolidates cross-project infrastructure config in one place.
// Phase 2 will add tabs (SMTP, Z.ai, Database, Cron, Alerts, Kill-Switch).

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { AiConfigCard } from "../AiConfigCard";
import { KillSwitchCard } from "../KillSwitchCard";
import { NotificationRecipientsCard } from "../NotificationRecipientsCard";
import { useAdmin } from "../AdminContext";
import {
  Settings, Mail, Database, Clock, ShieldAlert, AlertCircle,
} from "lucide-react";

export default function ApiSetupPage() {
  const { token } = useAdmin();

  return (
    <>
      {/* Page intro */}
      <Card className="border-blue-200 dark:border-blue-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
            <Settings className="h-5 w-5" />
            Cross-Project Infrastructure
          </CardTitle>
          <CardDescription>
            Configure these FIRST before setting up any project. These settings affect ALL
            business types (Pharmacy, CC Camera, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <SetupStatusCard label="SMTP Email" icon={Mail} status="pending" note="Configure env vars" />
            <SetupStatusCard label="Database" icon={Database} status="ok" note="Connected" />
            <SetupStatusCard label="Cron Scheduler" icon={Clock} status="pending" note="Set CRON_SECRET" />
            <SetupStatusCard label="Kill-Switch" icon={ShieldAlert} status="ok" note="4 thresholds active" />
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Note: SMTP, Database, and Cron require environment variables. See the Help panel
            for setup instructions. Click the Help button in the header.
          </div>
        </CardContent>
      </Card>

      {/* AI Configuration */}
      <AiConfigCard token={token!} />

      {/* Kill-Switch + Notification Recipients */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <KillSwitchCard token={token!} />
        <NotificationRecipientsCard token={token!} />
      </div>
    </>
  );
}

function SetupStatusCard({ label, icon: Icon, status, note }: { label: string; icon: any; status: "ok" | "pending"; note: string }) {
  return (
    <div className={`rounded-lg border p-3 ${status === "ok" ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50/50" : "border-amber-200 dark:border-amber-900 bg-amber-50/50"}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${status === "ok" ? "text-emerald-600" : "text-amber-600"}`} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className={`text-xs ${status === "ok" ? "text-emerald-700" : "text-amber-700"}`}>
        {note}
      </div>
    </div>
  );
}
