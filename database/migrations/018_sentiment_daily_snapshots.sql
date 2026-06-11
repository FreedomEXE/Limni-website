CREATE TABLE IF NOT EXISTS sentiment_daily_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_date_utc DATE NOT NULL,
  snapshot_time_utc TIMESTAMP NOT NULL,
  symbol VARCHAR(16) NOT NULL,
  agg_long_pct NUMERIC(6,2) NOT NULL,
  agg_short_pct NUMERIC(6,2) NOT NULL,
  agg_net NUMERIC(8,4) NOT NULL,
  confidence_score NUMERIC(6,3) NOT NULL,
  crowding_state VARCHAR(32) NOT NULL,
  flip_state VARCHAR(32) NOT NULL,
  sentiment_direction VARCHAR(16) NOT NULL,
  source_mode VARCHAR(32) NOT NULL DEFAULT 'DAILY_LOCK_FROM_AGG',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sent_daily_date
  ON sentiment_daily_snapshots (snapshot_date_utc DESC);

CREATE INDEX IF NOT EXISTS idx_sent_daily_symbol_date
  ON sentiment_daily_snapshots (symbol, snapshot_date_utc DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sent_daily_unique
  ON sentiment_daily_snapshots (snapshot_date_utc, symbol);
