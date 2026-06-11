CREATE TABLE IF NOT EXISTS menthorq_overlay_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_date_utc DATE NOT NULL,
  symbol VARCHAR(16) NOT NULL,
  gamma_condition VARCHAR(16) NOT NULL,
  net_gex_text VARCHAR(64),
  total_gex_text VARCHAR(64),
  timestamp_text VARCHAR(128),
  source_url TEXT,
  captured_at_utc TIMESTAMP,
  parse_confidence VARCHAR(16),
  notes TEXT,
  source_mode VARCHAR(32) NOT NULL DEFAULT 'MENTHORQ_BROWSER_CAPTURE',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mq_overlay_date
  ON menthorq_overlay_snapshots (snapshot_date_utc DESC);

CREATE INDEX IF NOT EXISTS idx_mq_overlay_symbol_date
  ON menthorq_overlay_snapshots (symbol, snapshot_date_utc DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mq_overlay_unique
  ON menthorq_overlay_snapshots (snapshot_date_utc, symbol);
