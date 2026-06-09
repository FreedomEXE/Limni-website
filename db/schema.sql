-- Limni Trading Dashboard Database Schema

-- MT5 Accounts (current state)
CREATE TABLE IF NOT EXISTS mt5_accounts (
  account_id VARCHAR(50) PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  broker VARCHAR(100),
  server VARCHAR(100),
  status VARCHAR(20),
  currency VARCHAR(10) DEFAULT 'USD',
  equity DECIMAL(12, 2) DEFAULT 0,
  balance DECIMAL(12, 2) DEFAULT 0,
  margin DECIMAL(12, 2) DEFAULT 0,
  free_margin DECIMAL(12, 2) DEFAULT 0,
  basket_state VARCHAR(20),
  open_positions INTEGER DEFAULT 0,
  open_pairs INTEGER DEFAULT 0,
  total_lots DECIMAL(10, 2) DEFAULT 0,
  baseline_equity DECIMAL(12, 2) DEFAULT 0,
  locked_profit_pct DECIMAL(6, 2) DEFAULT 0,
  basket_pnl_pct DECIMAL(6, 2) DEFAULT 0,
  weekly_pnl_pct DECIMAL(6, 2) DEFAULT 0,
  risk_used_pct DECIMAL(6, 2) DEFAULT 0,
  trade_count_week INTEGER DEFAULT 0,
  win_rate_pct DECIMAL(6, 2) DEFAULT 0,
  max_drawdown_pct DECIMAL(6, 2) DEFAULT 0,
  report_date VARCHAR(20),
  api_ok BOOLEAN DEFAULT FALSE,
  trading_allowed BOOLEAN DEFAULT FALSE,
  last_api_error TEXT,
  next_add_seconds INTEGER DEFAULT -1,
  next_poll_seconds INTEGER DEFAULT -1,
  last_sync_utc TIMESTAMP NOT NULL DEFAULT NOW(),
  trade_mode VARCHAR(12) DEFAULT 'AUTO',
  lot_map JSONB,
  lot_map_updated_utc TIMESTAMP,
  recent_logs JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Broker Profiles (reusable symbol specs + compliance rules)
CREATE TABLE IF NOT EXISTS broker_profiles (
  profile_id VARCHAR(64) PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  broker VARCHAR(100),
  server VARCHAR(100),
  account_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  symbol_specs JSONB NOT NULL DEFAULT '[]'::jsonb,
  sl_compliance_mode VARCHAR(30) NOT NULL DEFAULT 'none',
  sl_cap_pct_of_nominal DECIMAL(6, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  exported_utc TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broker_profiles_label ON broker_profiles(label);
CREATE INDEX IF NOT EXISTS idx_broker_profiles_broker_server ON broker_profiles(broker, server);

-- MT5 Positions (current open positions)
CREATE TABLE IF NOT EXISTS mt5_positions (
  id SERIAL PRIMARY KEY,
  account_id VARCHAR(50) NOT NULL REFERENCES mt5_accounts(account_id) ON DELETE CASCADE,
  ticket BIGINT NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  type VARCHAR(10) NOT NULL,
  lots DECIMAL(10, 2) NOT NULL,
  open_price DECIMAL(12, 5) NOT NULL,
  current_price DECIMAL(12, 5) NOT NULL,
  stop_loss DECIMAL(12, 5) DEFAULT 0,
  take_profit DECIMAL(12, 5) DEFAULT 0,
  profit DECIMAL(12, 2) DEFAULT 0,
  swap DECIMAL(12, 2) DEFAULT 0,
  commission DECIMAL(12, 2) DEFAULT 0,
  open_time TIMESTAMP NOT NULL,
  magic_number BIGINT,
  comment TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(account_id, ticket)
);

-- MT5 Historical Snapshots (for tracking over time)
CREATE TABLE IF NOT EXISTS mt5_snapshots (
  id SERIAL PRIMARY KEY,
  account_id VARCHAR(50) NOT NULL REFERENCES mt5_accounts(account_id) ON DELETE CASCADE,
  equity DECIMAL(12, 2),
  balance DECIMAL(12, 2),
  open_positions INTEGER,
  basket_pnl_pct DECIMAL(6, 2),
  weekly_pnl_pct DECIMAL(6, 2),
  snapshot_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mt5_snapshots_account_time ON mt5_snapshots(account_id, snapshot_at DESC);

-- MT5 Closed Positions (historical trade archive)
CREATE TABLE IF NOT EXISTS mt5_closed_positions (
  id SERIAL PRIMARY KEY,
  account_id VARCHAR(50) NOT NULL REFERENCES mt5_accounts(account_id) ON DELETE CASCADE,
  ticket BIGINT NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  type VARCHAR(10) NOT NULL,
  lots DECIMAL(10, 2) NOT NULL,
  open_price DECIMAL(12, 5) NOT NULL,
  close_price DECIMAL(12, 5) NOT NULL,
  profit DECIMAL(12, 2) DEFAULT 0,
  swap DECIMAL(12, 2) DEFAULT 0,
  commission DECIMAL(12, 2) DEFAULT 0,
  open_time TIMESTAMP NOT NULL,
  close_time TIMESTAMP NOT NULL,
  magic_number BIGINT,
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(account_id, ticket, close_time)
);

CREATE INDEX IF NOT EXISTS idx_mt5_closed_positions_account_time ON mt5_closed_positions(account_id, close_time DESC);

-- MT5 EA Change Log (manual notes per week)
CREATE TABLE IF NOT EXISTS mt5_change_log (
  id SERIAL PRIMARY KEY,
  week_open_utc TIMESTAMP NOT NULL,
  account_id VARCHAR(50),
  strategy VARCHAR(30),
  title VARCHAR(120) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mt5_change_log_week ON mt5_change_log(week_open_utc DESC);

-- COT Snapshots (weekly data)
CREATE TABLE IF NOT EXISTS cot_snapshots (
  id SERIAL PRIMARY KEY,
  report_date DATE NOT NULL,
  asset_class VARCHAR(20) NOT NULL DEFAULT 'fx',
  variant VARCHAR(20) DEFAULT 'FutOnly',
  currencies JSONB NOT NULL,
  pairs JSONB NOT NULL,
  fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE cot_snapshots
  ADD COLUMN IF NOT EXISTS asset_class VARCHAR(20) NOT NULL DEFAULT 'fx';
ALTER TABLE cot_snapshots
  ALTER COLUMN variant SET DEFAULT 'FutOnly';
ALTER TABLE cot_snapshots
  DROP CONSTRAINT IF EXISTS cot_snapshots_report_date_key;
ALTER TABLE cot_snapshots
  DROP CONSTRAINT IF EXISTS cot_snapshots_report_date_asset_variant_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cot_snapshots_report_date_asset_variant_key'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'cot_snapshots_report_date_asset_variant_key'
  ) THEN
    ALTER TABLE cot_snapshots
      ADD CONSTRAINT cot_snapshots_report_date_asset_variant_key UNIQUE (report_date, asset_class, variant);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cot_snapshots_date ON cot_snapshots(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_cot_snapshots_asset_date ON cot_snapshots(asset_class, report_date DESC);

-- Market Price Snapshots
CREATE TABLE IF NOT EXISTS market_snapshots (
  id SERIAL PRIMARY KEY,
  week_open_utc TIMESTAMP NOT NULL,
  asset_class VARCHAR(20) NOT NULL DEFAULT 'fx',
  pairs JSONB NOT NULL,
  last_refresh_utc TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE market_snapshots
  ADD COLUMN IF NOT EXISTS asset_class VARCHAR(20) NOT NULL DEFAULT 'fx';
ALTER TABLE market_snapshots
  DROP CONSTRAINT IF EXISTS market_snapshots_week_open_utc_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'market_snapshots_week_open_asset_key'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'market_snapshots_week_open_asset_key'
  ) THEN
    ALTER TABLE market_snapshots
      ADD CONSTRAINT market_snapshots_week_open_asset_key UNIQUE (week_open_utc, asset_class);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_market_snapshots_week ON market_snapshots(week_open_utc DESC);
CREATE INDEX IF NOT EXISTS idx_market_snapshots_asset_week ON market_snapshots(asset_class, week_open_utc DESC);

-- Solana Meme Regime Daily Snapshots
CREATE TABLE IF NOT EXISTS solana_meme_regime_daily (
  day_utc DATE PRIMARY KEY,
  sol_price DECIMAL(18, 6),
  sol_change_24h DECIMAL(10, 4),
  sol_change_7d DECIMAL(10, 4),
  meme_volume_1h DECIMAL(20, 2),
  meme_change_1h DECIMAL(10, 4),
  meme_change_6h DECIMAL(10, 4),
  meme_mcap_median DECIMAL(20, 2),
  meme_holders_median DECIMAL(12, 2),
  sample_tokens INTEGER DEFAULT 0,
  label VARCHAR(12) NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sol_meme_regime_day ON solana_meme_regime_daily(day_utc DESC);

-- Performance Lab Snapshots (weekly)
CREATE TABLE IF NOT EXISTS performance_snapshots (
  id SERIAL PRIMARY KEY,
  week_open_utc TIMESTAMP NOT NULL,
  asset_class VARCHAR(20) NOT NULL DEFAULT 'fx',
  model VARCHAR(20) NOT NULL,
  report_date DATE,
  percent DECIMAL(10, 4) NOT NULL DEFAULT 0,
  priced INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  returns JSONB NOT NULL,
  pair_details JSONB NOT NULL,
  stats JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE performance_snapshots
  DROP CONSTRAINT IF EXISTS performance_snapshots_week_asset_model_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'performance_snapshots_week_asset_model_key'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'performance_snapshots_week_asset_model_key'
  ) THEN
    ALTER TABLE performance_snapshots
      ADD CONSTRAINT performance_snapshots_week_asset_model_key UNIQUE (week_open_utc, asset_class, model);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_performance_snapshots_week ON performance_snapshots(week_open_utc DESC);
CREATE INDEX IF NOT EXISTS idx_performance_snapshots_asset_week ON performance_snapshots(asset_class, week_open_utc DESC);
CREATE INDEX IF NOT EXISTS idx_performance_snapshots_model_week ON performance_snapshots(model, week_open_utc DESC);

-- Sentiment Data
CREATE TABLE IF NOT EXISTS sentiment_data (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  long_pct DECIMAL(6, 2),
  short_pct DECIMAL(6, 2),
  net DECIMAL(6, 2),
  ratio DECIMAL(8, 2),
  raw_payload JSONB,
  fetch_latency_ms INTEGER,
  timestamp_utc TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE sentiment_data
  ADD COLUMN IF NOT EXISTS net DECIMAL(6, 2);
ALTER TABLE sentiment_data
  ADD COLUMN IF NOT EXISTS ratio DECIMAL(8, 2);
ALTER TABLE sentiment_data
  ADD COLUMN IF NOT EXISTS raw_payload JSONB;
ALTER TABLE sentiment_data
  ADD COLUMN IF NOT EXISTS fetch_latency_ms INTEGER;

CREATE INDEX IF NOT EXISTS idx_sentiment_symbol_time ON sentiment_data(symbol, timestamp_utc DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_provider_time ON sentiment_data(provider, timestamp_utc DESC);

-- Sentiment Aggregates (pre-computed)
CREATE TABLE IF NOT EXISTS sentiment_aggregates (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  agg_long_pct DECIMAL(6, 2),
  agg_short_pct DECIMAL(6, 2),
  agg_net DECIMAL(6, 2),
  sources_used TEXT[],
  confidence_score DECIMAL(4, 2),
  crowding_state VARCHAR(20),
  flip_state VARCHAR(20),
  timestamp_utc TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentiment_agg_symbol_time ON sentiment_aggregates(symbol, timestamp_utc DESC);

-- Bot State (for Render workers)
CREATE TABLE IF NOT EXISTS bot_states (
  bot_id VARCHAR(64) PRIMARY KEY,
  state JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Poseidon Runtime KV State
CREATE TABLE IF NOT EXISTS poseidon_kv (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO poseidon_kv (key, value) VALUES
  ('session_state', ''),
  ('conversations', '[]'),
  ('behavior', '{}'),
  ('missed_turns', '[]'),
  ('curation_flag', '{}')
ON CONFLICT (key) DO NOTHING;

-- Research Lab Runs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS research_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_json JSONB NOT NULL,
  config_hash TEXT NOT NULL,
  result_json JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'complete',
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_research_runs_config_hash
  ON research_runs(config_hash);

CREATE INDEX IF NOT EXISTS idx_research_runs_created_at
  ON research_runs(created_at DESC);

-- Connected Broker Accounts (server-managed)
CREATE TABLE IF NOT EXISTS connected_accounts (
  account_key VARCHAR(64) PRIMARY KEY,
  provider VARCHAR(20) NOT NULL,
  account_id VARCHAR(64),
  label VARCHAR(120),
  status VARCHAR(20) DEFAULT 'READY',
  bot_type VARCHAR(30) NOT NULL,
  risk_mode VARCHAR(20) DEFAULT '1:1',
  trail_mode VARCHAR(20) DEFAULT 'trail',
  trail_start_pct DECIMAL(6, 2) DEFAULT 20,
  trail_offset_pct DECIMAL(6, 2) DEFAULT 10,
  config JSONB,
  secrets JSONB,
  analysis JSONB,
  last_sync_utc TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connected_accounts_provider
  ON connected_accounts(provider);

CREATE INDEX IF NOT EXISTS idx_connected_accounts_status
  ON connected_accounts(status);

-- MT5 Client Licenses (for distributable EX5 locking)
CREATE TABLE IF NOT EXISTS mt5_client_licenses (
  license_key VARCHAR(96) PRIMARY KEY,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  bound_account_id VARCHAR(64),
  bound_server VARCHAR(120),
  bound_broker VARCHAR(120),
  notes TEXT,
  expires_at TIMESTAMP,
  bound_at TIMESTAMP,
  last_seen_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mt5_client_licenses_account
  ON mt5_client_licenses(bound_account_id);

-- Weekly News Snapshots (ForexFactory-based macro events)
CREATE TABLE IF NOT EXISTS news_weekly_snapshots (
  id SERIAL PRIMARY KEY,
  week_open_utc TIMESTAMP NOT NULL,
  source VARCHAR(30) NOT NULL DEFAULT 'forexfactory',
  announcements JSONB NOT NULL DEFAULT '[]'::jsonb,
  calendar JSONB NOT NULL DEFAULT '[]'::jsonb,
  fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(week_open_utc, source)
);

CREATE INDEX IF NOT EXISTS idx_news_weekly_snapshots_week
  ON news_weekly_snapshots(week_open_utc DESC);

CREATE TABLE IF NOT EXISTS strength_weekly_snapshots (
  week_open_utc TIMESTAMP NOT NULL,
  source_type VARCHAR(20) NOT NULL,
  "window" VARCHAR(10) NOT NULL,
  "key" VARCHAR(30) NOT NULL,
  asset_class VARCHAR(20),
  raw_strength DECIMAL(12, 6),
  normalized_strength DECIMAL(12, 6),
  source_snapshot_utc TIMESTAMP,
  locked_at_utc TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (week_open_utc, source_type, "window", "key")
);

CREATE INDEX IF NOT EXISTS idx_strength_weekly_snapshots_week
  ON strength_weekly_snapshots(week_open_utc DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_mt5_accounts_updated_at ON mt5_accounts;
DROP TRIGGER IF EXISTS update_mt5_positions_updated_at ON mt5_positions;
DROP TRIGGER IF EXISTS update_connected_accounts_updated_at ON connected_accounts;
DROP TRIGGER IF EXISTS update_mt5_client_licenses_updated_at ON mt5_client_licenses;
CREATE TRIGGER update_mt5_accounts_updated_at BEFORE UPDATE ON mt5_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mt5_positions_updated_at BEFORE UPDATE ON mt5_positions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_connected_accounts_updated_at BEFORE UPDATE ON connected_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mt5_client_licenses_updated_at BEFORE UPDATE ON mt5_client_licenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Katarakti sweep-entry system tables ──────────────────

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

-- Katarakti simulation weekly results (bot-independent performance tracking)
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
  anchor_type TEXT NOT NULL DEFAULT 'canonical' CHECK (anchor_type IN ('canonical', 'execution')),
  anchor_version TEXT NOT NULL DEFAULT 'canonical_weekly_v2',
  window_open_utc TIMESTAMPTZ,
  window_close_utc TIMESTAMPTZ,
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
  UNIQUE (symbol, asset_class, period_type, period_open_utc, anchor_type, anchor_version)
);

CREATE INDEX IF NOT EXISTS idx_pair_period_returns_lookup
  ON pair_period_returns (symbol, period_type, period_open_utc DESC);

CREATE INDEX IF NOT EXISTS idx_pair_period_returns_asset_period
  ON pair_period_returns (asset_class, period_type, period_open_utc DESC);

CREATE INDEX IF NOT EXISTS idx_pair_period_returns_anchor_period
  ON pair_period_returns (anchor_type, anchor_version, period_open_utc DESC);

CREATE TABLE IF NOT EXISTS strategy_artifacts (
  selection_key TEXT PRIMARY KEY,
  cached_at_utc TIMESTAMPTZ NOT NULL,
  fingerprint_json JSONB NOT NULL,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strategy_artifacts_updated_at
  ON strategy_artifacts (updated_at DESC);

CREATE TABLE IF NOT EXISTS strategy_week_shards (
  selection_key TEXT NOT NULL,
  week_open_utc TIMESTAMPTZ NOT NULL,
  engine_version TEXT NOT NULL,
  week_fingerprint TEXT NOT NULL,
  week_result_json JSONB NOT NULL,
  path_summary_json JSONB NOT NULL,
  sim_json JSONB NOT NULL,
  cached_at_utc TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (selection_key, week_open_utc, engine_version)
);

CREATE INDEX IF NOT EXISTS idx_strategy_week_shards_updated_at
  ON strategy_week_shards (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_strategy_week_shards_version
  ON strategy_week_shards (selection_key, engine_version);

CREATE TABLE IF NOT EXISTS trades (
  trade_id UUID NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('backtest','simulation','live','research')),
  strategy_family TEXT NOT NULL,
  strategy_variant TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  anchor_type TEXT NOT NULL CHECK (anchor_type IN ('canonical','execution')),
  anchor_version TEXT NOT NULL,
  symbol TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  direction TEXT CHECK (direction IN ('LONG','SHORT')),
  source_model TEXT,
  tier INTEGER,
  week_open_utc TIMESTAMPTZ NOT NULL,
  entry_utc TIMESTAMPTZ,
  exit_utc TIMESTAMPTZ,
  entry_price NUMERIC(20,8),
  exit_price NUMERIC(20,8),
  raw_pct NUMERIC(12,6),
  adr_normalized_pct NUMERIC(12,6),
  adr_pct NUMERIC(12,6),
  weight NUMERIC(12,6),
  exit_reason TEXT,
  parent_trade_id UUID,
  fill_seq INTEGER,
  active_fills_at_entry INTEGER,
  cap_threshold_at_entry INTEGER,
  cap_violated BOOLEAN GENERATED ALWAYS AS (
    active_fills_at_entry IS NOT NULL
    AND cap_threshold_at_entry IS NOT NULL
    AND active_fills_at_entry >= cap_threshold_at_entry
  ) STORED,
  live_trade_id TEXT,
  warnings JSONB,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (trade_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_natural_key
  ON trades (
    origin,
    strategy_family,
    strategy_variant,
    engine_version,
    anchor_type,
    anchor_version,
    symbol,
    COALESCE(direction, ''),
    week_open_utc,
    COALESCE(source_model, ''),
    COALESCE(tier, -1),
    COALESCE(parent_trade_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(fill_seq, -1)
  );

CREATE INDEX IF NOT EXISTS idx_trades_origin_strategy_week
  ON trades (origin, strategy_family, strategy_variant, week_open_utc DESC);

CREATE INDEX IF NOT EXISTS idx_trades_symbol_week_anchor
  ON trades (symbol, week_open_utc, anchor_type);

CREATE INDEX IF NOT EXISTS idx_trades_parent
  ON trades (parent_trade_id) WHERE parent_trade_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trades_live
  ON trades (live_trade_id) WHERE live_trade_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trades_cap_violated
  ON trades (strategy_variant, week_open_utc DESC)
  WHERE cap_violated;

CREATE TABLE IF NOT EXISTS app_truth_scheduler_run_ledger (
  run_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  job_type TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  route_path TEXT NOT NULL,
  schedule TEXT,
  scheduled_at_utc TIMESTAMPTZ,
  started_at_utc TIMESTAMPTZ NOT NULL,
  completed_at_utc TIMESTAMPTZ,
  input_artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_inputs JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_inputs JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  namespace_produced TEXT,
  status TEXT NOT NULL,
  retry_policy TEXT,
  backfill_status TEXT,
  degraded_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_truth_scheduler_run_ledger_started
  ON app_truth_scheduler_run_ledger (started_at_utc DESC);

CREATE INDEX IF NOT EXISTS idx_app_truth_scheduler_run_ledger_job
  ON app_truth_scheduler_run_ledger (job_id, started_at_utc DESC);

CREATE TABLE IF NOT EXISTS app_truth_materialization_run_ledger (
  run_id TEXT PRIMARY KEY,
  scheduler_run_id TEXT,
  materialization_type TEXT NOT NULL,
  domain TEXT NOT NULL,
  baseline_id TEXT,
  week_window JSONB NOT NULL DEFAULT '[]'::jsonb,
  rows_touched INTEGER,
  input_artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  namespace_produced TEXT,
  status TEXT NOT NULL,
  missing_inputs JSONB NOT NULL DEFAULT '[]'::jsonb,
  degraded_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_hash TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at_utc TIMESTAMPTZ NOT NULL,
  completed_at_utc TIMESTAMPTZ NOT NULL,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_truth_materialization_run_ledger_completed
  ON app_truth_materialization_run_ledger (completed_at_utc DESC);

CREATE INDEX IF NOT EXISTS idx_app_truth_materialization_run_ledger_type
  ON app_truth_materialization_run_ledger (materialization_type, completed_at_utc DESC);
