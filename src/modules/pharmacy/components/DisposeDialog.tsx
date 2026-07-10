"use client";

import { useState } from "react";
import {
  Trash2, Loader2, Check, AlertTriangle, DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

interface Batch {
  id: string;
  batchNo: string;
  quantity: number;
  status: string;
  mrp?: number | null;
  purchasePrice?: number | null;
}

interface DisposeDialogProps {
  batch: Batch;
  productName: string;
  unit: string;
  onComplete: () => void;
  onCancel: () => void;
}

const reasons = [
  { value: "expired", label: "Expired", desc: "Past expiry date" },
  { value: "damaged", label: "Damaged", desc: "Physically damaged" },
  { value: "recall", label: "Recall", desc: "Manufacturer recall" },
  { value: "quality_issue", label: "Quality Issue", desc: "Failed quality check" },
  { value: "other", label: "Other", desc: "Other reason" },
];

const disposalMethods = [
  { value: "landfill", label: "Landfill" },
  { value: "incineration", label: "Incineration" },
  { value: "return_to_supplier", label: "Return to Supplier" },
  { value: "sewer", label: "Sewer (liquid only)" },
  { value: "other", label: "Other" },
];

export function DisposeDialog({ batch, productName, unit, onComplete, onCancel }: DisposeDialogProps) {
  const session = useAuthStore((s) => s.session);
  const businessId = session?.business?.id;

  const [quantity, setQuantity] = useState(batch.quantity.toString());
  const [reason, setReason] = useState<string>("");
  const [method, setMethod] = useState<string>("");
  const [witness, setWitness] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const disposeQty = parseFloat(quantity) || 0;
  const unitPrice = batch.mrp || batch.purchasePrice || 0;
  const valueLost = disposeQty * unitPrice;
  const isFullDisposal = disposeQty === batch.quantity;
  const valid = disposeQty > 0 && disposeQty <= batch.quantity && reason;

  const handleSubmit = async () => {
    if (!businessId || !valid) {
      if (disposeQty > batch.quantity) {
        setError(`Cannot dispose more than available (${batch.quantity} ${unit})`);
      }
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/businesses/${businessId}/batches/${batch.id}/dispose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: disposeQty,
          reason,
          disposalMethod: method || undefined,
          witness: witness.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      setSuccess(true);
      setTimeout(() => onComplete(), 800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to dispose");
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="py-6 text-center space-y-2">
        <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center mx-auto">
          <Check className="h-6 w-6 text-red-600" />
        </div>
        <p className="text-sm font-medium">Disposed {disposeQty} {unit}</p>
        <p className="text-xs text-muted-foreground">
          {isFullDisposal ? "Batch marked as destroyed" : `${batch.quantity - disposeQty} ${unit} remaining`}
        </p>
        <p className="text-xs font-semibold text-red-600">Value lost: ৳{valueLost.toFixed(2)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Warning banner */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
        <div className="text-xs text-red-700">
          <p className="font-semibold">Dispose stock from this batch?</p>
          <p className="mt-0.5">
            <strong>{productName}</strong> · Batch #{batch.batchNo} · {batch.quantity} {unit} available
          </p>
        </div>
      </div>

      {/* Quantity */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Quantity to dispose *</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            step="0.01"
            value={quantity}
            onChange={(e) => { setQuantity(e.target.value); setError(null); }}
            className="h-10"
          />
          <span className="text-xs text-muted-foreground self-center shrink-0">{unit}</span>
        </div>
        <div className="flex gap-1.5">
          <button
            className="px-2 py-1 text-[11px] bg-muted hover:bg-muted/70 rounded font-medium"
            onClick={() => setQuantity(batch.quantity.toString())}
          >
            All ({batch.quantity})
          </button>
          <button
            className="px-2 py-1 text-[11px] bg-muted hover:bg-muted/70 rounded font-medium"
            onClick={() => setQuantity((batch.quantity / 2).toString())}
          >
            Half
          </button>
        </div>
        {disposeQty > batch.quantity && (
          <p className="text-[11px] text-destructive flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Exceeds available ({batch.quantity} {unit})
          </p>
        )}
      </div>

      {/* Reason */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Reason *</Label>
        <div className="space-y-1.5">
          {reasons.map((r) => (
            <button
              key={r.value}
              className={cn(
                "w-full text-left p-2 rounded-lg border transition-colors",
                reason === r.value
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:bg-muted/50"
              )}
              onClick={() => { setReason(r.value); setError(null); }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{r.label}</p>
                  <p className="text-[10px] text-muted-foreground">{r.desc}</p>
                </div>
                {reason === r.value && <Check className="h-4 w-4 text-primary" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Disposal Method */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Disposal Method</Label>
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger className="h-10">
            <SelectValue placeholder="Select method (optional)" />
          </SelectTrigger>
          <SelectContent>
            {disposalMethods.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Witness */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Witness Name (optional)</Label>
        <Input
          placeholder="Regulatory requirement for some disposals"
          value={witness}
          onChange={(e) => setWitness(e.target.value)}
          className="h-10"
        />
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Notes (optional)</Label>
        <Textarea
          placeholder="Additional details..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[60px] text-sm"
        />
      </div>

      {/* Value lost preview */}
      {valid && valueLost > 0 && (
        <div className="bg-red-50 rounded-lg p-2.5 text-xs flex items-center justify-between">
          <span className="text-red-700 flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5" /> Value being lost
          </span>
          <span className="font-bold text-red-700">৳{valueLost.toFixed(2)}</span>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          className="flex-1 gap-1.5"
          onClick={handleSubmit}
          disabled={saving || !valid}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {saving ? "Disposing..." : `Dispose ${disposeQty} ${unit}`}
        </Button>
      </div>
    </div>
  );
}
