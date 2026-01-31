import { listAssetClasses } from "../src/lib/cotMarkets";
import { readSnapshot } from "../src/lib/cotStore";
import { getLatestAggregatesLocked, readAggregates } from "../src/lib/sentiment/store";
import {
  computeModelPerformance,
  buildSentimentPairsWithHistory,
  type PerformanceModel,
} from "../src/lib/performanceLab";
import {
  getPairPerformance,
  getPairPerformanceForWindows,
  getPerformanceWindow,
} from "../src/lib/pricePerformance";
import type { PairSnapshot } from "../src/lib/cotTypes";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import { getWeekOpenUtc, writePerformanceSnapshots } from "../src/lib/performanceSnapshots";

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

async function main() {
  const assetClasses = listAssetClasses();
  const models: PerformanceModel[] = [
    "antikythera",
    "blended",
    "dealer",
    "commercial",
    "sentiment",
  ];

  const weekOpenUtc = getWeekOpenUtc();
  const [latestSentiment, sentimentHistory] = await Promise.all([
    getLatestAggregatesLocked(),
    readAggregates(),
  ]);
  const snapshots = await Promise.all(
    assetClasses.map((asset) => readSnapshot({ assetClass: asset.id })),
  );

  const payload = [];
  for (const asset of assetClasses) {
    const snapshot = snapshots.find((item) => item?.asset_class === asset.id) ?? null;
    if (!snapshot) {
      continue;
    }
    const performance = await getPairPerformance(buildAllPairs(asset.id), {
      assetClass: asset.id,
      reportDate: snapshot.report_date,
      isLatestReport: true,
    });
    const window = getPerformanceWindow({
      assetClass: asset.id,
      reportDate: snapshot.report_date,
      isLatestReport: true,
    });

    for (const model of models) {
      let result;
      if (model === "sentiment") {
        const sentimentPairs = buildSentimentPairsWithHistory({
          assetClass: asset.id,
          sentimentHistory,
          weekOpenUtc: window.openUtc,
          weekCloseUtc: window.closeUtc,
        });
        const sentimentPerformance = await getPairPerformanceForWindows(
          sentimentPairs.pairs,
          Object.fromEntries(
            Object.entries(sentimentPairs.windows).map(([pair, windowInfo]) => [
              pair,
              { openUtc: windowInfo.openUtc, closeUtc: windowInfo.closeUtc },
            ]),
          ),
          { assetClass: asset.id },
        );
        result = await computeModelPerformance({
          model,
          assetClass: asset.id,
          snapshot,
          sentiment: latestSentiment,
          performance: sentimentPerformance,
          pairsOverride: sentimentPairs.pairs,
          reasonOverrides: sentimentPairs.reasonOverrides,
        });
      } else {
        result = await computeModelPerformance({
          model,
          assetClass: asset.id,
          snapshot,
          sentiment: latestSentiment,
          performance,
        });
      }

      payload.push({
        week_open_utc: weekOpenUtc,
        asset_class: asset.id,
        model,
        report_date: snapshot.report_date ?? null,
        percent: result.percent,
        priced: result.priced,
        total: result.total,
        note: result.note,
        returns: result.returns,
        pair_details: result.pair_details,
        stats: result.stats,
      });
    }
  }

  await writePerformanceSnapshots(payload);
  console.log(`Wrote ${payload.length} performance snapshots for week ${weekOpenUtc}`);
}

main().catch((error) => {
  console.error("Refresh failed:", error);
  process.exit(1);
});
