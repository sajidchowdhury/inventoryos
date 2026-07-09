'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useSpring } from 'framer-motion';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  Building2,
  UserCheck,
  Package,
} from 'lucide-react';
import { useAuthStore, type AuthSession } from '@/stores/auth-store';
import { moduleRegistry, getActiveModules } from '@/lib/modules';
import { CCTVShell } from '@/modules/cctv-shop/components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/* ═══════════════════════════════════════════
   ANIMATION VARIANTS
   ═══════════════════════════════════════════ */
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = {
  animate: { transition: { staggerChildren: 0.07 } },
};
const slideInRight = {
  initial: { opacity: 0, x: 60 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, x: -60, transition: { duration: 0.2 } },
};
const scaleIn = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.35, type: 'spring', stiffness: 300, damping: 25 } },
  exit: { opacity: 0, scale: 0.92, transition: { duration: 0.15 } },
};

/* ─── Animated Stat with count-up via framer-motion spring ─── */
function AnimatedStat({ label, value, delay }: { label: string; value: string; delay: number }) {
  const numericPart = value.replace(/[^0-9]/g, '');
  const suffix = value.replace(/[0-9,]/g, '');
  const targetNum = parseInt(numericPart.replace(/,/g, ''), 10) || 0;
  const spring = useSpring(0, { duration: 700, bounce: 0 });
  const [display, setDisplay] = useState('0');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(true);
      spring.set(targetNum);
    }, delay * 1000);
    return () => clearTimeout(t);
  }, [delay, targetNum, spring]);

  useEffect(() => {
    const unsubscribe = spring.on('change', (v) => {
      setDisplay(Math.round(v).toLocaleString() + suffix);
    });
    return unsubscribe;
  }, [spring, suffix]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={visible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4 }}
      className="text-center"
    >
      <p className="text-xl font-extrabold text-gray-900">{display}</p>
      <p className="text-[10px] text-gray-500 font-medium mt-0.5">{label}</p>
    </motion.div>
  );
}

/* ─── Sparkle particles on card ─── */
function SparkleParticles({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0, x: '50%', y: '50%' }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1.2, 0],
            x: `${20 + Math.random() * 60}%`,
            y: `${10 + Math.random() * 80}%`,
          }}
          transition={{
            duration: 1.2,
            delay: 0.1 + i * 0.12,
            ease: 'easeOut',
            repeat: Infinity,
            repeatDelay: 2 + Math.random() * 2,
          }}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}


/* ─── Back Button ─── */
function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center active:bg-gray-200 transition-colors"
    >
      <ArrowLeft className="w-5 h-5 text-gray-600" />
    </motion.button>
  );
}

/* ═══════════════════════════════════════════
   STEP: LANDING (Premium Animated)
   ═══════════════════════════════════════════ */
function LandingStep({ onFreshSelect, onOwnerFlow, onStaffFlow }: {
  onFreshSelect: (slug: string) => void;
  onOwnerFlow: () => void;
  onStaffFlow: () => void;
}) {
  const activeModules = getActiveModules();
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  const handleToggle = (slug: string) => {
    setExpandedSlug((prev) => (prev === slug ? null : slug));
  };

  return (
    <div className="min-h-screen flex flex-col bg-white relative overflow-hidden">
      {/* ── Hero Background Orbs ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 0.4, scale: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="hero-orb w-72 h-72 bg-violet-400 -top-20 -right-20"
          style={{ position: 'absolute' }}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 0.3, scale: 1 }}
          transition={{ duration: 1.5, delay: 0.3, ease: 'easeOut' }}
          className="hero-orb w-56 h-56 bg-fuchsia-400 top-1/3 -left-16"
          style={{ position: 'absolute' }}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 0.2, scale: 1 }}
          transition={{ duration: 1.5, delay: 0.6, ease: 'easeOut' }}
          className="hero-orb w-48 h-48 bg-amber-400 bottom-32 right-4"
          style={{ position: 'absolute' }}
        />
      </div>

      {/* ── Hero Section ── */}
      <div className="relative z-10 px-6 pt-14 pb-6">
        <motion.div
          initial={{ opacity: 0, y: -30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, type: 'spring', stiffness: 200, damping: 20 }}
          className="flex items-center gap-3 mb-5"
        >
          {/* Floating Logo */}
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="relative"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-xl shadow-violet-500/30 gradient-shift">
              <Package className="w-7 h-7 text-white" />
            </div>
            {/* Pulse ring */}
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut' }}
              className="absolute inset-0 rounded-2xl border-2 border-violet-400"
            />
          </motion.div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
              Inventory<span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">OS</span>
            </h1>
            <p className="text-[11px] text-gray-400 -mt-0.5 font-medium">Inventory for every business</p>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-sm text-gray-500 leading-relaxed"
        >
          Choose your business type and get started in minutes
        </motion.p>
      </div>

      {/* ── Business Cards ── */}
      <div className="relative z-10 flex-1 px-4 pb-4">
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
                animate={{
                  scale: expandedSlug && !isExpanded ? 0.97 : 1,
                  opacity: expandedSlug && !isExpanded ? 0.5 : 1,
                }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Glow border when expanded */}
                {isExpanded && (
                  <motion.div
                    layoutId={`glow-${mod.slug}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`absolute -inset-[2px] rounded-[18px] bg-gradient-to-r ${mod.gradient} opacity-30 blur-sm`}
                  />
                )}

                <motion.button
                  layout
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleToggle(mod.slug)}
                  className={`w-full rounded-2xl text-left transition-all duration-300 relative overflow-hidden ${
                    isExpanded
                      ? 'bg-white shadow-xl border-0 z-10'
                      : 'bg-white border-2 border-gray-100 shadow-sm hover:shadow-md'
                  }`}
                  style={isExpanded ? { boxShadow: `0 8px 40px -8px rgba(139, 92, 246, 0.3)` } : undefined}
                >
                  {/* Subtle gradient wash when expanded */}
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.03 }}
                      className={`absolute inset-0 bg-gradient-to-br ${mod.gradient} pointer-events-none`}
                    />
                  )}

                  <div className="p-4 relative z-10">
                    <div className="flex items-center gap-3">
                      {/* Animated Icon */}
                      <motion.div
                        layout
                        animate={isExpanded ? {
                          scale: [1, 1.2, 1],
                          rotate: [0, -8, 8, 0],
                        } : {}}
                        transition={{
                          duration: 0.6,
                          ease: 'easeInOut',
                        }}
                        className={`w-13 h-13 rounded-2xl bg-gradient-to-br ${mod.gradient} flex items-center justify-center shadow-md flex-shrink-0 glow-pulse`}
                        style={{
                          width: 52,
                          height: 52,
                          '--glow-color': mod.color === 'emerald'
                            ? 'rgba(16, 185, 129, 0.4)'
                            : 'rgba(139, 92, 246, 0.4)',
                        } as React.CSSProperties}
                      >
                        <span className="text-2xl">{mod.icon}</span>
                      </motion.div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900">{mod.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{mod.tagline}</p>
                      </div>

                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                      >
                        <ChevronDown className={`w-5 h-5 transition-colors duration-300 ${isExpanded ? 'text-violet-500' : 'text-gray-400'}`} />
                      </motion.div>
                    </div>
                  </div>
                </motion.button>

                {/* ── Expanded Detail Panel ── */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, y: -8 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -8 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      {/* Sparkle particles */}
                      <SparkleParticles color={mod.color === 'emerald' ? '#10b981' : '#8b5cf6'} />

                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, duration: 0.4 }}
                        className={`${mod.bgColor} rounded-2xl p-5 border ${mod.borderColor} mx-1 mb-1 relative overflow-hidden`}
                      >
                        {/* Background pattern */}
                        <div className="absolute top-0 right-0 w-32 h-32 opacity-5">
                          <div className={`w-full h-full rounded-full bg-gradient-to-br ${mod.gradient}`} />
                        </div>

                        <div className="relative z-10">
                          {/* Stats Row with Count-up */}
                          {mod.stats.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.15 }}
                              className="flex justify-around mb-5 py-3 px-2 bg-white/60 backdrop-blur-sm rounded-xl"
                            >
                              {mod.stats.map((stat, i) => (
                                <AnimatedStat
                                  key={stat.label}
                                  label={stat.label}
                                  value={stat.value}
                                  delay={0.25 + i * 0.12}
                                />
                              ))}
                            </motion.div>
                          )}

                          {/* Features with stagger fly-in */}
                          {mod.features.length > 0 && (
                            <div className="space-y-2.5 mb-5">
                              {mod.features.slice(0, 5).map((f, i) => (
                                <motion.div
                                  key={f.name}
                                  initial={{ opacity: 0, x: -20, scale: 0.9 }}
                                  animate={{ opacity: 1, x: 0, scale: 1 }}
                                  transition={{
                                    delay: 0.3 + i * 0.08,
                                    type: 'spring',
                                    stiffness: 300,
                                    damping: 25,
                                  }}
                                  className="flex items-center gap-3"
                                >
                                  <motion.div
                                    initial={{ rotate: -90, scale: 0 }}
                                    animate={{ rotate: 0, scale: 1 }}
                                    transition={{
                                      delay: 0.35 + i * 0.08,
                                      type: 'spring',
                                      stiffness: 400,
                                      damping: 20,
                                    }}
                                    className={`w-7 h-7 rounded-lg bg-gradient-to-br ${mod.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}
                                  >
                                    <Check className="w-3.5 h-3.5 text-white" />
                                  </motion.div>
                                  <div>
                                    <p className="text-xs font-semibold text-gray-800">{f.name}</p>
                                    <p className="text-[10px] text-gray-500 leading-tight">{f.description}</p>
                                  </div>
                                </motion.div>
                              ))}
                              {mod.features.length > 5 && (
                                <motion.p
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: 0.75 }}
                                  className="text-[10px] text-gray-400 text-center pt-1"
                                >
                                  +{mod.features.length - 5} more features
                                </motion.p>
                              )}
                            </div>
                          )}

                          {/* CTA Button with Shimmer */}
                          <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                          >
                            <motion.div whileTap={{ scale: 0.97 }} className="relative overflow-hidden rounded-xl">
                              {/* Shimmer overlay */}
                              <div
                                className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity pointer-events-none"
                                style={{
                                  background: 'linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.2) 37%, transparent 63%)',
                                  backgroundSize: '200% 100%',
                                  animation: 'shimmer 2.5s ease-in-out infinite',
                                }}
                              />
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onFreshSelect(mod.slug);
                                }}
                                className={`w-full h-13 rounded-xl bg-gradient-to-r ${mod.gradient} text-white font-semibold shadow-lg relative overflow-hidden`}
                                style={{ height: 52 }}
                              >
                                <motion.span
                                  initial={{ x: -20, opacity: 0 }}
                                  animate={{ x: 0, opacity: 1 }}
                                  transition={{ delay: 0.65 }}
                                  className="flex items-center justify-center"
                                >
                                  Start with {mod.name}
                                  <motion.div
                                    animate={{ x: [0, 4, 0] }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                                  >
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                  </motion.div>
                                </motion.span>
                              </Button>
                            </motion.div>
                          </motion.div>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* ── Bottom: Existing User Options ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="relative z-10 px-4 pb-8 pt-3 border-t border-gray-100 bg-white/80 backdrop-blur-md"
      >
        <p className="text-[11px] text-gray-400 text-center mb-3 font-medium">Already have an account?</p>
        <div className="flex gap-3">
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button
              variant="outline"
              onClick={onOwnerFlow}
              className="w-full h-11 rounded-xl border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50"
            >
              <Building2 className="w-4 h-4 mr-1.5" />
              I own a business
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button
              variant="outline"
              onClick={onStaffFlow}
              className="w-full h-11 rounded-xl border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50"
            >
              <UserCheck className="w-4 h-4 mr-1.5" />
              I am staff
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   STEP: PHONE NUMBER (Fresh User)
   ═══════════════════════════════════════════ */
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
    // TODO: Call real OTP API
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    setOtpSent(true);
  };

  const handleVerifyOTP = async () => {
    const otpCode = otp.join('');
    if (otpCode.length < 6) return;
    setLoading(true);
    // TODO: Call real OTP verify API
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
          <motion.div
            animate={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className={`w-9 h-9 rounded-xl bg-gradient-to-br ${mod?.gradient} flex items-center justify-center shadow-md`}
          >
            <span className="text-base">{mod?.icon}</span>
          </motion.div>
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
                autoFocus
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
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15, rotateX: -30 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  transition={{ delay: i * 0.05, type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <input
                    id={`otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value.replace(/[^0-9]/g, ''))}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-12 h-14 text-center text-xl font-bold rounded-xl border-2 border-gray-200 focus:border-violet-500 focus:outline-none transition-all duration-200 bg-gray-50 focus:bg-white focus:shadow-lg focus:shadow-violet-500/10"
                  />
                </motion.div>
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

/* ═══════════════════════════════════════════
   STEP: SETUP BUSINESS (Fresh User — no re-selection)
   ═══════════════════════════════════════════ */
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
    // TODO: Call real API to create business
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
        {/* Module icon — spring entrance with glow */}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
          className="relative inline-block mb-5"
        >
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${mod?.gradient} flex items-center justify-center shadow-xl`}
          >
            <span className="text-4xl">{mod?.icon}</span>
          </motion.div>
          {/* Glow ring */}
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            className={`absolute inset-0 rounded-3xl border-2 border-violet-400`}
          />
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

        {/* Feature preview with stagger fly-in */}
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
            className={`w-full rounded-2xl bg-gradient-to-r ${mod?.gradient || 'from-violet-500 to-purple-600'} text-white font-semibold text-base shadow-lg disabled:opacity-50 active:scale-[0.98] transition-transform`}
            style={{ height: 52 }}
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

/* ═══════════════════════════════════════════
   STEP: OWNER LOGIN
   ═══════════════════════════════════════════ */
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
              autoFocus
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

/* ═══════════════════════════════════════════
   STEP: STAFF LOGIN
   ═══════════════════════════════════════════ */
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
            autoFocus
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

/* ═══════════════════════════════════════════
   FLOW TYPES & ROUTER
   ═══════════════════════════════════════════ */
type FlowStep =
  | { type: 'landing' }
  | { type: 'owner-login' }
  | { type: 'staff-login' }
  | { type: 'phone'; slug: string }
  | { type: 'setup'; slug: string; phone: string };

function LandingPage() {
  const { setSession } = useAuthStore();
  const [step, setStep] = useState<FlowStep>({ type: 'landing' });

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

  /* Owner: phone login → dashboard (simulated) */
  const handleOwnerLogin = () => {
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

  return (
    <AnimatePresence mode="wait">
      {step.type === 'landing' && (
        <motion.div key="landing" {...slideInRight}>
          <LandingStep
            onFreshSelect={handleFreshSelect}
            onOwnerFlow={() => setStep({ type: 'owner-login' })}
            onStaffFlow={() => setStep({ type: 'staff-login' })}
          />
        </motion.div>
      )}
      {step.type === 'owner-login' && (
        <motion.div key="owner-login" {...slideInRight}>
          <OwnerLoginStep onBack={goBack} onLogin={handleOwnerLogin} />
        </motion.div>
      )}
      {step.type === 'staff-login' && (
        <motion.div key="staff-login" {...slideInRight}>
          <StaffLoginStep onBack={goBack} onLogin={handleStaffLogin} />
        </motion.div>
      )}
      {step.type === 'phone' && (
        <motion.div key="phone" {...slideInRight}>
          <PhoneStep
            selectedSlug={step.slug}
            onBack={goBack}
            onVerified={handlePhoneVerified}
          />
        </motion.div>
      )}
      {step.type === 'setup' && (
        <motion.div key="setup" {...slideInRight}>
          <SetupBusinessStep
            selectedSlug={step.slug}
            phone={step.phone}
            onBack={goBack}
            onComplete={handleSetupComplete}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════
   DASHBOARD STEP (post-auth)
   ═══════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */
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
          transition={{ duration: 0.25 }}
        >
          <LandingPage />
        </motion.div>
      ) : (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <DashboardStep />
        </motion.div>
      )}
    </AnimatePresence>
  );
}