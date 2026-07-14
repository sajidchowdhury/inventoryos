'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Plus, Package, Check, AlertTriangle, XCircle,
  Loader2, Box, Percent, Tag,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MSKitDefinition, KitAvailabilityResult } from '@/modules/mobile-shop/types';
import { useMSBusinessId } from '@/modules/mobile-shop/hooks/use-ms-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

function formatBDT(amount: number): string {
  return `৳${amount.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;
}

type AvailabilityStatus = 'available' | 'partial' | 'out_of_stock';

interface KitWithAvailability {
  kit: MSKitDefinition;
  availability: KitAvailabilityResult | null;
  loading: boolean;
}

export function MSKitsList() {
  const { navigate, goBack } = useMSNavStore();
  const businessId = useMSBusinessId();

  const [kits, setKits] = useState<KitWithAvailability[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchKits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/kits`);
      if (!res.ok) throw new Error('Failed to fetch kits');
      const data = await res.json();
      const kitList: MSKitDefinition[] = Array.isArray(data) ? data : data.kits || [];

      // Initialize with loading state
      const withAvail: KitWithAvailability[] = kitList.map((kit) => ({
        kit,
        availability: null,
        loading: true,
      }));
      setKits(withAvail);

      // Fetch availability for each kit in parallel
      kitList.forEach(async (kit) => {
        try {
          const availRes = await fetch(
            `/api/businesses/${businessId}/mobile-shop/kits/${kit.id}/availability`
          );
          if (availRes.ok) {
            const availData: KitAvailabilityResult = await availRes.json();
            setKits((prev) =>
              prev.map((k) =>
                k.kit.id === kit.id ? { ...k, availability: availData, loading: false } : k
              )
            );
          } else {
            setKits((prev) =>
              prev.map((k) =>
                k.kit.id === kit.id ? { ...k, loading: false } : k
              )
            );
          }
        } catch {
          setKits((prev) =>
            prev.map((k) =>
              k.kit.id === kit.id ? { ...k, loading: false } : k
            )
          );
        }
      });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKits();
  }, [fetchKits]);

  const getAvailabilityStatus = (
    item: KitWithAvailability
  ): AvailabilityStatus => {
    if (!item.availability) return 'out_of_stock';
    if (item.availability.canFulfill && item.availability.maxComplete > 0) return 'available';
    if (item.availability.maxComplete > 0) return 'partial';
    return 'out_of_stock';
  };

  const sufficientCount = kits.filter(
    (k) => getAvailabilityStatus(k) === 'available'
  ).length;

  const renderAvailability = (item: KitWithAvailability) => {
    if (item.loading) {
      return (
        <div className="flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
          <span className="text-xs text-gray-400">Checking...</span>
        </div>
      );
    }

    const status = getAvailabilityStatus(item);
    const avail = item.availability;

    if (status === 'available') {
      return (
        <div className="flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-xs font-medium text-emerald-700">
            {avail?.maxComplete} available
          </span>
        </div>
      );
    }
    if (status === 'partial') {
      return (
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-medium text-amber-700">
            {avail?.maxComplete || 0} available
          </span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5">
        <XCircle className="w-3.5 h-3.5 text-red-500" />
        <span className="text-xs font-medium text-red-600">Out of stock</span>
      </div>
    );
  };

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
        <h1 className="text-lg font-bold text-gray-900 flex-1">Kits &amp; Bundles</h1>
        <button
          onClick={() => navigate('create-kit')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-semibold shadow-sm active:scale-[0.98] transition-transform"
        >
          <Plus className="w-3.5 h-3.5" />
          New Kit
        </button>
      </div>

      {/* Stats banner */}
      {!loading && kits.length > 0 && (
        <div className="flex items-center gap-3 bg-cyan-50 rounded-2xl p-3.5">
          <div className="flex-1">
            <p className="text-xs text-cyan-500 font-medium">Total Kits</p>
            <p className="text-xl font-bold text-cyan-900">{kits.length}</p>
          </div>
          <div className="w-px h-8 bg-cyan-200" />
          <div className="flex-1">
            <p className="text-xs text-emerald-600 font-medium">Ready to Build</p>
            <p className="text-xl font-bold text-emerald-700">{sufficientCount}</p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between mb-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full mb-1" />
              <Skeleton className="h-3 w-3/4 mb-3" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && kits.length === 0 && (
        <div className="text-center py-14">
          <div className="w-16 h-16 rounded-2xl bg-cyan-50 flex items-center justify-center mx-auto mb-4">
            <Box className="w-8 h-8 text-cyan-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700">No kits yet</p>
          <p className="text-xs text-gray-400 mt-1 mb-5 max-w-[240px] mx-auto">
            Create product bundles to sell complete CCTV setups at a package price
          </p>
          <button
            onClick={() => navigate('create-kit')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold shadow-sm active:scale-[0.98] transition-transform"
          >
            <Plus className="w-4 h-4" />
            Create your first kit
          </button>
        </div>
      )}

      {/* Kit cards */}
      {!loading && kits.length > 0 && (
        <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-0.5 scrollbar-thin">
          {kits.map((item, i) => {
            const { kit, availability } = item;
            const componentCount = kit._count?.components ?? kit.components?.length ?? 0;
            const hasKitPrice = kit.kitPrice != null && kit.kitPrice > 0;
            const priceDisplay = hasKitPrice
              ? formatBDT(kit.kitPrice!)
              : availability
                ? formatBDT(availability.individualTotal)
                : null;

            return (
              <motion.button
                key={kit.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.3, delay: i * 0.04 },
                }}
                onClick={() => navigate('kit-detail', kit.id)}
                className="w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-left active:scale-[0.98] transition-transform"
              >
                {/* Name + component badge */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {kit.name}
                    </p>
                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700">
                      {componentCount} {componentCount === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  {!kit.isActive && (
                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      Inactive
                    </span>
                  )}
                </div>

                {/* Description */}
                {kit.description && (
                  <p className="text-xs text-gray-400 line-clamp-2 mb-3 leading-relaxed">
                    {kit.description}
                  </p>
                )}

                {/* Price + Discount */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {priceDisplay ? (
                    <span className="text-sm font-bold text-gray-900">
                      {!hasKitPrice && (
                        <span className="text-[10px] font-medium text-gray-400 mr-1">
                          Sum of parts
                        </span>
                      )}
                      {priceDisplay}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">No components</span>
                  )}
                  {kit.discountPercent > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                      <Percent className="w-2.5 h-2.5" />
                      {kit.discountPercent}% off
                    </span>
                  )}
                </div>

                {/* Availability */}
                <div className="flex items-center justify-between pt-2.5 border-t border-gray-50">
                  {componentCount > 0 ? renderAvailability(item) : (
                    <span className="text-xs text-gray-400">No components added</span>
                  )}
                  <Package className="w-4 h-4 text-gray-300" />
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}