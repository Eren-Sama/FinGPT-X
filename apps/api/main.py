"""FinGPT X — FastAPI Application Entry Point."""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import get_settings
from core.database import create_tables
from routers import chat, market, health, documents, portfolio, watchlist, voice, reports
from routers import settings as settings_router
from scheduler import start_scheduler, stop_scheduler
import asyncio

settings = get_settings()

# Ensure data directories exist
os.makedirs("./data", exist_ok=True)
os.makedirs(settings.chroma_persist_dir, exist_ok=True)
os.makedirs(settings.csv_import_dir, exist_ok=True)
os.makedirs(settings.upload_dir, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle — startup and shutdown."""
    await create_tables()
    print("[OK] Database tables ready")
    print(f"[OK] Ollama target: {settings.ollama_base_url}")
    print(f"[OK] Model: {settings.ollama_model}")
    print(f"[OK] Embed model: {settings.ollama_embed_model}")
    print(f"[OK] ChromaDB dir: {settings.chroma_persist_dir}")
    print(f"[OK] CSV import dir: {settings.csv_import_dir}")
    print("[OK] Mode: 100% OFFLINE")
    # Auto-seed market data in background (non-blocking)
    async def _seed():
        from core.database import AsyncSessionLocal
        from services.seeder_service import seed_all
        async with AsyncSessionLocal() as db:
            result = await seed_all(db)
            if result["seeded"] > 0:
                print(f"[OK] Seeded market data for {result['seeded']} symbols")
            else:
                print(f"[OK] Market data already seeded ({result['skipped']} symbols present)")
    asyncio.create_task(_seed())
    start_scheduler()
    yield
    stop_scheduler()
    print("FinGPT X API shutting down")


app = FastAPI(
    title="FinGPT X API",
    description="Local-first AI Financial Intelligence Platform — 100% Offline",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router)
app.include_router(chat.router)
app.include_router(market.router)
app.include_router(documents.router)
app.include_router(portfolio.router)
app.include_router(watchlist.router)
app.include_router(voice.router)
app.include_router(reports.router)
app.include_router(settings_router.router)


@app.get("/")
async def root():
    return {
        "message": "FinGPT X API",
        "version": "2.0.0",
        "mode": "offline",
        "docs": "/docs",
    }
