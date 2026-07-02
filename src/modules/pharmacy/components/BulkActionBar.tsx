"use client";

import { useState } from "react";
import {
  Trash2, ShieldAlert, RotateCcw, X, Check, AlertTriangle,
  Loader2, Building2,
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
import { cn } from "@/lib/utils";

interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  onComplete: () => void;
}

type Action = "quarantine" | "dispose" | "return_to_supplier" | "release" | "delete";

const actions: { value: Action; label: string; icon: typeof Trash2; color: string }[] = [
  { value: "quarantine", label: "Quarantine", icon: ShieldAlert, color: "text-orange-600" },
  { value: "dispose", label: "Dispose", icon: Trash2, color: "text-red-600" },
  { value: "return_to_supplier", label: "Return to Supplier", icon: Building2, color: "text-blue-600" },
  { value: "release", label: "Release", icon: RotateCcw, color: "text-green-600" },
  { value: "delete", label: "Delete", icon: Trash2, color: "text-destructive" },
];

const reasonsByAction: Record<Action, string[]> = {
  quarantine: ["damaged", "suspected", "recall", "quality_issue", "other"],
  dispose: ["expired", "damaged", "recall", "quality_issue", "other"],
  return_to_supplier: ["expired", "damaged", "recall", "wrong_supply", "other"],
  release: [],
  delete: [],
};

const disposalMethods = ["landfill", "incineration", "return_to_supplier", "sewer", "other"];

export function BulkActionBar({ selectedCount, onClear, onComplete }: BulkActionBarProps) {
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState("");
  const [witness, setWitness] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [notes, setNotes] = useState("");
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: number; failures: number } | null>(null);

  const handleExecute = async () => {
    if (!action) {
      setError("Please select an action");
      return;
    }
    if ((action === "quarantine" || action === "dispose" || action === "return_to_supplier") && !reason) {
      setError("Please select a reason");
      return;
    }
    if (action === "return_to_supplier" && !supplierName.trim()) {
      setError("Supplier name is required for returns");
      return;
    }

    setExecuting(true);
    setError(null);

    // Get selected batch IDs from localStorage (set by parent component)
    const batchIds = JSON.parse(localStorage.getItem("expirySelectedBatches") || "[]");

    try {
      const payload: Record<string, unknown> = { batchIds, action };
      if (reason) payload.reason = reason;
      if (method) payload.disposalMethod = method;
      if (witness) payload.witness = witness;
      if (supplierName) payload.supplierName = supplierName;
      if (notes) payload.notes = notes;

      const businessId = localStorage.getItem("activeBusinessId");
      const res = await fetch(`/api/businesses/${businessId}/batches/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      setResult({ success: data.summary.success, failures: data.summary.failures });
      setTimeout(() => {
        onComplete();
      }, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to execute bulk action");
    } finally {
      setExecuting(false);
    }
  };

  const handleReset = () => {
    setAction(null);
    setReason("");
    setMethod("");
    setWitness("");
    setSupplierName("");
    setNotes("");
    setError(null);
    setResult(null);
  };

  if (result) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card shadow-lg">
        <div className="max-w-md mx-auto p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center",
              result.failures === 0 ? "bg-green-50" : "bg-orange-50"
            )}>
              <Check className={cn("h-5 w-5", result.failures === 0 ? "text-green-600" : "text-orange-600")} />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {result.success} succeeded{result.failures > 0 && `, ${result.failures} failed`}
              </p>
              <p className="text-xs text-muted-foreground">Bulk action complete</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card shadow-lg">
      <div className="max-w-md mx-auto p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {selectedCount} batch{selectedCount !== 1 ? "es" : ""} selected
          </span>
          <button onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground">
            Clear
          </button>
        </div>

        {/* Action Selection */}
        {!action && (
          <div className="grid grid-cols-5 gap-1">
            {actions.map((a) => (
              <button
                key={a.value}
                onClick={() => { setAction(a.value); setError(null); }}
                className="flex flex-col items-center gap-1 p-2 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <a.icon className={cn("h-4 w-4", a.color)} />
                <span className="text-[9px] font-medium text-center leading-tight">{a.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Action Details Form */}
        {action && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleReset} disabled={executing}>
                <X className="h-3.5 w-3.5" />
              </Button>
              <span className="text-sm font-medium">{actions.find(a => a.value === action)?.label}</span>
            </div>

            {reasonsByAction[action].length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Reason *</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {reasonsByAction[action].map((r) => (
                      <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {action === "dispose" && (
              <div className="space-y-1">
                <Label className="text-xs">Disposal Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {disposalMethods.map((m) => (
                      <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {action === "dispose" && (
              <div className="space-y-1">
                <Label className="text-xs">Witness (optional)</Label>
                <Input
                  value={witness}
                  onChange={(e) => setWitness(e.target.value)}
                  placeholder="Witness name"
                  className="h-9"
                />
              </div>
            )}

            {action === "return_to_supplier" && (
              <div className="space-y-1">
                <Label className="text-xs">Supplier Name *</Label>
                <Input
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g., Square Pharmaceuticals"
                  className="h-9"
                />
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional details..."
                className="min-h-[40px] text-sm"
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> {error}
          </p>
        )}

        {/* Execute Button */}
        {action && (
          <Button
            className="w-full h-10 gap-2"
            onClick={handleExecute}
            disabled={executing}
          >
            {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {executing ? "Executing..." : `Apply to ${selectedCount} batch${selectedCount !== 1 ? "es" : ""}`}
          </Button>
        )}
      </div>
    </div>
  );
}
