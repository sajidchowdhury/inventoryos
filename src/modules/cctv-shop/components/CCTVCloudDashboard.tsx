'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Package,
  ShoppingCart,
  Wrench,
  CreditCard,
  ShieldCheck,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  FileText,
  BarChart3,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';

const BUSINESS_ID = 'bus_placeholder';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

interface DashboardData {
  totalProducts: number;
  totalStock: number;
  lowStockCount: number;
  categoryBreakdown: { name: string; color: string; productCount: number }[];
  salesThisMonth: number;
  salesLastMonth: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  mushakInvoicesThisMonth: number;
  salesTrend: { month: string; sales: number; revenue: number }[];
  pendingJobs: number;
  overdueJobs: number;
  activeEmiPlans: number;
  emiCollectedThisMonth: number;
  activeAmcContracts: number;
  expiringAmcContracts: number;
  totalCustomers: number;
}

const CHART_COLORS = ['#8b5cf6', '#a78bfa', '#c4b5fd', '#6d28d9', '#7c3aed', '#ddd6fe', '#ede9fe', '#5b21b6'];

function formatBDT(n: number) {
  if (n >= 100000) return `৳${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `৳${(n / 1000).toFixed(1)}K`;
  return `৳${n.toFixed(0)}`;
}

function MetricCard({
  icon: Icon, label, value, sub, trend, color = 'violet',
}: {
  icon: typeof Package; label: string; value: string; sub?: string;
  trend?: 'up' | 'down' | 'neutral'; color?: string;
}) {
  const colorMap: Record<string, string> = {
    violet: 'from-violet-500 to-purple-600',
    emerald: 'from-emerald-500 to-green-600',
    amber: 'from-amber-500 to-orange-600',
    rose: 'from-rose-500 to-red-600',
    cyan: 'from-cyan-500 to-teal-600',
    gray: 'from-gray-500 to-gray-600',
  };
  return (
    <motion.div variants={fadeUp} initial="initial" animate="animate"
      className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorMap[color] || colorMap.violet} flex items-center justify-center shadow-lg`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend && trend !== 'neutral' && (
          <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${trend === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
            {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-1">{sub}</p>}
    </motion.div>
  );
}

function AlertCard({ icon: Icon, title, count, color }: {
  icon: typeof AlertTriangle; title: string; count: number; color: string;
}) {
  if (count === 0) return null;
  return (
    <motion.div variants={fadeUp} initial="initial" animate="animate"
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${color}`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="text-xs font-semibold flex-1">{title}</span>
      <span className="text-xs font-bold">{count}</span>
    </motion.div>
  );
}

export function CCTVCloudDashboard() {
  const { goBack } = useCCTVNavStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${BUSINESS_ID}/cctv/cloud-dashboard`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="px-4 pt-4 pb-6">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={goBack} className="p-2 rounded-xl hover:bg-gray-100"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
          <div className="flex-1"><h1 className="text-lg font-bold text-gray-900">Cloud Dashboard</h1></div>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const salesGrowth = data.salesLastMonth > 0
    ? ((data.salesThisMonth - data.salesLastMonth) / data.salesLastMonth * 100).toFixed(0)
    : null;
  const revenueGrowth = data.revenueLastMonth > 0
    ? ((data.revenueThisMonth - data.revenueLastMonth) / data.revenueLastMonth * 100).toFixed(0)
    : null;

  // Pie chart data from categories
  const pieData = data.categoryBreakdown
    .filter((c) => c.productCount > 0)
    .map((c) => ({ name: c.name, value: c.productCount }));

  return (
    <div className="px-4 pt-4 pb-6 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div variants={fadeUp} initial="initial" animate="animate" className="flex items-center gap-3 mb-6">
        <button onClick={goBack} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-violet-500" />
            <h1 className="text-lg font-bold text-gray-900">Cloud Dashboard</h1>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Real-time business KPIs & analytics</p>
        </div>
        <button onClick={load} className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors" title="Refresh">
          <RefreshCw className="w-4 h-4 text-gray-600" />
        </button>
      </motion.div>

      {/* ── Alerts ── */}
      {(data.lowStockCount > 0 || data.overdueJobs > 0 || data.expiringAmcContracts > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
          <AlertCard icon={AlertTriangle} title="Low Stock Products" count={data.lowStockCount} color="bg-amber-50 border-amber-200 text-amber-700" />
          <AlertCard icon={Wrench} title="Overdue Repairs" count={data.overdueJobs} color="bg-rose-50 border-rose-200 text-rose-700" />
          <AlertCard icon={ShieldCheck} title="AMC Expiring (30d)" count={data.expiringAmcContracts} color="bg-orange-50 border-orange-200 text-orange-700" />
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard
          icon={ShoppingCart} label="Sales This Month" value={String(data.salesThisMonth)}
          sub={`Last month: ${data.salesLastMonth}`}
          trend={salesGrowth ? (Number(salesGrowth) >= 0 ? 'up' : 'down') : undefined}
          color="violet"
        />
        <MetricCard
          icon={TrendingUp} label="Revenue This Month" value={formatBDT(data.revenueThisMonth)}
          sub={`Last month: ${formatBDT(data.revenueLastMonth)}`}
          trend={revenueGrowth ? (Number(revenueGrowth) >= 0 ? 'up' : 'down') : undefined}
          color="emerald"
        />
        <MetricCard
          icon={Package} label="In-Stock Items" value={String(data.totalStock)}
          sub={`${data.totalProducts} products, ${data.lowStockCount} low`}
          color="cyan"
        />
        <MetricCard
          icon={Users} label="Customers" value={String(data.totalCustomers)}
          sub={`${data.mushakInvoicesThisMonth} invoices this month`}
          color="gray"
        />
      </div>

      {/* ── Service & Finance Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard icon={Wrench} label="Pending Repairs" value={String(data.pendingJobs)} color="amber" />
        <MetricCard icon={CreditCard} label="Active EMI Plans" value={String(data.activeEmiPlans)} sub={`Collected: ${formatBDT(data.emiCollectedThisMonth)}`} color="rose" />
        <MetricCard icon={ShieldCheck} label="Active AMC" value={String(data.activeAmcContracts)} color="emerald" />
        <MetricCard icon={FileText} label="Mushak Invoices" value={String(data.mushakInvoicesThisMonth)} sub="This month" color="violet" />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Revenue Trend (Area) */}
        <motion.div variants={fadeUp} initial="initial" animate="animate" className="md:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Revenue Trend</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Last 6 months</p>
            </div>
            <Activity className="w-4 h-4 text-violet-400" />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.salesTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatBDT(v)} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                  formatter={(value: number) => [formatBDT(value), 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Category Breakdown (Pie) */}
        <motion.div variants={fadeUp} initial="initial" animate="animate" className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-gray-800">Stock by Category</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">{data.categoryBreakdown.reduce((s, c) => s + c.productCount, 0)} products</p>
          </div>
          <div className="h-48">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%" innerRadius={40} outerRadius={70}
                    dataKey="value" nameKey="name" paddingAngle={2}
                  >
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-xs">No products yet</div>
            )}
          </div>
          {/* Legend */}
          <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
            {data.categoryBreakdown.filter((c) => c.productCount > 0).map((c, idx) => (
              <div key={c.name} className="flex items-center gap-2 text-[11px]">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                <span className="text-gray-600 flex-1 truncate">{c.name}</span>
                <span className="font-mono font-semibold text-gray-900">{c.productCount}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Sales Volume Bar Chart ── */}
      <motion.div variants={fadeUp} initial="initial" animate="animate" className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-800">Sales Volume</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Number of transactions per month</p>
          </div>
          <ShoppingCart className="w-4 h-4 text-violet-400" />
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.salesTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
              <Bar dataKey="sales" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* ── Footer ── */}
      <motion.div variants={fadeUp} initial="initial" animate="animate" className="text-center">
        <p className="text-[10px] text-gray-400">
          Cloud Dashboard — Real-time KPIs from all modules
        </p>
        <p className="text-[9px] text-gray-300 mt-0.5">
          Inventory, Sales, Repairs, EMI, AMC, NBR compliance
        </p>
      </motion.div>
    </div>
  );
}