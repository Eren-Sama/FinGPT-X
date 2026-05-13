import asyncio
from sqlalchemy import select
from core.database import SessionLocal
from models.models import Portfolio, Holding

async def seed_holdings():
    async with SessionLocal() as db:
        user_id = 0
        result = await db.execute(select(Portfolio).where(Portfolio.user_id == user_id))
        portfolio = result.scalars().first()
        
        if not portfolio:
            portfolio = Portfolio(user_id=user_id, name="My Portfolio")
            db.add(portfolio)
            await db.commit()
            await db.refresh(portfolio)
            
        # Diverse set of holdings
        holdings_to_add = [
            {"symbol": "AAPL", "quantity": 50, "avg_price": 150.0},
            {"symbol": "NVDA", "quantity": 10, "avg_price": 400.0},
            {"symbol": "MSFT", "quantity": 25, "avg_price": 310.0},
            {"symbol": "BTC", "quantity": 0.5, "avg_price": 45000.0},
            {"symbol": "ETH", "quantity": 5.0, "avg_price": 2200.0},
            {"symbol": "RELIANCE", "quantity": 100, "avg_price": 2500.0},
            {"symbol": "TCS", "quantity": 40, "avg_price": 3200.0},
            {"symbol": "GOLD", "quantity": 10, "avg_price": 1950.0},
            {"symbol": "JPM", "quantity": 30, "avg_price": 140.0},
            {"symbol": "TSLA", "quantity": 20, "avg_price": 200.0},
        ]
        
        for h_data in holdings_to_add:
            # Check if exists
            existing = await db.execute(
                select(Holding).where(
                    Holding.portfolio_id == portfolio.id,
                    Holding.symbol == h_data["symbol"]
                )
            )
            if not existing.scalars().first():
                holding = Holding(
                    portfolio_id=portfolio.id,
                    symbol=h_data["symbol"],
                    quantity=h_data["quantity"],
                    avg_price=h_data["avg_price"]
                )
                db.add(holding)
                
        await db.commit()
        print("Successfully seeded diverse portfolio holdings.")

if __name__ == "__main__":
    asyncio.run(seed_holdings())
