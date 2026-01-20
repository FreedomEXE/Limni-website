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
  symbolBase: "BTC" | "ETH",
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
