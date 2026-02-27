-- Migration 010: Persistent Poseidon state in database
-- Moves all Proteus runtime state from ephemeral filesystem to Postgres
-- so state survives Render deploys and container restarts.

CREATE TABLE IF NOT EXISTS poseidon_kv (
  key         VARCHAR(100) PRIMARY KEY,
  value       TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed expected keys so upsert works cleanly
INSERT INTO poseidon_kv (key, value) VALUES
  ('session_state', ''),
  ('conversations', '[]'),
  ('behavior', '{}'),
  ('missed_turns', '[]'),
  ('curation_flag', '{}')
ON CONFLICT (key) DO NOTHING;
