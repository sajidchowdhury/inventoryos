"use client";

import { cn } from "@/lib/utils";

interface TrendData {
  date: string;
  label: string;
  sales: number;
  count: number;
  refunds: number;
  net: number;
}

interface SalesTrendChartProps {
  data: TrendData[];
}

export function SalesTrendChart({ data }: SalesTrendChartProps) {
  const maxSale = Math.max(...data.map((d) => d.sales), 1);

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-0.5 h-40 px-1">
        {data.map((day, idx) => {
          const heightPct = (day.sales / maxSale) * 100;
          const hasData = day.sales > 0;
          const refundPct = day.sales > 0 ? (day.refunds / day.sales) * 100 : 0;

          return (
            <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative min-w-0">
              {/* Tooltip */}
              {hasData && (
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] px-2 py-1.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  <div className="font-medium">{day.date}</div>
                  <div className="text-green-400">Sales: ৳{day.sales.toFixed(0)}</div>
                  <div className="text-muted-foreground">{day.count} orders</div>
                  {day.refunds > 0 && <div className="text-red-400">Refunds: ৳{day.refunds.toFixed(0)}</div>}
                  <div className="border-t border-muted-foreground/30 mt-1 pt-1">
                    Net: ৳{day.net.toFixed(0)}
                  </div>
                </div>
              )}

              {/* Bar */}
              <div className="w-full flex flex-col justify-end h-full relative">
                {/* Refund overlay (red, on top) */}
                {hasData && day.refunds > 0 && (
                  <div
                    className="w-full bg-red-500/60 rounded-t-sm"
                    style={{ height: `${(day.refunds / maxSale) * 100}%` }}
                  />
                )}
                {/* Sales bar (green) */}
                <div
                  className={cn(
                    "w-full rounded-t-sm transition-all",
                    hasData ? "bg-gradient-to-t from-green-500 to-emerald-400" : "bg-muted/20"
                  )}
                  style={{ height: `${Math.max(heightPct, hasData ? 3 : 2)}%` }}
                />
              </div>

              {/* Label (only show some to avoid crowding) */}
              {data.length <= 14 || idx % Math.ceil(data.length / 14) === 0 ? (
                <span className="text-[8px] text-muted-foreground mt-1 whitespace-nowrap">
                  {day.label}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-green-500" /> Sales
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-red-500/60" /> Refunds
          </span>
        </div>
        <span>Peak: ৳{maxSale.toFixed(0)}</span>
      </div>
    </div>
  );
}
