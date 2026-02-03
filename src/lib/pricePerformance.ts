import { DateTime } from "luxon";
import type { AssetClass } from "./cotMarkets";
import type { PairSnapshot } from "./cotTypes";
import {
  readMarketSnapshot,
  writeMarketSnapshot,
  type MarketSnapshot,
  type PairPerformance,
} from "./priceStore";
import { fetchOandaCandle, getOandaInstrument } from "./oandaPrices";
import { fetchBitgetCandleRange } from "./bitget";

type PerformanceResult = {
  performance: Record<string, PairPerformance | null>;
  note: string;
  missingPairs: string[];
};

type PerformanceOptions = {
  assetClass?: AssetClass;
  reportDate?: string;
  isLatestReport?: boolean;
};

type WeekWindow = {
  openUtc: DateTime;
  closeUtc: DateTime;
  isHistorical: boolean;
  isPreOpen: boolean;
};

type SessionSpec = {
  openHour: number;
  openMinute?: number;
  closeHour: number;
  closeMinute?: number;
};

const NON_FX_SYMBOLS: Record<
  Exclude<AssetClass, "fx">,
  Record<string, string[]>
> = {
  indices: {
    SPX: ["SPX", "SPX500", "US500", "SPXUSD", "SPX500_USD"],
    NDX: ["NDX", "NAS100", "NDXUSD", "NAS100_USD"],
    NIKKEI: ["N225", "NI225", "JP225", "NKY", "NIKKEI", "NIKKEIUSD", "JP225_USD"],
  },
  crypto: {
    BTC: ["BTCUSD", "BTC/USD", "BTC_USD"],
    ETH: ["ETHUSD", "ETH/USD", "ETH_USD"],
  },
  commodities: {
    XAU: ["XAUUSD", "XAU/USD", "GOLD", "XAU_USD"],
    XAG: ["XAGUSD", "XAG/USD", "SILVER", "XAG_USD"],
    WTI: ["WTI", "USOIL", "CL", "WTIUSD", "WTICO_USD"],
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
  SPXUSD: ["SPX500_USD", "SPXUSD"],
  NDXUSD: ["NAS100_USD", "NDXUSD"],
  NIKKEIUSD: ["JP225_USD", "NIKKEIUSD"],
  BTCUSD: ["BTC_USD", "BTCUSD"],
  ETHUSD: ["ETH_USD", "ETHUSD"],
  XAUUSD: ["XAU_USD", "XAUUSD"],
  XAGUSD: ["XAG_USD", "XAGUSD"],
  WTIUSD: ["WTICO_USD", "WTIUSD"],
};

function hasOandaPricing(): boolean {
  return Boolean(process.env.OANDA_API_KEY) && Boolean(process.env.OANDA_ACCOUNT_ID);
}

function hasCryptoPricing(): boolean {
  return true;
}

function pipSize(pair: string, assetClass: AssetClass): number {
  if (assetClass !== "fx") {
    return 1;
  }
  return pair.includes("JPY") ? 0.01 : 0.0001;
}

function fxSymbol(pair: string): string {
  const base = pair.slice(0, 3);
  const quote = pair.slice(3);
  return `${base}/${quote}`;
}

function toIsoString(value: DateTime): string {
  return value.toISO() ?? new Date().toISOString();
}

function formatUtcLabel(isoValue: string) {
  const parsed = DateTime.fromISO(isoValue, { zone: "utc" });
  if (!parsed.isValid) {
    return isoValue;
  }
  return parsed.toFormat("MMM dd, yyyy HH:mm 'UTC'");
}

function getCryptoWeekOpenUtc(now: DateTime): DateTime {
  const utcNow = now.setZone("utc");
  return utcNow.startOf("week");
}

function getSessionSpec(assetClass: Exclude<AssetClass, "crypto">): SessionSpec {
  if (assetClass === "fx") {
    return { openHour: 17, closeHour: 17 };
  }
  return { openHour: 18, closeHour: 17 };
}

function getCryptoReportWindowUtc(
  reportDate: string,
): { openUtc: DateTime; closeUtc: DateTime } {
  const report = DateTime.fromISO(reportDate, { zone: "utc" });
  if (!report.isValid) {
    const openUtc = getCryptoWeekOpenUtc(DateTime.utc());
    return { openUtc, closeUtc: openUtc.plus({ weeks: 1 }) };
  }
  const nextMonday = report.startOf("week").plus({ weeks: 1 });
  const close = nextMonday.plus({ weeks: 1 });

  return { openUtc: nextMonday.toUTC(), closeUtc: close.toUTC() };
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

    const { openUtc, closeUtc } = getCryptoReportWindowUtc(reportDate);
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

export function getPerformanceWindow(options?: PerformanceOptions): WeekWindow {
  const assetClass = options?.assetClass ?? "fx";
  const now = DateTime.utc();
  return getWeekWindow(
    now,
    options?.reportDate,
    options?.isLatestReport ?? false,
    assetClass,
  );
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
    return override.map((symbol) => getOandaInstrument(symbol));
  }
  if (assetClass === "fx") {
    return [getOandaInstrument(pair), getOandaInstrument(fxSymbol(pair))];
  }
  const symbols = getNonFxSymbols(pair, assetClass);
  return symbols.length > 0 ? symbols.map((symbol) => getOandaInstrument(symbol)) : [getOandaInstrument(pair)];
}

function buildPerformanceValue(
  pair: string,
  assetClass: AssetClass,
  open: number,
  current: number,
  direction: PairSnapshot["direction"],
  openTimeIso: string,
  currentTimeIso: string,
): PairPerformance {
  const rawDelta = current - open;
  const percent = (rawDelta / open) * 100;
  const directionFactor = direction === "LONG" ? 1 : -1;
  const rawPips = rawDelta / pipSize(pair, assetClass);
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

function getCryptoBase(pair: string): "BTC" | "ETH" | null {
  if (pair.startsWith("BTC")) {
    return "BTC";
  }
  if (pair.startsWith("ETH")) {
    return "ETH";
  }
  return null;
}

async function fetchPairPerformanceWindow(
  pair: string,
  assetClass: AssetClass,
  info: PairSnapshot,
  window: { openUtc: DateTime; closeUtc: DateTime },
): Promise<PairPerformance | null> {
  if (window.closeUtc.toMillis() <= window.openUtc.toMillis()) {
    return null;
  }

  try {
    if (assetClass === "crypto") {
      const base = getCryptoBase(pair);
      if (!base) {
        return null;
      }
      const bitgetResult = await fetchBitgetCandleRange(base, window);
      if (bitgetResult) {
        return buildPerformanceValue(
          pair,
          assetClass,
          bitgetResult.open,
          bitgetResult.close,
          info.direction,
          bitgetResult.openTime,
          bitgetResult.closeTime,
        );
      }
      return null;
    }

    const oandaResult = await fetchOandaCandle(
      assetClass === "fx" ? fxSymbol(pair) : pair,
      window.openUtc,
      window.closeUtc,
    );
    if (oandaResult) {
      return buildPerformanceValue(
        pair,
        assetClass,
        oandaResult.open,
        oandaResult.close,
        info.direction,
        oandaResult.openTime,
        oandaResult.closeTime,
      );
    }
  } catch (error) {
    console.error(error);
  }

  return null;
}

export async function getPairPerformanceForWindows(
  pairs: Record<string, PairSnapshot>,
  windows: Record<string, { openUtc: DateTime; closeUtc: DateTime }>,
  options?: { assetClass?: AssetClass },
): Promise<PerformanceResult> {
  if (options?.assetClass === "crypto" ? !hasCryptoPricing() : !hasOandaPricing()) {
    return {
      performance: {},
      note: options?.assetClass === "crypto" ? "Crypto pricing not configured." : "OANDA pricing not configured.",
      missingPairs: Object.keys(pairs),
    };
  }

  const assetClass = options?.assetClass ?? "fx";
  const performance: Record<string, PairPerformance | null> = {};
  let missing = 0;
  const missingPairs: string[] = [];

  // Parallelize API calls instead of sequential for loop
  const results = await Promise.allSettled(
    Object.entries(pairs).map(async ([pair, info]) => {
      const window = windows[pair];
      if (!window) {
        return { pair, result: null, reason: "no_window" };
      }
      try {
        const result = await fetchPairPerformanceWindow(
          pair,
          assetClass,
          info,
          window,
        );
        return { pair, result, reason: result ? "success" : "no_data" };
      } catch (error) {
        console.error(error);
        return { pair, result: null, reason: "error" };
      }
    })
  );

  results.forEach((promiseResult) => {
    if (promiseResult.status === "fulfilled") {
      const { pair, result } = promiseResult.value;
      performance[pair] = result;
      if (!result) {
        missing += 1;
        missingPairs.push(pair);
      }
    } else {
      // This shouldn't happen with allSettled, but handle it anyway
      missing += 1;
    }
  });

  const totalPairs = Object.keys(pairs).length;
  const baseNote =
    missing > 0
      ? `Missing prices for ${missing}/${totalPairs}.`
      : "Prices ready.";
  const pricingNote = assetClass === "crypto" ? "Bitget pricing." : "OANDA pricing.";
  const note = `${baseNote} Sentiment windows applied. ${pricingNote}`;

  return { performance, note, missingPairs };
}

async function buildFxPerformance(
  pairs: Record<string, PairSnapshot>,
  window: WeekWindow,
): Promise<{
  performance: Record<string, PairPerformance | null>;
  missing: number;
  missingPairs: string[];
}> {
  const performance: Record<string, PairPerformance | null> = {};
  let missing = 0;
  const missingPairs: string[] = [];

  // Parallelize API calls instead of sequential for loop
  const results = await Promise.allSettled(
    Object.entries(pairs).map(async ([pair, info]) => {
      try {
        const oandaResult = await fetchOandaCandle(
          fxSymbol(pair),
          window.openUtc,
          window.closeUtc,
        );
        if (!oandaResult) {
          return { pair, result: null };
        }
        const result = buildPerformanceValue(
          pair,
          "fx",
          oandaResult.open,
          oandaResult.close,
          info.direction,
          oandaResult.openTime,
          oandaResult.closeTime,
        );
        return { pair, result };
      } catch (error) {
        console.error(error);
        return { pair, result: null };
      }
    })
  );

  results.forEach((promiseResult) => {
    if (promiseResult.status === "fulfilled") {
      const { pair, result } = promiseResult.value;
      performance[pair] = result;
      if (!result) {
        missing += 1;
        missingPairs.push(pair);
      }
    } else {
      missing += 1;
    }
  });

  return { performance, missing, missingPairs };
}

async function buildNonFxPerformance(
  pairs: Record<string, PairSnapshot>,
  assetClass: Exclude<AssetClass, "fx">,
  window: WeekWindow,
): Promise<PerformanceResult> {
  const performance: Record<string, PairPerformance | null> = {};
  let missing = 0;
  const missingPairs: string[] = [];

  // Parallelize API calls instead of sequential for loop
  const results = await Promise.allSettled(
    Object.entries(pairs).map(async ([pair, info]) => {
      try {
        if (assetClass === "crypto") {
          const base = getCryptoBase(pair);
          if (base) {
            const bitgetResult = await fetchBitgetCandleRange(base, window);
            if (bitgetResult) {
              const result = buildPerformanceValue(
                pair,
                assetClass,
                bitgetResult.open,
                bitgetResult.close,
                info.direction,
                bitgetResult.openTime,
                bitgetResult.closeTime,
              );
              return { pair, result };
            }
          }
        } else {
          const oandaResult = await fetchOandaCandle(
            pair,
            window.openUtc,
            window.closeUtc,
          );
          if (oandaResult) {
            const result = buildPerformanceValue(
              pair,
              assetClass,
              oandaResult.open,
              oandaResult.close,
              info.direction,
              oandaResult.openTime,
              oandaResult.closeTime,
            );
            return { pair, result };
          }
        }
        return { pair, result: null };
      } catch (error) {
        console.error(error);
        return { pair, result: null };
      }
    })
  );

  results.forEach((promiseResult) => {
    if (promiseResult.status === "fulfilled") {
      const { pair, result } = promiseResult.value;
      performance[pair] = result;
      if (!result) {
        missing += 1;
        missingPairs.push(pair);
      }
    } else {
      missing += 1;
    }
  });

  const totalPairs = Object.keys(pairs).length;
  const closeLabel = formatUtcLabel(toIsoString(window.closeUtc));
  const baseNote =
    missing > 0
      ? `Missing prices for ${missing}/${totalPairs}.`
      : "Prices ready.";
  const timingNote = window.isHistorical
    ? `Close ${closeLabel}. Historical performance uses weekly close.`
    : `Latest ${closeLabel}.`;
  const pricingNote = assetClass === "crypto" ? "Bitget pricing." : "OANDA pricing.";
  const note = `${baseNote} ${timingNote} ${pricingNote}`;

  return { performance, note, missingPairs };
}

export async function getPairPerformance(
  pairs: Record<string, PairSnapshot>,
  options?: PerformanceOptions,
): Promise<PerformanceResult> {
  if (options?.assetClass === "crypto" ? !hasCryptoPricing() : !hasOandaPricing()) {
    return {
      performance: {},
      note: options?.assetClass === "crypto" ? "Crypto pricing not configured." : "OANDA pricing not configured.",
      missingPairs: Object.keys(pairs),
    };
  }

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

  // Always try to use cached pricing data from DB first
  const snapshot = await readMarketSnapshot(weekOpenIso, assetClass);
  const allowHistoricalRecalc = process.env.ALLOW_HISTORICAL_RECALC === "true";

  // Skip cache for historical weeks if recalculation is forced
  if (snapshot && !(allowHistoricalRecalc && !isCurrentWeek)) {
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

    // For current week, check if cache is fresh
    if (isCurrentWeek) {
      const cacheSeconds = Number(process.env.PRICE_CACHE_SECONDS ?? "300");
      const ageSeconds =
        (now.toMillis() - DateTime.fromISO(snapshot.last_refresh_utc).toMillis()) /
        1000;
      const isFresh =
        Number.isFinite(ageSeconds) && ageSeconds <= cacheSeconds && missing === 0;

      if (isFresh) {
        const baseNote =
          missing > 0
            ? `Missing prices for ${missing}/${totalPairs}. Last refresh ${formatUtcLabel(
                snapshot.last_refresh_utc,
              )}.`
            : `Last refresh ${formatUtcLabel(snapshot.last_refresh_utc)}.`;
        const note =
          assetClass === "crypto"
            ? `${baseNote} Derived from Bitget pricing. Percent is raw; pips are direction-adjusted. Totals are direction-adjusted PnL.`
            : `${baseNote} Derived from OANDA pricing. Percent is raw; pips are direction-adjusted. Totals are direction-adjusted PnL.`;
        return { performance, note, missingPairs };
      }
    } else {
      // For historical weeks, ALWAYS use cached data (never fetch from APIs)
      const baseNote =
        missing > 0
          ? `Historical data. Missing prices for ${missing}/${totalPairs}. Snapshot from ${formatUtcLabel(
              snapshot.last_refresh_utc,
            )}.`
          : `Historical data. Snapshot from ${formatUtcLabel(snapshot.last_refresh_utc)}.`;
      const note =
        assetClass === "crypto"
          ? `${baseNote} Derived from Bitget pricing. Percent is raw; pips are direction-adjusted. Totals are direction-adjusted PnL.`
          : `${baseNote} Derived from OANDA pricing. Percent is raw; pips are direction-adjusted. Totals are direction-adjusted PnL.`;
      return { performance, note, missingPairs };
    }
  }

  // If no cached data exists for historical weeks and recalc is not forced, return empty result
  if (!isCurrentWeek && !allowHistoricalRecalc) {
    const performance: Record<string, PairPerformance | null> = {};
    Object.keys(pairs).forEach((pair) => {
      performance[pair] = null;
    });
    return {
      performance,
      note: "Historical pricing data not available. Run background refresh to populate.",
      missingPairs: Object.keys(pairs),
    };
  }

  if (assetClass !== "fx") {
    const result = await buildNonFxPerformance(pairs, assetClass, window);
    if (isCurrentWeek || allowHistoricalRecalc) {
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
  );

  if (isCurrentWeek || allowHistoricalRecalc) {
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
  const note = `${baseNote} Derived from OANDA pricing. Percent is raw; pips are direction-adjusted. Totals are direction-adjusted PnL.`;

  return { performance, note, missingPairs };
}

export async function refreshMarketSnapshot(
  pairs: Record<string, PairSnapshot>,
  options?: { force?: boolean; assetClass?: AssetClass },
): Promise<MarketSnapshot> {
  if (options?.assetClass === "crypto" ? !hasCryptoPricing() : !hasOandaPricing()) {
    throw new Error(
      options?.assetClass === "crypto"
        ? "Crypto pricing not configured."
        : "OANDA pricing not configured.",
    );
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

  const result =
    assetClass === "fx"
      ? await buildFxPerformance(pairs, window)
      : await buildNonFxPerformance(pairs, assetClass, window);
  const performance = "performance" in result ? result.performance : result;

  const nextSnapshot: MarketSnapshot = {
    week_open_utc: weekOpenUtc,
    last_refresh_utc: nowIso,
    asset_class: assetClass,
    pairs: performance,
  };

  await writeMarketSnapshot(nextSnapshot);

  return nextSnapshot;
}
