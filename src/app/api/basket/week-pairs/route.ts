/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Read-only pair summaries for one all-time Basket browser week.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse, type NextRequest } from "next/server";
import { getBasketWeekPairs } from "@/lib/basket/basketSummaries";
import type { AnchorType } from "@/lib/trades/tradeTypes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_ANCHORS = new Set<AnchorType>(["canonical", "execution"]);

function requiredParam(params: URLSearchParams, key: string) {
  const value = params.get(key)?.trim();
  return value && value.length > 0 ? value : null;
}

function normalizeDateIso(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const weekOpenUtcRaw = requiredParam(params, "weekOpenUtc");
    const strategyVariant = requiredParam(params, "strategyVariant");
    const anchorType = requiredParam(params, "anchorType") as AnchorType | null;

    if (!weekOpenUtcRaw || !strategyVariant || !anchorType) {
      return NextResponse.json(
        { error: "Missing required params: weekOpenUtc, strategyVariant, anchorType" },
        { status: 400 },
      );
    }
    if (!VALID_ANCHORS.has(anchorType)) {
      return NextResponse.json({ error: "anchorType must be canonical or execution" }, { status: 400 });
    }
    const weekOpenUtc = normalizeDateIso(weekOpenUtcRaw);
    if (!weekOpenUtc) {
      return NextResponse.json({ error: "weekOpenUtc must be a valid ISO timestamp" }, { status: 400 });
    }

    const pairs = await getBasketWeekPairs({
      weekOpenUtc,
      strategyVariant,
      anchorType,
    });

    return NextResponse.json({
      pairs,
      meta: {
        weekOpenUtc,
        strategyVariant,
        anchorType,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
