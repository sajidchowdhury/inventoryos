'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Plus, User, Phone, Star, Clock, Wrench,
  ChevronRight, X, Loader2, TrendingUp, Award,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { CCTVTechnician, TechnicianPerformance } from '@/modules/cctv-shop/types';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';

const formatBDT = (n: number | null | undefined) => {
  if (n == null) return '—';
  return '৳' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

export function CCTVTechniciansList() {
  const { navigate } = useCCTVNavStore();
  const { toast } = useToast();
  const businessId = useCctvBusinessId();

  const [technicians, setTechnicians] = useState<CCTVTechnician[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createSpec, setCreateSpec] = useState('');
  const [creating, setCreating] = useState(false);

  // Performance cache
  const [perfCache, setPerfCache] = useState<Record<string, TechnicianPerformance>>({});

  useEffect(() => {
    if (!showCreate) {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/businesses/${businessId}/mobile-shop/technicians`);
          if (res.ok && !cancelled) setTechnicians(await res.json());
        } catch { /* silent */ }
        finally { if (!cancelled) setLoading(false); }
      })();
      return () => { cancelled = true; };
    }
  }, [showCreate]);

  // Fetch performance for each technician
  useEffect(() => {
    if (technicians.length === 0) return;
    let cancelled = false;
    (async () => {
      const cache: Record<string, TechnicianPerformance> = {};
      for (const t of technicians) {
        try {
          const res = await fetch(`/api/businesses/${businessId}/mobile-shop/technicians/${t.id}/performance`);
          if (res.ok && !cancelled) cache[t.id] = await res.json();
        } catch { /* skip */ }
      }
      if (!cancelled) setPerfCache(cache);
    })();
    return () => { cancelled = true; };
  }, [technicians]);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/technicians`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: createName, phone: createPhone, specialization: createSpec }),
      });
      if (res.ok) {
        const newTech = await res.json();
        toast({ title: 'Technician added' });
        setCreateName(''); setCreatePhone(''); setCreateSpec('');
        setShowCreate(false);
        setTechnicians((prev) => [newTech, ...prev]);
      } else {
        const err = await res.json();
        toast({ title: 'Failed', description: err.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally { setCreating(false); }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Technicians</h2>
            <p className="text-[10px] text-gray-400">{technicians.length} registered</p>
          </div>
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-semibold shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 transition-shadow"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        )}
      </div>

      {/* Create Form */}
      {showCreate && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800">New Technician</h3>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-2">
            <Input placeholder="Full name *" value={createName} onChange={(e) => setCreateName(e.target.value)} className="h-9 text-sm rounded-xl" />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Phone" value={createPhone} onChange={(e) => setCreatePhone(e.target.value)} className="h-9 text-sm rounded-xl" />
              <Input placeholder="Specialization" value={createSpec} onChange={(e) => setCreateSpec(e.target.value)} className="h-9 text-sm rounded-xl" />
            </div>
            <button
              onClick={handleCreate} disabled={creating || !createName.trim()}
              className="w-full py-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-semibold disabled:opacity-50 shadow-lg shadow-violet-500/20"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Add Technician'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Technician Cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : technicians.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No technicians yet</p>
          <p className="text-xs text-gray-300">Add technicians to track performance</p>
        </div>
      ) : (
        <div className="space-y-3">
          {technicians.map((tech, idx) => {
            const perf = perfCache[tech.id];
            return (
              <motion.div
                key={tech.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => navigate('technician-detail', tech.id)}
                className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                      <User className="w-5 h-5 text-violet-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{tech.displayName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {tech.phone && (
                          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                            <Phone className="w-2.5 h-2.5" />{tech.phone}
                          </span>
                        )}
                        {tech.specialization && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-purple-50 text-purple-600">
                            {tech.specialization}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 mt-2" />
                </div>

                {/* Performance Summary */}
                {perf && (
                  <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-50">
                    <div className="text-center">
                      <p className="text-xs font-bold text-gray-800">{perf.completedJobs}</p>
                      <p className="text-[9px] text-gray-400">Done</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-gray-800">{perf.avgTatLabel}</p>
                      <p className="text-[9px] text-gray-400">Avg TAT</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-emerald-600">{formatBDT(perf.totalCommission)}</p>
                      <p className="text-[9px] text-gray-400">Commission</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-amber-600">{perf.avgRating ? `${perf.avgRating}⭐` : '—'}</p>
                      <p className="text-[9px] text-gray-400">Rating</p>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}