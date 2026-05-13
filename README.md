<div align="center">

<img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/NextJS-Dark.svg" width="45" alt="Next.js" />
&nbsp;&nbsp;&nbsp;&nbsp;
<img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/FastAPI.svg" width="45" alt="FastAPI" />
&nbsp;&nbsp;&nbsp;&nbsp;
<img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/Python-Dark.svg" width="45" alt="Python" />
&nbsp;&nbsp;&nbsp;&nbsp;
<img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/TailwindCSS-Dark.svg" width="45" alt="Tailwind" />

<br/>

# FinGPT X

**A 100% Local, Zero-Latency AI Financial Research Platform**

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#quickstart">Quickstart</a>
</p>

</div>

---

## Overview

FinGPT X is a completely offline financial intelligence platform designed to rival enterprise-grade terminals without exposing user data. By directly integrating edge-models (like `phi3` or `llama3`) with a highly optimized SSE streaming pipeline, the platform allows users to converse with financial data, generate institutional risk reports, and perform semantic document analysis with absolute privacy.

No cloud APIs. No data harvesting. Complete data sovereignty.

---

## Features

- **Absolute Privacy**: Your portfolios, trading ideas, and sensitive SEC filings never leave your machine.
- **Sub-Second Streaming**: Bypassed Node.js buffering for direct Server-Sent Events, achieving a ~1.8s Time-To-First-Token.
- **AI Portfolio Risk Analyst**: Evaluates mock or real holdings for sector concentration, correlation, and rebalancing strategies.
- **Institutional Reports**: Autonomously generates highly-structured Markdown/PDF deep-dives complete with risk matrices.
- **Zero-Wait RAG**: Dynamic `ChromaDB` embedding engine that intelligently bypasses initialization if no documents are present.
- **Voice Interaction**: Speak directly to your financial data via an integrated, responsive voice assistant.

---

## Tech Stack

The platform is built on a highly decoupled microservice architecture:

### Frontend
- **Next.js 15 (React 19)** – App Router and Server Components.
- **Tailwind CSS v4** – Custom "True Black" monochrome design system.
- **Framer Motion** – Hardware-accelerated micro-interactions and layout transitions.
- **Zustand & React Query** – Optimistic UI state hydration.

### Backend
- **FastAPI (Python 3.12)** – Async event loops for high-concurrency streaming.
- **Ollama** – Localized LLM inference orchestrator.
- **SQLAlchemy & SQLite** – Relational persistence.
- **ChromaDB** – Semantic dense vector storage.

---

## Quickstart

### Prerequisites
1. **Node.js** (v20+) and **pnpm**
2. **Python** (v3.12+)
3. **[Ollama](https://ollama.com/)** installed locally

### Setup

**1. Pull the Inference Model**
```bash
ollama run phi3
```

**2. Clone the Repository**
```bash
git clone https://github.com/Eren-Sama/FinGPT-X.git
cd FinGPT-X
```

**3. Initialize the Backend**
```bash
cd apps/api
python -m venv .venv

# Activate the virtual environment
source .venv/bin/activate  # Windows: .venv\Scripts\activate

pip install -r requirements.txt
```

**4. Seed Market Data**
```bash
python seed_new_assets.py
python seed_portfolio.py
```

**5. Initialize the Frontend**
Open a new terminal window:
```bash
cd apps/web
pnpm install
```

### Launch

You can run both servers simultaneously using the provided start script from the root directory:
```bash
# Windows
.\start.bat

# Mac/Linux (run in separate terminals)
# Terminal 1: cd apps/api && uvicorn main:app --reload --port 8000
# Terminal 2: cd apps/web && pnpm dev
```

Visit **`http://localhost:3000`** to access the dashboard.

---

## License

This project is licensed under the MIT License.
