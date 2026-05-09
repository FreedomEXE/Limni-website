/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: request-warm/route.ts
 *
 * Description:
 * Authenticated on-demand artifact warmer for the exact strategy
 * selection a user opens when the persisted artifact is missing.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { loadStrategyPageData } from "@/lib/performance/strategyPageData";
import { normalizeFilterSelection, resolveStrategyId } from "@/lib/performance/strategyConfig";
import {
  buildStrategySelectionKey,
  type StrategyBootstrapSelection,
} from "@/lib/performance/strategySelection";
import { getStrategyArtifactReadiness } from "@/lib/performance/strategyArtifactReadiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

type WarmRequest = {
  strategy?: string | null;
  f1?: string | null;
  f2?: string | null;
};

function parseWarmRequest(value: unknown): WarmRequest {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  return {
    strategy: typeof record.strategy === "string" ? record.strategy : null,
    f1: typeof record.f1 === "string" ? record.f1 : null,
    f2: typeof record.f2 === "string" ? record.f2 : null,
  };
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = parseWarmRequest(await request.json().catch(() => null));
  const normalizedFilters = normalizeFilterSelection({
    f1: body.f1,
    f2: body.f2,
  });
  const selection: StrategyBootstrapSelection = {
    strategyId: resolveStrategyId(body.strategy),
    f1: normalizedFilters.f1,
    f2: normalizedFilters.f2,
  };
  const selectionKey = buildStrategySelectionKey(selection);
  const before = await getStrategyArtifactReadiness(selection);

  if (before.ready) {
    return NextResponse.json({
      ok: true,
      selectionKey,
      status: "already_ready",
      before,
      after: before,
      durationMs: 0,
    });
  }

  const startedAt = Date.now();
  const data = await loadStrategyPageData(selection);
  const after = await getStrategyArtifactReadiness(selection);

  return NextResponse.json({
    ok: Boolean(data) || after.ready,
    selectionKey,
    status: data?.artifactMeta?.status ?? (after.ready ? "ready" : "failed"),
    before,
    after,
    durationMs: Date.now() - startedAt,
  });
}
