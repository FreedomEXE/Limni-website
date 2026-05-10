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

import { query, queryOne } from "@/lib/db";
import { deriveCotReportDate, listDataSectionWeeks } from "@/lib/dataSectionWeeks";
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
  type EngineSidebarStats,
  type EngineSimulationGroup,
} from "@/lib/performance/engineAdapter";
import {
  getEntryStyle,
  getStrengthGate,
  getStrategy,
  type EntryStyleConfig,
  type BiasSourceConfig,
  type StrengthGateConfig,
} from "@/lib/performance/strategyConfig";
import {
  computeWeeklyHold,
  type MultiWeekResult,
  type WeeklyHoldResult,
} from "@/lib/performance/weeklyHoldEngine";
import {
  persistStrategyArtifactEntry,
  readStrategyArtifactEntry,
  type StrategyArtifactFingerprint,
} from "@/lib/performance/strategyArtifactCache";
import {
  listReadyWeekShards,
  persistWeekShard,
  readWeekShards,
  type WeekShardEntry,
} from "@/lib/performance/strategyWeekShardCache";
import {
  buildStrategyArtifactEngineVersion,
  buildStrategyAssemblyVersion,
  buildStrategyRuntimeVersionKey,
} from "@/lib/performance/strategyArtifactVersions";
import { buildStrategySelectionKey } from "@/lib/performance/strategySelection";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import { buildDataWeekOptions } from "@/lib/weekOptions";
import { loadPathBars } from "@/lib/performance/pathBarLoader";
import { getOrSetRuntimeCache } from "@/lib/runtimeCache";
import { buildWeeklyHoldLedger } from "@/lib/performance/positionLedger";
import {
  computeBasketPathWithSlots,
  computeMultiWeekBasketPath,
  type BasketPathResult,
  type BasketPathSummary,
} from "@/lib/performance/basketPathEngine";
import { CANONICAL_PATH_RESOLUTION } from "@/lib/performance/pathResolution";
import { computeMaxDrawdownFromPercentReturns } from "@/lib/performance/drawdown";

const STRATEGY_CURRENT_WEEK_CACHE_TTL_MS = Number(
  process.env.STRATEGY_CURRENT_WEEK_CACHE_TTL_MS ?? "300000",
);
const STRATEGY_FINGERPRINT_CACHE_TTL_MS = Number(
  process.env.STRATEGY_FINGERPRINT_CACHE_TTL_MS ?? "60000",
);
const STRATEGY_SHARD_BUILD_TIME_BUDGET_MS = Number(
  process.env.STRATEGY_SHARD_BUILD_TIME_BUDGET_MS ?? "100000",
);

function getCurrentWeekCacheTtlMs() {
  if (
    Number.isFinite(STRATEGY_CURRENT_WEEK_CACHE_TTL_MS)
    && STRATEGY_CURRENT_WEEK_CACHE_TTL_MS >= 0
  ) {
    return Math.floor(STRATEGY_CURRENT_WEEK_CACHE_TTL_MS);
  }
  return 300000;
}

function getFingerprintCacheTtlMs() {
  if (
    Number.isFinite(STRATEGY_FINGERPRINT_CACHE_TTL_MS)
    && STRATEGY_FINGERPRINT_CACHE_TTL_MS >= 0
  ) {
    return Math.floor(STRATEGY_FINGERPRINT_CACHE_TTL_MS);
  }
  return 60000;
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

type WeekWatermarkRow = {
  week_open_utc: string;
  max_updated_at: string | null;
  derivation_versions: string | null;
};

type CotWatermarkRow = {
  report_date: string;
  max_fetched_at: string | null;
};

type SentimentWatermarkRow = {
  week_open_utc: string;
  resolver_max_created_at: string | null;
  resolver_max_timestamp_utc: string | null;
  latest_created_at: string | null;
  latest_timestamp_utc: string | null;
};

type AdrTradeWatermarkRow = {
  week_open_utc: string;
  max_created_at: string | null;
  max_entry_time_utc: string | null;
  trade_count: number;
};

type StrengthWatermarkRow = {
  week_open_utc: string;
  max_locked_at: string | null;
  row_count: number;
};

function buildSelectionLabel(
  entryStyle: EntryStyleConfig | undefined,
  riskOverlay: StrengthGateConfig | undefined,
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
  };
};

type LoadStrategyPageDataOptions = {
  includeCurrentWeek?: boolean;
};

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
  return {
    weekKey: weekResult.weekOpenUtc,
    path,
    slotPaths,
    sim: singleWeekPathToSimulation(
      path,
      weekResult,
      biasSource,
      label,
      selectionLabel,
      slotPaths,
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
  riskOverlay: StrengthGateConfig | undefined;
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
      peakPct: 0,
      drawdownPct: 0,
      activePositions: summary.maxActivePositions,
    })),
    summary,
  } satisfies BasketPathResult;
}

function summarizeSimulationPoints(points: Array<{ ts_utc: string; equity_pct: number }>): BasketPathSummary {
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
  for (const point of points) {
    const equityPct = point.equity_pct;
    peakPct = Math.max(peakPct, equityPct);
    troughPct = Math.min(troughPct, equityPct);
    runningPeak = Math.max(runningPeak, equityPct);
    maxDrawdownPct = Math.max(maxDrawdownPct, runningPeak - equityPct);
  }
  const totalReturnPct = points[points.length - 1]?.equity_pct ?? 0;

  return {
    totalReturnPct,
    peakPct,
    troughPct,
    maxDrawdownPct,
    peakToCloseGivebackPct: peakPct - totalReturnPct,
    troughToCloseRecoveryPct: totalReturnPct - troughPct,
    maxActivePositions: 0,
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
      return {
        tsUtc: point.ts_utc,
        equityPct: point.equity_pct,
        peakPct: runningPeakPct,
        drawdownPct: point.equity_pct - runningPeakPct,
        activePositions: 0,
      };
    }),
    summary,
  } satisfies BasketPathResult;
}

function assembleStrategyPageData(options: {
  biasSource: BiasSourceConfig;
  currentWeekOpenUtc: string;
  entryStyle: EntryStyleConfig | undefined;
  riskOverlay: StrengthGateConfig | undefined;
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
    weekMap[weekResult.weekOpenUtc] = weeklyHoldToGridProps(weekResult, biasSource, label, selectionLabel);
    if (enrichedSimMap[weekResult.weekOpenUtc]) {
      enrichedSimMap[weekResult.weekOpenUtc] = withTradeDerivedSeriesGroups(
        enrichedSimMap[weekResult.weekOpenUtc],
        weekResult,
      );
    }
  }

  weekMap.all = multiWeekToGridProps(multiWeekResult, biasSource, selectionLabel);
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

function stripArtifactGridProps(grid: EngineGridProps): EngineGridProps {
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

function stripArtifactWeekResult(result: WeeklyHoldResult): WeeklyHoldResult {
  return {
    ...result,
    trades: result.trades.map((trade) => ({
      ...trade,
      detail: undefined,
    })),
  };
}

function stripStrategyPageDataForArtifact(data: StrategyPageData): StrategyPageData {
  return {
    ...data,
    weekMap: Object.fromEntries(
      Object.entries(data.weekMap).map(([week, grid]) => [week, stripArtifactGridProps(grid)]),
    ),
    weekResults: Object.fromEntries(
      Object.entries(data.weekResults).map(([week, result]) => [week, stripArtifactWeekResult(result)]),
    ),
  };
}

export async function loadStrategyPageData(
  selection: StrategySelection,
  options: LoadStrategyPageDataOptions = {},
): Promise<StrategyPageData | null> {
  const selectionKey = buildStrategySelectionKey(selection);
  const biasSource = getStrategy(selection.strategyId);
  if (!biasSource) return null;
  const includeCurrentWeek = options.includeCurrentWeek !== false;

  const entryStyle = getEntryStyle(selection.f1);
  const riskOverlay = getStrengthGate(selection.f2);

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const dataSectionWeeks = await listDataSectionWeeks();
  const weekOptions = buildDataWeekOptions({
    historicalWeeks: dataSectionWeeks,
    currentWeekOpenUtc,
  }) as string[];
  const cachedWeeks = weekOptions.filter((weekOpenUtc) => weekOpenUtc !== currentWeekOpenUtc);
  const hasCurrentWeek = weekOptions.includes(currentWeekOpenUtc);

  try {
    const loadCurrentWeekResult = () => (
      includeCurrentWeek && hasCurrentWeek
        ? computeCurrentWeekResultCached({
            selectionKey,
            biasSource,
            currentWeekOpenUtc,
            entryStyle,
            riskOverlay,
          })
        : Promise.resolve(null)
    );
    const fingerprint = await buildStrategyFingerprint({
      currentWeekOpenUtc,
      entryStyle,
      riskOverlay,
      weekOptions: cachedWeeks,
    });

    const cached = await readStrategyArtifactEntry<StrategyPageData>(selectionKey);

    if (cached && cached.fingerprint.engineVersion === fingerprint.engineVersion) {
      const changedWeeks = diffChangedWeeks(cached.fingerprint, fingerprint, cachedWeeks);
      const removedWeeks = Object.keys(cached.fingerprint.weekFingerprints)
        .filter((week) => !cachedWeeks.includes(week));
      const missingWeeks = cachedWeeks.filter((week) => !(week in cached.payload.weekResults));

      const nextWeekResults: Record<string, WeeklyHoldResult> = { ...cached.payload.weekResults };
      if (
        changedWeeks.length > 0 ||
        removedWeeks.length > 0 ||
        missingWeeks.length > 0 ||
        cached.fingerprint.currentWeekOpenUtc !== currentWeekOpenUtc ||
        cached.fingerprint.weekOptionsSignature !== fingerprint.weekOptionsSignature
      ) {
        for (const removedWeek of removedWeeks) {
          delete nextWeekResults[removedWeek];
        }

        const weeksToRefresh = Array.from(new Set([...changedWeeks, ...missingWeeks]));
        if (weeksToRefresh.length > 0) {
          await patchWeekResults({
            biasSource,
            entryStyle,
            riskOverlay,
            selectionKey,
            targetWeeks: weeksToRefresh,
            weekResultsByWeek: nextWeekResults,
          });
        }

        const artifactPayload = await buildStrategyPageDataFromWeekResults({
          biasSource,
          currentWeekOpenUtc,
          entryStyle,
          riskOverlay,
          weekOptions: cachedWeeks,
          weekResultsByWeek: nextWeekResults,
        });

        const artifactToPersist = stripStrategyPageDataForArtifact(artifactPayload);
        const cachedAtUtc = new Date().toISOString();
        await persistStrategyArtifactEntry(selectionKey, {
          cachedAtUtc,
          fingerprint,
          payload: artifactToPersist,
        });

        if (!includeCurrentWeek) {
          return {
            ...artifactToPersist,
            artifactMeta: {
              status: "patched",
              selectionKey,
              cachedAtUtc,
              refreshedWeeks: weeksToRefresh,
              removedWeeks,
              missingWeeks,
            },
          };
        }

        const currentWeekResult = await loadCurrentWeekResult();
        if (currentWeekResult) {
          nextWeekResults[currentWeekOpenUtc] = currentWeekResult;
        }

        const merged = await mergeCurrentWeekIntoCachedPathData({
          selectionKey,
          currentWeekResult,
          cachedSimMap: { ...artifactToPersist.simMap },
          cachedPathSummaryMap: { ...artifactToPersist.pathSummaryMap },
          cachedWeeks,
          biasSource,
          entryStyle,
          selectionLabel: buildSelectionLabel(entryStyle, riskOverlay),
          historicalWeekResults: nextWeekResults,
        });

        return assembleStrategyPageData({
          biasSource,
          currentWeekOpenUtc,
          entryStyle,
          riskOverlay,
          weekOptions,
          weekResultsByWeek: nextWeekResults,
          simMap: merged.simMap,
          pathSummaryMap: merged.pathSummaryMap,
          artifactMeta: {
            status: "patched",
            selectionKey,
            cachedAtUtc,
            refreshedWeeks: weeksToRefresh,
            removedWeeks,
            missingWeeks,
          },
        });
      }

      if (!includeCurrentWeek) {
        return {
          ...cached.payload,
          artifactMeta: {
            status: "hit",
            selectionKey,
            cachedAtUtc: cached.cachedAtUtc,
            refreshedWeeks: [],
            removedWeeks: [],
            missingWeeks: [],
          },
        };
      }

      const currentWeekResult = await loadCurrentWeekResult();
      if (currentWeekResult) {
        nextWeekResults[currentWeekOpenUtc] = currentWeekResult;
      }

      const merged = await mergeCurrentWeekIntoCachedPathData({
        selectionKey,
        currentWeekResult,
        cachedSimMap: { ...(cached.payload.simMap ?? {}) },
        cachedPathSummaryMap: { ...(cached.payload.pathSummaryMap ?? {}) },
        cachedWeeks,
        biasSource,
        entryStyle,
        selectionLabel: buildSelectionLabel(entryStyle, riskOverlay),
        historicalWeekResults: nextWeekResults,
      });

      return assembleStrategyPageData({
        biasSource,
        currentWeekOpenUtc,
        entryStyle,
        riskOverlay,
        weekOptions,
        weekResultsByWeek: nextWeekResults,
        simMap: merged.simMap,
        pathSummaryMap: merged.pathSummaryMap,
        artifactMeta: {
          status: "hit",
          selectionKey,
          cachedAtUtc: cached.cachedAtUtc,
          refreshedWeeks: [],
          removedWeeks: [],
          missingWeeks: [],
        },
      });
    }

    const artifactPayload = await buildStrategyPageDataFromWeekShards({
      selectionKey,
      fingerprint,
      biasSource,
      currentWeekOpenUtc,
      entryStyle,
      riskOverlay,
      weekOptions: cachedWeeks,
    });
    if (!artifactPayload) {
      return null;
    }

    const artifactToPersist = stripStrategyPageDataForArtifact(artifactPayload);
    const weekResultsByWeek = { ...artifactToPersist.weekResults };
    const missingWeeks = cachedWeeks.filter((week) => !(week in weekResultsByWeek));

    const cachedAtUtc = new Date().toISOString();
    try {
      await persistStrategyArtifactEntry(selectionKey, {
        cachedAtUtc,
        fingerprint,
        payload: artifactToPersist,
      });
    } catch (persistError) {
      console.warn(
        `[strategyPageData] Monolithic artifact persist failed for ${selectionKey}; shards will serve as fallback:`,
        persistError instanceof Error ? persistError.message : persistError,
      );
    }

    if (!includeCurrentWeek) {
      return {
        ...artifactToPersist,
        artifactMeta: {
          status: "miss",
          selectionKey,
          cachedAtUtc,
          refreshedWeeks: cachedWeeks,
          removedWeeks: [],
          missingWeeks,
        },
      };
    }

    const currentWeekResult = await loadCurrentWeekResult();
    if (currentWeekResult) {
      weekResultsByWeek[currentWeekOpenUtc] = currentWeekResult;
    }

    const merged = await mergeCurrentWeekIntoCachedPathData({
      selectionKey,
      currentWeekResult,
      cachedSimMap: { ...artifactToPersist.simMap },
      cachedPathSummaryMap: { ...artifactToPersist.pathSummaryMap },
      cachedWeeks,
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
      artifactMeta: {
        status: "miss",
        selectionKey,
        cachedAtUtc,
        refreshedWeeks: cachedWeeks,
        removedWeeks: [],
        missingWeeks,
      },
    });
  } catch (err) {
    console.error(
      `[strategyPageData] Failed to load ${selectionKey}:`,
      err instanceof Error ? err.stack ?? err.message : err,
    );
    return null;
  }
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
    }

    if (reconstructed.length > 0) {
      const allPath = computeMultiWeekBasketPath(reconstructed);
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
      );
    }
  }

  return {
    simMap: cachedSimMap,
    pathSummaryMap: cachedPathSummaryMap,
  };
}

async function buildStrategyFingerprint(options: {
  weekOptions: string[];
  currentWeekOpenUtc: string;
  entryStyle: EntryStyleConfig | undefined;
  riskOverlay: StrengthGateConfig | undefined;
}): Promise<StrategyArtifactFingerprint> {
  const { weekOptions, currentWeekOpenUtc, entryStyle, riskOverlay } = options;
  const engineVersion = buildStrategyAssemblyVersion({ entryStyle, riskOverlay });
  const fingerprintCacheKey = [
    "strategyFingerprint",
    engineVersion,
    currentWeekOpenUtc,
    entryStyle?.id ?? "weekly_hold",
    riskOverlay?.id ?? "none",
    buildWeekOptionsSignature(weekOptions),
  ].join(":");
  return {
    engineVersion,
    currentWeekOpenUtc,
    weekOptionsSignature: buildWeekOptionsSignature(weekOptions),
    weekFingerprints: await getOrSetRuntimeCache(
      fingerprintCacheKey,
      getFingerprintCacheTtlMs(),
      () => readWeekFingerprints(weekOptions, entryStyle),
    ),
  };
}

async function readWeekFingerprints(
  weekOptions: string[],
  entryStyle: EntryStyleConfig | undefined,
): Promise<Record<string, string>> {
  if (weekOptions.length === 0) return {};

  const uniqueReportDates = Array.from(new Set(weekOptions.map((week) => deriveCotReportDate(week))));

  const [pairRows, cotRows, sentimentRows, strengthRows, adrRunRow] = await Promise.all([
    query<WeekWatermarkRow>(
      `SELECT period_open_utc::text AS week_open_utc,
              MAX(updated_at)::text AS max_updated_at,
              STRING_AGG(DISTINCT derivation_version, ',' ORDER BY derivation_version) AS derivation_versions
         FROM pair_period_returns
        WHERE period_type = 'weekly'
          AND period_open_utc = ANY($1::timestamptz[])
        GROUP BY period_open_utc`,
      [weekOptions],
    ),
    query<CotWatermarkRow>(
      `SELECT report_date::text AS report_date,
              MAX(fetched_at)::text AS max_fetched_at
         FROM cot_snapshots
        WHERE report_date = ANY($1::date[])
        GROUP BY report_date`,
      [uniqueReportDates],
    ),
    query<SentimentWatermarkRow>(
      `WITH requested AS (
         SELECT unnest($1::timestamptz[]) AS week_open_utc
       ),
       latest AS (
         SELECT
           MAX(created_at)::text AS latest_created_at,
           MAX(timestamp_utc)::text AS latest_timestamp_utc
         FROM sentiment_aggregates
       )
       SELECT requested.week_open_utc::text AS week_open_utc,
              MAX(sa.created_at)::text AS resolver_max_created_at,
              MAX(sa.timestamp_utc)::text AS resolver_max_timestamp_utc,
              latest.latest_created_at,
              latest.latest_timestamp_utc
         FROM requested
         LEFT JOIN sentiment_aggregates sa
           ON sa.timestamp_utc >= requested.week_open_utc - INTERVAL '14 days'
          AND sa.timestamp_utc < requested.week_open_utc + INTERVAL '7 days'
        CROSS JOIN latest
        GROUP BY requested.week_open_utc, latest.latest_created_at, latest.latest_timestamp_utc`,
      [weekOptions],
    ),
    query<StrengthWatermarkRow>(
      `WITH requested AS (
         SELECT unnest($1::timestamptz[]) AS week_open_utc
       )
       SELECT requested.week_open_utc::text AS week_open_utc,
              MAX(sws.locked_at_utc)::text AS max_locked_at,
              COUNT(sws.*)::int AS row_count
         FROM requested
         LEFT JOIN strength_weekly_snapshots sws
           ON sws.week_open_utc = requested.week_open_utc
        GROUP BY requested.week_open_utc`,
      [weekOptions],
    ),
    entryStyle?.plModel === "adr"
      ? queryOne<{ id: string; updated_at: string | null }>(
          `SELECT id::text AS id, updated_at::text AS updated_at
             FROM strategy_backtest_runs
            WHERE bot_id = 'adr-forward'
              AND variant = 'fresh-start'
              AND market = 'multi-asset'
              AND config_key = 'default'
            LIMIT 1`,
          [],
        )
      : Promise.resolve(null),
  ]);

  const adrTradeRows = entryStyle?.plModel === "adr" && adrRunRow?.id
    ? await query<AdrTradeWatermarkRow>(
        `WITH requested AS (
           SELECT unnest($1::timestamptz[]) AS week_open_utc
         )
         SELECT requested.week_open_utc::text AS week_open_utc,
                MAX(t.created_at)::text AS max_created_at,
                MAX(t.entry_time_utc)::text AS max_entry_time_utc,
                COUNT(t.id)::int AS trade_count
           FROM requested
           LEFT JOIN strategy_backtest_trades t
             ON t.week_open_utc = requested.week_open_utc
            AND t.run_id = $2::bigint
          GROUP BY requested.week_open_utc`,
        [weekOptions, adrRunRow.id],
      )
    : [];

  const pairByWeek = new Map(
    pairRows.map((row) => [row.week_open_utc, row]),
  );
  const cotByReportDate = new Map(
    cotRows.map((row) => [row.report_date, row]),
  );
  const sentimentByWeek = new Map(
    sentimentRows.map((row) => [row.week_open_utc, row]),
  );
  const strengthByWeek = new Map(
    strengthRows.map((row) => [row.week_open_utc, row]),
  );
  const adrByWeek = new Map(
    adrTradeRows.map((row) => [row.week_open_utc, row]),
  );
  const fingerprints: Record<string, string> = {};
  for (const weekOpenUtc of weekOptions) {
    const pairRow = pairByWeek.get(weekOpenUtc);
    const reportDate = deriveCotReportDate(weekOpenUtc);
    const cotRow = cotByReportDate.get(reportDate);
    const sentimentRow = sentimentByWeek.get(weekOpenUtc);
    const strengthRow = strengthByWeek.get(weekOpenUtc);
    const adrRow = adrByWeek.get(weekOpenUtc);

    fingerprints[weekOpenUtc] = [
      `pair:${normalizeStamp(pairRow?.max_updated_at)}`,
      `pairv:${normalizeStamp(pairRow?.derivation_versions)}`,
      `cot:${reportDate}:${normalizeStamp(cotRow?.max_fetched_at)}`,
      `sentc:${normalizeStamp(sentimentRow?.resolver_max_created_at)}`,
      `sentt:${normalizeStamp(sentimentRow?.resolver_max_timestamp_utc)}`,
      `sentlc:${normalizeStamp(sentimentRow?.latest_created_at)}`,
      `sentlt:${normalizeStamp(sentimentRow?.latest_timestamp_utc)}`,
      `str:${normalizeStamp(strengthRow?.max_locked_at)}:${strengthRow?.row_count ?? 0}`,
      `adr-run:${normalizeStamp(adrRunRow?.updated_at)}`,
      `adr:${normalizeStamp(adrRow?.max_created_at)}:${normalizeStamp(adrRow?.max_entry_time_utc)}:${adrRow?.trade_count ?? 0}`,
    ].join("|");
  }

  return fingerprints;
}

function diffChangedWeeks(
  previous: StrategyArtifactFingerprint,
  current: StrategyArtifactFingerprint,
  weekOptions: string[],
) {
  return weekOptions.filter((week) => previous.weekFingerprints[week] !== current.weekFingerprints[week]);
}

async function patchWeekResults(options: {
  biasSource: BiasSourceConfig;
  entryStyle: EntryStyleConfig | undefined;
  riskOverlay: StrengthGateConfig | undefined;
  selectionKey: string;
  targetWeeks: string[];
  weekResultsByWeek: Record<string, WeeklyHoldResult>;
}) {
  const { biasSource, entryStyle, riskOverlay, selectionKey, targetWeeks, weekResultsByWeek } = options;
  const recomputed = await Promise.allSettled(
    targetWeeks.map((weekOpenUtc) => computeWeeklyHold(biasSource, weekOpenUtc, entryStyle, riskOverlay)),
  );

  recomputed.forEach((result, index) => {
    const targetWeek = targetWeeks[index];
    if (!targetWeek) return;
    if (result.status === "fulfilled") {
      weekResultsByWeek[targetWeek] = result.value;
      return;
    }
    console.warn(
      `[strategyPageData] Failed to refresh ${selectionKey} for ${targetWeek}:`,
      result.reason instanceof Error ? result.reason.stack ?? result.reason.message : result.reason,
    );
  });
}

async function buildSimulationMapFromWeekResults(options: {
  biasSource: BiasSourceConfig;
  entryStyle: EntryStyleConfig | undefined;
  selectionLabel: string;
  orderedWeeks: WeeklyHoldResult[];
  multiWeekResult: MultiWeekResult;
}) {
  const { biasSource, entryStyle, selectionLabel, orderedWeeks, multiWeekResult } = options;
  const simMap: Record<string, EngineSimulationGroup> = {};
  const pathSummaryMap: Record<string, BasketPathSummary> = {};
  const cardSlots = resolveCardSlots(biasSource);
  const realizedWeekPaths: BasketPathResult[] = [];
  const realizedSlotPaths: BasketPathResult[][] = Array.from(
    { length: cardSlots.length },
    () => [],
  );
  const weekPathResults: Array<{
    weekResult: WeeklyHoldResult;
    computed: Awaited<ReturnType<typeof computeWeekPathArtifact>> | null;
    error: unknown;
  }> = [];
  const chunkSize = 3;

  for (let index = 0; index < orderedWeeks.length; index += chunkSize) {
    const chunk = orderedWeeks.slice(index, index + chunkSize);
    const chunkResults = await Promise.all(
      chunk.map(async (weekResult) => {
        try {
          const computed = await computeWeekPathArtifact({
            weekResult,
            biasSource,
            entryStyle,
            selectionLabel,
          });
          return { weekResult, computed, error: null as unknown };
        } catch (error) {
          return { weekResult, computed: null, error };
        }
      }),
    );
    weekPathResults.push(...chunkResults);
  }

  for (const { weekResult, computed, error } of weekPathResults) {
    if (computed) {
      pathSummaryMap[computed.weekKey] = computed.summary;
      simMap[computed.weekKey] = computed.sim;
      if (weekResult.isRealized) {
        realizedWeekPaths.push(computed.path);
        computed.slotPaths.forEach((slotPath, slotIndex) => {
          realizedSlotPaths[slotIndex]?.push(slotPath);
        });
      }
      continue;
    }

    const label = weekDisplayLabel(weekResult.weekOpenUtc);
    console.warn(
      `[strategyPageData] Falling back to legacy simulation for ${biasSource.id} ${weekResult.weekOpenUtc}:`,
      error instanceof Error ? error.stack ?? error.message : error,
    );
    pathSummaryMap[weekResult.weekOpenUtc] = weekResultFallbackPathSummary(weekResult);
    simMap[weekResult.weekOpenUtc] = singleWeekToSimulation(
      weekResult,
      biasSource,
      label,
      selectionLabel,
    );
  }

  try {
    const multiWeekPath = computeMultiWeekBasketPath(realizedWeekPaths);
    const slotMultiWeekPaths = realizedSlotPaths.map((slotWeekPaths) =>
      computeMultiWeekBasketPath(slotWeekPaths),
    );
    pathSummaryMap.all = multiWeekPath.summary;
    simMap.all = multiWeekPathToSimulation(
      multiWeekPath,
      multiWeekResult,
      biasSource,
      selectionLabel,
      slotMultiWeekPaths,
    );
  } catch (error) {
    console.warn(
      `[strategyPageData] Falling back to legacy all-time simulation for ${biasSource.id}:`,
      error instanceof Error ? error.stack ?? error.message : error,
    );
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

  return { simMap, pathSummaryMap };
}

async function buildStrategyPageDataFromWeekResults(options: {
  biasSource: BiasSourceConfig;
  currentWeekOpenUtc: string;
  entryStyle: EntryStyleConfig | undefined;
  riskOverlay: StrengthGateConfig | undefined;
  weekOptions: string[];
  weekResultsByWeek: Record<string, WeeklyHoldResult>;
}): Promise<StrategyPageData> {
  const { biasSource, entryStyle, riskOverlay, weekOptions, weekResultsByWeek } = options;
  const selectionLabel = buildSelectionLabel(entryStyle, riskOverlay);
  const orderedWeeks = weekOptions
    .map((weekOpenUtc) => weekResultsByWeek[weekOpenUtc])
    .filter((weekResult): weekResult is WeeklyHoldResult => Boolean(weekResult));

  const multiWeekResult = buildMultiWeekResultFromWeeks(biasSource, orderedWeeks);
  const { simMap, pathSummaryMap } = await buildSimulationMapFromWeekResults({
    biasSource,
    entryStyle,
    selectionLabel,
    orderedWeeks,
    multiWeekResult,
  });

  return assembleStrategyPageData({
    ...options,
    simMap,
    pathSummaryMap,
  });
}

export function assembleStrategyPageDataFromShards(options: {
  biasSource: BiasSourceConfig;
  currentWeekOpenUtc: string;
  entryStyle: EntryStyleConfig | undefined;
  riskOverlay: StrengthGateConfig | undefined;
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
  }

  if (realizedWeekPaths.length > 0) {
    const multiWeekPath = computeMultiWeekBasketPath(realizedWeekPaths);
    const slotMultiWeekPaths = realizedSlotPaths.map((slotWeekPaths) =>
      computeMultiWeekBasketPath(slotWeekPaths),
    );
    pathSummaryMap.all = multiWeekPath.summary;
    simMap.all = multiWeekPathToSimulation(
      multiWeekPath,
      multiWeekResult,
      biasSource,
      selectionLabel,
      slotMultiWeekPaths,
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

async function buildStrategyPageDataFromWeekShards(options: {
  selectionKey: string;
  fingerprint: StrategyArtifactFingerprint;
  biasSource: BiasSourceConfig;
  currentWeekOpenUtc: string;
  entryStyle: EntryStyleConfig | undefined;
  riskOverlay: StrengthGateConfig | undefined;
  weekOptions: string[];
}): Promise<StrategyPageData | null> {
  const {
    selectionKey,
    fingerprint,
    biasSource,
    currentWeekOpenUtc,
    entryStyle,
    riskOverlay,
    weekOptions,
  } = options;
  const startedAt = Date.now();
  const timeBudgetMs = getShardBuildTimeBudgetMs();
  const selectionLabel = buildSelectionLabel(entryStyle, riskOverlay);
  const shardEngineVersion = buildStrategyArtifactEngineVersion({ entryStyle, riskOverlay });
  const shardStatus = await listReadyWeekShards(
    selectionKey,
    shardEngineVersion,
    fingerprint.weekFingerprints,
  );
  const readyShards = await readWeekShards(selectionKey, shardEngineVersion);
  const expectedWeekSet = new Set(weekOptions);
  const weekResultsByWeek: Record<string, WeeklyHoldResult> = {};
  const simMap: Record<string, EngineSimulationGroup> = {};
  const pathSummaryMap: Record<string, BasketPathSummary> = {};

  for (const shard of readyShards) {
    if (!expectedWeekSet.has(shard.weekOpenUtc)) continue;
    if (fingerprint.weekFingerprints[shard.weekOpenUtc] !== shard.weekFingerprint) continue;
    weekResultsByWeek[shard.weekOpenUtc] = shard.weekResult;
    simMap[shard.weekOpenUtc] = shard.sim;
    pathSummaryMap[shard.weekOpenUtc] = shard.pathSummary;
  }

  const weeksToCompute = Array.from(new Set([...shardStatus.missing, ...shardStatus.stale]))
    .filter((weekOpenUtc) => expectedWeekSet.has(weekOpenUtc))
    .sort((left, right) => weekOptions.indexOf(left) - weekOptions.indexOf(right));

  for (const weekOpenUtc of weeksToCompute) {
    if (Date.now() - startedAt > timeBudgetMs) {
      console.log(
        `[strategyPageData] Shard budget exhausted for ${selectionKey}: ${Object.keys(weekResultsByWeek).length}/${weekOptions.length} weeks ready`,
      );
      return null;
    }

    const weekResult = await computeWeeklyHold(biasSource, weekOpenUtc, entryStyle, riskOverlay);
    const pathArtifact = await computeWeekPathArtifact({
      weekResult,
      biasSource,
      entryStyle,
      selectionLabel,
    });
    weekResultsByWeek[weekOpenUtc] = weekResult;
    simMap[weekOpenUtc] = pathArtifact.sim;
    pathSummaryMap[weekOpenUtc] = pathArtifact.summary;

    await persistWeekShard({
      selectionKey,
      weekOpenUtc,
      engineVersion: shardEngineVersion,
      weekFingerprint: fingerprint.weekFingerprints[weekOpenUtc] ?? "",
      weekResult,
      pathSummary: pathArtifact.summary,
      sim: pathArtifact.sim,
      cachedAtUtc: new Date().toISOString(),
    });
  }

  const missingAfterBuild = weekOptions.filter((weekOpenUtc) => !weekResultsByWeek[weekOpenUtc]);
  if (missingAfterBuild.length > 0) {
    console.log(
      `[strategyPageData] Shards incomplete for ${selectionKey}: missing ${missingAfterBuild.length}/${weekOptions.length}`,
    );
    return null;
  }

  const shards = weekOptions
    .map((weekOpenUtc) => {
      const weekResult = weekResultsByWeek[weekOpenUtc];
      const sim = simMap[weekOpenUtc];
      const pathSummary = pathSummaryMap[weekOpenUtc];
      if (!weekResult || !sim || !pathSummary) return null;
      return {
        selectionKey,
        weekOpenUtc,
        engineVersion: shardEngineVersion,
        weekFingerprint: fingerprint.weekFingerprints[weekOpenUtc] ?? "",
        weekResult,
        pathSummary,
        sim,
        cachedAtUtc: new Date().toISOString(),
      } satisfies WeekShardEntry;
    })
    .filter((shard): shard is WeekShardEntry => Boolean(shard));

  return assembleStrategyPageDataFromShards({
    biasSource,
    currentWeekOpenUtc,
    entryStyle,
    riskOverlay,
    weekOptions,
    shards,
  });
}

function buildMultiWeekResultFromWeeks(
  biasSource: BiasSourceConfig,
  weeks: WeeklyHoldResult[],
): MultiWeekResult {
  const realizedWeeks = weeks.filter((week) => week.isRealized);
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

function buildWeekOptionsSignature(weekOptions: string[]) {
  return weekOptions.join("|");
}

function normalizeStamp(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "none";
}

function weekDisplayLabel(weekOpenUtc: string): string {
  try {
    const d = new Date(weekOpenUtc);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return weekOpenUtc.split("T")[0] ?? weekOpenUtc;
  }
}
