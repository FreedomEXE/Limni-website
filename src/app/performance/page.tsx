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

export const dynamic = "force-dynamic";

const MODEL_LABELS: Record<PerformanceModel, string> = {
  blended: "Blended",
  dealer: "Dealer",
  commercial: "Commercial",
  sentiment: "Sentiment",
  antikythera: "Antikythera",
};

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
  const sentiment = await getLatestAggregates();

  const [snapshotResults] = await Promise.all([
    Promise.all(assetClasses.map((asset) => readSnapshot({ assetClass: asset.id }))),
  ]);
  snapshotResults.forEach((snapshot, index) => {
    snapshots.set(assetClasses[index].id, snapshot);
  });

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

  const perAsset = await Promise.all(
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

  const totals = models.map((model) => {
    let percent = 0;
    let priced = 0;
    let total = 0;
    const returns: Array<{ pair: string; percent: number }> = [];
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
      stats: computeReturnStats(returns),
    };
  });
  const anyPriced = totals.some((result) => result.priced > 0);
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
        </header>

        {!anyPriced ? (
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-xs text-amber-800">
            No priced pairs yet. Prices populate when the scheduled refresh runs.
          </div>
        ) : null}
        <PerformanceGrid
          combined={{
            id: "combined",
            label: "Combined Basket",
            description: "All asset classes aggregated.",
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
      </div>
    </DashboardLayout>
  );
}
