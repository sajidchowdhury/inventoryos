'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Crown, Star, Gift, CalendarDays, Pencil,
  Plus, Trash2, Zap, Coins, Award, TrendingUp, Users,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const formatBDT = (n: number): string =>
  '৳' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

// ─── Types ───────────────────────────────────────────────────────────────────

interface LoyaltyConfig {
  id: string;
  businessId: string;
  earnRatePoints: number;
  earnRateAmount: number;
  redeemPointsRequired: number;
  redeemRateValue: number;
  tierBronze: number;
  tierSilver: number;
  tierGold: number;
  tierPlatinum: number;
  isActive: boolean;
  _count: { offers: number };
}

interface LoyaltyOffer {
  id: string;
  name: string;
  offerType: 'DOUBLE_POINTS' | 'BONUS_POINTS';
  multiplier: number | null;
  bonusPoints: number | null;
  startDate: string;
  endDate: string;
  description: string | null;
  isActive: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getOfferStatus(offer: LoyaltyOffer): 'Active' | 'Scheduled' | 'Expired' {
  const now = new Date();
  const start = new Date(offer.startDate);
  const end = new Date(offer.endDate);
  if (now < start) return 'Scheduled';
  if (now > end) return 'Expired';
  return 'Active';
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endYear = e.getFullYear();
  return `${fmt(s)} – ${fmt(e)}, ${endYear}`;
}

function statusDotColor(status: string) {
  switch (status) {
    case 'Active': return 'bg-emerald-500';
    case 'Scheduled': return 'bg-blue-500';
    case 'Expired': return 'bg-gray-400';
    default: return 'bg-gray-400';
  }
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'Active': return 'bg-emerald-100 text-emerald-700';
    case 'Scheduled': return 'bg-blue-100 text-blue-700';
    case 'Expired': return 'bg-gray-100 text-gray-500';
    default: return 'bg-gray-100 text-gray-500';
  }
}

// ─── Default values ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Omit<LoyaltyConfig, 'id' | 'businessId' | '_count'> = {
  earnRatePoints: 1,
  earnRateAmount: 100,
  redeemPointsRequired: 100,
  redeemRateValue: 10,
  tierBronze: 0,
  tierSilver: 50000,
  tierGold: 200000,
  tierPlatinum: 500000,
  isActive: true,
};

const DEFAULT_OFFER: { name: string; offerType: 'DOUBLE_POINTS' | 'BONUS_POINTS'; multiplier: number; bonusPoints: number; startDate: string; endDate: string; description: string } = {
  name: '',
  offerType: 'DOUBLE_POINTS',
  multiplier: 2,
  bonusPoints: 50,
  startDate: '',
  endDate: '',
  description: '',
};

const TIER_CONFIG = [
  { key: 'tierBronze' as const, label: 'Bronze', color: 'bg-amber-100 text-amber-700', icon: Award },
  { key: 'tierSilver' as const, label: 'Silver', color: 'bg-gray-100 text-gray-600', icon: Award },
  { key: 'tierGold' as const, label: 'Gold', color: 'bg-yellow-100 text-yellow-700', icon: Crown },
  { key: 'tierPlatinum' as const, label: 'Platinum', color: 'bg-violet-100 text-violet-700', icon: Crown },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function CCTVLoyaltyCenter() {
  const { goBack } = useCCTVNavStore();
  const { toast } = useToast();
  const businessId = useCctvBusinessId();

  // ── Config state ──
  const [config, setConfig] = useState<LoyaltyConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  // Local edit copies
  const [earnPoints, setEarnPoints] = useState(DEFAULT_CONFIG.earnRatePoints);
  const [earnAmount, setEarnAmount] = useState(DEFAULT_CONFIG.earnRateAmount);
  const [redeemPoints, setRedeemPoints] = useState(DEFAULT_CONFIG.redeemPointsRequired);
  const [redeemValue, setRedeemValue] = useState(DEFAULT_CONFIG.redeemRateValue);
  const [tiers, setTiers] = useState({
    tierBronze: DEFAULT_CONFIG.tierBronze,
    tierSilver: DEFAULT_CONFIG.tierSilver,
    tierGold: DEFAULT_CONFIG.tierGold,
    tierPlatinum: DEFAULT_CONFIG.tierPlatinum,
  });

  // ── Offers state ──
  const [offers, setOffers] = useState<LoyaltyOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);

  // ── Offer dialog ──
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<LoyaltyOffer | null>(null);
  const [offerForm, setOfferForm] = useState(DEFAULT_OFFER);
  const [submittingOffer, setSubmittingOffer] = useState(false);

  // ── Toggle loading refs ──
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  // ── Fetch config ──
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/loyalty-config`);
      if (!res.ok) throw new Error('Failed to load config');
      const data: LoyaltyConfig = await res.json();
      setConfig(data);
      setEarnPoints(data.earnRatePoints);
      setEarnAmount(data.earnRateAmount);
      setRedeemPoints(data.redeemPointsRequired);
      setRedeemValue(data.redeemRateValue);
      setTiers({
        tierBronze: data.tierBronze,
        tierSilver: data.tierSilver,
        tierGold: data.tierGold,
        tierPlatinum: data.tierPlatinum,
      });
    } catch {
      toast({ title: 'Error', description: 'Could not load loyalty configuration.', variant: 'destructive' });
    } finally {
      setConfigLoading(false);
    }
  }, [toast]);

  // ── Fetch offers ──
  const fetchOffers = useCallback(async () => {
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/loyalty-offers?active=true`);
      if (!res.ok) throw new Error('Failed to load offers');
      const data: LoyaltyOffer[] = await res.json();
      setOffers(data);
    } catch {
      toast({ title: 'Error', description: 'Could not load promotional offers.', variant: 'destructive' });
    } finally {
      setOffersLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchConfig();
    fetchOffers();
  }, [fetchConfig, fetchOffers]);

  // ── Save config ──
  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/loyalty-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          earnRatePoints: earnPoints,
          earnRateAmount: earnAmount,
          redeemPointsRequired: redeemPoints,
          redeemRateValue: redeemValue,
          ...tiers,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast({ title: 'Config Saved', description: 'Loyalty program settings updated successfully.' });
      fetchConfig();
    } catch {
      toast({ title: 'Save Failed', description: 'Could not save configuration.', variant: 'destructive' });
    } finally {
      setSavingConfig(false);
    }
  };

  // ── Toggle program active ──
  const handleToggleActive = async (checked: boolean) => {
    if (!config) return;
    setSavingConfig(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/loyalty-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: checked }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setConfig({ ...config, isActive: checked });
      toast({ title: checked ? 'Program Activated' : 'Program Paused' });
    } catch {
      toast({ title: 'Error', description: 'Could not update program status.', variant: 'destructive' });
    } finally {
      setSavingConfig(false);
    }
  };

  // ── Toggle offer active ──
  const handleToggleOffer = async (offer: LoyaltyOffer) => {
    setTogglingIds((prev) => new Set(prev).add(offer.id));
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/loyalty-offers/${offer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !offer.isActive }),
      });
      if (!res.ok) throw new Error('Failed');
      setOffers((prev) => prev.map((o) => (o.id === offer.id ? { ...o, isActive: !o.isActive } : o)));
      toast({ title: `Offer ${offer.isActive ? 'deactivated' : 'activated'}` });
    } catch {
      toast({ title: 'Error', description: 'Could not update offer.', variant: 'destructive' });
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(offer.id);
        return next;
      });
    }
  };

  // ── Delete offer ──
  const handleDeleteOffer = async (offerId: string) => {
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/loyalty-offers/${offerId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed');
      setOffers((prev) => prev.filter((o) => o.id !== offerId));
      toast({ title: 'Offer Deleted' });
    } catch {
      toast({ title: 'Error', description: 'Could not delete offer.', variant: 'destructive' });
    }
  };

  // ── Open create/edit dialog ──
  const openCreateDialog = () => {
    setEditingOffer(null);
    setOfferForm(DEFAULT_OFFER);
    setDialogOpen(true);
  };

  const openEditDialog = (offer: LoyaltyOffer) => {
    setEditingOffer(offer);
    setOfferForm({
      name: offer.name,
      offerType: offer.offerType,
      multiplier: offer.multiplier ?? 2,
      bonusPoints: offer.bonusPoints ?? 50,
      startDate: offer.startDate.slice(0, 10),
      endDate: offer.endDate.slice(0, 10),
      description: offer.description ?? '',
    });
    setDialogOpen(true);
  };

  // ── Submit offer ──
  const handleSubmitOffer = async () => {
    if (!offerForm.name.trim()) {
      toast({ title: 'Validation Error', description: 'Offer name is required.', variant: 'destructive' });
      return;
    }
    if (!offerForm.startDate || !offerForm.endDate) {
      toast({ title: 'Validation Error', description: 'Start and end dates are required.', variant: 'destructive' });
      return;
    }

    setSubmittingOffer(true);
    const body: Record<string, unknown> = {
      name: offerForm.name.trim(),
      offerType: offerForm.offerType,
      startDate: new Date(offerForm.startDate).toISOString(),
      endDate: new Date(offerForm.endDate).toISOString(),
      description: offerForm.description.trim() || null,
    };
    if (offerForm.offerType === 'DOUBLE_POINTS') {
      body.multiplier = offerForm.multiplier;
      body.bonusPoints = null;
    } else {
      body.bonusPoints = offerForm.bonusPoints;
      body.multiplier = null;
    }

    try {
      const isEdit = !!editingOffer;
      const url = isEdit
        ? `/api/businesses/${businessId}/cctv/loyalty-offers/${editingOffer.id}`
        : `/api/businesses/${businessId}/cctv/loyalty-offers`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: isEdit ? 'Offer Updated' : 'Offer Created' });
      setDialogOpen(false);
      fetchOffers();
    } catch {
      toast({ title: 'Error', description: `Could not ${editingOffer ? 'update' : 'create'} offer.`, variant: 'destructive' });
    } finally {
      setSubmittingOffer(false);
    }
  };

  // ── Loading skeleton ──
  if (configLoading || offersLoading) {
    return (
      <motion.div {...fadeUp} className="space-y-4 pb-4">
        <div className="flex items-center gap-3 pt-1">
          <Skeleton className="w-9 h-9 rounded-xl" />
          <Skeleton className="h-6 w-36 rounded-lg" />
        </div>
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-12 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </motion.div>
    );
  }

  const activeOffersCount = offers.filter((o) => getOfferStatus(o) === 'Active').length;

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
        <h1 className="text-lg font-bold text-gray-900 flex-1">Loyalty Program</h1>
      </div>

      {/* ── Status Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-3 h-3 rounded-full',
                config?.isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-gray-300',
              )}
            />
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {config?.isActive ? 'Program Active' : 'Program Paused'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {config?._count.offers ?? 0} active offers configured
              </p>
            </div>
          </div>
          <Switch
            checked={config?.isActive ?? false}
            onCheckedChange={handleToggleActive}
            disabled={savingConfig}
          />
        </div>
      </motion.div>

      {/* ── Earning Rules Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
            <Star className="w-4 h-4 text-violet-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Earning Rules</h3>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-gray-500">Points per event</Label>
              <Input
                type="number"
                min={1}
                value={earnPoints}
                onChange={(e) => setEarnPoints(Math.max(1, Number(e.target.value)))}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-gray-500">Amount per event (৳)</Label>
              <Input
                type="number"
                min={1}
                value={earnAmount}
                onChange={(e) => setEarnAmount(Math.max(1, Number(e.target.value)))}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="rounded-xl bg-violet-50/60 border border-violet-100 px-3 py-2.5">
            <p className="text-xs text-violet-700 font-medium text-center">
              Customer earns <span className="font-bold">{earnPoints}</span> point{earnPoints !== 1 ? 's' : ''} for every{' '}
              <span className="font-bold">{formatBDT(earnAmount)}</span> spent
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Redemption Rules Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Coins className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Redemption Rules</h3>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-gray-500">Points required</Label>
              <Input
                type="number"
                min={1}
                value={redeemPoints}
                onChange={(e) => setRedeemPoints(Math.max(1, Number(e.target.value)))}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-gray-500">BDT discount value (৳)</Label>
              <Input
                type="number"
                min={1}
                value={redeemValue}
                onChange={(e) => setRedeemValue(Math.max(1, Number(e.target.value)))}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="rounded-xl bg-emerald-50/60 border border-emerald-100 px-3 py-2.5">
            <p className="text-xs text-emerald-700 font-medium text-center">
              Every <span className="font-bold">{redeemPoints}</span> points can be redeemed for{' '}
              <span className="font-bold">{formatBDT(redeemValue)}</span> discount
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Tier Thresholds Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Tier Thresholds</h3>
        </div>

        <div className="space-y-2.5">
          {TIER_CONFIG.map((tier) => {
            const IconComp = tier.icon;
            return (
              <div key={tier.key} className="flex items-center gap-3">
                <Badge variant="secondary" className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold border-0', tier.color)}>
                  <IconComp className="w-3 h-3 mr-1" />
                  {tier.label}
                </Badge>
                <div className="flex-1">
                  <Input
                    type="number"
                    min={0}
                    value={tiers[tier.key]}
                    onChange={(e) =>
                      setTiers((prev) => ({ ...prev, [tier.key]: Math.max(0, Number(e.target.value)) }))
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <span className="text-[10px] text-gray-400 w-4 text-right">BDT</span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* ── Save Config Button ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Button
          onClick={handleSaveConfig}
          disabled={savingConfig}
          className="w-full h-11 bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20 rounded-xl font-semibold text-sm hover:from-violet-600 hover:to-purple-700 transition-all"
        >
          {savingConfig ? 'Saving...' : 'Save Configuration'}
        </Button>
      </motion.div>

      <Separator className="my-2" />

      {/* ── Promotional Offers Section ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-violet-500" />
            <h3 className="text-sm font-semibold text-gray-900">Promotional Offers</h3>
            {offers.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-2 py-0 rounded-full bg-violet-100 text-violet-700 border-0">
                {offers.length}
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            onClick={openCreateDialog}
            className="h-8 px-3 text-xs bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20 rounded-lg hover:from-violet-600 hover:to-purple-700"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Create Offer
          </Button>
        </div>
      </motion.div>

      {/* ── Offer Cards ── */}
      {offers.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm text-center"
        >
          <Gift className="w-10 h-10 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400 font-medium">No promotional offers yet</p>
          <p className="text-xs text-gray-300 mt-1">Create your first offer to boost customer engagement</p>
        </motion.div>
      ) : (
        <div className="space-y-2.5 max-h-96 overflow-y-auto">
          {offers.map((offer, i) => {
            const status = getOfferStatus(offer);
            return (
              <motion.div
                key={offer.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: 0.35 + i * 0.04 } }}
                className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
              >
                {/* Top row: name + status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 truncate">{offer.name}</p>
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-[10px] px-2 py-0 rounded-full font-semibold border-0 shrink-0',
                          offer.offerType === 'DOUBLE_POINTS' ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700',
                        )}
                      >
                        {offer.offerType === 'DOUBLE_POINTS' ? 'Double Points' : 'Bonus Points'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={cn('w-2 h-2 rounded-full', statusDotColor(status))} />
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', statusBadgeClass(status))}>
                      {status}
                    </span>
                  </div>
                </div>

                {/* Date range */}
                <div className="flex items-center gap-1.5 mt-2">
                  <CalendarDays className="w-3 h-3 text-gray-400" />
                  <span className="text-[11px] text-gray-500">{formatDateRange(offer.startDate, offer.endDate)}</span>
                </div>

                {/* Description */}
                {offer.description && (
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2">{offer.description}</p>
                )}

                {/* Offer detail line */}
                <div className="flex items-center gap-1.5 mt-2">
                  <Zap className="w-3 h-3 text-amber-500" />
                  <span className="text-xs font-medium text-gray-600">
                    {offer.offerType === 'DOUBLE_POINTS'
                      ? `${offer.multiplier ?? 2}x points multiplier`
                      : `+${offer.bonusPoints ?? 50} bonus points`}
                  </span>
                </div>

                {/* Action row */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <Switch
                    checked={offer.isActive}
                    onCheckedChange={() => handleToggleOffer(offer)}
                    disabled={togglingIds.has(offer.id)}
                  />

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(offer)}
                      className="h-8 px-2 text-xs text-gray-500 hover:text-violet-600"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs text-gray-500 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Offer</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete &ldquo;{offer.name}&rdquo;? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteOffer(offer.id)}
                            className="bg-red-600 text-white hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Offer Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[420px] mx-auto rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">
              {editingOffer ? 'Edit Offer' : 'Create Offer'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">Offer Name *</Label>
              <Input
                placeholder="e.g. Eid Double Points"
                value={offerForm.name}
                onChange={(e) => setOfferForm((prev) => ({ ...prev, name: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">Offer Type</Label>
              <Select
                value={offerForm.offerType}
                onValueChange={(val) =>
                  setOfferForm((prev) => ({
                    ...prev,
                    offerType: val as 'DOUBLE_POINTS' | 'BONUS_POINTS',
                  }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DOUBLE_POINTS">Double Points</SelectItem>
                  <SelectItem value="BONUS_POINTS">Bonus Points</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Conditional fields */}
            {offerForm.offerType === 'DOUBLE_POINTS' ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">Points Multiplier</Label>
                <Input
                  type="number"
                  min={1}
                  value={offerForm.multiplier}
                  onChange={(e) =>
                    setOfferForm((prev) => ({ ...prev, multiplier: Math.max(1, Number(e.target.value)) }))
                  }
                  className="h-9 text-sm"
                />
                <p className="text-[10px] text-gray-400">e.g. 2 means customers earn 2x points</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">Bonus Points</Label>
                <Input
                  type="number"
                  min={1}
                  value={offerForm.bonusPoints}
                  onChange={(e) =>
                    setOfferForm((prev) => ({ ...prev, bonusPoints: Math.max(1, Number(e.target.value)) }))
                  }
                  className="h-9 text-sm"
                />
                <p className="text-[10px] text-gray-400">Flat bonus points added per transaction</p>
              </div>
            )}

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">Start Date *</Label>
                <Input
                  type="date"
                  value={offerForm.startDate}
                  onChange={(e) => setOfferForm((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">End Date *</Label>
                <Input
                  type="date"
                  value={offerForm.endDate}
                  onChange={(e) => setOfferForm((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">Description</Label>
              <textarea
                placeholder="Optional description for this offer..."
                rows={2}
                value={offerForm.description}
                onChange={(e) => setOfferForm((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all resize-none"
              />
            </div>

            {/* Submit */}
            <Button
              onClick={handleSubmitOffer}
              disabled={submittingOffer}
              className="w-full h-10 bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20 rounded-xl font-semibold text-sm hover:from-violet-600 hover:to-purple-700 transition-all"
            >
              {submittingOffer
                ? 'Saving...'
                : editingOffer
                  ? 'Update Offer'
                  : 'Create Offer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}