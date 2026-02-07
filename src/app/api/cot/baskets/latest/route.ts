import { NextResponse } from "next/server";
import { buildBasketSignals } from "@/lib/basketSignals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const assetParam = url.searchParams.get("asset");
  const assetClass = assetParam && assetParam !== "all" ? assetParam : "all";
  const payload = await buildBasketSignals({ assetClass });
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
