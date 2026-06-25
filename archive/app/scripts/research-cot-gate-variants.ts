/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: research-cot-gate-variants.ts
 *
 * Description:
 * Phase 1 COT extremes gate research. Tests COT gate variants across
 * 4 strategies using Weekly Hold and a middle Weekly Signal + ADR TP
 * execution model. All decisions are binary: trade, skip, or flip.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { DateTime } from "luxon";
import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import {
  getCanonicalBasketWeek,
  filterByModel,
  nonNeutralSignals,
  type CanonicalBasketSignal,
} from "../src/lib/performance/basketSource";
import {
  buildCotGateContext,
  directionalPercentile,
  normalizeCotPairAlias,
  resolveCotMarketId,
  resolveCotMarketNet,
  type CotGateContext,
} from "../src/lib/performance/gateEvaluation";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "../src/lib/performance/adrLookup";
import { loadPathBars } from "../src/lib/performance/pathBarLoader";
import {
  computeMultiWeekHold,
  type MultiWeekResult,
  type WeeklyHoldTrade,
} from "../src/lib/performance/weeklyHoldEngine";
import {
  getEntryStyle,
  getStrengthGate,
  getStrategy,
} from "../src/lib/performance/strategyConfig";
import { resolveSelectorFragilityDirections } from "../src/lib/performance/selectorEngine";
import { computeMaxDrawdownFromPercentReturns } from "../src/lib/performance/drawdown";
import { readCanonicalStrengthDirections } from "../src/lib/strength/canonicalDirection";
import { getDisplayWeekOpenUtc } from "../src/lib/weekAnchor";
import type { AssetClass } from "../src/lib/cotMarkets";
import type { CanonicalPriceBar } from "../src/lib/canonicalPriceBars";

type Direction = "LONG" | "SHORT";
type GateAction = "TRADE" | "SKIP" | "FLIP";
type StrategyId = "tandem" | "tiered_4w" | "agree_3of4" | "selector";
type VariantId =
  | "baseline:none"
  | "baseline:cap"
  | "cot_skip_90"
  | "cot_skip_85"
  | "cot_flip_95"
  | "cot_flip_90"
  | "hybrid_cap_skip_90"
  | "hybrid_cap_flip_95"
  | "delta_gate";

type DirectionEntry = {
  direction: Direction;
  source: string;
  tier: number | null;
  assetClass: string;
};

type PlannedTrade = {
  symbol: string;
  assetClass: string;
  direction: Direction;
  openPrice: number;
  closePrice: number;
  rawWeeklyReturnPct: number;
  returnPct: number;
  source: string;
  tier: number | null;
};

type WeekVariantResult = {
  weekOpenUtc: string;
  returnPct: number;
  trades: PlannedTrade[];
  skipped: DiagnosticTrade[];
  flipped: DiagnosticFlip[];
  unchanged: number;
  fallbackTrades: number;
  fallbackReturnPct: number;
  fallbackSymbols: string[];
};

type DiagnosticTrade = {
  symbol: string;
  returnPct: number;
  reason: string;
};

type DiagnosticFlip = {
  symbol: string;
  originalReturnPct: number;
  flippedReturnPct: number;
};

type AggregateStats = {
  strategy: StrategyId;
  variant: VariantId;
  returnPct: number;
  maxDrawdownPct: number;
  trades: number;
  winRatePct: number;
  rdd: number | null;
  sharpe: number;
  weeklyReturns: number[];
  skippedCount: number;
  skippedRawReturnPct: number;
  flippedCount: number;
  flippedOriginalReturnPct: number;
  flippedReturnPct: number;
  unchangedCount: number;
  fallbackTrades: number;
  fallbackReturnPct: number;
  fallbackSymbols: string[];
};

type CotExtreme = {
  maxPercentile: number;
  extremeComponents: Array<{
    marketId: string;
    percentile: number;
    tradeDirection: Direction;
    currentNet: number;
    priorNet: number | null;
  }>;
};

const STRATEGIES: StrategyId[] = ["tandem", "tiered_4w", "agree_3of4", "selector"];
const VARIANTS: VariantId[] = [
  "baseline:none",
  "baseline:cap",
  "cot_skip_90",
  "cot_skip_85",
  "cot_flip_95",
  "cot_flip_90",
  "hybrid_cap_skip_90",
  "hybrid_cap_flip_95",
  "delta_gate",
];

const COT_VARIANTS = VARIANTS.filter((variant) => !variant.startsWith("baseline:")) as VariantId[];
const TIERED_4W_WEIGHTS = { dealer: 2.0, commercial: 0.75, sentiment: 1.25, strength: 1.5 };
const EXPOSURE_CAP_LIMIT = 1.5;
const ADR_TP_MULTIPLE = 0.20;
const PARITY_TOLERANCE_RETURN = 0.05;
const PARITY_TOLERANCE_DD = 0.05;

function isDirection(value: unknown): value is Direction {
  return value === "LONG" || value === "SHORT";
}

function pairFromDirectionKey(key: string) {
  return (key.includes(":") ? key.split(":")[0]! : key).toUpperCase();
}

function inferAssetClass(symbol: string): AssetClass {
  const upper = symbol.toUpperCase();
  if (["BTCUSD", "ETHUSD", "BTCUSDT", "ETHUSDT", "SOLUSD", "SOLUSDT"].includes(upper)) return "crypto";
  if (["SPXUSD", "NDXUSD", "NIKKEIUSD", "UKXUSD", "DEUUSD"].includes(upper)) return "indices";
  if (["XAUUSD", "XAGUSD", "WTIUSD", "BCOUSD", "NGUSD"].includes(upper)) return "commodities";
  return "fx";
}

function signalsToDirectionMap(signals: CanonicalBasketSignal[], source: string) {
  const map = new Map<string, DirectionEntry>();
  for (const signal of signals) {
    if (!isDirection(signal.direction)) continue;
    map.set(signal.symbol.toUpperCase(), {
      direction: signal.direction,
      source,
      tier: null,
      assetClass: signal.assetClass,
    });
  }
  return map;
}

function classifyFourSourceTiePattern(votes: {
  dealer?: Direction;
  commercial?: Direction;
  sentiment?: Direction;
  strength?: Direction;
}) {
  const { dealer, commercial, sentiment, strength } = votes;
  if (!dealer || !commercial || !sentiment || !strength) return null;
  if (dealer === commercial && sentiment === strength && dealer !== sentiment) return "DC_vs_SeSt";
  if (dealer === sentiment && commercial === strength && dealer !== commercial) return "DSe_vs_CSt";
  if (dealer === strength && commercial === sentiment && dealer !== commercial) return "DSt_vs_CSe";
  return null;
}

function resolveAgree3of4Direction(votes: {
  dealer?: DirectionEntry;
  commercial?: DirectionEntry;
  sentiment?: DirectionEntry;
  strength?: DirectionEntry;
}): Direction | null {
  const directions = [votes.dealer?.direction, votes.commercial?.direction, votes.sentiment?.direction, votes.strength?.direction]
    .filter(isDirection);
  const longs = directions.filter((direction) => direction === "LONG").length;
  const shorts = directions.filter((direction) => direction === "SHORT").length;
  if (longs >= 3) return "LONG";
  if (shorts >= 3) return "SHORT";
  if (longs !== 2 || shorts !== 2) return null;
  const tiePattern = classifyFourSourceTiePattern({
    dealer: votes.dealer?.direction,
    commercial: votes.commercial?.direction,
    sentiment: votes.sentiment?.direction,
    strength: votes.strength?.direction,
  });
  if (tiePattern === "DC_vs_SeSt") return votes.sentiment?.direction ?? votes.strength?.direction ?? null;
  return null;
}

function computeWeightedScore(votes: {
  dealer?: DirectionEntry;
  commercial?: DirectionEntry;
  sentiment?: DirectionEntry;
  strength?: DirectionEntry;
}) {
  let score = 0;
  if (votes.dealer?.direction === "LONG") score += TIERED_4W_WEIGHTS.dealer;
  else if (votes.dealer?.direction === "SHORT") score -= TIERED_4W_WEIGHTS.dealer;
  if (votes.commercial?.direction === "LONG") score += TIERED_4W_WEIGHTS.commercial;
  else if (votes.commercial?.direction === "SHORT") score -= TIERED_4W_WEIGHTS.commercial;
  if (votes.sentiment?.direction === "LONG") score += TIERED_4W_WEIGHTS.sentiment;
  else if (votes.sentiment?.direction === "SHORT") score -= TIERED_4W_WEIGHTS.sentiment;
  if (votes.strength?.direction === "LONG") score += TIERED_4W_WEIGHTS.strength;
  else if (votes.strength?.direction === "SHORT") score -= TIERED_4W_WEIGHTS.strength;
  return score;
}

async function resolveDirections(strategy: StrategyId, weekOpenUtc: string) {
  const basketWeek = await getCanonicalBasketWeek(weekOpenUtc);
  const dealerMap = signalsToDirectionMap(nonNeutralSignals(filterByModel(basketWeek, "dealer")), "dealer");
  const commercialMap = signalsToDirectionMap(nonNeutralSignals(filterByModel(basketWeek, "commercial")), "commercial");
  const sentimentMap = signalsToDirectionMap(nonNeutralSignals(filterByModel(basketWeek, "sentiment")), "sentiment");
  let strengthMap = new Map<string, DirectionEntry>();

  if (strategy === "selector") {
    const [baseMap, selectiveMap] = await Promise.all([
      resolveSelectorFragilityDirections(weekOpenUtc, "fragility_3"),
      resolveSelectorFragilityDirections(weekOpenUtc, "opposed_or_building_against"),
    ]);
    const map = new Map<string, DirectionEntry>();
    for (const [pair, entry] of baseMap) map.set(`${pair}:dealer`, { ...entry, source: "dealer" });
    for (const [pair, entry] of selectiveMap) map.set(`${pair}:commercial`, { ...entry, source: "commercial" });
    return map;
  }

  const strengthRows = await readCanonicalStrengthDirections(weekOpenUtc);
  for (const row of strengthRows) {
    strengthMap.set(row.pair.toUpperCase(), {
      direction: row.direction,
      source: "strength",
      tier: null,
      assetClass: row.assetClass,
    });
  }

  if (strategy === "tandem") {
    const map = new Map<string, DirectionEntry>();
    for (const [pair, entry] of dealerMap) map.set(`${pair}:dealer`, { ...entry, source: "dealer" });
    for (const [pair, entry] of commercialMap) map.set(`${pair}:commercial`, { ...entry, source: "commercial" });
    for (const [pair, entry] of sentimentMap) map.set(`${pair}:sentiment`, { ...entry, source: "sentiment" });
    for (const [pair, entry] of strengthMap) map.set(`${pair}:strength`, { ...entry, source: "strength" });
    return map;
  }

  const allPairs = new Set([
    ...dealerMap.keys(),
    ...commercialMap.keys(),
    ...sentimentMap.keys(),
    ...strengthMap.keys(),
  ]);
  const map = new Map<string, DirectionEntry>();

  for (const pair of allPairs) {
    const dealer = dealerMap.get(pair);
    const commercial = commercialMap.get(pair);
    const sentiment = sentimentMap.get(pair);
    const strength = strengthMap.get(pair);
    const assetClass = dealer?.assetClass ?? commercial?.assetClass ?? sentiment?.assetClass ?? strength?.assetClass ?? inferAssetClass(pair);

    if (strategy === "tiered_4w") {
      const score = computeWeightedScore({ dealer, commercial, sentiment, strength });
      const absScore = Math.abs(score);
      if (absScore >= 4.0 || absScore >= 2.0) {
        map.set(pair, {
          direction: score > 0 ? "LONG" : "SHORT",
          source: "tiered_4w",
          tier: absScore >= 4.0 ? 1 : 2,
          assetClass,
        });
      }
    } else if (strategy === "agree_3of4") {
      const direction = resolveAgree3of4Direction({ dealer, commercial, sentiment, strength });
      if (direction) map.set(pair, { direction, source: "agree_3of4", tier: null, assetClass });
    }
  }

  return map;
}

function getTradeExposureDeltas(trade: Pick<PlannedTrade, "symbol" | "assetClass" | "direction">) {
  const sign = trade.direction === "LONG" ? 1 : -1;
  if (trade.assetClass === "fx" && trade.symbol.length >= 6) {
    const base = trade.symbol.slice(0, 3);
    const quote = trade.symbol.slice(3, 6);
    return [
      { key: `fx:${base}`, delta: sign },
      { key: `fx:${quote}`, delta: -sign },
    ];
  }
  return [{ key: `asset:${trade.assetClass}`, delta: sign }];
}

function wouldBreachNetExposureCap(deltas: Array<{ key: string; delta: number }>, net: Map<string, number>) {
  return deltas.some(({ key, delta }) => Math.abs((net.get(key) ?? 0) + delta) > EXPOSURE_CAP_LIMIT);
}

function applyExposureCap(trades: PlannedTrade[]) {
  const net = new Map<string, number>();
  const kept: PlannedTrade[] = [];
  const skipped: DiagnosticTrade[] = [];
  for (const trade of trades) {
    const deltas = getTradeExposureDeltas(trade);
    if (wouldBreachNetExposureCap(deltas, net)) {
      skipped.push({ symbol: trade.symbol, returnPct: trade.returnPct, reason: "exposure_cap" });
      continue;
    }
    kept.push(trade);
    for (const { key, delta } of deltas) net.set(key, (net.get(key) ?? 0) + delta);
  }
  return { kept, skipped };
}

function normalizeTradeReturn(
  returnPct: number,
  adrMap: Map<string, number>,
  symbol: string,
  assetClass: string,
) {
  const pairAdr = getAdrPct(adrMap, symbol, assetClass);
  return returnPct * (getTargetAdrPct() / pairAdr);
}

async function buildPlannedTrades(strategy: StrategyId, weekOpenUtc: string) {
  const [directions, pairReturns, adrMap] = await Promise.all([
    resolveDirections(strategy, weekOpenUtc),
    getWeeklyPairReturns(weekOpenUtc),
    loadWeeklyAdrMap(weekOpenUtc),
  ]);
  const returnMap = new Map(pairReturns.map((row) => [row.symbol.toUpperCase(), row]));
  const trades: PlannedTrade[] = [];
  for (const [key, signal] of directions) {
    const pair = pairFromDirectionKey(key);
    const priceData = returnMap.get(pair);
    if (!priceData) continue;
    const directedRaw = signal.direction === "SHORT" ? -priceData.returnPct : priceData.returnPct;
    trades.push({
      symbol: pair,
      assetClass: priceData.assetClass ?? signal.assetClass,
      direction: signal.direction,
      openPrice: priceData.openPrice,
      closePrice: priceData.closePrice,
      rawWeeklyReturnPct: directedRaw,
      returnPct: normalizeTradeReturn(directedRaw, adrMap, pair, priceData.assetClass ?? signal.assetClass),
      source: signal.source,
      tier: signal.tier,
    });
  }
  return trades;
}

function findCotSnapshotIndex(assetHistory: { weeks: Array<{ weekOpenMs: number }> }, weekOpenUtc: string) {
  const targetMs = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toMillis();
  if (!Number.isFinite(targetMs)) return -1;
  let snapshotIndex = -1;
  for (let index = 0; index < assetHistory.weeks.length; index += 1) {
    if (assetHistory.weeks[index]!.weekOpenMs <= targetMs) snapshotIndex = index;
    else break;
  }
  return snapshotIndex;
}

function buildComponentExtreme(options: {
  assetHistory: any;
  assetClass: AssetClass;
  marketId: string | null;
  tradeDirection: Direction;
  snapshotIndex: number;
  minHistoryWeeks: number;
}) {
  const { assetHistory, assetClass, marketId, tradeDirection, snapshotIndex, minHistoryWeeks } = options;
  if (!marketId || snapshotIndex < 0 || snapshotIndex + 1 < minHistoryWeeks) return null;
  const weeksSlice = assetHistory.weeks.slice(0, snapshotIndex + 1);
  const series = weeksSlice
    .map((row: any) => resolveCotMarketNet(row.snapshot, assetClass, marketId))
    .filter((value: number | null): value is number => value !== null);
  if (series.length < minHistoryWeeks) return null;
  const currentNet = series[series.length - 1]!;
  const priorNet = series.length > 1 ? series[series.length - 2]! : null;
  return {
    marketId,
    percentile: directionalPercentile(series, currentNet, tradeDirection),
    tradeDirection,
    currentNet,
    priorNet,
  };
}

function getCotExtreme(
  trade: Pick<PlannedTrade, "symbol" | "assetClass" | "direction">,
  weekOpenUtc: string,
  context: CotGateContext,
): CotExtreme | null {
  if (trade.assetClass === "crypto") return null;
  const assetClass = trade.assetClass as AssetClass;
  if (assetClass !== "fx" && assetClass !== "indices" && assetClass !== "commodities") return null;
  const { canonicalPair } = normalizeCotPairAlias(trade.symbol);
  const meta = (context as any).pairMeta.get(canonicalPair);
  if (!meta) return null;
  const assetHistory = (context as any).byAssetClass.get(meta.assetClass);
  if (!assetHistory) return null;
  const snapshotIndex = findCotSnapshotIndex(assetHistory, weekOpenUtc);
  const baseDirection = trade.direction;
  const quoteDirection: Direction = trade.direction === "LONG" ? "SHORT" : "LONG";
  const baseMarketId = resolveCotMarketId(meta.assetClass, meta.base);
  const quoteMarketId = resolveCotMarketId(meta.assetClass, meta.quote);
  const components = [
    buildComponentExtreme({
      assetHistory,
      assetClass: meta.assetClass,
      marketId: baseMarketId,
      tradeDirection: baseDirection,
      snapshotIndex,
      minHistoryWeeks: context.minHistoryWeeks,
    }),
    buildComponentExtreme({
      assetHistory,
      assetClass: meta.assetClass,
      marketId: quoteMarketId,
      tradeDirection: quoteDirection,
      snapshotIndex,
      minHistoryWeeks: context.minHistoryWeeks,
    }),
  ].filter((component): component is NonNullable<typeof component> => component !== null);
  if (components.length === 0) return null;
  return {
    maxPercentile: Math.max(...components.map((component) => component.percentile)),
    extremeComponents: components,
  };
}

function isBuildingInTradeDirection(component: CotExtreme["extremeComponents"][number]) {
  if (component.priorNet === null) return true;
  if (component.tradeDirection === "LONG") return component.currentNet > component.priorNet;
  return component.currentNet < component.priorNet;
}

function gateAction(variant: VariantId, trade: PlannedTrade, weekOpenUtc: string, context: CotGateContext): GateAction {
  if (variant.startsWith("baseline:")) return "TRADE";
  const extreme = getCotExtreme(trade, weekOpenUtc, context);
  if (!extreme) return "TRADE";
  if (variant === "cot_skip_90") return extreme.maxPercentile >= 90 ? "SKIP" : "TRADE";
  if (variant === "cot_skip_85") return extreme.maxPercentile >= 85 ? "SKIP" : "TRADE";
  if (variant === "cot_flip_95") {
    if (extreme.maxPercentile >= 95) return "FLIP";
    if (extreme.maxPercentile >= 90) return "SKIP";
    return "TRADE";
  }
  if (variant === "cot_flip_90") return extreme.maxPercentile >= 90 ? "FLIP" : "TRADE";
  if (variant === "hybrid_cap_skip_90") return extreme.maxPercentile >= 90 ? "SKIP" : "TRADE";
  if (variant === "hybrid_cap_flip_95") {
    if (extreme.maxPercentile >= 95) return "FLIP";
    if (extreme.maxPercentile >= 90) return "SKIP";
    return "TRADE";
  }
  if (variant === "delta_gate") {
    const extremeComponents = extreme.extremeComponents.filter((component) => component.percentile >= 85);
    if (extremeComponents.length === 0) return "TRADE";
    return extremeComponents.some((component) => !isBuildingInTradeDirection(component)) ? "FLIP" : "TRADE";
  }
  return "TRADE";
}

function applyVariantToWeeklyHold(
  weekOpenUtc: string,
  variant: VariantId,
  plannedTrades: PlannedTrade[],
  context: CotGateContext,
): WeekVariantResult {
  const capFirst = variant === "baseline:cap" || variant.startsWith("hybrid_cap_");
  const capResult = capFirst ? applyExposureCap(plannedTrades) : { kept: plannedTrades, skipped: [] };
  const trades: PlannedTrade[] = [];
  const skipped = [...capResult.skipped];
  const flipped: DiagnosticFlip[] = [];
  let unchanged = 0;

  for (const trade of capResult.kept) {
    const action = gateAction(variant, trade, weekOpenUtc, context);
    if (action === "SKIP") {
      skipped.push({ symbol: trade.symbol, returnPct: trade.returnPct, reason: "cot_gate" });
    } else if (action === "FLIP") {
      const flippedTrade = { ...trade, direction: trade.direction === "LONG" ? "SHORT" as Direction : "LONG" as Direction, returnPct: -trade.returnPct };
      trades.push(flippedTrade);
      flipped.push({ symbol: trade.symbol, originalReturnPct: trade.returnPct, flippedReturnPct: flippedTrade.returnPct });
    } else {
      trades.push(trade);
      unchanged += 1;
    }
  }

  return {
    weekOpenUtc,
    returnPct: trades.reduce((sum, trade) => sum + trade.returnPct, 0),
    trades,
    skipped,
    flipped,
    unchanged,
    fallbackTrades: 0,
    fallbackReturnPct: 0,
    fallbackSymbols: [],
  };
}

function directedRawReturnPct(direction: Direction, entryPrice: number, exitPrice: number) {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(exitPrice) || exitPrice <= 0) return 0;
  const rawReturn = ((exitPrice - entryPrice) / entryPrice) * 100;
  return direction === "SHORT" ? -rawReturn : rawReturn;
}

function simulateAdrTpTrade(
  trade: PlannedTrade,
  bars: CanonicalPriceBar[],
  adrPct: number,
): { returnPct: number; rawReturnPct: number; exitPrice: number; fallback: boolean } {
  if (bars.length === 0) {
    return {
      returnPct: trade.returnPct,
      rawReturnPct: trade.rawWeeklyReturnPct,
      exitPrice: trade.closePrice,
      fallback: true,
    };
  }
  const targetMove = (ADR_TP_MULTIPLE * adrPct) / 100;
  const tpPrice = trade.direction === "SHORT"
    ? trade.openPrice * (1 - targetMove)
    : trade.openPrice * (1 + targetMove);
  for (const bar of bars) {
    const hit = trade.direction === "SHORT"
      ? bar.lowPrice <= tpPrice
      : bar.highPrice >= tpPrice;
    if (!hit) continue;
    const rawReturnPct = directedRawReturnPct(trade.direction, trade.openPrice, tpPrice);
    return {
      rawReturnPct,
      returnPct: rawReturnPct * (getTargetAdrPct() / adrPct),
      exitPrice: tpPrice,
      fallback: false,
    };
  }
  const rawReturnPct = directedRawReturnPct(trade.direction, trade.openPrice, trade.closePrice);
  return {
    rawReturnPct,
    returnPct: rawReturnPct * (getTargetAdrPct() / adrPct),
    exitPrice: trade.closePrice,
    fallback: false,
  };
}

async function applyVariantToAdrTp(
  weekOpenUtc: string,
  variant: VariantId,
  plannedTrades: PlannedTrade[],
  context: CotGateContext,
): Promise<WeekVariantResult> {
  const capFirst = variant === "baseline:cap" || variant.startsWith("hybrid_cap_");
  const capResult = capFirst ? applyExposureCap(plannedTrades) : { kept: plannedTrades, skipped: [] };
  const symbols = Array.from(new Set(capResult.kept.map((trade) => trade.symbol))).sort();
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const weekCloseUtc = (weekOpen.isValid ? weekOpen.plus({ weeks: 1 }).toUTC().toISO() : null) ?? weekOpenUtc;
  const [barsBySymbol, adrMap] = await Promise.all([
    loadPathBars(symbols, weekOpenUtc, weekCloseUtc, "1h"),
    loadWeeklyAdrMap(weekOpenUtc),
  ]);

  const trades: PlannedTrade[] = [];
  const skipped = [...capResult.skipped];
  const flipped: DiagnosticFlip[] = [];
  let unchanged = 0;
  let fallbackTrades = 0;
  let fallbackReturnPct = 0;
  const fallbackSymbols = new Set<string>();

  for (const baseTrade of capResult.kept) {
    const action = gateAction(variant, baseTrade, weekOpenUtc, context);
    if (action === "SKIP") {
      skipped.push({ symbol: baseTrade.symbol, returnPct: baseTrade.returnPct, reason: "cot_gate" });
      continue;
    }
    const effectiveTrade: PlannedTrade = action === "FLIP"
      ? { ...baseTrade, direction: baseTrade.direction === "LONG" ? "SHORT" : "LONG" }
      : baseTrade;
    const adrPct = getAdrPct(adrMap, effectiveTrade.symbol, effectiveTrade.assetClass);
    const simulated = simulateAdrTpTrade(effectiveTrade, barsBySymbol.get(effectiveTrade.symbol) ?? [], adrPct);
    const finalTrade = {
      ...effectiveTrade,
      closePrice: simulated.exitPrice,
      rawWeeklyReturnPct: simulated.rawReturnPct,
      returnPct: simulated.returnPct,
    };
    trades.push(finalTrade);
    if (simulated.fallback) {
      fallbackTrades += 1;
      fallbackReturnPct += finalTrade.returnPct;
      fallbackSymbols.add(finalTrade.symbol);
    }
    if (action === "FLIP") {
      flipped.push({ symbol: baseTrade.symbol, originalReturnPct: baseTrade.returnPct, flippedReturnPct: finalTrade.returnPct });
    } else {
      unchanged += 1;
    }
  }

  return {
    weekOpenUtc,
    returnPct: trades.reduce((sum, trade) => sum + trade.returnPct, 0),
    trades,
    skipped,
    flipped,
    unchanged,
    fallbackTrades,
    fallbackReturnPct,
    fallbackSymbols: Array.from(fallbackSymbols).sort(),
  };
}

function computeSharpe(weeklyReturns: number[]) {
  if (weeklyReturns.length <= 1) return 0;
  const avg = weeklyReturns.reduce((sum, value) => sum + value, 0) / weeklyReturns.length;
  const variance = weeklyReturns.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (weeklyReturns.length - 1);
  const std = Math.sqrt(variance);
  return std > 0 ? avg / std : 0;
}

function aggregateResults(strategy: StrategyId, variant: VariantId, weeks: WeekVariantResult[]): AggregateStats {
  const weeklyReturns = weeks.map((week) => week.returnPct);
  const returnPct = weeklyReturns.reduce((sum, value) => sum + value, 0);
  const maxDrawdownPct = computeMaxDrawdownFromPercentReturns(weeklyReturns);
  const trades = weeks.reduce((sum, week) => sum + week.trades.length, 0);
  const weeklyWins = weeklyReturns.filter((value) => value > 0).length;
  const skipped = weeks.flatMap((week) => week.skipped);
  const flipped = weeks.flatMap((week) => week.flipped);
  return {
    strategy,
    variant,
    returnPct,
    maxDrawdownPct,
    trades,
    winRatePct: weeklyReturns.length > 0 ? (weeklyWins / weeklyReturns.length) * 100 : 0,
    rdd: maxDrawdownPct > 0 ? returnPct / maxDrawdownPct : null,
    sharpe: computeSharpe(weeklyReturns),
    weeklyReturns,
    skippedCount: skipped.length,
    skippedRawReturnPct: skipped.reduce((sum, trade) => sum + trade.returnPct, 0),
    flippedCount: flipped.length,
    flippedOriginalReturnPct: flipped.reduce((sum, trade) => sum + trade.originalReturnPct, 0),
    flippedReturnPct: flipped.reduce((sum, trade) => sum + trade.flippedReturnPct, 0),
    unchangedCount: weeks.reduce((sum, week) => sum + week.unchanged, 0),
    fallbackTrades: weeks.reduce((sum, week) => sum + week.fallbackTrades, 0),
    fallbackReturnPct: weeks.reduce((sum, week) => sum + week.fallbackReturnPct, 0),
    fallbackSymbols: Array.from(new Set(weeks.flatMap((week) => week.fallbackSymbols))).sort(),
  };
}

function formatNumber(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function formatPct(value: number | null, signed = false) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${signed && value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatVs(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function percentChange(value: number | null, baseline: number | null) {
  if (value === null || baseline === null || !Number.isFinite(value) || !Number.isFinite(baseline) || baseline === 0) return null;
  return ((value - baseline) / Math.abs(baseline)) * 100;
}

function table(headers: string[], rows: string[][]) {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index]?.length ?? 0)),
  );
  const render = (row: string[]) => row.map((cell, index) => cell.padEnd(widths[index]!)).join("  ");
  console.log(render(headers));
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  for (const row of rows) console.log(render(row));
  console.log("");
}

async function phase0Parity(weeks: string[], planned: Map<string, PlannedTrade[]>) {
  console.log("Phase 0: baseline parity");
  const weeklyHoldEntry = getEntryStyle("weekly_hold");
  const exposureCap = getStrengthGate("exposure_cap");
  const rows: string[][] = [];
  let failed = false;

  for (const strategy of STRATEGIES) {
    const config = getStrategy(strategy);
    if (!config) throw new Error(`Strategy config missing for ${strategy}`);
    const appNone = await computeMultiWeekHold(config, weeks, weeklyHoldEntry, undefined);
    const appCap = await computeMultiWeekHold(config, weeks, weeklyHoldEntry, exposureCap);
    const scriptNone = aggregateResults(strategy, "baseline:none", weeks.map((week) =>
      applyVariantToWeeklyHold(week, "baseline:none", planned.get(`${strategy}:${week}`) ?? [], {} as CotGateContext)));
    const scriptCap = aggregateResults(strategy, "baseline:cap", weeks.map((week) =>
      applyVariantToWeeklyHold(week, "baseline:cap", planned.get(`${strategy}:${week}`) ?? [], {} as CotGateContext)));
    const comparisons: Array<[VariantId, MultiWeekResult, AggregateStats]> = [
      ["baseline:none", appNone, scriptNone],
      ["baseline:cap", appCap, scriptCap],
    ];
    for (const [variant, app, script] of comparisons) {
      const returnGap = Math.abs(app.totalReturnPct - script.returnPct);
      const ddGap = Math.abs(app.maxDrawdownPct - script.maxDrawdownPct);
      const tradeGap = Math.abs(app.totalTrades - script.trades);
      const ok = returnGap <= PARITY_TOLERANCE_RETURN && ddGap <= PARITY_TOLERANCE_DD && tradeGap === 0;
      failed = failed || !ok;
      rows.push([
        strategy,
        variant,
        formatPct(app.totalReturnPct, true),
        formatPct(script.returnPct, true),
        formatPct(returnGap),
        formatPct(app.maxDrawdownPct),
        formatPct(script.maxDrawdownPct),
        formatPct(ddGap),
        String(app.totalTrades),
        String(script.trades),
        ok ? "PASS" : "FAIL",
      ]);
    }
  }

  table(["Strategy", "Variant", "App Ret", "Script Ret", "Ret Gap", "App DD", "Script DD", "DD Gap", "App Tr", "Script Tr", "Status"], rows);
  if (failed) throw new Error("Phase 0 parity failed. Stop before evaluating COT variants.");
}

async function main() {
  const currentDisplayWeekOpenUtc = getDisplayWeekOpenUtc();
  const currentDisplayMs = DateTime.fromISO(currentDisplayWeekOpenUtc, { zone: "utc" }).toMillis();
  const weeks = (await listDataSectionWeeks())
    .filter((weekOpenUtc) => {
      const weekMs = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toMillis();
      return Number.isFinite(weekMs) && Number.isFinite(currentDisplayMs)
        ? weekMs < currentDisplayMs
        : weekOpenUtc !== currentDisplayWeekOpenUtc;
    })
    .slice(0, 17)
    .reverse();
  console.log("COT extremes gate research");
  console.log(`Weeks: ${weeks[0]} -> ${weeks[weeks.length - 1]} (${weeks.length})`);
  console.log("Lineup:", STRATEGIES.join(", "));
  console.log("");

  const cotContext = await buildCotGateContext({ minHistoryWeeks: 10 });
  const planned = new Map<string, PlannedTrade[]>();
  for (const strategy of STRATEGIES) {
    for (const week of weeks) {
      planned.set(`${strategy}:${week}`, await buildPlannedTrades(strategy, week));
    }
  }

  await phase0Parity(weeks, planned);

  console.log("Phase 1: Weekly Hold COT variants");
  const weeklyHoldStats: AggregateStats[] = [];
  for (const strategy of STRATEGIES) {
    for (const variant of VARIANTS) {
      const weekResults = weeks.map((week) =>
        applyVariantToWeeklyHold(week, variant, planned.get(`${strategy}:${week}`) ?? [], cotContext));
      weeklyHoldStats.push(aggregateResults(strategy, variant, weekResults));
    }
  }

  const baselineNoneByStrategy = new Map(
    weeklyHoldStats
      .filter((row) => row.variant === "baseline:none")
      .map((row) => [row.strategy, row]),
  );
  const baselineCapByStrategy = new Map(
    weeklyHoldStats
      .filter((row) => row.variant === "baseline:cap")
      .map((row) => [row.strategy, row]),
  );

  for (const strategy of STRATEGIES) {
    const rows = weeklyHoldStats
      .filter((row) => row.strategy === strategy)
      .sort((left, right) => (right.rdd ?? -Infinity) - (left.rdd ?? -Infinity))
      .map((row) => [
        row.strategy,
        row.variant,
        formatPct(row.returnPct, true),
        formatPct(row.maxDrawdownPct),
        String(row.trades),
        formatPct(row.winRatePct),
        formatNumber(row.rdd),
        formatNumber(row.sharpe),
        formatVs(percentChange(row.rdd, baselineNoneByStrategy.get(row.strategy)?.rdd ?? null)),
        formatVs(percentChange(row.rdd, baselineCapByStrategy.get(row.strategy)?.rdd ?? null)),
      ]);
    table(["Strategy", "Variant", "Return", "DD", "Trades", "WinRate", "R/DD", "Sharpe", "vs_none", "vs_cap"], rows);
  }

  console.log("Table 2: Winners");
  table(
    ["Strategy", "Best R/DD", "R/DD", "Best Sharpe", "Sharpe"],
    STRATEGIES.map((strategy) => {
      const rows = weeklyHoldStats.filter((row) => row.strategy === strategy);
      const bestRdd = rows.reduce((best, row) => (row.rdd ?? -Infinity) > (best.rdd ?? -Infinity) ? row : best, rows[0]!);
      const bestSharpe = rows.reduce((best, row) => row.sharpe > best.sharpe ? row : best, rows[0]!);
      return [strategy, bestRdd.variant, formatNumber(bestRdd.rdd), bestSharpe.variant, formatNumber(bestSharpe.sharpe)];
    }),
  );

  console.log("Table 3: Weekly Hold Gate Diagnostics");
  table(
    ["Strategy", "Variant", "Skipped", "Skipped Ret", "Flipped", "Original Ret", "Flipped Ret", "Unchanged"],
    weeklyHoldStats
      .filter((row) => COT_VARIANTS.includes(row.variant))
      .map((row) => [
        row.strategy,
        row.variant,
        String(row.skippedCount),
        formatPct(row.skippedRawReturnPct, true),
        String(row.flippedCount),
        formatPct(row.flippedOriginalReturnPct, true),
        formatPct(row.flippedReturnPct, true),
        String(row.unchangedCount),
      ]),
  );

  console.log("Phase 1B: Weekly Signal + ADR TP");
  const adrTpStats: AggregateStats[] = [];
  for (const strategy of STRATEGIES) {
    for (const variant of VARIANTS) {
      const weekResults: WeekVariantResult[] = [];
      for (const week of weeks) {
        weekResults.push(await applyVariantToAdrTp(week, variant, planned.get(`${strategy}:${week}`) ?? [], cotContext));
      }
      adrTpStats.push(aggregateResults(strategy, variant, weekResults));
    }
  }

  const adrBaselineNoneByStrategy = new Map(
    adrTpStats
      .filter((row) => row.variant === "baseline:none")
      .map((row) => [row.strategy, row]),
  );

  console.log("Table 4: Phase 1B Results");
  table(
    ["Strategy", "Variant", "WH Return", "WH R/DD", "ADR TP Return", "ADR TP DD", "ADR TP R/DD", "ADR TP Sharpe", "Fallback", "Improved?"],
    adrTpStats.map((adrRow) => {
      const whRow = weeklyHoldStats.find((row) => row.strategy === adrRow.strategy && row.variant === adrRow.variant)!;
      const whBase = baselineNoneByStrategy.get(adrRow.strategy);
      const adrBase = adrBaselineNoneByStrategy.get(adrRow.strategy);
      const improved = adrRow.variant.startsWith("baseline:")
        ? "—"
        : (whRow.rdd ?? -Infinity) > (whBase?.rdd ?? Infinity) && (adrRow.rdd ?? -Infinity) > (adrBase?.rdd ?? Infinity)
          ? "YES"
          : "NO";
      return [
        adrRow.strategy,
        adrRow.variant,
        formatPct(whRow.returnPct, true),
        formatNumber(whRow.rdd),
        formatPct(adrRow.returnPct, true),
        formatPct(adrRow.maxDrawdownPct),
        formatNumber(adrRow.rdd),
        formatNumber(adrRow.sharpe),
        `${adrRow.fallbackTrades} / ${formatPct(adrRow.fallbackReturnPct, true)}`,
        improved,
      ];
    }),
  );

  console.log("Table 5: Execution Quality");
  table(
    ["Strategy", "Weekly Hold Return", "ADR TP Return", "Lift", "Weekly Hold DD", "ADR TP DD", "DD Change"],
    STRATEGIES.map((strategy) => {
      const wh = baselineNoneByStrategy.get(strategy)!;
      const adr = adrBaselineNoneByStrategy.get(strategy)!;
      return [
        strategy,
        formatPct(wh.returnPct, true),
        formatPct(adr.returnPct, true),
        formatPct(adr.returnPct - wh.returnPct, true),
        formatPct(wh.maxDrawdownPct),
        formatPct(adr.maxDrawdownPct),
        formatPct(adr.maxDrawdownPct - wh.maxDrawdownPct, true),
      ];
    }),
  );

  console.log("Table 6: Cross-Phase Verdict");
  table(
    ["Strategy", "Variant", "WH R/DD", "WH vs_none", "ADR TP R/DD", "ADR vs_none", "Fallback", "Verdict"],
    adrTpStats
      .filter((row) => COT_VARIANTS.includes(row.variant))
      .map((adrRow) => {
        const whRow = weeklyHoldStats.find((row) => row.strategy === adrRow.strategy && row.variant === adrRow.variant)!;
        const whBase = baselineNoneByStrategy.get(adrRow.strategy)!;
        const adrBase = adrBaselineNoneByStrategy.get(adrRow.strategy)!;
        const whBetter = (whRow.rdd ?? -Infinity) > (whBase.rdd ?? Infinity);
        const adrBetter = (adrRow.rdd ?? -Infinity) > (adrBase.rdd ?? Infinity);
        const lowFallback = adrRow.fallbackTrades === 0;
        return [
          adrRow.strategy,
          adrRow.variant,
          formatNumber(whRow.rdd),
          formatVs(percentChange(whRow.rdd, whBase.rdd)),
          formatNumber(adrRow.rdd),
          formatVs(percentChange(adrRow.rdd, adrBase.rdd)),
          String(adrRow.fallbackTrades),
          whBetter && adrBetter && lowFallback ? "ADVANCE" : "FAIL",
        ];
      }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
