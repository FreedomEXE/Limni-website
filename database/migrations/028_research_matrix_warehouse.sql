CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS research_matrix_datasets (
  dataset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_version TEXT NOT NULL,
  dataset_hash TEXT NOT NULL UNIQUE,
  asset_class TEXT NOT NULL,
  from_utc TIMESTAMPTZ NOT NULL,
  to_utc TIMESTAMPTZ NOT NULL,
  universe JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
  execution_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
  coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'building',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_research_matrix_datasets_range
  ON research_matrix_datasets (asset_class, from_utc, to_utc);

CREATE TABLE IF NOT EXISTS research_matrix_source_contexts (
  dataset_id UUID NOT NULL REFERENCES research_matrix_datasets(dataset_id) ON DELETE CASCADE,
  week_open_utc TIMESTAMPTZ NOT NULL,
  symbol TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  dealer_direction TEXT NOT NULL,
  commercial_direction TEXT NOT NULL,
  cot_faces_direction TEXT NOT NULL,
  commercial_delta_cot_direction TEXT NOT NULL,
  friday_strength_direction TEXT NOT NULL,
  market_open_strength_direction TEXT NOT NULL,
  source_timestamps JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (dataset_id, week_open_utc, symbol)
);

CREATE INDEX IF NOT EXISTS idx_research_matrix_source_contexts_symbol
  ON research_matrix_source_contexts (dataset_id, symbol, week_open_utc);

CREATE TABLE IF NOT EXISTS research_matrix_trade_opportunities (
  dataset_id UUID NOT NULL REFERENCES research_matrix_datasets(dataset_id) ON DELETE CASCADE,
  week_open_utc TIMESTAMPTZ NOT NULL,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  fill_seq INTEGER NOT NULL,
  component TEXT NOT NULL DEFAULT 'grid',
  entry_time_utc TIMESTAMPTZ NOT NULL,
  entry_price DOUBLE PRECISION NOT NULL,
  planned_exit_time_utc TIMESTAMPTZ,
  planned_exit_reason TEXT,
  planned_exit_price DOUBLE PRECISION,
  pair_adr_pct DOUBLE PRECISION NOT NULL,
  raw_return_pct DOUBLE PRECISION,
  adr_return DOUBLE PRECISION,
  mfe_adr DOUBLE PRECISION,
  mae_adr DOUBLE PRECISION,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (dataset_id, week_open_utc, symbol, direction, fill_seq, component)
);

CREATE INDEX IF NOT EXISTS idx_research_matrix_trade_opportunities_symbol
  ON research_matrix_trade_opportunities (dataset_id, symbol, week_open_utc);

CREATE TABLE IF NOT EXISTS research_matrix_variant_runs (
  variant_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES research_matrix_datasets(dataset_id) ON DELETE CASCADE,
  logic_version TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  variant_label TEXT NOT NULL,
  parameter_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_filter_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'building',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (dataset_id, logic_version, variant_id, result_hash)
);

CREATE INDEX IF NOT EXISTS idx_research_matrix_variant_runs_dataset
  ON research_matrix_variant_runs (dataset_id, logic_version, variant_id);

CREATE TABLE IF NOT EXISTS research_matrix_pair_decisions (
  variant_run_id UUID NOT NULL REFERENCES research_matrix_variant_runs(variant_run_id) ON DELETE CASCADE,
  week_open_utc TIMESTAMPTZ NOT NULL,
  symbol TEXT NOT NULL,
  selected_side TEXT,
  exclusion_reason TEXT,
  source_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (variant_run_id, week_open_utc, symbol)
);

CREATE INDEX IF NOT EXISTS idx_research_matrix_pair_decisions_reason
  ON research_matrix_pair_decisions (variant_run_id, exclusion_reason);

CREATE TABLE IF NOT EXISTS research_matrix_variant_week_results (
  variant_run_id UUID NOT NULL REFERENCES research_matrix_variant_runs(variant_run_id) ON DELETE CASCADE,
  week_open_utc TIMESTAMPTZ NOT NULL,
  selected_pair_sides INTEGER NOT NULL,
  fills DOUBLE PRECISION NOT NULL DEFAULT 0,
  final_adr DOUBLE PRECISION NOT NULL DEFAULT 0,
  final_raw_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  max_drawdown_adr DOUBLE PRECISION NOT NULL DEFAULT 0,
  max_drawdown_time_utc TIMESTAMPTZ,
  week_close_adr DOUBLE PRECISION NOT NULL DEFAULT 0,
  grid_tp_adr DOUBLE PRECISION NOT NULL DEFAULT 0,
  runner_adr DOUBLE PRECISION NOT NULL DEFAULT 0,
  stop_exit_adr DOUBLE PRECISION NOT NULL DEFAULT 0,
  basket_take_profit_exit_adr DOUBLE PRECISION NOT NULL DEFAULT 0,
  max_active_fills DOUBLE PRECISION NOT NULL DEFAULT 0,
  worst_pair TEXT,
  worst_pair_adr DOUBLE PRECISION,
  worst_currency TEXT,
  worst_currency_adr DOUBLE PRECISION,
  pair_contributions JSONB NOT NULL DEFAULT '{}'::jsonb,
  currency_contributions JSONB NOT NULL DEFAULT '{}'::jsonb,
  exit_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (variant_run_id, week_open_utc)
);

CREATE INDEX IF NOT EXISTS idx_research_matrix_variant_week_results_week
  ON research_matrix_variant_week_results (week_open_utc, variant_run_id);

CREATE TABLE IF NOT EXISTS research_matrix_trade_events (
  variant_run_id UUID NOT NULL REFERENCES research_matrix_variant_runs(variant_run_id) ON DELETE CASCADE,
  week_open_utc TIMESTAMPTZ NOT NULL,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  fill_seq INTEGER NOT NULL,
  component TEXT NOT NULL DEFAULT 'grid',
  entry_time_utc TIMESTAMPTZ NOT NULL,
  exit_time_utc TIMESTAMPTZ NOT NULL,
  exit_reason TEXT NOT NULL,
  entry_price DOUBLE PRECISION NOT NULL,
  exit_price DOUBLE PRECISION NOT NULL,
  pair_adr_pct DOUBLE PRECISION NOT NULL,
  raw_return_pct DOUBLE PRECISION NOT NULL,
  adr_return DOUBLE PRECISION NOT NULL,
  size_factor DOUBLE PRECISION NOT NULL DEFAULT 1,
  source_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  path_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (variant_run_id, week_open_utc, symbol, direction, fill_seq, component)
);

CREATE INDEX IF NOT EXISTS idx_research_matrix_trade_events_symbol
  ON research_matrix_trade_events (variant_run_id, symbol, week_open_utc);

CREATE INDEX IF NOT EXISTS idx_research_matrix_trade_events_exit
  ON research_matrix_trade_events (variant_run_id, exit_reason, week_open_utc);

CREATE TABLE IF NOT EXISTS research_matrix_stop_events (
  stop_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_run_id UUID NOT NULL REFERENCES research_matrix_variant_runs(variant_run_id) ON DELETE CASCADE,
  week_open_utc TIMESTAMPTZ NOT NULL,
  stop_type TEXT NOT NULL,
  symbol TEXT,
  direction TEXT,
  threshold_adr DOUBLE PRECISION NOT NULL,
  stop_time_utc TIMESTAMPTZ NOT NULL,
  trigger_adr DOUBLE PRECISION,
  active_closed_fills DOUBLE PRECISION NOT NULL DEFAULT 0,
  active_marked_adr DOUBLE PRECISION NOT NULL DEFAULT 0,
  active_original_adr DOUBLE PRECISION NOT NULL DEFAULT 0,
  active_delta_adr DOUBLE PRECISION NOT NULL DEFAULT 0,
  skipped_fills DOUBLE PRECISION NOT NULL DEFAULT 0,
  skipped_original_adr DOUBLE PRECISION NOT NULL DEFAULT 0,
  skipped_exit_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_matrix_stop_events_type
  ON research_matrix_stop_events (variant_run_id, stop_type, week_open_utc);
