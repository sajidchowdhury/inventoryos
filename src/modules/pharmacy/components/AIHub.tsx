"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft, Sparkles, Brain, MessageSquare,
  CalendarClock, Zap, ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

interface AIFeature {
  view: "ai-insights" | "ai-chat" | "ai-forecast" | "ai-expiry-opt";
  title: string;
  description: string;
  icon: typeof Brain;
  gradient: string;
  iconBg: string;
  iconColor: string;
  badge?: string;
}

const aiFeatures: AIFeature[] = [
  {
    view: "ai-insights",
    title: "AI Insights",
    description: "Get AI-powered business health analysis with actionable recommendations",
    icon: Brain,
    gradient: "from-purple-500 to-indigo-500",
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    badge: "Recommended",
  },
  {
    view: "ai-chat",
    title: "AI Chat Assistant",
    description: "Ask questions about your stock, sales, expiry, and finances in plain English",
    icon: MessageSquare,
    gradient: "from-violet-500 to-purple-500",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
  },
  {
    view: "ai-forecast",
    title: "Demand Forecast",
    description: "90-day demand predictions with trend analysis and confidence scores",
    icon: CalendarClock,
    gradient: "from-indigo-500 to-blue-500",
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
  },
  {
    view: "ai-expiry-opt",
    title: "Expiry Optimizer",
    description: "AI recommends actions for expiring batches — sell, discount, return, or dispose",
    icon: Zap,
    gradient: "from-purple-500 to-pink-500",
    iconBg: "bg-pink-50",
    iconColor: "text-pink-600",
  },
];

export function AIHub() {
  const { setActiveView } = useNavStore();

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4 pharmacy-bg min-h-screen">
      {/* ── Header ── */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1 flex items-center gap-1.5">
          <Sparkles className="h-5 w-5 text-purple-600" /> AI Features
        </h1>
      </div>

      {/* ── Hero Card ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-600 p-5 shadow-lg shadow-purple-500/20 stagger-in">
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
          <svg viewBox="0 0 100 100" fill="white">
            <circle cx="70" cy="30" r="40" />
            <circle cx="30" cy="70" r="25" />
          </svg>
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center animate-pulse-soft">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-white/80 text-xs">AI-Powered</p>
              <h2 className="text-white text-lg font-bold">Pharmacy Intelligence</h2>
            </div>
          </div>
          <p className="text-white/90 text-sm leading-relaxed mb-3">
            Let AI analyze your inventory, predict demand, optimize expiry, and answer your business questions instantly.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 text-white text-[10px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
              AI Active
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 text-white text-[10px] font-medium">
              <Zap className="h-2.5 w-2.5" />
              Instant responses
            </span>
          </div>
        </div>
      </div>

      {/* ── AI Feature Cards Grid ── */}
      <div className="grid grid-cols-1 gap-3">
        {aiFeatures.map((feature, idx) => {
          const Icon = feature.icon;
          return (
            <Card
              key={idx}
              className="card-hover cursor-pointer overflow-hidden border-0 shadow-pharmacy stagger-in"
              onClick={() => setActiveView(feature.view)}
              style={{ animationDelay: `${0.1 + idx * 0.05}s` }}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Gradient icon */}
                  <div className={cn(
                    "h-12 w-12 rounded-2xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-lg",
                    feature.gradient
                  )}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-gray-900">{feature.title}</h3>
                      {feature.badge && (
                        <Badge className="text-[8px] h-4 px-1.5 bg-purple-100 text-purple-700 hover:bg-purple-100">
                          {feature.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{feature.description}</p>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="h-5 w-5 text-gray-300 shrink-0 mt-1" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── AI Usage Note ── */}
      <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 text-center stagger-in" style={{ animationDelay: "0.4s" }}>
        <Sparkles className="h-6 w-6 text-purple-400 mx-auto mb-2" />
        <p className="text-xs text-purple-700 font-medium">
          AI features use your pharmacy data to provide insights.
        </p>
        <p className="text-[10px] text-purple-500 mt-1">
          Rate limited to 50 calls/day · Powered by GLM-4
        </p>
      </div>
    </motion.div>
  );
}
