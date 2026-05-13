"""Settings router — live config read/write backed by .env file."""

import json
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from core.config import get_settings

router = APIRouter(prefix="/api/settings", tags=["settings"])

# Path to the .env file relative to where the API process runs
_ENV_FILE = Path(".env")


def _read_env() -> dict[str, str]:
    """Parse the .env file into a key-value dict."""
    if not _ENV_FILE.exists():
        return {}
    result: dict[str, str] = {}
    for line in _ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, _, v = line.partition("=")
            result[k.strip()] = v.strip().strip('"').strip("'")
    return result


def _write_env(data: dict[str, str]) -> None:
    """Write key-value pairs back to .env, preserving comments and unrelated lines."""
    existing_lines: list[str] = []
    if _ENV_FILE.exists():
        existing_lines = _ENV_FILE.read_text(encoding="utf-8").splitlines()

    # Build a new file — update matching keys in-place, append new ones
    updated_keys: set[str] = set()
    output_lines: list[str] = []

    for line in existing_lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            output_lines.append(line)
            continue
        if "=" in stripped:
            k = stripped.partition("=")[0].strip()
            if k in data:
                output_lines.append(f'{k}="{data[k]}"')
                updated_keys.add(k)
                continue
        output_lines.append(line)

    # Append keys that didn't exist yet
    for k, v in data.items():
        if k not in updated_keys:
            output_lines.append(f'{k}="{v}"')

    _ENV_FILE.write_text("\n".join(output_lines) + "\n", encoding="utf-8")


# ─── Readable public config ───────────────────────────────────────────────────

@router.get("/")
async def get_config():
    """Return the current (safe, non-secret) configuration."""
    s = get_settings()
    return {
        "ollama_base_url": s.ollama_base_url,
        "ollama_model": s.ollama_model,
        "ollama_embed_model": s.ollama_embed_model,
        "ollama_fallback_models": s.ollama_fallback_models,
        "chroma_persist_dir": s.chroma_persist_dir,
        "csv_import_dir": s.csv_import_dir,
        "upload_dir": s.upload_dir,
        "allowed_origins": s.allowed_origins,
        "debug": s.debug,
        "env_file_exists": _ENV_FILE.exists(),
    }


# ─── Mutable fields ───────────────────────────────────────────────────────────

class SettingsPatch(BaseModel):
    ollama_base_url: str | None = None
    ollama_model: str | None = None
    ollama_embed_model: str | None = None
    debug: bool | None = None
    allowed_origins: list[str] | None = None


@router.patch("/")
async def patch_config(body: SettingsPatch):
    """
    Persist mutated settings to .env and invalidate the settings cache
    so the next call to get_settings() picks up the new values.
    """
    updates: dict[str, str] = {}

    if body.ollama_base_url is not None:
        updates["OLLAMA_BASE_URL"] = body.ollama_base_url.rstrip("/")

    if body.ollama_model is not None:
        updates["OLLAMA_MODEL"] = body.ollama_model.strip()

    if body.ollama_embed_model is not None:
        updates["OLLAMA_EMBED_MODEL"] = body.ollama_embed_model.strip()

    if body.debug is not None:
        updates["DEBUG"] = "true" if body.debug else "false"

    if body.allowed_origins is not None:
        # Store as JSON array string — pydantic_settings handles list parsing
        updates["ALLOWED_ORIGINS"] = json.dumps(body.allowed_origins)

    if not updates:
        return {"status": "no_change", "updated": []}

    _write_env(updates)

    # Bust the lru_cache so the next request picks up the new .env values
    get_settings.cache_clear()

    return {
        "status": "updated",
        "updated": list(updates.keys()),
        "note": "Changes written to .env. Restart the server for full effect on cached values.",
    }
