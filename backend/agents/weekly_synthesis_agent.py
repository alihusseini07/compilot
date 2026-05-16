"""
WeeklySynthesisAgent — reads the last 7 DailyReport rows and synthesizes a weekly report.
If fewer than 7 daily reports exist, raises InsufficientDataError instead of running scrapers.
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


class InsufficientDataError(Exception):
    pass


def _week_start():
    today = datetime.now(timezone.utc).date()
    return today - timedelta(days=today.weekday())


class WeeklySynthesisAgent:
    async def run(self, company: str) -> dict:
        daily_reports = await self._load_recent_daily(company)
        have = len(daily_reports)
        if have < DAILY_THRESHOLD:
            raise InsufficientDataError(
                f"Need {DAILY_THRESHOLD} daily reports to generate a weekly report, "
                f"but only {have} exist for '{company}'. Run Daily first."
            )

        logger.info(f"[weekly-synthesis] start company={company} dailies={have}")
        report_text = await self._invoke_llm(company, daily_reports)

        async with async_session() as session:
            row = WeeklyReport(
                company=company,
                week_start=_week_start(),
                report_text=report_text,
                fallback_used=False,
            )
            session.add(row)
            await session.commit()
            await session.refresh(row)

        logger.info(f"[weekly-synthesis] wrote weekly report id={row.id} for {company}")
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

    async def _invoke_llm(self, company: str, daily_reports: list[dict]) -> str:
        prompt = (
            "You are a senior competitive intelligence analyst. "
            f"Here are the daily intelligence reports for {company} over the past week: "
            f"{json.dumps(daily_reports, default=str)}. "
            "What are the dominant themes? What trends are building? "
            "What should we watch next week? "
            "Write a weekly synthesis report in plain text, 6-10 sentences."
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
            return await loop.run_in_executor(None, _call)
        except Exception as e:
            logger.exception("[weekly-synthesis] LLM call failed")
            return f"Weekly synthesis failed: {e}"
