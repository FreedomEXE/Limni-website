/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Cron endpoint to lock daily sentiment snapshots from sentiment_aggregates.
 * This is additive and does not alter weekly sentiment behavior.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/cronAuth";
import { buildDailySentimentLock, writeDailySentimentLock } from "@/lib/sentiment/daily";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  try {
    const url = new URL(request.url);
    const asOf = url.searchParams.get("asOf") ?? undefined;

    const { snapshotDateUtc, rows } = await buildDailySentimentLock(asOf);
    const rowsLocked = await writeDailySentimentLock(snapshotDateUtc, rows);

    return NextResponse.json({
      ok: true,
      task: "sentiment_daily_lock",
      snapshot_date_utc: snapshotDateUtc,
      rows_locked: rowsLocked,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        task: "sentiment_daily_lock",
        error: error instanceof Error ? error.message : "Daily sentiment lock failed",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
