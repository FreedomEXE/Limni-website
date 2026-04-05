/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-adr-normalization.ts
 *
 * Description:
 * Phase 1: ADR-Normalized Position Sizing Backtest.
 * Compares raw engine returns vs ADR-normalized returns across all
 * strategy × entry_style combos using the SAME engine data.
 *
 * Normalization formula:
 *   normalized_return = raw_return × (TARGET_ADR / pair_adr)
 *
 * ADR source priority:
 *   1. strategy_backtest_trades metadata.adrPct (exact per pair×week)
 *   2. pair_period_returns weekly high/low range → derive daily ADR
 *   3. Asset-class defaults (fx=0.6%, crypto=3.5%, commodities=1.5%, indices=1.0%)
 *
 * Usage: npx tsx scripts/backtest-adr-normalization.ts
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
  STRATEGIES,
  ENTRY_STYLE_FILTERS,
} from "../src/lib/performance/strategyConfig";
import { getPool } from "../src/lib/db";
import type {
  WeeklyHoldTrade,
  WeeklyHoldResult,
  MultiWeekResult,
} from "../src/lib/performance/weeklyHoldEngine";

/* ─── Config ────────────────────────────────────────────────────── */

const TARGET_ADR = 1.0; // 1% — all trades normalized to this risk unit
const ADR_LOOKBACK_DAYS = 10;
const ADR_MIN_REQUIRED_DAYS = 5;

// Fallback ADRs by asset class (approximate from historical data)
const DEFAULT_ADR: Record<string, number> = {
  fx: 0.6,
  crypto: 3.5,
  commodities: 1.5,
  indices: 1.0,
};

/* ─── Load weeks from DB ────────────────────────────────────────── */

async function loadWeeks(): Promise<string[]> {
  const pool = getPool();
  const result = await pool.query<{ wk: Date }>(
    `SELECT DISTINCT week_open_utc AS wk
     FROM strategy_backtest_trades WHERE run_id = 54
     ORDER BY wk`,
  );
  return result.rows.map((r) => new Date(r.wk).toISOString());
}

/* ─── ADR lookup ────────────────────────────────────────────────── */

// Key: "SYMBOL:weekOpenUtc" → adrPct
type AdrMap = Map<string, number>;

function adrKey(symbol: string, weekOpenUtc: string): string {
  return `${symbol.toUpperCase()}:${weekOpenUtc}`;
}

// Source 1: ADR scanner metadata from strategy_backtest_trades
async function loadAdrFromScanner(): Promise<AdrMap> {
  const pool = getPool();
  const map: AdrMap = new Map();

  // Get the ADR run ID
  const runRows = await pool.query<{ id: string }>(
    `SELECT id FROM strategy_backtest_runs
     WHERE bot_id = 'adr-forward' AND variant = 'fresh-start'
       AND market = 'multi-asset' AND config_key = 'default' LIMIT 1`,
  );
  if (runRows.rows.length === 0) return map;
  const runId = Number(runRows.rows[0]!.id);

  // Pull all adrPct values from trade metadata
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

// Source 2: Derive ADR from canonical_price_bars daily bars
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

    // Group by symbol, take last 10, compute ADR
    const bySymbol = new Map<string, Array<{ high: number; low: number; open: number }>>();
    for (const r of rows.rows) {
      const sym = r.symbol.toUpperCase();
      if (!bySymbol.has(sym)) bySymbol.set(sym, []);
      const arr = bySymbol.get(sym)!;
      if (arr.length < ADR_LOOKBACK_DAYS) {
        arr.push({
          high: Number(r.high_price),
          low: Number(r.low_price),
          open: Number(r.open_price),
        });
      }
    }

    for (const [sym, bars] of bySymbol) {
      const valid = bars.filter(
        (b) => Number.isFinite(b.high) && Number.isFinite(b.low) && b.open > 0,
      );
      if (valid.length >= ADR_MIN_REQUIRED_DAYS) {
        const pctRanges = valid.map((b) => ((b.high - b.low) / b.open) * 100);
        const adrPct = pctRanges.reduce((s, v) => s + v, 0) / pctRanges.length;
        map.set(adrKey(sym, weekOpen), adrPct);
      }
    }
  }

  return map;
}

// Source 3: Derive ADR from pair_period_returns weekly high/low
async function loadAdrFromWeeklyReturns(weeks: string[]): Promise<AdrMap> {
  const pool = getPool();
  const map: AdrMap = new Map();

  // Collect weekly ranges per symbol across all weeks
  const rows = await pool.query<{
    symbol: string;
    period_open_utc: Date;
    high_price: string | null;
    low_price: string | null;
    open_price: string;
  }>(
    `SELECT symbol, period_open_utc, high_price, low_price, open_price
     FROM pair_period_returns
     WHERE period_type = 'weekly'
       AND period_open_utc = ANY($1::timestamptz[])`,
    [weeks],
  );

  // Per symbol, compute average weekly range then estimate daily ADR
  const bySymbol = new Map<string, Array<{ week: string; range: number }>>();
  for (const r of rows.rows) {
    const high = r.high_price ? Number(r.high_price) : null;
    const low = r.low_price ? Number(r.low_price) : null;
    const open = Number(r.open_price);
    if (high === null || low === null || open <= 0) continue;
    const weeklyRangePct = ((high - low) / open) * 100;
    const sym = r.symbol.toUpperCase();
    const weekIso = new Date(r.period_open_utc).toISOString();
    if (!bySymbol.has(sym)) bySymbol.set(sym, []);
    bySymbol.get(sym)!.push({ week: weekIso, range: weeklyRangePct });
  }

  // Estimate daily ADR ≈ weekly range / sqrt(5)
  // This is an approximation: weekly range ~ daily range × sqrt(trading days)
  const SQRT5 = Math.sqrt(5);
  for (const [sym, entries] of bySymbol) {
    const avgWeeklyRange = entries.reduce((s, e) => s + e.range, 0) / entries.length;
    const estimatedDailyAdr = avgWeeklyRange / SQRT5;

    // Apply same ADR to all weeks for this symbol (average-based fallback)
    for (const weekOpen of weeks) {
      const key = adrKey(sym, weekOpen);
      if (!map.has(key)) {
        map.set(key, estimatedDailyAdr);
      }
    }
  }

  return map;
}

// Combined ADR lookup with fallback chain
async function buildAdrMap(weeks: string[]): Promise<AdrMap> {
  const combined: AdrMap = new Map();
  let scannerCount = 0;
  let dailyBarCount = 0;
  let weeklyFallbackCount = 0;

  // Load all sources
  const scannerMap = await loadAdrFromScanner();
  const dailyBarMap = await loadAdrFromDailyBars(weeks);
  const weeklyMap = await loadAdrFromWeeklyReturns(weeks);

  console.log(`  ADR scanner entries: ${scannerMap.size}`);
  console.log(`  ADR daily bar entries: ${dailyBarMap.size}`);
  console.log(`  ADR weekly fallback entries: ${weeklyMap.size}`);

  // Merge with priority: scanner > daily bars > weekly fallback
  const allKeys = new Set([...scannerMap.keys(), ...dailyBarMap.keys(), ...weeklyMap.keys()]);
  for (const key of allKeys) {
    if (scannerMap.has(key)) {
      combined.set(key, scannerMap.get(key)!);
      scannerCount++;
    } else if (dailyBarMap.has(key)) {
      combined.set(key, dailyBarMap.get(key)!);
      dailyBarCount++;
    } else if (weeklyMap.has(key)) {
      combined.set(key, weeklyMap.get(key)!);
      weeklyFallbackCount++;
    }
  }

  console.log(`  Combined ADR map: ${combined.size} entries (scanner=${scannerCount}, daily=${dailyBarCount}, weekly=${weeklyFallbackCount})`);
  return combined;
}

function getAdr(adrMap: AdrMap, symbol: string, weekOpenUtc: string, assetClass: string): number {
  const key = adrKey(symbol, weekOpenUtc);
  return adrMap.get(key) ?? DEFAULT_ADR[assetClass] ?? DEFAULT_ADR.fx!;
}

/* ─── Asset class inference ─────────────────────────────────────── */

const CRYPTO_SYMBOLS = new Set(["BTCUSD", "ETHUSD", "BTCUSDT", "ETHUSDT"]);
const INDEX_SYMBOLS = new Set(["SPXUSD", "NDXUSD", "NIKKEIUSD"]);
const COMMODITY_SYMBOLS = new Set(["XAUUSD", "XAGUSD", "WTIUSD"]);

function inferAssetClass(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (CRYPTO_SYMBOLS.has(upper)) return "crypto";
  if (INDEX_SYMBOLS.has(upper)) return "indices";
  if (COMMODITY_SYMBOLS.has(upper)) return "commodities";
  return "fx";
}

/* ─── Normalization ─────────────────────────────────────────────── */

type NormalizedWeekStats = {
  weekOpenUtc: string;
  rawReturn: number;
  normalizedReturn: number;
  trades: number;
  rawWins: number;
  normalizedWins: number;
};

function normalizeWeek(
  week: WeeklyHoldResult,
  adrMap: AdrMap,
  targetAdr: number,
): NormalizedWeekStats {
  let rawReturn = 0;
  let normalizedReturn = 0;
  let rawWins = 0;
  let normalizedWins = 0;

  for (const trade of week.trades) {
    // Raw return (as-is from engine)
    rawReturn += trade.returnPct;
    if (trade.returnPct > 0) rawWins++;

    // Get ADR for this trade
    let pairAdr: number;
    if (trade.detail?.adrPct && trade.detail.adrPct > 0) {
      // ADR pullback trades have exact ADR on the trade detail
      pairAdr = trade.detail.adrPct;
    } else {
      // Weekly hold trades: look up from ADR map
      pairAdr = getAdr(adrMap, trade.symbol, week.weekOpenUtc, trade.assetClass);
    }

    // Normalize: scale return by target/actual ADR
    const multiplier = targetAdr / pairAdr;
    const adjReturn = trade.returnPct * multiplier;
    normalizedReturn += adjReturn;
    if (adjReturn > 0) normalizedWins++;
  }

  return {
    weekOpenUtc: week.weekOpenUtc,
    rawReturn,
    normalizedReturn,
    trades: week.trades.length,
    rawWins,
    normalizedWins,
  };
}

/* ─── Stats computation ─────────────────────────────────────────── */

type Stats = {
  totalReturn: number;
  totalTrades: number;
  totalWins: number;
  winRate: number;
  maxDD: number;
  losingWeeks: number;
  sharpe: number;
  returnPerDD: number;
};

function computeStats(
  weeklyReturns: number[],
  weeklyTrades: number[],
  weeklyWins: number[],
): Stats {
  const totalReturn = weeklyReturns.reduce((s, v) => s + v, 0);
  const totalTrades = weeklyTrades.reduce((s, v) => s + v, 0);
  const totalWins = weeklyWins.reduce((s, v) => s + v, 0);
  const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

  let peak = 0;
  let cum = 0;
  let maxDD = 0;
  let losingWeeks = 0;
  for (const r of weeklyReturns) {
    cum += r;
    peak = Math.max(peak, cum);
    maxDD = Math.min(maxDD, cum - peak);
    if (r < 0) losingWeeks++;
  }

  // Annualized Sharpe from weekly returns
  const n = weeklyReturns.length;
  const mean = n > 0 ? totalReturn / n : 0;
  const variance = n > 1
    ? weeklyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1)
    : 0;
  const sharpe = variance > 0 ? (mean / Math.sqrt(variance)) * Math.sqrt(52) : 0;

  const returnPerDD = maxDD < 0 ? totalReturn / Math.abs(maxDD) : (totalReturn > 0 ? Infinity : 0);

  return { totalReturn, totalTrades, totalWins, winRate, maxDD, losingWeeks, sharpe, returnPerDD };
}

/* ─── Formatting helpers ────────────────────────────────────────── */

function fmt(v: number): string { return (v >= 0 ? "+" : "") + v.toFixed(2) + "%"; }
function fmtR(v: number): string { return Number.isFinite(v) ? v.toFixed(1) + "x" : "∞"; }

/* ─── Per-asset-class breakdown ─────────────────────────────────── */

type AssetClassBreakdown = {
  assetClass: string;
  rawReturn: number;
  normalizedReturn: number;
  trades: number;
  rawWins: number;
  normalizedWins: number;
};

function breakdownByAssetClass(
  weeks: WeeklyHoldResult[],
  adrMap: AdrMap,
  targetAdr: number,
): AssetClassBreakdown[] {
  const accum = new Map<string, AssetClassBreakdown>();

  for (const week of weeks) {
    for (const trade of week.trades) {
      const ac = trade.assetClass || inferAssetClass(trade.symbol);
      if (!accum.has(ac)) {
        accum.set(ac, { assetClass: ac, rawReturn: 0, normalizedReturn: 0, trades: 0, rawWins: 0, normalizedWins: 0 });
      }
      const entry = accum.get(ac)!;

      entry.rawReturn += trade.returnPct;
      entry.trades++;
      if (trade.returnPct > 0) entry.rawWins++;

      let pairAdr: number;
      if (trade.detail?.adrPct && trade.detail.adrPct > 0) {
        pairAdr = trade.detail.adrPct;
      } else {
        pairAdr = getAdr(adrMap, trade.symbol, week.weekOpenUtc, ac);
      }
      const adjReturn = trade.returnPct * (targetAdr / pairAdr);
      entry.normalizedReturn += adjReturn;
      if (adjReturn > 0) entry.normalizedWins++;
    }
  }

  return Array.from(accum.values()).sort((a, b) => b.trades - a.trades);
}

/* ─── ADR distribution diagnostic ──────────────────────────────── */

function printAdrDistribution(adrMap: AdrMap): void {
  const byAc = new Map<string, number[]>();
  for (const [key, val] of adrMap) {
    const symbol = key.split(":")[0]!;
    const ac = inferAssetClass(symbol);
    if (!byAc.has(ac)) byAc.set(ac, []);
    byAc.get(ac)!.push(val);
  }

  console.log("\n── ADR DISTRIBUTION BY ASSET CLASS ──\n");
  console.log(
    "  Asset Class".padEnd(16),
    "Count".padEnd(8),
    "Min".padEnd(10),
    "Median".padEnd(10),
    "Mean".padEnd(10),
    "Max".padEnd(10),
    "Multiplier Range (target=" + TARGET_ADR + "%)",
  );
  console.log("  " + "-".repeat(90));

  for (const [ac, values] of [...byAc.entries()].sort((a, b) => b[1].length - a[1].length)) {
    values.sort((a, b) => a - b);
    const min = values[0]!;
    const max = values[values.length - 1]!;
    const median = values[Math.floor(values.length / 2)]!;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const multMin = TARGET_ADR / max;
    const multMax = TARGET_ADR / min;

    console.log(
      ("  " + ac).padEnd(16),
      String(values.length).padEnd(8),
      (min.toFixed(3) + "%").padEnd(10),
      (median.toFixed(3) + "%").padEnd(10),
      (mean.toFixed(3) + "%").padEnd(10),
      (max.toFixed(3) + "%").padEnd(10),
      `${multMin.toFixed(2)}x – ${multMax.toFixed(2)}x`,
    );
  }
}

/* ─── Main ──────────────────────────────────────────────────────── */

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   ADR-NORMALIZED POSITION SIZING — PHASE 1 BACKTEST            ║");
  console.log("║   Formula: normalized_return = raw × (target_adr / pair_adr)   ║");
  console.log(`║   Target ADR: ${TARGET_ADR}%                                             ║`);
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  // 1. Load weeks
  const WEEKS = await loadWeeks();
  console.log(`Loaded ${WEEKS.length} weeks from DB:`);
  for (const w of WEEKS) {
    const label = new Date(new Date(w).getTime() + 86400000).toISOString().slice(0, 10);
    console.log(`  ${label} (${w})`);
  }

  // 2. Build ADR map
  console.log("\nBuilding ADR map...");
  const adrMap = await buildAdrMap(WEEKS);
  printAdrDistribution(adrMap);

  // 3. Define strategy × entry_style combos to test
  const combos: Array<{ strategyId: string; entryStyleId: string; label: string }> = [];
  for (const strategy of STRATEGIES) {
    for (const entryStyle of ENTRY_STYLE_FILTERS) {
      combos.push({
        strategyId: strategy.id,
        entryStyleId: entryStyle.id,
        label: `${strategy.label} + ${entryStyle.label}`,
      });
    }
  }
  console.log(`\nRunning ${combos.length} strategy × entry_style combos...\n`);

  // 4. Run each combo through the engine and normalize
  type ComboResult = {
    label: string;
    strategyId: string;
    entryStyleId: string;
    raw: Stats;
    normalized: Stats;
    weekStats: NormalizedWeekStats[];
    assetBreakdown: AssetClassBreakdown[];
  };

  const results: ComboResult[] = [];

  for (const combo of combos) {
    const strategy = getStrategy(combo.strategyId);
    const entryStyle = getEntryStyle(combo.entryStyleId);
    if (!strategy || !entryStyle) {
      console.log(`  SKIP ${combo.label}: config not found`);
      continue;
    }

    try {
      process.stdout.write(`  ${combo.label}...`);
      const engineResult = await computeMultiWeekHold(strategy, WEEKS, entryStyle);

      // Normalize each week
      const weekStats = engineResult.weeks.map((w) => normalizeWeek(w, adrMap, TARGET_ADR));

      // Compute raw and normalized stats
      const rawStats = computeStats(
        weekStats.map((w) => w.rawReturn),
        weekStats.map((w) => w.trades),
        weekStats.map((w) => w.rawWins),
      );
      const normStats = computeStats(
        weekStats.map((w) => w.normalizedReturn),
        weekStats.map((w) => w.trades),
        weekStats.map((w) => w.normalizedWins),
      );

      // Asset class breakdown
      const assetBreakdown = breakdownByAssetClass(engineResult.weeks, adrMap, TARGET_ADR);

      results.push({
        label: combo.label,
        strategyId: combo.strategyId,
        entryStyleId: combo.entryStyleId,
        raw: rawStats,
        normalized: normStats,
        weekStats,
        assetBreakdown,
      });

      console.log(` ${rawStats.totalTrades} trades, raw ${fmt(rawStats.totalReturn)} → norm ${fmt(normStats.totalReturn)}`);
    } catch (err) {
      console.log(` ERROR: ${(err as Error).message}`);
    }
  }

  // ── RESULTS ────────────────────────────────────────────────────

  console.log("\n" + "═".repeat(140));
  console.log("  COMPARISON: RAW vs ADR-NORMALIZED (target ADR = " + TARGET_ADR + "%)");
  console.log("═".repeat(140) + "\n");

  // Summary table header
  console.log(
    "Strategy".padEnd(32),
    "│ ".padEnd(2),
    "Trades".padEnd(8),
    "│  Raw Net".padEnd(12),
    "Norm Net".padEnd(12),
    "│  Raw DD".padEnd(12),
    "Norm DD".padEnd(12),
    "│  Raw R/DD".padEnd(12),
    "Norm R/DD".padEnd(12),
    "│  Raw WR".padEnd(11),
    "Norm WR".padEnd(11),
    "│  Raw Sharpe".padEnd(13),
    "Norm Sharpe",
  );
  console.log("-".repeat(140));

  for (const r of results) {
    console.log(
      r.label.padEnd(32),
      "│ ".padEnd(2),
      String(r.raw.totalTrades).padEnd(8),
      ("│ " + fmt(r.raw.totalReturn)).padEnd(12),
      fmt(r.normalized.totalReturn).padEnd(12),
      ("│ " + fmt(r.raw.maxDD)).padEnd(12),
      fmt(r.normalized.maxDD).padEnd(12),
      ("│ " + fmtR(r.raw.returnPerDD)).padEnd(12),
      fmtR(r.normalized.returnPerDD).padEnd(12),
      ("│ " + r.raw.winRate.toFixed(1) + "%").padEnd(11),
      (r.normalized.winRate.toFixed(1) + "%").padEnd(11),
      ("│ " + r.raw.sharpe.toFixed(2)).padEnd(13),
      r.normalized.sharpe.toFixed(2),
    );
  }

  // ── DELTA TABLE (improvement analysis) ─────────────────────────

  console.log("\n" + "═".repeat(120));
  console.log("  NORMALIZATION IMPACT (Δ = normalized − raw)");
  console.log("═".repeat(120) + "\n");

  console.log(
    "Strategy".padEnd(32),
    "│ ".padEnd(2),
    "Δ Net".padEnd(12),
    "Δ DD".padEnd(12),
    "Δ R/DD".padEnd(12),
    "Δ WR".padEnd(10),
    "Δ Sharpe".padEnd(12),
    "│ Verdict",
  );
  console.log("-".repeat(120));

  for (const r of results) {
    const dNet = r.normalized.totalReturn - r.raw.totalReturn;
    const dDD = r.normalized.maxDD - r.raw.maxDD; // positive = less DD = better
    const dRetDD = Number.isFinite(r.normalized.returnPerDD) && Number.isFinite(r.raw.returnPerDD)
      ? r.normalized.returnPerDD - r.raw.returnPerDD
      : 0;
    const dWR = r.normalized.winRate - r.raw.winRate;
    const dSharpe = r.normalized.sharpe - r.raw.sharpe;

    // Verdict: better if Ret/DD improved OR (DD improved AND return didn't drop >20%)
    const retDDImproved = dRetDD > 0.5;
    const ddImproved = dDD > 0;
    const retNotTanked = dNet > -(Math.abs(r.raw.totalReturn) * 0.2);
    const verdict = retDDImproved ? "✓ BETTER" : (ddImproved && retNotTanked) ? "~ MIXED" : "✗ WORSE";

    console.log(
      r.label.padEnd(32),
      "│ ".padEnd(2),
      fmt(dNet).padEnd(12),
      fmt(dDD).padEnd(12),
      (dRetDD >= 0 ? "+" : "") + (Number.isFinite(dRetDD) ? dRetDD.toFixed(1) + "x" : "N/A").padEnd(10),
      ((dWR >= 0 ? "+" : "") + dWR.toFixed(1) + "%").padEnd(10),
      ((dSharpe >= 0 ? "+" : "") + dSharpe.toFixed(2)).padEnd(12),
      "│ " + verdict,
    );
  }

  // ── PER-ASSET CLASS BREAKDOWN for key strategies ───────────────

  const KEY_COMBOS = [
    "selector_sentiment_override:weekly_hold",
    "sentiment:adr_pullback",
    "tiered_v3:weekly_hold",
    "agree_2of3:weekly_hold",
    "agree_2of3:adr_pullback",
  ];

  console.log("\n" + "═".repeat(110));
  console.log("  PER-ASSET CLASS BREAKDOWN (key strategies)");
  console.log("═".repeat(110) + "\n");

  for (const keyCombo of KEY_COMBOS) {
    const [sid, eid] = keyCombo.split(":");
    const r = results.find((r) => r.strategyId === sid && r.entryStyleId === eid);
    if (!r || r.assetBreakdown.length === 0) continue;

    console.log(`  ── ${r.label} ──`);
    console.log(
      "  Asset Class".padEnd(18),
      "Trades".padEnd(8),
      "Raw Ret".padEnd(12),
      "Norm Ret".padEnd(12),
      "Δ Ret".padEnd(12),
      "Raw WR".padEnd(10),
      "Norm WR".padEnd(10),
    );
    console.log("  " + "-".repeat(80));

    for (const ac of r.assetBreakdown) {
      const rawWR = ac.trades > 0 ? (ac.rawWins / ac.trades * 100).toFixed(1) + "%" : "-";
      const normWR = ac.trades > 0 ? (ac.normalizedWins / ac.trades * 100).toFixed(1) + "%" : "-";
      console.log(
        ("  " + ac.assetClass).padEnd(18),
        String(ac.trades).padEnd(8),
        fmt(ac.rawReturn).padEnd(12),
        fmt(ac.normalizedReturn).padEnd(12),
        fmt(ac.normalizedReturn - ac.rawReturn).padEnd(12),
        rawWR.padEnd(10),
        normWR.padEnd(10),
      );
    }
    console.log();
  }

  // ── PER-WEEK EQUITY CURVE for flagship strategies ──────────────

  const FLAGSHIP = [
    { sid: "selector_sentiment_override", eid: "weekly_hold", label: "Selector WH" },
    { sid: "sentiment", eid: "adr_pullback", label: "Sent+ADR" },
    { sid: "tiered_v3", eid: "weekly_hold", label: "Tiered WH" },
  ];

  console.log("═".repeat(120));
  console.log("  PER-WEEK EQUITY CURVE (cumulative, flagship strategies)");
  console.log("═".repeat(120) + "\n");

  const weekLabels = WEEKS.map((w) =>
    new Date(new Date(w).getTime() + 86400000).toISOString().slice(5, 10),
  );

  console.log(
    "  Strategy".padEnd(16),
    "Mode".padEnd(6),
    weekLabels.map((wk) => wk.padEnd(10)).join(""),
    "Final",
  );
  console.log("  " + "-".repeat(16 + 6 + weekLabels.length * 10 + 8));

  for (const f of FLAGSHIP) {
    const r = results.find((r) => r.strategyId === f.sid && r.entryStyleId === f.eid);
    if (!r) continue;

    // Raw cumulative
    let rawCum = 0;
    const rawCums = r.weekStats.map((w) => { rawCum += w.rawReturn; return rawCum; });
    console.log(
      ("  " + f.label).padEnd(16),
      "Raw".padEnd(6),
      rawCums.map((c) => fmt(c).padEnd(10)).join(""),
      fmt(rawCum),
    );

    // Normalized cumulative
    let normCum = 0;
    const normCums = r.weekStats.map((w) => { normCum += w.normalizedReturn; return normCum; });
    console.log(
      "".padEnd(16),
      "Norm".padEnd(6),
      normCums.map((c) => fmt(c).padEnd(10)).join(""),
      fmt(normCum),
    );
    console.log();
  }

  // Cleanup
  const pool = getPool();
  await pool.end();

  console.log("\n✓ Backtest complete.\n");
}

main().catch((error) => {
  console.error("Backtest failed:", error);
  process.exit(1);
});
