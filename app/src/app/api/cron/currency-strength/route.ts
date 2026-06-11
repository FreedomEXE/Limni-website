/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Hourly cron endpoint that computes and stores currency strength snapshots
 * for the 8 major currencies across 1h/4h/24h windows.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/cronAuth";
import { computeAllCurrencyStrengths, writeCurrencyStrengthSnapshots } from "@/lib/currencyStrength";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  try {
    const results = await computeAllCurrencyStrengths();
    const rowsWritten = await writeCurrencyStrengthSnapshots(results);

    return NextResponse.json({
      ok: true,
      rows_written: rowsWritten,
      windows: results.map((row) => row.window),
      snapshot_time: results[0]?.snapshotTimeUtc ?? null,
      started_at: startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Currency strength ingestion failed",
        started_at: startedAt,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}

