'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Upload, FileText, Loader2, CheckCircle2, X, Download,
  AlertCircle, FileSpreadsheet,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

interface CSVRow {
  rowIndex: number;
  data: Record<string, string>;
  errors: string[];
  warnings: string[];
  status: 'valid' | 'warning' | 'error';
}

export function CCTVImportProducts() {
  const { goBack } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [rows, setRows] = useState<CSVRow[]>([]);
  const [importResult, setImportResult] = useState<any>(null);
  const [parsing, setParsing] = useState(false);

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast({ title: 'Invalid file', description: 'Please upload a .csv file', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 5MB', variant: 'destructive' });
      return;
    }
    setCsvFile(file);
    parseCSV(file);
  };

  const parseCSV = async (file: File) => {
    setParsing(true);
    const text = await file.text();
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/products/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'parse', csvText: text }),
      });
      const data = await res.json();
      if (data.success || data.rows) {
        setRows(data.rows || []);
        setStage('preview');
      } else {
        toast({ title: data.error || 'Parse failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    setStage('importing');
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/products/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import', rows }),
      });
      const data = await res.json();
      setImportResult(data);
      setStage('done');
      if (data.success) {
        toast({ title: `Imported ${data.importedCount} products` });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
      setStage('preview');
    }
  };

  const reset = () => {
    setStage('upload');
    setCsvFile(null);
    setRows([]);
    setImportResult(null);
  };

  const validCount = rows.filter(r => r.status === 'valid').length;
  const warningCount = rows.filter(r => r.status === 'warning').length;
  const errorCount = rows.filter(r => r.status === 'error').length;

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      <div className="flex items-center gap-3 pt-1">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Import Products</h1>
      </div>

      {stage === 'upload' && (
        <>
          <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4">
            <h3 className="text-sm font-bold text-blue-800 mb-1">How it works</h3>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
              <li>Download the CSV template</li>
              <li>Fill in your product details (name, brand, price, stock, etc.)</li>
              <li>Upload the file — we will preview and validate</li>
              <li>Confirm to import all products at once</li>
            </ol>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <a
              href="/templates/product-import-template.csv"
              download
              className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
                <Download className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-800">Download Template</p>
                <p className="text-xs text-emerald-600">CSV file with sample columns</p>
              </div>
            </a>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center hover:border-violet-300 hover:bg-violet-50/30 transition-colors cursor-pointer"
            >
              {parsing ? (
                <Loader2 className="w-10 h-10 text-violet-400 mx-auto mb-2 animate-spin" />
              ) : (
                <Upload className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              )}
              <p className="text-sm font-medium text-gray-700">
                {parsing ? 'Parsing...' : 'Click to upload CSV file'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Max 5MB · .csv only</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />
          </div>

          {/* Column reference */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <h3 className="text-xs font-bold text-gray-700 mb-2">CSV Columns</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { name: 'name', req: true, desc: 'Product name' },
                { name: 'brand', req: true, desc: 'Brand/manufacturer' },
                { name: 'sku', req: false, desc: 'Product code' },
                { name: 'category', req: false, desc: 'Category name' },
                { name: 'costPrice', req: true, desc: 'Buy price (৳)' },
                { name: 'sellingPrice', req: true, desc: 'Sell price (৳)' },
                { name: 'stock', req: false, desc: 'Current stock' },
                { name: 'warrantyMonths', req: false, desc: 'Warranty period' },
                { name: 'serialTracked', req: false, desc: 'true/false' },
                { name: 'unit', req: false, desc: 'piece/box/etc' },
              ].map((col) => (
                <div key={col.name} className="flex items-center gap-1.5">
                  <span className="font-mono font-semibold text-violet-600">{col.name}</span>
                  {col.req && <span className="text-[9px] text-red-500">*</span>}
                  <span className="text-gray-400 text-[10px]">— {col.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {stage === 'preview' && (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">{csvFile?.name}</p>
                <p className="text-xs text-gray-400">{rows.length} rows found</p>
              </div>
              <button onClick={reset} className="text-xs text-gray-500 hover:text-red-500">
                Choose different file
              </button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-emerald-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-emerald-600">{validCount}</p>
                <p className="text-[10px] text-emerald-700">Valid</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-amber-600">{warningCount}</p>
                <p className="text-[10px] text-amber-700">Warnings</p>
              </div>
              <div className="bg-red-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-red-600">{errorCount}</p>
                <p className="text-[10px] text-red-700">Errors</p>
              </div>
            </div>
          </div>

          {/* Preview table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left font-semibold text-gray-700">#</th>
                    <th className="p-2 text-left font-semibold text-gray-700">Name</th>
                    <th className="p-2 text-left font-semibold text-gray-700">Brand</th>
                    <th className="p-2 text-right font-semibold text-gray-700">Cost</th>
                    <th className="p-2 text-right font-semibold text-gray-700">Sell</th>
                    <th className="p-2 text-center font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className={cn(
                      'border-b border-gray-50',
                      row.status === 'error' ? 'bg-red-50/50' : row.status === 'warning' ? 'bg-amber-50/50' : ''
                    )}>
                      <td className="p-2 text-gray-400">{i + 1}</td>
                      <td className="p-2 text-gray-800">{row.data.name || '—'}</td>
                      <td className="p-2 text-gray-600">{row.data.brand || '—'}</td>
                      <td className="p-2 text-right text-gray-600">{row.data.costPrice || '—'}</td>
                      <td className="p-2 text-right text-gray-600">{row.data.sellingPrice || '—'}</td>
                      <td className="p-2 text-center">
                        {row.status === 'valid' && <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />}
                        {row.status === 'warning' && <AlertCircle className="w-4 h-4 text-amber-500 mx-auto" />}
                        {row.status === 'error' && <X className="w-4 h-4 text-red-500 mx-auto" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={handleImport}
            disabled={validCount === 0}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            Import {validCount + warningCount} Products
          </button>
        </>
      )}

      {stage === 'importing' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
          <Loader2 className="w-10 h-10 text-violet-400 mx-auto mb-3 animate-spin" />
          <p className="text-sm font-medium text-gray-700">Importing products...</p>
          <p className="text-xs text-gray-400 mt-1">Please wait</p>
        </div>
      )}

      {stage === 'done' && importResult && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <p className="text-base font-bold text-gray-900">Import Complete!</p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-emerald-600">{importResult.importedCount || 0}</p>
              <p className="text-xs text-emerald-700">Imported</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-amber-600">{importResult.skippedCount || 0}</p>
              <p className="text-xs text-amber-700">Skipped</p>
            </div>
          </div>
          <button
            onClick={() => goBack()}
            className="mt-4 w-full h-11 rounded-xl bg-violet-500 text-white font-semibold text-sm"
          >
            Back to Products
          </button>
        </div>
      )}
    </motion.div>
  );
}
