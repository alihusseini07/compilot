"""
BaseAgent — shared lifecycle for all scraper agents (jobs, research, tech).

Each scraper:
  1. Implements `_fetch(company, date_range)` to pull raw data from its sources.
  2. Implements `_build_prompt(company, data)` to render the LLM prompt.
  3. Calls `self.reason(data, prompt)` from inside `run()` to get a conclusion object.

The conclusion object schema is identical for every scraper so the synthesis tiers
can consume them uniformly.
"""

import logging
import os
from abc import ABC, abstractmethod

from llm import client as ollama_client

logger = logging.getLogger(__name__)

MODEL = os.getenv("OLLAMA_MODEL", "gemma4:e4b")

SYSTEM_PROMPT = (
    "You are a competitive intelligence analyst. "
    "Always be specific and evidence-based. Never speculate without data."
)


def _confidence_bucket(signal_count: int) -> str:
    if signal_count >= 10:
        return "high"
    if signal_count >= 3:
        return "medium"
    if signal_count >= 1:
        return "low"
    return "none"


class BaseAgent(ABC):
    """Contract for all scraper agents in the new pipeline."""

    agent_name: str  # "jobs" | "research" | "tech" — must be set by subclass

    @abstractmethod
    async def _fetch(self, company: str, date_range: str) -> list[dict]:
        """Pull raw data points from the agent's sources for the given window."""
        ...

    @abstractmethod
    def _build_prompt(self, company: str, data: list[dict]) -> str:
        """Render the per-agent LLM prompt around the collected data."""
        ...

    async def run(self, company: str, date_range: str = "last_day") -> dict:
        """Top-level entry: fetch raw data, reason over it, return a conclusion object."""
        logger.info(f"[{self.agent_name}] start company={company} range={date_range}")
        try:
            data = await self._fetch(company, date_range)
        except Exception as exc:
            logger.exception(f"[{self.agent_name}] fetch failed for {company}")
            return self._error_conclusion(date_range, str(exc), signal_count=0)

        prompt = self._build_prompt(company, data)
        conclusion = self.reason(data, prompt, date_range)
        logger.info(
            f"[{self.agent_name}] done company={company} "
            f"signals={conclusion['signal_count']} confidence={conclusion['confidence']}"
        )
        return conclusion

    def reason(self, data: list[dict], prompt: str, date_range: str) -> dict:
        """Call Ollama with the prompt and wrap the response in a conclusion object."""
        signal_count = len(data)
        confidence = _confidence_bucket(signal_count)

        if signal_count == 0:
            return {
                "agent": self.agent_name,
                "signal_count": 0,
                "conclusion": "No signals collected in this window.",
                "confidence": "none",
                "date_range": date_range,
                "error": None,
            }

        try:
            response = ollama_client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                timeout=480,
            )
            text = (response.choices[0].message.content or "").strip()
        except Exception as exc:
            logger.exception(f"[{self.agent_name}] LLM call failed")
            return self._error_conclusion(date_range, str(exc), signal_count=signal_count)

        return {
            "agent": self.agent_name,
            "signal_count": signal_count,
            "conclusion": text,
            "confidence": confidence,
            "date_range": date_range,
            "error": None,
        }

    def _error_conclusion(self, date_range: str, error: str, signal_count: int) -> dict:
        return {
            "agent": self.agent_name,
            "signal_count": signal_count,
            "conclusion": "",
            "confidence": _confidence_bucket(signal_count) if signal_count else "none",
            "date_range": date_range,
            "error": error,
        }
