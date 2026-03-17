/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Read API for crypto/commodity strength snapshots and history.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse } from "next/server";

import {
  isAssetClass,
  readAllLatestAssetStrengths,
  readAllLatestAssetStrengthsAll,
  readAssetStrengthHistory,
} from "@/lib/assetStrength";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isWindow(value: string | null): value is "1h" | "4h" | "24h" {
  return value === "1h" || value === "4h" || value === "24h";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const assetClassRaw = url.searchParams.get("class");
    const asset = url.searchParams.get("asset")?.toUpperCase() ?? null;
    const window = url.searchParams.get("window");
    const hoursBack = Number(url.searchParams.get("hoursBack")) || 0;

    if (asset && hoursBack > 0 && isWindow(window)) {
      const history = await readAssetStrengthHistory(asset, window, hoursBack);
      return NextResponse.json({ asset, window, history });
    }

    if (assetClassRaw && isAssetClass(assetClassRaw)) {
      const strengths = await readAllLatestAssetStrengths(assetClassRaw);
      return NextResponse.json({ assetClass: assetClassRaw, strengths });
    }

    const all = await readAllLatestAssetStrengthsAll();
    return NextResponse.json({ strengths: all });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read asset strength" },
      { status: 500 },
    );
  }
}
