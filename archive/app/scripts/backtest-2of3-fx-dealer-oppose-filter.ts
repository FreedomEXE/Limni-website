/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-2of3-fx-dealer-oppose-filter.ts
 *
 * Description:
 * Tests a narrow refinement on 2-of-3 NoComm: remove only the FX trades
 * where sentiment + strength agree but dealer actively opposes.
 *
 * Compares:
 *   1. Weekly-hold ADR-normalized baseline vs filtered
 *   2. Single-entry scaled execution (1/5 + TR 1/0.5)
 *   3. Current live additive candidate (1/5 + Tue/Wed 1/10 + TR 1.25/0.5 + S1)
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { DateTime } from "luxon";

import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getCanonicalBasketWeek, filterByModel, nonNeutralSignals } from "../src/lib/performance/basketSource";
import { readWeeklyPairStrengths } from "../src/lib/strength/weeklyStrength";
import { getDisplayWeekOpenUtc } from "../src/lib/weekAnchor";
import { getEntryStyle, getStrategy, getStrengthGate, type StrengthGateConfig } from "../src/lib/performance/strategyConfig";
import { computeWeeklyHold, type WeeklyHoldResult, type WeeklyHoldTrade } from "../src/lib/performance/weeklyHoldEngine";
import { getCanonicalBars, type CanonicalPriceBar } from "../src/lib/canonicalPriceBars";
import { loadWeeklyAdrMap, getAdrPct, getTargetAdrPct } from "../src/lib/performance/adrLookup";

type Direction = "LONG" | "SHORT";
type AgreementTag = "ALL_THREE" | "DEALER_SENTIMENT" | "DEALER_STRENGTH" | "SS_DEALER_ABSENT" | "SS_DEALER_OPPOSING";
type ExitReason = "hold" | "trail";

type TradeWithTag = WeeklyHoldTrade & {
  tag: AgreementTag;
  weekOpenUtc: string;
};

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
  dailyChanges: number[];
  hitTarget: boolean;
  layersUsed: number;
};

type AggregateMetrics = {
  totalReturnPct: number;
  maxDrawdownPct: number;
  returnToDrawdown: number | null;
  weeksHit1Pct: number;
  losingWeeks: number;
  worstWeekPct: number;
  worstEodDayProxyPct: number;
  avgLayersUsed: number;
};

const STRATEGY_ID = "agree_2of3_nocomm";
const DAILY_BAR_DAYS = 7;
const LIVE_PLAN_FRACTIONS = [1 / 5, 1 / 10, 1 / 10];
const LIVE_TRAIL = { activation: 1.25, distance: 0.5 };
const LIVE_SAFETY = -1;
const SINGLE_PLAN_FRACTIONS = [1 / 5];
const SINGLE_TRAIL = { activation: 1.0, distance: 0.5 };

function fmt(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function fmtR(v: number | null) {
  return typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(1)}x` : "∞";
}

function round(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
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
  return maxDrawdown;
}

function dailyChangesFromPath(path: number[]) {
  const changes: number[] = [];
  let prev = 0;
  for (const value of path) {
    changes.push(value - prev);
    prev = value;
  }
  return changes;
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

function entryPriceForLayer(position: PositionWeekData, dayIndex: number) {
  if (dayIndex === 0) return position.mondayEntryPrice;
  const bar = position.bars[dayIndex];
  return bar?.openPrice ?? null;
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

function aggregateResults(weekly: WeekResult[]): AggregateMetrics {
  const returns = weekly.map((week) => week.returnPct);
  const totalReturnPct = returns.reduce((sum, value) => sum + value, 0);
  const maxDrawdownPct = computeMaxDrawdown(returns);
  return {
    totalReturnPct: round(totalReturnPct),
    maxDrawdownPct: round(maxDrawdownPct),
    returnToDrawdown: maxDrawdownPct < 0 ? round(totalReturnPct / Math.abs(maxDrawdownPct), 2) : null,
    weeksHit1Pct: weekly.filter((week) => week.hitTarget).length,
    losingWeeks: weekly.filter((week) => week.returnPct < 0).length,
    worstWeekPct: round(Math.min(0, ...returns)),
    worstEodDayProxyPct: round(
      weekly.reduce((minValue, week) => Math.min(minValue, ...(week.dailyChanges.length > 0 ? week.dailyChanges : [0])), 0),
    ),
    avgLayersUsed: round(weekly.reduce((sum, week) => sum + week.layersUsed, 0) / weekly.length, 2),
  };
}

function printMetrics(label: string, metrics: AggregateMetrics) {
  console.log(
    `${label.padEnd(28)} ${fmt(metrics.totalReturnPct).padEnd(10)} DD ${fmt(metrics.maxDrawdownPct).padEnd(10)} R/DD ${fmtR(metrics.returnToDrawdown).padEnd(8)} Hit>=1 ${String(metrics.weeksHit1Pct).padEnd(3)} Lose ${String(metrics.losingWeeks).padEnd(3)} Worst ${fmt(metrics.worstWeekPct).padEnd(10)} WorstDay ${fmt(metrics.worstEodDayProxyPct).padEnd(10)} AvgLayers ${metrics.avgLayersUsed.toFixed(2)}`,
  );
}

function detectTag(
  direction: Direction,
  dealer: Direction | null,
  sentiment: Direction | null,
  strength: Direction | null,
): AgreementTag {
  const deAgrees = dealer === direction;
  const seAgrees = sentiment === direction;
  const stAgrees = strength === direction;
  if (deAgrees && seAgrees && stAgrees) return "ALL_THREE";
  if (deAgrees && seAgrees) return "DEALER_SENTIMENT";
  if (deAgrees && stAgrees) return "DEALER_STRENGTH";
  if (dealer === null) return "SS_DEALER_ABSENT";
  return "SS_DEALER_OPPOSING";
}

async function getClosedWeeks() {
  return listDataSectionWeeks().then((weeks) => {
    const currentWeekOpenUtc = getDisplayWeekOpenUtc();
    return weeks
      .sort((left, right) => left.localeCompare(right))
      .filter((week) => week < currentWeekOpenUtc)
      .slice(-10);
  });
}

async function buildTaggedWeekResult(
  weekOpenUtc: string,
  weeklyHoldEntry: ReturnType<typeof getEntryStyle>,
  adrOverlay: StrengthGateConfig,
) {
  const strategy = getStrategy(STRATEGY_ID);
  if (!strategy || !weeklyHoldEntry) {
    throw new Error("Missing strategy or weekly hold entry.");
  }

  const baseWeek = await computeWeeklyHold(strategy, weekOpenUtc, weeklyHoldEntry, adrOverlay);
  const basketWeek = await getCanonicalBasketWeek(weekOpenUtc);
  const dealerSignals = nonNeutralSignals(filterByModel(basketWeek, "dealer"));
  const sentimentSignals = nonNeutralSignals(filterByModel(basketWeek, "sentiment"));
  const strengthRows = await readWeeklyPairStrengths(weekOpenUtc);

  const dealerMap = new Map<string, Direction>();
  for (const s of dealerSignals) dealerMap.set(s.symbol.toUpperCase(), s.direction as Direction);
  const sentMap = new Map<string, Direction>();
  for (const s of sentimentSignals) sentMap.set(s.symbol.toUpperCase(), s.direction as Direction);
  const strengthMap = new Map<string, Direction>();
  for (const row of strengthRows) {
    if (row.compositeDirection !== "NEUTRAL") {
      strengthMap.set(row.pair.toUpperCase(), row.compositeDirection);
    }
  }

  const taggedTrades: TradeWithTag[] = baseWeek.trades.map((trade) => ({
    ...trade,
    weekOpenUtc,
    tag: detectTag(
      trade.direction,
      dealerMap.get(trade.symbol.toUpperCase()) ?? null,
      sentMap.get(trade.symbol.toUpperCase()) ?? null,
      strengthMap.get(trade.symbol.toUpperCase()) ?? null,
    ),
  }));

  return { baseWeek, taggedTrades };
}

async function buildWeekInputFromTrades(
  weekOpenUtc: string,
  weekLabel: string,
  trades: WeeklyHoldTrade[],
) {
  const adrMap = await loadWeeklyAdrMap(weekOpenUtc);
  const positions: PositionWeekData[] = [];

  for (const trade of trades) {
    const bars = await loadBarsForWeekSymbol(weekOpenUtc, trade.symbol.toUpperCase());
    const multiplier = getTargetAdrPct() / getAdrPct(adrMap, trade.symbol, trade.assetClass);
    positions.push({
      symbol: trade.symbol.toUpperCase(),
      assetClass: trade.assetClass,
      direction: trade.direction,
      mondayEntryPrice: trade.openPrice,
      multiplier,
      bars,
    });
  }

  const unscaledMondayPaths = trades.map((trade) => {
    const position = positions.find((item) => item.symbol === trade.symbol.toUpperCase())!;
    return buildDailyPathFromMonday(trade, position.bars, position.multiplier);
  });
  const reconstructedPath = sumPaths(unscaledMondayPaths);
  const targetFridayReturnPct = trades.reduce((sum, trade) => sum + trade.returnPct, 0);
  const reconstructedFridayReturnPct =
    reconstructedPath.length > 0 ? reconstructedPath[reconstructedPath.length - 1]! : targetFridayReturnPct;
  const scaleFactor =
    Math.abs(reconstructedFridayReturnPct) > 1e-9
      ? targetFridayReturnPct / reconstructedFridayReturnPct
      : 1;

  return {
    weekOpenUtc,
    weekLabel,
    positions,
    scaleFactor,
    maxDayCount: Math.max(0, ...positions.map((position) => position.bars.length)),
  } satisfies StrategyWeekInput;
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
  let exitReason: ExitReason = "hold";
  let exitDay: number | null = null;
  let exitReturnPct = 0;

  const decisionDays = Math.min(5, week.maxDayCount, fractions.length);

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
        exitReason = "trail";
        exitDay = dayIndex;
        exitReturnPct = stopLevel;
        break;
      }
    }
  }

  if (exitDay == null) {
    exitReturnPct = dailyTotals.length > 0 ? dailyTotals[dailyTotals.length - 1]! : 0;
  }

  const rawExitTotal = exitDay == null
    ? (dailyTotals.length > 0 ? dailyTotals[dailyTotals.length - 1]! : 0)
    : (dailyTotals[exitDay] ?? exitReturnPct);
  const exitScale = exitReason === "trail" && Math.abs(rawExitTotal) > 1e-9 ? exitReturnPct / rawExitTotal : 1;

  const managedPath =
    exitDay == null
      ? dailyTotals
      : dailyTotals.map((value, index) => (index <= exitDay ? value : exitReturnPct));

  return {
    weekOpenUtc: week.weekOpenUtc,
    weekLabel: week.weekLabel,
    returnPct: round(exitReturnPct),
    dailyChanges: dailyChangesFromPath(managedPath).map((value) => round(value * exitScale)),
    hitTarget: exitReturnPct >= 1,
    layersUsed: layers.length,
  };
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║  2-of-3 NoComm — FX SS dealer-opposing filter test                ║");
  console.log("╚══════════════════════════════════════════════════════════════════════╝");

  const weeklyHoldEntry = getEntryStyle("weekly_hold");
  const adrOverlay = getStrengthGate("adr_normalized");
  if (!weeklyHoldEntry || !adrOverlay) {
    throw new Error("Missing weekly_hold or adr_normalized config.");
  }

  const weeks = await getClosedWeeks();
  const baselineWeekly: WeeklyHoldResult[] = [];
  const filteredWeekly: WeeklyHoldResult[] = [];
  const removedTrades: TradeWithTag[] = [];

  for (const weekOpenUtc of weeks) {
    const { baseWeek, taggedTrades } = await buildTaggedWeekResult(weekOpenUtc, weeklyHoldEntry, adrOverlay);
    const removed = taggedTrades.filter((trade) => trade.assetClass === "fx" && trade.tag === "SS_DEALER_OPPOSING");
    const keptTrades = taggedTrades.filter((trade) => !removed.includes(trade));

    removedTrades.push(...removed);
    baselineWeekly.push(baseWeek);
    filteredWeekly.push({
      ...baseWeek,
      trades: keptTrades,
      totalReturnPct: keptTrades.reduce((sum, trade) => sum + trade.returnPct, 0),
      winCount: keptTrades.filter((trade) => trade.returnPct > 0).length,
      lossCount: keptTrades.filter((trade) => trade.returnPct <= 0).length,
      winRate: keptTrades.length > 0 ? (keptTrades.filter((trade) => trade.returnPct > 0).length / keptTrades.length) * 100 : 0,
      tradeCount: keptTrades.length,
      signals: baseWeek.signals.filter((signal) => !removed.some((trade) => trade.symbol === signal.symbol)),
    });
  }

  const removedTotal = removedTrades.reduce((sum, trade) => sum + trade.returnPct, 0);
  const removedFx = removedTrades.filter((trade) => trade.assetClass === "fx");

  console.log(`\nRemoved trades: ${removedTrades.length}`);
  console.log(`  FX SS_DEALER_OPPOSING total removed return: ${fmt(round(removedTotal))}`);
  console.log(`  Removed win rate: ${removedTrades.length > 0 ? ((removedTrades.filter((t) => t.returnPct > 0).length / removedTrades.length) * 100).toFixed(1) : "0.0"}%`);

  const weeklyHoldBaseline = aggregateResults(
    baselineWeekly.map((week) => ({
      weekOpenUtc: week.weekOpenUtc,
      weekLabel: buildWeekLabel(week.weekOpenUtc),
      returnPct: week.totalReturnPct,
      dailyChanges: [week.totalReturnPct],
      hitTarget: week.totalReturnPct >= 1,
      layersUsed: 1,
    })),
  );
  const weeklyHoldFiltered = aggregateResults(
    filteredWeekly.map((week) => ({
      weekOpenUtc: week.weekOpenUtc,
      weekLabel: buildWeekLabel(week.weekOpenUtc),
      returnPct: week.totalReturnPct,
      dailyChanges: [week.totalReturnPct],
      hitTarget: week.totalReturnPct >= 1,
      layersUsed: 1,
    })),
  );

  console.log("\nWeekly-hold ADR-normalized");
  printMetrics("Baseline 2-of-3 NoComm", weeklyHoldBaseline);
  printMetrics("Filtered FX SS oppose", weeklyHoldFiltered);

  const baselineWeekInputs: StrategyWeekInput[] = [];
  const filteredWeekInputs: StrategyWeekInput[] = [];
  for (let index = 0; index < weeks.length; index += 1) {
    const weekOpenUtc = weeks[index]!;
    const weekLabel = buildWeekLabel(weekOpenUtc);
    baselineWeekInputs.push(await buildWeekInputFromTrades(weekOpenUtc, weekLabel, baselineWeekly[index]!.trades));
    filteredWeekInputs.push(await buildWeekInputFromTrades(weekOpenUtc, weekLabel, filteredWeekly[index]!.trades));
  }

  const singleBaselineWeeks = baselineWeekInputs.map((week) =>
    simulateWeek(week, SINGLE_PLAN_FRACTIONS, SINGLE_TRAIL.activation, SINGLE_TRAIL.distance, null),
  );
  const singleFilteredWeeks = filteredWeekInputs.map((week) =>
    simulateWeek(week, SINGLE_PLAN_FRACTIONS, SINGLE_TRAIL.activation, SINGLE_TRAIL.distance, null),
  );
  const additiveBaselineWeeks = baselineWeekInputs.map((week) =>
    simulateWeek(week, LIVE_PLAN_FRACTIONS, LIVE_TRAIL.activation, LIVE_TRAIL.distance, LIVE_SAFETY),
  );
  const additiveFilteredWeeks = filteredWeekInputs.map((week) =>
    simulateWeek(week, LIVE_PLAN_FRACTIONS, LIVE_TRAIL.activation, LIVE_TRAIL.distance, LIVE_SAFETY),
  );

  const singleBaseline = aggregateResults(singleBaselineWeeks);
  const singleFiltered = aggregateResults(singleFilteredWeeks);
  const additiveBaseline = aggregateResults(additiveBaselineWeeks);
  const additiveFiltered = aggregateResults(additiveFilteredWeeks);

  console.log("\nScaled execution — single 1/5 + TR 1/0.5");
  printMetrics("Baseline single", singleBaseline);
  printMetrics("Filtered single", singleFiltered);

  console.log("\nScaled execution — live additive P2 + TR 1.25/0.5 + S1");
  printMetrics("Baseline additive", additiveBaseline);
  printMetrics("Filtered additive", additiveFiltered);

  console.log("\nWeekly delta — additive filtered vs baseline");
  console.log("Week".padEnd(10), "Base".padEnd(10), "Filtered".padEnd(10), "Delta".padEnd(10), "Removed");
  console.log("-".repeat(55));
  for (let index = 0; index < weeks.length; index += 1) {
    const weekOpenUtc = weeks[index]!;
    const removedForWeek = removedFx.filter((trade) => trade.weekOpenUtc === weekOpenUtc);
    const delta = additiveFilteredWeeks[index]!.returnPct - additiveBaselineWeeks[index]!.returnPct;
    console.log(
      buildWeekLabel(weekOpenUtc).padEnd(10),
      fmt(additiveBaselineWeeks[index]!.returnPct).padEnd(10),
      fmt(additiveFilteredWeeks[index]!.returnPct).padEnd(10),
      fmt(round(delta)).padEnd(10),
      String(removedForWeek.length),
    );
  }
}

main().catch((error) => {
  console.error("FX SS dealer-opposing filter test failed:", error);
  process.exit(1);
});
