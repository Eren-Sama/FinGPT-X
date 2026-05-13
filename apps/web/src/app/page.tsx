"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowRight, Terminal, Briefcase, Database, LayoutDashboard, Search, Activity } from "lucide-react";
import { useHealth, useMarketSymbols, useWatchlist } from "@/lib/queries";
import { getMarketHistory, getMarketQuote } from "@/lib/api";
import type { MarketHistoryPoint, MarketQuote } from "@/lib/types";
import { Sparkline } from "@/components/sparkline";
import { SiteChrome } from "@/components/site-chrome";

const stagger: Variants = { animate: { transition: { staggerChildren: 0.06 } } };
const fadeUp: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export default function HomePage() {
  const { data: health } = useHealth();
  const { data: symbols = [] } = useMarketSymbols();
  const { data: watchlist } = useWatchlist();
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const [histories, setHistories] = useState<Record<string, MarketHistoryPoint[]>>({});

  useEffect(() => {
    const top6 = symbols.slice(0, 6).map((s) => s.symbol);
    top6.forEach((sym) => {
      getMarketQuote(sym).then((q) => setQuotes((prev) => ({ ...prev, [sym]: q }))).catch(() => {});
      getMarketHistory(sym, "1mo").then((h) => setHistories((prev) => ({ ...prev, [sym]: h }))).catch(() => {});
    });
  }, [symbols]);

  const ollamaOnline = health?.ollama?.status === "connected";

  return (
    <SiteChrome>
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-16">

        {/* ── Hero ─────────────────────────────────────────── */}
        <motion.section variants={fadeUp}>
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-8 sm:p-12 lg:p-16">
            <div className="grid gap-16 lg:grid-cols-[1fr_380px] lg:items-start">
              <div>
                <div className="flex items-center gap-2.5 mb-8">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-50 ${ollamaOnline ? "bg-emerald-400" : "bg-red-400"}`} />
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${ollamaOnline ? "bg-emerald-500" : "bg-red-500"}`} />
                  </span>
                  <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                    {ollamaOnline ? "Engine Ready" : "Engine Offline"}
                  </span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-semibold tracking-[-0.025em] text-white leading-[1.1] mb-6">
                  Institutional Intelligence.
                  <br />
                  <span className="text-zinc-600">Fully localized.</span>
                </h1>

                <p className="text-[16px] sm:text-[17px] leading-[1.7] text-zinc-400 max-w-[520px]">
                  FinGPT X merges high-speed market data, zero-latency RAG, and portfolio
                  analytics into a single, offline-first terminal. No cloud. No compromise.
                </p>

                <div className="mt-10 flex flex-wrap items-center gap-4">
                  <Link href="/research" className="btn-primary">
                    <Terminal size={15} />
                    Terminal
                  </Link>
                  <Link href="/dashboard" className="btn-ghost">
                    <LayoutDashboard size={15} />
                    Markets
                  </Link>
                  <Link href="/portfolio" className="btn-ghost hidden sm:inline-flex">
                    <Briefcase size={15} />
                    Portfolio
                  </Link>
                </div>
              </div>

              {/* Status / Quick Data */}
              <div className="space-y-5">
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500 block">
                  System Metrics
                </span>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "LLM Provider", value: health?.ollama?.active_model ?? "llama3:8b" },
                    { label: "Tracked Assets", value: health?.database?.symbols ?? 0 },
                    { label: "Datapoints", value: (health?.database?.market_data_points ?? 0).toLocaleString() },
                    { label: "Documents", value: health?.database?.documents ?? 0 },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl bg-zinc-900/60 border border-zinc-800/40 p-4 min-w-0">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-[0.1em] mb-2 truncate">{label}</div>
                      <div className="text-[14px] font-mono text-zinc-200 truncate">{value}</div>
                    </div>
                  ))}
                </div>

                {/* Primary Asset Snippet */}
                {histories["AAPL"]?.length > 2 && (
                  <Link href="/asset/AAPL" className="block">
                    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800/40 p-5 transition-all hover:border-zinc-700 hover:bg-zinc-800/40 group cursor-pointer">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[14px] font-semibold text-white">AAPL</span>
                        {quotes["AAPL"] && (
                          <span className={`text-[13px] font-medium font-mono ${quotes["AAPL"].change_percent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {quotes["AAPL"].change_percent >= 0 ? "+" : ""}{quotes["AAPL"].change_percent.toFixed(2)}%
                          </span>
                        )}
                      </div>
                      <div className="w-full h-[40px] opacity-50 group-hover:opacity-100 transition-opacity">
                        <Sparkline data={histories["AAPL"].map((h) => h.close)} width={320} height={40} />
                      </div>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── Market Pulse ─────────────────────────────────── */}
        {symbols.length > 0 && (
          <motion.section variants={fadeUp}>
            <div className="flex items-center justify-between mb-8">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Market Pulse</span>
              <Link href="/dashboard" className="text-[13px] text-zinc-500 hover:text-white transition-colors flex items-center gap-1.5 group">
                View all <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
              {symbols.slice(0, 6).map(({ symbol }) => {
                const q = quotes[symbol];
                const h = histories[symbol];
                const pos = q ? q.change_percent >= 0 : true;
                return (
                  <Link key={symbol} href={`/asset/${symbol}`} className="min-w-0">
                    <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/30 p-5 transition-all hover:border-zinc-700 hover:bg-zinc-800/30 cursor-pointer group h-full flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[14px] font-semibold text-white truncate pr-2">{symbol}</span>
                        {q && (
                          <span className={`text-[12px] font-medium font-mono ${pos ? "text-emerald-400" : "text-red-400"} flex-shrink-0`}>
                            {pos ? "+" : ""}{q.change_percent.toFixed(1)}%
                          </span>
                        )}
                      </div>
                      {q ? (
                        <div className="text-[14px] font-mono text-zinc-400 truncate">${q.price.toFixed(2)}</div>
                      ) : (
                        <div className="h-5 w-16 bg-zinc-800/60 animate-pulse rounded-md" />
                      )}
                      {h && h.length > 2 && (
                        <div className="mt-auto pt-5 opacity-40 group-hover:opacity-100 transition-opacity w-full h-[28px]">
                          <Sparkline data={h.slice(-15).map((p) => p.close)} width={120} height={28} />
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* ── 3-Column Bento ───────────────────────────────── */}
        <motion.section variants={fadeUp}>
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {/* Watchlist */}
            <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/20 flex flex-col overflow-hidden min-w-0">
              <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800/40">
                <span className="text-[14px] font-medium text-white">Watchlist</span>
              </div>
              <div className="flex-1 p-3">
                {(watchlist?.items ?? []).slice(0, 5).map((item) => {
                  const q = quotes[item.symbol];
                  return (
                    <Link key={item.id} href={`/asset/${item.symbol}`}>
                      <div className="flex items-center justify-between rounded-lg px-4 py-3.5 transition-colors hover:bg-zinc-800/40">
                        <span className="text-[14px] font-medium text-zinc-200">{item.symbol}</span>
                        {q && (
                          <span className={`text-[13px] font-mono ${q.change_percent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {q.change_percent >= 0 ? "+" : ""}{q.change_percent.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
                {(watchlist?.items ?? []).length === 0 && (
                  <div className="text-[13px] text-center py-12 text-zinc-600">Watchlist is empty</div>
                )}
              </div>
            </div>

            {/* Platform Capabilities */}
            <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/20 p-6 min-w-0">
              <span className="text-[14px] font-medium text-white block mb-7">Platform Core</span>
              <div className="space-y-7">
                {[
                  { icon: Terminal, label: "Generative Research", desc: "Local LLM inference via Ollama" },
                  { icon: Database, label: "Semantic RAG", desc: "Local vector search for your PDFs/CSVs" },
                  { icon: Activity, label: "Live Execution", desc: "Real-time quote ingestion & tracking" },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800/60 border border-zinc-700/40 flex-shrink-0">
                      <Icon size={16} className="text-zinc-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium text-zinc-100 truncate">{label}</div>
                      <div className="text-[13px] text-zinc-500 mt-1 leading-relaxed truncate">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/20 p-6 flex flex-col min-w-0 md:col-span-2 xl:col-span-1">
              <span className="text-[14px] font-medium text-white block mb-7">Command Palette</span>
              <div className="space-y-3 flex-1">
                {[
                  { href: "/search", icon: Search, label: "Search assets & documents" },
                  { href: "/portfolio", icon: Briefcase, label: "Review portfolio allocation" },
                  { href: "/documents", icon: Database, label: "Upload new research" },
                ].map(({ href, icon: Icon, label }) => (
                  <Link key={href} href={href} className="block">
                    <div className="flex items-center gap-4 rounded-lg p-4 transition-all bg-zinc-800/30 border border-zinc-700/30 hover:border-zinc-600/50 hover:bg-zinc-800/50 text-zinc-300">
                      <Icon size={16} className="text-zinc-400 flex-shrink-0" />
                      <span className="text-[13px] font-medium truncate">{label}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

      </motion.div>
    </SiteChrome>
  );
}
