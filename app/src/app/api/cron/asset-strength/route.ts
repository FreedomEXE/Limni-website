/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Hourly cron endpoint that computes and stores crypto/commodity/index strength
 * snapshots for 1h/4h/24h windows.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/cronAuth";
import { computeAllAssetStrengths, writeAssetStrengthSnapshots } from "@/lib/assetStrength";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  try {
    const results = await computeAllAssetStrengths();
    const rowsWritten = await writeAssetStrengthSnapshots(results);

    return NextResponse.json({
      ok: true,
      task: "asset_strength",
      rows_written: rowsWritten,
      asset_classes: [...new Set(results.map((row) => row.assetClass))],
      windows: [...new Set(results.map((row) => row.window))],
      snapshot_time: results[0]?.snapshotTimeUtc ?? null,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Asset strength ingestion failed",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
