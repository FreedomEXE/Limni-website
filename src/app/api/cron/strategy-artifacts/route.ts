import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cronAuth";
import { loadStrategyPageData } from "@/lib/performance/strategyPageData";
import { buildStrategySelectionKey, listVisibleStrategyBootstrapSelections } from "@/lib/performance/strategySelection";
import { listStrategyArtifactReadiness } from "@/lib/performance/strategyArtifactReadiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const BURST_TIME_BUDGET_MS = 100_000;

function parseLimit(value: string | null) {
  const parsed = value ? Number.parseInt(value, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return Math.min(parsed, 10);
  const envLimit = Number.parseInt(process.env.STRATEGY_ARTIFACT_WARM_BATCH_SIZE ?? "", 10);
  if (Number.isFinite(envLimit) && envLimit > 0) return Math.min(envLimit, 10);
  return 2;
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const startedAtUtc = new Date().toISOString();
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "burst" ? "burst" : "normal";
  const limit = mode === "burst" ? null : parseLimit(url.searchParams.get("limit"));
  const onlyKey = url.searchParams.get("key");
  const selections = listVisibleStrategyBootstrapSelections()
    .filter((selection) => !onlyKey || buildStrategySelectionKey(selection) === onlyKey);
  const readiness = await listStrategyArtifactReadiness(selections);
  const notReady = readiness.filter((artifact) => !artifact.ready);
  const queued = mode === "burst" ? notReady : notReady.slice(0, limit ?? undefined);

  const warmed: Array<{
    key: string;
    label: string;
    ok: boolean;
    durationMs: number;
    status: string | null;
    error?: string;
  }> = [];
  let timedOut = false;

  for (const artifact of queued) {
    if (mode === "burst" && Date.now() - startedAt > BURST_TIME_BUDGET_MS) {
      timedOut = true;
      break;
    }
    const selection = selections.find((candidate) => buildStrategySelectionKey(candidate) === artifact.key);
    if (!selection) continue;
    const selectionStart = Date.now();
    try {
      const data = await loadStrategyPageData(selection, { includeCurrentWeek: false });
      warmed.push({
        key: artifact.key,
        label: artifact.label,
        ok: Boolean(data),
        durationMs: Date.now() - selectionStart,
        status: data?.artifactMeta?.status ?? null,
      });
    } catch (error) {
      warmed.push({
        key: artifact.key,
        label: artifact.label,
        ok: false,
        durationMs: Date.now() - selectionStart,
        status: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const after = await listStrategyArtifactReadiness(selections);
  return NextResponse.json({
    ok: !timedOut && warmed.every((item) => item.ok),
    task: "strategy_artifacts_warm",
    mode,
    timedOut,
    startedAtUtc,
    finishedAtUtc: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    limit,
    queued: queued.length,
    warmed,
    before: {
      ready: readiness.filter((artifact) => artifact.ready).length,
      total: readiness.length,
    },
    after: {
      ready: after.filter((artifact) => artifact.ready).length,
      total: after.length,
    },
  });
}
