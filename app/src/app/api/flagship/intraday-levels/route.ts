/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Returns current-week ADR trigger levels for all tracked pairs.
 * Single mode: Dynamic ADR — entry = 1x ADR pullback from running weekly high/low.
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
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type IntradayLevelRow = {
  pair: string;
  assetClass: AssetClass;
  adrPct: number | null;
  adrBarsUsed: number;
  weekOpenUtc: string;
  weekOpenPrice: number | null;
  weekHighPrice: number | null;
  weekLowPrice: number | null;
  currentPrice: number | null;
  /* Dynamic ADR trigger: 1x ADR from running weekly extreme */
  longTriggerPrice: number | null;
  shortTriggerPrice: number | null;
  longTouched: boolean;
  shortTouched: boolean;
  /* TP levels: 0.25x ADR from trigger */
  longTpPrice: number | null;
  shortTpPrice: number | null;
};

const ADR_LOOKBACK_DAYS = 10;
const ADR_MIN_REQUIRED_DAYS = 5;
const ENTRY_MULTIPLE = 1.0;
const TP_MULTIPLE = 0.25;

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

      const weekCandle = await fetchOandaCandle(pair, weekWindow.openUtc, nowUtc).catch(() => null);

      if (weekCandle) {
        weekOpenPrice = weekCandle.open;
        weekHighPrice = weekCandle.high;
        weekLowPrice = weekCandle.low;
        currentPrice = weekCandle.close;
      }

      /* Dynamic trigger: 1x ADR from running weekly high/low */
      const longTriggerPrice =
        weekHighPrice !== null && adrPct !== null
          ? weekHighPrice * (1 - (adrPct * ENTRY_MULTIPLE) / 100)
          : null;
      const shortTriggerPrice =
        weekLowPrice !== null && adrPct !== null
          ? weekLowPrice * (1 + (adrPct * ENTRY_MULTIPLE) / 100)
          : null;

      /* TP: 0.25x ADR from trigger */
      const longTpPrice =
        longTriggerPrice !== null && adrPct !== null
          ? longTriggerPrice * (1 + (adrPct * TP_MULTIPLE) / 100)
          : null;
      const shortTpPrice =
        shortTriggerPrice !== null && adrPct !== null
          ? shortTriggerPrice * (1 - (adrPct * TP_MULTIPLE) / 100)
          : null;

      return {
        pair,
        assetClass,
        adrPct,
        adrBarsUsed,
        weekOpenUtc: weekWindow.periodOpenUtc,
        weekOpenPrice,
        weekHighPrice,
        weekLowPrice,
        currentPrice,
        longTriggerPrice,
        shortTriggerPrice,
        /* Real state enriched from DB after all rows built */
        longTouched: false as boolean,
        shortTouched: false as boolean,
        longTpPrice,
        shortTpPrice,
      } satisfies IntradayLevelRow;
    });

    /* Enrich with real trade states from DB */
    try {
      const tradeRows = await query<{ symbol: string; direction: string; exit_reason: string }>(
        `SELECT t.symbol, t.direction, t.exit_reason
         FROM strategy_backtest_trades t
         JOIN strategy_backtest_runs r ON r.id = t.run_id
         WHERE r.bot_id = 'adr-forward' AND r.variant = 'fresh-start'
           AND t.week_open_utc = $1::timestamptz`,
        [currentWeekOpenUtc],
      );
      const touchedPairs = new Map<string, { long: boolean; short: boolean }>();
      for (const t of tradeRows) {
        const key = t.symbol.toUpperCase();
        const existing = touchedPairs.get(key) ?? { long: false, short: false };
        if (t.direction === "LONG") existing.long = true;
        if (t.direction === "SHORT") existing.short = true;
        touchedPairs.set(key, existing);
      }
      for (const row of rows) {
        const state = touchedPairs.get(row.pair.toUpperCase());
        if (state) {
          row.longTouched = state.long;
          row.shortTouched = state.short;
        }
      }
    } catch { /* DB unavailable — keep hardcoded false */ }

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
