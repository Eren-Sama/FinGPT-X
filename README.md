<div align="center">

<img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/NextJS-Dark.svg" width="50" alt="Next.js" />
&nbsp;&nbsp;&nbsp;&nbsp;
<img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/FastAPI.svg" width="50" alt="FastAPI" />
&nbsp;&nbsp;&nbsp;&nbsp;
<img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/Python-Dark.svg" width="50" alt="Python" />
&nbsp;&nbsp;&nbsp;&nbsp;
<img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/TailwindCSS-Dark.svg" width="50" alt="Tailwind" />

<br/><br/>

# 🚀 FinGPT X v2.0

**Institutional-Grade Financial Intelligence. 100% Locally Hosted.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black.svg?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Ollama](https://img.shields.io/badge/Ollama-Offline_Inference-black?logo=ollama)](https://ollama.com/)

<p align="center">
  <a href="#-philosophy">Philosophy</a> •
  <a href="#-core-features">Features</a> •
  <a href="#-architecture--stack">Architecture</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-usage">Usage</a>
</p>

</div>

---

## ⚡ Philosophy

Most modern AI financial tools are thin wrappers around OpenAI or Anthropic. This exposes user trading strategies, portfolios, and sensitive financial documents to the cloud while suffering from unpredictable API latency.

**FinGPT X flips the paradigm.** It proves that with aggressive architectural optimization, intelligent context window management, and modern edge-models (like `phi3`), it is possible to achieve instantaneous, world-class financial intelligence running entirely on consumer-grade local silicon.

No API keys. No data harvesting. Absolute privacy.

---

## ✨ Core Features

| Feature | Description |
| :--- | :--- |
| **🛡️ 100% Offline Privacy** | Your portfolios and sensitive documents never leave your machine. Runs securely on localhost. |
| **⚡ Zero-Latency Streaming** | Direct Server-Sent Events (SSE) bypass Node.js buffering, achieving an incredible **~1.8s Time-To-First-Token (TTFT)**. |
| **📑 Institutional Reports** | AI autonomously acts as a Senior Equity Analyst, generating strictly formatted Markdown/PDF deep-dives complete with risk matrices. |
| **📊 AI Portfolio Analyst** | Evaluates your mock/real holdings for sector concentration, correlation overlap, and suggests actionable rebalancing strategies. |
| **🧠 Zero-Wait RAG** | Dynamic `ChromaDB` embedding engine that instantly bypasses initialization if no documents are uploaded, saving dead-load delays. |
| **🎙️ Voice Assistant** | Speak directly to your financial data via an integrated voice-interaction engine. |

---

## 🏗 Architecture & Stack

FinGPT X runs on a highly decoupled microservice architecture:

- **Frontend (Presentation):** [Next.js 15](https://nextjs.org/) (React 19), [Tailwind CSS v4](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/) for hardware-accelerated animations, and Zustand/React Query for optimistic UI state hydration.
- **Backend (Intelligence):** [FastAPI](https://fastapi.tiangolo.com/) (Python 3.12) utilizing async event loops.
- **Data Persistence:** Local `SQLite` (via SQLAlchemy) for relational storage, and `ChromaDB` for semantic dense vector storage of SEC filings and PDFs.
- **Inference Engine:** [Ollama](https://ollama.com/) acting as the orchestrator for lightweight, lightning-fast edge models (`phi3:latest`).

---

## 🚀 Getting Started

### Prerequisites
Before starting, ensure you have the following installed:
1. **Node.js** (v20+) and **pnpm**
2. **Python** (v3.12+)
3. **[Ollama](https://ollama.com/)** running locally

### 1. Model Initialization
Pull the lightweight `phi3` edge model required for zero-latency execution:
```bash
ollama run phi3
```

### 2. Clone & Setup Backend
```bash
git clone https://github.com/Eren-Sama/FinGPT-X.git
cd FinGPT-X/apps/api

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # (On Windows use: .venv\Scripts\activate)

# Install requirements
pip install -r requirements.txt
```

### 3. Seed Local Market Data
Generate realistic mock financial data for the platform to analyze:
```bash
python seed_new_assets.py
python seed_portfolio.py
```

### 4. Setup Frontend
Open a new terminal window:
```bash
cd FinGPT-X/apps/web
pnpm install
```

### 5. Launch the Platform
You can run both servers simultaneously using the provided root start script:
```bash
# Windows
.\start.bat

# Mac/Linux (run these in separate terminals)
# Terminal 1 (Backend): cd apps/api && uvicorn main:app --reload --port 8000
# Terminal 2 (Frontend): cd apps/web && pnpm dev
```

Visit **`http://localhost:3000`** to access your dashboard!

---

## 📖 Usage

- **Dashboard:** View mock market sentiment and trending assets.
- **Research Desk:** Chat directly with the Phi-3 model about general market mechanics or specific assets. Upload PDFs (like 10-K filings) and the engine will automatically switch to Retrieval-Augmented Generation (RAG).
- **Reports:** Generate exhaustive Wall Street-style PDFs with structured markdown tables and executive summaries.
- **Portfolio:** Track holdings and run the Chief Risk Officer AI analysis.

---

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details. 
*Designed and optimized for localized financial sovereignty.*
