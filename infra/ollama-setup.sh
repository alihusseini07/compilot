#!/usr/bin/env bash
# Ollama inference server setup for a Vultr vc2-4c-16gb VM (Ubuntu 24.04)
# Run this script once on the VM after provisioning:
#   bash infra/ollama-setup.sh
set -euo pipefail

echo "==> Updating apt..."
apt-get update -q && apt-get upgrade -y -q

echo "==> Installing Ollama..."
curl -fsSL https://ollama.com/install.sh | sh

echo "==> Configuring Ollama to listen on all interfaces..."
# By default Ollama only binds to 127.0.0.1. Override via systemd drop-in so the
# K8s cluster can reach it over the Vultr private network.
mkdir -p /etc/systemd/system/ollama.service.d
cat > /etc/systemd/system/ollama.service.d/override.conf <<'EOF'
[Service]
Environment="OLLAMA_HOST=0.0.0.0"
EOF

echo "==> Reloading systemd and restarting Ollama..."
systemctl daemon-reload
systemctl restart ollama
systemctl enable ollama

echo "==> Waiting for Ollama to start..."
sleep 5

echo "==> Pulling gemma4:26b (~14 GB, this will take a few minutes)..."
ollama pull gemma4:26b

echo ""
echo "==> Done. Verifying..."
curl -s http://localhost:11434/api/tags | python3 -c "
import json, sys
data = json.load(sys.stdin)
models = [m['name'] for m in data.get('models', [])]
print('Loaded models:', models)
if any('gemma4' in m for m in models):
    print('SUCCESS: gemma4:26b is available.')
else:
    print('WARNING: gemma4:26b not found in model list. Check ollama pull output above.')
"

echo ""
echo "==> Internal IP of this VM (add to .env and K8s secret as OLLAMA_HOST):"
hostname -I | awk '{print $1}'

echo ""
echo "==> Ollama service status:"
systemctl status ollama --no-pager -l
