"""
PatentsAgent — queries Lens.org for patent filings by the target company.

Lens.org is a free, open patent database covering USPTO, EPO, and WIPO.
Requires: LENS_API_TOKEN env var.
Free token: https://lens.org/lens/user/subscriptions (email only, no card)

Rate limit: varies by plan. Free tier is sufficient for this use case.
"""

import logging
import os

import httpx

from agents import BaseAgent

logger = logging.getLogger(__name__)

LENS_API_URL = "https://api.lens.org/patent/search"


class PatentsAgent(BaseAgent):
    source_type = "patents"

    async def _fetch(self, company: str) -> list[dict]:
        token = os.getenv("LENS_API_TOKEN", "")
        if not token:
            logger.warning("[patents] LENS_API_TOKEN not set — skipping patents scrape. "
                           "Get a free token at https://lens.org/lens/user/subscriptions")
            return []

        payload = {
            "query": {
                "bool": {
                    "must": [
                        {"match": {"assignee": company}}
                    ]
                }
            },
            "size": 25,
            "sort": [{"date_published": "desc"}],
            "include": [
                "lens_id",
                "title",
                "abstract",
                "date_published",
                "assignee",
                "class_cpc",
                "application_reference",
            ],
        }

        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post(
                    LENS_API_URL,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPError as e:
            logger.error(f"[patents] Lens.org API failed for '{company}': {e}")
            return []

        patents = data.get("data") or []
        signals = []

        for patent in patents:
            lens_id = patent.get("lens_id", "")
            if not lens_id:
                continue

            title = patent.get("title", "")
            abstract = (patent.get("abstract") or "")[:500]
            filing_date = patent.get("date_published", "")
            assignees = patent.get("assignee") or []
            cpc_entries = patent.get("class_cpc") or []
            cpc_codes = [c.get("symbol", "") for c in cpc_entries if c.get("symbol")]

            signals.append({
                "source_id": f"patent:{lens_id}",
                "content": (
                    f"Patent '{title}'. "
                    f"Filed: {filing_date}. "
                    f"Assignee: {', '.join(assignees[:2]) or company}. "
                    f"CPC: {', '.join(cpc_codes[:4]) or 'n/a'}."
                ),
                "metadata": {
                    "lens_id": lens_id,
                    "title": title,
                    "abstract": abstract,
                    "filing_date": filing_date,
                    "assignees": assignees,
                    "cpc_codes": cpc_codes,
                    "url": f"https://lens.org/lens/patent/{lens_id}",
                },
            })

        logger.info(f"[patents] Found {len(signals)} patents for '{company}'")
        return signals
