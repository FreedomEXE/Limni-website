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

import { createHash } from "node:crypto";
import { fetchBitgetFuturesSnapshot } from "./bitget";
import {
  fetchLiquidationSummary,
  fetchLiquidationHeatmap,
  type LiquidationSummary,
  type LiquidationHeatmap,
  type LiquidationHeatmapNode,
} from "./coinank";
import { query } from "./db";

type BitgetSnapshotSymbol = "BTC" | "ETH" | "SOL";
type CoinankSnapshotSymbol = "BTC" | "ETH";

export const SNAPSHOT_SYMBOLS: string[] = ["BTC", "ETH"];
export const HEATMAP_SNAPSHOT_SYMBOLS: string[] = ["BTC", "ETH"];

type HeatmapExchangeGroup = {
  key: string;
  exchanges: string[];
};

const DEFAULT_HEATMAP_INTERVALS = ["6h", "1d", "7d", "30d"];
const BUILTIN_HEATMAP_GROUPS: Record<string, string[]> = {
  binance_bybit: ["Binance", "Bybit"],
  binance: ["Binance"],
  bybit: ["Bybit"],
};

const HEATMAP_COLLECTION_ENABLED = String(
  process.env.LIQ_HEATMAP_COLLECTION_ENABLED ?? "true",
).toLowerCase() !== "false";
const HEATMAP_INTERVALS = parseCsv(
  process.env.LIQ_HEATMAP_INTERVALS,
  DEFAULT_HEATMAP_INTERVALS,
).map((value) => value.trim());
const HEATMAP_EXCHANGE_GROUPS = parseHeatmapExchangeGroups(
  process.env.LIQ_HEATMAP_EXCHANGE_GROUPS,
);

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

export type LiquidationHeatmapSnapshotRow = {
  symbol: string;
  interval: string;
  exchange_group: string;
  current_price: number;
  nodes_json: LiquidationHeatmapNode[];
  bands_json: Record<string, unknown>;
  key_levels_json: Record<string, unknown>;
  aggregate_json: Record<string, unknown>;
  metadata: Record<string, unknown>;
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

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parseCsv(raw: string | undefined, fallback: string[]): string[] {
  const parsed = String(raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return parsed.length ? parsed : [...fallback];
}

function parseHeatmapExchangeGroups(raw: string | undefined): HeatmapExchangeGroup[] {
  const requestedGroups = parseCsv(raw, ["binance_bybit"]);
  const groups: HeatmapExchangeGroup[] = [];

  for (const requested of requestedGroups) {
    const customSplit = requested.split(":", 2);
    if (customSplit.length === 2) {
      const key = customSplit[0].trim().toLowerCase();
      const exchanges = customSplit[1]
        .split("+")
        .map((value) => value.trim())
        .filter(Boolean);
      if (key && exchanges.length) {
        groups.push({ key, exchanges });
      }
      continue;
    }

    const builtin = BUILTIN_HEATMAP_GROUPS[requested.toLowerCase()];
    if (builtin?.length) {
      groups.push({ key: requested.toLowerCase(), exchanges: [...builtin] });
    }
  }

  if (groups.length) {
    return groups;
  }
  return [{ key: "binance_bybit", exchanges: [...BUILTIN_HEATMAP_GROUPS.binance_bybit] }];
}

function hashHeatmapNodes(nodes: LiquidationHeatmapNode[]): string {
  const normalized = nodes
    .map((node) => ({
      price_level: toNumber(node.price_level),
      distance_pct: toNumber(node.distance_pct),
      estimated_liquidations_usd: toNumber(node.estimated_liquidations_usd),
      side: String(node.side ?? ""),
    }))
    .sort((a, b) => a.price_level - b.price_level);

  return createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");
}

function isTableMissingError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "42P01"
  );
}

async function hasHeatmapSnapshotTable(): Promise<boolean> {
  const row = await query<{
    regclass_name: string | null;
  }>(
    `SELECT to_regclass('public.market_liquidation_heatmap_snapshots') AS regclass_name`,
  );
  return Boolean(row[0]?.regclass_name);
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

async function readLatestHeatmapNodeHash(
  symbol: string,
  interval: string,
  exchangeGroup: string,
): Promise<string | null> {
  const rows = await query<{ node_hash: string | null }>(
    `SELECT metadata->>'node_hash' AS node_hash
       FROM market_liquidation_heatmap_snapshots
      WHERE symbol = $1
        AND interval = $2
        AND exchange_group = $3
      ORDER BY snapshot_time_utc DESC
      LIMIT 1`,
    [symbol, interval, exchangeGroup],
  );

  return rows[0]?.node_hash ?? null;
}

async function insertLiquidationHeatmapSnapshot(
  symbol: string,
  interval: string,
  exchangeGroup: string,
  heatmap: LiquidationHeatmap,
): Promise<boolean> {
  const nodes = Array.isArray(heatmap.nodes) ? heatmap.nodes : [];
  const nodeHash = hashHeatmapNodes(nodes);
  const previousHash = await readLatestHeatmapNodeHash(symbol, interval, exchangeGroup);
  if (previousHash && previousHash === nodeHash) {
    return false;
  }

  const rows = await query<{ id: number }>(
    `INSERT INTO market_liquidation_heatmap_snapshots (
      symbol,
      interval,
      exchange_group,
      current_price,
      nodes_json,
      bands_json,
      key_levels_json,
      aggregate_json,
      metadata,
      snapshot_time_utc,
      source
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5::jsonb,
      $6::jsonb,
      $7::jsonb,
      $8::jsonb,
      $9::jsonb,
      date_trunc('hour', NOW()),
      $10
    )
    ON CONFLICT (symbol, interval, exchange_group, snapshot_time_utc, source) DO NOTHING
    RETURNING id`,
    [
      symbol,
      interval,
      exchangeGroup,
      heatmap.current_price,
      JSON.stringify(nodes),
      JSON.stringify(heatmap.liquidation_bands ?? {}),
      JSON.stringify(heatmap.key_levels ?? {}),
      JSON.stringify(heatmap.aggregate_density ?? {}),
      JSON.stringify({
        node_hash: nodeHash,
        node_count: nodes.length,
        as_of_utc: heatmap.asOfUtc,
        exchanges: heatmap.source?.exchanges ?? [],
        provider: heatmap.source?.provider ?? "coinank",
      }),
      heatmap.source?.provider ?? "coinank",
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
  heatmap: number;
  errors: string[];
}> {
  let funding = 0;
  let oi = 0;
  let liquidation = 0;
  let heatmap = 0;
  const errors: string[] = [];

  let heatmapTableReady = false;
  if (HEATMAP_COLLECTION_ENABLED) {
    try {
      heatmapTableReady = await hasHeatmapSnapshotTable();
      if (!heatmapTableReady) {
        errors.push(
          "Heatmap snapshot table missing: run migrations/009_liquidation_heatmap_snapshots.sql",
        );
      }
    } catch (error) {
      errors.push(
        `Heatmap table check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

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

    const shouldCollectHeatmap = HEATMAP_SNAPSHOT_SYMBOLS.includes(symbol);
    if (HEATMAP_COLLECTION_ENABLED && heatmapTableReady && shouldCollectHeatmap) {
      for (const interval of HEATMAP_INTERVALS) {
        for (const group of HEATMAP_EXCHANGE_GROUPS) {
          try {
            const heatmapSnapshot = await fetchLiquidationHeatmap(symbol, {
              interval,
              exchanges: group.exchanges,
              includeNodes: true,
            });
            const inserted = await insertLiquidationHeatmapSnapshot(
              symbol,
              interval,
              group.key,
              heatmapSnapshot,
            );
            if (inserted) {
              heatmap += 1;
            }
          } catch (error) {
            if (isTableMissingError(error)) {
              heatmapTableReady = false;
              errors.push(
                "Heatmap snapshot insert failed because table is missing. Apply migration 009.",
              );
              break;
            }
            errors.push(
              `Heatmap snapshot failed for ${symbol} ${interval} ${group.key}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }
        if (!heatmapTableReady) {
          break;
        }
      }
    }
  }

  return { funding, oi, liquidation, heatmap, errors };
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

export async function readNearestLiquidationHeatmapSnapshot(options: {
  symbol: string;
  atUtc: string;
  interval?: string;
  exchangeGroup?: string;
  maxAgeMinutes?: number;
}): Promise<LiquidationHeatmapSnapshotRow | null> {
  const symbol = normalizeSymbol(options.symbol);
  const interval = String(options.interval ?? "1d").trim() || "1d";
  const exchangeGroup = String(options.exchangeGroup ?? "binance_bybit").trim() || "binance_bybit";
  const maxAgeMinutes = Number(options.maxAgeMinutes ?? 240);
  const hasMaxAge = Number.isFinite(maxAgeMinutes) && maxAgeMinutes > 0;

  try {
    const rows = await query<{
      symbol: string;
      interval: string;
      exchange_group: string;
      current_price: unknown;
      nodes_json: unknown;
      bands_json: unknown;
      key_levels_json: unknown;
      aggregate_json: unknown;
      metadata: unknown;
      snapshot_time_utc: Date | string;
      source: string;
      created_at: Date | string;
    }>(
      `SELECT
        symbol,
        interval,
        exchange_group,
        current_price,
        nodes_json,
        bands_json,
        key_levels_json,
        aggregate_json,
        metadata,
        snapshot_time_utc,
        source,
        created_at
      FROM market_liquidation_heatmap_snapshots
      WHERE symbol = $1
        AND interval = $2
        AND exchange_group = $3
        AND snapshot_time_utc <= $4::timestamptz
        ${hasMaxAge ? "AND snapshot_time_utc >= ($4::timestamptz - make_interval(mins => $5::int))" : ""}
      ORDER BY snapshot_time_utc DESC
      LIMIT 1`,
      hasMaxAge
        ? [symbol, interval, exchangeGroup, options.atUtc, Math.floor(maxAgeMinutes)]
        : [symbol, interval, exchangeGroup, options.atUtc],
    );

    const row = rows[0];
    if (!row) return null;

    return {
      symbol: row.symbol,
      interval: row.interval,
      exchange_group: row.exchange_group,
      current_price: toNumber(row.current_price, 0),
      nodes_json: Array.isArray(row.nodes_json)
        ? (row.nodes_json as LiquidationHeatmapNode[])
        : [],
      bands_json: asRecord(row.bands_json),
      key_levels_json: asRecord(row.key_levels_json),
      aggregate_json: asRecord(row.aggregate_json),
      metadata: asRecord(row.metadata),
      snapshot_time_utc: toIsoUtc(row.snapshot_time_utc) ?? "",
      source: row.source,
      created_at: toIsoUtc(row.created_at) ?? "",
    };
  } catch (error) {
    if (isTableMissingError(error)) {
      return null;
    }
    throw error;
  }
}
