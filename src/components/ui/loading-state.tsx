"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Phase 10: Premium loading state with branded spinner.
 *
 * Usage:
 * <LoadingState /> — full card loading
 * <LoadingState text="Loading products..." />
 * <LoadingState variant="dots" /> — AI thinking dots
 * <LoadingState variant="skeleton" rows={3} /> — skeleton shimmer rows
 */
interface LoadingStateProps {
  text?: string;
  variant?: "spinner" | "dots" | "skeleton";
  rows?: number;
  className?: string;
}

export function LoadingState({ text, variant = "spinner", rows = 3, className }: LoadingStateProps) {
  if (variant === "skeleton") {
    return (
      <div className={cn("space-y-3", className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-pharmacy">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl skeleton" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/2 rounded skeleton" />
                <div className="h-2 w-1/3 rounded skeleton" />
              </div>
              <div className="h-6 w-16 rounded-full skeleton" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "dots") {
    return (
      <div className={cn("flex flex-col items-center justify-center py-8", className)}>
        <div className="dot-loading text-purple-500 mb-3">
          <span /><span /><span />
        </div>
        {text && <p className="text-xs text-gray-500">{text}</p>}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center justify-center py-12", className)}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="w-10 h-10 rounded-full border-3 border-emerald-100 border-t-emerald-500"
      />
      {text && (
        <p className="text-xs text-gray-500 mt-3">{text}</p>
      )}
    </div>
  );
}
