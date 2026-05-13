"""
Seed script - generates realistic sample CSV market data and populates the database.
Run: python seed_data.py
"""

import csv
import random
import asyncio
from datetime import datetime, timedelta
from pathlib import Path

from core.database import SessionLocal, create_tables
from services.market_service import ingest_csv, update_asset_profile


ASSETS = [
    {"symbol": "AAPL",  "name": "Apple Inc.",           "sector": "Technology",       "industry": "Consumer Electronics",  "market_cap": 2.8e12,  "base_price": 185},
    {"symbol": "MSFT",  "name": "Microsoft Corp.",      "sector": "Technology",       "industry": "Software",              "market_cap": 3.1e12,  "base_price": 415},
    {"symbol": "GOOGL", "name": "Alphabet Inc.",        "sector": "Technology",       "industry": "Internet Services",     "market_cap": 2.0e12,  "base_price": 175},
    {"symbol": "AMZN",  "name": "Amazon.com Inc.",      "sector": "Technology",       "industry": "E-Commerce",            "market_cap": 1.9e12,  "base_price": 196},
    {"symbol": "NVDA",  "name": "NVIDIA Corp.",         "sector": "Technology",       "industry": "Semiconductors",        "market_cap": 2.2e12,  "base_price": 875},
    {"symbol": "TSLA",  "name": "Tesla Inc.",           "sector": "Consumer Cyclical","industry": "Electric Vehicles",     "market_cap": 580e9,   "base_price": 185},
    {"symbol": "META",  "name": "Meta Platforms Inc.",   "sector": "Technology",       "industry": "Social Media",          "market_cap": 1.3e12,  "base_price": 510},
    {"symbol": "JPM",   "name": "JPMorgan Chase & Co.", "sector": "Financials",       "industry": "Banking",               "market_cap": 580e9,   "base_price": 192},
    {"symbol": "JNJ",   "name": "Johnson & Johnson",    "sector": "Healthcare",       "industry": "Pharmaceuticals",       "market_cap": 370e9,   "base_price": 153},
    {"symbol": "V",     "name": "Visa Inc.",            "sector": "Financials",       "industry": "Payment Processing",    "market_cap": 560e9,   "base_price": 280},
    {"symbol": "WMT",   "name": "Walmart Inc.",         "sector": "Consumer Staples", "industry": "Retail",                "market_cap": 520e9,   "base_price": 170},
    {"symbol": "XOM",   "name": "Exxon Mobil Corp.",    "sector": "Energy",           "industry": "Oil & Gas",             "market_cap": 460e9,   "base_price": 108},
]


def generate_ohlcv_csv(symbol, base_price, days=365):
    csv_dir = Path("./data/csv")
    csv_dir.mkdir(parents=True, exist_ok=True)
    filepath = csv_dir / f"{symbol}.csv"

    price = base_price
    rows = []
    start_date = datetime.now() - timedelta(days=days)

    for i in range(days):
        current_date = start_date + timedelta(days=i)
        if current_date.weekday() >= 5:
            continue

        daily_return = random.gauss(0.0003, 0.015)
        price *= (1 + daily_return)
        price = max(price * 0.5, price)

        open_price = round(price * (1 + random.uniform(-0.005, 0.005)), 2)
        high_price = round(max(open_price, price) * (1 + random.uniform(0.001, 0.02)), 2)
        low_price = round(min(open_price, price) * (1 - random.uniform(0.001, 0.02)), 2)
        close_price = round(price, 2)
        volume = int(random.uniform(5e6, 80e6))

        rows.append({
            "Date": current_date.strftime("%Y-%m-%d"),
            "Open": open_price,
            "High": high_price,
            "Low": low_price,
            "Close": close_price,
            "Volume": volume,
        })

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["Date", "Open", "High", "Low", "Close", "Volume"])
        writer.writeheader()
        writer.writerows(rows)

    return str(filepath)


async def seed():
    await create_tables()

    async with SessionLocal() as db:
        for asset in ASSETS:
            symbol = asset["symbol"]
            print(f"Generating {symbol} data...")

            csv_path = generate_ohlcv_csv(symbol, asset["base_price"])
            result = await ingest_csv(csv_path, symbol, db)
            print(f"  {result.get('rows_imported', 0)} rows imported")

            await update_asset_profile(
                symbol=symbol,
                name=asset["name"],
                sector=asset["sector"],
                industry=asset["industry"],
                market_cap=asset["market_cap"],
                description=f"{asset['name']} - {asset['industry']} sector leader.",
                db=db,
            )

    print("\nSeed data complete! 12 assets with 1 year of OHLCV history each.")


if __name__ == "__main__":
    asyncio.run(seed())
