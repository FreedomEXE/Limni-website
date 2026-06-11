/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: 022_canonical_price_layer.sql
 * Description: Adds the canonical instrument, raw bar, canonical bar, and derived pair return tables.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

CREATE TABLE IF NOT EXISTS instrument_registry (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  asset_class TEXT NOT NULL,
  primary_provider TEXT NOT NULL,
  oanda_instrument TEXT,
  bitget_base_coin TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS raw_price_bars (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_symbol TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  bar_open_utc TIMESTAMPTZ NOT NULL,
  bar_close_utc TIMESTAMPTZ NOT NULL,
  open_price DOUBLE PRECISION NOT NULL,
  high_price DOUBLE PRECISION NOT NULL,
  low_price DOUBLE PRECISION NOT NULL,
  close_price DOUBLE PRECISION NOT NULL,
  volume DOUBLE PRECISION,
  is_final BOOLEAN NOT NULL DEFAULT TRUE,
  source_batch_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_symbol, timeframe, bar_open_utc)
);

CREATE INDEX IF NOT EXISTS idx_raw_price_bars_lookup
  ON raw_price_bars (provider, provider_symbol, timeframe, bar_open_utc DESC);

CREATE TABLE IF NOT EXISTS canonical_price_bars (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  bar_open_utc TIMESTAMPTZ NOT NULL,
  bar_close_utc TIMESTAMPTZ NOT NULL,
  open_price DOUBLE PRECISION NOT NULL,
  high_price DOUBLE PRECISION NOT NULL,
  low_price DOUBLE PRECISION NOT NULL,
  close_price DOUBLE PRECISION NOT NULL,
  source_provider TEXT NOT NULL,
  quality_status TEXT NOT NULL DEFAULT 'verified',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (symbol, timeframe, bar_open_utc)
);

CREATE INDEX IF NOT EXISTS idx_canonical_price_bars_lookup
  ON canonical_price_bars (symbol, timeframe, bar_open_utc DESC);

CREATE INDEX IF NOT EXISTS idx_canonical_price_bars_asset_timeframe
  ON canonical_price_bars (asset_class, timeframe, bar_open_utc DESC);

CREATE TABLE IF NOT EXISTS pair_period_returns (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  period_type TEXT NOT NULL,
  period_open_utc TIMESTAMPTZ NOT NULL,
  period_close_utc TIMESTAMPTZ NOT NULL,
  open_price DOUBLE PRECISION NOT NULL,
  close_price DOUBLE PRECISION NOT NULL,
  high_price DOUBLE PRECISION,
  low_price DOUBLE PRECISION,
  return_pct DOUBLE PRECISION NOT NULL,
  source TEXT NOT NULL,
  derived_from_timeframe TEXT NOT NULL,
  derivation_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (symbol, asset_class, period_type, period_open_utc)
);

CREATE INDEX IF NOT EXISTS idx_pair_period_returns_lookup
  ON pair_period_returns (symbol, period_type, period_open_utc DESC);

CREATE INDEX IF NOT EXISTS idx_pair_period_returns_asset_period
  ON pair_period_returns (asset_class, period_type, period_open_utc DESC);
