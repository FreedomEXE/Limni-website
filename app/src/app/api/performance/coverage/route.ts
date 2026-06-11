/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: src/app/api/performance/coverage/route.ts
 *
 * Description:
 * Performance data coverage matrix for backtest + live pipelines.
 * Surfaces latest strategy_backtest runs and Katarakti snapshot sources
 * so missing/incorrect data can be audited quickly.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse } from "next/server";
import { listPerformanceWeeks, readAllPerformanceSnapshots } from "@/lib/performanceSnapshots";
import {
  readKataraktiMarketSnapshotsByVariant,
  type KataraktiMarketSnapshot,
} from "@/lib/performance/kataraktiHistory";
import { listLatestStrategyBacktestRuns } from "@/lib/performance/strategyBacktestHistory";

type CoverageTarget = {
  key: string;
  label: string;
  pipeline: "backtest_store" | "snapshot_derived" | "pending";
  botId?: string;
  variant?: string;
  market?: string;
};

const COVERAGE_TARGETS: CoverageTarget[] = [
  {
    key: "universal.v1.multi_asset",
    label: "Universal v1",
    pipeline: "backtest_store",
    botId: "universal_v1_tp1_friday_carry_aligned",
    variant: "v1",
    market: "multi_asset",
  },
  {
    key: "universal.v2",
    label: "Universal v2",
    pipeline: "snapshot_derived",
  },
  {
    key: "universal.v3",
    label: "Universal v3",
    pipeline: "snapshot_derived",
  },
  {
    key: "tiered.v1",
    label: "Tiered v1",
    pipeline: "snapshot_derived",
  },
  {
    key: "tiered.v2",
    label: "Tiered v2",
    pipeline: "snapshot_derived",
  },
  {
    key: "tiered.v3",
    label: "Tiered v3",
    pipeline: "snapshot_derived",
  },
  {
    key: "katarakti.v3.crypto_futures",
    label: "Katarakti v3 (Liq Sweep)",
    pipeline: "backtest_store",
    botId: "katarakti_v3_liq_sweep",
    variant: "v3",
    market: "crypto_futures",
  },
  {
    key: "katarakti.lite.crypto_futures",
    label: "Katarakti Lite Crypto",
    pipeline: "backtest_store",
    botId: "katarakti_crypto_lite",
    variant: "lite",
    market: "crypto_futures",
  },
  {
    key: "katarakti.lite.mt5_forex",
    label: "Katarakti Lite CFD",
    pipeline: "backtest_store",
    botId: "katarakti_cfd_lite",
    variant: "lite",
    market: "mt5_forex",
  },
];

function summarizeSnapshot(snapshot: KataraktiMarketSnapshot | null) {
  if (!snapshot) {
    return {
      available: false,
      sourcePath: "unavailable",
      fallbackLabel: null,
      weeks: 0,
      trades: 0,
      totalReturnPct: 0,
    };
  }
  return {
    available: true,
    sourcePath: snapshot.sourcePath,
    fallbackLabel: snapshot.fallbackLabel ?? null,
    weeks: snapshot.weeks,
    trades: snapshot.totalTrades,
    totalReturnPct: snapshot.totalReturnPct,
  };
}

export async function GET() {
  try {
    const [latestRuns, weeks, snapshotRows, core, lite, v3] = await Promise.all([
      listLatestStrategyBacktestRuns(),
      listPerformanceWeeks(12),
      readAllPerformanceSnapshots(1200),
      readKataraktiMarketSnapshotsByVariant("core"),
      readKataraktiMarketSnapshotsByVariant("lite"),
      readKataraktiMarketSnapshotsByVariant("v3"),
    ]);

    const byKey = new Map<string, (typeof latestRuns)[number]>(
      latestRuns.map((run) => [`${run.botId}|${run.variant}|${run.market}`, run] as const),
    );
    const targetCoverage = COVERAGE_TARGETS.map((target) => {
      const key = target.botId && target.variant && target.market
        ? `${target.botId}|${target.variant}|${target.market}`
        : null;
      const run = key ? byKey.get(key) : null;
      return {
        ...target,
        present: target.pipeline === "backtest_store" ? Boolean(run) : true,
        source:
          target.pipeline === "snapshot_derived"
            ? "db:performance_snapshots"
            : target.pipeline === "pending"
              ? "pending"
              : run
                ? `db:strategy_backtest_runs:${run.runId}`
                : "missing",
        runId: run?.runId ?? null,
        generatedUtc: run?.generatedUtc ?? null,
        weeklyCount: run?.weeklyCount ?? 0,
        tradeCount: run?.tradeCount ?? 0,
        latestWeekOpenUtc: run?.latestWeekOpenUtc ?? null,
      };
    });

    return NextResponse.json({
      status: "ok",
      generatedUtc: new Date().toISOString(),
      snapshotCoverage: {
        weeksAvailable: weeks.length,
        latestWeekOpenUtc: weeks[0] ?? null,
        rowsScanned: snapshotRows.length,
      },
      strategyBacktests: {
        totalLatestRuns: latestRuns.length,
        latestRuns,
        expectedTargets: targetCoverage,
      },
      kataraktiSnapshots: {
        core: {
          crypto_futures: summarizeSnapshot(core.crypto_futures),
          mt5_forex: summarizeSnapshot(core.mt5_forex),
        },
        lite: {
          crypto_futures: summarizeSnapshot(lite.crypto_futures),
          mt5_forex: summarizeSnapshot(lite.mt5_forex),
        },
        v3: {
          crypto_futures: summarizeSnapshot(v3.crypto_futures),
          mt5_forex: summarizeSnapshot(v3.mt5_forex),
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        generatedUtc: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
