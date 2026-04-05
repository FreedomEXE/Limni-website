/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-per-trade-sl.ts
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
import { computeWeeklyHold, type WeeklyHoldTrade } from "../src/lib/performance/weeklyHoldEngine";
import { getDisplayWeekOpenUtc } from "../src/lib/weekAnchor";

type ExitReason = "hold" | "trail";
type SafetyRule = { key: "S1"; label: string; threshold: number | null };
type TrailConfig = { key: string; label: string; activation: number; distance: number };
type AddPlan = { key: string; label: string; fractions: number[] };
type SlConfig = {
  key: string;
  label: string;
  threshold: number | null;
};

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
  maxLayers: number;
  exposureUsed: number;
  layerStates: LayerState[];
};

type PerPairSlState = {
  symbol: string;
  layerDay: number;
  stoppedAtDay: number | null;
  lockedContribution: number;
  worstContributionBeforeSl: number;
  finalContributionNoSl: number;
  activeAtExitContribution: number;
};

type StoppedPairRecord = {
  symbol: string;
  layerDay: number;
  stoppedAtDay: number;
  worstContributionBeforeSl: number;
  finalContributionNoSl: number;
};

type SlWeekResult = WeekResult & {
  slConfig: SlConfig;
  pairsStoppedCount: number;
  layerStopsCount: number;
  worstPairContribution: number;
  stoppedPairs: StoppedPairRecord[];
};

type AggregateMetrics = {
  totalReturnPct: number;
  maxDrawdownPct: number;
  returnToDrawdown: number | null;
  weeksHit1Pct: number;
  losingWeeks: number;
  worstWeekPct: number;
  worstEodDayProxyPct: number;
  avgStopsPerWeek: number;
  avgPairsStoppedPerWeek: number;
};

const STRATEGY_ID = "agree_2of3_nocomm";
const DAILY_BAR_DAYS = 7;
const WEEKDAY_LAYER_LIMIT = 5;

const FIXED_PLAN: AddPlan = { key: "P2", label: "Base 1/5 + Tue/Wed 1/10", fractions: [1 / 5, 1 / 10, 1 / 10] };
const FIXED_TRAIL: TrailConfig = { key: "TR_1.25_0.5", label: "TR 1.25/0.5", activation: 1.25, distance: 0.5 };
const FIXED_SAFETY: SafetyRule = { key: "S1", label: "Skip if < -1%", threshold: -1 };
const SL_CONFIGS: SlConfig[] = [
  { key: "NONE", label: "NONE", threshold: null },
  { key: "SL_2.0", label: "SL_2.0", threshold: 2.0 },
  { key: "SL_1.5", label: "SL_1.5", threshold: 1.5 },
  { key: "SL_1.0", label: "SL_1.0", threshold: 1.0 },
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

async function getClosedWeeks() {
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const weeks = await listDataSectionWeeks();
  return weeks
    .sort((left, right) => left.localeCompare(right))
    .filter((week) => week < currentWeekOpenUtc)
    .slice(-10);
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

function buildStateKey(symbol: string, layerDay: number) {
  return `${symbol}:${layerDay}`;
}

function simulateWeek(
  week: StrategyWeekInput,
  plan: AddPlan,
  trail: TrailConfig,
  safety: SafetyRule,
  slConfig: SlConfig,
): SlWeekResult {
  const layers: Array<{ dayEntered: number; fraction: number }> = [];
  const pairStates = new Map<string, PerPairSlState>();
  const dailyTotals: number[] = [];
  let priorClosePnl = 0;
  let trailActive = false;
  let activationDay: number | null = null;
  let peak = Number.NEGATIVE_INFINITY;
  let exitReason: ExitReason = "hold";
  let exitDay: number | null = null;
  let exitReturnPct = 0;
  let worstPairContribution = 0;

  const decisionDays = Math.min(WEEKDAY_LAYER_LIMIT, week.maxDayCount, plan.fractions.length);

  for (let dayIndex = 0; dayIndex < week.maxDayCount; dayIndex += 1) {
    if (!trailActive && dayIndex < decisionDays) {
      const fraction = plan.fractions[dayIndex]!;
      const allowLayer = dayIndex === 0 || safety.threshold == null || priorClosePnl >= safety.threshold;
      if (allowLayer) {
        const hasData = week.positions.some((position) => entryPriceForLayer(position, dayIndex) != null);
        if (hasData) layers.push({ dayEntered: dayIndex, fraction });
      }
    }

    let actualTotal = 0;
    for (const layer of layers) {
      for (const position of week.positions) {
        const entryPrice = entryPriceForLayer(position, layer.dayEntered);
        if (entryPrice == null) continue;

        const key = buildStateKey(position.symbol, layer.dayEntered);
        let state = pairStates.get(key);
        if (!state) {
          state = {
            symbol: position.symbol,
            layerDay: layer.dayEntered,
            stoppedAtDay: null,
            lockedContribution: 0,
            worstContributionBeforeSl: 0,
            finalContributionNoSl: 0,
            activeAtExitContribution: 0,
          };
          pairStates.set(key, state);
        }

        const currentContribution = positionContributionAtDay(
          position,
          dayIndex,
          entryPrice,
          week.scaleFactor,
          layer.fraction,
        );

        state.worstContributionBeforeSl = Math.min(state.worstContributionBeforeSl, currentContribution);
        state.finalContributionNoSl = currentContribution;
        worstPairContribution = Math.min(worstPairContribution, currentContribution);

        if (
          slConfig.threshold != null
          && state.stoppedAtDay == null
          && currentContribution <= -slConfig.threshold
        ) {
          state.stoppedAtDay = dayIndex;
          state.lockedContribution = -slConfig.threshold;
        }

        const contribution = state.stoppedAtDay == null ? currentContribution : state.lockedContribution;
        state.activeAtExitContribution = contribution;
        actualTotal += contribution;
      }
    }

    dailyTotals.push(actualTotal);
    priorClosePnl = actualTotal;

    if (!trailActive && actualTotal >= trail.activation) {
      trailActive = true;
      activationDay = dayIndex;
      peak = actualTotal;
      continue;
    }

    if (trailActive) {
      peak = Math.max(peak, actualTotal);
      const stopLevel = peak - trail.distance;
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

  const stoppedPairs = [...pairStates.values()]
    .filter((state) => state.stoppedAtDay != null)
    .map((state) => ({
      symbol: state.symbol,
      layerDay: state.layerDay,
      stoppedAtDay: state.stoppedAtDay!,
      worstContributionBeforeSl: round(state.worstContributionBeforeSl),
      finalContributionNoSl: round(state.finalContributionNoSl),
    }))
    .sort((left, right) => left.worstContributionBeforeSl - right.worstContributionBeforeSl);

  const stoppedSymbols = new Set(stoppedPairs.map((pair) => pair.symbol));

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
    maxLayers: plan.fractions.length,
    exposureUsed: round(layers.reduce((sum, layer) => sum + layer.fraction, 0), 4),
    layerStates: layers.map((layer) => {
      let actualContribution = 0;
      for (const position of week.positions) {
        const state = pairStates.get(buildStateKey(position.symbol, layer.dayEntered));
        if (state) actualContribution += state.activeAtExitContribution;
      }
      return {
        dayEntered: layer.dayEntered,
        fraction: layer.fraction,
        scaledPnlAtExit: round(actualContribution * exitScale),
      };
    }),
    slConfig,
    pairsStoppedCount: stoppedSymbols.size,
    layerStopsCount: stoppedPairs.length,
    worstPairContribution: round(worstPairContribution),
    stoppedPairs,
  };
}

function aggregateResults(weekly: SlWeekResult[]): AggregateMetrics {
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
    avgStopsPerWeek: round(weekly.reduce((sum, week) => sum + week.layerStopsCount, 0) / weekly.length, 2),
    avgPairsStoppedPerWeek: round(weekly.reduce((sum, week) => sum + week.pairsStoppedCount, 0) / weekly.length, 2),
  };
}

function renderSummaryRow(
  label: string,
  metrics: AggregateMetrics,
  deltaVsNone: number | null,
) {
  console.log(
    label.padEnd(8),
    fmt(metrics.totalReturnPct).padEnd(10),
    fmt(metrics.maxDrawdownPct).padEnd(10),
    fmtR(metrics.returnToDrawdown).padEnd(8),
    String(metrics.weeksHit1Pct).padEnd(6),
    String(metrics.losingWeeks).padEnd(7),
    fmt(metrics.worstWeekPct).padEnd(10),
    `${metrics.avgStopsPerWeek.toFixed(1)}`.padEnd(10),
    `${metrics.avgPairsStoppedPerWeek.toFixed(1)}`.padEnd(12),
    deltaVsNone == null ? "—" : fmt(deltaVsNone).padEnd(12),
  );
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║ PER-TRADE STOP LOSS IMPACT — 2-of-3 NoComm P2 TR1.25/0.5 S1     ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  const strategy = getStrategy(STRATEGY_ID);
  if (!strategy) throw new Error(`Missing strategy ${STRATEGY_ID}.`);

  const weeks = await getClosedWeeks();
  const weekInputs = await buildWeekInputs(weeks);
  if (weekInputs.length === 0) throw new Error("No closed weeks found.");

  const weeklyResults = new Map<string, SlWeekResult[]>();
  for (const slConfig of SL_CONFIGS) {
    weeklyResults.set(
      slConfig.key,
      weekInputs.map((week) => simulateWeek(week, FIXED_PLAN, FIXED_TRAIL, FIXED_SAFETY, slConfig)),
    );
  }

  const metricsByKey = new Map<string, AggregateMetrics>();
  for (const slConfig of SL_CONFIGS) {
    metricsByKey.set(slConfig.key, aggregateResults(weeklyResults.get(slConfig.key)!));
  }

  const noneMetrics = metricsByKey.get("NONE")!;
  const noneWeekly = weeklyResults.get("NONE")!;

  console.log(`Closed weeks: ${weekInputs.length}`);
  console.log(`Window: ${weekInputs[0]!.weekOpenUtc.slice(0, 10)} -> ${weekInputs[weekInputs.length - 1]!.weekOpenUtc.slice(0, 10)}`);
  console.log(`Fixed config: ${FIXED_PLAN.key} | ${FIXED_TRAIL.label} | ${FIXED_SAFETY.key}\n`);

  console.log("Section 1 — Summary Table\n");
  console.log(
    "SL".padEnd(8),
    "Return".padEnd(10),
    "MaxDD".padEnd(10),
    "R/DD".padEnd(8),
    "Wins".padEnd(6),
    "Losses".padEnd(7),
    "Worst Wk".padEnd(10),
    "Stops/Wk".padEnd(10),
    "Avg Stopped".padEnd(12),
    "Delta vs None",
  );
  console.log("-".repeat(105));
  for (const slConfig of SL_CONFIGS) {
    const metrics = metricsByKey.get(slConfig.key)!;
    const delta = slConfig.key === "NONE" ? null : round(metrics.totalReturnPct - noneMetrics.totalReturnPct);
    renderSummaryRow(slConfig.label, metrics, delta);
  }

  const noneParity = round(noneMetrics.totalReturnPct - 41.27);
  console.log(`\nParity check vs additive benchmark target (+41.27%): ${fmt(noneMetrics.totalReturnPct)} (${noneParity >= 0 ? "+" : ""}${noneParity.toFixed(2)} pts)`);

  console.log("\nSection 2 — Per-Week Comparison\n");
  console.log(
    "Week".padEnd(12),
    "NONE".padEnd(10),
    "SL_2.0".padEnd(10),
    "SL_1.5".padEnd(10),
    "SL_1.0".padEnd(10),
    "Stops@2%".padEnd(10),
    "Stops@1.5%".padEnd(12),
    "Stops@1%",
  );
  console.log("-".repeat(96));
  for (let index = 0; index < weekInputs.length; index += 1) {
    const noneWeek = weeklyResults.get("NONE")![index]!;
    const sl2Week = weeklyResults.get("SL_2.0")![index]!;
    const sl15Week = weeklyResults.get("SL_1.5")![index]!;
    const sl1Week = weeklyResults.get("SL_1.0")![index]!;
    console.log(
      noneWeek.weekLabel.padEnd(12),
      fmt(noneWeek.returnPct).padEnd(10),
      fmt(sl2Week.returnPct).padEnd(10),
      fmt(sl15Week.returnPct).padEnd(10),
      fmt(sl1Week.returnPct).padEnd(10),
      String(sl2Week.layerStopsCount).padEnd(10),
      String(sl15Week.layerStopsCount).padEnd(12),
      String(sl1Week.layerStopsCount),
    );
  }

  console.log("\nSection 3 — Worst Offender Pairs (2% threshold)\n");
  console.log(
    "Week".padEnd(12),
    "Symbol".padEnd(10),
    "Layer".padEnd(8),
    "Worst Contrib".padEnd(15),
    "Stopped Day".padEnd(13),
    "Final Contrib (no SL)",
  );
  console.log("-".repeat(90));

  const stoppedAtTwoPct = weeklyResults.get("SL_2.0")!
    .flatMap((week) => week.stoppedPairs.map((pair) => ({ weekLabel: week.weekLabel, ...pair })))
    .sort((left, right) => left.worstContributionBeforeSl - right.worstContributionBeforeSl);

  if (stoppedAtTwoPct.length === 0) {
    console.log("No pair-layers hit the 2% threshold.");
  } else {
    for (const pair of stoppedAtTwoPct) {
      console.log(
        pair.weekLabel.padEnd(12),
        pair.symbol.padEnd(10),
        `D${pair.layerDay + 1}`.padEnd(8),
        fmt(pair.worstContributionBeforeSl).padEnd(15),
        `D${pair.stoppedAtDay + 1}`.padEnd(13),
        fmt(pair.finalContributionNoSl),
      );
    }
  }

  const mar22None = noneWeekly.find((week) => week.weekOpenUtc.startsWith("2026-03-22"));
  const mar22Sl2 = weeklyResults.get("SL_2.0")!.find((week) => week.weekOpenUtc.startsWith("2026-03-22"));
  if (mar22None && mar22Sl2) {
    console.log("\nMar 22 focus:");
    console.log(`  NONE  : ${fmt(mar22None.returnPct)} | stops ${mar22None.layerStopsCount}`);
    console.log(`  SL_2.0: ${fmt(mar22Sl2.returnPct)} | stops ${mar22Sl2.layerStopsCount}`);
  }
}

main().catch((error) => {
  console.error("Per-trade stop loss backtest failed:", error);
  process.exit(1);
});
