import type { BasketSignal } from "@/lib/basketSignals";
import type { PerformanceModel } from "@/lib/performanceLab";
import type { PerformanceSnapshot } from "@/lib/performanceSnapshots";

export const UNIVERSAL_MODELS: PerformanceModel[] = [
  "antikythera",
  "blended",
  "dealer",
  "commercial",
  "sentiment",
];

export type PlannedLeg = {
  model: PerformanceModel;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  reason?: string;
};

export type PlannedPair = {
  symbol: string;
  assetClass: string;
  net: number;
  legs: PlannedLeg[];
};

const BITGET_REQUIRED_MODELS: PerformanceModel[] = [
  "antikythera",
  "dealer",
  "commercial",
  "sentiment",
];

const BITGET_SYMBOLS = ["BTCUSD", "ETHUSD"] as const;

function directionToScore(direction: PlannedLeg["direction"]) {
  if (direction === "LONG") return 1;
  if (direction === "SHORT") return -1;
  return 0;
}

export function groupSignals(
  pairs: BasketSignal[],
  models: PerformanceModel[] = UNIVERSAL_MODELS,
  options?: { dropNetted?: boolean },
): PlannedPair[] {
  const dropNetted = options?.dropNetted ?? true;
  const modelSet = new Set(models);
  const grouped = new Map<string, PlannedPair>();
  for (const pair of pairs) {
    if (!modelSet.has(pair.model)) {
      continue;
    }
    if (pair.direction === "NEUTRAL") {
      continue;
    }
    const key = `${pair.asset_class}:${pair.symbol}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        symbol: pair.symbol,
        assetClass: pair.asset_class,
        net: 0,
        legs: [],
      });
    }
    const entry = grouped.get(key)!;
    const leg: PlannedLeg = {
      model: pair.model,
      direction: pair.direction,
    };
    entry.legs.push(leg);
    entry.net += directionToScore(pair.direction);
  }
  return Array.from(grouped.values())
    .filter((row) => (dropNetted ? row.net !== 0 : true))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function filterForOanda(pairs: BasketSignal[]) {
  return pairs.filter((pair) => pair.asset_class !== "crypto");
}

export function filterForOandaFx(pairs: BasketSignal[]) {
  return pairs.filter((pair) => pair.asset_class === "fx");
}

export function filterForBitget(pairs: BasketSignal[]) {
  return pairs.filter(
    (pair) =>
      pair.asset_class === "crypto" &&
      BITGET_SYMBOLS.includes(pair.symbol as (typeof BITGET_SYMBOLS)[number]),
  );
}

export function resolveBitgetAlignment(pairs: BasketSignal[]) {
  const bySymbol = new Map<string, Map<PerformanceModel, PlannedLeg["direction"]>>();
  for (const pair of pairs) {
    if (!BITGET_SYMBOLS.includes(pair.symbol as (typeof BITGET_SYMBOLS)[number])) {
      continue;
    }
    if (!bySymbol.has(pair.symbol)) {
      bySymbol.set(pair.symbol, new Map());
    }
    bySymbol.get(pair.symbol)!.set(pair.model, pair.direction);
  }

  let direction: "LONG" | "SHORT" | null = null;
  for (const symbol of BITGET_SYMBOLS) {
    const modelMap = bySymbol.get(symbol);
    if (!modelMap) {
      return { ok: false, reason: `${symbol} missing signals` };
    }
    for (const model of BITGET_REQUIRED_MODELS) {
      const dir = modelMap.get(model);
      if (!dir || dir === "NEUTRAL") {
        return { ok: false, reason: `${symbol} ${model} neutral` };
      }
      if (!direction) {
        direction = dir;
      } else if (direction !== dir) {
        return { ok: false, reason: `${symbol} ${model} mismatch` };
      }
    }
  }

  if (!direction) {
    return { ok: false, reason: "No aligned direction" };
  }

  return { ok: true, direction };
}

export function buildBitgetPlannedTrades(pairs: BasketSignal[]) {
  const alignment = resolveBitgetAlignment(pairs);
  if (!alignment.ok) {
    return { pairs: [] as PlannedPair[], note: alignment.reason };
  }
  const filtered = filterForBitget(pairs).filter((pair) =>
    BITGET_REQUIRED_MODELS.includes(pair.model),
  );
  return { pairs: groupSignals(filtered, BITGET_REQUIRED_MODELS), note: null };
}

export function signalsFromSnapshots(rows: PerformanceSnapshot[]): BasketSignal[] {
  return rows.flatMap((row) =>
    row.pair_details.map((detail) => ({
      symbol: detail.pair,
      direction: detail.direction,
      model: row.model,
      asset_class: row.asset_class,
    })),
  );
}
