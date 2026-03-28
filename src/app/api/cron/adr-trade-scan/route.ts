/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Hourly cron that scans M5 candles for all directional signals and
 * detects ADR trades using the Fresh Start state machine. Writes
 * results to strategy_backtest_trades for the matrix to display.
 * Delegates to shared scanWeekTrades() for the actual work.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { DateTime } from "luxon";
import { NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/cronAuth";
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";
import { scanWeekTrades } from "@/lib/flagship/adrWeekScanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const nowUtc = DateTime.utc();
  const url = new URL(request.url);
  const weekOverride = url.searchParams.get("week");
  const weekOpenUtc = weekOverride ?? getCanonicalWeekOpenUtc(nowUtc);

  try {
    const result = await scanWeekTrades(weekOpenUtc);

    return NextResponse.json({
      status: "ok",
      durationMs: Date.now() - startedAt,
      weekOpenUtc,
      signalsProcessed: result.signalsProcessed,
      totalTrades: result.totalTrades,
      totalTpHits: result.totalTpHits,
      totalActive: result.totalActive,
      weekReturnPct: result.weekReturnPct,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ADR trade scan failed" },
      { status: 500 },
    );
  }
}
