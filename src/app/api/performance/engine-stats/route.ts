/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * API route returning weekly hold engine stats for the Performance sidebar.
 * Accepts ?bias= and ?week= params. Returns lightweight summary stats
 * computed by the weeklyHoldEngine, adapted for sidebar display.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextRequest, NextResponse } from "next/server";
import { computeWeeklyHold } from "@/lib/performance/weeklyHoldEngine";
import { getBiasSource, resolveBiasSourceId } from "@/lib/performance/strategyConfig";
import { weeklyHoldToSidebarStats } from "@/lib/performance/engineAdapter";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const biasSourceId = resolveBiasSourceId(searchParams.get("bias"));
  const biasSource = getBiasSource(biasSourceId);
  if (!biasSource) {
    return NextResponse.json({ error: "Unknown bias source" }, { status: 400 });
  }

  const weekOpenUtc = searchParams.get("week") ?? getDisplayWeekOpenUtc();

  try {
    const result = await computeWeeklyHold(biasSource, weekOpenUtc);
    const stats = weeklyHoldToSidebarStats(result, biasSource);
    return NextResponse.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Engine computation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
