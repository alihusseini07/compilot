# Compint — Competitive Intelligence Radar

> Cross-signal AI that monitors competitors across public data sources and infers their strategic moves before they're announced.

## Core Insight

No single signal tells the whole story. A new job posting is noise. But a new ML job posting + a dependency on `openai` appearing in their repo + a pricing page that added an "AI" tier — that's a product launch in 6 weeks. Compint runs five scrapers in parallel across GitHub, news, job boards, patents, and pricing pages, then asks Claude to reason across all of them simultaneously.

## Quickstart (Local Dev)

### Prerequisites

- Docker + Docker Compose
- Node 20+
- Python 3.12+
- A GitHub personal access token (read-only)
- An Anthropic API key

### 1. Clone and configure

```bash
git clone https://github.com/your-org/compint.git
cd compint
cp .env.example .env
# Edit .env and fill in your actual keys
```

### 2. Start backend services

```bash
docker compose up -d postgres redis
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Apply schema
psql $DATABASE_URL -f db/schema.sql
# Start API
uvicorn main:app --reload --port 8000
# Start Celery worker (separate terminal)
celery -A main.celery_app worker --loglevel=info
```

### 3. Start frontend

```bash
cd frontend
npm install
npm run dev
# App runs at http://localhost:5173
```

### 4. Run a scrape

```bash
curl -X POST http://localhost:8000/api/run-scrape \
  -H "Content-Type: application/json" \
  -d '{"company": "linear"}'
```

Then synthesize:

```bash
curl -X POST http://localhost:8000/api/synthesize \
  -H "Content-Type: application/json" \
  -d '{"company": "linear"}'
```

---

## Deploy to Vultr Kubernetes Engine (VKE)

### 1. Provision a VKE cluster

- Node pool: 2x `vc2-2c-4gb` nodes (2 vCPU, 4 GB RAM each)
- Kubernetes version: 1.30+

### 2. Configure kubectl

```bash
# Download kubeconfig from Vultr console
export KUBECONFIG=~/Downloads/vke-kubeconfig.yaml
kubectl get nodes  # verify
```

### 3. Create secrets

```bash
kubectl create secret generic compint-secrets \
  --from-literal=ANTHROPIC_API_KEY=your_key \
  --from-literal=DATABASE_URL=postgresql+asyncpg://... \
  --from-literal=REDIS_URL=redis://... \
  --from-literal=GITHUB_TOKEN=ghp_...
```

### 4. Apply manifests

```bash
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/synthesis-cronjob.yaml
kubectl apply -f k8s/github-scraper-cronjob.yaml
kubectl apply -f k8s/news-scraper-cronjob.yaml
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `DATABASE_URL` | PostgreSQL connection string (asyncpg format) |
| `REDIS_URL` | Redis connection string for Celery broker |
| `GITHUB_TOKEN` | GitHub PAT with `public_repo` read scope |
| `PORT` | Port for FastAPI server (default: 8000) |

---

## Architecture

```
[React Frontend]
      │
      │ HTTP / REST
      ▼
[FastAPI Backend] ──── Celery Tasks ────► [Scraper Agents x5] ──► [PostgreSQL]
      │                                                                  │
      │                                          [Synthesis Agent] ◄────┘
      │                                                  │
      │                                          [Claude API]
      │                                                  │
      └──────────────── GET /inferences ◄───────────────┘
```
