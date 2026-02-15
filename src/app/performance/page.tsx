import DashboardLayout from "@/components/DashboardLayout";
import { listAssetClasses } from "@/lib/cotMarkets";
import { listSnapshotDates, readSnapshot } from "@/lib/cotStore";
import { getLatestAggregatesLocked } from "@/lib/sentiment/store";
import { computeModelPerformance } from "@/lib/performanceLab";
import { simulateTrailingForGroupsFromRows } from "@/lib/universalBasket";
import { getPairPerformance } from "@/lib/pricePerformance";
import type { PairSnapshot } from "@/lib/cotTypes";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import PerformanceGrid from "@/components/performance/PerformanceGrid";
import PerformancePeriodSelector from "@/components/performance/PerformancePeriodSelector";
import PerformanceViewCards from "@/components/performance/PerformanceViewCards";
import { readMarketSnapshot } from "@/lib/priceStore";
import { DateTime } from "luxon";
import { formatDateET, formatDateTimeET, latestIso } from "@/lib/time";
import {
  listPerformanceWeeks,
  readAllPerformanceSnapshots,
  readPerformanceSnapshotsByWeek,
  isWeekOpenUtc,
  weekLabelFromOpen,
} from "@/lib/performanceSnapshots";
import { getCanonicalWeekOpenUtc, getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import { buildDataWeekOptions } from "@/lib/weekOptions";
import {
  buildPerformanceWeekFlags,
  resolvePerformanceView,
  resolveSelectedPerformanceWeek,
} from "@/lib/performance/pageState";
import { combinePerformanceModelTotals } from "@/lib/performance/pageTotals";
import {
  PERFORMANCE_MODELS,
  PERFORMANCE_MODEL_LABELS,
} from "@/lib/performance/modelConfig";
import {
  buildAllTimePerformance,
  buildAllTimeStats,
} from "@/lib/performance/allTime";

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

export default async function PerformancePage({ searchParams }: PerformancePageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const weekParam = resolvedSearchParams?.week;
  const weekParamValue = Array.isArray(weekParam) ? weekParam[0] : weekParam;
  const viewParam = resolvedSearchParams?.view;
  const viewParamValue = Array.isArray(viewParam) ? viewParam[0] : viewParam;
  const view = resolvePerformanceView(viewParamValue);
  const assetClasses = listAssetClasses();
  const models = PERFORMANCE_MODELS;

  const desiredWeeks = 5;
  let weekOptions: string[] = [];
  const displayWeekOpenUtc = getDisplayWeekOpenUtc();
  const tradingWeekOpenUtc = getCanonicalWeekOpenUtc();
  const currentWeekStart = DateTime.fromISO(tradingWeekOpenUtc, { zone: "utc" });
  let reportOptions: string[] = [];
  try {
    const recentWeeks = await listPerformanceWeeks(desiredWeeks);
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
      reportOptions = await Promise.all(
        assetClasses.map((asset) => listSnapshotDates(asset.id)),
      ).then((lists) => {
        if (lists.length === 0) {
          return [];
        }
        return lists.reduce((acc, list) => acc.filter((date) => list.includes(date)));
      });
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
  const reportParam = resolvedSearchParams?.report;
  const selectedReport =
    typeof reportParam === "string" && reportOptions.includes(reportParam)
      ? reportParam
      : reportOptions[0] ?? null;
  const validWeek = selectedWeek && selectedWeek !== "all" ? isWeekOpenUtc(selectedWeek) : true;
  let weekSnapshots: Awaited<ReturnType<typeof readPerformanceSnapshotsByWeek>> = [];
  if (selectedWeek && selectedWeek !== "all") {
    try {
      weekSnapshots = await readPerformanceSnapshotsByWeek(selectedWeek);
    } catch (error) {
      console.error(
        "Performance snapshot load failed:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  const hasSnapshots = weekSnapshots.length > 0;
  const { isAllTimeSelected, isCurrentWeekSelected, isFutureWeekSelected, isHistoricalWeekSelected } = buildPerformanceWeekFlags({
    selectedWeek,
    currentWeekOpenUtc: displayWeekOpenUtc,
    tradingWeekOpenUtc,
    hasSnapshots,
  });
  let latestPriceRefresh: string | null = null;
  try {
    const marketSnapshots = await Promise.all(
      assetClasses.map((asset) =>
        readMarketSnapshot(isAllTimeSelected ? undefined : selectedWeek ?? undefined, asset.id),
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

  let perAsset: Array<{
    asset: (typeof assetClasses)[number];
    results: Awaited<ReturnType<typeof computeModelPerformance>>[];
  }> = [];
  let totals: Array<Awaited<ReturnType<typeof computeModelPerformance>>> = [];
  let anyPriced = false;
  const lastRefreshText =
    latestPriceRefresh
      ? formatDateTimeET(latestPriceRefresh)
      : isFutureWeekSelected
        ? "Waiting for week open"
        : "No refresh yet";

  if (isFutureWeekSelected && !hasSnapshots) {
    const snapshots = new Map<string, Awaited<ReturnType<typeof readSnapshot>>>();
    const latestSentiment = await getLatestAggregatesLocked();
    const snapshotResults = await Promise.all(
      assetClasses.map((asset) => readSnapshot({ assetClass: asset.id })),
    );
    snapshotResults.forEach((snapshot, index) => {
      snapshots.set(assetClasses[index].id, snapshot);
    });

    perAsset = await Promise.all(
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
        const results = [];
        for (const model of models) {
          results.push(
            await computeModelPerformance({
              model,
              assetClass: asset.id,
              snapshot,
              sentiment: latestSentiment,
              performance,
            }),
          );
        }
        return { asset, results };
      }),
    );

    totals = combinePerformanceModelTotals({
      models,
      perAsset: perAsset.map((asset) => ({ assetLabel: asset.asset.label, results: asset.results })),
    });
    anyPriced = totals.some((result) => result.priced > 0);
  } else if (hasSnapshots && (isHistoricalWeekSelected || isFutureWeekSelected)) {
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
    const trailingByGroup =
      view === "simulation"
        ? await simulateTrailingForGroupsFromRows({
            weekOpenUtc: historicalWeekOpenUtc,
            groups,
            trailStartPct: 10,
            trailOffsetPct: 5,
            timeframe: "M1",
          })
        : {};

    const byAsset = new Map<string, Awaited<ReturnType<typeof computeModelPerformance>>[]>();
    weekSnapshots.forEach((snapshot) => {
      const modelLabel = snapshot.model;
      const entry = byAsset.get(snapshot.asset_class) ?? [];
      entry.push({
        model: modelLabel,
        percent: snapshot.percent,
        priced: snapshot.priced,
        total: snapshot.total,
        note: snapshot.note,
        returns: snapshot.returns,
        pair_details: snapshot.pair_details,
        stats: snapshot.stats,
        trailing: view === "simulation" ? trailingByGroup[`${snapshot.asset_class}:${snapshot.model}`] : undefined,
      });
      byAsset.set(snapshot.asset_class, entry);
    });

    perAsset = assetClasses.map((asset) => ({
      asset,
      results: byAsset.get(asset.id) ?? [],
    }));

    totals = combinePerformanceModelTotals({
      models,
      perAsset: perAsset.map((asset) => ({ assetLabel: asset.asset.label, results: asset.results })),
      labelWithAsset: true,
      trailingByCombinedModel: view === "simulation" ? trailingByGroup : undefined,
    });
    anyPriced = totals.some((result) => result.priced > 0);
  } else {
    const snapshots = new Map<string, Awaited<ReturnType<typeof readSnapshot>>>();
    const latestSentiment = await getLatestAggregatesLocked();
    const snapshotResults = await Promise.all(
      assetClasses.map((asset) =>
        isCurrentWeekSelected
          ? readSnapshot({ assetClass: asset.id })
          : selectedReport
            ? readSnapshot({ assetClass: asset.id, reportDate: selectedReport })
            : readSnapshot({ assetClass: asset.id }),
      ),
    );
    snapshotResults.forEach((snapshot, index) => {
      snapshots.set(assetClasses[index].id, snapshot);
    });

    perAsset = await Promise.all(
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

        const results = [];
        for (const model of models) {
          results.push(
            await computeModelPerformance({
              model,
              assetClass: asset.id,
              snapshot,
              sentiment: latestSentiment,
              performance,
            }),
          );
        }
        return { asset, results };
      }),
    );

    totals = combinePerformanceModelTotals({
      models,
      perAsset: perAsset.map((asset) => ({ assetLabel: asset.asset.label, results: asset.results })),
    });
    anyPriced = totals.some((result) => result.priced > 0);
  }

  let historyRows: Awaited<ReturnType<typeof readAllPerformanceSnapshots>> = [];
  if (selectedWeek === "all") {
    try {
      historyRows = await readAllPerformanceSnapshots();
    } catch (error) {
      console.error(
        "Performance snapshot history failed:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  const nowUtc = DateTime.utc().toMillis();
  const currentWeekMillis = currentWeekStart.isValid
    ? currentWeekStart.toMillis()
    : nowUtc;

  const allTimeCombined =
    selectedWeek === "all"
      ? buildAllTimeStats(historyRows, models, currentWeekMillis, nowUtc)
      : [];
  const allTimeByAsset = new Map<string, ReturnType<typeof buildAllTimeStats>>();
  if (selectedWeek === "all") {
    assetClasses.forEach((asset) => {
      const rows = historyRows.filter((row) => row.asset_class === asset.id);
      allTimeByAsset.set(
        asset.id,
        buildAllTimeStats(rows, models, currentWeekMillis, nowUtc),
      );
    });
  }
  const allTimePerformanceCombined =
    selectedWeek === "all"
      ? buildAllTimePerformance(historyRows, models, currentWeekMillis, nowUtc)
      : [];
  const allTimePerformanceByAsset = new Map<string, ReturnType<typeof buildAllTimePerformance>>();
  if (selectedWeek === "all") {
    assetClasses.forEach((asset) => {
      const rows = historyRows.filter((row) => row.asset_class === asset.id);
      allTimePerformanceByAsset.set(
        asset.id,
        buildAllTimePerformance(rows, models, currentWeekMillis, nowUtc),
      );
    });
  }

  if (isAllTimeSelected) {
    totals = allTimePerformanceCombined;
    perAsset = assetClasses.map((asset) => ({
      asset,
      results: allTimePerformanceByAsset.get(asset.id) ?? [],
    }));
    anyPriced = totals.some((result) => result.total > 0);
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">
              Performance
            </h1>
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

        <PerformanceViewCards activeView={view} />

        <PerformanceGrid
          key={view}
          combined={{
            id: "combined",
            label: "Combined Basket",
            description: selectedWeek
              ? selectedWeek === "all"
                ? "All asset classes aggregated. All-time view."
                : `All asset classes aggregated. ${weekLabelFromOpen(selectedWeek)}.`
              : selectedReport
                ? `All asset classes aggregated. Report week ${selectedReport}.`
                : "All asset classes aggregated.",
            models: totals,
          }}
          perAsset={perAsset.map((asset) => ({
            id: asset.asset.id,
            label: asset.asset.label,
              description: "Filter performance for this asset class.",
              models: asset.results,
            }))}
          labels={PERFORMANCE_MODEL_LABELS}
          calibration={undefined}
          allTime={{
            combined: allTimeCombined,
            perAsset: Object.fromEntries(
              assetClasses.map((asset) => [asset.id, allTimeByAsset.get(asset.id) ?? []]),
            ),
          }}
          view={view}
          showAllTime={false}
        />

      </div>
    </DashboardLayout>
  );
}
