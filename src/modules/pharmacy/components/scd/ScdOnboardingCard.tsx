"use client";

// ScdOnboardingCard — first-time empty state for Stock Count Day.
// Shown when a pharmacy has 0 storage zones AND 0 past SCDs.
// Explains WHY monthly counts matter (compliance + theft detection)
// and gives a single clear CTA to set up the first zone.

import { motion } from "framer-motion";
import {
  ClipboardList, MapPin, CheckCircle2, ArrowRight,
  ShieldCheck, TrendingDown, Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

interface ScdOnboardingCardProps {
  /** Called when user taps "Set up your first zone" */
  onSetupZones: () => void;
}

export function ScdOnboardingCard({ onSetupZones }: ScdOnboardingCardProps) {
  return (
    <motion.div {...fadeIn} className="space-y-4">
      {/* ── Hero card: why SCD matters ── */}
      <Card className="shadow-pharmacy-lg overflow-hidden border-0">
        {/* Gradient header */}
        <div className="relative bg-gradient-to-br from-teal-600 via-emerald-600 to-emerald-700 p-5 text-white">
          <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-white/10" />
          <div className="absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-white/5" />
          <div className="relative z-10 flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur ring-2 ring-white/30 flex items-center justify-center shrink-0">
              <ClipboardList className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                Stock Count Day
              </p>
              <h2 className="text-lg font-bold leading-tight mt-0.5">
                Count your stock once a month
              </h2>
              <p className="text-sm text-emerald-50/90 mt-1 leading-relaxed">
                Catch theft, catch spoilage, and stay ready for regulators — all without closing the shop.
              </p>
            </div>
          </div>
        </div>

        {/* Value props */}
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-4 w-4 text-rose-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Stop shrinkage early</p>
              <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
                Missing stock adds up fast. A monthly count catches a 20-strip gap before it becomes 200.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <TrendingDown className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Catch expired stock</p>
              <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
                Physical count surfaces batches that the system missed — so you can dispose or discount before they cost you.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Audit-ready, always</p>
              <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
                Every count is recorded with who counted what, when, and any variances — ready for any inspector.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 3-step walkthrough ── */}
      <Card className="shadow-pharmacy">
        <CardContent className="p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
            How it works
          </p>
          <div className="space-y-3">
            <StepRow
              n={1}
              icon={MapPin}
              title="Name your zones"
              desc="e.g. Front counter, Back rack, Fridge"
              accent="bg-teal-100 text-teal-700"
            />
            <StepRow
              n={2}
              icon={ClipboardList}
              title="Count each zone"
              desc="Sales keep running — the system tracks what sells during the count"
              accent="bg-emerald-100 text-emerald-700"
            />
            <StepRow
              n={3}
              icon={CheckCircle2}
              title="Apply to inventory"
              desc="Review variances, then update stock levels in one tap"
              accent="bg-blue-100 text-blue-700"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Primary CTA ── */}
      <Button
        size="lg"
        className="w-full h-14 gap-2 text-base shadow-lg shadow-emerald-500/20 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 rounded-2xl"
        onClick={onSetupZones}
      >
        <MapPin className="h-5 w-5" />
        Set up your first zone
        <ArrowRight className="h-4 w-4" />
      </Button>

      <p className="text-center text-[11px] text-gray-400 px-4">
        Takes 2 minutes. You only do this once — the system learns your zones as you count.
      </p>
    </motion.div>
  );
}

// ── Helper: numbered step row ──
function StepRow({
  n, icon: Icon, title, desc, accent,
}: {
  n: number;
  icon: typeof MapPin;
  title: string;
  desc: string;
  accent: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="relative shrink-0">
        <div className={`h-9 w-9 rounded-xl ${accent} flex items-center justify-center`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-gray-900 text-white text-[10px] font-bold flex items-center justify-center">
          {n}
        </span>
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
