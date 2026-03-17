/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: daily.ts
 *
 * Description:
 * Daily sentiment lock snapshots for Flagship and daily gating.
 * Reads latest aggregates as-of a UTC timestamp and persists one
 * symbol row per UTC day.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { DateTime } from "luxon";

import { getPool } from "../db";

export type DailySentimentDirection = "LONG" | "SHORT" | "NEUTRAL";

export type DailySentimentRow = {
  snapshotDateUtc: string;
  snapshotTimeUtc: string;
  symbol: string;
  aggLongPct: number;
  aggShortPct: number;
  aggNet: number;
  confidenceScore: number;
  crowdingState: string;
  flipState: string;
  sentimentDirection: DailySentimentDirection;
  sourceMode: "DAILY_LOCK_FROM_AGG";
};

type AggregateCandidateRow = {
  symbol: string;
  timestamp_utc: Date | string;
  agg_long_pct: string | number;
  agg_short_pct: string | number;
  agg_net: string | number;
  confidence_score: string | number;
  crowding_state: string;
  flip_state: string;
};

type DailySnapshotRow = {
  snapshot_date_utc: Date | string;
  snapshot_time_utc: Date | string;
  symbol: string;
  agg_long_pct: string | number;
  agg_short_pct: string | number;
  agg_net: string | number;
  confidence_score: string | number;
  crowding_state: string;
  flip_state: string;
  sentiment_direction: DailySentimentDirection;
  source_mode: string;
};

function toNumber(value: string | number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIsoUtc(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = DateTime.fromISO(String(value), { zone: "utc" });
  if (parsed.isValid) {
    return parsed.toISO() ?? String(value);
  }
  return String(value);
}

function toDateOnly(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const parsed = DateTime.fromISO(String(value), { zone: "utc" });
  if (parsed.isValid) {
    return parsed.toISODate() ?? String(value).slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function parseAsOf(asOfUtc?: string): DateTime {
  if (!asOfUtc) {
    return DateTime.utc();
  }
  const parsed = DateTime.fromISO(asOfUtc, { zone: "utc" });
  if (!parsed.isValid) {
    throw new Error(`Invalid asOfUtc: ${asOfUtc}`);
  }
  return parsed;
}

function mapDailySnapshotRow(row: DailySnapshotRow): DailySentimentRow {
  return {
    snapshotDateUtc: toDateOnly(row.snapshot_date_utc),
    snapshotTimeUtc: toIsoUtc(row.snapshot_time_utc),
    symbol: row.symbol,
    aggLongPct: toNumber(row.agg_long_pct),
    aggShortPct: toNumber(row.agg_short_pct),
    aggNet: toNumber(row.agg_net),
    confidenceScore: toNumber(row.confidence_score),
    crowdingState: row.crowding_state,
    flipState: row.flip_state,
    sentimentDirection: row.sentiment_direction,
    sourceMode: "DAILY_LOCK_FROM_AGG",
  };
}

export function sentimentDirectionFromAggregate(
  agg: { crowding_state: string; flip_state: string },
): DailySentimentDirection {
  const flip = String(agg.flip_state ?? "").trim().toUpperCase();
  const crowding = String(agg.crowding_state ?? "").trim().toUpperCase();

  if (flip === "FLIPPED_UP") return "LONG";
  if (flip === "FLIPPED_DOWN") return "SHORT";
  if (flip === "FLIPPED_NEUTRAL") return "NEUTRAL";

  if (crowding === "CROWDED_LONG" || crowding === "EXTREME_LONG") return "SHORT";
  if (crowding === "CROWDED_SHORT" || crowding === "EXTREME_SHORT") return "LONG";

  return "NEUTRAL";
}

export async function buildDailySentimentLock(
  asOfUtc?: string,
): Promise<{ snapshotDateUtc: string; rows: DailySentimentRow[] }> {
  const asOf = parseAsOf(asOfUtc);
  const snapshotDateUtc = asOf.toISODate();
  if (!snapshotDateUtc) {
    throw new Error("Failed to derive snapshotDateUtc");
  }

  const pool = getPool();
  const response = await pool.query<AggregateCandidateRow>(
    `
      SELECT DISTINCT ON (symbol)
        symbol,
        timestamp_utc,
        agg_long_pct,
        agg_short_pct,
        agg_net,
        confidence_score,
        crowding_state,
        flip_state
      FROM sentiment_aggregates
      WHERE timestamp_utc <= $1::timestamp
      ORDER BY symbol, timestamp_utc DESC
    `,
    [asOf.toISO()],
  );

  const rows = response.rows
    .map((row): DailySentimentRow => ({
      snapshotDateUtc,
      snapshotTimeUtc: toIsoUtc(row.timestamp_utc),
      symbol: row.symbol,
      aggLongPct: toNumber(row.agg_long_pct),
      aggShortPct: toNumber(row.agg_short_pct),
      aggNet: toNumber(row.agg_net),
      confidenceScore: toNumber(row.confidence_score),
      crowdingState: row.crowding_state,
      flipState: row.flip_state,
      sentimentDirection: sentimentDirectionFromAggregate(row),
      sourceMode: "DAILY_LOCK_FROM_AGG",
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  return {
    snapshotDateUtc,
    rows,
  };
}

export async function writeDailySentimentLock(
  snapshotDateUtc: string,
  rows: DailySentimentRow[],
): Promise<number> {
  if (!rows.length) return 0;

  const parsedDate = DateTime.fromISO(snapshotDateUtc, { zone: "utc" });
  if (!parsedDate.isValid) {
    throw new Error(`Invalid snapshotDateUtc: ${snapshotDateUtc}`);
  }

  const pool = getPool();
  const client = await pool.connect();
  let rowsWritten = 0;

  try {
    await client.query("BEGIN");

    for (const row of rows) {
      const result = await client.query(
        `
          INSERT INTO sentiment_daily_snapshots (
            snapshot_date_utc,
            snapshot_time_utc,
            symbol,
            agg_long_pct,
            agg_short_pct,
            agg_net,
            confidence_score,
            crowding_state,
            flip_state,
            sentiment_direction,
            source_mode
          )
          VALUES (
            $1::date,
            $2::timestamp,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11
          )
          ON CONFLICT (snapshot_date_utc, symbol)
          DO UPDATE SET
            snapshot_time_utc = EXCLUDED.snapshot_time_utc,
            agg_long_pct = EXCLUDED.agg_long_pct,
            agg_short_pct = EXCLUDED.agg_short_pct,
            agg_net = EXCLUDED.agg_net,
            confidence_score = EXCLUDED.confidence_score,
            crowding_state = EXCLUDED.crowding_state,
            flip_state = EXCLUDED.flip_state,
            sentiment_direction = EXCLUDED.sentiment_direction,
            source_mode = EXCLUDED.source_mode
        `,
        [
          snapshotDateUtc,
          row.snapshotTimeUtc,
          row.symbol,
          row.aggLongPct,
          row.aggShortPct,
          row.aggNet,
          row.confidenceScore,
          row.crowdingState,
          row.flipState,
          row.sentimentDirection,
          row.sourceMode,
        ],
      );
      rowsWritten += result.rowCount ?? 0;
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

export async function readLatestDailySentimentLock(): Promise<
  { snapshotDateUtc: string; rows: DailySentimentRow[] } | null
> {
  const pool = getPool();
  const latest = await pool.query<{ snapshot_date_utc: Date | string }>(
    `
      SELECT snapshot_date_utc
      FROM sentiment_daily_snapshots
      ORDER BY snapshot_date_utc DESC
      LIMIT 1
    `,
  );

  if (latest.rows.length === 0) return null;

  const snapshotDateUtc = toDateOnly(latest.rows[0].snapshot_date_utc);
  const rows = await readDailySentimentLockByDate(snapshotDateUtc);
  return { snapshotDateUtc, rows };
}

export async function readDailySentimentLockByDate(
  snapshotDateUtc: string,
): Promise<DailySentimentRow[]> {
  const pool = getPool();
  const response = await pool.query<DailySnapshotRow>(
    `
      SELECT
        snapshot_date_utc,
        snapshot_time_utc,
        symbol,
        agg_long_pct,
        agg_short_pct,
        agg_net,
        confidence_score,
        crowding_state,
        flip_state,
        sentiment_direction,
        source_mode
      FROM sentiment_daily_snapshots
      WHERE snapshot_date_utc = $1::date
      ORDER BY symbol ASC
    `,
    [snapshotDateUtc],
  );

  return response.rows.map(mapDailySnapshotRow);
}

export async function readDailySentimentHistory(
  symbol: string,
  daysBack: number,
): Promise<DailySentimentRow[]> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!normalizedSymbol) return [];

  const safeDaysBack = Math.max(1, Math.min(365, Math.trunc(daysBack || 1)));
  const fromDate = DateTime.utc().minus({ days: safeDaysBack - 1 }).toISODate();
  if (!fromDate) return [];

  const pool = getPool();
  const response = await pool.query<DailySnapshotRow>(
    `
      SELECT
        snapshot_date_utc,
        snapshot_time_utc,
        symbol,
        agg_long_pct,
        agg_short_pct,
        agg_net,
        confidence_score,
        crowding_state,
        flip_state,
        sentiment_direction,
        source_mode
      FROM sentiment_daily_snapshots
      WHERE symbol = $1
        AND snapshot_date_utc >= $2::date
      ORDER BY snapshot_date_utc DESC
    `,
    [normalizedSymbol, fromDate],
  );

  return response.rows.map(mapDailySnapshotRow);
}
