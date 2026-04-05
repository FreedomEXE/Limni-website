/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-basket-adr-tp.ts
 *
 * Description:
 * Basket-Level ADR TP simulation for Selector + Weekly Hold.
 * Answers: does closing the basket when normalized P&L hits a target
 * eliminate losing weeks?
 *
 * For each week:
 *   1. Get Selector direction signals (from engine)
 *   2. Get daily bars for each pair (from canonical_price_bars)
 *   3. Compute daily basket P&L (ADR-normalized)
 *   4. If basket P&L >= target on any day → close at target
 *   5. If not → close at Friday (week end)
 *
 * Tests multiple TP targets: 1%, 2%, 3%, 4%, 5%, 7%, 10%
 *
 * Usage: npx tsx scripts/backtest-basket-adr-tp.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { computeMultiWeekHold } from "../src/lib/performance/weeklyHoldEngine";
import { getStrategy, getEntryStyle } from "../src/lib/performance/strategyConfig";
import { getPool } from "../src/lib/db";

/* ─── Config ────────────────────────────────────────────────────── */

const TARGET_ADR = 1.0; // Normalize all positions to 1% ADR risk
const TP_TARGETS = [1, 2, 3, 4, 5, 7, 10]; // Basket TP levels to test (%)

// Fallback ADRs by asset class
const DEFAULT_ADR: Record<string, number> = {
  fx: 0.6,
  crypto: 3.5,
  commodities: 1.5,
  indices: 1.0,
};

const CRYPTO_SYMBOLS = new Set(["BTCUSD", "ETHUSD"]);
const INDEX_SYMBOLS = new Set(["SPXUSD", "NDXUSD", "NIKKEIUSD"]);
const COMMODITY_SYMBOLS = new Set(["XAUUSD", "XAGUSD", "WTIUSD"]);

function inferAssetClass(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (CRYPTO_SYMBOLS.has(upper)) return "crypto";
  if (INDEX_SYMBOLS.has(upper)) return "indices";
  if (COMMODITY_SYMBOLS.has(upper)) return "commodities";
  return "fx";
}

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

/* ─── ADR lookup (same as normalization backtest) ───────────────── */

type AdrMap = Map<string, number>;

function adrKey(symbol: string, weekOpenUtc: string): string {
  return `${symbol.toUpperCase()}:${weekOpenUtc}`;
}

async function loadAdrFromScanner(): Promise<AdrMap> {
  const pool = getPool();
  const map: AdrMap = new Map();
  const runRows = await pool.query<{ id: string }>(
    `SELECT id FROM strategy_backtest_runs
     WHERE bot_id = 'adr-forward' AND variant = 'fresh-start'
       AND market = 'multi-asset' AND config_key = 'default' LIMIT 1`,
  );
  if (runRows.rows.length === 0) return map;
  const runId = Number(runRows.rows[0]!.id);

  const rows = await pool.query<{
    symbol: string;
    week_open_utc: Date;
    adr_pct: string;
  }>(
    `SELECT DISTINCT ON (symbol, week_open_utc)
            symbol, week_open_utc,
            (metadata->>'adrPct')::text AS adr_pct
     FROM strategy_backtest_trades
     WHERE run_id = $1 AND metadata->>'adrPct' IS NOT NULL
     ORDER BY symbol, week_open_utc, entry_time_utc ASC`,
    [runId],
  );

  for (const r of rows.rows) {
    const val = Number(r.adr_pct);
    if (Number.isFinite(val) && val > 0) {
      map.set(adrKey(r.symbol, new Date(r.week_open_utc).toISOString()), val);
    }
  }
  return map;
}

async function loadAdrFromDailyBars(weeks: string[]): Promise<AdrMap> {
  const pool = getPool();
  const map: AdrMap = new Map();

  for (const weekOpen of weeks) {
    const rows = await pool.query<{
      symbol: string;
      high_price: string;
      low_price: string;
      open_price: string;
    }>(
      `SELECT symbol, high_price, low_price, open_price
       FROM canonical_price_bars
       WHERE timeframe = '1d'
         AND bar_open_utc < $1::timestamptz
         AND bar_open_utc >= ($1::timestamptz - interval '20 days')
       ORDER BY symbol, bar_open_utc DESC`,
      [weekOpen],
    );

    const bySymbol = new Map<string, Array<{ high: number; low: number; open: number }>>();
    for (const r of rows.rows) {
      const sym = r.symbol.toUpperCase();
      if (!bySymbol.has(sym)) bySymbol.set(sym, []);
      const arr = bySymbol.get(sym)!;
      if (arr.length < 10) {
        arr.push({ high: Number(r.high_price), low: Number(r.low_price), open: Number(r.open_price) });
      }
    }

    for (const [sym, bars] of bySymbol) {
      const valid = bars.filter((b) => Number.isFinite(b.high) && Number.isFinite(b.low) && b.open > 0);
      if (valid.length >= 5) {
        const pctRanges = valid.map((b) => ((b.high - b.low) / b.open) * 100);
        const adrPct = pctRanges.reduce((s, v) => s + v, 0) / pctRanges.length;
        map.set(adrKey(sym, weekOpen), adrPct);
      }
    }
  }
  return map;
}

async function buildAdrMap(weeks: string[]): Promise<AdrMap> {
  const scannerMap = await loadAdrFromScanner();
  const dailyBarMap = await loadAdrFromDailyBars(weeks);
  const combined: AdrMap = new Map();

  for (const [key, val] of dailyBarMap) combined.set(key, val);
  for (const [key, val] of scannerMap) combined.set(key, val); // scanner takes priority

  console.log(`  ADR map: ${combined.size} entries (scanner=${scannerMap.size}, daily=${dailyBarMap.size})`);
  return combined;
}

function getAdr(adrMap: AdrMap, symbol: string, weekOpenUtc: string, assetClass: string): number {
  return adrMap.get(adrKey(symbol, weekOpenUtc)) ?? DEFAULT_ADR[assetClass] ?? DEFAULT_ADR.fx!;
}

/* ─── Daily bar loader ──────────────────────────────────────────── */

type DailyBar = {
  symbol: string;
  barOpenUtc: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
};

async function loadDailyBarsForWeek(weekOpenUtc: string): Promise<Map<string, DailyBar[]>> {
  const pool = getPool();
  // Week spans ~5-7 days from the week open
  const rows = await pool.query<{
    symbol: string;
    bar_open_utc: Date;
    open_price: string;
    high_price: string;
    low_price: string;
    close_price: string;
  }>(
    `SELECT symbol, bar_open_utc, open_price, high_price, low_price, close_price
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
      highPrice: Number(r.high_price),
      lowPrice: Number(r.low_price),
      closePrice: Number(r.close_price),
    });
  }
  return bySymbol;
}

/* ─── Basket TP simulation ──────────────────────────────────────── */

type TradePosition = {
  symbol: string;
  direction: "LONG" | "SHORT";
  openPrice: number;
  assetClass: string;
  adrPct: number;
  multiplier: number; // TARGET_ADR / adrPct
};

type DaySnapshot = {
  day: number; // 0-based index (0=Mon, 4=Fri)
  barDate: string;
  rawBasketPnl: number;
  normalizedBasketPnl: number;
  positionCount: number;
};

type WeekSimResult = {
  weekOpenUtc: string;
  weekLabel: string;
  positions: TradePosition[];
  dailySnapshots: DaySnapshot[];
  fridayRawPnl: number;
  fridayNormPnl: number;
  // Per TP target: { hit: boolean, exitDay: number, exitReturn: number }
  tpResults: Map<number, { hit: boolean; exitDay: number; exitReturn: number }>;
};

function simulateWeek(
  positions: TradePosition[],
  dailyBars: Map<string, DailyBar[]>,
): { snapshots: DaySnapshot[]; fridayRaw: number; fridayNorm: number } {
  const snapshots: DaySnapshot[] = [];

  // Collect all unique bar dates across all positions to get the day sequence
  const allDates = new Set<string>();
  for (const pos of positions) {
    const bars = dailyBars.get(pos.symbol);
    if (bars) {
      for (const bar of bars) allDates.add(bar.barOpenUtc);
    }
  }
  const sortedDates = Array.from(allDates).sort();

  for (let dayIdx = 0; dayIdx < sortedDates.length; dayIdx++) {
    const date = sortedDates[dayIdx]!;
    let rawSum = 0;
    let normSum = 0;
    let counted = 0;

    for (const pos of positions) {
      const bars = dailyBars.get(pos.symbol);
      if (!bars) continue;

      // Find the bar for this date, or the most recent bar before it
      let bar: DailyBar | null = null;
      for (const b of bars) {
        if (b.barOpenUtc <= date) bar = b;
        else break;
      }
      if (!bar || pos.openPrice <= 0) continue;

      // P&L from week open to this day's close
      const rawPnl = ((bar.closePrice - pos.openPrice) / pos.openPrice) * 100;
      const directionalPnl = pos.direction === "SHORT" ? -rawPnl : rawPnl;
      const normalizedPnl = directionalPnl * pos.multiplier;

      rawSum += directionalPnl;
      normSum += normalizedPnl;
      counted++;
    }

    snapshots.push({
      day: dayIdx,
      barDate: date.slice(0, 10),
      rawBasketPnl: rawSum,
      normalizedBasketPnl: normSum,
      positionCount: counted,
    });
  }

  const lastSnap = snapshots[snapshots.length - 1];
  return {
    snapshots,
    fridayRaw: lastSnap?.rawBasketPnl ?? 0,
    fridayNorm: lastSnap?.normalizedBasketPnl ?? 0,
  };
}

/* ─── Formatting ────────────────────────────────────────────────── */

function fmt(v: number): string { return (v >= 0 ? "+" : "") + v.toFixed(2) + "%"; }

/* ─── Main ──────────────────────────────────────────────────────── */

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   BASKET ADR TP SIMULATION — SELECTOR + WEEKLY HOLD            ║");
  console.log("║   Normalized basket, TP at target, week-close fallback         ║");
  console.log(`║   Target ADR: ${TARGET_ADR}% | TP targets: ${TP_TARGETS.join(", ")}%             ║`);
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  // 1. Load weeks
  const WEEKS = await loadWeeks();
  console.log(`Loaded ${WEEKS.length} weeks\n`);

  // 2. Build ADR map
  console.log("Building ADR map...");
  const adrMap = await buildAdrMap(WEEKS);

  // 3. Run Selector WH through engine to get signals
  const strategy = getStrategy("selector_sentiment_override");
  const entryStyle = getEntryStyle("weekly_hold");
  if (!strategy || !entryStyle) throw new Error("Strategy/entry style not found");

  console.log("\nRunning Selector + Weekly Hold through engine...");
  const engineResult = await computeMultiWeekHold(strategy, WEEKS, entryStyle);
  console.log(`  ${engineResult.weeks.length} weeks, ${engineResult.totalTrades} total trades\n`);

  // 4. Simulate each week
  const weekResults: WeekSimResult[] = [];

  for (const week of engineResult.weeks) {
    const weekLabel = new Date(new Date(week.weekOpenUtc).getTime() + 86400000)
      .toISOString().slice(5, 10);

    // Build positions from engine trades
    const positions: TradePosition[] = week.trades.map((trade) => {
      const ac = trade.assetClass || inferAssetClass(trade.symbol);
      const pairAdr = getAdr(adrMap, trade.symbol, week.weekOpenUtc, ac);
      return {
        symbol: trade.symbol.toUpperCase(),
        direction: trade.direction,
        openPrice: trade.openPrice,
        assetClass: ac,
        adrPct: pairAdr,
        multiplier: TARGET_ADR / pairAdr,
      };
    });

    // Load daily bars for this week
    const dailyBars = await loadDailyBarsForWeek(week.weekOpenUtc);

    // Simulate daily basket P&L
    const { snapshots, fridayRaw, fridayNorm } = simulateWeek(positions, dailyBars);

    // Check TP targets
    const tpResults = new Map<number, { hit: boolean; exitDay: number; exitReturn: number }>();

    for (const target of TP_TARGETS) {
      let hit = false;
      let exitDay = snapshots.length - 1;
      let exitReturn = fridayNorm;

      for (let d = 0; d < snapshots.length; d++) {
        if (snapshots[d]!.normalizedBasketPnl >= target) {
          hit = true;
          exitDay = d;
          exitReturn = target; // Exit at exact TP level
          break;
        }
      }

      tpResults.set(target, { hit, exitDay, exitReturn });
    }

    weekResults.push({
      weekOpenUtc: week.weekOpenUtc,
      weekLabel,
      positions,
      dailySnapshots: snapshots,
      fridayRawPnl: fridayRaw,
      fridayNormPnl: fridayNorm,
      tpResults,
    });

    // Print daily path for this week
    const dayStrs = snapshots.map((s) =>
      `${s.barDate.slice(5)}: ${fmt(s.normalizedBasketPnl)}`
    ).join(" → ");
    console.log(`  ${weekLabel} (${positions.length} pos): ${dayStrs} | Friday: raw ${fmt(fridayRaw)}, norm ${fmt(fridayNorm)}`);
  }

  // ── RESULTS ────────────────────────────────────────────────────

  console.log("\n" + "═".repeat(120));
  console.log("  BASKET TP RESULTS — SELECTOR + WEEKLY HOLD (ADR-NORMALIZED)");
  console.log("═".repeat(120));

  // Per-week detail for each TP target
  console.log("\n── WEEKLY RETURNS BY TP TARGET ──\n");

  const weekLabels = weekResults.map((w) => w.weekLabel);
  console.log(
    "TP Target".padEnd(12),
    weekLabels.map((wk) => wk.padEnd(12)).join(""),
    "Net".padEnd(10),
    "MaxDD".padEnd(10),
    "R/DD".padEnd(10),
    "LoseWk",
  );
  console.log("-".repeat(12 + weekLabels.length * 12 + 40));

  // Raw baseline row
  {
    const rawWeekly = weekResults.map((w) => w.fridayRawPnl);
    const net = rawWeekly.reduce((s, v) => s + v, 0);
    let peak = 0, cum = 0, dd = 0, loseWk = 0;
    for (const r of rawWeekly) { cum += r; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); if (r < 0) loseWk++; }
    const retDD = dd < 0 ? (net / Math.abs(dd)).toFixed(1) + "x" : "∞";
    console.log(
      "Raw".padEnd(12),
      rawWeekly.map((r) => fmt(r).padEnd(12)).join(""),
      fmt(net).padEnd(10),
      fmt(dd).padEnd(10),
      retDD.padEnd(10),
      String(loseWk),
    );
  }

  // Normalized (no TP) row
  {
    const normWeekly = weekResults.map((w) => w.fridayNormPnl);
    const net = normWeekly.reduce((s, v) => s + v, 0);
    let peak = 0, cum = 0, dd = 0, loseWk = 0;
    for (const r of normWeekly) { cum += r; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); if (r < 0) loseWk++; }
    const retDD = dd < 0 ? (net / Math.abs(dd)).toFixed(1) + "x" : "∞";
    console.log(
      "Norm (no TP)".padEnd(12),
      normWeekly.map((r) => fmt(r).padEnd(12)).join(""),
      fmt(net).padEnd(10),
      fmt(dd).padEnd(10),
      retDD.padEnd(10),
      String(loseWk),
    );
  }

  console.log("-".repeat(12 + weekLabels.length * 12 + 40));

  // Each TP target row
  for (const target of TP_TARGETS) {
    const weeklyReturns = weekResults.map((w) => {
      const tp = w.tpResults.get(target)!;
      return tp.exitReturn;
    });
    const net = weeklyReturns.reduce((s, v) => s + v, 0);
    let peak = 0, cum = 0, dd = 0, loseWk = 0;
    for (const r of weeklyReturns) { cum += r; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); if (r < 0) loseWk++; }
    const retDD = dd < 0 ? (net / Math.abs(dd)).toFixed(1) + "x" : "∞";

    const hitCount = weekResults.filter((w) => w.tpResults.get(target)!.hit).length;

    console.log(
      (`TP ${target}%`).padEnd(12),
      weeklyReturns.map((r) => fmt(r).padEnd(12)).join(""),
      fmt(net).padEnd(10),
      fmt(dd).padEnd(10),
      retDD.padEnd(10),
      `${loseWk} (hit: ${hitCount}/${weekResults.length})`,
    );
  }

  // ── TP HIT DETAIL ──────────────────────────────────────────────

  console.log("\n── TP HIT DETAIL (which day of week) ──\n");

  console.log(
    "Week".padEnd(10),
    "Positions".padEnd(10),
    ...TP_TARGETS.map((t) => (`TP ${t}%`).padEnd(10)),
    "Fri Norm",
  );
  console.log("-".repeat(10 + 10 + TP_TARGETS.length * 10 + 10));

  const dayNames = ["D1", "D2", "D3", "D4", "D5", "D6", "D7"];

  for (const w of weekResults) {
    const tpStrs = TP_TARGETS.map((t) => {
      const tp = w.tpResults.get(t)!;
      return tp.hit ? `${dayNames[tp.exitDay] ?? "D?"}✓`.padEnd(10) : "—".padEnd(10);
    });
    console.log(
      w.weekLabel.padEnd(10),
      String(w.positions.length).padEnd(10),
      ...tpStrs,
      fmt(w.fridayNormPnl),
    );
  }

  // ── DAILY BASKET PATH (normalized) ─────────────────────────────

  console.log("\n── DAILY NORMALIZED BASKET P&L PATH ──\n");

  for (const w of weekResults) {
    const dayStrs = w.dailySnapshots.map((s, i) =>
      `D${i + 1}:${fmt(s.normalizedBasketPnl)}`
    );
    const maxNorm = Math.max(...w.dailySnapshots.map((s) => s.normalizedBasketPnl));
    const minNorm = Math.min(...w.dailySnapshots.map((s) => s.normalizedBasketPnl));
    console.log(
      `  ${w.weekLabel} (${w.positions.length} pos): ${dayStrs.join(" → ")}  [peak: ${fmt(maxNorm)}, trough: ${fmt(minNorm)}]`,
    );
  }

  // ── SUMMARY ────────────────────────────────────────────────────

  console.log("\n" + "═".repeat(80));
  console.log("  ANSWER: WHICH TP TARGET ELIMINATES LOSING WEEKS?");
  console.log("═".repeat(80) + "\n");

  for (const target of TP_TARGETS) {
    const weeklyReturns = weekResults.map((w) => w.tpResults.get(target)!.exitReturn);
    const loseWk = weeklyReturns.filter((r) => r < 0).length;
    const net = weeklyReturns.reduce((s, v) => s + v, 0);
    const hitRate = weekResults.filter((w) => w.tpResults.get(target)!.hit).length;
    const symbol = loseWk === 0 ? "✓ ZERO" : `✗ ${loseWk}`;

    console.log(
      `  TP ${String(target).padEnd(3)}% → ${symbol} losing weeks | Hit ${hitRate}/${weekResults.length} weeks | Net: ${fmt(net)}`,
    );
  }

  // Cleanup
  const pool = getPool();
  await pool.end();

  console.log("\n✓ Simulation complete.\n");
}

main().catch((error) => {
  console.error("Simulation failed:", error);
  process.exit(1);
});
