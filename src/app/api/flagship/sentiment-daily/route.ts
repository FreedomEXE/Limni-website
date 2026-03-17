/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Read API for Flagship daily sentiment locks.
 * Supports latest snapshot, by-date snapshot, and per-symbol history.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse } from "next/server";

import {
  readDailySentimentHistory,
  readDailySentimentLockByDate,
  readLatestDailySentimentLock,
} from "@/lib/sentiment/daily";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const symbol = url.searchParams.get("symbol")?.trim().toUpperCase() ?? "";
    const daysBack = Number(url.searchParams.get("daysBack") ?? "14");

    if (symbol) {
      const history = await readDailySentimentHistory(symbol, daysBack);
      return NextResponse.json({ symbol, daysBack, rows: history });
    }

    if (date) {
      const rows = await readDailySentimentLockByDate(date);
      return NextResponse.json({ snapshotDateUtc: date, rows });
    }

    const latest = await readLatestDailySentimentLock();
    if (!latest) {
      return NextResponse.json({ snapshotDateUtc: null, rows: [] });
    }

    return NextResponse.json(latest);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to read daily sentiment lock",
      },
      { status: 500 },
    );
  }
}
