import { DateTime } from "luxon";
import { evaluateFreshness } from "@/lib/cotFreshness";
import { readSnapshot } from "@/lib/cotStore";
import { getAssetClass, listAssetClasses, type AssetClass } from "@/lib/cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { derivePairDirections, derivePairDirectionsByBase, type BiasMode } from "@/lib/cotCompute";
import { buildAntikytheraSignals } from "@/lib/antikythera";
import { getAggregatesForWeekStart, getLatestAggregatesLocked } from "@/lib/sentiment/store";
import { getWeekOpenUtc } from "@/lib/performanceSnapshots";
import type { SentimentAggregate } from "@/lib/sentiment/types";

export type BasketSignal = {
  symbol: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  model: "antikythera" | "blended" | "dealer" | "commercial" | "sentiment";
  asset_class: AssetClass;
};

type BasketSignalsResponse = {
  report_date: string;
  last_refresh_utc: string;
  asset_class: AssetClass | "all";
  trading_allowed: boolean;
  reason: string;
  week_open_utc: string;
  pairs: BasketSignal[];
};

function sentimentDirection(agg?: SentimentAggregate): "LONG" | "SHORT" | null {
  if (!agg) {
    return null;
  }
  if (agg.flip_state === "FLIPPED_UP") {
    return "LONG";
  }
  if (agg.flip_state === "FLIPPED_DOWN") {
    return "SHORT";
  }
  if (agg.flip_state === "FLIPPED_NEUTRAL") {
    return null;
  }
  if (agg.crowding_state === "CROWDED_LONG") {
    return "SHORT";
  }
  if (agg.crowding_state === "CROWDED_SHORT") {
    return "LONG";
  }
  return null;
}

function buildBiasPairs(
  assetClass: AssetClass,
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
  mode: BiasMode,
): BasketSignal[] {
  if (!snapshot) {
    return [];
  }
  const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass];
  const derived =
    assetClass === "fx"
      ? derivePairDirections(snapshot.currencies, pairDefs, mode)
      : derivePairDirectionsByBase(snapshot.currencies, pairDefs, mode);
  return pairDefs
    .map((pairDef) => {
      const info = derived[pairDef.pair];
      if (!info) {
        return null;
      }
      return {
        symbol: pairDef.pair,
        direction: info.direction,
        model: mode,
        asset_class: assetClass,
      } as BasketSignal;
    })
    .filter((row): row is BasketSignal => Boolean(row));
}

export async function buildBasketSignals(options?: {
  assetClass?: AssetClass | "all" | null;
}): Promise<BasketSignalsResponse> {
  const assetParam = options?.assetClass ?? "all";
  const assetClasses = assetParam && assetParam !== "all"
    ? [getAssetClass(assetParam)]
    : listAssetClasses().map((asset) => asset.id);

  const snapshots = await Promise.all(
    assetClasses.map((asset) => readSnapshot({ assetClass: asset })),
  );
  const available = snapshots
    .map((snapshot, index) => ({ snapshot, asset: assetClasses[index] }))
    .filter((row) => Boolean(row.snapshot));

  if (available.length === 0) {
    return {
      report_date: "",
      last_refresh_utc: "",
      asset_class: assetParam ?? "all",
      trading_allowed: false,
      reason: "no snapshot available",
      week_open_utc: getWeekOpenUtc(),
      pairs: [],
    };
  }

  const freshness = evaluateFreshness(
    available[0].snapshot!.report_date,
    available[0].snapshot!.last_refresh_utc,
  );
  const weekOpen = getWeekOpenUtc();
  const weekOpenDt = DateTime.fromISO(weekOpen, { zone: "utc" });
  const weekClose = weekOpenDt.isValid ? weekOpenDt.plus({ days: 7 }) : weekOpenDt;
  const sentiment = await getAggregatesForWeekStart(
    weekOpenDt.toUTC().toISO() ?? weekOpen,
    weekClose.toUTC().toISO() ?? weekOpen,
  );
  const latestSentiment = await getLatestAggregatesLocked();
  const sentimentMap = new Map(sentiment.map((agg) => [agg.symbol, agg]));
  for (const agg of latestSentiment) {
    if (!sentimentMap.has(agg.symbol)) {
      sentimentMap.set(agg.symbol, agg);
    }
  }

  const pairs: BasketSignal[] = [];

  for (const entry of available) {
    const snapshot = entry.snapshot!;
    const asset = entry.asset;
    pairs.push(...buildBiasPairs(asset, snapshot, "blended"));
    pairs.push(...buildBiasPairs(asset, snapshot, "dealer"));
    pairs.push(...buildBiasPairs(asset, snapshot, "commercial"));

    const antikytheraSignals = buildAntikytheraSignals({
      assetClass: asset,
      snapshot,
      sentiment,
      maxSignals: 200,
    });
    pairs.push(
      ...antikytheraSignals.map((signal): BasketSignal => ({
        symbol: signal.pair,
        direction: signal.direction,
        model: "antikythera",
        asset_class: asset,
      })),
    );
  }

  for (const asset of assetClasses) {
    const sentimentPairs = PAIRS_BY_ASSET_CLASS[asset]
      .map((pairDef) => {
        const direction = sentimentDirection(sentimentMap.get(pairDef.pair));
        if (!direction) {
          return null;
        }
        return {
          symbol: pairDef.pair,
          direction,
          model: "sentiment",
          asset_class: asset,
        } as BasketSignal;
      })
      .filter((row): row is BasketSignal => Boolean(row));
    pairs.push(...sentimentPairs);
  }

  return {
    report_date: available[0].snapshot!.report_date,
    last_refresh_utc: available[0].snapshot!.last_refresh_utc,
    asset_class: assetParam ?? "all",
    trading_allowed: freshness.trading_allowed,
    reason: freshness.reason,
    week_open_utc: weekOpen,
    pairs,
  };
}
