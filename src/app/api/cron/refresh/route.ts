import { NextResponse } from "next/server";
import { listAssetClasses } from "@/lib/cotMarkets";
import { readSnapshot, refreshAllSnapshots } from "@/lib/cotStore";
import { refreshMarketSnapshot } from "@/lib/pricePerformance";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return true;
  }
  const headerSecret = request.headers.get("x-cron-secret");
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  return headerSecret === secret || querySecret === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const assetClasses = listAssetClasses();
  const results: Record<
    string,
    { cot: "ok" | "error"; prices: "ok" | "skipped" | "error"; message?: string }
  > = {};

  try {
    await refreshAllSnapshots();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assetClasses.forEach((asset) => {
      results[asset.id] = { cot: "error", prices: "skipped", message };
    });
    return NextResponse.json({ startedAt, results });
  }

  for (const asset of assetClasses) {
    try {
      const snapshot = await readSnapshot({ assetClass: asset.id });
      if (!snapshot) {
        results[asset.id] = { cot: "ok", prices: "skipped", message: "No snapshot." };
        continue;
      }
      await refreshMarketSnapshot(snapshot.pairs, {
        assetClass: asset.id,
        force: true,
      });
      results[asset.id] = { cot: "ok", prices: "ok" };
    } catch (error) {
      results[asset.id] = {
        cot: "ok",
        prices: "error",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return NextResponse.json({
    startedAt,
    finishedAt: new Date().toISOString(),
    results,
  });
}
