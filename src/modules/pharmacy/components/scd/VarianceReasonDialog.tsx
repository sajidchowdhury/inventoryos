"use client";

// VarianceReasonDialog — P2 feature
// Modal dialog for recording WHY a variance occurred (theft/damage/data_error/expired/other)
// + optional free-text note. Used in the variance review screen.

import { useState, useEffect } from "react";
import {
  ShieldAlert, Trash2, FileWarning, CalendarX,
  MoreHorizontal, Loader2, Check, X,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Must match VARIANCE_REASONS in src/lib/scd.ts
const REASONS = [
  { value: "theft",      label: "Theft / suspected theft",              icon: ShieldAlert,     color: "text-rose-600",    bg: "bg-rose-50",    ring: "ring-rose-200" },
  { value: "damage",     label: "Damage / spoilage",                    icon: Trash2,          color: "text-amber-600",   bg: "bg-amber-50",   ring: "ring-amber-200" },
  { value: "data_error", label: "Data entry error",                     icon: FileWarning,      color: "text-blue-600",    bg: "bg-blue-50",    ring: "ring-blue-200" },
  { value: "expired",    label: "Expired / disposed without record",    icon: CalendarX,       color: "text-purple-600",  bg: "bg-purple-50",  ring: "ring-purple-200" },
  { value: "other",      label: "Other",                                icon: MoreHorizontal,  color: "text-slate-600",   bg: "bg-slate-50",   ring: "ring-slate-200" },
] as const;

interface VarianceReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  /** Current reason (null if none set). Pass to pre-select when editing. */
  initialReason?: string | null;
  /** Current note (null if none set). Pass to pre-fill when editing. */
  initialNote?: string | null;
  /** Called with { reason, note } when user taps Save. reason is null if user cleared it. */
  onSave: (reason: string | null, note: string | null) => Promise<void>;
}

export function VarianceReasonDialog({
  open, onOpenChange, productName, initialReason, initialNote, onSave,
}: VarianceReasonDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(initialReason ?? null);
  const [note, setNote] = useState(initialNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens (handles re-opening for different products)
  useEffect(() => {
    if (open) {
      setSelectedReason(initialReason ?? null);
      setNote(initialNote ?? "");
      setError(null);
    }
  }, [open, initialReason, initialNote]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(
        selectedReason,
        note.trim() || null
      );
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save reason");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setSelectedReason(null);
    setNote("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            Record variance reason
          </DialogTitle>
          <DialogDescription className="truncate">
            {productName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {error && (
            <p className="text-sm text-destructive flex items-center gap-1.5">
              <X className="h-3.5 w-3.5" /> {error}
            </p>
          )}

          {/* Reason chips */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Why did this variance happen?</Label>
            <div className="grid grid-cols-1 gap-1.5">
              {REASONS.map((r) => {
                const isSelected = selectedReason === r.value;
                const Icon = r.icon;
                return (
                  <button
                    key={r.value}
                    type="button"
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all active:scale-[0.98]",
                      isSelected
                        ? cn("border-transparent ring-2", r.bg, r.ring)
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    )}
                    onClick={() => setSelectedReason(isSelected ? null : r.value)}
                  >
                    <div className={cn(
                      "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                      isSelected ? r.bg : "bg-gray-100"
                    )}>
                      <Icon className={cn("h-3.5 w-3.5", isSelected ? r.color : "text-gray-500")} />
                    </div>
                    <span className={cn(
                      "text-xs font-medium flex-1",
                      isSelected ? r.color : "text-gray-700"
                    )}>
                      {r.label}
                    </span>
                    {isSelected && (
                      <Check className={cn("h-4 w-4 shrink-0", r.color)} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional note */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Note <span className="text-gray-400 font-normal">(optional, max 500 chars)</span>
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              placeholder="e.g. Found 5 strips damaged behind the fridge during cleaning"
              className="text-xs resize-none"
              rows={3}
            />
            <p className="text-[10px] text-gray-400 text-right">{note.length}/500</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {(initialReason || initialNote) && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleClear}
                disabled={saving}
              >
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
            <Button
              size="sm"
              className="flex-1 gap-1.5 bg-amber-600 hover:bg-amber-700"
              onClick={handleSave}
              disabled={saving || !selectedReason}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {saving ? "Saving..." : "Save reason"}
            </Button>
          </div>

          {!selectedReason && (
            <p className="text-[10px] text-gray-400 text-center">
              Select a reason to save. You can change it later.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Reason badge (shown on variance rows that have a reason set) ──
export function VarianceReasonBadge({ reason }: { reason: string }) {
  const config = REASONS.find((r) => r.value === reason);
  if (!config) return null;
  const Icon = config.icon;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium",
      config.bg, config.color
    )}>
      <Icon className="h-2.5 w-2.5" />
      {config.label.split(" / ")[0].split(" ")[0]}
    </span>
  );
}
