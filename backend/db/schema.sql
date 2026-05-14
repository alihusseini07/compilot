-- Compint PostgreSQL Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
