/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: weeklyHoldEngine.ts
 *
 * Description:
 * Unified strategy engine for Performance and Matrix sections.
 * Routes to the correct executor based on the intraday filter's plModel:
 *   - "weekly_hold" → reads pair_period_returns (open→close P&L)
 *   - "adr"         → reads strategy_backtest_trades (0.25% TP, week close)
 *   - future models → add executor function + register in EXECUTORS map
 *
 * Data sources:
 *   - pair_period_returns: weekly open/close/return per pair
 *   - strategy_backtest_trades: intraday trade-level P&L (ADR, stoch, etc.)
 *   - cot_snapshots: dealer/commercial direction per pair per week
 *   - sentiment_aggregates: retail sentiment direction per pair per week
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { query } from "@/lib/db";
import { DateTime } from "luxon";
import { getCanonicalWeeklyPairReturns, getExecutionWeeklyPairReturns } from "@/lib/pairReturns";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import { getExecutionWeekWindow } from "@/lib/executionPriceWindows";
import type { AssetClass } from "@/lib/cotMarkets";
import { getCanonicalBasketWeek, filterByModel, nonNeutralSignals, type CanonicalBasketSignal } from "@/lib/performance/basketSource";
import type { BiasSourceConfig, EntryStyleConfig, RiskOverlayConfig } from "@/lib/performance/strategyConfig";
import {
  resolveSelectorFragilityDirections,
} from "@/lib/performance/selectorEngine";
import {
  SELECTOR_STRATEGY_ID,
  SELECTOR_FRAG3_STRATEGY_ID,
  SELECTOR_SELECTIVE_STRATEGY_ID,
  AGREE_3PLUS_STRATEGY_ID,
} from "@/lib/performance/strategyConfig";
import { readCanonicalStrengthDirections } from "@/lib/strength/canonicalDirection";
import { loadWeeklyAdrMap, getAdrPct, getTargetAdrPct } from "@/lib/performance/adrLookup";
import { loadPathBars } from "@/lib/performance/pathBarLoader";
import type { CanonicalPriceBar } from "@/lib/canonicalPriceBars";
import { computeMaxDrawdownFromPercentReturns } from "@/lib/performance/drawdown";

// ─── Trade types (strategy-generic) ─────────────────────────────
// "WeeklyHoldTrade" name kept for backward compat; represents any strategy trade.

export type TradeDetail = {
  tradeNumber: number;
  entryTimeUtc: string | null;
  exitTimeUtc: string | null;
  exitReason: string | null;
  anchorPrice: number | null;
  tpPrice: number | null;
  adrPct: number | null;
  maePct: number | null;
  gridPathDrawdownRawPct?: number | null;
  capActiveFillsAtEntry?: number | null;
  capThresholdAtEntry?: number | null;
  capViolated?: boolean;
  ambiguityFlags?: string[];
};

export type WeeklyHoldTrade = {
  symbol: string;
  assetClass: string;
  direction: "LONG" | "SHORT";
  openPrice: number;
  closePrice: number;
  /**
   * Current display return. For existing Performance UI behavior this remains
   * ADR-normalized after computeWeeklyHold() returns.
   */
  returnPct: number;
  /** Direction-adjusted return before ADR normalization. */
  rawReturnPct?: number;
  /** Direction-adjusted return after ADR normalization. */
  normalizedReturnPct?: number;
  /** Explicit display value selected by projection code. Currently normalized. */
  displayReturnPct?: number;
  /** Pair ADR percent used for normalization. */
  adrPct?: number;
  /** targetADR / pairADR. */
  adrMultiplier?: number;
  /** Return mode represented by returnPct/displayReturnPct. */
  returnMode?: "raw" | "normalized";
  /** The model that generated this signal (dealer/commercial/sentiment/etc.) */
  source: string;
  /** Tier (1=high, 2=medium, 3=low) or null */
  tier: number | null;
  /** Intraday trade detail (present for ADR/stoch trades, absent for weekly hold) */
  detail?: TradeDetail;
  /** Position weight for scaled/generated intraday systems. Defaults to 1. */
  weight?: number;
};
/** @alias WeeklyHoldTrade — use this name in new code */
export type StrategyTrade = WeeklyHoldTrade;

/** Canonical per-pair signal emitted by the engine for board display.
 *  For tandem strategies, signals are collapsed to one per pair via majority rule. */
export type CanonicalSignal = {
  symbol: string;
  assetClass: string;
  direction: "LONG" | "SHORT";
  source: string;
  tier: number | null;
};

export type WeeklyHoldResult = {
  weekOpenUtc: string;
  executionWindowOpenUtc?: string;
  executionWindowCloseUtc?: string;
  biasSourceId: string;
  trades: WeeklyHoldTrade[];
  /** Current display total. For existing UI behavior this remains normalized. */
  totalReturnPct: number;
  rawTotalReturnPct?: number;
  normalizedTotalReturnPct?: number;
  displayTotalReturnPct?: number;
  returnMode?: "raw" | "normalized";
  winCount: number;
  lossCount: number;
  winRate: number;
  tradeCount: number;
  /**
   * Display-only planned units. ADR Grid uses this for canonical grid baskets;
   * returns/P&L still come from `trades`, which are realized/active fills.
   */
  plannedTrades?: WeeklyHoldTrade[];
  displayUnit?: "trades" | "grids";
  /** Canonical pair-level signals for this week's strategy selection.
   *  Used by Matrix for coreBias, tier display, and copy buttons. */
  signals: CanonicalSignal[];
  /** Whether this week should count toward realized aggregate stats. */
  isRealized: boolean;
  /** Directional signals that could not become trades because price data was missing. */
  missingPriceSymbols?: string[];
};
/** @alias WeeklyHoldResult — use this name in new code */
export type StrategyWeekResult = WeeklyHoldResult;

export type MultiWeekResult = {
  biasSourceId: string;
  weeks: WeeklyHoldResult[];
  totalReturnPct: number;
  totalTrades: number;
  totalWins: number;
  winRate: number;
  maxDrawdownPct: number;
  /** Per asset class breakdown */
  byAssetClass: Record<string, { returnPct: number; trades: number; wins: number }>;
};

// ─── Asset class inference from symbol ──────────────────────────

const CRYPTO_SYMBOLS = new Set(["BTCUSD", "ETHUSD", "BTCUSDT", "ETHUSDT", "SOLUSD", "SOLUSDT", "XRPUSD", "XRPUSDT", "DOGUSD", "DOGUSDT", "ADAUSD", "ADAUSDT", "AVAUSD", "AVAUSDT", "LINKUSD", "DOTUSDT"]);
const INDEX_SYMBOLS = new Set(["SPXUSD", "SPX500", "SPX500USD", "NDXUSD", "NDX100", "NAS100USD", "NIKKEIUSD", "JPN225", "JPN225USD", "UKXUSD", "UK100", "DEUUSD", "DE30", "DE40"]);
const COMMODITY_SYMBOLS = new Set(["XAUUSD", "XAGUSD", "WTIUSD", "BCOUSD", "NGUSD"]);
const MULTI_WEEK_COMPUTE_CONCURRENCY = Number(
  process.env.MULTI_WEEK_COMPUTE_CONCURRENCY ?? "3",
);

function inferAssetClass(symbol: string): AssetClass {
  const upper = symbol.toUpperCase().replace(/[/.]/g, "");
  if (CRYPTO_SYMBOLS.has(upper)) return "crypto";
  if (INDEX_SYMBOLS.has(upper)) return "indices";
  if (COMMODITY_SYMBOLS.has(upper)) return "commodities";
  return "fx";
}

function normalizeAssetClass(value: string | null | undefined): AssetClass {
  return value === "indices" || value === "commodities" || value === "crypto" || value === "fx"
    ? value
    : "fx";
}

function getExecutionBoundaryIso(weekOpenUtc: string, assetClass: AssetClass) {
  const window = getExecutionWeekWindow(weekOpenUtc, assetClass);
  return {
    windowOpenUtc: window.windowOpenUtc.toUTC().toISO() ?? weekOpenUtc,
    entryCutoffUtc: window.entryCutoffUtc.toUTC().toISO() ?? weekOpenUtc,
    windowCloseUtc: window.windowCloseUtc.toUTC().toISO() ?? weekOpenUtc,
  };
}

function mergeExecutionBoundaries(
  weekOpenUtc: string,
  assetClasses: Iterable<string | null | undefined>,
): { executionWindowOpenUtc: string; executionWindowCloseUtc: string } {
  let minOpenMs = Number.POSITIVE_INFINITY;
  let maxCloseMs = Number.NEGATIVE_INFINITY;
  let executionWindowOpenUtc = weekOpenUtc;
  let executionWindowCloseUtc = weekOpenUtc;

  for (const assetClassValue of assetClasses) {
    const { windowOpenUtc, windowCloseUtc } = getExecutionBoundaryIso(
      weekOpenUtc,
      normalizeAssetClass(assetClassValue),
    );
    const openMs = Date.parse(windowOpenUtc);
    const closeMs = Date.parse(windowCloseUtc);
    if (Number.isFinite(openMs) && openMs < minOpenMs) {
      minOpenMs = openMs;
      executionWindowOpenUtc = windowOpenUtc;
    }
    if (Number.isFinite(closeMs) && closeMs > maxCloseMs) {
      maxCloseMs = closeMs;
      executionWindowCloseUtc = windowCloseUtc;
    }
  }

  if (!Number.isFinite(minOpenMs) || !Number.isFinite(maxCloseMs)) {
    const fallback = getExecutionBoundaryIso(weekOpenUtc, "fx");
    return {
      executionWindowOpenUtc: fallback.windowOpenUtc,
      executionWindowCloseUtc: fallback.windowCloseUtc,
    };
  }

  return { executionWindowOpenUtc, executionWindowCloseUtc };
}

function getMultiWeekComputeConcurrency() {
  if (
    Number.isFinite(MULTI_WEEK_COMPUTE_CONCURRENCY) &&
    MULTI_WEEK_COMPUTE_CONCURRENCY > 0
  ) {
    return Math.max(1, Math.min(6, Math.floor(MULTI_WEEK_COMPUTE_CONCURRENCY)));
  }
  return 3;
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function finiteOrUndefined(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getTradePairAdrPct(
  trade: WeeklyHoldTrade,
  adrMap: Map<string, number>,
): number {
  if (isPositiveFinite(trade.adrPct)) return trade.adrPct;
  const detailAdrPct = trade.detail?.adrPct;
  if (isPositiveFinite(detailAdrPct)) return detailAdrPct;
  return getAdrPct(adrMap, trade.symbol, trade.assetClass);
}

export function normalizeTradeReturnForAdr(
  trade: WeeklyHoldTrade,
  pairAdrPct: number,
  targetAdrPct = getTargetAdrPct(),
): WeeklyHoldTrade {
  const safePairAdrPct = isPositiveFinite(pairAdrPct) ? pairAdrPct : targetAdrPct;
  const adrMultiplier = safePairAdrPct > 0 ? targetAdrPct / safePairAdrPct : 1;
  const rawReturnPct = finiteOrUndefined(trade.rawReturnPct) ?? trade.returnPct;
  const normalizedReturnPct = rawReturnPct * adrMultiplier;
  const detail = trade.detail;
  const detailAdrPct = detail?.adrPct;

  return {
    ...trade,
    rawReturnPct,
    normalizedReturnPct,
    displayReturnPct: normalizedReturnPct,
    returnPct: normalizedReturnPct,
    adrPct: safePairAdrPct,
    adrMultiplier,
    returnMode: "normalized",
    detail: detail
      ? {
        ...detail,
        adrPct: isPositiveFinite(detailAdrPct) ? detailAdrPct : safePairAdrPct,
      }
      : detail,
  };
}

async function applyAdrNormalization(
  result: WeeklyHoldResult,
): Promise<WeeklyHoldResult> {
  const targetAdr = getTargetAdrPct();
  const needsAdrLookup = result.trades.some((trade) => {
    return !isPositiveFinite(trade.adrPct) && !isPositiveFinite(trade.detail?.adrPct);
  });
  const adrMap = needsAdrLookup ? await loadWeeklyAdrMap(result.weekOpenUtc) : new Map();

  const normalizedTrades = result.trades.map((trade) => {
    const pairAdr = getTradePairAdrPct(trade, adrMap);
    return normalizeTradeReturnForAdr(trade, pairAdr, targetAdr);
  });

  const rawTotalReturn = normalizedTrades.reduce((s, t) => s + (t.rawReturnPct ?? t.returnPct), 0);
  const normalizedTotalReturn = normalizedTrades.reduce((s, t) => s + (t.normalizedReturnPct ?? t.returnPct), 0);
  const wins = normalizedTrades.filter((t) => t.returnPct > 0).length;
  const losses = normalizedTrades.filter((t) => t.returnPct < 0).length;

  return {
    ...result,
    trades: normalizedTrades,
    totalReturnPct: normalizedTotalReturn,
    rawTotalReturnPct: rawTotalReturn,
    normalizedTotalReturnPct: normalizedTotalReturn,
    displayTotalReturnPct: normalizedTotalReturn,
    returnMode: "normalized",
    winCount: wins,
    lossCount: losses,
    winRate: normalizedTrades.length > 0 ? (wins / normalizedTrades.length) * 100 : 0,
  };
}

// ─── Direction resolvers — compose from canonical basketSource ──
//
// Layer A: basketSource provides canonical dealer/commercial/sentiment signals
// Layer B: this function composes derived strategies (tiered_4w, agreement, tandem)
//
// The engine NEVER independently rebuilds base-model directions from raw snapshots.

type DirectionEntry = { direction: "LONG" | "SHORT"; source: string; tier: number | null; assetClass: string };
type DirectionMap = Map<string, DirectionEntry>;

type TradeDirection = "LONG" | "SHORT";
type WeightedTierPack = {
  dealer: number;
  commercial: number;
  sentiment: number;
  strength: number;
};

const TIERED_4W_WEIGHTS: WeightedTierPack = {
  dealer: 2.0,
  commercial: 0.75,
  sentiment: 1.25,
  strength: 1.5,
};

function signalsToDirectionMap(signals: CanonicalBasketSignal[], source: string): DirectionMap {
  const map: DirectionMap = new Map();
  for (const s of signals) {
    if (s.direction === "NEUTRAL") continue;
    map.set(s.symbol, { direction: s.direction, source, tier: null, assetClass: s.assetClass });
  }
  return map;
}

function classifyFourSourceTiePattern(votes: {
  dealer?: TradeDirection;
  commercial?: TradeDirection;
  sentiment?: TradeDirection;
  strength?: TradeDirection;
}): "DC_vs_SeSt" | "DSe_vs_CSt" | "DSt_vs_CSe" | null {
  const { dealer, commercial, sentiment, strength } = votes;
  if (!dealer || !commercial || !sentiment || !strength) return null;

  if (dealer === commercial && sentiment === strength && dealer !== sentiment) {
    return "DC_vs_SeSt";
  }
  if (dealer === sentiment && commercial === strength && dealer !== commercial) {
    return "DSe_vs_CSt";
  }
  if (dealer === strength && commercial === sentiment && dealer !== commercial) {
    return "DSt_vs_CSe";
  }
  return null;
}

function resolveAgree3of4Direction(votes: {
  dealer?: DirectionEntry;
  commercial?: DirectionEntry;
  sentiment?: DirectionEntry;
  strength?: DirectionEntry;
}): TradeDirection | null {
  const directions = [votes.dealer?.direction, votes.commercial?.direction, votes.sentiment?.direction, votes.strength?.direction]
    .filter(Boolean) as TradeDirection[];
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

  if (tiePattern === "DC_vs_SeSt") {
    return votes.sentiment?.direction ?? votes.strength?.direction ?? null;
  }
  return null;
}

function resolveStrictAgree3PlusDirection(votes: {
  dealer?: DirectionEntry;
  commercial?: DirectionEntry;
  sentiment?: DirectionEntry;
  strength?: DirectionEntry;
}): TradeDirection | null {
  const directions = [votes.dealer?.direction, votes.commercial?.direction, votes.sentiment?.direction, votes.strength?.direction]
    .filter(Boolean) as TradeDirection[];
  const longs = directions.filter((direction) => direction === "LONG").length;
  const shorts = directions.filter((direction) => direction === "SHORT").length;

  if (longs >= 3) return "LONG";
  if (shorts >= 3) return "SHORT";
  return null;
}

function computeWeightedScore(votes: {
  dealer?: DirectionEntry;
  commercial?: DirectionEntry;
  sentiment?: DirectionEntry;
  strength?: DirectionEntry;
}, weights: WeightedTierPack) {
  let score = 0;
  if (votes.dealer?.direction === "LONG") score += weights.dealer;
  else if (votes.dealer?.direction === "SHORT") score -= weights.dealer;

  if (votes.commercial?.direction === "LONG") score += weights.commercial;
  else if (votes.commercial?.direction === "SHORT") score -= weights.commercial;

  if (votes.sentiment?.direction === "LONG") score += weights.sentiment;
  else if (votes.sentiment?.direction === "SHORT") score -= weights.sentiment;

  if (votes.strength?.direction === "LONG") score += weights.strength;
  else if (votes.strength?.direction === "SHORT") score -= weights.strength;

  return score;
}

async function resolveDirections(
  biasSource: BiasSourceConfig,
  weekOpenUtc: string,
): Promise<DirectionMap> {
  // Layer A: read canonical basket truth (same source as Data section)
  const basketWeek = await getCanonicalBasketWeek(weekOpenUtc);

  // Base model maps (non-neutral signals only)
  const dealerSignals = nonNeutralSignals(filterByModel(basketWeek, "dealer"));
  const commercialSignals = nonNeutralSignals(filterByModel(basketWeek, "commercial"));
  const sentimentSignals = nonNeutralSignals(filterByModel(basketWeek, "sentiment"));

  // Layer B: compose strategy-specific direction map
  if (biasSource.id === "dealer") {
    return signalsToDirectionMap(dealerSignals, "dealer");
  }

  if (biasSource.id === "commercial") {
    return signalsToDirectionMap(commercialSignals, "commercial");
  }

  if (biasSource.id === "sentiment") {
    return signalsToDirectionMap(sentimentSignals, "sentiment");
  }

  if (biasSource.id === SELECTOR_FRAG3_STRATEGY_ID) {
    return resolveSelectorFragilityDirections(weekOpenUtc, "fragility_3");
  }

  if (biasSource.id === SELECTOR_SELECTIVE_STRATEGY_ID) {
    return resolveSelectorFragilityDirections(weekOpenUtc, "opposed_or_building_against");
  }

  if (biasSource.id === SELECTOR_STRATEGY_ID) {
    const [baseMap, selectiveMap] = await Promise.all([
      resolveSelectorFragilityDirections(weekOpenUtc, "fragility_3"),
      resolveSelectorFragilityDirections(weekOpenUtc, "opposed_or_building_against"),
    ]);
    const map: DirectionMap = new Map();
    for (const [pair, entry] of baseMap) {
      map.set(`${pair}:dealer`, { ...entry, source: "dealer" });
    }
    for (const [pair, entry] of selectiveMap) {
      map.set(`${pair}:commercial`, { ...entry, source: "commercial" });
    }
    return map;
  }

  if (biasSource.id === "strength") {
    const strengthRows = await readCanonicalStrengthDirections(weekOpenUtc);
    const map: DirectionMap = new Map();
    for (const row of strengthRows) {
      map.set(row.pair.toUpperCase(), {
        direction: row.direction,
        source: "strength",
        tier: null,
        assetClass: row.assetClass,
      });
    }
    return map;
  }

  // Build per-pair maps for composite strategies
  const dealerMap = signalsToDirectionMap(dealerSignals, "dealer");
  const commMap = signalsToDirectionMap(commercialSignals, "commercial");
  const sentMap = signalsToDirectionMap(sentimentSignals, "sentiment");
  let strengthMap: DirectionMap = new Map();
  const needsStrengthVotes =
    biasSource.id === "tiered_4w"
    || biasSource.id === "agree_3of4"
    || biasSource.id === AGREE_3PLUS_STRATEGY_ID
    || (biasSource.type === "tandem" && biasSource.models?.includes("strength"));

  if (needsStrengthVotes) {
    const strengthRows = await readCanonicalStrengthDirections(weekOpenUtc);
    strengthMap = new Map();
    for (const row of strengthRows) {
      strengthMap.set(row.pair.toUpperCase(), {
        direction: row.direction,
        source: "strength",
        tier: null,
        assetClass: row.assetClass,
      });
    }
  }

  const allPairs = new Set([...dealerMap.keys(), ...commMap.keys(), ...sentMap.keys(), ...strengthMap.keys()]);

  if (biasSource.id === "tiered_4w") {
    const map: DirectionMap = new Map();
    for (const pair of allPairs) {
      const de = dealerMap.get(pair);
      const ce = commMap.get(pair);
      const se = sentMap.get(pair);
      const st = strengthMap.get(pair);
      const ac = de?.assetClass ?? ce?.assetClass ?? se?.assetClass ?? st?.assetClass ?? inferAssetClass(pair);
      const score = computeWeightedScore(
        { dealer: de, commercial: ce, sentiment: se, strength: st },
        TIERED_4W_WEIGHTS,
      );
      const absScore = Math.abs(score);
      if (absScore >= 4.0) {
        map.set(pair, {
          direction: score > 0 ? "LONG" : "SHORT",
          source: "tiered_4w",
          tier: 1,
          assetClass: ac,
        });
      } else if (absScore >= 2.0) {
        map.set(pair, {
          direction: score > 0 ? "LONG" : "SHORT",
          source: "tiered_4w",
          tier: 2,
          assetClass: ac,
        });
      }
    }
    return map;
  }

  if (biasSource.id === "agree_3of4") {
    const map: DirectionMap = new Map();
    for (const pair of allPairs) {
      const de = dealerMap.get(pair);
      const ce = commMap.get(pair);
      const se = sentMap.get(pair);
      const st = strengthMap.get(pair);
      const ac = de?.assetClass ?? ce?.assetClass ?? se?.assetClass ?? st?.assetClass ?? inferAssetClass(pair);
      const direction = resolveAgree3of4Direction({
        dealer: de,
        commercial: ce,
        sentiment: se,
        strength: st,
      });
      if (direction) {
        map.set(pair, { direction, source: "agree_3of4", tier: null, assetClass: ac });
      }
    }
    return map;
  }

  if (biasSource.id === AGREE_3PLUS_STRATEGY_ID) {
    const map: DirectionMap = new Map();
    for (const pair of allPairs) {
      const de = dealerMap.get(pair);
      const ce = commMap.get(pair);
      const se = sentMap.get(pair);
      const st = strengthMap.get(pair);
      const ac = de?.assetClass ?? ce?.assetClass ?? se?.assetClass ?? st?.assetClass ?? inferAssetClass(pair);
      const direction = resolveStrictAgree3PlusDirection({
        dealer: de,
        commercial: ce,
        sentiment: se,
        strength: st,
      });
      if (direction) {
        map.set(pair, { direction, source: AGREE_3PLUS_STRATEGY_ID, tier: null, assetClass: ac });
      }
    }
    return map;
  }

  if (biasSource.type === "tandem" && biasSource.models) {
    const map: DirectionMap = new Map();
    const modelSignalMap: Partial<Record<string, DirectionMap>> = {
      dealer: dealerMap,
      commercial: commMap,
      sentiment: sentMap,
    };
    if (biasSource.models.includes("strength")) modelSignalMap.strength = strengthMap;

    for (const modelId of biasSource.models) {
      const sourceMap = modelSignalMap[modelId];
      if (!sourceMap) continue;
      for (const [pair, entry] of sourceMap) {
        map.set(`${pair}:${modelId}`, { ...entry, source: modelId });
      }
    }
    return map;
  }

  return new Map();
}

// ─── Canonical signals from direction map ────────────────────────
// Faithful to strategy truth: one signal per direction entry.
// For tandem, this means multiple rows per pair (one per model).
// For single-model strategies, naturally one row per pair.
// No collapsing — the board layer decides how to display.

function buildCanonicalSignals(directions: DirectionMap): CanonicalSignal[] {
  return Array.from(directions.entries()).map(([key, entry]) => ({
    // Tandem keys are "PAIR:model" — extract the pair name
    symbol: key.includes(":") ? key.split(":")[0]! : key,
    assetClass: entry.assetClass,
    direction: entry.direction,
    source: entry.source,
    tier: entry.tier,
  }));
}

function pairFromDirectionKey(key: string) {
  return (key.includes(":") ? key.split(":")[0]! : key).toUpperCase();
}

function logMissingWeeklyPrices(
  biasSourceId: string,
  weekOpenUtc: string,
  missingPriceSymbols: string[],
) {
  if (missingPriceSymbols.length === 0) return;
  console.warn(
    `[weeklyHoldEngine] Missing weekly price rows for ${biasSourceId} ${weekOpenUtc}: ${missingPriceSymbols.join(", ")}`,
  );
}

function isWeekRealizedForAggregate(
  weekOpenUtc: string,
  currentDisplayWeekOpenUtc: string,
): boolean {
  const weekMs = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toMillis();
  const currentDisplayMs = DateTime.fromISO(currentDisplayWeekOpenUtc, { zone: "utc" }).toMillis();
  if (!Number.isFinite(weekMs) || !Number.isFinite(currentDisplayMs)) {
    return weekOpenUtc !== currentDisplayWeekOpenUtc;
  }
  return weekMs < currentDisplayMs;
}

// ─── Tier string → number mapping ───────────────────────────────

const TIER_MAP: Record<string, number> = { HIGH: 1, MEDIUM: 2, LOW: 3 };

function parseTier(raw: unknown): number | null {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return TIER_MAP[raw.toUpperCase()] ?? null;
  return null;
}

// ─── ADR trade executor (reads from strategy_backtest_trades) ───

async function executeAdr(
  biasSource: BiasSourceConfig,
  weekOpenUtc: string,
  riskOverlay?: RiskOverlayConfig,
): Promise<WeeklyHoldResult> {
  const exposureCapEnabled = riskOverlay?.id === "exposure_cap";
  // Step 1: Get the bias source's direction signals for this week.
  // This determines WHICH trades to include — only trades where the
  // bias source agrees with the scanner's direction pass through.
  const directions = await resolveDirections(biasSource, weekOpenUtc);
  const signals = buildCanonicalSignals(directions);

  // Build approval lookup.
  // For non-tandem: symbol → Set of approved directions (simple filter).
  // For tandem: symbol → array of { direction, source } entries (one trade per approving model).
  const isTandem = biasSource.type === "tandem";
  const approvedDirections = new Map<string, Set<string>>();
  const tandemApprovals = new Map<string, Array<{ direction: string; source: string }>>();

  for (const [key, entry] of directions) {
    const pair = key.includes(":") ? key.split(":")[0]! : key;
    if (!approvedDirections.has(pair)) approvedDirections.set(pair, new Set());
    approvedDirections.get(pair)!.add(entry.direction);
    if (isTandem) {
      if (!tandemApprovals.has(pair)) tandemApprovals.set(pair, []);
      tandemApprovals.get(pair)!.push({ direction: entry.direction, source: entry.source });
    }
  }

  // Step 2: Query ADR trades from the scanner
  const runRows = await query<{ id: string }>(
    `SELECT id FROM strategy_backtest_runs
     WHERE bot_id = 'adr-forward' AND variant = 'fresh-start'
       AND market = 'multi-asset' AND config_key = 'default' LIMIT 1`,
    [],
  );
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const isPastWeek = weekOpenUtc !== currentWeekOpenUtc;
  const isRealized = isWeekRealizedForAggregate(weekOpenUtc, currentWeekOpenUtc);

  if (runRows.length === 0) {
    console.log("[engine] No ADR run found in strategy_backtest_runs");
    return {
      weekOpenUtc,
      biasSourceId: biasSource.id,
      trades: [],
      totalReturnPct: 0,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
      tradeCount: 0,
      signals,
      isRealized,
    };
  }
  const runId = Number(runRows[0]!.id);

  const tradeRows = await query<{
    symbol: string;
    direction: string;
    entry_price: string | null;
    exit_price: string | null;
    pnl_pct: string | null;
    exit_reason: string | null;
    entry_time_utc: string | null;
    exit_time_utc: string | null;
    metadata: Record<string, unknown> | null;
  }>(
    `SELECT symbol, direction, entry_price, exit_price, pnl_pct, exit_reason,
            to_char(entry_time_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS entry_time_utc,
            to_char(exit_time_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS exit_time_utc,
            metadata
     FROM strategy_backtest_trades
     WHERE run_id = $1 AND week_open_utc = $2::timestamptz
     ORDER BY entry_time_utc ASC NULLS LAST`,
    [runId, weekOpenUtc],
  );

  const closePrices = new Map<string, number>();
  if (isPastWeek) {
    const priceRows = await query<{ symbol: string; close_price: string }>(
      `SELECT symbol, close_price FROM pair_period_returns
       WHERE period_type = 'weekly' AND period_open_utc = $1::timestamptz`,
      [weekOpenUtc],
    );
    for (const r of priceRows) {
      closePrices.set(r.symbol.toUpperCase(), Number(r.close_price));
    }
  }

  // Step 3: Map trades, filtering by bias source direction
  const VALID_MODELS = new Set(["dealer", "commercial", "sentiment"]);
  const trades: WeeklyHoldTrade[] = [];
  let skippedByDirection = 0;

  for (const r of tradeRows) {
    // Direction filter: only include if bias source agrees
    const pairUpper = r.symbol.toUpperCase();
    const approved = approvedDirections.get(pairUpper) ?? approvedDirections.get(r.symbol);
    if (!approved || !approved.has(r.direction)) {
      skippedByDirection++;
      continue;
    }

    const entryPrice = r.entry_price ? Number(r.entry_price) : 0;
    let exitPrice = r.exit_price ? Number(r.exit_price) : entryPrice;
    let pnlPct = r.pnl_pct ? Number(r.pnl_pct) : 0;

    let resolvedExitReason = r.exit_reason;
    if (isPastWeek && r.exit_reason === "active" && entryPrice) {
      const weekClosePrice = closePrices.get(pairUpper);
      if (weekClosePrice) {
        exitPrice = weekClosePrice;
        const rawReturn = ((weekClosePrice - entryPrice) / entryPrice) * 100;
        pnlPct = r.direction === "SHORT" ? -rawReturn : rawReturn;
        resolvedExitReason = "week_close";
      }
    }
    // Current-week active trades should be visible in Matrix/Performance as open
    // positions, but they should not count unrealized P&L yet.
    if (!isPastWeek && r.exit_reason === "active") {
      pnlPct = 0;
      resolvedExitReason = "active";
    }

    const meta = r.metadata ?? {};
    const rawModel = (meta.model as string) ?? "";
    const fallbackSource = VALID_MODELS.has(rawModel) ? rawModel : "dealer";
    const assetClass = (meta.assetClass as string) ?? inferAssetClass(r.symbol);
    const tier = parseTier(meta.tier);
    const detail: TradeDetail = {
      tradeNumber: (meta.tradeNumber as number) ?? 1,
      entryTimeUtc: r.entry_time_utc,
      exitTimeUtc: r.exit_time_utc,
      exitReason: resolvedExitReason,
      anchorPrice: (meta.anchorPrice as number) ?? null,
      tpPrice: (meta.tpPrice as number) ?? null,
      adrPct: (meta.adrPct as number) ?? null,
      maePct: (meta.maePct as number) ?? null,
    };

    if (isTandem) {
      // Tandem: emit one trade per approving model (same as weekly hold tandem)
      const approvals = (tandemApprovals.get(pairUpper) ?? tandemApprovals.get(r.symbol) ?? [])
        .filter((a) => a.direction === r.direction);
      for (const approval of approvals) {
        trades.push({
          symbol: r.symbol, assetClass, direction: r.direction as "LONG" | "SHORT",
          openPrice: entryPrice, closePrice: exitPrice, returnPct: pnlPct,
          source: approval.source, tier, detail,
        });
      }
    } else {
      trades.push({
        symbol: r.symbol, assetClass, direction: r.direction as "LONG" | "SHORT",
        openPrice: entryPrice, closePrice: exitPrice, returnPct: pnlPct,
        source: fallbackSource, tier, detail,
      });
    }
  }

  const cappedTrades = exposureCapEnabled ? applyExposureCapToPlannedTrades(trades) : trades;
  const totalReturn = cappedTrades.reduce((s, t) => s + t.returnPct, 0);
  const wins = cappedTrades.filter((t) => t.returnPct > 0).length;
  const losses = cappedTrades.filter((t) => t.returnPct < 0).length;

  console.log(`[engine] ADR executor (${biasSource.id}): ${weekOpenUtc} → ${cappedTrades.length} trades (${skippedByDirection} filtered out), ${totalReturn.toFixed(2)}% return`);

  return {
    weekOpenUtc,
    biasSourceId: biasSource.id,
    trades: cappedTrades,
    totalReturnPct: totalReturn,
    winCount: wins,
    lossCount: losses,
    winRate: cappedTrades.length > 0 ? (wins / cappedTrades.length) * 100 : 0,
    tradeCount: cappedTrades.length,
    signals,
    isRealized,
  };
}

// ─── ADR Grid executor (canonical weekly anchor, 0.20 ADR close/rearm) ──────

const ADR_GRID_SPACING = 0.20;
const ADR_GRID_RESET_ADR = 1.0;
const ADR_GRID_ENTRY_RESET_BUFFER_ADR = 0.20;
const ADR_GRID_MAX_LEVELS_PER_SIDE = 50;
const EXPOSURE_CAP_LIMIT = 1.5;
const PAIR_FILL_CAP_LIMIT = 3;

type AdrGridTemplate = {
  symbol: string;
  assetClass: AssetClass;
  direction: "LONG" | "SHORT";
  source: string;
  tier: number | null;
  openPrice: number;
  pairAdrPct: number;
  weightMultiplier: number;
  executionWindowOpenUtc: string;
  executionEntryCutoffUtc: string;
  executionWindowCloseUtc: string;
};

type AdrGridLevel = {
  index: number;
  side: "favorable" | "continuation";
  triggerPrice: number;
  weight: number;
};

type AdrGridFill = {
  levelIndex: number;
  entryPrice: number;
  tpPrice: number;
  entryTimeUtc: string;
  entryBarIndex: number;
  weight: number;
  active: boolean;
  maxAdverseRawPct: number;
  activeFillsAtEntry: number | null;
  capThresholdAtEntry: number | null;
  capViolated: boolean;
};

type AdrGridEngine = AdrGridTemplate & {
  levels: AdrGridLevel[];
  fills: AdrGridFill[];
  levelArmed: boolean[];
  levelRearmBarIndex: number[];
  levelRequiresRetouch: boolean[];
  cycleHighPrice: number;
  cycleLowPrice: number;
  maxBasketAdverseRawPct: number;
  closedForWeek: boolean;
  entriesStoppedForWeek: boolean;
  entryCutoffGridIndex: number;
  closeGridIndex: number;
};

type AdrGridTimeline = {
  exactBars: Array<CanonicalPriceBar | null>;
  markBars: Array<CanonicalPriceBar | null>;
};

function buildAdrGridTimestamps(weekOpenUtc: string, weekCloseUtc: string) {
  const start = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const end = DateTime.fromISO(weekCloseUtc, { zone: "utc" });
  if (!start.isValid || !end.isValid || end < start) return [weekOpenUtc];

  const grid: string[] = [];
  let cursor = start.startOf("hour");
  const final = end.startOf("hour");
  while (cursor <= final) {
    grid.push(cursor.toUTC().toISO() ?? weekOpenUtc);
    cursor = cursor.plus({ hours: 1 });
  }
  return grid;
}

function normalizeIso(value: string) {
  const parsed = DateTime.fromISO(value, { zone: "utc" });
  return parsed.isValid ? parsed.toUTC().toISO() ?? value : value;
}

function buildAdrGridLevels(template: AdrGridTemplate): AdrGridLevel[] {
  const levels: AdrGridLevel[] = [];
  const step = (ADR_GRID_SPACING * template.pairAdrPct) / 100;
  const weight = ADR_GRID_SPACING * template.weightMultiplier;
  let index = 0;

  for (let i = 1; i <= ADR_GRID_MAX_LEVELS_PER_SIDE; i += 1) {
    levels.push({
      index: index++,
      side: "favorable",
      triggerPrice: template.direction === "LONG"
        ? template.openPrice * (1 - i * step)
        : template.openPrice * (1 + i * step),
      weight,
    });
  }
  for (let i = 1; i <= ADR_GRID_MAX_LEVELS_PER_SIDE; i += 1) {
    levels.push({
      index: index++,
      side: "continuation",
      triggerPrice: template.direction === "LONG"
        ? template.openPrice * (1 + i * step)
        : template.openPrice * (1 - i * step),
      weight,
    });
  }
  return levels;
}

function buildAdrGridEngine(template: AdrGridTemplate): AdrGridEngine {
  const levels = buildAdrGridLevels(template);
  return {
    ...template,
    levels,
    fills: [],
    levelArmed: levels.map(() => true),
    levelRearmBarIndex: levels.map(() => -1),
    levelRequiresRetouch: levels.map(() => false),
    cycleHighPrice: template.openPrice,
    cycleLowPrice: template.openPrice,
    maxBasketAdverseRawPct: 0,
    closedForWeek: false,
    entriesStoppedForWeek: false,
    entryCutoffGridIndex: -1,
    closeGridIndex: -1,
  };
}

function buildAdrGridPlannedTrade(template: AdrGridTemplate, tradeNumber: number): WeeklyHoldTrade {
  return {
    symbol: template.symbol,
    assetClass: template.assetClass,
    direction: template.direction,
    openPrice: template.openPrice,
    closePrice: template.openPrice,
    returnPct: 0,
    rawReturnPct: 0,
    normalizedReturnPct: 0,
    displayReturnPct: 0,
    source: template.source,
    tier: template.tier,
    weight: template.weightMultiplier,
    adrPct: template.pairAdrPct,
    returnMode: "raw",
    detail: {
      tradeNumber,
      entryTimeUtc: template.executionWindowOpenUtc,
      exitTimeUtc: null,
      exitReason: "grid_planned",
      anchorPrice: template.openPrice,
      tpPrice: null,
      adrPct: template.pairAdrPct,
      maePct: null,
      gridPathDrawdownRawPct: null,
      capActiveFillsAtEntry: null,
      capThresholdAtEntry: null,
      capViolated: false,
    },
  };
}

function directedRawReturnPct(direction: "LONG" | "SHORT", entryPrice: number, exitPrice: number) {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(exitPrice) || exitPrice <= 0) return 0;
  const rawReturn = ((exitPrice - entryPrice) / entryPrice) * 100;
  return direction === "SHORT" ? -rawReturn : rawReturn;
}

function adrGridAdverseRawPct(direction: "LONG" | "SHORT", entryPrice: number, bar: CanonicalPriceBar) {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return 0;
  return direction === "SHORT"
    ? Math.max(0, ((bar.highPrice - entryPrice) / entryPrice) * 100)
    : Math.max(0, ((entryPrice - bar.lowPrice) / entryPrice) * 100);
}

function getAdrGridResetTarget(engine: AdrGridEngine) {
  const resetMove = (ADR_GRID_RESET_ADR * engine.pairAdrPct) / 100;
  return engine.direction === "SHORT"
    ? engine.cycleHighPrice * (1 - resetMove)
    : engine.cycleLowPrice * (1 + resetMove);
}

function getAdrGridFillTp(engine: AdrGridEngine, entryPrice: number) {
  const targetMove = (ADR_GRID_SPACING * engine.pairAdrPct) / 100;
  return engine.direction === "SHORT"
    ? entryPrice * (1 - targetMove)
    : entryPrice * (1 + targetMove);
}

function adrGridPriceHit(direction: "LONG" | "SHORT", bar: CanonicalPriceBar, price: number) {
  return direction === "SHORT"
    ? bar.lowPrice <= price
    : bar.highPrice >= price;
}

function adrGridResetExitForFill(
  engine: AdrGridEngine,
  fill: AdrGridFill,
  bar: CanonicalPriceBar,
  resetTarget: number,
) {
  const tpHit = adrGridPriceHit(engine.direction, bar, fill.tpPrice);
  const resetReturn = directedRawReturnPct(engine.direction, fill.entryPrice, resetTarget);
  const tpReturn = directedRawReturnPct(engine.direction, fill.entryPrice, fill.tpPrice);

  if (tpHit && resetReturn >= tpReturn - 1e-9) {
    return {
      exitPrice: fill.tpPrice,
      exitReason: "grid_tp",
      ambiguityFlags: ["reset_bar_tp_precedes_reset"],
    };
  }

  return {
    exitPrice: resetTarget,
    exitReason: "grid_reset",
    ambiguityFlags: tpHit ? ["ambiguous_1h_tp_reset"] : [],
  };
}

function isAdrGridEntryTooCloseToReset(engine: AdrGridEngine, entryPrice: number) {
  if (process.env.LIMNI_ADR_GRID_RESET_ENTRY_FILTER === "off") return false;

  const resetTarget = getAdrGridResetTarget(engine);
  const bufferMove = (ADR_GRID_ENTRY_RESET_BUFFER_ADR * engine.pairAdrPct) / 100;
  const bufferDistance = entryPrice * bufferMove;
  const resetDistance = engine.direction === "SHORT"
    ? entryPrice - resetTarget
    : resetTarget - entryPrice;

  return resetDistance <= 0 || resetDistance < bufferDistance * 0.999;
}

function activeAdrGridExposure(engine: AdrGridEngine) {
  return engine.fills.reduce((sum, fill) => sum + (fill.active ? fill.weight : 0), 0);
}

function activePairFillCount(engine: AdrGridEngine) {
  return engine.fills.filter((fill) => fill.active).length;
}

function getAdrGridMark(engine: AdrGridEngine, timelines: Map<string, AdrGridTimeline>, barIndex: number) {
  return timelines.get(engine.symbol)?.markBars[barIndex]?.closePrice ?? engine.openPrice;
}

function getExposureDeltas(engine: AdrGridEngine, exposure: number) {
  const sign = engine.direction === "LONG" ? 1 : -1;
  if (engine.assetClass === "fx" && engine.symbol.length >= 6) {
    const base = engine.symbol.slice(0, 3);
    const quote = engine.symbol.slice(3, 6);
    return [
      { key: `fx:${base}`, delta: sign * exposure },
      { key: `fx:${quote}`, delta: -sign * exposure },
    ];
  }
  return [{ key: `asset:${engine.assetClass}`, delta: sign * exposure }];
}

function getTradeExposureDeltas(trade: Pick<WeeklyHoldTrade, "assetClass" | "direction" | "symbol" | "weight">) {
  const sign = trade.direction === "LONG" ? 1 : -1;
  const exposure = trade.weight ?? 1;
  if (trade.assetClass === "fx" && trade.symbol.length >= 6) {
    const base = trade.symbol.slice(0, 3);
    const quote = trade.symbol.slice(3, 6);
    return [
      { key: `fx:${base}`, delta: sign * exposure },
      { key: `fx:${quote}`, delta: -sign * exposure },
    ];
  }
  return [{ key: `asset:${trade.assetClass}`, delta: sign * exposure }];
}

function wouldBreachNetExposureCap(
  deltas: Array<{ key: string; delta: number }>,
  net: Map<string, number>,
) {
  return deltas.some(({ key, delta }) =>
    Math.abs((net.get(key) ?? 0) + delta) > EXPOSURE_CAP_LIMIT,
  );
}

function applyExposureCapToPlannedTrades(trades: WeeklyHoldTrade[]) {
  const net = new Map<string, number>();
  const kept: WeeklyHoldTrade[] = [];
  for (const trade of trades) {
    const deltas = getTradeExposureDeltas(trade);
    if (wouldBreachNetExposureCap(deltas, net)) continue;
    kept.push(trade);
    for (const { key, delta } of deltas) {
      net.set(key, (net.get(key) ?? 0) + delta);
    }
  }
  return kept;
}

function applyExposureCapToAdditionalTrades(
  existingTrades: WeeklyHoldTrade[],
  candidateTrades: WeeklyHoldTrade[],
) {
  const net = new Map<string, number>();
  for (const trade of existingTrades) {
    for (const { key, delta } of getTradeExposureDeltas(trade)) {
      net.set(key, (net.get(key) ?? 0) + delta);
    }
  }

  const kept: WeeklyHoldTrade[] = [];
  for (const trade of candidateTrades) {
    const deltas = getTradeExposureDeltas(trade);
    if (wouldBreachNetExposureCap(deltas, net)) continue;
    kept.push(trade);
    for (const { key, delta } of deltas) {
      net.set(key, (net.get(key) ?? 0) + delta);
    }
  }
  return kept;
}

function getActiveExposureNet(engines: AdrGridEngine[]) {
  const net = new Map<string, number>();
  for (const engine of engines) {
    const exposure = activeAdrGridExposure(engine);
    if (exposure <= 1e-9) continue;
    for (const { key, delta } of getExposureDeltas(engine, exposure)) {
      net.set(key, (net.get(key) ?? 0) + delta);
    }
  }
  return net;
}

function wouldBreachExposureCap(engine: AdrGridEngine, fillWeight: number, engines: AdrGridEngine[]) {
  const net = getActiveExposureNet(engines);
  return wouldBreachNetExposureCap(getExposureDeltas(engine, fillWeight), net);
}

function wouldBreachPairFillCap(engine: AdrGridEngine) {
  return activePairFillCount(engine) >= PAIR_FILL_CAP_LIMIT;
}

function closeAdrGridFill(params: {
  trades: WeeklyHoldTrade[];
  engine: AdrGridEngine;
  fill: AdrGridFill;
  exitPrice: number;
  exitTimeUtc: string;
  exitReason: string;
  tradeNumber: number;
  ambiguityFlags?: string[];
}) {
  const { trades, engine, fill, exitPrice, exitTimeUtc, exitReason, tradeNumber, ambiguityFlags } = params;
  const rawReturnPct = directedRawReturnPct(engine.direction, fill.entryPrice, exitPrice) * engine.weightMultiplier;
  fill.active = false;
  trades.push({
    symbol: engine.symbol,
    assetClass: engine.assetClass,
    direction: engine.direction,
    openPrice: fill.entryPrice,
    closePrice: exitPrice,
    returnPct: rawReturnPct,
    rawReturnPct,
    source: engine.source,
    tier: engine.tier,
    weight: engine.weightMultiplier,
    detail: {
      tradeNumber,
      entryTimeUtc: fill.entryTimeUtc,
      exitTimeUtc,
      exitReason,
      anchorPrice: engine.openPrice,
      tpPrice: fill.tpPrice,
      adrPct: engine.pairAdrPct,
      maePct: fill.maxAdverseRawPct,
      gridPathDrawdownRawPct: engine.maxBasketAdverseRawPct,
      capActiveFillsAtEntry: fill.activeFillsAtEntry,
      capThresholdAtEntry: fill.capThresholdAtEntry,
      capViolated: fill.capViolated,
      ambiguityFlags,
    },
  });
}

function timelineHasExactBars(timeline: AdrGridTimeline | undefined) {
  return Boolean(timeline?.exactBars.some((bar) => bar !== null));
}

function lastElapsedGridTimestamp(grid: string[], fallback: string) {
  const nowMs = Date.now();
  for (let index = grid.length - 1; index >= 0; index -= 1) {
    const tsUtc = grid[index];
    if (!tsUtc) continue;
    const tsMs = Date.parse(tsUtc);
    if (Number.isFinite(tsMs) && tsMs <= nowMs) return tsUtc;
  }
  return fallback;
}

function findGridIndexAtOrBefore(grid: string[], timestampUtc: string) {
  const targetMs = Date.parse(timestampUtc);
  if (!Number.isFinite(targetMs)) return Math.max(0, grid.length - 1);
  for (let index = grid.length - 1; index >= 0; index -= 1) {
    const tsMs = Date.parse(grid[index] ?? "");
    if (Number.isFinite(tsMs) && tsMs <= targetMs) {
      return index;
    }
  }
  return 0;
}

function effectiveWindowCloseIso(windowCloseUtc: string, isRealized: boolean) {
  if (isRealized) return windowCloseUtc;
  const close = DateTime.fromISO(windowCloseUtc, { zone: "utc" });
  const now = DateTime.utc();
  if (!close.isValid) return now.toUTC().toISO() ?? windowCloseUtc;
  return DateTime.min(close, now).startOf("hour").toUTC().toISO() ?? windowCloseUtc;
}

function buildLiveReturnFallbackTrade(params: {
  template: AdrGridTemplate;
  priceData: { closePrice: number; returnPct: number };
  exitTimeUtc: string;
  tradeNumber: number;
}): WeeklyHoldTrade {
  const { template, priceData, exitTimeUtc, tradeNumber } = params;
  const directedReturn = template.direction === "SHORT"
    ? -priceData.returnPct
    : priceData.returnPct;
  return {
    symbol: template.symbol,
    assetClass: template.assetClass,
    direction: template.direction,
    openPrice: template.openPrice,
    closePrice: priceData.closePrice,
    returnPct: directedReturn,
    source: template.source,
    tier: template.tier,
    detail: {
      tradeNumber,
      entryTimeUtc: template.executionWindowOpenUtc,
      exitTimeUtc,
      exitReason: "live_return_fallback",
      anchorPrice: template.openPrice,
      tpPrice: null,
      adrPct: template.pairAdrPct,
      maePct: null,
    },
  };
}

async function executeAdrGrid(
  biasSource: BiasSourceConfig,
  weekOpenUtc: string,
  riskOverlay?: RiskOverlayConfig,
): Promise<WeeklyHoldResult> {
  const exposureCapEnabled = riskOverlay?.id === "exposure_cap";
  const pairFillCapEnabled = riskOverlay?.id === "pair_fill_cap";
  const directions = await resolveDirections(biasSource, weekOpenUtc);
  const signals = buildCanonicalSignals(directions);
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const isRealized = isWeekRealizedForAggregate(weekOpenUtc, currentWeekOpenUtc);
  const [canonicalPairReturns, executionPairReturns] = await Promise.all([
    getCanonicalWeeklyPairReturns(weekOpenUtc),
    getExecutionWeeklyPairReturns(weekOpenUtc),
  ]);
  const canonicalReturnMap = new Map(canonicalPairReturns.map((row) => [row.symbol.toUpperCase(), row]));
  const executionReturnMap = new Map(executionPairReturns.map((row) => [row.symbol.toUpperCase(), row]));
  const adrMap = await loadWeeklyAdrMap(weekOpenUtc);

  const templates: AdrGridTemplate[] = [];
  const missingPriceSymbolSet = new Set<string>();
  for (const [key, signal] of directions) {
    const pair = pairFromDirectionKey(key);
    const priceData = canonicalReturnMap.get(pair);
    if (!priceData || !Number.isFinite(priceData.openPrice) || priceData.openPrice <= 0) {
      missingPriceSymbolSet.add(pair);
      continue;
    }
    const assetClass = normalizeAssetClass(priceData.assetClass ?? signal.assetClass ?? inferAssetClass(pair));
    const executionBoundary = getExecutionBoundaryIso(weekOpenUtc, assetClass);
    templates.push({
      symbol: pair,
      assetClass,
      direction: signal.direction,
      source: signal.source,
      tier: signal.tier,
      openPrice: priceData.openPrice,
      pairAdrPct: getAdrPct(adrMap, pair, assetClass),
      weightMultiplier: 1,
      executionWindowOpenUtc: executionBoundary.windowOpenUtc,
      executionEntryCutoffUtc: executionBoundary.entryCutoffUtc,
      executionWindowCloseUtc: executionBoundary.windowCloseUtc,
    });
  }
  const plannedGridTrades = templates.map((template, index) =>
    buildAdrGridPlannedTrade(template, index + 1),
  );

  const resultBoundaries = mergeExecutionBoundaries(
    weekOpenUtc,
    templates.length > 0 ? templates.map((template) => template.assetClass) : ["fx"],
  );
  const effectiveResultCloseUtc = effectiveWindowCloseIso(resultBoundaries.executionWindowCloseUtc, isRealized);
  const symbols = Array.from(new Set(templates.map((template) => template.symbol))).sort();
  const bars = await loadPathBars(symbols, resultBoundaries.executionWindowOpenUtc, effectiveResultCloseUtc, "1h");
  const grid = buildAdrGridTimestamps(resultBoundaries.executionWindowOpenUtc, effectiveResultCloseUtc);
  const timelines = new Map<string, AdrGridTimeline>();
  for (const symbol of symbols) {
    const symbolBars = bars.get(symbol) ?? [];
    const byClose = new Map(symbolBars.map((bar) => [normalizeIso(bar.barCloseUtc), bar]));
    const exactBars: Array<CanonicalPriceBar | null> = [];
    const markBars: Array<CanonicalPriceBar | null> = [];
    let last: CanonicalPriceBar | null = null;
    for (const tsUtc of grid) {
      const exact = byClose.get(normalizeIso(tsUtc)) ?? null;
      if (exact) last = exact;
      exactBars.push(exact);
      markBars.push(last);
    }
    timelines.set(symbol, { exactBars, markBars });
  }

  const engines = templates.map((template) => {
    const engine = buildAdrGridEngine(template);
    engine.entryCutoffGridIndex = findGridIndexAtOrBefore(grid, template.executionEntryCutoffUtc);
    const engineCloseUtc = effectiveWindowCloseIso(template.executionWindowCloseUtc, isRealized);
    engine.closeGridIndex = findGridIndexAtOrBefore(grid, engineCloseUtc);
    return engine;
  });
  const trades: WeeklyHoldTrade[] = [];
  let tradeNumber = 1;

  for (let barIndex = 0; barIndex < grid.length; barIndex += 1) {
    const tsUtc = grid[barIndex] ?? resultBoundaries.executionWindowOpenUtc;
    for (const engine of engines) {
      const bar = timelines.get(engine.symbol)?.exactBars[barIndex] ?? null;
      if (engine.closedForWeek || barIndex > engine.closeGridIndex) continue;

      if (bar) {
        engine.cycleHighPrice = Math.max(engine.cycleHighPrice, bar.highPrice);
        engine.cycleLowPrice = Math.min(engine.cycleLowPrice, bar.lowPrice);

        for (const fill of engine.fills) {
          if (!fill.active) continue;
          fill.maxAdverseRawPct = Math.max(
            fill.maxAdverseRawPct,
            adrGridAdverseRawPct(engine.direction, fill.entryPrice, bar),
          );
        }
        const preCloseBasketAdverseRawPct = engine.fills.reduce((sum, fill) => (
          fill.active ? sum + fill.maxAdverseRawPct : sum
        ), 0);
        engine.maxBasketAdverseRawPct = Math.max(engine.maxBasketAdverseRawPct, preCloseBasketAdverseRawPct);

        const resetTarget = getAdrGridResetTarget(engine);
        const resetHit = adrGridPriceHit(engine.direction, bar, resetTarget);
        if (resetHit) {
          for (const fill of engine.fills) {
            if (!fill.active) continue;
            const resetExit = adrGridResetExitForFill(engine, fill, bar, resetTarget);
            closeAdrGridFill({
              trades,
              engine,
              fill,
              exitPrice: resetExit.exitPrice,
              exitTimeUtc: tsUtc,
              exitReason: resetExit.exitReason,
              tradeNumber: tradeNumber++,
              ambiguityFlags: resetExit.ambiguityFlags,
            });
          }
          engine.entriesStoppedForWeek = true;
          engine.closedForWeek = true;
          continue;
        }

        for (const fill of engine.fills) {
          if (!fill.active) continue;
          const targetPrice = fill.tpPrice;
          const targetHit = adrGridPriceHit(engine.direction, bar, targetPrice);
          if (!targetHit) continue;

          closeAdrGridFill({
            trades,
            engine,
            fill,
            exitPrice: targetPrice,
            exitTimeUtc: tsUtc,
            exitReason: "grid_tp",
            tradeNumber: tradeNumber++,
          });
          engine.levelArmed[fill.levelIndex] = true;
          engine.levelRearmBarIndex[fill.levelIndex] = barIndex;
          engine.levelRequiresRetouch[fill.levelIndex] = true;
        }
        const postCloseBasketAdverseRawPct = engine.fills.reduce((sum, fill) => (
          fill.active ? sum + fill.maxAdverseRawPct : sum
        ), 0);
        engine.maxBasketAdverseRawPct = Math.max(engine.maxBasketAdverseRawPct, postCloseBasketAdverseRawPct);

        if (barIndex < engine.entryCutoffGridIndex && !engine.entriesStoppedForWeek) {
          for (const level of engine.levels) {
            if (!engine.levelArmed[level.index]) continue;
            if (engine.levelRearmBarIndex[level.index]! >= barIndex) continue;
            const initialTriggered = level.side === "favorable"
              ? (engine.direction === "LONG" ? bar.lowPrice <= level.triggerPrice : bar.highPrice >= level.triggerPrice)
              : (engine.direction === "LONG" ? bar.highPrice >= level.triggerPrice : bar.lowPrice <= level.triggerPrice);
            const retouchTriggered = engine.direction === "LONG"
              ? bar.lowPrice <= level.triggerPrice
              : bar.highPrice >= level.triggerPrice;
            const triggered = engine.levelRequiresRetouch[level.index]
              ? retouchTriggered
              : initialTriggered;
            if (!triggered) continue;
            if (isAdrGridEntryTooCloseToReset(engine, level.triggerPrice)) continue;
            if (exposureCapEnabled && wouldBreachExposureCap(engine, level.weight, engines)) continue;
            if (pairFillCapEnabled && wouldBreachPairFillCap(engine)) continue;
            const activeFillsBeforeEntry = activePairFillCount(engine);
            const tpPrice = getAdrGridFillTp(engine, level.triggerPrice);

            engine.fills.push({
              levelIndex: level.index,
              entryPrice: level.triggerPrice,
              tpPrice,
              entryTimeUtc: tsUtc,
              entryBarIndex: barIndex,
              weight: level.weight,
              active: true,
              maxAdverseRawPct: 0,
              activeFillsAtEntry: pairFillCapEnabled ? activeFillsBeforeEntry + 1 : null,
              capThresholdAtEntry: pairFillCapEnabled ? PAIR_FILL_CAP_LIMIT : null,
              capViolated: pairFillCapEnabled ? activeFillsBeforeEntry + 1 > PAIR_FILL_CAP_LIMIT : false,
            });
            engine.levelArmed[level.index] = false;
            engine.levelRequiresRetouch[level.index] = false;
          }
        }

      }

      if (barIndex === engine.closeGridIndex && !engine.closedForWeek) {
        for (const fill of engine.fills) {
          if (!fill.active) continue;
          const exitReason = isRealized ? "week_close" : "active";
          const exitPrice = isRealized ? getAdrGridMark(engine, timelines, barIndex) : fill.entryPrice;
          closeAdrGridFill({
            trades,
            engine,
            fill,
            exitPrice,
            exitTimeUtc: tsUtc,
            exitReason,
            tradeNumber: tradeNumber++,
          });
        }
      }
    }
  }

  // Unrealized current week with no grid fills: fall back to weekly hold-style
  // directional signals with live pair returns so the UI always shows data.
  if (!isRealized && templates.length > 0) {
    const fallbackTrades: WeeklyHoldTrade[] = [];
    const exitTimeUtc = lastElapsedGridTimestamp(grid, weekOpenUtc);
    const symbolsWithGridTrades = new Set(trades.map((trade) => trade.symbol));
    for (const template of templates) {
      const shouldFallback =
        trades.length === 0 ||
        (
          template.assetClass !== "fx" &&
          !symbolsWithGridTrades.has(template.symbol) &&
          !timelineHasExactBars(timelines.get(template.symbol))
        );
      if (!shouldFallback) continue;
      const priceData = executionReturnMap.get(template.symbol);
      if (!priceData) continue;
      fallbackTrades.push(buildLiveReturnFallbackTrade({
        template,
        priceData,
        exitTimeUtc,
        tradeNumber: tradeNumber++,
      }));
    }
    const capped = exposureCapEnabled
      ? trades.length === 0
        ? applyExposureCapToPlannedTrades(fallbackTrades)
        : applyExposureCapToAdditionalTrades(trades, fallbackTrades)
      : fallbackTrades;
    trades.push(...capped);
  }

  const totalReturn = trades.reduce((sum, trade) => sum + trade.returnPct, 0);
  const wins = trades.filter((trade) => trade.returnPct > 0).length;
  const losses = trades.filter((trade) => trade.returnPct < 0).length;
  const missingPriceSymbols = Array.from(missingPriceSymbolSet).sort();
  logMissingWeeklyPrices(biasSource.id, weekOpenUtc, missingPriceSymbols);

  console.log(`[engine] ADR Grid executor (${biasSource.id}): ${weekOpenUtc} -> ${trades.length} fills, ${totalReturn.toFixed(2)}% raw return`);

  return {
    weekOpenUtc,
    executionWindowOpenUtc: resultBoundaries.executionWindowOpenUtc,
    executionWindowCloseUtc: resultBoundaries.executionWindowCloseUtc,
    biasSourceId: biasSource.id,
    trades,
    totalReturnPct: totalReturn,
    winCount: wins,
    lossCount: losses,
    winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
    tradeCount: trades.length,
    plannedTrades: plannedGridTrades,
    displayUnit: "grids",
    signals,
    isRealized,
    missingPriceSymbols,
  };
}

// ─── Executor registry ──────────────────────────────────────────
// Adding a new strategy = write an executor function + add one line here.

type StrategyExecutor = (
  biasSource: BiasSourceConfig,
  weekOpenUtc: string,
  riskOverlay?: RiskOverlayConfig,
) => Promise<WeeklyHoldResult>;

const EXECUTORS: Record<string, StrategyExecutor> = {
  adr: executeAdr,
  adr_grid: executeAdrGrid,
  // Future: stoch, adr_stoch, etc.
};

// ─── Core computation ───────────────────────────────────────────

export async function computeWeeklyHold(
  biasSource: BiasSourceConfig,
  weekOpenUtc: string,
  entryStyle?: EntryStyleConfig,
  riskOverlay?: RiskOverlayConfig,
): Promise<WeeklyHoldResult> {
  // Route to the correct executor based on plModel
  const plModel = entryStyle?.plModel ?? "weekly_hold";
  const executor = EXECUTORS[plModel];
  if (executor) {
    console.log(`[engine] Routing to ${plModel} executor for ${weekOpenUtc}`);
    const result = await executor(biasSource, weekOpenUtc, riskOverlay);
    return applyAdrNormalization(result);
  }

  // Default: weekly hold (open→close from pair_period_returns)
  const directions = await resolveDirections(biasSource, weekOpenUtc);
  const signals = buildCanonicalSignals(directions);
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const isRealized = isWeekRealizedForAggregate(weekOpenUtc, currentWeekOpenUtc);
  const pairReturns = await getExecutionWeeklyPairReturns(weekOpenUtc);
  const returnMap = new Map(pairReturns.map((r) => [r.symbol.toUpperCase(), r]));
  const resultBoundaries = mergeExecutionBoundaries(
    weekOpenUtc,
    pairReturns.length > 0 ? pairReturns.map((row) => row.assetClass) : ["fx"],
  );

  const trades: WeeklyHoldTrade[] = [];
  const missingPriceSymbolSet = new Set<string>();

  if (pairReturns.length === 0) {
    const missingPriceSymbols = Array.from(
      new Set(Array.from(directions.keys()).map(pairFromDirectionKey)),
    ).sort();
    logMissingWeeklyPrices(biasSource.id, weekOpenUtc, missingPriceSymbols);
    return applyAdrNormalization({
      weekOpenUtc,
      executionWindowOpenUtc: resultBoundaries.executionWindowOpenUtc,
      executionWindowCloseUtc: resultBoundaries.executionWindowCloseUtc,
      biasSourceId: biasSource.id,
      trades,
      totalReturnPct: 0,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
      tradeCount: 0,
      signals,
      isRealized,
      missingPriceSymbols,
    });
  }

  for (const [key, signal] of directions) {
    // For tandem, key is "PAIR:model" — extract the pair name
    const pair = pairFromDirectionKey(key);
    const priceData = returnMap.get(pair);
    if (!priceData) {
      missingPriceSymbolSet.add(pair);
      continue;
    }

    const openPrice = priceData.openPrice;
    const closePrice = priceData.closePrice;
    const actualReturn = priceData.returnPct;
    // If direction is SHORT, negate the return (price going down = profit)
    const directedReturn = signal.direction === "SHORT" ? -actualReturn : actualReturn;

    const assetClass = normalizeAssetClass(priceData.assetClass ?? signal.assetClass);
    const executionBoundary = getExecutionBoundaryIso(weekOpenUtc, assetClass);
    const detailExitTimeUtc = effectiveWindowCloseIso(executionBoundary.windowCloseUtc, isRealized);
    trades.push({
      symbol: pair,
      assetClass,
      direction: signal.direction,
      openPrice,
      closePrice,
      returnPct: directedReturn,
      source: signal.source,
      tier: signal.tier,
      detail: {
        tradeNumber: trades.length + 1,
        entryTimeUtc: executionBoundary.windowOpenUtc,
        exitTimeUtc: detailExitTimeUtc,
        exitReason: isRealized ? "week_close" : "active",
        anchorPrice: openPrice,
        tpPrice: null,
        adrPct: null,
        maePct: null,
      },
    });
  }

  const cappedTrades = riskOverlay?.id === "exposure_cap"
    ? applyExposureCapToPlannedTrades(trades)
    : trades;
  const totalReturn = cappedTrades.reduce((s, t) => s + t.returnPct, 0);
  const wins = cappedTrades.filter((t) => t.returnPct > 0).length;
  const losses = cappedTrades.filter((t) => t.returnPct < 0).length;
  const missingPriceSymbols = Array.from(missingPriceSymbolSet).sort();
  logMissingWeeklyPrices(biasSource.id, weekOpenUtc, missingPriceSymbols);

  const result: WeeklyHoldResult = {
    weekOpenUtc,
    executionWindowOpenUtc: resultBoundaries.executionWindowOpenUtc,
    executionWindowCloseUtc: resultBoundaries.executionWindowCloseUtc,
    biasSourceId: biasSource.id,
    trades: cappedTrades,
    totalReturnPct: totalReturn,
    winCount: wins,
    lossCount: losses,
    winRate: cappedTrades.length > 0 ? (wins / cappedTrades.length) * 100 : 0,
    tradeCount: cappedTrades.length,
    signals,
    isRealized,
    missingPriceSymbols,
  };
  return applyAdrNormalization(result);
}

export async function computeMultiWeekHold(
  biasSource: BiasSourceConfig,
  weekOpenUtcs: string[],
  entryStyle?: EntryStyleConfig,
  riskOverlay?: RiskOverlayConfig,
): Promise<MultiWeekResult> {
  const computedWeeks: WeeklyHoldResult[] = [];
  const chunkSize = getMultiWeekComputeConcurrency();
  for (let index = 0; index < weekOpenUtcs.length; index += chunkSize) {
    const chunk = weekOpenUtcs.slice(index, index + chunkSize);
    const results = await Promise.allSettled(
      chunk.map((weekOpenUtc) => computeWeeklyHold(biasSource, weekOpenUtc, entryStyle, riskOverlay)),
    );

    results.forEach((result, resultIndex) => {
      const weekOpenUtc = chunk[resultIndex];
      if (result.status === "fulfilled") {
        computedWeeks.push(result.value);
        return;
      }
      console.warn(
        `[engine] Skipping week ${weekOpenUtc}:`,
        result.reason instanceof Error ? result.reason.message : result.reason,
      );
    });
  }

  const weekOrder = new Map(weekOpenUtcs.map((weekOpenUtc, index) => [weekOpenUtc, index]));
  computedWeeks.sort((left, right) => {
    return (weekOrder.get(left.weekOpenUtc) ?? 0) - (weekOrder.get(right.weekOpenUtc) ?? 0);
  });

  const weeks = computedWeeks.filter((week) => week.isRealized);

  const totalReturn = weeks.reduce((s, w) => s + w.totalReturnPct, 0);
  const totalTrades = weeks.reduce((s, w) => s + w.tradeCount, 0);
  const totalWins = weeks.reduce((s, w) => s + w.winCount, 0);

  const maxDrawdownPct = computeMaxDrawdownFromPercentReturns(
    weeks.map((week) => week.totalReturnPct),
  );

  // Per asset class
  const byAssetClass: Record<string, { returnPct: number; trades: number; wins: number }> = {};
  for (const w of weeks) {
    for (const t of w.trades) {
      if (!byAssetClass[t.assetClass]) byAssetClass[t.assetClass] = { returnPct: 0, trades: 0, wins: 0 };
      byAssetClass[t.assetClass]!.returnPct += t.returnPct;
      byAssetClass[t.assetClass]!.trades++;
      if (t.returnPct > 0) byAssetClass[t.assetClass]!.wins++;
    }
  }

  return {
    biasSourceId: biasSource.id,
    weeks,
    totalReturnPct: totalReturn,
    totalTrades,
    totalWins,
    winRate: totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0,
    maxDrawdownPct,
    byAssetClass,
  };
}

export async function computeWeeklySignalsOnly(
  biasSource: BiasSourceConfig,
  weekOpenUtc: string,
): Promise<WeeklyHoldResult> {
  const directions = await resolveDirections(biasSource, weekOpenUtc);
  const resultBoundaries = mergeExecutionBoundaries(weekOpenUtc, ["fx"]);
  return {
    weekOpenUtc,
    executionWindowOpenUtc: resultBoundaries.executionWindowOpenUtc,
    executionWindowCloseUtc: resultBoundaries.executionWindowCloseUtc,
    biasSourceId: biasSource.id,
    trades: [],
    totalReturnPct: 0,
    winCount: 0,
    lossCount: 0,
    winRate: 0,
    tradeCount: 0,
    signals: buildCanonicalSignals(directions),
    isRealized: false,
  };
}
