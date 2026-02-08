import { DateTime } from "luxon";

const PRACTICE_URL = "https://api-fxpractice.oanda.com";
const LIVE_URL = "https://api-fxtrade.oanda.com";

type OandaCandlesResponse = {
  candles?: Array<{
    time: string;
    complete: boolean;
    mid?: { o: string; c: string };
  }>;
};

export type OandaHourlyCandle = {
  ts: number;
  open: number;
  close: number;
};

type OandaGranularity = "M1" | "H1";

function getOandaBaseUrl() {
  return process.env.OANDA_ENV === "live" ? LIVE_URL : PRACTICE_URL;
}

function getAuthHeaders() {
  const apiKey = process.env.OANDA_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("OANDA_API_KEY is not configured.");
  }
  return {
    Authorization: `Bearer ${apiKey}`,
  };
}

const OANDA_OVERRIDES: Record<string, string> = {
  SPXUSD: "SPX500_USD",
  NDXUSD: "NAS100_USD",
  NIKKEIUSD: "JP225_USD",
  US30: "US30_USD",
  US2000: "US2000_USD",
  BTCUSD: "BTC_USD",
  ETHUSD: "ETH_USD",
  XAUUSD: "XAU_USD",
  XAGUSD: "XAG_USD",
  WTIUSD: "WTICO_USD",
  SUGAR: "SUGAR_USD",
  WHEAT: "WHEAT_USD",
  COPPER: "XCU_USD",
};

export function getOandaInstrument(symbol: string) {
  const override = OANDA_OVERRIDES[symbol];
  if (override) {
    return override;
  }
  if (symbol.includes("/")) {
    return symbol.replace("/", "_");
  }
  if (symbol.length === 6) {
    return `${symbol.slice(0, 3)}_${symbol.slice(3)}`;
  }
  return symbol;
}

export async function fetchOandaCandle(
  symbol: string,
  fromUtc: DateTime,
  toUtc: DateTime,
): Promise<{ open: number; close: number; openTime: string; closeTime: string } | null> {
  const accountId = process.env.OANDA_ACCOUNT_ID ?? "";
  if (!accountId) {
    throw new Error("OANDA_ACCOUNT_ID is not configured.");
  }
  const instrument = getOandaInstrument(symbol);
  const url = new URL(`${getOandaBaseUrl()}/v3/instruments/${instrument}/candles`);
  url.searchParams.set("price", "M");
  url.searchParams.set("granularity", "H1");
  url.searchParams.set("from", fromUtc.toISO() ?? "");
  url.searchParams.set("to", toUtc.toISO() ?? "");

  const maxAttempts = 3;
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url.toString(), {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const body = await response.text();
        const message = `OANDA price fetch failed (${instrument}) [${response.status}]: ${body}`;
        if (response.status >= 500 || response.status === 429) {
          throw new Error(message);
        }
        throw new Error(message);
      }
      const data = (await response.json()) as OandaCandlesResponse;
      const candles = data.candles ?? [];
      const complete = candles.filter((candle) => candle.complete && candle.mid);
      if (complete.length === 0) {
        return null;
      }
      const openCandle = complete[0];
      const closeCandle = complete[complete.length - 1];
      if (!openCandle.mid || !closeCandle.mid) {
        return null;
      }
      const open = Number(openCandle.mid.o);
      const close = Number(closeCandle.mid.c);
      if (!Number.isFinite(open) || !Number.isFinite(close)) {
        return null;
      }
      return {
        open,
        close,
        openTime: openCandle.time,
        closeTime: closeCandle.time,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
        continue;
      }
    }
  }
  if (lastError) {
    throw lastError;
  }
  return null;
}

export async function fetchOandaCandleSeries(
  symbol: string,
  fromUtc: DateTime,
  toUtc: DateTime,
): Promise<OandaHourlyCandle[]> {
  return fetchOandaSeries(symbol, fromUtc, toUtc, "H1");
}

export async function fetchOandaMinuteSeries(
  symbol: string,
  fromUtc: DateTime,
  toUtc: DateTime,
): Promise<OandaHourlyCandle[]> {
  return fetchOandaSeries(symbol, fromUtc, toUtc, "M1");
}

async function fetchOandaSeries(
  symbol: string,
  fromUtc: DateTime,
  toUtc: DateTime,
  granularity: OandaGranularity,
): Promise<OandaHourlyCandle[]> {
  const accountId = process.env.OANDA_ACCOUNT_ID ?? "";
  if (!accountId) {
    throw new Error("OANDA_ACCOUNT_ID is not configured.");
  }
  const instrument = getOandaInstrument(symbol);
  const stepMs = granularity === "M1" ? 60 * 1000 : 60 * 60 * 1000;
  const maxBarsPerRequest = 4000;
  const all = new Map<number, OandaHourlyCandle>();
  let cursor = fromUtc;
  let page = 0;
  while (cursor.toMillis() < toUtc.toMillis() && page < 100) {
    page += 1;
    const requestTo = DateTime.fromMillis(
      Math.min(
        toUtc.toMillis(),
        cursor.toMillis() + stepMs * maxBarsPerRequest,
      ),
      { zone: "utc" },
    );
    const url = new URL(`${getOandaBaseUrl()}/v3/instruments/${instrument}/candles`);
    url.searchParams.set("price", "M");
    url.searchParams.set("granularity", granularity);
    url.searchParams.set("from", cursor.toISO() ?? "");
    url.searchParams.set("to", requestTo.toISO() ?? "");

    const maxAttempts = 3;
    let lastError: Error | null = null;
    let candles: OandaHourlyCandle[] | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(url.toString(), {
          headers: getAuthHeaders(),
        });
        if (!response.ok) {
          const body = await response.text();
          const message = `OANDA series fetch failed (${instrument}) [${response.status}]: ${body}`;
          if (response.status >= 500 || response.status === 429) {
            throw new Error(message);
          }
          throw new Error(message);
        }

        const data = (await response.json()) as OandaCandlesResponse;
        candles = (data.candles ?? [])
          .filter((candle) => candle.complete && candle.mid)
          .map((candle) => ({
            ts: DateTime.fromISO(candle.time, { zone: "utc" }).toMillis(),
            open: Number(candle.mid?.o ?? NaN),
            close: Number(candle.mid?.c ?? NaN),
          }))
          .filter(
            (row) =>
              Number.isFinite(row.ts) &&
              Number.isFinite(row.open) &&
              Number.isFinite(row.close),
          )
          .sort((a, b) => a.ts - b.ts);
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
          continue;
        }
      }
    }

    if (!candles) {
      if (lastError) {
        throw lastError;
      }
      break;
    }
    if (candles.length === 0) {
      break;
    }

    for (const candle of candles) {
      if (candle.ts >= fromUtc.toMillis() && candle.ts < toUtc.toMillis()) {
        all.set(candle.ts, candle);
      }
    }

    const lastTs = candles[candles.length - 1].ts;
    const nextTs = lastTs + stepMs;
    if (nextTs <= cursor.toMillis()) {
      break;
    }
    cursor = DateTime.fromMillis(nextTs, { zone: "utc" });
  }
  return Array.from(all.values()).sort((a, b) => a.ts - b.ts);
}
