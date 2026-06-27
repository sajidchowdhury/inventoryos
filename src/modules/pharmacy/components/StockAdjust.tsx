"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

interface Batch {
  id: string;
  batchNo: string;
  quantity: number;
  status: string;
}

interface StockAdjustProps {
  batch: Batch;
  productName: string;
  unit: string;
  onComplete: () => void;
  onCancel: () => void;
}

const reasons = {
  STOCK_IN: ["New purchase received", "Returned by customer", "Stock correction (+)", "Other"],
  STOCK_OUT: ["Sold to customer", "Damaged/Expired disposal", "Returned to supplier", "Free sample given", "Other"],
};

export function StockAdjust({ batch, productName, unit, onComplete, onCancel }: StockAdjustProps) {
  const session = useAuthStore((s) => s.session);
  const businessId = session?.business?.id;

  const isStockIn = batch.status === "STOCK_IN";
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const qty = parseFloat(quantity) || 0;
  const valid = qty > 0 && (!isStockIn || true) && (isStockIn || qty <= batch.quantity);

  const handleSubmit = async () => {
    if (!businessId || !valid) {
      if (!valid && !isStockIn && qty > batch.quantity) {
        setError(`Cannot remove more than available stock (${batch.quantity} ${unit})`);
      }
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/businesses/${businessId}/batches/${batch.id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: batch.status,
          quantity: qty,
          note: reason ? `${reason}${note ? ` — ${note}` : ""}` : note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      setSuccess(true);
      setTimeout(() => onComplete(), 700);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to adjust stock");
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
        <p className="text-sm font-medium">Stock updated!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Current Stock */}
      <div className={cn(
        "rounded-lg p-3 flex items-center gap-3",
        isStockIn ? "bg-green-50" : "bg-orange-50"
      )}>
        {isStockIn ? (
          <TrendingUp className="h-5 w-5 text-green-600 shrink-0" />
        ) : (
          <TrendingDown className="h-5 w-5 text-orange-600 shrink-0" />
        )}
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Current stock in this batch</p>
          <p className="text-lg font-bold">{batch.quantity} {unit}</p>
        </div>
      </div>

      {/* Quantity Input */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          {isStockIn ? "Quantity to add" : "Quantity to remove"} *
        </Label>
        <Input
          type="number"
          step="0.01"
          placeholder="0"
          value={quantity}
          onChange={(e) => { setQuantity(e.target.value); setError(null); }}
          className="h-11"
          autoFocus
        />
        {!isStockIn && qty > batch.quantity && (
          <p className="text-[11px] text-destructive flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Exceeds available ({batch.quantity} {unit})
          </p>
        )}
        {/* Quick amount buttons */}
        <div className="flex gap-1.5 pt-1">
          {[10, 50, 100, batch.quantity].filter((v) => v > 0 && v !== batch.quantity).slice(0, 3).map((v) => (
            <button
              key={v}
              className="px-2 py-1 text-[11px] bg-muted hover:bg-muted/70 rounded font-medium"
              onClick={() => setQuantity(v.toString())}
            >
              {v}
            </button>
          ))}
          {!isStockIn && (
            <button
              className="px-2 py-1 text-[11px] bg-muted hover:bg-muted/70 rounded font-medium ml-auto"
              onClick={() => setQuantity(batch.quantity.toString())}
            >
              All ({batch.quantity})
            </button>
          )}
        </div>
      </div>

      {/* Reason */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Reason</Label>
        <div className="flex flex-wrap gap-1.5">
          {reasons[batch.status as keyof typeof reasons].map((r) => (
            <button
              key={r}
              className={cn(
                "px-2.5 py-1 text-[11px] rounded-full border transition-colors",
                reason === r
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground hover:bg-muted"
              )}
              onClick={() => setReason(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Note (optional)</Label>
        <Textarea
          placeholder="Add any additional details..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="min-h-[60px] text-sm"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </p>
      )}

      {/* Preview */}
      {qty > 0 && valid && (
        <div className="bg-muted/50 rounded-lg p-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">After adjustment:</span>
            <span className="font-semibold">
              {isStockIn ? batch.quantity + qty : batch.quantity - qty} {unit}
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          className={cn("flex-1 gap-1.5", !isStockIn && "bg-orange-600 hover:bg-orange-700")}
          onClick={handleSubmit}
          disabled={saving || !valid}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isStockIn ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          {saving ? "Saving..." : "Confirm"}
        </Button>
      </div>
    </div>
  );
}
