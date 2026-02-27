/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: bitgetLiquidationFeatures.ts
 *
 * Description:
 * Shared feature extraction for liquidation heatmap advisory logic used by
 * backtests and runtime metadata tagging. This module is read-only and
 * does not execute any trading actions.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { LiquidationHeatmapSnapshotRow } from "./marketSnapshots";

export type LiquidationTradeDirection = "LONG" | "SHORT";

export type LiquidationMilestoneHint = {
  price_level: number;
  distance_pct: number;
  estimated_liquidations_usd: number;
};

export type LiquidationAdvisory = {
  mode: "advisory_only";
  symbol: string;
  direction: LiquidationTradeDirection;
  interval: string;
  exchange_group: string;
  snapshot_time_utc: string;
  current_price: number;
  directional_fuel_usd: number;
  opposing_risk_usd: number;
  fuel_risk_ratio: number;
  opposing_threshold: number;
  skip_suggested: boolean;
  milestone_hints: LiquidationMilestoneHint[];
};

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

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function round(value: number, decimals = 4): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function readAggregateDensity(snapshot: LiquidationHeatmapSnapshotRow): {
  longsBelow: number;
  shortsAbove: number;
} {
  const aggregate = asRecord(snapshot.aggregate_json);
  const longsBelow =
    toNumber(aggregate.longs_total_below_current_usd) ||
    toNumber(aggregate.total_longs_below_current_usd) ||
    toNumber(aggregate.longsBelowCurrentUsd);
  const shortsAbove =
    toNumber(aggregate.shorts_total_above_current_usd) ||
    toNumber(aggregate.total_shorts_above_current_usd) ||
    toNumber(aggregate.shortsAboveCurrentUsd);

  return {
    longsBelow: Math.max(0, longsBelow),
    shortsAbove: Math.max(0, shortsAbove),
  };
}

function readMilestoneHints(
  snapshot: LiquidationHeatmapSnapshotRow,
  direction: LiquidationTradeDirection,
): LiquidationMilestoneHint[] {
  const bands = asRecord(snapshot.bands_json);
  const side = direction === "SHORT" ? "longs" : "shorts";
  const sideBands = asArray(bands[side]);

  return sideBands
    .map((row) => {
      const item = asRecord(row);
      return {
        price_level: toNumber(item.price_level),
        distance_pct: toNumber(item.distance_pct),
        estimated_liquidations_usd: toNumber(item.estimated_liquidations_usd),
      };
    })
    .filter((row) => row.price_level > 0 && row.estimated_liquidations_usd > 0)
    .sort((a, b) => b.estimated_liquidations_usd - a.estimated_liquidations_usd)
    .slice(0, 3)
    .map((row) => ({
      price_level: round(row.price_level, 2),
      distance_pct: round(row.distance_pct, 4),
      estimated_liquidations_usd: round(row.estimated_liquidations_usd, 2),
    }));
}

export function buildLiquidationAdvisory(
  snapshot: LiquidationHeatmapSnapshotRow,
  direction: LiquidationTradeDirection,
  options?: {
    opposingThreshold?: number;
  },
): LiquidationAdvisory {
  const threshold = Math.max(0.1, toNumber(options?.opposingThreshold, 1.2));
  const density = readAggregateDensity(snapshot);
  const directionalFuel = direction === "LONG" ? density.shortsAbove : density.longsBelow;
  const opposingRisk = direction === "LONG" ? density.longsBelow : density.shortsAbove;
  const ratio = directionalFuel / Math.max(opposingRisk, 1);
  const skipSuggested = opposingRisk > directionalFuel * threshold;

  return {
    mode: "advisory_only",
    symbol: snapshot.symbol,
    direction,
    interval: snapshot.interval,
    exchange_group: snapshot.exchange_group,
    snapshot_time_utc: snapshot.snapshot_time_utc,
    current_price: round(snapshot.current_price, 2),
    directional_fuel_usd: round(directionalFuel, 2),
    opposing_risk_usd: round(opposingRisk, 2),
    fuel_risk_ratio: round(ratio, 4),
    opposing_threshold: threshold,
    skip_suggested: skipSuggested,
    milestone_hints: readMilestoneHints(snapshot, direction),
  };
}
