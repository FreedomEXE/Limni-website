/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-source-canonicalization.ts
 *
 * Description:
 * Tests whether dealer, sentiment, and strength can be upgraded from
 * neutral-aware canonical sources into near-full-coverage canonical voters
 * using source-specific tiebreakers, and whether that improves composite
 * coherence enough to justify a source-layer redesign.
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
import { getAggregatesForWeekStartWithBackfill } from "../src/lib/sentiment/store";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import { computeWeeklyHold } from "../src/lib/performance/weeklyHoldEngine";
import { getEntryStyle, getStrategy } from "../src/lib/performance/strategyConfig";
import type { AssetClass } from "../src/lib/cotMarkets";
import type { MarketSnapshot } from "../src/lib/cotTypes";

loadEnvConfig(process.cwd());

type Direction = "LONG" | "SHORT";
type SourceId = "dealer" | "sentiment" | "strength" | "commercial";
type VersionId = "A" | "B";

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

type SourceMetrics = {
  source: SourceId;
  version: VersionId | "current";
  label: string;
  trades: number;
  avgTradesPerWeek: number;
  coveragePct: number;
  forcedPairs: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  returnToDrawdown: number | null;
  winRatePct: number;
  losingWeeks: number;
  worstWeekPct: number;
  weekly: WeeklyRow[];
};

type CompositeMetrics = {
  id: string;
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
  pairUniverse: Set<string>;
  dealerA: Map<string, Direction>;
  dealerB: Map<string, Direction>;
  sentimentA: Map<string, Direction>;
  sentimentB: Map<string, Direction>;
  strengthA: Map<string, Direction>;
  strengthB: Map<string, Direction>;
  commercial: Map<string, Direction>;
  strengthRows: WeeklyPairStrength[];
  getNormRet: (pair: string, direction: Direction, assetClass?: AssetClass) => number | null;
};

const OUTPUT_PATH = path.resolve(
  process.cwd(),
  "docs",
  "SOURCE_CANONICALIZATION_RESULTS_2026-04-04.md",
);

const BASELINE_EXPECTED = {
  dealer: { trades: 230, total: 73.18, dd: 2.19 },
  sentiment: { trades: 265, total: 92.4, dd: 19.56 },
  strength: { trades: 335, total: 80.89, dd: 14.98 },
  commercial: { trades: 360, total: 21.13, dd: 29.04 },
  agree_2of3_nocomm: { trades: 252, total: 115.6, dd: 12.85 },
  agree_2of3: { trades: 227, total: 104.68, dd: 8.41 },
  tiered_v3: { trades: 257, total: 111.51, dd: 6.22 },
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

function buildWeeklyMetrics(weekly: WeeklyRow[]) {
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
    trades,
    totalReturnPct: round(cumulative),
    maxDrawdownPct: round(maxDD),
    returnToDrawdown: maxDD > 0 ? round(cumulative / maxDD, 2) : null,
    winRatePct: round(trades > 0 ? (wins / trades) * 100 : 0),
    losingWeeks,
    worstWeekPct: round(worstWeek),
  };
}

function buildSourceMetrics(
  source: SourceId,
  version: VersionId | "current",
  label: string,
  weekly: WeeklyRow[],
  forcedPairs: number,
  weekCount: number,
  maxPossiblePairs: number,
): SourceMetrics {
  const summary = buildWeeklyMetrics(weekly);
  return {
    source,
    version,
    label,
    trades: summary.trades,
    avgTradesPerWeek: round(summary.trades / weekCount, 1),
    coveragePct: round((summary.trades / maxPossiblePairs) * 100, 1),
    forcedPairs,
    totalReturnPct: summary.totalReturnPct,
    maxDrawdownPct: summary.maxDrawdownPct,
    returnToDrawdown: summary.returnToDrawdown,
    winRatePct: summary.winRatePct,
    losingWeeks: summary.losingWeeks,
    worstWeekPct: summary.worstWeekPct,
    weekly,
  };
}

function buildCompositeMetrics(id: string, label: string, weekly: WeeklyRow[]): CompositeMetrics {
  const summary = buildWeeklyMetrics(weekly);
  return {
    id,
    label,
    trades: summary.trades,
    totalReturnPct: summary.totalReturnPct,
    maxDrawdownPct: summary.maxDrawdownPct,
    returnToDrawdown: summary.returnToDrawdown,
    winRatePct: summary.winRatePct,
    losingWeeks: summary.losingWeeks,
    worstWeekPct: summary.worstWeekPct,
    weekly,
  };
}

function verifyBaseline(name: string, actual: { trades: number; totalReturnPct: number; maxDrawdownPct: number }, expected: { trades: number; total: number; dd: number }) {
  const tradeOk = actual.trades === expected.trades;
  const totalOk = Math.abs(actual.totalReturnPct - expected.total) < 0.2;
  const ddOk = Math.abs(actual.maxDrawdownPct - expected.dd) < 0.2;
  if (!tradeOk || !totalOk || !ddOk) {
    throw new Error(
      `Baseline mismatch for ${name}: got trades=${actual.trades}, total=${actual.totalReturnPct}, dd=${actual.maxDrawdownPct}; expected ${JSON.stringify(expected)}`,
    );
  }
}

async function loadClosedWeeks() {
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const allWeeks = await listDataSectionWeeks();
  return allWeeks.sort((a, b) => a.localeCompare(b)).filter((w) => w < currentWeekOpenUtc);
}

function buildDealerTiebreakerMap(
  currencies: Record<string, MarketSnapshot>,
  assetClass: AssetClass,
): Map<string, Direction> {
  const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass] ?? [];
  const result = new Map<string, Direction>();

  for (const pd of pairDefs) {
    const base = currencies[pd.base];
    const quote = currencies[pd.quote];
    if (!base || !quote) continue;

    const baseNet = base.dealer_net;
    const quoteNet = quote.dealer_net;
    const baseLong = base.dealer_long;
    const baseShort = base.dealer_short;
    const quoteLong = quote.dealer_long;
    const quoteShort = quote.dealer_short;
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
        if (baseBias === "BULLISH") {
          if (baseLean > quoteLean) result.set(pd.pair.toUpperCase(), "LONG");
          else if (baseLean < quoteLean) result.set(pd.pair.toUpperCase(), "SHORT");
        } else {
          if (baseLean > quoteLean) result.set(pd.pair.toUpperCase(), "LONG");
          else if (baseLean < quoteLean) result.set(pd.pair.toUpperCase(), "SHORT");
        }
      } else if (baseBias === "NEUTRAL" || quoteBias === "NEUTRAL") {
        if (baseBias === "BULLISH" || quoteBias === "BEARISH") result.set(pd.pair.toUpperCase(), "LONG");
        else if (baseBias === "BEARISH" || quoteBias === "BULLISH") result.set(pd.pair.toUpperCase(), "SHORT");
        else if (baseLean > quoteLean) result.set(pd.pair.toUpperCase(), "LONG");
        else if (baseLean < quoteLean) result.set(pd.pair.toUpperCase(), "SHORT");
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

  const dealerA = new Map<string, Direction>();
  for (const signal of nonNeutralSignals(filterByModel(basketWeek, "dealer"))) {
    dealerA.set(signal.symbol.toUpperCase(), signal.direction as Direction);
  }

  const commercial = new Map<string, Direction>();
  for (const signal of nonNeutralSignals(filterByModel(basketWeek, "commercial"))) {
    commercial.set(signal.symbol.toUpperCase(), signal.direction as Direction);
  }

  const sentimentA = new Map<string, Direction>();
  for (const signal of nonNeutralSignals(filterByModel(basketWeek, "sentiment"))) {
    sentimentA.set(signal.symbol.toUpperCase(), signal.direction as Direction);
  }

  const strengthA = new Map<string, Direction>();
  for (const row of strengthRows) {
    if (row.compositeScore > 0) strengthA.set(row.pair.toUpperCase(), "LONG");
    else if (row.compositeScore < 0) strengthA.set(row.pair.toUpperCase(), "SHORT");
  }

  const dealerTieOnly = new Map<string, Direction>();
  for (const assetClass of ["fx", "indices", "commodities", "crypto"] as AssetClass[]) {
    const snapshot = await readSnapshot({ assetClass, reportDate });
    if (!snapshot) continue;
    for (const [pair, dir] of buildDealerTiebreakerMap(snapshot.currencies, assetClass)) {
      dealerTieOnly.set(pair.toUpperCase(), dir);
    }
  }
  const dealerB = new Map<string, Direction>(dealerA);
  for (const [pair, dir] of dealerTieOnly) {
    if (!dealerB.has(pair)) dealerB.set(pair, dir);
  }

  const open = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const close = open.plus({ days: 7 });
  const aggregates = await getAggregatesForWeekStartWithBackfill(
    open.toUTC().toISO()!,
    close.toUTC().toISO()!,
  );
  const sentimentB = new Map<string, Direction>(sentimentA);
  for (const agg of aggregates) {
    const pair = agg.symbol.toUpperCase();
    if (sentimentB.has(pair)) continue;
    if (agg.agg_long_pct > 50) sentimentB.set(pair, "SHORT");
    else if (agg.agg_long_pct < 50) sentimentB.set(pair, "LONG");
  }

  const strengthB = new Map<string, Direction>(strengthA);
  for (const row of strengthRows) {
    const pair = row.pair.toUpperCase();
    if (strengthB.has(pair)) continue;
    if (row.compositeScore === 0) {
      const spreadSum = row.windows.reduce((sum, w) => sum + (w.signedSpread ?? 0), 0);
      if (spreadSum > 0) strengthB.set(pair, "LONG");
      else if (spreadSum < 0) strengthB.set(pair, "SHORT");
    }
  }

  const pairUniverse = new Set<string>([
    ...weeklyReturns.map((row) => row.symbol.toUpperCase()),
    ...dealerB.keys(),
    ...sentimentB.keys(),
    ...strengthB.keys(),
    ...commercial.keys(),
  ]);

  return {
    weekOpenUtc,
    weekLabel,
    pairUniverse,
    dealerA,
    dealerB,
    sentimentA,
    sentimentB,
    strengthA,
    strengthB,
    commercial,
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

function buildCoverageGrid(weeks: string[], weekDataByWeek: Map<string, WeekData>) {
  return weeks.map((weekOpenUtc) => {
    const week = weekDataByWeek.get(weekOpenUtc)!;
    return {
      weekOpenUtc,
      weekLabel: week.weekLabel,
      dealerA: week.dealerA.size,
      dealerB: week.dealerB.size,
      sentimentA: week.sentimentA.size,
      sentimentB: week.sentimentB.size,
      strengthA: week.strengthA.size,
      strengthB: week.strengthB.size,
      commercial: week.commercial.size,
    };
  });
}

function buildSourceVersionMetrics(
  source: SourceId,
  version: VersionId | "current",
  label: string,
  weeks: string[],
  weekDataByWeek: Map<string, WeekData>,
  selectMap: (week: WeekData) => Map<string, Direction>,
  selectBaseline?: (week: WeekData) => Map<string, Direction>,
) {
  const weekly: WeeklyRow[] = [];
  let forcedPairs = 0;

  for (const weekOpenUtc of weeks) {
    const week = weekDataByWeek.get(weekOpenUtc)!;
    const map = selectMap(week);
    const baseline = selectBaseline ? selectBaseline(week) : null;
    const acc = emptyWeekAccumulator();

    for (const [pair, dir] of map) {
      if (baseline && !baseline.has(pair)) forcedPairs += 1;
      const ret = week.getNormRet(pair, dir, inferAssetClass(pair));
      if (ret !== null) addRet(acc, ret);
    }

    pushWeek(weekly, weekOpenUtc, week.weekLabel, acc);
  }

  return buildSourceMetrics(source, version, label, weekly, forcedPairs, weeks.length, 36 * weeks.length);
}

function buildAgreementMap(maps: Array<Map<string, Direction>>, threshold: number) {
  const result = new Map<string, Direction>();
  const allPairs = new Set<string>();
  for (const map of maps) {
    for (const pair of map.keys()) allPairs.add(pair);
  }

  for (const pair of allPairs) {
    let longCount = 0;
    let shortCount = 0;
    for (const map of maps) {
      const dir = map.get(pair);
      if (dir === "LONG") longCount += 1;
      else if (dir === "SHORT") shortCount += 1;
    }
    if (longCount >= threshold && longCount > shortCount) result.set(pair, "LONG");
    else if (shortCount >= threshold && shortCount > longCount) result.set(pair, "SHORT");
  }

  return result;
}

function buildTieredMap(maps: Array<Map<string, Direction>>) {
  const result = new Map<string, Direction>();
  const allPairs = new Set<string>();
  for (const map of maps) {
    for (const pair of map.keys()) allPairs.add(pair);
  }

  for (const pair of allPairs) {
    let longCount = 0;
    let shortCount = 0;
    for (const map of maps) {
      const dir = map.get(pair);
      if (dir === "LONG") longCount += 1;
      else if (dir === "SHORT") shortCount += 1;
    }
    if (longCount > shortCount && longCount >= 1) result.set(pair, "LONG");
    else if (shortCount > longCount && shortCount >= 1) result.set(pair, "SHORT");
  }

  return result;
}

function buildCustomCompositeMetrics(
  id: string,
  label: string,
  weeks: string[],
  weekDataByWeek: Map<string, WeekData>,
  buildDirections: (week: WeekData) => Map<string, Direction>,
) {
  const weekly: WeeklyRow[] = [];

  for (const weekOpenUtc of weeks) {
    const week = weekDataByWeek.get(weekOpenUtc)!;
    const map = buildDirections(week);
    const acc = emptyWeekAccumulator();

    for (const [pair, dir] of map) {
      const ret = week.getNormRet(pair, dir, inferAssetClass(pair));
      if (ret !== null) addRet(acc, ret);
    }

    pushWeek(weekly, weekOpenUtc, week.weekLabel, acc);
  }

  return buildCompositeMetrics(id, label, weekly);
}

async function computeEngineComposite(strategyId: string, weeks: string[], label: string) {
  const strategy = getStrategy(strategyId);
  const entry = getEntryStyle("weekly_hold");
  if (!strategy || !entry) throw new Error(`Missing strategy: ${strategyId}`);

  const weekly: WeeklyRow[] = [];
  for (const weekOpenUtc of weeks) {
    const result = await computeWeeklyHold(strategy, weekOpenUtc, entry);
    weekly.push({
      weekOpenUtc,
      weekLabel: buildWeekLabel(weekOpenUtc),
      returnPct: round(result.totalReturnPct),
      trades: result.tradeCount,
      wins: result.winCount,
      losses: result.lossCount,
    });
  }

  return buildCompositeMetrics(strategyId, label, weekly);
}

function assessDamage(base: SourceMetrics, candidate: SourceMetrics) {
  const deltaTotal = round(candidate.totalReturnPct - base.totalReturnPct);
  const deltaDd = round(candidate.maxDrawdownPct - base.maxDrawdownPct);
  const deltaWr = round(candidate.winRatePct - base.winRatePct, 1);
  const deltaTrades = candidate.trades - base.trades;

  const acceptable =
    deltaTotal >= -(Math.abs(base.totalReturnPct) * 0.15)
    && deltaDd <= 5
    && deltaWr >= -3;
  const concerning =
    !acceptable && (
      deltaTotal >= -(Math.abs(base.totalReturnPct) * 0.25)
      || deltaDd <= 8
      || deltaWr >= -5
    );

  return {
    deltaTotal,
    deltaDd,
    deltaWr,
    deltaTrades,
    verdict: acceptable ? "acceptable" : concerning ? "concerning" : "unacceptable",
  };
}

function toCoverageRow(metric: SourceMetrics) {
  return `| ${metric.source} | ${metric.version} | ${metric.trades} | ${metric.avgTradesPerWeek.toFixed(1)} | ${metric.coveragePct.toFixed(1)}% | ${metric.version === "A" || metric.version === "current" ? "—" : metric.forcedPairs} | ${signed(metric.totalReturnPct)} | ${metric.maxDrawdownPct.toFixed(2)}% | ${metric.returnToDrawdown == null ? "∞" : `${metric.returnToDrawdown.toFixed(2)}x`} | ${metric.winRatePct.toFixed(1)}% |`;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   Source Canonicalization (Coverage-First)                     ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  const weeks = await loadClosedWeeks();
  console.log(`\nWeeks: ${weeks.length} (${buildWeekLabel(weeks[0]!)} → ${buildWeekLabel(weeks.at(-1)!)})`);

  const weekDataEntries = await Promise.all(
    weeks.map(async (weekOpenUtc) => [weekOpenUtc, await buildWeekData(weekOpenUtc)] as const),
  );
  const weekDataByWeek = new Map(weekDataEntries);

  const dealerA = buildSourceVersionMetrics("dealer", "A", "Dealer [A] Std", weeks, weekDataByWeek, (week) => week.dealerA);
  const dealerB = buildSourceVersionMetrics("dealer", "B", "Dealer [B] Tie", weeks, weekDataByWeek, (week) => week.dealerB, (week) => week.dealerA);
  const sentimentA = buildSourceVersionMetrics("sentiment", "A", "Sentiment [A] Std", weeks, weekDataByWeek, (week) => week.sentimentA);
  const sentimentB = buildSourceVersionMetrics("sentiment", "B", "Sentiment [B] Tie", weeks, weekDataByWeek, (week) => week.sentimentB, (week) => week.sentimentA);
  const strengthA = buildSourceVersionMetrics("strength", "A", "Strength [A] Std", weeks, weekDataByWeek, (week) => week.strengthA);
  const strengthB = buildSourceVersionMetrics("strength", "B", "Strength [B] Tie", weeks, weekDataByWeek, (week) => week.strengthB, (week) => week.strengthA);
  const commercial = buildSourceVersionMetrics("commercial", "current", "Commercial Current", weeks, weekDataByWeek, (week) => week.commercial);

  verifyBaseline("dealer", dealerA, BASELINE_EXPECTED.dealer);
  verifyBaseline("sentiment", sentimentA, BASELINE_EXPECTED.sentiment);
  verifyBaseline("strength", strengthA, BASELINE_EXPECTED.strength);
  verifyBaseline("commercial", commercial, BASELINE_EXPECTED.commercial);

  const coverageMetrics = [dealerA, dealerB, sentimentA, sentimentB, strengthA, strengthB, commercial];
  const coverageGrid = buildCoverageGrid(weeks, weekDataByWeek);

  const agree2of3Engine = await computeEngineComposite("agree_2of3", weeks, "agree_2of3 [A] (engine)");
  const agree2of3NoCommEngine = await computeEngineComposite("agree_2of3_nocomm", weeks, "agree_2of3_nocomm [A] (engine)");
  const tieredV3Engine = await computeEngineComposite("tiered_v3", weeks, "tiered_v3 [A] (engine)");
  const tiered3NoCommEngine = await computeEngineComposite("tiered_3_nocomm", weeks, "tiered_3_nocomm [A] (engine)");

  verifyBaseline("agree_2of3", agree2of3Engine, BASELINE_EXPECTED.agree_2of3);
  verifyBaseline("agree_2of3_nocomm", agree2of3NoCommEngine, BASELINE_EXPECTED.agree_2of3_nocomm);
  verifyBaseline("tiered_v3", tieredV3Engine, BASELINE_EXPECTED.tiered_v3);

  const agree2of3B = buildCustomCompositeMetrics(
    "agree_2of3_b",
    "agree_2of3 [B]",
    weeks,
    weekDataByWeek,
    (week) => buildAgreementMap([week.dealerB, week.commercial, week.sentimentB], 2),
  );
  const agree2of3NoCommB = buildCustomCompositeMetrics(
    "agree_2of3_nocomm_b",
    "agree_2of3_nocomm [B]",
    weeks,
    weekDataByWeek,
    (week) => buildAgreementMap([week.dealerB, week.sentimentB, week.strengthB], 2),
  );
  const tieredV3B = buildCustomCompositeMetrics(
    "tiered_v3_b",
    "tiered_v3 [B]",
    weeks,
    weekDataByWeek,
    (week) => buildTieredMap([week.dealerB, week.commercial, week.sentimentB]),
  );
  const tiered3NoCommB = buildCustomCompositeMetrics(
    "tiered_3_nocomm_b",
    "tiered_3_nocomm [B]",
    weeks,
    weekDataByWeek,
    (week) => buildTieredMap([week.dealerB, week.sentimentB, week.strengthB]),
  );
  const agree2of4B = buildCustomCompositeMetrics(
    "agree_2of4_b",
    "2-of-4 Agree [B]",
    weeks,
    weekDataByWeek,
    (week) => buildAgreementMap([week.dealerB, week.commercial, week.sentimentB, week.strengthB], 2),
  );
  const agree3of4B = buildCustomCompositeMetrics(
    "agree_3of4_b",
    "3-of-4 Agree [B]",
    weeks,
    weekDataByWeek,
    (week) => buildAgreementMap([week.dealerB, week.commercial, week.sentimentB, week.strengthB], 3),
  );
  const tiered4B = buildCustomCompositeMetrics(
    "tiered_4_b",
    "Tiered 4 [B]",
    weeks,
    weekDataByWeek,
    (week) => buildTieredMap([week.dealerB, week.commercial, week.sentimentB, week.strengthB]),
  );

  const compositeRows = [
    agree2of3Engine,
    agree2of3B,
    agree2of3NoCommEngine,
    agree2of3NoCommB,
    tieredV3Engine,
    tieredV3B,
    tiered3NoCommEngine,
    tiered3NoCommB,
    agree2of4B,
    agree3of4B,
    tiered4B,
  ];

  console.log("\nCoverage summary:");
  for (const metric of coverageMetrics) {
    console.log(
      `${metric.label.padEnd(22)} trades=${String(metric.trades).padStart(4)} cov=${metric.coveragePct.toFixed(1).padStart(6)}% forced=${String(metric.forcedPairs).padStart(4)} total=${signed(metric.totalReturnPct).padStart(9)} dd=${metric.maxDrawdownPct.toFixed(2).padStart(6)}`,
    );
  }

  const damageRows = [
    { source: "Dealer", ...assessDamage(dealerA, dealerB) },
    { source: "Sentiment", ...assessDamage(sentimentA, sentimentB) },
    { source: "Strength", ...assessDamage(strengthA, strengthB) },
  ];

  const markdown = [
    "# Source Canonicalization Results",
    "",
    "Date: 2026-04-04",
    "",
    "## Coverage Table",
    "",
    "| Source | Version | Trades | Trades/Wk | Coverage% | Forced Pairs | Total% | MaxDD% | R/DD | Win% |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...coverageMetrics.map(toCoverageRow),
    "",
    "## Per-Week Coverage Grid",
    "",
    "| Week | D[A] | D[B] | S[A] | S[B] | Str[A] | Str[B] | Comm | Max |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...coverageGrid.map((row) => `| ${row.weekLabel} | ${row.dealerA} | ${row.dealerB} | ${row.sentimentA} | ${row.sentimentB} | ${row.strengthA} | ${row.strengthB} | ${row.commercial} | 36 |`),
    "",
    "## Standalone Damage Assessment",
    "",
    "| Source | Δ Total% | Δ MaxDD% | Δ Win% | Δ Trades | Verdict |",
    "|---|---:|---:|---:|---:|---|",
    ...damageRows.map((row) => `| ${row.source} | ${signed(row.deltaTotal)} | ${row.deltaDd >= 0 ? "+" : ""}${row.deltaDd.toFixed(2)}pp | ${row.deltaWr >= 0 ? "+" : ""}${row.deltaWr.toFixed(1)}pp | ${row.deltaTrades >= 0 ? "+" : ""}${row.deltaTrades} | ${row.verdict} |`),
    "",
    "## Composite Comparison",
    "",
    "| System | Trades | Total% | MaxDD% | R/DD | Win% | LW |",
    "|---|---:|---:|---:|---:|---:|---:|",
    ...compositeRows.map((row) => `| ${row.label} | ${row.trades} | ${signed(row.totalReturnPct)} | ${row.maxDrawdownPct.toFixed(2)}% | ${row.returnToDrawdown == null ? "∞" : `${row.returnToDrawdown.toFixed(2)}x`} | ${row.winRatePct.toFixed(1)}% | ${row.losingWeeks} |`),
    "",
    "## Decision Summary",
    "",
    `QUESTION 1: Does full coverage make composites cleaner?`,
    `→ Existing-family [B] comparisons: agree_2of3 ${signed(agree2of3B.totalReturnPct - agree2of3Engine.totalReturnPct)}, agree_2of3_nocomm ${signed(agree2of3NoCommB.totalReturnPct - agree2of3NoCommEngine.totalReturnPct)}, tiered_v3 ${signed(tieredV3B.totalReturnPct - tieredV3Engine.totalReturnPct)}, tiered_3_nocomm ${signed(tiered3NoCommB.totalReturnPct - tiered3NoCommEngine.totalReturnPct)}.`,
    "",
    "QUESTION 2: Which sources should be upgraded?",
    `→ Dealer: ${damageRows[0]!.verdict}`,
    `→ Sentiment: ${damageRows[1]!.verdict}`,
    `→ Strength: ${damageRows[2]!.verdict}`,
    "",
    "QUESTION 3: Is 4-source standardized better than current 3-source composites?",
    `→ 2-of-4 [B]: ${signed(agree2of4B.totalReturnPct)} | 3-of-4 [B]: ${signed(agree3of4B.totalReturnPct)} | Tiered 4 [B]: ${signed(tiered4B.totalReturnPct)}`,
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
