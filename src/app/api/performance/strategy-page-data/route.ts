import { NextRequest, NextResponse } from "next/server";
import { loadStrategyPageData } from "@/lib/performance/strategyPageData";
import { normalizeFilterSelection, resolveStrategyId } from "@/lib/performance/strategyConfig";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const strategyId = resolveStrategyId(searchParams.get("strategy") ?? searchParams.get("bias"));
  const normalizedFilters = normalizeFilterSelection({
    f1: searchParams.get("f1"),
    f2: searchParams.get("f2"),
  });

  try {
    const data = await loadStrategyPageData({
      strategyId,
      f1: normalizedFilters.f1,
      f2: normalizedFilters.f2,
    });

    if (!data) {
      return NextResponse.json({ error: "Strategy data unavailable" }, { status: 404 });
    }

    return NextResponse.json({
      engineWeekMap: data.weekMap ?? null,
      engineSimMap: data.simMap ?? null,
      engineWeekResults: data.weekResults ?? null,
      sidebarStats: data.sidebarStats ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load strategy data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
