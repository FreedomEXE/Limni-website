import { DateTime } from "luxon";

type BitgetFundingRateResponse = {
  code?: string;
  msg?: string;
  data?: Array<{
    symbol?: string;
    fundingRate?: string;
    fundingRateInterval?: string;
    nextUpdate?: string;
    minFundingRate?: string;
    maxFundingRate?: string;
  }>;
};

type BitgetOpenInterestResponse = {
  code?: string;
  msg?: string;
  data?: {
    openInterestList?: Array<{ symbol?: string; size?: string }>;
    ts?: string;
  };
};

type BitgetTickerResponse = {
  code?: string;
  msg?: string;
  data?: Array<{
    symbol?: string;
    lastPr?: string;
    bidPr?: string;
    askPr?: string;
    change24h?: string;
    usdtVolume?: string;
    quoteVolume?: string;
    fundingRate?: string;
    holdingAmount?: string;
    ts?: string;
  }>;
};

type BitgetContractsResponse = {
  code?: string;
  msg?: string;
  data?: Array<{
    symbol?: string;
    baseCoin?: string;
    symbolStatus?: string;
    maxLever?: string;
    minTradeNum?: string;
    minTradeUSDT?: string;
    pricePlace?: string;
    volumePlace?: string;
  }>;
};

type BitgetCandleResponse = {
  code?: string;
  msg?: string;
  data?: string[][];
};

export type BitgetHourlyCandle = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type BitgetMarketTicker = {
  symbol: string;
  baseCoin: string;
  lastPrice: number | null;
  bidPrice: number | null;
  askPrice: number | null;
  change24hPct: number | null;
  volume24hUsd: number | null;
  fundingRate: number | null;
  holdingAmount: number | null;
  openInterestUsd: number | null;
  timestamp: string | null;
};

export type BitgetMarketContract = {
  symbol: string;
  baseCoin: string;
  symbolStatus: string | null;
  maxLeverage: number | null;
  minTradeNum: number | null;
  minTradeUsdt: number | null;
  pricePlace: number | null;
  volumePlace: number | null;
};

type BitgetGranularity = "M1" | "M15" | "H1" | "H4";

const BASE_URL = "https://api.bitget.com";

function getProductType() {
  return process.env.BITGET_PRODUCT_TYPE ?? "USDT-FUTURES";
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const suffix = text ? `: ${text.slice(0, 240)}` : "";
    throw new Error(`Bitget request failed (${response.status}) ${url}${suffix}`);
  }
  return (await response.json()) as T;
}

function toNumber(value?: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export type BitgetFuturesSnapshot = {
  symbol: string;
  productType: string;
  lastPrice: number | null;
  lastPriceTime: string | null;
  fundingRate: number | null;
  fundingTime: string | null;
  openInterest: number | null;
  openInterestTime: string | null;
};

export async function fetchBitgetFuturesSnapshot(
  symbolBase: string,
): Promise<BitgetFuturesSnapshot> {
  const productType = getProductType();
  const symbol = `${symbolBase}USDT`;
  const fundingUrl = `${BASE_URL}/api/v2/mix/market/current-fund-rate?symbol=${symbol}&productType=${productType}`;
  const oiUrl = `${BASE_URL}/api/v2/mix/market/open-interest?symbol=${symbol}&productType=${productType}`;
  const tickerUrl = `${BASE_URL}/api/v2/mix/market/ticker?symbol=${symbol}&productType=${productType}`;

  const [funding, openInterest, ticker] = await Promise.all([
    fetchJson<BitgetFundingRateResponse>(fundingUrl),
    fetchJson<BitgetOpenInterestResponse>(oiUrl),
    fetchJson<BitgetTickerResponse>(tickerUrl),
  ]);

  const fundingRow = Array.isArray(funding.data) ? funding.data[0] : undefined;
  const oiRow = openInterest.data?.openInterestList?.[0];
  const tickerRow = Array.isArray(ticker.data) ? ticker.data[0] : undefined;

  return {
    symbol,
    productType,
    lastPrice: toNumber(tickerRow?.lastPr),
    lastPriceTime: tickerRow?.ts ?? null,
    fundingRate: toNumber(fundingRow?.fundingRate),
    fundingTime: fundingRow?.nextUpdate ?? null,
    openInterest: toNumber(oiRow?.size),
    openInterestTime: openInterest.data?.ts ?? null,
  };
}

export async function fetchBitgetMarketTickers(): Promise<BitgetMarketTicker[]> {
  const productType = getProductType();
  const url = `${BASE_URL}/api/v2/mix/market/tickers?productType=${productType}`;
  const payload = await fetchJson<BitgetTickerResponse>(url);
  if (payload.code && payload.code !== "00000") {
    throw new Error(`Bitget tickers request failed: ${payload.code} ${payload.msg ?? ""}`.trim());
  }

  return (payload.data ?? [])
    .map((row) => {
      const symbol = String(row.symbol ?? "").toUpperCase();
      const baseCoin = symbol.endsWith("USDT") ? symbol.slice(0, -4) : symbol;
      const lastPrice = toNumber(row.lastPr);
      const holdingAmount = toNumber(row.holdingAmount);
      return {
        symbol,
        baseCoin,
        lastPrice,
        bidPrice: toNumber(row.bidPr),
        askPrice: toNumber(row.askPr),
        change24hPct: (() => {
          const ratio = toNumber(row.change24h);
          return ratio === null ? null : ratio * 100;
        })(),
        volume24hUsd: toNumber(row.usdtVolume ?? row.quoteVolume),
        fundingRate: toNumber(row.fundingRate),
        holdingAmount,
        openInterestUsd:
          lastPrice !== null && holdingAmount !== null ? lastPrice * holdingAmount : null,
        timestamp: row.ts ? new Date(Number(row.ts)).toISOString() : null,
      } satisfies BitgetMarketTicker;
    })
    .filter((row) => row.symbol.length > 0 && row.baseCoin.length > 0);
}

export async function fetchBitgetMarketContracts(): Promise<BitgetMarketContract[]> {
  const productType = getProductType();
  const url = `${BASE_URL}/api/v2/mix/market/contracts?productType=${productType}`;
  const payload = await fetchJson<BitgetContractsResponse>(url);
  if (payload.code && payload.code !== "00000") {
    throw new Error(`Bitget contracts request failed: ${payload.code} ${payload.msg ?? ""}`.trim());
  }

  return (payload.data ?? [])
    .map((row) => ({
      symbol: String(row.symbol ?? "").toUpperCase(),
      baseCoin: String(row.baseCoin ?? "").toUpperCase(),
      symbolStatus: row.symbolStatus ? String(row.symbolStatus) : null,
      maxLeverage: toNumber(row.maxLever),
      minTradeNum: toNumber(row.minTradeNum),
      minTradeUsdt: toNumber(row.minTradeUSDT),
      pricePlace: toNumber(row.pricePlace),
      volumePlace: toNumber(row.volumePlace),
    }))
    .filter((row) => row.symbol.length > 0 && row.baseCoin.length > 0);
}

export async function fetchBitgetCandleRange(
  symbolBase: string,
  window: { openUtc: DateTime; closeUtc: DateTime },
): Promise<{ open: number; high: number; low: number; close: number; openTime: string; closeTime: string } | null> {
  const productType = getProductType();
  const symbol = `${symbolBase}USDT`;
  const weekDurationMs = window.closeUtc.toMillis() - window.openUtc.toMillis();
  const hoursInWeek = Math.ceil(weekDurationMs / (1000 * 60 * 60));
  const requiredLimit = Math.max(hoursInWeek + 24, 200);
  const paddedOpen = window.openUtc.minus({ hours: 1 });
  const paddedClose = window.closeUtc.plus({ hours: 1 });
  const url = new URL(`${BASE_URL}/api/v2/mix/market/candles`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("productType", productType);
  url.searchParams.set("granularity", "3600");
  url.searchParams.set("startTime", String(paddedOpen.toMillis()));
  url.searchParams.set("endTime", String(paddedClose.toMillis()));
  url.searchParams.set("limit", String(Math.min(requiredLimit, 1000)));

  const response = await fetchJson<BitgetCandleResponse>(url.toString());
  if (response.code && response.code !== "00000") {
    return null;
  }
  const rows = response.data ?? [];
  if (rows.length === 0) {
    return null;
  }
  const openMs = window.openUtc.toMillis();
  const closeMs = window.closeUtc.toMillis();
  const parsed = rows
    .map((row) => ({
      ts: Number(row[0]),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
    }))
    .filter(
      (row) =>
        Number.isFinite(row.ts)
        && Number.isFinite(row.open)
        && Number.isFinite(row.high)
        && Number.isFinite(row.low)
        && Number.isFinite(row.close),
    )
    .filter((row) => row.ts >= openMs && row.ts < closeMs)
    .sort((a, b) => a.ts - b.ts);
  if (parsed.length === 0) {
    return null;
  }
  const first = parsed[0];
  const last = parsed[parsed.length - 1];
  return {
    open: first.open,
    high: parsed.reduce((max, row) => Math.max(max, row.high), Number.NEGATIVE_INFINITY),
    low: parsed.reduce((min, row) => Math.min(min, row.low), Number.POSITIVE_INFINITY),
    close: last.close,
    openTime: new Date(first.ts).toISOString(),
    closeTime: new Date(last.ts).toISOString(),
  };
}

export async function fetchBitgetCandleSeries(
  symbolBase: string,
  window: { openUtc: DateTime; closeUtc: DateTime },
): Promise<BitgetHourlyCandle[]> {
  return fetchBitgetSeries(symbolBase, window, "H1");
}

export async function fetchBitgetSpotCandleSeries(
  symbolBase: string,
  window: { openUtc: DateTime; closeUtc: DateTime },
): Promise<BitgetHourlyCandle[]> {
  return fetchBitgetSpotSeries(symbolBase, window, "H1");
}

export async function fetchBitgetMinuteSeries(
  symbolBase: string,
  window: { openUtc: DateTime; closeUtc: DateTime },
): Promise<BitgetHourlyCandle[]> {
  return fetchBitgetSeries(symbolBase, window, "M1");
}

export async function fetchBitget15mSeries(
  symbolBase: string,
  window: { openUtc: DateTime; closeUtc: DateTime },
): Promise<BitgetHourlyCandle[]> {
  return fetchBitgetSeries(symbolBase, window, "M15");
}

export async function fetchBitget4hSeries(
  symbolBase: string,
  window: { openUtc: DateTime; closeUtc: DateTime },
): Promise<BitgetHourlyCandle[]> {
  return fetchBitgetSeries(symbolBase, window, "H4");
}

async function fetchBitgetSeries(
  symbolBase: string,
  window: { openUtc: DateTime; closeUtc: DateTime },
  granularity: BitgetGranularity,
): Promise<BitgetHourlyCandle[]> {
  const productType = getProductType();
  const symbol = `${symbolBase}USDT`;
  const stepMs =
    granularity === "M1"
      ? 60 * 1000
      : granularity === "M15"
        ? 15 * 60 * 1000
        : granularity === "H4"
          ? 4 * 60 * 60 * 1000
          : 60 * 60 * 1000;
  const granularityParam =
    granularity === "M1"
      ? "1m"
      : granularity === "M15"
        ? "900"
        : granularity === "H4"
          ? "14400"
          : "3600";
  const all = new Map<number, BitgetHourlyCandle>();
  let cursor = window.openUtc.toMillis();
  const closeMs = window.closeUtc.toMillis();
  const maxBarsPerRequest = 1000;
  let pages = 0;

  while (cursor < closeMs && pages < 120) {
    pages += 1;
    const requestEndMs = Math.min(closeMs, cursor + (stepMs * maxBarsPerRequest));
    const url = new URL(`${BASE_URL}/api/v2/mix/market/candles`);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("productType", productType);
    url.searchParams.set("granularity", granularityParam);
    url.searchParams.set("startTime", String(cursor));
    url.searchParams.set("endTime", String(requestEndMs));
    url.searchParams.set("limit", String(maxBarsPerRequest));

    const response = await fetchJson<BitgetCandleResponse>(url.toString());
    if (response.code && response.code !== "00000") {
      return [];
    }
    const rows = response.data ?? [];
    if (rows.length === 0) {
      break;
    }

    const parsed = rows
      .map((row) => ({
        ts: Number(row[0]),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
      }))
      .filter(
        (row) =>
          Number.isFinite(row.ts) &&
          Number.isFinite(row.open) &&
          Number.isFinite(row.high) &&
          Number.isFinite(row.low) &&
          Number.isFinite(row.close),
      )
      .filter((row) => row.ts >= window.openUtc.toMillis() && row.ts < closeMs)
      .sort((a, b) => a.ts - b.ts);

    if (parsed.length === 0) {
      break;
    }

    for (const row of parsed) {
      all.set(row.ts, row);
    }

    const lastTs = parsed[parsed.length - 1].ts;
    const nextTs = lastTs + stepMs;
    if (nextTs <= cursor) {
      break;
    }
    cursor = nextTs;
  }

  return Array.from(all.values()).sort((a, b) => a.ts - b.ts);
}

async function fetchBitgetSpotSeries(
  symbolBase: string,
  window: { openUtc: DateTime; closeUtc: DateTime },
  granularity: BitgetGranularity,
): Promise<BitgetHourlyCandle[]> {
  const symbol = `${symbolBase}USDT`;
  const granularityParam =
    granularity === "M1"
      ? "1min"
      : granularity === "M15"
        ? "15min"
        : granularity === "H4"
          ? "4h"
          : "1h";
  const all = new Map<number, BitgetHourlyCandle>();
  let cursorEndMs = window.closeUtc.toMillis();
  let pages = 0;

  while (cursorEndMs > window.openUtc.toMillis() && pages < 240) {
    pages += 1;
    const url = new URL(`${BASE_URL}/api/v2/spot/market/history-candles`);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("granularity", granularityParam);
    url.searchParams.set("endTime", String(cursorEndMs));
    url.searchParams.set("limit", "200");

    const response = await fetchJson<BitgetCandleResponse>(url.toString());
    if (response.code && response.code !== "00000") {
      return [];
    }
    const rows = response.data ?? [];
    if (rows.length === 0) {
      break;
    }

    const parsed = rows
      .map((row) => ({
        ts: Number(row[0]),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
      }))
      .filter(
        (row) =>
          Number.isFinite(row.ts) &&
          Number.isFinite(row.open) &&
          Number.isFinite(row.high) &&
          Number.isFinite(row.low) &&
          Number.isFinite(row.close),
      )
      .sort((a, b) => a.ts - b.ts);

    if (parsed.length === 0) {
      break;
    }

    for (const row of parsed) {
      if (row.ts >= window.openUtc.toMillis() && row.ts < window.closeUtc.toMillis()) {
        all.set(row.ts, row);
      }
    }

    const earliestTs = parsed[0]!.ts;
    if (earliestTs >= cursorEndMs) {
      break;
    }
    cursorEndMs = earliestTs;
  }

  return Array.from(all.values()).sort((a, b) => a.ts - b.ts);
}

export async function fetchBitgetPriceChange(
  symbolBase: string,
  hours: number,
): Promise<{ open: number; close: number; percent: number } | null> {
  if (hours <= 0) {
    return null;
  }
  const closeUtc = DateTime.utc();
  const openUtc = closeUtc.minus({ hours });
  const candle = await fetchBitgetCandleRange(symbolBase, { openUtc, closeUtc });
  if (!candle || candle.open === 0) {
    return null;
  }
  const percent = ((candle.close - candle.open) / candle.open) * 100;
  return { open: candle.open, close: candle.close, percent };
}
