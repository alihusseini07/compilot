"""
Celery task definitions. Wraps async agent code in sync Celery tasks using asyncio.run().
"""

import asyncio
import os

from celery import Celery
from dotenv import load_dotenv

load_dotenv()

_redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
# Managed Redis with SSL requires ssl_cert_reqs param
if _redis_url.startswith("rediss://") and "ssl_cert_reqs" not in _redis_url:
    _redis_url += ("&" if "?" in _redis_url else "?") + "ssl_cert_reqs=CERT_NONE"

celery_app = Celery(
    "compilot",
    broker=_redis_url,
    backend=_redis_url,
)

celery_app.conf.update(task_serializer="json", result_serializer="json", accept_content=["json"])


@celery_app.task(name="tasks.run_all_scrapers")
def run_all_scrapers_task(company: str):
    from agents.github_agent import GitHubAgent
    from agents.news_agent import NewsAgent
    from agents.jobs_agent import JobsAgent
    from agents.patents_agent import PatentsAgent
    from agents.pricing_agent import PricingAgent

    async def _run():
        agents = [GitHubAgent(), NewsAgent(), JobsAgent(), PatentsAgent(), PricingAgent()]
        results = await asyncio.gather(*[a.run(company) for a in agents], return_exceptions=True)
        total = sum(len(r) for r in results if isinstance(r, list))
        return {"company": company, "signals_written": total}

    return asyncio.run(_run())


@celery_app.task(name="tasks.run_synthesis")
def run_synthesis_task(company: str):
    from agents.synthesis_agent import SynthesisAgent

    async def _run():
        agent = SynthesisAgent()
        inferences = await agent.run(company)
        return {"company": company, "inferences_written": len(inferences)}

    return asyncio.run(_run())
