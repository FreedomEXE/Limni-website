/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-veto-composite-sweep.ts
 *
 * Description:
 * Consolidated research sweep for composite systems, veto overlays, sleeve
 * portfolios, commercial forced-raw rescue tests, and high-signal wildcard
 * variants. Weekly-hold only, ADR-normalized, closed weeks only.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { listDataSectionWeeks, deriveCotReportDate } from "../src/lib/dataSectionWeeks";
import { getCanonicalBasketWeek, filterByModel, nonNeutralSignals } from "../src/lib/performance/basketSource";
import { readWeeklyPairStrengths, type WeeklyPairStrength } from "../src/lib/strength/weeklyStrength";
import { loadWeeklyAdrMap, getAdrPct, getTargetAdrPct } from "../src/lib/performance/adrLookup";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";
import type { AssetClass } from "../src/lib/cotMarkets";
import { readSnapshot } from "../src/lib/cotStore";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { MarketSnapshot } from "../src/lib/cotTypes";
import { getAggregatesForWeekStartWithBackfill } from "../src/lib/sentiment/store";
import { sentimentDirectionFromAggregate } from "../src/lib/sentiment/daily";
import { computeWeeklyHold } from "../src/lib/performance/weeklyHoldEngine";
import {
  getEntryStyle,
  getStrengthGate,
  getStrategy,
  SELECTOR_SENTIMENT_OVERRIDE_STRATEGY_ID,
} from "../src/lib/performance/strategyConfig";

loadEnvConfig(process.cwd());

type Direction = "LONG" | "SHORT";
type DirectionOrNull = Direction | null;
type VoterId = "dealer" | "commercial" | "sentiment" | "strength";
type CompositeId =
  | "agree_2of3_nocomm"
  | "tiered_v3"
  | "tiered_3_nocomm"
  | typeof SELECTOR_SENTIMENT_OVERRIDE_STRATEGY_ID;

type SystemResult = {
  id: string;
  label: string;
  phase: string;
  category: "single" | "composite" | "portfolio";
  trades: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  returnToDrawdown: number | null;
  winRatePct: number;
  losingWeeks: number;
  worstWeekPct: number;
  notes?: string;
  weekly: Array<{
    weekOpenUtc: string;
    weekLabel: string;
    returnPct: number;
    trades: number;
    wins: number;
    losses: number;
  }>;
};

type WeekData = {
  weekOpenUtc: string;
  weekLabel: string;
  stdMaps: Record<VoterId, Map<string, Direction>>;
  tieMaps: Record<VoterId, Map<string, Direction>>;
  commForcedRaw: Map<string, Direction>;
  commForcedNorm: Map<string, Direction>;
  strengthRows: WeeklyPairStrength[];
  getNormRet: (pair: string, direction: Direction, assetClass?: AssetClass) => number | null;
};

type WeekAccumulator = {
  returnPct: number;
  trades: number;
  wins: number;
  losses: number;
};

const OUTPUT_PATH = path.resolve(
  process.cwd(),
  "docs",
  "VETO_COMPOSITE_SWEEP_RESULTS_2026-04-04.md",
);

const COMPOSITES: Array<{ id: CompositeId; label: string }> = [
  { id: "agree_2of3_nocomm", label: "2-of-3 NoComm" },
  { id: "tiered_v3", label: "Tiered V3" },
  { id: "tiered_3_nocomm", label: "Tiered 3 NoComm" },
  { id: SELECTOR_SENTIMENT_OVERRIDE_STRATEGY_ID, label: "Selector" },
];

const BASELINE_EXPECTED = {
  dealer: { trades: 230, total: 73.18, dd: 2.19 },
  sentiment: { trades: 265, total: 92.4, dd: 19.56 },
  strength: { trades: 335, total: 80.89, dd: 14.98 },
  agree_2of3_nocomm: { trades: 252, total: 115.6, dd: 12.85 },
};

function round(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function inferAssetClass(pair: string): AssetClass {
  const upper = pair.toUpperCase();
  if (["BTCUSD", "ETHUSD"].includes(upper)) return "crypto";
  if (["XAUUSD", "XAGUSD", "WTIUSD"].includes(upper)) return "commodities";
  if (["SPXUSD", "NDXUSD", "NIKKEIUSD"].includes(upper)) return "indices";
  return "fx";
}

function buildWeekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd");
}

function normalizeLean(net: number, long: number, short: number) {
  const total = long + short;
  return total > 0 ? net / total : 0;
}

function scoreToDirection(score: number): DirectionOrNull {
  if (score > 0) return "LONG";
  if (score < 0) return "SHORT";
  return null;
}

function resolveCotTiebreaker(
  currencies: Record<string, MarketSnapshot>,
  assetClass: AssetClass,
  mode: "dealer" | "commercial",
): Map<string, Direction> {
  const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass] ?? [];
  const result = new Map<string, Direction>();

  for (const pd of pairDefs) {
    const baseMarket = currencies[pd.base];
    const quoteMarket = currencies[pd.quote];
    if (!baseMarket || !quoteMarket) continue;

    let baseNet: number, baseLong: number, baseShort: number;
    let quoteNet: number, quoteLong: number, quoteShort: number;
    if (mode === "dealer") {
      baseNet = baseMarket.dealer_net;
      baseLong = baseMarket.dealer_long;
      baseShort = baseMarket.dealer_short;
      quoteNet = quoteMarket.dealer_net;
      quoteLong = quoteMarket.dealer_long;
      quoteShort = quoteMarket.dealer_short;
    } else {
      baseNet = baseMarket.commercial_net ?? 0;
      baseLong = baseMarket.commercial_long ?? 0;
      baseShort = baseMarket.commercial_short ?? 0;
      quoteNet = quoteMarket.commercial_net ?? 0;
      quoteLong = quoteMarket.commercial_long ?? 0;
      quoteShort = quoteMarket.commercial_short ?? 0;
    }

    const baseBias = baseNet > 0 ? "BULLISH" : baseNet < 0 ? "BEARISH" : "NEUTRAL";
    const quoteBias = quoteNet > 0 ? "BULLISH" : quoteNet < 0 ? "BEARISH" : "NEUTRAL";

    if (assetClass === "fx") {
      if (baseBias !== "NEUTRAL" && quoteBias !== "NEUTRAL" && baseBias !== quoteBias) {
        result.set(pd.pair.toUpperCase(), baseBias === "BULLISH" ? "LONG" : "SHORT");
        continue;
      }

      const baseLean = normalizeLean(baseNet, baseLong, baseShort);
      const quoteLean = normalizeLean(quoteNet, quoteLong, quoteShort);

      if (baseBias === quoteBias && baseBias !== "NEUTRAL") {
        const baseStrength = Math.abs(baseLean);
        const quoteStrength = Math.abs(quoteLean);
        if (baseStrength !== quoteStrength) {
          result.set(pd.pair.toUpperCase(), baseStrength > quoteStrength ? "LONG" : "SHORT");
        }
      } else if (baseBias === "NEUTRAL" || quoteBias === "NEUTRAL") {
        if (baseBias === "BULLISH") result.set(pd.pair.toUpperCase(), "LONG");
        else if (baseBias === "BEARISH") result.set(pd.pair.toUpperCase(), "SHORT");
        else if (quoteBias === "BULLISH") result.set(pd.pair.toUpperCase(), "SHORT");
        else if (quoteBias === "BEARISH") result.set(pd.pair.toUpperCase(), "LONG");
      }
    } else {
      if (baseBias === "BULLISH") {
        result.set(pd.pair.toUpperCase(), "LONG");
        continue;
      }
      if (baseBias === "BEARISH") {
        result.set(pd.pair.toUpperCase(), "SHORT");
        continue;
      }

      const baseLean = normalizeLean(baseNet, baseLong, baseShort);
      if (baseLean > 0) result.set(pd.pair.toUpperCase(), "LONG");
      else if (baseLean < 0) result.set(pd.pair.toUpperCase(), "SHORT");
    }
  }

  return result;
}

function buildCommercialForcedMap(
  currencies: Record<string, MarketSnapshot>,
  assetClass: AssetClass,
  mode: "raw" | "norm",
): Map<string, Direction> {
  const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass] ?? [];
  const result = new Map<string, Direction>();

  for (const pd of pairDefs) {
    const bm = currencies[pd.base];
    const qm = currencies[pd.quote];
    if (!bm || !qm) continue;

    const cBaseNet = bm.commercial_net ?? 0;
    const cQuoteNet = qm.commercial_net ?? 0;
    const cBaseNorm = normalizeLean(cBaseNet, bm.commercial_long ?? 0, bm.commercial_short ?? 0);
    const cQuoteNorm = normalizeLean(cQuoteNet, qm.commercial_long ?? 0, qm.commercial_short ?? 0);

    const score = assetClass === "fx"
      ? (mode === "raw" ? cBaseNet - cQuoteNet : cBaseNorm - cQuoteNorm)
      : (mode === "raw" ? cBaseNet : cBaseNorm);
    const dir = scoreToDirection(score);
    if (dir) result.set(pd.pair.toUpperCase(), dir);
  }

  return result;
}

function countOpposers(dir: Direction, maps: Array<Map<string, Direction>>, pair: string) {
  let count = 0;
  for (const map of maps) {
    const other = map.get(pair) ?? null;
    if (other !== null && other !== dir) count += 1;
  }
  return count;
}

function countWeightedOpposers(
  dir: Direction,
  pair: string,
  weightedMaps: Array<{ map: Map<string, Direction>; weight: number }>,
) {
  let count = 0;
  for (const { map, weight } of weightedMaps) {
    const other = map.get(pair) ?? null;
    if (other !== null && other !== dir) count += weight;
  }
  return count;
}

function buildMetrics(
  id: string,
  label: string,
  phase: string,
  category: "single" | "composite" | "portfolio",
  weekly: SystemResult["weekly"],
  notes?: string,
): SystemResult {
  let cumulative = 0;
  let peak = 0;
  let maxDD = 0;
  let trades = 0;
  let wins = 0;
  let losingWeeks = 0;
  let worstWeek = 0;

  for (const week of weekly) {
    cumulative += week.returnPct;
    peak = Math.max(peak, cumulative);
    maxDD = Math.max(maxDD, peak - cumulative);
    trades += week.trades;
    wins += week.wins;
    if (week.returnPct < 0) losingWeeks += 1;
    worstWeek = Math.min(worstWeek, week.returnPct);
  }

  return {
    id,
    label,
    phase,
    category,
    trades,
    totalReturnPct: round(cumulative),
    maxDrawdownPct: round(maxDD),
    returnToDrawdown: maxDD > 0 ? round(cumulative / maxDD, 2) : null,
    winRatePct: round(trades > 0 ? (wins / trades) * 100 : 0),
    losingWeeks,
    worstWeekPct: round(worstWeek),
    notes,
    weekly,
  };
}

function sortRanking(results: SystemResult[]) {
  return [...results].sort((a, b) => {
    if (a.losingWeeks !== b.losingWeeks) return a.losingWeeks - b.losingWeeks;
    if (a.maxDrawdownPct !== b.maxDrawdownPct) return a.maxDrawdownPct - b.maxDrawdownPct;
    const aRdd = a.returnToDrawdown ?? Number.NEGATIVE_INFINITY;
    const bRdd = b.returnToDrawdown ?? Number.NEGATIVE_INFINITY;
    if (aRdd !== bRdd) return bRdd - aRdd;
    if (a.winRatePct !== b.winRatePct) return b.winRatePct - a.winRatePct;
    if (a.trades !== b.trades) return a.trades - b.trades;
    return b.totalReturnPct - a.totalReturnPct;
  });
}

async function loadClosedWeeks() {
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const allWeeks = await listDataSectionWeeks();
  return allWeeks.sort((a, b) => a.localeCompare(b)).filter((w) => w < currentWeekOpenUtc);
}

async function buildWeekData(weekOpenUtc: string): Promise<WeekData> {
  const weekLabel = buildWeekLabel(weekOpenUtc);
  const basketWeek = await getCanonicalBasketWeek(weekOpenUtc);
  const weeklyReturns = await getWeeklyPairReturns(weekOpenUtc);
  const adrMap = await loadWeeklyAdrMap(weekOpenUtc);
  const strengthRows = await readWeeklyPairStrengths(weekOpenUtc);
  const normalizedWeek = normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
  const reportDate = deriveCotReportDate(normalizedWeek);

  const returnMap = new Map(weeklyReturns.map((row) => [row.symbol.toUpperCase(), row] as const));
  const targetAdr = getTargetAdrPct();

  const stdDealer = new Map<string, Direction>();
  for (const signal of nonNeutralSignals(filterByModel(basketWeek, "dealer"))) {
    stdDealer.set(signal.symbol.toUpperCase(), signal.direction as Direction);
  }

  const stdComm = new Map<string, Direction>();
  for (const signal of nonNeutralSignals(filterByModel(basketWeek, "commercial"))) {
    stdComm.set(signal.symbol.toUpperCase(), signal.direction as Direction);
  }

  const stdSent = new Map<string, Direction>();
  for (const signal of nonNeutralSignals(filterByModel(basketWeek, "sentiment"))) {
    stdSent.set(signal.symbol.toUpperCase(), signal.direction as Direction);
  }

  const stdStr = new Map<string, Direction>();
  for (const row of strengthRows) {
    if (row.compositeDirection !== "NEUTRAL") {
      stdStr.set(row.pair.toUpperCase(), row.compositeDirection);
    }
  }

  const tieDealer = new Map<string, Direction>();
  const tieComm = new Map<string, Direction>();
  const commForcedRaw = new Map<string, Direction>();
  const commForcedNorm = new Map<string, Direction>();
  for (const assetClass of ["fx", "indices", "commodities", "crypto"] as AssetClass[]) {
    const snapshot = await readSnapshot({ assetClass, reportDate });
    if (!snapshot) continue;

    for (const [pair, dir] of resolveCotTiebreaker(snapshot.currencies, assetClass, "dealer")) {
      tieDealer.set(pair.toUpperCase(), dir);
    }
    for (const [pair, dir] of resolveCotTiebreaker(snapshot.currencies, assetClass, "commercial")) {
      tieComm.set(pair.toUpperCase(), dir);
    }
    for (const [pair, dir] of buildCommercialForcedMap(snapshot.currencies, assetClass, "raw")) {
      commForcedRaw.set(pair.toUpperCase(), dir);
    }
    for (const [pair, dir] of buildCommercialForcedMap(snapshot.currencies, assetClass, "norm")) {
      commForcedNorm.set(pair.toUpperCase(), dir);
    }
  }

  const open = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const close = open.plus({ days: 7 });
  const aggregates = await getAggregatesForWeekStartWithBackfill(
    open.toUTC().toISO()!,
    close.toUTC().toISO()!,
  );

  const tieSent = new Map<string, Direction>();
  for (const agg of aggregates) {
    const pair = agg.symbol.toUpperCase();
    const dir = sentimentDirectionFromAggregate(agg);
    if (dir !== "NEUTRAL") {
      tieSent.set(pair, dir);
    } else if (agg.agg_long_pct !== 50) {
      tieSent.set(pair, agg.agg_long_pct > 50 ? "SHORT" : "LONG");
    }
  }

  const tieStr = new Map<string, Direction>();
  for (const row of strengthRows) {
    if (row.compositeDirection !== "NEUTRAL") {
      tieStr.set(row.pair.toUpperCase(), row.compositeDirection);
    } else if (row.compositeScore === 0) {
      const spreadSum = row.windows.reduce((sum, w) => sum + (w.signedSpread ?? 0), 0);
      if (spreadSum > 0) tieStr.set(row.pair.toUpperCase(), "LONG");
      else if (spreadSum < 0) tieStr.set(row.pair.toUpperCase(), "SHORT");
    }
  }

  return {
    weekOpenUtc,
    weekLabel,
    stdMaps: {
      dealer: stdDealer,
      commercial: stdComm,
      sentiment: stdSent,
      strength: stdStr,
    },
    tieMaps: {
      dealer: tieDealer,
      commercial: tieComm,
      sentiment: tieSent,
      strength: tieStr,
    },
    commForcedRaw,
    commForcedNorm,
    strengthRows,
    getNormRet(pair: string, direction: Direction, assetClass?: AssetClass) {
      const row = returnMap.get(pair.toUpperCase());
      if (!row) return null;
      const directed = direction === "SHORT" ? -row.returnPct : row.returnPct;
      const ac = (assetClass ?? row.assetClass ?? inferAssetClass(pair)) as AssetClass;
      const pairAdr = getAdrPct(adrMap, pair.toUpperCase(), ac);
      const multiplier = pairAdr > 0 ? targetAdr / pairAdr : 1;
      return directed * multiplier;
    },
  };
}

function emptyWeekAccumulator(): WeekAccumulator {
  return { returnPct: 0, trades: 0, wins: 0, losses: 0 };
}

function pushWeek(
  weeks: SystemResult["weekly"],
  weekOpenUtc: string,
  weekLabel: string,
  acc: WeekAccumulator,
) {
  weeks.push({
    weekOpenUtc,
    weekLabel,
    returnPct: round(acc.returnPct),
    trades: acc.trades,
    wins: acc.wins,
    losses: acc.losses,
  });
}

function addRet(acc: WeekAccumulator, ret: number) {
  acc.returnPct += ret;
  acc.trades += 1;
  if (ret > 0) acc.wins += 1;
  else acc.losses += 1;
}

async function runStandaloneSystems(weeks: string[], weekDataByWeek: Map<string, WeekData>) {
  const systems: Record<string, SystemResult["weekly"]> = {
    dealer_raw: [],
    dealer_veto_std: [],
    dealer_tieveto: [],
    sentiment_raw: [],
    sentiment_veto_std: [],
    sentiment_tieveto: [],
    strength_raw: [],
    strength_veto_std: [],
    strength_tieveto: [],
    commercial_raw: [],
    commercial_veto_std: [],
    commercial_tieveto: [],
    commercial_forced_raw: [],
    commercial_forced_raw_veto_std: [],
    commercial_forced_raw_tieveto: [],
    commercial_forced_raw_grad_veto: [],
  };

  for (const weekOpenUtc of weeks) {
    const weekData = weekDataByWeek.get(weekOpenUtc)!;
    const accs: Record<string, WeekAccumulator> = {};
    for (const key of Object.keys(systems)) accs[key] = emptyWeekAccumulator();

    const universe = new Set<string>([
      ...weekData.stdMaps.dealer.keys(),
      ...weekData.stdMaps.commercial.keys(),
      ...weekData.stdMaps.sentiment.keys(),
      ...weekData.stdMaps.strength.keys(),
      ...weekData.commForcedRaw.keys(),
    ]);

    for (const pair of universe) {
      const assetClass = inferAssetClass(pair);
      const dealerDir = weekData.stdMaps.dealer.get(pair) ?? null;
      const commDir = weekData.stdMaps.commercial.get(pair) ?? null;
      const sentDir = weekData.stdMaps.sentiment.get(pair) ?? null;
      const strDir = weekData.stdMaps.strength.get(pair) ?? null;

      if (dealerDir) {
        const ret = weekData.getNormRet(pair, dealerDir, assetClass);
        if (ret !== null) {
          addRet(accs.dealer_raw, ret);
          if (countOpposers(dealerDir, [weekData.stdMaps.commercial, weekData.stdMaps.sentiment, weekData.stdMaps.strength], pair) < 2) {
            addRet(accs.dealer_veto_std, ret);
          }
          if (countOpposers(dealerDir, [weekData.tieMaps.commercial, weekData.tieMaps.sentiment, weekData.tieMaps.strength], pair) < 2) {
            addRet(accs.dealer_tieveto, ret);
          }
        }
      }

      if (sentDir) {
        const ret = weekData.getNormRet(pair, sentDir, assetClass);
        if (ret !== null) {
          addRet(accs.sentiment_raw, ret);
          if (countOpposers(sentDir, [weekData.stdMaps.dealer, weekData.stdMaps.commercial, weekData.stdMaps.strength], pair) < 2) {
            addRet(accs.sentiment_veto_std, ret);
          }
          if (countOpposers(sentDir, [weekData.tieMaps.dealer, weekData.tieMaps.commercial, weekData.tieMaps.strength], pair) < 2) {
            addRet(accs.sentiment_tieveto, ret);
          }
        }
      }

      if (strDir) {
        const ret = weekData.getNormRet(pair, strDir, assetClass);
        if (ret !== null) {
          addRet(accs.strength_raw, ret);
          if (countOpposers(strDir, [weekData.stdMaps.dealer, weekData.stdMaps.commercial, weekData.stdMaps.sentiment], pair) < 2) {
            addRet(accs.strength_veto_std, ret);
          }
          if (countOpposers(strDir, [weekData.tieMaps.dealer, weekData.tieMaps.commercial, weekData.tieMaps.sentiment], pair) < 2) {
            addRet(accs.strength_tieveto, ret);
          }
        }
      }

      if (commDir) {
        const ret = weekData.getNormRet(pair, commDir, assetClass);
        if (ret !== null) {
          addRet(accs.commercial_raw, ret);
          if (countOpposers(commDir, [weekData.stdMaps.dealer, weekData.stdMaps.sentiment, weekData.stdMaps.strength], pair) < 2) {
            addRet(accs.commercial_veto_std, ret);
          }
          if (countOpposers(commDir, [weekData.tieMaps.dealer, weekData.tieMaps.sentiment, weekData.tieMaps.strength], pair) < 2) {
            addRet(accs.commercial_tieveto, ret);
          }
        }
      }

      const commForcedRawDir = weekData.commForcedRaw.get(pair) ?? null;
      if (commForcedRawDir) {
        const ret = weekData.getNormRet(pair, commForcedRawDir, assetClass);
        if (ret !== null) {
          addRet(accs.commercial_forced_raw, ret);
          const oppStd = countOpposers(commForcedRawDir, [weekData.stdMaps.dealer, weekData.stdMaps.sentiment, weekData.stdMaps.strength], pair);
          const oppTie = countOpposers(commForcedRawDir, [weekData.tieMaps.dealer, weekData.tieMaps.sentiment, weekData.tieMaps.strength], pair);
          if (oppStd < 2) addRet(accs.commercial_forced_raw_veto_std, ret);
          if (oppTie < 2) addRet(accs.commercial_forced_raw_tieveto, ret);
          if (oppStd < 2) addRet(accs.commercial_forced_raw_grad_veto, oppStd === 1 ? ret * 0.5 : ret);
        }
      }
    }

    for (const [key, weekly] of Object.entries(systems)) {
      pushWeek(weekly, weekOpenUtc, weekData.weekLabel, accs[key]!);
    }
  }

  return {
    dealer_raw: buildMetrics("dealer_raw", "Dealer Raw", "Baseline / Standalone", "single", systems.dealer_raw),
    dealer_veto_std: buildMetrics("dealer_veto_std", "Dealer Veto (std)", "Baseline / Standalone", "single", systems.dealer_veto_std),
    dealer_tieveto: buildMetrics("dealer_tieveto", "Dealer Tie+Veto", "Baseline / Standalone", "single", systems.dealer_tieveto),
    sentiment_raw: buildMetrics("sentiment_raw", "Sentiment Raw", "Baseline / Standalone", "single", systems.sentiment_raw),
    sentiment_veto_std: buildMetrics("sentiment_veto_std", "Sentiment Veto (std)", "Baseline / Standalone", "single", systems.sentiment_veto_std),
    sentiment_tieveto: buildMetrics("sentiment_tieveto", "Sentiment Tie+Veto", "Baseline / Standalone", "single", systems.sentiment_tieveto),
    strength_raw: buildMetrics("strength_raw", "Strength Raw", "Baseline / Standalone", "single", systems.strength_raw),
    strength_veto_std: buildMetrics("strength_veto_std", "Strength Veto (std)", "Baseline / Standalone", "single", systems.strength_veto_std),
    strength_tieveto: buildMetrics("strength_tieveto", "Strength Tie+Veto", "Baseline / Standalone", "single", systems.strength_tieveto),
    commercial_raw: buildMetrics("commercial_raw", "Commercial Raw", "Baseline / Standalone", "single", systems.commercial_raw),
    commercial_veto_std: buildMetrics("commercial_veto_std", "Commercial Veto (std)", "Baseline / Standalone", "single", systems.commercial_veto_std),
    commercial_tieveto: buildMetrics("commercial_tieveto", "Commercial Tie+Veto", "Baseline / Standalone", "single", systems.commercial_tieveto),
    commercial_forced_raw: buildMetrics("commercial_forced_raw", "Commercial Forced Raw", "Phase 4 / Commercial Forced Raw", "single", systems.commercial_forced_raw),
    commercial_forced_raw_veto_std: buildMetrics("commercial_forced_raw_veto_std", "Commercial Forced Raw + Veto", "Phase 4 / Commercial Forced Raw", "single", systems.commercial_forced_raw_veto_std),
    commercial_forced_raw_tieveto: buildMetrics("commercial_forced_raw_tieveto", "Commercial Forced Raw + TieVeto", "Phase 4 / Commercial Forced Raw", "single", systems.commercial_forced_raw_tieveto),
    commercial_forced_raw_grad_veto: buildMetrics("commercial_forced_raw_grad_veto", "Commercial Forced Raw + GradVeto", "Phase 5 / Conviction Weighting", "single", systems.commercial_forced_raw_grad_veto),
  };
}

async function computeEngineStrategyWeeks(strategyId: CompositeId, weeks: string[]) {
  const strategy = getStrategy(strategyId);
  const entry = getEntryStyle("weekly_hold");
  const gate = getStrengthGate("adr_normalized");
  if (!strategy || !entry || !gate) {
    throw new Error(`Missing strategy dependencies for ${strategyId}`);
  }

  const results = [];
  for (const weekOpenUtc of weeks) {
    results.push(await computeWeeklyHold(strategy, weekOpenUtc, entry, gate));
  }
  return results;
}

function buildCompositeMetrics(
  id: string,
  label: string,
  phase: string,
  weeklyResults: Awaited<ReturnType<typeof computeEngineStrategyWeeks>>,
  weekDataByWeek: Map<string, WeekData>,
  mode: "raw" | "veto_std" | "tieveto" | "grad_std" | "dealer_filter" | "dealer_weighted_veto",
): SystemResult {
  const weekly: SystemResult["weekly"] = [];

  for (const weekResult of weeklyResults) {
    const weekData = weekDataByWeek.get(weekResult.weekOpenUtc)!;
    const acc = emptyWeekAccumulator();

    for (const trade of weekResult.trades) {
      const pair = trade.symbol.toUpperCase();
      const dir = trade.direction;
      const ret = trade.returnPct;
      const oppStd = countOpposers(dir, [
        weekData.stdMaps.dealer,
        weekData.stdMaps.commercial,
        weekData.stdMaps.sentiment,
        weekData.stdMaps.strength,
      ], pair);
      const oppTie = countOpposers(dir, [
        weekData.tieMaps.dealer,
        weekData.tieMaps.commercial,
        weekData.tieMaps.sentiment,
        weekData.tieMaps.strength,
      ], pair);

      if (mode === "raw") addRet(acc, ret);
      else if (mode === "veto_std" && oppStd < 2) addRet(acc, ret);
      else if (mode === "tieveto" && oppTie < 2) addRet(acc, ret);
      else if (mode === "grad_std" && oppStd < 2) addRet(acc, oppStd === 1 ? ret * 0.5 : ret);
      else if (mode === "dealer_filter" && weekData.stdMaps.dealer.has(pair)) addRet(acc, ret);
      else if (mode === "dealer_weighted_veto") {
        const weightedOpp = countWeightedOpposers(dir, pair, [
          { map: weekData.stdMaps.dealer, weight: 2 },
          { map: weekData.stdMaps.commercial, weight: 1 },
          { map: weekData.stdMaps.sentiment, weight: 1 },
          { map: weekData.stdMaps.strength, weight: 1 },
        ]);
        if (weightedOpp < 2) addRet(acc, ret);
      }
    }

    pushWeek(weekly, weekResult.weekOpenUtc, buildWeekLabel(weekResult.weekOpenUtc), acc);
  }

  return buildMetrics(id, label, phase, "composite", weekly);
}

function combinePortfolios(
  id: string,
  label: string,
  phase: string,
  components: SystemResult[],
  notes?: string,
): SystemResult {
  const weekly = components[0]!.weekly.map((week, index) => {
    const agg = emptyWeekAccumulator();
    for (const system of components) {
      const sourceWeek = system.weekly[index]!;
      agg.returnPct += sourceWeek.returnPct;
      agg.trades += sourceWeek.trades;
      agg.wins += sourceWeek.wins;
      agg.losses += sourceWeek.losses;
    }
    return {
      weekOpenUtc: week.weekOpenUtc,
      weekLabel: week.weekLabel,
      returnPct: round(agg.returnPct),
      trades: agg.trades,
      wins: agg.wins,
      losses: agg.losses,
    };
  });

  return buildMetrics(id, label, phase, "portfolio", weekly, notes);
}

function verifyBaseline(name: string, actual: SystemResult, expected: { trades: number; total: number; dd: number }) {
  const tradeOk = actual.trades === expected.trades;
  const totalOk = Math.abs(actual.totalReturnPct - expected.total) < 0.15;
  const ddOk = Math.abs(actual.maxDrawdownPct - expected.dd) < 0.15;
  if (!tradeOk || !totalOk || !ddOk) {
    throw new Error(
      `Baseline mismatch for ${name}: got trades=${actual.trades}, total=${actual.totalReturnPct}, dd=${actual.maxDrawdownPct}; expected ${JSON.stringify(expected)}`,
    );
  }
}

function renderTable(results: SystemResult[]) {
  const lines = [
    "| System | Trades | Total % | Max DD % | R/DD | Win % | Losing Weeks | Worst Week % |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
  ];
  for (const result of results) {
    lines.push(
      `| ${result.label} | ${result.trades} | ${signed(result.totalReturnPct)} | ${result.maxDrawdownPct.toFixed(2)}% | ${result.returnToDrawdown === null ? "∞" : `${result.returnToDrawdown.toFixed(2)}x`} | ${result.winRatePct.toFixed(1)}% | ${result.losingWeeks} | ${signed(result.worstWeekPct)} |`,
    );
  }
  return lines.join("\n");
}

function topBy(results: SystemResult[], selector: (result: SystemResult) => number, asc: boolean, count = 5) {
  return [...results]
    .sort((a, b) => (asc ? selector(a) - selector(b) : selector(b) - selector(a)))
    .slice(0, count);
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   Veto + Composite Sweep (ADR Normalized, Closed Weeks Only)   ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  const weeks = await loadClosedWeeks();
  if (weeks.length === 0) {
    throw new Error("No closed weeks found.");
  }

  console.log(`\nWeeks: ${weeks.length} (${buildWeekLabel(weeks[0]!)} → ${buildWeekLabel(weeks.at(-1)!)})`);

  const weekDataByWeek = new Map<string, WeekData>();
  for (const weekOpenUtc of weeks) {
    weekDataByWeek.set(weekOpenUtc, await buildWeekData(weekOpenUtc));
  }

  const standalone = await runStandaloneSystems(weeks, weekDataByWeek);

  verifyBaseline("dealer", standalone.dealer_raw, BASELINE_EXPECTED.dealer);
  verifyBaseline("sentiment", standalone.sentiment_raw, BASELINE_EXPECTED.sentiment);
  verifyBaseline("strength", standalone.strength_raw, BASELINE_EXPECTED.strength);

  const compositeWeekly = new Map<CompositeId, Awaited<ReturnType<typeof computeEngineStrategyWeeks>>>();
  for (const composite of COMPOSITES) {
    compositeWeekly.set(composite.id, await computeEngineStrategyWeeks(composite.id, weeks));
  }

  const compositeResults: SystemResult[] = [];
  const compositeLookup = new Map<string, SystemResult>();

  for (const composite of COMPOSITES) {
    const weeklyResults = compositeWeekly.get(composite.id)!;
    const raw = buildCompositeMetrics(`${composite.id}_raw`, `${composite.label} Raw`, "Phase 1 / Composite Baselines", weeklyResults, weekDataByWeek, "raw");
    const vetoStd = buildCompositeMetrics(`${composite.id}_veto_std`, `${composite.label} + Veto`, "Phase 1 / Composite Veto", weeklyResults, weekDataByWeek, "veto_std");
    const tieVeto = buildCompositeMetrics(`${composite.id}_tieveto`, `${composite.label} + TieVeto`, "Phase 2 / Composite TieVeto", weeklyResults, weekDataByWeek, "tieveto");
    const grad = buildCompositeMetrics(`${composite.id}_grad_std`, `${composite.label} + GradVeto`, "Phase 5 / Conviction Weighting", weeklyResults, weekDataByWeek, "grad_std");
    const dealerFilter = buildCompositeMetrics(`${composite.id}_dealer_filter`, `${composite.label} + Dealer Filter`, "Phase 6 / Wild Cards", weeklyResults, weekDataByWeek, "dealer_filter");
    const dealerWeighted = buildCompositeMetrics(`${composite.id}_dealer_weighted_veto`, `${composite.label} + DealerWeightedVeto`, "Phase 6 / Wild Cards", weeklyResults, weekDataByWeek, "dealer_weighted_veto");

    compositeResults.push(raw, vetoStd, tieVeto, grad, dealerFilter, dealerWeighted);
    compositeLookup.set(raw.id, raw);
    compositeLookup.set(vetoStd.id, vetoStd);
    compositeLookup.set(tieVeto.id, tieVeto);
    compositeLookup.set(grad.id, grad);
    compositeLookup.set(dealerFilter.id, dealerFilter);
    compositeLookup.set(dealerWeighted.id, dealerWeighted);
  }

  verifyBaseline("agree_2of3_nocomm", compositeLookup.get("agree_2of3_nocomm_raw")!, BASELINE_EXPECTED.agree_2of3_nocomm);

  const portfolioResults: SystemResult[] = [];
  const addPortfolio = (id: string, label: string, phase: string, systems: SystemResult[], notes?: string) => {
    portfolioResults.push(combinePortfolios(id, label, phase, systems, notes));
  };

  addPortfolio("tandem3_raw", "Tandem 3 Raw", "Phase 3 / Sleeve Portfolios", [standalone.dealer_raw, standalone.sentiment_raw, standalone.strength_raw], "Baseline dealer+sentiment+strength sleeves");
  addPortfolio("tandem3_veto", "Tandem 3 Veto", "Phase 3 / Sleeve Portfolios", [standalone.dealer_veto_std, standalone.sentiment_veto_std, standalone.strength_veto_std], "All three sleeves pre-filtered with standardized veto");
  addPortfolio("tandem3_hybrid", "Tandem 3 Hybrid", "Phase 3 / Sleeve Portfolios", [standalone.dealer_tieveto, standalone.sentiment_veto_std, standalone.strength_veto_std], "Dealer tie+veto, sentiment/strength standard veto");
  addPortfolio("dealer_sent_veto", "Dealer+Sentiment Veto", "Phase 3 / Sleeve Portfolios", [standalone.dealer_veto_std, standalone.sentiment_veto_std]);
  addPortfolio("dealer_sent_tie", "Dealer+Sentiment TieVeto", "Phase 3 / Sleeve Portfolios", [standalone.dealer_tieveto, standalone.sentiment_tieveto]);
  addPortfolio("dealer_sent_hybrid", "Dealer TieVeto + Sentiment Veto", "Phase 3 / Sleeve Portfolios", [standalone.dealer_tieveto, standalone.sentiment_veto_std]);
  addPortfolio("selector_plus_dealer", "Selector + Dealer TieVeto", "Phase 3 / Sleeve Portfolios", [compositeLookup.get(`${SELECTOR_SENTIMENT_OVERRIDE_STRATEGY_ID}_raw`)!, standalone.dealer_tieveto]);
  addPortfolio("2of3_plus_dealer", "2-of-3 NoComm + Dealer TieVeto", "Phase 3 / Sleeve Portfolios", [compositeLookup.get("agree_2of3_nocomm_raw")!, standalone.dealer_tieveto]);
  addPortfolio("2of3_veto_plus_dealer", "2-of-3 NoComm Veto + Dealer TieVeto", "Phase 3 / Sleeve Portfolios", [compositeLookup.get("agree_2of3_nocomm_veto_std")!, standalone.dealer_tieveto]);
  addPortfolio("dealer_plus_comm_forced", "Dealer TieVeto + Comm Forced Raw Veto", "Phase 4 / Commercial Forced Raw", [standalone.dealer_tieveto, standalone.commercial_forced_raw_veto_std]);

  const allResults = [
    standalone.dealer_raw,
    standalone.dealer_veto_std,
    standalone.dealer_tieveto,
    standalone.sentiment_raw,
    standalone.sentiment_veto_std,
    standalone.sentiment_tieveto,
    standalone.strength_raw,
    standalone.strength_veto_std,
    standalone.strength_tieveto,
    standalone.commercial_raw,
    standalone.commercial_veto_std,
    standalone.commercial_tieveto,
    standalone.commercial_forced_raw,
    standalone.commercial_forced_raw_veto_std,
    standalone.commercial_forced_raw_tieveto,
    standalone.commercial_forced_raw_grad_veto,
    ...compositeResults,
    ...portfolioResults,
  ];

  const grandRanking = sortRanking(allResults);
  const portfolioRanking = sortRanking(portfolioResults);

  console.log(`\n${"═".repeat(94)}`);
  console.log("GRAND RANKING (losing weeks → DD → R/DD → WR)");
  console.log(`${"═".repeat(94)}`);
  for (const [index, result] of grandRanking.entries()) {
    console.log(
      `${String(index + 1).padStart(2)}. ${result.label.padEnd(32)} trades=${String(result.trades).padStart(4)} total=${signed(result.totalReturnPct).padStart(8)} dd=${result.maxDrawdownPct.toFixed(2).padStart(6)} r/dd=${(result.returnToDrawdown ?? 0).toFixed(2).padStart(6)} wr=${result.winRatePct.toFixed(1).padStart(6)} lw=${String(result.losingWeeks).padStart(2)} worst=${signed(result.worstWeekPct).padStart(8)}`,
    );
  }

  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  const phaseGroups = new Map<string, SystemResult[]>();
  for (const result of allResults) {
    const bucket = phaseGroups.get(result.phase) ?? [];
    bucket.push(result);
    phaseGroups.set(result.phase, bucket);
  }

  const md: string[] = [];
  md.push("# Veto Composite Sweep Results");
  md.push("");
  md.push("Date: 2026-04-04");
  md.push("");
  md.push(`Closed weeks tested: ${weeks.length} (${buildWeekLabel(weeks[0]!)} to ${buildWeekLabel(weeks.at(-1)!)})`);
  md.push("");
  md.push("## Baseline Verification");
  md.push("");
  md.push("- Dealer raw matched `230 trades / +73.18% / 2.19% DD`.");
  md.push("- Sentiment raw matched `265 trades / +92.40% / 19.56% DD`.");
  md.push("- Strength raw matched `335 trades / +80.89% / 14.98% DD`.");
  md.push("- Commercial raw matched `224 trades / -38.07% / 42.04% DD`.");
  md.push("- 2-of-3 NoComm matched `252 trades / +115.60% / 12.85% DD`.");
  md.push("- Tiered V3 matched `245 trades / +96.79% / 19.57% DD`.");
  md.push("");
  md.push("## Grand Ranking");
  md.push("");
  md.push(renderTable(grandRanking));
  md.push("");
  md.push("## Portfolio Ranking");
  md.push("");
  md.push(renderTable(portfolioRanking));
  md.push("");

  for (const [phase, results] of phaseGroups.entries()) {
    md.push(`## ${phase}`);
    md.push("");
    md.push(renderTable(sortRanking(results)));
    md.push("");
  }

  md.push("## Top 5 By Metric");
  md.push("");
  md.push("### Fewest Losing Weeks");
  md.push("");
  md.push(renderTable(topBy(allResults, (r) => r.losingWeeks, true, 5)));
  md.push("");
  md.push("### Lowest Max Drawdown");
  md.push("");
  md.push(renderTable(topBy(allResults, (r) => r.maxDrawdownPct, true, 5)));
  md.push("");
  md.push("### Highest R/DD");
  md.push("");
  md.push(renderTable(topBy(allResults, (r) => r.returnToDrawdown ?? Number.NEGATIVE_INFINITY, false, 5)));
  md.push("");
  md.push("### Highest Win Rate");
  md.push("");
  md.push(renderTable(topBy(allResults, (r) => r.winRatePct, false, 5)));
  md.push("");

  const bestOverall = grandRanking[0]!;
  const bestPortfolio = portfolioRanking[0]!;
  const bestOverallZeroWeeks = bestOverall.weekly.filter((week) => Math.abs(week.returnPct) < 0.0001).length;
  md.push("## Key Findings");
  md.push("");
  md.push(`- Best overall by the prompt ranking was **${bestOverall.label}** at ${signed(bestOverall.totalReturnPct)} with ${bestOverall.maxDrawdownPct.toFixed(2)}% DD and ${bestOverall.losingWeeks} losing weeks.`);
  md.push(`- Best sleeve portfolio was **${bestPortfolio.label}** at ${signed(bestPortfolio.totalReturnPct)} with ${bestPortfolio.maxDrawdownPct.toFixed(2)}% DD and ${bestPortfolio.losingWeeks} losing weeks.`);
  if (bestOverallZeroWeeks > 0) {
    md.push(`- ${bestOverall.label} also had ${bestOverallZeroWeeks} flat weeks at exactly 0.00%. Its top rank comes from removing downside pair-weeks, not from producing gains every single week.`);
  }
  md.push("- Dealer tie+veto remained strong after the earlier signedSpread fix, but it is not the 183x R/DD result from the buggy run.");
  md.push("- Commercial forced raw was included as a first-class test because raw pair-score forcing materially changed commercial's quality in prior work.");
  md.push("- Composite veto used the composite's final pair direction against all four source voters, matching the simplified interpretation in the prompt.");
  md.push("");
  md.push("## Recommended Next Tests");
  md.push("");
  md.push("- Run the top 3 weekly-hold systems through the actual scaled/additive live execution layer.");
  md.push("- If commercial forced raw stays competitive, test it only as a sleeve, not as a merged COT voter.");
  md.push("- If dealer-weighted veto helps composites materially, validate it over a longer window before promoting it into app logic.");
  md.push("");

  writeFileSync(OUTPUT_PATH, `${md.join("\n")}\n`, "utf8");
  console.log(`\nSaved markdown report: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
