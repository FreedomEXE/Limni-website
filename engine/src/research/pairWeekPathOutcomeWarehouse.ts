import { query, transaction } from "@database/db/client";
import { clearRuntimeCacheAll, getRuntimeCacheStats, resetRuntimeCacheStats } from "@engine/cache/runtimeCache";
import type { ResearchDecisionAssetClass, ResearchDecisionManifest, ResearchDecisionSide } from "@engine/research/decisionManifest";
import {
  attachResearchDecisionManifestHash,
  getResearchDecisionManifestIdentity,
  normalizeResearchDecisionManifest,
} from "@engine/research/decisionManifest";
import {
  buildResearchDecisionEvaluationResult,
  buildRuntimeTelemetry,
  loadResearchDecisionWeekScoringContext,
  RESEARCH_DECISION_EVALUATOR_PARAMS,
  RESEARCH_DECISION_EVALUATOR_VERSION,
  RESEARCH_DECISION_PATH_CONTRACT_ID,
  scoreResearchDecisionPairPathOutcome,
  type ResearchDecisionEvaluatorId,
  type ResearchDecisionEvaluationResult,
  type ResearchDecisionPairPathOutcome,
  type ResearchDecisionPathResolution,
  type ResearchDecisionWeekScore,
} from "@engine/research/decisionManifestEvaluator";
import { sha256Stable } from "@engine/research/hash";

export const PAIR_WEEK_PATH_OUTCOME_SCHEMA_VERSION = 1;
export const PAIR_WEEK_PATH_OUTCOME_WAREHOUSE_VERSION = "pair_week_path_outcomes_v1";

export type PairWeekPathOutcomeWarehouseConfig = {
  schema_version: typeof PAIR_WEEK_PATH_OUTCOME_SCHEMA_VERSION;
  warehouse_version: typeof PAIR_WEEK_PATH_OUTCOME_WAREHOUSE_VERSION;
  price_bundle_id: string;
  asset_class: ResearchDecisionAssetClass;
  path_resolution: ResearchDecisionPathResolution;
  evaluator_version: typeof RESEARCH_DECISION_EVALUATOR_VERSION;
  path_contract_id: typeof RESEARCH_DECISION_PATH_CONTRACT_ID;
  evaluator_params_hash: string;
  symbols: string[];
  weeks: string[];
  directions: ResearchDecisionSide[];
};

export type PairWeekPathOutcomeWarehouseInspection = {
  manifest_id: string;
  config_hash: string;
  warehouse_hash: string;
  expected_rows: number;
  row_count: number;
  missing_outcome_count: number;
  duplicate_outcome_count: number;
  row_counts_by_evaluator: Record<ResearchDecisionEvaluatorId, number>;
  row_counts_by_direction: Record<ResearchDecisionSide, number>;
  row_counts_by_symbol: Record<string, number>;
  row_counts_by_week: Record<string, number>;
  missing_keys_sample: string[];
};

export type PairWeekPathOutcomeWarehouseManifest = {
  manifest_id: string;
  schema_version: number;
  warehouse_version: string;
  price_bundle_id: string;
  asset_class: ResearchDecisionAssetClass;
  path_resolution: ResearchDecisionPathResolution;
  evaluator_version: typeof RESEARCH_DECISION_EVALUATOR_VERSION;
  path_contract_id: typeof RESEARCH_DECISION_PATH_CONTRACT_ID;
  evaluator_params_hash: string;
  config_hash: string;
  warehouse_hash: string | null;
  status: "building" | "complete" | "failed";
  universe_symbols: string[];
  week_count: number;
  direction_count: number;
  expected_rows: number;
  row_count: number;
  coverage: Record<string, unknown>;
  created_at_utc: string;
  completed_at_utc: string | null;
};

type DbOutcomeRow = {
  manifest_id: string;
  price_bundle_id: string;
  symbol: string;
  week_open_utc: Date | string;
  direction: ResearchDecisionSide;
  path_resolution: ResearchDecisionPathResolution;
  evaluator_version: typeof RESEARCH_DECISION_EVALUATOR_VERSION;
  path_contract_id: typeof RESEARCH_DECISION_PATH_CONTRACT_ID;
  evaluator_params_hash: string;
  asset_class: ResearchDecisionAssetClass;
  adr_grid_adr: number | string;
  adr_grid_fills: number | string;
  adr_grid_tp: number | string;
  adr_grid_reset: number | string;
  adr_grid_week_close: number | string;
  adr_grid_missing_price_rows: number | string;
  adr_grid_default_adr_rows: number | string;
  weekly_hold_adr: number | string;
  weekly_hold_missing_price_rows: number | string;
  weekly_hold_default_adr_rows: number | string;
  row_hash: string;
};

const DIRECTION_VALUES: ResearchDecisionSide[] = ["LONG", "SHORT"];

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS research_pair_week_path_outcome_manifests (
  manifest_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  warehouse_version TEXT NOT NULL,
  price_bundle_id TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  path_resolution TEXT NOT NULL,
  evaluator_version TEXT NOT NULL,
  path_contract_id TEXT NOT NULL,
  evaluator_params_hash TEXT NOT NULL,
  config_hash TEXT NOT NULL,
  warehouse_hash TEXT,
  status TEXT NOT NULL,
  universe_symbols JSONB NOT NULL DEFAULT '[]'::jsonb,
  week_count INTEGER NOT NULL,
  direction_count INTEGER NOT NULL,
  expected_rows INTEGER NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_research_pair_week_path_outcome_manifests_bundle
  ON research_pair_week_path_outcome_manifests (price_bundle_id, path_resolution, evaluator_version);

CREATE TABLE IF NOT EXISTS research_pair_week_path_outcomes (
  manifest_id TEXT NOT NULL REFERENCES research_pair_week_path_outcome_manifests(manifest_id) ON DELETE CASCADE,
  price_bundle_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  week_open_utc TIMESTAMPTZ NOT NULL,
  direction TEXT NOT NULL,
  path_resolution TEXT NOT NULL,
  evaluator_version TEXT NOT NULL,
  path_contract_id TEXT NOT NULL,
  evaluator_params_hash TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  adr_grid_adr DOUBLE PRECISION NOT NULL,
  adr_grid_fills INTEGER NOT NULL,
  adr_grid_tp INTEGER NOT NULL,
  adr_grid_reset INTEGER NOT NULL,
  adr_grid_week_close INTEGER NOT NULL,
  adr_grid_missing_price_rows INTEGER NOT NULL,
  adr_grid_default_adr_rows INTEGER NOT NULL,
  weekly_hold_adr DOUBLE PRECISION NOT NULL,
  weekly_hold_missing_price_rows INTEGER NOT NULL,
  weekly_hold_default_adr_rows INTEGER NOT NULL,
  row_hash TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (
    manifest_id,
    price_bundle_id,
    symbol,
    week_open_utc,
    direction,
    path_resolution,
    path_contract_id,
    evaluator_params_hash
  )
);

CREATE INDEX IF NOT EXISTS idx_research_pair_week_path_outcomes_lookup
  ON research_pair_week_path_outcomes (manifest_id, week_open_utc, symbol, direction);
`;

function normalizeSymbols(symbols: string[]) {
  return Array.from(new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))).sort();
}

function normalizeWeeks(weeks: string[]) {
  return Array.from(new Set(weeks.map((week) => new Date(week).toISOString()))).sort();
}

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNumber(value: number | string) {
  return Number(value);
}

function outcomeKey(weekOpenUtc: string, symbol: string, direction: ResearchDecisionSide) {
  return `${weekOpenUtc}:${symbol.trim().toUpperCase()}:${direction}`;
}

export function getPairWeekPathOutcomeEvaluatorParamsHash() {
  return sha256Stable(RESEARCH_DECISION_EVALUATOR_PARAMS);
}

export function buildPairWeekPathOutcomeWarehouseConfig(options: {
  priceBundleId: string;
  assetClass: ResearchDecisionAssetClass;
  pathResolution: ResearchDecisionPathResolution;
  symbols: string[];
  weeks: string[];
}): PairWeekPathOutcomeWarehouseConfig {
  return {
    schema_version: PAIR_WEEK_PATH_OUTCOME_SCHEMA_VERSION,
    warehouse_version: PAIR_WEEK_PATH_OUTCOME_WAREHOUSE_VERSION,
    price_bundle_id: options.priceBundleId,
    asset_class: options.assetClass,
    path_resolution: options.pathResolution,
    evaluator_version: RESEARCH_DECISION_EVALUATOR_VERSION,
    path_contract_id: RESEARCH_DECISION_PATH_CONTRACT_ID,
    evaluator_params_hash: getPairWeekPathOutcomeEvaluatorParamsHash(),
    symbols: normalizeSymbols(options.symbols),
    weeks: normalizeWeeks(options.weeks),
    directions: DIRECTION_VALUES,
  };
}

export function hashPairWeekPathOutcomeWarehouseConfig(config: PairWeekPathOutcomeWarehouseConfig) {
  return sha256Stable(config);
}

export function buildPairWeekPathOutcomeManifestId(config: PairWeekPathOutcomeWarehouseConfig) {
  const hash = hashPairWeekPathOutcomeWarehouseConfig(config);
  return `gate57a0b_pair_week_path_outcomes_${hash.slice(0, 12)}`;
}

function buildRowHash(row: {
  price_bundle_id: string;
  symbol: string;
  week_open_utc: string;
  direction: ResearchDecisionSide;
  path_resolution: ResearchDecisionPathResolution;
  evaluator_version: string;
  path_contract_id: string;
  evaluator_params_hash: string;
  asset_class: ResearchDecisionAssetClass;
  adr_grid: ResearchDecisionPairPathOutcome["adr_grid"];
  weekly_hold: ResearchDecisionPairPathOutcome["weekly_hold"];
}) {
  return sha256Stable(row);
}

function dbRowToOutcome(row: DbOutcomeRow): ResearchDecisionPairPathOutcome {
  return {
    week_open_utc: iso(row.week_open_utc),
    symbol: row.symbol.toUpperCase(),
    direction: row.direction,
    adr_grid: {
      adr: toNumber(row.adr_grid_adr),
      fills: Number(row.adr_grid_fills),
      tp: Number(row.adr_grid_tp),
      reset: Number(row.adr_grid_reset),
      week_close: Number(row.adr_grid_week_close),
      missing_price_rows: Number(row.adr_grid_missing_price_rows),
      default_adr_rows: Number(row.adr_grid_default_adr_rows),
    },
    weekly_hold: {
      adr: toNumber(row.weekly_hold_adr),
      missing_price_rows: Number(row.weekly_hold_missing_price_rows),
      default_adr_rows: Number(row.weekly_hold_default_adr_rows),
    },
  };
}

function dbRowCanonicalHash(row: DbOutcomeRow) {
  const outcome = dbRowToOutcome(row);
  return buildRowHash({
    price_bundle_id: row.price_bundle_id,
    symbol: outcome.symbol,
    week_open_utc: outcome.week_open_utc,
    direction: outcome.direction,
    path_resolution: row.path_resolution,
    evaluator_version: row.evaluator_version,
    path_contract_id: row.path_contract_id,
    evaluator_params_hash: row.evaluator_params_hash,
    asset_class: row.asset_class,
    adr_grid: outcome.adr_grid,
    weekly_hold: outcome.weekly_hold,
  });
}

function buildWarehouseHash(rows: DbOutcomeRow[]) {
  return sha256Stable(rows
    .map((row) => ({
      key: [
        row.price_bundle_id,
        row.symbol.toUpperCase(),
        iso(row.week_open_utc),
        row.direction,
        row.path_resolution,
        row.path_contract_id,
        row.evaluator_params_hash,
      ].join("|"),
      row_hash: dbRowCanonicalHash(row),
    }))
    .sort((left, right) => left.key.localeCompare(right.key)));
}

export async function ensurePairWeekPathOutcomeWarehouseSchema() {
  await query(SCHEMA_SQL);
}

async function readOutcomeRows(manifestId: string): Promise<DbOutcomeRow[]> {
  return query<DbOutcomeRow>(
    `SELECT manifest_id, price_bundle_id, symbol, week_open_utc, direction,
            path_resolution, evaluator_version, path_contract_id, evaluator_params_hash,
            asset_class, adr_grid_adr, adr_grid_fills, adr_grid_tp,
            adr_grid_reset, adr_grid_week_close, adr_grid_missing_price_rows,
            adr_grid_default_adr_rows, weekly_hold_adr,
            weekly_hold_missing_price_rows, weekly_hold_default_adr_rows, row_hash
       FROM research_pair_week_path_outcomes
      WHERE manifest_id = $1
      ORDER BY week_open_utc ASC, symbol ASC, direction ASC`,
    [manifestId],
  );
}

export async function readPairWeekPathOutcomeWarehouseManifest(manifestId: string) {
  await ensurePairWeekPathOutcomeWarehouseSchema();
  const rows = await query<{
    manifest_id: string;
    schema_version: number;
    warehouse_version: string;
    price_bundle_id: string;
    asset_class: ResearchDecisionAssetClass;
    path_resolution: ResearchDecisionPathResolution;
    evaluator_version: typeof RESEARCH_DECISION_EVALUATOR_VERSION;
    path_contract_id: typeof RESEARCH_DECISION_PATH_CONTRACT_ID;
    evaluator_params_hash: string;
    config_hash: string;
    warehouse_hash: string | null;
    status: "building" | "complete" | "failed";
    universe_symbols: string[] | string;
    week_count: number;
    direction_count: number;
    expected_rows: number;
    row_count: number;
    coverage: Record<string, unknown> | string;
    created_at: Date;
    completed_at: Date | null;
  }>(
    `SELECT manifest_id, schema_version, warehouse_version, price_bundle_id,
            asset_class, path_resolution, evaluator_version, path_contract_id,
            evaluator_params_hash, config_hash, warehouse_hash, status,
            universe_symbols, week_count, direction_count, expected_rows,
            row_count, coverage, created_at, completed_at
       FROM research_pair_week_path_outcome_manifests
      WHERE manifest_id = $1`,
    [manifestId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    manifest_id: row.manifest_id,
    schema_version: row.schema_version,
    warehouse_version: row.warehouse_version,
    price_bundle_id: row.price_bundle_id,
    asset_class: row.asset_class,
    path_resolution: row.path_resolution,
    evaluator_version: row.evaluator_version,
    path_contract_id: row.path_contract_id,
    evaluator_params_hash: row.evaluator_params_hash,
    config_hash: row.config_hash,
    warehouse_hash: row.warehouse_hash,
    status: row.status,
    universe_symbols: Array.isArray(row.universe_symbols) ? row.universe_symbols : JSON.parse(row.universe_symbols),
    week_count: Number(row.week_count),
    direction_count: Number(row.direction_count),
    expected_rows: Number(row.expected_rows),
    row_count: Number(row.row_count),
    coverage: typeof row.coverage === "string" ? JSON.parse(row.coverage) : row.coverage,
    created_at_utc: row.created_at.toISOString(),
    completed_at_utc: row.completed_at?.toISOString() ?? null,
  } satisfies PairWeekPathOutcomeWarehouseManifest;
}

export async function inspectPairWeekPathOutcomeWarehouse(options: {
  manifestId: string;
  expectedSymbols: string[];
  expectedWeeks: string[];
}): Promise<PairWeekPathOutcomeWarehouseInspection> {
  await ensurePairWeekPathOutcomeWarehouseSchema();
  const manifest = await readPairWeekPathOutcomeWarehouseManifest(options.manifestId);
  if (!manifest) throw new Error(`Pair-week path outcome warehouse manifest not found: ${options.manifestId}`);
  const rows = await readOutcomeRows(options.manifestId);
  const rowKeys = new Map<string, number>();
  const rowCountsByDirection: Record<ResearchDecisionSide, number> = { LONG: 0, SHORT: 0 };
  const rowCountsBySymbol: Record<string, number> = {};
  const rowCountsByWeek: Record<string, number> = {};

  for (const row of rows) {
    const weekOpenUtc = iso(row.week_open_utc);
    const symbol = row.symbol.toUpperCase();
    const key = outcomeKey(weekOpenUtc, symbol, row.direction);
    rowKeys.set(key, (rowKeys.get(key) ?? 0) + 1);
    rowCountsByDirection[row.direction] += 1;
    rowCountsBySymbol[symbol] = (rowCountsBySymbol[symbol] ?? 0) + 1;
    rowCountsByWeek[weekOpenUtc] = (rowCountsByWeek[weekOpenUtc] ?? 0) + 1;
  }

  const expectedSymbols = normalizeSymbols(options.expectedSymbols);
  const expectedWeeks = normalizeWeeks(options.expectedWeeks);
  const missingKeys: string[] = [];
  for (const week of expectedWeeks) {
    for (const symbol of expectedSymbols) {
      for (const direction of DIRECTION_VALUES) {
        const key = outcomeKey(week, symbol, direction);
        if (!rowKeys.has(key)) missingKeys.push(key);
      }
    }
  }
  const duplicateOutcomeCount = [...rowKeys.values()].filter((count) => count > 1).length;
  const expectedRows = expectedWeeks.length * expectedSymbols.length * DIRECTION_VALUES.length;
  return {
    manifest_id: options.manifestId,
    config_hash: manifest.config_hash,
    warehouse_hash: buildWarehouseHash(rows),
    expected_rows: expectedRows,
    row_count: rows.length,
    missing_outcome_count: missingKeys.length,
    duplicate_outcome_count: duplicateOutcomeCount,
    row_counts_by_evaluator: {
      adr_grid: rows.length,
      weekly_hold: rows.length,
    },
    row_counts_by_direction: rowCountsByDirection,
    row_counts_by_symbol: Object.fromEntries(Object.entries(rowCountsBySymbol).sort(([a], [b]) => a.localeCompare(b))),
    row_counts_by_week: Object.fromEntries(Object.entries(rowCountsByWeek).sort(([a], [b]) => a.localeCompare(b))),
    missing_keys_sample: missingKeys.slice(0, 25),
  };
}

async function insertOutcomeBatch(rows: Array<{
  manifestId: string;
  config: PairWeekPathOutcomeWarehouseConfig;
  outcome: ResearchDecisionPairPathOutcome;
  rowHash: string;
}>) {
  if (rows.length === 0) return;
  const columnsPerRow = 21;
  const values: unknown[] = [];
  const placeholders = rows.map((row, rowIndex) => {
    const start = rowIndex * columnsPerRow;
    values.push(
      row.manifestId,
      row.config.price_bundle_id,
      row.outcome.symbol,
      row.outcome.week_open_utc,
      row.outcome.direction,
      row.config.path_resolution,
      row.config.evaluator_version,
      row.config.path_contract_id,
      row.config.evaluator_params_hash,
      row.config.asset_class,
      row.outcome.adr_grid.adr,
      row.outcome.adr_grid.fills,
      row.outcome.adr_grid.tp,
      row.outcome.adr_grid.reset,
      row.outcome.adr_grid.week_close,
      row.outcome.adr_grid.missing_price_rows,
      row.outcome.adr_grid.default_adr_rows,
      row.outcome.weekly_hold.adr,
      row.outcome.weekly_hold.missing_price_rows,
      row.outcome.weekly_hold.default_adr_rows,
      row.rowHash,
    );
    return `(${Array.from({ length: columnsPerRow }, (_, offset) => `$${start + offset + 1}`).join(", ")})`;
  });
  await query(
    `INSERT INTO research_pair_week_path_outcomes (
       manifest_id, price_bundle_id, symbol, week_open_utc, direction,
       path_resolution, evaluator_version, path_contract_id, evaluator_params_hash,
       asset_class, adr_grid_adr, adr_grid_fills, adr_grid_tp,
       adr_grid_reset, adr_grid_week_close, adr_grid_missing_price_rows,
       adr_grid_default_adr_rows, weekly_hold_adr,
       weekly_hold_missing_price_rows, weekly_hold_default_adr_rows, row_hash
     ) VALUES ${placeholders.join(", ")}`,
    values,
  );
}

export async function materializePairWeekPathOutcomeWarehouse(options: {
  manifestId?: string;
  priceBundleId: string;
  assetClass: ResearchDecisionAssetClass;
  pathResolution: ResearchDecisionPathResolution;
  symbols: string[];
  weeks: string[];
  overwrite?: boolean;
  clearRuntimeCacheBetweenWeeks?: boolean;
  logProgress?: boolean;
}) {
  const startedAt = Date.now();
  resetRuntimeCacheStats();
  await ensurePairWeekPathOutcomeWarehouseSchema();
  const config = buildPairWeekPathOutcomeWarehouseConfig({
    priceBundleId: options.priceBundleId,
    assetClass: options.assetClass,
    pathResolution: options.pathResolution,
    symbols: options.symbols,
    weeks: options.weeks,
  });
  const configHash = hashPairWeekPathOutcomeWarehouseConfig(config);
  const manifestId = options.manifestId ?? buildPairWeekPathOutcomeManifestId(config);
  const existing = await readPairWeekPathOutcomeWarehouseManifest(manifestId);
  if (existing && !options.overwrite) {
    throw new Error(`Pair-week path outcome warehouse manifest already exists: ${manifestId}. Use --overwrite to rebuild.`);
  }
  const expectedRows = config.weeks.length * config.symbols.length * config.directions.length;

  await transaction(async (client) => {
    if (existing) {
      await client.query("DELETE FROM research_pair_week_path_outcome_manifests WHERE manifest_id = $1", [manifestId]);
    }
    await client.query(
      `INSERT INTO research_pair_week_path_outcome_manifests (
         manifest_id, schema_version, warehouse_version, price_bundle_id,
         asset_class, path_resolution, evaluator_version, path_contract_id,
         evaluator_params_hash, config_hash, status, universe_symbols,
         week_count, direction_count, expected_rows, row_count, coverage
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'building',$11::jsonb,$12,$13,$14,0,'{}'::jsonb)`,
      [
        manifestId,
        PAIR_WEEK_PATH_OUTCOME_SCHEMA_VERSION,
        PAIR_WEEK_PATH_OUTCOME_WAREHOUSE_VERSION,
        config.price_bundle_id,
        config.asset_class,
        config.path_resolution,
        config.evaluator_version,
        config.path_contract_id,
        config.evaluator_params_hash,
        configHash,
        JSON.stringify(config.symbols),
        config.weeks.length,
        config.directions.length,
        expectedRows,
      ],
    );
  });

  try {
    for (const [weekIndex, weekOpenUtc] of config.weeks.entries()) {
      const weekStartedAt = Date.now();
      const context = await loadResearchDecisionWeekScoringContext({
        assetClass: config.asset_class,
        priceBundleId: config.price_bundle_id,
        weekOpenUtc,
        symbols: config.symbols,
        pathResolution: config.path_resolution,
      });
      const batch: Array<{
        manifestId: string;
        config: PairWeekPathOutcomeWarehouseConfig;
        outcome: ResearchDecisionPairPathOutcome;
        rowHash: string;
      }> = [];
      for (const symbol of config.symbols) {
        for (const direction of config.directions) {
          const outcome = scoreResearchDecisionPairPathOutcome({
            assetClass: config.asset_class,
            weekOpenUtc,
            symbol,
            direction,
            context,
          });
          const rowHash = buildRowHash({
            price_bundle_id: config.price_bundle_id,
            symbol: outcome.symbol,
            week_open_utc: outcome.week_open_utc,
            direction: outcome.direction,
            path_resolution: config.path_resolution,
            evaluator_version: config.evaluator_version,
            path_contract_id: config.path_contract_id,
            evaluator_params_hash: config.evaluator_params_hash,
            asset_class: config.asset_class,
            adr_grid: outcome.adr_grid,
            weekly_hold: outcome.weekly_hold,
          });
          batch.push({ manifestId, config, outcome, rowHash });
        }
      }
      await insertOutcomeBatch(batch);
      if (options.clearRuntimeCacheBetweenWeeks) {
        clearRuntimeCacheAll();
      }
      if (options.logProgress) {
        console.log([
          `materializeWeek=${weekIndex + 1}/${config.weeks.length}`,
          `week=${weekOpenUtc.slice(0, 10)}`,
          `rows=${batch.length}`,
          `elapsed=${((Date.now() - weekStartedAt) / 1000).toFixed(2)}s`,
        ].join(" | "));
      }
    }

    const inspection = await inspectPairWeekPathOutcomeWarehouse({
      manifestId,
      expectedSymbols: config.symbols,
      expectedWeeks: config.weeks,
    });
    const coverage = {
      expected_rows: inspection.expected_rows,
      row_count: inspection.row_count,
      missing_outcome_count: inspection.missing_outcome_count,
      duplicate_outcome_count: inspection.duplicate_outcome_count,
      row_counts_by_evaluator: inspection.row_counts_by_evaluator,
      row_counts_by_direction: inspection.row_counts_by_direction,
      materialization_runtime_seconds: Math.round((Date.now() - startedAt) / 100) / 10,
      cache: getRuntimeCacheStats(),
    };
    if (inspection.missing_outcome_count > 0 || inspection.duplicate_outcome_count > 0 || inspection.row_count !== expectedRows) {
      throw new Error(`Pair-week path outcome warehouse incomplete: rows=${inspection.row_count}/${expectedRows}, missing=${inspection.missing_outcome_count}, duplicates=${inspection.duplicate_outcome_count}`);
    }
    await query(
      `UPDATE research_pair_week_path_outcome_manifests
          SET status = 'complete',
              warehouse_hash = $2,
              row_count = $3,
              coverage = $4::jsonb,
              completed_at = NOW()
        WHERE manifest_id = $1`,
      [manifestId, inspection.warehouse_hash, inspection.row_count, JSON.stringify(coverage)],
    );
    return {
      manifestId,
      config,
      configHash,
      warehouseHash: inspection.warehouse_hash,
      inspection,
      runtimeSeconds: Math.round((Date.now() - startedAt) / 100) / 10,
      cache: getRuntimeCacheStats(),
    };
  } catch (error) {
    await query(
      `UPDATE research_pair_week_path_outcome_manifests
          SET status = 'failed',
              coverage = jsonb_set(COALESCE(coverage, '{}'::jsonb), '{error}', to_jsonb($2::text), true)
        WHERE manifest_id = $1`,
      [manifestId, error instanceof Error ? error.message : String(error)],
    );
    throw error;
  }
}

export async function assertPairWeekPathOutcomeWarehouseReady(options: {
  manifestId: string;
  expectedSymbols: string[];
  expectedWeeks: string[];
}) {
  const manifest = await readPairWeekPathOutcomeWarehouseManifest(options.manifestId);
  if (!manifest) throw new Error(`Pair-week path outcome warehouse manifest not found: ${options.manifestId}`);
  if (manifest.status !== "complete") {
    throw new Error(`Pair-week path outcome warehouse is not complete: ${options.manifestId} status=${manifest.status}`);
  }
  if (!manifest.warehouse_hash) {
    throw new Error(`Pair-week path outcome warehouse has no warehouse_hash: ${options.manifestId}`);
  }
  const inspection = await inspectPairWeekPathOutcomeWarehouse(options);
  if (inspection.warehouse_hash !== manifest.warehouse_hash) {
    throw new Error(`Pair-week path outcome warehouse hash mismatch: recorded ${manifest.warehouse_hash}, computed ${inspection.warehouse_hash}`);
  }
  if (inspection.missing_outcome_count > 0 || inspection.duplicate_outcome_count > 0 || inspection.row_count < inspection.expected_rows) {
    throw new Error(`Pair-week path outcome warehouse incomplete for requested manifest: rows=${inspection.row_count}/${inspection.expected_rows}, missing=${inspection.missing_outcome_count}, duplicates=${inspection.duplicate_outcome_count}`);
  }
  return { manifest, inspection };
}

function aggregateOutcomesForDecisions(options: {
  weekOpenUtc: string;
  decisions: ResearchDecisionManifest["decisions"];
  outcomesByKey: Map<string, ResearchDecisionPairPathOutcome>;
  evaluators: ResearchDecisionEvaluatorId[];
}): ResearchDecisionWeekScore {
  const selected = options.decisions.map((decision) => {
    const key = outcomeKey(decision.week_open_utc, decision.symbol, decision.side);
    const outcome = options.outcomesByKey.get(key);
    if (!outcome) throw new Error(`Missing materialized path outcome for ${key}`);
    return outcome;
  });
  const score: ResearchDecisionWeekScore = {
    week_open_utc: options.weekOpenUtc,
    decision_rows: options.decisions.length,
  };
  if (options.evaluators.includes("adr_grid")) {
    const adr = selected.reduce((sum, outcome) => sum + outcome.adr_grid.adr, 0);
    score.adr_grid = {
      adr: Math.round(adr * 1_000_000) / 1_000_000,
      fills: selected.reduce((sum, outcome) => sum + outcome.adr_grid.fills, 0),
      tp: selected.reduce((sum, outcome) => sum + outcome.adr_grid.tp, 0),
      reset: selected.reduce((sum, outcome) => sum + outcome.adr_grid.reset, 0),
      week_close: selected.reduce((sum, outcome) => sum + outcome.adr_grid.week_close, 0),
      missing_price_rows: selected.reduce((sum, outcome) => sum + outcome.adr_grid.missing_price_rows, 0),
      default_adr_rows: selected.reduce((sum, outcome) => sum + outcome.adr_grid.default_adr_rows, 0),
    };
  }
  if (options.evaluators.includes("weekly_hold")) {
    const adr = selected.reduce((sum, outcome) => sum + outcome.weekly_hold.adr, 0);
    score.weekly_hold = {
      adr: Math.round(adr * 1_000_000) / 1_000_000,
      missing_price_rows: selected.reduce((sum, outcome) => sum + outcome.weekly_hold.missing_price_rows, 0),
      default_adr_rows: selected.reduce((sum, outcome) => sum + outcome.weekly_hold.default_adr_rows, 0),
    };
  }
  return score;
}

export async function evaluateResearchDecisionManifestWithPairWeekOutcomes(options: {
  manifest: ResearchDecisionManifest;
  warehouseManifestId: string;
  pathResolution?: ResearchDecisionPathResolution;
  evaluators?: ResearchDecisionEvaluatorId[];
  logProgress?: boolean;
}): Promise<ResearchDecisionEvaluationResult> {
  const startedAt = Date.now();
  resetRuntimeCacheStats();
  const manifest = attachResearchDecisionManifestHash(normalizeResearchDecisionManifest(options.manifest));
  const evaluators = options.evaluators ?? ["adr_grid", "weekly_hold"];
  const pathResolution = options.pathResolution ?? "1m";
  const weeks = Array.from(new Set(manifest.decisions.map((decision) => decision.week_open_utc))).sort();
  const symbols = Array.from(new Set(manifest.decisions.map((decision) => decision.symbol))).sort();
  const { manifest: warehouseManifest } = await assertPairWeekPathOutcomeWarehouseReady({
    manifestId: options.warehouseManifestId,
    expectedSymbols: symbols,
    expectedWeeks: weeks,
  });
  if (warehouseManifest.price_bundle_id !== manifest.price_bundle_id) {
    throw new Error(`Warehouse price_bundle_id ${warehouseManifest.price_bundle_id} does not match manifest ${manifest.price_bundle_id}`);
  }
  if (warehouseManifest.path_resolution !== pathResolution) {
    throw new Error(`Warehouse path_resolution ${warehouseManifest.path_resolution} does not match requested ${pathResolution}`);
  }
  if (warehouseManifest.evaluator_version !== RESEARCH_DECISION_EVALUATOR_VERSION) {
    throw new Error(`Warehouse evaluator_version ${warehouseManifest.evaluator_version} does not match ${RESEARCH_DECISION_EVALUATOR_VERSION}`);
  }
  if (warehouseManifest.path_contract_id !== RESEARCH_DECISION_PATH_CONTRACT_ID) {
    throw new Error(`Warehouse path_contract_id ${warehouseManifest.path_contract_id} does not match ${RESEARCH_DECISION_PATH_CONTRACT_ID}`);
  }
  if (warehouseManifest.evaluator_params_hash !== getPairWeekPathOutcomeEvaluatorParamsHash()) {
    throw new Error(`Warehouse evaluator_params_hash ${warehouseManifest.evaluator_params_hash} does not match current evaluator params`);
  }

  const rows = await readOutcomeRows(options.warehouseManifestId);
  const outcomesByKey = new Map<string, ResearchDecisionPairPathOutcome>();
  for (const row of rows) {
    const outcome = dbRowToOutcome(row);
    outcomesByKey.set(outcomeKey(outcome.week_open_utc, outcome.symbol, outcome.direction), outcome);
  }
  const byWeek = new Map<string, ResearchDecisionManifest["decisions"]>();
  for (const decision of manifest.decisions) {
    const key = decision.week_open_utc;
    byWeek.set(key, [...(byWeek.get(key) ?? []), decision]);
  }
  const weeklyScores: ResearchDecisionWeekScore[] = [];
  for (const [weekIndex, weekOpenUtc] of weeks.entries()) {
    const startedWeekAt = Date.now();
    weeklyScores.push(aggregateOutcomesForDecisions({
      weekOpenUtc,
      decisions: byWeek.get(weekOpenUtc) ?? [],
      outcomesByKey,
      evaluators,
    }));
    if (options.logProgress) {
      console.log([
        `aggregateWeek=${weekIndex + 1}/${weeks.length}`,
        `week=${weekOpenUtc.slice(0, 10)}`,
        `rows=${byWeek.get(weekOpenUtc)?.length ?? 0}`,
        `elapsed=${((Date.now() - startedWeekAt) / 1000).toFixed(2)}s`,
      ].join(" | "));
    }
  }

  return buildResearchDecisionEvaluationResult({
    manifest,
    evaluators,
    pathResolution,
    weeklyScores,
    runtime: {
      ...buildRuntimeTelemetry({
        mode: "warehouse_aggregation",
        startedAt,
        manifestCount: 1,
        unionWeekCount: weeks.length,
        rowCountEvaluated: manifest.decisions.length,
        clearRuntimeCacheBetweenWeeks: false,
        logProgress: Boolean(options.logProgress),
      }),
      cache: getRuntimeCacheStats(),
    },
  });
}
