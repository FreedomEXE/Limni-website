/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Read API for Flagship sentiment — returns WEEKLY sentiment locked at week open.
 * Uses the latest sentiment_aggregates snapshot at or before the current week open.
 * This ensures all sections use the same weekly sentiment that was backtested.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse } from "next/server";
import { DateTime } from "luxon";

import { buildDailySentimentLock } from "@/lib/sentiment/daily";
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    // Allow override for debugging, but default to week open
    const asOf = url.searchParams.get("asOf");

    // Lock sentiment at the current week open (Sunday 19:00 ET → UTC)
    const weekOpenUtc = asOf ?? getCanonicalWeekOpenUtc(DateTime.utc());

    // buildDailySentimentLock with asOf = week open gives us the latest
    // sentiment per symbol at or before the week started — exactly what
    // the backtests used.
    const result = await buildDailySentimentLock(weekOpenUtc);

    return NextResponse.json({
      ...result,
      sourceMode: "WEEKLY_LOCK_AT_OPEN",
      weekOpenUtc,
    });
  } catch (error) {
    return NextResponse.json({
      snapshotDateUtc: null,
      rows: [],
      warning: error instanceof Error ? error.message : "Failed to read weekly sentiment",
    });
  }
}
