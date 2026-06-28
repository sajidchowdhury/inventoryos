"use client";

import { cn } from "@/lib/utils";

interface TimelineData {
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  count: number;
  quantity: number;
  value: number;
}

interface ExpiryTimelineChartProps {
  data: TimelineData[];
}

/**
 * Compact 13-week expiry timeline chart.
 * Bars are colored by urgency bucket:
 *   - Weeks 1–4 (soonest): rose gradient (urgent)
 *   - Weeks 5–8: amber gradient (warning)
 *   - Weeks 9–13: emerald gradient (safe)
 * Bars animate height smoothly and show a hover tooltip with week date + counts.
 */
export function ExpiryTimelineChart({ data }: ExpiryTimelineChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const maxQuantity = Math.max(...data.map((d) => d.quantity), 1);

  // Choose gradient based on how soon the week is.
  const getBarGradient = (idx: number) => {
    if (idx < 4) return "bg-gradient-to-t from-rose-500 to-rose-400";
    if (idx < 8) return "bg-gradient-to-t from-amber-500 to-amber-400";
    return "bg-gradient-to-t from-emerald-600 to-emerald-400";
  };

  const getDotColor = (idx: number) => {
    if (idx < 4) return "bg-rose-400";
    if (idx < 8) return "bg-amber-400";
    return "bg-emerald-400";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-1 h-32 px-1">
        {data.map((week, idx) => {
          const heightPct = (week.value / maxValue) * 100;
          const qtyPct = (week.quantity / maxQuantity) * 100;
          const hasData = week.count > 0;

          return (
            <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative">
              {/* Tooltip */}
              {hasData && (
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] px-2.5 py-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
                  <div className="font-semibold">{week.weekLabel}</div>
                  <div className="text-[9px] opacity-80">
                    {new Date(week.weekStart).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    {" – "}
                    {new Date(week.weekEnd).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                  </div>
                  <div className="mt-0.5">{week.count} batch{week.count !== 1 ? "es" : ""}</div>
                  <div>{week.quantity} units</div>
                  <div className="font-semibold">৳{week.value.toFixed(0)}</div>
                  {/* Arrow */}
                  <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 bg-foreground rotate-45" />
                </div>
              )}

              {/* Bar */}
              <div className="w-full flex flex-col justify-end h-full relative">
                <div
                  className={cn(
                    "w-full rounded-t-md transition-all duration-500 ease-out group-hover:brightness-110",
                    hasData ? getBarGradient(idx) : "bg-muted/30"
                  )}
                  style={{ height: `${Math.max(heightPct, hasData ? 6 : 3)}%` }}
                />
                {/* Quantity indicator (small dot overlay) */}
                {hasData && (
                  <div
                    className={cn(
                      "absolute -right-0.5 w-1.5 h-1.5 rounded-full ring-1 ring-background transition-all",
                      getDotColor(idx)
                    )}
                    style={{ bottom: `${qtyPct}%` }}
                  />
                )}
              </div>

              {/* Week label */}
              <span className="text-[8px] text-muted-foreground mt-1 whitespace-nowrap">
                {idx === 0 ? "Now" : idx === data.length - 1 ? "13wk" : `${idx + 1}`}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-rose-500 to-rose-400" /> 1–4 wk
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-amber-500 to-amber-400" /> 5–8 wk
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-emerald-600 to-emerald-400" /> 9–13 wk
          </span>
        </div>
        <span className="hidden sm:inline">Next 13 weeks</span>
      </div>
    </div>
  );
}
