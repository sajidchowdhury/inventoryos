"use client";

// ── InventoryOS: Shelf Scanner (Stage 6 — full wizard) ──
//
// 3-step AI vision stock counter:
//   Step 1 — Upload:  pick 2–3 shelf photos, optional note, "Analyze Shelf"
//   Step 2 — Review:  AI detections as medicine cards; enter New Quantity per
//                     item; "Add Manually" / "Quick Add" for unmatched items
//   Step 3 — Save:    sticky "Save N updates" bar → bulk-update endpoint
//
// Also has a "History" sub-tab showing recent scans with applied stats.
//
// Endpoints consumed:
//   POST /api/businesses/[id]/ai/shelf-scan        — analyze
//   POST /api/businesses/[id]/stock/bulk-update    — apply counts
//   GET  /api/businesses/[id]/shelf-scans          — history

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScanLine, ArrowLeft, Camera, UploadCloud, X, Loader2, Sparkles,
  ImageOff, AlertTriangle, CheckCircle2, TrendingUp, Search, Plus,
  Clock, ChevronRight, RefreshCw, Trash2, Pencil,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";
import { ManualMatchModal, type InventoryProduct } from "./shelf-scanner/ManualMatchModal";
import { QuickAddModal, type QuickAddPrefill } from "./shelf-scanner/QuickAddModal";

// ── Types ──

type Step = "upload" | "review" | "saving";
type SubTab = "scan" | "history";

interface ScanItem {
  id: string;
  detectedName: string;
  detectedStrength: string | null;
  detectedForm: string | null;
  detectedManufacturer: string | null;
  confidence: number;
  matchedMethod: string;
  previousQuantity: number;
  newQuantity: string; // string for input control
  // Linked product (may be null until matched/quick-added)
  product: {
    id: string;
    name: string;
    strength?: string | null;
    dosageForm?: string | null;
    manufacturer?: string | null;
    rackNo?: string | null;
    reorderLevel?: number | null;
    sellingPrice?: number | null;
    mrp?: number | null;
    unit: string;
    currentStock: number;
  } | null;
  masterProduct: {
    id: string;
    name: string;
    genericName?: string | null;
    strength?: string | null;
    dosageForm?: string | null;
    manufacturer?: string | null;
    defaultMrp?: number | null;
    unit: string;
  } | null;
  removed: boolean; // user dismissed this detection
  // Optional field edits
  sellingPrice: string;
  reorderLevel: string;
  rackNo: string;
  showDetails: boolean;
}

interface HistoryScan {
  id: string;
  imageCount: number;
  detectedCount: number;
  matchedCount: number;
  tokensUsed: number;
  createdAt: string;
  totalItems: number;
  appliedItems: number;
  fullyApplied: boolean;
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const MAX_IMAGES = 3;
const MIN_IMAGES = 2;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB pre-resize (we resize down)
const RESIZE_MAX_DIMENSION = 1280; // max width/height after resize — plenty for reading labels
const RESIZE_QUALITY = 0.8; // JPEG quality (0-1)

/**
 * Resize an image File to a max dimension and compress to JPEG.
 * Phone photos are 4000×3000px / 3-5MB — way too large for the vision model
 * (causes 3-minute VLM calls + gateway timeouts). Resizing to 1280px cuts
 * each image to ~150KB and the VLM call to ~5-10 seconds.
 *
 * Returns a base64 data URL ready to send to the API.
 */
async function resizeImageToDataUrl(file: File): Promise<string> {
  // Read the file as a data URL first
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });

  // Load it into an Image element
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = rawDataUrl;
  });

  // Calculate new dimensions — keep aspect ratio, cap at RESIZE_MAX_DIMENSION
  let { width, height } = img;
  if (width > height && width > RESIZE_MAX_DIMENSION) {
    height = Math.round((height * RESIZE_MAX_DIMENSION) / width);
    width = RESIZE_MAX_DIMENSION;
  } else if (height > RESIZE_MAX_DIMENSION) {
    width = Math.round((width * RESIZE_MAX_DIMENSION) / height);
    height = RESIZE_MAX_DIMENSION;
  }

  // Draw to canvas at the new size
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return rawDataUrl; // fallback to original if canvas unavailable
  ctx.drawImage(img, 0, 0, width, height);

  // Export as compressed JPEG data URL
  return canvas.toDataURL("image/jpeg", RESIZE_QUALITY);
}

export function ShelfScanner() {
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const setActiveView = useNavStore((s) => s.setActiveView);

  const [subTab, setSubTab] = useState<SubTab>("scan");
  const [step, setStep] = useState<Step>("upload");

  // Upload state
  const [images, setImages] = useState<string[]>([]); // data URLs
  const [note, setNote] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processingImages, setProcessingImages] = useState(false); // true while resizing
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analyzing state
  const [analyzing, setAnalyzing] = useState(false);
  const [scanId, setScanId] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Review state
  const [items, setItems] = useState<ScanItem[]>([]);

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    applied: number; skipped: number; errors: number;
  } | null>(null);

  // History state
  const [history, setHistory] = useState<HistoryScan[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // Modal state
  const [matchModalItem, setMatchModalItem] = useState<ScanItem | null>(null);
  const [quickAddModalItem, setQuickAddModalItem] = useState<ScanItem | null>(null);

  // ── Image handling ──
  // Resizes each photo to 1280px max + JPEG 80% before storing. This is CRITICAL:
  // full-size phone photos (3-5MB each) cause 3-minute VLM calls and gateway
  // timeouts. Resized to ~150KB, the VLM finishes in 5-10 seconds.
  const handleImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadError("Please upload an image file (JPG, PNG, etc.)");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError(`Image too large (max 8MB). "${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)}MB`);
      return;
    }
    if (images.length >= MAX_IMAGES) {
      setUploadError(`Maximum ${MAX_IMAGES} photos per scan`);
      return;
    }
    setUploadError(null);
    setProcessingImages(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      // Verify we got a valid data URL — if the canvas was tainted or the
      // image couldn't be decoded, we might get a non-data URL back.
      if (!dataUrl.startsWith("data:image/")) {
        throw new Error("Image processing failed — could not convert to data URL");
      }
      console.log(`[shelf-scanner] image processed: ${dataUrl.length} chars, prefix: ${dataUrl.substring(0, 40)}`);
      setImages((prev) => [...prev, dataUrl]);
    } catch (err) {
      console.error("[shelf-scanner] image processing failed:", err);
      setUploadError(
        err instanceof Error && err.message.includes("Failed to load image")
          ? "Could not read this image format. Try a JPG or PNG photo instead."
          : "Failed to process image. Please try a different photo."
      );
    } finally {
      setProcessingImages(false);
    }
  }, [images.length]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    for (const f of files) {
      if (images.length >= MAX_IMAGES) break;
      handleImageFile(f);
    }
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Analyze (Step 1 → Step 2) ──
  const handleAnalyze = async () => {
    if (!businessId || images.length < MIN_IMAGES) return;
    setAnalyzing(true);
    setScanError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/ai/shelf-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images,
          note: note.trim() || undefined,
        }),
      });
      // Guard against gateway/HTML error pages (e.g. 502 timeout) — if the
      // response isn't JSON, show a friendly message instead of a JSON parse crash.
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        if (res.status === 429) {
          throw new Error("AI rate limit reached. Please wait a minute and try again.");
        }
        throw new Error(
          res.status === 502 || res.status === 504
            ? "The AI service took too long to respond. The photos may be too large — they are now auto-resized, so please try again."
            : `Server error (HTTP ${res.status}). Please try again.`
        );
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.fallbackMessage || "Scan failed");
      }
      setScanId(data.scanId);
      setItems(
        (data.items as ScanItem[]).map((it) => ({
          ...it,
          newQuantity: "",
          removed: false,
          sellingPrice: it.product?.sellingPrice ? String(it.product.sellingPrice) : "",
          reorderLevel: it.product?.reorderLevel ? String(it.product.reorderLevel) : "",
          rackNo: it.product?.rackNo || "",
          showDetails: false,
        }))
      );
      setStep("review");
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Review helpers ──
  const updateItem = (id: string, patch: Partial<ScanItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, removed: true } : it)));
  };

  const handleManualMatch = (item: ScanItem, product: InventoryProduct) => {
    updateItem(item.id, {
      product: {
        id: product.id,
        name: product.name,
        strength: product.strength,
        dosageForm: product.dosageForm,
        manufacturer: product.manufacturer,
        rackNo: product.rackNo,
        reorderLevel: product.reorderLevel,
        sellingPrice: product.sellingPrice,
        mrp: product.mrp,
        unit: product.unit,
        currentStock: product.inventory?.quantity ?? 0,
      },
      previousQuantity: product.inventory?.quantity ?? 0,
      matchedMethod: "manual",
      sellingPrice: product.sellingPrice ? String(product.sellingPrice) : "",
      reorderLevel: product.reorderLevel ? String(product.reorderLevel) : "",
      rackNo: product.rackNo || "",
    });
    showToast(`Linked to ${product.name}`);
  };

  const handleQuickAdd = (item: ScanItem, product: {
    id: string; name: string; strength?: string | null; dosageForm?: string | null;
    manufacturer?: string | null; unit: string; rackNo?: string | null;
    reorderLevel?: number | null; sellingPrice?: number | null; mrp?: number | null;
  }) => {
    updateItem(item.id, {
      product: {
        id: product.id,
        name: product.name,
        strength: product.strength,
        dosageForm: product.dosageForm,
        manufacturer: product.manufacturer,
        rackNo: product.rackNo,
        reorderLevel: product.reorderLevel,
        sellingPrice: product.sellingPrice,
        mrp: product.mrp,
        unit: product.unit,
        currentStock: 0,
      },
      previousQuantity: 0,
      matchedMethod: "quick-add",
      sellingPrice: product.sellingPrice ? String(product.sellingPrice) : "",
      reorderLevel: product.reorderLevel ? String(product.reorderLevel) : "",
      rackNo: product.rackNo || "",
    });
    showToast(`Created ${product.name}`);
  };

  // ── Save (Step 2 → Step 3) ──
  const activeItems = items.filter((it) => !it.removed && it.product && it.newQuantity.trim() !== "");

  const handleSave = async () => {
    if (!businessId || !scanId || activeItems.length === 0) return;
    setSaving(true);
    setStep("saving");
    try {
      const payload = {
        scanId,
        items: activeItems.map((it) => ({
          shelfScanItemId: it.id,
          productId: it.product!.id,
          newQuantity: parseFloat(it.newQuantity) || 0,
          sellingPrice: it.sellingPrice ? parseFloat(it.sellingPrice) : undefined,
          reorderLevel: it.reorderLevel ? parseFloat(it.reorderLevel) : undefined,
          rackNo: it.rackNo.trim() || undefined,
        })),
      };
      const res = await fetch(`/api/businesses/${businessId}/stock/bulk-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSaveResult({
        applied: data.applied || 0,
        skipped: data.skipped || 0,
        errors: data.errors || 0,
      });
      showToast(`Saved ${data.applied} stock updates`);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Save failed");
      setStep("review"); // back to review on error
    } finally {
      setSaving(false);
    }
  };

  // ── Reset ──
  const reset = () => {
    setStep("upload");
    setImages([]);
    setNote("");
    setScanId(null);
    setItems([]);
    setScanError(null);
    setSaveResult(null);
    setUploadError(null);
  };

  // ── History ──
  const loadHistory = useCallback(async () => {
    if (!businessId) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/shelf-scans?limit=20`);
      const data = await res.json();
      if (data.success) setHistory(data.scans);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (subTab === "history") loadHistory();
  }, [subTab, loadHistory]);

  // ── Confidence badge helper ──
  const confidenceBadge = (c: number) => {
    if (c >= 0.8) return { label: "High", className: "bg-emerald-50 text-emerald-700" };
    if (c >= 0.5) return { label: "Medium", className: "bg-amber-50 text-amber-700" };
    return { label: "Low", className: "bg-rose-50 text-rose-700" };
  };

  const detectedCount = items.filter((it) => !it.removed).length;
  const matchedCount = items.filter((it) => !it.removed && it.product).length;
  const readyCount = activeItems.length;

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-24 pharmacy-bg min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <Button
          size="sm"
          variant="ghost"
          className="px-2"
          onClick={() => setActiveView("inventory-hub")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white">
            <ScanLine className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Shelf Scanner</h1>
            <p className="text-xs text-muted-foreground mt-0.5">AI vision stock counting</p>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        <button
          className={cn(
            "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
            subTab === "scan" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
          )}
          onClick={() => setSubTab("scan")}
        >
          <Camera className="h-3.5 w-3.5 inline mr-1" /> New Scan
        </button>
        <button
          className={cn(
            "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
            subTab === "history" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
          )}
          onClick={() => setSubTab("history")}
        >
          <Clock className="h-3.5 w-3.5 inline mr-1" /> History
        </button>
      </div>

      {subTab === "scan" && (
        <AnimatePresence mode="wait">
          {step === "upload" && (
            <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Upload zone */}
              <Card className={cn(
                "border-2 border-dashed transition-colors",
                dragActive ? "border-teal-400 bg-teal-50/40" : "border-border/60"
              )}>
                <CardContent className="p-0">
                  <div
                    className="p-6 text-center cursor-pointer transition-colors"
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        for (const f of files) {
                          if (images.length >= MAX_IMAGES) break;
                          handleImageFile(f);
                        }
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    />
                    <div className="h-14 w-14 mx-auto rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/30 mb-3">
                      <UploadCloud className="h-7 w-7 text-white" />
                    </div>
                    <p className="text-sm font-semibold mb-1">Tap to take/upload shelf photos</p>
                    <p className="text-[11px] text-muted-foreground">
                      {MIN_IMAGES}–{MAX_IMAGES} photos · auto-resized to 1280px · JPG/PNG
                    </p>
                  </div>
                </CardContent>
              </Card>

              {uploadError && (
                <div className="flex items-center gap-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Image previews */}
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border">
                      <img src={img} alt={`Shelf ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                        {idx + 1}
                      </span>
                    </div>
                  ))}
                  {images.length < MAX_IMAGES && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-teal-400 hover:text-teal-600 transition-colors"
                    >
                      <Plus className="h-6 w-6" />
                      <span className="text-[10px] mt-1">Add</span>
                    </button>
                  )}
                </div>
              )}

              {/* Optional note */}
              <div>
                <Label className="text-xs">Note (optional)</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g., Aisle 3, top shelf…"
                  className="mt-1 min-h-[50px] text-sm"
                  maxLength={500}
                />
              </div>

              {/* Analyze button */}
              <Button
                className="w-full h-12 gap-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white shadow-lg shadow-teal-500/30 border-0"
                disabled={images.length < MIN_IMAGES || analyzing || processingImages}
                onClick={handleAnalyze}
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Analyzing shelf…
                  </>
                ) : processingImages ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Processing photos…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Analyze Shelf ({images.length}/{MAX_IMAGES} photos)
                  </>
                )}
              </Button>

              {scanError && (
                <div className="flex items-start gap-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="flex-1">{scanError}</span>
                </div>
              )}

              {/* How it works */}
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">How it works</p>
                <p>1. Take 2–3 photos of your shelf from different angles</p>
                <p>2. AI detects medicines and matches them to your inventory</p>
                <p>3. Enter counted quantities and save — done!</p>
              </div>
            </motion.div>
          )}

          {step === "review" && (
            <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {/* Summary bar */}
              <div className="flex items-center justify-between rounded-lg bg-teal-50 border border-teal-200 px-3 py-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-teal-600" />
                  <span className="text-sm font-medium text-teal-900">
                    {detectedCount} detected · {matchedCount} matched
                  </span>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={reset}>
                  <RefreshCw className="h-3 w-3 mr-1" /> New scan
                </Button>
              </div>

              <p className="text-xs text-muted-foreground px-1">
                Enter the counted quantity for each item. Unmatched items can be linked manually or quick-added.
              </p>

              {/* Item cards */}
              <div className="space-y-2.5">
                {items.filter((it) => !it.removed).map((item) => {
                  const cb = confidenceBadge(item.confidence);
                  const hasProduct = !!item.product;
                  const hasMaster = !!item.masterProduct;
                  return (
                    <Card key={item.id} className={cn(
                      "overflow-hidden shadow-sm transition-opacity",
                      !hasProduct && "border-amber-200"
                    )}>
                      <CardContent className="p-0">
                        {/* Card header — detected info */}
                        <div className="p-3 flex items-start gap-3">
                          <div className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                            hasProduct
                              ? "bg-gradient-to-br from-teal-500 to-emerald-600"
                              : "bg-gradient-to-br from-amber-400 to-orange-500"
                          )}>
                            {hasProduct ? (
                              <CheckCircle2 className="h-5 w-5 text-white" />
                            ) : (
                              <AlertTriangle className="h-5 w-5 text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">
                                  {item.product?.name || item.detectedName}
                                </p>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                  {(item.product?.strength || item.detectedStrength) && (
                                    <Badge variant="outline" className="text-[10px] py-0">
                                      {item.product?.strength || item.detectedStrength}
                                    </Badge>
                                  )}
                                  {(item.product?.dosageForm || item.detectedForm) && (
                                    <Badge variant="outline" className="text-[10px] py-0">
                                      {item.product?.dosageForm || item.detectedForm}
                                    </Badge>
                                  )}
                                  {(item.product?.manufacturer || item.detectedManufacturer) && (
                                    <span className="text-[10px] text-blue-600">
                                      {item.product?.manufacturer || item.detectedManufacturer}
                                    </span>
                                  )}
                                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", cb.className)}>
                                    {Math.round(item.confidence * 100)}% {cb.label}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={() => removeItem(item.id)}
                                className="text-muted-foreground hover:text-rose-600 p-1 -m-1"
                                title="Dismiss"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* Match status / actions */}
                            {hasProduct ? (
                              <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                                <span>Current: <strong className="text-foreground">{item.product.currentStock} {item.product.unit}</strong></span>
                                {item.product.rackNo && <span>Rack: {item.product.rackNo}</span>}
                                {item.product.sellingPrice && <span>৳{item.product.sellingPrice}</span>}
                                <button
                                  className="text-emerald-600 hover:underline ml-auto flex items-center gap-0.5"
                                  onClick={() => updateItem(item.id, { showDetails: !item.showDetails })}
                                >
                                  <Pencil className="h-3 w-3" />
                                  {item.showDetails ? "Hide" : "Edit"}
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {hasMaster && (
                                  <span className="text-[10px] bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full">
                                    In catalog — add to inventory
                                  </span>
                                )}
                                <Button
                                  size="sm" variant="outline"
                                  className="h-7 text-[11px] gap-1"
                                  onClick={() => setMatchModalItem(item)}
                                >
                                  <Search className="h-3 w-3" /> Add Manually
                                </Button>
                                <Button
                                  size="sm" variant="outline"
                                  className="h-7 text-[11px] gap-1"
                                  onClick={() => setQuickAddModalItem(item)}
                                >
                                  <Plus className="h-3 w-3" /> Quick Add
                                </Button>
                              </div>
                            )}

                            {/* New quantity input — only if matched */}
                            {hasProduct && (
                              <div className="mt-2.5 flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground shrink-0">New qty:</Label>
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  value={item.newQuantity}
                                  onChange={(e) => updateItem(item.id, { newQuantity: e.target.value })}
                                  placeholder={String(item.previousQuantity)}
                                  className="h-9 w-24 text-sm"
                                />
                                <span className="text-[11px] text-muted-foreground">{item.product?.unit}</span>
                                {item.newQuantity.trim() !== "" && parseFloat(item.newQuantity) !== item.previousQuantity && (
                                  <span className="text-[11px] text-emerald-600 flex items-center gap-0.5">
                                    <TrendingUp className="h-3 w-3" />
                                    {parseFloat(item.newQuantity) > item.previousQuantity ? "+" : ""}
                                    {(parseFloat(item.newQuantity) - item.previousQuantity).toFixed(0)}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Optional detail fields (collapsed by default) */}
                            {hasProduct && item.showDetails && (
                              <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t">
                                <div>
                                  <Label className="text-[10px] text-muted-foreground">Sell ৳</Label>
                                  <Input
                                    type="number"
                                    value={item.sellingPrice}
                                    onChange={(e) => updateItem(item.id, { sellingPrice: e.target.value })}
                                    className="h-8 text-xs mt-0.5"
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-muted-foreground">Reorder</Label>
                                  <Input
                                    type="number"
                                    value={item.reorderLevel}
                                    onChange={(e) => updateItem(item.id, { reorderLevel: e.target.value })}
                                    className="h-8 text-xs mt-0.5"
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-muted-foreground">Rack</Label>
                                  <Input
                                    value={item.rackNo}
                                    onChange={(e) => updateItem(item.id, { rackNo: e.target.value })}
                                    className="h-8 text-xs mt-0.5"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {detectedCount === 0 && (
                <div className="text-center py-12">
                  <ImageOff className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">All detections dismissed.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={reset}>
                    Start a new scan
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {step === "saving" && (
            <motion.div key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {saving ? (
                <div className="text-center py-16">
                  <Loader2 className="h-10 w-10 mx-auto animate-spin text-teal-600 mb-3" />
                  <p className="text-sm font-medium">Saving stock updates…</p>
                  <p className="text-xs text-muted-foreground mt-1">Writing {readyCount} adjustments</p>
                </div>
              ) : saveResult ? (
                <div className="text-center py-8 space-y-4">
                  <div className="h-16 w-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-lg font-bold">Stock updated!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {saveResult.applied} applied · {saveResult.skipped} unchanged · {saveResult.errors} errors
                    </p>
                  </div>
                  <div className="flex gap-2 max-w-xs mx-auto">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { reset(); setSubTab("history"); }}
                    >
                      View history
                    </Button>
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => setActiveView("inventory-hub")}
                    >
                      Done
                    </Button>
                  </div>
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {subTab === "history" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {historyLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No scans yet.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setSubTab("scan")}>
                Start your first scan
              </Button>
            </div>
          ) : (
            history.map((scan) => (
              <Card key={scan.id} className="shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <div className={cn(
                        "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                        scan.fullyApplied
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-amber-100 text-amber-600"
                      )}>
                        {scan.fullyApplied ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {scan.detectedCount} items detected
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(scan.createdAt).toLocaleString("en-GB", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                          {" · "}{scan.imageCount} photos
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[11px]">
                    <span className="text-muted-foreground">
                      Matched: <strong className="text-foreground">{scan.matchedCount}</strong>
                    </span>
                    <span className="text-muted-foreground">
                      Applied: <strong className={scan.fullyApplied ? "text-emerald-600" : "text-amber-600"}>
                        {scan.appliedItems}/{scan.totalItems}
                      </strong>
                    </span>
                    {scan.tokensUsed > 0 && (
                      <span className="text-muted-foreground">{scan.tokensUsed} tokens</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </motion.div>
      )}

      {/* Sticky save bar (Step 2 only) */}
      {subTab === "scan" && step === "review" && readyCount > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
          <div className="max-w-md mx-auto">
            <Button
              className="w-full h-12 gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-xl shadow-emerald-500/40 border-0"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              Save {readyCount} stock {readyCount === 1 ? "update" : "updates"}
            </Button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-slate-900 text-white px-4 py-2 text-sm shadow-xl"
        >
          {toast}
        </motion.div>
      )}

      {/* Modals */}
      {matchModalItem && (
        <ManualMatchModal
          open={!!matchModalItem}
          onOpenChange={(o) => { if (!o) setMatchModalItem(null); }}
          detectedName={matchModalItem.detectedName}
          onSelect={(p) => handleManualMatch(matchModalItem, p)}
        />
      )}
      {quickAddModalItem && (
        <QuickAddModal
          open={!!quickAddModalItem}
          onOpenChange={(o) => { if (!o) setQuickAddModalItem(null); }}
          prefill={{
            name: quickAddModalItem.detectedName,
            strength: quickAddModalItem.detectedStrength,
            dosageForm: quickAddModalItem.detectedForm,
            manufacturer: quickAddModalItem.detectedManufacturer,
          } as QuickAddPrefill}
          onCreated={(p) => handleQuickAdd(quickAddModalItem, p)}
        />
      )}
    </motion.div>
  );
}
