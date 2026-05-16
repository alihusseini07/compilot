"""
ResearchAgent — news/PR/pricing signal aggregator.

Sources:
  - TechCrunch + VentureBeat RSS (entries mentioning the company)
  - Hacker News Algolia search by company name
  - Pricing-page snapshot (URL discovery + text extract)

The LLM is asked to filter the raw items down to strategically significant ones
(product launches, partnerships, leadership changes, regulatory, financial moves)
and reason about what they collectively suggest.
"""

import hashlib
import logging
import re
import time
from datetime import datetime, timedelta, timezone

import feedparser
import httpx
from bs4 import BeautifulSoup

from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

RSS_FEEDS = [
    "https://techcrunch.com/feed/",
    "https://venturebeat.com/feed/",
]

PRICING_URL_OVERRIDES: dict[str, str] = {
    "linear": "https://linear.app/pricing",
    "notion": "https://www.notion.so/pricing",
    "figma": "https://www.figma.com/pricing/",
    "vercel": "https://vercel.com/pricing",
    "shopify": "https://www.shopify.com/pricing",
    "github": "https://github.com/pricing",
    "atlassian": "https://www.atlassian.com/software/jira/pricing",
}

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

_DAYS = {"last_day": 1, "last_7_days": 7, "last_30_days": 30}


def _cutoff(date_range: str) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=_DAYS.get(date_range, 1))


class ResearchAgent(BaseAgent):
    agent_name = "research"

    async def _fetch(self, company: str, date_range: str) -> list[dict]:
        cutoff = _cutoff(date_range)
        data: list[dict] = []
        data += self._fetch_rss(company, cutoff)
        async with httpx.AsyncClient(
            timeout=15,
            headers=_HEADERS,
            follow_redirects=True,
        ) as client:
            data += await self._fetch_hackernews(client, company, cutoff)
            pricing = await self._fetch_pricing(client, company)
            if pricing:
                data.append(pricing)
        return data

    def _build_prompt(self, company: str, data: list[dict]) -> str:
        items = [
            {
                "kind": d.get("kind"),
                "title": d.get("title", "")[:200],
                "summary": d.get("summary", "")[:400],
                "source": d.get("source", ""),
                "published_at": d.get("published_at", ""),
            }
            for d in data[:50]
        ]
        return (
            "You are a competitive intelligence analyst. "
            f"Here are recent news, PR, and pricing items about {company}: {items}. "
            "Filter out anything not strategically significant (skip awards, generic HR fluff). "
            "Focus on product launches, partnerships, leadership changes, regulatory news, "
            "financial moves, and pricing changes. For items that remain, what do they "
            "collectively suggest about this company's direction? "
            "Return a 2-4 sentence conclusion in plain text."
        )

    def _fetch_rss(self, company: str, cutoff: datetime) -> list[dict]:
        out = []
        company_lower = company.lower()
        for feed_url in RSS_FEEDS:
            try:
                feed = feedparser.parse(feed_url)
            except Exception as e:
                logger.error(f"[research] rss parse failed {feed_url}: {e}")
                continue
            for entry in feed.entries:
                title = entry.get("title", "")
                summary = entry.get("summary", "")
                if company_lower not in title.lower() and company_lower not in summary.lower():
                    continue
                published_struct = entry.get("published_parsed") or entry.get("updated_parsed")
                if published_struct:
                    published_dt = datetime.fromtimestamp(time.mktime(published_struct), tz=timezone.utc)
                    if published_dt < cutoff:
                        continue
                out.append({
                    "kind": "news",
                    "title": title,
                    "summary": re.sub(r"<[^>]+>", " ", summary)[:500],
                    "url": entry.get("link", ""),
                    "source": feed.feed.get("title", feed_url),
                    "published_at": entry.get("published", ""),
                })
        logger.info(f"[research] rss {len(out)} items for {company}")
        return out

    async def _fetch_hackernews(self, client: httpx.AsyncClient, company: str, cutoff: datetime) -> list[dict]:
        try:
            resp = await client.get(
                "https://hn.algolia.com/api/v1/search_by_date",
                params={
                    "query": company,
                    "tags": "story",
                    "hitsPerPage": 30,
                    "numericFilters": f"created_at_i>{int(cutoff.timestamp())}",
                },
            )
            resp.raise_for_status()
            hits = resp.json().get("hits", [])
        except httpx.HTTPError as e:
            logger.error(f"[research] hn failed: {e}")
            return []
        out = []
        for hit in hits:
            url = hit.get("url") or f"https://news.ycombinator.com/item?id={hit['objectID']}"
            out.append({
                "kind": "hn",
                "title": hit.get("title", ""),
                "summary": "",
                "url": url,
                "source": "Hacker News",
                "points": hit.get("points", 0),
                "published_at": hit.get("created_at", ""),
            })
        logger.info(f"[research] hn {len(out)} items for {company}")
        return out

    async def _fetch_pricing(self, client: httpx.AsyncClient, company: str) -> dict | None:
        url = await self._discover_pricing_url(client, company)
        if not url:
            return None
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            html = resp.text
        except httpx.HTTPError as e:
            logger.info(f"[research] pricing fetch failed {url}: {e}")
            return None
        text = self._extract_text(html)
        if len(text) < 200:
            return None
        tiers = self._extract_tiers(text)
        return {
            "kind": "pricing",
            "title": f"Pricing page snapshot: {url}",
            "summary": f"Detected tiers: {', '.join(tiers) or 'unknown'}. Excerpt: {text[:400]}",
            "url": url,
            "source": "pricing-page",
            "tiers": tiers,
            "content_hash": hashlib.sha256(text.encode()).hexdigest(),
            "published_at": datetime.now(timezone.utc).isoformat(),
        }

    async def _discover_pricing_url(self, client: httpx.AsyncClient, company: str) -> str | None:
        key = company.lower()
        if key in PRICING_URL_OVERRIDES:
            return PRICING_URL_OVERRIDES[key]
        for pattern in _URL_PATTERNS:
            url = pattern.format(company=key)
            try:
                resp = await client.head(url, timeout=8)
                if resp.status_code in (200, 301, 302):
                    return url
            except httpx.HTTPError:
                continue
        return None

    def _extract_text(self, html: str) -> str:
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
            tag.decompose()
        return re.sub(r"\s+", " ", soup.get_text(separator=" ")).strip()

    def _extract_tiers(self, text: str) -> list[str]:
        pattern = r"\b(free|starter|basic|pro|professional|business|enterprise|team|growth|scale|plus|premium|ultimate)\b"
        return sorted(set(re.findall(pattern, text.lower())))
