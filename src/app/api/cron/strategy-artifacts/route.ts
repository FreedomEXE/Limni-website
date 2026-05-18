import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cronAuth";
import { ensureHistoricalWeekShardsForSelection } from "@/lib/performance/strategyPageData";
import { buildStrategySelectionKey, listVisibleStrategyBootstrapSelections } from "@/lib/performance/strategySelection";
import { listStrategyArtifactReadiness } from "@/lib/performance/strategyArtifactReadiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const CRON_ROUTE_BUDGET_MS = 100_000;
const CRON_SELECTION_BUDGET_MS = 20_000;

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
    const selectionStart = Date.now();
    const perSelectionBudgetMs = Math.min(
      CRON_SELECTION_BUDGET_MS,
      CRON_ROUTE_BUDGET_MS - elapsedMs,
    );
    try {
      const result = await ensureHistoricalWeekShardsForSelection(selection, {
        onlyPreviousWeek: false,
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
  });
}
