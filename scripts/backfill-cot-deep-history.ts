/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backfill-cot-deep-history.ts
 *
 * Description:
 * Expands stored COT snapshot history using all available TFF report dates,
 * capped to the most recent 260 dates when the API universe is very large.
 * Existing dates are re-fetched so new legacy non-commercial fields are
 * populated in historical JSONB snapshots.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { ASSET_CLASS_ORDER } from "../src/lib/cotMarkets";
import { fetchAvailableReportDates } from "../src/lib/cotFetch";
import {
  listSnapshotDates,
  readSnapshot,
  refreshSnapshotForClass,
} from "../src/lib/cotStore";

const HARD_CAP = Number(process.env.COT_DEEP_HISTORY_CAP ?? "260");
const API_DISCOVERY_LIMIT = Number(process.env.COT_API_DATE_LIMIT ?? "5000");
const REFRESH_DELAY_MS = Number(process.env.COT_BACKFILL_DELAY_MS ?? "350");
const RETRY_COUNT = Number(process.env.COT_BACKFILL_RETRIES ?? "3");

function sleep(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatRange(dates: string[]) {
  if (dates.length === 0) {
    return "none";
  }
  return `${dates[0]} → ${dates[dates.length - 1]}`;
}

async function printFxVerification(dates: string[]) {
  if (dates.length === 0) {
    console.log("No FX snapshots available for verification.");
    return;
  }

  const earliestDate = dates[0]!;
  const latestDate = dates[dates.length - 1]!;
  const earliest = await readSnapshot({ assetClass: "fx", reportDate: earliestDate });
  const latest = await readSnapshot({ assetClass: "fx", reportDate: latestDate });

  console.log(`\nFX verification:`);
  console.log(`  Earliest stored: ${earliestDate}${earliest ? "" : " (missing snapshot)"}`);
  console.log(`  Latest stored:   ${latestDate}${latest ? "" : " (missing snapshot)"}`);

  if (!latest) {
    return;
  }

  console.log("\nLatest FX enrichment snapshot:");
  console.log(
    "  " +
      "CCY".padEnd(6) +
      "DNet".padStart(10) +
      "Comm".padStart(10) +
      "NC".padStart(10) +
      "DΔ".padStart(10) +
      "CΔ".padStart(10) +
      "NCΔ".padStart(10) +
      "CTrL".padStart(10) +
      "CTrS".padStart(10),
  );
  console.log(`  ${"─".repeat(86)}`);

  for (const currency of Object.keys(latest.currencies).sort()) {
    const market = latest.currencies[currency]!;
    console.log(
      "  " +
        currency.padEnd(6) +
        String(market.dealer_net ?? "").padStart(10) +
        String(market.commercial_net ?? "").padStart(10) +
        String(market.noncomm_net ?? "").padStart(10) +
        String(market.dealer_delta_net ?? "").padStart(10) +
        String(market.commercial_delta_net ?? "").padStart(10) +
        String(market.noncomm_delta_net ?? "").padStart(10) +
        String(market.commercial_traders_long ?? "").padStart(10) +
        String(market.commercial_traders_short ?? "").padStart(10),
    );
  }
}

async function refreshWithRetry(assetClass: (typeof ASSET_CLASS_ORDER)[number], date: string) {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
    try {
      await refreshSnapshotForClass(assetClass, date);
      return null;
    } catch (error) {
      lastError = error;
      console.warn(
        `[${assetClass}] ${date} attempt ${attempt}/${RETRY_COUNT} failed:`,
        error instanceof Error ? error.message : error,
      );
      await sleep(REFRESH_DELAY_MS * attempt);
    }
  }
  return lastError;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   COT Deep History Backfill                                    ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  const discovered = await fetchAvailableReportDates("tff", API_DISCOVERY_LIMIT);
  if (discovered.length === 0) {
    throw new Error("No TFF report dates discovered from CFTC API.");
  }

  const targetDates =
    discovered.length > 500 ? discovered.slice(-HARD_CAP) : discovered;
  const storedBefore = await listSnapshotDates("fx");
  const storedBeforeAsc = [...storedBefore].sort((left, right) => left.localeCompare(right));
  const missingDates = targetDates.filter((date) => !storedBefore.includes(date));

  console.log(`Discovered TFF dates: ${discovered.length} (${formatRange(discovered)})`);
  console.log(`Target backfill dates: ${targetDates.length} (${formatRange(targetDates)})`);
  console.log(`Stored FX dates before: ${storedBefore.length} (${formatRange(storedBeforeAsc)})`);
  console.log(`Missing FX dates within target window: ${missingDates.length}`);
  console.log(`Refresh delay: ${REFRESH_DELAY_MS}ms`);

  const failures: Array<{ assetClass: string; date: string; error: string }> = [];

  for (const assetClass of ASSET_CLASS_ORDER) {
    console.log(`\n[${assetClass}] refreshing ${targetDates.length} dates`);
    for (let index = 0; index < targetDates.length; index++) {
      const date = targetDates[index]!;
      console.log(`[${assetClass}] ${index + 1}/${targetDates.length} ${date}`);
      const error = await refreshWithRetry(assetClass, date);
      if (error) {
        failures.push({
          assetClass,
          date,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      await sleep(REFRESH_DELAY_MS);
    }
  }

  const storedAfter = await listSnapshotDates("fx");
  const storedAfterAsc = [...storedAfter].sort((left, right) => left.localeCompare(right));

  console.log(`\nStored FX dates after: ${storedAfter.length} (${formatRange(storedAfterAsc)})`);
  console.log(`Backfill failures: ${failures.length}`);
  for (const failure of failures.slice(0, 20)) {
    console.log(`  [${failure.assetClass}] ${failure.date} :: ${failure.error}`);
  }
  await printFxVerification(storedAfterAsc);
  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
