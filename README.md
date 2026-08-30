# DenkenAI

An adaptive exam preparation platform for JEE, NEET, and CBSE students, plus custom exams built from a student's own syllabus. DenkenAI runs students through a test → analyze → revise loop: adaptive tests, mistake-level performance analysis, and AI-generated revision material (Smart Notes, formula drills, weak-area targeting).

## Architecture

Three services, each with its own directory:

```
Browser
   │
   ▼
frontend/    Next.js 14 (App Router) + TypeScript + Tailwind CSS      :3000
   │  REST calls, JWT bearer auth
   ▼
backend/     Node.js + Express + TypeScript + Mongoose                :5000
   │  Orchestrates AI calls, owns auth/entitlements/payments/rate limits
   ▼
ai-service/  Python + FastAPI + ChromaDB (RAG) + Gemini               :8000
   Question generation, mentor chat, notes, revision planning, OCR
```

The backend is the sole orchestrator: the frontend talks to the backend only, and the backend decides when to call `ai-service`. `ai-service` is not meant to be reachable directly from the browser — its `/admin` and `/debug` routers require an `X-Internal-Key` header (see [Security notes](#security-notes)) and are otherwise closed.

Data stores: MongoDB (users, tests, subscriptions), ChromaDB (RAG content chunks, local to `ai-service`), Redis (optional — topic-weight cache, AI quota tracking).

Payments run through Razorpay: `backend` creates orders and verifies payment signatures server-side; Razorpay also calls back via a signed webhook (`POST /api/webhook/razorpay`) as a reconciliation safety net.

## Getting started

Each service needs its own `.env` — copy the matching `.env.example` and fill in real values before running.

### frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Runs at `http://localhost:3000`. Needs `NEXT_PUBLIC_API_URL` pointing at the backend.

### backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Runs at `http://localhost:5000`. Requires `MONGO_URI` and `JWT_SECRET` at minimum; the process refuses to start without `JWT_SECRET`. Check readiness at `GET /health`.

Other scripts: `npm run build` (compile to `dist/`), `npm start` (run compiled output).

### ai-service

```bash
cd ai-service
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Runs at `http://localhost:8000`. Defaults to a mock AI provider so it runs without any API key — set `AI_PROVIDER=gemini` and `GEMINI_API_KEY` to use real generation. Check readiness at `GET /health`.

### Sanity check

- frontend → `http://localhost:3000`
- backend → `http://localhost:5000/health`
- ai-service → `http://localhost:8000/health`

## Environment variables

| Service | Key | Notes |
|---|---|---|
| backend | `MONGO_URI` | required |
| backend | `JWT_SECRET` | required — process exits without it |
| backend | `AI_SERVICE_URL` | defaults to `http://localhost:8000` |
| backend | `REDIS_URL` | optional, disables caching if unset |
| backend | `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | payments |
| backend | `GEMINI_API_KEY` | direct Gemini calls for grounded question generation |
| backend | `ALLOWED_ORIGINS` | comma-separated CORS allowlist |
| backend | `DEV_MODE` | leave `false`/unset in production — gates `/api/dev/*` |
| ai-service | `AI_PROVIDER` | `mock` \| `gemini` \| `openrouter` |
| ai-service | `GEMINI_API_KEY` / `OPENROUTER_API_KEY` | per provider |
| ai-service | `INTERNAL_API_KEY` | required to call `/admin/*` and `/debug/*` |
| ai-service | `ENVIRONMENT` | set to `production` on the deployed service to disable public `/docs` |
| frontend | `NEXT_PUBLIC_API_URL` | backend base URL |

Full lists live in each service's `.env.example`.

## Security notes

- `ai-service`'s `/admin` (data ingestion/deletion) and `/debug` (RAG pipeline inspection) routers are internal-only and require a matching `X-Internal-Key` header; they reject every request when `INTERNAL_API_KEY` is unset. Nothing in normal app usage depends on these being open — treat any change that relaxes this as a deliberate, reviewed decision.
- Razorpay payment verification cross-checks the client-supplied plan against the plan the order was actually created and charged for, so a client can't claim a cheaper order under a more expensive plan.
- `/api/dev/*` on the backend is hard-gated behind `DEV_MODE` and auth; keep `DEV_MODE` unset (or `false`) outside local development.
