'use client';

import React, { useState, useCallback } from 'react';
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
  Building2,
  UserCheck,
  Phone,
  KeyRound,
  Package,
  Users,
  Store,
} from 'lucide-react';
import { useAuthStore, type AuthSession } from '@/stores/auth-store';
import { moduleRegistry, getActiveModules } from '@/lib/modules';
import { CCTVShell } from '@/modules/cctv-shop/components';
import { PharmacyShell } from '@/modules/pharmacy/components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/* ─── Types for verify-otp response ─── */
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

/* ─── Error Text ─── */
function ErrorText({ message }: { message: string }) {
  if (!message) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-xs text-red-500 mt-1.5 flex items-center gap-1"
    >
      <span className="inline-block w-1 h-1 rounded-full bg-red-500" />
      {message}
    </motion.p>
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

/* ─── Step: Phone + OTP (shared by fresh user & owner) ─── */
function PhoneStep({ selectedSlug, onBack, onVerified }: {
  selectedSlug?: string;
  onBack: () => void;
  onVerified: (data: VerifiedPhoneData) => void;
}) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const mod = selectedSlug ? moduleRegistry.find((m) => m.slug === selectedSlug) : null;

  // Normalize 10-digit input to 11-digit BD format (prepend "0")
  const fullPhone = phone.length === 10 ? '0' + phone : phone;

  const handleSendOTP = async () => {
    if (phone.length < 10) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send OTP');
        return;
      }
      setOtpSent(true);
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    const otpCode = otp.join('');
    if (otpCode.length < 4) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, otp: otpCode, trustDevice: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Verification failed');
        return;
      }
      onVerified({
        phone: fullPhone,
        userId: data.user.id,
        phoneToken: data.phoneToken,
        businesses: data.businesses || [],
      });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 3) {
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

  const title = mod
    ? (otpSent ? 'Enter OTP' : 'Enter your phone')
    : (otpSent ? 'Enter OTP' : 'Welcome back');

  const subtitle = mod
    ? (otpSent ? `Code sent to +880${phone}` : "We'll verify your number to get started")
    : (otpSent ? `Code sent to +880${phone}` : 'Sign in to your InventoryOS account');

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
        {/* Module badge (fresh user only) */}
        {mod && (
          <motion.div variants={fadeUp} className="flex items-center gap-2 mb-4">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${mod.gradient} flex items-center justify-center`}>
              <span className="text-sm">{mod.icon}</span>
            </div>
            <span className="text-xs font-medium text-gray-400">{mod.name}</span>
          </motion.div>
        )}

        <motion.h1 variants={fadeUp} className="text-2xl font-bold text-gray-900">
          {title}
        </motion.h1>
        <motion.p variants={fadeUp} className="text-sm text-gray-500 mt-1">
          {subtitle}
        </motion.p>

        {!otpSent ? (
          <motion.div variants={fadeUp} className="mt-8">
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Phone Number</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">+880</span>
              <Input
                type="tel"
                placeholder="1XXX XXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                className="h-14 rounded-xl bg-gray-50 border-gray-200 pl-14 text-lg font-semibold focus-visible:ring-violet-500/30"
                maxLength={10}
                autoFocus
              />
            </div>
            <ErrorText message={error} />
            <motion.div variants={fadeUp} className="mt-6">
              <Button
                onClick={handleSendOTP}
                disabled={loading || phone.length < 10}
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
                  className="w-14 h-14 text-center text-xl font-bold rounded-xl border-2 border-gray-200 focus:border-violet-500 focus:outline-none transition-colors bg-gray-50"
                  autoFocus={i === 0}
                />
              ))}
            </div>
            <ErrorText message={error} />
            <Button
              onClick={handleVerifyOTP}
              disabled={loading || otp.join('').length < 4}
              className={`w-full h-12 rounded-xl bg-gradient-to-r ${mod?.gradient || 'from-violet-500 to-purple-600'} text-white font-semibold shadow-lg disabled:opacity-50`}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>Verify & Continue <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
            <button
              onClick={() => { setOtpSent(false); setOtp(['', '', '', '']); setError(''); }}
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

/* ─── Step: Setup Business (Fresh User) ─── */
function SetupBusinessStep({ selectedSlug, phone, userId, phoneToken, onBack, onComplete }: {
  selectedSlug: string;
  phone: string;
  userId: string;
  phoneToken: string;
  onBack: () => void;
  onComplete: () => void;
}) {
  const [businessName, setBusinessName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const mod = moduleRegistry.find((m) => m.slug === selectedSlug);
  const { setSession } = useAuthStore();

  const handleCreate = async () => {
    if (!businessName.trim() || !username.trim() || !password) return;
    if (username.trim().length < 3) { setError('Username must be at least 3 characters'); return; }
    if (password.length < 4) { setError('Password must be at least 4 characters'); return; }

    setError('');
    setLoading(true);
    try {
      // Step 1: Register the business
      const regRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          businessTypeId: selectedSlug,
          businessName: businessName.trim(),
          username: username.trim(),
          password,
        }),
      });
      const regData = await regRes.json();
      if (!regRes.ok) {
        setError(regData.error || 'Registration failed');
        return;
      }

      // Step 2: Auto-login as owner (no password needed with phoneToken)
      const loginRes = await fetch('/api/auth/owner-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneToken,
          businessId: regData.business.id,
        }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) {
        setError(loginData.error || 'Auto-login failed. Please use the owner login.');
        return;
      }

      // Step 3: Set session
      const session: AuthSession = {
        sessionToken: loginData.session.token,
        expiresAt: loginData.session.expiresAt,
        user: {
          id: loginData.user.id,
          name: loginData.user.fullName || loginData.user.username,
          username: loginData.user.username,
          role: loginData.user.role,
          fullName: loginData.user.fullName,
          phone,
        },
        permissions: loginData.permissions,
        business: {
          id: loginData.business.id,
          name: loginData.business.name,
          shopCode: loginData.business.shopCode,
          address: loginData.business.address || '',
          phone: '+880' + phone.replace(/^0/, ''),
          businessType: {
            id: loginData.business.businessType.slug,
            name: loginData.business.businessType.name,
            slug: loginData.business.businessType.slug,
            icon: loginData.business.businessType.icon,
            color: loginData.business.businessType.color,
          },
        },
      };
      setSession(session);
      onComplete();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
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
        {/* Module icon */}
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
          Create your shop and admin credentials
        </motion.p>

        <motion.div variants={fadeUp} className="mt-8 space-y-4">
          {/* Shop Name */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Shop Name</label>
            <Input
              placeholder={`e.g. Dhaka ${mod?.name} Center`}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="h-12 rounded-xl bg-gray-50 border-gray-200 text-base font-semibold focus-visible:ring-violet-500/30"
              autoFocus
            />
          </div>

          {/* Admin Username */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Admin Username</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                <Users className="w-4 h-4" />
              </span>
              <Input
                placeholder="e.g. admin"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, '').toLowerCase())}
                className="h-12 rounded-xl bg-gray-50 border-gray-200 pl-10 text-base font-medium focus-visible:ring-violet-500/30"
              />
            </div>
          </div>

          {/* Admin Password */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Admin Password</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                <KeyRound className="w-4 h-4" />
              </span>
              <Input
                type={showPass ? 'text' : 'password'}
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl bg-gray-50 border-gray-200 pl-10 pr-10 text-base font-medium focus-visible:ring-violet-500/30"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <ErrorText message={error} />
        </motion.div>

        {/* Feature preview */}
        {mod?.features.length ? (
          <motion.div variants={fadeUp} className="mt-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">You&apos;ll get</p>
            <div className="space-y-2">
              {mod.features.slice(0, 4).map((f, i) => (
                <motion.div
                  key={f.name}
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.07 }}
                  className="flex items-center gap-3"
                >
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${mod.gradient} flex items-center justify-center flex-shrink-0`}>
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
            disabled={loading || !businessName.trim() || !username.trim() || !password}
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

/* ─── Step: Business List (Owner after OTP) ─── */
function BusinessListStep({ businesses, phoneToken, onBack, onSelect, onRegisterNew }: {
  businesses: VerifiedPhoneData['businesses'];
  phoneToken: string;
  onBack: () => void;
  onSelect: (businessId: string) => void;
  onRegisterNew: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <motion.div {...slideInRight} className="px-6 pt-14 pb-4">
        <BackButton onClick={onBack} />
        <h1 className="text-2xl font-bold text-gray-900 mt-6">Your Businesses</h1>
        <p className="text-sm text-gray-500 mt-1">Select a business to enter</p>
      </motion.div>

      <motion.div variants={stagger} initial="initial" animate="animate" className="flex-1 px-4 pb-8">
        <div className="space-y-3">
          {businesses.map((biz, i) => (
            <motion.button
              key={biz.id}
              variants={fadeUp}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(biz.id)}
              className="w-full bg-white rounded-2xl border-2 border-gray-100 p-4 text-left shadow-sm hover:border-violet-200 hover:shadow-md transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md flex-shrink-0">
                  <span className="text-xl">{biz.businessType.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 truncate">{biz.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {biz.shopCode && (
                      <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {biz.shopCode}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{biz.businessType.name}</span>
                  </div>
                  {biz.businessUsers.length > 0 && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Logged in as {biz.businessUsers[0].username}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
              </div>
            </motion.button>
          ))}
        </div>

        {/* Register New Business */}
        <motion.div variants={fadeUp} className="mt-6">
          <Button
            variant="outline"
            onClick={onRegisterNew}
            className="w-full h-12 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 font-medium text-sm"
          >
            <span className="text-lg mr-2">+</span>
            Register a new business
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
  const [error, setError] = useState('');
  const { setSession } = useAuthStore();

  const handleLogin = async () => {
    if (!shopCode || !username || !password) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopCode: shopCode.toUpperCase().trim(),
          username: username.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      const session: AuthSession = {
        sessionToken: data.session.token,
        expiresAt: data.session.expiresAt,
        user: {
          id: data.user.id,
          name: data.user.fullName || data.user.username,
          username: data.user.username,
          role: data.user.role,
          fullName: data.user.fullName,
        },
        permissions: data.permissions,
        business: {
          id: data.business.id,
          name: data.business.name,
          shopCode: data.business.shopCode,
          address: data.business.address || '',
          phone: '',
          businessType: {
            id: data.business.businessType.slug,
            name: data.business.businessType.name,
            slug: data.business.businessType.slug,
            icon: data.business.businessType.icon,
            color: data.business.businessType.color,
          },
        },
      };
      setSession(session);
      onLogin();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
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
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
              <Store className="w-4 h-4" />
            </span>
            <Input
              placeholder="e.g. PHA-XK7T"
              value={shopCode}
              onChange={(e) => setShopCode(e.target.value.toUpperCase())}
              className="h-12 rounded-xl bg-gray-50 border-gray-200 pl-10 font-mono tracking-wider focus-visible:ring-violet-500/30"
              autoFocus
            />
          </div>
        </motion.div>
        <motion.div variants={fadeUp}>
          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Username</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
              <Users className="w-4 h-4" />
            </span>
            <Input
              placeholder="Your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-12 rounded-xl bg-gray-50 border-gray-200 pl-10 focus-visible:ring-violet-500/30"
            />
          </div>
        </motion.div>
        <motion.div variants={fadeUp}>
          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Password</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
              <KeyRound className="w-4 h-4" />
            </span>
            <Input
              type={showPass ? 'text' : 'password'}
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-xl bg-gray-50 border-gray-200 pl-10 pr-10 focus-visible:ring-violet-500/30"
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
        <motion.div variants={fadeUp}>
          <ErrorText message={error} />
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
  | { type: 'phone'; slug?: string; flow: 'fresh' | 'owner' }
  | { type: 'setup'; slug: string; phone: string; userId: string; phoneToken: string }
  | { type: 'business-list'; phone: string; userId: string; phoneToken: string; businesses: VerifiedPhoneData['businesses'] }
  | { type: 'staff-login' };

/* ─── Landing Page (Router) ─── */
function LandingPage() {
  const { setSession, logout } = useAuthStore();
  const [step, setStep] = useState<FlowStep>({ type: 'landing' });

  /* Fresh user: select business → phone → OTP → setup → done */
  const handleFreshSelect = (slug: string) => {
    setStep({ type: 'phone', slug, flow: 'fresh' });
  };

  /* Owner flow: "I own a business" */
  const handleOwnerFlow = () => {
    setStep({ type: 'phone', flow: 'owner' });
  };

  /* Staff flow */
  const handleStaffFlow = () => {
    setStep({ type: 'staff-login' });
  };

  /* After OTP verified (shared by fresh + owner) */
  const handlePhoneVerified = useCallback((data: VerifiedPhoneData) => {
    const currentStep = step as { type: 'phone'; slug?: string; flow: 'fresh' | 'owner' };

    if (data.businesses.length > 0) {
      // User has businesses → show business list
      setStep({
        type: 'business-list',
        phone: data.phone,
        userId: data.userId,
        phoneToken: data.phoneToken,
        businesses: data.businesses,
      });
    } else if (currentStep.flow === 'fresh' && currentStep.slug) {
      // Fresh user with no businesses → setup
      setStep({
        type: 'setup',
        slug: currentStep.slug,
        phone: data.phone,
        userId: data.userId,
        phoneToken: data.phoneToken,
      });
    } else {
      // Owner with no businesses → back to landing
      alert('No businesses found. Please register a new business first.');
      setStep({ type: 'landing' });
    }
  }, [step]);

  /* Owner selects a business from the list */
  const handleOwnerSelectBusiness = useCallback(async (businessId: string) => {
    const currentStep = step as { type: 'business-list'; phoneToken: string };
    try {
      const res = await fetch('/api/auth/owner-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneToken: currentStep.phoneToken, businessId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Login failed. Please try again.');
        return;
      }

      const session: AuthSession = {
        sessionToken: data.session.token,
        expiresAt: data.session.expiresAt,
        user: {
          id: data.user.id,
          name: data.user.fullName || data.user.username,
          username: data.user.username,
          role: data.user.role,
          fullName: data.user.fullName,
        },
        permissions: data.permissions,
        business: {
          id: data.business.id,
          name: data.business.name,
          shopCode: data.business.shopCode,
          address: data.business.address || '',
          phone: '',
          businessType: {
            id: data.business.businessType.slug,
            name: data.business.businessType.name,
            slug: data.business.businessType.slug,
            icon: data.business.businessType.icon,
            color: data.business.businessType.color,
          },
        },
      };
      setSession(session);
    } catch {
      alert('Network error. Please try again.');
    }
  }, [step, setSession]);

  /* Owner wants to register a new business (from business list) */
  const handleRegisterNew = useCallback(() => {
    setStep({ type: 'landing' });
  }, []);

  const goBack = () => {
    switch (step.type) {
      case 'owner-login':
      case 'staff-login':
      case 'business-list':
        setStep({ type: 'landing' });
        break;
      case 'phone':
        setStep({ type: 'landing' });
        break;
      case 'setup':
        setStep({ type: 'phone', slug: (step as { type: 'setup'; slug: string }).slug, flow: 'fresh' });
        break;
    }
  };

  switch (step.type) {
    case 'landing':
      return (
        <LandingStep
          onFreshSelect={handleFreshSelect}
          onOwnerFlow={handleOwnerFlow}
          onStaffFlow={handleStaffFlow}
        />
      );
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
          userId={step.userId}
          phoneToken={step.phoneToken}
          onBack={goBack}
          onComplete={() => {/* session already set in the component */}}
        />
      );
    case 'business-list':
      return (
        <BusinessListStep
          businesses={step.businesses}
          phoneToken={step.phoneToken}
          onBack={goBack}
          onSelect={handleOwnerSelectBusiness}
          onRegisterNew={handleRegisterNew}
        />
      );
    case 'staff-login':
      return (
        <StaffLoginStep
          onBack={goBack}
          onLogin={() => {/* session already set in the component */}}
        />
      );
  }
}

/* ─── Dashboard Step (post-auth) ─── */
function DashboardStep() {
  const session = useAuthStore((s) => s.session);
  const { logout } = useAuthStore();

  if (!session) return null;
  const slug = session.business.businessType.slug;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        {slug === 'cctv-shop' && <CCTVShell />}
        {slug === 'pharmacy' && <PharmacyShell />}
        {!['cctv-shop', 'pharmacy'].includes(slug) && (
          <div className="min-h-screen bg-gray-50/80 flex items-center justify-center">
            <div className="text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🚧</span>
              </div>
              <h2 className="text-lg font-bold text-gray-900">{session.business.businessType.name} Module</h2>
              <p className="text-sm text-gray-500 mt-1">Coming soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
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