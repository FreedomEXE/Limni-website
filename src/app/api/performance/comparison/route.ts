import { NextResponse } from "next/server";
import { readAllPerformanceSnapshots } from "@/lib/performanceSnapshots";
import { getCanonicalWeekOpenUtc, normalizeWeekOpenUtc } from "@/lib/weekAnchor";
import { DateTime } from "luxon";
import type { PerformanceModel } from "@/lib/performanceLab";
import {
  PERFORMANCE_V1_MODELS,
  PERFORMANCE_V2_MODELS,
  PERFORMANCE_V3_MODELS,
} from "@/lib/performance/modelConfig";
import { computeTieredForWeeksAllSystems } from "@/lib/performance/tiered";

const V1_MODELS: PerformanceModel[] = PERFORMANCE_V1_MODELS;
const V2_MODELS: PerformanceModel[] = PERFORMANCE_V2_MODELS;
const V3_MODELS: PerformanceModel[] = PERFORMANCE_V3_MODELS;
const COMPARISON_WEEKS = 5;
const SNAPSHOT_SCAN_LIMIT = 1200;

type ComparisonMetrics = {
  totalReturn: number;
  weeks: number;
  winRate: number;
  sharpe: number;
  avgWeekly: number;
  trades?: number;
};

type SnapshotRow = Awaited<ReturnType<typeof readAllPerformanceSnapshots>>[number];

function getWeekBucketKey(snapshot: SnapshotRow): string {
  if (snapshot.report_date) {
    return `report:${snapshot.report_date}`;
  }
  const canonicalWeek = normalizeWeekOpenUtc(snapshot.week_open_utc) ?? snapshot.week_open_utc;
  return `week:${canonicalWeek}`;
}

function isClosedSnapshot(snapshot: SnapshotRow, currentWeekMillis: number): boolean {
  const weekMillis = DateTime.fromISO(snapshot.week_open_utc, { zone: "utc" }).toMillis();
  return Number.isFinite(weekMillis) && weekMillis < currentWeekMillis;
}

function pickRecentClosedWeeks(
  snapshots: SnapshotRow[],
  currentWeekMillis: number,
  maxWeeks: number,
): Set<string> {
  const weekByKey = new Map<string, number>();

  for (const snapshot of snapshots) {
    if (!isClosedSnapshot(snapshot, currentWeekMillis)) {
      continue;
    }
    const key = getWeekBucketKey(snapshot);
    const weekMillis = DateTime.fromISO(snapshot.week_open_utc, { zone: "utc" }).toMillis();
    if (!Number.isFinite(weekMillis)) {
      continue;
    }
    const existing = weekByKey.get(key);
    if (existing === undefined || weekMillis > existing) {
      weekByKey.set(key, weekMillis);
    }
  }

  const selected = Array.from(weekByKey.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxWeeks)
    .map(([key]) => key);

  return new Set(selected);
}

function computeMetrics(
  snapshots: SnapshotRow[],
  models: PerformanceModel[],
  selectedWeeks: Set<string>,
): ComparisonMetrics {
  const weekTotals = new Map<string, number>();

  for (const snapshot of snapshots) {
    if (!models.includes(snapshot.model)) {
      continue;
    }
    const weekKey = getWeekBucketKey(snapshot);
    if (!selectedWeeks.has(weekKey)) {
      continue;
    }
    const current = weekTotals.get(weekKey) ?? 0;
    weekTotals.set(weekKey, current + snapshot.percent);
  }

  const weekReturns = Array.from(weekTotals.values());
  const totalReturn = weekReturns.reduce((sum, val) => sum + val, 0);
  const weeks = weekReturns.length;
  const wins = weekReturns.filter((val) => val > 0).length;
  const winRate = weeks > 0 ? (wins / weeks) * 100 : 0;
  const avgWeekly = weeks > 0 ? totalReturn / weeks : 0;

  // Compute Sharpe (simplified: avg / stddev)
  let sharpe = 0;
  if (weeks > 1 && avgWeekly !== 0) {
    const variance = weekReturns.reduce((sum, val) => {
      const diff = val - avgWeekly;
      return sum + diff * diff;
    }, 0) / (weeks - 1);
    const stdDev = Math.sqrt(variance);
    sharpe = stdDev > 0 ? avgWeekly / stdDev : 0;
  }

  return {
    totalReturn,
    weeks,
    winRate,
    sharpe,
    avgWeekly,
  };
}

function computeMetricsFromWeeklyRows(
  weeklyRows: Array<{ return_percent: number; priced_trades: number; wins: number }>,
): ComparisonMetrics {
  const weekReturns = weeklyRows.map((row) => row.return_percent);
  const totalReturn = weekReturns.reduce((sum, val) => sum + val, 0);
  const weeks = weekReturns.length;
  const totalTrades = weeklyRows.reduce((sum, row) => sum + row.priced_trades, 0);
  const wins = weeklyRows.reduce((sum, row) => sum + row.wins, 0);
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const avgWeekly = weeks > 0 ? totalReturn / weeks : 0;

  let sharpe = 0;
  if (weeks > 1 && avgWeekly !== 0) {
    const variance = weekReturns.reduce((sum, val) => {
      const diff = val - avgWeekly;
      return sum + diff * diff;
    }, 0) / (weeks - 1);
    const stdDev = Math.sqrt(variance);
    sharpe = stdDev > 0 ? avgWeekly / stdDev : 0;
  }

  return {
    totalReturn,
    weeks,
    winRate,
    sharpe,
    avgWeekly,
    trades: totalTrades,
  };
}

export async function GET() {
  try {
    const currentWeekOpenUtc = getCanonicalWeekOpenUtc();
    const currentWeekMillis = DateTime.fromISO(currentWeekOpenUtc, { zone: "utc" }).toMillis();

    // Scan a wide enough history window to reliably backfill the selected weeks.
    const snapshots = await readAllPerformanceSnapshots(SNAPSHOT_SCAN_LIMIT);
    const selectedWeeks = pickRecentClosedWeeks(snapshots, currentWeekMillis, COMPARISON_WEEKS);

    const v1Metrics = computeMetrics(snapshots, V1_MODELS, selectedWeeks);
    const v2Metrics = computeMetrics(snapshots, V2_MODELS, selectedWeeks);
    const v3Metrics = computeMetrics(snapshots, V3_MODELS, selectedWeeks);

    const selectedWeekOpens = Array.from(
      snapshots.reduce((acc, snapshot) => {
        const bucket = getWeekBucketKey(snapshot);
        if (!selectedWeeks.has(bucket)) {
          return acc;
        }
        const current = acc.get(bucket);
        const weekMillis = DateTime.fromISO(snapshot.week_open_utc, { zone: "utc" }).toMillis();
        if (!Number.isFinite(weekMillis)) {
          return acc;
        }
        if (!current || weekMillis > current.weekMillis) {
          acc.set(bucket, { weekMillis, week_open_utc: snapshot.week_open_utc });
        }
        return acc;
      }, new Map<string, { weekMillis: number; week_open_utc: string }>()),
    )
      .sort((a, b) => a[1].weekMillis - b[1].weekMillis)
      .map(([, value]) => value.week_open_utc);

    const tieredWeeklyBySystem = await computeTieredForWeeksAllSystems({
      weeks: selectedWeekOpens,
    });
    const tiered = {
      v1: computeMetricsFromWeeklyRows(
        tieredWeeklyBySystem.v1.map((row) => ({
          return_percent: row.summary.return_percent,
          priced_trades: row.summary.priced_trades,
          wins: row.summary.wins,
        })),
      ),
      v2: computeMetricsFromWeeklyRows(
        tieredWeeklyBySystem.v2.map((row) => ({
          return_percent: row.summary.return_percent,
          priced_trades: row.summary.priced_trades,
          wins: row.summary.wins,
        })),
      ),
      v3: computeMetricsFromWeeklyRows(
        tieredWeeklyBySystem.v3.map((row) => ({
          return_percent: row.summary.return_percent,
          priced_trades: row.summary.priced_trades,
          wins: row.summary.wins,
        })),
      ),
    };

    return NextResponse.json({
      v1: v1Metrics,
      v2: v2Metrics,
      v3: v3Metrics,
      universal: {
        v1: v1Metrics,
        v2: v2Metrics,
        v3: v3Metrics,
      },
      tiered,
      weeksAnalyzed: selectedWeeks.size,
    });
  } catch (error) {
    console.error("Performance comparison API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch comparison data" },
      { status: 500 },
    );
  }
}
