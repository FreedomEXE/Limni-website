/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: verify-selector-commercial-strength-disagree-skip.ts
 *
 * Description:
 * Verifies the narrow commercial overlay that only skips a pair when
 * commercial is in caution mode and strength strongly disagrees with
 * the Variant C final direction.
 *
 * Usage:
 *   npx tsx scripts/verify-selector-commercial-strength-disagree-skip.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";

import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import {
  resolveSelectorCommercialStrengthDisagreeSkip,
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
  const blockedBucket: Bucket = { returnPct: 0, trades: 0, wins: 0, losses: 0 };
  const unblockedBucket: Bucket = { returnPct: 0, trades: 0, wins: 0, losses: 0 };
  const blockedByAsset = new Map<string, Bucket>();
  const changedByAsset = new Map<string, number>();
  const weeklyRows: Array<{
    weekOpenUtc: string;
    baselineReturnPct: number;
    overlayReturnPct: number;
    blocked: number;
  }> = [];
  const currentWeekFocus: SelectorAuditEntry[] = [];

  let baselineTotalReturn = 0;
  let overlayTotalReturn = 0;
  let baselineCum = 0;
  let overlayCum = 0;
  let baselinePeak = 0;
  let overlayPeak = 0;
  let baselineDd = 0;
  let overlayDd = 0;
  let totalBlocked = 0;

  for (const weekOpenUtc of weeks) {
    const [overlayAudit, baselineAudit, pairReturns] = await Promise.all([
      resolveSelectorCommercialStrengthDisagreeSkip(weekOpenUtc),
      resolveSelectorStrengthTiebreakAudit(weekOpenUtc),
      getWeeklyPairReturns(weekOpenUtc),
    ]);

    const pairReturnBySymbol = new Map(
      pairReturns.map((row) => [row.symbol.toUpperCase(), row]),
    );

    let weekBaselineReturn = 0;
    let weekOverlayReturn = 0;
    let weekBlocked = 0;

    for (let i = 0; i < overlayAudit.entries.length; i += 1) {
      const overlayEntry = overlayAudit.entries[i]!;
      const baselineEntry = baselineAudit.entries[i]!;
      const pairReturn = pairReturnBySymbol.get(overlayEntry.pair.toUpperCase());
      if (!pairReturn) continue;

      const baselineDirectedReturn = baselineEntry.finalDirection === "SHORT"
        ? -pairReturn.returnPct
        : pairReturn.returnPct;
      weekBaselineReturn += baselineDirectedReturn;

      increment(branchCounts, overlayEntry.commercialBranch);

      const blocked = overlayEntry.finalDirection === "NEUTRAL";
      if (blocked) {
        addToBucket(blockedBucket, baselineDirectedReturn);
        const assetBucket = blockedByAsset.get(overlayEntry.assetClass) ?? { returnPct: 0, trades: 0, wins: 0, losses: 0 };
        addToBucket(assetBucket, baselineDirectedReturn);
        blockedByAsset.set(overlayEntry.assetClass, assetBucket);
        changedByAsset.set(overlayEntry.assetClass, (changedByAsset.get(overlayEntry.assetClass) ?? 0) + 1);
        weekBlocked += 1;
        totalBlocked += 1;
      } else {
        addToBucket(unblockedBucket, baselineDirectedReturn);
        const overlayDirectedReturn = overlayEntry.finalDirection === "SHORT"
          ? -pairReturn.returnPct
          : pairReturn.returnPct;
        weekOverlayReturn += overlayDirectedReturn;
      }
    }

    baselineTotalReturn += weekBaselineReturn;
    overlayTotalReturn += weekOverlayReturn;
    baselineCum += weekBaselineReturn;
    overlayCum += weekOverlayReturn;
    baselinePeak = Math.max(baselinePeak, baselineCum);
    overlayPeak = Math.max(overlayPeak, overlayCum);
    baselineDd = Math.min(baselineDd, baselineCum - baselinePeak);
    overlayDd = Math.min(overlayDd, overlayCum - overlayPeak);

    weeklyRows.push({
      weekOpenUtc,
      baselineReturnPct: weekBaselineReturn,
      overlayReturnPct: weekOverlayReturn,
      blocked: weekBlocked,
    });

    if (weekOpenUtc === weeks[weeks.length - 1]) {
      currentWeekFocus.push(
        ...overlayAudit.entries.filter((entry) => entry.pair === "BTCUSD" || entry.pair === "ETHUSD"),
      );
    }
  }

  console.log("=== Selector Commercial + Strength Narrow Skip Verification ===\n");
  console.log(`Tie-break baseline:        ${formatSigned(baselineTotalReturn)} | DD ${formatSigned(baselineDd)}`);
  console.log(`Narrow commercial skip:    ${formatSigned(overlayTotalReturn)} | DD ${formatSigned(overlayDd)}`);
  console.log(`Total blocked pair-weeks: ${totalBlocked}\n`);

  console.log("Commercial branch counts:");
  for (const key of ["commercial_no_caution", "commercial_strength_disagree_skip"] as const) {
    console.log(`  ${key}: ${branchCounts.get(key) ?? 0}`);
  }

  console.log("\nBlocked vs unblocked baseline pair returns:");
  console.log(
    `  blocked: return ${formatSigned(blockedBucket.returnPct)} | trades ${blockedBucket.trades} | wins ${blockedBucket.wins} | losses ${blockedBucket.losses}`,
  );
  console.log(
    `  unblocked: return ${formatSigned(unblockedBucket.returnPct)} | trades ${unblockedBucket.trades} | wins ${unblockedBucket.wins} | losses ${unblockedBucket.losses}`,
  );

  console.log("\nBlocked by asset:");
  for (const assetClass of ["fx", "crypto", "indices", "commodities"]) {
    const blocked = blockedByAsset.get(assetClass) ?? { returnPct: 0, trades: 0, wins: 0, losses: 0 };
    console.log(
      `  ${assetClass}: blocked ${blocked.trades} | return ${formatSigned(blocked.returnPct)} | wins ${blocked.wins} | losses ${blocked.losses} | changed ${changedByAsset.get(assetClass) ?? 0}`,
    );
  }

  console.log("\nPer-week summary:");
  for (const row of weeklyRows) {
    console.log(
      `  ${row.weekOpenUtc.slice(0, 10)}: baseline=${formatSigned(row.baselineReturnPct)} overlay=${formatSigned(row.overlayReturnPct)} blocked=${row.blocked}`,
    );
  }

  console.log("\nCurrent week BTC/ETH:");
  for (const entry of currentWeekFocus.sort((left, right) => left.pair.localeCompare(right.pair))) {
    console.log(
      `  ${entry.pair}: final=${entry.finalDirection} strengthRelation=${entry.strengthRelationToProposed} commercialExtremity=${entry.commercialExtremity.toFixed(2)} commercialCaution=${String(entry.commercialCaution)} commercialBranch=${entry.commercialBranch}`,
    );
  }
}

main().catch((error) => {
  console.error("Commercial + strength narrow skip verification failed:", error);
  process.exit(1);
});
