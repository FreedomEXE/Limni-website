--/*-----------------------------------------------
--  Property of Freedom_EXE  (c) 2026
------------------------------------------------*/
-- Migration: 007_market_data_snapshots.sql
-- Description: Hourly market funding/OI/liquidation snapshot storage.

-- Hourly funding rate snapshots
CREATE TABLE IF NOT EXISTS market_funding_snapshots (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  funding_rate NUMERIC NOT NULL,
  next_funding_time TIMESTAMPTZ,
  snapshot_time_utc TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL DEFAULT 'bitget',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (symbol, snapshot_time_utc, source)
);

-- Hourly open interest snapshots
CREATE TABLE IF NOT EXISTS market_oi_snapshots (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  open_interest NUMERIC NOT NULL,
  price_at_snapshot NUMERIC,
  snapshot_time_utc TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL DEFAULT 'bitget',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (symbol, snapshot_time_utc, source)
);

-- Liquidation summary snapshots (from CoinAnk)
CREATE TABLE IF NOT EXISTS market_liquidation_snapshots (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  total_long_usd NUMERIC NOT NULL,
  total_short_usd NUMERIC NOT NULL,
  dominant_side TEXT NOT NULL,
  reference_price NUMERIC,
  largest_above_price NUMERIC,
  largest_above_notional NUMERIC,
  largest_below_price NUMERIC,
  largest_below_notional NUMERIC,
  clusters_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  snapshot_time_utc TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL DEFAULT 'coinank',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (symbol, snapshot_time_utc, source)
);

CREATE INDEX IF NOT EXISTS idx_funding_snapshots_symbol_time
  ON market_funding_snapshots (symbol, snapshot_time_utc DESC);
CREATE INDEX IF NOT EXISTS idx_oi_snapshots_symbol_time
  ON market_oi_snapshots (symbol, snapshot_time_utc DESC);
CREATE INDEX IF NOT EXISTS idx_liquidation_snapshots_symbol_time
  ON market_liquidation_snapshots (symbol, snapshot_time_utc DESC);
