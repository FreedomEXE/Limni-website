/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: verify-selector-parity.ts
 *
 * Description:
 * Verifies that the selector_sentiment_override strategy in the app engine
 * matches the research script's canonical numbers on the 10-week closed window.
 *
 * Expected: +134.29%, max DD -4.71%
 *
 * Usage:
 *   npx tsx scripts/verify-selector-parity.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { readFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

import { computeMultiWeekHold } from "../src/lib/performance/weeklyHoldEngine";
import { getStrategy } from "../src/lib/performance/strategyConfig";

loadEnvConfig(process.cwd());

const SELECTOR_REPORT_PATH = path.resolve(
  process.cwd(),
  "reports",
  "weekly-bias-context",
  "weekly-bias-context-selector-latest.json",
);

const CANONICAL = { returnPct: 134.29, maxDdPct: -4.71 };

async function main() {
  const selectorReport = JSON.parse(readFileSync(SELECTOR_REPORT_PATH, "utf8"));
  const weeks: string[] = selectorReport.ranked[0].weekly.map((w: { weekOpenUtc: string }) => w.weekOpenUtc);

  const strategy = getStrategy("selector_sentiment_override");
  if (!strategy) throw new Error("selector_sentiment_override not found in STRATEGIES");

  console.log("=== Selector Parity Check ===\n");
  console.log(`Strategy: ${strategy.id} (${strategy.label})`);
  console.log(`Window: ${weeks.length} closed weeks\n`);

  const result = await computeMultiWeekHold(strategy, weeks);

  console.log("Per-week breakdown:");
  for (const w of result.weeks) {
    const ret = (w.totalReturnPct >= 0 ? "+" : "") + w.totalReturnPct.toFixed(2) + "%";
    console.log(`  ${w.weekOpenUtc}: ${ret} (${w.tradeCount} trades, ${w.winCount}W/${w.lossCount}L)`);
  }

  console.log(`\nEngine result: +${result.totalReturnPct.toFixed(2)}%, DD ${result.maxDrawdownPct.toFixed(2)}%`);
  console.log(`Research canonical: +${CANONICAL.returnPct}%, DD ${CANONICAL.maxDdPct}%`);

  const retDrift = Math.abs(result.totalReturnPct - CANONICAL.returnPct);
  const ddDrift = Math.abs(result.maxDrawdownPct - CANONICAL.maxDdPct);

  if (retDrift <= 2.0 && ddDrift <= 2.0) {
    console.log(`\n✓ PARITY OK (return drift ${retDrift.toFixed(2)}%, DD drift ${ddDrift.toFixed(2)}%)`);
  } else {
    console.log(`\n✗ PARITY FAILED (return drift ${retDrift.toFixed(2)}%, DD drift ${ddDrift.toFixed(2)}%)`);
  }

  // Also compare against other baselines for context
  console.log("\n=== Baseline Comparison ===\n");
  const baselines = ["sentiment", "tiered_v3", "dealer", "agree_2of3"];
  for (const id of baselines) {
    const s = getStrategy(id);
    if (!s) continue;
    const r = await computeMultiWeekHold(s, weeks);
    const ret = (r.totalReturnPct >= 0 ? "+" : "") + r.totalReturnPct.toFixed(2) + "%";
    const dd = r.maxDrawdownPct.toFixed(2) + "%";
    console.log(`  ${id}: ${ret}, DD ${dd}`);
  }
}

main().catch((error) => {
  console.error("Verification failed:", error);
  process.exit(1);
});
