'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Upload, Download, FileSpreadsheet, AlertCircle,
  CheckCircle2, Loader2, X, AlertTriangle, Package,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { useMSBusinessId } from '@/modules/mobile-shop/hooks/use-ms-business-id';
import { cn } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

// ── Types ──

interface CSVRowResult {
  rowIndex: number;
  data: Record<string, string>;
  errors: string[];
  warnings: string[];
  status: 'valid' | 'warning' | 'error';
}

interface ImportResult {
  rows: CSVRowResult[];
  totalRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
}

type Phase = 'upload' | 'preview' | 'importing' | 'done';

export function MSImportProducts() {
  const { goBack } = useMSNavStore();
  const businessId = useMSBusinessId();

  const [phase, setPhase] = useState<Phase>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importMsg, setImportMsg] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── File handling ──
  const handleFile = (f: File) => {
    if (!f.name.endsWith('.csv') && f.type !== 'text/csv') {
      setError('Please select a .csv file');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('File too large (max 5MB)');
      return;
    }
    setFile(f);
    setError('');
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  // ── Upload & Parse ──
  const handleUpload = async () => {
    if (!file) return;
    setError('');
    setImportMsg('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/products/import`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data: ImportResult = await res.json();
        setResult(data);
        if (data.validCount > 0) {
          setPhase('preview');
        } else {
          setError('No valid rows found. Please check your CSV file.');
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to parse CSV');
      }
    } catch {
      setError('Network error. Please try again.');
    }
  };

  // ── Execute Import ──
  const handleImport = async () => {
    if (!result) return;
    setPhase('importing');
    setError('');
    setImportMsg('');
    setImportErrors([]);

    const validRows = result.rows.filter(
      (r) => r.status === 'valid' || r.status === 'warning'
    );

    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/products/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          rows: validRows,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setImportMsg(data.message);
        if (data.errors) setImportErrors(data.errors);
        setPhase('done');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Import failed');
        setPhase('preview');
      }
    } catch {
      setError('Network error. Please try again.');
      setPhase('preview');
    }
  };

  // ── Helpers ──
  const reset = () => {
    setPhase('upload');
    setFile(null);
    setResult(null);
    setError('');
    setImportMsg('');
    setImportErrors([]);
  };

  return (
    <div className="space-y-4 pb-4 animate-in fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={phase === 'done' ? goBack : reset}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">
          {phase === 'done' ? 'Import Complete' : 'Import Products'}
        </h1>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-3.5 text-xs text-red-600 font-medium flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* ═══ UPLOAD PHASE ═══ */}
      {phase === 'upload' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {/* Upload area */}
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all',
              dragOver
                ? 'border-violet-400 bg-violet-50'
                : file
                  ? 'border-emerald-300 bg-emerald-50/50'
                  : 'border-gray-200 bg-gray-50/50 hover:border-violet-300 hover:bg-violet-50/50'
            )}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />

            {file ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                  <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="mt-3 text-xs text-red-500 font-medium hover:text-red-600"
                >
                  Remove file
                </button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6 text-violet-600" />
                </div>
                <p className="text-sm font-semibold text-gray-700">
                  Drop CSV file here
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  or click to browse
                </p>
              </>
            )}
          </div>

          {/* Download template */}
          <a
            href="/templates/product-import-template.csv"
            download
            className="flex items-center gap-2.5 px-4 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm text-sm font-medium text-gray-700 active:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4 text-violet-500" />
            <span className="flex-1">Download Template</span>
            <span className="text-[10px] text-gray-400">12 sample products</span>
          </a>

          {/* Column info */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-700 mb-2">Required Columns</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                'name', 'brand', 'costPrice', 'sellingPrice',
              ].map((col) => (
                <span key={col} className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-50 text-red-600 border border-red-100">
                  {col} *
                </span>
              ))}
              {[
                'sku', 'category', 'unit', 'stock', 'lowStockAlert', 'warrantyMonths', 'description',
              ].map((col) => (
                <span key={col} className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                  {col}
                </span>
              ))}
            </div>
          </div>

          {/* Upload button */}
          <button
            onClick={handleUpload}
            disabled={!file}
            className={cn(
              'w-full py-3.5 rounded-2xl text-sm font-semibold shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform',
              file
                ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20'
                : 'bg-gray-100 text-gray-400 shadow-none'
            )}
          >
            <Upload className="w-4 h-4" />
            Parse & Preview
          </button>
        </motion.div>
      )}

      {/* ═══ PREVIEW PHASE ═══ */}
      {phase === 'preview' && result && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {/* Stats */}
          <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm">
            <div className="flex-1 text-center">
              <p className="text-lg font-bold text-emerald-600">{result.validCount}</p>
              <p className="text-[10px] text-gray-400 font-medium">Valid</p>
            </div>
            {result.warningCount > 0 && (
              <div className="flex-1 text-center">
                <p className="text-lg font-bold text-amber-600">{result.warningCount}</p>
                <p className="text-[10px] text-gray-400 font-medium">Warnings</p>
              </div>
            )}
            {result.errorCount > 0 && (
              <div className="flex-1 text-center">
                <p className="text-lg font-bold text-red-500">{result.errorCount}</p>
                <p className="text-[10px] text-gray-400 font-medium">Errors</p>
              </div>
            )}
            <div className="flex-1 text-center">
              <p className="text-lg font-bold text-gray-700">{result.totalRows}</p>
              <p className="text-[10px] text-gray-400 font-medium">Total</p>
            </div>
          </div>

          {/* Row preview table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-semibold text-gray-700">Preview ({result.rows.length} rows)</p>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {result.rows.map((row) => (
                <div
                  key={row.rowIndex}
                  className={cn(
                    'px-4 py-2.5 border-b border-gray-50 last:border-b-0',
                    row.status === 'error' && 'bg-red-50/50',
                    row.status === 'warning' && 'bg-amber-50/50'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400 font-mono w-5 text-right shrink-0">
                          {row.rowIndex}
                        </span>
                        <p className="text-xs font-medium text-gray-900 truncate">
                          {row.data.name || '<no name>'}
                        </p>
                        {row.data.sku && (
                          <span className="text-[9px] font-mono text-gray-400 ml-1 shrink-0">
                            ({row.data.sku})
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5 ml-6.5">
                        {row.data.brand} · {row.data.category || 'No category'} · ৳{(row.data.sellingprice || '0')} · {row.data.stock || '0'} {row.data.unit || 'piece'}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {row.status === 'error' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600">
                          ERROR
                        </span>
                      )}
                      {row.status === 'warning' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-600">
                          WARN
                        </span>
                      )}
                      {row.status === 'valid' && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                    </div>
                  </div>

                  {/* Error/warning messages */}
                  {(row.errors.length > 0 || row.warnings.length > 0) && (
                    <div className="ml-6.5 mt-1 space-y-0.5">
                      {row.errors.map((e, i) => (
                        <p key={i} className="text-[10px] text-red-500 flex items-center gap-1">
                          <X className="w-2.5 h-2.5" />
                          {e}
                        </p>
                      ))}
                      {row.warnings.map((w, i) => (
                        <p key={i} className="text-[10px] text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          {w}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Import button */}
          <button
            onClick={handleImport}
            disabled={result.validCount === 0}
            className={cn(
              'w-full py-3.5 rounded-2xl text-sm font-semibold shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform',
              result.validCount > 0
                ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20'
                : 'bg-gray-100 text-gray-400 shadow-none'
            )}
          >
            <Package className="w-4 h-4" />
            Import {result.validCount} Product{result.validCount !== 1 ? 's' : ''}
          </button>
        </motion.div>
      )}

      {/* ═══ IMPORTING PHASE ═══ */}
      {phase === 'importing' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16"
        >
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin mb-4" />
          <p className="text-sm font-semibold text-gray-700">Importing products...</p>
          <p className="text-xs text-gray-400 mt-1">Please wait</p>
        </motion.div>
      )}

      {/* ═══ DONE PHASE ═══ */}
      {phase === 'done' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-12"
        >
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <p className="text-base font-bold text-gray-900">Import Complete!</p>
          <p className="text-sm text-gray-500 mt-1">{importMsg}</p>

          {importErrors.length > 0 && (
            <div className="mt-4 mx-auto max-w-sm bg-amber-50 border border-amber-100 rounded-2xl p-3.5 text-left">
              <p className="text-xs font-semibold text-amber-700 mb-1">Some batches had issues:</p>
              {importErrors.map((e, i) => (
                <p key={i} className="text-[10px] text-amber-600">{e}</p>
              ))}
            </div>
          )}

          <button
            onClick={goBack}
            className="mt-6 px-6 py-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-semibold shadow-sm"
          >
            Done
          </button>
        </motion.div>
      )}
    </div>
  );
}