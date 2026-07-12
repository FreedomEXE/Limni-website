import { query, transaction } from "@database/db/client";
import type { ResearchDecisionAssetClass } from "@engine/research/decisionManifest";
import type { ResearchDecisionPathResolution } from "@engine/research/decisionManifestEvaluator";
import { sha256Stable } from "@engine/research/hash";

export const BASKET_PATH_WAREHOUSE_SCHEMA_VERSION = 1;
export const BASKET_PATH_WAREHOUSE_VERSION = "basket_path_points_v1";

export type BasketPathWarehouseConfig = {
  schema_version: typeof BASKET_PATH_WAREHOUSE_SCHEMA_VERSION;
  warehouse_version: typeof BASKET_PATH_WAREHOUSE_VERSION;
  point_contract_id: string;
  price_bundle_id: string;
  asset_class: ResearchDecisionAssetClass;
  path_resolution: ResearchDecisionPathResolution;
  candidate_id: string;
  locked_algorithm_id: string;
  candidate_b_ledger_hash: string;
  entry_exposure_model_id: string;
  adr_target_pct: number;
  symbols: string[];
  weeks: string[];
};

export type BasketPathWarehouseManifest = {
  manifest_id: string;
  schema_version: number;
  warehouse_version: string;
  point_contract_id: string;
  price_bundle_id: string;
  asset_class: ResearchDecisionAssetClass;
  path_resolution: ResearchDecisionPathResolution;
  candidate_id: string;
  locked_algorithm_id: string;
  candidate_b_ledger_hash: string;
  entry_exposure_model_id: string;
  adr_target_pct: number;
  config_hash: string;
  warehouse_hash: string | null;
  status: "building" | "complete" | "failed";
  universe_symbols: string[];
  week_count: number;
  expected_weeks: number;
  point_count: number;
  coverage: Record<string, unknown>;
  created_at_utc: string;
  completed_at_utc: string | null;
};

export type BasketPathWarehousePoint = {
  timestamp_utc: string;
  total_adr: number;
};

export type BasketPathWarehouseWeek = {
  week_open_utc: string;
  diagnostic: Record<string, unknown>;
  points: BasketPathWarehousePoint[];
  point_count: number;
  points_hash: string;
  diagnostic_hash: string;
};

export type BasketPathWarehouseInspection = {
  manifest_id: string;
  config_hash: string;
  warehouse_hash: string;
  expected_weeks: number;
  week_count: number;
  missing_week_count: number;
  duplicate_week_count: number;
  point_count: number;
  row_counts_by_week: Record<string, number>;
  missing_weeks_sample: string[];
};

type ManifestDbRow = {
  manifest_id: string;
  schema_version: number;
  warehouse_version: string;
  point_contract_id: string;
  price_bundle_id: string;
  asset_class: ResearchDecisionAssetClass;
  path_resolution: ResearchDecisionPathResolution;
  candidate_id: string;
  locked_algorithm_id: string;
  candidate_b_ledger_hash: string;
  entry_exposure_model_id: string;
  adr_target_pct: number | string;
  config_hash: string;
  warehouse_hash: string | null;
  status: "building" | "complete" | "failed";
  universe_symbols: string[] | string;
  week_count: number | string;
  expected_weeks: number | string;
  point_count: number | string;
  coverage: Record<string, unknown> | string;
  created_at: Date;
  completed_at: Date | null;
};

type WeekDbRow = {
  week_open_utc: Date | string;
  diagnostic_json: Record<string, unknown> | string;
  point_count: number | string;
  points_hash: string;
  diagnostic_hash: string;
};

type PointDbRow = {
  timestamp_utc: Date | string;
  total_adr: number | string;
};

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS research_basket_path_warehouse_manifests (
  manifest_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  warehouse_version TEXT NOT NULL,
  point_contract_id TEXT NOT NULL,
  price_bundle_id TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  path_resolution TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  locked_algorithm_id TEXT NOT NULL,
  candidate_b_ledger_hash TEXT NOT NULL,
  entry_exposure_model_id TEXT NOT NULL,
  adr_target_pct DOUBLE PRECISION NOT NULL,
  config_hash TEXT NOT NULL,
  warehouse_hash TEXT,
  status TEXT NOT NULL,
  universe_symbols JSONB NOT NULL DEFAULT '[]'::jsonb,
  week_count INTEGER NOT NULL DEFAULT 0,
  expected_weeks INTEGER NOT NULL,
  point_count INTEGER NOT NULL DEFAULT 0,
  coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_research_basket_path_manifests_lookup
  ON research_basket_path_warehouse_manifests (
    price_bundle_id,
    path_resolution,
    candidate_id,
    entry_exposure_model_id
  );

CREATE TABLE IF NOT EXISTS research_basket_path_week_diagnostics (
  manifest_id TEXT NOT NULL REFERENCES research_basket_path_warehouse_manifests(manifest_id) ON DELETE CASCADE,
  week_open_utc TIMESTAMPTZ NOT NULL,
  diagnostic_json JSONB NOT NULL,
  point_count INTEGER NOT NULL,
  points_hash TEXT NOT NULL,
  diagnostic_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (manifest_id, week_open_utc)
);

CREATE TABLE IF NOT EXISTS research_basket_path_points (
  manifest_id TEXT NOT NULL REFERENCES research_basket_path_warehouse_manifests(manifest_id) ON DELETE CASCADE,
  week_open_utc TIMESTAMPTZ NOT NULL,
  point_index INTEGER NOT NULL,
  timestamp_utc TIMESTAMPTZ NOT NULL,
  total_adr DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (manifest_id, week_open_utc, point_index)
);

CREATE INDEX IF NOT EXISTS idx_research_basket_path_points_lookup
  ON research_basket_path_points (manifest_id, week_open_utc, point_index);
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

function parseJson<T>(value: T | string): T {
  return typeof value === "string" ? JSON.parse(value) as T : value;
}

function weekKey(value: Date | string) {
  return iso(value);
}

export function buildBasketPathWarehouseConfig(options: {
  pointContractId: string;
  priceBundleId: string;
  assetClass: ResearchDecisionAssetClass;
  pathResolution: ResearchDecisionPathResolution;
  candidateId: string;
  lockedAlgorithmId: string;
  candidateBLedgerHash: string;
  entryExposureModelId: string;
  adrTargetPct: number;
  symbols: string[];
  weeks: string[];
}): BasketPathWarehouseConfig {
  return {
    schema_version: BASKET_PATH_WAREHOUSE_SCHEMA_VERSION,
    warehouse_version: BASKET_PATH_WAREHOUSE_VERSION,
    point_contract_id: options.pointContractId,
    price_bundle_id: options.priceBundleId,
    asset_class: options.assetClass,
    path_resolution: options.pathResolution,
    candidate_id: options.candidateId,
    locked_algorithm_id: options.lockedAlgorithmId,
    candidate_b_ledger_hash: options.candidateBLedgerHash.toUpperCase(),
    entry_exposure_model_id: options.entryExposureModelId,
    adr_target_pct: options.adrTargetPct,
    symbols: normalizeSymbols(options.symbols),
    weeks: normalizeWeeks(options.weeks),
  };
}

export function hashBasketPathWarehouseConfig(config: BasketPathWarehouseConfig) {
  return sha256Stable(config);
}

export function buildBasketPathWarehouseManifestId(config: BasketPathWarehouseConfig) {
  const hash = hashBasketPathWarehouseConfig(config);
  return `gate71bm_basket_path_${hash.slice(0, 12)}`;
}

export function hashBasketPathPoints(points: BasketPathWarehousePoint[]) {
  return sha256Stable(points.map((point, index) => ({
    point_index: index,
    timestamp_utc: new Date(point.timestamp_utc).toISOString(),
    total_adr: Number(point.total_adr),
  })));
}

export async function ensureBasketPathWarehouseSchema() {
  await query(SCHEMA_SQL);
}

export async function readBasketPathWarehouseManifest(manifestId: string): Promise<BasketPathWarehouseManifest | null> {
  await ensureBasketPathWarehouseSchema();
  const rows = await query<ManifestDbRow>(
    `SELECT manifest_id, schema_version, warehouse_version, point_contract_id,
            price_bundle_id, asset_class, path_resolution, candidate_id,
            locked_algorithm_id, candidate_b_ledger_hash,
            entry_exposure_model_id, adr_target_pct, config_hash,
            warehouse_hash, status, universe_symbols, week_count,
            expected_weeks, point_count, coverage, created_at, completed_at
       FROM research_basket_path_warehouse_manifests
      WHERE manifest_id = $1`,
    [manifestId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    manifest_id: row.manifest_id,
    schema_version: Number(row.schema_version),
    warehouse_version: row.warehouse_version,
    point_contract_id: row.point_contract_id,
    price_bundle_id: row.price_bundle_id,
    asset_class: row.asset_class,
    path_resolution: row.path_resolution,
    candidate_id: row.candidate_id,
    locked_algorithm_id: row.locked_algorithm_id,
    candidate_b_ledger_hash: row.candidate_b_ledger_hash,
    entry_exposure_model_id: row.entry_exposure_model_id,
    adr_target_pct: Number(row.adr_target_pct),
    config_hash: row.config_hash,
    warehouse_hash: row.warehouse_hash,
    status: row.status,
    universe_symbols: parseJson<string[]>(row.universe_symbols),
    week_count: Number(row.week_count),
    expected_weeks: Number(row.expected_weeks),
    point_count: Number(row.point_count),
    coverage: parseJson<Record<string, unknown>>(row.coverage),
    created_at_utc: row.created_at.toISOString(),
    completed_at_utc: row.completed_at?.toISOString() ?? null,
  };
}

export async function beginBasketPathWarehouse(options: {
  manifestId: string;
  config: BasketPathWarehouseConfig;
  overwrite?: boolean;
}) {
  await ensureBasketPathWarehouseSchema();
  const existing = await readBasketPathWarehouseManifest(options.manifestId);
  if (existing && !options.overwrite) {
    throw new Error(`Basket path warehouse manifest already exists: ${options.manifestId}. Use --overwrite to rebuild.`);
  }
  const configHash = hashBasketPathWarehouseConfig(options.config);
  await transaction(async (client) => {
    if (existing) {
      await client.query("DELETE FROM research_basket_path_warehouse_manifests WHERE manifest_id = $1", [options.manifestId]);
    }
    await client.query(
      `INSERT INTO research_basket_path_warehouse_manifests (
         manifest_id, schema_version, warehouse_version, point_contract_id,
         price_bundle_id, asset_class, path_resolution, candidate_id,
         locked_algorithm_id, candidate_b_ledger_hash, entry_exposure_model_id,
         adr_target_pct, config_hash, status, universe_symbols,
         expected_weeks, week_count, point_count, coverage
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'building',$14::jsonb,$15,0,0,'{}'::jsonb
       )`,
      [
        options.manifestId,
        options.config.schema_version,
        options.config.warehouse_version,
        options.config.point_contract_id,
        options.config.price_bundle_id,
        options.config.asset_class,
        options.config.path_resolution,
        options.config.candidate_id,
        options.config.locked_algorithm_id,
        options.config.candidate_b_ledger_hash,
        options.config.entry_exposure_model_id,
        options.config.adr_target_pct,
        configHash,
        JSON.stringify(options.config.symbols),
        options.config.weeks.length,
      ],
    );
  });
  return { configHash };
}

async function insertPointChunk(options: {
  manifestId: string;
  weekOpenUtc: string;
  points: BasketPathWarehousePoint[];
  offset: number;
}) {
  if (options.points.length === 0) return;
  const columnsPerRow = 5;
  const values: unknown[] = [];
  const placeholders = options.points.map((point, index) => {
    const start = index * columnsPerRow;
    values.push(
      options.manifestId,
      options.weekOpenUtc,
      options.offset + index,
      point.timestamp_utc,
      point.total_adr,
    );
    return `(${Array.from({ length: columnsPerRow }, (_item, offset) => `$${start + offset + 1}`).join(", ")})`;
  });
  await query(
    `INSERT INTO research_basket_path_points (
       manifest_id, week_open_utc, point_index, timestamp_utc, total_adr
     ) VALUES ${placeholders.join(", ")}`,
    values,
  );
}

export async function insertBasketPathWarehouseWeek(options: {
  manifestId: string;
  weekOpenUtc: string;
  diagnostic: Record<string, unknown>;
  diagnosticHash: string;
  points: BasketPathWarehousePoint[];
}) {
  const normalizedWeek = new Date(options.weekOpenUtc).toISOString();
  const normalizedPoints = options.points.map((point) => ({
    timestamp_utc: new Date(point.timestamp_utc).toISOString(),
    total_adr: Number(point.total_adr),
  }));
  const pointsHash = hashBasketPathPoints(normalizedPoints);
  await transaction(async (client) => {
    await client.query(
      `INSERT INTO research_basket_path_week_diagnostics (
         manifest_id, week_open_utc, diagnostic_json, point_count,
         points_hash, diagnostic_hash
       ) VALUES ($1,$2,$3::jsonb,$4,$5,$6)`,
      [
        options.manifestId,
        normalizedWeek,
        JSON.stringify(options.diagnostic),
        normalizedPoints.length,
        pointsHash,
        options.diagnosticHash,
      ],
    );
  });
  const chunkSize = 5_000;
  for (let offset = 0; offset < normalizedPoints.length; offset += chunkSize) {
    await insertPointChunk({
      manifestId: options.manifestId,
      weekOpenUtc: normalizedWeek,
      points: normalizedPoints.slice(offset, offset + chunkSize),
      offset,
    });
  }
  return { pointsHash };
}

async function readWarehouseWeekRows(manifestId: string) {
  return query<WeekDbRow>(
    `SELECT week_open_utc, diagnostic_json, point_count, points_hash,
            diagnostic_hash
       FROM research_basket_path_week_diagnostics
      WHERE manifest_id = $1
      ORDER BY week_open_utc ASC`,
    [manifestId],
  );
}

function buildWarehouseHash(rows: WeekDbRow[]) {
  return sha256Stable(rows.map((row) => ({
    week_open_utc: weekKey(row.week_open_utc),
    diagnostic_hash: row.diagnostic_hash,
    points_hash: row.points_hash,
    point_count: Number(row.point_count),
  })));
}

export async function inspectBasketPathWarehouse(options: {
  manifestId: string;
  expectedWeeks: string[];
}): Promise<BasketPathWarehouseInspection> {
  await ensureBasketPathWarehouseSchema();
  const manifest = await readBasketPathWarehouseManifest(options.manifestId);
  if (!manifest) throw new Error(`Basket path warehouse manifest not found: ${options.manifestId}`);
  const rows = await readWarehouseWeekRows(options.manifestId);
  const counts = new Map<string, number>();
  const rowCountsByWeek: Record<string, number> = {};
  let pointCount = 0;
  for (const row of rows) {
    const key = weekKey(row.week_open_utc);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    rowCountsByWeek[key] = Number(row.point_count);
    pointCount += Number(row.point_count);
  }
  const expectedWeeks = normalizeWeeks(options.expectedWeeks);
  const missingWeeks = expectedWeeks.filter((week) => !counts.has(week));
  return {
    manifest_id: options.manifestId,
    config_hash: manifest.config_hash,
    warehouse_hash: buildWarehouseHash(rows),
    expected_weeks: expectedWeeks.length,
    week_count: rows.length,
    missing_week_count: missingWeeks.length,
    duplicate_week_count: [...counts.values()].filter((count) => count > 1).length,
    point_count: pointCount,
    row_counts_by_week: Object.fromEntries(Object.entries(rowCountsByWeek).sort(([left], [right]) => left.localeCompare(right))),
    missing_weeks_sample: missingWeeks.slice(0, 25),
  };
}

export async function completeBasketPathWarehouse(options: {
  manifestId: string;
  expectedWeeks: string[];
  runtimeSeconds: number;
  coverage?: Record<string, unknown>;
}) {
  const inspection = await inspectBasketPathWarehouse({
    manifestId: options.manifestId,
    expectedWeeks: options.expectedWeeks,
  });
  if (
    inspection.week_count !== inspection.expected_weeks ||
    inspection.missing_week_count !== 0 ||
    inspection.duplicate_week_count !== 0
  ) {
    throw new Error(
      `Basket path warehouse incomplete: weeks=${inspection.week_count}/${inspection.expected_weeks}, missing=${inspection.missing_week_count}, duplicates=${inspection.duplicate_week_count}`,
    );
  }
  const coverage = {
    ...(options.coverage ?? {}),
    expected_weeks: inspection.expected_weeks,
    week_count: inspection.week_count,
    missing_week_count: inspection.missing_week_count,
    duplicate_week_count: inspection.duplicate_week_count,
    point_count: inspection.point_count,
    materialization_runtime_seconds: options.runtimeSeconds,
  };
  await query(
    `UPDATE research_basket_path_warehouse_manifests
        SET status = 'complete',
            warehouse_hash = $2,
            week_count = $3,
            point_count = $4,
            coverage = $5::jsonb,
            completed_at = NOW()
      WHERE manifest_id = $1`,
    [
      options.manifestId,
      inspection.warehouse_hash,
      inspection.week_count,
      inspection.point_count,
      JSON.stringify(coverage),
    ],
  );
  return inspection;
}

export async function markBasketPathWarehouseFailed(manifestId: string, error: unknown) {
  await query(
    `UPDATE research_basket_path_warehouse_manifests
        SET status = 'failed',
            coverage = jsonb_set(COALESCE(coverage, '{}'::jsonb), '{error}', to_jsonb($2::text), true)
      WHERE manifest_id = $1`,
    [manifestId, error instanceof Error ? error.message : String(error)],
  );
}

export async function assertBasketPathWarehouseReady(options: {
  manifestId: string;
  expectedWeeks: string[];
  config?: BasketPathWarehouseConfig;
}) {
  const manifest = await readBasketPathWarehouseManifest(options.manifestId);
  if (!manifest) throw new Error(`Basket path warehouse manifest not found: ${options.manifestId}`);
  if (manifest.status !== "complete") {
    throw new Error(`Basket path warehouse is not complete: ${options.manifestId} status=${manifest.status}`);
  }
  if (!manifest.warehouse_hash) {
    throw new Error(`Basket path warehouse has no warehouse_hash: ${options.manifestId}`);
  }
  if (options.config) {
    const configHash = hashBasketPathWarehouseConfig(options.config);
    if (manifest.config_hash !== configHash) {
      throw new Error(`Basket path warehouse config hash mismatch: recorded ${manifest.config_hash}, expected ${configHash}`);
    }
  }
  const inspection = await inspectBasketPathWarehouse({
    manifestId: options.manifestId,
    expectedWeeks: options.expectedWeeks,
  });
  if (inspection.warehouse_hash !== manifest.warehouse_hash) {
    throw new Error(`Basket path warehouse hash mismatch: recorded ${manifest.warehouse_hash}, computed ${inspection.warehouse_hash}`);
  }
  if (inspection.missing_week_count > 0 || inspection.duplicate_week_count > 0 || inspection.week_count < inspection.expected_weeks) {
    throw new Error(`Basket path warehouse incomplete: weeks=${inspection.week_count}/${inspection.expected_weeks}, missing=${inspection.missing_week_count}, duplicates=${inspection.duplicate_week_count}`);
  }
  return { manifest, inspection };
}

export async function readBasketPathWarehouseDiagnostics(options: {
  manifestId: string;
  weeks?: string[];
}) {
  await ensureBasketPathWarehouseSchema();
  const weeks = options.weeks ? normalizeWeeks(options.weeks) : null;
  const rows = weeks
    ? await query<WeekDbRow>(
        `SELECT week_open_utc, diagnostic_json, point_count, points_hash,
                diagnostic_hash
           FROM research_basket_path_week_diagnostics
          WHERE manifest_id = $1
            AND week_open_utc = ANY($2::timestamptz[])
          ORDER BY week_open_utc ASC`,
        [options.manifestId, weeks],
      )
    : await readWarehouseWeekRows(options.manifestId);
  return rows.map((row) => ({
    week_open_utc: weekKey(row.week_open_utc),
    diagnostic: parseJson<Record<string, unknown>>(row.diagnostic_json),
    point_count: Number(row.point_count),
    points_hash: row.points_hash,
    diagnostic_hash: row.diagnostic_hash,
  }));
}

export async function readBasketPathWarehouseWeek(options: {
  manifestId: string;
  weekOpenUtc: string;
}): Promise<BasketPathWarehouseWeek> {
  await ensureBasketPathWarehouseSchema();
  const normalizedWeek = new Date(options.weekOpenUtc).toISOString();
  const [diagnosticRow] = await query<WeekDbRow>(
    `SELECT week_open_utc, diagnostic_json, point_count, points_hash,
            diagnostic_hash
       FROM research_basket_path_week_diagnostics
      WHERE manifest_id = $1
        AND week_open_utc = $2::timestamptz`,
    [options.manifestId, normalizedWeek],
  );
  if (!diagnosticRow) {
    throw new Error(`Basket path warehouse week not found: ${options.manifestId} ${normalizedWeek}`);
  }
  const points = await query<PointDbRow>(
    `SELECT timestamp_utc, total_adr
       FROM research_basket_path_points
      WHERE manifest_id = $1
        AND week_open_utc = $2::timestamptz
      ORDER BY point_index ASC`,
    [options.manifestId, normalizedWeek],
  );
  return {
    week_open_utc: weekKey(diagnosticRow.week_open_utc),
    diagnostic: parseJson<Record<string, unknown>>(diagnosticRow.diagnostic_json),
    points: points.map((point) => ({
      timestamp_utc: iso(point.timestamp_utc),
      total_adr: Number(point.total_adr),
    })),
    point_count: Number(diagnosticRow.point_count),
    points_hash: diagnosticRow.points_hash,
    diagnostic_hash: diagnosticRow.diagnostic_hash,
  };
}
