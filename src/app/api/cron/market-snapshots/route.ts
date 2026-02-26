/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Hourly cron endpoint for collection-only market snapshots
 * (funding rates, open interest, and liquidation summaries).
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/cronAuth";
import { collectAllSnapshots } from "@/lib/marketSnapshots";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  try {
    const result = await collectAllSnapshots();

    return NextResponse.json({
      ok: true,
      counts: {
        funding: result.funding,
        oi: result.oi,
        liquidation: result.liquidation,
      },
      errors: result.errors,
      started_at: startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        ok: false,
        counts: { funding: 0, oi: 0, liquidation: 0 },
        errors: [message],
        started_at: startedAt,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
