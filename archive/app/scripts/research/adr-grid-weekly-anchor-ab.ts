/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * Compare current production ADR Grid anchoring against a canonical weekly-open
 * grid map while keeping the same execution fill window.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { DateTime } from "luxon";
import { listDataSectionWeeks } from "../../src/lib/dataSectionWeeks";
import { getDisplayWeekOpenUtc } from "../../src/lib/weekAnchor";
import { buildDataWeekOptions } from "../../src/lib/weekOptions";
import { getExecutionWeekWindow } from "../../src/lib/executionPriceWindows";
import { getCanonicalWeeklyPairReturns, getExecutionWeeklyPairReturns } from "../../src/lib/pairReturns";
import { getEntryStyle, getRiskOverlay, getStrategy, type StrategyConfig } from "../../src/lib/performance/strategyConfig";
import { computeWeeklyHold, type CanonicalSignal, type WeeklyHoldResult, type WeeklyHoldTrade } from "../../src/lib/performance/weeklyHoldEngine";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "../../src/lib/performance/adrLookup";
import { loadPathBars } from "../../src/lib/performance/pathBarLoader";
import type { CanonicalPriceBar } from "../../src/lib/canonicalPriceBars";
import type { AssetClass } from "../../src/lib/cotMarkets";
import { buildWeeklyHoldLedger } from "../../src/lib/performance/positionLedger";
import { computeBasketPath, computeMultiWeekBasketPath, type BasketPathResult } from "../../src/lib/performance/basketPathEngine";
import { computeReturnSharpe, dailyReturnsFromPath } from "../../src/lib/performance/performanceMetricBasis";

const ADR_GRID_SPACING = 0.20;
const ADR_GRID_RESET_ADR = 1.0;
const ADR_GRID_MAX_LEVELS_PER_SIDE = 50;
const PAIR_FILL_CAP_LIMIT = 3;

type Direction = "LONG" | "SHORT";
type CapMode = "pair_fill_cap" | "none";
type VariantId =
  | "current_app"
  | "legacy_execution_anchor"
  | "weekly_market_anchor"
  | "weekly_market_anchor_center"
  | "execution_anchor_weekly_center";

type GridTemplate = {
  symbol: string;
  assetClass: AssetClass;
  direction: Direction;
  source: string;
  tier: number | null;
  openPrice: number;
  centerPrice: number | null;
  pairAdrPct: number;
  weightMultiplier: number;
  executionWindowOpenUtc: string;
  executionWindowCloseUtc: string;
};

type GridLevel = {
  index: number;
  side: "center" | "favorable" | "continuation";
  triggerPrice: number;
  weight: number;
};

type GridFill = {
  levelIndex: number;
  entryPrice: number;
  entryTimeUtc: string;
  entryBarIndex: number;
  weight: number;
  active: boolean;
};

type GridEngine = GridTemplate & {
  levels: GridLevel[];
  fills: GridFill[];
  levelArmed: boolean[];
  levelRearmBarIndex: number[];
  cycleHighPrice: number;
  cycleLowPrice: number;
  closedForWeek: boolean;
  closeGridIndex: number;
};

type GridTimeline = {
  exactBars: Array<CanonicalPriceBar | null>;
  markBars: Array<CanonicalPriceBar | null>;
};

type VariantWeek = {
  weekOpenUtc: string;
  result: WeeklyHoldResult;
  path: BasketPathResult;
};

type VariantSummary = {
  variantId: VariantId;
  capMode: CapMode;
  weeks: VariantWeek[];
  totalReturnPct: number;
  pathMaxDrawdownPct: number;
  returnToDd: number;
  pathSharpe: number;
  trades: number;
  gridTpCount: number;
  resetCount: number;
  weekCloseCount: number;
  activeCount: number;
};

function normalizeAssetClass(value: string | null | undefined): AssetClass {
  return value === "indices" || value === "commodities" || value === "crypto" || value === "fx"
    ? value
    : "fx";
}

function mergeExecutionBoundaries(weekOpenUtc: string, assetClasses: AssetClass[]) {
  const windows = assetClasses.map((assetClass) => getExecutionWeekWindow(weekOpenUtc, assetClass));
  if (windows.length === 0) {
    const fallback = getExecutionWeekWindow(weekOpenUtc, "fx");
    return {
      executionWindowOpenUtc: fallback.windowOpenUtc,
      executionWindowCloseUtc: fallback.windowCloseUtc,
    };
  }

  let openMs = Number.POSITIVE_INFINITY;
  let closeMs = Number.NEGATIVE_INFINITY;
  let openIso = windows[0]!.windowOpenUtc;
  let closeIso = windows[0]!.windowCloseUtc;
  for (const window of windows) {
    const currentOpenMs = Date.parse(window.windowOpenUtc);
    const currentCloseMs = Date.parse(window.windowCloseUtc);
    if (Number.isFinite(currentOpenMs) && currentOpenMs < openMs) {
      openMs = currentOpenMs;
      openIso = window.windowOpenUtc;
    }
    if (Number.isFinite(currentCloseMs) && currentCloseMs > closeMs) {
      closeMs = currentCloseMs;
      closeIso = window.windowCloseUtc;
    }
  }
  return {
    executionWindowOpenUtc: openIso,
    executionWindowCloseUtc: closeIso,
  };
}

function buildGridTimestamps(weekOpenUtc: string, weekCloseUtc: string) {
  const start = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const end = DateTime.fromISO(weekCloseUtc, { zone: "utc" });
  if (!start.isValid || !end.isValid || end < start) return [weekOpenUtc];

  const grid: string[] = [];
  let cursor = start.startOf("hour");
  const final = end.startOf("hour");
  while (cursor <= final) {
    grid.push(cursor.toUTC().toISO() ?? weekOpenUtc);
    cursor = cursor.plus({ hours: 1 });
  }
  return grid;
}

function normalizeIso(value: string) {
  const parsed = DateTime.fromISO(value, { zone: "utc" });
  return parsed.isValid ? parsed.toUTC().toISO() ?? value : value;
}

function findGridIndexAtOrBefore(grid: string[], timestampUtc: string) {
  const targetMs = Date.parse(timestampUtc);
  if (!Number.isFinite(targetMs)) return Math.max(0, grid.length - 1);
  for (let index = grid.length - 1; index >= 0; index -= 1) {
    const tsMs = Date.parse(grid[index] ?? "");
    if (Number.isFinite(tsMs) && tsMs <= targetMs) return index;
  }
  return 0;
}

function buildLevels(template: GridTemplate): GridLevel[] {
  const levels: GridLevel[] = [];
  const step = (ADR_GRID_SPACING * template.pairAdrPct) / 100;
  const weight = ADR_GRID_SPACING * template.weightMultiplier;
  let index = 0;

  if (template.centerPrice !== null && Number.isFinite(template.centerPrice) && template.centerPrice > 0) {
    levels.push({
      index: index++,
      side: "center",
      triggerPrice: template.centerPrice,
      weight,
    });
  }

  for (let i = 1; i <= ADR_GRID_MAX_LEVELS_PER_SIDE; i += 1) {
    levels.push({
      index: index++,
      side: "favorable",
      triggerPrice: template.direction === "LONG"
        ? template.openPrice * (1 - i * step)
        : template.openPrice * (1 + i * step),
      weight,
    });
  }
  for (let i = 1; i <= ADR_GRID_MAX_LEVELS_PER_SIDE; i += 1) {
    levels.push({
      index: index++,
      side: "continuation",
      triggerPrice: template.direction === "LONG"
        ? template.openPrice * (1 + i * step)
        : template.openPrice * (1 - i * step),
      weight,
    });
  }
  return levels;
}

function buildEngine(template: GridTemplate): GridEngine {
  const levels = buildLevels(template);
  return {
    ...template,
    levels,
    fills: [],
    levelArmed: levels.map(() => true),
    levelRearmBarIndex: levels.map(() => -1),
    cycleHighPrice: template.openPrice,
    cycleLowPrice: template.openPrice,
    closedForWeek: false,
    closeGridIndex: -1,
  };
}

function directedRawReturnPct(direction: Direction, entryPrice: number, exitPrice: number) {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(exitPrice) || exitPrice <= 0) return 0;
  const raw = ((exitPrice - entryPrice) / entryPrice) * 100;
  return direction === "SHORT" ? -raw : raw;
}

function activePairFillCount(engine: GridEngine) {
  return engine.fills.filter((fill) => fill.active).length;
}

function activeWeight(engine: GridEngine) {
  return engine.fills.reduce((sum, fill) => sum + (fill.active ? fill.weight : 0), 0);
}

function getMark(engine: GridEngine, timelines: Map<string, GridTimeline>, barIndex: number) {
  return timelines.get(engine.symbol)?.markBars[barIndex]?.closePrice ?? engine.openPrice;
}

function closeFill(params: {
  trades: WeeklyHoldTrade[];
  engine: GridEngine;
  fill: GridFill;
  exitPrice: number;
  exitTimeUtc: string;
  exitReason: string;
  tradeNumber: number;
}) {
  const { trades, engine, fill, exitPrice, exitTimeUtc, exitReason, tradeNumber } = params;
  const rawWeighted = directedRawReturnPct(engine.direction, fill.entryPrice, exitPrice) * fill.weight;
  const adrMultiplier = getTargetAdrPct() / engine.pairAdrPct;
  const normalizedWeighted = rawWeighted * adrMultiplier;
  fill.active = false;
  trades.push({
    symbol: engine.symbol,
    assetClass: engine.assetClass,
    direction: engine.direction,
    openPrice: fill.entryPrice,
    closePrice: exitPrice,
    rawReturnPct: rawWeighted,
    normalizedReturnPct: normalizedWeighted,
    displayReturnPct: normalizedWeighted,
    returnPct: normalizedWeighted,
    returnMode: "normalized",
    source: engine.source,
    tier: engine.tier,
    weight: fill.weight,
    adrPct: engine.pairAdrPct,
    adrMultiplier,
    detail: {
      tradeNumber,
      entryTimeUtc: fill.entryTimeUtc,
      exitTimeUtc,
      exitReason,
      anchorPrice: engine.openPrice,
      tpPrice: exitReason === "grid_tp" ? exitPrice : null,
      adrPct: engine.pairAdrPct,
      maePct: null,
    },
  });
}

function buildTimelines(symbols: string[], bars: Map<string, CanonicalPriceBar[]>, grid: string[]) {
  const timelines = new Map<string, GridTimeline>();
  for (const symbol of symbols) {
    const symbolBars = bars.get(symbol) ?? [];
    const byClose = new Map(symbolBars.map((bar) => [normalizeIso(bar.barCloseUtc), bar]));
    const exactBars: Array<CanonicalPriceBar | null> = [];
    const markBars: Array<CanonicalPriceBar | null> = [];
    let last: CanonicalPriceBar | null = null;
    for (const tsUtc of grid) {
      const exact = byClose.get(normalizeIso(tsUtc)) ?? null;
      if (exact) last = exact;
      exactBars.push(exact);
      markBars.push(last);
    }
    timelines.set(symbol, { exactBars, markBars });
  }
  return timelines;
}

async function computePathForWeek(result: WeeklyHoldResult) {
  const ledger = await buildWeeklyHoldLedger(result, { entryStyleId: "adr_grid" });
  const symbols = Array.from(new Set(ledger.legs.map((leg) => leg.symbol))).sort();
  const bars = await loadPathBars(symbols, ledger.weekOpenUtc, ledger.weekCloseUtc, "1h");
  return computeBasketPath(ledger, bars, { returnMode: "normalized" });
}

async function currentAppWeek(params: {
  strategy: StrategyConfig;
  weekOpenUtc: string;
  capMode: CapMode;
}): Promise<VariantWeek> {
  const entryStyle = getEntryStyle("adr_grid");
  const riskOverlay = params.capMode === "pair_fill_cap" ? getRiskOverlay("pair_fill_cap") : getRiskOverlay("none");
  if (!entryStyle) throw new Error("Missing adr_grid entry style");
  const result = await withQuietConsole(() =>
    computeWeeklyHold(params.strategy, params.weekOpenUtc, entryStyle, riskOverlay),
  );
  return {
    weekOpenUtc: params.weekOpenUtc,
    result,
    path: await computePathForWeek(result),
  };
}

async function customGridWeek(params: {
  strategy: StrategyConfig;
  weekOpenUtc: string;
  capMode: CapMode;
  signals: CanonicalSignal[];
  gridAnchorSource: "execution" | "canonical";
  includeWeeklyCenter: boolean;
}): Promise<VariantWeek> {
  const [canonicalReturns, executionReturns] = await Promise.all([
    getCanonicalWeeklyPairReturns(params.weekOpenUtc),
    getExecutionWeeklyPairReturns(params.weekOpenUtc),
  ]);
  const canonicalReturnMap = new Map(canonicalReturns.map((row) => [row.symbol.toUpperCase(), row]));
  const executionReturnMap = new Map(executionReturns.map((row) => [row.symbol.toUpperCase(), row]));
  const adrMap = await loadWeeklyAdrMap(params.weekOpenUtc);

  const templates: GridTemplate[] = [];
  for (const signal of params.signals) {
    const pair = signal.symbol.toUpperCase();
    const priceData = params.gridAnchorSource === "canonical"
      ? canonicalReturnMap.get(pair)
      : executionReturnMap.get(pair);
    const centerPriceData = canonicalReturnMap.get(pair);
    if (!priceData || !Number.isFinite(priceData.openPrice) || priceData.openPrice <= 0) continue;
    const assetClass = normalizeAssetClass(priceData.assetClass ?? signal.assetClass);
    const executionBoundary = getExecutionWeekWindow(params.weekOpenUtc, assetClass);
    const centerPrice = params.includeWeeklyCenter
      && centerPriceData
      && Number.isFinite(centerPriceData.openPrice)
      && centerPriceData.openPrice > 0
        ? centerPriceData.openPrice
        : null;
    templates.push({
      symbol: pair,
      assetClass,
      direction: signal.direction,
      source: signal.source,
      tier: signal.tier,
      openPrice: priceData.openPrice,
      centerPrice,
      pairAdrPct: getAdrPct(adrMap, pair, assetClass),
      weightMultiplier: 1,
      executionWindowOpenUtc: executionBoundary.windowOpenUtc,
      executionWindowCloseUtc: executionBoundary.windowCloseUtc,
    });
  }

  const resultBoundaries = mergeExecutionBoundaries(
    params.weekOpenUtc,
    templates.length > 0 ? templates.map((template) => template.assetClass) : ["fx"],
  );
  const symbols = Array.from(new Set(templates.map((template) => template.symbol))).sort();
  const bars = await loadPathBars(
    symbols,
    resultBoundaries.executionWindowOpenUtc,
    resultBoundaries.executionWindowCloseUtc,
    "1h",
  );
  const grid = buildGridTimestamps(resultBoundaries.executionWindowOpenUtc, resultBoundaries.executionWindowCloseUtc);
  const timelines = buildTimelines(symbols, bars, grid);
  const engines = templates.map((template) => {
    const engine = buildEngine(template);
    engine.closeGridIndex = findGridIndexAtOrBefore(grid, template.executionWindowCloseUtc);
    return engine;
  });

  const trades: WeeklyHoldTrade[] = [];
  let tradeNumber = 1;

  for (let barIndex = 0; barIndex < grid.length; barIndex += 1) {
    const tsUtc = grid[barIndex] ?? resultBoundaries.executionWindowOpenUtc;
    for (const engine of engines) {
      const bar = timelines.get(engine.symbol)?.exactBars[barIndex] ?? null;
      if (engine.closedForWeek || barIndex > engine.closeGridIndex) continue;

      if (bar) {
        for (const level of engine.levels) {
          if (!engine.levelArmed[level.index]) continue;
          if (engine.levelRearmBarIndex[level.index]! >= barIndex) continue;
          const triggered = level.side === "center"
            ? bar.lowPrice <= level.triggerPrice && bar.highPrice >= level.triggerPrice
            : level.side === "favorable"
              ? (engine.direction === "LONG" ? bar.lowPrice <= level.triggerPrice : bar.highPrice >= level.triggerPrice)
              : (engine.direction === "LONG" ? bar.highPrice >= level.triggerPrice : bar.lowPrice <= level.triggerPrice);
          if (!triggered) continue;
          if (params.capMode === "pair_fill_cap" && activePairFillCount(engine) >= PAIR_FILL_CAP_LIMIT) continue;

          engine.fills.push({
            levelIndex: level.index,
            entryPrice: level.triggerPrice,
            entryTimeUtc: tsUtc,
            entryBarIndex: barIndex,
            weight: level.weight,
            active: true,
          });
          engine.levelArmed[level.index] = false;
        }

        const targetMove = (ADR_GRID_SPACING * engine.pairAdrPct) / 100;
        for (const fill of engine.fills) {
          if (!fill.active || barIndex <= fill.entryBarIndex) continue;
          const targetPrice = engine.direction === "SHORT"
            ? fill.entryPrice * (1 - targetMove)
            : fill.entryPrice * (1 + targetMove);
          const targetHit = engine.direction === "SHORT"
            ? bar.lowPrice <= targetPrice
            : bar.highPrice >= targetPrice;
          if (!targetHit) continue;

          closeFill({
            trades,
            engine,
            fill,
            exitPrice: targetPrice,
            exitTimeUtc: tsUtc,
            exitReason: "grid_tp",
            tradeNumber: tradeNumber++,
          });
          engine.levelArmed[fill.levelIndex] = true;
          engine.levelRearmBarIndex[fill.levelIndex] = barIndex;
        }

        engine.cycleHighPrice = Math.max(engine.cycleHighPrice, bar.highPrice);
        engine.cycleLowPrice = Math.min(engine.cycleLowPrice, bar.lowPrice);
        if (activeWeight(engine) > 1e-9) {
          const resetMove = (ADR_GRID_RESET_ADR * engine.pairAdrPct) / 100;
          const closeTarget = engine.direction === "SHORT"
            ? engine.cycleHighPrice * (1 - resetMove)
            : engine.cycleLowPrice * (1 + resetMove);
          const resetHit = engine.direction === "SHORT"
            ? bar.lowPrice <= closeTarget
            : bar.highPrice >= closeTarget;
          if (resetHit) {
            for (const fill of engine.fills) {
              if (!fill.active) continue;
              closeFill({
                trades,
                engine,
                fill,
                exitPrice: closeTarget,
                exitTimeUtc: tsUtc,
                exitReason: "grid_reset",
                tradeNumber: tradeNumber++,
              });
            }
            engine.closedForWeek = true;
          }
        }
      }

      if (barIndex === engine.closeGridIndex && !engine.closedForWeek) {
        for (const fill of engine.fills) {
          if (!fill.active) continue;
          closeFill({
            trades,
            engine,
            fill,
            exitPrice: getMark(engine, timelines, barIndex),
            exitTimeUtc: tsUtc,
            exitReason: "week_close",
            tradeNumber: tradeNumber++,
          });
        }
      }
    }
  }

  const totalReturn = trades.reduce((sum, trade) => sum + trade.returnPct, 0);
  const wins = trades.filter((trade) => trade.returnPct > 0).length;
  const losses = trades.filter((trade) => trade.returnPct <= 0).length;
  const result: WeeklyHoldResult = {
    weekOpenUtc: params.weekOpenUtc,
    executionWindowOpenUtc: resultBoundaries.executionWindowOpenUtc,
    executionWindowCloseUtc: resultBoundaries.executionWindowCloseUtc,
    biasSourceId: params.strategy.id,
    trades,
    totalReturnPct: totalReturn,
    normalizedTotalReturnPct: totalReturn,
    displayTotalReturnPct: totalReturn,
    returnMode: "normalized",
    winCount: wins,
    lossCount: losses,
    winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
    tradeCount: trades.length,
    signals: params.signals,
    isRealized: true,
  };

  return {
    weekOpenUtc: params.weekOpenUtc,
    result,
    path: await computePathForWeek(result),
  };
}

function summarize(variantId: VariantId, capMode: CapMode, weeks: VariantWeek[]): VariantSummary {
  const multiPath = computeMultiWeekBasketPath(weeks.map((week) => week.path));
  const totalReturnPct = multiPath.summary.totalReturnPct;
  const pathMaxDrawdownPct = multiPath.summary.maxDrawdownPct;
  return {
    variantId,
    capMode,
    weeks,
    totalReturnPct,
    pathMaxDrawdownPct,
    returnToDd: pathMaxDrawdownPct > 0 ? totalReturnPct / pathMaxDrawdownPct : 0,
    pathSharpe: pathSharpe(weeks.map((week) => week.path)),
    trades: weeks.reduce((sum, week) => sum + week.result.trades.length, 0),
    gridTpCount: weeks.reduce((sum, week) => sum + week.result.trades.filter((trade) => trade.detail?.exitReason === "grid_tp").length, 0),
    resetCount: weeks.reduce((sum, week) => sum + week.result.trades.filter((trade) => trade.detail?.exitReason === "grid_reset").length, 0),
    weekCloseCount: weeks.reduce((sum, week) => sum + week.result.trades.filter((trade) => trade.detail?.exitReason === "week_close").length, 0),
    activeCount: weeks.reduce((sum, week) => sum + week.result.trades.filter((trade) => trade.detail?.exitReason === "active").length, 0),
  };
}

function pathSharpe(paths: BasketPathResult[]) {
  const dailyReturns = paths.flatMap((path) => dailyReturnsFromPath(path.points));
  return computeReturnSharpe(dailyReturns);
}

function fmt(value: number, digits = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function num(value: number, digits = 2) {
  return value.toFixed(digits);
}

function capLabel(capMode: CapMode) {
  return capMode === "pair_fill_cap" ? "Pair fill cap ON" : "No pair fill cap";
}

function variantLabel(variantId: VariantId) {
  if (variantId === "current_app") return "Current app";
  if (variantId === "legacy_execution_anchor") return "Legacy execution anchor";
  if (variantId === "weekly_market_anchor") return "Weekly market anchor";
  if (variantId === "weekly_market_anchor_center") return "Weekly anchor + center";
  return "Execution anchor + weekly center";
}

function printSummaryTable(title: string, rows: VariantSummary[]) {
  console.log(`\n${title}`);
  console.log("=".repeat(title.length));
  console.log([
    "Variant".padEnd(34),
    "Return".padStart(10),
    "Path DD".padStart(10),
    "Ret/DD".padStart(8),
    "Sharpe".padStart(8),
    "Trades".padStart(8),
    "TP".padStart(6),
    "Reset".padStart(7),
    "WkCls".padStart(7),
  ].join(" "));
  for (const row of rows) {
    console.log([
      variantLabel(row.variantId).padEnd(34),
      fmt(row.totalReturnPct).padStart(10),
      `${row.pathMaxDrawdownPct.toFixed(2)}%`.padStart(10),
      num(row.returnToDd).padStart(8),
      num(row.pathSharpe).padStart(8),
      String(row.trades).padStart(8),
      String(row.gridTpCount).padStart(6),
      String(row.resetCount).padStart(7),
      String(row.weekCloseCount).padStart(7),
    ].join(" "));
  }
}

function printWeeklyDeltas(title: string, baseline: VariantWeek[], candidate: VariantWeek[], candidateLabel = "Candidate") {
  console.log(`\n${title}`);
  console.log("=".repeat(title.length));
  console.log([
    "Week".padEnd(24),
    "App".padStart(9),
    candidateLabel.padStart(9),
    "Delta".padStart(9),
    "AppTr".padStart(7),
    "WkTr".padStart(7),
  ].join(" "));
  for (let i = 0; i < baseline.length; i += 1) {
    const base = baseline[i]!;
    const alt = candidate[i]!;
    const appReturn = base.path.summary.totalReturnPct;
    const weeklyReturn = alt.path.summary.totalReturnPct;
    console.log([
      base.weekOpenUtc.padEnd(24),
      fmt(appReturn).padStart(9),
      fmt(weeklyReturn).padStart(9),
      fmt(weeklyReturn - appReturn).padStart(9),
      String(base.result.trades.length).padStart(7),
      String(alt.result.trades.length).padStart(7),
    ].join(" "));
  }
}

async function runCapMode(strategy: StrategyConfig, weeks: string[], capMode: CapMode) {
  const currentWeeks: VariantWeek[] = [];
  const legacyExecutionAnchorWeeks: VariantWeek[] = [];
  const weeklyAnchorWeeks: VariantWeek[] = [];
  const weeklyAnchorCenterWeeks: VariantWeek[] = [];
  const executionAnchorWeeklyCenterWeeks: VariantWeek[] = [];

  for (const weekOpenUtc of weeks) {
    const baseline = await currentAppWeek({ strategy, weekOpenUtc, capMode });
    currentWeeks.push(baseline);
    legacyExecutionAnchorWeeks.push(await customGridWeek({
      strategy,
      weekOpenUtc,
      capMode,
      signals: baseline.result.signals,
      gridAnchorSource: "execution",
      includeWeeklyCenter: false,
    }));
    weeklyAnchorWeeks.push(await customGridWeek({
      strategy,
      weekOpenUtc,
      capMode,
      signals: baseline.result.signals,
      gridAnchorSource: "canonical",
      includeWeeklyCenter: false,
    }));
    weeklyAnchorCenterWeeks.push(await customGridWeek({
      strategy,
      weekOpenUtc,
      capMode,
      signals: baseline.result.signals,
      gridAnchorSource: "canonical",
      includeWeeklyCenter: true,
    }));
    executionAnchorWeeklyCenterWeeks.push(await customGridWeek({
      strategy,
      weekOpenUtc,
      capMode,
      signals: baseline.result.signals,
      gridAnchorSource: "execution",
      includeWeeklyCenter: true,
    }));
  }

  const summaries = [
    summarize("current_app", capMode, currentWeeks),
    summarize("legacy_execution_anchor", capMode, legacyExecutionAnchorWeeks),
    summarize("weekly_market_anchor", capMode, weeklyAnchorWeeks),
    summarize("weekly_market_anchor_center", capMode, weeklyAnchorCenterWeeks),
    summarize("execution_anchor_weekly_center", capMode, executionAnchorWeeklyCenterWeeks),
  ];
  printSummaryTable(`${strategy.label} ADR Grid - ${capLabel(capMode)}`, summaries);
  printWeeklyDeltas(`${strategy.label} weekly deltas: current app vs legacy execution - ${capLabel(capMode)}`, legacyExecutionAnchorWeeks, currentWeeks, "Current");
  printWeeklyDeltas(`${strategy.label} weekly deltas: current app vs weekly anchor - ${capLabel(capMode)}`, currentWeeks, weeklyAnchorWeeks, "Weekly");
  printWeeklyDeltas(`${strategy.label} weekly deltas: weekly anchor + center - ${capLabel(capMode)}`, currentWeeks, weeklyAnchorCenterWeeks, "Wk+C");
  printWeeklyDeltas(`${strategy.label} weekly deltas: execution anchor + weekly center - ${capLabel(capMode)}`, currentWeeks, executionAnchorWeeklyCenterWeeks, "Ex+C");

  const baseline = summaries[0]!;
  console.log(`\nRead - ${capLabel(capMode)}`);
  for (const candidate of summaries.slice(1)) {
    console.log(`${variantLabel(candidate.variantId)} changed return by ${fmt(candidate.totalReturnPct - baseline.totalReturnPct)}, path DD by ${(candidate.pathMaxDrawdownPct - baseline.pathMaxDrawdownPct).toFixed(2)} points, Sharpe by ${(candidate.pathSharpe - baseline.pathSharpe).toFixed(2)}, and trades by ${candidate.trades - baseline.trades}.`);
  }
}

async function withQuietConsole<T>(fn: () => Promise<T>): Promise<T> {
  const originalLog = console.log;
  const originalWarn = console.warn;
  try {
    console.log = () => undefined;
    console.warn = () => undefined;
    return await fn();
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
}

async function main() {
  const currentWeek = getDisplayWeekOpenUtc();
  const dataWeeks = await listDataSectionWeeks();
  const weeks = buildDataWeekOptions({
    historicalWeeks: dataWeeks,
    currentWeekOpenUtc: currentWeek,
    limit: 20,
  })
    .filter((weekOpenUtc): weekOpenUtc is string => typeof weekOpenUtc === "string")
    .filter((weekOpenUtc) => weekOpenUtc !== currentWeek)
    .slice(0, 19)
    .sort((left, right) => left.localeCompare(right));

  if (weeks.length === 0) throw new Error("No realized weeks available.");

  console.log("ADR Grid weekly-anchor A/B");
  console.log(`Weeks: ${weeks.length} (${weeks[0]} -> ${weeks[weeks.length - 1]})`);
  console.log("Current app: production ADR Grid path.");
  console.log("Comparisons: legacy execution anchor, weekly market anchor, weekly market anchor with tradable center, and execution anchor with standalone weekly center.");
  console.log("All candidate fills are still gated by the execution window; center fills use the same 0.20 ADR TP and Pair Fill Cap semantics.");

  for (const strategyId of ["tandem", "tiered_4w"]) {
    const strategy = getStrategy(strategyId);
    if (!strategy) throw new Error(`Missing strategy ${strategyId}`);
    console.log(`\nStrategy: ${strategy.label}`);
    await runCapMode(strategy, weeks, "pair_fill_cap");
    await runCapMode(strategy, weeks, "none");
  }
}

main().catch((error) => {
  console.error("[adr-grid-weekly-anchor-ab] Failed:", error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
