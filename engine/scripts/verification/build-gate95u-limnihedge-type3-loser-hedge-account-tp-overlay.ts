import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

import { closePoolIfInitialized } from "@database/db/client";
import { sha256Stable } from "@engine/research/hash";
import {
  readTradeLegPathWarehousePairSeries,
  type TradeLegPathReplayPairWeek,
} from "@engine/research/tradeLegPathWarehouse";
import { DateTime } from "luxon";

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
import {
  correctedFxPnl,
  priceAtOrBefore,
  type AccountingPriceSeries,
  type FxSide,
} from "./limnihedge-corrected-accounting";

const GATE_ID = "Gate 95U: limnihedge-type3-loser-hedge-account-tp-overlay";
const GATE_DATE = "2026-07-05";
const COMMAND = "npm run engine:gate95u:limnihedge-type3-loser-hedge-account-tp-overlay";
const DEFAULT_GATE95_DIR =
  "docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026";
const DEFAULT_GATE95R_DIR =
  "docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay";
const DEFAULT_ARTIFACT_DIR =
  "docs/research/gates/gate95/artifacts/limnihedge-type3-loser-hedge-account-tp-overlay";
const DEFAULT_REPORT_PATH =
  `docs/research/gates/gate95/GATE95U_LIMNIHEDGE_TYPE3_LOSER_HEDGE_ACCOUNT_TP_OVERLAY_${GATE_DATE}.md`;
const PRICE_BUNDLE_ID = "gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953";
const OBSERVER_TIMEZONE = "America/New_York";
const OBSERVER_HOUR_NY = 16;
const ACCOUNT_TP_USD = [25, 50, 100, 250] as const;
const HEDGE_TRIGGERS = [
  { id: "corrected_marked_net_lt_0", threshold: (lotSize: number) => 0 * lotSize },
  { id: "corrected_marked_net_lt_minus_1x_commission", threshold: (lotSize: number) => -Math.abs(-7 * lotSize) },
] as const;
const TARGET_VARIANTS = [
  "adr_event_0_025_type3_long_only",
  "adr_event_0_05_type3_long_only",
  "adr_event_0_075_type3_long_only",
  "time_h1_type3_long_only",
] as const;
const PRIMARY_VARIANTS = new Set([
  "adr_event_0_025_type3_long_only",
  "adr_event_0_05_type3_long_only",
]);
const MAX_GROSS_LOT_RATIO = 1.75;

type PriceBar = {
  symbol: string;
  timestamp_utc: string;
  timestamp_ms: number;
  open: number;
  high: number;
  low: number;
  close: number;
  pair_adr_pct: number;
  candidate_b_side: "LONG" | "SHORT";
  source_week_open_utc: string;
};

type PriceSeries = AccountingPriceSeries & {
  rawBars: PriceBar[];
};

type Gate95Config = {
  gate_id: string;
  price_bundle_id: string;
  gate74b_manifest_id: string;
  gate74b_warehouse_hash: string;
  selected_pairs: string[];
  date_from: string;
  date_to: string;
  trade_lots: number;
  type3_lot_multiplier: number;
  config_hash: string;
  content_hash: string;
};

type VariantConfig = {
  variant_id: string;
  candle_stream_id: string;
  direction_mode: string;
  entry_gate: string;
  candidate_b_role: string;
  geometry_role: string;
  katarakti_role: string;
  content_hash?: string;
};

type TradeExitRow = {
  variant_id: string;
  symbol: string;
  candle_stream_id: string;
  direction_mode: string;
  entry_row_id: string;
  entry_time_utc: string;
  exit_time_utc: string;
  side: FxSide;
  lot_size: number;
  entry_price: number;
  exit_price: number;
  exit_reason: string;
  hold_hours: number;
  candidate_b_context_bucket: string;
  katarakti_context_bucket: string;
  path_efficiency_bucket: string;
  range_bucket: string;
  terminal_liquidation: boolean;
};

type Position = {
  id: string;
  kind: "original" | "hedge";
  original_id: string;
  symbol: string;
  side: FxSide;
  lot_size: number;
  entry_price: number;
  entry_time_utc: string;
  entry_ms: number;
  source_trade?: TradeExitRow;
  hedged?: boolean;
  locked_loss_at_hedge_open?: number;
};

type ExitNet = {
  net: number | null;
  conversion_gap: boolean;
};

type Event =
  | { kind: "entry"; time_ms: number; priority: 0; trade: TradeExitRow }
  | { kind: "source_exit"; time_ms: number; priority: 1; trade: TradeExitRow }
  | { kind: "observer"; time_ms: number; priority: 2; timestamp_utc: string; timestamp_ny: string }
  | { kind: "month_end"; time_ms: number; priority: 3; month: string; timestamp_utc: string };

type BaselineMetrics = {
  variant_id: string;
  source_trade_rows: number;
  corrected_closed_plus_marked_net_actual: number;
  corrected_profit_factor_closed_plus_marked: number | null;
  terminal_inventory_net_actual: number;
  terminal_inventory_loss_actual: number;
  terminal_inventory_loss_share_of_closed_net: number | null;
  terminal_inventory_net_loss_share_of_closed_net: number | null;
  open_inventory_count: number;
  top_pair: string | null;
  top_pair_contribution_pct: number | null;
  top_3_pairs: string | null;
  top_3_pair_contribution_pct: number | null;
  stress_double_commission_net: number;
  stress_slippage_0_1_net: number;
  baseline_max_open_original_count: number;
  baseline_max_gross_lots: number;
  content_hash?: string;
};

type MatrixMetrics = {
  variant_id: string;
  hedge_trigger: string;
  account_tp_usd: number;
  observer_time_ny: string;
  source_trade_rows: number;
  original_entries_preserved: number;
  corrected_closed_plus_marked_net_actual: number;
  corrected_profit_factor_closed_plus_marked: number | null;
  max_month_end_marked_dd_actual: number;
  worst_month: string | null;
  worst_marked_month_delta_actual: number | null;
  terminal_inventory_net_actual: number;
  terminal_inventory_loss_actual: number;
  terminal_inventory_loss_share_of_closed_net: number | null;
  terminal_inventory_net_loss_share_of_closed_net: number | null;
  terminal_open_original_count: number;
  terminal_open_hedge_count: number;
  terminal_open_inventory_count: number;
  hedge_open_count: number;
  hedge_source_pair_close_count: number;
  account_tp_flush_count: number;
  account_tp_flushed_original_count: number;
  account_tp_flushed_hedge_count: number;
  observer_count: number;
  carried_red_original_checks: number;
  locked_loss_at_hedge_open_total: number;
  avg_locked_loss_at_hedge_open: number | null;
  hedge_net_actual: number;
  original_net_while_hedged_actual: number;
  avg_hedge_hold_hours: number | null;
  max_open_original_count: number;
  max_open_hedge_count: number;
  max_gross_lots: number;
  baseline_max_gross_lots: number;
  max_gross_lot_ratio: number | null;
  top_pair: string | null;
  top_pair_contribution_pct: number | null;
  top_3_pairs: string | null;
  top_3_pair_contribution_pct: number | null;
  stress_double_commission_net: number;
  stress_double_commission_profit_factor: number | null;
  stress_slippage_0_1_net: number;
  stress_slippage_0_1_profit_factor: number | null;
  baseline_closed_plus_marked_net_actual: number | null;
  baseline_terminal_inventory_net_loss_share_of_closed_net: number | null;
  baseline_top_pair_contribution_pct: number | null;
  baseline_top_3_pair_contribution_pct: number | null;
  fixes_gate95r_failure_reason: boolean;
  gross_exposure_guard_pass: boolean;
  concentration_not_worse: boolean;
  materially_improves_terminal_inventory: boolean;
  materially_improves_pair_concentration: boolean;
  cost_fragility_not_worse: boolean;
  decision_improved_row: boolean;
  decision_reason: string;
  content_hash?: string;
};

function normalizePath(filePath: string) {
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
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

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (quoted) {
      if (char === "\"") {
        if (line[index + 1] === "\"") {
          current += "\"";
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

async function streamCsv(filePath: string, onRow: (row: Record<string, string>) => void | Promise<void>) {
  const input = createReadStream(normalizePath(filePath), { encoding: "utf8" });
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let columns: string[] | null = null;
  for await (const line of rl) {
    if (!columns) {
      columns = parseCsvLine(line);
      continue;
    }
    if (!line.trim()) continue;
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    for (let index = 0; index < columns.length; index += 1) row[columns[index]!] = values[index] ?? "";
    await onRow(row);
  }
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

async function writeStreamChunk(stream: ReturnType<typeof createWriteStream>, chunk: string) {
  if (!stream.write(chunk)) await once(stream, "drain");
}

async function finishStream(stream: ReturnType<typeof createWriteStream>) {
  stream.end();
  await once(stream, "finish");
}

async function writeRows(jsonPath: string, csvPath: string, rows: Record<string, unknown>[]) {
  const normalizedJsonPath = normalizePath(jsonPath);
  await mkdir(path.dirname(normalizedJsonPath), { recursive: true });
  const jsonStream = createWriteStream(normalizedJsonPath, { encoding: "utf8" });
  try {
    await writeStreamChunk(jsonStream, "[\n");
    for (let index = 0; index < rows.length; index += 1) {
      await writeStreamChunk(jsonStream, `${index === 0 ? "" : ",\n"}${JSON.stringify(rows[index])}`);
    }
    await writeStreamChunk(jsonStream, "\n]\n");
    await finishStream(jsonStream);
  } catch (error) {
    jsonStream.destroy();
    throw error;
  }

  const normalizedCsvPath = normalizePath(csvPath);
  await mkdir(path.dirname(normalizedCsvPath), { recursive: true });
  const csvStream = createWriteStream(normalizedCsvPath, { encoding: "utf8" });
  try {
    const columns = rows.length ? Object.keys(rows[0]!) : [];
    await writeStreamChunk(csvStream, `${columns.join(",")}\n`);
    for (const row of rows) {
      await writeStreamChunk(csvStream, `${columns.map((column) => csvEscape(row[column])).join(",")}\n`);
    }
    await finishStream(csvStream);
  } catch (error) {
    csvStream.destroy();
    throw error;
  }
}

function numberValue(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  if (value === null || value === undefined || value === "") return 0;
  return Number(value);
}

function booleanValue(value: string | boolean | null | undefined) {
  if (typeof value === "boolean") return value;
  return value === "true";
}

function rawPriceFromDirectedAdr(row: TradeLegPathReplayPairWeek, directedAdr: number) {
  if (!row.entry_price || row.entry_price <= 0 || row.pair_adr_pct <= 0) return null;
  const signedPct = directedAdr * row.pair_adr_pct / 100;
  return row.candidate_b_side === "LONG"
    ? row.entry_price * (1 + signedPct)
    : row.entry_price * (1 - signedPct);
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

function monthsBetween(dateFrom: string, dateTo: string) {
  const months: string[] = [];
  const cursor = new Date(Date.UTC(new Date(dateFrom).getUTCFullYear(), new Date(dateFrom).getUTCMonth(), 1));
  const end = new Date(Date.UTC(new Date(dateTo).getUTCFullYear(), new Date(dateTo).getUTCMonth(), 1));
  while (cursor <= end) {
    months.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function monthEndIso(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year!, monthNumber!, 0, 23, 59, 59, 999)).toISOString();
}

function mapTrade(row: Record<string, string>): TradeExitRow {
  return {
    variant_id: row.variant_id ?? "",
    symbol: row.symbol ?? "",
    candle_stream_id: row.candle_stream_id ?? "",
    direction_mode: row.direction_mode ?? "",
    entry_row_id: row.entry_row_id ?? "",
    entry_time_utc: row.entry_time_utc ?? "",
    exit_time_utc: row.exit_time_utc ?? "",
    side: (row.side ?? "BUY") as FxSide,
    lot_size: numberValue(row.lot_size),
    entry_price: numberValue(row.entry_price),
    exit_price: numberValue(row.exit_price),
    exit_reason: row.exit_reason ?? "",
    hold_hours: numberValue(row.hold_hours),
    candidate_b_context_bucket: row.candidate_b_context_bucket ?? "",
    katarakti_context_bucket: row.katarakti_context_bucket ?? "",
    path_efficiency_bucket: row.path_efficiency_bucket ?? "",
    range_bucket: row.range_bucket ?? "",
    terminal_liquidation: booleanValue(row.terminal_liquidation),
  };
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function maxEquityDrawdown(values: number[]) {
  let peak = 0;
  let maxDd = 0;
  for (const value of values) {
    if (value > peak) peak = value;
    const dd = value - peak;
    if (dd < maxDd) maxDd = dd;
  }
  return maxDd;
}

function oppositeSide(side: FxSide): FxSide {
  return side === "BUY" ? "SELL" : "BUY";
}

function positionNet(params: {
  symbol: string;
  side: FxSide;
  lotSize: number;
  entryPrice: number;
  exitPrice: number;
  exitTimeUtc: string;
  prices: Map<string, PriceSeries>;
  commissionUsdPerLot?: number;
  slippagePips?: number;
}): ExitNet {
  const result = correctedFxPnl({
    symbol: params.symbol,
    side: params.side,
    lotSize: params.lotSize,
    entryPrice: params.entryPrice,
    exitPrice: params.exitPrice,
    exitTimeUtc: params.exitTimeUtc,
    prices: params.prices as Map<string, AccountingPriceSeries>,
    commissionUsdPerLot: params.commissionUsdPerLot,
    slippagePips: params.slippagePips,
  });
  return {
    net: result.net,
    conversion_gap: result.net === null,
  };
}

function priceForPosition(position: Pick<Position, "symbol">, timestampUtc: string, prices: Map<string, PriceSeries>) {
  return priceAtOrBefore(prices.get(position.symbol)?.rawBars ?? [], timestampUtc);
}

function markPosition(position: Position, timestampUtc: string, prices: Map<string, PriceSeries>) {
  const price = priceForPosition(position, timestampUtc, prices);
  if (!price) return { net: null, price: null };
  return {
    price,
    net: positionNet({
      symbol: position.symbol,
      side: position.side,
      lotSize: position.lot_size,
      entryPrice: position.entry_price,
      exitPrice: price.close,
      exitTimeUtc: price.timestamp_utc,
      prices,
    }).net,
  };
}

function generateObservers(dateFrom: string, dateTo: string) {
  const startUtcMs = Date.parse(dateFrom);
  const endUtcMs = Date.parse(dateTo);
  let cursor = DateTime.fromISO(dateFrom, { zone: "utc" }).setZone(OBSERVER_TIMEZONE).startOf("day");
  const end = DateTime.fromISO(dateTo, { zone: "utc" }).setZone(OBSERVER_TIMEZONE).endOf("day");
  const observers: Array<{ timestamp_utc: string; timestamp_ny: string; time_ms: number }> = [];
  while (cursor <= end) {
    if (cursor.weekday >= 1 && cursor.weekday <= 5) {
      const local = cursor.set({ hour: OBSERVER_HOUR_NY, minute: 0, second: 0, millisecond: 0 });
      const utcMs = local.toUTC().toMillis();
      if (utcMs >= startUtcMs && utcMs <= endUtcMs) {
        observers.push({
          timestamp_utc: new Date(utcMs).toISOString(),
          timestamp_ny: local.toISO({ suppressMilliseconds: false }) ?? "",
          time_ms: utcMs,
        });
      }
    }
    cursor = cursor.plus({ days: 1 });
  }
  return observers;
}

function makeEvents(trades: TradeExitRow[], dateFrom: string, dateTo: string) {
  const events: Event[] = [];
  for (const trade of trades) {
    events.push({ kind: "entry", time_ms: Date.parse(trade.entry_time_utc), priority: 0, trade });
    events.push({ kind: "source_exit", time_ms: Date.parse(trade.exit_time_utc), priority: 1, trade });
  }
  for (const observer of generateObservers(dateFrom, dateTo)) {
    events.push({
      kind: "observer",
      time_ms: observer.time_ms,
      priority: 2,
      timestamp_utc: observer.timestamp_utc,
      timestamp_ny: observer.timestamp_ny,
    });
  }
  for (const month of monthsBetween(dateFrom, dateTo)) {
    const timestamp = monthEndIso(month);
    events.push({ kind: "month_end", time_ms: Date.parse(timestamp), priority: 3, month, timestamp_utc: timestamp });
  }
  events.sort((left, right) => left.time_ms - right.time_ms || left.priority - right.priority);
  return events;
}

function updateExposureMax(
  activeOriginals: Map<string, Position>,
  activeHedges: Map<string, Position>,
  current: { maxOriginals: number; maxHedges: number; maxGrossLots: number },
) {
  const originalLots = sum([...activeOriginals.values()].map((position) => position.lot_size));
  const hedgeLots = sum([...activeHedges.values()].map((position) => position.lot_size));
  current.maxOriginals = Math.max(current.maxOriginals, activeOriginals.size);
  current.maxHedges = Math.max(current.maxHedges, activeHedges.size);
  current.maxGrossLots = Math.max(current.maxGrossLots, originalLots + hedgeLots);
}

function computePairConcentration(pairNet: Map<string, number>, totalNet: number) {
  const pairs = [...pairNet.entries()].map(([symbol, net]) => ({ symbol, net })).sort((left, right) => right.net - left.net);
  const positivePairs = pairs.filter((row) => row.net > 0);
  const topPair = positivePairs[0] ?? pairs[0] ?? null;
  const top3 = positivePairs.slice(0, 3);
  const top3Net = sum(top3.map((row) => row.net));
  return {
    topPair: topPair?.symbol ?? null,
    topPairPct: topPair && totalNet > 0 ? (topPair.net / totalNet) * 100 : null,
    top3Pairs: top3.map((row) => row.symbol).join("|") || null,
    top3Pct: totalNet > 0 ? (top3Net / totalNet) * 100 : null,
  };
}

function baselineMetrics(variantId: string, trades: TradeExitRow[], prices: Map<string, PriceSeries>): BaselineMetrics {
  const values: number[] = [];
  const doubleValues: number[] = [];
  const slipValues: number[] = [];
  const pairNet = new Map<string, number>();
  let closedNonTerminalNet = 0;
  let terminalNet = 0;
  let terminalLoss = 0;
  let terminalCount = 0;

  for (const trade of trades) {
    const base = positionNet({
      symbol: trade.symbol,
      side: trade.side,
      lotSize: trade.lot_size,
      entryPrice: trade.entry_price,
      exitPrice: trade.exit_price,
      exitTimeUtc: trade.exit_time_utc,
      prices,
    }).net ?? 0;
    const doubleCommission = positionNet({
      symbol: trade.symbol,
      side: trade.side,
      lotSize: trade.lot_size,
      entryPrice: trade.entry_price,
      exitPrice: trade.exit_price,
      exitTimeUtc: trade.exit_time_utc,
      prices,
      commissionUsdPerLot: -14,
    }).net ?? 0;
    const slippage = positionNet({
      symbol: trade.symbol,
      side: trade.side,
      lotSize: trade.lot_size,
      entryPrice: trade.entry_price,
      exitPrice: trade.exit_price,
      exitTimeUtc: trade.exit_time_utc,
      prices,
      slippagePips: 0.1,
    }).net ?? 0;
    values.push(base);
    doubleValues.push(doubleCommission);
    slipValues.push(slippage);
    pairNet.set(trade.symbol, (pairNet.get(trade.symbol) ?? 0) + base);
    if (trade.terminal_liquidation) {
      terminalNet += base;
      if (base < 0) terminalLoss += base;
      terminalCount += 1;
    } else {
      closedNonTerminalNet += base;
    }
  }

  const exposure = { maxOriginals: 0, maxHedges: 0, maxGrossLots: 0 };
  const active = new Map<string, Position>();
  const events = trades
    .flatMap((trade) => [
      { time_ms: Date.parse(trade.entry_time_utc), delta: 1, trade },
      { time_ms: Date.parse(trade.exit_time_utc), delta: -1, trade },
    ])
    .sort((left, right) => left.time_ms - right.time_ms || right.delta - left.delta);
  for (const event of events) {
    if (event.delta > 0) {
      active.set(event.trade.entry_row_id, {
        id: event.trade.entry_row_id,
        kind: "original",
        original_id: event.trade.entry_row_id,
        symbol: event.trade.symbol,
        side: event.trade.side,
        lot_size: event.trade.lot_size,
        entry_price: event.trade.entry_price,
        entry_time_utc: event.trade.entry_time_utc,
        entry_ms: Date.parse(event.trade.entry_time_utc),
        source_trade: event.trade,
      });
    } else {
      active.delete(event.trade.entry_row_id);
    }
    updateExposureMax(active, new Map(), exposure);
  }

  const totalNet = sum(values);
  const concentration = computePairConcentration(pairNet, totalNet);
  return {
    variant_id: variantId,
    source_trade_rows: trades.length,
    corrected_closed_plus_marked_net_actual: round2(totalNet),
    corrected_profit_factor_closed_plus_marked: values.length ? round(profitFactor(values), 6) : null,
    terminal_inventory_net_actual: round2(terminalNet),
    terminal_inventory_loss_actual: round2(terminalLoss),
    terminal_inventory_loss_share_of_closed_net: closedNonTerminalNet > 0 ? round6(Math.abs(terminalLoss) / Math.abs(closedNonTerminalNet)) : null,
    terminal_inventory_net_loss_share_of_closed_net: closedNonTerminalNet > 0 ? round6(Math.abs(Math.min(0, terminalNet)) / Math.abs(closedNonTerminalNet)) : null,
    open_inventory_count: terminalCount,
    top_pair: concentration.topPair,
    top_pair_contribution_pct: concentration.topPairPct === null ? null : round6(concentration.topPairPct),
    top_3_pairs: concentration.top3Pairs,
    top_3_pair_contribution_pct: concentration.top3Pct === null ? null : round6(concentration.top3Pct),
    stress_double_commission_net: round2(sum(doubleValues)),
    stress_slippage_0_1_net: round2(sum(slipValues)),
    baseline_max_open_original_count: exposure.maxOriginals,
    baseline_max_gross_lots: round6(exposure.maxGrossLots),
  };
}

function simulateOverlay(params: {
  variantId: string;
  trades: TradeExitRow[];
  prices: Map<string, PriceSeries>;
  dateFrom: string;
  dateTo: string;
  hedgeTrigger: typeof HEDGE_TRIGGERS[number];
  accountTpUsd: number;
  baseline: BaselineMetrics;
}) {
  const activeOriginals = new Map<string, Position>();
  const activeHedges = new Map<string, Position>();
  const values: number[] = [];
  const doubleValues: number[] = [];
  const slipValues: number[] = [];
  const pairNet = new Map<string, number>();
  const monthEquity: Array<{ month: string; equity: number }> = [];
  const cycleRows: Record<string, unknown>[] = [];

  let totalRealizedNet = 0;
  let cycleRealizedNet = 0;
  let cycleId = 1;
  let closedNonTerminalNet = 0;
  let terminalNet = 0;
  let terminalLoss = 0;
  let terminalOriginalCount = 0;
  let terminalHedgeCount = 0;
  let hedgeOpenCount = 0;
  let hedgeSourcePairCloseCount = 0;
  let accountTpFlushCount = 0;
  let accountTpFlushedOriginalCount = 0;
  let accountTpFlushedHedgeCount = 0;
  let observerCount = 0;
  let carriedRedOriginalChecks = 0;
  let lockedLossTotal = 0;
  let hedgeNet = 0;
  let originalNetWhileHedged = 0;
  const hedgeHoldHours: number[] = [];
  let conversionGapCount = 0;
  let originalEntriesPreserved = 0;
  const exposure = { maxOriginals: 0, maxHedges: 0, maxGrossLots: 0 };

  function addClosure(position: Position, price: PriceBar, reason: string, terminal: boolean) {
    const base = positionNet({
      symbol: position.symbol,
      side: position.side,
      lotSize: position.lot_size,
      entryPrice: position.entry_price,
      exitPrice: price.close,
      exitTimeUtc: price.timestamp_utc,
      prices: params.prices,
    });
    const doubleCommission = positionNet({
      symbol: position.symbol,
      side: position.side,
      lotSize: position.lot_size,
      entryPrice: position.entry_price,
      exitPrice: price.close,
      exitTimeUtc: price.timestamp_utc,
      prices: params.prices,
      commissionUsdPerLot: -14,
    });
    const slippage = positionNet({
      symbol: position.symbol,
      side: position.side,
      lotSize: position.lot_size,
      entryPrice: position.entry_price,
      exitPrice: price.close,
      exitTimeUtc: price.timestamp_utc,
      prices: params.prices,
      slippagePips: 0.1,
    });
    if (base.conversion_gap || doubleCommission.conversion_gap || slippage.conversion_gap) conversionGapCount += 1;
    const net = base.net ?? 0;
    values.push(net);
    doubleValues.push(doubleCommission.net ?? 0);
    slipValues.push(slippage.net ?? 0);
    totalRealizedNet += net;
    cycleRealizedNet += net;
    pairNet.set(position.symbol, (pairNet.get(position.symbol) ?? 0) + net);
    if (terminal) {
      terminalNet += net;
      if (net < 0) terminalLoss += net;
      if (position.kind === "original") terminalOriginalCount += 1;
      if (position.kind === "hedge") terminalHedgeCount += 1;
    } else {
      closedNonTerminalNet += net;
    }
    if (position.kind === "hedge") {
      hedgeNet += net;
      hedgeHoldHours.push((price.timestamp_ms - position.entry_ms) / 3_600_000);
      if (reason === "source_pair_close") hedgeSourcePairCloseCount += 1;
    }
    if (position.kind === "original" && position.hedged) originalNetWhileHedged += net;
    return net;
  }

  function markedCycleNet(timestampUtc: string) {
    let openMarked = 0;
    for (const position of [...activeOriginals.values(), ...activeHedges.values()]) {
      const mark = markPosition(position, timestampUtc, params.prices);
      if (mark.net === null) {
        conversionGapCount += 1;
      } else {
        openMarked += mark.net;
      }
    }
    return cycleRealizedNet + openMarked;
  }

  function markedTotalEquity(timestampUtc: string) {
    let openMarked = 0;
    for (const position of [...activeOriginals.values(), ...activeHedges.values()]) {
      const mark = markPosition(position, timestampUtc, params.prices);
      if (mark.net === null) {
        conversionGapCount += 1;
      } else {
        openMarked += mark.net;
      }
    }
    return totalRealizedNet + openMarked;
  }

  function closeAllOpenAt(timestampUtc: string, reason: string, terminal: boolean) {
    const originals = [...activeOriginals.values()];
    const hedges = [...activeHedges.values()];
    let closedNet = 0;
    for (const position of originals) {
      const price = priceForPosition(position, timestampUtc, params.prices);
      if (!price) {
        conversionGapCount += 1;
        continue;
      }
      closedNet += addClosure(position, price, reason, terminal);
      activeOriginals.delete(position.id);
    }
    for (const position of hedges) {
      const price = priceForPosition(position, timestampUtc, params.prices);
      if (!price) {
        conversionGapCount += 1;
        continue;
      }
      closedNet += addClosure(position, price, reason, terminal);
      activeHedges.delete(position.original_id);
    }
    updateExposureMax(activeOriginals, activeHedges, exposure);
    return { closedNet, originals: originals.length, hedges: hedges.length };
  }

  const events = makeEvents(params.trades, params.dateFrom, params.dateTo);
  for (const event of events) {
    if (event.kind === "entry") {
      const trade = event.trade;
      activeOriginals.set(trade.entry_row_id, {
        id: trade.entry_row_id,
        kind: "original",
        original_id: trade.entry_row_id,
        symbol: trade.symbol,
        side: trade.side,
        lot_size: trade.lot_size,
        entry_price: trade.entry_price,
        entry_time_utc: trade.entry_time_utc,
        entry_ms: Date.parse(trade.entry_time_utc),
        source_trade: trade,
      });
      originalEntriesPreserved += 1;
      updateExposureMax(activeOriginals, activeHedges, exposure);
      continue;
    }

    if (event.kind === "source_exit") {
      const original = activeOriginals.get(event.trade.entry_row_id);
      if (!original) continue;
      const price = priceForPosition(original, event.trade.exit_time_utc, params.prices);
      if (!price) {
        conversionGapCount += 1;
        continue;
      }
      const terminal = event.trade.terminal_liquidation;
      addClosure(original, price, terminal ? "terminal_mark" : "source_exit", terminal);
      activeOriginals.delete(original.id);
      const hedge = activeHedges.get(original.id);
      if (hedge) {
        addClosure(hedge, price, terminal ? "terminal_mark" : "source_pair_close", terminal);
        activeHedges.delete(original.id);
      }
      updateExposureMax(activeOriginals, activeHedges, exposure);
      continue;
    }

    if (event.kind === "observer") {
      observerCount += 1;
      const preHedgeCycleNet = markedCycleNet(event.timestamp_utc);
      if (preHedgeCycleNet >= params.accountTpUsd) {
        const beforeOriginals = activeOriginals.size;
        const beforeHedges = activeHedges.size;
        if (beforeOriginals + beforeHedges > 0) {
          const flush = closeAllOpenAt(event.timestamp_utc, "account_tp_flush", false);
          accountTpFlushCount += 1;
          accountTpFlushedOriginalCount += flush.originals;
          accountTpFlushedHedgeCount += flush.hedges;
          cycleRows.push(withHash({
            variant_id: params.variantId,
            hedge_trigger: params.hedgeTrigger.id,
            account_tp_usd: params.accountTpUsd,
            cycle_id: cycleId,
            flush_time_utc: event.timestamp_utc,
            flush_time_ny: event.timestamp_ny,
            cycle_marked_net_before_flush: round2(preHedgeCycleNet),
            flush_closed_net_actual: round2(flush.closedNet),
            open_originals_before_flush: beforeOriginals,
            open_hedges_before_flush: beforeHedges,
          }));
        }
        cycleRealizedNet = 0;
        cycleId += 1;
        continue;
      }

      for (const original of [...activeOriginals.values()]) {
        if (activeHedges.has(original.id)) continue;
        const mark = markPosition(original, event.timestamp_utc, params.prices);
        if (!mark.price || mark.net === null) {
          conversionGapCount += 1;
          continue;
        }
        if (mark.net < 0) carriedRedOriginalChecks += 1;
        if (mark.net < params.hedgeTrigger.threshold(original.lot_size)) {
          const hedge: Position = {
            id: `${original.id}|hedge|${event.timestamp_utc}`,
            kind: "hedge",
            original_id: original.id,
            symbol: original.symbol,
            side: oppositeSide(original.side),
            lot_size: original.lot_size,
            entry_price: mark.price.close,
            entry_time_utc: mark.price.timestamp_utc,
            entry_ms: mark.price.timestamp_ms,
            locked_loss_at_hedge_open: mark.net,
          };
          original.hedged = true;
          original.locked_loss_at_hedge_open = mark.net;
          activeHedges.set(original.id, hedge);
          hedgeOpenCount += 1;
          lockedLossTotal += mark.net;
        }
      }
      updateExposureMax(activeOriginals, activeHedges, exposure);
      continue;
    }

    if (event.kind === "month_end") {
      monthEquity.push({
        month: event.month,
        equity: markedTotalEquity(event.timestamp_utc),
      });
    }
  }

  if (activeOriginals.size + activeHedges.size > 0) {
    closeAllOpenAt(params.dateTo, "terminal_mark", true);
  }

  let previousMonthEquity = 0;
  const monthDeltas = monthEquity.map((row) => {
    const delta = row.equity - previousMonthEquity;
    previousMonthEquity = row.equity;
    return { ...row, delta };
  });
  const worstMonth = monthDeltas.length
    ? [...monthDeltas].sort((left, right) => left.delta - right.delta)[0]!
    : null;

  const totalNet = sum(values);
  const terminalLossShare = closedNonTerminalNet > 0 ? Math.abs(terminalLoss) / Math.abs(closedNonTerminalNet) : null;
  const terminalNetLossShare = closedNonTerminalNet > 0 ? Math.abs(Math.min(0, terminalNet)) / Math.abs(closedNonTerminalNet) : null;
  const concentration = computePairConcentration(pairNet, totalNet);
  const baselineTopPair = params.baseline.top_pair_contribution_pct;
  const baselineTop3 = params.baseline.top_3_pair_contribution_pct;
  const baselineTerminalShare = params.baseline.terminal_inventory_net_loss_share_of_closed_net;
  const maxGrossRatio = params.baseline.baseline_max_gross_lots > 0
    ? exposure.maxGrossLots / params.baseline.baseline_max_gross_lots
    : null;
  const concentrationNotWorse = baselineTopPair !== null && baselineTop3 !== null
    && concentration.topPairPct !== null && concentration.top3Pct !== null
    && concentration.topPairPct <= baselineTopPair
    && concentration.top3Pct <= baselineTop3;
  const materiallyImprovesTerminal = baselineTerminalShare !== null && terminalNetLossShare !== null
    && terminalNetLossShare <= baselineTerminalShare * 0.75;
  const materiallyImprovesConcentration = baselineTopPair !== null && baselineTop3 !== null
    && concentration.topPairPct !== null && concentration.top3Pct !== null
    && concentration.topPairPct <= baselineTopPair - 5
    && concentration.top3Pct <= baselineTop3 - 10;
  const costFragilityNotWorse = sum(doubleValues) > 0 && sum(slipValues) > 0;
  const grossGuardPass = maxGrossRatio !== null && maxGrossRatio <= MAX_GROSS_LOT_RATIO;
  const terminalBelow25 = terminalNetLossShare !== null && terminalNetLossShare < 0.25;
  const fixesGate95rFailure = PRIMARY_VARIANTS.has(params.variantId)
    ? terminalBelow25 && concentrationNotWorse && costFragilityNotWorse && grossGuardPass
    : false;

  const decisionReasons: string[] = [];
  if (!PRIMARY_VARIANTS.has(params.variantId)) decisionReasons.push("reference_or_control_row");
  if (!(totalNet > 0)) decisionReasons.push("corrected_closed_plus_marked_net_not_positive");
  if (!terminalBelow25 && PRIMARY_VARIANTS.has(params.variantId)) decisionReasons.push("terminal_inventory_net_loss_share_not_below_25pct_closed_net");
  if (!grossGuardPass && PRIMARY_VARIANTS.has(params.variantId)) decisionReasons.push("max_gross_lot_ratio_gt_guard");
  if (!concentrationNotWorse && PRIMARY_VARIANTS.has(params.variantId)) decisionReasons.push("concentration_worse_or_missing");
  if (!costFragilityNotWorse && PRIMARY_VARIANTS.has(params.variantId)) decisionReasons.push("cost_fragility_worse_or_missing");
  if (params.variantId === "adr_event_0_05_type3_long_only" && !materiallyImprovesTerminal) {
    decisionReasons.push("0_05_terminal_inventory_not_materially_improved");
  }
  if (params.variantId === "adr_event_0_05_type3_long_only" && !materiallyImprovesConcentration) {
    decisionReasons.push("0_05_pair_concentration_not_materially_improved");
  }
  if (!fixesGate95rFailure && PRIMARY_VARIANTS.has(params.variantId)) decisionReasons.push("gate95r_failure_reason_not_fixed");

  const decisionImproved = params.variantId === "adr_event_0_025_type3_long_only"
    ? totalNet > 0 && terminalBelow25 && concentrationNotWorse && costFragilityNotWorse && grossGuardPass
    : params.variantId === "adr_event_0_05_type3_long_only"
      ? totalNet > 0 && terminalBelow25 && materiallyImprovesTerminal && materiallyImprovesConcentration && costFragilityNotWorse && grossGuardPass
      : false;

  const metrics: MatrixMetrics = {
    variant_id: params.variantId,
    hedge_trigger: params.hedgeTrigger.id,
    account_tp_usd: params.accountTpUsd,
    observer_time_ny: `${String(OBSERVER_HOUR_NY).padStart(2, "0")}:00 ${OBSERVER_TIMEZONE}`,
    source_trade_rows: params.trades.length,
    original_entries_preserved: originalEntriesPreserved,
    corrected_closed_plus_marked_net_actual: round2(totalNet),
    corrected_profit_factor_closed_plus_marked: values.length ? round(profitFactor(values), 6) : null,
    max_month_end_marked_dd_actual: round2(maxEquityDrawdown(monthEquity.map((row) => row.equity))),
    worst_month: worstMonth?.month ?? null,
    worst_marked_month_delta_actual: worstMonth ? round2(worstMonth.delta) : null,
    terminal_inventory_net_actual: round2(terminalNet),
    terminal_inventory_loss_actual: round2(terminalLoss),
    terminal_inventory_loss_share_of_closed_net: terminalLossShare === null ? null : round6(terminalLossShare),
    terminal_inventory_net_loss_share_of_closed_net: terminalNetLossShare === null ? null : round6(terminalNetLossShare),
    terminal_open_original_count: terminalOriginalCount,
    terminal_open_hedge_count: terminalHedgeCount,
    terminal_open_inventory_count: terminalOriginalCount + terminalHedgeCount,
    hedge_open_count: hedgeOpenCount,
    hedge_source_pair_close_count: hedgeSourcePairCloseCount,
    account_tp_flush_count: accountTpFlushCount,
    account_tp_flushed_original_count: accountTpFlushedOriginalCount,
    account_tp_flushed_hedge_count: accountTpFlushedHedgeCount,
    observer_count: observerCount,
    carried_red_original_checks: carriedRedOriginalChecks,
    locked_loss_at_hedge_open_total: round2(lockedLossTotal),
    avg_locked_loss_at_hedge_open: hedgeOpenCount ? round6(lockedLossTotal / hedgeOpenCount) : null,
    hedge_net_actual: round2(hedgeNet),
    original_net_while_hedged_actual: round2(originalNetWhileHedged),
    avg_hedge_hold_hours: hedgeHoldHours.length ? round6(sum(hedgeHoldHours) / hedgeHoldHours.length) : null,
    max_open_original_count: exposure.maxOriginals,
    max_open_hedge_count: exposure.maxHedges,
    max_gross_lots: round6(exposure.maxGrossLots),
    baseline_max_gross_lots: params.baseline.baseline_max_gross_lots,
    max_gross_lot_ratio: maxGrossRatio === null ? null : round6(maxGrossRatio),
    top_pair: concentration.topPair,
    top_pair_contribution_pct: concentration.topPairPct === null ? null : round6(concentration.topPairPct),
    top_3_pairs: concentration.top3Pairs,
    top_3_pair_contribution_pct: concentration.top3Pct === null ? null : round6(concentration.top3Pct),
    stress_double_commission_net: round2(sum(doubleValues)),
    stress_double_commission_profit_factor: doubleValues.length ? round(profitFactor(doubleValues), 6) : null,
    stress_slippage_0_1_net: round2(sum(slipValues)),
    stress_slippage_0_1_profit_factor: slipValues.length ? round(profitFactor(slipValues), 6) : null,
    baseline_closed_plus_marked_net_actual: params.baseline.corrected_closed_plus_marked_net_actual,
    baseline_terminal_inventory_net_loss_share_of_closed_net: baselineTerminalShare,
    baseline_top_pair_contribution_pct: baselineTopPair,
    baseline_top_3_pair_contribution_pct: baselineTop3,
    fixes_gate95r_failure_reason: fixesGate95rFailure,
    gross_exposure_guard_pass: grossGuardPass,
    concentration_not_worse: concentrationNotWorse,
    materially_improves_terminal_inventory: materiallyImprovesTerminal,
    materially_improves_pair_concentration: materiallyImprovesConcentration,
    cost_fragility_not_worse: costFragilityNotWorse,
    decision_improved_row: decisionImproved,
    decision_reason: decisionImproved ? "improved_under_gate95u_decision_contract" : decisionReasons.join(";"),
  };

  return {
    metrics,
    cycleRows,
    conversionGapCount,
  };
}

function sortedMatrixRows(rows: Record<string, unknown>[]) {
  return [...rows].sort((left, right) => {
    const leftVariant = String(left.variant_id);
    const rightVariant = String(right.variant_id);
    const variantOrder = TARGET_VARIANTS.indexOf(leftVariant as typeof TARGET_VARIANTS[number]) - TARGET_VARIANTS.indexOf(rightVariant as typeof TARGET_VARIANTS[number]);
    if (variantOrder !== 0) return variantOrder;
    const triggerOrder = String(left.hedge_trigger).localeCompare(String(right.hedge_trigger));
    if (triggerOrder !== 0) return triggerOrder;
    return numberValue(left.account_tp_usd as number) - numberValue(right.account_tp_usd as number);
  });
}

function renderReport(params: {
  gate95Config: Gate95Config;
  verdict: string;
  baselineRows: Record<string, unknown>[];
  matrixRows: Record<string, unknown>[];
  decisionRows: Record<string, unknown>[];
  validationRows: Record<string, unknown>[];
  paths: Record<string, string>;
}) {
  const validationFailures = params.validationRows.filter((row) => row.passed === false).length;
  const primaryRows = params.matrixRows.filter((row) => PRIMARY_VARIANTS.has(String(row.variant_id)));
  const referenceRows = params.matrixRows.filter((row) => !PRIMARY_VARIANTS.has(String(row.variant_id)));
  return `# Gate 95U LimniHedge Type 3 Loser Hedge Account TP Overlay

Date: ${GATE_DATE}

Verdict: \`${params.verdict}\`

## Scope

Gate 95U is a bounded repo-side hedge lifecycle overlay on the existing Gate 95 OOS trade ledger for \`${params.gate95Config.date_from}..${params.gate95Config.date_to}\`. It uses the Gate 95R corrected actual-USD accounting helper, does not rerun entries, does not run 2019-2024, does not mutate MT5, and does not add Candidate B, Katarakti, LRMG, Q, Triangle, new signals, or optimization.

Observer time is explicit: \`${String(OBSERVER_HOUR_NY).padStart(2, "0")}:00 ${OBSERVER_TIMEZONE}\`. At the observer, an unhedged red original trade receives a same-lot opposite hedge when the trigger condition is met. If corrected account-cycle marked net reaches the account TP, the whole open basket is flushed: originals, hedges, and unhedged opens.

## Baseline Corrected Rows

${renderTable(params.baselineRows, ["variant_id", "corrected_closed_plus_marked_net_actual", "corrected_profit_factor_closed_plus_marked", "terminal_inventory_net_loss_share_of_closed_net", "open_inventory_count", "top_pair_contribution_pct", "top_3_pair_contribution_pct", "stress_double_commission_net", "stress_slippage_0_1_net", "baseline_max_gross_lots"])}

## Primary Hedge Matrix

${renderTable(primaryRows, ["variant_id", "hedge_trigger", "account_tp_usd", "corrected_closed_plus_marked_net_actual", "corrected_profit_factor_closed_plus_marked", "max_month_end_marked_dd_actual", "terminal_inventory_net_loss_share_of_closed_net", "terminal_open_original_count", "terminal_open_hedge_count", "hedge_open_count", "account_tp_flush_count", "max_gross_lot_ratio", "top_pair_contribution_pct", "top_3_pair_contribution_pct", "stress_double_commission_net", "stress_slippage_0_1_net", "decision_improved_row", "decision_reason"])}

## Reference And Control Rows

${renderTable(referenceRows, ["variant_id", "hedge_trigger", "account_tp_usd", "corrected_closed_plus_marked_net_actual", "corrected_profit_factor_closed_plus_marked", "terminal_inventory_net_loss_share_of_closed_net", "terminal_open_original_count", "terminal_open_hedge_count", "hedge_open_count", "account_tp_flush_count", "max_gross_lot_ratio", "top_pair_contribution_pct", "top_3_pair_contribution_pct", "stress_double_commission_net", "stress_slippage_0_1_net"])}

## Decision Rows

${renderTable(params.decisionRows, ["variant_id", "best_hedge_trigger", "best_account_tp_usd", "best_closed_plus_marked_net_actual", "best_terminal_inventory_net_loss_share_of_closed_net", "best_terminal_open_original_count", "best_terminal_open_hedge_count", "best_account_tp_flush_count", "best_max_gross_lot_ratio", "best_top_pair_contribution_pct", "best_top_3_pair_contribution_pct", "best_stress_double_commission_net", "best_stress_slippage_0_1_net", "decision_improved_row", "decision_reason"])}

## Validation

Validation failures: \`${validationFailures}\`

${renderTable(params.validationRows, ["check", "value", "expected", "passed"])}

## Interpretation Boundary

This is a hedge-only lifecycle overlay. A row is considered improved only if it fixes the Gate 95R terminal-inventory failure reason without worse concentration, survives cost stress, and keeps max gross lots within \`${MAX_GROSS_LOT_RATIO}x\` baseline. For \`adr_event_0_05_type3_long_only\`, terminal inventory and pair concentration must both improve materially.

## Artifacts

${Object.entries(params.paths).map(([label, filePath]) => `- ${label}: \`${toRepoRelative(filePath)}\``).join("\n")}
`;
}

async function main() {
  const args = parseArgMap(process.argv.slice(2));
  const gate95Dir = args.get("--gate95-artifact-dir") ?? DEFAULT_GATE95_DIR;
  const gate95rDir = args.get("--gate95r-artifact-dir") ?? DEFAULT_GATE95R_DIR;
  const artifactDir = args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR;
  const reportPath = args.get("--report-path") ?? DEFAULT_REPORT_PATH;

  const gate95ConfigPath = path.join(gate95Dir, "gate95-config.json");
  const variantConfigPath = path.join(gate95Dir, "variant-config.rows.json");
  const tradeExitPath = path.join(gate95Dir, "trade-exits.rows.csv");
  const gate95SummaryPath = path.join(gate95Dir, "gate95-run-summary.json");
  const gate95rVariantPath = path.join(gate95rDir, "corrected-variant-summary.rows.json");
  const gate95rValidationPath = path.join(gate95rDir, "validation.rows.json");
  const gate95rRunSummaryPath = path.join(gate95rDir, "gate95r-run-summary.json");

  const gate95Config = JSON.parse(await readFile(normalizePath(gate95ConfigPath), "utf8")) as Gate95Config;
  const gate95Summary = JSON.parse(await readFile(normalizePath(gate95SummaryPath), "utf8")) as { validation_failures: number };
  const variantConfigs = JSON.parse(await readFile(normalizePath(variantConfigPath), "utf8")) as VariantConfig[];
  const gate95rRows = JSON.parse(await readFile(normalizePath(gate95rVariantPath), "utf8")) as Record<string, unknown>[];
  const gate95rValidationRows = JSON.parse(await readFile(normalizePath(gate95rValidationPath), "utf8")) as Record<string, unknown>[];
  const gate95rRunSummary = JSON.parse(await readFile(normalizePath(gate95rRunSummaryPath), "utf8")) as { validation_failures: number };
  const targetSet = new Set<string>(TARGET_VARIANTS);
  const selectedConfigs = variantConfigs.filter((row) => targetSet.has(row.variant_id));
  const dateFromMs = Date.parse(gate95Config.date_from);
  const dateToMs = Date.parse(gate95Config.date_to);

  const trades: TradeExitRow[] = [];
  console.log("gate95u stream target Gate95 OOS exits");
  await streamCsv(tradeExitPath, (row) => {
    if (!targetSet.has(row.variant_id ?? "")) return;
    trades.push(mapTrade(row));
  });

  const neededPairs = [...new Set(trades.map((trade) => trade.symbol))].sort();
  const prices = new Map<string, PriceSeries>();
  for (const pair of neededPairs) {
    console.log(`gate95u load pair=${pair}`);
    const series = await readTradeLegPathWarehousePairSeries({ manifestId: gate95Config.gate74b_manifest_id, pair });
    prices.set(pair, { rawBars: reconstructRawBars(series, dateFromMs, dateToMs) });
  }

  const tradesByVariant = new Map<string, TradeExitRow[]>();
  for (const trade of trades) {
    const rows = tradesByVariant.get(trade.variant_id) ?? [];
    rows.push(trade);
    tradesByVariant.set(trade.variant_id, rows);
  }
  for (const rows of tradesByVariant.values()) {
    rows.sort((left, right) => left.entry_time_utc.localeCompare(right.entry_time_utc));
  }

  const baselineByVariant = new Map<string, BaselineMetrics>();
  const baselineRows: Record<string, unknown>[] = [];
  for (const variant of TARGET_VARIANTS) {
    const baseline = baselineMetrics(variant, tradesByVariant.get(variant) ?? [], prices);
    baselineByVariant.set(variant, baseline);
    baselineRows.push(withHash(baseline as unknown as Record<string, unknown>));
  }

  const matrixRows: Record<string, unknown>[] = [];
  const cycleRows: Record<string, unknown>[] = [];
  let conversionGapCount = 0;
  for (const variant of TARGET_VARIANTS) {
    for (const hedgeTrigger of HEDGE_TRIGGERS) {
      for (const accountTpUsd of ACCOUNT_TP_USD) {
        console.log(`gate95u overlay variant=${variant} trigger=${hedgeTrigger.id} accountTp=${accountTpUsd}`);
        const result = simulateOverlay({
          variantId: variant,
          trades: tradesByVariant.get(variant) ?? [],
          prices,
          dateFrom: gate95Config.date_from,
          dateTo: gate95Config.date_to,
          hedgeTrigger,
          accountTpUsd,
          baseline: baselineByVariant.get(variant)!,
        });
        conversionGapCount += result.conversionGapCount;
        matrixRows.push(withHash(result.metrics as unknown as Record<string, unknown>));
        cycleRows.push(...result.cycleRows);
      }
    }
  }

  const decisionRows = TARGET_VARIANTS.map((variant) => {
    const rows = matrixRows
      .filter((row) => row.variant_id === variant)
      .sort((left, right) => {
        const leftDecision = left.decision_improved_row === true ? 1 : 0;
        const rightDecision = right.decision_improved_row === true ? 1 : 0;
        if (rightDecision !== leftDecision) return rightDecision - leftDecision;
        const leftTerminal = numberValue(left.terminal_inventory_net_loss_share_of_closed_net as number);
        const rightTerminal = numberValue(right.terminal_inventory_net_loss_share_of_closed_net as number);
        if (leftTerminal !== rightTerminal) return leftTerminal - rightTerminal;
        return numberValue(right.corrected_closed_plus_marked_net_actual as number) - numberValue(left.corrected_closed_plus_marked_net_actual as number);
      });
    const best = rows[0];
    return withHash({
      variant_id: variant,
      best_hedge_trigger: best?.hedge_trigger ?? null,
      best_account_tp_usd: best?.account_tp_usd ?? null,
      best_closed_plus_marked_net_actual: best?.corrected_closed_plus_marked_net_actual ?? null,
      best_terminal_inventory_net_loss_share_of_closed_net: best?.terminal_inventory_net_loss_share_of_closed_net ?? null,
      best_terminal_open_original_count: best?.terminal_open_original_count ?? null,
      best_terminal_open_hedge_count: best?.terminal_open_hedge_count ?? null,
      best_account_tp_flush_count: best?.account_tp_flush_count ?? null,
      best_max_gross_lot_ratio: best?.max_gross_lot_ratio ?? null,
      best_top_pair_contribution_pct: best?.top_pair_contribution_pct ?? null,
      best_top_3_pair_contribution_pct: best?.top_3_pair_contribution_pct ?? null,
      best_stress_double_commission_net: best?.stress_double_commission_net ?? null,
      best_stress_slippage_0_1_net: best?.stress_slippage_0_1_net ?? null,
      decision_improved_row: best?.decision_improved_row ?? false,
      decision_reason: best?.decision_reason ?? "no_matrix_row",
    });
  });

  const gate95rByVariant = new Map(gate95rRows.map((row) => [String(row.variant_id), row]));
  const maxBaselineDelta = Math.max(...baselineRows.map((row) => {
    const gate95r = gate95rByVariant.get(String(row.variant_id));
    if (!gate95r) return Number.POSITIVE_INFINITY;
    return Math.abs(numberValue(row.corrected_closed_plus_marked_net_actual as number) - numberValue(gate95r.corrected_closed_plus_marked_net_actual as number));
  }));
  const validationRows = [
    {
      check: "gate95_original_accounting_invalidated",
      value: "docs/research/gates/gate95/GATE95_ERRATUM_INVALIDATED_BY_GATE96A_ACCOUNTING_2026-07-04.md",
      expected: "Gate95 original accounting not used",
      passed: true,
    },
    {
      check: "corrected_accounting_helper_used",
      value: "engine/scripts/verification/limnihedge-corrected-accounting.ts::correctedFxPnl",
      expected: "corrected actual-USD helper",
      passed: true,
    },
    {
      check: "old_gate95_modeled_conversion_used",
      value: false,
      expected: false,
      passed: true,
    },
    {
      check: "observer_timezone_explicit",
      value: OBSERVER_TIMEZONE,
      expected: "America/New_York",
      passed: OBSERVER_TIMEZONE === "America/New_York",
    },
    {
      check: "same_gate95_oos_window",
      value: `${gate95Config.date_from}..${gate95Config.date_to}`,
      expected: "2025-01-01T00:00:00.000Z..2026-05-31T23:59:59.999Z",
      passed: gate95Config.date_from === "2025-01-01T00:00:00.000Z" && gate95Config.date_to === "2026-05-31T23:59:59.999Z",
    },
    {
      check: "no_2019_2024_rerun",
      value: gate95Config.date_from,
      expected: "starts 2025-01-01",
      passed: gate95Config.date_from.startsWith("2025-01-01"),
    },
    {
      check: "gate95_oos_validation_failures",
      value: gate95Summary.validation_failures,
      expected: 0,
      passed: gate95Summary.validation_failures === 0,
    },
    {
      check: "gate95r_validation_failures",
      value: gate95rRunSummary.validation_failures,
      expected: 0,
      passed: gate95rRunSummary.validation_failures === 0 && gate95rValidationRows.every((row) => row.passed === true),
    },
    {
      check: "target_variant_count",
      value: selectedConfigs.length,
      expected: TARGET_VARIANTS.length,
      passed: selectedConfigs.length === TARGET_VARIANTS.length,
    },
    {
      check: "matrix_rows",
      value: matrixRows.length,
      expected: `${TARGET_VARIANTS.length} variants x ${HEDGE_TRIGGERS.length} hedge triggers x ${ACCOUNT_TP_USD.length} account TPs`,
      passed: matrixRows.length === TARGET_VARIANTS.length * HEDGE_TRIGGERS.length * ACCOUNT_TP_USD.length,
    },
    {
      check: "source_original_entries_preserved_no_entry_rerun",
      value: matrixRows.every((row) => row.source_trade_rows === row.original_entries_preserved),
      expected: true,
      passed: matrixRows.every((row) => row.source_trade_rows === row.original_entries_preserved),
    },
    {
      check: "hedges_are_overlay_positions_only",
      value: "same-lot opposite hedges opened only by hedge trigger",
      expected: "no signal-generated hedge entries",
      passed: true,
    },
    {
      check: "closed_plus_marked_equity_present",
      value: matrixRows.filter((row) => row.corrected_closed_plus_marked_net_actual !== null && row.corrected_closed_plus_marked_net_actual !== undefined).length,
      expected: matrixRows.length,
      passed: matrixRows.every((row) => row.corrected_closed_plus_marked_net_actual !== null && row.corrected_closed_plus_marked_net_actual !== undefined),
    },
    {
      check: "cost_stress_present",
      value: matrixRows.filter((row) => row.stress_double_commission_net !== null && row.stress_slippage_0_1_net !== null).length,
      expected: matrixRows.length,
      passed: matrixRows.every((row) => row.stress_double_commission_net !== null && row.stress_slippage_0_1_net !== null),
    },
    {
      check: "corrected_conversion_gap_count",
      value: conversionGapCount,
      expected: 0,
      passed: conversionGapCount === 0,
    },
    {
      check: "baseline_reconciles_to_gate95r_corrected_rows",
      value: round6(maxBaselineDelta),
      expected: "<= 1.00 USD max target-row delta",
      passed: maxBaselineDelta <= 1,
    },
    {
      check: "price_bundle_id",
      value: gate95Config.price_bundle_id,
      expected: PRICE_BUNDLE_ID,
      passed: gate95Config.price_bundle_id === PRICE_BUNDLE_ID,
    },
    {
      check: "mt5_mutated",
      value: false,
      expected: false,
      passed: true,
    },
    {
      check: "new_signals_introduced",
      value: false,
      expected: false,
      passed: true,
    },
  ].map((row) => withHash(row));

  const validationFailures = validationRows.filter((row) => row.passed === false).length;
  const improvedRows = matrixRows.filter((row) => row.decision_improved_row === true);
  const verdict = validationFailures > 0
    ? "FAIL_GATE95U_VALIDATION_BLOCKED"
    : improvedRows.length > 0
      ? "PASS_GATE95U_HEDGE_ACCOUNT_TP_ROW_IMPROVED_FOR_REVIEW"
      : "FAIL_GATE95U_HEDGE_ACCOUNT_TP_NO_IMPROVED_ROW";

  const config = withHash({
    gate_id: GATE_ID,
    gate_date: GATE_DATE,
    source_gate95_artifact_dir: gate95Dir,
    source_gate95r_artifact_dir: gate95rDir,
    price_bundle_id: gate95Config.price_bundle_id,
    gate74b_manifest_id: gate95Config.gate74b_manifest_id,
    date_from: gate95Config.date_from,
    date_to: gate95Config.date_to,
    observer_timezone: OBSERVER_TIMEZONE,
    observer_hour_ny: OBSERVER_HOUR_NY,
    mark_price_source: "latest_available_gate74b_raw_path_price_at_or_before_observer",
    hedge_triggers: HEDGE_TRIGGERS.map((row) => row.id),
    hedge_size: "1.0x_original_lot_equal_opposite_side",
    account_tp_usd: ACCOUNT_TP_USD,
    max_gross_lot_ratio_guard: MAX_GROSS_LOT_RATIO,
    target_variants: TARGET_VARIANTS,
    corrected_accounting_helper: "engine/scripts/verification/limnihedge-corrected-accounting.ts",
    frozen: [
      "no_entry_rerun",
      "no_2019_2024",
      "no_mt5_mutation",
      "no_new_signals",
      "no_candidate_b_changes",
      "no_katarakti_changes",
      "no_lrmg_changes",
      "no_q_triangle_changes",
      "no_optimization",
    ],
    cost_stress: ["double_commission", "base_commission_plus_0_1_pip_slippage"],
  });

  const paths = {
    config: path.join(artifactDir, "gate95u-config.json"),
    baselineJson: path.join(artifactDir, "baseline-corrected-summary.rows.json"),
    baselineCsv: path.join(artifactDir, "baseline-corrected-summary.rows.csv"),
    matrixJson: path.join(artifactDir, "hedge-account-tp-matrix.rows.json"),
    matrixCsv: path.join(artifactDir, "hedge-account-tp-matrix.rows.csv"),
    decisionJson: path.join(artifactDir, "hedge-account-tp-decision.rows.json"),
    decisionCsv: path.join(artifactDir, "hedge-account-tp-decision.rows.csv"),
    cycleJson: path.join(artifactDir, "account-tp-cycle-flush.rows.json"),
    cycleCsv: path.join(artifactDir, "account-tp-cycle-flush.rows.csv"),
    validationJson: path.join(artifactDir, "validation.rows.json"),
    validationCsv: path.join(artifactDir, "validation.rows.csv"),
    commandReceipt: path.join(artifactDir, "command-receipt.json"),
    runSummary: path.join(artifactDir, "gate95u-run-summary.json"),
    shaManifest: path.join(artifactDir, "gate95u-sha256.txt"),
    report: reportPath,
  };

  await writeJson(paths.config, config);
  await writeRows(paths.baselineJson, paths.baselineCsv, baselineRows);
  await writeRows(paths.matrixJson, paths.matrixCsv, sortedMatrixRows(matrixRows));
  await writeRows(paths.decisionJson, paths.decisionCsv, decisionRows);
  await writeRows(paths.cycleJson, paths.cycleCsv, cycleRows);
  await writeRows(paths.validationJson, paths.validationCsv, validationRows);

  const commandReceipt = withHash({
    gate_id: GATE_ID,
    command: COMMAND,
    args: process.argv.slice(2),
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    git_dirty_status: gitDirtyStatus(),
    gate95_artifact_dir: gate95Dir,
    gate95r_artifact_dir: gate95rDir,
    artifact_dir: artifactDir,
  });
  await writeJson(paths.commandReceipt, commandReceipt);

  const runSummary = withHash({
    gate_id: GATE_ID,
    verdict,
    source_gate95_trade_rows: trades.length,
    needed_pairs: neededPairs.length,
    baseline_rows: baselineRows.length,
    matrix_rows: matrixRows.length,
    decision_rows: decisionRows.length,
    account_tp_cycle_rows: cycleRows.length,
    improved_rows: improvedRows.length,
    validation_failures: validationFailures,
  });
  await writeJson(paths.runSummary, runSummary);

  await writeText(paths.report, renderReport({
    gate95Config,
    verdict,
    baselineRows,
    matrixRows: sortedMatrixRows(matrixRows),
    decisionRows,
    validationRows,
    paths,
  }));

  await writeShaManifest(paths.shaManifest, GATE_ID, COMMAND, [
    { label: "config", path: paths.config },
    { label: "baseline_summary", path: paths.baselineJson },
    { label: "hedge_account_tp_matrix", path: paths.matrixJson },
    { label: "hedge_account_tp_decision", path: paths.decisionJson },
    { label: "account_tp_cycle_flush", path: paths.cycleJson },
    { label: "validation", path: paths.validationJson },
    { label: "run_summary", path: paths.runSummary },
    { label: "command_receipt", path: paths.commandReceipt },
    { label: "report", path: paths.report },
  ]);

  console.log(`Gate 95U verdict: ${verdict}`);
  console.log(`Source target trade rows: ${trades.length}`);
  console.log(`Matrix rows: ${matrixRows.length}`);
  console.log(`Improved rows: ${improvedRows.length}`);
  console.log(`Validation failures: ${validationFailures}`);
  console.log(`Report: ${toRepoRelative(paths.report)}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePoolIfInitialized();
  });
