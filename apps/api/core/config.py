from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Server
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    debug: bool = False

    # Database
    database_url: str = "sqlite+aiosqlite:///./data/fingpt.db"

    # Security
    secret_key: str = "change-this-in-production-use-a-long-random-string"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "phi3:latest"
    ollama_embed_model: str = "nomic-embed-text"
    ollama_fallback_models: list[str] = ["deepseek-coder:latest", "llama3:8b", "mistral:7b", "gemma2:2b"]

    # ChromaDB
    chroma_persist_dir: str = "./data/chroma"

    # Local data paths
    csv_import_dir: str = "./data/csv"
    upload_dir: str = "./data/uploads"

    # CORS
    allowed_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
