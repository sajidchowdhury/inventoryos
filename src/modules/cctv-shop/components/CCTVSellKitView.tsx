'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Loader2, CheckCircle2, ShoppingBag, User, Phone,
  Package, Wallet, AlertCircle, Shield,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';
import { cn } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

function formatBDT(n: number): string {
  return `৳${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Types ──

interface KitComponent {
  id: string;
  productId: string;
  quantity: number;
  componentLabel?: string | null;
  isRequired: boolean;
  product?: {
    id: string;
    name: string;
    brand?: string | null;
    sellPrice: number;
    serialTracked: boolean;
    stock: number;
    imageUrl?: string | null;
  };
}

interface KitData {
  id: string;
  name: string;
  description?: string | null;
  kitPrice?: number | null;
  discountPercent: number;
  components: KitComponent[];
}

interface AvailComponent {
  component: KitComponent;
  required: number;
  available: number;
  sufficient: boolean;
}

interface AvailabilityData {
  kit: KitData;
  canFulfill: boolean;
  maxComplete: number;
  components: AvailComponent[];
  individualTotal: number;
  kitPrice: number;
}

export function CCTVSellKitView() {
  const { goBack, contextId, navigate } = useCCTVNavStore();
  const businessId = useCctvBusinessId();

  const [kit, setKit] = useState<KitData | null>(null);
  const [avail, setAvail] = useState<AvailabilityData | null>(null);
  const [loading, setLoading] = useState(true);

  // Customer
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Payment
  const [payMethod, setPayMethod] = useState('CASH');
  const [payAmount, setPayAmount] = useState('');

  // Serial selection (Phase 6e)
  const [serialSelections, setSerialSelections] = useState<Record<string, string>>({});
  const [serialOptions, setSerialOptions] = useState<Record<string, { id: string; serialNumber: string }[]>>({});
  const [loadingSerials, setLoadingSerials] = useState<Record<string, boolean>>({});

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saleId, setSaleId] = useState<string | null>(null);

  // ── Fetch kit + availability ──
  const fetchData = useCallback(async () => {
    if (!contextId) return;
    setLoading(true);
    try {
      const [kitRes, availRes] = await Promise.all([
        fetch(`/api/businesses/${businessId}/cctv/kits/${contextId}`),
        fetch(`/api/businesses/${businessId}/cctv/kits/${contextId}/availability`),
      ]);
      if (kitRes.ok) {
        const data = await kitRes.json();
        setKit(data);
      }
      if (availRes.ok) {
        const data: AvailabilityData = await availRes.json();
        setAvail(data);

        // Pre-fill payment amount with kit price
        setPayAmount(String(Math.round(data.kitPrice)));

        // Load serial options for serial-tracked components
        for (let i = 0; i < data.components.length; i++) {
          const comp = data.components[i];
          if (comp.component.product?.serialTracked) {
            loadSerialOptions(i, comp.component.productId, comp.required);
          }
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [contextId, businessId]);

  const loadSerialOptions = async (compIndex: number, productId: string, qty: number) => {
    setLoadingSerials((prev) => ({ ...prev, [String(compIndex)]: true }));
    try {
      const res = await fetch(
        `/api/businesses/${businessId}/cctv/products/${productId}/serials?status=IN_STOCK&limit=${qty + 5}`
      );
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.items || data.serials || []);
        setSerialOptions((prev) => ({
          ...prev,
          [String(compIndex)]: items.map((si: { id: string; serialNumber: string }) => ({
            id: si.id,
            serialNumber: si.serialNumber,
          })),
        }));
      }
    } catch {
      // silent
    } finally {
      setLoadingSerials((prev) => ({ ...prev, [String(compIndex)]: false }));
    }
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Submit ──
  const handleSell = async () => {
    if (!contextId || !avail) return;
    setSubmitting(true);
    setError('');

    try {
      const paymentAmount = parseFloat(payAmount) || 0;
      const payments = paymentAmount > 0
        ? [{ method: payMethod, amount: paymentAmount }]
        : [];

      const res = await fetch(
        `/api/businesses/${businessId}/cctv/kits/${contextId}/sell`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: customerName.trim() || undefined,
            customerPhone: customerPhone.trim() || undefined,
            payments,
            serialSelections: Object.keys(serialSelections).length > 0 ? serialSelections : undefined,
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setSaleId(data.id);
        setSuccess(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to sell kit');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalPaid = parseFloat(payAmount) || 0;
  const kitPrice = avail?.kitPrice || 0;
  const due = Math.max(0, kitPrice - totalPaid);
  const isFullyPaid = totalPaid >= kitPrice;

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Sell Kit</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
        </div>
      ) : success ? (
        /* Success */
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-12"
        >
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <p className="text-base font-bold text-gray-900">Kit Sold!</p>
          <p className="text-sm text-gray-500 mt-1">{kit?.name}</p>
          <p className="text-lg font-bold text-violet-600 mt-3">{formatBDT(kitPrice)}</p>
          <div className="flex gap-3 mt-6 justify-center">
            {saleId && (
              <button
                onClick={() => navigate('sale-detail', saleId)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-semibold shadow-sm"
              >
                View Sale
              </button>
            )}
            <button
              onClick={goBack}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600"
            >
              Done
            </button>
          </div>
        </motion.div>
      ) : (
        <>
          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-3.5 text-xs text-red-600 font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Kit info */}
          {kit && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-violet-500" />
                <p className="text-sm font-bold text-gray-900 truncate">{kit.name}</p>
              </div>
              <p className="text-[11px] text-gray-400">
                {avail?.components.length || 0} components
                {avail?.maxComplete !== undefined && ` · ${avail.maxComplete} can be assembled`}
              </p>
            </div>
          )}

          {/* Component breakdown */}
          {avail && avail.components.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-700 mb-3">Components</p>
              <div className="space-y-2.5">
                {avail.components.map((comp, idx) => (
                  <div key={comp.component.id} className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        {comp.component.product?.name}
                        {comp.component.componentLabel && (
                          <span className="text-gray-400 ml-1">({comp.component.componentLabel})</span>
                        )}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {comp.required}× {comp.component.product?.brand || ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full',
                        comp.sufficient
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-red-50 text-red-600'
                      )}>
                        {comp.available}/{comp.required} in stock
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Serial selection for serial-tracked components (Phase 6e) */}
          {avail && avail.components.map((comp, idx) => {
            if (!comp.component.product?.serialTracked) return null;
            const options = serialOptions[String(idx)] || [];
            const selected = serialSelections[String(idx)];

            return (
              <div key={`serial-${comp.component.id}`} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-violet-500" />
                  <p className="text-xs font-semibold text-gray-700 flex-1 truncate">
                    Select Serial: {comp.component.product?.name}
                  </p>
                  <span className="text-[10px] text-gray-400">{comp.required} needed</span>
                </div>
                {loadingSerials[String(idx)] ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
                  </div>
                ) : options.length > 0 ? (
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {options.slice(0, comp.required).map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setSerialSelections((prev) => ({
                            ...prev,
                            [String(idx)]: opt.id,
                          }));
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-colors',
                          selected === opt.id
                            ? 'bg-violet-50 border border-violet-200'
                            : 'bg-gray-50 border border-gray-100 hover:bg-gray-100'
                        )}
                      >
                        <div className={cn(
                          'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                          selected === opt.id
                            ? 'border-violet-500 bg-violet-500'
                            : 'border-gray-300'
                        )}>
                          {selected === opt.id && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <span className="text-xs font-mono text-gray-700 truncate">{opt.serialNumber}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400 text-center py-2">No serial items in stock</p>
                )}
              </div>
            );
          })}

          {/* Customer info */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
            <p className="text-xs font-semibold text-gray-700">Customer</p>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Customer name (optional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full h-10 pl-9 pr-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
              />
            </div>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                placeholder="Phone number (optional)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full h-10 pl-9 pr-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
              />
            </div>
          </div>

          {/* Payment */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-gray-400" />
              <p className="text-xs font-semibold text-gray-700">Payment</p>
            </div>

            <div className="flex gap-2">
              {['CASH', 'CARD', 'BKASH', 'NAGAD', 'ROCKET'].map((m) => (
                <button
                  key={m}
                  onClick={() => setPayMethod(m)}
                  className={cn(
                    'flex-1 h-9 rounded-lg text-[11px] font-semibold transition-all',
                    payMethod === m
                      ? 'bg-violet-500 text-white shadow-sm'
                      : 'bg-gray-50 text-gray-500 border border-gray-200'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">৳</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Amount"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full h-11 pl-8 pr-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-semibold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
              />
            </div>
          </div>

          {/* Totals */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Kit Price</span>
              <span className="text-sm font-bold text-gray-900">{formatBDT(kitPrice)}</span>
            </div>
            {totalPaid > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Paid ({payMethod})</span>
                <span className="text-sm font-semibold text-emerald-600">{formatBDT(totalPaid)}</span>
              </div>
            )}
            {due > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Due</span>
                <span className="text-sm font-bold text-red-500">{formatBDT(due)}</span>
              </div>
            )}
            {isFullyPaid && totalPaid > 0 && (
              <div className="flex items-center gap-1.5 text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">Fully Paid</span>
              </div>
            )}
          </div>

          {/* Sell button */}
          <button
            onClick={handleSell}
            disabled={submitting || !avail?.canFulfill}
            className={cn(
              'w-full py-3.5 rounded-2xl text-sm font-semibold shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform',
              submitting || !avail?.canFulfill
                ? 'bg-gray-100 text-gray-400 shadow-none'
                : 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20'
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Selling...
              </>
            ) : (
              <>
                <ShoppingBag className="w-4 h-4" />
                Sell Kit — {formatBDT(kitPrice)}
              </>
            )}
          </button>
        </>
      )}
    </motion.div>
  );
}