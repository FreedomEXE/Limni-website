/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-risk-management-matrix.ts
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
type ExitReason = "hold" | "sl" | "tp" | "trail";
type ExitFamily = "baseline" | "sl" | "tp" | "trail" | "combined";
type ExitKind = "none" | "sl" | "tp" | "trail" | "sl_tp" | "sl_trail" | "tp_trail" | "sl_tp_trail";

type PairWeekDiagnostic = {
  week: string;
  pair: string;
  direction: "LONG" | "SHORT";
  rawReturnPct: number;
  adrPct: number;
  multiplier: number;
  normalizedReturnPct: number;
  dailyPath: number[];
  exitDay: number | null;
  exitReason: ExitReason;
  exitReturnPct: number;
};

type BaselinePosition = {
  symbol: string;
  assetClass: string;
  direction: "LONG" | "SHORT";
  openPrice: number;
  closePrice: number;
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

type ExitConfig = {
  key: string;
  label: string;
  family: ExitFamily;
  kind: ExitKind;
  slLevel?: number | null;
  tpMultiplier?: number | null;
  tpLevelLabel?: string | null;
  trailActivation?: number | null;
  trailDistance?: number | null;
};

type WeekExitResult = {
  weekOpenUtc: string;
  weekLabel: string;
  returnPct: number;
  tradeCount: number;
  assetBreakdown: Record<string, { returnPct: number; trades: number }>;
  exitReason: ExitReason;
  exitDay: number | null;
  changedVsBaseline: number;
  managedBasketDailyPath: number[];
  dailyChanges: number[];
  pairDiagnostics: PairWeekDiagnostic[];
};

type AggregateMetrics = {
  totalReturnPct: number;
  maxDrawdownPct: number;
  returnToDrawdown: number | null;
  losingWeeks: number;
  worstWeekPct: number;
  bestWeekPct: number;
  winRatePct: number;
  avgPairsPerWeek: number;
  worstEodDayProxyPct: number;
  maxConsecutiveLosingWeeks: number;
  byAssetClass: Record<string, { returnPct: number; trades: number }>;
  slHits: number;
  tpHits: number;
  trailHits: number;
};

type StrategyComboResult = {
  strategyId: StrategyId;
  strategyLabel: string;
  config: ExitConfig;
  weekly: WeekExitResult[];
  metrics: AggregateMetrics;
  score: number;
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

const STOP_LOSS_LEVELS = [-2, -3, -4, -5, -6, -8, -10] as const;
const TP_MULTIPLIERS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const TRAIL_ACTIVATIONS = [2, 3, 4, 5] as const;
const TRAIL_DISTANCES = [1, 1.5, 2, 2.5, 3] as const;
const TARGET_TOP_PER_FAMILY = 2;
const MAX_RANKED_COMBOS = 10;
const MAX_DIAGNOSTIC_COMBOS = 5;
const DAILY_BAR_DAYS = 7;
const BASKET_TP_PER_TRADE = 0.25;

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

function basketTpLevel(tradeCount: number, multiplier: number) {
  return BASKET_TP_PER_TRADE * tradeCount * multiplier;
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

function scalePairReturnsToBasketTarget(
  positions: BaselinePosition[],
  dayIndex: number,
  targetBasketReturn: number,
) {
  const actualBasketReturn = positions.reduce((sum, position) => {
    const value = position.dailyNormalizedPath[dayIndex] ?? position.normalizedReturnPct;
    return sum + value;
  }, 0);

  if (Math.abs(actualBasketReturn) < 1e-9) {
    return positions.map((position) => ({
      symbol: position.symbol,
      assetClass: position.assetClass,
      exitReturnPct: 0,
    }));
  }

  const scale = targetBasketReturn / actualBasketReturn;
  return positions.map((position) => {
    const actualReturn = position.dailyNormalizedPath[dayIndex] ?? position.normalizedReturnPct;
    return {
      symbol: position.symbol,
      assetClass: position.assetClass,
      exitReturnPct: actualReturn * scale,
    };
  });
}

function actualPairReturnsAtDay(positions: BaselinePosition[], dayIndex: number) {
  return positions.map((position) => ({
    symbol: position.symbol,
    assetClass: position.assetClass,
    exitReturnPct: position.dailyNormalizedPath[dayIndex] ?? position.normalizedReturnPct,
  }));
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

function simulateExit(
  week: StrategyWeekInput,
  config: ExitConfig,
): Omit<WeekExitResult, "weekOpenUtc" | "weekLabel" | "tradeCount" | "changedVsBaseline"> {
  const rawPath = week.basketDailyPath;
  const fridayReturn = week.fridayReturnPct;

  let trailActive = false;
  let peak = Number.NEGATIVE_INFINITY;
  let exitReason: ExitReason = "hold";
  let exitDay: number | null = null;
  let exitReturnPct = fridayReturn;
  let pairReturns = actualPairReturnsAtDay(week.positions, Math.max(rawPath.length - 1, 0));

  for (let dayIndex = 0; dayIndex < rawPath.length; dayIndex += 1) {
    const basketPnl = rawPath[dayIndex]!;

    if (config.slLevel != null && basketPnl <= config.slLevel) {
      exitReason = "sl";
      exitDay = dayIndex;
      exitReturnPct = basketPnl;
      pairReturns = actualPairReturnsAtDay(week.positions, dayIndex);
      break;
    }

    if (config.kind === "trail" || config.kind === "sl_trail" || config.kind === "tp_trail" || config.kind === "sl_tp_trail") {
      const activation = config.trailActivation;
      if (activation != null) {
        if (!trailActive && basketPnl >= activation) {
          trailActive = true;
          peak = basketPnl;
        } else if (trailActive) {
          peak = Math.max(peak, basketPnl);
        }
      }
    }

    if (config.tpMultiplier != null) {
      const tpLevel = basketTpLevel(week.tradeCount, config.tpMultiplier);
      if (basketPnl >= tpLevel) {
        exitReason = "tp";
        exitDay = dayIndex;
        exitReturnPct = tpLevel;
        pairReturns = scalePairReturnsToBasketTarget(week.positions, dayIndex, tpLevel);
        break;
      }
    }

    if (trailActive && config.trailDistance != null) {
      const stopLevel = peak - config.trailDistance;
      if (basketPnl <= stopLevel) {
        exitReason = "trail";
        exitDay = dayIndex;
        exitReturnPct = stopLevel;
        pairReturns = scalePairReturnsToBasketTarget(week.positions, dayIndex, stopLevel);
        break;
      }
    }
  }

  const managedBasketDailyPath = buildManagedBasketPath(rawPath, exitDay, exitReturnPct);
  const assetBreakdown = buildAssetBreakdown(pairReturns);
  const pairDiagnostics: PairWeekDiagnostic[] = week.positions.map((position) => ({
    week: week.weekOpenUtc,
    pair: position.symbol,
    direction: position.direction,
    rawReturnPct: position.rawReturnPct,
    adrPct: position.adrPct,
    multiplier: position.multiplier,
    normalizedReturnPct: position.normalizedReturnPct,
    dailyPath: position.dailyNormalizedPath,
    exitDay,
    exitReason,
    exitReturnPct: pairReturns.find((pair) => pair.symbol === position.symbol)?.exitReturnPct ?? 0,
  }));

  return {
    returnPct: exitReturnPct,
    assetBreakdown,
    exitReason,
    exitDay,
    managedBasketDailyPath,
    dailyChanges: dailyChangesFromPath(managedBasketDailyPath),
    pairDiagnostics,
  };
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

function aggregateResults(weekly: WeekExitResult[]): AggregateMetrics {
  const weeklyReturns = weekly.map((row) => row.returnPct);
  const totalReturnPct = weeklyReturns.reduce((sum, value) => sum + value, 0);
  const maxDrawdownPct = computeMaxDrawdown(weeklyReturns);
  const totalWins = weeklyReturns.filter((value) => value > 0).length;
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

  return {
    totalReturnPct: round(totalReturnPct),
    maxDrawdownPct: round(maxDrawdownPct),
    returnToDrawdown: maxDrawdownPct < 0 ? round(totalReturnPct / Math.abs(maxDrawdownPct), 2) : null,
    losingWeeks: weeklyReturns.filter((value) => value < 0).length,
    worstWeekPct: round(Math.min(0, ...weeklyReturns)),
    bestWeekPct: round(Math.max(0, ...weeklyReturns)),
    winRatePct: weeklyReturns.length > 0 ? round((totalWins / weeklyReturns.length) * 100, 1) : 0,
    avgPairsPerWeek: weekly.length > 0 ? round(weekly.reduce((sum, row) => sum + row.tradeCount, 0) / weekly.length, 1) : 0,
    worstEodDayProxyPct: round(worstEodDayProxyPct),
    maxConsecutiveLosingWeeks: computeMaxConsecutiveLosingWeeks(weeklyReturns),
    byAssetClass,
    slHits: weekly.filter((row) => row.exitReason === "sl").length,
    tpHits: weekly.filter((row) => row.exitReason === "tp").length,
    trailHits: weekly.filter((row) => row.exitReason === "trail").length,
  };
}

function computeScore(metrics: AggregateMetrics) {
  const base = metrics.returnToDrawdown ?? (metrics.totalReturnPct > 0 ? Number.POSITIVE_INFINITY : 0);
  let bonus = 0;
  if (metrics.losingWeeks === 0) bonus = 0.5;
  else if (metrics.losingWeeks === 1) bonus = 0.25;
  else if (metrics.losingWeeks >= 3) bonus = -0.25;
  return Number.isFinite(base) ? base * (1 + bonus) : Number.POSITIVE_INFINITY;
}

function disqualify(metrics: AggregateMetrics) {
  const reasons: string[] = [];
  if (metrics.worstEodDayProxyPct < -5) reasons.push("worst_day");
  if (metrics.maxDrawdownPct < -10) reasons.push("max_dd");
  return reasons;
}

function renderMetricsRow(
  label: string,
  metrics: AggregateMetrics,
  extra: string,
) {
  console.log(
    label.padEnd(22),
    fmt(metrics.totalReturnPct).padEnd(10),
    fmt(metrics.maxDrawdownPct).padEnd(10),
    fmtR(metrics.returnToDrawdown).padEnd(8),
    String(metrics.losingWeeks).padEnd(7),
    fmt(metrics.worstWeekPct).padEnd(10),
    fmt(metrics.worstEodDayProxyPct).padEnd(10),
    `${metrics.avgPairsPerWeek.toFixed(1)}`.padEnd(7),
    extra,
  );
}

function rankFamily(results: StrategyComboResult[]) {
  return [...results].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    const leftRdd = left.metrics.returnToDrawdown ?? Number.POSITIVE_INFINITY;
    const rightRdd = right.metrics.returnToDrawdown ?? Number.POSITIVE_INFINITY;
    if (rightRdd !== leftRdd) return rightRdd - leftRdd;
    return right.metrics.totalReturnPct - left.metrics.totalReturnPct;
  });
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
        const rawReturnPct = trade.direction === "SHORT"
          ? -(((trade.closePrice - trade.openPrice) / trade.openPrice) * 100)
          : ((trade.closePrice - trade.openPrice) / trade.openPrice) * 100;
        return {
          symbol: trade.symbol.toUpperCase(),
          assetClass: trade.assetClass,
          direction: trade.direction,
          openPrice: trade.openPrice,
          closePrice: trade.closePrice,
          rawReturnPct,
          adrPct,
          multiplier,
          normalizedReturnPct: trade.returnPct,
          dailyNormalizedPath,
        };
      });

      const engineFridayReturnPct = week.trades.reduce((sum, trade) => sum + trade.returnPct, 0);
      const reconstructedBasketDailyPath = sumPaths(positions.map((position) => position.dailyNormalizedPath));
      const reconstructedFridayReturnPct = reconstructedBasketDailyPath.length > 0
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
      const fridayReturnPct = engineFridayReturnPct;

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
        fridayReturnPct,
        tradeCount: week.trades.length,
        assetBreakdownBaseline,
      };
    });

    inputs.set(strategyId, weekInputs);
  }

  return inputs;
}

function buildBaselineResult(strategyId: StrategyId, weeks: StrategyWeekInput[]) {
  const strategy = getStrategy(strategyId)!;
  const config: ExitConfig = {
    key: "baseline",
    label: "No exit (Friday close)",
    family: "baseline",
    kind: "none",
  };
  const weekly = weeks.map((week): WeekExitResult => ({
    weekOpenUtc: week.weekOpenUtc,
    weekLabel: week.weekLabel,
    returnPct: week.fridayReturnPct,
    tradeCount: week.tradeCount,
    assetBreakdown: week.assetBreakdownBaseline,
    exitReason: "hold",
    exitDay: null,
    changedVsBaseline: 0,
    managedBasketDailyPath: [...week.basketDailyPath],
    dailyChanges: dailyChangesFromPath(week.basketDailyPath),
    pairDiagnostics: week.positions.map((position) => ({
      week: week.weekOpenUtc,
      pair: position.symbol,
      direction: position.direction,
      rawReturnPct: position.rawReturnPct,
      adrPct: position.adrPct,
      multiplier: position.multiplier,
      normalizedReturnPct: position.normalizedReturnPct,
      dailyPath: position.dailyNormalizedPath,
      exitDay: null,
      exitReason: "hold",
      exitReturnPct: position.normalizedReturnPct,
    })),
  }));
  const metrics = aggregateResults(weekly);
  const reasons = disqualify(metrics);
  return {
    strategyId,
    strategyLabel: strategy.label,
    config,
    weekly,
    metrics,
    score: computeScore(metrics),
    disqualified: reasons.length > 0,
    disqualifyReasons: reasons,
  } satisfies StrategyComboResult;
}

function runExitConfig(
  strategyId: StrategyId,
  weeks: StrategyWeekInput[],
  config: ExitConfig,
) {
  const strategy = getStrategy(strategyId)!;
  const weekly = weeks.map((week) => {
    const simulated = simulateExit(week, config);
    return {
      weekOpenUtc: week.weekOpenUtc,
      weekLabel: week.weekLabel,
      tradeCount: week.tradeCount,
      changedVsBaseline: simulated.returnPct - week.fridayReturnPct,
      ...simulated,
    } satisfies WeekExitResult;
  });
  const metrics = aggregateResults(weekly);
  const reasons = disqualify(metrics);
  return {
    strategyId,
    strategyLabel: strategy.label,
    config,
    weekly,
    metrics,
    score: computeScore(metrics),
    disqualified: reasons.length > 0,
    disqualifyReasons: reasons,
  } satisfies StrategyComboResult;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   RISK MANAGEMENT MATRIX — FUNDED ACCOUNT RESEARCH             ║");
  console.log("║   All strategies × SL × TP × Trailing × Combined              ║");
  console.log("║   Engine: f2=adr_normalized (app parity)                      ║");
  console.log("║   Daily risk metric = EOD proxy, not intraday equity curve    ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  const weeks = await getClosedWeeks();
  if (weeks.length === 0) throw new Error("No closed weeks found.");

  console.log(`Closed weeks: ${weeks.length}`);
  console.log(`Window: ${weeks[0]?.slice(0, 10)} -> ${weeks[weeks.length - 1]?.slice(0, 10)}\n`);

  const weekInputsByStrategy = await buildStrategyWeekInputs(weeks);
  const baselineByStrategy = new Map<StrategyId, StrategyComboResult>();

  console.log("**Phase 1**");
  console.log("ADR-normalized baselines\n");
  console.log(
    "Strategy".padEnd(22),
    "Return".padEnd(10),
    "MaxDD".padEnd(10),
    "R/DD".padEnd(8),
    "LoseWk".padEnd(7),
    "WorstWk".padEnd(10),
    "WorstDay".padEnd(10),
    "Pairs".padEnd(7),
    "Notes",
  );
  console.log("-".repeat(100));

  const baselineRows: StrategyComboResult[] = [];
  for (const strategyId of STRATEGY_IDS) {
    const weekInputs = weekInputsByStrategy.get(strategyId);
    if (!weekInputs) continue;
    const baseline = buildBaselineResult(strategyId, weekInputs);
    baselineByStrategy.set(strategyId, baseline);
    baselineRows.push(baseline);
  }

  const sortedBaselineRows = [...baselineRows].sort((left, right) => {
    const leftRdd = left.metrics.returnToDrawdown ?? Number.POSITIVE_INFINITY;
    const rightRdd = right.metrics.returnToDrawdown ?? Number.POSITIVE_INFINITY;
    return rightRdd - leftRdd;
  });

  for (const row of sortedBaselineRows) {
    renderMetricsRow(
      row.strategyLabel,
      row.metrics,
      `score ${Number.isFinite(row.score) ? row.score.toFixed(2) : "∞"}${row.disqualified ? ` | dq:${row.disqualifyReasons.join(",")}` : ""}`,
    );
  }

  console.log("\nBaseline parity check vs engine:");
  const weeklyHold = getEntryStyle("weekly_hold")!;
  const adrOverlay = getStrengthGate("adr_normalized")!;
  for (const strategyId of STRATEGY_IDS) {
    const strategy = getStrategy(strategyId);
    const baseline = baselineByStrategy.get(strategyId);
    if (!strategy || !baseline) continue;
    const engine = await computeMultiWeekHold(strategy, weeks, weeklyHold, adrOverlay);
    const retDelta = baseline.metrics.totalReturnPct - round(engine.totalReturnPct);
    const ddDelta = baseline.metrics.maxDrawdownPct - round(engine.maxDrawdownPct);
    console.log(`  ${strategy.label}: return delta ${fmt(retDelta)} | DD delta ${fmt(ddDelta)}`);
  }

  console.log("\n**Phase 2**");
  console.log("Basket stop-loss sweep\n");
  const slByStrategy = new Map<StrategyId, StrategyComboResult[]>();
  for (const strategyId of STRATEGY_IDS) {
    const weeksForStrategy = weekInputsByStrategy.get(strategyId);
    if (!weeksForStrategy) continue;
    const results: StrategyComboResult[] = [];
    console.log(`${getStrategy(strategyId)!.label}`);
    console.log(
      "SL".padEnd(22),
      "Return".padEnd(10),
      "MaxDD".padEnd(10),
      "R/DD".padEnd(8),
      "LoseWk".padEnd(7),
      "WorstWk".padEnd(10),
      "WorstDay".padEnd(10),
      "Pairs".padEnd(7),
      "Notes",
    );
    console.log("-".repeat(100));
    for (const slLevel of STOP_LOSS_LEVELS) {
      const config: ExitConfig = {
        key: `sl_${Math.abs(slLevel)}`,
        label: `SL ${slLevel}%`,
        family: "sl",
        kind: "sl",
        slLevel,
      };
      const result = runExitConfig(strategyId, weeksForStrategy, config);
      results.push(result);
      renderMetricsRow(
        config.label,
        result.metrics,
        `hits ${result.metrics.slHits}/${result.weekly.length} | delta ${fmt(result.metrics.totalReturnPct - baselineByStrategy.get(strategyId)!.metrics.totalReturnPct)}`,
      );
    }
    console.log();
    slByStrategy.set(strategyId, rankFamily(results));
  }

  console.log("**Phase 3**");
  console.log("Basket TP sweep\n");
  const tpByStrategy = new Map<StrategyId, StrategyComboResult[]>();
  for (const strategyId of STRATEGY_IDS) {
    const weeksForStrategy = weekInputsByStrategy.get(strategyId);
    if (!weeksForStrategy) continue;
    const results: StrategyComboResult[] = [];
    console.log(`${getStrategy(strategyId)!.label}`);
    console.log(
      "TP".padEnd(22),
      "Return".padEnd(10),
      "MaxDD".padEnd(10),
      "R/DD".padEnd(8),
      "LoseWk".padEnd(7),
      "WorstWk".padEnd(10),
      "WorstDay".padEnd(10),
      "Pairs".padEnd(7),
      "Notes",
    );
    console.log("-".repeat(100));
    for (const tpMultiplier of TP_MULTIPLIERS) {
      const config: ExitConfig = {
        key: `tp_${tpMultiplier}`,
        label: `TP ${tpMultiplier}x`,
        family: "tp",
        kind: "tp",
        tpMultiplier,
        tpLevelLabel: `${BASKET_TP_PER_TRADE}% × trades × ${tpMultiplier}`,
      };
      const result = runExitConfig(strategyId, weeksForStrategy, config);
      results.push(result);
      renderMetricsRow(
        config.label,
        result.metrics,
        `hits ${result.metrics.tpHits}/${result.weekly.length} | delta ${fmt(result.metrics.totalReturnPct - baselineByStrategy.get(strategyId)!.metrics.totalReturnPct)}`,
      );
    }
    console.log();
    tpByStrategy.set(strategyId, rankFamily(results));
  }

  console.log("**Phase 4**");
  console.log("Basket trailing stop sweep\n");
  const trailByStrategy = new Map<StrategyId, StrategyComboResult[]>();
  for (const strategyId of STRATEGY_IDS) {
    const weeksForStrategy = weekInputsByStrategy.get(strategyId);
    if (!weeksForStrategy) continue;
    const results: StrategyComboResult[] = [];
    console.log(`${getStrategy(strategyId)!.label}`);
    console.log(
      "Trail".padEnd(22),
      "Return".padEnd(10),
      "MaxDD".padEnd(10),
      "R/DD".padEnd(8),
      "LoseWk".padEnd(7),
      "WorstWk".padEnd(10),
      "WorstDay".padEnd(10),
      "Pairs".padEnd(7),
      "Notes",
    );
    console.log("-".repeat(100));
    for (const activation of TRAIL_ACTIVATIONS) {
      for (const distance of TRAIL_DISTANCES) {
        const config: ExitConfig = {
          key: `trail_${activation}_${distance}`,
          label: `TR ${activation}/${distance}`,
          family: "trail",
          kind: "trail",
          trailActivation: activation,
          trailDistance: distance,
        };
        const result = runExitConfig(strategyId, weeksForStrategy, config);
        results.push(result);
        renderMetricsRow(
          config.label,
          result.metrics,
          `hits ${result.metrics.trailHits}/${result.weekly.length}`,
        );
      }
    }
    console.log();
    trailByStrategy.set(strategyId, rankFamily(results));
  }

  console.log("**Phase 5**");
  console.log("Combined shortlist\n");
  const combinedRows: StrategyComboResult[] = [];
  for (const strategyId of STRATEGY_IDS) {
    const weeksForStrategy = weekInputsByStrategy.get(strategyId);
    if (!weeksForStrategy) continue;

    const topSl = (slByStrategy.get(strategyId) ?? []).slice(0, TARGET_TOP_PER_FAMILY);
    const topTp = (tpByStrategy.get(strategyId) ?? []).slice(0, TARGET_TOP_PER_FAMILY);
    const topTrail = (trailByStrategy.get(strategyId) ?? []).slice(0, TARGET_TOP_PER_FAMILY);

    console.log(`${getStrategy(strategyId)!.label}`);
    console.log(
      "Combo".padEnd(22),
      "Return".padEnd(10),
      "MaxDD".padEnd(10),
      "R/DD".padEnd(8),
      "LoseWk".padEnd(7),
      "WorstWk".padEnd(10),
      "WorstDay".padEnd(10),
      "Pairs".padEnd(7),
      "Notes",
    );
    console.log("-".repeat(100));

    const localResults: StrategyComboResult[] = [];

    for (const sl of topSl) {
      for (const tp of topTp) {
        const config: ExitConfig = {
          key: `${sl.config.key}__${tp.config.key}`,
          label: `${sl.config.label} + ${tp.config.label}`,
          family: "combined",
          kind: "sl_tp",
          slLevel: sl.config.slLevel,
          tpMultiplier: tp.config.tpMultiplier,
        };
        localResults.push(runExitConfig(strategyId, weeksForStrategy, config));
      }
    }

    for (const sl of topSl) {
      for (const trail of topTrail) {
        const config: ExitConfig = {
          key: `${sl.config.key}__${trail.config.key}`,
          label: `${sl.config.label} + ${trail.config.label}`,
          family: "combined",
          kind: "sl_trail",
          slLevel: sl.config.slLevel,
          trailActivation: trail.config.trailActivation,
          trailDistance: trail.config.trailDistance,
        };
        localResults.push(runExitConfig(strategyId, weeksForStrategy, config));
      }
    }

    for (const tp of topTp) {
      for (const trail of topTrail) {
        const config: ExitConfig = {
          key: `${tp.config.key}__${trail.config.key}`,
          label: `${tp.config.label} + ${trail.config.label}`,
          family: "combined",
          kind: "tp_trail",
          tpMultiplier: tp.config.tpMultiplier,
          trailActivation: trail.config.trailActivation,
          trailDistance: trail.config.trailDistance,
        };
        localResults.push(runExitConfig(strategyId, weeksForStrategy, config));
      }
    }

    for (const sl of topSl) {
      for (const tp of topTp) {
        for (const trail of topTrail) {
          const config: ExitConfig = {
            key: `${sl.config.key}__${tp.config.key}__${trail.config.key}`,
            label: `${sl.config.label} + ${tp.config.label} + ${trail.config.label}`,
            family: "combined",
            kind: "sl_tp_trail",
            slLevel: sl.config.slLevel,
            tpMultiplier: tp.config.tpMultiplier,
            trailActivation: trail.config.trailActivation,
            trailDistance: trail.config.trailDistance,
          };
          localResults.push(runExitConfig(strategyId, weeksForStrategy, config));
        }
      }
    }

    const ranked = rankFamily(localResults);
    for (const result of ranked.slice(0, 8)) {
      renderMetricsRow(
        result.config.label,
        result.metrics,
        `hits sl:${result.metrics.slHits} tp:${result.metrics.tpHits} tr:${result.metrics.trailHits}`,
      );
      combinedRows.push(result);
    }
    console.log();
  }

  console.log("**Phase 6**");
  console.log("Final funded-account ranking\n");

  const allRows = [
    ...baselineRows,
    ...Array.from(slByStrategy.values()).flat(),
    ...Array.from(tpByStrategy.values()).flat(),
    ...Array.from(trailByStrategy.values()).flat(),
    ...combinedRows,
  ];

  const rankedFinal = [...allRows].sort((left, right) => {
    if (left.disqualified !== right.disqualified) return left.disqualified ? 1 : -1;
    if (right.score !== left.score) return right.score - left.score;
    return right.metrics.totalReturnPct - left.metrics.totalReturnPct;
  });

  console.log(
    "Rank".padEnd(6),
    "Strategy".padEnd(18),
    "Exit Config".padEnd(42),
    "Return".padEnd(10),
    "MaxDD".padEnd(10),
    "R/DD".padEnd(8),
    "Score".padEnd(8),
    "LoseWk".padEnd(8),
    "WorstWk".padEnd(10),
    "WorstDay".padEnd(10),
    "Pairs".padEnd(7),
    "Hits",
  );
  console.log("-".repeat(150));

  rankedFinal.slice(0, MAX_RANKED_COMBOS).forEach((row, index) => {
    console.log(
      String(index + 1).padEnd(6),
      row.strategyLabel.padEnd(18),
      row.config.label.padEnd(42),
      fmt(row.metrics.totalReturnPct).padEnd(10),
      fmt(row.metrics.maxDrawdownPct).padEnd(10),
      fmtR(row.metrics.returnToDrawdown).padEnd(8),
      `${Number.isFinite(row.score) ? row.score.toFixed(2) : "∞"}`.padEnd(8),
      String(row.metrics.losingWeeks).padEnd(8),
      fmt(row.metrics.worstWeekPct).padEnd(10),
      fmt(row.metrics.worstEodDayProxyPct).padEnd(10),
      `${row.metrics.avgPairsPerWeek.toFixed(1)}`.padEnd(7),
      `sl:${row.metrics.slHits} tp:${row.metrics.tpHits} tr:${row.metrics.trailHits}${row.disqualified ? ` | dq:${row.disqualifyReasons.join(",")}` : ""}`,
    );
  });

  console.log("\nTop-5 combo week detail:");
  for (const row of rankedFinal.slice(0, MAX_DIAGNOSTIC_COMBOS)) {
    console.log(`\n${row.strategyLabel} — ${row.config.label}`);
    console.log(
      "Week".padEnd(10),
      "Return".padEnd(10),
      "Exit".padEnd(8),
      "Day".padEnd(6),
      "DeltaVsBase".padEnd(12),
      "Daily path",
    );
    console.log("-".repeat(100));
    for (const week of row.weekly) {
      console.log(
        week.weekLabel.padEnd(10),
        fmt(week.returnPct).padEnd(10),
        week.exitReason.padEnd(8),
        String(week.exitDay == null ? "Fri" : `D${week.exitDay + 1}`).padEnd(6),
        fmt(week.changedVsBaseline).padEnd(12),
        week.managedBasketDailyPath.map((value) => fmt(value)).join("  "),
      );
    }

    console.log("Asset breakdown:");
    for (const assetClass of ["fx", "crypto", "indices", "commodities"]) {
      const metrics = row.metrics.byAssetClass[assetClass] ?? { returnPct: 0, trades: 0 };
      console.log(`  ${assetClass.padEnd(12)} ${fmt(metrics.returnPct).padStart(8)} | ${String(metrics.trades).padStart(3)} trades`);
    }

    console.log("Changed weeks vs baseline:");
    for (const week of row.weekly.filter((item) => Math.abs(item.changedVsBaseline) > 1e-9)) {
      console.log(`  ${week.weekLabel}: ${fmt(week.changedVsBaseline)} via ${week.exitReason}`);
    }

    console.log("Per-pair diagnostics for exit weeks:");
    for (const week of row.weekly.filter((item) => item.exitReason !== "hold")) {
      console.log(`  ${week.weekLabel} (${week.exitReason} ${week.exitDay == null ? "" : `D${week.exitDay + 1}`})`);
      for (const pair of week.pairDiagnostics) {
        console.log(
          `    ${pair.pair.padEnd(10)} ${pair.direction.padEnd(6)} raw ${fmt(pair.rawReturnPct).padEnd(9)} norm ${fmt(pair.normalizedReturnPct).padEnd(9)} exit ${fmt(pair.exitReturnPct).padEnd(9)} path ${pair.dailyPath.map((value) => fmt(value)).join("  ")}`,
        );
      }
    }
  }

  console.log("\nNotes:");
  console.log("  worst_day is an EOD proxy from daily close snapshots, not true intraday prop-firm equity DD.");
  console.log("  TP exits use threshold capture once day-close confirms the basket reached TP.");
  console.log("  trailing exits use threshold capture once day-close confirms the trail stop was breached.");
  console.log("  SL exits use day-close basket P&L on the breach day.");
}

main().catch((error) => {
  console.error("Risk management matrix failed:", error);
  process.exit(1);
});
