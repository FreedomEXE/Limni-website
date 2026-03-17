/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: currencyStrength.ts
 *
 * Description:
 * Computes and stores internal currency strength snapshots for 8 major currencies
 * using OANDA H1 candles across the 28 FX pairs.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { DateTime } from "luxon";

import { getPool } from "./db";
import { PAIRS_BY_ASSET_CLASS } from "./cotPairs";
import { fetchOandaCandleSeries, type OandaHourlyCandle } from "./oandaPrices";

export const MAJOR_CURRENCIES = ["EUR", "USD", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF"] as const;
export type MajorCurrency = (typeof MAJOR_CURRENCIES)[number];
export type CurrencyStrengthWindow = "1h" | "4h" | "24h";

export type CurrencyStrengthSnapshot = {
  currency: MajorCurrency;
  raw: number;
  normalized: number;
};

export type CurrencyStrengthResult = {
  snapshotTimeUtc: string;
  window: CurrencyStrengthWindow;
  strengths: CurrencyStrengthSnapshot[];
};

type DbStrengthRow = {
  snapshot_time_utc: Date | string;
  window: CurrencyStrengthWindow;
  currency: MajorCurrency;
  raw_strength: string | number;
  normalized_strength: string | number;
};

type CacheEntry = {
  asOfHourUtc: string;
  expiresAtMs: number;
  results: CurrencyStrengthResult[];
};

const HOURS_TO_WINDOW: Record<1 | 4 | 24, CurrencyStrengthWindow> = {
  1: "1h",
  4: "4h",
  24: "24h",
};

const FX_PAIR_MAP = new Map<string, { base: MajorCurrency; quote: MajorCurrency }>(
  PAIRS_BY_ASSET_CLASS.fx
    .filter((pairDef) => MAJOR_CURRENCIES.includes(pairDef.base.toUpperCase() as MajorCurrency))
    .map((pairDef) => {
      const pair = pairDef.pair.trim().toUpperCase();
      const base = pairDef.base.trim().toUpperCase() as MajorCurrency;
      const quote = pairDef.quote.trim().toUpperCase() as MajorCurrency;
      return [pair, { base, quote }] as const;
    }),
);

let strengthCache: CacheEntry | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cloneResult(result: CurrencyStrengthResult): CurrencyStrengthResult {
  return {
    snapshotTimeUtc: result.snapshotTimeUtc,
    window: result.window,
    strengths: result.strengths.map((row) => ({ ...row })),
  };
}

function normalizeAsOfHour(asOfUtc?: DateTime): DateTime {
  const raw = (asOfUtc ?? DateTime.utc()).toUTC();
  return raw.startOf("hour");
}

function parseNumber(value: string | number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIsoUtc(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const dt = DateTime.fromISO(String(value), { zone: "utc" });
  return dt.isValid ? dt.toISO() ?? String(value) : String(value);
}

function computeWindowStrength(
  windowHours: 1 | 4 | 24,
  asOfHourUtc: DateTime,
  byPairCandles: Map<string, OandaHourlyCandle[]>,
): CurrencyStrengthResult {
  const contributions = new Map<MajorCurrency, number[]>(MAJOR_CURRENCIES.map((currency) => [currency, []]));
  const windowStartMs = asOfHourUtc.minus({ hours: windowHours }).toMillis();
  const asOfMs = asOfHourUtc.toMillis();

  for (const [pair, mapping] of FX_PAIR_MAP.entries()) {
    const candles = (byPairCandles.get(pair) ?? []).filter(
      (row) => row.ts >= windowStartMs && row.ts < asOfMs,
    );
    if (candles.length < 1) continue;
    const first = candles[0];
    const last = candles[candles.length - 1];
    if (!(first.open > 0)) continue;
    const returnPct = ((last.close - first.open) / first.open) * 100;
    contributions.get(mapping.base)?.push(returnPct);
    contributions.get(mapping.quote)?.push(-returnPct);
  }

  const rawRows = MAJOR_CURRENCIES.map((currency) => {
    const values = contributions.get(currency) ?? [];
    const raw = values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
    return { currency, raw };
  });

  const minRaw = Math.min(...rawRows.map((row) => row.raw));
  const maxRaw = Math.max(...rawRows.map((row) => row.raw));
  const span = maxRaw - minRaw;

  const strengths = rawRows.map((row) => ({
    currency: row.currency,
    raw: row.raw,
    normalized: span > 1e-12 ? ((row.raw - minRaw) / span) * 100 : 50,
  }));

  return {
    snapshotTimeUtc: asOfHourUtc.toISO() ?? new Date(asOfHourUtc.toMillis()).toISOString(),
    window: HOURS_TO_WINDOW[windowHours],
    strengths,
  };
}

async function fetch24hH1PairCandles(asOfHourUtc: DateTime): Promise<Map<string, OandaHourlyCandle[]>> {
  const fromUtc = asOfHourUtc.minus({ hours: 24 });
  const out = new Map<string, OandaHourlyCandle[]>();

  for (const pair of FX_PAIR_MAP.keys()) {
    await sleep(100);
    try {
      const candles = await fetchOandaCandleSeries(pair, fromUtc, asOfHourUtc);
      const normalized = [...candles].sort((a, b) => a.ts - b.ts);
      out.set(pair, normalized);
    } catch {
      out.set(pair, []);
    }
  }

  return out;
}

export function isMajorCurrency(value: string): value is MajorCurrency {
  return MAJOR_CURRENCIES.includes(value.toUpperCase() as MajorCurrency);
}

export async function computeCurrencyStrength(
  windowHours: 1 | 4 | 24,
  asOfUtc?: DateTime,
): Promise<CurrencyStrengthResult> {
  const window = HOURS_TO_WINDOW[windowHours];
  const all = await computeAllCurrencyStrengths(asOfUtc);
  const found = all.find((row) => row.window === window);
  if (!found) {
    throw new Error(`Currency strength window ${window} not computed.`);
  }
  return cloneResult(found);
}

export async function computeAllCurrencyStrengths(asOfUtc?: DateTime): Promise<CurrencyStrengthResult[]> {
  const asOfHourUtc = normalizeAsOfHour(asOfUtc);
  const asOfIso = asOfHourUtc.toISO() ?? new Date(asOfHourUtc.toMillis()).toISOString();
  const nowMs = Date.now();
  if (
    strengthCache &&
    strengthCache.asOfHourUtc === asOfIso &&
    strengthCache.expiresAtMs > nowMs
  ) {
    return strengthCache.results.map(cloneResult);
  }

  const byPairCandles = await fetch24hH1PairCandles(asOfHourUtc);
  const results: CurrencyStrengthResult[] = [
    computeWindowStrength(1, asOfHourUtc, byPairCandles),
    computeWindowStrength(4, asOfHourUtc, byPairCandles),
    computeWindowStrength(24, asOfHourUtc, byPairCandles),
  ];

  strengthCache = {
    asOfHourUtc: asOfIso,
    expiresAtMs: nowMs + 5 * 60 * 1000,
    results: results.map(cloneResult),
  };
  return results.map(cloneResult);
}

export async function writeCurrencyStrengthSnapshots(results: CurrencyStrengthResult[]): Promise<number> {
  const pool = getPool();
  const client = await pool.connect();
  let rowsWritten = 0;

  try {
    await client.query("BEGIN");
    for (const result of results) {
      for (const row of result.strengths) {
        const response = await client.query(
          `
            INSERT INTO currency_strength_snapshots (
              snapshot_time_utc,
              "window",
              currency,
              raw_strength,
              normalized_strength,
              source
            )
            VALUES ($1::timestamp, $2, $3, $4, $5, 'OANDA')
            ON CONFLICT (snapshot_time_utc, "window", currency)
            DO UPDATE SET
              raw_strength = EXCLUDED.raw_strength,
              normalized_strength = EXCLUDED.normalized_strength,
              source = EXCLUDED.source
          `,
          [
            result.snapshotTimeUtc,
            result.window,
            row.currency,
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

export async function readLatestCurrencyStrength(window: CurrencyStrengthWindow): Promise<CurrencyStrengthResult | null> {
  const pool = getPool();
  const latest = await pool.query<{ snapshot_time_utc: Date | string }>(
    `
      SELECT snapshot_time_utc
      FROM currency_strength_snapshots
      WHERE "window" = $1
      ORDER BY snapshot_time_utc DESC
      LIMIT 1
    `,
    [window],
  );
  if (latest.rows.length === 0) return null;
  const rawSnapshotTime = latest.rows[0].snapshot_time_utc;
  const rows = await pool.query<DbStrengthRow>(
    `
      SELECT snapshot_time_utc, "window", currency, raw_strength, normalized_strength
      FROM currency_strength_snapshots
      WHERE "window" = $1 AND snapshot_time_utc = $2::timestamp
      ORDER BY normalized_strength DESC, currency ASC
    `,
    [window, rawSnapshotTime],
  );
  if (rows.rows.length === 0) return null;
  const snapshotTimeUtc = toIsoUtc(rawSnapshotTime);
  return {
    snapshotTimeUtc,
    window,
    strengths: rows.rows.map((row) => ({
      currency: row.currency,
      raw: parseNumber(row.raw_strength),
      normalized: parseNumber(row.normalized_strength),
    })),
  };
}

export async function readCurrencyStrengthHistory(
  currency: MajorCurrency,
  window: CurrencyStrengthWindow,
  hoursBack: number,
): Promise<Array<{ snapshotTimeUtc: string; raw: number; normalized: number }>> {
  const cappedHoursBack = Math.max(1, Math.trunc(hoursBack));
  const fromUtc = DateTime.utc().minus({ hours: cappedHoursBack }).toISO();
  const pool = getPool();
  const rows = await pool.query<DbStrengthRow>(
    `
      SELECT snapshot_time_utc, "window", currency, raw_strength, normalized_strength
      FROM currency_strength_snapshots
      WHERE currency = $1
        AND "window" = $2
        AND snapshot_time_utc >= $3::timestamp
      ORDER BY snapshot_time_utc ASC
    `,
    [currency, window, fromUtc],
  );
  return rows.rows.map((row) => ({
    snapshotTimeUtc: toIsoUtc(row.snapshot_time_utc),
    raw: parseNumber(row.raw_strength),
    normalized: parseNumber(row.normalized_strength),
  }));
}

export async function readAllLatestStrengths(): Promise<CurrencyStrengthResult[]> {
  const windows: CurrencyStrengthWindow[] = ["1h", "4h", "24h"];
  const results = await Promise.all(windows.map((window) => readLatestCurrencyStrength(window)));
  return results
    .filter((row): row is CurrencyStrengthResult => row !== null)
    .map(cloneResult);
}
