/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: 009_liquidation_heatmap_snapshots.sql
 *
 * Description:
 * Snapshot storage for forward-looking liquidation heatmap ladders used in
 * research/backtesting of dynamic entries, scaling milestones, and exits.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

-- Migration: 009_liquidation_heatmap_snapshots.sql
-- Description: Persist full liquidation heatmap snapshots (raw + derived).
--
-- IMPORTANT:
-- Apply migrations/007_market_data_snapshots.sql first.
-- This table complements (does not replace) market_liquidation_snapshots.

CREATE TABLE IF NOT EXISTS market_liquidation_heatmap_snapshots (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  interval TEXT NOT NULL,
  exchange_group TEXT NOT NULL,
  current_price NUMERIC NOT NULL,
  nodes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  bands_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  key_levels_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  aggregate_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot_time_utc TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL DEFAULT 'coinank',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (symbol, interval, exchange_group, snapshot_time_utc, source)
);

CREATE INDEX IF NOT EXISTS idx_liq_heatmap_symbol_time
  ON market_liquidation_heatmap_snapshots (symbol, snapshot_time_utc DESC);

CREATE INDEX IF NOT EXISTS idx_liq_heatmap_symbol_interval_group_time
  ON market_liquidation_heatmap_snapshots (symbol, interval, exchange_group, snapshot_time_utc DESC);

CREATE INDEX IF NOT EXISTS idx_liq_heatmap_snapshot_time
  ON market_liquidation_heatmap_snapshots (snapshot_time_utc DESC);
