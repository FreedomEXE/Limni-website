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
