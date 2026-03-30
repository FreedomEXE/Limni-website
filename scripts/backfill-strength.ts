/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: scripts/backfill-strength.ts
 *
 * Description:
 * Backfills currency_strength_snapshots and asset_strength_snapshots tables
 * for the 8-week backtest window (Jan 19 – Mar 16, 2026). Uses existing
 * computeAllCurrencyStrengths() and computeAllAssetStrengths() functions
 * which fetch H1 candles from OANDA for arbitrary past timestamps.
 *
 * Only computes hourly snapshots during active trading sessions
 * (00:00–21:00 UTC Mon–Fri) to skip weekends and off-hours.
 *
 * Run:
 *   npx tsx scripts/backfill-strength.ts
 *
 * Estimated runtime: ~60-90 minutes (OANDA rate-limited, 100ms between pairs)
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

loadEnvConfig(process.cwd());

import {
  computeAllCurrencyStrengths,
  writeCurrencyStrengthSnapshots,
} from "../src/lib/currencyStrength";
import {
  computeAllAssetStrengths,
  writeAssetStrengthSnapshots,
} from "../src/lib/assetStrength";

// ── Config ─────────────────────────────────────────────────────────
// Match the backtest window: 8 completed weeks before Mar 19
const BACKFILL_START = DateTime.utc(2026, 1, 19, 0, 0, 0);  // Week 1 open
const BACKFILL_END = DateTime.utc(2026, 3, 16, 0, 0, 0);     // After week 8 close
const BATCH_SIZE = 1; // Hours per batch (sequential for OANDA rate limits)

// Only backfill during market hours (skip weekends)
function isMarketHour(dt: DateTime): boolean {
  const dow = dt.weekday; // 1=Mon, 7=Sun
  if (dow === 6 || dow === 7) return false; // Skip Sat/Sun
  const hour = dt.hour;
  return hour >= 0 && hour < 21; // Active sessions: 00:00–21:00 UTC
}

async function main() {
  // Build the list of hours to backfill
  const hours: DateTime[] = [];
  let cursor = BACKFILL_START;
  while (cursor < BACKFILL_END) {
    if (isMarketHour(cursor)) {
      hours.push(cursor);
    }
    cursor = cursor.plus({ hours: 1 });
  }

  console.log(`Strength backfill: ${hours.length} hourly snapshots to compute`);
  console.log(`  From: ${BACKFILL_START.toISO()}`);
  console.log(`  To:   ${BACKFILL_END.toISO()}`);
  console.log(`  Market hours only (Mon-Fri, 00:00-21:00 UTC)\n`);

  // Check how many already exist
  const { getPool } = await import("../src/lib/db");
  const pool = getPool();
  const existingCurrency = await pool.query<{ cnt: number }>(
    `SELECT COUNT(DISTINCT snapshot_time_utc)::int as cnt
     FROM currency_strength_snapshots
     WHERE snapshot_time_utc >= $1 AND snapshot_time_utc < $2`,
    [BACKFILL_START.toISO(), BACKFILL_END.toISO()],
  );
  const existingAsset = await pool.query<{ cnt: number }>(
    `SELECT COUNT(DISTINCT snapshot_time_utc)::int as cnt
     FROM asset_strength_snapshots
     WHERE snapshot_time_utc >= $1 AND snapshot_time_utc < $2`,
    [BACKFILL_START.toISO(), BACKFILL_END.toISO()],
  );
  console.log(`  Existing currency strength hours: ${existingCurrency.rows[0]?.cnt ?? 0}`);
  console.log(`  Existing asset strength hours: ${existingAsset.rows[0]?.cnt ?? 0}\n`);

  let completed = 0;
  let currencyRows = 0;
  let assetRows = 0;
  let errors = 0;
  const startTime = Date.now();

  for (const hour of hours) {
    try {
      // Compute currency strength (28 FX pairs, 3 windows)
      const currencyResults = await computeAllCurrencyStrengths(hour);
      const cWritten = await writeCurrencyStrengthSnapshots(currencyResults);
      currencyRows += cWritten;

      // Compute asset strength (crypto + commodities + indices, 3 windows each)
      const assetResults = await computeAllAssetStrengths(hour);
      const aWritten = await writeAssetStrengthSnapshots(assetResults);
      assetRows += aWritten;

      completed++;

      // Progress every 50 hours
      if (completed % 50 === 0 || completed === hours.length) {
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        const pct = ((completed / hours.length) * 100).toFixed(1);
        const eta = completed > 0
          ? (((Date.now() - startTime) / completed) * (hours.length - completed) / 1000 / 60).toFixed(1)
          : "?";
        console.log(
          `  [${pct}%] ${completed}/${hours.length} hours | ${hour.toFormat("yyyy-MM-dd HH:mm")} | ` +
          `currency: ${currencyRows} rows, asset: ${assetRows} rows | ` +
          `${elapsed}m elapsed, ~${eta}m remaining`,
        );
      }
    } catch (err) {
      errors++;
      console.error(
        `  ERROR at ${hour.toISO()}: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Continue — don't let one failed hour kill the whole backfill
    }
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Backfill complete`);
  console.log(`  Hours processed: ${completed}/${hours.length}`);
  console.log(`  Currency strength rows written: ${currencyRows}`);
  console.log(`  Asset strength rows written: ${assetRows}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total time: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} minutes`);
  console.log(`${"═".repeat(60)}\n`);

  await pool.end();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
