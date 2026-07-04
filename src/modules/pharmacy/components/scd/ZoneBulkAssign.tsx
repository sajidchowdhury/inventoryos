"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Loader2, CheckCircle2, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ZoneOption {
  id: string;
  name: string;
  color: string;
}

interface ProductOption {
  id: string;
  name: string;
  genericName: string | null;
  unit: string;
}

interface ZoneBulkAssignProps {
  businessId: string;
  zones: ZoneOption[];
}

export function ZoneBulkAssign({ businessId, zones }: ZoneBulkAssignProps) {
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!zoneId && zones.length > 0) setZoneId(zones[0].id);
  }, [zones, zoneId]);

  const searchProducts = useCallback(async () => {
    if (!businessId || search.trim().length < 2) {
      setProducts([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/businesses/${businessId}/products?search=${encodeURIComponent(search.trim())}&limit=30`
      );
      const data = await res.json();
      if (data.success) {
        setProducts(
          (data.products as ProductOption[]).map((p) => ({
            id: p.id,
            name: p.name,
            genericName: p.genericName,
            unit: p.unit,
          }))
        );
      }
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [businessId, search]);

  useEffect(() => {
    const t = setTimeout(searchProducts, 300);
    return () => clearTimeout(t);
  }, [searchProducts]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const assign = async () => {
    if (!zoneId || selected.size === 0) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/businesses/${businessId}/storage-zones/${zoneId}/assign-products`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: [...selected] }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign");
      setMessage(`Added ${data.added} product(s) to zone`);
      setSelected(new Set());
      setSearch("");
      setProducts([]);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to assign");
    } finally {
      setSaving(false);
    }
  };

  if (zones.length === 0) return null;

  const activeZone = zones.find((z) => z.id === zoneId);

  return (
    <Card className="shadow-pharmacy border-teal-100">
      <CardContent className="p-4 space-y-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Assign products to a zone</p>
            <Badge className="text-[9px] h-4 px-1.5 bg-teal-100 text-teal-700 border-0">Optional</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Optional — most pharmacies skip this and let the system learn from counting. Use this only if you want to pre-assign before your first count.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Zone</Label>
          <Select value={zoneId} onValueChange={setZoneId}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Pick zone" />
            </SelectTrigger>
            <SelectContent>
              {zones.map((z) => (
                <SelectItem key={z.id} value={z.id}>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: z.color }} />
                    {z.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-10"
            placeholder="Search products to add…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
          </div>
        )}

        {!loading && products.length > 0 && (
          <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border p-1">
            {products.map((p) => {
              const isOn = selected.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                    isOn ? "bg-teal-50 ring-1 ring-teal-300" : "hover:bg-muted/50"
                  )}
                >
                  <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.name}</p>
                    {p.genericName && (
                      <p className="text-[10px] text-muted-foreground truncate">{p.genericName}</p>
                    )}
                  </div>
                  {isOn && <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        {selected.size > 0 && activeZone && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <Badge variant="outline" className="text-xs">
              {selected.size} selected → {activeZone.name}
            </Badge>
            <Button size="sm" disabled={saving} onClick={assign}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign"}
            </Button>
          </div>
        )}

        {message && (
          <p className="text-xs text-center text-muted-foreground">{message}</p>
        )}
      </CardContent>
    </Card>
  );
}
