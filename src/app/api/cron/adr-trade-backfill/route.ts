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
 * Calls the main adr-trade-scan endpoint for each past week sequentially.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { DateTime } from "luxon";
import { NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/cronAuth";
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";
import { CANONICAL_WEEKS } from "@/lib/canonicalPriceWindows";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — backfill can take a while

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const currentWeek = getCanonicalWeekOpenUtc(DateTime.utc());

  // All past weeks (exclude current — that's handled by the hourly cron)
  const pastWeeks = CANONICAL_WEEKS.filter((w) => w !== currentWeek);

  const results: { week: string; status: string; durationMs: number }[] = [];

  // Get the cron secret to forward to the scan endpoint
  const secret = process.env.CRON_SECRET ?? "";
  const baseUrl = new URL(request.url);
  const origin = baseUrl.origin;

  for (const week of pastWeeks) {
    const weekStart = Date.now();
    try {
      const scanUrl = `${origin}/api/cron/adr-trade-scan?week=${encodeURIComponent(week)}&secret=${encodeURIComponent(secret)}`;
      const resp = await fetch(scanUrl, { method: "GET" });
      const body = await resp.json().catch(() => ({}));
      results.push({
        week,
        status: resp.ok ? `ok (${(body as Record<string, unknown>).totalTrades ?? "?"} trades)` : `error ${resp.status}`,
        durationMs: Date.now() - weekStart,
      });
    } catch (err) {
      results.push({
        week,
        status: `failed: ${err instanceof Error ? err.message : "unknown"}`,
        durationMs: Date.now() - weekStart,
      });
    }
  }

  return NextResponse.json({
    status: "backfill complete",
    durationMs: Date.now() - startedAt,
    weeksProcessed: results.length,
    currentWeekSkipped: currentWeek,
    results,
  });
}
