/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-top-composite-live-layering.ts
 *
 * Description:
 * Focused execution-layer test for the top composite weekly-hold candidates.
 * Applies the same single-entry and additive management used in prior prop
 * account research.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { appendFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { listDataSectionWeeks, deriveCotReportDate } from "../src/lib/dataSectionWeeks";
import { getCanonicalBars, type CanonicalPriceBar } from "../src/lib/canonicalPriceBars";
import { loadWeeklyAdrMap, getAdrPct, getTargetAdrPct } from "../src/lib/performance/adrLookup";
import { getCanonicalBasketWeek, filterByModel, nonNeutralSignals } from "../src/lib/performance/basketSource";
import { getEntryStyle, getStrategy, getStrengthGate, SELECTOR_SENTIMENT_OVERRIDE_STRATEGY_ID } from "../src/lib/performance/strategyConfig";
import { computeWeeklyHold, type WeeklyHoldTrade } from "../src/lib/performance/weeklyHoldEngine";
import { readWeeklyPairStrengths } from "../src/lib/strength/weeklyStrength";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";
import type { AssetClass } from "../src/lib/cotMarkets";
import { readSnapshot } from "../src/lib/cotStore";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { MarketSnapshot } from "../src/lib/cotTypes";
import { getAggregatesForWeekStartWithBackfill } from "../src/lib/sentiment/store";
import { sentimentDirectionFromAggregate } from "../src/lib/sentiment/daily";

loadEnvConfig(process.cwd());

type Direction = "LONG" | "SHORT";
type CandidateId =
  | "agree_2of3_nocomm_raw"
  | "selector_raw"
  | "selector_veto"
  | "selector_tieveto"
  | "selector_dealer_filter";

type PositionWeekData = {
  symbol: string;
  assetClass: string;
  direction: Direction;
  mondayEntryPrice: number;
  multiplier: number;
  bars: CanonicalPriceBar[];
};

type StrategyWeekInput = {
  weekOpenUtc: string;
  weekLabel: string;
  positions: PositionWeekData[];
  scaleFactor: number;
  maxDayCount: number;
};

type WeekResult = {
  weekOpenUtc: string;
  weekLabel: string;
  returnPct: number;
  hitTarget: boolean;
};

type Aggregate = {
  totalReturnPct: number;
  maxDrawdownPct: number;
  weeksHit1Pct: number;
  losingWeeks: number;
  worstWeekPct: number;
};

const OUTPUT_PATH = path.resolve(process.cwd(), "docs", "VETO_COMPOSITE_SWEEP_RESULTS_2026-04-04.md");
const DAILY_BAR_DAYS = 7;
const WEEKDAY_LAYER_LIMIT = 5;

const CANDIDATES: Array<{ id: CandidateId; label: string }> = [
  { id: "agree_2of3_nocomm_raw", label: "2-of-3 NoComm Raw" },
  { id: "selector_raw", label: "Selector Raw" },
  { id: "selector_veto", label: "Selector + Veto" },
  { id: "selector_tieveto", label: "Selector + TieVeto" },
  { id: "selector_dealer_filter", label: "Selector + Dealer Filter" },
];

function round(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function fmt(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function buildWeekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd");
}

function computeMaxDrawdown(weeklyReturns: number[]) {
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const weeklyReturn of weeklyReturns) {
    cumulative += weeklyReturn;
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.min(maxDrawdown, cumulative - peak);
  }
  return Math.abs(maxDrawdown);
}

function normalizeLean(net: number, long: number, short: number) {
  const total = long + short;
  return total > 0 ? net / total : 0;
}

function resolveCotTiebreaker(
  currencies: Record<string, MarketSnapshot>,
  assetClass: AssetClass,
  mode: "dealer" | "commercial",
) {
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
        result.set(pd.pair.toUpperCase(), Math.abs(baseLean) > Math.abs(quoteLean) ? "LONG" : "SHORT");
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

async function getClosedWeeks() {
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const weeks = await listDataSectionWeeks();
  return weeks.sort((a, b) => a.localeCompare(b)).filter((week) => week < currentWeekOpenUtc).slice(-10);
}

async function loadBarsForWeekSymbol(weekOpenUtc: string, symbol: string) {
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const fromUtc = weekOpen.minus({ days: 1 }).toUTC().toISO() ?? weekOpenUtc;
  const toUtc = weekOpen.plus({ days: DAILY_BAR_DAYS }).toUTC().toISO() ?? weekOpenUtc;
  const nextWeekOpenUtc = weekOpen.plus({ days: 7 }).toUTC().toISO() ?? weekOpenUtc;
  const bars = await getCanonicalBars(symbol, "1d", fromUtc, toUtc);
  return bars.filter((bar) => bar.barCloseUtc > weekOpenUtc && bar.barCloseUtc <= nextWeekOpenUtc);
}

function buildDailyPathFromMonday(
  trade: WeeklyHoldTrade,
  bars: CanonicalPriceBar[],
  multiplier: number,
) {
  if (trade.openPrice <= 0 || bars.length === 0) return [];
  return bars.map((bar) => {
    const rawPnl = ((bar.closePrice - trade.openPrice) / trade.openPrice) * 100;
    const directedPnl = trade.direction === "SHORT" ? -rawPnl : rawPnl;
    return directedPnl * multiplier;
  });
}

function sumPaths(paths: number[][]) {
  const maxLen = Math.max(0, ...paths.map((path) => path.length));
  const result: number[] = [];
  for (let index = 0; index < maxLen; index += 1) {
    let value = 0;
    for (const path of paths) {
      if (index < path.length) value += path[index]!;
      else if (path.length > 0) value += path[path.length - 1]!;
    }
    result.push(value);
  }
  return result;
}

function getBarAtOrLast(bars: CanonicalPriceBar[], dayIndex: number) {
  if (bars.length === 0) return null;
  return dayIndex < bars.length ? bars[dayIndex]! : bars[bars.length - 1]!;
}

function positionContributionAtDay(
  position: PositionWeekData,
  dayIndex: number,
  entryPrice: number,
  weekScaleFactor: number,
  fraction: number,
) {
  const bar = getBarAtOrLast(position.bars, dayIndex);
  if (!bar || entryPrice <= 0) return 0;
  const rawPnl = ((bar.closePrice - entryPrice) / entryPrice) * 100;
  const directedPnl = position.direction === "SHORT" ? -rawPnl : rawPnl;
  return directedPnl * position.multiplier * weekScaleFactor * fraction;
}

function entryPriceForLayer(position: PositionWeekData, dayIndex: number) {
  if (dayIndex === 0) return position.mondayEntryPrice;
  const bar = position.bars[dayIndex];
  return bar?.openPrice ?? null;
}

async function buildCandidateTradeSets(weeks: string[]) {
  const weeklyHold = getEntryStyle("weekly_hold")!;
  const adrOverlay = getStrengthGate("adr_normalized")!;
  const agreeStrategy = getStrategy("agree_2of3_nocomm")!;
  const selectorStrategy = getStrategy(SELECTOR_SENTIMENT_OVERRIDE_STRATEGY_ID)!;

  const candidateWeeks = new Map<CandidateId, Map<string, WeeklyHoldTrade[]>>();
  for (const candidate of CANDIDATES) candidateWeeks.set(candidate.id, new Map());

  for (const weekOpenUtc of weeks) {
    const agree = await computeWeeklyHold(agreeStrategy, weekOpenUtc, weeklyHold, adrOverlay);
    const selector = await computeWeeklyHold(selectorStrategy, weekOpenUtc, weeklyHold, adrOverlay);
    const basketWeek = await getCanonicalBasketWeek(weekOpenUtc);
    const normalizedWeek = normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
    const reportDate = deriveCotReportDate(normalizedWeek);
    const dealer = new Map(nonNeutralSignals(filterByModel(basketWeek, "dealer")).map((s) => [s.symbol.toUpperCase(), s.direction as Direction]));
    const comm = new Map(nonNeutralSignals(filterByModel(basketWeek, "commercial")).map((s) => [s.symbol.toUpperCase(), s.direction as Direction]));
    const sent = new Map(nonNeutralSignals(filterByModel(basketWeek, "sentiment")).map((s) => [s.symbol.toUpperCase(), s.direction as Direction]));
    const strengthRows = await readWeeklyPairStrengths(weekOpenUtc);
    const str = new Map(strengthRows.filter((row) => row.compositeDirection !== "NEUTRAL").map((row) => [row.pair.toUpperCase(), row.compositeDirection]));
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
    const aggregates = await getAggregatesForWeekStartWithBackfill(open.toUTC().toISO()!, close.toUTC().toISO()!);
    const tieSent = new Map<string, Direction>();
    for (const agg of aggregates) {
      const pair = agg.symbol.toUpperCase();
      const dir = sentimentDirectionFromAggregate(agg);
      if (dir !== "NEUTRAL") tieSent.set(pair, dir);
      else if (agg.agg_long_pct !== 50) tieSent.set(pair, agg.agg_long_pct > 50 ? "SHORT" : "LONG");
    }
    const tieStr = new Map<string, Direction>();
    for (const row of strengthRows) {
      if (row.compositeDirection !== "NEUTRAL") tieStr.set(row.pair.toUpperCase(), row.compositeDirection);
      else if (row.compositeScore === 0) {
        const spreadSum = row.windows.reduce((sum, w) => sum + (w.signedSpread ?? 0), 0);
        if (spreadSum > 0) tieStr.set(row.pair.toUpperCase(), "LONG");
        else if (spreadSum < 0) tieStr.set(row.pair.toUpperCase(), "SHORT");
      }
    }

    const selectorRawTrades = selector.trades;
    const selectorVeto = selectorRawTrades.filter((trade) => {
      const pair = trade.symbol.toUpperCase();
      const votes = [dealer.get(pair), comm.get(pair), sent.get(pair), str.get(pair)];
      const opp = votes.filter((vote) => vote && vote !== trade.direction).length;
      return opp < 2;
    });
    const selectorTieVeto = selectorRawTrades.filter((trade) => {
      const pair = trade.symbol.toUpperCase();
      const votes = [tieDealer.get(pair), tieComm.get(pair), tieSent.get(pair), tieStr.get(pair)];
      const opp = votes.filter((vote) => vote && vote !== trade.direction).length;
      return opp < 2;
    });
    const selectorDealerFilter = selectorRawTrades.filter((trade) => dealer.has(trade.symbol.toUpperCase()));

    candidateWeeks.get("agree_2of3_nocomm_raw")!.set(weekOpenUtc, agree.trades);
    candidateWeeks.get("selector_raw")!.set(weekOpenUtc, selectorRawTrades);
    candidateWeeks.get("selector_veto")!.set(weekOpenUtc, selectorVeto);
    candidateWeeks.get("selector_tieveto")!.set(weekOpenUtc, selectorTieVeto);
    candidateWeeks.get("selector_dealer_filter")!.set(weekOpenUtc, selectorDealerFilter);
  }

  return candidateWeeks;
}

async function buildWeekInputs(weeks: string[], tradesByCandidate: Map<CandidateId, Map<string, WeeklyHoldTrade[]>>) {
  const allSymbols = new Set<string>();
  for (const weekMap of tradesByCandidate.values()) {
    for (const weekTrades of weekMap.values()) {
      for (const trade of weekTrades) allSymbols.add(trade.symbol.toUpperCase());
    }
  }

  const barsByWeekSymbol = new Map<string, CanonicalPriceBar[]>();
  const adrByWeek = new Map<string, Awaited<ReturnType<typeof loadWeeklyAdrMap>>>();
  for (const weekOpenUtc of weeks) {
    adrByWeek.set(weekOpenUtc, await loadWeeklyAdrMap(weekOpenUtc));
    for (const symbol of allSymbols) {
      barsByWeekSymbol.set(`${weekOpenUtc}:${symbol}`, await loadBarsForWeekSymbol(weekOpenUtc, symbol));
    }
  }

  const inputsByCandidate = new Map<CandidateId, StrategyWeekInput[]>();
  for (const candidate of CANDIDATES) {
    const weekInputs: StrategyWeekInput[] = [];
    for (const weekOpenUtc of weeks) {
      const trades = tradesByCandidate.get(candidate.id)!.get(weekOpenUtc) ?? [];
      const adrMap = adrByWeek.get(weekOpenUtc)!;
      const positions = trades.map((trade) => {
        const bars = barsByWeekSymbol.get(`${weekOpenUtc}:${trade.symbol.toUpperCase()}`) ?? [];
        const multiplier = getTargetAdrPct() / getAdrPct(adrMap, trade.symbol, trade.assetClass);
        return {
          symbol: trade.symbol.toUpperCase(),
          assetClass: trade.assetClass,
          direction: trade.direction,
          mondayEntryPrice: trade.openPrice,
          multiplier,
          bars,
        } satisfies PositionWeekData;
      });

      const unscaledMondayPaths = trades.map((trade) => {
        const position = positions.find((item) => item.symbol === trade.symbol.toUpperCase())!;
        return buildDailyPathFromMonday(trade, position.bars, position.multiplier);
      });
      const reconstructedPath = sumPaths(unscaledMondayPaths);
      const engineFridayReturnPct = trades.reduce((sum, trade) => sum + trade.returnPct, 0);
      const reconstructedFridayReturnPct =
        reconstructedPath.length > 0 ? reconstructedPath[reconstructedPath.length - 1]! : engineFridayReturnPct;
      const scaleFactor =
        Math.abs(reconstructedFridayReturnPct) > 1e-9
          ? engineFridayReturnPct / reconstructedFridayReturnPct
          : 1;

      weekInputs.push({
        weekOpenUtc,
        weekLabel: buildWeekLabel(weekOpenUtc),
        positions,
        scaleFactor,
        maxDayCount: Math.max(0, ...positions.map((position) => position.bars.length)),
      });
    }
    inputsByCandidate.set(candidate.id, weekInputs);
  }

  return inputsByCandidate;
}

function simulateWeek(
  week: StrategyWeekInput,
  fractions: number[],
  trailActivation: number,
  trailDistance: number,
  safetyThreshold: number | null,
): WeekResult {
  const layers: Array<{ dayEntered: number; fraction: number }> = [];
  const dailyTotals: number[] = [];
  let priorClosePnl = 0;
  let trailActive = false;
  let peak = Number.NEGATIVE_INFINITY;
  let exitReturnPct = 0;
  const decisionDays = Math.min(WEEKDAY_LAYER_LIMIT, week.maxDayCount, fractions.length);

  for (let dayIndex = 0; dayIndex < week.maxDayCount; dayIndex += 1) {
    if (!trailActive && dayIndex < decisionDays) {
      const fraction = fractions[dayIndex]!;
      const allowLayer = dayIndex === 0 || safetyThreshold == null || priorClosePnl >= safetyThreshold;
      if (allowLayer) {
        const hasData = week.positions.some((position) => entryPriceForLayer(position, dayIndex) != null);
        if (hasData) layers.push({ dayEntered: dayIndex, fraction });
      }
    }

    const actualTotal = layers.reduce((sum, layer) => {
      return sum + week.positions.reduce((layerSum, position) => {
        const entryPrice = entryPriceForLayer(position, layer.dayEntered);
        if (entryPrice == null) return layerSum;
        return layerSum + positionContributionAtDay(position, dayIndex, entryPrice, week.scaleFactor, layer.fraction);
      }, 0);
    }, 0);

    dailyTotals.push(actualTotal);
    priorClosePnl = actualTotal;

    if (!trailActive && actualTotal >= trailActivation) {
      trailActive = true;
      peak = actualTotal;
      continue;
    }

    if (trailActive) {
      peak = Math.max(peak, actualTotal);
      const stopLevel = peak - trailDistance;
      if (actualTotal <= stopLevel) {
        exitReturnPct = stopLevel;
        return {
          weekOpenUtc: week.weekOpenUtc,
          weekLabel: week.weekLabel,
          returnPct: round(exitReturnPct),
          hitTarget: exitReturnPct >= 1,
        };
      }
    }
  }

  exitReturnPct = dailyTotals.length > 0 ? dailyTotals[dailyTotals.length - 1]! : 0;
  return {
    weekOpenUtc: week.weekOpenUtc,
    weekLabel: week.weekLabel,
    returnPct: round(exitReturnPct),
    hitTarget: exitReturnPct >= 1,
  };
}

function aggregate(results: WeekResult[]): Aggregate {
  const returns = results.map((week) => week.returnPct);
  return {
    totalReturnPct: round(returns.reduce((sum, value) => sum + value, 0)),
    maxDrawdownPct: round(computeMaxDrawdown(returns)),
    weeksHit1Pct: round(results.filter((week) => week.hitTarget).length / results.length * 100, 1),
    losingWeeks: results.filter((week) => week.returnPct < 0).length,
    worstWeekPct: round(Math.min(...returns)),
  };
}

async function main() {
  console.log("=== Top Composite Live Layering ===");

  const weeks = await getClosedWeeks();
  const tradesByCandidate = await buildCandidateTradeSets(weeks);
  const inputsByCandidate = await buildWeekInputs(weeks, tradesByCandidate);

  const rows: Array<{
    label: string;
    mode: string;
    metrics: Aggregate;
  }> = [];

  for (const candidate of CANDIDATES) {
    const inputs = inputsByCandidate.get(candidate.id)!;
    const single = inputs.map((week) => simulateWeek(week, [1 / 5], 1.0, 0.5, null));
    const additive = inputs.map((week) => simulateWeek(week, [1 / 5, 1 / 10, 1 / 10], 1.25, 0.5, -1));
    rows.push({ label: candidate.label, mode: "Single 1/5 TR1/0.5", metrics: aggregate(single) });
    rows.push({ label: candidate.label, mode: "Additive P2 TR1.25/0.5 S1", metrics: aggregate(additive) });
  }

  rows.sort((a, b) => {
    if (a.metrics.losingWeeks !== b.metrics.losingWeeks) return a.metrics.losingWeeks - b.metrics.losingWeeks;
    if (a.metrics.maxDrawdownPct !== b.metrics.maxDrawdownPct) return a.metrics.maxDrawdownPct - b.metrics.maxDrawdownPct;
    return b.metrics.totalReturnPct - a.metrics.totalReturnPct;
  });

  console.log("");
  for (const row of rows) {
    console.log(
      `${row.label.padEnd(24)} | ${row.mode.padEnd(24)} | total=${fmt(row.metrics.totalReturnPct).padStart(8)} dd=${row.metrics.maxDrawdownPct.toFixed(2).padStart(6)} hit1=${row.metrics.weeksHit1Pct.toFixed(1).padStart(6)}% lw=${String(row.metrics.losingWeeks).padStart(2)} worst=${fmt(row.metrics.worstWeekPct).padStart(8)}`,
    );
  }

  const md: string[] = [];
  md.push("");
  md.push("## Addendum — Top Composite Systems Under Live Execution");
  md.push("");
  md.push("| System | Execution | Total % | Max DD % | Weeks Hit >=1% | Losing Weeks | Worst Week % |");
  md.push("|---|---|---:|---:|---:|---:|---:|");
  for (const row of rows) {
    md.push(
      `| ${row.label} | ${row.mode} | ${fmt(row.metrics.totalReturnPct)} | ${row.metrics.maxDrawdownPct.toFixed(2)}% | ${row.metrics.weeksHit1Pct.toFixed(1)}% | ${row.metrics.losingWeeks} | ${fmt(row.metrics.worstWeekPct)} |`,
    );
  }
  appendFileSync(OUTPUT_PATH, `${md.join("\n")}\n`, "utf8");
  console.log(`\nAppended live-execution addendum to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
