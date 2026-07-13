'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, MapPin, Phone, Building2, Package, Loader2, X,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import type { MSBranch } from '@/modules/mobile-shop/types';
import { useMSBusinessId } from '@/modules/mobile-shop/hooks/use-ms-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

function generateCode(name: string): string {
  return name
    .replace(/[^a-zA-Z\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 5);
}

export function MSBranchesList() {
  const { navigate, goBack } = useMSNavStore();
  const businessId = useMSBusinessId();

  const [branches, setBranches] = useState<MSBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/branches`);
      if (res.ok) {
        const data = await res.json();
        setBranches(Array.isArray(data) ? data : data.branches || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!code || code === generateCode(name)) {
      setCode(generateCode(val));
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !code.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          address: address.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      });
      if (res.ok) {
        setDialogOpen(false);
        setName('');
        setCode('');
        setAddress('');
        setPhone('');
        fetchBranches();
      }
    } catch {
      // silent
    } finally {
      setCreating(false);
    }
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
        <h1 className="text-lg font-bold text-gray-900 flex-1">Branches</h1>
        <button
          onClick={() => setDialogOpen(true)}
          className="h-8 px-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-semibold shadow-sm active:scale-[0.97] transition-transform flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && branches.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-violet-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700">No branches yet</p>
          <p className="text-xs text-gray-400 mt-1 mb-5 max-w-[220px] mx-auto">
            Create your first branch to start organizing inventory across locations
          </p>
          <button
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-semibold shadow-sm active:scale-[0.98] transition-transform"
          >
            <Plus className="w-4 h-4" />
            Create your first branch
          </button>
        </div>
      )}

      {/* Branch list */}
      {!loading && branches.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 px-1">
            {branches.length} branch{branches.length !== 1 ? 'es' : ''}
          </p>
          <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-0.5 scrollbar-thin">
            {branches.map((branch, i) => (
              <motion.button
                key={branch.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: i * 0.04 } }}
                onClick={() => navigate('branch-detail', branch.id)}
                className="w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-left active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{branch.name}</p>
                      {branch.isDefault && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 shrink-0">
                          Default
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 mt-1 inline-block">
                      {branch.code}
                    </span>
                  </div>
                  {branch._count && (
                    <div className="flex flex-col items-end shrink-0">
                      <Package className="w-4 h-4 text-gray-400 mb-0.5" />
                      <span className="text-xs font-bold text-gray-700">
                        {branch._count.serialItems}
                      </span>
                      <span className="text-[10px] text-gray-400">items</span>
                    </div>
                  )}
                </div>
                {(branch.address || branch.phone) && (
                  <div className="mt-3 space-y-1">
                    {branch.address && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{branch.address}</span>
                      </div>
                    )}
                    {branch.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span>{branch.phone}</span>
                      </div>
                    )}
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Create Branch Dialog */}
      <AlertDialog open={dialogOpen} onOpenChange={(open) => {
        if (!open) {
          setDialogOpen(false);
          setName('');
          setCode('');
          setAddress('');
          setPhone('');
        }
      }}>
        <AlertDialogContent className="rounded-2xl p-5 max-w-[calc(100vw-2rem)] w-full mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-gray-900">
              Add New Branch
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-3.5 mt-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Branch Name *</Label>
              <Input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Dhanmondi Store"
                className="h-10 rounded-xl text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Branch Code *</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                placeholder="Auto-suggested"
                maxLength={10}
                className="h-10 rounded-xl text-sm font-mono"
              />
              <p className="text-[10px] text-gray-400">2-10 characters, uppercase alphanumeric</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Address</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address (optional)"
                className="h-10 rounded-xl text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Contact number (optional)"
                className="h-10 rounded-xl text-sm"
              />
            </div>
          </div>
          <AlertDialogFooter className="mt-5 gap-2">
            <AlertDialogCancel
              onClick={() => {
                setDialogOpen(false);
                setName('');
                setCode('');
                setAddress('');
                setPhone('');
              }}
              className="rounded-xl h-10 text-sm"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || !code.trim() || code.trim().length < 2 || creating}
              className="h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-semibold shadow-sm"
            >
              {creating && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Create Branch
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}