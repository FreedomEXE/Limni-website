/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-composite-standardization-sweep.ts
 *
 * Description:
 * Decision sweep for the rebased canonical world:
 *   - pick one agreement system
 *   - pick one tiered system
 *   - evaluate selector with raw / veto / tieveto
 *   - evaluate standalone base sources with raw / veto / tieveto
 *
 * All results are weekly-hold, ADR-normalized, closed weeks only.
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
import { readSnapshot } from "../src/lib/cotStore";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { AssetClass } from "../src/lib/cotMarkets";
import type { MarketSnapshot } from "../src/lib/cotTypes";
import { getAggregatesForWeekStartWithBackfill } from "../src/lib/sentiment/store";
import { sentimentDirectionFromAggregate } from "../src/lib/sentiment/daily";
import { computeWeeklyHold } from "../src/lib/performance/weeklyHoldEngine";
import { getEntryStyle, getStrategy } from "../src/lib/performance/strategyConfig";

loadEnvConfig(process.cwd());

type Direction = "LONG" | "SHORT";
type VoterId = "dealer" | "commercial" | "sentiment" | "strength";
type FilterMode = "raw" | "veto" | "tieveto";
type Family = "standalone" | "agreement" | "tiered" | "selector";

type WeekAccumulator = {
  returnPct: number;
  trades: number;
  wins: number;
  losses: number;
};

type WeeklyRow = {
  weekOpenUtc: string;
  weekLabel: string;
  returnPct: number;
  trades: number;
  wins: number;
  losses: number;
};

type SystemResult = {
  id: string;
  family: Family;
  system: string;
  filter: FilterMode;
  label: string;
  trades: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  returnToDrawdown: number | null;
  winRatePct: number;
  losingWeeks: number;
  worstWeekPct: number;
  weekly: WeeklyRow[];
};

type WeekData = {
  weekOpenUtc: string;
  weekLabel: string;
  stdMaps: Record<VoterId, Map<string, Direction>>;
  tieMaps: Record<VoterId, Map<string, Direction>>;
  strengthRows: WeeklyPairStrength[];
  getNormRet: (pair: string, direction: Direction, assetClass?: AssetClass) => number | null;
};

const OUTPUT_PATH = path.resolve(
  process.cwd(),
  "docs",
  "COMPOSITE_STANDARDIZATION_SWEEP_RESULTS_2026-04-04.md",
);

const SELECTOR_ID = "selector_sentiment_override";

const BASELINE_EXPECTED = {
  dealer: { trades: 230, total: 73.18, dd: 2.19 },
  sentiment: { trades: 265, total: 92.4, dd: 19.56 },
  strength: { trades: 335, total: 80.89, dd: 14.98 },
  commercial: { trades: 360, total: 21.13, dd: 29.04 },
  agree_2of3_nocomm: { trades: 252, total: 115.6, dd: 12.85 },
} as const;

function round(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function buildWeekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd");
}

function inferAssetClass(pair: string): AssetClass {
  const upper = pair.toUpperCase();
  if (["BTCUSD", "ETHUSD"].includes(upper)) return "crypto";
  if (["XAUUSD", "XAGUSD", "WTIUSD"].includes(upper)) return "commodities";
  if (["SPXUSD", "NDXUSD", "NIKKEIUSD"].includes(upper)) return "indices";
  return "fx";
}

function normalizeLean(net: number, long: number, short: number) {
  const total = long + short;
  return total > 0 ? net / total : 0;
}

function emptyWeekAccumulator(): WeekAccumulator {
  return { returnPct: 0, trades: 0, wins: 0, losses: 0 };
}

function addRet(acc: WeekAccumulator, ret: number) {
  acc.returnPct += ret;
  acc.trades += 1;
  if (ret > 0) acc.wins += 1;
  else acc.losses += 1;
}

function pushWeek(weekly: WeeklyRow[], weekOpenUtc: string, weekLabel: string, acc: WeekAccumulator) {
  weekly.push({
    weekOpenUtc,
    weekLabel,
    returnPct: round(acc.returnPct),
    trades: acc.trades,
    wins: acc.wins,
    losses: acc.losses,
  });
}

function countOpposers(dir: Direction, voterMaps: Array<Map<string, Direction>>, pair: string) {
  let count = 0;
  for (const map of voterMaps) {
    const vote = map.get(pair);
    if (vote && vote !== dir) count += 1;
  }
  return count;
}

function buildMetrics(
  id: string,
  family: Family,
  system: string,
  filter: FilterMode,
  label: string,
  weekly: WeeklyRow[],
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
    family,
    system,
    filter,
    label,
    trades,
    totalReturnPct: round(cumulative),
    maxDrawdownPct: round(maxDD),
    returnToDrawdown: maxDD > 0 ? round(cumulative / maxDD, 2) : null,
    winRatePct: round(trades > 0 ? (wins / trades) * 100 : 0),
    losingWeeks,
    worstWeekPct: round(worstWeek),
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
      if (baseBias === "BULLISH") result.set(pd.pair.toUpperCase(), "LONG");
      else if (baseBias === "BEARISH") result.set(pd.pair.toUpperCase(), "SHORT");
      else {
        const baseLean = normalizeLean(baseNet, baseLong, baseShort);
        if (baseLean > 0) result.set(pd.pair.toUpperCase(), "LONG");
        else if (baseLean < 0) result.set(pd.pair.toUpperCase(), "SHORT");
      }
    }
  }

  return result;
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
  for (const assetClass of ["fx", "indices", "commodities", "crypto"] as AssetClass[]) {
    const snapshot = await readSnapshot({ assetClass, reportDate });
    if (!snapshot) continue;
    for (const [pair, dir] of resolveCotTiebreaker(snapshot.currencies, assetClass, "dealer")) {
      tieDealer.set(pair.toUpperCase(), dir);
    }
    for (const [pair, dir] of resolveCotTiebreaker(snapshot.currencies, assetClass, "commercial")) {
      tieComm.set(pair.toUpperCase(), dir);
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
    if (dir !== "NEUTRAL") tieSent.set(pair, dir);
    else if (agg.agg_long_pct !== 50) tieSent.set(pair, agg.agg_long_pct > 50 ? "SHORT" : "LONG");
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

function applyFilterToDirection(
  mode: FilterMode,
  pair: string,
  dir: Direction,
  weekData: WeekData,
) {
  if (mode === "raw") return true;
  const maps = mode === "veto"
    ? [weekData.stdMaps.dealer, weekData.stdMaps.commercial, weekData.stdMaps.sentiment, weekData.stdMaps.strength]
    : [weekData.tieMaps.dealer, weekData.tieMaps.commercial, weekData.tieMaps.sentiment, weekData.tieMaps.strength];
  return countOpposers(dir, maps, pair) < 2;
}

async function runStandaloneSystems(weeks: string[], weekDataByWeek: Map<string, WeekData>) {
  const systems: Record<string, WeeklyRow[]> = {
    dealer_raw: [],
    dealer_veto: [],
    dealer_tieveto: [],
    sentiment_raw: [],
    sentiment_veto: [],
    sentiment_tieveto: [],
    strength_raw: [],
    strength_veto: [],
    strength_tieveto: [],
    commercial_raw: [],
    commercial_veto: [],
    commercial_tieveto: [],
  };

  for (const weekOpenUtc of weeks) {
    const weekData = weekDataByWeek.get(weekOpenUtc)!;
    const accs: Record<string, WeekAccumulator> = {};
    for (const key of Object.keys(systems)) accs[key] = emptyWeekAccumulator();

    const configs: Array<{ name: string; map: Map<string, Direction>; votersStd: Map<string, Direction>[]; votersTie: Map<string, Direction>[] }> = [
      {
        name: "dealer",
        map: weekData.stdMaps.dealer,
        votersStd: [weekData.stdMaps.commercial, weekData.stdMaps.sentiment, weekData.stdMaps.strength],
        votersTie: [weekData.tieMaps.commercial, weekData.tieMaps.sentiment, weekData.tieMaps.strength],
      },
      {
        name: "sentiment",
        map: weekData.stdMaps.sentiment,
        votersStd: [weekData.stdMaps.dealer, weekData.stdMaps.commercial, weekData.stdMaps.strength],
        votersTie: [weekData.tieMaps.dealer, weekData.tieMaps.commercial, weekData.tieMaps.strength],
      },
      {
        name: "strength",
        map: weekData.stdMaps.strength,
        votersStd: [weekData.stdMaps.dealer, weekData.stdMaps.commercial, weekData.stdMaps.sentiment],
        votersTie: [weekData.tieMaps.dealer, weekData.tieMaps.commercial, weekData.tieMaps.sentiment],
      },
      {
        name: "commercial",
        map: weekData.stdMaps.commercial,
        votersStd: [weekData.stdMaps.dealer, weekData.stdMaps.sentiment, weekData.stdMaps.strength],
        votersTie: [weekData.tieMaps.dealer, weekData.tieMaps.sentiment, weekData.tieMaps.strength],
      },
    ];

    for (const config of configs) {
      for (const [pair, dir] of config.map) {
        const ret = weekData.getNormRet(pair, dir, inferAssetClass(pair));
        if (ret === null) continue;
        addRet(accs[`${config.name}_raw`]!, ret);
        if (countOpposers(dir, config.votersStd, pair) < 2) addRet(accs[`${config.name}_veto`]!, ret);
        if (countOpposers(dir, config.votersTie, pair) < 2) addRet(accs[`${config.name}_tieveto`]!, ret);
      }
    }

    for (const [key, weekly] of Object.entries(systems)) {
      pushWeek(weekly, weekOpenUtc, weekData.weekLabel, accs[key]!);
    }
  }

  return [
    buildMetrics("dealer_raw", "standalone", "Dealer", "raw", "Dealer Raw", systems.dealer_raw),
    buildMetrics("dealer_veto", "standalone", "Dealer", "veto", "Dealer + Veto", systems.dealer_veto),
    buildMetrics("dealer_tieveto", "standalone", "Dealer", "tieveto", "Dealer + TieVeto", systems.dealer_tieveto),
    buildMetrics("sentiment_raw", "standalone", "Sentiment", "raw", "Sentiment Raw", systems.sentiment_raw),
    buildMetrics("sentiment_veto", "standalone", "Sentiment", "veto", "Sentiment + Veto", systems.sentiment_veto),
    buildMetrics("sentiment_tieveto", "standalone", "Sentiment", "tieveto", "Sentiment + TieVeto", systems.sentiment_tieveto),
    buildMetrics("strength_raw", "standalone", "Strength", "raw", "Strength Raw", systems.strength_raw),
    buildMetrics("strength_veto", "standalone", "Strength", "veto", "Strength + Veto", systems.strength_veto),
    buildMetrics("strength_tieveto", "standalone", "Strength", "tieveto", "Strength + TieVeto", systems.strength_tieveto),
    buildMetrics("commercial_raw", "standalone", "Commercial", "raw", "Commercial Raw", systems.commercial_raw),
    buildMetrics("commercial_veto", "standalone", "Commercial", "veto", "Commercial + Veto", systems.commercial_veto),
    buildMetrics("commercial_tieveto", "standalone", "Commercial", "tieveto", "Commercial + TieVeto", systems.commercial_tieveto),
  ];
}

async function computeEngineStrategyWeeks(strategyId: string, weeks: string[]) {
  const strategy = getStrategy(strategyId);
  const entry = getEntryStyle("weekly_hold");
  if (!strategy || !entry) throw new Error(`Missing strategy dependencies for ${strategyId}`);

  const results = [];
  for (const weekOpenUtc of weeks) {
    results.push(await computeWeeklyHold(strategy, weekOpenUtc, entry));
  }
  return results;
}

function buildEngineCompositeMetrics(
  family: Family,
  system: string,
  filter: FilterMode,
  label: string,
  weeklyResults: Awaited<ReturnType<typeof computeEngineStrategyWeeks>>,
  weekDataByWeek: Map<string, WeekData>,
) {
  const weekly: WeeklyRow[] = [];

  for (const weekResult of weeklyResults) {
    const weekData = weekDataByWeek.get(weekResult.weekOpenUtc)!;
    const acc = emptyWeekAccumulator();

    for (const trade of weekResult.trades) {
      const pair = trade.symbol.toUpperCase();
      if (applyFilterToDirection(filter, pair, trade.direction, weekData)) {
        addRet(acc, trade.returnPct);
      }
    }

    pushWeek(weekly, weekResult.weekOpenUtc, buildWeekLabel(weekResult.weekOpenUtc), acc);
  }

  return buildMetrics(
    `${system}_${filter}`,
    family,
    system,
    filter,
    label,
    weekly,
  );
}

function deriveAgree3of4(weekData: WeekData) {
  const result = new Map<string, Direction>();
  const allPairs = new Set([
    ...weekData.stdMaps.dealer.keys(),
    ...weekData.stdMaps.commercial.keys(),
    ...weekData.stdMaps.sentiment.keys(),
    ...weekData.stdMaps.strength.keys(),
  ]);

  for (const pair of allPairs) {
    const votes = [
      weekData.stdMaps.dealer.get(pair),
      weekData.stdMaps.commercial.get(pair),
      weekData.stdMaps.sentiment.get(pair),
      weekData.stdMaps.strength.get(pair),
    ];
    let longCount = 0;
    let shortCount = 0;
    for (const vote of votes) {
      if (vote === "LONG") longCount += 1;
      else if (vote === "SHORT") shortCount += 1;
    }
    if (longCount >= 3) result.set(pair, "LONG");
    else if (shortCount >= 3) result.set(pair, "SHORT");
  }

  return result;
}

function deriveTiered4(weekData: WeekData) {
  const result = new Map<string, Direction>();
  const allPairs = new Set([
    ...weekData.stdMaps.dealer.keys(),
    ...weekData.stdMaps.commercial.keys(),
    ...weekData.stdMaps.sentiment.keys(),
    ...weekData.stdMaps.strength.keys(),
  ]);

  for (const pair of allPairs) {
    const votes = [
      weekData.stdMaps.dealer.get(pair),
      weekData.stdMaps.commercial.get(pair),
      weekData.stdMaps.sentiment.get(pair),
      weekData.stdMaps.strength.get(pair),
    ];
    let longCount = 0;
    let shortCount = 0;
    for (const vote of votes) {
      if (vote === "LONG") longCount += 1;
      else if (vote === "SHORT") shortCount += 1;
    }
    if (longCount > shortCount && longCount >= 1) result.set(pair, "LONG");
    else if (shortCount > longCount && shortCount >= 1) result.set(pair, "SHORT");
  }

  return result;
}

function buildCustomCompositeMetrics(
  family: Family,
  system: string,
  filter: FilterMode,
  label: string,
  weeks: string[],
  weekDataByWeek: Map<string, WeekData>,
  deriveDirections: (weekData: WeekData) => Map<string, Direction>,
) {
  const weekly: WeeklyRow[] = [];

  for (const weekOpenUtc of weeks) {
    const weekData = weekDataByWeek.get(weekOpenUtc)!;
    const acc = emptyWeekAccumulator();
    const directions = deriveDirections(weekData);

    for (const [pair, dir] of directions) {
      if (!applyFilterToDirection(filter, pair, dir, weekData)) continue;
      const ret = weekData.getNormRet(pair, dir, inferAssetClass(pair));
      if (ret !== null) addRet(acc, ret);
    }

    pushWeek(weekly, weekOpenUtc, weekData.weekLabel, acc);
  }

  return buildMetrics(`${system}_${filter}`, family, system, filter, label, weekly);
}

function verifyBaseline(name: string, actual: SystemResult, expected: { trades: number; total: number; dd: number }) {
  const tradeOk = actual.trades === expected.trades;
  const totalOk = Math.abs(actual.totalReturnPct - expected.total) < 0.2;
  const ddOk = Math.abs(actual.maxDrawdownPct - expected.dd) < 0.2;
  if (!tradeOk || !totalOk || !ddOk) {
    throw new Error(
      `Baseline mismatch for ${name}: got trades=${actual.trades}, total=${actual.totalReturnPct}, dd=${actual.maxDrawdownPct}; expected ${JSON.stringify(expected)}`,
    );
  }
}

function tableHeader() {
  return "| Family | System | Filter | Trades | Total% | MaxDD% | R/DD | Win% | LW | Worst Week% |";
}

function tableDivider() {
  return "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|";
}

function toTableRow(result: SystemResult) {
  return `| ${result.family} | ${result.system} | ${result.filter} | ${result.trades} | ${signed(result.totalReturnPct)} | ${result.maxDrawdownPct.toFixed(2)}% | ${result.returnToDrawdown == null ? "∞" : result.returnToDrawdown.toFixed(2)} | ${result.winRatePct.toFixed(1)}% | ${result.losingWeeks} | ${signed(result.worstWeekPct)} |`;
}

function formatDecisionTable(title: string, rows: SystemResult[]) {
  const sorted = sortRanking(rows);
  return [
    `## ${title}`,
    "",
    tableHeader(),
    tableDivider(),
    ...sorted.map(toTableRow),
    "",
    `Winner: \`${sorted[0]!.label}\``,
    "",
  ].join("\n");
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════════╗");
  console.log("║   Composite Standardization Sweep (Rebased Canonical World)      ║");
  console.log("╚════════════════════════════════════════════════════════════════════╝");

  const weeks = await loadClosedWeeks();
  console.log(`\nWeeks: ${weeks.length} (${buildWeekLabel(weeks[0]!)} → ${buildWeekLabel(weeks.at(-1)!)})`);

  const weekDataEntries = await Promise.all(
    weeks.map(async (weekOpenUtc) => [weekOpenUtc, await buildWeekData(weekOpenUtc)] as const),
  );
  const weekDataByWeek = new Map(weekDataEntries);

  const standalone = await runStandaloneSystems(weeks, weekDataByWeek);
  const standaloneMap = new Map(standalone.map((row) => [row.id, row] as const));
  verifyBaseline("dealer", standaloneMap.get("dealer_raw")!, BASELINE_EXPECTED.dealer);
  verifyBaseline("sentiment", standaloneMap.get("sentiment_raw")!, BASELINE_EXPECTED.sentiment);
  verifyBaseline("strength", standaloneMap.get("strength_raw")!, BASELINE_EXPECTED.strength);
  verifyBaseline("commercial", standaloneMap.get("commercial_raw")!, BASELINE_EXPECTED.commercial);

  const agree2of3Weeks = await computeEngineStrategyWeeks("agree_2of3", weeks);
  const agree2of3NoCommWeeks = await computeEngineStrategyWeeks("agree_2of3_nocomm", weeks);
  const tieredV3Weeks = await computeEngineStrategyWeeks("tiered_v3", weeks);
  const tiered3NoCommWeeks = await computeEngineStrategyWeeks("tiered_3_nocomm", weeks);
  const selectorWeeks = await computeEngineStrategyWeeks(SELECTOR_ID, weeks);

  const composites: SystemResult[] = [
    buildEngineCompositeMetrics("agreement", "agree_2of3", "raw", "Agree 2-of-3 Raw", agree2of3Weeks, weekDataByWeek),
    buildEngineCompositeMetrics("agreement", "agree_2of3", "veto", "Agree 2-of-3 + Veto", agree2of3Weeks, weekDataByWeek),
    buildEngineCompositeMetrics("agreement", "agree_2of3", "tieveto", "Agree 2-of-3 + TieVeto", agree2of3Weeks, weekDataByWeek),
    buildEngineCompositeMetrics("agreement", "agree_2of3_nocomm", "raw", "Agree 2-of-3 NoComm Raw", agree2of3NoCommWeeks, weekDataByWeek),
    buildEngineCompositeMetrics("agreement", "agree_2of3_nocomm", "veto", "Agree 2-of-3 NoComm + Veto", agree2of3NoCommWeeks, weekDataByWeek),
    buildEngineCompositeMetrics("agreement", "agree_2of3_nocomm", "tieveto", "Agree 2-of-3 NoComm + TieVeto", agree2of3NoCommWeeks, weekDataByWeek),
    buildCustomCompositeMetrics("agreement", "agree_3of4", "raw", "Agree 3-of-4 Raw", weeks, weekDataByWeek, deriveAgree3of4),
    buildCustomCompositeMetrics("agreement", "agree_3of4", "veto", "Agree 3-of-4 + Veto", weeks, weekDataByWeek, deriveAgree3of4),
    buildCustomCompositeMetrics("agreement", "agree_3of4", "tieveto", "Agree 3-of-4 + TieVeto", weeks, weekDataByWeek, deriveAgree3of4),

    buildEngineCompositeMetrics("tiered", "tiered_v3", "raw", "Tiered V3 Raw", tieredV3Weeks, weekDataByWeek),
    buildEngineCompositeMetrics("tiered", "tiered_v3", "veto", "Tiered V3 + Veto", tieredV3Weeks, weekDataByWeek),
    buildEngineCompositeMetrics("tiered", "tiered_v3", "tieveto", "Tiered V3 + TieVeto", tieredV3Weeks, weekDataByWeek),
    buildEngineCompositeMetrics("tiered", "tiered_3_nocomm", "raw", "Tiered 3 NoComm Raw", tiered3NoCommWeeks, weekDataByWeek),
    buildEngineCompositeMetrics("tiered", "tiered_3_nocomm", "veto", "Tiered 3 NoComm + Veto", tiered3NoCommWeeks, weekDataByWeek),
    buildEngineCompositeMetrics("tiered", "tiered_3_nocomm", "tieveto", "Tiered 3 NoComm + TieVeto", tiered3NoCommWeeks, weekDataByWeek),
    buildCustomCompositeMetrics("tiered", "tiered_4", "raw", "Tiered 4 Raw", weeks, weekDataByWeek, deriveTiered4),
    buildCustomCompositeMetrics("tiered", "tiered_4", "veto", "Tiered 4 + Veto", weeks, weekDataByWeek, deriveTiered4),
    buildCustomCompositeMetrics("tiered", "tiered_4", "tieveto", "Tiered 4 + TieVeto", weeks, weekDataByWeek, deriveTiered4),

    buildEngineCompositeMetrics("selector", "selector", "raw", "Selector Raw", selectorWeeks, weekDataByWeek),
    buildEngineCompositeMetrics("selector", "selector", "veto", "Selector + Veto", selectorWeeks, weekDataByWeek),
    buildEngineCompositeMetrics("selector", "selector", "tieveto", "Selector + TieVeto", selectorWeeks, weekDataByWeek),
  ];

  verifyBaseline(
    "agree_2of3_nocomm",
    composites.find((row) => row.system === "agree_2of3_nocomm" && row.filter === "raw")!,
    BASELINE_EXPECTED.agree_2of3_nocomm,
  );

  const allRows = [...standalone, ...composites];

  const byFamily = {
    agreement: composites.filter((row) => row.family === "agreement"),
    tiered: composites.filter((row) => row.family === "tiered"),
    selector: composites.filter((row) => row.family === "selector"),
  };

  const standaloneBySource = {
    dealer: standalone.filter((row) => row.system === "Dealer"),
    sentiment: standalone.filter((row) => row.system === "Sentiment"),
    strength: standalone.filter((row) => row.system === "Strength"),
    commercial: standalone.filter((row) => row.system === "Commercial"),
  };

  const agreementWinner = sortRanking(byFamily.agreement)[0]!;
  const tieredWinner = sortRanking(byFamily.tiered)[0]!;
  const selectorWinner = sortRanking(byFamily.selector)[0]!;
  const standaloneWinners = {
    dealer: sortRanking(standaloneBySource.dealer)[0]!,
    sentiment: sortRanking(standaloneBySource.sentiment)[0]!,
    strength: sortRanking(standaloneBySource.strength)[0]!,
    commercial: sortRanking(standaloneBySource.commercial)[0]!,
  };

  const winnerModes = [
    agreementWinner.filter,
    tieredWinner.filter,
    selectorWinner.filter,
    standaloneWinners.dealer.filter,
    standaloneWinners.sentiment.filter,
    standaloneWinners.strength.filter,
    standaloneWinners.commercial.filter,
  ];
  const uniqueWinnerModes = Array.from(new Set(winnerModes));
  const universalConclusion = uniqueWinnerModes.length === 1
    ? `All family/source winners prefer \`${uniqueWinnerModes[0]}\`, so that mode is a plausible canonical candidate.`
    : `Winner modes diverge (${uniqueWinnerModes.join(", ")}), so veto should not be treated as universally canonical from this sweep alone. Filter 2 remains the cleaner place unless the live-layer follow-up converges further.`;

  const ranking = sortRanking(allRows);

  console.log(`\n${"═".repeat(96)}`);
  console.log("GRAND RANKING (losing weeks → DD → R/DD → WR)");
  console.log(`${"═".repeat(96)}`);
  ranking.forEach((row, index) => {
    const rdd = row.returnToDrawdown == null ? "∞" : row.returnToDrawdown.toFixed(2);
    console.log(
      `${String(index + 1).padStart(2)}. ${row.label.padEnd(28)} trades=${String(row.trades).padStart(4)} total=${signed(row.totalReturnPct).padStart(9)} dd=${row.maxDrawdownPct.toFixed(2).padStart(6)} r/dd=${rdd.padStart(6)} wr=${row.winRatePct.toFixed(1).padStart(6)} lw=${String(row.losingWeeks).padStart(2)} worst=${signed(row.worstWeekPct).padStart(8)}`,
    );
  });

  const markdown = [
    "# Composite Standardization Sweep Results",
    "",
    "Date: 2026-04-04",
    "",
    "## Baseline Verification",
    "",
    tableHeader(),
    tableDivider(),
    toTableRow(standaloneMap.get("dealer_raw")!),
    toTableRow(standaloneMap.get("sentiment_raw")!),
    toTableRow(standaloneMap.get("strength_raw")!),
    toTableRow(standaloneMap.get("commercial_raw")!),
    toTableRow(composites.find((row) => row.system === "agree_2of3_nocomm" && row.filter === "raw")!),
    "",
    formatDecisionTable("Agreement Winner", byFamily.agreement),
    formatDecisionTable("Tiered Winner", byFamily.tiered),
    formatDecisionTable("Selector Winner", byFamily.selector),
    formatDecisionTable("Standalone Filter Winners", standalone),
    "## Veto Universality Analysis",
    "",
    `- Agreement winner: \`${agreementWinner.label}\``,
    `- Tiered winner: \`${tieredWinner.label}\``,
    `- Selector winner: \`${selectorWinner.label}\``,
    `- Dealer winner: \`${standaloneWinners.dealer.label}\``,
    `- Sentiment winner: \`${standaloneWinners.sentiment.label}\``,
    `- Strength winner: \`${standaloneWinners.strength.label}\``,
    `- Commercial winner: \`${standaloneWinners.commercial.label}\``,
    "",
    universalConclusion,
    "",
    "## Grand Ranking",
    "",
    tableHeader(),
    tableDivider(),
    ...ranking.map(toTableRow),
    "",
    "## Recommendation",
    "",
    `- Agreement winner: \`${agreementWinner.label}\``,
    `- Tiered winner: \`${tieredWinner.label}\``,
    `- Selector winner: \`${selectorWinner.label}\``,
    `- Standalone source winners: dealer \`${standaloneWinners.dealer.filter}\`, sentiment \`${standaloneWinners.sentiment.filter}\`, strength \`${standaloneWinners.strength.filter}\`, commercial \`${standaloneWinners.commercial.filter}\``,
    `- Universal filter verdict: ${universalConclusion}`,
    "",
  ].join("\n");

  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, markdown, "utf8");
  console.log(`\nSaved markdown report: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
