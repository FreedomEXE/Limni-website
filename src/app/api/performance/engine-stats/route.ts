/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * API route returning engine stats for the Performance sidebar.
 * Accepts ?bias=, ?f1=, ?f2=, and ?week= params. Returns single-week stats plus
 * multi-week aggregate (drawdown, Sharpe, profit factor, etc.).
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextRequest, NextResponse } from "next/server";
import { computeWeeklyHold, computeMultiWeekHold } from "@/lib/performance/weeklyHoldEngine";
import {
  getBiasSource,
  getEntryStyle,
  normalizeFilterSelection,
  resolveBiasSourceId,
} from "@/lib/performance/strategyConfig";
import { weeklyHoldToSidebarStats } from "@/lib/performance/engineAdapter";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import { listDataSectionWeeks } from "@/lib/dataSectionWeeks";
import { buildDataWeekOptions } from "@/lib/weekOptions";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const biasSourceId = resolveBiasSourceId(searchParams.get("bias"));
  const biasSource = getBiasSource(biasSourceId);
  if (!biasSource) {
    return NextResponse.json({ error: "Unknown bias source" }, { status: 400 });
  }

  const normalizedFilters = normalizeFilterSelection({
    f1: searchParams.get("f1"),
    f2: searchParams.get("f2"),
  });
  const entryStyle = getEntryStyle(normalizedFilters.f1);

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const weekOpenUtc = searchParams.get("week") ?? currentWeekOpenUtc;

  try {
    // Single-week computation
    const result = await computeWeeklyHold(biasSource, weekOpenUtc, entryStyle);

    // Multi-week computation for all-time stats
    const dataSectionWeeks = await listDataSectionWeeks();
    const weekOptions = buildDataWeekOptions({
      historicalWeeks: dataSectionWeeks,
      currentWeekOpenUtc,
    }) as string[];
    const multiWeek = await computeMultiWeekHold(biasSource, weekOptions, entryStyle);

    const stats = weeklyHoldToSidebarStats(result, biasSource, multiWeek);
    return NextResponse.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Engine computation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
