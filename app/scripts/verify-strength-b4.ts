/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: verify-strength-b4.ts
 *
 * Quick verification: canonical strength standalone via the shared B4
 * resolver path, ADR normalized, week by week.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { DateTime } from "luxon";
import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getDisplayWeekOpenUtc } from "../src/lib/weekAnchor";
import { readCanonicalStrengthDirections } from "../src/lib/strength/canonicalDirection";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "../src/lib/performance/adrLookup";

function buildWeekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd");
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  STRENGTH B4 VERIFICATION (ADR Normalized)");
  console.log("═══════════════════════════════════════════════════════════\n");

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const allWeeks = await listDataSectionWeeks();
  const weeks = allWeeks
    .sort((a, b) => a.localeCompare(b))
    .filter((w) => w < currentWeekOpenUtc);

  const targetAdr = getTargetAdrPct();
  console.log(`Target ADR: ${targetAdr}%`);
  console.log(`Weeks: ${weeks.length}\n`);

  let totalNorm = 0;
  let totalTrades = 0;
  let totalWins = 0;
  let maxDD = 0;
  let runningEquity = 0;
  let peak = 0;
  let losingWeeks = 0;

  for (const weekOpenUtc of weeks) {
    const [strengthSignals, weeklyReturns, adrMap] = await Promise.all([
      readCanonicalStrengthDirections(weekOpenUtc),
      getWeeklyPairReturns(weekOpenUtc),
      loadWeeklyAdrMap(weekOpenUtc),
    ]);

    const returnMap = new Map<string, { returnPct: number; assetClass: string }>();
    for (const row of weeklyReturns) {
      returnMap.set(row.symbol.toUpperCase(), {
        returnPct: row.returnPct,
        assetClass: row.assetClass,
      });
    }

    let weekNorm = 0;
    let weekWins = 0;

    for (const sig of strengthSignals) {
      const ret = returnMap.get(sig.pair.toUpperCase());
      if (!ret) continue;

      const directed = sig.direction === "SHORT" ? -ret.returnPct : ret.returnPct;
      const pairAdr = getAdrPct(adrMap, sig.pair, ret.assetClass);
      const multiplier = pairAdr > 0 ? targetAdr / pairAdr : 1;
      const normalized = directed * multiplier;

      weekNorm += normalized;
      if (normalized > 0) weekWins += 1;
    }

    totalNorm += weekNorm;
    totalTrades += strengthSignals.length;
    totalWins += weekWins;

    runningEquity += weekNorm;
    if (runningEquity > peak) peak = runningEquity;
    maxDD = Math.max(maxDD, peak - runningEquity);
    if (weekNorm < 0) losingWeeks += 1;

    console.log(
      "  " +
      buildWeekLabel(weekOpenUtc).padEnd(10) +
      String(strengthSignals.length).padStart(8) +
      weekNorm.toFixed(2).padStart(12),
    );
  }

  console.log(`\n  TOTAL trades: ${totalTrades}`);
  console.log(`  TOTAL return: ${totalNorm.toFixed(2)}%`);
  console.log(`  Win Rate: ${((totalWins / totalTrades) * 100).toFixed(1)}%`);
  console.log(`  Max Drawdown: ${maxDD.toFixed(2)}%`);
  console.log(`  Losing Weeks: ${losingWeeks}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
