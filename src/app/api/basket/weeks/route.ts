/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Read-only week summaries for the all-time Basket browser.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse, type NextRequest } from "next/server";
import { getBasketWeekSummaries } from "@/lib/basket/basketSummaries";
import type { AnchorType } from "@/lib/trades/tradeTypes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_ANCHORS = new Set<AnchorType>(["canonical", "execution"]);

function requiredParam(params: URLSearchParams, key: string) {
  const value = params.get(key)?.trim();
  return value && value.length > 0 ? value : null;
}

function parsePageInt(value: string | null, fallback: number, max: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const strategyVariant = requiredParam(params, "strategyVariant");
    const anchorType = requiredParam(params, "anchorType") as AnchorType | null;
    const limit = parsePageInt(params.get("limit"), 8, 50);
    const offset = parsePageInt(params.get("offset"), 0, 10000);

    if (!strategyVariant || !anchorType) {
      return NextResponse.json(
        { error: "Missing required params: strategyVariant, anchorType" },
        { status: 400 },
      );
    }
    if (!VALID_ANCHORS.has(anchorType)) {
      return NextResponse.json({ error: "anchorType must be canonical or execution" }, { status: 400 });
    }

    const result = await getBasketWeekSummaries({
      strategyVariant,
      anchorType,
      limit,
      offset,
    });

    return NextResponse.json({
      ...result,
      meta: {
        strategyVariant,
        anchorType,
        limit,
        offset,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
