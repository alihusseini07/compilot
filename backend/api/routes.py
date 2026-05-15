"""
FastAPI route definitions for the Compilot backend.

Endpoints:
  POST /api/run-scrape     — trigger all 5 scrapers for a company (via Celery)
  POST /api/synthesize     — trigger synthesis agent for a company (via Celery)
  GET  /api/signals/{co}  — list signals for a company
  GET  /api/inferences/{co} — list inferences for a company
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from db.models import Inference, Signal, async_session
from tasks import run_all_scrapers_task, run_synthesis_task

router = APIRouter(prefix="/api")


class CompanyRequest(BaseModel):
    company: str
    lookback_days: int = 7


@router.post("/run-scrape")
async def run_scrape(req: CompanyRequest):
    """Kick off all scraper agents as a Celery task group."""
    task = run_all_scrapers_task.delay(req.company)
    return {"status": "queued", "task_id": task.id, "company": req.company}


@router.post("/synthesize")
async def synthesize(req: CompanyRequest):
    """Kick off the synthesis agent as a Celery task."""
    task = run_synthesis_task.delay(req.company)
    return {"status": "queued", "task_id": task.id, "company": req.company}


@router.get("/signals/{company}")
async def get_signals(company: str, limit: int = 100):
    async with async_session() as session:
        stmt = (
            select(Signal)
            .where(Signal.company == company)
            .order_by(Signal.scraped_at.desc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        rows = result.scalars().all()
    return {"company": company, "signals": [r.to_dict() for r in rows]}


@router.get("/inferences/{company}")
async def get_inferences(company: str, limit: int = 50):
    async with async_session() as session:
        stmt = (
            select(Inference)
            .where(Inference.company == company)
            .order_by(Inference.synthesized_at.desc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        rows = result.scalars().all()
    return {"company": company, "inferences": [r.to_dict() for r in rows]}


@router.get("/health")
async def health():
    return {"status": "ok"}
