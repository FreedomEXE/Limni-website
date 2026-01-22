import DashboardLayout from "@/components/DashboardLayout";
import { listAssetClasses } from "@/lib/cotMarkets";
import { readSnapshot } from "@/lib/cotStore";
import { getLatestAggregates } from "@/lib/sentiment/store";
import {
  computeModelPerformance,
  computeReturnStats,
  type PerformanceModel,
} from "@/lib/performanceLab";
import { getPairPerformance } from "@/lib/pricePerformance";
import type { PairSnapshot } from "@/lib/cotTypes";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import PerformanceGrid from "@/components/performance/PerformanceGrid";
import {
  listPerformanceWeeks,
  readAllPerformanceSnapshots,
  readPerformanceSnapshotsByWeek,
  weekLabelFromOpen,
} from "@/lib/performanceSnapshots";

export const dynamic = "force-dynamic";

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
  const assetClasses = listAssetClasses();
  const models: PerformanceModel[] = [
    "antikythera",
    "blended",
    "dealer",
    "commercial",
    "sentiment",
  ];

  let weekOptions: string[] = [];
  try {
    weekOptions = await listPerformanceWeeks();
  } catch (error) {
    console.error(
      "Performance snapshot list failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
  const selectedWeek =
    typeof weekParam === "string" && weekOptions.includes(weekParam)
      ? weekParam
      : weekOptions[0] ?? null;
  let weekSnapshots: Awaited<ReturnType<typeof readPerformanceSnapshotsByWeek>> = [];
  if (selectedWeek) {
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

  if (hasSnapshots) {
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
        direction: "LONG" | "SHORT";
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
      };
    });
    anyPriced = totals.some((result) => result.priced > 0);
  } else {
    const snapshots = new Map<string, Awaited<ReturnType<typeof readSnapshot>>>();
    const sentiment = await getLatestAggregates();
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
          isLatestReport: true,
        });
        const results = await Promise.all(
          models.map((model) =>
            computeModelPerformance({
              model,
              assetClass: asset.id,
              snapshot,
              sentiment,
              performance,
            }),
          ),
        );
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
        direction: "LONG" | "SHORT";
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
  try {
    historyRows = await readAllPerformanceSnapshots();
  } catch (error) {
    console.error(
      "Performance snapshot history failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
  const weekTotalsByModel = new Map<
    PerformanceModel,
    Map<string, number>
  >();
  historyRows.forEach((row) => {
    const modelWeeks = weekTotalsByModel.get(row.model) ?? new Map<string, number>();
    const current = modelWeeks.get(row.week_open_utc) ?? 0;
    modelWeeks.set(row.week_open_utc, current + row.percent);
    weekTotalsByModel.set(row.model, modelWeeks);
  });
  const allTimeStats = models.map((model) => {
    const weekMap = weekTotalsByModel.get(model) ?? new Map();
    const weekReturns = Array.from(weekMap.entries()).map(([week, value]) => ({
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
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">
              Performance Lab
            </h1>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Compare weekly basket performance across filters using percent-only scoring.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {weekOptions.length > 0 ? (
              <form action="/performance" method="get" className="flex items-center gap-3">
                <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Week
                </label>
                <select
                  name="week"
                  defaultValue={selectedWeek ?? undefined}
                  className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-sm text-[var(--foreground)]"
                >
                  {weekOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatWeekOption(option)}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[var(--accent-strong)]"
                >
                  View
                </button>
              </form>
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
        <PerformanceGrid
          combined={{
            id: "combined",
            label: "Combined Basket",
            description: selectedWeek
              ? `All asset classes aggregated. ${weekLabelFromOpen(selectedWeek)}.`
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
        />

        {historyRows.length > 0 ? (
          <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                All-time performance
              </h2>
              <p className="text-sm text-[color:var(--muted)]">
                Aggregated weekly totals across all tracked snapshots.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {allTimeStats.map((stat) => (
                <div
                  key={`alltime-${stat.model}`}
                  className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4 text-left"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    {MODEL_LABELS[stat.model]}
                  </p>
                  <p
                    className={`mt-2 text-2xl font-semibold ${
                      stat.totalPercent > 0
                        ? "text-emerald-700"
                        : stat.totalPercent < 0
                          ? "text-rose-700"
                          : "text-[var(--foreground)]"
                    }`}
                  >
                    {stat.totalPercent.toFixed(2)}%
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-[color:var(--muted)]">
                    <p>{stat.weeks} weeks tracked</p>
                    <p>Win rate {stat.winRate.toFixed(0)}%</p>
                    <p>Avg weekly {stat.avgWeekly.toFixed(2)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
