/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-basket-tp-final.ts
 *
 * Description:
 * Final basket TP comparison: Pure TP vs Pure Trail vs Hybrid (half TP + half trail).
 * Uses engine f2=adr_normalized for app parity.
 * Tests Dealer, Strength, Sentiment.
 *
 * Three exit modes:
 *   A) Pure TP: close entire basket at activation level
 *   B) Pure Trail: activate trail at TP level, trail full basket
 *   C) Hybrid: close 50% at TP, trail remaining 50%
 *
 * Activation = 0.25 × basket_ADR (= 0.25% × trade_count)
 * Trail distances tested: 0.20, 0.25, 0.30 × basket_ADR
 *
 * Usage: npx tsx scripts/backtest-basket-tp-final.ts
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
const ACTIVATION_FRAC = 0.25; // activation = 0.25 × basket_ADR
const TRAIL_FRACS = [0.20, 0.25, 0.30]; // trail distance variations

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

/* ─── Daily bars ────────────────────────────────────────────────── */

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

type NormPos = { symbol: string; direction: "LONG" | "SHORT"; openPrice: number; multiplier: number };
type DaySnap = { day: number; normPnl: number };

type WeekInput = {
  weekLabel: string;
  tradeCount: number;
  basketAdr: number;
  snapshots: DaySnap[];
  fridayNorm: number;
};

/* ─── Daily basket path builder ─────────────────────────────────── */

function buildDailyPath(positions: NormPos[], dailyBars: Map<string, DailyBar[]>): DaySnap[] {
  const allDates = new Set<string>();
  for (const pos of positions) {
    const bars = dailyBars.get(pos.symbol);
    if (bars) for (const bar of bars) allDates.add(bar.barOpenUtc);
  }
  const sortedDates = Array.from(allDates).sort();

  return sortedDates.map((date, dayIdx) => {
    let normSum = 0;
    for (const pos of positions) {
      const bars = dailyBars.get(pos.symbol);
      if (!bars) continue;
      let bar: DailyBar | null = null;
      for (const b of bars) { if (b.barOpenUtc <= date) bar = b; else break; }
      if (!bar || pos.openPrice <= 0) continue;
      const rawPnl = ((bar.closePrice - pos.openPrice) / pos.openPrice) * 100;
      const dirPnl = pos.direction === "SHORT" ? -rawPnl : rawPnl;
      normSum += dirPnl * pos.multiplier;
    }
    return { day: dayIdx, normPnl: normSum };
  });
}

/* ─── Exit mode simulators ──────────────────────────────────────── */

// A) Pure TP: close all at activation
function simPureTP(w: WeekInput): number {
  const activation = ACTIVATION_FRAC * w.basketAdr;
  for (const snap of w.snapshots) {
    if (snap.normPnl >= activation) return activation;
  }
  return w.fridayNorm; // no hit → Friday close
}

// B) Pure Trail: activate at TP, trail full basket
function simPureTrail(w: WeekInput, trailFrac: number): number {
  const activation = ACTIVATION_FRAC * w.basketAdr;
  const trailDist = trailFrac * w.basketAdr;
  let active = false;
  let peak = 0;

  for (const snap of w.snapshots) {
    if (!active) {
      if (snap.normPnl >= activation) { active = true; peak = snap.normPnl; }
    } else {
      peak = Math.max(peak, snap.normPnl);
      const stop = peak - trailDist;
      if (snap.normPnl <= stop) return stop;
    }
  }
  return w.fridayNorm; // no stop → Friday close
}

// C) Hybrid: close 50% at TP, trail remaining 50%
function simHybrid(w: WeekInput, trailFrac: number): number {
  const activation = ACTIVATION_FRAC * w.basketAdr;
  const trailDist = trailFrac * w.basketAdr;
  let active = false;
  let peak = 0;

  for (let d = 0; d < w.snapshots.length; d++) {
    const pnl = w.snapshots[d]!.normPnl;

    if (!active) {
      if (pnl >= activation) {
        active = true;
        peak = pnl;
        // 50% locked at activation level, 50% continues trailing
      }
    } else {
      peak = Math.max(peak, pnl);
      const stop = peak - trailDist;
      if (pnl <= stop) {
        // Trail portion stopped: 50% at activation + 50% at stop level
        return 0.5 * activation + 0.5 * stop;
      }
    }
  }

  if (active) {
    // Trail portion held to Friday: 50% at activation + 50% at Friday
    return 0.5 * activation + 0.5 * w.fridayNorm;
  }
  // Never activated: full basket to Friday
  return w.fridayNorm;
}

/* ─── Stats ─────────────────────────────────────────────────────── */

function computeAgg(returns: number[]): { net: number; maxDD: number; retDD: number; loseWk: number; wr: number } {
  const net = returns.reduce((s, v) => s + v, 0);
  let peak = 0, cum = 0, dd = 0, loseWk = 0, wins = 0;
  for (const r of returns) {
    cum += r; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak);
    if (r < 0) loseWk++; if (r > 0) wins++;
  }
  const retDD = dd < 0 ? net / Math.abs(dd) : (net > 0 ? Infinity : 0);
  const wr = returns.length > 0 ? (wins / returns.length) * 100 : 0;
  return { net, maxDD: dd, retDD, loseWk, wr };
}

function fmt(v: number): string { return (v >= 0 ? "+" : "") + v.toFixed(2) + "%"; }
function fmtR(v: number): string { return Number.isFinite(v) ? v.toFixed(1) + "x" : "∞"; }

/* ─── Main ──────────────────────────────────────────────────────── */

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════════════════╗");
  console.log("║   BASKET TP FINAL — PURE TP vs PURE TRAIL vs HYBRID (50/50)             ║");
  console.log("║   Activation = 0.25 × basket_ADR, engine f2=adr_normalized              ║");
  console.log("╚═══════════════════════════════════════════════════════════════════════════╝\n");

  const WEEKS = await loadWeeks();
  const entryStyle = getEntryStyle("weekly_hold")!;
  const overlay = getStrengthGate("adr_normalized")!;
  const targetAdr = getTargetAdrPct();

  // Preload
  const weeklyDailyBars = new Map<string, Map<string, DailyBar[]>>();
  const weeklyAdrMaps = new Map<string, Awaited<ReturnType<typeof loadWeeklyAdrMap>>>();
  for (const w of WEEKS) {
    weeklyDailyBars.set(w, await loadDailyBarsForWeek(w));
    weeklyAdrMaps.set(w, await loadWeeklyAdrMap(w));
  }

  // Collect all results for final comparison
  const allRows: Array<{ strat: string; mode: string; net: number; maxDD: number; retDD: number; loseWk: number; wr: number; returns: number[] }> = [];

  for (const stratId of STRATEGIES_TO_TEST) {
    const strategy = getStrategy(stratId)!;
    const engineResult = await computeMultiWeekHold(strategy, WEEKS, entryStyle, overlay);

    // Build week inputs
    const weekInputs: WeekInput[] = engineResult.weeks.map((week) => {
      const weekLabel = new Date(new Date(week.weekOpenUtc).getTime() + 86400000).toISOString().slice(5, 10);
      const tradeCount = week.trades.length;
      const basketAdr = targetAdr * tradeCount;

      const adrMap = weeklyAdrMaps.get(week.weekOpenUtc)!;
      const positions: NormPos[] = week.trades.map((t) => ({
        symbol: t.symbol.toUpperCase(),
        direction: t.direction,
        openPrice: t.openPrice,
        multiplier: targetAdr / getAdrPct(adrMap, t.symbol, t.assetClass),
      }));

      const snapshots = buildDailyPath(positions, weeklyDailyBars.get(week.weekOpenUtc)!);
      const fridayNorm = snapshots[snapshots.length - 1]?.normPnl ?? 0;
      return { weekLabel, tradeCount, basketAdr, snapshots, fridayNorm };
    });

    console.log(`\n${"═".repeat(130)}`);
    console.log(`  ${strategy.label.toUpperCase()} — Engine: ${fmt(engineResult.totalReturnPct)}, DD: ${fmt(engineResult.maxDrawdownPct)}, ${engineResult.totalTrades} trades`);
    console.log(`${"═".repeat(130)}\n`);

    // Header
    console.log(
      "Mode".padEnd(28),
      "Net".padEnd(10),
      "MaxDD".padEnd(10),
      "R/DD".padEnd(8),
      "LWk".padEnd(5),
      "WR".padEnd(7),
      "│ Weekly returns",
    );
    console.log("-".repeat(130));

    // Baseline: no TP
    {
      const ret = weekInputs.map((w) => w.fridayNorm);
      const s = computeAgg(ret);
      console.log("No TP (Friday close)".padEnd(28), fmt(s.net).padEnd(10), fmt(s.maxDD).padEnd(10), fmtR(s.retDD).padEnd(8), String(s.loseWk).padEnd(5), (s.wr.toFixed(0)+"%").padEnd(7), "│ " + ret.map(fmt).join("  "));
      allRows.push({ strat: strategy.label, mode: "No TP", ...s, returns: ret });
    }

    // A) Pure TP
    {
      const ret = weekInputs.map(simPureTP);
      const s = computeAgg(ret);
      console.log("Pure TP (close all)".padEnd(28), fmt(s.net).padEnd(10), fmt(s.maxDD).padEnd(10), fmtR(s.retDD).padEnd(8), String(s.loseWk).padEnd(5), (s.wr.toFixed(0)+"%").padEnd(7), "│ " + ret.map(fmt).join("  "));
      allRows.push({ strat: strategy.label, mode: "Pure TP", ...s, returns: ret });
    }

    // B) Pure Trail (each distance)
    for (const tf of TRAIL_FRACS) {
      const ret = weekInputs.map((w) => simPureTrail(w, tf));
      const s = computeAgg(ret);
      const label = `Trail ${tf} (full)`;
      console.log(label.padEnd(28), fmt(s.net).padEnd(10), fmt(s.maxDD).padEnd(10), fmtR(s.retDD).padEnd(8), String(s.loseWk).padEnd(5), (s.wr.toFixed(0)+"%").padEnd(7), "│ " + ret.map(fmt).join("  "));
      allRows.push({ strat: strategy.label, mode: label, ...s, returns: ret });
    }

    // C) Hybrid (each distance)
    for (const tf of TRAIL_FRACS) {
      const ret = weekInputs.map((w) => simHybrid(w, tf));
      const s = computeAgg(ret);
      const label = `Hybrid 50/50 trail ${tf}`;
      console.log(label.padEnd(28), fmt(s.net).padEnd(10), fmt(s.maxDD).padEnd(10), fmtR(s.retDD).padEnd(8), String(s.loseWk).padEnd(5), (s.wr.toFixed(0)+"%").padEnd(7), "│ " + ret.map(fmt).join("  "));
      allRows.push({ strat: strategy.label, mode: label, ...s, returns: ret });
    }

    // Week-by-week detail for best modes
    console.log(`\n  ── Week detail: ${strategy.label} ──`);
    for (const w of weekInputs) {
      const activation = ACTIVATION_FRAC * w.basketAdr;
      const pureTP = simPureTP(w);
      const trail25 = simPureTrail(w, 0.25);
      const hybrid25 = simHybrid(w, 0.25);
      const peak = Math.max(...w.snapshots.map((s) => s.normPnl));
      const trough = Math.min(...w.snapshots.map((s) => s.normPnl));

      console.log(
        `    ${w.weekLabel} (${w.tradeCount}tr TP@${fmt(activation)}): Fri=${fmt(w.fridayNorm)} pk=${fmt(peak)} tr=${fmt(trough)} │ PureTP=${fmt(pureTP)} Trail25=${fmt(trail25)} Hybrid25=${fmt(hybrid25)}`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  FINAL RANKING — ALL STRATEGIES, ALL MODES
  // ═══════════════════════════════════════════════════════════════════

  console.log(`\n${"═".repeat(100)}`);
  console.log("  FINAL RANKING — ALL MODES ACROSS ALL STRATEGIES (sorted by R/DD)");
  console.log(`${"═".repeat(100)}\n`);

  const sorted = [...allRows].sort((a, b) => {
    const aR = Number.isFinite(a.retDD) ? a.retDD : 9999;
    const bR = Number.isFinite(b.retDD) ? b.retDD : 9999;
    return bR - aR;
  });

  console.log(
    "#".padEnd(4),
    "Strategy".padEnd(12),
    "Mode".padEnd(28),
    "Net".padEnd(10),
    "MaxDD".padEnd(10),
    "R/DD".padEnd(8),
    "LWk".padEnd(5),
    "WR",
  );
  console.log("-".repeat(85));

  sorted.forEach((r, i) => {
    console.log(
      String(i + 1).padEnd(4),
      r.strat.padEnd(12),
      r.mode.padEnd(28),
      fmt(r.net).padEnd(10),
      fmt(r.maxDD).padEnd(10),
      fmtR(r.retDD).padEnd(8),
      String(r.loseWk).padEnd(5),
      r.wr.toFixed(0) + "%",
    );
  });

  // ═══════════════════════════════════════════════════════════════════
  //  RECOMMENDATION
  // ═══════════════════════════════════════════════════════════════════

  console.log(`\n${"═".repeat(80)}`);
  console.log("  BEST CONFIG PER STRATEGY");
  console.log(`${"═".repeat(80)}\n`);

  for (const stratName of [...new Set(allRows.map((r) => r.strat))]) {
    const rows = allRows.filter((r) => r.strat === stratName);
    const best = rows.reduce((a, b) => {
      const aR = Number.isFinite(a.retDD) ? a.retDD : 9999;
      const bR = Number.isFinite(b.retDD) ? b.retDD : 9999;
      return bR > aR ? b : a;
    });
    console.log(
      `  ${stratName}: ${best.mode} → ${fmt(best.net)}, DD: ${fmt(best.maxDD)}, R/DD: ${fmtR(best.retDD)}, ${best.loseWk} losing wk`,
    );
  }

  const pool = getPool();
  await pool.end();
  console.log("\n✓ Complete.\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
