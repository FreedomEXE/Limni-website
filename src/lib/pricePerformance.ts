import { DateTime } from "luxon";
import type { AssetClass } from "./cotMarkets";
import type { PairSnapshot } from "./cotTypes";
import {
  readMarketSnapshot,
  writeMarketSnapshot,
  type MarketSnapshot,
  type PairPerformance,
} from "./priceStore";

type PerformanceResult = {
  performance: Record<string, PairPerformance | null>;
  note: string;
};

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
};

const NON_FX_SYMBOLS: Record<
  Exclude<AssetClass, "fx">,
  Record<string, string[]>
> = {
  indices: {
    SPX: ["SPX", "SPX500", "US500"],
    NDX: ["NDX", "NAS100"],
    NIKKEI: ["N225", "NI225", "JP225"],
  },
  crypto: {
    BTC: ["BTC/USD", "BTCUSD"],
    ETH: ["ETH/USD", "ETHUSD"],
  },
  commodities: {
    XAU: ["XAU/USD", "XAUUSD", "GOLD"],
    XAG: ["XAG/USD", "XAGUSD", "SILVER"],
    WTI: ["WTI", "USOIL", "CL"],
  },
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

function getSundayOpenUtc(now: DateTime): DateTime {
  const nyNow = now.setZone("America/New_York");
  const daysSinceSunday = nyNow.weekday % 7;
  let sunday = nyNow.minus({ days: daysSinceSunday });

  if (daysSinceSunday === 0 && nyNow.hour < 19) {
    sunday = sunday.minus({ days: 7 });
  }

  const open = sunday.set({
    hour: 19,
    minute: 0,
    second: 0,
    millisecond: 0,
  });

  return open.toUTC();
}

function getWeekWindow(
  now: DateTime,
  reportDate?: string,
  isLatestReport = false,
): WeekWindow {
  if (!reportDate || isLatestReport) {
    return { openUtc: getSundayOpenUtc(now), closeUtc: now, isHistorical: false };
  }

  const report = DateTime.fromISO(reportDate, { zone: "America/New_York" });
  if (!report.isValid) {
    return { openUtc: getSundayOpenUtc(now), closeUtc: now, isHistorical: false };
  }

  const daysSinceSunday = report.weekday % 7;
  const sunday = report
    .minus({ days: daysSinceSunday })
    .set({ hour: 19, minute: 0, second: 0, millisecond: 0 });

  const fridayOffset = (5 - report.weekday + 7) % 7;
  const friday = report
    .plus({ days: fridayOffset })
    .set({ hour: 17, minute: 0, second: 0, millisecond: 0 });

  const openUtc = sunday.toUTC();
  const closeUtc = friday.toUTC();
  const isHistorical = closeUtc.toMillis() < now.toMillis();

  return {
    openUtc,
    closeUtc: isHistorical ? closeUtc : now,
    isHistorical,
  };
}

function fxSymbol(pair: string): string {
  const base = pair.slice(0, 3);
  const quote = pair.slice(3);
  return `${base}/${quote}`;
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
  if (!response.ok) {
    throw new Error(`Price fetch failed (${symbol}).`);
  }

  const data = (await response.json()) as {
    status?: string;
    message?: string;
    values?: TimeSeriesValue[];
  };

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

async function fetchMajorPrices(
  apiKey: string,
  weekOpenUtc: DateTime,
  weekCloseUtc: DateTime,
  outputsize: number,
): Promise<Record<MajorPair, MajorPrice | null>> {
  const prices = {} as Record<MajorPair, MajorPrice | null>;

  for (const pair of MAJOR_PAIRS) {
    try {
      const values = await fetchTimeSeries(fxSymbol(pair), apiKey, {
        outputsize,
      });
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
  const symbolMap = NON_FX_SYMBOLS[assetClass];
  const base = Object.keys(symbolMap).find((key) => pair.startsWith(key));
  return base ? symbolMap[base] : [];
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
    const values = await fetchTimeSeries(fxSymbol(pair), apiKey, { outputsize });
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
    console.error(error);
    return null;
  }
}

async function buildFxPerformance(
  pairs: Record<string, PairSnapshot>,
  window: WeekWindow,
  apiKey: string,
  options?: { allowDirectFallback?: boolean },
): Promise<{ performance: Record<string, PairPerformance | null>; missing: number }> {
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
  const unresolved: Array<[string, PairSnapshot]> = [];

  for (const [pair, info] of Object.entries(pairs)) {
    const base = pair.slice(0, 3);
    const quote = pair.slice(3);
    const baseValue = usdValues[base];
    const quoteValue = usdValues[quote];

    if (!baseValue || !quoteValue) {
      performance[pair] = null;
      missing += 1;
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
      }
    }
  }

  return { performance, missing };
}

async function buildNonFxPerformance(
  pairs: Record<string, PairSnapshot>,
  assetClass: Exclude<AssetClass, "fx">,
  window: WeekWindow,
  apiKey: string,
): Promise<PerformanceResult> {
  const performance: Record<string, PairPerformance | null> = {};
  const outputsize = window.isHistorical ? 2000 : 500;
  let missing = 0;

  for (const [pair, info] of Object.entries(pairs)) {
    const symbols = getNonFxSymbols(pair, assetClass);
    if (symbols.length === 0) {
      performance[pair] = null;
      missing += 1;
      continue;
    }

    let resolved = false;
    for (const symbol of symbols) {
      try {
        const values = await fetchTimeSeries(symbol, apiKey, { outputsize });
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
        console.error(error);
      }
    }

    if (!resolved) {
      performance[pair] = null;
      missing += 1;
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

  return { performance, note };
}

export async function getPairPerformance(
  pairs: Record<string, PairSnapshot>,
  options?: PerformanceOptions,
): Promise<PerformanceResult> {
  const apiKey = process.env.PRICE_API_KEY;
  const assetClass = options?.assetClass ?? "fx";
  const now = DateTime.utc();
  const window = getWeekWindow(now, options?.reportDate, options?.isLatestReport);
  const weekOpenIso = toIsoString(window.openUtc);
  const currentWeekOpenIso = toIsoString(getSundayOpenUtc(now));
  const isCurrentWeek = weekOpenIso === currentWeekOpenIso;

  if (isCurrentWeek) {
    const snapshot = await readMarketSnapshot(weekOpenIso, assetClass);
    if (snapshot) {
      const totalPairs = Object.keys(pairs).length;
      const performance: Record<string, PairPerformance | null> = {};
      let missing = 0;
      for (const pair of Object.keys(pairs)) {
        const value = snapshot.pairs[pair] ?? null;
        if (!value) {
          missing += 1;
        }
        performance[pair] = value;
      }

      const cacheSeconds = Number(process.env.PRICE_CACHE_SECONDS ?? "300");
      const ageSeconds =
        (now.toMillis() - DateTime.fromISO(snapshot.last_refresh_utc).toMillis()) /
        1000;
      const isFresh =
        Number.isFinite(ageSeconds) && ageSeconds <= cacheSeconds && missing === 0;

      if (isFresh || !apiKey) {
        const baseNote =
          missing > 0
            ? `Missing prices for ${missing}/${totalPairs}. Last refresh ${formatUtcLabel(
                snapshot.last_refresh_utc,
              )}.`
            : `Last refresh ${formatUtcLabel(snapshot.last_refresh_utc)}.`;
        const note =
          assetClass === "fx"
            ? `${baseNote} Derived from majors. Percent is raw; pips are direction-adjusted. Totals are direction-adjusted PnL.`
            : `${baseNote} Percent is raw; pips are direction-adjusted. Totals are direction-adjusted PnL.`;
        return { performance, note };
      }
    }
  }

  if (!apiKey) {
    return { performance: {}, note: "PRICE_API_KEY is not configured." };
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

  const { performance, missing } = await buildFxPerformance(pairs, window, apiKey, {
    allowDirectFallback: true,
  });

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
  const note = `${baseNote} Derived from majors. Percent is raw; pips are direction-adjusted. Totals are direction-adjusted PnL.`;

  return { performance, note };
}

export async function refreshMarketSnapshot(
  pairs: Record<string, PairSnapshot>,
  options?: { force?: boolean; assetClass?: AssetClass },
): Promise<MarketSnapshot> {
  const apiKey = process.env.PRICE_API_KEY;
  if (!apiKey) {
    throw new Error("PRICE_API_KEY is not configured.");
  }

  const assetClass = options?.assetClass ?? "fx";
  const now = DateTime.utc();
  const nowIso = toIsoString(now);
  const weekOpenUtc = toIsoString(getSundayOpenUtc(now));
  const weekOpenTime = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const weekOpenBase = weekOpenTime.isValid ? weekOpenTime : now;
  const cacheSeconds = Number(process.env.PRICE_CACHE_SECONDS ?? "300");
  const snapshot = await readMarketSnapshot(weekOpenUtc, assetClass);

  if (
    snapshot &&
    snapshot.week_open_utc === weekOpenUtc &&
    options?.force !== true
  ) {
    const ageSeconds =
      (now.toMillis() - DateTime.fromISO(snapshot.last_refresh_utc).toMillis()) /
      1000;
    if (Number.isFinite(ageSeconds) && ageSeconds <= cacheSeconds) {
      return snapshot;
    }
  }

  const window: WeekWindow = {
    openUtc: weekOpenBase,
    closeUtc: now,
    isHistorical: false,
  };
  const { performance } =
    assetClass === "fx"
      ? await buildFxPerformance(pairs, window, apiKey, {
          allowDirectFallback: true,
        })
      : await buildNonFxPerformance(pairs, assetClass, window, apiKey);

  const nextSnapshot: MarketSnapshot = {
    week_open_utc: weekOpenUtc,
    last_refresh_utc: nowIso,
    asset_class: assetClass,
    pairs: performance,
  };

  await writeMarketSnapshot(nextSnapshot);

  return nextSnapshot;
}
