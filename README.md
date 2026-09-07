# Teach - English Learning App for Somali Speakers

An AI-powered English learning platform designed for Somali-speaking students. Features structured lessons, quizzes, pattern drills, and an AI tutor that explains concepts in Somali using real-time translation.

## Architecture

```
Frontend (React + Vite)     :3000
    |
Backend (FastAPI)           :8000
    |
    +-- Chat LLM ("brain")   hosted, free — OpenRouter OpenAI-compatible API
    |                        (optional local Qwen container as an offline fallback)
    +-- NLLB Translation    :8001  (Docker - Somali/English translation, GPU)
    +-- PostgreSQL           :5432  (Docker - user progress)
```

The English chat "brain" (AI tutor + conversation) runs on a **hosted, free
OpenAI-compatible LLM via OpenRouter**, so no local GPU model is required for chat.
Somali↔English translation stays on the local **NLLB** service (a fine-tuned model
that beats general LLMs at low-resource Somali). All LLM calls funnel through one
`ask_qwen()` helper, so the brain is swappable by env var alone — see
`docs/curriculum-architecture.md`.

### How the AI Tutor Works

```
User clicks "Get Help in Somali":
  English text --> NLLB (eng_to_som) --> Somali translation displayed
  English text --> chat LLM --> English explanation --> NLLB (eng_to_som) --> Somali explanation

User types a follow-up in Somali:
  Somali input --> NLLB (som_to_eng) --> English --> chat LLM --> English reply --> NLLB (eng_to_som) --> Somali reply
```

## Prerequisites

- **Node.js** (v18+)
- **Python** (3.10+)
- **Docker Desktop** (GPU support recommended)
- An **OpenRouter API key** (free) for the chat brain — get one at https://openrouter.ai/keys and put it in `.env` as `OPENROUTER_API_KEY`
- **NVIDIA GPU** with ~8GB+ VRAM + **NVIDIA Container Toolkit** — needed for the local NLLB translation and pronunciation services (the chat brain no longer needs a GPU). Only needed if you run those services locally.
- NLLB LoRA model files at `C:\Users\pscad\Documents\somali-nllb-training\nllb-somali-english-v3`

## Project Structure

```
Teach/
├── app/                        # React frontend (Vite + Tailwind)
│   └── src/components/
│       └── AITutorModal.jsx    # AI tutor chat interface
├── backend/
│   ├── main.py                 # FastAPI backend (API endpoints)
│   ├── requirements.txt        # Python dependencies
│   ├── units.json              # Unit definitions
│   └── unit-1/                 # Lesson JSON files
│       ├── lesson-1.json
│       ├── lesson-2.json
│       └── lesson-3.json
├── services/
│   ├── nllb/                   # NLLB translation service
│   │   ├── Dockerfile
│   │   └── app.py
│   └── database/
│       ├── docker-compose.yml  # PostgreSQL (standalone)
│       └── init.sql
└── docker-compose.yml          # NLLB + pronunciation + DB + app (chat brain is hosted; local Qwen optional)
```

## Quick Start

### 1. Configure the chat brain

Copy `.env.example` to `.env` and set `OPENROUTER_API_KEY` (free key from
https://openrouter.ai/keys). The default `QWEN_MODEL`/`LLM_FALLBACK_MODELS` are
free OpenRouter models — no GPU or model download needed for chat.

### 2. Start Docker services (NLLB + database + backend)

```bash
cd C:\Users\pscad\Documents\Teach
docker compose up -d
```

First run builds the NLLB container (~5GB) and, on first boot, merges the LoRA and
converts it to CTranslate2 (can take several minutes — the backend waits for it).
The local Qwen container is disabled by default (chat runs on OpenRouter); uncomment
it in `docker-compose.yml` only if you want an offline local brain.

`docker compose up -d` already starts the database, backend, and frontend. The
steps below are for **local development** — running the backend and frontend
outside Docker with hot reload (point them at the Dockerized database + NLLB).

### 3. Start the database (if not already running)

```bash
cd services/database
docker compose up -d
```

### 4. Start the backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 5. Start the frontend

```bash
cd app
npm install
npm run dev
```

The app will be available at **http://localhost:3000**.

## Stopping Everything

```bash
# Frontend/Backend: Ctrl+C in their terminals

# Docker services:
cd C:\Users\pscad\Documents\Teach
docker compose down           # Stops NLLB, pronunciation, DB, backend, frontend

cd services/database
docker compose down           # Stops PostgreSQL
```

## Health Checks

```bash
# NLLB translation service
curl http://localhost:8001/health

# Chat brain — hosted on OpenRouter (list free models):
curl https://openrouter.ai/api/v1/models -H "Authorization: Bearer $OPENROUTER_API_KEY"

# Backend API
curl http://localhost:8000/api/units
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/units` | List all units with lessons |
| GET | `/api/lessons/{id}` | Get a specific lesson |
| POST | `/api/quiz/submit` | Submit quiz results |
| POST | `/api/translate` | Translate text (Somali/English) |
| POST | `/api/explain` | Get AI explanation of lesson content |
| POST | `/api/chat` | Chat with AI tutor in Somali |

### Test translation

```bash
curl -X POST http://localhost:8001/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, how are you?", "direction": "eng_to_som"}'
```

### Test the chat brain (OpenRouter)

```bash
curl -X POST https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "inclusionai/ling-3.0-flash-sante:free", "messages": [{"role": "user", "content": "Hello"}]}'
```

## Port Reference

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | React dev server |
| Backend | 8000 | FastAPI |
| NLLB | 8001 | Translation API |
| Pronunciation | 5002 | Speech scoring |
| Kokoro TTS | 8880 | Text-to-speech |
| PostgreSQL | 5432 | Database |
| Qwen (optional) | 8010 | Local chat brain — only if the qwen container is uncommented |

## GPU Memory Usage

With the chat brain hosted on OpenRouter, the remaining local AI services share the
GPU (chat no longer uses any VRAM):

| Service | VRAM |
|---------|------|
| NLLB 1.3B (CTranslate2 int8) | ~1.3 GB (0 GB if on CPU) |
| Pronunciation (Whisper-small + MMS-1B fp16) | ~3 GB |
| Kokoro TTS | 0 GB (runs on CPU) |
| **Total** | **~4 GB / 16 GB** |
| _Local Qwen (optional fallback)_ | _+~4 GB if enabled_ |

The NLLB backend is configurable (CTranslate2 int8 vs. the original fp16 + LoRA) —
see `services/nllb/CT2_NOTES.md`.

## Troubleshooting

### "All connection attempts failed"
- Make sure Docker containers are running: `docker ps`
- Make sure the backend was restarted after code changes
- Check NLLB logs: `docker logs nllb-translator`

### AI tutor says "temporarily unavailable"
- Confirm `OPENROUTER_API_KEY` is set in `.env` and the backend was restarted
- Free OpenRouter models are a shared pool and get rate-limited (429) — the
  `LLM_FALLBACK_MODELS` chain handles this; if all are busy, wait and retry
- A free model slug may have been retired — list current ones with
  `curl https://openrouter.ai/api/v1/models -H "Authorization: Bearer $OPENROUTER_API_KEY"`
  and update `QWEN_MODEL` / `LLM_FALLBACK_MODELS` in `.env`

### "GPU not found"
- Enable GPU in Docker Desktop: Settings > Resources > GPU
- Restart Docker Desktop

### Slow first start
- Normal on first run — the NLLB container builds ~5GB of dependencies and, on
  first boot, merges the LoRA and converts to CTranslate2
- Check progress: `docker compose logs -f`
- Subsequent starts are fast (models are cached)

### Translation quality
- NLLB uses a fine-tuned LoRA adapter for Somali-English
- Model files are at: `C:\Users\pscad\Documents\somali-nllb-training\nllb-somali-english-v3`
