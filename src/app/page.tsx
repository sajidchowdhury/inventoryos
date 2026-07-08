'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  Shield,
  Sparkles,
  Zap,
  Building2,
  UserCheck,
  Phone,
  KeyRound,
  Package,
  Hash,
  Users,
  BarChart3,
  Star,
} from 'lucide-react';
import { useAuthStore, type AuthSession } from '@/stores/auth-store';
import { moduleRegistry, getActiveModules, type ModuleRegistryItem } from '@/lib/modules';
import { CCTVShell } from '@/modules/cctv-shop/components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/* ─── Animation Variants ─── */
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};
const stagger = {
  animate: { transition: { staggerChildren: 0.05 } },
};
const slideInRight = {
  initial: { opacity: 0, x: 60 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, x: -60, transition: { duration: 0.2 } },
};
const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.3, type: 'spring', stiffness: 300, damping: 25 } },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.15 } },
};

/* ─── Back Button ─── */
function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center active:bg-gray-200 transition-colors"
    >
      <ArrowLeft className="w-5 h-5 text-gray-600" />
    </button>
  );
}

/* ─── Step: Landing ─── */
function LandingStep({ onFreshSelect, onOwnerFlow, onStaffFlow }: {
  onFreshSelect: (slug: string) => void;
  onOwnerFlow: () => void;
  onStaffFlow: () => void;
}) {
  const activeModules = getActiveModules();
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const expandedMod = activeModules.find((m) => m.slug === expandedSlug);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Hero */}
      <div className="px-6 pt-14 pb-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3 mb-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
              Inventory<span className="text-violet-600">OS</span>
            </h1>
            <p className="text-[11px] text-gray-400 -mt-0.5">Inventory for every business</p>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-sm text-gray-500 leading-relaxed"
        >
          Choose your business type and get started in minutes
        </motion.p>
      </div>

      {/* Business Cards */}
      <div className="flex-1 px-4 pb-4">
        <motion.div
          variants={stagger}
          initial="initial"
          animate="animate"
          className="space-y-3"
        >
          {activeModules.map((mod, idx) => {
            const isExpanded = expandedSlug === mod.slug;
            return (
              <motion.div
                key={mod.slug}
                variants={fadeUp}
                layout
                className="relative"
              >
                <motion.button
                  layout
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setExpandedSlug(isExpanded ? null : mod.slug)}
                  className={`w-full bg-white rounded-2xl border-2 text-left transition-colors duration-200 ${
                    isExpanded ? `${mod.borderColor} shadow-lg` : 'border-gray-100 shadow-sm'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <motion.div
                        layout
                        className={`w-13 h-13 rounded-2xl bg-gradient-to-br ${mod.gradient} flex items-center justify-center shadow-md flex-shrink-0`}
                        style={{ width: 52, height: 52 }}
                      >
                        <span className="text-2xl">{mod.icon}</span>
                      </motion.div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900">{mod.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{mod.tagline}</p>
                      </div>
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      </motion.div>
                    </div>
                  </div>
                </motion.button>

                {/* Expanded Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4">
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 }}
                          className={`${mod.bgColor} rounded-2xl p-4 border ${mod.borderColor}`}
                        >
                          {/* Stats Row */}
                          {mod.stats.length > 0 && (
                            <div className="flex justify-around mb-4 py-2">
                              {mod.stats.map((stat, i) => (
                                <motion.div
                                  key={stat.label}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 0.15 + i * 0.06 }}
                                  className="text-center"
                                >
                                  <p className="text-lg font-extrabold text-gray-900">{stat.value}</p>
                                  <p className="text-[10px] text-gray-500 font-medium">{stat.label}</p>
                                </motion.div>
                              ))}
                            </div>
                          )}

                          {/* Features */}
                          {mod.features.length > 0 && (
                            <div className="space-y-2 mb-5">
                              {mod.features.slice(0, 4).map((f, i) => (
                                <motion.div
                                  key={f.name}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.2 + i * 0.06 }}
                                  className="flex items-center gap-2.5"
                                >
                                  <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${mod.gradient} flex items-center justify-center flex-shrink-0`}>
                                    <Check className="w-3.5 h-3.5 text-white" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-gray-800">{f.name}</p>
                                    <p className="text-[10px] text-gray-500">{f.description}</p>
                                  </div>
                                </motion.div>
                              ))}
                              {mod.features.length > 4 && (
                                <motion.p
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: 0.5 }}
                                  className="text-[10px] text-gray-400 text-center pt-1"
                                >
                                  +{mod.features.length - 4} more features
                                </motion.p>
                              )}
                            </div>
                          )}

                          {/* CTA Button */}
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.45 }}
                          >
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                onFreshSelect(mod.slug);
                              }}
                              className={`w-full h-12 rounded-xl bg-gradient-to-r ${mod.gradient} text-white font-semibold shadow-lg active:scale-[0.98] transition-transform`}
                            >
                              Start with {mod.name}
                              <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                          </motion.div>
                        </motion.div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Bottom: Existing User Options */}
      <div className="px-4 pb-8 pt-2 border-t border-gray-100 bg-white">
        <p className="text-[11px] text-gray-400 text-center mb-3">Already have an account?</p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onOwnerFlow}
            className="flex-1 h-11 rounded-xl border-gray-200 text-gray-700 font-medium text-sm"
          >
            <Building2 className="w-4 h-4 mr-1.5" />
            I own a business
          </Button>
          <Button
            variant="outline"
            onClick={onStaffFlow}
            className="flex-1 h-11 rounded-xl border-gray-200 text-gray-700 font-medium text-sm"
          >
            <UserCheck className="w-4 h-4 mr-1.5" />
            I am staff
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Step: Phone Number (Fresh User) ─── */
function PhoneStep({ selectedSlug, onBack, onVerified }: {
  selectedSlug: string;
  onBack: () => void;
  onVerified: (phone: string) => void;
}) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const mod = moduleRegistry.find((m) => m.slug === selectedSlug);

  const handleSendOTP = async () => {
    if (phone.length < 11) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    setOtpSent(true);
  };

  const handleVerifyOTP = async () => {
    const otpCode = otp.join('');
    if (otpCode.length < 6) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    onVerified(phone);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      const next = document.getElementById(`otp-${index + 1}`);
      next?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prev = document.getElementById(`otp-${index - 1}`);
      prev?.focus();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white px-6">
      <motion.div {...slideInRight} className="pt-14 pb-6">
        <BackButton onClick={onBack} />
      </motion.div>

      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="flex-1"
      >
        {/* Module badge */}
        <motion.div variants={fadeUp} className="flex items-center gap-2 mb-4">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${mod?.gradient} flex items-center justify-center`}>
            <span className="text-sm">{mod?.icon}</span>
          </div>
          <span className="text-xs font-medium text-gray-400">{mod?.name}</span>
        </motion.div>

        <motion.h1 variants={fadeUp} className="text-2xl font-bold text-gray-900">
          {otpSent ? 'Enter OTP' : 'Enter your phone'}
        </motion.h1>
        <motion.p variants={fadeUp} className="text-sm text-gray-500 mt-1">
          {otpSent
            ? `We sent a code to ${phone}`
            : "We'll send a verification code to confirm your number"}
        </motion.p>

        {!otpSent ? (
          <motion.div variants={fadeUp} className="mt-8">
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Phone Number</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">+880</span>
              <Input
                type="tel"
                placeholder="1XXX-XXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                className="h-14 rounded-xl bg-gray-50 border-gray-200 pl-14 text-lg font-semibold focus-visible:ring-violet-500/30"
                maxLength={11}
              />
            </div>
            <motion.div variants={fadeUp} className="mt-6">
              <Button
                onClick={handleSendOTP}
                disabled={loading || phone.length < 11}
                className={`w-full h-12 rounded-xl bg-gradient-to-r ${mod?.gradient || 'from-violet-500 to-purple-600'} text-white font-semibold shadow-lg disabled:opacity-50`}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>Send OTP <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div {...scaleIn} className="mt-8">
            <div className="flex justify-center gap-2.5 mb-6">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-12 h-14 text-center text-xl font-bold rounded-xl border-2 border-gray-200 focus:border-violet-500 focus:outline-none transition-colors bg-gray-50"
                />
              ))}
            </div>
            <Button
              onClick={handleVerifyOTP}
              disabled={loading || otp.join('').length < 6}
              className={`w-full h-12 rounded-xl bg-gradient-to-r ${mod?.gradient || 'from-violet-500 to-purple-600'} text-white font-semibold shadow-lg disabled:opacity-50`}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>Verify & Continue <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
            <button
              onClick={() => { setOtpSent(false); setOtp(['', '', '', '', '', '']); }}
              className="w-full text-center text-xs text-violet-600 font-medium mt-4"
            >
              Change phone number
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

/* ─── Step: Setup Business (Fresh User — no re-selection) ─── */
function SetupBusinessStep({ selectedSlug, phone, onBack, onComplete }: {
  selectedSlug: string;
  phone: string;
  onBack: () => void;
  onComplete: (businessName: string) => void;
}) {
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const mod = moduleRegistry.find((m) => m.slug === selectedSlug);

  const handleCreate = async () => {
    if (!businessName.trim()) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setLoading(false);
    onComplete(businessName.trim());
  };

  return (
    <div className="min-h-screen flex flex-col bg-white px-6">
      <motion.div {...slideInRight} className="pt-14 pb-4">
        <BackButton onClick={onBack} />
      </motion.div>

      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="flex-1"
      >
        {/* Module icon + animated entrance */}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
          className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${mod?.gradient} flex items-center justify-center mb-5 shadow-xl`}
        >
          <span className="text-4xl">{mod?.icon}</span>
        </motion.div>

        <motion.h1 variants={fadeUp} className="text-2xl font-bold text-gray-900">
          Set up your {mod?.name}
        </motion.h1>
        <motion.p variants={fadeUp} className="text-sm text-gray-500 mt-1">
          Give your shop a name to get started
        </motion.p>

        <motion.div variants={fadeUp} className="mt-8">
          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Shop Name</label>
          <Input
            placeholder={`e.g. Dhaka ${mod?.name} Center`}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="h-14 rounded-xl bg-gray-50 border-gray-200 text-lg font-semibold focus-visible:ring-violet-500/30"
            autoFocus
          />
        </motion.div>

        {/* Feature preview with stagger */}
        {mod?.features.length ? (
          <motion.div variants={fadeUp} className="mt-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">You&apos;ll get</p>
            <div className="space-y-2">
              {mod.features.slice(0, 5).map((f, i) => (
                <motion.div
                  key={f.name}
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.07 }}
                  className="flex items-center gap-3"
                >
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${mod?.gradient} flex items-center justify-center flex-shrink-0`}>
                    <Check className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-800">{f.name}</span>
                    <span className="text-xs text-gray-400 ml-1">— {f.description}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : null}

        <motion.div variants={fadeUp} className="mt-8 pb-8">
          <Button
            onClick={handleCreate}
            disabled={loading || !businessName.trim()}
            className={`w-full h-13 rounded-2xl bg-gradient-to-r ${mod?.gradient || 'from-violet-500 to-purple-600'} text-white font-semibold text-base shadow-lg disabled:opacity-50 active:scale-[0.98] transition-transform`}
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

/* ─── Step: Owner Login ─── */
function OwnerLoginStep({ onBack, onLogin }: {
  onBack: () => void;
  onLogin: () => void;
}) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    if (phone.length < 11) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    onLogin();
  };

  return (
    <div className="min-h-screen flex flex-col bg-white px-6">
      <motion.div {...slideInRight} className="pt-14 pb-6">
        <BackButton onClick={onBack} />
        <h1 className="text-2xl font-bold text-gray-900 mt-6">Welcome back</h1>
        <p className="text-sm text-gray-500 mt-1">Sign in to your InventoryOS account</p>
      </motion.div>

      <motion.div variants={stagger} initial="initial" animate="animate" className="flex-1">
        <motion.div variants={fadeUp} className="mt-8">
          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Phone Number</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">+880</span>
            <Input
              type="tel"
              placeholder="1XXX-XXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
              className="h-14 rounded-xl bg-gray-50 border-gray-200 pl-14 text-lg font-semibold focus-visible:ring-violet-500/30"
              maxLength={11}
            />
          </div>
        </motion.div>
        <motion.div variants={fadeUp} className="mt-6">
          <Button
            onClick={handleSendOTP}
            disabled={loading || phone.length < 11}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold shadow-lg disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>
            )}
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ─── Step: Staff Login ─── */
function StaffLoginStep({ onBack, onLogin }: {
  onBack: () => void;
  onLogin: () => void;
}) {
  const [shopCode, setShopCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!shopCode || !username || !password) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    onLogin();
  };

  return (
    <div className="min-h-screen flex flex-col bg-white px-6">
      <motion.div {...slideInRight} className="pt-14 pb-6">
        <BackButton onClick={onBack} />
        <h1 className="text-2xl font-bold text-gray-900 mt-6">Staff Login</h1>
        <p className="text-sm text-gray-500 mt-1">Enter your shop code and credentials</p>
      </motion.div>

      <motion.div variants={stagger} initial="initial" animate="animate" className="flex-1 space-y-4">
        <motion.div variants={fadeUp}>
          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Shop Code</label>
          <Input
            placeholder="e.g. PHA-XK7T"
            value={shopCode}
            onChange={(e) => setShopCode(e.target.value.toUpperCase())}
            className="h-12 rounded-xl bg-gray-50 border-gray-200 font-mono tracking-wider focus-visible:ring-violet-500/30"
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Username</label>
          <Input
            placeholder="Your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-12 rounded-xl bg-gray-50 border-gray-200 focus-visible:ring-violet-500/30"
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Password</label>
          <div className="relative">
            <Input
              type={showPass ? 'text' : 'password'}
              placeholder="Enter password"
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
        <motion.div variants={fadeUp} className="pt-2 pb-8">
          <Button
            onClick={handleLogin}
            disabled={loading || !shopCode || !username || !password}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold shadow-lg disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>Login <ArrowRight className="w-4 h-4 ml-2" /></>
            )}
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ─── Flow Types ─── */
type FlowStep =
  | { type: 'landing' }
  | { type: 'owner-login' }
  | { type: 'staff-login' }
  | { type: 'phone'; slug: string }
  | { type: 'setup'; slug: string; phone: string };

/* ─── Landing Page (Router) ─── */
function LandingPage() {
  const { setSession } = useAuthStore();
  const [step, setStep] = useState<FlowStep>({ type: 'landing' });
  const [loading, setLoading] = useState(false);

  /* Fresh user: select business → phone → OTP → setup → done */
  const handleFreshSelect = (slug: string) => {
    setStep({ type: 'phone', slug });
  };

  const handlePhoneVerified = (phone: string) => {
    const current = step as { type: 'phone'; slug: string };
    setStep({ type: 'setup', slug: current.slug, phone });
  };

  const handleSetupComplete = (businessName: string) => {
    const current = step as { type: 'setup'; slug: string; phone: string };
    const mod = moduleRegistry.find((m) => m.slug === current.slug);

    const session: AuthSession = {
      user: {
        id: 'usr_' + Date.now(),
        name: 'Owner',
        phone: current.phone,
      },
      business: {
        id: 'biz_' + Date.now(),
        name: businessName,
        shopCode: `${mod?.slug.toUpperCase().replace('-', '').slice(0, 4)}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
        address: '',
        phone: '+880' + current.phone,
        businessType: {
          id: mod?.slug || 'cctv-shop',
          name: mod?.name || 'Business',
          slug: mod?.slug || 'cctv-shop',
          icon: mod?.icon || '📦',
        },
      },
    };

    setSession(session);
  };

  /* Owner: login → select business → dashboard (simulated) */
  const handleOwnerLogin = () => {
    // In real app: verify OTP, fetch businesses, let user pick one
    // For now simulate going to dashboard
    const session: AuthSession = {
      user: { id: 'usr_owner', name: 'Shop Owner', phone: '+8801XXX' },
      business: {
        id: 'biz_owner',
        name: 'My Pharmacy',
        shopCode: 'PHA-XK7T',
        address: 'Dhaka',
        phone: '+8801XXX',
        businessType: { id: 'pharmacy', name: 'Pharmacy', slug: 'pharmacy', icon: '💊' },
      },
    };
    setSession(session);
  };

  /* Staff: shop code + credentials → dashboard (simulated) */
  const handleStaffLogin = () => {
    const session: AuthSession = {
      user: { id: 'usr_staff', name: 'Staff User', phone: '' },
      business: {
        id: 'biz_staff',
        name: 'Dhaka CCTV Center',
        shopCode: 'CCTV-001',
        address: 'Dhaka',
        phone: '+8801XXX',
        businessType: { id: 'cctv-shop', name: 'CCTV Shop', slug: 'cctv-shop', icon: '📹' },
      },
    };
    setSession(session);
  };

  const goBack = () => {
    switch (step.type) {
      case 'owner-login':
      case 'staff-login':
        setStep({ type: 'landing' });
        break;
      case 'phone':
        setStep({ type: 'landing' });
        break;
      case 'setup':
        setStep({ type: 'phone', slug: (step as { type: 'setup'; slug: string }).slug });
        break;
    }
  };

  switch (step.type) {
    case 'landing':
      return (
        <LandingStep
          onFreshSelect={handleFreshSelect}
          onOwnerFlow={() => setStep({ type: 'owner-login' })}
          onStaffFlow={() => setStep({ type: 'staff-login' })}
        />
      );
    case 'owner-login':
      return <OwnerLoginStep onBack={goBack} onLogin={handleOwnerLogin} />;
    case 'staff-login':
      return <StaffLoginStep onBack={goBack} onLogin={handleStaffLogin} />;
    case 'phone':
      return (
        <PhoneStep
          selectedSlug={step.slug}
          onBack={goBack}
          onVerified={handlePhoneVerified}
        />
      );
    case 'setup':
      return (
        <SetupBusinessStep
          selectedSlug={step.slug}
          phone={step.phone}
          onBack={goBack}
          onComplete={handleSetupComplete}
        />
      );
  }
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