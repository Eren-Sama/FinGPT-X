"use client";

import { useMemo } from "react";
import type { MarketQuote } from "@/lib/types";

interface MarketHeatmapProps {
  quotes: Record<string, MarketQuote>;
}

export function MarketHeatmap({ quotes }: MarketHeatmapProps) {
  const items = useMemo(() => {
    return Object.entries(quotes)
      .map(([symbol, q]) => ({
        symbol,
        price: q.price,
        changePercent: q.change_percent,
        volume: q.volume,
      }))
      // Sort by absolute change to put the most volatile items first, or alphabetical
      .sort((a, b) => b.changePercent - a.changePercent);
  }, [quotes]);

  if (items.length === 0) return null;

  // Helper to determine background color based on percentage change
  const getBackgroundColor = (change: number) => {
    if (change > 5) return "bg-emerald-500 text-white";
    if (change > 2) return "bg-emerald-500/70 text-white";
    if (change > 0) return "bg-emerald-500/30 text-emerald-100";
    if (change === 0) return "bg-zinc-800 text-zinc-300";
    if (change > -2) return "bg-red-500/30 text-red-100";
    if (change > -5) return "bg-red-500/70 text-white";
    return "bg-red-500 text-white";
  };

  return (
    <div className="surface p-6 bg-zinc-950 mt-6 border border-zinc-800/60">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-600 text-zinc-100">Market Heatmap</h3>
        <span className="text-[12px] text-zinc-500">Live Performance Overview</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {items.map((item) => {
          const bgClass = getBackgroundColor(item.changePercent);
          const pos = item.changePercent >= 0;

          return (
            <div
              key={item.symbol}
              className={`flex flex-col p-3 rounded-[6px] transition-transform hover:scale-[1.02] cursor-default ${bgClass}`}
              title={`${item.symbol}: ${item.price.toFixed(2)} (${pos ? "+" : ""}${item.changePercent.toFixed(2)}%)`}
            >
              <div className="text-[13px] font-700">{item.symbol}</div>
              <div className="mt-1 text-[11px] font-mono opacity-90">
                {pos ? "+" : ""}{item.changePercent.toFixed(2)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
