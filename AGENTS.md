# Compilot — Agent System Reference

## Agent Architecture

All agents inherit from `BaseAgent` (`backend/agents/__init__.py`). The interface enforces:
- `async def run(company: str) -> list[dict]` — main entry point
- `async def _fetch(...)` — source-specific data retrieval (implemented per agent)
- `async def _write_signals(signals: list[dict])` — writes to DB (implemented in base)

Claude Code rule: **never skip the base class**. If you add a new scraper, extend `BaseAgent`.

---

## Scraper Agents

### 1. GitHubAgent (`github_agent.py`)

**Data source:** GitHub REST API v3 + GraphQL API  
**Libraries:** `httpx` (async HTTP), `python-dotenv`  
**Schedule:** Every 6 hours (`0 */6 * * *`)

**What it fetches:**
- New public repositories created by the target org in the last N days
- Recent commits that touch `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, `pyproject.toml`
- Repository topic/tag changes (reveals product pivots)

**What it writes to `signals`:**
```json
{
  "company": "linear",
  "source_type": "github",
  "source_id": "commit:<sha>",
  "content": "Commit abc123 touched requirements.txt: added 'openai>=1.0'",
  "metadata": {
    "repo": "linear/backend",
    "sha": "abc123",
    "diff_summary": "added openai>=1.0",
    "file": "requirements.txt"
  }
}
```

**Auth:** `GITHUB_TOKEN` env var (personal access token, read-only scope).

---

### 2. NewsAgent (`news_agent.py`)

**Data source:** RSS feeds (TechCrunch, VentureBeat, Hacker News), NewsAPI  
**Libraries:** `feedparser`, `httpx`, `python-dotenv`  
**Schedule:** Every 2 hours (`0 */2 * * *`)

**What it fetches:**
- RSS entries mentioning the company name (case-insensitive)
- NewsAPI top headlines filtered by company name query

**What it writes to `signals`:**
```json
{
  "company": "linear",
  "source_type": "news",
  "source_id": "news:<url-hash>",
  "content": "Linear raises $35M Series B to expand project management platform",
  "metadata": {
    "url": "https://techcrunch.com/...",
    "source": "TechCrunch",
    "published_at": "2025-05-10T14:00:00Z"
  }
}
```

---

### 3. JobsAgent (`jobs_agent.py`)

**Data source:** Greenhouse API (public job boards), LinkedIn job search (scrape)  
**Libraries:** `httpx`, `beautifulsoup4`, `python-dotenv`  
**Schedule:** Daily at 8am UTC (`0 8 * * *`)

**What it fetches:**
- Open job postings for the target company
- Extracts: job title, department, tech keywords from description, location

**Signal insight:** Hiring for ML engineers + infra = platform expansion. Hiring for enterprise sales = GTM shift.

**What it writes to `signals`:**
```json
{
  "company": "linear",
  "source_type": "jobs",
  "source_id": "job:<posting-id>",
  "content": "New posting: Senior ML Engineer (Search & AI team) — requires PyTorch, RAG, vector DBs",
  "metadata": {
    "title": "Senior ML Engineer",
    "department": "Search & AI",
    "keywords": ["PyTorch", "RAG", "vector databases"],
    "url": "https://boards.greenhouse.io/linear/jobs/..."
  }
}
```

---

### 4. PatentsAgent (`patents_agent.py`)

**Data source:** USPTO Patent Full-Text Database (PatentsView API), EPO Open Patent Services  
**Libraries:** `httpx`, `python-dotenv`  
**Schedule:** Weekly on Monday at 6am UTC (`0 6 * * 1`)

**What it fetches:**
- Patent applications and grants where assignee name matches the company
- Extracts: patent title, abstract, filing date, CPC classification codes

**What it writes to `signals`:**
```json
{
  "company": "linear",
  "source_type": "patents",
  "source_id": "patent:US20250012345",
  "content": "Patent filed: 'System and method for AI-assisted project prioritization using historical velocity data'",
  "metadata": {
    "patent_id": "US20250012345",
    "filing_date": "2025-03-15",
    "cpc_codes": ["G06F40/30", "G06N20/00"],
    "abstract": "..."
  }
}
```

---

### 5. PricingAgent (`pricing_agent.py`)

**Data source:** Competitor's public pricing page (HTML scrape + diff)  
**Libraries:** `httpx`, `beautifulsoup4`, `python-dotenv`  
**Schedule:** Daily at midnight UTC (`0 0 * * *`)

**What it fetches:**
- Full text content of the pricing page
- Diffs against last stored version to detect changes

**What it writes to `signals`:**
```json
{
  "company": "linear",
  "source_type": "pricing",
  "source_id": "pricing:<date>",
  "content": "Pricing page changed: 'Plus' plan limit raised from 50 to unlimited members. New 'Enterprise AI' add-on added at $20/seat/mo.",
  "metadata": {
    "url": "https://linear.app/pricing",
    "diff_summary": "Plus plan member limit removed; Enterprise AI add-on added",
    "detected_at": "2025-05-14T00:05:00Z"
  }
}
```

---

## Synthesis Agent (`synthesis_agent.py`)

**Schedule:** Nightly at midnight UTC (`0 0 * * *`)  
**Model:** Gemma 4 26B MoE — Ollama model tag `gemma4:26b`, ~14 GB RAM usage. Requires `ollama pull gemma4:26b` on the inference VM before deploying.  
**Inference server:** Ollama on a dedicated Vultr `vc2-4c-16gb` VM, separate from the K8s cluster but on the same Vultr VPC. Exposes an OpenAI-compatible endpoint at `http://<OLLAMA_HOST>:11434/v1`.  
**Client:** `openai.OpenAI(base_url=f"http://{OLLAMA_HOST}:11434/v1", api_key="ollama")` — Ollama does not require a real API key.  
**All LLM calls are contained in `synthesis_agent.py` — never instantiate the Ollama client elsewhere.**

### API Call Parameters

- `temperature=0.2` — low temperature for deterministic structured reasoning, not creative generation
- `response_format={"type": "json_object"}` — forces Ollama to return valid JSON
- `max_tokens=4096`

### Prompt Structure

The system prompt instructs the model to respond **only** with a JSON object matching the schema below. No markdown, no prose outside the JSON.

```
System:
You are a competitive intelligence analyst. Respond ONLY with a valid JSON object with key
"inferences" containing an array. Each element must match the inference schema exactly.

User:
Company: {company_name}
Analysis window: {start_date} to {end_date}

Signals (JSON array):
{signals_json}

Produce a JSON object {"inferences": [...]} of strategic inferences.
Return {"inferences": []} if no meaningful inferences can be drawn.
```

### Expected Response Schema

```json
[
  {
    "inference": "Linear is building an AI-native project management layer, likely to launch within 2 quarters.",
    "confidence": "high",
    "reasoning": "Three ML engineer postings (Search & AI team), a patent on AI-assisted prioritization, and a new openai dependency in their backend repo all point to a coordinated AI feature push.",
    "supporting_signal_ids": [42, 87, 103],
    "category": "product"
  }
]
```

### Confidence Score Assignment

The model is instructed to assign confidence based on signal corroboration:
- **high** — 3+ independent signal sources agree on same strategic direction
- **medium** — 2 sources agree, or 1 strong source (e.g., patent filing)
- **low** — single weak signal (e.g., one job posting), speculative

### Inference Categories

`product` | `gtm` | `hiring` | `funding` | `technical` | `regulatory`

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
  kubectl get all                          # cluster overview
  kubectl logs -f deployment/compilot-backend  # backend logs
  kubectl logs -f deployment/compilot-celery-worker  # worker logs
  kubectl get cronjobs                     # scraper schedules
  kubectl create job --from=cronjob/<name> <job-name>  # trigger scraper manually
  ```
- **Secrets** are in K8s Secret `compilot-secrets` — never read from `.env` in prod
- Two known failing jobs as of 2026-05-16: `pricing-scraper`, `synthesis-agent` — investigate before running

## Claude Code Working Rules for Agents

1. **Maintain BaseAgent interface.** Every scraper must implement `async def run(company: str) -> list[dict]` and call `await self._write_signals(signals)`.
2. **Never call the LLM outside `synthesis_agent.py`.** The Ollama client is instantiated there. `backend/llm.py` is a shared factory — do not add a second client instantiation elsewhere.
3. **Scrapers must be idempotent.** Every signal must have a stable `source_id`. Use `INSERT ... ON CONFLICT (source_id) DO NOTHING`.
4. **No secrets in agent code.** Read from `os.environ` or the Settings object — never hardcode tokens, URLs, or credentials.
5. **Keep scraper logic in `_fetch()`, DB logic in `_write_signals()`.** Don't mix concerns in `run()`.
6. **Catch and log HTTP errors per signal, don't abort the whole run.** One bad URL shouldn't kill the batch.
7. **Never commit code yourself.** Stage changes and present them — let the user commit.
8. **CLAUDE.md and AGENTS.md stay in sync.** Any edit made to one must be mirrored in the other in the same session.
