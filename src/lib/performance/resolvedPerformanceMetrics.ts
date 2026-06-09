/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: src/lib/performance/resolvedPerformanceMetrics.ts
 *
 * Description:
 * Shared resolved-return helpers for Performance surfaces. These helpers keep
 * ViewMode, scope filtering, week totals, and additive drawdown calculations
 * aligned across the sidebar, simulation cards, rolling windows, and basket.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { computeMaxDrawdownSimple } from "@/lib/performance/drawdown";
import {
  assetMatchesPerformanceScope,
  isAllPerformanceAssetSelection,
  type PerformanceAssetSelection,
} from "@/lib/performance/performanceAssetScope";
import type { WeeklyHoldResult, WeeklyHoldTrade } from "@/lib/performance/weeklyHoldEngine";
import type { ViewMode } from "@/lib/viewMode/viewModeTypes";

export type ResolvedWeekReturn = {
  weekOpenUtc: string;
  returnPct: number;
  maxDrawdownPct?: number | null;
  trades?: number | null;
};

export type ResolvedPerformanceSeries = {
  id: string;
  label: string;
  color?: string;
  trades?: number;
  points: Array<{
    ts_utc: string;
    equity_pct: number;
    lock_pct: number | null;
    peak_pct: number;
    drawdown_pct: number;
    active_positions?: number;
  }>;
};

export type ResolvedPerformanceSummary = {
  returnPct: number | null;
  maxDrawdownPct: number | null;
  trades: number | null;
};

export type RollingWindowStats = {
  weeks: number;
  returnPct: number;
  maxDrawdownPct: number;
  sharpe: number;
};

export type ResolvedAssetContribution = {
  id: string;
  label: string;
  returnPct: number;
  color?: string;
};

const ASSET_LABELS: Record<string, string> = {
  fx: "FX",
  indices: "Indices",
  commodities: "Commodities",
  crypto: "Crypto",
};

const ASSET_ORDER = ["fx", "indices", "commodities", "crypto"];

export function resolveStrategyTradeReturn(
  trade: Pick<WeeklyHoldTrade, "returnPct" | "rawReturnPct">,
  viewMode: ViewMode,
): number {
  if (viewMode.normalization === "raw" && typeof trade.rawReturnPct === "number") {
    return trade.rawReturnPct;
  }
  return trade.returnPct;
}

export function scopedStrategyTrades(
  result: WeeklyHoldResult,
  scope: PerformanceAssetSelection,
): WeeklyHoldTrade[] {
  return isAllPerformanceAssetSelection(scope)
    ? result.trades
    : result.trades.filter((trade) => assetMatchesPerformanceScope(trade.assetClass, scope));
}

export function strategyDisplayTrades(result: WeeklyHoldResult): WeeklyHoldTrade[] {
  if (
    result.displayUnit === "grids" &&
    !result.isRealized &&
    result.plannedTrades &&
    result.plannedTrades.length > 0
  ) {
    return result.plannedTrades;
  }
  return result.trades;
}

export function scopedStrategyDisplayTrades(
  result: WeeklyHoldResult,
  scope: PerformanceAssetSelection,
): WeeklyHoldTrade[] {
  const trades = strategyDisplayTrades(result);
  return isAllPerformanceAssetSelection(scope)
    ? trades
    : trades.filter((trade) => assetMatchesPerformanceScope(trade.assetClass, scope));
}

export function scopedStrategyWeekReturn(
  result: WeeklyHoldResult,
  scope: PerformanceAssetSelection,
  viewMode: ViewMode,
): number {
  if (isAllPerformanceAssetSelection(scope) && viewMode.normalization !== "raw") {
    return result.totalReturnPct;
  }
  return scopedStrategyTrades(result, scope)
    .reduce((sum, trade) => sum + resolveStrategyTradeReturn(trade, viewMode), 0);
}

export function buildResolvedWeekReturns(
  weekResults: Record<string, WeeklyHoldResult> | null | undefined,
  scope: PerformanceAssetSelection,
  viewMode: ViewMode,
): ResolvedWeekReturn[] {
  if (!weekResults) return [];
  return Object.values(weekResults)
    .filter((week) => week.isRealized)
    .sort((left, right) => left.weekOpenUtc.localeCompare(right.weekOpenUtc))
    .map((week) => {
      const trades = scopedStrategyTrades(week, scope);
      return {
        weekOpenUtc: week.weekOpenUtc,
        returnPct: scopedStrategyWeekReturn(week, scope, viewMode),
        maxDrawdownPct: null,
        trades: trades.length,
      };
    })
    .filter((week) => Number.isFinite(week.returnPct));
}

export function summarizeResolvedWeekReturns(
  weeks: ResolvedWeekReturn[],
): ResolvedPerformanceSummary {
  if (weeks.length === 0) {
    return { returnPct: null, maxDrawdownPct: null, trades: null };
  }
  const returns = weeks.map((week) => week.returnPct);
  return {
    returnPct: returns.reduce((sum, value) => sum + value, 0),
    maxDrawdownPct: computeMaxDrawdownSimple(returns),
    trades: weeks.reduce((sum, week) => sum + (week.trades ?? 0), 0),
  };
}

export function buildAdditiveSeriesFromWeekReturns(
  weeks: ResolvedWeekReturn[],
  options: {
    id?: string;
    label?: string;
    color?: string;
  } = {},
): ResolvedPerformanceSeries {
  let equity = 0;
  let peak = 0;
  let trades = 0;
  const points = weeks
    .filter((week) => Number.isFinite(week.returnPct))
    .sort((left, right) => left.weekOpenUtc.localeCompare(right.weekOpenUtc))
    .map((week) => {
      equity += week.returnPct;
      trades += week.trades ?? 0;
      peak = Math.max(peak, equity);
      const drawdownPct = -(peak - equity);
      return {
        ts_utc: week.weekOpenUtc,
        equity_pct: equity,
        lock_pct: null,
        peak_pct: peak,
        drawdown_pct: drawdownPct,
        active_positions: week.trades ?? 0,
      };
    });

  return {
    id: options.id ?? "resolved-weekly-path",
    label: options.label ?? "Resolved Weekly Path",
    color: options.color ?? "#10b981",
    trades,
    points,
  };
}

export function computeRollingWindowStatsFromWeekReturns(
  weeks: ResolvedWeekReturn[],
): RollingWindowStats {
  const returns = weeks.map((week) => week.returnPct);
  const totalReturn = returns.reduce((sum, value) => sum + value, 0);
  const closeToCloseDrawdownPct = computeMaxDrawdownSimple(returns);
  const intraPeriodDrawdownPct = Math.max(
    ...weeks.map((week) => week.maxDrawdownPct ?? 0).filter(Number.isFinite),
    0,
  );
  const maxDrawdownPct = Math.max(closeToCloseDrawdownPct, intraPeriodDrawdownPct);

  let sharpe = 0;
  if (returns.length > 1) {
    const avg = totalReturn / returns.length;
    const variance = returns.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (returns.length - 1);
    const std = Math.sqrt(variance);
    sharpe = std > 0 ? avg / std : 0;
  }

  return {
    weeks: returns.length,
    returnPct: totalReturn,
    maxDrawdownPct,
    sharpe,
  };
}

export function buildResolvedAssetContributions(
  weekResults: Record<string, WeeklyHoldResult> | null | undefined,
  scope: PerformanceAssetSelection,
  viewMode: ViewMode,
  selectedWeek: string,
): ResolvedAssetContribution[] {
  if (!weekResults) return [];
  const weeks = selectedWeek === "all"
    ? Object.values(weekResults).filter((week) => week.isRealized)
    : [weekResults[selectedWeek]].filter((week): week is WeeklyHoldResult => Boolean(week));

  const byAsset = new Map<string, number>();
  for (const week of weeks) {
    for (const trade of scopedStrategyTrades(week, scope)) {
      const assetClass = trade.assetClass;
      byAsset.set(
        assetClass,
        (byAsset.get(assetClass) ?? 0) + resolveStrategyTradeReturn(trade, viewMode),
      );
    }
  }

  return Array.from(byAsset.entries())
    .sort(([left], [right]) => {
      const leftIndex = ASSET_ORDER.indexOf(left);
      const rightIndex = ASSET_ORDER.indexOf(right);
      return (leftIndex === -1 ? ASSET_ORDER.length : leftIndex) -
        (rightIndex === -1 ? ASSET_ORDER.length : rightIndex);
    })
    .map(([assetClass, returnPct]) => ({
      id: `asset:${assetClass}`,
      label: ASSET_LABELS[assetClass] ?? assetClass,
      returnPct,
    }));
}
