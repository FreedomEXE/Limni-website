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
CREATE TRIGGER update_mt5_accounts_updated_at BEFORE UPDATE ON mt5_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mt5_positions_updated_at BEFORE UPDATE ON mt5_positions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_connected_accounts_updated_at BEFORE UPDATE ON connected_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
