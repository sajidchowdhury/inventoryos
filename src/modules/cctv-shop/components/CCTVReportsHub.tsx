'use client';

import { motion } from 'framer-motion';
import {
  ArrowLeft, BarChart3, Calendar, TrendingUp, ShoppingCart, Boxes,
  Heart, FileText, ArrowLeftRight, Receipt, DollarSign, Activity,
  Award, AlertCircle, PieChart,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { cn } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const REPORTS = [
  {
    view: 'daily-summary' as const,
    title: 'Daily Business Summary',
    desc: 'Everything that happened on any day: sales, purchases, expenses, repairs, returns — all in one page',
    icon: Calendar,
    gradient: 'from-violet-500 to-purple-600',
    badge: 'Most used',
  },
  {
    view: 'weekly-health' as const,
    title: 'Weekly Health Report',
    desc: 'How is your business doing? 7-day trends, health score, insights with graphs',
    icon: Heart,
    gradient: 'from-rose-500 to-pink-600',
    badge: 'Smart insights',
  },
  {
    view: 'sales-report' as const,
    title: 'Sales Report',
    desc: 'All sales in a date range — totals, payment method breakdown, top products',
    icon: TrendingUp,
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    view: 'purchase-report' as const,
    title: 'Purchase Report',
    desc: 'All purchases in a date range — totals, supplier breakdown, top products',
    icon: ShoppingCart,
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    view: 'profit-loss' as const,
    title: 'Profit & Loss',
    desc: 'Revenue minus cost of goods minus expenses = net profit. With category breakdown',
    icon: PieChart,
    gradient: 'from-violet-500 to-purple-600',
    badge: 'Key metric',
  },
  {
    view: 'due-collection' as const,
    title: 'Due Collection',
    desc: 'Who owes you money? Customer dues with aging analysis (0-30, 31-60, 60+ days)',
    icon: AlertCircle,
    gradient: 'from-red-500 to-rose-600',
    badge: 'Cash flow',
  },
  {
    view: 'top-products' as const,
    title: 'Top Products',
    desc: 'Best-selling products by revenue and quantity in a date range',
    icon: Award,
    gradient: 'from-amber-500 to-orange-600',
  },
  {
    view: 'expense-summary' as const,
    title: 'Expense Summary',
    desc: 'All expenses by category with visual bar breakdown',
    icon: Receipt,
    gradient: 'from-orange-500 to-red-600',
  },
  {
    view: 'reports' as const,
    title: 'Cash Book (Daily)',
    desc: 'Money in vs money out — every transaction for a single day',
    icon: DollarSign,
    gradient: 'from-amber-500 to-yellow-600',
  },
  {
    view: 'stock-report' as const,
    title: 'Stock Report',
    desc: 'Current inventory: what you have, what is low, stock value',
    icon: Boxes,
    gradient: 'from-blue-500 to-cyan-600',
  },
  {
    view: 'product-movement' as const,
    title: 'Product Movement',
    desc: 'For any product: when it came in, when it went out, running balance',
    icon: ArrowLeftRight,
    gradient: 'from-cyan-500 to-teal-600',
  },
  {
    view: 'customers' as const,
    title: 'Customer Ledgers',
    desc: 'Who owes you money? Full transaction history per customer',
    icon: TrendingUp,
    gradient: 'from-emerald-500 to-green-600',
  },
  {
    view: 'suppliers' as const,
    title: 'Supplier Ledgers',
    desc: 'Who do you owe? Full transaction history per supplier',
    icon: ShoppingCart,
    gradient: 'from-orange-500 to-amber-600',
  },
];

export function CCTVReportsHub() {
  const { goBack, navigate } = useCCTVNavStore();

  return (
    <motion.div {...fadeUp} className="space-y-6 pb-4">
      <div className="flex items-center gap-3 pt-1">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Reports</h1>
      </div>

      <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg shadow-violet-500/20">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <BarChart3 className="w-5 h-5" /> Business Reports Center
        </h2>
        <p className="text-sm text-white/80 mt-1">
          Understand your business at a glance. Pick any report below.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {REPORTS.map((report) => (
          <button
            key={report.view}
            onClick={() => navigate(report.view)}
            className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-violet-200 transition-all text-left group"
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-md',
                report.gradient
              )}>
                <report.icon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900">{report.title}</h3>
                  {report.badge && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-100 text-violet-600">
                      {report.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{report.desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
