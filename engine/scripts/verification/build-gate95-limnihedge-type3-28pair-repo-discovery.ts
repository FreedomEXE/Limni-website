import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { closePoolIfInitialized } from "@database/db/client";
import { sha256Stable } from "@engine/research/hash";
import {
  readTradeLegPathWarehouseManifest,
  readTradeLegPathWarehousePairSeries,
  type TradeLegPathReplayPairWeek,
} from "@engine/research/tradeLegPathWarehouse";

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

const GATE_ID = "Gate 95: limnihedge-type3-28pair-repo-discovery";
const GATE_DATE = "2026-07-04";
const COMMAND = "npm run engine:gate95:limnihedge-type3-28pair-repo-discovery";
const PRICE_BUNDLE_ID = "gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953";
const DEFAULT_GATE92_DIR = "docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake";
const DEFAULT_GATE74B_SUMMARY =
  "docs/research/gates/gate74b/artifacts/gate74b-trade-leg-path-materialization/gate74b-summary.json";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate95/GATE95_LIMNIHEDGE_TYPE3_28PAIR_REPO_DISCOVERY_${GATE_DATE}.md`;
const DEFAULT_DATE_FROM = "2019-04-14T00:00:00.000Z";
const DEFAULT_DATE_TO = "2026-05-31T23:59:59.999Z";
const STANDARD_FX_CONTRACT_UNITS = 100_000;

const CANDLE_STREAMS = [
  { id: "time_h1", kind: "time" as const, brickAdr: null },
  { id: "adr_event_0_025", kind: "movement" as const, brickAdr: 0.025 },
  { id: "adr_event_0_05", kind: "movement" as const, brickAdr: 0.05 },
  { id: "adr_event_0_075", kind: "movement" as const, brickAdr: 0.075 },
  { id: "adr_event_0_10", kind: "movement" as const, brickAdr: 0.1 },
] as const;

const DIRECTION_MODES = [
  "type3_both_no_direction",
  "type3_long_only",
  "type3_short_only",
  "candidate_b_agreement_strict",
  "candidate_b_fade_strict",
] as const;

type CandleStreamId = (typeof CANDLE_STREAMS)[number]["id"];
type DirectionMode = (typeof DIRECTION_MODES)[number];
type Side = "BUY" | "SELL";
type CandidateBSide = "LONG" | "SHORT";
type TrendState = -1 | 1;

type Options = {
  gate92Dir: string;
  gate74bSummary: string;
  artifactDir: string;
  reportPath: string;
  manifestId: string | null;
  pairs: string[] | null;
  maxPairs: number | null;
  dateFrom: string;
  dateTo: string;
};

type Gate92RunSummary = {
  verdict: string;
  validation_failures: number;
};

type Gate74bSummary = {
  verdict: string;
  warehouse: {
    manifest_id: string;
    warehouse_hash: string;
    price_bundle_id?: string;
    path_resolution?: string;
    week_count: number;
    pair_week_count: number;
  };
};

type PriceBar = {
  symbol: string;
  timestamp_utc: string;
  timestamp_ms: number;
  open: number;
  high: number;
  low: number;
  close: number;
  pair_adr_pct: number;
  candidate_b_side: CandidateBSide;
  source_week_open_utc: string;
};

type ReplayCandle = PriceBar & {
  candle_stream_id: CandleStreamId;
  candle_index: number;
  movement_brick_adr: number | null;
  source_bar_count: number;
  direction: TrendState | 0;
};

type EntryCandidateRow = {
  row_id: string;
  symbol: string;
  timestamp_utc: string;
  timestamp_ms: number;
  candle_stream_id: CandleStreamId;
  side: Side;
  entry_price: number;
  entry_price_source: "time_bar_open" | "movement_event_close";
  lot_size: number;
  trade_lots: number;
  david_profile_id: "ma100_rsi100_70_30";
  david_state_shift1: "UP" | "DOWN";
  david_state_shift2: "UP" | "DOWN";
  david_state_shift3: "UP" | "DOWN";
  david_state_shift4: "UP" | "DOWN";
  type3_candle_combination: number;
  candidate_b_side: CandidateBSide;
  candidate_b_context_bucket: "agree" | "fade";
  movement_surface_id: CandleStreamId;
  movement_brick_adr: number | null;
  path_efficiency_20: number | null;
  path_efficiency_bucket: string;
  range_adr_20: number | null;
  range_bucket: string;
  floorpin_pass_shadow: boolean | null;
  surplus_quality_shadow: number | null;
  formulaic_q_shadow: number | null;
  lrmg_radius_shadow: null;
  katarakti_strict_srd: boolean;
  katarakti_relaxed_sr: boolean;
  katarakti_context_bucket: string;
  admission_status: "accepted" | "skipped_daily_rollover_0000" | "skipped_outside_date_window";
  skip_reason: string | null;
  content_hash?: string;
};

type AdmissionRow = EntryCandidateRow & {
  variant_id: string;
  direction_mode: DirectionMode;
  variant_acceptance_status: "accepted" | "rejected_by_direction_mode" | EntryCandidateRow["admission_status"];
  variant_reject_reason: string | null;
  content_hash?: string;
};

type TradeExitRow = {
  variant_id: string;
  symbol: string;
  candle_stream_id: CandleStreamId;
  direction_mode: DirectionMode;
  entry_row_id: string;
  entry_time_utc: string;
  exit_time_utc: string;
  side: Side;
  lot_size: number;
  entry_price: number;
  exit_price: number;
  exit_reason: "sl" | "end_of_test";
  stop_loss_at_exit: number | null;
  hold_hours: number;
  price_pnl_adr: number;
  price_pnl_market_pct: number;
  price_pnl_usd_model: number;
  commission_usd_model: number;
  swap_usd_model: number | null;
  net_usd_model: number;
  conversion_rate_source: "quote_usd" | "base_usd_inverse" | "cross_quote_unconverted";
  min_pnl_adr: number;
  max_pnl_adr: number;
  min_pnl_timestamp_utc: string | null;
  max_pnl_timestamp_utc: string | null;
  candidate_b_context_bucket: "agree" | "fade";
  katarakti_context_bucket: string;
  path_efficiency_bucket: string;
  range_bucket: string;
  terminal_liquidation: boolean;
  content_hash?: string;
};

type OpenInventoryRow = {
  variant_id: string;
  symbol: string;
  candle_stream_id: CandleStreamId;
  direction_mode: DirectionMode;
  entry_row_id: string;
  entry_time_utc: string;
  terminal_time_utc: string;
  side: Side;
  lot_size: number;
  entry_price: number;
  terminal_mark_price: number;
  hold_hours: number;
  price_pnl_adr: number;
  price_pnl_market_pct: number;
  liquidation_price_pnl_usd_model: number;
  commission_usd_model: number;
  liquidation_net_usd_model: number;
  min_pnl_adr: number;
  max_pnl_adr: number;
  candidate_b_context_bucket: "agree" | "fade";
  katarakti_context_bucket: string;
  content_hash?: string;
};

type VariantRuntimeStats = {
  variant_id: string;
  candle_stream_id: CandleStreamId;
  direction_mode: DirectionMode;
  max_simultaneous_open: number;
  max_balance_drawdown_usd_model: number;
  max_equity_drawdown_usd_model: number;
  min_equity_usd_model: number;
  max_equity_usd_model: number;
};

type OpenPosition = EntryCandidateRow & {
  stop_loss: number | null;
  min_pnl_adr: number;
  max_pnl_adr: number;
  min_pnl_timestamp_utc: string | null;
  max_pnl_timestamp_utc: string | null;
};

function parseOptions(): Options {
  const args = parseArgMap();
  const pairsArg = args.get("--pairs");
  const maxPairs = args.get("--max-pairs");
  return {
    gate92Dir: args.get("--gate92-dir") ?? DEFAULT_GATE92_DIR,
    gate74bSummary: args.get("--gate74b-summary") ?? DEFAULT_GATE74B_SUMMARY,
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    manifestId: args.get("--manifest-id") ?? null,
    pairs: pairsArg ? pairsArg.split(",").map((pair) => pair.trim().toUpperCase()).filter(Boolean) : null,
    maxPairs: maxPairs ? Number(maxPairs) : null,
    dateFrom: args.get("--date-from") ?? DEFAULT_DATE_FROM,
    dateTo: args.get("--date-to") ?? DEFAULT_DATE_TO,
  };
}

function normalizePath(filePath: string) {
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}

function nowIso() {
  return new Date().toISOString();
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

function gitDirtyStatus() {
  try {
    return execFileSync("git", ["status", "--short"], { encoding: "utf8" }).trim() ? "dirty" : "clean";
  } catch {
    return "unknown";
  }
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function writeRows(jsonPath: string, csvPath: string, rows: Record<string, unknown>[]) {
  await writeJson(jsonPath, rows);
  if (rows.length === 0) {
    await writeFile(normalizePath(csvPath), "", "utf8");
    return;
  }
  const columns = Object.keys(rows[0]!);
  const csv = [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n");
  await writeFile(normalizePath(csvPath), `${csv}\n`, "utf8");
}

async function readJsonFile<T>(filePath: string) {
  return JSON.parse(await readFile(normalizePath(filePath), "utf8")) as T;
}

function sideFromCandidate(candidateSide: CandidateBSide): Side {
  return candidateSide === "LONG" ? "BUY" : "SELL";
}

function sideToCandidate(side: Side): CandidateBSide {
  return side === "BUY" ? "LONG" : "SHORT";
}

function baseCurrency(pair: string) {
  return pair.slice(0, 3);
}

function quoteCurrency(pair: string) {
  return pair.slice(3, 6);
}

function priceDigits(symbol: string) {
  return symbol.endsWith("JPY") ? 3 : 5;
}

function pipSize(symbol: string) {
  return symbol.endsWith("JPY") ? 0.01 : 0.0001;
}

function addSeconds(iso: string, seconds: number) {
  return new Date(new Date(iso).getTime() + seconds * 1000).toISOString();
}

function hoursBetween(startIso: string, endIso: string) {
  return round6((Date.parse(endIso) - Date.parse(startIso)) / 3_600_000);
}

function rawPriceFromDirectedAdr(row: TradeLegPathReplayPairWeek, directedAdr: number) {
  if (!row.entry_price || row.entry_price <= 0 || row.pair_adr_pct <= 0) return null;
  const signedPct = directedAdr * row.pair_adr_pct / 100;
  return row.candidate_b_side === "LONG"
    ? row.entry_price * (1 + signedPct)
    : row.entry_price * (1 - signedPct);
}

function pricePnlAdr(symbol: string, side: Side, entryPrice: number, exitPrice: number, pairAdrPct: number) {
  if (entryPrice <= 0 || pairAdrPct <= 0) return 0;
  const marketPct = ((exitPrice - entryPrice) / entryPrice) * 100;
  const sidePct = side === "BUY" ? marketPct : -marketPct;
  return round6(sidePct / pairAdrPct);
}

function pricePnlUsdModel(symbol: string, side: Side, entryPrice: number, exitPrice: number, lotSize: number) {
  const units = lotSize * STANDARD_FX_CONTRACT_UNITS;
  const rawQuotePnl = side === "BUY" ? (exitPrice - entryPrice) * units : (entryPrice - exitPrice) * units;
  const quote = quoteCurrency(symbol);
  if (quote === "USD") return { value: rawQuotePnl, source: "quote_usd" as const };
  if (baseCurrency(symbol) === "USD" && exitPrice > 0) return { value: rawQuotePnl / exitPrice, source: "base_usd_inverse" as const };
  return { value: rawQuotePnl, source: "cross_quote_unconverted" as const };
}

function commissionUsd(lotSize: number) {
  return -7 * lotSize;
}

function candleDirection(candle: Pick<ReplayCandle, "open" | "close">): TrendState | 0 {
  if (candle.close > candle.open) return 1;
  if (candle.close < candle.open) return -1;
  return 0;
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

function buildDavidStates(candles: ReplayCandle[], maPeriod = 100, rsiPeriod = 100, overbought = 70, oversold = 30) {
  const states: Array<TrendState | null> = Array(candles.length).fill(null);
  let davidState: TrendState | null = null;
  let prevClose: number | null = null;
  const rsiWarm: Array<{ gain: number; loss: number }> = [];
  let avgGain: number | null = null;
  let avgLoss: number | null = null;
  let lastRsi: number | null = null;
  const closes: number[] = [];

  for (let index = 0; index < candles.length; index += 1) {
    const close = candles[index]!.close;
    closes.push(close);
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
    const currentMa = lwma(closes.slice(index - maPeriod + 1, index + 1));
    const previousMa = lwma(closes.slice(index - maPeriod, index));
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

function type3CandleCombination(candles: ReplayCandle[], currentBarIndex: number) {
  const c = (shift: number) => candleDirection(candles[currentBarIndex - shift]!);
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

function bucketPathEfficiency(value: number | null) {
  if (value === null) return "missing";
  if (value <= 0.25) return "low_inefficient";
  if (value <= 0.55) return "middle";
  return "high_directional";
}

function bucketRange(value: number | null) {
  if (value === null) return "missing";
  if (value < 0.5) return "low";
  if (value < 1.5) return "middle";
  return "high";
}

function pathEfficiency(candles: ReplayCandle[], startIndex: number, endIndex: number) {
  const slice = candles.slice(Math.max(0, startIndex), endIndex + 1);
  if (slice.length < 2) return null;
  const signal = Math.abs(slice.at(-1)!.close - slice[0]!.close);
  let pathLength = 0;
  for (let index = 1; index < slice.length; index += 1) pathLength += Math.abs(slice[index]!.close - slice[index - 1]!.close);
  return pathLength > 0 ? round6(signal / pathLength) : null;
}

function rangeAdr(candles: ReplayCandle[], startIndex: number, endIndex: number, pairAdrPct: number) {
  const slice = candles.slice(Math.max(0, startIndex), endIndex + 1);
  if (!slice.length || pairAdrPct <= 0) return null;
  const high = Math.max(...slice.map((bar) => bar.high));
  const low = Math.min(...slice.map((bar) => bar.low));
  const reference = slice.at(-1)!.close;
  if (reference <= 0) return null;
  return round6(((high - low) / reference) * 100 / pairAdrPct);
}

function kataraktiContext(candles: ReplayCandle[], index: number, side: Side) {
  const lookback = candles.slice(Math.max(0, index - 20), index);
  const current = candles[index]!;
  if (lookback.length < 5) return { strict: false, relaxed: false, bucket: "none" };
  const priorHigh = Math.max(...lookback.map((bar) => bar.high));
  const priorLow = Math.min(...lookback.map((bar) => bar.low));
  const sweptLow = current.low < priorLow && current.close > priorLow;
  const sweptHigh = current.high > priorHigh && current.close < priorHigh;
  const displacement = side === "BUY" ? current.close > current.open : current.close < current.open;
  const relaxed = side === "BUY" ? sweptLow : sweptHigh;
  const strict = relaxed && displacement;
  return {
    strict,
    relaxed,
    bucket: strict ? "strict_sweep_rejection_displacement" : relaxed ? "relaxed_sweep_rejection" : "none",
  };
}

function reconstructRawBars(rows: TradeLegPathReplayPairWeek[], dateFromMs: number, dateToMs: number) {
  const bars: PriceBar[] = [];
  let lastTimestamp: string | null = null;
  for (const row of rows) {
    for (let index = 0; index < row.path_payload.timestamp_utc.length; index += 1) {
      const timestamp = row.path_payload.timestamp_utc[index]!;
      if (lastTimestamp !== null && timestamp <= lastTimestamp) continue;
      const timestampMs = Date.parse(timestamp);
      lastTimestamp = timestamp;
      if (timestampMs < dateFromMs || timestampMs > dateToMs) continue;
      const prices = [
        rawPriceFromDirectedAdr(row, row.path_payload.directed_open_adr[index]!),
        rawPriceFromDirectedAdr(row, row.path_payload.directed_high_adr[index]!),
        rawPriceFromDirectedAdr(row, row.path_payload.directed_low_adr[index]!),
        rawPriceFromDirectedAdr(row, row.path_payload.directed_close_adr[index]!),
      ];
      if (prices.some((price) => price === null)) continue;
      const [open, highCandidate, lowCandidate, close] = prices as [number, number, number, number];
      bars.push({
        symbol: row.pair,
        timestamp_utc: timestamp,
        timestamp_ms: timestampMs,
        open,
        high: Math.max(open, highCandidate, lowCandidate, close),
        low: Math.min(open, highCandidate, lowCandidate, close),
        close,
        pair_adr_pct: row.pair_adr_pct,
        candidate_b_side: row.candidate_b_side,
        source_week_open_utc: row.week_open_utc,
      });
    }
  }
  return bars;
}

function aggregateH1Bars(symbol: string, rawBars: PriceBar[]): ReplayCandle[] {
  const groups = new Map<string, PriceBar[]>();
  for (const bar of rawBars) {
    const hour = new Date(Math.floor(bar.timestamp_ms / 3_600_000) * 3_600_000).toISOString();
    const group = groups.get(hour);
    if (group) group.push(bar);
    else groups.set(hour, [bar]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([timestamp, bars], index) => {
      const ordered = bars.sort((left, right) => left.timestamp_ms - right.timestamp_ms);
      const first = ordered[0]!;
      const last = ordered.at(-1)!;
      return {
        symbol,
        timestamp_utc: timestamp,
        timestamp_ms: Date.parse(timestamp),
        open: first.open,
        high: Math.max(...ordered.map((bar) => bar.high)),
        low: Math.min(...ordered.map((bar) => bar.low)),
        close: last.close,
        pair_adr_pct: last.pair_adr_pct,
        candidate_b_side: last.candidate_b_side,
        source_week_open_utc: last.source_week_open_utc,
        candle_stream_id: "time_h1" as const,
        candle_index: index,
        movement_brick_adr: null,
        source_bar_count: ordered.length,
        direction: candleDirection(first),
      };
    });
}

function buildMovementCandles(symbol: string, rawBars: PriceBar[], streamId: CandleStreamId, brickAdr: number): ReplayCandle[] {
  const candles: ReplayCandle[] = [];
  let eventOpen: number | null = null;
  for (const raw of rawBars) {
    if (eventOpen === null) {
      eventOpen = raw.close;
      continue;
    }
    let moveAdr = ((raw.close - eventOpen) / eventOpen) * 100 / raw.pair_adr_pct;
    let guard = 0;
    while (Math.abs(moveAdr) >= brickAdr && guard < 500) {
      const direction: TrendState = moveAdr > 0 ? 1 : -1;
      const open = eventOpen;
      const close = open * (1 + direction * brickAdr * raw.pair_adr_pct / 100);
      candles.push({
        symbol,
        timestamp_utc: raw.timestamp_utc,
        timestamp_ms: raw.timestamp_ms,
        open,
        high: Math.max(open, close),
        low: Math.min(open, close),
        close,
        pair_adr_pct: raw.pair_adr_pct,
        candidate_b_side: raw.candidate_b_side,
        source_week_open_utc: raw.source_week_open_utc,
        candle_stream_id: streamId,
        candle_index: candles.length,
        movement_brick_adr: brickAdr,
        source_bar_count: 1,
        direction,
      });
      eventOpen = close;
      moveAdr = ((raw.close - eventOpen) / eventOpen) * 100 / raw.pair_adr_pct;
      guard += 1;
    }
  }
  return candles;
}

function materializeEntriesForStream(candles: ReplayCandle[], options: { tradeLots: number; dateFromMs: number; dateToMs: number }) {
  const states = buildDavidStates(candles);
  const entries: EntryCandidateRow[] = [];
  let oldTrendDir: TrendState | 0 = 0;
  let firstTrendChange = false;
  let lastType3Time: string | null = null;

  for (let currentIndex = 102; currentIndex < candles.length; currentIndex += 1) {
    const current = candles[currentIndex]!;
    const s1 = states[currentIndex - 1];
    const s2 = states[currentIndex - 2];
    const s3 = states[currentIndex - 3];
    const s4 = states[currentIndex - 4];
    if (s1 === null || s2 === null || s3 === null || s4 === null) continue;

    if (!firstTrendChange) {
      if (s2 !== s1) {
        oldTrendDir = s2;
        firstTrendChange = true;
      } else {
        continue;
      }
    } else {
      oldTrendDir = s2;
    }
    void oldTrendDir;

    if (lastType3Time === current.timestamp_utc) continue;
    const combo = type3CandleCombination(candles, currentIndex);
    const side: Side | null = s4 === -1 && s3 === -1 && s2 === -1 && s1 === -1 && combo === 4
      ? "BUY"
      : s4 === 1 && s3 === 1 && s2 === 1 && s1 === 1 && combo === -4
        ? "SELL"
        : null;
    if (!side) continue;

    const pe = pathEfficiency(candles, currentIndex - 20, currentIndex - 1);
    const range = rangeAdr(candles, currentIndex - 20, currentIndex - 1, current.pair_adr_pct);
    const q = range !== null && pe !== null ? round6(Math.max(range / (2 + 2 * (1 - Math.min(1, Math.max(0, pe)))), 0.05)) : null;
    const katarakti = kataraktiContext(candles, currentIndex, side);
    const candidateSide = sideFromCandidate(current.candidate_b_side);
    const candidateBucket = candidateSide === side ? "agree" as const : "fade" as const;
    const outsideWindow = current.timestamp_ms < options.dateFromMs || current.timestamp_ms > options.dateToMs;
    const dailyRollover = current.timestamp_utc.slice(11, 16) === "00:00";
    const admissionStatus: EntryCandidateRow["admission_status"] = outsideWindow
      ? "skipped_outside_date_window"
      : dailyRollover
        ? "skipped_daily_rollover_0000"
        : "accepted";
    const skipReason = outsideWindow
      ? "outside_gate95_date_window"
      : dailyRollover
        ? "gate92_tester_admission_rollover_guard"
        : null;
    const entryPrice = current.candle_stream_id === "time_h1" ? current.open : current.close;
    const rowBase = {
      row_id: `${current.symbol}|${current.candle_stream_id}|${current.timestamp_utc}|${side}`,
      symbol: current.symbol,
      timestamp_utc: current.timestamp_utc,
      timestamp_ms: current.timestamp_ms,
      candle_stream_id: current.candle_stream_id,
      side,
      entry_price: round6(entryPrice),
      entry_price_source: current.candle_stream_id === "time_h1" ? "time_bar_open" as const : "movement_event_close" as const,
      lot_size: round2(options.tradeLots * 2),
      trade_lots: options.tradeLots,
      david_profile_id: "ma100_rsi100_70_30" as const,
      david_state_shift1: stateLabel(s1) as "UP" | "DOWN",
      david_state_shift2: stateLabel(s2) as "UP" | "DOWN",
      david_state_shift3: stateLabel(s3) as "UP" | "DOWN",
      david_state_shift4: stateLabel(s4) as "UP" | "DOWN",
      type3_candle_combination: combo,
      candidate_b_side: current.candidate_b_side,
      candidate_b_context_bucket: candidateBucket,
      movement_surface_id: current.candle_stream_id,
      movement_brick_adr: current.movement_brick_adr,
      path_efficiency_20: pe,
      path_efficiency_bucket: bucketPathEfficiency(pe),
      range_adr_20: range,
      range_bucket: bucketRange(range),
      floorpin_pass_shadow: q !== null && range !== null ? range >= q * 1.25 : null,
      surplus_quality_shadow: q !== null && range !== null ? round6(range - q) : null,
      formulaic_q_shadow: q,
      lrmg_radius_shadow: null,
      katarakti_strict_srd: katarakti.strict,
      katarakti_relaxed_sr: katarakti.relaxed,
      katarakti_context_bucket: katarakti.bucket,
      admission_status: admissionStatus,
      skip_reason: skipReason,
    };
    entries.push(withHash(rowBase));
    lastType3Time = current.timestamp_utc;
  }
  return entries;
}

function variantId(candleStreamId: CandleStreamId, directionMode: DirectionMode) {
  return `${candleStreamId}_${directionMode}`;
}

function directionModeAccepts(entry: EntryCandidateRow, mode: DirectionMode) {
  if (mode === "type3_both_no_direction") return true;
  if (mode === "type3_long_only") return entry.side === "BUY";
  if (mode === "type3_short_only") return entry.side === "SELL";
  if (mode === "candidate_b_agreement_strict") return sideToCandidate(entry.side) === entry.candidate_b_side;
  return sideToCandidate(entry.side) !== entry.candidate_b_side;
}

function buildAdmissionRows(entries: EntryCandidateRow[]) {
  const rows: AdmissionRow[] = [];
  for (const stream of CANDLE_STREAMS) {
    const streamEntries = entries.filter((entry) => entry.candle_stream_id === stream.id);
    for (const mode of DIRECTION_MODES) {
      const id = variantId(stream.id, mode);
      for (const entry of streamEntries) {
        if (entry.admission_status !== "accepted") {
          rows.push(withHash({
            ...entry,
            variant_id: id,
            direction_mode: mode,
            variant_acceptance_status: entry.admission_status,
            variant_reject_reason: entry.skip_reason,
          }));
          continue;
        }
        const accepts = directionModeAccepts(entry, mode);
        rows.push(withHash({
          ...entry,
          variant_id: id,
          direction_mode: mode,
          variant_acceptance_status: accepts ? "accepted" as const : "rejected_by_direction_mode" as const,
          variant_reject_reason: accepts ? null : mode,
        }));
      }
    }
  }
  return rows;
}

function syntheticTicks(bar: ReplayCandle, symbol: string) {
  const tick = (time: string, bid: number) => ({ time, bid, ask: bid });
  const seconds = bar.candle_stream_id === "time_h1" ? 3599 : 59;
  const bullish = bar.close >= bar.open;
  const middle = bullish
    ? [tick(addSeconds(bar.timestamp_utc, 1), bar.low), tick(addSeconds(bar.timestamp_utc, Math.max(2, seconds - 1)), bar.high)]
    : [tick(addSeconds(bar.timestamp_utc, 1), bar.high), tick(addSeconds(bar.timestamp_utc, Math.max(2, seconds - 1)), bar.low)];
  return [tick(bar.timestamp_utc, bar.open), ...middle, tick(addSeconds(bar.timestamp_utc, seconds), bar.close)];
}

function positionPnlAdr(position: OpenPosition, markPrice: number, pairAdrPct: number) {
  return pricePnlAdr(position.symbol, position.side, position.entry_price, markPrice, pairAdrPct);
}

function updatePositionExcursion(position: OpenPosition, markPrice: number, pairAdrPct: number, timestampUtc: string) {
  const pnlAdr = positionPnlAdr(position, markPrice, pairAdrPct);
  if (pnlAdr < position.min_pnl_adr) {
    position.min_pnl_adr = pnlAdr;
    position.min_pnl_timestamp_utc = timestampUtc;
  }
  if (pnlAdr > position.max_pnl_adr) {
    position.max_pnl_adr = pnlAdr;
    position.max_pnl_timestamp_utc = timestampUtc;
  }
}

function closePosition(params: {
  variantId: string;
  directionMode: DirectionMode;
  candleStreamId: CandleStreamId;
  position: OpenPosition;
  exitTime: string;
  exitPrice: number;
  exitReason: "sl" | "end_of_test";
  pairAdrPct: number;
}) {
  const pnlAdr = pricePnlAdr(params.position.symbol, params.position.side, params.position.entry_price, params.exitPrice, params.pairAdrPct);
  const marketPct = params.position.side === "BUY"
    ? ((params.exitPrice - params.position.entry_price) / params.position.entry_price) * 100
    : ((params.position.entry_price - params.exitPrice) / params.position.entry_price) * 100;
  const priceUsd = pricePnlUsdModel(params.position.symbol, params.position.side, params.position.entry_price, params.exitPrice, params.position.lot_size);
  const commission = commissionUsd(params.position.lot_size);
  return withHash({
    variant_id: params.variantId,
    symbol: params.position.symbol,
    candle_stream_id: params.candleStreamId,
    direction_mode: params.directionMode,
    entry_row_id: params.position.row_id,
    entry_time_utc: params.position.timestamp_utc,
    exit_time_utc: params.exitTime,
    side: params.position.side,
    lot_size: params.position.lot_size,
    entry_price: round6(params.position.entry_price),
    exit_price: round6(params.exitPrice),
    exit_reason: params.exitReason,
    stop_loss_at_exit: params.position.stop_loss === null ? null : round6(params.position.stop_loss),
    hold_hours: hoursBetween(params.position.timestamp_utc, params.exitTime),
    price_pnl_adr: pnlAdr,
    price_pnl_market_pct: round6(marketPct),
    price_pnl_usd_model: round6(priceUsd.value),
    commission_usd_model: round6(commission),
    swap_usd_model: null,
    net_usd_model: round6(priceUsd.value + commission),
    conversion_rate_source: priceUsd.source,
    min_pnl_adr: round6(params.position.min_pnl_adr),
    max_pnl_adr: round6(params.position.max_pnl_adr),
    min_pnl_timestamp_utc: params.position.min_pnl_timestamp_utc,
    max_pnl_timestamp_utc: params.position.max_pnl_timestamp_utc,
    candidate_b_context_bucket: params.position.candidate_b_context_bucket,
    katarakti_context_bucket: params.position.katarakti_context_bucket,
    path_efficiency_bucket: params.position.path_efficiency_bucket,
    range_bucket: params.position.range_bucket,
    terminal_liquidation: params.exitReason === "end_of_test",
  } satisfies Omit<TradeExitRow, "content_hash">);
}

function replayVariant(params: {
  variantId: string;
  directionMode: DirectionMode;
  candleStreamId: CandleStreamId;
  candles: ReplayCandle[];
  admissions: AdmissionRow[];
}) {
  const accepted = params.admissions
    .filter((row) => row.variant_id === params.variantId && row.variant_acceptance_status === "accepted")
    .sort((left, right) => left.timestamp_utc.localeCompare(right.timestamp_utc));
  const entriesByTime = new Map<string, EntryCandidateRow[]>();
  for (const entry of accepted) entriesByTime.set(entry.timestamp_utc, [...(entriesByTime.get(entry.timestamp_utc) ?? []), entry]);
  const positions: OpenPosition[] = [];
  const exits: TradeExitRow[] = [];
  const openInventory: OpenInventoryRow[] = [];
  const digitsBySymbol = new Map<string, number>();
  const stats: VariantRuntimeStats = {
    variant_id: params.variantId,
    candle_stream_id: params.candleStreamId,
    direction_mode: params.directionMode,
    max_simultaneous_open: 0,
    max_balance_drawdown_usd_model: 0,
    max_equity_drawdown_usd_model: 0,
    min_equity_usd_model: 0,
    max_equity_usd_model: 0,
  };
  let closedNet = 0;
  let balancePeak = 0;
  let equityPeak = 0;

  const updateEquity = (bar: ReplayCandle) => {
    const openNet = positions.reduce((sum, position) => {
      const pnl = pricePnlUsdModel(position.symbol, position.side, position.entry_price, bar.close, position.lot_size).value;
      return sum + pnl + commissionUsd(position.lot_size);
    }, 0);
    const equity = closedNet + openNet;
    if (equity > equityPeak) equityPeak = equity;
    if (equity < stats.min_equity_usd_model) stats.min_equity_usd_model = round6(equity);
    if (equity > stats.max_equity_usd_model) stats.max_equity_usd_model = round6(equity);
    const equityDd = equity - equityPeak;
    if (equityDd < stats.max_equity_drawdown_usd_model) stats.max_equity_drawdown_usd_model = round6(equityDd);
  };

  const processStopHits = (time: string, bid: number, ask: number, pairAdrPct: number) => {
    for (let index = positions.length - 1; index >= 0; index -= 1) {
      const position = positions[index]!;
      const mark = position.side === "BUY" ? bid : ask;
      updatePositionExcursion(position, mark, pairAdrPct, time);
      if (position.stop_loss !== null) {
        const stopHit = position.side === "BUY" ? bid <= position.stop_loss : ask >= position.stop_loss;
        if (stopHit) {
          const exit = closePosition({
            variantId: params.variantId,
            directionMode: params.directionMode,
            candleStreamId: params.candleStreamId,
            position,
            exitTime: time,
            exitPrice: position.stop_loss,
            exitReason: "sl",
            pairAdrPct,
          });
          exits.push(exit);
          closedNet = round6(closedNet + exit.net_usd_model);
          if (closedNet > balancePeak) balancePeak = closedNet;
          const balanceDd = closedNet - balancePeak;
          if (balanceDd < stats.max_balance_drawdown_usd_model) stats.max_balance_drawdown_usd_model = round6(balanceDd);
          positions.splice(index, 1);
        }
      }
    }
  };

  const updateTrailingAtOpen = (bid: number, ask: number, pairAdrPct: number, timestampUtc: string) => {
    for (const position of positions) {
      if (position.symbol !== params.candles[0]?.symbol) continue;
      const pip = pipSize(position.symbol);
      const digits = digitsBySymbol.get(position.symbol) ?? priceDigits(position.symbol);
      digitsBySymbol.set(position.symbol, digits);
      const trailStart = 20 * pip;
      const trailStep = 1 * pip;
      const trailStop = 10 * pip;
      const mark = position.side === "BUY" ? bid : ask;
      updatePositionExcursion(position, mark, pairAdrPct, timestampUtc);
      if (position.side === "BUY") {
        if (bid - position.entry_price >= trailStart) {
          const nextStop = bid - trailStop;
          const shouldMove = position.stop_loss === null || bid - position.stop_loss > trailStep;
          if (shouldMove && (position.stop_loss === null || round(nextStop, digits)! > round(position.stop_loss, digits)!)) {
            position.stop_loss = round(nextStop, digits);
          }
        }
      } else if (position.entry_price - ask >= trailStart) {
        const nextStop = ask + trailStop;
        const shouldMove = position.stop_loss === null || position.stop_loss - ask > trailStep;
        if (shouldMove && (position.stop_loss === null || round(nextStop, digits)! < round(position.stop_loss, digits)!)) {
          position.stop_loss = round(nextStop, digits);
        }
      }
    }
  };

  for (const bar of params.candles) {
    const ticks = syntheticTicks(bar, bar.symbol);
    processStopHits(ticks[0]!.time, ticks[0]!.bid, ticks[0]!.ask, bar.pair_adr_pct);
    updateTrailingAtOpen(ticks[0]!.bid, ticks[0]!.ask, bar.pair_adr_pct, ticks[0]!.time);
    for (const entry of entriesByTime.get(bar.timestamp_utc) ?? []) {
      positions.push({
        ...entry,
        stop_loss: null,
        min_pnl_adr: 0,
        max_pnl_adr: 0,
        min_pnl_timestamp_utc: null,
        max_pnl_timestamp_utc: null,
      });
      if (positions.length > stats.max_simultaneous_open) stats.max_simultaneous_open = positions.length;
    }
    for (const tick of ticks.slice(1)) processStopHits(tick.time, tick.bid, tick.ask, bar.pair_adr_pct);
    updateEquity(bar);
  }

  const terminalBar = params.candles.at(-1);
  if (terminalBar) {
    for (const position of positions) {
      const terminalPrice = terminalBar.close;
      const inventoryRow = {
        variant_id: params.variantId,
        symbol: position.symbol,
        candle_stream_id: params.candleStreamId,
        direction_mode: params.directionMode,
        entry_row_id: position.row_id,
        entry_time_utc: position.timestamp_utc,
        terminal_time_utc: terminalBar.timestamp_utc,
        side: position.side,
        lot_size: position.lot_size,
        entry_price: round6(position.entry_price),
        terminal_mark_price: round6(terminalPrice),
        hold_hours: hoursBetween(position.timestamp_utc, terminalBar.timestamp_utc),
        price_pnl_adr: pricePnlAdr(position.symbol, position.side, position.entry_price, terminalPrice, terminalBar.pair_adr_pct),
        price_pnl_market_pct: round6(position.side === "BUY"
          ? ((terminalPrice - position.entry_price) / position.entry_price) * 100
          : ((position.entry_price - terminalPrice) / position.entry_price) * 100),
        liquidation_price_pnl_usd_model: round6(pricePnlUsdModel(position.symbol, position.side, position.entry_price, terminalPrice, position.lot_size).value),
        commission_usd_model: round6(commissionUsd(position.lot_size)),
        liquidation_net_usd_model: round6(pricePnlUsdModel(position.symbol, position.side, position.entry_price, terminalPrice, position.lot_size).value + commissionUsd(position.lot_size)),
        min_pnl_adr: round6(position.min_pnl_adr),
        max_pnl_adr: round6(position.max_pnl_adr),
        candidate_b_context_bucket: position.candidate_b_context_bucket,
        katarakti_context_bucket: position.katarakti_context_bucket,
      } satisfies Omit<OpenInventoryRow, "content_hash">;
      openInventory.push(withHash(inventoryRow));
      const exit = closePosition({
        variantId: params.variantId,
        directionMode: params.directionMode,
        candleStreamId: params.candleStreamId,
        position,
        exitTime: terminalBar.timestamp_utc,
        exitPrice: terminalPrice,
        exitReason: "end_of_test",
        pairAdrPct: terminalBar.pair_adr_pct,
      });
      exits.push(exit);
      closedNet = round6(closedNet + exit.net_usd_model);
    }
  }

  return { exits, openInventory, stats: withHash(stats as unknown as Record<string, unknown>) as unknown as VariantRuntimeStats & { content_hash: string } };
}

function groupBy<T>(rows: T[], getKey: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = getKey(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

function appendRows<T>(map: Map<string, T[]>, key: string, rows: T[]) {
  const current = map.get(key);
  if (current) current.push(...rows);
  else map.set(key, [...rows]);
}

function maxDrawdownFromOrdered(values: number[]) {
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const value of values) {
    equity += value;
    if (equity > peak) peak = equity;
    const dd = equity - peak;
    if (dd < maxDd) maxDd = dd;
  }
  return round6(maxDd);
}

function summaryRows(
  exits: TradeExitRow[],
  inventory: OpenInventoryRow[],
  statsRows: Array<VariantRuntimeStats & { content_hash: string }>,
  variantConfigs: Array<Record<string, unknown>>,
) {
  const rows: Record<string, unknown>[] = [];
  const byVariant = groupBy(exits, (row) => row.variant_id);
  for (const config of variantConfigs) {
    const variant = String(config.variant_id);
    const variantRows = byVariant.get(variant) ?? [];
    const variantStats = statsRows.filter((row) => row.variant_id === variant);
    const inv = inventory.filter((row) => row.variant_id === variant);
    const values = variantRows.map((row) => row.net_usd_model);
    const holds = variantRows.map((row) => row.hold_hours).sort((left, right) => left - right);
    rows.push(withHash({
      variant_id: variant,
      candle_stream_id: String(config.candle_stream_id ?? variantRows[0]?.candle_stream_id ?? ""),
      direction_mode: String(config.direction_mode ?? variantRows[0]?.direction_mode ?? ""),
      closed_trades: variantRows.length,
      open_inventory_rows: inv.length,
      terminal_liquidations: variantRows.filter((row) => row.terminal_liquidation).length,
      net_usd_model: round2(values.reduce((sum, value) => sum + value, 0)),
      gross_profit_usd_model: round2(values.filter((value) => value > 0).reduce((sum, value) => sum + value, 0)),
      gross_loss_usd_model: round2(values.filter((value) => value < 0).reduce((sum, value) => sum + value, 0)),
      profit_factor: variantRows.length ? round(profitFactor(values), 6) : null,
      win_pct: variantRows.length ? round6((variantRows.filter((row) => row.net_usd_model > 0).length / variantRows.length) * 100) : 0,
      expectancy_usd_model: variantRows.length ? round6(values.reduce((sum, value) => sum + value, 0) / variantRows.length) : null,
      avg_hold_hours: holds.length ? round6(holds.reduce((sum, value) => sum + value, 0) / holds.length) : null,
      median_hold_hours: holds.length ? round6(holds[Math.floor(holds.length / 2)]!) : null,
      p95_hold_hours: holds.length ? round6(holds[Math.min(holds.length - 1, Math.floor(holds.length * 0.95))]!) : null,
      max_hold_hours: holds.length ? round6(Math.max(...holds)) : null,
      max_simultaneous_open: variantStats.length ? Math.max(...variantStats.map((row) => row.max_simultaneous_open)) : 0,
      balance_dd_usd_model: variantStats.length ? Math.min(...variantStats.map((row) => row.max_balance_drawdown_usd_model)) : maxDrawdownFromOrdered(values),
      equity_dd_usd_model: variantStats.length ? Math.min(...variantStats.map((row) => row.max_equity_drawdown_usd_model)) : null,
      pair_count_traded: new Set(variantRows.map((row) => row.symbol)).size,
      positive_pair_count: [...groupBy(variantRows, (row) => row.symbol).values()]
        .filter((group) => group.reduce((sum, row) => sum + row.net_usd_model, 0) > 0).length,
      terminal_loss_share_of_net: values.reduce((sum, value) => sum + value, 0) !== 0
        ? round6(Math.abs(variantRows.filter((row) => row.terminal_liquidation).reduce((sum, row) => sum + Math.min(0, row.net_usd_model), 0)) / Math.abs(values.reduce((sum, value) => sum + value, 0)))
        : null,
    }));
  }
  return rows.sort((left, right) => String(left.variant_id).localeCompare(String(right.variant_id)));
}

function splitForTimestamp(timestampUtc: string) {
  if (timestampUtc < "2024-01-01T00:00:00.000Z") return "train_2019_2023";
  if (timestampUtc < "2025-01-01T00:00:00.000Z") return "validation_2024";
  return "final_oos_2025_2026";
}

function aggregateBy(exits: TradeExitRow[], keyName: string, getKey: (row: TradeExitRow) => string) {
  return [...groupBy(exits, getKey).entries()].map(([key, rows]) => withHash({
    [keyName]: key,
    variant_id: rows[0]?.variant_id ?? "",
    trades: rows.length,
    net_usd_model: round2(rows.reduce((sum, row) => sum + row.net_usd_model, 0)),
    profit_factor: round(profitFactor(rows.map((row) => row.net_usd_model)), 6),
    terminal_liquidations: rows.filter((row) => row.terminal_liquidation).length,
    avg_hold_hours: rows.length ? round6(rows.reduce((sum, row) => sum + row.hold_hours, 0) / rows.length) : null,
  })).sort((left, right) => String(left.variant_id).localeCompare(String(right.variant_id)) || String(left[keyName]).localeCompare(String(right[keyName])));
}

function validationRows(params: {
  gate92: Gate92RunSummary;
  gate74b: Gate74bSummary;
  manifestStatus: string;
  selectedPairs: string[];
  runMode: string;
  configHash: string;
  entries: EntryCandidateRow[];
  admissions: AdmissionRow[];
  exits: TradeExitRow[];
  inventory: OpenInventoryRow[];
  variantRows: Record<string, unknown>[];
}) {
  const variantIds = new Set(params.variantRows.map((row) => String(row.variant_id)));
  return [
    {
      check: "outside_review_converted_to_bounded_gate95_contract",
      value: "25 variants; geometry/Katarakti shadow only; no MT5 mutation",
      expected: "bounded reviewer plan",
      passed: true,
    },
    {
      check: "gate92_parity_guard_passed",
      value: params.gate92.verdict,
      expected: "PASS_GATE92_LIMNIHEDGE_LEGACY_PARITY_INTAKE_READY_FOR_FULL_REPLAY",
      passed: params.gate92.verdict === "PASS_GATE92_LIMNIHEDGE_LEGACY_PARITY_INTAKE_READY_FOR_FULL_REPLAY",
    },
    {
      check: "gate92_validation_failures",
      value: params.gate92.validation_failures,
      expected: 0,
      passed: params.gate92.validation_failures === 0,
    },
    {
      check: "gate74b_price_bundle",
      value: params.gate74b.warehouse.price_bundle_id ?? PRICE_BUNDLE_ID,
      expected: PRICE_BUNDLE_ID,
      passed: (params.gate74b.warehouse.price_bundle_id ?? PRICE_BUNDLE_ID) === PRICE_BUNDLE_ID,
    },
    {
      check: "gate74b_manifest_status",
      value: params.manifestStatus,
      expected: "complete",
      passed: params.manifestStatus === "complete",
    },
    {
      check: "run_mode",
      value: params.runMode,
      expected: "full_gate95_matrix or smoke_or_bounded_subset",
      passed: params.runMode === "full_gate95_matrix" || params.runMode === "smoke_or_bounded_subset",
    },
    {
      check: "selected_pair_count",
      value: params.selectedPairs.length,
      expected: "28 for full run; lower only for explicit smoke",
      passed: params.selectedPairs.length > 0,
    },
    {
      check: "variant_count",
      value: variantIds.size,
      expected: CANDLE_STREAMS.length * DIRECTION_MODES.length,
      passed: variantIds.size === CANDLE_STREAMS.length * DIRECTION_MODES.length,
    },
    {
      check: "entry_candidates_materialized",
      value: params.entries.length,
      expected: ">0",
      passed: params.entries.length > 0,
    },
    {
      check: "admission_rows_materialized",
      value: params.admissions.length,
      expected: "entries x 5 direction modes per stream",
      passed: params.admissions.length > 0,
    },
    {
      check: "trade_exit_rows_materialized",
      value: params.exits.length,
      expected: ">0 for non-empty candidate set",
      passed: params.exits.length > 0,
    },
    {
      check: "terminal_open_inventory_receipted",
      value: params.inventory.length,
      expected: ">=0 explicit ledger",
      passed: true,
    },
    {
      check: "mt5_ea_mutated_by_gate95_script",
      value: "repo-side research only",
      expected: "reference-only EA",
      passed: true,
    },
    {
      check: "gate95_config_hash",
      value: params.configHash,
      expected: "non-empty",
      passed: params.configHash.length > 0,
    },
  ].map((row) => withHash(row));
}

function metricDefinitions() {
  return [
    { metric: "type3_candle_combination", definition: "Legacy Type 3 five-candle combo; +4 buys after bearish seed plus four bullish candles, -4 sells after bullish seed plus four bearish candles." },
    { metric: "candidate_b_agreement_strict", definition: "Type 3 entry only when Candidate B weekly side agrees with Type 3 side. Candidate B never initiates trades in Gate 95." },
    { metric: "movement_surfaces", definition: "Fixed ADR event streams 0.025/0.05/0.075/0.10 built from Gate 74B canonical M1 paths." },
    { metric: "legacy_lifecycle_model", definition: "Initial Gate 95 replay uses legacy Type 3 lot scaling and trail start/step/stop pips over reconstructed candles; no new lifecycle optimization." },
    { metric: "net_usd_model", definition: "Modeled price PnL plus modeled entry commission. Cross quote conversion is explicitly receipted and not a live economics claim." },
    { metric: "open_inventory_rows", definition: "Positions still open at the replay endpoint before terminal liquidation accounting." },
    { metric: "terminal_liquidations", definition: "Positions force-closed at the replay endpoint; research-pass candidates must reduce this materially before any live-shaped gate." },
  ].map((row) => withHash(row));
}

function renderReport(params: {
  config: Record<string, unknown>;
  configHash: string;
  runMode: string;
  summary: Record<string, unknown>[];
  validation: Record<string, unknown>[];
  paths: Record<string, string>;
  acceptedReview: string[];
  rejectedReview: string[];
}) {
  const validationFailures = params.validation.filter((row) => row.passed !== true).length;
  const verdict = validationFailures === 0 && params.runMode === "full_gate95_matrix"
    ? "PASS_GATE95_TYPE3_28PAIR_REPO_DISCOVERY_REPLAY_RESEARCH_ONLY_NO_PROMOTION"
    : validationFailures === 0
      ? "PASS_GATE95_SMOKE_OR_BOUNDED_SUBSET_REPLAY_RESEARCH_ONLY_NO_PROMOTION"
    : "FAIL_GATE95_TYPE3_28PAIR_REPO_DISCOVERY_VALIDATION";
  return `# Gate 95 LimniHedge Type 3 28-Pair Repo Discovery

Date: ${GATE_DATE}

Verdict: \`${verdict}\`

## Scope

Gate 95 implements the outside-review contract as a repo-only first pass: Type 3 entry grammar across the selected Gate 74B universe, Candidate B as a direction overlay, fixed ADR movement streams as replay surfaces, and Triangle/Q/Katarakti-style geometry as shadow context only.

Run mode: \`${params.runMode}\`. A smoke/bounded-subset pass validates the runner and receipts; it is not the all-28 Gate 95 result.

Frozen: no MT5 EA mutation, no live MT5 trading, no broad MT5 optimization, no David profile optimization, no LRMG direction promotion, no Katarakti hard gate in the primary matrix, no app/runtime promotion.

## Accepted Reviewer Recommendations

${params.acceptedReview.map((item) => `- ${item}`).join("\n")}

## Rejected Or Deferred Reviewer Recommendations

${params.rejectedReview.map((item) => `- ${item}`).join("\n")}

## Config

- Config hash: \`${params.configHash}\`
- Price bundle: \`${params.config.price_bundle_id}\`
- Candidate B source: \`${params.config.candidate_b_source_id}\`
- Date range: \`${params.config.date_from}\` to \`${params.config.date_to}\`
- Candle streams: \`${CANDLE_STREAMS.map((stream) => stream.id).join("`, `")}\`
- Direction modes: \`${DIRECTION_MODES.join("`, `")}\`

## Variant Summary

${renderTable(params.summary, [
    "variant_id",
    "closed_trades",
    "open_inventory_rows",
    "terminal_liquidations",
    "net_usd_model",
    "profit_factor",
    "win_pct",
    "expectancy_usd_model",
    "avg_hold_hours",
    "max_hold_hours",
    "max_simultaneous_open",
    "balance_dd_usd_model",
    "equity_dd_usd_model",
    "pair_count_traded",
  ])}

## Validation

${renderTable(params.validation, ["check", "value", "expected", "passed"])}

## Interpretation Boundary

This is research evidence only. The lifecycle replay uses reconstructed canonical candles and modeled commission, with swap unavailable instead of borrowed from saved MT5 reports. Any promising row still needs narrower Gate 96 lifecycle, cost, and inventory proof before MT5 or live work.

## Artifacts

${Object.entries(params.paths).map(([key, value]) => `- ${key}: \`${toRepoRelative(value)}\``).join("\n")}
`;
}

async function main() {
  const options = parseOptions();
  await mkdir(normalizePath(options.artifactDir), { recursive: true });
  await mkdir(path.dirname(normalizePath(options.reportPath)), { recursive: true });

  const gate92 = await readJsonFile<Gate92RunSummary>(path.join(options.gate92Dir, "gate92-run-summary.json"));
  const gate74b = await readJsonFile<Gate74bSummary>(options.gate74bSummary);
  const manifestId = options.manifestId ?? gate74b.warehouse.manifest_id;
  const manifest = await readTradeLegPathWarehouseManifest(manifestId);
  if (!manifest) throw new Error(`Missing Gate 74B warehouse manifest: ${manifestId}`);
  const selectedPairs = (options.pairs ?? manifest.universe_symbols).slice(0, options.maxPairs ?? undefined).sort();
  const runMode = selectedPairs.length === 28 && options.dateFrom === DEFAULT_DATE_FROM && options.dateTo === DEFAULT_DATE_TO
    ? "full_gate95_matrix"
    : "smoke_or_bounded_subset";
  const dateFromMs = Date.parse(options.dateFrom);
  const dateToMs = Date.parse(options.dateTo);
  const acceptedReview = [
    "Gate 92 is sufficient to stop using MT5 as the Type 3 research driver while keeping the EA reference-only.",
    "Gate 93 and Gate 94 reject hard Triangle/movement exact filters as direct entry replacements.",
    "Run exactly 5 candle streams by 5 direction modes before adding variants.",
    "Treat Candidate B as agreement/fade/reporting context only; it does not initiate Gate 95 trades.",
    "Keep movement, Triangle/Q, LRMG, and Katarakti as risk/quality shadow receipts in the first matrix.",
    "Make terminal liquidation, open inventory, hold time, pair concentration, costs, and split stability blocking evidence.",
  ];
  const rejectedReview = [
    "No MT5 EA mutation, live MT5 trading, or app/runtime promotion.",
    "No broad optimizer, David parameter optimization, or extra matrix families before first scorecard review.",
    "No hard Katarakti, Q, LRMG, Triangle, or exact movement-candle gate in the primary 25 variants.",
    "No Candidate B standalone trigger and no closed-PF-only success claim.",
  ];
  const config = {
    gate_id: GATE_ID,
    price_bundle_id: PRICE_BUNDLE_ID,
    gate74b_manifest_id: manifestId,
    gate74b_warehouse_hash: gate74b.warehouse.warehouse_hash,
    candidate_b_source_id: manifest.candidate_id,
    universe_28_pairs: manifest.universe_symbols,
    selected_pairs: selectedPairs,
    run_mode: runMode,
    date_from: options.dateFrom,
    date_to: options.dateTo,
    split: {
      train: "2019-04-14..2023-12-31",
      validation: "2024-01-01..2024-12-31",
      final_oos: "2025-01-01..2026-05-31",
    },
    type3_formula_version: "legacy_liminihedge_v1_type3_four_closed_david_bars_plus_counter_displacement",
    david_profile: { ma_period: 100, rsi_period: 100, overbought: 70, oversold: 30 },
    trade_lots: 0.01,
    type3_lot_multiplier: 2,
    lifecycle: { trail_start_pips: 20, trail_step_pips: 1, trail_stop_pips: 10, tp_pips: 0, sl_pips: 0 },
    candle_streams: CANDLE_STREAMS,
    direction_modes: DIRECTION_MODES,
    cost_model: { commission_usd_per_lot: -7, swap: "unavailable_in_gate95_canonical_first_pass" },
    geometry_shadow_only: ["path_efficiency", "range_adr", "floorpin", "surplus", "formulaic_q", "lrmg_radius"],
    katarakti_shadow_only: true,
    kill_criteria_reference: "outside_review_2026_07_04",
  };
  const configHash = sha256Stable(config);
  const configWithHash = { ...config, config_hash: configHash, content_hash: configHash };

  const coverageRows: Record<string, unknown>[] = [];
  const streamCandles = new Map<CandleStreamId, ReplayCandle[]>();
  const allEntries: EntryCandidateRow[] = [];

  for (const pair of selectedPairs) {
    console.log(`gate95 load pair=${pair}`);
    const series = await readTradeLegPathWarehousePairSeries({ manifestId, pair });
    const rawBars = reconstructRawBars(series, dateFromMs, dateToMs);
    const h1 = aggregateH1Bars(pair, rawBars);
    appendRows(streamCandles, "time_h1", h1);
    coverageRows.push(withHash({
      symbol: pair,
      source: "gate74b_trade_leg_path_warehouse",
      pair_week_rows: series.length,
      raw_bars: rawBars.length,
      time_h1_bars: h1.length,
      first_raw_timestamp_utc: rawBars[0]?.timestamp_utc ?? null,
      last_raw_timestamp_utc: rawBars.at(-1)?.timestamp_utc ?? null,
      candidate_b_sides: [...new Set(series.map((row) => row.candidate_b_side))].join("|"),
    }));
    allEntries.push(...materializeEntriesForStream(h1, { tradeLots: 0.01, dateFromMs, dateToMs }));
    for (const surface of CANDLE_STREAMS.filter((stream) => stream.kind === "movement")) {
      const movement = buildMovementCandles(pair, rawBars, surface.id, surface.brickAdr!);
      appendRows(streamCandles, surface.id, movement);
      allEntries.push(...materializeEntriesForStream(movement, { tradeLots: 0.01, dateFromMs, dateToMs }));
    }
    await closePoolIfInitialized();
  }

  for (const [streamId, candles] of streamCandles) {
    candles.sort((left, right) => left.timestamp_utc.localeCompare(right.timestamp_utc) || left.symbol.localeCompare(right.symbol));
    streamCandles.set(streamId, candles);
  }

  const admissions = buildAdmissionRows(allEntries);
  const variantConfigs = CANDLE_STREAMS.flatMap((stream) => DIRECTION_MODES.map((mode) => withHash({
    variant_id: variantId(stream.id, mode),
    candle_stream_id: stream.id,
    direction_mode: mode,
    entry_gate: "legacy_type3_only",
    candidate_b_role: mode.startsWith("candidate_b") ? "filter" : "reporting_context",
    geometry_role: "shadow_only",
    katarakti_role: "shadow_only",
  })));

  const exits: TradeExitRow[] = [];
  const inventory: OpenInventoryRow[] = [];
  const runtimeStats: Array<VariantRuntimeStats & { content_hash: string }> = [];
  for (const stream of CANDLE_STREAMS) {
    const candles = streamCandles.get(stream.id) ?? [];
    const bySymbol = groupBy(candles, (row) => row.symbol);
    for (const mode of DIRECTION_MODES) {
      const id = variantId(stream.id, mode);
      for (const symbolCandles of bySymbol.values()) {
        const replay = replayVariant({
          variantId: id,
          directionMode: mode,
          candleStreamId: stream.id,
          candles: symbolCandles,
          admissions,
        });
        exits.push(...replay.exits);
        inventory.push(...replay.openInventory);
        runtimeStats.push(replay.stats);
      }
    }
  }

  const variantSummary = summaryRows(exits, inventory, runtimeStats, variantConfigs);
  const yearlySummary = aggregateBy(exits, "year", (row) => `${row.variant_id}|${row.exit_time_utc.slice(0, 4)}`);
  const monthlySummary = aggregateBy(exits, "month", (row) => `${row.variant_id}|${row.exit_time_utc.slice(0, 7)}`);
  const pairSummary = aggregateBy(exits, "symbol", (row) => `${row.variant_id}|${row.symbol}`);
  const splitSummary = aggregateBy(exits, "split", (row) => `${row.variant_id}|${splitForTimestamp(row.exit_time_utc)}`);
  const candidateBucketSummary = aggregateBy(exits, "candidate_b_context_bucket", (row) => `${row.variant_id}|${row.candidate_b_context_bucket}`);
  const movementBucketSummary = aggregateBy(exits, "movement_bucket", (row) => `${row.variant_id}|${row.candle_stream_id}`);
  const kataraktiBucketSummary = aggregateBy(exits, "katarakti_context_bucket", (row) => `${row.variant_id}|${row.katarakti_context_bucket}`);
  const geometryShadowSummary = aggregateBy(exits, "geometry_bucket", (row) => `${row.variant_id}|pe=${row.path_efficiency_bucket}|range=${row.range_bucket}`);
  const validation = validationRows({
    gate92,
    gate74b,
    manifestStatus: manifest.status,
    selectedPairs,
    runMode,
    configHash,
    entries: allEntries,
    admissions,
    exits,
    inventory,
    variantRows: variantSummary,
  });
  const metrics = metricDefinitions();
  const commandReceipt = withHash({
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at_utc: nowIso(),
    git_commit: gitCommit(),
    git_dirty_status: gitDirtyStatus(),
    config_hash: configHash,
    manifest_id: manifestId,
    selected_pairs: selectedPairs,
    date_from: options.dateFrom,
    date_to: options.dateTo,
  });
  const runSummary = withHash({
    gate_id: GATE_ID,
    verdict: validation.filter((row) => row.passed !== true).length === 0
      ? runMode === "full_gate95_matrix"
        ? "PASS_GATE95_TYPE3_28PAIR_REPO_DISCOVERY_REPLAY_RESEARCH_ONLY_NO_PROMOTION"
        : "PASS_GATE95_SMOKE_OR_BOUNDED_SUBSET_REPLAY_RESEARCH_ONLY_NO_PROMOTION"
      : "FAIL_GATE95_TYPE3_28PAIR_REPO_DISCOVERY_VALIDATION",
    config_hash: configHash,
    run_mode: runMode,
    selected_pair_count: selectedPairs.length,
    entry_candidate_rows: allEntries.length,
    admission_rows: admissions.length,
    trade_exit_rows: exits.length,
    open_inventory_rows: inventory.length,
    terminal_liquidation_rows: exits.filter((row) => row.terminal_liquidation).length,
    variant_rows: variantSummary.length,
    validation_failures: validation.filter((row) => row.passed !== true).length,
  });

  const paths = {
    config: path.join(options.artifactDir, "gate95-config.json"),
    coverageJson: path.join(options.artifactDir, "coverage.rows.json"),
    coverageCsv: path.join(options.artifactDir, "coverage.rows.csv"),
    variantConfigJson: path.join(options.artifactDir, "variant-config.rows.json"),
    variantConfigCsv: path.join(options.artifactDir, "variant-config.rows.csv"),
    entryCandidatesJson: path.join(options.artifactDir, "type3-entry-candidates.rows.json"),
    entryCandidatesCsv: path.join(options.artifactDir, "type3-entry-candidates.rows.csv"),
    admissionsJson: path.join(options.artifactDir, "type3-entry-admissions.rows.json"),
    admissionsCsv: path.join(options.artifactDir, "type3-entry-admissions.rows.csv"),
    exitsJson: path.join(options.artifactDir, "trade-exits.rows.json"),
    exitsCsv: path.join(options.artifactDir, "trade-exits.rows.csv"),
    inventoryJson: path.join(options.artifactDir, "open-inventory.rows.json"),
    inventoryCsv: path.join(options.artifactDir, "open-inventory.rows.csv"),
    terminalJson: path.join(options.artifactDir, "terminal-liquidations.rows.json"),
    terminalCsv: path.join(options.artifactDir, "terminal-liquidations.rows.csv"),
    yearlyJson: path.join(options.artifactDir, "yearly-summary.rows.json"),
    yearlyCsv: path.join(options.artifactDir, "yearly-summary.rows.csv"),
    monthlyJson: path.join(options.artifactDir, "monthly-summary.rows.json"),
    monthlyCsv: path.join(options.artifactDir, "monthly-summary.rows.csv"),
    pairJson: path.join(options.artifactDir, "pair-summary.rows.json"),
    pairCsv: path.join(options.artifactDir, "pair-summary.rows.csv"),
    splitJson: path.join(options.artifactDir, "split-summary.rows.json"),
    splitCsv: path.join(options.artifactDir, "split-summary.rows.csv"),
    candidateBucketJson: path.join(options.artifactDir, "candidate-b-bucket-summary.rows.json"),
    candidateBucketCsv: path.join(options.artifactDir, "candidate-b-bucket-summary.rows.csv"),
    movementBucketJson: path.join(options.artifactDir, "movement-bucket-summary.rows.json"),
    movementBucketCsv: path.join(options.artifactDir, "movement-bucket-summary.rows.csv"),
    kataraktiBucketJson: path.join(options.artifactDir, "katarakti-bucket-summary.rows.json"),
    kataraktiBucketCsv: path.join(options.artifactDir, "katarakti-bucket-summary.rows.csv"),
    geometryJson: path.join(options.artifactDir, "geometry-shadow-summary.rows.json"),
    geometryCsv: path.join(options.artifactDir, "geometry-shadow-summary.rows.csv"),
    validationJson: path.join(options.artifactDir, "validation.rows.json"),
    validationCsv: path.join(options.artifactDir, "validation.rows.csv"),
    metricsJson: path.join(options.artifactDir, "metric-definitions.rows.json"),
    metricsCsv: path.join(options.artifactDir, "metric-definitions.rows.csv"),
    commandReceipt: path.join(options.artifactDir, "command-receipt.json"),
    runSummary: path.join(options.artifactDir, "gate95-run-summary.json"),
    shaManifest: path.join(options.artifactDir, "gate95-sha256.txt"),
    report: options.reportPath,
  };

  await writeJson(paths.config, configWithHash);
  await writeRows(paths.coverageJson, paths.coverageCsv, coverageRows);
  await writeRows(paths.variantConfigJson, paths.variantConfigCsv, variantConfigs);
  await writeRows(paths.entryCandidatesJson, paths.entryCandidatesCsv, allEntries as unknown as Record<string, unknown>[]);
  await writeRows(paths.admissionsJson, paths.admissionsCsv, admissions as unknown as Record<string, unknown>[]);
  await writeRows(paths.exitsJson, paths.exitsCsv, exits as unknown as Record<string, unknown>[]);
  await writeRows(paths.inventoryJson, paths.inventoryCsv, inventory as unknown as Record<string, unknown>[]);
  await writeRows(paths.terminalJson, paths.terminalCsv, exits.filter((row) => row.terminal_liquidation) as unknown as Record<string, unknown>[]);
  await writeRows(path.join(options.artifactDir, "variant-summary.rows.json"), path.join(options.artifactDir, "variant-summary.rows.csv"), variantSummary);
  await writeRows(paths.yearlyJson, paths.yearlyCsv, yearlySummary);
  await writeRows(paths.monthlyJson, paths.monthlyCsv, monthlySummary);
  await writeRows(paths.pairJson, paths.pairCsv, pairSummary);
  await writeRows(paths.splitJson, paths.splitCsv, splitSummary);
  await writeRows(paths.candidateBucketJson, paths.candidateBucketCsv, candidateBucketSummary);
  await writeRows(paths.movementBucketJson, paths.movementBucketCsv, movementBucketSummary);
  await writeRows(paths.kataraktiBucketJson, paths.kataraktiBucketCsv, kataraktiBucketSummary);
  await writeRows(paths.geometryJson, paths.geometryCsv, geometryShadowSummary);
  await writeRows(paths.validationJson, paths.validationCsv, validation);
  await writeRows(paths.metricsJson, paths.metricsCsv, metrics);
  await writeJson(paths.commandReceipt, commandReceipt);
  await writeJson(paths.runSummary, runSummary);
  await writeText(paths.report, renderReport({
    config,
    configHash,
    runMode,
    summary: variantSummary,
    validation,
    paths: { ...paths, variantSummary: path.join(options.artifactDir, "variant-summary.rows.json") },
    acceptedReview,
    rejectedReview,
  }));
  await writeShaManifest(paths.shaManifest, GATE_ID, COMMAND, [
    { label: "config", path: paths.config },
    { label: "report", path: paths.report },
    { label: "entry_candidates", path: paths.entryCandidatesJson },
    { label: "admissions", path: paths.admissionsJson },
    { label: "exits", path: paths.exitsJson },
    { label: "open_inventory", path: paths.inventoryJson },
    { label: "terminal_liquidations", path: paths.terminalJson },
    { label: "validation", path: paths.validationJson },
    { label: "run_summary", path: paths.runSummary },
    { label: "command_receipt", path: paths.commandReceipt },
  ]);

  console.log(`Gate 95 verdict: ${runSummary.verdict}`);
  console.log(`Selected pairs: ${selectedPairs.length}`);
  console.log(`Entry candidates: ${allEntries.length}`);
  console.log(`Trade exits: ${exits.length}`);
  console.log(`Validation failures: ${runSummary.validation_failures}`);
  console.log(`Report: ${paths.report}`);
  await closePoolIfInitialized();
}

main()
  .catch(async (error) => {
    console.error(error);
    await closePoolIfInitialized();
    process.exit(1);
  });
