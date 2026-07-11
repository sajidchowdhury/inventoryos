'use client';

import { motion } from 'framer-motion';
import {
  TrendingDown,
  FileText,
  BarChart3,
  Receipt,
  Landmark,
  BookOpen,
  BookCheck,
  TrendingUp,
  ClipboardList,
  Cloud,
  FileBarChart,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import type { CCTVViewType } from '../types';

interface ReportItem {
  label: string;
  desc: string;
  icon: React.ReactNode;
  view: CCTVViewType;
  gradient: string;
  ring: string;
}

const REPORT_SECTIONS: { title: string; items: ReportItem[] }[] = [
  {
    title: 'Financial',
    items: [
      { label: 'Expenses', desc: 'Track & manage expenses', icon: <TrendingDown className="w-5 h-5 text-white" />, view: 'expenses', gradient: 'from-rose-400 to-pink-500', ring: 'ring-rose-500/20' },
      { label: 'Due Book', desc: 'Client dues & follow-ups', icon: <BookOpen className="w-5 h-5 text-white" />, view: 'due-book', gradient: 'from-red-400 to-rose-500', ring: 'ring-red-500/20' },
      { label: 'Financial Ledger', desc: 'Complete transaction history', icon: <BookCheck className="w-5 h-5 text-white" />, view: 'ledger', gradient: 'from-indigo-400 to-violet-500', ring: 'ring-indigo-500/20' },
      { label: 'Profit & Loss', desc: 'Revenue vs expense analysis', icon: <TrendingUp className="w-5 h-5 text-white" />, view: 'profit-loss', gradient: 'from-emerald-400 to-green-500', ring: 'ring-emerald-500/20' },
    ],
  },
  {
    title: 'Sales',
    items: [
      { label: 'Sales History', desc: 'All past sales records', icon: <FileBarChart className="w-5 h-5 text-white" />, view: 'sales-history', gradient: 'from-amber-400 to-orange-500', ring: 'ring-amber-500/20' },
      { label: 'Commission Report', desc: 'Technician commissions', icon: <BarChart3 className="w-5 h-5 text-white" />, view: 'commission-report', gradient: 'from-cyan-400 to-blue-500', ring: 'ring-cyan-500/20' },
    ],
  },
  {
    title: 'Tax & VAT',
    items: [
      { label: 'Mushak Report', desc: 'Mushak summary report', icon: <FileText className="w-5 h-5 text-white" />, view: 'mushak-report', gradient: 'from-orange-400 to-red-500', ring: 'ring-orange-500/20' },
      { label: 'NBR & Tax Setup', desc: 'Tax configuration', icon: <Landmark className="w-5 h-5 text-white" />, view: 'nbr-setup', gradient: 'from-amber-400 to-yellow-500', ring: 'ring-amber-500/20' },
      { label: 'Mushak 6.3 Invoices', desc: 'VAT invoice management', icon: <FileText className="w-5 h-5 text-white" />, view: 'mushak-invoices', gradient: 'from-red-400 to-rose-500', ring: 'ring-red-500/20' },
      { label: 'Mushak Registers', desc: '6.1 & 6.2 registers', icon: <ClipboardList className="w-5 h-5 text-white" />, view: 'mushak-registers', gradient: 'from-orange-400 to-amber-500', ring: 'ring-orange-500/20' },
      { label: 'VAT Return', desc: 'Mushak 9.1 filing', icon: <Receipt className="w-5 h-5 text-white" />, view: 'vat-return', gradient: 'from-emerald-400 to-teal-500', ring: 'ring-emerald-500/20' },
    ],
  },
  {
    title: 'Cloud & AI',
    items: [
      { label: 'Cloud Dashboard', desc: 'Business analytics online', icon: <Cloud className="w-5 h-5 text-white" />, view: 'cloud-dashboard', gradient: 'from-sky-400 to-blue-500', ring: 'ring-sky-500/20' },
    ],
  },
];

const stagger = {
  animate: { transition: { staggerChildren: 0.03 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

export function CCTVReportsDashboard() {
  const { navigate } = useCCTVNavStore();

  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="px-4 py-6 pb-24"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">All Reports</h2>
        <p className="text-xs text-gray-400 mt-1">Access every report and analysis tool</p>
      </motion.div>

      {REPORT_SECTIONS.map((section, si) => (
        <motion.div key={section.title} variants={fadeUp} className="mb-6">
          {/* Section Header */}
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-1 h-4 rounded-full bg-gradient-to-b from-violet-500 to-purple-600" />
            <h3 className="text-[13px] font-bold text-gray-900 tracking-tight">{section.title}</h3>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Report Cards */}
          <div className="space-y-2">
            {section.items.map((item) => (
              <motion.button
                key={item.view}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(item.view)}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-white border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-left"
              >
                <div className={cn(
                  'w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm ring-1',
                  item.gradient,
                  item.ring,
                )}>
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-900">{item.label}</p>
                  <p className="text-[11px] text-gray-400">{item.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </motion.button>
            ))}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}