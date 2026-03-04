/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
-- File: 016_strategy_backtest_store.sql
-- Description: Canonical DB-first store for strategy backtest runs, weekly rows, and trades.
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

CREATE TABLE IF NOT EXISTS strategy_backtest_runs (
  id BIGSERIAL PRIMARY KEY,
  bot_id TEXT NOT NULL,
  variant TEXT NOT NULL,
  market TEXT NOT NULL,
  strategy_name TEXT,
  carry_mode TEXT,
  stop_mode TEXT,
  adr_multiplier DOUBLE PRECISION,
  universal_mode TEXT,
  backtest_weeks INT,
  offset_pct DOUBLE PRECISION,
  slot_mode TEXT,
  position_allocation_pct DOUBLE PRECISION,
  config_key TEXT NOT NULL DEFAULT 'default',
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bot_id, variant, market, config_key)
);

CREATE INDEX IF NOT EXISTS idx_strategy_backtest_runs_lookup
  ON strategy_backtest_runs (bot_id, variant, market, generated_utc DESC);

CREATE TABLE IF NOT EXISTS strategy_backtest_weekly (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES strategy_backtest_runs(id) ON DELETE CASCADE,
  week_open_utc TIMESTAMPTZ NOT NULL,
  return_pct DOUBLE PRECISION NOT NULL,
  trades INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  stop_hits INT NOT NULL DEFAULT 0,
  drawdown_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  gross_profit_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  gross_loss_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  equity_end_pct DOUBLE PRECISION,
  pnl_usd DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, week_open_utc)
);

CREATE INDEX IF NOT EXISTS idx_strategy_backtest_weekly_run_week
  ON strategy_backtest_weekly (run_id, week_open_utc);

CREATE TABLE IF NOT EXISTS strategy_backtest_trades (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES strategy_backtest_runs(id) ON DELETE CASCADE,
  week_open_utc TIMESTAMPTZ NOT NULL,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  entry_time_utc TIMESTAMPTZ,
  exit_time_utc TIMESTAMPTZ,
  entry_price DOUBLE PRECISION,
  exit_price DOUBLE PRECISION,
  pnl_pct DOUBLE PRECISION,
  pnl_usd DOUBLE PRECISION,
  exit_reason TEXT,
  max_milestone INT,
  leverage_at_exit DOUBLE PRECISION,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strategy_backtest_trades_run_week
  ON strategy_backtest_trades (run_id, week_open_utc);

CREATE INDEX IF NOT EXISTS idx_strategy_backtest_trades_symbol
  ON strategy_backtest_trades (symbol);
