import { DateTime } from "luxon";

import {
  clearRuntimeCacheAll,
  getRuntimeCacheStats,
  resetRuntimeCacheStats,
  type RuntimeCacheStats,
} from "@engine/cache/runtimeCache";
import { getExecutionWeekWindow } from "@engine/evaluation/executionPriceWindows";
import { getAdrPct, loadWeeklyAdrMap } from "@engine/price/adrLookup";
import { buildPathBarTimelines, loadPathBars, type PathBarPoint } from "@engine/price/pathBarLoader";
import type {
  ResearchDecisionAssetClass,
  ResearchDecisionManifest,
  ResearchDecisionRow,
  ResearchDecisionSide,
} from "@engine/research/decisionManifest";
import {
  attachResearchDecisionManifestHash,
  getResearchDecisionManifestIdentity,
  normalizeResearchDecisionManifest,
} from "@engine/research/decisionManifest";

export const RESEARCH_DECISION_EVALUATOR_VERSION = "research_decision_evaluator_adr_grid_weekly_hold_v1";

export type ResearchDecisionEvaluatorId = "adr_grid" | "weekly_hold";
export type ResearchDecisionPathResolution = "1m" | "1h";

export type ResearchDecisionWeekScore = {
  week_open_utc: string;
  decision_rows: number;
  adr_grid?: {
    adr: number;
    fills: number;
    tp: number;
    reset: number;
    week_close: number;
    missing_price_rows: number;
    default_adr_rows: number;
  };
  weekly_hold?: {
    adr: number;
    missing_price_rows: number;
    default_adr_rows: number;
  };
};

export type ResearchDecisionMetricSummary = {
  evaluator: ResearchDecisionEvaluatorId;
  weeks: number;
  decision_rows: number;
  total_adr: number;
  max_drawdown_adr: number;
  return_to_drawdown: number | null;
  profit_factor_adr: number | null;
  weekly_win_rate_active: number | null;
  missing_price_rows: number;
  default_adr_rows: number;
  fills?: number;
  tp?: number;
  reset?: number;
  week_close?: number;
};

export type ResearchDecisionRuntimeTelemetry = {
  schema_version: 1;
  mode: "single_manifest" | "batch_week_major";
  wall_clock_ms: number;
  wall_clock_seconds: number;
  manifest_count: number;
  union_week_count: number;
  row_count_evaluated: number;
  clear_runtime_cache_between_weeks: boolean;
  runtime_controls: {
    clear_runtime_cache_between_weeks: boolean;
    log_progress: boolean;
    batch_week_major: boolean;
  };
  cache: RuntimeCacheStats;
};

export type ResearchDecisionEvaluationResult = {
  schema_version: 1;
  generated_at_utc: string;
  manifest: ReturnType<typeof getResearchDecisionManifestIdentity>;
  evaluator: {
    evaluator_version: typeof RESEARCH_DECISION_EVALUATOR_VERSION;
    evaluators: ResearchDecisionEvaluatorId[];
    path_resolution: ResearchDecisionPathResolution;
  };
  coverage: {
    weeks: number;
    universe_symbols: number;
    decision_rows: number;
    long_rows: number;
    short_rows: number;
  };
  weekly_scores: ResearchDecisionWeekScore[];
  summaries: ResearchDecisionMetricSummary[];
  runtime: ResearchDecisionRuntimeTelemetry;
};

type GridLevel = {
  index: number;
  side: "favorable" | "continuation";
  triggerPrice: number;
};

type GridFill = {
  levelIndex: number;
  levelSide: "favorable" | "continuation";
  entryPrice: number;
  tpPrice: number;
  entryTimeUtc: string;
  entryBarIndex: number;
  active: boolean;
  maxAdverseRawPct: number;
};

type GridEngine = {
  symbol: string;
  direction: ResearchDecisionSide;
  openPrice: number;
  pairAdrPct: number;
  levels: GridLevel[];
  fills: GridFill[];
  levelArmed: boolean[];
  levelRearmBarIndex: number[];
  levelRequiresRetouch: boolean[];
  cycleHighPrice: number;
  cycleLowPrice: number;
  closedForWeek: boolean;
  entriesStoppedForWeek: boolean;
  entryCutoffGridIndex: number;
  closeGridIndex: number;
  realizedAdr: number;
};

type TradeRow = {
  symbol: string;
  direction: ResearchDecisionSide;
  exitReason: "grid_tp" | "grid_reset" | "week_close";
  entryTimeUtc: string;
  exitTimeUtc: string;
  entryPrice: number;
  exitPrice: number;
  pairAdrPct: number;
  adrReturn: number;
  rawReturnPct: number;
  maeAdr: number;
};

const ADR_GRID_SPACING = 0.20;
const ADR_GRID_RESET_ADR = 1.0;
const ADR_GRID_ENTRY_RESET_BUFFER_ADR = 0.20;
const ADR_GRID_MAX_LEVELS_PER_SIDE = 50;

function round(value: number | null | undefined, places = 4) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function directionSign(direction: ResearchDecisionSide) {
  return direction === "LONG" ? 1 : -1;
}

function buildAdrGridTimestamps(windowOpenUtc: string, windowCloseUtc: string, resolution: ResearchDecisionPathResolution) {
  const start = DateTime.fromISO(windowOpenUtc, { zone: "utc" });
  const end = DateTime.fromISO(windowCloseUtc, { zone: "utc" });
  if (!start.isValid || !end.isValid || end < start) return [windowOpenUtc];

  const grid: string[] = [];
  let cursor = resolution === "1m" ? start.startOf("minute") : start.startOf("hour");
  const final = resolution === "1m" ? end.startOf("minute") : end.startOf("hour");
  while (cursor <= final) {
    grid.push(cursor.toUTC().toISO() ?? windowOpenUtc);
    cursor = resolution === "1m" ? cursor.plus({ minutes: 1 }) : cursor.plus({ hours: 1 });
  }
  return grid;
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

function directedRawReturnPct(direction: ResearchDecisionSide, entryPrice: number, exitPrice: number) {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(exitPrice) || exitPrice <= 0) return 0;
  const rawReturn = ((exitPrice - entryPrice) / entryPrice) * 100;
  return direction === "SHORT" ? -rawReturn : rawReturn;
}

function adrGridAdverseRawPct(direction: ResearchDecisionSide, entryPrice: number, bar: PathBarPoint) {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return 0;
  return direction === "SHORT"
    ? Math.max(0, ((bar.highPrice - entryPrice) / entryPrice) * 100)
    : Math.max(0, ((entryPrice - bar.lowPrice) / entryPrice) * 100);
}

function adrGridPriceHit(direction: ResearchDecisionSide, bar: PathBarPoint, price: number) {
  return direction === "SHORT" ? bar.lowPrice <= price : bar.highPrice >= price;
}

function buildLevels(engine: Pick<GridEngine, "direction" | "openPrice" | "pairAdrPct">): GridLevel[] {
  const levels: GridLevel[] = [];
  const step = (ADR_GRID_SPACING * engine.pairAdrPct) / 100;
  let index = 0;

  for (let i = 1; i <= ADR_GRID_MAX_LEVELS_PER_SIDE; i += 1) {
    levels.push({
      index: index++,
      side: "favorable",
      triggerPrice: engine.direction === "LONG"
        ? engine.openPrice * (1 - i * step)
        : engine.openPrice * (1 + i * step),
    });
  }
  for (let i = 1; i <= ADR_GRID_MAX_LEVELS_PER_SIDE; i += 1) {
    levels.push({
      index: index++,
      side: "continuation",
      triggerPrice: engine.direction === "LONG"
        ? engine.openPrice * (1 + i * step)
        : engine.openPrice * (1 - i * step),
    });
  }

  return levels;
}

function getResetTarget(engine: GridEngine) {
  const resetMove = (ADR_GRID_RESET_ADR * engine.pairAdrPct) / 100;
  return engine.direction === "SHORT"
    ? engine.cycleHighPrice * (1 - resetMove)
    : engine.cycleLowPrice * (1 + resetMove);
}

function getFillTp(engine: GridEngine, entryPrice: number) {
  const targetMove = (ADR_GRID_SPACING * engine.pairAdrPct) / 100;
  return engine.direction === "SHORT"
    ? entryPrice * (1 - targetMove)
    : entryPrice * (1 + targetMove);
}

function isEntryTooCloseToReset(engine: GridEngine, entryPrice: number) {
  const resetTarget = getResetTarget(engine);
  const bufferMove = (ADR_GRID_ENTRY_RESET_BUFFER_ADR * engine.pairAdrPct) / 100;
  const bufferDistance = entryPrice * bufferMove;
  const resetDistance = engine.direction === "SHORT"
    ? entryPrice - resetTarget
    : resetTarget - entryPrice;
  return resetDistance <= 0 || resetDistance < bufferDistance * 0.999;
}

function closeFill(options: {
  trades: TradeRow[];
  engine: GridEngine;
  fill: GridFill;
  exitPrice: number;
  exitTimeUtc: string;
  exitReason: TradeRow["exitReason"];
}) {
  const rawReturnPct = directedRawReturnPct(options.engine.direction, options.fill.entryPrice, options.exitPrice);
  const adrReturn = rawReturnPct / options.engine.pairAdrPct;
  options.fill.active = false;
  options.engine.realizedAdr += adrReturn;
  options.trades.push({
    symbol: options.engine.symbol,
    direction: options.engine.direction,
    exitReason: options.exitReason,
    entryTimeUtc: options.fill.entryTimeUtc,
    exitTimeUtc: options.exitTimeUtc,
    entryPrice: round(options.fill.entryPrice, 8) ?? options.fill.entryPrice,
    exitPrice: round(options.exitPrice, 8) ?? options.exitPrice,
    pairAdrPct: round(options.engine.pairAdrPct, 6) ?? options.engine.pairAdrPct,
    rawReturnPct: round(rawReturnPct, 6) ?? rawReturnPct,
    adrReturn: round(adrReturn, 6) ?? adrReturn,
    maeAdr: round(options.fill.maxAdverseRawPct / options.engine.pairAdrPct, 6) ?? 0,
  });
}

function scoreAdrGridWeek(options: {
  assetClass: ResearchDecisionAssetClass;
  decisions: ResearchDecisionRow[];
  symbols: string[];
  grid: string[];
  entryCutoffUtc: string;
  closeUtc: string;
  barsBySymbol: Awaited<ReturnType<typeof loadPathBars>>;
  adrMap: Awaited<ReturnType<typeof loadWeeklyAdrMap>>;
}) {
  const timelines = buildPathBarTimelines(options.symbols, options.barsBySymbol, options.grid);
  const entryCutoffGridIndex = findGridIndexAtOrBefore(options.grid, options.entryCutoffUtc);
  const closeGridIndex = findGridIndexAtOrBefore(options.grid, options.closeUtc);
  const defaultAdrSymbols = new Set<string>();
  const engines: GridEngine[] = [];
  let missingPriceRows = 0;

  for (const decision of options.decisions) {
    const bars = options.barsBySymbol.get(decision.symbol) ?? [];
    const firstBar = bars.find((bar) => Number.isFinite(bar.openPrice) && bar.openPrice > 0);
    const hasPathBars = Boolean(timelines.get(decision.symbol)?.exactBars.some((bar) => bar !== null));
    if (!firstBar || !hasPathBars) {
      missingPriceRows += 1;
      continue;
    }
    if (!options.adrMap.has(decision.symbol)) defaultAdrSymbols.add(decision.symbol);
    const pairAdrPct = getAdrPct(options.adrMap, decision.symbol, options.assetClass);
    const base = {
      symbol: decision.symbol,
      direction: decision.side,
      openPrice: firstBar.openPrice,
      pairAdrPct,
    };
    const levels = buildLevels(base);
    engines.push({
      ...base,
      levels,
      fills: [],
      levelArmed: levels.map(() => true),
      levelRearmBarIndex: levels.map(() => -1),
      levelRequiresRetouch: levels.map(() => false),
      cycleHighPrice: firstBar.openPrice,
      cycleLowPrice: firstBar.openPrice,
      closedForWeek: false,
      entriesStoppedForWeek: false,
      entryCutoffGridIndex,
      closeGridIndex,
      realizedAdr: 0,
    });
  }

  const trades: TradeRow[] = [];

  for (let barIndex = 0; barIndex < options.grid.length; barIndex += 1) {
    const tsUtc = options.grid[barIndex] ?? options.closeUtc;
    for (const engine of engines) {
      if (engine.closedForWeek || barIndex > engine.closeGridIndex) continue;
      const timeline = timelines.get(engine.symbol);
      const bar = timeline?.exactBars[barIndex] ?? null;

      if (bar) {
        engine.cycleHighPrice = Math.max(engine.cycleHighPrice, bar.highPrice);
        engine.cycleLowPrice = Math.min(engine.cycleLowPrice, bar.lowPrice);

        for (const fill of engine.fills) {
          if (!fill.active) continue;
          fill.maxAdverseRawPct = Math.max(fill.maxAdverseRawPct, adrGridAdverseRawPct(engine.direction, fill.entryPrice, bar));
        }

        const resetTarget = getResetTarget(engine);
        if (adrGridPriceHit(engine.direction, bar, resetTarget)) {
          for (const fill of engine.fills) {
            if (!fill.active) continue;
            const tpHit = adrGridPriceHit(engine.direction, bar, fill.tpPrice);
            const resetReturn = directedRawReturnPct(engine.direction, fill.entryPrice, resetTarget);
            const tpReturn = directedRawReturnPct(engine.direction, fill.entryPrice, fill.tpPrice);
            const useTp = tpHit && resetReturn >= tpReturn - 1e-9;
            closeFill({
              trades,
              engine,
              fill,
              exitPrice: useTp ? fill.tpPrice : resetTarget,
              exitTimeUtc: tsUtc,
              exitReason: useTp ? "grid_tp" : "grid_reset",
            });
          }
          engine.entriesStoppedForWeek = true;
          engine.closedForWeek = true;
          continue;
        }

        for (const fill of engine.fills) {
          if (!fill.active) continue;
          if (!adrGridPriceHit(engine.direction, bar, fill.tpPrice)) continue;
          closeFill({ trades, engine, fill, exitPrice: fill.tpPrice, exitTimeUtc: tsUtc, exitReason: "grid_tp" });
          engine.levelArmed[fill.levelIndex] = true;
          engine.levelRearmBarIndex[fill.levelIndex] = barIndex;
          engine.levelRequiresRetouch[fill.levelIndex] = true;
        }

        if (barIndex < engine.entryCutoffGridIndex && !engine.entriesStoppedForWeek) {
          for (const level of engine.levels) {
            if (!engine.levelArmed[level.index]) continue;
            if ((engine.levelRearmBarIndex[level.index] ?? -1) >= barIndex) continue;
            const initialTriggered = level.side === "favorable"
              ? (engine.direction === "LONG" ? bar.lowPrice <= level.triggerPrice : bar.highPrice >= level.triggerPrice)
              : (engine.direction === "LONG" ? bar.highPrice >= level.triggerPrice : bar.lowPrice <= level.triggerPrice);
            const retouchTriggered = engine.direction === "LONG"
              ? bar.lowPrice <= level.triggerPrice
              : bar.highPrice >= level.triggerPrice;
            const triggered = engine.levelRequiresRetouch[level.index] ? retouchTriggered : initialTriggered;
            if (!triggered) continue;
            if (isEntryTooCloseToReset(engine, level.triggerPrice)) continue;
            engine.fills.push({
              levelIndex: level.index,
              levelSide: level.side,
              entryPrice: level.triggerPrice,
              tpPrice: getFillTp(engine, level.triggerPrice),
              entryTimeUtc: tsUtc,
              entryBarIndex: barIndex,
              active: true,
              maxAdverseRawPct: 0,
            });
            engine.levelArmed[level.index] = false;
            engine.levelRequiresRetouch[level.index] = false;
          }
        }
      }

      if (barIndex === engine.closeGridIndex && !engine.closedForWeek) {
        const mark = timeline?.markBars[barIndex]?.closePrice ?? engine.openPrice;
        for (const fill of engine.fills) {
          if (!fill.active) continue;
          closeFill({
            trades,
            engine,
            fill,
            exitPrice: mark,
            exitTimeUtc: tsUtc,
            exitReason: "week_close",
          });
        }
        engine.closedForWeek = true;
      }
    }
  }

  const finalAdr = trades.reduce((sum, trade) => sum + trade.adrReturn, 0);
  return {
    adr: round(finalAdr, 6) ?? finalAdr,
    fills: trades.length,
    tp: trades.filter((trade) => trade.exitReason === "grid_tp").length,
    reset: trades.filter((trade) => trade.exitReason === "grid_reset").length,
    week_close: trades.filter((trade) => trade.exitReason === "week_close").length,
    missing_price_rows: missingPriceRows,
    default_adr_rows: defaultAdrSymbols.size,
  };
}

function scoreSimpleWeeklyHold(options: {
  assetClass: ResearchDecisionAssetClass;
  decisions: ResearchDecisionRow[];
  barsBySymbol: Awaited<ReturnType<typeof loadPathBars>>;
  adrMap: Awaited<ReturnType<typeof loadWeeklyAdrMap>>;
}) {
  let totalAdr = 0;
  let missingPriceRows = 0;
  const defaultAdrSymbols = new Set<string>();

  for (const decision of options.decisions) {
    const bars = options.barsBySymbol.get(decision.symbol) ?? [];
    const first = bars[0];
    const last = bars[bars.length - 1];
    if (!first || !last || !Number.isFinite(first.openPrice) || first.openPrice <= 0) {
      missingPriceRows += 1;
      continue;
    }
    if (!options.adrMap.has(decision.symbol)) defaultAdrSymbols.add(decision.symbol);
    const pairAdrPct = getAdrPct(options.adrMap, decision.symbol, options.assetClass);
    const raw = ((last.closePrice - first.openPrice) / first.openPrice) * 100 * directionSign(decision.side);
    totalAdr += raw / pairAdrPct;
  }

  return {
    adr: round(totalAdr, 6) ?? totalAdr,
    missing_price_rows: missingPriceRows,
    default_adr_rows: defaultAdrSymbols.size,
  };
}

type ResearchDecisionWeekScoringContext = {
  grid: string[];
  entryCutoffUtc: string;
  windowCloseUtc: string;
  symbols: string[];
  barsBySymbol: Awaited<ReturnType<typeof loadPathBars>>;
  adrMap: Awaited<ReturnType<typeof loadWeeklyAdrMap>>;
};

async function loadResearchDecisionWeekScoringContext(options: {
  assetClass: ResearchDecisionAssetClass;
  priceBundleId: string;
  weekOpenUtc: string;
  symbols: string[];
  pathResolution: ResearchDecisionPathResolution;
}): Promise<ResearchDecisionWeekScoringContext> {
  const executionWindow = getExecutionWeekWindow(options.weekOpenUtc, options.assetClass);
  const windowOpenUtc = executionWindow.windowOpenUtc.toUTC().toISO() ?? options.weekOpenUtc;
  const entryCutoffUtc = executionWindow.entryCutoffUtc.toUTC().toISO() ?? options.weekOpenUtc;
  const windowCloseUtc = executionWindow.windowCloseUtc.toUTC().toISO() ?? options.weekOpenUtc;
  const grid = buildAdrGridTimestamps(windowOpenUtc, windowCloseUtc, options.pathResolution);
  const symbols = Array.from(new Set(options.symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))).sort();
  const [barsBySymbol, adrMap] = await Promise.all([
    loadPathBars(symbols, windowOpenUtc, windowCloseUtc, options.pathResolution, options.priceBundleId),
    loadWeeklyAdrMap(options.weekOpenUtc, options.priceBundleId),
  ]);
  return {
    grid,
    entryCutoffUtc,
    windowCloseUtc,
    symbols,
    barsBySymbol,
    adrMap,
  };
}

function scoreResearchDecisionWeekWithContext(options: {
  assetClass: ResearchDecisionAssetClass;
  weekOpenUtc: string;
  decisions: ResearchDecisionRow[];
  evaluators: ResearchDecisionEvaluatorId[];
  context: ResearchDecisionWeekScoringContext;
}) {
  const score: ResearchDecisionWeekScore = {
    week_open_utc: options.weekOpenUtc,
    decision_rows: options.decisions.length,
  };
  if (options.evaluators.includes("adr_grid")) {
    score.adr_grid = scoreAdrGridWeek({
      assetClass: options.assetClass,
      decisions: options.decisions,
      symbols: options.context.symbols,
      grid: options.context.grid,
      entryCutoffUtc: options.context.entryCutoffUtc,
      closeUtc: options.context.windowCloseUtc,
      barsBySymbol: options.context.barsBySymbol,
      adrMap: options.context.adrMap,
    });
  }
  if (options.evaluators.includes("weekly_hold")) {
    score.weekly_hold = scoreSimpleWeeklyHold({
      assetClass: options.assetClass,
      decisions: options.decisions,
      barsBySymbol: options.context.barsBySymbol,
      adrMap: options.context.adrMap,
    });
  }
  return score;
}

async function scoreResearchDecisionWeek(options: {
  assetClass: ResearchDecisionAssetClass;
  priceBundleId: string;
  weekOpenUtc: string;
  decisions: ResearchDecisionRow[];
  pathResolution: ResearchDecisionPathResolution;
  evaluators: ResearchDecisionEvaluatorId[];
}) {
  const context = await loadResearchDecisionWeekScoringContext({
    assetClass: options.assetClass,
    priceBundleId: options.priceBundleId,
    weekOpenUtc: options.weekOpenUtc,
    symbols: options.decisions.map((decision) => decision.symbol),
    pathResolution: options.pathResolution,
  });
  return scoreResearchDecisionWeekWithContext({
    assetClass: options.assetClass,
    weekOpenUtc: options.weekOpenUtc,
    decisions: options.decisions,
    evaluators: options.evaluators,
    context,
  });
}

function maxDrawdown(values: number[]) {
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const value of values) {
    equity += value;
    peak = Math.max(peak, equity);
    maxDd = Math.min(maxDd, equity - peak);
  }
  return maxDd;
}

function summarizeScores(evaluator: ResearchDecisionEvaluatorId, scores: ResearchDecisionWeekScore[]): ResearchDecisionMetricSummary {
  const weeklyValues = scores.map((score) => {
    if (evaluator === "adr_grid") return score.adr_grid?.adr ?? 0;
    return score.weekly_hold?.adr ?? 0;
  });
  const positiveAdr = weeklyValues.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const negativeAdr = weeklyValues.filter((value) => value < 0).reduce((sum, value) => sum + value, 0);
  const activeValues = weeklyValues.filter((value) => value !== 0);
  const totalAdr = weeklyValues.reduce((sum, value) => sum + value, 0);
  const drawdown = maxDrawdown(weeklyValues);
  const common = {
    evaluator,
    weeks: scores.length,
    decision_rows: scores.reduce((sum, score) => sum + score.decision_rows, 0),
    total_adr: round(totalAdr) ?? 0,
    max_drawdown_adr: round(drawdown) ?? 0,
    return_to_drawdown: drawdown < 0 ? round(totalAdr / Math.abs(drawdown)) : null,
    profit_factor_adr: negativeAdr < 0 ? round(positiveAdr / Math.abs(negativeAdr)) : null,
    weekly_win_rate_active: activeValues.length > 0
      ? round(activeValues.filter((value) => value > 0).length / activeValues.length)
      : null,
  };

  if (evaluator === "adr_grid") {
    return {
      ...common,
      missing_price_rows: scores.reduce((sum, score) => sum + (score.adr_grid?.missing_price_rows ?? 0), 0),
      default_adr_rows: scores.reduce((sum, score) => sum + (score.adr_grid?.default_adr_rows ?? 0), 0),
      fills: scores.reduce((sum, score) => sum + (score.adr_grid?.fills ?? 0), 0),
      tp: scores.reduce((sum, score) => sum + (score.adr_grid?.tp ?? 0), 0),
      reset: scores.reduce((sum, score) => sum + (score.adr_grid?.reset ?? 0), 0),
      week_close: scores.reduce((sum, score) => sum + (score.adr_grid?.week_close ?? 0), 0),
    };
  }

  return {
    ...common,
    missing_price_rows: scores.reduce((sum, score) => sum + (score.weekly_hold?.missing_price_rows ?? 0), 0),
    default_adr_rows: scores.reduce((sum, score) => sum + (score.weekly_hold?.default_adr_rows ?? 0), 0),
  };
}

function groupDecisionsByWeek(decisions: ResearchDecisionRow[]) {
  const byWeek = new Map<string, ResearchDecisionRow[]>();
  for (const decision of decisions) {
    const rows = byWeek.get(decision.week_open_utc) ?? [];
    rows.push(decision);
    byWeek.set(decision.week_open_utc, rows);
  }
  return byWeek;
}

function buildRuntimeTelemetry(options: {
  mode: ResearchDecisionRuntimeTelemetry["mode"];
  startedAt: number;
  manifestCount: number;
  unionWeekCount: number;
  rowCountEvaluated: number;
  clearRuntimeCacheBetweenWeeks: boolean;
  logProgress: boolean;
}): ResearchDecisionRuntimeTelemetry {
  const wallClockMs = Date.now() - options.startedAt;
  return {
    schema_version: 1,
    mode: options.mode,
    wall_clock_ms: wallClockMs,
    wall_clock_seconds: Math.round(wallClockMs / 100) / 10,
    manifest_count: options.manifestCount,
    union_week_count: options.unionWeekCount,
    row_count_evaluated: options.rowCountEvaluated,
    clear_runtime_cache_between_weeks: options.clearRuntimeCacheBetweenWeeks,
    runtime_controls: {
      clear_runtime_cache_between_weeks: options.clearRuntimeCacheBetweenWeeks,
      log_progress: options.logProgress,
      batch_week_major: options.mode === "batch_week_major",
    },
    cache: getRuntimeCacheStats(),
  };
}

function buildEvaluationResult(options: {
  manifest: ResearchDecisionManifest;
  evaluators: ResearchDecisionEvaluatorId[];
  pathResolution: ResearchDecisionPathResolution;
  weeklyScores: ResearchDecisionWeekScore[];
  runtime: ResearchDecisionRuntimeTelemetry;
}): ResearchDecisionEvaluationResult {
  return {
    schema_version: 1,
    generated_at_utc: new Date().toISOString(),
    manifest: getResearchDecisionManifestIdentity(options.manifest),
    evaluator: {
      evaluator_version: RESEARCH_DECISION_EVALUATOR_VERSION,
      evaluators: options.evaluators,
      path_resolution: options.pathResolution,
    },
    coverage: {
      weeks: options.weeklyScores.length,
      universe_symbols: options.manifest.universe.symbols.length,
      decision_rows: options.manifest.decisions.length,
      long_rows: options.manifest.decisions.filter((row) => row.side === "LONG").length,
      short_rows: options.manifest.decisions.filter((row) => row.side === "SHORT").length,
    },
    weekly_scores: options.weeklyScores,
    summaries: options.evaluators.map((evaluator) => summarizeScores(evaluator, options.weeklyScores)),
    runtime: options.runtime,
  };
}

export async function evaluateResearchDecisionManifest(options: {
  manifest: ResearchDecisionManifest;
  pathResolution?: ResearchDecisionPathResolution;
  evaluators?: ResearchDecisionEvaluatorId[];
  clearRuntimeCacheBetweenWeeks?: boolean;
  logProgress?: boolean;
}): Promise<ResearchDecisionEvaluationResult> {
  const startedAt = Date.now();
  resetRuntimeCacheStats();
  const manifest = attachResearchDecisionManifestHash(normalizeResearchDecisionManifest(options.manifest));
  const evaluators = options.evaluators ?? ["adr_grid", "weekly_hold"];
  const pathResolution = options.pathResolution ?? "1m";
  const byWeek = groupDecisionsByWeek(manifest.decisions);
  const weeks = [...byWeek.keys()].sort();
  const weeklyScores: ResearchDecisionWeekScore[] = [];

  for (const [index, weekOpenUtc] of weeks.entries()) {
    const startedAt = Date.now();
    const decisions = byWeek.get(weekOpenUtc) ?? [];
    weeklyScores.push(await scoreResearchDecisionWeek({
      assetClass: manifest.universe.asset_class,
      priceBundleId: manifest.price_bundle_id,
      weekOpenUtc,
      decisions,
      pathResolution,
      evaluators,
    }));
    if (options.clearRuntimeCacheBetweenWeeks) {
      clearRuntimeCacheAll();
    }
    if (options.logProgress) {
      console.log(
        [
          `scoreWeek=${index + 1}/${weeks.length}`,
          `week=${weekOpenUtc.slice(0, 10)}`,
          `rows=${decisions.length}`,
          `elapsed=${((Date.now() - startedAt) / 1000).toFixed(2)}s`,
        ].join(" | "),
      );
    }
  }

  return buildEvaluationResult({
    manifest,
    evaluators,
    pathResolution,
    weeklyScores,
    runtime: buildRuntimeTelemetry({
      mode: "single_manifest",
      startedAt,
      manifestCount: 1,
      unionWeekCount: weeks.length,
      rowCountEvaluated: manifest.decisions.length,
      clearRuntimeCacheBetweenWeeks: Boolean(options.clearRuntimeCacheBetweenWeeks),
      logProgress: Boolean(options.logProgress),
    }),
  });
}

export async function evaluateResearchDecisionManifestBatch(options: {
  manifests: ResearchDecisionManifest[];
  pathResolution?: ResearchDecisionPathResolution;
  evaluators?: ResearchDecisionEvaluatorId[];
  clearRuntimeCacheBetweenWeeks?: boolean;
  logProgress?: boolean;
}): Promise<ResearchDecisionEvaluationResult[]> {
  if (options.manifests.length === 0) return [];
  const startedAt = Date.now();
  resetRuntimeCacheStats();
  const manifests = options.manifests.map((manifest) =>
    attachResearchDecisionManifestHash(normalizeResearchDecisionManifest(manifest)));
  const evaluators = options.evaluators ?? ["adr_grid", "weekly_hold"];
  const pathResolution = options.pathResolution ?? "1m";
  const first = manifests[0]!;
  for (const manifest of manifests.slice(1)) {
    if (manifest.price_bundle_id !== first.price_bundle_id) {
      throw new Error(`Batch manifests must share price_bundle_id: ${first.price_bundle_id} !== ${manifest.price_bundle_id}`);
    }
    if (manifest.universe.asset_class !== first.universe.asset_class) {
      throw new Error(`Batch manifests must share asset_class: ${first.universe.asset_class} !== ${manifest.universe.asset_class}`);
    }
  }

  const byWeekByManifest = manifests.map((manifest) => groupDecisionsByWeek(manifest.decisions));
  const unionWeeks = Array.from(
    new Set(byWeekByManifest.flatMap((byWeek) => [...byWeek.keys()])),
  ).sort();
  const weeklyScoresByManifest = manifests.map(() => [] as ResearchDecisionWeekScore[]);

  for (const [weekIndex, weekOpenUtc] of unionWeeks.entries()) {
    const startedWeekAt = Date.now();
    const weekRowsByManifest = byWeekByManifest.map((byWeek) => byWeek.get(weekOpenUtc) ?? []);
    const symbols = Array.from(
      new Set(weekRowsByManifest.flatMap((rows) => rows.map((row) => row.symbol))),
    ).sort();
    const context = await loadResearchDecisionWeekScoringContext({
      assetClass: first.universe.asset_class,
      priceBundleId: first.price_bundle_id,
      weekOpenUtc,
      symbols,
      pathResolution,
    });

    for (const [manifestIndex, decisions] of weekRowsByManifest.entries()) {
      if (decisions.length === 0) continue;
      weeklyScoresByManifest[manifestIndex]!.push(scoreResearchDecisionWeekWithContext({
        assetClass: manifests[manifestIndex]!.universe.asset_class,
        weekOpenUtc,
        decisions,
        evaluators,
        context,
      }));
    }

    if (options.clearRuntimeCacheBetweenWeeks) {
      clearRuntimeCacheAll();
    }
    if (options.logProgress) {
      console.log(
        [
          `scoreBatchWeek=${weekIndex + 1}/${unionWeeks.length}`,
          `week=${weekOpenUtc.slice(0, 10)}`,
          `manifests=${manifests.length}`,
          `rows=${weekRowsByManifest.reduce((sum, rows) => sum + rows.length, 0)}`,
          `elapsed=${((Date.now() - startedWeekAt) / 1000).toFixed(2)}s`,
        ].join(" | "),
      );
    }
  }

  const runtime = buildRuntimeTelemetry({
    mode: "batch_week_major",
    startedAt,
    manifestCount: manifests.length,
    unionWeekCount: unionWeeks.length,
    rowCountEvaluated: manifests.reduce((sum, manifest) => sum + manifest.decisions.length, 0),
    clearRuntimeCacheBetweenWeeks: Boolean(options.clearRuntimeCacheBetweenWeeks),
    logProgress: Boolean(options.logProgress),
  });

  return manifests.map((manifest, index) => buildEvaluationResult({
    manifest,
    evaluators,
    pathResolution,
    weeklyScores: weeklyScoresByManifest[index] ?? [],
    runtime,
  }));
}
