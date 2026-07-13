'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Plus, Loader2, Receipt, Trash2, X,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const CATEGORIES = [
  { value: 'rent', label: 'Rent' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'transport', label: 'Transport' },
  { value: 'salary', label: 'Salary' },
  { value: 'tea', label: 'Tea/Snacks' },
  { value: 'phone', label: 'Phone/Internet' },
  { value: 'other', label: 'Other' },
];

function formatBDT(n: number): string {
  return `\u09F3${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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

  const [form, setForm] = useState({
    category: 'rent',
    description: '',
    amount: '',
    expenseDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/businesses/${businessId}/cctv/expenses`)
      .then((r) => r.json())
      .then((data) => {
        setExpenses(data.expenses || []);
        setTotalAmount(data.totalAmount || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [businessId]);

  const handleSubmit = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast({ title: 'Error', description: 'Amount must be greater than 0', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast({ title: 'Expense recorded' });
        setShowForm(false);
        setForm({ category: 'rent', description: '', amount: '', expenseDate: new Date().toISOString().split('T')[0] });
        // Reload
        const data = await fetch(`/api/businesses/${businessId}/cctv/expenses`).then((r) => r.json());
        setExpenses(data.expenses || []);
        setTotalAmount(data.totalAmount || 0);
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

  const categoryColor: Record<string, string> = {
    rent: 'bg-purple-50 text-purple-600',
    electricity: 'bg-amber-50 text-amber-600',
    transport: 'bg-blue-50 text-blue-600',
    salary: 'bg-emerald-50 text-emerald-600',
    tea: 'bg-orange-50 text-orange-600',
    phone: 'bg-cyan-50 text-cyan-600',
    other: 'bg-gray-100 text-gray-600',
  };

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

      {/* Total card */}
      {!loading && expenses.length > 0 && (
        <div className="bg-red-50 rounded-2xl border border-red-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-red-700 font-medium">Total Expenses</span>
              <p className="text-2xl font-bold text-red-700 mt-1">{formatBDT(totalAmount)}</p>
            </div>
            <Receipt className="w-8 h-8 text-red-300" />
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
          <p className="text-sm font-medium text-gray-700">No expenses recorded</p>
          <p className="text-xs text-gray-400 mt-1">Click Add to record your first expense</p>
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
                  <div className="flex items-center gap-2">
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', categoryColor[exp.category] || categoryColor.other)}>
                      {CATEGORIES.find(c => c.value === exp.category)?.label || exp.category}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatDate(exp.expenseDate)}</span>
                  </div>
                  {exp.description && (
                    <p className="text-xs text-gray-500 mt-1">{exp.description}</p>
                  )}
                </div>
                <span className="text-sm font-bold text-red-600 shrink-0">
                  -{formatBDT(exp.amount)}
                </span>
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
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">Category</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-white"
                >
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
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
                  autoFocus
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
