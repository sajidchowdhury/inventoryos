"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  LogOut, Building2, MapPin, User, Shield, ChevronRight,
  Bell, Palette, HelpCircle, UserCog, Phone, Lock, Save,
  Crown, Sparkles, CheckCircle2, Clock, CreditCard,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { cn } from "@/lib/utils";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

function getInitials(name?: string | null) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProfileView() {
  const { session, reset, businesses } = useAuthStore();
  const setActiveView = useNavStore((s) => s.setActiveView);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!session) return null;

  const { business, user } = session;
  const displayName = user.fullName || user.username;

  const handleLogout = () => {
    reset();
  };

  const handleSave = () => {
    // Profile is read-only at this stage — show confirmation
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <motion.div
      {...fadeIn}
      className="pharmacy-bg min-h-screen -mx-4 -my-4 px-4 py-4 space-y-4 pb-6"
    >
      {/* ── Header — gradient emerald card ── */}
      <Card className="stagger-in overflow-hidden border-0 shadow-pharmacy-lg">
        <div className="relative bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 p-5">
          <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-white/10" />
          <div className="absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-white/5" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur ring-2 ring-white/30 flex items-center justify-center shrink-0">
              <span className="text-white text-xl font-bold tracking-wide">{getInitials(displayName)}</span>
            </div>
            <div className="flex-1 min-w-0 text-white">
              <h2 className="text-lg font-bold leading-tight truncate">{displayName}</h2>
              <p className="text-[11px] text-emerald-50/90 capitalize mt-0.5">{user.role} access</p>
              {business.name && (
                <p className="text-[10px] text-emerald-100/80 truncate mt-0.5 flex items-center gap-1">
                  <Building2 className="h-2.5 w-2.5" /> {business.name}
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Business Info ── */}
      <Card className="card-hover shadow-pharmacy stagger-in border-0 overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <h3 className="text-sm font-bold">Business Info</h3>
          </div>
          <div className="space-y-2.5 pt-1">
            <div className="flex items-start gap-2 text-xs">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Name</p>
                <p className="font-semibold">{business.name}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Address</p>
                <p className="font-medium">{business.address || "Not set"}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Phone</p>
                <p className="font-medium">{useAuthStore.getState().phone || "Not set"}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Type</p>
                <Badge variant="outline" className="text-[10px] mt-0.5">{business.businessType.name}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Account Info ── */}
      <Card className="card-hover shadow-pharmacy stagger-in border-0 overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-white" />
            </div>
            <h3 className="text-sm font-bold">Account Info</h3>
          </div>
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center gap-2 text-xs">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide w-20">Username</p>
              <p className="font-semibold flex-1 truncate">@{user.username}</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide w-20">Role</p>
              <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100 capitalize">{user.role}</Badge>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide w-20">Last Login</p>
              <p className="font-medium flex-1">Just now</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Subscription ── */}
      <Card className="card-hover shadow-pharmacy stagger-in border-0 overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
              <CreditCard className="h-4 w-4 text-white" />
            </div>
            <h3 className="text-sm font-bold">Subscription</h3>
            <Badge className="ml-auto text-[9px] bg-gradient-to-r from-amber-400 to-orange-500 text-white hover:from-amber-400 hover:to-orange-500 border-0">
              <Crown className="h-2.5 w-2.5 mr-0.5" /> Pro
            </Badge>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Status</span>
              <Badge className="text-[9px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">
                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Active
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-purple-500" /> AI Usage
              </span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 rounded-full bg-emerald-200 overflow-hidden">
                  <div className="h-full w-2/3 bg-gradient-to-r from-emerald-500 to-teal-500" />
                </div>
                <span className="text-[10px] font-semibold text-emerald-700">33/50</span>
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground pt-0.5">Resets daily · Powered by GLM-4</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Quick Settings list (preserves original nav) ── */}
      <Card className="shadow-pharmacy stagger-in border-0 overflow-hidden">
        <CardContent className="p-0 divide-y">
          <button
            className="w-full p-3.5 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
            onClick={() => setActiveView("users")}
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shrink-0">
              <UserCog className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">User Management</p>
              <p className="text-[11px] text-muted-foreground">Roles, permissions, team members</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
          {[
            { icon: Bell, label: "Notifications", desc: "Alerts & reminders", grad: "from-amber-500 to-orange-500" },
            { icon: Shield, label: "Security", desc: "Password & access", grad: "from-rose-500 to-red-500" },
            { icon: Palette, label: "Appearance", desc: "Theme & display", grad: "from-fuchsia-500 to-purple-500" },
            { icon: HelpCircle, label: "Help & Support", desc: "FAQ & contact", grad: "from-sky-500 to-blue-500" },
          ].map((item) => (
            <button
              key={item.label}
              className="w-full p-3.5 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
            >
              <div className={cn("h-8 w-8 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0", item.grad)}>
                <item.icon className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-[11px] text-muted-foreground">{item.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </CardContent>
      </Card>

      {/* ── Action buttons ── */}
      <div className="grid grid-cols-2 gap-2 stagger-in">
        <Button
          variant="outline"
          className="gap-2 h-11 border-emerald-500 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
          onClick={() => setPasswordOpen(true)}
        >
          <Lock className="h-4 w-4" /> Change Password
        </Button>
        <Button
          className="gap-2 h-11 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white border-0 shadow-md shadow-emerald-500/20"
          onClick={handleSave}
        >
          {saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? "Saved!" : "Save"}
        </Button>
      </div>

      {/* ── Switch Business ── */}
      {businesses.length > 1 && (
        <Button
          variant="outline"
          className="w-full gap-2 h-11"
          onClick={() => {
            useAuthStore.getState().setSelectedBusiness(null);
            useAuthStore.getState().setUsername("");
            useAuthStore.getState().setPassword("");
            useAuthStore.getState().setSession(null);
            useAuthStore.getState().setStep("discovery");
          }}
        >
          <Building2 className="h-4 w-4" /> Switch Business ({businesses.length} registered)
        </Button>
      )}

      {/* ── Logout ── */}
      <Button
        className="w-full gap-2 h-11 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white border-0 shadow-md shadow-rose-500/20"
        onClick={handleLogout}
      >
        <LogOut className="h-4 w-4" /> Log Out
      </Button>

      <p className="text-center text-[10px] text-muted-foreground pt-1">
        InventoryOS v1.0 — Phase 1a
      </p>

      {/* ── Change Password Dialog ── */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <ChangePasswordDialog
            userId={user.id}
            username={displayName}
            requireCurrentPassword
            onComplete={() => setPasswordOpen(false)}
            onCancel={() => setPasswordOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
