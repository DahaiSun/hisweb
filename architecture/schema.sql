-- Financial History Website - PostgreSQL Schema (MVP)
-- Target: 100 years daily financial events with source citations.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN
    CREATE TYPE event_status AS ENUM ('draft', 'review', 'published', 'archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'source_type') THEN
    CREATE TYPE source_type AS ENUM ('archive', 'official', 'news', 'research', 'dataset', 'other');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
    CREATE TYPE job_status AS ENUM ('queued', 'running', 'succeeded', 'failed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  region TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  impact TEXT NOT NULL,
  importance_score SMALLINT NOT NULL CHECK (importance_score BETWEEN 1 AND 5),
  confidence_score SMALLINT NOT NULL DEFAULT 3 CHECK (confidence_score BETWEEN 1 AND 5),
  status event_status NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_event_date ON events (event_date DESC);
CREATE INDEX IF NOT EXISTS idx_events_status ON events (status);
CREATE INDEX IF NOT EXISTS idx_events_category_date ON events (category, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_events_importance ON events (importance_score DESC, event_date DESC);

CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_type source_type NOT NULL DEFAULT 'other',
  publisher TEXT,
  publication_or_snapshot_date TIMESTAMPTZ,
  access_date DATE,
  rights_note TEXT,
  notes_on_reliability TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_url)
);

CREATE INDEX IF NOT EXISTS idx_sources_type ON sources (source_type);
CREATE INDEX IF NOT EXISTS idx_sources_pubdate ON sources (publication_or_snapshot_date DESC);

CREATE TABLE IF NOT EXISTS event_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  quote_excerpt TEXT,
  citation_note TEXT,
  relevance_rank SMALLINT NOT NULL DEFAULT 1 CHECK (relevance_rank BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, source_id)
);

CREATE INDEX IF NOT EXISTS idx_event_sources_event ON event_sources (event_id, relevance_rank);
CREATE INDEX IF NOT EXISTS idx_event_sources_source ON event_sources (source_id);

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_tags (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, tag_id)
);

CREATE TABLE IF NOT EXISTS timelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timeline_events (
  timeline_id UUID NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  sequence_no INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (timeline_id, event_id),
  UNIQUE (timeline_id, sequence_no)
);

CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  job_type TEXT NOT NULL,
  status job_status NOT NULL DEFAULT 'queued',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  records_in INTEGER NOT NULL DEFAULT 0,
  records_out INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status_created ON ingestion_jobs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_source_created ON ingestion_jobs (source_name, created_at DESC);

CREATE TABLE IF NOT EXISTS editor_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES users(id),
  review_status TEXT NOT NULL CHECK (review_status IN ('approved', 'changes_requested')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_editor_reviews_event_created ON editor_reviews (event_id, created_at DESC);

-- Lightweight full-text index (can be replaced by Meilisearch/Typesense later).
CREATE INDEX IF NOT EXISTS idx_events_fts ON events
USING GIN (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(impact, '')));

COMMIT;
