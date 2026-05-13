"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import { motion } from "framer-motion";
import type { Components } from "react-markdown";
import type { ChatMessage as ChatMessageType } from "@/lib/types";
import { CitationBadge, SourcesPanel, parseCitations } from "./citation";
import type { Source } from "./citation";

interface ChatMessageProps {
  message: ChatMessageType;
  streaming?: boolean;
  sources?: Source[];
}

// ─── Inline-citation-aware paragraph renderer ────────────────────────────────
function buildComponents(sources: Source[]): Components {
  const withCitations = (children: React.ReactNode): React.ReactNode => {
    if (!sources.length || typeof children !== "string") return children;
    return parseCitations(children, sources);
  };

  return {
    p({ children }) {
      return (
        <p>
          {Array.isArray(children)
            ? children.map((child, i) =>
                typeof child === "string"
                  ? parseCitations(child, sources).map((node, j) => (
                      <span key={`${i}-${j}`}>{node}</span>
                    ))
                  : child
              )
            : withCitations(children)}
        </p>
      );
    },
    li({ children }) {
      return (
        <li>
          {Array.isArray(children)
            ? children.map((child, i) =>
                typeof child === "string"
                  ? parseCitations(child, sources).map((node, j) => (
                      <span key={`${i}-${j}`}>{node}</span>
                    ))
                  : child
              )
            : withCitations(children)}
        </li>
      );
    },
  };
}

export function ChatMessage({ message, streaming, sources = [] }: ChatMessageProps) {
  const isUser = message.role === "user";

  // Parse sources from message.sources JSON string (for loaded history)
  const resolvedSources: Source[] =
    sources.length > 0
      ? sources
      : (() => {
          if (!message.sources) return [];
          try {
            return JSON.parse(message.sources) as Source[];
          } catch {
            return [];
          }
        })();

  const hasSources = resolvedSources.length > 0;
  const components = buildComponents(resolvedSources);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-6`}
    >
      <div className={`max-w-[85%] min-w-0 flex flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
        {/* Author Label */}
        <div className="flex items-center gap-2 px-1">
          <span className="text-[11px] font-500 text-[#555555]">
            {isUser ? "You" : "FinGPT"}
          </span>
          {hasSources && !isUser && (
            <span className="text-[10px] font-500 text-blue-500/60 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full">
              {resolvedSources.length} source{resolvedSources.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Bubble */}
        {isUser ? (
          <div className="rounded-[12px] rounded-tr-[4px] bg-[#222222] border border-[#333333] px-4 py-2.5 text-[14px] text-[#EDEDED] leading-relaxed">
            {message.content}
          </div>
        ) : (
          <div className="w-full text-[14px] leading-7 text-[#EDEDED]">
            <div
              className="prose prose-invert prose-sm max-w-none
              [&_pre]:bg-[#0A0A0A] [&_pre]:border [&_pre]:border-[#222222] [&_pre]:rounded-[8px] [&_pre]:overflow-x-auto [&_pre]:p-4 [&_pre]:my-4
              [&_code]:text-[13px] [&_code]:font-mono [&_code]:text-[#EDEDED]
              [&_p]:leading-7 [&_p]:my-2
              [&_ul]:my-2 [&_ol]:my-2
              [&_li]:my-0.5
              [&_strong]:text-white [&_strong]:font-500
              [&_a]:text-[#EDEDED] [&_a]:underline [&_a]:decoration-[#555555] [&_a]:underline-offset-2
              [&_blockquote]:border-l-2 [&_blockquote]:border-[#333333] [&_blockquote]:pl-4 [&_blockquote]:text-[#888888]
              [&_h1]:text-[16px] [&_h2]:text-[15px] [&_h3]:text-[14px] [&_h1]:font-500 [&_h2]:font-500 [&_h3]:font-500 [&_h1]:text-white [&_h2]:text-white
              [&_table]:text-[13px] [&_th]:text-[#888888] [&_th]:font-500 [&_th]:border-b [&_th]:border-[#222222]
              [&_td]:border-b [&_td]:border-[#111111]
              [&_hr]:border-[#222222]"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight, rehypeRaw]}
                components={hasSources ? components : undefined}
              >
                {message.content}
              </ReactMarkdown>
              {streaming && <span className="cursor-blink" />}
            </div>

            {/* Perplexity-style sources panel */}
            {hasSources && !streaming && (
              <SourcesPanel sources={resolvedSources} />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
