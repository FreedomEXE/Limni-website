const STANDARD_FX_CONTRACT_UNITS = 100_000;

export type FxSide = "BUY" | "SELL";

export type AccountingPriceBar = {
  timestamp_utc: string;
  timestamp_ms: number;
  close: number;
};

export type AccountingPriceSeries = {
  rawBars: AccountingPriceBar[];
};

export type CorrectedFxPnlParams = {
  symbol: string;
  side: FxSide;
  lotSize: number;
  entryPrice: number;
  exitPrice: number;
  exitTimeUtc: string;
  prices: Map<string, AccountingPriceSeries>;
  commissionUsdPerLot?: number;
  slippagePips?: number;
};

export type CorrectedFxPnlResult = {
  rawQuotePnl: number;
  conversionSymbol: string;
  conversionRate: number | null;
  conversionRateSource: string;
  usdPricePnl: number | null;
  commission: number;
  slippageUsd: number | null;
  net: number | null;
  expectedPipValue: number | null;
  actualPipValue: number | null;
  pips: number;
};

export function baseCurrency(pair: string) {
  return pair.slice(0, 3);
}

export function quoteCurrency(pair: string) {
  return pair.slice(3, 6);
}

export function pipSize(symbol: string) {
  return symbol.endsWith("JPY") ? 0.01 : 0.0001;
}

export function priceAtOrBefore<T extends AccountingPriceBar>(series: T[], timestampUtc: string): T | null {
  const target = Date.parse(timestampUtc);
  let left = 0;
  let right = series.length - 1;
  let found: T | null = null;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const row = series[mid]!;
    if (row.timestamp_ms <= target) {
      found = row;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return found;
}

export function correctedConversionRate(
  quote: string,
  timestampUtc: string,
  prices: Map<string, AccountingPriceSeries>,
) {
  if (quote === "USD") return { symbol: "USD", rate: 1, source: "quote_usd" };

  const direct = `${quote}USD`;
  const directPrice = prices.get(direct) ? priceAtOrBefore(prices.get(direct)!.rawBars, timestampUtc) : null;
  if (directPrice && directPrice.close > 0) {
    return { symbol: direct, rate: directPrice.close, source: "direct_quote_usd" };
  }

  const inverse = `USD${quote}`;
  const inversePrice = prices.get(inverse) ? priceAtOrBefore(prices.get(inverse)!.rawBars, timestampUtc) : null;
  if (inversePrice && inversePrice.close > 0) {
    return { symbol: inverse, rate: 1 / inversePrice.close, source: "inverse_usd_quote" };
  }

  return { symbol: `${quote}USD_OR_USD${quote}`, rate: null, source: "missing_conversion_price" };
}

export function correctedFxPnl(params: CorrectedFxPnlParams): CorrectedFxPnlResult {
  const units = params.lotSize * STANDARD_FX_CONTRACT_UNITS;
  const rawQuotePnl = params.side === "BUY"
    ? (params.exitPrice - params.entryPrice) * units
    : (params.entryPrice - params.exitPrice) * units;
  const quote = quoteCurrency(params.symbol);
  const conversion = baseCurrency(params.symbol) === "USD" && params.exitPrice > 0
    ? { symbol: params.symbol, rate: 1 / params.exitPrice, source: "base_usd_inverse_exit_price" }
    : correctedConversionRate(quote, params.exitTimeUtc, params.prices);
  const usdPricePnl = conversion.rate === null ? null : rawQuotePnl * conversion.rate;
  const commission = (params.commissionUsdPerLot ?? -7) * params.lotSize;
  const slippagePips = params.slippagePips ?? 0;
  const slippageUsd = conversion.rate === null
    ? null
    : -Math.abs(pipSize(params.symbol) * units * conversion.rate * slippagePips);
  const pips = Math.abs(params.exitPrice - params.entryPrice) / pipSize(params.symbol);
  const expectedPipValue = conversion.rate === null ? null : pipSize(params.symbol) * units * conversion.rate;
  const actualPipValue = usdPricePnl === null || pips === 0 ? null : Math.abs(usdPricePnl / pips);
  return {
    rawQuotePnl,
    conversionSymbol: conversion.symbol,
    conversionRate: conversion.rate,
    conversionRateSource: conversion.source,
    usdPricePnl,
    commission,
    slippageUsd,
    net: usdPricePnl === null || slippageUsd === null ? null : usdPricePnl + commission + slippageUsd,
    expectedPipValue,
    actualPipValue,
    pips,
  };
}
