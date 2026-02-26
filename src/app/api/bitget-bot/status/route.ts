/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Public read-only status endpoint for the Bitget Bot v2 dashboard.
 * Returns bot state, recent execution artifacts, and market snapshot
 * series used by the monitoring UI.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse } from "next/server";
import { readBitgetBotStatusData } from "@/lib/bitgetBotDashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await readBitgetBotStatusData();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error(
      "[api/bitget-bot/status] unexpected failure:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      {
        botState: null,
        trades: [],
        signals: [],
        ranges: [],
        marketData: { oi: [], funding: [], liquidation: [] },
        fetchedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }
}
