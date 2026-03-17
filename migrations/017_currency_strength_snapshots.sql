CREATE TABLE IF NOT EXISTS currency_strength_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_time_utc TIMESTAMP NOT NULL,
  "window" VARCHAR(10) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  raw_strength NUMERIC(10,6) NOT NULL,
  normalized_strength NUMERIC(6,2) NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'OANDA',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cs_snapshot_time
  ON currency_strength_snapshots (snapshot_time_utc DESC);

CREATE INDEX IF NOT EXISTS idx_cs_currency_window
  ON currency_strength_snapshots (currency, "window", snapshot_time_utc DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cs_unique_snapshot
  ON currency_strength_snapshots (snapshot_time_utc, "window", currency);

