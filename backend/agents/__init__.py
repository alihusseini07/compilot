"""
Base class for all Compilot scraper agents.

All scrapers must extend BaseAgent and implement _fetch().
The run() method orchestrates fetch → write and should not be overridden.
"""

import logging
from abc import ABC, abstractmethod

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from db.models import Signal, async_session

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """
    Contract:
      - Subclasses implement _fetch(company) → list[dict]
      - Each dict must include: source_type, source_id, content, metadata
      - _write_signals() handles idempotent DB inserts (ON CONFLICT DO NOTHING)
    """

    source_type: str  # must be set by subclass

    async def run(self, company: str) -> list[dict]:
        """Fetch signals for company and persist them. Returns written signals."""
        logger.info(f"[{self.source_type}] Starting scrape for '{company}'")
        raw = await self._fetch(company)
        written = await self._write_signals(company, raw)
        logger.info(f"[{self.source_type}] Wrote {len(written)} new signals for '{company}'")
        return written

    @abstractmethod
    async def _fetch(self, company: str) -> list[dict]:
        """Fetch raw data from the source. Return list of signal dicts."""
        ...

    async def _write_signals(self, company: str, signals: list[dict]) -> list[dict]:
        """
        Idempotent insert via ON CONFLICT (source_id) DO NOTHING.
        Returns only the rows that were actually inserted.
        """
        if not signals:
            return []

        written = []
        async with async_session() as session:
            for sig in signals:
                stmt = (
                    pg_insert(Signal)
                    .values(
                        company=company,
                        source_type=self.source_type,
                        source_id=sig["source_id"],
                        content=sig["content"],
                        raw_metadata=sig.get("metadata", {}),
                    )
                    .on_conflict_do_nothing(index_elements=["source_id"])
                    .returning(Signal.id)
                )
                try:
                    result = await session.execute(stmt)
                    row = result.fetchone()
                    if row:
                        written.append({**sig, "id": row[0]})
                except Exception as e:
                    logger.error(f"[{self.source_type}] Failed to write signal {sig.get('source_id')}: {e}")
            await session.commit()

        return written
