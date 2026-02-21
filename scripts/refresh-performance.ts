import { listAssetClasses } from "../src/lib/cotMarkets";
import { listSnapshotDates, readSnapshot } from "../src/lib/cotStore";
import { getAggregatesForWeekStart, readAggregates } from "../src/lib/sentiment/store";
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
import { DateTime } from "luxon";

function reportWeekOpenUtc(reportDate: string): string | null {
  const report = DateTime.fromISO(reportDate, { zone: "America/New_York" });
  if (!report.isValid) {
    return null;
  }
  const daysUntilMonday = (8 - report.weekday) % 7;
  const monday = report
    .plus({ days: daysUntilMonday })
    .set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
  return monday.toUTC().toISO();
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

async function main() {
  const assetClasses = listAssetClasses();
  const models: PerformanceModel[] = [
    "antikythera",
    "antikythera_v2",
    "antikythera_v3",
    "blended",
    "dealer",
    "commercial",
    "sentiment",
  ];

  const weekOpenUtc = getWeekOpenUtc();
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const weekCloseIso = weekOpen.isValid
    ? weekOpen.plus({ days: 7 }).toUTC().toISO() ?? weekOpenUtc
    : weekOpenUtc;
  const nowUtc = DateTime.utc();
  const isFutureWeek = weekOpen.isValid && weekOpen.toMillis() > nowUtc.toMillis();
  const [latestSentiment, sentimentHistory] = await Promise.all([
    getAggregatesForWeekStart(weekOpenUtc, weekCloseIso),
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
    const performance = isFutureWeek
      ? { performance: {}, note: "Week has not started yet.", missingPairs: [] }
      : await getPairPerformance(buildAllPairs(asset.id), {
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
        const sentimentPerformance = isFutureWeek
          ? { performance: {}, note: "Week has not started yet.", missingPairs: [] }
          : await getPairPerformanceForWindows(
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

  const reportLists = await Promise.all(
    assetClasses.map((asset) => listSnapshotDates(asset.id)),
  );
  const latestReport = reportLists
    .flat()
    .sort((a, b) => b.localeCompare(a))[0];
  if (latestReport) {
    const futureWeek = reportWeekOpenUtc(latestReport);
    if (futureWeek && futureWeek > weekOpenUtc) {
      const futurePayload = [];
      for (const asset of assetClasses) {
        const snapshot = await readSnapshot({ assetClass: asset.id, reportDate: latestReport });
        if (!snapshot) {
          continue;
        }
        for (const model of models) {
          futurePayload.push({
            week_open_utc: futureWeek,
            asset_class: asset.id,
            model,
            report_date: snapshot.report_date ?? null,
            percent: 0,
            priced: 0,
            total: 0,
            note: "Week has not started yet. Returns will populate after the report week opens.",
            returns: [],
            pair_details: [],
            stats: {
              avg_return: 0,
              median_return: 0,
              win_rate: 0,
              volatility: 0,
              best_pair: null,
              worst_pair: null,
            },
          });
        }
      }

      if (futurePayload.length > 0) {
        await writePerformanceSnapshots(futurePayload);
        console.log(
          `Wrote ${futurePayload.length} placeholder snapshots for week ${futureWeek}`,
        );
      }
    }
  }
}

main().catch((error) => {
  console.error("Refresh failed:", error);
  process.exit(1);
});
