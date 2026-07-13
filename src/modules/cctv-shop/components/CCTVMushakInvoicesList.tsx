'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, Search, ChevronRight, Printer } from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import type { CCTVMushakInvoice } from '../types';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

export function CCTVMushakInvoicesList() {
  const { goBack, navigate } = useCCTVNavStore();
  const businessId = useCctvBusinessId();
  const [invoices, setInvoices] = useState<CCTVMushakInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/businesses/${businessId}/mobile-shop/mushak-invoices?limit=50${search ? `&search=${encodeURIComponent(search)}` : ''}`);
        const json = await res.json();
        if (json.success) {
          setInvoices(json.data);
          setTotal(json.pagination?.total || 0);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [search]);

  return (
    <div className="px-4 pb-6">
      {/* Header */}
      <motion.div variants={fadeUp} initial="initial" animate="animate" className="flex items-center gap-3 mb-5">
        <button onClick={goBack} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">Mushak 6.3 Invoices</h1>
          <p className="text-xs text-gray-500">{total} tax invoices generated</p>
        </div>
      </motion.div>

      {/* Search */}
      <motion.div variants={fadeUp} initial="initial" animate="animate" className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by invoice #, buyer name or BIN..."
          className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
        />
      </motion.div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : invoices.length === 0 ? (
        <motion.div variants={fadeUp} initial="initial" animate="animate" className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-700">No Mushak Invoices</p>
          <p className="text-xs text-gray-400 mt-1">Tax invoices will appear here after generation</p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <motion.button
              key={inv.id}
              variants={fadeUp}
              initial="initial"
              animate="animate"
              onClick={() => navigate('mushak-invoice-detail', inv.id)}
              className="w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900 font-mono">{inv.invoiceNumber}</p>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{inv.buyerName}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-gray-400">
                    {new Date(inv.issueDate).toLocaleDateString('en-BD', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  {inv.buyerBin && (
                    <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-medium">BIN: {inv.buyerBin}</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-gray-900">৳{inv.grandTotal.toLocaleString()}</p>
                <p className="text-[10px] text-gray-400">VAT: ৳{inv.totalVat.toLocaleString()}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}