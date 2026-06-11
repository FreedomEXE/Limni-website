/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: rank-current-intraday-strategies.ts
 *
 * Description:
 * Ranks the currently available app intraday strategies using the
 * canonical weekly-hold engine with `adr_pullback`.
 *
 * Uses the selector report's exact fully-closed 10-week window so the
 * comparison stays on realized weeks only.
 *
 * Outputs:
 *   - raw return
 *   - max drawdown
 *   - win rate
 *   - Calmar-like return / abs(drawdown)
 *
 * Usage:
 *   npx tsx scripts/rank-current-intraday-strategies.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

import { computeMultiWeekHold } from "../src/lib/performance/weeklyHoldEngine";
import { getIntradayFilter, STRATEGIES } from "../src/lib/performance/strategyConfig";

loadEnvConfig(process.cwd());

const SELECTOR_REPORT_PATH = path.resolve(
  process.cwd(),
  "reports",
  "weekly-bias-context",
  "weekly-bias-context-selector-latest.json",
);
const OUTPUT_DIR = path.resolve(process.cwd(), "app", "reports", "weekly-bias-context");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "current-intraday-strategy-ranking-latest.json");

type PolicyWeek = {
  weekOpenUtc: string;
};

type PolicySummary = {
  policy: string;
  weekly: PolicyWeek[];
};

type SelectorReport = {
  ranked: PolicySummary[];
};

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

async function main() {
  const selectorReport = JSON.parse(readFileSync(SELECTOR_REPORT_PATH, "utf8")) as SelectorReport;
  const firstSummary = selectorReport.ranked[0];
  if (!firstSummary) {
    throw new Error("Selector report is empty.");
  }

  const weeks = firstSummary.weekly.map((week) => week.weekOpenUtc);
  const intradayFilter = getIntradayFilter("adr_pullback");
  if (!intradayFilter) {
    throw new Error("adr_pullback intraday filter not found.");
  }

  const results = [];
  for (const strategy of STRATEGIES) {
    const result = await computeMultiWeekHold(strategy, weeks, intradayFilter);
    const ddAbs = Math.abs(result.maxDrawdownPct);
    results.push({
      strategy: strategy.id,
      label: strategy.label,
      weeks: result.weeks.length,
      trades: result.totalTrades,
      returnPct: round(result.totalReturnPct),
      maxDrawdownPct: round(result.maxDrawdownPct),
      winRatePct: round(result.winRate),
      avgWeeklyReturnPct: round(result.weeks.length > 0 ? result.totalReturnPct / result.weeks.length : 0),
      returnToDrawdown: round(ddAbs > 0 ? result.totalReturnPct / ddAbs : 0, 3),
    });
  }

  const rankedByReturnToDd = [...results].sort((a, b) => {
    if (b.returnToDrawdown !== a.returnToDrawdown) return b.returnToDrawdown - a.returnToDrawdown;
    if (b.returnPct !== a.returnPct) return b.returnPct - a.returnPct;
    return b.winRatePct - a.winRatePct;
  });

  const report = {
    generatedUtc: new Date().toISOString(),
    methodology: {
      filter: "adr_pullback",
      windowSource: SELECTOR_REPORT_PATH,
      weeks,
      rankingMetric: "return_to_drawdown",
      note: "Return-to-drawdown is a simple Calmar-like ratio using total return divided by absolute max drawdown on the same fully-closed 10-week canonical window.",
    },
    rankedByReturnToDrawdown: rankedByReturnToDd,
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2), "utf8");

  console.log(`Current intraday strategy ranking: ${OUTPUT_PATH}`);
  for (const row of rankedByReturnToDd) {
    console.log(
      `${row.strategy}: ${row.returnPct >= 0 ? "+" : ""}${row.returnPct.toFixed(2)}% | DD ${row.maxDrawdownPct.toFixed(2)}% | R/DD ${row.returnToDrawdown.toFixed(3)} | WR ${row.winRatePct.toFixed(2)}% | trades ${row.trades}`,
    );
  }
}

main().catch((error) => {
  console.error("Current intraday strategy ranking failed:", error);
  process.exit(1);
});
