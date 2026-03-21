/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Returns simple 24h percent moves for the flagship CFD universe using
 * OANDA candles so the board can surface stretch inline next to each pair.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { DateTime } from "luxon";
import { NextResponse } from "next/server";

import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { fetchOandaCandle } from "@/lib/oandaPrices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PriceMoveRow = {
  pair: string;
  change24hPct: number | null;
  openPrice: number | null;
  closePrice: number | null;
};

const UNIVERSE = [
  ...PAIRS_BY_ASSET_CLASS.fx.map((pairDef) => pairDef.pair.toUpperCase()),
  ...PAIRS_BY_ASSET_CLASS.indices.map((pairDef) => pairDef.pair.toUpperCase()),
  ...PAIRS_BY_ASSET_CLASS.crypto.map((pairDef) => pairDef.pair.toUpperCase()),
  ...PAIRS_BY_ASSET_CLASS.commodities.map((pairDef) => pairDef.pair.toUpperCase()),
];

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

export async function GET() {
  try {
    const closeUtc = DateTime.utc();
    const openUtc = closeUtc.minus({ hours: 24 });

    const rows = await mapWithConcurrency(UNIVERSE, 6, async (pair) => {
      try {
        const candle = await fetchOandaCandle(pair, openUtc, closeUtc);
        if (!candle || candle.open <= 0) {
          return {
            pair,
            change24hPct: null,
            openPrice: candle?.open ?? null,
            closePrice: candle?.close ?? null,
          } satisfies PriceMoveRow;
        }
        return {
          pair,
          change24hPct: ((candle.close - candle.open) / candle.open) * 100,
          openPrice: candle.open,
          closePrice: candle.close,
        } satisfies PriceMoveRow;
      } catch {
        return {
          pair,
          change24hPct: null,
          openPrice: null,
          closePrice: null,
        } satisfies PriceMoveRow;
      }
    });

    return NextResponse.json({
      generatedUtc: new Date().toISOString(),
      rows,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build price moves" },
      { status: 500 },
    );
  }
}
