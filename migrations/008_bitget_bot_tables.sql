/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: 008_bitget_bot_tables.sql
 *
 * Description:
 * Migration for Bitget Bot v2 operational persistence tables, including
 * trades, ranges, signal tracking, and dry-run audit logging.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
-- Migration: 008_bitget_bot_tables.sql
-- Description: Operational tables for Bitget Bot v2 DRY_RUN/live execution.
--
-- IMPORTANT:
-- Apply migrations/007_market_data_snapshots.sql first.
-- This migration assumes snapshot infrastructure is already in place.

CREATE TABLE IF NOT EXISTS bitget_bot_trades (
  id BIGSERIAL PRIMARY KEY,
  bot_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  session_window TEXT NOT NULL,
  range_source TEXT NOT NULL,
  entry_time_utc TIMESTAMPTZ NOT NULL,
  entry_price NUMERIC NOT NULL,
  exit_time_utc TIMESTAMPTZ,
  exit_price NUMERIC,
  exit_reason TEXT,
  stop_price NUMERIC,
  initial_leverage NUMERIC NOT NULL,
  max_leverage_reached NUMERIC,
  milestones_hit JSONB NOT NULL DEFAULT '[]'::jsonb,
  freed_margin_usd NUMERIC NOT NULL DEFAULT 0,
  pnl_usd NUMERIC,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (strategy_id, symbol, entry_time_utc)
);

CREATE TABLE IF NOT EXISTS bitget_bot_ranges (
  id BIGSERIAL PRIMARY KEY,
  bot_id TEXT NOT NULL,
  day_utc DATE NOT NULL,
  symbol TEXT NOT NULL,
  range_source TEXT NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  locked_at_utc TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (day_utc, symbol, range_source)
);

CREATE TABLE IF NOT EXISTS bitget_bot_signals (
  id BIGSERIAL PRIMARY KEY,
  bot_id TEXT NOT NULL,
  day_utc DATE NOT NULL,
  symbol TEXT NOT NULL,
  session_window TEXT NOT NULL,
  confirm_time_utc TIMESTAMPTZ NOT NULL,
  direction TEXT NOT NULL,
  sweep_pct NUMERIC NOT NULL,
  displacement_pct NUMERIC NOT NULL,
  handshake_group_id TEXT,
  status TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bitget_bot_dry_run_log (
  id BIGSERIAL PRIMARY KEY,
  bot_id TEXT NOT NULL,
  tick_time_utc TIMESTAMPTZ NOT NULL,
  action TEXT NOT NULL,
  symbol TEXT,
  direction TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bitget_bot_trades_bot_time
  ON bitget_bot_trades (bot_id, entry_time_utc DESC);

CREATE INDEX IF NOT EXISTS idx_bitget_bot_trades_symbol_time
  ON bitget_bot_trades (symbol, entry_time_utc DESC);

CREATE INDEX IF NOT EXISTS idx_bitget_bot_signals_day_symbol
  ON bitget_bot_signals (day_utc, symbol);

CREATE INDEX IF NOT EXISTS idx_bitget_bot_ranges_day_symbol
  ON bitget_bot_ranges (day_utc, symbol);

CREATE INDEX IF NOT EXISTS idx_bitget_bot_dry_run_log_bot_time
  ON bitget_bot_dry_run_log (bot_id, tick_time_utc DESC);
