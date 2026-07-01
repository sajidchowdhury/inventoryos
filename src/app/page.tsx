"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Box,
  Phone,
  ShieldCheck,
  Building2,
  Plus,
  ArrowRight,
  ArrowLeft,
  Pill,
  ShoppingCart,
  UtensilsCrossed,
  Camera,
  Smartphone,
  Zap,
  Cake,
  Lock,
  User,
  CheckCircle2,
  LogOut,
  MapPin,
  Sparkles,
  ChevronRight,
  Eye,
  EyeOff,
  RefreshCw,
  Package,
  Clock,
  Receipt,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getAllModules } from "@/lib/modules";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { PharmacyShell } from "@/modules/pharmacy/components";
import { cn } from "@/lib/utils";

// ── Icon maps ──
const iconMap: Record<string, React.ReactNode> = {
  Pill: <Pill className="h-7 w-7" />,
  ShoppingCart: <ShoppingCart className="h-7 w-7" />,
  UtensilsCrossed: <UtensilsCrossed className="h-7 w-7" />,
  Camera: <Camera className="h-7 w-7" />,
  Smartphone: <Smartphone className="h-7 w-7" />,
  Zap: <Zap className="h-7 w-7" />,
  Cake: <Cake className="h-7 w-7" />,
};

const smallIconMap: Record<string, React.ReactNode> = {
  Pill: <Pill className="h-5 w-5" />,
  ShoppingCart: <ShoppingCart className="h-5 w-5" />,
  UtensilsCrossed: <UtensilsCrossed className="h-5 w-5" />,
  Camera: <Camera className="h-5 w-5" />,
  Smartphone: <Smartphone className="h-5 w-5" />,
  Zap: <Zap className="h-5 w-5" />,
  Cake: <Cake className="h-5 w-5" />,
};

// Helper: render a colored icon background with a subtle premium gradient overlay.
// Works for any color format (hex, rgb, oklch) by layering white→black on top.
const gradientIconStyle = (color: string): React.CSSProperties => ({
  backgroundColor: color,
  backgroundImage:
    "linear-gradient(135deg, rgba(255,255,255,0.22), rgba(0,0,0,0.18))",
});

// ── Animation variants ──
const slideIn = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
  transition: { duration: 0.3, ease: "easeOut" },
};

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.3, ease: "easeOut" },
};

// ── Feature highlight cards (Landing Step) ──
const featureCards = [
  {
    title: "Smart Inventory",
    desc: "Track stock in real-time",
    icon: Package,
    gradient: "from-emerald-500 to-emerald-600",
    highlight: false,
  },
  {
    title: "FEFO Dispensing",
    desc: "First-expiry-first-out logic",
    icon: ShoppingCart,
    gradient: "from-blue-500 to-blue-600",
    highlight: false,
  },
  {
    title: "Expiry Tracking",
    desc: "Never lose stock to expiry",
    icon: Clock,
    gradient: "from-rose-500 to-rose-600",
    highlight: false,
  },
  {
    title: "AI-Powered Insights",
    desc: "Smart predictions & alerts",
    icon: Sparkles,
    gradient: "from-purple-500 to-purple-600",
    highlight: true,
  },
  {
    title: "Sales & Reports",
    desc: "Track revenue & trends",
    icon: Receipt,
    gradient: "from-amber-500 to-amber-600",
    highlight: false,
  },
  {
    title: "Multi-User",
    desc: "Add staff with role control",
    icon: Users,
    gradient: "from-cyan-500 to-cyan-600",
    highlight: false,
  },
];

// ── Step indicator ──
function StepIndicator({ current, steps }: { current: string; steps: string[] }) {
  const idx = steps.indexOf(current);
  return (
    <div className="flex items-center gap-1.5 justify-center">
      {steps.map((step, i) => (
        <button
          key={step}
          className={cn(
            "h-2 rounded-full transition-all duration-500",
            i === idx
              ? "w-8 bg-emerald-500"
              : i < idx
                ? "w-2 bg-emerald-400/60"
                : "w-2 bg-muted-foreground/20"
          )}
          aria-label={`Step ${i + 1}: ${step}`}
        />
      ))}
    </div>
  );
}

// ── Password Input with visibility toggle ──
function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        id={id}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 pl-9 pr-10 rounded-xl border-emerald-200/60 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-emerald-600 transition-colors"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ── Landing Step — Premium marketing landing page ──
function LandingStep() {
  const { setStep } = useAuthStore();

  const handleGetStarted = () => {
    setStep("phone");
  };

  return (
    <motion.div {...fadeIn} className="space-y-10 py-2">
      {/* ═══ HERO SECTION ═══ */}
      <div className="text-center space-y-6 pt-4">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="inline-flex items-center justify-center h-20 w-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-xl shadow-emerald-500/30"
        >
          <Box className="h-10 w-10 text-white" />
        </motion.div>

        {/* Headline */}
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            Inventory<span className="text-emerald-600">OS</span>
          </h1>
          <p className="text-xl font-semibold text-foreground leading-snug">
            Smart Inventory Management
            <br />
            <span className="text-emerald-600">Powered by AI</span>
          </p>
          <p className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
            Built for Bangladeshi pharmacies. Track stock, manage expiry, get AI-powered
            demand forecasts — all in one beautiful app.
          </p>
        </div>

        {/* CTA Button */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <Button
            size="lg"
            className="w-full h-14 gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-xl shadow-emerald-500/30 border-0 text-white text-lg font-semibold"
            onClick={handleGetStarted}
          >
            Get Started
            <ArrowRight className="h-5 w-5" />
          </Button>
        </motion.div>

        <p className="text-xs text-muted-foreground">
          No credit card needed · Free for small businesses
        </p>
      </div>

      {/* ═══ STATS BAR ═══ */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { num: "14K+", label: "Products", icon: Package },
          { num: "232", label: "Companies", icon: Building2 },
          { num: "AI", label: "Forecasts", icon: Sparkles },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="border-emerald-100/50 shadow-sm bg-gradient-to-br from-card to-emerald-50/30">
              <CardContent className="p-3 text-center space-y-1">
                <Icon className="h-4 w-4 text-emerald-600 mx-auto" />
                <p className="text-2xl font-bold text-emerald-600">{stat.num}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ═══ WHAT WE PROMISE ═══ */}
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold">What we promise</h2>
          <p className="text-sm text-muted-foreground">Everything you need to run your pharmacy</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {featureCards.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.08, duration: 0.4 }}
              >
                <Card
                  className={cn(
                    "card-hover shadow-pharmacy overflow-hidden h-full",
                    feat.highlight && "border-purple-300 ring-2 ring-purple-200"
                  )}
                >
                  <CardContent className="p-4 flex flex-col items-start gap-2.5">
                    <div
                      className={cn(
                        "h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-sm",
                        feat.gradient
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm flex items-center gap-1.5">
                        {feat.title}
                        {feat.highlight && (
                          <Badge className="text-[9px] bg-purple-100 text-purple-700 hover:bg-purple-100 px-1.5 py-0">
                            AI
                          </Badge>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-snug">{feat.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ═══ HOW IT WORKS ═══ */}
      <Card className="border-0 overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-pharmacy-lg">
        <CardContent className="p-5 space-y-4">
          <p className="font-semibold text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> How it works
          </p>
          <div className="space-y-3 text-sm text-emerald-50">
            <div className="flex items-start gap-3">
              <span className="h-6 w-6 rounded-full bg-white/25 flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <span className="pt-0.5">Enter your phone number</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="h-6 w-6 rounded-full bg-white/25 flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <span className="pt-0.5">Verify with OTP (demo: 9999)</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="h-6 w-6 rounded-full bg-white/25 flex items-center justify-center text-xs font-bold shrink-0">3</span>
              <span className="pt-0.5">Set up your pharmacy and start managing</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ FINAL CTA ═══ */}
      <div className="text-center space-y-4 py-4">
        <h2 className="text-2xl font-bold">Ready to get started?</h2>
        <p className="text-sm text-muted-foreground">
          Join pharmacies across Bangladesh. Start free today.
        </p>
        <Button
          size="lg"
          className="w-full h-14 gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-xl shadow-emerald-500/30 border-0 text-white text-lg font-semibold"
          onClick={handleGetStarted}
        >
          Get Started
          <ArrowRight className="h-5 w-5" />
        </Button>
      </div>

      {/* ═══ FOOTER ═══ */}
      <div className="text-center space-y-1 pt-4 border-t border-emerald-100/50">
        <p className="text-xs text-muted-foreground">
          © 2026 InventoryOS — Built for Bangladesh
        </p>
      </div>
    </motion.div>
  );
}

// ── Phone Step ──
function PhoneStep() {
  const { phone, setPhone, setStep, setIsLoading, setError, isLoading, error } = useAuthStore();
  const [localPhone, setLocalPhone] = useState(phone || "");

  const handleSendOtp = async () => {
    if (localPhone.length < 11) {
      setError("Please enter a valid 11-digit phone number");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setPhone(localPhone);
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: localPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep("otp");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div {...slideIn} className="space-y-6">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30">
          <Phone className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold">Enter your phone number</h2>
        <p className="text-muted-foreground text-sm">
          We will send a verification code to confirm it&apos;s you
        </p>
      </div>

      <div className="space-y-3">
        <Label htmlFor="phone" className="text-sm font-medium">
          Phone Number
        </Label>
        <div className="flex gap-2">
          <div className="flex items-center px-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-700 shrink-0">
            +880
          </div>
          <Input
            id="phone"
            type="tel"
            placeholder="1XXX XXXXXX"
            value={localPhone}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 11);
              setLocalPhone(val);
              setError(null);
            }}
            className="h-12 text-lg rounded-2xl shadow-pharmacy border-emerald-200/60 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500"
            maxLength={11}
            autoFocus
          />
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
          <p className="text-xs text-emerald-800">
            Demo: use <span className="font-mono font-bold text-emerald-700">01787492561</span> to test
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      <Button
        size="lg"
        className="w-full h-12 gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/30 border-0 text-white"
        onClick={handleSendOtp}
        disabled={localPhone.length < 11 || isLoading}
      >
        {isLoading ? "Sending..." : "Send Verification Code"}
        {!isLoading && <ArrowRight className="h-4 w-4" />}
      </Button>

      <Button variant="ghost" className="w-full gap-2" onClick={() => setStep("landing")}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
    </motion.div>
  );
}

// ── OTP Step ──
function OtpStep() {
  const { phone, setStep, setUserId, setUserName, setBusinesses, setIsLoading, setError, isLoading, error } = useAuthStore();
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Cooldown timer for resend
  useState(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  });

  const handleVerify = async (code?: string) => {
    const otpCode = code || otp.join("");
    if (otpCode.length < 4) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setUserId(data.user.id);
      setUserName(data.user.name);
      setBusinesses(data.businesses);

      // Route based on whether they have businesses
      if (data.businesses.length > 0) {
        setStep("discovery");
      } else {
        setStep("add-business");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResendCooldown(60);
      setOtp(["", "", "", ""]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resend OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 3) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }

    // Auto-verify when all 4 digits entered
    if (newOtp.every((d) => d !== "") && newOtp.join("").length === 4) {
      handleVerify(newOtp.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  return (
    <motion.div {...slideIn} className="space-y-6">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30 animate-pulse-soft">
          <ShieldCheck className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold">Verify your number</h2>
        <p className="text-muted-foreground text-sm">
          Enter the 4-digit code sent to{" "}
          <span className="font-semibold text-foreground">+880{phone}</span>
        </p>
      </div>

      <div className="flex justify-center gap-3">
        {otp.map((digit, i) => (
          <Input
            key={i}
            id={`otp-${i}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="w-14 h-14 text-center text-2xl font-bold p-0 rounded-2xl border-emerald-200/60 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500 shadow-sm"
            autoFocus={i === 0}
          />
        ))}
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-center">
        <p className="text-xs text-emerald-800">
          Demo OTP: <span className="font-mono font-bold text-emerald-700">9999</span>
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      <Button
        size="lg"
        className="w-full h-12 gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/30 border-0 text-white"
        onClick={() => handleVerify()}
        disabled={otp.some((d) => !d) || isLoading}
      >
        {isLoading ? "Verifying..." : "Verify"}
        {!isLoading && <CheckCircle2 className="h-4 w-4" />}
      </Button>

      {/* Resend OTP */}
      <div className="text-center">
        {resendCooldown > 0 ? (
          <p className="text-sm text-muted-foreground">
            Resend code in <span className="font-semibold">{resendCooldown}s</span>
          </p>
        ) : (
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleResend} disabled={isLoading}>
            <RefreshCw className="h-3.5 w-3.5" /> Resend Code
          </Button>
        )}
      </div>

      <Button variant="ghost" className="w-full gap-2" onClick={() => setStep("phone")}>
        <ArrowLeft className="h-4 w-4" /> Change phone number
      </Button>
    </motion.div>
  );
}

// ── Discovery Step (existing businesses) ──
function DiscoveryStep() {
  const { businesses, setStep, setSelectedBusiness, phone } = useAuthStore();

  return (
    <motion.div {...slideIn} className="space-y-6">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30">
          <Building2 className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold">Your Businesses</h2>
        <p className="text-muted-foreground text-sm">
          {businesses.length} {businesses.length === 1 ? "business" : "businesses"} linked to +880{phone}
        </p>
      </div>

      <div className="space-y-3">
        {businesses.map((biz) => (
          <Card
            key={biz.id}
            className="card-hover shadow-pharmacy cursor-pointer transition-all border-l-4 active:scale-[0.98] overflow-hidden"
            style={{ borderLeftColor: biz.businessType.color }}
            onClick={() => {
              setSelectedBusiness(biz);
              if (biz.hasCredentials) {
                setStep("login");
              } else {
                setStep("create-login");
              }
            }}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                style={gradientIconStyle(biz.businessType.color)}
              >
                {smallIconMap[biz.businessType.icon] || <Box className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{biz.name}</p>
                <p className="text-xs text-muted-foreground">{biz.businessType.name}</p>
              </div>
              <div className="text-right">
                {biz.hasCredentials ? (
                  <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Login</Badge>
                ) : (
                  <Badge className="text-[10px] bg-amber-100 text-amber-700 hover:bg-amber-100">Set Up</Badge>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      {/* Add Business button — labeled exactly per spec */}
      <Button
        variant="outline"
        size="lg"
        className="w-full h-12 gap-2 border-dashed border-emerald-400 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-2xl"
        onClick={() => {
          setSelectedBusiness(null);
          setStep("add-business");
        }}
      >
        <Plus className="h-4 w-4" /> Add Business
      </Button>

      <Button variant="ghost" className="w-full gap-2" onClick={() => { useAuthStore.getState().reset(); }}>
        <ArrowLeft className="h-4 w-4" /> Use different phone number
      </Button>
    </motion.div>
  );
}

// ── Add Business Step ──
function AddBusinessStep() {
  const { setStep, selectedBusinessTypeSlug, setSelectedBusinessTypeSlug, businesses } = useAuthStore();
  const modules = getAllModules();
  const hasExistingBusinesses = businesses.length > 0;

  return (
    <motion.div {...slideIn} className="space-y-6">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30">
          <Plus className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold">Choose your business type</h2>
        <p className="text-muted-foreground text-sm">
          Select the type that matches your business
        </p>
        {!hasExistingBusinesses && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            <p className="text-xs text-emerald-800">
              No businesses registered yet. Let&apos;s set up your first one!
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {modules.map((mod) => (
          <Card
            key={mod.slug}
            className={cn(
              "card-hover shadow-pharmacy overflow-hidden border-l-4 transition-all",
              mod.isActive
                ? "cursor-pointer active:scale-[0.98]"
                : "opacity-50 cursor-not-allowed",
              selectedBusinessTypeSlug === mod.slug && mod.isActive && "ring-2 ring-emerald-500"
            )}
            style={{ borderLeftColor: mod.isActive ? mod.color : undefined }}
            onClick={() => mod.isActive && setSelectedBusinessTypeSlug(mod.slug)}
          >
            <CardContent className="p-3 flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm"
                style={gradientIconStyle(mod.color)}
              >
                {smallIconMap[mod.icon] || <Box className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{mod.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{mod.description}</p>
              </div>
              {mod.isActive ? (
                selectedBusinessTypeSlug === mod.slug ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                ) : null
              ) : (
                <Badge variant="secondary" className="text-[10px] shrink-0">Soon</Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        size="lg"
        className="w-full h-12 gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/30 border-0 text-white"
        onClick={() => setStep("create-login")}
      >
        Continue with {modules.find((m) => m.slug === selectedBusinessTypeSlug)?.name}
        <ArrowRight className="h-4 w-4" />
      </Button>

      <Button variant="ghost" className="w-full gap-2" onClick={() => {
        if (hasExistingBusinesses) {
          setStep("discovery");
        } else {
          setStep("otp");
        }
      }}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
    </motion.div>
  );
}

// ── Create Login Step ──
function CreateLoginStep() {
  const {
    userId, selectedBusinessTypeSlug, newBusinessName, setNewBusinessName,
    newBusinessAddress, setNewBusinessAddress, username, setUsername,
    password, setPassword, setStep, setBusinesses, setSelectedBusiness,
    setIsLoading, setError, error, businesses, setSession, isLoading,
  } = useAuthStore();

  const modules = getAllModules();
  const selectedType = modules.find((m) => m.slug === selectedBusinessTypeSlug);

  const handleRegister = async () => {
    if (!newBusinessName.trim()) {
      setError("Please enter your business name");
      return;
    }
    if (!username.trim() || username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (!password || password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          businessTypeId: selectedBusinessTypeSlug,
          businessName: newBusinessName.trim(),
          address: newBusinessAddress.trim() || null,
          username: username.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Add new business to list
      const updatedBusinesses = [...businesses, data.business];
      setBusinesses(updatedBusinesses);
      setSelectedBusiness(data.business);

      // Auto-login to get session token
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: data.business.id,
          username: username.trim(),
          password,
        }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) throw new Error(loginData.error);

      setSession(loginData);
      setStep("dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div {...slideIn} className="space-y-5">
      <div className="text-center space-y-3">
        <div
          className="inline-flex items-center justify-center h-16 w-16 rounded-2xl text-white shadow-lg"
          style={gradientIconStyle(selectedType?.color || "#16a34a")}
        >
          {smallIconMap[selectedType?.icon || ""] || <Plus className="h-8 w-8" />}
        </div>
        <h2 className="text-2xl font-bold">Set up your {selectedType?.name}</h2>
        <p className="text-muted-foreground text-sm">
          Tell us about your business and create your login
        </p>
      </div>

      {/* Business Details — Blue dot indicator */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          <p className="text-sm font-semibold text-blue-700">Business Information</p>
        </div>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="bizName" className="text-sm font-medium flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Business Name *
            </Label>
            <Input
              id="bizName"
              placeholder="e.g., City Pharmacy"
              value={newBusinessName}
              onChange={(e) => { setNewBusinessName(e.target.value); setError(null); }}
              className="h-11 rounded-xl border-emerald-200/60 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bizAddr" className="text-sm font-medium flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Address (optional)
            </Label>
            <Input
              id="bizAddr"
              placeholder="e.g., 123 Main Road, Dhaka"
              value={newBusinessAddress}
              onChange={(e) => setNewBusinessAddress(e.target.value)}
              className="h-11 rounded-xl border-emerald-200/60 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Create Login Credentials — Emerald dot indicator */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <p className="text-sm font-semibold text-emerald-700">Create your login credentials</p>
        </div>
        <p className="text-xs text-muted-foreground">
          These credentials are only for this business. You can create different logins for other businesses.
        </p>
        <div className="space-y-2">
          <Label htmlFor="username" className="text-xs font-medium">Username *</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="username"
              placeholder="e.g., admin"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(null); }}
              className="h-11 pl-9 rounded-xl border-emerald-200/60 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-xs font-medium">Password *</Label>
          <PasswordInput
            id="regPassword"
            value={password}
            onChange={(val) => { setPassword(val); setError(null); }}
            placeholder="Min 4 characters"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      <Button
        size="lg"
        className="w-full h-12 gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/30 border-0 text-white"
        onClick={handleRegister}
        disabled={isLoading}
      >
        {isLoading ? "Creating..." : "Create Business & Login"}
        {!isLoading && <CheckCircle2 className="h-4 w-4" />}
      </Button>

      <Button variant="ghost" className="w-full gap-2" onClick={() => setStep("add-business")}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
    </motion.div>
  );
}

// ── Login Step ──
function LoginStep() {
  const {
    selectedBusiness, username, setUsername, password, setPassword,
    setStep, setSession, setIsLoading, setError, error, isLoading,
  } = useAuthStore();

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError("Please enter your username and password");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: selectedBusiness?.id,
          username: username.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSession(data);
      setStep("dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div {...slideIn} className="space-y-6">
      <div className="text-center space-y-3">
        {selectedBusiness && (
          <div
            className="inline-flex items-center justify-center h-16 w-16 rounded-2xl text-white shadow-lg"
            style={gradientIconStyle(selectedBusiness.businessType.color)}
          >
            {smallIconMap[selectedBusiness.businessType.icon] || <Building2 className="h-8 w-8" />}
          </div>
        )}
        <h2 className="text-2xl font-bold">Welcome back</h2>
        <p className="text-muted-foreground text-sm">
          Log in to <span className="font-semibold text-foreground">{selectedBusiness?.name}</span>
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="loginUser" className="text-sm font-medium">Username</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="loginUser"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(null); }}
              className="h-11 pl-9 rounded-xl border-emerald-200/60 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500"
              autoFocus
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="loginPass" className="text-sm font-medium">Password</Label>
          <PasswordInput
            id="loginPass"
            value={password}
            onChange={(val) => { setPassword(val); setError(null); }}
            placeholder="Enter your password"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      <Button
        size="lg"
        className="w-full h-12 gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/30 border-0 text-white"
        onClick={handleLogin}
        disabled={isLoading}
      >
        {isLoading ? "Logging in..." : "Log In"}
        {!isLoading && <ArrowRight className="h-4 w-4" />}
      </Button>

      <Button variant="ghost" className="w-full gap-2" onClick={() => setStep("discovery")}>
        <ArrowLeft className="h-4 w-4" /> Back to my businesses
      </Button>
    </motion.div>
  );
}

// ── Dashboard Step ──
// Now renders the full PharmacyShell with dashboard, products, categories, etc.
function DashboardStep() {
  const session = useAuthStore((s) => s.session);

  if (!session) return null;

  return <PharmacyShell />;
}

// ── Dynamic step indicator steps ──
function getStepPath(step: string, businesses: number): string[] {
  if (step === "landing") return [];
  if (businesses > 0) {
    // Has businesses path: phone → otp → discovery → (login or add-business → create-login) → dashboard
    return ["phone", "otp", "discovery", "login", "dashboard"];
  }
  // No businesses path: phone → otp → add-business → create-login → dashboard
  return ["phone", "otp", "add-business", "create-login", "dashboard"];
}

// ── Main Page ──
export default function HomePage() {
  const { step, businesses, session, reset, setStep } = useAuthStore();
  const stepPath = getStepPath(step, businesses.length);

  // On mount, check if we have a persisted session and redirect to dashboard
  // This setState-in-effect is intentional: we need to hydrate from localStorage
  // after the first render to avoid SSR/client mismatch
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Restore session from persisted state
    const store = useAuthStore.getState();
    if (store.session && store.step !== "dashboard") {
      store.setStep("dashboard");
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, []);

  // Show nothing until first check is complete to avoid flash of wrong state
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center pharmacy-bg">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center animate-pulse shadow-lg shadow-emerald-500/30">
          <Box className="h-5 w-5 text-white" />
        </div>
      </div>
    );
  }

  // Dashboard has its own bottom nav and full-screen layout
  const isDashboard = step === "dashboard";

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-emerald-50/30 pharmacy-bg">
      {!isDashboard && (
        <>
          {/* Header — glass morphism with gradient emerald logo box */}
          <header className="glass border-b border-emerald-100/50 sticky top-0 z-10">
            <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/30">
                <Box className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-lg">Inventory<span className="text-emerald-600">OS</span></span>
              {step !== "landing" && (
                <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={reset}>
                  Start Over
                </Button>
              )}
            </div>
          </header>

          {/* Step indicator — emerald active dots */}
          {stepPath.length > 1 && (
            <div className="py-3 bg-card/30 backdrop-blur-sm">
              <StepIndicator current={step} steps={stepPath} />
            </div>
          )}
        </>
      )}

      {/* Main content */}
      <main className={cn(
        "flex-1 max-w-md mx-auto w-full",
        isDashboard ? "px-4 py-4" : "px-4 py-6",
        isDashboard && "flex flex-col"
      )}>
        <AnimatePresence mode="wait">
          {step === "landing" && <LandingStep key="landing" />}
          {step === "phone" && <PhoneStep key="phone" />}
          {step === "otp" && <OtpStep key="otp" />}
          {step === "discovery" && <DiscoveryStep key="discovery" />}
          {step === "add-business" && <AddBusinessStep key="add-business" />}
          {step === "create-login" && <CreateLoginStep key="create-login" />}
          {step === "login" && <LoginStep key="login" />}
          {step === "dashboard" && <DashboardStep key="dashboard" />}
        </AnimatePresence>
      </main>

      {!isDashboard && (
        /* Footer — clean with muted text */
        <footer className="border-t border-emerald-100/50 bg-card/30 mt-auto">
          <div className="max-w-md mx-auto px-4 py-3 text-center text-[11px] text-muted-foreground">
            InventoryOS — Simple inventory for every business
          </div>
        </footer>
      )}
    </div>
  );
}
