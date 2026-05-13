"""
Market data service — 100% offline.
Reads from local SQLite database populated via CSV imports.
No external API calls. No internet required.
"""

import csv
import os
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from models.models import MarketData, AssetProfile


async def get_quote(symbol: str, db: AsyncSession) -> dict:
    """Get the latest price data for a symbol from local database."""
    symbol = symbol.upper()

    # Get the most recent row for this symbol
    result = await db.execute(
        select(MarketData)
        .where(MarketData.symbol == symbol)
        .order_by(MarketData.date.desc())
        .limit(2)
    )
    rows = result.scalars().all()

    if not rows:
        return {
            "symbol": symbol,
            "price": 0,
            "previous_close": 0,
            "change": 0,
            "change_percent": 0,
            "high": 0,
            "low": 0,
            "volume": 0,
            "date": "",
            "error": "No local data found. Import CSV data first.",
        }

    latest = rows[0]
    prev_close = rows[1].close if len(rows) > 1 else latest.open
    change = round(latest.close - prev_close, 2)
    change_pct = round((change / prev_close) * 100, 2) if prev_close else 0

    return {
        "symbol": symbol,
        "price": latest.close,
        "previous_close": prev_close,
        "change": change,
        "change_percent": change_pct,
        "high": latest.high,
        "low": latest.low,
        "volume": latest.volume,
        "date": latest.date,
    }


async def get_history(symbol: str, period: str, db: AsyncSession) -> list[dict]:
    """Get OHLCV history for charting from local database."""
    symbol = symbol.upper()

    # Map period to number of rows (approximate trading days)
    limit_map = {
        "1d": 1,
        "5d": 5,
        "1mo": 22,
        "3mo": 66,
        "6mo": 132,
        "1y": 252,
    }
    limit = limit_map.get(period, 66)

    result = await db.execute(
        select(MarketData)
        .where(MarketData.symbol == symbol)
        .order_by(MarketData.date.desc())
        .limit(limit)
    )
    rows = result.scalars().all()

    # Reverse so oldest is first (chart expects chronological order)
    rows.reverse()

    return [
        {
            "time": int(datetime.strptime(r.date, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp()),
            "open": r.open,
            "high": r.high,
            "low": r.low,
            "close": r.close,
            "volume": r.volume,
        }
        for r in rows
    ]


async def search_symbols(query: str, db: AsyncSession) -> list[dict]:
    """Search for symbols in the local asset profiles table."""
    query_lower = f"%{query.lower()}%"

    result = await db.execute(
        select(AssetProfile)
        .where(
            (func.lower(AssetProfile.symbol).like(query_lower))
            | (func.lower(AssetProfile.name).like(query_lower))
            | (func.lower(AssetProfile.sector).like(query_lower))
        )
        .limit(50)
    )
    profiles = result.scalars().all()

    return [
        {"symbol": p.symbol, "name": p.name, "sector": p.sector}
        for p in profiles
    ]


async def get_all_symbols(db: AsyncSession) -> list[dict]:
    """List all symbols that have local market data."""
    result = await db.execute(
        select(
            MarketData.symbol,
            func.count(MarketData.id).label("data_points"),
            func.min(MarketData.date).label("from_date"),
            func.max(MarketData.date).label("to_date"),
        )
        .group_by(MarketData.symbol)
        .order_by(MarketData.symbol)
    )
    rows = result.all()

    return [
        {
            "symbol": r.symbol,
            "data_points": r.data_points,
            "from_date": r.from_date,
            "to_date": r.to_date,
        }
        for r in rows
    ]


async def ingest_csv(file_path: str, symbol: str, db: AsyncSession) -> dict:
    """
    Ingest a CSV file into the MarketData table.
    Expected CSV columns: Date, Open, High, Low, Close, Volume
    (standard Yahoo Finance download format)
    """
    symbol = symbol.upper()
    path = Path(file_path)

    if not path.exists():
        return {"status": "error", "error": f"File not found: {file_path}"}

    inserted = 0
    skipped = 0

    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)

        # Normalize column names (handle case variations)
        if reader.fieldnames is None:
            return {"status": "error", "error": "CSV has no headers"}

        col_map = {}
        for col in reader.fieldnames:
            lower = col.strip().lower()
            if lower == "date":
                col_map["date"] = col
            elif lower == "open":
                col_map["open"] = col
            elif lower == "high":
                col_map["high"] = col
            elif lower == "low":
                col_map["low"] = col
            elif lower in ("close", "adj close", "adj_close"):
                col_map["close"] = col
            elif lower == "volume":
                col_map["volume"] = col

        required = {"date", "open", "high", "low", "close"}
        if not required.issubset(col_map.keys()):
            return {
                "status": "error",
                "error": f"Missing columns. Found: {list(col_map.keys())}. Required: {list(required)}",
            }

        for row in reader:
            try:
                date_str = row[col_map["date"]].strip()
                # Normalize date format to YYYY-MM-DD
                for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d-%m-%Y", "%d/%m/%Y"):
                    try:
                        parsed = datetime.strptime(date_str, fmt)
                        date_str = parsed.strftime("%Y-%m-%d")
                        break
                    except ValueError:
                        continue

                open_val = float(row[col_map["open"]])
                high_val = float(row[col_map["high"]])
                low_val = float(row[col_map["low"]])
                close_val = float(row[col_map["close"]])
                vol_val = int(float(row.get(col_map.get("volume", ""), "0") or "0"))

                # Upsert via raw SQL for efficiency
                await db.execute(
                    text("""
                        INSERT INTO market_data (symbol, date, open, high, low, close, volume, imported_at)
                        VALUES (:symbol, :date, :open, :high, :low, :close, :volume, :now)
                        ON CONFLICT(symbol, date) DO UPDATE SET
                            open = :open, high = :high, low = :low, close = :close,
                            volume = :volume, imported_at = :now
                    """),
                    {
                        "symbol": symbol,
                        "date": date_str,
                        "open": round(open_val, 2),
                        "high": round(high_val, 2),
                        "low": round(low_val, 2),
                        "close": round(close_val, 2),
                        "volume": vol_val,
                        "now": datetime.now(timezone.utc).isoformat(),
                    },
                )
                inserted += 1
            except (ValueError, KeyError):
                skipped += 1
                continue

    await db.commit()

    # Also upsert a basic asset profile if not exists
    existing = await db.execute(select(AssetProfile).where(AssetProfile.symbol == symbol))
    if not existing.scalar_one_or_none():
        profile = AssetProfile(symbol=symbol, name=symbol)
        db.add(profile)
        await db.commit()

    return {
        "status": "success",
        "symbol": symbol,
        "rows_imported": inserted,
        "rows_skipped": skipped,
    }


async def update_asset_profile(
    symbol: str, name: str, sector: str, industry: str,
    market_cap: float, description: str, db: AsyncSession,
) -> dict:
    """Create or update an asset profile."""
    symbol = symbol.upper()
    result = await db.execute(select(AssetProfile).where(AssetProfile.symbol == symbol))
    profile = result.scalar_one_or_none()

    if profile:
        profile.name = name or profile.name
        profile.sector = sector or profile.sector
        profile.industry = industry or profile.industry
        profile.market_cap = market_cap or profile.market_cap
        profile.description = description or profile.description
    else:
        profile = AssetProfile(
            symbol=symbol, name=name, sector=sector,
            industry=industry, market_cap=market_cap, description=description,
        )
        db.add(profile)

    await db.commit()
    return {"status": "updated", "symbol": symbol}
