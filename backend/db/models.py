import os
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv
from sqlalchemy import (
    ARRAY,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
# Normalize to asyncpg driver regardless of how the URL is provided
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(DATABASE_URL, echo=False, poolclass=NullPool)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "email": self.email,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class SavedCompetitor(Base):
    __tablename__ = "saved_competitors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    company = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=True)
    added_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "company", name="uq_saved_competitors_user_company"),
        Index("idx_saved_competitors_user", "user_id"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "company": self.company,
            "display_name": self.display_name or self.company,
            "added_at": self.added_at.isoformat() if self.added_at else None,
        }


class Signal(Base):
    """Raw scraped signal from any source. source_id is the idempotency key."""

    __tablename__ = "signals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company = Column(String, nullable=False, index=True)
    source_type = Column(String, nullable=False)
    source_id = Column(String, nullable=False, unique=True)
    content = Column(Text, nullable=False)
    raw_metadata = Column("metadata", JSONB, nullable=False, default=dict)
    scraped_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "company": self.company,
            "source_type": self.source_type,
            "source_id": self.source_id,
            "content": self.content,
            "metadata": self.raw_metadata,
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


class DailyReport(Base):
    """Daily intelligence report produced by DailySynthesisAgent."""

    __tablename__ = "daily_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company = Column(String, nullable=False, index=True)
    report_date = Column(Date, nullable=False)
    report_text = Column(Text, nullable=False)
    key_insights = Column(JSONB, nullable=True)
    overall_confidence = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        Index("idx_daily_reports_company_date", "company", "report_date"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "company": self.company,
            "report_date": self.report_date.isoformat() if self.report_date else None,
            "report_text": self.report_text,
            "key_insights": self.key_insights or [],
            "overall_confidence": self.overall_confidence,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class WeeklyReport(Base):
    """Weekly intelligence report produced by WeeklySynthesisAgent."""

    __tablename__ = "weekly_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company = Column(String, nullable=False, index=True)
    week_start = Column(Date, nullable=False)
    report_text = Column(Text, nullable=False)
    fallback_used = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        Index("idx_weekly_reports_company_week", "company", "week_start"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "company": self.company,
            "week_start": self.week_start.isoformat() if self.week_start else None,
            "report_text": self.report_text,
            "fallback_used": bool(self.fallback_used),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class MonthlyReport(Base):
    """Monthly intelligence report produced by MonthlySynthesisAgent."""

    __tablename__ = "monthly_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company = Column(String, nullable=False, index=True)
    month_start = Column(Date, nullable=False)
    report_text = Column(Text, nullable=False)
    fallback_used = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        Index("idx_monthly_reports_company_month", "company", "month_start"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "company": self.company,
            "month_start": self.month_start.isoformat() if self.month_start else None,
            "report_text": self.report_text,
            "fallback_used": bool(self.fallback_used),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
