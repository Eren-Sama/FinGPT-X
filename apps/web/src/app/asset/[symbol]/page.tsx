"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createChart, ColorType, CandlestickSeries } from "lightweight-charts";
import { ArrowLeft, Star, MessageSquareQuote } from "lucide-react";
import { toast } from "sonner";
import { SiteChrome } from "@/components/site-chrome";
import { Sparkline } from "@/components/sparkline";
import { useMarketQuote, useMarketHistory, useAddWatchlistItem } from "@/lib/queries";

const PERIODS = ["1mo", "3mo", "6mo", "1y", "all"] as const;
type Period = (typeof PERIODS)[number];

export default function AssetPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = use(params);
  const sym = symbol.toUpperCase();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("3mo");
  const { data: quote } = useMarketQuote(sym);
  const { data: history = [] } = useMarketHistory(sym, period);
  const addWatchlist = useAddWatchlistItem();
  const chartRef = useRef<HTMLDivElement>(null);

  const pos = quote ? quote.change_percent >= 0 : true;

  useEffect(() => {
    if (!chartRef.current || history.length < 2) return;
    const chart = createChart(chartRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#888888", fontSize: 11, fontFamily: "'Space Mono', monospace" },
      grid: { vertLines: { color: "rgba(255,255,255,0.03)" }, horzLines: { color: "rgba(255,255,255,0.03)" } },
      crosshair: { vertLine: { color: "rgba(255,255,255,0.1)" }, horzLine: { color: "rgba(255,255,255,0.1)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.05)" },
      timeScale: { borderColor: "rgba(255,255,255,0.05)", timeVisible: true },
      width: chartRef.current.clientWidth,
      height: 360,
    });
    const series = chart.addSeries(CandlestickSeries, { upColor: "#10B981", downColor: "#EF4444", borderUpColor: "#10B981", borderDownColor: "#EF4444", wickUpColor: "rgba(16,185,129,0.5)", wickDownColor: "rgba(239,68,68,0.5)" });
    series.setData(history.map((b) => ({ time: Math.floor(b.time) as unknown as string, open: b.open, high: b.high, low: b.low, close: b.close })) as Parameters<typeof series.setData>[0]);
    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => { if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth }); });
    ro.observe(chartRef.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, [history]);

  return (
    <SiteChrome>
      <div className="p-8 max-w-[1000px] mx-auto space-y-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-[13px] text-[#888888] transition-colors hover:text-[#EDEDED]">
          <ArrowLeft size={14} />
          Back to Markets
        </button>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between flex-wrap gap-6 border-b border-[#222222] pb-6">
            <div>
              <h1 className="text-[32px] font-500 tracking-tight text-white mb-1">{sym}</h1>
              {quote ? (
                <div className="flex items-baseline gap-3 mt-2">
                  <div className="font-mono text-[32px] tracking-tight text-white">${quote.price.toFixed(2)}</div>
                  <div className={`text-[15px] font-500 font-mono ${pos ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                    {pos ? "+" : ""}{quote.change.toFixed(2)} ({pos ? "+" : ""}{quote.change_percent.toFixed(2)}%)
                  </div>
                </div>
              ) : (
                <div className="skeleton h-10 w-48 mt-3" />
              )}
            </div>
            <div className="flex gap-3">
              <Link href={`/research?q=Give+me+a+fundamental+analysis+of+${sym}`} className="btn-ghost">
                <MessageSquareQuote size={14} />
                Research AI
              </Link>
              <button onClick={() => addWatchlist.mutate(sym, { onSuccess: () => toast.success("Added to watchlist") })} className="btn-primary">
                <Star size={14} />
                Watchlist
              </button>
            </div>
          </div>

          {/* Quote grid */}
          {quote && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Day High", value: `$${quote.high.toFixed(2)}` },
                { label: "Day Low", value: `$${quote.low.toFixed(2)}` },
                { label: "Prev Close", value: `$${quote.previous_close.toFixed(2)}` },
                { label: "Volume", value: quote.volume > 1e6 ? `${(quote.volume / 1e6).toFixed(2)}M` : quote.volume.toLocaleString() },
              ].map(({ label, value }) => (
                <div key={label} className="card p-4">
                  <div className="text-[12px] text-[#888888] mb-1">{label}</div>
                  <div className="text-[15px] font-mono text-[#EDEDED]">{value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Chart */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[14px] font-500 text-white">Price Action</span>
              <div className="flex rounded-[6px] bg-[#111111] border border-[#222222] p-0.5">
                {PERIODS.map((p) => (
                  <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 rounded-[4px] text-[12px] font-500 transition-colors ${period === p ? "bg-[#333333] text-white shadow-sm" : "text-[#888888] hover:text-[#EDEDED]"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div ref={chartRef} className="w-full" />
            {history.length < 2 && <div className="skeleton h-[360px]" />}
          </div>

          {/* Sparkline (Micro trend) */}
          {history.length > 2 && (
            <div className="card p-5">
              <div className="text-[12px] font-500 text-[#888888] mb-4">Micro Trend ({period})</div>
              <Sparkline data={history.map((h) => h.close)} width={900} height={40} positive={pos} className="w-full opacity-60" />
            </div>
          )}
        </motion.div>
      </div>
    </SiteChrome>
  );
}
