# DSA Assistant — YouTube Course RAG

A Retrieval-Augmented Generation (RAG) application that helps learners find relevant concepts from a YouTube DSA playlist. Users can ask questions in natural language, receive concise explanations, and navigate directly to relevant video timestamps.

## Features

Natural-language question answering

Hindi/Hinglish query normalization

Multilingual semantic search over video transcripts

Qdrant vector database for transcript retrieval

BGE reranking for improved relevance

Groq-powered answer generation

Timestamp-based video recommendations

Embedded YouTube playback

---

## What it Does

You type a question like *"Two pointer kya hota hai?"* or *"Explain binary search"* and the system:

1. Normalizes your query into the language the transcripts are actually written in
2. Searches a vector database of chunked video transcripts for the most relevant moments
3. Reranks the results for precision
4. Streams a contextual AI-generated answer in real time
5. Shows you clickable video cards with the exact timestamps — plays the video right on the platform (no redirect to YouTube)

---

## Architecture

```
User Query
    │
    ▼
Query Normalizer (LLM)          ← Converts Hinglish/English query to Hindi Devanagari
    │                              (matches how YouTube auto-captions write Hindi)
    ▼
Embedding Model                 ← paraphrase-multilingual-MiniLM-L12-v2
    │                              Converts query to a 384-dim vector
    ▼
Qdrant Vector Search            ← Retrieves top 15 transcript chunks by cosine similarity
    │
    ▼
Cross-Encoder Reranker          ← BAAI/bge-reranker-v2-m3
    │                              Re-scores and picks top 5 most relevant chunks
    ▼
LLM Generator (Groq)            ← Streams Hinglish answer token-by-token via SSE
    │
    ▼
Diversity Filter                ← Selects 3 timestamp results spread across different videos/moments
    │
    ▼
Frontend (Next.js)              ← Shows streaming answer + embedded video player
```

---

## Tech Stack

### Backend
| Component | Technology |
|-----------|-----------|
| API Framework | **FastAPI** (Python) |
| Vector Database | **Qdrant Cloud** (managed) |
| Embedding Model | `paraphrase-multilingual-MiniLM-L12-v2` via **sentence-transformers** |
| Reranker Model | `BAAI/bge-reranker-v2-m3` via **FlagEmbedding** |
| LLM / Generator | **Groq API** (`openai/gpt-oss-120b`) |
| Query Normalizer | **Groq API** (LLM-based Hinglish → Hindi conversion) |
| Transcript Fetcher | **youtube-transcript-api** |
| Playlist Fetcher | **yt-dlp** |
| Streaming Protocol | **Server-Sent Events (SSE)** |
| Language | Python 3.10+ |

### Frontend
| Component | Technology |
|-----------|-----------|
| Framework | **Next.js 16** (App Router) |
| Language | **TypeScript** |
| Styling | **Vanilla CSS** (custom design system) |
| Font | **Inter** (Google Fonts via next/font) |
| Markdown Rendering | **react-markdown** + **remark-gfm** |
| Video Embedding | YouTube IFrame API (on-platform, no redirect) |

---

## Project Structure

```
youtube-rag/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── query.py          # SSE streaming endpoint
│   │   ├── core/
│   │   │   ├── config.py         # Environment variables
│   │   │   └── qdrant.py         # Qdrant client setup
│   │   ├── ingestion/
│   │   │   ├── index.py          # Full ingestion pipeline (run once)
│   │   │   ├── playlist.py       # Fetches all videos from a playlist
│   │   │   ├── transcript.py     # Downloads transcripts from YouTube
│   │   │   └── chunker.py        # Splits transcripts into timed chunks
│   │   ├── services/
│   │   │   ├── embedding.py      # Creates vector embeddings
│   │   │   ├── retriever.py      # Queries Qdrant
│   │   │   ├── reranker.py       # Cross-encoder reranking
│   │   │   ├── generator.py      # Groq LLM streaming
│   │   │   ├── query_normalizer.py # LLM-based query normalization
│   │   │   └── diversity.py      # Selects diverse timestamp results
│   │   └── main.py               # FastAPI app entry point
│   ├── create_qdrant_indexes.py  # One-time index creation script
│   ├── requirements.txt
│   ├── run.py
│   └── .env                      # Your secrets go here
│
└── frontend/
    ├── app/
    │   ├── components/
    │   │   └── QueryInterface.tsx # Main UI component
    │   ├── globals.css            # Design system & all styles
    │   ├── layout.tsx             # Root layout with Inter font
    │   └── page.tsx               # Root page
    ├── .env.local                 # Frontend env (API URL)
    ├── next.config.ts
    └── package.json
```

---

## Running on Your Own System with Your Own Playlist

Follow these steps in order. This only takes about 15–20 minutes to set up.

### Prerequisites

- Python 3.10 or newer
- Node.js 18 or newer
- A [Groq API key](https://console.groq.com) (free tier works)
- A [Qdrant Cloud](https://cloud.qdrant.io) account (free tier — 1 free cluster)

---

### Step 1 — Clone the Repository

```bash
git clone <your-repo-url>
cd youtube-rag
```

---

### Step 2 — Set Up the Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv

# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1

# On macOS/Linux:
source venv/bin/activate

# Install all dependencies
pip install -r requirements.txt
```

> **Note for Windows:** If you get an execution policy error when activating the venv, run this first:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

---

### Step 3 — Get Your API Keys

#### Groq API Key
1. Sign up at [console.groq.com](https://console.groq.com)
2. Go to **API Keys** → **Create API Key**
3. Copy the key (starts with `gsk_`)

#### Qdrant Cloud
1. Sign up at [cloud.qdrant.io](https://cloud.qdrant.io)
2. Create a new **cluster** (free tier — 1 cluster, 0.5 GB)
3. Once the cluster is ready, click on it and go to **API Keys**
4. Create an API key and copy it
5. Also copy the **cluster URL** (looks like `https://xxxx.eu-west-1-0.aws.cloud.qdrant.io`)

---

### Step 4 — Configure the Backend `.env`

Create (or edit) `backend/.env` with your values:

```env
GROQ_API_KEY=gsk_your_groq_key_here
QDRANT_API_KEY=your_qdrant_api_key_here
QDRANT_URL=https://your-cluster-id.region.cloud.qdrant.io
QDRANT_COLLECTION=youtube_transcripts
PLAYLIST_URL=https://www.youtube.com/playlist?list=YOUR_PLAYLIST_ID
```

**How to find your playlist URL:**
- Go to your YouTube playlist
- Copy the URL from the browser — it should look like `https://www.youtube.com/playlist?list=PLxxxxxx`
- Paste it as the value for `PLAYLIST_URL`

> **Important:** The playlist must have videos with **auto-generated captions**. Most Hindi/English YouTube videos have these automatically. If a video has no captions, it will be skipped automatically during ingestion.

---

### Step 5 — Run the Ingestion Pipeline

This is a one-time step that downloads all transcripts and indexes them into Qdrant.

```bash
# Make sure you are in the backend folder with the venv activated
cd backend

python -m app.ingestion.index
```

This will:
- Fetch all video IDs from your playlist
- Download the transcript for each video
- Split transcripts into timed chunks (with start/end times preserved)
- Create embeddings for each chunk
- Upload everything to your Qdrant collection

Ingestion time depends on playlist size. A 100-video playlist typically takes 10–20 minutes.

> **If YouTube blocks you** mid-ingestion (rate limiting), the script will stop and tell you. All already-indexed videos are safe in Qdrant. Wait a few hours and run the script again — it skips already-indexed videos automatically.

---

### Step 6 — Create Qdrant Payload Index

This creates a fast filter index on `video_id`:

```bash
python create_qdrant_indexes.py
```

Only needs to be run once after the first ingestion.

---

### Step 7 — Start the Backend Server

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`

You can verify it is running:
- `http://localhost:8000/health` → `{"status": "ok"}`
- `http://localhost:8000/health/qdrant` → Qdrant connection status

---

### Step 8 — Set Up the Frontend

Open a new terminal:

```bash
cd frontend
npm install
```

Create (or edit) `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

### Step 9 — Start the Frontend

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## How to Use

1. Open `http://localhost:3000` in your browser
2. Type any question related to your course — in English, Hindi, or Hinglish
3. Hit **Enter** or click the send button
4. The system streams an AI-generated answer in real time
5. Below the answer, up to 3 **video timestamp cards** appear — click any card to play that exact moment directly on the platform (no redirect to YouTube)
6. Click the logo at any time to return to the home screen
7. Use the browser **Back** button to go back to the main page (instead of leaving the site)

---

## Customizing the AI Behavior

**Change the language / answer style:**
Edit `SYSTEM_PROMPT` in `backend/app/services/generator.py`

**Change how queries are normalized:**
Edit `QUERY_PROMPT` in `backend/app/services/query_normalizer.py`

This is especially important if your playlist is in a language other than Hindi. The normalizer converts the user's query into the exact form that YouTube auto-captions use — so the embedding search can actually find relevant chunks.

**Use a different LLM model:**
Change `MODEL_NAME` in `backend/app/services/generator.py`. Any model available on Groq works.

---

## Key Design Decisions

**Why query normalization?**
YouTube auto-captions in Hindi write English words phonetically in Devanagari (e.g., "array" → "एरे"). A user typing "array kya hota hai" in Roman script would not match transcript text written as "एरे क्या होता है". The LLM normalizer bridges this gap automatically.

**Why a cross-encoder reranker?**
Cosine similarity retrieval finds semantically similar text but can miss the most contextually precise chunks. The `BAAI/bge-reranker-v2-m3` cross-encoder scores query-passage pairs together (not separately), giving much better relevance precision.

**Why SSE instead of WebSockets?**
Server-Sent Events are simpler, unidirectional, and work perfectly for streaming LLM responses from server to client. No persistent two-way connection overhead.

**Why on-platform video embedding?**
Instead of redirecting users to YouTube, the app embeds a YouTube iframe with `?start=<seconds>&autoplay=1` so users stay on the platform and the video begins playing at the exact relevant moment.

---

## API Reference

### `POST /api/query`

Streams the full RAG pipeline response as Server-Sent Events.

**Request body:**
```json
{ "query": "Binary search explain karo" }
```

**SSE Events emitted (in order):**

| Event | Payload | Description |
|-------|---------|-------------|
| `meta` | `{ query, normalized_query }` | Fired first — shows the normalized query |
| `token` | `{ content: "..." }` | One LLM output token at a time |
| `results` | `{ results: [...] }` | Timestamp cards, sent after answer completes |
| `done` | `{}` | Stream is complete |

---

## Troubleshooting

**`uvicorn` not recognized (Windows)**
Activate the virtual environment first:
```powershell
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

**Ingestion fails with "No usable Hindi transcript"**
The video has no auto-generated captions in the expected language. These are skipped automatically.

**YouTube blocks transcript requests mid-ingestion**
YouTube rate-limits bulk transcript downloads. The script stops gracefully and saves progress. Already-indexed videos remain safe. Wait a few hours and re-run — already-indexed videos are skipped.

**Frontend shows "Failed to fetch" error**
The backend is not running. Start it with `uvicorn app.main:app --reload` in the `backend/` directory (with venv activated).

**Qdrant connection errors**
Check that `QDRANT_API_KEY` and `QDRANT_URL` in `backend/.env` are correct. Free-tier Qdrant clusters may pause after a period of inactivity — resume them from the Qdrant Cloud dashboard.

---

## License

MIT
