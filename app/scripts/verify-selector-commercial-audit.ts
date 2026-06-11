/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: verify-selector-commercial-audit.ts
 *
 * Description:
 * Verifies the commercial audit-only overlay on top of the strength
 * tie-break selector. No direction changes are allowed in this pass.
 *
 * Usage:
 *   npx tsx scripts/verify-selector-commercial-audit.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";

import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import {
  resolveSelectorCommercialAuditOnly,
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

async function main() {
  const weeks = (await listDataSectionWeeks()).sort((left, right) => left.localeCompare(right));

  const overallCommercialBranches = new Map<SelectorCommercialBranch, number>();
  const commercialBranchesByAsset = new Map<string, Map<SelectorCommercialBranch, number>>();
  const cautionByAsset = new Map<string, { cautions: number; total: number }>();
  const weeklyRows: Array<{
    weekOpenUtc: string;
    changed: number;
    cautions: number;
  }> = [];
  const currentWeekFocus: SelectorAuditEntry[] = [];

  let totalChanged = 0;

  for (const weekOpenUtc of weeks) {
    const [commercialAudit, tiebreakAudit] = await Promise.all([
      resolveSelectorCommercialAuditOnly(weekOpenUtc),
      resolveSelectorStrengthTiebreakAudit(weekOpenUtc),
    ]);

    let weekChanged = 0;
    let weekCautions = 0;

    for (let i = 0; i < commercialAudit.entries.length; i += 1) {
      const commercialEntry = commercialAudit.entries[i]!;
      const tiebreakEntry = tiebreakAudit.entries[i]!;

      if (commercialEntry.finalDirection !== tiebreakEntry.finalDirection) {
        weekChanged += 1;
        totalChanged += 1;
      }

      increment(overallCommercialBranches, commercialEntry.commercialBranch);
      const byAsset = commercialBranchesByAsset.get(commercialEntry.assetClass) ?? new Map<SelectorCommercialBranch, number>();
      increment(byAsset, commercialEntry.commercialBranch);
      commercialBranchesByAsset.set(commercialEntry.assetClass, byAsset);

      const cautionBucket = cautionByAsset.get(commercialEntry.assetClass) ?? { cautions: 0, total: 0 };
      cautionBucket.total += 1;
      if (commercialEntry.commercialCaution) {
        cautionBucket.cautions += 1;
        weekCautions += 1;
      }
      cautionByAsset.set(commercialEntry.assetClass, cautionBucket);
    }

    weeklyRows.push({
      weekOpenUtc,
      changed: weekChanged,
      cautions: weekCautions,
    });

    if (weekOpenUtc === weeks[weeks.length - 1]) {
      currentWeekFocus.push(
        ...commercialAudit.entries.filter((entry) => entry.pair === "BTCUSD" || entry.pair === "ETHUSD"),
      );
    }
  }

  console.log("=== Selector Commercial Audit Verification ===\n");
  console.log(`Weeks analyzed: ${weeks.length}`);
  console.log(`Changed pair-weeks vs strength tie-break baseline: ${totalChanged}\n`);

  console.log("Overall commercial branch counts:");
  for (const key of ["commercial_no_caution", "commercial_caution_flag"] as const) {
    console.log(`  ${key}: ${overallCommercialBranches.get(key) ?? 0}`);
  }

  console.log("\nCommercial caution by asset:");
  for (const assetClass of ["fx", "crypto", "indices", "commodities"]) {
    const row = cautionByAsset.get(assetClass) ?? { cautions: 0, total: 0 };
    const pct = row.total > 0 ? (row.cautions / row.total) * 100 : 0;
    console.log(
      `  ${assetClass}: cautions ${row.cautions}/${row.total} (${pct.toFixed(1)}%)`,
    );
  }

  console.log("\nCommercial branch counts by asset:");
  for (const assetClass of ["fx", "crypto", "indices", "commodities"]) {
    const byAsset = commercialBranchesByAsset.get(assetClass) ?? new Map<SelectorCommercialBranch, number>();
    console.log(
      `  ${assetClass}: no_caution=${byAsset.get("commercial_no_caution") ?? 0} caution=${byAsset.get("commercial_caution_flag") ?? 0}`,
    );
  }

  console.log("\nPer-week summary:");
  for (const row of weeklyRows) {
    console.log(
      `  ${row.weekOpenUtc.slice(0, 10)}: changed=${row.changed} cautions=${row.cautions}`,
    );
  }

  console.log("\nCurrent week BTC/ETH:");
  for (const entry of currentWeekFocus.sort((left, right) => left.pair.localeCompare(right.pair))) {
    console.log(
      `  ${entry.pair}: final=${entry.finalDirection} commercialScore=${formatSigned(entry.commercialScore)} commercialExtremity=${entry.commercialExtremity.toFixed(2)} commercialCaution=${String(entry.commercialCaution)} commercialBranch=${entry.commercialBranch} strengthBranch=${entry.strengthBranch}`,
    );
  }
}

main().catch((error) => {
  console.error("Commercial audit verification failed:", error);
  process.exit(1);
});
