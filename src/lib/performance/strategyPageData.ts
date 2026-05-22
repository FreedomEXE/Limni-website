/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: strategyPageData.ts
 *
 * Description:
 * Shared server-side data loader for strategy-backed pages. Reuses a
 * cached artifact when source inputs are unchanged and selectively
 * recomputes only the weeks whose source watermarks changed.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { listDataSectionWeeks } from "@/lib/dataSectionWeeks";
import {
  multiWeekToGridProps,
  multiWeekPathToSimulation,
  multiWeekToSimulation,
  resolveCardSlots,
  resolveLegSlotFn,
  singleWeekPathToSimulation,
  singleWeekToSimulation,
  withTradeDerivedSeriesGroups,
  weeklyHoldToGridProps,
  weeklyHoldToSidebarStatsWithPath,
  type EngineGridProps,
  type EnginePathDiagnostics,
  type EngineSidebarStats,
  type EngineSimulationGroup,
} from "@/lib/performance/engineAdapter";
import {
  getEntryStyle,
  getRiskOverlay,
  getStrategy,
  type EntryStyleConfig,
  type BiasSourceConfig,
  type RiskOverlayConfig,
} from "@/lib/performance/strategyConfig";
import {
  computeWeeklyHold,
  type MultiWeekResult,
  type WeeklyHoldResult,
} from "@/lib/performance/weeklyHoldEngine";
import {
  persistWeekShard,
  readWeekShards,
  type WeekShardEntry,
} from "@/lib/performance/strategyWeekShardCache";
import {
  buildStrategyArtifactEngineVersion,
  buildStrategyRuntimeVersionKey,
} from "@/lib/performance/strategyArtifactVersions";
import { buildStrategySelectionKey } from "@/lib/performance/strategySelection";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import { buildDataWeekOptions } from "@/lib/weekOptions";
import { loadPathBars } from "@/lib/performance/pathBarLoader";
import { getOrSetRuntimeCache } from "@/lib/runtimeCache";
import { buildWeeklyHoldLedger, splitLedgerBySlot } from "@/lib/performance/positionLedger";
import {
  computeBasketPath,
  computeBasketPathWithSlots,
  computeMultiWeekBasketPath,
  type BasketPathResult,
  type BasketPathSummary,
} from "@/lib/performance/basketPathEngine";
import { CANONICAL_PATH_RESOLUTION } from "@/lib/performance/pathResolution";
import { computeMaxDrawdownFromPercentReturns } from "@/lib/performance/drawdown";

const STRATEGY_CURRENT_WEEK_CACHE_TTL_MS = Number(
  process.env.STRATEGY_CURRENT_WEEK_CACHE_TTL_MS ?? "3600000",
);
const STRATEGY_SHARD_BUILD_TIME_BUDGET_MS = Number(
  process.env.STRATEGY_SHARD_BUILD_TIME_BUDGET_MS ?? "100000",
);
const PAGE_LOAD_SHARD_BUDGET_MS = Number(
  process.env.PAGE_LOAD_SHARD_BUDGET_MS ?? "15000",
);
const ASSET_PATH_ORDER = ["fx", "indices", "commodities", "crypto"] as const;

function getCurrentWeekCacheTtlMs() {
  if (
    Number.isFinite(STRATEGY_CURRENT_WEEK_CACHE_TTL_MS)
    && STRATEGY_CURRENT_WEEK_CACHE_TTL_MS >= 0
  ) {
    return Math.floor(STRATEGY_CURRENT_WEEK_CACHE_TTL_MS);
  }
  return 300000;
}

function getShardBuildTimeBudgetMs() {
  if (
    Number.isFinite(STRATEGY_SHARD_BUILD_TIME_BUDGET_MS) &&
    STRATEGY_SHARD_BUILD_TIME_BUDGET_MS > 0
  ) {
    return Math.max(10000, Math.floor(STRATEGY_SHARD_BUILD_TIME_BUDGET_MS));
  }
  return 100000;
}

function getPageLoadShardBudgetMs() {
  if (
    Number.isFinite(PAGE_LOAD_SHARD_BUDGET_MS) &&
    PAGE_LOAD_SHARD_BUDGET_MS > 0
  ) {
    return Math.max(1000, Math.floor(PAGE_LOAD_SHARD_BUDGET_MS));
  }
  return 15000;
}

function buildSelectionLabel(
  entryStyle: EntryStyleConfig | undefined,
  riskOverlay: RiskOverlayConfig | undefined,
) {
  const parts = [entryStyle?.label ?? "Weekly Hold"];
  if (riskOverlay && riskOverlay.id !== "none") parts.push(riskOverlay.label);
  return parts.join(" · ");
}

export type StrategySelection = {
  strategyId: string;
  f1: string;
  f2: string;
};

export type StrategyPageData = {
  weekMap: Record<string, EngineGridProps>;
  simMap: Record<string, EngineSimulationGroup>;
  pathSummaryMap: Record<string, BasketPathSummary>;
  multiWeekResult: MultiWeekResult;
  weekResults: Record<string, WeeklyHoldResult>;
  sidebarStats: EngineSidebarStats;
  biasSource: BiasSourceConfig;
  entryStyle: EntryStyleConfig | undefined;
  weekOptions: string[];
  currentWeekOpenUtc: string;
  artifactMeta?: {
    status: "hit" | "patched" | "miss";
    selectionKey: string;
    cachedAtUtc: string | null;
    refreshedWeeks: string[];
    removedWeeks: string[];
    missingWeeks: string[];
    stale?: boolean;
    staleReason?: string | null;
    engineVersion?: string;
  };
};

type LoadStrategyPageDataOptions = {
  includeCurrentWeek?: boolean;
  repairAllMissingWeeks?: boolean;
};

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const PERMANENT_SHARD_FINGERPRINT_PREFIX = "permanent";

function getPreviousWeekOpenUtc(currentWeekOpenUtc = getDisplayWeekOpenUtc()) {
  const parsed = Date.parse(currentWeekOpenUtc);
  if (!Number.isFinite(parsed)) return currentWeekOpenUtc;
  return new Date(parsed - ONE_WEEK_MS).toISOString();
}

function buildPermanentWeekFingerprint(weekOpenUtc: string) {
  return `${PERMANENT_SHARD_FINGERPRINT_PREFIX}:${weekOpenUtc}`;
}

function hasRenderablePrimarySeries(shard: WeekShardEntry) {
  const primarySeries =
    shard.sim?.series?.find((series) => series.id === "equity" || series.id === "total")
    ?? shard.sim?.series?.[0];
  return (primarySeries?.points.length ?? 0) > 2;
}

function hasNonPrimaryPathSeries(shard: WeekShardEntry) {
  return (shard.sim?.series ?? []).some((series) =>
    series.id !== "equity" &&
    series.id !== "total" &&
    !series.id.startsWith("asset:") &&
    (series.points?.length ?? 0) > 2,
  );
}

export function isInvalidWeekShardForSelection(
  shard: WeekShardEntry,
  entryStyle: EntryStyleConfig | undefined,
  riskOverlay: RiskOverlayConfig | undefined,
) {
  if (!shard.weekResult || !shard.sim) return true;
  const primarySeries =
    shard.sim.series?.find((series) => series.id === "equity" || series.id === "total")
    ?? shard.sim.series?.[0];
  const primaryPointCount = primarySeries?.points.length ?? 0;
  const signalCount = shard.weekResult.signals?.length ?? 0;
  if (
    shard.weekResult.isRealized &&
    shard.weekResult.tradeCount <= 0 &&
    signalCount > 0 &&
    primaryPointCount <= 1
  ) {
    return true;
  }

  if (
    entryStyle?.id === "adr_grid" &&
    riskOverlay &&
    riskOverlay.id !== "none" &&
    shard.weekResult.isRealized &&
    shard.weekResult.tradeCount <= 0 &&
    signalCount === 0 &&
    primaryPointCount <= 1 &&
    hasNonPrimaryPathSeries(shard)
  ) {
    return true;
  }

  if (!shard.weekResult.isRealized || shard.weekResult.tradeCount <= 0) return false;
  if (!hasRenderablePrimarySeries(shard)) return true;

  const tradedAssetClasses = new Set(
    shard.weekResult.trades
      .map((trade) => trade.assetClass)
      .filter((assetClass): assetClass is (typeof ASSET_PATH_ORDER)[number] =>
        ASSET_PATH_ORDER.includes(assetClass as (typeof ASSET_PATH_ORDER)[number]),
      ),
  );
  if (tradedAssetClasses.size === 0) return false;

  for (const assetClass of tradedAssetClasses) {
    const assetSeries = shard.sim.series.find((series) => series.id === `asset:${assetClass}`);
    if (!assetSeries || assetSeries.points.length <= 2) {
      return true;
    }
  }

  return false;
}

function latestShardCachedAtUtc(shards: WeekShardEntry[]) {
  return shards
    .map((shard) => shard.cachedAtUtc)
    .filter(Boolean)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
}

function currentHourBucket() {
  const now = new Date();
  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    String(now.getUTCHours()).padStart(2, "0"),
  ].join("-");
}

function weekResultFallbackPathSummary(weekResult: WeeklyHoldResult): BasketPathSummary {
  return {
    totalReturnPct: weekResult.totalReturnPct,
    peakPct: weekResult.totalReturnPct,
    troughPct: Math.min(0, weekResult.totalReturnPct),
    maxDrawdownPct: 0,
    peakToCloseGivebackPct: 0,
    troughToCloseRecoveryPct: weekResult.totalReturnPct - Math.min(0, weekResult.totalReturnPct),
    maxActivePositions: weekResult.tradeCount,
  };
}

async function computeWeekPathArtifact(options: {
  weekResult: WeeklyHoldResult;
  biasSource: BiasSourceConfig;
  entryStyle: EntryStyleConfig | undefined;
  selectionLabel: string;
}) {
  const { weekResult, biasSource, entryStyle, selectionLabel } = options;
  const label = weekDisplayLabel(weekResult.weekOpenUtc);
  const ledger = await buildWeeklyHoldLedger(weekResult, {
    entryStyleId: entryStyle?.id ?? "weekly_hold",
  });
  const symbols = ledger.legs.map((leg) => leg.symbol);
  const bars = await loadPathBars(
    symbols,
    ledger.weekOpenUtc,
    ledger.weekCloseUtc,
    CANONICAL_PATH_RESOLUTION,
  );
  const cardSlots = resolveCardSlots(biasSource);
  const slotFn = resolveLegSlotFn(biasSource.cardBreakdown, cardSlots);
  const { path, slotPaths } = computeBasketPathWithSlots(ledger, bars, slotFn, cardSlots.length);
  const assetLedgers = splitLedgerBySlot(
    ledger,
    (leg) => {
      const index = ASSET_PATH_ORDER.indexOf(leg.assetClass as (typeof ASSET_PATH_ORDER)[number]);
      return index >= 0 ? index : 0;
    },
    ASSET_PATH_ORDER.length,
  );
  const assetPaths = assetLedgers.map((assetLedger) => computeBasketPath(assetLedger, bars));
  return {
    weekKey: weekResult.weekOpenUtc,
    path,
    slotPaths,
    assetPaths,
    sim: singleWeekPathToSimulation(
      path,
      weekResult,
      biasSource,
      label,
      selectionLabel,
      slotPaths,
      assetPaths,
    ),
    summary: path.summary,
  };
}

function buildWeekResultRuntimeSignature(weekResult: WeeklyHoldResult) {
  const trades = weekResult.trades.map((trade) => [
    trade.symbol,
    trade.source,
    trade.direction,
    trade.openPrice,
    trade.closePrice,
    trade.returnPct,
    trade.weight ?? 1,
    trade.detail?.entryTimeUtc ?? "",
    trade.detail?.exitTimeUtc ?? "",
    trade.detail?.exitReason ?? "",
  ].join("~"));

  return [
    weekResult.weekOpenUtc,
    weekResult.biasSourceId,
    weekResult.totalReturnPct,
    weekResult.tradeCount,
    weekResult.winCount,
    weekResult.lossCount,
    weekResult.isRealized ? "realized" : "open",
    trades.join(";"),
  ].join("|");
}

async function computeCurrentWeekResultCached(options: {
  selectionKey: string;
  biasSource: BiasSourceConfig;
  currentWeekOpenUtc: string;
  entryStyle: EntryStyleConfig | undefined;
  riskOverlay: RiskOverlayConfig | undefined;
}) {
  const {
    selectionKey,
    biasSource,
    currentWeekOpenUtc,
    entryStyle,
    riskOverlay,
  } = options;
  const cacheKey = [
    "strategyCurrentWeek",
    buildStrategyRuntimeVersionKey(),
    selectionKey,
    currentWeekOpenUtc,
    entryStyle?.id ?? "weekly_hold",
    riskOverlay?.id ?? "none",
    currentHourBucket(),
  ].join(":");

  return getOrSetRuntimeCache(
    cacheKey,
    getCurrentWeekCacheTtlMs(),
    () => computeWeeklyHold(biasSource, currentWeekOpenUtc, entryStyle, riskOverlay),
  );
}

async function computeCurrentWeekPathArtifactCached(options: {
  selectionKey: string;
  weekResult: WeeklyHoldResult;
  biasSource: BiasSourceConfig;
  entryStyle: EntryStyleConfig | undefined;
  selectionLabel: string;
}) {
  const {
    selectionKey,
    weekResult,
    biasSource,
    entryStyle,
    selectionLabel,
  } = options;
  const cacheKey = [
    "strategyCurrentWeekPath",
    buildStrategyRuntimeVersionKey(),
    selectionKey,
    entryStyle?.id ?? "weekly_hold",
    buildWeekResultRuntimeSignature(weekResult),
    currentHourBucket(),
  ].join(":");

  return getOrSetRuntimeCache(
    cacheKey,
    getCurrentWeekCacheTtlMs(),
    () => computeWeekPathArtifact({
      weekResult,
      biasSource,
      entryStyle,
      selectionLabel,
    }),
  );
}

function reconstructWeekPathResult(options: {
  weekOpenUtc: string;
  strategyId: string;
  entryStyleId: string;
  summary: BasketPathSummary;
  simulation: EngineSimulationGroup;
}) {
  const { weekOpenUtc, strategyId, entryStyleId, summary, simulation } = options;
  const equitySeries = simulation.series[0];
  if (!equitySeries) return null;

  return {
    weekOpenUtc,
    strategyId,
    entryStyleId,
    resolution: CANONICAL_PATH_RESOLUTION,
    points: equitySeries.points.map((point) => ({
      tsUtc: point.ts_utc,
      equityPct: point.equity_pct,
      peakPct: point.peak_pct ?? 0,
      drawdownPct: point.drawdown_pct ?? 0,
      activePositions: point.active_positions ?? summary.maxActivePositions,
    })),
    summary,
  } satisfies BasketPathResult;
}

function summarizeSimulationPoints(points: EngineSimulationGroup["series"][number]["points"]): BasketPathSummary {
  if (points.length === 0) {
    return {
      totalReturnPct: 0,
      peakPct: 0,
      troughPct: 0,
      maxDrawdownPct: 0,
      peakToCloseGivebackPct: 0,
      troughToCloseRecoveryPct: 0,
      maxActivePositions: 0,
    };
  }

  let runningPeak = 0;
  let peakPct = 0;
  let troughPct = 0;
  let maxDrawdownPct = 0;
  let maxActivePositions = 0;
  for (const point of points) {
    const equityPct = point.equity_pct;
    peakPct = Math.max(peakPct, equityPct);
    troughPct = Math.min(troughPct, equityPct);
    runningPeak = Math.max(runningPeak, equityPct);
    const drawdownPct =
      typeof point.drawdown_pct === "number"
        ? point.drawdown_pct
        : (100 + runningPeak) <= 0
          ? -100
          : (((100 + equityPct) / (100 + runningPeak)) - 1) * 100;
    maxDrawdownPct = Math.max(maxDrawdownPct, Math.abs(drawdownPct));
    maxActivePositions = Math.max(maxActivePositions, point.active_positions ?? 0);
  }
  const totalReturnPct = points[points.length - 1]?.equity_pct ?? 0;

  return {
    totalReturnPct,
    peakPct,
    troughPct,
    maxDrawdownPct,
    peakToCloseGivebackPct: peakPct - totalReturnPct,
    troughToCloseRecoveryPct: totalReturnPct - troughPct,
    maxActivePositions,
  };
}

function reconstructWeekPathResultFromSeries(options: {
  weekOpenUtc: string;
  strategyId: string;
  entryStyleId: string;
  simulation: EngineSimulationGroup;
  seriesId: string;
}) {
  const { weekOpenUtc, strategyId, entryStyleId, simulation, seriesId } = options;
  const series = simulation.series.find((candidate) => candidate.id === seriesId);
  if (!series) return null;
  const summary = summarizeSimulationPoints(series.points);
  let runningPeakPct = 0;

  return {
    weekOpenUtc,
    strategyId,
    entryStyleId,
    resolution: CANONICAL_PATH_RESOLUTION,
    points: series.points.map((point) => {
      runningPeakPct = Math.max(runningPeakPct, point.equity_pct);
      const peakPct = point.peak_pct ?? runningPeakPct;
      const drawdownPct =
        typeof point.drawdown_pct === "number"
          ? point.drawdown_pct
          : (100 + peakPct) <= 0
            ? -100
            : (((100 + point.equity_pct) / (100 + peakPct)) - 1) * 100;
      return {
        tsUtc: point.ts_utc,
        equityPct: point.equity_pct,
        peakPct,
        drawdownPct,
        activePositions: point.active_positions ?? 0,
      };
    }),
    summary,
  } satisfies BasketPathResult;
}

function maxDrawdownFromSimulationSeries(series: EngineSimulationGroup["series"][number] | undefined) {
  if (!series) return null;
  const drawdowns = series.points
    .map((point) => point.drawdown_pct)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (drawdowns.length === 0) return null;
  return Math.abs(Math.min(...drawdowns));
}

function pathDiagnosticsFromSimulation(
  biasSource: BiasSourceConfig,
  simulation: EngineSimulationGroup | undefined,
): EnginePathDiagnostics | undefined {
  if (!simulation) return undefined;
  const slotMaxDrawdownPct: NonNullable<EnginePathDiagnostics["slotMaxDrawdownPct"]> = {};
  for (const slot of resolveCardSlots(biasSource)) {
    const maxDrawdownPct = maxDrawdownFromSimulationSeries(
      simulation.series.find((series) => series.id === slot),
    );
    if (maxDrawdownPct !== null) {
      slotMaxDrawdownPct[slot] = maxDrawdownPct;
    }
  }
  return Object.keys(slotMaxDrawdownPct).length > 0 ? { slotMaxDrawdownPct } : undefined;
}

function assembleStrategyPageData(options: {
  biasSource: BiasSourceConfig;
  currentWeekOpenUtc: string;
  entryStyle: EntryStyleConfig | undefined;
  riskOverlay: RiskOverlayConfig | undefined;
  weekOptions: string[];
  weekResultsByWeek: Record<string, WeeklyHoldResult>;
  simMap: Record<string, EngineSimulationGroup>;
  pathSummaryMap: Record<string, BasketPathSummary>;
  artifactMeta?: StrategyPageData["artifactMeta"];
}): StrategyPageData {
  const {
    biasSource,
    currentWeekOpenUtc,
    entryStyle,
    riskOverlay,
    weekOptions,
    weekResultsByWeek,
    simMap,
    pathSummaryMap,
    artifactMeta,
  } = options;
  const selectionLabel = buildSelectionLabel(entryStyle, riskOverlay);
  const orderedWeeks = weekOptions
    .map((weekOpenUtc) => weekResultsByWeek[weekOpenUtc])
    .filter((weekResult): weekResult is WeeklyHoldResult => Boolean(weekResult));

  const multiWeekResult = buildMultiWeekResultFromWeeks(biasSource, orderedWeeks);
  const weekMap: Record<string, EngineGridProps> = {};
  const enrichedSimMap: Record<string, EngineSimulationGroup> = { ...simMap };

  for (const weekResult of orderedWeeks) {
    const label = weekDisplayLabel(weekResult.weekOpenUtc);
    const pathDiagnostics = pathDiagnosticsFromSimulation(
      biasSource,
      enrichedSimMap[weekResult.weekOpenUtc],
    );
    weekMap[weekResult.weekOpenUtc] = weeklyHoldToGridProps(
      weekResult,
      biasSource,
      label,
      selectionLabel,
      pathDiagnostics,
    );
    if (enrichedSimMap[weekResult.weekOpenUtc]) {
      enrichedSimMap[weekResult.weekOpenUtc] = withTradeDerivedSeriesGroups(
        enrichedSimMap[weekResult.weekOpenUtc],
        weekResult,
      );
    }
  }

  weekMap.all = multiWeekToGridProps(
    multiWeekResult,
    biasSource,
    selectionLabel,
    pathDiagnosticsFromSimulation(biasSource, enrichedSimMap.all),
  );
  if (enrichedSimMap.all) {
    enrichedSimMap.all = withTradeDerivedSeriesGroups(enrichedSimMap.all, multiWeekResult);
  }

  const currentWeekResult =
    weekResultsByWeek[currentWeekOpenUtc] ??
    orderedWeeks[0] ??
    {
      weekOpenUtc: currentWeekOpenUtc,
      biasSourceId: biasSource.id,
      trades: [],
      totalReturnPct: 0,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
      tradeCount: 0,
      signals: [],
      isRealized: false,
    };

  return {
    weekMap,
    simMap: enrichedSimMap,
    pathSummaryMap,
    multiWeekResult,
    weekResults: weekResultsByWeek,
    sidebarStats: weeklyHoldToSidebarStatsWithPath(currentWeekResult, biasSource, {
      multiWeek: multiWeekResult,
      currentWeekPathSummary: pathSummaryMap[currentWeekResult.weekOpenUtc] ?? null,
      multiWeekPathSummary: pathSummaryMap.all ?? null,
    }),
    biasSource,
    entryStyle,
    weekOptions,
    currentWeekOpenUtc,
    artifactMeta,
  };
}

type ShardNativeSelectionContext = {
  selectionKey: string;
  biasSource: BiasSourceConfig;
  entryStyle: EntryStyleConfig | undefined;
  riskOverlay: RiskOverlayConfig | undefined;
  engineVersion: string;
  currentWeekOpenUtc: string;
  previousWeekOpenUtc: string;
  historicalWeekOptions: string[];
  selectionLabel: string;
};

type EnsureHistoricalWeekShardsOptions = {
  onlyPreviousWeek?: boolean;
  timeBudgetMs?: number;
};

async function buildShardNativeSelectionContext(
  selection: StrategySelection,
): Promise<ShardNativeSelectionContext | null> {
  const selectionKey = buildStrategySelectionKey(selection);
  const biasSource = getStrategy(selection.strategyId);
  if (!biasSource) return null;

  const entryStyle = getEntryStyle(selection.f1);
  const riskOverlay = getRiskOverlay(selection.f2);
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const historicalWeekOptions = buildDataWeekOptions({
    historicalWeeks: await listDataSectionWeeks(),
    currentWeekOpenUtc,
  }).filter((weekOpenUtc): weekOpenUtc is string =>
    typeof weekOpenUtc === "string" &&
    weekOpenUtc !== "all" &&
    weekOpenUtc !== currentWeekOpenUtc,
  );

  return {
    selectionKey,
    biasSource,
    entryStyle,
    riskOverlay,
    engineVersion: buildStrategyArtifactEngineVersion({ entryStyle, riskOverlay }),
    currentWeekOpenUtc,
    previousWeekOpenUtc: getPreviousWeekOpenUtc(currentWeekOpenUtc),
    historicalWeekOptions,
    selectionLabel: buildSelectionLabel(entryStyle, riskOverlay),
  };
}

async function computeAndPersistPermanentWeekShard(options: {
  context: ShardNativeSelectionContext;
  weekOpenUtc: string;
}): Promise<WeekShardEntry> {
  const { context, weekOpenUtc } = options;
  const weekResult = await computeWeeklyHold(
    context.biasSource,
    weekOpenUtc,
    context.entryStyle,
    context.riskOverlay,
  );
  const pathArtifact = await computeWeekPathArtifact({
    weekResult,
    biasSource: context.biasSource,
    entryStyle: context.entryStyle,
    selectionLabel: context.selectionLabel,
  });
  const shard: WeekShardEntry = {
    selectionKey: context.selectionKey,
    weekOpenUtc,
    engineVersion: context.engineVersion,
    weekFingerprint: buildPermanentWeekFingerprint(weekOpenUtc),
    weekResult,
    pathSummary: pathArtifact.summary,
    sim: pathArtifact.sim,
    cachedAtUtc: new Date().toISOString(),
  };
  await persistWeekShard(shard);
  return shard;
}

export async function ensureHistoricalWeekShardsForSelection(
  selection: StrategySelection,
  options: EnsureHistoricalWeekShardsOptions = {},
): Promise<{
  context: ShardNativeSelectionContext;
  shards: WeekShardEntry[];
  computedWeeks: string[];
  missingWeeks: string[];
  errors: Record<string, string>;
} | null> {
  const context = await buildShardNativeSelectionContext(selection);
  if (!context) return null;

  const startedAt = Date.now();
  const timeBudgetMs = options.timeBudgetMs ?? getShardBuildTimeBudgetMs();
  const existingShards = (await readWeekShards(context.selectionKey, context.engineVersion))
    .filter((shard) => !isInvalidWeekShardForSelection(shard, context.entryStyle, context.riskOverlay));
  const shardByWeek = new Map(existingShards.map((shard) => [shard.weekOpenUtc, shard]));
  const missingWeeks = context.historicalWeekOptions.filter((weekOpenUtc) => !shardByWeek.has(weekOpenUtc));
  const targetWeeks = options.onlyPreviousWeek
    ? missingWeeks.filter((weekOpenUtc) => weekOpenUtc === context.previousWeekOpenUtc)
    : missingWeeks;
  const computedWeeks: string[] = [];
  const errors: Record<string, string> = {};

  for (const weekOpenUtc of targetWeeks) {
    if (Date.now() - startedAt > timeBudgetMs) {
      errors[weekOpenUtc] = "Shard build time budget exhausted";
      break;
    }

    try {
      const shard = await computeAndPersistPermanentWeekShard({ context, weekOpenUtc });
      shardByWeek.set(weekOpenUtc, shard);
      computedWeeks.push(weekOpenUtc);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors[weekOpenUtc] = message;
      console.error(`[strategyPageData] Failed to build week shard ${context.selectionKey} ${weekOpenUtc}:`, message);
    }
  }

  const finalShards = context.historicalWeekOptions
    .map((weekOpenUtc) => shardByWeek.get(weekOpenUtc))
    .filter((shard): shard is WeekShardEntry => Boolean(shard));
  const finalShardSet = new Set(finalShards.map((shard) => shard.weekOpenUtc));

  return {
    context,
    shards: finalShards,
    computedWeeks,
    missingWeeks: context.historicalWeekOptions.filter((weekOpenUtc) => !finalShardSet.has(weekOpenUtc)),
    errors,
  };
}

export async function loadStrategyPageData(
  selection: StrategySelection,
  options: LoadStrategyPageDataOptions = {},
): Promise<StrategyPageData | null> {
  const includeCurrentWeek = options.includeCurrentWeek !== false;

  try {
    const prepared = await ensureHistoricalWeekShardsForSelection(selection, {
      onlyPreviousWeek: false,
      timeBudgetMs: options.repairAllMissingWeeks
        ? getShardBuildTimeBudgetMs()
        : getPageLoadShardBudgetMs(),
    });
    if (!prepared) return null;

    const {
      context,
      shards,
      computedWeeks,
      missingWeeks,
    } = prepared;
    const historicalWeekOptions = context.historicalWeekOptions
      .filter((weekOpenUtc) => shards.some((shard) => shard.weekOpenUtc === weekOpenUtc));
    const historicalPayload = assembleStrategyPageDataFromShards({
      biasSource: context.biasSource,
      currentWeekOpenUtc: context.currentWeekOpenUtc,
      entryStyle: context.entryStyle,
      riskOverlay: context.riskOverlay,
      weekOptions: historicalWeekOptions,
      shards,
    });
    const artifactMeta: StrategyPageData["artifactMeta"] = {
      status: computedWeeks.length > 0 ? "patched" : "hit",
      selectionKey: context.selectionKey,
      cachedAtUtc: latestShardCachedAtUtc(shards),
      refreshedWeeks: computedWeeks,
      removedWeeks: [],
      missingWeeks,
      stale: false,
      staleReason: null,
      engineVersion: context.engineVersion,
    };

    if (!includeCurrentWeek) {
      return {
        ...historicalPayload,
        artifactMeta,
      };
    }

    const weekResultsByWeek: Record<string, WeeklyHoldResult> = { ...historicalPayload.weekResults };
    const currentWeekResult = await computeCurrentWeekResultCached({
      selectionKey: context.selectionKey,
      biasSource: context.biasSource,
      currentWeekOpenUtc: context.currentWeekOpenUtc,
      entryStyle: context.entryStyle,
      riskOverlay: context.riskOverlay,
    });
    if (currentWeekResult) {
      weekResultsByWeek[context.currentWeekOpenUtc] = currentWeekResult;
    }

    const merged = await mergeCurrentWeekIntoCachedPathData({
      selectionKey: context.selectionKey,
      currentWeekResult,
      cachedSimMap: { ...historicalPayload.simMap },
      cachedPathSummaryMap: { ...historicalPayload.pathSummaryMap },
      cachedWeeks: historicalWeekOptions,
      biasSource: context.biasSource,
      entryStyle: context.entryStyle,
      selectionLabel: context.selectionLabel,
      historicalWeekResults: weekResultsByWeek,
    });

    return assembleStrategyPageData({
      biasSource: context.biasSource,
      currentWeekOpenUtc: context.currentWeekOpenUtc,
      entryStyle: context.entryStyle,
      riskOverlay: context.riskOverlay,
      weekOptions: [context.currentWeekOpenUtc, ...historicalWeekOptions],
      weekResultsByWeek,
      simMap: merged.simMap,
      pathSummaryMap: merged.pathSummaryMap,
      artifactMeta,
    });
  } catch (err) {
    console.error(
      `[strategyPageData] Failed to load ${buildStrategySelectionKey(selection)}:`,
      err instanceof Error ? err.stack ?? err.message : err,
    );
    return null;
  }
}

export type StrategyArtifactBuildResult = {
  ok: boolean;
  selectionKey: string;
  artifactMeta: StrategyPageData["artifactMeta"] | null;
  weeks: number;
  trades: number | null;
};

export async function buildStrategyArtifact(
  selection: StrategySelection,
): Promise<StrategyArtifactBuildResult> {
  const selectionKey = buildStrategySelectionKey(selection);
  const prepared = await ensureHistoricalWeekShardsForSelection(selection, {
    onlyPreviousWeek: false,
  });
  const remainingMissing = prepared?.missingWeeks ?? [];
  const cachedAtUtc = latestShardCachedAtUtc(prepared?.shards ?? []);
  const trades = prepared
    ? prepared.shards.reduce((sum, shard) => sum + shard.weekResult.tradeCount, 0)
    : null;
  return {
    ok: Boolean(prepared) && remainingMissing.length === 0,
    selectionKey,
    artifactMeta: prepared
      ? {
          status: prepared.computedWeeks.length > 0 ? "patched" : "hit",
          selectionKey,
          cachedAtUtc,
          refreshedWeeks: prepared.computedWeeks,
          removedWeeks: [],
          missingWeeks: remainingMissing,
          stale: false,
          staleReason: null,
          engineVersion: prepared.context.engineVersion,
        }
      : null,
    weeks: prepared?.shards.length ?? 0,
    trades,
  };
}

export async function overlayCurrentWeekOnStrategyPageData(
  selection: StrategySelection,
  artifactPayload: StrategyPageData,
  artifactMeta: StrategyPageData["artifactMeta"],
): Promise<StrategyPageData | null> {
  const selectionKey = buildStrategySelectionKey(selection);
  const biasSource = getStrategy(selection.strategyId);
  if (!biasSource) return null;

  const entryStyle = getEntryStyle(selection.f1);
  const riskOverlay = getRiskOverlay(selection.f2);
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const historicalWeeks = artifactPayload.weekOptions
    .filter((weekOpenUtc) => weekOpenUtc !== "all" && weekOpenUtc !== currentWeekOpenUtc);
  const weekOptions = [currentWeekOpenUtc, ...historicalWeeks.filter((week) => week !== currentWeekOpenUtc)];
  const weekResultsByWeek: Record<string, WeeklyHoldResult> = { ...artifactPayload.weekResults };
  const currentWeekResult = await computeCurrentWeekResultCached({
    selectionKey,
    biasSource,
    currentWeekOpenUtc,
    entryStyle,
    riskOverlay,
  });

  if (currentWeekResult) {
    weekResultsByWeek[currentWeekOpenUtc] = currentWeekResult;
  }

  const merged = await mergeCurrentWeekIntoCachedPathData({
    selectionKey,
    currentWeekResult,
    cachedSimMap: { ...(artifactPayload.simMap ?? {}) },
    cachedPathSummaryMap: { ...(artifactPayload.pathSummaryMap ?? {}) },
    cachedWeeks: historicalWeeks,
    biasSource,
    entryStyle,
    selectionLabel: buildSelectionLabel(entryStyle, riskOverlay),
    historicalWeekResults: weekResultsByWeek,
  });

  return assembleStrategyPageData({
    biasSource,
    currentWeekOpenUtc,
    entryStyle,
    riskOverlay,
    weekOptions,
    weekResultsByWeek,
    simMap: merged.simMap,
    pathSummaryMap: merged.pathSummaryMap,
    artifactMeta,
  });
}

async function mergeCurrentWeekIntoCachedPathData(options: {
  selectionKey: string;
  currentWeekResult: WeeklyHoldResult | null;
  cachedSimMap: Record<string, EngineSimulationGroup>;
  cachedPathSummaryMap: Record<string, BasketPathSummary>;
  cachedWeeks: string[];
  biasSource: BiasSourceConfig;
  entryStyle: EntryStyleConfig | undefined;
  selectionLabel: string;
  historicalWeekResults: Record<string, WeeklyHoldResult>;
}) {
  const {
    selectionKey,
    currentWeekResult,
    cachedSimMap,
    cachedPathSummaryMap,
    cachedWeeks,
    biasSource,
    entryStyle,
    selectionLabel,
    historicalWeekResults,
  } = options;

  if (!currentWeekResult) {
    return {
      simMap: cachedSimMap,
      pathSummaryMap: cachedPathSummaryMap,
    };
  }

  try {
    const computed = await computeCurrentWeekPathArtifactCached({
      selectionKey,
      weekResult: currentWeekResult,
      biasSource,
      entryStyle,
      selectionLabel,
    });
    cachedSimMap[currentWeekResult.weekOpenUtc] = computed.sim;
    cachedPathSummaryMap[currentWeekResult.weekOpenUtc] = computed.summary;
  } catch (error) {
    console.warn(
      `[strategyPageData] Falling back to legacy current-week simulation for ${biasSource.id} ${currentWeekResult.weekOpenUtc}:`,
      error instanceof Error ? error.stack ?? error.message : error,
    );
    cachedSimMap[currentWeekResult.weekOpenUtc] = singleWeekToSimulation(
      currentWeekResult,
      biasSource,
      weekDisplayLabel(currentWeekResult.weekOpenUtc),
      selectionLabel,
    );
    cachedPathSummaryMap[currentWeekResult.weekOpenUtc] = weekResultFallbackPathSummary(currentWeekResult);
  }

  if (currentWeekResult.isRealized) {
    const reconstructed = cachedWeeks
      .map((weekOpenUtc) => {
        const weekResult = historicalWeekResults[weekOpenUtc];
        const simulation = cachedSimMap[weekOpenUtc];
        const summary = cachedPathSummaryMap[weekOpenUtc];
        if (!weekResult || !simulation || !summary) return null;
        return reconstructWeekPathResult({
          weekOpenUtc,
          strategyId: biasSource.id,
          entryStyleId: entryStyle?.id ?? "weekly_hold",
          summary,
          simulation,
        });
      })
      .filter((value): value is BasketPathResult => Boolean(value));
    const reconstructedSlotPaths: BasketPathResult[][] = Array.from(
      { length: resolveCardSlots(biasSource).length },
      () => [],
    );
    const reconstructedAssetPaths: BasketPathResult[][] = Array.from(
      { length: ASSET_PATH_ORDER.length },
      () => [],
    );

    for (const weekOpenUtc of cachedWeeks) {
      const weekResult = historicalWeekResults[weekOpenUtc];
      const simulation = cachedSimMap[weekOpenUtc];
      if (!weekResult || !simulation) continue;

      resolveCardSlots(biasSource).forEach((slotId, slotIndex) => {
        const slotPath = reconstructWeekPathResultFromSeries({
          weekOpenUtc,
          strategyId: biasSource.id,
          entryStyleId: entryStyle?.id ?? "weekly_hold",
          simulation,
          seriesId: slotId,
        });
        if (slotPath) {
          reconstructedSlotPaths[slotIndex]?.push(slotPath);
        }
      });

      ASSET_PATH_ORDER.forEach((assetId, assetIndex) => {
        const assetPath = reconstructWeekPathResultFromSeries({
          weekOpenUtc,
          strategyId: biasSource.id,
          entryStyleId: entryStyle?.id ?? "weekly_hold",
          simulation,
          seriesId: `asset:${assetId}`,
        });
        if (assetPath) {
          reconstructedAssetPaths[assetIndex]?.push(assetPath);
        }
      });
    }

    const currentSummary = cachedPathSummaryMap[currentWeekResult.weekOpenUtc];
    const currentSimulation = cachedSimMap[currentWeekResult.weekOpenUtc];
    if (currentSummary && currentSimulation) {
      const currentPath = reconstructWeekPathResult({
        weekOpenUtc: currentWeekResult.weekOpenUtc,
        strategyId: biasSource.id,
        entryStyleId: entryStyle?.id ?? "weekly_hold",
        summary: currentSummary,
        simulation: currentSimulation,
      });
      if (currentPath) {
        reconstructed.push(currentPath);
      }

      resolveCardSlots(biasSource).forEach((slotId, slotIndex) => {
        const slotPath = reconstructWeekPathResultFromSeries({
          weekOpenUtc: currentWeekResult.weekOpenUtc,
          strategyId: biasSource.id,
          entryStyleId: entryStyle?.id ?? "weekly_hold",
          simulation: currentSimulation,
          seriesId: slotId,
        });
        if (slotPath) {
          reconstructedSlotPaths[slotIndex]?.push(slotPath);
        }
      });

      ASSET_PATH_ORDER.forEach((assetId, assetIndex) => {
        const assetPath = reconstructWeekPathResultFromSeries({
          weekOpenUtc: currentWeekResult.weekOpenUtc,
          strategyId: biasSource.id,
          entryStyleId: entryStyle?.id ?? "weekly_hold",
          simulation: currentSimulation,
          seriesId: `asset:${assetId}`,
        });
        if (assetPath) {
          reconstructedAssetPaths[assetIndex]?.push(assetPath);
        }
      });
    }

    if (reconstructed.length > 0) {
      const allPath = computeMultiWeekBasketPath(reconstructed);
      const slotMultiWeekPaths = reconstructedSlotPaths.map((slotWeekPaths) =>
        computeMultiWeekBasketPath(slotWeekPaths),
      );
      const assetMultiWeekPaths = reconstructedAssetPaths.map((assetWeekPaths) =>
        computeMultiWeekBasketPath(assetWeekPaths),
      );
      cachedPathSummaryMap.all = allPath.summary;
      cachedSimMap.all = multiWeekPathToSimulation(
        allPath,
        buildMultiWeekResultFromWeeks(
          biasSource,
          [...cachedWeeks, currentWeekResult.weekOpenUtc]
            .map((weekOpenUtc) =>
              weekOpenUtc === currentWeekResult.weekOpenUtc
                ? currentWeekResult
                : historicalWeekResults[weekOpenUtc],
            )
            .filter((weekResult): weekResult is WeeklyHoldResult => Boolean(weekResult) && weekResult.isRealized),
        ),
        biasSource,
        selectionLabel,
        slotMultiWeekPaths,
        assetMultiWeekPaths,
      );
    }
  }

  return {
    simMap: cachedSimMap,
    pathSummaryMap: cachedPathSummaryMap,
  };
}

export function assembleStrategyPageDataFromShards(options: {
  biasSource: BiasSourceConfig;
  currentWeekOpenUtc: string;
  entryStyle: EntryStyleConfig | undefined;
  riskOverlay: RiskOverlayConfig | undefined;
  weekOptions: string[];
  shards: WeekShardEntry[];
}): StrategyPageData {
  const {
    biasSource,
    currentWeekOpenUtc,
    entryStyle,
    riskOverlay,
    weekOptions,
    shards,
  } = options;
  const selectionLabel = buildSelectionLabel(entryStyle, riskOverlay);
  const expectedWeekSet = new Set(weekOptions);
  const weekResultsByWeek: Record<string, WeeklyHoldResult> = {};
  const simMap: Record<string, EngineSimulationGroup> = {};
  const pathSummaryMap: Record<string, BasketPathSummary> = {};

  for (const shard of shards) {
    if (!expectedWeekSet.has(shard.weekOpenUtc)) continue;
    weekResultsByWeek[shard.weekOpenUtc] = shard.weekResult;
    simMap[shard.weekOpenUtc] = shard.sim;
    pathSummaryMap[shard.weekOpenUtc] = shard.pathSummary;
  }

  const orderedWeeks = weekOptions
    .map((weekOpenUtc) => weekResultsByWeek[weekOpenUtc])
    .filter((weekResult): weekResult is WeeklyHoldResult => Boolean(weekResult));
  const multiWeekResult = buildMultiWeekResultFromWeeks(biasSource, orderedWeeks);
  const cardSlots = resolveCardSlots(biasSource);
  const realizedWeekPaths: BasketPathResult[] = [];
  const realizedSlotPaths: BasketPathResult[][] = Array.from({ length: cardSlots.length }, () => []);
  const realizedAssetPaths: BasketPathResult[][] = Array.from({ length: ASSET_PATH_ORDER.length }, () => []);

  for (const weekResult of orderedWeeks) {
    if (!weekResult.isRealized) continue;
    const simulation = simMap[weekResult.weekOpenUtc];
    const summary = pathSummaryMap[weekResult.weekOpenUtc];
    if (!simulation || !summary) continue;
    const weekPath = reconstructWeekPathResult({
      weekOpenUtc: weekResult.weekOpenUtc,
      strategyId: biasSource.id,
      entryStyleId: entryStyle?.id ?? "weekly_hold",
      summary,
      simulation,
    });
    if (weekPath) {
      realizedWeekPaths.push(weekPath);
    }
    cardSlots.forEach((slotId, slotIndex) => {
      const slotPath = reconstructWeekPathResultFromSeries({
        weekOpenUtc: weekResult.weekOpenUtc,
        strategyId: biasSource.id,
        entryStyleId: entryStyle?.id ?? "weekly_hold",
        simulation,
        seriesId: slotId,
      });
      if (slotPath) {
        realizedSlotPaths[slotIndex]?.push(slotPath);
      }
    });
    ASSET_PATH_ORDER.forEach((assetId, assetIndex) => {
      const assetPath = reconstructWeekPathResultFromSeries({
        weekOpenUtc: weekResult.weekOpenUtc,
        strategyId: biasSource.id,
        entryStyleId: entryStyle?.id ?? "weekly_hold",
        simulation,
        seriesId: `asset:${assetId}`,
      });
      if (assetPath) {
        realizedAssetPaths[assetIndex]?.push(assetPath);
      }
    });
  }

  if (realizedWeekPaths.length > 0) {
    const multiWeekPath = computeMultiWeekBasketPath(realizedWeekPaths);
    const slotMultiWeekPaths = realizedSlotPaths.map((slotWeekPaths) =>
      computeMultiWeekBasketPath(slotWeekPaths),
    );
    const assetMultiWeekPaths = realizedAssetPaths.map((assetWeekPaths) =>
      computeMultiWeekBasketPath(assetWeekPaths),
    );
    pathSummaryMap.all = multiWeekPath.summary;
    simMap.all = multiWeekPathToSimulation(
      multiWeekPath,
      multiWeekResult,
      biasSource,
      selectionLabel,
      slotMultiWeekPaths,
      assetMultiWeekPaths,
    );
  } else {
    pathSummaryMap.all = {
      totalReturnPct: multiWeekResult.totalReturnPct,
      peakPct: multiWeekResult.totalReturnPct,
      troughPct: Math.min(0, multiWeekResult.totalReturnPct),
      maxDrawdownPct: multiWeekResult.maxDrawdownPct,
      peakToCloseGivebackPct: 0,
      troughToCloseRecoveryPct: multiWeekResult.totalReturnPct - Math.min(0, multiWeekResult.totalReturnPct),
      maxActivePositions: Math.max(...multiWeekResult.weeks.map((week) => week.tradeCount), 0),
    };
    simMap.all = multiWeekToSimulation(multiWeekResult, biasSource, selectionLabel);
  }

  return assembleStrategyPageData({
    biasSource,
    currentWeekOpenUtc,
    entryStyle,
    riskOverlay,
    weekOptions,
    weekResultsByWeek,
    simMap,
    pathSummaryMap,
  });
}

function buildMultiWeekResultFromWeeks(
  biasSource: BiasSourceConfig,
  weeks: WeeklyHoldResult[],
): MultiWeekResult {
  const realizedWeeks = sortWeeklyResultsChronologically(
    weeks.filter((week) => week.isRealized),
  );
  const totalReturn = realizedWeeks.reduce((sum, week) => sum + week.totalReturnPct, 0);
  const totalTrades = realizedWeeks.reduce((sum, week) => sum + week.tradeCount, 0);
  const totalWins = realizedWeeks.reduce((sum, week) => sum + week.winCount, 0);

  const maxDrawdownPct = computeMaxDrawdownFromPercentReturns(
    realizedWeeks.map((week) => week.totalReturnPct),
  );

  const byAssetClass: Record<string, { returnPct: number; trades: number; wins: number }> = {};
  for (const week of realizedWeeks) {
    for (const trade of week.trades) {
      if (!byAssetClass[trade.assetClass]) {
        byAssetClass[trade.assetClass] = { returnPct: 0, trades: 0, wins: 0 };
      }
      byAssetClass[trade.assetClass]!.returnPct += trade.returnPct;
      byAssetClass[trade.assetClass]!.trades += 1;
      if (trade.returnPct > 0) {
        byAssetClass[trade.assetClass]!.wins += 1;
      }
    }
  }

  return {
    biasSourceId: biasSource.id,
    weeks: realizedWeeks,
    totalReturnPct: totalReturn,
    totalTrades,
    totalWins,
    winRate: totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0,
    maxDrawdownPct,
    byAssetClass,
  };
}

function sortWeeklyResultsChronologically(weeks: WeeklyHoldResult[]) {
  return [...weeks].sort(
    (left, right) => Date.parse(left.weekOpenUtc) - Date.parse(right.weekOpenUtc),
  );
}

function weekDisplayLabel(weekOpenUtc: string): string {
  try {
    const d = new Date(weekOpenUtc);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return weekOpenUtc.split("T")[0] ?? weekOpenUtc;
  }
}
