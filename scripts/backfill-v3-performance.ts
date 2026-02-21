process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://limni_db_user:K8zK9exIEbZ4YzyV4jxFYHpZO0Rq1X36@dpg-d5jucsmr433s73baeg1g-a.oregon-postgres.render.com/limni_db";

import { DateTime } from "luxon";
import { query } from "../src/lib/db";
import { listAssetClasses, type AssetClass } from "../src/lib/cotMarkets";
import { readSnapshot, readSnapshotHistory } from "../src/lib/cotStore";
import {
  getAggregatesForWeekStart,
  getLatestAggregatesLocked,
} from "../src/lib/sentiment/store";
import { computeModelPerformance } from "../src/lib/performanceLab";
import { getPairPerformance } from "../src/lib/pricePerformance";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { PairSnapshot } from "../src/lib/cotTypes";
import {
  getWeekOpenUtc,
  writePerformanceSnapshots,
  type PerformanceSnapshot,
} from "../src/lib/performanceSnapshots";

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

function getTargetReportDateForWeek(weekOpenUtc: string): string | null {
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).setZone("America/New_York");
  if (!weekOpen.isValid) {
    return null;
  }
  return weekOpen.minus({ days: 5 }).toISODate();
}

async function readSnapshotForWeek(assetClass: AssetClass, weekOpenUtc: string) {
  const targetReportDate = getTargetReportDateForWeek(weekOpenUtc);
  if (!targetReportDate) {
    return null;
  }
  const history = await readSnapshotHistory(assetClass, 260);
  const match = history.find((item) => item.report_date <= targetReportDate);
  return match ?? null;
}

async function listWeeksToBackfill() {
  const rows = await query<{ week_open_utc: Date }>(
    `SELECT DISTINCT week_open_utc
     FROM performance_snapshots
     ORDER BY week_open_utc DESC`,
  );
  return rows.map((row) => row.week_open_utc.toISOString());
}

async function main() {
  const assetClasses = listAssetClasses();
  const weekOpenUtcCurrent = getWeekOpenUtc();
  const latestSentiment = await getLatestAggregatesLocked();
  const weeks = await listWeeksToBackfill();
  const payload: PerformanceSnapshot[] = [];

  for (const weekOpenUtc of weeks) {
    const isCurrentWeek = weekOpenUtc === weekOpenUtcCurrent;
    let sentimentForWeek = latestSentiment;
    const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    const weekClose = weekOpen.isValid ? weekOpen.plus({ days: 7 }).toUTC().toISO() : null;
    if (weekClose) {
      const weekStartSentiment = await getAggregatesForWeekStart(weekOpenUtc, weekClose);
      if (weekStartSentiment.length > 0) {
        sentimentForWeek = weekStartSentiment;
      }
    }

    const snapshots = await Promise.all(
      assetClasses.map((asset) =>
        isCurrentWeek
          ? readSnapshot({ assetClass: asset.id })
          : readSnapshotForWeek(asset.id, weekOpenUtc),
      ),
    );

    for (const asset of assetClasses) {
      const snapshot = snapshots.find((item) => item?.asset_class === asset.id) ?? null;
      if (!snapshot) {
        continue;
      }
      const performance = await getPairPerformance(buildAllPairs(asset.id), {
        assetClass: asset.id,
        reportDate: snapshot.report_date,
        isLatestReport: isCurrentWeek,
      });
      const result = await computeModelPerformance({
        model: "antikythera_v3",
        assetClass: asset.id,
        snapshot,
        sentiment: sentimentForWeek,
        performance,
      });
      payload.push({
        week_open_utc: weekOpenUtc,
        asset_class: asset.id,
        model: "antikythera_v3",
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
  console.log(`Backfilled ${payload.length} antikythera_v3 snapshots across ${weeks.length} weeks`);
}

main().catch((error) => {
  console.error("V3 backfill failed:", error);
  process.exit(1);
});
