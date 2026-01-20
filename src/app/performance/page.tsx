import DashboardLayout from "@/components/DashboardLayout";
import RefreshControl from "@/components/RefreshControl";
import { listAssetClasses } from "@/lib/cotMarkets";
import { readSnapshot, readSnapshotHistory } from "@/lib/cotStore";
import { getLatestAggregates } from "@/lib/sentiment/store";
import {
  computeModelPerformance,
  type PerformanceModel,
} from "@/lib/performanceLab";

export const dynamic = "force-dynamic";

const MODEL_LABELS: Record<PerformanceModel, string> = {
  blended: "Blended",
  dealer: "Dealer",
  commercial: "Commercial",
  sentiment: "Sentiment",
  antikythera: "Antikythera",
};

function formatPercent(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function tone(value: number) {
  if (value > 0) {
    return "text-emerald-700";
  }
  if (value < 0) {
    return "text-rose-700";
  }
  return "text-slate-500";
}

export default async function PerformancePage() {
  const assetClasses = listAssetClasses();
  const models: PerformanceModel[] = [
    "antikythera",
    "blended",
    "dealer",
    "commercial",
    "sentiment",
  ];

  const snapshots = new Map<string, Awaited<ReturnType<typeof readSnapshot>>>();
  const histories = new Map<string, Awaited<ReturnType<typeof readSnapshotHistory>>>();
  const sentiment = await getLatestAggregates();

  const [snapshotResults, historyResults] = await Promise.all([
    Promise.all(assetClasses.map((asset) => readSnapshot({ assetClass: asset.id }))),
    Promise.all(assetClasses.map((asset) => readSnapshotHistory(asset.id, 104))),
  ]);
  snapshotResults.forEach((snapshot, index) => {
    snapshots.set(assetClasses[index].id, snapshot);
  });
  historyResults.forEach((history, index) => {
    histories.set(assetClasses[index].id, history);
  });

  const perAsset = await Promise.all(
    assetClasses.map(async (asset) => {
      const snapshot = snapshots.get(asset.id);
      const history = histories.get(asset.id) ?? [];
      if (!snapshot) {
        return { asset, results: [] as Awaited<ReturnType<typeof computeModelPerformance>>[] };
      }
      const results = await Promise.all(
        models.map((model) =>
          computeModelPerformance({
            model,
            assetClass: asset.id,
            snapshot,
            history,
            sentiment,
          }),
        ),
      );
      return { asset, results };
    }),
  );

  const totals = models.map((model) => {
    let percent = 0;
    let priced = 0;
    let total = 0;
    for (const asset of perAsset) {
      const result = asset.results.find((item) => item.model === model);
      if (!result) {
        continue;
      }
      percent += result.percent;
      priced += result.priced;
      total += result.total;
    }
    return { model, percent, priced, total };
  });
  const anyPriced = totals.some((result) => result.priced > 0);
  const refreshTimes = snapshotResults
    .map((snapshot) => snapshot?.last_refresh_utc)
    .filter((value): value is string => Boolean(value))
    .sort();
  const latestRefresh = refreshTimes.length > 0 ? refreshTimes.at(-1) ?? "" : "";

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Performance Lab</h1>
            <p className="mt-2 text-sm text-slate-600">
              Compare weekly basket performance across filters using percent-only scoring.
            </p>
          </div>
          <div className="w-full md:w-auto">
            <RefreshControl lastRefreshUtc={latestRefresh} assetClass="all" />
          </div>
        </header>

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Combined Basket
              </h2>
              <p className="text-sm text-[color:var(--muted)]">
                All asset classes aggregated.
              </p>
            </div>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Latest week
            </span>
          </div>
          {!anyPriced ? (
            <div className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-xs text-amber-800">
              No priced pairs yet. Run “Refresh prices” on ALL to populate snapshots.
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {totals.map((result) => (
              <div
                key={result.model}
                className="rounded-xl border border-slate-200 bg-white/80 p-4"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  {MODEL_LABELS[result.model]}
                </p>
                <p className={`mt-2 text-xl font-semibold ${tone(result.percent)}`}>
                  {formatPercent(result.percent)}
                </p>
                <p className="mt-2 text-xs text-[color:var(--muted)]">
                  {result.priced}/{result.total} priced
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          {perAsset.map((asset) => (
            <div
              key={asset.asset.id}
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm"
            >
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  {asset.asset.label} Basket
                </h2>
                <p className="text-sm text-[color:var(--muted)]">
                  Filter performance for this asset class.
                </p>
              </div>
              {asset.results.length === 0 ? (
                <p className="text-sm text-[color:var(--muted)]">
                  No snapshots available.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  {asset.results.map((result) => (
                    <div
                      key={`${asset.asset.id}-${result.model}`}
                      className="rounded-xl border border-slate-200 bg-white/80 p-4"
                    >
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        {MODEL_LABELS[result.model]}
                      </p>
                      <p className={`mt-2 text-xl font-semibold ${tone(result.percent)}`}>
                        {formatPercent(result.percent)}
                      </p>
                      <p className="mt-2 text-xs text-[color:var(--muted)]">
                        {result.priced}/{result.total} priced
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      </div>
    </DashboardLayout>
  );
}
