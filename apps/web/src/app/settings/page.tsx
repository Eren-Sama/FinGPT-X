"use client";

import { useState, useRef, useCallback } from "react";
import {
  Database, Cpu, Upload, RefreshCw, AlertCircle, HardDrive,
  CheckCircle2, Save, Server, Settings, Globe, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { SiteChrome } from "@/components/site-chrome";
import { useHealth, useSettings } from "@/lib/queries";
import { importCsv, bulkImportCsv, patchSettings } from "@/lib/api";

// ─── Field Row ────────────────────────────────────────────────────────────────

function FieldRow({
  label,
  description,
  value,
  onChange,
  placeholder,
  monospace = false,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  monospace?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-5 border-b border-zinc-800/50 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-500 text-zinc-200">{label}</div>
        {description && (
          <div className="text-[12px] text-zinc-500 mt-0.5 leading-relaxed">{description}</div>
        )}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`frost-input px-3 py-2 text-[13px] w-full sm:w-[280px] flex-shrink-0 ${monospace ? "font-mono" : ""}`}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: health, refetch, isLoading } = useHealth();
  const { data: config, refetch: refetchConfig } = useSettings();

  // Local editable state — seeded from API config
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [ollamaModel, setOllamaModel] = useState("");
  const [embedModel, setEmbedModel] = useState("");
  const [saving, setSaving] = useState(false);

  // Seed from config once loaded
  const seeded = useRef(false);
  if (config && !seeded.current) {
    setOllamaUrl(String(config.ollama_base_url ?? ""));
    setOllamaModel(String(config.ollama_model ?? ""));
    setEmbedModel(String(config.ollama_embed_model ?? ""));
    seeded.current = true;
  }

  const [csvSymbol, setCsvSymbol] = useState("");
  const [importing, setImporting] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const ollama = health?.ollama;
  const db = health?.database;
  const ollamaOnline = ollama?.status === "connected";

  // ── Save config ────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await patchSettings({
        ollama_base_url: ollamaUrl.trim() || undefined,
        ollama_model: ollamaModel.trim() || undefined,
        ollama_embed_model: embedModel.trim() || undefined,
      });
      toast.success("Settings saved — restart the API server to apply fully");
      seeded.current = false; // Allow re-seeding on next load
      void refetchConfig();
      void refetch();
    } catch (err) {
      toast.error((err as Error).message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }, [ollamaUrl, ollamaModel, embedModel, refetchConfig, refetch]);

  // ── CSV import ─────────────────────────────────────────────────────────────
  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!csvSymbol.trim()) { toast.error("Enter a symbol first"); return; }
    e.target.value = "";
    setImporting(true);
    try {
      const r = await importCsv(file, csvSymbol.trim().toUpperCase());
      toast.success(`Imported ${String(r.rows_imported ?? "?")} rows for ${csvSymbol.toUpperCase()}`);
      void refetch();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const handleBulkImport = async () => {
    setBulkImporting(true);
    try {
      const r = await bulkImportCsv();
      toast.success(`Bulk import complete — ${String(r.imported ?? "?")} files processed`);
      void refetch();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBulkImporting(false);
    }
  };

  const isDirty =
    config &&
    (ollamaUrl !== config.ollama_base_url ||
      ollamaModel !== config.ollama_model ||
      embedModel !== config.ollama_embed_model);

  return (
    <SiteChrome>
      <div className="max-w-[800px] mx-auto space-y-14 pb-28">

        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-600 tracking-tight text-white mb-2">System Settings</h1>
            <p className="text-[15px] text-zinc-400">
              Configure local AI infrastructure and data ingestion.
            </p>
          </div>
          <button
            onClick={() => void refetch()}
            className="btn-ghost border border-zinc-800 text-[13px]"
          >
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
            Refresh Status
          </button>
        </div>

        {/* ── Infrastructure Status ── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Server size={14} className="text-zinc-500" />
            <h2 className="text-[13px] font-500 text-zinc-400 uppercase tracking-widest">
              Infrastructure
            </h2>
          </div>

          <div className="surface bg-zinc-900/10 divide-y divide-zinc-800/50">
            {/* Ollama */}
            <div className="flex flex-col md:flex-row md:items-center justify-between p-6 gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[8px] bg-zinc-900 border border-zinc-800">
                  <Cpu size={17} className="text-zinc-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-500 text-white">Local AI Engine</div>
                  <div className="text-[12px] text-zinc-500 mt-0.5 font-mono truncate">
                    {ollama?.active_model ?? "No model detected"} · {String(config?.ollama_base_url ?? "")}
                  </div>
                  {ollama?.models && (ollama.models as string[]).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(ollama.models as string[]).map((m: string) => (
                        <span key={m} className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 pl-14 md:pl-0 flex-shrink-0">
                {ollamaOnline ? (
                  <span className="flex items-center gap-2 text-[12px] font-500 text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-[6px]">
                    <CheckCircle2 size={13} /> Online
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-[12px] font-500 text-red-400 bg-red-400/10 px-3 py-1.5 rounded-[6px]">
                    <AlertCircle size={13} /> Offline
                  </span>
                )}
              </div>
            </div>

            {/* Database */}
            <div className="flex flex-col md:flex-row md:items-center justify-between p-6 gap-6">
              <div className="flex items-start gap-4 min-w-0">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[8px] bg-zinc-900 border border-zinc-800">
                  <Database size={17} className="text-zinc-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-500 text-white">Local Vector DB</div>
                  <div className="text-[12px] text-zinc-500 mt-0.5">SQLite · ChromaDB</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6 pl-14 md:pl-0 md:text-right flex-shrink-0">
                {[
                  { label: "Markets", value: db?.symbols ?? 0 },
                  { label: "Data Points", value: (db?.market_data_points ?? 0).toLocaleString() },
                  { label: "Documents", value: db?.documents ?? 0 },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="text-[10px] font-500 text-zinc-500 mb-1 uppercase tracking-wider">{label}</div>
                    <div className="text-[14px] font-mono font-500 text-zinc-100">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Ollama Configuration ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <Settings size={14} className="text-zinc-500" />
              <h2 className="text-[13px] font-500 text-zinc-400 uppercase tracking-widest">
                Ollama Configuration
              </h2>
            </div>
            {isDirty && (
              <span className="text-[11px] text-amber-400 bg-amber-400/10 px-2 py-1 rounded-[4px]">
                Unsaved changes
              </span>
            )}
          </div>

          <div className="surface bg-zinc-900/10 px-6">
            <FieldRow
              label="Ollama Base URL"
              description="URL where your Ollama server is running"
              value={ollamaUrl}
              onChange={setOllamaUrl}
              placeholder="http://localhost:11434"
              monospace
            />
            <FieldRow
              label="Chat Model"
              description="Model used for financial AI analysis and chat"
              value={ollamaModel}
              onChange={setOllamaModel}
              placeholder="llama3:8b"
              monospace
            />
            <FieldRow
              label="Embedding Model"
              description="Model used for document vectorization (RAG)"
              value={embedModel}
              onChange={setEmbedModel}
              placeholder="nomic-embed-text"
              monospace
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-[12px] text-zinc-600">
              Changes are written to <code className="font-mono text-zinc-500 bg-zinc-900 px-1 py-0.5 rounded border border-zinc-800">.env</code> and take effect after restarting the API server.
            </p>
            <button
              onClick={() => void handleSave()}
              disabled={saving || !isDirty}
              className="btn-primary text-[13px] py-2 px-5 disabled:opacity-40"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save Config
            </button>
          </div>
        </section>

        {/* ── Data Import ── */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <HardDrive size={14} className="text-zinc-500" />
            <h2 className="text-[13px] font-500 text-zinc-400 uppercase tracking-widest">
              Data Ingestion
            </h2>
          </div>

          <div className="surface p-6 bg-zinc-900/10">
            <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 items-start">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[8px] bg-zinc-900 border border-zinc-800">
                <Upload size={17} className="text-zinc-400" />
              </div>
              <div className="flex-1 min-w-0 w-full">
                <div className="text-[14px] font-500 text-white mb-1">Import Historical Data</div>
                <p className="text-[13px] text-zinc-400 leading-relaxed mb-5">
                  Upload standard Yahoo Finance CSV files (Date, Open, High, Low, Close, Volume columns).
                </p>
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <input
                    value={csvSymbol}
                    onChange={(e) => setCsvSymbol(e.target.value.toUpperCase())}
                    placeholder="Symbol (e.g., AAPL)"
                    className="frost-input flex-1 px-4 py-2.5 text-[14px] font-mono min-w-0"
                  />
                  <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={importing || !csvSymbol.trim()}
                    className="btn-primary px-6 flex-shrink-0 justify-center disabled:opacity-40"
                  >
                    {importing ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />}
                    Select CSV
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="surface p-6 bg-zinc-900/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="min-w-0">
              <div className="text-[14px] font-500 text-white mb-1">Bulk Initialize</div>
              <div className="text-[13px] text-zinc-400">
                Scan and ingest all CSV files in{" "}
                <code className="font-mono text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                  ./data/csv/
                </code>
              </div>
            </div>
            <button
              onClick={() => void handleBulkImport()}
              disabled={bulkImporting}
              className="btn-ghost border border-zinc-800 hover:border-zinc-700 w-full md:w-auto flex-shrink-0 justify-center disabled:opacity-40"
            >
              {bulkImporting ? <RefreshCw size={13} className="animate-spin" /> : <Database size={13} />}
              Run Bulk Import
            </button>
          </div>
        </section>

      </div>
    </SiteChrome>
  );
}
