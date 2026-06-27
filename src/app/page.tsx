"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getAllModules } from "@/lib/modules";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

// ── Icon map ──
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

// ── Step indicator dots ──
function StepIndicator({ current, steps }: { current: string; steps: string[] }) {
  const idx = steps.indexOf(current);
  return (
    <div className="flex items-center gap-1.5 justify-center">
      {steps.map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-2 rounded-full transition-all duration-500",
            i === idx ? "w-8 bg-primary" : i < idx ? "w-2 bg-primary/50" : "w-2 bg-muted-foreground/20"
          )}
        />
      ))}
    </div>
  );
}

// ── Landing Step ──
function LandingStep() {
  const { setStep } = useAuthStore();
  const modules = getAllModules();

  return (
    <motion.div {...fadeIn} className="space-y-8">
      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary shadow-lg shadow-primary/25">
          <Box className="h-10 w-10 text-primary-foreground" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          Inventory<span className="text-primary">OS</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
          Simple, powerful inventory management built for every business type.
          One platform, many solutions.
        </p>
      </div>

      {/* Business type showcase */}
      <div className="space-y-3">
        <p className="text-sm text-center text-muted-foreground font-medium">
          We manage inventory for
        </p>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {modules.map((mod) => (
            <div
              key={mod.slug}
              className="flex flex-col items-center gap-1.5 p-2"
            >
              <div
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center text-white transition-transform hover:scale-110",
                  mod.isActive ? "shadow-md" : "opacity-40"
                )}
                style={{ backgroundColor: mod.color }}
              >
                {iconMap[mod.icon] || <Box className="h-7 w-7" />}
              </div>
              <span className={cn(
                "text-[10px] font-medium text-center leading-tight",
                mod.isActive ? "text-foreground" : "text-muted-foreground"
              )}>
                {mod.name}
              </span>
              {mod.isActive && (
                <Badge className="text-[8px] px-1 py-0 h-4 text-white" style={{ backgroundColor: mod.color }}>
                  Live
                </Badge>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 space-y-3">
          <p className="font-semibold text-sm text-primary flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> How it works
          </p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold shrink-0">1.</span>
              <span>Enter your phone number to get started</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold shrink-0">2.</span>
              <span>Choose your business type and set it up</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold shrink-0">3.</span>
              <span>Start managing your inventory instantly</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <Button
        size="lg"
        className="w-full h-14 text-lg gap-2 shadow-lg shadow-primary/25"
        onClick={() => setStep("phone")}
      >
        Get Started
        <ArrowRight className="h-5 w-5" />
      </Button>
      <p className="text-xs text-center text-muted-foreground">
        No credit card needed. Free for small businesses.
      </p>
    </motion.div>
  );
}

// ── Phone Step ──
function PhoneStep() {
  const { phone, setPhone, setStep, setIsLoading, setError, error } = useAuthStore();
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
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary">
          <Phone className="h-8 w-8" />
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
          <div className="flex items-center px-3 rounded-lg border bg-muted/50 text-sm font-medium text-muted-foreground shrink-0">
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
            className="h-12 text-lg"
            maxLength={11}
            autoFocus
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Demo: use <span className="font-mono font-bold text-primary">01787492561</span> to test
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      <Button
        size="lg"
        className="w-full h-12 gap-2"
        onClick={handleSendOtp}
        disabled={localPhone.length < 11 || useAuthStore.getState().isLoading}
      >
        {useAuthStore.getState().isLoading ? "Sending..." : "Send Verification Code"}
        <ArrowRight className="h-4 w-4" />
      </Button>

      <Button variant="ghost" className="w-full gap-2" onClick={() => setStep("landing")}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
    </motion.div>
  );
}

// ── OTP Step ──
function OtpStep() {
  const { phone, setStep, setUserId, setUserName, setBusinesses, setIsLoading, setError, error } = useAuthStore();
  const [otp, setOtp] = useState(["", "", "", ""]);
  const inputRefs = useState<(HTMLInputElement | null)[]>([]);

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
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="h-8 w-8" />
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
            className="w-14 h-14 text-center text-2xl font-bold p-0"
            autoFocus={i === 0}
          />
        ))}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Demo OTP: <span className="font-mono font-bold text-primary">9999</span>
      </p>

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      <Button
        size="lg"
        className="w-full h-12 gap-2"
        onClick={() => handleVerify()}
        disabled={otp.some((d) => !d) || useAuthStore.getState().isLoading}
      >
        {useAuthStore.getState().isLoading ? "Verifying..." : "Verify"}
        <CheckCircle2 className="h-4 w-4" />
      </Button>

      <Button variant="ghost" className="w-full gap-2" onClick={() => setStep("phone")}>
        <ArrowLeft className="h-4 w-4" /> Change phone number
      </Button>
    </motion.div>
  );
}

// ── Discovery Step (existing businesses) ──
function DiscoveryStep() {
  const { businesses, setStep, setSelectedBusiness, phone, setPhone } = useAuthStore();

  return (
    <motion.div {...slideIn} className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary">
          <Building2 className="h-8 w-8" />
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
            className="cursor-pointer hover:shadow-md transition-all border-l-4 active:scale-[0.98]"
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
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: biz.businessType.color }}
              >
                {smallIconMap[biz.businessType.icon] || <Box className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{biz.name}</p>
                <p className="text-xs text-muted-foreground">{biz.businessType.name}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      {/* Add Another Business */}
      <Button
        variant="outline"
        size="lg"
        className="w-full h-12 gap-2 border-dashed"
        onClick={() => {
          setSelectedBusiness(null);
          setStep("add-business");
        }}
      >
        <Plus className="h-4 w-4" /> Add Another Business
      </Button>

      <Button variant="ghost" className="w-full gap-2" onClick={() => { setPhone(""); setStep("landing"); }}>
        <ArrowLeft className="h-4 w-4" /> Start over with different number
      </Button>
    </motion.div>
  );
}

// ── Add Business Step ──
function AddBusinessStep() {
  const { setStep, selectedBusinessTypeSlug, setSelectedBusinessTypeSlug } = useAuthStore();
  const modules = getAllModules();

  return (
    <motion.div {...slideIn} className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary">
          <Plus className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold">Choose your business type</h2>
        <p className="text-muted-foreground text-sm">
          Select the type that matches your business
        </p>
      </div>

      <div className="space-y-2">
        {modules.map((mod) => (
          <Card
            key={mod.slug}
            className={cn(
              "cursor-pointer transition-all",
              mod.isActive
                ? "hover:shadow-md active:scale-[0.98]"
                : "opacity-50 cursor-not-allowed",
              selectedBusinessTypeSlug === mod.slug && mod.isActive && "ring-2 ring-primary"
            )}
            onClick={() => mod.isActive && setSelectedBusinessTypeSlug(mod.slug)}
          >
            <CardContent className="p-3 flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: mod.color }}
              >
                {smallIconMap[mod.icon] || <Box className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{mod.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{mod.description}</p>
              </div>
              {mod.isActive ? (
                selectedBusinessTypeSlug === mod.slug ? (
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
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
        className="w-full h-12 gap-2"
        onClick={() => setStep("create-login")}
      >
        Continue with {modules.find((m) => m.slug === selectedBusinessTypeSlug)?.name}
        <ArrowRight className="h-4 w-4" />
      </Button>

      <Button variant="ghost" className="w-full gap-2" onClick={() => setStep("discovery")}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
    </motion.div>
  );
}

// ── Create Login Step (new business + credentials) ──
function CreateLoginStep() {
  const {
    userId, selectedBusinessTypeSlug, newBusinessName, setNewBusinessName,
    newBusinessAddress, setNewBusinessAddress, username, setUsername,
    password, setPassword, setStep, setBusinesses, setSelectedBusiness,
    setIsLoading, setError, error, businesses, setSession,
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

      // Auto-login: call login API to get a session token
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
      <div className="text-center space-y-2">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl text-white"
          style={{ backgroundColor: selectedType?.color || "#2563EB" }}
        >
          {smallIconMap[selectedType?.icon || ""] || <Plus className="h-8 w-8" />}
        </div>
        <h2 className="text-2xl font-bold">Set up your {selectedType?.name}</h2>
        <p className="text-muted-foreground text-sm">
          Tell us about your business and create your login
        </p>
      </div>

      {/* Business Details */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="bizName" className="text-sm font-medium flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Business Name *
          </Label>
          <Input
            id="bizName"
            placeholder="e.g., City Pharmacy"
            value={newBusinessName}
            onChange={(e) => { setNewBusinessName(e.target.value); setError(null); }}
            className="h-11"
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
            className="h-11"
          />
        </div>
      </div>

      <Separator />

      {/* Create Login Credentials */}
      <div className="space-y-3">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" /> Create your login credentials
        </p>
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
              className="h-11 pl-9"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-xs font-medium">Password *</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              placeholder="Min 4 characters"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              className="h-11 pl-9"
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      <Button
        size="lg"
        className="w-full h-12 gap-2"
        onClick={handleRegister}
        disabled={useAuthStore.getState().isLoading}
      >
        {useAuthStore.getState().isLoading ? "Creating..." : "Create Business & Login"}
        <CheckCircle2 className="h-4 w-4" />
      </Button>

      <Button variant="ghost" className="w-full gap-2" onClick={() => {
        if (businesses.length > 0) {
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

// ── Login Step ──
function LoginStep() {
  const {
    selectedBusiness, username, setUsername, password, setPassword,
    setStep, setSession, setIsLoading, setError, error,
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
      <div className="text-center space-y-2">
        {selectedBusiness && (
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl text-white"
            style={{ backgroundColor: selectedBusiness.businessType.color }}
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
              className="h-11 pl-9"
              autoFocus
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="loginPass" className="text-sm font-medium">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="loginPass"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              className="h-11 pl-9"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      <Button
        size="lg"
        className="w-full h-12 gap-2"
        onClick={handleLogin}
        disabled={useAuthStore.getState().isLoading}
      >
        {useAuthStore.getState().isLoading ? "Logging in..." : "Log In"}
        <ArrowRight className="h-4 w-4" />
      </Button>

      <Button variant="ghost" className="w-full gap-2" onClick={() => setStep("discovery")}>
        <ArrowLeft className="h-4 w-4" /> Back to my businesses
      </Button>
    </motion.div>
  );
}

// ── Dashboard Step ──
function DashboardStep() {
  const { session, reset } = useAuthStore();

  if (!session) return null;

  const { business, user } = session;

  return (
    <motion.div {...fadeIn} className="space-y-6">
      {/* Welcome card */}
      <Card
        className="border-l-4 overflow-hidden"
        style={{ borderLeftColor: business.businessType.color }}
      >
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white"
              style={{ backgroundColor: business.businessType.color }}
            >
              {smallIconMap[business.businessType.icon] || <Building2 className="h-7 w-7" />}
            </div>
            <div>
              <h2 className="text-xl font-bold">{business.name}</h2>
              <p className="text-sm text-muted-foreground">{business.businessType.name}</p>
            </div>
          </div>
          <Badge className="text-white" style={{ backgroundColor: business.businessType.color }}>
            <CheckCircle2 className="h-3 w-3 mr-1" /> You are logged in
          </Badge>
        </CardContent>
      </Card>

      {/* Quick stats placeholder */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">0</p>
            <p className="text-xs text-muted-foreground">Products</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">0</p>
            <p className="text-xs text-muted-foreground">Low Stock</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">0</p>
            <p className="text-xs text-muted-foreground">Today&apos;s Sales</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">0</p>
            <p className="text-xs text-muted-foreground">Expiring Soon</p>
          </CardContent>
        </Card>
      </div>

      {/* User info */}
      <Card className="bg-muted/50">
        <CardContent className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Logged in as</p>
          <p className="font-semibold">{user.username}</p>
          <p className="text-xs text-muted-foreground capitalize">{user.role} access</p>
          {business.address && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {business.address}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Coming soon notice */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 text-center space-y-2">
          <Sparkles className="h-6 w-6 text-primary mx-auto" />
          <p className="font-semibold text-sm">Inventory features coming in Phase 2!</p>
          <p className="text-xs text-muted-foreground">
            Product management, stock tracking, expiry alerts, and more are being built right now.
          </p>
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full gap-2" onClick={reset}>
        <LogOut className="h-4 w-4" /> Log Out
      </Button>
    </motion.div>
  );
}

// ── Main Page ──
const AUTH_STEPS = ["phone", "otp", "discovery", "add-business", "create-login", "login", "dashboard"];

export default function HomePage() {
  const { step, businesses, reset } = useAuthStore();

  // Handle case where user has businesses (skip add-business in step indicator)
  const visibleSteps = businesses.length > 0
    ? AUTH_STEPS
    : ["phone", "otp", "add-business", "create-login", "dashboard"];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Box className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg">Inventory<span className="text-primary">OS</span></span>
          {step !== "landing" && (
            <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={reset}>
              Start Over
            </Button>
          )}
        </div>
      </header>

      {/* Step indicator */}
      {step !== "landing" && (
        <div className="py-3 bg-card/50">
          <StepIndicator current={step} steps={visibleSteps} />
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6">
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

      {/* Footer */}
      <footer className="border-t bg-card/50 mt-auto">
        <div className="max-w-md mx-auto px-4 py-3 text-center text-[11px] text-muted-foreground">
          InventoryOS — Simple inventory for every business
        </div>
      </footer>
    </div>
  );
}
