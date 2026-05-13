"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  MessageSquareQuote,
  BriefcaseBusiness,
  Files,
  Search,
  Settings2,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHealth } from "@/lib/queries";

const NAV_ITEMS = [
  { href: "/dashboard",  label: "Markets" },
  { href: "/research",   label: "Research" },
  { href: "/portfolio",  label: "Portfolio" },
  { href: "/documents",  label: "Documents" },
  { href: "/reports",    label: "Reports" },
];

function TopNav() {
  const pathname = usePathname();
  const { data: health } = useHealth();
  const ollamaOnline = health?.ollama?.status === "connected";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-6">
        <div className="flex items-center gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-[4px] bg-white text-black font-700 text-[11px] tracking-tight">
              FX
            </div>
            <span className="text-[14px] font-600 tracking-tight text-white hidden sm:block">
              FinGPT
            </span>
          </Link>

          {/* Nav Links */}
          <nav className="flex items-center gap-6">
            {NAV_ITEMS.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "text-[13px] transition-colors relative py-4",
                    active ? "text-zinc-50 font-500" : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  {label}
                  {active && (
                    <motion.div
                      layoutId="active-nav-indicator"
                      className="absolute bottom-[-1px] left-0 h-[2px] w-full bg-white"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side (Search, Settings, Status) */}
        <div className="flex items-center gap-4">
          <Link href="/search" className="hidden sm:flex items-center gap-2 rounded-[6px] border border-zinc-800 bg-zinc-900/50 px-2 py-1 transition-colors hover:bg-zinc-800">
            <Search size={14} className="text-zinc-400" />
            <span className="text-[12px] text-zinc-400 mr-2">Search...</span>
            <kbd className="text-[10px] rounded-[4px] border border-zinc-700 px-1.5 font-mono text-zinc-400">⌘K</kbd>
          </Link>
          
          <Link href="/search" className="sm:hidden text-zinc-400 hover:text-zinc-100 p-1">
            <Search size={16} />
          </Link>

          <div className="h-4 w-px bg-zinc-800" />

          <Link href="/settings" className="text-zinc-400 hover:text-zinc-100 p-1 transition-colors" title="Settings">
            <Settings2 size={16} />
          </Link>

          <div className="flex items-center gap-1.5" title={ollamaOnline ? "Engine Ready" : "Engine Offline"}>
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-40 ${ollamaOnline ? "bg-emerald-400" : "bg-red-400"}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${ollamaOnline ? "bg-emerald-500" : "bg-red-500"}`} />
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-zinc-800 selection:text-white">
      <TopNav />
      {/* 
        Removed all explicit pl-[], pt-[], h-[calc...] and overflow-hidden wrappers. 
        The layout is now entirely driven by natural document flow and centered max-w containers, 
        giving immense breathing room and eliminating overlap clipping bugs.
      */}
      <main className="mx-auto w-full max-w-[1200px] px-6 py-12">
        {children}
      </main>
    </div>
  );
}
