"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from "lucide-react";
import { streamChat } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";

type VoiceState = "idle" | "listening" | "processing" | "speaking";

interface VoiceAssistantProps {
  onTranscript?: (text: string) => void;
  onResponse?: (text: string) => void;
  messages?: ChatMessage[];
}

// Check browser support
const hasSTT = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
const hasTTS = typeof window !== "undefined" && "speechSynthesis" in window;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;

export function VoiceAssistant({ onTranscript, onResponse, messages = [] }: VoiceAssistantProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [supported] = useState(hasSTT);

  const recognitionRef = useRef<AnySpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const streamingTextRef = useRef("");

  const speak = useCallback((text: string) => {
    if (!hasTTS || isMuted) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    // Prefer a natural voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Natural")
    );
    if (preferred) utterance.voice = preferred;
    utterance.onend = () => setState("idle");
    synthRef.current = utterance;
    setState("speaking");
    window.speechSynthesis.speak(utterance);
  }, [isMuted]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setState("idle");
  }, []);

  const processTranscript = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setState("processing");
    setTranscript(text);
    if (onTranscript) onTranscript(text);

    streamingTextRef.current = "";

    try {
      await streamChat(
        "/api/voice/query",
        {
          message: text,
          history: messages.slice(-6),
          session_id: "voice",
          user_id: 0,
        } as any,
        (token) => {
          streamingTextRef.current += token;
        },
      );

      const fullResponse = streamingTextRef.current;
      if (onResponse) onResponse(fullResponse);
      speak(fullResponse);
    } catch {
      setState("idle");
    }
  }, [messages, onTranscript, onResponse, speak]);

  const startListening = useCallback(() => {
    if (!supported) return;
    stopSpeaking();

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognitionClass() as AnySpeechRecognition;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => setState("listening");

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      void processTranscript(text);
    };

    recognition.onerror = () => setState("idle");
    recognition.onend = () => {
      if (state === "listening") setState("idle");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [supported, stopSpeaking, processTranscript, state]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setState("idle");
  }, []);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClick = useCallback(() => {
    if (state === "idle") startListening();
    else if (state === "listening") stopListening();
    else if (state === "speaking") stopSpeaking();
  }, [state, startListening, stopListening, stopSpeaking]);

  if (!mounted || !supported) return null;

  const iconMap: Record<VoiceState, React.ReactNode> = {
    idle: <Mic size={20} />,
    listening: <MicOff size={20} className="animate-pulse" />,
    processing: <Loader2 size={20} className="animate-spin" />,
    speaking: <Volume2 size={20} className="animate-pulse" />,
  };

  const labelMap: Record<VoiceState, string> = {
    idle: "Voice",
    listening: "Listening…",
    processing: "Thinking…",
    speaking: "Speaking…",
  };

  const colorMap: Record<VoiceState, string> = {
    idle: "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700",
    listening: "bg-red-500/20 border-red-500/60 text-red-400",
    processing: "bg-amber-500/10 border-amber-500/40 text-amber-400",
    speaking: "bg-emerald-500/10 border-emerald-500/40 text-emerald-400",
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        title={labelMap[state]}
        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-medium transition-all ${colorMap[state]}`}
      >
        {iconMap[state]}
        <span className="hidden sm:inline">{labelMap[state]}</span>
      </button>

      {hasTTS && (
        <button
          onClick={() => {
            setIsMuted(!isMuted);
            if (!isMuted) stopSpeaking();
          }}
          title={isMuted ? "Unmute voice" : "Mute voice"}
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-all"
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      )}

      {transcript && state !== "idle" && (
        <span className="text-[12px] text-zinc-500 max-w-[200px] truncate hidden md:inline">
          &ldquo;{transcript}&rdquo;
        </span>
      )}
    </div>
  );
}
