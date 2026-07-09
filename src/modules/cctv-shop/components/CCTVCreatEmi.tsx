'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Calculator, Sparkles } from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const BUSINESS_ID = 'bus_placeholder';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const MONTH_PRESETS = [3, 6, 12, 18, 24];

function calcEmi(financed: number, rate: number, months: number, type: string) {
  if (financed <= 0 || months <= 0) return { emi: 0, totalInterest: 0, grandTotal: 0 };

  if (rate === 0) {
    const emi = financed / months;
    return { emi, totalInterest: 0, grandTotal: financed };
  }

  if (type === 'FLAT') {
    const totalInterest = financed * (rate / 100) * (months / 12);
    const grandTotal = financed + totalInterest;
    const emi = grandTotal / months;
    return { emi, totalInterest, grandTotal };
  }

  // Reducing balance
  const r = rate / 12 / 100;
  const factor = Math.pow(1 + r, months);
  const emi = financed * r * factor / (factor - 1);
  const grandTotal = emi * months;
  const totalInterest = grandTotal - financed;
  return { emi, totalInterest, grandTotal };
}

export function CCTVCreatEmi() {
  const { goBack, navigate } = useCCTVNavStore();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [productName, setProductName] = useState('');
  const [productBrand, setProductBrand] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [downPayment, setDownPayment] = useState('0');
  const [interestRate, setInterestRate] = useState('0');
  const [interestType, setInterestType] = useState<'REDUCING' | 'FLAT'>('REDUCING');
  const [months, setMonths] = useState('12');
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return next.toISOString().split('T')[0];
  });
  const [graceDays, setGraceDays] = useState('3');
  const [notes, setNotes] = useState('');

  // Computed
  const computed = useMemo(() => {
    const total = parseFloat(totalAmount) || 0;
    const down = parseFloat(downPayment) || 0;
    const rate = parseFloat(interestRate) || 0;
    const m = parseInt(months) || 0;
    const financed = Math.max(0, total - down);
    return calcEmi(financed, rate, m, interestType);
  }, [totalAmount, downPayment, interestRate, months, interestType]);

  const financed = Math.max(0, (parseFloat(totalAmount) || 0) - (parseFloat(downPayment) || 0));

  const handleSubmit = async () => {
    if (!customerName.trim()) { toast({ title: 'Customer name required', variant: 'destructive' }); return; }
    if (!customerPhone.trim()) { toast({ title: 'Customer phone required', variant: 'destructive' }); return; }
    if (!productName.trim()) { toast({ title: 'Product name required', variant: 'destructive' }); return; }
    if (!totalAmount || parseFloat(totalAmount) <= 0) { toast({ title: 'Enter a valid total amount', variant: 'destructive' }); return; }
    if (!months || parseInt(months) <= 0) { toast({ title: 'Enter valid months', variant: 'destructive' }); return; }
    if (!startDate) { toast({ title: 'Select a start date', variant: 'destructive' }); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/businesses/${BUSINESS_ID}/cctv/emi-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          productName: productName.trim(),
          productBrand: productBrand.trim() || undefined,
          totalAmount: parseFloat(totalAmount),
          downPayment: parseFloat(downPayment) || 0,
          interestRate: parseFloat(interestRate) || 0,
          interestType,
          months: parseInt(months),
          startDate,
          graceDays: parseInt(graceDays) || 3,
          notes: notes.trim() || undefined,
        }),
      });

      if (res.ok) {
        const plan = await res.json();
        toast({ title: 'EMI plan created!' });
        navigate('emi-detail', plan.id);
      } else {
        const err = await res.json();
        toast({ title: err.error || 'Failed to create', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Create EMI Plan</h1>
      </div>

      {/* Customer */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Customer</h3>
        <Input placeholder="Customer name *" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        <Input placeholder="Phone number *" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} type="tel" />
      </div>

      {/* Product */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Product</h3>
        <Input placeholder="Product name *" value={productName} onChange={(e) => setProductName(e.target.value)} />
        <Input placeholder="Brand (optional)" value={productBrand} onChange={(e) => setProductBrand(e.target.value)} />
      </div>

      {/* Financial Terms */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Financial Terms</h3>

        <div>
          <label className="text-[11px] text-gray-500 mb-1 block">Total Amount (৳)</label>
          <Input type="number" placeholder="50000" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
        </div>
        <div>
          <label className="text-[11px] text-gray-500 mb-1 block">Down Payment (৳)</label>
          <Input type="number" placeholder="0" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} />
        </div>
        <div>
          <label className="text-[11px] text-gray-500 mb-1 block">Interest Rate (%)</label>
          <Input type="number" step="0.1" placeholder="12" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
        </div>

        {/* Interest type */}
        <div>
          <label className="text-[11px] text-gray-500 mb-1.5 block">Interest Type</label>
          <div className="flex gap-2">
            {(['REDUCING', 'FLAT'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setInterestType(t)}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all border',
                  interestType === t
                    ? 'bg-violet-50 border-violet-200 text-violet-700'
                    : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'
                )}
              >
                {t === 'REDUCING' ? 'Reducing Balance' : 'Flat Rate'}
              </button>
            ))}
          </div>
        </div>

        {/* Month presets */}
        <div>
          <label className="text-[11px] text-gray-500 mb-1.5 block">Number of Months</label>
          <div className="flex gap-1.5 flex-wrap mb-2">
            {MONTH_PRESETS.map((m) => (
              <button
                key={m}
                onClick={() => setMonths(String(m))}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                  parseInt(months) === m
                    ? 'bg-violet-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <Input type="number" placeholder="Custom months" value={months} onChange={(e) => setMonths(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">First Due Date</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">Grace Days</label>
            <Input type="number" value={graceDays} onChange={(e) => setGraceDays(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Live calculation preview */}
      {financed > 0 && parseInt(months) > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-violet-50 rounded-2xl border-2 border-violet-200 p-4 space-y-2"
        >
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="w-4 h-4 text-violet-600" />
            <span className="text-sm font-semibold text-violet-900">EMI Calculation</span>
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div className="text-center py-2">
            <p className="text-2xl font-bold text-violet-700">৳{computed.emi.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-violet-500">per month × {months} months</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] text-gray-500">Financed</p>
              <p className="text-xs font-bold text-gray-900">৳{financed.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500">Interest</p>
              <p className="text-xs font-bold text-amber-600">৳{computed.totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500">Grand Total</p>
              <p className="text-xs font-bold text-gray-900">৳{computed.grandTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Notes */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Notes (optional)</h3>
        <Textarea
          placeholder="Any additional notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="resize-none"
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full h-12 rounded-2xl text-sm font-semibold text-white bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Create EMI Plan
      </button>
    </motion.div>
  );
}