# Compilot — Competitive Intelligence Radar

Cross-signal AI that monitors competitors across public data sources and infers strategic moves before they're announced.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend runtime | Python 3.12, FastAPI, Uvicorn |
| Task queue | Celery + Redis |
| Database | PostgreSQL 16 (async via asyncpg + SQLAlchemy 2.0) |
| AI inference | Gemma 4 8B (`gemma4:e4b` Ollama tag, ~9.6 GB) on a dedicated Vultr AMD High Performance VM (4 vCPU, 12 GB RAM) running Ollama — OpenAI-compatible API, `openai` Python SDK |
| Frontend | React 18 + Vite 5, Recharts |
| Containerization | Docker, Docker Compose (local dev) |
| Orchestration | Kubernetes on Vultr Kubernetes Engine (VKE) |

## How the Agent System Works

Five scraper agents run as Kubernetes CronJobs in parallel on their own schedules:

1. **GitHubAgent** — polls GitHub API for new repos, commits to dependency files (`package.json`, `requirements.txt`, `go.mod`), and repo topic changes for a target org.
2. **NewsAgent** — fetches RSS feeds and crawls tech news APIs (NewsAPI, Google News RSS) for mentions of the competitor.
3. **JobsAgent** — scrapes job postings from LinkedIn and Greenhouse to detect hiring signals (new teams, tech keywords in JDs).
4. **PatentsAgent** — queries the USPTO/EPO public APIs for new patent filings by the competitor.
5. **PricingAgent** — fetches and diffs the competitor's pricing page to detect tier changes, new plans, or removed features.

Each scraper writes raw signal rows to the `signals` table in Postgres. Signals are idempotent — each has a `source_id` unique key so re-runs don't duplicate data.

A **SynthesisAgent** runs nightly at 00:00 UTC. It:
1. Pulls all signals for each tracked company from the last N days.
2. Calls Gemma 4 8B (`gemma4:e4b`) via the Ollama instance on a dedicated Vultr VM (`OLLAMA_HOST`) using the `openai` SDK pointed at `http://<OLLAMA_HOST>:11434/v1`. The Ollama VM is on the same Vultr private network (VPC) as the K8s cluster for low-latency calls.
3. Writes inference rows to the `inferences` table with confidence scores (high/medium/low) and the IDs of signals that support each inference.

## Folder Structure

```
compilot/
├── CLAUDE.md              # This file — project context for Claude Code
├── AGENTS.md              # Agent system documentation and contracts
├── README.md              # Human-facing quickstart and deploy guide
├── .env.example           # Environment variable template
├── backend/
│   ├── main.py            # FastAPI app entrypoint
│   ├── requirements.txt   # Python dependencies
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── github_agent.py    # GitHub API scraper
│   │   ├── news_agent.py      # RSS/news API scraper
│   │   ├── jobs_agent.py      # Job posting scraper
│   │   ├── patents_agent.py   # Patent filing scraper
│   │   ├── pricing_agent.py   # Pricing page diff scraper
│   │   └── synthesis_agent.py # Gemma 4 26B reasoning agent (via Ollama)
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py          # FastAPI route definitions
│   └── db/
│       ├── __init__.py
│       ├── models.py          # SQLAlchemy ORM models
│       └── schema.sql         # Raw DDL for reference / migrations
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       └── components/
│           ├── RadarDashboard.jsx  # Main radar/timeline view
│           ├── SignalFeed.jsx      # Raw signal stream panel
│           └── InferenceCard.jsx  # Single inference display card
└── k8s/
    ├── backend-deployment.yaml
    ├── frontend-deployment.yaml
    ├── synthesis-cronjob.yaml
    ├── github-scraper-cronjob.yaml
    ├── news-scraper-cronjob.yaml
    └── configmap.yaml
```

## Environments

### Local (Docker Compose)
- Start: `docker compose up --build -d` from project root
- Frontend: `http://localhost` | Backend API: `http://localhost:8000`
- Services: redis, postgres, backend, worker, frontend

### Production (Vultr Kubernetes Engine)
- Cluster: `vke-7b1cece3-84d5-401c-a08d-a4bb3c290098` (2 nodes, Vultr VKE)
- Kubeconfig: `~/.kube/config` — copy from `/mnt/c/Users/ahuss/Downloads/vke-7b1cece3-84d5-401c-a08d-a4bb3c290098.yaml` if missing
- Frontend external IP: `http://155.138.128.101`
- Namespace: `default`
- Apply manifests: `kubectl apply -f k8s/`
- Key commands:
  ```bash
  kubectl get all                          # cluster overview
  kubectl logs -f deployment/compilot-backend  # backend logs
  kubectl logs -f deployment/compilot-celery-worker  # worker logs
  kubectl get cronjobs                     # scraper schedules
  kubectl create job --from=cronjob/<name> <job-name>  # trigger scraper manually
  ```
- **Secrets** are in K8s Secret `compilot-secrets` — never read from `.env` in prod
- Two known failing jobs as of 2026-05-16: `pricing-scraper`, `synthesis-agent` — investigate before running

## Key Conventions

- **All agents inherit from `BaseAgent`** defined in `backend/agents/__init__.py`. Never bypass this interface.
- **All DB access goes through SQLAlchemy models** in `backend/db/models.py`. No raw SQL strings in agent code.
- **All LLM inference is contained in `backend/agents/synthesis_agent.py`**, which instantiates the `openai.OpenAI` client pointed at the Ollama host directly. `backend/llm.py` exists as a shared client factory for future use. Never add a second Ollama client instantiation elsewhere.
- **Never hardcode environment variables.** All secrets and config are loaded via `python-dotenv` from `.env` (local) or K8s Secrets (production).
- **Scrapers must be idempotent.** Use `INSERT ... ON CONFLICT DO NOTHING` on `source_id` to prevent duplicate signals.
- **Never commit code yourself.** Stage changes and present them — let the user commit.
- **CLAUDE.md and AGENTS.md stay in sync.** Any edit made to one must be mirrored in the other in the same session.

## Demo Flow

1. User enters a competitor company name (e.g., `"Linear"`) in the frontend.
2. Frontend calls `POST /api/run-scrape` → backend triggers all 5 scraper agents via Celery tasks.
3. Scrapers run in parallel, writing signals to Postgres.
4. Frontend calls `POST /api/synthesize` → backend triggers `SynthesisAgent`.
5. `SynthesisAgent` calls Gemma 4 26B via Ollama, writes inferences to Postgres.
6. Frontend polls `GET /api/inferences/{company}` and `GET /api/signals/{company}`.
7. Dashboard renders radar view (Recharts RadarChart) + signal timeline + inference cards.
