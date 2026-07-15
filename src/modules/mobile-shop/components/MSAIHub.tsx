'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Sparkles,
  TrendingUp,
  Lock,
  Brain,
  Send,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMSNavStore } from '@/stores/ms-nav-store';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const dailyInsights = `Your best-selling product this week is the **Hikvision DS-2CD2143G2** with 14 units sold — a 23% increase over last week. Camera accessories demand is rising; consider restocking HDMI & power cables. Two warranty claims are pending attention, and 3 EMI installments are due this week. Overall revenue is trending 12% above last month.`;

const comingSoon = [
  { title: 'Smart Reordering', icon: Sparkles, desc: 'Auto-suggest restock based on trends' },
  { title: 'Price Optimizer', icon: TrendingUp, desc: 'AI-suggested pricing for max margin' },
  { title: 'Anomaly Detection', icon: Lock, desc: 'Detect unusual patterns in sales/stock' },
  { title: 'Smart Stock Alerts', icon: AlertCircle, desc: 'AI-prioritized low stock warnings' },
];

export function MSAIHub() {
  const { navigate } = useMSNavStore();

  return (
    <div className="px-4 py-6 pb-24">
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl font-bold text-gray-900 mb-1"
      >
        AI Hub
      </motion.h2>
      <p className="text-sm text-gray-500 mb-6">
        Powered by AI to grow your CCTV business
      </p>

      {/* Daily AI Summary Card */}
      <motion.div
        variants={fadeUp}
        initial="initial"
        animate="animate"
        className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-6"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Daily AI Summary</h3>
            <p className="text-[10px] text-gray-400">Generated just now</p>
          </div>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
          {dailyInsights}
        </p>
        <div className="mt-3 flex items-center gap-1.5 text-cyan-600">
          <Sparkles className="w-3 h-3" />
          <span className="text-[11px] font-medium">AI-powered analysis</span>
        </div>
      </motion.div>

      {/* AI Features */}
      <div className="space-y-4 mb-8">
        {/* AI Chat — Larger, more prominent */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          onClick={() => navigate('ai-chat')}
          className="w-full relative overflow-hidden rounded-2xl p-5 text-left active:scale-[0.98] transition-transform"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-600 opacity-[0.06]" />
          <div className="absolute top-4 right-4 w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25 flex items-center justify-center">
            <MessageSquare className="w-7 h-7 text-white" />
          </div>
          <div className="relative z-10">
            <h3 className="font-bold text-gray-900 text-base">AI Chat Assistant</h3>
            <p className="text-sm text-gray-500 mt-1 pr-16">
              Ask about sales, stock, customers, or get smart recommendations for your CCTV business.
            </p>
            <div className="mt-3 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
              <span className="text-xs text-gray-400 flex-1">Ask about sales, stock, customers...</span>
              <div className="w-7 h-7 rounded-lg bg-cyan-500 flex items-center justify-center flex-shrink-0">
                <Send className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
          </div>
        </motion.button>

        {/* AI Insights */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          onClick={() => navigate('ai-insights')}
          className="w-full relative overflow-hidden rounded-2xl p-5 text-left active:scale-[0.98] transition-transform"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-600 opacity-[0.06]" />
          <div className="absolute top-3 right-3 w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div className="relative z-10">
            <h3 className="font-bold text-gray-900 text-base">AI Insights</h3>
            <p className="text-sm text-gray-500 mt-1 pr-14">
              Get AI-powered analytics, demand forecasting, and business intelligence.
            </p>
          </div>
        </motion.button>
      </div>

      {/* Coming Soon */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Coming Soon
        </h3>
        <div className="space-y-3">
          {comingSoon.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 opacity-60"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">{item.title}</p>
                  <p className="text-xs text-gray-400">{item.desc}</p>
                </div>
                <span className="text-[10px] font-medium text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                  SOON
                </span>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}