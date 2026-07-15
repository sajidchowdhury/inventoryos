"use client";

// /admin/pharmacy — Pharmacy business module (consolidated).
// One menu per business: Overview tab + Catalog tab.
// The Catalog tab embeds the same PharmacyCatalogContent component used by
// /admin/catalog, so the 14K+ product master catalog lives inside the
// Pharmacy business instead of being a separate sidebar entry.

import { useState } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pill, LayoutDashboard, Package, Calendar, FileText, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScheduleManagerCard } from "../ScheduleManagerCard";
import { GeneratedReportsViewer } from "../GeneratedReportsViewer";
import { ContactsCard } from "../ContactsCard";
import { useAdmin } from "../AdminContext";
import { PharmacyCatalogContent } from "../catalog/PharmacyCatalogContent";

type Tab = "overview" | "catalog";

export default function PharmacyDashboard() {
  const { token } = useAdmin();
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <>
      {/* Header card with status + tab switcher */}
      <Card className="border-emerald-200 dark:border-emerald-900">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <Pill className="h-5 w-5" />
                Pharmacy
                <Badge variant="outline" className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                </Badge>
              </CardTitle>
              <CardDescription>
                Pharmacy-specific dashboard, AI report schedules, and the 14K+ master product catalog.
              </CardDescription>
            </div>
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              <Button
                size="sm"
                variant={tab === "overview" ? "default" : "ghost"}
                onClick={() => setTab("overview")}
                className={cn("gap-1.5", tab === "overview" && "bg-emerald-600 hover:bg-emerald-700")}
              >
                <LayoutDashboard className="h-4 w-4" />
                Overview
              </Button>
              <Button
                size="sm"
                variant={tab === "catalog" ? "default" : "ghost"}
                onClick={() => setTab("catalog")}
                className={cn("gap-1.5", tab === "catalog" && "bg-emerald-600 hover:bg-emerald-700")}
              >
                <Package className="h-4 w-4" />
                Catalog
              </Button>
            </div>
          </div>
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

      {/* Tab content */}
      {tab === "overview" ? (
        <>
          <ScheduleManagerCard token={token!} />
          <ContactsCard token={token!} />
          <GeneratedReportsViewer token={token!} />
        </>
      ) : (
        <PharmacyCatalogContent />
      )}
    </>
  );
}
