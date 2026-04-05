/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: refresh-cot-now.ts
 *
 * Description:
 * Refreshes the latest COT snapshots for all asset classes and prints
 * the refreshed report dates.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { refreshAllSnapshots } from "../src/lib/cotStore";

async function main() {
  const snapshots = await refreshAllSnapshots();
  for (const [assetClass, snapshot] of Object.entries(snapshots)) {
    console.log(`${assetClass} ${snapshot.report_date} ${snapshot.last_refresh_utc}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
