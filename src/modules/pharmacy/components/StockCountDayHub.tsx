"use client";

// Stock Counting Day — step-by-step full stock count while the shop stays open.
// Products can live in multiple zones; each zone is counted separately and totals roll up.

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ClipboardList, MapPin, Play, CheckCircle2, Loader2,
  Plus, ChevronRight, AlertCircle, ScanLine, Layers, Package,
  CircleDot, Lock, Sparkles, History, Scale, Search,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { usePermissions } from "@/lib/use-permissions";
import { ZoneBulkAssign } from "./scd/ZoneBulkAssign";
import { ScdOnboardingCard } from "./scd/ScdOnboardingCard";
import { VarianceReasonDialog, VarianceReasonBadge } from "./scd/VarianceReasonDialog";
import { ZoneAddProductDialog } from "./scd/ZoneAddProductDialog";
import { ScdExportButtons } from "./scd/ScdExportButtons";
import { cn } from "@/lib/utils";

// ── Types ──

interface StorageZone {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  _count?: { assignments: number };
}

interface ZoneSession {
  id: string;
  status: string;
  sortOrder: number;
  zone: { id: string; name: string; color: string };
  lineCount?: number;
  countedLineCount?: number;  // P1: lines with status === "counted" (for resume banner)
  lastCountedAt?: string | null;  // P1: most recent countedAt (for "last activity" display)
  _count?: { lines: number };
}

interface ScdSummary {
  id: string;
  name: string;
  status: string;
  startedAt?: string | null;
  closedAt?: string | null;
  appliedAt?: string | null;
  createdAt: string;
  zoneSessions?: ZoneSession[];
  stats?: {
    totalProducts: number;
    countedProducts: number;
    varianceCount: number;
    zonesClosed: number;
    zonesTotal: number;
  };
}

interface ZoneLine {
  id: string;
  productId: string;
  countedQty: number | null;
  status: string;
  product: {
    id: string;
    name: string;
    genericName?: string | null;
    unit: string;
    rackNo?: string | null;
  };
  otherZones: { id: string; name: string; color: string }[];
  countedInOtherZones: {
    zoneId: string;
    zoneName: string;
    zoneColor: string;
    countedQty: number | null;
  }[];
  expectedTotalQty: number;
  isMultiZone: boolean;
}

type Screen = "hub" | "setup-zones" | "start-scd" | "zone-count" | "variance-review" | "history-detail";

interface VarianceSummary {
  id: string;
  productId: string;
  systemQtyAtStart: number;
  soldDuringScd: number;
  totalCountedQty: number | null;
  variance: number | null;
  // P2: variance reason capture
  varianceReason?: string | null;  // theft | damage | data_error | expired | other
  varianceNote?: string | null;
  product: { id: string; name: string; genericName?: string | null; unit: string };
}

const ZONE_COLORS = ["#0d9488", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444", "#10b981"];

const fadeIn = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25 },
};

function StepPill({ n, label, done, active }: { n: number; label: string; done?: boolean; active?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium border",
      active && "bg-teal-50 border-teal-300 text-teal-800",
      done && !active && "bg-emerald-50 border-emerald-200 text-emerald-700",
      !active && !done && "bg-gray-50 border-gray-200 text-gray-500"
    )}>
      <span className={cn(
        "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
        active && "bg-teal-600 text-white",
        done && !active && "bg-emerald-500 text-white",
        !active && !done && "bg-gray-200 text-gray-600"
      )}>
        {done ? "✓" : n}
      </span>
      {label}
    </div>
  );
}

export function StockCountDayHub() {
  const businessId = useAuthStore((s) => s.session?.business.id);
  const userId = useAuthStore((s) => s.session?.user.id);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const setScdZoneSessionId = useNavStore((s) => s.setScdZoneSessionId);
  const setScdId = useNavStore((s) => s.setScdId);
  const { hasPermission, hasAnyPermission } = usePermissions(businessId);
  const canManage = hasPermission("scd.manage");
  const canCount = hasAnyPermission(["scd.count", "scd.manage"]);

  const [screen, setScreen] = useState<Screen>("hub");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [zones, setZones] = useState<StorageZone[]>([]);
  const [activeScd, setActiveScd] = useState<ScdSummary | null>(null);
  const [history, setHistory] = useState<ScdSummary[]>([]);
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [newZoneName, setNewZoneName] = useState("");

  const [activeZoneSession, setActiveZoneSession] = useState<ZoneSession | null>(null);
  const [zoneLines, setZoneLines] = useState<ZoneLine[]>([]);
  const [zoneProgress, setZoneProgress] = useState({ counted: 0, total: 0 });
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});
  const [varianceSummaries, setVarianceSummaries] = useState<VarianceSummary[]>([]);
  const [varianceStats, setVarianceStats] = useState({ mismatch: 0, uncounted: 0, matched: 0 });

  // P2: variance review search + filter state
  const [varianceSearch, setVarianceSearch] = useState("");
  const [varianceFilter, setVarianceFilter] = useState<"mismatch" | "uncounted" | "matched">("mismatch");
  // P2: variance reason dialog state
  const [reasonDialog, setReasonDialog] = useState<{ open: boolean; productId: string; productName: string }>({
    open: false, productId: "", productName: "",
  });
  // P3: add-product-from-directory dialog state
  const [addProductDialog, setAddProductDialog] = useState<{ open: boolean; zoneName: string }>({
    open: false, zoneName: "",
  });
  // P3: inheritance info returned by createAndStartScd
  const [inheritanceInfo, setInheritanceInfo] = useState<{ name: string; appliedAt: string; snapshotCount: number } | null>(null);
  // P4: history detail — when viewing a past SCD's variances
  const [historyDetailScdId, setHistoryDetailScdId] = useState<string | null>(null);

  const loadHub = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const [zonesRes, scdRes] = await Promise.all([
        fetch(`/api/businesses/${businessId}/storage-zones`),
        fetch(`/api/businesses/${businessId}/stock-count-day`),
      ]);
      const zonesData = await zonesRes.json();
      const scdData = await scdRes.json();
      if (!zonesRes.ok) throw new Error(zonesData.error || "Failed to load zones");
      if (!scdRes.ok) throw new Error(scdData.error || "Failed to load count day");

      setZones(zonesData.zones ?? []);
      setActiveScd(scdData.active ?? null);
      setHistory(scdData.history ?? []);
      setSelectedZoneIds((zonesData.zones ?? []).map((z: StorageZone) => z.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { loadHub(); }, [loadHub]);

  const loadZoneSession = async (scdId: string, zoneSession: ZoneSession) => {
    if (!businessId) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/businesses/${businessId}/stock-count-day/${scdId}/zones/${zoneSession.id}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load zone");

      setActiveZoneSession(zoneSession);
      setZoneLines(data.session?.lines ?? []);
      setZoneProgress(data.session?.progress ?? { counted: 0, total: 0 });
      const drafts: Record<string, string> = {};
      for (const line of data.session?.lines ?? []) {
        if (line.countedQty !== null) drafts[line.productId] = String(line.countedQty);
      }
      setQtyDrafts(drafts);
      setScreen("zone-count");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load zone");
    } finally {
      setActionLoading(false);
    }
  };

  const addZone = async () => {
    if (!businessId || !newZoneName.trim()) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/storage-zones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newZoneName.trim(),
          color: ZONE_COLORS[zones.length % ZONE_COLORS.length],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add zone");
      setNewZoneName("");
      await loadHub();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add zone");
    } finally {
      setActionLoading(false);
    }
  };

  const createAndStartScd = async () => {
    if (!businessId || selectedZoneIds.length === 0) return;
    setActionLoading(true);
    setError(null);
    try {
      const createRes = await fetch(`/api/businesses/${businessId}/stock-count-day`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zoneIds: selectedZoneIds, startedBy: userId }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || "Failed to create");

      // P3: capture inheritance info for the UI banner
      if (createData.inheritedFrom) {
        setInheritanceInfo({
          name: createData.inheritedFrom.name,
          appliedAt: createData.inheritedFrom.appliedAt,
          snapshotCount: createData.snapshotCount ?? 0,
        });
      } else {
        setInheritanceInfo(null);
      }

      const startRes = await fetch(
        `/api/businesses/${businessId}/stock-count-day/${createData.scd.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start", userId }),
        }
      );
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error || "Failed to start");

      setActiveScd(startData.scd);
      setScreen("hub");
      await loadHub();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start count day");
    } finally {
      setActionLoading(false);
    }
  };

  const scdAction = async (action: "close" | "apply") => {
    if (!businessId || !activeScd) return;
    if (action === "apply" && !canManage) return;
    if (action === "apply" && !confirm("Apply counted stock to inventory? This updates your stock levels.")) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/businesses/${businessId}/stock-count-day/${activeScd.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, userId }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action}`);
      setActiveScd(data.scd);
      await loadHub();
      if (action === "apply") setScreen("hub");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const loadVarianceReview = async (scdId: string) => {
    if (!businessId) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/businesses/${businessId}/stock-count-day?scdId=${scdId}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load review");
      const summaries = (data.scd?.summaries ?? []) as VarianceSummary[];
      setVarianceSummaries(summaries);
      const mismatch = summaries.filter(
        (s) => s.variance !== null && Math.abs(s.variance) > 0.001
      ).length;
      const uncounted = summaries.filter((s) => s.totalCountedQty === null).length;
      const matched = summaries.filter(
        (s) => s.totalCountedQty !== null && (s.variance === null || Math.abs(s.variance) <= 0.001)
      ).length;
      setVarianceStats({ mismatch, uncounted, matched });
      setScreen("variance-review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load review");
    } finally {
      setActionLoading(false);
    }
  };

  // P4: Load a past SCD's detail for the history-detail screen (read-only variance review)
  const loadHistoryDetail = async (scdId: string) => {
    if (!businessId) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/businesses/${businessId}/stock-count-day?scdId=${scdId}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load history");
      const summaries = (data.scd?.summaries ?? []) as VarianceSummary[];
      setVarianceSummaries(summaries);
      const mismatch = summaries.filter(
        (s) => s.variance !== null && Math.abs(s.variance) > 0.001
      ).length;
      const uncounted = summaries.filter((s) => s.totalCountedQty === null).length;
      const matched = summaries.filter(
        (s) => s.totalCountedQty !== null && (s.variance === null || Math.abs(s.variance) <= 0.001)
      ).length;
      setVarianceStats({ mismatch, uncounted, matched });
      setHistoryDetailScdId(scdId);
      setScreen("history-detail");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setActionLoading(false);
    }
  };

  // P2: save variance reason via PATCH /stock-count-day/[scdId] action=setReason
  const saveVarianceReason = async (reason: string | null, note: string | null) => {
    if (!businessId || !activeScd || !reasonDialog.productId) return;
    const res = await fetch(
      `/api/businesses/${businessId}/stock-count-day/${activeScd.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setReason",
          productId: reasonDialog.productId,
          reason,
          note,
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to save reason");
    // Update local state so the badge appears immediately
    setVarianceSummaries((prev) =>
      prev.map((s) =>
        s.productId === reasonDialog.productId
          ? { ...s, varianceReason: reason, varianceNote: note }
          : s
      )
    );
  };

  const startZone = async (zoneSession: ZoneSession) => {
    if (!businessId || !activeScd) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/businesses/${businessId}/stock-count-day/${activeScd.id}/zones/${zoneSession.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start" }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start zone");
      setScdId(activeScd.id);
      setScdZoneSessionId(zoneSession.id);
      setActiveZoneSession(zoneSession);
      setZoneLines(data.session?.lines ?? []);
      setZoneProgress(data.session?.progress ?? { counted: 0, total: 0 });
      setScreen("zone-count");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start zone");
    } finally {
      setActionLoading(false);
    }
  };

  const saveLineQty = async (productId: string) => {
    if (!businessId || !activeScd || !activeZoneSession) return;
    const qty = parseFloat(qtyDrafts[productId] ?? "");
    if (isNaN(qty) || qty < 0) {
      setError("Enter a valid quantity (0 or more)");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/businesses/${businessId}/stock-count-day/${activeScd.id}/zones/${activeZoneSession.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "count", productId, countedQty: qty, userId }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save count");
      setZoneLines(data.session?.lines ?? []);
      setZoneProgress(data.session?.progress ?? { counted: 0, total: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setActionLoading(false);
    }
  };

  // P3: Add a product to the current zone count session from the directory
  const addProductToZone = async (productId: string) => {
    if (!businessId || !activeScd || !activeZoneSession) return;
    const res = await fetch(
      `/api/businesses/${businessId}/stock-count-day/${activeScd.id}/zones/${activeZoneSession.id}/add-line`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, userId }),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to add product");
    setZoneLines(data.session?.lines ?? []);
    setZoneProgress(data.session?.progress ?? { counted: 0, total: 0 });
  };

  // P3: Create a minimal new product and return its ID (for the add-product dialog shortcut)
  const createNewProduct = async (data: { name: string; genericName?: string; unit?: string }): Promise<string> => {
    if (!businessId) throw new Error("No business");
    const res = await fetch(`/api/businesses/${businessId}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        genericName: data.genericName || null,
        unit: data.unit || "piece",
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to create product");
    return json.product?.id ?? json.id;
  };

  const closeZone = async () => {
    if (!businessId || !activeScd || !activeZoneSession) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/businesses/${businessId}/stock-count-day/${activeScd.id}/zones/${activeZoneSession.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "close", userId }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to close zone");
      setScdZoneSessionId(null);
      setScreen("hub");
      await loadHub();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to close zone");
    } finally {
      setActionLoading(false);
    }
  };

  const openShelfScanner = () => {
    if (activeScd && activeZoneSession) {
      setScdId(activeScd.id);
      setScdZoneSessionId(activeZoneSession.id);
    }
    setActiveView("shelf-scanner");
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "pending": return "Not started";
      case "counting": return "Counting…";
      case "review": return "Ready to close";
      case "closed": return "Done";
      default: return status;
    }
  };

  // P1: format "last activity" timestamp as relative time (e.g. "3m ago", "2h ago")
  const formatLastActivity = (isoTs: string): string => {
    const then = new Date(isoTs).getTime();
    const now = Date.now();
    const diffMin = Math.floor((now - then) / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  // ── Zone counting screen ──
  if (screen === "zone-count" && activeZoneSession && activeScd) {
    const zoneName = activeZoneSession.zone.name;
    return (
      <motion.div {...fadeIn} className="space-y-4 pb-24 pharmacy-bg">
        <div className="flex items-center gap-2 pt-1">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setScreen("hub")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">Counting: {zoneName}</h1>
            <p className="text-xs text-gray-500">Step 2 — count stock in this area only</p>
          </div>
        </div>

        {/* Instruction banner */}
        <Card className="border-teal-200 bg-teal-50/80 shadow-none">
          <CardContent className="p-3.5 space-y-2">
            <p className="text-sm font-semibold text-teal-900 flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Count only what is physically in <span className="underline">{zoneName}</span>
            </p>
            <p className="text-xs text-teal-800 leading-relaxed">
              If a medicine is stored in <strong>two areas</strong>, enter the quantity for <em>this</em> area here.
              The app adds both zones together at the end.
            </p>
            <div className="flex gap-2 pt-1 flex-wrap">
              <Button size="sm" className="gap-1.5 bg-teal-600 hover:bg-teal-700" onClick={openShelfScanner}>
                <ScanLine className="h-4 w-4" /> Photo scan this shelf
              </Button>
              {/* P3: Add product manually from directory */}
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-teal-300 text-teal-700 hover:bg-teal-50"
                onClick={() => setAddProductDialog({ open: true, zoneName })}
              >
                <Plus className="h-4 w-4" /> Add product manually
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-gray-500">
            {zoneProgress.counted} of {zoneProgress.total} products counted
          </p>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            disabled={actionLoading}
            onClick={closeZone}
          >
            <Lock className="h-3.5 w-3.5" /> Close this zone
          </Button>
        </div>

        <div className="space-y-2">
          {zoneLines.length === 0 && (
            <Card className="shadow-pharmacy">
              <CardContent className="p-6 text-center text-sm text-gray-500">
                <Package className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                No products assigned to this zone yet.
                <br />
                Use the shelf scanner or assign products to zones from product settings.
              </CardContent>
            </Card>
          )}
          {zoneLines.map((line) => (
            <Card key={line.id} className={cn(
              "shadow-pharmacy border-l-4",
              line.status === "counted" ? "border-l-emerald-500" : "border-l-gray-200"
            )}>
              <CardContent className="p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight">{line.product.name}</p>
                    {line.product.genericName && (
                      <p className="text-xs text-gray-400">{line.product.genericName}</p>
                    )}
                  </div>
                  {line.status === "counted" && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-0 shrink-0">Counted</Badge>
                  )}
                </div>

                {/* Multi-zone indicators */}
                {line.isMultiZone && (
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px] gap-1 border-violet-200 text-violet-700 bg-violet-50">
                      <Layers className="h-3 w-3" /> In {line.otherZones.length + 1} zones
                    </Badge>
                    {line.otherZones.map((z) => (
                      <Badge key={z.id} variant="outline" className="text-[10px]" style={{ borderColor: z.color, color: z.color }}>
                        Also in: {z.name}
                      </Badge>
                    ))}
                  </div>
                )}

                {line.countedInOtherZones.length > 0 && (
                  <p className="text-[11px] text-gray-500">
                    Already counted elsewhere:{" "}
                    {line.countedInOtherZones.map((z, i) => (
                      <span key={z.zoneId}>
                        {i > 0 ? ", " : ""}
                        <span className="font-medium" style={{ color: z.zoneColor }}>
                          {z.zoneName}: {z.countedQty}
                        </span>
                      </span>
                    ))}
                  </p>
                )}

                <p className="text-[11px] text-gray-400">
                  Shop total expected now: <span className="font-medium text-gray-600">{line.expectedTotalQty}</span> {line.product.unit}
                  <span className="ml-1">(system − sales during count)</span>
                </p>

                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-[11px] text-gray-500">Qty in {zoneName}</Label>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      className="h-9 mt-0.5"
                      placeholder="0"
                      value={qtyDrafts[line.productId] ?? ""}
                      onChange={(e) =>
                        setQtyDrafts((d) => ({ ...d, [line.productId]: e.target.value }))
                      }
                    />
                  </div>
                  <Button
                    size="sm"
                    className="h-9"
                    disabled={actionLoading}
                    onClick={() => saveLineQty(line.productId)}
                  >
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* P3: Add product from directory dialog */}
        <ZoneAddProductDialog
          open={addProductDialog.open}
          onOpenChange={(open) => setAddProductDialog((prev) => ({ ...prev, open }))}
          businessId={businessId || ""}
          zoneName={addProductDialog.zoneName || zoneName}
          existingProductIds={new Set(zoneLines.map((l) => l.productId))}
          onAddProduct={addProductToZone}
          onCreateNewProduct={createNewProduct}
        />
      </motion.div>
    );
  }

  // ── Variance review before apply (P2: enhanced with search + filter + reason capture) ──
  if (screen === "variance-review" && activeScd) {
    const mismatches = varianceSummaries.filter(
      (s) => s.variance !== null && Math.abs(s.variance) > 0.001
    );
    const uncounted = varianceSummaries.filter((s) => s.totalCountedQty === null);
    const matched = varianceSummaries.filter(
      (s) => s.totalCountedQty !== null && (s.variance === null || Math.abs(s.variance) <= 0.001)
    );

    // P2: compute the filtered list based on active filter + search
    const filterConfig = {
      mismatch: { list: mismatches, label: "Variances", icon: Scale, color: "text-amber-700" },
      uncounted: { list: uncounted, label: "Not counted", icon: Package, color: "text-slate-500" },
      matched: { list: matched, label: "Matched", icon: CheckCircle2, color: "text-emerald-700" },
    };
    const activeList = filterConfig[varianceFilter].list;
    const searchLower = varianceSearch.trim().toLowerCase();
    const filteredList = searchLower
      ? activeList.filter((s) =>
          s.product.name.toLowerCase().includes(searchLower) ||
          (s.product.genericName?.toLowerCase().includes(searchLower) ?? false)
        )
      : activeList;

    return (
      <motion.div {...fadeIn} className="space-y-4 pb-24 pharmacy-bg">
        <div className="flex items-center gap-2 pt-1">
          <Button variant="ghost" size="icon" onClick={() => setScreen("hub")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold">Review before apply</h1>
            <p className="text-xs text-gray-500">Check mismatches, then update inventory</p>
          </div>
          {/* P4: Export buttons */}
          {businessId && activeScd && (
            <ScdExportButtons businessId={businessId} scdId={activeScd.id} compact />
          )}
        </div>

        {/* P2: Tappable stat cards — clicking a card switches the filter */}
        <div className="grid grid-cols-3 gap-2">
          <Card
            className={cn(
              "shadow-pharmacy cursor-pointer transition-all active:scale-95",
              varianceFilter === "mismatch" ? "ring-2 ring-amber-400 bg-amber-50" : "border-amber-200 bg-amber-50/50"
            )}
            onClick={() => setVarianceFilter("mismatch")}
          >
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-amber-700">{mismatches.length}</p>
              <p className="text-[10px] text-amber-800">Mismatch</p>
            </CardContent>
          </Card>
          <Card
            className={cn(
              "shadow-pharmacy cursor-pointer transition-all active:scale-95",
              varianceFilter === "uncounted" ? "ring-2 ring-slate-400 bg-slate-100" : "border-slate-200 bg-slate-50/50"
            )}
            onClick={() => setVarianceFilter("uncounted")}
          >
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-slate-600">{uncounted.length}</p>
              <p className="text-[10px] text-slate-700">Not counted</p>
            </CardContent>
          </Card>
          <Card
            className={cn(
              "shadow-pharmacy cursor-pointer transition-all active:scale-95",
              varianceFilter === "matched" ? "ring-2 ring-emerald-400 bg-emerald-100" : "border-emerald-200 bg-emerald-50/50"
            )}
            onClick={() => setVarianceFilter("matched")}
          >
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-emerald-700">{matched.length}</p>
              <p className="text-[10px] text-emerald-800">Matched</p>
            </CardContent>
          </Card>
        </div>

        {/* P2: Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={`Search ${filterConfig[varianceFilter].label.toLowerCase()} by product name...`}
            value={varianceSearch}
            onChange={(e) => setVarianceSearch(e.target.value)}
            className="pl-9 h-10"
          />
          {varianceSearch && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => setVarianceSearch("")}
            >
              ✕
            </button>
          )}
        </div>

        {/* P2: Filter chips (acts as alternative to tapping stat cards) */}
        <div className="flex gap-2 flex-wrap">
          {(["mismatch", "uncounted", "matched"] as const).map((f) => {
            const cfg = filterConfig[f];
            const count = cfg.list.length;
            return (
              <button
                key={f}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95",
                  varianceFilter === f
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                )}
                onClick={() => setVarianceFilter(f)}
              >
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>

        {/* P2: Filtered list — shows variances with Record reason button, or uncounted/matched list */}
        <div className="space-y-2">
          {(() => {
            const ActiveIcon = filterConfig[varianceFilter].icon;
            return (
              <h2 className={cn("text-xs font-bold uppercase tracking-wider px-1 flex items-center gap-1", filterConfig[varianceFilter].color)}>
                <ActiveIcon className="h-3.5 w-3.5" />
                {filterConfig[varianceFilter].label} ({filteredList.length}{searchLower ? ` of ${activeList.length}` : ""})
              </h2>
            );
          })()}

          {filteredList.length === 0 ? (
            <Card className="shadow-pharmacy">
              <CardContent className="p-6 text-center text-sm text-gray-500">
                <Package className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                {searchLower
                  ? `No products match "${varianceSearch}"`
                  : `No ${filterConfig[varianceFilter].label.toLowerCase()} found`}
              </CardContent>
            </Card>
          ) : varianceFilter === "mismatch" ? (
            // Variance rows: show expected/counted/diff + reason badge + Record reason button
            filteredList.map((s) => {
              const expected = s.systemQtyAtStart - s.soldDuringScd;
              return (
                <Card key={s.id} className="shadow-pharmacy border-l-4 border-l-amber-400">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold flex-1 min-w-0">{s.product.name}</p>
                      {s.varianceReason && (
                        <VarianceReasonBadge reason={s.varianceReason} />
                      )}
                    </div>
                    {s.product.genericName && (
                      <p className="text-[11px] text-gray-400 mt-0.5">{s.product.genericName}</p>
                    )}
                    <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
                      <div>
                        <p className="text-muted-foreground">Expected</p>
                        <p className="font-semibold">{expected} {s.product.unit}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Counted</p>
                        <p className="font-semibold">{s.totalCountedQty ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Diff</p>
                        <p className={cn(
                          "font-semibold",
                          (s.variance ?? 0) > 0 ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {s.variance !== null ? (s.variance > 0 ? "+" : "") + s.variance.toFixed(0) : "—"}
                        </p>
                      </div>
                    </div>
                    {s.varianceNote && (
                      <p className="text-[11px] text-gray-500 mt-2 italic bg-gray-50 rounded px-2 py-1">
                        “{s.varianceNote}”
                      </p>
                    )}
                    {/* P2: Record reason / Edit reason button */}
                    <Button
                      size="sm"
                      variant={s.varianceReason ? "outline" : "default"}
                      className={cn(
                        "w-full mt-2 gap-1.5 h-8 text-xs",
                        !s.varianceReason && "bg-amber-600 hover:bg-amber-700"
                      )}
                      onClick={() =>
                        setReasonDialog({
                          open: true,
                          productId: s.productId,
                          productName: s.product.name,
                        })
                      }
                    >
                      <Scale className="h-3 w-3" />
                      {s.varianceReason ? "Edit reason" : "Record reason"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          ) : varianceFilter === "uncounted" ? (
            // Uncounted list — same compact view as before
            <Card className="shadow-pharmacy">
              <CardContent className="p-3 max-h-60 overflow-y-auto space-y-1">
                {filteredList.map((s) => (
                  <p key={s.id} className="text-xs text-muted-foreground">{s.product.name}</p>
                ))}
              </CardContent>
            </Card>
          ) : (
            // Matched list — compact
            <Card className="shadow-pharmacy">
              <CardContent className="p-3 max-h-60 overflow-y-auto space-y-1">
                {filteredList.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700 truncate">{s.product.name}</span>
                    <span className="text-emerald-600 font-medium ml-2 shrink-0">✓ {s.totalCountedQty}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {canManage ? (
          <Button
            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 sticky bottom-4"
            disabled={actionLoading}
            onClick={() => scdAction("apply")}
          >
            <CheckCircle2 className="h-4 w-4" />
            Apply {varianceStats.matched + varianceStats.mismatch} counted products to inventory
          </Button>
        ) : (
          <p className="text-xs text-center text-muted-foreground py-2">
            Ask a manager to apply counts to inventory.
          </p>
        )}

        {/* P2: Variance reason dialog — rendered here so it overlays the variance-review screen */}
        <VarianceReasonDialog
          open={reasonDialog.open}
          onOpenChange={(open) => setReasonDialog((prev) => ({ ...prev, open }))}
          productName={reasonDialog.productName}
          initialReason={varianceSummaries.find((s) => s.productId === reasonDialog.productId)?.varianceReason ?? null}
          initialNote={varianceSummaries.find((s) => s.productId === reasonDialog.productId)?.varianceNote ?? null}
          onSave={saveVarianceReason}
        />
      </motion.div>
    );
  }

  // ── P4: History detail screen (read-only variance review for past SCDs) ──
  if (screen === "history-detail" && historyDetailScdId && businessId) {
    const mismatches = varianceSummaries.filter(
      (s) => s.variance !== null && Math.abs(s.variance) > 0.001
    );
    const uncounted = varianceSummaries.filter((s) => s.totalCountedQty === null);
    const matched = varianceSummaries.filter(
      (s) => s.totalCountedQty !== null && (s.variance === null || Math.abs(s.variance) <= 0.001)
    );
    const pastScd = history.find((h) => h.id === historyDetailScdId);

    return (
      <motion.div {...fadeIn} className="space-y-4 pb-24 pharmacy-bg">
        <div className="flex items-center gap-2 pt-1">
          <Button variant="ghost" size="icon" onClick={() => { setScreen("hub"); setHistoryDetailScdId(null); }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{pastScd?.name || "Past count"}</h1>
            <p className="text-xs text-gray-500">
              {pastScd ? new Date(pastScd.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : ""}
              {" · "}
              <Badge variant="outline" className="text-[10px] capitalize">{pastScd?.status || ""}</Badge>
            </p>
          </div>
          {/* P4: Export buttons */}
          <ScdExportButtons businessId={businessId} scdId={historyDetailScdId} compact />
        </div>

        {/* Stat cards (read-only) */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="shadow-pharmacy border-emerald-200 bg-emerald-50/50">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-emerald-700">{matched.length}</p>
              <p className="text-[10px] text-emerald-800">Matched</p>
            </CardContent>
          </Card>
          <Card className="shadow-pharmacy border-amber-200 bg-amber-50/50">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-amber-700">{mismatches.length}</p>
              <p className="text-[10px] text-amber-800">Mismatch</p>
            </CardContent>
          </Card>
          <Card className="shadow-pharmacy border-slate-200 bg-slate-50/50">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-slate-600">{uncounted.length}</p>
              <p className="text-[10px] text-slate-700">Not counted</p>
            </CardContent>
          </Card>
        </div>

        {/* Variance list (read-only — shows reason badges but no Record reason button) */}
        {mismatches.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-700 px-1 flex items-center gap-1">
              <Scale className="h-3.5 w-3.5" /> Variances ({mismatches.length})
            </h2>
            {mismatches.map((s) => {
              const expected = s.systemQtyAtStart - s.soldDuringScd;
              return (
                <Card key={s.id} className="shadow-pharmacy border-l-4 border-l-amber-400">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold flex-1 min-w-0">{s.product.name}</p>
                      {s.varianceReason && (
                        <VarianceReasonBadge reason={s.varianceReason} />
                      )}
                    </div>
                    {s.product.genericName && (
                      <p className="text-[11px] text-gray-400 mt-0.5">{s.product.genericName}</p>
                    )}
                    <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
                      <div>
                        <p className="text-muted-foreground">Expected</p>
                        <p className="font-semibold">{expected} {s.product.unit}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Counted</p>
                        <p className="font-semibold">{s.totalCountedQty ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Diff</p>
                        <p className={cn(
                          "font-semibold",
                          (s.variance ?? 0) > 0 ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {s.variance !== null ? (s.variance > 0 ? "+" : "") + s.variance.toFixed(0) : "—"}
                        </p>
                      </div>
                    </div>
                    {s.varianceNote && (
                      <p className="text-[11px] text-gray-500 mt-2 italic bg-gray-50 rounded px-2 py-1">
                        &ldquo;{s.varianceNote}&rdquo;
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {uncounted.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
              Not counted ({uncounted.length})
            </h2>
            <Card className="shadow-pharmacy">
              <CardContent className="p-3 max-h-40 overflow-y-auto space-y-1">
                {uncounted.map((s) => (
                  <p key={s.id} className="text-xs text-muted-foreground">{s.product.name}</p>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </motion.div>
    );
  }

  // ── Setup zones screen ──
  if (screen === "setup-zones") {
    return (
      <motion.div {...fadeIn} className="space-y-4 pb-8 pharmacy-bg">
        <div className="flex items-center gap-2 pt-1">
          <Button variant="ghost" size="icon" onClick={() => setScreen("hub")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Storage zones</h1>
            <p className="text-xs text-gray-500">Step 1 — name the areas where you keep stock</p>
          </div>
        </div>

        <Card className="border-blue-200 bg-blue-50/60 shadow-none">
          <CardContent className="p-3.5 text-xs text-blue-900 leading-relaxed">
            Examples: <strong>Front counter</strong>, <strong>Back rack A</strong>, <strong>Fridge</strong>.
            A medicine can be in more than one zone — you will count each area separately.
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}

        <div className="space-y-2">
          {zones.map((z) => (
            <Card key={z.id} className="shadow-pharmacy">
              <CardContent className="p-3 flex items-center gap-3">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ background: z.color }} />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{z.name}</p>
                  <p className="text-xs text-gray-400">{z._count?.assignments ?? 0} products assigned</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="New zone name…"
            value={newZoneName}
            onChange={(e) => setNewZoneName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addZone()}
            disabled={!canManage}
          />
          <Button onClick={addZone} disabled={actionLoading || !newZoneName.trim() || !canManage} className="gap-1 shrink-0">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        {businessId && zones.length > 0 && (
          <ZoneBulkAssign
            businessId={businessId}
            zones={zones.map((z) => ({ id: z.id, name: z.name, color: z.color }))}
          />
        )}

        {!canManage && (
          <p className="text-xs text-center text-muted-foreground">
            Only managers can add zones or assign products.
          </p>
        )}

        <Button className="w-full" onClick={() => { loadHub(); setScreen("hub"); }}>
          Done
        </Button>
      </motion.div>
    );
  }

  // ── Start SCD — pick zones ──
  if (screen === "start-scd") {
    return (
      <motion.div {...fadeIn} className="space-y-4 pb-8 pharmacy-bg">
        <div className="flex items-center gap-2 pt-1">
          <Button variant="ghost" size="icon" onClick={() => setScreen("hub")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Start count day</h1>
            <p className="text-xs text-gray-500">Which areas will you count today?</p>
          </div>
        </div>

        {zones.length === 0 ? (
          <Card className="shadow-pharmacy">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-gray-600 mb-3">Add storage zones first.</p>
              <Button onClick={() => setScreen("setup-zones")}>Set up zones</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-2">
              {zones.map((z) => {
                const selected = selectedZoneIds.includes(z.id);
                return (
                  <Card
                    key={z.id}
                    className={cn(
                      "cursor-pointer shadow-pharmacy transition-colors",
                      selected && "ring-2 ring-teal-500 bg-teal-50/40"
                    )}
                    onClick={() =>
                      setSelectedZoneIds((ids) =>
                        selected ? ids.filter((id) => id !== z.id) : [...ids, z.id]
                      )
                    }
                  >
                    <CardContent className="p-3.5 flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ background: z.color }} />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{z.name}</p>
                      </div>
                      {selected ? (
                        <CheckCircle2 className="h-5 w-5 text-teal-600" />
                      ) : (
                        <CircleDot className="h-5 w-5 text-gray-300" />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Button
              className="w-full gap-2 bg-gradient-to-r from-teal-600 to-emerald-600"
              disabled={actionLoading || selectedZoneIds.length === 0 || !canManage}
              onClick={createAndStartScd}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Start counting ({selectedZoneIds.length} zones)
            </Button>
            <p className="text-[11px] text-center text-gray-400">
              Sales can continue — the system tracks what sells during the count.
            </p>
          </>
        )}
      </motion.div>
    );
  }

  // ── Main hub ──
  const scd = activeScd;
  const zonesClosed = scd?.zoneSessions?.filter((z) => z.status === "closed").length ?? 0;
  const zonesTotal = scd?.zoneSessions?.length ?? 0;

  return (
    <motion.div {...fadeIn} className="space-y-5 pb-8 pharmacy-bg">
      <div className="flex items-center gap-2 pt-1">
        <Button variant="ghost" size="icon" onClick={() => setActiveView("inventory-hub")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">Stock Count Day</h1>
          <p className="text-xs text-gray-400 mt-0.5">Full stock count while the shop stays open</p>
        </div>
      </div>

      {/* How it works */}
      <Card className="shadow-pharmacy overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-3 text-white">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> How it works
            </p>
          </div>
          <div className="p-3.5 flex flex-wrap gap-2">
            <StepPill n={1} label="Zones" done={zones.length > 0} active={zones.length === 0} />
            <StepPill n={2} label="Count each zone" done={zonesClosed === zonesTotal && zonesTotal > 0} active={!!scd && scd.status === "active"} />
            <StepPill n={3} label="Apply stock" done={scd?.status === "applied"} active={scd?.status === "closed"} />
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* ── P1: Resume count banner ── shown when a zone session is mid-count ── */}
      {scd && scd.status === "active" && scd.zoneSessions && (() => {
        const inProgress = scd.zoneSessions.find((zs) => zs.status === "counting");
        if (!inProgress) return null;
        const total = inProgress._count?.lines ?? inProgress.lineCount ?? 0;
        const counted = inProgress.countedLineCount ?? 0;
        return (
          <Card
            className="card-hover cursor-pointer border-teal-300 bg-gradient-to-r from-teal-50 to-emerald-50 shadow-pharmacy stagger-in"
            onClick={() => loadZoneSession(scd.id, inProgress)}
          >
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shrink-0 shadow-sm animate-pulse-soft">
                <Play className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-teal-900">Resume counting {inProgress.zone.name}</p>
                <p className="text-xs text-teal-700 mt-0.5">
                  {counted} of {total} products counted
                  {inProgress.lastCountedAt && (
                    <span className="text-teal-500 ml-1">
                      · last activity {formatLastActivity(inProgress.lastCountedAt)}
                    </span>
                  )}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-teal-400 shrink-0" />
            </CardContent>
          </Card>
        );
      })()}

      {/* P3: Inheritance banner — shown when this SCD inherited assignments from a previous one */}
      {scd && scd.status === "active" && inheritanceInfo && (
        <Card className="border-violet-200 bg-violet-50/80 shadow-none">
          <CardContent className="p-3.5 flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-violet-900">
                Inherited {inheritanceInfo.snapshotCount} zone assignment{inheritanceInfo.snapshotCount !== 1 ? "s" : ""} from your last count
              </p>
              <p className="text-xs text-violet-700 mt-0.5">
                From &ldquo;{inheritanceInfo.name}&rdquo; (applied {new Date(inheritanceInfo.appliedAt).toLocaleDateString()}). Zones are pre-populated — count what you see and the system keeps learning.
              </p>
            </div>
            <button
              className="text-violet-400 hover:text-violet-600 shrink-0"
              onClick={() => setInheritanceInfo(null)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </CardContent>
        </Card>
      )}

      {/* Active SCD banner */}
      {scd && scd.status === "active" && (
        <Card className="border-amber-200 bg-amber-50 shadow-none">
          <CardContent className="p-3.5">
            <p className="text-sm font-semibold text-amber-900">Count in progress</p>
            <p className="text-xs text-amber-800 mt-1">
              Sales are still running. Sold items are deducted automatically so counters do not need to ask the cashier.
            </p>
            <p className="text-xs font-medium text-amber-900 mt-2">
              Zones done: {zonesClosed} / {zonesTotal}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Zone list during active SCD */}
      {scd && (scd.status === "active" || scd.status === "closed") && scd.zoneSessions && (
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 px-1">Zones to count</h2>
          {scd.zoneSessions.map((zs) => (
            <Card
              key={zs.id}
              className="card-hover cursor-pointer shadow-pharmacy border-l-4"
              style={{ borderLeftColor: zs.zone.color }}
              onClick={() => {
                if (scd.status === "active" && zs.status !== "closed" && canCount) {
                  if (zs.status === "pending") startZone(zs);
                  else loadZoneSession(scd.id, zs);
                }
              }}
            >
              <CardContent className="p-3.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{zs.zone.name}</p>
                  <p className="text-xs text-gray-400">{statusLabel(zs.status)}</p>
                </div>
                {zs.status === "closed" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : scd.status === "active" ? (
                  <ChevronRight className="h-4 w-4 text-gray-300" />
                ) : null}
              </CardContent>
            </Card>
          ))}

          {scd.status === "active" && zonesClosed === zonesTotal && zonesTotal > 0 && canManage && (
            <Button
              className="w-full mt-2"
              disabled={actionLoading}
              onClick={() => scdAction("close")}
            >
              Finish count day
            </Button>
          )}

          {scd.status === "closed" && (
            <Button
              className="w-full mt-2 gap-2"
              variant={canManage ? "default" : "outline"}
              disabled={actionLoading}
              onClick={() => loadVarianceReview(scd.id)}
            >
              <Scale className="h-4 w-4" />
              {canManage ? "Review variances & apply" : "Review variances"}
            </Button>
          )}
        </div>
      )}

      {/* Actions when no active SCD — P1: show onboarding card for first-time users */}
      {(!scd || scd.status === "applied" || scd.status === "draft") && (
        zones.length === 0 && history.length === 0 ? (
          canManage ? (
            <ScdOnboardingCard onSetupZones={() => setScreen("setup-zones")} />
          ) : (
            <Card className="shadow-pharmacy border-blue-100 bg-blue-50/40">
              <CardContent className="p-4 text-center">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 text-blue-400" />
                <p className="text-sm font-semibold text-blue-900">Stock Count Day</p>
                <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                  Your manager hasn&rsquo;t set up stock counting yet. Ask them to set up storage zones from this screen.
                </p>
              </CardContent>
            </Card>
          )
        ) : (
          <div className="space-y-2">
            {canManage && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => setScreen("setup-zones")}
              >
                <MapPin className="h-5 w-5 text-teal-600" />
                <div className="text-left">
                  <p className="text-sm font-semibold">Manage storage zones</p>
                  <p className="text-xs text-gray-400">{zones.length} zone{zones.length !== 1 ? "s" : ""} set up</p>
                </div>
                <ChevronRight className="h-4 w-4 ml-auto text-gray-300" />
              </Button>
            )}

            {canManage && (!scd || scd.status !== "active") ? (
              <Button
                className="w-full justify-start gap-3 h-auto py-3 bg-gradient-to-r from-teal-600 to-emerald-600"
                onClick={() => setScreen("start-scd")}
                disabled={zones.length === 0}
              >
                <ClipboardList className="h-5 w-5" />
                <div className="text-left">
                  <p className="text-sm font-semibold">Start new count day</p>
                  <p className="text-xs text-teal-100">Count all zones, then apply once</p>
                </div>
                <ChevronRight className="h-4 w-4 ml-auto text-teal-200" />
              </Button>
            ) : null}

            {canCount && !canManage && zones.length > 0 && (
              <Card className="shadow-pharmacy border-blue-100 bg-blue-50/40">
                <CardContent className="p-3 text-xs text-blue-900">
                  You can count zones when a manager starts a Stock Count Day. Ask them to begin from this screen.
                </CardContent>
              </Card>
            )}
          </div>
        )
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 px-1 flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" /> Recent counts
          </h2>
          {history.slice(0, 5).map((h) => (
            <Card
              key={h.id}
              className="card-hover cursor-pointer shadow-pharmacy"
              onClick={() => loadHistoryDetail(h.id)}
            >
              <CardContent className="p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{h.name}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(h.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[10px] capitalize">{h.status}</Badge>
                  <ChevronRight className="h-4 w-4 text-gray-300" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
