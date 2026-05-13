import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cronAuth";
import { buildStrategyArtifact } from "@/lib/performance/strategyPageData";
import {
  normalizeFilterSelection,
  resolveStrategyId,
} from "@/lib/performance/strategyConfig";
import { buildStrategySelectionKey } from "@/lib/performance/strategySelection";

export const dynamic = "force-dynamic";

type WarmRequest = {
  strategy?: string;
  f1?: string;
  f2?: string;
};

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as WarmRequest;
  const normalizedFilters = normalizeFilterSelection({
    f1: body.f1,
    f2: body.f2,
  });
  const selection = {
    strategyId: resolveStrategyId(body.strategy),
    f1: normalizedFilters.f1,
    f2: normalizedFilters.f2,
  };
  const selectionKey = buildStrategySelectionKey(selection);
  const startedAt = Date.now();
  const result = await buildStrategyArtifact(selection);

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        selectionKey,
        durationMs: Date.now() - startedAt,
        error: "Strategy data unavailable",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    selectionKey,
    durationMs: Date.now() - startedAt,
    artifactMeta: result.artifactMeta,
    weeks: result.weeks,
    trades: result.trades,
  });
}
