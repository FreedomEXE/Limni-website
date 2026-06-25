/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: verify-selector-commercial-caution-skip.ts
 *
 * Description:
 * Verifies the commercial caution skip overlay on top of the strength
 * tie-break selector, and audits whether commercial caution flags are
 * associated with losing or winning pair-weeks.
 *
 * Usage:
 *   npx tsx scripts/verify-selector-commercial-caution-skip.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";

import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import {
  resolveSelectorCommercialCautionSkip,
  resolveSelectorStrengthTiebreakAudit,
  type SelectorAuditEntry,
  type SelectorCommercialBranch,
} from "../src/lib/performance/selectorEngine";

loadEnvConfig(process.cwd());

function increment<K extends string>(map: Map<K, number>, key: K) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function formatSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

type Bucket = {
  returnPct: number;
  trades: number;
  wins: number;
  losses: number;
};

function addToBucket(bucket: Bucket, directedReturn: number) {
  bucket.returnPct += directedReturn;
  bucket.trades += 1;
  if (directedReturn > 0) bucket.wins += 1;
  if (directedReturn < 0) bucket.losses += 1;
}

async function main() {
  const weeks = (await listDataSectionWeeks()).sort((left, right) => left.localeCompare(right));

  const branchCounts = new Map<SelectorCommercialBranch, number>();
  const flaggedBucket: Bucket = { returnPct: 0, trades: 0, wins: 0, losses: 0 };
  const unflaggedBucket: Bucket = { returnPct: 0, trades: 0, wins: 0, losses: 0 };
  const flaggedByAsset = new Map<string, Bucket>();
  const unflaggedByAsset = new Map<string, Bucket>();
  const skippedByAsset = new Map<string, number>();
  const weeklyRows: Array<{
    weekOpenUtc: string;
    baselineReturnPct: number;
    skipReturnPct: number;
    skipped: number;
  }> = [];
  const currentWeekFocus: SelectorAuditEntry[] = [];

  let baselineTotalReturn = 0;
  let skipTotalReturn = 0;
  let baselineCum = 0;
  let skipCum = 0;
  let baselinePeak = 0;
  let skipPeak = 0;
  let baselineDd = 0;
  let skipDd = 0;
  let totalSkipped = 0;

  for (const weekOpenUtc of weeks) {
    const [skipAudit, baselineAudit, pairReturns] = await Promise.all([
      resolveSelectorCommercialCautionSkip(weekOpenUtc),
      resolveSelectorStrengthTiebreakAudit(weekOpenUtc),
      getWeeklyPairReturns(weekOpenUtc),
    ]);

    const pairReturnBySymbol = new Map(
      pairReturns.map((row) => [row.symbol.toUpperCase(), row]),
    );

    let weekBaselineReturn = 0;
    let weekSkipReturn = 0;
    let weekSkipped = 0;

    for (let i = 0; i < skipAudit.entries.length; i += 1) {
      const skipEntry = skipAudit.entries[i]!;
      const baselineEntry = baselineAudit.entries[i]!;
      const pairReturn = pairReturnBySymbol.get(skipEntry.pair.toUpperCase());
      if (!pairReturn) continue;

      const baselineDirectedReturn = baselineEntry.finalDirection === "SHORT"
        ? -pairReturn.returnPct
        : pairReturn.returnPct;
      weekBaselineReturn += baselineDirectedReturn;

      increment(branchCounts, skipEntry.commercialBranch);

      const isFlagged = skipEntry.commercialCaution;
      if (isFlagged) {
        addToBucket(flaggedBucket, baselineDirectedReturn);
        const assetBucket = flaggedByAsset.get(skipEntry.assetClass) ?? { returnPct: 0, trades: 0, wins: 0, losses: 0 };
        addToBucket(assetBucket, baselineDirectedReturn);
        flaggedByAsset.set(skipEntry.assetClass, assetBucket);
      } else {
        addToBucket(unflaggedBucket, baselineDirectedReturn);
        const assetBucket = unflaggedByAsset.get(skipEntry.assetClass) ?? { returnPct: 0, trades: 0, wins: 0, losses: 0 };
        addToBucket(assetBucket, baselineDirectedReturn);
        unflaggedByAsset.set(skipEntry.assetClass, assetBucket);
      }

      if (skipEntry.finalDirection === "NEUTRAL") {
        weekSkipped += 1;
        totalSkipped += 1;
        skippedByAsset.set(skipEntry.assetClass, (skippedByAsset.get(skipEntry.assetClass) ?? 0) + 1);
      } else {
        const skipDirectedReturn = skipEntry.finalDirection === "SHORT"
          ? -pairReturn.returnPct
          : pairReturn.returnPct;
        weekSkipReturn += skipDirectedReturn;
      }
    }

    baselineTotalReturn += weekBaselineReturn;
    skipTotalReturn += weekSkipReturn;
    baselineCum += weekBaselineReturn;
    skipCum += weekSkipReturn;
    baselinePeak = Math.max(baselinePeak, baselineCum);
    skipPeak = Math.max(skipPeak, skipCum);
    baselineDd = Math.min(baselineDd, baselineCum - baselinePeak);
    skipDd = Math.min(skipDd, skipCum - skipPeak);

    weeklyRows.push({
      weekOpenUtc,
      baselineReturnPct: weekBaselineReturn,
      skipReturnPct: weekSkipReturn,
      skipped: weekSkipped,
    });

    if (weekOpenUtc === weeks[weeks.length - 1]) {
      currentWeekFocus.push(
        ...skipAudit.entries.filter((entry) => entry.pair === "BTCUSD" || entry.pair === "ETHUSD"),
      );
    }
  }

  console.log("=== Selector Commercial Caution Skip Verification ===\n");
  console.log(`Tie-break baseline: ${formatSigned(baselineTotalReturn)} | DD ${formatSigned(baselineDd)}`);
  console.log(`Commercial skip:    ${formatSigned(skipTotalReturn)} | DD ${formatSigned(skipDd)}`);
  console.log(`Total skipped pair-weeks: ${totalSkipped}\n`);

  console.log("Commercial skip branches:");
  for (const key of ["commercial_no_caution", "commercial_caution_skip"] as const) {
    console.log(`  ${key}: ${branchCounts.get(key) ?? 0}`);
  }

  console.log("\nFlagged vs non-flagged baseline pair returns:");
  console.log(
    `  flagged: return ${formatSigned(flaggedBucket.returnPct)} | trades ${flaggedBucket.trades} | wins ${flaggedBucket.wins} | losses ${flaggedBucket.losses}`,
  );
  console.log(
    `  unflagged: return ${formatSigned(unflaggedBucket.returnPct)} | trades ${unflaggedBucket.trades} | wins ${unflaggedBucket.wins} | losses ${unflaggedBucket.losses}`,
  );

  console.log("\nFlagged vs non-flagged by asset:");
  for (const assetClass of ["fx", "crypto", "indices", "commodities"]) {
    const flagged = flaggedByAsset.get(assetClass) ?? { returnPct: 0, trades: 0, wins: 0, losses: 0 };
    const unflagged = unflaggedByAsset.get(assetClass) ?? { returnPct: 0, trades: 0, wins: 0, losses: 0 };
    console.log(
      `  ${assetClass}: flagged ${formatSigned(flagged.returnPct)} on ${flagged.trades} trades | unflagged ${formatSigned(unflagged.returnPct)} on ${unflagged.trades} trades | skipped ${skippedByAsset.get(assetClass) ?? 0}`,
    );
  }

  console.log("\nPer-week summary:");
  for (const row of weeklyRows) {
    console.log(
      `  ${row.weekOpenUtc.slice(0, 10)}: baseline=${formatSigned(row.baselineReturnPct)} skip=${formatSigned(row.skipReturnPct)} skipped=${row.skipped}`,
    );
  }

  console.log("\nCurrent week BTC/ETH:");
  for (const entry of currentWeekFocus.sort((left, right) => left.pair.localeCompare(right.pair))) {
    console.log(
      `  ${entry.pair}: final=${entry.finalDirection} commercialScore=${formatSigned(entry.commercialScore)} commercialExtremity=${entry.commercialExtremity.toFixed(2)} commercialCaution=${String(entry.commercialCaution)} commercialBranch=${entry.commercialBranch}`,
    );
  }
}

main().catch((error) => {
  console.error("Commercial caution skip verification failed:", error);
  process.exit(1);
});
