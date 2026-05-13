"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Trash2, X, Send, Database, FileText, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { SiteChrome } from "@/components/site-chrome";
import { ChatMessage as ChatMessageComponent } from "@/components/chat-message";
import { useDocuments, useDeleteDocument } from "@/lib/queries";
import { uploadDocument, streamChat } from "@/lib/api";
import type { ChatMessage, DocumentRow } from "@/lib/types";
import { useQueryClient } from "@tanstack/react-query";

const formatSize = (bytes: number) => bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${(bytes / 1_000).toFixed(0)} KB`;

export default function DocumentsPage() {
  const { data: docs = [], isLoading } = useDocuments();
  const deleteDoc = useDeleteDocument();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [activeDoc, setActiveDoc] = useState<DocumentRow | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      await uploadDocument(file);
      toast.success(`${file.name} uploaded and indexed`);
      void qc.invalidateQueries({ queryKey: ["documents", 0] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }, [qc]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleUpload(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleUpload(file);
    e.target.value = "";
  };

  const handleDelete = (doc: DocumentRow) => {
    deleteDoc.mutate({ docId: doc.id }, {
      onSuccess: () => {
        toast.success("Document removed");
        if (activeDoc?.id === doc.id) { setActiveDoc(null); setChatMessages([]); }
      },
    });
  };

  const handleChat = async () => {
    const text = chatInput.trim();
    if (!text || streaming || !activeDoc) return;

    setChatInput("");
    const userMsg: ChatMessage = { role: "user", content: text };
    setChatMessages((p) => [...p, userMsg]);
    setStreaming(true);

    const assistantMsg: ChatMessage = { role: "assistant", content: "" };
    setChatMessages((p) => [...p, assistantMsg]);

    try {
      await streamChat(
        "/api/documents/chat/stream",
        { message: text, history: chatMessages.slice(-6), document_id: activeDoc.id, user_id: 0 },
        (token) => {
          setChatMessages((p) => {
            const last = p[p.length - 1];
            if (last?.role !== "assistant") return p;
            return [...p.slice(0, -1), { ...last, content: last.content + token }];
          });
        },
      );
    } catch {
      toast.error("Failed to get response");
      setChatMessages((p) => p.slice(0, -1));
    } finally {
      setStreaming(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  if (activeDoc) {
    return (
      <SiteChrome>
        <div className="max-w-[800px] mx-auto min-h-[calc(100vh-160px)] flex flex-col">
          {/* Header */}
          <button onClick={() => { setActiveDoc(null); setChatMessages([]); }} className="self-start mb-6 text-[13px] text-zinc-500 hover:text-zinc-300 flex items-center gap-2 transition-colors">
            <X size={16} /> Close Document
          </button>
          
          <div className="border-b border-zinc-800 pb-8 mb-8">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-zinc-900 border border-zinc-800">
                <FileText size={20} className="text-zinc-400" />
              </div>
              <div>
                <h1 className="text-2xl font-600 tracking-tight text-white mb-1">{activeDoc.filename}</h1>
                <div className="flex items-center gap-3 text-[13px] text-zinc-500">
                  <span>{formatSize(activeDoc.file_size)}</span>
                  <span>•</span>
                  <span>{activeDoc.chunk_count} semantic chunks indexed</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 space-y-6 pb-24">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Database size={32} className="text-zinc-800 mb-6" />
                <h2 className="text-xl font-500 text-zinc-100 mb-2">Query Document</h2>
                <p className="text-[14px] text-zinc-500 max-w-md leading-relaxed">
                  Ask specific questions about the contents of this document. FinGPT will cite the exact passages it used to formulate the answer.
                </p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {chatMessages.map((msg, i) => (
                  <ChatMessageComponent key={i} message={msg} streaming={streaming && i === chatMessages.length - 1 && msg.role === "assistant"} />
                ))}
              </AnimatePresence>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Sticky Input Area */}
          <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent pt-12 pb-8 px-6">
            <div className="max-w-[800px] mx-auto relative">
              <div className="relative flex items-end gap-3 rounded-[12px] bg-zinc-900 border border-zinc-800 p-2 shadow-2xl focus-within:border-zinc-700 transition-colors">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleChat(); } }}
                  placeholder={`Ask a question about ${activeDoc.filename}...`}
                  disabled={streaming}
                  className="flex-1 bg-transparent px-4 py-3 text-[14px] leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-500 resize-none min-h-[48px] max-h-[200px]"
                />
                <button 
                  onClick={() => void handleChat()} 
                  disabled={!chatInput.trim() || streaming} 
                  className="mb-1 mr-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[8px] bg-white text-black transition-opacity disabled:opacity-30 disabled:bg-zinc-800 disabled:text-zinc-500"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </SiteChrome>
    );
  }

  return (
    <SiteChrome>
      <div className="space-y-10">
        <div>
          <h1 className="text-3xl font-600 tracking-tight text-white mb-2">Research Library</h1>
          <p className="text-[15px] text-zinc-400">Upload documents for semantic RAG analysis.</p>
        </div>

        {/* Upload Zone */}
        <div className="max-w-[800px]">
          <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.csv,.xlsx,.xls,.txt" onChange={handleFileInput} />
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-4 rounded-[16px] border border-dashed p-12 cursor-pointer transition-colors ${dragOver ? "border-emerald-500/50 bg-emerald-500/5" : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 hover:bg-zinc-900/50"}`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-zinc-900 border border-zinc-800">
              {uploading ? (
                <div className="h-4 w-4 rounded-full border-2 border-zinc-600 border-t-zinc-200 animate-spin" />
              ) : (
                <Upload size={20} className="text-zinc-400" />
              )}
            </div>
            <div className="text-center">
              <p className="text-[15px] font-500 text-zinc-100 mb-1">{uploading ? "Indexing Document..." : "Click or drag to upload"}</p>
              <p className="text-[13px] text-zinc-500">Supports PDF, CSV, TXT files up to 50MB</p>
            </div>
          </div>
        </div>

        {/* Document List */}
        <div className="max-w-[800px] mt-12">
          <h2 className="text-[16px] font-500 text-zinc-100 mb-6">Indexed Documents ({docs.length})</h2>
          
          <div className="grid gap-3">
            {isLoading && Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-[12px] bg-zinc-900/50 animate-pulse border border-zinc-800/50" />)}
            
            <AnimatePresence>
              {docs.map((doc) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="group surface flex items-center gap-4 p-4 cursor-pointer transition-all hover:border-zinc-700 hover:bg-zinc-900/50"
                  onClick={() => setActiveDoc(doc)}
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[8px] bg-zinc-900 border border-zinc-800">
                    <FileText size={18} className="text-zinc-400" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-500 text-zinc-100 truncate mb-1">{doc.filename}</div>
                    <div className="flex items-center gap-3 text-[12px] text-zinc-500">
                      <span>{formatSize(doc.file_size)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1.5">
                        {doc.processed ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Clock size={12} className="text-amber-500" />}
                        {doc.processed ? `${doc.chunk_count} chunks indexed` : "Indexing..."}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(doc); }}
                    className="opacity-0 group-hover:opacity-100 p-2 rounded-[6px] hover:bg-zinc-800 transition-all text-zinc-500 hover:text-red-400"
                    title="Delete document"
                  >
                    <Trash2 size={16} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {docs.length === 0 && !isLoading && (
              <div className="text-center py-12 border border-zinc-800 border-dashed rounded-[12px] bg-zinc-900/20">
                <p className="text-[14px] text-zinc-500">No documents in your library.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </SiteChrome>
  );
}
