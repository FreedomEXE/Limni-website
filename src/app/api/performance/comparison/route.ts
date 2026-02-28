import { NextRequest, NextResponse } from "next/server";
import { readAllPerformanceSnapshots } from "@/lib/performanceSnapshots";
import { getCanonicalWeekOpenUtc, normalizeWeekOpenUtc } from "@/lib/weekAnchor";
import { DateTime } from "luxon";
import type { PerformanceModel } from "@/lib/performanceLab";
import { query } from "@/lib/db";
import {
  PERFORMANCE_V1_MODELS,
  PERFORMANCE_V2_MODELS,
  PERFORMANCE_V3_MODELS,
} from "@/lib/performance/modelConfig";
import { computeTieredForWeeksAllSystems } from "@/lib/performance/tiered";
import {
  readKataraktiMarketSnapshots,
} from "@/lib/performance/kataraktiHistory";
import { buildKataraktiPeriodMetrics } from "@/lib/performance/kataraktiMetrics";

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
  maxDrawdown: number | null;
  trades: number;
  tradeWinRate: number;
  avgTrade: number | null;
  profitFactor: number | null;
};

type SnapshotRow = Awaited<ReturnType<typeof readAllPerformanceSnapshots>>[number];
type BotWeeklyAggregateRow = {
  return_value: number | string;
  wins: number | string;
  priced_trades: number | string;
  week_open_utc?: Date | string;
};

function isClosedSnapshot(snapshot: SnapshotRow, currentWeekMillis: number): boolean {
  const weekMillis = DateTime.fromISO(snapshot.week_open_utc, { zone: "utc" }).toMillis();
  return Number.isFinite(weekMillis) && weekMillis < currentWeekMillis;
}

function pickClosedWeeks(
  snapshots: SnapshotRow[],
  currentWeekMillis: number,
): string[] {
  const weekByKey = new Map<string, number>();

  for (const snapshot of snapshots) {
    if (!isClosedSnapshot(snapshot, currentWeekMillis)) {
      continue;
    }
    const key = normalizeWeekOpenUtc(snapshot.week_open_utc) ?? snapshot.week_open_utc;
    const weekMillis = DateTime.fromISO(snapshot.week_open_utc, { zone: "utc" }).toMillis();
    if (!Number.isFinite(weekMillis)) {
      continue;
    }
    const existing = weekByKey.get(key);
    if (existing === undefined || weekMillis > existing) {
      weekByKey.set(key, weekMillis);
    }
  }

  return Array.from(weekByKey.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([key]) => key);
}

function computeSharpe(returns: number[]) {
  const count = returns.length;
  if (count <= 1) return 0;
  const avg = returns.reduce((sum, value) => sum + value, 0) / count;
  if (avg === 0) return 0;
  const variance =
    returns.reduce((sum, value) => {
      const diff = value - avg;
      return sum + diff * diff;
    }, 0) / (count - 1);
  const stdDev = Math.sqrt(variance);
  return stdDev > 0 ? avg / stdDev : 0;
}

function computeProfitFactorFromReturns(returns: number[]): number | null {
  const grossProfit = returns.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(
    returns.filter((value) => value < 0).reduce((sum, value) => sum + value, 0),
  );
  if (grossLoss > 0) return grossProfit / grossLoss;
  if (grossProfit > 0) return Number.POSITIVE_INFINITY;
  return null;
}

function computeStaticMaxDrawdownFromWeeklyReturns(returns: number[]): number | null {
  if (returns.length === 0) return null;
  return returns.reduce(
    (max, value) => Math.max(max, value < 0 ? Math.abs(value) : 0),
    0,
  );
}

function buildComparisonMetricsFromWeeklySeries(options: {
  weekReturns: number[];
  trades: number;
  wins: number;
  avgTrade: number | null;
  profitFactor: number | null;
  maxDrawdown: number | null;
}): ComparisonMetrics {
  const totalReturn = options.weekReturns.reduce((sum, value) => sum + value, 0);
  const weeks = options.weekReturns.length;
  const weeklyWins = options.weekReturns.filter((value) => value > 0).length;
  const weeklyWinRate = weeks > 0 ? (weeklyWins / weeks) * 100 : 0;
  const avgWeekly = weeks > 0 ? totalReturn / weeks : 0;
  const tradeWinRate = options.trades > 0 ? (options.wins / options.trades) * 100 : 0;
  return {
    totalReturn,
    weeks,
    winRate: weeklyWinRate,
    sharpe: computeSharpe(options.weekReturns),
    avgWeekly,
    maxDrawdown: options.maxDrawdown ?? computeStaticMaxDrawdownFromWeeklyReturns(options.weekReturns),
    trades: options.trades,
    tradeWinRate,
    avgTrade: options.avgTrade,
    profitFactor: options.profitFactor ?? computeProfitFactorFromReturns(options.weekReturns),
  };
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
    const weekKey = normalizeWeekOpenUtc(snapshot.week_open_utc) ?? snapshot.week_open_utc;
    if (!selectedWeeks.has(weekKey)) {
      continue;
    }
    const current = weekTotals.get(weekKey) ?? 0;
    weekTotals.set(weekKey, current + snapshot.percent);
  }

  const weekReturns = Array.from(weekTotals.values());
  const wins = weekReturns.filter((value) => value > 0).length;
  return buildComparisonMetricsFromWeeklySeries({
    weekReturns,
    trades: weekReturns.length,
    wins,
    avgTrade: weekReturns.length > 0 ? weekReturns.reduce((sum, value) => sum + value, 0) / weekReturns.length : null,
    profitFactor: null,
    maxDrawdown: null,
  });
}

function computeMetricsFromWeeklyRows(
  weeklyRows: Array<{ return_percent: number; priced_trades: number; wins: number }>,
): ComparisonMetrics {
  const weekReturns = weeklyRows.map((row) => row.return_percent);
  const totalTrades = weeklyRows.reduce((sum, row) => sum + row.priced_trades, 0);
  const wins = weeklyRows.reduce((sum, row) => sum + row.wins, 0);
  const totalReturn = weekReturns.reduce((sum, value) => sum + value, 0);
  return buildComparisonMetricsFromWeeklySeries({
    weekReturns,
    trades: totalTrades,
    wins,
    avgTrade: totalTrades > 0 ? totalReturn / totalTrades : null,
    profitFactor: null,
    maxDrawdown: null,
  });
}

async function readBotWeeklyAggregates(
  sql: string,
  params: readonly unknown[],
): Promise<BotWeeklyAggregateRow[]> {
  try {
    return await query<BotWeeklyAggregateRow>(sql, params);
  } catch (error) {
    console.warn(
      "[performance-comparison] bot aggregate query failed:",
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}

function toBotComparisonMetrics(rows: BotWeeklyAggregateRow[]): ComparisonMetrics {
  return computeMetricsFromWeeklyRows(
    rows.map((row) => ({
      return_percent: Number(row.return_value) || 0,
      priced_trades: Number(row.priced_trades) || 0,
      wins: Number(row.wins) || 0,
    })),
  );
}

function toKataraktiComparisonMetrics(
  metrics: ReturnType<typeof buildKataraktiPeriodMetrics> | null,
): ComparisonMetrics | null {
  if (!metrics) return null;
  return {
    totalReturn: metrics.totalReturnPct,
    weeks: metrics.weeks,
    winRate: metrics.weeklyWinRatePct,
    sharpe: metrics.sharpe,
    avgWeekly: metrics.avgWeeklyPct,
    maxDrawdown: metrics.maxDrawdownPct,
    trades: metrics.trades,
    tradeWinRate: metrics.tradeWinRatePct,
    avgTrade: metrics.avgTradePct,
    profitFactor: metrics.profitFactor,
  };
}

export async function GET(request: NextRequest) {
  try {
    const weekParam = request.nextUrl.searchParams.get("week");
    const requestedWeek =
      weekParam && weekParam !== "all"
        ? (normalizeWeekOpenUtc(weekParam) ?? weekParam)
        : null;
    const currentWeekOpenUtc = getCanonicalWeekOpenUtc();
    const currentWeekMillis = DateTime.fromISO(currentWeekOpenUtc, { zone: "utc" }).toMillis();

    // Scan a wide enough history window to reliably backfill the selected weeks.
    const snapshots = await readAllPerformanceSnapshots(SNAPSHOT_SCAN_LIMIT);
    const closedWeeks = pickClosedWeeks(snapshots, currentWeekMillis);
    const selectedWeekList = requestedWeek
      ? closedWeeks.filter((week) => week === requestedWeek)
      : closedWeeks;
    const selectedWeeks = new Set(selectedWeekList);

    const v1Metrics = computeMetrics(snapshots, V1_MODELS, selectedWeeks);
    const v2Metrics = computeMetrics(snapshots, V2_MODELS, selectedWeeks);
    const v3Metrics = computeMetrics(snapshots, V3_MODELS, selectedWeeks);

    const selectedWeekOpens = selectedWeekList.sort(
      (a, b) =>
        DateTime.fromISO(a, { zone: "utc" }).toMillis() -
        DateTime.fromISO(b, { zone: "utc" }).toMillis(),
    );

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

    const [snapshotByMarket, bitgetWeeklyRows, mt5WeeklyRows] = await Promise.all([
      readKataraktiMarketSnapshots(),
      readBotWeeklyAggregates(
        `SELECT
           COALESCE(SUM(pnl_usd), 0)::double precision AS return_value,
           COUNT(*) FILTER (WHERE pnl_usd > 0)::int AS wins,
           COUNT(*)::int AS priced_trades
         FROM bitget_bot_trades
         WHERE bot_id = $1
           AND exit_time_utc IS NOT NULL
         GROUP BY DATE_TRUNC('week', COALESCE(exit_time_utc, entry_time_utc))
         ORDER BY DATE_TRUNC('week', COALESCE(exit_time_utc, entry_time_utc)) DESC
         LIMIT $2`,
        ["bitget_perp_v2", COMPARISON_WEEKS],
      ),
      readBotWeeklyAggregates(
        `SELECT
           COALESCE(SUM(pnl_usd), 0)::double precision AS return_value,
           COUNT(*) FILTER (WHERE pnl_usd > 0)::int AS wins,
           COUNT(*)::int AS priced_trades
         FROM katarakti_trades
         WHERE bot_id = $1
           AND exit_time_utc IS NOT NULL
         GROUP BY DATE_TRUNC('week', COALESCE(week_anchor, exit_time_utc, entry_time_utc))
         ORDER BY DATE_TRUNC('week', COALESCE(week_anchor, exit_time_utc, entry_time_utc)) DESC
         LIMIT $2`,
        ["katarakti_v1", COMPARISON_WEEKS],
      ),
    ]);

    const cryptoSnapshotMetrics = snapshotByMarket.crypto_futures
      ? toKataraktiComparisonMetrics(
          buildKataraktiPeriodMetrics(snapshotByMarket.crypto_futures, requestedWeek ?? "all"),
        )
      : null;
    const mt5SnapshotMetrics = snapshotByMarket.mt5_forex
      ? toKataraktiComparisonMetrics(
          buildKataraktiPeriodMetrics(snapshotByMarket.mt5_forex, requestedWeek ?? "all"),
        )
      : null;

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
      katarakti: {
        crypto_futures: cryptoSnapshotMetrics ?? toBotComparisonMetrics(bitgetWeeklyRows),
        mt5_forex: mt5SnapshotMetrics ?? toBotComparisonMetrics(mt5WeeklyRows),
      },
      weeksAnalyzed: selectedWeekList.length,
    });
  } catch (error) {
    console.error("Performance comparison API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch comparison data" },
      { status: 500 },
    );
  }
}
