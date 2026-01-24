import { DateTime } from "luxon";
import type { AssetClass } from "./cotMarkets";
import type { PairSnapshot } from "./cotTypes";
import {
  readMarketSnapshot,
  writeMarketSnapshot,
  type MarketSnapshot,
  type PairPerformance,
} from "./priceStore";
import { fetchOandaCandle } from "./oandaPrices";
import { fetchBitgetCandleRange } from "./bitget";

type PerformanceResult = {
  performance: Record<string, PairPerformance | null>;
  note: string;
  missingPairs: string[];
};

type PriceSources = {
  hasPriceApiKey: boolean;
  hasOanda: boolean;
  hasCmc: boolean;
  hasBitget: boolean;
};

function getPriceSources(): PriceSources {
  return {
    hasPriceApiKey: Boolean(process.env.PRICE_API_KEY),
    hasOanda: Boolean(process.env.OANDA_API_KEY) && Boolean(process.env.OANDA_ACCOUNT_ID),
    hasCmc: Boolean(process.env.COINMARKETCAP_API_KEY),
    hasBitget: true,
  };
}

class PriceCreditsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PriceCreditsError";
  }
}

function isCreditsError(message?: string, status?: number) {
  if (status === 429) {
    return true;
  }
  if (!message) {
    return false;
  }
  return message.toLowerCase().includes("api credits");
}

type PerformanceOptions = {
  assetClass?: AssetClass;
  reportDate?: string;
  isLatestReport?: boolean;
};

const MAJOR_PAIRS = [
  "EURUSD",
  "GBPUSD",
  "AUDUSD",
  "NZDUSD",
  "USDJPY",
  "USDCHF",
  "USDCAD",
] as const;

type MajorPair = (typeof MAJOR_PAIRS)[number];

type TimeSeriesValue = {
  datetime: string;
  open: string;
  close: string;
};

type MajorPrice = {
  open: number;
  current: number;
  open_time_utc: string;
  current_time_utc: string;
};

type UsdValue = {
  open: number;
  current: number;
  open_time_utc: string;
  current_time_utc: string;
};

type WeekWindow = {
  openUtc: DateTime;
  closeUtc: DateTime;
  isHistorical: boolean;
  isPreOpen: boolean;
};

const NON_FX_SYMBOLS: Record<
  Exclude<AssetClass, "fx">,
  Record<string, string[]>
> = {
  indices: {
    SPX: ["SPX", "SPX500", "US500", "SPXUSD"],
    NDX: ["NDX", "NAS100", "NDXUSD"],
    NIKKEI: ["N225", "NI225", "JP225", "NKY", "NIKKEI", "NIKKEIUSD"],
  },
  crypto: {
    BTC: ["BTC/USD", "BTCUSD"],
    ETH: ["ETH/USD", "ETHUSD"],
  },
  commodities: {
    XAU: ["XAU/USD", "XAUUSD", "GOLD"],
    XAG: ["XAG/USD", "XAGUSD", "SILVER"],
    WTI: ["WTI", "USOIL", "CL", "WTIUSD"],
  },
};

const SYMBOL_OVERRIDES: Partial<Record<string, string[]>> = {
  EURUSD: ["EUR/USD", "EURUSD"],
  AUDUSD: ["AUD/USD", "AUDUSD"],
  USDJPY: ["USD/JPY", "USDJPY"],
  EURGBP: ["EUR/GBP", "EURGBP"],
  EURCHF: ["EUR/CHF", "EURCHF"],
  EURNZD: ["EUR/NZD", "EURNZD"],
  EURCAD: ["EUR/CAD", "EURCAD"],
  GBPJPY: ["GBP/JPY", "GBPJPY"],
  GBPAUD: ["GBP/AUD", "GBPAUD"],
  AUDCHF: ["AUD/CHF", "AUDCHF"],
  AUDCAD: ["AUD/CAD", "AUDCAD"],
  AUDNZD: ["AUD/NZD", "AUDNZD"],
  NZDJPY: ["NZD/JPY", "NZDJPY"],
  CADJPY: ["CAD/JPY", "CADJPY"],
  CHFJPY: ["CHF/JPY", "CHFJPY"],
  SPXUSD: ["SPX", "SPX500", "US500", "SPXUSD", "SPX500_USD"],
  NDXUSD: ["NDX", "NAS100", "NDXUSD", "NAS100_USD"],
  NIKKEIUSD: ["N225", "NI225", "JP225", "NKY", "NIKKEI", "NIKKEIUSD", "JP225_USD"],
  BTCUSD: ["BTC/USD", "BTCUSD"],
  ETHUSD: ["ETH/USD", "ETHUSD"],
  XAUUSD: ["XAU/USD", "XAUUSD", "GOLD", "XAU_USD"],
  XAGUSD: ["XAG/USD", "XAGUSD", "SILVER", "XAG_USD"],
  WTIUSD: ["WTI", "USOIL", "CL", "WTIUSD", "WTICO_USD"],
};

function parseValue(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Invalid price value.");
  }
  return parsed;
}

function toIsoString(value: DateTime): string {
  return value.toISO() ?? new Date().toISOString();
}

function pipSize(pair: string, assetClass: AssetClass): number {
  if (assetClass !== "fx") {
    return 1;
  }
  return pair.includes("JPY") ? 0.01 : 0.0001;
}

function formatUtcLabel(isoValue: string) {
  const parsed = DateTime.fromISO(isoValue, { zone: "utc" });
  if (!parsed.isValid) {
    return isoValue;
  }
  return parsed.toFormat("MMM dd, yyyy HH:mm 'UTC'");
}

function getCryptoWeekOpenUtc(now: DateTime): DateTime {
  return now.setZone("America/New_York").startOf("week").toUTC();
}

type SessionSpec = {
  openHour: number;
  openMinute?: number;
  closeHour: number;
  closeMinute?: number;
};

function getSessionSpec(assetClass: Exclude<AssetClass, "crypto">): SessionSpec {
  if (assetClass === "fx") {
    return { openHour: 17, closeHour: 17 };
  }
  return { openHour: 18, closeHour: 17 };
}

function getSundaySessionOpenUtc(now: DateTime, spec: SessionSpec): DateTime {
  const nyNow = now.setZone("America/New_York");
  const daysSinceSunday = nyNow.weekday % 7;
  let sunday = nyNow.minus({ days: daysSinceSunday });
  const openToday = sunday.set({
    hour: spec.openHour,
    minute: spec.openMinute ?? 0,
    second: 0,
    millisecond: 0,
  });

  if (daysSinceSunday === 0 && nyNow.toMillis() < openToday.toMillis()) {
    sunday = sunday.minus({ days: 7 });
  }

  const open = sunday.set({
    hour: spec.openHour,
    minute: spec.openMinute ?? 0,
    second: 0,
    millisecond: 0,
  });

  return open.toUTC();
}

function getReportWindowUtc(
  reportDate: string,
  spec: SessionSpec,
): { openUtc: DateTime; closeUtc: DateTime } {
  const report = DateTime.fromISO(reportDate, { zone: "America/New_York" });
  if (!report.isValid) {
    const openUtc = getSundaySessionOpenUtc(DateTime.utc(), spec);
    return {
      openUtc,
      closeUtc: openUtc.plus({ days: 5 }),
    };
  }

  const daysUntilSunday = (7 - (report.weekday % 7)) % 7;
  const sunday = report
    .plus({ days: daysUntilSunday })
    .set({
      hour: spec.openHour,
      minute: spec.openMinute ?? 0,
      second: 0,
      millisecond: 0,
    });
  const friday = sunday
    .plus({ days: 5 })
    .set({
      hour: spec.closeHour,
      minute: spec.closeMinute ?? 0,
      second: 0,
      millisecond: 0,
    });

  return { openUtc: sunday.toUTC(), closeUtc: friday.toUTC() };
}

function getWeekWindow(
  now: DateTime,
  reportDate: string | undefined,
  isLatestReport: boolean,
  assetClass: AssetClass,
): WeekWindow {
  if (assetClass === "crypto") {
    if (!reportDate || isLatestReport) {
      const openUtc = getCryptoWeekOpenUtc(now);
      const isPreOpen = now.toMillis() < openUtc.toMillis();
      return {
        openUtc,
        closeUtc: isPreOpen ? openUtc : now,
        isHistorical: false,
        isPreOpen,
      };
    }

    const reportLocal = DateTime.fromISO(reportDate, { zone: "America/New_York" });
    if (!reportLocal.isValid) {
      const openUtc = getCryptoWeekOpenUtc(now);
      const isPreOpen = now.toMillis() < openUtc.toMillis();
      return {
        openUtc,
        closeUtc: isPreOpen ? openUtc : now,
        isHistorical: false,
        isPreOpen,
      };
    }

    const openLocal = reportLocal.startOf("week").plus({ weeks: 1 });
    const closeLocal = openLocal.plus({ weeks: 1 }).minus({ milliseconds: 1 });
    const openUtc = openLocal.toUTC();
    const closeUtc = closeLocal.toUTC();
    const isHistorical = closeUtc.toMillis() < now.toMillis();
    const isPreOpen = now.toMillis() < openUtc.toMillis();

    return {
      openUtc,
      closeUtc: isHistorical ? closeUtc : isPreOpen ? openUtc : now,
      isHistorical,
      isPreOpen,
    };
  }

  const spec = getSessionSpec(assetClass);

  if (!reportDate || isLatestReport) {
    const openUtc = getSundaySessionOpenUtc(now, spec);
    const isPreOpen = now.toMillis() < openUtc.toMillis();
    return { openUtc, closeUtc: isPreOpen ? openUtc : now, isHistorical: false, isPreOpen };
  }

  const { openUtc, closeUtc } = getReportWindowUtc(reportDate, spec);
  const isHistorical = closeUtc.toMillis() < now.toMillis();
  const isPreOpen = now.toMillis() < openUtc.toMillis();

  return {
    openUtc,
    closeUtc: isHistorical ? closeUtc : isPreOpen ? openUtc : now,
    isHistorical,
    isPreOpen,
  };
}

function fxSymbol(pair: string): string {
  const base = pair.slice(0, 3);
  const quote = pair.slice(3);
  return `${base}/${quote}`;
}

async function fetchCoinMarketCapQuote(symbol: string) {
  const apiKey = process.env.COINMARKETCAP_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("COINMARKETCAP_API_KEY is not configured.");
  }
  const url = new URL("https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("convert", "USD");

  const response = await fetch(url.toString(), {
    headers: { "X-CMC_PRO_API_KEY": apiKey },
  });
  if (!response.ok) {
    throw new Error(`CoinMarketCap price fetch failed (${symbol}).`);
  }
  const data = (await response.json()) as {
    data?: Record<string, { quote?: { USD?: { price?: number } } }>;
  };
  const price = data.data?.[symbol]?.quote?.USD?.price;
  if (!Number.isFinite(price)) {
    throw new Error(`CoinMarketCap missing price for ${symbol}.`);
  }
  return price as number;
}

async function fetchCryptoFallbackPrices(
  pair: string,
  window: WeekWindow,
  direction: PairSnapshot["direction"],
): Promise<PairPerformance | null> {
  const base = pair.slice(0, 3);
  const quote = pair.slice(3);
  if (quote !== "USD") {
    return null;
  }
  if (base !== "BTC" && base !== "ETH") {
    return null;
  }
  const candle = await fetchBitgetCandleRange(base, window);
  if (candle) {
    const rawDelta = candle.close - candle.open;
    const percent = (rawDelta / candle.open) * 100;
    const directionFactor = direction === "LONG" ? 1 : -1;
    const rawPips = rawDelta / pipSize(pair, "crypto");
    const pips = rawPips * directionFactor;
    return {
      open: candle.open,
      current: candle.close,
      percent,
      pips,
      open_time_utc: candle.openTime,
      current_time_utc: candle.closeTime,
    };
  }

  const current = await fetchCoinMarketCapQuote(base);
  return {
    open: current,
    current,
    percent: 0,
    pips: 0,
    open_time_utc: toIsoString(window.openUtc),
    current_time_utc: toIsoString(window.closeUtc),
  };
}

async function fetchTimeSeries(
  symbol: string,
  apiKey: string,
  options?: { interval?: string; outputsize?: number },
): Promise<TimeSeriesValue[]> {
  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", options?.interval ?? "1h");
  url.searchParams.set("outputsize", String(options?.outputsize ?? 500));
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url.toString(), { cache: "no-store" });
  const data = (await response.json()) as {
    status?: string;
    message?: string;
    values?: TimeSeriesValue[];
  };

  if (!response.ok || data.status === "error") {
    const message = data.message ?? `Price error for ${symbol}.`;
    if (isCreditsError(message, response.status)) {
      throw new PriceCreditsError(message);
    }
    throw new Error(message);
  }

  if (data.status === "error") {
    throw new Error(data.message ?? `Price error for ${symbol}.`);
  }

  if (!data.values || data.values.length === 0) {
    throw new Error(`No price data for ${symbol}.`);
  }

  return data.values;
}

function findOpenValue(
  values: TimeSeriesValue[],
  openTimeUtc: DateTime,
): { value: TimeSeriesValue; time: DateTime } {
  const openMillis = openTimeUtc.toMillis();
  let fallback = values[values.length - 1];
  let fallbackTime = DateTime.fromFormat(
    fallback.datetime,
    "yyyy-MM-dd HH:mm:ss",
    { zone: "UTC" },
  );

  for (let i = values.length - 1; i >= 0; i -= 1) {
    const candidate = values[i];
    const candidateTime = DateTime.fromFormat(
      candidate.datetime,
      "yyyy-MM-dd HH:mm:ss",
      { zone: "UTC" },
    );
    if (candidateTime.toMillis() >= openMillis) {
      return { value: candidate, time: candidateTime };
    }
  }

  return { value: fallback, time: fallbackTime };
}

function findCloseValue(
  values: TimeSeriesValue[],
  closeTimeUtc: DateTime,
): { value: TimeSeriesValue; time: DateTime } {
  const closeMillis = closeTimeUtc.toMillis();
  let fallback = values[0];
  let fallbackTime = DateTime.fromFormat(
    fallback.datetime,
    "yyyy-MM-dd HH:mm:ss",
    { zone: "UTC" },
  );

  for (const candidate of values) {
    const candidateTime = DateTime.fromFormat(
      candidate.datetime,
      "yyyy-MM-dd HH:mm:ss",
      { zone: "UTC" },
    );
    if (candidateTime.toMillis() <= closeMillis) {
      return { value: candidate, time: candidateTime };
    }
    fallback = candidate;
    fallbackTime = candidateTime;
  }

  return { value: fallback, time: fallbackTime };
}

async function fetchTimeSeriesWithFallbacks(
  symbol: string,
  apiKey: string,
  outputsize: number,
): Promise<TimeSeriesValue[]> {
  const intervals = ["1h", "4h", "1day"];
  let lastError: Error | null = null;
  for (const interval of intervals) {
    try {
      return await fetchTimeSeries(symbol, apiKey, { interval, outputsize });
    } catch (error) {
      if (error instanceof PriceCreditsError) {
        throw error;
      }
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error(`No price data for ${symbol}.`);
}

async function fetchFirstAvailableTimeSeries(
  symbols: string[],
  apiKey: string,
  outputsize: number,
): Promise<TimeSeriesValue[]> {
  let lastError: Error | null = null;
  for (const symbol of symbols) {
    try {
      return await fetchTimeSeriesWithFallbacks(symbol, apiKey, outputsize);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error("No price data for candidates.");
}

async function fetchMajorPrices(
  apiKey: string,
  weekOpenUtc: DateTime,
  weekCloseUtc: DateTime,
  outputsize: number,
): Promise<Record<MajorPair, MajorPrice | null>> {
  const prices = {} as Record<MajorPair, MajorPrice | null>;

  for (const pair of MAJOR_PAIRS) {
    try {
      const values = await fetchFirstAvailableTimeSeries(
        getPriceSymbolCandidates(pair, "fx"),
        apiKey,
        outputsize,
      );
      const { value: openValue, time: openTime } = findOpenValue(
        values,
        weekOpenUtc,
      );
      const { value: closeValue, time: closeTime } = findCloseValue(
        values,
        weekCloseUtc,
      );

      const open = parseValue(openValue.open);
      const current = parseValue(closeValue.close);

      prices[pair] = {
        open,
        current,
        open_time_utc: toIsoString(openTime),
        current_time_utc: toIsoString(closeTime),
      };
    } catch (error) {
      if (error instanceof PriceCreditsError) {
        throw error;
      }
      prices[pair] = null;
      console.error(error);
    }
  }

  return prices;
}

function buildUsdValues(
  majors: Record<MajorPair, MajorPrice | null>,
  weekOpenIso: string,
  nowIso: string,
): Record<string, UsdValue> {
  const values: Record<string, UsdValue> = {
    USD: {
      open: 1,
      current: 1,
      open_time_utc: weekOpenIso,
      current_time_utc: nowIso,
    },
  };

  const eurusd = majors.EURUSD;
  if (eurusd) {
    values.EUR = {
      open: eurusd.open,
      current: eurusd.current,
      open_time_utc: eurusd.open_time_utc,
      current_time_utc: eurusd.current_time_utc,
    };
  }

  const gbpusd = majors.GBPUSD;
  if (gbpusd) {
    values.GBP = {
      open: gbpusd.open,
      current: gbpusd.current,
      open_time_utc: gbpusd.open_time_utc,
      current_time_utc: gbpusd.current_time_utc,
    };
  }

  const audusd = majors.AUDUSD;
  if (audusd) {
    values.AUD = {
      open: audusd.open,
      current: audusd.current,
      open_time_utc: audusd.open_time_utc,
      current_time_utc: audusd.current_time_utc,
    };
  }

  const nzdusd = majors.NZDUSD;
  if (nzdusd) {
    values.NZD = {
      open: nzdusd.open,
      current: nzdusd.current,
      open_time_utc: nzdusd.open_time_utc,
      current_time_utc: nzdusd.current_time_utc,
    };
  }

  const usdjpy = majors.USDJPY;
  if (usdjpy) {
    values.JPY = {
      open: 1 / usdjpy.open,
      current: 1 / usdjpy.current,
      open_time_utc: usdjpy.open_time_utc,
      current_time_utc: usdjpy.current_time_utc,
    };
  }

  const usdchf = majors.USDCHF;
  if (usdchf) {
    values.CHF = {
      open: 1 / usdchf.open,
      current: 1 / usdchf.current,
      open_time_utc: usdchf.open_time_utc,
      current_time_utc: usdchf.current_time_utc,
    };
  }

  const usdcad = majors.USDCAD;
  if (usdcad) {
    values.CAD = {
      open: 1 / usdcad.open,
      current: 1 / usdcad.current,
      open_time_utc: usdcad.open_time_utc,
      current_time_utc: usdcad.current_time_utc,
    };
  }

  return values;
}

function getNonFxSymbols(
  pair: string,
  assetClass: Exclude<AssetClass, "fx">,
): string[] {
  const override = SYMBOL_OVERRIDES[pair];
  if (override && override.length > 0) {
    return override;
  }
  const symbolMap = NON_FX_SYMBOLS[assetClass];
  const base = Object.keys(symbolMap).find((key) => pair.startsWith(key));
  if (!base) {
    return [];
  }
  const symbols = symbolMap[base];
  return symbols.includes(pair) ? symbols : [pair, ...symbols];
}

export function getPriceSymbolCandidates(
  pair: string,
  assetClass: AssetClass,
): string[] {
  const override = SYMBOL_OVERRIDES[pair];
  if (override && override.length > 0) {
    return override;
  }
  if (assetClass === "fx") {
    return [fxSymbol(pair), pair];
  }
  return getNonFxSymbols(pair, assetClass);
}

function buildFxPerformanceValue(
  pair: string,
  open: number,
  current: number,
  direction: PairSnapshot["direction"],
  openTimeIso: string,
  currentTimeIso: string,
): PairPerformance {
  const rawDelta = current - open;
  const percent = (rawDelta / open) * 100;
  const directionFactor = direction === "LONG" ? 1 : -1;
  const rawPips = rawDelta / pipSize(pair, "fx");
  const pips = rawPips * directionFactor;

  return {
    open,
    current,
    percent,
    pips,
    open_time_utc: openTimeIso,
    current_time_utc: currentTimeIso,
  };
}

async function fetchFxDirectPerformance(
  pair: string,
  info: PairSnapshot,
  window: WeekWindow,
  apiKey: string,
  outputsize: number,
): Promise<PairPerformance | null> {
  try {
    const values = await fetchFirstAvailableTimeSeries(
      getPriceSymbolCandidates(pair, "fx"),
      apiKey,
      outputsize,
    );
    const { value: openValue, time: openTime } = findOpenValue(
      values,
      window.openUtc,
    );
    const { value: closeValue, time: closeTime } = findCloseValue(
      values,
      window.closeUtc,
    );
    const open = parseValue(openValue.open);
    const current = parseValue(closeValue.close);

    return buildFxPerformanceValue(
      pair,
      open,
      current,
      info.direction,
      toIsoString(openTime),
      toIsoString(closeTime),
    );
  } catch (error) {
    const oandaResult = await fetchOandaCandle(
      fxSymbol(pair),
      window.openUtc,
      window.closeUtc,
    );
    if (oandaResult) {
      return buildFxPerformanceValue(
        pair,
        oandaResult.open,
        oandaResult.close,
        info.direction,
        oandaResult.openTime,
        oandaResult.closeTime,
      );
    }
    console.error(error);
    return null;
  }
}

async function buildFxPerformance(
  pairs: Record<string, PairSnapshot>,
  window: WeekWindow,
  apiKey?: string,
  options?: { allowDirectFallback?: boolean },
): Promise<{
  performance: Record<string, PairPerformance | null>;
  missing: number;
  missingPairs: string[];
}> {
  if (!apiKey) {
    const performance: Record<string, PairPerformance | null> = {};
    let missing = 0;
    const missingPairs: string[] = [];
    for (const [pair, info] of Object.entries(pairs)) {
      try {
        const oandaResult = await fetchOandaCandle(
          fxSymbol(pair),
          window.openUtc,
          window.closeUtc,
        );
        if (!oandaResult) {
          performance[pair] = null;
          missing += 1;
          missingPairs.push(pair);
          continue;
        }
        performance[pair] = buildFxPerformanceValue(
          pair,
          oandaResult.open,
          oandaResult.close,
          info.direction,
          oandaResult.openTime,
          oandaResult.closeTime,
        );
      } catch (error) {
        console.error(error);
        performance[pair] = null;
        missing += 1;
        missingPairs.push(pair);
      }
    }
    return { performance, missing, missingPairs };
  }
  const outputsize = window.isHistorical ? 2000 : 500;
  const majors = await fetchMajorPrices(
    apiKey,
    window.openUtc,
    window.closeUtc,
    outputsize,
  );
  const usdValues = buildUsdValues(
    majors,
    toIsoString(window.openUtc),
    toIsoString(window.closeUtc),
  );

  const performance: Record<string, PairPerformance | null> = {};
  let missing = 0;
  const missingPairs: string[] = [];
  const unresolved: Array<[string, PairSnapshot]> = [];

  for (const [pair, info] of Object.entries(pairs)) {
    const base = pair.slice(0, 3);
    const quote = pair.slice(3);
    const baseValue = usdValues[base];
    const quoteValue = usdValues[quote];

    if (!baseValue || !quoteValue) {
      performance[pair] = null;
      missing += 1;
      missingPairs.push(pair);
      unresolved.push([pair, info]);
      continue;
    }

    const open = baseValue.open / quoteValue.open;
    const current = baseValue.current / quoteValue.current;
    performance[pair] = buildFxPerformanceValue(
      pair,
      open,
      current,
      info.direction,
      toIsoString(window.openUtc),
      toIsoString(window.closeUtc),
    );
  }

  if (options?.allowDirectFallback && unresolved.length > 0) {
    for (const [pair, info] of unresolved) {
      const direct = await fetchFxDirectPerformance(
        pair,
        info,
        window,
        apiKey,
        outputsize,
      );
      if (direct) {
        performance[pair] = direct;
        missing -= 1;
        const index = missingPairs.indexOf(pair);
        if (index >= 0) {
          missingPairs.splice(index, 1);
        }
      }
    }
  }

  return { performance, missing, missingPairs };
}

async function buildNonFxPerformance(
  pairs: Record<string, PairSnapshot>,
  assetClass: Exclude<AssetClass, "fx">,
  window: WeekWindow,
  apiKey?: string,
): Promise<PerformanceResult> {
  const performance: Record<string, PairPerformance | null> = {};
  const outputsize = window.isHistorical ? 2000 : 500;
  let missing = 0;
  const missingPairs: string[] = [];

  for (const [pair, info] of Object.entries(pairs)) {
    let resolved = false;

    if (assetClass === "crypto") {
      try {
        const fallback = await fetchCryptoFallbackPrices(pair, window, info.direction);
        if (fallback) {
          performance[pair] = fallback;
          resolved = true;
        }
      } catch (error) {
        console.error(error);
      }
    }

    if (resolved) {
      continue;
    }

    const symbols = apiKey ? getPriceSymbolCandidates(pair, assetClass) : [];
    if (apiKey && symbols.length === 0) {
      performance[pair] = null;
      missing += 1;
      missingPairs.push(pair);
      continue;
    }

    if (apiKey) {
      for (const symbol of symbols) {
        try {
          const values = await fetchTimeSeriesWithFallbacks(
            symbol,
            apiKey,
            outputsize,
          );
          const { value: openValue, time: openTime } = findOpenValue(
            values,
            window.openUtc,
          );
          const { value: closeValue, time: closeTime } = findCloseValue(
            values,
            window.closeUtc,
          );
          const open = parseValue(openValue.open);
          const current = parseValue(closeValue.close);
          const directionFactor = info.direction === "LONG" ? 1 : -1;
          const rawDelta = current - open;
          const percent = (rawDelta / open) * 100;
          const rawPips = rawDelta / pipSize(pair, assetClass);
          const pips = rawPips * directionFactor;

          performance[pair] = {
            open,
            current,
            percent,
            pips,
            open_time_utc: toIsoString(openTime),
            current_time_utc: toIsoString(closeTime),
          };
          resolved = true;
          break;
        } catch (error) {
          if (error instanceof PriceCreditsError) {
            throw error;
          }
          console.error(error);
        }
      }
    }

    if (!resolved) {
      try {
        const oandaResult = await fetchOandaCandle(
          pair,
          window.openUtc,
          window.closeUtc,
        );
        if (oandaResult) {
          const directionFactor = info.direction === "LONG" ? 1 : -1;
          const rawDelta = oandaResult.close - oandaResult.open;
          const percent = (rawDelta / oandaResult.open) * 100;
          const rawPips = rawDelta / pipSize(pair, assetClass);
          const pips = rawPips * directionFactor;
          performance[pair] = {
            open: oandaResult.open,
            current: oandaResult.close,
            percent,
            pips,
            open_time_utc: oandaResult.openTime,
            current_time_utc: oandaResult.closeTime,
          };
          resolved = true;
        }
      } catch (error) {
        console.error(error);
      }
    }

    if (!resolved) {
      performance[pair] = null;
      missing += 1;
      missingPairs.push(pair);
    }
  }

  const totalPairs = Object.keys(pairs).length;
  const closeLabel = formatUtcLabel(toIsoString(window.closeUtc));
  const baseNote =
    missing > 0
      ? `Missing prices for ${missing}/${totalPairs}.`
      : `Prices ready.`;
  const timingNote = window.isHistorical
    ? `Close ${closeLabel}. Historical performance uses weekly close.`
    : `Latest ${closeLabel}.`;
  const note = `${baseNote} ${timingNote}`;

  return { performance, note, missingPairs };
}

export async function getPairPerformance(
  pairs: Record<string, PairSnapshot>,
  options?: PerformanceOptions,
): Promise<PerformanceResult> {
  const apiKey = process.env.PRICE_API_KEY;
  const sources = getPriceSources();
  const assetClass = options?.assetClass ?? "fx";
  const now = DateTime.utc();
  const window = getWeekWindow(
    now,
    options?.reportDate,
    options?.isLatestReport ?? false,
    assetClass,
  );
  const weekOpenIso = toIsoString(window.openUtc);
  const currentWeekOpenIso =
    assetClass === "crypto"
      ? toIsoString(getCryptoWeekOpenUtc(now))
      : toIsoString(getSundaySessionOpenUtc(now, getSessionSpec(assetClass)));
  const isCurrentWeek = weekOpenIso === currentWeekOpenIso;
  const isPreOpen = window.isPreOpen;

  if (isPreOpen) {
    const performance: Record<string, PairPerformance | null> = {};
    Object.keys(pairs).forEach((pair) => {
      performance[pair] = {
        open: 0,
        current: 0,
        percent: 0,
        pips: 0,
        open_time_utc: weekOpenIso,
        current_time_utc: weekOpenIso,
      };
    });
    return {
      performance,
      note: "Week has not started yet. Returns will populate after the report week opens.",
      missingPairs: [],
    };
  }

  try {
    if (isCurrentWeek) {
      const snapshot = await readMarketSnapshot(weekOpenIso, assetClass);
      if (snapshot) {
        const totalPairs = Object.keys(pairs).length;
        const performance: Record<string, PairPerformance | null> = {};
        let missing = 0;
        const missingPairs: string[] = [];
        for (const pair of Object.keys(pairs)) {
          const value = snapshot.pairs[pair] ?? null;
          if (!value) {
            missing += 1;
            missingPairs.push(pair);
          }
          performance[pair] = value;
        }

        const cacheSeconds = Number(process.env.PRICE_CACHE_SECONDS ?? "300");
        const ageSeconds =
          (now.toMillis() - DateTime.fromISO(snapshot.last_refresh_utc).toMillis()) /
          1000;
        const isFresh =
          Number.isFinite(ageSeconds) && ageSeconds <= cacheSeconds && missing === 0;

        if (isFresh || (!apiKey && !sources.hasOanda && !sources.hasCmc)) {
          const baseNote =
            missing > 0
              ? `Missing prices for ${missing}/${totalPairs}. Last refresh ${formatUtcLabel(
                  snapshot.last_refresh_utc,
                )}.`
              : `Last refresh ${formatUtcLabel(snapshot.last_refresh_utc)}.`;
            const sourceNote = apiKey
              ? "Derived from majors."
              : "Derived from direct OANDA pricing.";
            const note =
              assetClass === "fx"
                ? `${baseNote} ${sourceNote} Percent is raw; pips are direction-adjusted. Totals are direction-adjusted PnL.`
                : `${baseNote} Percent is raw; pips are direction-adjusted. Totals are direction-adjusted PnL.`;
          return { performance, note, missingPairs };
        }
      }
    }

    if (!apiKey && !sources.hasOanda && !sources.hasCmc) {
      return {
        performance: {},
        note: "No price source configured.",
        missingPairs: [],
      };
    }

  if (assetClass !== "fx") {
    const result = await buildNonFxPerformance(pairs, assetClass, window, apiKey);
    if (isCurrentWeek) {
      const snapshot: MarketSnapshot = {
        week_open_utc: weekOpenIso,
        last_refresh_utc: toIsoString(now),
        asset_class: assetClass,
        pairs: result.performance,
      };
      await writeMarketSnapshot(snapshot);
    }
    return result;
  }

  const { performance, missing, missingPairs } = await buildFxPerformance(
    pairs,
    window,
    apiKey,
    {
      allowDirectFallback: true,
    },
  );

  if (isCurrentWeek) {
    const snapshot: MarketSnapshot = {
      week_open_utc: weekOpenIso,
      last_refresh_utc: toIsoString(now),
      asset_class: assetClass,
      pairs: performance,
    };
    await writeMarketSnapshot(snapshot);
  }

  const totalPairs = Object.keys(pairs).length;
  const closeLabel = formatUtcLabel(toIsoString(window.closeUtc));
  const timingNote = window.isHistorical
    ? `Close ${closeLabel}.`
    : isCurrentWeek
      ? `Last refresh ${formatUtcLabel(toIsoString(now))}.`
      : `Latest ${closeLabel}.`;
  const baseNote =
    missing > 0
      ? `Missing prices for ${missing}/${totalPairs}. ${timingNote}`
      : `${timingNote}`;
    const sourceNote = apiKey
      ? "Derived from majors."
      : "Derived from direct OANDA pricing.";
    const note = `${baseNote} ${sourceNote} Percent is raw; pips are direction-adjusted. Totals are direction-adjusted PnL.`;

    return { performance, note, missingPairs };
  } catch (error) {
    if (error instanceof PriceCreditsError) {
      if (sources.hasOanda || sources.hasCmc) {
        if (assetClass !== "fx") {
          const result = await buildNonFxPerformance(pairs, assetClass, window);
          if (isCurrentWeek) {
            const snapshot: MarketSnapshot = {
              week_open_utc: weekOpenIso,
              last_refresh_utc: toIsoString(now),
              asset_class: assetClass,
              pairs: result.performance,
            };
            await writeMarketSnapshot(snapshot);
          }
          return result;
        }

        const { performance, missingPairs } = await buildFxPerformance(
          pairs,
          window,
          undefined,
        );
        if (isCurrentWeek) {
          const snapshot: MarketSnapshot = {
            week_open_utc: weekOpenIso,
            last_refresh_utc: toIsoString(now),
            asset_class: assetClass,
            pairs: performance,
          };
          await writeMarketSnapshot(snapshot);
        }
        const totalPairs = Object.keys(pairs).length;
        const closeLabel = formatUtcLabel(toIsoString(window.closeUtc));
        const timingNote = window.isHistorical
          ? `Close ${closeLabel}.`
          : isCurrentWeek
            ? `Last refresh ${formatUtcLabel(toIsoString(now))}.`
            : `Latest ${closeLabel}.`;
        const baseNote =
          missingPairs.length > 0
            ? `Missing prices for ${missingPairs.length}/${totalPairs}. ${timingNote}`
            : `${timingNote}`;
        const note = `${baseNote} Derived from direct OANDA pricing. Percent is raw; pips are direction-adjusted. Totals are direction-adjusted PnL.`;
        return { performance, note, missingPairs };
      }
      return {
        performance: {},
        note: "Price API credits exhausted. Try again after the daily reset.",
        missingPairs: Object.keys(pairs),
      };
    }
    throw error;
  }
}

export async function refreshMarketSnapshot(
  pairs: Record<string, PairSnapshot>,
  options?: { force?: boolean; assetClass?: AssetClass },
): Promise<MarketSnapshot> {
  const apiKey = process.env.PRICE_API_KEY;
  const sources = getPriceSources();
  if (!apiKey && !sources.hasOanda && !sources.hasCmc) {
    throw new Error("No price source configured.");
  }

  const assetClass = options?.assetClass ?? "fx";
  const now = DateTime.utc();
  const nowIso = toIsoString(now);
  const weekOpenUtc = toIsoString(
    assetClass === "crypto"
      ? getCryptoWeekOpenUtc(now)
      : getSundaySessionOpenUtc(now, getSessionSpec(assetClass)),
  );
  const weekOpenTime = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const weekOpenBase = weekOpenTime.isValid ? weekOpenTime : now;
  const cacheSeconds = Number(process.env.PRICE_CACHE_SECONDS ?? "300");
  const snapshot = await readMarketSnapshot(weekOpenUtc, assetClass);

  if (snapshot && snapshot.week_open_utc === weekOpenUtc && options?.force !== true) {
    const ageSeconds =
      (now.toMillis() - DateTime.fromISO(snapshot.last_refresh_utc).toMillis()) /
      1000;
    const hasMissing = Object.values(snapshot.pairs).some((value) => value === null);
    if (Number.isFinite(ageSeconds) && ageSeconds <= cacheSeconds && !hasMissing) {
      return snapshot;
    }
  }

  const window: WeekWindow = {
    openUtc: weekOpenBase,
    closeUtc: now,
    isHistorical: false,
    isPreOpen: assetClass === "crypto" ? false : now.toMillis() < weekOpenBase.toMillis(),
  };
  let performance: Record<string, PairPerformance | null> = {};
  try {
    const result =
      assetClass === "fx"
        ? await buildFxPerformance(pairs, window, apiKey, {
            allowDirectFallback: true,
          })
        : await buildNonFxPerformance(pairs, assetClass, window, apiKey);
    performance = "performance" in result ? result.performance : result;
  } catch (error) {
    if (error instanceof PriceCreditsError && sources.hasOanda) {
      const result =
        assetClass === "fx"
          ? await buildFxPerformance(pairs, window, undefined)
          : await buildNonFxPerformance(pairs, assetClass, window);
      performance = "performance" in result ? result.performance : result;
    } else {
      throw error;
    }
  }

  const nextSnapshot: MarketSnapshot = {
    week_open_utc: weekOpenUtc,
    last_refresh_utc: nowIso,
    asset_class: assetClass,
    pairs: performance,
  };

  await writeMarketSnapshot(nextSnapshot);

  return nextSnapshot;
}
