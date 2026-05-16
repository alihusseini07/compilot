"""
MonthlySynthesisAgent — reads the last 4 WeeklyReport rows and synthesizes a monthly report.
If fewer than 4 weekly reports exist, raises InsufficientDataError instead of running scrapers.
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone

from sqlalchemy import select

from db.models import MonthlyReport, WeeklyReport, async_session
from llm import client as ollama_client

logger = logging.getLogger(__name__)

MODEL = os.getenv("INFERENCE_MODEL", "DeepSeek-V3.2-NVFP4")
WEEKLY_THRESHOLD = 4

SYSTEM_PROMPT = (
    "You are a senior competitive intelligence analyst. "
    "Always be specific and evidence-based. Never speculate without data."
)


class InsufficientDataError(Exception):
    pass


def _month_start():
    today = datetime.now(timezone.utc).date()
    return today.replace(day=1)


class MonthlySynthesisAgent:
    async def run(self, company: str) -> dict:
        weekly_reports = await self._load_recent_weekly(company)
        have = len(weekly_reports)
        if have < WEEKLY_THRESHOLD:
            raise InsufficientDataError(
                f"Need {WEEKLY_THRESHOLD} weekly reports to generate a monthly report, "
                f"but only {have} exist for '{company}'. Run Weekly first."
            )

        logger.info(f"[monthly-synthesis] start company={company} weeklies={have}")
        report_text = await self._invoke_llm(company, weekly_reports)

        async with async_session() as session:
            row = MonthlyReport(
                company=company,
                month_start=_month_start(),
                report_text=report_text,
                fallback_used=False,
            )
            session.add(row)
            await session.commit()
            await session.refresh(row)

        logger.info(f"[monthly-synthesis] wrote monthly report id={row.id} for {company}")
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

    async def _invoke_llm(self, company: str, weekly_reports: list[dict]) -> str:
        prompt = (
            "You are a senior competitive intelligence analyst. "
            f"Here are four weeks of intelligence reports for {company}: "
            f"{json.dumps(weekly_reports, default=str)}. "
            "What strategic shifts occurred this month? "
            "What is this company's likely direction over the next quarter? "
            "Write an executive-level monthly intelligence report in plain text, 8-12 sentences."
        )

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
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(None, _call)
        except Exception as e:
            logger.exception("[monthly-synthesis] LLM call failed")
            return f"Monthly synthesis failed: {e}"
