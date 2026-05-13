"""Portfolio router — CRUD and analytics."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.models import Portfolio, Holding

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class HoldingCreate(BaseModel):
    symbol: str
    quantity: float
    avg_price: float


class HoldingUpdate(BaseModel):
    quantity: float | None = None
    avg_price: float | None = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/")
async def get_portfolio(user_id: int = 0, db: AsyncSession = Depends(get_db)):
    """Get the user's primary portfolio with all holdings."""
    result = await db.execute(
        select(Portfolio).where(Portfolio.user_id == user_id)
    )
    portfolio = result.scalars().first()

    if not portfolio:
        # Auto-create default portfolio
        portfolio = Portfolio(user_id=user_id, name="My Portfolio")
        db.add(portfolio)
        await db.commit()
        await db.refresh(portfolio)

    holding_result = await db.execute(
        select(Holding).where(Holding.portfolio_id == portfolio.id)
    )
    holdings = holding_result.scalars().all()

    return {
        "id": portfolio.id,
        "name": portfolio.name,
        "holdings": [
            {
                "id": h.id,
                "symbol": h.symbol.upper(),
                "quantity": h.quantity,
                "avg_price": h.avg_price,
                "added_at": h.added_at.isoformat(),
            }
            for h in holdings
        ],
    }


@router.post("/holdings")
async def add_holding(
    body: HoldingCreate,
    user_id: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Add a new holding to the portfolio."""
    # Ensure portfolio exists
    result = await db.execute(
        select(Portfolio).where(Portfolio.user_id == user_id)
    )
    portfolio = result.scalars().first()
    if not portfolio:
        portfolio = Portfolio(user_id=user_id, name="My Portfolio")
        db.add(portfolio)
        await db.commit()
        await db.refresh(portfolio)

    holding = Holding(
        portfolio_id=portfolio.id,
        symbol=body.symbol.upper(),
        quantity=body.quantity,
        avg_price=body.avg_price,
    )
    db.add(holding)
    await db.commit()
    await db.refresh(holding)

    return {
        "id": holding.id,
        "symbol": holding.symbol,
        "quantity": holding.quantity,
        "avg_price": holding.avg_price,
    }


@router.put("/holdings/{holding_id}")
async def update_holding(
    holding_id: int,
    body: HoldingUpdate,
    user_id: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Update quantity or average price of a holding."""
    result = await db.execute(select(Holding).where(Holding.id == holding_id))
    holding = result.scalar_one_or_none()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")

    if body.quantity is not None:
        holding.quantity = body.quantity
    if body.avg_price is not None:
        holding.avg_price = body.avg_price

    await db.commit()
    return {"status": "updated", "id": holding_id}


@router.delete("/holdings/{holding_id}")
async def delete_holding(
    holding_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Remove a holding from the portfolio."""
    result = await db.execute(select(Holding).where(Holding.id == holding_id))
    holding = result.scalar_one_or_none()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")

    await db.delete(holding)
    await db.commit()
    return {"status": "deleted", "id": holding_id}


# ── AI Portfolio Analysis ─────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    user_id: int = 0


@router.post("/analyze")
async def analyze_portfolio(
    body: AnalyzeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Stream an AI-generated portfolio risk breakdown from Ollama."""
    import json
    import httpx
    from fastapi.responses import StreamingResponse
    from core.config import get_settings

    settings = get_settings()

    # Fetch holdings
    result = await db.execute(
        select(Portfolio).where(Portfolio.user_id == body.user_id)
    )
    portfolio = result.scalars().first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    holding_result = await db.execute(
        select(Holding).where(Holding.portfolio_id == portfolio.id)
    )
    holdings = holding_result.scalars().all()

    if not holdings:
        raise HTTPException(status_code=400, detail="Portfolio has no holdings to analyze")

    # Build a concise holdings table for the prompt
    total_cost = sum(h.quantity * h.avg_price for h in holdings)
    lines = ["Symbol | Shares | Avg Cost | Total Cost | Allocation"]
    lines.append("-------|--------|----------|------------|----------")
    for h in holdings:
        cost = h.quantity * h.avg_price
        alloc = (cost / total_cost * 100) if total_cost > 0 else 0
        lines.append(
            f"{h.symbol.upper()} | {h.quantity:.2f} | ${h.avg_price:.2f} | ${cost:,.2f} | {alloc:.1f}%"
        )
    holdings_table = "\n".join(lines)
    total_formatted = f"${total_cost:,.2f}"

    system_prompt = (
        "You are a Senior Portfolio Risk Analyst at a top-tier asset management firm. "
        "Your analysis is data-driven, concise, and highly actionable. "
        "CRITICAL INSTRUCTIONS FOR FORMATTING:\n"
        "1. You MUST use clear Markdown headings (`##` and `###`).\n"
        "2. You MUST use Markdown tables to present allocation data or risk matrices.\n"
        "3. Use **bold text** for key percentages, tickers, and financial figures.\n"
        "4. Use bullet points for risk factors and actionable recommendations.\n"
        "Be direct, avoid generic filler, and keep the total response under 800 words."
    )

    user_prompt = f"""Analyze the following investment portfolio (total cost basis: {total_formatted}):

{holdings_table}

Provide a structured analysis with these exact sections:
## 📊 Portfolio Overview
Brief summary of the portfolio's profile and dominant theme.

## 🎯 Concentration Risk
Identify overweight positions or sector concentration issues using a Markdown table if applicable.

## ⚖️ Diversification Assessment
Evaluate asset diversification and correlation risks.

## ⚠️ Key Risk Factors
- Highlight 3-5 critical market, sector, or company-specific risks using bullet points.

## 🛠️ Rebalancing Suggestions
- Provide specific, actionable bullet points to improve the risk/return profile.

## 📋 Verdict
A 1-sentence overall risk rating (e.g., "**High-risk**, tech-concentrated portfolio suitable for growth investors with a 5+ year horizon.")"""

    async def stream():
        import json as _json
        from services.llm_service import detect_active_model

        model = await detect_active_model()
        if not model:
            yield f"data: {_json.dumps({'error': 'No Ollama model available. Run: ollama pull phi3'})}\n\n"
            return

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": True,
            "keep_alive": -1,
            "options": {
                "temperature": 0.4,
                "num_ctx": 2048,
                "num_predict": 1024,
            },
        }
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{settings.ollama_base_url}/api/chat",
                    json=payload,
                ) as resp:
                    if resp.status_code != 200:
                        try:
                            body = await resp.aread()
                            err = _json.loads(body).get("error", f"HTTP {resp.status_code}")
                        except Exception:
                            err = f"HTTP {resp.status_code}"
                        if any(k in err for k in ("CUDA", "buffer", "memory", "terminate")):
                            msg = (
                                f"⚠️ **GPU/RAM out of memory** — cannot load `{model}`.\n\n"
                                "Go to **Settings → Local AI Engine** and switch to `phi3:latest` (2.2 GB), then retry."
                            )
                        else:
                            msg = f"⚠️ Ollama error: {err}"
                        yield f"data: {_json.dumps({'token': msg})}\n\n"
                        yield "data: [DONE]\n\n"
                        return

                    async for line in resp.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            chunk = _json.loads(line)
                            token = chunk.get("message", {}).get("content", "")
                            if token:
                                yield f"data: {_json.dumps({'token': token})}\n\n"
                            if chunk.get("done"):
                                yield "data: [DONE]\n\n"
                                return
                        except _json.JSONDecodeError:
                            continue
        except Exception as e:
            yield f"data: {_json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

