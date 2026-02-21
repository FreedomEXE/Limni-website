import { DateTime } from "luxon";
import { listAssetClasses, type AssetClass } from "@/lib/cotMarkets";
import { readSnapshot, readSnapshotHistory } from "@/lib/cotStore";
import {
  getAggregatesForWeekStart,
  getLatestAggregatesLocked,
} from "@/lib/sentiment/store";
import {
  computeModelPerformance,
  type PerformanceModel,
} from "@/lib/performanceLab";
import { getPairPerformance } from "@/lib/pricePerformance";
import type { PairSnapshot } from "@/lib/cotTypes";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import {
  getWeekOpenUtc,
  writePerformanceSnapshots,
} from "@/lib/performanceSnapshots";

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
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).setZone(
    "America/New_York",
  );
  if (!weekOpen.isValid) {
    return null;
  }
  // Sunday 19:00 ET week key -> use Tuesday COT report from ~5 days prior.
  return weekOpen.minus({ days: 5 }).toISODate();
}

function getTradingWeekOpenFromReportDate(reportDate: string): string | null {
  const report = DateTime.fromISO(reportDate, { zone: "America/New_York" });
  if (!report.isValid) return null;
  const daysUntilSunday = (7 - (report.weekday % 7)) % 7;
  const sundayOpen = report.plus({ days: daysUntilSunday }).set({
    hour: 19,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  return sundayOpen.toUTC().toISO();
}

async function readSnapshotForWeek(
  assetClass: AssetClass,
  weekOpenUtc: string,
) {
  const targetReportDate = getTargetReportDateForWeek(weekOpenUtc);
  if (!targetReportDate) {
    return null;
  }

  const history = await readSnapshotHistory(assetClass, 260);
  const match = history.find((item) => item.report_date <= targetReportDate);
  return match ?? null;
}

async function listRecentWeeks(
  assetClasses: ReturnType<typeof listAssetClasses>,
  limit: number,
) {
  const weeks = new Set<string>();
  const historyLists = await Promise.all(
    assetClasses.map((asset) => readSnapshotHistory(asset.id, Math.max(limit * 3, 24))),
  );
  for (const history of historyLists) {
    for (const item of history) {
      if (!item.report_date) {
        continue;
      }
      const weekOpenUtc = getTradingWeekOpenFromReportDate(item.report_date);
      if (weekOpenUtc) {
        weeks.add(weekOpenUtc);
      }
    }
  }
  return Array.from(weeks.values())
    .sort((a, b) => DateTime.fromISO(b, { zone: "utc" }).toMillis() - DateTime.fromISO(a, { zone: "utc" }).toMillis())
    .slice(0, limit);
}

export async function refreshPerformanceSnapshots(options: {
  forcedWeekOpenUtc?: string | null;
  rollingWeeks: number;
}) {
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
  const latestSentiment = await getLatestAggregatesLocked();

  const targetWeeks = options.forcedWeekOpenUtc
    ? [options.forcedWeekOpenUtc]
    : await listRecentWeeks(assetClasses, Math.max(1, options.rollingWeeks));
  const currentWeekOpenUtc = getWeekOpenUtc();
  if (!options.forcedWeekOpenUtc && !targetWeeks.includes(currentWeekOpenUtc)) {
    targetWeeks.unshift(currentWeekOpenUtc);
  }

  if (!options.forcedWeekOpenUtc && targetWeeks.length > 0) {
    const latestSnapshot = await readSnapshot({ assetClass: assetClasses[0].id });
    if (latestSnapshot?.report_date) {
      const latestWeek = getTradingWeekOpenFromReportDate(latestSnapshot.report_date);
      if (latestWeek && !targetWeeks.includes(latestWeek)) {
        targetWeeks.unshift(latestWeek);
      }
    }
  }

  const payload = [];
  for (const weekOpenUtc of targetWeeks) {
    const isCurrentWeek = weekOpenUtc === currentWeekOpenUtc;
    let sentimentForWeek = latestSentiment;
    const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    const weekClose = weekOpen.isValid
      ? weekOpen.plus({ days: 7 }).toUTC().toISO()
      : null;
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
      const reportWeekOpenUtc = weekOpenUtc;

      const performance = await getPairPerformance(buildAllPairs(asset.id), {
        assetClass: asset.id,
        reportDate: snapshot.report_date,
        isLatestReport: isCurrentWeek,
      });

      for (const model of models) {
        const result = await computeModelPerformance({
          model,
          assetClass: asset.id,
          snapshot,
          sentiment: sentimentForWeek,
          performance,
        });
        payload.push({
          week_open_utc: reportWeekOpenUtc,
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
  }

  await writePerformanceSnapshots(payload);

  return {
    week_open_utc: targetWeeks[0] ?? getWeekOpenUtc(),
    weeks: targetWeeks,
    snapshots_written: payload.length,
  };
}
