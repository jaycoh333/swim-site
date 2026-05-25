-- =============================================================================
-- SWIM — recovered_signals table
-- Run this in Supabase SQL editor AFTER schema.sql has been applied.
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE guards.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- recovered_signals
--
-- Signals are inserted by scrapers or curators with status='pending'.
-- Curators update status to 'approved' | 'archived' | 'rejected' via the
-- /scanner/queue page (service role key only — no anon access).
--
-- SCRAPER INTEGRATION POINT:
--   Future automated scrapers will INSERT rows here with status='pending'.
--   Only rows with status='approved' are shown on the public /scanner page.
--   Human approval is mandatory before any signal reaches the public archive.
--
-- TELEGRAM / X INTEGRATION POINT:
--   When status changes to 'approved', a future webhook or cron will read
--   the row and queue it for the Telegram/X posting pipeline.
--   See docs/growth-playbook.md for the full automation plan.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recovered_signals (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  category            TEXT        NOT NULL,
  title               TEXT        NOT NULL,
  summary             TEXT        NOT NULL,
  source_name         TEXT        NOT NULL,
  source_url          TEXT,
  source_type         TEXT        NOT NULL
                                  CHECK (source_type IN (
                                    'reddit','pastebin','wayback','imageboard',
                                    'irc','forum','other'
                                  )),
  status              TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','approved','archived','rejected')),
  anomaly_score       INTEGER     NOT NULL DEFAULT 5
                                  CHECK (anomaly_score BETWEEN 1 AND 10),
  tags                TEXT[]      NOT NULL DEFAULT '{}',
  discovered_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at         TIMESTAMPTZ,
  published_thread_id UUID        REFERENCES threads(id) ON DELETE SET NULL
);


-- ---------------------------------------------------------------------------
-- Row Level Security — NO anon access.
-- All reads and writes go through the service role key (server-only).
-- Anon users cannot see, insert, or modify this table.
-- ---------------------------------------------------------------------------
ALTER TABLE recovered_signals ENABLE ROW LEVEL SECURITY;
-- (No policy = zero anon access. Service role bypasses RLS.)


-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS recovered_signals_status_idx
  ON recovered_signals (status);

CREATE INDEX IF NOT EXISTS recovered_signals_category_idx
  ON recovered_signals (category);

CREATE INDEX IF NOT EXISTS recovered_signals_discovered_idx
  ON recovered_signals (discovered_at DESC);

CREATE INDEX IF NOT EXISTS recovered_signals_anomaly_idx
  ON recovered_signals (anomaly_score DESC);

CREATE INDEX IF NOT EXISTS recovered_signals_approved_at_idx
  ON recovered_signals (approved_at DESC NULLS LAST);
