"""Chat router — streaming SSE with session persistence."""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.models import ChatSession, ChatMessage
from schemas.schemas import ChatRequest, ChatSessionOut, ChatMessageOut
from services.llm_service import stream_chat, generate_title
from services.rag_service import build_rag_context_with_sources

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/stream")
async def chat_stream(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Stream a chat response as Server-Sent Events with session persistence."""
    # Create or fetch session
    session_id = request.session_id or str(uuid.uuid4())

    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()

    if not session:
        session = ChatSession(
            id=session_id,
            user_id=request.user_id if request.user_id else None,
            title="New Chat",
        )
        db.add(session)
        await db.commit()

    # Persist user message
    user_msg = ChatMessage(
        session_id=session_id,
        role="user",
        content=request.message,
    )
    db.add(user_msg)
    await db.commit()

    # Build history from request (frontend sends last N turns)
    history = [{"role": m.role, "content": m.content} for m in request.history]

    # Build RAG context — only if user has uploaded documents (avoids 1.4s ChromaDB init)
    rag_context = ""
    sources: list[dict] = []
    try:
        doc_count_result = await db.execute(text("SELECT COUNT(*) FROM documents"))
        doc_count = doc_count_result.scalar() or 0
        if doc_count > 0:
            rag_context, sources = await build_rag_context_with_sources(
                query=request.message,
                user_id=request.user_id,
            )
    except Exception:
        pass

    # Accumulate full response for persistence
    accumulated: list[str] = []

    async def generate():
        import json as _json

        async for chunk in stream_chat(request.message, history, session_id, rag_context):
            # Extract token for accumulation
            if chunk.startswith("data: ") and "[DONE]" not in chunk:
                try:
                    payload = _json.loads(chunk[6:].strip())
                    token = payload.get("token", "")
                    if token:
                        accumulated.append(token)
                except Exception:
                    pass
            elif "[DONE]" in chunk:
                # Emit DONE with source metadata before finishing
                done_payload = _json.dumps({"done": True, "sources": sources})
                yield f"data: {done_payload}\n\n"
                # Persist assistant message with sources
                full_response = "".join(accumulated)
                if full_response:
                    asst_msg = ChatMessage(
                        session_id=session_id,
                        role="assistant",
                        content=full_response,
                        sources=_json.dumps(sources) if sources else None,
                    )
                    db.add(asst_msg)
                    # Instant title from the user message — no LLM call
                    if session.title == "New Chat":
                        words = request.message.strip().split()
                        session.title = " ".join(words[:8]) if len(words) > 8 else request.message[:60]
                    await db.commit()
                return
            yield chunk

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
            "X-Session-Id": session_id,
        },
    )


@router.get("/sessions")
async def list_sessions(user_id: int = 0, db: AsyncSession = Depends(get_db)):
    """List all chat sessions for a user."""
    result = await db.execute(
        select(ChatSession)
        .where(
            (ChatSession.user_id == user_id) | (ChatSession.user_id.is_(None))
        )
        .order_by(ChatSession.updated_at.desc())
    )
    sessions = result.scalars().all()

    out = []
    for s in sessions:
        msg_count_result = await db.execute(
            select(func.count(ChatMessage.id)).where(ChatMessage.session_id == s.id)
        )
        count = msg_count_result.scalar() or 0
        out.append(ChatSessionOut(
            id=s.id,
            title=s.title,
            created_at=s.created_at.isoformat(),
            updated_at=s.updated_at.isoformat(),
            message_count=count,
        ))

    return out


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get all messages in a chat session."""
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    msg_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    messages = msg_result.scalars().all()

    return {
        "id": session.id,
        "title": session.title,
        "messages": [
            ChatMessageOut(
                id=m.id,
                role=m.role,
                content=m.content,
                sources=m.sources,
                created_at=m.created_at.isoformat(),
            )
            for m in messages
        ],
    }


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a chat session and all its messages."""
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    await db.delete(session)
    await db.commit()
    return {"status": "deleted", "id": session_id}
