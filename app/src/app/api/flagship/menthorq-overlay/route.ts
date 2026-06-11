/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Read API for MenthorQ overlay snapshots.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse } from "next/server";

import {
  readLatestMenthorqSnapshots,
  readMenthorqHistory,
  readMenthorqSnapshotsByDate,
} from "@/lib/menthorqOverlay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const symbol = url.searchParams.get("symbol")?.trim().toUpperCase() ?? "";
    const daysBack = Number(url.searchParams.get("daysBack") ?? "14");

    if (symbol) {
      const rows = await readMenthorqHistory(symbol, daysBack);
      return NextResponse.json({ symbol, daysBack, rows });
    }

    if (date) {
      const rows = await readMenthorqSnapshotsByDate(date);
      return NextResponse.json({ snapshotDateUtc: date, rows });
    }

    const latest = await readLatestMenthorqSnapshots();
    if (!latest) {
      return NextResponse.json({ snapshotDateUtc: null, rows: [] });
    }
    return NextResponse.json(latest);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to read MenthorQ overlay",
      },
      { status: 500 },
    );
  }
}
