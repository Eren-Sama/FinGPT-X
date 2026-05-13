import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "sonner";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FinGPT X — Private Financial Intelligence",
  description: "Institutional-grade AI financial research. Local-first. Offline-capable. Powered by Ollama.",
  keywords: ["finance", "AI", "trading", "research", "portfolio", "local AI"],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <QueryProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#111111",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#EDEDED",
                boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
                fontSize: "13px",
              },
            }}
          />
        </QueryProvider>
      </body>
    </html>
  );
}
