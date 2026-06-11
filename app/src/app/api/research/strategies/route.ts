/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Research strategies explorer API. Returns registry entries with
 * DB coverage and summary metrics from strategy_backtest_* tables.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse } from "next/server";
import { readCanonicalPerformanceReport } from "@/lib/performance/canonicalPerformanceReport";
import {
  listLatestStrategyBacktestRuns,
  readStrategyBacktestWeeklySeries,
} from "@/lib/performance/strategyBacktestHistory";
import { listPerformanceStrategyEntries } from "@/lib/performance/strategyRegistry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StrategyExplorerEntry = {
  entryId: string;
  label: string;
  badge: string;
  family: string;
  dataMode: string;
  pending: boolean;
  pendingLabel: string | null;
  hasDbRun: boolean;
  runId: number | null;
  generatedUtc: string | null;
  weeklyCount: number;
  tradeCount: number;
  latestWeekOpenUtc: string | null;
  totalReturn: number | null;
  maxDrawdown: number | null;
  weeklyWinRate: number | null;
  sharpe: number | null;
  avgWeekly: number | null;
  trades: number | null;
  tradeWinRate: number | null;
  metricsSourceMode: "canonical_report" | "strategy_backtest_db" | "unavailable";
  metricsSourceLabel: string | null;
};

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export async function GET() {
  try {
    const [registryEntries, dbRuns, canonicalReport] = await Promise.all([
      Promise.resolve(listPerformanceStrategyEntries()),
      listLatestStrategyBacktestRuns(),
      readCanonicalPerformanceReport().catch(() => null),
    ]);
    const canonicalSystemsById = new Map(
      (canonicalReport?.compositeSystems ?? []).map((entry) => [entry.system, entry]),
    );

    const entries: StrategyExplorerEntry[] = [];

    for (const entry of registryEntries) {
      const dbRun = dbRuns.find((run) => {
        if (entry.backtestBotId) {
          if (run.botId !== entry.backtestBotId) return false;
          if (entry.backtestVariant && run.variant !== entry.backtestVariant) return false;
          if (entry.backtestMarket && run.market !== entry.backtestMarket) return false;
          return true;
        }
        if (entry.kataraktiVariant && entry.market) {
          return run.variant === entry.kataraktiVariant && run.market === entry.market;
        }
        return false;
      });

      let metrics: Pick<
        StrategyExplorerEntry,
        | "totalReturn"
        | "maxDrawdown"
        | "weeklyWinRate"
        | "sharpe"
        | "avgWeekly"
        | "trades"
        | "tradeWinRate"
      > = {
        totalReturn: null,
        maxDrawdown: null,
        weeklyWinRate: null,
        sharpe: null,
        avgWeekly: null,
        trades: null,
        tradeWinRate: null,
      };
      let metricsSourceMode: StrategyExplorerEntry["metricsSourceMode"] = "unavailable";
      let metricsSourceLabel: string | null = null;

      const canonicalSystem = canonicalSystemsById.get(entry.entryId);

      if (canonicalSystem) {
        const weekReturns = canonicalSystem.weeklyReturns.map((row) => row.returnPct);
        const weeks = canonicalSystem.weeklyReturns.length;
        const totalReturn = canonicalSystem.simpleReturnPct;
        const avgWeekly = weeks > 0 ? totalReturn / weeks : 0;
        let sharpe = 0;
        if (weeks > 1) {
          const variance =
            weekReturns.reduce((sum, value) => sum + (value - avgWeekly) ** 2, 0) / (weeks - 1);
          const stdDev = Math.sqrt(variance);
          sharpe = stdDev > 0 ? avgWeekly / stdDev : 0;
        }

        metrics = {
          totalReturn,
          maxDrawdown: canonicalSystem.maxDrawdownSimplePct,
          weeklyWinRate: canonicalSystem.winRatePct,
          sharpe,
          avgWeekly,
          trades: canonicalSystem.totalTrades,
          tradeWinRate:
            canonicalSystem.totalTrades > 0
              ? (canonicalSystem.totalWins / canonicalSystem.totalTrades) * 100
              : 0,
        };
        metricsSourceMode = "canonical_report";
        metricsSourceLabel = "Canonical reconstruction report";
      } else if (dbRun && dbRun.weeklyCount > 0) {
        try {
          const series = await readStrategyBacktestWeeklySeries({
            botId: dbRun.botId,
            variant: dbRun.variant,
            market: dbRun.market,
            requestedWeek: null,
            fallbackToAllTime: true,
          });

          if (series && series.rows.length > 0) {
            const weekReturns = series.rows.map((row) => row.return_percent);
            const totalReturn = weekReturns.reduce((sum, value) => sum + value, 0);
            const weeks = weekReturns.length;
            const weekWins = weekReturns.filter((value) => value > 0).length;
            const avgWeekly = weeks > 0 ? totalReturn / weeks : 0;
            const weeklyWinRate = weeks > 0 ? (weekWins / weeks) * 100 : 0;

            let sharpe = 0;
            if (weeks > 1) {
              const avg = totalReturn / weeks;
              const variance = weekReturns.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (weeks - 1);
              const stdDev = Math.sqrt(variance);
              sharpe = stdDev > 0 ? avg / stdDev : 0;
            }

            let equity = 100;
            let peak = 100;
            let maxDrawdown = 0;
            for (const value of weekReturns) {
              equity *= 1 + value / 100;
              if (equity > peak) peak = equity;
              if (peak > 0) {
                const drawdown = ((peak - equity) / peak) * 100;
                if (drawdown > maxDrawdown) {
                  maxDrawdown = drawdown;
                }
              }
            }

            const totalTrades = series.rows.reduce((sum, row) => sum + row.priced_trades, 0);
            const totalWins = series.rows.reduce((sum, row) => sum + row.wins, 0);
            const tradeWinRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

              metrics = {
                totalReturn,
                maxDrawdown,
                weeklyWinRate,
                sharpe,
                avgWeekly,
                trades: totalTrades,
                tradeWinRate,
              };
              metricsSourceMode = "strategy_backtest_db";
              metricsSourceLabel = "Strategy backtest DB";
          }
        } catch {
          // Keep null metrics for this entry.
        }
      }

      const canonicalWeekCount = canonicalSystem?.weeks ?? 0;
      const canonicalTradeCount = canonicalSystem?.totalTrades ?? 0;
      const canonicalLatestWeek =
        canonicalSystem?.weeklyReturns[canonicalSystem.weeklyReturns.length - 1]?.weekOpenUtc ?? null;

      entries.push({
        entryId: entry.entryId,
        label: entry.label,
        badge: entry.badge,
        family: entry.family,
        dataMode: entry.dataMode,
        pending: entry.pending ?? false,
        pendingLabel: entry.pendingLabel ?? null,
        hasDbRun: Boolean(dbRun),
        runId: dbRun?.runId ?? null,
        generatedUtc: dbRun?.generatedUtc ?? null,
        weeklyCount: dbRun?.weeklyCount ?? canonicalWeekCount,
        tradeCount: dbRun?.tradeCount ?? canonicalTradeCount,
        latestWeekOpenUtc: dbRun?.latestWeekOpenUtc ?? canonicalLatestWeek,
        totalReturn: metrics.totalReturn,
        maxDrawdown: metrics.maxDrawdown,
        weeklyWinRate: metrics.weeklyWinRate,
        sharpe: metrics.sharpe,
        avgWeekly: metrics.avgWeekly,
        trades: isFiniteNumber(metrics.trades) ? metrics.trades : null,
        tradeWinRate: metrics.tradeWinRate,
        metricsSourceMode,
        metricsSourceLabel,
      });
    }

    return NextResponse.json({ ok: true, entries });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
