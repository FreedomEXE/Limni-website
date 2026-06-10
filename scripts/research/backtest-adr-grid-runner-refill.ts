/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * Compare the current app ADR Grid close/rearm engine against a proposed
 * half-TP runner/refill variant on the same canonical H1 data.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { DateTime } from "luxon";
import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getDisplayWeekOpenUtc } from "../src/lib/weekAnchor";
import { buildDataWeekOptions } from "../src/lib/weekOptions";
import { getExecutionWeekWindow } from "../src/lib/executionPriceWindows";
import { getExecutionWeeklyPairReturns } from "../src/lib/pairReturns";
import { getEntryStyle, getRiskOverlay, getStrategy, type StrategyConfig } from "../src/lib/performance/strategyConfig";
import { computeWeeklyHold, type CanonicalSignal, type WeeklyHoldResult, type WeeklyHoldTrade } from "../src/lib/performance/weeklyHoldEngine";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "../src/lib/performance/adrLookup";
import { loadPathBars, type PathBarMap } from "../src/lib/performance/pathBarLoader";
import type { CanonicalPriceBar } from "../src/lib/canonicalPriceBars";
import type { AssetClass } from "../src/lib/cotMarkets";
import { buildWeeklyHoldLedger } from "../src/lib/performance/positionLedger";
import { computeBasketPath, computeMultiWeekBasketPath, type BasketPathResult } from "../src/lib/performance/basketPathEngine";
import { computeReturnSharpe, dailyReturnsFromPath } from "../src/lib/performance/performanceMetricBasis";

const ADR_GRID_SPACING = 0.20;
const ADR_GRID_RESET_ADR = 1.0;
const ADR_GRID_MAX_LEVELS_PER_SIDE = 50;
const PAIR_FILL_CAP_LIMIT = 3;

type Direction = "LONG" | "SHORT";
type GridSide = "favorable" | "continuation";
type VariantId =
  | "current_app"
  | "current_app_seed"
  | "runner_refill_no_seed"
  | "runner_refill_seed"
  | "half_refill_trail_020"
  | "half_refill_trail_040"
  | "whole_trail_020"
  | "whole_trail_040";
type CapMode = "pair_fill_cap" | "none";
type RunnerMode = "half_refill_wait_reset" | "half_refill_trailing" | "whole_trailing";

type CostAdjustedSummary = {
  variantId: VariantId;
  costPerFsePct: number;
  totalReturnPct: number;
  pathMaxDrawdownPct: number;
  returnToDd: number;
  pathSharpe: number;
  trades: number;
  fullEntryEquivalentClosed: number;
  totalCostPct: number;
};

type GridTemplate = {
  symbol: string;
  assetClass: AssetClass;
  direction: Direction;
  source: string;
  tier: number | null;
  openPrice: number;
  pairAdrPct: number;
  weightMultiplier: number;
  executionWindowOpenUtc: string;
  executionWindowCloseUtc: string;
};

type GridLevel = {
  index: number;
  side: GridSide;
  levelNumber: number;
  triggerPrice: number;
  baseWeight: number;
};

type RunnerFill = {
  levelIndex: number;
  entryPrice: number;
  entryTimeUtc: string;
  entryBarIndex: number;
  weight: number;
  active: boolean;
  kind: "initial" | "refill" | "runner" | "seed";
  hasTakenFirstTp: boolean;
  trailArmed?: boolean;
  trailStartBarIndex?: number;
  bestPrice?: number;
  stopPrice?: number;
};

type RunnerEngine = GridTemplate & {
  levels: GridLevel[];
  fills: RunnerFill[];
  levelArmed: boolean[];
  levelRearmBarIndex: number[];
  levelRunnerWeight: number[];
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
  entriesOpened: number;
  fullEntryEquivalentOpened: number;
  firstTpCount: number;
  refillEntryCount: number;
  seedEntryCount: number;
  resetCloseCount: number;
  weekCloseCount: number;
  runnerStopCount: number;
  capBlockedEntries: number;
  maxExposureFse: number;
};

type VariantSummary = {
  strategyId: string;
  capMode: CapMode;
  variantId: VariantId;
  weeks: VariantWeek[];
  totalReturnPct: number;
  trades: number;
  entriesOpened: number;
  fullEntryEquivalentOpened: number;
  winRatePct: number;
  weeklyWinRatePct: number;
  pathMaxDrawdownPct: number;
  returnToDd: number;
  pathSharpe: number;
  worstWeekPct: number;
  losingWeeks: number;
  maxExposureFse: number;
  firstTpCount: number;
  refillEntryCount: number;
  seedEntryCount: number;
  resetCloseCount: number;
  weekCloseCount: number;
  runnerStopCount: number;
  capBlockedEntries: number;
};

function normalizeAssetClass(value: string | null | undefined): AssetClass {
  return value === "indices" || value === "commodities" || value === "crypto" || value === "fx"
    ? value
    : "fx";
}

function getExecutionBoundaryIso(weekOpenUtc: string, assetClass: AssetClass) {
  const window = getExecutionWeekWindow(weekOpenUtc, assetClass);
  return {
    windowOpenUtc: window.windowOpenUtc.toUTC().toISO() ?? weekOpenUtc,
    windowCloseUtc: window.windowCloseUtc.toUTC().toISO() ?? weekOpenUtc,
  };
}

function mergeExecutionBoundaries(
  weekOpenUtc: string,
  assetClasses: Iterable<string | null | undefined>,
): { executionWindowOpenUtc: string; executionWindowCloseUtc: string } {
  let minOpenMs = Number.POSITIVE_INFINITY;
  let maxCloseMs = Number.NEGATIVE_INFINITY;
  let executionWindowOpenUtc = weekOpenUtc;
  let executionWindowCloseUtc = weekOpenUtc;

  for (const assetClassValue of assetClasses) {
    const { windowOpenUtc, windowCloseUtc } = getExecutionBoundaryIso(
      weekOpenUtc,
      normalizeAssetClass(assetClassValue),
    );
    const openMs = Date.parse(windowOpenUtc);
    const closeMs = Date.parse(windowCloseUtc);
    if (Number.isFinite(openMs) && openMs < minOpenMs) {
      minOpenMs = openMs;
      executionWindowOpenUtc = windowOpenUtc;
    }
    if (Number.isFinite(closeMs) && closeMs > maxCloseMs) {
      maxCloseMs = closeMs;
      executionWindowCloseUtc = windowCloseUtc;
    }
  }

  if (!Number.isFinite(minOpenMs) || !Number.isFinite(maxCloseMs)) {
    const fallback = getExecutionBoundaryIso(weekOpenUtc, "fx");
    return {
      executionWindowOpenUtc: fallback.windowOpenUtc,
      executionWindowCloseUtc: fallback.windowCloseUtc,
    };
  }

  return { executionWindowOpenUtc, executionWindowCloseUtc };
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
  const baseWeight = ADR_GRID_SPACING * template.weightMultiplier;
  let index = 0;

  for (let i = 1; i <= ADR_GRID_MAX_LEVELS_PER_SIDE; i += 1) {
    levels.push({
      index: index++,
      side: "favorable",
      levelNumber: i,
      triggerPrice: template.direction === "LONG"
        ? template.openPrice * (1 - i * step)
        : template.openPrice * (1 + i * step),
      baseWeight,
    });
  }
  for (let i = 1; i <= ADR_GRID_MAX_LEVELS_PER_SIDE; i += 1) {
    levels.push({
      index: index++,
      side: "continuation",
      levelNumber: i,
      triggerPrice: template.direction === "LONG"
        ? template.openPrice * (1 + i * step)
        : template.openPrice * (1 - i * step),
      baseWeight,
    });
  }
  return levels;
}

function buildEngine(template: GridTemplate, seed: boolean, tsUtc: string): RunnerEngine {
  const levels = buildLevels(template);
  const engine: RunnerEngine = {
    ...template,
    levels,
    fills: [],
    levelArmed: levels.map(() => true),
    levelRearmBarIndex: levels.map(() => -1),
    levelRunnerWeight: levels.map(() => 0),
    cycleHighPrice: template.openPrice,
    cycleLowPrice: template.openPrice,
    closedForWeek: false,
    closeGridIndex: -1,
  };
  if (seed) {
    engine.fills.push({
      levelIndex: -1,
      entryPrice: template.openPrice,
      entryTimeUtc: tsUtc,
      entryBarIndex: 0,
      weight: ADR_GRID_SPACING * template.weightMultiplier,
      active: true,
      kind: "seed",
      hasTakenFirstTp: false,
    });
  }
  return engine;
}

function directedRawReturnPct(direction: Direction, entryPrice: number, exitPrice: number) {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(exitPrice) || exitPrice <= 0) return 0;
  const rawReturn = ((exitPrice - entryPrice) / entryPrice) * 100;
  return direction === "SHORT" ? -rawReturn : rawReturn;
}

function normalizedWeightedReturn(direction: Direction, entryPrice: number, exitPrice: number, weight: number, pairAdrPct: number) {
  const rawWeighted = directedRawReturnPct(direction, entryPrice, exitPrice) * weight;
  const adrMultiplier = getTargetAdrPct() / pairAdrPct;
  return {
    rawWeighted,
    normalizedWeighted: rawWeighted * adrMultiplier,
    adrMultiplier,
  };
}

function closeFill(params: {
  trades: WeeklyHoldTrade[];
  engine: RunnerEngine;
  fill: RunnerFill;
  exitPrice: number;
  exitTimeUtc: string;
  exitReason: string;
  tradeNumber: number;
  weight?: number;
}) {
  const { trades, engine, fill, exitPrice, exitTimeUtc, exitReason, tradeNumber } = params;
  const weight = params.weight ?? fill.weight;
  if (weight <= 1e-9) return;
  const returns = normalizedWeightedReturn(engine.direction, fill.entryPrice, exitPrice, weight, engine.pairAdrPct);
  trades.push({
    symbol: engine.symbol,
    assetClass: engine.assetClass,
    direction: engine.direction,
    openPrice: fill.entryPrice,
    closePrice: exitPrice,
    rawReturnPct: returns.rawWeighted,
    normalizedReturnPct: returns.normalizedWeighted,
    displayReturnPct: returns.normalizedWeighted,
    returnPct: returns.normalizedWeighted,
    returnMode: "normalized",
    source: engine.source,
    tier: engine.tier,
    weight,
    adrPct: engine.pairAdrPct,
    adrMultiplier: returns.adrMultiplier,
    detail: {
      tradeNumber,
      entryTimeUtc: fill.entryTimeUtc,
      exitTimeUtc,
      exitReason,
      anchorPrice: engine.openPrice,
      tpPrice: exitReason === "grid_tp" || exitReason === "grid_tp_half" || exitReason === "grid_tp_refill" ? exitPrice : null,
      adrPct: engine.pairAdrPct,
      maePct: null,
    },
  });
}

function activeWeight(engine: RunnerEngine) {
  return engine.fills.reduce((sum, fill) => sum + (fill.active ? fill.weight : 0), 0);
}

function activeFullSizeEquivalent(engine: RunnerEngine) {
  const baseWeight = ADR_GRID_SPACING * engine.weightMultiplier;
  return baseWeight > 0 ? activeWeight(engine) / baseWeight : 0;
}

function getBasketExposureFse(engines: RunnerEngine[]) {
  return engines.reduce((sum, engine) => sum + activeFullSizeEquivalent(engine), 0);
}

function pairCapAllows(engine: RunnerEngine, addWeight: number, capMode: CapMode) {
  if (capMode === "none") return true;
  const baseWeight = ADR_GRID_SPACING * engine.weightMultiplier;
  const activeFse = baseWeight > 0 ? activeWeight(engine) / baseWeight : 0;
  const addFse = baseWeight > 0 ? addWeight / baseWeight : 0;
  return activeFse + addFse <= PAIR_FILL_CAP_LIMIT + 1e-9;
}

function releaseRunnerLevel(engine: RunnerEngine, fill: RunnerFill, barIndex: number) {
  if (fill.levelIndex < 0) return;
  engine.levelRunnerWeight[fill.levelIndex] = Math.max(
    0,
    (engine.levelRunnerWeight[fill.levelIndex] ?? 0) - fill.weight,
  );
  engine.levelArmed[fill.levelIndex] = true;
  engine.levelRearmBarIndex[fill.levelIndex] = barIndex;
}

function armTrail(fill: RunnerFill, engine: RunnerEngine, targetPrice: number, barIndex: number) {
  fill.kind = "runner";
  fill.hasTakenFirstTp = true;
  fill.trailArmed = true;
  fill.trailStartBarIndex = barIndex;
  fill.bestPrice = targetPrice;
  fill.stopPrice = fill.entryPrice;
  if (fill.levelIndex >= 0) {
    engine.levelRunnerWeight[fill.levelIndex] = (engine.levelRunnerWeight[fill.levelIndex] ?? 0) + fill.weight;
  }
}

function updateRunnerTrail(engine: RunnerEngine, fill: RunnerFill, bar: CanonicalPriceBar, barIndex: number, trailAdr: number) {
  if (!fill.trailArmed || barIndex <= (fill.trailStartBarIndex ?? fill.entryBarIndex)) return;
  const trailMove = (trailAdr * engine.pairAdrPct) / 100;
  if (trailMove <= 0) return;

  if (engine.direction === "LONG") {
    const best = Math.max(fill.bestPrice ?? fill.entryPrice, bar.highPrice);
    fill.bestPrice = best;
    const nextStop = best * (1 - trailMove);
    fill.stopPrice = Math.max(fill.stopPrice ?? fill.entryPrice, fill.entryPrice, nextStop);
  } else {
    const best = Math.min(fill.bestPrice ?? fill.entryPrice, bar.lowPrice);
    fill.bestPrice = best;
    const nextStop = best * (1 + trailMove);
    fill.stopPrice = Math.min(fill.stopPrice ?? fill.entryPrice, fill.entryPrice, nextStop);
  }
}

function levelMissingWeight(engine: RunnerEngine, level: GridLevel) {
  const activeAtLevel = engine.fills
    .filter((fill) => fill.active && fill.levelIndex === level.index)
    .reduce((sum, fill) => sum + fill.weight, 0);
  return Math.max(0, level.baseWeight - activeAtLevel);
}

function getMark(engine: RunnerEngine, timelines: Map<string, GridTimeline>, barIndex: number) {
  return timelines.get(engine.symbol)?.markBars[barIndex]?.closePrice ?? engine.openPrice;
}

function buildTemplates(params: {
  weekOpenUtc: string;
  signals: CanonicalSignal[];
  returnMap: Map<string, { symbol: string; assetClass: AssetClass; openPrice: number; closePrice: number; returnPct: number }>;
  adrMap: Map<string, number>;
}) {
  const templates: GridTemplate[] = [];
  for (const signal of params.signals) {
    const pair = signal.symbol.toUpperCase();
    const priceData = params.returnMap.get(pair);
    if (!priceData || !Number.isFinite(priceData.openPrice) || priceData.openPrice <= 0) continue;
    const assetClass = normalizeAssetClass(priceData.assetClass ?? signal.assetClass);
    const executionBoundary = getExecutionBoundaryIso(params.weekOpenUtc, assetClass);
    templates.push({
      symbol: pair,
      assetClass,
      direction: signal.direction,
      source: signal.source,
      tier: signal.tier,
      openPrice: priceData.openPrice,
      pairAdrPct: getAdrPct(params.adrMap, pair, assetClass),
      weightMultiplier: 1,
      executionWindowOpenUtc: executionBoundary.windowOpenUtc,
      executionWindowCloseUtc: executionBoundary.windowCloseUtc,
    });
  }
  return templates;
}

async function computePathForWeek(result: WeeklyHoldResult, entryStyleId = "adr_grid") {
  const ledger = await buildWeeklyHoldLedger(result, { entryStyleId });
  const symbols = Array.from(new Set(ledger.legs.map((leg) => leg.symbol))).sort();
  const bars = await loadPathBars(symbols, ledger.weekOpenUtc, ledger.weekCloseUtc, "1h");
  return computeBasketPath(ledger, bars, { returnMode: "normalized" });
}

function computeMaxExposureFseFromTrades(result: WeeklyHoldResult, baseWeight = ADR_GRID_SPACING) {
  const events: Array<{ ts: number; delta: number }> = [];
  for (const trade of result.trades) {
    const entry = Date.parse(trade.detail?.entryTimeUtc ?? "");
    const exit = Date.parse(trade.detail?.exitTimeUtc ?? "");
    const weight = trade.weight ?? baseWeight;
    const fse = baseWeight > 0 ? weight / baseWeight : 0;
    if (Number.isFinite(entry)) events.push({ ts: entry, delta: fse });
    if (Number.isFinite(exit)) events.push({ ts: exit, delta: -fse });
  }
  events.sort((left, right) => left.ts - right.ts || right.delta - left.delta);
  let active = 0;
  let maxActive = 0;
  for (const event of events) {
    active += event.delta;
    maxActive = Math.max(maxActive, active);
  }
  return maxActive;
}

async function executeRunnerRefillWeek(params: {
  strategy: StrategyConfig;
  weekOpenUtc: string;
  capMode: CapMode;
  seed: boolean;
  signals: CanonicalSignal[];
  mode?: RunnerMode;
  trailAdr?: number;
}) {
  const mode = params.mode ?? "half_refill_wait_reset";
  const usesTrailing = mode === "half_refill_trailing" || mode === "whole_trailing";
  const trailAdr = params.trailAdr ?? ADR_GRID_SPACING;
  const pairReturns = await getExecutionWeeklyPairReturns(params.weekOpenUtc);
  const returnMap = new Map(pairReturns.map((row) => [row.symbol.toUpperCase(), row]));
  const adrMap = await loadWeeklyAdrMap(params.weekOpenUtc);
  const templates = buildTemplates({
    weekOpenUtc: params.weekOpenUtc,
    signals: params.signals,
    returnMap,
    adrMap,
  });
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
    const engine = buildEngine(template, params.seed, resultBoundaries.executionWindowOpenUtc);
    engine.closeGridIndex = findGridIndexAtOrBefore(grid, template.executionWindowCloseUtc);
    return engine;
  });

  const trades: WeeklyHoldTrade[] = [];
  let tradeNumber = 1;
  let entriesOpened = params.seed ? engines.length : 0;
  let fullEntryEquivalentOpened = params.seed ? engines.length : 0;
  let firstTpCount = 0;
  let refillEntryCount = 0;
  let seedEntryCount = params.seed ? engines.length : 0;
  let resetCloseCount = 0;
  let weekCloseCount = 0;
  let runnerStopCount = 0;
  let capBlockedEntries = 0;
  let maxExposureFse = getBasketExposureFse(engines);

  for (let barIndex = 0; barIndex < grid.length; barIndex += 1) {
    const tsUtc = grid[barIndex] ?? resultBoundaries.executionWindowOpenUtc;
    for (const engine of engines) {
      const bar = timelines.get(engine.symbol)?.exactBars[barIndex] ?? null;
      if (engine.closedForWeek || barIndex > engine.closeGridIndex) continue;

      if (bar) {
        if (usesTrailing) {
          for (const fill of [...engine.fills]) {
            if (!fill.active || fill.kind !== "runner" || !fill.trailArmed) continue;
            if (barIndex <= (fill.trailStartBarIndex ?? fill.entryBarIndex)) continue;
            const stopPrice = fill.stopPrice;
            if (!Number.isFinite(stopPrice) || (stopPrice ?? 0) <= 0) continue;
            const stopHit = engine.direction === "SHORT"
              ? bar.highPrice >= stopPrice!
              : bar.lowPrice <= stopPrice!;
            if (!stopHit) continue;
            closeFill({
              trades,
              engine,
              fill,
              exitPrice: stopPrice!,
              exitTimeUtc: tsUtc,
              exitReason: "runner_trail_stop",
              tradeNumber: tradeNumber++,
            });
            fill.active = false;
            releaseRunnerLevel(engine, fill, barIndex);
            runnerStopCount += 1;
          }
        }

        for (const level of engine.levels) {
          if (!engine.levelArmed[level.index]) continue;
          if (engine.levelRearmBarIndex[level.index]! >= barIndex) continue;
          const triggered = level.side === "favorable"
            ? (engine.direction === "LONG" ? bar.lowPrice <= level.triggerPrice : bar.highPrice >= level.triggerPrice)
            : (engine.direction === "LONG" ? bar.highPrice >= level.triggerPrice : bar.lowPrice <= level.triggerPrice);
          if (!triggered) continue;

          const hasRunner = (engine.levelRunnerWeight[level.index] ?? 0) > 1e-9;
          if (mode === "whole_trailing" && hasRunner) continue;
          const addWeight = hasRunner ? Math.min(level.baseWeight / 2, levelMissingWeight(engine, level)) : level.baseWeight;
          if (addWeight <= 1e-9) continue;
          if (!pairCapAllows(engine, addWeight, params.capMode)) {
            capBlockedEntries += 1;
            continue;
          }

          engine.fills.push({
            levelIndex: level.index,
            entryPrice: level.triggerPrice,
            entryTimeUtc: tsUtc,
            entryBarIndex: barIndex,
            weight: addWeight,
            active: true,
            kind: hasRunner ? "refill" : "initial",
            hasTakenFirstTp: false,
          });
          engine.levelArmed[level.index] = false;
          entriesOpened += 1;
          fullEntryEquivalentOpened += addWeight / level.baseWeight;
          if (hasRunner) refillEntryCount += 1;
        }

        const targetMove = (ADR_GRID_SPACING * engine.pairAdrPct) / 100;
        for (const fill of [...engine.fills]) {
          if (!fill.active || barIndex <= fill.entryBarIndex) continue;
          const targetPrice = engine.direction === "SHORT"
            ? fill.entryPrice * (1 - targetMove)
            : fill.entryPrice * (1 + targetMove);
          const targetHit = engine.direction === "SHORT"
            ? bar.lowPrice <= targetPrice
            : bar.highPrice >= targetPrice;
          if (!targetHit) continue;

          if (fill.kind === "initial" || fill.kind === "seed") {
            if (mode === "whole_trailing") {
              armTrail(fill, engine, targetPrice, barIndex);
            } else {
              const halfWeight = fill.weight / 2;
              closeFill({
                trades,
                engine,
                fill,
                exitPrice: targetPrice,
                exitTimeUtc: tsUtc,
                exitReason: "grid_tp_half",
                tradeNumber: tradeNumber++,
                weight: halfWeight,
              });
              fill.weight = halfWeight;
              if (mode === "half_refill_trailing") {
                armTrail(fill, engine, targetPrice, barIndex);
              } else {
                fill.kind = "runner";
                fill.hasTakenFirstTp = true;
                if (fill.levelIndex >= 0) {
                  engine.levelRunnerWeight[fill.levelIndex] = (engine.levelRunnerWeight[fill.levelIndex] ?? 0) + halfWeight;
                }
              }
              if (fill.levelIndex >= 0) {
                engine.levelArmed[fill.levelIndex] = true;
                engine.levelRearmBarIndex[fill.levelIndex] = barIndex;
              }
            }
            firstTpCount += 1;
          } else if (fill.kind === "refill") {
            closeFill({
              trades,
              engine,
              fill,
              exitPrice: targetPrice,
              exitTimeUtc: tsUtc,
              exitReason: "grid_tp_refill",
              tradeNumber: tradeNumber++,
            });
            fill.active = false;
            if (fill.levelIndex >= 0) {
              engine.levelArmed[fill.levelIndex] = true;
              engine.levelRearmBarIndex[fill.levelIndex] = barIndex;
            }
            firstTpCount += 1;
          }
        }

        if (usesTrailing) {
          for (const fill of engine.fills) {
            if (!fill.active || fill.kind !== "runner" || !fill.trailArmed) continue;
            updateRunnerTrail(engine, fill, bar, barIndex, trailAdr);
          }
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
              fill.active = false;
              resetCloseCount += 1;
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
          fill.active = false;
          weekCloseCount += 1;
        }
      }
    }
    maxExposureFse = Math.max(maxExposureFse, getBasketExposureFse(engines));
  }

  const wins = trades.filter((trade) => trade.returnPct > 0).length;
  const losses = trades.filter((trade) => trade.returnPct <= 0).length;
  const totalReturn = trades.reduce((sum, trade) => sum + trade.returnPct, 0);
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
  const path = await computePathForWeek(result);
  return {
    weekOpenUtc: params.weekOpenUtc,
    result,
    path,
    entriesOpened,
    fullEntryEquivalentOpened,
    firstTpCount,
    refillEntryCount,
    seedEntryCount,
    resetCloseCount,
    weekCloseCount,
    runnerStopCount,
    capBlockedEntries,
    maxExposureFse,
  } satisfies VariantWeek;
}

async function executeCurrentAppSeedWeek(params: {
  strategy: StrategyConfig;
  weekOpenUtc: string;
  capMode: CapMode;
  signals: CanonicalSignal[];
}) {
  const pairReturns = await getExecutionWeeklyPairReturns(params.weekOpenUtc);
  const returnMap = new Map(pairReturns.map((row) => [row.symbol.toUpperCase(), row]));
  const adrMap = await loadWeeklyAdrMap(params.weekOpenUtc);
  const templates = buildTemplates({
    weekOpenUtc: params.weekOpenUtc,
    signals: params.signals,
    returnMap,
    adrMap,
  });
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
    const engine = buildEngine(template, false, resultBoundaries.executionWindowOpenUtc);
    engine.closeGridIndex = findGridIndexAtOrBefore(grid, template.executionWindowCloseUtc);
    return engine;
  });

  const trades: WeeklyHoldTrade[] = [];
  let tradeNumber = 1;
  let entriesOpened = 0;
  let fullEntryEquivalentOpened = 0;
  let firstTpCount = 0;
  let resetCloseCount = 0;
  let weekCloseCount = 0;
  let capBlockedEntries = 0;

  for (const engine of engines) {
    const seedWeight = ADR_GRID_SPACING * engine.weightMultiplier;
    if (!pairCapAllows(engine, seedWeight, params.capMode)) {
      capBlockedEntries += 1;
      continue;
    }
    engine.fills.push({
      levelIndex: -1,
      entryPrice: engine.openPrice,
      entryTimeUtc: resultBoundaries.executionWindowOpenUtc,
      entryBarIndex: 0,
      weight: seedWeight,
      active: true,
      kind: "seed",
      hasTakenFirstTp: false,
    });
    entriesOpened += 1;
    fullEntryEquivalentOpened += 1;
  }

  let maxExposureFse = getBasketExposureFse(engines);

  for (let barIndex = 0; barIndex < grid.length; barIndex += 1) {
    const tsUtc = grid[barIndex] ?? resultBoundaries.executionWindowOpenUtc;
    for (const engine of engines) {
      const bar = timelines.get(engine.symbol)?.exactBars[barIndex] ?? null;
      if (engine.closedForWeek || barIndex > engine.closeGridIndex) continue;

      if (bar) {
        for (const level of engine.levels) {
          if (!engine.levelArmed[level.index]) continue;
          if (engine.levelRearmBarIndex[level.index]! >= barIndex) continue;
          const triggered = level.side === "favorable"
            ? (engine.direction === "LONG" ? bar.lowPrice <= level.triggerPrice : bar.highPrice >= level.triggerPrice)
            : (engine.direction === "LONG" ? bar.highPrice >= level.triggerPrice : bar.lowPrice <= level.triggerPrice);
          if (!triggered) continue;
          if (!pairCapAllows(engine, level.baseWeight, params.capMode)) {
            capBlockedEntries += 1;
            continue;
          }

          engine.fills.push({
            levelIndex: level.index,
            entryPrice: level.triggerPrice,
            entryTimeUtc: tsUtc,
            entryBarIndex: barIndex,
            weight: level.baseWeight,
            active: true,
            kind: "initial",
            hasTakenFirstTp: false,
          });
          engine.levelArmed[level.index] = false;
          entriesOpened += 1;
          fullEntryEquivalentOpened += 1;
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
          fill.active = false;
          if (fill.levelIndex >= 0) {
            engine.levelArmed[fill.levelIndex] = true;
            engine.levelRearmBarIndex[fill.levelIndex] = barIndex;
          }
          firstTpCount += 1;
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
              fill.active = false;
              resetCloseCount += 1;
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
          fill.active = false;
          weekCloseCount += 1;
        }
      }
    }
    maxExposureFse = Math.max(maxExposureFse, getBasketExposureFse(engines));
  }

  const wins = trades.filter((trade) => trade.returnPct > 0).length;
  const losses = trades.filter((trade) => trade.returnPct <= 0).length;
  const totalReturn = trades.reduce((sum, trade) => sum + trade.returnPct, 0);
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
  const path = await computePathForWeek(result);
  return {
    weekOpenUtc: params.weekOpenUtc,
    result,
    path,
    entriesOpened,
    fullEntryEquivalentOpened,
    firstTpCount,
    refillEntryCount: 0,
    seedEntryCount: templates.length,
    resetCloseCount,
    weekCloseCount,
    runnerStopCount: 0,
    capBlockedEntries,
    maxExposureFse,
  } satisfies VariantWeek;
}

function buildTimelines(symbols: string[], bars: PathBarMap, grid: string[]) {
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

function pathSharpe(pathResults: BasketPathResult[]) {
  const multi = computeMultiWeekBasketPath(pathResults);
  const returns = dailyReturnsFromPath(multi.points.map((point) => ({
    ts_utc: point.tsUtc,
    equity_pct: point.equityPct,
    drawdown_pct: point.drawdownPct,
  })));
  return computeReturnSharpe(returns, 252);
}

function getTradeFse(trade: WeeklyHoldTrade) {
  return (trade.weight ?? ADR_GRID_SPACING) / ADR_GRID_SPACING;
}

function applyCostToResult(result: WeeklyHoldResult, costPerFsePct: number): WeeklyHoldResult {
  if (costPerFsePct <= 0) return result;

  const trades = result.trades.map((trade) => {
    const costPct = costPerFsePct * getTradeFse(trade);
    const rawReturnPct = (trade.rawReturnPct ?? trade.returnPct) - costPct;
    const normalizedReturnPct = (trade.normalizedReturnPct ?? trade.returnPct) - costPct;
    const displayReturnPct = (trade.displayReturnPct ?? trade.returnPct) - costPct;
    const returnPct = trade.returnPct - costPct;
    return {
      ...trade,
      rawReturnPct,
      normalizedReturnPct,
      displayReturnPct,
      returnPct,
      detail: {
        ...trade.detail,
        simulatedCostPct: costPct,
      },
    } satisfies WeeklyHoldTrade;
  });
  const totalReturn = trades.reduce((sum, trade) => sum + trade.returnPct, 0);
  const wins = trades.filter((trade) => trade.returnPct > 0).length;
  const losses = trades.filter((trade) => trade.returnPct <= 0).length;
  return {
    ...result,
    trades,
    totalReturnPct: totalReturn,
    normalizedTotalReturnPct: totalReturn,
    displayTotalReturnPct: totalReturn,
    winCount: wins,
    lossCount: losses,
    winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
    tradeCount: trades.length,
  };
}

async function computeCostAdjustedWeek(week: VariantWeek, costPerFsePct: number): Promise<VariantWeek> {
  if (costPerFsePct <= 0) return week;
  const result = applyCostToResult(week.result, costPerFsePct);
  return {
    ...week,
    result,
    path: await computePathForWeek(result),
  };
}

async function summarizeWithCosts(summary: VariantSummary, costPerFsePct: number): Promise<CostAdjustedSummary> {
  const weeks = await Promise.all(summary.weeks.map((week) => computeCostAdjustedWeek(week, costPerFsePct)));
  const multiPath = computeMultiWeekBasketPath(weeks.map((week) => week.path));
  const pathMaxDrawdownPct = multiPath.summary.maxDrawdownPct;
  const totalReturnPct = multiPath.summary.totalReturnPct;
  const fullEntryEquivalentClosed = weeks.reduce(
    (sum, week) => sum + week.result.trades.reduce((innerSum, trade) => innerSum + getTradeFse(trade), 0),
    0,
  );
  return {
    variantId: summary.variantId,
    costPerFsePct,
    totalReturnPct,
    pathMaxDrawdownPct,
    returnToDd: pathMaxDrawdownPct > 0 ? totalReturnPct / pathMaxDrawdownPct : 0,
    pathSharpe: pathSharpe(weeks.map((week) => week.path)),
    trades: weeks.reduce((sum, week) => sum + week.result.trades.length, 0),
    fullEntryEquivalentClosed,
    totalCostPct: fullEntryEquivalentClosed * costPerFsePct,
  };
}

function summarizeVariant(params: {
  strategyId: string;
  capMode: CapMode;
  variantId: VariantId;
  weeks: VariantWeek[];
}): VariantSummary {
  const multiPath = computeMultiWeekBasketPath(params.weeks.map((week) => week.path));
  const tradeReturns = params.weeks.flatMap((week) => week.result.trades.map((trade) => trade.returnPct));
  const wins = tradeReturns.filter((value) => value > 0).length;
  const weeklyReturns = params.weeks.map((week) => week.path.summary.totalReturnPct);
  const totalReturnPct = multiPath.summary.totalReturnPct;
  const pathMaxDrawdownPct = multiPath.summary.maxDrawdownPct;
  return {
    strategyId: params.strategyId,
    capMode: params.capMode,
    variantId: params.variantId,
    weeks: params.weeks,
    totalReturnPct,
    trades: tradeReturns.length,
    entriesOpened: params.weeks.reduce((sum, week) => sum + week.entriesOpened, 0),
    fullEntryEquivalentOpened: params.weeks.reduce((sum, week) => sum + week.fullEntryEquivalentOpened, 0),
    winRatePct: tradeReturns.length > 0 ? (wins / tradeReturns.length) * 100 : 0,
    weeklyWinRatePct: weeklyReturns.length > 0
      ? (weeklyReturns.filter((value) => value > 0).length / weeklyReturns.length) * 100
      : 0,
    pathMaxDrawdownPct,
    returnToDd: pathMaxDrawdownPct > 0 ? totalReturnPct / pathMaxDrawdownPct : 0,
    pathSharpe: pathSharpe(params.weeks.map((week) => week.path)),
    worstWeekPct: weeklyReturns.length > 0 ? Math.min(...weeklyReturns) : 0,
    losingWeeks: weeklyReturns.filter((value) => value < 0).length,
    maxExposureFse: Math.max(0, ...params.weeks.map((week) => week.maxExposureFse)),
    firstTpCount: params.weeks.reduce((sum, week) => sum + week.firstTpCount, 0),
    refillEntryCount: params.weeks.reduce((sum, week) => sum + week.refillEntryCount, 0),
    seedEntryCount: params.weeks.reduce((sum, week) => sum + week.seedEntryCount, 0),
    resetCloseCount: params.weeks.reduce((sum, week) => sum + week.resetCloseCount, 0),
    weekCloseCount: params.weeks.reduce((sum, week) => sum + week.weekCloseCount, 0),
    runnerStopCount: params.weeks.reduce((sum, week) => sum + week.runnerStopCount, 0),
    capBlockedEntries: params.weeks.reduce((sum, week) => sum + week.capBlockedEntries, 0),
  };
}

async function currentAppWeek(params: {
  strategy: StrategyConfig;
  weekOpenUtc: string;
  capMode: CapMode;
}) {
  const entryStyle = getEntryStyle("adr_grid");
  const riskOverlay = params.capMode === "pair_fill_cap" ? getRiskOverlay("pair_fill_cap") : getRiskOverlay("none");
  if (!entryStyle) throw new Error("Missing adr_grid entry style");
  const result = await withQuietConsole(() =>
    computeWeeklyHold(params.strategy, params.weekOpenUtc, entryStyle, riskOverlay),
  );
  const path = await computePathForWeek(result);
  return {
    weekOpenUtc: params.weekOpenUtc,
    result,
    path,
    entriesOpened: result.trades.length,
    fullEntryEquivalentOpened: result.trades.reduce((sum, trade) => sum + ((trade.weight ?? ADR_GRID_SPACING) / ADR_GRID_SPACING), 0),
    firstTpCount: result.trades.filter((trade) => trade.detail?.exitReason === "grid_tp").length,
    refillEntryCount: 0,
    seedEntryCount: 0,
    resetCloseCount: result.trades.filter((trade) => trade.detail?.exitReason === "grid_reset").length,
    weekCloseCount: result.trades.filter((trade) => trade.detail?.exitReason === "week_close").length,
    runnerStopCount: 0,
    capBlockedEntries: 0,
    maxExposureFse: computeMaxExposureFseFromTrades(result),
  } satisfies VariantWeek;
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

function variantLabel(id: VariantId) {
  if (id === "current_app") return "Current app close/rearm";
  if (id === "current_app_seed") return "Current app + seed";
  if (id === "runner_refill_no_seed") return "Runner/refill, no seed";
  if (id === "runner_refill_seed") return "Runner/refill, seeded";
  if (id === "half_refill_trail_020") return "Half TP + trail 0.20";
  if (id === "half_refill_trail_040") return "Half TP + trail 0.40";
  if (id === "whole_trail_020") return "Whole trail 0.20";
  return "Whole trail 0.40";
}

function capLabel(capMode: CapMode) {
  return capMode === "pair_fill_cap" ? "Pair fill cap ON" : "No pair fill cap";
}

function fmt(value: number, digits = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function num(value: number, digits = 2) {
  return value.toFixed(digits);
}

function printSummaryTable(title: string, summaries: VariantSummary[]) {
  console.log(`\n${title}`);
  console.log("=".repeat(title.length));
  console.log([
    "Variant".padEnd(28),
    "Return".padStart(10),
    "Path DD".padStart(10),
    "Ret/DD".padStart(8),
    "Path Sharpe".padStart(12),
    "Trades".padStart(8),
    "Entries".padStart(9),
    "Win%".padStart(8),
    "WkWin%".padStart(8),
    "WorstWk".padStart(10),
    "MaxExp".padStart(8),
  ].join(" "));
  for (const summary of summaries) {
    console.log([
      variantLabel(summary.variantId).padEnd(28),
      fmt(summary.totalReturnPct).padStart(10),
      `${summary.pathMaxDrawdownPct.toFixed(2)}%`.padStart(10),
      num(summary.returnToDd).padStart(8),
      num(summary.pathSharpe).padStart(12),
      String(summary.trades).padStart(8),
      `${summary.entriesOpened}/${summary.fullEntryEquivalentOpened.toFixed(1)}`.padStart(9),
      `${summary.winRatePct.toFixed(1)}%`.padStart(8),
      `${summary.weeklyWinRatePct.toFixed(1)}%`.padStart(8),
      fmt(summary.worstWeekPct).padStart(10),
      summary.maxExposureFse.toFixed(1).padStart(8),
    ].join(" "));
  }
}

function printCostSensitivityTable(title: string, rows: CostAdjustedSummary[]) {
  console.log(`\n${title}`);
  console.log("=".repeat(title.length));
  console.log([
    "Cost/FSE".padStart(9),
    "Variant".padEnd(24),
    "Return".padStart(10),
    "Path DD".padStart(10),
    "Ret/DD".padStart(8),
    "Path Sharpe".padStart(12),
    "ClosedFSE".padStart(10),
    "TotalCost".padStart(10),
  ].join(" "));
  for (const row of rows) {
    console.log([
      `${row.costPerFsePct.toFixed(4)}%`.padStart(9),
      variantLabel(row.variantId).padEnd(24),
      fmt(row.totalReturnPct).padStart(10),
      `${row.pathMaxDrawdownPct.toFixed(2)}%`.padStart(10),
      num(row.returnToDd).padStart(8),
      num(row.pathSharpe).padStart(12),
      row.fullEntryEquivalentClosed.toFixed(1).padStart(10),
      fmt(row.totalCostPct).padStart(10),
    ].join(" "));
  }
}

function printPlainEnglish(summary: VariantSummary, baseline: VariantSummary) {
  const deltaReturn = summary.totalReturnPct - baseline.totalReturnPct;
  const deltaDd = summary.pathMaxDrawdownPct - baseline.pathMaxDrawdownPct;
  const deltaSharpe = summary.pathSharpe - baseline.pathSharpe;
  console.log(`\n${summary.strategyId} / ${capLabel(summary.capMode)} / ${variantLabel(summary.variantId)}`);
  console.log(`What we did: ${variantDescription(summary.variantId)}`);
  console.log(`What happened: return ${fmt(summary.totalReturnPct)}, path DD ${summary.pathMaxDrawdownPct.toFixed(2)}%, path Sharpe ${summary.pathSharpe.toFixed(2)}, trades ${summary.trades}, max exposure ${summary.maxExposureFse.toFixed(1)} full-size equivalents.`);
  if (summary.variantId !== "current_app") {
    console.log(`Compared with current app: return ${fmt(deltaReturn)} ${deltaReturn >= 0 ? "higher" : "lower"}, path DD ${Math.abs(deltaDd).toFixed(2)} points ${deltaDd <= 0 ? "lower" : "higher"}, path Sharpe ${deltaSharpe >= 0 ? "+" : ""}${deltaSharpe.toFixed(2)}.`);
  }
  console.log(`Other important notes: first TPs ${summary.firstTpCount}, refills ${summary.refillEntryCount}, trail stops ${summary.runnerStopCount}, reset closes ${summary.resetCloseCount}, week-close exits ${summary.weekCloseCount}, cap blocks ${summary.capBlockedEntries}.`);
}

function variantDescription(id: VariantId) {
  if (id === "current_app") {
    return "This is the current app grid: full close at the next 0.20 ADR level, then that level can rearm.";
  }
  if (id === "current_app_seed") {
    return "Same current app close/rearm grid, plus one full-size seed trade at the execution open for each biased pair.";
  }
  if (id === "runner_refill_no_seed") {
    return "Same grid and reset as the app, but first TP closes half, leaves a runner, and later same-level entries only refill the missing half.";
  }
  if (id === "runner_refill_seed") {
    return "Same runner/refill rules, plus a starting seed position at the execution open.";
  }
  if (id === "half_refill_trail_020") {
    return "First TP closes half at +0.20 ADR, the other half trails by 0.20 ADR, and same-level refills can replace the closed half.";
  }
  if (id === "half_refill_trail_040") {
    return "First TP closes half at +0.20 ADR, the other half trails by 0.40 ADR, and same-level refills can replace the closed half.";
  }
  if (id === "whole_trail_020") {
    return "The normal +0.20 ADR TP arms a 0.20 ADR trailing stop for the whole fill instead of closing it; the level waits until that runner exits before re-entering.";
  }
  return "The normal +0.20 ADR TP arms a 0.40 ADR trailing stop for the whole fill instead of closing it; the level waits until that runner exits before re-entering.";
}

async function runStrategy(strategyId: string, weeks: string[], capMode: CapMode) {
  const strategy = getStrategy(strategyId);
  if (!strategy) throw new Error(`Missing strategy ${strategyId}`);

  const baselineWeeks: VariantWeek[] = [];
  const seededCurrentWeeks: VariantWeek[] = [];
  const runnerWeeks: VariantWeek[] = [];
  const seedWeeks: VariantWeek[] = [];
  const halfTrail020Weeks: VariantWeek[] = [];
  const halfTrail040Weeks: VariantWeek[] = [];
  const wholeTrail020Weeks: VariantWeek[] = [];
  const wholeTrail040Weeks: VariantWeek[] = [];

  for (const weekOpenUtc of weeks) {
    const baseline = await currentAppWeek({ strategy, weekOpenUtc, capMode });
    baselineWeeks.push(baseline);
    seededCurrentWeeks.push(await executeCurrentAppSeedWeek({
      strategy,
      weekOpenUtc,
      capMode,
      signals: baseline.result.signals,
    }));
    runnerWeeks.push(await executeRunnerRefillWeek({
      strategy,
      weekOpenUtc,
      capMode,
      seed: false,
      signals: baseline.result.signals,
    }));
    seedWeeks.push(await executeRunnerRefillWeek({
      strategy,
      weekOpenUtc,
      capMode,
      seed: true,
      signals: baseline.result.signals,
    }));
    halfTrail020Weeks.push(await executeRunnerRefillWeek({
      strategy,
      weekOpenUtc,
      capMode,
      seed: false,
      signals: baseline.result.signals,
      mode: "half_refill_trailing",
      trailAdr: 0.20,
    }));
    halfTrail040Weeks.push(await executeRunnerRefillWeek({
      strategy,
      weekOpenUtc,
      capMode,
      seed: false,
      signals: baseline.result.signals,
      mode: "half_refill_trailing",
      trailAdr: 0.40,
    }));
    wholeTrail020Weeks.push(await executeRunnerRefillWeek({
      strategy,
      weekOpenUtc,
      capMode,
      seed: false,
      signals: baseline.result.signals,
      mode: "whole_trailing",
      trailAdr: 0.20,
    }));
    wholeTrail040Weeks.push(await executeRunnerRefillWeek({
      strategy,
      weekOpenUtc,
      capMode,
      seed: false,
      signals: baseline.result.signals,
      mode: "whole_trailing",
      trailAdr: 0.40,
    }));
  }

  return [
    summarizeVariant({ strategyId: strategy.id, capMode, variantId: "current_app", weeks: baselineWeeks }),
    summarizeVariant({ strategyId: strategy.id, capMode, variantId: "current_app_seed", weeks: seededCurrentWeeks }),
    summarizeVariant({ strategyId: strategy.id, capMode, variantId: "runner_refill_no_seed", weeks: runnerWeeks }),
    summarizeVariant({ strategyId: strategy.id, capMode, variantId: "runner_refill_seed", weeks: seedWeeks }),
    summarizeVariant({ strategyId: strategy.id, capMode, variantId: "half_refill_trail_020", weeks: halfTrail020Weeks }),
    summarizeVariant({ strategyId: strategy.id, capMode, variantId: "half_refill_trail_040", weeks: halfTrail040Weeks }),
    summarizeVariant({ strategyId: strategy.id, capMode, variantId: "whole_trail_020", weeks: wholeTrail020Weeks }),
    summarizeVariant({ strategyId: strategy.id, capMode, variantId: "whole_trail_040", weeks: wholeTrail040Weeks }),
  ];
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

  console.log("ADR Grid runner/refill research");
  console.log(`Weeks: ${weeks.length} (${weeks[0]} -> ${weeks[weeks.length - 1]})`);
  console.log("Primary comparison uses Pair Fill Cap because that is the current production ADR Grid default.");
  console.log("Cap accounting for runner/refill uses full-size-equivalent exposure: half runner = 0.5, refill half = 0.5, full level = 1.0.");
  console.log("Trailing variants arm only after the normal +0.20 ADR grid TP is reached; stops use the previous confirmed H1 trail before updating from the next H1 bar.");

  const allSummaries: VariantSummary[] = [];
  for (const capMode of ["pair_fill_cap", "none"] as const) {
    for (const strategyId of ["tandem", "tiered_v3"]) {
      const summaries = await runStrategy(strategyId, weeks, capMode);
      allSummaries.push(...summaries);
      printSummaryTable(`${getStrategy(strategyId)?.label ?? strategyId} - ${capLabel(capMode)}`, summaries);
      const baseline = summaries[0]!;
      for (const summary of summaries) {
        printPlainEnglish(summary, baseline);
      }
    }
  }

  const primary = allSummaries.filter((summary) => summary.capMode === "pair_fill_cap" && summary.strategyId === "tandem");
  const baseline = primary.find((summary) => summary.variantId === "current_app");
  const seededCurrent = primary.find((summary) => summary.variantId === "current_app_seed");
  const runner = primary.find((summary) => summary.variantId === "runner_refill_no_seed");
  const trailing = primary.filter((summary) => summary.variantId.includes("trail"));
  const bestTrailing = trailing.sort((left, right) => right.pathSharpe - left.pathSharpe)[0];
  if (baseline && runner) {
    console.log("\nPrimary read");
    console.log("============");
    console.log(`We should judge the idea first against capped Tandem, because that is the app's current ADR Grid default.`);
    if (seededCurrent) {
      console.log(`Seeded current app changed return by ${fmt(seededCurrent.totalReturnPct - baseline.totalReturnPct)}, path DD by ${(seededCurrent.pathMaxDrawdownPct - baseline.pathMaxDrawdownPct).toFixed(2)} points, and path Sharpe by ${(seededCurrent.pathSharpe - baseline.pathSharpe).toFixed(2)}.`);
    }
    console.log(`Runner/refill no-seed changed return by ${fmt(runner.totalReturnPct - baseline.totalReturnPct)}, path DD by ${(runner.pathMaxDrawdownPct - baseline.pathMaxDrawdownPct).toFixed(2)} points, and path Sharpe by ${(runner.pathSharpe - baseline.pathSharpe).toFixed(2)}.`);
    if (bestTrailing) {
      console.log(`Best trailing variant by path Sharpe was ${variantLabel(bestTrailing.variantId)}: return ${fmt(bestTrailing.totalReturnPct)}, DD ${bestTrailing.pathMaxDrawdownPct.toFixed(2)}%, Sharpe ${bestTrailing.pathSharpe.toFixed(2)}, return/DD ${bestTrailing.returnToDd.toFixed(2)}.`);
      console.log(`Against current app, that is return ${fmt(bestTrailing.totalReturnPct - baseline.totalReturnPct)}, DD ${(bestTrailing.pathMaxDrawdownPct - baseline.pathMaxDrawdownPct).toFixed(2)} points, Sharpe ${(bestTrailing.pathSharpe - baseline.pathSharpe).toFixed(2)}.`);
    }
  }

  const costCandidates = primary.filter((summary) =>
    summary.variantId === "current_app" ||
    summary.variantId === "current_app_seed" ||
    summary.variantId === "runner_refill_no_seed" ||
    summary.variantId === "half_refill_trail_020" ||
    summary.variantId === "half_refill_trail_040"
  );
  const costLevels = [0, 0.0025, 0.005, 0.01, 0.02, 0.03];
  const costRows: CostAdjustedSummary[] = [];
  for (const costPerFsePct of costLevels) {
    for (const summary of costCandidates) {
      costRows.push(await summarizeWithCosts(summary, costPerFsePct));
    }
  }
  printCostSensitivityTable("Tandem - Pair fill cap ON - cost sensitivity", costRows);

  console.log("\nCost read");
  console.log("=========");
  console.log("Cost/FSE means normalized return percent paid for one full-size-equivalent closed trade. A half close pays half of that.");
  for (const costPerFsePct of costLevels) {
    const rows = costRows.filter((row) => row.costPerFsePct === costPerFsePct);
    const bestBySharpe = rows.sort((left, right) => right.pathSharpe - left.pathSharpe)[0];
    if (bestBySharpe) {
      console.log(`${costPerFsePct.toFixed(4)}% cost/FSE: best by path Sharpe is ${variantLabel(bestBySharpe.variantId)} (${bestBySharpe.pathSharpe.toFixed(2)} Sharpe, ${fmt(bestBySharpe.totalReturnPct)} return).`);
    }
  }
}

main().catch((error) => {
  console.error("[backtest-adr-grid-runner-refill] Failed:", error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
