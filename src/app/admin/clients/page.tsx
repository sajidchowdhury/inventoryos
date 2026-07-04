"use client";

// /admin/clients — P4: Super-Admin Client Monitoring Dashboard
// Shows all businesses with subscription stage badges + revenue summary cards.
// Filter by stage/tier + search by name/phone. Client detail + manual extend.

import { useState, useEffect, useCallback } from "react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Users, Search, TrendingUp, DollarSign, AlertTriangle,
  Loader2, ChevronRight, Calendar, Phone, RotateCcw, ArrowLeft,
} from "lucide-react";
import { useAdmin } from "../AdminContext";
import { cn } from "@/lib/utils";

const STAGE_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: "Active", bg: "bg-emerald-100", text: "text-emerald-700" },
  expiring_soon: { label: "Expiring", bg: "bg-amber-100", text: "text-amber-700" },
  read_only: { label: "Read-Only", bg: "bg-rose-100", text: "text-rose-700" },
  data_wiped: { label: "Data Wiped", bg: "bg-slate-200", text: "text-slate-600" },
};

const TIER_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  free: { label: "Free", bg: "bg-gray-100", text: "text-gray-600" },
  pro: { label: "Pro", bg: "bg-blue-100", text: "text-blue-700" },
  pro_ai: { label: "Pro AI", bg: "bg-purple-100", text: "text-purple-700" },
};

interface Client {
  id: string;
  name: string;
  shopCode: string | null;
  subscriptionTier: string;
  subscriptionStatus: string;
  subscriptionStage: string;
  subscriptionEnd: string | null;
  subscriptionStart: string | null;
  createdAt: string;
  user: { phone: string; name: string | null };
  businessType: { name: string; slug: string };
  tierLabel: string;
  monthlyAmount: number;
  lastPayment: { id: string; amount: number; method: string; matchedAt: string } | null;
  receivedThisMonth: number;
}

export default function ClientsPage() {
  const { token } = useAdmin();
  const [clients, setClients] = useState<Client[]>([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, expiringSoon: 0, readOnly: 0, dataWiped: 0 });
  const [revenue, setRevenue] = useState({ monthlyExpected: 0, monthlyReceived: 0, outstanding: 0, churnRisk: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientDetail, setClientDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [extendDays, setExtendDays] = useState("30");
  const [extending, setExtending] = useState(false);

  const fetchClients = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (stageFilter) params.set("stage", stageFilter);
      const res = await fetch(`/api/super-admin/clients?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setClients(data.clients);
        setSummary(data.summary);
      }
    } catch (err) {
      console.error("Fetch clients error:", err);
    } finally {
      setLoading(false);
    }
  }, [token, search, stageFilter]);

  const fetchRevenue = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/super-admin/revenue-summary", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setRevenue(data.summary);
      }
    } catch (err) {
      console.error("Fetch revenue error:", err);
    }
  }, [token]);

  useEffect(() => { fetchClients(); }, [fetchClients]);
  useEffect(() => { fetchRevenue(); }, [fetchRevenue]);

  const openClientDetail = async (client: Client) => {
    setSelectedClient(client);
    setClientDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/super-admin/clients/${client.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setClientDetail(data);
      }
    } catch (err) {
      console.error("Client detail error:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExtend = async () => {
    if (!token || !selectedClient) return;
    setExtending(true);
    try {
      const res = await fetch(`/api/super-admin/clients/${selectedClient.id}/extend`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ days: parseInt(extendDays), reason: "Manual extension from admin panel" }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh
        fetchClients();
        openClientDetail(selectedClient);
      }
    } catch (err) {
      console.error("Extend error:", err);
    } finally {
      setExtending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Revenue Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">Monthly Expected</span>
            </div>
            <p className="text-xl font-bold">৳{revenue.monthlyExpected.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">Received This Month</span>
            </div>
            <p className="text-xl font-bold text-blue-600">৳{revenue.monthlyReceived.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-amber-600" />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">Outstanding</span>
            </div>
            <p className="text-xl font-bold text-amber-600">৳{revenue.outstanding.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-lg bg-rose-50 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">Churn Risk</span>
            </div>
            <p className="text-xl font-bold text-rose-600">{revenue.churnRisk} <span className="text-xs font-normal text-muted-foreground">clients</span></p>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters ── */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <div className="flex gap-1.5">
          {["", "active", "expiring_soon", "read_only", "data_wiped"].map((s) => (
            <button
              key={s}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                stageFilter === s
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              )}
              onClick={() => setStageFilter(s)}
            >
              {s ? STAGE_STYLES[s]?.label : "All"}
              {s && s === "active" && ` (${summary.active})`}
              {s && s === "expiring_soon" && ` (${summary.expiringSoon})`}
              {s && s === "read_only" && ` (${summary.readOnly})`}
              {s && s === "data_wiped" && ` (${summary.dataWiped})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Client Table ── */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            No clients found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {clients.map((client) => {
            const stageStyle = STAGE_STYLES[client.subscriptionStage] || STAGE_STYLES.active;
            const tierStyle = TIER_STYLES[client.subscriptionTier] || TIER_STYLES.free;
            return (
              <Card
                key={client.id}
                className="card-hover cursor-pointer shadow-sm"
                onClick={() => openClientDetail(client)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">{client.name}</p>
                      <Badge className={cn("text-[9px] h-4 px-1.5 border-0", stageStyle.bg, stageStyle.text)}>
                        {stageStyle.label}
                      </Badge>
                      <Badge className={cn("text-[9px] h-4 px-1.5 border-0", tierStyle.bg, tierStyle.text)}>
                        {tierStyle.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5" /> {client.user.phone}
                      </span>
                      {client.subscriptionEnd && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5" /> {new Date(client.subscriptionEnd).toLocaleDateString("en-GB")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">৳{client.monthlyAmount}</p>
                    <p className="text-[10px] text-muted-foreground">/month</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Client Detail Dialog ── */}
      <Dialog open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          {selectedClient && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedClient.name}
                </DialogTitle>
                <DialogDescription>
                  {selectedClient.businessType.name} · {selectedClient.user.phone}
                </DialogDescription>
              </DialogHeader>

              {detailLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : clientDetail ? (
                <div className="space-y-4">
                  {/* Subscription info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase">Stage</p>
                      <Badge className={cn("text-[10px] mt-1 border-0", STAGE_STYLES[clientDetail.client.subscriptionStage]?.bg, STAGE_STYLES[clientDetail.client.subscriptionStage]?.text)}>
                        {STAGE_STYLES[clientDetail.client.subscriptionStage]?.label || clientDetail.client.subscriptionStage}
                      </Badge>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase">Tier</p>
                      <p className="text-sm font-semibold mt-1">{clientDetail.client.tierLabel} (৳{clientDetail.client.monthlyAmount}/mo)</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase">Subscription End</p>
                      <p className="text-sm font-semibold mt-1">
                        {clientDetail.client.subscriptionEnd
                          ? new Date(clientDetail.client.subscriptionEnd).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase">Total Received</p>
                      <p className="text-sm font-semibold mt-1 text-emerald-600">৳{clientDetail.revenue.totalReceived.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Manual extend */}
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                    <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                      <RotateCcw className="h-3.5 w-3.5" /> Manual Extension
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={extendDays}
                        onChange={(e) => setExtendDays(e.target.value)}
                        className="h-9"
                        placeholder="Days"
                      />
                      <Button
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700"
                        disabled={extending}
                        onClick={handleExtend}
                      >
                        {extending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Extend"}
                      </Button>
                    </div>
                  </div>

                  {/* Recent payments */}
                  {clientDetail.payments?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recent Payments</p>
                      {clientDetail.payments.slice(0, 5).map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between text-xs py-1.5 border-b border-dashed last:border-0">
                          <div>
                            <span className="font-medium">{p.method.toUpperCase()}</span>
                            <span className="text-muted-foreground ml-1.5">{p.trxId}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">৳{p.amount}</span>
                            <Badge className={cn(
                              "text-[8px] h-3.5 px-1 border-0",
                              p.status === "matched" && "bg-emerald-100 text-emerald-700",
                              p.status === "pending" && "bg-amber-100 text-amber-700",
                              p.status === "rejected" && "bg-rose-100 text-rose-700",
                              p.status === "refunded" && "bg-slate-200 text-slate-600",
                            )}>
                              {p.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
