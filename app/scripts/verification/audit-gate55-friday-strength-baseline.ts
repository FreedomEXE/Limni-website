import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

loadEnvConfig(process.cwd());

import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { getPool } from "@/lib/db";
import { getExecutionWeekWindow } from "@/lib/executionPriceWindows";
import { getAdrPct, loadWeeklyAdrMap } from "@/lib/performance/adrLookup";
import { buildPathBarTimelines, loadPathBars, type PathBarPoint } from "@/lib/performance/pathBarLoader";
import { clearRuntimeCacheAll } from "@/lib/runtimeCache";
import {
  buildFxStrengthHistoryIndex,
  buildFxWeeklyStrengthContextFromIndex,
  deriveFxStrengthHistoryAtTimesFromM1,
  FX_M1_STRENGTH_DERIVATION_VERSION,
  getFxWeeklyStrengthDecisionPoints,
  INSTITUTIONAL_M1_PAIR_COVERAGE_PCT,
  type FxWeeklyPairStrengthDecision,
  type HistoricalStrengthWindow,
} from "@/lib/strength/historicalStrength";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";

const GATE = "Gate 55G: canonical-friday-strength-selected-vs-fade-baseline";
const PRICE_BUNDLE_ID = "gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953";
const DEFAULT_FROM_WEEK = "2019-01-07T00:00:00.000Z";
const DEFAULT_TO_WEEK = "2026-06-08T00:00:00.000Z";
const DEFAULT_OUT_DIR = path.join("app", "reports", "data-verification", "gate55");
const DOC_OUT = "docs/research/GATE55G_CANONICAL_FRIDAY_STRENGTH_SELECTED_VS_FADE_BASELINE_2026-06-25.md";
const DEFAULT_WINDOWS: HistoricalStrengthWindow[] = ["1h", "4h", "24h", "1w", "1m"];
const FX_PAIRS = PAIRS_BY_ASSET_CLASS.fx.map((row) => row.pair.toUpperCase()).sort();

const ADR_GRID_SPACING = 0.20;
const ADR_GRID_RESET_ADR = 1.0;
const ADR_GRID_ENTRY_RESET_BUFFER_ADR = 0.20;
const ADR_GRID_MAX_LEVELS_PER_SIDE = 50;

type Direction = "LONG" | "SHORT";
type ExitReason = "grid_tp" | "grid_reset" | "week_close";
type SignalId = "selected" | "fade";

type CliOptions = {
  fromWeek: string;
  toWeek: string;
  windows: HistoricalStrengthWindow[];
  cadenceMinutes: number;
  fridayBackwardMinutes: number;
  minPairCoveragePct: number;
  batchWeeks: number;
  pathResolution: "1m" | "1h";
  outDir: string;
  noDocCopy: boolean;
};

type StrengthDecision = {
  weekOpenUtc: string;
  symbol: string;
  selectedSide: Direction;
  resolvedTimeUtc: string | null;
  requestedTimeUtc: string;
  compositeScore: number | null;
  availableWindows: number;
  signedSpreadSum: number | null;
  voteTie: boolean;
  exactSpreadTie: boolean;
};

type SourceWeekSummary = {
  weekOpenUtc: string;
  parentRows: number;
  retainedRows: number;
  removedRows: number;
  longRows: number;
  shortRows: number;
  voteTieRows: number;
  exactSpreadTieRows: number;
  minAvailableWindows: number;
  maxAvailableWindows: number;
  missingReasons: Record<string, number>;
};

type SourceBuild = {
  decisions: StrengthDecision[];
  weeks: SourceWeekSummary[];
  snapshotTimes: number;
  snapshotRows: number;
  completeSnapshotRows: number;
  incompleteSnapshotRows: number;
  minCoveragePct: number;
  maxCoveragePct: number;
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
  realizedAdr: number;
};

type TradeRow = {
  symbol: string;
  direction: Direction;
  exitReason: ExitReason;
  entryTimeUtc: string;
  exitTimeUtc: string;
  entryPrice: number;
  exitPrice: number;
  pairAdrPct: number;
  adrReturn: number;
  rawReturnPct: number;
  maeAdr: number;
};

type WeekScore = {
  weekOpenUtc: string;
  signalId: SignalId;
  decisionRows: number;
  gridAdr: number;
  gridFills: number;
  gridTp: number;
  gridReset: number;
  gridWeekClose: number;
  missingGridPriceRows: number;
  weeklyHoldAdr: number;
  missingHoldPriceRows: number;
  defaultAdrRows: number;
};

type MetricSummary = {
  denominatorWeeks: number;
  decisionRows: number;
  fullSignalWeeks: number;
  partialSignalWeeks: number;
  unavailableWeeks: number;
  totalAdr: number;
  maxDrawdownAdr: number;
  returnToDrawdown: number | null;
  profitFactorAdr: number | null;
  weeklyWinRateActive: number | null;
  worstYear: string | null;
  worstYearAdr: number | null;
};

type SignalSummary = {
  signalId: SignalId;
  label: string;
  directionRule: string;
  decisionRows: number;
  longRows: number;
  shortRows: number;
  adrGrid: MetricSummary & {
    fills: number;
    tp: number;
    reset: number;
    weekClose: number;
    missingPriceRows: number;
    defaultAdrRows: number;
  };
  simpleWeeklyHold: MetricSummary & {
    missingPriceRows: number;
    defaultAdrRows: number;
  };
};

function argValue(name: string): string | null {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function normalizeIso(value: string, label: string) {
  const normalized = normalizeWeekOpenUtc(value);
  if (normalized) return normalized;
  const parsed = DateTime.fromISO(value, { zone: "utc" });
  if (!parsed.isValid) throw new Error(`Invalid ${label}: ${value}`);
  return parsed.toUTC().toISO() ?? value;
}

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseNumber(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseWindow(value: string): HistoricalStrengthWindow {
  if (
    value === "15m" ||
    value === "30m" ||
    value === "1h" ||
    value === "4h" ||
    value === "24h" ||
    value === "1w" ||
    value === "1m"
  ) {
    return value;
  }
  throw new Error(`Unsupported strength window: ${value}`);
}

function parseWindows(value: string | null): HistoricalStrengthWindow[] {
  if (!value) return DEFAULT_WINDOWS;
  return [...new Set(value.split(",").map((item) => parseWindow(item.trim())).filter(Boolean))];
}

function parsePathResolution(value: string | null): "1m" | "1h" {
  const raw = (value ?? "1m").trim().toLowerCase();
  if (raw === "1m" || raw === "m1") return "1m";
  if (raw === "1h" || raw === "h1") return "1h";
  throw new Error(`Unsupported path resolution: ${value}`);
}

function parseCli(): CliOptions {
  return {
    fromWeek: normalizeIso(argValue("from-week") ?? DEFAULT_FROM_WEEK, "from-week"),
    toWeek: normalizeIso(argValue("to-week") ?? DEFAULT_TO_WEEK, "to-week"),
    windows: parseWindows(argValue("windows")),
    cadenceMinutes: parsePositiveInteger(argValue("cadence-minutes") ?? argValue("cadence"), 15),
    fridayBackwardMinutes: parsePositiveInteger(argValue("friday-backward-minutes"), 60),
    minPairCoveragePct: Math.max(
      0,
      Math.min(100, parseNumber(argValue("min-pair-coverage-pct"), INSTITUTIONAL_M1_PAIR_COVERAGE_PCT)),
    ),
    batchWeeks: parsePositiveInteger(argValue("batch-weeks"), 8),
    pathResolution: parsePathResolution(argValue("path-resolution")),
    outDir: argValue("out-dir") ?? DEFAULT_OUT_DIR,
    noDocCopy: hasFlag("no-doc-copy"),
  };
}

function assertCanonicalDbOnly() {
  const localMode = process.env.LIMNI_M1_WAREHOUSE?.trim();
  const localPath = process.env.LIMNI_M1_SQLITE_PATH?.trim();
  if (localMode || localPath) {
    throw new Error(
      [
        "Gate 55G must use canonical_price_bars, not local SQLite staging.",
        `Unset LIMNI_M1_WAREHOUSE and LIMNI_M1_SQLITE_PATH before running. mode=${localMode ?? "-"} path=${localPath ?? "-"}`,
      ].join(" "),
    );
  }
}

function generateWeeks(fromWeek: string, toWeek: string) {
  const from = DateTime.fromISO(fromWeek, { zone: "utc" });
  const to = DateTime.fromISO(toWeek, { zone: "utc" });
  if (!from.isValid || !to.isValid || to <= from) {
    throw new Error(`Invalid week range: from=${fromWeek} to=${toWeek}`);
  }
  const weeks: string[] = [];
  for (let cursor = from; cursor.toMillis() < to.toMillis(); cursor = cursor.plus({ weeks: 1 })) {
    const rawWeek = cursor.toUTC().toISO() ?? cursor.toJSDate().toISOString();
    weeks.push(normalizeWeekOpenUtc(rawWeek) ?? rawWeek);
  }
  return [...new Set(weeks)];
}

function chunkArray<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function round(value: number | null | undefined, places = 4) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function opposite(direction: Direction): Direction {
  return direction === "LONG" ? "SHORT" : "LONG";
}

function directionSign(direction: Direction) {
  return direction === "LONG" ? 1 : -1;
}

function countBy<T>(rows: T[], key: (row: T) => string | null | undefined) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const value = key(row);
    if (!value) continue;
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function yearOf(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("yyyy");
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

function fridaySnapshotTimes(weeks: string[], cadenceMinutes: number, backwardMinutes: number) {
  const times = new Set<string>();
  const cadence = Math.max(1, Math.floor(cadenceMinutes));
  const backward = Math.max(0, Math.floor(backwardMinutes));

  for (const weekOpenUtc of weeks) {
    const fridayPoint = getFxWeeklyStrengthDecisionPoints(weekOpenUtc)
      .find((point) => point.id === "friday_close");
    if (!fridayPoint) continue;
    const requested = DateTime.fromISO(fridayPoint.requestedTimeUtc, { zone: "utc" });
    if (!requested.isValid) continue;
    for (let offset = backward; offset >= 0; offset -= cadence) {
      times.add(requested.minus({ minutes: offset }).toUTC().toISO() ?? fridayPoint.requestedTimeUtc);
    }
    times.add(fridayPoint.requestedTimeUtc);
  }

  return [...times].sort();
}

function rowSpreadSum(row: FxWeeklyPairStrengthDecision) {
  const values = row.windows
    .map((window) => window.signedSpread)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null;
}

function toStrengthDecision(row: FxWeeklyPairStrengthDecision): StrengthDecision | null {
  if (!row.available || row.availableWindows !== row.windows.length) return null;
  if (row.direction !== "LONG" && row.direction !== "SHORT") return null;
  const signedSpreadSum = rowSpreadSum(row);
  const voteTie = row.compositeScore === 0;
  const exactSpreadTie = voteTie && signedSpreadSum !== null && Math.abs(signedSpreadSum) < 1e-12;
  return {
    weekOpenUtc: row.weekOpenUtc,
    symbol: row.pair.toUpperCase(),
    selectedSide: row.direction,
    resolvedTimeUtc: row.resolvedTimeUtc,
    requestedTimeUtc: row.requestedTimeUtc,
    compositeScore: row.compositeScore,
    availableWindows: row.availableWindows,
    signedSpreadSum,
    voteTie,
    exactSpreadTie,
  };
}

function summarizeSourceWeek(weekOpenUtc: string, rows: FxWeeklyPairStrengthDecision[]): SourceWeekSummary {
  const retained = rows.map(toStrengthDecision).filter((row): row is StrengthDecision => row !== null);
  const availableWindowCounts = rows.map((row) => row.availableWindows);
  return {
    weekOpenUtc,
    parentRows: rows.length,
    retainedRows: retained.length,
    removedRows: rows.length - retained.length,
    longRows: retained.filter((row) => row.selectedSide === "LONG").length,
    shortRows: retained.filter((row) => row.selectedSide === "SHORT").length,
    voteTieRows: retained.filter((row) => row.voteTie).length,
    exactSpreadTieRows: retained.filter((row) => row.exactSpreadTie).length,
    minAvailableWindows: availableWindowCounts.length > 0 ? Math.min(...availableWindowCounts) : 0,
    maxAvailableWindows: availableWindowCounts.length > 0 ? Math.max(...availableWindowCounts) : 0,
    missingReasons: countBy(rows, (row) => row.missingReason),
  };
}

async function buildFridayStrengthDecisions(options: CliOptions, weeks: string[]): Promise<SourceBuild> {
  const decisions: StrengthDecision[] = [];
  const weekSummaries: SourceWeekSummary[] = [];
  let snapshotTimes = 0;
  let snapshotRows = 0;
  let completeSnapshotRows = 0;
  let incompleteSnapshotRows = 0;
  let minCoveragePct = Number.POSITIVE_INFINITY;
  let maxCoveragePct = Number.NEGATIVE_INFINITY;

  const batches = chunkArray(weeks, options.batchWeeks);
  for (const [batchIndex, batchWeeks] of batches.entries()) {
    const batchStartedAt = Date.now();
    const times = fridaySnapshotTimes(batchWeeks, options.cadenceMinutes, options.fridayBackwardMinutes);
    const derived = await deriveFxStrengthHistoryAtTimesFromM1({
      snapshotTimesUtc: times,
      windows: options.windows,
      minPairCoveragePct: options.minPairCoveragePct,
    });
    const index = buildFxStrengthHistoryIndex(derived.snapshots);
    snapshotTimes += derived.summary.snapshotsGenerated;
    snapshotRows += derived.summary.rowsGenerated;
    completeSnapshotRows += derived.summary.completeRows;
    incompleteSnapshotRows += derived.summary.incompleteRows;
    minCoveragePct = Math.min(minCoveragePct, derived.summary.minCoveragePct);
    maxCoveragePct = Math.max(maxCoveragePct, derived.summary.maxCoveragePct);

    for (const weekOpenUtc of batchWeeks) {
      const context = buildFxWeeklyStrengthContextFromIndex({
        weekOpenUtc,
        index,
        pairs: FX_PAIRS,
        windows: options.windows,
      });
      const fridayRows = context.rows.filter((row) => row.pointId === "friday_close");
      weekSummaries.push(summarizeSourceWeek(weekOpenUtc, fridayRows));
      for (const row of fridayRows) {
        const decision = toStrengthDecision(row);
        if (decision) decisions.push(decision);
      }
    }

    console.log(
      [
        `strengthBatch=${batchIndex + 1}/${batches.length}`,
        `weeks=${batchWeeks[0]?.slice(0, 10)}..${batchWeeks.at(-1)?.slice(0, 10)}`,
        `snapshotTimes=${derived.summary.snapshotsGenerated}`,
        `rows=${derived.summary.rowsGenerated}`,
        `completeRows=${derived.summary.completeRows}`,
        `elapsed=${((Date.now() - batchStartedAt) / 1000).toFixed(2)}s`,
      ].join(" | "),
    );
  }

  return {
    decisions,
    weeks: weekSummaries,
    snapshotTimes,
    snapshotRows,
    completeSnapshotRows,
    incompleteSnapshotRows,
    minCoveragePct: Number.isFinite(minCoveragePct) ? minCoveragePct : 0,
    maxCoveragePct: Number.isFinite(maxCoveragePct) ? maxCoveragePct : 0,
  };
}

function buildAdrGridTimestamps(windowOpenUtc: string, windowCloseUtc: string, resolution: "1m" | "1h") {
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

function normalizeTimestamp(value: string) {
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

function markEngine(engine: GridEngine, markPrice: number | null) {
  let adr = engine.realizedAdr;
  if (markPrice && markPrice > 0) {
    for (const fill of engine.fills) {
      if (!fill.active) continue;
      adr += directedRawReturnPct(engine.direction, fill.entryPrice, markPrice) / engine.pairAdrPct;
    }
  }
  return adr;
}

function scoreAdrGridWeek(options: {
  decisions: StrengthDecision[];
  grid: string[];
  entryCutoffUtc: string;
  closeUtc: string;
  barsBySymbol: Awaited<ReturnType<typeof loadPathBars>>;
  adrMap: Awaited<ReturnType<typeof loadWeeklyAdrMap>>;
}) {
  const timelines = buildPathBarTimelines(FX_PAIRS, options.barsBySymbol, options.grid);
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
    const pairAdrPct = getAdrPct(options.adrMap, decision.symbol, "fx");
    const base = {
      symbol: decision.symbol,
      direction: decision.selectedSide,
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
    gridAdr: round(finalAdr, 6) ?? finalAdr,
    fills: trades.length,
    tp: trades.filter((trade) => trade.exitReason === "grid_tp").length,
    reset: trades.filter((trade) => trade.exitReason === "grid_reset").length,
    weekClose: trades.filter((trade) => trade.exitReason === "week_close").length,
    missingPriceRows,
    defaultAdrRows: defaultAdrSymbols.size,
  };
}

function scoreSimpleWeeklyHold(options: {
  decisions: StrengthDecision[];
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
    const pairAdrPct = getAdrPct(options.adrMap, decision.symbol, "fx");
    const raw = ((last.closePrice - first.openPrice) / first.openPrice) * 100 * directionSign(decision.selectedSide);
    totalAdr += raw / pairAdrPct;
  }

  return {
    weeklyHoldAdr: round(totalAdr, 6) ?? totalAdr,
    missingPriceRows,
    defaultAdrRows: defaultAdrSymbols.size,
  };
}

async function scoreWeek(options: {
  weekOpenUtc: string;
  selectedDecisions: StrengthDecision[];
  pathResolution: "1m" | "1h";
}) {
  const executionWindow = getExecutionWeekWindow(options.weekOpenUtc, "fx");
  const windowOpenUtc = executionWindow.windowOpenUtc.toUTC().toISO() ?? options.weekOpenUtc;
  const entryCutoffUtc = executionWindow.entryCutoffUtc.toUTC().toISO() ?? options.weekOpenUtc;
  const windowCloseUtc = executionWindow.windowCloseUtc.toUTC().toISO() ?? options.weekOpenUtc;
  const grid = buildAdrGridTimestamps(windowOpenUtc, windowCloseUtc, options.pathResolution);
  const [barsBySymbol, adrMap] = await Promise.all([
    loadPathBars(FX_PAIRS, windowOpenUtc, windowCloseUtc, options.pathResolution),
    loadWeeklyAdrMap(options.weekOpenUtc),
  ]);

  const fadeDecisions = options.selectedDecisions.map((decision) => ({
    ...decision,
    selectedSide: opposite(decision.selectedSide),
  }));

  const selectedGrid = scoreAdrGridWeek({
    decisions: options.selectedDecisions,
    grid,
    entryCutoffUtc,
    closeUtc: windowCloseUtc,
    barsBySymbol,
    adrMap,
  });
  const selectedHold = scoreSimpleWeeklyHold({
    decisions: options.selectedDecisions,
    barsBySymbol,
    adrMap,
  });
  const fadeGrid = scoreAdrGridWeek({
    decisions: fadeDecisions,
    grid,
    entryCutoffUtc,
    closeUtc: windowCloseUtc,
    barsBySymbol,
    adrMap,
  });
  const fadeHold = scoreSimpleWeeklyHold({
    decisions: fadeDecisions,
    barsBySymbol,
    adrMap,
  });

  return [
    {
      weekOpenUtc: options.weekOpenUtc,
      signalId: "selected" as const,
      decisionRows: options.selectedDecisions.length,
      gridAdr: selectedGrid.gridAdr,
      gridFills: selectedGrid.fills,
      gridTp: selectedGrid.tp,
      gridReset: selectedGrid.reset,
      gridWeekClose: selectedGrid.weekClose,
      missingGridPriceRows: selectedGrid.missingPriceRows,
      weeklyHoldAdr: selectedHold.weeklyHoldAdr,
      missingHoldPriceRows: selectedHold.missingPriceRows,
      defaultAdrRows: Math.max(selectedGrid.defaultAdrRows, selectedHold.defaultAdrRows),
    },
    {
      weekOpenUtc: options.weekOpenUtc,
      signalId: "fade" as const,
      decisionRows: fadeDecisions.length,
      gridAdr: fadeGrid.gridAdr,
      gridFills: fadeGrid.fills,
      gridTp: fadeGrid.tp,
      gridReset: fadeGrid.reset,
      gridWeekClose: fadeGrid.weekClose,
      missingGridPriceRows: fadeGrid.missingPriceRows,
      weeklyHoldAdr: fadeHold.weeklyHoldAdr,
      missingHoldPriceRows: fadeHold.missingPriceRows,
      defaultAdrRows: Math.max(fadeGrid.defaultAdrRows, fadeHold.defaultAdrRows),
    },
  ] satisfies WeekScore[];
}

function summarizeMetric(weeks: string[], decisions: StrengthDecision[], values: Map<string, number>, missingRows: number): MetricSummary {
  const decisionCounts = new Map<string, number>();
  for (const decision of decisions) {
    decisionCounts.set(decision.weekOpenUtc, (decisionCounts.get(decision.weekOpenUtc) ?? 0) + 1);
  }

  const weeklyValues = weeks.map((week) => round(values.get(week) ?? 0, 6) ?? 0);
  const totalAdr = weeklyValues.reduce((sum, value) => sum + value, 0);
  const positiveAdr = weeklyValues.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const negativeAdr = weeklyValues.filter((value) => value < 0).reduce((sum, value) => sum + value, 0);
  const activeValues = weeklyValues.filter((value) => value !== 0);
  const drawdown = maxDrawdown(weeklyValues);

  const yearAdr = new Map<string, number>();
  for (const [index, week] of weeks.entries()) {
    yearAdr.set(yearOf(week), (yearAdr.get(yearOf(week)) ?? 0) + (weeklyValues[index] ?? 0));
  }
  const worstYear = [...yearAdr.entries()].sort((left, right) => left[1] - right[1])[0] ?? null;

  return {
    denominatorWeeks: weeks.length,
    decisionRows: decisions.length,
    fullSignalWeeks: weeks.filter((week) => decisionCounts.get(week) === FX_PAIRS.length).length,
    partialSignalWeeks: weeks.filter((week) => {
      const count = decisionCounts.get(week) ?? 0;
      return count > 0 && count < FX_PAIRS.length;
    }).length,
    unavailableWeeks: weeks.filter((week) => !decisionCounts.has(week)).length,
    totalAdr: round(totalAdr) ?? 0,
    maxDrawdownAdr: round(drawdown) ?? 0,
    returnToDrawdown: drawdown < 0 ? round(totalAdr / Math.abs(drawdown)) : null,
    profitFactorAdr: negativeAdr < 0 ? round(positiveAdr / Math.abs(negativeAdr)) : null,
    weeklyWinRateActive: activeValues.length > 0
      ? round(activeValues.filter((value) => value > 0).length / activeValues.length)
      : null,
    worstYear: worstYear?.[0] ?? null,
    worstYearAdr: worstYear ? round(worstYear[1]) : null,
  };
}

function summarizeSignals(weeks: string[], decisions: StrengthDecision[], weekScores: WeekScore[]): SignalSummary[] {
  return (["selected", "fade"] as const).map((signalId) => {
    const rows = weekScores.filter((row) => row.signalId === signalId);
    const signalDecisions = signalId === "selected"
      ? decisions
      : decisions.map((decision) => ({ ...decision, selectedSide: opposite(decision.selectedSide) }));
    const gridValues = new Map(rows.map((row) => [row.weekOpenUtc, row.gridAdr]));
    const holdValues = new Map(rows.map((row) => [row.weekOpenUtc, row.weeklyHoldAdr]));
    const gridMissing = rows.reduce((sum, row) => sum + row.missingGridPriceRows, 0);
    const holdMissing = rows.reduce((sum, row) => sum + row.missingHoldPriceRows, 0);
    const defaultAdrRows = rows.reduce((sum, row) => sum + row.defaultAdrRows, 0);
    return {
      signalId,
      label: signalId === "selected" ? "Friday Strength selected" : "Friday Strength fade",
      directionRule: signalId === "selected"
        ? "Use canonical M1-derived Friday Strength direction."
        : "Use the opposite of canonical M1-derived Friday Strength direction.",
      decisionRows: signalDecisions.length,
      longRows: signalDecisions.filter((row) => row.selectedSide === "LONG").length,
      shortRows: signalDecisions.filter((row) => row.selectedSide === "SHORT").length,
      adrGrid: {
        ...summarizeMetric(weeks, signalDecisions, gridValues, gridMissing),
        fills: rows.reduce((sum, row) => sum + row.gridFills, 0),
        tp: rows.reduce((sum, row) => sum + row.gridTp, 0),
        reset: rows.reduce((sum, row) => sum + row.gridReset, 0),
        weekClose: rows.reduce((sum, row) => sum + row.gridWeekClose, 0),
        missingPriceRows: gridMissing,
        defaultAdrRows,
      },
      simpleWeeklyHold: {
        ...summarizeMetric(weeks, signalDecisions, holdValues, holdMissing),
        missingPriceRows: holdMissing,
        defaultAdrRows,
      },
    };
  });
}

async function scoreAllWeeks(options: CliOptions, weeks: string[], decisions: StrengthDecision[]) {
  const byWeek = new Map<string, StrengthDecision[]>();
  for (const decision of decisions) {
    const rows = byWeek.get(decision.weekOpenUtc) ?? [];
    rows.push(decision);
    byWeek.set(decision.weekOpenUtc, rows);
  }

  const scores: WeekScore[] = [];
  for (const [index, weekOpenUtc] of weeks.entries()) {
    const weekStartedAt = Date.now();
    const selectedDecisions = byWeek.get(weekOpenUtc) ?? [];
    scores.push(...await scoreWeek({
      weekOpenUtc,
      selectedDecisions,
      pathResolution: options.pathResolution,
    }));
    clearRuntimeCacheAll();
    console.log(
      [
        `scoreWeek=${index + 1}/${weeks.length}`,
        `week=${weekOpenUtc.slice(0, 10)}`,
        `rows=${selectedDecisions.length}`,
        `elapsed=${((Date.now() - weekStartedAt) / 1000).toFixed(2)}s`,
      ].join(" | "),
    );
  }
  return scores;
}

function renderNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : String(value);
}

function renderMetricRows(signals: SignalSummary[]) {
  return signals.map((signal) =>
    `| ${signal.signalId} | ${signal.decisionRows} | ${signal.longRows} | ${signal.shortRows} | ${signal.adrGrid.fullSignalWeeks} | ${signal.adrGrid.partialSignalWeeks} | ${signal.adrGrid.totalAdr.toFixed(4)} | ${signal.adrGrid.maxDrawdownAdr.toFixed(4)} | ${renderNumber(signal.adrGrid.returnToDrawdown)} | ${renderNumber(signal.adrGrid.profitFactorAdr)} | ${signal.adrGrid.fills} | ${signal.adrGrid.missingPriceRows} | ${signal.simpleWeeklyHold.totalAdr.toFixed(4)} | ${signal.simpleWeeklyHold.maxDrawdownAdr.toFixed(4)} | ${renderNumber(signal.simpleWeeklyHold.returnToDrawdown)} | ${renderNumber(signal.simpleWeeklyHold.profitFactorAdr)} | ${signal.simpleWeeklyHold.missingPriceRows} |`,
  );
}

function renderMarkdown(receipt: {
  status: string;
  generatedAtUtc: string;
  receiptHash: string;
  options: CliOptions;
  identity: Record<string, unknown>;
  source: Record<string, unknown>;
  coverage: Record<string, unknown>;
  signals: SignalSummary[];
  weekScores: WeekScore[];
  nonFullSourceWeeks: SourceWeekSummary[];
  files: { json: string; markdown: string; docsCopy: string | null };
}) {
  const bestGrid = [...receipt.signals].sort((left, right) => right.adrGrid.totalAdr - left.adrGrid.totalAdr)[0];
  const bestHold = [...receipt.signals].sort((left, right) => right.simpleWeeklyHold.totalAdr - left.simpleWeeklyHold.totalAdr)[0];
  const lines = [
    "# Gate 55G Canonical Friday Strength Selected Vs Fade Baseline",
    "",
    `Generated: ${receipt.generatedAtUtc}`,
    "",
    "## Result",
    "",
    `- Status: ${receipt.status}`,
    `- Gate: ${GATE}`,
    `- Price bundle ID: \`${PRICE_BUNDLE_ID}\``,
    `- Strength derivation: \`${FX_M1_STRENGTH_DERIVATION_VERSION}\``,
    `- ADR/hold path resolution: \`${receipt.options.pathResolution}\``,
    "- Source mutation by this script: false",
    "- Local SQLite staging source allowed: false",
    "- COT+Strength combination: false",
    "- Regime/risk/live/final-combined-system work: false",
    "",
    "## Read",
    "",
    `- Better ADR Grid side: ${bestGrid?.signalId ?? "-"}`,
    `- Better simple weekly hold side: ${bestHold?.signalId ?? "-"}`,
    "",
    "## Source Coverage",
    "",
    `- Weeks: ${receipt.coverage.weeks}`,
    `- Expected parent rows: ${receipt.coverage.expectedParentRows}`,
    `- Retained selected rows: ${receipt.coverage.retainedRows}`,
    `- Removed rows: ${receipt.coverage.removedRows}`,
    `- Full source weeks: ${receipt.coverage.fullSourceWeeks}`,
    `- Partial source weeks: ${receipt.coverage.partialSourceWeeks}`,
    `- Long rows: ${receipt.coverage.longRows}`,
    `- Short rows: ${receipt.coverage.shortRows}`,
    `- Composite vote-tie rows: ${receipt.coverage.voteTieRows}`,
    `- Exact spread-tie rows: ${receipt.coverage.exactSpreadTieRows}`,
    `- Snapshot times: ${receipt.source.snapshotTimes}`,
    `- Snapshot rows: ${receipt.source.snapshotRows}`,
    `- Complete snapshot rows: ${receipt.source.completeSnapshotRows}`,
    `- Incomplete snapshot rows: ${receipt.source.incompleteSnapshotRows}`,
    `- Source coverage range: ${receipt.source.minCoveragePct}% to ${receipt.source.maxCoveragePct}%`,
    "",
    "## Metrics",
    "",
    "| Signal | Rows | Long | Short | ADR full weeks | ADR partial weeks | ADR Grid ADR | ADR Grid DD | ADR Grid R/DD | ADR Grid PF | Grid fills | Missing grid price rows | Weekly Hold ADR | Weekly Hold DD | Weekly Hold R/DD | Weekly Hold PF | Missing hold price rows |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...renderMetricRows(receipt.signals),
    "",
    "## Non-Full Source Weeks",
    "",
    receipt.nonFullSourceWeeks.length === 0
      ? "None."
      : "| Week | Parent rows | Retained | Removed | Missing reasons |",
    ...(receipt.nonFullSourceWeeks.length === 0
      ? []
      : [
          "|---|---:|---:|---:|---|",
          ...receipt.nonFullSourceWeeks.map((row) =>
            `| ${row.weekOpenUtc.slice(0, 10)} | ${row.parentRows} | ${row.retainedRows} | ${row.removedRows} | ${Object.entries(row.missingReasons).map(([key, count]) => `${key}:${count}`).join("; ") || "-"} |`),
        ]),
    "",
    "## Commands",
    "",
    `- ${receipt.identity.command}`,
    "",
    "## Decision Boundary",
    "",
    "This receipt chooses only the Friday Strength selected-vs-fade baseline direction candidate for Gate 55 review. It does not combine Strength with COT, add regimes, optimize execution, add risk overlays, select a final combined system, or promote live/MT5 work.",
    "",
    "If both selected and fade fail on the accepted evidence standard, Strength should move to a redesign/enrichment gate rather than being scrapped.",
    "",
    "## Files",
    "",
    `- JSON: ${receipt.files.json}`,
    `- Markdown: ${receipt.files.markdown}`,
    `- Docs copy: ${receipt.files.docsCopy ?? "-"}`,
    "",
    `Receipt hash: \`${receipt.receiptHash}\``,
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  assertCanonicalDbOnly();
  const options = parseCli();
  const weeks = generateWeeks(options.fromWeek, options.toWeek);
  const startedAt = Date.now();
  await mkdir(options.outDir, { recursive: true });

  const source = await buildFridayStrengthDecisions(options, weeks);
  const weekScores = await scoreAllWeeks(options, weeks, source.decisions);
  const signals = summarizeSignals(weeks, source.decisions, weekScores);

  const retainedRows = source.decisions.length;
  const expectedParentRows = weeks.length * FX_PAIRS.length;
  const fullSourceWeeks = source.weeks.filter((row) => row.retainedRows === FX_PAIRS.length).length;
  const nonFullSourceWeeks = source.weeks.filter((row) => row.retainedRows !== FX_PAIRS.length);
  const selected = signals.find((signal) => signal.signalId === "selected");
  const fade = signals.find((signal) => signal.signalId === "fade");
  const noMissingPerformanceRows = signals.every((signal) =>
    signal.adrGrid.missingPriceRows === 0 && signal.simpleWeeklyHold.missingPriceRows === 0);
  const fullCoverage = retainedRows === expectedParentRows && nonFullSourceWeeks.length === 0;
  const status = fullCoverage && noMissingPerformanceRows && options.pathResolution === "1m"
    ? "PASS_CANONICAL_FRIDAY_STRENGTH_SELECTED_VS_FADE_READY_FOR_BASELINE_LOCK_REVIEW"
    : "PASS_WITH_CAVEATS_CANONICAL_FRIDAY_STRENGTH_SELECTED_VS_FADE_REVIEW_REQUIRED";

  const receiptBase = {
    status,
    gate: GATE,
    generatedAtUtc: new Date().toISOString(),
    identity: {
      priceBundleId: PRICE_BUNDLE_ID,
      priceBundleReceipt: "docs/research/GATE55E_FROZEN_CANONICAL_PRICE_BUNDLE_V1_RECEIPT_2026-06-24.md",
      strengthSourceContextReceipt: "docs/research/GATE55F_CANONICAL_STRENGTH_SOURCE_CONTEXT_PROOF_2026-06-25.md",
      derivationVersion: FX_M1_STRENGTH_DERIVATION_VERSION,
      sourceTable: "canonical_price_bars",
      sourceTimeframe: "1m",
      executionPathResolution: options.pathResolution,
      command: process.argv.join(" "),
    },
    options,
    source: {
      snapshotTimes: source.snapshotTimes,
      snapshotRows: source.snapshotRows,
      completeSnapshotRows: source.completeSnapshotRows,
      incompleteSnapshotRows: source.incompleteSnapshotRows,
      minCoveragePct: round(source.minCoveragePct, 4),
      maxCoveragePct: round(source.maxCoveragePct, 4),
    },
    coverage: {
      weeks: weeks.length,
      pairs: FX_PAIRS.length,
      expectedParentRows,
      retainedRows,
      removedRows: expectedParentRows - retainedRows,
      fullSourceWeeks,
      partialSourceWeeks: nonFullSourceWeeks.length,
      longRows: source.decisions.filter((row) => row.selectedSide === "LONG").length,
      shortRows: source.decisions.filter((row) => row.selectedSide === "SHORT").length,
      voteTieRows: source.decisions.filter((row) => row.voteTie).length,
      exactSpreadTieRows: source.decisions.filter((row) => row.exactSpreadTie).length,
    },
    comparison: {
      adrGridLeader: selected && fade
        ? selected.adrGrid.totalAdr >= fade.adrGrid.totalAdr ? "selected" : "fade"
        : null,
      simpleWeeklyHoldLeader: selected && fade
        ? selected.simpleWeeklyHold.totalAdr >= fade.simpleWeeklyHold.totalAdr ? "selected" : "fade"
        : null,
      selectedMinusFadeAdrGrid: selected && fade
        ? round(selected.adrGrid.totalAdr - fade.adrGrid.totalAdr)
        : null,
      selectedMinusFadeWeeklyHold: selected && fade
        ? round(selected.simpleWeeklyHold.totalAdr - fade.simpleWeeklyHold.totalAdr)
        : null,
    },
    signals,
    weekScores,
    nonFullSourceWeeks,
    hardLocks: {
      noCotStrengthCombination: true,
      noRegimeFilters: true,
      noBprRrpRetests: true,
      noPppNeerReer: true,
      noExecutionOptimization: true,
      noRiskOverlay: true,
      noMt5LiveBot: true,
      noFinalCombinedSystemSelection: true,
    },
    elapsedSeconds: round((Date.now() - startedAt) / 1000, 2),
  };

  const receiptHash = sha256(JSON.stringify(receiptBase));
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const jsonPath = path.join(options.outDir, `gate55g-friday-strength-selected-vs-fade-${stamp}.json`);
  const mdPath = path.join(options.outDir, `gate55g-friday-strength-selected-vs-fade-${stamp}.md`);
  const receipt = {
    ...receiptBase,
    receiptHash,
    files: {
      json: jsonPath,
      markdown: mdPath,
      docsCopy: options.noDocCopy ? null : DOC_OUT,
    },
  };
  const markdown = renderMarkdown(receipt);

  await writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await writeFile(mdPath, markdown, "utf8");
  if (!options.noDocCopy) {
    await mkdir(path.dirname(DOC_OUT), { recursive: true });
    await writeFile(DOC_OUT, markdown, "utf8");
  }

  console.log(`Gate 55G status: ${status}`);
  console.log(`Source rows: ${retainedRows}/${expectedParentRows}`);
  for (const signal of signals) {
    console.log(
      [
        `signal=${signal.signalId}`,
        `adrGrid=${signal.adrGrid.totalAdr}`,
        `gridDD=${signal.adrGrid.maxDrawdownAdr}`,
        `gridPF=${signal.adrGrid.profitFactorAdr}`,
        `weeklyHold=${signal.simpleWeeklyHold.totalAdr}`,
        `holdDD=${signal.simpleWeeklyHold.maxDrawdownAdr}`,
        `holdPF=${signal.simpleWeeklyHold.profitFactorAdr}`,
      ].join(" | "),
    );
  }
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);
  console.log(`Receipt hash: ${receiptHash}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // Pool may not have been created.
    }
    if (process.exitCode && process.exitCode !== 0) {
      process.exit(process.exitCode);
    }
  });
