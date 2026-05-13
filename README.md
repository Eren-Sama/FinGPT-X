<div align="center">
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/NextJS-Dark.svg" width="40" alt="Next.js" />
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/FastAPI.svg" width="40" alt="FastAPI" />
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/Python-Dark.svg" width="40" alt="Python" />
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/TailwindCSS-Dark.svg" width="40" alt="Tailwind CSS" />
  
  <br/><br/>
  
  <h1>FinGPT X v2.0</h1>
  <p><strong>A 100% Local, Zero-Latency AI Financial Research Platform</strong></p>
  
  <p>
    <a href="#features">Features</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#installation">Installation</a> •
    <a href="#architecture">Architecture</a>
  </p>
</div>

<hr />

## ⚡ Overview

**FinGPT X** is an institutional-grade financial intelligence platform designed to run entirely on local silicon. By directly integrating **Ollama** with a highly optimized decoupled microservice architecture, FinGPT X allows users to converse with financial data, generate risk reports, and perform semantic RAG on SEC filings in absolute privacy.

No OpenAI keys. No cloud latency. No data harvesting.

## ✨ Features

- 🕵️ **Absolute Privacy:** 100% offline execution. Your portfolios, trading ideas, and sensitive documents never leave your machine.
- ⚡ **Zero-Latency Streams:** Bypassed Node.js buffering for direct Server-Sent Events (SSE) from the LLM, achieving a sub-2-second Time-To-First-Token (TTFT).
- 📊 **AI Portfolio Risk Analyst:** Evaluates sector concentration, correlation overlap, and provides actionable rebalancing suggestions.
- 📑 **Institutional Report Generator:** Autonomously writes structured Markdown/PDF reports with Executive Summaries, Bear/Bull cases, and Valuation Metrics.
- 🎙️ **Native Voice Interaction:** Speak directly to your financial data via an integrated, responsive voice assistant.
- 🧠 **Zero-Wait RAG:** Dynamic ChromaDB embedding engine that intelligently bypasses initialization if no documents are present to prevent dead-load delays.

## 🛠 Tech Stack

### Frontend
- **Next.js 15 (App Router)** & **React 19**
- **Tailwind CSS v4** & **Framer Motion** for a sleek, hardware-accelerated "True Black" monochrome aesthetic.
- **Zustand** & **React Query** for optimistic UI hydration.

### Backend
- **Python 3.12** & **FastAPI**
- **Ollama** for localized LLM inference (optimized for `phi3:latest` and `llama3`).
- **SQLAlchemy** & **SQLite** for relational persistence.
- **ChromaDB** for semantic dense vector storage.

---

## 🚀 Installation & Setup

### Prerequisites
1. Install [Ollama](https://ollama.com/) and pull the required model:
   ```bash
   ollama run phi3
   ```
2. Ensure you have **Node.js (v20+)**, **pnpm**, and **Python 3.12+** installed.

### 1. Clone the Repository
```bash
git clone https://github.com/Eren-Sama/FinGPT-X.git
cd FinGPT-X
```

### 2. Setup the Backend
Navigate to the API directory and install Python dependencies:
```bash
cd apps/api
python -m venv .venv

# Windows
.venv\Scripts\activate
# Mac/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 3. Seed Local Market Data
Generate realistic, localized mock financial data:
```bash
python seed_new_assets.py
python seed_portfolio.py
```

### 4. Setup the Frontend
Open a new terminal, navigate to the web directory, and install Node dependencies:
```bash
cd apps/web
pnpm install
```

### 5. Run the Platform
You can run both servers simultaneously using the provided root start script:
```bash
# Windows
.\start.bat

# Mac/Linux (run these in separate terminals)
# Terminal 1 (Backend): cd apps/api && uvicorn main:app --reload --port 8000
# Terminal 2 (Frontend): cd apps/web && pnpm dev
```

Visit `http://localhost:3000` to access your local Bloomberg Terminal alternative!

---

## 🔒 License
This project is open-source and available under the MIT License.
