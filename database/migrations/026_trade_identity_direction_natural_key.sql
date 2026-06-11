DROP INDEX IF EXISTS idx_trades_natural_key;

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
