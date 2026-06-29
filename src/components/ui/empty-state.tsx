"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: "default" | "emerald" | "purple" | "blue" | "amber" | "rose";
  className?: string;
}

const variantConfig = {
  default: { bg: "bg-gray-50", icon: "text-gray-400", ring: "ring-gray-100" },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-500", ring: "ring-emerald-100" },
  purple: { bg: "bg-purple-50", icon: "text-purple-500", ring: "ring-purple-100" },
  blue: { bg: "bg-blue-50", icon: "text-blue-500", ring: "ring-blue-100" },
  amber: { bg: "bg-amber-50", icon: "text-amber-500", ring: "ring-amber-100" },
  rose: { bg: "bg-rose-50", icon: "text-rose-500", ring: "ring-rose-100" },
};

/**
 * Phase 10: Premium empty state component with animated icon.
 *
 * Usage:
 * <EmptyState icon={Package} title="No products yet" description="Add your first product to get started" actionLabel="Add Product" onAction={() => setActiveView("add-product")} variant="emerald" />
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = "default",
  className,
}: EmptyStateProps) {
  const config = variantConfig[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("flex flex-col items-center justify-center text-center py-12 px-6", className)}
    >
      <div className={cn(
        "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ring-4 animate-empty-bounce",
        config.bg, config.ring
      )}>
        <Icon className={cn("h-8 w-8", config.icon)} />
      </div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-gray-500 max-w-xs mb-4">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button
          size="sm"
          className="gap-1.5 btn-press"
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}
