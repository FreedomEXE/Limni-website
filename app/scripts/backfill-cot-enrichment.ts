/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backfill-cot-enrichment.ts
 *
 * Description:
 * Re-fetches all stored COT snapshots with the enriched field select list
 * and overwrites them in-place so historical JSONB snapshots carry delta,
 * OI, and concentration metadata.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { ASSET_CLASS_ORDER } from "../src/lib/cotMarkets";
import {
  listSnapshotDates,
  readSnapshot,
  refreshSnapshotForClass,
} from "../src/lib/cotStore";

const BACKFILL_DELAY_MS = Number(process.env.COT_BACKFILL_DELAY_MS ?? "200");

function sleep(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   COT Enrichment Backfill                                       ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  for (const assetClass of ASSET_CLASS_ORDER) {
    const dates = await listSnapshotDates(assetClass);
    console.log(`\n[${assetClass}] ${dates.length} snapshot dates`);

    for (let index = 0; index < dates.length; index++) {
      const date = dates[index]!;
      console.log(`[${assetClass}] ${index + 1}/${dates.length} ${date}`);
      await refreshSnapshotForClass(assetClass, date);
      await sleep(BACKFILL_DELAY_MS);
    }
  }

  console.log("\nVerification snapshot summary:");
  await printLatestFxSummary();
  console.log("\nDone.");
}

async function printLatestFxSummary() {
  const snapshot = await readSnapshot({ assetClass: "fx" });
  if (!snapshot) {
    console.log("No FX snapshot found.");
    return;
  }

  console.log(`Latest FX report date: ${snapshot.report_date}`);
  console.log(
    "  " +
      "CCY".padEnd(6) +
      "DNet".padStart(12) +
      "DΔNet".padStart(12) +
      "OI".padStart(12) +
      "OIΔ".padStart(12) +
      "D%OI".padStart(12) +
      "C4L".padStart(10) +
      "C4S".padStart(10),
  );
  console.log(`  ${"─".repeat(84)}`);

  for (const currency of Object.keys(snapshot.currencies).sort()) {
    const market = snapshot.currencies[currency]!;
    console.log(
      "  " +
        currency.padEnd(6) +
        String(market.dealer_net ?? "").padStart(12) +
        String(market.dealer_delta_net ?? "").padStart(12) +
        String(market.open_interest ?? "").padStart(12) +
        String(market.oi_delta ?? "").padStart(12) +
        (typeof market.dealer_pct_of_oi === "number"
          ? market.dealer_pct_of_oi.toFixed(4)
          : "").padStart(12) +
        String(market.conc_gross_4_long ?? "").padStart(10) +
        String(market.conc_gross_4_short ?? "").padStart(10),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
