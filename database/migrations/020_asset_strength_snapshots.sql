CREATE TABLE IF NOT EXISTS asset_strength_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_time_utc TIMESTAMP NOT NULL,
  asset_class VARCHAR(16) NOT NULL,
  "window" VARCHAR(10) NOT NULL,
  asset VARCHAR(10) NOT NULL,
  raw_strength NUMERIC(12,6) NOT NULL,
  normalized_strength NUMERIC(6,2) NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'OANDA',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_as_snapshot_time
  ON asset_strength_snapshots (snapshot_time_utc DESC);

CREATE INDEX IF NOT EXISTS idx_as_asset_class_window
  ON asset_strength_snapshots (asset_class, "window", snapshot_time_utc DESC);

CREATE INDEX IF NOT EXISTS idx_as_asset_window
  ON asset_strength_snapshots (asset, "window", snapshot_time_utc DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_as_unique_snapshot
  ON asset_strength_snapshots (snapshot_time_utc, "window", asset);
