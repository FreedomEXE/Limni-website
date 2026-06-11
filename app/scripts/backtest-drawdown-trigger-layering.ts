/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-drawdown-trigger-layering.ts
 *
 * Description:
 * Focused research pass on 2-of-3 NoComm using drawdown-triggered additive
 * layers instead of fixed Tuesday/Wednesday adds.
 *
 * Rules:
 *   - Base entry: 1/5 on Monday
 *   - Adds: triggered from PRIOR DAILY CLOSE basket P&L only
 *   - Fill timing: next day's daily open
 *   - No basket stop-loss in this pass
 *   - Trail fixed to the current additive winner: TR 1.25 / 0.5
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
import { getEntryStyle, getStrategy, getStrengthGate } from "../src/lib/performance/strategyConfig";
import { computeMultiWeekHold, computeWeeklyHold, type WeeklyHoldTrade } from "../src/lib/performance/weeklyHoldEngine";
import { getDisplayWeekOpenUtc } from "../src/lib/weekAnchor";

type ExitReason = "hold" | "trail";
type TrailConfig = { key: string; label: string; activation: number; distance: number };
type TriggerPlan = { key: string; label: string; fractions: number[]; triggers: number[] };

type PositionWeekData = {
  symbol: string;
  assetClass: string;
  direction: "LONG" | "SHORT";
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

type LayerState = {
  dayEntered: number;
  fraction: number;
  trigger: number | null;
  scaledPnlAtExit: number;
};

type WeekResult = {
  weekOpenUtc: string;
  weekLabel: string;
  returnPct: number;
  exitReason: ExitReason;
  exitDay: number | null;
  activationDay: number | null;
  managedPath: number[];
  dailyChanges: number[];
  hitTarget: boolean;
  layersUsed: number;
  exposureUsed: number;
  layerStates: LayerState[];
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
  avgExposureUsed: number;
  trailActivations: number;
  avgTrailActivationDay: number | null;
  triggerEvents: number;
};

type ComboResult = {
  label: string;
  weekly: WeekResult[];
  metrics: AggregateMetrics;
  planType: "benchmark_single" | "benchmark_calendar" | "drawdown";
  planLabel: string;
};

const STRATEGY_ID = "agree_2of3_nocomm";
const DAILY_BAR_DAYS = 7;
const TRAIL: TrailConfig = { key: "TR_1.25_0.5", label: "TR 1.25/0.5", activation: 1.25, distance: 0.5 };

const DRAW_PLANS: TriggerPlan[] = [
  { key: "D1_A", label: "1 add @ -0.25", fractions: [1 / 5, 1 / 10], triggers: [-0.25] },
  { key: "D1_B", label: "1 add @ -0.50", fractions: [1 / 5, 1 / 10], triggers: [-0.5] },
  { key: "D1_C", label: "1 add @ -0.75", fractions: [1 / 5, 1 / 10], triggers: [-0.75] },
  { key: "D1_D", label: "1 add @ -1.00", fractions: [1 / 5, 1 / 10], triggers: [-1.0] },
  { key: "D2_A", label: "2 adds @ -0.25 / -0.50", fractions: [1 / 5, 1 / 10, 1 / 10], triggers: [-0.25, -0.5] },
  { key: "D2_B", label: "2 adds @ -0.25 / -0.75", fractions: [1 / 5, 1 / 10, 1 / 10], triggers: [-0.25, -0.75] },
  { key: "D2_C", label: "2 adds @ -0.50 / -1.00", fractions: [1 / 5, 1 / 10, 1 / 10], triggers: [-0.5, -1.0] },
  { key: "D2_D", label: "2 adds @ -0.50 / -1.50", fractions: [1 / 5, 1 / 10, 1 / 10], triggers: [-0.5, -1.5] },
  { key: "D2_E", label: "2 adds @ -0.75 / -1.50", fractions: [1 / 5, 1 / 10, 1 / 10], triggers: [-0.75, -1.5] },
];

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

async function buildWeekInputs(weeks: string[]) {
  const weeklyHold = getEntryStyle("weekly_hold");
  const adrOverlay = getStrengthGate("adr_normalized");
  const strategy = getStrategy(STRATEGY_ID);
  if (!weeklyHold || !adrOverlay || !strategy) {
    throw new Error("Missing weekly_hold, adr_normalized, or strategy config.");
  }

  const weekResults = [];
  for (const weekOpenUtc of weeks) {
    weekResults.push(await computeWeeklyHold(strategy, weekOpenUtc, weeklyHold, adrOverlay));
  }

  const allSymbols = new Set<string>();
  for (const week of weekResults) {
    for (const trade of week.trades) allSymbols.add(trade.symbol.toUpperCase());
  }

  const barsByWeekSymbol = new Map<string, CanonicalPriceBar[]>();
  const adrByWeek = new Map<string, Awaited<ReturnType<typeof loadWeeklyAdrMap>>>();
  for (const weekOpenUtc of weeks) {
    adrByWeek.set(weekOpenUtc, await loadWeeklyAdrMap(weekOpenUtc));
    for (const symbol of allSymbols) {
      barsByWeekSymbol.set(`${weekOpenUtc}:${symbol}`, await loadBarsForWeekSymbol(weekOpenUtc, symbol));
    }
  }

  return weekResults.map((week) => {
    const adrMap = adrByWeek.get(week.weekOpenUtc)!;
    const positions = week.trades.map((trade) => {
      const bars = barsByWeekSymbol.get(`${week.weekOpenUtc}:${trade.symbol.toUpperCase()}`) ?? [];
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

    const unscaledMondayPaths = week.trades.map((trade) => {
      const position = positions.find((item) => item.symbol === trade.symbol.toUpperCase())!;
      return buildDailyPathFromMonday(trade, position.bars, position.multiplier);
    });
    const reconstructedPath = sumPaths(unscaledMondayPaths);
    const engineFridayReturnPct = week.trades.reduce((sum, trade) => sum + trade.returnPct, 0);
    const reconstructedFridayReturnPct =
      reconstructedPath.length > 0 ? reconstructedPath[reconstructedPath.length - 1]! : engineFridayReturnPct;
    const scaleFactor =
      Math.abs(reconstructedFridayReturnPct) > 1e-9
        ? engineFridayReturnPct / reconstructedFridayReturnPct
        : 1;

    return {
      weekOpenUtc: week.weekOpenUtc,
      weekLabel: buildWeekLabel(week.weekOpenUtc),
      positions,
      scaleFactor,
      maxDayCount: Math.max(0, ...positions.map((position) => position.bars.length)),
    } satisfies StrategyWeekInput;
  });
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

function simulateBenchmarkSingle(week: StrategyWeekInput): WeekResult {
  const layers = [{ dayEntered: 0, fraction: 1 / 5, trigger: null as number | null }];
  const dailyTotals: number[] = [];
  let trailActive = false;
  let activationDay: number | null = null;
  let peak = Number.NEGATIVE_INFINITY;
  let exitReason: ExitReason = "hold";
  let exitDay: number | null = null;
  let exitReturnPct = 0;

  for (let dayIndex = 0; dayIndex < week.maxDayCount; dayIndex += 1) {
    const actualTotal = week.positions.reduce((sum, position) => {
      const entryPrice = entryPriceForLayer(position, 0);
      if (entryPrice == null) return sum;
      return sum + positionContributionAtDay(position, dayIndex, entryPrice, week.scaleFactor, 1 / 5);
    }, 0);

    dailyTotals.push(actualTotal);

    if (!trailActive && actualTotal >= 1.0) {
      trailActive = true;
      activationDay = dayIndex;
      peak = actualTotal;
      continue;
    }

    if (trailActive) {
      peak = Math.max(peak, actualTotal);
      const stopLevel = peak - 0.5;
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
    exitReason,
    exitDay,
    activationDay,
    managedPath: managedPath.map((value) => round(value)),
    dailyChanges: dailyChangesFromPath(managedPath).map((value) => round(value)),
    hitTarget: exitReturnPct >= 1,
    layersUsed: 1,
    exposureUsed: round(1 / 5, 4),
    layerStates: layers.map((layer) => {
      let actualContribution = 0;
      for (const position of week.positions) {
        const entryPrice = entryPriceForLayer(position, 0);
        if (entryPrice == null) continue;
        actualContribution += positionContributionAtDay(
          position,
          exitDay == null ? Math.max(week.maxDayCount - 1, 0) : exitDay,
          entryPrice,
          week.scaleFactor,
          layer.fraction,
        );
      }
      return {
        dayEntered: layer.dayEntered,
        fraction: layer.fraction,
        trigger: null,
        scaledPnlAtExit: round(actualContribution * exitScale),
      };
    }),
  };
}

function simulateBenchmarkCalendar(week: StrategyWeekInput): WeekResult {
  const fractions = [1 / 5, 1 / 10, 1 / 10];
  const layers: Array<{ dayEntered: number; fraction: number; trigger: number | null }> = [];
  const dailyTotals: number[] = [];
  let priorClosePnl = 0;
  let trailActive = false;
  let activationDay: number | null = null;
  let peak = Number.NEGATIVE_INFINITY;
  let exitReason: ExitReason = "hold";
  let exitDay: number | null = null;
  let exitReturnPct = 0;

  const decisionDays = Math.min(week.maxDayCount, fractions.length);
  for (let dayIndex = 0; dayIndex < week.maxDayCount; dayIndex += 1) {
    if (!trailActive && dayIndex < decisionDays) {
      const fraction = fractions[dayIndex]!;
      const allowLayer = dayIndex === 0 || priorClosePnl >= -1.0;
      if (allowLayer) {
        const hasData = week.positions.some((position) => entryPriceForLayer(position, dayIndex) != null);
        if (hasData) layers.push({ dayEntered: dayIndex, fraction, trigger: null });
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

    if (!trailActive && actualTotal >= TRAIL.activation) {
      trailActive = true;
      activationDay = dayIndex;
      peak = actualTotal;
      continue;
    }

    if (trailActive) {
      peak = Math.max(peak, actualTotal);
      const stopLevel = peak - TRAIL.distance;
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
    exitReason,
    exitDay,
    activationDay,
    managedPath: managedPath.map((value) => round(value)),
    dailyChanges: dailyChangesFromPath(managedPath).map((value) => round(value)),
    hitTarget: exitReturnPct >= 1,
    layersUsed: layers.length,
    exposureUsed: round(layers.reduce((sum, layer) => sum + layer.fraction, 0), 4),
    layerStates: layers.map((layer) => {
      let actualContribution = 0;
      for (const position of week.positions) {
        const entryPrice = entryPriceForLayer(position, layer.dayEntered);
        if (entryPrice == null) continue;
        actualContribution += positionContributionAtDay(
          position,
          exitDay == null ? Math.max(week.maxDayCount - 1, 0) : exitDay,
          entryPrice,
          week.scaleFactor,
          layer.fraction,
        );
      }
      return {
        dayEntered: layer.dayEntered,
        fraction: layer.fraction,
        trigger: null,
        scaledPnlAtExit: round(actualContribution * exitScale),
      };
    }),
  };
}

function simulateDrawdownPlan(week: StrategyWeekInput, plan: TriggerPlan): WeekResult {
  const layers: Array<{ dayEntered: number; fraction: number; trigger: number | null }> = [
    { dayEntered: 0, fraction: plan.fractions[0]!, trigger: null },
  ];
  const dailyTotals: number[] = [];
  let priorClosePnl = 0;
  let trailActive = false;
  let activationDay: number | null = null;
  let peak = Number.NEGATIVE_INFINITY;
  let exitReason: ExitReason = "hold";
  let exitDay: number | null = null;
  let exitReturnPct = 0;

  for (let dayIndex = 0; dayIndex < week.maxDayCount; dayIndex += 1) {
    if (!trailActive && dayIndex > 0) {
      const nextLayerIndex = layers.length;
      if (nextLayerIndex < plan.fractions.length && nextLayerIndex - 1 < plan.triggers.length) {
        const trigger = plan.triggers[nextLayerIndex - 1]!;
        if (priorClosePnl <= trigger) {
          const hasData = week.positions.some((position) => entryPriceForLayer(position, dayIndex) != null);
          if (hasData) {
            layers.push({
              dayEntered: dayIndex,
              fraction: plan.fractions[nextLayerIndex]!,
              trigger,
            });
          }
        }
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

    if (!trailActive && actualTotal >= TRAIL.activation) {
      trailActive = true;
      activationDay = dayIndex;
      peak = actualTotal;
      continue;
    }

    if (trailActive) {
      peak = Math.max(peak, actualTotal);
      const stopLevel = peak - TRAIL.distance;
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
    exitReason,
    exitDay,
    activationDay,
    managedPath: managedPath.map((value) => round(value)),
    dailyChanges: dailyChangesFromPath(managedPath).map((value) => round(value)),
    hitTarget: exitReturnPct >= 1,
    layersUsed: layers.length,
    exposureUsed: round(layers.reduce((sum, layer) => sum + layer.fraction, 0), 4),
    layerStates: layers.map((layer) => {
      let actualContribution = 0;
      for (const position of week.positions) {
        const entryPrice = entryPriceForLayer(position, layer.dayEntered);
        if (entryPrice == null) continue;
        actualContribution += positionContributionAtDay(
          position,
          exitDay == null ? Math.max(week.maxDayCount - 1, 0) : exitDay,
          entryPrice,
          week.scaleFactor,
          layer.fraction,
        );
      }
      return {
        dayEntered: layer.dayEntered,
        fraction: layer.fraction,
        trigger: layer.trigger,
        scaledPnlAtExit: round(actualContribution * exitScale),
      };
    }),
  };
}

function aggregateResults(weekly: WeekResult[]): AggregateMetrics {
  const returns = weekly.map((week) => week.returnPct);
  const totalReturnPct = returns.reduce((sum, value) => sum + value, 0);
  const maxDrawdownPct = computeMaxDrawdown(returns);
  const activationDays = weekly
    .map((week) => (week.activationDay == null ? null : week.activationDay + 1))
    .filter((value): value is number => value != null);

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
    avgExposureUsed: round(weekly.reduce((sum, week) => sum + week.exposureUsed, 0) / weekly.length, 4),
    trailActivations: activationDays.length,
    avgTrailActivationDay:
      activationDays.length > 0 ? round(activationDays.reduce((sum, day) => sum + day, 0) / activationDays.length, 2) : null,
    triggerEvents: weekly.reduce((sum, week) => sum + Math.max(0, week.layersUsed - 1), 0),
  };
}

function compareCombos(left: ComboResult, right: ComboResult) {
  if (right.metrics.weeksHit1Pct !== left.metrics.weeksHit1Pct) {
    return right.metrics.weeksHit1Pct - left.metrics.weeksHit1Pct;
  }
  if (left.metrics.losingWeeks !== right.metrics.losingWeeks) {
    return left.metrics.losingWeeks - right.metrics.losingWeeks;
  }
  const leftRdd = left.metrics.returnToDrawdown ?? Number.POSITIVE_INFINITY;
  const rightRdd = right.metrics.returnToDrawdown ?? Number.POSITIVE_INFINITY;
  if (rightRdd !== leftRdd) return rightRdd - leftRdd;
  return right.metrics.totalReturnPct - left.metrics.totalReturnPct;
}

function buildCombo(planType: ComboResult["planType"], planLabel: string, weekly: WeekResult[]) {
  return {
    label: planLabel,
    weekly,
    metrics: aggregateResults(weekly),
    planType,
    planLabel,
  } satisfies ComboResult;
}

function renderRow(combo: ComboResult) {
  console.log(
    combo.planType.padEnd(18),
    combo.planLabel.padEnd(28),
    fmt(combo.metrics.totalReturnPct).padEnd(10),
    fmt(combo.metrics.maxDrawdownPct).padEnd(10),
    fmtR(combo.metrics.returnToDrawdown).padEnd(8),
    String(combo.metrics.weeksHit1Pct).padEnd(7),
    String(combo.metrics.losingWeeks).padEnd(7),
    fmt(combo.metrics.worstWeekPct).padEnd(10),
    fmt(combo.metrics.worstEodDayProxyPct).padEnd(10),
    `${combo.metrics.avgLayersUsed.toFixed(2)}`.padEnd(8),
    `${combo.metrics.avgExposureUsed.toFixed(3)}`.padEnd(9),
    String(combo.metrics.triggerEvents).padEnd(9),
    `${combo.metrics.avgTrailActivationDay == null ? "n/a" : combo.metrics.avgTrailActivationDay.toFixed(2)}`.padEnd(8),
  );
}

function explainDelta(drawWeek: WeekResult, baselineWeek: WeekResult) {
  const delta = round(drawWeek.returnPct - baselineWeek.returnPct);
  if (Math.abs(delta) < 0.05) return "Same";
  if (delta > 0) {
    if (drawWeek.exposureUsed > baselineWeek.exposureUsed + 1e-6) return "Drawdown adds helped";
    return "Better";
  }
  if (drawWeek.exposureUsed > baselineWeek.exposureUsed + 1e-6 && drawWeek.returnPct < 0) {
    return "Averaged into loser";
  }
  return "Worse";
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   DRAWDOWN-TRIGGER LAYERING RESEARCH                            ║");
  console.log("║   2-of-3 NoComm — add from prior close basket drawdown          ║");
  console.log("║   Trail fixed: TR 1.25 / 0.5                                    ║");
  console.log("║   No basket stop-loss in this pass                              ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  const strategy = getStrategy(STRATEGY_ID);
  if (!strategy) throw new Error(`Missing strategy ${STRATEGY_ID}.`);

  const weeks = await getClosedWeeks();
  const weekInputs = await buildWeekInputs(weeks);
  if (weekInputs.length === 0) throw new Error("No closed weeks found.");

  console.log(`Closed weeks: ${weekInputs.length}`);
  console.log(`Window: ${weekInputs[0]!.weekOpenUtc.slice(0, 10)} -> ${weekInputs[weekInputs.length - 1]!.weekOpenUtc.slice(0, 10)}\n`);

  const weeklyHold = getEntryStyle("weekly_hold")!;
  const adrOverlay = getStrengthGate("adr_normalized")!;
  const engine = await computeMultiWeekHold(strategy, weeks, weeklyHold, adrOverlay);
  console.log("Baseline parity");
  console.log(`  Unscaled engine reference: ${fmt(round(engine.totalReturnPct))} | DD ${fmt(round(engine.maxDrawdownPct))}`);
  console.log("  Existing execution references:");
  console.log("    Single 1/5 + TR 1/0.5: +30.68% | DD -1.76% | 9/10 target weeks");
  console.log("    Calendar additive P2 + TR 1.25/0.5 + S1: +41.27% | DD -1.76% | 9/10 target weeks\n");

  const benchmarkSingle = buildCombo(
    "benchmark_single",
    "Single 1/5 + TR 1/0.5",
    weekInputs.map((week) => simulateBenchmarkSingle(week)),
  );
  const benchmarkCalendar = buildCombo(
    "benchmark_calendar",
    "Calendar P2 + TR 1.25/0.5 + S1",
    weekInputs.map((week) => simulateBenchmarkCalendar(week)),
  );

  const combos = DRAW_PLANS.map((plan) =>
    buildCombo(
      "drawdown",
      `${plan.label} + ${TRAIL.label}`,
      weekInputs.map((week) => simulateDrawdownPlan(week, plan)),
    ),
  ).sort(compareCombos);

  console.log("**Phase 1**");
  console.log("Drawdown-triggered adds vs single-entry and calendar-additive baselines\n");
  console.log(
    "Type".padEnd(18),
    "Plan".padEnd(28),
    "Return".padEnd(10),
    "MaxDD".padEnd(10),
    "R/DD".padEnd(8),
    "Wk>=1".padEnd(7),
    "Lose".padEnd(7),
    "Worst".padEnd(10),
    "WorstDay".padEnd(10),
    "AvgLyr".padEnd(8),
    "AvgExp".padEnd(9),
    "Triggers".padEnd(9),
    "ActvDay".padEnd(8),
  );
  console.log("-".repeat(132));
  renderRow(benchmarkSingle);
  renderRow(benchmarkCalendar);
  for (const combo of combos) renderRow(combo);

  const best = combos[0]!;

  console.log("\n**Phase 2**");
  console.log("Week-by-week best drawdown plan vs calendar additive benchmark\n");
  console.log(`Best drawdown plan: ${best.planLabel}`);
  console.log(
    "Week".padEnd(10),
    "DrawRet".padEnd(10),
    "CalRet".padEnd(10),
    "Delta".padEnd(10),
    "DrawExp".padEnd(10),
    "CalExp".padEnd(10),
    "DrawLayers".padEnd(11),
    "Notes",
  );
  console.log("-".repeat(96));
  for (let index = 0; index < best.weekly.length; index += 1) {
    const drawWeek = best.weekly[index]!;
    const calWeek = benchmarkCalendar.weekly[index]!;
    console.log(
      drawWeek.weekLabel.padEnd(10),
      fmt(drawWeek.returnPct).padEnd(10),
      fmt(calWeek.returnPct).padEnd(10),
      fmt(round(drawWeek.returnPct - calWeek.returnPct)).padEnd(10),
      `${drawWeek.exposureUsed.toFixed(3)}`.padEnd(10),
      `${calWeek.exposureUsed.toFixed(3)}`.padEnd(10),
      String(drawWeek.layersUsed).padEnd(11),
      explainDelta(drawWeek, calWeek),
    );
  }

  console.log("\n**Phase 3**");
  console.log("Best plan layer details by week\n");
  for (const week of best.weekly) {
    const layerText = week.layerStates
      .map((layer) => {
        const day = layer.dayEntered + 1;
        const triggerText = layer.trigger == null ? "base" : `trigger ${layer.trigger.toFixed(2)}%`;
        return `D${day}:${layer.fraction.toFixed(3)} (${triggerText})`;
      })
      .join(", ");
    console.log(
      `${week.weekLabel}: ${fmt(week.returnPct)} | layers ${week.layersUsed} | exposure ${week.exposureUsed.toFixed(3)} | ${layerText}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
