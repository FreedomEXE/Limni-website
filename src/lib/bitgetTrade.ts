import crypto from "node:crypto";

const BASE_URL = "https://api.bitget.com";

type BitgetAuth = {
  apiKey: string;
  apiSecret: string;
  apiPassphrase: string;
};

type BitgetRequestOptions = {
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: Record<string, unknown> | null;
};

export type BitgetContract = {
  symbol: string;
  // Not always present on Bitget v2 responses (contracts endpoint returns an array).
  productType?: string;
  sizeMultiplier: string;
  minTradeNum: string;
  minTradeUSDT?: string;
  pricePlace?: string;
  volumePlace?: string;
};

export type BitgetAccount = {
  marginCoin: string;
  available: string;
  equity: string;
  usdtEquity?: string;
  unrealizedPL?: string;
};

export type BitgetPosition = {
  symbol: string;
  holdSide?: string;
  total?: string;
  available?: string;
  marginCoin?: string;
  unrealizedPL?: string;
};

export function getBitgetEnv() {
  return process.env.BITGET_ENV ?? "live";
}

export function getBitgetProductType() {
  return process.env.BITGET_PRODUCT_TYPE ?? "USDT-FUTURES";
}

function getAuth(): BitgetAuth {
  const apiKey = process.env.BITGET_API_KEY ?? "";
  const apiSecret = process.env.BITGET_API_SECRET ?? "";
  const apiPassphrase = process.env.BITGET_API_PASSPHRASE ?? "";
  if (!apiKey || !apiSecret || !apiPassphrase) {
    throw new Error("Missing Bitget API credentials.");
  }
  return { apiKey, apiSecret, apiPassphrase };
}

function buildQuery(
  query?: Record<string, string | number | boolean | undefined | null>,
) {
  if (!query) {
    return "";
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }
    params.set(key, String(value));
  }
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

function signRequest(
  auth: BitgetAuth,
  method: string,
  path: string,
  query: string,
  body: string,
  timestamp: string,
) {
  const prehash = `${timestamp}${method}${path}${query}${body}`;
  const signature = crypto
    .createHmac("sha256", auth.apiSecret)
    .update(prehash)
    .digest("base64");
  return signature;
}

async function request<T>(options: BitgetRequestOptions): Promise<T> {
  const auth = getAuth();
  const method = options.method;
  const queryString = buildQuery(options.query);
  const body = options.body ? JSON.stringify(options.body) : "";
  const timestamp = Date.now().toString();
  const signature = signRequest(auth, method, options.path, queryString, body, timestamp);

  const response = await fetch(`${BASE_URL}${options.path}${queryString}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "ACCESS-KEY": auth.apiKey,
      "ACCESS-SIGN": signature,
      "ACCESS-TIMESTAMP": timestamp,
      "ACCESS-PASSPHRASE": auth.apiPassphrase,
      locale: "en-US",
    },
    body: body || undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Bitget request failed (${response.status}) ${method} ${options.path}${queryString}: ${errorText}`,
    );
  }

  const payload = (await response.json()) as {
    code?: string;
    msg?: string;
    data?: T;
  };

  if (payload.code && payload.code !== "00000") {
    throw new Error(`Bitget API error ${payload.code}: ${payload.msg ?? "Unknown error"}`);
  }

  return payload.data as T;
}

export async function setBitgetPositionMode(posMode: "one_way_mode" | "hedge_mode") {
  const productType = getBitgetProductType();
  await request({
    method: "POST",
    path: "/api/v2/mix/account/set-position-mode",
    body: {
      productType,
      posMode,
    },
  });
}

export async function setBitgetLeverage(symbol: string, leverage: number) {
  const productType = getBitgetProductType();
  const safeLeverage = Number.isFinite(leverage)
    ? Math.max(1, Math.min(50, Math.floor(leverage)))
    : 10;
  await request({
    method: "POST",
    path: "/api/v2/mix/account/set-leverage",
    body: {
      symbol,
      productType,
      marginCoin: "USDT",
      leverage: String(safeLeverage),
      holdSide: "long",
    },
  });
  await request({
    method: "POST",
    path: "/api/v2/mix/account/set-leverage",
    body: {
      symbol,
      productType,
      marginCoin: "USDT",
      leverage: String(safeLeverage),
      holdSide: "short",
    },
  });
}

export async function fetchBitgetContracts(
  symbol?: string,
): Promise<BitgetContract[]> {
  const productType = getBitgetProductType();
  // Bitget v2 `/mix/market/contracts` returns `data` as an array of contracts (not `{ list: [...] }`).
  // Some other endpoints use `{ list: [...] }`, so handle both shapes defensively.
  const data = await request<unknown>({
    method: "GET",
    path: "/api/v2/mix/market/contracts",
    query: symbol ? { productType, symbol } : { productType },
  });
  const list =
    Array.isArray(data)
      ? (data as BitgetContract[])
      : (data &&
          typeof data === "object" &&
          "list" in data &&
          Array.isArray((data as { list?: unknown }).list))
        ? ((data as { list: BitgetContract[] }).list ?? [])
        : [];

  if (!symbol) {
    return list;
  }
  // If the API ignores the symbol filter (or returns more than one), narrow it locally.
  return list.filter((c) => String(c?.symbol ?? "").toUpperCase() === symbol.toUpperCase());
}

export async function fetchBitgetAccount(): Promise<BitgetAccount | null> {
  const productType = getBitgetProductType();
  const data = await request<BitgetAccount[]>({
    method: "GET",
    path: "/api/v2/mix/account/accounts",
    query: { productType },
  });
  const list = Array.isArray(data) ? data : [];
  const account =
    list.find((row) => row.marginCoin?.toUpperCase() === "USDT") ?? list[0];
  return account ?? null;
}

export async function fetchBitgetPositions(): Promise<BitgetPosition[]> {
  const productType = getBitgetProductType();
  const data = await request<{ list: BitgetPosition[] }>({
    method: "GET",
    path: "/api/v2/mix/position/all-position",
    query: { productType },
  });
  return data.list ?? [];
}

export async function placeBitgetOrder(options: {
  symbol: string;
  side: "buy" | "sell";
  size: string;
  clientOid: string;
  reduceOnly?: "yes" | "no";
}) {
  const productType = getBitgetProductType();
  await request({
    method: "POST",
    path: "/api/v2/mix/order/place-order",
    body: {
      symbol: options.symbol,
      productType,
      marginMode: "crossed",
      marginCoin: "USDT",
      size: options.size,
      side: options.side,
      orderType: "market",
      reduceOnly: options.reduceOnly ?? "no",
      clientOid: options.clientOid,
    },
  });
}
