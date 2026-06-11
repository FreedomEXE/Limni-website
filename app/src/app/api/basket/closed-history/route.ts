/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Read-only closed-history bundle for Basket hierarchy.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse, type NextRequest } from "next/server";
import { buildClosedHistoryBundle } from "@/lib/basket/basketSummaries";
import { parsePerformanceAssetSelection } from "@/lib/performance/performanceAssetScope";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function requiredParam(params: URLSearchParams, key: string) {
  const value = params.get(key)?.trim();
  return value && value.length > 0 ? value : null;
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const strategyVariant = requiredParam(params, "strategyVariant");
    const scope = parsePerformanceAssetSelection(params.get("scope"));
    if (!strategyVariant) {
      return NextResponse.json({ error: "Missing required param: strategyVariant" }, { status: 400 });
    }

    const bundle = await buildClosedHistoryBundle({ strategyVariant, scope });
    return NextResponse.json({ bundle });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
