"""
WeeklySynthesisAgent — produces a weekly intelligence report.

Normal mode:  loads the last 7 DailyReport rows for the company and reasons across them.
Fallback:     if fewer than 7 daily reports exist, runs the 3 scraper agents directly
              with date_range="last_7_days" and synthesizes from their conclusions.
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from db.models import DailyReport, WeeklyReport, async_session
from llm import client as ollama_client

logger = logging.getLogger(__name__)

MODEL = os.getenv("OLLAMA_MODEL", "gemma4:e4b")
DAILY_THRESHOLD = 7

SYSTEM_PROMPT = (
    "You are a senior competitive intelligence analyst. "
    "Always be specific and evidence-based. Never speculate without data."
)


def _week_start() -> datetime:
    today = datetime.now(timezone.utc).date()
    return today - timedelta(days=today.weekday())


class WeeklySynthesisAgent:
    async def run(self, company: str) -> dict:
        daily_reports = await self._load_recent_daily(company)
        if len(daily_reports) >= DAILY_THRESHOLD:
            logger.info(f"[weekly-synthesis] normal mode for {company} ({len(daily_reports)} dailies)")
            report_text = self._call_llm_normal(company, daily_reports)
            fallback_used = False
        else:
            logger.info(
                f"[weekly-synthesis] FALLBACK MODE for {company} "
                f"(only {len(daily_reports)} daily reports, need {DAILY_THRESHOLD})"
            )
            conclusions = await self._direct_scrape(company, "last_7_days")
            report_text = self._call_llm_fallback(company, conclusions)
            fallback_used = True

        async with async_session() as session:
            row = WeeklyReport(
                company=company,
                week_start=_week_start(),
                report_text=report_text,
                fallback_used=fallback_used,
            )
            session.add(row)
            await session.commit()
            await session.refresh(row)

        logger.info(
            f"[weekly-synthesis] wrote weekly report id={row.id} fallback={fallback_used} for {company}"
        )
        return row.to_dict()

    async def _load_recent_daily(self, company: str) -> list[dict]:
        async with async_session() as session:
            stmt = (
                select(DailyReport)
                .where(DailyReport.company == company)
                .order_by(DailyReport.report_date.desc())
                .limit(DAILY_THRESHOLD)
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

    def _call_llm_normal(self, company: str, daily_reports: list[dict]) -> str:
        prompt = (
            "You are a senior competitive intelligence analyst. "
            f"Here are the daily intelligence reports for {company} over the past week: "
            f"{json.dumps(daily_reports, default=str)}. "
            "What are the dominant themes? What trends are building? What should we watch "
            "next week? Write a weekly synthesis report in plain text, 6-10 sentences."
        )
        return self._invoke(prompt, "weekly-normal")

    def _call_llm_fallback(self, company: str, conclusions: list[dict]) -> str:
        prompt = (
            "You are a senior competitive intelligence analyst. "
            "Due to limited daily data, here are direct signals collected over the past "
            f"7 days for {company}: {json.dumps(conclusions, default=str)}. "
            "Synthesize these into a weekly intelligence report covering dominant themes "
            "and emerging trends. Plain text, 6-10 sentences."
        )
        return self._invoke(prompt, "weekly-fallback")

    def _invoke(self, prompt: str, tag: str) -> str:
        try:
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
        except Exception as e:
            logger.exception(f"[{tag}] LLM call failed")
            return f"Weekly synthesis failed: {e}"
