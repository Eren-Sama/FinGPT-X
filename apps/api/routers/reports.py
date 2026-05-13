"""
AI Financial Report Generator router.
Generates long-form structured financial reports via Ollama and exports them
as Markdown or PDF. 100% offline.
"""

import json
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.models import Report
from schemas.schemas import ReportCreate, ReportOut
from services.llm_service import detect_active_model
from services.report_service import generate_report_prompt, render_pdf
import httpx
from core.config import get_settings

router = APIRouter(prefix="/api/reports", tags=["reports"])
settings = get_settings()


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/reports/generate  — Streaming SSE report generation
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/generate")
async def generate_report(payload: ReportCreate, db: AsyncSession = Depends(get_db)):
    """
    Stream a full structured financial report as SSE tokens.
    Automatically persists the completed report to the database.
    """
    model = await detect_active_model()
    if not model:
        raise HTTPException(503, "No Ollama model detected. Run: ollama pull llama3:8b")

    system_prompt, user_prompt = generate_report_prompt(
        report_type=payload.report_type,
        subject=payload.subject,
        context=payload.context or "",
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    ollama_payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "keep_alive": -1,
        "options": {
            "temperature": 0.4,
            "top_p": 0.9,
            "num_ctx": 4096,
            "num_predict": 2048,
        },
    }

    accumulated: list[str] = []

    async def generate():
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(300.0, connect=5.0)
            ) as client:
                async with client.stream(
                    "POST",
                    f"{settings.ollama_base_url}/api/chat",
                    json=ollama_payload,
                ) as response:
                    if response.status_code != 200:
                        yield f"data: {json.dumps({'token': f'Error: Ollama returned {response.status_code}'})}\n\n"
                        yield "data: [DONE]\n\n"
                        return

                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            chunk = json.loads(line)
                            token = chunk.get("message", {}).get("content", "")
                            if token:
                                accumulated.append(token)
                                yield f"data: {json.dumps({'token': token})}\n\n"
                            if chunk.get("done"):
                                # Persist completed report
                                full_content = "".join(accumulated)
                                report = Report(
                                    user_id=payload.user_id,
                                    title=payload.subject,
                                    report_type=payload.report_type,
                                    subject=payload.subject,
                                    content=full_content,
                                )
                                db.add(report)
                                await db.commit()
                                await db.refresh(report)
                                yield f"data: {json.dumps({'done': True, 'report_id': report.id})}\n\n"
                                yield "data: [DONE]\n\n"
                                return
                        except json.JSONDecodeError:
                            continue

        except httpx.ConnectError:
            yield f"data: {json.dumps({'token': '⚠️ Cannot connect to Ollama. Ensure it is running: `ollama serve`'})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'token': f'⚠️ Stream error: {str(e)}'})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/reports/  — List saved reports
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/", response_model=list[ReportOut])
async def list_reports(user_id: int = 0, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Report)
        .where((Report.user_id == user_id) | (Report.user_id.is_(None)))
        .order_by(Report.created_at.desc())
    )
    return [
        ReportOut(
            id=r.id,
            title=r.title,
            report_type=r.report_type,
            subject=r.subject,
            content=r.content,
            created_at=r.created_at.isoformat(),
        )
        for r in result.scalars().all()
    ]


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/reports/{id}  — Fetch a single report
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/{report_id}", response_model=ReportOut)
async def get_report(report_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(404, "Report not found")
    return ReportOut(
        id=report.id,
        title=report.title,
        report_type=report.report_type,
        subject=report.subject,
        content=report.content,
        created_at=report.created_at.isoformat(),
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/reports/{id}/export/markdown  — Download as .md file
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/{report_id}/export/markdown")
async def export_markdown(report_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(404, "Report not found")

    filename = f"{report.subject.replace(' ', '_')}_{report.report_type}.md"
    content_bytes = report.content.encode("utf-8")

    return Response(
        content=content_bytes,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/reports/{id}/export/pdf  — Download as .pdf file
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/{report_id}/export/pdf")
async def export_pdf(report_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(404, "Report not found")

    pdf_bytes = render_pdf(
        title=report.title,
        report_type=report.report_type,
        subject=report.subject,
        content=report.content,
        created_at=report.created_at,
    )

    filename = f"{report.subject.replace(' ', '_')}_{report.report_type}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─────────────────────────────────────────────────────────────────────────────
# DELETE /api/reports/{id}
# ─────────────────────────────────────────────────────────────────────────────
@router.delete("/{report_id}")
async def delete_report(report_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(404, "Report not found")
    await db.delete(report)
    await db.commit()
    return {"status": "deleted", "id": report_id}
