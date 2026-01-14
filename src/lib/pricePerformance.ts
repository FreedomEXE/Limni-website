import { DateTime } from "luxon";
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

function pipSize(pair: string): number {
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

async function fetchTimeSeries(
  pair: string,
  apiKey: string,
): Promise<TimeSeriesValue[]> {
  const base = pair.slice(0, 3);
  const quote = pair.slice(3);
  const symbol = `${base}/${quote}`;
  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", "1h");
  url.searchParams.set("outputsize", "500");
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Price fetch failed (${pair}).`);
  }

  const data = (await response.json()) as {
    status?: string;
    message?: string;
    values?: TimeSeriesValue[];
  };

  if (data.status === "error") {
    throw new Error(data.message ?? `Price error for ${pair}.`);
  }

  if (!data.values || data.values.length === 0) {
    throw new Error(`No price data for ${pair}.`);
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

async function fetchMajorPrices(
  apiKey: string,
  weekOpenUtc: DateTime,
): Promise<Record<MajorPair, MajorPrice | null>> {
  const prices = {} as Record<MajorPair, MajorPrice | null>;

  for (const pair of MAJOR_PAIRS) {
    try {
      const values = await fetchTimeSeries(pair, apiKey);
      const latest = values[0];
      const latestTime = DateTime.fromFormat(
        latest.datetime,
        "yyyy-MM-dd HH:mm:ss",
        { zone: "UTC" },
      );
      const { value: openValue, time: openTime } = findOpenValue(
        values,
        weekOpenUtc,
      );

      const open = parseValue(openValue.open);
      const current = parseValue(latest.close);

      prices[pair] = {
        open,
        current,
        open_time_utc: toIsoString(openTime),
        current_time_utc: toIsoString(latestTime),
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

export async function getStoredPairPerformance(
  pairs: Record<string, PairSnapshot>,
): Promise<PerformanceResult> {
  const snapshot = await readMarketSnapshot();
  if (!snapshot) {
    return { performance: {}, note: "Price data not refreshed yet." };
  }

  const now = DateTime.utc();
  const weekOpenUtc = toIsoString(getSundayOpenUtc(now));
  if (snapshot.week_open_utc !== weekOpenUtc) {
    return {
      performance: {},
      note: `Price snapshot is for week of ${formatUtcLabel(
        snapshot.week_open_utc,
      )}. Refresh prices.`,
    };
  }

  const performance: Record<string, PairPerformance | null> = {};
  let missing = 0;
  for (const pair of Object.keys(pairs)) {
    const value = snapshot.pairs[pair] ?? null;
    if (!value) {
      missing += 1;
    }
    performance[pair] = value;
  }

  const totalPairs = Object.keys(pairs).length;
  const baseNote =
    missing > 0
      ? `Missing prices for ${missing}/${totalPairs}. Last refresh ${formatUtcLabel(
          snapshot.last_refresh_utc,
        )}.`
      : `Last refresh ${formatUtcLabel(snapshot.last_refresh_utc)}.`;
  const note = `${baseNote} Derived from majors. Percent is raw; pips are direction-adjusted. Totals are direction-adjusted PnL.`;

  return { performance, note };
}

export async function refreshMarketSnapshot(
  pairs: Record<string, PairSnapshot>,
  options?: { force?: boolean },
): Promise<MarketSnapshot> {
  const apiKey = process.env.PRICE_API_KEY;
  if (!apiKey) {
    throw new Error("PRICE_API_KEY is not configured.");
  }

  const now = DateTime.utc();
  const nowIso = toIsoString(now);
  const weekOpenUtc = toIsoString(getSundayOpenUtc(now));
  const weekOpenTime = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const weekOpenBase = weekOpenTime.isValid ? weekOpenTime : now;
  const cacheSeconds = Number(process.env.PRICE_CACHE_SECONDS ?? "300");
  const snapshot = await readMarketSnapshot();

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

  const majors = await fetchMajorPrices(apiKey, weekOpenBase);
  const usdValues = buildUsdValues(majors, weekOpenUtc, nowIso);

  const performance: Record<string, PairPerformance | null> = {};
  for (const [pair, info] of Object.entries(pairs)) {
    const base = pair.slice(0, 3);
    const quote = pair.slice(3);
    const baseValue = usdValues[base];
    const quoteValue = usdValues[quote];

    if (!baseValue || !quoteValue) {
      performance[pair] = null;
      continue;
    }

    const open = baseValue.open / quoteValue.open;
    const current = baseValue.current / quoteValue.current;
    const directionFactor = info.direction === "LONG" ? 1 : -1;
    const rawDelta = current - open;
    const percent = (rawDelta / open) * 100;
    const rawPips = rawDelta / pipSize(pair);
    const pips = rawPips * directionFactor;

    performance[pair] = {
      open,
      current,
      percent,
      pips,
      open_time_utc: weekOpenUtc,
      current_time_utc: nowIso,
    };
  }

  const nextSnapshot: MarketSnapshot = {
    week_open_utc: weekOpenUtc,
    last_refresh_utc: nowIso,
    pairs: performance,
  };

  await writeMarketSnapshot(nextSnapshot);

  return nextSnapshot;
}
