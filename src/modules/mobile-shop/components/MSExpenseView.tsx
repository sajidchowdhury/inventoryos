'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  X,
  Trash2,
  CalendarDays,
  Tag,
  Banknote,
  Receipt,
  TrendingDown,
  ChevronDown,
  Loader2,
  Check,
  AlertCircle,
  Home,
  Users,
  Truck,
  Zap,
  MoreHorizontal,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { useMSBusinessId } from '@/modules/mobile-shop/hooks/use-ms-business-id';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

// ── Constants ──

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const CATEGORIES = [
  { key: 'RENT', label: 'Rent', icon: Home, color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { key: 'SALARY', label: 'Salary', icon: Users, color: 'bg-cyan-50 text-cyan-600 border-cyan-200' },
  { key: 'TRANSPORT', label: 'Transport', icon: Truck, color: 'bg-orange-50 text-orange-600 border-orange-200' },
  { key: 'UTILITY', label: 'Utility', icon: Zap, color: 'bg-amber-50 text-amber-600 border-amber-200' },
  { key: 'MISC', label: 'Misc', icon: MoreHorizontal, color: 'bg-gray-50 text-gray-600 border-gray-200' },
] as const;

const PAYMENT_METHODS = [
  { key: 'CASH', label: 'Cash' },
  { key: 'BKASH', label: 'bKash' },
  { key: 'NAGAD', label: 'Nagad' },
  { key: 'ROCKET', label: 'Rocket' },
  { key: 'CARD', label: 'Card' },
  { key: 'BANK_TRANSFER', label: 'Bank' },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]['key'];

// ── Types ──

interface ExpenseRecord {
  id: string;
  date: string;
  category: string;
  amount: number;
  description?: string | null;
  paymentMethod?: string | null;
  reference?: string | null;
  createdAt: string;
}

interface ExpenseStats {
  overallTotal: number;
  overallCount: number;
  thisMonthTotal: number;
  thisMonthCount: number;
  monthlyTotals: Array<{ month: string; total: number }>;
  categoryBreakdown: Array<{ category: string; total: number; count: number }>;
}

// ── Helpers ──

function formatBDT(n: number): string {
  return `৳${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getCategoryConfig(key: string) {
  return CATEGORIES.find((c) => c.key === key) || CATEGORIES[4];
}

// ── Component ──

export function MSExpenseView() {
  const { goBack } = useMSNavStore();
  const businessId = useMSBusinessId();

  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('');

  // Create form state
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formCategory, setFormCategory] = useState<CategoryKey>('RENT');
  const [formAmount, setFormAmount] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMethod, setFormMethod] = useState('CASH');
  const [formReference, setFormReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // ── Fetch ──
  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterCategory) params.set('category', filterCategory);

    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/expenses?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses || []);
        setStats(data.stats || null);
      }
    } catch {
      // handle error
    }
  }, [businessId, filterCategory]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      await fetchData();
      if (mounted) setLoading(false);
    };
    load();
    return () => { mounted = false; };
  }, [fetchData]);

  // ── Submit ──
  const handleSubmit = async () => {
    const amount = parseFloat(formAmount);
    if (!formDate) { setFormError('Date is required'); return; }
    if (isNaN(amount) || amount <= 0) { setFormError('Enter a valid amount'); return; }

    setSubmitting(true);
    setFormError('');

    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formDate,
          category: formCategory,
          amount,
          description: formDescription.trim() || undefined,
          paymentMethod: formMethod,
          reference: formReference.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || 'Failed to create expense');
        setSubmitting(false);
        return;
      }

      // Reset form
      setFormAmount('');
      setFormDescription('');
      setFormReference('');
      setShowForm(false);
      fetchData();
    } catch {
      setFormError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ──
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await fetch(`/api/businesses/${businessId}/mobile-shop/expenses?id=${id}`, { method: 'DELETE' });
      fetchData();
    } catch {
      // handle error
    }
  };

  // ── Derived ──
  const selectedCatConfig = getCategoryConfig(formCategory);

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Expenses</h1>
        <button
          onClick={() => setShowForm(true)}
          className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 active:opacity-90 transition-all"
        >
          <Plus className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* ── Stats cards ── */}
      {!loading && stats && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="grid grid-cols-2 gap-2.5"
        >
          <div className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                <TrendingDown className="w-3.5 h-3.5 text-red-500" />
              </div>
              <p className="text-[10px] text-gray-400 font-medium">This Month</p>
            </div>
            <p className="text-lg font-bold text-gray-900">{formatBDT(stats.thisMonthTotal)}</p>
            <p className="text-[10px] text-gray-400">{stats.thisMonthCount} expense{stats.thisMonthCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-cyan-50 flex items-center justify-center">
                <Banknote className="w-3.5 h-3.5 text-cyan-500" />
              </div>
              <p className="text-[10px] text-gray-400 font-medium">All Time</p>
            </div>
            <p className="text-lg font-bold text-gray-900">{formatBDT(stats.overallTotal)}</p>
            <p className="text-[10px] text-gray-400">{stats.overallCount} total</p>
          </div>
        </motion.div>
      )}

      {/* ── Monthly trend (mini bar chart) ── */}
      {!loading && stats && stats.monthlyTotals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
        >
          <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5" /> 6-Month Trend
          </h3>
          <div className="flex items-end gap-2 h-16">
            {stats.monthlyTotals.map((m, i) => {
              const maxVal = Math.max(...stats.monthlyTotals.map((x) => x.total), 1);
              const heightPct = Math.max((m.total / maxVal) * 100, 4);
              const isCurrentMonth = i === stats.monthlyTotals.length - 1;
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full relative" style={{ height: '48px' }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${heightPct}%` }}
                      transition={{ duration: 0.4, delay: i * 0.05 }}
                      className={`absolute bottom-0 w-full rounded-md ${isCurrentMonth ? 'bg-cyan-500' : 'bg-cyan-200'}`}
                    />
                  </div>
                  <span className="text-[8px] text-gray-400 font-medium whitespace-nowrap">{m.month}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Category filter chips ── */}
      {!loading && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setFilterCategory('')}
            className={`shrink-0 h-8 px-3 rounded-full text-[11px] font-semibold transition-all ${
              !filterCategory
                ? 'bg-cyan-100 text-cyan-700 border border-cyan-200'
                : 'bg-white text-gray-500 border border-gray-200'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setFilterCategory(filterCategory === cat.key ? '' : cat.key)}
              className={`shrink-0 h-8 px-3 rounded-full text-[11px] font-semibold transition-all flex items-center gap-1 ${
                filterCategory === cat.key
                  ? `${cat.color}`
                  : 'bg-white text-gray-500 border border-gray-200'
              }`}
            >
              <cat.icon className="w-3 h-3" />
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Expense list ── */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          ))
        ) : expenses.length === 0 ? (
          <div className="text-center py-12">
            <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-500">No expenses yet</p>
            <p className="text-xs text-gray-400 mt-1">Tap + to add your first expense</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {expenses.map((expense, i) => {
              const catConfig = getCategoryConfig(expense.category);
              const CatIcon = catConfig.icon;
              return (
                <motion.div
                  key={expense.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.25, delay: i * 0.03 } }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${catConfig.color}`}>
                      <CatIcon className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-gray-900">{catConfig.label}</p>
                        {expense.paymentMethod && (
                          <span className="text-[9px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                            {expense.paymentMethod}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <CalendarDays className="w-2.5 h-2.5" />
                        {formatDate(expense.date)}
                        {expense.description && ` · ${expense.description}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-red-600">{formatBDT(expense.amount)}</p>
                      {expense.reference && (
                        <p className="text-[9px] text-gray-400 font-mono mt-0.5">#{expense.reference}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end mt-2 pt-2 border-t border-gray-50">
                    <button
                      onClick={() => handleDelete(expense.id)}
                      className="text-[10px] text-red-400 hover:text-red-600 flex items-center gap-0.5 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* ── Create Form (bottom sheet) ── */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
              onClick={() => setShowForm(false)}
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-white rounded-t-3xl shadow-2xl z-[70] max-h-[90vh] flex flex-col"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-3">
                <h2 className="text-base font-bold text-gray-900">Add Expense</h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Form */}
              <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
                {/* Date */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                    Date
                  </label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full h-11 pl-10 pr-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400 transition-all"
                    />
                  </div>
                </div>

                {/* Category grid */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                    Category
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.key}
                        onClick={() => setFormCategory(cat.key as CategoryKey)}
                        className={`h-14 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${
                          formCategory === cat.key
                            ? `${cat.color} shadow-sm`
                            : 'bg-white border-gray-100 text-gray-500'
                        }`}
                      >
                        <cat.icon className="w-4 h-4" />
                        <span className="text-[9px] font-semibold">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                    Amount (৳)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-semibold">৳</span>
                    <input
                      type="number"
                      value={formAmount}
                      onChange={(e) => { setFormAmount(e.target.value); setFormError(''); }}
                      placeholder="0"
                      autoFocus
                      className="w-full h-12 pl-9 pr-3 rounded-xl bg-gray-50 border border-gray-200 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                {/* Payment method */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m.key}
                        onClick={() => setFormMethod(m.key)}
                        className={`h-10 rounded-xl border-2 text-[11px] font-semibold transition-all flex items-center justify-center ${
                          formMethod === m.key
                            ? 'border-cyan-400 bg-cyan-50 text-cyan-700'
                            : 'border-gray-100 bg-white text-gray-500'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                    Description <span className="text-gray-300 normal-case">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="e.g. Shop rent - March"
                    className="w-full h-11 px-4 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400 transition-all"
                  />
                </div>

                {/* Reference */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                    Reference <span className="text-gray-300 normal-case">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formReference}
                    onChange={(e) => setFormReference(e.target.value)}
                    placeholder="Receipt / Txn No."
                    className="w-full h-11 px-4 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400 transition-all"
                  />
                </div>

                {/* Error */}
                {formError && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="text-xs text-red-600">{formError}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-sm font-bold shadow-lg shadow-cyan-500/20 active:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Add Expense
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}