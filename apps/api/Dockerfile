# ─────────────────────────────────────────────────────────────────────────────
# FinGPT X v2.0 — FastAPI Backend Dockerfile
# Multi-stage build for a lean production image
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /build

# System deps needed to compile C extensions (PyMuPDF, aiosqlite, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps into an isolated prefix for easy COPY
COPY requirements.txt .
RUN pip install --prefix=/install --no-cache-dir -r requirements.txt

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Runtime system libs only (no gcc)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy application source
COPY . .

# Create persistent data directories
RUN mkdir -p ./data/chroma ./data/uploads ./data/csv

# Non-root user for security
RUN useradd -m -u 1001 fingpt && chown -R fingpt:fingpt /app
USER fingpt

EXPOSE 8000

# Health check — hits the /api/health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
