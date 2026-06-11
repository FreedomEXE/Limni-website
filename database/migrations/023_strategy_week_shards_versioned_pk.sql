-- Add engine_version to the primary key so multiple shard versions coexist.
-- Old version shards remain queryable while a new version builds incrementally.

ALTER TABLE strategy_week_shards
  DROP CONSTRAINT IF EXISTS strategy_week_shards_pkey;

ALTER TABLE strategy_week_shards
  ADD PRIMARY KEY (selection_key, week_open_utc, engine_version);

CREATE INDEX IF NOT EXISTS idx_strategy_week_shards_version
  ON strategy_week_shards (selection_key, engine_version);
