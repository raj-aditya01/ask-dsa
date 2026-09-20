# ASK-DSA: Enterprise-Grade RAG AI Tutor for Algorithms

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-0.5+-orange.svg)](https://www.trychroma.com)
[![Groq LLM](https://img.shields.io/badge/Groq-Cloud-f55036.svg)](https://groq.com)
[![Tests](https://img.shields.io/badge/tests-29%20passed%20%7C%20100%25-brightgreen.svg)](tests/)

**ASK-DSA** is an intelligent Data Structures & Algorithms (DSA) tutor and problem-retrieval engine. It combines two-stage hybrid search (Title-Boosted BM25 + Dense ChromaDB Vector Search fused via Reciprocal Rank Fusion) with a Cross-Encoder semantic reranker, grounded prompt engineering, and high-throughput Groq LLM answer generation with real-time token streaming.

---

## Key Features

- **Multi-Field Hybrid Retrieval**: 
  - Sparse lexical search via **BM25Okapi** (with a 3.5x boost on problem titles and exact-substring match bonuses).
  - Dense semantic vector search via **ChromaDB** and `sentence-transformers/all-MiniLM-L6-v2`.
  - **Reciprocal Rank Fusion (RRF)** merging sparse and dense candidate pools into a unified top-40 set.
- **Stage-2 Cross-Encoder Precision Reranker**:
  - Re-evaluates candidates using `cross-encoder/ms-marco-MiniLM-L-6-v2` for cross-attention contextual relevance.
- **Adaptive RAG Query Classification**:
  - Classifies user intent into `specific_qa` (high-precision problem resolution) or `exploratory` (diverse multi-technique comparisons).
  - Normalizes aliases (`dp` $\to$ `Dynamic Programming`, `heap` $\to$ `Heap (Priority Queue)`).
- **Production FastAPI Backend**:
  - Fully asynchronous with lifespan model pre-warming (zero first-request cold-start penalty).
  - Standardized JSON responses (RFC 7807) with per-stage latency metrics (`retrieval_ms`, `generation_ms`, `total_ms`).
  - IP-based rate limiting via SlowAPI and CORS pre-configured.
- **Built-in Web Dashboard & SSE Streaming**:
  - Clean, distraction-free Cockpit interface served directly by FastAPI (zero Node/npm build steps required).
  - Real-time Server-Sent Events (SSE) streaming token output.
  - Interactive LeetCode problem cards with topic tags and rerank scores.
  - Formatted Python code blocks with syntax highlighting and one-click clipboard copying.
- **Interactive Terminal Assistant (`cli.py`)**:
  - Interactive REPL and one-shot command-line interface.
- **Automated Test Suite**:
  - 29 unit, integration, and API tests with 100% pass rate.

---

## System Architecture

```
User Query ("How to detect cycle in linked list?")
       │
       ▼
┌────────────────────────────────────────┐
│  Adaptive Query Classifier & Modifier  │  <-- Strips conversational filler,
│  (retrieval/query_modifier.py)         │      extracts topics & difficulty
└──────────────────┬─────────────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌──────────────────┐ ┌──────────────────┐
│ Multi-Field BM25 │ │ Dense Vector DB  │
│ (Title 3.5x)     │ │ (ChromaDB MiniLM)│
└────────┬─────────┘ └────────┬─────────┘
         │                    │
         └─────────┬──────────┘
                   ▼
┌────────────────────────────────────────┐
│   Reciprocal Rank Fusion (RRF)         │  <-- Top-40 candidate pool
└──────────────────┬─────────────────────┘
                   ▼
┌────────────────────────────────────────┐
│   Stage-2 Cross-Encoder Reranker       │  <-- ms-marco-MiniLM-L-6-v2
└──────────────────┬─────────────────────┘
                   ▼
┌────────────────────────────────────────┐
│      Top-K Relevant Problems           │
└──────────────────┬─────────────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌──────────────────┐ ┌──────────────────┐
│ Web Dashboard    │ │ Groq LLM Client  │  <-- Grounded Prompt Assembly
│ & OpenAPI Docs   │ │ (Sync / SSE)     │      with Code & Complexity
└──────────────────┘ └──────────────────┘
```

---

## Quick Start on Windows

Follow these steps to spin up the project on your Windows laptop.

### 1. Prerequisites

- **Python 3.11 or higher** installed ([Download from python.org](https://www.python.org/downloads/)).
  - *Ensure "Add Python to PATH" is checked during installation.*
- **Git for Windows** installed ([Download git-scm.com](https://git-scm.com/)).

---

### 2. Clone the Repository

Open **PowerShell** or **Command Prompt** and navigate to your desired directory:

```powershell
git clone <your-repo-url>
cd ASK-dsa
```

---

### 3. Create & Activate a Virtual Environment

```powershell
# Create virtual environment named .venv
python -m venv .venv

# Activate the virtual environment
.venv\Scripts\Activate.ps1
```

> **PowerShell Execution Policy Note**: If you receive a script execution error on Windows, run this in your PowerShell session:
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> .venv\Scripts\Activate.ps1
> ```

---

### 4. Install Dependencies

Install all required production and testing dependencies:

```powershell
pip install -r requirements.txt
```

---

### 5. Configure Your Environment Variables

1. Copy the template environment configuration file:
   ```powershell
   copy .env.example .env
   ```

2. Open `.env` in any text editor (e.g. Notepad, VS Code) and add your Groq Cloud API key:
   ```ini
   GROQ_API_KEY=gsk_your_actual_groq_api_key_here
   GROQ_MODEL=openai/gpt-oss-120b
   ```
   *(Get a free, instant Groq API key at [console.groq.com](https://console.groq.com)).*

---

## Running the Application

### Option A: Launch the Web Dashboard & API Server (Recommended)

Start the production Uvicorn server:

```powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Once the server initializes:
- **Interactive Web Dashboard**: Open [http://localhost:8000/](http://localhost:8000/) or [http://localhost:8000/dashboard](http://localhost:8000/dashboard) in your browser.
- **Interactive OpenAPI/Swagger Documentation**: Open [http://localhost:8000/docs](http://localhost:8000/docs).
- **Health Check & Telemetry**: Open [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health).

---

### Option B: Interactive Terminal Assistant (`cli.py`)

To run the assistant directly in your terminal without opening a browser:

```powershell
# Interactive chat mode
python cli.py

# Direct one-shot question
python cli.py "How to detect a cycle in a linked list?"

# Clean mode (hide source table and only stream solution)
python cli.py "Explain LRU Cache" --no-sources
```

---

### Option C: Standalone Generation & Streaming Scripts

```powershell
# Test synchronous retrieval & generation
python test_generator.py

# Test token-by-token terminal streaming
python test_streaming.py

# Test retrieval-only ranking (without LLM)
python ingestion/search.py
```

---

## Running Automated Tests

Run the complete test suite (29 tests covering query modification, adaptive routing, BM25, RRF fusion, cross-encoder reranking, generator formatting, API endpoints, and dashboard serving):

```powershell
pytest -v
```

To run individual test modules:
```powershell
# Test API endpoints and web dashboard serving
pytest tests/test_api.py -v

# Test Query Modifier and Topic Detection
pytest tests/test_query_modifier.py -v

# Test Hybrid Retriever (BM25 + Dense + RRF)
pytest tests/test_hybrid_retriever.py -v

# Test Cross-Encoder Reranker
pytest tests/test_reranker.py -v

# Test Generator Prompt Assembly & Mock LLM
pytest tests/test_generator.py -v
```

---

## API Reference

All endpoints are versioned under `/api/v1`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` or `/dashboard` | Serves the interactive Web Dashboard Cockpit. |
| `GET` | `/docs` | Interactive Swagger UI documentation. |
| `GET` | `/api/v1/health` | Health status of API, ChromaDB vector store, and Groq LLM. |
| `POST` | `/api/v1/retrieve` | Semantic candidate search & cross-encoder reranking only. |
| `POST` | `/api/v1/ask` | Synchronous RAG solution generation with grounded sources. |
| `POST` / `GET` | `/api/v1/ask/stream` | Real-time Server-Sent Events (SSE) token streaming. |

### Example cURL Requests

#### Pure Retrieval:
```bash
curl -X POST http://localhost:8000/api/v1/retrieve \
  -H "Content-Type: application/json" \
  -d '{"query": "Two Sum", "top_k": 3}'
```

#### Full Solution Generation:
```bash
curl -X POST http://localhost:8000/api/v1/ask \
  -H "Content-Type: application/json" \
  -d '{"query": "How to invert a binary tree?", "top_k": 3}'
```

---

## Rebuilding the Vector Database (Optional)

The pre-indexed ChromaDB vector store is included out-of-the-box. If you ever want to rebuild or re-index the dataset:

```powershell
# 1. Clean raw LeetCode problems
python ingestion/clean_data.py

# 2. Chunk problems into semantic segments
python ingestion/chunk_data.py

# 3. Create embeddings and build ChromaDB
python ingestion/create_vectorstore.py
```

---

## Project Directory Structure

```
ASK-dsa/
├── .env.example              # Template configuration file
├── .gitignore                # Production gitignore (excludes secrets, venvs, caches)
├── requirements.txt          # Python dependencies
├── cli.py                    # Terminal interactive assistant
├── test_generator.py         # Standalone generation script
├── test_streaming.py         # Standalone streaming script
│
├── app/                      # Production FastAPI Application
│   ├── __init__.py
│   ├── main.py               # App entrypoint, static mounting & middleware
│   ├── config.py             # Pydantic v2 Settings (.env loader)
│   ├── dependencies.py       # Singleton providers & SlowAPI rate limiter
│   ├── exceptions.py         # Custom exceptions & RFC 7807 error envelopes
│   ├── routers/              # Modular API routes
│   │   ├── health.py         # /api/v1/health
│   │   ├── retrieval.py      # /api/v1/retrieve
│   │   └── chat.py           # /api/v1/ask & /api/v1/ask/stream
│   ├── schemas/              # Pydantic v2 Request & Response models
│   ├── services/             # Orchestration services (Retrieval & Generation)
│   └── static/               # Web Dashboard (Zero npm build required)
│       ├── index.html        # UI Cockpit (Tailwind, Geist, JetBrains Mono)
│       ├── app.js            # SSE streaming client, hotkeys, copy utility
│       └── style.css         # Markdown styling & custom animations
│
├── retrieval/                # Core RAG Retrieval & Reasoning Engine
│   ├── hybrid_retriever.py   # Multi-Field BM25 + ChromaDB Dense + RRF
│   ├── query_modifier.py     # Regex topic extraction & conversational cleaner
│   ├── adaptive_rag.py       # Routing strategy classifier
│   ├── reranker.py           # Cross-Encoder (ms-marco-MiniLM-L-6-v2)
│   ├── generator.py          # Grounded prompt template & Groq LLM interface
│   └── display.py            # Console output formatter
│
├── data/                     # Dataset & Chunks
│   ├── leetcode_problems.json
│   ├── cleaned_problems.json
│   └── problem_chunks.json
│
├── chroma_db/                # Local ChromaDB Vector Store
├── ingestion/                # Data cleaning, chunking, and embedding scripts
├── evaluation/               # Benchmark evaluation & failure analysis
└── tests/                    # Complete 29-test Automated Test Suite
    ├── test_api.py           # API & Dashboard integration tests
    ├── test_query_modifier.py
    ├── test_adaptive_rag.py
    ├── test_hybrid_retriever.py
    ├── test_reranker.py
    ├── test_generator.py
    └── test_display.py
```

---

## Windows Troubleshooting

| Issue | Solution |
| :--- | :--- |
| **`Activate.ps1 cannot be loaded because running scripts is disabled`** | Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in PowerShell before activating `.venv`. |
| **`UnicodeEncodeError / cp1252 character errors`** | Ensure your terminal uses UTF-8. All scripts in ASK-DSA automatically configure UTF-8 output encoding. |
| **`GROQ_API_KEY is not set`** | Verify your `.env` file exists in the repository root and contains a valid key: `GROQ_API_KEY=gsk_...` |
| **Hugging Face Hub rate limit warning** | You can optionally set `HF_TOKEN=hf_...` in your `.env` file to remove unauthenticated download warnings. |

---

## License

MIT License. Open-source for educational and technical interview preparation use.
