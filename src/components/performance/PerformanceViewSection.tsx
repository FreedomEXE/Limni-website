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
import PerformanceGrid from "@/components/performance/PerformanceGrid";
import PerformanceViewCards, {
  PERFORMANCE_VIEW_CARDS,
} from "@/components/performance/PerformanceViewCards";
import PerformanceSimulationSection, {
  type PerformanceSimulationGroup,
} from "@/components/performance/PerformanceSimulationSection";
import type { WeekReturn } from "@/components/performance/ReturnsCalendar";
import type { MaeTrade } from "@/components/performance/MaeScatterPlot";
import PerformanceNotesPad from "@/components/performance/PerformanceNotesPad";
import ScrollableWeekStrip from "@/components/shared/ScrollableWeekStrip";
import {
  resolveActiveStrategyEntry,
  resolveDisplayModelsForEntry,
  type PerformanceStrategyFamily,
} from "@/lib/performance/strategyRegistry";
import type { WeeklyHoldResult } from "@/lib/performance/weeklyHoldEngine";
import {
  ALL_PERFORMANCE_ASSET_SELECTION,
  formatPerformanceAssetSelection,
  isAllPerformanceAssetSelection,
  normalizePerformanceAssetSelection,
  assetMatchesPerformanceScope,
  symbolMatchesPerformanceScope,
  type PerformanceAssetSelection,
} from "@/lib/performance/performanceAssetScope";
import {
  STRATEGY_SIDEBAR_STATS_EVENT,
  type RuntimeStrategySelection,
  type StrategySidebarStatsDetail,
} from "@/lib/performance/strategySelection";

type GridProps = Omit<ComponentProps<typeof PerformanceGrid>, "view" | "combined" | "perAsset"> & {
  combined: ComponentProps<typeof PerformanceGrid>["combined"];
  perAsset: ComponentProps<typeof PerformanceGrid>["perAsset"];
};

type WeeklyPerformanceFamily = Exclude<PerformanceStrategyFamily, "katarakti">;

function formatPct(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function directionSortValue(direction: "LONG" | "SHORT" | "NEUTRAL"): number {
  if (direction === "SHORT") return 0;
  if (direction === "LONG") return 1;
  return 2;
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

function scopedReturnFromWeekResult(result: WeeklyHoldResult, scope: PerformanceAssetSelection) {
  if (isAllPerformanceAssetSelection(scope)) return result.totalReturnPct;
  return result.trades
    .filter((trade) => assetMatchesPerformanceScope(trade.assetClass, scope))
    .reduce((sum, trade) => sum + trade.returnPct, 0);
}

function scopedTradesFromWeekResult(result: WeeklyHoldResult, scope: PerformanceAssetSelection) {
  return isAllPerformanceAssetSelection(scope)
    ? result.trades
    : result.trades.filter((trade) => assetMatchesPerformanceScope(trade.assetClass, scope));
}

function computeMaxDrawdownFromReturns(returns: number[]) {
  let peak = 0;
  let equity = 0;
  let maxDrawdown = 0;
  for (const value of returns) {
    equity += value;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }
  return maxDrawdown;
}

function computeScopedSidebarStats(
  baseStats: EngineSidebarStats | null | undefined,
  weekResults: Record<string, WeeklyHoldResult> | null | undefined,
  selectedWeek: string,
  scope: PerformanceAssetSelection,
): EngineSidebarStats | null {
  if (isAllPerformanceAssetSelection(scope) || !baseStats || !weekResults) return baseStats ?? null;

  const sortedWeeks = Object.values(weekResults)
    .filter((week) => week.isRealized)
    .sort((left, right) => left.weekOpenUtc.localeCompare(right.weekOpenUtc));
  const weeklyReturns = sortedWeeks.map((week) => scopedReturnFromWeekResult(week, scope));
  const selectedResult =
    selectedWeek !== "all"
      ? weekResults[selectedWeek] ?? sortedWeeks.at(-1) ?? null
      : sortedWeeks.at(-1) ?? null;
  const selectedTrades = selectedResult ? scopedTradesFromWeekResult(selectedResult, scope) : [];
  const totalTrades = sortedWeeks.reduce(
    (sum, week) => sum + scopedTradesFromWeekResult(week, scope).length,
    0,
  );
  const totalReturnPct = weeklyReturns.reduce((sum, value) => sum + value, 0);
  const maxDrawdownPct = computeMaxDrawdownFromReturns(weeklyReturns);
  const weeklyWins = weeklyReturns.filter((value) => value > 0).length;
  const wins = weeklyReturns.filter((value) => value > 0);
  const losses = weeklyReturns.filter((value) => value < 0);
  const avgWin = wins.length > 0 ? wins.reduce((sum, value) => sum + value, 0) / wins.length : 0;
  const avgLoss = losses.length > 0
    ? Math.abs(losses.reduce((sum, value) => sum + value, 0) / losses.length)
    : 0;
  const winRate = weeklyReturns.length > 0 ? wins.length / weeklyReturns.length : 0;

  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let currentWins = 0;
  let currentLosses = 0;
  for (const value of weeklyReturns) {
    if (value > 0) {
      currentWins += 1;
      currentLosses = 0;
    } else if (value < 0) {
      currentLosses += 1;
      currentWins = 0;
    } else {
      currentWins = 0;
      currentLosses = 0;
    }
    maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins);
    maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
  }

  const avgWeeklyReturn = weeklyReturns.length > 0 ? totalReturnPct / weeklyReturns.length : 0;
  const grossProfit = weeklyReturns.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(weeklyReturns.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));

  return {
    ...baseStats,
    weekOpenUtc: selectedResult?.weekOpenUtc ?? baseStats.weekOpenUtc,
    weekReturnPct: selectedResult ? scopedReturnFromWeekResult(selectedResult, scope) : 0,
    tradeCount: selectedTrades.length,
    winCount: selectedTrades.filter((trade) => trade.returnPct > 0).length,
    lossCount: selectedTrades.filter((trade) => trade.returnPct < 0).length,
    winRate:
      selectedTrades.length > 0
        ? (selectedTrades.filter((trade) => trade.returnPct > 0).length / selectedTrades.length) * 100
        : 0,
    maxDrawdownPct,
    trades: selectedTrades.map((trade) => ({
      symbol: trade.symbol,
      direction: trade.direction,
      returnPct: trade.returnPct,
      assetClass: trade.assetClass,
    })),
    allTime: {
      totalReturnPct,
      totalTrades,
      weeklyWinRate: weeklyReturns.length > 0 ? (weeklyWins / weeklyReturns.length) * 100 : 0,
      maxDrawdownPct,
      weeks: weeklyReturns.length,
      avgWeeklyReturn,
      sharpe: baseStats.allTime?.sharpe ?? 0,
      sortino: baseStats.allTime?.sortino ?? 0,
      calmar:
        maxDrawdownPct > 0 && weeklyReturns.length > 0
          ? ((totalReturnPct / weeklyReturns.length) * 52) / maxDrawdownPct
          : 0,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
      expectancy: (winRate * avgWin) - ((1 - winRate) * avgLoss),
      avgWin,
      avgLoss,
      maxConsecutiveWins,
      maxConsecutiveLosses,
    },
  };
}

function recomputeReturns(values: Array<{ pair: string; percent: number }>) {
  const percents = values.map((value) => value.percent);
  const avg = percents.length > 0 ? percents.reduce((sum, value) => sum + value, 0) / percents.length : 0;
  const sorted = [...percents].sort((left, right) => left - right);
  const median = sorted.length === 0
    ? 0
    : sorted.length % 2 === 1
      ? sorted[Math.floor(sorted.length / 2)] ?? 0
      : ((sorted[(sorted.length / 2) - 1] ?? 0) + (sorted[sorted.length / 2] ?? 0)) / 2;
  const volatility = percents.length > 1
    ? Math.sqrt(percents.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (percents.length - 1))
    : 0;
  const best = values.reduce<typeof values[number] | null>(
    (current, value) => (!current || value.percent > current.percent ? value : current),
    null,
  );
  const worst = values.reduce<typeof values[number] | null>(
    (current, value) => (!current || value.percent < current.percent ? value : current),
    null,
  );
  return {
    avg_return: avg,
    median_return: median,
    win_rate: percents.length > 0
      ? (percents.filter((value) => value > 0).length / percents.length) * 100
      : 0,
    volatility,
    best_pair: best,
    worst_pair: worst,
  };
}

function combineAllTimeStats(rows: EngineGridProps["allTime"]["combined"]) {
  const byModel = new Map<EngineGridProps["allTime"]["combined"][number]["model"], EngineGridProps["allTime"]["combined"][number]>();
  for (const row of rows) {
    const current = byModel.get(row.model);
    if (!current) {
      byModel.set(row.model, { ...row });
      continue;
    }
    const weeks = Math.max(current.weeks, row.weeks);
    byModel.set(row.model, {
      ...current,
      totalPercent: current.totalPercent + row.totalPercent,
      weeks,
      winRate:
        current.weeks + row.weeks > 0
          ? ((current.winRate * current.weeks) + (row.winRate * row.weeks)) / (current.weeks + row.weeks)
          : 0,
      avgWeekly: weeks > 0 ? (current.totalPercent + row.totalPercent) / weeks : 0,
    });
  }
  return Array.from(byModel.values());
}

function filterGridPropsByScope(
  gridProps: EngineGridProps | null,
  scope: PerformanceAssetSelection,
): EngineGridProps | null {
  if (!gridProps || isAllPerformanceAssetSelection(scope)) return gridProps;

  const filterModel = (model: EngineGridProps["combined"]["models"][number]) => {
    const pairDetails = model.pair_details.filter((detail) =>
      symbolMatchesPerformanceScope(detail.pair, scope),
    );
    const returns = pairDetails
      .filter((detail): detail is typeof detail & { percent: number } => typeof detail.percent === "number")
      .map((detail) => ({ pair: detail.pair, percent: detail.percent }));
    const total = pairDetails.reduce((sum, detail) => sum + (detail.children?.length ?? 1), 0);
    return {
      ...model,
      percent: returns.reduce((sum, value) => sum + value.percent, 0),
      priced: returns.length,
      total,
      returns,
      pair_details: pairDetails,
      stats: recomputeReturns(returns),
    };
  };

  return {
    ...gridProps,
    allTime: {
      ...gridProps.allTime,
      combined: combineAllTimeStats(scope.flatMap((assetClass) => gridProps.allTime.perAsset[assetClass] ?? [])),
      perAsset: {
        ...Object.fromEntries(scope.map((assetClass) => [assetClass, gridProps.allTime.perAsset[assetClass] ?? []])),
      },
    },
    combined: {
      ...gridProps.combined,
      models: gridProps.combined.models.map(filterModel),
    },
    perAsset: gridProps.perAsset
      .filter((section) => assetMatchesPerformanceScope(section.id, scope))
      .map((section) => ({
        ...section,
        models: section.models.map(filterModel),
      })),
  };
}

function EngineBasketView({ gridProps }: { gridProps: EngineGridProps }) {
  const [expandedPairs, setExpandedPairs] = useState<Set<string>>(new Set());

  // Flatten all trades from all models into a single list
  const allTrades = gridProps.combined.models.flatMap((model) =>
    model.pair_details.map((detail) => ({
      ...detail,
      slotLabel: gridProps.labels[model.model] ?? model.model,
    })),
  );

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
  const wins = sorted.filter((t) => (t.percent ?? 0) > 0).length;

  const toggleExpand = (key: string) => {
    setExpandedPairs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
            {gridProps.combined.description}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-[color:var(--muted)]">{totalTradeCount} trades</span>
          <span className="text-lime-400">{wins}W</span>
          <span className="text-red-400">{sorted.length - wins}L</span>
          <span className={totalReturn >= 0 ? "font-bold text-lime-400" : "font-bold text-red-400"}>
            {formatPct(totalReturn)}
          </span>
        </div>
      </div>

      <div className="max-h-[65vh] space-y-1.5 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--panel-border)] px-3 py-3 text-xs text-[color:var(--muted)]">
            No trades for this period.
          </div>
        ) : (
          sorted.map((trade, i) => {
            const isWin = (trade.percent ?? 0) > 0;
            const hasChildren = trade.children && trade.children.length > 0;
            const rowKey = `${trade.pair}-${trade.direction}-${i}`;
            const isExpanded = expandedPairs.has(rowKey);

            return (
              <div key={rowKey}>
                {/* Parent row */}
                <div
                  className={`flex items-center justify-between rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-4 py-2.5 ${hasChildren ? "cursor-pointer hover:border-[var(--accent)]/30" : ""}`}
                  onClick={hasChildren ? () => toggleExpand(rowKey) : undefined}
                >
                  <div className="flex items-center gap-3">
                    {hasChildren && (
                      <span className="w-4 text-[10px] text-[color:var(--muted)]">{isExpanded ? "▾" : "▸"}</span>
                    )}
                    <span className="w-24 text-sm font-semibold text-[var(--foreground)]">
                      {trade.pair}
                    </span>
                    <span
                      className={`text-[11px] font-bold uppercase ${
                        trade.direction === "LONG" ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      {trade.direction}
                    </span>
                    <span className="text-[10px] text-[color:var(--muted)]">
                      {trade.slotLabel}
                    </span>
                    {hasChildren && (
                      <span className="text-[10px] text-[color:var(--muted)]">
                        {trade.children!.length} trades
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      isWin ? "text-lime-400" : (trade.percent ?? 0) < 0 ? "text-red-400" : "text-[color:var(--muted)]"
                    }`}
                  >
                    {formatPct(trade.percent)}
                  </span>
                </div>

                {/* Trade detail for single trades */}
                {!hasChildren && trade.tradeDetail && isExpanded && (
                  <div className="ml-7 mt-1 rounded-lg border border-[var(--panel-border)]/50 bg-[var(--panel)]/40 px-4 py-2">
                    <TradeDetailRow detail={trade.tradeDetail} />
                  </div>
                )}

                {/* Single trade — make it expandable too for detail */}
                {!hasChildren && trade.tradeDetail && !isExpanded && (
                  <div
                    className="ml-7 mt-0.5 cursor-pointer text-[10px] text-[color:var(--muted)] hover:text-[var(--accent)]"
                    onClick={() => toggleExpand(rowKey)}
                  >
                    show detail
                  </div>
                )}

                {/* Children trades (expanded) */}
                {hasChildren && isExpanded && (
                  <div className="ml-7 mt-1 space-y-1">
                    {trade.children!.map((child, ci) => {
                      const childWin = (child.percent ?? 0) > 0;
                      return (
                        <div key={ci} className="rounded-lg border border-[var(--panel-border)]/50 bg-[var(--panel)]/40 px-4 py-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] text-[color:var(--muted)]">#{child.tradeDetail?.tradeNumber ?? ci + 1}</span>
                              <span
                                className={`text-[10px] font-bold uppercase ${
                                  child.direction === "LONG" ? "text-emerald-500" : "text-rose-500"
                                }`}
                              >
                                {child.direction}
                              </span>
                              <span className="text-[10px] text-[color:var(--muted)]">
                                {child.tradeDetail?.exitReason?.toUpperCase() ?? ""}
                              </span>
                            </div>
                            <span className={`text-xs font-semibold ${childWin ? "text-lime-400" : (child.percent ?? 0) < 0 ? "text-red-400" : "text-[color:var(--muted)]"}`}>
                              {formatPct(child.percent)}
                            </span>
                          </div>
                          {child.tradeDetail && <TradeDetailRow detail={child.tradeDetail} />}
                        </div>
                      );
                    })}
                  </div>
                )}
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

  useEffect(() => {
    if (!engineWeekMap || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (selectedWeek === "all") url.searchParams.delete("week");
    else url.searchParams.set("week", selectedWeek);
    const formattedScope = formatPerformanceAssetSelection(assetScope);
    if (formattedScope === "all") url.searchParams.delete("scope");
    else url.searchParams.set("scope", formattedScope);
    url.searchParams.set("view", view);
    window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}`);
  }, [assetScope, engineWeekMap, selectedWeek, view]);

  // Dispatch week change events so sidebar can react
  useEffect(() => {
    if (!engineWeekMap) return;
    const rawGridProps = selectedWeek === "all"
      ? engineWeekMap["all"]
      : engineWeekMap[selectedWeek];
    const gridProps = filterGridPropsByScope(rawGridProps ?? null, assetScope);
    if (!gridProps) return;
    const hasActivity = selectedWeek === "all" || hasGridActivity(gridProps);
    const weekResult = selectedWeek === "all" ? null : engineWeekResults?.[selectedWeek] ?? null;
    const scopedTrades = weekResult ? scopedTradesFromWeekResult(weekResult, assetScope) : [];
    const totalReturn = weekResult
      ? scopedReturnFromWeekResult(weekResult, assetScope)
      : gridProps.combined.models.reduce((s, m) => s + m.percent, 0);
    const totalTrades = weekResult
      ? scopedTrades.length
      : gridProps.combined.models.reduce((s, m) => s + m.total, 0);
    const totalWins = weekResult
      ? scopedTrades.filter((trade) => trade.returnPct > 0).length
      : gridProps.combined.models.reduce((s, m) => {
          return s + m.returns.filter((r) => r.percent > 0).length;
        }, 0);
    window.dispatchEvent(new CustomEvent("performance-week-stats", {
      detail: {
        weekKey: selectedWeek,
        returnPct: totalReturn,
        tradeCount: totalTrades,
        winCount: totalWins,
        lossCount: totalTrades - totalWins,
        winRate: totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0,
        empty: !hasActivity,
      },
    }));
  }, [assetScope, selectedWeek, engineWeekMap, engineWeekResults]);

  useEffect(() => {
    if (!selection) return;
    const stats = computeScopedSidebarStats(sidebarStats, engineWeekResults, selectedWeek, assetScope);
    const detail: StrategySidebarStatsDetail = {
      selection,
      stats,
    };
    window.dispatchEvent(new CustomEvent(STRATEGY_SIDEBAR_STATS_EVENT, { detail }));
  }, [assetScope, engineWeekResults, selectedWeek, selection, sidebarStats]);

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
    return Object.entries(engineSimMap)
      .filter(([key, entry]) => key !== "all" && entry.metrics.returnPct !== null)
      .map(([key, entry]) => ({
        weekOpenUtc: key,
        returnPct: engineWeekResults?.[key]
          ? scopedReturnFromWeekResult(engineWeekResults[key], assetScope)
          : entry.metrics.returnPct!,
      }))
      .sort((a, b) => a.weekOpenUtc.localeCompare(b.weekOpenUtc));
  }, [assetScope, engineSimMap, engineWeekResults]);

  const maeTrades = useMemo<MaeTrade[]>(() => {
    if (!engineWeekMap) return [];
    const allGrid = engineWeekMap["all"];
    if (!allGrid) return [];
    const trades: MaeTrade[] = [];
    for (const model of allGrid.combined.models) {
      for (const pd of model.pair_details) {
        if (pd.tradeDetail?.maePct != null && pd.percent != null) {
          if (!symbolMatchesPerformanceScope(pd.pair, assetScope)) continue;
          trades.push({ pair: pd.pair, returnPct: pd.percent, maePct: pd.tradeDetail.maePct });
        }
        if (pd.children) {
          for (const child of pd.children) {
            if (child.tradeDetail?.maePct != null && child.percent != null) {
              if (!symbolMatchesPerformanceScope(child.pair, assetScope)) continue;
              trades.push({ pair: child.pair, returnPct: child.percent, maePct: child.tradeDetail.maePct });
            }
          }
        }
      }
    }
    return trades;
  }, [assetScope, engineWeekMap]);

  // ─── Engine-driven path (instant week switching) ──────────────
  if (engineWeekMap && weekOptions) {
    const rawGridProps = selectedWeek === "all"
      ? engineWeekMap["all"]
      : engineWeekMap[selectedWeek] ?? null;
    const gridProps = filterGridPropsByScope(rawGridProps, assetScope);
    const simulation = selectedWeek === "all"
      ? engineSimMap?.["all"] ?? null
      : engineSimMap?.[selectedWeek] ?? null;
    const gridHasActivity = selectedWeek === "all" || hasGridActivity(gridProps);

    return (
      <>
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
          <ScrollableWeekStrip
            options={weekOptions}
            selected={selectedWeek}
            currentWeek={currentWeek}
            label="Week"
            onChange={setSelectedWeek}
          />
        </div>

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
          simulation ? (
            <PerformanceSimulationSection
              group={simulation}
              weeklyReturns={selectedWeek === "all" ? weeklyReturns : undefined}
              maeTrades={selectedWeek === "all" ? maeTrades : undefined}
              assetScope={assetScope}
              onAssetScopeChange={setNormalizedAssetScope}
            />
          ) : (
            <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-4 text-sm text-[color:var(--muted)] shadow-sm">
              No simulation data for the selected week.
            </div>
          )
        ) : !gridHasActivity ? (
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-4 text-sm text-[color:var(--muted)] shadow-sm">
            {selectedWeek === currentWeek
              ? "Current week in progress — no realized fills yet. Switch to Simulation view to see the equity path."
              : "No realized performance data for the selected week."}
          </div>
        ) : view === "basket" && gridProps ? (
          <EngineBasketView gridProps={gridProps} />
        ) : gridProps ? (
          <PerformanceGrid
            {...gridProps}
            combined={gridProps.combined}
            perAsset={gridProps.perAsset}
            view={view}
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
  const filteredCombined = {
    ...baseGridProps.combined,
    models: baseGridProps.combined.models.filter((entry) => modelSet.has(entry.model)),
  };
  const filteredPerAsset = baseGridProps.perAsset.map((section) => ({
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
          {...baseGridProps}
          combined={filteredCombined}
          perAsset={filteredPerAsset}
          view={view}
        />
      )}
    </>
  );
}
