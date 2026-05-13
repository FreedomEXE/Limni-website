/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: request-bulk-warm/route.ts
 *
 * Description:
 * Authenticated bulk artifact warmer for the visible strategy manifest.
 * The page loading gate uses this to build missing artifacts in one server
 * request instead of issuing one browser request per strategy selection.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { buildStrategyArtifact } from "@/lib/performance/strategyPageData";
import {
  buildStrategySelectionKey,
  listVisibleStrategyBootstrapSelections,
} from "@/lib/performance/strategySelection";
import { listStrategyArtifactReadiness } from "@/lib/performance/strategyArtifactReadiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const BULK_TIME_BUDGET_MS = 100_000;

export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const selections = listVisibleStrategyBootstrapSelections();
  const readiness = await listStrategyArtifactReadiness(selections);
  const pending = readiness.filter((artifact) => !artifact.ready);
  const warmed: Array<{
    key: string;
    label: string;
    ok: boolean;
    reason: string;
    durationMs: number;
    error?: string;
  }> = [];
  let timedOut = false;

  for (const artifact of pending) {
    if (Date.now() - startedAt > BULK_TIME_BUDGET_MS) {
      timedOut = true;
      break;
    }

    const selection = selections.find((candidate) => buildStrategySelectionKey(candidate) === artifact.key);
    if (!selection) {
      warmed.push({
        key: artifact.key,
        label: artifact.label,
        ok: false,
        reason: artifact.reason,
        durationMs: 0,
        error: "Selection no longer exists in visible manifest",
      });
      continue;
    }

    const selectionStartedAt = Date.now();
    try {
      const result = await buildStrategyArtifact(selection);
      warmed.push({
        key: artifact.key,
        label: artifact.label,
        ok: result.ok,
        reason: artifact.reason,
        durationMs: Date.now() - selectionStartedAt,
      });
    } catch (error) {
      warmed.push({
        key: artifact.key,
        label: artifact.label,
        ok: false,
        reason: artifact.reason,
        durationMs: Date.now() - selectionStartedAt,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const after = await listStrategyArtifactReadiness(selections);
  const failed = warmed.filter((artifact) => !artifact.ok);

  return NextResponse.json({
    ok: failed.length === 0,
    timedOut,
    durationMs: Date.now() - startedAt,
    before: {
      ready: readiness.filter((artifact) => artifact.ready).length,
      total: readiness.length,
    },
    after: {
      ready: after.filter((artifact) => artifact.ready).length,
      total: after.length,
    },
    warmed,
    failed,
  });
}
