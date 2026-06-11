/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: bitgetLiquidationFeatures.ts
 *
 * Description:
 * Shared feature extraction for liquidation heatmap advisory logic used by
 * backtests and runtime metadata tagging. Includes multi-timeframe exit
 * context for exit planning, leverage scaling, and cascade risk warnings.
 * This module is read-only and does not execute any trading actions.
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

// ---------------------------------------------------------------------------
// Multi-timeframe exit context
// ---------------------------------------------------------------------------

export type ExitZone = {
  price_level: number;
  distance_pct: number;
  estimated_liquidations_usd: number;
  timeframe_confluence: string[];
};

export type CascadeRisk = {
  interval: string;
  side: "longs" | "shorts";
  band_pct: number;
  cumulative_usd: number;
  incremental_usd: number;
};

export type MultiTimeframeExitContext = {
  mode: "advisory_only";
  symbol: string;
  direction: LiquidationTradeDirection;
  current_price: number;
  as_of_utc: string;
  intervals_available: string[];
  intervals_missing: string[];
  per_interval: Record<string, LiquidationAdvisory>;
  exit_zones: ExitZone[];
  cascade_risks: CascadeRisk[];
  leverage_scaling_note: string;
};

const EXIT_INTERVALS = ["6h", "1d", "7d", "30d"] as const;

function readBandRows(
  snapshot: LiquidationHeatmapSnapshotRow,
  side: "longs" | "shorts",
): Array<{ band_pct: number; cumulative_usd: number; incremental_usd: number; price_level: number }> {
  const bands = asRecord(snapshot.bands_json);
  const sideBands = asArray(bands[side]);

  return sideBands
    .map((row) => {
      const item = asRecord(row);
      return {
        band_pct: toNumber(item.band_pct),
        cumulative_usd: toNumber(item.estimated_liquidations_usd),
        incremental_usd: toNumber(item.incremental_liquidations_usd),
        price_level: toNumber(item.price_level),
      };
    })
    .filter((row) => row.band_pct > 0 && row.price_level > 0);
}

function buildExitZones(
  advisories: Map<string, LiquidationAdvisory>,
  direction: LiquidationTradeDirection,
): ExitZone[] {
  const zoneMap = new Map<number, { distance_pct: number; usd: number; intervals: string[] }>();

  for (const [interval, advisory] of advisories) {
    for (const hint of advisory.milestone_hints) {
      const key = hint.price_level;
      const existing = zoneMap.get(key);
      if (existing) {
        existing.usd = Math.max(existing.usd, hint.estimated_liquidations_usd);
        if (!existing.intervals.includes(interval)) {
          existing.intervals.push(interval);
        }
      } else {
        zoneMap.set(key, {
          distance_pct: hint.distance_pct,
          usd: hint.estimated_liquidations_usd,
          intervals: [interval],
        });
      }
    }
  }

  return Array.from(zoneMap.entries())
    .map(([price, data]) => ({
      price_level: price,
      distance_pct: round(data.distance_pct, 4),
      estimated_liquidations_usd: round(data.usd, 2),
      timeframe_confluence: data.intervals,
    }))
    .sort((a, b) => {
      if (b.timeframe_confluence.length !== a.timeframe_confluence.length) {
        return b.timeframe_confluence.length - a.timeframe_confluence.length;
      }
      return direction === "LONG"
        ? a.distance_pct - b.distance_pct
        : b.distance_pct - a.distance_pct;
    })
    .slice(0, 8);
}

function buildCascadeRisks(
  snapshots: Map<string, LiquidationHeatmapSnapshotRow>,
  direction: LiquidationTradeDirection,
): CascadeRisk[] {
  const opposingSide: "longs" | "shorts" = direction === "LONG" ? "longs" : "shorts";
  const risks: CascadeRisk[] = [];

  for (const [interval, snapshot] of snapshots) {
    const bands = readBandRows(snapshot, opposingSide);
    for (const band of bands) {
      if (band.incremental_usd > 0) {
        risks.push({
          interval,
          side: opposingSide,
          band_pct: band.band_pct,
          cumulative_usd: round(band.cumulative_usd, 2),
          incremental_usd: round(band.incremental_usd, 2),
        });
      }
    }
  }

  return risks
    .sort((a, b) => b.incremental_usd - a.incremental_usd)
    .slice(0, 10);
}

function buildLeverageNote(
  advisories: Map<string, LiquidationAdvisory>,
  direction: LiquidationTradeDirection,
): string {
  const weeklyAdvisory = advisories.get("7d");
  const monthlyAdvisory = advisories.get("30d");
  const dailyAdvisory = advisories.get("1d");

  const parts: string[] = [];

  if (weeklyAdvisory) {
    const { fuel_risk_ratio, opposing_risk_usd } = weeklyAdvisory;
    if (fuel_risk_ratio < 0.5) {
      parts.push(
        `7d: heavy opposing pressure ($${formatUsd(opposing_risk_usd)}) — tighten stops before pushing leverage`,
      );
    } else if (fuel_risk_ratio > 2.0) {
      parts.push(`7d: strong fuel ratio (${fuel_risk_ratio.toFixed(2)}x) — favorable for leverage scaling`);
    }
  }

  if (monthlyAdvisory) {
    const { milestone_hints } = monthlyAdvisory;
    if (milestone_hints.length > 0) {
      const nearest = milestone_hints[0];
      parts.push(
        `30d: nearest structural zone at ${formatPct(nearest.distance_pct)} ($${formatUsd(nearest.estimated_liquidations_usd)})`,
      );
    }
  }

  if (dailyAdvisory) {
    const { opposing_risk_usd, fuel_risk_ratio } = dailyAdvisory;
    if (fuel_risk_ratio < 0.8) {
      parts.push(
        `1d: fresh leverage stacked against you ($${formatUsd(opposing_risk_usd)}) — caution on scaling`,
      );
    }
  }

  if (!parts.length) {
    return "Insufficient multi-timeframe data for leverage scaling guidance.";
  }
  return parts.join("; ");
}

function formatUsd(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}

function formatPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function buildMultiTimeframeExitContext(
  snapshots: Map<string, LiquidationHeatmapSnapshotRow>,
  direction: LiquidationTradeDirection,
  options?: {
    symbol?: string;
    currentPrice?: number;
    opposingThreshold?: number;
  },
): MultiTimeframeExitContext {
  const advisories = new Map<string, LiquidationAdvisory>();
  const available: string[] = [];
  const missing: string[] = [];

  for (const interval of EXIT_INTERVALS) {
    const snapshot = snapshots.get(interval);
    if (snapshot) {
      advisories.set(
        interval,
        buildLiquidationAdvisory(snapshot, direction, {
          opposingThreshold: options?.opposingThreshold,
        }),
      );
      available.push(interval);
    } else {
      missing.push(interval);
    }
  }

  const firstSnapshot = snapshots.values().next().value;
  const symbol = options?.symbol ?? firstSnapshot?.symbol ?? "UNKNOWN";
  const currentPrice = options?.currentPrice ?? firstSnapshot?.current_price ?? 0;

  const perInterval: Record<string, LiquidationAdvisory> = {};
  for (const [interval, advisory] of advisories) {
    perInterval[interval] = advisory;
  }

  return {
    mode: "advisory_only",
    symbol,
    direction,
    current_price: round(currentPrice, 2),
    as_of_utc: new Date().toISOString(),
    intervals_available: available,
    intervals_missing: missing,
    per_interval: perInterval,
    exit_zones: buildExitZones(advisories, direction),
    cascade_risks: buildCascadeRisks(snapshots, direction),
    leverage_scaling_note: buildLeverageNote(advisories, direction),
  };
}
