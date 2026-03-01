# Teach - English Learning App for Somali Speakers

An AI-powered English learning platform designed for Somali-speaking students. Features structured lessons, quizzes, pattern drills, and an AI tutor that explains concepts in Somali using real-time translation.

## Architecture

```
Frontend (React + Vite)     :3000
    |
Backend (FastAPI)           :8000
    |
    +-- NLLB Translation    :8001  (Docker - Somali/English translation)
    +-- Qwen AI             :8010  (Docker - English tutoring explanations)
    +-- PostgreSQL           :5432  (Docker - user progress)
```

### How the AI Tutor Works

```
User clicks "Get Help in Somali":
  English text --> NLLB (eng_to_som) --> Somali translation displayed
  English text --> Qwen --> English explanation --> NLLB (eng_to_som) --> Somali explanation

User types a follow-up in Somali:
  Somali input --> NLLB (som_to_eng) --> English --> Qwen --> English reply --> NLLB (eng_to_som) --> Somali reply
```

## Prerequisites

- **Node.js** (v18+)
- **Python** (3.10+)
- **Docker Desktop** with GPU support enabled
- **NVIDIA GPU** with 16GB+ VRAM (e.g. RTX 5070 Ti)
- **NVIDIA Container Toolkit** (included with Docker Desktop)
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
└── docker-compose.yml          # Qwen + NLLB containers
```

## Quick Start

### 1. Start Docker services (NLLB + Qwen)

```bash
cd C:\Users\pscad\Documents\Teach
docker compose up -d
```

First run downloads model files (~8GB for Qwen, ~5GB for NLLB container build). Wait 1-2 minutes for models to load into GPU.

### 2. Start the database (if not already running)

```bash
cd services/database
docker compose up -d
```

### 3. Start the backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Start the frontend

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
docker compose down           # Stops Qwen + NLLB

cd services/database
docker compose down           # Stops PostgreSQL
```

## Health Checks

```bash
# NLLB translation service
curl http://localhost:8001/health

# Qwen AI model
curl http://localhost:8010/health

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

### Test Qwen

```bash
curl -X POST http://localhost:8010/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "Qwen/Qwen2.5-7B-Instruct-AWQ", "messages": [{"role": "user", "content": "Hello"}]}'
```

## Port Reference

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | React dev server |
| Backend | 8000 | FastAPI |
| NLLB | 8001 | Translation API |
| Qwen | 8010 | AI chat completions (OpenAI-compatible) |
| PostgreSQL | 5432 | Database |

## GPU Memory Usage

Both NLLB and Qwen share a single GPU:

| Service | VRAM |
|---------|------|
| Qwen 7B AWQ | ~11.4 GB (70% utilization) |
| NLLB 1.3B | ~2.6 GB |
| **Total** | **~14 GB / 16 GB** |

## Troubleshooting

### "All connection attempts failed"
- Make sure Docker containers are running: `docker ps`
- Make sure the backend was restarted after code changes
- Check NLLB logs: `docker logs nllb-translator`
- Check Qwen logs: `docker logs qwen-brain`

### "GPU not found"
- Enable GPU in Docker Desktop: Settings > Resources > GPU
- Restart Docker Desktop

### "Out of memory"
- Lower Qwen memory in `docker-compose.yml`: change `--gpu-memory-utilization 0.70` to `0.60`
- Lower `--max-model-len` to `2048`

### Slow first start
- Normal on first run — Qwen downloads ~8GB model, NLLB container builds ~5GB of dependencies
- Check progress: `docker compose logs -f`
- Subsequent starts are fast (models are cached)

### Translation quality
- NLLB uses a fine-tuned LoRA adapter for Somali-English
- Model files are at: `C:\Users\pscad\Documents\somali-nllb-training\nllb-somali-english-v3`
