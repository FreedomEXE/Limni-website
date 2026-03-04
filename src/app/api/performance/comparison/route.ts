/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: src/app/api/performance/comparison/route.ts
 *
 * Description:
 * Builds comparison metrics payloads for Universal, Tiered, and Katarakti
 * systems across selected historical periods.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
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
  type KataraktiMarketSnapshot,
} from "@/lib/performance/kataraktiHistory";
import { buildKataraktiPeriodMetrics } from "@/lib/performance/kataraktiMetrics";
import {
  listPerformanceStrategyEntries,
  resolveComparisonSourceKey,
  type PerformanceComparisonSourceKey,
  type PerformanceStrategyEntry,
} from "@/lib/performance/strategyRegistry";
import { readStrategyBacktestWeeklySeries } from "@/lib/performance/strategyBacktestHistory";
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
type ComparisonSourceMeta = {
  mode: "strategy_backtest_db" | "performance_snapshots" | "tiered_derived" | "katarakti_snapshot" | "unavailable";
  sourcePath: string;
  fallbackLabel?: string | null;
  fallbackToAllTime?: boolean;
};
type StrategyComparisonEntry = {
  entryId: string;
  metrics: ComparisonMetrics;
  source: ComparisonSourceMeta;
};

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

function computeMaxDrawdownFromWeeklyReturns(returns: number[]): number | null {
  if (returns.length === 0) return null;
  let equity = 100;
  let peak = equity;
  let maxDrawdown = 0;
  for (const value of returns) {
    equity *= 1 + value / 100;
    if (equity > peak) {
      peak = equity;
      continue;
    }
    if (peak <= 0) continue;
    const drawdown = ((peak - equity) / peak) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  return maxDrawdown > 0 ? maxDrawdown : null;
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
    maxDrawdown: options.maxDrawdown ?? computeMaxDrawdownFromWeeklyReturns(options.weekReturns),
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
    gross_profit_pct?: number | null;
    gross_loss_pct?: number | null;
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
  const curveMaxDrawdown = computeMaxDrawdownFromWeeklyReturns(weekReturns) ?? 0;
  const staticMaxDrawdown = weeklyRows.length > 0
    ? weeklyRows.reduce((max, row) => Math.max(max, row.week_max_drawdown ?? 0), 0)
    : 0;
  const maxDrawdown = Math.max(curveMaxDrawdown, staticMaxDrawdown) || null;
  const grossProfitPct = weeklyRows.reduce(
    (sum, row) => sum + (Number.isFinite(row.gross_profit_pct) ? (row.gross_profit_pct as number) : 0),
    0,
  );
  const grossLossPct = weeklyRows.reduce(
    (sum, row) => sum + (Number.isFinite(row.gross_loss_pct) ? (row.gross_loss_pct as number) : 0),
    0,
  );
  const grossProfitFactor =
    grossLossPct > 0
      ? grossProfitPct / grossLossPct
      : grossProfitPct > 0
        ? Number.POSITIVE_INFINITY
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
        : grossProfitFactor,
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

function resolveKataraktiMetricsWithFallback(options: {
  snapshot: KataraktiMarketSnapshot;
  requestedWeek: string | null;
}) {
  const primary = buildKataraktiPeriodMetrics(
    options.snapshot,
    options.requestedWeek ?? "all",
  );
  if (
    options.requestedWeek !== null &&
    primary.weeks === 0 &&
    options.snapshot.weekly.length > 0
  ) {
    return buildKataraktiPeriodMetrics(options.snapshot, "all");
  }
  return primary;
}

function buildKataraktiSourceMeta(snapshot: KataraktiMarketSnapshot | null): ComparisonSourceMeta {
  if (!snapshot) {
    return {
      mode: "unavailable",
      sourcePath: "unavailable",
      fallbackLabel: null,
      fallbackToAllTime: false,
    };
  }
  return {
    mode: "katarakti_snapshot",
    sourcePath: snapshot.sourcePath,
    fallbackLabel: snapshot.fallbackLabel ?? null,
    fallbackToAllTime: false,
  };
}

function resolveMetricsFromSourceKey(
  sourceKey: PerformanceComparisonSourceKey,
  options: {
    universalMetrics: {
      v1: ComparisonMetrics;
      v2: ComparisonMetrics;
      v3: ComparisonMetrics;
    };
    tieredMetrics: {
      v1: ComparisonMetrics;
      v2: ComparisonMetrics;
      v3: ComparisonMetrics;
    };
    kataraktiMetrics: {
      core: {
        crypto_futures: ComparisonMetrics;
        mt5_forex: ComparisonMetrics;
      };
      lite: {
        crypto_futures: ComparisonMetrics;
        mt5_forex: ComparisonMetrics;
      };
      v3: {
        crypto_futures: ComparisonMetrics;
        mt5_forex: ComparisonMetrics;
      };
    };
  },
) {
  if (sourceKey.family === "universal" && sourceKey.systemVersion) {
    return options.universalMetrics[sourceKey.systemVersion] ?? null;
  }
  if (sourceKey.family === "tiered" && sourceKey.systemVersion) {
    return options.tieredMetrics[sourceKey.systemVersion] ?? null;
  }
  if (sourceKey.family === "katarakti" && sourceKey.kataraktiVariant && sourceKey.kataraktiMarket) {
    return options.kataraktiMetrics[sourceKey.kataraktiVariant]?.[sourceKey.kataraktiMarket] ?? null;
  }
  return null;
}

function resolveSourceFromSourceKey(
  sourceKey: PerformanceComparisonSourceKey,
  options: {
    universalSources: {
      v1: ComparisonSourceMeta;
      v2: ComparisonSourceMeta;
      v3: ComparisonSourceMeta;
    };
    tieredSources: {
      v1: ComparisonSourceMeta;
      v2: ComparisonSourceMeta;
      v3: ComparisonSourceMeta;
    };
    kataraktiSources: {
      core: {
        crypto_futures: ComparisonSourceMeta;
        mt5_forex: ComparisonSourceMeta;
      };
      lite: {
        crypto_futures: ComparisonSourceMeta;
        mt5_forex: ComparisonSourceMeta;
      };
      v3: {
        crypto_futures: ComparisonSourceMeta;
        mt5_forex: ComparisonSourceMeta;
      };
    };
  },
) {
  if (sourceKey.family === "universal" && sourceKey.systemVersion) {
    return options.universalSources[sourceKey.systemVersion] ?? null;
  }
  if (sourceKey.family === "tiered" && sourceKey.systemVersion) {
    return options.tieredSources[sourceKey.systemVersion] ?? null;
  }
  if (sourceKey.family === "katarakti" && sourceKey.kataraktiVariant && sourceKey.kataraktiMarket) {
    return options.kataraktiSources[sourceKey.kataraktiVariant]?.[sourceKey.kataraktiMarket] ?? null;
  }
  return null;
}

function buildStrategiesMap(options: {
  entries: PerformanceStrategyEntry[];
  emptyMetrics: ComparisonMetrics;
  universalMetrics: {
    v1: ComparisonMetrics;
    v2: ComparisonMetrics;
    v3: ComparisonMetrics;
  };
  tieredMetrics: {
    v1: ComparisonMetrics;
    v2: ComparisonMetrics;
    v3: ComparisonMetrics;
  };
  kataraktiMetrics: {
    core: {
      crypto_futures: ComparisonMetrics;
      mt5_forex: ComparisonMetrics;
    };
    lite: {
      crypto_futures: ComparisonMetrics;
      mt5_forex: ComparisonMetrics;
    };
    v3: {
      crypto_futures: ComparisonMetrics;
      mt5_forex: ComparisonMetrics;
    };
  };
  universalSources: {
    v1: ComparisonSourceMeta;
    v2: ComparisonSourceMeta;
    v3: ComparisonSourceMeta;
  };
  tieredSources: {
    v1: ComparisonSourceMeta;
    v2: ComparisonSourceMeta;
    v3: ComparisonSourceMeta;
  };
  kataraktiSources: {
    core: {
      crypto_futures: ComparisonSourceMeta;
      mt5_forex: ComparisonSourceMeta;
    };
    lite: {
      crypto_futures: ComparisonSourceMeta;
      mt5_forex: ComparisonSourceMeta;
    };
    v3: {
      crypto_futures: ComparisonSourceMeta;
      mt5_forex: ComparisonSourceMeta;
    };
  };
}) {
  const strategies: Record<string, StrategyComparisonEntry> = {};
  for (const entry of options.entries) {
    const sourceKey = resolveComparisonSourceKey(entry);
    if (!sourceKey) continue;
    const metrics =
      resolveMetricsFromSourceKey(sourceKey, {
        universalMetrics: options.universalMetrics,
        tieredMetrics: options.tieredMetrics,
        kataraktiMetrics: options.kataraktiMetrics,
      }) ?? options.emptyMetrics;
    const source =
      resolveSourceFromSourceKey(sourceKey, {
        universalSources: options.universalSources,
        tieredSources: options.tieredSources,
        kataraktiSources: options.kataraktiSources,
      }) ?? {
        mode: "unavailable",
        sourcePath: "unavailable",
      };
    strategies[entry.entryId] = {
      entryId: entry.entryId,
      metrics,
      source,
    };
  }
  return strategies;
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

    const universalV1Backtest = await readStrategyBacktestWeeklySeries({
      botId: "universal_v1_tp1_friday_carry_aligned",
      variant: "v1",
      market: "multi_asset",
      requestedWeek,
      fallbackToAllTime: true,
    });

    const v1Metrics = finalizeComparisonMetrics(
      universalV1Backtest && universalV1Backtest.rows.length > 0
        ? computeMetricsFromWeeklyRows(universalV1Backtest.rows)
        : computeMetrics(comparisonSnapshots, V1_MODELS, selectedWeeks),
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

    const universal = {
      v1: v1Metrics,
      v2: v2Metrics,
      v3: v3Metrics,
    };
    const katarakti = {
      core: {
        crypto_futures: coreSnapshotsByMarket.crypto_futures
          ? finalizeComparisonMetrics(
              toKataraktiComparisonMetrics(
                resolveKataraktiMetricsWithFallback({
                  snapshot: coreSnapshotsByMarket.crypto_futures,
                  requestedWeek,
                }),
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
                resolveKataraktiMetricsWithFallback({
                  snapshot: coreSnapshotsByMarket.mt5_forex,
                  requestedWeek,
                }),
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
                resolveKataraktiMetricsWithFallback({
                  snapshot: liteSnapshotsByMarket.crypto_futures,
                  requestedWeek,
                }),
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
                resolveKataraktiMetricsWithFallback({
                  snapshot: liteSnapshotsByMarket.mt5_forex,
                  requestedWeek,
                }),
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
                resolveKataraktiMetricsWithFallback({
                  snapshot: v3SnapshotsByMarket.crypto_futures,
                  requestedWeek,
                }),
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
    };
    const sources: {
      universal: {
        v1: ComparisonSourceMeta;
        v2: ComparisonSourceMeta;
        v3: ComparisonSourceMeta;
      };
      tiered: {
        v1: ComparisonSourceMeta;
        v2: ComparisonSourceMeta;
        v3: ComparisonSourceMeta;
      };
      katarakti: {
        core: {
          crypto_futures: ComparisonSourceMeta;
          mt5_forex: ComparisonSourceMeta;
        };
        lite: {
          crypto_futures: ComparisonSourceMeta;
          mt5_forex: ComparisonSourceMeta;
        };
        v3: {
          crypto_futures: ComparisonSourceMeta;
          mt5_forex: ComparisonSourceMeta;
        };
      };
    } = {
      universal: {
        v1: universalV1Backtest && universalV1Backtest.rows.length > 0
          ? {
              mode: "strategy_backtest_db",
              sourcePath: universalV1Backtest.sourcePath,
              fallbackToAllTime: universalV1Backtest.fellBackToAllTime,
              fallbackLabel: null,
            }
          : {
              mode: "performance_snapshots",
              sourcePath: "db:performance_snapshots",
              fallbackToAllTime: false,
              fallbackLabel: null,
            },
        v2: {
          mode: "performance_snapshots",
          sourcePath: "db:performance_snapshots",
          fallbackToAllTime: false,
          fallbackLabel: null,
        },
        v3: {
          mode: "performance_snapshots",
          sourcePath: "db:performance_snapshots",
          fallbackToAllTime: false,
          fallbackLabel: null,
        },
      },
      tiered: {
        v1: {
          mode: "tiered_derived",
          sourcePath: "derived:performance_snapshots+tiered",
          fallbackToAllTime: false,
          fallbackLabel: null,
        },
        v2: {
          mode: "tiered_derived",
          sourcePath: "derived:performance_snapshots+tiered",
          fallbackToAllTime: false,
          fallbackLabel: null,
        },
        v3: {
          mode: "tiered_derived",
          sourcePath: "derived:performance_snapshots+tiered",
          fallbackToAllTime: false,
          fallbackLabel: null,
        },
      },
      katarakti: {
        core: {
          crypto_futures: buildKataraktiSourceMeta(coreSnapshotsByMarket.crypto_futures),
          mt5_forex: buildKataraktiSourceMeta(coreSnapshotsByMarket.mt5_forex),
        },
        lite: {
          crypto_futures: buildKataraktiSourceMeta(liteSnapshotsByMarket.crypto_futures),
          mt5_forex: buildKataraktiSourceMeta(liteSnapshotsByMarket.mt5_forex),
        },
        v3: {
          crypto_futures: buildKataraktiSourceMeta(v3SnapshotsByMarket.crypto_futures),
          mt5_forex: buildKataraktiSourceMeta(v3SnapshotsByMarket.mt5_forex),
        },
      },
    };
    const strategies = buildStrategiesMap({
      entries: listPerformanceStrategyEntries(),
      emptyMetrics: emptyKataraktiMetrics,
      universalMetrics: universal,
      tieredMetrics: tiered,
      kataraktiMetrics: katarakti,
      universalSources: sources.universal,
      tieredSources: sources.tiered,
      kataraktiSources: sources.katarakti,
    });

    return NextResponse.json({
      strategies,
      v1: v1Metrics,
      v2: v2Metrics,
      v3: v3Metrics,
      universal,
      tiered,
      katarakti,
      sources,
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
