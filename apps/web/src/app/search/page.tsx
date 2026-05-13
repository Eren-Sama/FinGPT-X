"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Terminal, FileText, ArrowRight,
  TrendingUp, TrendingDown, BarChart3, X,
} from "lucide-react";
import { SiteChrome } from "@/components/site-chrome";
import { useSymbolSearch, useMarketQuote } from "@/lib/queries";
import { searchDocuments } from "@/lib/api";
import type { SearchResult } from "@/lib/types";

// ─── Category config — searchTerm maps to backend sector/name fields ──────────

const CATEGORIES = [
  { label: "Finance",     searchTerm: "Financials" },
  { label: "Crypto",      searchTerm: "Crypto" },
  { label: "Tech",        searchTerm: "Technology" },
  { label: "Economy",     searchTerm: "Index" },
  { label: "Healthcare",  searchTerm: "Healthcare" },
  { label: "Energy",      searchTerm: "Energy" },
  { label: "Automotive",  searchTerm: "Automotive" },
  { label: "Commodities", searchTerm: "Commodity" },
  { label: "Consumer",    searchTerm: "Consumer" },
  { label: "All Assets",  searchTerm: "" },
] as const;

type CategoryLabel = (typeof CATEGORIES)[number]["label"];

// ─── Utilities ────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [d, setD] = useState<T>(value);
  useEffect(() => {
    const h = setTimeout(() => setD(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return d;
}

// ─── Live quote chip ──────────────────────────────────────────────────────────

function SymbolQuoteChip({ symbol }: { symbol: string }) {
  const { data: quote } = useMarketQuote(symbol);
  if (!quote || quote.price === 0) return null;
  const pos = quote.change_percent >= 0;
  return (
    <div className="flex items-center gap-3 ml-auto flex-shrink-0">
      <span className="text-[13px] font-mono text-zinc-100">
        ${quote.price.toFixed(2)}
      </span>
      <span className={`flex items-center gap-1 text-[11px] font-mono font-500 px-1.5 py-0.5 rounded ${pos ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"}`}>
        {pos ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        {Math.abs(quote.change_percent).toFixed(2)}%
      </span>
    </div>
  );
}

// ─── Symbol row ───────────────────────────────────────────────────────────────

function SymbolRow({ result }: { result: SearchResult }) {
  return (
    <Link href={`/dashboard`}>
      <div className="surface flex items-center gap-4 p-4 bg-zinc-900/10 hover:border-zinc-700 hover:bg-zinc-900/30 transition-all">
        <div className="flex h-9 w-9 items-center justify-center rounded-[7px] bg-zinc-900 border border-zinc-800 flex-shrink-0">
          <BarChart3 size={14} className="text-zinc-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className="text-[14px] font-600 text-white">{result.symbol}</span>
            {result.sector && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-500">
                {result.sector}
              </span>
            )}
          </div>
          {result.name && (
            <div className="text-[12px] text-zinc-500 mt-0.5 truncate">{result.name}</div>
          )}
        </div>
        <SymbolQuoteChip symbol={result.symbol} />
        <ArrowRight size={13} className="text-zinc-600 flex-shrink-0" />
      </div>
    </Link>
  );
}

// ─── Sentiment Bar ────────────────────────────────────────────────────────────

function SentimentBar({ bearish = 3 }: { bearish?: number }) {
  const total = 10;
  const bullish = total - bearish;
  const isBullish = bullish >= bearish;
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-[2px]">
        {Array.from({ length: total }).map((_, i) => {
          const active = isBullish ? i < bullish : i >= bullish;
          return (
            <div
              key={i}
              className={`w-1 h-3 rounded-sm ${active ? (isBullish ? "bg-emerald-500" : "bg-red-500") : "bg-zinc-700"}`}
            />
          );
        })}
      </div>
      <span className={`text-[12px] font-500 ${isBullish ? "text-emerald-400" : "text-red-400"}`}>
        {isBullish ? "Bullish" : "Bearish"} Sentiment
      </span>
    </div>
  );
}

// ─── Market Time Indicator ────────────────────────────────────────────────────

function MarketTimeIndicator() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  // NSE/BSE: Mon-Fri 9:15am–3:30pm IST (UTC+5:30)
  const istOffset = 5.5 * 60;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utcMs + istOffset * 60000);
  const h = ist.getHours(), m = ist.getMinutes(), dow = ist.getDay();
  const isWeekday = dow >= 1 && dow <= 5;
  const afterOpen = h > 9 || (h === 9 && m >= 15);
  const beforeClose = h < 15 || (h === 15 && m <= 30);
  const isOpen = isWeekday && afterOpen && beforeClose;

  const dateStr = ist.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const timeStr = ist.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="text-[11px] font-500 text-zinc-500">
      <span className={isOpen ? "text-emerald-400" : "text-zinc-400"}>
        Markets {isOpen ? "Open" : "Closed"}
      </span>
      {" · "}{dateStr}, {timeStr} IST
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

function SearchContent() {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [activeCategory, setActiveCategory] = useState<CategoryLabel | null>(null);
  const [docResults, setDocResults] = useState<Array<Record<string, unknown>>>([]);
  const [docLoading, setDocLoading] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  // Build the effective search term: typed query takes priority, then category searchTerm
  const categoryMeta = activeCategory ? CATEGORIES.find((c) => c.label === activeCategory) : null;
  const categorySearchTerm = categoryMeta?.searchTerm ?? "";

  // If user typed something, search that; otherwise if a category is active, search its sector term
  const effectiveSearch = debouncedQuery || categorySearchTerm;
  const submitted = effectiveSearch.length > 0 || activeCategory === "All Assets";

  // For "All Assets" we search with a very broad term
  const apiQuery = activeCategory === "All Assets" && !debouncedQuery ? "%" : effectiveSearch;

  const { data: symbolResults = [], isLoading: symLoading } = useSymbolSearch(
    submitted ? apiQuery : "",
  );

  // Doc search on debouncedQuery change
  useEffect(() => {
    if (debouncedQuery.length < 1) {
      setDocResults([]);
      return;
    }
    setDocLoading(true);
    searchDocuments(debouncedQuery, undefined, 5, 0)
      .then((r) => setDocResults(r.results))
      .catch(() => setDocResults([]))
      .finally(() => setDocLoading(false));
  }, [debouncedQuery]);

  const handleCategoryClick = (cat: CategoryLabel) => {
    if (activeCategory === cat) {
      setActiveCategory(null);
    } else {
      setActiveCategory(cat);
      setQuery("");
    }
  };

  return (
    <div className="p-8 max-w-[720px] mx-auto space-y-6 mt-10 w-full">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

        <div className="mb-5">
          <h1 className="text-[22px] font-600 text-zinc-100 mb-1">Prediction Markets</h1>
          <p className="text-[13px] text-zinc-500">Search assets, documents, and ask the AI research engine.</p>
        </div>

        {/* Search bar */}
        <div className="relative shadow-2xl">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveCategory(null); }}
            placeholder="Search markets, assets, or terms…"
            className="w-full rounded-[12px] bg-zinc-900 border border-zinc-800 pl-11 pr-4 py-4 text-[15px] text-white outline-none focus:border-zinc-700 transition-colors placeholder:text-zinc-500"
          />
          {(query || activeCategory) && (
            <button
              onClick={() => { setQuery(""); setActiveCategory(null); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Categories */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.label;
            return (
              <button
                key={cat.label}
                onClick={() => handleCategoryClick(cat.label)}
                className={`px-3 py-1.5 rounded-full text-[13px] border transition-all ${
                  isActive
                    ? "border-zinc-500 bg-zinc-800 text-zinc-100 font-500"
                    : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Active category hint */}
        {activeCategory && !debouncedQuery && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex items-center gap-2 text-[12px] text-zinc-500"
          >
            <span>Showing</span>
            <span className="text-zinc-300 font-500">{activeCategory}</span>
            <span>assets</span>
            <button onClick={() => setActiveCategory(null)} className="ml-1 text-zinc-600 hover:text-zinc-400">
              <X size={11} />
            </button>
          </motion.div>
        )}

        {/* Results */}
        <AnimatePresence>
          {submitted && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-8 mt-8"
            >
              {/* Ask AI CTA — only when there's a text query */}
              {debouncedQuery && (
                <Link href={`/research?q=${encodeURIComponent(debouncedQuery)}`}>
                  <div className="group flex flex-col gap-3 rounded-[12px] border border-zinc-800 bg-zinc-900/50 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-800/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-zinc-900 border border-zinc-800">
                          <Terminal size={15} className="text-zinc-200" />
                        </div>
                        <div>
                          <div className="text-[14px] font-500 text-white">
                            Ask AI about &quot;{debouncedQuery}&quot;
                          </div>
                          <div className="text-[12px] text-zinc-500 mt-0.5">
                            Run through local Phi-3 research engine
                          </div>
                        </div>
                      </div>
                      <ArrowRight size={14} className="text-zinc-500 group-hover:text-zinc-200 transition-colors" />
                    </div>

                    {/* Market Sentiment & Time */}
                    <div className="flex items-center justify-between pt-3 border-t border-zinc-800/50">
                      <SentimentBar bearish={3} />
                      <MarketTimeIndicator />
                    </div>
                  </div>
                </Link>
              )}

              {/* Category header */}
              {activeCategory && !debouncedQuery && (
                <div className="flex items-center gap-3 pb-1 border-b border-zinc-800/60">
                  <span className="text-[13px] font-600 text-zinc-200">{activeCategory}</span>
                  <span className="text-[11px] text-zinc-600">
                    {symbolResults.length} asset{symbolResults.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}

              {/* Markets */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-[11px] font-500 text-zinc-500 uppercase tracking-wider">Markets</div>
                  {symbolResults.length > 0 && (
                    <span className="text-[10px] text-zinc-600 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded-full">
                      {symbolResults.length} found
                    </span>
                  )}
                </div>
                {symLoading && (
                  <div className="h-14 rounded-[12px] bg-zinc-900/50 animate-pulse border border-zinc-800/50" />
                )}
                {!symLoading && symbolResults.length === 0 && (
                  <p className="text-[13px] text-zinc-500 ml-1">
                    {activeCategory ? `No ${activeCategory} assets found` : "No markets found"}
                  </p>
                )}
                <div className="grid gap-2">
                  {symbolResults.map((r) => (
                    <SymbolRow key={r.symbol} result={r} />
                  ))}
                </div>
              </div>

              {/* Document results */}
              {(docLoading || docResults.length > 0) && (
                <div>
                  <div className="text-[11px] font-500 text-zinc-500 mb-3 uppercase tracking-wider">
                    Document Matches
                  </div>
                  {docLoading && (
                    <div className="h-20 rounded-[12px] bg-zinc-900/50 animate-pulse border border-zinc-800/50" />
                  )}
                  <div className="grid gap-3">
                    {docResults.map((r, i) => (
                      <div key={i} className="surface p-5 bg-zinc-900/10">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText size={13} className="text-zinc-500" />
                          <div className="text-[12px] font-500 text-zinc-300">
                            {String(r.filename ?? r.source ?? "Document")}
                          </div>
                          {r.relevance_score != null && (
                            <span className="ml-auto text-[10px] font-mono text-zinc-600">
                              {Math.round(Number(r.relevance_score) * 100)}% match
                            </span>
                          )}
                        </div>
                        <p className="text-[13px] leading-relaxed text-zinc-400">
                          {String(r.content ?? r.text ?? "").slice(0, 240)}…
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!submitted && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-16 text-center">
            <p className="text-[14px] text-zinc-500">
              Search assets or pick a category above to browse markets.
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <SiteChrome>
      <React.Suspense
        fallback={
          <div className="p-8 max-w-[700px] mx-auto mt-10 text-center text-zinc-500">
            Loading search...
          </div>
        }
      >
        <SearchContent />
      </React.Suspense>
    </SiteChrome>
  );
}
