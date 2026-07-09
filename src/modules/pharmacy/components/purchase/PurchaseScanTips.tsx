"use client";

// PurchaseScanTips — P4 feature
// Reusable tips banner shown in the PurchaseScannerDialog upload state.
// 3 tips for best results + a dismissible "See example" expandable section.

import { useState } from "react";
import { Sparkles, Camera, Lightbulb, FileStack, ChevronDown, Image as ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PurchaseScanTipsProps {
  /** Compact mode (smaller padding, for tight spaces) */
  compact?: boolean;
}

export function PurchaseScanTips({ compact = false }: PurchaseScanTipsProps) {
  const [showExample, setShowExample] = useState(false);

  const tips = [
    {
      icon: Camera,
      title: "Frame the entire invoice",
      desc: "All 4 corners visible — don't crop out line items",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      icon: Lightbulb,
      title: "Ensure good lighting",
      desc: "Avoid shadows on text — natural light or overhead lamp works best",
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      icon: FileStack,
      title: "Long invoice? Scan each page",
      desc: "Items accumulate automatically — no need to fit everything in one photo",
      color: "text-teal-600",
      bg: "bg-teal-50",
    },
  ];

  return (
    <Card className="border-emerald-100 bg-emerald-50/40 shadow-none">
      <CardContent className={cn("space-y-2", compact ? "p-2.5" : "p-3")}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> Tips for best results
        </p>
        <ul className="space-y-1.5">
          {tips.map((tip) => {
            const Icon = tip.icon;
            return (
              <li key={tip.title} className="flex items-start gap-2">
                <div className={cn("h-6 w-6 rounded-lg flex items-center justify-center shrink-0", tip.bg)}>
                  <Icon className={cn("h-3 w-3", tip.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-gray-900 leading-tight">{tip.title}</p>
                  <p className="text-[10px] text-gray-500 leading-tight mt-0.5">{tip.desc}</p>
                </div>
              </li>
            );
          })}
        </ul>

        {/* See example expandable */}
        <button
          type="button"
          className="flex items-center gap-1 text-[10px] text-emerald-700 font-medium hover:text-emerald-800 mt-1"
          onClick={() => setShowExample(!showExample)}
        >
          <ChevronDown className={cn("h-3 w-3 transition-transform", showExample && "rotate-180")} />
          {showExample ? "Hide example" : "See example"}
        </button>
        {showExample && (
          <div className="mt-2 rounded-lg border border-emerald-200 bg-white p-2.5">
            <div className="flex items-start gap-2">
              <ImageIcon className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <div className="text-[10px] text-gray-600 leading-relaxed space-y-1">
                <p className="font-semibold text-gray-900">Good invoice photo:</p>
                <p>• All 4 corners of the invoice are visible</p>
                <p>• Text is sharp and readable — no blur</p>
                <p>• No shadows or glare on the text</p>
                <p>• The line items table fills most of the frame</p>
                <p>• If the invoice has 2 pages, photograph each page separately</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
