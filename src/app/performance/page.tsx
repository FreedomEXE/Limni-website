import DashboardLayout from "@/components/DashboardLayout";
import { listAssetClasses } from "@/lib/cotMarkets";
import { listSnapshotDates, readSnapshot } from "@/lib/cotStore";
import { getLatestAggregatesLocked } from "@/lib/sentiment/store";
import {
  computeModelPerformance,
  computeReturnStats,
  type PerformanceModel,
} from "@/lib/performanceLab";
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
  getWeekOpenUtc,
} from "@/lib/performanceSnapshots";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MODEL_LABELS: Record<PerformanceModel, string> = {
  blended: "Blended",
  dealer: "Dealer",
  commercial: "Commercial",
  sentiment: "Sentiment",
  antikythera: "Antikythera",
};

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
  const view =
    viewParamValue === "simulation" ||
    viewParamValue === "basket" ||
    viewParamValue === "research" ||
    viewParamValue === "notes"
      ? viewParamValue
      : "summary";
  const assetClasses = listAssetClasses();
  const models: PerformanceModel[] = [
    "antikythera",
    "blended",
    "dealer",
    "commercial",
    "sentiment",
  ];

  const desiredWeeks = 4;
  let weekOptions: string[] = [];
  const currentWeekOpenUtc = getWeekOpenUtc();
  const currentWeekStart = DateTime.fromISO(currentWeekOpenUtc, { zone: "utc" });
  const nextWeekOpenUtc = currentWeekStart.isValid
    ? currentWeekStart.plus({ days: 7 }).toUTC().toISO()
    : null;
  let reportOptions: string[] = [];
  try {
    const recentWeeks = await listPerformanceWeeks(desiredWeeks);
    const ordered: string[] = [];
    const seen = new Set<string>();
    // Always show both the current (possibly upcoming) week open and next week open
    // so we don't skip a week when `desiredWeeks` is small.
    if (nextWeekOpenUtc) {
      ordered.push(nextWeekOpenUtc);
      seen.add(nextWeekOpenUtc);
    }
    if (currentWeekOpenUtc && !seen.has(currentWeekOpenUtc)) {
      ordered.push(currentWeekOpenUtc);
      seen.add(currentWeekOpenUtc);
    }
    for (const week of recentWeeks) {
      if (!seen.has(week)) {
        ordered.push(week);
        seen.add(week);
      }
    }
    weekOptions = ordered.slice(0, desiredWeeks);
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
  const selectedWeek =
    weekParamValue === "all"
      ? "all"
      : typeof weekParamValue === "string" && weekOptions.includes(weekParamValue)
        ? weekParamValue
      : weekOptions.includes(currentWeekOpenUtc)
        ? currentWeekOpenUtc
        : weekOptions[0] ?? null;
  const isAllTimeSelected = selectedWeek === "all";
  const isCurrentWeekSelected =
    !isAllTimeSelected && selectedWeek != null && selectedWeek === currentWeekOpenUtc;
  const isFutureWeekSelected = (() => {
    if (isAllTimeSelected) {
      return false;
    }
    if (!selectedWeek) {
      return false;
    }
    const parsed = DateTime.fromISO(selectedWeek, { zone: "utc" });
    if (!parsed.isValid || !currentWeekStart.isValid) {
      return false;
    }
    return parsed.toMillis() > currentWeekStart.toMillis();
  })();
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
  const isHistoricalWeekSelected = (() => {
    if (isAllTimeSelected) {
      return false;
    }
    if (!selectedWeek || !currentWeekStart.isValid) {
      return false;
    }
    const parsed = DateTime.fromISO(selectedWeek, { zone: "utc" });
    if (!parsed.isValid) {
      return false;
    }
    return parsed.toMillis() < currentWeekStart.toMillis();
  })();
  const isWaitingWeek = isFutureWeekSelected || (isCurrentWeekSelected && !hasSnapshots);
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

  if (isWaitingWeek) {
    const snapshots = new Map<string, Awaited<ReturnType<typeof readSnapshot>>>();
    const latestSentiment = await getLatestAggregatesLocked();
    const snapshotResults = await Promise.all(
      assetClasses.map((asset) => readSnapshot({ assetClass: asset.id })),
    );
    snapshotResults.forEach((snapshot, index) => {
      snapshots.set(assetClasses[index].id, snapshot);
    });

    const performanceOverride = {
      performance: {},
      note: "Week has not started yet. Returns will populate after the report week opens.",
      missingPairs: [],
    };

    perAsset = await Promise.all(
      assetClasses.map(async (asset) => {
        const snapshot = snapshots.get(asset.id);
        if (!snapshot) {
          return { asset, results: [] as Awaited<ReturnType<typeof computeModelPerformance>>[] };
        }
        const results = [];
        for (const model of models) {
          results.push(
            await computeModelPerformance({
              model,
              assetClass: asset.id,
              snapshot,
              sentiment: latestSentiment,
              performance: performanceOverride,
            }),
          );
        }
        return { asset, results };
      }),
    );

    totals = models.map((model) => {
      let percent = 0;
      let priced = 0;
      let total = 0;
      const returns: Array<{ pair: string; percent: number }> = [];
      const pairDetails: Array<{
        pair: string;
        direction: "LONG" | "SHORT" | "NEUTRAL";
        reason: string[];
        percent: number | null;
      }> = [];
      let note = "Combined across assets.";
      for (const asset of perAsset) {
        const result = asset.results.find((item) => item.model === model);
        if (!result) {
          continue;
        }
        percent += result.percent;
        priced += result.priced;
        total += result.total;
        returns.push(...result.returns);
        pairDetails.push(...result.pair_details);
        if (result.note) {
          note = result.note;
        }
      }
      return {
        model,
        percent,
        priced,
        total,
        note,
        returns,
        pair_details: pairDetails,
        stats: computeReturnStats(returns),
      };
    });
    anyPriced = false;
  } else if (hasSnapshots && isHistoricalWeekSelected) {
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
            weekOpenUtc: selectedWeek,
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

    totals = models.map((model) => {
      let percent = 0;
      let priced = 0;
      let total = 0;
      const returns: Array<{ pair: string; percent: number }> = [];
      const pairDetails: Array<{
        pair: string;
        direction: "LONG" | "SHORT" | "NEUTRAL";
        reason: string[];
        percent: number | null;
      }> = [];
      let note = "Combined across assets.";
      for (const asset of perAsset) {
        const result = asset.results.find((item) => item.model === model);
        if (!result) {
          continue;
        }
        percent += result.percent;
        priced += result.priced;
        total += result.total;
        returns.push(
          ...result.returns.map((item) => ({
            pair: `${item.pair} (${asset.asset.label})`,
            percent: item.percent,
          })),
        );
        pairDetails.push(
          ...result.pair_details.map((detail) => ({
            ...detail,
            pair: `${detail.pair} (${asset.asset.label})`,
          })),
        );
        if (result.note) {
          note = result.note;
        }
      }
      return {
        model,
        percent,
        priced,
        total,
        note,
        returns,
        pair_details: pairDetails,
        stats: computeReturnStats(returns),
        trailing: view === "simulation" ? trailingByGroup[`combined:${model}`] : undefined,
      };
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

    totals = models.map((model) => {
      let percent = 0;
      let priced = 0;
      let total = 0;
      const returns: Array<{ pair: string; percent: number }> = [];
      const pairDetails: Array<{
        pair: string;
        direction: "LONG" | "SHORT" | "NEUTRAL";
        reason: string[];
        percent: number | null;
      }> = [];
      let note = "Combined across assets.";
      for (const asset of perAsset) {
        const result = asset.results.find((item) => item.model === model);
        if (!result) {
          continue;
        }
        percent += result.percent;
        priced += result.priced;
        total += result.total;
        returns.push(...result.returns);
        pairDetails.push(...result.pair_details);
        if (result.note) {
          note = result.note;
        }
      }
      return {
        model,
        percent,
        priced,
        total,
        note,
        returns,
        pair_details: pairDetails,
        stats: computeReturnStats(returns),
      };
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

  function buildAllTimeStats(rows: typeof historyRows) {
    const weekTotalsByModel = new Map<
      PerformanceModel,
      Map<string, number>
    >();
    rows.forEach((row) => {
      const modelWeeks = weekTotalsByModel.get(row.model) ?? new Map<string, number>();
      const current = modelWeeks.get(row.week_open_utc) ?? 0;
      modelWeeks.set(row.week_open_utc, current + row.percent);
      weekTotalsByModel.set(row.model, modelWeeks);
    });
    return models.map((model) => {
      const weekMap = weekTotalsByModel.get(model) ?? new Map();
      const weekReturns = Array.from(weekMap.entries())
        .filter(([week]) => {
          const parsed = DateTime.fromISO(week, { zone: "utc" });
          if (!parsed.isValid) {
            return false;
          }
          const weekMillis = parsed.toMillis();
          if (weekMillis >= currentWeekMillis) {
            return false;
          }
          return weekMillis <= nowUtc;
        })
        .map(([week, value]) => ({
          week,
          value,
        }));
      const totalPercent = weekReturns.reduce((sum, item) => sum + item.value, 0);
      const wins = weekReturns.filter((item) => item.value > 0).length;
      const avg =
        weekReturns.length > 0 ? totalPercent / weekReturns.length : 0;
      return {
        model,
        totalPercent,
        weeks: weekReturns.length,
        winRate: weekReturns.length > 0 ? (wins / weekReturns.length) * 100 : 0,
        avgWeekly: avg,
      };
    });
  }

  function buildAllTimePerformance(rows: typeof historyRows) {
    const weekTotalsByModel = new Map<PerformanceModel, Map<string, number>>();
    rows.forEach((row) => {
      const modelWeeks = weekTotalsByModel.get(row.model) ?? new Map<string, number>();
      const current = modelWeeks.get(row.week_open_utc) ?? 0;
      modelWeeks.set(row.week_open_utc, current + row.percent);
      weekTotalsByModel.set(row.model, modelWeeks);
    });
    return models.map((model) => {
      const weekMap = weekTotalsByModel.get(model) ?? new Map<string, number>();
      const weekReturns = Array.from(weekMap.entries())
        .filter(([week]) => {
          const parsed = DateTime.fromISO(week, { zone: "utc" });
          if (!parsed.isValid) {
            return false;
          }
          const weekMillis = parsed.toMillis();
          if (weekMillis >= currentWeekMillis) {
            return false;
          }
          return weekMillis <= nowUtc;
        })
        .map(([week, value]) => ({
          pair: weekLabelFromOpen(week),
          percent: value,
        }));
      const totalPercent = weekReturns.reduce((sum, item) => sum + item.percent, 0);
      const stats = computeReturnStats(weekReturns);
      const weeks = weekReturns.length;
      return {
        model,
        percent: totalPercent,
        priced: weeks,
        total: weeks,
        note: "All-time aggregation",
        returns: weekReturns,
        pair_details: [],
        stats,
      };
    });
  }

  const allTimeCombined = selectedWeek === "all" ? buildAllTimeStats(historyRows) : [];
  const allTimeByAsset = new Map<string, ReturnType<typeof buildAllTimeStats>>();
  if (selectedWeek === "all") {
    assetClasses.forEach((asset) => {
      const rows = historyRows.filter((row) => row.asset_class === asset.id);
      allTimeByAsset.set(asset.id, buildAllTimeStats(rows));
    });
  }
  const allTimePerformanceCombined =
    selectedWeek === "all" ? buildAllTimePerformance(historyRows) : [];
  const allTimePerformanceByAsset = new Map<string, ReturnType<typeof buildAllTimePerformance>>();
  if (selectedWeek === "all") {
    assetClasses.forEach((asset) => {
      const rows = historyRows.filter((row) => row.asset_class === asset.id);
      allTimePerformanceByAsset.set(asset.id, buildAllTimePerformance(rows));
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
              {latestPriceRefresh
                ? formatDateTimeET(latestPriceRefresh)
                : "No refresh yet"}
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

        {!anyPriced ? (
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
          labels={MODEL_LABELS}
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
