import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import {
  finishSchedulerRunReceipt,
  recordMaterializationRunReceipt,
  startSchedulerRunReceipt,
} from "../src/lib/appTruth/runLedger";
import {
  ACTIVE_BASELINE_SOURCE_RELEASE_WINDOW,
  getPreviousClosedActiveWeekOpenUtc,
} from "../src/lib/appTruth/activeBaseline";
import { getPool } from "../src/lib/db";
import {
  getFridayFreezeDisplayWeekOpenUtc,
  V203_CLEAN_14W_FREEZE_WEEKS,
} from "../src/lib/sourceFreeze/fridayFreeze";
import {
  buildAndPersistFrozenSourceLedgerWeeks,
  FRIDAY_FREEZE_LEDGER_VERSION,
} from "../src/lib/sourceFreeze/sourceLedger";

type Args = {
  releaseWindow: string;
  week: string | null;
  json: boolean;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const requestedWeek = args.find((arg) => arg.startsWith("--week="))?.slice("--week=".length) ?? null;
  return {
    releaseWindow: args.find((arg) => arg.startsWith("--release-window="))?.slice("--release-window=".length)
      ?? (requestedWeek === "previous-closed" || requestedWeek === "latest-closed"
        ? ACTIVE_BASELINE_SOURCE_RELEASE_WINDOW
        : "v2.0.3-clean-14w"),
    week: requestedWeek,
    json: args.includes("--json"),
  };
}

function resolveWeeks(args: Args) {
  if (args.week) {
    if (args.week === "current") return [getFridayFreezeDisplayWeekOpenUtc()];
    if (args.week === "previous-closed" || args.week === "latest-closed") {
      const previousClosedWeek = getPreviousClosedActiveWeekOpenUtc();
      if (!previousClosedWeek) {
        throw new Error("Could not resolve the previous closed active week.");
      }
      return [previousClosedWeek];
    }
    return [args.week];
  }
  if (args.releaseWindow === "v2.0.3-clean-14w") {
    return [...V203_CLEAN_14W_FREEZE_WEEKS];
  }
  throw new Error("Only --release-window=v2.0.3-clean-14w is supported unless --week is supplied.");
}

async function main() {
  const args = parseArgs();
  const weeks = resolveWeeks(args);
  const startedAtUtc = new Date().toISOString();
  let schedulerRunId: string | null = null;
  const receiptErrors: string[] = [];

  try {
    const receipt = await startSchedulerRunReceipt({
      jobId: "source-freeze-ledger-build",
      jobType: "source_freeze_materialization",
      triggerType: "manual",
      routePath: "app/scripts/build-friday-freeze-source-ledger.ts",
      startedAtUtc,
      inputArtifacts: [
        "cot_snapshots",
        "sentiment_aggregates",
        "currency_strength_snapshots",
        "asset_strength_snapshots",
        "pair_period_returns",
      ],
      requiredInputs: [
        "dealer/commercial COT snapshots",
        "Friday sentiment aggregates",
        "Friday strength snapshots",
        "prior weekly returns",
      ],
      metadata: {
        releaseWindow: args.releaseWindow,
        requestedWeek: args.week,
        weeks,
      },
    });
    schedulerRunId = receipt.runId;
  } catch (error) {
    receiptErrors.push(error instanceof Error ? error.message : String(error));
  }

  let ledgers: Awaited<ReturnType<typeof buildAndPersistFrozenSourceLedgerWeeks>> = [];
  try {
    ledgers = await buildAndPersistFrozenSourceLedgerWeeks(
      weeks,
      args.releaseWindow,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (schedulerRunId) {
      try {
        await finishSchedulerRunReceipt({
          runId: schedulerRunId,
          completedAtUtc: new Date().toISOString(),
          status: "failed",
          errorMessage: message,
          degradedReasons: [message],
        });
      } catch (receiptError) {
        receiptErrors.push(receiptError instanceof Error ? receiptError.message : String(receiptError));
      }
      try {
        await recordMaterializationRunReceipt({
          schedulerRunId,
          materializationType: "source_freeze_ledger",
          domain: "data",
          baselineId: args.releaseWindow,
          weekWindow: weeks,
          rowsTouched: null,
          inputArtifacts: ["cot_snapshots", "sentiment_aggregates", "strength_snapshots", "pair_period_returns"],
          outputArtifacts: [],
          namespaceProduced: `${FRIDAY_FREEZE_LEDGER_VERSION}:${args.releaseWindow}`,
          status: "failed",
          errorMessage: message,
          degradedReasons: [message],
          startedAtUtc,
          completedAtUtc: new Date().toISOString(),
        });
      } catch (receiptError) {
        receiptErrors.push(receiptError instanceof Error ? receiptError.message : String(receiptError));
      }
    }
    throw error;
  }

  const failed = ledgers.filter((ledger) => !ledger.complete || !ledger.trustedForFreeze);
  const totalSignals = ledgers.reduce((sum, ledger) => sum + ledger.signals.length, 0);
  const evidenceHash = createHash("sha256")
    .update(JSON.stringify(ledgers.map((ledger) => ({
      weekOpenUtc: ledger.weekOpenUtc,
      ledgerVersion: ledger.ledgerVersion,
      releaseWindow: ledger.releaseWindow,
      sourceHash: ledger.sourceHash,
      complete: ledger.complete,
      trustedForFreeze: ledger.trustedForFreeze,
    }))))
    .digest("hex");
  const receiptStatus = failed.length > 0 ? "degraded" : "succeeded";
  const degradedReasons = failed.flatMap((ledger) => (
    ledger.summaries.flatMap((summary) => summary.incidents.map((incident) => `${ledger.weekOpenUtc}:${summary.source}:${incident}`))
  ));

  if (schedulerRunId) {
    try {
      await finishSchedulerRunReceipt({
        runId: schedulerRunId,
        completedAtUtc: new Date().toISOString(),
        outputArtifacts: [
          `source_freeze_ledger_weeks:${ledgers.length}`,
          `source_freeze_ledger_signals:${totalSignals}`,
        ],
        namespaceProduced: `${FRIDAY_FREEZE_LEDGER_VERSION}:${args.releaseWindow}`,
        status: receiptStatus,
        degradedReasons,
        metadata: {
          releaseWindow: args.releaseWindow,
          weeks: ledgers.map((ledger) => ledger.weekOpenUtc),
          failedWeeks: failed.map((ledger) => ledger.weekOpenUtc),
          totalSignals,
          evidenceHash,
        },
      });
    } catch (error) {
      receiptErrors.push(error instanceof Error ? error.message : String(error));
    }
    try {
      await recordMaterializationRunReceipt({
        schedulerRunId,
        materializationType: "source_freeze_ledger",
        domain: "data",
        baselineId: args.releaseWindow,
        weekWindow: ledgers.map((ledger) => ledger.weekOpenUtc),
        rowsTouched: totalSignals,
        inputArtifacts: ["cot_snapshots", "sentiment_aggregates", "strength_snapshots", "pair_period_returns"],
        outputArtifacts: ["source_freeze_ledger_weeks", "source_freeze_ledger_signals"],
        namespaceProduced: `${FRIDAY_FREEZE_LEDGER_VERSION}:${args.releaseWindow}`,
        status: receiptStatus,
        degradedReasons,
        evidenceHash,
        startedAtUtc,
        completedAtUtc: new Date().toISOString(),
        metadata: {
          releaseWindow: args.releaseWindow,
          ledgerVersion: FRIDAY_FREEZE_LEDGER_VERSION,
          failedWeeks: failed.map((ledger) => ledger.weekOpenUtc),
        },
      });
    } catch (error) {
      receiptErrors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (args.json) {
    console.log(JSON.stringify({
      schema: "friday-freeze-source-ledger-build-v1",
      ledgerVersion: FRIDAY_FREEZE_LEDGER_VERSION,
      releaseWindow: args.releaseWindow,
      appTruthLedger: {
        schedulerRunId,
        receiptErrors: receiptErrors.length > 0 ? receiptErrors : undefined,
      },
      weeks: ledgers.map((ledger) => ({
        weekOpenUtc: ledger.weekOpenUtc,
        freezeTargetUtc: ledger.freezeTargetUtc,
        complete: ledger.complete,
        trustedForFreeze: ledger.trustedForFreeze,
        sourceHash: ledger.sourceHash,
        summaries: ledger.summaries,
      })),
    }, null, 2));
  } else {
    console.log("Friday Freeze Source Ledger Build");
    console.log("=================================");
    console.log(`Ledger version: ${FRIDAY_FREEZE_LEDGER_VERSION}`);
    console.log(`Scope: ${args.releaseWindow}`);
    console.log(`Weeks: ${ledgers.length}`);
    console.log(`App truth scheduler receipt: ${schedulerRunId ?? "not written"}`);
    if (receiptErrors.length > 0) {
      console.log(`Receipt errors: ${receiptErrors.join(" | ")}`);
    }
    console.log("");
    console.log("week | freeze | complete | trustedForFreeze | hash | source incidents");
    for (const ledger of ledgers) {
      const incidents = ledger.summaries.reduce((sum, summary) => sum + summary.incidents.length, 0);
      console.log([
        ledger.weekOpenUtc.slice(0, 10),
        ledger.freezeTargetUtc,
        String(ledger.complete),
        String(ledger.trustedForFreeze),
        ledger.sourceHash.slice(0, 12),
        String(incidents),
      ].join(" | "));
      for (const summary of ledger.summaries) {
        if (summary.incidents.length === 0) continue;
        console.log(`  ${summary.source}:`);
        for (const incident of summary.incidents) {
          console.log(`    - ${incident}`);
        }
      }
    }
    console.log("=================================");
  }

  if (failed.length > 0) {
    throw new Error(`Persisted Friday-freeze ledger failed with ${failed.length} incomplete/untrusted week(s).`);
  }
  if (receiptErrors.length > 0) {
    throw new Error(`Persisted Friday-freeze ledger, but app-truth receipt write failed: ${receiptErrors.join(" | ")}`);
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
