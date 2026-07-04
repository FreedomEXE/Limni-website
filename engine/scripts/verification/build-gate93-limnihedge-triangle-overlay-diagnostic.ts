import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { sha256Stable } from "@engine/research/hash";

import {
  gitCommit,
  parseArgMap,
  profitFactor,
  renderTable,
  round,
  toRepoRelative,
  writeJson,
  writeShaManifest,
  writeText,
} from "./gate65-utils";

const GATE_ID = "Gate 93: limnihedge-triangle-overlay-diagnostic";
const GATE_DATE = "2026-07-04";
const COMMAND = "npm run engine:gate93:limnihedge-triangle-overlay";
const DEFAULT_GATE92_DIR = "docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate93/artifacts/limnihedge-triangle-overlay-diagnostic";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate93/GATE93_LIMNIHEDGE_TRIANGLE_OVERLAY_DIAGNOSTIC_${GATE_DATE}.md`;

const TRIANGLE_PATH_EFFICIENCY_LOW_MAX = 0.35;
const TRIANGLE_FORMULAIC_COST_FLOOR_ADR = 0.05;
const TRIANGLE_FORMULAIC_MIN_RANGE_TO_Q = 2;
const TRIANGLE_FORMULAIC_V2_COST_MULTIPLE = 4;
const TRIANGLE_FORMULAIC_V2_ROUND_TRIP_COST_FALLBACK_ADR = TRIANGLE_FORMULAIC_COST_FLOOR_ADR / TRIANGLE_FORMULAIC_V2_COST_MULTIPLE;
const TRIANGLE_FORMULAIC_V2_MIN_GEOMETRY_QUALITY = 1;
const TRIANGLE_FORMULAIC_V2_1_FLOOR_PIN_MIN_RATIO = 1.25;
const TRIANGLE_FORMULAIC_V2_1_SURPLUS_COST_MULTIPLE = 2;
const TRIANGLE_FORMULAIC_V2_1_MIN_SURPLUS_GEOMETRY_QUALITY = 1;
const TRIANGLE_FORMULAIC_SIGNAL_BRICK_DIVISOR = 4;
const STANDARD_FX_CONTRACT_UNITS = 100_000;

type Side = "BUY" | "SELL";
type Scope = "primary" | "secondary" | "discovered";
type VariantId =
  | "baseline_all_limnihedge_v1"
  | "h1_triangle_center_reversion_side"
  | "h1_triangle_v1_directionless"
  | "h1_triangle_v2_geometry"
  | "h1_triangle_v21_floorpin"
  | "h1_triangle_v21_surplus";

type Options = {
  gate92Dir: string;
  artifactDir: string;
  reportPath: string;
  lookbackHours: number;
  adrLookbackDays: number;
};

type PnlExitSourceRow = {
  case_id: string;
  scope: Scope;
  normalized_symbol: string;
  sequence_index: number;
  entry_time: string;
  side: Side;
  lot_size: number;
  replica_exit_time: string;
  mt5_exit_time: string | null;
  replica_exit_reason: "sl" | "end_of_test";
  mt5_exit_reason: "sl" | "end_of_test" | null;
  entry_price: number;
  replica_exit_price: number;
  mt5_exit_price: number | null;
  conversion_symbol: string | null;
  conversion_rate: number | null;
  mt5_price_profit: number | null;
  mt5_commission: number | null;
  mt5_swap: number | null;
  mt5_net_profit: number | null;
  replica_net_profit_with_observed_swap: number | null;
};

type EntryShapeSourceRow = {
  case_id: string;
  entry_time: string;
  side: Side;
  lot_size: number;
  order_type: "TYPE1" | "TYPE3";
};

type SummarySourceRow = {
  case_id: string;
  scope: Scope;
  normalized_symbol: string;
  headline_total_net_profit: number;
  headline_profit_factor: number | null;
  terminal_liquidation_deals: number;
  entry_deals: number;
};

type CoverageSourceRow = {
  case_id: string;
  symbol: string;
  source_path: string | null;
};

type Bar = {
  symbol: string;
  bar_open_utc: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

type IndexedBars = {
  bars: Bar[];
  times: number[];
  dailyRanges: Array<{ day: string; dayStartMs: number; range: number }>;
};

type TriangleFeatureRow = {
  case_id: string;
  scope: Scope;
  normalized_symbol: string;
  sequence_index: number;
  order_type: string;
  entry_time: string;
  side: Side;
  lot_size: number;
  mt5_exit_time: string | null;
  mt5_exit_reason: string | null;
  hold_hours_mt5: number | null;
  mt5_net_profit: number;
  mt5_price_profit: number;
  mt5_commission: number;
  mt5_swap: number;
  lookback_hours: number;
  bars_used: number;
  adr_lookback_days: number;
  adr_price: number | null;
  session_high: number | null;
  session_low: number | null;
  median_center: number | null;
  range_adr: number | null;
  path_raw_adr: number | null;
  net_displacement_adr: number | null;
  path_efficiency: number | null;
  current_volatility_floor_adr: number | null;
  center_balance: number | null;
  v1_q_adr: number | null;
  v1_signal_brick_adr: number | null;
  v1_range_pass: boolean;
  v2_round_trip_cost_adr: number | null;
  v2_q_cost_adr: number | null;
  v2_p_cost_adr: number | null;
  v2_b_cost_adr: number | null;
  v2_q_bend_adr: number | null;
  v2_q_floor_adr: number | null;
  v2_floor_pin_ratio: number | null;
  v2_grid_quantum_adr: number | null;
  v2_signal_brick_adr: number | null;
  v2_target_band_adr: number | null;
  v2_geometry_quality: number | null;
  v21_surplus_bend_adr: number | null;
  v21_surplus_quality: number | null;
  side_distance_from_center_adr: number | null;
  side_alignment: "reversion_side" | "wrong_side" | "at_center" | "unknown";
  h1_triangle_v1_directionless_accept: boolean;
  h1_triangle_v2_geometry_accept: boolean;
  h1_triangle_v21_floorpin_accept: boolean;
  h1_triangle_v21_surplus_accept: boolean;
  reject_reason: string;
  content_hash?: string;
};

type VariantDecisionRow = {
  case_id: string;
  scope: Scope;
  normalized_symbol: string;
  variant_id: VariantId;
  sequence_index: number;
  entry_time: string;
  side: Side;
  order_type: string;
  accepted: boolean;
  mt5_net_profit: number;
  mt5_price_profit: number;
  mt5_commission: number;
  mt5_swap: number;
  mt5_exit_reason: string | null;
  hold_hours_mt5: number | null;
  range_adr: number | null;
  path_efficiency: number | null;
  v2_geometry_quality: number | null;
  v2_floor_pin_ratio: number | null;
  v21_surplus_quality: number | null;
  side_distance_from_center_adr: number | null;
  content_hash?: string;
};

type VariantSummaryRow = {
  case_id: string;
  scope: Scope;
  normalized_symbol: string;
  variant_id: VariantId;
  entries_total: number;
  entries_accepted: number;
  entries_rejected: number;
  accepted_pct: number;
  accepted_net_profit: number;
  rejected_net_profit: number;
  baseline_net_profit: number;
  net_delta_vs_baseline: number;
  accepted_profit_factor: number | null;
  baseline_profit_factor: number | null;
  profit_factor_delta: number | null;
  accepted_win_pct: number;
  terminal_liquidations_accepted: number;
  terminal_liquidations_baseline: number;
  terminal_liquidations_removed: number;
  avg_hold_hours_accepted: number | null;
  max_hold_hours_accepted: number | null;
  avg_geometry_quality_accepted: number | null;
  avg_side_distance_adr_accepted: number | null;
  verdict: "BASELINE" | "PROFILED_BETTER_SHAPE" | "PROFILED_FILTER_LOSS" | "PROFILED_NO_ACCEPTS";
  content_hash?: string;
};

type AggregateSummaryRow = Omit<VariantSummaryRow, "case_id" | "scope" | "normalized_symbol"> & {
  case_id: "ALL_PARSED_REPORTS";
  scope: "aggregate";
  normalized_symbol: "MULTI";
};

type FeatureBucketRow = {
  bucket_family: "geometry_quality" | "path_efficiency" | "side_distance";
  bucket_id: string;
  entries: number;
  net_profit: number;
  avg_net_profit: number;
  profit_factor: number | null;
  win_pct: number;
  terminal_liquidations: number;
  avg_hold_hours: number | null;
  content_hash?: string;
};

type ValidationRow = {
  check: string;
  value: string | number | boolean | null;
  expected: string | number | boolean | null;
  passed: boolean;
  content_hash?: string;
};

type MetricRow = {
  metric: string;
  definition: string;
  content_hash?: string;
};

function parseOptions(): Options {
  const args = parseArgMap();
  return {
    gate92Dir: args.get("--gate92-dir") ?? DEFAULT_GATE92_DIR,
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    lookbackHours: numberArg(args, "--lookback-hours", 24),
    adrLookbackDays: numberArg(args, "--adr-lookback-days", 20),
  };
}

function numberArg(args: Map<string, string>, key: string, fallback: number) {
  const raw = args.get(key);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${key}: ${raw}`);
  return parsed;
}

function withHash<T extends Record<string, unknown>>(row: T): T & { content_hash: string } {
  return { ...row, content_hash: sha256Stable(row) };
}

function csvCells(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const ch = line[index]!;
    if (ch === "\"") {
      if (quoted && line[index + 1] === "\"") {
        cell += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (ch === "," && !quoted) {
      cells.push(cell);
      cell = "";
      continue;
    }
    cell += ch;
  }
  cells.push(cell);
  return cells;
}

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return [] as Record<string, string>[];
  const header = csvCells(lines[0]!).map((cell) => cell.trim());
  return lines.slice(1).map((line) => {
    const cells = csvCells(line);
    const row: Record<string, string> = {};
    for (let index = 0; index < header.length; index += 1) row[header[index]!] = cells[index] ?? "";
    return row;
  });
}

async function readCsvRows(filePath: string) {
  return parseCsv(await readFile(filePath, "utf8"));
}

function num(value: string | null | undefined) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bool(value: string | null | undefined) {
  return String(value).toLowerCase() === "true";
}

function round2(value: number) {
  return round(value, 2) ?? value;
}

function round6(value: number | null) {
  return value === null ? null : round(value, 6);
}

function median(values: number[]) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function hoursBetween(left: string | null, right: string | null) {
  if (!left || !right) return null;
  const delta = Date.parse(right) - Date.parse(left);
  if (!Number.isFinite(delta)) return null;
  return round(delta / 3_600_000, 6);
}

function mt5TimestampToIso(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
  )).toISOString();
}

function normalizePath(value: string) {
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

async function pathExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function parsePnlExitRows(rows: Record<string, string>[]): PnlExitSourceRow[] {
  return rows.map((row) => ({
    case_id: row.case_id ?? "",
    scope: (row.scope || "primary") as Scope,
    normalized_symbol: row.normalized_symbol ?? "",
    sequence_index: Number(row.sequence_index ?? 0),
    entry_time: row.entry_time ?? "",
    side: (row.side ?? "BUY") as Side,
    lot_size: Number(row.lot_size ?? 0),
    replica_exit_time: row.replica_exit_time ?? "",
    mt5_exit_time: row.mt5_exit_time || null,
    replica_exit_reason: (row.replica_exit_reason || "sl") as "sl" | "end_of_test",
    mt5_exit_reason: row.mt5_exit_reason ? row.mt5_exit_reason as "sl" | "end_of_test" : null,
    entry_price: Number(row.entry_price ?? 0),
    replica_exit_price: Number(row.replica_exit_price ?? 0),
    mt5_exit_price: num(row.mt5_exit_price),
    conversion_symbol: row.conversion_symbol || null,
    conversion_rate: num(row.conversion_rate),
    mt5_price_profit: num(row.mt5_price_profit),
    mt5_commission: num(row.mt5_commission),
    mt5_swap: num(row.mt5_swap),
    mt5_net_profit: num(row.mt5_net_profit),
    replica_net_profit_with_observed_swap: num(row.replica_net_profit_with_observed_swap),
  }));
}

function parseEntryShapeRows(rows: Record<string, string>[]): EntryShapeSourceRow[] {
  return rows.map((row) => ({
    case_id: row.case_id ?? "",
    entry_time: row.entry_time ?? "",
    side: (row.side ?? "BUY") as Side,
    lot_size: Number(row.lot_size ?? 0),
    order_type: (row.order_type || "TYPE3") as "TYPE1" | "TYPE3",
  }));
}

function parseSummaryRows(rows: Record<string, string>[]): SummarySourceRow[] {
  return rows.map((row) => ({
    case_id: row.case_id ?? "",
    scope: (row.scope || "primary") as Scope,
    normalized_symbol: row.normalized_symbol ?? "",
    headline_total_net_profit: Number(row.headline_total_net_profit ?? 0),
    headline_profit_factor: num(row.headline_profit_factor),
    terminal_liquidation_deals: Number(row.terminal_liquidation_deals ?? 0),
    entry_deals: Number(row.entry_deals ?? 0),
  }));
}

function parseCoverageRows(rows: Record<string, string>[]): CoverageSourceRow[] {
  return rows.map((row) => ({
    case_id: row.case_id ?? "",
    symbol: row.symbol ?? "",
    source_path: row.source_path || null,
  }));
}

async function loadBarsFromExport(filePath: string, symbol: string): Promise<Bar[]> {
  const rows = await readCsvRows(normalizePath(filePath));
  return rows
    .map((row) => {
      const iso = mt5TimestampToIso(row.bar_time || row.time || row.bar_open_utc);
      const open = num(row.open);
      const high = num(row.high);
      const low = num(row.low);
      const close = num(row.close);
      if (!iso || open === null || high === null || low === null || close === null) return null;
      return {
        symbol,
        bar_open_utc: iso,
        open,
        high,
        low,
        close,
      } satisfies Bar;
    })
    .filter((row): row is Bar => row !== null)
    .sort((left, right) => left.bar_open_utc.localeCompare(right.bar_open_utc));
}

function entryKey(row: { case_id: string; entry_time: string; side: Side; lot_size: number }) {
  return `${row.case_id}|${row.entry_time}|${row.side}|${row.lot_size.toFixed(2)}`;
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function dayStartMs(iso: string) {
  const date = new Date(iso);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function indexBars(bars: Bar[]): IndexedBars {
  const times = bars.map((bar) => Date.parse(bar.bar_open_utc));
  const byDay = new Map<string, Bar[]>();
  for (const bar of bars) {
    const key = dayKey(bar.bar_open_utc);
    byDay.set(key, [...(byDay.get(key) ?? []), bar]);
  }
  const dailyRanges = [...byDay.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([day, dayBars]) => ({
      day,
      dayStartMs: Date.parse(`${day}T00:00:00.000Z`),
      range: Math.max(...dayBars.map((bar) => bar.high)) - Math.min(...dayBars.map((bar) => bar.low)),
    }))
    .filter((row) => Number.isFinite(row.dayStartMs) && Number.isFinite(row.range) && row.range > 0);
  return { bars, times, dailyRanges };
}

function lowerBound(values: number[], target: number) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle]! < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function priorAdrPrice(indexed: IndexedBars, entryTime: string, lookbackDays: number) {
  const entryDayMs = dayStartMs(entryTime);
  const endIndex = lowerBound(indexed.dailyRanges.map((row) => row.dayStartMs), entryDayMs);
  const ranges = indexed.dailyRanges.slice(Math.max(0, endIndex - lookbackDays), endIndex).map((row) => row.range);
  if (ranges.length < Math.min(5, lookbackDays)) return null;
  return ranges.reduce((sum, value) => sum + value, 0) / ranges.length;
}

function lookbackBars(indexed: IndexedBars, entryTime: string, hours: number) {
  const entryMs = Date.parse(entryTime);
  if (!Number.isFinite(entryMs)) return [] as Bar[];
  const entryIndex = lowerBound(indexed.times, entryMs);
  return indexed.bars.slice(Math.max(0, entryIndex - hours), entryIndex);
}

function centerBalance(bars: Bar[], center: number) {
  if (!bars.length) return 0;
  let above = 0;
  let below = 0;
  for (const bar of bars) {
    if (bar.close > center) above += 1;
    else if (bar.close < center) below += 1;
  }
  return 1 - Math.abs(above - below) / bars.length;
}

function quoteCurrency(symbol: string) {
  return symbol.slice(3, 6).toUpperCase();
}

function oneAdrUsd(options: {
  symbol: string;
  adrPrice: number;
  lotSize: number;
  conversionRate: number | null;
}) {
  const quote = quoteCurrency(options.symbol);
  const quotePnl = options.adrPrice * options.lotSize * STANDARD_FX_CONTRACT_UNITS;
  if (quote === "USD") return quotePnl;
  const conversionRate = options.conversionRate;
  if (conversionRate === null || conversionRate <= 0) return null;
  return quotePnl / conversionRate;
}

function triangleV1Quantum(rangeAdr: number, pathEfficiency: number) {
  const pe = Math.max(0, Math.min(1, pathEfficiency));
  return Math.max(rangeAdr / (2 + 2 * (1 - pe)), TRIANGLE_FORMULAIC_COST_FLOOR_ADR);
}

function computeFeature(params: {
  exit: PnlExitSourceRow;
  orderType: string;
  bars: IndexedBars | null;
  lookbackHours: number;
  adrLookbackDays: number;
}): TriangleFeatureRow {
  const mt5Net = params.exit.mt5_net_profit ?? params.exit.replica_net_profit_with_observed_swap ?? 0;
  const mt5Price = params.exit.mt5_price_profit ?? 0;
  const mt5Commission = params.exit.mt5_commission ?? 0;
  const mt5Swap = params.exit.mt5_swap ?? 0;
  const holdHours = hoursBetween(params.exit.entry_time, params.exit.mt5_exit_time);
  const unavailable = (reason: string) => withHash({
    case_id: params.exit.case_id,
    scope: params.exit.scope,
    normalized_symbol: params.exit.normalized_symbol,
    sequence_index: params.exit.sequence_index,
    order_type: params.orderType,
    entry_time: params.exit.entry_time,
    side: params.exit.side,
    lot_size: params.exit.lot_size,
    mt5_exit_time: params.exit.mt5_exit_time,
    mt5_exit_reason: params.exit.mt5_exit_reason,
    hold_hours_mt5: holdHours,
    mt5_net_profit: round2(mt5Net),
    mt5_price_profit: round2(mt5Price),
    mt5_commission: round2(mt5Commission),
    mt5_swap: round2(mt5Swap),
    lookback_hours: params.lookbackHours,
    bars_used: 0,
    adr_lookback_days: params.adrLookbackDays,
    adr_price: null,
    session_high: null,
    session_low: null,
    median_center: null,
    range_adr: null,
    path_raw_adr: null,
    net_displacement_adr: null,
    path_efficiency: null,
    current_volatility_floor_adr: null,
    center_balance: null,
    v1_q_adr: null,
    v1_signal_brick_adr: null,
    v1_range_pass: false,
    v2_round_trip_cost_adr: null,
    v2_q_cost_adr: null,
    v2_p_cost_adr: null,
    v2_b_cost_adr: null,
    v2_q_bend_adr: null,
    v2_q_floor_adr: null,
    v2_floor_pin_ratio: null,
    v2_grid_quantum_adr: null,
    v2_signal_brick_adr: null,
    v2_target_band_adr: null,
    v2_geometry_quality: null,
    v21_surplus_bend_adr: null,
    v21_surplus_quality: null,
    side_distance_from_center_adr: null,
    side_alignment: "unknown" as const,
    h1_triangle_v1_directionless_accept: false,
    h1_triangle_v2_geometry_accept: false,
    h1_triangle_v21_floorpin_accept: false,
    h1_triangle_v21_surplus_accept: false,
    reject_reason: reason,
  });

  if (!params.bars) return unavailable("missing_h1_bars_for_case");
  const rangeBars = lookbackBars(params.bars, params.exit.entry_time, params.lookbackHours);
  const adrPrice = priorAdrPrice(params.bars, params.exit.entry_time, params.adrLookbackDays);
  if (rangeBars.length < params.lookbackHours || adrPrice === null || adrPrice <= 0) {
    return unavailable("insufficient_h1_or_adr_lookback");
  }

  const high = Math.max(...rangeBars.map((bar) => bar.high));
  const low = Math.min(...rangeBars.map((bar) => bar.low));
  const medianCenter = median(rangeBars.map((bar) => bar.close));
  if (medianCenter === null) return unavailable("missing_median_center");

  const pathDeltasAdr: number[] = [];
  let previous = rangeBars[0]!.open;
  for (const bar of rangeBars) {
    pathDeltasAdr.push(Math.abs(bar.close - previous) / adrPrice);
    previous = bar.close;
  }
  const pathRawAdr = pathDeltasAdr.reduce((sum, value) => sum + value, 0);
  const netDisplacementAdr = Math.abs(rangeBars.at(-1)!.close - rangeBars[0]!.open) / adrPrice;
  const pathEfficiency = pathRawAdr > 0 ? netDisplacementAdr / pathRawAdr : null;
  if (pathEfficiency === null) return unavailable("path_efficiency_null");

  const rangeAdr = (high - low) / adrPrice;
  const balance = centerBalance(rangeBars, medianCenter);
  const volatilityFloorAdr = median(pathDeltasAdr) ?? 0;
  const v1Q = triangleV1Quantum(rangeAdr, pathEfficiency);
  const v1RangePass = rangeAdr + 1e-9 >= v1Q * TRIANGLE_FORMULAIC_MIN_RANGE_TO_Q;

  const oneAdr = oneAdrUsd({
    symbol: params.exit.normalized_symbol,
    adrPrice,
    lotSize: params.exit.lot_size,
    conversionRate: params.exit.conversion_rate,
  });
  const commission = Math.abs(params.exit.mt5_commission ?? 0);
  const roundTripCostAdr = oneAdr && oneAdr > 0 && commission > 0
    ? Math.max(commission / oneAdr, TRIANGLE_FORMULAIC_V2_ROUND_TRIP_COST_FALLBACK_ADR)
    : TRIANGLE_FORMULAIC_V2_ROUND_TRIP_COST_FALLBACK_ADR;
  const oneWayCostAdr = roundTripCostAdr / 2;
  const pCostAdr = pathDeltasAdr.reduce((sum, deltaAdr) => sum + Math.max(deltaAdr - oneWayCostAdr, 0), 0);
  const bCostAdr = Math.max(0, pCostAdr - netDisplacementAdr);
  const qCostAdr = TRIANGLE_FORMULAIC_V2_COST_MULTIPLE * roundTripCostAdr;
  const qBendAdr = rangeAdr / Math.max(1 + Math.sqrt(bCostAdr / Math.max(qCostAdr, 1e-9)), 1e-9);
  const qFloorAdr = Math.max(qCostAdr, volatilityFloorAdr);
  const gridQuantumAdr = Math.max(qFloorAdr, qBendAdr);
  const signalBrickAdr = Math.max(gridQuantumAdr / TRIANGLE_FORMULAIC_SIGNAL_BRICK_DIVISOR, qCostAdr / 2);
  const targetBandAdr = signalBrickAdr;
  const geometryQuality = (bCostAdr / Math.max(gridQuantumAdr, 1e-9)) * balance;
  const floorPinRatio = qBendAdr / Math.max(qFloorAdr, 1e-9);
  const surplusBendAdr = Math.max(0, bCostAdr - TRIANGLE_FORMULAIC_V2_1_SURPLUS_COST_MULTIPLE * qCostAdr);
  const surplusQuality = (surplusBendAdr / Math.max(gridQuantumAdr, 1e-9)) * balance * Math.min(1, floorPinRatio);
  const distanceAdr = params.exit.side === "BUY"
    ? (medianCenter - params.exit.entry_price) / adrPrice
    : (params.exit.entry_price - medianCenter) / adrPrice;
  const alignment = Math.abs(distanceAdr) < 1e-9
    ? "at_center" as const
    : distanceAdr > 0 ? "reversion_side" as const : "wrong_side" as const;

  const lowEfficiency = pathEfficiency <= TRIANGLE_PATH_EFFICIENCY_LOW_MAX;
  const v1Accept = lowEfficiency && v1RangePass && distanceAdr + 1e-9 >= v1Q;
  const v2GeometryAccept = geometryQuality + 1e-9 >= TRIANGLE_FORMULAIC_V2_MIN_GEOMETRY_QUALITY && distanceAdr + 1e-9 >= gridQuantumAdr;
  const v21FloorpinAccept = v2GeometryAccept && floorPinRatio + 1e-9 >= TRIANGLE_FORMULAIC_V2_1_FLOOR_PIN_MIN_RATIO;
  const v21SurplusAccept = v21FloorpinAccept && surplusQuality + 1e-9 >= TRIANGLE_FORMULAIC_V2_1_MIN_SURPLUS_GEOMETRY_QUALITY;

  const rejectReasons = [
    lowEfficiency ? null : "path_efficiency_gt_0_35",
    v1RangePass ? null : "range_lt_2q_v1",
    distanceAdr >= 0 ? null : "wrong_side_of_center",
    distanceAdr + 1e-9 >= gridQuantumAdr ? null : "distance_lt_v2_q",
    geometryQuality + 1e-9 >= TRIANGLE_FORMULAIC_V2_MIN_GEOMETRY_QUALITY ? null : "geometry_quality_lt_1",
    floorPinRatio + 1e-9 >= TRIANGLE_FORMULAIC_V2_1_FLOOR_PIN_MIN_RATIO ? null : "floor_pin_lt_1_25",
    surplusQuality + 1e-9 >= TRIANGLE_FORMULAIC_V2_1_MIN_SURPLUS_GEOMETRY_QUALITY ? null : "surplus_quality_lt_1",
  ].filter((value): value is string => Boolean(value));

  return withHash({
    case_id: params.exit.case_id,
    scope: params.exit.scope,
    normalized_symbol: params.exit.normalized_symbol,
    sequence_index: params.exit.sequence_index,
    order_type: params.orderType,
    entry_time: params.exit.entry_time,
    side: params.exit.side,
    lot_size: params.exit.lot_size,
    mt5_exit_time: params.exit.mt5_exit_time,
    mt5_exit_reason: params.exit.mt5_exit_reason,
    hold_hours_mt5: holdHours,
    mt5_net_profit: round2(mt5Net),
    mt5_price_profit: round2(mt5Price),
    mt5_commission: round2(mt5Commission),
    mt5_swap: round2(mt5Swap),
    lookback_hours: params.lookbackHours,
    bars_used: rangeBars.length,
    adr_lookback_days: params.adrLookbackDays,
    adr_price: round6(adrPrice),
    session_high: high,
    session_low: low,
    median_center: medianCenter,
    range_adr: round6(rangeAdr),
    path_raw_adr: round6(pathRawAdr),
    net_displacement_adr: round6(netDisplacementAdr),
    path_efficiency: round6(pathEfficiency),
    current_volatility_floor_adr: round6(volatilityFloorAdr),
    center_balance: round6(balance),
    v1_q_adr: round6(v1Q),
    v1_signal_brick_adr: round6(v1Q / TRIANGLE_FORMULAIC_SIGNAL_BRICK_DIVISOR),
    v1_range_pass: v1RangePass,
    v2_round_trip_cost_adr: round6(roundTripCostAdr),
    v2_q_cost_adr: round6(qCostAdr),
    v2_p_cost_adr: round6(pCostAdr),
    v2_b_cost_adr: round6(bCostAdr),
    v2_q_bend_adr: round6(qBendAdr),
    v2_q_floor_adr: round6(qFloorAdr),
    v2_floor_pin_ratio: round6(floorPinRatio),
    v2_grid_quantum_adr: round6(gridQuantumAdr),
    v2_signal_brick_adr: round6(signalBrickAdr),
    v2_target_band_adr: round6(targetBandAdr),
    v2_geometry_quality: round6(geometryQuality),
    v21_surplus_bend_adr: round6(surplusBendAdr),
    v21_surplus_quality: round6(surplusQuality),
    side_distance_from_center_adr: round6(distanceAdr),
    side_alignment: alignment,
    h1_triangle_v1_directionless_accept: v1Accept,
    h1_triangle_v2_geometry_accept: v2GeometryAccept,
    h1_triangle_v21_floorpin_accept: v21FloorpinAccept,
    h1_triangle_v21_surplus_accept: v21SurplusAccept,
    reject_reason: rejectReasons.length ? rejectReasons.join(";") : "accepted_all_triangle_filters",
  });
}

function variantAccepted(variant: VariantId, row: TriangleFeatureRow) {
  if (variant === "baseline_all_limnihedge_v1") return true;
  if (variant === "h1_triangle_center_reversion_side") return row.side_alignment === "reversion_side" || row.side_alignment === "at_center";
  if (variant === "h1_triangle_v1_directionless") return row.h1_triangle_v1_directionless_accept;
  if (variant === "h1_triangle_v2_geometry") return row.h1_triangle_v2_geometry_accept;
  if (variant === "h1_triangle_v21_floorpin") return row.h1_triangle_v21_floorpin_accept;
  return row.h1_triangle_v21_surplus_accept;
}

function decisionRows(featureRows: TriangleFeatureRow[]): VariantDecisionRow[] {
  const variants: VariantId[] = [
    "baseline_all_limnihedge_v1",
    "h1_triangle_center_reversion_side",
    "h1_triangle_v1_directionless",
    "h1_triangle_v2_geometry",
    "h1_triangle_v21_floorpin",
    "h1_triangle_v21_surplus",
  ];
  const rows: VariantDecisionRow[] = [];
  for (const feature of featureRows) {
    for (const variant of variants) {
      rows.push(withHash({
        case_id: feature.case_id,
        scope: feature.scope,
        normalized_symbol: feature.normalized_symbol,
        variant_id: variant,
        sequence_index: feature.sequence_index,
        entry_time: feature.entry_time,
        side: feature.side,
        order_type: feature.order_type,
        accepted: variantAccepted(variant, feature),
        mt5_net_profit: feature.mt5_net_profit,
        mt5_price_profit: feature.mt5_price_profit,
        mt5_commission: feature.mt5_commission,
        mt5_swap: feature.mt5_swap,
        mt5_exit_reason: feature.mt5_exit_reason,
        hold_hours_mt5: feature.hold_hours_mt5,
        range_adr: feature.range_adr,
        path_efficiency: feature.path_efficiency,
        v2_geometry_quality: feature.v2_geometry_quality,
        v2_floor_pin_ratio: feature.v2_floor_pin_ratio,
        v21_surplus_quality: feature.v21_surplus_quality,
        side_distance_from_center_adr: feature.side_distance_from_center_adr,
      }));
    }
  }
  return rows;
}

function summarizeVariant(caseRows: VariantDecisionRow[], variant: VariantId, baselineRows: VariantDecisionRow[]): VariantSummaryRow {
  const accepted = caseRows.filter((row) => row.accepted);
  const rejected = caseRows.filter((row) => !row.accepted);
  const baselineNet = round2(baselineRows.reduce((sum, row) => sum + row.mt5_net_profit, 0));
  const acceptedNet = round2(accepted.reduce((sum, row) => sum + row.mt5_net_profit, 0));
  const rejectedNet = round2(rejected.reduce((sum, row) => sum + row.mt5_net_profit, 0));
  const terminalAccepted = accepted.filter((row) => row.mt5_exit_reason === "end_of_test").length;
  const terminalBaseline = baselineRows.filter((row) => row.mt5_exit_reason === "end_of_test").length;
  const acceptedPf = accepted.length ? profitFactor(accepted.map((row) => row.mt5_net_profit)) : null;
  const baselinePf = baselineRows.length ? profitFactor(baselineRows.map((row) => row.mt5_net_profit)) : null;
  const acceptedWinPct = accepted.length ? (accepted.filter((row) => row.mt5_net_profit > 0).length / accepted.length) * 100 : 0;
  const holdValues = accepted.map((row) => row.hold_hours_mt5).filter((value): value is number => value !== null);
  const geometryValues = accepted.map((row) => row.v2_geometry_quality).filter((value): value is number => value !== null);
  const distanceValues = accepted.map((row) => row.side_distance_from_center_adr).filter((value): value is number => value !== null);
  const netDelta = round2(acceptedNet - baselineNet);
  const pfDelta = acceptedPf === null || baselinePf === null ? null : round(acceptedPf - baselinePf, 6);
  const terminalRemoved = terminalBaseline - terminalAccepted;
  const verdict = variant === "baseline_all_limnihedge_v1"
    ? "BASELINE" as const
    : accepted.length === 0
      ? "PROFILED_NO_ACCEPTS" as const
      : terminalRemoved > 0 && netDelta >= -Math.max(100, Math.abs(baselineNet) * 0.05)
        ? "PROFILED_BETTER_SHAPE" as const
        : "PROFILED_FILTER_LOSS" as const;
  return withHash({
    case_id: caseRows[0]?.case_id ?? baselineRows[0]?.case_id ?? "",
    scope: caseRows[0]?.scope ?? baselineRows[0]?.scope ?? "primary",
    normalized_symbol: caseRows[0]?.normalized_symbol ?? baselineRows[0]?.normalized_symbol ?? "",
    variant_id: variant,
    entries_total: caseRows.length,
    entries_accepted: accepted.length,
    entries_rejected: rejected.length,
    accepted_pct: round((accepted.length / Math.max(caseRows.length, 1)) * 100, 6) ?? 0,
    accepted_net_profit: acceptedNet,
    rejected_net_profit: rejectedNet,
    baseline_net_profit: baselineNet,
    net_delta_vs_baseline: netDelta,
    accepted_profit_factor: acceptedPf === null ? null : round(acceptedPf, 6),
    baseline_profit_factor: baselinePf === null ? null : round(baselinePf, 6),
    profit_factor_delta: pfDelta,
    accepted_win_pct: round(acceptedWinPct, 6) ?? 0,
    terminal_liquidations_accepted: terminalAccepted,
    terminal_liquidations_baseline: terminalBaseline,
    terminal_liquidations_removed: terminalRemoved,
    avg_hold_hours_accepted: holdValues.length ? round(holdValues.reduce((sum, value) => sum + value, 0) / holdValues.length, 6) : null,
    max_hold_hours_accepted: holdValues.length ? round(Math.max(...holdValues), 6) : null,
    avg_geometry_quality_accepted: geometryValues.length ? round(geometryValues.reduce((sum, value) => sum + value, 0) / geometryValues.length, 6) : null,
    avg_side_distance_adr_accepted: distanceValues.length ? round(distanceValues.reduce((sum, value) => sum + value, 0) / distanceValues.length, 6) : null,
    verdict,
  });
}

function variantSummaryRows(decisions: VariantDecisionRow[]): VariantSummaryRow[] {
  const variants = [...new Set(decisions.map((row) => row.variant_id))] as VariantId[];
  const caseIds = [...new Set(decisions.map((row) => row.case_id))].sort();
  const rows: VariantSummaryRow[] = [];
  for (const caseId of caseIds) {
    const caseRows = decisions.filter((row) => row.case_id === caseId);
    const baselineRows = caseRows.filter((row) => row.variant_id === "baseline_all_limnihedge_v1");
    for (const variant of variants) {
      rows.push(summarizeVariant(caseRows.filter((row) => row.variant_id === variant), variant, baselineRows));
    }
  }
  return rows;
}

function aggregateRows(decisions: VariantDecisionRow[]): AggregateSummaryRow[] {
  const variants = [...new Set(decisions.map((row) => row.variant_id))] as VariantId[];
  const baselineRows = decisions.filter((row) => row.variant_id === "baseline_all_limnihedge_v1");
  return variants.map((variant) => {
    const summary = summarizeVariant(decisions.filter((row) => row.variant_id === variant), variant, baselineRows);
    const { case_id: _caseId, scope: _scope, normalized_symbol: _symbol, ...rest } = summary;
    return withHash({
      case_id: "ALL_PARSED_REPORTS" as const,
      scope: "aggregate" as const,
      normalized_symbol: "MULTI" as const,
      ...rest,
    });
  });
}

function bucketId(family: FeatureBucketRow["bucket_family"], row: TriangleFeatureRow) {
  if (family === "geometry_quality") {
    const value = row.v2_geometry_quality;
    if (value === null) return "gq_missing";
    if (value < 0.5) return "gq_lt_0_5";
    if (value < 1) return "gq_0_5_1";
    if (value < 2) return "gq_1_2";
    if (value < 4) return "gq_2_4";
    return "gq_gte_4";
  }
  if (family === "path_efficiency") {
    const value = row.path_efficiency;
    if (value === null) return "pe_missing";
    if (value <= TRIANGLE_PATH_EFFICIENCY_LOW_MAX) return "pe_low_le_0_35";
    if (value <= 0.6) return "pe_mid_0_35_0_6";
    return "pe_high_gt_0_6";
  }
  const value = row.side_distance_from_center_adr;
  if (value === null) return "distance_missing";
  if (value < 0) return "wrong_side_of_center";
  if (value < 0.25) return "distance_0_0_25";
  if (value < 0.5) return "distance_0_25_0_5";
  return "distance_gte_0_5";
}

function summarizeFeatureBucket(family: FeatureBucketRow["bucket_family"], bucket: string, rows: TriangleFeatureRow[]): FeatureBucketRow {
  const net = round2(rows.reduce((sum, row) => sum + row.mt5_net_profit, 0));
  const pf = rows.length ? profitFactor(rows.map((row) => row.mt5_net_profit)) : null;
  const holdValues = rows.map((row) => row.hold_hours_mt5).filter((value): value is number => value !== null);
  return withHash({
    bucket_family: family,
    bucket_id: bucket,
    entries: rows.length,
    net_profit: net,
    avg_net_profit: rows.length ? round(net / rows.length, 6) ?? 0 : 0,
    profit_factor: pf === null ? null : round(pf, 6),
    win_pct: rows.length ? round((rows.filter((row) => row.mt5_net_profit > 0).length / rows.length) * 100, 6) ?? 0 : 0,
    terminal_liquidations: rows.filter((row) => row.mt5_exit_reason === "end_of_test").length,
    avg_hold_hours: holdValues.length ? round(holdValues.reduce((sum, value) => sum + value, 0) / holdValues.length, 6) : null,
  });
}

function featureBucketRows(features: TriangleFeatureRow[]): FeatureBucketRow[] {
  const output: FeatureBucketRow[] = [];
  for (const family of ["geometry_quality", "path_efficiency", "side_distance"] as const) {
    const groups = new Map<string, TriangleFeatureRow[]>();
    for (const row of features) {
      const bucket = bucketId(family, row);
      groups.set(bucket, [...(groups.get(bucket) ?? []), row]);
    }
    for (const [bucket, rows] of [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      output.push(summarizeFeatureBucket(family, bucket, rows));
    }
  }
  return output;
}

function validationRows(params: {
  gate92RunSummary: Record<string, unknown> | null;
  pnlRows: PnlExitSourceRow[];
  featureRows: TriangleFeatureRow[];
  summaryRows: SummarySourceRow[];
  decisions: VariantDecisionRow[];
  aggregate: AggregateSummaryRow[];
  buckets: FeatureBucketRow[];
}) {
  const gate92Verdict = String(params.gate92RunSummary?.verdict ?? "");
  const featureFailures = params.featureRows.filter((row) => row.adr_price === null || row.bars_used === 0).length;
  const baselineDecisions = params.decisions.filter((row) => row.variant_id === "baseline_all_limnihedge_v1").length;
  const variants = new Set(params.decisions.map((row) => row.variant_id));
  const aggregateNonBaseline = params.aggregate.filter((row) => row.variant_id !== "baseline_all_limnihedge_v1");
  return [
    {
      check: "gate92_parity_prerequisite_passed",
      value: gate92Verdict || "missing",
      expected: "PASS_GATE92_LIMNIHEDGE_LEGACY_PARITY_INTAKE_READY_FOR_FULL_REPLAY",
      passed: gate92Verdict === "PASS_GATE92_LIMNIHEDGE_LEGACY_PARITY_INTAKE_READY_FOR_FULL_REPLAY",
    },
    {
      check: "pnl_exit_rows_loaded",
      value: params.pnlRows.length,
      expected: ">=1",
      passed: params.pnlRows.length > 0,
    },
    {
      check: "feature_rows_match_pnl_rows",
      value: params.featureRows.length,
      expected: params.pnlRows.length,
      passed: params.featureRows.length === params.pnlRows.length,
    },
    {
      check: "feature_rows_have_h1_geometry",
      value: featureFailures,
      expected: 0,
      passed: featureFailures === 0,
    },
    {
      check: "baseline_decisions_match_pnl_rows",
      value: baselineDecisions,
      expected: params.pnlRows.length,
      passed: baselineDecisions === params.pnlRows.length,
    },
    {
      check: "expected_variant_count",
      value: variants.size,
      expected: 6,
      passed: variants.size === 6,
    },
    {
      check: "aggregate_triangle_variants_evaluated",
      value: aggregateNonBaseline.length,
      expected: 5,
      passed: aggregateNonBaseline.length === 5,
    },
    {
      check: "feature_bucket_rows_emitted",
      value: params.buckets.length,
      expected: ">=1",
      passed: params.buckets.length > 0,
    },
    {
      check: "mt5_ea_not_mutated_by_gate93_script",
      value: "repo-side artifact diagnostic only",
      expected: "reference-only EA",
      passed: true,
    },
  ].map((row) => withHash(row));
}

function metricRows(): MetricRow[] {
  return [
    { metric: "h1_triangle_center_reversion_side", definition: "Minimal Triangle side check on the verified H1 path: BUY must be at/below the median center and SELL must be at/above it." },
    { metric: "h1_triangle_v1_directionless", definition: "Gate91 v1 equation adapted to the verified Gate92 broker H1 path: low path efficiency, range >= 2Q, and side distance from median center >= Q." },
    { metric: "h1_triangle_v2_geometry", definition: "Gate91 v2 cost-bend equation adapted to H1: geometry quality >= 1 and side distance from median center >= Q." },
    { metric: "h1_triangle_v21_floorpin", definition: "Gate91 v2.1 floor-pin overlay: v2 geometry plus Q_bend / Q_floor >= 1.25." },
    { metric: "h1_triangle_v21_surplus", definition: "Gate91 v2.1 surplus overlay: floor-pin plus surplus geometry quality >= 1 after subtracting 2 * Q_cost." },
    { metric: "net_delta_vs_baseline", definition: "Accepted MT5 saved-report net profit minus the full LimniHedge V1 baseline net profit for the same report/case." },
    { metric: "terminal_liquidations_removed", definition: "Saved-report terminal forced liquidations rejected by the overlay filter. Positive is risk-shape improvement only if net is not destroyed." },
  ].map((row) => withHash(row));
}

async function writeRows(jsonPath: string, csvPath: string, rows: Record<string, unknown>[]) {
  await writeJson(jsonPath, rows);
  if (rows.length === 0) {
    await writeFile(csvPath, "", "utf8");
    return;
  }
  const columns = Object.keys(rows[0]!);
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const text = typeof value === "object" ? JSON.stringify(value) : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [columns.join(","), ...rows.map((row) => columns.map((column) => escape(row[column])).join(","))].join("\n");
  await writeFile(csvPath, `${csv}\n`, "utf8");
}

function renderReport(params: {
  options: Options;
  validations: ValidationRow[];
  summaries: VariantSummaryRow[];
  aggregate: AggregateSummaryRow[];
  buckets: FeatureBucketRow[];
  artifacts: Record<string, string>;
}) {
  const validationTable = renderTable(params.validations, ["check", "value", "expected", "passed"]);
  const aggregateTable = renderTable(params.aggregate, [
    "variant_id",
    "entries_accepted",
    "entries_rejected",
    "accepted_pct",
    "accepted_net_profit",
    "baseline_net_profit",
    "net_delta_vs_baseline",
    "accepted_profit_factor",
    "terminal_liquidations_accepted",
    "terminal_liquidations_baseline",
    "terminal_liquidations_removed",
    "verdict",
  ]);
  const summaryTable = renderTable(params.summaries, [
    "case_id",
    "variant_id",
    "entries_accepted",
    "accepted_pct",
    "accepted_net_profit",
    "baseline_net_profit",
    "net_delta_vs_baseline",
    "accepted_profit_factor",
    "terminal_liquidations_accepted",
    "terminal_liquidations_removed",
    "verdict",
  ]);
  const bucketTable = renderTable(params.buckets, ["bucket_family", "bucket_id", "entries", "net_profit", "avg_net_profit", "profit_factor", "terminal_liquidations", "avg_hold_hours"]);
  const artifactLines = Object.entries(params.artifacts).map(([key, value]) => `- ${key}: \`${value}\``).join("\n");
  const diagnosticPass = params.validations.every((row) => row.passed);
  const betterRows = params.aggregate.filter((row) => row.verdict === "PROFILED_BETTER_SHAPE");
  const verdict = diagnosticPass
    ? betterRows.length
      ? "PASS_GATE93_TRIANGLE_OVERLAY_DIAGNOSTIC_BETTER_SHAPE_FOUND_NO_PROMOTION"
      : "PASS_GATE93_TRIANGLE_OVERLAY_DIAGNOSTIC_NO_KEEPER_NO_PROMOTION"
    : "FAIL_GATE93_TRIANGLE_OVERLAY_DIAGNOSTIC_FIX_PARITY_OR_FEATURES_FIRST";

  return `# Gate 93 LimniHedge Triangle Overlay Diagnostic

Date: ${GATE_DATE}

Verdict: \`${verdict}\`

## Scope

Gate 93 is a repo-side overlay diagnostic after Gate 92 parity. It does not mutate \`automation/mt5/Experts/LimniHedge_V1.mq5\`, does not add LRMG direction, does not add Katarakti-lite, and does not run a broad optimization matrix.

This pass asks one narrow question: if Gate91-style Triangle geometry is measured on the verified broker H1 parity path around each saved LimniHedge V1 entry, does it identify a cleaner subset of the legacy Type 1/Type 3 entries?

Important boundary: this is not a canonical M1 Triangle replay. It is an H1 overlay on the Gate92 parity ledger so the first reconstruction remains anchored to the MT5 reports Freedom saved.

## Configuration

- Gate92 artifact input: \`${params.options.gate92Dir}\`
- H1 lookback per entry: \`${params.options.lookbackHours}\` bars
- ADR lookback: \`${params.options.adrLookbackDays}\` complete UTC days
- Low path-efficiency threshold: \`${TRIANGLE_PATH_EFFICIENCY_LOW_MAX}\`
- V2 geometry quality floor: \`${TRIANGLE_FORMULAIC_V2_MIN_GEOMETRY_QUALITY}\`
- V2.1 floor-pin ratio: \`${TRIANGLE_FORMULAIC_V2_1_FLOOR_PIN_MIN_RATIO}\`

## Aggregate Read

${aggregateTable}

## Case Read

${summaryTable}

## Feature Buckets

These buckets are diagnostic only. They show whether Triangle geometry behaves as a risk score even when hard-gating is too restrictive.

${bucketTable}

## Validation

${validationTable}

## Artifacts

${artifactLines}

## Stop Line

Do not promote this overlay into MT5 or replace David/Type 3 from this result alone. If the overlay improves shape, the next gate should replay the best one or two rows on the canonical M1 Triangle/LRMG path. If it fails, preserve the ledger and return to parity-safe design rather than tuning thresholds.
`;
}

async function main() {
  const options = parseOptions();
  await mkdir(options.artifactDir, { recursive: true });
  await mkdir(path.dirname(options.reportPath), { recursive: true });

  const gate92RunSummaryPath = path.join(options.gate92Dir, "gate92-run-summary.json");
  const gate92RunSummary = await pathExists(gate92RunSummaryPath)
    ? JSON.parse(await readFile(gate92RunSummaryPath, "utf8")) as Record<string, unknown>
    : null;
  const pnlRows = parsePnlExitRows(await readCsvRows(path.join(options.gate92Dir, "replica-pnl-exits.rows.csv")));
  const entryRows = parseEntryShapeRows(await readCsvRows(path.join(options.gate92Dir, "replica-entry-shape.rows.csv")));
  const summaries = parseSummaryRows(await readCsvRows(path.join(options.gate92Dir, "mt5-report-summary.rows.csv")));
  const coverageRows = parseCoverageRows(await readCsvRows(path.join(options.gate92Dir, "h1-source-coverage.rows.csv")));

  const entryByKey = new Map(entryRows.map((row) => [entryKey(row), row]));
  const coverageByCase = new Map(coverageRows.map((row) => [row.case_id, row]));
  const barsByCase = new Map<string, IndexedBars>();
  for (const coverage of coverageRows) {
    if (!coverage.source_path) continue;
    barsByCase.set(coverage.case_id, indexBars(await loadBarsFromExport(coverage.source_path, coverage.symbol)));
  }

  const featureRows = pnlRows.map((exit) => computeFeature({
    exit,
    orderType: entryByKey.get(entryKey(exit))?.order_type ?? "UNKNOWN",
    bars: barsByCase.get(exit.case_id) ?? null,
    lookbackHours: options.lookbackHours,
    adrLookbackDays: options.adrLookbackDays,
  }));
  const decisions = decisionRows(featureRows);
  const summaryRows = variantSummaryRows(decisions);
  const aggregate = aggregateRows(decisions);
  const buckets = featureBucketRows(featureRows);
  const validations = validationRows({
    gate92RunSummary,
    pnlRows,
    featureRows,
    summaryRows: summaries,
    decisions,
    aggregate,
    buckets,
  });
  const metrics = metricRows();

  const commandReceipt = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at_utc: new Date().toISOString(),
    git_commit: gitCommit(),
    options: {
      gate92_dir: options.gate92Dir,
      artifact_dir: options.artifactDir,
      report_path: options.reportPath,
      lookback_hours: options.lookbackHours,
      adr_lookback_days: options.adrLookbackDays,
    },
  };
  const runSummary = {
    gate_id: GATE_ID,
    verdict: validations.every((row) => row.passed)
      ? aggregate.some((row) => row.verdict === "PROFILED_BETTER_SHAPE")
        ? "PASS_GATE93_TRIANGLE_OVERLAY_DIAGNOSTIC_BETTER_SHAPE_FOUND_NO_PROMOTION"
        : "PASS_GATE93_TRIANGLE_OVERLAY_DIAGNOSTIC_NO_KEEPER_NO_PROMOTION"
      : "FAIL_GATE93_TRIANGLE_OVERLAY_DIAGNOSTIC_FIX_PARITY_OR_FEATURES_FIRST",
    pnl_exit_rows: pnlRows.length,
    feature_rows: featureRows.length,
    decision_rows: decisions.length,
    summary_rows: summaryRows.length,
    aggregate_rows: aggregate.length,
    bucket_rows: buckets.length,
    validation_failures: validations.filter((row) => !row.passed).length,
  };

  const paths = {
    featureJson: path.join(options.artifactDir, "triangle-entry-features.rows.json"),
    featureCsv: path.join(options.artifactDir, "triangle-entry-features.rows.csv"),
    decisionsJson: path.join(options.artifactDir, "triangle-overlay-decisions.rows.json"),
    decisionsCsv: path.join(options.artifactDir, "triangle-overlay-decisions.rows.csv"),
    summaryJson: path.join(options.artifactDir, "triangle-overlay-summary.rows.json"),
    summaryCsv: path.join(options.artifactDir, "triangle-overlay-summary.rows.csv"),
    aggregateJson: path.join(options.artifactDir, "triangle-overlay-aggregate.rows.json"),
    aggregateCsv: path.join(options.artifactDir, "triangle-overlay-aggregate.rows.csv"),
    bucketsJson: path.join(options.artifactDir, "triangle-feature-buckets.rows.json"),
    bucketsCsv: path.join(options.artifactDir, "triangle-feature-buckets.rows.csv"),
    validationJson: path.join(options.artifactDir, "validation.rows.json"),
    validationCsv: path.join(options.artifactDir, "validation.rows.csv"),
    metricsJson: path.join(options.artifactDir, "metric-definitions.rows.json"),
    metricsCsv: path.join(options.artifactDir, "metric-definitions.rows.csv"),
    commandReceipt: path.join(options.artifactDir, "command-receipt.json"),
    runSummary: path.join(options.artifactDir, "gate93-run-summary.json"),
    shaManifest: path.join(options.artifactDir, "gate93-limnihedge-triangle-overlay-sha256.txt"),
  };

  await writeRows(paths.featureJson, paths.featureCsv, featureRows);
  await writeRows(paths.decisionsJson, paths.decisionsCsv, decisions);
  await writeRows(paths.summaryJson, paths.summaryCsv, summaryRows);
  await writeRows(paths.aggregateJson, paths.aggregateCsv, aggregate);
  await writeRows(paths.bucketsJson, paths.bucketsCsv, buckets);
  await writeRows(paths.validationJson, paths.validationCsv, validations);
  await writeRows(paths.metricsJson, paths.metricsCsv, metrics);
  await writeJson(paths.commandReceipt, commandReceipt);
  await writeJson(paths.runSummary, runSummary);

  const artifactsForReport = Object.fromEntries(Object.entries({ ...paths, report: options.reportPath }).map(([key, value]) => [key, toRepoRelative(value)]));
  await writeText(options.reportPath, renderReport({
    options,
    validations,
    summaries: summaryRows,
    aggregate,
    buckets,
    artifacts: artifactsForReport,
  }));
  await writeShaManifest(paths.shaManifest, GATE_ID, COMMAND, [
    { label: "report", path: options.reportPath },
    { label: "features", path: paths.featureJson },
    { label: "decisions", path: paths.decisionsJson },
    { label: "summary", path: paths.summaryJson },
    { label: "aggregate", path: paths.aggregateJson },
    { label: "buckets", path: paths.bucketsJson },
    { label: "validation", path: paths.validationJson },
    { label: "metrics", path: paths.metricsJson },
    { label: "command_receipt", path: paths.commandReceipt },
    { label: "run_summary", path: paths.runSummary },
  ]);

  console.log(`Gate 93 report: ${toRepoRelative(options.reportPath)}`);
  console.log(`Gate 93 verdict: ${runSummary.verdict}`);
  console.log(`Validation failures: ${runSummary.validation_failures}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
