CREATE TABLE IF NOT EXISTS strength_history_snapshots (
  snapshot_time_utc TIMESTAMPTZ NOT NULL,
  asset_class TEXT NOT NULL,
  source_type TEXT NOT NULL,
  "window" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  raw_strength DOUBLE PRECISION,
  normalized_strength DOUBLE PRECISION,
  coverage_expected_bars INTEGER NOT NULL,
  coverage_actual_bars INTEGER NOT NULL,
  coverage_pct DOUBLE PRECISION NOT NULL,
  contributing_pairs INTEGER NOT NULL,
  source_timeframe TEXT NOT NULL,
  source_provider TEXT NOT NULL,
  derivation_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (
    snapshot_time_utc,
    asset_class,
    source_type,
    "window",
    "key",
    derivation_version
  )
);

CREATE INDEX IF NOT EXISTS idx_strength_history_lookup
  ON strength_history_snapshots (
    asset_class,
    source_type,
    "window",
    "key",
    derivation_version,
    snapshot_time_utc DESC
  );

CREATE INDEX IF NOT EXISTS idx_strength_history_snapshot
  ON strength_history_snapshots (
    asset_class,
    derivation_version,
    snapshot_time_utc DESC
  );
