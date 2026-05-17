"""
Celery task definitions for the new orchestrator-based pipeline.

`analyze_company_task` is the single canonical task. Old task names
(`run_all_scrapers_task`, `run_synthesis_task`) are kept as shims pointing at
`analyze_company_task(company, "daily")` so the existing
`/api/run-scrape` and `/api/synthesize` endpoints continue to work.
"""

import asyncio
import logging
import os

from celery import Celery
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

_redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
if _redis_url.startswith("rediss://") and "ssl_cert_reqs" not in _redis_url:
    _redis_url += ("&" if "?" in _redis_url else "?") + "ssl_cert_reqs=CERT_NONE"

celery_app = Celery(
    "compilot",
    broker=_redis_url,
    backend=_redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_soft_time_limit=1500,
    task_time_limit=1800,
)


@celery_app.task(name="tasks.analyze_company")
def analyze_company_task(company: str, mode: str = "daily", date: str = None):
    from agents.orchestrator import run as orchestrator_run

    async def _run():
        result = await orchestrator_run(company, mode, date=date)
        return {"company": company, "mode": mode, "result": _summary(result)}

    return asyncio.run(_run())


def _summary(result: dict) -> dict:
    """Trim orchestrator result to JSON-serializable summary for Celery backend."""
    report = result.get("report") or {}
    return {
        "mode": result.get("mode"),
        "report_id": report.get("id"),
        "conclusions_count": len(result.get("conclusions") or []),
    }


@celery_app.task(name="tasks.run_all_scrapers")
def run_all_scrapers_task(company: str):
    """Compat shim — frontend POST /api/run-scrape still calls this."""
    return analyze_company_task(company, "daily")


@celery_app.task(name="tasks.run_synthesis")
def run_synthesis_task(company: str):
    """Compat shim — frontend POST /api/synthesize still calls this."""
    return analyze_company_task(company, "daily")
