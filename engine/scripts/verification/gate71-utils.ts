import { mkdir } from "node:fs/promises";
import path from "node:path";

import { query } from "@database/db/client";
import { DateTime } from "luxon";

import { getExecutionWeekWindow } from "@engine/evaluation/executionPriceWindows";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap, type AdrMap } from "@engine/price/adrLookup";
import { localM1WarehouseExists, openLocalM1Warehouse } from "@engine/price/localM1Warehouse";
import {
  RESEARCH_DECISION_EVALUATOR_PARAMS,
  RESEARCH_DECISION_EVALUATOR_VERSION,
  RESEARCH_DECISION_PATH_CONTRACT_ID,
  loadResearchDecisionWeekScoringContext,
  scoreResearchDecisionPairPathOutcome,
  type ResearchDecisionPathResolution,
} from "@engine/research/decisionManifestEvaluator";
import { sha256Stable } from "@engine/research/hash";

import { countBy, readJson, readJsonl, round } from "./gate65-utils";
import {
  DEFAULT_GATE69B_DIR,
  LOCKED_DEFAULT_CANDIDATE_ID,
  LOCKED_FINAL_ALGORITHM_ID,
  SHADOW_CANARY_CANDIDATE_ID,
} from "./gate70-utils";

export const GATE71_DATE = "2026-06-28";
export const GATE71_SCOPE = "Gate 71: candidate-b-exit-testing-definition";

export const DEFAULT_GATE71A_DIR = "docs/research/gates/gate71a/artifacts/gate71a-exit-testing-protocol-freeze";
export const DEFAULT_GATE71B_DIR = "docs/research/gates/gate71b/artifacts/gate71b-basket-adr-path-diagnostics";
export const DEFAULT_GATE71C_DIR = "docs/research/gates/gate71c/artifacts/gate71c-exit-baseline-matrix";
export const DEFAULT_GATE71D_DIR = "docs/research/gates/gate71d/artifacts/gate71d-review-packet-no-drift";

export const GATE71_PRICE_BUNDLE_ID = "gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953";
export const GATE71_PATH_RESOLUTION: ResearchDecisionPathResolution = "1m";
export const GATE71_ASSET_CLASS = "fx";
export const GATE71_EXPECTED_ROWS = 10_444;
export const GATE71_EXPECTED_WEEKS = 373;
export const GATE71_EXPECTED_SYMBOLS_PER_WEEK = 28;
export const DEFAULT_CANDIDATE_B_LEDGER_PATH = path.join(
  DEFAULT_GATE69B_DIR,
  "final-forced28-decision-ledger.rows.jsonl",
);

export const POSITIVE_THRESHOLDS_ADR = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export const ADVERSE_THRESHOLDS_ADR = [-0.5, -1, -1.5, -2, -3] as const;

export type CandidateBDecisionRow = {
  row_key: string;
  locked_algorithm_id: string;
  default_candidate_id: string;
  shadow_candidate_id: string;
  week_open_utc: string;
  year: number;
  symbol: string;
  final_direction: "BASE_CURRENCY" | "QUOTE_CURRENCY";
  final_side: "LONG" | "SHORT";
  decision_hash: string;
};

export type Gate71aSummary = {
  verdict: string;
  protocol: {
    clean_entry_exposure_model_id: string;
    legacy_adr_grid_role: string;
    path_resolution: ResearchDecisionPathResolution;
    adr_target_pct: number;
  };
  validation: {
    candidate_b_hash_locked: boolean;
    candidate_c_shadow_only: boolean;
    adr_normalization_confirmed: boolean;
    legacy_adr_grid_coupled: boolean;
    clean_basket_path_required: boolean;
    exit_matrix_execution_started: boolean;
  };
};

export type BasketPathPoint = {
  timestamp_utc: string;
  total_adr: number;
};

export type BasketPathDiagnosticRow = {
  schema_version: 1;
  gate_id: string;
  week_open_utc: string;
  year: number;
  candidate_id: typeof LOCKED_DEFAULT_CANDIDATE_ID;
  locked_algorithm_id: typeof LOCKED_FINAL_ALGORITHM_ID;
  decision_rows: number;
  long_rows: number;
  short_rows: number;
  entry_timestamp_utc: string;
  friday_cutoff_timestamp_utc: string;
  path_resolution: ResearchDecisionPathResolution;
  price_bundle_id: typeof GATE71_PRICE_BUNDLE_ID;
  entry_exposure_model_id: string;
  adr_target_pct: number;
  m1_path_point_count: number;
  mfe_adr: number;
  mfe_timestamp_utc: string | null;
  mae_adr: number;
  mae_timestamp_utc: string | null;
  friday_close_adr: number;
  peak_to_friday_giveback_adr: number;
  first_positive_hits: Record<string, string | null>;
  first_adverse_hits: Record<string, string | null>;
  profit_before_drawdown: boolean | null;
  drawdown_before_profit: boolean | null;
  missing_price_symbols: string[];
  default_adr_symbols: string[];
  candidate_b_ledger_hash: string;
  content_hash: string;
};

export type BuiltBasketPath = {
  diagnostic: BasketPathDiagnosticRow;
  points: BasketPathPoint[];
  legacyAdrGridControl: {
    adr: number;
    fills: number;
    tp: number;
    reset: number;
    week_close: number;
    missing_price_rows: number;
    default_adr_rows: number;
  };
};

type DailyAdrSourceRow = {
  symbol: string;
  bar_open_utc: Date | string;
  high_price: number | string;
  low_price: number | string;
  open_price: number | string;
};

type LocalM1CloseRow = {
  symbol: string;
  bar_close_utc: string;
  open_price: number;
  close_price: number;
};

let gate71LocalM1Db: ReturnType<typeof openLocalM1Warehouse> | null = null;

export type ExitMatrixRule =
  | { id: string; family: "control"; control: "weekly_hold" | "legacy_adr_grid" | "pair_silo_1adr_unavailable" }
  | { id: string; family: "global_close_all_stop_week"; target_adr: number }
  | { id: string; family: "global_target_plus_adverse_stop"; target_adr: number; adverse_stop_adr: number }
  | { id: string; family: "basket_profit_floor_trailing"; activation_adr: number; floor_adr: number }
  | { id: string; family: "trail_plus_hard_tp"; activation_adr: number; floor_adr: number; hard_tp_adr: number };

export const GATE71_EXIT_MATRIX: ExitMatrixRule[] = [
  { id: "CONTROL_WEEKLY_HOLD", family: "control", control: "weekly_hold" },
  { id: "CONTROL_LEGACY_ADR_GRID", family: "control", control: "legacy_adr_grid" },
  { id: "CONTROL_PAIR_SILO_1ADR_UNAVAILABLE", family: "control", control: "pair_silo_1adr_unavailable" },
  ...POSITIVE_THRESHOLDS_ADR.map((target) => ({
    id: `GLOBAL_TP_${formatRuleNumber(target)}_STOP_WEEK`,
    family: "global_close_all_stop_week" as const,
    target_adr: target,
  })),
  ...[0.5, 0.75, 1, 1.25].flatMap((target) =>
    [-1, -1.5, -2].map((stop) => ({
      id: `GLOBAL_TP_${formatRuleNumber(target)}_STOP_${formatRuleNumber(Math.abs(stop))}`,
      family: "global_target_plus_adverse_stop" as const,
      target_adr: target,
      adverse_stop_adr: stop,
    })),
  ),
  ...[
    [0.5, 0.1],
    [0.5, 0.25],
    [0.75, 0.25],
    [0.75, 0.5],
    [1, 0.25],
    [1, 0.5],
    [1.25, 0.5],
    [1.5, 0.75],
  ].map(([activation, floor]) => ({
    id: `TRAIL_A${formatRuleNumber(activation)}_F${formatRuleNumber(floor)}`,
    family: "basket_profit_floor_trailing" as const,
    activation_adr: activation,
    floor_adr: floor,
  })),
  ...[
    [0.5, 0.25, 1],
    [0.75, 0.25, 1.25],
    [0.75, 0.5, 1.5],
    [1, 0.5, 2],
  ].map(([activation, floor, hardTp]) => ({
    id: `TRAIL_TP_A${formatRuleNumber(activation)}_F${formatRuleNumber(floor)}_T${formatRuleNumber(hardTp)}`,
    family: "trail_plus_hard_tp" as const,
    activation_adr: activation,
    floor_adr: floor,
    hard_tp_adr: hardTp,
  })),
];

export function formatRuleNumber(value: number) {
  return String(Math.round(value * 100)).padStart(3, "0");
}

export async function loadGate71aSummary(dir = DEFAULT_GATE71A_DIR) {
  return readJson<Gate71aSummary>(path.join(dir, "gate71a-summary.json"));
}

export async function loadCandidateBRows(ledgerPath = DEFAULT_CANDIDATE_B_LEDGER_PATH) {
  const rows = await readJsonl<CandidateBDecisionRow>(ledgerPath);
  return rows.sort((left, right) => {
    const week = left.week_open_utc.localeCompare(right.week_open_utc);
    if (week !== 0) return week;
    return left.symbol.localeCompare(right.symbol);
  });
}

export async function preloadGate71AdrMaps(options: {
  weeks: string[];
  symbols: string[];
}) {
  const weeks = Array.from(new Set(options.weeks.map((week) => new Date(week).toISOString()))).sort();
  const symbols = Array.from(new Set(options.symbols.map((symbol) => symbol.toUpperCase()))).sort();
  if (weeks.length === 0 || symbols.length === 0) return new Map<string, AdrMap>();
  const fromUtc = DateTime.fromISO(weeks[0]!, { zone: "utc" }).minus({ days: 20 }).toUTC().toISO();
  const toUtc = weeks.at(-1)!;
  const rows = await query<DailyAdrSourceRow>(
    `SELECT symbol, bar_open_utc, high_price, low_price, open_price
       FROM canonical_price_bars
      WHERE timeframe = '1d'
        AND symbol = ANY($1::text[])
        AND bar_open_utc < $2::timestamptz
        AND bar_open_utc >= $3::timestamptz
      ORDER BY symbol ASC, bar_open_utc DESC`,
    [symbols, toUtc, fromUtc],
  );
  const bySymbol = new Map<string, Array<{ openMs: number; high: number; low: number; open: number }>>();
  for (const row of rows) {
    const symbol = row.symbol.toUpperCase();
    bySymbol.set(symbol, [
      ...(bySymbol.get(symbol) ?? []),
      {
        openMs: new Date(row.bar_open_utc).getTime(),
        high: Number(row.high_price),
        low: Number(row.low_price),
        open: Number(row.open_price),
      },
    ]);
  }
  const maps = new Map<string, AdrMap>();
  for (const week of weeks) {
    const weekMs = Date.parse(week);
    const minMs = DateTime.fromISO(week, { zone: "utc" }).minus({ days: 20 }).toMillis();
    const map: AdrMap = new Map();
    for (const symbol of symbols) {
      const valid = (bySymbol.get(symbol) ?? [])
        .filter((bar) => bar.openMs < weekMs && bar.openMs >= minMs && Number.isFinite(bar.high) && Number.isFinite(bar.low) && bar.open > 0)
        .sort((left, right) => right.openMs - left.openMs)
        .slice(0, 10);
      if (valid.length >= 5) {
        const adrPct = valid.map((bar) => ((bar.high - bar.low) / bar.open) * 100).reduce((sum, value) => sum + value, 0) / valid.length;
        map.set(symbol, adrPct);
      }
    }
    maps.set(week, map);
  }
  return maps;
}

export function validateCandidateBRows(rows: CandidateBDecisionRow[]) {
  const rowsByWeek = countBy(rows, (row) => row.week_open_utc);
  const duplicateCount = Object.values(countBy(rows, (row) => `${row.week_open_utc}|${row.symbol}`)).filter((count) => count > 1).length;
  const weeks = Object.keys(rowsByWeek).sort();
  return {
    rows: rows.length,
    weeks: weeks.length,
    expected_rows: GATE71_EXPECTED_ROWS,
    expected_weeks: GATE71_EXPECTED_WEEKS,
    expected_symbols_per_week: GATE71_EXPECTED_SYMBOLS_PER_WEEK,
    full_weeks: Object.values(rowsByWeek).filter((count) => count === GATE71_EXPECTED_SYMBOLS_PER_WEEK).length,
    duplicate_week_symbol_rows: duplicateCount,
    long_rows: rows.filter((row) => row.final_side === "LONG").length,
    short_rows: rows.filter((row) => row.final_side === "SHORT").length,
    forced28_preserved:
      rows.length === GATE71_EXPECTED_ROWS &&
      weeks.length === GATE71_EXPECTED_WEEKS &&
      Object.values(rowsByWeek).every((count) => count === GATE71_EXPECTED_SYMBOLS_PER_WEEK) &&
      duplicateCount === 0 &&
      rows.every((row) => row.locked_algorithm_id === LOCKED_FINAL_ALGORITHM_ID) &&
      rows.every((row) => row.default_candidate_id === LOCKED_DEFAULT_CANDIDATE_ID) &&
      rows.every((row) => row.shadow_candidate_id === SHADOW_CANARY_CANDIDATE_ID),
  };
}

export function groupCandidateBRowsByWeek(rows: CandidateBDecisionRow[]) {
  const map = new Map<string, CandidateBDecisionRow[]>();
  for (const row of rows) {
    map.set(row.week_open_utc, [...(map.get(row.week_open_utc) ?? []), row]);
  }
  return [...map.entries()].sort(([left], [right]) => left.localeCompare(right));
}

export function directionSign(side: "LONG" | "SHORT") {
  return side === "LONG" ? 1 : -1;
}

function thresholdKey(value: number) {
  return value > 0 ? `plus_${formatRuleNumber(value)}` : `minus_${formatRuleNumber(Math.abs(value))}`;
}

function firstHit(points: BasketPathPoint[], predicate: (value: number) => boolean) {
  return points.find((point) => predicate(point.total_adr))?.timestamp_utc ?? null;
}

function buildGate71Timestamps(windowOpenUtc: string, windowCloseUtc: string, resolution: ResearchDecisionPathResolution) {
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

function getGate71LocalM1Db() {
  gate71LocalM1Db ??= openLocalM1Warehouse({ readonly: true });
  return gate71LocalM1Db;
}

function readLocalM1CloseRows(options: {
  symbols: string[];
  fromUtc: string;
  toUtc: string;
}) {
  const normalizedSymbols = Array.from(new Set(options.symbols.map((symbol) => symbol.toUpperCase()))).sort();
  if (!localM1WarehouseExists() || normalizedSymbols.length === 0) return null;
  const placeholders = normalizedSymbols.map(() => "?").join(",");
  return getGate71LocalM1Db().prepare(`
    SELECT symbol, bar_close_utc, open_price, close_price
      FROM canonical_m1_bars
     WHERE symbol IN (${placeholders})
       AND asset_class = 'fx'
       AND timeframe = '1m'
       AND bar_open_utc >= ?
       AND bar_open_utc < ?
     ORDER BY symbol ASC, bar_open_utc ASC
  `).all(...normalizedSymbols, options.fromUtc, options.toUtc) as LocalM1CloseRow[];
}

function buildDiagnosticFromPoints(options: {
  weekOpenUtc: string;
  rows: CandidateBDecisionRow[];
  points: BasketPathPoint[];
  entryTimestampUtc: string;
  fridayCutoffTimestampUtc: string;
  candidateBLedgerHash: string;
  entryExposureModelId: string;
  missingPriceSymbols: string[];
  defaultAdrSymbols: string[];
}) {
  const points = options.points.length > 0 ? options.points : [{ timestamp_utc: options.fridayCutoffTimestampUtc, total_adr: 0 }];
  const mfePoint = points.reduce((best, point) => (point.total_adr > best.total_adr ? point : best), points[0]!);
  const maePoint = points.reduce((best, point) => (point.total_adr < best.total_adr ? point : best), points[0]!);
  const firstPositiveHits = Object.fromEntries(POSITIVE_THRESHOLDS_ADR.map((threshold) => [thresholdKey(threshold), firstHit(points, (value) => value >= threshold)]));
  const firstAdverseHits = Object.fromEntries(ADVERSE_THRESHOLDS_ADR.map((threshold) => [thresholdKey(threshold), firstHit(points, (value) => value <= threshold)]));
  const firstProfit = firstPositiveHits.plus_025;
  const firstDrawdown = firstAdverseHits.minus_050;
  const profitBeforeDrawdown = firstProfit && firstDrawdown ? firstProfit < firstDrawdown : firstProfit ? true : firstDrawdown ? false : null;
  const fridayCloseAdr = points.at(-1)?.total_adr ?? 0;
  const diagnosticBase = {
    schema_version: 1 as const,
    gate_id: "Gate 71B: basket-adr-path-diagnostics",
    week_open_utc: options.weekOpenUtc,
    year: new Date(options.weekOpenUtc).getUTCFullYear(),
    candidate_id: LOCKED_DEFAULT_CANDIDATE_ID,
    locked_algorithm_id: LOCKED_FINAL_ALGORITHM_ID,
    decision_rows: options.rows.length,
    long_rows: options.rows.filter((row) => row.final_side === "LONG").length,
    short_rows: options.rows.filter((row) => row.final_side === "SHORT").length,
    entry_timestamp_utc: options.entryTimestampUtc,
    friday_cutoff_timestamp_utc: options.fridayCutoffTimestampUtc,
    path_resolution: GATE71_PATH_RESOLUTION,
    price_bundle_id: GATE71_PRICE_BUNDLE_ID,
    entry_exposure_model_id: options.entryExposureModelId,
    adr_target_pct: getTargetAdrPct(),
    m1_path_point_count: points.length,
    mfe_adr: round(mfePoint.total_adr, 6) ?? 0,
    mfe_timestamp_utc: mfePoint.timestamp_utc,
    mae_adr: round(maePoint.total_adr, 6) ?? 0,
    mae_timestamp_utc: maePoint.timestamp_utc,
    friday_close_adr: round(fridayCloseAdr, 6) ?? 0,
    peak_to_friday_giveback_adr: round(Math.max(0, mfePoint.total_adr - fridayCloseAdr), 6) ?? 0,
    first_positive_hits: firstPositiveHits,
    first_adverse_hits: firstAdverseHits,
    profit_before_drawdown: profitBeforeDrawdown,
    drawdown_before_profit: profitBeforeDrawdown === null ? null : !profitBeforeDrawdown,
    missing_price_symbols: options.missingPriceSymbols,
    default_adr_symbols: options.defaultAdrSymbols,
    candidate_b_ledger_hash: options.candidateBLedgerHash,
  };
  return {
    ...diagnosticBase,
    content_hash: sha256Stable(diagnosticBase),
  };
}

async function buildCandidateBWeeklyBasketPathFromLocalM1(options: {
  weekOpenUtc: string;
  rows: CandidateBDecisionRow[];
  candidateBLedgerHash: string;
  entryExposureModelId: string;
  includePoints?: boolean;
  adrMap?: AdrMap;
}): Promise<BuiltBasketPath | null> {
  if (!localM1WarehouseExists()) return null;
  const executionWindow = getExecutionWeekWindow(options.weekOpenUtc, GATE71_ASSET_CLASS);
  const windowOpenUtc = executionWindow.windowOpenUtc.toUTC().toISO() ?? options.weekOpenUtc;
  const windowCloseUtc = executionWindow.windowCloseUtc.toUTC().toISO() ?? options.weekOpenUtc;
  const grid = buildGate71Timestamps(windowOpenUtc, windowCloseUtc, GATE71_PATH_RESOLUTION);
  const rawRows = readLocalM1CloseRows({
    symbols: options.rows.map((row) => row.symbol),
    fromUtc: windowOpenUtc,
    toUtc: windowCloseUtc,
  });
  if (!rawRows) return null;
  const rowsBySymbol = new Map<string, Array<LocalM1CloseRow & { closeMs: number }>>();
  for (const row of rawRows) {
    const symbol = row.symbol.toUpperCase();
    rowsBySymbol.set(symbol, [
      ...(rowsBySymbol.get(symbol) ?? []),
      {
        ...row,
        closeMs: Date.parse(row.bar_close_utc),
      },
    ]);
  }
  const adrMap = options.adrMap ?? await loadWeeklyAdrMap(options.weekOpenUtc, GATE71_PRICE_BUNDLE_ID);
  const pairInputs = options.rows.map((row) => {
    const symbol = row.symbol.toUpperCase();
    const series = (rowsBySymbol.get(symbol) ?? []).sort((left, right) => left.closeMs - right.closeMs);
    return {
      row,
      symbol,
      sign: directionSign(row.final_side),
      entryPrice: series[0]?.open_price ?? null,
      pairAdrPct: getAdrPct(adrMap, symbol, GATE71_ASSET_CLASS),
      defaultAdr: !adrMap.has(symbol),
      series,
      cursor: 0,
      markPrice: null as number | null,
      missingPrice: series.length === 0,
    };
  });
  const missingPriceSymbols = pairInputs.filter((input) => input.missingPrice).map((input) => input.symbol).sort();
  const defaultAdrSymbols = pairInputs.filter((input) => input.defaultAdr).map((input) => input.symbol).sort();
  const points: BasketPathPoint[] = [];
  const timestampMs = grid.map((timestamp) => Date.parse(timestamp));
  for (let index = 0; index < grid.length; index += 1) {
    const tsMs = timestampMs[index] ?? Number.NaN;
    let total = 0;
    for (const input of pairInputs) {
      while (input.cursor < input.series.length && (input.series[input.cursor]?.closeMs ?? Number.POSITIVE_INFINITY) <= tsMs) {
        input.markPrice = input.series[input.cursor]?.close_price ?? input.markPrice;
        input.cursor += 1;
      }
      if (input.entryPrice === null || input.entryPrice <= 0 || input.markPrice === null || input.markPrice <= 0) continue;
      const rawPct = ((input.markPrice - input.entryPrice) / input.entryPrice) * 100 * input.sign;
      total += rawPct / input.pairAdrPct;
    }
    points.push({
      timestamp_utc: grid[index] ?? windowCloseUtc,
      total_adr: round(total, 6) ?? total,
    });
  }
  const diagnostic = buildDiagnosticFromPoints({
    weekOpenUtc: options.weekOpenUtc,
    rows: options.rows,
    points,
    entryTimestampUtc: grid[0] ?? windowOpenUtc,
    fridayCutoffTimestampUtc: windowCloseUtc,
    candidateBLedgerHash: options.candidateBLedgerHash,
    entryExposureModelId: options.entryExposureModelId,
    missingPriceSymbols,
    defaultAdrSymbols,
  });
  return {
    diagnostic,
    points: options.includePoints === false ? [] : points,
    legacyAdrGridControl: emptyLegacyAdrGridControl(),
  };
}

function emptyLegacyAdrGridControl() {
  return {
    adr: 0,
    fills: 0,
    tp: 0,
    reset: 0,
    week_close: 0,
    missing_price_rows: 0,
    default_adr_rows: 0,
  };
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : sorted[mid] ?? 0;
}

export function maxDrawdown(values: number[]) {
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

export async function buildCandidateBWeeklyBasketPath(options: {
  weekOpenUtc: string;
  rows: CandidateBDecisionRow[];
  candidateBLedgerHash: string;
  entryExposureModelId: string;
  includePoints?: boolean;
  includeLegacyAdrGridControl?: boolean;
  adrMap?: AdrMap;
}): Promise<BuiltBasketPath> {
  if (options.includeLegacyAdrGridControl !== true) {
    const local = await buildCandidateBWeeklyBasketPathFromLocalM1(options);
    if (local) return local;
  }
  const symbols = options.rows.map((row) => row.symbol);
  const context = await loadResearchDecisionWeekScoringContext({
    assetClass: GATE71_ASSET_CLASS,
    priceBundleId: GATE71_PRICE_BUNDLE_ID,
    weekOpenUtc: options.weekOpenUtc,
    symbols,
    pathResolution: GATE71_PATH_RESOLUTION,
  });
  const pairInputs = options.rows.map((row) => {
    const symbol = row.symbol.toUpperCase();
    const bars = context.barsBySymbol.get(symbol) ?? [];
    const first = bars.find((bar) => Number.isFinite(bar.openPrice) && bar.openPrice > 0);
    const pairAdrPct = getAdrPct(context.adrMap, symbol, GATE71_ASSET_CLASS);
    return {
      row,
      symbol,
      side: row.final_side,
      sign: directionSign(row.final_side),
      entryPrice: first?.openPrice ?? null,
      pairAdrPct,
      defaultAdr: !context.adrMap.has(symbol),
      timeline: context.timelineBySymbol.get(symbol) ?? null,
      missingPrice: !first || !context.timelineBySymbol.get(symbol)?.exactBars.some((bar) => bar !== null),
    };
  });
  const missingPriceSymbols = pairInputs.filter((input) => input.missingPrice).map((input) => input.symbol).sort();
  const defaultAdrSymbols = pairInputs.filter((input) => input.defaultAdr).map((input) => input.symbol).sort();

  const points: BasketPathPoint[] = [];
  let lastTotal = 0;
  for (let index = 0; index < context.grid.length; index += 1) {
    let total = 0;
    for (const input of pairInputs) {
      if (input.entryPrice === null || input.entryPrice <= 0) continue;
      const mark = input.timeline?.markPrices[index] ?? null;
      if (mark === null || !Number.isFinite(mark) || mark <= 0) continue;
      const rawPct = ((mark - input.entryPrice) / input.entryPrice) * 100 * input.sign;
      total += rawPct / input.pairAdrPct;
    }
    lastTotal = total;
    points.push({
      timestamp_utc: context.grid[index] ?? context.windowCloseUtc,
      total_adr: round(total, 6) ?? total,
    });
  }

  if (points.length === 0) {
    points.push({ timestamp_utc: context.windowCloseUtc, total_adr: 0 });
  }
  const mfePoint = points.reduce((best, point) => (point.total_adr > best.total_adr ? point : best), points[0]!);
  const maePoint = points.reduce((best, point) => (point.total_adr < best.total_adr ? point : best), points[0]!);
  const firstPositiveHits = Object.fromEntries(POSITIVE_THRESHOLDS_ADR.map((threshold) => [thresholdKey(threshold), firstHit(points, (value) => value >= threshold)]));
  const firstAdverseHits = Object.fromEntries(ADVERSE_THRESHOLDS_ADR.map((threshold) => [thresholdKey(threshold), firstHit(points, (value) => value <= threshold)]));
  const firstProfit = firstPositiveHits.plus_025;
  const firstDrawdown = firstAdverseHits.minus_050;
  const profitBeforeDrawdown = firstProfit && firstDrawdown ? firstProfit < firstDrawdown : firstProfit ? true : firstDrawdown ? false : null;
  const fridayCloseAdr = points.at(-1)?.total_adr ?? round(lastTotal, 6) ?? 0;
  const diagnosticBase = {
    schema_version: 1 as const,
    gate_id: "Gate 71B: basket-adr-path-diagnostics",
    week_open_utc: options.weekOpenUtc,
    year: new Date(options.weekOpenUtc).getUTCFullYear(),
    candidate_id: LOCKED_DEFAULT_CANDIDATE_ID,
    locked_algorithm_id: LOCKED_FINAL_ALGORITHM_ID,
    decision_rows: options.rows.length,
    long_rows: options.rows.filter((row) => row.final_side === "LONG").length,
    short_rows: options.rows.filter((row) => row.final_side === "SHORT").length,
    entry_timestamp_utc: context.grid[0] ?? context.windowCloseUtc,
    friday_cutoff_timestamp_utc: context.windowCloseUtc,
    path_resolution: GATE71_PATH_RESOLUTION,
    price_bundle_id: GATE71_PRICE_BUNDLE_ID,
    entry_exposure_model_id: options.entryExposureModelId,
    adr_target_pct: getTargetAdrPct(),
    m1_path_point_count: points.length,
    mfe_adr: round(mfePoint.total_adr, 6) ?? 0,
    mfe_timestamp_utc: mfePoint.timestamp_utc,
    mae_adr: round(maePoint.total_adr, 6) ?? 0,
    mae_timestamp_utc: maePoint.timestamp_utc,
    friday_close_adr: round(fridayCloseAdr, 6) ?? 0,
    peak_to_friday_giveback_adr: round(Math.max(0, mfePoint.total_adr - fridayCloseAdr), 6) ?? 0,
    first_positive_hits: firstPositiveHits,
    first_adverse_hits: firstAdverseHits,
    profit_before_drawdown: profitBeforeDrawdown,
    drawdown_before_profit: profitBeforeDrawdown === null ? null : !profitBeforeDrawdown,
    missing_price_symbols: missingPriceSymbols,
    default_adr_symbols: defaultAdrSymbols,
    candidate_b_ledger_hash: options.candidateBLedgerHash,
  };
  const diagnostic = {
    ...diagnosticBase,
    content_hash: sha256Stable(diagnosticBase),
  };

  const legacyAdrGridOutcomes = options.includeLegacyAdrGridControl === false
    ? []
    : options.rows.map((row) =>
        scoreResearchDecisionPairPathOutcome({
          assetClass: GATE71_ASSET_CLASS,
          weekOpenUtc: options.weekOpenUtc,
          symbol: row.symbol,
          direction: row.final_side,
          context,
        }).adr_grid,
      );
  const legacyAdrGridControl = {
    adr: round(legacyAdrGridOutcomes.reduce((sum, outcome) => sum + outcome.adr, 0), 6) ?? 0,
    fills: legacyAdrGridOutcomes.reduce((sum, outcome) => sum + outcome.fills, 0),
    tp: legacyAdrGridOutcomes.reduce((sum, outcome) => sum + outcome.tp, 0),
    reset: legacyAdrGridOutcomes.reduce((sum, outcome) => sum + outcome.reset, 0),
    week_close: legacyAdrGridOutcomes.reduce((sum, outcome) => sum + outcome.week_close, 0),
    missing_price_rows: legacyAdrGridOutcomes.reduce((sum, outcome) => sum + outcome.missing_price_rows, 0),
    default_adr_rows: legacyAdrGridOutcomes.reduce((sum, outcome) => sum + outcome.default_adr_rows, 0),
  };

  return {
    diagnostic,
    points: options.includePoints === false ? [] : points,
    legacyAdrGridControl,
  };
}

export async function loadLegacyAdrGridControlsByWeek(options: {
  rows: CandidateBDecisionRow[];
  warehouseManifestId?: string;
}) {
  const warehouseManifestId = options.warehouseManifestId ?? "gate57a0b_pair_week_path_outcomes_47B8F40AFB3B";
  const weeks = Array.from(new Set(options.rows.map((row) => row.week_open_utc))).sort();
  const symbols = Array.from(new Set(options.rows.map((row) => row.symbol.toUpperCase()))).sort();
  const outcomeRows = await query<{
    week_open_utc: Date | string;
    symbol: string;
    direction: "LONG" | "SHORT";
    adr_grid_adr: number | string;
    adr_grid_fills: number | string;
    adr_grid_tp: number | string;
    adr_grid_reset: number | string;
    adr_grid_week_close: number | string;
    adr_grid_missing_price_rows: number | string;
    adr_grid_default_adr_rows: number | string;
  }>(
    `SELECT week_open_utc, symbol, direction, adr_grid_adr, adr_grid_fills,
            adr_grid_tp, adr_grid_reset, adr_grid_week_close,
            adr_grid_missing_price_rows, adr_grid_default_adr_rows
       FROM research_pair_week_path_outcomes
      WHERE manifest_id = $1
        AND week_open_utc = ANY($2::timestamptz[])
        AND symbol = ANY($3::text[])
      ORDER BY week_open_utc ASC, symbol ASC, direction ASC`,
    [warehouseManifestId, weeks, symbols],
  );
  const outcomesByKey = new Map(outcomeRows.map((row) => [
    `${new Date(row.week_open_utc).toISOString()}|${row.symbol.toUpperCase()}|${row.direction}`,
    row,
  ]));
  const controls = new Map<string, BuiltBasketPath["legacyAdrGridControl"]>();
  for (const [weekOpenUtc, weekRows] of groupCandidateBRowsByWeek(options.rows)) {
    const selected = weekRows.map((row) => outcomesByKey.get(`${row.week_open_utc}|${row.symbol.toUpperCase()}|${row.final_side}`)).filter((row): row is NonNullable<typeof row> => Boolean(row));
    controls.set(weekOpenUtc, {
      adr: round(selected.reduce((sum, row) => sum + Number(row.adr_grid_adr), 0), 6) ?? 0,
      fills: selected.reduce((sum, row) => sum + Number(row.adr_grid_fills), 0),
      tp: selected.reduce((sum, row) => sum + Number(row.adr_grid_tp), 0),
      reset: selected.reduce((sum, row) => sum + Number(row.adr_grid_reset), 0),
      week_close: selected.reduce((sum, row) => sum + Number(row.adr_grid_week_close), 0),
      missing_price_rows: selected.reduce((sum, row) => sum + Number(row.adr_grid_missing_price_rows), 0) + (weekRows.length - selected.length),
      default_adr_rows: selected.reduce((sum, row) => sum + Number(row.adr_grid_default_adr_rows), 0),
    });
  }
  return {
    warehouse_manifest_id: warehouseManifestId,
    controls,
    selected_outcome_rows: Array.from(controls.values()).length,
    missing_week_count: [...controls.values()].filter((row) => row.missing_price_rows > 0).length,
  };
}

export function evaluateExitRule(rule: ExitMatrixRule, path: BuiltBasketPath) {
  if (rule.family === "control") {
    if (rule.control === "weekly_hold") {
      return {
        exit_adr: path.diagnostic.friday_close_adr,
        exit_timestamp_utc: path.diagnostic.friday_cutoff_timestamp_utc,
        exit_reason: "weekly_hold_friday_close",
        closed_before_friday: false,
        stopped_out: false,
        available: true,
      };
    }
    if (rule.control === "legacy_adr_grid") {
      return {
        exit_adr: path.legacyAdrGridControl.adr,
        exit_timestamp_utc: path.diagnostic.friday_cutoff_timestamp_utc,
        exit_reason: "legacy_adr_grid_coupled_entry_exit_control",
        closed_before_friday: false,
        stopped_out: path.legacyAdrGridControl.reset > 0,
        available: true,
      };
    }
    return {
      exit_adr: 0,
      exit_timestamp_utc: null,
      exit_reason: "pair_silo_1adr_control_unavailable_in_engine",
      closed_before_friday: false,
      stopped_out: false,
      available: false,
    };
  }

  let active = false;
  for (const point of path.points) {
    if (rule.family === "global_close_all_stop_week" && point.total_adr >= rule.target_adr) {
      return exitAt(point, "global_target_hit", false);
    }
    if (rule.family === "global_target_plus_adverse_stop") {
      if (point.total_adr >= rule.target_adr) return exitAt(point, "global_target_hit", false);
      if (point.total_adr <= rule.adverse_stop_adr) return exitAt(point, "global_adverse_stop_hit", true);
    }
    if (rule.family === "basket_profit_floor_trailing") {
      if (!active && point.total_adr >= rule.activation_adr) active = true;
      if (active && point.total_adr <= rule.floor_adr) return exitAt(point, "profit_floor_trail_hit", false);
    }
    if (rule.family === "trail_plus_hard_tp") {
      if (point.total_adr >= rule.hard_tp_adr) return exitAt(point, "hard_target_hit", false);
      if (!active && point.total_adr >= rule.activation_adr) active = true;
      if (active && point.total_adr <= rule.floor_adr) return exitAt(point, "profit_floor_trail_hit", false);
    }
  }
  return {
    exit_adr: path.diagnostic.friday_close_adr,
    exit_timestamp_utc: path.diagnostic.friday_cutoff_timestamp_utc,
    exit_reason: "friday_close_no_rule_hit",
    closed_before_friday: false,
    stopped_out: false,
    available: true,
  };
}

function exitAt(point: BasketPathPoint, reason: string, stoppedOut: boolean) {
  return {
    exit_adr: round(point.total_adr, 6) ?? 0,
    exit_timestamp_utc: point.timestamp_utc,
    exit_reason: reason,
    closed_before_friday: true,
    stopped_out: stoppedOut,
    available: true,
  };
}

export function summarizeExitResults(rows: Array<{ rule_id: string; week_open_utc: string; year: number; exit_adr: number; closed_before_friday: boolean; stopped_out: boolean; available: boolean }>) {
  const availableRows = rows.filter((row) => row.available);
  const values = availableRows.map((row) => row.exit_adr);
  const wins = values.filter((value) => value > 0);
  const losses = values.filter((value) => value < 0);
  const totalAdr = values.reduce((sum, value) => sum + value, 0);
  const worstRows = [...availableRows].sort((left, right) => left.exit_adr - right.exit_adr).slice(0, 5);
  const byYear = new Map<number, typeof availableRows>();
  for (const row of availableRows) byYear.set(row.year, [...(byYear.get(row.year) ?? []), row]);
  const annual = [...byYear.entries()]
    .sort(([left], [right]) => left - right)
    .map(([year, yearRows]) => {
      const yearValues = yearRows.map((row) => row.exit_adr);
      return {
        year,
        weeks: yearRows.length,
        total_adr: round(yearValues.reduce((sum, value) => sum + value, 0), 6) ?? 0,
        profitable_week_rate: round(yearValues.filter((value) => value > 0).length / Math.max(1, yearValues.length), 6) ?? 0,
        worst_week_adr: round(Math.min(...yearValues), 6) ?? 0,
      };
    });
  const positiveAdr = wins.reduce((sum, value) => sum + value, 0);
  const negativeAdr = losses.reduce((sum, value) => sum + value, 0);
  return {
    weeks: availableRows.length,
    unavailable_weeks: rows.length - availableRows.length,
    total_adr: round(totalAdr, 6) ?? 0,
    average_adr_per_week: round(totalAdr / Math.max(1, availableRows.length), 6) ?? 0,
    median_adr_per_week: round(median(values), 6) ?? 0,
    profitable_weeks: wins.length,
    losing_weeks: losses.length,
    flat_weeks: values.filter((value) => value === 0).length,
    profitable_week_rate: round(wins.length / Math.max(1, availableRows.length), 6) ?? 0,
    worst_week_adr: round(Math.min(...values), 6) ?? 0,
    worst_5_week_adr_sum: round(worstRows.reduce((sum, row) => sum + row.exit_adr, 0), 6) ?? 0,
    max_drawdown_adr: round(maxDrawdown(values), 6) ?? 0,
    return_to_drawdown: maxDrawdown(values) < 0 ? round(totalAdr / Math.abs(maxDrawdown(values)), 6) : null,
    profit_factor_adr: negativeAdr < 0 ? round(positiveAdr / Math.abs(negativeAdr), 6) : null,
    average_winning_week_adr: round(positiveAdr / Math.max(1, wins.length), 6) ?? 0,
    average_losing_week_adr: round(negativeAdr / Math.max(1, losses.length), 6) ?? 0,
    closed_before_friday_rate: round(availableRows.filter((row) => row.closed_before_friday).length / Math.max(1, availableRows.length), 6) ?? 0,
    stopped_out_rate: round(availableRows.filter((row) => row.stopped_out).length / Math.max(1, availableRows.length), 6) ?? 0,
    negative_years: annual.filter((row) => row.total_adr < 0).length,
    worst_5_weeks: worstRows.map((row) => ({
      week_open_utc: row.week_open_utc,
      year: row.year,
      exit_adr: round(row.exit_adr, 6) ?? 0,
    })),
    annual,
  };
}

export async function ensureDir(dir: string) {
  await mkdir(path.resolve(dir), { recursive: true });
}
