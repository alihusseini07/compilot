"""
Ollama client factory for Compint.

The synthesis agent instantiates its own client directly (see synthesis_agent.py).
This module is kept as a shared utility for any future agent that needs LLM access
without owning client lifecycle management.

Inference backend: Ollama on a dedicated Vultr vc2-4c-16gb VM.
Model: gemma4:26b (Ollama tag). Run `ollama pull gemma4:26b` on the VM first.
Endpoint: http://<OLLAMA_HOST>:11434/v1  (OpenAI-compatible)
API key: "ollama" (Ollama does not require a real key)
"""

import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

_ollama_host = os.getenv("OLLAMA_HOST", "localhost")

client = OpenAI(
    base_url=f"http://{_ollama_host}:11434/v1",
    api_key="ollama",
)
