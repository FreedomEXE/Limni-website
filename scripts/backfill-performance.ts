import { DateTime } from "luxon";
import { query } from "../src/lib/db";
import { readSnapshot } from "../src/lib/cotStore";
import { readAggregates } from "../src/lib/sentiment/store";
import {
  computeModelPerformance,
  buildSentimentPairsWithHistory,
} from "../src/lib/performanceLab";
import {
  getPairPerformanceForWindows,
} from "../src/lib/pricePerformance";
import { writePerformanceSnapshots, type PerformanceSnapshot } from "../src/lib/performanceSnapshots";
import { listAssetClasses } from "../src/lib/cotMarkets";
import type { SentimentAggregate } from "../src/lib/sentiment/types";

async function listWeeks(): Promise<string[]> {
  const rows = await query<{ week_open_utc: Date }>(
    "SELECT DISTINCT week_open_utc FROM performance_snapshots ORDER BY week_open_utc",
  );
  return rows.map((row) => row.week_open_utc.toISOString());
}

async function listWeekReports(weekOpenUtc: string): Promise<Map<string, string | null>> {
  const rows = await query<{ asset_class: string; report_date: Date | null }>(
    "SELECT DISTINCT asset_class, report_date FROM performance_snapshots WHERE week_open_utc = $1",
    [weekOpenUtc],
  );
  const map = new Map<string, string | null>();
  rows.forEach((row) => {
    map.set(row.asset_class, row.report_date ? row.report_date.toISOString().slice(0, 10) : null);
  });
  return map;
}

function buildLockedSentimentForWeek(options: {
  sentimentHistory: SentimentAggregate[];
  weekOpenUtc: DateTime;
  weekCloseUtc: DateTime;
}): SentimentAggregate[] {
  const { sentimentHistory, weekOpenUtc, weekCloseUtc } = options;
  const closeMs = weekCloseUtc.toMillis();
  const openMs = weekOpenUtc.toMillis();
  const bySymbol = new Map<string, { agg: SentimentAggregate; time: DateTime }[]>();

  for (const agg of sentimentHistory) {
    const time = DateTime.fromISO(agg.timestamp_utc, { zone: "utc" });
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

async function main() {
  const assetClasses = listAssetClasses();

  const weeks = await listWeeks();
  if (weeks.length === 0) {
    console.log("No weeks found in performance_snapshots.");
    return;
  }

  const sentimentHistory = await readAggregates();

  for (const weekOpenUtc of weeks) {
    const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    if (!weekOpen.isValid) {
      continue;
    }
    const now = DateTime.utc();
    if (weekOpen.toMillis() > now.toMillis()) {
      continue;
    }
    const rawWeekClose = weekOpen.plus({ days: 5, hours: 23, minutes: 59, seconds: 59 });
    const weekClose = rawWeekClose.toMillis() > now.toMillis() ? now : rawWeekClose;
    const reportDates = await listWeekReports(weekOpenUtc);
    const latestSentiment = buildLockedSentimentForWeek({
      sentimentHistory,
      weekOpenUtc: weekOpen,
      weekCloseUtc: weekClose,
    });

    const payload: PerformanceSnapshot[] = [];
    for (const asset of assetClasses) {
      const reportDate = reportDates.get(asset.id) ?? null;
      const snapshot = reportDate
        ? await readSnapshot({ assetClass: asset.id, reportDate })
        : await readSnapshot({ assetClass: asset.id });
      if (!snapshot) {
        continue;
      }
      const sentimentPairs = buildSentimentPairsWithHistory({
        assetClass: asset.id,
        sentimentHistory,
        weekOpenUtc: weekOpen,
        weekCloseUtc: weekClose,
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
      const result = await computeModelPerformance({
        model: "sentiment",
        assetClass: asset.id,
        snapshot,
        sentiment: latestSentiment,
        performance: sentimentPerformance,
        pairsOverride: sentimentPairs.pairs,
        reasonOverrides: sentimentPairs.reasonOverrides,
      });
      payload.push({
        week_open_utc: weekOpenUtc,
        asset_class: asset.id,
        model: "sentiment",
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

    await writePerformanceSnapshots(payload);
    console.log(`Backfilled week ${weekOpenUtc} (${payload.length} snapshots)`);
  }
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
