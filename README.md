# Compilot — Competitive Intelligence Radar

> Cross-signal AI that monitors competitors across public data sources and infers their strategic moves before they're announced.

## Core Insight

No single signal tells the whole story. A new job posting is noise. But a new ML job posting + a dependency on `openai` appearing in their repo + a pricing page that added an "AI" tier — that's a product launch in 6 weeks. Compilot fans out three scraper agents across GitHub, job boards, news/PR/pricing, and patents, then synthesizes conclusions through daily → weekly → monthly tiers using DeepSeek-V3.2.

## Architecture

```
[React Frontend]
      │
      │ HTTP / REST
      ▼
[FastAPI Backend] ──── Celery Tasks ────► [Jobs Agent    ] ──┐
      │                                  [Research Agent ] ──┤──► [Daily Synthesis]
      │                                  [Tech Agent     ] ──┘          │
      │                                                           [Weekly Synthesis]
      │                                                                  │
      │                                                          [Monthly Synthesis]
      │                                                                  │
      └──────────────── GET /reports/{company} ◄───────────── [PostgreSQL]
                                                              (daily/weekly/monthly_reports)
```

**Inference:** All LLM calls go to `nvidia/DeepSeek-V3.2-NVFP4` via Vultr Serverless Inference (OpenAI-compatible API). No self-hosted GPU VM required.

## Quickstart (Local Dev — Docker Compose)

### Prerequisites

- Docker + Docker Compose
- A GitHub personal access token (read-only, `public_repo` scope)
- Vultr Serverless Inference credentials (`INFERENCE_API_KEY`, `INFERENCE_BASE_URL`)

### 1. Clone and configure

```bash
git clone https://github.com/your-org/compilot.git
cd compilot
cp .env.example .env
# Fill in INFERENCE_API_KEY, INFERENCE_BASE_URL, GITHUB_TOKEN, DATABASE_URL, REDIS_URL
```

### 2. Start all services

```bash
docker compose up --build -d
```

- Frontend: `http://localhost`
- Backend API: `http://localhost:8000`

### 3. Trigger a scrape

```bash
curl -X POST http://localhost:8000/api/run-scrape \
  -H "Content-Type: application/json" \
  -d '{"company": "linear"}'
```

Poll for results:

```bash
curl http://localhost:8000/reports/linear/latest
```

---

## Agent Pipeline

| Agent | Sources | Output |
|-------|---------|--------|
| Jobs Agent | Greenhouse, Lever, Workday, LinkedIn | Hiring signal conclusions |
| Research Agent | RSS, Hacker News, pricing diffs | PR / market signal conclusions |
| Tech Agent | GitHub, Lens.org patents | Engineering signal conclusions |
| Daily Synthesis | 3 scraper conclusions | `daily_reports` row |
| Weekly Synthesis | ≥7 daily reports | `weekly_reports` row |
| Monthly Synthesis | ≥4 weekly reports | `monthly_reports` row |

Synthesis tiers return **422** immediately if the required upstream history doesn't exist — no fallback scraping.

---

## Deploy to Vultr Kubernetes Engine (VKE)

### 1. Configure kubectl

```bash
# Copy kubeconfig downloaded from Vultr console
cp ~/Downloads/vke-*.yaml ~/.kube/config
kubectl get nodes  # verify
```

### 2. Create secrets

```bash
kubectl create secret generic compilot-secrets \
  --from-literal=INFERENCE_API_KEY=... \
  --from-literal=INFERENCE_BASE_URL=... \
  --from-literal=DATABASE_URL=postgresql+asyncpg://... \
  --from-literal=REDIS_URL=redis://... \
  --from-literal=GITHUB_TOKEN=ghp_...
```

### 3. Apply manifests

```bash
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/celery-worker-deployment.yaml
kubectl apply -f k8s/daily-cronjob.yaml
kubectl apply -f k8s/weekly-cronjob.yaml
kubectl apply -f k8s/monthly-cronjob.yaml
```

### 4. Useful commands

```bash
kubectl get all                                        # cluster overview
kubectl logs -f deployment/compilot-backend            # backend logs
kubectl logs -f deployment/compilot-celery-worker      # worker logs
kubectl get cronjobs                                   # scraper schedules
kubectl create job --from=cronjob/daily-scraper manual-run-1  # trigger manually
```

### Docker image push (before deploy)

```bash
docker compose build
docker tag compilot-backend:latest ahusseini07/compilot-backend:latest
docker push ahusseini07/compilot-backend:latest
docker tag compilot-frontend:latest ahusseini07/compilot-frontend:latest
docker push ahusseini07/compilot-frontend:latest
```

> **Note:** K8s deployments use `imagePullPolicy: Always` — pods pull from Docker Hub on every restart.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `INFERENCE_API_KEY` | Vultr Serverless Inference API key |
| `INFERENCE_BASE_URL` | Vultr Serverless Inference base URL |
| `INFERENCE_MODEL` | Model tag (set in K8s configmap, default: `nvidia/DeepSeek-V3.2-NVFP4`) |
| `DATABASE_URL` | PostgreSQL connection string (asyncpg format) |
| `REDIS_URL` | Redis connection string for Celery broker |
| `GITHUB_TOKEN` | GitHub PAT with `public_repo` read scope |

---

## Adding a New Route

Any new route prefix added to FastAPI must also get a `location` block in `frontend/nginx.conf`, then the frontend image must be rebuilt and redeployed.
