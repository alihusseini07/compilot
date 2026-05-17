"""
DailySynthesisAgent — reasons across the 3 scraper conclusion objects produced
by JobsAgent, ResearchAgent, TechAgent for a single day, then writes a row to
the `daily_reports` table.
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone

from db.models import DailyReport, async_session
from llm import client as ollama_client

logger = logging.getLogger(__name__)

MODEL = os.getenv("INFERENCE_MODEL", "DeepSeek-V3.2-NVFP4")

SYSTEM_PROMPT = (
    "You are a senior competitive intelligence analyst. "
    "Always be specific and evidence-based. Never speculate without data."
)

_SEPARATOR = "KEY INSIGHTS:"


def _overall_confidence(conclusions: list[dict]) -> str:
    ranks = {"high": 3, "medium": 2, "low": 1, "none": 0}
    successful = [c for c in conclusions if not c.get("error")]
    if not successful:
        return "none"
    avg = sum(ranks.get(c.get("confidence", "none"), 0) for c in successful) / len(successful)
    if avg >= 2.5:
        return "high"
    if avg >= 1.5:
        return "medium"
    if avg >= 0.5:
        return "low"
    return "none"


def _parse_response(raw: str) -> tuple[str, list[str]]:
    """Split on KEY INSIGHTS: separator. Everything before is report_text,
    bullet lines after become key_insights."""
    if _SEPARATOR in raw:
        report_part, insights_part = raw.split(_SEPARATOR, 1)
        insights = []
        for line in insights_part.splitlines():
            line = line.strip().lstrip("-•*123456789. ").strip()
            if line:
                insights.append(line)
        return report_part.strip(), insights[:8]
    return raw.strip(), []


class DailySynthesisAgent:
    async def run(self, company: str, conclusions: list[dict], report_date=None) -> dict:
        logger.info(f"[daily-synthesis] start company={company} conclusions={len(conclusions)}")
        report_text, key_insights = await self._call_llm(company, conclusions)

        if report_date is None:
            report_date = datetime.now(timezone.utc).date()

        async with async_session() as session:
            row = DailyReport(
                company=company,
                report_date=report_date,
                report_text=report_text,
                key_insights=key_insights,
                overall_confidence=_overall_confidence(conclusions),
            )
            session.add(row)
            await session.commit()
            await session.refresh(row)

        logger.info(f"[daily-synthesis] wrote daily report id={row.id} for {company}")
        return row.to_dict()

    async def _call_llm(self, company: str, conclusions: list[dict]) -> tuple[str, list[str]]:
        prompt = (
            "You are a senior competitive intelligence analyst. "
            "Three specialized agents have analyzed different data sources about "
            f"{company} for today. Here are their conclusions:\n"
            f"{json.dumps(conclusions, default=str, indent=2)}\n\n"
            "Reason across all three signals together. What is the most important "
            "strategic insight from today? What patterns emerge that no single "
            "source reveals alone?\n\n"
            "Write your response in exactly this format — plain text, no JSON, no markdown:\n\n"
            "First write a 4-8 sentence intelligence report as flowing prose.\n\n"
            f"Then write exactly '{_SEPARATOR}' on its own line.\n\n"
            "Then list 3-5 key insights as bullet points, one per line, starting each with '- '."
        )

        def _call():
            response = ollama_client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                max_tokens=2048,
                timeout=480,
            )
            return (response.choices[0].message.content or "").strip()

        try:
            loop = asyncio.get_running_loop()
            raw = await loop.run_in_executor(None, _call)
        except Exception as e:
            logger.exception("[daily-synthesis] LLM call failed")
            return (f"Daily synthesis failed: {e}", [])

        return _parse_response(raw)
