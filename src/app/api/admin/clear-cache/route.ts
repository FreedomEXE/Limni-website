import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { clearRuntimeCacheAll, clearRuntimeCacheByPrefix } from "@/lib/runtimeCache";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // Check admin token
    const token = request.headers.get("x-admin-token") ?? "";
    const expectedToken = process.env.ADMIN_TOKEN ?? "";

    if (!expectedToken || token !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("week");
    const assetClass = searchParams.get("asset");

    if (!weekStart || !assetClass) {
      return NextResponse.json(
        { error: "Missing week or asset query parameters" },
        { status: 400 }
      );
    }

    console.log(`Clearing cache for ${assetClass} week ${weekStart}...`);

    const result = await query<{ week_open_utc: string; asset_class: string }>(
      `DELETE FROM market_snapshots
       WHERE week_open_utc >= $1
       AND week_open_utc < $1::timestamp + interval '7 days'
       AND asset_class = $2
       RETURNING week_open_utc, asset_class`,
      [weekStart, assetClass]
    );

    clearRuntimeCacheByPrefix(`priceStore:${assetClass}:`);
    clearRuntimeCacheByPrefix("performanceSnapshots:");
    clearRuntimeCacheByPrefix("sentimentStore:");
    clearRuntimeCacheByPrefix(`cotStore:${assetClass}:`);
    clearRuntimeCacheByPrefix("pricePerformance:getPairPerformance:");
    // Ensure any in-flight caches across modules are cleared for this node process.
    clearRuntimeCacheAll();

    console.log(`Deleted ${result.length} cached snapshots`);

    return NextResponse.json({
      success: true,
      deleted: result.length,
      snapshots: result,
    });
  } catch (error) {
    console.error("Error clearing cache:", error);
    return NextResponse.json(
      { error: "Failed to clear cache" },
      { status: 500 }
    );
  }
}
