'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Loader2, Calendar, User, Phone, Mail,
  MapPin, Clock, Shield, FileText, Banknote, Hash,
  Timer,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { AmcCoverageType, AmcPaymentFrequency } from '@/modules/cctv-shop/types';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

const COVERAGE_OPTIONS: { value: AmcCoverageType; label: string; color: string; activeColor: string }[] = [
  { value: 'Basic', label: 'Basic', color: 'bg-gray-100 text-gray-600 border-gray-200', activeColor: 'bg-gray-200 text-gray-800 border-gray-400' },
  { value: 'Standard', label: 'Standard', color: 'bg-gray-50 text-gray-500 border-gray-100', activeColor: 'bg-violet-100 text-violet-700 border-violet-400' },
  { value: 'Premium', label: 'Premium', color: 'bg-gray-50 text-gray-500 border-gray-100', activeColor: 'bg-amber-100 text-amber-700 border-amber-400' },
];

const FREQ_OPTIONS: { value: AmcPaymentFrequency; label: string; divisor: number }[] = [
  { value: 'MONTHLY', label: 'Monthly', divisor: 12 },
  { value: 'QUARTERLY', label: 'Quarterly', divisor: 4 },
  { value: 'ANNUAL', label: 'Annual', divisor: 1 },
];

function SectionHeader({ title, icon }: { title: string; icon?: string }) {
  return (
    <div className="flex items-center gap-2 mt-5 mb-3 first:mt-0">
      {icon && <span className="text-sm">{icon}</span>}
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</h3>
    </div>
  );
}

export function CCTVCreateAmc() {
  const { navigate, goBack, contextId } = useCCTVNavStore();
  const businessId = useCctvBusinessId();
  const { toast } = useToast();
  const isEditMode = !!contextId;

  // Form state
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [coverageType, setCoverageType] = useState<AmcCoverageType>('Standard');
  const [totalAmount, setTotalAmount] = useState('');
  const [paymentFrequency, setPaymentFrequency] = useState<AmcPaymentFrequency>('MONTHLY');
  const [visitsIncluded, setVisitsIncluded] = useState('1');
  const [responseHours, setResponseHours] = useState('48');
  const [slaTerms, setSlaTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!contextId);

  // Auto-calculated payment amount
  const paymentAmount = totalAmount
    ? (Number(totalAmount) / FREQ_OPTIONS.find((f) => f.value === paymentFrequency)!.divisor).toFixed(2)
    : '0';

  // Pre-fill form in edit mode
  useEffect(() => {
    if (!contextId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/businesses/${businessId}/cctv/amc-contracts/${contextId}`);
        if (res.ok && !cancelled) {
          const c = await res.json();
          setClientName(c.clientName || '');
          setClientPhone(c.clientPhone || '');
          setClientEmail(c.clientEmail || '');
          setClientAddress(c.clientAddress || '');
          setStartDate(c.startDate ? new Date(c.startDate).toISOString().slice(0, 10) : '');
          setEndDate(c.endDate ? new Date(c.endDate).toISOString().slice(0, 10) : '');
          setCoverageType(c.coverageType || 'Standard');
          setTotalAmount(c.totalAmount ? String(c.totalAmount) : '');
          setPaymentFrequency(c.paymentFrequency || 'MONTHLY');
          setVisitsIncluded(c.visitsIncluded ? String(c.visitsIncluded) : '1');
          setResponseHours(c.responseHours ? String(c.responseHours) : '48');
          setSlaTerms(c.slaTerms || '');
          setNotes(c.notes || '');
        } else if (!cancelled) {
          toast({ title: 'Contract not found', variant: 'destructive' });
          goBack();
        }
      } catch {
        if (!cancelled) {
          toast({ title: 'Failed to load contract', variant: 'destructive' });
          goBack();
        }
      }
      if (!cancelled) setFetching(false);
    })();
    return () => { cancelled = true; };
  }, [contextId, goBack, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      toast({ title: 'Missing required fields', description: 'Client name is required.', variant: 'destructive' });
      return;
    }
    if (!startDate || !endDate) {
      toast({ title: 'Missing required fields', description: 'Contract start and end dates are required.', variant: 'destructive' });
      return;
    }
    if (!totalAmount || Number(totalAmount) <= 0) {
      toast({ title: 'Missing required fields', description: 'Contract value must be greater than 0.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim() || null,
        clientEmail: clientEmail.trim() || null,
        clientAddress: clientAddress.trim() || null,
        coverageType,
        startDate,
        endDate,
        totalAmount: Number(totalAmount),
        paymentFrequency,
        paymentAmount: Number(paymentAmount),
        visitsIncluded: Number(visitsIncluded) || 1,
        responseHours: Number(responseHours) || 48,
        slaTerms: slaTerms.trim() || null,
        notes: notes.trim() || null,
      };

      const url = contextId
        ? `/api/businesses/${businessId}/cctv/amc-contracts/${contextId}`
        : `/api/businesses/${businessId}/cctv/amc-contracts`;
      const method = contextId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const created = await res.json();
        toast({
          title: contextId ? 'Contract updated' : 'Contract created',
          description: `${created.contractCode} — ${created.clientName}`,
        });
        navigate('amc-detail', created.id);
      } else {
        const err = await res.json();
        toast({ title: 'Failed to save', description: err.error || 'Unknown error', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', description: 'Could not reach server', variant: 'destructive' });
    }
    setLoading(false);
  };

  if (fetching) {
    return (
      <motion.div {...fadeUp} className="space-y-4 pb-4">
        <div className="flex items-center gap-3 pt-1">
          <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm" />
          <div className="h-5 w-40 bg-gray-200 rounded-lg animate-pulse" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
            <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
            <div className="h-10 bg-gray-50 rounded-xl animate-pulse" />
          </div>
        ))}
      </motion.div>
    );
  }

  const isFormValid = clientName.trim() && startDate && endDate && totalAmount && Number(totalAmount) > 0;

  return (
    <motion.div {...fadeUp} className="pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1 mb-4">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">
          {isEditMode ? 'Edit AMC Contract' : 'New AMC Contract'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-1">
        {/* Client Information */}
        <SectionHeader title="Client Information" icon="👤" />
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Client Name <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Company or individual name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="pl-10 h-10 rounded-xl"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Client Phone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="01XXXXXXXXX"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="pl-10 h-10 rounded-xl"
                type="tel"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Client Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="email@example.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="pl-10 h-10 rounded-xl"
                type="email"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Client Address</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Textarea
                placeholder="Street address, city, area..."
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                className="pl-10 min-h-[60px] text-sm rounded-xl resize-none"
              />
            </div>
          </div>
        </div>

        {/* Contract Period */}
        <SectionHeader title="Contract Period" icon="📅" />
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                Start Date <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-10 h-10 rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                End Date <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-10 h-10 rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Coverage Type */}
        <SectionHeader title="Coverage Type" icon="🛡️" />
        <div className="flex gap-2">
          {COVERAGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCoverageType(opt.value)}
              className={cn(
                'flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all border-2',
                coverageType === opt.value ? opt.activeColor : opt.color,
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Contract Value */}
        <SectionHeader title="Contract Value" icon="💰" />
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Annual Contract Value (BDT) <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <span className="absolute left-10 top-1/2 -translate-y-1/2 text-sm text-gray-400">৳</span>
              <Input
                type="number"
                placeholder="0"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="pl-14 h-10 rounded-xl"
                min={0}
              />
            </div>
          </div>

          {/* Payment Frequency */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Payment Frequency</label>
            <div className="flex gap-2">
              {FREQ_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPaymentFrequency(opt.value)}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-xs font-semibold transition-all border-2',
                    paymentFrequency === opt.value
                      ? 'bg-violet-100 text-violet-700 border-violet-400'
                      : 'bg-gray-50 text-gray-500 border-gray-100',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Auto-calculated payment amount */}
            <div className="mt-2.5 flex items-center justify-between bg-violet-50 rounded-xl px-3 py-2">
              <span className="text-[11px] text-violet-600 font-medium">Payment Amount</span>
              <span className="text-sm font-bold text-violet-700">৳{Number(paymentAmount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        </div>

        {/* SLA & Service */}
        <SectionHeader title="SLA & Service" icon="⏱️" />
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Visits Included / Month</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="number"
                value={visitsIncluded}
                onChange={(e) => setVisitsIncluded(e.target.value)}
                className="pl-10 h-10 rounded-xl"
                min={1}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Response SLA (hours)</label>
            <div className="relative">
              <Timer className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="number"
                value={responseHours}
                onChange={(e) => setResponseHours(e.target.value)}
                className="pl-10 h-10 rounded-xl"
                min={1}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">SLA Terms</label>
            <Textarea
              placeholder="Describe service level agreement terms..."
              value={slaTerms}
              onChange={(e) => setSlaTerms(e.target.value)}
              className="min-h-[72px] text-sm rounded-xl resize-none"
            />
          </div>
        </div>

        {/* Notes */}
        <SectionHeader title="Additional Notes" icon="📝" />
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <Textarea
            placeholder="Any additional notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[64px] text-sm rounded-xl resize-none"
          />
        </div>

        {/* Submit */}
        <div className="pt-4 pb-2">
          <Button
            type="submit"
            disabled={loading || !isFormValid}
            className={cn(
              'w-full h-12 rounded-2xl text-sm font-bold shadow-lg transition-all',
              'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-violet-500/20',
              'hover:shadow-violet-500/30 active:scale-[0.98]',
              (loading || !isFormValid) && 'opacity-60 pointer-events-none',
            )}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {isEditMode ? 'Updating...' : 'Creating...'}
              </span>
            ) : (
              isEditMode ? 'Update Contract' : 'Create AMC Contract'
            )}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}