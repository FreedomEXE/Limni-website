/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: executionWeeklyReturns.ts
 *
 * Description:
 * Execution-layer weekly return derivation from canonical 1h bars. This keeps
 * raw market data canonical while measuring strategy P/L over tradable windows.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { CanonicalPriceBar } from "@/lib/canonicalPriceBars";
import { getCanonicalBars } from "@/lib/canonicalPriceBars";
import type { AssetClass } from "@/lib/cotMarkets";
import {
  EXECUTION_ANCHOR_VERSION,
  getExecutionWeekWindow,
} from "@/lib/executionPriceWindows";

export const EXECUTION_WEEKLY_RETURN_DERIVATION_VERSION = "v1_execution_monday_utc";

export type ExecutionWeeklyReturn = {
  symbol: string;
  assetClass: AssetClass;
  weekOpenUtc: string;
  periodOpenUtc: string;
  periodCloseUtc: string;
  windowOpenUtc: string;
  windowCloseUtc: string;
  openPrice: number;
  closePrice: number;
  highPrice: number;
  lowPrice: number;
  returnPct: number;
  source: "canonical_price_bars";
  derivedFromTimeframe: "1h";
  derivationVersion: typeof EXECUTION_WEEKLY_RETURN_DERIVATION_VERSION;
  anchorType: "execution";
  anchorVersion: typeof EXECUTION_ANCHOR_VERSION;
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
    throw new Error(`Cannot compute execution weekly return for open=${openPrice} close=${closePrice}`);
  }
  return round(((closePrice - openPrice) / openPrice) * 100, 6);
}

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase();
}

function normalizeBars(bars: CanonicalPriceBar[]) {
  return [...bars].sort((left, right) => left.barOpenUtc.localeCompare(right.barOpenUtc));
}

export function deriveExecutionWeeklyReturnFromHourlyBars(options: {
  symbol: string;
  assetClass: AssetClass;
  weekOpenUtc: string;
  bars: CanonicalPriceBar[];
}): ExecutionWeeklyReturn | null {
  const symbol = normalizeSymbol(options.symbol);
  const executionWindow = getExecutionWeekWindow(options.weekOpenUtc, options.assetClass);
  const windowOpenUtc = executionWindow.windowOpenUtc.toUTC().toISO() ?? options.weekOpenUtc;
  const windowCloseUtc = executionWindow.windowCloseUtc.toUTC().toISO() ?? options.weekOpenUtc;
  const sortedBars = normalizeBars(options.bars).filter((bar) => (
    bar.symbol.toUpperCase() === symbol &&
    bar.timeframe === "1h" &&
    bar.barOpenUtc >= windowOpenUtc &&
    bar.barOpenUtc < windowCloseUtc
  ));

  if (sortedBars.length === 0) return null;

  const first = sortedBars[0]!;
  const last = sortedBars[sortedBars.length - 1]!;
  const warnings: string[] = [];
  if (first.barOpenUtc !== windowOpenUtc) warnings.push("missing_exact_open_bar");
  if (last.barCloseUtc !== windowCloseUtc) warnings.push("missing_exact_close_bar");

  const openPrice = round(first.openPrice, 6);
  const closePrice = round(last.closePrice, 6);
  const highPrice = round(Math.max(...sortedBars.map((bar) => bar.highPrice)), 6);
  const lowPrice = round(Math.min(...sortedBars.map((bar) => bar.lowPrice)), 6);

  return {
    symbol,
    assetClass: options.assetClass,
    weekOpenUtc: executionWindow.logicalWeekOpenUtc,
    periodOpenUtc: executionWindow.logicalWeekOpenUtc,
    periodCloseUtc: windowCloseUtc,
    windowOpenUtc,
    windowCloseUtc,
    openPrice,
    closePrice,
    highPrice,
    lowPrice,
    returnPct: computeReturnPct(openPrice, closePrice),
    source: "canonical_price_bars",
    derivedFromTimeframe: "1h",
    derivationVersion: EXECUTION_WEEKLY_RETURN_DERIVATION_VERSION,
    anchorType: "execution",
    anchorVersion: executionWindow.anchorVersion,
    openBarOpenUtc: first.barOpenUtc,
    closeBarOpenUtc: last.barOpenUtc,
    barsInWindow: sortedBars.length,
    complete: warnings.length === 0,
    warnings,
  };
}

export async function loadExecutionWeeklyReturnFromHourlyBars(options: {
  symbol: string;
  assetClass: AssetClass;
  weekOpenUtc: string;
}): Promise<ExecutionWeeklyReturn | null> {
  const executionWindow = getExecutionWeekWindow(options.weekOpenUtc, options.assetClass);
  const bars = await getCanonicalBars(
    options.symbol,
    "1h",
    executionWindow.windowOpenUtc.toUTC().toISO() ?? options.weekOpenUtc,
    executionWindow.windowCloseUtc.toUTC().toISO() ?? options.weekOpenUtc,
  );
  return deriveExecutionWeeklyReturnFromHourlyBars({
    ...options,
    weekOpenUtc: executionWindow.logicalWeekOpenUtc,
    bars,
  });
}
