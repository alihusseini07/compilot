import os
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv
from sqlalchemy import (
    ARRAY,
    Column,
    DateTime,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Signal(Base):
    """Raw scraped signal from any source. source_id is the idempotency key."""

    __tablename__ = "signals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company = Column(String, nullable=False, index=True)
    source_type = Column(String, nullable=False)
    source_id = Column(String, nullable=False, unique=True)
    content = Column(Text, nullable=False)
    metadata = Column(JSONB, nullable=False, default=dict)
    scraped_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "company": self.company,
            "source_type": self.source_type,
            "source_id": self.source_id,
            "content": self.content,
            "metadata": self.metadata,
            "scraped_at": self.scraped_at.isoformat() if self.scraped_at else None,
        }


class Inference(Base):
    """Strategic inference produced by the synthesis agent via Claude."""

    __tablename__ = "inferences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company = Column(String, nullable=False, index=True)
    inference = Column(Text, nullable=False)
    confidence = Column(String, nullable=False)  # high | medium | low
    category = Column(String, nullable=False)    # product | gtm | hiring | funding | technical | regulatory
    reasoning = Column(Text, nullable=False)
    supporting_signal_ids = Column(ARRAY(Integer), nullable=False, default=list)
    synthesized_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "company": self.company,
            "inference": self.inference,
            "confidence": self.confidence,
            "category": self.category,
            "reasoning": self.reasoning,
            "supporting_signal_ids": self.supporting_signal_ids or [],
            "synthesized_at": self.synthesized_at.isoformat() if self.synthesized_at else None,
        }
