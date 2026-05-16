-- Compilot PostgreSQL Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User accounts
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Per-user saved competitors
CREATE TABLE IF NOT EXISTS saved_competitors (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company      VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_saved_competitors_user_company UNIQUE (user_id, company)
);

CREATE INDEX IF NOT EXISTS idx_saved_competitors_user ON saved_competitors (user_id);

-- Raw scraped signals from all sources
CREATE TABLE IF NOT EXISTS signals (
    id          SERIAL PRIMARY KEY,
    company     TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('github', 'news', 'jobs', 'patents', 'pricing')),
    -- Stable unique key per signal — used for idempotent inserts
    source_id   TEXT NOT NULL UNIQUE,
    content     TEXT NOT NULL,
    -- Arbitrary source-specific metadata (URLs, SHAs, patent IDs, etc.)
    metadata    JSONB NOT NULL DEFAULT '{}',
    scraped_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signals_company ON signals (company);
CREATE INDEX IF NOT EXISTS idx_signals_source_type ON signals (company, source_type);
CREATE INDEX IF NOT EXISTS idx_signals_scraped_at ON signals (scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_metadata ON signals USING GIN (metadata);

-- AI-generated strategic inferences produced by the synthesis agent
CREATE TABLE IF NOT EXISTS inferences (
    id                   SERIAL PRIMARY KEY,
    company              TEXT NOT NULL,
    inference            TEXT NOT NULL,
    confidence           TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
    category             TEXT NOT NULL CHECK (category IN ('product', 'gtm', 'hiring', 'funding', 'technical', 'regulatory')),
    reasoning            TEXT NOT NULL,
    -- Array of signal.id values that support this inference
    supporting_signal_ids INTEGER[] NOT NULL DEFAULT '{}',
    synthesized_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inferences_company ON inferences (company);
CREATE INDEX IF NOT EXISTS idx_inferences_confidence ON inferences (company, confidence);
CREATE INDEX IF NOT EXISTS idx_inferences_synthesized_at ON inferences (synthesized_at DESC);

-- Daily intelligence reports (DailySynthesisAgent output)
CREATE TABLE IF NOT EXISTS daily_reports (
    id                 SERIAL PRIMARY KEY,
    company            TEXT NOT NULL,
    report_date        DATE NOT NULL,
    report_text        TEXT NOT NULL,
    key_insights       JSONB,
    overall_confidence TEXT,
    created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_reports_company_date ON daily_reports (company, report_date DESC);

-- Weekly intelligence reports (WeeklySynthesisAgent output)
CREATE TABLE IF NOT EXISTS weekly_reports (
    id            SERIAL PRIMARY KEY,
    company       TEXT NOT NULL,
    week_start    DATE NOT NULL,
    report_text   TEXT NOT NULL,
    fallback_used BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_company_week ON weekly_reports (company, week_start DESC);

-- Monthly intelligence reports (MonthlySynthesisAgent output)
CREATE TABLE IF NOT EXISTS monthly_reports (
    id            SERIAL PRIMARY KEY,
    company       TEXT NOT NULL,
    month_start   DATE NOT NULL,
    report_text   TEXT NOT NULL,
    fallback_used BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monthly_reports_company_month ON monthly_reports (company, month_start DESC);
