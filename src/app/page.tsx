'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Package,
  Users,
  Store,
  Shield,
  BarChart3,
  Smartphone,
  Zap,
  LogIn,
  UserPlus,
  ChevronRight,
  X,
  PackageSearch,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { useAuthStore, type AuthSession } from '@/stores/auth-store';
import { moduleRegistry, type ModuleRegistryItem } from '@/lib/modules';
import { MSShell } from '@/modules/mobile-shop/components';
import { CCTVShell } from '@/modules/cctv-shop/components/CCTVShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

/* ── Dynamic imports ── */
const PharmacyShell = dynamic(
  () => import('@/modules/pharmacy/components').then((m) => m.PharmacyShell),
  {
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    ),
    ssr: false,
  }
);

/* ── Types ── */
interface VerifiedPhoneData {
  phone: string;
  userId: string;
  phoneToken: string;
  businesses: {
    id: string;
    name: string;
    address: string | null;
    shopCode: string | null;
    businessType: { slug: string; name: string; color: string; icon: string };
    hasCredentials: boolean;
    businessUsers: { id: string; username: string; role: string }[];
  }[];
}

/* ── Animation Variants ── */
const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2 } },
};

const slideUp = {
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: 20, transition: { duration: 0.2 } },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } },
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

/* ── View type ── */
type AppView = 'landing' | 'admin-login' | 'staff-login';
type AdminStep = 'choose-path' | 'phone' | 'otp' | 'business-list' | 'register-type' | 'register';

/* ────────────────────────────────────────────
   MAIN PAGE COMPONENT
   ──────────────────────────────────────────── */
export default function HomePage() {
  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);
  const logout = useAuthStore((s) => s.logout);
  const [hydrated, setHydrated] = useState(false);
  const [validating, setValidating] = useState(false);
  const [view, setView] = useState<AppView>('landing');
  const [preselectedSlug, setPreselectedSlug] = useState<string | null>(null);

  // Hydrate from localStorage (Zustand persist) + validate stored session
  useEffect(() => {
    // Mark hydrated and validate session in a microtask to avoid sync setState in effect
    const init = async () => {
      // Wait for Zustand persist to hydrate
      await useAuthStore.persist.rehydrate();

      const token = useAuthStore.getState().session?.sessionToken;
      if (!token) return;

      setValidating(true);
      try {
        const res = await fetch('/api/auth/validate-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (data.success) {
          setSession({
            sessionToken: data.session.token,
            expiresAt: data.session.expiresAt,
            user: {
              id: data.user.id,
              name: data.user.fullName || data.user.username || '',
              username: data.user.username,
              role: data.user.role,
            },
            permissions: data.permissions || {},
            business: {
              id: data.business.id,
              name: data.business.name,
              shopCode: data.business.shopCode || '',
              address: data.business.address || '',
              phone: useAuthStore.getState().session?.business?.phone || '',
              businessType: data.business.businessType,
            },
          });
        } else {
          // Session invalid/expired — clear it
          logout();
        }
      } catch {
        // Network error — keep session, will be validated on next API call
      } finally {
        setValidating(false);
      }
    };

    setHydrated(true);
    init();
  }, [setSession, logout]);

  const goAdminLogin = useCallback((slug?: string) => {
    setPreselectedSlug(slug || null);
    setView('admin-login');
  }, []);
  const goStaffLogin = useCallback(() => setView('staff-login'), []);
  const goLanding = useCallback(() => {
    setView('landing');
    setPreselectedSlug(null);
  }, []);

  // Show loading while hydrating or validating
  if (!hydrated || validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // If authenticated, show dashboard
  if (session) return <DashboardView />;

  return (
    <AnimatePresence mode="wait">
      {view === 'landing' && (
        <LandingView
          key="landing"
          onAdminLogin={() => goAdminLogin()}
          onStaffLogin={goStaffLogin}
          onGetStarted={(slug) => goAdminLogin(slug)}
        />
      )}
      {view === 'admin-login' && (
        <AdminLoginView
          key="admin-login"
          preselectedSlug={preselectedSlug}
          onBack={goLanding}
          onSwitchToStaff={goStaffLogin}
        />
      )}
      {view === 'staff-login' && (
        <StaffLoginView
          key="staff-login"
          onBack={goLanding}
          onSwitchToAdmin={() => goAdminLogin()}
        />
      )}
    </AnimatePresence>
  );
}

/* ────────────────────────────────────────────
   DASHBOARD VIEW
   ──────────────────────────────────────────── */
function DashboardView() {
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);
  if (!session) return null;

  const slug = session.business.businessType.slug;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        {slug === 'mobile-shop' && <MSShell />}
        {slug === 'pharmacy' && <PharmacyShell />}
        {slug === 'cctv-shop' && <CCTVShell />}
        {!['mobile-shop', 'pharmacy', 'cctv-shop'].includes(slug) && (
          <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-50 px-4">
            <div className="text-6xl">{session.business.businessType.icon}</div>
            <h2 className="text-2xl font-bold text-gray-900">{session.business.businessType.name}</h2>
            <p className="text-gray-500 text-center max-w-md">
              This module is under development. We&apos;re working hard to bring you the best experience.
            </p>
            <button
              onClick={logout}
              className="px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   LANDING PAGE
   ──────────────────────────────────────────── */
function LandingView({
  onAdminLogin,
  onStaffLogin,
  onGetStarted,
}: {
  onAdminLogin: () => void;
  onStaffLogin: () => void;
  onGetStarted: (slug: string) => void;
}) {
  const [detailModule, setDetailModule] = useState<ModuleRegistryItem | null>(null);

  return (
    <motion.div
      {...fadeIn}
      className="min-h-screen flex flex-col bg-white"
    >
      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Package className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900 tracking-tight">
                InventoryOS
              </span>
            </div>
            {/* CTA Buttons */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:flex h-9 px-4 text-sm font-medium"
                onClick={onAdminLogin}
              >
                <LogIn className="w-4 h-4 mr-1.5" />
                Login
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:flex h-9 px-4 text-sm font-medium"
                onClick={onStaffLogin}
              >
                Staff Login
              </Button>
              {/* Mobile: just show Login */}
              <Button
                variant="outline"
                size="sm"
                className="sm:hidden h-9 px-3 text-sm font-medium"
                onClick={onAdminLogin}
              >
                <LogIn className="w-4 h-4 mr-1" />
                Login
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero Section ── */}
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }} />
          {/* Gradient orbs */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-3xl mx-auto text-center"
            >
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.4 }}
              >
                <Badge variant="outline" className="mb-6 px-3 py-1 text-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-xs sm:text-sm">
                  <Zap className="w-3 h-3 mr-1" />
                  AI-Powered Business Management
                </Badge>
              </motion.div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight mb-6">
                Smart Business{' '}
                <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                  Management
                </span>
                <br className="hidden sm:block" />
                {' '}for Every Trade
              </h1>

              {/* Subtitle */}
              <p className="text-base sm:text-lg lg:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
                Complete inventory, sales, and operations management platform.
                Start free in minutes, scale with AI-powered insights.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                <Button
                  size="lg"
                  className="w-full sm:w-auto h-12 px-8 text-base font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25"
                  onClick={() => {
                    document.getElementById('solutions')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Explore Solutions
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <button
                  onClick={onAdminLogin}
                  className="w-full sm:w-auto h-12 px-8 text-base font-semibold border border-white/30 text-white bg-white/10 backdrop-blur-sm rounded-lg hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  Login
                </button>
              </div>

              {/* Quick stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-slate-400"
              >
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-emerald-500" />
                  <span>7 Business Types</span>
                </div>
                <div className="hidden sm:block w-1 h-1 rounded-full bg-slate-600" />
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-500" />
                  <span>Mobile First</span>
                </div>
                <div className="hidden sm:block w-1 h-1 rounded-full bg-slate-600" />
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span>AI Insights</span>
                </div>
                <div className="hidden sm:block w-1 h-1 rounded-full bg-slate-600" />
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  <span>Secure</span>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── Quick Access for Returning Users ── */}
        <section className="bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4 }}
            >
              <p className="text-center text-sm font-medium text-gray-500 mb-4 uppercase tracking-wider">
                Already have an account?
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                <button
                  onClick={onAdminLogin}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gray-900 text-white font-medium hover:bg-gray-800 transition-all active:scale-[0.98]"
                >
                  <LogIn className="w-4 h-4" />
                  Admin / Owner Login
                </button>
                <button
                  onClick={onStaffLogin}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-all active:scale-[0.98]"
                >
                  <Users className="w-4 h-4" />
                  Staff Login
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Business Solutions ── */}
        <section id="solutions" className="bg-gray-50/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12 sm:mb-16"
            >
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                Solutions for Your Business
              </h2>
              <p className="text-gray-500 text-base sm:text-lg max-w-xl mx-auto">
                Choose the right tools tailored to your trade. Each module is built with industry-specific features.
              </p>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, margin: '-60px' }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5"
            >
              {moduleRegistry.map((mod) => (
                <motion.div key={mod.slug} variants={fadeUp}>
                  <button
                    onClick={() => setDetailModule(mod)}
                    className="w-full text-left group"
                  >
                    <Card className="relative overflow-hidden border-gray-200/80 bg-white hover:shadow-lg hover:shadow-gray-200/50 hover:border-gray-300 transition-all duration-300 h-full cursor-pointer">
                      {!mod.isActive && (
                        <div className="absolute top-3 right-3 z-10">
                          <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 border-gray-200">
                            Coming Soon
                          </Badge>
                        </div>
                      )}
                      <CardContent className="pt-6 pb-6">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${mod.gradient} flex items-center justify-center text-2xl mb-4 shadow-sm`}>
                          {mod.icon}
                        </div>
                        <h3 className="font-semibold text-gray-900 text-base mb-1 group-hover:text-emerald-700 transition-colors">
                          {mod.name}
                        </h3>
                        <p className="text-sm text-gray-500 leading-relaxed">
                          {mod.tagline}
                        </p>
                        {mod.isActive && (
                          <div className="mt-4 flex items-center text-sm font-medium text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            Learn more <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </button>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section className="bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12 sm:mb-16"
            >
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                Get Started in Minutes
              </h2>
              <p className="text-gray-500 text-base sm:text-lg max-w-xl mx-auto">
                Three simple steps to transform your business operations.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
              {[
                {
                  step: '01',
                  icon: <PackageSearch className="w-6 h-6" />,
                  title: 'Choose Your Business Type',
                  desc: 'Select from 7 industry-specific modules designed for your trade.',
                },
                {
                  step: '02',
                  icon: <Smartphone className="w-6 h-6" />,
                  title: 'Verify & Set Up',
                  desc: 'Enter your phone, verify with OTP, and set up your business details.',
                },
                {
                  step: '03',
                  icon: <BarChart3 className="w-6 h-6" />,
                  title: 'Start Managing',
                  desc: 'Add products, manage inventory, process sales, and grow with AI insights.',
                },
              ].map((item, i) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="relative text-center"
                >
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 mb-5">
                    {item.icon}
                  </div>
                  <div className="text-xs font-bold text-emerald-500 tracking-widest mb-2">
                    STEP {item.step}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
                    {item.desc}
                  </p>
                  {i < 2 && (
                    <div className="hidden md:block absolute top-7 -right-6 lg:-right-8 w-12 lg:w-16">
                      <ArrowRight className="w-full h-5 text-gray-300" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Section ── */}
        <section className="bg-gradient-to-b from-gray-50 to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl sm:rounded-3xl px-6 py-12 sm:py-16 lg:py-20"
            >
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">
                Ready to Manage Smarter?
              </h2>
              <p className="text-slate-300 text-base sm:text-lg max-w-lg mx-auto mb-8">
                Join hundreds of businesses already using InventoryOS to streamline their operations.
              </p>
              <Button
                size="lg"
                className="h-12 px-8 text-base font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25"
                onClick={() => {
                  document.getElementById('solutions')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Get Started Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Package className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-700">InventoryOS</span>
            </div>
            <p className="text-xs text-gray-400">
              &copy; {new Date().getFullYear()} InventoryOS. Smart Business Management.
            </p>
            <div className="flex items-center gap-4">
              <button onClick={onAdminLogin} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                Login
              </button>
              <button onClick={onStaffLogin} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                Staff Login
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* ── Business Detail Sheet ── */}
      <Sheet open={!!detailModule} onOpenChange={(open) => !open && setDetailModule(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] sm:max-h-[80vh] overflow-y-auto rounded-t-2xl">
          {detailModule && (
            <BusinessDetailSheet
              module={detailModule}
              onGetStarted={() => {
                setDetailModule(null);
                onGetStarted(detailModule.slug);
              }}
              onClose={() => setDetailModule(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}

/* ── Business Detail Sheet Content ── */
function BusinessDetailSheet({
  module,
  onGetStarted,
  onClose,
}: {
  module: ModuleRegistryItem;
  onGetStarted: () => void;
  onClose: () => void;
}) {
  return (
    <div className="pb-8">
      <SheetHeader className="text-left mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${module.gradient} flex items-center justify-center text-2xl shadow-sm`}>
              {module.icon}
            </div>
            <div>
              <SheetTitle className="text-xl">{module.name}</SheetTitle>
              <SheetDescription className="text-sm mt-0.5">{module.tagline}</SheetDescription>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </SheetHeader>

      <p className="text-gray-600 text-sm leading-relaxed mb-6 px-1">
        {module.description}
      </p>

      {module.features.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-3 px-1">Key Features</h4>
          <div className="space-y-2.5">
            {module.features.map((f) => (
              <div key={f.name} className="flex items-start gap-3 px-1">
                <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-emerald-600" />
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-800">{f.name}</span>
                  <span className="text-sm text-gray-500 ml-1">— {f.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {module.stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {module.stats.map((s) => (
            <div key={s.label} className="text-center p-3 rounded-xl bg-gray-50">
              <div className="text-lg font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <Button
        size="lg"
        className="w-full h-12 text-base font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/20"
        onClick={onGetStarted}
      >
        <UserPlus className="w-4 h-4 mr-2" />
        Get Started with {module.name}
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}

/* ────────────────────────────────────────────
   ADMIN / OWNER LOGIN VIEW
   Flow:
     1. Choose Path → "Login to existing" | "Create new business"
     2a. Login: Phone → OTP → Business List → Select → Auto-login
     2b. New: Choose Business Type → Phone → OTP → Shop Details → Auto-login
   ──────────────────────────────────────────── */
function AdminLoginView({
  preselectedSlug,
  onBack,
  onSwitchToStaff,
}: {
  preselectedSlug: string | null;
  onBack: () => void;
  onSwitchToStaff: () => void;
}) {
  const setSession = useAuthStore((s) => s.setSession);
  // If preselectedSlug is set, skip choose-path and go straight to register-type
  const [step, setStep] = useState<AdminStep>(preselectedSlug ? 'register-type' : 'choose-path');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Phone step
  const [phoneDigits, setPhoneDigits] = useState('');
  // OTP step
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [phoneToken, setPhoneToken] = useState('');
  const [userId, setUserId] = useState('');
  // Business list
  const [businesses, setBusinesses] = useState<VerifiedPhoneData['businesses']>([]);
  // Register step
  const [regBusinessName, setRegBusinessName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [regBusinessTypeId, setRegBusinessTypeId] = useState(preselectedSlug || '');

  // Auto-set business type from preselected slug
  useEffect(() => {
    if (preselectedSlug) {
      setRegBusinessTypeId(preselectedSlug);
    }
  }, [preselectedSlug]);

  const handleSendOtp = useCallback(async () => {
    if (phoneDigits.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const fullPhone = '0' + phoneDigits;
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
      setDemoOtp(data.demoOtp || '');
      setStep('otp');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [phoneDigits]);

  const handleVerifyOtp = useCallback(async () => {
    if (otp.length !== 4) {
      setError('Please enter the 4-digit OTP');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const fullPhone = '0' + phoneDigits;
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      setPhoneToken(data.phoneToken);
      setUserId(data.user.id);
      if (data.businesses && data.businesses.length > 0) {
        setBusinesses(data.businesses);
        setStep('business-list');
      } else {
        // New user — go to registration details
        setStep('register');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [phoneDigits, otp]);

  const handleSelectBusiness = useCallback(
    async (biz: VerifiedPhoneData['businesses'][0]) => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/auth/owner-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneToken, businessId: biz.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        setSession({
          sessionToken: data.session.token,
          expiresAt: data.session.expiresAt,
          user: {
            id: data.user.id,
            name: data.user.fullName || data.user.username || '',
            username: data.user.username,
            role: data.user.role,
            phone: phoneDigits ? '0' + phoneDigits : undefined,
          },
          permissions: data.permissions || {},
          business: {
            id: data.business.id,
            name: data.business.name,
            shopCode: data.business.shopCode || '',
            address: data.business.address || '',
            phone: '',
            businessType: data.business.businessType,
          },
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Login failed');
        setLoading(false);
      }
    },
    [phoneToken, phoneDigits, setSession]
  );

  const handleRegister = useCallback(async () => {
    if (!regBusinessName.trim() || !regUsername.trim() || !regPassword.trim()) {
      setError('All fields are required');
      return;
    }
    if (regUsername.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (regPassword.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }
    const btSlug = regBusinessTypeId || preselectedSlug;
    if (!btSlug) {
      setError('Please select a business type');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Register
      const regRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          businessTypeId: btSlug,
          businessName: regBusinessName.trim(),
          username: regUsername.trim(),
          password: regPassword,
        }),
      });
      const regData = await regRes.json();
      if (!regRes.ok) throw new Error(regData.error || 'Registration failed');

      // Auto-login after registration
      const loginRes = await fetch('/api/auth/owner-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneToken, businessId: regData.business.id }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) throw new Error(loginData.error || 'Auto-login failed');

      setSession({
        sessionToken: loginData.session.token,
        expiresAt: loginData.session.expiresAt,
        user: {
          id: loginData.user.id,
          name: loginData.user.fullName || loginData.user.username || '',
          username: loginData.user.username,
          role: loginData.user.role,
          phone: phoneDigits ? '0' + phoneDigits : undefined,
        },
        permissions: loginData.permissions || {},
        business: {
          id: loginData.business.id,
          name: loginData.business.name,
          shopCode: loginData.business.shopCode || '',
          address: loginData.business.address || '',
          phone: '',
          businessType: loginData.business.businessType,
        },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      setLoading(false);
    }
  }, [regBusinessName, regUsername, regPassword, regBusinessTypeId, preselectedSlug, userId, phoneToken, phoneDigits, setSession]);

  return (
    <motion.div
      {...fadeIn}
      className="min-h-screen bg-gray-50 flex flex-col"
    >
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Home</span>
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Package className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900">InventoryOS</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <AnimatePresence mode="wait">
          {/* ── Step: Choose Path ── */}
          {step === 'choose-path' && (
            <motion.div key="choose-path" {...slideUp} className="w-full max-w-md">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-6 sm:p-8">
                <div className="text-center mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                    <LogIn className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Welcome to InventoryOS</h2>
                  <p className="text-sm text-gray-500 mt-2">
                    How would you like to continue?
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Login to existing business */}
                  <button
                    onClick={() => setStep('phone')}
                    className="w-full flex items-center gap-4 p-5 rounded-xl border-2 border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/30 transition-all text-left group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">Login to Existing Business</p>
                      <p className="text-xs text-gray-500 mt-0.5">Verify phone number to access your businesses</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-emerald-600 transition-colors flex-shrink-0" />
                  </button>

                  {/* Create new business */}
                  <button
                    onClick={() => setStep('register-type')}
                    className="w-full flex items-center gap-4 p-5 rounded-xl border-2 border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/30 transition-all text-left group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                      <UserPlus className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">Create New Business</p>
                      <p className="text-xs text-gray-500 mt-0.5">Set up a new business account in minutes</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-emerald-600 transition-colors flex-shrink-0" />
                  </button>
                </div>

                <Separator className="my-6" />

                <p className="text-center text-sm text-gray-400">
                  Staff member?{' '}
                  <button
                    onClick={onSwitchToStaff}
                    className="text-violet-600 font-medium hover:underline"
                  >
                    Login with shop code
                  </button>
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Step: Register Type (Choose Business Type for new business) ── */}
          {step === 'register-type' && (
            <motion.div key="register-type" {...slideUp} className="w-full max-w-md">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-6 sm:p-8">
                <div className="text-center mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                    <UserPlus className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Create Your Business</h2>
                  <p className="text-sm text-gray-500 mt-2">
                    Choose your business type to get started
                  </p>
                </div>

                {error && (
                  <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>
                )}

                <div className="grid grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {moduleRegistry.map((mod) => (
                    <button
                      key={mod.slug}
                      type="button"
                      onClick={() => {
                        setRegBusinessTypeId(mod.slug);
                        setStep('phone');
                        setError('');
                      }}
                      disabled={!mod.isActive}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left text-sm transition-all ${
                        regBusinessTypeId === mod.slug
                          ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/20'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      } ${!mod.isActive ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <span className="text-lg">{mod.icon}</span>
                      <span className="font-medium truncate text-gray-800">{mod.name}</span>
                    </button>
                  ))}
                </div>

                <Separator className="my-5" />

                <button
                  onClick={() => setStep('choose-path')}
                  className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors py-1"
                >
                  &larr; Back to login options
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step: Phone ── */}
          {step === 'phone' && (
            <motion.div key="phone" {...slideUp} className="w-full max-w-md">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-6 sm:p-8">
                <div className="text-center mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                    <LogIn className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                    {regBusinessTypeId ? 'Verify Your Phone' : 'Login to Your Account'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-2">
                    {regBusinessTypeId
                      ? `Creating ${moduleRegistry.find(m => m.slug === regBusinessTypeId)?.name || 'business'} — verify your phone`
                      : "We'll verify your phone number with an OTP"}
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Show selected business type badge if creating new */}
                  {regBusinessTypeId && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                      <span className="text-base">
                        {moduleRegistry.find((m) => m.slug === regBusinessTypeId)?.icon}
                      </span>
                      <span className="text-sm font-medium text-emerald-800">
                        {moduleRegistry.find((m) => m.slug === regBusinessTypeId)?.name}
                      </span>
                      <Check className="w-4 h-4 text-emerald-600 ml-auto" />
                    </div>
                  )}

                  <div>
                    <Label className="mb-2">Phone Number</Label>
                    <div className="flex items-stretch">
                      <div className="flex items-center px-4 bg-gray-50 border border-r-0 border-gray-200 rounded-l-xl text-sm font-medium text-gray-600">
                        +880
                      </div>
                      <Input
                        type="tel"
                        inputMode="numeric"
                        placeholder="1XXXXXXXXX"
                        maxLength={10}
                        value={phoneDigits}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setPhoneDigits(val);
                          setError('');
                        }}
                        className="rounded-l-none h-12 text-base tracking-wider"
                        autoFocus
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5 ml-1">
                      Enter your 10-digit phone number (without 880)
                    </p>
                  </div>

                  {error && (
                    <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                  )}

                  <Button
                    size="lg"
                    className="w-full h-12 text-base font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                    onClick={handleSendOtp}
                    disabled={loading || phoneDigits.length !== 10}
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        Send OTP
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>

                <Separator className="my-6" />

                <button
                  onClick={() => setStep(regBusinessTypeId ? 'register-type' : 'choose-path')}
                  className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors py-1"
                >
                  &larr; Back
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step: OTP ── */}
          {step === 'otp' && (
            <motion.div key="otp" {...slideUp} className="w-full max-w-md">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-6 sm:p-8">
                <div className="text-center mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Verify OTP</h2>
                  <p className="text-sm text-gray-500 mt-2">
                    Sent to +880 {phoneDigits}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="mb-2">Enter 4-digit OTP</Label>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      placeholder="0000"
                      maxLength={4}
                      value={otp}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setOtp(val);
                        setError('');
                      }}
                      className="h-14 text-center text-2xl font-bold tracking-[0.5em]"
                      autoFocus
                    />
                  </div>

                  {demoOtp && (
                    <p className="text-xs text-center text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
                      Demo OTP: <span className="font-bold">{demoOtp}</span>
                    </p>
                  )}

                  {error && (
                    <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                  )}

                  <Button
                    size="lg"
                    className="w-full h-12 text-base font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                    onClick={handleVerifyOtp}
                    disabled={loading || otp.length !== 4}
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        Verify & Continue
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>

                  <button
                    onClick={handleSendOtp}
                    disabled={loading}
                    className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors py-1"
                  >
                    Resend OTP
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Step: Business List ── */}
          {step === 'business-list' && (
            <motion.div key="biz-list" {...slideUp} className="w-full max-w-md">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-6 sm:p-8">
                <div className="text-center mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                    <Store className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Select Your Business</h2>
                  <p className="text-sm text-gray-500 mt-2">
                    Choose a business to manage
                  </p>
                </div>

                {error && (
                  <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>
                )}

                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {businesses.map((biz) => (
                    <button
                      key={biz.id}
                      onClick={() => handleSelectBusiness(biz)}
                      disabled={loading}
                      className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all text-left group disabled:opacity-50"
                    >
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">
                        {biz.businessType.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{biz.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {biz.businessType.name} {biz.shopCode ? `· ${biz.shopCode}` : ''}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 transition-colors flex-shrink-0" />
                    </button>
                  ))}
                </div>

                <Separator className="my-5" />

                <button
                  onClick={() => setStep('register')}
                  disabled={loading}
                  className="w-full text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors py-1"
                >
                  + Create a new business
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step: Register (Shop Details) ── */}
          {step === 'register' && (
            <motion.div key="register" {...slideUp} className="w-full max-w-md">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-6 sm:p-8">
                <div className="text-center mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                    <UserPlus className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Set Up Your Business</h2>
                  <p className="text-sm text-gray-500 mt-2">
                    Almost there! Fill in your business details
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Show selected business type */}
                  {regBusinessTypeId && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <span className="text-lg">
                        {moduleRegistry.find((m) => m.slug === regBusinessTypeId)?.icon}
                      </span>
                      <span className="text-sm font-medium text-emerald-800">
                        {moduleRegistry.find((m) => m.slug === regBusinessTypeId)?.name}
                      </span>
                      <Check className="w-4 h-4 text-emerald-600 ml-auto" />
                    </div>
                  )}

                  {/* Business Type Selector (only if not preselected) */}
                  {!regBusinessTypeId && (
                    <div>
                      <Label className="mb-2">Business Type</Label>
                      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                        {moduleRegistry.map((mod) => (
                          <button
                            key={mod.slug}
                            type="button"
                            onClick={() => {
                              setRegBusinessTypeId(mod.slug);
                              setError('');
                            }}
                            disabled={!mod.isActive}
                            className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-sm transition-all ${
                              regBusinessTypeId === mod.slug
                                ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/20'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            } ${!mod.isActive ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                            <span className="text-base">{mod.icon}</span>
                            <span className="font-medium truncate text-gray-800">{mod.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="mb-2">Business / Shop Name</Label>
                    <Input
                      placeholder={regBusinessTypeId === 'pharmacy' ? 'e.g. My Creative Code' : regBusinessTypeId === 'mobile-shop' ? 'e.g. My Creative CC' : 'e.g. MedPlus Pharmacy'}
                      value={regBusinessName}
                      onChange={(e) => {
                        setRegBusinessName(e.target.value);
                        setError('');
                      }}
                      className="h-11"
                      autoFocus={!regBusinessTypeId}
                    />
                  </div>

                  <div>
                    <Label className="mb-2">Admin Username</Label>
                    <Input
                      placeholder="e.g. admin"
                      value={regUsername}
                      onChange={(e) => {
                        setRegUsername(e.target.value);
                        setError('');
                      }}
                      className="h-11"
                    />
                  </div>

                  <div>
                    <Label className="mb-2">Password</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Min 4 characters"
                        value={regPassword}
                        onChange={(e) => {
                          setRegPassword(e.target.value);
                          setError('');
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                        className="h-11 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                  )}

                  <Button
                    size="lg"
                    className="w-full h-12 text-base font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                    onClick={handleRegister}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        Create & Login
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>

                  {businesses.length > 0 && (
                    <button
                      onClick={() => {
                        setStep('business-list');
                        setError('');
                      }}
                      className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors py-1"
                    >
                      &larr; Back to business list
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────
   STAFF LOGIN VIEW
   ──────────────────────────────────────────── */
function StaffLoginView({ onBack, onSwitchToAdmin }: { onBack: () => void; onSwitchToAdmin: () => void }) {
  const setSession = useAuthStore((s) => s.setSession);
  const [shopCode, setShopCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = useCallback(async () => {
    if (!shopCode.trim() || !username.trim() || !password) {
      setError('All fields are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopCode: shopCode.trim().toUpperCase(),
          username: username.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      setSession({
        sessionToken: data.session.token,
        expiresAt: data.session.expiresAt,
        user: {
          id: data.user.id,
          name: data.user.fullName || data.user.username || '',
          username: data.user.username,
          role: data.user.role,
        },
        permissions: data.permissions || {},
        business: {
          id: data.business.id,
          name: data.business.name,
          shopCode: data.business.shopCode || '',
          address: data.business.address || '',
          phone: '',
          businessType: data.business.businessType,
        },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoading(false);
    }
  }, [shopCode, username, password, setSession]);

  return (
    <motion.div
      {...fadeIn}
      className="min-h-screen bg-gray-50 flex flex-col"
    >
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Home</span>
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Package className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900">InventoryOS</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <motion.div {...slideUp} className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-6 sm:p-8">
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-violet-600" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Staff Login</h2>
              <p className="text-sm text-gray-500 mt-2">
                Enter your shop code, username, and password
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="mb-2">Shop Code</Label>
                <Input
                  placeholder="e.g. PHA-XK7T"
                  value={shopCode}
                  onChange={(e) => {
                    setShopCode(e.target.value.toUpperCase());
                    setError('');
                  }}
                  className="h-11 font-mono tracking-wider"
                  autoFocus
                />
              </div>

              <div>
                <Label className="mb-2">Username</Label>
                <Input
                  placeholder="Your username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError('');
                  }}
                  className="h-11"
                />
              </div>

              <div>
                <Label className="mb-2">Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <Button
                size="lg"
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                onClick={handleLogin}
                disabled={loading || !shopCode.trim() || !username.trim() || !password}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Login
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>

            <Separator className="my-6" />

            <p className="text-center text-sm text-gray-400">
              Business owner?{' '}
              <button
                onClick={onSwitchToAdmin}
                className="text-emerald-600 font-medium hover:underline"
              >
                Login with phone number
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}