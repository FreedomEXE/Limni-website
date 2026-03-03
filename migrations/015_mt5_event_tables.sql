/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
-- File: 015_mt5_event_tables.sql
-- Description: MT5 decision/lifecycle/attribution append-only event tables.
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

-- Retention policy:
-- mt5_decision_events: indefinite retention (audit and compliance record).
-- mt5_position_lifecycle_events: 90-day retention (operational lifecycle stream).
-- mt5_attribution_factors: indefinite retention (research and attribution record).

CREATE TABLE IF NOT EXISTS mt5_decision_events (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL,
  ts_utc TIMESTAMPTZ NOT NULL,
  ea_version TEXT NOT NULL,
  event_type TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  symbol TEXT,
  ticket BIGINT,
  action TEXT,
  lot DOUBLE PRECISION,
  price DOUBLE PRECISION,
  retcode INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mt5_decision_events_account_ts
  ON mt5_decision_events(account_id, ts_utc);
CREATE INDEX IF NOT EXISTS idx_mt5_decision_events_event_type
  ON mt5_decision_events(event_type);
CREATE INDEX IF NOT EXISTS idx_mt5_decision_events_reason_code
  ON mt5_decision_events(reason_code);
CREATE INDEX IF NOT EXISTS idx_mt5_decision_events_symbol_ts
  ON mt5_decision_events(symbol, ts_utc);

CREATE TABLE IF NOT EXISTS mt5_position_lifecycle_events (
  id BIGSERIAL PRIMARY KEY,
  account_id TEXT NOT NULL,
  ticket BIGINT NOT NULL,
  symbol TEXT NOT NULL,
  event TEXT NOT NULL,
  ts_utc TIMESTAMPTZ NOT NULL,
  direction TEXT,
  lots DOUBLE PRECISION,
  price DOUBLE PRECISION,
  profit DOUBLE PRECISION,
  swap DOUBLE PRECISION,
  reason_code TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mt5_position_lifecycle_account_ticket
  ON mt5_position_lifecycle_events(account_id, ticket);
CREATE INDEX IF NOT EXISTS idx_mt5_position_lifecycle_symbol_ts
  ON mt5_position_lifecycle_events(symbol, ts_utc);

CREATE TABLE IF NOT EXISTS mt5_attribution_factors (
  id BIGSERIAL PRIMARY KEY,
  account_id TEXT NOT NULL,
  report_date TEXT NOT NULL,
  symbol TEXT NOT NULL,
  model TEXT,
  direction TEXT,
  strategy_family TEXT,
  strategy_version TEXT,
  tier INTEGER,
  weight_multiplier DOUBLE PRECISION,
  entry_price DOUBLE PRECISION,
  exit_price DOUBLE PRECISION,
  pnl_usd DOUBLE PRECISION,
  hold_hours DOUBLE PRECISION,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mt5_attribution_factors_account_report_date
  ON mt5_attribution_factors(account_id, report_date);
CREATE INDEX IF NOT EXISTS idx_mt5_attribution_factors_symbol
  ON mt5_attribution_factors(symbol);
CREATE INDEX IF NOT EXISTS idx_mt5_attribution_factors_model
  ON mt5_attribution_factors(model);
