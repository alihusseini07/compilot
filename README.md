# Compilot — Competitive Intelligence Radar

> Cross-signal AI that monitors competitors across public data sources and infers their strategic moves before they're announced.

## Core Insight

No single signal tells the whole story. A new job posting is noise. But a new ML job posting + a dependency on `openai` appearing in their repo + a pricing page that added an "AI" tier — that's a product launch in 6 weeks. Compilot runs five scrapers in parallel across GitHub, news, job boards, patents, and pricing pages, then asks Gemma 4 26B MoE (running on a private Ollama VM) to reason across all of them simultaneously.

## Quickstart (Local Dev)

### Prerequisites

- Docker + Docker Compose
- Node 20+
- Python 3.12+
- A GitHub personal access token (read-only)
- An Ollama VM running `gemma4:26b` (see [Inference server setup](#inference-server-setup) below)

### 1. Clone and configure

```bash
git clone https://github.com/your-org/compilot.git
cd compilot
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

## Inference Server Setup

Compilot runs Gemma 4 26B MoE via Ollama on a **separate** Vultr VM, not inside the K8s cluster. This keeps GPU/RAM requirements isolated and lets you swap models without redeploying the cluster.

### 1. Provision the VM

- Type: `vc2-4c-16gb` (4 vCPU, 16 GB RAM — required for `gemma4:26b` at ~14 GB RAM)
- OS: Ubuntu 24.04 LTS
- Region: same as your VKE cluster
- Attach it to the **same Vultr VPC** as the cluster so internal IPs route correctly

### 2. Run the setup script

SSH into the VM and run:

```bash
bash infra/ollama-setup.sh
```

This will:
- Install Ollama via the official installer
- Configure Ollama to bind on all interfaces (`OLLAMA_HOST=0.0.0.0`) so the K8s cluster can reach it
- Pull `gemma4:26b` (~14 GB download, takes several minutes)
- Print the VM's internal IP and confirm the model is loaded

### 3. Note the internal IP

The script prints the VM's internal IP at the end. Add it to your `.env`:

```bash
OLLAMA_HOST=10.x.x.x   # internal IP printed by the script
OLLAMA_MODEL=gemma4:26b
```

And add to your K8s secret:

```bash
kubectl create secret generic compilot-secrets \
  --from-literal=OLLAMA_HOST=10.x.x.x \
  # ... other secrets
```

> **Important:** The K8s cluster and Ollama VM must be on the same Vultr VPC. If they are not, the synthesis agent will fail to connect to `OLLAMA_HOST`. Do not use the public IP — use the internal IP for low latency and no egress cost.

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
kubectl create secret generic compilot-secrets \
  --from-literal=OLLAMA_HOST=10.x.x.x \
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
| `OLLAMA_HOST` | Internal IP of the Ollama inference VM (e.g. `10.x.x.x`) |
| `OLLAMA_MODEL` | Ollama model tag (default: `gemma4:26b`) |
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
      │                                          [Ollama VM — Gemma 4 26B]
      │                                                  │
      └──────────────── GET /inferences ◄───────────────┘
```
