/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: adr-backtest-cs-weekopen.ts
 *
 * Description:
 * Tests currency-strength spread filter at WEEK OPEN on top of the
 * canonical agree_2of3 + FX only + ADR pullback baseline.
 *
 * Uses the app engine directly (computeMultiWeekHold) to guarantee
 * baseline parity — same trade set, same P&L, same drawdown calc.
 *
 * Filter approach:
 *   - At each week's open time, read the most recent CS snapshot
 *   - Compute base - quote spread for each pair
 *   - Only keep trades where the spread agrees with direction
 *
 * Filter stages:
 *   1. 4h spread only (at week open)
 *   2. 24h spread only (at week open)
 *   3. 4h + 24h same sign
 *   4. 4h aligned, 24h not opposing
 *
 * Thresholds (normalized): 0, 5, 10, 15, 20, 25
 *
 * Usage: npx tsx scripts/adr-backtest-cs-weekopen.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { computeMultiWeekHold } from "../src/lib/performance/weeklyHoldEngine";
import { getStrategy, getIntradayFilter } from "../src/lib/performance/strategyConfig";
import { getPool } from "../src/lib/db";
import type { WeeklyHoldTrade, TradeDetail } from "../src/lib/performance/weeklyHoldEngine";
import { parseUtcNaiveTimestampMs } from "./lib/utcNaive";

/* ─── Config ────────────────────────────────────────────────────── */

// Pull actual week_open_utc values from DB (handles DST correctly)
async function loadWeeks(): Promise<string[]> {
  const pool = getPool();
  const result = await pool.query<{ wk: Date }>(
    `SELECT DISTINCT week_open_utc as wk
     FROM strategy_backtest_trades WHERE run_id = 54
     ORDER BY wk`,
  );
  return result.rows.map((r) => new Date(r.wk).toISOString());
}

const THRESHOLDS = [0, 5, 10, 15, 20, 25];

/* ─── FX pair → base/quote ──────────────────────────────────────── */

function pairCurrencies(pair: string): { base: string; quote: string } {
  return { base: pair.slice(0, 3).toUpperCase(), quote: pair.slice(3, 6).toUpperCase() };
}

/* ─── CS snapshot loader ────────────────────────────────────────── */

type CSEntry = { ts: number; norm: number; raw: number };
type CSIndex = Record<string, Record<string, CSEntry[]>>;

async function loadCSIndex(): Promise<CSIndex> {
  const pool = getPool();
  const rows = await pool.query<{
    snapshot_time_utc: Date;
    window: string;
    currency: string;
    normalized_strength: string;
    raw_strength: string;
  }>(`
    SELECT snapshot_time_utc, "window", currency,
           normalized_strength, raw_strength
    FROM currency_strength_snapshots
    ORDER BY snapshot_time_utc ASC
  `);

  const index: CSIndex = {};
  for (const r of rows.rows) {
    const w = r.window;
    const c = r.currency;
    if (!index[w]) index[w] = {};
    if (!index[w]![c]) index[w]![c] = [];
    index[w]![c]!.push({
      ts: parseUtcNaiveTimestampMs(r.snapshot_time_utc),
      norm: Number(r.normalized_strength),
      raw: Number(r.raw_strength),
    });
  }
  return index;
}

function findCS(index: CSIndex, window: string, currency: string, targetTs: number): CSEntry | null {
  const arr = index[window]?.[currency];
  if (!arr || arr.length === 0) return null;
  let lo = 0, hi = arr.length - 1, best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid]!.ts <= targetTs) { best = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return best >= 0 ? arr[best]! : null;
}

function getSpread(index: CSIndex, window: string, base: string, quote: string, targetTs: number): number | null {
  const bCS = findCS(index, window, base, targetTs);
  const qCS = findCS(index, window, quote, targetTs);
  if (!bCS || !qCS) return null;
  return bCS.norm - qCS.norm;
}

/* ─── Filter definitions ────────────────────────────────────────── */

function spreadAgrees(spread: number | null, direction: string, threshold: number): boolean {
  if (spread === null) return false;
  return direction === "LONG" ? spread >= threshold : spread <= -threshold;
}

function spreadNotOpposing(spread: number | null, direction: string): boolean {
  if (spread === null) return true;
  return direction === "LONG" ? spread >= 0 : spread <= 0;
}

type FilterFn = (spread4h: number | null, spread24h: number | null, direction: string, th: number) => boolean;

const FILTERS: Record<string, FilterFn> = {
  "4h_only": (s4, _s24, dir, th) => spreadAgrees(s4, dir, th),
  "24h_only": (_s4, s24, dir, th) => spreadAgrees(s24, dir, th),
  "4h+24h": (s4, s24, dir, th) => spreadAgrees(s4, dir, th) && spreadAgrees(s24, dir, th),
  "4h_align_24h_safe": (s4, s24, dir, th) => spreadAgrees(s4, dir, th) && spreadNotOpposing(s24, dir),
};

/* ─── Stats ─────────────────────────────────────────────────────── */

type WeekStat = { weekOpenUtc: string; label: string; returnPct: number; trades: number; wins: number };

function fmt(v: number): string { return (v >= 0 ? "+" : "") + v.toFixed(2) + "%"; }

function computeStats(weekStats: WeekStat[]) {
  const totalReturn = weekStats.reduce((s, w) => s + w.returnPct, 0);
  const totalTrades = weekStats.reduce((s, w) => s + w.trades, 0);
  const totalWins = weekStats.reduce((s, w) => s + w.wins, 0);
  const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

  let peak = 0, cum = 0, maxDD = 0;
  let losingWeeks = 0;
  for (const w of weekStats) {
    cum += w.returnPct;
    peak = Math.max(peak, cum);
    maxDD = Math.min(maxDD, cum - peak);
    if (w.returnPct < 0) losingWeeks++;
  }

  return { totalReturn, totalTrades, totalWins, winRate, maxDD, losingWeeks };
}

/* ─── Main ──────────────────────────────────────────────────────── */

async function main() {
  console.log("Loading engine data and CS index...\n");

  // 1. Load weeks from DB (handles DST correctly)
  const WEEKS = await loadWeeks();
  console.log(`  Weeks from DB: ${WEEKS.length}`);
  for (const w of WEEKS) console.log(`    ${w}`);

  // 2. Load CS index
  const csIndex = await loadCSIndex();
  const csCount = Object.values(csIndex).reduce(
    (s, currencies) => s + Object.values(currencies).reduce((s2, arr) => s2 + arr.length, 0), 0,
  );
  console.log(`  CS snapshots loaded: ${csCount} entries`);

  // 3. Run canonical engine for agree_2of3 + ADR pullback
  const strategy = getStrategy("agree_2of3");
  const intradayFilter = getIntradayFilter("adr_pullback");
  if (!strategy || !intradayFilter) throw new Error("Strategy or filter not found");

  console.log(`  Strategy: ${strategy.id} (${strategy.label})`);
  console.log(`  Intraday: ${intradayFilter.id} (${intradayFilter.label})`);
  console.log(`  Weeks: ${WEEKS.length}\n`);

  const engineResult = await computeMultiWeekHold(strategy, WEEKS, intradayFilter);

  // 3. Build per-week trade arrays with CS spreads at week open
  type EnrichedTrade = WeeklyHoldTrade & {
    weekOpenUtc: string;
    weekLabel: string;
    spread4h: number | null;
    spread24h: number | null;
  };

  const allTrades: EnrichedTrade[] = [];
  const baseWeekStats: WeekStat[] = [];
  let csHits = 0, csMisses = 0;

  for (const week of engineResult.weeks) {
    const weekOpenMs = new Date(week.weekOpenUtc).getTime();
    const weekLabel = new Date(weekOpenMs + 86400000).toISOString().slice(5, 10);

    // FX only
    const fxTrades = week.trades.filter((t) => t.assetClass === "fx");

    let weekReturn = 0;
    let weekTrades = 0;
    let weekWins = 0;

    for (const trade of fxTrades) {
      const { base, quote } = pairCurrencies(trade.symbol);
      const s4h = getSpread(csIndex, "4h", base, quote, weekOpenMs);
      const s24h = getSpread(csIndex, "24h", base, quote, weekOpenMs);

      if (s4h !== null) csHits++;
      else csMisses++;

      allTrades.push({
        ...trade,
        weekOpenUtc: week.weekOpenUtc,
        weekLabel,
        spread4h: s4h,
        spread24h: s24h,
      });

      weekReturn += trade.returnPct;
      weekTrades++;
      if (trade.returnPct > 0) weekWins++;
    }

    baseWeekStats.push({
      weekOpenUtc: week.weekOpenUtc,
      label: weekLabel,
      returnPct: weekReturn,
      trades: weekTrades,
      wins: weekWins,
    });
  }

  console.log(`  Engine returned: ${allTrades.length} FX trades across ${baseWeekStats.length} weeks`);
  console.log(`  CS enrichment at week open: ${csHits} hits, ${csMisses} misses`);

  // 4. Baseline stats
  const baseStats = computeStats(baseWeekStats);
  console.log("\n" + "=".repeat(120));
  console.log("  CS WEEK-OPEN FILTER TEST — agree_2of3 + FX + ADR pullback");
  console.log("  Using app engine for parity (same trade set, same P&L)");
  console.log("=".repeat(120));

  console.log("\n── BASELINE (from engine, FX only) ──");
  console.log(`  Trades: ${baseStats.totalTrades} | Wins: ${baseStats.totalWins} | WR: ${baseStats.winRate.toFixed(1)}%`);
  console.log(`  Net: ${fmt(baseStats.totalReturn)} | Max DD: ${fmt(baseStats.maxDD)} | Losing weeks: ${baseStats.losingWeeks}/${baseWeekStats.length}`);
  console.log(`  Per-week: ${baseWeekStats.map((w) => w.label + " " + fmt(w.returnPct)).join(" | ")}`);

  // 5. Sweep filters
  console.log("\n── SUMMARY TABLE ──\n");
  console.log(
    "Filter".padEnd(22),
    "Thresh".padEnd(8),
    "Trades".padEnd(8),
    "Kept%".padEnd(8),
    "WR%".padEnd(8),
    "Net".padEnd(10),
    "MaxDD".padEnd(10),
    "LoseWk".padEnd(9),
    "Ret/DD".padEnd(10),
    "Δ Net".padEnd(10),
  );
  console.log("-".repeat(120));

  // Baseline row
  const baseRetDD = baseStats.maxDD < 0 ? (baseStats.totalReturn / Math.abs(baseStats.maxDD)).toFixed(1) + "x" : "∞";
  console.log(
    "BASELINE".padEnd(22),
    "-".padEnd(8),
    String(baseStats.totalTrades).padEnd(8),
    "100%".padEnd(8),
    (baseStats.winRate.toFixed(1) + "%").padEnd(8),
    fmt(baseStats.totalReturn).padEnd(10),
    fmt(baseStats.maxDD).padEnd(10),
    (baseStats.losingWeeks + "/" + baseWeekStats.length).padEnd(9),
    baseRetDD.padEnd(10),
    "-".padEnd(10),
  );

  type FilterResult = {
    filterName: string;
    th: number;
    stats: ReturnType<typeof computeStats>;
    weekStats: WeekStat[];
  };
  const results: FilterResult[] = [];

  for (const [filterName, filterFn] of Object.entries(FILTERS)) {
    for (const th of THRESHOLDS) {
      // Build filtered week stats
      const filtWeekStats: WeekStat[] = baseWeekStats.map((bw) => ({
        weekOpenUtc: bw.weekOpenUtc,
        label: bw.label,
        returnPct: 0,
        trades: 0,
        wins: 0,
      }));
      const weekMap = new Map(filtWeekStats.map((w) => [w.weekOpenUtc, w]));

      for (const t of allTrades) {
        if (filterFn(t.spread4h, t.spread24h, t.direction, th)) {
          const ws = weekMap.get(t.weekOpenUtc)!;
          ws.returnPct += t.returnPct;
          ws.trades++;
          if (t.returnPct > 0) ws.wins++;
        }
      }

      const stats = computeStats(filtWeekStats);
      results.push({ filterName, th, stats, weekStats: filtWeekStats });

      const retDD = stats.maxDD < 0 ? (stats.totalReturn / Math.abs(stats.maxDD)).toFixed(1) + "x" : (stats.totalReturn > 0 ? "∞" : "0x");
      const delta = stats.totalReturn - baseStats.totalReturn;
      const keptPct = baseStats.totalTrades > 0 ? (stats.totalTrades / baseStats.totalTrades * 100).toFixed(0) + "%" : "-";

      console.log(
        filterName.padEnd(22),
        String(th).padEnd(8),
        String(stats.totalTrades).padEnd(8),
        keptPct.padEnd(8),
        (stats.winRate.toFixed(1) + "%").padEnd(8),
        fmt(stats.totalReturn).padEnd(10),
        fmt(stats.maxDD).padEnd(10),
        (stats.losingWeeks + "/" + filtWeekStats.length).padEnd(9),
        retDD.padEnd(10),
        fmt(delta).padEnd(10),
      );
    }
    console.log("-".repeat(120));
  }

  // 6. Best by Ret/DD (min 30% trades kept)
  const minTrades = Math.floor(baseStats.totalTrades * 0.3);
  const viable = results
    .filter((r) => r.stats.totalTrades >= minTrades && r.stats.maxDD < 0)
    .sort((a, b) => {
      const aR = a.stats.totalReturn / Math.abs(a.stats.maxDD);
      const bR = b.stats.totalReturn / Math.abs(b.stats.maxDD);
      return bR - aR;
    });

  // Also find best among those that improve net AND reduce DD
  const improvements = results.filter((r) =>
    r.stats.totalTrades >= minTrades &&
    r.stats.totalReturn >= baseStats.totalReturn * 0.85 && // allow 15% return loss
    (r.stats.maxDD > baseStats.maxDD || r.stats.losingWeeks < baseStats.losingWeeks),
  );

  if (viable.length > 0) {
    const best = viable[0]!;
    const retDD = best.stats.totalReturn / Math.abs(best.stats.maxDD);
    console.log("\n── BEST BY RET/DD (min 30% trades, must have DD) ──");
    console.log(`  Filter: ${best.filterName} @ threshold ${best.th}`);
    console.log(`  Trades: ${best.stats.totalTrades}/${baseStats.totalTrades} (${(best.stats.totalTrades / baseStats.totalTrades * 100).toFixed(0)}% kept)`);
    console.log(`  Net: ${fmt(best.stats.totalReturn)} | DD: ${fmt(best.stats.maxDD)} | Ret/DD: ${retDD.toFixed(1)}x`);
    console.log(`  Losing weeks: ${best.stats.losingWeeks}/${baseWeekStats.length}`);
  }

  if (improvements.length > 0) {
    console.log("\n── CONFIGS THAT IMPROVE DD/LOSING WEEKS (≤15% return loss) ──");
    for (const r of improvements) {
      const retDD = r.stats.maxDD < 0 ? (r.stats.totalReturn / Math.abs(r.stats.maxDD)).toFixed(1) + "x" : "∞";
      console.log(`  ${r.filterName}@${r.th}: ${fmt(r.stats.totalReturn)}, DD ${fmt(r.stats.maxDD)}, LW ${r.stats.losingWeeks}/${baseWeekStats.length}, Ret/DD ${retDD}, ${r.stats.totalTrades} trades`);
    }
  }

  // 7. Per-week breakdown for baseline + top configs
  console.log("\n── PER-WEEK BREAKDOWN ──\n");
  const weekLabels = baseWeekStats.map((w) => w.label);
  console.log("Config".padEnd(24), weekLabels.map((wk) => wk.padEnd(10)).join(""), "Net".padEnd(10));
  console.log("-".repeat(24 + weekLabels.length * 10 + 10));
  console.log("BASELINE".padEnd(24), baseWeekStats.map((w) => fmt(w.returnPct).padEnd(10)).join(""), fmt(baseStats.totalReturn));

  const topResults = (viable.length > 0 ? viable : results.filter((r) => r.stats.totalTrades >= minTrades)).slice(0, 6);
  for (const r of topResults) {
    const label = `${r.filterName}@${r.th}`;
    console.log(label.padEnd(24), r.weekStats.map((w) => fmt(w.returnPct).padEnd(10)).join(""), fmt(r.stats.totalReturn));
  }

  // 8. Spread distribution at week open
  console.log("\n── SPREAD DISTRIBUTION AT WEEK OPEN (4h, normalized) ──\n");
  const tpTrades = allTrades.filter((t) => t.returnPct > 0 && t.spread4h !== null);
  const lossTrades = allTrades.filter((t) => t.returnPct <= 0 && t.spread4h !== null);

  function signedSpread4h(t: EnrichedTrade): number {
    return t.direction === "LONG" ? t.spread4h! : -t.spread4h!;
  }

  const tpSpreads = tpTrades.map(signedSpread4h).sort((a, b) => a - b);
  const lossSpreads = lossTrades.map(signedSpread4h).sort((a, b) => a - b);

  const mean = (arr: number[]) => arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
  const median = (arr: number[]) => arr.length === 0 ? 0 : arr[Math.floor(arr.length / 2)]!;
  const fmtN = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(1);

  console.log(`  Winners (n=${tpSpreads.length}): mean=${fmtN(mean(tpSpreads))}, median=${fmtN(median(tpSpreads))}`);
  console.log(`  Losers  (n=${lossSpreads.length}): mean=${fmtN(mean(lossSpreads))}, median=${fmtN(median(lossSpreads))}`);

  const buckets = [
    { label: "< -25", lo: -Infinity, hi: -25 },
    { label: "-25 to -15", lo: -25, hi: -15 },
    { label: "-15 to -5", lo: -15, hi: -5 },
    { label: "-5 to 5", lo: -5, hi: 5 },
    { label: "5 to 15", lo: 5, hi: 15 },
    { label: "15 to 25", lo: 15, hi: 25 },
    { label: "> 25", lo: 25, hi: Infinity },
  ];

  console.log("\n  Spread bucket      Winners  Losers   Win rate   Avg PnL    Total");
  console.log("  " + "-".repeat(70));
  for (const b of buckets) {
    const inBucket = allTrades.filter((t) => {
      if (t.spread4h === null) return false;
      const ss = t.direction === "LONG" ? t.spread4h : -t.spread4h;
      return ss >= b.lo && ss < b.hi;
    });
    const wins = inBucket.filter((t) => t.returnPct > 0).length;
    const losses = inBucket.length - wins;
    const avgPnl = inBucket.length > 0
      ? inBucket.reduce((s, t) => s + t.returnPct, 0) / inBucket.length
      : 0;
    const winRate = inBucket.length > 0 ? (wins / inBucket.length * 100).toFixed(1) + "%" : "-";
    console.log(
      "  " + b.label.padEnd(19),
      String(wins).padEnd(9),
      String(losses).padEnd(9),
      winRate.padEnd(11),
      fmt(avgPnl).padEnd(11),
      String(inBucket.length),
    );
  }

  // Cleanup
  const pool = getPool();
  await pool.end();
}

main().catch((error) => {
  console.error("Backtest failed:", error);
  process.exit(1);
});
