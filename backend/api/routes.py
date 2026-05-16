"""
FastAPI route definitions for the Compilot backend.

New canonical endpoints:
  POST /analyze/{company}?mode=daily|weekly|monthly
  GET  /reports/{company}/daily
  GET  /reports/{company}/weekly
  GET  /reports/{company}/monthly
  GET  /reports/{company}/latest

Legacy endpoints kept for the existing frontend (App.jsx / RadarDashboard):
  POST /api/run-scrape     — re-wired to analyze_company_task(company, "daily")
  POST /api/synthesize     — re-wired to analyze_company_task(company, "daily")
  GET  /api/signals/{co}   — reads `signals` table (now legacy, expected empty)
  GET  /api/inferences/{co}— reads `inferences` table (now legacy, expected empty)
  GET  /api/health
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func

from db.models import (
    DailyReport,
    Inference,
    MonthlyReport,
    Signal,
    WeeklyReport,
    async_session,
)
from tasks import (
    analyze_company_task,
    run_all_scrapers_task,
    run_synthesis_task,
)

router = APIRouter()
legacy = APIRouter(prefix="/api")


class CompanyRequest(BaseModel):
    company: str
    lookback_days: int = 7


# ── New canonical endpoints ──────────────────────────────────────────────────


@router.post("/analyze/{company}")
async def analyze(company: str, mode: str = Query("daily", pattern="^(daily|weekly|monthly)$")):
    """Trigger orchestrator. Returns Celery job_id; the actual work runs in the worker.
    For weekly/monthly, checks upfront whether enough upstream reports exist."""
    from agents.weekly_synthesis_agent import DAILY_THRESHOLD
    from agents.monthly_synthesis_agent import WEEKLY_THRESHOLD

    if mode == "weekly":
        async with async_session() as session:
            count = (await session.execute(
                select(func.count()).select_from(DailyReport)
                .where(DailyReport.company == company)
            )).scalar_one()
        if count < DAILY_THRESHOLD:
            raise HTTPException(
                status_code=422,
                detail=f"Need {DAILY_THRESHOLD} daily reports to generate a weekly report, "
                       f"but only {count} exist for '{company}'. Run Daily first."
            )

    if mode == "monthly":
        async with async_session() as session:
            count = (await session.execute(
                select(func.count()).select_from(WeeklyReport)
                .where(WeeklyReport.company == company)
            )).scalar_one()
        if count < WEEKLY_THRESHOLD:
            raise HTTPException(
                status_code=422,
                detail=f"Need {WEEKLY_THRESHOLD} weekly reports to generate a monthly report, "
                       f"but only {count} exist for '{company}'. Run Weekly first."
            )

    task = analyze_company_task.delay(company, mode)
    return {"job_id": task.id, "company": company, "mode": mode, "status": "queued"}


@router.get("/reports/{company}/daily")
async def get_daily_reports(company: str, limit: int = Query(30, ge=1, le=365)):
    async with async_session() as session:
        stmt = (
            select(DailyReport)
            .where(DailyReport.company == company)
            .order_by(DailyReport.report_date.desc(), DailyReport.id.desc())
            .limit(limit)
        )
        rows = (await session.execute(stmt)).scalars().all()
    return {"company": company, "reports": [r.to_dict() for r in rows]}


@router.get("/reports/{company}/weekly")
async def get_weekly_reports(company: str, limit: int = Query(12, ge=1, le=104)):
    async with async_session() as session:
        stmt = (
            select(WeeklyReport)
            .where(WeeklyReport.company == company)
            .order_by(WeeklyReport.week_start.desc(), WeeklyReport.id.desc())
            .limit(limit)
        )
        rows = (await session.execute(stmt)).scalars().all()
    return {"company": company, "reports": [r.to_dict() for r in rows]}


@router.get("/reports/{company}/monthly")
async def get_monthly_reports(company: str, limit: int = Query(12, ge=1, le=60)):
    async with async_session() as session:
        stmt = (
            select(MonthlyReport)
            .where(MonthlyReport.company == company)
            .order_by(MonthlyReport.month_start.desc(), MonthlyReport.id.desc())
            .limit(limit)
        )
        rows = (await session.execute(stmt)).scalars().all()
    return {"company": company, "reports": [r.to_dict() for r in rows]}


@router.get("/reports/{company}/latest")
async def get_latest_reports(company: str):
    async with async_session() as session:
        daily = (await session.execute(
            select(DailyReport)
            .where(DailyReport.company == company)
            .order_by(DailyReport.report_date.desc(), DailyReport.id.desc())
            .limit(1)
        )).scalar_one_or_none()
        weekly = (await session.execute(
            select(WeeklyReport)
            .where(WeeklyReport.company == company)
            .order_by(WeeklyReport.week_start.desc(), WeeklyReport.id.desc())
            .limit(1)
        )).scalar_one_or_none()
        monthly = (await session.execute(
            select(MonthlyReport)
            .where(MonthlyReport.company == company)
            .order_by(MonthlyReport.month_start.desc(), MonthlyReport.id.desc())
            .limit(1)
        )).scalar_one_or_none()
    return {
        "company": company,
        "daily": daily.to_dict() if daily else None,
        "weekly": weekly.to_dict() if weekly else None,
        "monthly": monthly.to_dict() if monthly else None,
    }


# ── Legacy compatibility endpoints (kept for current frontend) ───────────────


@legacy.post("/run-scrape")
async def legacy_run_scrape(req: CompanyRequest):
    task = run_all_scrapers_task.delay(req.company)
    return {"status": "queued", "task_id": task.id, "company": req.company}


@legacy.post("/synthesize")
async def legacy_synthesize(req: CompanyRequest):
    task = run_synthesis_task.delay(req.company)
    return {"status": "queued", "task_id": task.id, "company": req.company}


@legacy.get("/signals/{company}")
async def legacy_signals(company: str, limit: int = 100):
    async with async_session() as session:
        stmt = (
            select(Signal)
            .where(Signal.company == company)
            .order_by(Signal.scraped_at.desc())
            .limit(limit)
        )
        rows = (await session.execute(stmt)).scalars().all()
    return {"company": company, "signals": [r.to_dict() for r in rows]}


@legacy.get("/inferences/{company}")
async def legacy_inferences(company: str, limit: int = 50):
    async with async_session() as session:
        stmt = (
            select(Inference)
            .where(Inference.company == company)
            .order_by(Inference.synthesized_at.desc())
            .limit(limit)
        )
        rows = (await session.execute(stmt)).scalars().all()
    return {"company": company, "inferences": [r.to_dict() for r in rows]}


@legacy.get("/health")
async def health():
    return {"status": "ok"}
