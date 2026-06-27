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

export function ExpiryTimelineChart({ data }: ExpiryTimelineChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const maxQuantity = Math.max(...data.map((d) => d.quantity), 1);

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
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  <div className="font-medium">{week.weekLabel}</div>
                  <div>{week.count} batch{week.count !== 1 ? "es" : ""}</div>
                  <div>{week.quantity} units</div>
                  <div>৳{week.value.toFixed(0)}</div>
                </div>
              )}

              {/* Bar */}
              <div className="w-full flex flex-col justify-end h-full relative">
                <div
                  className={cn(
                    "w-full rounded-t-sm transition-all",
                    hasData ? "bg-gradient-to-t from-orange-500 to-red-500" : "bg-muted/30"
                  )}
                  style={{ height: `${Math.max(heightPct, hasData ? 4 : 2)}%` }}
                />
                {/* Quantity indicator (small dot) */}
                {hasData && (
                  <div
                    className="absolute -right-0.5 w-1 h-1 rounded-full bg-blue-500"
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

      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-orange-500" /> Value at risk
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Units
          </span>
        </div>
        <span>Next 13 weeks</span>
      </div>
    </div>
  );
}
