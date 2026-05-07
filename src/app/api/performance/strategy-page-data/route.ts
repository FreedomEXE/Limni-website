import { NextRequest, NextResponse } from "next/server";
import { loadStrategyPageData } from "@/lib/performance/strategyPageData";
import { getEntryStyle, getStrengthGate, normalizeFilterSelection, resolveStrategyId } from "@/lib/performance/strategyConfig";
import { buildStrategySelectionKey } from "@/lib/performance/strategySelection";
import { readStrategyArtifactEntry } from "@/lib/performance/strategyArtifactCache";
import { buildStrategyArtifactEngineVersion } from "@/lib/performance/strategyArtifactVersions";
import {
  toMatrixClientPayload,
  toPerformanceClientPayload,
} from "@/lib/performance/strategyClientPayload";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const strategyId = resolveStrategyId(searchParams.get("strategy") ?? searchParams.get("bias"));
  const normalizedFilters = normalizeFilterSelection({
    f1: searchParams.get("f1"),
    f2: searchParams.get("f2"),
  });
  const scope = searchParams.get("scope") === "matrix" ? "matrix" : "performance";
  const entryStyle = getEntryStyle(normalizedFilters.f1);
  const riskOverlay = getStrengthGate(normalizedFilters.f2);
  const selection = {
    strategyId,
    f1: normalizedFilters.f1,
    f2: normalizedFilters.f2,
  };

  try {
    if (entryStyle?.plModel === "adr_grid") {
      const selectionKey = buildStrategySelectionKey(selection);
      const cached = await readStrategyArtifactEntry(selectionKey);
      const expectedEngineVersion = buildStrategyArtifactEngineVersion({ entryStyle, riskOverlay });
      if (!cached || cached.fingerprint.engineVersion !== expectedEngineVersion) {
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
    }

    const data = await loadStrategyPageData(selection);

    if (!data) {
      return NextResponse.json({ error: "Strategy data unavailable" }, { status: 404 });
    }

    return NextResponse.json(
      scope === "matrix"
        ? toMatrixClientPayload(data)
        : toPerformanceClientPayload(data),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load strategy data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
