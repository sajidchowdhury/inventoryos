'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Sparkles, TrendingUp, Lock } from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';

export default function CCTVAIHub() {
  const { navigate } = useCCTVNavStore();

  const features = [
    {
      id: 'ai-chat' as const,
      title: 'AI Chat Assistant',
      description: 'Ask anything about your business, products, or get smart recommendations.',
      icon: MessageSquare,
      color: 'from-violet-500 to-purple-600',
      shadowColor: 'shadow-violet-500/25',
    },
    {
      id: 'ai-insights' as const,
      title: 'AI Insights',
      description: 'Get AI-powered analytics, demand forecasting, and business intelligence.',
      icon: TrendingUp,
      color: 'from-amber-500 to-orange-600',
      shadowColor: 'shadow-amber-500/25',
    },
  ];

  const comingSoon = [
    { title: 'Smart Reordering', icon: Sparkles, desc: 'Auto-suggest restock based on trends' },
    { title: 'Price Optimizer', icon: TrendingUp, desc: 'AI-suggested pricing for max margin' },
    { title: 'Anomaly Detection', icon: Lock, desc: 'Detect unusual patterns in sales/stock' },
  ];

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

      <div className="space-y-4 mb-8">
        {features.map((feature, i) => {
          const Icon = feature.icon;
          return (
            <motion.button
              key={feature.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => navigate(feature.id)}
              className="w-full relative overflow-hidden rounded-2xl p-5 text-left active:scale-[0.98] transition-transform"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-5`} />
              <div className={`absolute top-3 right-3 w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} ${feature.shadowColor} shadow-lg flex items-center justify-center`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div className="relative z-10">
                <h3 className="font-bold text-gray-900 text-base">{feature.title}</h3>
                <p className="text-sm text-gray-500 mt-1 pr-14">{feature.description}</p>
              </div>
            </motion.button>
          );
        })}
      </div>

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