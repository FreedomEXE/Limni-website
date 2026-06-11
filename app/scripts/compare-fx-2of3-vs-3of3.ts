/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: compare-fx-2of3-vs-3of3.ts
 *
 * Description:
 * Apples-to-apples comparison of:
 *   - 3/3 NoComm FX-only (Tiered 3 NoComm, tier 1 only)
 *   - 2-of-3 NoComm FX-only
 *
 * The script reports:
 *   1. Unscaled ADR-normalized weekly-hold results
 *   2. Scaled single-entry basket management (1/5 + TR 1/0.5)
 *   3. Scaled additive basket management (base 1/5 + Tue/Wed 1/10, TR 1.25/0.5, S1)
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

type StrategyId = "tiered_3_nocomm" | "agree_2of3_nocomm";
type SleeveKind = "tier1_fx" | "agree_fx";
type ManagedMode = "single" | "additive";

type PositionWeekData = {
  symbol: string;
  assetClass: string;
  path: number[];
};

type WeekInput = {
  weekOpenUtc: string;
  weekLabel: string;
  positions: PositionWeekData[];
  basketPath: number[];
};

type Summary = {
  totalReturnPct: number;
  maxDrawdownPct: number;
  worstWeekPct: number;
  losingWeeks: number;
  avgPairsPerWeek: number;
  weeksHit1Pct?: number;
  worstEodDayProxyPct?: number;
  weeklyRows: Array<{ weekLabel: string; returnPct: number; pairCount: number }>;
};

const DAILY_BAR_DAYS = 7;

function fmt(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function sumPaths(paths: number[][]) {
  const maxLen = Math.max(0, ...paths.map((path) => path.length));
  const output: number[] = [];
  for (let index = 0; index < maxLen; index += 1) {
    let value = 0;
    for (const path of paths) {
      if (index < path.length) value += path[index]!;
      else if (path.length > 0) value += path[path.length - 1]!;
    }
    output.push(value);
  }
  return output;
}

function dailyChangesFromPath(path: number[]) {
  const changes: number[] = [];
  let previous = 0;
  for (const value of path) {
    changes.push(value - previous);
    previous = value;
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

function normalizeAssetClass(assetClass: string) {
  return assetClass.trim().toLowerCase();
}

function isFxTrade(trade: WeeklyHoldTrade) {
  return normalizeAssetClass(trade.assetClass) === "fx";
}

function buildWeekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd");
}

function buildDailyPath(
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

async function buildInputs(kind: SleeveKind) {
  const strategyId: StrategyId = kind === "tier1_fx" ? "tiered_3_nocomm" : "agree_2of3_nocomm";
  const weeklyHold = getEntryStyle("weekly_hold");
  const adrOverlay = getStrengthGate("adr_normalized");
  const strategy = getStrategy(strategyId);
  if (!weeklyHold || !adrOverlay || !strategy) {
    throw new Error(`Missing config for ${strategyId}.`);
  }

  const weeks = await getClosedWeeks();
  const weekResults = [];
  for (const weekOpenUtc of weeks) {
    weekResults.push(await computeWeeklyHold(strategy, weekOpenUtc, weeklyHold, adrOverlay));
  }

  const symbols = new Set<string>();
  for (const week of weekResults) {
    for (const trade of week.trades) {
      if (!isFxTrade(trade)) continue;
      if (kind === "tier1_fx" && trade.tier !== 1) continue;
      symbols.add(trade.symbol.toUpperCase());
    }
  }

  const barsByWeekSymbol = new Map<string, CanonicalPriceBar[]>();
  const adrByWeek = new Map<string, Awaited<ReturnType<typeof loadWeeklyAdrMap>>>();
  for (const weekOpenUtc of weeks) {
    adrByWeek.set(weekOpenUtc, await loadWeeklyAdrMap(weekOpenUtc));
    for (const symbol of symbols) {
      barsByWeekSymbol.set(`${weekOpenUtc}:${symbol}`, await loadBarsForWeekSymbol(weekOpenUtc, symbol));
    }
  }

  return weekResults.map((week) => {
    const adrMap = adrByWeek.get(week.weekOpenUtc)!;
    const positions = week.trades
      .filter(isFxTrade)
      .filter((trade) => kind !== "tier1_fx" || trade.tier === 1)
      .map((trade) => {
        const multiplier = getTargetAdrPct() / getAdrPct(adrMap, trade.symbol, trade.assetClass);
        const bars = barsByWeekSymbol.get(`${week.weekOpenUtc}:${trade.symbol.toUpperCase()}`) ?? [];
        return {
          symbol: trade.symbol.toUpperCase(),
          assetClass: trade.assetClass,
          path: buildDailyPath(trade, bars, multiplier),
        } satisfies PositionWeekData;
      });

    return {
      weekOpenUtc: week.weekOpenUtc,
      weekLabel: buildWeekLabel(week.weekOpenUtc),
      positions,
      basketPath: sumPaths(positions.map((position) => position.path)),
    } satisfies WeekInput;
  });
}

function summarizeUnscaled(weeks: WeekInput[]): Summary {
  const weeklyRows = weeks.map((week) => ({
    weekLabel: week.weekLabel,
    returnPct: week.basketPath.length > 0 ? week.basketPath[week.basketPath.length - 1]! : 0,
    pairCount: week.positions.length,
  }));
  const weeklyReturns = weeklyRows.map((row) => row.returnPct);
  return {
    totalReturnPct: weeklyReturns.reduce((sum, value) => sum + value, 0),
    maxDrawdownPct: computeMaxDrawdown(weeklyReturns),
    worstWeekPct: Math.min(...weeklyReturns),
    losingWeeks: weeklyReturns.filter((value) => value < 0).length,
    avgPairsPerWeek: weeks.reduce((sum, week) => sum + week.positions.length, 0) / weeks.length,
    weeklyRows,
  };
}

function applyTrailToPath(path: number[], activation: number, distance: number) {
  let peak = Number.NEGATIVE_INFINITY;
  let trailingActive = false;
  let exitDay: number | null = null;
  let exitReturnPct = path.length > 0 ? path[path.length - 1]! : 0;
  for (let dayIndex = 0; dayIndex < path.length; dayIndex += 1) {
    const value = path[dayIndex]!;
    peak = Math.max(peak, value);
    if (!trailingActive && peak >= activation) trailingActive = true;
    if (trailingActive && value <= peak - distance) {
      exitDay = dayIndex;
      exitReturnPct = value;
      break;
    }
  }
  if (exitDay === null) return [...path];
  return path.map((value, index) => (index <= exitDay ? value : exitReturnPct));
}

function summarizeManaged(weeks: WeekInput[], mode: ManagedMode): Summary {
  const weeklyRows: Array<{ weekLabel: string; returnPct: number; pairCount: number }> = [];
  let weeksHit1Pct = 0;
  let worstEodDayProxyPct = 0;

  for (const week of weeks) {
    let managedPath: number[] = [];

    if (mode === "single") {
      const scaledPaths = week.positions.map((position) => position.path.map((value) => value / 5));
      managedPath = applyTrailToPath(sumPaths(scaledPaths), 1.0, 0.5);
    } else {
      const layerFractions = [1 / 5, 1 / 10, 1 / 10];
      const layerDays = [0, 1, 2];
      const activeLayers = [{ startDay: 0, fraction: layerFractions[0]! }];
      let trailingActive = false;
      let peak = Number.NEGATIVE_INFINITY;

      const maxLen = Math.max(0, ...week.positions.map((position) => position.path.length));
      for (let dayIndex = 0; dayIndex < maxLen; dayIndex += 1) {
        if (dayIndex > 0 && !trailingActive) {
          const nextLayerIndex = activeLayers.length;
          const priorValue = managedPath.length > 0 ? managedPath[managedPath.length - 1]! : 0;
          if (
            nextLayerIndex < layerFractions.length
            && dayIndex === layerDays[nextLayerIndex]
            && priorValue >= -1.0
          ) {
            activeLayers.push({ startDay: dayIndex, fraction: layerFractions[nextLayerIndex]! });
          }
        }

        let dayValue = 0;
        for (const position of week.positions) {
          for (const layer of activeLayers) {
            const localIndex = dayIndex - layer.startDay;
            if (localIndex < 0 || position.path.length === 0) continue;
            if (localIndex < position.path.length) dayValue += position.path[localIndex]! * layer.fraction;
            else dayValue += position.path[position.path.length - 1]! * layer.fraction;
          }
        }

        managedPath.push(dayValue);
        peak = Math.max(peak, dayValue);
        if (!trailingActive && peak >= 1.25) trailingActive = true;
        if (trailingActive && dayValue <= peak - 0.5) {
          managedPath = managedPath.map((value, index) => (index <= dayIndex ? value : dayValue));
          break;
        }
      }
    }

    const returnPct = managedPath.length > 0 ? managedPath[managedPath.length - 1]! : 0;
    weeklyRows.push({
      weekLabel: week.weekLabel,
      returnPct,
      pairCount: week.positions.length,
    });

    if (returnPct >= 1) weeksHit1Pct += 1;
    for (const dayChange of dailyChangesFromPath(managedPath)) {
      worstEodDayProxyPct = Math.min(worstEodDayProxyPct, dayChange);
    }
  }

  const weeklyReturns = weeklyRows.map((row) => row.returnPct);
  return {
    totalReturnPct: weeklyReturns.reduce((sum, value) => sum + value, 0),
    maxDrawdownPct: computeMaxDrawdown(weeklyReturns),
    worstWeekPct: Math.min(...weeklyReturns),
    losingWeeks: weeklyReturns.filter((value) => value < 0).length,
    avgPairsPerWeek: weeks.reduce((sum, week) => sum + week.positions.length, 0) / weeks.length,
    weeksHit1Pct,
    worstEodDayProxyPct,
    weeklyRows,
  };
}

function printSummary(label: string, summary: Summary, managed = false) {
  const base = `total ${fmt(summary.totalReturnPct)}, max DD ${fmt(summary.maxDrawdownPct)}, worst week ${fmt(summary.worstWeekPct)}, losing weeks ${summary.losingWeeks}, avg pairs/week ${summary.avgPairsPerWeek.toFixed(1)}`;
  if (!managed) {
    console.log(`${label}: ${base}`);
    return;
  }
  console.log(`${label}: ${base}, hit >=1% ${summary.weeksHit1Pct}/10, worst EOD day ${fmt(summary.worstEodDayProxyPct ?? 0)}`);
}

async function main() {
  const scenarios = [
    { label: "3/3 FX-only (Tier 1)", kind: "tier1_fx" as const },
    { label: "2-of-3 FX-only", kind: "agree_fx" as const },
  ];

  for (const scenario of scenarios) {
    const weeks = await buildInputs(scenario.kind);
    console.log(`\n=== ${scenario.label} ===`);
    printSummary("Unscaled ADR weekly hold", summarizeUnscaled(weeks));
    printSummary("Scaled single 1/5 + TR 1/0.5", summarizeManaged(weeks, "single"), true);
    printSummary("Scaled additive P2 + TR 1.25/0.5 + S1", summarizeManaged(weeks, "additive"), true);
    console.log(
      "Weekly path:",
      summarizeUnscaled(weeks).weeklyRows
        .map((row) => `${row.weekLabel} ${fmt(row.returnPct)} (${row.pairCount})`)
        .join(" | "),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
