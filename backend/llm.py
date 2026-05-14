"""
Single entry point for all Claude API calls in Compint.

Rules:
  - Never instantiate anthropic.Anthropic() outside this file.
  - All agent inference calls go through call_claude().
  - Uses prompt caching on the system prompt to reduce token costs on repeated synthesis runs.
"""

import os

import anthropic
from dotenv import load_dotenv

load_dotenv()

_client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


async def call_claude(
    system: str,
    user: str,
    model: str = "claude-sonnet-4-20250514",
    max_tokens: int = 4096,
) -> str:
    """
    Call Claude and return the response text.

    Uses prompt caching on the system prompt — the system prompt is large and
    stable across synthesis runs for the same company, so caching saves ~90% of
    system prompt token cost after the first call.
    """
    response = _client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=[
            {
                "type": "text",
                "text": system,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user}],
    )
    return response.content[0].text
