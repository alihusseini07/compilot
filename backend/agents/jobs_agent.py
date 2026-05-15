"""
JobsAgent — scrapes public job postings to detect hiring signal patterns.

Sources (tried in order for each company):
  - Greenhouse public job board API
  - Lever public postings API
  - Workday (best-effort, company-specific subdomain)
  - LinkedIn Jobs public search HTML

Hiring signal classification:
  - ML/AI roles → AI product development
  - Enterprise sales → GTM shift upmarket
  - Security/compliance → enterprise readiness
  - Infrastructure/platform → scaling phase
"""

import hashlib
import logging
import re

import httpx
from bs4 import BeautifulSoup

from agents import BaseAgent

logger = logging.getLogger(__name__)

AI_KEYWORDS = {"pytorch", "tensorflow", "llm", "rag", "vector", "embedding", "openai", "langchain", "ml", "machine learning"}
ENTERPRISE_KEYWORDS = {"enterprise", "fortune 500", "soc 2", "saml", "sso", "compliance", "audit"}
INFRA_KEYWORDS = {"kubernetes", "k8s", "terraform", "platform engineering", "sre", "reliability"}


def _classify_keywords(description: str) -> list[str]:
    desc_lower = description.lower()
    found = [kw for kw in AI_KEYWORDS | ENTERPRISE_KEYWORDS | INFRA_KEYWORDS if kw in desc_lower]
    return found[:10]


def _stable_id(platform: str, job_id: str) -> str:
    return f"job:{platform}:{job_id}"


class JobsAgent(BaseAgent):
    source_type = "jobs"

    async def _fetch(self, company: str) -> list[dict]:
        signals = []
        async with httpx.AsyncClient(
            timeout=15,
            headers={"User-Agent": "Mozilla/5.0 (compatible; CompilotBot/1.0)"},
            follow_redirects=True,
        ) as client:
            signals += await self._fetch_greenhouse(client, company)
            signals += await self._fetch_lever(client, company)
            signals += await self._fetch_workday(client, company)
            signals += await self._fetch_linkedin(client, company)

        # Deduplicate by source_id across platforms
        seen = set()
        unique = []
        for s in signals:
            if s["source_id"] not in seen:
                seen.add(s["source_id"])
                unique.append(s)
        return unique

    # ── Greenhouse ────────────────────────────────────────────────────────────

    async def _fetch_greenhouse(self, client: httpx.AsyncClient, company: str) -> list[dict]:
        try:
            resp = await client.get(
                f"https://boards-api.greenhouse.io/v1/boards/{company}/jobs",
                params={"content": "true"},
            )
            resp.raise_for_status()
            jobs = resp.json().get("jobs", [])
        except httpx.HTTPError as e:
            logger.info(f"[jobs] Greenhouse no board for '{company}': {e}")
            return []

        signals = []
        for job in jobs:
            job_id = str(job["id"])
            title = job.get("title", "")
            dept = next((d["name"] for d in job.get("departments", [])), "Unknown")
            location = next((loc["name"] for loc in job.get("offices", [])), "Remote")
            content_text = re.sub(r"<[^>]+>", " ", job.get("content", ""))
            keywords = _classify_keywords(content_text)
            signals.append({
                "source_id": _stable_id("greenhouse", job_id),
                "content": f"Job posting: {title} ({dept}) at {company}. Location: {location}. Signal keywords: {', '.join(keywords) or 'none'}.",
                "metadata": {
                    "platform": "greenhouse",
                    "job_id": job_id,
                    "title": title,
                    "department": dept,
                    "location": location,
                    "keywords": keywords,
                    "url": job.get("absolute_url", ""),
                    "updated_at": job.get("updated_at", ""),
                },
            })
        logger.info(f"[jobs] Greenhouse: {len(signals)} jobs for '{company}'")
        return signals

    # ── Lever ─────────────────────────────────────────────────────────────────

    async def _fetch_lever(self, client: httpx.AsyncClient, company: str) -> list[dict]:
        try:
            resp = await client.get(f"https://api.lever.co/v0/postings/{company}?mode=json")
            resp.raise_for_status()
            jobs = resp.json()
            if not isinstance(jobs, list):
                return []
        except httpx.HTTPError as e:
            logger.info(f"[jobs] Lever no board for '{company}': {e}")
            return []

        signals = []
        for job in jobs:
            job_id = job.get("id", "")
            if not job_id:
                continue
            title = job.get("text", "")
            dept = job.get("categories", {}).get("team", "Unknown")
            location = job.get("categories", {}).get("location", "Remote")
            description = job.get("descriptionPlain", "") or ""
            keywords = _classify_keywords(description)
            signals.append({
                "source_id": _stable_id("lever", job_id),
                "content": f"Job posting: {title} ({dept}) at {company}. Location: {location}. Signal keywords: {', '.join(keywords) or 'none'}.",
                "metadata": {
                    "platform": "lever",
                    "job_id": job_id,
                    "title": title,
                    "department": dept,
                    "location": location,
                    "keywords": keywords,
                    "url": job.get("hostedUrl", ""),
                    "updated_at": str(job.get("createdAt", "")),
                },
            })
        logger.info(f"[jobs] Lever: {len(signals)} jobs for '{company}'")
        return signals

    # ── Workday ───────────────────────────────────────────────────────────────

    async def _fetch_workday(self, client: httpx.AsyncClient, company: str) -> list[dict]:
        # Workday tenants follow {tenant}.wd{N}.myworkdayjobs.com — try common patterns.
        # The internal jobs API accepts a POST to /wday/cxs/{tenant}/{board}/jobs
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
                        data = resp.json()
                        jobs = data.get("jobPostings", [])
                        if jobs:
                            return self._parse_workday_jobs(company, jobs, f"{tenant}.{suffix}.myworkdayjobs.com", board)
                except (httpx.HTTPError, Exception):
                    continue

        logger.info(f"[jobs] Workday: no board found for '{company}'")
        return []

    def _parse_workday_jobs(self, company: str, jobs: list, host: str, board: str) -> list[dict]:
        signals = []
        for job in jobs[:50]:
            external_id = job.get("externalPath", job.get("bulletFields", [""])[0])
            job_id = hashlib.md5(f"{host}:{external_id}".encode()).hexdigest()[:16]
            title = job.get("title", "")
            location = ", ".join(job.get("locationsText", "").split(",")[:2])
            keywords = _classify_keywords(title)
            signals.append({
                "source_id": _stable_id("workday", job_id),
                "content": f"Job posting: {title} at {company}. Location: {location}. Signal keywords: {', '.join(keywords) or 'none'}.",
                "metadata": {
                    "platform": "workday",
                    "job_id": job_id,
                    "title": title,
                    "location": location,
                    "keywords": keywords,
                    "url": f"https://{host}/en-US/{board}{external_id}",
                },
            })
        logger.info(f"[jobs] Workday: {len(signals)} jobs for '{company}'")
        return signals

    # ── LinkedIn ──────────────────────────────────────────────────────────────

    async def _fetch_linkedin(self, client: httpx.AsyncClient, company: str) -> list[dict]:
        url = f"https://www.linkedin.com/jobs/search/?keywords={company}&f_JT=F&position=1&pageNum=0"
        try:
            resp = await client.get(url, timeout=12)
            resp.raise_for_status()
            html = resp.text
        except httpx.HTTPError as e:
            logger.info(f"[jobs] LinkedIn fetch failed for '{company}': {e}")
            return []

        soup = BeautifulSoup(html, "html.parser")
        job_cards = soup.select("div.base-card")
        if not job_cards:
            # Try alternate selector used on some LinkedIn page variants
            job_cards = soup.select("li.jobs-search__results-item")

        signals = []
        for card in job_cards[:30]:
            title_el = card.select_one("h3.base-search-card__title, h3.job-search-card__title")
            company_el = card.select_one("h4.base-search-card__subtitle")
            location_el = card.select_one("span.job-search-card__location")
            link_el = card.select_one("a.base-card__full-link, a[data-tracking-control-name]")

            title = title_el.get_text(strip=True) if title_el else ""
            location = location_el.get_text(strip=True) if location_el else ""
            job_url = link_el["href"].split("?")[0] if link_el and link_el.get("href") else ""

            if not title or not job_url:
                continue

            job_id = hashlib.md5(job_url.encode()).hexdigest()[:16]
            keywords = _classify_keywords(title)
            signals.append({
                "source_id": _stable_id("linkedin", job_id),
                "content": f"Job posting: {title} at {company}. Location: {location}. Signal keywords: {', '.join(keywords) or 'none'}.",
                "metadata": {
                    "platform": "linkedin",
                    "job_id": job_id,
                    "title": title,
                    "location": location,
                    "keywords": keywords,
                    "url": job_url,
                },
            })

        logger.info(f"[jobs] LinkedIn: {len(signals)} jobs for '{company}'")
        return signals
