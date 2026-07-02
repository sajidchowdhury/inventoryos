"use client";

import { useState, useEffect } from "react";
import {
  RotateCcw, AlertCircle, Check, Loader2, X, Package,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface PurchaseItem {
  id: string;
  productName: string;
  quantity: number;
  receivedQuantity: number;
  unit: string;
  unitCost: number;
  totalPrice: number;
  batchNo: string | null;
  batchId: string | null;
  batchCurrentQty: number;
  batchStatus: string;
}

interface PurchaseReturnDialogProps {
  purchaseId: string;
  purchaseNo: string;
  onComplete: () => void;
  onCancel: () => void;
}

const reasonLabels: Record<string, string> = {
  defective: "Defective",
  wrong_item: "Wrong Item",
  expired: "Expired",
  damaged: "Damaged",
  quality_issue: "Quality Issue",
  other: "Other",
};

export function PurchaseReturnDialog({ purchaseId, purchaseNo, onComplete, onCancel }: PurchaseReturnDialogProps) {
  const session = useAuthStore((s) => s.session);
  const businessId = session?.business?.id;

  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [returnQtys, setReturnQtys] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [restockToSupplier, setRestockToSupplier] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!businessId || !purchaseId) return;
    fetch(`/api/businesses/${businessId}/purchases/${purchaseId}/returns`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setItems(d.items || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [businessId, purchaseId]);

  const totalRefund = items.reduce((sum, item) => {
    const qty = parseFloat(returnQtys[item.id] || "0") || 0;
    return sum + qty * item.unitCost;
  }, 0);

  const handleReturn = async () => {
    if (!businessId) return;
    if (!reason) {
      setError("Please select a reason");
      return;
    }

    const selectedItems = items
      .map((item) => ({
        purchaseItemId: item.id,
        quantity: parseFloat(returnQtys[item.id] || "0") || 0,
      }))
      .filter((item) => item.quantity > 0);

    if (selectedItems.length === 0) {
      setError("Select at least one item to return with quantity > 0");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/businesses/${businessId}/purchases/${purchaseId}/returns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selectedItems,
          reason,
          notes,
          restockToSupplier,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      setSuccess(true);
      setTimeout(() => onComplete(), 1000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to process return");
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="py-6 text-center space-y-2">
        <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center mx-auto">
          <Check className="h-6 w-6 text-green-600" />
        </div>
        <p className="text-sm font-medium">Return processed!</p>
        <p className="text-xs text-muted-foreground">Stock returned to supplier</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-6 text-center">
        <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2">
      {error && (
        <p className="text-sm text-destructive flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </p>
      )}

      <div className="bg-orange-50 border border-orange-200 rounded-lg p-2.5 text-[11px] text-orange-700">
        Return items from <strong>{purchaseNo}</strong> to supplier. Stock will be removed from inventory.
      </div>

      {/* Items */}
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {items.map((item) => {
          const qty = parseFloat(returnQtys[item.id] || "0") || 0;
          const maxQty = Math.min(item.receivedQuantity, item.batchCurrentQty);
          return (
            <Card key={item.id}>
              <CardContent className="p-2.5 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.productName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Batch: {item.batchNo} · {item.batchCurrentQty} {item.unit} in stock
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Cost: ৳{item.unitCost}/{item.unit}
                      {qty > 0 && <span className="font-medium text-red-600"> · Refund: ৳{(qty * item.unitCost).toFixed(2)}</span>}
                    </p>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={returnQtys[item.id] || ""}
                    onChange={(e) => setReturnQtys({ ...returnQtys, [item.id]: e.target.value })}
                    className="h-8 w-16 text-xs"
                    max={maxQty}
                  />
                </div>
                {item.batchStatus === "returned" && (
                  <Badge variant="outline" className="text-[9px] text-purple-600">Already returned</Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Reason */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Reason *</Label>
        <Select value={reason} onValueChange={setReason}>
          <SelectTrigger className="h-10"><SelectValue placeholder="Select reason" /></SelectTrigger>
          <SelectContent>
            {Object.entries(reasonLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Restock toggle */}
      <div className="flex items-center justify-between py-1">
        <Label className="text-xs font-medium">Return stock to supplier</Label>
        <Switch checked={restockToSupplier} onCheckedChange={setRestockToSupplier} />
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[40px] text-sm"
          placeholder="Additional details"
        />
      </div>

      {/* Total Refund */}
      {totalRefund > 0 && (
        <div className="bg-red-50 rounded-lg p-2.5 flex items-center justify-between text-xs">
          <span className="text-red-700 font-medium">Total Refund</span>
          <span className="font-bold text-red-700">৳{totalRefund.toFixed(2)}</span>
        </div>
      )}

      <Button
        className="w-full h-10 gap-2"
        onClick={handleReturn}
        disabled={saving || !reason || totalRefund <= 0}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
        {saving ? "Processing..." : `Process Return (৳${totalRefund.toFixed(2)})`}
      </Button>
    </div>
  );
}
