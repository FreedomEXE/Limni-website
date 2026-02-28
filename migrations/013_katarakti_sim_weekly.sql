-- Migration 013: Katarakti simulation weekly results
-- Stores weekly percent-return results from backtests, paper trading, or manual entry.
-- Decoupled from bot connectivity — performance updates regardless of live bot state.

CREATE TABLE IF NOT EXISTS katarakti_sim_weekly (
  id            SERIAL PRIMARY KEY,
  market        TEXT NOT NULL CHECK (market IN ('crypto_futures', 'mt5_forex')),
  week_open_utc TIMESTAMPTZ NOT NULL,
  return_pct    DOUBLE PRECISION NOT NULL,
  trades        INT NOT NULL DEFAULT 0,
  wins          INT NOT NULL DEFAULT 0,
  losses        INT NOT NULL DEFAULT 0,
  static_drawdown_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  gross_profit_pct    DOUBLE PRECISION NOT NULL DEFAULT 0,
  gross_loss_pct      DOUBLE PRECISION NOT NULL DEFAULT 0,
  source        TEXT NOT NULL DEFAULT 'manual',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (market, week_open_utc)
);

CREATE INDEX IF NOT EXISTS idx_katarakti_sim_weekly_market
  ON katarakti_sim_weekly (market, week_open_utc DESC);
