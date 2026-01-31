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
import { readAggregates } from "../src/lib/sentiment/store";
import type { SentimentAggregate } from "../src/lib/sentiment/types";
import { DateTime as LuxonDateTime } from "luxon";

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

function buildLockedSentimentForWeek(options: {
  sentimentHistory: SentimentAggregate[];
  weekOpenUtc: LuxonDateTime;
  weekCloseUtc: LuxonDateTime;
}): SentimentAggregate[] {
  const { sentimentHistory, weekOpenUtc, weekCloseUtc } = options;
  const closeMs = weekCloseUtc.toMillis();
  const openMs = weekOpenUtc.toMillis();
  const bySymbol = new Map<string, { agg: SentimentAggregate; time: LuxonDateTime }[]>();

  for (const agg of sentimentHistory) {
    const time = LuxonDateTime.fromISO(agg.timestamp_utc, { zone: "utc" });
    if (!time.isValid || time.toMillis() > closeMs) {
      continue;
    }
    if (!bySymbol.has(agg.symbol)) {
      bySymbol.set(agg.symbol, []);
    }
    bySymbol.get(agg.symbol)?.push({ agg, time });
  }

  const locked: SentimentAggregate[] = [];
  for (const [symbol, list] of bySymbol.entries()) {
    const sorted = list.sort((a, b) => a.time.toMillis() - b.time.toMillis());
    if (sorted.length === 0) {
      continue;
    }
    const latest = sorted[sorted.length - 1].agg;
    const firstFlip = sorted.find(
      (entry) => entry.time.toMillis() >= openMs && entry.agg.flip_state !== "NONE",
    );
    if (firstFlip) {
      locked.push({
        ...latest,
        crowding_state: "NEUTRAL",
        flip_state: "FLIPPED_NEUTRAL",
        timestamp_utc: firstFlip.agg.timestamp_utc,
      });
    } else {
      locked.push(latest);
    }
  }

  return locked;
}

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

  if (allDates.length === 0) {
    console.log("No report dates found.");
    return;
  }

  const sentimentHistory = await readAggregates();
  const targetDates = allDates.slice(0, 3);

  for (const reportDate of targetDates) {
    const weekOpenIso = reportWeekOpenUtc(reportDate);
    if (!weekOpenIso) {
      continue;
    }
    const weekOpen = DateTime.fromISO(weekOpenIso, { zone: "utc" });
    const weekClose = weekOpen.plus({ days: 5, hours: 23, minutes: 59, seconds: 59 });
    const latestSentiment = buildLockedSentimentForWeek({
      sentimentHistory,
      weekOpenUtc: weekOpen,
      weekCloseUtc: weekClose,
    });

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
