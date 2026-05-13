"use client";

/**
 * Perplexity-style inline citation system.
 *
 * Usage:
 *   <CitationBadge index={1} source={source} />
 *
 * Renders a small superscript badge [1] that, on hover/click,
 * opens a popover with the source filename, relevance score, and snippet.
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, X, ExternalLink } from "lucide-react";

export interface Source {
  index: number;
  filename: string;
  document_id: number;
  chunk_index: number;
  relevance_score: number;
  snippet: string;
}

// ─── Single badge + popover ────────────────────────────────────────────────────

export function CitationBadge({ source }: { source: Source }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const relevancePct = Math.round(source.relevance_score * 100);

  return (
    <span ref={ref} className="relative inline-block align-super" style={{ fontSize: "0.72em" }}>
      <button
        onClick={() => setOpen((p) => !p)}
        className={`inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-[4px] font-mono font-600 text-[10px] transition-all select-none cursor-pointer border ${
          open
            ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
            : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 hover:border-zinc-600"
        }`}
        title={`Source: ${source.filename}`}
        aria-label={`Citation ${source.index}: ${source.filename}`}
      >
        {source.index}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-6 z-50 w-[320px] rounded-[12px] border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/60 p-4"
            style={{ fontSize: "1rem" }} // Reset font size for popover content
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={13} className="text-blue-400 shrink-0" />
                <span className="text-[12px] font-500 text-zinc-200 truncate">
                  {source.filename}
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"
              >
                <X size={12} />
              </button>
            </div>

            {/* Relevance bar */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-500 text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                Relevance
              </span>
              <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500/70 rounded-full"
                  style={{ width: `${relevancePct}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-zinc-500">{relevancePct}%</span>
            </div>

            {/* Snippet */}
            <p className="text-[12px] text-zinc-400 leading-relaxed line-clamp-5 border-t border-zinc-800/60 pt-3">
              {source.snippet}
              {source.snippet.length >= 280 && (
                <span className="text-zinc-600">…</span>
              )}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-800/60">
              <span className="text-[10px] text-zinc-600">
                Source [{source.index}] · Chunk {source.chunk_index}
              </span>
              <span className="text-[10px] text-blue-400/60 flex items-center gap-1">
                <ExternalLink size={10} />
                From your documents
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

// ─── Sources panel (shown below a message with citations) ─────────────────────

export function SourcesPanel({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;

  return (
    <div className="mt-4 border-t border-zinc-800/50 pt-4">
      <div className="text-[11px] font-500 text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
        <FileText size={11} />
        Sources ({sources.length})
      </div>
      <div className="flex flex-wrap gap-2">
        {sources.map((src) => (
          <SourcePill key={src.index} source={src} />
        ))}
      </div>
    </div>
  );
}

function SourcePill({ source }: { source: Source }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={ref}
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[11px] font-500 border transition-all ${
          open
            ? "bg-blue-500/10 border-blue-500/40 text-blue-300"
            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
        }`}
      >
        <span className="text-[9px] font-mono bg-zinc-800 px-1 rounded text-zinc-400">
          [{source.index}]
        </span>
        <span className="truncate max-w-[120px]">{source.filename}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute bottom-8 left-0 z-50 w-[300px] rounded-[12px] border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/60 p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <FileText size={12} className="text-blue-400 shrink-0" />
              <span className="text-[12px] font-500 text-zinc-200">{source.filename}</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-6">
              {source.snippet}
            </p>
            <div className="mt-2 pt-2 border-t border-zinc-800/60 text-[10px] text-zinc-600">
              Relevance: {Math.round(source.relevance_score * 100)}% · Chunk {source.chunk_index}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Utility: parse [N] in markdown text → CitationBadge ─────────────────────

/**
 * Takes a markdown string and an array of sources.
 * Returns React children with [N] occurrences replaced by <CitationBadge />.
 *
 * Usage inside a ReactMarkdown component:
 *   components={{ p: ({ children }) => <p>{parseCitations(String(children), sources)}</p> }}
 */
export function parseCitations(text: string, sources: Source[]): React.ReactNode[] {
  if (!sources.length || !text) return [text];

  // Match [1], [2], … up to [9]
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (match) {
      const idx = parseInt(match[1], 10);
      const source = sources.find((s) => s.index === idx);
      if (source) {
        return <CitationBadge key={`cite-${i}-${idx}`} source={source} />;
      }
    }
    return part;
  });
}
