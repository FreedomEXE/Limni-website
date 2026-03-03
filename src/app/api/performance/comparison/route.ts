import { NextRequest, NextResponse } from "next/server";
import { readAllPerformanceSnapshots } from "@/lib/performanceSnapshots";
import { getCanonicalWeekOpenUtc, normalizeWeekOpenUtc } from "@/lib/weekAnchor";
import { DateTime } from "luxon";
import { computeModelPerformance, type PerformanceModel } from "@/lib/performanceLab";
import {
  PERFORMANCE_V1_MODELS,
  PERFORMANCE_V2_MODELS,
  PERFORMANCE_V3_MODELS,
} from "@/lib/performance/modelConfig";
import { computeTieredForWeeksAllSystems } from "@/lib/performance/tiered";
import {
  readKataraktiMarketSnapshotsByVariant,
} from "@/lib/performance/kataraktiHistory";
import { buildKataraktiPeriodMetrics } from "@/lib/performance/kataraktiMetrics";
import { listAssetClasses } from "@/lib/cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import type { PairSnapshot } from "@/lib/cotTypes";
import { readSnapshot } from "@/lib/cotStore";
import { getPairPerformance } from "@/lib/pricePerformance";
import { getAggregatesForWeekStartWithBackfill } from "@/lib/sentiment/store";

const V1_MODELS: PerformanceModel[] = PERFORMANCE_V1_MODELS;
const V2_MODELS: PerformanceModel[] = PERFORMANCE_V2_MODELS;
const V3_MODELS: PerformanceModel[] = PERFORMANCE_V3_MODELS;
const SNAPSHOT_SCAN_LIMIT = 1200;
const ANNUALIZATION_FACTOR = Math.sqrt(52);

type ComparisonMetrics = {
  totalReturn: number;
  weeks: number;
  winRate: number;
  sharpe: number;
  sharpeAnnualized?: boolean;
  avgWeekly: number;
  maxDrawdown: number | null;
  trades: number;
  tradeWinRate: number;
  avgTrade: number | null;
  profitFactor: number | null;
  profitFactorInfinite?: boolean;
};

type SnapshotRow = Awaited<ReturnType<typeof readAllPerformanceSnapshots>>[number];

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

async function getPerformanceSentimentForWeek(weekOpenUtc: string) {
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const weekClose = weekOpen.isValid
    ? weekOpen.plus({ days: 7 }).toUTC().toISO()
    : null;
  if (!weekClose) {
    return [];
  }
  return getAggregatesForWeekStartWithBackfill(weekOpenUtc, weekClose);
}

async function buildFallbackSnapshotsForRequestedWeek(
  requestedWeek: string,
  currentWeekMillis: number,
): Promise<SnapshotRow[]> {
  const weekMillis = DateTime.fromISO(requestedWeek, { zone: "utc" }).toMillis();
  if (!Number.isFinite(weekMillis)) {
    return [];
  }
  const isFutureWeek = weekMillis > currentWeekMillis;
  const models = Array.from(new Set<PerformanceModel>([
    ...V1_MODELS,
    ...V2_MODELS,
    ...V3_MODELS,
  ]));
  const assetClasses = listAssetClasses();
  const sentiment = await getPerformanceSentimentForWeek(requestedWeek);
  const out: SnapshotRow[] = [];

  for (const asset of assetClasses) {
    const snapshot = await readSnapshot({ assetClass: asset.id });
    if (!snapshot) {
      continue;
    }

    const performance = await getPairPerformance(buildAllPairs(asset.id), {
      assetClass: asset.id,
      reportDate: snapshot.report_date,
      isLatestReport: !isFutureWeek,
    });

    for (const model of models) {
      const computed = await computeModelPerformance({
        model,
        assetClass: asset.id,
        snapshot,
        sentiment,
        performance,
      });
      out.push({
        week_open_utc: requestedWeek,
        asset_class: asset.id,
        model,
        report_date: snapshot.report_date,
        percent: computed.percent,
        priced: computed.priced,
        total: computed.total,
        returns: computed.returns,
        stats: computed.stats,
      });
    }
  }

  return out;
}

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

function pickAllWeeks(snapshots: SnapshotRow[]): string[] {
  const weekByKey = new Map<string, number>();

  for (const snapshot of snapshots) {
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

function computeSharpeWithSingleWeekFallback(
  weeklyReturns: number[],
  fallbackReturns: number[],
) {
  if (weeklyReturns.length > 1) {
    return computeSharpe(weeklyReturns);
  }
  if (fallbackReturns.length > 1) {
    return computeSharpe(fallbackReturns);
  }
  return computeSharpe(weeklyReturns);
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
  sharpeFallbackReturns?: number[];
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
    sharpe: computeSharpeWithSingleWeekFallback(
      options.weekReturns,
      options.sharpeFallbackReturns ?? [],
    ),
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
  const tradeReturns: number[] = [];
  let fallbackPricedTrades = 0;
  let fallbackEstimatedWins = 0;

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
    fallbackPricedTrades += Number.isFinite(snapshot.priced) ? snapshot.priced : 0;
    for (const trade of snapshot.returns ?? []) {
      if (!trade || !Number.isFinite(trade.percent)) {
        continue;
      }
      tradeReturns.push(trade.percent);
    }
    if ((snapshot.returns?.length ?? 0) === 0) {
      const winRate = Number(snapshot.stats?.win_rate);
      if (Number.isFinite(winRate) && snapshot.priced > 0) {
        fallbackEstimatedWins += Math.round((snapshot.priced * winRate) / 100);
      }
    }
  }

  const weekReturns = Array.from(weekTotals.values());
  const trades = tradeReturns.length > 0 ? tradeReturns.length : fallbackPricedTrades;
  const wins =
    tradeReturns.length > 0
      ? tradeReturns.filter((value) => value > 0).length
      : fallbackEstimatedWins;
  return buildComparisonMetricsFromWeeklySeries({
    weekReturns,
    sharpeFallbackReturns: tradeReturns,
    trades,
    wins,
    avgTrade:
      tradeReturns.length > 0
        ? tradeReturns.reduce((sum, value) => sum + value, 0) / tradeReturns.length
        : null,
    profitFactor: tradeReturns.length > 0 ? computeProfitFactorFromReturns(tradeReturns) : null,
    maxDrawdown: null,
  });
}

function computeMetricsFromWeeklyRows(
  weeklyRows: Array<{
    return_percent: number;
    priced_trades: number;
    wins: number;
    trade_returns: number[];
    week_max_drawdown: number | null;
  }>,
): ComparisonMetrics {
  const weekReturns = weeklyRows.map((row) => row.return_percent);
  const tradeReturns = weeklyRows.flatMap((row) =>
    row.trade_returns.filter((value) => Number.isFinite(value)),
  );
  const totalTrades =
    tradeReturns.length > 0
      ? tradeReturns.length
      : weeklyRows.reduce((sum, row) => sum + row.priced_trades, 0);
  const wins =
    tradeReturns.length > 0
      ? tradeReturns.filter((value) => value > 0).length
      : weeklyRows.reduce((sum, row) => sum + row.wins, 0);
  const totalReturn = weekReturns.reduce((sum, value) => sum + value, 0);
  const maxDrawdown =
    weeklyRows.length > 0
      ? weeklyRows.reduce((max, row) => Math.max(max, row.week_max_drawdown ?? 0), 0)
      : null;
  return buildComparisonMetricsFromWeeklySeries({
    weekReturns,
    sharpeFallbackReturns: tradeReturns,
    trades: totalTrades,
    wins,
    avgTrade:
      tradeReturns.length > 0
        ? tradeReturns.reduce((sum, value) => sum + value, 0) / tradeReturns.length
        : totalTrades > 0
          ? totalReturn / totalTrades
          : null,
    profitFactor:
      tradeReturns.length > 0
        ? computeProfitFactorFromReturns(tradeReturns)
        : null,
    maxDrawdown,
  });
}

function finalizeComparisonMetrics(
  metrics: ComparisonMetrics,
  options: {
    annualizeSharpe: boolean;
    sharpeAlreadyAnnualized?: boolean;
  },
): ComparisonMetrics {
  const sharpe =
    options.annualizeSharpe && !options.sharpeAlreadyAnnualized
      ? metrics.sharpe * ANNUALIZATION_FACTOR
      : metrics.sharpe;
  const profitFactorInfinite = metrics.profitFactor !== null && !Number.isFinite(metrics.profitFactor);
  return {
    ...metrics,
    sharpe,
    sharpeAnnualized: options.annualizeSharpe,
    profitFactor: profitFactorInfinite ? null : metrics.profitFactor,
    profitFactorInfinite,
  };
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
    const allWeeks = pickAllWeeks(snapshots);
    let comparisonSnapshots = snapshots;
    let selectedWeekList = requestedWeek
      ? allWeeks.filter((week) => week === requestedWeek)
      : closedWeeks;
    if (requestedWeek && selectedWeekList.length === 0) {
      const fallbackSnapshots = await buildFallbackSnapshotsForRequestedWeek(
        requestedWeek,
        currentWeekMillis,
      );
      if (fallbackSnapshots.length > 0) {
        comparisonSnapshots = [...snapshots, ...fallbackSnapshots];
        selectedWeekList = [requestedWeek];
      }
    }
    const selectedWeeks = new Set(selectedWeekList);
    const annualizeSharpe = requestedWeek === null;

    const v1Metrics = finalizeComparisonMetrics(
      computeMetrics(comparisonSnapshots, V1_MODELS, selectedWeeks),
      { annualizeSharpe },
    );
    const v2Metrics = finalizeComparisonMetrics(
      computeMetrics(comparisonSnapshots, V2_MODELS, selectedWeeks),
      { annualizeSharpe },
    );
    const v3Metrics = finalizeComparisonMetrics(
      computeMetrics(comparisonSnapshots, V3_MODELS, selectedWeeks),
      { annualizeSharpe },
    );

    const selectedWeekOpens = selectedWeekList.sort(
      (a, b) =>
        DateTime.fromISO(a, { zone: "utc" }).toMillis() -
        DateTime.fromISO(b, { zone: "utc" }).toMillis(),
    );

    const tieredWeeklyBySystem = await computeTieredForWeeksAllSystems({
      weeks: selectedWeekOpens,
    });
    const tiered = {
      v1: finalizeComparisonMetrics(computeMetricsFromWeeklyRows(
        tieredWeeklyBySystem.v1.map((row) => ({
          return_percent: row.summary.return_percent,
          priced_trades: row.summary.priced_trades,
          wins: row.summary.wins,
          trade_returns: row.combined.flatMap((model) =>
            (model.returns ?? [])
              .map((entry) => entry.percent)
              .filter((value) => Number.isFinite(value)),
          ),
          week_max_drawdown: row.combined.reduce((max, model) => {
            const modelMax = (model.returns ?? []).reduce(
              (innerMax, entry) =>
                Number.isFinite(entry.percent) && entry.percent < 0
                  ? Math.max(innerMax, Math.abs(entry.percent))
                  : innerMax,
              0,
            );
            return Math.max(max, modelMax);
          }, 0),
        })),
      ), { annualizeSharpe }),
      v2: finalizeComparisonMetrics(computeMetricsFromWeeklyRows(
        tieredWeeklyBySystem.v2.map((row) => ({
          return_percent: row.summary.return_percent,
          priced_trades: row.summary.priced_trades,
          wins: row.summary.wins,
          trade_returns: row.combined.flatMap((model) =>
            (model.returns ?? [])
              .map((entry) => entry.percent)
              .filter((value) => Number.isFinite(value)),
          ),
          week_max_drawdown: row.combined.reduce((max, model) => {
            const modelMax = (model.returns ?? []).reduce(
              (innerMax, entry) =>
                Number.isFinite(entry.percent) && entry.percent < 0
                  ? Math.max(innerMax, Math.abs(entry.percent))
                  : innerMax,
              0,
            );
            return Math.max(max, modelMax);
          }, 0),
        })),
      ), { annualizeSharpe }),
      v3: finalizeComparisonMetrics(computeMetricsFromWeeklyRows(
        tieredWeeklyBySystem.v3.map((row) => ({
          return_percent: row.summary.return_percent,
          priced_trades: row.summary.priced_trades,
          wins: row.summary.wins,
          trade_returns: row.combined.flatMap((model) =>
            (model.returns ?? [])
              .map((entry) => entry.percent)
              .filter((value) => Number.isFinite(value)),
          ),
          week_max_drawdown: row.combined.reduce((max, model) => {
            const modelMax = (model.returns ?? []).reduce(
              (innerMax, entry) =>
                Number.isFinite(entry.percent) && entry.percent < 0
                  ? Math.max(innerMax, Math.abs(entry.percent))
                  : innerMax,
              0,
            );
            return Math.max(max, modelMax);
          }, 0),
        })),
      ), { annualizeSharpe }),
    };

    const [coreSnapshotsByMarket, liteSnapshotsByMarket, v3SnapshotsByMarket] = await Promise.all([
      readKataraktiMarketSnapshotsByVariant("core"),
      readKataraktiMarketSnapshotsByVariant("lite"),
      readKataraktiMarketSnapshotsByVariant("v3"),
    ]);

    const emptyKataraktiMetrics: ComparisonMetrics = {
      totalReturn: 0,
      weeks: 0,
      winRate: 0,
      sharpe: 0,
      sharpeAnnualized: false,
      avgWeekly: 0,
      maxDrawdown: null,
      trades: 0,
      tradeWinRate: 0,
      avgTrade: null,
      profitFactor: null,
      profitFactorInfinite: false,
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
      katarakti: {
        core: {
          crypto_futures: coreSnapshotsByMarket.crypto_futures
            ? finalizeComparisonMetrics(
                toKataraktiComparisonMetrics(
                  buildKataraktiPeriodMetrics(coreSnapshotsByMarket.crypto_futures, requestedWeek ?? "all"),
                ) ?? emptyKataraktiMetrics,
                {
                  annualizeSharpe,
                  // buildKataraktiPeriodMetrics annualizes when period is "all".
                  sharpeAlreadyAnnualized: annualizeSharpe,
                },
              )
            : emptyKataraktiMetrics,
          mt5_forex: coreSnapshotsByMarket.mt5_forex
            ? finalizeComparisonMetrics(
                toKataraktiComparisonMetrics(
                  buildKataraktiPeriodMetrics(coreSnapshotsByMarket.mt5_forex, requestedWeek ?? "all"),
                ) ?? emptyKataraktiMetrics,
                {
                  annualizeSharpe,
                  // buildKataraktiPeriodMetrics annualizes when period is "all".
                  sharpeAlreadyAnnualized: annualizeSharpe,
                },
              )
            : emptyKataraktiMetrics,
        },
        lite: {
          crypto_futures: liteSnapshotsByMarket.crypto_futures
            ? finalizeComparisonMetrics(
                toKataraktiComparisonMetrics(
                  buildKataraktiPeriodMetrics(liteSnapshotsByMarket.crypto_futures, requestedWeek ?? "all"),
                ) ?? emptyKataraktiMetrics,
                {
                  annualizeSharpe,
                  // buildKataraktiPeriodMetrics annualizes when period is "all".
                  sharpeAlreadyAnnualized: annualizeSharpe,
                },
              )
            : emptyKataraktiMetrics,
          mt5_forex: liteSnapshotsByMarket.mt5_forex
            ? finalizeComparisonMetrics(
                toKataraktiComparisonMetrics(
                  buildKataraktiPeriodMetrics(liteSnapshotsByMarket.mt5_forex, requestedWeek ?? "all"),
                ) ?? emptyKataraktiMetrics,
                {
                  annualizeSharpe,
                  // buildKataraktiPeriodMetrics annualizes when period is "all".
                  sharpeAlreadyAnnualized: annualizeSharpe,
                },
              )
            : emptyKataraktiMetrics,
        },
        v3: {
          crypto_futures: v3SnapshotsByMarket.crypto_futures
            ? finalizeComparisonMetrics(
                toKataraktiComparisonMetrics(
                  buildKataraktiPeriodMetrics(v3SnapshotsByMarket.crypto_futures, requestedWeek ?? "all"),
                ) ?? emptyKataraktiMetrics,
                {
                  annualizeSharpe,
                  sharpeAlreadyAnnualized: annualizeSharpe,
                },
              )
            : emptyKataraktiMetrics,
          mt5_forex: v3SnapshotsByMarket.mt5_forex
            ? finalizeComparisonMetrics(
                toKataraktiComparisonMetrics(
                  buildKataraktiPeriodMetrics(v3SnapshotsByMarket.mt5_forex, requestedWeek ?? "all"),
                ) ?? emptyKataraktiMetrics,
                {
                  annualizeSharpe,
                  sharpeAlreadyAnnualized: annualizeSharpe,
                },
              )
            : emptyKataraktiMetrics,
        },
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
