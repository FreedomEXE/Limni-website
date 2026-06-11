/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * One-shot backfill endpoint that re-scans ALL historical weeks using the
 * corrected ADR trade scanner. Triggered manually from Vercel Cron Jobs
 * dashboard. Skips the current week (handled by the regular hourly cron).
 * Calls scanWeekTrades directly — no HTTP sub-requests.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { DateTime } from "luxon";
import { NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/cronAuth";
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";
import { CANONICAL_WEEKS } from "@/lib/canonicalPriceWindows";
import { scanWeekTrades } from "@/lib/flagship/adrWeekScanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const currentWeek = getCanonicalWeekOpenUtc(DateTime.utc());
  const pastWeeks = CANONICAL_WEEKS.filter((w) => w !== currentWeek);

  const results: { week: string; status: string; trades: number; durationMs: number }[] = [];

  for (const week of pastWeeks) {
    const weekStart = Date.now();
    try {
      const result = await scanWeekTrades(week);
      results.push({
        week,
        status: `ok`,
        trades: result.totalTrades,
        durationMs: Date.now() - weekStart,
      });
    } catch (err) {
      results.push({
        week,
        status: `error: ${err instanceof Error ? err.message : "unknown"}`,
        trades: 0,
        durationMs: Date.now() - weekStart,
      });
    }
  }

  return NextResponse.json({
    status: "backfill complete",
    durationMs: Date.now() - startedAt,
    weeksProcessed: results.length,
    totalTrades: results.reduce((s, r) => s + r.trades, 0),
    currentWeekSkipped: currentWeek,
    results,
  });
}
