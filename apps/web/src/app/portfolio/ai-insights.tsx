"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, ChevronDown, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AIInsightsPanelProps {
  holdings: { symbol: string; quantity: number; avg_price: number }[];
}

export function AIInsightsPanel({ holdings }: AIInsightsPanelProps) {
  const [analysis, setAnalysis] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && loading) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [analysis, loading]);

  const analyzePortfolio = useCallback(async () => {
    if (holdings.length === 0) {
      toast.error("Add at least one position before running analysis.");
      return;
    }
    setLoading(true);
    setAnalysis("");
    setOpen(true);

    try {
      const resp = await fetch("/api/portfolio/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: 0 }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(err.detail ?? `HTTP ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6);
          if (raw === "[DONE]") break;

          try {
            const parsed = JSON.parse(raw) as { token?: string; error?: string };
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.token) setAnalysis((prev) => prev + parsed.token);
          } catch { /* ignore malformed */ }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Analysis failed: " + msg);
    } finally {
      setLoading(false);
    }
  }, [holdings]);

  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800/60">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-[8px] bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center">
            <Bot size={14} className="text-violet-400" />
          </div>
          <div>
            <div className="text-[14px] font-600 text-zinc-100">AI Portfolio Analysis</div>
            <div className="text-[12px] text-zinc-500">Risk breakdown powered by Local Llama 3 / Phi-3</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {analysis && (
            <button onClick={() => setOpen((p) => !p)} className="btn-ghost py-1.5 px-3 text-[12px] gap-1.5">
              <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
              {open ? "Collapse" : "Expand"}
            </button>
          )}
          <button onClick={analyzePortfolio} disabled={loading} className="btn-primary py-2 px-4 text-[13px] gap-2">
            {loading ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <Sparkles size={13} />
                Analyze Portfolio
              </>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (analysis || loading) && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div ref={scrollRef} className="px-8 py-6 max-h-[560px] overflow-y-auto">
              {loading && !analysis && (
                <div className="flex items-center gap-3 text-[13px] text-zinc-400">
                  <Loader2 size={14} className="animate-spin text-violet-400" />
                  <span>Reading your portfolio and generating analysis…</span>
                </div>
              )}
              {analysis && (
                <div className="prose prose-invert prose-zinc max-w-none prose-h2:text-base prose-h2:font-600 prose-h2:text-zinc-100 prose-h2:mt-6 prose-h2:mb-2 prose-h2:first:mt-0 prose-p:text-zinc-300 prose-p:text-[13.5px] prose-p:leading-relaxed prose-p:my-1.5 prose-li:text-zinc-300 prose-li:text-[13px] prose-strong:text-zinc-100 prose-strong:font-600 prose-hr:border-zinc-800">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis}</ReactMarkdown>
                  {loading && <span className="inline-block h-4 w-0.5 bg-violet-400 animate-pulse ml-0.5 align-middle" />}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
