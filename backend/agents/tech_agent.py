"""
TechAgent — GitHub activity + patent filings.

GitHub: new public repos, recent commits touching dependency manifests, topics.
Patents: Lens.org API by assignee name.

LLM reasons about what the company is building and what technical bets they're making.
"""

import logging
import os
from datetime import datetime, timedelta, timezone

import httpx

from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"
LENS_API_URL = "https://api.lens.org/patent/search"
DEPENDENCY_FILES = {"package.json", "requirements.txt", "go.mod", "Cargo.toml", "pyproject.toml"}

_DAYS = {"last_day": 1, "last_7_days": 7, "last_30_days": 30}


def _days(date_range: str) -> int:
    return _DAYS.get(date_range, 1)


class TechAgent(BaseAgent):
    agent_name = "tech"

    def __init__(self):
        token = os.environ.get("GITHUB_TOKEN", "")
        self._gh_headers = {
            "Authorization": f"Bearer {token}" if token else "",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    async def _fetch(self, company: str, date_range: str) -> list[dict]:
        lookback = _days(date_range)
        data: list[dict] = []
        async with httpx.AsyncClient(headers=self._gh_headers, timeout=20) as gh:
            data += await self._fetch_new_repos(gh, company, lookback)
            data += await self._fetch_dependency_commits(gh, company, lookback)
        data += await self._fetch_patents(company, lookback)
        return data

    def _build_prompt(self, company: str, data: list[dict]) -> str:
        gh = [d for d in data if d.get("kind") in ("repo", "commit")][:40]
        patents = [d for d in data if d.get("kind") == "patent"][:20]
        return (
            "You are a competitive intelligence analyst specializing in technology signals. "
            f"Here is technical data for {company}. "
            f"GitHub activity: {gh}. "
            f"Patent filings: {patents}. "
            "What are they building? What technical bets are they making? "
            "Return a 2-4 sentence conclusion in plain text."
        )

    async def _fetch_new_repos(self, client: httpx.AsyncClient, org: str, lookback: int) -> list[dict]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=lookback)
        try:
            resp = await client.get(
                f"{GITHUB_API}/orgs/{org}/repos",
                params={"type": "public", "sort": "created", "direction": "desc", "per_page": 30},
            )
            resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.info(f"[tech] github repos miss for {org}: {e}")
            return []

        out = []
        for repo in resp.json():
            created = datetime.fromisoformat(repo["created_at"].replace("Z", "+00:00"))
            if created < cutoff:
                break
            out.append({
                "kind": "repo",
                "repo": repo["full_name"],
                "description": repo.get("description") or "",
                "topics": repo.get("topics", []),
                "language": repo.get("language"),
                "url": repo["html_url"],
                "created_at": repo["created_at"],
            })
        return out

    async def _fetch_dependency_commits(self, client: httpx.AsyncClient, org: str, lookback: int) -> list[dict]:
        cutoff_iso = (datetime.now(timezone.utc) - timedelta(days=lookback)).isoformat()
        try:
            resp = await client.get(
                f"{GITHUB_API}/orgs/{org}/repos",
                params={"type": "public", "sort": "pushed", "direction": "desc", "per_page": 20},
            )
            resp.raise_for_status()
            repos = resp.json()
        except httpx.HTTPError as e:
            logger.info(f"[tech] github commits list miss for {org}: {e}")
            return []

        out = []
        for repo in repos:
            try:
                commits_resp = await client.get(
                    f"{GITHUB_API}/repos/{repo['full_name']}/commits",
                    params={"since": cutoff_iso, "per_page": 20},
                )
                commits_resp.raise_for_status()
            except httpx.HTTPError:
                continue
            for commit in commits_resp.json():
                sha = commit["sha"]
                try:
                    detail_resp = await client.get(
                        f"{GITHUB_API}/repos/{repo['full_name']}/commits/{sha}"
                    )
                    detail_resp.raise_for_status()
                    detail = detail_resp.json()
                except httpx.HTTPError:
                    continue
                changed = {f["filename"].split("/")[-1] for f in detail.get("files", [])}
                hits = changed & DEPENDENCY_FILES
                if not hits:
                    continue
                for fname in hits:
                    patch = next(
                        (f.get("patch", "") for f in detail["files"] if f["filename"].endswith(fname)),
                        "",
                    )
                    out.append({
                        "kind": "commit",
                        "repo": repo["full_name"],
                        "sha": sha[:8],
                        "file": fname,
                        "message": commit["commit"]["message"][:160],
                        "patch_excerpt": patch[:300],
                        "committed_at": commit["commit"]["author"]["date"],
                        "url": commit["html_url"],
                    })
        return out

    async def _fetch_patents(self, company: str, lookback: int) -> list[dict]:
        token = os.getenv("LENS_API_TOKEN", "")
        if not token:
            logger.info("[tech] LENS_API_TOKEN not set, skipping patents")
            return []

        cutoff_date = (datetime.now(timezone.utc) - timedelta(days=lookback)).strftime("%Y-%m-%d")
        payload = {
            "query": {
                "bool": {
                    "must": [{"match": {"assignee": company}}],
                    "filter": [{"range": {"date_published": {"gte": cutoff_date}}}],
                }
            },
            "size": 25,
            "sort": [{"date_published": "desc"}],
            "include": [
                "lens_id", "title", "abstract", "date_published",
                "assignee", "class_cpc",
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
            logger.error(f"[tech] lens.org failed: {e}")
            return []

        out = []
        for patent in data.get("data") or []:
            lens_id = patent.get("lens_id", "")
            if not lens_id:
                continue
            cpc = [c.get("symbol", "") for c in (patent.get("class_cpc") or []) if c.get("symbol")]
            out.append({
                "kind": "patent",
                "lens_id": lens_id,
                "title": patent.get("title", ""),
                "abstract": (patent.get("abstract") or "")[:400],
                "filing_date": patent.get("date_published", ""),
                "cpc_codes": cpc[:6],
                "url": f"https://lens.org/lens/patent/{lens_id}",
            })
        logger.info(f"[tech] patents {len(out)} for {company}")
        return out
