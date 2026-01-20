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
ALTER TABLE cot_snapshots
  ADD CONSTRAINT cot_snapshots_report_date_asset_variant_key UNIQUE (report_date, asset_class, variant);

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
ALTER TABLE market_snapshots
  ADD CONSTRAINT market_snapshots_week_open_asset_key UNIQUE (week_open_utc, asset_class);

CREATE INDEX IF NOT EXISTS idx_market_snapshots_week ON market_snapshots(week_open_utc DESC);
CREATE INDEX IF NOT EXISTS idx_market_snapshots_asset_week ON market_snapshots(asset_class, week_open_utc DESC);

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
CREATE TRIGGER update_mt5_accounts_updated_at BEFORE UPDATE ON mt5_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mt5_positions_updated_at BEFORE UPDATE ON mt5_positions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
