type CoinankResponse<T> = {
  success: boolean;
  code?: string;
  msg?: string | null;
  data?: T;
};

type LiquidationOrder = {
  exchangeName?: string | null;
  baseCoin?: string | null;
  posSide?: "long" | "short" | null;
  contractCode?: string | null;
  tradeTurnover?: number | null;
  price?: number | null;
  ts?: number | null;
};

export type LiquidationCluster = {
  exchange: string;
  side: "long" | "short";
  notional: number;
  price: number | null;
  timestamp: string;
  contract: string | null;
};

export type LiquidationSummary = {
  baseCoin: string;
  totalLongUsd: number;
  totalShortUsd: number;
  dominantSide: "long" | "short" | "flat";
  recentClusters: LiquidationCluster[];
  referencePrice?: number | null;
  priceSource?: "Bitget Futures" | "CMC Spot" | null;
  largestAbove?: LiquidationCluster | null;
  largestBelow?: LiquidationCluster | null;
  lastUpdated: string;
};

const COINANK_BASE_URL = "https://api.coinank.com";
const COINANK_WEB_VERSION = "102";
const COINANK_SEED = "b2d903dd-b31e-c547-d299-b6d07b7631ab";
const NONCE_OFFSET = 2222222222222;
const NONCE_SUFFIX = "347";
const LOOKBACK_HOURS = 6;

function buildCoinankApiKey(nowMs = Date.now()) {
  const seed = process.env.COINANK_API_SEED ?? COINANK_SEED;
  const prefix = seed.slice(0, 8);
  const rotated = seed.replace(prefix, "") + prefix;
  const nonce = `${nowMs + NONCE_OFFSET}${NONCE_SUFFIX}`;
  const payload = `${rotated}|${nonce}`;
  return Buffer.from(payload).toString("base64");
}

async function coinankGet<T>(path: string, params: Record<string, string>) {
  const url = new URL(path, process.env.COINANK_BASE_URL ?? COINANK_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const headers = {
    client: "web",
    token: "",
    "web-version": COINANK_WEB_VERSION,
    "coinank-apikey": buildCoinankApiKey(),
    "User-Agent": "Mozilla/5.0",
    Referer: "https://www.coinank.com/",
  };

  const response = await fetch(url, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Coinank request failed (${response.status}).`);
  }

  const payload = (await response.json()) as CoinankResponse<T>;
  if (!payload.success) {
    throw new Error(payload.msg ?? "Coinank response error.");
  }

  return payload.data ?? ([] as unknown as T);
}

export async function fetchLiquidationSummary(
  baseCoin: "BTC" | "ETH",
  referencePrice?: number | null,
  priceSource?: "Bitget Futures" | "CMC Spot" | null,
): Promise<LiquidationSummary> {
  const orders = await coinankGet<LiquidationOrder[]>(
    "/api/liquidation/orders",
    { baseCoin },
  );

  const now = Date.now();
  const cutoff = now - LOOKBACK_HOURS * 60 * 60 * 1000;
  const recentOrders = orders.filter((order) => {
    if (!order.ts) {
      return false;
    }
    return order.ts >= cutoff;
  });

  let totalLongUsd = 0;
  let totalShortUsd = 0;
  for (const order of recentOrders) {
    const notional = Number(order.tradeTurnover ?? 0);
    if (!Number.isFinite(notional)) {
      continue;
    }
    if (order.posSide === "long") {
      totalLongUsd += notional;
    } else if (order.posSide === "short") {
      totalShortUsd += notional;
    }
  }

  const dominantSide =
    totalLongUsd === totalShortUsd
      ? "flat"
      : totalLongUsd > totalShortUsd
        ? "long"
        : "short";

  const allClusters = recentOrders
    .filter(
      (order) =>
        Number(order.tradeTurnover ?? 0) > 0 &&
        Number.isFinite(order.price ?? NaN) &&
        order.posSide,
    )
    .map((order) => ({
      exchange: order.exchangeName ?? "Unknown",
      side: order.posSide ?? "long",
      notional: Number(order.tradeTurnover ?? 0),
      price: order.price ?? null,
      timestamp: new Date(order.ts ?? now).toISOString(),
      contract: order.contractCode ?? null,
    }));

  const recentClusters = allClusters
    .sort((a, b) => b.notional - a.notional)
    .slice(0, 5);

  let largestAbove: LiquidationCluster | null = null;
  let largestBelow: LiquidationCluster | null = null;
  if (Number.isFinite(referencePrice ?? NaN)) {
    const above = allClusters.filter((cluster) => (cluster.price ?? 0) > (referencePrice ?? 0));
    const below = allClusters.filter((cluster) => (cluster.price ?? 0) < (referencePrice ?? 0));
    if (above.length > 0) {
      largestAbove = above.reduce((best, current) =>
        current.notional > best.notional ? current : best,
      );
    }
    if (below.length > 0) {
      largestBelow = below.reduce((best, current) =>
        current.notional > best.notional ? current : best,
      );
    }
  }

  return {
    baseCoin,
    totalLongUsd,
    totalShortUsd,
    dominantSide,
    recentClusters,
    referencePrice,
    priceSource,
    largestAbove,
    largestBelow,
    lastUpdated: new Date().toISOString(),
  };
}
