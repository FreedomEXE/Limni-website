/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-basket-trailing-stop.ts
 *
 * Description:
 * Basket trailing stop simulation for weekly hold strategies.
 * Uses engine f2=adr_normalized for parity with app.
 *
 * Logic:
 *   basket_adr = 1% × trade_count
 *   activation = activation_frac × basket_adr
 *   trail_distance = trail_frac × basket_adr
 *
 *   1. Track daily normalized basket P&L
 *   2. Once P&L >= activation → trailing active, peak = P&L
 *   3. Each day after: peak = max(peak, P&L)
 *   4. If P&L <= (peak - trail_distance) → exit at stop level
 *   5. If never stopped → exit at Friday close
 *
 * Tests: Dealer, Strength, Sentiment
 * Variations: different trail widths + buffered activation
 *
 * Usage: npx tsx scripts/backtest-basket-trailing-stop.ts
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
} from "../src/lib/performance/strategyConfig";
import { loadWeeklyAdrMap, getAdrPct, getTargetAdrPct } from "../src/lib/performance/adrLookup";
import { getPool } from "../src/lib/db";

/* ─── Config ────────────────────────────────────────────────────── */

const STRATEGIES_TO_TEST = ["dealer", "sentiment", "strength"];

// Trail configurations to test
// { name, activationFrac, trailFrac }
// activationFrac × basket_adr = where trailing kicks in
// trailFrac × basket_adr = how far below peak we exit
const TRAIL_CONFIGS = [
  { name: "Tight 0.15",      activationFrac: 0.25, trailFrac: 0.15 },
  { name: "Medium 0.20",     activationFrac: 0.25, trailFrac: 0.20 },
  { name: "Base 0.25",       activationFrac: 0.25, trailFrac: 0.25 },
  { name: "Buffer 0.30",     activationFrac: 0.25, trailFrac: 0.30 },
  { name: "Wide 0.35",       activationFrac: 0.25, trailFrac: 0.35 },
  { name: "High-act 0.30/0.25", activationFrac: 0.30, trailFrac: 0.25 },
];

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

type DailyBar = { symbol: string; barOpenUtc: string; openPrice: number; closePrice: number };

async function loadDailyBarsForWeek(weekOpenUtc: string): Promise<Map<string, DailyBar[]>> {
  const pool = getPool();
  const rows = await pool.query<{
    symbol: string; bar_open_utc: Date; open_price: string; close_price: string;
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
  multiplier: number;
};

type DaySnap = { day: number; barDate: string; normPnl: number };

type TrailExitResult = {
  activated: boolean;
  stopped: boolean;
  exitDay: number;       // day index where exited
  exitReturn: number;    // actual return captured
  peakReached: number;   // highest basket P&L seen
  activationDay: number; // day trail activated (-1 if never)
};

type WeekData = {
  weekOpenUtc: string;
  weekLabel: string;
  tradeCount: number;
  basketAdr: number;
  dailySnapshots: DaySnap[];
  fridayNorm: number;
};

/* ─── Daily basket simulation ───────────────────────────────────── */

function buildDailyPath(
  positions: NormPosition[],
  dailyBars: Map<string, DailyBar[]>,
): DaySnap[] {
  const snaps: DaySnap[] = [];

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

    snaps.push({ day: dayIdx, barDate: date.slice(0, 10), normPnl: normSum });
  }

  return snaps;
}

/* ─── Trail simulation ──────────────────────────────────────────── */

function simulateTrail(
  snapshots: DaySnap[],
  activationLevel: number,
  trailDistance: number,
  fridayNorm: number,
): TrailExitResult {
  let activated = false;
  let peak = 0;
  let activationDay = -1;

  for (let d = 0; d < snapshots.length; d++) {
    const pnl = snapshots[d]!.normPnl;

    if (!activated) {
      if (pnl >= activationLevel) {
        activated = true;
        peak = pnl;
        activationDay = d;
      }
    } else {
      peak = Math.max(peak, pnl);
      const stopLevel = peak - trailDistance;

      if (pnl <= stopLevel) {
        // Stopped out — exit at the stop level (would have been hit intraday)
        return {
          activated: true,
          stopped: true,
          exitDay: d,
          exitReturn: stopLevel,
          peakReached: peak,
          activationDay,
        };
      }
    }
  }

  // Never stopped → exit at Friday close
  return {
    activated,
    stopped: false,
    exitDay: snapshots.length - 1,
    exitReturn: fridayNorm,
    peakReached: activated ? peak : Math.max(...snapshots.map((s) => s.normPnl)),
    activationDay,
  };
}

/* ─── Stats ─────────────────────────────────────────────────────── */

type AggStats = {
  weeklyReturns: number[];
  net: number;
  maxDD: number;
  retDD: number;
  losingWeeks: number;
  winRate: number;
};

function computeAgg(weeklyReturns: number[]): AggStats {
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
  return { weeklyReturns, net, maxDD: dd, retDD, losingWeeks: loseWk, winRate: wr };
}

/* ─── Formatting ────────────────────────────────────────────────── */

function fmt(v: number): string { return (v >= 0 ? "+" : "") + v.toFixed(2) + "%"; }
function fmtR(v: number): string { return Number.isFinite(v) ? v.toFixed(1) + "x" : "∞"; }

/* ─── Main ──────────────────────────────────────────────────────── */

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════════════════╗");
  console.log("║   BASKET TRAILING STOP — DEALER / STRENGTH / SENTIMENT                  ║");
  console.log("║   Engine f2=adr_normalized (app parity)                                  ║");
  console.log("║   Activation = frac × basket_ADR, trail = frac × basket_ADR              ║");
  console.log("║   Week close fallback (no SL)                                            ║");
  console.log("╚═══════════════════════════════════════════════════════════════════════════╝\n");

  const WEEKS = await loadWeeks();
  console.log(`Loaded ${WEEKS.length} weeks\n`);

  const entryStyle = getEntryStyle("weekly_hold")!;
  const overlay = getStrengthGate("adr_normalized")!;
  const targetAdr = getTargetAdrPct();

  // Preload daily bars + ADR maps
  console.log("Preloading daily bars and ADR maps...");
  const weeklyDailyBars = new Map<string, Map<string, DailyBar[]>>();
  const weeklyAdrMaps = new Map<string, Awaited<ReturnType<typeof loadWeeklyAdrMap>>>();
  for (const weekOpen of WEEKS) {
    weeklyDailyBars.set(weekOpen, await loadDailyBarsForWeek(weekOpen));
    weeklyAdrMaps.set(weekOpen, await loadWeeklyAdrMap(weekOpen));
  }
  console.log("  Done.\n");

  // Run each strategy
  for (const stratId of STRATEGIES_TO_TEST) {
    const strategy = getStrategy(stratId);
    if (!strategy) continue;

    process.stdout.write(`Running ${strategy.label}...`);
    const engineResult = await computeMultiWeekHold(strategy, WEEKS, entryStyle, overlay);
    console.log(` ${engineResult.totalTrades} trades, engine: ${fmt(engineResult.totalReturnPct)}, DD: ${fmt(engineResult.maxDrawdownPct)}`);

    // Build week data
    const weekData: WeekData[] = [];

    for (const week of engineResult.weeks) {
      const weekLabel = new Date(new Date(week.weekOpenUtc).getTime() + 86400000)
        .toISOString().slice(5, 10);

      const tradeCount = week.trades.length;
      const basketAdr = targetAdr * tradeCount; // 1% × N

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

      const dailyBars = weeklyDailyBars.get(week.weekOpenUtc)!;
      const snapshots = buildDailyPath(positions, dailyBars);
      const fridayNorm = snapshots[snapshots.length - 1]?.normPnl ?? 0;

      weekData.push({ weekOpenUtc: week.weekOpenUtc, weekLabel, tradeCount, basketAdr, dailySnapshots: snapshots, fridayNorm });
    }

    // ── Strategy header ────────────────────────────────────────────

    console.log(`\n${"═".repeat(130)}`);
    console.log(`  ${strategy.label.toUpperCase()} — TRAILING STOP RESULTS`);
    console.log(`  Engine baseline: ${fmt(engineResult.totalReturnPct)}, DD: ${fmt(engineResult.maxDrawdownPct)}`);
    console.log(`${"═".repeat(130)}\n`);

    // Show basket ADR per week
    const adrLine = weekData.map((w) => `${w.weekLabel}:${w.tradeCount}tr→${w.basketAdr.toFixed(0)}%`).join("  ");
    console.log(`  Basket ADR: ${adrLine}\n`);

    // ── Baseline (no trail) ────────────────────────────────────────

    const blReturns = weekData.map((w) => w.fridayNorm);
    const bl = computeAgg(blReturns);

    console.log(
      "Trail Config".padEnd(24),
      "Net".padEnd(10),
      "MaxDD".padEnd(10),
      "R/DD".padEnd(8),
      "LoseWk".padEnd(8),
      "WR".padEnd(7),
      "Activ".padEnd(7),
      "StopOut".padEnd(8),
      "│ Weekly returns",
    );
    console.log("-".repeat(130));

    console.log(
      "No trail (Friday)".padEnd(24),
      fmt(bl.net).padEnd(10),
      fmt(bl.maxDD).padEnd(10),
      fmtR(bl.retDD).padEnd(8),
      String(bl.losingWeeks).padEnd(8),
      (bl.winRate.toFixed(0) + "%").padEnd(7),
      "—".padEnd(7),
      "—".padEnd(8),
      "│ " + bl.weeklyReturns.map((r) => fmt(r)).join("  "),
    );

    // ── Each trail config ──────────────────────────────────────────

    for (const tc of TRAIL_CONFIGS) {
      const weeklyReturns: number[] = [];
      let totalActivated = 0;
      let totalStopped = 0;
      const weekDetails: string[] = [];

      for (const w of weekData) {
        const activationLevel = tc.activationFrac * w.basketAdr;
        const trailDistance = tc.trailFrac * w.basketAdr;

        const result = simulateTrail(w.dailySnapshots, activationLevel, trailDistance, w.fridayNorm);
        weeklyReturns.push(result.exitReturn);

        if (result.activated) totalActivated++;
        if (result.stopped) totalStopped++;

        // Detail string
        if (result.stopped) {
          weekDetails.push(`${w.weekLabel}:act@D${result.activationDay + 1}→stop@D${result.exitDay + 1}(pk${fmt(result.peakReached)}→${fmt(result.exitReturn)})`);
        } else if (result.activated) {
          weekDetails.push(`${w.weekLabel}:act@D${result.activationDay + 1}→Fri(pk${fmt(result.peakReached)}→${fmt(result.exitReturn)})`);
        }
      }

      const ts = computeAgg(weeklyReturns);

      console.log(
        tc.name.padEnd(24),
        fmt(ts.net).padEnd(10),
        fmt(ts.maxDD).padEnd(10),
        fmtR(ts.retDD).padEnd(8),
        String(ts.losingWeeks).padEnd(8),
        (ts.winRate.toFixed(0) + "%").padEnd(7),
        (`${totalActivated}/${weekData.length}`).padEnd(7),
        (`${totalStopped}/${weekData.length}`).padEnd(8),
        "│ " + ts.weeklyReturns.map((r) => fmt(r)).join("  "),
      );
    }

    // ── Detailed week-by-week for best and base configs ────────────

    console.log(`\n  ── WEEK-BY-WEEK DETAIL: ${strategy.label} ──\n`);

    for (const tc of TRAIL_CONFIGS) {
      console.log(`    [${tc.name}] activation=${tc.activationFrac}×BADR, trail=${tc.trailFrac}×BADR`);

      for (const w of weekData) {
        const activationLevel = tc.activationFrac * w.basketAdr;
        const trailDistance = tc.trailFrac * w.basketAdr;
        const result = simulateTrail(w.dailySnapshots, activationLevel, trailDistance, w.fridayNorm);

        const dayPath = w.dailySnapshots.map((s, i) => `D${i + 1}:${fmt(s.normPnl)}`).join(" → ");
        const peak = Math.max(...w.dailySnapshots.map((s) => s.normPnl));
        const trough = Math.min(...w.dailySnapshots.map((s) => s.normPnl));

        let exitInfo: string;
        if (result.stopped) {
          exitInfo = `STOPPED D${result.exitDay + 1} at ${fmt(result.exitReturn)} (peak:${fmt(result.peakReached)})`;
        } else if (result.activated) {
          exitInfo = `TRAIL ACTIVE→Fri at ${fmt(result.exitReturn)} (peak:${fmt(result.peakReached)})`;
        } else {
          exitInfo = `NO TRAIL→Fri at ${fmt(w.fridayNorm)}`;
        }

        console.log(
          `      ${w.weekLabel} (${w.tradeCount}tr, BADR=${w.basketAdr.toFixed(0)}%, TP@${fmt(activationLevel)}, trail=${fmt(trailDistance)}):`,
        );
        console.log(
          `        ${dayPath}`,
        );
        console.log(
          `        [peak:${fmt(peak)} trough:${fmt(trough)}] → ${exitInfo}`,
        );
      }
      console.log();
    }
  }

  // Cleanup
  const pool = getPool();
  await pool.end();
  console.log("✓ Simulation complete.\n");
}

main().catch((error) => {
  console.error("Simulation failed:", error);
  process.exit(1);
});
