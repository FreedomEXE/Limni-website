/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: adrLookup.ts
 *
 * Description:
 * Shared ADR (Average Daily Range) lookup for normalization.
 * Loads per-pair ADR% for a given week from canonical_price_bars
 * with runtime caching. Used by the engine's ADR normalization
 * overlay to equalize risk across asset classes.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { query } from "@/lib/db";
import { getOrSetRuntimeCache } from "@/lib/runtimeCache";

const ADR_LOOKBACK_DAYS = 10;
const ADR_MIN_REQUIRED_DAYS = 5;
const ADR_CACHE_TTL_MS = 60_000;

const TARGET_ADR_PCT = 1.0;

const DEFAULT_ADR: Record<string, number> = {
  fx: 0.6,
  crypto: 3.5,
  commodities: 1.5,
  indices: 1.0,
};

export type AdrMap = Map<string, number>;

export function getTargetAdrPct(): number {
  return TARGET_ADR_PCT;
}

export async function loadWeeklyAdrMap(weekOpenUtc: string): Promise<AdrMap> {
  const cacheKey = `adrLookup:weeklyAdr:${weekOpenUtc}`;
  return getOrSetRuntimeCache(cacheKey, ADR_CACHE_TTL_MS, async () => {
    const map: AdrMap = new Map();

    const rows = await query<{
      symbol: string;
      high_price: string;
      low_price: string;
      open_price: string;
    }>(
      `SELECT symbol, high_price, low_price, open_price
       FROM canonical_price_bars
       WHERE timeframe = '1d'
         AND bar_open_utc < $1::timestamptz
         AND bar_open_utc >= ($1::timestamptz - interval '20 days')
       ORDER BY symbol, bar_open_utc DESC`,
      [weekOpenUtc],
    );

    const bySymbol = new Map<string, Array<{ high: number; low: number; open: number }>>();
    for (const r of rows) {
      const sym = r.symbol.toUpperCase();
      if (!bySymbol.has(sym)) bySymbol.set(sym, []);
      const arr = bySymbol.get(sym)!;
      if (arr.length < ADR_LOOKBACK_DAYS) {
        arr.push({
          high: Number(r.high_price),
          low: Number(r.low_price),
          open: Number(r.open_price),
        });
      }
    }

    for (const [sym, bars] of bySymbol) {
      const valid = bars.filter(
        (b) => Number.isFinite(b.high) && Number.isFinite(b.low) && b.open > 0,
      );
      if (valid.length >= ADR_MIN_REQUIRED_DAYS) {
        const pctRanges = valid.map((b) => ((b.high - b.low) / b.open) * 100);
        const adrPct = pctRanges.reduce((s, v) => s + v, 0) / pctRanges.length;
        map.set(sym, adrPct);
      }
    }

    return map;
  });
}

export function getAdrPct(adrMap: AdrMap, symbol: string, assetClass: string): number {
  return adrMap.get(symbol.toUpperCase()) ?? DEFAULT_ADR[assetClass] ?? DEFAULT_ADR.fx!;
}
