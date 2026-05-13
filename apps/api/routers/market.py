"""Market data router — 100% offline, reads from local SQLite."""

import os
from pathlib import Path

from fastapi import APIRouter, Depends, Query, File, UploadFile, Form, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.config import get_settings
from services.market_service import (
    get_quote, get_history, search_symbols,
    get_all_symbols, ingest_csv, update_asset_profile,
)

settings = get_settings()
router = APIRouter(prefix="/api/market", tags=["market"])

CSV_DIR = Path(settings.csv_import_dir)
CSV_DIR.mkdir(parents=True, exist_ok=True)


@router.get("/quote/{symbol}")
async def quote(symbol: str, db: AsyncSession = Depends(get_db)):
    """Get latest quote for a symbol from local data."""
    return await get_quote(symbol.upper(), db)


@router.get("/quote")
async def bulk_quotes(symbols: str, db: AsyncSession = Depends(get_db)):
    """Get latest quotes for multiple comma-separated symbols from local data."""
    sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    results = {}
    for sym in sym_list:
        try:
            q = await get_quote(sym, db)
            if q:
                results[sym] = q
        except Exception:
            pass
    return {"quotes": results}

@router.get("/history/{symbol}")
async def history(
    symbol: str,
    period: str = Query(default="3mo", pattern="^(1d|5d|1mo|3mo|6mo|1y)$"),
    db: AsyncSession = Depends(get_db),
):
    """Get OHLCV price history for charting from local data."""
    data = await get_history(symbol.upper(), period, db)
    return {"symbol": symbol.upper(), "period": period, "data": data}


@router.get("/search")
async def search(q: str = Query(min_length=1), db: AsyncSession = Depends(get_db)):
    """Search for symbols in local asset profiles."""
    return {"results": await search_symbols(q, db)}


@router.get("/symbols")
async def list_symbols(db: AsyncSession = Depends(get_db)):
    """List all symbols with local data and their date ranges."""
    return await get_all_symbols(db)


@router.post("/import/csv")
async def import_csv(
    file: UploadFile = File(...),
    symbol: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Import a CSV file of OHLCV data for a symbol.
    Expected columns: Date, Open, High, Low, Close, Volume
    (standard Yahoo Finance download format).
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")

    symbol = symbol.upper().strip()
    if not symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")

    safe_name = f"{symbol}_{os.urandom(4).hex()}.csv"
    dest = CSV_DIR / safe_name
    content = await file.read()
    dest.write_bytes(content)

    result = await ingest_csv(str(dest), symbol, db)
    return result


@router.post("/import/bulk")
async def import_bulk_csv(db: AsyncSession = Depends(get_db)):
    """
    Scan the csv_import_dir for CSV files and import them all.
    File naming convention: SYMBOL.csv (e.g., AAPL.csv, MSFT.csv).
    """
    csv_dir = Path(settings.csv_import_dir)
    if not csv_dir.exists():
        return {"status": "error", "error": f"Directory not found: {csv_dir}"}

    results = []
    for csv_file in csv_dir.glob("*.csv"):
        symbol = csv_file.stem.upper()
        result = await ingest_csv(str(csv_file), symbol, db)
        results.append(result)

    return {"imported": len(results), "results": results}


class AssetProfileUpdate(BaseModel):
    symbol: str
    name: str = ""
    sector: str = ""
    industry: str = ""
    market_cap: float = 0.0
    description: str = ""


@router.put("/profile")
async def upsert_profile(body: AssetProfileUpdate, db: AsyncSession = Depends(get_db)):
    """Create or update an asset profile (name, sector, etc.)."""
    return await update_asset_profile(
        symbol=body.symbol, name=body.name, sector=body.sector,
        industry=body.industry, market_cap=body.market_cap,
        description=body.description, db=db,
    )


@router.post("/seed")
async def seed_demo_data(db: AsyncSession = Depends(get_db)):
    """
    Seed the database with offline demo market data for all supported symbols.
    Safe to call multiple times — uses upsert logic (no duplicates).
    """
    from services.seeder_service import seed_all
    result = await seed_all(db)
    return result


@router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db)):
    """List all symbols grouped by market category."""
    from services.seeder_service import ASSET_REGISTRY
    grouped: dict[str, list[dict]] = {}
    for sym, meta in ASSET_REGISTRY.items():
        cat = meta["category"]
        grouped.setdefault(cat, []).append({
            "symbol": sym,
            "name": meta["name"],
            "currency": meta["currency"],
            "category": cat,
        })
    return {"categories": grouped}
