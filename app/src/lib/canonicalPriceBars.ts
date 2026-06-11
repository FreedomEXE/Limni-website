/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: canonicalPriceBars.ts
 * Description: Read helpers for canonical normalized price bars.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { query, queryOne } from "./db";
import type { AssetClass } from "./cotMarkets";
import { getOrSetRuntimeCache } from "./runtimeCache";

export type CanonicalPriceBar = {
  symbol: string;
  assetClass: AssetClass;
  timeframe: string;
  barOpenUtc: string;
  barCloseUtc: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  sourceProvider: string;
  qualityStatus: string;
};

const CANONICAL_PRICE_BARS_CACHE_TTL_MS = Number(process.env.CANONICAL_PRICE_BARS_CACHE_TTL_MS ?? "15000");

function getCanonicalPriceBarsCacheTtlMs() {
  return Number.isFinite(CANONICAL_PRICE_BARS_CACHE_TTL_MS) && CANONICAL_PRICE_BARS_CACHE_TTL_MS >= 0
    ? CANONICAL_PRICE_BARS_CACHE_TTL_MS
    : 15000;
}

function mapCanonicalPriceBar(row: {
  symbol: string;
  asset_class: AssetClass;
  timeframe: string;
  bar_open_utc: Date;
  bar_close_utc: Date;
  open_price: number | string;
  high_price: number | string;
  low_price: number | string;
  close_price: number | string;
  source_provider: string;
  quality_status: string;
}): CanonicalPriceBar {
  return {
    symbol: row.symbol,
    assetClass: row.asset_class,
    timeframe: row.timeframe,
    barOpenUtc: row.bar_open_utc.toISOString(),
    barCloseUtc: row.bar_close_utc.toISOString(),
    openPrice: Number(row.open_price),
    highPrice: Number(row.high_price),
    lowPrice: Number(row.low_price),
    closePrice: Number(row.close_price),
    sourceProvider: row.source_provider,
    qualityStatus: row.quality_status,
  };
}

export async function getCanonicalBars(
  symbol: string,
  timeframe: string,
  fromUtc: string,
  toUtc: string,
): Promise<CanonicalPriceBar[]> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const cacheKey = `canonicalPriceBars:getCanonicalBars:${normalizedSymbol}:${timeframe}:${fromUtc}:${toUtc}`;
  return getOrSetRuntimeCache(cacheKey, getCanonicalPriceBarsCacheTtlMs(), async () => {
    const rows = await query<{
      symbol: string;
      asset_class: AssetClass;
      timeframe: string;
      bar_open_utc: Date;
      bar_close_utc: Date;
      open_price: number | string;
      high_price: number | string;
      low_price: number | string;
      close_price: number | string;
      source_provider: string;
      quality_status: string;
    }>(
      `SELECT symbol, asset_class, timeframe, bar_open_utc, bar_close_utc,
              open_price, high_price, low_price, close_price, source_provider, quality_status
         FROM canonical_price_bars
        WHERE symbol = $1
          AND timeframe = $2
          AND bar_open_utc >= $3::timestamptz
          AND bar_open_utc < $4::timestamptz
        ORDER BY bar_open_utc ASC`,
      [normalizedSymbol, timeframe, fromUtc, toUtc],
    );
    return rows.map(mapCanonicalPriceBar);
  });
}

export async function getLatestCanonicalBar(
  symbol: string,
  timeframe: string,
): Promise<CanonicalPriceBar | null> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const cacheKey = `canonicalPriceBars:getLatestCanonicalBar:${normalizedSymbol}:${timeframe}`;
  return getOrSetRuntimeCache(cacheKey, getCanonicalPriceBarsCacheTtlMs(), async () => {
    const row = await queryOne<{
      symbol: string;
      asset_class: AssetClass;
      timeframe: string;
      bar_open_utc: Date;
      bar_close_utc: Date;
      open_price: number | string;
      high_price: number | string;
      low_price: number | string;
      close_price: number | string;
      source_provider: string;
      quality_status: string;
    }>(
      `SELECT symbol, asset_class, timeframe, bar_open_utc, bar_close_utc,
              open_price, high_price, low_price, close_price, source_provider, quality_status
         FROM canonical_price_bars
        WHERE symbol = $1
          AND timeframe = $2
        ORDER BY bar_open_utc DESC
        LIMIT 1`,
      [normalizedSymbol, timeframe],
    );
    return row ? mapCanonicalPriceBar(row) : null;
  });
}
