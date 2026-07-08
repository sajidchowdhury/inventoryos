'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Shield,
  Sparkles,
  Zap,
  Users,
  BarChart3,
} from 'lucide-react';
import { useAuthStore, type AuthSession } from '@/stores/auth-store';
import { moduleRegistry, getActiveModules } from '@/lib/modules';
import { CCTVShell } from '@/modules/cctv-shop/components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/* ─── Animated Entry ─── */
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};
const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

/* ─── Landing Page ─── */
function LandingPage() {
  const { setSession } = useAuthStore();
  const [step, setStep] = useState<'landing' | 'auth' | 'business'>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  const activeModules = getActiveModules();

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    // Simulated login — will connect to real auth later
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setStep('business');
  };

  const handleSelectBusiness = (moduleSlug: string) => {
    setSelectedModule(moduleSlug);
    setBusinessName('');
  };

  const handleCreateBusiness = async () => {
    if (!businessName || !selectedModule) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));

    const mod = moduleRegistry.find((m) => m.slug === selectedModule);
    const session: AuthSession = {
      user: {
        id: 'usr_001',
        name: email.split('@')[0] || 'Shop Owner',
        email,
      },
      business: {
        id: 'biz_001',
        name: businessName,
        shopCode: `${mod?.slug.toUpperCase().replace('-', '').slice(0, 4)}-001`,
        address: 'Dhaka, Bangladesh',
        phone: '+880 1XXX-XXXXXX',
        businessType: {
          id: mod?.slug || 'cctv-shop',
          name: mod?.name || 'CCTV Shop',
          slug: mod?.slug || 'cctv-shop',
          icon: mod?.icon || '📹',
        },
      },
    };

    setSession(session);
  };

  /* ── Step: Landing ── */
  if (step === 'landing') {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, type: 'spring' }}
            className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-6 shadow-xl shadow-violet-500/30"
          >
            <span className="text-4xl">📦</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-3xl font-extrabold text-gray-900 tracking-tight"
          >
            Inventory<span className="text-violet-600">OS</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="text-gray-500 mt-2 text-sm max-w-xs"
          >
            Smart inventory management for every business type. Start managing your stock today.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="flex gap-2 mt-3"
          >
            {[Shield, Zap, Sparkles].map((Icon, i) => (
              <div key={i} className="flex items-center gap-1 text-[10px] text-gray-400">
                <Icon className="w-3 h-3" />
                <span>{['Secure', 'Fast', 'AI-Powered'][i]}</span>
              </div>
            ))}
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="px-6 pb-10"
        >
          <Button
            onClick={() => setStep('auth')}
            className="w-full h-13 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-base shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all"
          >
            Get Started
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <p className="text-center text-[11px] text-gray-400 mt-3">
            Trusted by 500+ businesses across Bangladesh
          </p>
        </motion.div>
      </div>
    );
  }

  /* ── Step: Auth ── */
  if (step === 'auth') {
    return (
      <div className="min-h-screen flex flex-col bg-white px-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="pt-14 pb-6"
        >
          <button
            onClick={() => setStep('landing')}
            className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-6"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your InventoryOS account</p>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="initial"
          animate="animate"
          className="flex-1 space-y-4"
        >
          <motion.div variants={fadeUp}>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Email</label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-xl bg-gray-50 border-gray-200 focus-visible:ring-violet-500/30"
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Password</label>
            <div className="relative">
              <Input
                type={showPass ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl bg-gray-50 border-gray-200 pr-10 focus-visible:ring-violet-500/30"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </motion.div>
          <motion.div variants={fadeUp} className="text-right">
            <button className="text-xs text-violet-600 font-medium">Forgot password?</button>
          </motion.div>
          <motion.div variants={fadeUp}>
            <Button
              onClick={handleLogin}
              disabled={loading || !email || !password}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold shadow-lg shadow-violet-500/25 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Sign In'
              )}
            </Button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  /* ── Step: Business Selection ── */
  if (step === 'business') {
    // If a module is selected, show create-business form
    if (selectedModule) {
      const mod = moduleRegistry.find((m) => m.slug === selectedModule);
      return (
        <div className="min-h-screen flex flex-col bg-white px-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="pt-14 pb-6"
          >
            <button
              onClick={() => setSelectedModule(null)}
              className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-6"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${mod?.gradient} flex items-center justify-center mb-4 shadow-lg`}>
              <span className="text-2xl">{mod?.icon}</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Create {mod?.name} Shop</h1>
            <p className="text-sm text-gray-500 mt-1">Set up your {mod?.name?.toLowerCase()} business</p>
          </motion.div>
          <motion.div
            variants={stagger}
            initial="initial"
            animate="animate"
            className="flex-1 space-y-4"
          >
            <motion.div variants={fadeUp}>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Shop Name</label>
              <Input
                placeholder="e.g. Dhaka CCTV Center"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="h-12 rounded-xl bg-gray-50 border-gray-200 focus-visible:ring-violet-500/30"
              />
            </motion.div>
            {mod?.features.length ? (
              <motion.div variants={fadeUp}>
                <label className="text-xs font-semibold text-gray-600 mb-2 block">What you&apos;ll get</label>
                <div className="space-y-2">
                  {mod.features.slice(0, 4).map((f) => (
                    <div key={f.name} className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-violet-600" />
                      </div>
                      <span className="text-xs text-gray-700">{f.name} — {f.description}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : null}
            <motion.div variants={fadeUp} className="pt-4">
              <Button
                onClick={handleCreateBusiness}
                disabled={loading || !businessName.trim()}
                className={`w-full h-12 rounded-xl bg-gradient-to-r ${mod?.gradient || 'from-violet-500 to-purple-600'} text-white font-semibold shadow-lg disabled:opacity-50`}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Create & Enter
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </motion.div>
          </motion.div>
        </div>
      );
    }

    // Module selection grid
    return (
      <div className="min-h-screen flex flex-col bg-gray-50/80">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white px-6 pt-14 pb-6 border-b border-gray-100"
        >
          <button
            onClick={() => setStep('auth')}
            className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-6"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Choose Your Business</h1>
          <p className="text-sm text-gray-500 mt-1">Select a module to set up your business</p>
        </motion.div>

        <div className="flex-1 px-4 py-6 pb-10">
          <motion.div
            variants={stagger}
            initial="initial"
            animate="animate"
            className="space-y-3"
          >
            {activeModules.map((mod) => (
              <motion.button
                key={mod.slug}
                variants={fadeUp}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelectBusiness(mod.slug)}
                className={`w-full bg-white rounded-2xl border ${mod.borderColor} p-4 text-left active:scale-[0.98] transition-transform shadow-sm`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${mod.gradient} flex items-center justify-center shadow-md flex-shrink-0`}>
                    <span className="text-2xl">{mod.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900">{mod.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{mod.tagline}</p>
                    {mod.stats.length > 0 && (
                      <div className="flex gap-3 mt-2.5">
                        {mod.stats.slice(0, 3).map((stat) => (
                          <div key={stat.label} className="text-center">
                            <p className="text-xs font-bold text-gray-800">{stat.value}</p>
                            <p className="text-[10px] text-gray-400">{stat.label}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0 mt-2" />
                </div>
                {mod.features.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex flex-wrap gap-1.5">
                      {mod.features.slice(0, 4).map((f) => (
                        <span
                          key={f.name}
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${mod.bgColor} text-gray-600`}
                        >
                          {f.icon} {f.name}
                        </span>
                      ))}
                      {mod.features.length > 4 && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          +{mod.features.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </motion.button>
            ))}
          </motion.div>
        </div>
      </div>
    );
  }

  return null;
}

/* ─── Dashboard Step (post-auth) ─── */
function DashboardStep() {
  const session = useAuthStore((s) => s.session);
  if (!session) return null;
  const slug = session.business.businessType.slug;

  switch (slug) {
    case 'cctv-shop':
      return <CCTVShell />;
    case 'pharmacy':
    default:
      // Pharmacy shell placeholder
      return (
        <div className="min-h-screen bg-gray-50/80 flex items-center justify-center">
          <div className="text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">💊</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900">Pharmacy Module</h2>
            <p className="text-sm text-gray-500 mt-1">Coming soon</p>
          </div>
        </div>
      );
  }
}

/* ─── Main Page ─── */
export default function Home() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <AnimatePresence mode="wait">
      {!isAuthenticated ? (
        <motion.div
          key="landing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <LandingPage />
        </motion.div>
      ) : (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <DashboardStep />
        </motion.div>
      )}
    </AnimatePresence>
  );
}