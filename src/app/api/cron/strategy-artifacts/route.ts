import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cronAuth";
import { buildStrategyArtifact } from "@/lib/performance/strategyPageData";
import { buildStrategySelectionKey, listVisibleStrategyBootstrapSelections } from "@/lib/performance/strategySelection";
import { listStrategyArtifactReadiness } from "@/lib/performance/strategyArtifactReadiness";
import { pruneAllOldWeekShards } from "@/lib/performance/strategyWeekShardCache";
import { buildStrategyArtifactEngineVersion } from "@/lib/performance/strategyArtifactVersions";
import { ENTRY_STYLE_FILTERS, STRENGTH_GATES } from "@/lib/performance/strategyConfig";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const BURST_TIME_BUDGET_MS = 100_000;
const AUTO_BURST_MIN_STALE_WEEK_COUNT = 10;
const AUTO_BURST_STALE_WEEK_RATIO = 0.6;

function parseLimit(value: string | null) {
  const parsed = value ? Number.parseInt(value, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return Math.min(parsed, 10);
  const envLimit = Number.parseInt(process.env.STRATEGY_ARTIFACT_WARM_BATCH_SIZE ?? "", 10);
  if (Number.isFinite(envLimit) && envLimit > 0) return Math.min(envLimit, 10);
  return 5;
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const startedAtUtc = new Date().toISOString();
  const url = new URL(request.url);
  const requestedMode = url.searchParams.get("mode") === "burst" ? "burst" : "normal";
  const onlyKey = url.searchParams.get("key");
  const selections = listVisibleStrategyBootstrapSelections()
    .filter((selection) => !onlyKey || buildStrategySelectionKey(selection) === onlyKey);
  const readiness = await listStrategyArtifactReadiness(selections);
  const notReady = readiness.filter((artifact) => !artifact.ready);
  const staleWeekCount = notReady.filter((artifact) => artifact.reason === "stale_week").length;
  const autoBurst =
    !onlyKey &&
    requestedMode !== "burst" &&
    staleWeekCount >= AUTO_BURST_MIN_STALE_WEEK_COUNT &&
    staleWeekCount / Math.max(notReady.length, 1) >= AUTO_BURST_STALE_WEEK_RATIO;
  const mode = requestedMode === "burst" || autoBurst ? "burst" : "normal";
  const limit = mode === "burst" ? null : parseLimit(url.searchParams.get("limit"));
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
      const result = await buildStrategyArtifact(selection);
      warmed.push({
        key: artifact.key,
        label: artifact.label,
        ok: result.ok,
        durationMs: Date.now() - selectionStart,
        status: result.artifactMeta?.status ?? null,
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
  let prunedOldShards = 0;
  if (!onlyKey && after.length > 0 && after.every((artifact) => artifact.ready)) {
    const currentVersions = new Set<string>();
    for (const entryStyle of ENTRY_STYLE_FILTERS) {
      for (const riskOverlay of STRENGTH_GATES) {
        currentVersions.add(
          buildStrategyArtifactEngineVersion({
            entryStyle,
            riskOverlay,
          }),
        );
      }
    }
    prunedOldShards = await pruneAllOldWeekShards([...currentVersions]);
    if (prunedOldShards > 0) {
      console.log(`[strategy-artifacts] Pruned ${prunedOldShards} old-version week shards`);
    }
  }

  return NextResponse.json({
    ok: !timedOut && warmed.every((item) => item.ok),
    task: "strategy_artifacts_warm",
    mode,
    requestedMode,
    autoBurst,
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
      staleWeek: staleWeekCount,
    },
    after: {
      ready: after.filter((artifact) => artifact.ready).length,
      total: after.length,
    },
    prunedOldShards,
  });
}
