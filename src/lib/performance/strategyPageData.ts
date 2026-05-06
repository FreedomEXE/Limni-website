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
  computeMultiWeekHold,
  computeWeeklyHold,
  type MultiWeekResult,
  type WeeklyHoldResult,
} from "@/lib/performance/weeklyHoldEngine";
import {
  persistStrategyArtifactEntry,
  readStrategyArtifactEntry,
  type StrategyArtifactFingerprint,
} from "@/lib/performance/strategyArtifactCache";
import { SELECTOR_ENGINE_VERSION } from "@/lib/performance/selectorEngine";
import { buildStrategySelectionKey } from "@/lib/performance/strategySelection";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import { buildDataWeekOptions } from "@/lib/weekOptions";
import { loadPathBars } from "@/lib/performance/pathBarLoader";
import { buildWeeklyHoldLedger, splitLedgerBySlot } from "@/lib/performance/positionLedger";
import {
  computeBasketPath,
  computeMultiWeekBasketPath,
  type BasketPathResult,
  type BasketPathSummary,
} from "@/lib/performance/basketPathEngine";
import { CANONICAL_PATH_RESOLUTION } from "@/lib/performance/pathResolution";

const STRATEGY_ARTIFACT_ENGINE_VERSION =
  process.env.STRATEGY_ARTIFACT_ENGINE_VERSION?.trim() || "strategy-artifact-v22";

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
  const subLedgers = splitLedgerBySlot(ledger, slotFn, cardSlots.length);
  const path = computeBasketPath(ledger, bars);
  const slotPaths = subLedgers.map((subLedger) => computeBasketPath(subLedger, bars));
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

function assembleStrategyPageData(options: {
  biasSource: BiasSourceConfig;
  currentWeekOpenUtc: string;
  entryStyle: EntryStyleConfig | undefined;
  riskOverlay: StrengthGateConfig | undefined;
  weekOptions: string[];
  weekResultsByWeek: Record<string, WeeklyHoldResult>;
  simMap: Record<string, EngineSimulationGroup>;
  pathSummaryMap: Record<string, BasketPathSummary>;
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
  };
}

export async function loadStrategyPageData(
  selection: StrategySelection,
): Promise<StrategyPageData | null> {
  const selectionKey = buildStrategySelectionKey(selection);
  const biasSource = getStrategy(selection.strategyId);
  if (!biasSource) return null;

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
    const currentWeekResultPromise = hasCurrentWeek
      ? computeWeeklyHold(biasSource, currentWeekOpenUtc, entryStyle, riskOverlay)
      : Promise.resolve(null);
    const fingerprint = await buildStrategyFingerprint({
      currentWeekOpenUtc,
      entryStyle,
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

        await persistStrategyArtifactEntry(selectionKey, {
          cachedAtUtc: new Date().toISOString(),
          fingerprint,
          payload: artifactPayload,
        });

        const currentWeekResult = await currentWeekResultPromise;
        if (currentWeekResult) {
          nextWeekResults[currentWeekOpenUtc] = currentWeekResult;
        }

        const merged = await mergeCurrentWeekIntoCachedPathData({
          currentWeekResult,
          cachedSimMap: { ...artifactPayload.simMap },
          cachedPathSummaryMap: { ...artifactPayload.pathSummaryMap },
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
        });
      }

      const currentWeekResult = await currentWeekResultPromise;
      if (currentWeekResult) {
        nextWeekResults[currentWeekOpenUtc] = currentWeekResult;
      }

      const merged = await mergeCurrentWeekIntoCachedPathData({
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
      });
    }

    const multiWeekResult = await computeMultiWeekHold(biasSource, cachedWeeks, entryStyle, riskOverlay);
    const weekResultsByWeek = Object.fromEntries(
      multiWeekResult.weeks.map((weekResult) => [weekResult.weekOpenUtc, weekResult] as const),
    );

    const missingWeeks = cachedWeeks.filter((week) => !(week in weekResultsByWeek));
    if (missingWeeks.length > 0) {
      await patchWeekResults({
        biasSource,
        entryStyle,
        riskOverlay,
        selectionKey,
        targetWeeks: missingWeeks,
        weekResultsByWeek,
      });
    }

    const artifactPayload = await buildStrategyPageDataFromWeekResults({
      biasSource,
      currentWeekOpenUtc,
      entryStyle,
      riskOverlay,
      weekOptions: cachedWeeks,
      weekResultsByWeek,
    });

    await persistStrategyArtifactEntry(selectionKey, {
      cachedAtUtc: new Date().toISOString(),
      fingerprint,
      payload: artifactPayload,
    });

    const currentWeekResult = await currentWeekResultPromise;
    if (currentWeekResult) {
      weekResultsByWeek[currentWeekOpenUtc] = currentWeekResult;
    }

    const merged = await mergeCurrentWeekIntoCachedPathData({
      currentWeekResult,
      cachedSimMap: { ...artifactPayload.simMap },
      cachedPathSummaryMap: { ...artifactPayload.pathSummaryMap },
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
    const computed = await computeWeekPathArtifact({
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
}): Promise<StrategyArtifactFingerprint> {
  const { weekOptions, currentWeekOpenUtc, entryStyle } = options;
  return {
    engineVersion: `${STRATEGY_ARTIFACT_ENGINE_VERSION}:${SELECTOR_ENGINE_VERSION}`,
    currentWeekOpenUtc,
    weekOptionsSignature: buildWeekOptionsSignature(weekOptions),
    weekFingerprints: await readWeekFingerprints(weekOptions, entryStyle),
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
      maxDrawdownPct: Math.abs(multiWeekResult.maxDrawdownPct),
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

function buildMultiWeekResultFromWeeks(
  biasSource: BiasSourceConfig,
  weeks: WeeklyHoldResult[],
): MultiWeekResult {
  const realizedWeeks = weeks.filter((week) => week.isRealized);
  const totalReturn = realizedWeeks.reduce((sum, week) => sum + week.totalReturnPct, 0);
  const totalTrades = realizedWeeks.reduce((sum, week) => sum + week.tradeCount, 0);
  const totalWins = realizedWeeks.reduce((sum, week) => sum + week.winCount, 0);

  let peak = 0;
  let cumulative = 0;
  let maxDrawdown = 0;
  for (const week of realizedWeeks) {
    cumulative += week.totalReturnPct;
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.min(maxDrawdown, cumulative - peak);
  }

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
    maxDrawdownPct: maxDrawdown,
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
