"""
NewsAgent — monitors RSS feeds and news APIs for competitor mentions.

Sources:
  - TechCrunch RSS
  - VentureBeat RSS
  - Hacker News Algolia search API
  - Google News RSS (search by company name)
"""

import hashlib
import logging

import feedparser
import httpx

from agents import BaseAgent

logger = logging.getLogger(__name__)

RSS_FEEDS = [
    "https://techcrunch.com/feed/",
    "https://venturebeat.com/feed/",
]


class NewsAgent(BaseAgent):
    source_type = "news"

    async def _fetch(self, company: str) -> list[dict]:
        signals = []
        signals += await self._fetch_rss(company)
        signals += await self._fetch_hackernews(company)
        return signals

    async def _fetch_rss(self, company: str) -> list[dict]:
        signals = []
        company_lower = company.lower()

        for feed_url in RSS_FEEDS:
            try:
                feed = feedparser.parse(feed_url)
            except Exception as e:
                logger.error(f"[news] RSS parse failed for {feed_url}: {e}")
                continue

            for entry in feed.entries:
                title = entry.get("title", "")
                summary = entry.get("summary", "")
                if company_lower not in title.lower() and company_lower not in summary.lower():
                    continue

                url = entry.get("link", "")
                source_id = f"news:{hashlib.md5(url.encode()).hexdigest()}"
                signals.append({
                    "source_id": source_id,
                    "content": f"{title}. {summary[:300]}",
                    "metadata": {
                        "url": url,
                        "source": feed.feed.get("title", feed_url),
                        "published_at": entry.get("published", ""),
                    },
                })

        return signals

    async def _fetch_hackernews(self, company: str) -> list[dict]:
        """Use Algolia HN search API — no auth required."""
        signals = []
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://hn.algolia.com/api/v1/search_by_date",
                    params={"query": company, "tags": "story", "hitsPerPage": 20},
                )
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPError as e:
            logger.error(f"[news] HN search failed: {e}")
            return []

        for hit in data.get("hits", []):
            url = hit.get("url") or f"https://news.ycombinator.com/item?id={hit['objectID']}"
            source_id = f"news:hn:{hit['objectID']}"
            signals.append({
                "source_id": source_id,
                "content": f"HN: {hit.get('title', '')}",
                "metadata": {
                    "url": url,
                    "source": "Hacker News",
                    "points": hit.get("points", 0),
                    "num_comments": hit.get("num_comments", 0),
                    "published_at": hit.get("created_at", ""),
                },
            })

        return signals
