"""
MonthlySynthesisAgent — executive-level monthly intelligence report.

Normal mode:  loads the last 4 WeeklyReport rows and reasons across them.
Fallback:     if fewer than 4 weekly reports exist, runs the 3 scraper agents with
              date_range="last_30_days" and synthesizes from their conclusions.
"""

import asyncio
import functools
import json
import logging
import os
from datetime import datetime, timezone

from sqlalchemy import select

from db.models import MonthlyReport, WeeklyReport, async_session
from llm import client as ollama_client

logger = logging.getLogger(__name__)

MODEL = os.getenv("OLLAMA_MODEL", "gemma4:e4b")
WEEKLY_THRESHOLD = 4

SYSTEM_PROMPT = (
    "You are a senior competitive intelligence analyst. "
    "Always be specific and evidence-based. Never speculate without data."
)


def _month_start():
    today = datetime.now(timezone.utc).date()
    return today.replace(day=1)


class MonthlySynthesisAgent:
    async def run(self, company: str) -> dict:
        weekly_reports = await self._load_recent_weekly(company)
        if len(weekly_reports) >= WEEKLY_THRESHOLD:
            logger.info(f"[monthly-synthesis] normal mode for {company} ({len(weekly_reports)} weeklies)")
            report_text = await self._call_llm_normal(company, weekly_reports)
            fallback_used = False
        else:
            logger.info(
                f"[monthly-synthesis] FALLBACK MODE for {company} "
                f"(only {len(weekly_reports)} weekly reports, need {WEEKLY_THRESHOLD})"
            )
            conclusions = await self._direct_scrape(company, "last_30_days")
            report_text = await self._call_llm_fallback(company, conclusions)
            fallback_used = True

        async with async_session() as session:
            row = MonthlyReport(
                company=company,
                month_start=_month_start(),
                report_text=report_text,
                fallback_used=fallback_used,
            )
            session.add(row)
            await session.commit()
            await session.refresh(row)

        logger.info(
            f"[monthly-synthesis] wrote monthly report id={row.id} fallback={fallback_used} for {company}"
        )
        return row.to_dict()

    async def _load_recent_weekly(self, company: str) -> list[dict]:
        async with async_session() as session:
            stmt = (
                select(WeeklyReport)
                .where(WeeklyReport.company == company)
                .order_by(WeeklyReport.week_start.desc())
                .limit(WEEKLY_THRESHOLD)
            )
            result = await session.execute(stmt)
            rows = result.scalars().all()
        return [r.to_dict() for r in rows]

    async def _direct_scrape(self, company: str, date_range: str) -> list[dict]:
        from agents.jobs_agent import JobsAgent
        from agents.research_agent import ResearchAgent
        from agents.tech_agent import TechAgent

        results = await asyncio.gather(
            JobsAgent().run(company, date_range),
            ResearchAgent().run(company, date_range),
            TechAgent().run(company, date_range),
            return_exceptions=True,
        )

        normalized = []
        for r in results:
            if isinstance(r, BaseException):
                normalized.append({
                    "agent": "unknown",
                    "signal_count": 0,
                    "conclusion": "",
                    "confidence": "none",
                    "date_range": date_range,
                    "error": str(r),
                })
            else:
                normalized.append(r)
        return normalized

    async def _call_llm_normal(self, company: str, weekly_reports: list[dict]) -> str:
        prompt = (
            "You are a senior competitive intelligence analyst. "
            f"Here are four weeks of intelligence reports for {company}: "
            f"{json.dumps(weekly_reports, default=str)}. "
            "What strategic shifts occurred this month? What is this company's likely "
            "direction over the next quarter? Write an executive-level monthly intelligence "
            "report in plain text, 8-12 sentences."
        )
        return self._invoke(prompt, "monthly-normal")

    async def _call_llm_fallback(self, company: str, conclusions: list[dict]) -> str:
        prompt = (
            "You are a senior competitive intelligence analyst. "
            "Due to limited weekly data, here are direct signals collected over the past "
            f"30 days for {company}: {json.dumps(conclusions, default=str)}. "
            "Synthesize these into a monthly intelligence report covering strategic shifts "
            "and forward-looking analysis. Plain text, 8-12 sentences."
        )
        return self._invoke(prompt, "monthly-fallback")

    async def _invoke(self, prompt: str, tag: str) -> str:
        def _call():
            response = ollama_client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                max_tokens=2560,
                timeout=480,
            )
            return (response.choices[0].message.content or "").strip()

        try:
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, _call)
        except Exception as e:
            logger.exception(f"[{tag}] LLM call failed")
            return f"Monthly synthesis failed: {e}"
