/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: PerformanceViewSection.tsx
 *
 * Description:
 * Performance body shell. Engine-driven path renders with client-side
 * week switching (instant). Dispatches custom events so sidebar can
 * react to week changes. Falls back to legacy when no engine data.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

import { memo, useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";
import type { PerformanceSystem } from "@/lib/performance/modelConfig";
import type { PerformanceView } from "@/lib/performance/pageState";
import type { EngineGridProps, EngineSidebarStats, EngineSimulationGroup } from "@/lib/performance/engineAdapter";
import AnchorDisclosureLabel from "@/components/common/AnchorDisclosureLabel";
import BasketHierarchy from "@/components/common/basket/BasketHierarchy";
import ViewModeControls from "@/components/common/ViewModeControls";
import PerformanceGrid from "@/components/performance/PerformanceGrid";
import PerformanceViewCards, {
  PERFORMANCE_VIEW_CARDS,
} from "@/components/performance/PerformanceViewCards";
import PerformanceSimulationSection, {
  type PerformanceSimulationGroup,
} from "@/components/performance/PerformanceSimulationSection";
import PerformanceScopeControl from "@/components/performance/PerformanceScopeControl";
import type { WeekReturn } from "@/components/performance/ReturnsCalendar";
import type { MaeTrade } from "@/components/performance/MaeScatterPlot";
import PerformanceNotesPad from "@/components/performance/PerformanceNotesPad";
import ScrollableWeekStrip from "@/components/shared/ScrollableWeekStrip";
import type { ClosedHistoryBundle } from "@/lib/basket/basketSummaryTypes";
import { buildClosedHistoryBundleFromStrategyResults } from "@/lib/basket/strategyRuntimeRows";
import {
  buildSelectedLedgerStats,
} from "@/lib/appTruth/selectedLedgerStats";
import {
  applySelectedLedgerStatsToGridProps,
  buildSelectedLedgerAssetContributionViews,
  buildSelectedLedgerBasketMetrics,
  buildSelectedLedgerMaeTradeViews,
  buildSelectedLedgerSidebarStats,
  buildSelectedLedgerSimulationProjection,
  buildSelectedLedgerWeekReturnViews,
} from "@/lib/appTruth/selectedLedgerMetricViews";
import {
  resolveActiveStrategyEntry,
  resolveDisplayModelsForEntry,
  type PerformanceStrategyFamily,
} from "@/lib/performance/strategyRegistry";
import { getStrategy, type StrategyConfig } from "@/lib/performance/strategyConfig";
import type { WeeklyHoldResult } from "@/lib/performance/weeklyHoldEngine";
import {
  ALL_PERFORMANCE_ASSET_SELECTION,
  formatPerformanceAssetSelection,
  inferPerformanceAssetClass,
  normalizePerformanceAssetSelection,
  symbolMatchesPerformanceScope,
  type PerformanceAssetSelection,
} from "@/lib/performance/performanceAssetScope";
import {
  deriveScopedSimulationMetrics,
  filterGridPropsByPerformanceScope,
  resolveScopedSimulationSeries,
} from "@/lib/performance/scopedPerformanceModel";
import { computeSidebarAllTimeMetricBasis } from "@/lib/performance/performanceMetricBasis";
import { resolveSimulationGroupForViewMode } from "@/lib/performance/simulationReturnModes";
import {
  buildResolvedAssetContributions,
  buildResolvedWeekReturns,
  resolveStrategyTradeReturn,
  scopedStrategyDisplayTrades,
  scopedStrategyTrades,
  scopedStrategyWeekReturn,
} from "@/lib/performance/resolvedPerformanceMetrics";
import {
  formatTradingWeekLabelDate,
  formatTradingWeekLabelIsoDate,
  normalizeWeekOpenUtc,
} from "@/lib/weekAnchor";
import {
  STRATEGY_SIDEBAR_STATS_EVENT,
  type RuntimeStrategySelection,
  type StrategySidebarStatsDetail,
} from "@/lib/performance/strategySelection";
import { useViewMode } from "@/lib/viewMode/viewModeStore";
import type { ViewMode } from "@/lib/viewMode/viewModeTypes";
import type { TradeStrategyFamily } from "@/lib/trades/tradeTypes";

const MemoPerformanceSimulationSection = memo(PerformanceSimulationSection);

type GridProps = Omit<ComponentProps<typeof PerformanceGrid>, "view" | "combined" | "perAsset"> & {
  combined: ComponentProps<typeof PerformanceGrid>["combined"];
  perAsset: ComponentProps<typeof PerformanceGrid>["perAsset"];
};
type GridSection = EngineGridProps["combined"];
type GridModel = GridSection["models"][number];
type GridReturn = GridModel["returns"][number];

type WeeklyPerformanceFamily = Exclude<PerformanceStrategyFamily, "katarakti">;
type DisplayTradeDetail = {
  rawReturnPct?: number;
  normalizedReturnPct?: number;
  displayReturnPct?: number;
  adrPct?: number | null;
  maePct?: number | null;
  gridPathDrawdownRawPct?: number | null;
  capActiveFillsAtEntry?: number | null;
  capThresholdAtEntry?: number | null;
  capViolated?: boolean;
  tradeNumber?: number;
};

function readRawReturnPct(tradeDetail: unknown): number | null {
  const rawReturnPct = (tradeDetail as DisplayTradeDetail | null | undefined)?.rawReturnPct;
  return typeof rawReturnPct === "number" ? rawReturnPct : null;
}

function readProjectedTradeReturnPct(tradeDetail: unknown, viewMode: ViewMode): number | null {
  const detail = tradeDetail as DisplayTradeDetail | null | undefined;
  if (!detail) return null;
  const rawReturnPct = typeof detail.rawReturnPct === "number" ? detail.rawReturnPct : null;
  if (viewMode.normalization === "raw") return rawReturnPct;
  if (rawReturnPct !== null && typeof detail.adrPct === "number" && detail.adrPct > 0) {
    return rawReturnPct / detail.adrPct;
  }
  if (typeof detail.normalizedReturnPct === "number") return detail.normalizedReturnPct;
  if (typeof detail.displayReturnPct === "number") return detail.displayReturnPct;
  return null;
}

function formatPct(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function liveAssetClassTone(assetClass: ReturnType<typeof inferPerformanceAssetClass>) {
  if (assetClass === "fx") return "border-sky-500/45 bg-sky-500/15 text-sky-400";
  if (assetClass === "crypto") return "border-orange-500/45 bg-orange-500/15 text-orange-400";
  if (assetClass === "commodities") return "border-yellow-500/45 bg-yellow-500/15 text-yellow-400";
  if (assetClass === "indices") return "border-purple-500/45 bg-purple-500/15 text-purple-400";
  return "border-[var(--panel-border)] text-[color:var(--muted)]";
}

function LiveAssetClassBadge({ symbol }: { symbol: string }) {
  const assetClass = inferPerformanceAssetClass(symbol);
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${liveAssetClassTone(assetClass)}`}>
      {assetClass}
    </span>
  );
}

function directionSortValue(direction: "LONG" | "SHORT" | "NEUTRAL"): number {
  if (direction === "SHORT") return 0;
  if (direction === "LONG") return 1;
  return 2;
}

function liveTradeTime(value: string | null | undefined) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function sortLiveTradeChildren<T extends { tradeDetail?: { entryTimeUtc: string | null; tradeNumber: number }; percent: number | null }>(
  children: T[],
) {
  return [...children].sort((left, right) => {
    const entryDiff = liveTradeTime(left.tradeDetail?.entryTimeUtc) - liveTradeTime(right.tradeDetail?.entryTimeUtc);
    if (entryDiff !== 0) return entryDiff;
    return (left.tradeDetail?.tradeNumber ?? Number.MAX_SAFE_INTEGER) -
      (right.tradeDetail?.tradeNumber ?? Number.MAX_SAFE_INTEGER);
  });
}

function TradeDetailRow({ detail }: { detail: { entryPrice: number; exitPrice: number | null; tpPrice: number | null; adrPct: number | null; maePct: number | null; exitReason: string | null; entryTimeUtc: string | null; tradeNumber: number; rawReturnPct?: number; normalizedReturnPct?: number; displayReturnPct?: number; capActiveFillsAtEntry?: number | null; capThresholdAtEntry?: number | null; capViolated?: boolean } }) {
  const resultValue =
    typeof detail.displayReturnPct === "number"
      ? detail.displayReturnPct
      : typeof detail.normalizedReturnPct === "number"
        ? detail.normalizedReturnPct
        : typeof detail.rawReturnPct === "number"
          ? detail.rawReturnPct
          : null;
  const resultColor = resultValue === null
    ? "text-[color:var(--muted)]"
    : resultValue > 0
      ? "text-lime-400"
      : resultValue < 0
        ? "text-red-400"
        : "text-[color:var(--muted)]";
  return (
    <div className="mt-1.5 grid grid-cols-4 gap-x-4 gap-y-1 text-[10px] text-[color:var(--muted)]">
      <span>Entry: <strong className="text-[var(--foreground)]">{detail.entryPrice.toFixed(5)}</strong></span>
      <span>Exit: <strong className="text-[var(--foreground)]">{detail.exitPrice?.toFixed(5) ?? "—"}</strong></span>
      <span>TP: <strong className="text-[var(--foreground)]">{detail.tpPrice?.toFixed(5) ?? "—"}</strong></span>
      <span>Result: <strong className={resultColor}>{detail.exitReason?.toUpperCase() ?? "—"}</strong></span>
      {detail.adrPct != null && <span>ADR: <strong className="text-[var(--foreground)]">{detail.adrPct.toFixed(2)}%</strong></span>}
      {detail.maePct != null && <span>MAE: <strong className="text-red-400">{detail.maePct.toFixed(2)}%</strong></span>}
      {detail.capThresholdAtEntry != null && <span>Cap: <strong className={detail.capViolated ? "text-red-400" : "text-[var(--foreground)]"}>{detail.capActiveFillsAtEntry ?? "—"}/{detail.capThresholdAtEntry}</strong></span>}
    </div>
  );
}

function hasGridActivity(gridProps: EngineGridProps | null | undefined) {
  return Boolean(gridProps?.combined.models.some((model) => (
    model.total > 0 ||
    model.returns.length > 0 ||
    model.pair_details.length > 0 ||
    Math.abs(model.percent) > 1e-9
  )));
}

function resolveGridDetailPercent(
  detail: {
    percent: number | null;
    tradeDetail?: unknown;
    children?: Array<{ percent: number | null; tradeDetail?: unknown }>;
  },
  viewMode: ViewMode,
) {
  if (detail.children && detail.children.length > 0) {
    return detail.children.reduce((sum, child) => (
      sum + (readProjectedTradeReturnPct(child.tradeDetail, viewMode) ?? child.percent ?? 0)
    ), 0);
  }
  return readProjectedTradeReturnPct(detail.tradeDetail, viewMode) ?? detail.percent;
}

function projectGridPropsForViewMode<T extends { combined: EngineGridProps["combined"]; perAsset: EngineGridProps["perAsset"] }>(
  gridProps: T | null,
  viewMode: ViewMode,
): T | null {
  if (!gridProps) return gridProps;
  const projectSection = (section: EngineGridProps["combined"]) => ({
    ...section,
    models: section.models.map((model) => {
      const pairDetails = model.pair_details.map((detail) => {
        const children = detail.children?.map((child) => ({
          ...child,
          percent: readProjectedTradeReturnPct(child.tradeDetail, viewMode) ?? child.percent,
        }));
        const percent = resolveGridDetailPercent({ ...detail, children }, viewMode);
        return { ...detail, children, percent };
      });
      const returns = pairDetails
        .filter((detail) => detail.percent !== null && Number.isFinite(detail.percent))
        .map((detail) => ({ pair: detail.pair, percent: detail.percent ?? 0 }));
      return {
        ...model,
        pair_details: pairDetails,
        returns,
        percent: returns.reduce((sum, item) => sum + item.percent, 0),
        stats: computeGridReturnStats(returns),
        diagnostics: {
          ...model.diagnostics,
          max_drawdown: maxDrawdownFromReturns(returns),
          profit_factor: profitFactorFromReturns(returns),
        },
      };
    }),
  });
  return {
    ...gridProps,
    combined: projectSection(gridProps.combined),
    perAsset: gridProps.perAsset.map(projectSection),
  } as T;
}

function profitFactorFromReturns(returns: GridReturn[]) {
  const grossProfit = returns
    .filter((entry) => Number.isFinite(entry.percent) && entry.percent > 0)
    .reduce((sum, entry) => sum + entry.percent, 0);
  const grossLoss = Math.abs(
    returns
      .filter((entry) => Number.isFinite(entry.percent) && entry.percent < 0)
      .reduce((sum, entry) => sum + entry.percent, 0),
  );
  if (grossLoss > 0) return grossProfit / grossLoss;
  return grossProfit > 0 ? Number.POSITIVE_INFINITY : null;
}

function maxDrawdownFromReturns(returns: GridReturn[]) {
  if (returns.length === 0) return null;
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const entry of returns) {
    if (!Number.isFinite(entry.percent)) continue;
    equity += entry.percent;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, equity - peak);
  }
  return Math.abs(maxDrawdown);
}

function computeGridReturnStats(returns: GridReturn[]): GridModel["stats"] {
  if (returns.length === 0) {
    return {
      avg_return: 0,
      median_return: 0,
      win_rate: 0,
      volatility: 0,
      best_pair: null,
      worst_pair: null,
    };
  }

  const values = returns.map((entry) => entry.percent).filter(Number.isFinite);
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
  const median = sorted.length % 2 === 1
    ? sorted[Math.floor(sorted.length / 2)] ?? 0
    : ((sorted[(sorted.length / 2) - 1] ?? 0) + (sorted[sorted.length / 2] ?? 0)) / 2;
  const variance = values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / values.length;
  return {
    avg_return: avg,
    median_return: median,
    win_rate: (values.filter((value) => value > 0).length / values.length) * 100,
    volatility: Math.sqrt(variance),
    best_pair: returns.reduce((best, entry) => (
      entry.percent > (best?.percent ?? -Infinity) ? entry : best
    ), null as GridReturn | null),
    worst_pair: returns.reduce((worst, entry) => (
      entry.percent < (worst?.percent ?? Infinity) ? entry : worst
    ), null as GridReturn | null),
  };
}

function tradeMatchesGridSlot(
  trade: WeeklyHoldResult["trades"][number],
  model: GridModel["model"],
  strategy: StrategyConfig,
) {
  switch (strategy.cardBreakdown) {
    case "asset_class":
      if (model === "dealer") return trade.assetClass === "fx";
      if (model === "commercial") return trade.assetClass === "commodities" || trade.assetClass === "indices";
      if (model === "sentiment") return trade.assetClass === "crypto";
      return false;
    case "tiers":
      if (model === "dealer") return trade.tier === 1;
      if (model === "commercial") return trade.tier === 2;
      if (model === "sentiment") return trade.tier === 3;
      return false;
    case "per_model":
      return trade.source === model;
  }
}

function resolveAllTimeSectionForViewMode(
  section: GridSection,
  weekResults: Record<string, WeeklyHoldResult>,
  scope: PerformanceAssetSelection,
  viewMode: ViewMode,
  strategy: StrategyConfig,
): GridSection {
  const weeks = Object.values(weekResults)
    .filter((week) => week.isRealized)
    .sort((left, right) => left.weekOpenUtc.localeCompare(right.weekOpenUtc));

  return {
    ...section,
    models: section.models.map((model) => {
      const returns = weeks.map((week) => {
        const trades = scopedStrategyTrades(week, scope)
          .filter((trade) => tradeMatchesGridSlot(trade, model.model, strategy));
        const percent = trades.reduce(
          (sum, trade) => sum + resolveStrategyTradeReturn(trade, viewMode),
          0,
        );
        return {
          pair: `Week of ${formatTradingWeekLabelIsoDate(week.weekOpenUtc)}`,
          percent,
        };
      });
      const percent = returns.reduce((sum, entry) => sum + entry.percent, 0);
      return {
        ...model,
        percent,
        priced: returns.length,
        total: returns.length,
        returns,
        pair_details: returns.map((entry) => ({
          pair: entry.pair,
          direction: (entry.percent >= 0 ? "LONG" : "SHORT") as "LONG" | "SHORT",
          reason: [`Weekly return ${entry.percent >= 0 ? "+" : ""}${entry.percent.toFixed(2)}%`],
          percent: entry.percent,
        })),
        stats: computeGridReturnStats(returns),
        diagnostics: {
          ...model.diagnostics,
          max_drawdown: maxDrawdownFromReturns(returns),
          profit_factor: profitFactorFromReturns(returns),
        },
      };
    }),
  };
}

function allTimeRowsFromSection(section: GridSection): EngineGridProps["allTime"]["combined"] {
  return section.models.map((model) => ({
    model: model.model,
    totalPercent: model.percent,
    weeks: model.returns.length,
    winRate: model.stats.win_rate,
    avgWeekly: model.stats.avg_return,
  }));
}

function resolveAllTimeGridPropsForViewMode(
  gridProps: EngineGridProps | null,
  weekResults: Record<string, WeeklyHoldResult> | null | undefined,
  scope: PerformanceAssetSelection,
  viewMode: ViewMode,
  selection: RuntimeStrategySelection | undefined,
): EngineGridProps | null {
  if (!gridProps || !weekResults || !selection) return gridProps;
  const strategy = getStrategy(selection.strategy);
  if (!strategy) return gridProps;

  const combined = resolveAllTimeSectionForViewMode(gridProps.combined, weekResults, scope, viewMode, strategy);
  const perAsset = gridProps.perAsset.map((section) =>
    resolveAllTimeSectionForViewMode(
      section,
      weekResults,
      [section.id as PerformanceAssetSelection[number]],
      viewMode,
      strategy,
    ),
  );

  return {
    ...gridProps,
    combined,
    perAsset,
    allTime: {
      combined: allTimeRowsFromSection(combined),
      perAsset: Object.fromEntries(
        perAsset.map((section) => [section.id, allTimeRowsFromSection(section)]),
      ),
    },
  };
}

function enrichGridPropsWithWeekRawTradeMeta<T extends EngineGridProps>(
  gridProps: T | null,
  weekResult: WeeklyHoldResult | null | undefined,
): T | null {
  if (!gridProps || !weekResult) return gridProps;

  const bySymbolDirection = new Map<string, WeeklyHoldResult["trades"]>();
  for (const trade of weekResult.trades) {
    const key = `${trade.symbol}|${trade.direction}`;
    const bucket = bySymbolDirection.get(key) ?? [];
    bucket.push(trade);
    bySymbolDirection.set(key, bucket);
  }

  const tradeToDetail = (trade: WeeklyHoldResult["trades"][number]) => ({
    tradeNumber: trade.detail?.tradeNumber ?? 1,
    entryPrice: trade.openPrice,
    exitPrice: trade.closePrice ?? null,
    tpPrice: trade.detail?.tpPrice ?? null,
    adrPct: trade.adrPct ?? trade.detail?.adrPct ?? null,
    maePct: trade.detail?.maePct ?? null,
    exitReason: trade.detail?.exitReason ?? "week_close",
    entryTimeUtc: trade.detail?.entryTimeUtc ?? null,
    rawReturnPct: trade.rawReturnPct,
    normalizedReturnPct: trade.normalizedReturnPct,
    displayReturnPct: trade.displayReturnPct ?? trade.returnPct,
    adrMultiplier: trade.adrMultiplier ?? null,
    returnMode: trade.returnMode,
    gridPathDrawdownRawPct: trade.detail?.gridPathDrawdownRawPct ?? null,
    capActiveFillsAtEntry: trade.detail?.capActiveFillsAtEntry ?? null,
    capThresholdAtEntry: trade.detail?.capThresholdAtEntry ?? null,
    capViolated: trade.detail?.capViolated ?? false,
  });

  const enrichSection = (section: EngineGridProps["combined"]) => ({
    ...section,
    models: section.models.map((model) => ({
      ...model,
      pair_details: model.pair_details.map((detail) => {
        const candidates = (bySymbolDirection.get(`${detail.pair}|${detail.direction}`) ?? [])
          .filter((trade) => trade.source === model.model)
          .sort((left, right) => (left.detail?.tradeNumber ?? 0) - (right.detail?.tradeNumber ?? 0));
        if (detail.children?.length) {
          const children = detail.children.map((child, index) => {
            const childDetail = child.tradeDetail as DisplayTradeDetail | undefined;
            if (
              readRawReturnPct(childDetail) !== null &&
              childDetail?.capThresholdAtEntry !== undefined &&
              childDetail?.gridPathDrawdownRawPct !== undefined
            ) {
              return child;
            }
            const tradeNumber = childDetail?.tradeNumber;
            const matched = typeof tradeNumber === "number"
              ? candidates.find((trade) => trade.detail?.tradeNumber === tradeNumber)
              : candidates[index];
            return matched ? { ...child, tradeDetail: tradeToDetail(matched) } : child;
          });
          return { ...detail, children };
        }
        if (readRawReturnPct(detail.tradeDetail) !== null) {
          return detail;
        }
        const matched =
          candidates.find((trade) => trade.source === model.model) ??
          (candidates.length === 1 ? candidates[0] : undefined);
        if (!matched || typeof matched.rawReturnPct !== "number") return detail;
        return {
          ...detail,
          tradeDetail: tradeToDetail(matched),
        };
      }),
    })),
  });

  return {
    ...gridProps,
    combined: enrichSection(gridProps.combined),
    perAsset: gridProps.perAsset.map(enrichSection),
  };
}

function resolveCanonicalWeekSelection(
  selectedWeek: string,
  sources: Array<Record<string, unknown> | readonly string[] | null | undefined>,
): string {
  if (selectedWeek === "all") return "all";

  const available = new Set<string>();
  for (const source of sources) {
    if (!source) continue;
    if (Array.isArray(source)) {
      for (const key of source) {
        if (key !== "all") available.add(key);
      }
      continue;
    }
    for (const key of Object.keys(source)) {
      if (key !== "all") available.add(key);
    }
  }

  if (available.has(selectedWeek)) return selectedWeek;
  const normalized = normalizeWeekOpenUtc(selectedWeek);
  if (normalized && available.has(normalized)) return normalized;
  return selectedWeek;
}

function computeScopedSidebarStats(
  baseStats: EngineSidebarStats | null | undefined,
  weekResults: Record<string, WeeklyHoldResult> | null | undefined,
  selectedWeek: string,
  scope: PerformanceAssetSelection,
  viewMode: ViewMode,
  allTimeSimulation: EngineSimulationGroup | null,
): EngineSidebarStats | null {
  if (!baseStats || !weekResults) return baseStats ?? null;

  const sortedWeeks = Object.values(weekResults)
    .filter((week) => week.isRealized)
    .sort((left, right) => left.weekOpenUtc.localeCompare(right.weekOpenUtc));
  const weeklyRows = buildResolvedWeekReturns(weekResults, scope, viewMode);
  const weeklyReturns = weeklyRows.map((week) => week.returnPct);
  const allScopedTrades = sortedWeeks.flatMap((week) => scopedStrategyTrades(week, scope));
  const tradeReturns = allScopedTrades.map((trade) => resolveStrategyTradeReturn(trade, viewMode));
  const scopedAllTimeSeries = resolveScopedSimulationSeries(allTimeSimulation, scope);
  const selectedResult =
    selectedWeek !== "all"
      ? weekResults[selectedWeek] ?? sortedWeeks.at(-1) ?? null
      : sortedWeeks.at(-1) ?? null;
  const selectedTrades = selectedResult ? scopedStrategyTrades(selectedResult, scope) : [];
  const selectedWinCount = selectedTrades.filter((trade) => resolveStrategyTradeReturn(trade, viewMode) > 0).length;
  const selectedLossCount = selectedTrades.filter((trade) => resolveStrategyTradeReturn(trade, viewMode) < 0).length;
  const totalTrades = weeklyRows.reduce((sum, week) => sum + (week.trades ?? 0), 0);
  const allTimeBasis = computeSidebarAllTimeMetricBasis({
    weeklyReturns,
    tradeReturns,
    pathPoints: scopedAllTimeSeries?.points ?? null,
    totalTrades,
  });

  return {
    ...baseStats,
    weekOpenUtc: selectedResult?.weekOpenUtc ?? baseStats.weekOpenUtc,
    weekReturnPct: selectedResult ? scopedStrategyWeekReturn(selectedResult, scope, viewMode) : 0,
    tradeCount: selectedTrades.length,
    winCount: selectedWinCount,
    lossCount: selectedLossCount,
    winRate:
      selectedTrades.length > 0
        ? (selectedWinCount / selectedTrades.length) * 100
        : 0,
    maxDrawdownPct: selectedWeek === "all" ? allTimeBasis.maxDrawdownPct : baseStats.maxDrawdownPct,
    trades: selectedTrades.map((trade) => ({
      symbol: trade.symbol,
      direction: trade.direction,
      returnPct: resolveStrategyTradeReturn(trade, viewMode),
      assetClass: trade.assetClass,
    })),
    allTime: allTimeBasis,
  };
}

function buildCanonicalWeekReturnsFromPayload(
  simulationMap: Record<string, EngineSimulationGroup> | null | undefined,
  weekResults: Record<string, WeeklyHoldResult> | null | undefined,
  scope: PerformanceAssetSelection,
  viewMode: ViewMode,
): WeekReturn[] {
  if (!simulationMap) return [];

  const fallbackRows = new Map(
    buildResolvedWeekReturns(weekResults, scope, viewMode)
      .map((week) => [week.weekOpenUtc, week]),
  );

  return Object.entries(simulationMap)
    .filter(([key]) => key !== "all")
    .map(([key, entry]) => {
      const fallback = fallbackRows.get(key);
      const hasSelectedPath = viewMode.normalization !== "raw" || Boolean(entry.returnModes?.raw);
      const resolvedEntry = hasSelectedPath
        ? resolveSimulationGroupForViewMode(entry, viewMode)
        : null;
      const metrics = resolvedEntry
        ? deriveScopedSimulationMetrics(resolvedEntry, scope)
        : null;
      const result = weekResults?.[key] ?? null;
      const fallbackReturn = fallback?.returnPct
        ?? (result ? scopedStrategyWeekReturn(result, scope, viewMode) : entry.metrics.returnPct);
      const fallbackTrades = fallback?.trades
        ?? (result ? scopedStrategyDisplayTrades(result, scope).length : entry.metrics.trades);

      return {
        weekOpenUtc: key,
        returnPct: metrics?.returnPct ?? fallbackReturn ?? 0,
        maxDrawdownPct: metrics?.maxDrawdownPct ?? resolvedEntry?.metrics.maxDrawdownPct ?? fallback?.maxDrawdownPct ?? null,
        trades: metrics?.trades ?? fallbackTrades ?? null,
      };
    })
    .filter((week) => Number.isFinite(week.returnPct))
    .sort((a, b) => a.weekOpenUtc.localeCompare(b.weekOpenUtc));
}

function applySimulationMetricsToSidebarStats(
  stats: EngineSidebarStats | null,
  selectedMetrics: { returnPct: number | null; maxDrawdownPct: number | null; trades: number | null } | null,
  allTimeMetrics: { returnPct: number | null; maxDrawdownPct: number | null; trades: number | null } | null,
  selectedWeek: string,
): EngineSidebarStats | null {
  if (!stats) return stats;

  const maxDrawdownPct = selectedMetrics?.maxDrawdownPct ?? stats.maxDrawdownPct;
  const tradeCount = selectedWeek === "all"
    ? selectedMetrics?.trades ?? stats.tradeCount
    : stats.tradeCount;
  const weekReturnPct = selectedWeek === "all"
    ? stats.weekReturnPct
    : selectedMetrics?.returnPct ?? stats.weekReturnPct;

  return {
    ...stats,
    weekReturnPct,
    maxDrawdownPct,
    tradeCount,
    allTime: stats.allTime
      ? {
          ...stats.allTime,
          totalReturnPct: allTimeMetrics?.returnPct ?? stats.allTime.totalReturnPct,
          totalTrades: allTimeMetrics?.trades ?? stats.allTime.totalTrades,
          maxDrawdownPct: allTimeMetrics?.maxDrawdownPct ?? stats.allTime.maxDrawdownPct,
        }
      : stats.allTime,
  };
}

function parseWeekKeyFromBasketLabel(label: string): string | null {
  const match = label.match(/\bweek of\s+(\d{4}-\d{2}-\d{2})\b/i);
  if (!match) return null;
  return normalizeWeekOpenUtc(`${match[1]}T00:00:00.000Z`) ?? `${match[1]}T00:00:00.000Z`;
}

function formatWeekBasketLabel(weekOpenUtc: string) {
  return `Week of ${formatTradingWeekLabelDate(weekOpenUtc)}`;
}

function EngineBasketView({
  gridProps,
  weeklyReturns,
  selection,
  weekOpenUtc,
  currentWeek,
  scope,
  viewMode,
  authoritativeMetrics,
  selectedTradeRowsBundle,
  isAllTime = false,
}: {
  gridProps: EngineGridProps;
  weeklyReturns?: WeekReturn[];
  selection?: RuntimeStrategySelection;
  weekOpenUtc?: string | null;
  currentWeek?: string;
  scope: PerformanceAssetSelection;
  viewMode: ViewMode;
  authoritativeMetrics?: ComponentProps<typeof BasketHierarchy>["authoritativeMetrics"];
  selectedTradeRowsBundle?: ClosedHistoryBundle | null;
  isAllTime?: boolean;
}) {
  const [expandedPairs, setExpandedPairs] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) => {
    setExpandedPairs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const strategyFamily = (selection?.f1 ?? "weekly_hold") as TradeStrategyFamily;
  const strategyVariant = selection
    ? `${selection.strategy}-${selection.f1}-${selection.f2}`
    : "tandem-weekly_hold-none";
  const resetKey = `${strategyVariant}|${weekOpenUtc ?? "all"}|${isAllTime ? "all" : "week"}|${formatPerformanceAssetSelection(scope)}|${viewMode.anchor}|${viewMode.normalization}`;

  useEffect(() => {
    setExpandedPairs(new Set());
  }, [resetKey]);

  const canUseHierarchy = Boolean(selection && selectedTradeRowsBundle?.rows.length);
  const hierarchySelectedWeek = isAllTime ? "all" : weekOpenUtc ?? null;
  const shouldUseClosedHistoryHierarchy = canUseHierarchy
    && hierarchySelectedWeek !== null;

  if (shouldUseClosedHistoryHierarchy && hierarchySelectedWeek) {
    return (
      <BasketHierarchy
        strategyVariant={strategyVariant}
        strategyFamily={strategyFamily}
        selectedWeek={hierarchySelectedWeek}
        currentWeek={currentWeek}
        scope={scope}
        viewMode={viewMode}
        authoritativeMetrics={authoritativeMetrics}
        selectedTradeRowsBundle={selectedTradeRowsBundle}
      />
    );
  }

  // Flatten all trades from all models into a single list for the quarantined
  // legacy Basket fallback path.
  const allTrades = gridProps.combined.models.flatMap((model) =>
    model.pair_details.map((detail) => ({
      ...detail,
      slotLabel: gridProps.labels[model.model] ?? model.model,
    })),
  );

  if (isAllTime && weeklyReturns && weeklyReturns.length > 0) {
    type BasketTradeRow = (typeof allTrades)[number];
    const sleeveRowsByWeek = new Map<string, BasketTradeRow[]>();
    for (const trade of allTrades) {
      const weekKey = parseWeekKeyFromBasketLabel(trade.pair);
      if (!weekKey) continue;
      if (!sleeveRowsByWeek.has(weekKey)) sleeveRowsByWeek.set(weekKey, []);
      sleeveRowsByWeek.get(weekKey)!.push(trade);
    }
    const weeks = [...weeklyReturns].sort((left, right) => right.weekOpenUtc.localeCompare(left.weekOpenUtc));
    const totalReturn = weeks.reduce((sum, week) => sum + week.returnPct, 0);
    const wins = weeks.filter((week) => week.returnPct > 0).length;
    const totalTrades = weeks.reduce((sum, week) => sum + (week.trades ?? 0), 0);

    return (
      <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
              {gridProps.combined.description}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-4 text-xs">
            <div className="flex items-center gap-4">
              <span className="text-[color:var(--muted)]">{weeks.length} weeks</span>
              <span className="text-[color:var(--muted)]">{totalTrades} trades</span>
              <span className="text-lime-400">{wins}W</span>
              <span className="text-red-400">{weeks.length - wins}L</span>
              <span className={totalReturn >= 0 ? "font-bold text-lime-400" : "font-bold text-red-400"}>
                {formatPct(totalReturn)}
              </span>
            </div>
          </div>
        </div>

        <div className="max-h-[65vh] space-y-1.5 overflow-y-auto">
          {weeks.map((week) => {
            const sleeveRows = sleeveRowsByWeek.get(week.weekOpenUtc) ?? [];
            const rowKey = `week-${week.weekOpenUtc}`;
            const isExpanded = expandedPairs.has(rowKey);
            const isWin = week.returnPct > 0;
            return (
              <div key={rowKey}>
                <div
                  className={`flex items-center justify-between rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-4 py-2.5 ${sleeveRows.length > 0 ? "cursor-pointer hover:border-[var(--accent)]/30" : ""}`}
                  onClick={sleeveRows.length > 0 ? () => toggleExpand(rowKey) : undefined}
                >
                  <div className="flex items-center gap-3">
                    {sleeveRows.length > 0 && (
                      <span className="w-4 text-[10px] text-[color:var(--muted)]">{isExpanded ? "▾" : "▸"}</span>
                    )}
                    <span className="w-36 text-sm font-semibold text-[var(--foreground)]">
                      {formatWeekBasketLabel(week.weekOpenUtc)}
                    </span>
                    <span className="text-[10px] text-[color:var(--muted)]">
                      {week.trades ?? 0} trades
                    </span>
                    {sleeveRows.length > 0 && (
                      <span className="text-[10px] text-[color:var(--muted)]">
                        {sleeveRows.length} sleeves
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      isWin ? "text-lime-400" : week.returnPct < 0 ? "text-red-400" : "text-[color:var(--muted)]"
                    }`}
                  >
                    {formatPct(week.returnPct)}
                  </span>
                </div>

                {isExpanded && sleeveRows.length > 0 && (
                  <div className="ml-7 mt-1 space-y-1">
                    {sleeveRows
                      .sort((left, right) => (right.percent ?? 0) - (left.percent ?? 0))
                      .map((sleeve, index) => (
                        <div
                          key={`${rowKey}-sleeve-${index}`}
                          className="flex items-center justify-between rounded-lg border border-[var(--panel-border)]/50 bg-[var(--panel)]/40 px-4 py-2"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-[color:var(--muted)]">{sleeve.slotLabel}</span>
                            <span
                              className={`text-[10px] font-bold uppercase ${
                                sleeve.direction === "LONG" ? "text-emerald-500" : sleeve.direction === "SHORT" ? "text-rose-500" : "text-[color:var(--muted)]"
                              }`}
                            >
                              {sleeve.direction}
                            </span>
                          </div>
                          <span className={`text-xs font-semibold ${(sleeve.percent ?? 0) >= 0 ? "text-lime-400" : "text-red-400"}`}>
                            {formatPct(sleeve.percent)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  // Direction-first ordering makes planned/current baskets much easier to compare
  // against the Data section and copied pair lists.
  const sorted = [...allTrades].sort((a, b) => {
    const directionDiff = directionSortValue(a.direction) - directionSortValue(b.direction);
    if (directionDiff !== 0) return directionDiff;
    return a.pair.localeCompare(b.pair);
  });
  const isAdrGridFamily = strategyFamily === "adr_grid";
  const signalOnlyRows = sorted.length > 0 && sorted.every((trade) => (
    !trade.children?.length &&
    (trade.percent ?? 0) === 0 &&
    trade.reason?.includes("No fills yet")
  ));
  const parentUnitLabel = isAdrGridFamily ? "grid" : signalOnlyRows ? "direction" : "trade";

  // ADR Grid parent rows are grid baskets; child rows are fills.
  const totalTradeCount = isAdrGridFamily
    ? sorted.length
    : sorted.reduce((s, t) => s + (t.children?.length ?? 1), 0);
  const totalReturn = sorted.reduce((s, t) => s + (t.percent ?? 0), 0);
  const tradeUnitReturns = isAdrGridFamily
    ? sorted.map((trade) => trade.percent ?? 0)
    : sorted.flatMap((trade) => (
        trade.children?.length
          ? trade.children.map((child) => child.percent ?? 0)
          : [trade.percent ?? 0]
      ));
  const wins = tradeUnitReturns.filter((value) => value > 0).length;
  const losses = tradeUnitReturns.filter((value) => value < 0).length;
  const slotGroups = new Map<string, typeof sorted>();
  for (const trade of sorted) {
    const label = trade.slotLabel || "Basket";
    if (!slotGroups.has(label)) slotGroups.set(label, []);
    slotGroups.get(label)!.push(trade);
  }
  const showSlotGroups = slotGroups.size > 1;
  const sectionLabel = `${gridProps.combined.description}${weekOpenUtc ? ` · ${formatTradingWeekLabelDate(weekOpenUtc)}` : ""}`;

  return (
    <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
            {sectionLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-4 text-xs">
          <div className="flex items-center gap-4">
            <span className="text-[color:var(--muted)]">
              {totalTradeCount} {totalTradeCount === 1 ? parentUnitLabel : `${parentUnitLabel}s`}
            </span>
            <span className="text-lime-400">{wins}W</span>
            <span className="text-red-400">{losses}L</span>
            <span className={totalReturn >= 0 ? "font-bold text-lime-400" : "font-bold text-red-400"}>
              {formatPct(totalReturn)}
            </span>
          </div>
        </div>
      </div>

      <div className="max-h-[65vh] space-y-1.5 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--panel-border)] px-3 py-3 text-xs text-[color:var(--muted)]">
            No trades for this period.
          </div>
        ) : (
          [...slotGroups.entries()].map(([slotLabel, slotTrades]) => {
            const slotReturn = slotTrades.reduce((sum, trade) => sum + (trade.percent ?? 0), 0);
            const slotUnitReturns = isAdrGridFamily
              ? slotTrades.map((trade) => trade.percent ?? 0)
              : slotTrades.flatMap((trade) => (
                  trade.children?.length
                    ? trade.children.map((child) => child.percent ?? 0)
                    : [trade.percent ?? 0]
                ));
            const slotWins = slotUnitReturns.filter((value) => value > 0).length;
            const slotLosses = slotUnitReturns.filter((value) => value < 0).length;
            const slotKey = `live-slot-${slotLabel}`;
            const slotExpanded = expandedPairs.has(slotKey) || !showSlotGroups;
            const slotTradeCount = isAdrGridFamily
              ? slotTrades.length
              : slotTrades.reduce((sum, trade) => sum + (trade.children?.length ?? 1), 0);

            return (
              <div key={slotKey} className="space-y-1">
                {showSlotGroups ? (
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-4 py-2.5 text-left hover:border-[var(--accent)]/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    onClick={() => toggleExpand(slotKey)}
                    aria-expanded={slotExpanded}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-4 text-[10px] text-[color:var(--muted)]">{slotExpanded ? "▾" : "▸"}</span>
                      <span className="min-w-[9rem] text-sm font-semibold text-[var(--foreground)]">{slotLabel}</span>
                      <span className="text-[10px] text-[color:var(--muted)]">
                        {slotTradeCount} {slotTradeCount === 1 ? parentUnitLabel : `${parentUnitLabel}s`}
                      </span>
                      <span className="text-[10px] text-lime-500">{slotWins}W</span>
                      <span className="text-[10px] text-rose-500">{slotLosses}L</span>
                    </div>
                    <span className={`text-sm font-semibold ${slotReturn > 0 ? "text-lime-400" : slotReturn < 0 ? "text-red-400" : "text-[color:var(--muted)]"}`}>
                      {formatPct(slotReturn)}
                    </span>
                  </button>
                ) : null}

                {slotExpanded ? (
                  <div className={showSlotGroups ? "ml-7 space-y-1 rounded-xl bg-[var(--accent)]/[0.035] p-2" : "space-y-1"}>
                    {slotTrades.map((trade, index) => {
                      const hasChildren = Boolean(trade.children?.length);
                      const sortedChildren = hasChildren ? sortLiveTradeChildren(trade.children!) : [];
                      const isAdrGridTrade = isAdrGridFamily;
                      const rowKey = `${slotKey}-${trade.pair}-${trade.direction}-${index}`;
                      const isExpanded = expandedPairs.has(rowKey);
                      const tradeCount = isAdrGridTrade ? sortedChildren.length : sortedChildren.length || 1;
                      const tradeUnitReturns = isAdrGridTrade
                        ? sortedChildren.map((child) => child.percent ?? 0)
                        : sortedChildren.length > 0
                          ? sortedChildren.map((child) => child.percent ?? 0)
                          : [trade.percent ?? 0];
                      const tradeWins = tradeUnitReturns.filter((value) => value > 0).length;
                      const tradeLosses = tradeUnitReturns.filter((value) => value < 0).length;
                      return (
                        <div key={rowKey} className="space-y-1">
                          <button
                            type="button"
                            className="flex w-full items-center justify-between rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-4 py-2.5 text-left transition hover:border-[var(--accent)]/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                            onClick={() => toggleExpand(rowKey)}
                            aria-expanded={isExpanded}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="w-4 text-[10px] text-[color:var(--muted)]">{isExpanded ? "▾" : "▸"}</span>
                              <span className="min-w-[7rem] truncate font-mono text-sm font-semibold text-[var(--foreground)]">
                                {trade.pair}
                              </span>
                              <LiveAssetClassBadge symbol={trade.pair} />
                              <span
                                className={`text-[10px] font-bold uppercase tracking-[0.08em] ${
                                  trade.direction === "LONG" ? "text-emerald-500" : trade.direction === "SHORT" ? "text-rose-500" : "text-[color:var(--muted)]"
                                }`}
                              >
                                {trade.direction}
                              </span>
                              {!showSlotGroups ? (
                                <span className="text-[10px] text-[color:var(--muted)]">{trade.slotLabel}</span>
                              ) : null}
                              <span className="text-[10px] text-[color:var(--muted)]">
                                {isAdrGridTrade
                                  ? `${tradeCount} ${tradeCount === 1 ? "fill" : "fills"}`
                                  : signalOnlyRows
                                    ? `${tradeCount} ${tradeCount === 1 ? "direction" : "directions"}`
                                    : "1 trade"}
                              </span>
                              <span className="text-[10px] font-semibold text-lime-500">{tradeWins}W</span>
                              <span className="text-[10px] font-semibold text-rose-500">{tradeLosses}L</span>
                            </div>
                            <span className={`ml-4 shrink-0 text-sm font-semibold ${(trade.percent ?? 0) > 0 ? "text-lime-400" : (trade.percent ?? 0) < 0 ? "text-red-400" : "text-[color:var(--muted)]"}`}>
                              {formatPct(trade.percent)}
                            </span>
                          </button>

                          {isExpanded ? (
                            <div className="ml-7 space-y-1 rounded-xl bg-[var(--accent)]/[0.035] p-2">
                              {!hasChildren && trade.tradeDetail && !isAdrGridTrade ? (
                                <div className="rounded-lg border border-[var(--panel-border)]/50 bg-[var(--panel)]/50 px-4 py-2">
                                  <TradeDetailRow detail={trade.tradeDetail} />
                                </div>
                              ) : null}
                              {!hasChildren && isAdrGridTrade ? (
                                <div className="rounded-lg border border-[var(--panel-border)]/50 bg-[var(--panel)]/50 px-4 py-2 text-xs text-[color:var(--muted)]">
                                  No fills yet.
                                </div>
                              ) : null}
                              {!hasChildren && trade.tradeDetail && isAdrGridTrade && tradeCount > 0 ? (
                                <div className="rounded-lg border border-[var(--panel-border)]/50 bg-[var(--panel)]/50 px-4 py-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex min-w-0 items-center gap-3">
                                      <span className="font-mono text-sm font-semibold text-[var(--foreground)]">
                                        Fill 1
                                      </span>
                                      <span
                                        className={`text-[10px] font-bold uppercase tracking-[0.08em] ${
                                          trade.direction === "LONG" ? "text-emerald-500" : trade.direction === "SHORT" ? "text-rose-500" : "text-[color:var(--muted)]"
                                        }`}
                                      >
                                        {trade.direction}
                                      </span>
                                      <span className="text-[10px] text-[color:var(--muted)]">
                                        {trade.tradeDetail.exitReason ?? ""}
                                      </span>
                                      {trade.tradeDetail.tradeNumber !== 1 ? (
                                        <span className="text-[10px] text-[color:var(--muted)]">
                                          source #{trade.tradeDetail.tradeNumber}
                                        </span>
                                      ) : null}
                                    </div>
                                    <span className={`text-xs font-semibold ${(trade.percent ?? 0) > 0 ? "text-lime-400" : (trade.percent ?? 0) < 0 ? "text-red-400" : "text-[color:var(--muted)]"}`}>
                                      {formatPct(trade.percent)}
                                    </span>
                                  </div>
                                  <TradeDetailRow detail={trade.tradeDetail} />
                                </div>
                              ) : null}
                              {hasChildren ? (
                                sortedChildren.map((child, childIndex) => (
                                  <div key={`${rowKey}-child-${childIndex}`} className="rounded-lg border border-[var(--panel-border)]/50 bg-[var(--panel)]/50 px-4 py-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex min-w-0 items-center gap-3">
                                        <span className="font-mono text-sm font-semibold text-[var(--foreground)]">
                                          Fill {childIndex + 1}
                                        </span>
                                        <span
                                          className={`text-[10px] font-bold uppercase tracking-[0.08em] ${
                                            child.direction === "LONG" ? "text-emerald-500" : child.direction === "SHORT" ? "text-rose-500" : "text-[color:var(--muted)]"
                                          }`}
                                        >
                                          {child.direction}
                                        </span>
                                        <span className="text-[10px] text-[color:var(--muted)]">
                                          {child.tradeDetail?.exitReason ?? ""}
                                        </span>
                                        {child.tradeDetail?.tradeNumber && child.tradeDetail.tradeNumber !== childIndex + 1 ? (
                                          <span className="text-[10px] text-[color:var(--muted)]">
                                            source #{child.tradeDetail.tradeNumber}
                                          </span>
                                        ) : null}
                                      </div>
                                      <span className={`text-xs font-semibold ${(child.percent ?? 0) > 0 ? "text-lime-400" : (child.percent ?? 0) < 0 ? "text-red-400" : "text-[color:var(--muted)]"}`}>
                                        {formatPct(child.percent)}
                                      </span>
                                    </div>
                                    {child.tradeDetail ? <TradeDetailRow detail={child.tradeDetail} /> : null}
                                  </div>
                                ))
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

const MemoEngineBasketView = memo(EngineBasketView);

type PerformanceViewSectionProps = {
  initialMode: "flagship" | "legacy";
  initialView: PerformanceView;
  initialSystem: PerformanceSystem;
  initialStyle?: WeeklyPerformanceFamily;
  universalGridPropsBySystem: Partial<Record<PerformanceSystem, GridProps>>;
  tieredGridPropsBySystem?: Partial<Record<PerformanceSystem, GridProps>>;
  universalSimulationBySystem?: Partial<Record<PerformanceSystem, PerformanceSimulationGroup>>;
  tieredSimulationBySystem?: Partial<Record<PerformanceSystem, PerformanceSimulationGroup>>;
  flagshipGridProps: GridProps | null;
  flagshipSimulation: PerformanceSimulationGroup | null;
  /** Pre-computed GridProps per week + "all". Client switches instantly. */
  engineWeekMap?: Record<string, EngineGridProps> | null;
  /** Pre-computed simulations per week + "all". */
  engineSimMap?: Record<string, EngineSimulationGroup> | null;
  /** Full weekly trade results for client-side scope derivation. */
  engineWeekResults?: Record<string, WeeklyHoldResult> | null;
  /** Current selection, used when dispatching scoped sidebar stats. */
  selection?: RuntimeStrategySelection;
  sidebarStats?: EngineSidebarStats | null;
  /** Week options for the strip */
  weekOptions?: string[];
  /** Current live week */
  currentWeek?: string;
  /** Initial selected week (from URL) */
  initialWeek?: string;
  initialAssetScope?: PerformanceAssetSelection;
  selectedTradeRowsBundle?: ClosedHistoryBundle | null;
  strategyDescription?: string | null;
  notesStorageKey?: string;
};

export default function PerformanceViewSection({
  initialMode,
  initialView,
  initialSystem,
  initialStyle = "tiered",
  universalGridPropsBySystem,
  tieredGridPropsBySystem,
  universalSimulationBySystem,
  tieredSimulationBySystem,
  flagshipGridProps,
  flagshipSimulation,
  engineWeekMap,
  engineSimMap,
  engineWeekResults,
  selection,
  sidebarStats,
  weekOptions,
  currentWeek,
  initialWeek,
  initialAssetScope,
  selectedTradeRowsBundle,
  strategyDescription,
  notesStorageKey,
}: PerformanceViewSectionProps) {
  const [performanceViewMode] = useViewMode("performance");
  const [view, setView] = useState<PerformanceView>(initialView);
  const [mountedViews, setMountedViews] = useState<Set<PerformanceView>>(() => new Set([initialView]));
  const [selectedWeek, setSelectedWeek] = useState(initialWeek ?? "all");
  const [assetScope, setAssetScope] = useState<PerformanceAssetSelection>(() =>
    normalizePerformanceAssetSelection(initialAssetScope ?? ALL_PERFORMANCE_ASSET_SELECTION),
  );
  const setNormalizedAssetScope = useCallback((next: PerformanceAssetSelection) => {
    setAssetScope(normalizePerformanceAssetSelection(next));
  }, []);

  // Legacy mode state
  const [mode, setMode] = useState<"flagship" | "legacy" | "matrix">(initialMode);
  const [system, setSystem] = useState<PerformanceSystem>(initialSystem);
  const [style, setStyle] = useState<WeeklyPerformanceFamily>(initialStyle);

  useEffect(() => {
    setView(initialView);
    setMountedViews(new Set([initialView]));
  }, [initialView]);
  const activateView = useCallback((nextView: PerformanceView) => {
    setMountedViews((previous) => {
      if (previous.has(nextView)) return previous;
      const next = new Set(previous);
      next.add(nextView);
      return next;
    });
    setView(nextView);
  }, []);
  useEffect(() => { setMode(initialMode); }, [initialMode]);
  useEffect(() => { setSystem(initialSystem); }, [initialSystem]);
  useEffect(() => { setStyle(initialStyle); }, [initialStyle]);
  useEffect(() => { setSelectedWeek(initialWeek ?? "all"); }, [initialWeek]);
  useEffect(() => {
    setAssetScope(normalizePerformanceAssetSelection(initialAssetScope ?? ALL_PERFORMANCE_ASSET_SELECTION));
  }, [initialAssetScope]);

  const selectedWeekKey = useMemo(() => (
    resolveCanonicalWeekSelection(selectedWeek, [
      engineWeekMap,
      engineSimMap,
      engineWeekResults,
      weekOptions,
    ])
  ), [engineSimMap, engineWeekMap, engineWeekResults, selectedWeek, weekOptions]);

  useEffect(() => {
    if (selectedWeek !== selectedWeekKey) {
      setSelectedWeek(selectedWeekKey);
    }
  }, [selectedWeek, selectedWeekKey]);

  const selectedWeekUsesClosedLedger = selectedWeekKey === "all" || selectedWeekKey !== currentWeek;
  const selectedLedgerStats = useMemo(() => (
    selectedWeekUsesClosedLedger
      ? buildSelectedLedgerStats({
          bundle: selectedTradeRowsBundle,
          selectedWeek: selectedWeekKey,
          scope: assetScope,
          viewMode: performanceViewMode,
        })
      : null
  ), [assetScope, performanceViewMode, selectedTradeRowsBundle, selectedWeekKey, selectedWeekUsesClosedLedger]);
  const selectedLedgerAllStats = useMemo(() => (
    selectedTradeRowsBundle
      ? buildSelectedLedgerStats({
          bundle: selectedTradeRowsBundle,
          selectedWeek: "all",
          scope: assetScope,
          viewMode: performanceViewMode,
        })
      : null
  ), [assetScope, performanceViewMode, selectedTradeRowsBundle]);
  const selectedLedgerAvailable = selectedLedgerStats?.status === "available" && Boolean(selectedLedgerStats.summary);
  const selectedLedgerAllAvailable = selectedLedgerAllStats?.status === "available" && Boolean(selectedLedgerAllStats.summary);
  const currentWeekTradeRowsBundle = useMemo(() => {
    if (!selection || !engineWeekResults || selectedWeekKey === "all" || selectedWeekKey !== currentWeek) {
      return null;
    }
    const result = engineWeekResults[selectedWeekKey];
    if (!result) return null;
    return buildClosedHistoryBundleFromStrategyResults({
      strategyVariant: `${selection.strategy}-${selection.f1}-${selection.f2}`,
      weekResults: { [selectedWeekKey]: result },
      generatedAt: result.weekOpenUtc,
      includeUnrealized: true,
    });
  }, [currentWeek, engineWeekResults, selectedWeekKey, selection]);
  const basketTradeRowsBundle = selectedWeekUsesClosedLedger
    ? selectedTradeRowsBundle
    : currentWeekTradeRowsBundle;

  useEffect(() => {
    if (!engineWeekMap || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (selectedWeekKey === "all") url.searchParams.delete("week");
    else url.searchParams.set("week", selectedWeekKey);
    const formattedScope = formatPerformanceAssetSelection(assetScope);
    if (formattedScope === "all") url.searchParams.delete("scope");
    else url.searchParams.set("scope", formattedScope);
    url.searchParams.set("view", view);
    window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}`);
  }, [assetScope, engineWeekMap, selectedWeekKey, view]);

  // Dispatch week change events so sidebar can react
  useEffect(() => {
    if (!engineWeekMap) return;
    if (selectedWeekUsesClosedLedger) {
      const summary = selectedLedgerStats?.summary;
      window.dispatchEvent(new CustomEvent("performance-week-stats", {
        detail: {
          weekKey: selectedWeekKey,
          returnPct: summary?.returnPct ?? 0,
          tradeCount: summary?.tradeCount ?? 0,
          winCount: summary?.winCount ?? 0,
          lossCount: summary?.lossCount ?? 0,
          winRate: summary?.winRate ?? 0,
          empty: !summary,
        },
      }));
      return;
    }
    const rawGridProps = selectedWeekKey === "all"
      ? engineWeekMap["all"]
      : engineWeekMap[selectedWeekKey];
    const filteredGridProps = filterGridPropsByPerformanceScope(rawGridProps ?? null, assetScope, {
      allTimeMode: selectedWeekKey === "all",
    });
    const gridProps = selectedWeekKey === "all"
      ? resolveAllTimeGridPropsForViewMode(
          filteredGridProps,
          engineWeekResults,
          assetScope,
          performanceViewMode,
          selection,
        )
      : filteredGridProps;
    if (!gridProps) return;
    const hasActivity = selectedWeekKey === "all" || hasGridActivity(gridProps);
    const weekResult = selectedWeekKey === "all" ? null : engineWeekResults?.[selectedWeekKey] ?? null;
    const scopedTrades = weekResult ? scopedStrategyTrades(weekResult, assetScope) : [];
    const totalReturn = weekResult
      ? scopedStrategyWeekReturn(weekResult, assetScope, performanceViewMode)
      : gridProps.combined.models.reduce((s, m) => s + m.percent, 0);
    const totalTrades = weekResult
      ? scopedTrades.length
      : gridProps.combined.models.reduce((s, m) => s + m.total, 0);
    const totalWins = weekResult
      ? scopedTrades.filter((trade) => resolveStrategyTradeReturn(trade, performanceViewMode) > 0).length
      : gridProps.combined.models.reduce((s, m) => {
          return s + m.returns.filter((r) => r.percent > 0).length;
        }, 0);
    const totalLosses = weekResult
      ? scopedTrades.filter((trade) => resolveStrategyTradeReturn(trade, performanceViewMode) < 0).length
      : totalTrades - totalWins;
    window.dispatchEvent(new CustomEvent("performance-week-stats", {
      detail: {
        weekKey: selectedWeekKey,
        returnPct: totalReturn,
        tradeCount: totalTrades,
        winCount: totalWins,
        lossCount: totalLosses,
        winRate: totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0,
        empty: !hasActivity,
      },
    }));
  }, [
    assetScope,
    selectedWeekKey,
    engineWeekMap,
    engineWeekResults,
    performanceViewMode,
    selectedLedgerStats,
    selectedWeekUsesClosedLedger,
    selection,
  ]);

  const sidebarSelectedSimulation = selectedWeekKey === "all"
    ? engineSimMap?.["all"] ?? null
    : engineSimMap?.[selectedWeekKey] ?? null;
  const sidebarAllTimeSimulation = engineSimMap?.["all"] ?? null;
  const resolvedSidebarSelectedSimulation = useMemo(() => (
    resolveSimulationGroupForViewMode(sidebarSelectedSimulation, performanceViewMode)
  ), [performanceViewMode, sidebarSelectedSimulation]);
  const resolvedSidebarAllTimeSimulation = useMemo(() => (
    resolveSimulationGroupForViewMode(sidebarAllTimeSimulation, performanceViewMode)
  ), [performanceViewMode, sidebarAllTimeSimulation]);
  const sidebarSelectedSimulationMetrics = useMemo(() => (
    deriveScopedSimulationMetrics(resolvedSidebarSelectedSimulation, assetScope)
  ), [assetScope, resolvedSidebarSelectedSimulation]);
  const sidebarAllTimeSimulationMetrics = useMemo(() => (
    deriveScopedSimulationMetrics(resolvedSidebarAllTimeSimulation, assetScope)
  ), [assetScope, resolvedSidebarAllTimeSimulation]);

  useEffect(() => {
    if (!selection) return;
    const stats = selectedWeekUsesClosedLedger
      ? buildSelectedLedgerSidebarStats(sidebarStats, selectedLedgerStats, selectedLedgerAllStats, performanceViewMode)
      : applySimulationMetricsToSidebarStats(
          computeScopedSidebarStats(
            sidebarStats,
            engineWeekResults,
            selectedWeekKey,
            assetScope,
            performanceViewMode,
            resolvedSidebarAllTimeSimulation,
          ),
          sidebarSelectedSimulationMetrics,
          sidebarAllTimeSimulationMetrics,
          selectedWeekKey,
        );
    const detail: StrategySidebarStatsDetail = {
      selection,
      stats,
    };
    window.dispatchEvent(new CustomEvent(STRATEGY_SIDEBAR_STATS_EVENT, { detail }));
  }, [
    assetScope,
    engineWeekResults,
    selectedWeekKey,
    selection,
    resolvedSidebarAllTimeSimulation,
    sidebarAllTimeSimulationMetrics,
    sidebarSelectedSimulationMetrics,
    sidebarStats,
    performanceViewMode,
    selectedLedgerAllStats,
    selectedLedgerStats,
    selectedWeekUsesClosedLedger,
  ]);

  // ─── Legacy path (fallback) ───────────────────────────────────
  useEffect(() => {
    if (engineWeekMap) return;
    const onSystemChange = (event: Event) => {
      const custom = event as CustomEvent<PerformanceSystem>;
      if (custom.detail === "v1" || custom.detail === "v2" || custom.detail === "v3") setSystem(custom.detail);
    };
    const onStyleChange = (event: Event) => {
      const custom = event as CustomEvent<PerformanceStrategyFamily>;
      if (custom.detail === "universal" || custom.detail === "tiered") setStyle(custom.detail);
    };
    const onModeChange = (event: Event) => {
      const custom = event as CustomEvent<string>;
      const nextMode = custom.detail === "legacy" ? "legacy" : custom.detail === "matrix" ? "matrix" : "flagship";
      setMode(nextMode);
      if (nextMode === "flagship") { setStyle("tiered"); setSystem("v3"); }
    };
    window.addEventListener("performance-system-change", onSystemChange);
    window.addEventListener("performance-style-change", onStyleChange);
    window.addEventListener("performance-mode-change", onModeChange);
    return () => {
      window.removeEventListener("performance-system-change", onSystemChange);
      window.removeEventListener("performance-style-change", onStyleChange);
      window.removeEventListener("performance-mode-change", onModeChange);
    };
  }, [engineWeekMap]);

  useEffect(() => {
    if (engineWeekMap) return;
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("mode", mode);
    url.searchParams.set("view", view);
    if (mode === "flagship") {
      url.searchParams.set("style", "tiered");
      url.searchParams.set("system", "v3");
    } else {
      url.searchParams.set("style", style);
      url.searchParams.set("system", system);
    }
    window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}`);
  }, [engineWeekMap, mode, view, system, style]);

  const activeEntry = useMemo(() => {
    return mode === "flagship"
      ? resolveActiveStrategyEntry({ family: "tiered", systemVersion: "v3" })
      : resolveActiveStrategyEntry({ family: style, systemVersion: system });
  }, [mode, style, system]);

  const baseGridProps = useMemo(() => {
    if (mode === "flagship") return flagshipGridProps;
    const preferred = style === "tiered"
      ? tieredGridPropsBySystem?.[system] ?? universalGridPropsBySystem[system]
      : universalGridPropsBySystem[system];
    return preferred ?? universalGridPropsBySystem.v3 ?? universalGridPropsBySystem.v1 ?? null;
  }, [mode, flagshipGridProps, style, system, tieredGridPropsBySystem, universalGridPropsBySystem]);

  const simulationGroup = useMemo(() => {
    if (mode === "flagship") return flagshipSimulation;
    return style === "tiered"
      ? tieredSimulationBySystem?.[system] ?? null
      : universalSimulationBySystem?.[system] ?? null;
  }, [mode, flagshipSimulation, style, system, tieredSimulationBySystem, universalSimulationBySystem]);

  const weeklyReturns = useMemo<WeekReturn[]>(() => {
    const ledgerWeeks = buildSelectedLedgerWeekReturnViews(selectedLedgerAllStats);
    if (ledgerWeeks.length > 0) return ledgerWeeks;
    if (selectedWeekUsesClosedLedger) return [];
    return buildCanonicalWeekReturnsFromPayload(
      engineSimMap,
      engineWeekResults,
      assetScope,
      performanceViewMode,
    );
  }, [assetScope, engineSimMap, engineWeekResults, performanceViewMode, selectedLedgerAllStats, selectedWeekUsesClosedLedger]);

  const maeTrades = useMemo<MaeTrade[]>(() => {
    if (selectedWeekUsesClosedLedger && selectedLedgerAllAvailable) {
      return buildSelectedLedgerMaeTradeViews(selectedLedgerAllStats);
    }
    if (selectedWeekUsesClosedLedger) return [];
    if (!engineWeekMap) return [];
    const allGrid = engineWeekMap["all"];
    if (!allGrid) return [];
    const trades: MaeTrade[] = [];
    for (const model of allGrid.combined.models) {
      for (const pd of model.pair_details) {
        if (pd.tradeDetail?.maePct != null && pd.percent != null) {
          if (!symbolMatchesPerformanceScope(pd.pair, assetScope)) continue;
          const returnPct = readProjectedTradeReturnPct(pd.tradeDetail, performanceViewMode) ?? pd.percent;
          trades.push({
            pair: pd.pair,
            returnPct,
            maePct: pd.tradeDetail.maePct,
          });
        }
        if (pd.children) {
          for (const child of pd.children) {
            if (child.tradeDetail?.maePct != null && child.percent != null) {
              if (!symbolMatchesPerformanceScope(child.pair, assetScope)) continue;
              const returnPct = readProjectedTradeReturnPct(child.tradeDetail, performanceViewMode) ?? child.percent;
              trades.push({
                pair: child.pair,
                returnPct,
                maePct: child.tradeDetail.maePct,
              });
            }
          }
        }
      }
    }
    return trades;
  }, [assetScope, engineWeekMap, performanceViewMode, selectedLedgerAllAvailable, selectedLedgerAllStats, selectedWeekUsesClosedLedger]);

  const assetContributions = useMemo(() => (
    selectedWeekUsesClosedLedger && selectedLedgerAvailable
      ? buildSelectedLedgerAssetContributionViews(selectedLedgerStats)
      : selectedWeekUsesClosedLedger
        ? []
      : buildResolvedAssetContributions(
          engineWeekResults,
          assetScope,
          performanceViewMode,
          selectedWeekKey,
        )
  ), [assetScope, engineWeekResults, performanceViewMode, selectedLedgerAvailable, selectedLedgerStats, selectedWeekKey, selectedWeekUsesClosedLedger]);

  const engineViewModel = useMemo(() => {
    if (!engineWeekMap || !weekOptions) return null;
    const rawGridProps = selectedWeekKey === "all"
      ? engineWeekMap["all"]
      : engineWeekMap[selectedWeekKey] ?? null;
    const selectedWeekResult = selectedWeekKey !== "all"
      ? engineWeekResults?.[selectedWeekKey] ?? null
      : null;
    const enrichedGridProps = enrichGridPropsWithWeekRawTradeMeta(rawGridProps, selectedWeekResult);
    const filteredGridProps = filterGridPropsByPerformanceScope(enrichedGridProps, assetScope, {
      allTimeMode: selectedWeekKey === "all",
    });
    const baseGridPropsForSelection = selectedWeekKey === "all"
      ? resolveAllTimeGridPropsForViewMode(
          filteredGridProps,
          engineWeekResults,
          assetScope,
          performanceViewMode,
          selection,
        )
      : projectGridPropsForViewMode(filteredGridProps, performanceViewMode);
    const strategy = selection ? getStrategy(selection.strategy) ?? null : null;
    const gridProps = selectedWeekUsesClosedLedger
      ? selectedLedgerAvailable
        ? applySelectedLedgerStatsToGridProps(
            baseGridPropsForSelection,
            selectedLedgerStats,
            selectedLedgerAllStats,
            strategy,
            performanceViewMode,
          )
        : null
      : baseGridPropsForSelection;
    const runtimeSimulation = selectedWeekKey === "all"
      ? engineSimMap?.["all"] ?? null
      : engineSimMap?.[selectedWeekKey] ?? null;
    const simulation = selectedWeekUsesClosedLedger
      ? selectedLedgerAvailable
        ? buildSelectedLedgerSimulationProjection(selectedLedgerStats, runtimeSimulation)
        : null
      : runtimeSimulation;
    const gridHasActivity = selectedWeekKey === "all" || hasGridActivity(gridProps);
    const simulationWeeklyReturns = selectedWeekKey === "all"
      ? weeklyReturns
      : selectedWeekUsesClosedLedger
        ? buildSelectedLedgerWeekReturnViews(selectedLedgerStats)
        : performanceViewMode.normalization === "raw"
        ? weeklyReturns.filter((week) => week.weekOpenUtc === selectedWeekKey)
        : undefined;
    const gridReturnFallback = gridProps?.combined.models.reduce((sum, model) => sum + model.percent, 0) ?? null;
    const gridTradeFallback = gridProps?.combined.models.reduce((sum, model) => sum + model.total, 0) ?? null;
    const basketAuthoritativeMetrics: ComponentProps<typeof BasketHierarchy>["authoritativeMetrics"] = selectedWeekUsesClosedLedger
      ? buildSelectedLedgerBasketMetrics(selectedLedgerStats)
      : {
          returnPct: sidebarSelectedSimulationMetrics?.returnPct ?? gridReturnFallback,
          maxDrawdownPct: sidebarSelectedSimulationMetrics?.maxDrawdownPct ?? null,
          tradeCount: sidebarSelectedSimulationMetrics?.trades ?? gridTradeFallback,
          hasActivity: gridHasActivity,
        };
    return {
      basketAuthoritativeMetrics,
      gridHasActivity,
      gridProps,
      simulation,
      simulationWeeklyReturns,
      weekOptions,
    };
  }, [
    assetScope,
    engineSimMap,
    engineWeekMap,
    engineWeekResults,
    performanceViewMode,
    selectedLedgerAllStats,
    selectedLedgerAvailable,
    selectedLedgerStats,
    selectedWeekKey,
    selectedWeekUsesClosedLedger,
    selection,
    sidebarSelectedSimulationMetrics,
    weeklyReturns,
    weekOptions,
  ]);

  useEffect(() => {
    if (!engineViewModel) return;
    const warmTimer = window.setTimeout(() => {
      setMountedViews((previous) => {
        const next = new Set(previous);
        next.add("summary");
        next.add("simulation");
        next.add("basket");
        return next.size === previous.size ? previous : next;
      });
    }, 250);
    return () => window.clearTimeout(warmTimer);
  }, [engineViewModel]);

  // ─── Engine-driven path (instant week switching) ──────────────
  if (engineViewModel) {
    const {
      basketAuthoritativeMetrics,
      gridHasActivity,
      gridProps,
      simulation,
      simulationWeeklyReturns,
      weekOptions: engineWeekOptions,
    } = engineViewModel;
    const gridView = view !== "notes" && view !== "simulation" && view !== "basket" ? view : "summary";
    return (
      <>
        <div className="space-y-4 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                View mode
              </p>
              <AnchorDisclosureLabel anchor="execution" />
            </div>
            <ViewModeControls surface="performance" size="sm" />
          </div>
          <ScrollableWeekStrip
            options={engineWeekOptions}
            selected={selectedWeekKey}
            currentWeek={currentWeek}
            label="Week"
            onChange={setSelectedWeek}
          />
          <PerformanceScopeControl
            value={assetScope}
            onChange={setNormalizedAssetScope}
          />
        </div>

        <PerformanceViewCards
          activeView={view}
          onViewChange={activateView}
          views={PERFORMANCE_VIEW_CARDS}
        />
        {view === "notes" ? (
          <PerformanceNotesPad
            selectedWeek={selectedWeekKey}
            strategyDescription={strategyDescription ?? null}
            notesStorageKey={notesStorageKey ?? "performance"}
          />
        ) : null}

        {(mountedViews.has("simulation") || view === "simulation") ? (
          <div className={view === "simulation" ? undefined : "hidden"}>
            {simulation ? (
              <MemoPerformanceSimulationSection
                group={simulation}
                weeklyReturns={simulationWeeklyReturns}
                maeTrades={selectedWeekKey === "all" ? maeTrades : undefined}
                assetContributions={assetContributions}
                assetScope={assetScope}
                onAssetScopeChange={setNormalizedAssetScope}
                showAssetControls={false}
              />
            ) : (
              <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-4 text-sm text-[color:var(--muted)] shadow-sm">
                No simulation data for the selected week.
              </div>
            )}
          </div>
        ) : null}

        {(mountedViews.has("basket") || view === "basket") ? (
          <div className={view === "basket" ? undefined : "hidden"}>
            {gridProps ? (
              <MemoEngineBasketView
                gridProps={gridProps}
                weeklyReturns={selectedWeekKey === "all" ? weeklyReturns : undefined}
                selection={selection}
                weekOpenUtc={selectedWeekKey === "all" ? null : selectedWeekKey}
                currentWeek={currentWeek}
                scope={assetScope}
                viewMode={performanceViewMode}
                authoritativeMetrics={basketAuthoritativeMetrics}
                selectedTradeRowsBundle={basketTradeRowsBundle}
                isAllTime={selectedWeekKey === "all"}
              />
            ) : (
              <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-4 text-sm text-[color:var(--muted)] shadow-sm">
                No data for the selected week.
              </div>
            )}
          </div>
        ) : null}

        {mountedViews.has("summary") || view !== "notes" && view !== "simulation" && view !== "basket" ? (
          <div className={view !== "notes" && view !== "simulation" && view !== "basket" ? undefined : "hidden"}>
            {!gridHasActivity ? (
              <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-4 text-sm text-[color:var(--muted)] shadow-sm">
                {selectedWeekKey === currentWeek
                  ? "Current week in progress — no realized fills yet. Switch to Simulation view to see the equity path."
                  : "No realized performance data for the selected week."}
              </div>
            ) : gridProps ? (
              /*
               * QUARANTINED 2026-05-30 - legacy showSectionTabs strategy special case.
               * Previous active prop:
               *   showSectionTabs={selection?.strategy !== "agree_3of4"}
               * The in-grid tabs are now disabled inside PerformanceGrid; the
               * top-level PerformanceScopeControl is the canonical scope control.
               * See docs/QUARANTINED_CODE_INVENTORY.md.
               */
              <PerformanceGrid
                {...gridProps}
                combined={gridProps.combined}
                perAsset={gridProps.perAsset}
                view={gridView}
                showSectionTabs={false}
              />
            ) : (
              <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-4 text-sm text-[color:var(--muted)] shadow-sm">
                No data for the selected week.
              </div>
            )}
          </div>
        ) : null}
      </>
    );
  }

  if (!baseGridProps) {
    return (
      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-4 text-sm text-[color:var(--muted)] shadow-sm">
        No canonical component breakdown is available for this strategy yet.
      </div>
    );
  }

  const modelSet = new Set(resolveDisplayModelsForEntry(activeEntry));
  const projectedBaseGridProps = projectGridPropsForViewMode(baseGridProps, performanceViewMode) ?? baseGridProps;
  const filteredCombined = {
    ...projectedBaseGridProps.combined,
    models: projectedBaseGridProps.combined.models.filter((entry) => modelSet.has(entry.model)),
  };
  const filteredPerAsset = projectedBaseGridProps.perAsset.map((section) => ({
    ...section,
    models: section.models.filter((entry) => modelSet.has(entry.model)),
  }));

  return (
    <>
      <PerformanceViewCards
        activeView={view}
        onViewChange={setView}
        views={PERFORMANCE_VIEW_CARDS}
      />
      {view === "notes" ? (
        <PerformanceNotesPad
          selectedWeek={selectedWeek}
          strategyDescription={strategyDescription ?? null}
          notesStorageKey={notesStorageKey ?? "performance"}
        />
      ) : view === "simulation" ? (
        <PerformanceSimulationSection group={simulationGroup} />
      ) : (
        <PerformanceGrid
          {...projectedBaseGridProps}
          combined={filteredCombined}
          perAsset={filteredPerAsset}
          view={view}
        />
      )}
    </>
  );
}
