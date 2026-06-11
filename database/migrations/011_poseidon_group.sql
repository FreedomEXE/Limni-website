-- Migration 011: Poseidon Group Mode
-- Creates tables for group chat members, messages, and context.
-- Designed for multi-group extensibility (group_id on every table).

-- ─── Group Members ───────────────────────────
CREATE TABLE IF NOT EXISTS poseidon_group_members (
  telegram_user_id   BIGINT NOT NULL,
  group_id           BIGINT NOT NULL,
  username           VARCHAR(100),
  first_name         VARCHAR(100),
  display_name       VARCHAR(100),
  role               VARCHAR(20) NOT NULL DEFAULT 'member',
  total_messages     INTEGER NOT NULL DEFAULT 0,
  insight_score      DECIMAL(6,2) NOT NULL DEFAULT 0,
  engagement_score   DECIMAL(6,2) NOT NULL DEFAULT 0,
  helpfulness_score  DECIMAL(6,2) NOT NULL DEFAULT 0,
  signal_noise_score DECIMAL(6,2) NOT NULL DEFAULT 0,
  composite_score    DECIMAL(6,2) NOT NULL DEFAULT 0,
  notable_calls      JSONB NOT NULL DEFAULT '[]',
  first_seen_utc     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_utc      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata           JSONB NOT NULL DEFAULT '{}',
  PRIMARY KEY (telegram_user_id, group_id)
);

-- ─── Group Messages ──────────────────────────
CREATE TABLE IF NOT EXISTS poseidon_group_messages (
  id                  BIGSERIAL PRIMARY KEY,
  group_id            BIGINT NOT NULL,
  telegram_message_id BIGINT,
  telegram_user_id    BIGINT NOT NULL,
  message_text        TEXT,
  message_type        VARCHAR(20) NOT NULL DEFAULT 'text',
  triggered_proteus   BOOLEAN NOT NULL DEFAULT FALSE,
  scored              BOOLEAN NOT NULL DEFAULT FALSE,
  score_result        JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_messages_group ON poseidon_group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_user ON poseidon_group_messages(telegram_user_id, group_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_unscored ON poseidon_group_messages(scored) WHERE scored = FALSE;
CREATE INDEX IF NOT EXISTS idx_group_messages_created ON poseidon_group_messages(created_at DESC);

-- ─── Group Context ───────────────────────────
CREATE TABLE IF NOT EXISTS poseidon_group_context (
  id            SERIAL PRIMARY KEY,
  group_id      BIGINT NOT NULL,
  context_type  VARCHAR(30) NOT NULL DEFAULT 'active',
  content       TEXT NOT NULL DEFAULT '',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_context_group ON poseidon_group_context(group_id, context_type);

-- Seed active context row for the primary group (will be populated via env var at runtime)
-- The group_id 0 is a placeholder; the application uses the real group ID from config.
