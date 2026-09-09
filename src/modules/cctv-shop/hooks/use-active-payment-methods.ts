// src/modules/cctv-shop/hooks/use-active-payment-methods.ts
// ST-9: Hook that fetches the business's active payment methods from
// /api/businesses/[id]/profile and caches them in a module-level variable
// so multiple components on the same page share one fetch.
//
// Usage:
//   const activeMethods = useActivePaymentMethods(businessId);
//   <PaymentMethodSelector activeMethods={activeMethods} ... />
//
// Returns `undefined` while loading (the selector falls back to all 6
// methods when activeMethods is undefined — backward compat).

import { useState, useEffect } from 'react';

// Module-level cache — survives component unmount/remount.
// Keyed by businessId so switching businesses re-fetches.
const cache = new Map<string, string[]>();

export function useActivePaymentMethods(businessId: string | undefined): string[] | undefined {
  const [methods, setMethods] = useState<string[] | undefined>(
    businessId ? cache.get(businessId) : undefined,
  );

  useEffect(() => {
    if (!businessId) return;
    // Already cached → use it immediately
    if (cache.has(businessId)) {
      setMethods(cache.get(businessId));
      return;
    }
    // Fetch + cache
    let cancelled = false;
    fetch(`/api/businesses/${businessId}/profile`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const active = data.business?.activeMethods || ['cash', 'bank', 'bkash', 'nagad', 'card', 'cheque'];
        cache.set(businessId, active);
        setMethods(active);
      })
      .catch(() => {
        if (cancelled) return;
        // On error, fall back to all methods
        const fallback = ['cash', 'bank', 'bkash', 'nagad', 'card', 'cheque'];
        cache.set(businessId, fallback);
        setMethods(fallback);
      });
    return () => { cancelled = true; };
  }, [businessId]);

  return methods;
}

// Helper to invalidate the cache (e.g. after the Profile tab updates
// the active methods). Call this after a PATCH to /profile so the next
// render of any PaymentMethodSelector picks up the new config.
export function invalidateActivePaymentMethods(businessId: string) {
  cache.delete(businessId);
}
