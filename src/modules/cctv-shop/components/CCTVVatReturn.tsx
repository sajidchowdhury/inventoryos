'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  FileText,
  Calendar,
  Save,
  Download,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Info,
  TrendingUp,
  TrendingDown,
  Landmark,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import type {
  CCTVVatReturn,
  VatReturnCalcResult,
  VatReturnStatus,
  CCTVNbrConfig,
} from '../types';
import { BANGLA_MONTHS, numberToWords } from '../types';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

const STATUS_CONFIG: Record<VatReturnStatus, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  DRAFT: { label: 'Draft', color: 'text-gray-600', bg: 'bg-gray-100', icon: Clock },
  SUBMITTED: { label: 'Submitted', color: 'text-amber-700', bg: 'bg-amber-50', icon: ShieldCheck },
  APPROVED: { label: 'Approved', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle2 },
};

export function CCTVVatReturn() {
  const { goBack } = useCCTVNavStore();
  const businessId = useCctvBusinessId();

  // Date navigation
  const now = new Date();
  const [taxYear, setTaxYear] = useState(now.getFullYear());
  const [taxMonth, setTaxMonth] = useState(now.getMonth() + 1);

  // Data
  const [nbrConfig, setNbrConfig] = useState<CCTVNbrConfig | null>(null);
  const [calculated, setCalculated] = useState<VatReturnCalcResult | null>(null);
  const [savedReturn, setSavedReturn] = useState<CCTVVatReturn | null>(null);
  const [returnsList, setReturnsList] = useState<CCTVVatReturn[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');

  // Editable adjustments
  const [adjustmentAmount, setAdjustmentAmount] = useState('0');
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const [declaredBy, setDeclaredBy] = useState('');

  const monthLabel = BANGLA_MONTHS[taxMonth] || 'Unknown';

  // Navigation helpers
  const goToPrevMonth = () => {
    if (taxMonth === 1) { setTaxYear((y) => y - 1); setTaxMonth(12); }
    else setTaxMonth((m) => m - 1);
  };
  const goToNextMonth = () => {
    if (taxMonth === 12) { setTaxYear((y) => y + 1); setTaxMonth(1); }
    else setTaxMonth((m) => m + 1);
  };
  const goToCurrentMonth = () => {
    setTaxYear(now.getFullYear());
    setTaxMonth(now.getMonth() + 1);
  };

  // Load NBR config
  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/nbr-config`);
      const json = await res.json();
      if (json.success) setNbrConfig(json.data);
    } catch { /* ignore */ }
  }, []);

  // Load VAT return data for selected month
  const loadReturn = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/vat-returns?year=${taxYear}&month=${taxMonth}`);
      const json = await res.json();
      if (json.success) {
        setCalculated(json.data.calculated);
        setSavedReturn(json.data.saved || null);
        // Populate edit fields from saved return
        if (json.data.saved) {
          setAdjustmentAmount(String(json.data.saved.adjustmentAmount || 0));
          setAdjustmentNote(json.data.saved.adjustmentNote || '');
          setDeclaredBy(json.data.saved.declaredBy || '');
        } else {
          setAdjustmentAmount('0');
          setAdjustmentNote('');
          setDeclaredBy('');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [taxYear, taxMonth]);

  // Load returns list
  const loadList = useCallback(async () => {
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/vat-returns`);
      const json = await res.json();
      if (json.success) setReturnsList(json.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => { loadReturn(); }, [loadReturn]);
  useEffect(() => { if (activeTab === 'history') loadList(); }, [activeTab, loadList]);

  // Derived values
  const adjNum = parseFloat(adjustmentAmount) || 0;
  const baseData = calculated || savedReturn;
  const netVatPayable = baseData?.netVatPayable || 0;
  const adjustedNetVat = netVatPayable + adjNum;
  const isRefundable = adjustedNetVat < 0;
  const finalAmount = Math.abs(adjustedNetVat);
  const finalWords = numberToWords(finalAmount);

  // Save / Submit
  const handleSave = async (submit = false) => {
    if (!calculated) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/vat-returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxYear,
          taxMonth,
          ...calculated,
          adjustmentAmount: adjNum,
          adjustmentNote: adjustmentNote || undefined,
          declaredBy: declaredBy || undefined,
          status: submit ? 'SUBMITTED' : 'DRAFT',
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSavedReturn(json.data);
        setToast(submit ? 'Return submitted successfully' : 'Return saved as draft');
        setTimeout(() => setToast(null), 3000);
        loadList();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Delete draft
  const handleDelete = async () => {
    if (!savedReturn || savedReturn.status !== 'DRAFT') return;
    if (!confirm('Delete this draft VAT return?')) return;
    try {
      await fetch(`/api/businesses/${businessId}/cctv/vat-returns/${savedReturn.id}`, { method: 'DELETE' });
      setSavedReturn(null);
      setAdjustmentAmount('0');
      setAdjustmentNote('');
      setDeclaredBy('');
      setToast('Draft deleted');
      setTimeout(() => setToast(null), 3000);
      loadList();
    } catch (err) {
      console.error(err);
    }
  };

  // Navigate to a return from history
  const navigateToReturn = (r: CCTVVatReturn) => {
    setTaxYear(r.taxYear);
    setTaxMonth(r.taxMonth);
    setActiveTab('form');
  };

  // Export CSV
  const handleExportCSV = () => {
    const rows: string[][] = [];
    rows.push(['Mushak 9.1 - Monthly VAT Return']);
    rows.push(['Tax Period:', `${BANGLA_MONTHS[taxMonth]} ${taxYear}`]);
    rows.push(['BIN:', nbrConfig?.bin || 'N/A']);
    rows.push(['Business:', nbrConfig?.legalName || 'N/A']);
    rows.push([]);
    rows.push(['Section', 'Description', 'Amount (BDT)']);
    rows.push(['A', 'Opening Input Tax Credit', String(calculated?.openingCredit || 0)]);
    rows.push(['B', 'Local Purchase Tax Credit', String(calculated?.localPurchaseCredit || 0)]);
    rows.push(['B', 'Local Purchase Value', String(calculated?.localPurchaseValue || 0)]);
    rows.push(['B', 'Number of Purchases', String(calculated?.localPurchaseCount || 0)]);
    rows.push(['C', 'Import Tax Credit', String(calculated?.importCredit || 0)]);
    rows.push(['D', 'Total Input Tax Credit (A+B+C)', String(calculated?.totalInputCredit || 0)]);
    rows.push(['E', 'Output Tax (VAT Collected)', String(calculated?.outputTax || 0)]);
    rows.push(['E', 'Sales Value', String(calculated?.salesValue || 0)]);
    rows.push(['E', 'Number of Sales Invoices', String(calculated?.salesCount || 0)]);
    rows.push(['F', 'Net VAT Payable / (Refundable)', String(adjustedNetVat.toFixed(2))]);
    rows.push(['G', 'Adjustment', String(adjNum)]);
    rows.push(['G', 'Adjustment Note', adjustmentNote || 'N/A']);
    rows.push(['', 'Adjusted Net VAT', String(adjustedNetVat.toFixed(2))]);
    rows.push([]);
    rows.push(['Amount in Words:', finalWords]);

    const csvContent = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Mushak_9.1_VAT_Return_${taxYear}_${String(taxMonth).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatBDT = (n: number) => `৳${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatInt = (n: number) => n.toLocaleString();
  const isCurrentMonth = taxYear === now.getFullYear() && taxMonth === now.getMonth() + 1;
  const isFutureMonth = new Date(taxYear, taxMonth - 1, 1) > now;
  const statusMeta = savedReturn ? STATUS_CONFIG[savedReturn.status] : null;
  const StatusIcon = statusMeta?.icon || Clock;

  return (
    <div className="px-4 pb-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-4 right-4 z-50 bg-emerald-600 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div variants={fadeUp} initial="initial" animate="animate" className="flex items-center gap-3 mb-5">
        <button onClick={goBack} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">Mushak 9.1</h1>
          <p className="text-xs text-gray-500">Monthly VAT Return</p>
        </div>
        <button
          onClick={() => setActiveTab(activeTab === 'form' ? 'history' : 'form')}
          className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'history'
              ? 'bg-violet-100 text-violet-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {activeTab === 'form' ? 'History' : 'Form'}
        </button>
      </motion.div>

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        <motion.div variants={fadeUp} initial="initial" animate="animate">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-800">Return History</h2>
            <span className="text-[10px] text-gray-400">{returnsList.length} records</span>
          </div>

          {returnsList.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-700">No VAT Returns</p>
              <p className="text-xs text-gray-400 mt-1">Saved returns will appear here</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {returnsList.map((r) => {
                const meta = STATUS_CONFIG[r.status];
                const SIcon = meta.icon;
                return (
                  <button
                    key={r.id}
                    onClick={() => navigateToReturn(r)}
                    className="w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-left hover:border-violet-200 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-gray-900">
                        {BANGLA_MONTHS[r.taxMonth]} {r.taxYear}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.bg} ${meta.color}`}>
                        <SIcon className="w-3 h-3" />
                        {meta.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <p className="text-gray-400">Output Tax</p>
                        <p className="font-semibold text-gray-800">{formatBDT(r.outputTax)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Input Credit</p>
                        <p className="font-semibold text-gray-800">{formatBDT(r.totalInputCredit)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Net {r.adjustedNetVat < 0 ? 'Refund' : 'Payable'}</p>
                        <p className={`font-bold ${r.adjustedNetVat >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {formatBDT(Math.abs(r.adjustedNetVat))}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* ── FORM TAB ── */}
      {activeTab === 'form' && (
        <>
          {/* Month Navigator */}
          <motion.div variants={fadeUp} initial="initial" animate="animate" className="flex items-center gap-2 mb-4">
            <button onClick={goToPrevMonth} className="p-2 rounded-xl bg-white border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <div className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-2.5 text-center">
              <p className="text-sm font-bold text-gray-900">{monthLabel} {taxYear}</p>
              {isCurrentMonth && (
                <p className="text-[10px] text-violet-600 font-semibold">Current Month</p>
              )}
            </div>
            <button
              onClick={goToNextMonth}
              disabled={isCurrentMonth}
              className="p-2 rounded-xl bg-white border border-gray-100 shadow-sm hover:bg-gray-50 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </motion.div>

          {/* NBR Config Warning */}
          {!nbrConfig?.bin && (
            <motion.div variants={fadeUp} initial="initial" animate="animate" className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-100 mb-4">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-800">BIN not configured</p>
                <p className="text-[11px] text-amber-600 mt-0.5">Set up your BIN in NBR & Tax Setup before filing VAT returns.</p>
              </div>
            </motion.div>
          )}

          {/* Loading */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Business & BIN Info Card */}
              <motion.div variants={fadeUp} initial="initial" animate="animate" className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Landmark className="w-4 h-4 text-violet-500" />
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Taxpayer Info</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <p className="text-gray-400">BIN</p>
                    <p className="font-mono font-bold text-gray-900">{nbrConfig?.bin || 'Not Set'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Business Name</p>
                    <p className="font-semibold text-gray-900 truncate">{nbrConfig?.legalName || 'Not Set'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-400">Address</p>
                    <p className="font-medium text-gray-800">{nbrConfig?.legalAddress || 'Not Set'}</p>
                  </div>
                </div>
              </motion.div>

              {/* Status Badge */}
              {savedReturn && (
                <motion.div variants={fadeUp} initial="initial" animate="animate" className="flex items-center justify-between mb-4">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${statusMeta!.bg} ${statusMeta!.color}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {statusMeta!.label}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {savedReturn.updatedAt ? new Date(savedReturn.updatedAt).toLocaleString('en-BD') : ''}
                  </span>
                </motion.div>
              )}

              {/* ═══ Mushak 9.1 Form Sections ═══ */}

              {/* Section A: Opening Credit */}
              <motion.div variants={fadeUp} initial="initial" animate="animate" className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-3 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-sky-50 to-white border-b border-gray-50">
                  <span className="w-6 h-6 rounded-lg bg-sky-100 flex items-center justify-center text-[10px] font-bold text-sky-700">A</span>
                  <h3 className="text-xs font-bold text-gray-800">Opening Input Tax Credit</h3>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[10px] text-gray-400 mb-1">Carried forward from previous month</p>
                  <p className="text-lg font-bold text-gray-900 text-right">{formatBDT(calculated?.openingCredit || 0)}</p>
                </div>
              </motion.div>

              {/* Section B: Local Purchase Credit */}
              <motion.div variants={fadeUp} initial="initial" animate="animate" className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-3 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-50 to-white border-b border-gray-50">
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700">B</span>
                  <h3 className="text-xs font-bold text-gray-800">Tax Credit on Local Purchase</h3>
                </div>
                <div className="px-4 py-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">Purchase Value</span>
                    <span className="text-sm font-semibold text-gray-900">{formatBDT(calculated?.localPurchaseValue || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">Number of Purchases</span>
                    <span className="text-sm font-semibold text-gray-900">{formatInt(calculated?.localPurchaseCount || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-xs font-bold text-gray-700">VAT Credit (Input)</span>
                    <span className="text-base font-bold text-emerald-700">{formatBDT(calculated?.localPurchaseCredit || 0)}</span>
                  </div>
                </div>
              </motion.div>

              {/* Section C: Import Credit */}
              <motion.div variants={fadeUp} initial="initial" animate="animate" className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-3 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-50 to-white border-b border-gray-50">
                  <span className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-700">C</span>
                  <h3 className="text-xs font-bold text-gray-800">Tax Credit on Import</h3>
                </div>
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-3.5 h-3.5 text-amber-500" />
                    <p className="text-[10px] text-gray-400">Import credit is not applicable for local CCTV shops</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700">Import VAT Credit</span>
                    <span className="text-sm font-semibold text-gray-500">{formatBDT(0)}</span>
                  </div>
                </div>
              </motion.div>

              {/* Section D: Total Input Tax Credit */}
              <motion.div variants={fadeUp} initial="initial" animate="animate" className="bg-white rounded-2xl border-2 border-violet-200 shadow-sm mb-3 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-50 to-white">
                  <span className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center text-[10px] font-bold text-violet-700">D</span>
                  <h3 className="text-xs font-bold text-violet-800">Total Input Tax Credit (A+B+C)</h3>
                </div>
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">Sum of all input credits</span>
                  <span className="text-xl font-bold text-violet-700">{formatBDT(calculated?.totalInputCredit || 0)}</span>
                </div>
              </motion.div>

              {/* Section E: Output Tax */}
              <motion.div variants={fadeUp} initial="initial" animate="animate" className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-3 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-rose-50 to-white border-b border-gray-50">
                  <span className="w-6 h-6 rounded-lg bg-rose-100 flex items-center justify-center text-[10px] font-bold text-rose-700">E</span>
                  <h3 className="text-xs font-bold text-gray-800">Output Tax (VAT Collected)</h3>
                </div>
                <div className="px-4 py-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">Sales Value (excl. VAT)</span>
                    <span className="text-sm font-semibold text-gray-900">{formatBDT(calculated?.salesValue || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">Number of Tax Invoices</span>
                    <span className="text-sm font-semibold text-gray-900">{formatInt(calculated?.salesCount || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-xs font-bold text-gray-700">Total VAT Collected</span>
                    <span className="text-base font-bold text-rose-700">{formatBDT(calculated?.outputTax || 0)}</span>
                  </div>
                </div>
              </motion.div>

              {/* Section F: Net VAT */}
              <motion.div variants={fadeUp} initial="initial" animate="animate" className={`rounded-2xl border-2 shadow-sm mb-3 overflow-hidden ${
                adjustedNetVat >= 0 ? 'border-rose-200 bg-gradient-to-r from-rose-50 to-white' : 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-white'
              }`}>
                <div className="flex items-center gap-2 px-4 py-3">
                  <span className="w-6 h-6 rounded-lg bg-gray-800 flex items-center justify-center text-[10px] font-bold text-white">F</span>
                  <h3 className="text-xs font-bold text-gray-800">Net VAT</h3>
                  {isRefundable ? (
                    <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <TrendingDown className="w-3 h-3" /> Refundable
                    </span>
                  ) : (
                    <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                      <TrendingUp className="w-3 h-3" /> Payable
                    </span>
                  )}
                </div>
                <div className="px-4 py-3 text-right">
                  <p className={`text-2xl font-bold ${adjustedNetVat >= 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {adjustedNetVat < 0 ? '(' : ''}{formatBDT(finalAmount)}{adjustedNetVat < 0 ? ')' : ''}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 italic">{finalWords}</p>
                </div>
              </motion.div>

              {/* Section G: Adjustments */}
              <motion.div variants={fadeUp} initial="initial" animate="animate" className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-50">
                  <span className="w-6 h-6 rounded-lg bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-700">G</span>
                  <h3 className="text-xs font-bold text-gray-800">Adjustments</h3>
                </div>
                <div className="px-4 py-3 space-y-3">
                  <div>
                    <label className="text-[10px] text-gray-500 font-medium block mb-1">Adjustment Amount (BDT)</label>
                    <input
                      type="number"
                      value={adjustmentAmount}
                      onChange={(e) => setAdjustmentAmount(e.target.value)}
                      disabled={savedReturn?.status === 'SUBMITTED' || savedReturn?.status === 'APPROVED'}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 disabled:bg-gray-50 disabled:text-gray-400 transition-all"
                      placeholder="0.00"
                    />
                    <p className="text-[9px] text-gray-400 mt-1">Use negative for decrease, positive for increase</p>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-medium block mb-1">Adjustment Note</label>
                    <input
                      type="text"
                      value={adjustmentNote}
                      onChange={(e) => setAdjustmentNote(e.target.value)}
                      disabled={savedReturn?.status === 'SUBMITTED' || savedReturn?.status === 'APPROVED'}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 disabled:bg-gray-50 disabled:text-gray-400 transition-all"
                      placeholder="Reason for adjustment (optional)"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-medium block mb-1">Declared By</label>
                    <input
                      type="text"
                      value={declaredBy}
                      onChange={(e) => setDeclaredBy(e.target.value)}
                      disabled={savedReturn?.status === 'SUBMITTED' || savedReturn?.status === 'APPROVED'}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 disabled:bg-gray-50 disabled:text-gray-400 transition-all"
                      placeholder="Name of authorized person"
                    />
                  </div>
                </div>
              </motion.div>

              {/* Summary Card */}
              <motion.div variants={fadeUp} initial="initial" animate="animate" className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-4 shadow-lg shadow-violet-500/20 mb-4">
                <h3 className="text-xs font-bold text-violet-200 uppercase tracking-wider mb-3">Return Summary</h3>
                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between text-white">
                    <span className="text-violet-200">Period</span>
                    <span className="font-semibold">{monthLabel} {taxYear}</span>
                  </div>
                  <div className="flex justify-between text-white">
                    <span className="text-violet-200">Total Input Credit (D)</span>
                    <span className="font-semibold">{formatBDT(calculated?.totalInputCredit || 0)}</span>
                  </div>
                  <div className="flex justify-between text-white">
                    <span className="text-violet-200">Output Tax (E)</span>
                    <span className="font-semibold">{formatBDT(calculated?.outputTax || 0)}</span>
                  </div>
                  <div className="flex justify-between text-white">
                    <span className="text-violet-200">Adjustment (G)</span>
                    <span className="font-semibold">{formatBDT(adjNum)}</span>
                  </div>
                  <div className="border-t border-violet-400/40 pt-2 mt-2">
                    <div className="flex justify-between text-white">
                      <span className="font-bold">Net {adjustedNetVat >= 0 ? 'Payable' : 'Refundable'}</span>
                      <span className="text-lg font-bold">
                        {adjustedNetVat < 0 ? '(' : ''}{formatBDT(finalAmount)}{adjustedNetVat < 0 ? ')' : ''}
                      </span>
                    </div>
                    <p className="text-[10px] text-violet-200 text-right italic mt-0.5">{finalWords}</p>
                  </div>
                </div>
              </motion.div>

              {/* Action Buttons */}
              <motion.div variants={fadeUp} initial="initial" animate="animate" className="flex gap-2.5">
                {/* Refresh */}
                <button
                  onClick={() => { loadReturn(); loadConfig(); }}
                  className="p-3 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  title="Recalculate"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>

                {/* Export CSV */}
                <button
                  onClick={handleExportCSV}
                  className="p-3 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  title="Export CSV"
                >
                  <Download className="w-4 h-4" />
                </button>

                {/* Delete Draft */}
                {savedReturn?.status === 'DRAFT' && (
                  <button
                    onClick={handleDelete}
                    className="p-3 rounded-xl bg-white border border-gray-200 text-red-500 hover:bg-red-50 transition-colors"
                    title="Delete Draft"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                {/* Save Draft */}
                {!savedReturn?.status || savedReturn?.status === 'DRAFT' ? (
                  <>
                    <button
                      onClick={() => handleSave(false)}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save Draft'}
                    </button>
                    <button
                      onClick={() => handleSave(true)}
                      disabled={saving || !nbrConfig?.bin}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-semibold shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 disabled:opacity-50 transition-all"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {saving ? 'Submitting...' : 'Submit'}
                    </button>
                  </>
                ) : (
                  <div className="flex-1 text-center py-3 text-xs text-gray-400 font-medium">
                    This return has been {savedReturn.status.toLowerCase()}
                  </div>
                )}
              </motion.div>

              {/* Footer note */}
              <motion.div variants={fadeUp} initial="initial" animate="animate" className="mt-4 text-center">
                <p className="text-[10px] text-gray-400">
                  Mushak 9.1 — Monthly VAT Return (Section 50, VAT & SD Act 2012)
                </p>
                <p className="text-[9px] text-gray-300 mt-0.5">
                  Auto-calculated from Mushak 6.1 (Purchase) & Mushak 6.3 (Sales) registers
                </p>
              </motion.div>
            </>
          )}
        </>
      )}
    </div>
  );
}