/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-stoch-entry-modes.ts
 *
 * Description:
 * Backtests three intraday entry modes head-to-head on the canonical
 * 10-week closed window using sentiment bias source:
 *   1. ADR Pullback (baseline via canonical engine — guaranteed parity)
 *   2. Stoch Only (zone-based, plain stochastic %D)
 *   3. ADR + Stoch (latching — both must fire, second triggers entry)
 *
 * Protocol: BACKTEST_CANONICAL_PROTOCOL.md
 *   - Uses computeMultiWeekHold for ADR baseline (exact canonical path)
 *   - Extracts traded pairs from engine output for apples-to-apples Stoch comparison
 *   - Labels all results clearly
 *
 * Usage:
 *   npx tsx scripts/backtest-stoch-entry-modes.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { readFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { computeMultiWeekHold, type MultiWeekResult } from "../src/lib/performance/weeklyHoldEngine";
import { getStrategy, getIntradayFilter } from "../src/lib/performance/strategyConfig";
import { getCanonicalWeekWindow } from "../src/lib/canonicalPriceWindows";
import {
  fetchOanda5MinuteSeries,
  fetchOandaDailySeries,
  type OandaHourlyCandle,
} from "../src/lib/oandaPrices";
import { scanAdrTrades, type H1Bar } from "../src/lib/flagship/adrTradeScanner";

loadEnvConfig(process.cwd());

// ── Config ─────────────────────────────────────────────────────────
const ADR_LOOKBACK_DAYS = 10;
const ADR_MIN_REQUIRED_DAYS = 5;
const ENTRY_MULTIPLE = 1.0;
const TP_MULTIPLE = 0.25;
const CONCURRENCY = 6;

// Stoch params (matches Pine indicator / RRanjanFX)
const STOCH_K_PERIOD = 100;
const STOCH_SMOOTH = 3;
const STOCH_D_PERIOD = 21;
const STOCH_OB = 80;
const STOCH_OS = 20;

// Canonical baseline for parity check
const CANONICAL_SENTIMENT_ADR = { returnPct: 49.47, maxDdPct: -8.78 };
const PARITY_TOLERANCE_PCT = 2.0;

const SELECTOR_REPORT_PATH = path.resolve(
  process.cwd(),
  "reports",
  "weekly-bias-context",
  "weekly-bias-context-selector-latest.json",
);

type EntryMode = "adr_pullback" | "stoch_only" | "adr_stoch";

type TradeResult = {
  pair: string;
  direction: "LONG" | "SHORT";
  weekOpenUtc: string;
  entryPrice: number;
  exitPrice: number | null;
  returnPct: number | null;
  exitType: "TP_HIT" | "WEEK_CLOSE" | null;
  mode: EntryMode;
};

type WeekSummary = {
  weekOpenUtc: string;
  returnPct: number;
  trades: number;
};

type ModeResult = {
  mode: EntryMode;
  label: string;
  weeks: WeekSummary[];
  totalReturnPct: number;
  maxDrawdownPct: number;
  totalTrades: number;
  winCount: number;
  winRate: number;
};

// ── Concurrency helper ──────────────────────────────────────────────
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

// ── ADR computation (same as adrWeekScanner) ────────────────────────
async function computeAdr(
  pair: string,
  beforeUtc: string,
  assetClass: string,
): Promise<{ adrPct: number; adrDistance: number } | null> {
  const before = DateTime.fromISO(beforeUtc, { zone: "utc" });
  const from = before.minus({ days: ADR_LOOKBACK_DAYS + 10 });
  const dailyAlignment = assetClass === "fx" ? 17 : 18;
  const dailyBars = await fetchOandaDailySeries(pair, from, before, dailyAlignment).catch(() => []);
  const withoutMostRecent = dailyBars.slice(0, -1);
  const recent = withoutMostRecent.slice(-ADR_LOOKBACK_DAYS);

  const absRanges = recent
    .filter((bar) => Number.isFinite(bar.high) && Number.isFinite(bar.low) && bar.high > 0 && bar.low > 0)
    .map((bar) => bar.high - bar.low);
  const pctRanges = recent
    .filter((bar) => Number.isFinite(bar.high) && Number.isFinite(bar.low) && Number.isFinite(bar.open) && bar.open > 0)
    .map((bar) => ((bar.high - bar.low) / bar.open) * 100);

  if (absRanges.length < ADR_MIN_REQUIRED_DAYS || pctRanges.length < ADR_MIN_REQUIRED_DAYS) return null;

  return {
    adrPct: pctRanges.reduce((s, v) => s + v, 0) / pctRanges.length,
    adrDistance: absRanges.reduce((s, v) => s + v, 0) / absRanges.length,
  };
}

// ── Stochastic %D computation on M5 bars ────────────────────────────
function computeStochD(bars: OandaHourlyCandle[]): (number | null)[] {
  const n = bars.length;
  const rawK = new Array<number | null>(n).fill(null);
  const smoothK = new Array<number | null>(n).fill(null);
  const dLine = new Array<number | null>(n).fill(null);

  for (let i = STOCH_K_PERIOD - 1; i < n; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - STOCH_K_PERIOD + 1; j <= i; j++) {
      highest = Math.max(highest, bars[j]!.high);
      lowest = Math.min(lowest, bars[j]!.low);
    }
    const range = highest - lowest;
    rawK[i] = range > 0 ? ((bars[i]!.close - lowest) / range) * 100 : 50;
  }

  for (let i = 0; i < n; i++) {
    if (i < STOCH_K_PERIOD - 1 + STOCH_SMOOTH - 1) continue;
    let sum = 0;
    let count = 0;
    for (let j = i - STOCH_SMOOTH + 1; j <= i; j++) {
      if (rawK[j] !== null) { sum += rawK[j]!; count++; }
    }
    smoothK[i] = count === STOCH_SMOOTH ? sum / count : null;
  }

  for (let i = 0; i < n; i++) {
    if (i < STOCH_K_PERIOD - 1 + STOCH_SMOOTH - 1 + STOCH_D_PERIOD - 1) continue;
    let sum = 0;
    let count = 0;
    for (let j = i - STOCH_D_PERIOD + 1; j <= i; j++) {
      if (smoothK[j] !== null) { sum += smoothK[j]!; count++; }
    }
    dLine[i] = count === STOCH_D_PERIOD ? sum / count : null;
  }

  return dLine;
}

// ── Stoch Only scanner ──────────────────────────────────────────────
function scanStochOnlyTrades(
  pair: string,
  direction: "LONG" | "SHORT",
  weekOpenUtc: string,
  adrPct: number,
  adrDistance: number,
  bars: OandaHourlyCandle[],
  stochD: (number | null)[],
): TradeResult[] {
  if (bars.length === 0) return [];

  const rawAdr = adrDistance;
  const results: TradeResult[] = [];
  let inTrade = false;
  let entryPrice = 0;
  let tpPrice = 0;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]!;
    const d = stochD[i];

    if (inTrade) {
      const tpHit = direction === "LONG" ? bar.high >= tpPrice : bar.low <= tpPrice;
      if (tpHit) {
        results.push({
          pair, direction, weekOpenUtc, entryPrice,
          exitPrice: tpPrice,
          returnPct: TP_MULTIPLE * adrPct,
          exitType: "TP_HIT",
          mode: "stoch_only",
        });
        inTrade = false;
      }
      continue;
    }

    if (d === null) continue;
    const inZone = direction === "LONG" ? d < STOCH_OS : d > STOCH_OB;
    if (inZone) {
      entryPrice = bar.close;
      tpPrice = direction === "LONG"
        ? entryPrice + rawAdr * TP_MULTIPLE
        : entryPrice - rawAdr * TP_MULTIPLE;
      inTrade = true;
    }
  }

  if (inTrade) {
    const lastBar = bars[bars.length - 1]!;
    const rawReturn = direction === "LONG"
      ? ((lastBar.close - entryPrice) / entryPrice) * 100
      : ((entryPrice - lastBar.close) / entryPrice) * 100;
    results.push({
      pair, direction, weekOpenUtc, entryPrice,
      exitPrice: lastBar.close,
      returnPct: rawReturn,
      exitType: "WEEK_CLOSE",
      mode: "stoch_only",
    });
  }

  return results;
}

// ── ADR + Stoch scanner (latching) ──────────────────────────────────
function scanAdrStochTrades(
  pair: string,
  direction: "LONG" | "SHORT",
  weekOpenUtc: string,
  adrPct: number,
  adrDistance: number,
  bars: OandaHourlyCandle[],
  stochD: (number | null)[],
): TradeResult[] {
  if (bars.length === 0) return [];

  const rawAdr = adrDistance;
  const entryDistance = rawAdr * ENTRY_MULTIPLE;
  const results: TradeResult[] = [];

  let anchor: number | null = null;
  let inTrade = false;
  let entryPrice = 0;
  let tpPrice = 0;
  let adrArmed = false;
  let stochArmed = false;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]!;
    const d = stochD[i];

    if (inTrade) {
      const tpHit = direction === "LONG" ? bar.high >= tpPrice : bar.low <= tpPrice;
      if (tpHit) {
        results.push({
          pair, direction, weekOpenUtc, entryPrice,
          exitPrice: tpPrice,
          returnPct: TP_MULTIPLE * adrPct,
          exitType: "TP_HIT",
          mode: "adr_stoch",
        });
        inTrade = false;
        adrArmed = false;
        stochArmed = false;
        anchor = direction === "LONG" ? bar.high : bar.low;
      }
      continue;
    }

    if (anchor === null) {
      anchor = direction === "LONG" ? bar.high : bar.low;
      continue;
    }

    const prevAnchor = anchor;
    anchor = direction === "LONG"
      ? Math.max(anchor, bar.high)
      : Math.min(anchor, bar.low);

    const ep = direction === "LONG"
      ? prevAnchor - entryDistance
      : prevAnchor + entryDistance;
    const adrHit = direction === "LONG" ? bar.low <= ep : bar.high >= ep;
    const stochHit = d !== null && (direction === "LONG" ? d < STOCH_OS : d > STOCH_OB);

    if (adrHit) adrArmed = true;
    if (stochHit) stochArmed = true;

    if (adrArmed && stochArmed) {
      const wasAdrArmedBefore = adrArmed && !adrHit;
      if (wasAdrArmedBefore || (!adrHit && stochHit)) {
        entryPrice = bar.close;
      } else {
        entryPrice = ep;
      }
      tpPrice = direction === "LONG"
        ? entryPrice + rawAdr * TP_MULTIPLE
        : entryPrice - rawAdr * TP_MULTIPLE;
      inTrade = true;
      adrArmed = false;
      stochArmed = false;
    }
  }

  if (inTrade) {
    const lastBar = bars[bars.length - 1]!;
    const rawReturn = direction === "LONG"
      ? ((lastBar.close - entryPrice) / entryPrice) * 100
      : ((entryPrice - lastBar.close) / entryPrice) * 100;
    results.push({
      pair, direction, weekOpenUtc, entryPrice,
      exitPrice: lastBar.close,
      returnPct: rawReturn,
      exitType: "WEEK_CLOSE",
      mode: "adr_stoch",
    });
  }

  return results;
}

// ── Aggregate trades into ModeResult ────────────────────────────────
function aggregateTrades(
  mode: EntryMode,
  label: string,
  weeklyTrades: Map<string, TradeResult[]>,
  weeks: string[],
): ModeResult {
  const weekSummaries: WeekSummary[] = [];
  let cumReturn = 0;
  let maxDd = 0;
  let peak = 0;
  let totalTrades = 0;
  let winCount = 0;

  for (const weekOpenUtc of weeks) {
    const trades = weeklyTrades.get(weekOpenUtc) ?? [];
    const weekReturn = trades.reduce((s, t) => s + (t.returnPct ?? 0), 0);
    weekSummaries.push({ weekOpenUtc, returnPct: weekReturn, trades: trades.length });

    cumReturn += weekReturn;
    peak = Math.max(peak, cumReturn);
    maxDd = Math.min(maxDd, cumReturn - peak);
    totalTrades += trades.length;
    winCount += trades.filter((t) => (t.returnPct ?? 0) > 0).length;
  }

  return {
    mode, label, weeks: weekSummaries,
    totalReturnPct: cumReturn,
    maxDrawdownPct: maxDd,
    totalTrades, winCount,
    winRate: totalTrades > 0 ? (winCount / totalTrades) * 100 : 0,
  };
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Stoch Entry Mode Backtest ===\n");
  console.log("Protocol: BACKTEST_CANONICAL_PROTOCOL.md");
  console.log("Bias source: sentiment (canonical engine path)");
  console.log(`Stoch params: K=${STOCH_K_PERIOD}, Smooth=${STOCH_SMOOTH}, D=${STOCH_D_PERIOD}, OB=${STOCH_OB}, OS=${STOCH_OS}\n`);

  // Load closed weeks from selector report
  const selectorReport = JSON.parse(readFileSync(SELECTOR_REPORT_PATH, "utf8"));
  const weeks: string[] = selectorReport.ranked[0].weekly.map((w: { weekOpenUtc: string }) => w.weekOpenUtc);
  console.log(`Window: ${weeks.length} closed weeks (${weeks[0]} → ${weeks[weeks.length - 1]})\n`);

  // ── STEP 1: ADR baseline via canonical engine ─────────────────────
  console.log("Step 1: Computing ADR baseline via canonical engine...");
  const sentimentStrategy = getStrategy("sentiment");
  if (!sentimentStrategy) throw new Error("sentiment strategy not found");
  const adrFilter = getIntradayFilter("adr_pullback");
  if (!adrFilter) throw new Error("adr_pullback filter not found");

  const adrEngineResult = await computeMultiWeekHold(sentimentStrategy, weeks, adrFilter);

  // ── PARITY CHECK ──────────────────────────────────────────────────
  console.log("\n=== PARITY CHECK (sentiment + ADR baseline) ===");
  console.log(`  Canonical: +${CANONICAL_SENTIMENT_ADR.returnPct}%, DD ${CANONICAL_SENTIMENT_ADR.maxDdPct}%`);
  console.log(`  Engine:    +${adrEngineResult.totalReturnPct.toFixed(2)}%, DD ${adrEngineResult.maxDrawdownPct.toFixed(2)}%`);

  const returnDrift = Math.abs(adrEngineResult.totalReturnPct - CANONICAL_SENTIMENT_ADR.returnPct);
  const ddDrift = Math.abs(adrEngineResult.maxDrawdownPct - CANONICAL_SENTIMENT_ADR.maxDdPct);
  const parityOk = returnDrift <= PARITY_TOLERANCE_PCT && ddDrift <= PARITY_TOLERANCE_PCT;

  if (parityOk) {
    console.log(`  ✓ PARITY OK (drift: return ${returnDrift.toFixed(2)}%, DD ${ddDrift.toFixed(2)}%)`);
  } else {
    console.log(`  ✗ PARITY FAILED (drift: return ${returnDrift.toFixed(2)}%, DD ${ddDrift.toFixed(2)}%)`);
    console.log("  WARNING: Results may not be trustworthy. Investigate parity first.");
  }

  // ── STEP 2: Extract traded pairs per week from engine output ──────
  // These are the exact pairs+directions that the canonical engine approved
  console.log("\nStep 2: Extracting traded pairs from engine output...");

  type PairSignal = { pair: string; direction: "LONG" | "SHORT"; assetClass: string };
  const weekPairs = new Map<string, PairSignal[]>();

  for (const weekResult of adrEngineResult.weeks) {
    const seen = new Set<string>();
    const signals: PairSignal[] = [];
    for (const trade of weekResult.trades) {
      const key = `${trade.symbol}:${trade.direction}`;
      if (seen.has(key)) continue;
      seen.add(key);
      signals.push({
        pair: trade.symbol,
        direction: trade.direction,
        assetClass: trade.assetClass,
      });
    }
    weekPairs.set(weekResult.weekOpenUtc, signals);
  }

  const totalPairWeeks = [...weekPairs.values()].reduce((s, v) => s + v.length, 0);
  console.log(`  ${totalPairWeeks} pair-week combos across ${weeks.length} weeks`);

  // ── STEP 3: Scan Stoch modes on the same pair universe ────────────
  console.log("\nStep 3: Scanning Stoch modes on same pair universe...\n");

  const stochTrades = new Map<string, TradeResult[]>();
  const adrStochTrades = new Map<string, TradeResult[]>();
  // Also re-scan ADR from M5 data to have a fresh comparison point
  const adrFreshTrades = new Map<string, TradeResult[]>();

  for (const week of weeks) {
    stochTrades.set(week, []);
    adrStochTrades.set(week, []);
    adrFreshTrades.set(week, []);
  }

  for (const weekOpenUtc of weeks) {
    const signals = weekPairs.get(weekOpenUtc) ?? [];
    if (signals.length === 0) continue;
    console.log(`  ${weekOpenUtc}: ${signals.length} pairs`);

    await mapWithConcurrency(signals, CONCURRENCY, async (signal) => {
      const { pair, direction, assetClass } = signal;
      const ac = assetClass as "fx" | "indices" | "commodities" | "crypto";

      const weekWindow = getCanonicalWeekWindow(weekOpenUtc, ac);
      const adr = await computeAdr(pair, weekWindow.openUtc.toISO()!, assetClass);
      if (!adr) return;

      const m5Bars = await fetchOanda5MinuteSeries(pair, weekWindow.openUtc, weekWindow.closeUtc).catch(() => []);
      if (m5Bars.length === 0) return;

      const stochD = computeStochD(m5Bars);

      // ADR fresh (for sanity — should closely match engine)
      const adrResults = scanAdrTrades({
        pair, assetClass, direction, weekOpenUtc,
        adrPct: adr.adrPct, adrAbsoluteDistance: adr.adrDistance,
        bars: m5Bars as H1Bar[],
        closeAtWeekEnd: true,
      });
      for (const t of adrResults) {
        adrFreshTrades.get(weekOpenUtc)!.push({
          pair: t.pair, direction: t.direction, weekOpenUtc,
          entryPrice: t.entryPrice, exitPrice: t.exitPrice,
          returnPct: t.returnPct, exitType: t.exitType,
          mode: "adr_pullback",
        });
      }

      // Stoch Only
      const stochResults = scanStochOnlyTrades(
        pair, direction, weekOpenUtc,
        adr.adrPct, adr.adrDistance, m5Bars, stochD,
      );
      stochTrades.get(weekOpenUtc)!.push(...stochResults);

      // ADR + Stoch
      const adrStochResults = scanAdrStochTrades(
        pair, direction, weekOpenUtc,
        adr.adrPct, adr.adrDistance, m5Bars, stochD,
      );
      adrStochTrades.get(weekOpenUtc)!.push(...adrStochResults);
    });
  }

  // ── STEP 4: Aggregate and compare ─────────────────────────────────
  const stochResult = aggregateTrades("stoch_only", "Stoch Only", stochTrades, weeks);
  const adrStochResult = aggregateTrades("adr_stoch", "ADR + Stoch", adrStochTrades, weeks);
  const adrFreshResult = aggregateTrades("adr_pullback", "ADR Fresh", adrFreshTrades, weeks);

  // Build ADR engine summary for the table (from canonical engine)
  const adrEngineSummary: ModeResult = {
    mode: "adr_pullback",
    label: "ADR (engine)",
    weeks: adrEngineResult.weeks.map((w) => ({
      weekOpenUtc: w.weekOpenUtc,
      returnPct: w.totalReturnPct,
      trades: w.tradeCount,
    })),
    totalReturnPct: adrEngineResult.totalReturnPct,
    maxDrawdownPct: adrEngineResult.maxDrawdownPct,
    totalTrades: adrEngineResult.totalTrades,
    winCount: adrEngineResult.totalWins,
    winRate: adrEngineResult.winRate,
  };

  // ── Results table ─────────────────────────────────────────────────
  console.log("\n=== COMPARISON TABLE ===\n");
  console.log("Mode            | Return %  | Max DD %  | Return/DD | Trades | Win Rate");
  console.log("----------------|-----------|-----------|-----------|--------|--------");

  for (const r of [adrEngineSummary, adrFreshResult, stochResult, adrStochResult]) {
    const ddAbs = Math.abs(r.maxDrawdownPct);
    const rtd = ddAbs > 0 ? r.totalReturnPct / ddAbs : 0;
    const label = r.label.padEnd(15);
    const ret = (r.totalReturnPct >= 0 ? "+" : "") + r.totalReturnPct.toFixed(2) + "%";
    const dd = r.maxDrawdownPct.toFixed(2) + "%";
    const trades = String(r.totalTrades);
    const wr = r.winRate.toFixed(1) + "%";
    console.log(`${label} | ${ret.padStart(9)} | ${dd.padStart(9)} | ${rtd.toFixed(3).padStart(9)} | ${trades.padStart(6)} | ${wr.padStart(6)}`);
  }

  // ── Per-week breakdown ────────────────────────────────────────────
  console.log("\n=== PER-WEEK BREAKDOWN ===\n");
  console.log("Week                        | ADR (engine) | ADR (fresh)  | Stoch Only   | ADR + Stoch");
  console.log("----------------------------|--------------|--------------|--------------|------------");

  const fmtReturn = (r: number) => ((r >= 0 ? "+" : "") + r.toFixed(2) + "%").padStart(12);

  for (const week of weeks) {
    const adrEngWeek = adrEngineSummary.weeks.find((w) => w.weekOpenUtc === week);
    const adrFrWeek = adrFreshResult.weeks.find((w) => w.weekOpenUtc === week);
    const stochWeek = stochResult.weeks.find((w) => w.weekOpenUtc === week);
    const adrStochWeek = adrStochResult.weeks.find((w) => w.weekOpenUtc === week);
    console.log(
      `${week} | ${fmtReturn(adrEngWeek?.returnPct ?? 0)} | ${fmtReturn(adrFrWeek?.returnPct ?? 0)} | ${fmtReturn(stochWeek?.returnPct ?? 0)} | ${fmtReturn(adrStochWeek?.returnPct ?? 0)}`,
    );
  }

  // ── Assessment ────────────────────────────────────────────────────
  console.log("\n=== ASSESSMENT ===\n");

  // Compare against ADR engine baseline (the source of truth)
  const baseline = adrEngineSummary;
  const modes = [stochResult, adrStochResult];

  for (const m of modes) {
    const ddAbs = Math.abs(m.maxDrawdownPct);
    const baselineDdAbs = Math.abs(baseline.maxDrawdownPct);
    const mRatio = ddAbs > 0 ? m.totalReturnPct / ddAbs : 0;
    const bRatio = baselineDdAbs > 0 ? baseline.totalReturnPct / baselineDdAbs : 0;
    const better = mRatio > bRatio;
    console.log(`${m.label}: ${better ? "BETTER" : "WORSE"} return/DD than ADR baseline (${mRatio.toFixed(3)} vs ${bRatio.toFixed(3)})`);
  }

  console.log("\nResult type: canonical engine variant (ADR from engine, Stoch from fresh M5 scan on same pairs)");
}

main().catch((error) => {
  console.error("Backtest failed:", error);
  process.exit(1);
});
