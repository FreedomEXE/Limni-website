import { DateTime } from "luxon";

type BitgetFundingRateResponse = {
  code?: string;
  msg?: string;
  data?: {
    symbol?: string;
    fundingRate?: string;
    fundingTime?: string;
  };
};

type BitgetOpenInterestResponse = {
  code?: string;
  msg?: string;
  data?: {
    symbol?: string;
    openInterest?: string;
    ts?: string;
  };
};

type BitgetTickerResponse = {
  code?: string;
  msg?: string;
  data?: {
    lastPr?: string;
    ts?: string;
  };
};

type BitgetCandleResponse = {
  code?: string;
  msg?: string;
  data?: string[][];
};

const BASE_URL = "https://api.bitget.com";

function getProductType() {
  return process.env.BITGET_PRODUCT_TYPE ?? "USDT-FUTURES";
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Bitget request failed: ${response.status}`);
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
  symbolBase: "BTC" | "ETH" | "SOL",
): Promise<BitgetFuturesSnapshot> {
  const productType = getProductType();
  const symbol = `${symbolBase}USDT`;
  const fundingUrl = `${BASE_URL}/api/v2/mix/market/funding-rate?symbol=${symbol}&productType=${productType}`;
  const oiUrl = `${BASE_URL}/api/v2/mix/market/open-interest?symbol=${symbol}&productType=${productType}`;
  const tickerUrl = `${BASE_URL}/api/v2/mix/market/ticker?symbol=${symbol}&productType=${productType}`;

  const [funding, openInterest, ticker] = await Promise.all([
    fetchJson<BitgetFundingRateResponse>(fundingUrl),
    fetchJson<BitgetOpenInterestResponse>(oiUrl),
    fetchJson<BitgetTickerResponse>(tickerUrl),
  ]);

  return {
    symbol,
    productType,
    lastPrice: toNumber(ticker.data?.lastPr),
    lastPriceTime: ticker.data?.ts ?? null,
    fundingRate: toNumber(funding.data?.fundingRate),
    fundingTime: funding.data?.fundingTime ?? null,
    openInterest: toNumber(openInterest.data?.openInterest),
    openInterestTime: openInterest.data?.ts ?? null,
  };
}

export async function fetchBitgetCandleRange(
  symbolBase: "BTC" | "ETH" | "SOL",
  window: { openUtc: DateTime; closeUtc: DateTime },
): Promise<{ open: number; close: number; openTime: string; closeTime: string } | null> {
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
      close: Number(row[4]),
    }))
    .filter((row) => Number.isFinite(row.ts) && Number.isFinite(row.open) && Number.isFinite(row.close))
    .filter((row) => row.ts >= openMs && row.ts < closeMs)
    .sort((a, b) => a.ts - b.ts);
  if (parsed.length === 0) {
    return null;
  }
  const first = parsed[0];
  const last = parsed[parsed.length - 1];
  return {
    open: first.open,
    close: last.close,
    openTime: new Date(first.ts).toISOString(),
    closeTime: new Date(last.ts).toISOString(),
  };
}

export async function fetchBitgetPriceChange(
  symbolBase: "BTC" | "ETH" | "SOL",
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
