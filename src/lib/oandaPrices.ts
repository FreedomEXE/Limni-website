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
  BTCUSD: "BTC_USD",
  ETHUSD: "ETH_USD",
  XAUUSD: "XAU_USD",
  XAGUSD: "XAG_USD",
  WTIUSD: "WTICO_USD",
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
