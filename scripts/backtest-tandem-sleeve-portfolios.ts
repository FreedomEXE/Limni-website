/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-tandem-sleeve-portfolios.ts
 *
 * Description:
 * Portfolio-structure research for tandem variants using canonical weekly-hold
 * strategy paths with ADR normalization.
 *
 * Tests three portfolio constructions:
 *   - Legacy Tandem: dealer + commercial + sentiment
 *   - Tandem 4: dealer + commercial + sentiment + strength
 *   - Tandem 3: dealer + sentiment + strength
 *
 * For each portfolio, compare:
 *   - Friday hold (no early exit)
 *   - Shared basket SL 0.10
 *   - Independent sleeve SL 0.10
 *   - Shared basket TP 0.15 / Trail 0.15 / SL 0.10
 *   - Independent sleeve TP 0.15 / Trail 0.15 / SL 0.10
 *
 * Goal:
 *   Test the user's thesis that each model basket should be managed as its own
 *   sleeve so one losing sleeve can stop out while others continue through the
 *   week.
 *
 * Usage:
 *   npx tsx scripts/backtest-tandem-sleeve-portfolios.ts
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

type BaseStrategyId = "dealer" | "commercial" | "sentiment" | "strength";
type PortfolioId = "legacy_tandem" | "tandem_4" | "tandem_3";
type VariantId = "hold" | "shared_sl10" | "sleeves_sl10" | "shared_015_015_010" | "sleeves_015_015_010";
type ExitReason = "TP" | "TRAIL" | "SL" | "FRIDAY";

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

type StrategyWeekPath = {
  weekOpenUtc: string;
  weekLabel: string;
  strategyId: BaseStrategyId;
  strategyLabel: string;
  tradeCount: number;
  basketAdr: number;
  weekCloseReturn: number;
  dailySnapshots: DaySnapshot[];
};

type ExitConfig = {
  tpFrac: number | null;
  trailFrac: number | null;
  slFrac: number | null;
};

type ExitResult = {
  exitReturn: number;
  exitReason: ExitReason;
  exitDay: number;
};

type SleeveWeekResult = {
  strategyId: BaseStrategyId;
  strategyLabel: string;
  holdReturn: number;
  exitReturn: number;
  exitReason: ExitReason;
  tradeCount: number;
};

type PortfolioWeekResult = {
  weekOpenUtc: string;
  weekLabel: string;
  returnPct: number;
  sleeves: SleeveWeekResult[];
};

type AggStats = {
  weeklyReturns: number[];
  net: number;
  maxDD: number;
  retDD: number;
  losingWeeks: number;
  winRate: number;
};

type PortfolioVariantResult = AggStats & {
  id: VariantId;
  label: string;
  weeks: PortfolioWeekResult[];
};

type PortfolioSpec = {
  id: PortfolioId;
  label: string;
  sleeves: BaseStrategyId[];
};

const BASE_STRATEGIES: BaseStrategyId[] = ["dealer", "commercial", "sentiment", "strength"];

const PORTFOLIOS: PortfolioSpec[] = [
  {
    id: "legacy_tandem",
    label: "Legacy Tandem",
    sleeves: ["dealer", "commercial", "sentiment"],
  },
  {
    id: "tandem_4",
    label: "Tandem 4",
    sleeves: ["dealer", "commercial", "sentiment", "strength"],
  },
  {
    id: "tandem_3",
    label: "Tandem 3",
    sleeves: ["dealer", "sentiment", "strength"],
  },
];

const VARIANTS: Array<{
  id: VariantId;
  label: string;
  independentSleeves: boolean;
  exit: ExitConfig | null;
}> = [
  {
    id: "hold",
    label: "Friday Hold",
    independentSleeves: true,
    exit: null,
  },
  {
    id: "shared_sl10",
    label: "Shared SL 0.10",
    independentSleeves: false,
    exit: { tpFrac: null, trailFrac: null, slFrac: 0.10 },
  },
  {
    id: "sleeves_sl10",
    label: "Sleeves SL 0.10",
    independentSleeves: true,
    exit: { tpFrac: null, trailFrac: null, slFrac: 0.10 },
  },
  {
    id: "shared_015_015_010",
    label: "Shared 0.15/0.15/0.10",
    independentSleeves: false,
    exit: { tpFrac: 0.15, trailFrac: 0.15, slFrac: 0.10 },
  },
  {
    id: "sleeves_015_015_010",
    label: "Sleeves 0.15/0.15/0.10",
    independentSleeves: true,
    exit: { tpFrac: 0.15, trailFrac: 0.15, slFrac: 0.10 },
  },
];

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

  const bySymbol = new Map<string, DailyBar[]>();
  for (const row of result.rows) {
    const symbol = row.symbol.toUpperCase();
    if (!bySymbol.has(symbol)) bySymbol.set(symbol, []);
    bySymbol.get(symbol)!.push({
      symbol,
      barOpenUtc: new Date(row.bar_open_utc).toISOString(),
      closePrice: Number(row.close_price),
    });
  }
  return bySymbol;
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
    return { day: index, barDate: date.slice(0, 10), normPnl: normSum };
  });
}

function combineDailyPaths(weeks: StrategyWeekPath[]): DaySnapshot[] {
  const allDates = new Set<string>();
  for (const week of weeks) {
    for (const snapshot of week.dailySnapshots) allDates.add(snapshot.barDate);
  }
  const sortedDates = Array.from(allDates).sort();

  return sortedDates.map((date, index) => {
    let total = 0;
    for (const week of weeks) {
      let latest: DaySnapshot | null = null;
      for (const snapshot of week.dailySnapshots) {
        if (snapshot.barDate <= date) latest = snapshot;
        else break;
      }
      total += latest?.normPnl ?? 0;
    }
    return { day: index, barDate: date, normPnl: total };
  });
}

function simulateExit(week: Pick<StrategyWeekPath, "tradeCount" | "basketAdr" | "weekCloseReturn" | "dailySnapshots">, config: ExitConfig | null): ExitResult {
  if (!config) {
    return {
      exitReturn: week.weekCloseReturn,
      exitReason: "FRIDAY",
      exitDay: Math.max(week.dailySnapshots.length - 1, 0),
    };
  }

  if (week.tradeCount <= 0 || week.dailySnapshots.length === 0 || week.basketAdr <= 0) {
    return {
      exitReturn: week.weekCloseReturn,
      exitReason: "FRIDAY",
      exitDay: Math.max(week.dailySnapshots.length - 1, 0),
    };
  }

  const tpLevel = config.tpFrac !== null ? config.tpFrac * week.basketAdr : null;
  const trailDistance = config.trailFrac !== null ? config.trailFrac * week.basketAdr : null;
  const slLevel = config.slFrac !== null ? -(config.slFrac * week.basketAdr) : null;

  let trailActive = false;
  let peak = Number.NEGATIVE_INFINITY;

  for (const snapshot of week.dailySnapshots) {
    const pnl = snapshot.normPnl;

    if (slLevel !== null && pnl <= slLevel) {
      return { exitReturn: slLevel, exitReason: "SL", exitDay: snapshot.day };
    }

    if (!trailActive && tpLevel !== null && pnl >= tpLevel) {
      if (trailDistance === null || trailDistance === 0) {
        return { exitReturn: tpLevel, exitReason: "TP", exitDay: snapshot.day };
      }
      trailActive = true;
      peak = pnl;
    }

    if (trailActive && trailDistance !== null) {
      peak = Math.max(peak, pnl);
      const stopLevel = peak - trailDistance;
      if (pnl <= stopLevel) {
        return { exitReturn: stopLevel, exitReason: "TRAIL", exitDay: snapshot.day };
      }
    }
  }

  return {
    exitReturn: week.weekCloseReturn,
    exitReason: "FRIDAY",
    exitDay: Math.max(week.dailySnapshots.length - 1, 0),
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

function fmtPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function fmtRdd(value: number): string {
  return Number.isFinite(value) ? `${value.toFixed(1)}x` : "∞";
}

function fmtShort(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════════════════╗");
  console.log("║   TANDEM SLEEVE PORTFOLIOS                                                 ║");
  console.log("║   Canonical weekly-hold + ADR normalized paths                             ║");
  console.log("║   Compare shared basket exits vs independent sleeve exits                  ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════════╝\n");

  const weeks = await loadWeeks();
  const entryStyle = getEntryStyle("weekly_hold");
  const overlay = getStrengthGate("adr_normalized");
  const targetAdr = getTargetAdrPct();

  if (!entryStyle || !overlay) {
    throw new Error("Missing weekly_hold entry style or adr_normalized overlay");
  }

  console.log(`Loaded ${weeks.length} candidate weeks\n`);

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

  const strategyWeekPaths = new Map<BaseStrategyId, Map<string, StrategyWeekPath>>();

  for (const strategyId of BASE_STRATEGIES) {
    const strategy = getStrategy(strategyId);
    if (!strategy) throw new Error(`Strategy not found: ${strategyId}`);

    process.stdout.write(`Building ${strategy.label}...`);
    const engine = await computeMultiWeekHold(strategy, weeks, entryStyle, overlay);
    console.log(` ${engine.weeks.length} weeks, ${fmtPct(engine.totalReturnPct)}, DD ${fmtPct(engine.maxDrawdownPct)}`);

    const weekMap = new Map<string, StrategyWeekPath>();
    for (const week of engine.weeks) {
      const adrMap = weeklyAdrMaps.get(week.weekOpenUtc);
      const dailyBars = weeklyDailyBars.get(week.weekOpenUtc);
      if (!adrMap || !dailyBars) {
        throw new Error(`Missing preload for ${week.weekOpenUtc}`);
      }

      const positions: NormPosition[] = week.trades.map((trade) => ({
        symbol: trade.symbol.toUpperCase(),
        direction: trade.direction,
        openPrice: trade.openPrice,
        multiplier: targetAdr / getAdrPct(adrMap, trade.symbol, trade.assetClass),
      }));

      weekMap.set(week.weekOpenUtc, {
        weekOpenUtc: week.weekOpenUtc,
        weekLabel: toWeekLabel(week.weekOpenUtc),
        strategyId,
        strategyLabel: strategy.label,
        tradeCount: week.trades.length,
        basketAdr: targetAdr * week.trades.length,
        weekCloseReturn: week.totalReturnPct,
        dailySnapshots: buildDailyPath(positions, dailyBars),
      });
    }

    strategyWeekPaths.set(strategyId, weekMap);
  }

  const tandemEngine = await computeMultiWeekHold(getStrategy("tandem")!, weeks, entryStyle, overlay);
  const legacyHoldWeekMap = strategyWeekPaths.get("dealer")!;
  const legacyHoldWeeks = tandemEngine.weeks.map((week) => {
    const dealer = strategyWeekPaths.get("dealer")!.get(week.weekOpenUtc)!;
    const commercial = strategyWeekPaths.get("commercial")!.get(week.weekOpenUtc)!;
    const sentiment = strategyWeekPaths.get("sentiment")!.get(week.weekOpenUtc)!;
    return dealer.weekCloseReturn + commercial.weekCloseReturn + sentiment.weekCloseReturn;
  });
  const legacyHoldStats = computeAgg(legacyHoldWeeks);

  console.log("\n" + "═".repeat(88));
  console.log("Parity check: legacy tandem engine vs independent sleeve Friday-hold sum");
  console.log("═".repeat(88));
  console.log(
    `Engine tandem: ${fmtPct(tandemEngine.totalReturnPct)} / DD ${fmtPct(tandemEngine.maxDrawdownPct)} | Sleeve sum: ${fmtPct(legacyHoldStats.net)} / DD ${fmtPct(legacyHoldStats.maxDD)}`,
  );

  const portfolioResults = new Map<PortfolioId, PortfolioVariantResult[]>();

  for (const portfolio of PORTFOLIOS) {
    const results: PortfolioVariantResult[] = [];

    for (const variant of VARIANTS) {
      const weekResults: PortfolioWeekResult[] = [];

      for (const weekOpenUtc of weeks.slice(0, -1)) {
        const sleeveWeeks = portfolio.sleeves
          .map((strategyId) => strategyWeekPaths.get(strategyId)!.get(weekOpenUtc))
          .filter((value): value is StrategyWeekPath => Boolean(value));

        if (sleeveWeeks.length !== portfolio.sleeves.length) continue;

        if (variant.independentSleeves) {
          const sleeves = sleeveWeeks.map((sleeve) => {
            const exit = simulateExit(sleeve, variant.exit);
            return {
              strategyId: sleeve.strategyId,
              strategyLabel: sleeve.strategyLabel,
              holdReturn: sleeve.weekCloseReturn,
              exitReturn: exit.exitReturn,
              exitReason: exit.exitReason,
              tradeCount: sleeve.tradeCount,
            };
          });
          weekResults.push({
            weekOpenUtc,
            weekLabel: sleeveWeeks[0]!.weekLabel,
            returnPct: sleeves.reduce((sum, sleeve) => sum + sleeve.exitReturn, 0),
            sleeves,
          });
        } else {
          const combinedSnapshots = combineDailyPaths(sleeveWeeks);
          const combinedTradeCount = sleeveWeeks.reduce((sum, sleeve) => sum + sleeve.tradeCount, 0);
          const combinedBasketAdr = sleeveWeeks.reduce((sum, sleeve) => sum + sleeve.basketAdr, 0);
          const combinedWeekClose = sleeveWeeks.reduce((sum, sleeve) => sum + sleeve.weekCloseReturn, 0);
          const sharedExit = simulateExit(
            {
              tradeCount: combinedTradeCount,
              basketAdr: combinedBasketAdr,
              weekCloseReturn: combinedWeekClose,
              dailySnapshots: combinedSnapshots,
            },
            variant.exit,
          );

          const sleeves = sleeveWeeks.map((sleeve) => ({
            strategyId: sleeve.strategyId,
            strategyLabel: sleeve.strategyLabel,
            holdReturn: sleeve.weekCloseReturn,
            exitReturn: sleeve.weekCloseReturn,
            exitReason: sharedExit.exitReason,
            tradeCount: sleeve.tradeCount,
          }));

          weekResults.push({
            weekOpenUtc,
            weekLabel: sleeveWeeks[0]!.weekLabel,
            returnPct: sharedExit.exitReturn,
            sleeves,
          });
        }
      }

      results.push({
        id: variant.id,
        label: variant.label,
        weeks: weekResults,
        ...computeAgg(weekResults.map((week) => week.returnPct)),
      });
    }

    portfolioResults.set(portfolio.id, results);
  }

  console.log("\n" + "═".repeat(120));
  console.log("Portfolio summary");
  console.log("═".repeat(120));
  console.log(
    "Portfolio".padEnd(16),
    "Variant".padEnd(24),
    "Net".padEnd(10),
    "DD".padEnd(10),
    "R/DD".padEnd(8),
    "LWk".padEnd(5),
    "WR".padEnd(6),
    "│ Weekly returns",
  );
  console.log("-".repeat(120));

  for (const portfolio of PORTFOLIOS) {
    const variants = portfolioResults.get(portfolio.id)!;
    for (const variant of variants) {
      console.log(
        portfolio.label.padEnd(16),
        variant.label.padEnd(24),
        fmtPct(variant.net).padEnd(10),
        fmtPct(variant.maxDD).padEnd(10),
        fmtRdd(variant.retDD).padEnd(8),
        String(variant.losingWeeks).padEnd(5),
        `${variant.winRate.toFixed(0)}%`.padEnd(6),
        "│ " + variant.weeklyReturns.map(fmtShort).join("  "),
      );
    }
    console.log("-".repeat(120));
  }

  console.log("\n" + "═".repeat(120));
  console.log("Week-by-week detail: independent sleeves 0.15 / 0.15 / 0.10");
  console.log("═".repeat(120));
  for (const portfolio of PORTFOLIOS) {
    const variant = portfolioResults.get(portfolio.id)!.find((row) => row.id === "sleeves_015_015_010")!;
    console.log(`\n${portfolio.label}`);
    console.log(
      "Week".padEnd(7),
      "Total".padEnd(9),
      "│ " + portfolio.sleeves.map((id) => getStrategy(id)!.label.padEnd(24)).join("│ "),
    );
    console.log("-".repeat(120));

    for (const week of variant.weeks) {
      const sleeveText = portfolio.sleeves.map((strategyId) => {
        const sleeve = week.sleeves.find((item) => item.strategyId === strategyId);
        if (!sleeve) return "".padEnd(24);
        return `${fmtShort(sleeve.holdReturn)}→${fmtShort(sleeve.exitReturn)} ${sleeve.exitReason}`.padEnd(24);
      }).join("│ ");

      console.log(
        week.weekLabel.padEnd(7),
        fmtShort(week.returnPct).padEnd(9),
        "│ " + sleeveText,
      );
    }
  }

  const pool = getPool();
  await pool.end();
  console.log("\n✓ Tandem sleeve study complete.");
}

main().catch(async (error) => {
  console.error("Tandem sleeve study failed:", error);
  try {
    await getPool().end();
  } catch {
    // ignore
  }
  process.exit(1);
});
