"""Force-seed the new assets that don't exist yet in the database."""
import asyncio
from core.database import SessionLocal
from services.seeder_service import ASSET_REGISTRY, seed_symbol

NEW_SYMS = [
    "AMD", "INTC", "CRM", "ORCL",
    "WMT", "KO", "PEP", "NKE", "MCD", "COST",
    "PFE", "UNH", "ABBV", "LLY", "MRK",
    "V", "MA", "GS", "BAC",
    "F", "GM",
    "XOM", "CVX",
    "KOTAKBANK", "ONGC", "SUNPHARMA", "DRREDDY",
    "ADA", "XRP", "DOGE", "AVAX",
    "NATGAS", "COPPER",
    "FTSE",
]

async def main():
    async with SessionLocal() as db:
        seeded = []
        for sym in NEW_SYMS:
            if sym in ASSET_REGISTRY:
                r = await seed_symbol(sym, ASSET_REGISTRY[sym], db)
                print(f"  {sym}: {r['status']}")
                if r["status"] == "seeded":
                    seeded.append(sym)
            else:
                print(f"  {sym}: NOT IN REGISTRY")
        print(f"\nDone. Seeded {len(seeded)} new assets.")

asyncio.run(main())
