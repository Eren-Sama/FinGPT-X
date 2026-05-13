"""
Background task scheduler for FinGPT X.
Runs periodic market quote refreshes so the dashboard always shows up-to-date data.
"""

import asyncio
import logging
from contextlib import asynccontextmanager

logger = logging.getLogger("fingpt.scheduler")

# Refresh all tracked symbols every 5 minutes
REFRESH_INTERVAL = 300  # seconds
_task: asyncio.Task | None = None


async def _refresh_quotes() -> None:
    """Periodically re-fetch the latest quote for all tracked symbols."""
    # Lazy import to avoid circular deps at startup
    from core.database import AsyncSessionLocal
    from services.market_service import get_all_symbols, get_quote

    while True:
        try:
            await asyncio.sleep(REFRESH_INTERVAL)
            async with AsyncSessionLocal() as db:
                symbols = await get_all_symbols(db)
                if symbols:
                    logger.info(f"[scheduler] Refreshing quotes for {len(symbols)} symbols…")
                    for s in symbols:
                        try:
                            await get_quote(s["symbol"], db)
                        except Exception as exc:
                            logger.debug(f"[scheduler] Quote refresh failed for {s['symbol']}: {exc}")
        except asyncio.CancelledError:
            logger.info("[scheduler] Quote refresh task cancelled")
            return
        except Exception as exc:
            logger.warning(f"[scheduler] Unexpected error in refresh loop: {exc}")
            await asyncio.sleep(30)  # Back off briefly before retrying


def start_scheduler() -> None:
    """Start background tasks. Call from lifespan startup."""
    global _task
    try:
        loop = asyncio.get_running_loop()
        _task = loop.create_task(_refresh_quotes(), name="market-quote-refresh")
        logger.info("[scheduler] Market quote refresh started (interval: 5 min)")
    except RuntimeError:
        logger.warning("[scheduler] No running event loop — scheduler not started")


def stop_scheduler() -> None:
    """Cancel background tasks. Call from lifespan shutdown."""
    global _task
    if _task and not _task.done():
        _task.cancel()
        logger.info("[scheduler] Market quote refresh stopped")
