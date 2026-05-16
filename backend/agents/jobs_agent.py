"""
JobsAgent — hiring signals from Greenhouse, Lever, Workday, and LinkedIn.

Returns a conclusion object describing what the company's hiring pattern reveals
about strategic priorities. Raw signals are not persisted — only the LLM
conclusion is consumed downstream by the synthesis tiers.
"""

import hashlib
import logging
import re

import httpx
from bs4 import BeautifulSoup

from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

AI_KEYWORDS = {"pytorch", "tensorflow", "llm", "rag", "vector", "embedding", "openai", "langchain", "ml", "machine learning"}
ENTERPRISE_KEYWORDS = {"enterprise", "fortune 500", "soc 2", "saml", "sso", "compliance", "audit"}
INFRA_KEYWORDS = {"kubernetes", "k8s", "terraform", "platform engineering", "sre", "reliability"}


def _classify_keywords(description: str) -> list[str]:
    desc_lower = description.lower()
    found = [kw for kw in AI_KEYWORDS | ENTERPRISE_KEYWORDS | INFRA_KEYWORDS if kw in desc_lower]
    return found[:10]


class JobsAgent(BaseAgent):
    agent_name = "jobs"

    async def _fetch(self, company: str, date_range: str) -> list[dict]:
        data: list[dict] = []
        async with httpx.AsyncClient(
            timeout=15,
            headers={"User-Agent": "Mozilla/5.0 (compatible; CompilotBot/1.0)"},
            follow_redirects=True,
        ) as client:
            data += await self._fetch_greenhouse(client, company)
            data += await self._fetch_lever(client, company)
            data += await self._fetch_workday(client, company)
            data += await self._fetch_linkedin(client, company)

        seen, unique = set(), []
        for d in data:
            if d["job_id"] not in seen:
                seen.add(d["job_id"])
                unique.append(d)
        return unique

    def _build_prompt(self, company: str, data: list[dict]) -> str:
        summarized = [
            {
                "title": d.get("title", ""),
                "department": d.get("department", ""),
                "location": d.get("location", ""),
                "keywords": d.get("keywords", []),
                "platform": d.get("platform", ""),
            }
            for d in data[:60]
        ]
        return (
            "You are a competitive intelligence analyst specializing in hiring signals. "
            f"Here is jobs data for {company}: {summarized}. "
            "What does this hiring pattern suggest about their strategic priorities, "
            "new product areas, or organizational changes? Be specific. "
            "Return a 2-4 sentence conclusion in plain text."
        )

    async def _fetch_greenhouse(self, client: httpx.AsyncClient, company: str) -> list[dict]:
        try:
            resp = await client.get(
                f"https://boards-api.greenhouse.io/v1/boards/{company}/jobs",
                params={"content": "true"},
            )
            resp.raise_for_status()
            jobs = resp.json().get("jobs", [])
        except httpx.HTTPError as e:
            logger.info(f"[jobs] greenhouse miss for {company}: {e}")
            return []

        out = []
        for job in jobs:
            job_id = f"greenhouse:{job['id']}"
            content_text = re.sub(r"<[^>]+>", " ", job.get("content", ""))
            out.append({
                "platform": "greenhouse",
                "job_id": job_id,
                "title": job.get("title", ""),
                "department": next((d["name"] for d in job.get("departments", [])), "Unknown"),
                "location": next((loc["name"] for loc in job.get("offices", [])), "Remote"),
                "keywords": _classify_keywords(content_text),
                "url": job.get("absolute_url", ""),
            })
        logger.info(f"[jobs] greenhouse {len(out)} for {company}")
        return out

    async def _fetch_lever(self, client: httpx.AsyncClient, company: str) -> list[dict]:
        try:
            resp = await client.get(f"https://api.lever.co/v0/postings/{company}?mode=json")
            resp.raise_for_status()
            jobs = resp.json()
            if not isinstance(jobs, list):
                return []
        except httpx.HTTPError as e:
            logger.info(f"[jobs] lever miss for {company}: {e}")
            return []

        out = []
        for job in jobs:
            jid = job.get("id", "")
            if not jid:
                continue
            out.append({
                "platform": "lever",
                "job_id": f"lever:{jid}",
                "title": job.get("text", ""),
                "department": job.get("categories", {}).get("team", "Unknown"),
                "location": job.get("categories", {}).get("location", "Remote"),
                "keywords": _classify_keywords(job.get("descriptionPlain", "") or ""),
                "url": job.get("hostedUrl", ""),
            })
        logger.info(f"[jobs] lever {len(out)} for {company}")
        return out

    async def _fetch_workday(self, client: httpx.AsyncClient, company: str) -> list[dict]:
        candidates = [
            (company, f"{company}-careers"),
            (company, f"{company}-jobs"),
            (company, "External"),
            (company, "Careers"),
        ]
        suffixes = ["wd1", "wd3", "wd5"]
        for suffix in suffixes:
            for tenant, board in candidates:
                url = f"https://{tenant}.{suffix}.myworkdayjobs.com/wday/cxs/{tenant}/{board}/jobs"
                try:
                    resp = await client.post(url, json={}, timeout=8)
                    if resp.status_code == 200:
                        jobs = resp.json().get("jobPostings", [])
                        if jobs:
                            return self._parse_workday(jobs, f"{tenant}.{suffix}.myworkdayjobs.com", board)
                except (httpx.HTTPError, Exception):
                    continue
        return []

    def _parse_workday(self, jobs: list, host: str, board: str) -> list[dict]:
        out = []
        for job in jobs[:50]:
            external_id = job.get("externalPath", job.get("bulletFields", [""])[0])
            jid = hashlib.md5(f"{host}:{external_id}".encode()).hexdigest()[:16]
            title = job.get("title", "")
            out.append({
                "platform": "workday",
                "job_id": f"workday:{jid}",
                "title": title,
                "department": "Unknown",
                "location": ", ".join(job.get("locationsText", "").split(",")[:2]),
                "keywords": _classify_keywords(title),
                "url": f"https://{host}/en-US/{board}{external_id}",
            })
        return out

    async def _fetch_linkedin(self, client: httpx.AsyncClient, company: str) -> list[dict]:
        url = f"https://www.linkedin.com/jobs/search/?keywords={company}&f_JT=F&position=1&pageNum=0"
        try:
            resp = await client.get(url, timeout=12)
            resp.raise_for_status()
            html = resp.text
        except httpx.HTTPError as e:
            logger.info(f"[jobs] linkedin miss for {company}: {e}")
            return []

        soup = BeautifulSoup(html, "html.parser")
        cards = soup.select("div.base-card") or soup.select("li.jobs-search__results-item")
        out = []
        for card in cards[:30]:
            title_el = card.select_one("h3.base-search-card__title, h3.job-search-card__title")
            location_el = card.select_one("span.job-search-card__location")
            link_el = card.select_one("a.base-card__full-link, a[data-tracking-control-name]")
            title = title_el.get_text(strip=True) if title_el else ""
            job_url = link_el["href"].split("?")[0] if link_el and link_el.get("href") else ""
            if not title or not job_url:
                continue
            jid = hashlib.md5(job_url.encode()).hexdigest()[:16]
            out.append({
                "platform": "linkedin",
                "job_id": f"linkedin:{jid}",
                "title": title,
                "department": "Unknown",
                "location": location_el.get_text(strip=True) if location_el else "",
                "keywords": _classify_keywords(title),
                "url": job_url,
            })
        logger.info(f"[jobs] linkedin {len(out)} for {company}")
        return out
