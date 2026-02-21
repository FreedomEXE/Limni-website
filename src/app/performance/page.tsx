import DashboardLayout from "@/components/DashboardLayout";
import PerformancePeriodSelector from "@/components/performance/PerformancePeriodSelector";
import PerformanceViewSection from "@/components/performance/PerformanceViewSection";
import { listAssetClasses } from "@/lib/cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import type { PairSnapshot } from "@/lib/cotTypes";
import { listSnapshotDates, readSnapshot } from "@/lib/cotStore";
import { getPairPerformance } from "@/lib/pricePerformance";
import { readMarketSnapshot } from "@/lib/priceStore";
import {
  buildAllTimePerformance,
} from "@/lib/performance/allTime";
import {
  PERFORMANCE_MODEL_LABELS,
  PERFORMANCE_SYSTEM_MODEL_MAP,
  resolvePerformanceSystem,
} from "@/lib/performance/modelConfig";
import {
  buildPerformanceWeekFlags,
  resolvePerformanceView,
  resolveSelectedPerformanceWeek,
} from "@/lib/performance/pageState";
import { combinePerformanceModelTotals } from "@/lib/performance/pageTotals";
import {
  isWeekOpenUtc,
  listPerformanceWeeks,
  readAllPerformanceSnapshots,
  readPerformanceSnapshotsByWeek,
  weekLabelFromOpen,
} from "@/lib/performanceSnapshots";
import { computeModelPerformance } from "@/lib/performanceLab";
import { getAggregatesForWeekStartWithBackfill } from "@/lib/sentiment/store";
import { formatDateET, formatDateTimeET, latestIso } from "@/lib/time";
import { simulateTrailingForGroupsFromRows } from "@/lib/universalBasket";
import { getCanonicalWeekOpenUtc, getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import { buildDataWeekOptions } from "@/lib/weekOptions";
import { DateTime } from "luxon";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PerformancePageProps = {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

function formatWeekOption(value: string) {
  return weekLabelFromOpen(value);
}

async function getPerformanceSentimentForWeek(weekOpenUtc: string) {
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const weekClose = weekOpen.isValid
    ? weekOpen.plus({ days: 7 }).toUTC().toISO()
    : null;
  if (!weekClose) {
    return [];
  }
  return getAggregatesForWeekStartWithBackfill(weekOpenUtc, weekClose);
}

function buildAllPairs(assetId: string): Record<string, PairSnapshot> {
  const pairDefs = PAIRS_BY_ASSET_CLASS[assetId as keyof typeof PAIRS_BY_ASSET_CLASS] ?? [];
  const pairs: Record<string, PairSnapshot> = {};
  for (const pair of pairDefs) {
    pairs[pair.pair] = {
      direction: "LONG",
      base_bias: "NEUTRAL",
      quote_bias: "NEUTRAL",
    };
  }
  return pairs;
}

const PERF_TRACE_ENABLED =
  process.env.PERF_TRACE_PERFORMANCE_PAGE === "1" || process.env.NODE_ENV !== "production";

function perfNowMs() {
  return Number(process.hrtime.bigint()) / 1_000_000;
}

function traceDuration(
  label: string,
  startMs: number,
  context?: Record<string, unknown>,
) {
  if (!PERF_TRACE_ENABLED) {
    return;
  }
  const durationMs = perfNowMs() - startMs;
  if (context) {
    console.info(`[performance-page] ${label} ${durationMs.toFixed(1)}ms`, context);
  } else {
    console.info(`[performance-page] ${label} ${durationMs.toFixed(1)}ms`);
  }
}

async function timed<T>(
  label: string,
  context: Record<string, unknown>,
  task: () => Promise<T>,
): Promise<T> {
  const startMs = perfNowMs();
  try {
    return await task();
  } finally {
    traceDuration(label, startMs, context);
  }
}

function timedSync<T>(
  label: string,
  context: Record<string, unknown>,
  task: () => T,
): T {
  const startMs = perfNowMs();
  try {
    return task();
  } finally {
    traceDuration(label, startMs, context);
  }
}

export default async function PerformancePage({ searchParams }: PerformancePageProps) {
  const pageStartMs = perfNowMs();
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const weekParam = resolvedSearchParams?.week;
  const weekParamValue = Array.isArray(weekParam) ? weekParam[0] : weekParam;
  const viewParam = resolvedSearchParams?.view;
  const viewParamValue = Array.isArray(viewParam) ? viewParam[0] : viewParam;
  const systemParam = resolvedSearchParams?.system;
  const systemParamValue = Array.isArray(systemParam) ? systemParam[0] : systemParam;

  const initialSystem = resolvePerformanceSystem(systemParamValue);
  const view = resolvePerformanceView(viewParamValue);
  const assetClasses = listAssetClasses();
  const models = PERFORMANCE_SYSTEM_MODEL_MAP.v1;

  const desiredWeeks = 5;
  let weekOptions: string[] = [];
  const displayWeekOpenUtc = getDisplayWeekOpenUtc();
  const tradingWeekOpenUtc = getCanonicalWeekOpenUtc();
  const currentWeekStart = DateTime.fromISO(tradingWeekOpenUtc, { zone: "utc" });

  let reportOptions: string[] = [];
  try {
    const recentWeeks = await timed(
      "listPerformanceWeeks",
      { desiredWeeks },
      () => listPerformanceWeeks(desiredWeeks),
    );
    weekOptions = buildDataWeekOptions({
      historicalWeeks: recentWeeks,
      currentWeekOpenUtc: displayWeekOpenUtc,
      includeAll: false,
      limit: desiredWeeks,
    }) as string[];
  } catch (error) {
    console.error(
      "Performance snapshot list failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (weekOptions.length === 0) {
    try {
      reportOptions = await timed(
        "fallback.listSnapshotDates",
        { assetClassCount: assetClasses.length },
        () =>
          Promise.all(assetClasses.map((asset) => listSnapshotDates(asset.id))).then((lists) => {
            if (lists.length === 0) {
              return [];
            }
            return lists.reduce((acc, list) => acc.filter((date) => list.includes(date)));
          }),
      );
    } catch (error) {
      console.error(
        "COT snapshot list failed:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  const weekSelectorOptions = weekOptions.length > 0 ? ["all", ...weekOptions] : weekOptions;
  const selectedWeek = resolveSelectedPerformanceWeek({
    weekParamValue,
    weekOptions: weekSelectorOptions,
    currentWeekOpenUtc: displayWeekOpenUtc,
  });

  if (selectedWeek === "all") {
    const branchStartMs = perfNowMs();
    let historyRows: Awaited<ReturnType<typeof readAllPerformanceSnapshots>> = [];
    try {
      historyRows = await timed(
        "all_time.readAllPerformanceSnapshots",
        { selectedWeek },
        () => readAllPerformanceSnapshots(),
      );
    } catch (error) {
      console.error(
        "Performance snapshot history failed:",
        error instanceof Error ? error.message : String(error),
      );
    }

    const nowUtc = DateTime.utc().toMillis();
    const currentWeekMillis = currentWeekStart.isValid
      ? currentWeekStart.toMillis()
      : nowUtc;
    const allTimePerformanceCombined = timedSync(
      "all_time.buildAllTimePerformance.combined",
      { rows: historyRows.length, modelCount: models.length },
      () => buildAllTimePerformance(
        historyRows,
        models,
        currentWeekMillis,
        nowUtc,
      ),
    );
    const allTimePerformanceByAsset = new Map<string, ReturnType<typeof buildAllTimePerformance>>();
    timedSync(
      "all_time.buildAllTimePerformance.per_asset",
      { rows: historyRows.length, assetClassCount: assetClasses.length },
      () => {
        assetClasses.forEach((asset) => {
          const rows = historyRows.filter((row) => row.asset_class === asset.id);
          allTimePerformanceByAsset.set(
            asset.id,
            buildAllTimePerformance(rows, models, currentWeekMillis, nowUtc),
          );
        });
      },
    );

    const perAsset = assetClasses.map((asset) => ({
      asset,
      results: allTimePerformanceByAsset.get(asset.id) ?? [],
    }));
    const anyPriced = allTimePerformanceCombined.some((result) => result.total > 0);
    traceDuration("branch.all_time.total", branchStartMs, {
      selectedWeek,
      anyPriced,
      historyRows: historyRows.length,
    });
    traceDuration("page.total", pageStartMs, {
      selectedWeek,
      branch: "all_time",
    });

    return (
      <DashboardLayout>
        <div className="space-y-8">
          <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-[var(--foreground)]">
                Performance
              </h1>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                Universal systems (V1/V2)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Last refresh Historical snapshots
              </span>
              {weekOptions.length > 0 ? (
                <PerformancePeriodSelector
                  mode="week"
                  options={weekSelectorOptions.map((option) => ({
                    value: option,
                    label: option === "all" ? "All time" : formatWeekOption(option),
                  }))}
                  selectedValue={selectedWeek ?? weekOptions[0]}
                />
              ) : (
                <div className="text-xs text-[color:var(--muted)]">
                  No weekly snapshots yet.
                </div>
              )}
            </div>
          </header>

          {!anyPriced ? (
            <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3 text-xs text-[var(--accent-strong)]">
              No historical performance snapshots yet.
            </div>
          ) : null}

          <PerformanceViewSection
            initialView={view}
            initialSystem={initialSystem}
            gridProps={{
              combined: {
                id: "combined",
                label: "Combined Basket",
                description: "All asset classes aggregated. All-time view.",
                models: allTimePerformanceCombined,
              },
              perAsset: perAsset.map((asset) => ({
                id: asset.asset.id,
                label: asset.asset.label,
                description: "Filter performance for this asset class.",
                models: asset.results,
              })),
              labels: PERFORMANCE_MODEL_LABELS,
              calibration: undefined,
              allTime: {
                combined: [],
                perAsset: {},
              },
              showAllTime: false,
            }}
          />
        </div>
      </DashboardLayout>
    );
  }

  const reportParam = resolvedSearchParams?.report;
  const selectedReport =
    typeof reportParam === "string" && reportOptions.includes(reportParam)
      ? reportParam
      : reportOptions[0] ?? null;

  const validWeek = selectedWeek && selectedWeek !== "all" ? isWeekOpenUtc(selectedWeek) : true;
  let weekSnapshots: Awaited<ReturnType<typeof readPerformanceSnapshotsByWeek>> = [];
  if (selectedWeek && selectedWeek !== "all") {
    try {
      weekSnapshots = await timed(
        "readPerformanceSnapshotsByWeek",
        { selectedWeek },
        () => readPerformanceSnapshotsByWeek(selectedWeek),
      );
    } catch (error) {
      console.error(
        "Performance snapshot load failed:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  const hasSnapshots = weekSnapshots.length > 0;
  const {
    isCurrentWeekSelected,
    isFutureWeekSelected,
    isHistoricalWeekSelected,
  } = buildPerformanceWeekFlags({
    selectedWeek,
    currentWeekOpenUtc: displayWeekOpenUtc,
    tradingWeekOpenUtc,
    hasSnapshots,
  });

  let latestPriceRefresh: string | null = null;
  try {
    const marketSnapshots = await timed(
      "readMarketSnapshot.all_assets",
      { selectedWeek: selectedWeek ?? null, assetClassCount: assetClasses.length },
      () => Promise.all(
        assetClasses.map((asset) =>
          readMarketSnapshot(selectedWeek ?? undefined, asset.id),
        ),
      ),
    );
    latestPriceRefresh = latestIso(
      marketSnapshots.map((snapshot) => snapshot?.last_refresh_utc),
    );
  } catch (error) {
    console.error(
      "Market snapshot load failed:",
      error instanceof Error ? error.message : String(error),
    );
  }

  let perAsset: Array<{
    asset: (typeof assetClasses)[number];
    results: Awaited<ReturnType<typeof computeModelPerformance>>[];
  }> = [];
  let totals: Array<Awaited<ReturnType<typeof computeModelPerformance>>> = [];
  let anyPriced = false;
  let branchLabel = "unknown";
  const branchStartMs = perfNowMs();

  if (isFutureWeekSelected) {
    branchLabel = "future_week";
    const snapshots = new Map<string, Awaited<ReturnType<typeof readSnapshot>>>();
    const sentimentForSelectedWeek = await timed(
      "future_week.getPerformanceSentimentForWeek",
      { selectedWeek: selectedWeek ?? displayWeekOpenUtc },
      () => getPerformanceSentimentForWeek(selectedWeek ?? displayWeekOpenUtc),
    );
    const snapshotResults = await timed(
      "future_week.readSnapshot.all_assets",
      { assetClassCount: assetClasses.length },
      () => Promise.all(
        assetClasses.map((asset) => readSnapshot({ assetClass: asset.id })),
      ),
    );
    snapshotResults.forEach((snapshot, index) => {
      snapshots.set(assetClasses[index].id, snapshot);
    });

    perAsset = await timed(
      "future_week.compute.per_asset",
      { assetClassCount: assetClasses.length, modelCount: models.length },
      () => Promise.all(
        assetClasses.map(async (asset) => {
          const snapshot = snapshots.get(asset.id);
          if (!snapshot) {
            return { asset, results: [] as Awaited<ReturnType<typeof computeModelPerformance>>[] };
          }
          const performance = await getPairPerformance(buildAllPairs(asset.id), {
            assetClass: asset.id,
            reportDate: snapshot.report_date,
            isLatestReport: false,
          });
          const results = await Promise.all(
            models.map((model) =>
              computeModelPerformance({
                model,
                assetClass: asset.id,
                snapshot,
                sentiment: sentimentForSelectedWeek,
                performance,
              }),
            ),
          );
          return { asset, results };
        }),
      ),
    );

    totals = timedSync(
      "future_week.combinePerformanceModelTotals",
      { assetClassCount: perAsset.length, modelCount: models.length },
      () => combinePerformanceModelTotals({
        models,
        perAsset: perAsset.map((asset) => ({ assetLabel: asset.asset.label, results: asset.results })),
      }),
    );
    anyPriced = totals.some((result) => result.priced > 0);
  } else if (hasSnapshots && isHistoricalWeekSelected) {
    branchLabel = "historical_week";
    const historicalWeekOpenUtc = selectedWeek as string;
    const groups = [
      ...models.map((model) => ({
        key: `combined:${model}`,
        rows: weekSnapshots.filter((row) => row.model === model),
      })),
      ...assetClasses.flatMap((asset) =>
        models.map((model) => ({
          key: `${asset.id}:${model}`,
          rows: weekSnapshots.filter(
            (row) => row.asset_class === asset.id && row.model === model,
          ),
        })),
      ),
    ];
    const trailingByGroup = await timed(
      "historical_week.simulateTrailingForGroupsFromRows",
      { selectedWeek: historicalWeekOpenUtc, groupCount: groups.length },
      () => simulateTrailingForGroupsFromRows({
        weekOpenUtc: historicalWeekOpenUtc,
        groups,
        trailStartPct: 10,
        trailOffsetPct: 5,
        timeframe: "M1",
      }),
    );

    const byAsset = timedSync(
      "historical_week.build.by_asset",
      { snapshotRows: weekSnapshots.length },
      () => {
        const grouped = new Map<string, Awaited<ReturnType<typeof computeModelPerformance>>[]>();
        weekSnapshots.forEach((snapshot) => {
          const modelLabel = snapshot.model;
          const entry = grouped.get(snapshot.asset_class) ?? [];
          entry.push({
            model: modelLabel,
            percent: snapshot.percent,
            priced: snapshot.priced,
            total: snapshot.total,
            note: snapshot.note,
            returns: snapshot.returns,
            pair_details: snapshot.pair_details,
            stats: snapshot.stats,
            trailing: trailingByGroup[`${snapshot.asset_class}:${snapshot.model}`],
          });
          grouped.set(snapshot.asset_class, entry);
        });
        return grouped;
      },
    );

    perAsset = assetClasses.map((asset) => ({
      asset,
      results: byAsset.get(asset.id) ?? [],
    }));

    totals = timedSync(
      "historical_week.combinePerformanceModelTotals",
      { assetClassCount: perAsset.length, modelCount: models.length },
      () => combinePerformanceModelTotals({
        models,
        perAsset: perAsset.map((asset) => ({ assetLabel: asset.asset.label, results: asset.results })),
        labelWithAsset: true,
        trailingByCombinedModel: trailingByGroup,
      }),
    );
    anyPriced = totals.some((result) => result.priced > 0);
  } else {
    branchLabel = isCurrentWeekSelected ? "current_week" : "report_week";
    const snapshots = new Map<string, Awaited<ReturnType<typeof readSnapshot>>>();
    const sentimentForSelectedWeek = await timed(
      "live_or_report.getPerformanceSentimentForWeek",
      { selectedWeek: selectedWeek ?? tradingWeekOpenUtc },
      () => getPerformanceSentimentForWeek(selectedWeek ?? tradingWeekOpenUtc),
    );
    const snapshotResults = await timed(
      "live_or_report.readSnapshot.all_assets",
      {
        assetClassCount: assetClasses.length,
        isCurrentWeekSelected,
        selectedReport: selectedReport ?? null,
      },
      () => Promise.all(
        assetClasses.map((asset) =>
          isCurrentWeekSelected
            ? readSnapshot({ assetClass: asset.id })
            : selectedReport
              ? readSnapshot({ assetClass: asset.id, reportDate: selectedReport })
              : readSnapshot({ assetClass: asset.id }),
        ),
      ),
    );
    snapshotResults.forEach((snapshot, index) => {
      snapshots.set(assetClasses[index].id, snapshot);
    });

    perAsset = await timed(
      "live_or_report.compute.per_asset",
      { assetClassCount: assetClasses.length, modelCount: models.length, isCurrentWeekSelected },
      () => Promise.all(
        assetClasses.map(async (asset) => {
          const snapshot = snapshots.get(asset.id);
          if (!snapshot) {
            return { asset, results: [] as Awaited<ReturnType<typeof computeModelPerformance>>[] };
          }
          const useLatestReport = isCurrentWeekSelected;
          const performance = await getPairPerformance(buildAllPairs(asset.id), {
            assetClass: asset.id,
            reportDate: snapshot.report_date,
            isLatestReport: useLatestReport,
          });

          const results = await Promise.all(
            models.map((model) =>
              computeModelPerformance({
                model,
                assetClass: asset.id,
                snapshot,
                sentiment: sentimentForSelectedWeek,
                performance,
              }),
            ),
          );
          return { asset, results };
        }),
      ),
    );

    totals = timedSync(
      "live_or_report.combinePerformanceModelTotals",
      { assetClassCount: perAsset.length, modelCount: models.length },
      () => combinePerformanceModelTotals({
        models,
        perAsset: perAsset.map((asset) => ({ assetLabel: asset.asset.label, results: asset.results })),
      }),
    );
    anyPriced = totals.some((result) => result.priced > 0);
  }

  traceDuration("branch.total", branchStartMs, {
    branch: branchLabel,
    selectedWeek: selectedWeek ?? null,
    hasSnapshots,
    anyPriced,
    assetClassCount: perAsset.length,
  });

  const lastRefreshText =
    latestPriceRefresh
      ? formatDateTimeET(latestPriceRefresh)
      : isFutureWeekSelected
        ? "Waiting for week open"
        : hasSnapshots
          ? "Snapshot loaded; waiting for first price refresh"
          : "No refresh yet";

  traceDuration("page.total", pageStartMs, {
    selectedWeek: selectedWeek ?? null,
    branch: branchLabel,
    hasSnapshots,
    anyPriced,
  });

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
              <h1 className="text-3xl font-semibold text-[var(--foreground)]">
                Performance
              </h1>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                Universal systems (V1/V2)
              </p>
            </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Last refresh{" "}
              {lastRefreshText}
            </span>
            {weekOptions.length > 0 ? (
              <PerformancePeriodSelector
                mode="week"
                options={weekSelectorOptions.map((option) => ({
                  value: option,
                  label: option === "all" ? "All time" : formatWeekOption(option),
                }))}
                selectedValue={selectedWeek ?? weekOptions[0]}
              />
            ) : reportOptions.length > 0 ? (
              <PerformancePeriodSelector
                mode="report"
                options={reportOptions.map((option) => ({
                  value: option,
                  label: formatDateET(option),
                }))}
                selectedValue={selectedReport ?? reportOptions[0]}
              />
            ) : (
              <div className="text-xs text-[color:var(--muted)]">
                No weekly snapshots yet.
              </div>
            )}
          </div>
        </header>

        {!anyPriced && !isFutureWeekSelected ? (
          <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3 text-xs text-[var(--accent-strong)]">
            No priced pairs yet. Prices populate when the scheduled refresh runs.
          </div>
        ) : null}
        {!validWeek && weekParam ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-xs text-rose-700">
            Invalid week value. Select a valid week from the dropdown.
          </div>
        ) : null}

        <PerformanceViewSection
          initialView={view}
          initialSystem={initialSystem}
          gridProps={{
            combined: {
              id: "combined",
              label: "Combined Basket",
              description: selectedWeek
                ? `All asset classes aggregated. ${weekLabelFromOpen(selectedWeek)}.`
                : selectedReport
                  ? `All asset classes aggregated. Report week ${selectedReport}.`
                  : "All asset classes aggregated.",
              models: totals,
            },
            perAsset: perAsset.map((asset) => ({
              id: asset.asset.id,
              label: asset.asset.label,
              description: "Filter performance for this asset class.",
              models: asset.results,
            })),
            labels: PERFORMANCE_MODEL_LABELS,
            calibration: undefined,
            allTime: {
              combined: [],
              perAsset: {},
            },
            showAllTime: false,
          }}
        />
      </div>
    </DashboardLayout>
  );
}
