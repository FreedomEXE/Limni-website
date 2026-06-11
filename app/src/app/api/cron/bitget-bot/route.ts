/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Authenticated cron endpoint for Bitget Bot v2 DRY_RUN/live engine ticks.
 * Enforces feature flags and returns per-tick execution diagnostics.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse } from "next/server";
import { tick } from "@/lib/bitgetBotEngine";
import { getBitgetEnv } from "@/lib/bitgetTrade";
import { isCronAuthorized } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (String(process.env.BITGET_BOT_ENABLED ?? "false").toLowerCase() !== "true") {
    return NextResponse.json(
      {
        ok: true,
        lifecycle: "IDLE",
        transitions: ["SKIP: BITGET_BOT_ENABLED=false"],
        positions: [],
        dryRun: String(process.env.BITGET_BOT_DRY_RUN ?? "true").toLowerCase() !== "false",
        env: getBitgetEnv(),
        errors: [],
        tickDurationMs: 0,
      },
      { status: 200 },
    );
  }

  const result = await tick();
  return NextResponse.json({ ...result, env: getBitgetEnv() }, { status: result.ok ? 200 : 503 });
}
