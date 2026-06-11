/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-additive-layering.ts
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
type SafetyRule = { key: "S0" | "S1" | "S2"; label: string; threshold: number | null };
type TrailConfig = { key: string; label: string; activation: number; distance: number };
type AddPlan = { key: string; label: string; fractions: number[] };

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
};

type ComboResult = {
  label: string;
  plan: AddPlan;
  trail: TrailConfig;
  safety: SafetyRule;
  weekly: WeekResult[];
  metrics: AggregateMetrics;
  isBenchmark: boolean;
};

const STRATEGY_ID = "agree_2of3_nocomm";
const DAILY_BAR_DAYS = 7;
const WEEKDAY_LAYER_LIMIT = 5;

const ADD_PLANS: AddPlan[] = [
  { key: "P1", label: "Base 1/5 + Tue 1/10", fractions: [1 / 5, 1 / 10] },
  { key: "P2", label: "Base 1/5 + Tue/Wed 1/10", fractions: [1 / 5, 1 / 10, 1 / 10] },
  { key: "P3", label: "Base 1/5 + Tue/Wed 1/15", fractions: [1 / 5, 1 / 15, 1 / 15] },
  { key: "P4", label: "Base 1/5 + Tue/Wed/Thu 1/15", fractions: [1 / 5, 1 / 15, 1 / 15, 1 / 15] },
  { key: "P5", label: "Base 1/5 + Tue 1/10 + Wed 1/15", fractions: [1 / 5, 1 / 10, 1 / 15] },
];

const TRAIL_CONFIGS: TrailConfig[] = [
  { key: "TR_1_0.5", label: "TR 1/0.5", activation: 1.0, distance: 0.5 },
  { key: "TR_0.75_0.5", label: "TR 0.75/0.5", activation: 0.75, distance: 0.5 },
  { key: "TR_1.25_0.5", label: "TR 1.25/0.5", activation: 1.25, distance: 0.5 },
];

const SAFETY_RULES: SafetyRule[] = [
  { key: "S0", label: "No safety", threshold: null },
  { key: "S1", label: "Skip if < -1%", threshold: -1 },
  { key: "S2", label: "Skip if < -0.5%", threshold: -0.5 },
];

const BENCHMARK_PLAN: AddPlan = { key: "BM", label: "Single 1/5 Monday", fractions: [1 / 5] };
const BENCHMARK_TRAIL: TrailConfig = { key: "TR_1_0.5", label: "TR 1/0.5", activation: 1.0, distance: 0.5 };
const BENCHMARK_SAFETY: SafetyRule = { key: "S0", label: "No safety", threshold: null };

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

function simulateWeek(
  week: StrategyWeekInput,
  plan: AddPlan,
  trail: TrailConfig,
  safety: SafetyRule,
): WeekResult {
  const layers: Array<{ dayEntered: number; fraction: number }> = [];
  const dailyTotals: number[] = [];
  let priorClosePnl = 0;
  let trailActive = false;
  let activationDay: number | null = null;
  let peak = Number.NEGATIVE_INFINITY;
  let exitReason: ExitReason = "hold";
  let exitDay: number | null = null;
  let exitReturnPct = 0;

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

    const actualTotal = layers.reduce((sum, layer) => {
      return sum + week.positions.reduce((layerSum, position) => {
        const entryPrice = entryPriceForLayer(position, layer.dayEntered);
        if (entryPrice == null) return layerSum;
        return layerSum + positionContributionAtDay(position, dayIndex, entryPrice, week.scaleFactor, layer.fraction);
      }, 0);
    }, 0);

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

function buildComboResult(
  weeks: StrategyWeekInput[],
  plan: AddPlan,
  trail: TrailConfig,
  safety: SafetyRule,
  isBenchmark = false,
) {
  const weekly = weeks.map((week) => simulateWeek(week, plan, trail, safety));
  return {
    label: `${plan.label} | ${trail.label} | ${safety.key}`,
    plan,
    trail,
    safety,
    weekly,
    metrics: aggregateResults(weekly),
    isBenchmark,
  } satisfies ComboResult;
}

function explainDelta(addWeek: WeekResult, benchmarkWeek: WeekResult) {
  const delta = round(addWeek.returnPct - benchmarkWeek.returnPct);
  if (Math.abs(delta) < 0.05) return "Same";
  if (delta > 0) {
    if (addWeek.exposureUsed > benchmarkWeek.exposureUsed + 1e-6) return "Additive better: more exposure on slow week";
    return "Additive better";
  }
  if (addWeek.exposureUsed > benchmarkWeek.exposureUsed + 1e-6 && addWeek.returnPct < 0) {
    return "Additive worse: sized into loser";
  }
  return "Additive worse";
}

function renderPhase1Row(combo: ComboResult) {
  console.log(
    combo.plan.key.padEnd(4),
    combo.trail.label.padEnd(12),
    combo.safety.key.padEnd(4),
    fmt(combo.metrics.totalReturnPct).padEnd(10),
    fmt(combo.metrics.maxDrawdownPct).padEnd(10),
    fmtR(combo.metrics.returnToDrawdown).padEnd(8),
    String(combo.metrics.weeksHit1Pct).padEnd(7),
    String(combo.metrics.losingWeeks).padEnd(7),
    fmt(combo.metrics.worstWeekPct).padEnd(10),
    fmt(combo.metrics.worstEodDayProxyPct).padEnd(10),
    `${combo.metrics.avgLayersUsed.toFixed(2)}`.padEnd(8),
    `${combo.metrics.avgExposureUsed.toFixed(3)}`.padEnd(9),
    String(combo.metrics.trailActivations).padEnd(7),
    `${combo.metrics.avgTrailActivationDay == null ? "n/a" : combo.metrics.avgTrailActivationDay.toFixed(2)}`.padEnd(8),
    combo.isBenchmark ? "benchmark" : "",
  );
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   ADDITIVE LAYERING RESEARCH                                    ║");
  console.log("║   2-of-3 NoComm — keep 1/5 Monday, add only if no trail yet     ║");
  console.log("║   Engine: f2=adr_normalized (app parity)                        ║");
  console.log("║   Goal: improve slow weeks without breaking the fast-week winner ║");
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
  console.log(`  Benchmark target from scaled research: +30.68% | DD -1.76% | 9/10 target weeks\n`);

  const benchmark = buildComboResult(weekInputs, BENCHMARK_PLAN, BENCHMARK_TRAIL, BENCHMARK_SAFETY, true);
  console.log(`  Additive benchmark recompute: ${fmt(benchmark.metrics.totalReturnPct)} | DD ${fmt(benchmark.metrics.maxDrawdownPct)} | ${benchmark.metrics.weeksHit1Pct}/10 target weeks\n`);

  const combos: ComboResult[] = [];
  for (const plan of ADD_PLANS) {
    for (const trail of TRAIL_CONFIGS) {
      for (const safety of SAFETY_RULES) {
        combos.push(buildComboResult(weekInputs, plan, trail, safety));
      }
    }
  }
  combos.sort(compareCombos);

  console.log("**Phase 1**");
  console.log("Additive layering vs single-entry benchmark\n");
  console.log(
    "Plan".padEnd(4),
    "Trail".padEnd(12),
    "Safe".padEnd(4),
    "Return".padEnd(10),
    "MaxDD".padEnd(10),
    "R/DD".padEnd(8),
    "Wk>=1".padEnd(7),
    "Lose".padEnd(7),
    "Worst".padEnd(10),
    "WorstDay".padEnd(10),
    "AvgLyr".padEnd(8),
    "AvgExp".padEnd(9),
    "Actv".padEnd(7),
    "ActvDay".padEnd(8),
    "Notes",
  );
  console.log("-".repeat(135));
  renderPhase1Row(benchmark);
  for (const combo of combos) renderPhase1Row(combo);

  const topFive = combos.slice(0, 5);

  console.log("\n**Phase 2**");
  console.log("Week-by-week for top 5 + benchmark\n");
  for (const combo of [benchmark, ...topFive]) {
    console.log(`${combo.isBenchmark ? "BENCHMARK" : "ADDITIVE"} — ${combo.label}`);
    console.log(
      "Week".padEnd(10),
      "Return".padEnd(10),
      "Exit".padEnd(8),
      "Day".padEnd(6),
      "Layers".padEnd(8),
      "Exposure".padEnd(10),
      "Target".padEnd(8),
      "Daily total P&L path",
    );
    console.log("-".repeat(145));
    for (const week of combo.weekly) {
      console.log(
        week.weekLabel.padEnd(10),
        fmt(week.returnPct).padEnd(10),
        week.exitReason.padEnd(8),
        String(week.exitDay == null ? "Fri" : `D${week.exitDay + 1}`).padEnd(6),
        `${week.layersUsed}/${week.maxLayers}`.padEnd(8),
        `${week.exposureUsed.toFixed(3)}`.padEnd(10),
        (week.hitTarget ? "hit" : "miss").padEnd(8),
        week.managedPath.map((value) => fmt(value)).join("  "),
      );
      const layerDetail = week.layerStates
        .map((layer) => `D${layer.dayEntered + 1} ${layer.fraction.toFixed(4)} -> ${fmt(layer.scaledPnlAtExit)}`)
        .join(" | ");
      console.log(`  layers: ${layerDetail || "none"}`);
    }
    console.log();
  }

  console.log("**Phase 3**");
  console.log("Top additive config vs benchmark impact analysis\n");
  const topCombo = topFive[0]!;
  console.log(`Top additive: ${topCombo.label}`);
  console.log(
    "Week".padEnd(10),
    "Single".padEnd(10),
    "Add".padEnd(10),
    "Delta".padEnd(10),
    "Why different",
  );
  console.log("-".repeat(90));
  for (let index = 0; index < benchmark.weekly.length; index += 1) {
    const baseWeek = benchmark.weekly[index]!;
    const addWeek = topCombo.weekly[index]!;
    console.log(
      baseWeek.weekLabel.padEnd(10),
      fmt(baseWeek.returnPct).padEnd(10),
      fmt(addWeek.returnPct).padEnd(10),
      fmt(round(addWeek.returnPct - baseWeek.returnPct)).padEnd(10),
      explainDelta(addWeek, baseWeek),
    );
  }

  console.log("\nNotes:");
  console.log("  This test keeps the proven 1/5 Monday entry and only adds exposure if the trailing activation has not triggered.");
  console.log("  Safety checks use prior close state only; no same-day lookahead.");
  console.log("  Total exposure can rise above 1/5 on slower weeks, so this is intentionally riskier than the benchmark.");
}

main().catch((error) => {
  console.error("Additive layering research failed:", error);
  process.exit(1);
});
