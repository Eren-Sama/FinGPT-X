import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import type { Holding } from "./types";

// ── Health ──────────────────────────────────────────────────────────
export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: api.getHealth,
    staleTime: 15_000,
    retry: 1,
  });
}

// ── Settings ─────────────────────────────────────────────────────────
export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: api.getAppSettings,
    staleTime: 60_000,
  });
}

// ── Market ──────────────────────────────────────────────────────────
export function useMarketSymbols() {
  return useQuery({
    queryKey: ["market", "symbols"],
    queryFn: api.getMarketSymbols,
    staleTime: 60_000,
  });
}

export function useMarketQuote(symbol: string | null) {
  return useQuery({
    queryKey: ["market", "quote", symbol],
    queryFn: () => api.getMarketQuote(symbol!),
    enabled: !!symbol,
    staleTime: 20_000,
  });
}

export function useBulkQuotes(symbols: string[]) {
  return useQuery({
    queryKey: ["market", "bulk-quotes", symbols.join(",")],
    queryFn: () => api.getBulkQuotes(symbols),
    enabled: symbols.length > 0,
    staleTime: 60_000,
  });
}

export function useMarketHistory(symbol: string | null, period = "3mo") {
  return useQuery({
    queryKey: ["market", "history", symbol, period],
    queryFn: () => api.getMarketHistory(symbol!, period),
    enabled: !!symbol,
    staleTime: 30_000,
  });
}

export function useMarketCategories() {
  return useQuery({
    queryKey: ["market", "categories"],
    queryFn: api.getMarketCategories,
    staleTime: Infinity,  // static data — never stale
  });
}

export function useSymbolSearch(query: string) {
  return useQuery({
    queryKey: ["market", "search", query],
    queryFn: () => api.searchMarketSymbols(query),
    enabled: query.length >= 1,
    staleTime: 30_000,
  });
}

// ── Watchlist ───────────────────────────────────────────────────────
export function useWatchlist(userId = 0) {
  return useQuery({
    queryKey: ["watchlist", userId],
    queryFn: () => api.getWatchlist(userId),
    staleTime: 15_000,
  });
}

export function useAddWatchlistItem(userId = 0) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (symbol: string) => api.addWatchlistItem(symbol, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist", userId] }),
  });
}

export function useRemoveWatchlistItem(userId = 0) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) => api.removeWatchlistItem(itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist", userId] }),
  });
}

// ── Portfolio ───────────────────────────────────────────────────────
export function usePortfolio(userId = 0) {
  return useQuery({
    queryKey: ["portfolio", userId],
    queryFn: () => api.getPortfolio(userId),
    staleTime: 15_000,
  });
}

export function useAddHolding(userId = 0) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<Holding, "id" | "added_at">) =>
      api.addHolding(body.symbol, body.quantity, body.avg_price, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio", userId] }),
  });
}

export function useDeleteHolding(userId = 0) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (holdingId: number) => api.deleteHolding(holdingId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio", userId] }),
  });
}

// ── Chat Sessions ───────────────────────────────────────────────────
export function useChatSessions(userId = 0) {
  return useQuery({
    queryKey: ["chat", "sessions", userId],
    queryFn: () => api.getChatSessions(userId),
    staleTime: 10_000,
  });
}

export function useSessionMessages(sessionId: string | null) {
  return useQuery({
    queryKey: ["chat", "session", sessionId],
    queryFn: () => api.getSessionMessages(sessionId!),
    enabled: !!sessionId,
    staleTime: 0,
  });
}

export function useDeleteSession(userId = 0) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => api.deleteSession(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat", "sessions", userId] }),
  });
}

// ── Documents ───────────────────────────────────────────────────────
export function useDocuments(userId = 0) {
  return useQuery({
    queryKey: ["documents", userId],
    queryFn: () => api.getDocuments(userId),
    staleTime: 15_000,
  });
}

export function useDeleteDocument(userId = 0) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ docId }: { docId: number }) => api.deleteDocument(docId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents", userId] }),
  });
}

// ── Reports ─────────────────────────────────────────────────────────
export function useReports(userId = 0) {
  return useQuery({
    queryKey: ["reports", userId],
    queryFn: () => api.getReports(userId),
    staleTime: 10_000,
  });
}

export function useDeleteReport(userId = 0) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reportId: number) => api.deleteReport(reportId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports", userId] }),
  });
}

