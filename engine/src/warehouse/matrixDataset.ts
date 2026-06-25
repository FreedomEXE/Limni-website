import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import type { Submittable } from "pg";

import { query, transaction } from "@/lib/db";

const require = createRequire(import.meta.url);
type CopyFromStream = Submittable & NodeJS.WritableStream;
const copyFrom = (require("pg-copy-streams") as { from: (sql: string) => CopyFromStream }).from;

export const RESEARCH_MATRIX_DATASET_VERSION = "research_matrix_dataset_v1";
export const RESEARCH_MATRIX_LOGIC_VERSION = "fx_hedged_adr_grid_matrix_v1";

export type ResearchMatrixDirection = "LONG" | "SHORT" | "NEUTRAL" | "MISSING";

export type ResearchMatrixWarehouseTable =
  | "research_matrix_datasets"
  | "research_matrix_source_contexts"
  | "research_matrix_trade_opportunities"
  | "research_matrix_variant_runs"
  | "research_matrix_pair_decisions"
  | "research_matrix_variant_week_results"
  | "research_matrix_trade_events"
  | "research_matrix_stop_events";

export type ResearchMatrixQuestionSurface =
  | "source_model_comparison"
  | "strength_standalone"
  | "cot_variant_comparison"
  | "friday_vs_market_open_strength"
  | "entry_side_selection"
  | "take_profit_sensitivity"
  | "stop_loss_sensitivity"
  | "runner_sensitivity"
  | "grid_entry_quality"
  | "drawdown_attribution"
  | "pair_concentration"
  | "currency_concentration"
  | "regime_year_breakout"
  | "missed_opportunity"
  | "source_coverage";

export type ResearchMatrixDatasetIdentity = {
  datasetVersion: string;
  assetClass: "fx";
  fromUtc: string;
  toUtc: string;
  universe: string[];
  sourceVersions: Record<string, string>;
  executionVersions: Record<string, string>;
};

export type ResearchMatrixSourceContext = {
  weekOpenUtc: string;
  symbol: string;
  assetClass: "fx";
  dealerDirection: ResearchMatrixDirection;
  commercialDirection: ResearchMatrixDirection;
  cotFacesDirection: ResearchMatrixDirection;
  commercialDeltaCotDirection: ResearchMatrixDirection;
  fridayStrengthDirection: ResearchMatrixDirection;
  marketOpenStrengthDirection: ResearchMatrixDirection;
  sourceTimestamps: Record<string, string | null>;
  sourceScores: Record<string, number | null>;
  coverage: Record<string, number | boolean | string | null>;
  flags: Record<string, unknown>;
};

export type ResearchMatrixVariantDefinition = {
  logicVersion: string;
  variantId: string;
  variantLabel: string;
  parameters: Record<string, unknown>;
  sourceFilters: Record<string, unknown>;
};

export type ResearchMatrixDatasetRecord = {
  datasetId: string;
  datasetHash: string;
};

export type ResearchMatrixDatasetInput = ResearchMatrixDatasetIdentity & {
  datasetHash: string;
  coverage?: Record<string, unknown>;
  notes?: string[];
  status?: "building" | "complete";
};

export type ResearchMatrixTradeOpportunity = {
  weekOpenUtc: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  fillSeq: number;
  component: string;
  entryTimeUtc: string;
  entryPrice: number;
  plannedExitTimeUtc: string | null;
  plannedExitReason: string | null;
  plannedExitPrice: number | null;
  pairAdrPct: number;
  rawReturnPct: number | null;
  adrReturn: number | null;
  mfeAdr?: number | null;
  maeAdr?: number | null;
  metadata?: Record<string, unknown>;
};

export type ResearchMatrixVariantRunRecord = {
  variantRunId: string;
};

export type ResearchMatrixVariantRunInput = {
  definition: ResearchMatrixVariantDefinition;
  resultHash: string;
  status?: "building" | "complete";
};

export type ResearchMatrixVariantRunUpsertResult = {
  variantId: string;
  variantRunId: string;
};

export type ResearchMatrixPairDecision = {
  variantRunId: string;
  weekOpenUtc: string;
  symbol: string;
  selectedSide: string | null;
  exclusionReason: string | null;
  sourceState?: Record<string, unknown>;
  decisionScores?: Record<string, unknown>;
};

export type ResearchMatrixVariantWeekResult = {
  variantRunId: string;
  weekOpenUtc: string;
  selectedPairSides: number;
  fills: number;
  finalAdr: number;
  finalRawPct: number;
  maxDrawdownAdr: number;
  maxDrawdownTimeUtc: string | null;
  weekCloseAdr: number;
  gridTpAdr: number;
  runnerAdr: number;
  stopExitAdr: number;
  basketTakeProfitExitAdr: number;
  maxActiveFills: number;
  worstPair: string | null;
  worstPairAdr: number | null;
  worstCurrency: string | null;
  worstCurrencyAdr: number | null;
  pairContributions?: Record<string, number>;
  currencyContributions?: Record<string, number>;
  exitCounts?: Record<string, number>;
  metadata?: Record<string, unknown>;
};

export type ResearchMatrixTradeEvent = {
  variantRunId: string;
  weekOpenUtc: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  fillSeq: number;
  component: string;
  entryTimeUtc: string;
  exitTimeUtc: string;
  exitReason: string;
  entryPrice: number;
  exitPrice: number;
  pairAdrPct: number;
  rawReturnPct: number;
  adrReturn: number;
  sizeFactor: number;
  sourceState?: Record<string, unknown>;
  pathStats?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type ResearchMatrixStopEvent = {
  variantRunId: string;
  weekOpenUtc: string;
  stopType: string;
  symbol: string | null;
  direction: "LONG" | "SHORT" | null;
  thresholdAdr: number;
  stopTimeUtc: string;
  triggerAdr: number | null;
  activeClosedFills: number;
  activeMarkedAdr: number;
  activeOriginalAdr: number;
  activeDeltaAdr: number;
  skippedFills: number;
  skippedOriginalAdr: number;
  skippedExitCounts?: Record<string, number>;
  metadata?: Record<string, unknown>;
};

export type ResearchMatrixPersistCounts = {
  sourceContexts: number;
  tradeOpportunities: number;
  variantRuns: number;
  pairDecisions: number;
  variantWeekResults: number;
  tradeEvents: number;
  stopEvents: number;
};

export type ResearchMatrixRowEstimate = {
  weeks: number;
  pairs: number;
  variants: number;
  directionsPerPair: number;
  averageFillsPerPairSide: number;
  sourceContextRows: number;
  baseTradeOpportunityRows: number;
  pairDecisionRows: number;
  variantWeekRows: number;
  tradeEventRows: number;
};

export const RESEARCH_MATRIX_WAREHOUSE_TABLES: ResearchMatrixWarehouseTable[] = [
  "research_matrix_datasets",
  "research_matrix_source_contexts",
  "research_matrix_trade_opportunities",
  "research_matrix_variant_runs",
  "research_matrix_pair_decisions",
  "research_matrix_variant_week_results",
  "research_matrix_trade_events",
  "research_matrix_stop_events",
];

export const RESEARCH_MATRIX_QUESTION_SURFACES: ResearchMatrixQuestionSurface[] = [
  "source_model_comparison",
  "strength_standalone",
  "cot_variant_comparison",
  "friday_vs_market_open_strength",
  "entry_side_selection",
  "take_profit_sensitivity",
  "stop_loss_sensitivity",
  "runner_sensitivity",
  "grid_entry_quality",
  "drawdown_attribution",
  "pair_concentration",
  "currency_concentration",
  "regime_year_breakout",
  "missed_opportunity",
  "source_coverage",
];

export function estimateResearchMatrixWarehouseRows(options: {
  weeks: number;
  pairs: number;
  variants: number;
  directionsPerPair?: number;
  averageFillsPerPairSide?: number;
}): ResearchMatrixRowEstimate {
  const weeks = Math.max(0, Math.floor(options.weeks));
  const pairs = Math.max(0, Math.floor(options.pairs));
  const variants = Math.max(0, Math.floor(options.variants));
  const directionsPerPair = Math.max(1, Math.floor(options.directionsPerPair ?? 2));
  const averageFillsPerPairSide = Math.max(0, options.averageFillsPerPairSide ?? 8);
  const pairSides = pairs * directionsPerPair;
  const baseTradeOpportunityRows = Math.round(weeks * pairSides * averageFillsPerPairSide);

  return {
    weeks,
    pairs,
    variants,
    directionsPerPair,
    averageFillsPerPairSide,
    sourceContextRows: weeks * pairs,
    baseTradeOpportunityRows,
    pairDecisionRows: weeks * pairs * variants,
    variantWeekRows: weeks * variants,
    tradeEventRows: baseTradeOpportunityRows * variants,
  };
}

export const RESEARCH_MATRIX_WAREHOUSE_SCHEMA_SQL = `
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

ALTER TABLE research_matrix_variant_week_results
  ALTER COLUMN max_active_fills TYPE DOUBLE PRECISION USING max_active_fills::double precision;

ALTER TABLE research_matrix_stop_events
  ALTER COLUMN active_closed_fills TYPE DOUBLE PRECISION USING active_closed_fills::double precision,
  ALTER COLUMN skipped_fills TYPE DOUBLE PRECISION USING skipped_fills::double precision;
`;

const INSERT_CHUNK_SIZE = 500;
const BULK_JSON_CHUNK_SIZE = 20_000;

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, innerValue]) => [key, stableJsonValue(innerValue)]),
    );
  }
  return value;
}

function jsonParam(value: unknown) {
  return JSON.stringify(value ?? {});
}

function appendValues(params: unknown[], values: unknown[]) {
  const placeholders = values.map((value) => {
    params.push(value);
    return `$${params.length}`;
  });
  return `(${placeholders.join(", ")})`;
}

function chunkRows<T>(rows: T[], chunkSize = INSERT_CHUNK_SIZE) {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }
  return chunks;
}

function bulkJsonPayload(rows: unknown[]) {
  return JSON.stringify(rows);
}

function copyText(value: unknown) {
  if (value === null || value === undefined) return "\\N";
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\t/g, "\\t")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

function copyJson(value: unknown) {
  return copyText(JSON.stringify(value ?? {}));
}

function variantWeekKeyPayload(rows: Array<{ variantRunId: string; weekOpenUtc: string }>) {
  return bulkJsonPayload([...new Map(
    rows.map((row) => [`${row.variantRunId}::${row.weekOpenUtc}`, {
      variant_run_id: row.variantRunId,
      week_open_utc: row.weekOpenUtc,
    }]),
  ).values()]);
}

function tradeEventCopyLine(row: ResearchMatrixTradeEvent) {
  const scalarValues = [
    row.variantRunId,
    row.weekOpenUtc,
    row.symbol.toUpperCase(),
    row.direction,
    row.fillSeq,
    row.component,
    row.entryTimeUtc,
    row.exitTimeUtc,
    row.exitReason,
    row.entryPrice,
    row.exitPrice,
    row.pairAdrPct,
    row.rawReturnPct,
    row.adrReturn,
    row.sizeFactor,
  ].map(copyText);
  return [
    ...scalarValues,
    copyJson(row.sourceState),
    copyJson(row.pathStats),
    copyJson(row.metadata),
  ].join("\t") + "\n";
}

function pairDecisionCopyLine(row: ResearchMatrixPairDecision) {
  return [
    copyText(row.variantRunId),
    copyText(row.weekOpenUtc),
    copyText(row.symbol.toUpperCase()),
    copyText(row.selectedSide),
    copyText(row.exclusionReason),
    copyJson(row.sourceState),
    copyJson(row.decisionScores),
  ].join("\t") + "\n";
}

export function hashResearchMatrixPayload(payload: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(stableJsonValue(payload)))
    .digest("hex");
}

export async function ensureResearchMatrixWarehouseSchema() {
  await query(RESEARCH_MATRIX_WAREHOUSE_SCHEMA_SQL);
}

export async function upsertResearchMatrixDataset(
  input: ResearchMatrixDatasetInput,
): Promise<ResearchMatrixDatasetRecord> {
  const rows = await query<{ dataset_id: string }>(
    `
      INSERT INTO research_matrix_datasets (
        dataset_version,
        dataset_hash,
        asset_class,
        from_utc,
        to_utc,
        universe,
        source_versions,
        execution_versions,
        coverage,
        notes,
        status,
        completed_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4::timestamptz,
        $5::timestamptz,
        $6::jsonb,
        $7::jsonb,
        $8::jsonb,
        $9::jsonb,
        $10::text[],
        $11,
        CASE WHEN $11 = 'complete' THEN NOW() ELSE NULL END
      )
      ON CONFLICT (dataset_hash)
      DO UPDATE SET
        dataset_version = EXCLUDED.dataset_version,
        asset_class = EXCLUDED.asset_class,
        from_utc = EXCLUDED.from_utc,
        to_utc = EXCLUDED.to_utc,
        universe = EXCLUDED.universe,
        source_versions = EXCLUDED.source_versions,
        execution_versions = EXCLUDED.execution_versions,
        coverage = EXCLUDED.coverage,
        notes = EXCLUDED.notes,
        status = EXCLUDED.status,
        completed_at = EXCLUDED.completed_at
      RETURNING dataset_id
    `,
    [
      input.datasetVersion,
      input.datasetHash,
      input.assetClass,
      input.fromUtc,
      input.toUtc,
      JSON.stringify(input.universe),
      jsonParam(input.sourceVersions),
      jsonParam(input.executionVersions),
      jsonParam(input.coverage),
      input.notes ?? [],
      input.status ?? "building",
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("Failed to upsert research matrix dataset.");
  return { datasetId: row.dataset_id, datasetHash: input.datasetHash };
}

export async function markResearchMatrixDatasetComplete(datasetId: string) {
  await query(
    `
      UPDATE research_matrix_datasets
      SET status = 'complete',
        completed_at = NOW()
      WHERE dataset_id = $1::uuid
    `,
    [datasetId],
  );
}

export async function createResearchMatrixVariantRun(options: {
  datasetId: string;
  definition: ResearchMatrixVariantDefinition;
  resultHash: string;
  status?: "building" | "complete";
}): Promise<ResearchMatrixVariantRunRecord> {
  const rows = await query<{ variant_run_id: string }>(
    `
      INSERT INTO research_matrix_variant_runs (
        dataset_id,
        logic_version,
        variant_id,
        variant_label,
        parameter_json,
        source_filter_json,
        result_hash,
        status,
        completed_at
      )
      VALUES (
        $1::uuid,
        $2,
        $3,
        $4,
        $5::jsonb,
        $6::jsonb,
        $7,
        $8,
        CASE WHEN $8 = 'complete' THEN NOW() ELSE NULL END
      )
      ON CONFLICT (dataset_id, logic_version, variant_id, result_hash)
      DO UPDATE SET
        variant_label = EXCLUDED.variant_label,
        parameter_json = EXCLUDED.parameter_json,
        source_filter_json = EXCLUDED.source_filter_json,
        status = EXCLUDED.status,
        completed_at = EXCLUDED.completed_at
      RETURNING variant_run_id
    `,
    [
      options.datasetId,
      options.definition.logicVersion,
      options.definition.variantId,
      options.definition.variantLabel,
      jsonParam(options.definition.parameters),
      jsonParam(options.definition.sourceFilters),
      options.resultHash,
      options.status ?? "building",
    ],
  );
  const row = rows[0];
  if (!row) throw new Error(`Failed to create variant run for ${options.definition.variantId}.`);
  return { variantRunId: row.variant_run_id };
}

export async function createResearchMatrixVariantRuns(options: {
  datasetId: string;
  runs: ResearchMatrixVariantRunInput[];
}): Promise<ResearchMatrixVariantRunUpsertResult[]> {
  if (options.runs.length === 0) return [];
  const results: ResearchMatrixVariantRunUpsertResult[] = [];
  await transaction(async (client) => {
    for (const chunk of chunkRows(options.runs, BULK_JSON_CHUNK_SIZE)) {
      const payload = bulkJsonPayload(chunk.map((run) => ({
        dataset_id: options.datasetId,
        logic_version: run.definition.logicVersion,
        variant_id: run.definition.variantId,
        variant_label: run.definition.variantLabel,
        parameter_json: run.definition.parameters,
        source_filter_json: run.definition.sourceFilters,
        result_hash: run.resultHash,
        status: run.status ?? "building",
      })));
      const response = await client.query<{
        variant_id: string;
        variant_run_id: string;
      }>(
        `
          WITH incoming AS (
            SELECT *
            FROM jsonb_to_recordset($1::jsonb) AS row(
              dataset_id UUID,
              logic_version TEXT,
              variant_id TEXT,
              variant_label TEXT,
              parameter_json JSONB,
              source_filter_json JSONB,
              result_hash TEXT,
              status TEXT
            )
          )
          INSERT INTO research_matrix_variant_runs (
            dataset_id,
            logic_version,
            variant_id,
            variant_label,
            parameter_json,
            source_filter_json,
            result_hash,
            status,
            completed_at
          )
          SELECT
            dataset_id,
            logic_version,
            variant_id,
            variant_label,
            COALESCE(parameter_json, '{}'::jsonb),
            COALESCE(source_filter_json, '{}'::jsonb),
            result_hash,
            status,
            CASE WHEN status = 'complete' THEN NOW() ELSE NULL END
          FROM incoming
          ON CONFLICT (dataset_id, logic_version, variant_id, result_hash)
          DO UPDATE SET
            variant_label = EXCLUDED.variant_label,
            parameter_json = EXCLUDED.parameter_json,
            source_filter_json = EXCLUDED.source_filter_json,
            status = EXCLUDED.status,
            completed_at = EXCLUDED.completed_at
          RETURNING variant_id, variant_run_id
        `,
        [payload],
      );
      results.push(...response.rows.map((row) => ({
        variantId: row.variant_id,
        variantRunId: row.variant_run_id,
      })));
    }
  });
  return results;
}

export async function persistResearchMatrixSourceContexts(options: {
  datasetId: string;
  rows: ResearchMatrixSourceContext[];
}) {
  if (options.rows.length === 0) return 0;
  let written = 0;
  await transaction(async (client) => {
    for (const chunk of chunkRows(options.rows)) {
      const params: unknown[] = [];
      const valuesSql = chunk.map((row) => appendValues(params, [
        options.datasetId,
        row.weekOpenUtc,
        row.symbol.toUpperCase(),
        row.assetClass,
        row.dealerDirection,
        row.commercialDirection,
        row.cotFacesDirection,
        row.commercialDeltaCotDirection,
        row.fridayStrengthDirection,
        row.marketOpenStrengthDirection,
        jsonParam(row.sourceTimestamps),
        jsonParam(row.sourceScores),
        jsonParam(row.coverage),
        jsonParam(row.flags),
      ])).join(", ");
      const result = await client.query(
        `
          INSERT INTO research_matrix_source_contexts (
            dataset_id,
            week_open_utc,
            symbol,
            asset_class,
            dealer_direction,
            commercial_direction,
            cot_faces_direction,
            commercial_delta_cot_direction,
            friday_strength_direction,
            market_open_strength_direction,
            source_timestamps,
            source_scores,
            coverage,
            flags
          )
          VALUES ${valuesSql}
          ON CONFLICT (dataset_id, week_open_utc, symbol)
          DO UPDATE SET
            asset_class = EXCLUDED.asset_class,
            dealer_direction = EXCLUDED.dealer_direction,
            commercial_direction = EXCLUDED.commercial_direction,
            cot_faces_direction = EXCLUDED.cot_faces_direction,
            commercial_delta_cot_direction = EXCLUDED.commercial_delta_cot_direction,
            friday_strength_direction = EXCLUDED.friday_strength_direction,
            market_open_strength_direction = EXCLUDED.market_open_strength_direction,
            source_timestamps = EXCLUDED.source_timestamps,
            source_scores = EXCLUDED.source_scores,
            coverage = EXCLUDED.coverage,
            flags = EXCLUDED.flags
        `,
        params,
      );
      written += result.rowCount ?? 0;
    }
  });
  return written;
}

export async function persistResearchMatrixTradeOpportunities(options: {
  datasetId: string;
  rows: ResearchMatrixTradeOpportunity[];
}) {
  if (options.rows.length === 0) return 0;
  let written = 0;
  await transaction(async (client) => {
    for (const chunk of chunkRows(options.rows)) {
      const params: unknown[] = [];
      const valuesSql = chunk.map((row) => appendValues(params, [
        options.datasetId,
        row.weekOpenUtc,
        row.symbol.toUpperCase(),
        row.direction,
        row.fillSeq,
        row.component,
        row.entryTimeUtc,
        row.entryPrice,
        row.plannedExitTimeUtc,
        row.plannedExitReason,
        row.plannedExitPrice,
        row.pairAdrPct,
        row.rawReturnPct,
        row.adrReturn,
        row.mfeAdr ?? null,
        row.maeAdr ?? null,
        jsonParam(row.metadata),
      ])).join(", ");
      const result = await client.query(
        `
          INSERT INTO research_matrix_trade_opportunities (
            dataset_id,
            week_open_utc,
            symbol,
            direction,
            fill_seq,
            component,
            entry_time_utc,
            entry_price,
            planned_exit_time_utc,
            planned_exit_reason,
            planned_exit_price,
            pair_adr_pct,
            raw_return_pct,
            adr_return,
            mfe_adr,
            mae_adr,
            metadata
          )
          VALUES ${valuesSql}
          ON CONFLICT (dataset_id, week_open_utc, symbol, direction, fill_seq, component)
          DO UPDATE SET
            entry_time_utc = EXCLUDED.entry_time_utc,
            entry_price = EXCLUDED.entry_price,
            planned_exit_time_utc = EXCLUDED.planned_exit_time_utc,
            planned_exit_reason = EXCLUDED.planned_exit_reason,
            planned_exit_price = EXCLUDED.planned_exit_price,
            pair_adr_pct = EXCLUDED.pair_adr_pct,
            raw_return_pct = EXCLUDED.raw_return_pct,
            adr_return = EXCLUDED.adr_return,
            mfe_adr = EXCLUDED.mfe_adr,
            mae_adr = EXCLUDED.mae_adr,
            metadata = EXCLUDED.metadata
        `,
        params,
      );
      written += result.rowCount ?? 0;
    }
  });
  return written;
}

async function persistResearchMatrixPairDecisionsWithRecordset(rows: ResearchMatrixPairDecision[]) {
  if (rows.length === 0) return 0;
  let written = 0;
  await transaction(async (client) => {
    await client.query(
      `
        WITH keys AS (
          SELECT *
          FROM jsonb_to_recordset($1::jsonb) AS row(
            variant_run_id UUID,
            week_open_utc TIMESTAMPTZ
          )
        )
        DELETE FROM research_matrix_pair_decisions decisions
        USING keys
        WHERE decisions.variant_run_id = keys.variant_run_id
          AND decisions.week_open_utc = keys.week_open_utc
      `,
      [variantWeekKeyPayload(rows)],
    );

    for (const chunk of chunkRows(rows, BULK_JSON_CHUNK_SIZE)) {
      const payload = bulkJsonPayload(chunk.map((row) => ({
        variant_run_id: row.variantRunId,
        week_open_utc: row.weekOpenUtc,
        symbol: row.symbol.toUpperCase(),
        selected_side: row.selectedSide,
        exclusion_reason: row.exclusionReason,
        source_state: row.sourceState ?? {},
        decision_scores: row.decisionScores ?? {},
      })));
      const result = await client.query(
        `
          WITH incoming AS (
            SELECT *
            FROM jsonb_to_recordset($1::jsonb) AS row(
              variant_run_id UUID,
              week_open_utc TIMESTAMPTZ,
              symbol TEXT,
              selected_side TEXT,
              exclusion_reason TEXT,
              source_state JSONB,
              decision_scores JSONB
            )
          )
          INSERT INTO research_matrix_pair_decisions (
            variant_run_id,
            week_open_utc,
            symbol,
            selected_side,
            exclusion_reason,
            source_state,
            decision_scores
          )
          SELECT
            variant_run_id,
            week_open_utc,
            symbol,
            selected_side,
            exclusion_reason,
            COALESCE(source_state, '{}'::jsonb),
            COALESCE(decision_scores, '{}'::jsonb)
          FROM incoming
        `,
        [payload],
      );
      written += result.rowCount ?? 0;
    }
  });
  return written;
}

export async function persistResearchMatrixPairDecisions(rows: ResearchMatrixPairDecision[]) {
  if (rows.length === 0) return 0;
  if (process.env.RESEARCH_MATRIX_PAIR_DECISION_WRITE_METHOD === "insert") {
    return persistResearchMatrixPairDecisionsWithRecordset(rows);
  }

  let written = 0;
  await transaction(async (client) => {
    await client.query(
      `
        WITH keys AS (
          SELECT *
          FROM jsonb_to_recordset($1::jsonb) AS row(
            variant_run_id UUID,
            week_open_utc TIMESTAMPTZ
          )
        )
        DELETE FROM research_matrix_pair_decisions decisions
        USING keys
        WHERE decisions.variant_run_id = keys.variant_run_id
          AND decisions.week_open_utc = keys.week_open_utc
      `,
      [variantWeekKeyPayload(rows)],
    );

    for (const chunk of chunkRows(rows, BULK_JSON_CHUNK_SIZE)) {
      const copyStream = client.query(copyFrom(`
        COPY research_matrix_pair_decisions (
          variant_run_id,
          week_open_utc,
          symbol,
          selected_side,
          exclusion_reason,
          source_state,
          decision_scores
        )
        FROM STDIN WITH (FORMAT text)
      `));
      await pipeline(Readable.from(chunk.map(pairDecisionCopyLine)), copyStream);
      written += chunk.length;
    }
  });
  return written;
}

export async function persistResearchMatrixVariantWeekResults(rows: ResearchMatrixVariantWeekResult[]) {
  if (rows.length === 0) return 0;
  let written = 0;
  await transaction(async (client) => {
    await client.query(
      `
        WITH keys AS (
          SELECT *
          FROM jsonb_to_recordset($1::jsonb) AS row(
            variant_run_id UUID,
            week_open_utc TIMESTAMPTZ
          )
        )
        DELETE FROM research_matrix_variant_week_results results
        USING keys
        WHERE results.variant_run_id = keys.variant_run_id
          AND results.week_open_utc = keys.week_open_utc
      `,
      [variantWeekKeyPayload(rows)],
    );

    for (const chunk of chunkRows(rows, BULK_JSON_CHUNK_SIZE)) {
      const payload = bulkJsonPayload(chunk.map((row) => ({
        variant_run_id: row.variantRunId,
        week_open_utc: row.weekOpenUtc,
        selected_pair_sides: row.selectedPairSides,
        fills: row.fills,
        final_adr: row.finalAdr,
        final_raw_pct: row.finalRawPct,
        max_drawdown_adr: row.maxDrawdownAdr,
        max_drawdown_time_utc: row.maxDrawdownTimeUtc,
        week_close_adr: row.weekCloseAdr,
        grid_tp_adr: row.gridTpAdr,
        runner_adr: row.runnerAdr,
        stop_exit_adr: row.stopExitAdr,
        basket_take_profit_exit_adr: row.basketTakeProfitExitAdr,
        max_active_fills: row.maxActiveFills,
        worst_pair: row.worstPair,
        worst_pair_adr: row.worstPairAdr,
        worst_currency: row.worstCurrency,
        worst_currency_adr: row.worstCurrencyAdr,
        pair_contributions: row.pairContributions ?? {},
        currency_contributions: row.currencyContributions ?? {},
        exit_counts: row.exitCounts ?? {},
        metadata: row.metadata ?? {},
      })));
      const result = await client.query(
        `
          WITH incoming AS (
            SELECT *
            FROM jsonb_to_recordset($1::jsonb) AS row(
              variant_run_id UUID,
              week_open_utc TIMESTAMPTZ,
              selected_pair_sides INTEGER,
              fills DOUBLE PRECISION,
              final_adr DOUBLE PRECISION,
              final_raw_pct DOUBLE PRECISION,
              max_drawdown_adr DOUBLE PRECISION,
              max_drawdown_time_utc TIMESTAMPTZ,
              week_close_adr DOUBLE PRECISION,
              grid_tp_adr DOUBLE PRECISION,
              runner_adr DOUBLE PRECISION,
              stop_exit_adr DOUBLE PRECISION,
              basket_take_profit_exit_adr DOUBLE PRECISION,
              max_active_fills DOUBLE PRECISION,
              worst_pair TEXT,
              worst_pair_adr DOUBLE PRECISION,
              worst_currency TEXT,
              worst_currency_adr DOUBLE PRECISION,
              pair_contributions JSONB,
              currency_contributions JSONB,
              exit_counts JSONB,
              metadata JSONB
            )
          )
          INSERT INTO research_matrix_variant_week_results (
            variant_run_id,
            week_open_utc,
            selected_pair_sides,
            fills,
            final_adr,
            final_raw_pct,
            max_drawdown_adr,
            max_drawdown_time_utc,
            week_close_adr,
            grid_tp_adr,
            runner_adr,
            stop_exit_adr,
            basket_take_profit_exit_adr,
            max_active_fills,
            worst_pair,
            worst_pair_adr,
            worst_currency,
            worst_currency_adr,
            pair_contributions,
            currency_contributions,
            exit_counts,
            metadata
          )
          SELECT
            variant_run_id,
            week_open_utc,
            selected_pair_sides,
            fills,
            final_adr,
            final_raw_pct,
            max_drawdown_adr,
            max_drawdown_time_utc,
            week_close_adr,
            grid_tp_adr,
            runner_adr,
            stop_exit_adr,
            basket_take_profit_exit_adr,
            max_active_fills,
            worst_pair,
            worst_pair_adr,
            worst_currency,
            worst_currency_adr,
            COALESCE(pair_contributions, '{}'::jsonb),
            COALESCE(currency_contributions, '{}'::jsonb),
            COALESCE(exit_counts, '{}'::jsonb),
            COALESCE(metadata, '{}'::jsonb)
          FROM incoming
        `,
        [payload],
      );
      written += result.rowCount ?? 0;
    }
  });
  return written;
}

async function persistResearchMatrixTradeEventsWithRecordset(rows: ResearchMatrixTradeEvent[]) {
  if (rows.length === 0) return 0;
  let written = 0;
  await transaction(async (client) => {
    for (const chunk of chunkRows(rows, BULK_JSON_CHUNK_SIZE)) {
      const payload = bulkJsonPayload(chunk.map((row) => ({
        variant_run_id: row.variantRunId,
        week_open_utc: row.weekOpenUtc,
        symbol: row.symbol.toUpperCase(),
        direction: row.direction,
        fill_seq: row.fillSeq,
        component: row.component,
        entry_time_utc: row.entryTimeUtc,
        exit_time_utc: row.exitTimeUtc,
        exit_reason: row.exitReason,
        entry_price: row.entryPrice,
        exit_price: row.exitPrice,
        pair_adr_pct: row.pairAdrPct,
        raw_return_pct: row.rawReturnPct,
        adr_return: row.adrReturn,
        size_factor: row.sizeFactor,
        source_state: row.sourceState ?? {},
        path_stats: row.pathStats ?? {},
        metadata: row.metadata ?? {},
      })));
      const result = await client.query(
        `
          WITH incoming AS (
            SELECT *
            FROM jsonb_to_recordset($1::jsonb) AS row(
              variant_run_id UUID,
              week_open_utc TIMESTAMPTZ,
              symbol TEXT,
              direction TEXT,
              fill_seq INTEGER,
              component TEXT,
              entry_time_utc TIMESTAMPTZ,
              exit_time_utc TIMESTAMPTZ,
              exit_reason TEXT,
              entry_price DOUBLE PRECISION,
              exit_price DOUBLE PRECISION,
              pair_adr_pct DOUBLE PRECISION,
              raw_return_pct DOUBLE PRECISION,
              adr_return DOUBLE PRECISION,
              size_factor DOUBLE PRECISION,
              source_state JSONB,
              path_stats JSONB,
              metadata JSONB
            )
          )
          INSERT INTO research_matrix_trade_events (
            variant_run_id,
            week_open_utc,
            symbol,
            direction,
            fill_seq,
            component,
            entry_time_utc,
            exit_time_utc,
            exit_reason,
            entry_price,
            exit_price,
            pair_adr_pct,
            raw_return_pct,
            adr_return,
            size_factor,
            source_state,
            path_stats,
            metadata
          )
          SELECT
            variant_run_id,
            week_open_utc,
            symbol,
            direction,
            fill_seq,
            component,
            entry_time_utc,
            exit_time_utc,
            exit_reason,
            entry_price,
            exit_price,
            pair_adr_pct,
            raw_return_pct,
            adr_return,
            size_factor,
            COALESCE(source_state, '{}'::jsonb),
            COALESCE(path_stats, '{}'::jsonb),
            COALESCE(metadata, '{}'::jsonb)
          FROM incoming
          ON CONFLICT (variant_run_id, week_open_utc, symbol, direction, fill_seq, component)
          DO UPDATE SET
            entry_time_utc = EXCLUDED.entry_time_utc,
            exit_time_utc = EXCLUDED.exit_time_utc,
            exit_reason = EXCLUDED.exit_reason,
            entry_price = EXCLUDED.entry_price,
            exit_price = EXCLUDED.exit_price,
            pair_adr_pct = EXCLUDED.pair_adr_pct,
            raw_return_pct = EXCLUDED.raw_return_pct,
            adr_return = EXCLUDED.adr_return,
            size_factor = EXCLUDED.size_factor,
            source_state = EXCLUDED.source_state,
            path_stats = EXCLUDED.path_stats,
            metadata = EXCLUDED.metadata
        `,
        [payload],
      );
      written += result.rowCount ?? 0;
    }
  });
  return written;
}

export async function persistResearchMatrixTradeEvents(rows: ResearchMatrixTradeEvent[]) {
  if (rows.length === 0) return 0;
  if (process.env.RESEARCH_MATRIX_TRADE_EVENT_WRITE_METHOD === "insert") {
    return persistResearchMatrixTradeEventsWithRecordset(rows);
  }

  let written = 0;
  await transaction(async (client) => {
    await client.query(
      `
        WITH keys AS (
          SELECT *
          FROM jsonb_to_recordset($1::jsonb) AS row(
            variant_run_id UUID,
            week_open_utc TIMESTAMPTZ
          )
        )
        DELETE FROM research_matrix_trade_events events
        USING keys
        WHERE events.variant_run_id = keys.variant_run_id
          AND events.week_open_utc = keys.week_open_utc
      `,
      [variantWeekKeyPayload(rows)],
    );

    for (const chunk of chunkRows(rows, BULK_JSON_CHUNK_SIZE)) {
      const copyStream = client.query(copyFrom(`
        COPY research_matrix_trade_events (
          variant_run_id,
          week_open_utc,
          symbol,
          direction,
          fill_seq,
          component,
          entry_time_utc,
          exit_time_utc,
          exit_reason,
          entry_price,
          exit_price,
          pair_adr_pct,
          raw_return_pct,
          adr_return,
          size_factor,
          source_state,
          path_stats,
          metadata
        )
        FROM STDIN WITH (FORMAT text)
      `));
      await pipeline(Readable.from(chunk.map(tradeEventCopyLine)), copyStream);
      written += chunk.length;
    }
  });
  return written;
}

export async function persistResearchMatrixStopEvents(rows: ResearchMatrixStopEvent[]) {
  if (rows.length === 0) return 0;
  let written = 0;
  await transaction(async (client) => {
    await client.query(
      `
        WITH keys AS (
          SELECT *
          FROM jsonb_to_recordset($1::jsonb) AS row(
            variant_run_id UUID,
            week_open_utc TIMESTAMPTZ
          )
        )
        DELETE FROM research_matrix_stop_events events
        USING keys
        WHERE events.variant_run_id = keys.variant_run_id
          AND events.week_open_utc = keys.week_open_utc
      `,
      [variantWeekKeyPayload(rows)],
    );

    for (const chunk of chunkRows(rows, BULK_JSON_CHUNK_SIZE)) {
      const payload = bulkJsonPayload(chunk.map((row) => ({
        variant_run_id: row.variantRunId,
        week_open_utc: row.weekOpenUtc,
        stop_type: row.stopType,
        symbol: row.symbol?.toUpperCase() ?? null,
        direction: row.direction,
        threshold_adr: row.thresholdAdr,
        stop_time_utc: row.stopTimeUtc,
        trigger_adr: row.triggerAdr,
        active_closed_fills: row.activeClosedFills,
        active_marked_adr: row.activeMarkedAdr,
        active_original_adr: row.activeOriginalAdr,
        active_delta_adr: row.activeDeltaAdr,
        skipped_fills: row.skippedFills,
        skipped_original_adr: row.skippedOriginalAdr,
        skipped_exit_counts: row.skippedExitCounts ?? {},
        metadata: row.metadata ?? {},
      })));
      const result = await client.query(
        `
          WITH incoming AS (
            SELECT *
            FROM jsonb_to_recordset($1::jsonb) AS row(
              variant_run_id UUID,
              week_open_utc TIMESTAMPTZ,
              stop_type TEXT,
              symbol TEXT,
              direction TEXT,
              threshold_adr DOUBLE PRECISION,
              stop_time_utc TIMESTAMPTZ,
              trigger_adr DOUBLE PRECISION,
              active_closed_fills DOUBLE PRECISION,
              active_marked_adr DOUBLE PRECISION,
              active_original_adr DOUBLE PRECISION,
              active_delta_adr DOUBLE PRECISION,
              skipped_fills DOUBLE PRECISION,
              skipped_original_adr DOUBLE PRECISION,
              skipped_exit_counts JSONB,
              metadata JSONB
            )
          )
          INSERT INTO research_matrix_stop_events (
            variant_run_id,
            week_open_utc,
            stop_type,
            symbol,
            direction,
            threshold_adr,
            stop_time_utc,
            trigger_adr,
            active_closed_fills,
            active_marked_adr,
            active_original_adr,
            active_delta_adr,
            skipped_fills,
            skipped_original_adr,
            skipped_exit_counts,
            metadata
          )
          SELECT
            variant_run_id,
            week_open_utc,
            stop_type,
            symbol,
            direction,
            threshold_adr,
            stop_time_utc,
            trigger_adr,
            active_closed_fills,
            active_marked_adr,
            active_original_adr,
            active_delta_adr,
            skipped_fills,
            skipped_original_adr,
            COALESCE(skipped_exit_counts, '{}'::jsonb),
            COALESCE(metadata, '{}'::jsonb)
          FROM incoming
        `,
        [payload],
      );
      written += result.rowCount ?? 0;
    }
  });
  return written;
}

export async function readResearchMatrixPersistCounts(datasetId: string): Promise<ResearchMatrixPersistCounts> {
  const rows = await query<{
    source_contexts: string | number;
    trade_opportunities: string | number;
    variant_runs: string | number;
    pair_decisions: string | number;
    variant_week_results: string | number;
    trade_events: string | number;
    stop_events: string | number;
  }>(
    `
      SELECT
        (SELECT COUNT(*) FROM research_matrix_source_contexts WHERE dataset_id = $1::uuid) AS source_contexts,
        (SELECT COUNT(*) FROM research_matrix_trade_opportunities WHERE dataset_id = $1::uuid) AS trade_opportunities,
        (SELECT COUNT(*) FROM research_matrix_variant_runs WHERE dataset_id = $1::uuid) AS variant_runs,
        (
          SELECT COUNT(*)
          FROM research_matrix_pair_decisions decisions
          JOIN research_matrix_variant_runs runs
            ON runs.variant_run_id = decisions.variant_run_id
          WHERE runs.dataset_id = $1::uuid
        ) AS pair_decisions,
        (
          SELECT COUNT(*)
          FROM research_matrix_variant_week_results results
          JOIN research_matrix_variant_runs runs
            ON runs.variant_run_id = results.variant_run_id
          WHERE runs.dataset_id = $1::uuid
        ) AS variant_week_results,
        (
          SELECT COUNT(*)
          FROM research_matrix_trade_events events
          JOIN research_matrix_variant_runs runs
            ON runs.variant_run_id = events.variant_run_id
          WHERE runs.dataset_id = $1::uuid
        ) AS trade_events,
        (
          SELECT COUNT(*)
          FROM research_matrix_stop_events events
          JOIN research_matrix_variant_runs runs
            ON runs.variant_run_id = events.variant_run_id
          WHERE runs.dataset_id = $1::uuid
        ) AS stop_events
    `,
    [datasetId],
  );
  const row = rows[0];
  if (!row) {
    return {
      sourceContexts: 0,
      tradeOpportunities: 0,
      variantRuns: 0,
      pairDecisions: 0,
      variantWeekResults: 0,
      tradeEvents: 0,
      stopEvents: 0,
    };
  }
  const toNumber = (value: string | number) => Number(value);
  return {
    sourceContexts: toNumber(row.source_contexts),
    tradeOpportunities: toNumber(row.trade_opportunities),
    variantRuns: toNumber(row.variant_runs),
    pairDecisions: toNumber(row.pair_decisions),
    variantWeekResults: toNumber(row.variant_week_results),
    tradeEvents: toNumber(row.trade_events),
    stopEvents: toNumber(row.stop_events),
  };
}
