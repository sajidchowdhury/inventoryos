"use client";

// PurchaseScannerDialog — P2 feature
// Modal dialog for scanning supplier invoices to auto-fill purchase items.
//
// Three states:
//   1. Upload — file input + camera capture + instructions
//   2. Scanning — loading spinner + "Analyzing invoice..." text
//   3. Results — list of detected items + "Scan another page" + "Add N items to purchase"
//
// Accumulating: each scan's items are appended to scannedItems. Duplicate products
// (same productId after matching) merge quantities. User scans multiple pages to
// build the full purchase, then taps "Add to purchase" to flow items into the cart.

import { useState, useRef } from "react";
import {
  ScanLine, Loader2, Plus, Check, X, Camera, Upload, FileImage,
  AlertCircle, ChevronRight, Sparkles,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScannedItemList, type ScannedItem } from "./ScannedItemList";
import { cn } from "@/lib/utils";

// ── Image compression constants (mirrors ShelfScanner) ──
const RESIZE_MAX_DIMENSION = 2560;
const RESIZE_QUALITY = 0.88;

interface PurchaseScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  /** Called when user taps "Add N items to purchase" — receives the accumulated items */
  onAddToCart: (items: ScannedItem[]) => void;
}

type ScannerState = "upload" | "scanning" | "results";

export function PurchaseScannerDialog({
  open, onOpenChange, businessId, onAddToCart,
}: PurchaseScannerDialogProps) {
  const [state, setState] = useState<ScannerState>("upload");
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [isScanningNext, setIsScanningNext] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setState("upload");
      setScannedItems([]);
      setError(null);
      setScanCount(0);
      setIsScanningNext(false);
    }
    onOpenChange(open);
  };

  // ── Image compression (reuses ShelfScanner's canvas resize pattern) ──
  async function resizeImageToDataUrl(file: File): Promise<string> {
    const rawDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to load image"));
      image.src = rawDataUrl;
    });

    let { width, height } = img;
    if (width > height && width > RESIZE_MAX_DIMENSION) {
      height = Math.round((height * RESIZE_MAX_DIMENSION) / width);
      width = RESIZE_MAX_DIMENSION;
    } else if (height > RESIZE_MAX_DIMENSION) {
      width = Math.round((width * RESIZE_MAX_DIMENSION) / height);
      height = RESIZE_MAX_DIMENSION;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return rawDataUrl;
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", RESIZE_QUALITY);
  }

  // ── Handle file selection → compress → scan ──
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input so the same file can be selected again
    e.target.value = "";

    // If we already have results, this is a "scan another page" — use isScanningNext
    // so the results stay visible during the scan
    const isSubsequentScan = state === "results" || scannedItems.length > 0;
    if (isSubsequentScan) {
      setIsScanningNext(true);
    } else {
      setState("scanning");
    }
    setError(null);

    try {
      // Compress image client-side
      const compressedImage = await resizeImageToDataUrl(file);

      // Call the purchase-scan API
      const res = await fetch(`/api/businesses/${businessId}/ai/purchase-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: compressedImage }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.fallbackMessage || "Scan failed");
      }

      if (!data.success || !data.items || data.items.length === 0) {
        setError(
          data.scan?.diagnostic?.message ||
          "No items detected in this photo. Try a clearer photo or add items manually via search."
        );
        setState("results"); // Show results (with existing items) so user can scan again
        setIsScanningNext(false);
        return;
      }

      // ── Accumulate: merge new items into scannedItems ──
      const newItems = data.items as ScannedItem[];
      setScannedItems((prev) => mergeItems(prev, newItems));
      setScanCount((c) => c + 1);
      setState("results");
      setIsScanningNext(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed. Try again or add items manually.");
      setState("results"); // Show results so user can retry or use existing items
      setIsScanningNext(false);
    }
  };

  // ── Merge new items into existing list — dedupe by productId (if matched) ──
  function mergeItems(existing: ScannedItem[], incoming: ScannedItem[]): ScannedItem[] {
    const merged = [...existing];
    for (const item of incoming) {
      // If the item has a productId (matched to catalog), check if it's already in the list
      if (item.productId) {
        const existingIdx = merged.findIndex(
          (m) => m.productId === item.productId
        );
        if (existingIdx >= 0) {
          // Merge: sum quantities, keep the higher-confidence detection
          const existingItem = merged[existingIdx];
          const mergedQty = (existingItem.detectedQuantity ?? 0) + (item.detectedQuantity ?? 0);
          const better = item.confidence > existingItem.confidence ? item : existingItem;
          merged[existingIdx] = {
            ...better,
            detectedQuantity: mergedQty || better.detectedQuantity,
          };
          continue;
        }
      }
      // Unmatched items (no productId) — always append (can't dedupe by name reliably)
      merged.push(item);
    }
    return merged;
  }

  // ── "Add to purchase" — flow items into the cart ──
  const handleAddToCart = () => {
    onAddToCart(scannedItems);
    handleOpenChange(false);
  };

  // ── Trigger file input ──
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const matchedCount = scannedItems.filter((i) => i.matchedMethod === "ai").length;
  const unmatchedCount = scannedItems.filter((i) => i.matchedMethod === "unmatched").length;
  const masterCatalogCount = scannedItems.filter((i) => i.matchedMethod === "master-catalog").length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-emerald-600" />
            Scan purchase sheet
          </DialogTitle>
          <DialogDescription>
            Photograph the supplier invoice. Detected items accumulate — scan multiple pages for long invoices.
          </DialogDescription>
        </DialogHeader>

        {/* Hidden file input — triggered by buttons */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="space-y-3 pt-2">
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ── State: Upload ── */}
          {state === "upload" && (
            <div className="space-y-3">
              {/* Upload zone */}
              <button
                type="button"
                onClick={triggerFileInput}
                className="w-full border-2 border-dashed border-emerald-300 rounded-2xl p-6 hover:bg-emerald-50 transition-colors active:scale-[0.98]"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <Camera className="h-7 w-7 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">Take photo or upload</p>
                  <p className="text-xs text-gray-500 text-center">
                    Frame the entire invoice — all 4 corners visible
                  </p>
                </div>
              </button>

              {/* Tips */}
              <Card className="border-emerald-100 bg-emerald-50/40 shadow-none">
                <CardContent className="p-3 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Tips for best results
                  </p>
                  <ul className="text-[11px] text-emerald-800 space-y-0.5 leading-relaxed">
                    <li>• Frame the entire invoice — all 4 corners visible</li>
                    <li>• Ensure good lighting — avoid shadows on text</li>
                    <li>• Long invoice? Scan each page separately — items accumulate</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── State: Scanning ── */}
          {state === "scanning" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="relative">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 animate-pulse-soft">
                  <ScanLine className="h-8 w-8 text-white" />
                </div>
                <Loader2 className="absolute -bottom-1 -right-1 h-6 w-6 text-emerald-600 animate-spin bg-white rounded-full p-0.5" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-900">Analyzing invoice...</p>
                <p className="text-xs text-gray-500 mt-0.5">This takes 10–15 seconds</p>
              </div>
            </div>
          )}

          {/* ── State: Results ── */}
          {state === "results" && (
            <div className="space-y-3">
              {/* Summary + scan count */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">
                    {scannedItems.length} item{scannedItems.length !== 1 ? "s" : ""}
                    {scanCount > 1 && (
                      <span className="text-gray-400 font-normal"> from {scanCount} scans</span>
                    )}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {matchedCount} matched · {masterCatalogCount} in catalog · {unmatchedCount} to link
                  </p>
                </div>
              </div>

              {/* Item list */}
              <div className="max-h-64 overflow-y-auto">
                <ScannedItemList items={scannedItems} />
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-1">
                <Button
                  className="w-full gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                  onClick={triggerFileInput}
                  disabled={isScanningNext}
                >
                  {isScanningNext ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {isScanningNext ? "Scanning..." : "Scan another page"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  onClick={handleAddToCart}
                  disabled={scannedItems.length === 0 || isScanningNext}
                >
                  <Check className="h-4 w-4" />
                  Add {scannedItems.length} item{scannedItems.length !== 1 ? "s" : ""} to purchase
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Loading indicator for subsequent scans */}
              {isScanningNext && (
                <p className="text-xs text-center text-gray-400">Scanning next page...</p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
