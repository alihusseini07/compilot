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

Compilot uses a tiered pipeline: 3 domain scraper agents each reason over their
own data with the LLM, then 3 synthesis tiers (daily → weekly → monthly) roll
those conclusions into successively higher-level reports. The orchestrator
(`backend/agents/orchestrator.py`) is the single entry point.

```
Orchestrator
    ├── Jobs Agent       → scrapes job postings + new hires → LLM conclusion
    ├── Research Agent   → scrapes news + PR + pricing diffs → LLM conclusion
    └── Tech Agent       → scrapes GitHub + patents → LLM conclusion
                ↓
        Daily Synthesis Agent   → daily_reports row
                ↓
        Weekly Synthesis Agent  → weekly_reports row
        (FALLBACK to direct-scrape last_7_days if <7 daily reports)
                ↓
        Monthly Synthesis Agent → monthly_reports row
        (FALLBACK to direct-scrape last_30_days if <4 weekly reports)
```

Each scraper agent inherits `BaseAgent` (`backend/agents/base_agent.py`),
implements `_fetch(company, date_range)` and `_build_prompt(company, data)`,
and returns a uniform **conclusion object**:

```python
{"agent", "signal_count", "conclusion", "confidence", "date_range", "error"}
```

Confidence is bucketed off signal count (10+ high, 3-9 medium, 1-2 low, 0 none).
The orchestrator catches per-scraper exceptions with
`asyncio.gather(return_exceptions=True)` so one bad source does not abort the
daily synthesis.

The synthesis tiers each persist to their own table — `daily_reports`,
`weekly_reports`, `monthly_reports`. Weekly/Monthly fall back to direct scrape
when lower-tier history is missing; the row is flagged with
`fallback_used=true`. All LLM calls go through Gemma 4 (`OLLAMA_MODEL` env, default `gemma4:e4b`) via the
`openai` SDK pointed at the Ollama VM on the same Vultr VPC (`OLLAMA_HOST`).
The shared client is `backend/llm.py`; **never instantiate a second one**.

The old `signals` and `inferences` tables are preserved but no longer written
to by the new pipeline.

## Folder Structure

```
compilot/
├── CLAUDE.md              # This file — project context for Claude Code
├── AGENTS.md              # Agent system documentation and contracts
├── README.md              # Human-facing quickstart and deploy guide
├── .env.example           # Environment variable template
├── backend/
│   ├── main.py            # FastAPI app entrypoint
│   ├── tasks.py           # Celery: analyze_company_task + legacy shims
│   ├── llm.py             # Shared Ollama client factory (only instantiation)
│   ├── requirements.txt   # Python dependencies
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── base_agent.py             # BaseAgent + reason() LLM helper
│   │   ├── jobs_agent.py             # Greenhouse/Lever/Workday/LinkedIn
│   │   ├── research_agent.py         # RSS + HN + pricing diff
│   │   ├── tech_agent.py             # GitHub + Lens.org patents
│   │   ├── daily_synthesis_agent.py  # 3 conclusions → daily_reports
│   │   ├── weekly_synthesis_agent.py # 7 daily (or fallback) → weekly_reports
│   │   ├── monthly_synthesis_agent.py# 4 weekly (or fallback) → monthly_reports
│   │   └── orchestrator.py           # run(company, mode) entry point
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py          # New /analyze + /reports + legacy /api/* shims
│   └── db/
│       ├── __init__.py
│       ├── models.py          # SQLAlchemy ORM models (incl. *Report tables)
│       └── schema.sql         # Raw DDL for reference / migrations
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       └── components/
│           ├── ReportCard.jsx      # Single report card (daily/weekly/monthly)
│           └── HistoryList.jsx     # Collapsible past-reports list
└── k8s/
    ├── backend-deployment.yaml
    ├── frontend-deployment.yaml
    ├── celery-worker-deployment.yaml
    ├── configmap.yaml
    ├── daily-cronjob.yaml     # orchestrator daily @ 00:00 UTC
    ├── weekly-cronjob.yaml    # orchestrator weekly @ Mon 00:00 UTC
    └── monthly-cronjob.yaml   # orchestrator monthly @ 1st 00:00 UTC
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
- All K8s deployments use `imagePullPolicy: Always` — pods always pull from Docker Hub on restart.
- **Docker image tagging gotcha:** `docker compose build` tags the image as `compilot-frontend:latest` (local name), NOT `ahusseini07/compilot-frontend:latest`. Always retag before pushing: `docker tag compilot-frontend:latest ahusseini07/compilot-frontend:latest && docker push ahusseini07/compilot-frontend:latest`. Same applies to the backend image (`compilot-backend` → `ahusseini07/compilot-backend`).
- **nginx proxy:** `frontend/nginx.conf` proxies `/api/`, `/analyze/`, and `/reports/` to the backend. Any new route prefix added to the FastAPI app must also get a `location` block in nginx.conf, then the frontend image must be rebuilt and redeployed.

## Key Conventions

- **All scraper agents inherit from `BaseAgent`** defined in `backend/agents/base_agent.py`. Never bypass this interface.
- **All DB access goes through SQLAlchemy models** in `backend/db/models.py`. No raw SQL strings in agent code.
- **All LLM inference goes through `BaseAgent.reason()` or the synthesis agents' helpers**, each importing `client` from `backend/llm.py`. That file is the **only** Ollama client instantiation. Never add a second one.
- **Never hardcode environment variables.** All secrets and config are loaded via `python-dotenv` from `.env` (local) or K8s Secrets (production).
- **Scraper failures must be isolated.** Use `asyncio.gather(return_exceptions=True)` and normalize exceptions into conclusion objects with `error` populated.
- **Never commit code yourself.** Stage changes and present them — let the user commit.
- **CLAUDE.md and AGENTS.md stay in sync.** Any edit made to one must be mirrored in the other in the same session.

## Demo Flow

1. User enters a competitor company name (e.g., `"Linear"`) in the frontend.
2. Frontend calls `POST /api/run-scrape` (legacy compat shim) → backend enqueues `analyze_company_task(company, "daily")`.
3. Celery worker runs `orchestrator.run(company, "daily")`: 3 scraper agents fan out via `asyncio.gather`, each making its own LLM call and returning a conclusion object.
4. `DailySynthesisAgent` consumes the 3 conclusions, calls Gemma 4 once more, writes a row to `daily_reports`.
5. Frontend GETs `/reports/{company}/latest` (new) or the legacy `/api/signals`/`/api/inferences` endpoints (which now return empty collections — frontend will need an update to consume `/reports/*`).
6. Weekly + Monthly tiers run on their own CronJobs (Mon midnight + 1st of month midnight) and produce `weekly_reports` / `monthly_reports` rows, with fallback paths that re-run the scrapers over a wider window if upstream history is sparse.
