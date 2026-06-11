/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { clearAllStrategyArtifactEntries } from "@/lib/performance/strategyArtifactCache";
import { clearRuntimeCacheByPrefix } from "@/lib/runtimeCache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const token = request.headers.get("x-admin-token") ?? "";
    const expectedToken = process.env.ADMIN_API_TOKEN ?? process.env.ADMIN_TOKEN ?? "";

    if (!expectedToken || token !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await query("DELETE FROM strategy_artifacts", []);
    clearAllStrategyArtifactEntries();
    clearRuntimeCacheByPrefix("selectorEngine");

    return NextResponse.json({
      flushed: true,
      message: "Strategy artifact cache flushed",
    });
  } catch (error) {
    console.error("Error flushing strategy artifact cache:", error);
    return NextResponse.json(
      { error: "Failed to flush strategy artifact cache" },
      { status: 500 },
    );
  }
}
