"""
Ollama LLM service — streaming, model detection, RAG integration.
100% offline via local Ollama instance.
"""

import httpx
import json
import uuid
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import get_settings
from prompts.financial import build_system_prompt

settings = get_settings()

import time

_active_model_cache: str | None = None
_active_model_time: float = 0

async def detect_active_model() -> str | None:
    """Detect which Ollama model is available, in order of preference."""
    global _active_model_cache, _active_model_time
    if _active_model_cache and time.time() - _active_model_time < 60:
        return _active_model_cache

    preferred = [settings.ollama_model] + settings.ollama_fallback_models

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.ollama_base_url}/api/tags")
            if resp.status_code != 200:
                return None

            data = resp.json()
            available = data.get("models", [])
            available_names = {m["name"] for m in available}

            for model in preferred:
                base = model.split(":")[0]
                if model in available_names:
                    _active_model_cache = model
                    _active_model_time = time.time()
                    return model
                # Match by base name (e.g. "phi3" matches "phi3:latest")
                for m in available:
                    if m["name"].startswith(base):
                        _active_model_cache = m["name"]
                        _active_model_time = time.time()
                        return m["name"]
    except Exception:
        pass

    return None


async def health_check() -> dict:
    """Check Ollama connectivity and available models."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{settings.ollama_base_url}/api/tags")
            if resp.status_code == 200:
                data = resp.json()
                models = [m["name"] for m in data.get("models", [])]
                active = await detect_active_model()
                return {
                    "status": "connected",
                    "models": models,
                    "active_model": active,
                    "embed_model": settings.ollama_embed_model,
                }
    except Exception as e:
        return {"status": "disconnected", "error": str(e), "models": [], "active_model": None}

    return {"status": "disconnected", "models": [], "active_model": None}


def _detect_query_mode(message: str) -> str:
    """Detect the analysis mode from the user's message."""
    lower = message.lower()
    if any(w in lower for w in ["stock", "share", "equity", "ticker", "eps", "pe ratio", "earnings"]):
        return "stock"
    if any(w in lower for w in ["inflation", "fed", "interest rate", "gdp", "macro", "recession", "monetary"]):
        return "macro"
    if any(w in lower for w in ["risk", "volatility", "drawdown", "hedge", "downside", "protection"]):
        return "risk"
    return "general"


async def stream_chat(
    message: str,
    history: list[dict],
    session_id: str,
    rag_context: str = "",
) -> AsyncGenerator[str, None]:
    """Stream a chat response as SSE tokens from Ollama."""
    model = await detect_active_model()

    if not model:
        yield f"data: {json.dumps({'token': '⚠️ No Ollama model available. Run: ollama pull phi3'})}\n\n"
        yield "data: [DONE]\n\n"
        return

    mode = _detect_query_mode(message)
    system_prompt = build_system_prompt(mode)

    # Inject RAG context into system prompt if available
    if rag_context:
        system_prompt += "\n\n" + rag_context + (
            "\n\nUse the document excerpts above to ground your answer. "
            "Cite specific sections when relevant. If the answer is not in the documents, say so."
        )

    # Build message history (last 2 turns only — context is tight at 512 tokens)
    messages = [{"role": "system", "content": system_prompt}]
    for h in history[-2:]:
        if h.get("role") in ("user", "assistant") and h.get("content"):
            # Truncate long history entries to save context
            content = h["content"][:300]
            messages.append({"role": h["role"], "content": content})
    messages.append({"role": "user", "content": message})

    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "keep_alive": -1,
        "options": {
            "temperature": 0.5,
            "top_p": 0.8,
            "num_ctx": 4096,
            "num_predict": 2048,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=5.0)) as client:
            async with client.stream(
                "POST",
                f"{settings.ollama_base_url}/api/chat",
                json=payload,
            ) as response:
                if response.status_code != 200:
                    # Read the actual error from Ollama for a helpful message
                    try:
                        body = await response.aread()
                        err_data = json.loads(body)
                        err_msg = err_data.get("error", f"HTTP {response.status_code}")
                    except Exception:
                        err_msg = f"HTTP {response.status_code}"

                    if "CUDA" in err_msg or "buffer" in err_msg or "memory" in err_msg or "terminate" in err_msg:
                        friendly = (
                            f"⚠️ **GPU/RAM out of memory** — Ollama cannot load `{model}` "
                            f"({err_msg[:120]}).\n\n"
                            "**Quick fix:** Go to **Settings → Local AI Engine** and switch to a smaller model "
                            "like `phi3:latest` (2.2 GB) or `deepseek-coder:latest`, then try again."
                        )
                    else:
                        friendly = f"⚠️ Ollama error: {err_msg}"

                    yield f"data: {json.dumps({'token': friendly})}\n\n"
                    yield "data: [DONE]\n\n"
                    return

                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                        token = chunk.get("message", {}).get("content", "")
                        if token:
                            yield f"data: {json.dumps({'token': token})}\n\n"
                        if chunk.get("done"):
                            yield "data: [DONE]\n\n"
                            return
                    except json.JSONDecodeError:
                        continue

    except httpx.ConnectError:
        yield f"data: {json.dumps({'token': '⚠️ Cannot connect to Ollama. Make sure it is running: `ollama serve`'})}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'token': f'⚠️ Stream error: {str(e)}'})}\n\n"
        yield "data: [DONE]\n\n"


async def generate_title(message: str) -> str:
    """Generate a short title for a chat session from the first message."""
    model = await detect_active_model()
    if not model:
        return message[:50]

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{settings.ollama_base_url}/api/chat",
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": "Generate a very short title (max 6 words) for this conversation. Return ONLY the title, no quotes or punctuation."},
                        {"role": "user", "content": message},
                    ],
                    "stream": False,
                    "keep_alive": -1,
                    "options": {"temperature": 0.3, "num_ctx": 256, "num_predict": 20},
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                title = data.get("message", {}).get("content", "").strip()
                return title[:60] if title else message[:50]
    except Exception:
        pass

    return message[:50]
