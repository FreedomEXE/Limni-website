import type { EngineGridProps, EngineSidebarStats, EngineSimulationGroup } from "@/lib/performance/engineAdapter";
import type { ClosedHistoryBundle } from "@/lib/basket/basketSummaryTypes";
import { buildClosedHistoryBundleFromStrategyResults } from "@/lib/basket/strategyRuntimeRows";
import type { StrategyPageData } from "@/lib/performance/strategyPageData";
import type { WeeklyHoldResult } from "@/lib/performance/weeklyHoldEngine";
import type { WeeklyReturnDisplayRow } from "@/lib/weeklyReturnDisplay";

export type StrategyClientPayload = {
  engineWeekMap: Record<string, EngineGridProps> | null;
  engineSimMap: Record<string, EngineSimulationGroup> | null;
  engineWeekResults: Record<string, WeeklyHoldResult> | null;
  sidebarStats: EngineSidebarStats | null;
  weekOptions?: string[];
  currentWeekOpenUtc?: string;
  artifactMeta?: StrategyPageData["artifactMeta"];
  weeklyReturnDisplayRows?: WeeklyReturnDisplayRow[];
  selectedTradeRowsBundle?: ClosedHistoryBundle | null;
};

export type StrategyClientPayloadScope = "performance" | "matrix" | "full";

function stripGridProps(grid: EngineGridProps): EngineGridProps {
  const stripModel = (model: EngineGridProps["combined"]["models"][number]) => ({
    ...model,
    pair_details: model.pair_details.map((detail) => ({
      ...detail,
      children: undefined,
      tradeDetail: undefined,
    })),
  });

  return {
    ...grid,
    combined: {
      ...grid.combined,
      models: grid.combined.models.map(stripModel),
    },
    perAsset: grid.perAsset.map((section) => ({
      ...section,
      models: section.models.map(stripModel),
    })),
  };
}

function stripWeekResult(result: WeeklyHoldResult): WeeklyHoldResult {
  return {
    ...result,
    trades: result.trades.map((trade) => ({
      ...trade,
      detail: undefined,
    })),
  };
}

function stripWeekMap(weekMap: StrategyPageData["weekMap"] | null | undefined) {
  if (!weekMap) return null;
  return Object.fromEntries(
    Object.entries(weekMap).map(([week, grid]) => [week, stripGridProps(grid)]),
  );
}

function stripWeekResults(weekResults: StrategyPageData["weekResults"] | null | undefined) {
  if (!weekResults) return null;
  return Object.fromEntries(
    Object.entries(weekResults).map(([week, result]) => [week, stripWeekResult(result)]),
  );
}

function strategyVariantForData(data: StrategyPageData) {
  return [
    data.biasSource.id,
    data.entryStyle?.id ?? "weekly_hold",
    data.riskOverlay?.id ?? "none",
  ].join("-");
}

function buildSelectedTradeRowsBundle(
  data: StrategyPageData,
  scope: StrategyClientPayloadScope,
): ClosedHistoryBundle | null {
  if (scope !== "full") return null;
  return buildClosedHistoryBundleFromStrategyResults({
    strategyVariant: strategyVariantForData(data),
    weekResults: data.weekResults,
    generatedAt: data.artifactMeta?.cachedAtUtc ?? undefined,
  });
}

export function toStrategyClientPayload(
  data: StrategyPageData,
  scope: StrategyClientPayloadScope = "performance",
): StrategyClientPayload {
  const weekOptions = Array.from(new Set(["all", data.currentWeekOpenUtc, ...data.weekOptions]));
  return {
    engineWeekMap: scope === "matrix" ? null : stripWeekMap(data.weekMap),
    engineSimMap: scope === "matrix" ? null : data.simMap ?? null,
    engineWeekResults: scope === "performance" ? null : stripWeekResults(data.weekResults),
    sidebarStats: data.sidebarStats ?? null,
    weekOptions,
    currentWeekOpenUtc: data.currentWeekOpenUtc,
    artifactMeta: data.artifactMeta,
    selectedTradeRowsBundle: buildSelectedTradeRowsBundle(data, scope),
  };
}

export function toCurrentWeekStrategyClientPayload(
  data: StrategyPageData,
  scope: StrategyClientPayloadScope = "performance",
): StrategyClientPayload {
  const currentWeek = data.currentWeekOpenUtc;
  const weekOptions = Array.from(new Set(["all", currentWeek, ...data.weekOptions]));
  const currentWeekGrid = data.weekMap?.[currentWeek];
  const currentWeekResult = data.weekResults?.[currentWeek];
  return {
    engineWeekMap:
      scope === "matrix" || !currentWeekGrid
        ? null
        : { [currentWeek]: scope === "full" ? currentWeekGrid : stripGridProps(currentWeekGrid) },
    engineSimMap:
      scope === "matrix" || !data.simMap?.[currentWeek]
        ? null
        : { [currentWeek]: data.simMap[currentWeek] },
    engineWeekResults:
      scope === "performance" || !currentWeekResult
        ? null
        : { [currentWeek]: scope === "full" ? currentWeekResult : stripWeekResult(currentWeekResult) },
    sidebarStats: data.sidebarStats ?? null,
    weekOptions,
    currentWeekOpenUtc: currentWeek,
    artifactMeta: data.artifactMeta,
    selectedTradeRowsBundle: null,
  };
}
