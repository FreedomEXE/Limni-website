/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: canonicalWeeklyReturns.ts
 *
 * Description:
 * Canonical weekly return derivation from 1h bars at exact Limni
 * asset-class-specific week windows. This is the source of truth for
 * weekly pair_period_returns rows.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { CanonicalPriceBar } from "@/lib/canonicalPriceBars";
import { getCanonicalBars } from "@/lib/canonicalPriceBars";
import type { AssetClass } from "@/lib/cotMarkets";
import { getCanonicalWeekWindow } from "@/lib/canonicalPriceWindows";

export const CANONICAL_WEEKLY_RETURN_DERIVATION_VERSION = "v3_intraday_weekly_early_close";

export type CanonicalWeeklyReturn = {
  symbol: string;
  assetClass: AssetClass;
  weekOpenUtc: string;
  periodOpenUtc: string;
  periodCloseUtc: string;
  openPrice: number;
  closePrice: number;
  highPrice: number;
  lowPrice: number;
  returnPct: number;
  source: "canonical_price_bars";
  derivedFromTimeframe: "1h";
  derivationVersion: typeof CANONICAL_WEEKLY_RETURN_DERIVATION_VERSION;
  openBarOpenUtc: string;
  closeBarOpenUtc: string;
  barsInWindow: number;
  complete: boolean;
  warnings: string[];
};

function round(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

function computeReturnPct(openPrice: number, closePrice: number) {
  if (!Number.isFinite(openPrice) || !Number.isFinite(closePrice) || openPrice <= 0) {
    throw new Error(`Cannot compute weekly return for open=${openPrice} close=${closePrice}`);
  }
  return round(((closePrice - openPrice) / openPrice) * 100, 6);
}

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase();
}

function normalizeBars(bars: CanonicalPriceBar[]) {
  return [...bars].sort((left, right) => left.barOpenUtc.localeCompare(right.barOpenUtc));
}

function resolveActualCloseUtc(expectedCloseUtc: string, actualCloseUtc: string, warnings: string[]) {
  if (actualCloseUtc === expectedCloseUtc) {
    return { closeUtc: expectedCloseUtc, closeIsComplete: true };
  }

  const expectedMs = Date.parse(expectedCloseUtc);
  const actualMs = Date.parse(actualCloseUtc);
  if (Number.isFinite(expectedMs) && Number.isFinite(actualMs) && actualMs < expectedMs) {
    warnings.push("inferred_early_close");
    return { closeUtc: actualCloseUtc, closeIsComplete: true };
  }

  warnings.push("close_after_window");
  return { closeUtc: actualCloseUtc, closeIsComplete: false };
}

export function deriveWeeklyReturnFromHourlyBars(options: {
  symbol: string;
  assetClass: AssetClass;
  weekOpenUtc: string;
  bars: CanonicalPriceBar[];
}): CanonicalWeeklyReturn | null {
  const symbol = normalizeSymbol(options.symbol);
  const weekWindow = getCanonicalWeekWindow(options.weekOpenUtc, options.assetClass);
  const periodOpenUtc = weekWindow.openUtc.toUTC().toISO() ?? options.weekOpenUtc;
  const periodCloseUtc = weekWindow.closeUtc.toUTC().toISO() ?? options.weekOpenUtc;
  const sortedBars = normalizeBars(options.bars).filter((bar) => (
    bar.symbol.toUpperCase() === symbol &&
    bar.timeframe === "1h" &&
    bar.barOpenUtc >= periodOpenUtc &&
    bar.barOpenUtc < periodCloseUtc
  ));

  if (sortedBars.length === 0) return null;

  const first = sortedBars[0]!;
  const last = sortedBars[sortedBars.length - 1]!;
  const warnings: string[] = [];
  const openIsComplete = first.barOpenUtc === periodOpenUtc;
  if (!openIsComplete) warnings.push("missing_exact_open_bar");
  const { closeUtc: actualPeriodCloseUtc, closeIsComplete } = resolveActualCloseUtc(
    periodCloseUtc,
    last.barCloseUtc,
    warnings,
  );

  const openPrice = round(first.openPrice, 6);
  const closePrice = round(last.closePrice, 6);
  const highPrice = round(Math.max(...sortedBars.map((bar) => bar.highPrice)), 6);
  const lowPrice = round(Math.min(...sortedBars.map((bar) => bar.lowPrice)), 6);

  return {
    symbol,
    assetClass: options.assetClass,
    weekOpenUtc: options.weekOpenUtc,
    periodOpenUtc,
    periodCloseUtc: actualPeriodCloseUtc,
    openPrice,
    closePrice,
    highPrice,
    lowPrice,
    returnPct: computeReturnPct(openPrice, closePrice),
    source: "canonical_price_bars",
    derivedFromTimeframe: "1h",
    derivationVersion: CANONICAL_WEEKLY_RETURN_DERIVATION_VERSION,
    openBarOpenUtc: first.barOpenUtc,
    closeBarOpenUtc: last.barOpenUtc,
    barsInWindow: sortedBars.length,
    complete: openIsComplete && closeIsComplete,
    warnings,
  };
}

export async function loadCanonicalWeeklyReturnFromHourlyBars(options: {
  symbol: string;
  assetClass: AssetClass;
  weekOpenUtc: string;
}): Promise<CanonicalWeeklyReturn | null> {
  const weekWindow = getCanonicalWeekWindow(options.weekOpenUtc, options.assetClass);
  const bars = await getCanonicalBars(
    options.symbol,
    "1h",
    weekWindow.openUtc.toUTC().toISO() ?? options.weekOpenUtc,
    weekWindow.closeUtc.toUTC().toISO() ?? options.weekOpenUtc,
  );
  return deriveWeeklyReturnFromHourlyBars({
    ...options,
    bars,
  });
}
