"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Sparkles, MessageSquareQuote, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { SiteChrome } from "@/components/site-chrome";
import { ChatMessage as ChatMessageComponent } from "@/components/chat-message";
import { VoiceAssistant } from "@/components/voice-assistant";
import { getChatSessions, deleteSession } from "@/lib/api";
import type { ChatMessage, ChatSession } from "@/lib/types";

const STARTER_PROMPTS = [
  "Summarize TSLA's latest earnings",
  "Explain quantitative easing",
  "Compare AAPL and MSFT revenue",
  "What are the risks of rising interest rates?",
];

function ResearchContent() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // Load session history
  const loadSessions = useCallback(async () => {
    try {
      const data = await getChatSessions(0);
      setSessions(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  // Load selected session messages
  useEffect(() => {
    if (!sessionId) return;
    const fetchMessages = async () => {
      try {
        const { getSessionMessages } = await import("@/lib/api");
        const detail = await getSessionMessages(sessionId);
        setMessages(detail.messages || []);
      } catch (err) {
        console.error("Failed to load session messages", err);
      }
    };
    void fetchMessages();
  }, [sessionId]);

  // Auto-resize textarea
  const adjustTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, []);

  const handleSubmit = useCallback(async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || streaming) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsg: ChatMessage = { role: "user", content: message };
    setMessages((p) => [...p, userMsg]);
    setStreaming(true);
    setMessages((p) => [...p, { role: "assistant", content: "" }]);

    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${API_BASE}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: messages.slice(-10),
          session_id: sessionId,
          user_id: 0,
        }),
      });

      // Capture session ID from response header
      const newSid = response.headers.get("X-Session-Id");
      if (newSid) setSessionId(newSid);

      if (!response.body) throw new Error("No response body");

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

          try {
            const parsed = JSON.parse(raw) as {
              token?: string;
              done?: boolean;
              sources?: import("@/components/citation").Source[];
            };

            if (parsed.token) {
              setMessages((p) => {
                const last = p[p.length - 1];
                if (last?.role !== "assistant") return p;
                return [...p.slice(0, -1), { ...last, content: last.content + parsed.token }];
              });
            }

            if (parsed.done) {
              const srcs = parsed.sources ?? [];
              if (srcs.length > 0) {
                // Attach sources JSON to the assistant message so ChatMessage can render badges
                setMessages((p) => {
                  const last = p[p.length - 1];
                  if (last?.role !== "assistant") return p;
                  return [
                    ...p.slice(0, -1),
                    { ...last, sources: JSON.stringify(srcs) },
                  ];
                });
              }
            }
          } catch { /* ignore */ }
        }
      }
    } catch {
      setMessages((p) => p.slice(0, -1));
    } finally {
      setStreaming(false);
      void loadSessions();
    }
  }, [input, streaming, messages, sessionId, loadSessions]);

  const hasAutoFired = useRef(false);
  useEffect(() => {
    const q = searchParams?.get("q");
    if (q && !hasAutoFired.current) {
      hasAutoFired.current = true;
      // If it's a short ticker like "btc", format it nicely. Otherwise use the exact query.
      const prompt = q.length <= 10 && !q.includes(" ") ? `What is ${q.toUpperCase()}?` : q;
      setTimeout(() => void handleSubmit(prompt), 100);
    }
  }, [searchParams, handleSubmit]);

  const handleVoiceTranscript = useCallback((text: string) => {
    setInput(text);
  }, []);

  const handleVoiceResponse = useCallback((text: string) => {
    const userMsg = input.trim() || "Voice query";
    setMessages((p) => [
      ...p,
      { role: "user", content: userMsg },
      { role: "assistant", content: text },
    ]);
    setInput("");
  }, [input]);

  const newChat = useCallback(() => {
    setMessages([]);
    setSessionId("");
    setShowSessions(false);
  }, []);

  const handleDeleteSession = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteSession(id);
    await loadSessions();
    if (id === sessionId) newChat();
  }, [sessionId, newChat, loadSessions]);

  return (
    <SiteChrome>
      <div className="flex w-full gap-0 -mt-12 min-h-[calc(100vh-56px)]">

        {/* Session Sidebar */}
        <AnimatePresence>
          {showSessions && (
            <motion.aside
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              className="hidden lg:flex flex-col w-64 shrink-0 border-r border-zinc-800/60 bg-zinc-950 pr-4 pt-8 pb-4 mr-6"
            >
              <div className="flex items-center justify-between mb-5">
                <span className="text-[12px] font-medium uppercase tracking-wider text-zinc-500">Sessions</span>
                <button
                  onClick={newChat}
                  className="flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-white transition-colors"
                >
                  <Plus size={14} /> New
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1">
                {sessions.length === 0 && (
                  <p className="text-[12px] text-zinc-600 py-4">No sessions yet</p>
                )}
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => { setSessionId(s.id); setShowSessions(false); }}
                    className={`group flex items-center justify-between rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${s.id === sessionId ? "bg-zinc-800/60" : "hover:bg-zinc-800/40"}`}
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] text-zinc-200 truncate">{s.title}</div>
                      <div className="text-[11px] text-zinc-600 mt-0.5">{s.message_count} messages</div>
                    </div>
                    <button
                      onClick={(e) => void handleDeleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-500 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Chat Column */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="w-full max-w-[760px] mx-auto flex flex-col relative pb-32">

            {/* Header row */}
            <div className="flex items-center justify-between pt-8 pb-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSessions(!showSessions)}
                  className="flex items-center gap-2 text-[13px] text-zinc-400 hover:text-white transition-colors"
                >
                  <MessageSquareQuote size={16} />
                  <span className="hidden sm:inline">Sessions</span>
                  {sessions.length > 0 && (
                    <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full">{sessions.length}</span>
                  )}
                </button>
              </div>
              <VoiceAssistant
                messages={messages}
                onTranscript={handleVoiceTranscript}
                onResponse={handleVoiceResponse}
              />
            </div>

            {/* Empty State */}
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center pt-20 pb-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-black mb-8 shadow-2xl shadow-white/5">
                  <Sparkles size={28} />
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-white mb-3">
                  How can I help you today?
                </h1>
                <p className="text-[15px] text-zinc-500 max-w-md leading-relaxed mb-12">
                  Ask about market trends, analyze assets, or query your uploaded documents. Or use the voice button above to speak your query.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => void handleSubmit(prompt)}
                      className="rounded-xl border border-zinc-800 bg-zinc-900/30 text-left p-4 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all"
                    >
                      <span className="text-[14px] text-zinc-300 font-medium">{prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 space-y-6 pt-2">
                <AnimatePresence initial={false}>
                  {messages.map((msg, i) => (
                    <ChatMessageComponent
                      key={i}
                      message={msg}
                      streaming={streaming && i === messages.length - 1 && msg.role === "assistant"}
                    />
                  ))}
                </AnimatePresence>
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Sticky Input */}
          <div className="sticky bottom-0 w-full bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent pt-10 pb-6 px-4 sm:px-6 pointer-events-none mt-auto">
            <div className="max-w-[760px] mx-auto pointer-events-auto">
              <div className="relative flex items-end gap-3 rounded-2xl bg-zinc-900 border border-zinc-800 p-2 shadow-2xl focus-within:border-zinc-700 transition-colors">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); adjustTextarea(); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSubmit();
                    }
                  }}
                  placeholder="Ask anything… or press the mic to speak"
                  disabled={streaming}
                  rows={1}
                  className="flex-1 bg-transparent px-4 py-3 text-[15px] leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-500 resize-none min-h-[50px] max-h-[200px]"
                />
                <button
                  onClick={() => void handleSubmit()}
                  disabled={!input.trim() || streaming}
                  className="mb-1.5 mr-1.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white text-black transition-opacity disabled:opacity-25 disabled:bg-zinc-800 disabled:text-zinc-500"
                >
                  <Send size={16} />
                </button>
              </div>
              <div className="text-center mt-2.5 text-[12px] text-zinc-700">
                FinGPT runs locally on Ollama · No data leaves your machine
              </div>
            </div>
          </div>
        </div>
      </div>
    </SiteChrome>
  );
}

export default function ResearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center">Loading...</div>}>
      <ResearchContent />
    </Suspense>
  );
}
