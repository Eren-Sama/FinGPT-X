"""
Voice AI router — browser-side speech-to-text + LLM response streaming.
Uses the Web Speech API on the frontend; this endpoint handles:
  POST /api/voice/transcribe — accepts raw audio text and streams LLM response
  GET  /api/voice/tts        — text-to-speech via browser (handled client-side)
"""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.llm_service import stream_chat

router = APIRouter(prefix="/api/voice", tags=["voice"])


class VoiceQueryRequest(BaseModel):
    transcript: str          # The text transcribed from speech
    session_id: str = ""
    history: list[dict] = []
    user_id: int = 0
    mode: str = "general"    # general | stock | macro | risk


@router.post("/query")
async def voice_query(request: VoiceQueryRequest):
    """
    Accept a voice transcript and stream a concise LLM response.
    The frontend handles speech synthesis (TTS) via the Web Speech API.
    """
    # For voice responses: keep answers shorter and more conversational
    voice_prompt_suffix = (
        "\n\nIMPORTANT: This is a voice interaction. "
        "Keep your response concise (2-4 sentences max), conversational, "
        "and avoid markdown, bullet points, or tables. Speak naturally."
    )

    return StreamingResponse(
        _stream_voice(request, voice_prompt_suffix),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
            "X-Session-Id": request.session_id or "voice",
        },
    )


async def _stream_voice(request: VoiceQueryRequest, suffix: str):
    """Wrap stream_chat with a voice-optimized message."""
    message_with_hint = request.transcript + suffix
    async for chunk in stream_chat(
        message=message_with_hint,
        history=request.history,
        session_id=request.session_id or "voice-session",
        rag_context="",
    ):
        yield chunk
