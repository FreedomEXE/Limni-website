import type { BasketSignal } from "@/lib/basketSignals";
import { type PlannedPair } from "@/lib/plannedTrades";
import { fetchOandaPricing } from "@/lib/oandaTrade";
import { getOandaInstrument } from "@/lib/oandaPrices";
import { findLotMapEntry, type LotMapRow } from "@/lib/accounts/mt5ViewHelpers";
import type { Mt5PlanningDiagnostics as Mt5PlanningDiagnosticsPayload } from "@/lib/mt5Store";
import { useEaPlanningDiagnostics } from "@/lib/config/eaFeatures";

type PlannedPairWithDisplay = PlannedPair & {
  entryPrice?: number | null;
  stopLoss1pct?: number | null;
  units?: number;
  netUnits?: number;
  move1pctUsd?: number;
};

export type Mt5PlannedSummary = {
  marginUsed?: number | null;
  marginUsedBestCase?: number | null;
  marginAvailable?: number | null;
  scale?: number | null;
  currency?: string | null;
} | null;

type PlannedModel = "antikythera" | "blended" | "commercial" | "dealer" | "sentiment";

export type Mt5PlanningDiagnostics = {
  rawApiLegCount: number;
  eaFilteredLegCount: number;
  displayedLegCount: number;
  modelLegCounts: Record<PlannedModel, number>;
  filtersApplied: {
    dropNetted: boolean;
    forceFxOnly: boolean;
    dropNeutral: boolean;
    resolveSymbol: boolean;
  };
  skippedByReason?: Record<string, number>;
  capacityLimited?: boolean;
  capacityLimitReason?: string | null;
};

function emptyModelCounts(): Record<PlannedModel, number> {
  return {
    antikythera: 0,
    blended: 0,
    commercial: 0,
    dealer: 0,
    sentiment: 0,
  };
}

function countLegsByModel(plannedPairs: PlannedPair[]) {
  const counts = emptyModelCounts();
  for (const pair of plannedPairs) {
    for (const leg of pair.legs ?? []) {
      const model = String(leg.model ?? "").toLowerCase() as PlannedModel;
      if (model in counts) {
        counts[model] += 1;
      }
    }
  }
  return counts;
}

function parseAssetClassFromSymbol(symbol: string): string {
  const upper = String(symbol ?? "").toUpperCase();
  if (upper.includes("BTC") || upper.includes("ETH")) return "crypto";
  return "fx";
}

function modelCountsFromPayload(payload?: Mt5PlanningDiagnosticsPayload | undefined) {
  const counts = emptyModelCounts();
  const source = payload?.signals_accepted_count_by_model ?? {};
  for (const [key, value] of Object.entries(source)) {
    const model = String(key).toLowerCase() as PlannedModel;
    if (!(model in counts)) continue;
    counts[model] = Number(value ?? 0);
  }
  return counts;
}

function buildPlannedPairsFromDiagnostics(payload?: Mt5PlanningDiagnosticsPayload | undefined) {
  const legs = Array.isArray(payload?.planned_legs) ? payload.planned_legs : [];
  const map = new Map<string, PlannedPair>();
  for (const leg of legs) {
    const symbol = String(leg.symbol ?? "").toUpperCase();
    const model = String(leg.model ?? "").toLowerCase();
    const direction = String(leg.direction ?? "").toUpperCase();
    if (!symbol || !model || (direction !== "LONG" && direction !== "SHORT")) continue;
    const key = `${parseAssetClassFromSymbol(symbol)}:${symbol}`;
    if (!map.has(key)) {
      map.set(key, {
        symbol,
        assetClass: parseAssetClassFromSymbol(symbol),
        net: 0,
        legs: [],
      });
    }
    const row = map.get(key)!;
    row.legs.push({
      model: model as PlannedPair["legs"][number]["model"],
      direction: direction as "LONG" | "SHORT",
    });
    row.net += direction === "LONG" ? 1 : -1;
  }
  return Array.from(map.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export async function buildMt5PlannedView(options: {
  basketSignals: { pairs: BasketSignal[] } | null;
  planningDiagnostics?: Mt5PlanningDiagnosticsPayload;
  selectedWeek: string;
  currentWeekOpenUtc: string;
  nextWeekOpenUtc: string | null;
  forceFxOnlyPlanned: boolean;
  lotMapRows: LotMapRow[];
  freeMargin: number;
  equity: number;
  currency: string;
}) {
  const {
    basketSignals,
    planningDiagnostics,
    selectedWeek,
    currentWeekOpenUtc,
    nextWeekOpenUtc,
    forceFxOnlyPlanned,
    lotMapRows,
    freeMargin,
    equity,
    currency,
  } = options;

  const diagnosticsEnabled = useEaPlanningDiagnostics();
  let plannedPairs = diagnosticsEnabled
    ? buildPlannedPairsFromDiagnostics(planningDiagnostics)
    : [];
  let plannedSummary: Mt5PlannedSummary = null;
  const allowPlannedWeek =
    selectedWeek === currentWeekOpenUtc || (nextWeekOpenUtc ? selectedWeek === nextWeekOpenUtc : false);
  if (!allowPlannedWeek) {
    plannedPairs = [];
  }

  const showStopLoss1pct = forceFxOnlyPlanned;
  const plannedMidBySymbol = new Map<string, number>();
  if (showStopLoss1pct && plannedPairs.length > 0) {
    try {
      const instruments = Array.from(
        new Set(
          plannedPairs
            .filter((pair) => String(pair.assetClass ?? "").toLowerCase() === "fx")
            .map((pair) => getOandaInstrument(pair.symbol)),
        ),
      );
      const pricing = await fetchOandaPricing(instruments);
      for (const price of pricing) {
        const bid = Number(price.closeoutBid ?? price.bids?.[0]?.price ?? NaN);
        const ask = Number(price.closeoutAsk ?? price.asks?.[0]?.price ?? NaN);
        const mid = Number.isFinite(bid) && Number.isFinite(ask) ? (bid + ask) / 2 : NaN;
        if (!Number.isFinite(mid)) {
          continue;
        }
        const symbol = price.instrument.includes("_")
          ? price.instrument.replace("_", "")
          : price.instrument.replace("/", "");
        plannedMidBySymbol.set(symbol.toUpperCase(), mid);
      }
    } catch (error) {
      console.error("Failed to fetch pricing for stop-loss recommendations:", error);
    }
  }

  if (showStopLoss1pct && plannedPairs.length > 0) {
    plannedPairs = plannedPairs.map((pair) => {
      const mid = plannedMidBySymbol.get(pair.symbol.toUpperCase()) ?? null;
      const stopLoss1pct =
        mid && Number.isFinite(mid)
          ? pair.net > 0
            ? mid * 0.99
            : pair.net < 0
              ? mid * 1.01
              : null
          : null;
      return {
        ...pair,
        entryPrice: mid,
        stopLoss1pct,
      } as PlannedPairWithDisplay;
    });
  }

  if (plannedPairs.length > 0 && lotMapRows.length > 0) {
    const marginAvailable =
      Number.isFinite(freeMargin) && freeMargin > 0
        ? freeMargin
        : Number.isFinite(equity) && equity > 0
          ? equity
          : null;
    let grossMargin = 0.0;
    let bestCaseMargin = 0.0;

    plannedPairs = plannedPairs.map((pair) => {
      const sizing = findLotMapEntry(lotMapRows, pair.symbol);
      if (!sizing || !Number.isFinite(sizing.lot)) {
        return pair;
      }
      const perLegLot = Number(sizing.lot);
      const netLots = perLegLot * pair.net;
      const movePerLeg = Number.isFinite(sizing.move_1pct_usd) ? Number(sizing.move_1pct_usd) : null;
      const moveNet = movePerLeg !== null ? Math.abs(pair.net) * movePerLeg : null;
      const perLegMargin = Number.isFinite(sizing.margin_required) ? Number(sizing.margin_required) : 0;
      if (Number.isFinite(perLegMargin) && perLegMargin > 0) {
        grossMargin += perLegMargin * pair.legs.length;
        bestCaseMargin += perLegMargin * Math.abs(pair.net);
      }
      const row = pair as PlannedPairWithDisplay;
      return {
        ...pair,
        entryPrice: row.entryPrice ?? null,
        stopLoss1pct: row.stopLoss1pct ?? null,
        units: perLegLot,
        netUnits: netLots,
        move1pctUsd: moveNet ?? undefined,
        legs: pair.legs.map((leg) => ({
          ...leg,
          units: perLegLot,
          move1pctUsd: movePerLeg ?? undefined,
        })),
      } as PlannedPairWithDisplay & {
        legs: Array<typeof pair.legs[number] & { units: number; move1pctUsd?: number }>;
      };
    });

    const buffer = 0.1;
    const scale =
      marginAvailable && grossMargin > 0
        ? Math.min(1, (marginAvailable * (1 - buffer)) / grossMargin)
        : null;
    plannedSummary = {
      marginUsed: grossMargin,
      marginUsedBestCase: bestCaseMargin,
      marginAvailable,
      scale,
      currency: currency === "USD" ? "$" : `${currency} `,
    };
  }

  const diagnosticsAvailable = diagnosticsEnabled && allowPlannedWeek && plannedPairs.length > 0;
  const mode: "available" | "missing" | "legacy" | "disabled" = !diagnosticsEnabled
    ? "disabled"
    : !allowPlannedWeek
      ? "legacy"
      : diagnosticsAvailable
        ? "available"
        : "missing";

  return {
    plannedPairs,
    plannedSummary,
    showStopLoss1pct,
    planningMode: mode,
    planningDiagnostics:
      mode === "available"
        ? ({
            rawApiLegCount: Number(
              Object.values(planningDiagnostics?.signals_raw_count_by_model ?? {}).reduce(
                (sum, value) => sum + Number(value ?? 0),
                0,
              ),
            ),
            eaFilteredLegCount: Number(
              Object.values(planningDiagnostics?.signals_accepted_count_by_model ?? {}).reduce(
                (sum, value) => sum + Number(value ?? 0),
                0,
              ),
            ),
            displayedLegCount: plannedPairs.reduce((sum, pair) => sum + (pair.legs?.length ?? 0), 0),
            modelLegCounts: (() => {
              const fromPayload = modelCountsFromPayload(planningDiagnostics);
              const total = Object.values(fromPayload).reduce((sum, value) => sum + value, 0);
              return total > 0 ? fromPayload : countLegsByModel(plannedPairs);
            })(),
            filtersApplied: {
              dropNetted: false,
              forceFxOnly: forceFxOnlyPlanned,
              dropNeutral: true,
              resolveSymbol: true,
            },
            skippedByReason: planningDiagnostics?.signals_skipped_count_by_reason ?? {},
            capacityLimited: Boolean(planningDiagnostics?.capacity_limited),
            capacityLimitReason: planningDiagnostics?.capacity_limit_reason ?? null,
          } satisfies Mt5PlanningDiagnostics)
        : undefined,
  };
}
