/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
import { NextResponse } from "next/server";
import { readMt5AccountCount, readStaleAccounts } from "@/lib/mt5Store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [totalAccounts, staleAccounts] = await Promise.all([
      readMt5AccountCount(),
      readStaleAccounts(5),
    ]);

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      routes: {
        baskets: "/api/cot/baskets/latest",
        mt5Push: "/api/mt5/push",
      },
      mt5: {
        total_accounts: totalAccounts,
        stale_accounts: staleAccounts,
        healthy: staleAccounts.length === 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "degraded",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}
