# ASK-DSA: Enterprise-Grade RAG AI Tutor for Algorithms (MERN Stack Edition)

[![Node.js 18+](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-4.21+-000000.svg)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://react.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248.svg)](https://www.mongodb.com/)
[![Groq LLM](https://img.shields.io/badge/Groq-Cloud-f55036.svg)](https://groq.com)
[![Jest Tests](https://img.shields.io/badge/tests-19%20passed%20%7C%20100%25-brightgreen.svg)](backend/tests/)

**ASK-DSA** is an intelligent Data Structures & Algorithms (DSA) tutor and problem-retrieval engine built on the **MERN (MongoDB, Express.js, React, Node.js)** stack. It combines two-stage hybrid search (Title-Boosted BM25 + Dense Semantic Overlap fused via Reciprocal Rank Fusion) with high-precision reranking, grounded prompt engineering, and high-throughput Groq LLM answer generation with real-time token streaming.

---

## Key Features

- **Multi-Field Hybrid Retrieval**: 
  - Sparse lexical search via **BM25Okapi** (with a 3.5x boost on problem titles and exact-substring match bonuses: +50 for exact match, +20 for substring match).
  - Semantic candidate generation over 7,638 problem chunks.
  - **Reciprocal Rank Fusion (RRF)** merging candidate pools into a unified set ($k=60$).
- **Stage-2 Precision Reranker**:
  - Re-evaluates candidates for exact title alignment, topic overlap, and contextual relevance.
- **Adaptive RAG Query Classification**:
  - Classifies user intent into `specific_qa` (high-precision problem resolution) or `exploratory` (diverse multi-technique comparisons).
  - Normalizes aliases (`dp` $\to$ `Dynamic Programming`, `heap` $\to$ `Heap (Priority Queue)`).
- **Production Express.js & Node.js Backend**:
  - Fully asynchronous with startup pre-warming.
  - Standardized JSON responses with per-stage latency metrics (`retrieval_ms`, `generation_ms`, `total_ms`).
  - IP-based rate limiting via `express-rate-limit` and pre-configured CORS.
  - Interactive Swagger / OpenAPI UI at `/docs`.
- **Modern React (Vite + Tailwind CSS) Frontend**:
  - Clean split-pane workspace (35% retrieved context cards, 65% grounded solution workspace).
  - Real-time Server-Sent Events (SSE) streaming token output.
  - Interactive LeetCode problem cards with topic tags and rerank scores.
  - Formatted Python code blocks with syntax highlighting and one-click clipboard copying.
  - Global hotkeys (`Ctrl+K` omnisearch focus).
- **MongoDB & Mongoose Integration**:
  - `Problem` schema storing 7,638 problem chunks with compound text indexing.
  - `QueryHistory` schema logging queries, routing diagnostics, and response latencies.
  - Resilient local fallback (supports MongoDB Atlas, local MongoDB, or MongoMemoryServer).
- **Automated Test Suite**:
  - 100% pass rate across Jest unit, integration, and API tests.

---

## System Architecture

```
User Query ("How to detect cycle in linked list?")
       │
       ▼
┌────────────────────────────────────────┐
│  Adaptive Query Classifier & Modifier  │  <-- Strips conversational filler,
│  (backend/services/queryModifier.js)   │      extracts topics & difficulty
└──────────────────┬─────────────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌──────────────────┐ ┌──────────────────┐
│ Multi-Field BM25 │ │ Semantic Vectors │
│ (Title 3.5x)     │ │ (7,638 Chunks)   │
└────────┬─────────┘ └────────┬─────────┘
         │                    │
         └─────────┬──────────┘
                   ▼
┌────────────────────────────────────────┐
│   Reciprocal Rank Fusion (RRF, k=60)   │  <-- Candidate Pool
└──────────────────┬─────────────────────┘
                   ▼
┌────────────────────────────────────────┐
│   Stage-2 Precision Reranker           │  <-- Title & Cross-relevance scoring
└──────────────────┬─────────────────────┘
                   ▼
┌────────────────────────────────────────┐
│      Top-K Relevant Problems           │
└──────────────────┬─────────────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌──────────────────┐ ┌──────────────────┐
│ React Frontend   │ │ Groq LLM Client  │  <-- Grounded Prompt Assembly
│ & Swagger Docs   │ │ (Sync / SSE)     │      with Code & Complexity
└──────────────────┘ └──────────────────┘
```

---

## Quick Start

### 1. Prerequisites

- **Node.js 18 or higher** installed ([Download nodejs.org](https://nodejs.org/)).
- **npm** installed (bundled with Node.js).
- **Git** installed.

---

### 2. Install Dependencies

Install root, backend, and frontend dependencies:

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

Or run the combined installer:
```bash
npm run install:all
```

---

### 3. Environment Configuration

The backend reads configuration from `backend/.env`.

Create or edit `backend/.env`:
```ini
PORT=8000
MONGODB_URI=mongodb://localhost:27017/askdsa
GROQ_API_KEY=gsk_your_actual_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b
DEFAULT_TOP_K=5
CANDIDATE_K=40
TEMPERATURE=0.1
RATE_LIMIT_DEFAULT=60
RATE_LIMIT_GENERATE=30
```

*(Get a free Groq API key at [console.groq.com](https://console.groq.com)).*

---

### 4. Running the Application

#### Option A: Full MERN Stack (Development Mode)

Runs both the Express API and Vite React dev server concurrently with hot module reloading:

```bash
npm run dev
```

- **React Dashboard**: Open [http://localhost:5173/](http://localhost:5173/)
- **Express API**: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

#### Option B: Production Server (Single Port Deployment)

Build the React frontend and serve everything directly from the Express backend on port 8000:

```bash
# 1. Build the React frontend
npm run build

# 2. Start the Express production server
npm start
```

Open [http://localhost:8000/](http://localhost:8000/) or [http://localhost:8000/dashboard](http://localhost:8000/dashboard).

---

### 5. Running Automated Tests

Run the complete test suite (19 tests covering query modifier, adaptive routing, BM25, RRF fusion, generator formatting, API endpoints, and SSE streaming):

```bash
npm test
```

Or from the `backend/` directory:
```bash
cd backend
npm test
```

---

### 6. Seeding MongoDB (Optional)

To load all 7,638 problem chunks from `data/problem_chunks.json` into your MongoDB instance:

```bash
npm run seed
```

---

## API Reference

All endpoints are versioned under `/api/v1`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` or `/dashboard` | Serves the interactive React Dashboard. |
| `GET` | `/docs` | Interactive Swagger UI documentation. |
| `GET` | `/api/v1/health` | Health status of API, database, and Groq LLM. |
| `POST` | `/api/v1/retrieve` | Semantic candidate search & precision reranking only. |
| `POST` | `/api/v1/ask` | Synchronous RAG solution generation with grounded sources. |
| `POST` / `GET` | `/api/v1/ask/stream` | Real-time Server-Sent Events (SSE) token streaming. |

### Example cURL Requests

#### Pure Retrieval:
```bash
curl -X POST http://localhost:8000/api/v1/retrieve \
  -H "Content-Type: application/json" \
  -d '{"query": "Two Sum", "top_k": 3}'
```

#### Full Grounded Solution Generation:
```bash
curl -X POST http://localhost:8000/api/v1/ask \
  -H "Content-Type: application/json" \
  -d '{"query": "How to invert a binary tree?", "top_k": 3}'
```

---

## Project Directory Structure

```
ask-dsa/
├── backend/                       # Express & Node.js Production API
│   ├── config/                    # Config & MongoDB connector
│   │   ├── config.js
│   │   └── db.js
│   ├── models/                    # Mongoose Data Models
│   │   ├── Problem.js             # Problem & chunk schema
│   │   └── QueryHistory.js        # Telemetry & query history schema
│   ├── routes/                    # Modular API Routes
│   │   ├── health.js              # /api/v1/health
│   │   ├── retrieval.js           # /api/v1/retrieve
│   │   └── chat.js                # /api/v1/ask & /api/v1/ask/stream
│   ├── services/                  # Core RAG Retrieval & Generation Services
│   │   ├── queryModifier.js       # Query cleaning & topic detector
│   │   ├── adaptiveRag.js         # Query strategy classifier
│   │   ├── bm25.js                # Multi-field BM25Okapi implementation
│   │   ├── hybridRetriever.js     # Hybrid search & RRF candidate fusion
│   │   └── generator.js           # Grounded prompt template & Groq LLM client
│   ├── scripts/
│   │   └── seed.js                # MongoDB seeding script
│   ├── tests/                     # 19 Automated Jest Tests
│   └── server.js                  # Express application entrypoint
│
├── frontend/                      # React (Vite + Tailwind CSS) Dashboard
│   ├── src/
│   │   ├── App.jsx                # Main Cockpit UI component
│   │   ├── index.css              # Tailwind & markdown styles
│   │   └── main.jsx               # React entrypoint
│   ├── index.html
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── data/                          # Dataset & Chunks
│   ├── leetcode_problems.json
│   ├── cleaned_problems.json
│   └── problem_chunks.json
│
├── package.json                   # Root workspace orchestration
└── README.md                      # Documentation
```

---

## License

MIT License. Open-source for educational and technical interview preparation use.
