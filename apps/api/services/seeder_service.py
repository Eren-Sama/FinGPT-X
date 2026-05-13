"""
Offline market data seeder.
Pre-populates SQLite with realistic static OHLCV price history for:
  - US Large Cap (NASDAQ / NYSE)
  - Indian Markets (NSE blue chips)
  - Cryptocurrencies (BTC, ETH, BNB, SOL)
  - Commodities (Gold, Silver, Crude Oil)
  - Market Indices (S&P 500, Nifty 50, NASDAQ)

Generates ~252 trading days (1 year) of synthetic data derived from
realistic base prices and plausible daily drift/volatility.
Safe to call multiple times — uses upsert so no duplicates are created.
"""

from __future__ import annotations

import math
import random
from datetime import date, timedelta
from datetime import datetime, timezone

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.models import AssetProfile, MarketData

# ─── Asset Registry ──────────────────────────────────────────────────────────

ASSET_REGISTRY: dict[str, dict] = {
    # ── US Large Cap — Technology ────────────────────────────────────────────
    "AAPL":  {"name": "Apple Inc.",              "category": "US",        "currency": "USD", "sector": "Technology",    "base": 178.0,    "vol": 0.015},
    "MSFT":  {"name": "Microsoft Corp.",         "category": "US",        "currency": "USD", "sector": "Technology",    "base": 415.0,    "vol": 0.014},
    "GOOGL": {"name": "Alphabet Inc.",           "category": "US",        "currency": "USD", "sector": "Technology",    "base": 172.0,    "vol": 0.016},
    "NVDA":  {"name": "NVIDIA Corp.",            "category": "US",        "currency": "USD", "sector": "Technology",    "base": 880.0,    "vol": 0.030},
    "META":  {"name": "Meta Platforms Inc.",     "category": "US",        "currency": "USD", "sector": "Technology",    "base": 500.0,    "vol": 0.022},
    "AMD":   {"name": "Advanced Micro Devices",  "category": "US",        "currency": "USD", "sector": "Technology",    "base": 160.0,    "vol": 0.028},
    "INTC":  {"name": "Intel Corp.",             "category": "US",        "currency": "USD", "sector": "Technology",    "base": 32.0,     "vol": 0.022},
    "CRM":   {"name": "Salesforce Inc.",         "category": "US",        "currency": "USD", "sector": "Technology",    "base": 270.0,    "vol": 0.018},
    "ORCL":  {"name": "Oracle Corp.",            "category": "US",        "currency": "USD", "sector": "Technology",    "base": 125.0,    "vol": 0.014},
    # ── US Large Cap — Consumer ──────────────────────────────────────────────
    "AMZN":  {"name": "Amazon.com Inc.",         "category": "US",        "currency": "USD", "sector": "Consumer",      "base": 185.0,    "vol": 0.018},
    "WMT":   {"name": "Walmart Inc.",            "category": "US",        "currency": "USD", "sector": "Consumer",      "base": 165.0,    "vol": 0.010},
    "KO":    {"name": "Coca-Cola Co.",           "category": "US",        "currency": "USD", "sector": "Consumer",      "base": 62.0,     "vol": 0.008},
    "PEP":   {"name": "PepsiCo Inc.",            "category": "US",        "currency": "USD", "sector": "Consumer",      "base": 170.0,    "vol": 0.009},
    "NKE":   {"name": "Nike Inc.",               "category": "US",        "currency": "USD", "sector": "Consumer",      "base": 95.0,     "vol": 0.020},
    "MCD":   {"name": "McDonald's Corp.",        "category": "US",        "currency": "USD", "sector": "Consumer",      "base": 285.0,    "vol": 0.010},
    "COST":  {"name": "Costco Wholesale",        "category": "US",        "currency": "USD", "sector": "Consumer",      "base": 740.0,    "vol": 0.012},
    # ── US Large Cap — Healthcare ────────────────────────────────────────────
    "JNJ":   {"name": "Johnson & Johnson",       "category": "US",        "currency": "USD", "sector": "Healthcare",    "base": 148.0,    "vol": 0.009},
    "PFE":   {"name": "Pfizer Inc.",             "category": "US",        "currency": "USD", "sector": "Healthcare",    "base": 28.0,     "vol": 0.018},
    "UNH":   {"name": "UnitedHealth Group",      "category": "US",        "currency": "USD", "sector": "Healthcare",    "base": 520.0,    "vol": 0.012},
    "ABBV":  {"name": "AbbVie Inc.",             "category": "US",        "currency": "USD", "sector": "Healthcare",    "base": 170.0,    "vol": 0.013},
    "LLY":   {"name": "Eli Lilly & Co.",         "category": "US",        "currency": "USD", "sector": "Healthcare",    "base": 780.0,    "vol": 0.020},
    "MRK":   {"name": "Merck & Co.",             "category": "US",        "currency": "USD", "sector": "Healthcare",    "base": 125.0,    "vol": 0.011},
    # ── US Large Cap — Financials ────────────────────────────────────────────
    "BRK-B": {"name": "Berkshire Hathaway B",   "category": "US",        "currency": "USD", "sector": "Financials",    "base": 395.0,    "vol": 0.010},
    "JPM":   {"name": "JPMorgan Chase",          "category": "US",        "currency": "USD", "sector": "Financials",    "base": 198.0,    "vol": 0.013},
    "V":     {"name": "Visa Inc.",               "category": "US",        "currency": "USD", "sector": "Financials",    "base": 280.0,    "vol": 0.011},
    "MA":    {"name": "Mastercard Inc.",          "category": "US",        "currency": "USD", "sector": "Financials",    "base": 460.0,    "vol": 0.012},
    "GS":    {"name": "Goldman Sachs Group",     "category": "US",        "currency": "USD", "sector": "Financials",    "base": 385.0,    "vol": 0.016},
    "BAC":   {"name": "Bank of America",         "category": "US",        "currency": "USD", "sector": "Financials",    "base": 37.0,     "vol": 0.015},
    # ── US Large Cap — Automotive ────────────────────────────────────────────
    "TSLA":  {"name": "Tesla Inc.",              "category": "US",        "currency": "USD", "sector": "Automotive",    "base": 175.0,    "vol": 0.035},
    "F":     {"name": "Ford Motor Co.",          "category": "US",        "currency": "USD", "sector": "Automotive",    "base": 12.5,     "vol": 0.020},
    "GM":    {"name": "General Motors Co.",      "category": "US",        "currency": "USD", "sector": "Automotive",    "base": 42.0,     "vol": 0.018},
    # ── US Large Cap — Energy ────────────────────────────────────────────────
    "XOM":   {"name": "Exxon Mobil Corp.",       "category": "US",        "currency": "USD", "sector": "Energy",        "base": 108.0,    "vol": 0.013},
    "CVX":   {"name": "Chevron Corp.",           "category": "US",        "currency": "USD", "sector": "Energy",        "base": 155.0,    "vol": 0.012},
    # ── Indian Markets (NSE) ─────────────────────────────────────────────────
    "RELIANCE":   {"name": "Reliance Industries", "category": "India",   "currency": "INR", "sector": "Energy",        "base": 2950.0,   "vol": 0.014},
    "TCS":        {"name": "TCS",                 "category": "India",   "currency": "INR", "sector": "Technology",    "base": 3850.0,   "vol": 0.012},
    "INFY":       {"name": "Infosys",             "category": "India",   "currency": "INR", "sector": "Technology",    "base": 1480.0,   "vol": 0.013},
    "HDFCBANK":   {"name": "HDFC Bank",           "category": "India",   "currency": "INR", "sector": "Financials",    "base": 1560.0,   "vol": 0.012},
    "WIPRO":      {"name": "Wipro",               "category": "India",   "currency": "INR", "sector": "Technology",    "base": 480.0,    "vol": 0.014},
    "ICICIBANK":  {"name": "ICICI Bank",          "category": "India",   "currency": "INR", "sector": "Financials",    "base": 1100.0,   "vol": 0.013},
    "SBIN":       {"name": "State Bank of India", "category": "India",   "currency": "INR", "sector": "Financials",    "base": 780.0,    "vol": 0.015},
    "BAJFINANCE": {"name": "Bajaj Finance",       "category": "India",   "currency": "INR", "sector": "Financials",    "base": 7200.0,   "vol": 0.018},
    "TATAMOTORS": {"name": "Tata Motors",         "category": "India",   "currency": "INR", "sector": "Automotive",    "base": 960.0,    "vol": 0.020},
    "ADANIENT":   {"name": "Adani Enterprises",   "category": "India",   "currency": "INR", "sector": "Consumer",      "base": 2400.0,   "vol": 0.025},
    "KOTAKBANK":  {"name": "Kotak Mahindra Bank", "category": "India",   "currency": "INR", "sector": "Financials",    "base": 1750.0,   "vol": 0.013},
    "ONGC":       {"name": "Oil & Natural Gas",   "category": "India",   "currency": "INR", "sector": "Energy",        "base": 270.0,    "vol": 0.016},
    "SUNPHARMA":  {"name": "Sun Pharma",          "category": "India",   "currency": "INR", "sector": "Healthcare",    "base": 1500.0,   "vol": 0.014},
    "DRREDDY":    {"name": "Dr. Reddy's Labs",    "category": "India",   "currency": "INR", "sector": "Healthcare",    "base": 5800.0,   "vol": 0.013},
    "NIFTY50":    {"name": "Nifty 50 Index",      "category": "Index",   "currency": "INR", "sector": "Index",         "base": 22400.0,  "vol": 0.010},
    # ── Cryptocurrencies ─────────────────────────────────────────────────────
    "BTC":   {"name": "Bitcoin",                  "category": "Crypto",  "currency": "USD", "sector": "Crypto",        "base": 67000.0,  "vol": 0.040},
    "ETH":   {"name": "Ethereum",                 "category": "Crypto",  "currency": "USD", "sector": "Crypto",        "base": 3400.0,   "vol": 0.045},
    "BNB":   {"name": "Binance Coin",             "category": "Crypto",  "currency": "USD", "sector": "Crypto",        "base": 600.0,    "vol": 0.038},
    "SOL":   {"name": "Solana",                   "category": "Crypto",  "currency": "USD", "sector": "Crypto",        "base": 170.0,    "vol": 0.055},
    "ADA":   {"name": "Cardano",                  "category": "Crypto",  "currency": "USD", "sector": "Crypto",        "base": 0.65,     "vol": 0.050},
    "XRP":   {"name": "Ripple XRP",               "category": "Crypto",  "currency": "USD", "sector": "Crypto",        "base": 0.55,     "vol": 0.048},
    "DOGE":  {"name": "Dogecoin",                 "category": "Crypto",  "currency": "USD", "sector": "Crypto",        "base": 0.16,     "vol": 0.060},
    "AVAX":  {"name": "Avalanche",                "category": "Crypto",  "currency": "USD", "sector": "Crypto",        "base": 38.0,     "vol": 0.052},
    # ── Commodities ──────────────────────────────────────────────────────────
    "GOLD":  {"name": "Gold (XAU/USD)",           "category": "Commodity","currency": "USD", "sector": "Commodity",    "base": 2350.0,   "vol": 0.008},
    "SILVER":{"name": "Silver (XAG/USD)",         "category": "Commodity","currency": "USD", "sector": "Commodity",    "base": 27.5,     "vol": 0.018},
    "OIL":   {"name": "Crude Oil WTI",            "category": "Commodity","currency": "USD", "sector": "Commodity",    "base": 78.0,     "vol": 0.020},
    "NATGAS":{"name": "Natural Gas",              "category": "Commodity","currency": "USD", "sector": "Commodity",    "base": 2.80,     "vol": 0.035},
    "COPPER":{"name": "Copper Futures",           "category": "Commodity","currency": "USD", "sector": "Commodity",    "base": 4.50,     "vol": 0.020},
    # ── Market Indices ───────────────────────────────────────────────────────
    "SPX":   {"name": "S&P 500 Index",            "category": "Index",   "currency": "USD", "sector": "Index",         "base": 5200.0,   "vol": 0.010},
    "NDX":   {"name": "NASDAQ-100 Index",         "category": "Index",   "currency": "USD", "sector": "Index",         "base": 18100.0,  "vol": 0.012},
    "DJI":   {"name": "Dow Jones Industrial",     "category": "Index",   "currency": "USD", "sector": "Index",         "base": 39200.0,  "vol": 0.008},
    "FTSE":  {"name": "FTSE 100 Index",           "category": "Index",   "currency": "GBP", "sector": "Index",         "base": 8200.0,   "vol": 0.009},
}

# Number of trading days to generate (~1 year)
_TRADING_DAYS = 252


def _trading_dates(n: int) -> list[str]:
    """Generate the last n weekday dates ending yesterday."""
    result = []
    d = date.today() - timedelta(days=1)
    while len(result) < n:
        if d.weekday() < 5:  # Mon–Fri
            result.append(d.strftime("%Y-%m-%d"))
        d -= timedelta(days=1)
    result.reverse()
    return result


def _generate_ohlcv(
    base_price: float,
    daily_vol: float,
    n_days: int,
    seed: int,
) -> list[dict]:
    """
    Generate synthetic OHLCV data using a random walk with realistic properties:
    - Slight upward drift (0.03% per day)
    - Daily volatility as a fraction of price
    - High/Low derived from open/close with extra intraday noise
    - Volume proportional to price (rough placeholder)
    """
    rng = random.Random(seed)
    dates = _trading_dates(n_days)
    rows = []
    price = base_price

    for date_str in dates:
        drift = 0.0003  # 0.03% daily upward drift
        daily_return = rng.gauss(drift, daily_vol)
        open_price = round(price, 4)
        close_price = round(price * (1 + daily_return), 4)

        # Intraday high/low
        intraday_noise = abs(rng.gauss(0, daily_vol * 0.5))
        high_price = round(max(open_price, close_price) * (1 + intraday_noise), 4)
        low_price  = round(min(open_price, close_price) * (1 - intraday_noise), 4)

        # Rough volume (inversely scaled with price)
        volume = int(rng.uniform(0.8, 1.2) * max(100, 1_000_000_000 / max(price, 1)))

        rows.append({
            "date": date_str,
            "open":   open_price,
            "high":   high_price,
            "low":    low_price,
            "close":  close_price,
            "volume": volume,
        })
        price = close_price  # next day opens at previous close

    return rows


async def seed_symbol(symbol: str, meta: dict, db: AsyncSession) -> dict:
    """Seed OHLCV data and asset profile for a single symbol."""
    # Check if data already exists (only seed if fewer than 50 rows)
    result = await db.execute(
        text("SELECT COUNT(*) FROM market_data WHERE symbol = :sym"),
        {"sym": symbol},
    )
    count = result.scalar() or 0
    if count >= 50:
        return {"symbol": symbol, "status": "skipped", "existing_rows": count}

    # Generate synthetic price history
    seed_int = sum(ord(c) for c in symbol)  # deterministic per symbol
    rows = _generate_ohlcv(
        base_price=meta["base"],
        daily_vol=meta["vol"],
        n_days=_TRADING_DAYS,
        seed=seed_int,
    )

    now_iso = datetime.now(timezone.utc).isoformat()
    inserted = 0
    for row in rows:
        await db.execute(
            text("""
                INSERT INTO market_data (symbol, date, open, high, low, close, volume, imported_at)
                VALUES (:symbol, :date, :open, :high, :low, :close, :volume, :now)
                ON CONFLICT(symbol, date) DO UPDATE SET
                    open=:open, high=:high, low=:low, close=:close,
                    volume=:volume, imported_at=:now
            """),
            {"symbol": symbol, "date": row["date"], "open": row["open"],
             "high": row["high"], "low": row["low"], "close": row["close"],
             "volume": row["volume"], "now": now_iso},
        )
        inserted += 1

    # Upsert asset profile
    await db.execute(
        text("""
            INSERT INTO asset_profiles (symbol, name, sector, industry, market_cap, description, updated_at)
            VALUES (:sym, :name, :sector, :industry, 0.0, :desc, :now)
            ON CONFLICT(symbol) DO UPDATE SET
                name=:name, sector=:sector, updated_at=:now
        """),
        {
            "sym": symbol,
            "name": meta["name"],
            "sector": meta["sector"],
            "industry": meta.get("category", ""),
            "desc": f"{meta['name']} — {meta['category']} market, {meta['currency']}",
            "now": now_iso,
        },
    )

    await db.commit()
    return {"symbol": symbol, "status": "seeded", "rows": inserted}


async def seed_all(db: AsyncSession) -> dict:
    """Seed all symbols in the registry. Called from /api/market/seed or startup."""
    results = []
    for symbol, meta in ASSET_REGISTRY.items():
        r = await seed_symbol(symbol, meta, db)
        results.append(r)

    seeded = [r for r in results if r["status"] == "seeded"]
    skipped = [r for r in results if r["status"] == "skipped"]
    return {
        "total": len(results),
        "seeded": len(seeded),
        "skipped": len(skipped),
        "symbols_seeded": [r["symbol"] for r in seeded],
    }
