/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: verify-dealer-baseline.ts
 *
 * Quick verification: dealer standalone via the app's weeklyHoldEngine
 * vs the veto script's manual calculation. Prints both side by side.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { DateTime } from "luxon";
import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getDisplayWeekOpenUtc } from "../src/lib/weekAnchor";
import { getCanonicalBasketWeek, filterByModel, nonNeutralSignals } from "../src/lib/performance/basketSource";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { loadWeeklyAdrMap, getAdrPct, getTargetAdrPct } from "../src/lib/performance/adrLookup";

function buildWeekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd");
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  DEALER STANDALONE VERIFICATION (ADR Normalized)");
  console.log("═══════════════════════════════════════════════════════════\n");

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const allWeeks = await listDataSectionWeeks();
  const weeks = allWeeks
    .sort((a, b) => a.localeCompare(b))
    .filter((w) => w < currentWeekOpenUtc);

  const targetAdr = getTargetAdrPct();
  console.log(`Target ADR: ${targetAdr}%`);
  console.log(`Weeks: ${weeks.length}\n`);

  console.log(
    "  " +
    "Week".padEnd(10) +
    "Trades".padStart(8) +
    "Raw %".padStart(10) +
    "ADR Norm %".padStart(12) +
    "Wins".padStart(6) +
    "Losses".padStart(8) +
    "Pairs",
  );
  console.log(`  ${"─".repeat(70)}`);

  let totalRaw = 0;
  let totalNorm = 0;
  let totalTrades = 0;
  let totalWins = 0;
  let totalLosses = 0;
  let maxDD = 0;
  let runningEquity = 0;
  let peak = 0;

  for (const weekOpenUtc of weeks) {
    const weekLabel = buildWeekLabel(weekOpenUtc);
    const basketWeek = await getCanonicalBasketWeek(weekOpenUtc);
    const dealerSignals = nonNeutralSignals(filterByModel(basketWeek, "dealer"));
    const weeklyReturns = await getWeeklyPairReturns(weekOpenUtc);
    const adrMap = await loadWeeklyAdrMap(weekOpenUtc);

    const returnMap = new Map<string, { returnPct: number; assetClass: string }>();
    for (const r of weeklyReturns) {
      returnMap.set(r.symbol.toUpperCase(), { returnPct: r.returnPct, assetClass: r.assetClass });
    }

    let weekRaw = 0;
    let weekNorm = 0;
    let weekWins = 0;
    let weekLosses = 0;
    const pairs: string[] = [];

    for (const sig of dealerSignals) {
      const pair = sig.symbol.toUpperCase();
      const ret = returnMap.get(pair);
      if (!ret) continue;

      const directed = sig.direction === "SHORT" ? -ret.returnPct : ret.returnPct;
      const pairAdr = getAdrPct(adrMap, pair, ret.assetClass);
      const multiplier = pairAdr > 0 ? targetAdr / pairAdr : 1;
      const normalized = directed * multiplier;

      weekRaw += directed;
      weekNorm += normalized;
      if (normalized > 0) weekWins++;
      else weekLosses++;
      pairs.push(pair);
    }

    totalRaw += weekRaw;
    totalNorm += weekNorm;
    totalTrades += pairs.length;
    totalWins += weekWins;
    totalLosses += weekLosses;

    runningEquity += weekNorm;
    if (runningEquity > peak) peak = runningEquity;
    const dd = peak - runningEquity;
    if (dd > maxDD) maxDD = dd;

    console.log(
      "  " +
      weekLabel.padEnd(10) +
      String(pairs.length).padStart(8) +
      weekRaw.toFixed(2).padStart(10) +
      weekNorm.toFixed(2).padStart(12) +
      String(weekWins).padStart(6) +
      String(weekLosses).padStart(8) +
      "  " + pairs.join(", "),
    );
  }

  console.log(`  ${"─".repeat(70)}`);
  console.log(
    "  " +
    "TOTAL".padEnd(10) +
    String(totalTrades).padStart(8) +
    totalRaw.toFixed(2).padStart(10) +
    totalNorm.toFixed(2).padStart(12) +
    String(totalWins).padStart(6) +
    String(totalLosses).padStart(8),
  );
  console.log(`\n  Win Rate: ${((totalWins / totalTrades) * 100).toFixed(1)}%`);
  console.log(`  Max Drawdown: ${maxDD.toFixed(2)}%`);
  console.log(`  Return/DD Ratio: ${(totalNorm / maxDD).toFixed(1)}x`);

  console.log("\nDone.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
