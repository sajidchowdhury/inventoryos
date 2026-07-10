"use client";

import { useState } from "react";
import {
  ShieldAlert, Loader2, Check, AlertTriangle,
} from "lucide-react";
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

interface QuarantineDialogProps {
  batch: Batch;
  productName: string;
  unit: string;
  onComplete: () => void;
  onCancel: () => void;
}

const reasons = [
  { value: "damaged", label: "Damaged", desc: "Physical damage to packaging" },
  { value: "suspected", label: "Suspected", desc: "Suspected quality issue" },
  { value: "recall", label: "Recall", desc: "Manufacturer recall" },
  { value: "quality_issue", label: "Quality Issue", desc: "Failed quality check" },
  { value: "other", label: "Other", desc: "Other reason" },
];

export function QuarantineDialog({ batch, productName, unit, onComplete, onCancel }: QuarantineDialogProps) {
  const session = useAuthStore((s) => s.session);
  const businessId = session?.business?.id;

  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!businessId || !reason) {
      setError("Please select a reason");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/businesses/${businessId}/batches/${batch.id}/quarantine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, notes: notes.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      setSuccess(true);
      setTimeout(() => onComplete(), 700);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to quarantine");
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="py-6 text-center space-y-2">
        <div className="h-12 w-12 rounded-full bg-orange-50 flex items-center justify-center mx-auto">
          <Check className="h-6 w-6 text-orange-600" />
        </div>
        <p className="text-sm font-medium">Batch quarantined</p>
        <p className="text-xs text-muted-foreground">Removed from FEFO rotation</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Warning banner */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
        <div className="text-xs text-orange-700">
          <p className="font-semibold">Quarantine this batch?</p>
          <p className="mt-0.5">
            <strong>{batch.quantity} {unit}</strong> of <strong>{productName}</strong> (Batch #{batch.batchNo}) will be isolated from FEFO dispensing.
          </p>
        </div>
      </div>

      {/* Reason selection */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Reason *</Label>
        <div className="space-y-1.5">
          {reasons.map((r) => (
            <button
              key={r.value}
              className={cn(
                "w-full text-left p-2.5 rounded-lg border transition-colors",
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

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Notes (optional)</Label>
        <Textarea
          placeholder="Add details about the quarantine reason..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[60px] text-sm"
        />
      </div>

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
          disabled={saving || !reason}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
          {saving ? "Quarantining..." : "Quarantine"}
        </Button>
      </div>
    </div>
  );
}
