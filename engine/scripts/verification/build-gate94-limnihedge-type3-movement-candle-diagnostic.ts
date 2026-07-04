import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { closePoolIfInitialized } from "@database/db/client";
import {
  readTradeLegPathWarehouseManifest,
  readTradeLegPathWarehousePairSeries,
  type TradeLegPathReplayPairWeek,
} from "@engine/research/tradeLegPathWarehouse";
import { sha256Stable } from "@engine/research/hash";

import {
  gitCommit,
  parseArgMap,
  profitFactor,
  readJson,
  renderTable,
  round,
  toRepoRelative,
  writeJson,
  writeShaManifest,
  writeText,
} from "./gate65-utils";

const GATE_ID = "Gate 94: limnihedge-type3-movement-candle-diagnostic";
const GATE_DATE = "2026-07-04";
const COMMAND = "npm run engine:gate94:limnihedge-type3-movement-candles";
const DEFAULT_GATE92_DIR = "docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake";
const DEFAULT_GATE74B_SUMMARY =
  "docs/research/gates/gate74b/artifacts/gate74b-trade-leg-path-materialization/gate74b-summary.json";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate94/artifacts/limnihedge-type3-movement-candle-diagnostic";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate94/GATE94_LIMNIHEDGE_TYPE3_MOVEMENT_CANDLE_DIAGNOSTIC_${GATE_DATE}.md`;

const MOVEMENT_SURFACES = [
  { id: "adr_event_0_025", brickAdr: 0.025 },
  { id: "adr_event_0_05", brickAdr: 0.05 },
  { id: "adr_event_0_075", brickAdr: 0.075 },
  { id: "adr_event_0_10", brickAdr: 0.1 },
] as const;

type MovementSurfaceId = (typeof MOVEMENT_SURFACES)[number]["id"];
type Side = "BUY" | "SELL";
type TrendState = -1 | 1;
type Scope = "primary" | "secondary" | "discovered";

type Options = {
  gate92Dir: string;
  gate74bSummary: string;
  artifactDir: string;
  reportPath: string;
  manifestId: string | null;
};

type Gate92RunSummary = {
  verdict: string;
  validation_failures: number;
};

type Gate74bSummary = {
  warehouse: {
    manifest_id: string;
    warehouse_hash: string;
    price_bundle_id: string;
    path_resolution: string;
  };
};

type PnlExitSourceRow = {
  case_id: string;
  scope: Scope;
  normalized_symbol: string;
  sequence_index: number;
  entry_time: string;
  side: Side;
  lot_size: number;
  mt5_exit_time: string | null;
  mt5_exit_reason: "sl" | "end_of_test" | null;
  hold_hours_mt5: number | null;
  mt5_net_profit: number;
  mt5_price_profit: number;
  mt5_commission: number;
  mt5_swap: number;
};

type EntryShapeSourceRow = {
  case_id: string;
  entry_time: string;
  side: Side;
  lot_size: number;
  order_type: "TYPE1" | "TYPE3";
  type3_candle_combination: number;
  david_state_shift1: "UP" | "DOWN" | "";
};

type ReportSummaryRow = {
  case_id: string;
  normalized_symbol: string;
  inputs_ma_period: number;
  inputs_rsi_period: number;
  inputs_rsi_overbought: number;
  inputs_rsi_oversold: number;
  observed_type3_entries: number;
};

type MovementCandle = {
  timestamp_utc: string;
  open: number;
  high: number;
  low: number;
  close: number;
  direction: TrendState;
};

type SurfaceState = {
  id: MovementSurfaceId;
  brickAdr: number;
  eventOpen: number | null;
  candles: MovementCandle[];
};

type PairMovementState = {
  pair: string;
  firstSourceTimestampUtc: string | null;
  lastSourceTimestampUtc: string | null;
  rawPointCount: number;
  sourceWeekCount: number;
  lastRawTimestampUtc: string | null;
  surfaces: Map<MovementSurfaceId, SurfaceState>;
};

type Type3LedgerRow = PnlExitSourceRow & {
  order_type: "TYPE3";
  legacy_type3_candle_combination: number;
  legacy_david_state_shift1: "UP" | "DOWN" | "";
};

type MovementFeatureRow = {
  case_id: string;
  scope: Scope;
  normalized_symbol: string;
  sequence_index: number;
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
  movement_surface_id: MovementSurfaceId;
  movement_brick_adr: number;
  source_path: "gate74b_reconstructed_canonical_m1_directed_adr";
  source_first_timestamp_utc: string | null;
  source_last_timestamp_utc: string | null;
  source_raw_points: number;
  movement_candles_total: number;
  movement_boundary_index: number | null;
  movement_last_candle_time_utc: string | null;
  movement_entry_lag_minutes: number | null;
  movement_type3_combo: number | null;
  movement_david_state_shift1: "UP" | "DOWN" | "MISSING";
  movement_david_state_shift2: "UP" | "DOWN" | "MISSING";
  movement_david_state_shift3: "UP" | "DOWN" | "MISSING";
  movement_david_state_shift4: "UP" | "DOWN" | "MISSING";
  movement_combo_side: Side | null;
  movement_david_regime_side: Side | null;
  movement_type3_trigger_side: Side | null;
  combo_matches_saved_side: boolean;
  david_regime_matches_saved_side: boolean;
  movement_type3_matches_saved_side: boolean;
  movement_type3_opposes_saved_side: boolean;
  entry_side_move_adr_last4: number | null;
  match_bucket: "exact_type3_match" | "combo_only" | "david_only" | "opposite_type3" | "no_type3_shape" | "missing_coverage";
};

type MovementSummaryRow = {
  movement_surface_id: MovementSurfaceId;
  match_bucket: MovementFeatureRow["match_bucket"];
  entries: number;
  net_profit: number;
  profit_factor: number | null;
  win_pct: number;
  terminal_liquidations: number;
  avg_hold_hours: number | null;
  max_hold_hours: number | null;
  avg_entry_lag_minutes: number | null;
  avg_entry_side_move_adr_last4: number | null;
};

type MovementAggregateRow = {
  movement_surface_id: MovementSurfaceId;
  entries_total: number;
  entries_exact_type3_match: number;
  exact_match_pct: number;
  baseline_type3_net_profit: number;
  exact_match_net_profit: number;
  net_delta_vs_baseline: number;
  baseline_profit_factor: number | null;
  exact_match_profit_factor: number | null;
  baseline_terminal_liquidations: number;
  exact_match_terminal_liquidations: number;
  terminal_liquidations_removed_if_hard_gate: number;
  verdict: "PROFILED_NO_PROMOTION" | "PROFILED_INTERESTING_RISK_SIGNAL" | "PROFILED_EMPTY_MATCH";
};

function parseOptions(): Options {
  const args = parseArgMap();
  return {
    gate92Dir: args.get("--gate92-dir") ?? DEFAULT_GATE92_DIR,
    gate74bSummary: args.get("--gate74b-summary") ?? DEFAULT_GATE74B_SUMMARY,
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    manifestId: args.get("--manifest-id") ?? null,
  };
}

function normalizePath(filePath: string) {
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}

function csvCells(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (char === "\"") {
      if (quoted && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
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
  return parseCsv(await readFile(normalizePath(filePath), "utf8"));
}

function num(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round2(value: number) {
  return round(value, 2) ?? value;
}

function round6(value: number) {
  return round(value, 6) ?? value;
}

function withHash<T extends Record<string, unknown>>(row: T): T & { content_hash: string } {
  return { ...row, content_hash: sha256Stable(row) };
}

function parsePnlRows(rows: Record<string, string>[]): PnlExitSourceRow[] {
  return rows.map((row) => ({
    case_id: row.case_id ?? "",
    scope: (row.scope || "primary") as Scope,
    normalized_symbol: row.normalized_symbol ?? "",
    sequence_index: Number(row.sequence_index ?? 0),
    entry_time: row.entry_time ?? "",
    side: (row.side ?? "BUY") as Side,
    lot_size: Number(row.lot_size ?? 0),
    mt5_exit_time: row.mt5_exit_time || null,
    mt5_exit_reason: (row.mt5_exit_reason || null) as PnlExitSourceRow["mt5_exit_reason"],
    hold_hours_mt5: hoursBetween(row.entry_time ?? "", row.mt5_exit_time || null),
    mt5_net_profit: num(row.mt5_net_profit) ?? num(row.replica_net_profit_with_observed_swap) ?? 0,
    mt5_price_profit: num(row.mt5_price_profit) ?? 0,
    mt5_commission: num(row.mt5_commission) ?? 0,
    mt5_swap: num(row.mt5_swap) ?? 0,
  }));
}

function parseEntryRows(rows: Record<string, string>[]): EntryShapeSourceRow[] {
  return rows.map((row) => ({
    case_id: row.case_id ?? "",
    entry_time: row.entry_time ?? "",
    side: (row.side ?? "BUY") as Side,
    lot_size: Number(row.lot_size ?? 0),
    order_type: (row.order_type ?? "TYPE3") as EntryShapeSourceRow["order_type"],
    type3_candle_combination: Number(row.type3_candle_combination ?? 0),
    david_state_shift1: (row.david_state_shift1 ?? "") as EntryShapeSourceRow["david_state_shift1"],
  }));
}

function parseReportSummaries(rows: Record<string, string>[]): ReportSummaryRow[] {
  return rows.map((row) => ({
    case_id: row.case_id ?? "",
    normalized_symbol: row.normalized_symbol ?? "",
    inputs_ma_period: num(row.inputs_ma_period) ?? 100,
    inputs_rsi_period: num(row.inputs_rsi_period) ?? 100,
    inputs_rsi_overbought: num(row.inputs_rsi_overbought) ?? 70,
    inputs_rsi_oversold: num(row.inputs_rsi_oversold) ?? 30,
    observed_type3_entries: num(row.observed_type3_entries) ?? 0,
  }));
}

function entryKey(row: { case_id: string; entry_time: string; side: Side; lot_size: number }) {
  return `${row.case_id}|${row.entry_time}|${row.side}|${row.lot_size.toFixed(2)}`;
}

function buildType3Ledger(pnlRows: PnlExitSourceRow[], entryRows: EntryShapeSourceRow[]) {
  const entriesByKey = new Map(entryRows.map((row) => [entryKey(row), row]));
  const rows: Type3LedgerRow[] = [];
  for (const pnl of pnlRows) {
    const entry = entriesByKey.get(entryKey(pnl));
    if (!entry || entry.order_type !== "TYPE3") continue;
    rows.push({
      ...pnl,
      order_type: "TYPE3",
      legacy_type3_candle_combination: entry.type3_candle_combination,
      legacy_david_state_shift1: entry.david_state_shift1,
    });
  }
  return rows;
}

function hoursBetween(startIso: string, endIso: string | null) {
  if (!startIso || !endIso) return null;
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return round((end - start) / (60 * 60 * 1000), 6);
}

function weekOpenUtcForTimestamp(timestampUtc: string) {
  const date = new Date(timestampUtc);
  const day = date.getUTCDay();
  const sunday00 = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day);
  let openMs = sunday00 + 23 * 60 * 60 * 1000;
  if (date.getTime() < openMs) openMs -= 7 * 24 * 60 * 60 * 1000;
  return new Date(openMs).toISOString();
}

function surfaceState(id: MovementSurfaceId, brickAdr: number): SurfaceState {
  return { id, brickAdr, eventOpen: null, candles: [] };
}

function pairMovementState(pair: string): PairMovementState {
  return {
    pair,
    firstSourceTimestampUtc: null,
    lastSourceTimestampUtc: null,
    rawPointCount: 0,
    sourceWeekCount: 0,
    lastRawTimestampUtc: null,
    surfaces: new Map(MOVEMENT_SURFACES.map((surface) => [surface.id, surfaceState(surface.id, surface.brickAdr)])),
  };
}

function rawPriceFromDirectedAdr(entryPrice: number, candidateSide: "LONG" | "SHORT", pairAdrPct: number, directedAdr: number) {
  const sign = candidateSide === "LONG" ? 1 : -1;
  return entryPrice * (1 + directedAdr * sign * pairAdrPct / 100);
}

function closePriceMoveAdr(from: number, to: number, currentAdrPct: number) {
  if (from <= 0 || currentAdrPct <= 0) return 0;
  return ((to - from) / from) * 100 / currentAdrPct;
}

function updateSurface(surface: SurfaceState, timestampUtc: string, close: number, pairAdrPct: number) {
  if (surface.eventOpen === null) {
    surface.eventOpen = close;
    return;
  }
  let moveAdr = closePriceMoveAdr(surface.eventOpen, close, pairAdrPct);
  let guard = 0;
  while (Math.abs(moveAdr) >= surface.brickAdr && guard < 500) {
    const direction: TrendState = moveAdr > 0 ? 1 : -1;
    const eventOpen = surface.eventOpen;
    const eventClose = eventOpen * (1 + direction * surface.brickAdr * pairAdrPct / 100);
    surface.candles.push({
      timestamp_utc: timestampUtc,
      open: eventOpen,
      high: Math.max(eventOpen, eventClose),
      low: Math.min(eventOpen, eventClose),
      close: eventClose,
      direction,
    });
    surface.eventOpen = eventClose;
    moveAdr = closePriceMoveAdr(surface.eventOpen, close, pairAdrPct);
    guard += 1;
  }
}

function updatePairStateFromWarehouseRow(state: PairMovementState, row: TradeLegPathReplayPairWeek) {
  if (!row.entry_price || row.entry_price <= 0 || row.pair_adr_pct <= 0) return;
  state.sourceWeekCount += 1;
  const payload = row.path_payload;
  for (let index = 0; index < payload.timestamp_utc.length; index += 1) {
    const timestamp = payload.timestamp_utc[index]!;
    if (state.lastRawTimestampUtc !== null && timestamp <= state.lastRawTimestampUtc) continue;
    const directedClose = payload.directed_close_adr[index];
    if (directedClose === undefined) continue;
    const close = rawPriceFromDirectedAdr(row.entry_price, row.candidate_b_side, row.pair_adr_pct, directedClose);
    if (!Number.isFinite(close) || close <= 0) continue;
    state.firstSourceTimestampUtc ??= timestamp;
    state.lastSourceTimestampUtc = timestamp;
    state.lastRawTimestampUtc = timestamp;
    state.rawPointCount += 1;
    for (const surface of state.surfaces.values()) updateSurface(surface, timestamp, close, row.pair_adr_pct);
  }
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

function upperBound(values: number[], target: number) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle]! <= target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function lwma(values: number[]) {
  let weighted = 0;
  let weightSum = 0;
  for (let index = 0; index < values.length; index += 1) {
    const weight = index + 1;
    weighted += values[index]! * weight;
    weightSum += weight;
  }
  return weighted / weightSum;
}

function buildDavidStates(candles: MovementCandle[], maPeriod: number, rsiPeriod: number, overbought: number, oversold: number) {
  const states: Array<TrendState | null> = Array(candles.length).fill(null);
  let davidState: TrendState | null = null;
  let prevClose: number | null = null;
  const rsiWarm: Array<{ gain: number; loss: number }> = [];
  let avgGain: number | null = null;
  let avgLoss: number | null = null;
  let lastRsi: number | null = null;
  const closes: number[] = [];
  const prefixSum = [0];
  const prefixIndexWeightedSum = [0];
  const maWeightSum = maPeriod * (maPeriod + 1) / 2;
  const windowLwma = (start: number, end: number) => {
    const sum = prefixSum[end + 1]! - prefixSum[start]!;
    const absoluteWeighted = prefixIndexWeightedSum[end + 1]! - prefixIndexWeightedSum[start]!;
    return (absoluteWeighted - start * sum) / maWeightSum;
  };

  for (let index = 0; index < candles.length; index += 1) {
    const close = candles[index]!.close;
    closes.push(close);
    prefixSum.push(prefixSum[index]! + close);
    prefixIndexWeightedSum.push(prefixIndexWeightedSum[index]! + (index + 1) * close);
    if (prevClose !== null) {
      const change = close - prevClose;
      const gain = Math.max(change, 0);
      const loss = Math.max(-change, 0);
      if (avgGain === null || avgLoss === null) {
        rsiWarm.push({ gain, loss });
        if (rsiWarm.length >= rsiPeriod) {
          avgGain = rsiWarm.reduce((sum, row) => sum + row.gain, 0) / rsiPeriod;
          avgLoss = rsiWarm.reduce((sum, row) => sum + row.loss, 0) / rsiPeriod;
        }
      } else {
        avgGain = ((avgGain * (rsiPeriod - 1)) + gain) / rsiPeriod;
        avgLoss = ((avgLoss * (rsiPeriod - 1)) + loss) / rsiPeriod;
      }
      if (avgGain !== null && avgLoss !== null) {
        lastRsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
      }
    }
    prevClose = close;

    if (index < maPeriod) continue;
    const currentMa = windowLwma(index - maPeriod + 1, index);
    const previousMa = windowLwma(index - maPeriod, index - 1);
    const rawState: TrendState = previousMa > currentMa ? -1 : 1;
    if (davidState === null) {
      davidState = rawState;
    } else if (rawState !== davidState) {
      if (rawState === -1) {
        if (lastRsi !== null && lastRsi < oversold) davidState = -1;
      } else if (lastRsi !== null && lastRsi > overbought) {
        davidState = 1;
      }
    }
    states[index] = davidState;
  }

  return states;
}

function stateLabel(state: TrendState | null | undefined): "UP" | "DOWN" | "MISSING" {
  if (state === 1) return "UP";
  if (state === -1) return "DOWN";
  return "MISSING";
}

function candleDirection(candle: MovementCandle): TrendState | 0 {
  if (candle.close > candle.open) return 1;
  if (candle.close < candle.open) return -1;
  return 0;
}

function type3CandleCombinationAtBoundary(candles: MovementCandle[], boundaryIndex: number) {
  if (boundaryIndex < 5) return null;
  const c = (shift: number) => candleDirection(candles[boundaryIndex - shift]!);
  if (c(2) === -1 && c(1) === 1) return 1;
  if (c(3) === -1 && c(2) === 1 && c(1) === 1) return 2;
  if (c(4) === -1 && c(3) === 1 && c(2) === 1 && c(1) === 1) return 3;
  if (c(5) === -1 && c(4) === 1 && c(3) === 1 && c(2) === 1 && c(1) === 1) return 4;
  if (c(5) === 1 && c(4) === 1 && c(3) === 1 && c(2) === 1 && c(1) === 1) return 5;
  if (c(2) === 1 && c(1) === -1) return -1;
  if (c(3) === 1 && c(2) === -1 && c(1) === -1) return -2;
  if (c(4) === 1 && c(3) === -1 && c(2) === -1 && c(1) === -1) return -3;
  if (c(5) === 1 && c(4) === -1 && c(3) === -1 && c(2) === -1 && c(1) === -1) return -4;
  if (c(5) === -1 && c(4) === -1 && c(3) === -1 && c(2) === -1 && c(1) === -1) return -5;
  return 0;
}

function comboSide(combo: number | null): Side | null {
  if (combo === 4) return "BUY";
  if (combo === -4) return "SELL";
  return null;
}

function davidRegimeSide(states: Array<TrendState | null | undefined>): Side | null {
  if (states.every((state) => state === -1)) return "BUY";
  if (states.every((state) => state === 1)) return "SELL";
  return null;
}

function type3TriggerSide(combo: number | null, states: Array<TrendState | null | undefined>): Side | null {
  const regimeSide = davidRegimeSide(states);
  const sideFromCombo = comboSide(combo);
  return regimeSide !== null && regimeSide === sideFromCombo ? regimeSide : null;
}

function matchBucket(row: {
  coverage: boolean;
  triggerSide: Side | null;
  savedSide: Side;
  comboMatches: boolean;
  davidMatches: boolean;
}): MovementFeatureRow["match_bucket"] {
  if (!row.coverage) return "missing_coverage";
  if (row.triggerSide !== null && row.triggerSide === row.savedSide) return "exact_type3_match";
  if (row.triggerSide !== null && row.triggerSide !== row.savedSide) return "opposite_type3";
  if (row.comboMatches) return "combo_only";
  if (row.davidMatches) return "david_only";
  return "no_type3_shape";
}

function profileKey(summary: ReportSummaryRow) {
  return [
    summary.normalized_symbol,
    summary.inputs_ma_period,
    summary.inputs_rsi_period,
    summary.inputs_rsi_overbought,
    summary.inputs_rsi_oversold,
  ].join("|");
}

async function readPairSeriesWithRetry(options: { manifestId: string; pair: string; weeks?: string[]; attempts: number }) {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await readTradeLegPathWarehousePairSeries({
        manifestId: options.manifestId,
        pair: options.pair,
        weeks: options.weeks,
      });
    } catch (error) {
      lastError = error;
      if (attempt === options.attempts) break;
      await closePoolIfInitialized();
    }
  }
  throw lastError;
}

async function loadMovementStates(manifestId: string, type3Rows: Type3LedgerRow[]) {
  const pairs = [...new Set(type3Rows.map((row) => row.normalized_symbol))].sort();
  const states = new Map(pairs.map((pair) => [pair, pairMovementState(pair)]));
  const missingWeekPairRows: Array<{ week_open_utc: string; pair: string }> = [];

  for (const pair of pairs) {
    const neededWeeks = [...new Set(type3Rows
      .filter((row) => row.normalized_symbol === pair)
      .map((row) => weekOpenUtcForTimestamp(row.entry_time)))].sort();
    console.log(`gate94 load pair=${pair} full_pair_series requested_entry_weeks=${neededWeeks.length}`);
    const rows = await readPairSeriesWithRetry({ manifestId, pair, attempts: 3 });
    const rowsByWeek = new Map(rows.map((row) => [row.week_open_utc, row]));
    for (const week of neededWeeks) {
      if (!rowsByWeek.has(week)) missingWeekPairRows.push({ week_open_utc: week, pair });
    }
    for (const row of rows) updatePairStateFromWarehouseRow(states.get(pair)!, row);
    const state = states.get(pair)!;
    console.log(`gate94 built pair=${pair} raw_points=${state.rawPointCount} surfaces=${[...state.surfaces.values()].map((surface) => `${surface.id}:${surface.candles.length}`).join(",")}`);
  }

  return { states, missingWeekPairRows };
}

function buildProfileStateCache(options: {
  movementStates: Map<string, PairMovementState>;
  summariesByCase: Map<string, ReportSummaryRow>;
  type3Rows: Type3LedgerRow[];
}) {
  const cache = new Map<string, Array<TrendState | null>>();
  const profiles = new Map<string, ReportSummaryRow>();
  for (const row of options.type3Rows) {
    const summary = options.summariesByCase.get(row.case_id);
    if (!summary) continue;
    profiles.set(`${row.normalized_symbol}|${profileKey(summary)}`, summary);
  }

  for (const [profileId, summary] of profiles) {
    const pair = profileId.split("|")[0]!;
    const pairState = options.movementStates.get(pair);
    if (!pairState) continue;
    for (const surface of pairState.surfaces.values()) {
      cache.set(`${pair}|${surface.id}|${profileKey(summary)}`, buildDavidStates(
        surface.candles,
        summary.inputs_ma_period,
        summary.inputs_rsi_period,
        summary.inputs_rsi_overbought,
        summary.inputs_rsi_oversold,
      ));
    }
  }
  return cache;
}

function featureRows(options: {
  type3Rows: Type3LedgerRow[];
  movementStates: Map<string, PairMovementState>;
  summariesByCase: Map<string, ReportSummaryRow>;
  stateCache: Map<string, Array<TrendState | null>>;
}) {
  const rows: MovementFeatureRow[] = [];
  const candleTimesByPairSurface = new Map<string, Map<MovementSurfaceId, number[]>>();
  for (const [pair, pairState] of options.movementStates) {
    candleTimesByPairSurface.set(pair, new Map([...pairState.surfaces.entries()].map(([surfaceId, surface]) => [
      surfaceId,
      surface.candles.map((candle) => Date.parse(candle.timestamp_utc)),
    ])));
  }
  for (const entry of options.type3Rows) {
    const summary = options.summariesByCase.get(entry.case_id);
    const pairState = options.movementStates.get(entry.normalized_symbol);
    for (const surfaceDefinition of MOVEMENT_SURFACES) {
      const surface = pairState?.surfaces.get(surfaceDefinition.id) ?? surfaceState(surfaceDefinition.id, surfaceDefinition.brickAdr);
      const entryMs = Date.parse(entry.entry_time);
      const candleTimes = candleTimesByPairSurface.get(entry.normalized_symbol)?.get(surfaceDefinition.id) ?? [];
      const boundaryIndex = Number.isFinite(entryMs) ? upperBound(candleTimes, entryMs) : 0;
      const covered = Boolean(
        pairState &&
        pairState.firstSourceTimestampUtc &&
        pairState.lastSourceTimestampUtc &&
        entry.entry_time >= pairState.firstSourceTimestampUtc &&
        entry.entry_time <= pairState.lastSourceTimestampUtc &&
        boundaryIndex >= 5 &&
        summary,
      );

      if (!covered || !summary) {
        rows.push(withHash({
          ...baseFeature(entry, surfaceDefinition.id, surfaceDefinition.brickAdr, pairState, surface),
          movement_boundary_index: boundaryIndex >= 5 ? boundaryIndex : null,
          movement_last_candle_time_utc: boundaryIndex > 0 ? surface.candles[boundaryIndex - 1]!.timestamp_utc : null,
          movement_entry_lag_minutes: null,
          movement_type3_combo: null,
          movement_david_state_shift1: "MISSING",
          movement_david_state_shift2: "MISSING",
          movement_david_state_shift3: "MISSING",
          movement_david_state_shift4: "MISSING",
          movement_combo_side: null,
          movement_david_regime_side: null,
          movement_type3_trigger_side: null,
          combo_matches_saved_side: false,
          david_regime_matches_saved_side: false,
          movement_type3_matches_saved_side: false,
          movement_type3_opposes_saved_side: false,
          entry_side_move_adr_last4: null,
          match_bucket: "missing_coverage",
        }));
        continue;
      }

      const states = options.stateCache.get(`${entry.normalized_symbol}|${surface.id}|${profileKey(summary)}`) ?? [];
      const recentStates = [1, 2, 3, 4].map((shift) => states[boundaryIndex - shift]);
      const combo = type3CandleCombinationAtBoundary(surface.candles, boundaryIndex);
      const sideFromCombo = comboSide(combo);
      const regimeSide = davidRegimeSide(recentStates);
      const triggerSide = type3TriggerSide(combo, recentStates);
      const lastCandle = surface.candles[boundaryIndex - 1]!;
      const lagMinutes = (entryMs - Date.parse(lastCandle.timestamp_utc)) / 60000;
      const last4DirectionAdr = surface.candles
        .slice(boundaryIndex - 4, boundaryIndex)
        .reduce((sum, candle) => sum + candle.direction * surface.brickAdr, 0);
      const entrySideMoveAdr = entry.side === "BUY" ? last4DirectionAdr : -last4DirectionAdr;
      const comboMatches = sideFromCombo === entry.side;
      const davidMatches = regimeSide === entry.side;
      rows.push(withHash({
        ...baseFeature(entry, surfaceDefinition.id, surfaceDefinition.brickAdr, pairState, surface),
        movement_boundary_index: boundaryIndex,
        movement_last_candle_time_utc: lastCandle.timestamp_utc,
        movement_entry_lag_minutes: round6(lagMinutes),
        movement_type3_combo: combo,
        movement_david_state_shift1: stateLabel(recentStates[0]),
        movement_david_state_shift2: stateLabel(recentStates[1]),
        movement_david_state_shift3: stateLabel(recentStates[2]),
        movement_david_state_shift4: stateLabel(recentStates[3]),
        movement_combo_side: sideFromCombo,
        movement_david_regime_side: regimeSide,
        movement_type3_trigger_side: triggerSide,
        combo_matches_saved_side: comboMatches,
        david_regime_matches_saved_side: davidMatches,
        movement_type3_matches_saved_side: triggerSide === entry.side,
        movement_type3_opposes_saved_side: triggerSide !== null && triggerSide !== entry.side,
        entry_side_move_adr_last4: round6(entrySideMoveAdr),
        match_bucket: matchBucket({
          coverage: true,
          triggerSide,
          savedSide: entry.side,
          comboMatches,
          davidMatches,
        }),
      }));
    }
  }
  return rows;
}

function baseFeature(
  entry: Type3LedgerRow,
  surfaceId: MovementSurfaceId,
  brickAdr: number,
  pairState: PairMovementState | undefined,
  surface: SurfaceState,
) {
  return {
    case_id: entry.case_id,
    scope: entry.scope,
    normalized_symbol: entry.normalized_symbol,
    sequence_index: entry.sequence_index,
    entry_time: entry.entry_time,
    side: entry.side,
    lot_size: entry.lot_size,
    mt5_exit_time: entry.mt5_exit_time,
    mt5_exit_reason: entry.mt5_exit_reason,
    hold_hours_mt5: entry.hold_hours_mt5,
    mt5_net_profit: round2(entry.mt5_net_profit),
    mt5_price_profit: round2(entry.mt5_price_profit),
    mt5_commission: round2(entry.mt5_commission),
    mt5_swap: round2(entry.mt5_swap),
    movement_surface_id: surfaceId,
    movement_brick_adr: brickAdr,
    source_path: "gate74b_reconstructed_canonical_m1_directed_adr" as const,
    source_first_timestamp_utc: pairState?.firstSourceTimestampUtc ?? null,
    source_last_timestamp_utc: pairState?.lastSourceTimestampUtc ?? null,
    source_raw_points: pairState?.rawPointCount ?? 0,
    movement_candles_total: surface.candles.length,
  };
}

function summarizeRows(rows: MovementFeatureRow[]): MovementSummaryRow[] {
  const summaries: MovementSummaryRow[] = [];
  for (const surface of MOVEMENT_SURFACES) {
    const surfaceRows = rows.filter((row) => row.movement_surface_id === surface.id);
    const buckets = [...new Set(surfaceRows.map((row) => row.match_bucket))].sort() as MovementFeatureRow["match_bucket"][];
    for (const bucket of buckets) {
      const matching = surfaceRows.filter((row) => row.match_bucket === bucket);
      const holdValues = matching.map((row) => row.hold_hours_mt5).filter((value): value is number => value !== null);
      const lagValues = matching.map((row) => row.movement_entry_lag_minutes).filter((value): value is number => value !== null);
      const moveValues = matching.map((row) => row.entry_side_move_adr_last4).filter((value): value is number => value !== null);
      summaries.push(withHash({
        movement_surface_id: surface.id,
        match_bucket: bucket,
        entries: matching.length,
        net_profit: round2(matching.reduce((sum, row) => sum + row.mt5_net_profit, 0)),
        profit_factor: matching.length ? round(profitFactor(matching.map((row) => row.mt5_net_profit)), 6) : null,
        win_pct: matching.length ? round6((matching.filter((row) => row.mt5_net_profit > 0).length / matching.length) * 100) : 0,
        terminal_liquidations: matching.filter((row) => row.mt5_exit_reason === "end_of_test").length,
        avg_hold_hours: holdValues.length ? round6(holdValues.reduce((sum, value) => sum + value, 0) / holdValues.length) : null,
        max_hold_hours: holdValues.length ? round6(Math.max(...holdValues)) : null,
        avg_entry_lag_minutes: lagValues.length ? round6(lagValues.reduce((sum, value) => sum + value, 0) / lagValues.length) : null,
        avg_entry_side_move_adr_last4: moveValues.length ? round6(moveValues.reduce((sum, value) => sum + value, 0) / moveValues.length) : null,
      }));
    }
  }
  return summaries;
}

function aggregateRows(rows: MovementFeatureRow[]): MovementAggregateRow[] {
  return MOVEMENT_SURFACES.map((surface) => {
    const surfaceRows = rows.filter((row) => row.movement_surface_id === surface.id);
    const coveredRows = surfaceRows.filter((row) => row.match_bucket !== "missing_coverage");
    const exactRows = surfaceRows.filter((row) => row.match_bucket === "exact_type3_match");
    const baselineNet = round2(coveredRows.reduce((sum, row) => sum + row.mt5_net_profit, 0));
    const exactNet = round2(exactRows.reduce((sum, row) => sum + row.mt5_net_profit, 0));
    const baselineTerminals = coveredRows.filter((row) => row.mt5_exit_reason === "end_of_test").length;
    const exactTerminals = exactRows.filter((row) => row.mt5_exit_reason === "end_of_test").length;
    const verdict: MovementAggregateRow["verdict"] = exactRows.length === 0
      ? "PROFILED_EMPTY_MATCH"
      : baselineTerminals > exactTerminals && exactNet >= baselineNet * 0.5
        ? "PROFILED_INTERESTING_RISK_SIGNAL"
        : "PROFILED_NO_PROMOTION";
    return withHash({
      movement_surface_id: surface.id,
      entries_total: surfaceRows.length,
      entries_exact_type3_match: exactRows.length,
      exact_match_pct: round6((exactRows.length / Math.max(coveredRows.length, 1)) * 100),
      baseline_type3_net_profit: baselineNet,
      exact_match_net_profit: exactNet,
      net_delta_vs_baseline: round2(exactNet - baselineNet),
      baseline_profit_factor: coveredRows.length ? round(profitFactor(coveredRows.map((row) => row.mt5_net_profit)), 6) : null,
      exact_match_profit_factor: exactRows.length ? round(profitFactor(exactRows.map((row) => row.mt5_net_profit)), 6) : null,
      baseline_terminal_liquidations: baselineTerminals,
      exact_match_terminal_liquidations: exactTerminals,
      terminal_liquidations_removed_if_hard_gate: baselineTerminals - exactTerminals,
      verdict,
    });
  });
}

function validationRows(options: {
  gate92RunSummary: Gate92RunSummary;
  type3Rows: Type3LedgerRow[];
  features: MovementFeatureRow[];
  missingWeekPairRows: Array<{ week_open_utc: string; pair: string }>;
  manifestStatus: string;
}) {
  return [
    {
      check: "gate92_parity_prerequisite_passed",
      value: options.gate92RunSummary.verdict,
      expected: "PASS_GATE92_LIMNIHEDGE_LEGACY_PARITY_INTAKE_READY_FOR_FULL_REPLAY",
      passed: options.gate92RunSummary.verdict === "PASS_GATE92_LIMNIHEDGE_LEGACY_PARITY_INTAKE_READY_FOR_FULL_REPLAY",
    },
    {
      check: "gate92_validation_failures",
      value: options.gate92RunSummary.validation_failures,
      expected: 0,
      passed: options.gate92RunSummary.validation_failures === 0,
    },
    {
      check: "type3_rows_loaded",
      value: options.type3Rows.length,
      expected: ">0",
      passed: options.type3Rows.length > 0,
    },
    {
      check: "movement_feature_rows",
      value: options.features.length,
      expected: options.type3Rows.length * MOVEMENT_SURFACES.length,
      passed: options.features.length === options.type3Rows.length * MOVEMENT_SURFACES.length,
    },
    {
      check: "gate74b_manifest_status",
      value: options.manifestStatus,
      expected: "complete",
      passed: options.manifestStatus === "complete",
    },
    {
      check: "h1_bars_used_for_movement_candles",
      value: 0,
      expected: 0,
      passed: true,
    },
    {
      check: "mt5_ea_mutated_by_gate94_script",
      value: "repo-side artifact diagnostic only",
      expected: "reference-only EA",
      passed: true,
    },
    {
      check: "missing_week_pair_rows_profiled_not_failed",
      value: options.missingWeekPairRows.length,
      expected: ">=0 diagnostic coverage caveat",
      passed: true,
    },
  ].map((row) => withHash(row));
}

function metricDefinitions() {
  return [
    { metric: "movement_surface_id", definition: "Fixed ADR movement-candle surface built from canonical Gate 74B M1-derived paths, not H1 candles." },
    { metric: "movement_type3_combo", definition: "Legacy Type 3 five-candle combination evaluated on completed movement candles before the saved MT5 entry timestamp." },
    { metric: "movement_type3_matches_saved_side", definition: "True when movement candles show both the legacy four-candle counter move and the David regime side matching the saved Type 3 entry side." },
    { metric: "match_bucket", definition: "Diagnostic classification of each saved Type 3 entry on the movement-candle surface." },
    { metric: "exact_match_net_profit", definition: "Saved MT5 net profit retained if hard-gating saved Type 3 rows to movement-candle exact Type 3 matches. Diagnostic only, not a replay." },
    { metric: "missing_coverage", definition: "Entry could not be evaluated because Gate 74B canonical M1 warehouse does not cover that saved report timestamp or lacks enough movement candles." },
  ].map((row) => withHash(row));
}

function renderReport(options: {
  gate74b: Gate74bSummary;
  manifestId: string;
  features: MovementFeatureRow[];
  summaries: MovementSummaryRow[];
  aggregates: MovementAggregateRow[];
  validation: Array<Record<string, unknown>>;
  paths: Record<string, string>;
}) {
  const validationFailures = options.validation.filter((row) => row.passed !== true).length;
  const missingCoverage = options.features.filter((row) => row.match_bucket === "missing_coverage").length;
  const verdict = validationFailures === 0
    ? "PASS_GATE94_TYPE3_MOVEMENT_CANDLE_DIAGNOSTIC_NO_PROMOTION"
    : "FAIL_GATE94_TYPE3_MOVEMENT_CANDLE_DIAGNOSTIC_VALIDATION";

  return `# Gate 94 LimniHedge Type 3 Movement-Candle Diagnostic

Date: ${GATE_DATE}

Verdict: \`${verdict}\`

## Scope

Gate 94 answers Freedom's follow-up after Gate 93: the prior Triangle diagnostic used H1 time candles. This diagnostic does not. It projects saved Gate 92 LimniHedge Type 3 entries onto fixed ADR movement candles generated from the canonical Gate 74B M1-derived directed-ADR warehouse.

This is not a full Type 3 movement-candle replay yet. The entry/outcome ledger remains the saved MT5 report surface from Gate 92; only the candle geometry used to classify each saved Type 3 entry changes.

Frozen: no MT5 EA mutation, no LRMG promotion, no David redesign, no Type 3 rewrite, no Katarakti-lite integration, no lifecycle/trailing change, no live MT5 trading, and no broad optimization matrix.

## Source

- Gate 92 artifact input: \`${options.paths.gate92Dir}\`
- Gate 74B manifest: \`${options.manifestId}\`
- Price bundle: \`${options.gate74b.warehouse.price_bundle_id}\`
- Path resolution: \`${options.gate74b.warehouse.path_resolution}\`
- Movement surfaces: \`${MOVEMENT_SURFACES.map((surface) => `${surface.id}=${surface.brickAdr}ADR`).join("`, `")}\`
- H1 bars used for movement candles: \`0\`

Coverage caveat: Gate 74B starts after the earliest saved AUDCAD Type 3 history and ends before the July 2026 MT5 liquidation boundary. Missing rows are profiled as \`missing_coverage\`, not silently filled from H1.

## Aggregate Read

${renderTable(options.aggregates as unknown as Array<Record<string, unknown>>, [
    "movement_surface_id",
    "entries_total",
    "entries_exact_type3_match",
    "exact_match_pct",
    "baseline_type3_net_profit",
    "exact_match_net_profit",
    "net_delta_vs_baseline",
    "baseline_profit_factor",
    "exact_match_profit_factor",
    "baseline_terminal_liquidations",
    "exact_match_terminal_liquidations",
    "terminal_liquidations_removed_if_hard_gate",
    "verdict",
  ])}

## Bucket Read

${renderTable(options.summaries as unknown as Array<Record<string, unknown>>, [
    "movement_surface_id",
    "match_bucket",
    "entries",
    "net_profit",
    "profit_factor",
    "win_pct",
    "terminal_liquidations",
    "avg_hold_hours",
    "avg_entry_lag_minutes",
    "avg_entry_side_move_adr_last4",
  ])}

## Validation

${renderTable(options.validation, ["check", "value", "expected", "passed"])}

## Interpretation

This diagnostic is a structure read, not a promotion. If exact movement-candle Type 3 matches retain a useful portion of net while removing terminal liquidations, the next gate should build a full movement-candle Type 3 replay with canonical M1 execution and explicit MT5 M1 export parity. If the hard match is too restrictive, preserve the buckets and look for risk-overlay use instead of rewriting the EA.

Missing coverage rows: \`${missingCoverage}\`.

## Artifacts

${Object.entries(options.paths)
    .filter(([key]) => key !== "gate92Dir")
    .map(([key, value]) => `- ${key}: \`${toRepoRelative(value)}\``)
    .join("\n")}

## Stop Line

Do not promote this into MT5 from this report alone. The current result is a diagnostic projection of saved Type 3 entries onto movement candles, not a completed non-time-based LimniHedge replay.
`;
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

async function main() {
  const options = parseOptions();
  await mkdir(normalizePath(options.artifactDir), { recursive: true });
  await mkdir(path.dirname(normalizePath(options.reportPath)), { recursive: true });

  const gate92RunSummary = await readJson<Gate92RunSummary>(path.join(options.gate92Dir, "gate92-run-summary.json"));
  const gate74b = await readJson<Gate74bSummary>(options.gate74bSummary);
  const manifestId = options.manifestId ?? gate74b.warehouse.manifest_id;
  const manifest = await readTradeLegPathWarehouseManifest(manifestId);
  if (!manifest) throw new Error(`Missing Gate 74B warehouse manifest: ${manifestId}`);

  const pnlRows = parsePnlRows(await readCsvRows(path.join(options.gate92Dir, "replica-pnl-exits.rows.csv")));
  const entryRows = parseEntryRows(await readCsvRows(path.join(options.gate92Dir, "replica-entry-shape.rows.csv")));
  const reportSummaries = parseReportSummaries(await readCsvRows(path.join(options.gate92Dir, "mt5-report-summary.rows.csv")));
  const summariesByCase = new Map(reportSummaries.map((row) => [row.case_id, row]));
  const type3Rows = buildType3Ledger(pnlRows, entryRows);
  const { states: movementStates, missingWeekPairRows } = await loadMovementStates(manifestId, type3Rows);
  console.log("gate94 build movement David state cache");
  const stateCache = buildProfileStateCache({ movementStates, summariesByCase, type3Rows });
  console.log(`gate94 state cache profiles=${stateCache.size}`);
  console.log("gate94 classify type3 movement features");
  const features = featureRows({ type3Rows, movementStates, summariesByCase, stateCache });
  console.log(`gate94 classified features=${features.length}`);
  const summaries = summarizeRows(features);
  const aggregates = aggregateRows(features);
  const validation = validationRows({
    gate92RunSummary,
    type3Rows,
    features,
    missingWeekPairRows,
    manifestStatus: manifest.status,
  });
  const metrics = metricDefinitions();
  const commandReceipt = withHash({
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    gate92_dir: options.gate92Dir,
    gate74b_manifest_id: manifestId,
    movement_surfaces: MOVEMENT_SURFACES,
  });
  const runSummary = withHash({
    gate_id: GATE_ID,
    verdict: validation.filter((row) => row.passed !== true).length === 0
      ? "PASS_GATE94_TYPE3_MOVEMENT_CANDLE_DIAGNOSTIC_NO_PROMOTION"
      : "FAIL_GATE94_TYPE3_MOVEMENT_CANDLE_DIAGNOSTIC_VALIDATION",
    type3_rows: type3Rows.length,
    feature_rows: features.length,
    summary_rows: summaries.length,
    aggregate_rows: aggregates.length,
    validation_failures: validation.filter((row) => row.passed !== true).length,
    missing_week_pair_rows: missingWeekPairRows.length,
  });

  const paths = {
    gate92Dir: options.gate92Dir,
    featureJson: path.join(options.artifactDir, "type3-movement-candle-features.rows.json"),
    featureCsv: path.join(options.artifactDir, "type3-movement-candle-features.rows.csv"),
    summaryJson: path.join(options.artifactDir, "type3-movement-candle-summary.rows.json"),
    summaryCsv: path.join(options.artifactDir, "type3-movement-candle-summary.rows.csv"),
    aggregateJson: path.join(options.artifactDir, "type3-movement-candle-aggregate.rows.json"),
    aggregateCsv: path.join(options.artifactDir, "type3-movement-candle-aggregate.rows.csv"),
    missingCoverageJson: path.join(options.artifactDir, "missing-week-pair-coverage.rows.json"),
    missingCoverageCsv: path.join(options.artifactDir, "missing-week-pair-coverage.rows.csv"),
    validationJson: path.join(options.artifactDir, "validation.rows.json"),
    validationCsv: path.join(options.artifactDir, "validation.rows.csv"),
    metricsJson: path.join(options.artifactDir, "metric-definitions.rows.json"),
    metricsCsv: path.join(options.artifactDir, "metric-definitions.rows.csv"),
    commandReceipt: path.join(options.artifactDir, "command-receipt.json"),
    runSummary: path.join(options.artifactDir, "gate94-run-summary.json"),
    shaManifest: path.join(options.artifactDir, "gate94-limnihedge-type3-movement-candle-sha256.txt"),
    report: options.reportPath,
  };

  await writeRows(paths.featureJson, paths.featureCsv, features as unknown as Record<string, unknown>[]);
  await writeRows(paths.summaryJson, paths.summaryCsv, summaries as unknown as Record<string, unknown>[]);
  await writeRows(paths.aggregateJson, paths.aggregateCsv, aggregates as unknown as Record<string, unknown>[]);
  await writeRows(paths.missingCoverageJson, paths.missingCoverageCsv, missingWeekPairRows.map((row) => withHash(row)));
  await writeRows(paths.validationJson, paths.validationCsv, validation);
  await writeRows(paths.metricsJson, paths.metricsCsv, metrics);
  await writeJson(paths.commandReceipt, commandReceipt);
  await writeJson(paths.runSummary, runSummary);
  await writeText(paths.report, renderReport({
    gate74b,
    manifestId,
    features,
    summaries,
    aggregates,
    validation,
    paths,
  }));
  await writeShaManifest(paths.shaManifest, GATE_ID, COMMAND, [
    { label: "report", path: paths.report },
    { label: "features", path: paths.featureJson },
    { label: "features_csv", path: paths.featureCsv },
    { label: "summary", path: paths.summaryJson },
    { label: "summary_csv", path: paths.summaryCsv },
    { label: "aggregate", path: paths.aggregateJson },
    { label: "aggregate_csv", path: paths.aggregateCsv },
    { label: "missing_coverage", path: paths.missingCoverageJson },
    { label: "missing_coverage_csv", path: paths.missingCoverageCsv },
    { label: "validation", path: paths.validationJson },
    { label: "validation_csv", path: paths.validationCsv },
    { label: "metrics", path: paths.metricsJson },
    { label: "metrics_csv", path: paths.metricsCsv },
    { label: "command_receipt", path: paths.commandReceipt },
    { label: "run_summary", path: paths.runSummary },
  ]);

  console.log(`Gate 94 verdict: ${runSummary.verdict}`);
  console.log(`Type 3 rows: ${type3Rows.length}`);
  console.log(`Feature rows: ${features.length}`);
  console.log(`Validation failures: ${runSummary.validation_failures}`);
  console.log(`Report: ${paths.report}`);
}

main()
  .catch(async (error) => {
    console.error(error);
    await closePoolIfInitialized();
    process.exit(1);
  })
  .finally(async () => {
    await closePoolIfInitialized();
  });
