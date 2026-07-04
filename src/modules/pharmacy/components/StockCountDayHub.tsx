"use client";

// Stock Counting Day — step-by-step full stock count while the shop stays open.
// Products can live in multiple zones; each zone is counted separately and totals roll up.

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ClipboardList, MapPin, Play, CheckCircle2, Loader2,
  Plus, ChevronRight, AlertCircle, ScanLine, Layers, Package,
  CircleDot, Lock, Sparkles, History,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
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

type Screen = "hub" | "setup-zones" | "start-scd" | "zone-count" | "review";

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
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
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="gap-1.5 bg-teal-600 hover:bg-teal-700" onClick={openShelfScanner}>
                <ScanLine className="h-4 w-4" /> Photo scan this shelf
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
          />
          <Button onClick={addZone} disabled={actionLoading || !newZoneName.trim()} className="gap-1 shrink-0">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

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
              disabled={actionLoading || selectedZoneIds.length === 0}
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
                if (scd.status === "active" && zs.status !== "closed") {
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

          {scd.status === "active" && zonesClosed === zonesTotal && zonesTotal > 0 && (
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
              className="w-full mt-2 gap-2 bg-emerald-600 hover:bg-emerald-700"
              disabled={actionLoading}
              onClick={() => scdAction("apply")}
            >
              <CheckCircle2 className="h-4 w-4" /> Apply counts to inventory
            </Button>
          )}
        </div>
      )}

      {/* Actions when no active SCD */}
      {(!scd || scd.status === "applied" || scd.status === "draft") && (
        <div className="space-y-2">
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

          {!scd || scd.status !== "active" ? (
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
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 px-1 flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" /> Recent counts
          </h2>
          {history.slice(0, 5).map((h) => (
            <Card key={h.id} className="shadow-pharmacy">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{h.name}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(h.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize">{h.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
