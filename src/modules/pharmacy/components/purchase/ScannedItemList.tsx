"use client";

// ScannedItemList — P2 feature
// Reusable list of scanned invoice items with matched/unmatched badges.
// Used inside PurchaseScannerDialog to show accumulated results across multiple scans.

import {
  CheckCircle2, AlertCircle, Package, Link2, Boxes,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ScannedItem {
  // Match result
  productId: string | null;
  masterProductId: string | null;
  matchedMethod: "ai" | "master-catalog" | "unmatched";
  matchedName: string | null;
  // Detected fields
  detectedProductName: string;
  detectedGenericName: string | null;
  detectedQuantity: number | null;
  detectedUnit: string | null;
  detectedBatchNo: string | null;
  detectedExpiryDate: string | null;
  detectedMfgDate: string | null;
  detectedMrp: number | null;
  detectedUnitCost: number | null;
  confidence: number;
  confidenceLevel: "high" | "medium" | "low";
}

interface ScannedItemListProps {
  items: ScannedItem[];
  /** Show compact mode (no detected field details, just name + badge) */
  compact?: boolean;
}

export function ScannedItemList({ items, compact = false }: ScannedItemListProps) {
  if (items.length === 0) {
    return (
      <Card className="shadow-pharmacy border-dashed">
        <CardContent className="p-6 text-center text-sm text-gray-400">
          <Package className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          No items detected yet. Upload an invoice photo to start.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-1.5">
      {items.map((item, idx) => {
        const isMatched = item.matchedMethod === "ai";
        const isMasterCatalog = item.matchedMethod === "master-catalog";
        const isUnmatched = item.matchedMethod === "unmatched";

        return (
          <Card
            key={idx}
            className={cn(
              "shadow-pharmacy border-l-4",
              isMatched && "border-l-emerald-500",
              isMasterCatalog && "border-l-blue-500",
              isUnmatched && "border-l-amber-500"
            )}
          >
            <CardContent className={cn("p-2.5", compact ? "" : "space-y-1.5")}>
              {/* Row 1: product name + match badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {item.matchedName || item.detectedProductName}
                  </p>
                  {item.matchedName && item.matchedName !== item.detectedProductName && (
                    <p className="text-[10px] text-gray-400 truncate">
                      Detected: {item.detectedProductName}
                    </p>
                  )}
                  {item.detectedGenericName && (
                    <p className="text-[10px] text-gray-400 truncate">{item.detectedGenericName}</p>
                  )}
                </div>
                <MatchBadge method={item.matchedMethod} />
              </div>

              {/* Row 2: detected fields (non-compact only) */}
              {!compact && (
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  {item.detectedQuantity !== null && (
                    <FieldChip label="Qty" value={String(item.detectedQuantity)} />
                  )}
                  {item.detectedBatchNo && (
                    <FieldChip label="Batch" value={item.detectedBatchNo} mono />
                  )}
                  {item.detectedExpiryDate && (
                    <FieldChip label="Exp" value={formatDate(item.detectedExpiryDate)} />
                  )}
                  {item.detectedUnitCost !== null && (
                    <FieldChip label="Cost" value={`৳${item.detectedUnitCost}`} />
                  )}
                  {item.detectedMrp !== null && (
                    <FieldChip label="MRP" value={`৳${item.detectedMrp}`} />
                  )}
                </div>
              )}

              {/* Confidence indicator */}
              {!compact && item.confidenceLevel !== "high" && (
                <div className="flex items-center gap-1 text-[9px]">
                  <span className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    item.confidenceLevel === "medium" ? "bg-amber-400" : "bg-rose-400"
                  )} />
                  <span className={cn(
                    "font-medium",
                    item.confidenceLevel === "medium" ? "text-amber-600" : "text-rose-600"
                  )}>
                    {item.confidenceLevel === "medium" ? "Medium confidence — please verify" : "Low confidence — please verify"}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Match badge ──
function MatchBadge({ method }: { method: ScannedItem["matchedMethod"] }) {
  if (method === "ai") {
    return (
      <Badge className="text-[9px] h-4 px-1.5 bg-emerald-100 text-emerald-700 border-0 shrink-0 gap-0.5">
        <CheckCircle2 className="h-2.5 w-2.5" />
        Matched
      </Badge>
    );
  }
  if (method === "master-catalog") {
    return (
      <Badge className="text-[9px] h-4 px-1.5 bg-blue-100 text-blue-700 border-0 shrink-0 gap-0.5">
        <Boxes className="h-2.5 w-2.5" />
        Catalog
      </Badge>
    );
  }
  return (
    <Badge className="text-[9px] h-4 px-1.5 bg-amber-100 text-amber-700 border-0 shrink-0 gap-0.5">
      <Link2 className="h-2.5 w-2.5" />
      Link
    </Badge>
  );
}

// ── Field chip ──
function FieldChip({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
      <span className="text-gray-400">{label}:</span>
      <span className={cn("font-medium", mono && "font-mono")}>{value}</span>
    </span>
  );
}

// ── Date formatter (YYYY-MM-DD → DD Mon YYYY) ──
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}
