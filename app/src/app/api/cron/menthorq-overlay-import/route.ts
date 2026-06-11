/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Cron endpoint to import MenthorQ daily browser-capture CSV rows
 * into DB-backed overlay snapshots.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/cronAuth";
import { importMenthorqDailyCsv } from "@/lib/menthorqOverlay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  try {
    const url = new URL(request.url);
    const targetDateUtc = url.searchParams.get("date")?.trim() || undefined;
    const csvPath = url.searchParams.get("csv")?.trim() || undefined;

    const result = await importMenthorqDailyCsv({
      csvPath,
      targetDateUtc,
    });

    return NextResponse.json({
      ok: true,
      task: "menthorq_overlay_import",
      snapshot_date_utc: result.snapshotDateUtc,
      rows_parsed: result.rowsParsed,
      rows_upserted: result.rowsUpserted,
      symbols: result.symbols,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        task: "menthorq_overlay_import",
        error: error instanceof Error ? error.message : "MenthorQ overlay import failed",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
