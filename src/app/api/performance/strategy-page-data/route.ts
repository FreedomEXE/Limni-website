import { NextRequest, NextResponse } from "next/server";
import { normalizeFilterSelection, resolveStrategyId } from "@/lib/performance/strategyConfig";
import { buildStrategySelectionKey } from "@/lib/performance/strategySelection";
import {
  readReadyStrategyArtifactPayload,
} from "@/lib/performance/strategyArtifactReadiness";
import {
  toStrategyClientPayload,
} from "@/lib/performance/strategyClientPayload";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const strategyId = resolveStrategyId(searchParams.get("strategy") ?? searchParams.get("bias"));
  const normalizedFilters = normalizeFilterSelection({
    f1: searchParams.get("f1"),
    f2: searchParams.get("f2"),
  });
  const selection = {
    strategyId,
    f1: normalizedFilters.f1,
    f2: normalizedFilters.f2,
  };

  try {
    const selectionKey = buildStrategySelectionKey(selection);
    const data = await readReadyStrategyArtifactPayload(selection);
    if (!data) {
      return NextResponse.json({
        engineWeekMap: null,
        engineSimMap: null,
        engineWeekResults: null,
        sidebarStats: null,
        artifactMeta: {
          status: "miss",
          selectionKey,
          cachedAtUtc: null,
          refreshedWeeks: [],
          removedWeeks: [],
          missingWeeks: [],
        },
      });
    }

    return NextResponse.json(
      toStrategyClientPayload(data),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load strategy data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
