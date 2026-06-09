import { NextResponse } from "next/server";
import {
  finishSchedulerRunReceipt,
  recordMaterializationRunReceipt,
  startSchedulerRunReceipt,
} from "@/lib/appTruth/runLedger";
import { refreshPerformanceSnapshots } from "@/lib/performanceRefresh";
import { isCronAuthorized } from "@/lib/cronAuth";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const url = new URL(request.url);
  const weeksParam = url.searchParams.get("weeks");
  const rollingWeeks = weeksParam ? Number.parseInt(weeksParam, 10) : 6;
  let schedulerRunId: string | null = null;
  let materializationRunId: string | null = null;
  const ledgerErrors: string[] = [];

  try {
    const receipt = await startSchedulerRunReceipt({
      jobId: "performance-refresh",
      jobType: "strategy_materialization",
      triggerType: "schedule",
      routePath: "/api/cron/performance-refresh",
      schedule: "20 * * * *",
      startedAtUtc: startedAt,
      inputArtifacts: ["performance_snapshots"],
      requiredInputs: ["strategy performance source rows"],
      metadata: { rollingWeeks },
    });
    schedulerRunId = receipt.runId;
  } catch (error) {
    ledgerErrors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    const result = await refreshPerformanceSnapshots({
      rollingWeeks: Number.isFinite(rollingWeeks) && rollingWeeks > 0 ? rollingWeeks : 6,
    });
    try {
      revalidatePath("/performance");
      revalidatePath("/dashboard");
    } catch {
      // non-fatal
    }
    const finishedAt = new Date().toISOString();
    if (schedulerRunId) {
      try {
        await finishSchedulerRunReceipt({
          runId: schedulerRunId,
          completedAtUtc: finishedAt,
          outputArtifacts: [`performance_snapshots:${result.snapshots_written}`],
          namespaceProduced: "performance_snapshots",
          status: "succeeded",
          metadata: {
            weekOpenUtc: result.week_open_utc,
            refreshedWeeks: result.weeks,
            snapshotsWritten: result.snapshots_written,
          },
        });
      } catch (error) {
        ledgerErrors.push(error instanceof Error ? error.message : String(error));
      }
      try {
        const receipt = await recordMaterializationRunReceipt({
          schedulerRunId,
          materializationType: "performance_snapshots",
          domain: "performance",
          weekWindow: result.weeks,
          rowsTouched: result.snapshots_written,
          inputArtifacts: ["strategy performance source rows"],
          outputArtifacts: ["performance_snapshots"],
          namespaceProduced: "performance_snapshots",
          status: "succeeded",
          startedAtUtc: startedAt,
          completedAtUtc: finishedAt,
          metadata: { weekOpenUtc: result.week_open_utc },
        });
        materializationRunId = receipt.runId;
      } catch (error) {
        ledgerErrors.push(error instanceof Error ? error.message : String(error));
      }
    }
    return NextResponse.json({
      ok: true,
      task: "performance_refresh",
      started_at: startedAt,
      finished_at: finishedAt,
      week_open_utc: result.week_open_utc,
      refreshed_weeks: result.weeks,
      snapshots_written: result.snapshots_written,
      appTruthLedger: {
        schedulerRunId,
        materializationRunId,
        errors: ledgerErrors.length > 0 ? ledgerErrors : undefined,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const finishedAt = new Date().toISOString();
    if (schedulerRunId) {
      try {
        await finishSchedulerRunReceipt({
          runId: schedulerRunId,
          completedAtUtc: finishedAt,
          status: "failed",
          errorMessage: message,
          degradedReasons: [message],
        });
      } catch (ledgerError) {
        ledgerErrors.push(ledgerError instanceof Error ? ledgerError.message : String(ledgerError));
      }
    }
    return NextResponse.json(
      {
        ok: false,
        task: "performance_refresh",
        started_at: startedAt,
        finished_at: finishedAt,
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
