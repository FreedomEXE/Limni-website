import { NextResponse } from "next/server";
import { evaluateFreshness } from "@/lib/cotFreshness";
import { readSnapshot } from "@/lib/cotStore";
import type { CotSnapshotResponse } from "@/lib/cotTypes";
import { COT_VARIANT, getAssetClass } from "@/lib/cotMarkets";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const assetParam = url.searchParams.get("asset");
  const reportParam = url.searchParams.get("report");
  const snapshot = await readSnapshot({
    assetClass: assetParam ? getAssetClass(assetParam) : "fx",
    reportDate: reportParam ?? undefined,
  });

  if (!snapshot) {
    const empty: CotSnapshotResponse = {
      report_date: "",
      last_refresh_utc: "",
      asset_class: getAssetClass(assetParam),
      variant: COT_VARIANT,
      trading_allowed: false,
      reason: "no snapshot available",
      currencies: {},
      pairs: {},
    };
    const body = JSON.stringify(empty);
    return new Response(body, {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
        "Content-Length": String(Buffer.byteLength(body)),
      },
    });
  }

  const freshness = evaluateFreshness(
    snapshot.report_date,
    snapshot.last_refresh_utc,
  );

  const payload = { ...snapshot, ...freshness };
  const body = JSON.stringify(payload);
  return new Response(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      "Content-Length": String(Buffer.byteLength(body)),
    },
  });
}
