'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ScanBarcode, Package, ChevronDown, Check, X, AlertCircle,
  Loader2, Download, ShieldCheck, Plus, Minus,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { CCTVProduct, StockInRow, SerialGrade } from '../types';

const GRADES: { value: SerialGrade | ''; label: string; desc: string }[] = [
  { value: '', label: 'Default', desc: '' },
  { value: 'A', label: 'Grade A', desc: 'New / Sealed' },
  { value: 'B', label: 'Grade B', desc: 'Open Box' },
  { value: 'C', label: 'Grade C', desc: 'Refurbished' },
  { value: 'D', label: 'Grade D', desc: 'Used' },
];

let tempIdCounter = 0;
function makeTempId() {
  return `temp_${Date.now()}_${++tempIdCounter}`;
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export function CCTVStockInView() {
  const { goBack } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);

  // ── Product selection ──
  const [products, setProducts] = useState<CCTVProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // ── Stock-in rows ──
  const [rows, setRows] = useState<StockInRow[]>([]);
  const [activeInput, setActiveInput] = useState<'serial' | 'imei'>('serial');

  // ── Submit state ──
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; created: number; errors?: string[] } | null>(null);

  // ── Target count (for batch scanning) ──
  const [targetCount, setTargetCount] = useState(0);
  const [showTargetInput, setShowTargetInput] = useState(false);

  // Scanner input ref (hidden, always focused for barcode gun)
  const scannerInputRef = useRef<HTMLInputElement>(null);
  const serialInputRef = useRef<HTMLInputElement>(null);

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

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const validRows = rows.filter((r) => !r.duplicate && r.serialNumber.trim());
  const duplicateRows = rows.filter((r) => r.duplicate);
  const progressPercent = targetCount > 0 ? Math.min((validRows.length / targetCount) * 100, 100) : 0;

  // ── Add row from scanner input ──
  const handleScannerSubmit = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed || !selectedProductId) return;

    // Check for duplicates within staged rows
    const isDuplicateSerial = rows.some(
      (r) => r.serialNumber.trim().toLowerCase() === trimmed.toLowerCase() && !r.duplicate
    );

    if (isDuplicateSerial) {
      // Flash the existing row
      setRows((prev) =>
        prev.map((r) =>
          r.serialNumber.trim().toLowerCase() === trimmed.toLowerCase() && !r.duplicate
            ? { ...r, duplicate: true, duplicateOf: 'Already in this batch', error: 'Duplicate in batch' }
            : r
        )
      );
      return;
    }

    const newRow: StockInRow = {
      _tempId: makeTempId(),
      serialNumber: trimmed,
      imei: '',
      costPrice: selectedProduct ? String(selectedProduct.costPrice) : '',
      sellPrice: selectedProduct ? String(selectedProduct.sellPrice) : '',
      grade: selectedProduct?.serialTracked ? 'A' : '',
      notes: '',
      duplicate: false,
    };

    setRows((prev) => [newRow, ...prev]);

    // Clear input and refocus
    if (scannerInputRef.current) {
      scannerInputRef.current.value = '';
      scannerInputRef.current.focus();
    }
  }, [selectedProductId, rows, selectedProduct]);

  // ── Handle scanner keypress (Enter to submit) ──
  const handleScannerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScannerSubmit((e.target as HTMLInputElement).value);
    }
  };

  // ── Remove row ──
  const removeRow = (tempId: string) => {
    setRows((prev) => prev.filter((r) => r._tempId !== tempId));
  };

  // ── Update a row field ──
  const updateRow = (tempId: string, field: keyof StockInRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r._tempId === tempId ? { ...r, [field]: value, duplicate: false, error: undefined } : r))
    );
  };

  // ── Commit stock-in to server ──
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

  // ── Filtered products for picker ──
  const filteredProducts = searchQuery
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.sku || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : products;

  // ── Render ──
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
          <p className="text-[11px] text-gray-400">Scan or enter serial numbers</p>
        </div>
        {selectedProduct && (
          <Badge variant="secondary" className="bg-violet-50 text-violet-700 text-[11px] font-medium px-2.5">
            {selectedProduct.brand}
          </Badge>
        )}
      </div>

      {/* ── Step 1: Product Selection ── */}
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
                    setTimeout(() => scannerInputRef.current?.focus(), 100);
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

        {/* Product info card */}
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

      {/* ── Step 2: Scanner Input (only when product selected) ── */}
      {selectedProduct && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                <ScanBarcode className="w-4 h-4 text-emerald-500" />
              </div>
              <h2 className="text-sm font-bold text-gray-800">Scan Serial</h2>
            </div>
            <div className="flex items-center gap-2">
              {showTargetInput ? (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setTargetCount((p) => Math.max(0, p - 1))} className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Minus className="w-3 h-3" />
                  </button>
                  <Input
                    type="number"
                    value={targetCount || ''}
                    onChange={(e) => setTargetCount(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="w-12 h-7 text-center text-xs rounded-lg p-0 border-0 bg-gray-50"
                    min={0}
                  />
                  <button onClick={() => setTargetCount((p) => p + 1)} className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Plus className="w-3 h-3" />
                  </button>
                  <span className="text-[10px] text-gray-400">target</span>
                </div>
              ) : (
                <button
                  onClick={() => setShowTargetInput(true)}
                  className="text-[11px] text-violet-600 font-medium px-2 py-1 rounded-lg hover:bg-violet-50"
                >
                  Set target
                </button>
              )}
            </div>
          </div>

          {/* Progress bar (only when target set) */}
          {targetCount > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-gray-500">
                  <span className="font-bold text-gray-800">{validRows.length}</span> of {targetCount} scanned
                </span>
                <span className="text-[11px] text-gray-400">{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          )}

          {/* Scanner Input — big, always focused */}
          <div className="relative">
            <div className={cn(
              'flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 transition-all',
              activeInput === 'serial'
                ? 'border-violet-400 bg-violet-50/50 ring-4 ring-violet-100'
                : 'border-gray-200 bg-gray-50'
            )}>
              <ScanBarcode className="w-5 h-5 text-gray-400 shrink-0" />
              <input
                ref={scannerInputRef}
                type="text"
                placeholder="Scan or type serial number..."
                className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none min-w-0"
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                onFocus={() => setActiveInput('serial')}
                onKeyDown={handleScannerSubmit}
              />
              {activeInput === 'serial' && (
                <div className="w-1.5 h-5 bg-violet-500 rounded-full animate-pulse shrink-0" />
              )}
            </div>
          </div>

          {/* IMEI Input (optional, for phones) */}
          <div className="mt-2 relative">
            <div className={cn(
              'flex items-center gap-2 rounded-xl border-2 px-3 py-2 transition-all',
              activeInput === 'imei'
                ? 'border-violet-400 bg-violet-50/50 ring-4 ring-violet-100'
                : 'border-gray-100 bg-gray-50/50'
            )}>
              <ShieldCheck className="w-4 h-4 text-gray-300 shrink-0" />
              <input
                ref={serialInputRef}
                type="text"
                placeholder="IMEI (optional, for phones)"
                className="flex-1 bg-transparent text-xs text-gray-700 placeholder:text-gray-300 outline-none min-w-0"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                maxLength={15}
                onFocus={() => setActiveInput('imei')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    scannerInputRef.current?.focus();
                  }
                }}
              />
            </div>
          </div>

          <p className="text-[10px] text-gray-400 mt-2">
            Scan barcode or type serial, then press Enter. Bluetooth/USB scanners auto-submit.
          </p>
        </motion.div>
      )}

      {/* ── Step 3: Staged Items List ── */}
      {rows.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-800">Staged Items</h2>
              <Badge variant="secondary" className="text-[10px] px-2 py-0">
                {validRows.length} valid
              </Badge>
              {duplicateRows.length > 0 && (
                <Badge variant="destructive" className="text-[10px] px-2 py-0">
                  {duplicateRows.length} dup
                </Badge>
              )}
            </div>
            <button
              onClick={() => { if (confirm('Clear all scanned items?')) setRows([]); }}
              className="text-[11px] text-red-500 font-medium hover:text-red-600"
            >
              Clear All
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto scrollbar-thin">
            <AnimatePresence mode="popLayout">
              {rows.map((row, i) => (
                <motion.div
                  key={row._tempId}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, height: 0 }}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 border-b border-gray-50 last:border-0 transition-colors',
                    row.duplicate && 'bg-red-50'
                  )}
                >
                  <span className="text-[10px] text-gray-300 w-5 text-right shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={cn(
                        'text-xs font-mono font-medium truncate',
                        row.duplicate ? 'text-red-600' : 'text-gray-800'
                      )}>
                        {row.serialNumber}
                      </p>
                      {row.imei && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-gray-400 shrink-0">
                          IMEI
                        </Badge>
                      )}
                      {row.grade && (
                        <span className={cn(
                          'text-[9px] font-bold px-1.5 py-0.5 rounded',
                          row.grade === 'A' ? 'bg-emerald-50 text-emerald-600' :
                          row.grade === 'B' ? 'bg-blue-50 text-blue-600' :
                          row.grade === 'C' ? 'bg-amber-50 text-amber-600' :
                          'bg-gray-100 text-gray-500'
                        )}>
                          {row.grade}
                        </span>
                      )}
                    </div>
                    {row.duplicate && (
                      <p className="text-[10px] text-red-400 mt-0.5">{row.duplicateOf || 'Duplicate'}</p>
                    )}
                  </div>
                  {row.costPrice && (
                    <span className="text-[10px] text-gray-400 shrink-0">৳{row.costPrice}</span>
                  )}
                  <button
                    onClick={() => removeRow(row._tempId)}
                    className="p-1 rounded-lg hover:bg-gray-100 shrink-0"
                  >
                    <X className="w-3.5 h-3.5 text-gray-300 hover:text-red-400" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* ── Submit Result ── */}
      {submitResult && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            'rounded-2xl border p-4',
            submitResult.success
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          )}
        >
          <div className="flex items-start gap-3">
            {submitResult.success ? (
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-5 h-5 text-emerald-600" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className={cn(
                'text-sm font-semibold',
                submitResult.success ? 'text-emerald-800' : 'text-red-800'
              )}>
                {submitResult.success
                  ? `${submitResult.created} item${submitResult.created > 1 ? 's' : ''} stocked in`
                  : 'Stock-in failed'}
              </p>
              {submitResult.errors && (
                <ul className="mt-1 space-y-0.5">
                  {submitResult.errors.map((err, i) => (
                    <li key={i} className="text-[11px] text-red-600">{err}</li>
                  ))}
                </ul>
              )}
            </div>
            <button onClick={() => setSubmitResult(null)} className="p-1">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Commit Button ── */}
      {selectedProduct && validRows.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={handleCommit}
            disabled={submitting}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {submitting
              ? 'Stocking In...'
              : `Confirm Stock In (${validRows.length} item${validRows.length > 1 ? 's' : ''})`}
          </button>
        </motion.div>
      )}

      {/* Empty state — before scanning */}
      {!selectedProduct && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
            <ScanBarcode className="w-8 h-8 text-gray-200" />
          </div>
          <p className="text-sm font-semibold text-gray-400">Select a product first</p>
          <p className="text-xs text-gray-300 mt-1 max-w-[200px]">
            Choose the product you want to stock in, then scan serial numbers
          </p>
        </div>
      )}

      {selectedProduct && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mb-3">
            <ScanBarcode className="w-7 h-7 text-violet-300" />
          </div>
          <p className="text-sm font-semibold text-gray-500">Ready to scan</p>
          <p className="text-xs text-gray-400 mt-1 max-w-[220px]">
            Point your barcode scanner or type a serial number and press Enter
          </p>
        </div>
      )}
    </motion.div>
  );
}