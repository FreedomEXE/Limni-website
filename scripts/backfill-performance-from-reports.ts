import { DateTime } from "luxon";
import { query } from "../src/lib/db";
import { readSnapshot } from "../src/lib/cotStore";
import { listAssetClasses } from "../src/lib/cotMarkets";
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
import { writePerformanceSnapshots } from "../src/lib/performanceSnapshots";
import { readAggregates, getAggregatesAsOf } from "../src/lib/sentiment/store";

type ReportRow = {
  asset_class: string;
  report_date: Date;
};

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

// Sentiment is snapshotted as-of the trading week open (Monday 00:00 ET).

async function listReportDatesByAsset(): Promise<Map<string, Set<string>>> {
  const assetClasses = listAssetClasses().map((asset) => asset.id);
  const rows = await query<ReportRow>(
    "SELECT asset_class, report_date FROM cot_snapshots ORDER BY report_date DESC",
  );

  const byAsset = new Map<string, Set<string>>();
  for (const asset of assetClasses) {
    byAsset.set(asset, new Set());
  }
  rows.forEach((row) => {
    const date = row.report_date.toISOString().slice(0, 10);
    const set = byAsset.get(row.asset_class);
    if (set) {
      set.add(date);
    }
  });

  return byAsset;
}

async function main() {
  const assetClasses = listAssetClasses();
  const minReportDate = process.env.PERFORMANCE_MIN_REPORT_DATE ?? "";
  const models: PerformanceModel[] = [
    "antikythera",
    "blended",
    "dealer",
    "commercial",
    "sentiment",
  ];

  const reportDatesByAsset = await listReportDatesByAsset();
  const allDates = Array.from(
    new Set(
      Array.from(reportDatesByAsset.values()).flatMap((set) => Array.from(set)),
    ),
  ).sort((a, b) => b.localeCompare(a));
  const filteredDates =
    minReportDate && minReportDate.length > 0
      ? allDates.filter((date) => date >= minReportDate)
      : allDates;

  if (filteredDates.length === 0) {
    console.log("No report dates found.");
    return;
  }

  const sentimentHistory = await readAggregates();
  const targetDates = filteredDates.slice(0, 3);

  for (const reportDate of targetDates) {
    const weekOpenIso = reportWeekOpenUtc(reportDate);
    if (!weekOpenIso) {
      continue;
    }
    const weekOpen = DateTime.fromISO(weekOpenIso, { zone: "utc" });
    const latestSentiment = await getAggregatesAsOf(weekOpenIso);

    const payload = [];
    for (const asset of assetClasses) {
      const assetDates = reportDatesByAsset.get(asset.id);
      if (!assetDates || !assetDates.has(reportDate)) {
        continue;
      }
      const snapshot = await readSnapshot({ assetClass: asset.id, reportDate });
      if (!snapshot) {
        continue;
      }
      const window = getPerformanceWindow({
        assetClass: asset.id,
        reportDate: snapshot.report_date,
        isLatestReport: false,
      });
      const performance = await getPairPerformance(snapshot.pairs, {
        assetClass: asset.id,
        reportDate: snapshot.report_date,
        isLatestReport: false,
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
          week_open_utc: weekOpenIso,
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
    console.log(`Backfilled report ${reportDate} -> week ${weekOpenIso} (${payload.length} snapshots)`);
  }
}

main().catch((error) => {
  console.error("Backfill from reports failed:", error);
  process.exit(1);
});
