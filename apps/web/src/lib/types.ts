// All API response type definitions

export interface HealthResponse {
  status: string;
  version: string;
  mode: string;
  ollama: {
    status: "connected" | "disconnected";
    models: string[];
    active_model: string | null;
    embed_model?: string;
    error?: string;
  };
  database: {
    symbols: number;
    market_data_points: number;
    documents: number;
    chat_sessions: number;
    holdings: number;
  };
}

export interface MarketQuote {
  symbol: string;
  price: number;
  previous_close: number;
  change: number;
  change_percent: number;
  high: number;
  low: number;
  volume: number;
  date: string;
  error?: string;
}

export interface MarketHistoryPoint {
  time: number; // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketSymbol {
  symbol: string;
  data_points: number;
  from_date: string;
  to_date: string;
}

export interface SearchResult {
  symbol: string;
  name: string;
  sector: string;
}

export interface Holding {
  id: number;
  symbol: string;
  quantity: number;
  avg_price: number;
  added_at: string;
}

export interface Portfolio {
  id: number;
  name: string;
  holdings: Holding[];
}

export interface WatchlistItem {
  id: number;
  symbol: string;
  notes: string | null;
  added_at: string;
}

export interface Watchlist {
  id: number;
  name: string;
  items: WatchlistItem[];
}

export interface DocumentRow {
  id: number;
  filename: string;
  file_type: string;
  file_size: number;
  chunk_count: number;
  processed: boolean;
  uploaded_at: string;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ChatMessage {
  id?: number;
  role: "user" | "assistant";
  content: string;
  sources?: string | null;
  created_at?: string;
}

export interface SessionDetail {
  id: string;
  title: string;
  messages: ChatMessage[];
}

export interface Report {
  id: number;
  title: string;
  report_type: string;
  subject: string;
  content: string;
  created_at: string;
}

export interface ReportCreate {
  report_type: string;
  subject: string;
  context?: string;
  user_id?: number;
}

export interface LiveQuote {
  symbol: string;
  name: string;
  category: string;       // "US" | "India" | "Crypto" | "Commodity" | "Index" | "Stock"
  currency: string;       // "USD" | "INR" | etc.
  price: number;
  previous_close: number;
  change: number;
  change_percent: number;
  high: number;
  low: number;
  volume: number;
}
