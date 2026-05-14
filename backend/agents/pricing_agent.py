"""
PricingAgent — fetches and diffs competitor pricing pages.

Strategy:
  1. Fetch current pricing page HTML
  2. Extract visible text (strip nav/footer noise)
  3. Hash content and compare against last stored version in DB
  4. If changed, write a signal with a summary of what changed

Limitations: JS-rendered pricing pages (e.g. behind React) will need
a headless browser (Playwright) in a future iteration. This scraper
handles static/SSR pages only.
"""

import hashlib
import logging
import re
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from agents import BaseAgent
from db.models import Signal, async_session
from sqlalchemy import select

logger = logging.getLogger(__name__)

# Map company slug → pricing page URL. Extend as you add competitors.
PRICING_URLS: dict[str, str] = {
    "linear": "https://linear.app/pricing",
    "notion": "https://www.notion.so/pricing",
    "figma": "https://www.figma.com/pricing/",
    "vercel": "https://vercel.com/pricing",
}


def _extract_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    return re.sub(r"\s+", " ", soup.get_text(separator=" ")).strip()


class PricingAgent(BaseAgent):
    source_type = "pricing"

    async def _fetch(self, company: str) -> list[dict]:
        url = PRICING_URLS.get(company.lower())
        if not url:
            logger.warning(f"[pricing] No pricing URL configured for '{company}'")
            return []

        try:
            async with httpx.AsyncClient(
                timeout=15,
                headers={"User-Agent": "Mozilla/5.0 (compatible; CompintBot/1.0)"},
                follow_redirects=True,
            ) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                html = resp.text
        except httpx.HTTPError as e:
            logger.error(f"[pricing] Fetch failed for {url}: {e}")
            return []

        text = _extract_text(html)
        content_hash = hashlib.sha256(text.encode()).hexdigest()
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        source_id = f"pricing:{company}:{today}"

        # Check if we already have this exact content (hash match on most recent)
        last_hash = await self._get_last_hash(company)
        if last_hash == content_hash:
            logger.info(f"[pricing] No change detected for {company}")
            return []

        change_summary = "Pricing page content changed." if last_hash else "Initial pricing page snapshot captured."

        return [{
            "source_id": source_id,
            "content": f"{change_summary} Page text excerpt: {text[:600]}",
            "metadata": {
                "url": url,
                "content_hash": content_hash,
                "previous_hash": last_hash,
                "detected_at": datetime.now(timezone.utc).isoformat(),
            },
        }]

    async def _get_last_hash(self, company: str) -> str | None:
        """Retrieve content_hash from the most recent pricing signal for this company."""
        async with async_session() as session:
            stmt = (
                select(Signal)
                .where(Signal.company == company, Signal.source_type == "pricing")
                .order_by(Signal.scraped_at.desc())
                .limit(1)
            )
            result = await session.execute(stmt)
            row = result.scalar_one_or_none()
            if row and row.metadata:
                return row.metadata.get("content_hash")
        return None
