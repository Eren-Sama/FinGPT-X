"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  createChart, ColorType, CandlestickSeries, LineSeries, HistogramSeries,
} from "lightweight-charts";
import {
  Search, Star, BarChart3, TrendingUp, TrendingDown,
  ChevronRight, Activity,
} from "lucide-react";
import { toast } from "sonner";
import { SiteChrome } from "@/components/site-chrome";
import { ErrorBoundary } from "@/components/error-boundary";
import { Sparkline } from "@/components/sparkline";
import { useMarketCategories, useMarketQuote, useMarketHistory, useAddWatchlistItem } from "@/lib/queries";
import { getMarketHistory, getMarketQuote } from "@/lib/api";
import type { MarketHistoryPoint, MarketQuote } from "@/lib/types";

// ─── Periods ──────────────────────────────────────────────────────────────────
const PERIODS = ["1d", "5d", "1mo", "3mo", "6mo", "1y"] as const;
type Period = (typeof PERIODS)[number];

// ─── Indicator Types ──────────────────────────────────────────────────────────
type Indicator = "none" | "ma" | "bollinger" | "rsi" | "macd";

const INDICATOR_LABELS: Record<Indicator, string> = {
  none: "None",
  ma: "Moving Avg",
  bollinger: "Bollinger",
  rsi: "RSI",
  macd: "MACD",
};

// ─── Math helpers ─────────────────────────────────────────────────────────────

function calcSMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const slice = closes.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

function calcEMA(closes: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  closes.forEach((c, i) => {
    if (i === 0) { ema.push(c); return; }
    ema.push(c * k + ema[i - 1] * (1 - k));
  });
  return ema;
}

function calcBollinger(closes: number[], period = 20, stdMult = 2) {
  const mid = calcSMA(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  closes.forEach((_, i) => {
    if (i < period - 1) { upper.push(null); lower.push(null); return; }
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = mid[i]!;
    const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
    upper.push(mean + stdMult * std);
    lower.push(mean - stdMult * std);
  });
  return { mid, upper, lower };
}

function calcRSI(closes: number[], period = 14): (number | null)[] {
  const rsi: (number | null)[] = new Array(period).fill(null);
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;
  rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return rsi;
}

function calcMACD(closes: number[], fast = 12, slow = 26, signal = 9) {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);
  const macdLine = emaFast.map((f, i) => f - emaSlow[i]);
  const signalLine = calcEMA(macdLine, signal);
  const histogram = macdLine.map((m, i) => m - signalLine[i]);
  return { macdLine, signalLine, histogram };
}

// ─── Chart Component ──────────────────────────────────────────────────────────

function CandleChart({
  symbol,
  period,
  indicator,
}: {
  symbol: string;
  period: Period;
  indicator: Indicator;
}) {
  const mainRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const { data: history = [], isLoading } = useMarketHistory(symbol, period);

  useEffect(() => {
    if (!mainRef.current || history.length < 2) return;

    const closes = history.map((b) => b.close);
    const times = history.map((b) => Math.floor(b.time) as unknown as string);

    // ── Shared chart options ──────────────────────────────────────────────────
    const sharedOpts = {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#71717a",
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.025)" },
        horzLines: { color: "rgba(255,255,255,0.025)" },
      },
      crosshair: {
        vertLine: { color: "rgba(255,255,255,0.15)", labelBackgroundColor: "#27272a" },
        horzLine: { color: "rgba(255,255,255,0.15)", labelBackgroundColor: "#27272a" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.06)", scaleMargins: { top: 0.08, bottom: 0.08 } },
      timeScale: { borderColor: "rgba(255,255,255,0.06)", timeVisible: true },
    };

    // ── Main chart (candlesticks + overlay indicators) ────────────────────────
    const mainChart = createChart(mainRef.current, {
      ...sharedOpts,
      width: mainRef.current.clientWidth,
      height: indicator === "rsi" || indicator === "macd" ? 360 : 480,
    });

    const candleSeries = mainChart.addSeries(CandlestickSeries, {
      upColor: "#34d399",
      downColor: "#f87171",
      borderUpColor: "#34d399",
      borderDownColor: "#f87171",
      wickUpColor: "rgba(52,211,153,0.45)",
      wickDownColor: "rgba(248,113,113,0.45)",
    });

    const candleData = history.map((bar) => ({
      time: Math.floor(bar.time) as unknown as string,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));
    candleSeries.setData(candleData as Parameters<typeof candleSeries.setData>[0]);

    // ── MA overlay ────────────────────────────────────────────────────────────
    if (indicator === "ma") {
      const sma20 = calcSMA(closes, 20);
      const sma50 = calcSMA(closes, 50);
      const ema12 = calcEMA(closes, 12);

      const buildLine = (color: string, lineWidth: 1 | 2 | 3) =>
        mainChart.addSeries(LineSeries, { color, lineWidth, priceLineVisible: false, lastValueVisible: false });

      const ema12Series = buildLine("#60a5fa", 1);
      const sma20Series = buildLine("#f59e0b", 2);
      const sma50Series = buildLine("#a78bfa", 2);

      const toLineData = (vals: (number | null)[]) =>
        vals
          .map((v, i) => (v != null ? { time: times[i], value: v } : null))
          .filter(Boolean) as { time: string; value: number }[];

      ema12Series.setData(toLineData(ema12));
      sma20Series.setData(toLineData(sma20));
      sma50Series.setData(toLineData(sma50));
    }

    // ── Bollinger Bands overlay ───────────────────────────────────────────────
    if (indicator === "bollinger") {
      const { mid, upper, lower } = calcBollinger(closes);

      const toLD = (vals: (number | null)[]) =>
        vals.map((v, i) => (v != null ? { time: times[i], value: v } : null))
          .filter(Boolean) as { time: string; value: number }[];

      const midSeries = mainChart.addSeries(LineSeries, {
        color: "#60a5fa", lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
      });
      const upperSeries = mainChart.addSeries(LineSeries, {
        color: "rgba(96,165,250,0.4)", lineWidth: 1, lineStyle: 2,
        priceLineVisible: false, lastValueVisible: false,
      });
      const lowerSeries = mainChart.addSeries(LineSeries, {
        color: "rgba(96,165,250,0.4)", lineWidth: 1, lineStyle: 2,
        priceLineVisible: false, lastValueVisible: false,
      });

      midSeries.setData(toLD(mid));
      upperSeries.setData(toLD(upper));
      lowerSeries.setData(toLD(lower));
    }

    mainChart.timeScale().fitContent();

    // ── Sub chart (RSI or MACD) ───────────────────────────────────────────────
    let subChart: ReturnType<typeof createChart> | null = null;

    if ((indicator === "rsi" || indicator === "macd") && subRef.current) {
      subChart = createChart(subRef.current, {
        ...sharedOpts,
        width: subRef.current.clientWidth,
        height: 160,
        rightPriceScale: { borderColor: "rgba(255,255,255,0.06)", scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { visible: false, borderColor: "transparent" },
      });

      // Sync crosshair
      mainChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range) subChart!.timeScale().setVisibleLogicalRange(range);
      });
      subChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range) mainChart.timeScale().setVisibleLogicalRange(range);
      });

      if (indicator === "rsi") {
        const rsiVals = calcRSI(closes);
        const rsiSeries = subChart.addSeries(LineSeries, {
          color: "#c084fc", lineWidth: 2, priceLineVisible: false, lastValueVisible: true,
        });
        rsiSeries.setData(
          rsiVals
            .map((v, i) => (v != null ? { time: times[i], value: v } : null))
            .filter(Boolean) as { time: string; value: number }[]
        );

        // Overbought / Oversold reference lines
        [70, 30].forEach((level) => {
          const refSeries = subChart!.addSeries(LineSeries, {
            color: level === 70 ? "rgba(248,113,113,0.4)" : "rgba(52,211,153,0.4)",
            lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false,
          });
          refSeries.setData(times.map((t) => ({ time: t, value: level })) as { time: string; value: number }[]);
        });
      }

      if (indicator === "macd") {
        const { macdLine, signalLine, histogram } = calcMACD(closes);

        const histSeries = subChart.addSeries(HistogramSeries, {
          color: "#34d399",
          priceLineVisible: false, lastValueVisible: false,
        });
        histSeries.setData(
          histogram.map((v, i) => ({
            time: times[i],
            value: v,
            color: v >= 0 ? "rgba(52,211,153,0.7)" : "rgba(248,113,113,0.7)",
          })) as Parameters<typeof histSeries.setData>[0]
        );

        const macdSeries = subChart.addSeries(LineSeries, {
          color: "#60a5fa", lineWidth: 2, priceLineVisible: false, lastValueVisible: false,
        });
        macdSeries.setData(
          macdLine.map((v, i) => ({ time: times[i], value: v })) as { time: string; value: number }[]
        );

        const signalSeries = subChart.addSeries(LineSeries, {
          color: "#f59e0b", lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false,
        });
        signalSeries.setData(
          signalLine.map((v, i) => ({ time: times[i], value: v })) as { time: string; value: number }[]
        );
      }

      subChart.timeScale().fitContent();
    }

    // ── Resize Observer ───────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      if (mainRef.current) mainChart.applyOptions({ width: mainRef.current.clientWidth });
      if (subRef.current && subChart) subChart.applyOptions({ width: subRef.current.clientWidth });
    });
    if (mainRef.current) ro.observe(mainRef.current);

    return () => {
      ro.disconnect();
      mainChart.remove();
      subChart?.remove();
    };
  }, [history, indicator]);

  if (isLoading) return <div className="skeleton h-[500px] w-full rounded-[12px]" />;
  if (history.length < 2)
    return (
      <div className="flex h-[480px] items-center justify-center rounded-[12px] border border-dashed border-zinc-800 bg-zinc-900/20">
        <p className="text-[14px] text-zinc-500">Insufficient historical data for {symbol} over {period}</p>
      </div>
    );

  return (
    <div className="w-full">
      <div ref={mainRef} className="w-full" />
      {(indicator === "rsi" || indicator === "macd") && (
        <>
          {/* Divider with label */}
          <div className="flex items-center gap-3 my-2">
            <div className="h-px flex-1 bg-zinc-800/60" />
            <span className="text-[10px] font-500 text-zinc-500 uppercase tracking-widest">
              {indicator === "rsi" ? "RSI (14)" : "MACD (12,26,9)"}
            </span>
            <div className="h-px flex-1 bg-zinc-800/60" />
          </div>
          <div ref={subRef} className="w-full" />
        </>
      )}
    </div>
  );
}

// ─── Indicator Legend ─────────────────────────────────────────────────────────

function IndicatorLegend({ indicator }: { indicator: Indicator }) {
  if (indicator === "none") return null;

  const items: { color: string; label: string; dash?: boolean }[] =
    indicator === "ma"
      ? [
          { color: "#60a5fa", label: "EMA 12" },
          { color: "#f59e0b", label: "SMA 20" },
          { color: "#a78bfa", label: "SMA 50" },
        ]
      : indicator === "bollinger"
      ? [
          { color: "#60a5fa", label: "Mid (20)" },
          { color: "rgba(96,165,250,0.6)", label: "Upper 2σ", dash: true },
          { color: "rgba(96,165,250,0.6)", label: "Lower 2σ", dash: true },
        ]
      : indicator === "rsi"
      ? [
          { color: "#c084fc", label: "RSI (14)" },
          { color: "rgba(248,113,113,0.6)", label: "Overbought 70", dash: true },
          { color: "rgba(52,211,153,0.6)", label: "Oversold 30", dash: true },
        ]
      : [
          { color: "#60a5fa", label: "MACD" },
          { color: "#f59e0b", label: "Signal", dash: true },
          { color: "#34d399", label: "Histogram" },
        ];

  return (
    <div className="flex flex-wrap items-center gap-4 px-1 pb-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div
            className={`h-0.5 w-4 rounded ${item.dash ? "opacity-60" : ""}`}
            style={{
              background: item.color,
              backgroundImage: item.dash
                ? `repeating-linear-gradient(90deg, ${item.color} 0, ${item.color} 4px, transparent 4px, transparent 7px)`
                : undefined,
            }}
          />
          <span className="text-[11px] text-zinc-500">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

import { MarketMarquee } from "./market-marquee";
import { MarketHeatmap } from "./market-heatmap";

export default function DashboardPage() {
  const { data: categories = {}, isLoading: catLoading } = useMarketCategories();
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("3mo");
  const [indicator, setIndicator] = useState<Indicator>("none");
  const [rowQuotes, setRowQuotes] = useState<Record<string, MarketQuote>>({});
  const [rowHistories, setRowHistories] = useState<Record<string, MarketHistoryPoint[]>>({});

  const { data: activeQuote } = useMarketQuote(activeSymbol);
  const addWatchlist = useAddWatchlistItem();

  // Flatten symbols for initial active state and bulk fetching
  const allSymbols = Object.values(categories).flat();

  useEffect(() => {
    if (allSymbols.length && !activeSymbol) setActiveSymbol(allSymbols[0].symbol);
  }, [allSymbols, activeSymbol]);

  useEffect(() => {
    allSymbols.slice(0, 15).forEach(({ symbol }) => {
      if (!rowQuotes[symbol]) {
        getMarketQuote(symbol).then((q) => setRowQuotes((p) => ({ ...p, [symbol]: q }))).catch(() => {});
      }
      if (!rowHistories[symbol]) {
        getMarketHistory(symbol, "1mo").then((h) => setRowHistories((p) => ({ ...p, [symbol]: h }))).catch(() => {});
      }
    });
  }, [categories]); // eslint-disable-line

  const handleAddWatchlist = () => {
    if (!activeSymbol) return;
    addWatchlist.mutate(activeSymbol, {
      onSuccess: () => toast.success(`${activeSymbol} added to watchlist`),
      onError: (err: any) => toast.error(err.message || "Failed to add to watchlist"),
    });
  };

  return (
    <SiteChrome>
      {/* Dynamic Marquee at the very top */}
      {Object.keys(rowQuotes).length > 0 && <MarketMarquee quotes={rowQuotes} />}

      <div className="space-y-10 p-6 md:p-10 max-w-[1600px] mx-auto">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-600 tracking-tight text-white mb-2">Markets</h1>
          <p className="text-[15px] text-zinc-400">
            Live technical analysis with RSI, MACD, Bollinger Bands & Moving Averages.
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[260px_1fr] items-start">
          {/* ── Left Sidebar ── */}
          <div className="flex flex-col gap-4 min-w-[260px]">
            {catLoading && (
              <div className="space-y-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 w-20 bg-zinc-900 rounded animate-pulse mb-3" />
                    <div className="h-14 rounded-[8px] bg-zinc-900 animate-pulse" />
                    <div className="h-14 rounded-[8px] bg-zinc-900 animate-pulse" />
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-6 max-h-[640px] overflow-y-auto pr-2 custom-scrollbar">
              {Object.entries(categories).map(([categoryName, symList]) => (
                <div key={categoryName} className="flex flex-col gap-2">
                  <div className="text-[11px] font-600 text-zinc-500 uppercase tracking-widest px-1 border-b border-zinc-800/60 pb-1.5 mb-1">
                    {categoryName}
                  </div>
                  {symList.map((item) => {
                    const q = rowQuotes[item.symbol];
                    const h = rowHistories[item.symbol];
                    const active = activeSymbol === item.symbol;
                    const pos = q ? q.change_percent >= 0 : true;
                    return (
                      <button
                        key={item.symbol}
                        onClick={() => setActiveSymbol(item.symbol)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-[8px] transition-all text-left border ${
                          active
                            ? "bg-zinc-900 border-zinc-800 shadow-sm"
                            : "border-transparent hover:bg-zinc-900/50"
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className={`text-[13px] font-600 flex items-center justify-between ${active ? "text-zinc-50" : "text-zinc-300"}`}>
                            <span>{item.symbol}</span>
                          </div>
                          {q ? (
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] font-mono text-zinc-500">
                                {item.currency === "USD" ? "$" : item.currency === "INR" ? "₹" : ""}
                                {q.price.toFixed(2)}
                              </span>
                              <span
                                className={`text-[10px] font-mono font-500 ${
                                  pos ? "text-emerald-400" : "text-red-400"
                                }`}
                              >
                                {pos ? "+" : ""}{q.change_percent.toFixed(2)}%
                              </span>
                            </div>
                          ) : (
                            <div className="text-[11px] text-zinc-600 mt-0.5 truncate">{item.name}</div>
                          )}
                        </div>
                        {/* Mini sparkline */}
                        {h && h.length > 3 && (
                          <div className="w-14 h-7 flex-shrink-0">
                            <Sparkline
                              data={h.slice(-20).map((p) => p.close)}
                              width={56}
                              height={28}
                              positive={pos}
                            />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* ── Chart Panel ── */}
          <div className="min-w-0">
            {activeSymbol ? (
              <motion.div
                key={activeSymbol}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Header */}
                <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-6">
                  <div>
                    <h2 className="text-4xl font-600 tracking-tight text-white mb-1">
                      {activeSymbol}
                    </h2>
                    {activeQuote ? (
                      <div className="flex items-baseline gap-4">
                        <span className="font-mono text-2xl text-zinc-100">
                          ${activeQuote.price.toFixed(2)}
                        </span>
                        <div
                          className={`flex items-center gap-1.5 text-[14px] font-500 font-mono ${
                            activeQuote.change_percent >= 0 ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {activeQuote.change_percent >= 0 ? (
                            <TrendingUp size={15} />
                          ) : (
                            <TrendingDown size={15} />
                          )}
                          {Math.abs(activeQuote.change).toFixed(2)} (
                          {Math.abs(activeQuote.change_percent).toFixed(2)}%)
                        </div>
                      </div>
                    ) : (
                      <div className="skeleton h-8 w-48 mt-1" />
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Period selector */}
                    <div className="flex rounded-[8px] bg-zinc-900 p-1 border border-zinc-800">
                      {PERIODS.map((p) => (
                        <button
                          key={p}
                          onClick={() => setPeriod(p)}
                          className={`px-3 py-1.5 rounded-[6px] text-[12px] font-500 transition-colors ${
                            period === p
                              ? "bg-zinc-800 text-white shadow-sm"
                              : "text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>

                    {/* Indicator selector */}
                    <div className="flex flex-wrap rounded-[8px] bg-zinc-900 p-1 border border-zinc-800 gap-0.5">
                      {(Object.keys(INDICATOR_LABELS) as Indicator[]).map((ind) => (
                        <button
                          key={ind}
                          onClick={() => setIndicator(ind)}
                          className={`px-3 py-1.5 rounded-[6px] text-[12px] font-500 transition-colors flex items-center gap-1.5 ${
                            indicator === ind
                              ? "bg-zinc-800 text-white shadow-sm"
                              : "text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          {ind !== "none" && <Activity size={11} />}
                          {INDICATOR_LABELS[ind]}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={handleAddWatchlist}
                      className="btn-ghost border-zinc-800 hover:border-zinc-700 text-[13px]"
                      title="Add to watchlist"
                    >
                      <Star size={13} />
                      Watch
                    </button>
                  </div>
                </div>

                {/* Chart */}
                <div className="surface p-6 bg-zinc-950">
                  <IndicatorLegend indicator={indicator} />
                  <ErrorBoundary label="CandleChart">
                    <CandleChart symbol={activeSymbol} period={period} indicator={indicator} />
                  </ErrorBoundary>
                </div>

                {/* Quote grid */}
                {activeQuote && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: "Day High", value: `$${activeQuote.high.toFixed(2)}` },
                      { label: "Day Low", value: `$${activeQuote.low.toFixed(2)}` },
                      { label: "Prev Close", value: `$${activeQuote.previous_close.toFixed(2)}` },
                      {
                        label: "Volume",
                        value:
                          activeQuote.volume > 1e6
                            ? `${(activeQuote.volume / 1e6).toFixed(2)}M`
                            : activeQuote.volume.toLocaleString(),
                      },
                    ].map(({ label, value }) => (
                      <div key={label} className="surface p-5 bg-zinc-900/20">
                        <div className="text-[12px] font-500 text-zinc-500 mb-2">{label}</div>
                        <div className="text-[15px] font-mono font-500 text-zinc-100">{value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="flex h-[400px] flex-col items-center justify-center border border-dashed border-zinc-800 rounded-[16px] bg-zinc-900/10">
                <BarChart3 size={40} className="text-zinc-700 mb-4" />
                <p className="text-[15px] font-500 text-zinc-400">Select a market to view analysis</p>
              </div>
            )}
          </div>
        </div>

        {/* Full-width Heatmap */}
        {Object.keys(rowQuotes).length > 0 && <MarketHeatmap quotes={rowQuotes} />}
      </div>
    </SiteChrome>
  );
}
