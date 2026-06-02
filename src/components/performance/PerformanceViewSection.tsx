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

import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";
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
  scopedStrategyTrades,
  scopedStrategyWeekReturn,
} from "@/lib/performance/resolvedPerformanceMetrics";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";
import {
  STRATEGY_SIDEBAR_STATS_EVENT,
  type RuntimeStrategySelection,
  type StrategySidebarStatsDetail,
} from "@/lib/performance/strategySelection";
import { useViewMode } from "@/lib/viewMode/viewModeStore";
import type { ViewMode } from "@/lib/viewMode/viewModeTypes";
import type { TradeStrategyFamily } from "@/lib/trades/tradeTypes";

type GridProps = Omit<ComponentProps<typeof PerformanceGrid>, "view" | "combined" | "perAsset"> & {
  combined: ComponentProps<typeof PerformanceGrid>["combined"];
  perAsset: ComponentProps<typeof PerformanceGrid>["perAsset"];
};
type GridSection = EngineGridProps["combined"];
type GridModel = GridSection["models"][number];
type GridReturn = GridModel["returns"][number];

type WeeklyPerformanceFamily = Exclude<PerformanceStrategyFamily, "katarakti">;
type RawReturnTradeDetail = { rawReturnPct?: number };

function readRawReturnPct(tradeDetail: unknown): number | null {
  const rawReturnPct = (tradeDetail as RawReturnTradeDetail | null | undefined)?.rawReturnPct;
  return typeof rawReturnPct === "number" ? rawReturnPct : null;
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

function TradeDetailRow({ detail }: { detail: { entryPrice: number; exitPrice: number | null; tpPrice: number | null; adrPct: number | null; maePct: number | null; exitReason: string | null; entryTimeUtc: string | null; tradeNumber: number } }) {
  return (
    <div className="mt-1.5 grid grid-cols-4 gap-x-4 gap-y-1 text-[10px] text-[color:var(--muted)]">
      <span>Entry: <strong className="text-[var(--foreground)]">{detail.entryPrice.toFixed(5)}</strong></span>
      <span>Exit: <strong className="text-[var(--foreground)]">{detail.exitPrice?.toFixed(5) ?? "—"}</strong></span>
      <span>TP: <strong className="text-[var(--foreground)]">{detail.tpPrice?.toFixed(5) ?? "—"}</strong></span>
      <span>Result: <strong className={detail.exitReason === "tp" ? "text-lime-400" : "text-red-400"}>{detail.exitReason?.toUpperCase() ?? "—"}</strong></span>
      {detail.adrPct != null && <span>ADR: <strong className="text-[var(--foreground)]">{detail.adrPct.toFixed(2)}%</strong></span>}
      {detail.maePct != null && <span>MAE: <strong className="text-red-400">{detail.maePct.toFixed(2)}%</strong></span>}
    </div>
  );
}

function hasGridActivity(gridProps: EngineGridProps | null | undefined) {
  return Boolean(gridProps?.combined.models.some((model) => (
    model.total > 0 ||
    model.returns.length > 0 ||
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
  if (viewMode.normalization !== "raw") return detail.percent;
  if (detail.children && detail.children.length > 0) {
    return detail.children.reduce((sum, child) => (
      sum + (readRawReturnPct(child.tradeDetail) ?? child.percent ?? 0)
    ), 0);
  }
  return readRawReturnPct(detail.tradeDetail) ?? detail.percent;
}

function projectGridPropsForViewMode<T extends { combined: EngineGridProps["combined"]; perAsset: EngineGridProps["perAsset"] }>(
  gridProps: T | null,
  viewMode: ViewMode,
): T | null {
  if (!gridProps || viewMode.normalization !== "raw") return gridProps;
  const projectSection = (section: EngineGridProps["combined"]) => ({
    ...section,
    models: section.models.map((model) => {
      const pairDetails = model.pair_details.map((detail) => {
        const children = detail.children?.map((child) => ({
          ...child,
          percent: readRawReturnPct(child.tradeDetail) ?? child.percent,
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
          pair: `Week of ${week.weekOpenUtc.split("T")[0]}`,
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
  });

  const enrichSection = (section: EngineGridProps["combined"]) => ({
    ...section,
    models: section.models.map((model) => ({
      ...model,
      pair_details: model.pair_details.map((detail) => {
        if (readRawReturnPct(detail.tradeDetail) !== null || detail.children?.length) {
          return detail;
        }
        const candidates = bySymbolDirection.get(`${detail.pair}|${detail.direction}`) ?? [];
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
    winCount: selectedTrades.filter((trade) => resolveStrategyTradeReturn(trade, viewMode) > 0).length,
    lossCount: selectedTrades.filter((trade) => resolveStrategyTradeReturn(trade, viewMode) < 0).length,
    winRate:
      selectedTrades.length > 0
        ? (selectedTrades.filter((trade) => resolveStrategyTradeReturn(trade, viewMode) > 0).length / selectedTrades.length) * 100
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

function applySimulationMetricsToSidebarStats(
  stats: EngineSidebarStats | null,
  selectedMetrics: { returnPct: number | null; maxDrawdownPct: number | null; trades: number | null } | null,
  allTimeMetrics: { returnPct: number | null; maxDrawdownPct: number | null; trades: number | null } | null,
  selectedWeek: string,
): EngineSidebarStats | null {
  if (!stats) return stats;

  const maxDrawdownPct = selectedMetrics?.maxDrawdownPct ?? stats.maxDrawdownPct;
  const tradeCount = selectedMetrics?.trades ?? stats.tradeCount;
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
  return `${match[1]}T00:00:00.000Z`;
}

function formatWeekBasketLabel(weekOpenUtc: string) {
  const date = new Date(weekOpenUtc);
  return `Week of ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  })}`;
}

function BasketHierarchyContainmentNotice() {
  return (
    <section
      data-testid="basket-containment-notice"
      className="rounded-2xl border border-(--panel-border) bg-(--panel) px-5 py-4 shadow-sm"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--foreground)">
        Basket
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-(--muted)">
        Basket view is being rebuilt for v2.0.0. Pair-level data still available via
        Performance Summary and Simulation tabs.
      </p>
    </section>
  );
}

function EngineBasketView({
  gridProps,
  weeklyReturns,
  selection,
  weekOpenUtc,
  currentWeek,
  scope,
  viewMode,
  isAllTime = false,
}: {
  gridProps: EngineGridProps;
  weeklyReturns?: WeekReturn[];
  selection?: RuntimeStrategySelection;
  weekOpenUtc?: string | null;
  currentWeek?: string;
  scope: PerformanceAssetSelection;
  viewMode: ViewMode;
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

  const canUseHierarchy = Boolean(selection);
  const hierarchySelectedWeek = isAllTime ? "all" : weekOpenUtc ?? null;
  const shouldUseClosedHistoryHierarchy = canUseHierarchy
    && hierarchySelectedWeek !== null
    && (hierarchySelectedWeek === "all" || hierarchySelectedWeek !== currentWeek);

  if (shouldUseClosedHistoryHierarchy && hierarchySelectedWeek) {
    return (
      <BasketHierarchy
        strategyVariant={strategyVariant}
        strategyFamily={strategyFamily}
        selectedWeek={hierarchySelectedWeek}
        currentWeek={currentWeek}
        scope={scope}
        viewMode={viewMode}
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
    const percentDiff = (b.percent ?? 0) - (a.percent ?? 0);
    if (percentDiff !== 0) return percentDiff;
    return a.pair.localeCompare(b.pair);
  });

  // Count total individual trades (children count as separate trades)
  const totalTradeCount = sorted.reduce((s, t) => s + (t.children?.length ?? 1), 0);
  const totalReturn = sorted.reduce((s, t) => s + (t.percent ?? 0), 0);
  const tradeUnitReturns = sorted.flatMap((trade) => (
    trade.children?.length
      ? trade.children.map((child) => child.percent ?? 0)
      : [trade.percent ?? 0]
  ));
  const wins = tradeUnitReturns.filter((value) => value > 0).length;
  const losses = tradeUnitReturns.length - wins;
  const slotGroups = new Map<string, typeof sorted>();
  for (const trade of sorted) {
    const label = trade.slotLabel || "Basket";
    if (!slotGroups.has(label)) slotGroups.set(label, []);
    slotGroups.get(label)!.push(trade);
  }
  const showSlotGroups = slotGroups.size > 1;
  const sectionLabel = `${gridProps.combined.description}${weekOpenUtc ? ` · ${new Date(weekOpenUtc).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  })}` : ""}`;

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
            <span className="text-[color:var(--muted)]">{totalTradeCount} trades</span>
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
            const slotUnitReturns = slotTrades.flatMap((trade) => (
              trade.children?.length
                ? trade.children.map((child) => child.percent ?? 0)
                : [trade.percent ?? 0]
            ));
            const slotWins = slotUnitReturns.filter((value) => value > 0).length;
            const slotKey = `live-slot-${slotLabel}`;
            const slotExpanded = expandedPairs.has(slotKey) || !showSlotGroups;
            const slotTradeCount = slotTrades.reduce((sum, trade) => sum + (trade.children?.length ?? 1), 0);

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
                        {slotTradeCount} {slotTradeCount === 1 ? "trade" : "trades"}
                      </span>
                      <span className="text-[10px] text-lime-500">{slotWins}W</span>
                      <span className="text-[10px] text-rose-500">{slotTradeCount - slotWins}L</span>
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
                      const isAdrGridTrade = strategyFamily === "adr_grid";
                      const rowKey = `${slotKey}-${trade.pair}-${trade.direction}-${index}`;
                      const isExpanded = expandedPairs.has(rowKey);
                      const tradeCount = sortedChildren.length || 1;
                      const tradeUnitReturns = sortedChildren.length > 0
                        ? sortedChildren.map((child) => child.percent ?? 0)
                        : [trade.percent ?? 0];
                      const tradeWins = tradeUnitReturns.filter((value) => value > 0).length;
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
                                  : "1 trade"}
                              </span>
                              <span className="text-[10px] font-semibold text-lime-500">{tradeWins}W</span>
                              <span className="text-[10px] font-semibold text-rose-500">{tradeUnitReturns.length - tradeWins}L</span>
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
                              {!hasChildren && trade.tradeDetail && isAdrGridTrade ? (
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
  strategyDescription,
  notesStorageKey,
}: PerformanceViewSectionProps) {
  const [performanceViewMode] = useViewMode("performance");
  const [view, setView] = useState<PerformanceView>(initialView);
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

  useEffect(() => { setView(initialView); }, [initialView]);
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
    window.dispatchEvent(new CustomEvent("performance-week-stats", {
      detail: {
        weekKey: selectedWeekKey,
        returnPct: totalReturn,
        tradeCount: totalTrades,
        winCount: totalWins,
        lossCount: totalTrades - totalWins,
        winRate: totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0,
        empty: !hasActivity,
      },
    }));
  }, [assetScope, selectedWeekKey, engineWeekMap, engineWeekResults, performanceViewMode, selection]);

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

  useEffect(() => {
    if (!selection) return;
    const simulationMetrics = deriveScopedSimulationMetrics(resolvedSidebarSelectedSimulation, assetScope);
    const allTimeSimulationMetrics = deriveScopedSimulationMetrics(resolvedSidebarAllTimeSimulation, assetScope);
    const stats = applySimulationMetricsToSidebarStats(
      computeScopedSidebarStats(
        sidebarStats,
        engineWeekResults,
        selectedWeekKey,
        assetScope,
        performanceViewMode,
        resolvedSidebarAllTimeSimulation,
      ),
      simulationMetrics,
      allTimeSimulationMetrics,
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
    resolvedSidebarSelectedSimulation,
    sidebarStats,
    performanceViewMode,
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
    if (!engineSimMap) return [];
    if (performanceViewMode.normalization === "raw") {
      return buildResolvedWeekReturns(engineWeekResults, assetScope, performanceViewMode);
    }
    return Object.entries(engineSimMap)
      .filter(([key]) => key !== "all")
      .map(([key, entry]) => {
        const fallbackReturn = engineWeekResults?.[key]
          ? scopedStrategyWeekReturn(engineWeekResults[key], assetScope, performanceViewMode)
          : entry.metrics.returnPct;
        const metrics = performanceViewMode.normalization === "raw"
          ? null
          : deriveScopedSimulationMetrics(entry, assetScope);
        const fallbackTrades = engineWeekResults?.[key]
          ? scopedStrategyTrades(engineWeekResults[key], assetScope).length
          : entry.metrics.trades;
        return {
          weekOpenUtc: key,
          returnPct: metrics?.returnPct ?? fallbackReturn ?? 0,
          maxDrawdownPct: metrics?.maxDrawdownPct ?? entry.metrics.maxDrawdownPct ?? null,
          trades: metrics?.trades ?? fallbackTrades ?? null,
        };
      })
      .filter((week) => Number.isFinite(week.returnPct))
      .sort((a, b) => a.weekOpenUtc.localeCompare(b.weekOpenUtc));
  }, [assetScope, engineSimMap, engineWeekResults, performanceViewMode]);

  const maeTrades = useMemo<MaeTrade[]>(() => {
    if (!engineWeekMap) return [];
    const allGrid = engineWeekMap["all"];
    if (!allGrid) return [];
    const trades: MaeTrade[] = [];
    for (const model of allGrid.combined.models) {
      for (const pd of model.pair_details) {
        if (pd.tradeDetail?.maePct != null && pd.percent != null) {
          if (!symbolMatchesPerformanceScope(pd.pair, assetScope)) continue;
          trades.push({
            pair: pd.pair,
            returnPct: performanceViewMode.normalization === "raw"
              ? readRawReturnPct(pd.tradeDetail) ?? pd.percent
              : pd.percent,
            maePct: pd.tradeDetail.maePct,
          });
        }
        if (pd.children) {
          for (const child of pd.children) {
            if (child.tradeDetail?.maePct != null && child.percent != null) {
              if (!symbolMatchesPerformanceScope(child.pair, assetScope)) continue;
              trades.push({
                pair: child.pair,
                returnPct: performanceViewMode.normalization === "raw"
                  ? readRawReturnPct(child.tradeDetail) ?? child.percent
                  : child.percent,
                maePct: child.tradeDetail.maePct,
              });
            }
          }
        }
      }
    }
    return trades;
  }, [assetScope, engineWeekMap, performanceViewMode]);

  const assetContributions = useMemo(() => (
    buildResolvedAssetContributions(
      engineWeekResults,
      assetScope,
      performanceViewMode,
      selectedWeekKey,
    )
  ), [assetScope, engineWeekResults, performanceViewMode, selectedWeekKey]);

  // ─── Engine-driven path (instant week switching) ──────────────
  if (engineWeekMap && weekOptions) {
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
    const gridProps = selectedWeekKey === "all"
      ? resolveAllTimeGridPropsForViewMode(
          filteredGridProps,
          engineWeekResults,
          assetScope,
          performanceViewMode,
          selection,
        )
      : projectGridPropsForViewMode(filteredGridProps, performanceViewMode);
    const simulation = selectedWeekKey === "all"
      ? engineSimMap?.["all"] ?? null
      : engineSimMap?.[selectedWeekKey] ?? null;
    const gridHasActivity = selectedWeekKey === "all" || hasGridActivity(gridProps);
    const simulationWeeklyReturns = selectedWeekKey === "all"
      ? weeklyReturns
      : performanceViewMode.normalization === "raw"
        ? weeklyReturns.filter((week) => week.weekOpenUtc === selectedWeekKey)
        : undefined;

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
            options={weekOptions}
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
          onViewChange={setView}
          views={PERFORMANCE_VIEW_CARDS}
        />
        {view === "notes" ? (
          <PerformanceNotesPad
            selectedWeek={selectedWeekKey}
            strategyDescription={strategyDescription ?? null}
            notesStorageKey={notesStorageKey ?? "performance"}
          />
        ) : view === "simulation" ? (
          simulation ? (
            <PerformanceSimulationSection
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
          )
        ) : !gridHasActivity ? (
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-4 text-sm text-[color:var(--muted)] shadow-sm">
            {selectedWeekKey === currentWeek
              ? "Current week in progress — no realized fills yet. Switch to Simulation view to see the equity path."
              : "No realized performance data for the selected week."}
          </div>
        ) : view === "basket" && gridProps ? (
          <EngineBasketView
            gridProps={gridProps}
            weeklyReturns={selectedWeekKey === "all" ? weeklyReturns : undefined}
            selection={selection}
            weekOpenUtc={selectedWeekKey === "all" ? null : selectedWeekKey}
            currentWeek={currentWeek}
            scope={assetScope}
            viewMode={performanceViewMode}
            isAllTime={selectedWeekKey === "all"}
          />
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
            view={view}
            showSectionTabs={false}
          />
        ) : (
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-4 text-sm text-[color:var(--muted)] shadow-sm">
            No data for the selected week.
          </div>
        )}
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
