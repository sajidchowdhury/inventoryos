"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Sparkles, RefreshCw, TrendingUp, AlertTriangle,
  Check, Info, Lightbulb, Loader2, Brain, Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

interface Insight {
  type: "success" | "warning" | "danger" | "info" | "tip";
  category: string;
  title: string;
  description: string;
  action: string;
}

interface Recommendation {
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  expectedImpact: string;
}

interface AIInsights {
  summary: string;
  healthScore: number;
  healthLabel: string;
  insights: Insight[];
  recommendations: Recommendation[];
}

const typeConfig = {
  success: { icon: Check, color: "text-green-600", bg: "bg-green-50", border: "border-l-green-500" },
  warning: { icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50", border: "border-l-orange-500" },
  danger: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", border: "border-l-red-500" },
  info: { icon: Info, color: "text-blue-600", bg: "bg-blue-50", border: "border-l-blue-500" },
  tip: { icon: Lightbulb, color: "text-purple-600", bg: "bg-purple-50", border: "border-l-purple-500" },
};

const priorityConfig = {
  high: { color: "text-red-600", bg: "bg-red-50", label: "High Priority" },
  medium: { color: "text-orange-600", bg: "bg-orange-50", label: "Medium" },
  low: { color: "text-blue-600", bg: "bg-blue-50", label: "Low" },
};

export function AIInsights() {
  const session = useAuthStore((s) => s.session);
  const { setActiveView } = useNavStore();
  const businessId = session?.business?.id;

  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInsights = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/ai/insights`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setInsights(data.insights);
      } else {
        throw new Error(data.error || "Failed");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate insights");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const healthColor = insights?.healthScore
    ? insights.healthScore >= 80 ? "text-green-600"
    : insights.healthScore >= 60 ? "text-blue-600"
    : insights.healthScore >= 40 ? "text-orange-600"
    : "text-red-600"
    : "";

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1 flex items-center gap-1.5">
          <Sparkles className="h-5 w-5 text-primary" /> AI Insights
        </h1>
      </div>

      {/* Generate Button / Loading State */}
      {!insights && !loading && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Brain className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">AI-Powered Business Analysis</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Let AI analyze your sales, inventory, expiry, and financial data to generate personalized insights and recommendations.
              </p>
            </div>
            <Button size="lg" className="gap-2" onClick={generateInsights}>
              <Sparkles className="h-4 w-4" /> Generate AI Insights
            </Button>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" />
            <p className="text-sm font-medium">AI is analyzing your business data...</p>
            <p className="text-xs text-muted-foreground">Reviewing sales, inventory, expiry, purchases, and financials</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 text-center text-sm text-destructive">
            {error}
            <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={generateInsights}>
              <RefreshCw className="h-3.5 w-3.5" /> Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {insights && !loading && (
        <>
          {/* Health Score Hero */}
          <Card className={cn("border-l-4", insights.healthScore >= 80 ? "border-l-green-500" : insights.healthScore >= 60 ? "border-l-blue-500" : insights.healthScore >= 40 ? "border-l-orange-500" : "border-l-red-500")}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Business Health Score</p>
                  <div className="flex items-baseline gap-2">
                    <p className={cn("text-4xl font-bold", healthColor)}>{insights.healthScore}</p>
                    <p className="text-sm text-muted-foreground">/ 100</p>
                  </div>
                  <Badge variant="outline" className={cn("mt-1", healthColor)}>
                    {insights.healthLabel}
                  </Badge>
                </div>
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Brain className="h-8 w-8 text-primary" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{insights.summary}</p>
              <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={generateInsights}>
                <RefreshCw className="h-3.5 w-3.5" /> Regenerate Insights
              </Button>
            </CardContent>
          </Card>

          {/* Insights */}
          {insights.insights?.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-2 text-muted-foreground flex items-center gap-1.5">
                <Zap className="h-4 w-4" /> AI Insights ({insights.insights.length})
              </h2>
              <div className="space-y-2">
                {insights.insights.map((insight, idx) => {
                  const cfg = typeConfig[insight.type] || typeConfig.info;
                  const Icon = cfg.icon;
                  return (
                    <Card key={idx} className={cn("border-l-4", cfg.border)}>
                      <CardContent className="p-3 flex items-start gap-3">
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", cfg.bg)}>
                          <Icon className={cn("h-4 w-4", cfg.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{insight.title}</p>
                            <Badge variant="outline" className="text-[9px]">{insight.category}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{insight.description}</p>
                          {insight.action && (
                            <p className={cn("text-[11px] mt-1 font-medium", cfg.color)}>
                              → {insight.action}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {insights.recommendations?.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-2 text-muted-foreground flex items-center gap-1.5">
                <Lightbulb className="h-4 w-4" /> AI Recommendations ({insights.recommendations.length})
              </h2>
              <div className="space-y-2">
                {insights.recommendations.map((rec, idx) => {
                  const cfg = priorityConfig[rec.priority] || priorityConfig.medium;
                  return (
                    <Card key={idx}>
                      <CardContent className="p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{rec.title}</p>
                          <Badge variant="outline" className={cn("text-[9px]", cfg.color)}>{cfg.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{rec.description}</p>
                        {rec.expectedImpact && (
                          <p className="text-[11px] text-green-600 font-medium">
                            Impact: {rec.expectedImpact}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
