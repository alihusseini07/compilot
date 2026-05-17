"""
Orchestrator — single entry point for all analysis runs.

Modes:
  daily   — run 3 scrapers in parallel, then DailySynthesisAgent across their conclusions.
  weekly  — invoke WeeklySynthesisAgent (handles its own normal/fallback logic).
  monthly — invoke MonthlySynthesisAgent (handles its own normal/fallback logic).

Scraper failures are isolated: one raising does not abort the daily synthesis.
"""

import asyncio
import logging

from agents.daily_synthesis_agent import DailySynthesisAgent
from agents.jobs_agent import JobsAgent
from agents.monthly_synthesis_agent import MonthlySynthesisAgent
from agents.research_agent import ResearchAgent
from agents.tech_agent import TechAgent
from agents.weekly_synthesis_agent import WeeklySynthesisAgent

logger = logging.getLogger(__name__)


def _normalize(result, agent_name: str, date_range: str) -> dict:
    if isinstance(result, BaseException):
        logger.error(f"[orchestrator] {agent_name} raised: {result}")
        return {
            "agent": agent_name,
            "signal_count": 0,
            "conclusion": "",
            "confidence": "none",
            "date_range": date_range,
            "error": str(result),
        }
    return result


async def run(company: str, mode: str = "daily", date: str = None) -> dict:
    logger.info(f"[orchestrator] start company={company} mode={mode} date={date}")

    if mode == "daily":
        date_range = f"date:{date}" if date else "last_day"
        jobs, research, tech = await asyncio.gather(
            JobsAgent().run(company, date_range),
            ResearchAgent().run(company, date_range),
            TechAgent().run(company, date_range),
            return_exceptions=True,
        )
        conclusions = [
            _normalize(jobs, "jobs", date_range),
            _normalize(research, "research", date_range),
            _normalize(tech, "tech", date_range),
        ]
        from datetime import date as date_type
        report_date = date_type.fromisoformat(date) if date else None
        report = await DailySynthesisAgent().run(company, conclusions, report_date=report_date)
        logger.info(f"[orchestrator] done company={company} mode=daily")
        return {"mode": "daily", "report": report, "conclusions": conclusions}

    if mode == "weekly":
        report = await WeeklySynthesisAgent().run(company)
        logger.info(f"[orchestrator] done company={company} mode=weekly")
        return {"mode": "weekly", "report": report}

    if mode == "monthly":
        report = await MonthlySynthesisAgent().run(company)
        logger.info(f"[orchestrator] done company={company} mode=monthly")
        return {"mode": "monthly", "report": report}

    raise ValueError(f"unknown mode: {mode}")
