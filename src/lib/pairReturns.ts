/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: pairReturns.ts
 *
 * Description:
 * Read helpers for derived pair period returns. Canonical helpers read market
 * truth windows; execution helpers read tradable windows stored beside them.
 * Existing generic callers remain canonical until Phase 2 migrates strategy
 * code explicitly.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { query, queryOne } from "./db";
import type { AssetClass } from "./cotMarkets";
import { getCanonicalInstrument, listCanonicalInstruments } from "./canonicalInstruments";
import { getCanonicalWeekWindow } from "./canonicalPriceWindows";
import { getOrSetRuntimeCache } from "./runtimeCache";
import { DateTime } from "luxon";
import { fetchOandaCandleSeries } from "./oandaPrices";
import { fetchBitgetSpotCandleSeries } from "./bitget";
import { getDisplayWeekOpenUtc } from "./weekAnchor";
import {
  EXECUTION_ANCHOR_VERSION as EXECUTION_WINDOW_ANCHOR_VERSION,
  getExecutionWeekWindow,
} from "./executionPriceWindows";

type PeriodType = "weekly" | "daily";
export type AnchorType = "canonical" | "execution";

export const CANONICAL_ANCHOR_VERSION = "canonical_weekly_v2";
export const EXECUTION_ANCHOR_VERSION = EXECUTION_WINDOW_ANCHOR_VERSION;

export type PairReturnRow = {
  symbol: string;
  assetClass: AssetClass;
  periodType: PeriodType;
  anchorType?: AnchorType;
  anchorVersion?: string;
  periodOpenUtc: string;
  periodCloseUtc: string;
  windowOpenUtc?: string | null;
  windowCloseUtc?: string | null;
  returnPct: number;
  openPrice: number;
  closePrice: number;
  highPrice: number | null;
  lowPrice: number | null;
  source: string;
  derivedFromTimeframe: string;
  derivationVersion: string;
};

const PAIR_RETURNS_CACHE_TTL_MS = Number(process.env.PAIR_RETURNS_CACHE_TTL_MS ?? "15000");
const LIVE_PAIR_RETURNS_CACHE_TTL_MS = Number(process.env.LIVE_PAIR_RETURNS_CACHE_TTL_MS ?? "45000");

function getPairReturnsCacheTtlMs() {
  return Number.isFinite(PAIR_RETURNS_CACHE_TTL_MS) && PAIR_RETURNS_CACHE_TTL_MS >= 0
    ? PAIR_RETURNS_CACHE_TTL_MS
    : 15000;
}

function getLivePairReturnsCacheTtlMs() {
  return Number.isFinite(LIVE_PAIR_RETURNS_CACHE_TTL_MS) && LIVE_PAIR_RETURNS_CACHE_TTL_MS >= 0
    ? LIVE_PAIR_RETURNS_CACHE_TTL_MS
    : 45000;
}

function mapPairReturnRow(row: {
  symbol: string;
  asset_class: AssetClass;
  period_type: PeriodType;
  anchor_type?: AnchorType;
  anchor_version?: string;
  period_open_utc: Date;
  period_close_utc: Date;
  window_open_utc?: Date | null;
  window_close_utc?: Date | null;
  return_pct: number | string;
  open_price: number | string;
  close_price: number | string;
  high_price: number | string | null;
  low_price: number | string | null;
  source: string;
  derived_from_timeframe: string;
  derivation_version: string;
}): PairReturnRow {
  return {
    symbol: row.symbol,
    assetClass: row.asset_class,
    periodType: row.period_type,
    anchorType: row.anchor_type,
    anchorVersion: row.anchor_version,
    periodOpenUtc: row.period_open_utc.toISOString(),
    periodCloseUtc: row.period_close_utc.toISOString(),
    windowOpenUtc: row.window_open_utc?.toISOString() ?? null,
    windowCloseUtc: row.window_close_utc?.toISOString() ?? null,
    returnPct: Number(row.return_pct),
    openPrice: Number(row.open_price),
    closePrice: Number(row.close_price),
    highPrice: row.high_price === null ? null : Number(row.high_price),
    lowPrice: row.low_price === null ? null : Number(row.low_price),
    source: row.source,
    derivedFromTimeframe: row.derived_from_timeframe,
    derivationVersion: row.derivation_version,
  };
}

function isCurrentDisplayWeek(weekOpenUtc: string) {
  return weekOpenUtc === getDisplayWeekOpenUtc();
}

async function readStoredWeeklyPairReturns(
  weekOpenUtc: string,
  assetClass?: AssetClass,
  anchorType: AnchorType = "canonical",
): Promise<Array<{
  symbol: string;
  assetClass: AssetClass;
  returnPct: number;
  openPrice: number;
  closePrice: number;
}>> {
  const anchorVersion = anchorType === "execution" ? EXECUTION_ANCHOR_VERSION : CANONICAL_ANCHOR_VERSION;
  const rows = await query<{
    symbol: string;
    asset_class: AssetClass;
    period_type: PeriodType;
    anchor_type: AnchorType;
    anchor_version: string;
    period_open_utc: Date;
    period_close_utc: Date;
    window_open_utc: Date | null;
    window_close_utc: Date | null;
    return_pct: number | string;
    open_price: number | string;
    close_price: number | string;
    high_price: number | string | null;
    low_price: number | string | null;
    source: string;
    derived_from_timeframe: string;
    derivation_version: string;
  }>(
    `SELECT symbol, asset_class, period_type, anchor_type, anchor_version,
            period_open_utc, period_close_utc, window_open_utc, window_close_utc,
            return_pct, open_price, close_price, high_price, low_price,
            source, derived_from_timeframe, derivation_version
       FROM pair_period_returns
      WHERE period_type = 'weekly'
        AND period_open_utc = $1::timestamptz
        AND anchor_type = $2
        AND anchor_version = $3
        AND ($4::text IS NULL OR asset_class = $4::text)
      ORDER BY asset_class ASC, symbol ASC`,
    [weekOpenUtc, anchorType, anchorVersion, assetClass ?? null],
  );
  return rows.map((row) => {
    const mapped = mapPairReturnRow(row);
    return {
      symbol: mapped.symbol,
      assetClass: mapped.assetClass,
      returnPct: mapped.returnPct,
      openPrice: mapped.openPrice,
      closePrice: mapped.closePrice,
    };
  });
}

async function fetchLiveWeeklyReturns(
  weekOpenUtc: string,
  assetClass?: AssetClass,
  anchorType: AnchorType = "canonical",
): Promise<Array<{
  symbol: string;
  assetClass: AssetClass;
  returnPct: number;
  openPrice: number;
  closePrice: number;
}>> {
  const cacheKey = `pairReturns:liveWeeklyPairReturns:${anchorType}:${weekOpenUtc}:${assetClass ?? "all"}`;
  return getOrSetRuntimeCache(cacheKey, getLivePairReturnsCacheTtlMs(), async () => {
    const weekOpenDt = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    if (!weekOpenDt.isValid) {
      return [];
    }

    const nowUtc = DateTime.utc();
    const instruments = listCanonicalInstruments(assetClass).filter((instrument) => instrument.isActive);
    const BATCH_SIZE = 6;
    const results: Array<{
      symbol: string;
      assetClass: AssetClass;
      returnPct: number;
      openPrice: number;
      closePrice: number;
    }> = [];

    for (let i = 0; i < instruments.length; i += BATCH_SIZE) {
      const batch = instruments.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (instrument) => {
          try {
            const { openUtc, windowCloseUtc } = anchorType === "execution"
              ? (() => {
                  const window = getExecutionWeekWindow(weekOpenUtc, instrument.assetClass);
                  return { openUtc: window.windowOpenUtc, windowCloseUtc: window.windowCloseUtc };
                })()
              : (() => {
                  const window = getCanonicalWeekWindow(weekOpenUtc, instrument.assetClass);
                  return { openUtc: window.openUtc, windowCloseUtc: window.closeUtc };
                })();
            const closeUtc = DateTime.min(nowUtc, windowCloseUtc);
            if (!closeUtc.isValid || closeUtc <= openUtc) {
              return null;
            }

            if (instrument.primaryProvider === "oanda" && instrument.oandaInstrument) {
              const candles = await fetchOandaCandleSeries(
                instrument.oandaInstrument,
                openUtc,
                closeUtc,
              );
              if (candles.length === 0) return null;

              const openPrice = candles[0]!.open;
              const closePrice = candles[candles.length - 1]!.close;
              if (!Number.isFinite(openPrice) || !Number.isFinite(closePrice) || openPrice <= 0) {
                return null;
              }

              return {
                symbol: instrument.symbol,
                assetClass: instrument.assetClass,
                returnPct: ((closePrice - openPrice) / openPrice) * 100,
                openPrice,
                closePrice,
              };
            }

            if (instrument.primaryProvider === "bitget" && instrument.bitgetBaseCoin) {
              const candles = await fetchBitgetSpotCandleSeries(instrument.bitgetBaseCoin, {
                openUtc,
                closeUtc,
              });
              if (candles.length === 0) return null;

              const openPrice = candles[0]!.open;
              const closePrice = candles[candles.length - 1]!.close;
              if (!Number.isFinite(openPrice) || !Number.isFinite(closePrice) || openPrice <= 0) {
                return null;
              }

              return {
                symbol: instrument.symbol,
                assetClass: instrument.assetClass,
                returnPct: ((closePrice - openPrice) / openPrice) * 100,
                openPrice,
                closePrice,
              };
            }

            return null;
          } catch (error) {
            console.warn(
              `[pairReturns] Failed to fetch live weekly return for ${instrument.symbol}:`,
              error instanceof Error ? error.message : error,
            );
            return null;
          }
        }),
      );

      for (const row of batchResults) {
        if (row) {
          results.push(row);
        }
      }
    }

    return results.sort((left, right) =>
      left.assetClass === right.assetClass
        ? left.symbol.localeCompare(right.symbol)
        : left.assetClass.localeCompare(right.assetClass),
    );
  });
}

export async function getPairReturn(
  symbol: string,
  periodType: PeriodType,
  periodOpenUtc: string,
): Promise<{ returnPct: number; openPrice: number; closePrice: number } | null> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const cacheKey = `pairReturns:getPairReturn:${normalizedSymbol}:${periodType}:${periodOpenUtc}`;
  return getOrSetRuntimeCache(cacheKey, getPairReturnsCacheTtlMs(), async () => {
    const row = await queryOne<{
      symbol: string;
      asset_class: AssetClass;
      period_type: PeriodType;
      anchor_type: AnchorType;
      anchor_version: string;
      period_open_utc: Date;
      period_close_utc: Date;
      window_open_utc: Date | null;
      window_close_utc: Date | null;
      return_pct: number | string;
      open_price: number | string;
      close_price: number | string;
      high_price: number | string | null;
      low_price: number | string | null;
      source: string;
      derived_from_timeframe: string;
      derivation_version: string;
    }>(
      `SELECT symbol, asset_class, period_type, anchor_type, anchor_version,
              period_open_utc, period_close_utc, window_open_utc, window_close_utc,
              return_pct, open_price, close_price, high_price, low_price,
              source, derived_from_timeframe, derivation_version
         FROM pair_period_returns
        WHERE symbol = $1
          AND period_type = $2
          AND period_open_utc = $3::timestamptz
          AND anchor_type = 'canonical'
          AND anchor_version = $4
        LIMIT 1`,
      [normalizedSymbol, periodType, periodOpenUtc, CANONICAL_ANCHOR_VERSION],
    );
    if (!row) {
      return null;
    }
    const mapped = mapPairReturnRow(row);
    return {
      returnPct: mapped.returnPct,
      openPrice: mapped.openPrice,
      closePrice: mapped.closePrice,
    };
  });
}

/**
 * Canonical market-truth weekly pair returns.
 *
 * @deprecated Strategy code should migrate to getExecutionWeeklyPairReturns in Phase 2.
 */
export async function getCanonicalWeeklyPairReturns(
  weekOpenUtc: string,
  assetClass?: AssetClass,
): Promise<Array<{
  symbol: string;
  assetClass: AssetClass;
  returnPct: number;
  openPrice: number;
  closePrice: number;
}>> {
  if (isCurrentDisplayWeek(weekOpenUtc)) {
    const liveRows = await fetchLiveWeeklyReturns(weekOpenUtc, assetClass);
    if (liveRows.length > 0) {
      const expectedCount = listCanonicalInstruments(assetClass).filter((instrument) => instrument.isActive).length;
      if (liveRows.length >= expectedCount) {
        return liveRows;
      }

      const storedRows = await readStoredWeeklyPairReturns(weekOpenUtc, assetClass);
      if (storedRows.length === 0) {
        return liveRows;
      }

      const mergedBySymbol = new Map(storedRows.map((row) => [row.symbol.toUpperCase(), row]));
      for (const row of liveRows) {
        mergedBySymbol.set(row.symbol.toUpperCase(), row);
      }
      return Array.from(mergedBySymbol.values()).sort((left, right) =>
        left.assetClass === right.assetClass
          ? left.symbol.localeCompare(right.symbol)
          : left.assetClass.localeCompare(right.assetClass),
      );
    }
  }

  const cacheKey = `pairReturns:getWeeklyPairReturns:${weekOpenUtc}:${assetClass ?? "all"}`;
  return getOrSetRuntimeCache(cacheKey, getPairReturnsCacheTtlMs(), async () =>
    readStoredWeeklyPairReturns(weekOpenUtc, assetClass));
}

export async function getExecutionWeeklyPairReturns(
  weekOpenUtc: string,
  assetClass?: AssetClass,
): Promise<Array<{
  symbol: string;
  assetClass: AssetClass;
  returnPct: number;
  openPrice: number;
  closePrice: number;
}>> {
  if (isCurrentDisplayWeek(weekOpenUtc)) {
    const liveRows = await fetchLiveWeeklyReturns(weekOpenUtc, assetClass, "execution");
    if (liveRows.length > 0) {
      const expectedCount = listCanonicalInstruments(assetClass).filter((instrument) => instrument.isActive).length;
      if (liveRows.length >= expectedCount) {
        return liveRows;
      }

      const storedRows = await readStoredWeeklyPairReturns(weekOpenUtc, assetClass, "execution");
      if (storedRows.length === 0) {
        return liveRows;
      }

      const mergedBySymbol = new Map(storedRows.map((row) => [row.symbol.toUpperCase(), row]));
      for (const row of liveRows) {
        mergedBySymbol.set(row.symbol.toUpperCase(), row);
      }
      return Array.from(mergedBySymbol.values()).sort((left, right) =>
        left.assetClass === right.assetClass
          ? left.symbol.localeCompare(right.symbol)
          : left.assetClass.localeCompare(right.assetClass),
      );
    }
  }

  const cacheKey = `pairReturns:getExecutionWeeklyPairReturns:${weekOpenUtc}:${assetClass ?? "all"}`;
  return getOrSetRuntimeCache(cacheKey, getPairReturnsCacheTtlMs(), async () =>
    readStoredWeeklyPairReturns(weekOpenUtc, assetClass, "execution"));
}

/**
 * @deprecated Use getCanonicalWeeklyPairReturns or getExecutionWeeklyPairReturns explicitly.
 * This shim remains canonical so Phase 1 does not change existing consumers.
 */
export const getWeeklyPairReturns = getCanonicalWeeklyPairReturns;

export async function getPairReturnHistory(
  symbol: string,
  periodType: PeriodType,
): Promise<Array<{
  periodOpenUtc: string;
  returnPct: number;
  openPrice: number;
  closePrice: number;
}>> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const cacheKey = `pairReturns:getPairReturnHistory:${normalizedSymbol}:${periodType}`;
  return getOrSetRuntimeCache(cacheKey, getPairReturnsCacheTtlMs(), async () => {
    const rows = await query<{
      symbol: string;
      asset_class: AssetClass;
      period_type: PeriodType;
      anchor_type: AnchorType;
      anchor_version: string;
      period_open_utc: Date;
      period_close_utc: Date;
      window_open_utc: Date | null;
      window_close_utc: Date | null;
      return_pct: number | string;
      open_price: number | string;
      close_price: number | string;
      high_price: number | string | null;
      low_price: number | string | null;
      source: string;
      derived_from_timeframe: string;
      derivation_version: string;
    }>(
      `SELECT symbol, asset_class, period_type, anchor_type, anchor_version,
              period_open_utc, period_close_utc, window_open_utc, window_close_utc,
              return_pct, open_price, close_price, high_price, low_price,
              source, derived_from_timeframe, derivation_version
         FROM pair_period_returns
        WHERE symbol = $1
          AND period_type = $2
          AND anchor_type = 'canonical'
          AND anchor_version = $3
        ORDER BY period_open_utc ASC`,
      [normalizedSymbol, periodType, CANONICAL_ANCHOR_VERSION],
    );
    return rows.map((row) => {
      const mapped = mapPairReturnRow(row);
      return {
        periodOpenUtc: mapped.periodOpenUtc,
        returnPct: mapped.returnPct,
        openPrice: mapped.openPrice,
        closePrice: mapped.closePrice,
      };
    });
  });
}

export async function getPairDailyBreakdown(
  symbol: string,
  weekOpenUtc: string,
): Promise<Array<{
  periodOpenUtc: string;
  returnPct: number;
  openPrice: number;
  closePrice: number;
}>> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const instrument = getCanonicalInstrument(normalizedSymbol);
  if (!instrument) {
    return [];
  }
  const cacheKey = `pairReturns:getPairDailyBreakdown:${normalizedSymbol}:${weekOpenUtc}`;
  return getOrSetRuntimeCache(cacheKey, getPairReturnsCacheTtlMs(), async () => {
    const weeklyWindow = getCanonicalWeekWindow(weekOpenUtc, instrument.assetClass);
    const rows = await query<{
      symbol: string;
      asset_class: AssetClass;
      period_type: PeriodType;
      anchor_type: AnchorType;
      anchor_version: string;
      period_open_utc: Date;
      period_close_utc: Date;
      window_open_utc: Date | null;
      window_close_utc: Date | null;
      return_pct: number | string;
      open_price: number | string;
      close_price: number | string;
      high_price: number | string | null;
      low_price: number | string | null;
      source: string;
      derived_from_timeframe: string;
      derivation_version: string;
    }>(
      `SELECT symbol, asset_class, period_type, anchor_type, anchor_version,
              period_open_utc, period_close_utc, window_open_utc, window_close_utc,
              return_pct, open_price, close_price, high_price, low_price,
              source, derived_from_timeframe, derivation_version
         FROM pair_period_returns
        WHERE symbol = $1
          AND period_type = 'daily'
          AND anchor_type = 'canonical'
          AND anchor_version = $4
          AND period_open_utc >= $2::timestamptz
          AND period_open_utc < $3::timestamptz
        ORDER BY period_open_utc ASC`,
      [normalizedSymbol, weeklyWindow.openUtc.toISO(), weeklyWindow.closeUtc.toISO(), CANONICAL_ANCHOR_VERSION],
    );
    return rows.map((row) => {
      const mapped = mapPairReturnRow(row);
      return {
        periodOpenUtc: mapped.periodOpenUtc,
        returnPct: mapped.returnPct,
        openPrice: mapped.openPrice,
        closePrice: mapped.closePrice,
      };
    });
  });
}
