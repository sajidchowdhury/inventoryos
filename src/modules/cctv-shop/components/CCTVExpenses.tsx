'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Plus, Loader2, Receipt, Trash2, X, Calendar,
  Paperclip, User, ExternalLink,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { PaymentMethodSelector } from './PaymentMethodSelector';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

// EX-5: the starter CATEGORIES list. The API now accepts any string
// (so shops can add "marketing", "legal", etc. without code changes),
// but the form dropdown still offers these as defaults. Custom
// categories discovered in the loaded expenses are merged in below.
const STARTER_CATEGORIES = [
  { value: 'rent', label: 'Rent' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'transport', label: 'Transport' },
  { value: 'salary', label: 'Salary' },
  { value: 'tea', label: 'Tea/Snacks' },
  { value: 'phone', label: 'Phone/Internet' },
  { value: 'other', label: 'Other' },
];

// Color for an expense category badge. Falls back to a violet default
// for EX-5 custom categories that aren't in the starter list.
const CATEGORY_COLORS: Record<string, string> = {
  rent: 'bg-purple-50 text-purple-600',
  electricity: 'bg-amber-50 text-amber-600',
  transport: 'bg-blue-50 text-blue-600',
  salary: 'bg-emerald-50 text-emerald-600',
  tea: 'bg-orange-50 text-orange-600',
  phone: 'bg-cyan-50 text-cyan-600',
  other: 'bg-gray-100 text-gray-600',
};
const defaultCategoryColor = 'bg-violet-50 text-violet-600';

function formatBDT(n: number): string {
  return `\u09F3${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Pretty-print a category — known ones get their human label, unknown
// ones are title-cased. Used in the form dropdown + the list badge.
function prettyCategory(value: string): string {
  const known = STARTER_CATEGORIES.find((c) => c.value === value);
  if (known) return known.label;
  // Custom categories (EX-5): show as entered, but title-cased for the badge
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function CCTVExpenses() {
  const { goBack } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const { toast } = useToast();

  const [expenses, setExpenses] = useState<any[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // EX-4: filter state. Empty strings mean "no filter" — the GET
  // endpoint treats them as absent (backward compatible with the
  // previous unfiltered call).
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // EX-5: custom category input — when the user picks "Custom..." in
  // the dropdown, show a free-text input below it.
  const [customCategoryMode, setCustomCategoryMode] = useState(false);

  const [form, setForm] = useState({
    category: 'rent',
    customCategory: '',
    description: '',
    amount: '',
    expenseDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'cash',
    paidTo: '',         // EX-7
    attachmentUrl: '',  // EX-8
  });

  // EX-5: merge starter categories with any custom ones discovered in
  // the loaded expenses (so a shop that previously created "marketing"
  // expenses sees "marketing" in both the filter dropdown and the form
  // dropdown without having to type it again).
  const allCategories = useMemo(() => {
    const fromData = new Set<string>();
    for (const e of expenses) fromData.add(e.category);
    // Anything not in STARTER_CATEGORIES gets added as a custom entry
    const customs: { value: string; label: string }[] = [];
    for (const c of fromData) {
      if (!STARTER_CATEGORIES.some((s) => s.value === c)) {
        customs.push({ value: c, label: prettyCategory(c) });
      }
    }
    return [...STARTER_CATEGORIES, ...customs];
  }, [expenses]);

  // Build the query string from the active filters.
  const buildFilterQuery = (from: string, to: string, category: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (category) params.set('category', category);
    return params.toString();
  };

  // (Re)load expenses whenever the businessId or any filter changes.
  const loadExpenses = (fromOverride?: string, toOverride?: string, catOverride?: string) => {
    if (!businessId) return;
    setLoading(true);
    const q = buildFilterQuery(
      fromOverride ?? filterFrom,
      toOverride ?? filterTo,
      catOverride ?? filterCategory,
    );
    const url = `/api/businesses/${businessId}/cctv/expenses${q ? `?${q}` : ''}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setExpenses(data.expenses || []);
        setTotalAmount(data.totalAmount || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  // EX-4: re-fetch when any filter changes (debounced via useEffect deps).
  useEffect(() => {
    if (!businessId) return;
    loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterFrom, filterTo, filterCategory]);

  const clearFilters = () => {
    setFilterFrom('');
    setFilterTo('');
    setFilterCategory('');
  };

  const hasActiveFilter = !!(filterFrom || filterTo || filterCategory);

  const handleSubmit = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast({ title: 'Error', description: 'Amount must be greater than 0', variant: 'destructive' });
      return;
    }
    // EX-5: if custom mode is on, the actual category is the typed value
    // (trimmed). If empty, fall back to "other" so we don't store "".
    const finalCategory = customCategoryMode
      ? (form.customCategory.trim() || 'other')
      : form.category;

    // EX-8: light client-side URL validation (mirrors backend).
    if (form.attachmentUrl && !/^https?:\/\//i.test(form.attachmentUrl.trim())) {
      toast({
        title: 'Invalid attachment URL',
        description: 'Must start with http:// or https://',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: finalCategory,
          description: form.description || null,
          amount: form.amount,
          expenseDate: form.expenseDate,
          paymentMethod: form.paymentMethod,
          paidTo: form.paidTo || null,        // EX-7
          attachmentUrl: form.attachmentUrl || null, // EX-8
        }),
      });
      if (res.ok) {
        toast({ title: 'Expense recorded' });
        setShowForm(false);
        // Reset form, keep the category pick to make repeated entries faster
        setForm({
          category: finalCategory,
          customCategory: '',
          description: '',
          amount: '',
          expenseDate: new Date().toISOString().split('T')[0],
          paymentMethod: 'cash',
          paidTo: '',
          attachmentUrl: '',
        });
        setCustomCategoryMode(false);
        // Reload with the current filter
        loadExpenses();
      } else {
        const data = await res.json();
        toast({ title: data.error || 'Failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expenseId: string) => {
    if (!confirm('Delete this expense? This will reverse the ledger entries.')) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/expenses/${expenseId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast({ title: 'Expense deleted' });
        loadExpenses();
      } else {
        const data = await res.json();
        toast({ title: data.error || 'Failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    }
  };

  const categoryColor: Record<string, string> = CATEGORY_COLORS;

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Expenses</h1>
        <button
          onClick={() => setShowForm(true)}
          className="h-9 px-4 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {/* EX-4: Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <Input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="h-9 rounded-xl text-xs max-w-[160px]"
              aria-label="From date"
            />
            <span className="text-xs text-gray-400">to</span>
            <Input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="h-9 rounded-xl text-xs max-w-[160px]"
              aria-label="To date"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="h-9 rounded-xl border border-gray-200 px-3 text-xs bg-white max-w-[180px]"
          >
            <option value="">All categories</option>
            {allCategories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {hasActiveFilter && (
            <button
              onClick={clearFilters}
              className="h-9 px-3 rounded-xl text-xs font-semibold text-violet-600 hover:bg-violet-50 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
        {hasActiveFilter && (
          <p className="text-[11px] text-gray-500">
            Showing {expenses.length} expense(s)
            {filterCategory && ` in "${prettyCategory(filterCategory)}"`}
            {(filterFrom || filterTo) && (
              <> · {filterFrom || 'start'} to {filterTo || 'today'}</>
            )}
            {' · '}Total: {formatBDT(totalAmount)}
          </p>
        )}
      </div>

      {/* Total card */}
      {!loading && expenses.length > 0 && (
        <div className={cn(
          'rounded-2xl border p-4',
          hasActiveFilter ? 'bg-violet-50 border-violet-100' : 'bg-red-50 border-red-100',
        )}>
          <div className="flex items-center justify-between">
            <div>
              <span className={cn(
                'text-xs font-medium',
                hasActiveFilter ? 'text-violet-700' : 'text-red-700',
              )}>
                {hasActiveFilter ? 'Filtered Total' : 'Total Expenses'}
              </span>
              <p className={cn(
                'text-2xl font-bold mt-1',
                hasActiveFilter ? 'text-violet-700' : 'text-red-700',
              )}>{formatBDT(totalAmount)}</p>
            </div>
            <Receipt className={cn(
              'w-8 h-8',
              hasActiveFilter ? 'text-violet-300' : 'text-red-300',
            )} />
          </div>
        </div>
      )}

      {/* Expense list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      ) : expenses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
          <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">
            {hasActiveFilter ? 'No expenses match the filter' : 'No expenses recorded'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {hasActiveFilter ? 'Try clearing the filters or adjusting the date range' : 'Click Add to record your first expense'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((exp) => (
            <div key={exp.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                  <Receipt className="w-5 h-5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', categoryColor[exp.category] || defaultCategoryColor)}>
                      {prettyCategory(exp.category)}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatDate(exp.expenseDate)}</span>
                    {/* EX-7: show payee */}
                    {exp.paidTo && (
                      <span className="text-[10px] text-gray-600 flex items-center gap-0.5">
                        <User className="w-2.5 h-2.5" /> {exp.paidTo}
                      </span>
                    )}
                    {/* EX-8: show attachment link */}
                    {exp.attachmentUrl && (
                      <a
                        href={exp.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                        title={exp.attachmentUrl}
                      >
                        <Paperclip className="w-2.5 h-2.5" /> receipt
                        <ExternalLink className="w-2 h-2" />
                      </a>
                    )}
                  </div>
                  {exp.description && (
                    <p className="text-xs text-gray-500 mt-1">{exp.description}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-sm font-bold text-red-600">
                    -{formatBDT(Number(exp.amount))}
                  </span>
                  <button
                    onClick={() => handleDelete(exp.id)}
                    className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete expense"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Expense Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Add Expense</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* EX-5: category dropdown + "custom" option */}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">Category</Label>
                <select
                  value={customCategoryMode ? '__custom__' : form.category}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setCustomCategoryMode(true);
                    } else {
                      setCustomCategoryMode(false);
                      setForm({ ...form, category: e.target.value });
                    }
                  }}
                  className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-white"
                >
              {/* EX-5: render starter + custom (merged) categories in
                  one pass. The "(custom)" suffix flags categories that
                  came from the shop's history (not in the starter list)
                  so the user knows they're using a custom one. */}
              {allCategories.map((c) => {
                const isCustom = !STARTER_CATEGORIES.some((s) => s.value === c.value);
                return (
                  <option key={c.value} value={c.value}>
                    {c.label}{isCustom ? ' (custom)' : ''}
                  </option>
                );
              })}
              <option value="__custom__">+ Custom…</option>
                </select>
                {customCategoryMode && (
                  <Input
                    value={form.customCategory}
                    onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
                    placeholder="e.g. marketing, legal, advertising…"
                    className="h-10 rounded-xl text-sm mt-2"
                    autoFocus
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">Amount (৳) *</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                  className="h-10 rounded-xl"
                  min="0"
                  step="0.01"
                  autoFocus={!customCategoryMode}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">Date</Label>
                <Input
                  type="date"
                  value={form.expenseDate}
                  onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                  className="h-10 rounded-xl"
                />
              </div>

              {/* EX-7: paidTo */}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600 flex items-center gap-1">
                  <User className="w-3 h-3" /> Paid To (optional)
                </Label>
                <Input
                  value={form.paidTo}
                  onChange={(e) => setForm({ ...form, paidTo: e.target.value })}
                  placeholder="e.g. employee name, driver, vendor…"
                  className="h-10 rounded-xl text-sm"
                />
                <p className="text-[10px] text-gray-400">
                  Useful for audit — e.g. "Salary" paid to whom, "Transport" to which driver
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">Description (optional)</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What was this expense for?"
                  className="rounded-xl resize-none"
                  rows={2}
                />
              </div>

              {/* EX-8: attachment URL */}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600 flex items-center gap-1">
                  <Paperclip className="w-3 h-3" /> Receipt / Attachment URL (optional)
                </Label>
                <Input
                  type="url"
                  value={form.attachmentUrl}
                  onChange={(e) => setForm({ ...form, attachmentUrl: e.target.value })}
                  placeholder="https://…"
                  className="h-10 rounded-xl text-sm"
                />
                <p className="text-[10px] text-gray-400">
                  Paste a link to a receipt or invoice photo (Google Drive, Dropbox, your storage). Useful for tax audit.
                </p>
              </div>

              {/* EX-2: Payment method selector */}
              <PaymentMethodSelector
                value={form.paymentMethod}
                onChange={(method) => setForm({ ...form, paymentMethod: method })}
                label="Payment Method"
              />
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {saving ? 'Saving...' : 'Save Expense'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
