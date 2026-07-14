'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Phone, Mail, MapPin, ShoppingBag, CalendarDays,
  CreditCard, Wallet, Loader2, Star, TrendingUp, Gift,
  Plus, Minus, Receipt, Clock, Package, CheckCircle2,
  AlertCircle, IndianRupee, History, Award, Zap, BookOpen,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useMSBusinessId } from '@/modules/mobile-shop/hooks/use-ms-business-id';
import { MSCustomerLedgerSheet } from './MSCustomerLedgerSheet';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const fadeItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

function formatBDT(n: number): string {
  return `৳${n.toLocaleString()}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

const TIER_CONFIG: Record<string, { badge: string; avatar: string; label: string }> = {
  BRONZE: { badge: 'bg-amber-100 text-amber-700', avatar: 'bg-gradient-to-br from-amber-400 to-amber-600', label: 'Bronze' },
  SILVER: { badge: 'bg-gray-100 text-gray-600', avatar: 'bg-gradient-to-br from-gray-400 to-gray-600', label: 'Silver' },
  GOLD: { badge: 'bg-yellow-100 text-yellow-700', avatar: 'bg-gradient-to-br from-yellow-400 to-yellow-600', label: 'Gold' },
  PLATINUM: { badge: 'bg-cyan-100 text-cyan-700', avatar: 'bg-gradient-to-br from-cyan-400 to-cyan-600', label: 'Platinum' },
};

const SALE_STATUS_BADGE: Record<string, string> = {
  PAID: 'bg-emerald-100 text-emerald-700',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-700',
  PENDING: 'bg-slate-100 text-slate-600',
};

const TX_TYPE_CONFIG: Record<string, { icon: typeof Star; color: string; sign: string; badge: string }> = {
  EARN: { icon: TrendingUp, color: 'text-emerald-600', sign: '+', badge: 'bg-emerald-100 text-emerald-700' },
  REDEEM: { icon: Gift, color: 'text-red-500', sign: '-', badge: 'bg-red-100 text-red-600' },
  BONUS: { icon: Zap, color: 'text-cyan-600', sign: '+', badge: 'bg-cyan-100 text-cyan-700' },
  ADJUST: { icon: Plus, color: 'text-blue-600', sign: '+', badge: 'bg-blue-100 text-blue-600' },
};

interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  totalSpent: number;
  visitCount: number;
  lastVisitAt: string;
  loyaltyPoints: number;
  loyaltyTier: string;
  preferredPaymentMethod: string;
  isActive: boolean;
  createdAt: string;
  msSalesCount: number;
  msTotalSpent: number;
  activeEmiCount: number;
  activeEmiRemaining: number;
  recentSales: {
    id: string;
    saleCode: string;
    totalDue: number;
    status: string;
    createdAt: string;
  }[];
  activeEmiPlans: {
    id: string;
    customerName: string;
    productName: string;
    remainingAmount: number;
    monthlyPayment: number;
    status: string;
  }[];
  tierProgress: {
    currentTier: string;
    nextTier: string;
    currentThreshold: number;
    nextThreshold: number;
    progress: number;
  };
}

interface LoyaltyTransaction {
  id: string;
  type: string;
  points: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

interface LoyaltyConfig {
  redeemPointsRequired: number;
  redeemRateValue: number;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function MSCustomerDetail() {
  const { contextId, navigate, goBack } = useMSNavStore();
  const { toast } = useToast();
  const businessId = useMSBusinessId();

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfig | null>(null);

  // Dialog states
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [redeemPoints, setRedeemPoints] = useState('');
  const [adjustMode, setAdjustMode] = useState<'add' | 'deduct'>('add');
  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);

  const fetchCustomer = useCallback(async () => {
    if (!contextId) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/customers/${contextId}`);
      if (res.ok) setCustomer(await res.json());
    } catch {}
    setLoading(false);
  }, [contextId, businessId]);

  const fetchTransactions = useCallback(async () => {
    if (!contextId) return;
    setTxLoading(true);
    try {
      const res = await fetch(
        `/api/businesses/${businessId}/mobile-shop/customers/${contextId}/loyalty?limit=20&offset=0`
      );
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } catch {}
    setTxLoading(false);
  }, [contextId, businessId]);

  const fetchLoyaltyConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/loyalty-config`);
      if (res.ok) setLoyaltyConfig(await res.json());
    } catch {}
  }, [businessId]);

  useEffect(() => {
    let cancelled = false;
    const loadAll = async () => {
      await Promise.all([fetchCustomer(), fetchTransactions(), fetchLoyaltyConfig()]);
    };
    loadAll();
    return () => { cancelled = true; };
  }, [fetchCustomer, fetchTransactions, fetchLoyaltyConfig]);

  const handleRedeem = async () => {
    const pts = parseInt(redeemPoints);
    if (!pts || pts <= 0) {
      toast({ title: 'Enter a valid number of points', variant: 'destructive' });
      return;
    }
    if (!customer || pts > customer.loyaltyPoints) {
      toast({ title: 'Not enough points', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/businesses/${businessId}/mobile-shop/customers/${contextId}/redeem`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points: pts }),
        }
      );
      if (res.ok) {
        toast({ title: `${pts} points redeemed successfully!` });
        setRedeemOpen(false);
        setRedeemPoints('');
        fetchCustomer();
        fetchTransactions();
      } else {
        const err = await res.json();
        toast({ title: err.error || 'Redeem failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const handleAdjust = async () => {
    const pts = parseInt(adjustPoints);
    if (!pts || pts <= 0) {
      toast({ title: 'Enter a valid number of points', variant: 'destructive' });
      return;
    }
    if (!adjustReason.trim()) {
      toast({ title: 'Please provide a reason', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const actualPoints = adjustMode === 'deduct' ? -pts : pts;
      const res = await fetch(
        `/api/businesses/${businessId}/mobile-shop/customers/${contextId}/loyalty`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points: actualPoints, description: adjustReason }),
        }
      );
      if (res.ok) {
        toast({ title: `Points ${adjustMode === 'add' ? 'added' : 'deducted'} successfully!` });
        setAdjustOpen(false);
        setAdjustPoints('');
        setAdjustReason('');
        setAdjustMode('add');
        fetchCustomer();
        fetchTransactions();
      } else {
        const err = await res.json();
        toast({ title: err.error || 'Adjustment failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const redeemDiscount =
    loyaltyConfig && redeemPoints
      ? (parseInt(redeemPoints) / loyaltyConfig.redeemPointsRequired) *
        loyaltyConfig.redeemRateValue
      : 0;

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="space-y-4 pb-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">Customer not found</p>
      </div>
    );
  }

  const tier = TIER_CONFIG[customer.loyaltyTier] || TIER_CONFIG.BRONZE;
  const tierProg = customer.tierProgress;
  const isMaxTier = !tierProg?.nextTier || tierProg.nextTier === customer.loyaltyTier;

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
        <h1 className="text-lg font-bold text-gray-900 flex-1 truncate">Customer Profile</h1>
        <button
          onClick={() => setLedgerOpen(true)}
          className="h-9 px-3 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-700 active:bg-gray-50 transition-all flex items-center gap-1.5 shadow-sm"
        >
          <BookOpen className="w-3.5 h-3.5" />
          Ledger
        </button>
      </div>

      {/* ── Profile Card ── */}
      <motion.div {...fadeItem} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-start gap-3.5">
          {/* Avatar */}
          <div
            className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-md',
              tier.avatar
            )}
          >
            <span className="text-white text-lg font-bold">{getInitials(customer.name)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900 truncate">{customer.name}</h2>
              <Badge
                variant="secondary"
                className={cn('text-[10px] px-2 py-0.5 font-semibold shrink-0', tier.badge)}
              >
                <Award className="w-2.5 h-2.5 mr-0.5" />
                {tier.label}
              </Badge>
            </div>
            {customer.phone && (
              <a
                href={`tel:${customer.phone.replace(/[^0-9+]/g, '')}`}
                className="flex items-center gap-1.5 mt-1 group"
              >
                <Phone className="w-3.5 h-3.5 text-cyan-500" />
                <span className="text-sm text-cyan-600 font-medium group-hover:underline">
                  {customer.phone}
                </span>
              </a>
            )}
            {customer.email && (
              <div className="flex items-center gap-1.5 mt-1">
                <Mail className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-500 truncate">{customer.email}</span>
              </div>
            )}
            {customer.address && (
              <div className="flex items-center gap-1.5 mt-1">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-500 truncate">{customer.address}</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Loyalty Points Card ── */}
      <motion.div
        {...fadeItem}
        className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl p-4 text-white shadow-lg shadow-cyan-500/20"
      >
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
            Loyalty Points
          </p>
          <Star className="w-4 h-4 text-yellow-300" />
        </div>
        <p className="text-3xl font-extrabold tracking-tight">
          {customer.loyaltyPoints.toLocaleString()}
        </p>

        {/* Tier progress */}
        {tierProg && !isMaxTier && (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-white/70 mb-1">
              <span>{tier.label}</span>
              <span>
                {TIER_CONFIG[tierProg.nextTier]?.label || tierProg.nextTier} at{' '}
                {formatBDT(tierProg.nextThreshold)}
              </span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(tierProg.progress * 100, 100)}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                className="h-full rounded-full bg-white/80"
              />
            </div>
            <p className="text-[10px] text-white/50 mt-1 text-right">
              {Math.round(tierProg.progress * 100)}% to next tier
            </p>
          </div>
        )}

        {isMaxTier && (
          <p className="text-[11px] text-yellow-200 mt-3 font-medium">
            🎉 Maximum tier reached!
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <Dialog open={redeemOpen} onOpenChange={setRedeemOpen}>
            <DialogTrigger asChild>
              <button className="flex-1 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5">
                <Gift className="w-3.5 h-3.5" />
                Redeem Points
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-center">Redeem Points</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="bg-cyan-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-cyan-600 font-medium">You have</p>
                  <p className="text-2xl font-extrabold text-cyan-700">
                    {customer.loyaltyPoints.toLocaleString()}
                  </p>
                  <p className="text-xs text-cyan-500">loyalty points</p>
                </div>
                {loyaltyConfig && (
                  <p className="text-xs text-gray-500 text-center">
                    Redeem rate: <span className="font-semibold text-gray-700">{loyaltyConfig.redeemPointsRequired} pts = {formatBDT(loyaltyConfig.redeemRateValue)}</span>
                  </p>
                )}
                <div>
                  <Label className="text-sm">Points to redeem</Label>
                  <Input
                    type="number"
                    value={redeemPoints}
                    onChange={(e) => setRedeemPoints(e.target.value)}
                    placeholder="Enter points"
                    min={1}
                    max={customer.loyaltyPoints}
                    className="mt-1.5"
                  />
                </div>
                {redeemDiscount > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-200"
                  >
                    <p className="text-xs text-emerald-600 font-medium">You'll get</p>
                    <p className="text-xl font-extrabold text-emerald-700">
                      {formatBDT(redeemDiscount)}
                    </p>
                    <p className="text-[10px] text-emerald-500">discount</p>
                  </motion.div>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      className="w-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 hover:shadow-xl hover:shadow-cyan-500/30 transition-shadow"
                      disabled={!redeemPoints || parseInt(redeemPoints) <= 0 || submitting}
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                      ) : null}
                      Redeem Now
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Redemption</AlertDialogTitle>
                      <AlertDialogDescription>
                        Redeem <strong>{redeemPoints} points</strong> for{' '}
                        <strong>{formatBDT(redeemDiscount)}</strong> discount? This action
                        cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white"
                        onClick={handleRedeem}
                      >
                        Confirm
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
            <DialogTrigger asChild>
              <button className="flex-1 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Adjust Points
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-center">Adjust Loyalty Points</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="bg-cyan-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-cyan-600 font-medium">Current balance</p>
                  <p className="text-2xl font-extrabold text-cyan-700">
                    {customer.loyaltyPoints.toLocaleString()}
                  </p>
                  <p className="text-xs text-cyan-500">points</p>
                </div>

                {/* Add / Deduct toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setAdjustMode('add')}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 border-2',
                      adjustMode === 'add'
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-white text-gray-500'
                    )}
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                  <button
                    onClick={() => setAdjustMode('deduct')}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 border-2',
                      adjustMode === 'deduct'
                        ? 'border-red-400 bg-red-50 text-red-700'
                        : 'border-gray-200 bg-white text-gray-500'
                    )}
                  >
                    <Minus className="w-4 h-4" />
                    Deduct
                  </button>
                </div>

                <div>
                  <Label className="text-sm">Points amount</Label>
                  <Input
                    type="number"
                    value={adjustPoints}
                    onChange={(e) => setAdjustPoints(e.target.value)}
                    placeholder="Enter points"
                    min={1}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-sm">Reason</Label>
                  <Input
                    type="text"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="e.g. Special discount for loyal customer"
                    className="mt-1.5"
                  />
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      className={cn(
                        'w-full text-white shadow-lg transition-shadow',
                        adjustMode === 'add'
                          ? 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/20'
                          : 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/20'
                      )}
                      disabled={!adjustPoints || parseInt(adjustPoints) <= 0 || !adjustReason.trim() || submitting}
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                      ) : null}
                      {adjustMode === 'add' ? 'Add Points' : 'Deduct Points'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Confirm {adjustMode === 'add' ? 'Add' : 'Deduction'}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {adjustMode === 'add'
                          ? `Add ${adjustPoints} points to ${customer.name}?`
                          : `Deduct ${adjustPoints} points from ${customer.name}?`}
                        <br />
                        <span className="text-xs text-gray-400">Reason: {adjustReason}</span>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className={cn(
                          adjustMode === 'add'
                            ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white'
                            : 'bg-gradient-to-br from-red-500 to-rose-600 text-white'
                        )}
                        onClick={handleAdjust}
                      >
                        Confirm
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* ── Stats Row (2x2) ── */}
      <motion.div
        {...fadeItem}
        className="grid grid-cols-2 gap-3"
      >
        <div className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <IndianRupee className="w-3.5 h-3.5 text-cyan-500" />
            <p className="text-[10px] text-gray-400 font-medium">Total Spent</p>
          </div>
          <p className="text-sm font-bold text-gray-900">{formatBDT(customer.totalSpent)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <CalendarDays className="w-3.5 h-3.5 text-cyan-500" />
            <p className="text-[10px] text-gray-400 font-medium">Visits</p>
          </div>
          <p className="text-sm font-bold text-gray-900">{customer.visitCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <CreditCard className="w-3.5 h-3.5 text-cyan-500" />
            <p className="text-[10px] text-gray-400 font-medium">Active EMI</p>
          </div>
          <p className="text-sm font-bold text-gray-900">{customer.activeEmiCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <Wallet className="w-3.5 h-3.5 text-cyan-500" />
            <p className="text-[10px] text-gray-400 font-medium">EMI Remaining</p>
          </div>
          <p className="text-sm font-bold text-gray-900">{formatBDT(customer.activeEmiRemaining)}</p>
        </div>
      </motion.div>

      {/* ── Tabs Section ── */}
      <motion.div {...fadeItem} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <Tabs defaultValue="purchases" className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-11 rounded-none border-b border-gray-100 bg-transparent p-0">
            <TabsTrigger
              value="purchases"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-cyan-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs font-medium text-gray-500 data-[state=active]:text-cyan-600"
            >
              <Receipt className="w-3.5 h-3.5 mr-1" />
              Purchases
            </TabsTrigger>
            <TabsTrigger
              value="emi"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-cyan-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs font-medium text-gray-500 data-[state=active]:text-cyan-600"
            >
              <CreditCard className="w-3.5 h-3.5 mr-1" />
              EMI Plans
            </TabsTrigger>
            <TabsTrigger
              value="points"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-cyan-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs font-medium text-gray-500 data-[state=active]:text-cyan-600"
            >
              <History className="w-3.5 h-3.5 mr-1" />
              Points
            </TabsTrigger>
          </TabsList>

          {/* Purchases Tab */}
          <TabsContent value="purchases" className="mt-0 p-4 max-h-80 overflow-y-auto">
            {customer.recentSales && customer.recentSales.length > 0 ? (
              <motion.div {...stagger} className="space-y-2.5">
                {customer.recentSales.map((sale) => (
                  <motion.button
                    key={sale.id}
                    {...fadeItem}
                    onClick={() => navigate('sale-detail', sale.id)}
                    className="w-full rounded-xl border border-gray-100 bg-gray-50/50 p-3 text-left active:scale-[0.98] transition-transform hover:bg-gray-100/60"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0">
                          <Receipt className="w-4 h-4 text-cyan-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">
                            {sale.saleCode}
                          </p>
                          <p className="text-[10px] text-gray-400">{fmtDate(sale.createdAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className="text-xs font-bold text-gray-900">
                          {formatBDT(sale.totalDue)}
                        </p>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-[9px] px-1.5 py-0.5 font-semibold',
                            SALE_STATUS_BADGE[sale.status] || 'bg-gray-100 text-gray-600'
                          )}
                        >
                          {sale.status === 'PARTIALLY_PAID' ? 'Partial' : sale.status}
                        </Badge>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            ) : (
              <div className="text-center py-8">
                <ShoppingBag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No purchases yet</p>
              </div>
            )}
          </TabsContent>

          {/* EMI Plans Tab */}
          <TabsContent value="emi" className="mt-0 p-4 max-h-80 overflow-y-auto">
            {customer.activeEmiPlans && customer.activeEmiPlans.length > 0 ? (
              <motion.div {...stagger} className="space-y-2.5">
                {customer.activeEmiPlans.map((plan) => (
                  <motion.button
                    key={plan.id}
                    {...fadeItem}
                    onClick={() => navigate('emi-detail', plan.id)}
                    className="w-full rounded-xl border border-gray-100 bg-gray-50/50 p-3 text-left active:scale-[0.98] transition-transform hover:bg-gray-100/60"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                        <CreditCard className="w-4 h-4 text-cyan-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">
                          {plan.productName}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-gray-400">
                            Remaining: <span className="font-semibold text-gray-700">{formatBDT(plan.remainingAmount)}</span>
                          </span>
                          <span className="text-[10px] text-gray-400">
                            Monthly: <span className="font-semibold text-gray-700">{formatBDT(plan.monthlyPayment)}</span>
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-[9px] px-1.5 py-0.5 font-semibold shrink-0',
                          plan.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-600'
                        )}
                      >
                        <Clock className="w-2.5 h-2.5 mr-0.5" />
                        {plan.status}
                      </Badge>
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            ) : (
              <div className="text-center py-8">
                <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No active EMI plans</p>
              </div>
            )}
          </TabsContent>

          {/* Points History Tab */}
          <TabsContent value="points" className="mt-0 p-4 max-h-80 overflow-y-auto">
            {txLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-lg" />
                    <div className="flex-1">
                      <Skeleton className="h-3 w-32 mb-1.5" />
                      <Skeleton className="h-2.5 w-24" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : transactions.length > 0 ? (
              <motion.div {...stagger} className="space-y-2">
                {transactions.map((tx) => {
                  const cfg = TX_TYPE_CONFIG[tx.type] || TX_TYPE_CONFIG.EARN;
                  const TxIcon = cfg.icon;
                  const isDeduct = tx.type === 'REDEEM';

                  return (
                    <motion.div
                      key={tx.id}
                      {...fadeItem}
                      className="flex items-center gap-3 py-2"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                        <TxIcon className={cn('w-4 h-4', cfg.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="secondary"
                            className={cn('text-[9px] px-1.5 py-0 font-semibold', cfg.badge)}
                          >
                            {tx.type}
                          </Badge>
                          <span className="text-[10px] text-gray-400">
                            {fmtDateTime(tx.createdAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                          {tx.description}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={cn(
                            'text-xs font-bold',
                            isDeduct ? 'text-red-600' : 'text-emerald-600'
                          )}
                        >
                          {cfg.sign}{tx.points}
                        </p>
                        <p className="text-[9px] text-gray-400">
                          Bal: {tx.balanceAfter}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              <div className="text-center py-8">
                <History className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No points history yet</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Customer since */}
      <motion.p {...fadeItem} className="text-center text-[10px] text-gray-400 pb-2">
        Customer since {fmtDate(customer.createdAt)}
      </motion.p>

      {/* Customer Ledger Sheet */}
      <MSCustomerLedgerSheet
        open={ledgerOpen}
        onClose={() => setLedgerOpen(false)}
        customerId={contextId || ''}
        customerName={customer.name}
        businessId={businessId}
      />
    </motion.div>
  );
}