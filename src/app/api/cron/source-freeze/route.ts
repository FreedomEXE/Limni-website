import { NextResponse } from "next/server";
import { DateTime } from "luxon";

import {
  ACTIVE_BASELINE_ID,
} from "@/lib/appTruth/activeBaseline";
import {
  finishSchedulerRunReceipt,
  recordMaterializationRunReceipt,
  startSchedulerRunReceipt,
} from "@/lib/appTruth/runLedger";
import { isCronAuthorized } from "@/lib/cronAuth";
import {
  getFridayFreezeDisplayWeekOpenUtc,
} from "@/lib/sourceFreeze/fridayFreeze";
import {
  buildAndPersistFrozenSourceLedgerWeeks,
  FRIDAY_FREEZE_LEDGER_VERSION,
  readFrozenSourceLedgerWeek,
} from "@/lib/sourceFreeze/sourceLedger";
import { getCanonicalWeekOpenUtc, normalizeWeekOpenUtc } from "@/lib/weekAnchor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const SOURCE_FREEZE_RELEASE_WINDOW = "current-friday-freeze";
const SOURCE_FREEZE_SCHEDULE = "15 21 * * 5, 15 22 * * 5";

function isTruthy(value: string | null) {
  return value === "1" || value === "true" || value === "yes";
}

function normalizeWeek(weekOpenUtc: string) {
  return normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
}

function incidentDetails(ledger: Awaited<ReturnType<typeof readFrozenSourceLedgerWeek>> | null) {
  if (!ledger) return [];
  return ledger.summaries.flatMap((summary) =>
    summary.incidents.map((incident) => `${summary.source}:${incident}`));
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAtUtc = new Date().toISOString();
  const nowUtc = DateTime.utc();
  const url = new URL(request.url);
  const requestedWeek = url.searchParams.get("week");
  const force = isTruthy(url.searchParams.get("force"));
  const currentCanonicalWeek = getCanonicalWeekOpenUtc(nowUtc);
  const displayWeek = getFridayFreezeDisplayWeekOpenUtc(nowUtc);
  const targetWeek = normalizeWeek(requestedWeek && requestedWeek !== "current"
    ? requestedWeek
    : displayWeek);
  const scheduledMode = !requestedWeek;
  let schedulerRunId: string | null = null;
  let materializationRunId: string | null = null;
  const ledgerErrors: string[] = [];

  try {
    const receipt = await startSchedulerRunReceipt({
      jobId: "source-freeze-ledger",
      jobType: "source_freeze_materialization",
      triggerType: scheduledMode ? "schedule" : "manual",
      routePath: "/api/cron/source-freeze",
      schedule: scheduledMode ? SOURCE_FREEZE_SCHEDULE : null,
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
        requestedWeek,
        targetWeek,
        currentCanonicalWeek,
        displayWeek,
        force,
        releaseWindow: SOURCE_FREEZE_RELEASE_WINDOW,
      },
    });
    schedulerRunId = receipt.runId;
  } catch (error) {
    ledgerErrors.push(error instanceof Error ? error.message : String(error));
  }

  const finishSkipped = async (reason: string) => {
    const completedAtUtc = new Date().toISOString();
    if (schedulerRunId) {
      try {
        await finishSchedulerRunReceipt({
          runId: schedulerRunId,
          completedAtUtc,
          status: "skipped",
          degradedReasons: [reason],
          metadata: {
            targetWeek,
            currentCanonicalWeek,
            displayWeek,
            releaseWindow: SOURCE_FREEZE_RELEASE_WINDOW,
          },
        });
      } catch (error) {
        ledgerErrors.push(error instanceof Error ? error.message : String(error));
      }
    }
    return NextResponse.json({
      ok: true,
      task: "source_freeze_ledger",
      status: "skipped",
      reason,
      targetWeek,
      currentCanonicalWeek,
      displayWeek,
      appTruthLedger: {
        schedulerRunId,
        materializationRunId,
        errors: ledgerErrors.length > 0 ? ledgerErrors : undefined,
      },
    });
  };

  if (scheduledMode && displayWeek === currentCanonicalWeek) {
    return finishSkipped("Friday source-freeze display week has not advanced yet.");
  }

  try {
    let ledger = !force ? await readFrozenSourceLedgerWeek(targetWeek) : null;
    let reusedExisting = Boolean(ledger);
    if (!ledger) {
      [ledger] = await buildAndPersistFrozenSourceLedgerWeeks(
        [targetWeek],
        SOURCE_FREEZE_RELEASE_WINDOW,
      );
      reusedExisting = false;
    }

    if (!ledger) {
      throw new Error(`Source freeze ledger was not produced for ${targetWeek}.`);
    }

    const completedAtUtc = new Date().toISOString();
    const incidents = incidentDetails(ledger);
    const ready = ledger.complete && ledger.trustedForFreeze;
    const degradedReasons = ready
      ? []
      : incidents.length > 0
        ? incidents
        : [`source_freeze_ledger_untrusted:${targetWeek}`];
    const outputArtifacts = [
      `source_freeze_ledger_weeks:${targetWeek}`,
      `source_freeze_ledger_signals:${ledger.signals.length}`,
      `source_hash:${ledger.sourceHash}`,
    ];

    if (schedulerRunId) {
      try {
        await finishSchedulerRunReceipt({
          runId: schedulerRunId,
          completedAtUtc,
          outputArtifacts,
          namespaceProduced: `${FRIDAY_FREEZE_LEDGER_VERSION}:${SOURCE_FREEZE_RELEASE_WINDOW}`,
          status: ready ? "succeeded" : "degraded",
          degradedReasons,
          metadata: {
            targetWeek,
            freezeTargetUtc: ledger.freezeTargetUtc,
            releaseWindow: ledger.releaseWindow,
            sourceHash: ledger.sourceHash,
            reusedExisting,
            complete: ledger.complete,
            trustedForFreeze: ledger.trustedForFreeze,
            incidents,
          },
        });
      } catch (error) {
        ledgerErrors.push(error instanceof Error ? error.message : String(error));
      }
      try {
        const receipt = await recordMaterializationRunReceipt({
          schedulerRunId,
          materializationType: "source_freeze_ledger",
          domain: "data",
          baselineId: ACTIVE_BASELINE_ID,
          weekWindow: [targetWeek],
          rowsTouched: ledger.signals.length,
          inputArtifacts: ["source_freeze_ledger_weeks", "source_freeze_ledger_signals"],
          outputArtifacts,
          namespaceProduced: `${FRIDAY_FREEZE_LEDGER_VERSION}:${SOURCE_FREEZE_RELEASE_WINDOW}`,
          status: ready ? "succeeded" : "degraded",
          degradedReasons,
          evidenceHash: ledger.sourceHash,
          startedAtUtc,
          completedAtUtc,
          metadata: {
            targetWeek,
            freezeTargetUtc: ledger.freezeTargetUtc,
            releaseWindow: ledger.releaseWindow,
            reusedExisting,
            complete: ledger.complete,
            trustedForFreeze: ledger.trustedForFreeze,
            incidents,
          },
        });
        materializationRunId = receipt.runId;
      } catch (error) {
        ledgerErrors.push(error instanceof Error ? error.message : String(error));
      }
    }

    return NextResponse.json({
      ok: ready,
      task: "source_freeze_ledger",
      status: ready ? "succeeded" : "degraded",
      targetWeek,
      freezeTargetUtc: ledger.freezeTargetUtc,
      releaseWindow: ledger.releaseWindow,
      sourceHash: ledger.sourceHash,
      complete: ledger.complete,
      trustedForFreeze: ledger.trustedForFreeze,
      reusedExisting,
      incidents,
      appTruthLedger: {
        schedulerRunId,
        materializationRunId,
        errors: ledgerErrors.length > 0 ? ledgerErrors : undefined,
      },
    }, { status: ready ? 200 : 503 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const completedAtUtc = new Date().toISOString();
    if (schedulerRunId) {
      try {
        await finishSchedulerRunReceipt({
          runId: schedulerRunId,
          completedAtUtc,
          status: "failed",
          errorMessage: message,
          degradedReasons: [message],
          metadata: {
            targetWeek,
            currentCanonicalWeek,
            displayWeek,
            releaseWindow: SOURCE_FREEZE_RELEASE_WINDOW,
          },
        });
      } catch (ledgerError) {
        ledgerErrors.push(ledgerError instanceof Error ? ledgerError.message : String(ledgerError));
      }
    }
    return NextResponse.json(
      {
        ok: false,
        task: "source_freeze_ledger",
        targetWeek,
        error: message,
        appTruthLedger: {
          schedulerRunId,
          materializationRunId,
          errors: ledgerErrors.length > 0 ? ledgerErrors : undefined,
        },
      },
      { status: 503 },
    );
  }
}
