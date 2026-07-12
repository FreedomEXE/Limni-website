/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-basket-exit-grid.ts
 *
 * Description:
 * Comprehensive basket exit grid search across all weekly-hold strategies
 * using the canonical engine with f2=adr_normalized for parity.
 *
 * Exit model:
 *   - Basket TP = tp_frac × basket_ADR
 *   - Basket trail activates only after TP hit, stop = peak - trail_frac × basket_ADR
 *   - Basket SL = -sl_frac × basket_ADR (active from day 1)
 *   - If no exit triggers, hold to Friday close
 *
 * Uses the exact same weekly trade set and ADR normalization source as the app:
 *   computeMultiWeekHold(strategy, weeks, weekly_hold, adr_normalized)
 *   + loadWeeklyAdrMap() / getAdrPct() / getTargetAdrPct()
 *
 * Usage:
 *   npx tsx scripts/backtest-basket-exit-grid.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getPool } from "../src/lib/db";
import { loadWeeklyAdrMap, getAdrPct, getTargetAdrPct } from "../src/lib/performance/adrLookup";
import { computeMultiWeekHold } from "../src/lib/performance/weeklyHoldEngine";
import { getEntryStyle, getStrengthGate, getStrategy } from "../src/lib/performance/strategyConfig";

const STRATEGY_IDS = [
  "dealer",
  "sentiment",
  "tiered_v3",
  "agree_2of3",
  "selector_sentiment_override",
  "strength",
] as const;

const TP_FRACS = [0.15, 0.20, 0.25, 0.30] as const;
const TRAIL_FRACS = [0, 0.15, 0.20, 0.25, 0.30] as const;
const SL_FRACS = [0, 0.10, 0.15, 0.20, 0.25, 0.30] as const;

const RDD_SCORE_CAP = 1000;

type DailyBar = {
  symbol: string;
  barOpenUtc: string;
  closePrice: number;
};

type NormPosition = {
  symbol: string;
  direction: "LONG" | "SHORT";
  openPrice: number;
  multiplier: number;
};

type DaySnapshot = {
  day: number;
  barDate: string;
  normPnl: number;
};

type ExitConfig = {
  tpFrac: number;
  trailFrac: number;
  slFrac: number;
  key: string;
};

type ExitResult = {
  exitReturn: number;
  exitDay: number;
  exitReason: "TP" | "TRAIL" | "SL" | "FRIDAY";
  activatedTrail: boolean;
  peak: number | null;
};

type WeekPath = {
  weekOpenUtc: string;
  weekLabel: string;
  tradeCount: number;
  basketAdr: number;
  weekCloseReturn: number;
  pathFridayNorm: number;
  engineReturn: number;
  dailySnapshots: DaySnapshot[];
};

type AggStats = {
  weeklyReturns: number[];
  net: number;
  maxDD: number;
  retDD: number;
  losingWeeks: number;
  winRate: number;
};

type ConfigStats = AggStats & {
  config: ExitConfig;
  exitReasonCounts: Record<ExitResult["exitReason"], number>;
};

type StrategyRun = {
  strategyId: string;
  strategyLabel: string;
  engineNet: number;
  engineDD: number;
  scriptNet: number;
  parityDelta: number;
  baseline: AggStats;
  weeks: WeekPath[];
  configStats: ConfigStats[];
};

type CrossStrategyRow = {
  config: ExitConfig;
  averageDeltaScore: number;
  improvedCount: number;
  hurtCount: number;
  strategyRetDDs: number[];
  strategyDeltas: number[];
};

function buildExitConfigs(): ExitConfig[] {
  const configs: ExitConfig[] = [];
  for (const tpFrac of TP_FRACS) {
    for (const trailFrac of TRAIL_FRACS) {
      for (const slFrac of SL_FRACS) {
        configs.push({
          tpFrac,
          trailFrac,
          slFrac,
          key: `${tpFrac.toFixed(2)}|${trailFrac.toFixed(2)}|${slFrac.toFixed(2)}`,
        });
      }
    }
  }
  return configs;
}

async function loadWeeks(): Promise<string[]> {
  const pool = getPool();
  const result = await pool.query<{ wk: Date }>(
    `SELECT DISTINCT week_open_utc AS wk
     FROM strategy_backtest_trades
     WHERE run_id = 54
     ORDER BY wk`,
  );
  return result.rows.map((row) => new Date(row.wk).toISOString());
}

async function loadDailyBarsForWeek(weekOpenUtc: string): Promise<Map<string, DailyBar[]>> {
  const pool = getPool();
  const result = await pool.query<{
    symbol: string;
    bar_open_utc: Date;
    close_price: string;
  }>(
    `SELECT symbol, bar_open_utc, close_price
     FROM canonical_price_bars
     WHERE timeframe = '1d'
       AND bar_open_utc >= $1::timestamptz
       AND bar_open_utc < ($1::timestamptz + interval '7 days')
     ORDER BY symbol, bar_open_utc ASC`,
    [weekOpenUtc],
  );

  const barsBySymbol = new Map<string, DailyBar[]>();
  for (const row of result.rows) {
    const symbol = row.symbol.toUpperCase();
    if (!barsBySymbol.has(symbol)) barsBySymbol.set(symbol, []);
    barsBySymbol.get(symbol)!.push({
      symbol,
      barOpenUtc: new Date(row.bar_open_utc).toISOString(),
      closePrice: Number(row.close_price),
    });
  }
  return barsBySymbol;
}

function toWeekLabel(weekOpenUtc: string): string {
  return new Date(new Date(weekOpenUtc).getTime() + 86_400_000).toISOString().slice(5, 10);
}

function buildDailyPath(
  positions: NormPosition[],
  dailyBars: Map<string, DailyBar[]>,
): DaySnapshot[] {
  const allDates = new Set<string>();
  for (const position of positions) {
    const bars = dailyBars.get(position.symbol);
    if (!bars) continue;
    for (const bar of bars) allDates.add(bar.barOpenUtc);
  }

  const sortedDates = Array.from(allDates).sort();
  return sortedDates.map((date, index) => {
    let normSum = 0;

    for (const position of positions) {
      const bars = dailyBars.get(position.symbol);
      if (!bars || position.openPrice <= 0) continue;

      let bar: DailyBar | null = null;
      for (const candidate of bars) {
        if (candidate.barOpenUtc <= date) bar = candidate;
        else break;
      }
      if (!bar) continue;

      const rawPnl = ((bar.closePrice - position.openPrice) / position.openPrice) * 100;
      const directionalPnl = position.direction === "SHORT" ? -rawPnl : rawPnl;
      normSum += directionalPnl * position.multiplier;
    }

    return {
      day: index,
      barDate: date.slice(0, 10),
      normPnl: normSum,
    };
  });
}

function simulateExit(week: WeekPath, config: ExitConfig): ExitResult {
  if (week.tradeCount <= 0 || week.basketAdr <= 0 || week.dailySnapshots.length === 0) {
    return {
      exitReturn: week.weekCloseReturn,
      exitDay: Math.max(week.dailySnapshots.length - 1, 0),
      exitReason: "FRIDAY",
      activatedTrail: false,
      peak: null,
    };
  }

  const tpLevel = config.tpFrac * week.basketAdr;
  const slLevel = -config.slFrac * week.basketAdr;
  const trailDistance = config.trailFrac * week.basketAdr;

  let trailingActive = false;
  let peak = Number.NEGATIVE_INFINITY;

  for (const snapshot of week.dailySnapshots) {
    const pnl = snapshot.normPnl;

    if (config.slFrac > 0 && pnl <= slLevel) {
      return {
        exitReturn: slLevel,
        exitDay: snapshot.day,
        exitReason: "SL",
        activatedTrail: trailingActive,
        peak: Number.isFinite(peak) ? peak : null,
      };
    }

    if (!trailingActive && pnl >= tpLevel) {
      if (config.trailFrac === 0) {
        return {
          exitReturn: tpLevel,
          exitDay: snapshot.day,
          exitReason: "TP",
          activatedTrail: false,
          peak: null,
        };
      }

      trailingActive = true;
      peak = pnl;
    }

    if (trailingActive) {
      peak = Math.max(peak, pnl);
      const stopLevel = peak - trailDistance;
      if (pnl <= stopLevel) {
        return {
          exitReturn: stopLevel,
          exitDay: snapshot.day,
          exitReason: "TRAIL",
          activatedTrail: true,
          peak,
        };
      }
    }
  }

  return {
    exitReturn: week.weekCloseReturn,
    exitDay: week.dailySnapshots.length - 1,
    exitReason: "FRIDAY",
    activatedTrail: trailingActive,
    peak: Number.isFinite(peak) ? peak : null,
  };
}

function computeAgg(weeklyReturns: number[]): AggStats {
  const net = weeklyReturns.reduce((sum, value) => sum + value, 0);
  let peak = 0;
  let cumulative = 0;
  let maxDD = 0;
  let losingWeeks = 0;
  let wins = 0;

  for (const value of weeklyReturns) {
    cumulative += value;
    peak = Math.max(peak, cumulative);
    maxDD = Math.min(maxDD, cumulative - peak);
    if (value < 0) losingWeeks++;
    if (value > 0) wins++;
  }

  const retDD = maxDD < 0 ? net / Math.abs(maxDD) : (net > 0 ? Infinity : 0);
  const winRate = weeklyReturns.length > 0 ? (wins / weeklyReturns.length) * 100 : 0;
  return { weeklyReturns, net, maxDD, retDD, losingWeeks, winRate };
}

function retDdScore(value: number): number {
  if (Number.isFinite(value)) return value;
  if (value > 0) return RDD_SCORE_CAP;
  if (value < 0) return -RDD_SCORE_CAP;
  return 0;
}

function fmtPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function fmtRdd(value: number): string {
  if (value === Infinity) return "∞";
  if (value === -Infinity) return "-∞";
  return `${value.toFixed(1)}x`;
}

function fmtFrac(value: number): string {
  return value.toFixed(2);
}

function fmtDelta(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}x`;
}

function rankConfigStats(a: ConfigStats, b: ConfigStats): number {
  const aScore = retDdScore(a.retDD);
  const bScore = retDdScore(b.retDD);
  if (bScore !== aScore) return bScore - aScore;
  if (b.net !== a.net) return b.net - a.net;
  return Math.abs(a.maxDD) - Math.abs(b.maxDD);
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════════════════╗");
  console.log("║   BASKET EXIT GRID — TP × TRAIL × SL                                       ║");
  console.log("║   Weekly hold engine + ADR normalized overlay (canonical app parity path)  ║");
  console.log("║   120 exit configs × 6 strategies = 720 strategy-config runs               ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════════╝\n");

  const configs = buildExitConfigs();
  const weeks = await loadWeeks();
  const entryStyle = getEntryStyle("weekly_hold");
  const overlay = getStrengthGate("adr_normalized");
  const targetAdr = getTargetAdrPct();

  if (!entryStyle || !overlay) {
    throw new Error("Required weekly_hold entry style or adr_normalized overlay not found");
  }

  console.log(`Loaded ${weeks.length} realized candidate weeks from run_id=54`);
  console.log(`Built ${configs.length} exit configs\n`);

  console.log("Preloading daily bars and ADR maps...");
  const dailyBarsEntries = await Promise.all(
    weeks.map(async (weekOpenUtc) => [weekOpenUtc, await loadDailyBarsForWeek(weekOpenUtc)] as const),
  );
  const adrMapEntries = await Promise.all(
    weeks.map(async (weekOpenUtc) => [weekOpenUtc, await loadWeeklyAdrMap(weekOpenUtc)] as const),
  );
  const weeklyDailyBars = new Map(dailyBarsEntries);
  const weeklyAdrMaps = new Map(adrMapEntries);
  console.log("Preload complete.\n");

  const strategyRuns: StrategyRun[] = [];

  for (const strategyId of STRATEGY_IDS) {
    const strategy = getStrategy(strategyId);
    if (!strategy) {
      throw new Error(`Strategy not found: ${strategyId}`);
    }

    process.stdout.write(`Running ${strategy.label}...`);
    const engineResult = await computeMultiWeekHold(strategy, weeks, entryStyle, overlay);
    console.log(
      ` engine=${fmtPct(engineResult.totalReturnPct)} DD=${fmtPct(engineResult.maxDrawdownPct)} weeks=${engineResult.weeks.length}`,
    );

    const weekPaths: WeekPath[] = engineResult.weeks.map((week) => {
      const adrMap = weeklyAdrMaps.get(week.weekOpenUtc);
      const dailyBars = weeklyDailyBars.get(week.weekOpenUtc);
      if (!adrMap || !dailyBars) {
        throw new Error(`Missing preloaded ADR map or daily bars for ${week.weekOpenUtc}`);
      }

      const positions: NormPosition[] = week.trades.map((trade) => ({
        symbol: trade.symbol.toUpperCase(),
        direction: trade.direction,
        openPrice: trade.openPrice,
        multiplier: targetAdr / getAdrPct(adrMap, trade.symbol, trade.assetClass),
      }));

      const dailySnapshots = buildDailyPath(positions, dailyBars);
      const pathFridayNorm = dailySnapshots[dailySnapshots.length - 1]?.normPnl ?? week.totalReturnPct;

      return {
        weekOpenUtc: week.weekOpenUtc,
        weekLabel: toWeekLabel(week.weekOpenUtc),
        tradeCount: week.trades.length,
        basketAdr: targetAdr * week.trades.length,
        weekCloseReturn: week.totalReturnPct,
        pathFridayNorm,
        engineReturn: week.totalReturnPct,
        dailySnapshots,
      };
    });

    const baselineReturns = weekPaths.map((week) => week.weekCloseReturn);
    const baseline = computeAgg(baselineReturns);
    const scriptNet = baseline.net;
    const parityDelta = scriptNet - engineResult.totalReturnPct;

    const configStats: ConfigStats[] = configs.map((config) => {
      const weeklyReturns: number[] = [];
      const exitReasonCounts: Record<ExitResult["exitReason"], number> = {
        TP: 0,
        TRAIL: 0,
        SL: 0,
        FRIDAY: 0,
      };

      for (const week of weekPaths) {
        const exit = simulateExit(week, config);
        weeklyReturns.push(exit.exitReturn);
        exitReasonCounts[exit.exitReason]++;
      }

      return {
        config,
        ...computeAgg(weeklyReturns),
        exitReasonCounts,
      };
    }).sort(rankConfigStats);

    strategyRuns.push({
      strategyId,
      strategyLabel: strategy.label,
      engineNet: engineResult.totalReturnPct,
      engineDD: engineResult.maxDrawdownPct,
      scriptNet,
      parityDelta,
      baseline,
      weeks: weekPaths,
      configStats,
    });
  }

  console.log("\n" + "═".repeat(88));
  console.log("PARITY CHECK: Friday-close reconstruction vs engine baseline");
  console.log("═".repeat(88));
  console.log(
    "Strategy".padEnd(14),
    "Engine Net".padEnd(12),
    "Engine DD".padEnd(12),
    "Script Net".padEnd(12),
    "Δ Net".padEnd(10),
    "Status",
  );
  console.log("-".repeat(88));
  for (const run of strategyRuns) {
    const ok = Math.abs(run.parityDelta) <= 1 ? "OK" : "CHECK";
    console.log(
      run.strategyLabel.padEnd(14),
      fmtPct(run.engineNet).padEnd(12),
      fmtPct(run.engineDD).padEnd(12),
      fmtPct(run.scriptNet).padEnd(12),
      fmtPct(run.parityDelta).padEnd(10),
      ok,
    );
  }

  const crossStrategyRows: CrossStrategyRow[] = configs.map((config) => {
    const strategyRetDDs: number[] = [];
    const strategyDeltas: number[] = [];
    let improvedCount = 0;
    let hurtCount = 0;

    for (const run of strategyRuns) {
      const configStat = run.configStats.find((row) => row.config.key === config.key);
      if (!configStat) throw new Error(`Missing config stats for ${run.strategyLabel} ${config.key}`);

      const delta = retDdScore(configStat.retDD) - retDdScore(run.baseline.retDD);
      strategyRetDDs.push(configStat.retDD);
      strategyDeltas.push(delta);

      if (delta > 0.000001) improvedCount++;
      else if (delta < -0.000001) hurtCount++;
    }

    const averageDeltaScore = strategyDeltas.reduce((sum, value) => sum + value, 0) / strategyDeltas.length;
    return {
      config,
      averageDeltaScore,
      improvedCount,
      hurtCount,
      strategyRetDDs,
      strategyDeltas,
    };
  }).sort((a, b) => {
    if (b.improvedCount !== a.improvedCount) return b.improvedCount - a.improvedCount;
    if (a.hurtCount !== b.hurtCount) return a.hurtCount - b.hurtCount;
    return b.averageDeltaScore - a.averageDeltaScore;
  });

  const recommendation =
    crossStrategyRows.find((row) => row.hurtCount === 0 && row.improvedCount > 0)
    ?? crossStrategyRows[0];

  console.log("\n" + "═".repeat(120));
  console.log("PHASE 1: Per-strategy top 10 configs by R/DD");
  console.log("═".repeat(120));
  for (const run of strategyRuns) {
    console.log(
      `\nStrategy: ${run.strategyLabel} (baseline engine ${fmtPct(run.engineNet)}, DD ${fmtPct(run.engineDD)}; reconstructed ${fmtPct(run.baseline.net)}, R/DD ${fmtRdd(run.baseline.retDD)})`,
    );
    console.log(
      "#".padEnd(4),
      "TP".padEnd(6),
      "Trail".padEnd(7),
      "SL".padEnd(6),
      "Net".padEnd(10),
      "DD".padEnd(10),
      "R/DD".padEnd(8),
      "LWk".padEnd(5),
      "WR".padEnd(6),
      "│ Weekly returns",
    );
    console.log("-".repeat(120));

    run.configStats.slice(0, 10).forEach((row, index) => {
      console.log(
        String(index + 1).padEnd(4),
        fmtFrac(row.config.tpFrac).padEnd(6),
        fmtFrac(row.config.trailFrac).padEnd(7),
        fmtFrac(row.config.slFrac).padEnd(6),
        fmtPct(row.net).padEnd(10),
        fmtPct(row.maxDD).padEnd(10),
        fmtRdd(row.retDD).padEnd(8),
        String(row.losingWeeks).padEnd(5),
        `${row.winRate.toFixed(0)}%`.padEnd(6),
        "│ " + row.weeklyReturns.map((value) => fmtPct(value)).join("  "),
      );
    });
  }

  console.log("\n" + "═".repeat(120));
  console.log("PHASE 2: Cross-strategy ranking by average ΔR/DD vs baseline");
  console.log("Note: ranking score caps infinite R/DD at 1000x to keep one zero-DD outlier from dominating.");
  console.log("═".repeat(120));
  console.log(
    "#".padEnd(4),
    "TP".padEnd(6),
    "Trail".padEnd(7),
    "SL".padEnd(6),
    "Avg ΔR/DD".padEnd(11),
    "Imp".padEnd(5),
    "Hurt".padEnd(6),
    "│ Dealer  Sent   Tier   Agree  Select Stren",
  );
  console.log("-".repeat(120));
  crossStrategyRows.slice(0, 20).forEach((row, index) => {
    const perStrategy = row.strategyRetDDs.map((value) => fmtRdd(value).padEnd(6)).join(" ");
    console.log(
      String(index + 1).padEnd(4),
      fmtFrac(row.config.tpFrac).padEnd(6),
      fmtFrac(row.config.trailFrac).padEnd(7),
      fmtFrac(row.config.slFrac).padEnd(6),
      fmtDelta(row.averageDeltaScore).padEnd(11),
      String(row.improvedCount).padEnd(5),
      String(row.hurtCount).padEnd(6),
      "│ " + perStrategy,
    );
  });

  console.log("\n" + "═".repeat(120));
  console.log("PHASE 3: Recommended config");
  console.log("═".repeat(120));
  console.log(
    `Config: TP ${fmtFrac(recommendation.config.tpFrac)}, Trail ${fmtFrac(recommendation.config.trailFrac)}, SL ${fmtFrac(recommendation.config.slFrac)}`,
  );
  console.log(
    `Cross-strategy score: avg ΔR/DD ${fmtDelta(recommendation.averageDeltaScore)}, improved ${recommendation.improvedCount}/${strategyRuns.length}, hurt ${recommendation.hurtCount}/${strategyRuns.length}`,
  );
  if (recommendation.hurtCount > 0) {
    console.log("No universal no-hurt config was found; this is the best compromise under the ranking rule.");
  } else {
    console.log("This config improves at least one strategy without hurting any under the capped ΔR/DD score.");
  }

  console.log(
    "\n" +
      "Strategy".padEnd(14) +
      "Baseline".padEnd(20) +
      "Recommended".padEnd(22) +
      "ΔR/DD".padEnd(10) +
      "LWk".padEnd(5) +
      "WR".padEnd(6) +
      "│ Weekly returns",
  );
  console.log("-".repeat(120));

  for (const run of strategyRuns) {
    const stat = run.configStats.find((row) => row.config.key === recommendation.config.key);
    if (!stat) throw new Error(`Missing recommended config for ${run.strategyLabel}`);

    const delta = retDdScore(stat.retDD) - retDdScore(run.baseline.retDD);
    console.log(
      run.strategyLabel.padEnd(14) +
        `${fmtPct(run.baseline.net)} / ${fmtRdd(run.baseline.retDD)}`.padEnd(20) +
        `${fmtPct(stat.net)} / ${fmtRdd(stat.retDD)}`.padEnd(22) +
        fmtDelta(delta).padEnd(10) +
        String(stat.losingWeeks).padEnd(5) +
        `${stat.winRate.toFixed(0)}%`.padEnd(6) +
        "│ " +
        stat.weeklyReturns.map((value) => fmtPct(value)).join("  "),
    );
  }

  console.log("\nExit reason mix for recommended config:");
  for (const run of strategyRuns) {
    const stat = run.configStats.find((row) => row.config.key === recommendation.config.key);
    if (!stat) continue;
    console.log(
      `  ${run.strategyLabel}: TP=${stat.exitReasonCounts.TP}, Trail=${stat.exitReasonCounts.TRAIL}, SL=${stat.exitReasonCounts.SL}, Friday=${stat.exitReasonCounts.FRIDAY}`,
    );
  }

  const pool = getPool();
  await pool.end();
  console.log("\n✓ Grid search complete.");
}

main().catch(async (error) => {
  console.error("Grid search failed:", error);
  try {
    await getPool().end();
  } catch {
    // ignore pool shutdown errors
  }
  process.exit(1);
});
