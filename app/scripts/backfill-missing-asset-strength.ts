/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: scripts/backfill-missing-asset-strength.ts
 *
 * Description:
 * Backfills missing asset-strength classes for the existing canonical strength
 * timeline. This is intended for structural additions like `indices`, where we
 * already have the shared snapshot hours but need the new asset class stored
 * across history without recomputing the entire currency layer.
 *
 * Run:
 *   npx tsx scripts/backfill-missing-asset-strength.ts
 *   npx tsx scripts/backfill-missing-asset-strength.ts --asset-class=indices --limit=24
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

loadEnvConfig(process.cwd());

import { getPool } from "../src/lib/db";
import {
  computeAllAssetStrengths,
  type AssetClass,
  writeAssetStrengthSnapshots,
} from "../src/lib/assetStrength";

type SnapshotRow = {
  snapshot_time_utc: Date | string;
};

const DEFAULT_TARGET: AssetClass = "indices";

function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.split("=");
    if (key.startsWith("--")) {
      args.set(key.slice(2), value ?? "true");
    }
  }
  const assetClass = (args.get("asset-class") ?? DEFAULT_TARGET) as AssetClass;
  const limitRaw = Number(args.get("limit") ?? "");
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : null;
  return {
    assetClass,
    limit,
  };
}

async function listMissingSnapshotTimes(assetClass: AssetClass) {
  const pool = getPool();
  const rows = await pool.query<SnapshotRow>(
    `
      SELECT DISTINCT c.snapshot_time_utc
        FROM currency_strength_snapshots c
        LEFT JOIN asset_strength_snapshots a
          ON a.snapshot_time_utc = c.snapshot_time_utc
         AND a.asset_class = $1
       WHERE a.snapshot_time_utc IS NULL
       ORDER BY c.snapshot_time_utc ASC
    `,
    [assetClass],
  );
  return rows.rows.map((row) => DateTime.fromJSDate(new Date(row.snapshot_time_utc), { zone: "utc" }));
}

async function main() {
  const { assetClass, limit } = parseArgs();
  if (!["crypto", "commodities", "indices"].includes(assetClass)) {
    throw new Error(`Unsupported asset class: ${assetClass}`);
  }

  const snapshotTimes = await listMissingSnapshotTimes(assetClass);
  const targets = limit ? snapshotTimes.slice(0, limit) : snapshotTimes;
  console.log(`Missing asset-strength hours for ${assetClass}: ${snapshotTimes.length}`);
  console.log(`Processing: ${targets.length}`);

  let completed = 0;
  let rowsWritten = 0;
  let errors = 0;
  const startedAt = Date.now();

  for (const asOfHourUtc of targets) {
    try {
      const results = await computeAllAssetStrengths(asOfHourUtc);
      const filtered = results.filter((row) => row.assetClass === assetClass);
      rowsWritten += await writeAssetStrengthSnapshots(filtered);
      completed += 1;

      if (completed % 25 === 0 || completed === targets.length) {
        const elapsedMinutes = ((Date.now() - startedAt) / 1000 / 60).toFixed(1);
        console.log(
          `[${completed}/${targets.length}] ${asOfHourUtc.toISO()} | rows written ${rowsWritten} | ${elapsedMinutes}m elapsed`,
        );
      }
    } catch (error) {
      errors += 1;
      console.error(
        `ERROR ${asOfHourUtc.toISO()}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  console.log("\nDone");
  console.log(`Asset class: ${assetClass}`);
  console.log(`Hours processed: ${completed}/${targets.length}`);
  console.log(`Rows written: ${rowsWritten}`);
  console.log(`Errors: ${errors}`);

  await getPool().end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});

