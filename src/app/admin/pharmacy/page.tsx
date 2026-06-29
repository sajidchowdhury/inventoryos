"use client";

// /admin/pharmacy/page.tsx — Pharmacy Dashboard
// Phase 1: Pharmacy-specific metrics, schedules, and reports.

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { ScheduleManagerCard } from "../ScheduleManagerCard";
import { GeneratedReportsViewer } from "../GeneratedReportsViewer";
import { useAdmin } from "../AdminContext";
import { Pill, Calendar, FileText, TrendingUp } from "lucide-react";

export default function PharmacyDashboard() {
  const { token } = useAdmin();

  return (
    <>
      {/* Pharmacy header */}
      <Card className="border-emerald-200 dark:border-emerald-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <Pill className="h-5 w-5" />
            Pharmacy Management
          </CardTitle>
          <CardDescription>
            Create report schedules, view generated AI reports, and manage pharmacy-specific
            delivery configuration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar className="h-3.5 w-3.5 text-purple-600" />
                <span className="text-xs text-muted-foreground">Report Schedules</span>
              </div>
              <div className="text-lg font-bold">Manage</div>
              <div className="text-xs text-muted-foreground">Create & trigger schedules</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <FileText className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-xs text-muted-foreground">Generated Reports</span>
              </div>
              <div className="text-lg font-bold">View</div>
              <div className="text-xs text-muted-foreground">AI prediction reports</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-xs text-muted-foreground">Prediction Model</span>
              </div>
              <div className="text-lg font-bold">5-Step</div>
              <div className="text-xs text-muted-foreground">Occasion + Season + Epidemic</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Manager */}
      <ScheduleManagerCard token={token!} />

      {/* Generated Reports Viewer */}
      <GeneratedReportsViewer token={token!} />
    </>
  );
}
