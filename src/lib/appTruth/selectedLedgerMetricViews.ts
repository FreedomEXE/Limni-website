/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: selectedLedgerMetricViews.ts
 *
 * Description:
 * Reusable selected-ledger metric projections for app surfaces and receipts.
 * UI components should adapt these projections, not recompute ledger math.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { ClosedHistoryRow } from "@/lib/basket/basketSummaryTypes";
import type { AssetClass } from "@/lib/cotMarkets";
import type { EngineGridProps, EngineSidebarStats, EngineSimulationGroup } from "@/lib/performance/engineAdapter";
import type { StrategyConfig } from "@/lib/performance/strategyConfig";
import type { ModelPerformance, PerformanceModel } from "@/lib/performanceLab";
import { formatTradingWeekLabelDate } from "@/lib/weekAnchor";
import type { ViewMode } from "@/lib/viewMode/viewModeTypes";
import {
  resolveSelectedLedgerReturn,
  type SelectedLedgerPathPoint,
  type SelectedLedgerStats,
  type SelectedLedgerSummaryStat,
} from "@/lib/appTruth/selectedLedgerStats";

const ASSET_LABELS: Record<AssetClass, string> = {
  fx: "FX",
  indices: "Indices",
  commodities: "Commodities",
  crypto: "Crypto",
};

const ASSET_COLORS: Record<AssetClass, string> = {
  fx: "#38bdf8",
  indices: "#a78bfa",
  commodities: "#facc15",
  crypto: "#fb923c",
};

const DEFAULT_SELECTED_LEDGER_CARD_SLOTS = [
  "dealer",
  "commercial",
  "sentiment",
] as const satisfies readonly PerformanceModel[];

export type SelectedLedgerWeekReturnView = {
  weekOpenUtc: string;
  returnPct: number;
  maxDrawdownPct: number | null;
  trades: number;
};

export type SelectedLedgerAssetContributionView = {
  id: string;
  label: string;
  returnPct: number;
  color: string;
};

export type SelectedLedgerMaeTradeView = {
  pair: string;
  returnPct: number;
  maePct: number;
};

export type SelectedLedgerBasketMetricView = {
  returnPct: number | null;
  maxDrawdownPct: number | null;
  tradeCount: number | null;
  hasActivity: boolean;
};

export type SelectedLedgerSimulationProjection = {
  title: string;
  description: string;
  metrics: {
    returnPct: number | null;
    maxDrawdownPct: number | null;
    trades: number | null;
  };
  series: Array<{
    id: string;
    label: string;
    color: string;
    trades?: number;
    points: SelectedLedgerPathPoint[];
  }>;
};

export type SelectedLedgerAllTimeRowView = {
  model: PerformanceModel;
  totalPercent: number;
  weeks: number;
  winRate: number;
  avgWeekly: number;
};

function summaryToSimulationMetrics(summary: SelectedLedgerSummaryStat | null): SelectedLedgerSimulationProjection["metrics"] {
  return {
    returnPct: summary?.returnPct ?? null,
    maxDrawdownPct: summary?.maxDrawdownPct ?? null,
    trades: summary?.tradeCount ?? null,
  };
}

export function buildSelectedLedgerSimulationProjection(
  stats: SelectedLedgerStats | null,
  fallbackGroup: EngineSimulationGroup | null | undefined,
): SelectedLedgerSimulationProjection | null {
  if (!stats || stats.status !== "available" || !stats.summary) return null;
  return {
    title: fallbackGroup?.title ?? "Selected Performance",
    description: fallbackGroup?.description ?? "",
    metrics: summaryToSimulationMetrics(stats.summary),
    series: [{
      id: "equity",
      label: fallbackGroup?.series.find((series) => series.id === "equity" || series.id === "total")?.label ?? "Equity",
      color: "#10b981",
      trades: stats.summary.tradeCount,
      points: stats.pathPoints,
    }],
  };
}

export function buildSelectedLedgerWeekReturnViews(stats: SelectedLedgerStats | null): SelectedLedgerWeekReturnView[] {
  return stats?.status === "available"
    ? stats.weeklyReturns.map((week) => ({
        weekOpenUtc: week.weekOpenUtc,
        returnPct: week.returnPct,
        maxDrawdownPct: week.maxDrawdownPct,
        trades: week.trades,
      }))
    : [];
}

export function buildSelectedLedgerAssetContributionViews(
  stats: SelectedLedgerStats | null,
): SelectedLedgerAssetContributionView[] {
  return stats?.status === "available"
    ? stats.assetReturns.map((asset) => ({
        id: `asset:${asset.assetClass}`,
        label: ASSET_LABELS[asset.assetClass],
        returnPct: asset.returnPct,
        color: ASSET_COLORS[asset.assetClass],
      }))
    : [];
}

export function buildSelectedLedgerMaeTradeViews(stats: SelectedLedgerStats | null): SelectedLedgerMaeTradeView[] {
  return stats?.status === "available" ? stats.maeTrades : [];
}

export function buildSelectedLedgerBasketMetrics(stats: SelectedLedgerStats | null): SelectedLedgerBasketMetricView {
  if (!stats || stats.status !== "available" || !stats.summary) {
    return {
      returnPct: null,
      maxDrawdownPct: null,
      tradeCount: null,
      hasActivity: false,
    };
  }
  return {
    returnPct: stats.summary.returnPct,
    maxDrawdownPct: stats.summary.maxDrawdownPct,
    tradeCount: stats.summary.tradeCount,
    hasActivity: stats.summary.tradeCount > 0 || Math.abs(stats.summary.returnPct) > 1e-9,
  };
}

export function buildSelectedLedgerSidebarStats(
  baseStats: EngineSidebarStats | null | undefined,
  selectedStats: SelectedLedgerStats | null,
  allStats: SelectedLedgerStats | null,
  viewMode: ViewMode,
): EngineSidebarStats | null {
  if (!baseStats || !selectedStats?.summary || !allStats?.summary) return null;
  const selectedSummary = selectedStats.summary;
  const allSummary = allStats.summary;
  const trades: EngineSidebarStats["trades"] = [];
  for (const row of selectedStats.leafRows) {
    const returnPct = resolveSelectedLedgerReturn(row, viewMode);
    if (returnPct === null) continue;
    if (row.direction !== "LONG" && row.direction !== "SHORT") continue;
    trades.push({
      symbol: row.symbol,
      direction: row.direction,
      returnPct,
      assetClass: row.assetClass,
    });
  }
  return {
    ...baseStats,
    weekOpenUtc: selectedStats.selectedWeek,
    weekReturnPct: selectedSummary.returnPct,
    maxDrawdownPct: selectedSummary.maxDrawdownPct,
    tradeCount: selectedSummary.tradeCount,
    winCount: selectedSummary.winCount,
    lossCount: selectedSummary.lossCount,
    winRate: selectedSummary.winRate,
    trades,
    allTime: {
      totalReturnPct: allSummary.returnPct,
      totalTrades: allSummary.tradeCount,
      weeklyWinRate: allSummary.weeklyWinRate,
      maxDrawdownPct: allSummary.maxDrawdownPct,
      weeks: allStats.weeklyReturns.length,
      avgWeeklyReturn: allSummary.avgWeeklyReturn,
      sharpe: allSummary.sharpe,
      sortino: allSummary.sortino,
      calmar: allSummary.calmar,
      profitFactor: allSummary.profitFactor,
      expectancy: allSummary.expectancy,
      avgWin: allSummary.avgWin,
      avgLoss: allSummary.avgLoss,
      maxConsecutiveWins: allSummary.maxConsecutiveWins,
      maxConsecutiveLosses: allSummary.maxConsecutiveLosses,
    },
  };
}

function modelStatsFromReturns(returns: Array<{ pair: string; percent: number }>): ModelPerformance["stats"] {
  const values = returns.map((item) => item.percent).filter((value) => Number.isFinite(value));
  if (values.length === 0) {
    return {
      avg_return: 0,
      median_return: 0,
      win_rate: 0,
      volatility: 0,
      best_pair: null,
      worst_pair: null,
    };
  }
  const sorted = [...values].sort((left, right) => left - right);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const median = sorted.length % 2 === 0
    ? ((sorted[(sorted.length / 2) - 1] ?? 0) + (sorted[sorted.length / 2] ?? 0)) / 2
    : sorted[Math.floor(sorted.length / 2)] ?? 0;
  const variance = values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / values.length;
  return {
    avg_return: avg,
    median_return: median,
    win_rate: (values.filter((value) => value > 0).length / values.length) * 100,
    volatility: Math.sqrt(variance),
    best_pair: returns.reduce<ModelPerformance["stats"]["best_pair"]>(
      (current, item) => current === null || item.percent > current.percent ? item : current,
      null,
    ),
    worst_pair: returns.reduce<ModelPerformance["stats"]["worst_pair"]>(
      (current, item) => current === null || item.percent < current.percent ? item : current,
      null,
    ),
  };
}

export function slotForSelectedLedgerRow(
  row: ClosedHistoryRow,
  strategy: StrategyConfig,
): PerformanceModel | null {
  const slots = strategy.models ?? DEFAULT_SELECTED_LEDGER_CARD_SLOTS;
  if (strategy.cardBreakdown === "per_model") {
    return slots.find((slot) => slot === row.sourceModel) ?? null;
  }
  if (strategy.cardBreakdown === "tiers") {
    const tierIndex = row.tier === 1 ? 0 : row.tier === 2 ? 1 : row.tier === 3 ? 2 : -1;
    return tierIndex >= 0 ? slots[tierIndex] ?? null : null;
  }
  if (row.assetClass === "fx") return slots[0] ?? null;
  if (row.assetClass === "commodities" || row.assetClass === "indices") return slots[1] ?? null;
  if (row.assetClass === "crypto") return slots[2] ?? null;
  return null;
}

export function selectedLedgerReturnsForModel(
  rows: ClosedHistoryRow[],
  strategy: StrategyConfig,
  slot: PerformanceModel,
  viewMode: ViewMode,
) {
  return rows
    .filter((row) => slotForSelectedLedgerRow(row, strategy) === slot)
    .map((row) => ({
      row,
      returnPct: resolveSelectedLedgerReturn(row, viewMode),
    }))
    .filter((entry): entry is { row: ClosedHistoryRow; returnPct: number } => entry.returnPct !== null);
}

function groupModelRowsByWeek(
  entries: Array<{ row: ClosedHistoryRow; returnPct: number }>,
) {
  const groups = new Map<string, Array<{ row: ClosedHistoryRow; returnPct: number }>>();
  for (const entry of entries) {
    groups.set(entry.row.weekOpenUtc, [...(groups.get(entry.row.weekOpenUtc) ?? []), entry]);
  }
  return Array.from(groups.entries())
    .map(([weekOpenUtc, weekEntries]) => ({
      pair: `Week of ${formatTradingWeekLabelDate(weekOpenUtc)}`,
      percent: weekEntries.reduce((sum, entry) => sum + entry.returnPct, 0),
      weekOpenUtc,
    }))
    .sort((left, right) => left.weekOpenUtc.localeCompare(right.weekOpenUtc));
}

export function applySelectedLedgerStatsToModel(
  model: ModelPerformance,
  stats: SelectedLedgerStats,
  strategy: StrategyConfig,
  viewMode: ViewMode,
): ModelPerformance {
  const metricEntries = selectedLedgerReturnsForModel(stats.metricRows, strategy, model.model, viewMode);
  const leafEntries = selectedLedgerReturnsForModel(stats.leafRows, strategy, model.model, viewMode);
  const allTimeMode = stats.selectedWeek === "all";
  const returns = allTimeMode
    ? groupModelRowsByWeek(metricEntries).map((entry) => ({ pair: entry.pair, percent: entry.percent }))
    : leafEntries.map((entry) => ({
        pair: entry.row.symbol,
        percent: entry.returnPct,
      }));
  const pairDetails = allTimeMode
    ? returns.map((entry) => ({
        pair: entry.pair,
        direction: "NEUTRAL" as const,
        reason: ["Selected ledger weekly aggregate"],
        percent: entry.percent,
      }))
    : metricEntries.map((entry) => ({
        pair: entry.row.symbol,
        direction: entry.row.direction ?? "NEUTRAL" as const,
        reason: [entry.row.exitReason ?? "Selected ledger row"],
        percent: entry.returnPct,
      }));
  const percent = metricEntries.reduce((sum, entry) => sum + entry.returnPct, 0);
  const maxDrawdown = Math.max(
    ...stats.metricRows
      .filter((row) => slotForSelectedLedgerRow(row, strategy) === model.model)
      .map((row) => row.riskMatrix?.execution?.pathDrawdownRawPct ?? row.riskMatrix?.execution?.maeRawPct ?? 0),
    0,
  );

  return {
    ...model,
    percent,
    priced: returns.length,
    total: returns.length,
    returns,
    pair_details: pairDetails,
    stats: modelStatsFromReturns(returns),
    diagnostics: {
      ...model.diagnostics,
      max_drawdown: maxDrawdown,
    },
    trailing: model.trailing
      ? {
          ...model.trailing,
          peak_percent: Math.max(model.trailing.peak_percent, percent),
          locked_percent: percent,
          max_drawdown: maxDrawdown,
        }
      : model.trailing,
  };
}

export function buildSelectedLedgerAllTimeRows(
  allStats: SelectedLedgerStats,
  rows: EngineGridProps["allTime"]["combined"],
  strategy: StrategyConfig,
  viewMode: ViewMode,
): EngineGridProps["allTime"]["combined"] {
  return rows.map((row) => {
    const entries = selectedLedgerReturnsForModel(allStats.metricRows, strategy, row.model, viewMode);
    const weeklyRows = groupModelRowsByWeek(entries);
    const weeklyReturns = weeklyRows.map((week) => week.percent);
    const totalPercent = weeklyReturns.reduce((sum, value) => sum + value, 0);
    return {
      ...row,
      totalPercent,
      weeks: weeklyRows.length,
      winRate: weeklyRows.length > 0
        ? (weeklyReturns.filter((value) => value > 0).length / weeklyRows.length) * 100
        : 0,
      avgWeekly: weeklyRows.length > 0 ? totalPercent / weeklyRows.length : 0,
    };
  });
}

export function applySelectedLedgerStatsToGridProps(
  gridProps: EngineGridProps | null,
  stats: SelectedLedgerStats | null,
  allStats: SelectedLedgerStats | null,
  strategy: StrategyConfig | null,
  viewMode: ViewMode,
): EngineGridProps | null {
  if (!gridProps || !stats?.summary || !allStats?.summary || !strategy) return gridProps;
  const patchModels = (models: ModelPerformance[], activeStats: SelectedLedgerStats) =>
    models.map((model) => applySelectedLedgerStatsToModel(model, activeStats, strategy, viewMode));
  return {
    ...gridProps,
    combined: {
      ...gridProps.combined,
      models: patchModels(gridProps.combined.models, stats),
    },
    perAsset: gridProps.perAsset.map((section) => ({
      ...section,
      models: patchModels(section.models, stats),
    })),
    allTime: {
      combined: buildSelectedLedgerAllTimeRows(allStats, gridProps.allTime.combined, strategy, viewMode),
      perAsset: Object.fromEntries(
        Object.entries(gridProps.allTime.perAsset).map(([key, rows]) => [
          key,
          buildSelectedLedgerAllTimeRows(allStats, rows, strategy, viewMode),
        ]),
      ),
    },
  };
}

export function buildSelectedLedgerModelReceipts(
  stats: SelectedLedgerStats,
  strategy: StrategyConfig,
  viewMode: ViewMode,
) {
  const slots = strategy.models ?? DEFAULT_SELECTED_LEDGER_CARD_SLOTS;
  return slots.map((slot) => {
    const entries = selectedLedgerReturnsForModel(stats.metricRows, strategy, slot, viewMode);
    const leafEntries = selectedLedgerReturnsForModel(stats.leafRows, strategy, slot, viewMode);
    return {
      model: slot,
      returnPct: entries.reduce((sum, entry) => sum + entry.returnPct, 0),
      metricRowCount: entries.length,
      leafRowCount: leafEntries.length,
    };
  });
}
