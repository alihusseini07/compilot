"""
SynthesisAgent — reasons across all signals for a company using Claude.

This is the ONLY file that calls the Claude API. All LLM calls go through
backend/llm.py. Never add anthropic SDK calls elsewhere.

Output: rows in the `inferences` table with confidence scores and supporting signal IDs.
"""

import json
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from db.models import Inference, Signal, async_session
from llm import call_claude

logger = logging.getLogger(__name__)

LOOKBACK_DAYS = 30
MODEL = "claude-sonnet-4-20250514"

SYSTEM_PROMPT = """You are a competitive intelligence analyst with deep expertise in reading weak signals \
from public data sources to infer a company's strategic direction before it is announced.

You will be given a batch of raw signals (GitHub commits, news articles, job postings, patent filings, \
pricing page changes) for a single competitor company. Your job is to:

1. Identify patterns across signal types — correlation across sources is strong evidence.
2. Infer specific strategic moves (product launches, market expansions, pricing shifts, M&A, etc.).
3. Assign a confidence level to each inference based on how many independent signal sources support it.
4. Be specific and cite the signals that drove each inference.

Confidence rules:
- "high": 3+ independent signal types agree on the same strategic direction.
- "medium": 2 sources agree, OR 1 very strong single source (e.g., a patent filing + job postings).
- "low": single weak signal, speculative extrapolation.

Categories: product | gtm | hiring | funding | technical | regulatory

Respond ONLY with a valid JSON array. No markdown, no explanation outside the JSON."""

USER_PROMPT_TEMPLATE = """Company: {company}
Analysis window: {start_date} to {end_date}

Signals ({count} total):
{signals_json}

Produce a JSON array of strategic inferences. Each object must have exactly these keys:
- "inference": string — the specific strategic move you're inferring
- "confidence": "high" | "medium" | "low"
- "category": one of [product, gtm, hiring, funding, technical, regulatory]
- "reasoning": string — which signals led you here and why
- "supporting_signal_ids": array of integer signal IDs from the input

Return [] if no meaningful inferences can be drawn."""


class SynthesisAgent:
    """Not a BaseAgent subclass — synthesis is read-heavy and uses a different lifecycle."""

    async def run(self, company: str) -> list[dict]:
        signals = await self._load_signals(company)
        if not signals:
            logger.info(f"[synthesis] No signals found for '{company}', skipping.")
            return []

        logger.info(f"[synthesis] Running synthesis for '{company}' with {len(signals)} signals.")
        inferences_data = await self._call_claude(company, signals)
        written = await self._write_inferences(company, inferences_data)
        logger.info(f"[synthesis] Wrote {len(written)} inferences for '{company}'.")
        return written

    async def _load_signals(self, company: str) -> list[dict]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)
        async with async_session() as session:
            stmt = (
                select(Signal)
                .where(Signal.company == company, Signal.scraped_at >= cutoff)
                .order_by(Signal.scraped_at.desc())
                .limit(200)  # token budget guard
            )
            result = await session.execute(stmt)
            rows = result.scalars().all()
        return [r.to_dict() for r in rows]

    async def _call_claude(self, company: str, signals: list[dict]) -> list[dict]:
        end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        start_date = (datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)).strftime("%Y-%m-%d")

        # Include only fields Claude needs — reduces token cost
        slim_signals = [
            {"id": s["id"], "source_type": s["source_type"], "content": s["content"], "scraped_at": s["scraped_at"]}
            for s in signals
        ]

        user_prompt = USER_PROMPT_TEMPLATE.format(
            company=company,
            start_date=start_date,
            end_date=end_date,
            count=len(slim_signals),
            signals_json=json.dumps(slim_signals, indent=2),
        )

        raw = await call_claude(
            system=SYSTEM_PROMPT,
            user=user_prompt,
            model=MODEL,
            max_tokens=4096,
        )

        try:
            parsed = json.loads(raw)
            if not isinstance(parsed, list):
                raise ValueError("Expected JSON array")
            return parsed
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"[synthesis] Claude returned invalid JSON: {e}\nRaw: {raw[:500]}")
            return []

    async def _write_inferences(self, company: str, inferences_data: list[dict]) -> list[dict]:
        written = []
        valid_confidences = {"high", "medium", "low"}
        valid_categories = {"product", "gtm", "hiring", "funding", "technical", "regulatory"}

        async with async_session() as session:
            for item in inferences_data:
                confidence = item.get("confidence", "low")
                category = item.get("category", "product")
                if confidence not in valid_confidences:
                    confidence = "low"
                if category not in valid_categories:
                    category = "product"

                inference = Inference(
                    company=company,
                    inference=item.get("inference", ""),
                    confidence=confidence,
                    category=category,
                    reasoning=item.get("reasoning", ""),
                    supporting_signal_ids=item.get("supporting_signal_ids", []),
                )
                session.add(inference)
                written.append(item)
            await session.commit()

        return written
