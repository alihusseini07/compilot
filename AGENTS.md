# Compilot — Agent System Reference

Compilot's analysis pipeline is a tiered cascade: **3 domain scraper agents** feed a
**daily synthesis**, daily reports roll up into a **weekly synthesis**, and weekly
reports roll up into a **monthly synthesis**. Every agent — scrapers and synthesizers
— calls the LLM (Gemma 4 on Ollama). The orchestrator (`backend/agents/orchestrator.py`)
is the single entry point and is invoked by the FastAPI `/analyze` endpoint or the
three K8s CronJobs.

```
Orchestrator
    ├── Jobs Agent          → scrapes job postings + new hires → LLM conclusion
    ├── Research Agent      → scrapes news + PR + pricing diffs → LLM conclusion
    └── Tech Agent          → scrapes GitHub commits + patents → LLM conclusion
                ↓
        Daily Synthesis Agent
        (reasons across 3 agent conclusions → daily_reports row)
                ↓
        Weekly Synthesis Agent
        (reasons across 7 daily reports → weekly_reports row)
        (FALLBACK: if <7 daily reports, calls all 3 scrapers with last_7_days)
                ↓
        Monthly Synthesis Agent
        (reasons across 4 weekly reports → monthly_reports row)
        (FALLBACK: if <4 weekly reports, calls all 3 scrapers with last_30_days)
```

---

## Conclusion-Object Schema

Every scraper agent's `run(company, date_range)` returns this shape. It is the
universal carrier between scrapers and the synthesis tiers.

```python
{
    "agent": "jobs",              # "jobs" | "research" | "tech"
    "signal_count": 14,           # raw data points found pre-LLM
    "conclusion": "...",          # 2-4 sentence LLM reasoning, plain text
    "confidence": "high",         # "high" 10+ | "medium" 3-9 | "low" 1-2 | "none" 0
    "date_range": "last_day",     # "last_day" | "last_7_days" | "last_30_days"
    "error": None                 # error string if something failed, else None
}
```

Confidence is derived purely from `signal_count` in `BaseAgent.reason()`. On
exception, `error` is populated and `conclusion=""`.

---

## BaseAgent

`backend/agents/base_agent.py`. All scrapers inherit it.

Contract:
- `agent_name: str` class attr (e.g. `"jobs"`).
- `async _fetch(company, date_range) -> list[dict]` — pull raw data points.
- `_build_prompt(company, data) -> str` — render the per-agent LLM prompt.
- `async run(company, date_range="last_day") -> dict` — fetch + reason + wrap into a conclusion object. Do not override.
- `reason(data, prompt, date_range) -> dict` — Ollama call helper.

All LLM access goes through `BaseAgent.reason()`, which uses the single shared
client in `backend/llm.py`. **Never instantiate a second `OpenAI(...)` client.**

---

## Scraper Agents

### 1. JobsAgent — `backend/agents/jobs_agent.py`

Hiring signal aggregator. Tries Greenhouse → Lever → Workday → LinkedIn job
search for the company, dedups by stable `job_id`, classifies postings against
AI/enterprise/infra keyword sets, and asks the LLM what the hiring pattern
suggests about strategic priorities, new product areas, or org changes.

### 2. ResearchAgent — `backend/agents/research_agent.py`

News, PR, and pricing aggregator. Sources:
- TechCrunch + VentureBeat RSS (filtered by company-name mention + cutoff date)
- Hacker News Algolia search by company name (date-windowed)
- Pricing-page snapshot (URL discovery + visible-text extract + tier detection)

The LLM is asked to filter out fluff (awards, HR announcements) and reason only
about strategically significant items (product launches, partnerships,
leadership changes, regulatory news, financial moves, pricing changes).

### 3. TechAgent — `backend/agents/tech_agent.py`

Technology signal aggregator. Sources:
- GitHub org REST API: new public repos created in the window
- GitHub commits in the window that touch dependency manifests (`package.json`,
  `requirements.txt`, `go.mod`, `Cargo.toml`, `pyproject.toml`)
- Lens.org patent search by assignee, filtered by `date_published >= cutoff`

The LLM is asked what the company is building and what technical bets they're
making.

---

## Synthesis Agents

### Daily — `backend/agents/daily_synthesis_agent.py`

Input: list of 3 conclusion objects from the scrapers.
Action: prompts the LLM for a JSON object `{report_text, key_insights}` using
`response_format={"type": "json_object"}`. Writes one row to `daily_reports`
with the parsed `report_text`, `key_insights` array, and an
`overall_confidence` derived from the 3 input conclusions.

### Weekly — `backend/agents/weekly_synthesis_agent.py`

Normal mode: queries the last 7 `daily_reports` rows for the company, reasons
across them, writes a `weekly_reports` row with `fallback_used=false`.

Fallback mode (fewer than 7 daily reports exist): calls JobsAgent +
ResearchAgent + TechAgent with `date_range="last_7_days"`, synthesizes
directly, writes the row with `fallback_used=true`. Logged clearly with
`[weekly-synthesis] FALLBACK MODE for <company>`.

### Monthly — `backend/agents/monthly_synthesis_agent.py`

Normal mode: queries the last 4 `weekly_reports` rows for the company, reasons
across them, writes a `monthly_reports` row with `fallback_used=false`.

Fallback mode (fewer than 4 weekly reports exist): calls the 3 scrapers with
`date_range="last_30_days"`, synthesizes directly, writes the row with
`fallback_used=true`.

---

## Orchestrator

`backend/agents/orchestrator.py` exposes a single coroutine:

```python
async def run(company: str, mode: str = "daily") -> dict
```

- `mode="daily"` — runs the 3 scrapers in parallel with `asyncio.gather(return_exceptions=True)`, normalizes any raised exceptions into a conclusion object with `error` set, then calls `DailySynthesisAgent`.
- `mode="weekly"` — delegates to `WeeklySynthesisAgent` (which owns its own normal/fallback branch).
- `mode="monthly"` — delegates to `MonthlySynthesisAgent`.

**Failure isolation**: any scraper that raises is caught by `asyncio.gather`;
the daily synthesis still runs with whatever conclusions did succeed. Logs are
emitted at every step (`[orchestrator] start … mode=…`, `[<agent>] start …`,
`[<agent>] done …`) so the K8s log tail is readable during a demo.

---

## API Surface

New canonical endpoints (served by `backend/api/routes.py`):

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/analyze/{company}?mode=daily\|weekly\|monthly` | Enqueue Celery `analyze_company_task`, returns `job_id`. |
| GET  | `/reports/{company}/daily?limit=30` | Last N daily reports. |
| GET  | `/reports/{company}/weekly?limit=12` | Last N weekly reports. |
| GET  | `/reports/{company}/monthly?limit=12` | Last N monthly reports. |
| GET  | `/reports/{company}/latest` | `{daily, weekly, monthly}` — most recent of each. |

Legacy endpoints kept alive for the existing frontend (will return empty
collections since new scrapers no longer write to `signals` and the synthesis
tiers don't write to `inferences`):

| Method | Path | Behavior |
|--------|------|----------|
| POST | `/api/run-scrape` | Re-wired → `analyze_company_task(company, "daily")` |
| POST | `/api/synthesize` | Re-wired → `analyze_company_task(company, "daily")` |
| GET  | `/api/signals/{company}` | Reads `signals` table (legacy, expected empty) |
| GET  | `/api/inferences/{company}` | Reads `inferences` table (legacy, expected empty) |
| GET  | `/api/health` | Liveness/readiness |

---

## Database

Existing tables `signals` and `inferences` are preserved but no longer written
to by the new pipeline. Three new tables hold all output:

- `daily_reports(id, company, report_date, report_text, key_insights JSONB, overall_confidence, created_at)`
- `weekly_reports(id, company, week_start, report_text, fallback_used BOOLEAN, created_at)`
- `monthly_reports(id, company, month_start, report_text, fallback_used BOOLEAN, created_at)`

All three are indexed on `(company, <date>)`. DDL lives in
`backend/db/schema.sql`; SQLAlchemy models in `backend/db/models.py`.

---

## Celery + Kubernetes

`backend/tasks.py` exposes one canonical task: `analyze_company_task(company, mode)`.
The legacy task names `run_all_scrapers_task` and `run_synthesis_task` remain
as shims that call `analyze_company_task(company, "daily")` so the existing
frontend stays functional.

K8s CronJobs (each `kubectl apply -f k8s/<name>.yaml`):

| Manifest | Schedule | Mode |
|----------|----------|------|
| `k8s/daily-cronjob.yaml`   | `0 0 * * *`  | daily   |
| `k8s/weekly-cronjob.yaml`  | `0 0 * * 1`  | weekly  |
| `k8s/monthly-cronjob.yaml` | `0 0 1 * *`  | monthly |

All three iterate over `TRACKED_COMPANIES` (comma-separated env), call
`agents.orchestrator.run(company, mode)`, and use the same `compilot-secrets`
secret refs as the old scrapers (`OLLAMA_HOST`, `DATABASE_URL`, `REDIS_URL`,
`OLLAMA_MODEL`, plus optional `GITHUB_TOKEN`, `LENS_API_TOKEN`).

---

## Claude Code Working Rules

1. **All LLM access goes through `BaseAgent.reason()` or the synthesis agents' helpers**, each importing `client` from `backend/llm.py`. Never instantiate a second Ollama client.
2. **All DB writes use the SQLAlchemy models in `backend/db/models.py`**. No raw SQL strings.
3. **Scraper failures must be isolated.** Use `asyncio.gather(return_exceptions=True)` whenever fanning out, and normalize exceptions into conclusion objects with `error` set.
4. **No secrets in agent code.** Read from `os.environ` — never hardcode.
5. **Never commit code yourself.** Stage changes and present them — let the user commit.
6. **CLAUDE.md and AGENTS.md stay in sync.** Edits to one must be mirrored in the other in the same session.

---

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
  kubectl get all                                       # cluster overview
  kubectl logs -f deployment/compilot-backend           # backend logs
  kubectl logs -f deployment/compilot-celery-worker     # worker logs
  kubectl get cronjobs                                  # schedules
  kubectl create job --from=cronjob/compilot-daily manual-daily-$(date +%s)
  ```
- Secrets live in K8s Secret `compilot-secrets` — never read from `.env` in prod.
