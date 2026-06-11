/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: verify-selector-strength-veto.ts
 *
 * Description:
 * Verifies Variant B of the strength selector experiment:
 * strong strength disagreement vetoes the selector direction to NEUTRAL.
 *
 * Usage:
 *   npx tsx scripts/verify-selector-strength-veto.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";

import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import {
  resolveSelectorStrengthVetoAudit,
  type SelectorAuditEntry,
  type SelectorStrengthBranch,
} from "../src/lib/performance/selectorEngine";
import { computeMultiWeekHold } from "../src/lib/performance/weeklyHoldEngine";
import { getStrategy } from "../src/lib/performance/strategyConfig";

loadEnvConfig(process.cwd());

function increment<K extends string>(map: Map<K, number>, key: K) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function formatSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

async function main() {
  const weeks = (await listDataSectionWeeks()).sort((left, right) => left.localeCompare(right));
  const strategy = getStrategy("selector_sentiment_override");
  if (!strategy) {
    throw new Error("selector_sentiment_override not found in strategy config.");
  }

  const baseline = await computeMultiWeekHold(strategy, weeks);
  const realizedWeekSet = new Set(baseline.weeks.map((week) => week.weekOpenUtc));

  const branchCounts = new Map<SelectorStrengthBranch, number>();
  const perAsset = new Map<string, { returnPct: number; trades: number; wins: number; vetoes: number }>();
  const weeklyRows: Array<{
    weekOpenUtc: string;
    returnPct: number;
    trades: number;
    vetoes: number;
    changed: number;
  }> = [];
  const currentWeekFocus: SelectorAuditEntry[] = [];

  let totalReturnPct = 0;
  let totalTrades = 0;
  let totalWins = 0;
  let totalVetoes = 0;
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const weekOpenUtc of weeks) {
    const [auditWeek, pairReturns] = await Promise.all([
      resolveSelectorStrengthVetoAudit(weekOpenUtc),
      getWeeklyPairReturns(weekOpenUtc),
    ]);

    const pairReturnBySymbol = new Map(
      pairReturns.map((row) => [row.symbol.toUpperCase(), row]),
    );

    let weekReturn = 0;
    let weekTrades = 0;
    let weekWins = 0;
    let weekVetoes = 0;
    let weekChanged = 0;

    for (const entry of auditWeek.entries) {
      increment(branchCounts, entry.strengthBranch);

      if (entry.baseDirection !== entry.finalDirection) {
        weekChanged += 1;
      }

      if (entry.strengthBranch === "strength_veto_blocked") {
        weekVetoes += 1;
      }

      if (!realizedWeekSet.has(weekOpenUtc) || entry.finalDirection === "NEUTRAL") {
        continue;
      }

      const pairReturn = pairReturnBySymbol.get(entry.pair.toUpperCase());
      if (!pairReturn) continue;

      const directedReturn = entry.finalDirection === "SHORT" ? -pairReturn.returnPct : pairReturn.returnPct;
      weekReturn += directedReturn;
      weekTrades += 1;
      if (directedReturn > 0) {
        weekWins += 1;
      }

      const assetBucket = perAsset.get(entry.assetClass) ?? { returnPct: 0, trades: 0, wins: 0, vetoes: 0 };
      assetBucket.returnPct += directedReturn;
      assetBucket.trades += 1;
      if (directedReturn > 0) {
        assetBucket.wins += 1;
      }
      perAsset.set(entry.assetClass, assetBucket);
    }

    if (realizedWeekSet.has(weekOpenUtc)) {
      totalReturnPct += weekReturn;
      totalTrades += weekTrades;
      totalWins += weekWins;
      totalVetoes += weekVetoes;
      cumulative += weekReturn;
      peak = Math.max(peak, cumulative);
      maxDrawdown = Math.min(maxDrawdown, cumulative - peak);
    }

    for (const entry of auditWeek.entries) {
      if (entry.strengthBranch === "strength_veto_blocked") {
        const assetBucket = perAsset.get(entry.assetClass) ?? { returnPct: 0, trades: 0, wins: 0, vetoes: 0 };
        assetBucket.vetoes += 1;
        perAsset.set(entry.assetClass, assetBucket);
      }
    }

    weeklyRows.push({
      weekOpenUtc,
      returnPct: weekReturn,
      trades: weekTrades,
      vetoes: weekVetoes,
      changed: weekChanged,
    });

    if (weekOpenUtc === weeks[weeks.length - 1]) {
      currentWeekFocus.push(
        ...auditWeek.entries.filter((entry) => entry.pair === "BTCUSD" || entry.pair === "ETHUSD"),
      );
    }
  }

  console.log("=== Selector Strength Veto Verification ===\n");
  console.log(`Baseline selector: ${formatSigned(baseline.totalReturnPct)} | DD ${formatSigned(baseline.maxDrawdownPct)} | trades ${baseline.totalTrades}`);
  console.log(`Strength veto:     ${formatSigned(totalReturnPct)} | DD ${formatSigned(maxDrawdown)} | trades ${totalTrades}`);
  console.log(`Total vetoed pair-weeks: ${totalVetoes}\n`);

  console.log("Branch counts:");
  for (const key of ["strength_veto_passed", "strength_veto_neutral", "strength_veto_blocked"] as const) {
    console.log(`  ${key}: ${branchCounts.get(key) ?? 0}`);
  }

  console.log("\nPer-asset-class:");
  for (const assetClass of ["fx", "crypto", "indices", "commodities"]) {
    const row = perAsset.get(assetClass) ?? { returnPct: 0, trades: 0, wins: 0, vetoes: 0 };
    console.log(
      `  ${assetClass}: return ${formatSigned(row.returnPct)} | trades ${row.trades} | wins ${row.wins} | vetoes ${row.vetoes}`,
    );
  }

  console.log("\nPer-week summary:");
  for (const row of weeklyRows) {
    console.log(
      `  ${row.weekOpenUtc.slice(0, 10)}: return=${formatSigned(row.returnPct)} trades=${row.trades} vetoes=${row.vetoes} changed=${row.changed}`,
    );
  }

  console.log("\nCurrent week BTC/ETH:");
  for (const entry of currentWeekFocus.sort((left, right) => left.pair.localeCompare(right.pair))) {
    console.log(
      `  ${entry.pair}: base=${entry.baseDirection} final=${entry.finalDirection} strengthScore=${entry.strengthCompositeScore} relation=${entry.strengthRelationToProposed} baseBranch=${entry.baseSelectorBranch} strengthBranch=${entry.strengthBranch}`,
    );
  }
}

main().catch((error) => {
  console.error("Strength veto verification failed:", error);
  process.exit(1);
});
