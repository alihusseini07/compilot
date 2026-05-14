# Compint — Competitive Intelligence Radar

Cross-signal AI that monitors competitors across public data sources and infers strategic moves before they're announced.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend runtime | Python 3.12, FastAPI, Uvicorn |
| Task queue | Celery + Redis |
| Database | PostgreSQL 16 (async via asyncpg + SQLAlchemy 2.0) |
| AI inference | Claude API (`claude-sonnet-4-20250514`) via `anthropic` SDK |
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
2. Calls the Claude API with a structured prompt asking it to reason across signals and produce strategic inferences.
3. Writes inference rows to the `inferences` table with confidence scores (high/medium/low) and the IDs of signals that support each inference.

## Folder Structure

```
compint/
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
│   │   └── synthesis_agent.py # Claude API reasoning agent
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

## Key Conventions

- **All agents inherit from `BaseAgent`** defined in `backend/agents/__init__.py`. Never bypass this interface.
- **All DB access goes through SQLAlchemy models** in `backend/db/models.py`. No raw SQL strings in agent code.
- **All Claude API calls go through `backend/llm.py`** (single utility module). Never instantiate `anthropic.Anthropic()` outside that file.
- **Never hardcode environment variables.** All secrets and config are loaded via `python-dotenv` from `.env` (local) or K8s Secrets (production).
- **Scrapers must be idempotent.** Use `INSERT ... ON CONFLICT DO NOTHING` on `source_id` to prevent duplicate signals.
- **Never commit code yourself.** Stage changes and present them — let the user commit.
- **CLAUDE.md and AGENTS.md stay in sync.** Any edit made to one must be mirrored in the other in the same session.

## Demo Flow

1. User enters a competitor company name (e.g., `"Linear"`) in the frontend.
2. Frontend calls `POST /api/run-scrape` → backend triggers all 5 scraper agents via Celery tasks.
3. Scrapers run in parallel, writing signals to Postgres.
4. Frontend calls `POST /api/synthesize` → backend triggers `SynthesisAgent`.
5. `SynthesisAgent` calls Claude API, writes inferences to Postgres.
6. Frontend polls `GET /api/inferences/{company}` and `GET /api/signals/{company}`.
7. Dashboard renders radar view (Recharts RadarChart) + signal timeline + inference cards.
