"""Watchlist router — CRUD for user watchlists."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.models import Watchlist, WatchlistItem
from schemas.schemas import WatchlistItemCreate, WatchlistOut, WatchlistItemOut

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


@router.get("/")
async def get_watchlist(user_id: int = 0, db: AsyncSession = Depends(get_db)):
    """Get the user's primary watchlist with all items."""
    result = await db.execute(
        select(Watchlist).where(Watchlist.user_id == user_id)
    )
    watchlist = result.scalars().first()

    if not watchlist:
        # Auto-create default watchlist
        watchlist = Watchlist(user_id=user_id, name="My Watchlist")
        db.add(watchlist)
        await db.commit()
        await db.refresh(watchlist)

    item_result = await db.execute(
        select(WatchlistItem)
        .where(WatchlistItem.watchlist_id == watchlist.id)
        .order_by(WatchlistItem.added_at.desc())
    )
    items = item_result.scalars().all()

    return WatchlistOut(
        id=watchlist.id,
        name=watchlist.name,
        items=[
            WatchlistItemOut(
                id=i.id,
                symbol=i.symbol.upper(),
                notes=i.notes,
                added_at=i.added_at.isoformat(),
            )
            for i in items
        ],
    )


@router.post("/items")
async def add_item(
    body: WatchlistItemCreate,
    user_id: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Add a symbol to the watchlist."""
    # Ensure watchlist exists
    result = await db.execute(
        select(Watchlist).where(Watchlist.user_id == user_id)
    )
    watchlist = result.scalars().first()
    if not watchlist:
        watchlist = Watchlist(user_id=user_id, name="My Watchlist")
        db.add(watchlist)
        await db.commit()
        await db.refresh(watchlist)

    # Check for duplicate
    existing = await db.execute(
        select(WatchlistItem).where(
            WatchlistItem.watchlist_id == watchlist.id,
            WatchlistItem.symbol == body.symbol.upper(),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"{body.symbol.upper()} already in watchlist")

    item = WatchlistItem(
        watchlist_id=watchlist.id,
        symbol=body.symbol.upper(),
        notes=body.notes,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    return WatchlistItemOut(
        id=item.id,
        symbol=item.symbol,
        notes=item.notes,
        added_at=item.added_at.isoformat(),
    )


@router.delete("/items/{item_id}")
async def remove_item(item_id: int, db: AsyncSession = Depends(get_db)):
    """Remove a symbol from the watchlist."""
    result = await db.execute(select(WatchlistItem).where(WatchlistItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Watchlist item not found")

    await db.delete(item)
    await db.commit()
    return {"status": "deleted", "id": item_id}
