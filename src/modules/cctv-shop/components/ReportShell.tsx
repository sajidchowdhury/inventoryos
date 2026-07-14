'use client';

import { useState, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Loader2, X } from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

interface ReportShellProps {
  title: string;
  description?: string;
  children: ReactNode;
  onSearch: (params: Record<string, string>) => void;
  loading: boolean;
  hasSearched: boolean;
  additionalFilters?: ReactNode;
  defaultParams?: Record<string, string>;
}

export function ReportShell({
  title,
  description,
  children,
  onSearch,
  loading,
  hasSearched,
  additionalFilters,
  defaultParams,
}: ReportShellProps) {
  const { goBack } = useCCTVNavStore();
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [from, setFrom] = useState(defaultParams?.from || weekAgo);
  const [to, setTo] = useState(defaultParams?.to || today);

  const handleSearch = () => {
    onSearch({ from, to });
  };

  const handleReset = () => {
    setFrom(weekAgo);
    setTo(today);
  };

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">{title}</h1>
          {description && <p className="text-xs text-gray-500">{description}</p>}
        </div>
      </div>

      {/* Filter Panel — always visible */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs text-gray-600">From Date</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="h-10 rounded-xl text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-600">To Date</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="h-10 rounded-xl text-sm" />
          </div>
          {additionalFilters}
          <div className="flex gap-2 ml-auto">
            <button onClick={handleReset}
              className="h-10 px-3 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-colors">
              Reset
            </button>
            <button onClick={handleSearch} disabled={loading}
              className="h-10 px-5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
        </div>
      ) : hasSearched ? (
        children
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 shadow-sm text-center">
          <Search className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">Select dates and click Search</p>
          <p className="text-xs text-gray-400 mt-1">Report will generate based on your filters</p>
        </div>
      )}
    </motion.div>
  );
}

// ── Helper: BDT formatter ──
export function formatBDT(n: number): string {
  return `\u09F3${Math.abs(n).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
