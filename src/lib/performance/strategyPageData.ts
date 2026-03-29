/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: strategyPageData.ts
 *
 * Description:
 * Shared server-side data loader for any page that shows strategy trades.
 * Computes all weeks upfront using the strategy engine.
 * Used by Performance page, Matrix page, and any future section.
 *
 * Canonical source of truth: compute once, pass as props, never re-fetch.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { computeWeeklyHold, computeMultiWeekHold, type WeeklyHoldResult, type MultiWeekResult } from "@/lib/performance/weeklyHoldEngine";
import { weeklyHoldToGridProps, multiWeekToGridProps, multiWeekToSimulation, singleWeekToSimulation, weeklyHoldToSidebarStats, type EngineGridProps, type EngineSimulationGroup, type EngineSidebarStats } from "@/lib/performance/engineAdapter";
import { getStrategy, resolveStrategyId, resolveIntradayFilterId, getIntradayFilter, type BiasSourceConfig, type IntradayFilterConfig } from "@/lib/performance/strategyConfig";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import { listDataSectionWeeks } from "@/lib/dataSectionWeeks";
import { buildDataWeekOptions } from "@/lib/weekOptions";

export type StrategySelection = {
  strategyId: string;
  f1: string;
  f2: string;
};

export type StrategyPageData = {
  /** Pre-computed grid props per week key (including "all") */
  weekMap: Record<string, EngineGridProps>;
  /** Pre-computed simulation per week key (including "all") */
  simMap: Record<string, EngineSimulationGroup>;
  /** Raw multi-week result (for sidebar stats) */
  multiWeekResult: MultiWeekResult;
  /** Raw per-week results keyed by weekOpenUtc */
  weekResults: Record<string, WeeklyHoldResult>;
  /** Sidebar stats */
  sidebarStats: EngineSidebarStats;
  /** The resolved bias source config */
  biasSource: BiasSourceConfig;
  /** The resolved intraday filter (or undefined for none) */
  intradayFilter: IntradayFilterConfig | undefined;
  /** All available week options */
  weekOptions: string[];
  /** Current week open UTC */
  currentWeekOpenUtc: string;
};

/**
 * Load strategy data for all weeks. Called server-side by any page
 * that needs canonical strategy trade data.
 */
export async function loadStrategyPageData(
  selection: StrategySelection,
): Promise<StrategyPageData | null> {
  const biasSource = getStrategy(selection.strategyId);
  if (!biasSource) return null;

  const intradayFilterId = resolveIntradayFilterId(selection.f2);
  const intradayFilter = getIntradayFilter(intradayFilterId);

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const dataSectionWeeks = await listDataSectionWeeks();
  const weekOptions = buildDataWeekOptions({
    historicalWeeks: dataSectionWeeks,
    currentWeekOpenUtc,
  }) as string[];

  try {
    const multiWeekResult = await computeMultiWeekHold(biasSource, weekOptions, intradayFilter);

    // Build per-week GridProps + simulation
    const weekMap: Record<string, EngineGridProps> = {};
    const simMap: Record<string, EngineSimulationGroup> = {};
    const weekResults: Record<string, WeeklyHoldResult> = {};

    for (const weekResult of multiWeekResult.weeks) {
      const label = weekDisplayLabel(weekResult.weekOpenUtc);
      weekMap[weekResult.weekOpenUtc] = weeklyHoldToGridProps(weekResult, biasSource, label);
      simMap[weekResult.weekOpenUtc] = singleWeekToSimulation(weekResult, biasSource, label);
      weekResults[weekResult.weekOpenUtc] = weekResult;
    }

    // All-time aggregates
    weekMap["all"] = multiWeekToGridProps(multiWeekResult, biasSource);
    simMap["all"] = multiWeekToSimulation(multiWeekResult, biasSource);

    // Sidebar stats (current week + all-time)
    const currentWeekResult = multiWeekResult.weeks.find((w) => w.weekOpenUtc === currentWeekOpenUtc)
      ?? multiWeekResult.weeks[0]
      ?? { weekOpenUtc: currentWeekOpenUtc, biasSourceId: biasSource.id, trades: [], totalReturnPct: 0, winCount: 0, lossCount: 0, winRate: 0, tradeCount: 0 };
    const sidebarStats = weeklyHoldToSidebarStats(currentWeekResult, biasSource, multiWeekResult);

    return {
      weekMap,
      simMap,
      multiWeekResult,
      weekResults,
      sidebarStats,
      biasSource,
      intradayFilter,
      weekOptions,
      currentWeekOpenUtc,
    };
  } catch (err) {
    console.error("[strategyPageData] Failed to load:", err instanceof Error ? err.message : err);
    return null;
  }
}

function weekDisplayLabel(weekOpenUtc: string): string {
  try {
    const d = new Date(weekOpenUtc);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return weekOpenUtc.split("T")[0] ?? weekOpenUtc;
  }
}
