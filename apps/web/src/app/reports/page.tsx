"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Download, Trash2, ChevronDown, Loader2,
  Sparkles, FileDown, File, Clock, ArrowRight, X, Copy, Check,
  Building2, TrendingUp, Briefcase, AlertTriangle, Globe
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { SiteChrome } from "@/components/site-chrome";
import { useReports, useDeleteReport } from "@/lib/queries";
import { getReportExportUrl } from "@/lib/api";
import type { Report, ReportCreate } from "@/lib/types";
import { useQueryClient } from "@tanstack/react-query";

// ─── Report Type Config ────────────────────────────────────────────────────

const REPORT_TYPES: Array<{
  value: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: "company_analysis",
    label: "Company Analysis",
    description: "Deep dive into financials, business model & investment outlook",
    icon: <Building2 size={16} />,
  },
  {
    value: "investment_summary",
    label: "Investment Summary",
    description: "Concise investment case with key metrics & recommendation",
    icon: <TrendingUp size={16} />,
  },
  {
    value: "portfolio_report",
    label: "Portfolio Report",
    description: "Performance attribution, allocation & rebalancing strategy",
    icon: <Briefcase size={16} />,
  },
  {
    value: "risk_report",
    label: "Risk Report",
    description: "Market, credit, liquidity & concentration risk analysis",
    icon: <AlertTriangle size={16} />,
  },
  {
    value: "market_insights",
    label: "Market Insights",
    description: "Macro trends, sector rotation & economic indicators",
    icon: <Globe size={16} />,
  },
];

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { data: reports = [], isLoading } = useReports();
  const deleteReport = useDeleteReport();

  const [selectedType, setSelectedType] = useState("company_analysis");
  const [subject, setSubject] = useState("");
  const [context, setContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [streamedContent, setStreamedContent] = useState("");
  const [latestReportId, setLatestReportId] = useState<number | null>(null);
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [copied, setCopied] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const queryClient = useReportsQueryClient();

  const streamRef = useRef<AbortController | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll while streaming
  useEffect(() => {
    if (contentRef.current && generating) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [streamedContent, generating]);

  const handleGenerate = useCallback(async () => {
    if (!subject.trim()) {
      toast.error("Please enter a subject for the report");
      return;
    }

    setGenerating(true);
    setStreamedContent("");
    setLatestReportId(null);
    setActiveReport(null);

    try {
      const payload: ReportCreate = {
        report_type: selectedType,
        subject: subject.trim(),
        context: context.trim() || undefined,
        user_id: 0,
      };

      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
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
            const parsed = JSON.parse(raw) as {
              token?: string;
              done?: boolean;
              report_id?: number;
            };
            if (parsed.token) {
              setStreamedContent((prev) => prev + parsed.token);
            }
            if (parsed.done && parsed.report_id) {
              setLatestReportId(parsed.report_id);
              queryClient.invalidateReports();
              toast.success("Report saved!");
            }
          } catch { /* ignore malformed */ }
        }
      }
    } catch (err: unknown) {
      toast.error("Generation failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setGenerating(false);
    }
  }, [selectedType, subject, context, queryClient]);

  const handleCopy = useCallback(() => {
    const content = activeReport?.content ?? streamedContent;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  }, [activeReport, streamedContent]);

  const handleDelete = (reportId: number) => {
    deleteReport.mutate(reportId, {
      onSuccess: () => {
        toast.success("Report deleted");
        if (activeReport?.id === reportId) setActiveReport(null);
        if (latestReportId === reportId) setLatestReportId(null);
      },
    });
  };

  const exportReport = (reportId: number, format: "markdown" | "pdf") => {
    const url = getReportExportUrl(reportId, format);
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const activeContent = activeReport?.content ?? (streamedContent || null);
  const activeSubject = activeReport?.subject ?? (streamedContent ? subject : null);
  const activeReportId = activeReport?.id ?? latestReportId;

  const selectedTypeMeta = REPORT_TYPES.find((t) => t.value === selectedType)!;

  return (
    <SiteChrome>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[340px_1fr] items-start min-h-[80vh]">

        {/* ── Left Panel: Builder ─────────────────────────────────────── */}
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-600 tracking-tight text-white mb-2">
              Report Generator
            </h1>
            <p className="text-[15px] text-zinc-400">
              AI-generated institutional-grade financial reports.
            </p>
          </div>

          {/* Builder Card */}
          <div className="surface p-6 flex flex-col gap-5">
            {/* Report Type Selector */}
            <div>
              <label className="text-[12px] font-500 text-zinc-500 uppercase tracking-widest mb-3 block">
                Report Type
              </label>
              <div className="flex flex-col gap-2">
                {REPORT_TYPES.map((rt) => (
                  <button
                    key={rt.value}
                    onClick={() => setSelectedType(rt.value)}
                    className={`flex items-start gap-3 p-3 rounded-[10px] text-left transition-all border ${
                      selectedType === rt.value
                        ? "bg-zinc-900 border-zinc-700 shadow-sm"
                        : "border-transparent hover:bg-zinc-900/40 hover:border-zinc-800"
                    }`}
                  >
                    <span className={`mt-0.5 ${selectedType === rt.value ? "text-emerald-400" : "text-zinc-500"}`}>{rt.icon}</span>
                    <div>
                      <div className={`text-[13px] font-500 ${selectedType === rt.value ? "text-zinc-100" : "text-zinc-300"}`}>
                        {rt.label}
                      </div>
                      <div className="text-[12px] text-zinc-500 mt-0.5 leading-tight">
                        {rt.description}
                      </div>
                    </div>
                    {selectedType === rt.value && (
                      <div className="ml-auto mt-1.5 h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject Input */}
            <div>
              <label className="text-[12px] font-500 text-zinc-500 uppercase tracking-widest mb-2 block">
                Subject
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !generating) handleGenerate(); }}
                placeholder={
                  selectedType === "company_analysis"
                    ? "e.g. Apple Inc (AAPL)"
                    : selectedType === "market_insights"
                    ? "e.g. US Equity Markets Q3 2025"
                    : "e.g. My Tech Growth Portfolio"
                }
                className="frost-input w-full px-4 py-2.5 text-[14px]"
                disabled={generating}
              />
            </div>

            {/* Optional context */}
            <div>
              <button
                onClick={() => setShowContext((p) => !p)}
                className="flex items-center gap-2 text-[12px] font-500 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <ChevronDown
                  size={14}
                  className={`transition-transform ${showContext ? "rotate-180" : ""}`}
                />
                Add context (optional)
              </button>
              <AnimatePresence>
                {showContext && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <textarea
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      placeholder="Add any specific data, figures, or focus areas for the report…"
                      rows={3}
                      className="frost-input w-full px-4 py-2.5 text-[14px] mt-3 resize-none"
                      disabled={generating}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={generating || !subject.trim()}
              className="btn-primary w-full gap-2 py-3"
            >
              {generating ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  Generate {selectedTypeMeta.label}
                </>
              )}
            </button>
          </div>

          {/* Saved Reports */}
          {(reports.length > 0 || isLoading) && (
            <div>
              <div className="text-[12px] font-500 text-zinc-500 uppercase tracking-widest mb-3">
                Saved Reports ({reports.length})
              </div>

              {isLoading && (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 rounded-[10px] bg-zinc-900 animate-pulse" />
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto">
                {reports.map((r) => (
                  <motion.div
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => setActiveReport(r)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveReport(r);
                      }
                    }}
                    className={`flex items-start gap-3 px-4 py-3 rounded-[10px] text-left transition-all border group ${
                      activeReport?.id === r.id
                        ? "bg-zinc-900 border-zinc-700"
                        : "border-transparent hover:bg-zinc-900/40 hover:border-zinc-800"
                    }`}
                  >
                    <FileText size={14} className="text-zinc-500 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-500 text-zinc-200 truncate">
                        {r.subject}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1.5">
                        <Clock size={10} />
                        {new Date(r.created_at).toLocaleDateString()}
                        <span>·</span>
                        {REPORT_TYPES.find((t) => t.value === r.report_type)?.label ?? r.report_type}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                      className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all p-0.5"
                    >
                      <Trash2 size={13} />
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right Panel: Report Viewer ──────────────────────────────── */}
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            {activeContent ? (
              <motion.div
                key="viewer"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="surface overflow-hidden"
              >
                {/* Toolbar */}
                <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-zinc-800/60">
                  <div className="min-w-0">
                    <div className="text-[13px] font-500 text-zinc-100 truncate">
                      {activeSubject}
                    </div>
                    {activeReport && (
                      <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1.5">
                        <Clock size={10} />
                        {new Date(activeReport.created_at).toLocaleDateString()}
                      </div>
                    )}
                    {generating && (
                      <div className="flex items-center gap-2 text-[11px] text-emerald-400 mt-0.5">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Generating…
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Copy */}
                    <button
                      onClick={handleCopy}
                      className="btn-ghost py-1.5 px-3 text-[12px] gap-1.5"
                    >
                      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      {copied ? "Copied" : "Copy"}
                    </button>

                    {/* Download Markdown */}
                    {activeReportId && (
                      <>
                        <button
                          onClick={() => exportReport(activeReportId, "markdown")}
                          className="btn-ghost py-1.5 px-3 text-[12px] gap-1.5"
                        >
                          <File size={12} />
                          .md
                        </button>
                        <button
                          onClick={() => exportReport(activeReportId, "pdf")}
                          className="btn-primary py-1.5 px-3 text-[12px] gap-1.5"
                        >
                          <FileDown size={12} />
                          Export PDF
                        </button>
                      </>
                    )}

                    {/* Close */}
                    {activeReport && (
                      <button
                        onClick={() => setActiveReport(null)}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Report Content */}
                <div
                  ref={contentRef}
                  className="px-8 py-8 max-h-[calc(100vh-220px)] overflow-y-auto"
                >
                  <div className="prose prose-invert prose-zinc max-w-none
                    prose-h1:text-2xl prose-h1:font-600 prose-h1:tracking-tight prose-h1:text-white prose-h1:border-b prose-h1:border-zinc-800 prose-h1:pb-3
                    prose-h2:text-lg prose-h2:font-600 prose-h2:text-zinc-100 prose-h2:mt-8 prose-h2:mb-3
                    prose-h3:text-base prose-h3:font-500 prose-h3:text-zinc-200 prose-h3:mt-5
                    prose-p:text-zinc-300 prose-p:leading-relaxed prose-p:text-[14.5px]
                    prose-li:text-zinc-300 prose-li:text-[14px]
                    prose-strong:text-zinc-100 prose-strong:font-600
                    prose-code:text-emerald-300 prose-code:bg-zinc-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px]
                    prose-blockquote:border-zinc-700 prose-blockquote:text-zinc-400
                    prose-hr:border-zinc-800">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {activeContent}
                    </ReactMarkdown>
                    {generating && (
                      <span className="inline-block h-4 w-0.5 bg-zinc-400 animate-pulse ml-0.5 align-middle" />
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="surface flex flex-col items-center justify-center min-h-[500px] text-center p-12"
              >
                <div className="h-16 w-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6">
                  <FileText size={28} className="text-zinc-600" />
                </div>
                <h2 className="text-[18px] font-600 text-zinc-200 mb-3">
                  No report generated yet
                </h2>
                <p className="text-[14px] text-zinc-500 max-w-sm leading-relaxed mb-8">
                  Select a report type, enter a subject, and click Generate to create
                  an institutional-grade financial report powered by local AI.
                </p>
                <div className="flex flex-col gap-2 text-[13px] text-zinc-600">
                  {REPORT_TYPES.slice(0, 3).map((rt) => (
                    <button
                      key={rt.value}
                      onClick={() => { setSelectedType(rt.value); }}
                      className="flex items-center gap-2 hover:text-zinc-400 transition-colors"
                    >
                      <ArrowRight size={12} />
                      <span className="text-zinc-500 scale-75">{rt.icon}</span> {rt.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </SiteChrome>
  );
}

// ─── Tiny helper to invalidate reports ────────────────────────────────────
function useReportsQueryClient() {
  const qc = useQueryClient();
  return {
    invalidateReports: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  };
}
