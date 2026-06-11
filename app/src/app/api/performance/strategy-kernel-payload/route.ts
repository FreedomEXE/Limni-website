import { NextRequest, NextResponse } from "next/server";
import { normalizeFilterSelection, resolveStrategyId } from "@/lib/performance/strategyConfig";
import { buildStrategySelectionKey } from "@/lib/performance/strategySelection";
import { loadStrategyPageData, type StrategyHistoryWindow } from "@/lib/performance/strategyPageData";
import { toStrategyClientPayload } from "@/lib/performance/strategyClientPayload";
import {
  ACTIVE_BASELINE_PERFORMANCE_HISTORY_WINDOW,
  ACTIVE_BASELINE_SEED_HISTORY_WINDOW,
} from "@/lib/appTruth/activeBaseline";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const strategyId = resolveStrategyId(searchParams.get("strategy") ?? searchParams.get("bias"));
  const normalizedFilters = normalizeFilterSelection({
    f1: searchParams.get("f1"),
    f2: searchParams.get("f2"),
  });
  const scope = searchParams.get("scope") === "matrix"
    ? "matrix"
    : searchParams.get("scope") === "full"
      ? "full"
      : "performance";
  const repairAllMissingWeeks =
    searchParams.get("repair") === "1" ||
    searchParams.get("repair") === "true";
  const historyWindow: StrategyHistoryWindow =
    searchParams.get("history") === "all-data-section" ||
    searchParams.get("window") === "all-data-section"
      ? "data-section"
      : searchParams.get("history") === "seed-window" ||
          searchParams.get("window") === ACTIVE_BASELINE_SEED_HISTORY_WINDOW ||
          searchParams.get("history") === "v2.0.3-clean14" ||
          searchParams.get("window") === "v2.0.3-clean14" ||
          searchParams.get("history") === "clean14" ||
          searchParams.get("window") === "clean14"
        ? ACTIVE_BASELINE_SEED_HISTORY_WINDOW
        : ACTIVE_BASELINE_PERFORMANCE_HISTORY_WINDOW;
  const selection = {
    strategyId,
    f1: normalizedFilters.f1,
    f2: normalizedFilters.f2,
  };

  try {
    const selectionKey = buildStrategySelectionKey(selection);
    const data = await loadStrategyPageData(selection, {
      includeCurrentWeek: false,
      repairAllMissingWeeks,
      historyWindow,
    });
    if (!data) {
      return NextResponse.json(
        {
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
        },
        {
          headers: {
            "X-Limni-Strategy-Payload-Source": "kernel-week-shards",
          },
        },
      );
    }

    return NextResponse.json(
      toStrategyClientPayload(data, scope),
      {
        headers: {
          "X-Limni-Strategy-Payload-Source": "kernel-week-shards",
          "X-Limni-Strategy-Selection": selectionKey,
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load strategy kernel data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
