/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: verify-selector-strength-tiebreak.ts
 *
 * Description:
 * Verifies Variant C of the strength selector experiment:
 * when sentiment and dealer disagree, strength can choose between them.
 *
 * Usage:
 *   npx tsx scripts/verify-selector-strength-tiebreak.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";

import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import {
  resolveSelectorStrengthTiebreakAudit,
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

type AssetStats = {
  returnPct: number;
  trades: number;
  wins: number;
  changed: number;
};

async function main() {
  const weeks = (await listDataSectionWeeks()).sort((left, right) => left.localeCompare(right));
  const strategy = getStrategy("selector_sentiment_override");
  if (!strategy) {
    throw new Error("selector_sentiment_override not found in strategy config.");
  }

  const baseline = await computeMultiWeekHold(strategy, weeks);
  const realizedWeekSet = new Set(baseline.weeks.map((week) => week.weekOpenUtc));

  const branchCounts = new Map<SelectorStrengthBranch, number>();
  const branchCountsByAsset = new Map<string, Map<SelectorStrengthBranch, number>>();
  const perAsset = new Map<string, AssetStats>();
  const weeklyRows: Array<{
    weekOpenUtc: string;
    returnPct: number;
    changed: number;
    tiebreakSentiment: number;
    tiebreakDealer: number;
  }> = [];
  const currentWeekFocus: SelectorAuditEntry[] = [];

  let totalReturnPct = 0;
  let totalTrades = 0;
  let totalWins = 0;
  let totalChanged = 0;
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const weekOpenUtc of weeks) {
    const [auditWeek, pairReturns] = await Promise.all([
      resolveSelectorStrengthTiebreakAudit(weekOpenUtc),
      getWeeklyPairReturns(weekOpenUtc),
    ]);

    const pairReturnBySymbol = new Map(
      pairReturns.map((row) => [row.symbol.toUpperCase(), row]),
    );

    let weekReturn = 0;
    let weekChanged = 0;
    let tiebreakSentiment = 0;
    let tiebreakDealer = 0;

    for (const entry of auditWeek.entries) {
      increment(branchCounts, entry.strengthBranch);
      const byAsset = branchCountsByAsset.get(entry.assetClass) ?? new Map<SelectorStrengthBranch, number>();
      increment(byAsset, entry.strengthBranch);
      branchCountsByAsset.set(entry.assetClass, byAsset);

      const assetBucket = perAsset.get(entry.assetClass) ?? { returnPct: 0, trades: 0, wins: 0, changed: 0 };

      if (entry.baseDirection !== entry.finalDirection) {
        weekChanged += 1;
        totalChanged += 1;
        assetBucket.changed += 1;
      }

      if (entry.strengthBranch === "strength_tiebreak_sentiment") {
        tiebreakSentiment += 1;
      } else if (entry.strengthBranch === "strength_tiebreak_dealer") {
        tiebreakDealer += 1;
      }

      if (realizedWeekSet.has(weekOpenUtc)) {
        const pairReturn = pairReturnBySymbol.get(entry.pair.toUpperCase());
        if (pairReturn) {
          const directedReturn = entry.finalDirection === "SHORT" ? -pairReturn.returnPct : pairReturn.returnPct;
          weekReturn += directedReturn;
          totalTrades += 1;
          assetBucket.trades += 1;
          assetBucket.returnPct += directedReturn;
          if (directedReturn > 0) {
            totalWins += 1;
            assetBucket.wins += 1;
          }
        }
      }

      perAsset.set(entry.assetClass, assetBucket);
    }

    if (realizedWeekSet.has(weekOpenUtc)) {
      totalReturnPct += weekReturn;
      cumulative += weekReturn;
      peak = Math.max(peak, cumulative);
      maxDrawdown = Math.min(maxDrawdown, cumulative - peak);
    }

    weeklyRows.push({
      weekOpenUtc,
      returnPct: weekReturn,
      changed: weekChanged,
      tiebreakSentiment,
      tiebreakDealer,
    });

    if (weekOpenUtc === weeks[weeks.length - 1]) {
      currentWeekFocus.push(
        ...auditWeek.entries.filter((entry) => entry.pair === "BTCUSD" || entry.pair === "ETHUSD"),
      );
    }
  }

  console.log("=== Selector Strength Tie-Break Verification ===\n");
  console.log(`Baseline selector:   ${formatSigned(baseline.totalReturnPct)} | DD ${formatSigned(baseline.maxDrawdownPct)} | trades ${baseline.totalTrades}`);
  console.log(`Strength tie-break:  ${formatSigned(totalReturnPct)} | DD ${formatSigned(maxDrawdown)} | trades ${totalTrades}`);
  console.log(`Changed pair-weeks: ${totalChanged}\n`);

  console.log("Overall branch counts:");
  for (const key of [
    "strength_tiebreak_sentiment",
    "strength_tiebreak_dealer",
    "strength_tiebreak_neutral_fallback",
    "strength_tiebreak_ambiguous_fallback",
    "strength_tiebreak_no_conflict_fallback",
  ] as const) {
    console.log(`  ${key}: ${branchCounts.get(key) ?? 0}`);
  }

  console.log("\nPer-asset-class:");
  for (const assetClass of ["fx", "crypto", "indices", "commodities"]) {
    const row = perAsset.get(assetClass) ?? { returnPct: 0, trades: 0, wins: 0, changed: 0 };
    const baselineRow = baseline.byAssetClass[assetClass] ?? { returnPct: 0, trades: 0, wins: 0 };
    console.log(
      `  ${assetClass}: baseline ${formatSigned(baselineRow.returnPct)} | tie-break ${formatSigned(row.returnPct)} | delta ${formatSigned(row.returnPct - baselineRow.returnPct)} | changed ${row.changed}`,
    );
  }

  console.log("\nTie-break branch counts by asset:");
  for (const assetClass of ["fx", "crypto", "indices", "commodities"]) {
    const byAsset = branchCountsByAsset.get(assetClass) ?? new Map<SelectorStrengthBranch, number>();
    console.log(
      `  ${assetClass}: sentiment=${byAsset.get("strength_tiebreak_sentiment") ?? 0} dealer=${byAsset.get("strength_tiebreak_dealer") ?? 0} neutral_fallback=${byAsset.get("strength_tiebreak_neutral_fallback") ?? 0} ambiguous_fallback=${byAsset.get("strength_tiebreak_ambiguous_fallback") ?? 0} no_conflict=${byAsset.get("strength_tiebreak_no_conflict_fallback") ?? 0}`,
    );
  }

  console.log("\nPer-week summary:");
  for (const row of weeklyRows) {
    console.log(
      `  ${row.weekOpenUtc.slice(0, 10)}: return=${formatSigned(row.returnPct)} changed=${row.changed} tiebreak_sentiment=${row.tiebreakSentiment} tiebreak_dealer=${row.tiebreakDealer}`,
    );
  }

  console.log("\nCurrent week BTC/ETH:");
  for (const entry of currentWeekFocus.sort((left, right) => left.pair.localeCompare(right.pair))) {
    console.log(
      `  ${entry.pair}: base=${entry.baseDirection} final=${entry.finalDirection} sentimentDir=${entry.sentimentDirection} dealerDir=${entry.dealerDirection} strengthDir=${entry.strengthCompositeDirection} branch=${entry.strengthBranch}`,
    );
  }
}

main().catch((error) => {
  console.error("Strength tie-break verification failed:", error);
  process.exit(1);
});
