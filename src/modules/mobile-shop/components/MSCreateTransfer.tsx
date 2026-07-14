'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Check, Search, Package, Loader2,
  Building2, X, ScanBarcode, ArrowRightLeft,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import type { MSBranch, MSSerialItem } from '@/modules/mobile-shop/types';
import { useMSBusinessId } from '@/modules/mobile-shop/hooks/use-ms-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const STEP_TITLES = ['Select From Branch', 'Select To Branch', 'Add Items', 'Confirm'];

interface StagedItem {
  id: string;
  serialNumber: string;
  imei?: string;
  productName: string;
  grade?: string;
  productId: string;
  serialItemId: string;
}

export function MSCreateTransfer() {
  const { navigate, goBack } = useMSNavStore();
  const businessId = useMSBusinessId();

  const [step, setStep] = useState(0);
  const [branches, setBranches] = useState<MSBranch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [fromBranchId, setFromBranchId] = useState<string>('');
  const [toBranchId, setToBranchId] = useState<string>('');
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);

  // Search items
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MSSerialItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreSearch, setHasMoreSearch] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // Fetch branches
  useEffect(() => {
    setBranchesLoading(true);
    fetch(`/api/businesses/${businessId}/mobile-shop/branches`)
      .then((res) => res.json())
      .then((data) => {
        const arr: MSBranch[] = Array.isArray(data) ? data : data.branches || [];
        setBranches(arr.filter((b) => b.isActive));
      })
      .catch(() => {})
      .finally(() => setBranchesLoading(false));
  }, []);

  // Search inventory
  const searchInventory = useCallback(
    async (query: string, page = 1, append = false) => {
      if (!fromBranchId || !query.trim()) return;
      setSearching(true);
      try {
        const params = new URLSearchParams();
        params.set('search', query.trim());
        params.set('status', 'IN_STOCK');
        params.set('page', String(page));
        params.set('limit', '20');
        const res = await fetch(
          `/api/businesses/${businessId}/mobile-shop/branches/${fromBranchId}/inventory?${params.toString()}`
        );
        if (res.ok) {
          const data = await res.json();
          const items: MSSerialItem[] = Array.isArray(data) ? data : data.items || data.serialItems || [];
          if (append) {
            setSearchResults((prev) => [...prev, ...items]);
          } else {
            setSearchResults(items);
          }
          setSearchPage(page);
          const total = data.total || items.length;
          setHasMoreSearch(items.length >= 20 && searchResults.length + items.length < total);
        }
      } catch {
        // silent
      } finally {
        setSearching(false);
      }
    },
    [fromBranchId, searchResults.length]
  );

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchQuery.trim() || !fromBranchId) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(() => {
      searchInventory(searchQuery, 1, false);
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery, fromBranchId, searchInventory]);

  // Reset search when branch changes
  useEffect(() => {
    if (fromBranchId) {
      setSearchQuery('');
      setSearchResults([]);
      setStagedItems([]);
    }
  }, [fromBranchId]);

  const isStaged = (serialItemId: string) => stagedItems.some((s) => s.serialItemId === serialItemId);

  const addStagedItem = (item: MSSerialItem) => {
    if (isStaged(item.id)) return;
    setStagedItems((prev) => [
      ...prev,
      {
        id: `${item.id}-${Date.now()}`,
        serialNumber: item.serialNumber,
        imei: item.imei,
        productName: item.product?.name || 'Unknown',
        grade: item.grade,
        productId: item.productId,
        serialItemId: item.id,
      },
    ]);
  };

  const removeStagedItem = (stagedId: string) => {
    setStagedItems((prev) => prev.filter((s) => s.id !== stagedId));
  };

  const handleScannerInput = (value: string) => {
    if (!value.trim() || !fromBranchId) return;
    // Try to find exact match in existing results, or search for it
    const exactMatch = searchResults.find(
      (item) => item.serialNumber === value.trim() || item.imei === value.trim()
    );
    if (exactMatch) {
      addStagedItem(exactMatch);
      return;
    }
    // Search for the scanned value
    searchInventory(value.trim(), 1, false).then(() => {
      // Will be added after results load — handled by user tapping
    });
    setSearchQuery(value.trim());
  };

  const handleCreateTransfer = async () => {
    if (stagedItems.length === 0) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/transfers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromBranchId,
          toBranchId,
          notes: notes.trim() || undefined,
          serialItemIds: stagedItems.map((s) => s.serialItemId),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const transfer = data.transfer || data;
        navigate('transfer-detail', transfer.id);
      }
    } catch {
      // silent
    } finally {
      setCreating(false);
    }
  };

  const handleNext = () => {
    if (step === 0 && fromBranchId) setStep(1);
    else if (step === 1 && toBranchId) setStep(2);
    else if (step === 2) setStep(3);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
    else goBack();
  };

  const availableToBranches = branches.filter((b) => b.id !== fromBranchId);

  // Step progress bar
  const progressPct = ((step + 1) / STEP_TITLES.length) * 100;

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">New Transfer</h1>
        <span className="text-[11px] text-gray-400 font-medium">
          {step + 1}/{STEP_TITLES.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {/* Step title */}
      <p className="text-sm font-semibold text-gray-700">{STEP_TITLES[step]}</p>

      {/* Step 0: Select From Branch */}
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="step-0"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            {branchesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-2xl" />
                ))}
              </div>
            ) : branches.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No branches available</p>
                <button
                  onClick={() => navigate('branches')}
                  className="text-xs text-cyan-600 font-medium mt-2"
                >
                  Create a branch first
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {branches.map((branch, i) => (
                  <motion.button
                    key={branch.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }}
                    onClick={() => setFromBranchId(branch.id)}
                    className={cn(
                      'w-full bg-white rounded-2xl border p-4 shadow-sm text-left active:scale-[0.98] transition-all',
                      fromBranchId === branch.id
                        ? 'border-cyan-400 ring-2 ring-cyan-400/20'
                        : 'border-gray-100'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                        fromBranchId === branch.id
                          ? 'border-cyan-500 bg-cyan-500'
                          : 'border-gray-300'
                      )}>
                        {fromBranchId === branch.id && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{branch.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            {branch.code}
                          </span>
                          {branch._count && (
                            <span className="text-[11px] text-gray-400">
                              {branch._count.serialItems} items in stock
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}

            {/* Next button */}
            <Button
              onClick={handleNext}
              disabled={!fromBranchId}
              className={cn(
                'w-full h-11 rounded-2xl text-sm font-semibold shadow-sm transition-all',
                fromBranchId
                  ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'bg-gray-100 text-gray-400'
              )}
            >
              Next
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </motion.div>
        )}

        {/* Step 1: Select To Branch */}
        {step === 1 && (
          <motion.div
            key="step-1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            {/* From branch summary */}
            <div className="bg-cyan-50 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-cyan-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-cyan-500 font-medium">Sending from</p>
                <p className="text-xs font-semibold text-cyan-800 truncate">
                  {branches.find((b) => b.id === fromBranchId)?.name}
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {availableToBranches.map((branch, i) => (
                <motion.button
                  key={branch.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }}
                  onClick={() => setToBranchId(branch.id)}
                  className={cn(
                    'w-full bg-white rounded-2xl border p-4 shadow-sm text-left active:scale-[0.98] transition-all',
                    toBranchId === branch.id
                      ? 'border-cyan-400 ring-2 ring-cyan-400/20'
                      : 'border-gray-100'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                      toBranchId === branch.id
                        ? 'border-cyan-500 bg-cyan-500'
                        : 'border-gray-300'
                    )}>
                      {toBranchId === branch.id && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{branch.name}</p>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 mt-0.5 inline-block">
                        {branch.code}
                      </span>
                    </div>
                  </div>
                </motion.button>
              ))}

              {availableToBranches.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">No other branches available</p>
                  <button
                    onClick={() => navigate('branches')}
                    className="text-xs text-cyan-600 font-medium mt-2"
                  >
                    Add another branch
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-2.5">
              <Button
                variant="outline"
                onClick={() => setStep(0)}
                className="flex-1 h-11 rounded-2xl border-gray-200 text-sm font-medium"
              >
                Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={!toBranchId}
                className={cn(
                  'flex-1 h-11 rounded-2xl text-sm font-semibold shadow-sm transition-all',
                  toBranchId
                    ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                    : 'bg-gray-100 text-gray-400'
                )}
              >
                Next
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Add Items */}
        {step === 2 && (
          <motion.div
            key="step-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            {/* Branch summary */}
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3">
              <div className="flex-1 min-w-0 text-center">
                <p className="text-[10px] text-gray-400">From</p>
                <p className="text-xs font-semibold text-gray-700 truncate">
                  {branches.find((b) => b.id === fromBranchId)?.name}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-cyan-500 shrink-0" />
              <div className="flex-1 min-w-0 text-center">
                <p className="text-[10px] text-gray-400">To</p>
                <p className="text-xs font-semibold text-gray-700 truncate">
                  {branches.find((b) => b.id === toBranchId)?.name}
                </p>
              </div>
            </div>

            {/* Search + Scanner */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-400" />
              <input
                type="text"
                placeholder="Search by serial, IMEI, or product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-20 rounded-2xl bg-white border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400 transition-all"
              />
              <button
                onClick={() => {
                  const input = document.getElementById('scan-input');
                  if (input) input.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2 rounded-lg bg-cyan-50 text-cyan-600 flex items-center gap-1 text-[10px] font-semibold hover:bg-cyan-100 transition-colors"
              >
                <ScanBarcode className="w-3.5 h-3.5" />
                Scan
              </button>
            </div>

            {/* Hidden scanner input for barcode readers */}
            <input
              id="scan-input"
              type="text"
              className="absolute opacity-0 pointer-events-none"
              style={{ height: 0, width: 0 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.target as HTMLInputElement).value) {
                  handleScannerInput((e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).value = '';
                }
              }}
            />

            {/* Search results */}
            {searching && (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            )}

            {!searching && searchResults.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                {searchResults.map((item) => {
                  const staged = isStaged(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => !staged && addStagedItem(item)}
                      className={cn(
                        'bg-white rounded-xl border p-3 flex items-center gap-3 transition-all',
                        staged
                          ? 'border-emerald-200 bg-emerald-50/50 opacity-70 cursor-default'
                          : 'border-gray-100 active:scale-[0.98] cursor-pointer'
                      )}
                    >
                      <div className={cn(
                        'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                        staged ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                      )}>
                        {staged && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{item.product?.name || 'Unknown'}</p>
                        <p className="text-[11px] text-gray-400 font-mono">{item.serialNumber}</p>
                      </div>
                      {item.grade && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">
                          Grade {item.grade}
                        </span>
                      )}
                    </div>
                  );
                })}
                {hasMoreSearch && (
                  <button
                    onClick={() => searchInventory(searchQuery, searchPage + 1, true)}
                    className="w-full py-2 text-xs text-cyan-600 font-medium text-center"
                  >
                    Load more results
                  </button>
                )}
              </div>
            )}

            {/* Staged items */}
            {stagedItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-semibold text-gray-700">
                    Selected Items ({stagedItems.length})
                  </p>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin">
                  {stagedItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-cyan-50/60 rounded-xl border border-cyan-100 p-2.5 flex items-center gap-2.5"
                    >
                      <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-cyan-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{item.productName}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{item.serialNumber}</p>
                      </div>
                      {item.grade && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-gray-500 shrink-0">
                          {item.grade}
                        </span>
                      )}
                      <button
                        onClick={() => removeStagedItem(item.id)}
                        className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0 hover:bg-red-50 hover:border-red-200 transition-colors"
                      >
                        <X className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2.5">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1 h-11 rounded-2xl border-gray-200 text-sm font-medium"
              >
                Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={stagedItems.length === 0}
                className={cn(
                  'flex-1 h-11 rounded-2xl text-sm font-semibold shadow-sm transition-all',
                  stagedItems.length > 0
                    ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                    : 'bg-gray-100 text-gray-400'
                )}
              >
                Review
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <motion.div
            key="step-3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            {/* Transfer summary */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <ArrowRightLeft className="w-4 h-4 text-cyan-500" />
                <p className="text-sm font-semibold text-gray-900">Transfer Summary</p>
              </div>

              {/* From → To */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 min-w-0 bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-gray-400 mb-0.5">From</p>
                  <p className="text-xs font-semibold text-gray-800 truncate">
                    {branches.find((b) => b.id === fromBranchId)?.name}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-cyan-400 shrink-0" />
                <div className="flex-1 min-w-0 bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-gray-400 mb-0.5">To</p>
                  <p className="text-xs font-semibold text-gray-800 truncate">
                    {branches.find((b) => b.id === toBranchId)?.name}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-sm font-bold text-cyan-600 mb-1">
                <Package className="w-4 h-4" />
                {stagedItems.length} item{stagedItems.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Items list */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-700 mb-2.5">Items to Transfer</p>
              <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                {stagedItems.map((item, i) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2.5 bg-gray-50 rounded-xl px-3 py-2.5"
                  >
                    <span className="w-5 h-5 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{item.productName}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{item.serialNumber}</p>
                    </div>
                    {item.grade && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-gray-500 shrink-0">
                        {item.grade}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-700">Notes (optional)</p>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes for this transfer..."
                className="rounded-xl text-sm min-h-[72px] resize-none"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2.5 pt-1">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="flex-1 h-11 rounded-2xl border-gray-200 text-sm font-medium"
              >
                Back
              </Button>
              <Button
                onClick={handleCreateTransfer}
                disabled={creating}
                className="flex-1 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-sm font-semibold shadow-lg shadow-cyan-500/20 disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Create Transfer
                    <Check className="w-4 h-4 ml-1.5" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}