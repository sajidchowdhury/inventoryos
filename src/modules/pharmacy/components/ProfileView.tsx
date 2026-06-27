"use client";

import { motion } from "framer-motion";
import {
  LogOut, Building2, MapPin, User, Shield, ChevronRight,
  Bell, Palette, HelpCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

export function ProfileView() {
  const { session, reset, businesses } = useAuthStore();
  const setActiveView = useNavStore((s) => s.setActiveView);

  if (!session) return null;

  const { business, user } = session;

  const handleLogout = () => {
    reset();
  };

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Business Card */}
      <Card className="overflow-hidden">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white"
              style={{ backgroundColor: business.businessType.color }}
            >
              <Building2 className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{business.name}</h2>
              <p className="text-sm text-muted-foreground">{business.businessType.name}</p>
            </div>
          </div>
          {business.address && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {business.address}
            </p>
          )}
        </CardContent>
      </Card>

      {/* User Card */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">{user.username}</p>
            <p className="text-xs text-muted-foreground capitalize">{user.role} access</p>
          </div>
          <Badge variant="secondary" className="text-xs">Active</Badge>
        </CardContent>
      </Card>

      {/* Settings List */}
      <Card>
        <CardContent className="p-0 divide-y">
          {[
            { icon: Bell, label: "Notifications", desc: "Alerts & reminders" },
            { icon: Shield, label: "Security", desc: "Password & access" },
            { icon: Palette, label: "Appearance", desc: "Theme & display" },
            { icon: HelpCircle, label: "Help & Support", desc: "FAQ & contact" },
          ].map((item) => (
            <button
              key={item.label}
              className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
            >
              <item.icon className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Switch Business */}
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

      {/* Logout */}
      <Button
        variant="destructive"
        className="w-full gap-2 h-11"
        onClick={handleLogout}
      >
        <LogOut className="h-4 w-4" /> Log Out
      </Button>

      <p className="text-center text-[10px] text-muted-foreground pt-2">
        InventoryOS v1.0 — Phase 1a
      </p>
    </motion.div>
  );
}
