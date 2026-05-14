"""
JobsAgent — scrapes public job postings to detect hiring signal patterns.

Sources:
  - Greenhouse public job board API (no auth required for public boards)

Hiring signal logic:
  - ML/AI roles → AI product development
  - Enterprise sales roles → GTM shift upmarket
  - Security/compliance roles → enterprise readiness
  - Infrastructure/platform roles → scaling phase
"""

import hashlib
import logging
import re

import httpx

from agents import BaseAgent

logger = logging.getLogger(__name__)

AI_KEYWORDS = {"pytorch", "tensorflow", "llm", "rag", "vector", "embedding", "openai", "langchain", "ml", "machine learning"}
ENTERPRISE_KEYWORDS = {"enterprise", "fortune 500", "soc 2", "saml", "sso", "compliance", "audit"}
INFRA_KEYWORDS = {"kubernetes", "k8s", "terraform", "platform engineering", "sre", "reliability"}


def _classify_keywords(description: str) -> list[str]:
    desc_lower = description.lower()
    found = []
    for kw in AI_KEYWORDS | ENTERPRISE_KEYWORDS | INFRA_KEYWORDS:
        if kw in desc_lower:
            found.append(kw)
    return found[:10]  # cap at 10 for metadata


class JobsAgent(BaseAgent):
    source_type = "jobs"

    async def _fetch(self, company: str) -> list[dict]:
        """Try Greenhouse public board for the company slug."""
        signals = []
        async with httpx.AsyncClient(timeout=15) as client:
            try:
                resp = await client.get(
                    f"https://boards-api.greenhouse.io/v1/boards/{company}/jobs",
                    params={"content": "true"},
                )
                resp.raise_for_status()
                jobs = resp.json().get("jobs", [])
            except httpx.HTTPError as e:
                logger.warning(f"[jobs] Greenhouse fetch failed for '{company}': {e}")
                return []

            for job in jobs:
                job_id = str(job["id"])
                title = job.get("title", "")
                dept = next((d["name"] for d in job.get("departments", [])), "Unknown")
                location = next((l["name"] for l in job.get("offices", [])), "Remote")
                content_html = job.get("content", "")
                # Strip HTML tags for keyword extraction
                content_text = re.sub(r"<[^>]+>", " ", content_html)
                keywords = _classify_keywords(content_text)

                source_id = f"job:{job_id}"
                content_summary = (
                    f"Job posting: {title} ({dept}) at {company}. "
                    f"Location: {location}. "
                    f"Signal keywords: {', '.join(keywords) if keywords else 'none'}."
                )
                signals.append({
                    "source_id": source_id,
                    "content": content_summary,
                    "metadata": {
                        "job_id": job_id,
                        "title": title,
                        "department": dept,
                        "location": location,
                        "keywords": keywords,
                        "url": job.get("absolute_url", ""),
                        "updated_at": job.get("updated_at", ""),
                    },
                })

        return signals
