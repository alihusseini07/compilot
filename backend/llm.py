"""
Single entry point for all LLM inference calls in Compint.

Rules:
  - Never instantiate OpenAI() outside this file.
  - All agent inference calls go through call_llm().
  - Primary: Vultr Serverless Inference (OpenAI-compatible API, Gemma 4 26B MoE).
  - Fallback: Ollama on a Vultr VM (same OpenAI-compatible interface, same model name).
"""

import logging
import os

from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv()
logger = logging.getLogger(__name__)

MODEL = "gemma-4-26b-it"  # Gemma 4 26B MoE — served via Vultr Serverless Inference or Ollama

_primary = AsyncOpenAI(
    api_key=os.environ["VULTR_INFERENCE_API_KEY"],
    base_url=os.environ["VULTR_INFERENCE_URL"],
)

# Ollama exposes an OpenAI-compatible API at /v1. No API key required.
_fallback = AsyncOpenAI(
    api_key="ollama",
    base_url=os.environ.get("OLLAMA_URL", "http://localhost:11434/v1"),
)


async def call_llm(
    system: str,
    user: str,
    model: str = MODEL,
    max_tokens: int = 4096,
) -> str:
    """
    Call the LLM and return response text.

    Tries Vultr Serverless Inference first. On any error, falls back to Ollama
    on the local Vultr VM. Both endpoints speak the OpenAI Chat Completions API.
    """
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]

    try:
        response = await _primary.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.warning(f"[llm] Primary (Vultr Serverless) failed: {e}. Falling back to Ollama.")

    response = await _fallback.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content
