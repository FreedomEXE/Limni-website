import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { refreshPerformanceSnapshots } from "../src/lib/performanceRefresh";

async function main() {
  const result = await refreshPerformanceSnapshots({
    rollingWeeks: 12,
  });

  console.log(
    `Refreshed ${result.snapshots_written} snapshots across ${result.weeks.length} weeks. Latest week: ${result.week_open_utc}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
