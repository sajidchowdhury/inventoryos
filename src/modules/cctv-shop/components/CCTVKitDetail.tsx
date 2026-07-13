'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Pencil, Trash2, Package, Check, AlertTriangle,
  XCircle, Plus, Loader2, ShoppingBag, GripVertical,
  Percent, Tag, Info,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type {
  CCTVKitDefinition,
  KitAvailabilityResult,
  KitComponentAvailability,
} from '@/modules/cctv-shop/types';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

function formatBDT(amount: number): string {
  return `৳${amount.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;
}

export function CCTVKitDetail() {
  const { navigate, goBack, contextId } = useCCTVNavStore();
  const businessId = useCctvBusinessId();

  const [kit, setKit] = useState<CCTVKitDefinition | null>(null);
  const [availability, setAvailability] = useState<KitAvailabilityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [availLoading, setAvailLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const fetchKit = useCallback(async () => {
    if (!contextId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/businesses/${businessId}/mobile-shop/kits/${contextId}`
      );
      if (res.ok) {
        const data = await res.json();
        setKit(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [contextId]);

  const fetchAvailability = useCallback(async () => {
    if (!contextId) return;
    setAvailLoading(true);
    try {
      const res = await fetch(
        `/api/businesses/${businessId}/mobile-shop/kits/${contextId}/availability`
      );
      if (res.ok) {
        const data: KitAvailabilityResult = await res.json();
        setAvailability(data);
      }
    } catch {
      // silent
    } finally {
      setAvailLoading(false);
    }
  }, [contextId]);

  useEffect(() => {
    fetchKit();
    fetchAvailability();
  }, [fetchKit, fetchAvailability]);

  const handleDelete = async () => {
    if (!contextId) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/businesses/${businessId}/mobile-shop/kits/${contextId}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        goBack();
      }
    } catch {
      // silent
    } finally {
      setDeleting(false);
    }
  };

  const handleAddComponent = () => {
    if (!contextId) return;
    navigate('edit-kit', contextId);
  };

  // Computed values
  const hasKitPrice = kit?.kitPrice != null && kit.kitPrice! > 0;
  const hasDiscount = (kit?.discountPercent ?? 0) > 0;
  const individualTotal = availability?.individualTotal ?? 0;
  const kitPrice = availability?.kitPrice ?? kit?.kitPrice ?? individualTotal;
  const savings = individualTotal - kitPrice;

  const components = kit?.components ?? [];
  const componentCount = kit?._count?.components ?? components.length;

  const shortComponents =
    availability?.components.filter((c) => !c.sufficient) ?? [];

  // Loading skeleton
  if (loading) {
    return (
      <motion.div {...fadeUp} className="space-y-4 pb-4">
        <div className="flex items-center gap-3 pt-1">
          <Skeleton className="w-9 h-9 rounded-xl" />
          <Skeleton className="h-5 w-48 flex-1" />
          <Skeleton className="w-9 h-9 rounded-xl" />
          <Skeleton className="w-9 h-9 rounded-xl" />
        </div>
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </motion.div>
    );
  }

  if (!kit) {
    return (
      <motion.div {...fadeUp} className="space-y-4 pb-4">
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={goBack}
            className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Kit</h1>
        </div>
        <div className="text-center py-16">
          <p className="text-sm text-gray-500">Kit not found</p>
        </div>
      </motion.div>
    );
  }

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
        <h1 className="text-lg font-bold text-gray-900 flex-1 truncate">
          {kit.name}
        </h1>
        <button
          onClick={() => navigate('edit-kit', kit.id)}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <Pencil className="w-4 h-4 text-gray-500" />
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-red-50 transition-colors shadow-sm">
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Kit</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{kit.name}&quot;? This action
                cannot be undone. All component associations will be removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Delete'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Kit Info Card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
            {componentCount} {componentCount === 1 ? 'component' : 'components'}
          </span>
          <span
            className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-full',
              kit.isActive
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-500'
            )}
          >
            {kit.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        {kit.description && (
          <p className="text-xs text-gray-500 leading-relaxed mt-1 mb-3">
            {kit.description}
          </p>
        )}

        {/* Pricing */}
        <div className="mt-2 space-y-1.5">
          {hasKitPrice && (
            <>
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                <span className="text-xs text-gray-500">Kit Price</span>
                <span className="ml-auto text-base font-bold text-gray-900">
                  {formatBDT(kit.kitPrice!)}
                </span>
              </div>
              {hasDiscount && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5" />
                    <span className="text-xs text-gray-400">Individual total</span>
                    <span className="ml-auto text-sm text-gray-400 line-through">
                      {formatBDT(individualTotal)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5" />
                    <span className="text-xs text-emerald-600 font-medium">
                      You save
                    </span>
                    <span className="ml-auto text-sm font-bold text-emerald-600">
                      {formatBDT(savings)}
                    </span>
                  </div>
                </>
              )}
            </>
          )}
          {!hasKitPrice && (
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-xs text-gray-500">Sum of parts</span>
              <span className="ml-auto text-sm font-bold text-gray-900">
                {individualTotal > 0 ? formatBDT(individualTotal) : '—'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Component Breakdown */}
      <div>
        <div className="flex items-center justify-between px-1 mb-2.5">
          <h2 className="text-sm font-semibold text-gray-900">
            Component Breakdown
          </h2>
          <span className="text-[10px] font-medium text-gray-400">
            {componentCount} {componentCount === 1 ? 'item' : 'items'}
          </span>
        </div>

        {components.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mx-auto mb-2.5">
              <Package className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-xs font-medium text-gray-500">
              No components yet
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5 mb-3">
              Add products to build this kit
            </p>
            <button
              onClick={handleAddComponent}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-50 text-violet-700 text-xs font-semibold active:scale-[0.98] transition-transform"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Component
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {components.map((comp, i) => {
              const lineTotal = (comp.product?.sellPrice ?? 0) * comp.quantity;
              const availItem = availability?.components.find(
                (a) => a.component.id === comp.id
              );

              return (
                <motion.div
                  key={comp.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.25, delay: i * 0.04 },
                  }}
                  className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5">
                      <GripVertical className="w-4 h-4 text-gray-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {comp.product?.name ?? 'Unknown Product'}
                        </p>
                        {comp.isRequired ? (
                          <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                            Required
                          </span>
                        ) : (
                          <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            Optional
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                        {comp.product?.brand}
                        {comp.componentLabel && (
                          <span className="text-violet-500 ml-1.5">
                            · {comp.componentLabel}
                          </span>
                        )}
                      </p>
                      {/* Line total */}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">
                          {comp.quantity} × {comp.product ? formatBDT(comp.product.sellPrice) : '—'}
                        </span>
                        <span className="text-sm font-bold text-gray-900">
                          {formatBDT(lineTotal)}
                        </span>
                      </div>
                      {/* Availability per component */}
                      {availItem && (
                        <div className="mt-1.5 pt-1.5 border-t border-gray-50">
                          {availItem.sufficient ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span className="text-[11px] text-emerald-600 font-medium">
                                {availItem.available} in stock
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              <span className="text-[11px] text-red-600 font-medium">
                                Insufficient (need {availItem.required}, have{' '}
                                {availItem.available})
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Add Component button */}
            <button
              onClick={handleAddComponent}
              className="w-full py-3 rounded-2xl border border-dashed border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Component
            </button>
          </div>
        )}
      </div>

      {/* Overall Availability Card */}
      {components.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-sm font-semibold text-gray-900 px-1 mb-2.5">
            Overall Availability
          </h2>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            {availLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                <span className="text-xs text-gray-400">Checking stock...</span>
              </div>
            ) : availability ? (
              <>
                {/* Big status */}
                <div className="flex items-center gap-3 mb-3">
                  {availability.canFulfill && availability.maxComplete > 0 ? (
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                      <Check className="w-5 h-5 text-emerald-600" />
                    </div>
                  ) : availability.maxComplete > 0 ? (
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                      <XCircle className="w-5 h-5 text-red-500" />
                    </div>
                  )}
                  <div>
                    <p
                      className={cn(
                        'text-sm font-bold',
                        availability.canFulfill && availability.maxComplete > 0
                          ? 'text-emerald-700'
                          : availability.maxComplete > 0
                            ? 'text-amber-700'
                            : 'text-red-600'
                      )}
                    >
                      {availability.canFulfill && availability.maxComplete > 0
                        ? 'Ready to Assemble'
                        : availability.maxComplete > 0
                          ? 'Partial Stock'
                          : 'Out of Stock'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Can build{' '}
                      <span className="font-bold text-gray-700">
                        {availability.maxComplete}
                      </span>{' '}
                      full {availability.maxComplete === 1 ? 'kit' : 'kits'}
                    </p>
                  </div>
                </div>

                {/* Short components */}
                {shortComponents.length > 0 && (
                  <div className="bg-red-50 rounded-xl p-3 mt-1">
                    <p className="text-[11px] font-semibold text-red-700 mb-1.5 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" />
                      Short components
                    </p>
                    <div className="space-y-1">
                      {shortComponents.map((sc: KitComponentAvailability) => (
                        <div
                          key={sc.component.id}
                          className="flex items-center justify-between text-[11px]"
                        >
                          <span className="text-red-600 truncate">
                            {sc.product?.name ?? 'Unknown'}
                          </span>
                          <span className="text-red-500 font-medium shrink-0 ml-2">
                            {sc.available}/{sc.required}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-400 text-center py-2">
                Availability data unavailable
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Sell Kit Button */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        disabled={
          !availability ||
          !availability.canFulfill ||
          availability.maxComplete === 0
        }
        onClick={() => navigate('sell-kit', kit.id)}
        className="w-full py-3.5 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-semibold shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40 disabled:active:scale-100"
      >
        <ShoppingBag className="w-4 h-4" />
        Sell Kit
        {availability && availability.maxComplete > 0 && (
          <span className="text-xs font-medium opacity-80 ml-0.5">
            — {formatBDT(kitPrice)}
          </span>
        )}
      </motion.button>
    </motion.div>
  );
}