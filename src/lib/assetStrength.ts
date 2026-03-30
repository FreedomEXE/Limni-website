/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: assetStrength.ts
 *
 * Description:
 * Computes and stores crypto/commodity/index strength snapshots from OANDA H1 candles.
 * Strength is raw % change vs USD, normalized to 0-100 within each asset class.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { DateTime } from "luxon";

import { getPool } from "./db";
import { PAIRS_BY_ASSET_CLASS } from "./cotPairs";
import { fetchOandaCandleSeries, type OandaHourlyCandle } from "./oandaPrices";

export type AssetClass = "crypto" | "commodities" | "indices";
export type AssetStrengthWindow = "1h" | "4h" | "24h";

export type AssetStrengthSnapshot = {
  asset: string;
  raw: number;
  normalized: number;
};

export type AssetStrengthResult = {
  snapshotTimeUtc: string;
  assetClass: AssetClass;
  window: AssetStrengthWindow;
  strengths: AssetStrengthSnapshot[];
};

type AssetPairMapping = {
  pair: string;
  asset: string;
};

type DbStrengthRow = {
  snapshot_time_utc: Date | string;
  asset_class: AssetClass;
  window: AssetStrengthWindow;
  asset: string;
  raw_strength: string | number;
  normalized_strength: string | number;
};

type CacheEntry = {
  asOfHourUtc: string;
  expiresAtMs: number;
  results: AssetStrengthResult[];
};

const HOURS_TO_WINDOW: Record<1 | 4 | 24, AssetStrengthWindow> = {
  1: "1h",
  4: "4h",
  24: "24h",
};

const ASSET_CLASS_MAP: Record<AssetClass, AssetPairMapping[]> = {
  crypto: PAIRS_BY_ASSET_CLASS.crypto.map((pairDef) => ({
    pair: pairDef.pair.trim().toUpperCase(),
    asset: pairDef.base.trim().toUpperCase(),
  })),
  commodities: PAIRS_BY_ASSET_CLASS.commodities.map((pairDef) => ({
    pair: pairDef.pair.trim().toUpperCase(),
    asset: pairDef.base.trim().toUpperCase(),
  })),
  indices: PAIRS_BY_ASSET_CLASS.indices.map((pairDef) => ({
    pair: pairDef.pair.trim().toUpperCase(),
    asset: pairDef.base.trim().toUpperCase(),
  })),
};

let assetStrengthCache: CacheEntry | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cloneResult(result: AssetStrengthResult): AssetStrengthResult {
  return {
    snapshotTimeUtc: result.snapshotTimeUtc,
    assetClass: result.assetClass,
    window: result.window,
    strengths: result.strengths.map((row) => ({ ...row })),
  };
}

function normalizeAsOfHour(asOfUtc?: DateTime): DateTime {
  const raw = (asOfUtc ?? DateTime.utc()).toUTC();
  return raw.startOf("hour");
}

function toIsoUtc(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = DateTime.fromISO(String(value), { zone: "utc" });
  return parsed.isValid ? parsed.toISO() ?? String(value) : String(value);
}

function toNumber(value: string | number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeClassWindowStrength(
  assetClass: AssetClass,
  windowHours: 1 | 4 | 24,
  asOfHourUtc: DateTime,
  candlesByPair: Map<string, OandaHourlyCandle[]>,
): AssetStrengthResult {
  const assets = ASSET_CLASS_MAP[assetClass];
  const windowStartMs = asOfHourUtc.minus({ hours: windowHours }).toMillis();
  const asOfMs = asOfHourUtc.toMillis();

  const rawRows = assets.map(({ pair, asset }) => {
    const candles = (candlesByPair.get(pair) ?? []).filter(
      (row) => row.ts >= windowStartMs && row.ts < asOfMs,
    );
    if (candles.length < 1) return { asset, raw: 0 };
    const first = candles[0];
    const last = candles[candles.length - 1];
    if (!(first.open > 0)) return { asset, raw: 0 };
    const raw = ((last.close - first.open) / first.open) * 100;
    return { asset, raw };
  });

  const minRaw = Math.min(...rawRows.map((row) => row.raw));
  const maxRaw = Math.max(...rawRows.map((row) => row.raw));
  const span = maxRaw - minRaw;

  const strengths = rawRows.map((row) => ({
    asset: row.asset,
    raw: row.raw,
    normalized: span > 1e-12 ? ((row.raw - minRaw) / span) * 100 : 50,
  }));

  return {
    snapshotTimeUtc: asOfHourUtc.toISO() ?? new Date(asOfHourUtc.toMillis()).toISOString(),
    assetClass,
    window: HOURS_TO_WINDOW[windowHours],
    strengths,
  };
}

async function fetch24hH1Candles(asOfHourUtc: DateTime): Promise<Map<string, OandaHourlyCandle[]>> {
  const fromUtc = asOfHourUtc.minus({ hours: 24 });
  const out = new Map<string, OandaHourlyCandle[]>();
  const pairs = Array.from(
    new Set(
      [...ASSET_CLASS_MAP.crypto, ...ASSET_CLASS_MAP.commodities, ...ASSET_CLASS_MAP.indices].map(
        (row) => row.pair,
      ),
    ),
  );

  for (const pair of pairs) {
    await sleep(100);
    try {
      const candles = await fetchOandaCandleSeries(pair, fromUtc, asOfHourUtc);
      out.set(pair, [...candles].sort((a, b) => a.ts - b.ts));
    } catch {
      out.set(pair, []);
    }
  }

  return out;
}

export function isAssetClass(value: string | null | undefined): value is AssetClass {
  return value === "crypto" || value === "commodities" || value === "indices";
}

export async function computeAssetClassStrength(
  assetClass: AssetClass,
  windowHours: 1 | 4 | 24,
  asOfUtc?: DateTime,
): Promise<AssetStrengthResult> {
  const window = HOURS_TO_WINDOW[windowHours];
  const all = await computeAllWindowsForClass(assetClass, asOfUtc);
  const found = all.find((row) => row.window === window);
  if (!found) {
    throw new Error(`Asset strength window ${window} not computed for class ${assetClass}.`);
  }
  return cloneResult(found);
}

export async function computeAllWindowsForClass(
  assetClass: AssetClass,
  asOfUtc?: DateTime,
): Promise<AssetStrengthResult[]> {
  const all = await computeAllAssetStrengths(asOfUtc);
  return all
    .filter((row) => row.assetClass === assetClass)
    .map(cloneResult);
}

export async function computeAllAssetStrengths(asOfUtc?: DateTime): Promise<AssetStrengthResult[]> {
  const asOfHourUtc = normalizeAsOfHour(asOfUtc);
  const asOfIso = asOfHourUtc.toISO() ?? new Date(asOfHourUtc.toMillis()).toISOString();
  const nowMs = Date.now();
  if (
    assetStrengthCache &&
    assetStrengthCache.asOfHourUtc === asOfIso &&
    assetStrengthCache.expiresAtMs > nowMs
  ) {
    return assetStrengthCache.results.map(cloneResult);
  }

  const candlesByPair = await fetch24hH1Candles(asOfHourUtc);
  const results: AssetStrengthResult[] = [];
  for (const assetClass of ["crypto", "commodities", "indices"] as const) {
    results.push(
      computeClassWindowStrength(assetClass, 1, asOfHourUtc, candlesByPair),
      computeClassWindowStrength(assetClass, 4, asOfHourUtc, candlesByPair),
      computeClassWindowStrength(assetClass, 24, asOfHourUtc, candlesByPair),
    );
  }

  assetStrengthCache = {
    asOfHourUtc: asOfIso,
    expiresAtMs: nowMs + 5 * 60 * 1000,
    results: results.map(cloneResult),
  };
  return results.map(cloneResult);
}

export async function writeAssetStrengthSnapshots(results: AssetStrengthResult[]): Promise<number> {
  const pool = getPool();
  const client = await pool.connect();
  let rowsWritten = 0;

  try {
    await client.query("BEGIN");
    for (const result of results) {
      for (const row of result.strengths) {
        const response = await client.query(
          `
            INSERT INTO asset_strength_snapshots (
              snapshot_time_utc,
              asset_class,
              "window",
              asset,
              raw_strength,
              normalized_strength,
              source
            )
            VALUES ($1::timestamp, $2, $3, $4, $5, $6, 'OANDA')
            ON CONFLICT (snapshot_time_utc, "window", asset)
            DO UPDATE SET
              asset_class = EXCLUDED.asset_class,
              raw_strength = EXCLUDED.raw_strength,
              normalized_strength = EXCLUDED.normalized_strength,
              source = EXCLUDED.source
          `,
          [
            result.snapshotTimeUtc,
            result.assetClass,
            result.window,
            row.asset,
            row.raw,
            row.normalized,
          ],
        );
        rowsWritten += response.rowCount ?? 0;
      }
    }
    await client.query("COMMIT");
    return rowsWritten;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function readLatestAssetStrength(
  assetClass: AssetClass,
  window: AssetStrengthWindow,
): Promise<AssetStrengthResult | null> {
  const pool = getPool();
  const latest = await pool.query<{ snapshot_time_utc: Date | string }>(
    `
      SELECT snapshot_time_utc
      FROM asset_strength_snapshots
      WHERE asset_class = $1
        AND "window" = $2
      ORDER BY snapshot_time_utc DESC
      LIMIT 1
    `,
    [assetClass, window],
  );
  if (latest.rows.length === 0) return null;

  const rawSnapshotTime = latest.rows[0].snapshot_time_utc;
  const rows = await pool.query<DbStrengthRow>(
    `
      SELECT snapshot_time_utc, asset_class, "window", asset, raw_strength, normalized_strength
      FROM asset_strength_snapshots
      WHERE asset_class = $1
        AND "window" = $2
        AND snapshot_time_utc = $3::timestamp
      ORDER BY normalized_strength DESC, asset ASC
    `,
    [assetClass, window, rawSnapshotTime],
  );
  if (rows.rows.length === 0) return null;

  const snapshotTimeUtc = toIsoUtc(rawSnapshotTime);
  return {
    snapshotTimeUtc,
    assetClass,
    window,
    strengths: rows.rows.map((row) => ({
      asset: row.asset,
      raw: toNumber(row.raw_strength),
      normalized: toNumber(row.normalized_strength),
    })),
  };
}

export async function readAssetStrengthHistory(
  asset: string,
  window: AssetStrengthWindow,
  hoursBack: number,
): Promise<Array<{ snapshotTimeUtc: string; raw: number; normalized: number }>> {
  const normalizedAsset = String(asset ?? "").trim().toUpperCase();
  if (!normalizedAsset) return [];

  const cappedHoursBack = Math.max(1, Math.trunc(hoursBack));
  const fromUtc = DateTime.utc().minus({ hours: cappedHoursBack }).toISO();
  const pool = getPool();
  const rows = await pool.query<DbStrengthRow>(
    `
      SELECT snapshot_time_utc, asset_class, "window", asset, raw_strength, normalized_strength
      FROM asset_strength_snapshots
      WHERE asset = $1
        AND "window" = $2
        AND snapshot_time_utc >= $3::timestamp
      ORDER BY snapshot_time_utc ASC
    `,
    [normalizedAsset, window, fromUtc],
  );

  return rows.rows.map((row) => ({
    snapshotTimeUtc: toIsoUtc(row.snapshot_time_utc),
    raw: toNumber(row.raw_strength),
    normalized: toNumber(row.normalized_strength),
  }));
}

export async function readAllLatestAssetStrengths(assetClass: AssetClass): Promise<AssetStrengthResult[]> {
  const windows: AssetStrengthWindow[] = ["1h", "4h", "24h"];
  const rows = await Promise.all(windows.map((window) => readLatestAssetStrength(assetClass, window)));
  return rows
    .filter((row): row is AssetStrengthResult => row !== null)
    .map(cloneResult);
}

export async function readAllLatestAssetStrengthsAll(): Promise<AssetStrengthResult[]> {
  const [crypto, commodities, indices] = await Promise.all([
    readAllLatestAssetStrengths("crypto"),
    readAllLatestAssetStrengths("commodities"),
    readAllLatestAssetStrengths("indices"),
  ]);
  return [...crypto, ...commodities, ...indices].map(cloneResult);
}
