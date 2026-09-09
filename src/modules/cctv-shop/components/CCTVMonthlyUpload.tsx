'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Loader2, Download, Upload, FileSpreadsheet,
  CheckCircle2, AlertCircle, TrendingUp, TrendingDown,
  Package, Receipt, Users, Building2, Calculator, Calendar,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

function formatBDT(n: number): string {
  return `\u09F3${n.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CCTVMonthlyUpload() {
  const { goBack } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleDownload = async () => {
    if (!businessId) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/monthly-upload`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cctv-monthly-upload-template-${new Date().toISOString().slice(0, 7)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast({ title: 'Template downloaded', description: 'Fill in the yellow-highlighted cells and upload' });
      } else {
        toast({ title: 'Failed to download', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!businessId) return;
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/businesses/${businessId}/cctv/monthly-upload`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data.summary);
        toast({
          title: 'Upload complete',
          description: `${data.summary.records.salesCreated} sales, ${data.summary.records.purchasesCreated} purchases, ${data.summary.records.expensesCreated} expenses created`,
        });
      } else {
        const data = await res.json();
        toast({ title: data.error || 'Upload failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Monthly Bulk Upload</h1>
      </div>

      {/* How it works */}
      <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Calculator className="w-5 h-5" /> Auto-Calculation System
        </h2>
        <p className="text-sm text-white/80 mt-1">
          Download the Excel template with your current data pre-filled. Fill in the month's
          sales, purchases, expenses, and payments. Upload it back — the system auto-creates
          all records and calculates your monthly P&L automatically.
        </p>
      </div>

      {/* Step 1: Download */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-violet-600">1</span>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-800">Download Excel Template</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Pre-filled with your products, customers, suppliers, and current balances.
              The template has 5 data sheets + instructions.
            </p>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="mt-3 h-10 px-5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-semibold flex items-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloading ? 'Generating...' : 'Download Excel Template'}
            </button>
          </div>
        </div>
      </div>

      {/* Step 2: Fill in data */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-blue-600">2</span>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-800">Fill in the Yellow Cells</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Open the Excel file and fill in the yellow-highlighted cells:
            </p>
            <ul className="text-xs text-gray-500 mt-2 space-y-1">
              <li className="flex items-center gap-1.5"><Package className="w-3 h-3 text-violet-400" /> Products sheet: monthly sold qty + purchased qty</li>
              <li className="flex items-center gap-1.5"><Receipt className="w-3 h-3 text-red-400" /> Expenses sheet: amount, method, payee for each expense</li>
              <li className="flex items-center gap-1.5"><Calculator className="w-3 h-3 text-emerald-400" /> Financial Summary: opening balance, estimated revenue, retained earnings</li>
              <li className="flex items-center gap-1.5"><Users className="w-3 h-3 text-blue-400" /> Customers sheet: payment received amounts</li>
              <li className="flex items-center gap-1.5"><Building2 className="w-3 h-3 text-amber-400" /> Suppliers sheet: payment made amounts</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Step 3: Upload */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-emerald-600">3</span>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-800">Upload & Auto-Calculate</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Upload the filled Excel file. The system will:
            </p>
            <ul className="text-xs text-gray-500 mt-2 space-y-0.5">
              <li>• Create sales from the Products sheet (sold qty)</li>
              <li>• Create purchases from the Products sheet (purchased qty)</li>
              <li>• Create expenses from the Expenses sheet</li>
              <li>• Create payments from the Customers & Suppliers sheets</li>
              <li>• Update stock levels automatically</li>
              <li>• Calculate monthly P&L: Revenue − COGS − Expenses = Net Profit</li>
              <li>• Carry forward closing balance to next month</li>
            </ul>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="mt-3 h-10 px-5 rounded-xl bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Processing...' : 'Upload & Calculate'}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          {/* Success banner */}
          <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-800">Upload Complete for {result.month}</p>
              <p className="text-xs text-emerald-600">
                {result.records.salesCreated} sales · {result.records.purchasesCreated} purchases · {result.records.expensesCreated} expenses · {result.records.customerPaymentsCreated} customer payments · {result.records.supplierPaymentsCreated} supplier payments
              </p>
            </div>
          </div>

          {/* P&L Summary */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-violet-500" />
                Monthly P&L — {result.month}
              </h3>
            </div>
            <div className="divide-y divide-gray-50">
              <SummaryRow label="Opening Balance" value={result.calculations.openingBalance} />
              <SummaryRow label="Sales Revenue (Actual)" value={result.calculations.totalSalesRevenue} positive />
              <SummaryRow label="COGS (Cost of Goods Sold)" value={result.calculations.totalCOGS} negative />
              <SummaryRow label="Gross Profit" value={result.calculations.grossProfit} bold />
              <SummaryRow label="Total Expenses" value={result.calculations.totalExpenses} negative />
              <SummaryRow label="Net Profit" value={result.calculations.netProfit} bold positive={result.calculations.netProfit >= 0} />
              <SummaryRow label="Total Purchases (Investment)" value={result.calculations.totalPurchases} negative />
              <SummaryRow label="Estimated Revenue" value={result.calculations.estimatedRevenue} />
              <SummaryRow label="Retained Earnings" value={result.calculations.retainedEarnings} />
              <SummaryRow label="Closing Balance" value={result.calculations.closingBalance} bold />
            </div>
          </div>

          {/* Investor info */}
          {result.calculations.investorName && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-xs font-bold text-gray-700 mb-2">Investor / Owner</h3>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-gray-400">Name</p>
                  <p className="font-semibold text-gray-800">{result.calculations.investorName}</p>
                </div>
                <div>
                  <p className="text-gray-400">Share %</p>
                  <p className="font-semibold text-gray-800">{result.calculations.investorShare}%</p>
                </div>
                <div>
                  <p className="text-gray-400">Withdrawal</p>
                  <p className="font-semibold text-gray-800">{formatBDT(result.calculations.investorWithdrawal || 0)}</p>
                </div>
              </div>
              {result.calculations.investorShare > 0 && result.calculations.netProfit !== 0 && (
                <div className="mt-3 p-2 bg-violet-50 rounded-lg text-xs">
                  <p className="text-violet-700">
                    Investor's share of net profit: <strong>{formatBDT(result.calculations.netProfit * result.calculations.investorShare / 100)}</strong>
                  </p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

function SummaryRow({ label, value, bold, positive, negative }: {
  label: string; value: number; bold?: boolean; positive?: boolean; negative?: boolean;
}) {
  return (
    <div className={cn('flex items-center justify-between px-4 py-2.5', bold && 'bg-gray-50')}>
      <span className={cn('text-xs', bold ? 'font-bold text-gray-800' : 'text-gray-600')}>{label}</span>
      <span className={cn(
        'text-xs font-semibold',
        bold && 'text-sm',
        positive && 'text-emerald-600',
        negative && 'text-red-600',
        !positive && !negative && (bold ? 'text-gray-900' : 'text-gray-700'),
      )}>
        {formatBDT(value)}
      </span>
    </div>
  );
}
