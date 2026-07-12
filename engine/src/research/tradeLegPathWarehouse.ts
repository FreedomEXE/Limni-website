import { gzipSync, gunzipSync } from "node:zlib";

import { query, transaction } from "@database/db/client";
import { sha256Stable, sha256Text } from "@engine/research/hash";

export const TRADE_LEG_PATH_WAREHOUSE_SCHEMA_VERSION = 1;
export const TRADE_LEG_PATH_WAREHOUSE_VERSION = "trade_leg_path_week_pair_columnar_gzip_v1";
export const TRADE_LEG_PATH_CONTRACT_ID = "gate74_trade_leg_path_base_primitives_v1";
export const TRADE_LEG_PATH_PAYLOAD_CODEC = "gzip+json+columnar_trade_leg_path_points_v1";

export type TradeLegPathWarehouseConfig = {
  schema_version: typeof TRADE_LEG_PATH_WAREHOUSE_SCHEMA_VERSION;
  warehouse_version: typeof TRADE_LEG_PATH_WAREHOUSE_VERSION;
  contract_id: typeof TRADE_LEG_PATH_CONTRACT_ID;
  path_payload_codec: typeof TRADE_LEG_PATH_PAYLOAD_CODEC;
  price_bundle_id: string;
  asset_class: string;
  path_resolution: string;
  candidate_id: string;
  locked_algorithm_id: string;
  candidate_b_ledger_hash: string;
  candidate_b_ledger_file_sha256: string;
  candidate_b_final_ledger_hash: string;
  entry_exposure_model_id: string;
  adr_target_pct: number;
  symbols: string[];
  weeks: string[];
};

export type TradeLegPathColumnarPayload = {
  schema_version: 1;
  representation: "columnar_trade_leg_path_points_v1";
  week_open_utc: string;
  pair: string;
  candidate_b_side: "LONG" | "SHORT";
  direction_streak_id: string;
  direction_still_valid: boolean;
  flip_boundary_utc: string | null;
  coverage_state: "complete" | "partial" | "missing";
  timestamp_utc: string[];
  directed_open_adr: number[];
  directed_high_adr: number[];
  directed_low_adr: number[];
  directed_close_adr: number[];
  basket_contribution_close_adr: number[];
  mfe_adr_to_date: number[];
  mae_adr_to_date: number[];
  first_green_timestamp_utc: string | null;
  first_red_timestamp_utc: string | null;
  point_hash_root: string;
};

export type TradeLegFirstTouchRow = {
  threshold_adr: number;
  first_close_index: number | null;
  first_close_timestamp_utc: string | null;
  first_touch_index: number | null;
  first_touch_timestamp_utc: string | null;
  touch_source: "close" | "high_low" | null;
  same_bar_crossed_zero: boolean | null;
};

export type TradeLegPathPairWeek = {
  week_open_utc: string;
  pair: string;
  candidate_b_side: "LONG" | "SHORT";
  final_direction: "BASE_CURRENCY" | "QUOTE_CURRENCY";
  candidate_row_key: string;
  decision_hash: string;
  direction_streak_id: string;
  direction_still_valid: boolean;
  flip_boundary_utc: string | null;
  flip_week_open_utc: string | null;
  entry_timestamp_utc: string;
  friday_cutoff_timestamp_utc: string;
  path_resolution: string;
  pair_adr_pct: number;
  adr_was_default: boolean;
  entry_price: number | null;
  expected_bar_count: number;
  actual_bar_count: number;
  point_count: number;
  coverage_state: "complete" | "partial" | "missing";
  first_bar_utc: string | null;
  last_bar_utc: string | null;
  first_green_timestamp_utc: string | null;
  first_red_timestamp_utc: string | null;
  mfe_adr: number;
  mfe_timestamp_utc: string | null;
  mae_adr: number;
  mae_timestamp_utc: string | null;
  friday_close_adr: number;
  first_touch_indexes: TradeLegFirstTouchRow[];
  path_payload: TradeLegPathColumnarPayload;
  path_hash: string;
  first_touch_hash: string;
  summary_hash: string;
  content_hash: string;
};

export type TradeLegPathWarehouseManifest = {
  manifest_id: string;
  schema_version: number;
  warehouse_version: string;
  contract_id: string;
  path_payload_codec: string;
  price_bundle_id: string;
  asset_class: string;
  path_resolution: string;
  candidate_id: string;
  locked_algorithm_id: string;
  candidate_b_ledger_hash: string;
  candidate_b_ledger_file_sha256: string;
  candidate_b_final_ledger_hash: string;
  entry_exposure_model_id: string;
  adr_target_pct: number;
  config_hash: string;
  warehouse_hash: string | null;
  status: "building" | "complete" | "failed";
  universe_symbols: string[];
  expected_weeks: number;
  week_count: number;
  expected_pair_weeks: number;
  pair_week_count: number;
  path_point_count: number;
  chunk_count: number;
  coverage: Record<string, unknown>;
  created_at_utc: string;
  completed_at_utc: string | null;
};

export type TradeLegPathWarehouseInspection = {
  manifest_id: string;
  config_hash: string;
  warehouse_hash: string;
  expected_weeks: number;
  week_count: number;
  missing_week_count: number;
  duplicate_week_count: number;
  expected_pair_weeks: number;
  pair_week_count: number;
  duplicate_pair_week_count: number;
  path_point_count: number;
  chunk_count: number;
  missing_chunks: number;
  row_counts_by_week: Record<string, number>;
  row_counts_by_pair: Record<string, number>;
  path_points_by_week: Record<string, number>;
  missing_weeks_sample: string[];
};

type ManifestDbRow = {
  manifest_id: string;
  schema_version: number | string;
  warehouse_version: string;
  contract_id: string;
  path_payload_codec: string;
  price_bundle_id: string;
  asset_class: string;
  path_resolution: string;
  candidate_id: string;
  locked_algorithm_id: string;
  candidate_b_ledger_hash: string;
  candidate_b_ledger_file_sha256: string;
  candidate_b_final_ledger_hash: string;
  entry_exposure_model_id: string;
  adr_target_pct: number | string;
  config_hash: string;
  warehouse_hash: string | null;
  status: "building" | "complete" | "failed";
  universe_symbols: string[] | string;
  expected_weeks: number | string;
  week_count: number | string;
  expected_pair_weeks: number | string;
  pair_week_count: number | string;
  path_point_count: number | string;
  chunk_count: number | string;
  coverage: Record<string, unknown> | string;
  created_at: Date;
  completed_at: Date | null;
};

type ChunkDbRow = {
  chunk_index: number | string;
  week_open_utc: Date | string;
  pair_week_count: number | string;
  path_point_count: number | string;
  chunk_hash: string;
};

type PairWeekDigestDbRow = {
  week_open_utc: Date | string;
  pair: string;
  point_count: number | string;
  content_hash: string;
};

type PairWeekSummaryDbRow = {
  week_open_utc: Date | string;
  pair: string;
  candidate_b_side: "LONG" | "SHORT";
  final_direction: "BASE_CURRENCY" | "QUOTE_CURRENCY";
  candidate_row_key: string;
  decision_hash: string;
  direction_streak_id: string;
  flip_boundary_utc: Date | string | null;
  flip_week_open_utc: Date | string | null;
  entry_timestamp_utc: Date | string;
  friday_cutoff_timestamp_utc: Date | string;
  pair_adr_pct: number | string;
  adr_was_default: boolean;
  entry_price: number | string | null;
  expected_bar_count: number | string;
  actual_bar_count: number | string;
  point_count: number | string;
  coverage_state: "complete" | "partial" | "missing";
  first_bar_utc: Date | string | null;
  last_bar_utc: Date | string | null;
  first_green_timestamp_utc: Date | string | null;
  first_red_timestamp_utc: Date | string | null;
  mfe_adr: number | string;
  mfe_timestamp_utc: Date | string | null;
  mae_adr: number | string;
  mae_timestamp_utc: Date | string | null;
  friday_close_adr: number | string;
  first_touch_indexes_json: TradeLegFirstTouchRow[] | string;
  path_payload_compressed: Buffer;
  path_hash: string;
  first_touch_hash: string;
  summary_hash: string;
  content_hash: string;
};

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS research_trade_leg_path_warehouse_manifests (
  manifest_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  warehouse_version TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  path_payload_codec TEXT NOT NULL,
  price_bundle_id TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  path_resolution TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  locked_algorithm_id TEXT NOT NULL,
  candidate_b_ledger_hash TEXT NOT NULL,
  candidate_b_ledger_file_sha256 TEXT NOT NULL,
  candidate_b_final_ledger_hash TEXT NOT NULL,
  entry_exposure_model_id TEXT NOT NULL,
  adr_target_pct DOUBLE PRECISION NOT NULL,
  config_hash TEXT NOT NULL,
  warehouse_hash TEXT,
  status TEXT NOT NULL,
  universe_symbols JSONB NOT NULL DEFAULT '[]'::jsonb,
  expected_weeks INTEGER NOT NULL,
  week_count INTEGER NOT NULL DEFAULT 0,
  expected_pair_weeks INTEGER NOT NULL,
  pair_week_count INTEGER NOT NULL DEFAULT 0,
  path_point_count INTEGER NOT NULL DEFAULT 0,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_research_trade_leg_path_manifest_lookup
  ON research_trade_leg_path_warehouse_manifests (
    price_bundle_id,
    path_resolution,
    candidate_id,
    entry_exposure_model_id
  );

CREATE TABLE IF NOT EXISTS research_trade_leg_path_pair_weeks (
  manifest_id TEXT NOT NULL REFERENCES research_trade_leg_path_warehouse_manifests(manifest_id) ON DELETE CASCADE,
  week_open_utc TIMESTAMPTZ NOT NULL,
  pair TEXT NOT NULL,
  candidate_b_side TEXT NOT NULL,
  final_direction TEXT NOT NULL,
  candidate_row_key TEXT NOT NULL,
  decision_hash TEXT NOT NULL,
  direction_streak_id TEXT NOT NULL,
  direction_still_valid BOOLEAN NOT NULL,
  flip_boundary_utc TIMESTAMPTZ,
  flip_week_open_utc TIMESTAMPTZ,
  entry_timestamp_utc TIMESTAMPTZ NOT NULL,
  friday_cutoff_timestamp_utc TIMESTAMPTZ NOT NULL,
  path_resolution TEXT NOT NULL,
  pair_adr_pct DOUBLE PRECISION NOT NULL,
  adr_was_default BOOLEAN NOT NULL,
  entry_price DOUBLE PRECISION,
  expected_bar_count INTEGER NOT NULL,
  actual_bar_count INTEGER NOT NULL,
  point_count INTEGER NOT NULL,
  coverage_state TEXT NOT NULL,
  first_bar_utc TIMESTAMPTZ,
  last_bar_utc TIMESTAMPTZ,
  first_green_timestamp_utc TIMESTAMPTZ,
  first_red_timestamp_utc TIMESTAMPTZ,
  mfe_adr DOUBLE PRECISION NOT NULL,
  mfe_timestamp_utc TIMESTAMPTZ,
  mae_adr DOUBLE PRECISION NOT NULL,
  mae_timestamp_utc TIMESTAMPTZ,
  friday_close_adr DOUBLE PRECISION NOT NULL,
  first_touch_indexes_json JSONB NOT NULL,
  path_payload_codec TEXT NOT NULL,
  path_payload_compressed BYTEA NOT NULL,
  path_hash TEXT NOT NULL,
  first_touch_hash TEXT NOT NULL,
  summary_hash TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (manifest_id, week_open_utc, pair)
);

CREATE INDEX IF NOT EXISTS idx_research_trade_leg_path_pair_lookup
  ON research_trade_leg_path_pair_weeks (manifest_id, pair, week_open_utc);

CREATE INDEX IF NOT EXISTS idx_research_trade_leg_path_streak_lookup
  ON research_trade_leg_path_pair_weeks (manifest_id, direction_streak_id, week_open_utc);

CREATE TABLE IF NOT EXISTS research_trade_leg_path_chunks (
  manifest_id TEXT NOT NULL REFERENCES research_trade_leg_path_warehouse_manifests(manifest_id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  week_open_utc TIMESTAMPTZ NOT NULL,
  pair_week_count INTEGER NOT NULL,
  path_point_count INTEGER NOT NULL,
  chunk_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (manifest_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_research_trade_leg_path_chunks_lookup
  ON research_trade_leg_path_chunks (manifest_id, week_open_utc);
`;

function normalizeSymbols(symbols: string[]) {
  return Array.from(new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))).sort();
}

function normalizeWeeks(weeks: string[]) {
  return Array.from(new Set(weeks.map((week) => new Date(week).toISOString()))).sort();
}

function iso(value: Date | string | null) {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseJson<T>(value: T | string): T {
  return typeof value === "string" ? JSON.parse(value) as T : value;
}

function buildCompressedPayload(payload: TradeLegPathColumnarPayload) {
  return gzipSync(Buffer.from(JSON.stringify(payload), "utf8"), { level: 1 });
}

function decodeCompressedPayload(buffer: Buffer) {
  return JSON.parse(gunzipSync(buffer).toString("utf8")) as TradeLegPathColumnarPayload;
}

export function buildTradeLegPathWarehouseConfig(options: {
  priceBundleId: string;
  assetClass: string;
  pathResolution: string;
  candidateId: string;
  lockedAlgorithmId: string;
  candidateBLedgerHash: string;
  candidateBLedgerFileSha256: string;
  candidateBFinalLedgerHash: string;
  entryExposureModelId: string;
  adrTargetPct: number;
  symbols: string[];
  weeks: string[];
}): TradeLegPathWarehouseConfig {
  return {
    schema_version: TRADE_LEG_PATH_WAREHOUSE_SCHEMA_VERSION,
    warehouse_version: TRADE_LEG_PATH_WAREHOUSE_VERSION,
    contract_id: TRADE_LEG_PATH_CONTRACT_ID,
    path_payload_codec: TRADE_LEG_PATH_PAYLOAD_CODEC,
    price_bundle_id: options.priceBundleId,
    asset_class: options.assetClass,
    path_resolution: options.pathResolution,
    candidate_id: options.candidateId,
    locked_algorithm_id: options.lockedAlgorithmId,
    candidate_b_ledger_hash: options.candidateBLedgerHash.toUpperCase(),
    candidate_b_ledger_file_sha256: options.candidateBLedgerFileSha256.toUpperCase(),
    candidate_b_final_ledger_hash: options.candidateBFinalLedgerHash.toUpperCase(),
    entry_exposure_model_id: options.entryExposureModelId,
    adr_target_pct: options.adrTargetPct,
    symbols: normalizeSymbols(options.symbols),
    weeks: normalizeWeeks(options.weeks),
  };
}

export function hashTradeLegPathWarehouseConfig(config: TradeLegPathWarehouseConfig) {
  return sha256Stable(config);
}

export function buildTradeLegPathWarehouseManifestId(config: TradeLegPathWarehouseConfig) {
  return `gate74b_trade_leg_path_${hashTradeLegPathWarehouseConfig(config).slice(0, 12)}`;
}

export function hashTradeLegPathPayload(payload: TradeLegPathColumnarPayload) {
  return sha256Text(JSON.stringify(payload));
}

export function hashTradeLegFirstTouches(firstTouches: TradeLegFirstTouchRow[]) {
  return sha256Stable(firstTouches);
}

export async function ensureTradeLegPathWarehouseSchema() {
  await query(SCHEMA_SQL);
}

export async function readTradeLegPathWarehouseManifest(manifestId: string): Promise<TradeLegPathWarehouseManifest | null> {
  await ensureTradeLegPathWarehouseSchema();
  const [row] = await query<ManifestDbRow>(
    `SELECT manifest_id, schema_version, warehouse_version, contract_id,
            path_payload_codec, price_bundle_id, asset_class, path_resolution,
            candidate_id, locked_algorithm_id, candidate_b_ledger_hash,
            candidate_b_ledger_file_sha256, candidate_b_final_ledger_hash,
            entry_exposure_model_id, adr_target_pct, config_hash,
            warehouse_hash, status, universe_symbols, expected_weeks,
            week_count, expected_pair_weeks, pair_week_count,
            path_point_count, chunk_count, coverage, created_at, completed_at
       FROM research_trade_leg_path_warehouse_manifests
      WHERE manifest_id = $1`,
    [manifestId],
  );
  if (!row) return null;
  return {
    manifest_id: row.manifest_id,
    schema_version: Number(row.schema_version),
    warehouse_version: row.warehouse_version,
    contract_id: row.contract_id,
    path_payload_codec: row.path_payload_codec,
    price_bundle_id: row.price_bundle_id,
    asset_class: row.asset_class,
    path_resolution: row.path_resolution,
    candidate_id: row.candidate_id,
    locked_algorithm_id: row.locked_algorithm_id,
    candidate_b_ledger_hash: row.candidate_b_ledger_hash,
    candidate_b_ledger_file_sha256: row.candidate_b_ledger_file_sha256,
    candidate_b_final_ledger_hash: row.candidate_b_final_ledger_hash,
    entry_exposure_model_id: row.entry_exposure_model_id,
    adr_target_pct: Number(row.adr_target_pct),
    config_hash: row.config_hash,
    warehouse_hash: row.warehouse_hash,
    status: row.status,
    universe_symbols: parseJson<string[]>(row.universe_symbols),
    expected_weeks: Number(row.expected_weeks),
    week_count: Number(row.week_count),
    expected_pair_weeks: Number(row.expected_pair_weeks),
    pair_week_count: Number(row.pair_week_count),
    path_point_count: Number(row.path_point_count),
    chunk_count: Number(row.chunk_count),
    coverage: parseJson<Record<string, unknown>>(row.coverage),
    created_at_utc: row.created_at.toISOString(),
    completed_at_utc: row.completed_at?.toISOString() ?? null,
  };
}

export async function beginTradeLegPathWarehouse(options: {
  manifestId: string;
  config: TradeLegPathWarehouseConfig;
  overwrite?: boolean;
}) {
  await ensureTradeLegPathWarehouseSchema();
  const existing = await readTradeLegPathWarehouseManifest(options.manifestId);
  if (existing && !options.overwrite) {
    throw new Error(`Trade-leg path warehouse manifest already exists: ${options.manifestId}. Use --overwrite to rebuild.`);
  }
  const configHash = hashTradeLegPathWarehouseConfig(options.config);
  await transaction(async (client) => {
    if (existing) {
      await client.query("DELETE FROM research_trade_leg_path_warehouse_manifests WHERE manifest_id = $1", [options.manifestId]);
    }
    await client.query(
      `INSERT INTO research_trade_leg_path_warehouse_manifests (
         manifest_id, schema_version, warehouse_version, contract_id,
         path_payload_codec, price_bundle_id, asset_class, path_resolution,
         candidate_id, locked_algorithm_id, candidate_b_ledger_hash,
         candidate_b_ledger_file_sha256, candidate_b_final_ledger_hash,
         entry_exposure_model_id, adr_target_pct, config_hash, status,
         universe_symbols, expected_weeks, expected_pair_weeks
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
         'building',$17::jsonb,$18,$19
       )`,
      [
        options.manifestId,
        options.config.schema_version,
        options.config.warehouse_version,
        options.config.contract_id,
        options.config.path_payload_codec,
        options.config.price_bundle_id,
        options.config.asset_class,
        options.config.path_resolution,
        options.config.candidate_id,
        options.config.locked_algorithm_id,
        options.config.candidate_b_ledger_hash,
        options.config.candidate_b_ledger_file_sha256,
        options.config.candidate_b_final_ledger_hash,
        options.config.entry_exposure_model_id,
        options.config.adr_target_pct,
        configHash,
        JSON.stringify(options.config.symbols),
        options.config.weeks.length,
        options.config.weeks.length * options.config.symbols.length,
      ],
    );
  });
  return { configHash };
}

export async function insertTradeLegPathWarehouseWeek(options: {
  manifestId: string;
  chunkIndex: number;
  weekOpenUtc: string;
  rows: TradeLegPathPairWeek[];
}) {
  const normalizedWeek = new Date(options.weekOpenUtc).toISOString();
  if (options.rows.length === 0) return { chunkHash: sha256Stable([]), pointCount: 0 };
  const chunkHash = sha256Stable(options.rows.map((row) => ({
    week_open_utc: new Date(row.week_open_utc).toISOString(),
    pair: row.pair,
    point_count: row.point_count,
    content_hash: row.content_hash,
  })));
  const pointCount = options.rows.reduce((sum, row) => sum + row.point_count, 0);
  await transaction(async (client) => {
    const columnsPerRow = 37;
    const values: unknown[] = [];
    const placeholders = options.rows.map((row, rowIndex) => {
      const start = rowIndex * columnsPerRow;
      values.push(
        options.manifestId,
        new Date(row.week_open_utc).toISOString(),
        row.pair,
        row.candidate_b_side,
        row.final_direction,
        row.candidate_row_key,
        row.decision_hash,
        row.direction_streak_id,
        row.direction_still_valid,
        row.flip_boundary_utc,
        row.flip_week_open_utc,
        row.entry_timestamp_utc,
        row.friday_cutoff_timestamp_utc,
        row.path_resolution,
        row.pair_adr_pct,
        row.adr_was_default,
        row.entry_price,
        row.expected_bar_count,
        row.actual_bar_count,
        row.point_count,
        row.coverage_state,
        row.first_bar_utc,
        row.last_bar_utc,
        row.first_green_timestamp_utc,
        row.first_red_timestamp_utc,
        row.mfe_adr,
        row.mfe_timestamp_utc,
        row.mae_adr,
        row.mae_timestamp_utc,
        row.friday_close_adr,
        JSON.stringify(row.first_touch_indexes),
        TRADE_LEG_PATH_PAYLOAD_CODEC,
        buildCompressedPayload(row.path_payload),
        row.path_hash,
        row.first_touch_hash,
        row.summary_hash,
        row.content_hash,
      );
      return `(${Array.from({ length: columnsPerRow }, (_item, offset) => {
        const parameter = `$${start + offset + 1}`;
        return offset === 30 ? `${parameter}::jsonb` : parameter;
      }).join(", ")})`;
    });
    await client.query(
      `INSERT INTO research_trade_leg_path_pair_weeks (
         manifest_id, week_open_utc, pair, candidate_b_side, final_direction,
         candidate_row_key, decision_hash, direction_streak_id,
         direction_still_valid, flip_boundary_utc, flip_week_open_utc,
         entry_timestamp_utc, friday_cutoff_timestamp_utc, path_resolution,
         pair_adr_pct, adr_was_default, entry_price, expected_bar_count,
         actual_bar_count, point_count, coverage_state, first_bar_utc,
         last_bar_utc, first_green_timestamp_utc, first_red_timestamp_utc,
         mfe_adr, mfe_timestamp_utc, mae_adr, mae_timestamp_utc,
         friday_close_adr, first_touch_indexes_json, path_payload_codec,
         path_payload_compressed, path_hash, first_touch_hash,
         summary_hash, content_hash
       ) VALUES ${placeholders.join(", ")}`,
      values,
    );
    await client.query(
      `INSERT INTO research_trade_leg_path_chunks (
         manifest_id, chunk_index, week_open_utc, pair_week_count,
         path_point_count, chunk_hash
       ) VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        options.manifestId,
        options.chunkIndex,
        normalizedWeek,
        options.rows.length,
        pointCount,
        chunkHash,
      ],
    );
  });
  return { chunkHash, pointCount };
}

async function readChunkRows(manifestId: string) {
  return query<ChunkDbRow>(
    `SELECT chunk_index, week_open_utc, pair_week_count, path_point_count, chunk_hash
       FROM research_trade_leg_path_chunks
      WHERE manifest_id = $1
      ORDER BY chunk_index ASC`,
    [manifestId],
  );
}

function buildWarehouseHash(chunks: ChunkDbRow[]) {
  return sha256Stable(chunks.map((chunk) => ({
    chunk_index: Number(chunk.chunk_index),
    week_open_utc: iso(chunk.week_open_utc),
    pair_week_count: Number(chunk.pair_week_count),
    path_point_count: Number(chunk.path_point_count),
    chunk_hash: chunk.chunk_hash,
  })));
}

export async function inspectTradeLegPathWarehouse(options: {
  manifestId: string;
  expectedWeeks: string[];
  expectedSymbols: string[];
}): Promise<TradeLegPathWarehouseInspection> {
  await ensureTradeLegPathWarehouseSchema();
  const manifest = await readTradeLegPathWarehouseManifest(options.manifestId);
  if (!manifest) throw new Error(`Trade-leg path warehouse manifest not found: ${options.manifestId}`);
  const rows = await query<PairWeekDigestDbRow>(
    `SELECT week_open_utc, pair, point_count, content_hash
       FROM research_trade_leg_path_pair_weeks
      WHERE manifest_id = $1
      ORDER BY week_open_utc ASC, pair ASC`,
    [options.manifestId],
  );
  const chunks = await readChunkRows(options.manifestId);
  const expectedWeeks = normalizeWeeks(options.expectedWeeks);
  const expectedSymbols = normalizeSymbols(options.expectedSymbols);
  const weekCounts = new Map<string, number>();
  const pairCounts = new Map<string, number>();
  const weekPointCounts = new Map<string, number>();
  const duplicateKeyCounts = new Map<string, number>();
  let pointCount = 0;
  for (const row of rows) {
    const week = iso(row.week_open_utc)!;
    const pair = row.pair.toUpperCase();
    const rowPointCount = Number(row.point_count);
    weekCounts.set(week, (weekCounts.get(week) ?? 0) + 1);
    pairCounts.set(pair, (pairCounts.get(pair) ?? 0) + 1);
    weekPointCounts.set(week, (weekPointCounts.get(week) ?? 0) + rowPointCount);
    duplicateKeyCounts.set(`${week}|${pair}`, (duplicateKeyCounts.get(`${week}|${pair}`) ?? 0) + 1);
    pointCount += rowPointCount;
  }
  const missingWeeks = expectedWeeks.filter((week) => !weekCounts.has(week));
  const chunkWeeks = new Set(chunks.map((chunk) => iso(chunk.week_open_utc)!));
  return {
    manifest_id: options.manifestId,
    config_hash: manifest.config_hash,
    warehouse_hash: buildWarehouseHash(chunks),
    expected_weeks: expectedWeeks.length,
    week_count: [...weekCounts.values()].filter((count) => count > 0).length,
    missing_week_count: missingWeeks.length,
    duplicate_week_count: [...weekCounts.values()].filter((count) => count > expectedSymbols.length).length,
    expected_pair_weeks: expectedWeeks.length * expectedSymbols.length,
    pair_week_count: rows.length,
    duplicate_pair_week_count: [...duplicateKeyCounts.values()].filter((count) => count > 1).length,
    path_point_count: pointCount,
    chunk_count: chunks.length,
    missing_chunks: expectedWeeks.filter((week) => !chunkWeeks.has(week)).length,
    row_counts_by_week: Object.fromEntries([...weekCounts.entries()].sort(([left], [right]) => left.localeCompare(right))),
    row_counts_by_pair: Object.fromEntries([...pairCounts.entries()].sort(([left], [right]) => left.localeCompare(right))),
    path_points_by_week: Object.fromEntries([...weekPointCounts.entries()].sort(([left], [right]) => left.localeCompare(right))),
    missing_weeks_sample: missingWeeks.slice(0, 25),
  };
}

export async function completeTradeLegPathWarehouse(options: {
  manifestId: string;
  expectedWeeks: string[];
  expectedSymbols: string[];
  runtimeSeconds: number;
  coverage?: Record<string, unknown>;
}) {
  const inspection = await inspectTradeLegPathWarehouse({
    manifestId: options.manifestId,
    expectedWeeks: options.expectedWeeks,
    expectedSymbols: options.expectedSymbols,
  });
  if (
    inspection.week_count !== inspection.expected_weeks ||
    inspection.missing_week_count !== 0 ||
    inspection.duplicate_pair_week_count !== 0 ||
    inspection.pair_week_count !== inspection.expected_pair_weeks ||
    inspection.missing_chunks !== 0
  ) {
    throw new Error(
      `Trade-leg path warehouse incomplete: weeks=${inspection.week_count}/${inspection.expected_weeks}, ` +
      `pairWeeks=${inspection.pair_week_count}/${inspection.expected_pair_weeks}, ` +
      `duplicates=${inspection.duplicate_pair_week_count}, missingChunks=${inspection.missing_chunks}`,
    );
  }
  const coverage = {
    ...(options.coverage ?? {}),
    expected_weeks: inspection.expected_weeks,
    week_count: inspection.week_count,
    missing_week_count: inspection.missing_week_count,
    expected_pair_weeks: inspection.expected_pair_weeks,
    pair_week_count: inspection.pair_week_count,
    duplicate_pair_week_count: inspection.duplicate_pair_week_count,
    path_point_count: inspection.path_point_count,
    chunk_count: inspection.chunk_count,
    materialization_runtime_seconds: options.runtimeSeconds,
  };
  await query(
    `UPDATE research_trade_leg_path_warehouse_manifests
        SET status = 'complete',
            warehouse_hash = $2,
            week_count = $3,
            pair_week_count = $4,
            path_point_count = $5,
            chunk_count = $6,
            coverage = $7::jsonb,
            completed_at = NOW()
      WHERE manifest_id = $1`,
    [
      options.manifestId,
      inspection.warehouse_hash,
      inspection.week_count,
      inspection.pair_week_count,
      inspection.path_point_count,
      inspection.chunk_count,
      JSON.stringify(coverage),
    ],
  );
  return inspection;
}

export async function markTradeLegPathWarehouseFailed(manifestId: string, error: unknown) {
  await query(
    `UPDATE research_trade_leg_path_warehouse_manifests
        SET status = 'failed',
            coverage = jsonb_set(COALESCE(coverage, '{}'::jsonb), '{error}', to_jsonb($2::text), true)
      WHERE manifest_id = $1`,
    [manifestId, error instanceof Error ? error.message : String(error)],
  );
}

export async function readTradeLegPathWarehousePairWeek(options: {
  manifestId: string;
  weekOpenUtc: string;
  pair: string;
}) {
  await ensureTradeLegPathWarehouseSchema();
  const [row] = await query<PairWeekSummaryDbRow>(
    `SELECT week_open_utc, pair, candidate_b_side, final_direction,
            candidate_row_key, decision_hash, direction_streak_id,
            flip_boundary_utc, flip_week_open_utc, entry_timestamp_utc,
            friday_cutoff_timestamp_utc, pair_adr_pct, adr_was_default,
            entry_price, expected_bar_count, actual_bar_count, point_count,
            coverage_state, first_bar_utc, last_bar_utc,
            first_green_timestamp_utc, first_red_timestamp_utc,
            mfe_adr, mfe_timestamp_utc, mae_adr, mae_timestamp_utc,
            friday_close_adr, first_touch_indexes_json,
            path_payload_compressed, path_hash, first_touch_hash,
            summary_hash, content_hash
       FROM research_trade_leg_path_pair_weeks
      WHERE manifest_id = $1
        AND week_open_utc = $2::timestamptz
        AND pair = $3`,
    [options.manifestId, new Date(options.weekOpenUtc).toISOString(), options.pair.toUpperCase()],
  );
  if (!row) throw new Error(`Trade-leg path pair-week not found: ${options.manifestId} ${options.weekOpenUtc} ${options.pair}`);
  return {
    week_open_utc: iso(row.week_open_utc)!,
    pair: row.pair,
    candidate_b_side: row.candidate_b_side,
    final_direction: row.final_direction,
    candidate_row_key: row.candidate_row_key,
    decision_hash: row.decision_hash,
    direction_streak_id: row.direction_streak_id,
    flip_boundary_utc: iso(row.flip_boundary_utc),
    flip_week_open_utc: iso(row.flip_week_open_utc),
    entry_timestamp_utc: iso(row.entry_timestamp_utc)!,
    friday_cutoff_timestamp_utc: iso(row.friday_cutoff_timestamp_utc)!,
    pair_adr_pct: Number(row.pair_adr_pct),
    adr_was_default: row.adr_was_default,
    entry_price: row.entry_price === null ? null : Number(row.entry_price),
    expected_bar_count: Number(row.expected_bar_count),
    actual_bar_count: Number(row.actual_bar_count),
    point_count: Number(row.point_count),
    coverage_state: row.coverage_state,
    first_bar_utc: iso(row.first_bar_utc),
    last_bar_utc: iso(row.last_bar_utc),
    first_green_timestamp_utc: iso(row.first_green_timestamp_utc),
    first_red_timestamp_utc: iso(row.first_red_timestamp_utc),
    mfe_adr: Number(row.mfe_adr),
    mfe_timestamp_utc: iso(row.mfe_timestamp_utc),
    mae_adr: Number(row.mae_adr),
    mae_timestamp_utc: iso(row.mae_timestamp_utc),
    friday_close_adr: Number(row.friday_close_adr),
    first_touch_indexes: parseJson<TradeLegFirstTouchRow[]>(row.first_touch_indexes_json),
    path_payload: decodeCompressedPayload(row.path_payload_compressed),
    path_hash: row.path_hash,
    first_touch_hash: row.first_touch_hash,
    summary_hash: row.summary_hash,
    content_hash: row.content_hash,
  };
}

function mapPairWeekSummaryRow(row: PairWeekSummaryDbRow) {
  return {
    week_open_utc: iso(row.week_open_utc)!,
    pair: row.pair,
    candidate_b_side: row.candidate_b_side,
    final_direction: row.final_direction,
    candidate_row_key: row.candidate_row_key,
    decision_hash: row.decision_hash,
    direction_streak_id: row.direction_streak_id,
    flip_boundary_utc: iso(row.flip_boundary_utc),
    flip_week_open_utc: iso(row.flip_week_open_utc),
    entry_timestamp_utc: iso(row.entry_timestamp_utc)!,
    friday_cutoff_timestamp_utc: iso(row.friday_cutoff_timestamp_utc)!,
    pair_adr_pct: Number(row.pair_adr_pct),
    adr_was_default: row.adr_was_default,
    entry_price: row.entry_price === null ? null : Number(row.entry_price),
    expected_bar_count: Number(row.expected_bar_count),
    actual_bar_count: Number(row.actual_bar_count),
    point_count: Number(row.point_count),
    coverage_state: row.coverage_state,
    first_bar_utc: iso(row.first_bar_utc),
    last_bar_utc: iso(row.last_bar_utc),
    first_green_timestamp_utc: iso(row.first_green_timestamp_utc),
    first_red_timestamp_utc: iso(row.first_red_timestamp_utc),
    mfe_adr: Number(row.mfe_adr),
    mfe_timestamp_utc: iso(row.mfe_timestamp_utc),
    mae_adr: Number(row.mae_adr),
    mae_timestamp_utc: iso(row.mae_timestamp_utc),
    friday_close_adr: Number(row.friday_close_adr),
    first_touch_indexes: parseJson<TradeLegFirstTouchRow[]>(row.first_touch_indexes_json),
    path_payload: decodeCompressedPayload(row.path_payload_compressed),
    path_hash: row.path_hash,
    first_touch_hash: row.first_touch_hash,
    summary_hash: row.summary_hash,
    content_hash: row.content_hash,
  };
}

export type TradeLegPathReplayPairWeek = ReturnType<typeof mapPairWeekSummaryRow>;

export async function readTradeLegPathWarehouseWeekKeys(manifestId: string) {
  await ensureTradeLegPathWarehouseSchema();
  const rows = await query<{ week_open_utc: Date | string }>(
    `SELECT DISTINCT week_open_utc
       FROM research_trade_leg_path_pair_weeks
      WHERE manifest_id = $1
      ORDER BY week_open_utc ASC`,
    [manifestId],
  );
  return rows.map((row) => iso(row.week_open_utc)!);
}

export async function readTradeLegPathWarehousePairSeries(options: {
  manifestId: string;
  pair: string;
  weeks?: string[];
}): Promise<TradeLegPathReplayPairWeek[]> {
  await ensureTradeLegPathWarehouseSchema();
  const normalizedPair = options.pair.toUpperCase();
  const weeks = options.weeks ? normalizeWeeks(options.weeks) : null;
  const rows = weeks
    ? await query<PairWeekSummaryDbRow>(
        `SELECT week_open_utc, pair, candidate_b_side, final_direction,
                candidate_row_key, decision_hash, direction_streak_id,
                flip_boundary_utc, flip_week_open_utc, entry_timestamp_utc,
                friday_cutoff_timestamp_utc, pair_adr_pct, adr_was_default,
                entry_price, expected_bar_count, actual_bar_count, point_count,
                coverage_state, first_bar_utc, last_bar_utc,
                first_green_timestamp_utc, first_red_timestamp_utc,
                mfe_adr, mfe_timestamp_utc, mae_adr, mae_timestamp_utc,
                friday_close_adr, first_touch_indexes_json,
                path_payload_compressed, path_hash, first_touch_hash,
                summary_hash, content_hash
           FROM research_trade_leg_path_pair_weeks
          WHERE manifest_id = $1
            AND pair = $2
            AND week_open_utc = ANY($3::timestamptz[])
          ORDER BY week_open_utc ASC`,
        [options.manifestId, normalizedPair, weeks],
      )
    : await query<PairWeekSummaryDbRow>(
        `SELECT week_open_utc, pair, candidate_b_side, final_direction,
                candidate_row_key, decision_hash, direction_streak_id,
                flip_boundary_utc, flip_week_open_utc, entry_timestamp_utc,
                friday_cutoff_timestamp_utc, pair_adr_pct, adr_was_default,
                entry_price, expected_bar_count, actual_bar_count, point_count,
                coverage_state, first_bar_utc, last_bar_utc,
                first_green_timestamp_utc, first_red_timestamp_utc,
                mfe_adr, mfe_timestamp_utc, mae_adr, mae_timestamp_utc,
                friday_close_adr, first_touch_indexes_json,
                path_payload_compressed, path_hash, first_touch_hash,
                summary_hash, content_hash
           FROM research_trade_leg_path_pair_weeks
          WHERE manifest_id = $1
            AND pair = $2
          ORDER BY week_open_utc ASC`,
        [options.manifestId, normalizedPair],
      );
  return rows.map(mapPairWeekSummaryRow);
}

export async function readTradeLegPathWarehouseWeekRows(options: {
  manifestId: string;
  weekOpenUtc: string;
  pairs?: string[];
}): Promise<TradeLegPathReplayPairWeek[]> {
  await ensureTradeLegPathWarehouseSchema();
  const normalizedWeek = normalizeWeeks([options.weekOpenUtc])[0]!;
  const pairs = options.pairs?.map((pair) => pair.toUpperCase()) ?? null;
  const rows = pairs
    ? await query<PairWeekSummaryDbRow>(
        `SELECT week_open_utc, pair, candidate_b_side, final_direction,
                candidate_row_key, decision_hash, direction_streak_id,
                flip_boundary_utc, flip_week_open_utc, entry_timestamp_utc,
                friday_cutoff_timestamp_utc, pair_adr_pct, adr_was_default,
                entry_price, expected_bar_count, actual_bar_count, point_count,
                coverage_state, first_bar_utc, last_bar_utc,
                first_green_timestamp_utc, first_red_timestamp_utc,
                mfe_adr, mfe_timestamp_utc, mae_adr, mae_timestamp_utc,
                friday_close_adr, first_touch_indexes_json,
                path_payload_compressed, path_hash, first_touch_hash,
                summary_hash, content_hash
           FROM research_trade_leg_path_pair_weeks
          WHERE manifest_id = $1
            AND week_open_utc = $2::timestamptz
            AND pair = ANY($3::text[])
          ORDER BY pair ASC`,
        [options.manifestId, normalizedWeek, pairs],
      )
    : await query<PairWeekSummaryDbRow>(
        `SELECT week_open_utc, pair, candidate_b_side, final_direction,
                candidate_row_key, decision_hash, direction_streak_id,
                flip_boundary_utc, flip_week_open_utc, entry_timestamp_utc,
                friday_cutoff_timestamp_utc, pair_adr_pct, adr_was_default,
                entry_price, expected_bar_count, actual_bar_count, point_count,
                coverage_state, first_bar_utc, last_bar_utc,
                first_green_timestamp_utc, first_red_timestamp_utc,
                mfe_adr, mfe_timestamp_utc, mae_adr, mae_timestamp_utc,
                friday_close_adr, first_touch_indexes_json,
                path_payload_compressed, path_hash, first_touch_hash,
                summary_hash, content_hash
           FROM research_trade_leg_path_pair_weeks
          WHERE manifest_id = $1
            AND week_open_utc = $2::timestamptz
          ORDER BY pair ASC`,
        [options.manifestId, normalizedWeek],
      );
  return rows.map(mapPairWeekSummaryRow);
}
