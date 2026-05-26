# DenkenAI — Academic Performance Intelligence Platform

DenkenAI is a microservice-based platform that uses AI to help students track, understand, and improve their academic performance.

## Architecture

```
Browser / Student Dashboard
        │
        ▼
  ┌─────────────┐
  │  frontend   │  Next.js 14 + TypeScript + Tailwind CSS
  │  (port 3000)│  Sidebar: Dashboard · Syllabus · Mock Tests · Analytics
  └──────┬──────┘
         │  REST API calls
         ▼
  ┌─────────────┐
  │   backend   │  Node.js + Express + TypeScript + Mongoose   ◄── Orchestrator
  │  (port 5000)│  src/controllers · routes · services · models · config
  └──────┬──────┘
         │  Internal HTTP calls (students never reach this directly)
         ▼
  ┌─────────────┐
  │ ai-service  │  Python + FastAPI + Gemini + ChromaDB
  │  (port 8000)│  Handles inference, RAG, and AI responses
  └─────────────┘
```

**The Backend is the sole orchestrator.** The frontend sends requests to the backend only. The backend decides when and how to call the AI service, enriches the response, and returns results to the frontend. The AI service is never exposed directly to the browser.

## Services at a Glance

| Service | Stack | Port |
|---------|-------|------|
| `frontend` | Next.js 14+, TypeScript, Tailwind, Lucide-react, Recharts | 3000 |
| `backend` | Node.js, Express, TypeScript, Mongoose | 5000 |
| `ai-service` | Python, FastAPI, Uvicorn, Gemini, ChromaDB | 8000 |

## Getting Started

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
cp .env.example .env    # add MONGO_URI, AI_SERVICE_URL
npm install
npm run dev
```

### AI Service
```bash
cd ai-service

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Verify each service is alive:
- Frontend → `http://localhost:3000`
- Backend  → `http://localhost:5000/api/health`
- AI Svc   → `http://localhost:8000/health`

## Environment Variables

Copy `.env.example` to `.env` in `backend/` and `ai-service/` and fill in the values.
