
import { refreshPerformanceSnapshots } from "../src/lib/performanceRefresh";

const WEEKS = [
  "2026-01-19T00:00:00.000Z",
  "2026-01-26T00:00:00.000Z",
  "2026-02-02T00:00:00.000Z",
  "2026-02-09T00:00:00.000Z",
  "2026-02-16T00:00:00.000Z",
];

async function main() {
  console.log("\n=== Refreshing Performance Snapshots with Fixed V2 ===\n");
  console.log(`Weeks to refresh: ${WEEKS.length}`);

  for (const weekOpenUtc of WEEKS) {
    console.log(`\nRefreshing week: ${weekOpenUtc}`);

    const result = await refreshPerformanceSnapshots({
      forcedWeekOpenUtc: weekOpenUtc,
      rollingWeeks: 1,
    });

    console.log(`  ✓ Written ${result.snapshots_written} snapshots`);
  }

  console.log("\n=== Refresh Complete ===\n");
  console.log("V2 now uses correct dealer-only mode for Antikythera");
  console.log("Database updated with both antikythera (V1) and antikythera_v2 (V2) models");
}

main().catch(console.error);
