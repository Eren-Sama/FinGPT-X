"""
RAG (Retrieval-Augmented Generation) service.
Handles document ingestion, embedding, and retrieval via ChromaDB.
100% offline — uses Ollama nomic-embed-text for embeddings.
"""

import asyncio
import threading
import httpx
from pathlib import Path

import chromadb

from core.config import get_settings

settings = get_settings()

# Lazy-loaded globals — protected by a lock to prevent double-init
_chroma_client: chromadb.ClientAPI | None = None
_chroma_lock = threading.Lock()
_chroma_failed = False  # Set to True after first failure to stop retrying


def _init_chroma_sync() -> chromadb.ClientAPI | None:
    """Synchronous ChromaDB initialization (run in thread executor)."""
    global _chroma_client, _chroma_failed
    if _chroma_failed:
        return None
    with _chroma_lock:
        if _chroma_client is not None:
            return _chroma_client
        try:
            _chroma_client = chromadb.PersistentClient(path=settings.chroma_persist_dir)
            print("[OK] ChromaDB initialized")
            return _chroma_client
        except Exception as e:
            print(f"[WARN] ChromaDB init failed: {e}. Document RAG disabled.")
            _chroma_failed = True
            return None


async def _get_chroma_async() -> chromadb.ClientAPI | None:
    """Get ChromaDB client, initializing in a thread to avoid event-loop blocking."""
    global _chroma_client
    if _chroma_client is not None:
        return _chroma_client
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _init_chroma_sync)


async def _get_collection_async(user_id: int = 0) -> chromadb.Collection | None:
    """Get or create a ChromaDB collection. Returns None if unavailable."""
    client = await _get_chroma_async()
    if client is None:
        return None
    try:
        return client.get_or_create_collection(
            name=f"fingpt_docs_{user_id}",
            metadata={"hnsw:space": "cosine"},
        )
    except Exception:
        return None


def _split_text(text: str, chunk_size: int = 512, overlap: int = 64) -> list[str]:
    """Split text into overlapping chunks for embedding."""
    words = text.split()
    chunks: list[str] = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i : i + chunk_size])
        if chunk.strip():
            chunks.append(chunk.strip())
        i += chunk_size - overlap
    return chunks


def _extract_text(file_path: str, file_type: str) -> str:
    """Extract text from PDF, CSV, or Excel file."""
    path = Path(file_path)

    if file_type == "pdf":
        import fitz  # PyMuPDF
        doc = fitz.open(str(path))
        text = "\n".join(page.get_text() for page in doc)
        doc.close()
        return text

    if file_type in ("csv",):
        import pandas as pd
        df = pd.read_csv(str(path))
        return df.to_string(index=False)

    if file_type in ("xlsx", "xls"):
        import pandas as pd
        df = pd.read_excel(str(path))
        return df.to_string(index=False)

    # Plain text fallback
    return path.read_text(encoding="utf-8", errors="ignore")


def _embed_via_ollama(texts: list[str]) -> list[list[float]]:
    """
    Generate embeddings using Ollama's nomic-embed-text model.
    Fully local — no external API calls.
    """
    embeddings = []
    with httpx.Client(timeout=60.0) as client:
        for text in texts:
            resp = client.post(
                f"{settings.ollama_base_url}/api/embed",
                json={"model": settings.ollama_embed_model, "input": text},
            )
            if resp.status_code == 200:
                data = resp.json()
                # Ollama /api/embed returns {"embeddings": [[...]]}
                emb = data.get("embeddings", [[]])[0]
                embeddings.append(emb)
            else:
                # Fallback: return zero vector (won't match well but won't crash)
                embeddings.append([0.0] * 768)
    return embeddings


async def ingest_document(
    file_path: str,
    filename: str,
    file_type: str,
    document_id: int,
    user_id: int = 0,
) -> int:
    """
    Ingest a document into ChromaDB.
    Returns the number of chunks embedded.
    """
    text = _extract_text(file_path, file_type.lower().lstrip("."))

    if not text.strip():
        return 0

    chunks = _split_text(text)
    if not chunks:
        return 0

    # Embed all chunks via Ollama nomic-embed-text
    embeddings = _embed_via_ollama(chunks)

    # Upsert into ChromaDB
    collection = await _get_collection_async(user_id)
    if collection is None:
        return 0  # RAG unavailable, skip embedding
    ids = [f"doc_{document_id}_chunk_{i}" for i in range(len(chunks))]
    metadatas = [
        {
            "document_id": document_id,
            "filename": filename,
            "chunk_index": i,
            "user_id": user_id,
        }
        for i in range(len(chunks))
    ]

    collection.upsert(
        ids=ids,
        documents=chunks,
        embeddings=embeddings,
        metadatas=metadatas,
    )

    return len(chunks)


async def semantic_search(
    query: str,
    user_id: int = 0,
    document_id: int | None = None,
    top_k: int = 5,
) -> list[dict]:
    """Semantic search across ingested documents."""
    collection = await _get_collection_async(user_id)
    if collection is None:
        return []

    try:
        if collection.count() == 0:
            return []
    except Exception:
        return []

    query_embedding = _embed_via_ollama([query])[0]

    where: dict | None = None
    if document_id is not None:
        where = {"document_id": document_id}

    try:
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, collection.count()),
            where=where,
            include=["documents", "metadatas", "distances"],
        )
    except Exception:
        return []

    chunks = []
    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]
    dists = results.get("distances", [[]])[0]

    for doc, meta, dist in zip(docs, metas, dists):
        chunks.append({
            "content": doc,
            "filename": meta.get("filename", ""),
            "document_id": meta.get("document_id"),
            "chunk_index": meta.get("chunk_index", 0),
            "relevance_score": round(1 - float(dist), 4),
        })

    return chunks


async def build_rag_context(
    query: str,
    user_id: int = 0,
    document_id: int | None = None,
    top_k: int = 4,
) -> str:
    """
    Build a RAG context string to inject into the LLM prompt.
    Returns formatted context block or empty string if no results.
    """
    context, _ = await build_rag_context_with_sources(query, user_id, document_id, top_k)
    return context


async def build_rag_context_with_sources(
    query: str,
    user_id: int = 0,
    document_id: int | None = None,
    top_k: int = 4,
) -> tuple[str, list[dict]]:
    """
    Build a RAG context string + return structured source objects.

    Each source dict:
        {
            "index": int,          # 1-based citation number [1], [2], …
            "filename": str,
            "document_id": int,
            "chunk_index": int,
            "relevance_score": float,
            "snippet": str,        # first 280 chars of the chunk
        }

    The context string instructs the LLM to cite sources as [1], [2], etc.
    """
    chunks = await semantic_search(query, user_id, document_id, top_k)
    if not chunks:
        return "", []

    sources: list[dict] = []
    context_parts = [
        "## Relevant Document Excerpts\n"
        "Cite sources using bracketed numbers like [1], [2] inline in your answer.\n"
    ]

    for i, chunk in enumerate(chunks, 1):
        sources.append({
            "index": i,
            "filename": chunk["filename"],
            "document_id": chunk["document_id"],
            "chunk_index": chunk["chunk_index"],
            "relevance_score": chunk["relevance_score"],
            "snippet": chunk["content"][:280].strip(),
        })
        context_parts.append(
            f"### Source [{i}]: {chunk['filename']} "
            f"(relevance: {chunk['relevance_score']:.2f})\n"
            f"{chunk['content']}\n"
        )

    return "\n".join(context_parts), sources


async def delete_document_embeddings(document_id: int, user_id: int = 0) -> None:
    """Remove all embeddings for a deleted document."""
    try:
        collection = await _get_collection_async(user_id)
        if collection is None:
            return
        results = collection.get(where={"document_id": document_id})
        if results["ids"]:
            collection.delete(ids=results["ids"])
    except Exception:
        pass

