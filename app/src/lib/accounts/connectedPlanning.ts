import type { BasketSignal } from "@/lib/basketSignals";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { fetchBitgetFuturesSnapshot } from "@/lib/bitget";
import { buildOandaSizingForAccount, type OandaSizingRow } from "@/lib/oandaSizing";
import {
  buildBitgetPlannedTrades,
  filterForBitget,
  filterForOandaFx,
  groupSignals,
  type PlannedPair,
} from "@/lib/plannedTrades";
import { parseSelectedModels } from "@/lib/accounts/connectedViewHelpers";

export function buildBasePlannedPairs(options: {
  provider: "oanda" | "bitget" | "mt5";
  basketPairs: BasketSignal[];
  config: Record<string, unknown> | null;
}) {
  const { provider, basketPairs, config } = options;
  let plannedPairs: PlannedPair[] = [];
  let plannedNote: string | null = null;

  if (provider === "bitget") {
    const filtered = filterForBitget(basketPairs);
    const planned = buildBitgetPlannedTrades(filtered);
    plannedPairs = planned.pairs.map((pair) => ({
      ...pair,
      symbol:
        pair.symbol.toUpperCase() === "BTCUSD"
          ? "BTCUSDT"
          : pair.symbol.toUpperCase() === "ETHUSD"
            ? "ETHUSDT"
            : pair.symbol,
      net: pair.net > 0 ? 1 : pair.net < 0 ? -1 : 0,
    }));
    plannedNote = planned.note ?? null;
    return { plannedPairs, plannedNote };
  }

  if (provider === "oanda") {
    const filtered = filterForOandaFx(basketPairs);
    const modelsRaw = config?.models ?? config?.oandaModels ?? process.env.OANDA_MODELS ?? "";
    const selectedModels = parseSelectedModels(modelsRaw);
    plannedPairs = groupSignals(
      filtered,
      selectedModels.length > 0 ? selectedModels : undefined,
      { dropNetted: false },
    );
    if (selectedModels.length > 0) {
      plannedNote = `Model scope: ${selectedModels.map((m) => m.toUpperCase()).join(", ")}`;
    }
    return { plannedPairs, plannedNote };
  }

  return { plannedPairs, plannedNote };
}

export function normalizeMappedRows(options: {
  provider: "oanda" | "bitget" | "mt5";
  mapped: Array<{ symbol: string; instrument: string; available: boolean }>;
}) {
  const { provider, mapped } = options;
  const fallbackMapped =
    provider === "bitget"
      ? [
          { symbol: "BTCUSD", instrument: "BTCUSDT", available: true },
          { symbol: "ETHUSD", instrument: "ETHUSDT", available: true },
        ]
      : [];
  let mappedRows = mapped.length > 0 ? mapped : fallbackMapped;
  if (provider === "oanda") {
    const fxSet = new Set(PAIRS_BY_ASSET_CLASS.fx.map((row) => row.pair));
    mappedRows = mappedRows.filter((row) => fxSet.has(row.symbol));
  }
  return mappedRows;
}

export function roundPlannedUnits(units: number, precision: number, minUnits?: number) {
  const p = Math.max(0, precision);
  const factor = p > 0 ? 10 ** p : 1;
  const truncated = p > 0 ? Math.floor(units * factor) / factor : Math.floor(units);
  const safe = Number.isFinite(truncated) ? truncated : 0;
  if (minUnits && safe > 0 && safe < minUnits) {
    return 0;
  }
  return safe;
}

export async function applyBitgetPlannedSizing(options: {
  plannedPairs: PlannedPair[];
  accountKey: string;
  statsEquity: number;
  leverage: number;
  fetchUsdtEquity: (accountKey: string) => Promise<number | null>;
}) {
  let { plannedPairs } = options;
  const { accountKey, statsEquity, leverage, fetchUsdtEquity } = options;

  let equity = statsEquity;
  if (!(equity > 0)) {
    const fetched = await fetchUsdtEquity(accountKey);
    if (fetched && fetched > 0) {
      equity = fetched;
    }
  }
  const marginPerSymbol = equity > 0 ? equity / plannedPairs.length : 0;
  const notionalPerSymbol =
    equity > 0 && Number.isFinite(leverage) && leverage > 0
      ? (equity * leverage) / plannedPairs.length
      : 0;

  const priceBySymbol = new Map<string, number>();
  try {
    const [btc, eth] = await Promise.all([
      fetchBitgetFuturesSnapshot("BTC"),
      fetchBitgetFuturesSnapshot("ETH"),
    ]);
    if (Number.isFinite(Number(btc.lastPrice))) priceBySymbol.set("BTCUSD", Number(btc.lastPrice));
    if (Number.isFinite(Number(eth.lastPrice))) priceBySymbol.set("ETHUSD", Number(eth.lastPrice));
  } catch (error) {
    console.error("Failed to load Bitget prices for planned sizing:", error);
  }

  plannedPairs = plannedPairs.map((pair) => {
    const price = priceBySymbol.get(pair.symbol);
    if (!price || !Number.isFinite(price) || price <= 0 || notionalPerSymbol <= 0) {
      return pair;
    }
    const qty = notionalPerSymbol / price;
    const legQty = pair.legs.length > 0 ? qty / pair.legs.length : qty;
    const move1pctNet = notionalPerSymbol * 0.01;
    const move1pctLeg = (notionalPerSymbol / Math.max(1, pair.legs.length)) * 0.01;
    const sizeDisplay = Number.isFinite(leverage) && leverage > 0 ? `${leverage}x` : null;
    const riskDisplay = marginPerSymbol > 0 ? `$${marginPerSymbol.toFixed(2)}` : null;
    const riskDisplayLeg =
      marginPerSymbol > 0
        ? `$${(marginPerSymbol / Math.max(1, pair.legs.length)).toFixed(2)}`
        : null;
    return {
      ...pair,
      units: legQty,
      netUnits: qty * (pair.net > 0 ? 1 : pair.net < 0 ? -1 : 0),
      move1pctUsd: move1pctNet,
      sizeDisplay,
      riskDisplay,
      legs: pair.legs.map((leg) => ({
        ...leg,
        units: legQty,
        move1pctUsd: move1pctLeg,
        sizeDisplay,
        riskDisplay: riskDisplayLeg,
      })),
    } as typeof pair & {
      units: number;
      netUnits: number;
      move1pctUsd: number;
      sizeDisplay: string | null;
      riskDisplay: string | null;
      legs: Array<
        typeof pair.legs[number] & {
          units: number;
          move1pctUsd: number;
          sizeDisplay?: string | null;
          riskDisplay?: string | null;
        }
      >;
    };
  });

  return { plannedPairs };
}

export async function applyOandaPlannedSizing(options: {
  plannedPairs: PlannedPair[];
  accountKey: string;
  config: Record<string, unknown> | null;
}) {
  let { plannedPairs } = options;
  const { accountKey, config } = options;
  let plannedSummary: {
    marginUsed?: number | null;
    marginAvailable?: number | null;
    scale?: number | null;
    currency?: string | null;
  } | null = null;
  let plannedSizingBySymbol = new Map<string, OandaSizingRow>();

  try {
    const sizing = await buildOandaSizingForAccount(accountKey, {
      symbols: plannedPairs.map((pair) => pair.symbol),
    });
    plannedSizingBySymbol = new Map(
      sizing.rows.filter((row) => row.available).map((row) => [row.symbol, row]),
    );
    const buffer =
      typeof config?.marginBuffer === "number" ? config.marginBuffer : 0.1;
    let totalMargin = 0;
    // When trading per-leg hedged baskets with OPEN_ONLY, margin is often assessed on gross exposure.
    // Scale using gross margin across legs, not net exposure.
    for (const pair of plannedPairs) {
      const row = plannedSizingBySymbol.get(pair.symbol);
      if (!row || !row.available) continue;
      if (!Number.isFinite(row.marginRate ?? NaN) || !Number.isFinite(row.notionalUsdPerUnit ?? NaN)) continue;
      if (!Number.isFinite(row.units ?? NaN)) continue;
      const legs = Array.isArray(pair.legs) ? pair.legs : [];
      const legCount = Math.max(
        0,
        legs.filter((leg) => String(leg.direction ?? "").toUpperCase() !== "NEUTRAL").length,
      );
      if (legCount === 0) continue;
      const perLegNotional = Math.abs((row.units ?? 0) * (row.notionalUsdPerUnit ?? 0));
      totalMargin += perLegNotional * (row.marginRate ?? 0) * legCount;
    }
    // marginAvailable can legitimately be 0; treat that as "no free margin", not "missing".
    const available = Number.isFinite(sizing.marginAvailable ?? NaN)
      ? Number(sizing.marginAvailable)
      : Number.isFinite(sizing.nav ?? NaN)
        ? Number(sizing.nav)
        : 0;
    const scale = totalMargin > 0 ? Math.min(1, (available * (1 - buffer)) / totalMargin) : 1;
    plannedSummary = {
      marginUsed: totalMargin * scale,
      marginAvailable: Number.isFinite(sizing.marginAvailable ?? NaN) ? sizing.marginAvailable : null,
      scale,
      currency: sizing.currency === "USD" ? "$" : `${sizing.currency ?? "USD"} `,
    };

    plannedPairs = plannedPairs.map((pair) => {
      const row = plannedSizingBySymbol.get(pair.symbol);
      if (!row || !row.available || !Number.isFinite(row.units ?? NaN)) {
        return pair;
      }
      const precision = row.tradeUnitsPrecision ?? 0;
      const scaledUnits = roundPlannedUnits((row.units ?? 0) * scale, precision, row.minUnits);
      if (!Number.isFinite(scaledUnits) || scaledUnits <= 0) {
        return {
          ...pair,
          units: 0,
          netUnits: 0,
          move1pctUsd: 0,
          legs: pair.legs.map((leg) => ({ ...leg, units: 0, move1pctUsd: 0 })),
        } as typeof pair & {
          units: number;
          netUnits: number;
          move1pctUsd: number;
          legs: Array<typeof pair.legs[number] & { units: number; move1pctUsd: number }>;
        };
      }
      const netUnits = scaledUnits * pair.net;
      const notionalPerUnit = row.notionalUsdPerUnit ?? 0;
      const move1pctUsd = Math.abs(netUnits) * notionalPerUnit * 0.01;
      return {
        ...pair,
        units: scaledUnits,
        netUnits,
        move1pctUsd,
        legs: pair.legs.map((leg) => ({
          ...leg,
          units: scaledUnits,
          move1pctUsd: scaledUnits * notionalPerUnit * 0.01,
        })),
      } as typeof pair & {
        units: number;
        netUnits: number;
        move1pctUsd: number;
        legs: Array<typeof pair.legs[number] & { units: number; move1pctUsd: number }>;
      };
    });
  } catch (error) {
    console.error("Failed to compute OANDA planned sizing:", error);
  }

  return { plannedPairs, plannedSummary };
}
