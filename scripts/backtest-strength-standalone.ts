/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-strength-standalone.ts
 *
 * Description:
 * Backtest currency strength as a standalone bias source across
 * the 10-week closed window. Compares strength (weekly hold + ADR)
 * against all existing strategies.
 *
 * Usage: npx tsx scripts/backtest-strength-standalone.ts
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
  MultiWeekResult,
} from "../src/lib/performance/weeklyHoldEngine";

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

/* ─── Stats formatting ─────────────────────────────────────────── */

function formatResult(label: string, r: MultiWeekResult): string {
  const totalReturn = r.weeks.reduce((s, w) => s + w.totalReturnPct, 0);
  const totalTrades = r.weeks.reduce((s, w) => s + w.tradeCount, 0);
  const totalWins = r.weeks.reduce((s, w) => s + w.winCount, 0);
  const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

  // Max drawdown (cumulative weekly)
  let peak = 0;
  let maxDD = 0;
  let cumReturn = 0;
  for (const week of r.weeks) {
    cumReturn += week.totalReturnPct;
    if (cumReturn > peak) peak = cumReturn;
    const dd = peak - cumReturn;
    if (dd > maxDD) maxDD = dd;
  }

  // Losing weeks
  const losingWeeks = r.weeks.filter((w) => w.totalReturnPct < 0).length;

  const returnDD = maxDD > 0 ? (totalReturn / maxDD) : totalReturn > 0 ? Infinity : 0;

  return [
    label.padEnd(38),
    `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%`.padStart(10),
    `${(-maxDD).toFixed(2)}%`.padStart(10),
    `${returnDD.toFixed(1)}x`.padStart(8),
    `${winRate.toFixed(1)}%`.padStart(8),
    `${totalTrades}`.padStart(7),
    `${losingWeeks}/${r.weeks.length}`.padStart(7),
  ].join(" ");
}

function printHeader(): void {
  const header = [
    "Strategy".padEnd(38),
    "Return".padStart(10),
    "Max DD".padStart(10),
    "Ret/DD".padStart(8),
    "WR".padStart(8),
    "Trades".padStart(7),
    "LossWk".padStart(7),
  ].join(" ");
  console.log(header);
  console.log("─".repeat(header.length));
}

/* ─── Per-week breakdown ───────────────────────────────────────── */

function printWeekBreakdown(label: string, r: MultiWeekResult): void {
  console.log(`\n  ${label} — per-week breakdown:`);
  for (const week of r.weeks) {
    const weekDate = week.weekOpenUtc.slice(0, 10);
    const tradeList = week.trades
      .map((t) => `${t.symbol}(${t.direction[0]}:${t.returnPct >= 0 ? "+" : ""}${t.returnPct.toFixed(2)}%)`)
      .join(", ");
    console.log(
      `    ${weekDate}: ${week.totalReturnPct >= 0 ? "+" : ""}${week.totalReturnPct.toFixed(2)}% | ` +
      `${week.tradeCount} trades, ${week.winCount}W/${week.lossCount}L | ${tradeList || "(no trades)"}`,
    );
  }
}

/* ─── Main ─────────────────────────────────────────────────────── */

async function main() {
  const WEEKS = await loadWeeks();
  console.log(`\nLoaded ${WEEKS.length} weeks: ${WEEKS[0]?.slice(0, 10)} → ${WEEKS[WEEKS.length - 1]?.slice(0, 10)}\n`);

  const strengthConfig = getStrategy("strength");
  if (!strengthConfig) {
    console.error("ERROR: 'strength' strategy not found in STRATEGIES");
    process.exit(1);
  }

  const weeklyHold = getEntryStyle("weekly_hold");
  const adrPullback = getEntryStyle("adr_pullback");

  // ─── Run all strategies for comparison ────────────────────────
  const results: Array<{ label: string; result: MultiWeekResult }> = [];

  // Strength standalone
  console.log("Running strength × weekly hold...");
  const strengthWH = await computeMultiWeekHold(strengthConfig, WEEKS, weeklyHold);
  results.push({ label: "Strength × Weekly Hold", result: strengthWH });

  if (adrPullback) {
    console.log("Running strength × ADR pullback...");
    const strengthADR = await computeMultiWeekHold(strengthConfig, WEEKS, adrPullback);
    results.push({ label: "Strength × ADR Pullback", result: strengthADR });
  }

  // Run baselines for comparison
  const baselineStrategies = ["selector_sentiment_override", "sentiment", "tiered_v3", "agree_2of3", "dealer", "commercial"];
  for (const stratId of baselineStrategies) {
    const strat = getStrategy(stratId);
    if (!strat) continue;

    console.log(`Running ${stratId} × weekly hold...`);
    const wh = await computeMultiWeekHold(strat, WEEKS, weeklyHold);
    results.push({ label: `${strat.label} × Weekly Hold`, result: wh });

    if (adrPullback) {
      console.log(`Running ${stratId} × ADR pullback...`);
      const adr = await computeMultiWeekHold(strat, WEEKS, adrPullback);
      results.push({ label: `${strat.label} × ADR Pullback`, result: adr });
    }
  }

  // ─── Print results ─────────────────────────────────────────────
  console.log("\n" + "═".repeat(98));
  console.log("  STRENGTH AS STANDALONE BIAS SOURCE — BACKTEST RESULTS");
  console.log("═".repeat(98) + "\n");

  // Weekly hold section
  console.log("── WEEKLY HOLD ──────────────────────────────────────────────────────────────────────────────────\n");
  printHeader();
  for (const r of results.filter((r) => r.label.includes("Weekly Hold"))) {
    console.log(formatResult(r.label.replace(" × Weekly Hold", ""), r.result));
  }

  // ADR pullback section
  if (adrPullback) {
    console.log("\n── ADR PULLBACK ────────────────────────────────────────────────────────────────────────────────\n");
    printHeader();
    for (const r of results.filter((r) => r.label.includes("ADR Pullback"))) {
      console.log(formatResult(r.label.replace(" × ADR Pullback", ""), r.result));
    }
  }

  // ─── Detailed strength breakdown ───────────────────────────────
  console.log("\n── STRENGTH DETAIL ─────────────────────────────────────────────────────────────────────────────");
  printWeekBreakdown("Strength × Weekly Hold", strengthWH);

  if (adrPullback) {
    const strengthADR = results.find((r) => r.label === "Strength × ADR Pullback");
    if (strengthADR) {
      printWeekBreakdown("Strength × ADR Pullback", strengthADR.result);
    }
  }

  // ─── Asset class breakdown for strength WH ─────────────────────
  console.log("\n── STRENGTH × WEEKLY HOLD — BY ASSET CLASS ─────────────────────────────────────────────────────\n");
  const byAsset: Record<string, { totalReturn: number; trades: number; wins: number; losses: number }> = {};
  for (const week of strengthWH.weeks) {
    for (const trade of week.trades) {
      const ac = trade.assetClass;
      if (!byAsset[ac]) byAsset[ac] = { totalReturn: 0, trades: 0, wins: 0, losses: 0 };
      byAsset[ac]!.totalReturn += trade.returnPct;
      byAsset[ac]!.trades++;
      if (trade.returnPct > 0) byAsset[ac]!.wins++;
      else byAsset[ac]!.losses++;
    }
  }
  for (const [ac, stats] of Object.entries(byAsset).sort((a, b) => b[1].totalReturn - a[1].totalReturn)) {
    const wr = stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0;
    console.log(
      `  ${ac.padEnd(15)} ${stats.totalReturn >= 0 ? "+" : ""}${stats.totalReturn.toFixed(2)}% | ` +
      `${stats.trades} trades, ${stats.wins}W/${stats.losses}L (${wr.toFixed(1)}% WR)`,
    );
  }

  console.log("\n" + "═".repeat(98));
  console.log("  Done.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
