/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: marketSnapshots.ts
 *
 * Description:
 * Collection-only storage helpers for hourly market funding, open interest,
 * and liquidation snapshots. This module is designed for data accumulation
 * and future analysis, not for live entry gating.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { fetchBitgetFuturesSnapshot } from "./bitget";
import { fetchLiquidationSummary, type LiquidationSummary } from "./coinank";
import { query } from "./db";

type BitgetSnapshotSymbol = "BTC" | "ETH" | "SOL";
type CoinankSnapshotSymbol = "BTC" | "ETH";

export const SNAPSHOT_SYMBOLS: string[] = ["BTC", "ETH"];

export type FundingSnapshotRow = {
  symbol: string;
  funding_rate: number;
  next_funding_time: string | null;
  snapshot_time_utc: string;
  source: string;
  created_at: string;
};

export type OiSnapshotRow = {
  symbol: string;
  open_interest: number;
  price_at_snapshot: number | null;
  snapshot_time_utc: string;
  source: string;
  created_at: string;
};

export type LiquidationSnapshotRow = {
  symbol: string;
  total_long_usd: number;
  total_short_usd: number;
  dominant_side: "long" | "short" | "flat";
  reference_price: number | null;
  largest_above_price: number | null;
  largest_above_notional: number | null;
  largest_below_price: number | null;
  largest_below_notional: number | null;
  clusters_json: unknown[];
  snapshot_time_utc: string;
  source: string;
  created_at: string;
};

function normalizeSymbol(symbol: string): string {
  return String(symbol || "").trim().toUpperCase();
}

function asBitgetSnapshotSymbol(symbol: string): BitgetSnapshotSymbol | null {
  if (symbol === "BTC" || symbol === "ETH" || symbol === "SOL") {
    return symbol;
  }
  return null;
}

function asCoinankSnapshotSymbol(symbol: string): CoinankSnapshotSymbol | null {
  if (symbol === "BTC" || symbol === "ETH") {
    return symbol;
  }
  return null;
}

function toIsoUtc(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function insertFundingSnapshot(
  symbol: string,
  fundingRate: number,
  nextFundingTime: string | null,
): Promise<boolean> {
  const rows = await query<{ id: number }>(
    `INSERT INTO market_funding_snapshots (
      symbol,
      funding_rate,
      next_funding_time,
      snapshot_time_utc,
      source
    )
    VALUES (
      $1,
      $2,
      $3,
      date_trunc('hour', NOW()),
      'bitget'
    )
    ON CONFLICT (symbol, snapshot_time_utc, source) DO NOTHING
    RETURNING id`,
    [symbol, fundingRate, nextFundingTime],
  );
  return rows.length > 0;
}

async function insertOiSnapshot(
  symbol: string,
  openInterest: number,
  priceAtSnapshot: number | null,
): Promise<boolean> {
  const rows = await query<{ id: number }>(
    `INSERT INTO market_oi_snapshots (
      symbol,
      open_interest,
      price_at_snapshot,
      snapshot_time_utc,
      source
    )
    VALUES (
      $1,
      $2,
      $3,
      date_trunc('hour', NOW()),
      'bitget'
    )
    ON CONFLICT (symbol, snapshot_time_utc, source) DO NOTHING
    RETURNING id`,
    [symbol, openInterest, priceAtSnapshot],
  );
  return rows.length > 0;
}

async function insertLiquidationSnapshot(
  symbol: string,
  summary: LiquidationSummary,
): Promise<boolean> {
  const rows = await query<{ id: number }>(
    `INSERT INTO market_liquidation_snapshots (
      symbol,
      total_long_usd,
      total_short_usd,
      dominant_side,
      reference_price,
      largest_above_price,
      largest_above_notional,
      largest_below_price,
      largest_below_notional,
      clusters_json,
      snapshot_time_utc,
      source
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10::jsonb,
      date_trunc('hour', NOW()),
      'coinank'
    )
    ON CONFLICT (symbol, snapshot_time_utc, source) DO NOTHING
    RETURNING id`,
    [
      symbol,
      summary.totalLongUsd,
      summary.totalShortUsd,
      summary.dominantSide,
      summary.referencePrice ?? null,
      summary.largestAbove?.price ?? null,
      summary.largestAbove?.notional ?? null,
      summary.largestBelow?.price ?? null,
      summary.largestBelow?.notional ?? null,
      JSON.stringify(summary.recentClusters ?? []),
    ],
  );
  return rows.length > 0;
}

export async function storeFundingSnapshot(
  symbol: string,
  fundingRate: number,
  nextFundingTime: string | null,
): Promise<void> {
  const normalized = normalizeSymbol(symbol);
  const nextFunding = toIsoUtc(nextFundingTime);
  await insertFundingSnapshot(normalized, fundingRate, nextFunding);
}

export async function storeOiSnapshot(
  symbol: string,
  openInterest: number,
  priceAtSnapshot: number | null,
): Promise<void> {
  const normalized = normalizeSymbol(symbol);
  await insertOiSnapshot(normalized, openInterest, priceAtSnapshot);
}

export async function storeLiquidationSnapshot(
  symbol: string,
  summary: LiquidationSummary,
): Promise<void> {
  const normalized = normalizeSymbol(symbol);
  await insertLiquidationSnapshot(normalized, summary);
}

export async function collectAllSnapshots(): Promise<{
  funding: number;
  oi: number;
  liquidation: number;
  errors: string[];
}> {
  let funding = 0;
  let oi = 0;
  let liquidation = 0;
  const errors: string[] = [];

  for (const rawSymbol of SNAPSHOT_SYMBOLS) {
    const symbol = normalizeSymbol(rawSymbol);
    const bitgetSymbol = asBitgetSnapshotSymbol(symbol);

    if (!bitgetSymbol) {
      errors.push(`Unsupported Bitget snapshot symbol: ${symbol}`);
      continue;
    }

    let bitgetSnapshot:
      | Awaited<ReturnType<typeof fetchBitgetFuturesSnapshot>>
      | null = null;
    try {
      bitgetSnapshot = await fetchBitgetFuturesSnapshot(bitgetSymbol);
    } catch (error) {
      errors.push(
        `Bitget snapshot fetch failed for ${symbol}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    if (bitgetSnapshot) {
      try {
        if (
          bitgetSnapshot.fundingRate !== null &&
          Number.isFinite(bitgetSnapshot.fundingRate)
        ) {
          const inserted = await insertFundingSnapshot(
            symbol,
            bitgetSnapshot.fundingRate,
            toIsoUtc(bitgetSnapshot.fundingTime),
          );
          if (inserted) funding += 1;
        } else {
          errors.push(`Missing funding rate from Bitget snapshot for ${symbol}.`);
        }
      } catch (error) {
        errors.push(
          `Funding snapshot failed for ${symbol}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      try {
        if (
          bitgetSnapshot.openInterest !== null &&
          Number.isFinite(bitgetSnapshot.openInterest)
        ) {
          const inserted = await insertOiSnapshot(
            symbol,
            bitgetSnapshot.openInterest,
            bitgetSnapshot.lastPrice,
          );
          if (inserted) oi += 1;
        } else {
          errors.push(`Missing open interest from Bitget snapshot for ${symbol}.`);
        }
      } catch (error) {
        errors.push(
          `OI snapshot failed for ${symbol}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const coinankSymbol = asCoinankSnapshotSymbol(symbol);
    if (!coinankSymbol) {
      errors.push(`Unsupported CoinAnk liquidation symbol: ${symbol}`);
      continue;
    }

    try {
      const summary = await fetchLiquidationSummary(coinankSymbol);
      const inserted = await insertLiquidationSnapshot(symbol, summary);
      if (inserted) liquidation += 1;
    } catch (error) {
      errors.push(
        `Liquidation snapshot failed for ${symbol}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return { funding, oi, liquidation, errors };
}

export async function readFundingHistory(
  symbol: string,
  fromUtc: string,
  toUtc: string,
): Promise<FundingSnapshotRow[]> {
  const normalized = normalizeSymbol(symbol);
  const rows = await query<{
    symbol: string;
    funding_rate: unknown;
    next_funding_time: Date | string | null;
    snapshot_time_utc: Date | string;
    source: string;
    created_at: Date | string;
  }>(
    `SELECT
      symbol,
      funding_rate,
      next_funding_time,
      snapshot_time_utc,
      source,
      created_at
    FROM market_funding_snapshots
    WHERE symbol = $1
      AND snapshot_time_utc >= $2::timestamptz
      AND snapshot_time_utc <= $3::timestamptz
    ORDER BY snapshot_time_utc ASC`,
    [normalized, fromUtc, toUtc],
  );

  return rows.map((row) => ({
    symbol: row.symbol,
    funding_rate: toNumber(row.funding_rate),
    next_funding_time: toIsoUtc(row.next_funding_time),
    snapshot_time_utc: toIsoUtc(row.snapshot_time_utc) ?? "",
    source: row.source,
    created_at: toIsoUtc(row.created_at) ?? "",
  }));
}

export async function readOiHistory(
  symbol: string,
  fromUtc: string,
  toUtc: string,
): Promise<OiSnapshotRow[]> {
  const normalized = normalizeSymbol(symbol);
  const rows = await query<{
    symbol: string;
    open_interest: unknown;
    price_at_snapshot: unknown;
    snapshot_time_utc: Date | string;
    source: string;
    created_at: Date | string;
  }>(
    `SELECT
      symbol,
      open_interest,
      price_at_snapshot,
      snapshot_time_utc,
      source,
      created_at
    FROM market_oi_snapshots
    WHERE symbol = $1
      AND snapshot_time_utc >= $2::timestamptz
      AND snapshot_time_utc <= $3::timestamptz
    ORDER BY snapshot_time_utc ASC`,
    [normalized, fromUtc, toUtc],
  );

  return rows.map((row) => ({
    symbol: row.symbol,
    open_interest: toNumber(row.open_interest),
    price_at_snapshot:
      row.price_at_snapshot === null ? null : toNumber(row.price_at_snapshot, 0),
    snapshot_time_utc: toIsoUtc(row.snapshot_time_utc) ?? "",
    source: row.source,
    created_at: toIsoUtc(row.created_at) ?? "",
  }));
}

export async function readLiquidationHistory(
  symbol: string,
  fromUtc: string,
  toUtc: string,
): Promise<LiquidationSnapshotRow[]> {
  const normalized = normalizeSymbol(symbol);
  const rows = await query<{
    symbol: string;
    total_long_usd: unknown;
    total_short_usd: unknown;
    dominant_side: "long" | "short" | "flat";
    reference_price: unknown;
    largest_above_price: unknown;
    largest_above_notional: unknown;
    largest_below_price: unknown;
    largest_below_notional: unknown;
    clusters_json: unknown;
    snapshot_time_utc: Date | string;
    source: string;
    created_at: Date | string;
  }>(
    `SELECT
      symbol,
      total_long_usd,
      total_short_usd,
      dominant_side,
      reference_price,
      largest_above_price,
      largest_above_notional,
      largest_below_price,
      largest_below_notional,
      clusters_json,
      snapshot_time_utc,
      source,
      created_at
    FROM market_liquidation_snapshots
    WHERE symbol = $1
      AND snapshot_time_utc >= $2::timestamptz
      AND snapshot_time_utc <= $3::timestamptz
    ORDER BY snapshot_time_utc ASC`,
    [normalized, fromUtc, toUtc],
  );

  return rows.map((row) => ({
    symbol: row.symbol,
    total_long_usd: toNumber(row.total_long_usd),
    total_short_usd: toNumber(row.total_short_usd),
    dominant_side: row.dominant_side,
    reference_price: row.reference_price === null ? null : toNumber(row.reference_price, 0),
    largest_above_price:
      row.largest_above_price === null ? null : toNumber(row.largest_above_price, 0),
    largest_above_notional:
      row.largest_above_notional === null ? null : toNumber(row.largest_above_notional, 0),
    largest_below_price:
      row.largest_below_price === null ? null : toNumber(row.largest_below_price, 0),
    largest_below_notional:
      row.largest_below_notional === null ? null : toNumber(row.largest_below_notional, 0),
    clusters_json: Array.isArray(row.clusters_json) ? row.clusters_json : [],
    snapshot_time_utc: toIsoUtc(row.snapshot_time_utc) ?? "",
    source: row.source,
    created_at: toIsoUtc(row.created_at) ?? "",
  }));
}
