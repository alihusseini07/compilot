"""
GitHubAgent — scrapes public GitHub activity for a target org.

Fetches:
  - New public repos created in the last 7 days
  - Recent commits that touch dependency manifests
  - Repository topic changes (indirect: checks current topics)

Writes signals with source_type='github'.
"""

import hashlib
import logging
import os
from datetime import datetime, timedelta, timezone

import httpx
from dotenv import load_dotenv

from agents import BaseAgent

load_dotenv()
logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"
DEPENDENCY_FILES = {"package.json", "requirements.txt", "go.mod", "Cargo.toml", "pyproject.toml"}
LOOKBACK_DAYS = 7


class GitHubAgent(BaseAgent):
    source_type = "github"

    def __init__(self):
        token = os.environ.get("GITHUB_TOKEN")
        self._headers = {
            "Authorization": f"Bearer {token}" if token else "",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    async def _fetch(self, company: str) -> list[dict]:
        """company is treated as a GitHub org name (e.g. 'linear')."""
        signals = []
        async with httpx.AsyncClient(headers=self._headers, timeout=20) as client:
            signals += await self._fetch_new_repos(client, company)
            signals += await self._fetch_dependency_commits(client, company)
        return signals

    async def _fetch_new_repos(self, client: httpx.AsyncClient, org: str) -> list[dict]:
        """Detect new public repos created in the last LOOKBACK_DAYS."""
        signals = []
        cutoff = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)

        try:
            resp = await client.get(
                f"{GITHUB_API}/orgs/{org}/repos",
                params={"type": "public", "sort": "created", "direction": "desc", "per_page": 30},
            )
            resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.error(f"[github] Failed to fetch repos for {org}: {e}")
            return []

        for repo in resp.json():
            created_at = datetime.fromisoformat(repo["created_at"].replace("Z", "+00:00"))
            if created_at < cutoff:
                break

            signals.append({
                "source_id": f"github:repo:{repo['full_name']}",
                "content": (
                    f"New public repo created: {repo['full_name']}. "
                    f"Description: {repo.get('description') or 'none'}. "
                    f"Topics: {', '.join(repo.get('topics', [])) or 'none'}."
                ),
                "metadata": {
                    "repo": repo["full_name"],
                    "url": repo["html_url"],
                    "description": repo.get("description"),
                    "topics": repo.get("topics", []),
                    "language": repo.get("language"),
                    "created_at": repo["created_at"],
                },
            })

        return signals

    async def _fetch_dependency_commits(self, client: httpx.AsyncClient, org: str) -> list[dict]:
        """Find recent commits touching dependency manifests across all public repos."""
        signals = []
        cutoff = (datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)).isoformat()

        # Get list of repos first (reuse endpoint, no pagination for demo)
        try:
            resp = await client.get(
                f"{GITHUB_API}/orgs/{org}/repos",
                params={"type": "public", "sort": "pushed", "direction": "desc", "per_page": 20},
            )
            resp.raise_for_status()
            repos = resp.json()
        except httpx.HTTPError as e:
            logger.error(f"[github] Failed to list repos for dependency scan: {e}")
            return []

        for repo in repos:
            try:
                commits_resp = await client.get(
                    f"{GITHUB_API}/repos/{repo['full_name']}/commits",
                    params={"since": cutoff, "per_page": 20},
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

                changed_files = {f["filename"].split("/")[-1] for f in detail.get("files", [])}
                dep_hits = changed_files & DEPENDENCY_FILES

                if dep_hits:
                    for fname in dep_hits:
                        source_id = f"github:commit:{sha}:{fname}"
                        # Extract patch excerpt for the relevant file
                        patch = next(
                            (f.get("patch", "") for f in detail["files"] if f["filename"].endswith(fname)),
                            "",
                        )
                        signals.append({
                            "source_id": source_id,
                            "content": (
                                f"Commit {sha[:8]} in {repo['full_name']} touched {fname}. "
                                f"Message: {commit['commit']['message'][:120]}."
                            ),
                            "metadata": {
                                "repo": repo["full_name"],
                                "sha": sha,
                                "file": fname,
                                "patch_excerpt": patch[:500],
                                "author": commit["commit"]["author"]["name"],
                                "committed_at": commit["commit"]["author"]["date"],
                                "url": commit["html_url"],
                            },
                        })

        return signals
