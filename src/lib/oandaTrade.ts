import crypto from "node:crypto";

const PRACTICE_URL = "https://api-fxpractice.oanda.com";
const LIVE_URL = "https://api-fxtrade.oanda.com";

type OandaSide = "buy" | "sell";

export type OandaAccountSummary = {
  balance: string;
  NAV: string;
  marginAvailable: string;
  marginUsed: string;
  unrealizedPL: string;
  currency: string;
};

export type OandaPricing = {
  instrument: string;
  closeoutBid: string;
  closeoutAsk: string;
  bids?: Array<{ price: string }>;
  asks?: Array<{ price: string }>;
};

export type OandaInstrument = {
  name: string;
  type: string;
  displayPrecision: number;
  pipLocation: number;
  tradeUnitsPrecision: number;
  marginRate: string;
};

export type OandaTrade = {
  id: string;
  instrument: string;
  currentUnits: string;
  unrealizedPL: string;
  openTime?: string;
  clientExtensions?: {
    id?: string;
    tag?: string;
    comment?: string;
  };
};

function getBaseUrl() {
  return process.env.OANDA_ENV === "live" ? LIVE_URL : PRACTICE_URL;
}

function getApiKey() {
  const apiKey = process.env.OANDA_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("OANDA_API_KEY is not configured.");
  }
  return apiKey;
}

function getAccountId() {
  const accountId = process.env.OANDA_ACCOUNT_ID ?? "";
  if (!accountId) {
    throw new Error("OANDA_ACCOUNT_ID is not configured.");
  }
  return accountId;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OANDA request failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as T;
}

export async function fetchOandaAccountSummary(): Promise<OandaAccountSummary> {
  const accountId = getAccountId();
  const data = await request<{ account: OandaAccountSummary }>(
    `/v3/accounts/${accountId}/summary`,
  );
  return data.account;
}

export async function fetchOandaInstruments(): Promise<OandaInstrument[]> {
  const accountId = getAccountId();
  const data = await request<{ instruments: OandaInstrument[] }>(
    `/v3/accounts/${accountId}/instruments`,
  );
  return data.instruments ?? [];
}

export async function fetchOandaPricing(
  instruments: string[],
): Promise<OandaPricing[]> {
  const accountId = getAccountId();
  const params = new URLSearchParams({ instruments: instruments.join(",") });
  const data = await request<{ prices: OandaPricing[] }>(
    `/v3/accounts/${accountId}/pricing?${params.toString()}`,
  );
  return data.prices ?? [];
}

export async function fetchOandaOpenTrades(): Promise<OandaTrade[]> {
  const accountId = getAccountId();
  const data = await request<{ trades: OandaTrade[] }>(
    `/v3/accounts/${accountId}/trades`,
  );
  return data.trades ?? [];
}

export async function placeOandaMarketOrder(options: {
  instrument: string;
  units: number;
  side: OandaSide;
  clientTag: string;
  positionFill?: "DEFAULT" | "OPEN_ONLY" | "REDUCE_FIRST" | "REDUCE_ONLY";
}): Promise<any> {
  const accountId = getAccountId();
  const units = options.side === "buy" ? options.units : -Math.abs(options.units);
  return await request(`/v3/accounts/${accountId}/orders`, {
    method: "POST",
    body: JSON.stringify({
      order: {
        type: "MARKET",
        instrument: options.instrument,
        units: units.toString(),
        positionFill: options.positionFill ?? "DEFAULT",
        clientExtensions: {
          id: options.clientTag,
          tag: options.clientTag,
        },
      },
    }),
  });
}

export async function closeOandaTrade(tradeId: string) {
  const accountId = getAccountId();
  await request(`/v3/accounts/${accountId}/trades/${tradeId}/close`, {
    method: "PUT",
  });
}

export function normalizeOandaSymbol(symbol: string) {
  if (symbol.includes("_")) {
    return symbol;
  }
  if (symbol.includes("/")) {
    return symbol.replace("/", "_");
  }
  if (symbol.length === 6) {
    return `${symbol.slice(0, 3)}_${symbol.slice(3)}`;
  }
  return symbol;
}

export function buildClientTag(prefix: string, symbol: string, model: string) {
  const raw = `${prefix}-${symbol}-${model}-${crypto.randomUUID().slice(0, 8)}`;
  return raw.slice(0, 32);
}
