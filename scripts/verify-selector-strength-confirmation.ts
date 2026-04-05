/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: verify-selector-strength-confirmation.ts
 *
 * Description:
 * Verifies Variant A of the strength selector experiment:
 * canonical strength is attached to selector audit output while final
 * directions remain unchanged from the base selector policy.
 *
 * Usage:
 *   npx tsx scripts/verify-selector-strength-confirmation.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";

import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import {
  resolveSelectorAudit,
  type SelectorAuditEntry,
  type SelectorStrengthBranch,
  type SelectorStrengthRelation,
} from "../src/lib/performance/selectorEngine";
import { computeMultiWeekHold } from "../src/lib/performance/weeklyHoldEngine";
import { getStrategy } from "../src/lib/performance/strategyConfig";

loadEnvConfig(process.cwd());

function increment<K extends string>(map: Map<K, number>, key: K) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

async function main() {
  const weeks = (await listDataSectionWeeks()).sort((left, right) => left.localeCompare(right));
  const strategy = getStrategy("selector_sentiment_override");
  if (!strategy) {
    throw new Error("selector_sentiment_override not found in strategy config.");
  }

  const [auditWeeks, performance] = await Promise.all([
    Promise.all(weeks.map((weekOpenUtc) => resolveSelectorAudit(weekOpenUtc))),
    computeMultiWeekHold(strategy, weeks),
  ]);

  const relationCounts = new Map<SelectorStrengthRelation, number>();
  const branchCounts = new Map<SelectorStrengthBranch, number>();
  const weeklyChangedCounts: Array<{ weekOpenUtc: string; changed: number; confirmed: number; neutral: number; disagreed: number }> = [];
  const currentWeekFocus: SelectorAuditEntry[] = [];

  for (const auditWeek of auditWeeks) {
    let changed = 0;
    let confirmed = 0;
    let neutral = 0;
    let disagreed = 0;

    for (const entry of auditWeek.entries) {
      increment(relationCounts, entry.strengthRelationToProposed);
      increment(branchCounts, entry.strengthBranch);

      if (entry.baseDirection !== entry.finalDirection) {
        changed += 1;
      }

      if (entry.strengthBranch === "strength_confirmed") confirmed += 1;
      else if (entry.strengthBranch === "strength_neutral") neutral += 1;
      else disagreed += 1;
    }

    weeklyChangedCounts.push({
      weekOpenUtc: auditWeek.weekOpenUtc,
      changed,
      confirmed,
      neutral,
      disagreed,
    });

    if (auditWeek.weekOpenUtc === weeks[weeks.length - 1]) {
      currentWeekFocus.push(
        ...auditWeek.entries.filter((entry) => entry.pair === "BTCUSD" || entry.pair === "ETHUSD"),
      );
    }
  }

  const totalChanged = weeklyChangedCounts.reduce((sum, row) => sum + row.changed, 0);

  console.log("=== Selector Strength Confirmation Verification ===\n");
  console.log(`Weeks analyzed: ${weeks.length}`);
  console.log(`Selector weekly-hold result: ${performance.totalReturnPct >= 0 ? "+" : ""}${performance.totalReturnPct.toFixed(2)}%, DD ${performance.maxDrawdownPct.toFixed(2)}%`);
  console.log(`Changed pair-weeks vs base selector: ${totalChanged}\n`);

  console.log("Strength relation counts:");
  for (const key of ["strong_agree", "agree", "neutral", "disagree", "strong_disagree"] as const) {
    console.log(`  ${key}: ${relationCounts.get(key) ?? 0}`);
  }

  console.log("\nStrength branch counts:");
  for (const key of ["strength_confirmed", "strength_neutral", "strength_disagreed_but_not_blocking"] as const) {
    console.log(`  ${key}: ${branchCounts.get(key) ?? 0}`);
  }

  console.log("\nPer-week summary:");
  for (const row of weeklyChangedCounts) {
    console.log(
      `  ${row.weekOpenUtc.slice(0, 10)}: changed=${row.changed} confirmed=${row.confirmed} neutral=${row.neutral} disagreed=${row.disagreed}`,
    );
  }

  console.log("\nCurrent week BTC/ETH:");
  for (const entry of currentWeekFocus.sort((left, right) => left.pair.localeCompare(right.pair))) {
    console.log(
      `  ${entry.pair}: base=${entry.baseDirection} final=${entry.finalDirection} strengthScore=${entry.strengthCompositeScore} strengthDir=${entry.strengthCompositeDirection} relation=${entry.strengthRelationToProposed} baseBranch=${entry.baseSelectorBranch} strengthBranch=${entry.strengthBranch}`,
    );
  }
}

main().catch((error) => {
  console.error("Strength confirmation verification failed:", error);
  process.exit(1);
});
