import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { pathToFileURL } from "node:url";

import { certifyActiveBaseline } from "../src/lib/appTruth/activeBaselineCertification";
import { getPool } from "../src/lib/db";

function parseArgs() {
  return {
    json: process.argv.includes("--json"),
  };
}

async function main() {
  const args = parseArgs();
  const payload = await certifyActiveBaseline({
    triggerType: "backfill",
    routePath: "scripts/app-truth-certify-active-baseline.ts",
  });

  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("App Truth Active Baseline Certification");
    console.log("=======================================");
    console.log(`Baseline: ${payload.baselineId}`);
    console.log(`Weeks: ${payload.weeks.length}`);
    console.log(`Scheduler receipt: ${payload.schedulerRunId}`);
    console.log(`Evidence hash: ${payload.evidenceHash}`);
    for (const result of payload.results) {
      console.log([
        result.materializationType,
        result.ok ? "PASS" : "FAIL",
        `${result.actualRows}/${result.expectedRows}`,
        `missing=${result.missingInputs.length}`,
      ].join(" | "));
    }
    console.log("=======================================");
  }

  if (!payload.ok) {
    const missingCount = payload.results.reduce((sum, result) => sum + result.missingInputs.length, 0);
    throw new Error(`Active baseline certification failed with ${missingCount} missing input(s).`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.stack ?? error.message : String(error));
      process.exit(1);
    })
    .finally(async () => {
      await getPool().end().catch(() => undefined);
    });
}
