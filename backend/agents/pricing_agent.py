"""
PricingAgent — fetches and diffs competitor pricing pages.

Strategy:
  1. Try known pricing URLs first; fall back to common URL patterns for any company.
  2. Extract visible text (strip nav/footer noise).
  3. Hash content and compare against last stored version.
  4. If changed (or first run), write a signal with the page excerpt.

Limitation: JS-rendered pricing pages will return little useful text.
Static/SSR pages work well.
"""

import hashlib
import logging
import re
from datetime import datetime, timezone

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select

from agents import BaseAgent
from db.models import Signal, async_session

logger = logging.getLogger(__name__)

# Known overrides for companies with non-standard pricing URLs.
PRICING_URL_OVERRIDES: dict[str, str] = {
    "linear": "https://linear.app/pricing",
    "notion": "https://www.notion.so/pricing",
    "figma": "https://www.figma.com/pricing/",
    "vercel": "https://vercel.com/pricing",
    "shopify": "https://www.shopify.com/pricing",
    "github": "https://github.com/pricing",
    "atlassian": "https://www.atlassian.com/software/jira/pricing",
}

# URL patterns tried in order for unknown companies.
_URL_PATTERNS = [
    "https://www.{company}.com/pricing",
    "https://{company}.com/pricing",
    "https://www.{company}.io/pricing",
    "https://{company}.io/pricing",
    "https://www.{company}.co/pricing",
    "https://{company}.app/pricing",
    "https://www.{company}.com/plans",
    "https://{company}.com/plans",
]

_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; CompilotBot/1.0)"}


async def _discover_pricing_url(client: httpx.AsyncClient, company: str) -> str | None:
    """Return the first URL that returns a 200 with >500 chars of visible text."""
    if company.lower() in PRICING_URL_OVERRIDES:
        return PRICING_URL_OVERRIDES[company.lower()]

    for pattern in _URL_PATTERNS:
        url = pattern.format(company=company.lower())
        try:
            resp = await client.head(url, timeout=8)
            if resp.status_code in (200, 301, 302):
                return url
        except httpx.HTTPError:
            continue
    return None


def _extract_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
        tag.decompose()
    text = soup.get_text(separator=" ")
    return re.sub(r"\s+", " ", text).strip()


def _extract_pricing_tiers(text: str) -> list[str]:
    """Best-effort extraction of plan names from pricing page text."""
    tier_patterns = [
        r"\b(free|starter|basic|pro|professional|business|enterprise|team|growth|scale|plus|premium|ultimate)\b",
    ]
    found = set()
    for pattern in tier_patterns:
        matches = re.findall(pattern, text.lower())
        found.update(matches)
    return sorted(found)


class PricingAgent(BaseAgent):
    source_type = "pricing"

    async def _fetch(self, company: str) -> list[dict]:
        async with httpx.AsyncClient(
            headers=_HEADERS,
            follow_redirects=True,
            timeout=15,
        ) as client:
            url = await _discover_pricing_url(client, company)
            if not url:
                logger.warning(f"[pricing] Could not discover pricing URL for '{company}'")
                return []

            try:
                resp = await client.get(url)
                resp.raise_for_status()
                html = resp.text
            except httpx.HTTPError as e:
                logger.error(f"[pricing] Fetch failed for {url}: {e}")
                return []

        text = _extract_text(html)
        if len(text) < 200:
            logger.warning(f"[pricing] Page likely JS-rendered, too little text for '{company}' at {url}")
            return []

        content_hash = hashlib.sha256(text.encode()).hexdigest()
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        source_id = f"pricing:{company}:{today}"

        last_hash = await self._get_last_hash(company)
        if last_hash == content_hash:
            logger.info(f"[pricing] No change detected for '{company}'")
            return []

        tiers = _extract_pricing_tiers(text)
        change_summary = (
            "Pricing page content changed." if last_hash
            else "Initial pricing page snapshot captured."
        )

        return [{
            "source_id": source_id,
            "content": (
                f"{change_summary} URL: {url}. "
                f"Detected plan tiers: {', '.join(tiers) or 'unknown'}. "
                f"Excerpt: {text[:500]}"
            ),
            "metadata": {
                "url": url,
                "content_hash": content_hash,
                "previous_hash": last_hash,
                "detected_tiers": tiers,
                "detected_at": datetime.now(timezone.utc).isoformat(),
            },
        }]

    async def _get_last_hash(self, company: str) -> str | None:
        async with async_session() as session:
            stmt = (
                select(Signal)
                .where(Signal.company == company, Signal.source_type == "pricing")
                .order_by(Signal.scraped_at.desc())
                .limit(1)
            )
            result = await session.execute(stmt)
            row = result.scalar_one_or_none()
            if row and row.raw_metadata:
                return row.raw_metadata.get("content_hash")
        return None
