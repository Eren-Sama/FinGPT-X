"""Documents router — upload, list, delete, search, and RAG chat."""

import os
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.config import get_settings
from models.models import Document
from schemas.schemas import DocumentSearchRequest, DocumentChatRequest, DocumentOut
from services.rag_service import ingest_document, semantic_search, delete_document_embeddings, build_rag_context
from services.llm_service import stream_chat
from prompts.financial import FINANCIAL_ANALYST_SYSTEM_PROMPT

settings = get_settings()
router = APIRouter(prefix="/api/documents", tags=["documents"])

UPLOAD_DIR = Path(settings.upload_dir)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".csv", ".xlsx", ".xls", ".txt"}
MAX_FILE_SIZE_MB = 50


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    user_id: int = Form(default=0),
    db: AsyncSession = Depends(get_db),
):
    """Upload and ingest a financial document."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type {suffix} not supported. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_mb:.1f} MB). Maximum is {MAX_FILE_SIZE_MB} MB",
        )

    safe_name = f"{os.urandom(8).hex()}_{file.filename}"
    file_path = UPLOAD_DIR / safe_name
    file_path.write_bytes(content)

    doc = Document(
        user_id=user_id,
        filename=file.filename,
        file_path=str(file_path),
        file_type=suffix.lstrip("."),
        file_size=len(content),
        processed=False,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    try:
        chunk_count = await ingest_document(
            file_path=str(file_path),
            filename=file.filename,
            file_type=suffix.lstrip("."),
            document_id=doc.id,
            user_id=user_id,
        )
        doc.processed = True
        doc.chunk_count = chunk_count
        await db.commit()
    except Exception as e:
        doc.processed = False
        await db.commit()
        return {
            "id": doc.id,
            "filename": file.filename,
            "status": "error",
            "error": str(e),
        }

    return {
        "id": doc.id,
        "filename": file.filename,
        "file_type": suffix.lstrip("."),
        "file_size": len(content),
        "chunk_count": chunk_count,
        "status": "ready",
    }


@router.get("/")
async def list_documents(
    user_id: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """List all uploaded documents for a user."""
    result = await db.execute(
        select(Document)
        .where(Document.user_id == user_id)
        .order_by(Document.uploaded_at.desc())
    )
    docs = result.scalars().all()
    return [
        DocumentOut(
            id=d.id,
            filename=d.filename,
            file_type=d.file_type,
            file_size=d.file_size,
            chunk_count=d.chunk_count,
            processed=d.processed,
            uploaded_at=d.uploaded_at.isoformat(),
        )
        for d in docs
    ]


@router.delete("/{document_id}")
async def delete_document(
    document_id: int,
    user_id: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Delete a document and its embeddings."""
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        Path(doc.file_path).unlink(missing_ok=True)
    except Exception:
        pass

    await delete_document_embeddings(document_id, user_id)
    await db.delete(doc)
    await db.commit()
    return {"status": "deleted", "id": document_id}


@router.post("/search")
async def search_documents(request: DocumentSearchRequest):
    """Semantic search across ingested documents."""
    results = await semantic_search(
        query=request.query,
        user_id=request.user_id,
        document_id=request.document_id,
        top_k=request.top_k,
    )
    return {"query": request.query, "results": results}


@router.post("/chat/stream")
async def document_chat_stream(request: DocumentChatRequest):
    """Stream a RAG-powered document chat response."""
    context = await build_rag_context(
        query=request.message,
        user_id=request.user_id,
        document_id=request.document_id,
    )

    history = [{"role": m.role, "content": m.content} for m in request.history]

    return StreamingResponse(
        stream_chat(
            message=request.message,
            history=history,
            session_id=request.session_id,
            rag_context=context,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
