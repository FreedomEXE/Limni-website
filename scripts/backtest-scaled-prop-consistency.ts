/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-scaled-prop-consistency.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { DateTime } from "luxon";

import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getCanonicalBars, type CanonicalPriceBar } from "../src/lib/canonicalPriceBars";
import { loadWeeklyAdrMap, getAdrPct, getTargetAdrPct } from "../src/lib/performance/adrLookup";
import {
  getEntryStyle,
  getStrategy,
  getStrengthGate,
  type StrategyConfig,
} from "../src/lib/performance/strategyConfig";
import {
  computeMultiWeekHold,
  computeWeeklyHold,
  type WeeklyHoldResult,
  type WeeklyHoldTrade,
} from "../src/lib/performance/weeklyHoldEngine";
import { getDisplayWeekOpenUtc } from "../src/lib/weekAnchor";

type StrategyId = StrategyConfig["id"];
type ExitReason = "hold" | "tp" | "trail";
type ComboFamily = "baseline" | "trail" | "tp";
type ExitKind = "baseline" | "trail" | "tp";

type BaselinePosition = {
  symbol: string;
  assetClass: string;
  direction: "LONG" | "SHORT";
  rawReturnPct: number;
  adrPct: number;
  multiplier: number;
  normalizedReturnPct: number;
  dailyNormalizedPath: number[];
};

type StrategyWeekInput = {
  strategyId: StrategyId;
  strategyLabel: string;
  weekOpenUtc: string;
  weekLabel: string;
  trades: WeeklyHoldTrade[];
  positions: BaselinePosition[];
  basketDailyPath: number[];
  fridayReturnPct: number;
  tradeCount: number;
  assetBreakdownBaseline: Record<string, { returnPct: number; trades: number }>;
};

type ScaleConfig = {
  factor: number;
  label: string;
};

type ExitConfig = {
  family: ComboFamily;
  kind: ExitKind;
  label: string;
  activation?: number | null;
  distance?: number | null;
  tpLevel?: number | null;
};

type PairWeekDiagnostic = {
  pair: string;
  assetClass: string;
  direction: "LONG" | "SHORT";
  scaledExitReturnPct: number;
};

type WeekResult = {
  weekOpenUtc: string;
  weekLabel: string;
  returnPct: number;
  tradeCount: number;
  assetBreakdown: Record<string, { returnPct: number; trades: number }>;
  exitReason: ExitReason;
  exitDay: number | null;
  managedBasketDailyPath: number[];
  dailyChanges: number[];
  hitTarget1: boolean;
  hitTarget15: boolean;
  hitTarget2: boolean;
  weekPassesDailyCheck: boolean;
  pairDiagnostics: PairWeekDiagnostic[];
};

type AggregateMetrics = {
  totalReturnPct: number;
  maxDrawdownPct: number;
  returnToDrawdown: number | null;
  losingWeeks: number;
  worstWeekPct: number;
  bestWeekPct: number;
  avgWeeklyReturnPct: number;
  avgPairsPerWeek: number;
  worstEodDayProxyPct: number;
  maxConsecutiveLosingWeeks: number;
  weeksHit1Pct: number;
  weeksHit15Pct: number;
  weeksHit2Pct: number;
  consistencyScore: number;
  byAssetClass: Record<string, { returnPct: number; trades: number }>;
  trailActivations: number;
  tpHits: number;
  avgReturnWhenTrailFiresPct: number | null;
};

type StrategyComboResult = {
  strategyId: StrategyId;
  strategyLabel: string;
  scale: ScaleConfig;
  exitConfig: ExitConfig;
  weekly: WeekResult[];
  metrics: AggregateMetrics;
  propScore: number;
  disqualified: boolean;
  disqualifyReasons: string[];
};

const STRATEGY_IDS: StrategyId[] = [
  "dealer",
  "sentiment",
  "strength",
  "commercial",
  "tandem",
  "tiered_v3",
  "tiered_3_nocomm",
  "agree_2of3",
  "agree_2of3_nocomm",
  "selector_sentiment_override",
];

const SCALE_FACTORS: ScaleConfig[] = [
  { factor: 1 / 5, label: "1/5" },
  { factor: 1 / 6, label: "1/6" },
  { factor: 1 / 7, label: "1/7" },
  { factor: 1 / 8, label: "1/8" },
  { factor: 1 / 9, label: "1/9" },
  { factor: 1 / 10, label: "1/10" },
];

const TRAIL_ACTIVATIONS = [0.75, 1.0, 1.25, 1.5] as const;
const TRAIL_DISTANCES = [0.25, 0.5, 0.75, 1.0] as const;
const TP_LEVELS = [1.0, 1.25, 1.5, 2.0] as const;
const DAILY_BAR_DAYS = 7;
const MAX_FINAL_RANK = 15;
const MAX_TOP_DETAILS = 5;

function fmt(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function fmtR(v: number | null): string {
  return typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(1)}x` : "∞";
}

function round(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function buildWeekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd");
}

function getClosedWeeks() {
  return listDataSectionWeeks().then((weeks) => {
    const currentWeekOpenUtc = getDisplayWeekOpenUtc();
    return weeks
      .sort((left, right) => left.localeCompare(right))
      .filter((week) => week < currentWeekOpenUtc)
      .slice(-10);
  });
}

async function loadBarsForWeekSymbol(weekOpenUtc: string, symbol: string) {
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const fromUtc = weekOpen.minus({ days: 1 }).toUTC().toISO() ?? weekOpenUtc;
  const toUtc = weekOpen.plus({ days: DAILY_BAR_DAYS }).toUTC().toISO() ?? weekOpenUtc;
  const nextWeekOpenUtc = weekOpen.plus({ days: 7 }).toUTC().toISO() ?? weekOpenUtc;
  const bars = await getCanonicalBars(symbol, "1d", fromUtc, toUtc);
  return bars.filter((bar) => bar.barCloseUtc > weekOpenUtc && bar.barCloseUtc <= nextWeekOpenUtc);
}

function buildDailyNormalizedPath(
  trade: WeeklyHoldTrade,
  bars: CanonicalPriceBar[],
  multiplier: number,
): number[] {
  if (trade.openPrice <= 0 || bars.length === 0) return [];
  const path: number[] = [];
  for (const bar of bars) {
    const rawPnl = ((bar.closePrice - trade.openPrice) / trade.openPrice) * 100;
    const directedPnl = trade.direction === "SHORT" ? -rawPnl : rawPnl;
    path.push(directedPnl * multiplier);
  }
  return path;
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

function buildAssetBreakdown(
  pairs: Array<{ assetClass: string; exitReturnPct: number }>,
): Record<string, { returnPct: number; trades: number }> {
  const record: Record<string, { returnPct: number; trades: number }> = {};
  for (const pair of pairs) {
    if (!record[pair.assetClass]) {
      record[pair.assetClass] = { returnPct: 0, trades: 0 };
    }
    record[pair.assetClass]!.returnPct += pair.exitReturnPct;
    record[pair.assetClass]!.trades += 1;
  }
  return record;
}

function buildManagedBasketPath(
  rawBasketPath: number[],
  exitDay: number | null,
  exitReturnPct: number,
) {
  if (exitDay === null || exitDay < 0) return [...rawBasketPath];
  return rawBasketPath.map((value, index) => (index <= exitDay ? value : exitReturnPct));
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

function computeMaxConsecutiveLosingWeeks(weeklyReturns: number[]) {
  let streak = 0;
  let maxStreak = 0;
  for (const weeklyReturn of weeklyReturns) {
    if (weeklyReturn < 0) {
      streak += 1;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      streak = 0;
    }
  }
  return maxStreak;
}

function scaleWeekPath(path: number[], factor: number) {
  return path.map((value) => value * factor);
}

function scalePairReturns(
  positions: BaselinePosition[],
  dayIndex: number,
  targetBasketReturn: number,
  scaleFactor: number,
) {
  const scaledActualBasketReturn = positions.reduce((sum, position) => {
    const value = (position.dailyNormalizedPath[dayIndex] ?? position.normalizedReturnPct) * scaleFactor;
    return sum + value;
  }, 0);

  if (Math.abs(scaledActualBasketReturn) < 1e-9) {
    return positions.map((position) => ({
      pair: position.symbol,
      assetClass: position.assetClass,
      direction: position.direction,
      scaledExitReturnPct: 0,
    }));
  }

  const scale = targetBasketReturn / scaledActualBasketReturn;
  return positions.map((position) => {
    const scaledActualReturn =
      (position.dailyNormalizedPath[dayIndex] ?? position.normalizedReturnPct) * scaleFactor;
    return {
      pair: position.symbol,
      assetClass: position.assetClass,
      direction: position.direction,
      scaledExitReturnPct: scaledActualReturn * scale,
    };
  });
}

function actualPairReturnsAtDay(
  positions: BaselinePosition[],
  dayIndex: number,
  scaleFactor: number,
) {
  return positions.map((position) => ({
    pair: position.symbol,
    assetClass: position.assetClass,
    direction: position.direction,
    scaledExitReturnPct:
      (position.dailyNormalizedPath[dayIndex] ?? position.normalizedReturnPct) * scaleFactor,
  }));
}

async function buildStrategyWeekInputs(
  weeks: string[],
): Promise<Map<StrategyId, StrategyWeekInput[]>> {
  const weeklyHold = getEntryStyle("weekly_hold");
  const adrOverlay = getStrengthGate("adr_normalized");
  if (!weeklyHold || !adrOverlay) {
    throw new Error("Missing weekly_hold or adr_normalized config.");
  }

  const byStrategy = new Map<StrategyId, WeeklyHoldResult[]>();
  for (const strategyId of STRATEGY_IDS) {
    const strategy = getStrategy(strategyId);
    if (!strategy) continue;
    const results: WeeklyHoldResult[] = [];
    for (const weekOpenUtc of weeks) {
      results.push(await computeWeeklyHold(strategy, weekOpenUtc, weeklyHold, adrOverlay));
    }
    byStrategy.set(strategyId, results);
  }

  const uniqueWeekSymbols = new Map<string, Set<string>>();
  for (const results of byStrategy.values()) {
    for (const week of results) {
      if (!uniqueWeekSymbols.has(week.weekOpenUtc)) uniqueWeekSymbols.set(week.weekOpenUtc, new Set());
      const set = uniqueWeekSymbols.get(week.weekOpenUtc)!;
      for (const trade of week.trades) set.add(trade.symbol.toUpperCase());
    }
  }

  const barsByWeekSymbol = new Map<string, CanonicalPriceBar[]>();
  const adrByWeek = new Map<string, Awaited<ReturnType<typeof loadWeeklyAdrMap>>>();

  for (const weekOpenUtc of weeks) {
    adrByWeek.set(weekOpenUtc, await loadWeeklyAdrMap(weekOpenUtc));
    const symbols = Array.from(uniqueWeekSymbols.get(weekOpenUtc) ?? []).sort();
    for (const symbol of symbols) {
      barsByWeekSymbol.set(
        `${weekOpenUtc}:${symbol}`,
        await loadBarsForWeekSymbol(weekOpenUtc, symbol),
      );
    }
  }

  const inputs = new Map<StrategyId, StrategyWeekInput[]>();

  for (const strategyId of STRATEGY_IDS) {
    const strategy = getStrategy(strategyId);
    const results = byStrategy.get(strategyId);
    if (!strategy || !results) continue;

    const weekInputs = results.map((week): StrategyWeekInput => {
      const adrMap = adrByWeek.get(week.weekOpenUtc)!;
      const positions: BaselinePosition[] = week.trades.map((trade) => {
        const adrPct = getAdrPct(adrMap, trade.symbol, trade.assetClass);
        const multiplier = getTargetAdrPct() / adrPct;
        const bars = barsByWeekSymbol.get(`${week.weekOpenUtc}:${trade.symbol.toUpperCase()}`) ?? [];
        const dailyNormalizedPath = buildDailyNormalizedPath(trade, bars, multiplier);
        const rawReturnPct =
          trade.direction === "SHORT"
            ? -(((trade.closePrice - trade.openPrice) / trade.openPrice) * 100)
            : ((trade.closePrice - trade.openPrice) / trade.openPrice) * 100;
        return {
          symbol: trade.symbol.toUpperCase(),
          assetClass: trade.assetClass,
          direction: trade.direction,
          rawReturnPct,
          adrPct,
          multiplier,
          normalizedReturnPct: trade.returnPct,
          dailyNormalizedPath,
        };
      });

      const engineFridayReturnPct = week.trades.reduce((sum, trade) => sum + trade.returnPct, 0);
      const reconstructedBasketDailyPath = sumPaths(positions.map((position) => position.dailyNormalizedPath));
      const reconstructedFridayReturnPct =
        reconstructedBasketDailyPath.length > 0
          ? reconstructedBasketDailyPath[reconstructedBasketDailyPath.length - 1]!
          : engineFridayReturnPct;
      const scaleFactor =
        Math.abs(reconstructedFridayReturnPct) > 1e-9
          ? engineFridayReturnPct / reconstructedFridayReturnPct
          : 1;

      const normalizedPositions = positions.map((position) => ({
        ...position,
        dailyNormalizedPath: position.dailyNormalizedPath.map((value) => value * scaleFactor),
      }));
      const basketDailyPath = sumPaths(normalizedPositions.map((position) => position.dailyNormalizedPath));
      const assetBreakdownBaseline = buildAssetBreakdown(
        normalizedPositions.map((position) => ({
          assetClass: position.assetClass,
          exitReturnPct: position.normalizedReturnPct,
        })),
      );

      return {
        strategyId,
        strategyLabel: strategy.label,
        weekOpenUtc: week.weekOpenUtc,
        weekLabel: buildWeekLabel(week.weekOpenUtc),
        trades: week.trades,
        positions: normalizedPositions,
        basketDailyPath,
        fridayReturnPct: engineFridayReturnPct,
        tradeCount: week.trades.length,
        assetBreakdownBaseline,
      };
    });

    inputs.set(strategyId, weekInputs);
  }

  return inputs;
}

function simulateScaledWeek(
  week: StrategyWeekInput,
  scale: ScaleConfig,
  exitConfig: ExitConfig,
): WeekResult {
  const scaledBasketPath = scaleWeekPath(week.basketDailyPath, scale.factor);
  const fridayReturn = week.fridayReturnPct * scale.factor;

  let exitReason: ExitReason = "hold";
  let exitDay: number | null = null;
  let exitReturnPct = fridayReturn;
  let trailActive = false;
  let peak = Number.NEGATIVE_INFINITY;
  let pairReturns = actualPairReturnsAtDay(
    week.positions,
    Math.max(scaledBasketPath.length - 1, 0),
    scale.factor,
  );

  for (let dayIndex = 0; dayIndex < scaledBasketPath.length; dayIndex += 1) {
    const basketPnl = scaledBasketPath[dayIndex]!;

    if (exitConfig.kind === "tp" && exitConfig.tpLevel != null && basketPnl >= exitConfig.tpLevel) {
      exitReason = "tp";
      exitDay = dayIndex;
      exitReturnPct = exitConfig.tpLevel;
      pairReturns = scalePairReturns(week.positions, dayIndex, exitConfig.tpLevel, scale.factor);
      break;
    }

    if (exitConfig.kind === "trail" && exitConfig.activation != null) {
      if (!trailActive && basketPnl >= exitConfig.activation) {
        trailActive = true;
        peak = basketPnl;
      } else if (trailActive) {
        peak = Math.max(peak, basketPnl);
      }

      if (trailActive && exitConfig.distance != null) {
        const stopLevel = peak - exitConfig.distance;
        if (basketPnl <= stopLevel) {
          exitReason = "trail";
          exitDay = dayIndex;
          exitReturnPct = stopLevel;
          pairReturns = scalePairReturns(week.positions, dayIndex, stopLevel, scale.factor);
          break;
        }
      }
    }
  }

  const managedBasketDailyPath = buildManagedBasketPath(scaledBasketPath, exitDay, exitReturnPct);
  const dailyChanges = dailyChangesFromPath(managedBasketDailyPath);
  const assetBreakdown = buildAssetBreakdown(
    pairReturns.map((pair) => ({
      assetClass: pair.assetClass,
      exitReturnPct: pair.scaledExitReturnPct,
    })),
  );
  const worstDay = dailyChanges.length > 0 ? Math.min(...dailyChanges) : 0;

  return {
    weekOpenUtc: week.weekOpenUtc,
    weekLabel: week.weekLabel,
    returnPct: round(exitReturnPct),
    tradeCount: week.tradeCount,
    assetBreakdown,
    exitReason,
    exitDay,
    managedBasketDailyPath: managedBasketDailyPath.map((value) => round(value)),
    dailyChanges: dailyChanges.map((value) => round(value)),
    hitTarget1: exitReturnPct >= 1,
    hitTarget15: exitReturnPct >= 1.5,
    hitTarget2: exitReturnPct >= 2,
    weekPassesDailyCheck: worstDay > -2,
    pairDiagnostics: pairReturns,
  };
}

function aggregateResults(weekly: WeekResult[]): AggregateMetrics {
  const weeklyReturns = weekly.map((row) => row.returnPct);
  const totalReturnPct = weeklyReturns.reduce((sum, value) => sum + value, 0);
  const maxDrawdownPct = computeMaxDrawdown(weeklyReturns);
  const worstEodDayProxyPct = weekly.reduce((minValue, row) => {
    const weekMin = row.dailyChanges.length > 0 ? Math.min(...row.dailyChanges) : 0;
    return Math.min(minValue, weekMin);
  }, 0);

  const byAssetClass: Record<string, { returnPct: number; trades: number }> = {};
  for (const row of weekly) {
    for (const [assetClass, metrics] of Object.entries(row.assetBreakdown)) {
      if (!byAssetClass[assetClass]) {
        byAssetClass[assetClass] = { returnPct: 0, trades: 0 };
      }
      byAssetClass[assetClass]!.returnPct += metrics.returnPct;
      byAssetClass[assetClass]!.trades += metrics.trades;
    }
  }

  const trailWeeks = weekly.filter((row) => row.exitReason === "trail");

  return {
    totalReturnPct: round(totalReturnPct),
    maxDrawdownPct: round(maxDrawdownPct),
    returnToDrawdown: maxDrawdownPct < 0 ? round(totalReturnPct / Math.abs(maxDrawdownPct), 2) : null,
    losingWeeks: weeklyReturns.filter((value) => value < 0).length,
    worstWeekPct: round(Math.min(0, ...weeklyReturns)),
    bestWeekPct: round(Math.max(0, ...weeklyReturns)),
    avgWeeklyReturnPct: weeklyReturns.length > 0 ? round(totalReturnPct / weeklyReturns.length) : 0,
    avgPairsPerWeek: weekly.length > 0 ? round(weekly.reduce((sum, row) => sum + row.tradeCount, 0) / weekly.length, 1) : 0,
    worstEodDayProxyPct: round(worstEodDayProxyPct),
    maxConsecutiveLosingWeeks: computeMaxConsecutiveLosingWeeks(weeklyReturns),
    weeksHit1Pct: weekly.filter((row) => row.hitTarget1).length,
    weeksHit15Pct: weekly.filter((row) => row.hitTarget15).length,
    weeksHit2Pct: weekly.filter((row) => row.hitTarget2).length,
    consistencyScore: weekly.length > 0 ? round(weekly.filter((row) => row.hitTarget1).length / weekly.length, 4) : 0,
    byAssetClass,
    trailActivations: trailWeeks.length,
    tpHits: weekly.filter((row) => row.exitReason === "tp").length,
    avgReturnWhenTrailFiresPct:
      trailWeeks.length > 0
        ? round(trailWeeks.reduce((sum, row) => sum + row.returnPct, 0) / trailWeeks.length)
        : null,
  };
}

function buildPropScore(metrics: AggregateMetrics) {
  return round(
    metrics.consistencyScore * 100 +
      metrics.avgWeeklyReturnPct -
      metrics.losingWeeks * 5 -
      (metrics.worstWeekPct < -1 ? 10 : 0),
    2,
  );
}

function disqualify(metrics: AggregateMetrics) {
  const reasons: string[] = [];
  if (metrics.worstEodDayProxyPct < -2) reasons.push("worst_day");
  if (metrics.maxDrawdownPct < -4) reasons.push("max_dd");
  if (metrics.losingWeeks >= 3) reasons.push("losing_weeks");
  return reasons;
}

function buildResult(
  strategyId: StrategyId,
  scale: ScaleConfig,
  exitConfig: ExitConfig,
  weeklyInputs: StrategyWeekInput[],
) {
  const strategy = getStrategy(strategyId)!;
  const weekly = weeklyInputs.map((week) => simulateScaledWeek(week, scale, exitConfig));
  const metrics = aggregateResults(weekly);
  const reasons = disqualify(metrics);
  return {
    strategyId,
    strategyLabel: strategy.label,
    scale,
    exitConfig,
    weekly,
    metrics,
    propScore: buildPropScore(metrics),
    disqualified: reasons.length > 0,
    disqualifyReasons: reasons,
  } satisfies StrategyComboResult;
}

function compareConsistency(left: StrategyComboResult, right: StrategyComboResult) {
  if (right.metrics.consistencyScore !== left.metrics.consistencyScore) {
    return right.metrics.consistencyScore - left.metrics.consistencyScore;
  }
  if (right.metrics.weeksHit15Pct !== left.metrics.weeksHit15Pct) {
    return right.metrics.weeksHit15Pct - left.metrics.weeksHit15Pct;
  }
  if (right.metrics.weeksHit2Pct !== left.metrics.weeksHit2Pct) {
    return right.metrics.weeksHit2Pct - left.metrics.weeksHit2Pct;
  }
  if (left.metrics.losingWeeks !== right.metrics.losingWeeks) {
    return left.metrics.losingWeeks - right.metrics.losingWeeks;
  }
  const leftRdd = left.metrics.returnToDrawdown ?? Number.POSITIVE_INFINITY;
  const rightRdd = right.metrics.returnToDrawdown ?? Number.POSITIVE_INFINITY;
  if (rightRdd !== leftRdd) return rightRdd - leftRdd;
  return right.metrics.totalReturnPct - left.metrics.totalReturnPct;
}

function pickBestScale(results: StrategyComboResult[]) {
  const eligible = results.filter((row) => row.metrics.losingWeeks <= 1);
  const pool = eligible.length > 0 ? eligible : results;
  return [...pool].sort(compareConsistency)[0]!;
}

function pickBestTrailing(results: StrategyComboResult[]) {
  return [...results].sort((left, right) => {
    if (right.metrics.consistencyScore !== left.metrics.consistencyScore) {
      return right.metrics.consistencyScore - left.metrics.consistencyScore;
    }
    if (right.propScore !== left.propScore) return right.propScore - left.propScore;
    if (left.metrics.losingWeeks !== right.metrics.losingWeeks) {
      return left.metrics.losingWeeks - right.metrics.losingWeeks;
    }
    return (right.metrics.returnToDrawdown ?? Number.POSITIVE_INFINITY) - (left.metrics.returnToDrawdown ?? Number.POSITIVE_INFINITY);
  })[0]!;
}

function renderScaleRow(result: StrategyComboResult) {
  const weeklyInline = result.weekly.map((week) => fmt(week.returnPct)).join("  ");
  console.log(
    result.scale.label.padEnd(6),
    String(result.metrics.weeksHit1Pct).padEnd(7),
    String(result.metrics.weeksHit15Pct).padEnd(7),
    String(result.metrics.weeksHit2Pct).padEnd(7),
    String(result.metrics.losingWeeks).padEnd(7),
    fmt(result.metrics.worstWeekPct).padEnd(10),
    fmt(result.metrics.bestWeekPct).padEnd(10),
    fmt(result.metrics.totalReturnPct).padEnd(10),
    fmt(result.metrics.maxDrawdownPct).padEnd(10),
    fmt(result.metrics.worstEodDayProxyPct).padEnd(10),
    `${(result.metrics.consistencyScore * 100).toFixed(0)}%`.padEnd(8),
    fmtR(result.metrics.returnToDrawdown).padEnd(8),
    weeklyInline,
  );
}

function renderExitRow(result: StrategyComboResult) {
  console.log(
    result.exitConfig.label.padEnd(16),
    fmt(result.metrics.totalReturnPct).padEnd(10),
    fmt(result.metrics.maxDrawdownPct).padEnd(10),
    fmtR(result.metrics.returnToDrawdown).padEnd(8),
    String(result.metrics.weeksHit1Pct).padEnd(7),
    String(result.metrics.losingWeeks).padEnd(7),
    fmt(result.metrics.worstWeekPct).padEnd(10),
    String(result.metrics.trailActivations).padEnd(7),
    String(result.metrics.tpHits).padEnd(6),
    `${(result.metrics.consistencyScore * 100).toFixed(0)}%`.padEnd(8),
    `${result.metrics.avgReturnWhenTrailFiresPct == null ? "n/a" : fmt(result.metrics.avgReturnWhenTrailFiresPct)}`.padEnd(10),
  );
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   SCALED PROP ACCOUNT RESEARCH                                  ║");
  console.log("║   All strategies × scale factors × trailing/TP                  ║");
  console.log("║   Target: 1-2% per week consistently                            ║");
  console.log("║   Engine: f2=adr_normalized (app parity)                        ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  const weeks = await getClosedWeeks();
  if (weeks.length === 0) throw new Error("No closed weeks found.");

  console.log(`Closed weeks: ${weeks.length}`);
  console.log(`Window: ${weeks[0]?.slice(0, 10)} -> ${weeks[weeks.length - 1]?.slice(0, 10)}\n`);

  const weekInputsByStrategy = await buildStrategyWeekInputs(weeks);

  console.log("**Baseline parity**");
  console.log("Scale 1/1 check vs existing ADR-normalized engine\n");
  const weeklyHold = getEntryStyle("weekly_hold")!;
  const adrOverlay = getStrengthGate("adr_normalized")!;
  for (const strategyId of STRATEGY_IDS) {
    const strategy = getStrategy(strategyId);
    const weeklyInputs = weekInputsByStrategy.get(strategyId);
    if (!strategy || !weeklyInputs) continue;
    const engine = await computeMultiWeekHold(strategy, weeks, weeklyHold, adrOverlay);
    const scriptUnscaled = weeklyInputs.reduce((sum, week) => sum + week.fridayReturnPct, 0);
    const scriptDd = computeMaxDrawdown(weeklyInputs.map((week) => week.fridayReturnPct));
    console.log(
      `  ${strategy.label}: return delta ${fmt(round(scriptUnscaled) - round(engine.totalReturnPct))} | DD delta ${fmt(round(scriptDd) - round(engine.maxDrawdownPct))}`,
    );
  }

  console.log("\n**Phase 1**");
  console.log("Scale factor grid\n");

  const phase1ByStrategy = new Map<StrategyId, StrategyComboResult[]>();
  const bestScaleByStrategy = new Map<StrategyId, StrategyComboResult>();

  for (const strategyId of STRATEGY_IDS) {
    const strategy = getStrategy(strategyId);
    const weeklyInputs = weekInputsByStrategy.get(strategyId);
    if (!strategy || !weeklyInputs) continue;

    const rows = SCALE_FACTORS.map((scale) =>
      buildResult(strategyId, scale, { family: "baseline", kind: "baseline", label: "Fri close" }, weeklyInputs),
    ).sort(compareConsistency);

    phase1ByStrategy.set(strategyId, rows);
    bestScaleByStrategy.set(strategyId, pickBestScale(rows));

    console.log(strategy.label);
    console.log(
      "Scale".padEnd(6),
      "Wk>=1".padEnd(7),
      "Wk1.5".padEnd(7),
      "Wk2".padEnd(7),
      "Lose".padEnd(7),
      "Worst".padEnd(10),
      "Best".padEnd(10),
      "Return".padEnd(10),
      "MaxDD".padEnd(10),
      "WorstDay".padEnd(10),
      "Cons".padEnd(8),
      "R/DD".padEnd(8),
      "Weekly returns",
    );
    console.log("-".repeat(170));
    for (const row of rows) renderScaleRow(row);
    console.log();
  }

  console.log("Cross-strategy best-scale leaderboard");
  console.log(
    "Rank".padEnd(6),
    "Strategy".padEnd(18),
    "Scale".padEnd(6),
    "Wk>=1".padEnd(7),
    "Wk1.5".padEnd(7),
    "Wk2".padEnd(7),
    "Lose".padEnd(7),
    "Return".padEnd(10),
    "MaxDD".padEnd(10),
    "WorstDay".padEnd(10),
    "Cons".padEnd(8),
    "R/DD",
  );
  console.log("-".repeat(120));

  const bestScaleRows = [...bestScaleByStrategy.values()].sort(compareConsistency);
  bestScaleRows.forEach((row, index) => {
    console.log(
      String(index + 1).padEnd(6),
      row.strategyLabel.padEnd(18),
      row.scale.label.padEnd(6),
      String(row.metrics.weeksHit1Pct).padEnd(7),
      String(row.metrics.weeksHit15Pct).padEnd(7),
      String(row.metrics.weeksHit2Pct).padEnd(7),
      String(row.metrics.losingWeeks).padEnd(7),
      fmt(row.metrics.totalReturnPct).padEnd(10),
      fmt(row.metrics.maxDrawdownPct).padEnd(10),
      fmt(row.metrics.worstEodDayProxyPct).padEnd(10),
      `${(row.metrics.consistencyScore * 100).toFixed(0)}%`.padEnd(8),
      fmtR(row.metrics.returnToDrawdown),
    );
  });

  console.log("\n**Phase 2**");
  console.log("Account-level trailing at each strategy's best scale\n");

  const trailingByStrategy = new Map<StrategyId, StrategyComboResult[]>();
  const bestTrailingByStrategy = new Map<StrategyId, StrategyComboResult>();

  for (const strategyId of STRATEGY_IDS) {
    const strategy = getStrategy(strategyId);
    const weeklyInputs = weekInputsByStrategy.get(strategyId);
    const bestScale = bestScaleByStrategy.get(strategyId);
    if (!strategy || !weeklyInputs || !bestScale) continue;

    const rows: StrategyComboResult[] = [];
    for (const activation of TRAIL_ACTIVATIONS) {
      for (const distance of TRAIL_DISTANCES) {
        rows.push(
          buildResult(
            strategyId,
            bestScale.scale,
            {
              family: "trail",
              kind: "trail",
              label: `TR ${activation}/${distance}`,
              activation,
              distance,
            },
            weeklyInputs,
          ),
        );
      }
    }

    rows.sort((left, right) => {
      const cmp = compareConsistency(left, right);
      if (cmp !== 0) return cmp;
      return right.propScore - left.propScore;
    });

    trailingByStrategy.set(strategyId, rows);
    bestTrailingByStrategy.set(strategyId, pickBestTrailing(rows));

    console.log(`${strategy.label} @ ${bestScale.scale.label}`);
    console.log(
      "Trail".padEnd(16),
      "Return".padEnd(10),
      "MaxDD".padEnd(10),
      "R/DD".padEnd(8),
      "Wk>=1".padEnd(7),
      "Lose".padEnd(7),
      "Worst".padEnd(10),
      "Actv".padEnd(7),
      "TPHit".padEnd(6),
      "Cons".padEnd(8),
      "TrailAvg",
    );
    console.log("-".repeat(110));
    for (const row of rows) renderExitRow(row);
    console.log();
  }

  console.log("**Phase 3**");
  console.log("TP bank-out vs best trailing\n");

  const tpByStrategy = new Map<StrategyId, StrategyComboResult[]>();

  for (const strategyId of STRATEGY_IDS) {
    const strategy = getStrategy(strategyId);
    const weeklyInputs = weekInputsByStrategy.get(strategyId);
    const bestScale = bestScaleByStrategy.get(strategyId);
    const bestTrail = bestTrailingByStrategy.get(strategyId);
    if (!strategy || !weeklyInputs || !bestScale || !bestTrail) continue;

    const rows = TP_LEVELS.map((tpLevel) =>
      buildResult(
        strategyId,
        bestScale.scale,
        {
          family: "tp",
          kind: "tp",
          label: `TP ${tpLevel}`,
          tpLevel,
        },
        weeklyInputs,
      ),
    ).sort((left, right) => {
      const cmp = compareConsistency(left, right);
      if (cmp !== 0) return cmp;
      return right.propScore - left.propScore;
    });

    tpByStrategy.set(strategyId, rows);

    console.log(`${strategy.label} @ ${bestScale.scale.label}`);
    console.log(`Best trailing reference: ${bestTrail.exitConfig.label} | return ${fmt(bestTrail.metrics.totalReturnPct)} | Wk>=1 ${bestTrail.metrics.weeksHit1Pct} | lose ${bestTrail.metrics.losingWeeks}`);
    console.log(
      "Model".padEnd(16),
      "Return".padEnd(10),
      "MaxDD".padEnd(10),
      "R/DD".padEnd(8),
      "Wk>=1".padEnd(7),
      "Lose".padEnd(7),
      "Worst".padEnd(10),
      "Actv".padEnd(7),
      "TPHit".padEnd(6),
      "Cons".padEnd(8),
      "TrailAvg",
    );
    console.log("-".repeat(110));
    renderExitRow(bestTrail);
    for (const row of rows) renderExitRow(row);
    console.log();
  }

  console.log("**Phase 4**");
  console.log("Final prop-account ranking\n");

  const finalRows: StrategyComboResult[] = [];
  finalRows.push(...Array.from(phase1ByStrategy.values()).flat());
  finalRows.push(...Array.from(trailingByStrategy.values()).flat());
  finalRows.push(...Array.from(tpByStrategy.values()).flat());

  const rankedFinal = [...finalRows].sort((left, right) => {
    if (left.disqualified !== right.disqualified) return left.disqualified ? 1 : -1;
    if (right.propScore !== left.propScore) return right.propScore - left.propScore;
    const cmp = compareConsistency(left, right);
    if (cmp !== 0) return cmp;
    return right.metrics.totalReturnPct - left.metrics.totalReturnPct;
  });

  console.log(
    "Rank".padEnd(6),
    "Strategy".padEnd(18),
    "Scale".padEnd(6),
    "Exit".padEnd(16),
    "TotalRet".padEnd(10),
    "MaxDD".padEnd(10),
    "R/DD".padEnd(8),
    "Prop".padEnd(8),
    "Wk>=1".padEnd(7),
    "Lose".padEnd(7),
    "WorstWk".padEnd(10),
    "WorstDay".padEnd(10),
    "AvgWk",
  );
  console.log("-".repeat(130));
  rankedFinal.slice(0, MAX_FINAL_RANK).forEach((row, index) => {
    console.log(
      String(index + 1).padEnd(6),
      row.strategyLabel.padEnd(18),
      row.scale.label.padEnd(6),
      row.exitConfig.label.padEnd(16),
      fmt(row.metrics.totalReturnPct).padEnd(10),
      fmt(row.metrics.maxDrawdownPct).padEnd(10),
      fmtR(row.metrics.returnToDrawdown).padEnd(8),
      `${row.propScore.toFixed(2)}`.padEnd(8),
      String(row.metrics.weeksHit1Pct).padEnd(7),
      String(row.metrics.losingWeeks).padEnd(7),
      fmt(row.metrics.worstWeekPct).padEnd(10),
      fmt(row.metrics.worstEodDayProxyPct).padEnd(10),
      `${fmt(row.metrics.avgWeeklyReturnPct)}${row.disqualified ? ` | dq:${row.disqualifyReasons.join(",")}` : ""}`,
    );
  });

  console.log("\n**Phase 5**");
  console.log("Week-by-week detail for top 5\n");

  for (const row of rankedFinal.slice(0, MAX_TOP_DETAILS)) {
    console.log(`${row.strategyLabel} @ ${row.scale.label} — ${row.exitConfig.label}`);
    console.log(
      "Week".padEnd(10),
      "Return".padEnd(10),
      "Exit".padEnd(8),
      "Day".padEnd(6),
      "Target".padEnd(8),
      "DailyChk".padEnd(10),
      "Daily path",
    );
    console.log("-".repeat(130));
    for (const week of row.weekly) {
      const weekWorstDay = week.dailyChanges.length > 0 ? Math.min(...week.dailyChanges) : 0;
      console.log(
        week.weekLabel.padEnd(10),
        fmt(week.returnPct).padEnd(10),
        week.exitReason.padEnd(8),
        String(week.exitDay == null ? "Fri" : `D${week.exitDay + 1}`).padEnd(6),
        (week.hitTarget1 ? "hit" : "miss").padEnd(8),
        (weekWorstDay > -2 ? "pass" : "fail").padEnd(10),
        week.managedBasketDailyPath.map((value) => fmt(value)).join("  "),
      );
      for (const assetClass of ["fx", "crypto", "indices", "commodities"]) {
        const metrics = week.assetBreakdown[assetClass] ?? { returnPct: 0, trades: 0 };
        console.log(`  ${assetClass.padEnd(12)} ${fmt(metrics.returnPct).padStart(8)} | ${String(metrics.trades).padStart(3)} trades`);
      }
    }
    console.log();
  }

  console.log("Notes:");
  console.log("  worst_day is an EOD proxy from daily close snapshots, not true intraday prop-firm equity DD.");
  console.log("  scale is applied after ADR normalization; the full-size weekly engine stays unchanged.");
  console.log("  trailing and TP operate on scaled account-level basket P&L, not on pair-level ADR thresholds.");
}

main().catch((error) => {
  console.error("Scaled prop consistency backtest failed:", error);
  process.exit(1);
});
