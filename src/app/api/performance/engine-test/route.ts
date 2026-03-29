/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Test endpoint to verify the strategy engine returns correct data.
 * Hit /api/performance/engine-test?f2=adr_pullback&week=2026-03-15T23:00:00.000Z
 * to confirm ADR data flows through.
 * DELETE THIS FILE once engine is verified working.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextRequest, NextResponse } from "next/server";
import { computeWeeklyHold } from "@/lib/performance/weeklyHoldEngine";
import { getStrategy, resolveStrategyId, resolveIntradayFilterId, getIntradayFilter } from "@/lib/performance/strategyConfig";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const strategyId = resolveStrategyId(searchParams.get("strategy") ?? searchParams.get("bias"));
  const strategy = getStrategy(strategyId)!;
  const f2Id = resolveIntradayFilterId(searchParams.get("f2"));
  const intradayFilter = getIntradayFilter(f2Id);
  const weekOpenUtc = searchParams.get("week") ?? "2026-03-15T23:00:00.000Z";

  console.log(`[engine-test] strategy=${strategyId}, f2=${f2Id}, plModel=${intradayFilter?.plModel}, week=${weekOpenUtc}`);

  try {
    const result = await computeWeeklyHold(strategy, weekOpenUtc, intradayFilter);
    return NextResponse.json({
      params: { strategy: strategyId, f2: f2Id, plModel: intradayFilter?.plModel ?? "weekly_hold", week: weekOpenUtc },
      result: {
        tradeCount: result.tradeCount,
        totalReturnPct: result.totalReturnPct,
        winCount: result.winCount,
        lossCount: result.lossCount,
        winRate: result.winRate,
        sampleTrades: result.trades.slice(0, 5).map((t) => ({
          symbol: t.symbol,
          direction: t.direction,
          returnPct: t.returnPct,
          assetClass: t.assetClass,
          source: t.source,
          tier: t.tier,
        })),
        sourceBreakdown: Object.fromEntries(
          [...result.trades.reduce((m, t) => { m.set(t.source, (m.get(t.source) || 0) + 1); return m; }, new Map<string, number>()).entries()]
        ),
        tierBreakdown: Object.fromEntries(
          [...result.trades.reduce((m, t) => { const k = t.tier ?? "null"; m.set(k, (m.get(k) || 0) + 1); return m; }, new Map<string | number, number>()).entries()]
        ),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Engine failed", stack: err instanceof Error ? err.stack : undefined },
      { status: 500 },
    );
  }
}
