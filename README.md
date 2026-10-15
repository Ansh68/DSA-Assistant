# DSA Assistant — YouTube Course RAG

A high-performance Retrieval-Augmented Generation (RAG) platform that allows learners to ask natural-language questions about any YouTube video course and receive intelligent, real-time answers with **exact, clickable video timestamps** that play directly inside the application.

---

## Features

- **Natural-Language Question Answering:** Ask complex conceptual questions in English, Hindi, or Hinglish.
- **Clean Query Normalization:** Strips conversational filler and extracts core algorithmic concepts & Devanagari phonetics.
- **High-Dimension Semantic Search:** Powered by Google Gemini (`gemini-embedding-001`, 3072 dimensions) with Qdrant Cloud.
- **Multilingual Cross-Encoder Reranking:** Powered by Cohere (`rerank-multilingual-v3.0`) for top relevance precision.
- **Ultra-Fast Streaming Generation:** Token-by-token streaming via Groq API (`openai/gpt-oss-120b`) over Server-Sent Events (SSE).
- **Embedded In-Platform Video Playback:** Click any timestamp card to seek and play that exact lecture moment inside the app (no redirection to YouTube).
- **Production-Ready & Cloud-Optimized:** Memory-optimized architecture running at under **160 MB RAM**, deploying 100% free on Render and Vercel.

---

## Architecture & Data Flow

```text
User Question (e.g. "two sum ko kaise solve karte hai?")
     │
     ▼
[1] Query Normalizer (Groq LLM)
     │ Extracts core DSA pattern & phonetics (e.g. "टू सम, टू पॉइंटर, टार्गेट सम")
     ▼
[2] Embedding Generation (Google Gemini API)
     │ Generates 3072-dimensional vector using 'RETRIEVAL_QUERY' task type (0 MB RAM)
     ▼
[3] Qdrant Cloud Vector Search
     │ Fetches top 40 candidate transcript chunks by cosine similarity
     ▼
[4] Cross-Encoder Reranking (Cohere API)
     │ Evaluates Video Title + Transcript against combined query, scoring top 5
     ▼
[5] Answer Generator (Groq LLM)
     │ Streams detailed Hinglish explanation token-by-token via Server-Sent Events (SSE)
     ▼
[6] Diversity Filter & Timestamp Formatting
     │ Picks top 3 diverse moments across videos (minimum 60-second separation)
     ▼
[7] Next.js Frontend
     │ Renders markdown answer in real-time + embedded YouTube player seeking to timestamp
```

---

## Deployment Journey & Architectural Optimizations

### The Problem: Render Free-Tier Memory Limits

When initially deploying the backend to Render's free tier, the deployment failed repeatedly with:
```text
==> Running 'uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port $PORT'
==> Out of memory (used over 512Mi)
```

### Why the Original Setup Was Too Heavy

1. **Local PyTorch & CUDA Overhead:** The original backend loaded both `sentence-transformers` (`paraphrase-multilingual-MiniLM-L12-v2`) and `FlagEmbedding` (`BAAI/bge-reranker-v2-m3`) locally into server memory using PyTorch.
2. **Massive Memory Footprint:** The BGE reranker alone is a 568-million parameter model requiring over 2.2 GB of weights. Loading PyTorch and both models pushed resident memory usage to **1,267 MB RAM**.
3. **Hard 512 MB Limit:** Render's free tier caps memory at **512 MB**. As soon as Uvicorn initialized the models on startup, Render's Linux OOM killer terminated the process.
4. **Environment Conflicts:** Pinned Windows/Python 3.13 dependencies in `requirements.txt` (like `networkx==3.7`) broke on Render's Linux Python 3.11 environment.

---

### How It Was Solved (3-Stage Cloud Optimization)

| Stage | What Was Changed | Why | Result |
|---|---|---|---|
| **Phase 1: Cohere Reranker API** | Replaced local `FlagEmbedding` (`BAAI/bge-reranker-v2-m3`) with **Cohere Rerank API** (`rerank-multilingual-v3.0`). | Eliminated the 2.2 GB cross-encoder model from local memory while improving multilingual ranking for Hindi/Hinglish terms. | Memory dropped by ~650 MB; reranking precision improved. |
| **Phase 2: Google Gemini Embeddings API** | Replaced local `sentence-transformers` with **Google Gemini Embedding API** (`gemini-embedding-001`, 3072 dimensions). | Hugging Face removed free Serverless Inference credits ($0.00 allowance). Gemini provides 1,500 free requests/day with 0 MB server RAM usage. | **Total backend RAM dropped from 1,267 MB to ~160 MB!** Fits safely within Render's 512 MB ceiling. |
| **Phase 3: Production CORS & Clean Build** | Stripped PyTorch, CUDA, and unused frozen packages from `requirements.txt`; configured permissive CORS in `main.py`. | Dramatically sped up build times from minutes to seconds; enabled deployed Vercel frontend to query the Render API without CORS blocks. | Clean 30-second builds on Linux and zero CORS issues in production. |

---

## Tech Stack

### Backend
| Component | Technology | Role |
|---|---|---|
| API Framework | **FastAPI** (Python 3.10+) | High-performance asynchronous REST & SSE streaming server |
| Vector Database | **Qdrant Cloud** | Managed vector search cluster storing 3072-dim embeddings |
| Embedding Engine | **Google Gemini API** (`gemini-embedding-001`) | Cloud-based 3072-dimension semantic embeddings (0 MB local RAM) |
| Reranker Engine | **Cohere Rerank API** (`rerank-multilingual-v3.0`) | Cross-encoder contextual relevance scoring |
| LLM Generator | **Groq API** (`openai/gpt-oss-120b`) | Ultra-fast token streaming for conversational answers |
| Query Normalizer | **Groq API** | Strips conversational filler and extracts DSA patterns & phonetics |
| Ingestion & Transcripts | **yt-dlp** & **youtube-transcript-api** | Extracts video metadata, chunking, and auto-captions |

### Frontend
| Component | Technology | Role |
|---|---|---|
| Web Framework | **Next.js 16** (App Router) | React framework deployed globally on Vercel |
| Language | **TypeScript** | Type safety across client components |
| Styling | **Vanilla CSS** | Minimalist ChatGPT-inspired black-and-white theme |
| Typography | **Inter** (via `next/font/google`) | Clean, modern sans-serif typography |
| Markdown Parser | **react-markdown** + **remark-gfm** | Renders formatted code blocks, bold text, and lists cleanly |
| Video Player | **YouTube IFrame API** | Smooth in-app playback seeking to specific timestamps |

---

## Project Structure

```text
youtube-rag/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── query.py              # SSE streaming endpoint with 3-stage candidate logging
│   │   ├── core/
│   │   │   ├── config.py             # Environment configuration (Qdrant, Groq, Cohere, Gemini)
│   │   │   └── qdrant.py             # Qdrant client connection
│   │   ├── ingestion/
│   │   │   ├── chunker.py            # Splits transcript timeline into timed chunks
│   │   │   ├── playlist.py           # Fetches video catalog from playlist URL
│   │   │   ├── transcript.py         # Pulls caption tracks from YouTube
│   │   │   └── index.py              # Local pipeline script for indexing new playlists
│   │   ├── services/
│   │   │   ├── diversity.py          # Enforces minimum time gaps between video recommendations
│   │   │   ├── embedding.py          # Gemini API embedding client (3072 dimensions)
│   │   │   ├── generator.py          # Groq streaming answer generator
│   │   │   ├── query_normalizer.py   # Keyword extractor & phonetic translator
│   │   │   ├── reranker.py           # Cohere multilingual cross-encoder reranker
│   │   │   └── retriever.py          # Qdrant vector retrieval service (limit=40)
│   │   └── main.py                   # FastAPI app with health checks and production CORS
│   ├── gemini_embeddings.py          # Utility script for migrating/generating Gemini vectors
│   ├── requirements.txt              # Ultra-lightweight dependencies (No PyTorch/CUDA)
│   └── .env                          # Local environment variables
│
└── frontend/
    ├── app/
    │   ├── components/
    │   │   └── QueryInterface.tsx    # Interactive chat UI, SSE reader & embedded player
    │   ├── globals.css               # Clean minimal theme & typography styles
    │   ├── layout.tsx                # Root layout with Inter font
    │   └── page.tsx                  # Home landing page
    ├── .env.local                    # Frontend API endpoint config
    ├── next.config.ts
    └── package.json
```

---

## Running Locally

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- API Keys (all free tier):
  - [Google AI Studio (Gemini)](https://aistudio.google.com/)
  - [Groq Console](https://console.groq.com/)
  - [Cohere Dashboard](https://dashboard.cohere.com/)
  - [Qdrant Cloud](https://cloud.qdrant.io/)

### 2. Backend Setup

```powershell
cd backend

# Create virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1    # On Windows
# source venv/bin/activate     # On macOS/Linux

# Install dependencies (fast, no heavy PyTorch)
pip install -r requirements.txt
```

Create `backend/.env`:
```env
GROQ_API_KEY=gsk_your_groq_key
COHERE_API_KEY=your_cohere_key
GEMINI_API_KEY=your_gemini_key
QDRANT_URL=https://your-cluster.cloud.qdrant.io
QDRANT_API_KEY=your_qdrant_key
QDRANT_COLLECTION=youtube_transcripts_gemini_test
PLAYLIST_URL=https://www.youtube.com/playlist?list=YOUR_PLAYLIST_ID
```

Run the backend server:
```powershell
uvicorn app.main:app --reload --port 8000
```
Verify health: `http://localhost:8000/health` → `{"status": "ok"}`

### 3. Frontend Setup

Open a separate terminal:
```powershell
cd frontend
npm install
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the frontend dev server:
```powershell
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## Deployment Guide (100% Free)

### Step 1: Deploy Backend on Render (Web Service)
1. Push your repository to GitHub.
2. Go to [Render Dashboard](https://dashboard.render.com/) → **New** → **Web Service**.
3. Connect your repository.
4. Configure service settings:
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** `Free` (512 MB RAM)
5. Under **Environment Variables**, add:
   - `GEMINI_API_KEY`
   - `COHERE_API_KEY`
   - `GROQ_API_KEY`
   - `QDRANT_URL`
   - `QDRANT_API_KEY`
   - `QDRANT_COLLECTION` = `youtube_transcripts_gemini_test`
6. Click **Deploy Web Service**.
7. Copy your deployed backend URL (e.g., `https://dsa-assistant-backend.onrender.com`).

### Step 2: Deploy Frontend on Vercel
1. Go to [Vercel Dashboard](https://vercel.com/) → **Add New** → **Project**.
2. Import your GitHub repository.
3. Set **Root Directory** to `frontend`.
4. In **Environment Variables**, add:
   - `NEXT_PUBLIC_API_URL` = `https://your-backend.onrender.com` (your Render URL from Step 1).
5. Click **Deploy**.

---

## API Reference

### `POST /api/query`
Streams real-time answer tokens and timestamp recommendations via Server-Sent Events (SSE).

**Request:**
```json
{
  "query": "sliding window technique kya hoti hai?"
}
```

**SSE Stream Events:**
1. `event: meta` — `{ "query": "...", "normalized_query": "..." }`
2. `event: token` — `{ "content": "Sliding" }` (repeated token-by-token)
3. `event: results` — Array of top video cards with `start_time`, `end_time`, and formatted timestamps.
4. `event: done` — `{}` (signals stream completion)

---

## License

MIT License
