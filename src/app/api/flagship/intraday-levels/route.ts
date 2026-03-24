/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Returns current-week ADR trigger levels for the intraday forward-test board.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { DateTime } from "luxon";
import { NextResponse } from "next/server";

import { getCanonicalBars } from "@/lib/canonicalPriceBars";
import { getCanonicalTradingDayWindow, getCanonicalWeekWindow } from "@/lib/canonicalPriceWindows";
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";
import type { AssetClass } from "@/lib/cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { fetchOandaCandle } from "@/lib/oandaPrices";
import { getIntradayAdrThreshold } from "@/lib/flagship/intradayThresholds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IntradayLevelRow = {
  pair: string;
  assetClass: AssetClass;
  adrPct: number | null;
  adrBarsUsed: number;
  adrMultiplier: number;
  thresholdPct: number | null;
  oneAdrThresholdPct: number | null;
  weekOpenUtc: string;
  weekOpenPrice: number | null;
  weekHighPrice: number | null;
  weekLowPrice: number | null;
  currentPrice: number | null;
  longTriggerPrice: number | null;
  shortTriggerPrice: number | null;
  oneAdrLongTriggerPrice: number | null;
  oneAdrShortTriggerPrice: number | null;
  longTouched: boolean;
  shortTouched: boolean;
  oneAdrLongTouched: boolean;
  oneAdrShortTouched: boolean;
  sourceLabel: string;
};

const ADR_LOOKBACK_DAYS = 10;
const ADR_MIN_REQUIRED_DAYS = 5;
const UNIVERSE = (Object.entries(PAIRS_BY_ASSET_CLASS) as Array<[AssetClass, Array<{ pair: string }>]>).flatMap(
  ([assetClass, pairs]) =>
    pairs.map((pairDef) => ({
      pair: pairDef.pair.toUpperCase(),
      assetClass,
    })),
);

function toPct(high: number, low: number, open: number) {
  if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(open) || open <= 0) {
    return null;
  }
  return ((high - low) / open) * 100;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runWorker()));
  return results;
}

export async function GET() {
  try {
    const nowUtc = DateTime.utc();
    const currentWeekOpenUtc = getCanonicalWeekOpenUtc(nowUtc);

    const rows = await mapWithConcurrency(UNIVERSE, 6, async ({ pair, assetClass }) => {
      const threshold = getIntradayAdrThreshold(assetClass);
      const tradingDayWindow = getCanonicalTradingDayWindow(assetClass, nowUtc);
      const weekWindow = getCanonicalWeekWindow(currentWeekOpenUtc, assetClass);
      const lookbackFromUtc =
        tradingDayWindow.openUtc.minus({ days: ADR_LOOKBACK_DAYS + 2 }).toISO() ??
        tradingDayWindow.openUtc.toISO() ??
        currentWeekOpenUtc;
      const lookbackToUtc = tradingDayWindow.openUtc.toISO() ?? currentWeekOpenUtc;

      let adrPct: number | null = null;
      let adrBarsUsed = 0;
      let weekOpenPrice: number | null = null;
      let weekHighPrice: number | null = null;
      let weekLowPrice: number | null = null;
      let currentPrice: number | null = null;

      try {
        const adrBars = await getCanonicalBars(pair, "1d", lookbackFromUtc, lookbackToUtc);
        const adrRanges = adrBars
          .slice(-ADR_LOOKBACK_DAYS)
          .map((bar) => toPct(bar.highPrice, bar.lowPrice, bar.openPrice))
          .filter((value): value is number => value !== null && Number.isFinite(value));

        if (adrRanges.length >= ADR_MIN_REQUIRED_DAYS) {
          adrBarsUsed = adrRanges.length;
          adrPct = adrRanges.reduce((sum, value) => sum + value, 0) / adrRanges.length;
        }
      } catch {
        adrPct = null;
      }

      try {
        const candle = await fetchOandaCandle(pair, weekWindow.openUtc, nowUtc);
        if (candle) {
          weekOpenPrice = candle.open;
          weekHighPrice = candle.high;
          weekLowPrice = candle.low;
          currentPrice = candle.close;
        }
      } catch {
        weekOpenPrice = null;
        weekHighPrice = null;
        weekLowPrice = null;
        currentPrice = null;
      }

      const thresholdPct = adrPct === null ? null : adrPct * threshold.adrMultiplier;
      const oneAdrThresholdPct = adrPct;
      const longTriggerPrice =
        weekOpenPrice !== null && thresholdPct !== null
          ? weekOpenPrice * (1 - thresholdPct / 100)
          : null;
      const shortTriggerPrice =
        weekOpenPrice !== null && thresholdPct !== null
          ? weekOpenPrice * (1 + thresholdPct / 100)
          : null;
      const oneAdrLongTriggerPrice =
        weekOpenPrice !== null && oneAdrThresholdPct !== null
          ? weekOpenPrice * (1 - oneAdrThresholdPct / 100)
          : null;
      const oneAdrShortTriggerPrice =
        weekOpenPrice !== null && oneAdrThresholdPct !== null
          ? weekOpenPrice * (1 + oneAdrThresholdPct / 100)
          : null;

      return {
        pair,
        assetClass,
        adrPct,
        adrBarsUsed,
        adrMultiplier: threshold.adrMultiplier,
        thresholdPct,
        oneAdrThresholdPct,
        weekOpenUtc: weekWindow.periodOpenUtc,
        weekOpenPrice,
        weekHighPrice,
        weekLowPrice,
        currentPrice,
        longTriggerPrice,
        shortTriggerPrice,
        oneAdrLongTriggerPrice,
        oneAdrShortTriggerPrice,
        longTouched:
          longTriggerPrice !== null &&
          weekLowPrice !== null &&
          Number.isFinite(weekLowPrice) &&
          weekLowPrice <= longTriggerPrice,
        shortTouched:
          shortTriggerPrice !== null &&
          weekHighPrice !== null &&
          Number.isFinite(weekHighPrice) &&
          weekHighPrice >= shortTriggerPrice,
        oneAdrLongTouched:
          oneAdrLongTriggerPrice !== null &&
          weekLowPrice !== null &&
          Number.isFinite(weekLowPrice) &&
          weekLowPrice <= oneAdrLongTriggerPrice,
        oneAdrShortTouched:
          oneAdrShortTriggerPrice !== null &&
          weekHighPrice !== null &&
          Number.isFinite(weekHighPrice) &&
          weekHighPrice >= oneAdrShortTriggerPrice,
        sourceLabel: `${threshold.sourceLabel} weekly`,
      } satisfies IntradayLevelRow;
    });

    return NextResponse.json({
      generatedUtc: nowUtc.toISO(),
      currentWeekOpenUtc,
      rows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to build intraday ADR levels",
      },
      { status: 500 },
    );
  }
}
