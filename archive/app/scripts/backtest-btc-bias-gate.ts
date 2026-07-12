/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-btc-bias-gate.ts
 *
 * Description:
 * BTCUSD weekly bias backtest with Positioning Risk Gate replay.
 * Uses COT dealer/commercial votes + sentiment vote, then evaluates
 * gate decisions from stored liquidation heatmap snapshots.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { loadEnvConfig } from "@next/env";

import { getPool, query } from "../src/lib/db";
import { readSnapshotHistory } from "../src/lib/cotStore";
import type { CotSnapshot } from "../src/lib/cotTypes";
import { derivePairDirectionsByBase } from "../src/lib/cotCompute";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import { classifyWeeklyBias } from "../src/lib/bitgetBotSignals";
import { readNearestLiquidationHeatmapSnapshot } from "../src/lib/marketSnapshots";
import { buildLiquidationAdvisory } from "../src/lib/bitgetLiquidationFeatures";

type Direction = "LONG" | "SHORT" | "NEUTRAL";
type Tier = "HIGH" | "MEDIUM" | "NEUTRAL";
type GateDecision = "PASS" | "REDUCE" | "SKIP" | "NO_DATA";

type DepthRow = {
  table_name: string;
  min_ts: string | null;
  max_ts: string | null;
  rows: string;
};

type SentimentAggregateRow = {
  symbol: string;
  timestamp_utc: string;
  crowding_state: string;
  flip_state: string;
  agg_net: number | null;
};

type OiPricePoint = {
  ts: number;
  price: number;
};

type OhlcPoint = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type WeekSignalRow = {
  reportDate: string;
  weekStartUtc: string;
  weekCloseUtc: string;
  dealerVote: Direction;
  commercialVote: Direction;
  sentimentVote: Direction;
  sentimentState: string;
  sentimentTimestampUtc: string | null;
  combinedDirection: Direction;
  tier: Tier;
  entryPrice: number | null;
  exitPrice: number | null;
  pnlPct: number | null;
  maxAdverseExcursionPct: number | null;
  priceSource: "OI_SNAPSHOT" | "BITGET_CANDLE" | "NONE";
  gateDecision: GateDecision;
  gateReasons: string[];
  gateDebug: Record<string, unknown>;
};

type GateEvaluation = {
  decision: GateDecision;
  reasons: string[];
  debug: Record<string, unknown>;
};

type SummaryStats = {
  totalSignals: number;
  pricedSignals: number;
  wins: number;
  losses: number;
  flats: number;
  winRatePct: number;
  avgPnlPct: number;
  gateAppliedSignals: number;
  gateAppliedWins: number;
  gateAppliedLosses: number;
  gateAppliedFlats: number;
  gateAppliedWinRatePct: number;
  gateAppliedAvgPnlPct: number;
  skippedByGate: number;
};

type CliConfig = {
  symbol: "BTC" | "ETH";
  outPath: string;
  exchangeGroup: string;
  opposingThreshold: number;
  liqMaxAgeMinutes: number;
  nearClusterSkipDistancePct: number;
  nearClusterSkipUsd: number;
  nearClusterSkipPercentile: number;
  nearClusterReduceDistancePct: number;
  reduceRatioLow: number;
  reduceRatioHigh: number;
  nearFieldHighUsd: number;
};

const INTERVALS = ["6h", "1d", "7d", "30d"] as const;
const BITGET_BASE_URL = "https://api.bitget.com";
const BITGET_PRODUCT_TYPE = process.env.BITGET_PRODUCT_TYPE ?? "USDT-FUTURES";

function parseArgs(): CliConfig {
  const byKey = new Map<string, string>();
  for (const raw of process.argv.slice(2)) {
    if (!raw.startsWith("--")) continue;
    const [k, ...rest] = raw.slice(2).split("=");
    byKey.set(k.trim(), rest.join("="));
  }

  const num = (key: string, fallback: number) => {
    const parsed = Number(byKey.get(key));
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const symbolRaw = String(byKey.get("symbol") ?? "BTC").trim().toUpperCase();
  const symbol = symbolRaw === "ETH" ? "ETH" : "BTC";
  const defaultOut = `app/reports/backtest-${symbol.toLowerCase()}-bias-gate-latest.json`;

  return {
    symbol,
    outPath: byKey.get("out")?.trim() || defaultOut,
    exchangeGroup: byKey.get("exchange-group")?.trim() || "binance_bybit",
    opposingThreshold: num("opposing-threshold", 1.2),
    liqMaxAgeMinutes: Math.max(60, Math.floor(num("liq-max-age-minutes", 72 * 60))),
    nearClusterSkipDistancePct: num("skip-near-cluster-distance-pct", 2.0),
    nearClusterSkipUsd: num("skip-near-cluster-usd", 3_000_000_000),
    nearClusterSkipPercentile: num("skip-near-cluster-percentile", 90),
    nearClusterReduceDistancePct: num("reduce-near-cluster-distance-pct", 3.5),
    reduceRatioLow: num("reduce-ratio-low", 0.8),
    reduceRatioHigh: num("reduce-ratio-high", 1.2),
    nearFieldHighUsd: num("nearfield-high-usd", 1_000_000_000),
  };
}

function round(value: number, decimals = 4): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function toDateIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeDirection(value: unknown): Direction {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "LONG" || raw === "BULLISH") return "LONG";
  if (raw === "SHORT" || raw === "BEARISH") return "SHORT";
  return "NEUTRAL";
}

function directionFromSentiment(row: SentimentAggregateRow | null): Direction {
  if (!row) return "NEUTRAL";
  const flip = String(row.flip_state ?? "").toUpperCase();
  const crowd = String(row.crowding_state ?? "").toUpperCase();
  if (flip === "FLIPPED_UP") return "LONG";
  if (flip === "FLIPPED_DOWN") return "SHORT";
  if (flip === "FLIPPED_NEUTRAL") return "NEUTRAL";
  if (crowd === "CROWDED_LONG") return "SHORT";
  if (crowd === "CROWDED_SHORT") return "LONG";
  return "NEUTRAL";
}

function sentimentStateLabel(row: SentimentAggregateRow | null): string {
  if (!row) return "NO_DATA";
  return `${row.crowding_state}|${row.flip_state}`;
}

function weekWindowFromReportDate(reportDate: string) {
  const report = DateTime.fromISO(reportDate, { zone: "utc" }).startOf("day");
  const weekOpen = report.startOf("week").plus({ weeks: 1 });
  const weekClose = weekOpen.plus({ weeks: 1 });
  return {
    weekOpenUtc: weekOpen.toUTC().toISO() ?? "",
    weekCloseUtc: weekClose.toUTC().toISO() ?? "",
  };
}

function pairFromSymbol(symbol: "BTC" | "ETH"): string {
  return `${symbol}USD`;
}

function sentimentAliasesForSymbol(symbol: "BTC" | "ETH"): string[] {
  return [symbol, `${symbol}USD`, `${symbol}USDT`];
}

function pickBaseDirectionFromSnapshot(
  snapshot: CotSnapshot,
  base: "BTC" | "ETH",
  mode: "dealer" | "commercial",
): Direction {
  const pairDefs = PAIRS_BY_ASSET_CLASS.crypto;
  const pair = pairFromSymbol(base);
  const pairs = derivePairDirectionsByBase(snapshot.currencies, pairDefs, mode);
  const pairDirection = normalizeDirection(pairs[pair]?.direction ?? "NEUTRAL");
  if (pairDirection !== "NEUTRAL") return pairDirection;

  const market = asRecord(snapshot.currencies[base] as unknown);
  const fallbackBias = mode === "dealer" ? market.dealer_bias : market.commercial_bias;
  return normalizeDirection(fallbackBias ?? "NEUTRAL");
}

function selectClosestSentiment(
  rows: SentimentAggregateRow[],
  symbol: "BTC" | "ETH",
  weekOpenUtc: string,
): SentimentAggregateRow | null {
  if (!rows.length) return null;
  const targetMs = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toMillis();
  if (!Number.isFinite(targetMs)) return null;
  const aliases = sentimentAliasesForSymbol(symbol);

  const symbolPriority = new Map<string, number>(aliases.map((value, index) => [value.toUpperCase(), index]));

  let best: SentimentAggregateRow | null = null;
  let bestTs = Number.NEGATIVE_INFINITY;
  let bestPri = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    const ts = DateTime.fromISO(row.timestamp_utc, { zone: "utc" }).toMillis();
    if (!Number.isFinite(ts) || ts > targetMs) continue;
    const pri = symbolPriority.get(String(row.symbol).toUpperCase()) ?? 99;
    if (ts > bestTs || (ts === bestTs && pri < bestPri)) {
      best = row;
      bestTs = ts;
      bestPri = pri;
    }
  }
  return best;
}

function pickEntryFromOi(points: OiPricePoint[], weekOpenMs: number): OiPricePoint | null {
  const inFront = points
    .filter((p) => p.ts >= weekOpenMs && p.ts <= weekOpenMs + 24 * 60 * 60 * 1000)
    .sort((a, b) => a.ts - b.ts);
  if (inFront.length) return inFront[0];

  const nearest = points
    .map((p) => ({ p, dist: Math.abs(p.ts - weekOpenMs) }))
    .sort((a, b) => a.dist - b.dist)
    .find((x) => x.dist <= 72 * 60 * 60 * 1000);
  return nearest?.p ?? null;
}

function pickExitFromOi(points: OiPricePoint[], weekCloseMs: number): OiPricePoint | null {
  const behind = points
    .filter((p) => p.ts <= weekCloseMs && p.ts >= weekCloseMs - 24 * 60 * 60 * 1000)
    .sort((a, b) => b.ts - a.ts);
  if (behind.length) return behind[0];

  const nearest = points
    .map((p) => ({ p, dist: Math.abs(p.ts - weekCloseMs) }))
    .sort((a, b) => a.dist - b.dist)
    .find((x) => x.dist <= 72 * 60 * 60 * 1000);
  return nearest?.p ?? null;
}

function computePnlPct(direction: Direction, entry: number, exit: number): number {
  if (direction === "LONG") return ((exit - entry) / entry) * 100;
  if (direction === "SHORT") return ((entry - exit) / entry) * 100;
  return 0;
}

function computeMaePct(direction: Direction, entry: number, path: number[]): number | null {
  if (!path.length || entry <= 0) return null;
  if (direction === "LONG") {
    const low = Math.min(...path);
    return ((entry - low) / entry) * 100;
  }
  if (direction === "SHORT") {
    const high = Math.max(...path);
    return ((high - entry) / entry) * 100;
  }
  return null;
}

async function fetchBitgetWeeklyOhlc(
  symbol: "BTC" | "ETH",
  weekOpenUtc: string,
  weekCloseUtc: string,
): Promise<OhlcPoint[]> {
  const open = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toMillis();
  const close = DateTime.fromISO(weekCloseUtc, { zone: "utc" }).toMillis();
  if (!(Number.isFinite(open) && Number.isFinite(close) && close > open)) return [];

  const url = new URL(`${BITGET_BASE_URL}/api/v2/mix/market/candles`);
  url.searchParams.set("symbol", `${symbol}USDT`);
  url.searchParams.set("productType", BITGET_PRODUCT_TYPE);
  url.searchParams.set("granularity", "3600");
  url.searchParams.set("startTime", String(open));
  url.searchParams.set("endTime", String(close));
  url.searchParams.set("limit", "1000");

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) return [];
  const body = (await response.json()) as { code?: string; data?: string[][] };
  if (body.code && body.code !== "00000") return [];

  return (body.data ?? [])
    .map((row) => ({
      ts: toNumber(row[0]),
      open: toNumber(row[1]),
      high: toNumber(row[2]),
      low: toNumber(row[3]),
      close: toNumber(row[4]),
    }))
    .filter((row) => row.ts >= open && row.ts < close)
    .filter((row) => row.open > 0 && row.high > 0 && row.low > 0 && row.close > 0)
    .sort((a, b) => a.ts - b.ts);
}

function isOpposingNode(sideRaw: string, direction: Direction, distancePct: number): boolean {
  const side = sideRaw.trim().toLowerCase();
  if (direction !== "LONG" && direction !== "SHORT") return false;

  if (side.includes("above")) return direction === "SHORT";
  if (side.includes("below")) return direction === "LONG";

  if (side.includes("short")) return direction === "SHORT";
  if (side.includes("long")) return direction === "LONG";

  return direction === "SHORT" ? distancePct >= 0 : distancePct <= 0;
}

function extractNearestOpposingCluster(
  snapshots: Array<Awaited<ReturnType<typeof readNearestLiquidationHeatmapSnapshot>>>,
  direction: Direction,
): {
  distancePct: number | null;
  notionalUsd: number | null;
  notionalPercentile: number | null;
  interval: string | null;
} {
  const candidates: Array<{ distancePct: number; notionalUsd: number; interval: string }> = [];

  for (const snapshot of snapshots) {
    if (!snapshot) continue;
    const nodes = Array.isArray(snapshot.nodes_json) ? snapshot.nodes_json : [];
    for (const rawNode of nodes) {
      const node = asRecord(rawNode);
      const price = toNumber(node.price_level);
      const notional = toNumber(node.estimated_liquidations_usd);
      if (!(price > 0 && notional > 0)) continue;

      const sideRaw = String(node.side ?? "");

      let distancePct = toNumber(node.distance_pct, NaN);
      if (!Number.isFinite(distancePct)) {
        distancePct = ((price - snapshot.current_price) / Math.max(snapshot.current_price, 1)) * 100;
      }

      if (!isOpposingNode(sideRaw, direction, distancePct)) continue;

      candidates.push({
        distancePct: Math.abs(distancePct),
        notionalUsd: notional,
        interval: snapshot.interval,
      });
    }
  }

  if (!candidates.length) {
    return { distancePct: null, notionalUsd: null, notionalPercentile: null, interval: null };
  }

  const best = candidates.sort((a, b) => (
    a.distancePct !== b.distancePct
      ? a.distancePct - b.distancePct
      : b.notionalUsd - a.notionalUsd
  ))[0];

  const distribution = candidates.map((c) => c.notionalUsd).sort((a, b) => a - b);
  const rankCount = distribution.filter((value) => value <= best.notionalUsd).length;
  const percentile = distribution.length > 0 ? (rankCount / distribution.length) * 100 : null;

  return {
    distancePct: best.distancePct,
    notionalUsd: best.notionalUsd,
    notionalPercentile: percentile === null ? null : round(percentile, 2),
    interval: best.interval,
  };
}

function extractNearFieldOpposingUsd(
  snapshots: Array<Awaited<ReturnType<typeof readNearestLiquidationHeatmapSnapshot>>>,
  direction: Direction,
): number {
  const sideKey = direction === "SHORT" ? "shorts" : "longs";
  let total = 0;

  for (const snapshot of snapshots) {
    if (!snapshot) continue;
    const bands = asRecord(snapshot.bands_json);
    const rows = asArray(bands[sideKey]);
    for (const rawRow of rows) {
      const row = asRecord(rawRow);
      const bandPct = Math.abs(toNumber(row.band_pct, toNumber(row.distance_pct, NaN)));
      if (!Number.isFinite(bandPct) || bandPct > 2) continue;
      const incremental = toNumber(row.incremental_liquidations_usd);
      const cumulative = toNumber(row.estimated_liquidations_usd);
      total += incremental > 0 ? incremental : cumulative;
    }
  }

  return total;
}

async function evaluateGate(
  symbol: "BTC" | "ETH",
  weekOpenUtc: string,
  direction: Direction,
  config: CliConfig,
): Promise<GateEvaluation> {
  if (direction !== "LONG" && direction !== "SHORT") {
    return {
      decision: "NO_DATA",
      reasons: ["NO_ACTIONABLE_DIRECTION"],
      debug: {},
    };
  }

  const snapshots = await Promise.all(
    INTERVALS.map((interval) =>
      readNearestLiquidationHeatmapSnapshot({
        symbol,
        atUtc: weekOpenUtc,
        interval,
        exchangeGroup: config.exchangeGroup,
        maxAgeMinutes: config.liqMaxAgeMinutes,
      }),
    ),
  );

  const available = snapshots
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s) => s.interval);
  if (!available.length) {
    return {
      decision: "NO_DATA",
      reasons: ["NO_LIQ_DATA"],
      debug: { available_intervals: [], missing_intervals: [...INTERVALS] },
    };
  }

  const advisories = snapshots
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((snapshot) => ({
      interval: snapshot.interval,
      advisory: buildLiquidationAdvisory(snapshot, direction, {
        opposingThreshold: config.opposingThreshold,
      }),
    }));

  const advisoryByInterval = new Map(advisories.map((x) => [x.interval, x.advisory]));
  const missingIntervals = INTERVALS.filter((interval) => !advisoryByInterval.has(interval));
  const reasons: string[] = [];

  const skipSuggestedCount = advisories.filter((x) => x.advisory.skip_suggested).length;
  const nearestOpposing = extractNearestOpposingCluster(
    snapshots.filter((s): s is NonNullable<typeof s> => Boolean(s)),
    direction,
  );
  const nearFieldOpposingUsd = extractNearFieldOpposingUsd(
    snapshots.filter((s): s is NonNullable<typeof s> => Boolean(s)),
    direction,
  );

  const dailyRatio = advisoryByInterval.get("1d")?.fuel_risk_ratio ?? null;
  const weeklyRatio = advisoryByInterval.get("7d")?.fuel_risk_ratio ?? null;

  const skipByMultiTfOpposing = skipSuggestedCount >= 2;
  const nearClusterDistanceHit =
    (nearestOpposing.distancePct ?? Number.POSITIVE_INFINITY) <= config.nearClusterSkipDistancePct;
  const nearClusterUsdHit = (nearestOpposing.notionalUsd ?? 0) >= config.nearClusterSkipUsd;
  const nearClusterPercentileHit =
    (nearestOpposing.notionalPercentile ?? -1) >= config.nearClusterSkipPercentile;
  const skipByNearestCluster = nearClusterDistanceHit && (nearClusterUsdHit || nearClusterPercentileHit);
  const skipByDualRatio =
    dailyRatio !== null &&
    weeklyRatio !== null &&
    dailyRatio < 0.8 &&
    weeklyRatio < 0.8;

  if (skipByMultiTfOpposing) reasons.push("SKIP_OPPOSING_DOMINANCE_MULTI_TF");
  if (skipByNearestCluster && nearClusterUsdHit) reasons.push("SKIP_NEAR_OPPOSING_CLUSTER_USD");
  if (skipByNearestCluster && nearClusterPercentileHit) reasons.push("SKIP_NEAR_OPPOSING_CLUSTER_PERCENTILE");
  if (skipByDualRatio) reasons.push("SKIP_LOW_RATIO_1D_7D");
  if (missingIntervals.length) reasons.push(`WARN_MISSING_INTERVALS:${missingIntervals.join(",")}`);

  if (skipByMultiTfOpposing || skipByNearestCluster || skipByDualRatio) {
    return {
      decision: "SKIP",
      reasons,
      debug: {
        skip_suggested_count: skipSuggestedCount,
        nearest_opposing_distance_pct: nearestOpposing.distancePct,
        nearest_opposing_notional_usd: nearestOpposing.notionalUsd,
        nearest_opposing_notional_percentile: nearestOpposing.notionalPercentile,
        nearest_opposing_interval: nearestOpposing.interval,
        near_cluster_distance_hit: nearClusterDistanceHit,
        near_cluster_usd_hit: nearClusterUsdHit,
        near_cluster_percentile_hit: nearClusterPercentileHit,
        near_cluster_percentile_threshold: config.nearClusterSkipPercentile,
        daily_ratio: dailyRatio,
        weekly_ratio: weeklyRatio,
        near_field_opposing_usd: nearFieldOpposingUsd,
        available_intervals: available,
        missing_intervals: missingIntervals,
      },
    };
  }

  const anyRatioInReduceBand = advisories.some((x) => (
    x.advisory.fuel_risk_ratio >= config.reduceRatioLow &&
    x.advisory.fuel_risk_ratio < config.reduceRatioHigh
  ));
  const reduceByNearestCluster =
    (nearestOpposing.distancePct ?? Number.POSITIVE_INFINITY) <= config.nearClusterReduceDistancePct;
  const reduceByNearField = nearFieldOpposingUsd >= config.nearFieldHighUsd;

  if (reduceByNearestCluster) reasons.push("REDUCE_NEAR_OPPOSING_CLUSTER");
  if (anyRatioInReduceBand) reasons.push("REDUCE_RATIO_BAND");
  if (reduceByNearField) reasons.push("REDUCE_NEAR_FIELD_OPPOSING_DENSITY");

  if (reduceByNearestCluster || anyRatioInReduceBand || reduceByNearField) {
    return {
      decision: "REDUCE",
      reasons,
      debug: {
        skip_suggested_count: skipSuggestedCount,
        nearest_opposing_distance_pct: nearestOpposing.distancePct,
        nearest_opposing_notional_usd: nearestOpposing.notionalUsd,
        nearest_opposing_notional_percentile: nearestOpposing.notionalPercentile,
        nearest_opposing_interval: nearestOpposing.interval,
        near_cluster_distance_hit: nearClusterDistanceHit,
        near_cluster_usd_hit: nearClusterUsdHit,
        near_cluster_percentile_hit: nearClusterPercentileHit,
        near_cluster_percentile_threshold: config.nearClusterSkipPercentile,
        daily_ratio: dailyRatio,
        weekly_ratio: weeklyRatio,
        near_field_opposing_usd: nearFieldOpposingUsd,
        available_intervals: available,
        missing_intervals: missingIntervals,
      },
    };
  }

  if (!reasons.length) reasons.push("PASS_ALL_RULES");
  return {
    decision: "PASS",
    reasons,
    debug: {
      skip_suggested_count: skipSuggestedCount,
      nearest_opposing_distance_pct: nearestOpposing.distancePct,
      nearest_opposing_notional_usd: nearestOpposing.notionalUsd,
      nearest_opposing_notional_percentile: nearestOpposing.notionalPercentile,
      nearest_opposing_interval: nearestOpposing.interval,
      near_cluster_distance_hit: nearClusterDistanceHit,
      near_cluster_usd_hit: nearClusterUsdHit,
      near_cluster_percentile_hit: nearClusterPercentileHit,
      near_cluster_percentile_threshold: config.nearClusterSkipPercentile,
      daily_ratio: dailyRatio,
      weekly_ratio: weeklyRatio,
      near_field_opposing_usd: nearFieldOpposingUsd,
      available_intervals: available,
      missing_intervals: missingIntervals,
    },
  };
}

async function readDepthRows(symbol: "BTC" | "ETH"): Promise<DepthRow[]> {
  const aliases = sentimentAliasesForSymbol(symbol);
  return query<DepthRow>(
    `
    SELECT 'cot_snapshots_crypto' AS table_name,
           MIN(report_date)::text AS min_ts,
           MAX(report_date)::text AS max_ts,
           COUNT(*)::text AS rows
    FROM cot_snapshots
    WHERE asset_class = 'crypto'

    UNION ALL
    SELECT 'sentiment_aggregates_symbol',
           MIN(timestamp_utc)::text,
           MAX(timestamp_utc)::text,
           COUNT(*)::text
    FROM sentiment_aggregates
    WHERE UPPER(symbol) = ANY($1::text[])

    UNION ALL
    SELECT 'market_liquidation_heatmap_snapshots_symbol',
           MIN(snapshot_time_utc)::text,
           MAX(snapshot_time_utc)::text,
           COUNT(*)::text
    FROM market_liquidation_heatmap_snapshots
    WHERE symbol = $2

    UNION ALL
    SELECT 'market_liquidation_snapshots_symbol',
           MIN(snapshot_time_utc)::text,
           MAX(snapshot_time_utc)::text,
           COUNT(*)::text
    FROM market_liquidation_snapshots
    WHERE symbol = $2

    UNION ALL
    SELECT 'market_funding_snapshots_symbol',
           MIN(snapshot_time_utc)::text,
           MAX(snapshot_time_utc)::text,
           COUNT(*)::text
    FROM market_funding_snapshots
    WHERE symbol = $2

    UNION ALL
    SELECT 'market_oi_snapshots_symbol',
           MIN(snapshot_time_utc)::text,
           MAX(snapshot_time_utc)::text,
           COUNT(*)::text
    FROM market_oi_snapshots
    WHERE symbol = $2;
    `,
    [aliases, symbol],
  );
}

async function readSentimentRows(symbol: "BTC" | "ETH"): Promise<SentimentAggregateRow[]> {
  const aliases = sentimentAliasesForSymbol(symbol);
  const rows = await query<{
    symbol: string;
    timestamp_utc: Date | string;
    crowding_state: string;
    flip_state: string;
    agg_net: string | number | null;
  }>(
    `
    SELECT symbol, timestamp_utc, crowding_state, flip_state, agg_net
    FROM sentiment_aggregates
    WHERE UPPER(symbol) = ANY($1::text[])
    ORDER BY timestamp_utc ASC
    `,
    [aliases],
  );

  return rows.map((row) => ({
    symbol: String(row.symbol).toUpperCase(),
    timestamp_utc: toDateIso(row.timestamp_utc),
    crowding_state: String(row.crowding_state ?? "NEUTRAL"),
    flip_state: String(row.flip_state ?? "NONE"),
    agg_net: row.agg_net === null ? null : toNumber(row.agg_net),
  }));
}

async function readOiPoints(
  symbol: "BTC" | "ETH",
  fromUtc: string,
  toUtc: string,
): Promise<OiPricePoint[]> {
  const rows = await query<{ snapshot_time_utc: Date | string; price_at_snapshot: string | number | null }>(
    `
    SELECT snapshot_time_utc, price_at_snapshot
    FROM market_oi_snapshots
    WHERE symbol = $1
      AND snapshot_time_utc >= $2::timestamptz
      AND snapshot_time_utc <= $3::timestamptz
      AND price_at_snapshot IS NOT NULL
    ORDER BY snapshot_time_utc ASC
    `,
    [symbol, fromUtc, toUtc],
  );

  return rows
    .map((row) => ({
      ts: DateTime.fromISO(toDateIso(row.snapshot_time_utc), { zone: "utc" }).toMillis(),
      price: toNumber(row.price_at_snapshot),
    }))
    .filter((row) => Number.isFinite(row.ts) && row.price > 0);
}

function summarize(trades: WeekSignalRow[]): {
  noGate: SummaryStats;
  withGate: SummaryStats;
  blockedTrades: Array<{ weekStartUtc: string; direction: Direction; pnlPct: number; gateReasons: string[] }>;
} {
  const actionable = trades.filter((t) => (t.combinedDirection === "LONG" || t.combinedDirection === "SHORT"));
  const priced = actionable.filter((t) => t.pnlPct !== null) as Array<WeekSignalRow & { pnlPct: number }>;

  const wins = priced.filter((t) => t.pnlPct > 0).length;
  const losses = priced.filter((t) => t.pnlPct < 0).length;
  const flats = priced.filter((t) => t.pnlPct === 0).length;
  const avgPnl = priced.length ? priced.reduce((sum, t) => sum + t.pnlPct, 0) / priced.length : 0;

  const noGate: SummaryStats = {
    totalSignals: actionable.length,
    pricedSignals: priced.length,
    wins,
    losses,
    flats,
    winRatePct: priced.length ? (wins / priced.length) * 100 : 0,
    avgPnlPct: avgPnl,
    gateAppliedSignals: priced.length,
    gateAppliedWins: wins,
    gateAppliedLosses: losses,
    gateAppliedFlats: flats,
    gateAppliedWinRatePct: priced.length ? (wins / priced.length) * 100 : 0,
    gateAppliedAvgPnlPct: avgPnl,
    skippedByGate: 0,
  };

  const gateKept = priced.filter((t) => t.gateDecision !== "SKIP");
  const gateAdjusted = gateKept.map((t) => {
    const mul = t.gateDecision === "REDUCE" ? 0.5 : 1;
    return { ...t, gatePnl: t.pnlPct * mul };
  });
  const gateWins = gateAdjusted.filter((t) => t.gatePnl > 0).length;
  const gateLosses = gateAdjusted.filter((t) => t.gatePnl < 0).length;
  const gateFlats = gateAdjusted.filter((t) => t.gatePnl === 0).length;
  const gateAvg = gateAdjusted.length
    ? gateAdjusted.reduce((sum, t) => sum + t.gatePnl, 0) / gateAdjusted.length
    : 0;

  const blockedTrades = priced
    .filter((t) => t.gateDecision === "SKIP")
    .map((t) => ({
      weekStartUtc: t.weekStartUtc,
      direction: t.combinedDirection,
      pnlPct: round(t.pnlPct, 4),
      gateReasons: t.gateReasons,
    }));

  const withGate: SummaryStats = {
    totalSignals: actionable.length,
    pricedSignals: priced.length,
    wins,
    losses,
    flats,
    winRatePct: priced.length ? (wins / priced.length) * 100 : 0,
    avgPnlPct: avgPnl,
    gateAppliedSignals: gateAdjusted.length,
    gateAppliedWins: gateWins,
    gateAppliedLosses: gateLosses,
    gateAppliedFlats: gateFlats,
    gateAppliedWinRatePct: gateAdjusted.length ? (gateWins / gateAdjusted.length) * 100 : 0,
    gateAppliedAvgPnlPct: gateAvg,
    skippedByGate: blockedTrades.length,
  };

  return { noGate, withGate, blockedTrades };
}

function writeResultArtifacts(params: {
  symbol: "BTC" | "ETH";
  config: CliConfig;
  output: Record<string, unknown>;
}) {
  const { symbol, config, output } = params;
  const symbolLower = symbol.toLowerCase();
  const stamp = DateTime.utc().toFormat("yyyy-LL-dd_HHmmss");
  const reportsDir = path.resolve(process.cwd(), "app", "reports", "bias-gate");
  mkdirSync(reportsDir, { recursive: true });

  const latestPath = path.join(reportsDir, `${symbolLower}-latest.json`);
  const datedPath = path.join(reportsDir, `${symbolLower}-${stamp}.json`);
  const customPath = path.resolve(process.cwd(), config.outPath);

  writeFileSync(latestPath, JSON.stringify(output, null, 2), "utf8");
  writeFileSync(datedPath, JSON.stringify(output, null, 2), "utf8");
  writeFileSync(customPath, JSON.stringify(output, null, 2), "utf8");

  const runHistoryPath = path.join(reportsDir, "run-history.json");
  const nextEntry = {
    generated_utc: String(output.generated_utc ?? new Date().toISOString()),
    symbol,
    latest_path: latestPath,
    dated_path: datedPath,
    custom_path: customPath,
    no_gate_priced_signals: Number((output as { summary?: { noGate?: { pricedSignals?: number } } }).summary?.noGate?.pricedSignals ?? 0),
    gate_kept_signals: Number((output as { summary?: { withGate?: { gateAppliedSignals?: number } } }).summary?.withGate?.gateAppliedSignals ?? 0),
    gate_win_rate_pct: Number((output as { summary?: { withGate?: { gateAppliedWinRatePct?: number } } }).summary?.withGate?.gateAppliedWinRatePct ?? 0),
    gate_avg_pnl_pct: Number((output as { summary?: { withGate?: { gateAppliedAvgPnlPct?: number } } }).summary?.withGate?.gateAppliedAvgPnlPct ?? 0),
  };

  let history: Array<Record<string, unknown>> = [];
  try {
    const existing = JSON.parse(readFileSync(runHistoryPath, "utf8")) as Array<Record<string, unknown>>;
    if (Array.isArray(existing)) history = existing;
  } catch {
    history = [];
  }
  history.push(nextEntry);
  writeFileSync(runHistoryPath, JSON.stringify(history, null, 2), "utf8");

  console.log(`\nReport written (latest): ${latestPath}`);
  console.log(`Report written (dated): ${datedPath}`);
  console.log(`Report written (custom): ${customPath}`);
  console.log(`Run history updated: ${runHistoryPath}`);
}

async function main() {
  loadEnvConfig(process.cwd());
  const config = parseArgs();
  const symbol = config.symbol;

  console.log(`=== ${symbol} Weekly Bias + Positioning Risk Gate Backtest ===`);
  console.log(`Generated at: ${new Date().toISOString()}`);
  console.log("");

  const depth = await readDepthRows(symbol);
  console.log(`Data depth (${symbol}):`);
  console.table(
    depth.map((row) => ({
      table: row.table_name,
      min: row.min_ts ?? "null",
      max: row.max_ts ?? "null",
      rows: Number(row.rows),
    })),
  );

  const cotTotal = Number(depth.find((d) => d.table_name === "cot_snapshots_crypto")?.rows ?? "0");
  if (!(cotTotal > 0)) {
    throw new Error("No crypto COT snapshots found.");
  }

  const cotSnapshots = (await readSnapshotHistory("crypto", cotTotal + 10))
    .sort((a, b) => a.report_date.localeCompare(b.report_date));

  if (!cotSnapshots.length) {
    throw new Error("Unable to load crypto COT snapshot history.");
  }

  const sentimentRows = await readSentimentRows(symbol);
  const sentimentBySymbol = sentimentRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.symbol] = (acc[row.symbol] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`${symbol} sentiment symbol coverage:`, sentimentBySymbol);

  const firstWeek = weekWindowFromReportDate(cotSnapshots[0].report_date).weekOpenUtc;
  const lastWeek = weekWindowFromReportDate(cotSnapshots[cotSnapshots.length - 1].report_date).weekCloseUtc;
  const oiPoints = await readOiPoints(
    symbol,
    DateTime.fromISO(firstWeek, { zone: "utc" }).minus({ days: 3 }).toISO() ?? firstWeek,
    DateTime.fromISO(lastWeek, { zone: "utc" }).plus({ days: 1 }).toISO() ?? lastWeek,
  );

  const candleCache = new Map<string, OhlcPoint[]>();
  const weeklyRows: WeekSignalRow[] = [];

  for (const cot of cotSnapshots) {
    const window = weekWindowFromReportDate(cot.report_date);
    const weekOpenMs = DateTime.fromISO(window.weekOpenUtc, { zone: "utc" }).toMillis();
    const weekCloseMs = DateTime.fromISO(window.weekCloseUtc, { zone: "utc" }).toMillis();

    const dealerVote = pickBaseDirectionFromSnapshot(cot, symbol, "dealer");
    const commercialVote = pickBaseDirectionFromSnapshot(cot, symbol, "commercial");

    const sentimentMatch = selectClosestSentiment(sentimentRows, symbol, window.weekOpenUtc);
    const sentimentVote = directionFromSentiment(sentimentMatch);
    const sentimentState = sentimentStateLabel(sentimentMatch);
    const sentimentTimestampUtc = sentimentMatch?.timestamp_utc ?? null;

    const classified = classifyWeeklyBias(dealerVote, commercialVote, sentimentVote);
    const combinedDirection = normalizeDirection(classified.direction);
    const tier = classified.tier as Tier;

    const weekOi = oiPoints.filter((p) => p.ts >= weekOpenMs - 72 * 60 * 60 * 1000 && p.ts <= weekCloseMs + 72 * 60 * 60 * 1000);
    const oiEntry = pickEntryFromOi(weekOi, weekOpenMs);
    const oiExit = pickExitFromOi(weekOi, weekCloseMs);

    let entryPrice = oiEntry?.price ?? null;
    let exitPrice = oiExit?.price ?? null;
    let priceSource: WeekSignalRow["priceSource"] = (entryPrice && exitPrice) ? "OI_SNAPSHOT" : "NONE";
    let mae: number | null = null;

    if (entryPrice && exitPrice && (combinedDirection === "LONG" || combinedDirection === "SHORT")) {
      const path = weekOi
        .filter((p) => p.ts >= (oiEntry?.ts ?? weekOpenMs) && p.ts <= (oiExit?.ts ?? weekCloseMs))
        .map((p) => p.price)
        .filter((v) => v > 0);
      mae = computeMaePct(combinedDirection, entryPrice, path);
    }

    if ((!entryPrice || !exitPrice) && (combinedDirection === "LONG" || combinedDirection === "SHORT")) {
      const cacheKey = window.weekOpenUtc;
      if (!candleCache.has(cacheKey)) {
        candleCache.set(cacheKey, await fetchBitgetWeeklyOhlc(symbol, window.weekOpenUtc, window.weekCloseUtc));
      }
      const candles = candleCache.get(cacheKey) ?? [];
      if (candles.length) {
        entryPrice = entryPrice ?? candles[0].open;
        exitPrice = exitPrice ?? candles[candles.length - 1].close;
        priceSource = "BITGET_CANDLE";
        if (combinedDirection === "LONG" || combinedDirection === "SHORT") {
          const lowsHighs = candles.flatMap((c) => [c.low, c.high]).filter((v) => v > 0);
          mae = computeMaePct(combinedDirection, entryPrice, lowsHighs);
        }
      }
    }

    const pnlPct = (entryPrice && exitPrice && (combinedDirection === "LONG" || combinedDirection === "SHORT"))
      ? computePnlPct(combinedDirection, entryPrice, exitPrice)
      : null;

    const gate = await evaluateGate(symbol, window.weekOpenUtc, combinedDirection, config);

    weeklyRows.push({
      reportDate: cot.report_date,
      weekStartUtc: window.weekOpenUtc,
      weekCloseUtc: window.weekCloseUtc,
      dealerVote,
      commercialVote,
      sentimentVote,
      sentimentState,
      sentimentTimestampUtc,
      combinedDirection,
      tier,
      entryPrice: entryPrice ? round(entryPrice, 2) : null,
      exitPrice: exitPrice ? round(exitPrice, 2) : null,
      pnlPct: pnlPct === null ? null : round(pnlPct, 4),
      maxAdverseExcursionPct: mae === null ? null : round(mae, 4),
      priceSource,
      gateDecision: gate.decision,
      gateReasons: gate.reasons,
      gateDebug: gate.debug,
    });
  }

  const tradeTable = weeklyRows
    .filter((row) => row.combinedDirection === "LONG" || row.combinedDirection === "SHORT")
    .map((row) => ({
      week_start: row.weekStartUtc.slice(0, 10),
      dealer_vote: row.dealerVote,
      commercial_vote: row.commercialVote,
      sentiment_vote: `${row.sentimentVote} (${row.sentimentState})`,
      combined_bias: `${row.combinedDirection}/${row.tier}`,
      entry_price: row.entryPrice,
      exit_price: row.exitPrice,
      pnl_pct: row.pnlPct,
      mae_pct: row.maxAdverseExcursionPct,
      gate_decision: row.gateDecision,
      gate_reasons: row.gateReasons.join("|"),
      price_source: row.priceSource,
    }));

  console.log("");
  console.log("Trade-level rows:");
  console.table(tradeTable);

  const summary = summarize(weeklyRows);
  console.log("");
  console.log("Summary (NO gate):");
  console.table([{
    total_signals: summary.noGate.totalSignals,
    priced_signals: summary.noGate.pricedSignals,
    wins: summary.noGate.wins,
    losses: summary.noGate.losses,
    flats: summary.noGate.flats,
    win_rate_pct: round(summary.noGate.winRatePct, 2),
    avg_pnl_pct: round(summary.noGate.avgPnlPct, 4),
  }]);

  console.log("");
  console.log("Summary (Gate applied: SKIP=remove, REDUCE=0.5x):");
  console.table([{
    gate_kept_signals: summary.withGate.gateAppliedSignals,
    gate_skipped: summary.withGate.skippedByGate,
    wins: summary.withGate.gateAppliedWins,
    losses: summary.withGate.gateAppliedLosses,
    flats: summary.withGate.gateAppliedFlats,
    win_rate_pct: round(summary.withGate.gateAppliedWinRatePct, 2),
    avg_pnl_pct: round(summary.withGate.gateAppliedAvgPnlPct, 4),
  }]);

  console.log("");
  console.log("Blocked trades (SKIP) and realized outcomes:");
  console.table(summary.blockedTrades);

  const output = {
    generated_utc: new Date().toISOString(),
    symbol,
    config,
    depth,
    sentiment_symbol_coverage: sentimentBySymbol,
    signals: weeklyRows,
    trade_table: tradeTable,
    summary,
  };

  writeResultArtifacts({ symbol, config, output });
}

main()
  .catch((error) => {
    console.error("backtest-bias-gate failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // ignore
    }
  });
