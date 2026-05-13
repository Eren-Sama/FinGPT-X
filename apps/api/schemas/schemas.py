"""Pydantic schemas — request & response validation."""

from datetime import datetime
from pydantic import BaseModel, Field


# ── Chat ──────────────────────────────────────────────────────────────────────

class ChatMessageSchema(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    session_id: str = ""
    history: list[ChatMessageSchema] = []
    user_id: int = 0
    document_id: int | None = None


class ChatSessionOut(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int = 0


class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    sources: str | None = None
    created_at: str


# ── Portfolio ─────────────────────────────────────────────────────────────────

class HoldingCreate(BaseModel):
    symbol: str
    quantity: float = Field(gt=0)
    avg_price: float = Field(gt=0)


class HoldingUpdate(BaseModel):
    quantity: float | None = Field(default=None, gt=0)
    avg_price: float | None = Field(default=None, gt=0)


class HoldingOut(BaseModel):
    id: int
    symbol: str
    quantity: float
    avg_price: float
    added_at: str


class PortfolioOut(BaseModel):
    id: int
    name: str
    holdings: list[HoldingOut]


# ── Watchlist ─────────────────────────────────────────────────────────────────

class WatchlistItemCreate(BaseModel):
    symbol: str
    notes: str | None = None


class WatchlistItemOut(BaseModel):
    id: int
    symbol: str
    notes: str | None = None
    added_at: str


class WatchlistOut(BaseModel):
    id: int
    name: str
    items: list[WatchlistItemOut]


# ── Market Data ───────────────────────────────────────────────────────────────

class MarketDataPoint(BaseModel):
    time: int  # Unix timestamp
    open: float
    high: float
    low: float
    close: float
    volume: int


class QuoteOut(BaseModel):
    symbol: str
    price: float
    previous_close: float
    change: float
    change_percent: float
    high: float
    low: float
    volume: int
    date: str


class AssetProfileOut(BaseModel):
    symbol: str
    name: str
    sector: str
    industry: str
    market_cap: float
    description: str


class AssetSearchResult(BaseModel):
    symbol: str
    name: str
    sector: str


# ── Documents ─────────────────────────────────────────────────────────────────

class DocumentOut(BaseModel):
    id: int
    filename: str
    file_type: str
    file_size: int
    chunk_count: int
    processed: bool
    uploaded_at: str


class DocumentSearchRequest(BaseModel):
    query: str
    document_id: int | None = None
    user_id: int = 0
    top_k: int = 5


class DocumentChatRequest(BaseModel):
    message: str
    document_id: int
    session_id: str = ""
    history: list[ChatMessageSchema] = []
    user_id: int = 0


# ── Reports ───────────────────────────────────────────────────────────────────

REPORT_TYPES_ALLOWED = [
    "company_analysis",
    "investment_summary",
    "portfolio_report",
    "risk_report",
    "market_insights",
]


class ReportCreate(BaseModel):
    report_type: str = "company_analysis"
    subject: str                        # e.g. "Apple Inc (AAPL)"
    context: str | None = None          # Optional extra user context
    user_id: int = 0


class ReportOut(BaseModel):
    id: int
    title: str
    report_type: str
    subject: str
    content: str
    created_at: str

