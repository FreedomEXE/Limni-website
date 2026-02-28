/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
-- Migration 012: Katarakti sweep-entry system tables
-- Tables for trade logging, signal detection, and correlation matrix.
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

-- Katarakti trade log (mirrors bitget_bot_trades pattern)
CREATE TABLE IF NOT EXISTS katarakti_trades (
  id              BIGSERIAL PRIMARY KEY,
  bot_id          TEXT NOT NULL DEFAULT 'katarakti_v1',
  week_anchor     DATE NOT NULL,
  symbol          VARCHAR(20) NOT NULL,
  asset_class     VARCHAR(20) NOT NULL,
  direction       VARCHAR(10) NOT NULL,
  bias_system     VARCHAR(30) NOT NULL,
  bias_direction  VARCHAR(10) NOT NULL,
  bias_tier       VARCHAR(10),
  session_window  VARCHAR(20) NOT NULL,
  entry_time_utc  TIMESTAMPTZ NOT NULL,
  entry_price     NUMERIC NOT NULL,
  exit_time_utc   TIMESTAMPTZ,
  exit_price      NUMERIC,
  exit_reason     VARCHAR(20),
  exit_step       VARCHAR(20),
  stop_price      NUMERIC,
  stop_distance   NUMERIC,
  risk_pct        NUMERIC NOT NULL DEFAULT 1.0,
  risk_usd        NUMERIC,
  notional_usd    NUMERIC,
  pnl_usd         NUMERIC,
  pnl_pct         NUMERIC,
  peak_profit_pct NUMERIC,
  reached_025     BOOLEAN DEFAULT FALSE,
  reached_050     BOOLEAN DEFAULT FALSE,
  reached_075     BOOLEAN DEFAULT FALSE,
  reached_100     BOOLEAN DEFAULT FALSE,
  duration_hours  NUMERIC,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bot_id, symbol, entry_time_utc)
);

CREATE INDEX IF NOT EXISTS idx_katarakti_trades_week ON katarakti_trades (week_anchor DESC);
CREATE INDEX IF NOT EXISTS idx_katarakti_trades_symbol ON katarakti_trades (symbol);
CREATE INDEX IF NOT EXISTS idx_katarakti_trades_entry ON katarakti_trades (entry_time_utc DESC);

-- Katarakti signal log (mirrors bitget_bot_signals pattern)
CREATE TABLE IF NOT EXISTS katarakti_signals (
  id                BIGSERIAL PRIMARY KEY,
  bot_id            TEXT NOT NULL DEFAULT 'katarakti_v1',
  week_anchor       DATE NOT NULL,
  symbol            VARCHAR(20) NOT NULL,
  asset_class       VARCHAR(20) NOT NULL,
  direction         VARCHAR(10) NOT NULL,
  signal_time_utc   TIMESTAMPTZ NOT NULL,
  session_window    VARCHAR(20) NOT NULL,
  ref_high          NUMERIC,
  ref_low           NUMERIC,
  sweep_price       NUMERIC,
  sweep_pct         NUMERIC,
  displacement_pct  NUMERIC,
  triggered_entry   BOOLEAN DEFAULT FALSE,
  filter_reason     VARCHAR(50),
  handshake_group_id INTEGER,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_katarakti_signals_week ON katarakti_signals (week_anchor DESC);
CREATE INDEX IF NOT EXISTS idx_katarakti_signals_symbol ON katarakti_signals (symbol);

-- Correlation matrix (shared between crypto and FX)
CREATE TABLE IF NOT EXISTS correlation_matrix (
  id              BIGSERIAL PRIMARY KEY,
  symbol_a        VARCHAR(20) NOT NULL,
  symbol_b        VARCHAR(20) NOT NULL,
  context         VARCHAR(10) NOT NULL DEFAULT 'fx',
  lookback_hours  INTEGER NOT NULL,
  correlation     NUMERIC(6,4) NOT NULL,
  sample_size     INTEGER NOT NULL,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (symbol_a, symbol_b, lookback_hours, computed_at)
);

CREATE INDEX IF NOT EXISTS idx_corr_matrix_computed ON correlation_matrix (computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_corr_matrix_symbols ON correlation_matrix (symbol_a, symbol_b);
CREATE INDEX IF NOT EXISTS idx_corr_matrix_context ON correlation_matrix (context, computed_at DESC);

-- Katarakti weekly bias snapshot (frozen at week start)
CREATE TABLE IF NOT EXISTS katarakti_weekly_bias (
  id              BIGSERIAL PRIMARY KEY,
  bot_id          TEXT NOT NULL DEFAULT 'katarakti_v1',
  week_anchor     DATE NOT NULL,
  symbol          VARCHAR(20) NOT NULL,
  asset_class     VARCHAR(20) NOT NULL,
  bias_system     VARCHAR(30) NOT NULL,
  direction       VARCHAR(10) NOT NULL,
  tier            VARCHAR(10),
  risk_pct        NUMERIC NOT NULL DEFAULT 1.0,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bot_id, week_anchor, symbol, bias_system)
);

CREATE INDEX IF NOT EXISTS idx_katarakti_bias_week ON katarakti_weekly_bias (week_anchor DESC);
