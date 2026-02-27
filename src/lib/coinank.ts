type CoinankResponse<T> = {
  success: boolean;
  code?: string;
  msg?: string | null;
  data?: T;
};

type CoinankLiquidationMap = {
  symbol?: string;
  prices?: Array<number | string>;
  lastIndex?: number;
  lastPrice?: number | string;
  x25?: Array<number | string>;
  x30?: Array<number | string>;
  x40?: Array<number | string>;
  x50?: Array<number | string>;
  x60?: Array<number | string>;
  x70?: Array<number | string>;
  x80?: Array<number | string>;
  x90?: Array<number | string>;
  x100?: Array<number | string>;
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

export type LiquidationBandTier = {
  band_pct: number;
  price_level: number;
  distance_pct: number;
  estimated_liquidations_usd: number;
  incremental_liquidations_usd: number;
  peak_price_level: number | null;
  peak_estimated_liquidations_usd: number | null;
  nodes: number;
};

export type LiquidationLevel = {
  price_level: number;
  distance_pct: number;
  estimated_liquidations_usd: number;
};

export type LiquidationHeatmapNode = {
  price_level: number;
  distance_pct: number;
  estimated_liquidations_usd: number;
  side: "below" | "above" | "at";
};

export type LiquidationHeatmap = {
  symbol: string;
  current_price: number;
  asOfUtc: string;
  source: {
    provider: "coinank";
    interval: string;
    exchanges: string[];
  };
  liquidation_bands: {
    longs: LiquidationBandTier[];
    shorts: LiquidationBandTier[];
  };
  aggregate_density: {
    longs_total_below_current_usd: number;
    shorts_total_above_current_usd: number;
  };
  key_levels: {
    longs: LiquidationLevel[];
    shorts: LiquidationLevel[];
  };
  nodes?: LiquidationHeatmapNode[];
};

const COINANK_BASE_URL = "https://api.coinank.com";
const COINANK_WEB_VERSION = "102";
const COINANK_SEED = "b2d903dd-b31e-c547-d299-b6d07b7631ab";
const NONCE_OFFSET = 2222222222222;
const NONCE_SUFFIX = "347";
const LOOKBACK_HOURS = 6;
const HEATMAP_BAND_LEVELS = [2, 5, 10, 15, 25] as const;
const HEATMAP_LEVERAGE_KEYS = [
  "x25",
  "x30",
  "x40",
  "x50",
  "x60",
  "x70",
  "x80",
  "x90",
  "x100",
] as const;
const HEATMAP_DEFAULT_EXCHANGES = ["Binance", "Bybit"] as const;
const HEATMAP_CACHE = new Map<string, { expiresAt: number; value: LiquidationHeatmap }>();
const HEATMAP_CACHE_TTL_MS = Math.max(
  1_000,
  Number.parseInt(process.env.COINANK_HEATMAP_CACHE_TTL_MS ?? "20000", 10) || 20_000,
);

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

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, decimals = 2) {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function normalizeHeatmapBaseCoin(raw: string): string {
  const clean = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!clean) return "";
  if (clean.endsWith("USDT")) {
    return clean.slice(0, -4);
  }
  return clean;
}

function normalizeExchange(raw: string): string {
  return String(raw || "").trim();
}

function normalizeInterval(raw?: string): string {
  const normalized = String(raw || "").trim();
  return normalized || "1d";
}

function normalizeExchanges(raw?: string[]): string[] {
  const base = raw && raw.length ? raw : [...HEATMAP_DEFAULT_EXCHANGES];
  const deduped = Array.from(new Set(base.map(normalizeExchange).filter(Boolean)));
  return deduped.length ? deduped : [...HEATMAP_DEFAULT_EXCHANGES];
}

function getHeatmapCacheKey(baseCoin: string, interval: string, exchanges: string[]) {
  return `${baseCoin}|${interval}|${exchanges.join(",")}`;
}

type HeatmapNode = {
  price: number;
  estimated: number;
};

type SideBandSummary = {
  bands: LiquidationBandTier[];
  total: number;
};

function buildSideBands(
  side: "longs" | "shorts",
  nodes: HeatmapNode[],
  currentPrice: number,
): SideBandSummary {
  const bands: LiquidationBandTier[] = [];
  let previousPct = 0;

  for (const bandPct of HEATMAP_BAND_LEVELS) {
    const lowPct = previousPct;
    const highPct = bandPct;

    const incrementalNodes = side === "longs"
      ? nodes.filter((node) => {
          const distance = ((currentPrice - node.price) / currentPrice) * 100;
          return distance > lowPct && distance <= highPct;
        })
      : nodes.filter((node) => {
          const distance = ((node.price - currentPrice) / currentPrice) * 100;
          return distance > lowPct && distance <= highPct;
        });

    const cumulativeNodes = side === "longs"
      ? nodes.filter((node) => {
          const distance = ((currentPrice - node.price) / currentPrice) * 100;
          return distance > 0 && distance <= highPct;
        })
      : nodes.filter((node) => {
          const distance = ((node.price - currentPrice) / currentPrice) * 100;
          return distance > 0 && distance <= highPct;
        });

    const incrementalSum = incrementalNodes.reduce((sum, node) => sum + node.estimated, 0);
    const cumulativeSum = cumulativeNodes.reduce((sum, node) => sum + node.estimated, 0);
    const peakNode = cumulativeNodes.reduce<HeatmapNode | null>(
      (best, node) => (!best || node.estimated > best.estimated ? node : best),
      null,
    );

    const signedBandPct = side === "longs" ? -bandPct : bandPct;
    const bandPrice = side === "longs"
      ? currentPrice * (1 - bandPct / 100)
      : currentPrice * (1 + bandPct / 100);

    bands.push({
      band_pct: bandPct,
      price_level: round(bandPrice, 2),
      distance_pct: signedBandPct,
      estimated_liquidations_usd: round(cumulativeSum, 2),
      incremental_liquidations_usd: round(incrementalSum, 2),
      peak_price_level: peakNode ? round(peakNode.price, 2) : null,
      peak_estimated_liquidations_usd: peakNode ? round(peakNode.estimated, 2) : null,
      nodes: cumulativeNodes.length,
    });

    previousPct = bandPct;
  }

  const total = nodes.reduce((sum, node) => sum + node.estimated, 0);
  return { bands, total: round(total, 2) };
}

function buildTopLevels(nodes: HeatmapNode[], currentPrice: number): LiquidationLevel[] {
  return nodes
    .slice()
    .sort((a, b) => b.estimated - a.estimated)
    .slice(0, 8)
    .map((node) => ({
      price_level: round(node.price, 2),
      distance_pct: round(((node.price - currentPrice) / currentPrice) * 100, 2),
      estimated_liquidations_usd: round(node.estimated, 2),
    }));
}

function mergeHeatmapNodes(maps: CoinankLiquidationMap[]): {
  currentPrice: number;
  nodes: HeatmapNode[];
} {
  const byPrice = new Map<number, number>();
  const currentPriceCandidates: number[] = [];

  for (const map of maps) {
    const prices = Array.isArray(map.prices) ? map.prices : [];
    if (!prices.length) continue;

    const directLast = toFiniteNumber(map.lastPrice);
    if (directLast !== null && directLast > 0) {
      currentPriceCandidates.push(directLast);
    } else {
      const idx = Number(map.lastIndex);
      if (Number.isInteger(idx) && idx >= 0 && idx < prices.length) {
        const fallbackPrice = toFiniteNumber(prices[idx]);
        if (fallbackPrice !== null && fallbackPrice > 0) {
          currentPriceCandidates.push(fallbackPrice);
        }
      }
    }

    for (let i = 0; i < prices.length; i += 1) {
      const price = toFiniteNumber(prices[i]);
      if (price === null || price <= 0) continue;

      let estimated = 0;
      for (const key of HEATMAP_LEVERAGE_KEYS) {
        const ladder = map[key];
        if (!Array.isArray(ladder)) continue;
        estimated += toFiniteNumber(ladder[i]) ?? 0;
      }
      if (!(estimated > 0)) continue;

      const normalizedPrice = round(price, 2);
      byPrice.set(normalizedPrice, (byPrice.get(normalizedPrice) ?? 0) + estimated);
    }
  }

  const nodes = Array.from(byPrice.entries())
    .map(([price, estimated]) => ({ price, estimated }))
    .sort((a, b) => a.price - b.price);

  if (!nodes.length) {
    throw new Error("CoinAnk heatmap returned no usable nodes.");
  }

  const currentPrice = currentPriceCandidates.length
    ? currentPriceCandidates.reduce((sum, value) => sum + value, 0) / currentPriceCandidates.length
    : nodes[Math.floor(nodes.length / 2)].price;

  return {
    currentPrice: round(currentPrice, 2),
    nodes,
  };
}

async function fetchExchangeHeatmap(
  baseCoin: string,
  exchange: string,
  interval: string,
): Promise<CoinankLiquidationMap> {
  const symbol = `${baseCoin}USDT`;
  return await coinankGet<CoinankLiquidationMap>("/api/liqMap/getLiqMap", {
    symbol,
    exchange,
    interval,
  });
}

export async function fetchLiquidationHeatmap(
  baseCoinRaw: string,
  options?: {
    interval?: string;
    exchanges?: string[];
    includeNodes?: boolean;
  },
): Promise<LiquidationHeatmap> {
  const baseCoin = normalizeHeatmapBaseCoin(baseCoinRaw);
  if (!baseCoin) {
    throw new Error("Heatmap symbol is required.");
  }

  const interval = normalizeInterval(options?.interval);
  const exchanges = normalizeExchanges(options?.exchanges);
  const cacheKey = getHeatmapCacheKey(baseCoin, interval, exchanges);
  const cached = HEATMAP_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const settled = await Promise.allSettled(
    exchanges.map((exchange) => fetchExchangeHeatmap(baseCoin, exchange, interval)),
  );

  const maps: CoinankLiquidationMap[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      maps.push(result.value);
    }
  }
  if (!maps.length) {
    const firstFailure = settled.find((result) => result.status === "rejected");
    const reason = firstFailure && firstFailure.status === "rejected"
      ? firstFailure.reason
      : "unknown error";
    throw new Error(
      `CoinAnk heatmap failed for ${baseCoin}: ${
        reason instanceof Error ? reason.message : String(reason)
      }`,
    );
  }

  const { currentPrice, nodes } = mergeHeatmapNodes(maps);
  const lowerNodes = nodes.filter((node) => node.price < currentPrice);
  const upperNodes = nodes.filter((node) => node.price > currentPrice);

  const longSummary = buildSideBands("longs", lowerNodes, currentPrice);
  const shortSummary = buildSideBands("shorts", upperNodes, currentPrice);

  const lowerWithin25 = lowerNodes.filter(
    (node) => ((currentPrice - node.price) / currentPrice) * 100 <= 25,
  );
  const upperWithin25 = upperNodes.filter(
    (node) => ((node.price - currentPrice) / currentPrice) * 100 <= 25,
  );

  const payload: LiquidationHeatmap = {
    symbol: baseCoin,
    current_price: currentPrice,
    asOfUtc: new Date().toISOString(),
    source: {
      provider: "coinank",
      interval,
      exchanges,
    },
    liquidation_bands: {
      longs: longSummary.bands,
      shorts: shortSummary.bands,
    },
    aggregate_density: {
      longs_total_below_current_usd: longSummary.total,
      shorts_total_above_current_usd: shortSummary.total,
    },
    key_levels: {
      longs: buildTopLevels(lowerWithin25, currentPrice),
      shorts: buildTopLevels(upperWithin25, currentPrice),
    },
  };

  if (options?.includeNodes) {
    payload.nodes = nodes.map((node) => {
      const distancePct = ((node.price - currentPrice) / currentPrice) * 100;
      const side: "below" | "above" | "at" =
        node.price < currentPrice ? "below" : node.price > currentPrice ? "above" : "at";
      return {
        price_level: round(node.price, 2),
        distance_pct: round(distancePct, 4),
        estimated_liquidations_usd: round(node.estimated, 2),
        side,
      };
    });
  }

  HEATMAP_CACHE.set(cacheKey, {
    value: payload,
    expiresAt: Date.now() + HEATMAP_CACHE_TTL_MS,
  });
  return payload;
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
