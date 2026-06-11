/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-liquidation-path.ts
 *
 * Description:
 * Research harness for the liquidation heatmap history. Evaluates whether
 * aggregate BTC/ETH cluster structure identifies the more likely path and
 * realistic target side over the next 24h/72h.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { fetchBitgetCandleSeries, type BitgetHourlyCandle } from "../src/lib/bitget";
import {
  buildLiquidationAdvisory,
  buildMultiTimeframeExitContext,
  type LiquidationTradeDirection,
} from "../src/lib/bitgetLiquidationFeatures";
import { getPool, query } from "../src/lib/db";
import type { LiquidationHeatmapSnapshotRow } from "../src/lib/marketSnapshots";

loadEnvConfig(process.cwd());

type BacktestConfig = {
  fromUtc: string | null;
  toUtc: string | null;
  outputPath: string;
  exchangeGroup: string;
  opposingThreshold: number;
  maxTargetDistancePct: number;
  minSignalRatio: number;
  samplingHours: number;
  minZoneUsd: number;
};

type CoverageRow = {
  symbol: string;
  interval: string;
  exchange_group: string;
  first_ts: string;
  last_ts: string;
  rows: number;
};

type SnapshotRow = {
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
};

type DirectionEvaluation = {
  direction: LiquidationTradeDirection;
  score: number;
  avgFuelRiskRatio: number;
  targetPrice: number | null;
  targetDistancePct: number | null;
  hit24h: boolean;
  firstHit24hHours: number | null;
  hit72h: boolean;
  firstHit72hHours: number | null;
  close24hPct: number | null;
  close72hPct: number | null;
};

type SnapshotEvaluation = {
  symbol: string;
  snapshotTimeUtc: string;
  price: number;
  intervalsAvailable: string[];
  preferredDirection: LiquidationTradeDirection;
  preferredScore: number;
  opposingScore: number;
  preferredTargetPrice: number | null;
  opposingTargetPrice: number | null;
  preferredHit24h: boolean;
  opposingHit24h: boolean;
  preferredFirst24h: boolean;
  preferredHit72h: boolean;
  opposingHit72h: boolean;
  preferredFirst72h: boolean;
  longEval: DirectionEvaluation;
  shortEval: DirectionEvaluation;
  signalRatio: number;
};

type BandCandidate = {
  interval: (typeof INTERVALS)[number];
  priceLevel: number;
  distancePct: number;
  estimatedUsd: number;
  incrementalUsd: number;
  weight: number;
};

const SYMBOLS = ["BTC", "ETH"] as const;
const INTERVALS = ["6h", "1d", "7d", "30d"] as const;
const DIRECTION_WEIGHTS: Record<(typeof INTERVALS)[number], number> = {
  "6h": 1.0,
  "1d": 1.2,
  "7d": 1.4,
  "30d": 1.6,
};
function parseArgs(): BacktestConfig {
  const args = process.argv.slice(2);
  const byKey = new Map<string, string>();
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const [rawKey, ...valueParts] = arg.slice(2).split("=");
    byKey.set(rawKey, valueParts.join("="));
  }

  const threshold = Number.parseFloat(byKey.get("opposing-threshold") ?? "1.2");
  const maxTargetDistancePct = Number.parseFloat(byKey.get("max-target-distance-pct") ?? "3");
  const minSignalRatio = Number.parseFloat(byKey.get("min-signal-ratio") ?? "1.5");
  const samplingHours = Number.parseFloat(byKey.get("sampling-hours") ?? "12");
  const minZoneUsd = Number.parseFloat(byKey.get("min-zone-usd") ?? "100000000");
  return {
    fromUtc: byKey.get("from")?.trim() || null,
    toUtc: byKey.get("to")?.trim() || null,
    outputPath: byKey.get("out")?.trim() || "app/reports/liquidation-path-backtest-latest.json",
    exchangeGroup: byKey.get("exchange-group")?.trim() || "binance_bybit",
    opposingThreshold: Number.isFinite(threshold) && threshold > 0 ? threshold : 1.2,
    maxTargetDistancePct:
      Number.isFinite(maxTargetDistancePct) && maxTargetDistancePct > 0 ? maxTargetDistancePct : 3,
    minSignalRatio: Number.isFinite(minSignalRatio) && minSignalRatio >= 1 ? minSignalRatio : 1.5,
    samplingHours: Number.isFinite(samplingHours) && samplingHours > 0 ? samplingHours : 12,
    minZoneUsd: Number.isFinite(minZoneUsd) && minZoneUsd > 0 ? minZoneUsd : 100000000,
  };
}

function toIsoUtc(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value ?? ""));
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function round(value: number, decimals = 4) {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function toSnapshotRow(row: SnapshotRow): LiquidationHeatmapSnapshotRow {
  return {
    symbol: String(row.symbol).toUpperCase(),
    interval: String(row.interval),
    exchange_group: String(row.exchange_group),
    current_price: toNumber(row.current_price, 0),
    nodes_json: Array.isArray(row.nodes_json) ? row.nodes_json : [],
    bands_json: asRecord(row.bands_json),
    key_levels_json: asRecord(row.key_levels_json),
    aggregate_json: asRecord(row.aggregate_json),
    metadata: asRecord(row.metadata),
    snapshot_time_utc: toIsoUtc(row.snapshot_time_utc),
    source: row.source,
    created_at: toIsoUtc(row.created_at),
  };
}

async function readCoverage(exchangeGroup: string): Promise<CoverageRow[]> {
  return await query<CoverageRow>(
    `SELECT
        symbol,
        interval,
        exchange_group,
        MIN(snapshot_time_utc) AS first_ts,
        MAX(snapshot_time_utc) AS last_ts,
        COUNT(*)::int AS rows
      FROM market_liquidation_heatmap_snapshots
      WHERE exchange_group = $1
      GROUP BY symbol, interval, exchange_group
      ORDER BY symbol, interval, exchange_group`,
    [exchangeGroup],
  );
}

async function readSnapshots(
  symbol: string,
  exchangeGroup: string,
  fromUtc: string | null,
  toUtc: string | null,
): Promise<LiquidationHeatmapSnapshotRow[]> {
  const rows = await query<SnapshotRow>(
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
        AND exchange_group = $2
        AND ($3::timestamptz IS NULL OR snapshot_time_utc >= $3::timestamptz)
        AND ($4::timestamptz IS NULL OR snapshot_time_utc <= $4::timestamptz)
      ORDER BY snapshot_time_utc ASC`,
    [symbol, exchangeGroup, fromUtc, toUtc],
  );
  return rows.map(toSnapshotRow);
}

function buildSnapshotGroups(
  snapshots: LiquidationHeatmapSnapshotRow[],
): Array<{ ts: string; map: Map<string, LiquidationHeatmapSnapshotRow> }> {
  const byTs = new Map<string, Map<string, LiquidationHeatmapSnapshotRow>>();
  for (const snapshot of snapshots) {
    const key = snapshot.snapshot_time_utc;
    if (!byTs.has(key)) {
      byTs.set(key, new Map());
    }
    byTs.get(key)!.set(snapshot.interval, snapshot);
  }

  return Array.from(byTs.entries())
    .map(([ts, map]) => ({ ts, map }))
    .filter((group) => group.map.size >= 3)
    .sort((a, b) => a.ts.localeCompare(b.ts));
}

function decimateGroups(
  groups: Array<{ ts: string; map: Map<string, LiquidationHeatmapSnapshotRow> }>,
  samplingHours: number,
) {
  if (groups.length <= 1 || samplingHours <= 0) return groups;
  const minSpacingMs = samplingHours * 60 * 60 * 1000;
  const accepted: Array<{ ts: string; map: Map<string, LiquidationHeatmapSnapshotRow> }> = [];
  let lastAcceptedTs = Number.NEGATIVE_INFINITY;
  for (const group of groups) {
    const tsMs = Date.parse(group.ts);
    if (!Number.isFinite(tsMs)) continue;
    if (tsMs - lastAcceptedTs < minSpacingMs) continue;
    accepted.push(group);
    lastAcceptedTs = tsMs;
  }
  return accepted;
}

async function fetchH1Series(symbol: string, fromUtc: string, toUtc: string) {
  return await fetchBitgetCandleSeries(symbol, {
    openUtc: DateTime.fromISO(fromUtc, { zone: "utc" }),
    closeUtc: DateTime.fromISO(toUtc, { zone: "utc" }),
  });
}

function futureCandlesWithin(
  candles: BitgetHourlyCandle[],
  snapshotTsMs: number,
  horizonHours: number,
) {
  const endMs = snapshotTsMs + horizonHours * 60 * 60 * 1000;
  return candles.filter((candle) => candle.ts > snapshotTsMs && candle.ts <= endMs);
}

function evaluateTarget(
  direction: LiquidationTradeDirection,
  targetPrice: number | null,
  futureCandles: BitgetHourlyCandle[],
  entryPrice: number,
) {
  if (!(targetPrice && targetPrice > 0) || futureCandles.length === 0) {
    return {
      hit: false,
      firstHitHours: null as number | null,
      closePct:
        futureCandles.length > 0
          ? ((futureCandles[futureCandles.length - 1].close - entryPrice) / entryPrice) * 100
          : null,
    };
  }

  for (const candle of futureCandles) {
    const hit =
      direction === "LONG"
        ? candle.high >= targetPrice
        : candle.low <= targetPrice;
    if (hit) {
      return {
        hit: true,
        firstHitHours: (candle.ts - futureCandles[0].ts) / (60 * 60 * 1000),
        closePct: ((futureCandles[futureCandles.length - 1].close - entryPrice) / entryPrice) * 100,
      };
    }
  }

  return {
    hit: false,
    firstHitHours: null as number | null,
    closePct: ((futureCandles[futureCandles.length - 1].close - entryPrice) / entryPrice) * 100,
  };
}

function chooseTargetPrice(
  direction: LiquidationTradeDirection,
  snapshotMap: Map<string, LiquidationHeatmapSnapshotRow>,
  currentPrice: number,
  opposingThreshold: number,
  maxTargetDistancePct: number,
  minZoneUsd: number,
) {
  const context = buildMultiTimeframeExitContext(snapshotMap, direction, {
    currentPrice,
    opposingThreshold,
  });
  const targetCandidates: BandCandidate[] = [];
  const side = direction === "LONG" ? "shorts" : "longs";
  for (const interval of INTERVALS) {
    const snapshot = snapshotMap.get(interval);
    if (!snapshot) continue;
    const bands = asRecord(snapshot.bands_json);
    const rows = asArray(bands[side]);
    for (const row of rows) {
      const item = asRecord(row);
      const priceLevel = toNumber(item.price_level, 0);
      const distancePct = toNumber(item.distance_pct, 0);
      const estimatedUsd = toNumber(item.estimated_liquidations_usd, 0);
      const incrementalUsd = toNumber(item.incremental_liquidations_usd, 0);
      if (!(priceLevel > 0)) continue;
      if (Math.abs(distancePct) > maxTargetDistancePct) continue;
      if (estimatedUsd < minZoneUsd && incrementalUsd < minZoneUsd * 0.25) continue;
      targetCandidates.push({
        interval,
        priceLevel,
        distancePct,
        estimatedUsd,
        incrementalUsd,
        weight: DIRECTION_WEIGHTS[interval],
      });
    }
  }
  const target =
    targetCandidates.sort((a, b) => {
      const distanceGap = Math.abs(a.distancePct) - Math.abs(b.distancePct);
      if (distanceGap !== 0) return distanceGap;
      if (b.weight !== a.weight) return b.weight - a.weight;
      if (b.incrementalUsd !== a.incrementalUsd) return b.incrementalUsd - a.incrementalUsd;
      return b.estimatedUsd - a.estimatedUsd;
    })[0] ?? null;

  let weightedRatio = 0;
  let weightTotal = 0;
  for (const interval of INTERVALS) {
    const snapshot = snapshotMap.get(interval);
    if (!snapshot) continue;
    const advisory = buildLiquidationAdvisory(snapshot, direction, { opposingThreshold });
    const weight = DIRECTION_WEIGHTS[interval];
    weightedRatio += advisory.fuel_risk_ratio * weight;
    weightTotal += weight;
  }

  return {
    context,
    score: weightTotal > 0 ? weightedRatio / weightTotal : 0,
    targetPrice: target?.priceLevel ?? null,
    targetDistancePct: target?.distancePct ?? null,
  };
}

function summarizeSymbol(symbol: string, evaluations: SnapshotEvaluation[]) {
  const count = evaluations.length;
  const targetsAvailable = evaluations.filter((row) => row.preferredTargetPrice !== null).length;
  const preferred24 = evaluations.filter((row) => row.preferredHit24h).length;
  const preferred72 = evaluations.filter((row) => row.preferredHit72h).length;
  const first24 = evaluations.filter((row) => row.preferredFirst24h).length;
  const first72 = evaluations.filter((row) => row.preferredFirst72h).length;
  const longPreferred = evaluations.filter((row) => row.preferredDirection === "LONG").length;
  const shortPreferred = evaluations.filter((row) => row.preferredDirection === "SHORT").length;
  const closeAligned24 = evaluations.filter((row) => {
    const close = row.preferredDirection === "LONG" ? row.longEval.close24hPct : row.shortEval.close24hPct;
    return close !== null && ((row.preferredDirection === "LONG" && close > 0) || (row.preferredDirection === "SHORT" && close < 0));
  }).length;
  const closeAligned72 = evaluations.filter((row) => {
    const close = row.preferredDirection === "LONG" ? row.longEval.close72hPct : row.shortEval.close72hPct;
    return close !== null && ((row.preferredDirection === "LONG" && close > 0) || (row.preferredDirection === "SHORT" && close < 0));
  }).length;
  const avgPreferredTargetDistancePct =
    count > 0
      ? evaluations.reduce((sum, row) => {
          const targetDistance =
            row.preferredDirection === "LONG"
              ? Math.abs(row.longEval.targetDistancePct ?? 0)
              : Math.abs(row.shortEval.targetDistancePct ?? 0);
          return sum + targetDistance;
        }, 0) / count
      : 0;

  return {
    symbol,
    snapshotsEvaluated: count,
    targetAvailableRate: count > 0 ? round((targetsAvailable / count) * 100, 2) : 0,
    preferredHitRate24h: count > 0 ? round((preferred24 / count) * 100, 2) : 0,
    preferredHitRate72h: count > 0 ? round((preferred72 / count) * 100, 2) : 0,
    preferredFirstRate24h: count > 0 ? round((first24 / count) * 100, 2) : 0,
    preferredFirstRate72h: count > 0 ? round((first72 / count) * 100, 2) : 0,
    preferredCloseAlignment24h: count > 0 ? round((closeAligned24 / count) * 100, 2) : 0,
    preferredCloseAlignment72h: count > 0 ? round((closeAligned72 / count) * 100, 2) : 0,
    avgPreferredTargetDistancePct: round(avgPreferredTargetDistancePct, 4),
    longPreferredPct: count > 0 ? round((longPreferred / count) * 100, 2) : 0,
    shortPreferredPct: count > 0 ? round((shortPreferred / count) * 100, 2) : 0,
    avgPreferredScore: count > 0 ? round(evaluations.reduce((sum, row) => sum + row.preferredScore, 0) / count, 4) : 0,
  };
}

async function evaluateSymbol(
  symbol: (typeof SYMBOLS)[number],
  config: BacktestConfig,
) {
  const coverage = await readSnapshots(symbol, config.exchangeGroup, config.fromUtc, config.toUtc);
  const rawGroups = buildSnapshotGroups(coverage);
  const groups = decimateGroups(rawGroups, config.samplingHours);
  if (groups.length === 0) {
    return {
      evaluations: [] as SnapshotEvaluation[],
      window: null,
      counts: { rawGroups: rawGroups.length, sampledGroups: groups.length, qualifiedGroups: 0 },
    };
  }

  const startUtc = groups[0].ts;
  const endUtc = DateTime.fromISO(groups[groups.length - 1].ts, { zone: "utc" }).plus({ hours: 72 }).toISO() ?? groups[groups.length - 1].ts;
  const candles = await fetchH1Series(symbol, startUtc, endUtc);

  const evaluations: SnapshotEvaluation[] = [];
  for (const group of groups) {
    const snapshotTsMs = Date.parse(group.ts);
    const currentPrice = Array.from(group.map.values())[0]?.current_price ?? 0;
    if (!(currentPrice > 0) || !Number.isFinite(snapshotTsMs)) continue;

    const longChoice = chooseTargetPrice(
      "LONG",
      group.map,
      currentPrice,
      config.opposingThreshold,
      config.maxTargetDistancePct,
      config.minZoneUsd,
    );
    const shortChoice = chooseTargetPrice(
      "SHORT",
      group.map,
      currentPrice,
      config.opposingThreshold,
      config.maxTargetDistancePct,
      config.minZoneUsd,
    );

    const future24 = futureCandlesWithin(candles, snapshotTsMs, 24);
    const future72 = futureCandlesWithin(candles, snapshotTsMs, 72);
    if (future24.length === 0 || future72.length === 0) continue;

    const long24 = evaluateTarget("LONG", longChoice.targetPrice, future24, currentPrice);
    const short24 = evaluateTarget("SHORT", shortChoice.targetPrice, future24, currentPrice);
    const long72 = evaluateTarget("LONG", longChoice.targetPrice, future72, currentPrice);
    const short72 = evaluateTarget("SHORT", shortChoice.targetPrice, future72, currentPrice);

    const preferredDirection: LiquidationTradeDirection = longChoice.score >= shortChoice.score ? "LONG" : "SHORT";
    const strongerScore = Math.max(longChoice.score, shortChoice.score);
    const weakerScore = Math.max(Math.min(longChoice.score, shortChoice.score), 0.0001);
    const signalRatio = strongerScore / weakerScore;
    if (signalRatio < config.minSignalRatio) {
      continue;
    }

    const preferredFirst24 =
      preferredDirection === "LONG"
        ? long24.hit && (!short24.hit || (long24.firstHitHours ?? Infinity) <= (short24.firstHitHours ?? Infinity))
        : short24.hit && (!long24.hit || (short24.firstHitHours ?? Infinity) <= (long24.firstHitHours ?? Infinity));
    const preferredFirst72 =
      preferredDirection === "LONG"
        ? long72.hit && (!short72.hit || (long72.firstHitHours ?? Infinity) <= (short72.firstHitHours ?? Infinity))
        : short72.hit && (!long72.hit || (short72.firstHitHours ?? Infinity) <= (long72.firstHitHours ?? Infinity));

    evaluations.push({
      symbol,
      snapshotTimeUtc: group.ts,
      price: round(currentPrice, 2),
      intervalsAvailable: Array.from(group.map.keys()),
      preferredDirection,
      preferredScore: round(Math.max(longChoice.score, shortChoice.score), 4),
      opposingScore: round(Math.min(longChoice.score, shortChoice.score), 4),
      preferredTargetPrice: preferredDirection === "LONG" ? longChoice.targetPrice : shortChoice.targetPrice,
      opposingTargetPrice: preferredDirection === "LONG" ? shortChoice.targetPrice : longChoice.targetPrice,
      preferredHit24h: preferredDirection === "LONG" ? long24.hit : short24.hit,
      opposingHit24h: preferredDirection === "LONG" ? short24.hit : long24.hit,
      preferredFirst24h: preferredFirst24,
      preferredHit72h: preferredDirection === "LONG" ? long72.hit : short72.hit,
      opposingHit72h: preferredDirection === "LONG" ? short72.hit : long72.hit,
      preferredFirst72h: preferredFirst72,
      longEval: {
        direction: "LONG",
        score: round(longChoice.score, 4),
        avgFuelRiskRatio: round(longChoice.score, 4),
        targetPrice: longChoice.targetPrice ? round(longChoice.targetPrice, 2) : null,
        targetDistancePct: longChoice.targetDistancePct ? round(longChoice.targetDistancePct, 4) : null,
        hit24h: long24.hit,
        firstHit24hHours: long24.firstHitHours === null ? null : round(long24.firstHitHours, 2),
        hit72h: long72.hit,
        firstHit72hHours: long72.firstHitHours === null ? null : round(long72.firstHitHours, 2),
        close24hPct: long24.closePct === null ? null : round(long24.closePct, 4),
        close72hPct: long72.closePct === null ? null : round(long72.closePct, 4),
      },
      shortEval: {
        direction: "SHORT",
        score: round(shortChoice.score, 4),
        avgFuelRiskRatio: round(shortChoice.score, 4),
        targetPrice: shortChoice.targetPrice ? round(shortChoice.targetPrice, 2) : null,
        targetDistancePct: shortChoice.targetDistancePct ? round(shortChoice.targetDistancePct, 4) : null,
        hit24h: short24.hit,
        firstHit24hHours: short24.firstHitHours === null ? null : round(short24.firstHitHours, 2),
        hit72h: short72.hit,
        firstHit72hHours: short72.firstHitHours === null ? null : round(short72.firstHitHours, 2),
        close24hPct: short24.closePct === null ? null : round(short24.closePct, 4),
        close72hPct: short72.closePct === null ? null : round(short72.closePct, 4),
      },
      signalRatio: round(signalRatio, 4),
    });
  }

  return {
    evaluations,
    window: {
      firstSnapshotUtc: groups[0].ts,
      lastSnapshotUtc: groups[groups.length - 1].ts,
      snapshotsEvaluated: evaluations.length,
    },
    counts: {
      rawGroups: rawGroups.length,
      sampledGroups: groups.length,
      qualifiedGroups: evaluations.length,
    },
  };
}

async function main() {
  const config = parseArgs();
  const coverage = await readCoverage(config.exchangeGroup);
  const perSymbol = await Promise.all(SYMBOLS.map((symbol) => evaluateSymbol(symbol, config)));

  const evaluations = perSymbol.flatMap((item) => item.evaluations);
  const summaryBySymbol = SYMBOLS.map((symbol, index) =>
    summarizeSymbol(symbol, perSymbol[index].evaluations),
  );

  const report = {
    generatedUtc: new Date().toISOString(),
    config,
    availableCoverage: coverage,
    evaluationWindows: Object.fromEntries(
      SYMBOLS.map((symbol, index) => [symbol, perSymbol[index].window]),
    ),
    sampling: Object.fromEntries(
      SYMBOLS.map((symbol, index) => [symbol, perSymbol[index].counts]),
    ),
    summary: {
      totalSnapshotsEvaluated: evaluations.length,
      bySymbol: summaryBySymbol,
    },
    sample: evaluations.slice(0, 100),
    notes: [
      "This report tests liquidation structure as a path/target engine, not as an entry signal.",
      "Preferred direction is whichever side has the higher weighted aggregate fuel/risk ratio across 6h/1d/7d/30d snapshots.",
      "Only snapshots with a stronger-to-weaker score ratio above the configured minimum are evaluated.",
      "Targets are measured against the nearest meaningful exit zone within the configured max distance and minimum liquidity threshold.",
      "Snapshot sampling is decimated to reduce serial correlation between adjacent heatmap captures.",
    ],
  };

  const absoluteOutput = path.resolve(process.cwd(), config.outputPath);
  mkdirSync(path.dirname(absoluteOutput), { recursive: true });
  writeFileSync(absoluteOutput, JSON.stringify(report, null, 2), "utf8");
  console.log(`[liq-path] wrote ${absoluteOutput}`);
  console.log(JSON.stringify(report.summary, null, 2));
  await getPool().end();
}

main().catch(async (error) => {
  console.error("[liq-path] fatal:", error instanceof Error ? error.message : String(error));
  try {
    await getPool().end();
  } catch {
    // no-op
  }
  process.exitCode = 1;
});
