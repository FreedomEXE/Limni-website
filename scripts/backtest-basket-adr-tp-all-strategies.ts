/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-basket-adr-tp-all-strategies.ts
 *
 * Description:
 * Basket-Level ADR TP simulation across ALL strategies × Weekly Hold.
 * Uses the ACTUAL app engine with f2=adr_normalized for parity.
 * TP is DYNAMIC per week: basket_TP = 0.25% × trade_count.
 * Week close = implicit stop (no SL).
 *
 * For each strategy × week:
 *   1. Run engine with adr_normalized overlay (exact app parity)
 *   2. Compute dynamic basket TP = 0.25% × N trades
 *   3. Load daily bars → compute daily normalized basket P&L path
 *   4. If basket P&L >= dynamic TP on any day → close at TP
 *   5. If not → hold to Friday close (normalized return)
 *
 * Also tests fixed multipliers of the base TP (0.5x, 0.75x, 1x, 1.5x, 2x)
 * to find optimal basket TP scaling.
 *
 * Usage: npx tsx scripts/backtest-basket-adr-tp-all-strategies.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { computeMultiWeekHold } from "../src/lib/performance/weeklyHoldEngine";
import {
  getStrategy,
  getEntryStyle,
  getStrengthGate,
  STRATEGIES,
} from "../src/lib/performance/strategyConfig";
import { loadWeeklyAdrMap, getAdrPct, getTargetAdrPct } from "../src/lib/performance/adrLookup";
import { getPool } from "../src/lib/db";

/* ─── Config ────────────────────────────────────────────────────── */

const ADR_PER_TRADE = 0.25; // Each trade's expected TP in ADR-normalized terms (%)
const TP_MULTIPLIERS = [0.5, 0.75, 1, 1.25, 1.5, 2]; // Multiples of base basket TP

// Strategies to skip
const SKIP_STRATEGIES = new Set(["tandem", "commercial"]);

/* ─── Load weeks ────────────────────────────────────────────────── */

async function loadWeeks(): Promise<string[]> {
  const pool = getPool();
  const result = await pool.query<{ wk: Date }>(
    `SELECT DISTINCT week_open_utc AS wk
     FROM strategy_backtest_trades WHERE run_id = 54
     ORDER BY wk`,
  );
  return result.rows.map((r) => new Date(r.wk).toISOString());
}

/* ─── Daily bar loader ──────────────────────────────────────────── */

type DailyBar = {
  symbol: string;
  barOpenUtc: string;
  openPrice: number;
  closePrice: number;
};

async function loadDailyBarsForWeek(weekOpenUtc: string): Promise<Map<string, DailyBar[]>> {
  const pool = getPool();
  const rows = await pool.query<{
    symbol: string;
    bar_open_utc: Date;
    open_price: string;
    close_price: string;
  }>(
    `SELECT symbol, bar_open_utc, open_price, close_price
     FROM canonical_price_bars
     WHERE timeframe = '1d'
       AND bar_open_utc >= $1::timestamptz
       AND bar_open_utc < ($1::timestamptz + interval '7 days')
     ORDER BY symbol, bar_open_utc ASC`,
    [weekOpenUtc],
  );

  const bySymbol = new Map<string, DailyBar[]>();
  for (const r of rows.rows) {
    const sym = r.symbol.toUpperCase();
    if (!bySymbol.has(sym)) bySymbol.set(sym, []);
    bySymbol.get(sym)!.push({
      symbol: sym,
      barOpenUtc: new Date(r.bar_open_utc).toISOString(),
      openPrice: Number(r.open_price),
      closePrice: Number(r.close_price),
    });
  }
  return bySymbol;
}

/* ─── Types ─────────────────────────────────────────────────────── */

type NormPosition = {
  symbol: string;
  direction: "LONG" | "SHORT";
  openPrice: number;
  multiplier: number; // targetAdr / pairAdr
};

type DaySnapshot = {
  day: number;
  barDate: string;
  normBasketPnl: number;
};

type WeekSim = {
  weekOpenUtc: string;
  weekLabel: string;
  tradeCount: number;
  baseTP: number; // 0.25% × tradeCount
  fridayNorm: number; // engine's normalized Friday return (parity)
  dailySnapshots: DaySnapshot[];
  // Per multiplier: exit result
  tpResults: Map<number, { hit: boolean; exitDay: number; exitReturn: number }>;
};

type StrategyResult = {
  strategyId: string;
  strategyLabel: string;
  weeks: WeekSim[];
  engineNet: number; // sum of engine normalized weekly returns (parity check)
  engineDD: number;
};

/* ─── Simulation ────────────────────────────────────────────────── */

function simulateWeek(
  positions: NormPosition[],
  dailyBars: Map<string, DailyBar[]>,
): DaySnapshot[] {
  const snapshots: DaySnapshot[] = [];

  const allDates = new Set<string>();
  for (const pos of positions) {
    const bars = dailyBars.get(pos.symbol);
    if (bars) for (const bar of bars) allDates.add(bar.barOpenUtc);
  }
  const sortedDates = Array.from(allDates).sort();

  for (let dayIdx = 0; dayIdx < sortedDates.length; dayIdx++) {
    const date = sortedDates[dayIdx]!;
    let normSum = 0;

    for (const pos of positions) {
      const bars = dailyBars.get(pos.symbol);
      if (!bars) continue;

      let bar: DailyBar | null = null;
      for (const b of bars) {
        if (b.barOpenUtc <= date) bar = b;
        else break;
      }
      if (!bar || pos.openPrice <= 0) continue;

      const rawPnl = ((bar.closePrice - pos.openPrice) / pos.openPrice) * 100;
      const directionalPnl = pos.direction === "SHORT" ? -rawPnl : rawPnl;
      normSum += directionalPnl * pos.multiplier;
    }

    snapshots.push({ day: dayIdx, barDate: date.slice(0, 10), normBasketPnl: normSum });
  }

  return snapshots;
}

/* ─── Stats ─────────────────────────────────────────────────────── */

type AggStats = {
  weeklyReturns: number[];
  net: number;
  maxDD: number;
  retDD: number;
  losingWeeks: number;
  winRate: number;
  hitCount: number;
};

function computeAgg(weeklyReturns: number[], hitCount: number): AggStats {
  const net = weeklyReturns.reduce((s, v) => s + v, 0);
  let peak = 0, cum = 0, dd = 0, loseWk = 0, wins = 0;
  for (const r of weeklyReturns) {
    cum += r;
    peak = Math.max(peak, cum);
    dd = Math.min(dd, cum - peak);
    if (r < 0) loseWk++;
    if (r > 0) wins++;
  }
  const retDD = dd < 0 ? net / Math.abs(dd) : (net > 0 ? Infinity : 0);
  const wr = weeklyReturns.length > 0 ? (wins / weeklyReturns.length) * 100 : 0;
  return { weeklyReturns, net, maxDD: dd, retDD, losingWeeks: loseWk, winRate: wr, hitCount };
}

/* ─── Formatting ────────────────────────────────────────────────── */

function fmt(v: number): string { return (v >= 0 ? "+" : "") + v.toFixed(2) + "%"; }
function fmtR(v: number): string { return Number.isFinite(v) ? v.toFixed(1) + "x" : "∞"; }

/* ─── Main ──────────────────────────────────────────────────────── */

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║   BASKET ADR TP — ALL STRATEGIES × WEEKLY HOLD                         ║");
  console.log("║   Engine f2=adr_normalized (app parity), dynamic TP per week            ║");
  console.log(`║   Basket TP = ${ADR_PER_TRADE}% × trade_count, multipliers: ${TP_MULTIPLIERS.join(", ")}        ║`);
  console.log("║   Week close = stop (no SL)                                            ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");

  // 1. Load weeks
  const WEEKS = await loadWeeks();
  console.log(`Loaded ${WEEKS.length} weeks\n`);

  // 2. Get configs
  const entryStyle = getEntryStyle("weekly_hold");
  const overlay = getStrengthGate("adr_normalized");
  if (!entryStyle || !overlay) throw new Error("Config not found");

  // 3. Preload daily bars + ADR maps
  console.log("Preloading daily bars and ADR maps...");
  const weeklyDailyBars = new Map<string, Map<string, DailyBar[]>>();
  const weeklyAdrMaps = new Map<string, Awaited<ReturnType<typeof loadWeeklyAdrMap>>>();
  for (const weekOpen of WEEKS) {
    weeklyDailyBars.set(weekOpen, await loadDailyBarsForWeek(weekOpen));
    weeklyAdrMaps.set(weekOpen, await loadWeeklyAdrMap(weekOpen));
  }
  console.log("  Done.\n");

  const targetAdr = getTargetAdrPct();

  // 4. Run each strategy through the engine WITH adr_normalized overlay
  const allResults: StrategyResult[] = [];
  const activeStrategies = STRATEGIES.filter((s) => !SKIP_STRATEGIES.has(s.id));

  for (const stratConfig of activeStrategies) {
    const strategy = getStrategy(stratConfig.id);
    if (!strategy) { console.log(`  SKIP ${stratConfig.id}`); continue; }

    process.stdout.write(`  ${stratConfig.label}...`);
    const engineResult = await computeMultiWeekHold(strategy, WEEKS, entryStyle, overlay);
    console.log(` ${engineResult.totalTrades} trades, engine: ${fmt(engineResult.totalReturnPct)}, DD: ${fmt(engineResult.maxDrawdownPct)}`);

    const weekSims: WeekSim[] = [];

    for (const week of engineResult.weeks) {
      const weekLabel = new Date(new Date(week.weekOpenUtc).getTime() + 86400000)
        .toISOString().slice(5, 10);

      const tradeCount = week.trades.length;
      const baseTP = ADR_PER_TRADE * tradeCount; // dynamic TP

      // Build positions using the SAME ADR source as engine (loadWeeklyAdrMap)
      const adrMap = weeklyAdrMaps.get(week.weekOpenUtc)!;
      const positions: NormPosition[] = week.trades.map((trade) => {
        const pairAdr = getAdrPct(adrMap, trade.symbol, trade.assetClass);
        return {
          symbol: trade.symbol.toUpperCase(),
          direction: trade.direction,
          openPrice: trade.openPrice,
          multiplier: targetAdr / pairAdr,
        };
      });

      // Simulate daily basket path
      const dailyBars = weeklyDailyBars.get(week.weekOpenUtc)!;
      const snapshots = simulateWeek(positions, dailyBars);
      const fridayNorm = snapshots[snapshots.length - 1]?.normBasketPnl ?? 0;

      // Check TP at each multiplier
      const tpResults = new Map<number, { hit: boolean; exitDay: number; exitReturn: number }>();
      for (const mult of TP_MULTIPLIERS) {
        const tpLevel = baseTP * mult;
        let hit = false;
        let exitDay = snapshots.length - 1;
        let exitReturn = fridayNorm;

        for (let d = 0; d < snapshots.length; d++) {
          if (snapshots[d]!.normBasketPnl >= tpLevel) {
            hit = true;
            exitDay = d;
            exitReturn = tpLevel;
            break;
          }
        }
        tpResults.set(mult, { hit, exitDay, exitReturn });
      }

      weekSims.push({
        weekOpenUtc: week.weekOpenUtc,
        weekLabel,
        tradeCount,
        baseTP,
        fridayNorm,
        dailySnapshots: snapshots,
        tpResults,
      });
    }

    allResults.push({
      strategyId: stratConfig.id,
      strategyLabel: stratConfig.label,
      weeks: weekSims,
      engineNet: engineResult.totalReturnPct,
      engineDD: engineResult.maxDrawdownPct,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PARITY CHECK
  // ═══════════════════════════════════════════════════════════════════

  console.log("\n" + "═".repeat(80));
  console.log("  PARITY CHECK: Engine (app) vs Script basket simulation");
  console.log("═".repeat(80) + "\n");

  console.log(
    "Strategy".padEnd(14),
    "Engine Net".padEnd(14),
    "Engine DD".padEnd(12),
    "Script Friday Net".padEnd(18),
    "Δ Net",
  );
  console.log("-".repeat(70));

  for (const sr of allResults) {
    const scriptNet = sr.weeks.reduce((s, w) => s + w.fridayNorm, 0);
    const delta = scriptNet - sr.engineNet;
    console.log(
      sr.strategyLabel.padEnd(14),
      fmt(sr.engineNet).padEnd(14),
      fmt(sr.engineDD).padEnd(12),
      fmt(scriptNet).padEnd(18),
      fmt(delta),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  DYNAMIC TP PER WEEK
  // ═══════════════════════════════════════════════════════════════════

  console.log("\n" + "═".repeat(100));
  console.log("  DYNAMIC BASKET TP LEVELS PER WEEK (0.25% × trade count)");
  console.log("═".repeat(100) + "\n");

  // Show for first strategy as reference (trade counts often differ by strategy)
  for (const sr of allResults) {
    const tpLine = sr.weeks.map((w) =>
      `${w.weekLabel}:${w.tradeCount}→${w.baseTP.toFixed(1)}%`
    ).join("  ");
    console.log(`  ${sr.strategyLabel}: ${tpLine}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  RESULTS: EACH STRATEGY × TP MULTIPLIER
  // ═══════════════════════════════════════════════════════════════════

  console.log("\n" + "═".repeat(120));
  console.log("  RESULTS: DYNAMIC BASKET TP (ADR-NORMALIZED, WEEK CLOSE = STOP)");
  console.log("  TP = 0.25% × trades × multiplier");
  console.log("═".repeat(120) + "\n");

  const weekLabels = allResults[0]!.weeks.map((w) => w.weekLabel);

  console.log(
    "Strategy".padEnd(14),
    "TP Mode".padEnd(12),
    "Net".padEnd(10),
    "MaxDD".padEnd(10),
    "R/DD".padEnd(8),
    "LoseWk".padEnd(8),
    "WinRate".padEnd(8),
    "Hits".padEnd(8),
    "│ Weekly returns",
  );
  console.log("-".repeat(120));

  for (const sr of allResults) {
    // Baseline: No TP (engine normalized Friday returns)
    const blReturns = sr.weeks.map((w) => w.fridayNorm);
    const bl = computeAgg(blReturns, 0);
    console.log(
      sr.strategyLabel.padEnd(14),
      "No TP".padEnd(12),
      fmt(bl.net).padEnd(10),
      fmt(bl.maxDD).padEnd(10),
      fmtR(bl.retDD).padEnd(8),
      String(bl.losingWeeks).padEnd(8),
      (bl.winRate.toFixed(0) + "%").padEnd(8),
      "—".padEnd(8),
      "│ " + bl.weeklyReturns.map((r) => fmt(r)).join("  "),
    );

    // Each TP multiplier
    for (const mult of TP_MULTIPLIERS) {
      const returns = sr.weeks.map((w) => w.tpResults.get(mult)!.exitReturn);
      const hits = sr.weeks.filter((w) => w.tpResults.get(mult)!.hit).length;
      const ts = computeAgg(returns, hits);

      const label = mult === 1 ? "1x (base)" : `${mult}x`;
      console.log(
        "".padEnd(14),
        label.padEnd(12),
        fmt(ts.net).padEnd(10),
        fmt(ts.maxDD).padEnd(10),
        fmtR(ts.retDD).padEnd(8),
        String(ts.losingWeeks).padEnd(8),
        (ts.winRate.toFixed(0) + "%").padEnd(8),
        (`${hits}/${sr.weeks.length}`).padEnd(8),
        "│ " + ts.weeklyReturns.map((r) => fmt(r)).join("  "),
      );
    }
    console.log("-".repeat(120));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  DAILY PATHS (key strategies only)
  // ═══════════════════════════════════════════════════════════════════

  const KEY_STRATEGIES = ["dealer", "selector_sentiment_override", "strength"];

  console.log("\n" + "═".repeat(110));
  console.log("  DAILY NORMALIZED BASKET P&L PATHS (KEY STRATEGIES)");
  console.log("═".repeat(110) + "\n");

  for (const sr of allResults.filter((r) => KEY_STRATEGIES.includes(r.strategyId))) {
    console.log(`  ── ${sr.strategyLabel} ──`);
    for (const w of sr.weeks) {
      const dayStrs = w.dailySnapshots.map((s, i) => `D${i + 1}:${fmt(s.normBasketPnl)}`);
      const peak = Math.max(...w.dailySnapshots.map((s) => s.normBasketPnl));
      const trough = Math.min(...w.dailySnapshots.map((s) => s.normBasketPnl));
      console.log(
        `    ${w.weekLabel} (${w.tradeCount} pos, TP=${w.baseTP.toFixed(1)}%): ${dayStrs.join(" → ")}`,
      );
      console.log(
        `${"".padEnd(30)}[peak:${fmt(peak)} trough:${fmt(trough)} TP@1x:${w.tpResults.get(1)!.hit ? "D" + (w.tpResults.get(1)!.exitDay + 1) + "✓" : "miss"}]`,
      );
    }
    console.log();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CROSS-STRATEGY RANKING (best multiplier per strategy)
  // ═══════════════════════════════════════════════════════════════════

  console.log("═".repeat(90));
  console.log("  CROSS-STRATEGY RANKING (best TP multiplier per strategy, by R/DD)");
  console.log("═".repeat(90) + "\n");

  const ranked = allResults.map((sr) => {
    let bestMult = 0;
    let bestRetDD = -Infinity;
    for (const mult of TP_MULTIPLIERS) {
      const returns = sr.weeks.map((w) => w.tpResults.get(mult)!.exitReturn);
      const hits = sr.weeks.filter((w) => w.tpResults.get(mult)!.hit).length;
      const ts = computeAgg(returns, hits);
      if (ts.retDD > bestRetDD) { bestRetDD = ts.retDD; bestMult = mult; }
    }
    const returns = sr.weeks.map((w) => w.tpResults.get(bestMult)!.exitReturn);
    const hits = sr.weeks.filter((w) => w.tpResults.get(bestMult)!.hit).length;
    const ts = computeAgg(returns, hits);
    const blReturns = sr.weeks.map((w) => w.fridayNorm);
    const bl = computeAgg(blReturns, 0);
    return { label: sr.strategyLabel, mult: bestMult, tp: ts, bl };
  }).sort((a, b) => {
    const aR = Number.isFinite(a.tp.retDD) ? a.tp.retDD : 9999;
    const bR = Number.isFinite(b.tp.retDD) ? b.tp.retDD : 9999;
    return bR - aR;
  });

  console.log(
    "#".padEnd(4),
    "Strategy".padEnd(14),
    "Best TP".padEnd(9),
    "Net".padEnd(10),
    "DD".padEnd(10),
    "R/DD".padEnd(8),
    "LoseWk".padEnd(8),
    "Hits".padEnd(8),
    "│ Base R/DD",
  );
  console.log("-".repeat(85));

  ranked.forEach((r, i) => {
    console.log(
      String(i + 1).padEnd(4),
      r.label.padEnd(14),
      (`${r.mult}x`).padEnd(9),
      fmt(r.tp.net).padEnd(10),
      fmt(r.tp.maxDD).padEnd(10),
      fmtR(r.tp.retDD).padEnd(8),
      String(r.tp.losingWeeks).padEnd(8),
      (`${r.tp.hitCount}/${r.tp.weeklyReturns.length}`).padEnd(8),
      "│ " + fmtR(r.bl.retDD),
    );
  });

  // Cleanup
  const pool = getPool();
  await pool.end();

  console.log("\n✓ Simulation complete.\n");
}

main().catch((error) => {
  console.error("Simulation failed:", error);
  process.exit(1);
});
