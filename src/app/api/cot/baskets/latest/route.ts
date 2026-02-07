import { NextResponse } from "next/server";
import { buildBasketSignals } from "@/lib/basketSignals";
import { getAssetClass } from "@/lib/cotMarkets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const assetParam = url.searchParams.get("asset");
  const payload = await buildBasketSignals({
    assetClass: assetParam && assetParam !== "all" ? getAssetClass(assetParam) : "all",
  });
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
