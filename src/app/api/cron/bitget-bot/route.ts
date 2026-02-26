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

export const dynamic = "force-dynamic";
export const maxDuration = 55;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return true;
  }
  const headerSecret = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("authorization");
  const vercelCron = request.headers.get("x-vercel-cron");
  const bearerSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  return (
    headerSecret === secret ||
    querySecret === secret ||
    bearerSecret === secret ||
    vercelCron === "1"
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
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
