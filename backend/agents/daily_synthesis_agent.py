"""
DailySynthesisAgent — reasons across the 3 scraper conclusion objects produced
by JobsAgent, ResearchAgent, TechAgent for a single day, then writes a row to
the `daily_reports` table.
"""

import asyncio
import functools
import json
import logging
import os
from datetime import datetime, timezone

from db.models import DailyReport, async_session
from llm import client as ollama_client

logger = logging.getLogger(__name__)

MODEL = os.getenv("OLLAMA_MODEL", "gemma4:e4b")

SYSTEM_PROMPT = (
    "You are a senior competitive intelligence analyst. "
    "Always be specific and evidence-based. Never speculate without data."
)


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


class DailySynthesisAgent:
    async def run(self, company: str, conclusions: list[dict]) -> dict:
        logger.info(f"[daily-synthesis] start company={company} conclusions={len(conclusions)}")
        report_text, key_insights = await self._call_llm(company, conclusions)

        async with async_session() as session:
            row = DailyReport(
                company=company,
                report_date=datetime.now(timezone.utc).date(),
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
            f"{company} for today. Here are their conclusions: {json.dumps(conclusions, default=str)}. "
            "Reason across all three signals together. What is the most important "
            "strategic insight from today? What patterns emerge that no single "
            "source reveals alone? "
            "Respond with a JSON object exactly matching this schema: "
            '{"report_text": "<concise daily intelligence report, 4-8 sentences>", '
            '"key_insights": ["<insight1>", "<insight2>", ...]}. '
            "Return no markdown, no prose outside the JSON object."
        )

        def _call():
            response = ollama_client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
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

        try:
            parsed = json.loads(raw)
            text = str(parsed.get("report_text", "")).strip()
            insights = parsed.get("key_insights", [])
            if not isinstance(insights, list):
                insights = []
            return text or raw, [str(i) for i in insights][:10]
        except json.JSONDecodeError:
            logger.warning(f"[daily-synthesis] non-JSON response, using raw text: {raw[:200]}")
            return raw, []
