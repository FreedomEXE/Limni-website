/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: pathBarLoader.ts
 *
 * Description:
 * Batch-load canonical path bars for a symbol set over a time range.
 * This wraps canonical_price_bars with one query and returns bars
 * grouped by uppercase symbol for the basket path engine.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { query } from "@/lib/db";
import { getOrSetRuntimeCache } from "@/lib/runtimeCache";
import type { CanonicalPriceBar } from "@/lib/canonicalPriceBars";
import type { AssetClass } from "@/lib/cotMarkets";
import { CANONICAL_PATH_RESOLUTION } from "@/lib/performance/pathResolution";

export type PathBarMap = Map<string, CanonicalPriceBar[]>;

const PATH_BAR_LOADER_CACHE_TTL_MS = Number(
  process.env.PATH_BAR_LOADER_CACHE_TTL_MS ?? "15000",
);

function getPathBarLoaderCacheTtlMs() {
  if (
    Number.isFinite(PATH_BAR_LOADER_CACHE_TTL_MS)
    && PATH_BAR_LOADER_CACHE_TTL_MS >= 0
  ) {
    return Math.floor(PATH_BAR_LOADER_CACHE_TTL_MS);
  }
  return 15000;
}

function normalizeSymbols(symbols: string[]) {
  return Array.from(
    new Set(
      symbols
        .map((symbol) => symbol.trim().toUpperCase())
        .filter((symbol) => symbol.length > 0),
    ),
  ).sort();
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

export async function loadPathBars(
  symbols: string[],
  fromUtc: string,
  toUtc: string,
  resolution = CANONICAL_PATH_RESOLUTION,
): Promise<PathBarMap> {
  const normalizedSymbols = normalizeSymbols(symbols);
  const empty = new Map<string, CanonicalPriceBar[]>();
  for (const symbol of normalizedSymbols) {
    empty.set(symbol, []);
  }

  if (normalizedSymbols.length === 0) {
    return empty;
  }

  const cacheKey = [
    "pathBarLoader",
    resolution,
    fromUtc,
    toUtc,
    normalizedSymbols.join(","),
  ].join(":");

  return getOrSetRuntimeCache(cacheKey, getPathBarLoaderCacheTtlMs(), async () => {
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
        WHERE symbol = ANY($1::text[])
          AND timeframe = $2
          AND bar_open_utc >= $3::timestamptz
          AND bar_open_utc < $4::timestamptz
        ORDER BY symbol ASC, bar_open_utc ASC`,
      [normalizedSymbols, resolution, fromUtc, toUtc],
    );

    const bySymbol: PathBarMap = new Map();
    for (const symbol of normalizedSymbols) {
      bySymbol.set(symbol, []);
    }

    for (const row of rows) {
      const symbol = row.symbol.toUpperCase();
      const bars = bySymbol.get(symbol);
      if (!bars) continue;
      bars.push(mapCanonicalPriceBar(row));
    }

    return bySymbol;
  });
}
