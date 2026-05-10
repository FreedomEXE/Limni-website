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
  getStrengthGate,
  normalizeFilterSelection,
  resolveBiasSourceId,
} from "@/lib/performance/strategyConfig";
import { weeklyHoldToSidebarStatsWithPath } from "@/lib/performance/engineAdapter";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import { listDataSectionWeeks } from "@/lib/dataSectionWeeks";
import { buildDataWeekOptions } from "@/lib/weekOptions";
import { buildWeeklyHoldLedger } from "@/lib/performance/positionLedger";
import { loadPathBars } from "@/lib/performance/pathBarLoader";
import {
  computeBasketPath,
  computeMultiWeekBasketPath,
  type BasketPathResult,
  type BasketPathSummary,
} from "@/lib/performance/basketPathEngine";
import { CANONICAL_PATH_RESOLUTION } from "@/lib/performance/pathResolution";

export const dynamic = "force-dynamic";

async function computePathSummaryForWeek(result: Awaited<ReturnType<typeof computeWeeklyHold>>) {
  const ledger = await buildWeeklyHoldLedger(result);
  const symbols = ledger.legs.map((leg) => leg.symbol);
  const bars = await loadPathBars(
    symbols,
    ledger.weekOpenUtc,
    ledger.weekCloseUtc,
    CANONICAL_PATH_RESOLUTION,
  );
  return computeBasketPath(ledger, bars);
}

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
  const riskOverlay = getStrengthGate(normalizedFilters.f2);

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const weekOpenUtc = searchParams.get("week") ?? currentWeekOpenUtc;

  try {
    // Single-week computation
    const result = await computeWeeklyHold(biasSource, weekOpenUtc, entryStyle, riskOverlay);

    // Multi-week computation for all-time stats
    const dataSectionWeeks = await listDataSectionWeeks();
    const weekOptions = buildDataWeekOptions({
      historicalWeeks: dataSectionWeeks,
      currentWeekOpenUtc,
    }) as string[];
    const multiWeek = await computeMultiWeekHold(biasSource, weekOptions, entryStyle, riskOverlay);

    const currentWeekPath = await computePathSummaryForWeek(result);
    const realizedWeekPaths: BasketPathResult[] = [];
    for (const weekResult of multiWeek.weeks) {
      realizedWeekPaths.push(await computePathSummaryForWeek(weekResult));
    }
    const multiWeekPath = realizedWeekPaths.length > 0
      ? computeMultiWeekBasketPath(realizedWeekPaths)
      : {
          points: [],
          summary: {
            totalReturnPct: multiWeek.totalReturnPct,
            peakPct: multiWeek.totalReturnPct,
            troughPct: Math.min(0, multiWeek.totalReturnPct),
            maxDrawdownPct: multiWeek.maxDrawdownPct,
            peakToCloseGivebackPct: 0,
            troughToCloseRecoveryPct: multiWeek.totalReturnPct - Math.min(0, multiWeek.totalReturnPct),
            maxActivePositions: 0,
          } satisfies BasketPathSummary,
        };

    const stats = weeklyHoldToSidebarStatsWithPath(result, biasSource, {
      multiWeek,
      currentWeekPathSummary: currentWeekPath.summary,
      multiWeekPathSummary: multiWeekPath.summary,
    });
    return NextResponse.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Engine computation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
