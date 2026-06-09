import { NextResponse } from "next/server";
import {
  finishSchedulerRunReceipt,
  recordMaterializationRunReceipt,
  startSchedulerRunReceipt,
} from "@/lib/appTruth/runLedger";
import { ACTIVE_BASELINE_PERFORMANCE_HISTORY_WINDOW } from "@/lib/appTruth/activeBaseline";
import { isCronAuthorized } from "@/lib/cronAuth";
import { ensureHistoricalWeekShardsForSelection } from "@/lib/performance/strategyPageData";
import { buildStrategySelectionKey, listVisibleStrategyBootstrapSelections } from "@/lib/performance/strategySelection";
import { listStrategyArtifactReadiness } from "@/lib/performance/strategyArtifactReadiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const CRON_ROUTE_BUDGET_MS = 100_000;
const CRON_SELECTION_BUDGET_MS = 60_000;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const startedAtUtc = new Date().toISOString();
  const url = new URL(request.url);
  const requestedMode = url.searchParams.get("mode") ?? "normal";
  const onlyKey = url.searchParams.get("key");
  const selections = listVisibleStrategyBootstrapSelections()
    .filter((selection) => !onlyKey || buildStrategySelectionKey(selection) === onlyKey);
  let schedulerRunId: string | null = null;
  let materializationRunId: string | null = null;
  const ledgerErrors: string[] = [];

  try {
    const receipt = await startSchedulerRunReceipt({
      jobId: "strategy-artifacts",
      jobType: "performance_materialization",
      triggerType: onlyKey ? "manual" : "schedule",
      routePath: "/api/cron/strategy-artifacts",
      schedule: onlyKey ? null : "40 * * * *",
      startedAtUtc,
      inputArtifacts: ["source fingerprints", "strategy selection config", "pair_period_returns"],
      requiredInputs: ["active baseline weeks", "source fingerprints", "execution weekly returns"],
      metadata: {
        requestedMode,
        onlyKey,
        queuedSelections: selections.length,
        historyWindow: ACTIVE_BASELINE_PERFORMANCE_HISTORY_WINDOW,
      },
    });
    schedulerRunId = receipt.runId;
  } catch (error) {
    ledgerErrors.push(error instanceof Error ? error.message : String(error));
  }

  const readiness = await listStrategyArtifactReadiness(selections);

  const warmed: Array<{
    key: string;
    label: string;
    ok: boolean;
    durationMs: number;
    finalizedWeeks: string[];
    error?: string;
  }> = [];
  let timedOut = false;

  for (const selection of selections) {
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= CRON_ROUTE_BUDGET_MS) {
      timedOut = true;
      break;
    }

    const selectionKey = buildStrategySelectionKey(selection);
    const artifact = readiness.find((item) => item.key === selectionKey);
    if (!onlyKey && artifact?.ready) {
      continue;
    }
    const selectionStart = Date.now();
    const perSelectionBudgetMs = Math.min(
      CRON_SELECTION_BUDGET_MS,
      CRON_ROUTE_BUDGET_MS - elapsedMs,
    );
    try {
      const result = await ensureHistoricalWeekShardsForSelection(selection, {
        onlyPreviousWeek: false,
        historyWindow: ACTIVE_BASELINE_PERFORMANCE_HISTORY_WINDOW,
        timeBudgetMs: perSelectionBudgetMs,
      });
      if ((result?.computedWeeks.length ?? 0) > 0) {
        warmed.push({
          key: selectionKey,
          label: artifact?.label ?? selectionKey,
          ok: Object.keys(result?.errors ?? {}).length === 0,
          durationMs: Date.now() - selectionStart,
          finalizedWeeks: result?.computedWeeks ?? [],
        });
      }
    } catch (error) {
      warmed.push({
        key: selectionKey,
        label: artifact?.label ?? selectionKey,
        ok: false,
        durationMs: Date.now() - selectionStart,
        finalizedWeeks: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const after = await listStrategyArtifactReadiness(selections);
  const finishedAtUtc = new Date().toISOString();
  const finalizedWeeks = Array.from(new Set(warmed.flatMap((item) => item.finalizedWeeks))).sort();
  const warmedErrors = warmed
    .filter((item) => !item.ok)
    .map((item) => `${item.key}: ${item.error ?? "artifact finalization degraded"}`);
  const runStatus = timedOut || warmedErrors.length > 0 ? "degraded" : "succeeded";

  if (schedulerRunId) {
    try {
      await finishSchedulerRunReceipt({
        runId: schedulerRunId,
        completedAtUtc: finishedAtUtc,
        outputArtifacts: [`strategy_week_shards:${finalizedWeeks.length}`],
        namespaceProduced: "strategy_week_shards",
        status: runStatus,
        degradedReasons: [
          ...warmedErrors,
          timedOut ? "Cron route budget reached before all selections were checked." : null,
        ].filter((value): value is string => Boolean(value)),
        metadata: {
          requestedMode,
          onlyKey,
          timedOut,
          queuedSelections: selections.length,
          warmedSelections: warmed.length,
          finalizedWeeks,
          historyWindow: ACTIVE_BASELINE_PERFORMANCE_HISTORY_WINDOW,
          beforeReady: readiness.filter((artifact) => artifact.ready).length,
          afterReady: after.filter((artifact) => artifact.ready).length,
        },
      });
    } catch (error) {
      ledgerErrors.push(error instanceof Error ? error.message : String(error));
    }
    try {
      const receipt = await recordMaterializationRunReceipt({
        schedulerRunId,
        materializationType: "strategy_week_shards",
        domain: "performance",
        weekWindow: finalizedWeeks,
        rowsTouched: finalizedWeeks.length,
        inputArtifacts: ["source fingerprints", "strategy selection config", "pair_period_returns"],
        outputArtifacts: ["strategy_week_shards"],
        namespaceProduced: "strategy_week_shards",
        status: runStatus,
        degradedReasons: warmedErrors,
        startedAtUtc,
        completedAtUtc: finishedAtUtc,
        metadata: {
          requestedMode,
          onlyKey,
          timedOut,
          queuedSelections: selections.length,
          warmedSelections: warmed.length,
          historyWindow: ACTIVE_BASELINE_PERFORMANCE_HISTORY_WINDOW,
        },
      });
      materializationRunId = receipt.runId;
    } catch (error) {
      ledgerErrors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return NextResponse.json({
    ok: warmed.every((item) => item.ok),
    task: "strategy_week_shard_finalize",
    mode: "week-finalization",
    requestedMode,
    autoBurst: false,
    timedOut,
    startedAtUtc,
    finishedAtUtc: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    limit: null,
    queued: selections.length,
    warmed,
    before: {
      ready: readiness.filter((artifact) => artifact.ready).length,
      total: readiness.length,
      staleWeek: 0,
    },
    after: {
      ready: after.filter((artifact) => artifact.ready).length,
      total: after.length,
    },
    prunedOldShards: 0,
    appTruthLedger: {
      schedulerRunId,
      materializationRunId,
      errors: ledgerErrors.length > 0 ? ledgerErrors : undefined,
    },
  });
}
