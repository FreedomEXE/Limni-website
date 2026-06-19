/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: export-fx-hedged-adr-grid-week.ts
 *
 * Description:
 * Gate 36d research-only exporter for a fully hedged 28-pair FX ADR Grid:
 * every listed FX pair runs both a LONG and SHORT grid for one selected week.
 * No COT, no source filter, no pair fill cap, no commissions/spread/swap.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { getPool } from "@/lib/db";
import { getExecutionWeekWindow } from "@/lib/executionPriceWindows";
import { getCanonicalWeeklyPairReturns } from "@/lib/pairReturns";
import { getAdrPct, loadWeeklyAdrMap } from "@/lib/performance/adrLookup";
import { loadPathBarTimelines, type PathBarPoint } from "@/lib/performance/pathBarLoader";
import { formatTradingWeekLabelIsoDate, getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "@/lib/weekAnchor";

loadEnvConfig(process.cwd());

type Direction = "LONG" | "SHORT";
type ExitReason = "grid_tp" | "grid_reset" | "week_close";

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

type GridLevel = {
  index: number;
  side: "favorable" | "continuation";
  triggerPrice: number;
};

type GridEngine = {
  symbol: string;
  direction: Direction;
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
  realizedRawPct: number;
  realizedAdrPct: number;
  maxActiveFills: number;
  maxActiveAdrExposure: number;
};

type TradeRow = {
  symbol: string;
  direction: Direction;
  fillSeq: number;
  levelIndex: number;
  levelSide: "favorable" | "continuation";
  entryTimeUtc: string;
  exitTimeUtc: string;
  exitReason: ExitReason;
  entryPrice: number;
  exitPrice: number;
  tpPrice: number;
  pairAdrPct: number;
  rawReturnPct: number;
  adrReturn: number;
  maeRawPct: number;
  maeAdr: number;
};

type PathPoint = {
  tsUtc: string;
  combinedRawPct: number;
  combinedAdr: number;
  listedLongRawPct: number;
  listedLongAdr: number;
  listedShortRawPct: number;
  listedShortAdr: number;
  activeFills: number;
  activeLongFills: number;
  activeShortFills: number;
  activeAdrExposure: number;
};

type PathSummary = {
  final: number;
  peak: number;
  trough: number;
  maxDrawdown: number;
  maxDrawdownTimeUtc: string | null;
  maxActiveFills: number;
  maxActiveAdrExposure: number;
};

type PairSummary = {
  symbol: string;
  pairAdrPct: number;
  longFills: number;
  shortFills: number;
  totalFills: number;
  longTp: number;
  shortTp: number;
  totalTp: number;
  longReset: number;
  shortReset: number;
  totalReset: number;
  longWeekClose: number;
  shortWeekClose: number;
  totalWeekClose: number;
  longRawPct: number;
  shortRawPct: number;
  hedgedRawPct: number;
  longAdr: number;
  shortAdr: number;
  hedgedAdr: number;
  maxMaeAdr: number;
};

const ADR_GRID_SPACING = 0.20;
const ADR_GRID_RESET_ADR = 1.0;
const ADR_GRID_ENTRY_RESET_BUFFER_ADR = 0.20;
const ADR_GRID_MAX_LEVELS_PER_SIDE = 50;

function argValue(name: string): string | null {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function normalizePathResolution(value: string | null | undefined) {
  const raw = (value ?? "1h").trim().toLowerCase();
  if (raw === "1m" || raw === "m1") return "1m";
  if (raw === "1h" || raw === "h1") return "1h";
  throw new Error(`Unsupported --path-resolution value: ${value}`);
}

function round(value: number | null | undefined, places = 6) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function fixed(value: number | null | undefined, places = 2) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(places) : "-";
}

function signed(value: number | null | undefined, places = 2, suffix = "") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(places)}${suffix}`;
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function tradesToCsv(rows: TradeRow[]) {
  const columns: Array<keyof TradeRow> = [
    "symbol",
    "direction",
    "fillSeq",
    "levelIndex",
    "levelSide",
    "entryTimeUtc",
    "exitTimeUtc",
    "exitReason",
    "entryPrice",
    "exitPrice",
    "tpPrice",
    "pairAdrPct",
    "rawReturnPct",
    "adrReturn",
    "maeRawPct",
    "maeAdr",
  ];
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n");
}

function pathToCsv(rows: PathPoint[]) {
  const columns: Array<keyof PathPoint> = [
    "tsUtc",
    "combinedRawPct",
    "combinedAdr",
    "listedLongRawPct",
    "listedLongAdr",
    "listedShortRawPct",
    "listedShortAdr",
    "activeFills",
    "activeLongFills",
    "activeShortFills",
    "activeAdrExposure",
  ];
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n");
}

function buildAdrGridTimestamps(weekOpenUtc: string, weekCloseUtc: string, resolution: string) {
  const start = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const end = DateTime.fromISO(weekCloseUtc, { zone: "utc" });
  if (!start.isValid || !end.isValid || end < start) return [weekOpenUtc];

  const grid: string[] = [];
  const isMinute = resolution === "1m";
  let cursor = isMinute ? start.startOf("minute") : start.startOf("hour");
  const final = isMinute ? end.startOf("minute") : end.startOf("hour");
  while (cursor <= final) {
    grid.push(cursor.toUTC().toISO() ?? weekOpenUtc);
    cursor = isMinute ? cursor.plus({ minutes: 1 }) : cursor.plus({ hours: 1 });
  }
  return grid;
}

function previousDisplayWeekOpenUtc() {
  const current = DateTime.fromISO(getDisplayWeekOpenUtc(DateTime.utc()), { zone: "utc" });
  return current.minus({ weeks: 1 }).toUTC().toISO() ?? getDisplayWeekOpenUtc(DateTime.utc());
}

function directedRawReturnPct(direction: Direction, entryPrice: number, exitPrice: number) {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(exitPrice) || exitPrice <= 0) return 0;
  const rawReturn = ((exitPrice - entryPrice) / entryPrice) * 100;
  return direction === "SHORT" ? -rawReturn : rawReturn;
}

function adrGridAdverseRawPct(direction: Direction, entryPrice: number, bar: PathBarPoint) {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return 0;
  return direction === "SHORT"
    ? Math.max(0, ((bar.highPrice - entryPrice) / entryPrice) * 100)
    : Math.max(0, ((entryPrice - bar.lowPrice) / entryPrice) * 100);
}

function adrGridPriceHit(direction: Direction, bar: PathBarPoint, price: number) {
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

function activeFills(engine: GridEngine) {
  return engine.fills.filter((fill) => fill.active);
}

function activeAdrExposure(engine: GridEngine) {
  return activeFills(engine).length * ADR_GRID_SPACING;
}

function closeFill(options: {
  trades: TradeRow[];
  engine: GridEngine;
  fill: GridFill;
  exitPrice: number;
  exitTimeUtc: string;
  exitReason: ExitReason;
}) {
  const rawReturnPct = directedRawReturnPct(options.engine.direction, options.fill.entryPrice, options.exitPrice);
  const adrReturn = rawReturnPct / options.engine.pairAdrPct;
  options.fill.active = false;
  options.engine.realizedRawPct += rawReturnPct;
  options.engine.realizedAdrPct += adrReturn;
  options.trades.push({
    symbol: options.engine.symbol,
    direction: options.engine.direction,
    fillSeq: options.trades.filter((row) => row.symbol === options.engine.symbol && row.direction === options.engine.direction).length + 1,
    levelIndex: options.fill.levelIndex,
    levelSide: options.fill.levelSide,
    entryTimeUtc: options.fill.entryTimeUtc,
    exitTimeUtc: options.exitTimeUtc,
    exitReason: options.exitReason,
    entryPrice: round(options.fill.entryPrice, 8) ?? options.fill.entryPrice,
    exitPrice: round(options.exitPrice, 8) ?? options.exitPrice,
    tpPrice: round(options.fill.tpPrice, 8) ?? options.fill.tpPrice,
    pairAdrPct: round(options.engine.pairAdrPct, 6) ?? options.engine.pairAdrPct,
    rawReturnPct: round(rawReturnPct, 6) ?? rawReturnPct,
    adrReturn: round(adrReturn, 6) ?? adrReturn,
    maeRawPct: round(options.fill.maxAdverseRawPct, 6) ?? options.fill.maxAdverseRawPct,
    maeAdr: round(options.fill.maxAdverseRawPct / options.engine.pairAdrPct, 6) ?? 0,
  });
}

function markEngine(engine: GridEngine, markPrice: number | null) {
  let raw = engine.realizedRawPct;
  let adr = engine.realizedAdrPct;
  if (markPrice && markPrice > 0) {
    for (const fill of engine.fills) {
      if (!fill.active) continue;
      const fillRaw = directedRawReturnPct(engine.direction, fill.entryPrice, markPrice);
      raw += fillRaw;
      adr += fillRaw / engine.pairAdrPct;
    }
  }
  return { raw, adr };
}

function summarizePath(points: PathPoint[], field: keyof Pick<PathPoint, "combinedAdr" | "combinedRawPct" | "listedLongAdr" | "listedShortAdr">): PathSummary {
  let peak = 0;
  let trough = 0;
  let maxDrawdown = 0;
  let maxDrawdownTimeUtc: string | null = null;
  let maxActiveFills = 0;
  let maxActiveAdrExposure = 0;
  for (const point of points) {
    const value = Number(point[field]);
    peak = Math.max(peak, value);
    trough = Math.min(trough, value);
    const drawdown = value - peak;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownTimeUtc = point.tsUtc;
    }
    maxActiveFills = Math.max(maxActiveFills, point.activeFills);
    maxActiveAdrExposure = Math.max(maxActiveAdrExposure, point.activeAdrExposure);
  }
  return {
    final: round(points[points.length - 1]?.[field] as number | undefined, 6) ?? 0,
    peak: round(peak, 6) ?? 0,
    trough: round(trough, 6) ?? 0,
    maxDrawdown: round(maxDrawdown, 6) ?? 0,
    maxDrawdownTimeUtc,
    maxActiveFills,
    maxActiveAdrExposure: round(maxActiveAdrExposure, 6) ?? maxActiveAdrExposure,
  };
}

function summarizePairs(trades: TradeRow[], pairAdrBySymbol: Map<string, number>): PairSummary[] {
  return Array.from(pairAdrBySymbol.keys()).sort().map((symbol) => {
    const pairTrades = trades.filter((trade) => trade.symbol === symbol);
    const longTrades = pairTrades.filter((trade) => trade.direction === "LONG");
    const shortTrades = pairTrades.filter((trade) => trade.direction === "SHORT");
    const countReason = (rows: TradeRow[], reason: ExitReason) => rows.filter((row) => row.exitReason === reason).length;
    const sum = (rows: TradeRow[], field: keyof Pick<TradeRow, "rawReturnPct" | "adrReturn">) =>
      rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
    const maxMaeAdr = pairTrades.reduce((max, row) => Math.max(max, row.maeAdr), 0);
    return {
      symbol,
      pairAdrPct: round(pairAdrBySymbol.get(symbol), 6) ?? 0,
      longFills: longTrades.length,
      shortFills: shortTrades.length,
      totalFills: pairTrades.length,
      longTp: countReason(longTrades, "grid_tp"),
      shortTp: countReason(shortTrades, "grid_tp"),
      totalTp: countReason(pairTrades, "grid_tp"),
      longReset: countReason(longTrades, "grid_reset"),
      shortReset: countReason(shortTrades, "grid_reset"),
      totalReset: countReason(pairTrades, "grid_reset"),
      longWeekClose: countReason(longTrades, "week_close"),
      shortWeekClose: countReason(shortTrades, "week_close"),
      totalWeekClose: countReason(pairTrades, "week_close"),
      longRawPct: round(sum(longTrades, "rawReturnPct"), 6) ?? 0,
      shortRawPct: round(sum(shortTrades, "rawReturnPct"), 6) ?? 0,
      hedgedRawPct: round(sum(pairTrades, "rawReturnPct"), 6) ?? 0,
      longAdr: round(sum(longTrades, "adrReturn"), 6) ?? 0,
      shortAdr: round(sum(shortTrades, "adrReturn"), 6) ?? 0,
      hedgedAdr: round(sum(pairTrades, "adrReturn"), 6) ?? 0,
      maxMaeAdr: round(maxMaeAdr, 6) ?? 0,
    };
  });
}

function buildMarkdown(options: {
  generatedAtUtc: string;
  weekOpenUtc: string;
  weekLabel: string;
  expectedPairs: string[];
  missingSymbols: string[];
  defaultAdrSymbols: string[];
  trades: TradeRow[];
  pairSummaries: PairSummary[];
  pathSummaryAdr: PathSummary;
  pathSummaryRaw: PathSummary;
  longSummaryAdr: PathSummary;
  shortSummaryAdr: PathSummary;
  pathPoints: PathPoint[];
  jsonPath: string;
  tradesCsvPath: string;
  pathCsvPath: string;
  pathResolution: string;
}) {
  const longTrades = options.trades.filter((trade) => trade.direction === "LONG");
  const shortTrades = options.trades.filter((trade) => trade.direction === "SHORT");
  const countReason = (rows: TradeRow[], reason: ExitReason) => rows.filter((row) => row.exitReason === reason).length;
  const sum = (rows: TradeRow[], field: keyof Pick<TradeRow, "rawReturnPct" | "adrReturn">) =>
    rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
  const bestPairs = [...options.pairSummaries].sort((left, right) => right.hedgedAdr - left.hedgedAdr).slice(0, 8);
  const worstPairs = [...options.pairSummaries].sort((left, right) => left.hedgedAdr - right.hedgedAdr).slice(0, 8);

  const lines = [
    "# Gate 36d Hedged FX ADR Grid Week",
    "",
    `Generated: ${options.generatedAtUtc}`,
    "",
    "## Scope",
    "",
    `- Displayed week: ${options.weekLabel}`,
    `- Logical week open: ${options.weekOpenUtc}`,
    `- Pairs: ${options.expectedPairs.join(", ")}`,
    "- Basket: all 28 listed FX pairs LONG plus all 28 listed FX pairs SHORT.",
    `- Execution: pure ADR Grid, 0.20 ADR spacing/TP, 1.0 ADR reset, reset-entry buffer on, canonical ${options.pathResolution} bars.`,
    "- Source: none. COT, sentiment, strength, pair fill cap, spread, commission, swap, slippage, and margin rules are excluded.",
    "",
    "## Coverage",
    "",
    `- Expected pair count: ${options.expectedPairs.length}`,
    `- Missing price symbols: ${options.missingSymbols.length === 0 ? "0" : options.missingSymbols.join(", ")}`,
    `- Default ADR symbols: ${options.defaultAdrSymbols.length === 0 ? "0" : options.defaultAdrSymbols.join(", ")}`,
    `- Path points: ${options.pathPoints.length}`,
    "",
    "## Basket Metrics",
    "",
    `- Total fills: ${options.trades.length}`,
    `- LONG fills: ${longTrades.length}; SHORT fills: ${shortTrades.length}`,
    `- TP closes: ${countReason(options.trades, "grid_tp")}`,
    `- Reset closes: ${countReason(options.trades, "grid_reset")}`,
    `- Week-close exits: ${countReason(options.trades, "week_close")}`,
    `- Combined raw return points: ${signed(sum(options.trades, "rawReturnPct"), 4, "%")}`,
    `- Combined ADR-normalized return: ${signed(sum(options.trades, "adrReturn"), 4)} ADR`,
    `- LONG ADR return: ${signed(sum(longTrades, "adrReturn"), 4)} ADR`,
    `- SHORT ADR return: ${signed(sum(shortTrades, "adrReturn"), 4)} ADR`,
    `- Combined ADR path peak/trough/final: ${signed(options.pathSummaryAdr.peak, 4)} / ${signed(options.pathSummaryAdr.trough, 4)} / ${signed(options.pathSummaryAdr.final, 4)}`,
    `- Combined ADR max drawdown: ${signed(options.pathSummaryAdr.maxDrawdown, 4)} at ${options.pathSummaryAdr.maxDrawdownTimeUtc ?? "-"}`,
    `- Combined raw path peak/trough/final: ${signed(options.pathSummaryRaw.peak, 4, "%")} / ${signed(options.pathSummaryRaw.trough, 4, "%")} / ${signed(options.pathSummaryRaw.final, 4, "%")}`,
    `- Combined raw max drawdown: ${signed(options.pathSummaryRaw.maxDrawdown, 4, "%")} at ${options.pathSummaryRaw.maxDrawdownTimeUtc ?? "-"}`,
    `- Max active fills: ${options.pathSummaryAdr.maxActiveFills}`,
    `- Max active ADR exposure: ${fixed(options.pathSummaryAdr.maxActiveAdrExposure, 2)} ADR-fill units`,
    "",
    "## Side Metrics",
    "",
    `- LONG ADR peak/trough/final/DD: ${signed(options.longSummaryAdr.peak, 4)} / ${signed(options.longSummaryAdr.trough, 4)} / ${signed(options.longSummaryAdr.final, 4)} / ${signed(options.longSummaryAdr.maxDrawdown, 4)}`,
    `- SHORT ADR peak/trough/final/DD: ${signed(options.shortSummaryAdr.peak, 4)} / ${signed(options.shortSummaryAdr.trough, 4)} / ${signed(options.shortSummaryAdr.final, 4)} / ${signed(options.shortSummaryAdr.maxDrawdown, 4)}`,
    "",
    "## Best Hedged Pairs By ADR",
    "",
    "| Pair | Fills | TP | Reset | Week Close | Long ADR | Short ADR | Hedged ADR | Max MAE ADR |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...bestPairs.map((row) =>
      `| ${row.symbol} | ${row.totalFills} | ${row.totalTp} | ${row.totalReset} | ${row.totalWeekClose} | ${signed(row.longAdr, 2)} | ${signed(row.shortAdr, 2)} | ${signed(row.hedgedAdr, 2)} | ${fixed(row.maxMaeAdr, 2)} |`),
    "",
    "## Worst Hedged Pairs By ADR",
    "",
    "| Pair | Fills | TP | Reset | Week Close | Long ADR | Short ADR | Hedged ADR | Max MAE ADR |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...worstPairs.map((row) =>
      `| ${row.symbol} | ${row.totalFills} | ${row.totalTp} | ${row.totalReset} | ${row.totalWeekClose} | ${signed(row.longAdr, 2)} | ${signed(row.shortAdr, 2)} | ${signed(row.hedgedAdr, 2)} | ${fixed(row.maxMaeAdr, 2)} |`),
    "",
    "## Files",
    "",
    `- JSON: ${options.jsonPath}`,
    `- Trades CSV: ${options.tradesCsvPath}`,
    `- Path CSV: ${options.pathCsvPath}`,
    "",
  ];
  return lines.join("\n");
}

async function main() {
  const weekArg = argValue("week") ?? previousDisplayWeekOpenUtc();
  const weekOpenUtc = normalizeWeekOpenUtc(weekArg) ?? weekArg;
  const outDir = path.resolve(
    process.cwd(),
    argValue("out-dir") ?? "app/reports/data-verification/fx-hedged-adr-grid",
  );
  const pathResolution = normalizePathResolution(argValue("path-resolution"));
  const expectedPairs = PAIRS_BY_ASSET_CLASS.fx.map((pair) => pair.pair.toUpperCase());
  const executionWindow = getExecutionWeekWindow(weekOpenUtc, "fx");
  const windowOpenUtc = executionWindow.windowOpenUtc.toUTC().toISO() ?? weekOpenUtc;
  const windowCloseUtc = executionWindow.windowCloseUtc.toUTC().toISO() ?? weekOpenUtc;
  const entryCutoffUtc = executionWindow.entryCutoffUtc.toUTC().toISO() ?? windowCloseUtc;
  const weekLabel = formatTradingWeekLabelIsoDate(weekOpenUtc);
  const grid = buildAdrGridTimestamps(windowOpenUtc, windowCloseUtc, pathResolution);

  const [weeklyReturns, adrMap] = await Promise.all([
    getCanonicalWeeklyPairReturns(weekOpenUtc),
    loadWeeklyAdrMap(weekOpenUtc),
  ]);
  const timelines = await loadPathBarTimelines(expectedPairs, windowOpenUtc, windowCloseUtc, grid, pathResolution);
  const returnMap = new Map(weeklyReturns.map((row) => [row.symbol.toUpperCase(), row]));
  const pairAdrBySymbol = new Map<string, number>();
  const missingSymbols: string[] = [];
  const defaultAdrSymbols: string[] = [];
  const engines: GridEngine[] = [];

  for (const symbol of expectedPairs) {
    const priceRow = returnMap.get(symbol);
    const timeline = timelines.get(symbol);
    const firstMark = timeline?.markBars.find((bar): bar is PathBarPoint => bar !== null);
    const openPrice = Number.isFinite(priceRow?.openPrice)
      ? priceRow!.openPrice
      : firstMark?.closePrice ?? null;
    const hasPathBars = Boolean(firstMark);
    if (!Number.isFinite(openPrice) || (openPrice ?? 0) <= 0 || !hasPathBars) {
      missingSymbols.push(symbol);
      continue;
    }
    if (!adrMap.has(symbol)) defaultAdrSymbols.push(symbol);
    const pairAdrPct = getAdrPct(adrMap, symbol, "fx");
    pairAdrBySymbol.set(symbol, pairAdrPct);
    for (const direction of ["LONG", "SHORT"] as const) {
      const base = {
        symbol,
        direction,
        openPrice: openPrice!,
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
        cycleHighPrice: openPrice!,
        cycleLowPrice: openPrice!,
        closedForWeek: false,
        entriesStoppedForWeek: false,
        entryCutoffGridIndex: -1,
        closeGridIndex: -1,
        realizedRawPct: 0,
        realizedAdrPct: 0,
        maxActiveFills: 0,
        maxActiveAdrExposure: 0,
      });
    }
  }

  const entryCutoffGridIndex = (() => {
    const cutoffMs = Date.parse(entryCutoffUtc);
    for (let index = grid.length - 1; index >= 0; index -= 1) {
      const ts = Date.parse(grid[index] ?? "");
      if (Number.isFinite(ts) && ts <= cutoffMs) return index;
    }
    return 0;
  })();
  const closeGridIndex = Math.max(0, grid.length - 1);
  for (const engine of engines) {
    engine.entryCutoffGridIndex = entryCutoffGridIndex;
    engine.closeGridIndex = closeGridIndex;
  }

  const trades: TradeRow[] = [];
  const pathPoints: PathPoint[] = [];

  for (let barIndex = 0; barIndex < grid.length; barIndex += 1) {
    const tsUtc = grid[barIndex] ?? windowOpenUtc;
    for (const engine of engines) {
      if (engine.closedForWeek || barIndex > engine.closeGridIndex) continue;
      const bar = timelines.get(engine.symbol)?.exactBars[barIndex] ?? null;
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
        const mark = timelines.get(engine.symbol)?.markBars[barIndex]?.closePrice ?? engine.openPrice;
        for (const fill of engine.fills) {
          if (!fill.active) continue;
          closeFill({ trades, engine, fill, exitPrice: mark, exitTimeUtc: tsUtc, exitReason: "week_close" });
        }
        engine.closedForWeek = true;
      }

      engine.maxActiveFills = Math.max(engine.maxActiveFills, activeFills(engine).length);
      engine.maxActiveAdrExposure = Math.max(engine.maxActiveAdrExposure, activeAdrExposure(engine));
    }

    let combinedRawPct = 0;
    let combinedAdr = 0;
    let listedLongRawPct = 0;
    let listedLongAdr = 0;
    let listedShortRawPct = 0;
    let listedShortAdr = 0;
    let activeFillCount = 0;
    let activeLongFills = 0;
    let activeShortFills = 0;
    let activeAdrExposureTotal = 0;
    for (const engine of engines) {
      const mark = timelines.get(engine.symbol)?.markBars[barIndex]?.closePrice ?? null;
      const marked = markEngine(engine, mark);
      combinedRawPct += marked.raw;
      combinedAdr += marked.adr;
      if (engine.direction === "LONG") {
        listedLongRawPct += marked.raw;
        listedLongAdr += marked.adr;
        activeLongFills += activeFills(engine).length;
      } else {
        listedShortRawPct += marked.raw;
        listedShortAdr += marked.adr;
        activeShortFills += activeFills(engine).length;
      }
      activeFillCount += activeFills(engine).length;
      activeAdrExposureTotal += activeAdrExposure(engine);
    }
    pathPoints.push({
      tsUtc,
      combinedRawPct: round(combinedRawPct, 6) ?? combinedRawPct,
      combinedAdr: round(combinedAdr, 6) ?? combinedAdr,
      listedLongRawPct: round(listedLongRawPct, 6) ?? listedLongRawPct,
      listedLongAdr: round(listedLongAdr, 6) ?? listedLongAdr,
      listedShortRawPct: round(listedShortRawPct, 6) ?? listedShortRawPct,
      listedShortAdr: round(listedShortAdr, 6) ?? listedShortAdr,
      activeFills: activeFillCount,
      activeLongFills,
      activeShortFills,
      activeAdrExposure: round(activeAdrExposureTotal, 6) ?? activeAdrExposureTotal,
    });
  }

  const pairSummaries = summarizePairs(trades, pairAdrBySymbol);
  const pathSummaryAdr = summarizePath(pathPoints, "combinedAdr");
  const pathSummaryRaw = summarizePath(pathPoints, "combinedRawPct");
  const longSummaryAdr = summarizePath(pathPoints, "listedLongAdr");
  const shortSummaryAdr = summarizePath(pathPoints, "listedShortAdr");
  const generatedAtUtc = DateTime.utc().toISO() ?? new Date().toISOString();
  const stamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
  const fileStem = `fx-28pair-hedged-adr-grid-${weekLabel}-${stamp}`;
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `${fileStem}.json`);
  const tradesCsvPath = path.join(outDir, `${fileStem}-trades.csv`);
  const pathCsvPath = path.join(outDir, `${fileStem}-path.csv`);
  const mdPath = path.join(outDir, `${fileStem}.md`);
  const receipt = {
    schemaVersion: 1,
    generatedAtUtc,
    scope: {
      gate: "Gate 36d fx-hedged-adr-grid-week",
      weekOpenUtc,
      weekLabel,
      expectedPairs,
      expectedPairCount: expectedPairs.length,
      directions: ["LONG", "SHORT"],
      executionWindowOpenUtc: windowOpenUtc,
      entryCutoffUtc,
      executionWindowCloseUtc: windowCloseUtc,
      grid: {
        pathResolution,
        spacingAdr: ADR_GRID_SPACING,
        resetAdr: ADR_GRID_RESET_ADR,
        entryResetBufferAdr: ADR_GRID_ENTRY_RESET_BUFFER_ADR,
        maxLevelsPerSide: ADR_GRID_MAX_LEVELS_PER_SIDE,
        pairFillCap: "off",
      },
      exclusions: ["cot", "sentiment", "strength", "pair_fill_cap", "spread", "commission", "swap", "slippage", "margin_rules"],
    },
    coverage: {
      missingSymbols,
      defaultAdrSymbols,
      pathPoints: pathPoints.length,
    },
    summaries: {
      combinedAdr: pathSummaryAdr,
      combinedRawPct: pathSummaryRaw,
      listedLongAdr: longSummaryAdr,
      listedShortAdr: shortSummaryAdr,
      fills: {
        total: trades.length,
        long: trades.filter((trade) => trade.direction === "LONG").length,
        short: trades.filter((trade) => trade.direction === "SHORT").length,
        tp: trades.filter((trade) => trade.exitReason === "grid_tp").length,
        reset: trades.filter((trade) => trade.exitReason === "grid_reset").length,
        weekClose: trades.filter((trade) => trade.exitReason === "week_close").length,
      },
    },
    pairSummaries,
    trades,
    path: pathPoints,
  };

  await writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await writeFile(tradesCsvPath, `${tradesToCsv(trades)}\n`, "utf8");
  await writeFile(pathCsvPath, `${pathToCsv(pathPoints)}\n`, "utf8");
  await writeFile(mdPath, buildMarkdown({
    generatedAtUtc,
    weekOpenUtc,
    weekLabel,
    expectedPairs,
    missingSymbols,
    defaultAdrSymbols,
    trades,
    pairSummaries,
    pathSummaryAdr,
    pathSummaryRaw,
    longSummaryAdr,
    shortSummaryAdr,
    pathPoints,
    jsonPath,
    tradesCsvPath,
    pathCsvPath,
    pathResolution,
  }), "utf8");

  console.log(`Hedged FX ADR Grid week: ${weekLabel}`);
  console.log(`Pairs: ${expectedPairs.length}, engines=${engines.length}, fills=${trades.length}`);
  console.log(`Combined ADR final/DD: ${signed(pathSummaryAdr.final, 4)} / ${signed(pathSummaryAdr.maxDrawdown, 4)}`);
  console.log(`TP/reset/week-close: ${receipt.summaries.fills.tp}/${receipt.summaries.fills.reset}/${receipt.summaries.fills.weekClose}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);
  await getPool().end();
}

main().catch(async (error) => {
  console.error(error);
  await getPool().end().catch(() => undefined);
  process.exit(1);
});
