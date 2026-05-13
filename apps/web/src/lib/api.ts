import type {
  ChatMessage,
  ChatSession,
  DocumentRow,
  HealthResponse,
  MarketHistoryPoint,
  MarketQuote,
  MarketSymbol,
  Portfolio,
  SearchResult,
  SessionDetail,
  Watchlist,
} from "./types";

const API_ROOT = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

// ── Health ──────────────────────────────────────────────────────────
export async function getHealth(): Promise<HealthResponse> {
  return requestJson<HealthResponse>("/api/health");
}

// ── Settings ─────────────────────────────────────────────────────────
export async function getAppSettings(): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>("/api/settings/");
}

export async function patchSettings(body: {
  ollama_base_url?: string;
  ollama_model?: string;
  ollama_embed_model?: string;
  debug?: boolean;
}): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>("/api/settings/", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// ── Market ──────────────────────────────────────────────────────────
export async function getMarketQuote(symbol: string): Promise<MarketQuote> {
  return requestJson<MarketQuote>(`/api/market/quote/${encodeURIComponent(symbol)}`);
}

export async function getBulkQuotes(symbols: string[]): Promise<Record<string, MarketQuote>> {
  if (symbols.length === 0) return {};
  const query = symbols.map(s => encodeURIComponent(s)).join(",");
  const resp = await requestJson<{ quotes: Record<string, MarketQuote> }>(`/api/market/quote?symbols=${query}`);
  return resp.quotes;
}

export async function getMarketHistory(symbol: string, period = "3mo"): Promise<MarketHistoryPoint[]> {
  const response = await requestJson<{ data: MarketHistoryPoint[] }>(
    `/api/market/history/${encodeURIComponent(symbol)}?period=${encodeURIComponent(period)}`,
  );
  return response.data;
}

export async function getMarketSymbols(): Promise<MarketSymbol[]> {
  return requestJson<MarketSymbol[]>("/api/market/symbols");
}

export async function searchMarketSymbols(query: string): Promise<SearchResult[]> {
  const response = await requestJson<{ results: SearchResult[] }>(
    `/api/market/search?q=${encodeURIComponent(query)}`,
  );
  return response.results;
}

export async function getMarketCategories(): Promise<Record<string, { symbol: string; name: string; currency: string; category: string }[]>> {
  const resp = await requestJson<{ categories: Record<string, { symbol: string; name: string; currency: string; category: string }[]> }>("/api/market/categories");
  return resp.categories;
}

// ── Watchlist ───────────────────────────────────────────────────────
export async function getWatchlist(userId = 0): Promise<Watchlist> {
  return requestJson<Watchlist>(`/api/watchlist/?user_id=${userId}`);
}

export async function addWatchlistItem(symbol: string, userId = 0): Promise<WatchlistItem> {
  return requestJson<WatchlistItem>(`/api/watchlist/items?user_id=${userId}`, {
    method: "POST",
    body: JSON.stringify({ symbol }),
  });
}

export async function removeWatchlistItem(itemId: number): Promise<void> {
  await requestJson<void>(`/api/watchlist/items/${itemId}`, { method: "DELETE" });
}

// ── Portfolio ───────────────────────────────────────────────────────
export async function getPortfolio(userId = 0): Promise<Portfolio> {
  return requestJson<Portfolio>(`/api/portfolio/?user_id=${userId}`);
}

export async function addHolding(
  symbol: string,
  quantity: number,
  avgPrice: number,
  userId = 0,
): Promise<{ id: number; symbol: string; quantity: number; avg_price: number }> {
  return requestJson(`/api/portfolio/holdings?user_id=${userId}`, {
    method: "POST",
    body: JSON.stringify({ symbol, quantity, avg_price: avgPrice }),
  });
}

export async function deleteHolding(holdingId: number): Promise<void> {
  await requestJson<void>(`/api/portfolio/holdings/${holdingId}`, { method: "DELETE" });
}

export async function updateHolding(
  holdingId: number,
  quantity?: number,
  avgPrice?: number,
): Promise<void> {
  await requestJson<void>(`/api/portfolio/holdings/${holdingId}`, {
    method: "PUT",
    body: JSON.stringify({
      ...(quantity !== undefined && { quantity }),
      ...(avgPrice !== undefined && { avg_price: avgPrice }),
    }),
  });
}

// ── Documents ───────────────────────────────────────────────────────
export async function getDocuments(userId = 0): Promise<DocumentRow[]> {
  return requestJson<DocumentRow[]>(`/api/documents/?user_id=${userId}`);
}

export async function uploadDocument(file: File, userId = 0) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("user_id", String(userId));
  return requestJson<Record<string, unknown>>("/api/documents/upload", {
    method: "POST",
    body: formData,
  });
}

export async function deleteDocument(docId: number, userId = 0): Promise<void> {
  await requestJson<void>(`/api/documents/${docId}?user_id=${userId}`, { method: "DELETE" });
}

export async function searchDocuments(query: string, documentId?: number, topK = 5, userId = 0) {
  return requestJson<{ query: string; results: Array<Record<string, unknown>> }>(
    "/api/documents/search",
    {
      method: "POST",
      body: JSON.stringify({ query, document_id: documentId ?? null, top_k: topK, user_id: userId }),
    },
  );
}

// ── Chat Sessions ───────────────────────────────────────────────────
export async function getChatSessions(userId = 0): Promise<ChatSession[]> {
  return requestJson<ChatSession[]>(`/api/chat/sessions?user_id=${userId}`);
}

export async function getSessionMessages(sessionId: string): Promise<SessionDetail> {
  return requestJson<SessionDetail>(`/api/chat/sessions/${sessionId}`);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await requestJson<void>(`/api/chat/sessions/${sessionId}`, { method: "DELETE" });
}

// ── Streaming Chat ──────────────────────────────────────────────────
export async function streamChat(
  path: string,
  payload: {
    message: string;
    history: ChatMessage[];
    session_id?: string;
    user_id?: number;
    document_id?: number;
  },
  onToken: (token: string) => void,
  onSessionId?: (id: string) => void,
): Promise<void> {
  const response = await fetch(`${API_ROOT}${path}`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Streaming failed: ${response.status}`);
  }

  // Capture session ID from response header
  const sessionId = response.headers.get("X-Session-Id");
  if (sessionId && onSessionId) onSessionId(sessionId);

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
      if (raw === "[DONE]") return;
      try {
        const parsed = JSON.parse(raw) as { token?: string };
        if (parsed.token) onToken(parsed.token);
      } catch {
        // ignore malformed
      }
    }
  }
}

// ── CSV Import ──────────────────────────────────────────────────────
export async function importCsv(file: File, symbol: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("symbol", symbol);
  return requestJson<Record<string, unknown>>("/api/market/import/csv", {
    method: "POST",
    body: formData,
  });
}

export async function bulkImportCsv() {
  return requestJson<Record<string, unknown>>("/api/market/import/bulk", { method: "POST" });
}

// ── Voice AI ────────────────────────────────────────────────────────
export async function streamVoiceQuery(
  transcript: string,
  history: ChatMessage[],
  onToken: (token: string) => void,
): Promise<void> {
  return streamChat(
    "/api/voice/query",
    { message: transcript, history, session_id: "voice", user_id: 0 },
    onToken,
  );
}

// ── Reports ─────────────────────────────────────────────────────────
export async function getReports(userId = 0): Promise<import("./types").Report[]> {
  return requestJson(`/api/reports/?user_id=${userId}`);
}

export async function deleteReport(reportId: number): Promise<void> {
  await requestJson<void>(`/api/reports/${reportId}`, { method: "DELETE" });
}

export function getReportExportUrl(reportId: number, format: "markdown" | "pdf"): string {
  return `/api/reports/${reportId}/export/${format}`;
}

// Re-export missing type for external use
import type { WatchlistItem } from "./types";

