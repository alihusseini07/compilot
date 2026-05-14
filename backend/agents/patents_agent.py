"""
PatentsAgent — queries the PatentsView API for patent filings by the target company.

API docs: https://patentsview.org/apis/api-endpoints/patents
No auth required. Rate limit: 45 req/min.

CPC codes that signal AI/ML work: G06N (computing using AI), G06F40 (NLP)
"""

import logging

import httpx

from agents import BaseAgent

logger = logging.getLogger(__name__)

PATENTSVIEW_API = "https://api.patentsview.org/patents/query"


class PatentsAgent(BaseAgent):
    source_type = "patents"

    async def _fetch(self, company: str) -> list[dict]:
        signals = []
        payload = {
            "q": {"_text_phrase": {"assignee_organization": company}},
            "f": ["patent_number", "patent_title", "patent_abstract", "patent_date", "cpc_subgroup_id"],
            "o": {"per_page": 25, "sort": [{"patent_date": "desc"}]},
        }

        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post(PATENTSVIEW_API, json=payload)
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPError as e:
            logger.error(f"[patents] PatentsView API failed for '{company}': {e}")
            return []

        for patent in data.get("patents") or []:
            patent_id = patent.get("patent_number", "")
            title = patent.get("patent_title", "")
            abstract = (patent.get("patent_abstract") or "")[:500]
            filing_date = patent.get("patent_date", "")
            cpc_codes = [c["cpc_subgroup_id"] for c in patent.get("cpcs", []) if c.get("cpc_subgroup_id")]

            source_id = f"patent:{patent_id}"
            signals.append({
                "source_id": source_id,
                "content": f"Patent {patent_id}: '{title}'. Filed: {filing_date}. CPC: {', '.join(cpc_codes[:5])}.",
                "metadata": {
                    "patent_id": patent_id,
                    "title": title,
                    "abstract": abstract,
                    "filing_date": filing_date,
                    "cpc_codes": cpc_codes,
                    "url": f"https://patents.google.com/patent/US{patent_id}",
                },
            })

        return signals
