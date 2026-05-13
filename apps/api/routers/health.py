"""Health check router — API status, Ollama, and database stats."""

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.models import MarketData, Document, ChatSession, Holding
from services.llm_service import health_check

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    """Health check — returns API status, Ollama connectivity, and database stats."""
    ollama = await health_check()

    # Database stats
    try:
        symbols_count = (await db.execute(
            select(func.count(func.distinct(MarketData.symbol)))
        )).scalar() or 0
        data_points = (await db.execute(
            select(func.count(MarketData.id))
        )).scalar() or 0
        doc_count = (await db.execute(
            select(func.count(Document.id))
        )).scalar() or 0
        session_count = (await db.execute(
            select(func.count(ChatSession.id))
        )).scalar() or 0
        holding_count = (await db.execute(
            select(func.count(Holding.id))
        )).scalar() or 0

        db_stats = {
            "symbols": symbols_count,
            "market_data_points": data_points,
            "documents": doc_count,
            "chat_sessions": session_count,
            "holdings": holding_count,
        }
    except Exception:
        db_stats = {"error": "Could not query database"}

    return {
        "status": "ok",
        "version": "2.0.0",
        "mode": "offline",
        "ollama": ollama,
        "database": db_stats,
    }
