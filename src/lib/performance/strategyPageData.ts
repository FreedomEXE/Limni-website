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
  multiWeekToSimulation,
  singleWeekToSimulation,
  weeklyHoldToGridProps,
  weeklyHoldToSidebarStats,
  type EngineGridProps,
  type EngineSidebarStats,
  type EngineSimulationGroup,
} from "@/lib/performance/engineAdapter";
import {
  getEntryStyle,
  getStrategy,
  getStrengthGate,
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
import { buildStrategySelectionKey } from "@/lib/performance/strategySelection";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import { buildDataWeekOptions } from "@/lib/weekOptions";

const STRATEGY_ARTIFACT_ENGINE_VERSION =
  process.env.STRATEGY_ARTIFACT_ENGINE_VERSION?.trim() || "strategy-artifact-v7";

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
  max_created_at: string | null;
  max_timestamp_utc: string | null;
};

type AdrTradeWatermarkRow = {
  week_open_utc: string;
  max_created_at: string | null;
  max_entry_time_utc: string | null;
  trade_count: number;
};

type StrengthWatermarkRow = {
  week_open_utc: string;
  max_snapshot_time_utc: string | null;
};

export type StrategySelection = {
  strategyId: string;
  f1: string;
  f2: string;
};

export type StrategyPageData = {
  weekMap: Record<string, EngineGridProps>;
  simMap: Record<string, EngineSimulationGroup>;
  multiWeekResult: MultiWeekResult;
  weekResults: Record<string, WeeklyHoldResult>;
  sidebarStats: EngineSidebarStats;
  biasSource: BiasSourceConfig;
  entryStyle: EntryStyleConfig | undefined;
  strengthGate: StrengthGateConfig | undefined;
  weekOptions: string[];
  currentWeekOpenUtc: string;
};

export async function loadStrategyPageData(
  selection: StrategySelection,
): Promise<StrategyPageData | null> {
  const biasSource = getStrategy(selection.strategyId);
  if (!biasSource) return null;

  const entryStyle = getEntryStyle(selection.f1);
  const strengthGate = getStrengthGate(selection.f2);

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
      ? computeWeeklyHold(biasSource, currentWeekOpenUtc, entryStyle, strengthGate)
      : Promise.resolve(null);
    const fingerprint = await buildStrategyFingerprint({
      currentWeekOpenUtc,
      entryStyle,
      strengthGate,
      weekOptions: cachedWeeks,
    });

    const cacheKey = buildStrategySelectionKey(selection);
    const cached = await readStrategyArtifactEntry<StrategyPageData>(cacheKey);

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
            strengthGate,
            targetWeeks: weeksToRefresh,
            weekResultsByWeek: nextWeekResults,
          });
        }

        const artifactPayload = buildStrategyPageDataFromWeekResults({
          biasSource,
          currentWeekOpenUtc,
          entryStyle,
          strengthGate,
          weekOptions: cachedWeeks,
          weekResultsByWeek: nextWeekResults,
        });

        await persistStrategyArtifactEntry(cacheKey, {
          cachedAtUtc: new Date().toISOString(),
          fingerprint,
          payload: artifactPayload,
        });
      }

      const currentWeekResult = await currentWeekResultPromise;
      if (currentWeekResult) {
        nextWeekResults[currentWeekOpenUtc] = currentWeekResult;
      }

      return buildStrategyPageDataFromWeekResults({
        biasSource,
        currentWeekOpenUtc,
        entryStyle,
        strengthGate,
        weekOptions,
        weekResultsByWeek: nextWeekResults,
      });
    }

    const multiWeekResult = await computeMultiWeekHold(biasSource, cachedWeeks, entryStyle, strengthGate);
    const weekResultsByWeek = Object.fromEntries(
      multiWeekResult.weeks.map((weekResult) => [weekResult.weekOpenUtc, weekResult] as const),
    );

    const missingWeeks = cachedWeeks.filter((week) => !(week in weekResultsByWeek));
    if (missingWeeks.length > 0) {
      await patchWeekResults({
        biasSource,
        entryStyle,
        strengthGate,
        targetWeeks: missingWeeks,
        weekResultsByWeek,
      });
    }

    const artifactPayload = buildStrategyPageDataFromWeekResults({
      biasSource,
      currentWeekOpenUtc,
      entryStyle,
      strengthGate,
      weekOptions: cachedWeeks,
      weekResultsByWeek,
    });

    await persistStrategyArtifactEntry(cacheKey, {
      cachedAtUtc: new Date().toISOString(),
      fingerprint,
      payload: artifactPayload,
    });

    const currentWeekResult = await currentWeekResultPromise;
    if (currentWeekResult) {
      weekResultsByWeek[currentWeekOpenUtc] = currentWeekResult;
    }

    return buildStrategyPageDataFromWeekResults({
      biasSource,
      currentWeekOpenUtc,
      entryStyle,
      strengthGate,
      weekOptions,
      weekResultsByWeek,
    });
  } catch (err) {
    console.error("[strategyPageData] Failed to load:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function buildStrategyFingerprint(options: {
  weekOptions: string[];
  currentWeekOpenUtc: string;
  entryStyle: EntryStyleConfig | undefined;
  strengthGate: StrengthGateConfig | undefined;
}): Promise<StrategyArtifactFingerprint> {
  const { weekOptions, currentWeekOpenUtc, entryStyle, strengthGate } = options;
  return {
    engineVersion: STRATEGY_ARTIFACT_ENGINE_VERSION,
    currentWeekOpenUtc,
    weekOptionsSignature: buildWeekOptionsSignature(weekOptions),
    weekFingerprints: await readWeekFingerprints(weekOptions, entryStyle, strengthGate),
  };
}

async function readWeekFingerprints(
  weekOptions: string[],
  entryStyle: EntryStyleConfig | undefined,
  strengthGate: StrengthGateConfig | undefined,
): Promise<Record<string, string>> {
  if (weekOptions.length === 0) return {};

  const uniqueReportDates = Array.from(new Set(weekOptions.map((week) => deriveCotReportDate(week))));

  const [pairRows, cotRows, sentimentRows, adrRunRow, strengthRows] = await Promise.all([
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
       )
       SELECT requested.week_open_utc::text AS week_open_utc,
              MAX(sa.created_at)::text AS max_created_at,
              MAX(sa.timestamp_utc)::text AS max_timestamp_utc
         FROM requested
         LEFT JOIN sentiment_aggregates sa
           ON sa.timestamp_utc >= requested.week_open_utc
          AND sa.timestamp_utc < requested.week_open_utc + INTERVAL '7 days'
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
    strengthGate?.id === "strength_gate"
      ? query<StrengthWatermarkRow>(
          `WITH requested AS (
             SELECT unnest($1::timestamptz[]) AS week_open_utc
           ),
           currency_marks AS (
             SELECT requested.week_open_utc,
                    MAX(css.snapshot_time_utc) AS max_snapshot_time_utc
               FROM requested
               LEFT JOIN currency_strength_snapshots css
                 ON css.snapshot_time_utc <= requested.week_open_utc
                AND css."window" IN ('1h', '4h', '24h')
              GROUP BY requested.week_open_utc
           ),
           asset_marks AS (
             SELECT requested.week_open_utc,
                    MAX(ass.snapshot_time_utc) AS max_snapshot_time_utc
               FROM requested
               LEFT JOIN asset_strength_snapshots ass
                 ON ass.snapshot_time_utc <= requested.week_open_utc
                AND ass."window" IN ('1h', '4h', '24h')
              GROUP BY requested.week_open_utc
           )
           SELECT requested.week_open_utc::text AS week_open_utc,
                  GREATEST(
                    currency_marks.max_snapshot_time_utc,
                    asset_marks.max_snapshot_time_utc
                  )::text AS max_snapshot_time_utc
             FROM requested
             LEFT JOIN currency_marks
               ON currency_marks.week_open_utc = requested.week_open_utc
             LEFT JOIN asset_marks
               ON asset_marks.week_open_utc = requested.week_open_utc`,
          [weekOptions],
        )
      : Promise.resolve([]),
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
  const adrByWeek = new Map(
    adrTradeRows.map((row) => [row.week_open_utc, row]),
  );
  const strengthByWeek = new Map(
    strengthRows.map((row) => [row.week_open_utc, row]),
  );

  const fingerprints: Record<string, string> = {};
  for (const weekOpenUtc of weekOptions) {
    const pairRow = pairByWeek.get(weekOpenUtc);
    const reportDate = deriveCotReportDate(weekOpenUtc);
    const cotRow = cotByReportDate.get(reportDate);
    const sentimentRow = sentimentByWeek.get(weekOpenUtc);
    const adrRow = adrByWeek.get(weekOpenUtc);
    const strengthRow = strengthByWeek.get(weekOpenUtc);

    fingerprints[weekOpenUtc] = [
      `pair:${normalizeStamp(pairRow?.max_updated_at)}`,
      `pairv:${normalizeStamp(pairRow?.derivation_versions)}`,
      `cot:${reportDate}:${normalizeStamp(cotRow?.max_fetched_at)}`,
      `sentc:${normalizeStamp(sentimentRow?.max_created_at)}`,
      `sentt:${normalizeStamp(sentimentRow?.max_timestamp_utc)}`,
      `adr-run:${normalizeStamp(adrRunRow?.updated_at)}`,
      `adr:${normalizeStamp(adrRow?.max_created_at)}:${normalizeStamp(adrRow?.max_entry_time_utc)}:${adrRow?.trade_count ?? 0}`,
      `strength:${normalizeStamp(strengthRow?.max_snapshot_time_utc)}`,
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
  strengthGate: StrengthGateConfig | undefined;
  targetWeeks: string[];
  weekResultsByWeek: Record<string, WeeklyHoldResult>;
}) {
  const { biasSource, entryStyle, strengthGate, targetWeeks, weekResultsByWeek } = options;
  const recomputed = await Promise.allSettled(
    targetWeeks.map((weekOpenUtc) => computeWeeklyHold(biasSource, weekOpenUtc, entryStyle, strengthGate)),
  );

  recomputed.forEach((result, index) => {
    const targetWeek = targetWeeks[index];
    if (!targetWeek) return;
    if (result.status === "fulfilled") {
      weekResultsByWeek[targetWeek] = result.value;
      return;
    }
    console.warn(
      `[strategyPageData] Failed to refresh ${targetWeek}:`,
      result.reason instanceof Error ? result.reason.message : result.reason,
    );
  });
}

function buildStrategyPageDataFromWeekResults(options: {
  biasSource: BiasSourceConfig;
  currentWeekOpenUtc: string;
  entryStyle: EntryStyleConfig | undefined;
  strengthGate: StrengthGateConfig | undefined;
  weekOptions: string[];
  weekResultsByWeek: Record<string, WeeklyHoldResult>;
}): StrategyPageData {
  const { biasSource, currentWeekOpenUtc, entryStyle, strengthGate, weekOptions, weekResultsByWeek } = options;
  const selectionLabel = [
    entryStyle?.label ?? "Weekly Hold",
    strengthGate?.id && strengthGate.id !== "none" ? strengthGate.label : null,
  ].filter(Boolean).join(" · ");
  const orderedWeeks = weekOptions
    .map((weekOpenUtc) => weekResultsByWeek[weekOpenUtc])
    .filter((weekResult): weekResult is WeeklyHoldResult => Boolean(weekResult));

  const multiWeekResult = buildMultiWeekResultFromWeeks(biasSource, orderedWeeks);
  const weekMap: Record<string, EngineGridProps> = {};
  const simMap: Record<string, EngineSimulationGroup> = {};
  const nextWeekResults: Record<string, WeeklyHoldResult> = {};

  for (const weekResult of orderedWeeks) {
    const label = weekDisplayLabel(weekResult.weekOpenUtc);
    weekMap[weekResult.weekOpenUtc] = weeklyHoldToGridProps(weekResult, biasSource, label, selectionLabel);
    simMap[weekResult.weekOpenUtc] = singleWeekToSimulation(weekResult, biasSource, label, selectionLabel);
    nextWeekResults[weekResult.weekOpenUtc] = weekResult;
  }

  weekMap.all = multiWeekToGridProps(multiWeekResult, biasSource, selectionLabel);
  simMap.all = multiWeekToSimulation(multiWeekResult, biasSource, selectionLabel);

  const currentWeekResult =
    nextWeekResults[currentWeekOpenUtc] ??
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
    simMap,
    multiWeekResult,
    weekResults: nextWeekResults,
    sidebarStats: weeklyHoldToSidebarStats(currentWeekResult, biasSource, multiWeekResult),
    biasSource,
    entryStyle,
    strengthGate,
    weekOptions,
    currentWeekOpenUtc,
  };
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
