/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Admin trigger for burst artifact warming after deploys or engine version
 * bumps.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = new URL(request.url).origin;
  const warmUrl = `${baseUrl}/api/cron/strategy-artifacts?mode=burst`;
  const headers: Record<string, string> = {};
  const authHeader = request.headers.get("authorization");
  const cronSecretHeader = request.headers.get("x-cron-secret");
  if (authHeader) {
    headers.authorization = authHeader;
  } else if (cronSecretHeader) {
    headers["x-cron-secret"] = cronSecretHeader;
  } else if (process.env.CRON_SECRET) {
    headers["x-cron-secret"] = process.env.CRON_SECRET;
  }

  const response = await fetch(warmUrl, { headers });
  const result = await response.json();
  return NextResponse.json({
    triggered: true,
    warmResult: result,
  }, { status: response.status });
}
