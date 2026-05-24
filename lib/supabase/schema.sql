-- =============================================================================
-- SWIM — Supabase Schema
-- Apply this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Run once on a fresh project.  Re-running is safe: all statements use
-- IF NOT EXISTS / OR REPLACE guards.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- future full-text search on title/body


-- ---------------------------------------------------------------------------
-- Enums (explicit CHECK constraints used instead to stay migration-friendly)
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- categories
-- Seed rows inserted via scripts/seed-supabase.ts or the seed.ts helper.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL UNIQUE,
  color         TEXT        NOT NULL DEFAULT '#86d46e',
  display_order INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- threads
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS threads (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- slug keeps URLs stable when rows come from the mock seed (th-001, etc.)
  slug             TEXT        NOT NULL UNIQUE,
  title            TEXT        NOT NULL,
  body             TEXT        NOT NULL,
  category         TEXT        NOT NULL,
  author_handle    TEXT        NOT NULL,
  author_mode      TEXT        NOT NULL DEFAULT 'anon'
                                CHECK (author_mode IN ('anon', 'ghost')),
  tags             TEXT[]      NOT NULL DEFAULT '{}',
  is_pinned        BOOLEAN     NOT NULL DEFAULT false,
  is_highlighted   BOOLEAN     NOT NULL DEFAULT false,
  badge            TEXT
                    CHECK (badge IN (
                      'REDACTED','RECOVERED','UNVERIFIED','WITNESSED',
                      'LEAKED MEMORY','DEAD NODE','ARCHIVIST PICK','SIGNAL ACTIVE'
                    )),
  archive_status   TEXT
                    CHECK (archive_status IN ('OPEN','REDACTED','RECOVERED','CORRUPTED')),
  signal_level     TEXT
                    CHECK (signal_level IN ('LOW','ACTIVE','UNSTABLE','BURIED')),
  archive_id       TEXT,
  view_count       INTEGER     NOT NULL DEFAULT 0,
  reply_count      INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS threads_updated_at ON threads;
CREATE TRIGGER threads_updated_at
  BEFORE UPDATE ON threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ---------------------------------------------------------------------------
-- replies
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS replies (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     UUID        NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  body          TEXT        NOT NULL,
  author_handle TEXT        NOT NULL,
  author_mode   TEXT        NOT NULL DEFAULT 'anon'
                              CHECK (author_mode IN ('anon', 'ghost')),
  post_number   INTEGER     NOT NULL,
  reply_to_id   UUID        REFERENCES replies(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Ensures post numbers are unique per thread
  UNIQUE (thread_id, post_number)
);

-- Auto-increment reply_count on threads when a reply is inserted
CREATE OR REPLACE FUNCTION increment_reply_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE threads
  SET reply_count      = reply_count + 1,
      last_activity_at = now()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS replies_increment_count ON replies;
CREATE TRIGGER replies_increment_count
  AFTER INSERT ON replies
  FOR EACH ROW EXECUTE FUNCTION increment_reply_count();


-- ---------------------------------------------------------------------------
-- reactions
-- Anonymous deduplication via anon_fingerprint (a client-generated token
-- stored in localStorage — never tied to an account or IP).
-- The UNIQUE constraint prevents double-voting without storing identity.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reactions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type      TEXT        NOT NULL CHECK (target_type IN ('thread', 'reply')),
  target_id        UUID        NOT NULL,
  reaction_type    TEXT        NOT NULL
                                CHECK (reaction_type IN ('echo','dive','ripple','witness','signal')),
  anon_fingerprint TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (target_type, target_id, reaction_type, anon_fingerprint)
);


-- ---------------------------------------------------------------------------
-- reports
-- Anon users can INSERT only.  Moderation staff reads via service role key.
-- Reason enum kept conservative — expand with a migration later if needed.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT        NOT NULL CHECK (target_type IN ('thread', 'reply')),
  target_id   UUID        NOT NULL,
  reason      TEXT        NOT NULL
                            CHECK (reason IN (
                              'spam','illegal_content','doxxing',
                              'harassment','off_topic','other'
                            )),
  details     TEXT,
  status      TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','reviewed','dismissed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- ghosts
-- Optional persistent handles stored client-side; row created on first use.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ghosts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  handle              TEXT        NOT NULL UNIQUE,
  label               TEXT        NOT NULL DEFAULT 'GHOST'
                                    CHECK (label IN ('GHOST','NODE','SIGNAL IDENTITY','ARCHIVE HANDLE')),
  joined_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  active_categories   TEXT[]      NOT NULL DEFAULT '{}',
  archived_thread_ids UUID[]      NOT NULL DEFAULT '{}',
  echoes_received     INTEGER     NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- moderation_actions
-- Written only by service-role key (no anon access).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS moderation_actions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT        NOT NULL CHECK (target_type IN ('thread','reply','ghost')),
  target_id   UUID        NOT NULL,
  action      TEXT        NOT NULL
                            CHECK (action IN ('hide','pin','unpin','flag','restore','redact')),
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE categories         ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies             ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghosts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_actions  ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- categories — public read, no anon write
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "categories_anon_select" ON categories;
CREATE POLICY "categories_anon_select"
  ON categories FOR SELECT TO anon USING (true);


-- ---------------------------------------------------------------------------
-- threads — public read, anon insert only (no update/delete by anon)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "threads_anon_select" ON threads;
CREATE POLICY "threads_anon_select"
  ON threads FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "threads_anon_insert" ON threads;
CREATE POLICY "threads_anon_insert"
  ON threads FOR INSERT TO anon
  WITH CHECK (
    -- Reject obviously empty or oversized posts at DB level
    length(title) BETWEEN 4 AND 300
    AND length(body) BETWEEN 10 AND 20000
    -- Only allow known categories (references the categories table)
    AND category IN (SELECT name FROM categories)
    -- Author handle must be present
    AND length(author_handle) BETWEEN 1 AND 64
  );


-- ---------------------------------------------------------------------------
-- replies — public read, anon insert only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "replies_anon_select" ON replies;
CREATE POLICY "replies_anon_select"
  ON replies FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "replies_anon_insert" ON replies;
CREATE POLICY "replies_anon_insert"
  ON replies FOR INSERT TO anon
  WITH CHECK (
    length(body) BETWEEN 2 AND 10000
    AND length(author_handle) BETWEEN 1 AND 64
  );


-- ---------------------------------------------------------------------------
-- reactions — public read, anon insert only
-- UNIQUE constraint on (target_type, target_id, reaction_type, anon_fingerprint)
-- prevents double-voting without any identity tracking.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "reactions_anon_select" ON reactions;
CREATE POLICY "reactions_anon_select"
  ON reactions FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "reactions_anon_insert" ON reactions;
CREATE POLICY "reactions_anon_insert"
  ON reactions FOR INSERT TO anon
  WITH CHECK (
    length(anon_fingerprint) BETWEEN 8 AND 128
  );


-- ---------------------------------------------------------------------------
-- reports — anon INSERT only, NO SELECT (moderation reads via service role)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "reports_anon_insert" ON reports;
CREATE POLICY "reports_anon_insert"
  ON reports FOR INSERT TO anon
  WITH CHECK (
    length(coalesce(details, '')) <= 2000
  );


-- ---------------------------------------------------------------------------
-- ghosts — public read of handle/label, anon insert only (no update by anon)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "ghosts_anon_select" ON ghosts;
CREATE POLICY "ghosts_anon_select"
  ON ghosts FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "ghosts_anon_insert" ON ghosts;
CREATE POLICY "ghosts_anon_insert"
  ON ghosts FOR INSERT TO anon
  WITH CHECK (
    length(handle) BETWEEN 3 AND 64
  );


-- ---------------------------------------------------------------------------
-- moderation_actions — NO anon access at all
-- Service role key bypasses RLS entirely, so no policy needed for admin.
-- ---------------------------------------------------------------------------
-- (No policy = no access for anon role.)


-- =============================================================================
-- Indexes (performance for common queries)
-- =============================================================================
CREATE INDEX IF NOT EXISTS threads_category_idx         ON threads (category);
CREATE INDEX IF NOT EXISTS threads_created_at_idx       ON threads (created_at DESC);
CREATE INDEX IF NOT EXISTS threads_last_activity_idx    ON threads (last_activity_at DESC);
CREATE INDEX IF NOT EXISTS threads_is_highlighted_idx   ON threads (is_highlighted) WHERE is_highlighted = true;
CREATE INDEX IF NOT EXISTS threads_is_pinned_idx        ON threads (is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS replies_thread_id_idx        ON replies (thread_id);
CREATE INDEX IF NOT EXISTS reactions_target_idx         ON reactions (target_type, target_id);
CREATE INDEX IF NOT EXISTS reports_status_idx           ON reports (status);
