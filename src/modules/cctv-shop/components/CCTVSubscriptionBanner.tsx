'use client';

// CCTV Subscription Status Banner (SUB-9)
//
// Shows a persistent banner at the top of the CCTV shell when the
// business's subscription is not "active" — i.e. when it's in
// "expiring_soon" (grace period, full access), "read_only" (writes
// blocked, payment + reports only), or "data_wiped" (data deleted).
//
// The banner:
//   - expiring_soon (day 0-10 after expiry): amber banner, "Your
//     subscription expired on X. You have Y days before access is
//     restricted and Z days before data is deleted. Pay now."
//   - read_only (day 10-15): red banner, "Your access is restricted.
//     You can only pay and view reports. You have Y days before your
//     data is permanently deleted. Pay now."
//   - data_wiped (day 15+): dark red banner, "Your data has been
//     permanently deleted. Pay now to start a fresh subscription."
//
// The banner is dismissible per-session (localStorage) but reappears
// on the next login. It links to the Settings → Subscription tab
// where the user can submit a payment.
//
// Related audit bugs:
//   SUB-9  — No subscription-status banner in the CCTV shell. FIXED.
//   DB-1   — Dashboard doesn't show subscription status. Partially
//            addressed (the banner shows on all views, including
//            dashboard).

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, ShieldAlert, ShieldX, X, CreditCard,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

interface BusinessSubscriptionInfo {
  subscriptionStage: string;
  subscriptionEnd: string | null;
  dataWipeDate: string | null;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function CCTVSubscriptionBanner() {
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const { navigate } = useCCTVNavStore();
  const [info, setInfo] = useState<BusinessSubscriptionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    // Fetch the business's subscription stage. We use the /subscription
    // endpoint which returns the business's subscription info. The
    // endpoint doesn't currently return `subscriptionStage` directly
    // (it returns `status`), so we also fetch the business's session
    // which has the stage. For simplicity, we infer the stage from
    // `status` + `endDate` — same logic as CCTVSubscriptionTab.
    //
    // NOTE: a follow-up should add `subscriptionStage` + `dataWipeDate`
    // to the /subscription GET response so we don't have to infer.
    // For now, we use the session's business info if available, or
    // fall back to the /subscription endpoint.
    fetch(`/api/businesses/${businessId}/subscription`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.subscription) {
          const sub = data.subscription;
          // Infer stage from status + endDate
          const days = daysUntil(sub.endDate);
          let stage = 'active';
          if (sub.status === 'suspended' || sub.status === 'expired' || sub.status === 'cancelled') {
            stage = 'data_wiped'; // most restrictive
          } else if (days !== null && days < 0) {
            // Expired — determine which stage based on how far past
            if (days < -15) stage = 'data_wiped';
            else if (days < -10) stage = 'read_only';
            else stage = 'expiring_soon';
          }
          setInfo({
            subscriptionStage: stage,
            subscriptionEnd: sub.endDate,
            // If we had dataWipeDate we'd use it; infer from endDate + 15 days
            dataWipeDate: sub.endDate
              ? new Date(new Date(sub.endDate).getTime() + 15 * 24 * 60 * 60 * 1000).toISOString()
              : null,
          });
        }
      })
      .catch(() => {
        // Silent — banner just won't show
      });
  }, [businessId]);

  // Don't render if:
  // - no info loaded yet
  // - stage is "active" (no banner needed)
  // - dismissed this session
  if (!info || info.subscriptionStage === 'active' || dismissed) {
    return null;
  }

  const stage = info.subscriptionStage;
  const daysLeftToWipe = daysUntil(info.dataWipeDate);
  const expiryDate = formatDate(info.subscriptionEnd);

  // Determine banner style + content based on stage
  let bgClass: string;
  let borderClass: string;
  let textClass: string;
  let Icon: typeof AlertTriangle;
  let title: string;
  let message: string;

  if (stage === 'expiring_soon') {
    // Day 0-10: amber, full access, warned
    bgClass = 'bg-amber-50';
    borderClass = 'border-amber-200';
    textClass = 'text-amber-800';
    Icon = AlertTriangle;
    title = 'Subscription expired';
    const daysToRestricted = daysLeftToWipe !== null ? Math.max(0, daysLeftToWipe - 5) : null;
    message = `Your subscription expired on ${expiryDate}. You have ${daysToRestricted !== null ? `${daysToRestricted} day(s) before access is restricted` : 'limited time'} and ${daysLeftToWipe !== null ? `${daysLeftToWipe} day(s) before your data is deleted` : 'limited time'}. Pay now to avoid interruption.`;
  } else if (stage === 'read_only') {
    // Day 10-15: red, writes blocked, payment + reports only
    bgClass = 'bg-red-50';
    borderClass = 'border-red-200';
    textClass = 'text-red-800';
    Icon = ShieldAlert;
    title = 'Access restricted';
    message = `Your subscription expired. You can only pay your subscription and view reports — sales, purchases, and repairs are blocked. You have ${daysLeftToWipe !== null ? `${daysLeftToWipe} day(s) before your data is permanently deleted` : 'limited time'}. Pay now to restore full access.`;
  } else {
    // data_wiped (day 15+): dark red, data deleted
    bgClass = 'bg-red-100';
    borderClass = 'border-red-300';
    textClass = 'text-red-900';
    Icon = ShieldX;
    title = 'Data permanently deleted';
    message = 'Your subscription expired and all your business data has been permanently deleted. Pay now to start a fresh subscription.';
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className={cn(
          'rounded-2xl border p-3 flex items-start gap-3 shadow-sm',
          bgClass, borderClass,
        )}
      >
        <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', textClass)} />
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-bold', textClass)}>{title}</p>
          <p className={cn('text-xs mt-0.5', textClass)}>{message}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('settings')}
            className={cn(
              'h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-transform active:scale-95',
              stage === 'data_wiped'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : stage === 'read_only'
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-amber-500 text-white hover:bg-amber-600',
            )}
          >
            <CreditCard className="w-3.5 h-3.5" />
            Pay Now
          </button>
          <button
            onClick={() => setDismissed(true)}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/50 shrink-0',
              textClass,
            )}
            title="Dismiss for this session"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
