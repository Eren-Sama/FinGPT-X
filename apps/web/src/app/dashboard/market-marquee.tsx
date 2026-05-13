"use client";

import { useMemo } from "react";
import type { MarketQuote } from "@/lib/types";

interface MarketMarqueeProps {
  quotes: Record<string, MarketQuote>;
}

export function MarketMarquee({ quotes }: MarketMarqueeProps) {
  const items = useMemo(() => {
    return Object.entries(quotes).map(([symbol, q]) => ({
      symbol,
      price: q.price,
      change: q.change,
      changePercent: q.change_percent,
    }));
  }, [quotes]);

  if (items.length === 0) return null;

  return (
    <div className="w-full overflow-hidden bg-zinc-950 border-b border-zinc-800/50 py-2.5 flex items-center">
      <div className="relative w-full flex overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap min-w-full shrink-0">
          {items.map((item) => {
            const pos = item.changePercent >= 0;
            return (
              <div key={item.symbol} className="flex items-center gap-3 px-6">
                <span className="text-[13px] font-700 text-zinc-100">{item.symbol}</span>
                <span className="text-[13px] font-mono text-zinc-300">
                  {item.price.toFixed(2)}
                </span>
                <span
                  className={`text-[12px] font-mono font-600 ${
                    pos ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {pos ? "+" : ""}{item.changePercent.toFixed(2)}%
                </span>
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-800 ml-3" />
              </div>
            );
          })}
        </div>
        {/* Duplicate for seamless loop */}
        <div className="flex animate-marquee whitespace-nowrap min-w-full shrink-0" aria-hidden="true">
          {items.map((item) => {
            const pos = item.changePercent >= 0;
            return (
              <div key={item.symbol + "-dup"} className="flex items-center gap-3 px-6">
                <span className="text-[13px] font-700 text-zinc-100">{item.symbol}</span>
                <span className="text-[13px] font-mono text-zinc-300">
                  {item.price.toFixed(2)}
                </span>
                <span
                  className={`text-[12px] font-mono font-600 ${
                    pos ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {pos ? "+" : ""}{item.changePercent.toFixed(2)}%
                </span>
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-800 ml-3" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
