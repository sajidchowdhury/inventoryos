'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ScanBarcode, Package, ChevronDown, Check, X, AlertCircle,
  Loader2, Download, ShieldCheck, Plus, Minus, Edit3, Zap,
  Volume2, VolumeX, Settings2, ChevronUp,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { CCTVProduct, StockInRow, SerialGrade } from '../types';

const GRADES: { value: SerialGrade; label: string; desc: string; color: string }[] = [
  { value: 'A', label: 'A', desc: 'New / Sealed', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  { value: 'B', label: 'B', desc: 'Open Box', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { value: 'C', label: 'C', desc: 'Refurbished', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  { value: 'D', label: 'D', desc: 'Used', color: 'bg-gray-100 text-gray-500 border-gray-200' },
];

let tempIdCounter = 0;
function makeTempId() {
  return `temp_${Date.now()}_${++tempIdCounter}`;
}

// Play a short beep sound using Web Audio API
function playBeep(frequency = 800, duration = 80) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration / 1000);
  } catch {
    // Audio not available
  }
}

function playErrorBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 300;
    osc.type = 'square';
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Audio not available
  }
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

// ── Bulk Edit Panel ──
function BulkEditPanel({
  defaultCost,
  defaultSell,
  defaultGrade,
  onApply,
  onClose,
}: {
  defaultCost: string;
  defaultSell: string;
  defaultGrade: SerialGrade | '';
  onApply: (cost: string, sell: string, grade: SerialGrade | '', notes: string) => void;
  onClose: () => void;
}) {
  const [cost, setCost] = useState(defaultCost);
  const [sell, setSell] = useState(defaultSell);
  const [grade, setGrade] = useState<SerialGrade | ''>(defaultGrade);
  const [notes, setNotes] = useState('');

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl border-t border-gray-100 max-w-[480px] mx-auto"
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full bg-gray-200" />
      </div>

      <div className="px-5 pb-8">
        <div className="flex items-center gap-2 mb-5">
          <Settings2 className="w-4 h-4 text-violet-500" />
          <h3 className="text-sm font-bold text-gray-900">Bulk Edit All Items</h3>
        </div>

        <p className="text-[11px] text-gray-400 mb-4">
          Set common attributes for all {0} staged items. Individual items can still be edited.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-gray-500">Cost Price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">৳</span>
              <Input
                type="number"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="h-10 rounded-xl pl-7 text-sm"
                placeholder="0"
                min="0"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-gray-500">Sell Price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">৳</span>
              <Input
                type="number"
                value={sell}
                onChange={(e) => setSell(e.target.value)}
                className="h-10 rounded-xl pl-7 text-sm"
                placeholder="0"
                min="0"
              />
            </div>
          </div>
        </div>

        {/* Grade selector */}
        <div className="space-y-1.5 mb-4">
          <label className="text-[11px] font-medium text-gray-500">Grade (applies to all)</label>
          <div className="grid grid-cols-5 gap-2">
            {GRADES.map((g) => (
              <button
                key={g.value}
                onClick={() => setGrade(grade === g.value ? '' : g.value)}
                className={cn(
                  'py-2 rounded-xl border text-xs font-bold text-center transition-all active:scale-95',
                  grade === g.value ? g.color : 'bg-gray-50 border-gray-200 text-gray-400'
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5 mb-5">
          <label className="text-[11px] font-medium text-gray-500">Notes (appended to all)</label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-10 rounded-xl text-sm"
            placeholder="e.g. Supplier: TechVision, Invoice #INV-123"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600 active:scale-[0.98] transition-transform"
          >
            Cancel
          </button>
          <button
            onClick={() => onApply(cost, sell, grade, notes)}
            className="flex-1 h-11 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-semibold shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <Check className="w-4 h-4" />
            Apply to All
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function CCTVStockInView() {
  const { goBack } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);

  // ── Modes: 'setup' | 'batch' ──
  const [mode, setMode] = useState<'setup' | 'batch'>('setup');

  // ── Product selection ──
  const [products, setProducts] = useState<CCTVProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // ── Stock-in rows (staged — never written until commit) ──
  const [rows, setRows] = useState<StockInRow[]>([]);

  // ── Batch config ──
  const [targetCount, setTargetCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [bulkGrade, setBulkGrade] = useState<SerialGrade | 'A'>('A');

  // ── Submit state ──
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; created: number; errors?: string[] } | null>(null);

  // ── UI state ──
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [flashDuplicate, setFlashDuplicate] = useState<string | null>(null);
  const [flashSuccess, setFlashSuccess] = useState(false);

  // Refs
  const scannerInputRef = useRef<HTMLInputElement>(null);

  // ── Navigation guard ──
  const hasUnsavedData = rows.some((r) => !r.duplicate && r.serialNumber.trim());

  const handleGoBack = () => {
    if (hasUnsavedData) {
      setShowExitDialog(true);
    } else {
      goBack();
    }
  };

  const confirmExit = () => {
    setShowExitDialog(false);
    setRows([]);
    setMode('setup');
    goBack();
  };

  // Fetch products on mount
  useEffect(() => {
    if (!businessId) return;
    setLoadingProducts(true);
    fetch(`/api/businesses/${businessId}/cctv/products?limit=100&serialTracked=true`)
      .then((r) => r.json())
      .then((data) => {
        const list: CCTVProduct[] = data.products || [];
        setProducts(list);
      })
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, [businessId]);

  // Auto-focus scanner in batch mode
  useEffect(() => {
    if (mode === 'batch' && scannerInputRef.current) {
      const timer = setTimeout(() => scannerInputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [mode, rows.length]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const validRows = rows.filter((r) => !r.duplicate && r.serialNumber.trim());
  const duplicateCount = rows.filter((r) => r.duplicate).length;
  const progressPercent = targetCount > 0 ? Math.min((validRows.length / targetCount) * 100, 100) : 0;
  const isComplete = targetCount > 0 && validRows.length >= targetCount;

  // ── Core: Add scanned item ──
  const handleScan = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed || !selectedProductId) return;

    // Client-side duplicate check within batch
    const existingIdx = rows.findIndex(
      (r) => r.serialNumber.trim().toLowerCase() === trimmed.toLowerCase() && !r.duplicate
    );

    if (existingIdx !== -1) {
      // Flash duplicate
      const dupId = rows[existingIdx]._tempId;
      setFlashDuplicate(dupId);
      setTimeout(() => setFlashDuplicate(null), 600);
      if (soundEnabled) playErrorBeep();
      return;
    }

    if (soundEnabled) playBeep();

    const newRow: StockInRow = {
      _tempId: makeTempId(),
      serialNumber: trimmed,
      imei: '',
      costPrice: selectedProduct ? String(selectedProduct.costPrice) : '',
      sellPrice: selectedProduct ? String(selectedProduct.sellPrice) : '',
      grade: bulkGrade || '',
      notes: '',
      duplicate: false,
    };

    setRows((prev) => [newRow, ...prev]);
    setFlashSuccess(true);
    setTimeout(() => setFlashSuccess(false), 200);

    // Clear and refocus
    if (scannerInputRef.current) {
      scannerInputRef.current.value = '';
      scannerInputRef.current.focus();
    }
  }, [selectedProductId, rows, selectedProduct, bulkGrade, soundEnabled]);

  const handleScannerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScan((e.target as HTMLInputElement).value);
    }
  };

  // ── Row operations ──
  const removeRow = (tempId: string) => {
    setRows((prev) => prev.filter((r) => r._tempId !== tempId));
  };

  const updateRow = (tempId: string, field: keyof StockInRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r._tempId === tempId ? { ...r, [field]: value, duplicate: false, error: undefined } : r))
    );
  };

  // ── Bulk apply ──
  const handleBulkApply = (cost: string, sell: string, grade: SerialGrade | '', notes: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.duplicate) return r;
        return {
          ...r,
          ...(cost ? { costPrice: cost } : {}),
          ...(sell ? { sellPrice: sell } : {}),
          ...(grade ? { grade } : {}),
          ...(notes ? { notes: r.notes ? `${r.notes}; ${notes}` : notes } : {}),
        };
      })
    );
    setShowBulkEdit(false);
  };

  // ── Remove all duplicates from staged ──
  const clearDuplicates = () => {
    setRows((prev) => prev.filter((r) => !r.duplicate));
  };

  // ── Commit ──
  const handleCommit = async () => {
    if (!businessId || !selectedProductId || validRows.length === 0) return;
    setSubmitting(true);
    setSubmitResult(null);

    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/stock-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProductId,
          items: validRows.map((r) => ({
            serialNumber: r.serialNumber.trim(),
            imei: r.imei.trim() || undefined,
            costPrice: parseFloat(r.costPrice) || undefined,
            sellPrice: parseFloat(r.sellPrice) || undefined,
            grade: r.grade || undefined,
            notes: r.notes.trim() || undefined,
          })),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSubmitResult({ success: true, created: data.created });
        setRows([]);
        setTargetCount(0);
      } else {
        setSubmitResult({
          success: false,
          errors: data.duplicates
            ? data.duplicates.map((d: { serialNumber: string; reason: string }) => `${d.serialNumber}: ${d.reason}`)
            : [data.error || 'Stock-in failed'],
        });
      }
    } catch {
      setSubmitResult({ success: false, errors: ['Network error. Please try again.'] });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Enter batch mode ──
  const enterBatchMode = () => {
    if (!selectedProductId) return;
    setMode('batch');
  };

  // ── Filtered products ──
  const filteredProducts = searchQuery
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.sku || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : products;

  // ═══════════════════════════════════════════════
  //  BATCH MODE — Full-screen rapid scanning UI
  // ═══════════════════════════════════════════════
  if (mode === 'batch') {
    return (
      <div className="flex flex-col h-full -m-4">
        {/* ── Batch Header ── */}
        <div className="bg-gradient-to-b from-violet-600 to-violet-700 px-4 pt-3 pb-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={handleGoBack}
              className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="text-center">
              <p className="text-white/60 text-[10px] font-medium uppercase tracking-wider">Batch Scanning</p>
              <p className="text-white font-bold text-sm truncate max-w-[180px]">
                {selectedProduct?.name}
              </p>
            </div>
            <button
              onClick={() => setSoundEnabled((p) => !p)}
              className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-white" />
              ) : (
                <VolumeX className="w-4 h-4 text-white/50" />
              )}
            </button>
          </div>

          {/* Progress Ring */}
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 shrink-0">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
                <circle
                  cx="40" cy="40" r="34" fill="none"
                  stroke={isComplete ? '#4ade80' : '#ffffff'}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - progressPercent / 100)}`}
                  className="transition-all duration-500 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                  key={validRows.length}
                  initial={{ scale: 1.3, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-2xl font-black text-white leading-none"
                >
                  {validRows.length}
                </motion.span>
                {targetCount > 0 && (
                  <span className="text-white/50 text-[10px] font-medium">/ {targetCount}</span>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-1.5">
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/10 rounded-xl px-2.5 py-2 text-center backdrop-blur-sm">
                  <p className="text-white/50 text-[9px]">Valid</p>
                  <p className="text-white font-bold text-sm">{validRows.length}</p>
                </div>
                <div className="bg-white/10 rounded-xl px-2.5 py-2 text-center backdrop-blur-sm">
                  <p className="text-white/50 text-[9px]">Dups</p>
                  <p className={cn('font-bold text-sm', duplicateCount > 0 ? 'text-red-300' : 'text-white')}>
                    {duplicateCount}
                  </p>
                </div>
                <div className="bg-white/10 rounded-xl px-2.5 py-2 text-center backdrop-blur-sm">
                  <p className="text-white/50 text-[9px]">Total</p>
                  <p className="text-white font-bold text-sm">{rows.length}</p>
                </div>
              </div>

              {targetCount > 0 && !isComplete && (
                <p className="text-white/50 text-[11px]">
                  {targetCount - validRows.length} remaining to scan
                </p>
              )}
              {isComplete && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-emerald-300 text-[11px] font-semibold"
                >
                  Target reached! Review and confirm below.
                </motion.p>
              )}
            </div>
          </div>
        </div>

        {/* ── Scanner Input Zone ── */}
        <div className={cn(
          'mx-4 -mt-3 relative z-10 rounded-2xl border-2 p-3 transition-all bg-white shadow-lg',
          flashSuccess
            ? 'border-emerald-400 shadow-emerald-100'
            : 'border-gray-200'
        )}>
          <div className="flex items-center gap-2">
            <ScanBarcode className="w-5 h-5 text-violet-500 shrink-0" />
            <input
              ref={scannerInputRef}
              type="text"
              placeholder="Scan barcode or type serial..."
              className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none min-w-0 font-mono"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              onKeyDown={handleScannerKeyDown}
            />
            <div className="w-1.5 h-5 bg-violet-500 rounded-full animate-pulse shrink-0" />
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 ml-7">
            Press Enter after each scan. Barcode guns auto-submit.
          </p>
        </div>

        {/* ── Action Bar ── */}
        <div className="flex items-center gap-2 px-4 mt-3">
          <button
            onClick={() => setShowBulkEdit(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-[11px] font-medium active:scale-95 transition-transform"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Bulk Edit
          </button>

          {/* Grade quick-select */}
          <div className="flex items-center gap-1">
            {GRADES.map((g) => (
              <button
                key={g.value}
                onClick={() => setBulkGrade(bulkGrade === g.value ? 'A' : g.value)}
                className={cn(
                  'w-7 h-7 rounded-lg text-[10px] font-bold flex items-center justify-center transition-all active:scale-90',
                  bulkGrade === g.value
                    ? g.color + ' border shadow-sm'
                    : 'bg-gray-50 text-gray-400 border border-gray-200'
                )}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {duplicateCount > 0 && (
            <button
              onClick={clearDuplicates}
              className="text-[10px] text-red-500 font-medium px-2 py-1.5 rounded-lg hover:bg-red-50"
            >
              Clear {duplicateCount} dup
            </button>
          )}
        </div>

        {/* ── Scanned Items List ── */}
        <div className="flex-1 mt-3 px-4 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto rounded-2xl bg-gray-50 border border-gray-100 scrollbar-thin">
            <AnimatePresence mode="popLayout">
              {rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center mb-3">
                    <Zap className="w-6 h-6 text-violet-300" />
                  </div>
                  <p className="text-xs font-semibold text-gray-400">Start scanning</p>
                  <p className="text-[10px] text-gray-300 mt-1">Each scan adds a new item to the list</p>
                </div>
              ) : (
                rows.map((row, i) => (
                  <motion.div
                    key={row._tempId}
                    layout
                    initial={{ opacity: 0, x: -16, scale: 0.95 }}
                    animate={{
                      opacity: 1, x: 0, scale: 1,
                      backgroundColor: flashDuplicate === row._tempId ? 'rgba(239,68,68,0.1)' : 'transparent',
                    }}
                    exit={{ opacity: 0, x: 16, height: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-100/80 last:border-0 transition-colors',
                      row.duplicate && 'bg-red-50/80'
                    )}
                  >
                    <span className="text-[10px] text-gray-300 w-5 text-right shrink-0 font-mono">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={cn(
                          'text-xs font-mono font-medium truncate',
                          row.duplicate ? 'text-red-500 line-through' : 'text-gray-800'
                        )}>
                          {row.serialNumber}
                        </p>
                        {row.grade && (
                          <span className={cn(
                            'text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0',
                            row.grade === 'A' ? 'bg-emerald-50 text-emerald-600' :
                            row.grade === 'B' ? 'bg-blue-50 text-blue-600' :
                            row.grade === 'C' ? 'bg-amber-50 text-amber-600' :
                            'bg-gray-100 text-gray-500'
                          )}>
                            {row.grade}
                          </span>
                        )}
                        {row.duplicate && (
                          <Badge variant="destructive" className="text-[9px] px-1.5 py-0 shrink-0">
                            DUP
                          </Badge>
                        )}
                      </div>
                      {row.duplicate && row.duplicateOf && (
                        <p className="text-[9px] text-red-400 mt-0.5">{row.duplicateOf}</p>
                      )}
                    </div>
                    {row.costPrice && !row.duplicate && (
                      <span className="text-[10px] text-gray-400 shrink-0">৳{row.costPrice}</span>
                    )}
                    {!row.duplicate && (
                      <button
                        onClick={() => removeRow(row._tempId)}
                        className="p-1 rounded-lg hover:bg-red-50 shrink-0"
                      >
                        <X className="w-3.5 h-3.5 text-gray-300 hover:text-red-400 transition-colors" />
                      </button>
                    )}
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Bottom Commit Bar ── */}
        <div className="px-4 py-3 bg-white border-t border-gray-100 mt-auto">
          {submitResult ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'flex items-center gap-3 p-3 rounded-2xl',
                submitResult.success ? 'bg-emerald-50' : 'bg-red-50'
              )}
            >
              {submitResult.success ? (
                <>
                  <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-emerald-800">
                      {submitResult.created} item{submitResult.created > 1 ? 's' : ''} stocked in!
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSubmitResult(null);
                      setMode('setup');
                      setTargetCount(0);
                    }}
                    className="text-[11px] text-violet-600 font-medium px-3 py-1.5 rounded-xl bg-violet-50 active:scale-95 transition-transform"
                  >
                    New Batch
                  </button>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-red-800">Failed</p>
                    {submitResult.errors?.[0] && (
                      <p className="text-[10px] text-red-500 truncate">{submitResult.errors[0]}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setSubmitResult(null)}
                    className="p-1"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </>
              )}
            </motion.div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (hasUnsavedData) {
                    setShowExitDialog(true);
                  } else {
                    setMode('setup');
                  }
                }}
                className="h-12 rounded-2xl border border-gray-200 text-gray-600 font-semibold text-sm px-6 active:scale-[0.98] transition-transform"
              >
                Back
              </button>
              <button
                onClick={handleCommit}
                disabled={submitting || validRows.length === 0}
                className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {submitting
                  ? 'Saving...'
                  : `Confirm Stock In (${validRows.length})`}
              </button>
            </div>
          )}
        </div>

        {/* ── Bulk Edit Panel (slide-up) ── */}
        <AnimatePresence>
          {showBulkEdit && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/30 z-40"
                onClick={() => setShowBulkEdit(false)}
              />
              <BulkEditPanel
                defaultCost={selectedProduct ? String(selectedProduct.costPrice) : ''}
                defaultSell={selectedProduct ? String(selectedProduct.sellPrice) : ''}
                defaultGrade={bulkGrade}
                onApply={handleBulkApply}
                onClose={() => setShowBulkEdit(false)}
              />
            </>
          )}
        </AnimatePresence>

        {/* ── Exit Confirmation Dialog ── */}
        <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
          <AlertDialogContent className="max-w-[340px]">
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved Items</AlertDialogTitle>
              <AlertDialogDescription>
                You have {validRows.length} scanned item{validRows.length > 1 ? 's' : ''} that haven&apos;t been saved. Discard them?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className="flex-1">Keep Scanning</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmExit}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
              >
                Discard & Exit
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  //  SETUP MODE — Product selection + config
  // ═══════════════════════════════════════════════
  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:scale-95 transition-transform shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">Stock In</h1>
          <p className="text-[11px] text-gray-400">Batch scan serial numbers</p>
        </div>
      </div>

      {/* ── Product Selection ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
            <Package className="w-4 h-4 text-violet-500" />
          </div>
          <h2 className="text-sm font-bold text-gray-800">Select Product</h2>
        </div>

        {loadingProducts ? (
          <div className="space-y-2">
            <div className="h-10 bg-gray-50 rounded-xl animate-pulse" />
            <div className="h-10 bg-gray-50 rounded-xl animate-pulse w-3/4" />
          </div>
        ) : showProductPicker ? (
          <div className="space-y-3">
            <div className="relative">
              <Input
                autoFocus
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 rounded-xl pr-8 bg-gray-50 border-0 focus-visible:ring-2 focus-visible:ring-violet-500/30"
              />
              <button
                onClick={() => { setShowProductPicker(false); setSearchQuery(''); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5 scrollbar-thin">
              {filteredProducts.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No serial-tracked products found</p>
              )}
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProductId(p.id);
                    setShowProductPicker(false);
                    setSearchQuery('');
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-xl text-left active:scale-[0.98] transition-all',
                    selectedProductId === p.id
                      ? 'bg-violet-50 border border-violet-200'
                      : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                  )}
                >
                  <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{p.name}</p>
                    <p className="text-[11px] text-gray-400">{p.brand} {p.sku ? `· ${p.sku}` : ''}</p>
                  </div>
                  {selectedProductId === p.id && <Check className="w-4 h-4 text-violet-600 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowProductPicker(true)}
            className={cn(
              'w-full flex items-center justify-between p-3 rounded-xl border transition-all',
              selectedProduct
                ? 'bg-violet-50/50 border-violet-100'
                : 'bg-gray-50 border-gray-200'
            )}
          >
            {selectedProduct ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
                  <Package className="w-4 h-4 text-violet-600" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-gray-900">{selectedProduct.name}</p>
                  <p className="text-[11px] text-gray-400">{selectedProduct.brand} · ৳{selectedProduct.sellPrice}</p>
                </div>
              </div>
            ) : (
              <span className="text-xs text-gray-400">Choose a product to stock in</span>
            )}
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
        )}

        {/* Product info */}
        {selectedProduct && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="bg-gray-50 rounded-xl px-3 py-2 text-center">
              <p className="text-[10px] text-gray-400">Cost</p>
              <p className="text-xs font-bold text-gray-700">৳{selectedProduct.costPrice}</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-3 py-2 text-center">
              <p className="text-[10px] text-gray-400">Sell</p>
              <p className="text-xs font-bold text-gray-700">৳{selectedProduct.sellPrice}</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-3 py-2 text-center">
              <p className="text-[10px] text-gray-400">Warranty</p>
              <p className="text-xs font-bold text-gray-700">
                {selectedProduct.warrantyMonths > 0 ? `${selectedProduct.warrantyMonths}mo` : 'None'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Batch Configuration ── */}
      {selectedProduct && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Zap className="w-4 h-4 text-emerald-500" />
            </div>
            <h2 className="text-sm font-bold text-gray-800">Batch Config</h2>
          </div>

          {/* Target count */}
          <div className="flex items-center gap-3 mb-4">
            <label className="text-xs text-gray-600 font-medium w-20 shrink-0">Quantity</label>
            <div className="flex items-center gap-1.5 flex-1">
              <button
                onClick={() => setTargetCount((p) => Math.max(0, p - 1))}
                className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center active:scale-90 transition-transform"
              >
                <Minus className="w-4 h-4" />
              </button>
              <Input
                type="number"
                value={targetCount || ''}
                onChange={(e) => setTargetCount(parseInt(e.target.value) || 0)}
                placeholder="0"
                className="h-10 text-center text-lg font-bold rounded-xl"
                min={0}
              />
              <button
                onClick={() => setTargetCount((p) => p + 1)}
                className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center active:scale-90 transition-transform"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Default grade */}
          <div className="flex items-center gap-3 mb-4">
            <label className="text-xs text-gray-600 font-medium w-20 shrink-0">Default Grade</label>
            <div className="flex items-center gap-1.5">
              {GRADES.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setBulkGrade(bulkGrade === g.value ? 'A' : g.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-90 border',
                    bulkGrade === g.value
                      ? g.color + ' shadow-sm'
                      : 'bg-gray-50 text-gray-400 border-gray-200'
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sound toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-xs text-gray-700 font-medium">Scanner Sound</p>
              <p className="text-[10px] text-gray-400">Beep on scan, buzz on duplicate</p>
            </div>
            <button
              onClick={() => setSoundEnabled((p) => !p)}
              className={cn(
                'w-11 h-6 rounded-full transition-all relative',
                soundEnabled ? 'bg-violet-500' : 'bg-gray-200'
              )}
            >
              <div className={cn(
                'w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-all',
                soundEnabled ? 'left-[22px]' : 'left-0.5'
              )} />
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Start Scanning Button ── */}
      {selectedProduct && (
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={enterBatchMode}
          className={cn(
            'w-full h-14 rounded-2xl text-white font-bold text-sm shadow-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-transform',
            isComplete || targetCount === 0
              ? 'bg-gradient-to-r from-violet-500 to-purple-600 shadow-violet-500/20'
              : 'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-emerald-500/20'
          )}
        >
          <ScanBarcode className="w-5 h-5" />
          {targetCount > 0
            ? `Start Scanning ${targetCount} Items`
            : 'Start Scanning'}
        </motion.button>
      )}

      {/* Empty state */}
      {!selectedProduct && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
            <ScanBarcode className="w-8 h-8 text-gray-200" />
          </div>
          <p className="text-sm font-semibold text-gray-400">Select a product first</p>
          <p className="text-xs text-gray-300 mt-1 max-w-[200px]">
            Choose the product, set quantity, then start scanning
          </p>
        </div>
      )}
    </motion.div>
  );
}