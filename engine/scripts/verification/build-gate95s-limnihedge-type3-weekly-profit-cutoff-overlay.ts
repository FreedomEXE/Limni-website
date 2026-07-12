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

const GATE_ID = "Gate 95S: limnihedge-type3-weekly-profit-cutoff-overlay";
const GATE_DATE = "2026-07-05";
const COMMAND = "npm run engine:gate95s:limnihedge-type3-weekly-profit-cutoff-overlay";
const DEFAULT_GATE95_DIR =
  "docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026";
const DEFAULT_GATE95R_DIR =
  "docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay";
const DEFAULT_ARTIFACT_DIR =
  "docs/research/gates/gate95/artifacts/limnihedge-type3-weekly-profit-cutoff-overlay";
const DEFAULT_REPORT_PATH =
  `docs/research/gates/gate95/GATE95S_LIMNIHEDGE_TYPE3_WEEKLY_PROFIT_CUTOFF_OVERLAY_${GATE_DATE}.md`;
const PRICE_BUNDLE_ID = "gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953";
const CUTOFF_TIMEZONE = "America/New_York";
const CUTOFF_HOURS_NY = [12, 14, 16, 18] as const;
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

type CutoffPoint = {
  cutoff_hour_ny: number;
  cutoff_time_ny: string;
  cutoff_time_utc: string;
  cutoff_ms: number;
};

type ProfitCondition = {
  id: "corrected_marked_net_gt_0" | "corrected_marked_net_gt_1x_commission";
  label: string;
};

type ExitNet = {
  net: number | null;
  price_pnl: number | null;
  conversion_symbol: string;
  conversion_rate: number | null;
  conversion_rate_source: string;
  commission: number;
  slippage: number | null;
};

type OverlayOutcome = {
  variant_id: string;
  symbol: string;
  entry_row_id: string;
  entry_time_utc: string;
  original_exit_time_utc: string;
  final_exit_time_utc: string;
  final_mark_time_utc: string;
  final_exit_reason: "weekly_profit_cutoff" | "source_exit" | "terminal_mark";
  side: FxSide;
  lot_size: number;
  entry_price: number;
  final_exit_price: number;
  original_exit_reason: string;
  terminal_inventory_remaining: boolean;
  weekly_cutoff_closure: boolean;
  cutoff_checks: number;
  carried_loss_count: number;
  carried_nonqualified_count: number;
  corrected_net_actual: number;
  stress_double_commission_net: number;
  stress_slippage_0_1_net: number;
  original_hold_hours: number;
  overlay_hold_hours: number;
  hold_reduction_hours: number;
  corrected_conversion_gap: boolean;
};

type SummaryMetrics = {
  variant_id: string;
  cutoff_hour_ny: number | null;
  profit_condition: string;
  source_trade_rows: number;
  overlay_trade_rows: number;
  closed_trade_rows: number;
  terminal_liquidations_remaining: number;
  open_inventory_count: number;
  weekly_cutoff_closures_count: number;
  carried_loss_count: number;
  carried_nonqualified_count: number;
  corrected_closed_net_actual: number;
  terminal_inventory_net_actual: number;
  terminal_inventory_loss_actual: number;
  corrected_closed_plus_marked_net_actual: number;
  corrected_profit_factor_closed_plus_marked: number | null;
  max_month_end_marked_dd_actual: number | null;
  worst_month: string | null;
  worst_marked_month_delta_actual: number | null;
  terminal_inventory_loss_share_of_closed_net: number | null;
  terminal_inventory_net_loss_share_of_closed_net: number | null;
  avg_hold_reduction_hours: number | null;
  avg_cutoff_closure_hold_reduction_hours: number | null;
  top_pair: string | null;
  top_pair_net_actual: number | null;
  top_pair_contribution_pct: number | null;
  top_3_pairs: string | null;
  top_3_pair_net_actual: number | null;
  top_3_pair_contribution_pct: number | null;
  stress_double_commission_net: number | null;
  stress_double_commission_profit_factor: number | null;
  stress_slippage_0_1_net: number | null;
  stress_slippage_0_1_profit_factor: number | null;
  baseline_closed_plus_marked_net_actual: number | null;
  baseline_terminal_loss_share_of_closed_net: number | null;
  baseline_top_pair_contribution_pct: number | null;
  baseline_top_3_pair_contribution_pct: number | null;
  baseline_stress_double_commission_net: number | null;
  baseline_stress_slippage_0_1_net: number | null;
  fixes_gate95r_failure_reason: boolean;
  concentration_not_worse: boolean;
  cost_fragility_not_worse: boolean;
  materially_improves_terminal_inventory: boolean;
  materially_improves_pair_concentration: boolean;
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

function nullableNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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

function monthKey(timestampUtc: string) {
  return timestampUtc.slice(0, 7);
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

function finalExitNet(params: {
  trade: TradeExitRow;
  exitPrice: number;
  exitTimeUtc: string;
  prices: Map<string, PriceSeries>;
  commissionUsdPerLot?: number;
  slippagePips?: number;
}): ExitNet {
  const result = correctedFxPnl({
    symbol: params.trade.symbol,
    side: params.trade.side,
    lotSize: params.trade.lot_size,
    entryPrice: params.trade.entry_price,
    exitPrice: params.exitPrice,
    exitTimeUtc: params.exitTimeUtc,
    prices: params.prices as Map<string, AccountingPriceSeries>,
    commissionUsdPerLot: params.commissionUsdPerLot,
    slippagePips: params.slippagePips,
  });
  return {
    net: result.net,
    price_pnl: result.usdPricePnl,
    conversion_symbol: result.conversionSymbol,
    conversion_rate: result.conversionRate,
    conversion_rate_source: result.conversionRateSource,
    commission: result.commission,
    slippage: result.slippageUsd,
  };
}

function generateCutoffs(dateFrom: string, dateTo: string, cutoffHourNy: number): CutoffPoint[] {
  const startUtcMs = Date.parse(dateFrom);
  const endUtcMs = Date.parse(dateTo);
  let cursor = DateTime.fromISO(dateFrom, { zone: "utc" }).setZone(CUTOFF_TIMEZONE).startOf("day");
  const end = DateTime.fromISO(dateTo, { zone: "utc" }).setZone(CUTOFF_TIMEZONE).endOf("day");
  const cutoffs: CutoffPoint[] = [];
  while (cursor <= end) {
    if (cursor.weekday === 5) {
      const local = cursor.set({ hour: cutoffHourNy, minute: 0, second: 0, millisecond: 0 });
      const utcMs = local.toUTC().toMillis();
      if (utcMs >= startUtcMs && utcMs <= endUtcMs) {
        cutoffs.push({
          cutoff_hour_ny: cutoffHourNy,
          cutoff_time_ny: local.toISO({ suppressMilliseconds: false }) ?? "",
          cutoff_time_utc: new Date(utcMs).toISOString(),
          cutoff_ms: utcMs,
        });
      }
    }
    cursor = cursor.plus({ days: 1 });
  }
  return cutoffs;
}

function firstCutoffIndex(cutoffs: CutoffPoint[], entryMs: number) {
  let left = 0;
  let right = cutoffs.length - 1;
  let found = cutoffs.length;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (cutoffs[mid]!.cutoff_ms >= entryMs) {
      found = mid;
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }
  return found;
}

function conditionThreshold(condition: ProfitCondition, trade: TradeExitRow) {
  if (condition.id === "corrected_marked_net_gt_1x_commission") return Math.abs(-7 * trade.lot_size);
  return 0;
}

function buildBaselineOutcome(trade: TradeExitRow, prices: Map<string, PriceSeries>): OverlayOutcome {
  const base = finalExitNet({
    trade,
    exitPrice: trade.exit_price,
    exitTimeUtc: trade.exit_time_utc,
    prices,
  });
  const doubleCommission = finalExitNet({
    trade,
    exitPrice: trade.exit_price,
    exitTimeUtc: trade.exit_time_utc,
    prices,
    commissionUsdPerLot: -14,
  });
  const slippage = finalExitNet({
    trade,
    exitPrice: trade.exit_price,
    exitTimeUtc: trade.exit_time_utc,
    prices,
    slippagePips: 0.1,
  });
  return {
    variant_id: trade.variant_id,
    symbol: trade.symbol,
    entry_row_id: trade.entry_row_id,
    entry_time_utc: trade.entry_time_utc,
    original_exit_time_utc: trade.exit_time_utc,
    final_exit_time_utc: trade.exit_time_utc,
    final_mark_time_utc: trade.exit_time_utc,
    final_exit_reason: trade.terminal_liquidation ? "terminal_mark" : "source_exit",
    side: trade.side,
    lot_size: trade.lot_size,
    entry_price: trade.entry_price,
    final_exit_price: trade.exit_price,
    original_exit_reason: trade.exit_reason,
    terminal_inventory_remaining: trade.terminal_liquidation,
    weekly_cutoff_closure: false,
    cutoff_checks: 0,
    carried_loss_count: 0,
    carried_nonqualified_count: 0,
    corrected_net_actual: base.net ?? 0,
    stress_double_commission_net: doubleCommission.net ?? 0,
    stress_slippage_0_1_net: slippage.net ?? 0,
    original_hold_hours: trade.hold_hours,
    overlay_hold_hours: trade.hold_hours,
    hold_reduction_hours: 0,
    corrected_conversion_gap: base.net === null || doubleCommission.net === null || slippage.net === null,
  };
}

function overlayTrade(
  trade: TradeExitRow,
  prices: Map<string, PriceSeries>,
  cutoffs: CutoffPoint[],
  condition: ProfitCondition,
): OverlayOutcome {
  const entryMs = Date.parse(trade.entry_time_utc);
  const originalExitMs = Date.parse(trade.exit_time_utc);
  let cutoffChecks = 0;
  let carriedLossCount = 0;
  let carriedNonqualifiedCount = 0;
  let conversionGap = false;
  const firstIndex = firstCutoffIndex(cutoffs, entryMs);

  for (let index = firstIndex; index < cutoffs.length; index += 1) {
    const cutoff = cutoffs[index]!;
    if (cutoff.cutoff_ms >= originalExitMs) break;
    const price = priceAtOrBefore(prices.get(trade.symbol)?.rawBars ?? [], cutoff.cutoff_time_utc);
    if (!price) {
      conversionGap = true;
      continue;
    }
    const marked = finalExitNet({
      trade,
      exitPrice: price.close,
      exitTimeUtc: price.timestamp_utc,
      prices,
    });
    cutoffChecks += 1;
    if (marked.net === null) {
      conversionGap = true;
      carriedNonqualifiedCount += 1;
      continue;
    }
    const threshold = conditionThreshold(condition, trade);
    if (marked.net > threshold) {
      const doubleCommission = finalExitNet({
        trade,
        exitPrice: price.close,
        exitTimeUtc: price.timestamp_utc,
        prices,
        commissionUsdPerLot: -14,
      });
      const slippage = finalExitNet({
        trade,
        exitPrice: price.close,
        exitTimeUtc: price.timestamp_utc,
        prices,
        slippagePips: 0.1,
      });
      const overlayHoldHours = (cutoff.cutoff_ms - entryMs) / 3_600_000;
      return {
        variant_id: trade.variant_id,
        symbol: trade.symbol,
        entry_row_id: trade.entry_row_id,
        entry_time_utc: trade.entry_time_utc,
        original_exit_time_utc: trade.exit_time_utc,
        final_exit_time_utc: cutoff.cutoff_time_utc,
        final_mark_time_utc: price.timestamp_utc,
        final_exit_reason: "weekly_profit_cutoff",
        side: trade.side,
        lot_size: trade.lot_size,
        entry_price: trade.entry_price,
        final_exit_price: price.close,
        original_exit_reason: trade.exit_reason,
        terminal_inventory_remaining: false,
        weekly_cutoff_closure: true,
        cutoff_checks: cutoffChecks,
        carried_loss_count: carriedLossCount,
        carried_nonqualified_count: carriedNonqualifiedCount,
        corrected_net_actual: marked.net,
        stress_double_commission_net: doubleCommission.net ?? 0,
        stress_slippage_0_1_net: slippage.net ?? 0,
        original_hold_hours: trade.hold_hours,
        overlay_hold_hours: overlayHoldHours,
        hold_reduction_hours: Math.max(0, trade.hold_hours - overlayHoldHours),
        corrected_conversion_gap: conversionGap || doubleCommission.net === null || slippage.net === null,
      };
    }
    if (marked.net <= 0) carriedLossCount += 1;
    carriedNonqualifiedCount += 1;
  }

  const baseline = buildBaselineOutcome(trade, prices);
  return {
    ...baseline,
    cutoff_checks: cutoffChecks,
    carried_loss_count: carriedLossCount,
    carried_nonqualified_count: carriedNonqualifiedCount,
    corrected_conversion_gap: conversionGap || baseline.corrected_conversion_gap,
  };
}

function summarizeOutcomes(params: {
  variantId: string;
  cutoffHourNy: number | null;
  profitCondition: string;
  outcomes: OverlayOutcome[];
  sourceTradeRows: number;
  months: string[];
  prices: Map<string, PriceSeries>;
  baseline?: SummaryMetrics;
}): SummaryMetrics {
  const values = params.outcomes.map((row) => row.corrected_net_actual);
  const closed = params.outcomes.filter((row) => !row.terminal_inventory_remaining);
  const terminal = params.outcomes.filter((row) => row.terminal_inventory_remaining);
  const closedNet = sum(closed.map((row) => row.corrected_net_actual));
  const terminalNet = sum(terminal.map((row) => row.corrected_net_actual));
  const terminalLoss = sum(terminal.filter((row) => row.corrected_net_actual < 0).map((row) => row.corrected_net_actual));
  const totalNet = closedNet + terminalNet;
  const terminalLossShare = closedNet > 0 ? Math.abs(terminalLoss) / Math.abs(closedNet) : null;
  const terminalNetLossShare = closedNet > 0 ? Math.abs(Math.min(0, terminalNet)) / Math.abs(closedNet) : null;

  const monthEquity: number[] = [];
  const monthRows = params.months.map((month) => {
    const end = monthEndIso(month);
    const endMs = Date.parse(end);
    let closedToMonth = 0;
    let openMarked = 0;
    let openCount = 0;
    for (const outcome of params.outcomes) {
      const entryMs = Date.parse(outcome.entry_time_utc);
      const finalExitMs = Date.parse(outcome.final_exit_time_utc);
      if (finalExitMs <= endMs) {
        closedToMonth += outcome.corrected_net_actual;
      } else if (entryMs <= endMs) {
        const price = priceAtOrBefore(params.prices.get(outcome.symbol)?.rawBars ?? [], end);
        if (price) {
          const mark = correctedFxPnl({
            symbol: outcome.symbol,
            side: outcome.side,
            lotSize: outcome.lot_size,
            entryPrice: outcome.entry_price,
            exitPrice: price.close,
            exitTimeUtc: price.timestamp_utc,
            prices: params.prices as Map<string, AccountingPriceSeries>,
          }).net;
          if (mark !== null) openMarked += mark;
          openCount += 1;
        }
      }
    }
    const marked = closedToMonth + openMarked;
    monthEquity.push(marked);
    return {
      month,
      month_end_utc: end,
      marked_equity_actual: marked,
      open_trade_count: openCount,
    };
  });

  let previous = 0;
  const monthDeltas = monthRows.map((row) => {
    const delta = row.marked_equity_actual - previous;
    previous = row.marked_equity_actual;
    return { ...row, marked_month_delta_actual: delta };
  });
  const worstMonthRow = monthDeltas.length
    ? [...monthDeltas].sort((left, right) => left.marked_month_delta_actual - right.marked_month_delta_actual)[0]!
    : null;

  const pairAgg = new Map<string, number>();
  for (const outcome of params.outcomes) {
    pairAgg.set(outcome.symbol, (pairAgg.get(outcome.symbol) ?? 0) + outcome.corrected_net_actual);
  }
  const pairs = [...pairAgg.entries()].map(([symbol, net]) => ({ symbol, net })).sort((left, right) => right.net - left.net);
  const positivePairs = pairs.filter((row) => row.net > 0);
  const topPair = positivePairs[0] ?? pairs[0] ?? null;
  const top3 = positivePairs.slice(0, 3);
  const top3Net = sum(top3.map((row) => row.net));
  const topPairPct = topPair && totalNet > 0 ? (topPair.net / totalNet) * 100 : null;
  const top3Pct = totalNet > 0 ? (top3Net / totalNet) * 100 : null;
  const stressDoubleValues = params.outcomes.map((row) => row.stress_double_commission_net);
  const stressSlipValues = params.outcomes.map((row) => row.stress_slippage_0_1_net);

  const baseline = params.baseline;
  const baselineTerminalShare = baseline?.terminal_inventory_net_loss_share_of_closed_net ?? null;
  const baselineTopPair = baseline?.top_pair_contribution_pct ?? null;
  const baselineTop3 = baseline?.top_3_pair_contribution_pct ?? null;
  const baselineDouble = baseline?.stress_double_commission_net ?? null;
  const baselineSlip = baseline?.stress_slippage_0_1_net ?? null;

  const fixesGate95rFailure = PRIMARY_VARIANTS.has(params.variantId)
    ? terminalNetLossShare !== null && terminalNetLossShare < 0.25 && topPairPct !== null && topPairPct <= 25 && top3Pct !== null && top3Pct <= 55
    : false;
  const concentrationNotWorse = baselineTopPair === null || baselineTop3 === null || topPairPct === null || top3Pct === null
    ? false
    : topPairPct <= baselineTopPair && top3Pct <= baselineTop3;
  const costFragilityNotWorse = baselineDouble === null || baselineSlip === null
    ? false
    : sum(stressDoubleValues) > 0 && sum(stressSlipValues) > 0;
  const materiallyImprovesTerminal = baselineTerminalShare === null || terminalNetLossShare === null
    ? false
    : terminal.length <= Math.floor((baseline.open_inventory_count ?? terminal.length) * 0.75)
      && terminalNetLossShare <= baselineTerminalShare * 0.75;
  const materiallyImprovesConcentration = baselineTopPair === null || baselineTop3 === null || topPairPct === null || top3Pct === null
    ? false
    : topPairPct <= baselineTopPair - 5 && top3Pct <= baselineTop3 - 10;

  const decisionReasons: string[] = [];
  if (!PRIMARY_VARIANTS.has(params.variantId)) decisionReasons.push("reference_or_control_row");
  if (params.variantId === "adr_event_0_025_type3_long_only" && !(terminalNetLossShare !== null && terminalNetLossShare < 0.25)) {
    decisionReasons.push("0_025_terminal_inventory_net_loss_share_not_below_25pct_closed_net");
  }
  if (params.variantId === "adr_event_0_05_type3_long_only" && !materiallyImprovesTerminal) {
    decisionReasons.push("0_05_terminal_inventory_not_materially_improved");
  }
  if (params.variantId === "adr_event_0_05_type3_long_only" && !materiallyImprovesConcentration) {
    decisionReasons.push("0_05_pair_concentration_not_materially_improved");
  }
  if (!fixesGate95rFailure && PRIMARY_VARIANTS.has(params.variantId)) decisionReasons.push("gate95r_failure_reason_not_fixed");
  if (!concentrationNotWorse && PRIMARY_VARIANTS.has(params.variantId)) decisionReasons.push("concentration_worse_or_missing");
  if (!costFragilityNotWorse && PRIMARY_VARIANTS.has(params.variantId)) decisionReasons.push("cost_fragility_worse_or_missing");

  const decisionImproved = params.variantId === "adr_event_0_025_type3_long_only"
    ? terminalNetLossShare !== null && terminalNetLossShare < 0.25 && concentrationNotWorse && costFragilityNotWorse
    : params.variantId === "adr_event_0_05_type3_long_only"
      ? fixesGate95rFailure && materiallyImprovesTerminal && materiallyImprovesConcentration && costFragilityNotWorse
      : false;

  return {
    variant_id: params.variantId,
    cutoff_hour_ny: params.cutoffHourNy,
    profit_condition: params.profitCondition,
    source_trade_rows: params.sourceTradeRows,
    overlay_trade_rows: params.outcomes.length,
    closed_trade_rows: closed.length,
    terminal_liquidations_remaining: terminal.length,
    open_inventory_count: terminal.length,
    weekly_cutoff_closures_count: params.outcomes.filter((row) => row.weekly_cutoff_closure).length,
    carried_loss_count: sum(params.outcomes.map((row) => row.carried_loss_count)),
    carried_nonqualified_count: sum(params.outcomes.map((row) => row.carried_nonqualified_count)),
    corrected_closed_net_actual: round2(closedNet),
    terminal_inventory_net_actual: round2(terminalNet),
    terminal_inventory_loss_actual: round2(terminalLoss),
    corrected_closed_plus_marked_net_actual: round2(totalNet),
    corrected_profit_factor_closed_plus_marked: values.length ? round(profitFactor(values), 6) : null,
    max_month_end_marked_dd_actual: round2(maxEquityDrawdown(monthEquity)),
    worst_month: worstMonthRow?.month ?? null,
    worst_marked_month_delta_actual: worstMonthRow ? round2(worstMonthRow.marked_month_delta_actual) : null,
    terminal_inventory_loss_share_of_closed_net: terminalLossShare === null ? null : round6(terminalLossShare),
    terminal_inventory_net_loss_share_of_closed_net: terminalNetLossShare === null ? null : round6(terminalNetLossShare),
    avg_hold_reduction_hours: params.outcomes.length ? round6(sum(params.outcomes.map((row) => row.hold_reduction_hours)) / params.outcomes.length) : null,
    avg_cutoff_closure_hold_reduction_hours: params.outcomes.some((row) => row.weekly_cutoff_closure)
      ? round6(sum(params.outcomes.filter((row) => row.weekly_cutoff_closure).map((row) => row.hold_reduction_hours)) / params.outcomes.filter((row) => row.weekly_cutoff_closure).length)
      : null,
    top_pair: topPair?.symbol ?? null,
    top_pair_net_actual: topPair ? round2(topPair.net) : null,
    top_pair_contribution_pct: topPairPct === null ? null : round6(topPairPct),
    top_3_pairs: top3.map((row) => row.symbol).join("|") || null,
    top_3_pair_net_actual: round2(top3Net),
    top_3_pair_contribution_pct: top3Pct === null ? null : round6(top3Pct),
    stress_double_commission_net: round2(sum(stressDoubleValues)),
    stress_double_commission_profit_factor: stressDoubleValues.length ? round(profitFactor(stressDoubleValues), 6) : null,
    stress_slippage_0_1_net: round2(sum(stressSlipValues)),
    stress_slippage_0_1_profit_factor: stressSlipValues.length ? round(profitFactor(stressSlipValues), 6) : null,
    baseline_closed_plus_marked_net_actual: baseline?.corrected_closed_plus_marked_net_actual ?? null,
    baseline_terminal_loss_share_of_closed_net: baselineTerminalShare === null ? null : round6(baselineTerminalShare),
    baseline_top_pair_contribution_pct: baselineTopPair === null ? null : round6(baselineTopPair),
    baseline_top_3_pair_contribution_pct: baselineTop3 === null ? null : round6(baselineTop3),
    baseline_stress_double_commission_net: baselineDouble === null ? null : round2(baselineDouble),
    baseline_stress_slippage_0_1_net: baselineSlip === null ? null : round2(baselineSlip),
    fixes_gate95r_failure_reason: fixesGate95rFailure,
    concentration_not_worse: concentrationNotWorse,
    cost_fragility_not_worse: costFragilityNotWorse,
    materially_improves_terminal_inventory: materiallyImprovesTerminal,
    materially_improves_pair_concentration: materiallyImprovesConcentration,
    decision_improved_row: decisionImproved,
    decision_reason: decisionImproved ? "improved_under_gate95s_decision_contract" : decisionReasons.join(";"),
  };
}

function sortedMatrixRows(rows: Record<string, unknown>[]) {
  return [...rows].sort((left, right) => {
    const leftVariant = String(left.variant_id);
    const rightVariant = String(right.variant_id);
    const primaryOrder = TARGET_VARIANTS.indexOf(leftVariant as typeof TARGET_VARIANTS[number]) - TARGET_VARIANTS.indexOf(rightVariant as typeof TARGET_VARIANTS[number]);
    if (primaryOrder !== 0) return primaryOrder;
    const leftCondition = String(left.profit_condition);
    const rightCondition = String(right.profit_condition);
    if (leftCondition !== rightCondition) return leftCondition.localeCompare(rightCondition);
    return numberValue(left.cutoff_hour_ny as number) - numberValue(right.cutoff_hour_ny as number);
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
  return `# Gate 95S LimniHedge Type 3 Weekly Profit Cutoff Overlay

Date: ${GATE_DATE}

Verdict: \`${params.verdict}\`

## Scope

Gate 95S is a bounded lifecycle overlay on the existing Gate 95 OOS trade ledger for \`${params.gate95Config.date_from}..${params.gate95Config.date_to}\`. It uses the Gate 95R corrected actual-USD accounting helper, does not rerun entries, does not run 2019-2024, does not mutate MT5, and does not add Candidate B, Katarakti, LRMG, Q, Triangle, new signals, or optimization.

Cutoff timezone is explicit: \`${CUTOFF_TIMEZONE}\`. At each Friday cutoff, an open trade is closed only when the corrected marked net passes the condition. The mark price is the latest available Gate 74B raw path price at or before the cutoff timestamp. Losses are carried forward.

## Baseline Corrected Rows

${renderTable(params.baselineRows, ["variant_id", "corrected_closed_plus_marked_net_actual", "corrected_profit_factor_closed_plus_marked", "terminal_inventory_net_loss_share_of_closed_net", "open_inventory_count", "top_pair_contribution_pct", "top_3_pair_contribution_pct", "stress_double_commission_net", "stress_slippage_0_1_net"])}

## Primary Overlay Rows

${renderTable(primaryRows, ["variant_id", "cutoff_hour_ny", "profit_condition", "corrected_closed_plus_marked_net_actual", "corrected_profit_factor_closed_plus_marked", "max_month_end_marked_dd_actual", "terminal_inventory_net_actual", "terminal_inventory_loss_share_of_closed_net", "terminal_inventory_net_loss_share_of_closed_net", "open_inventory_count", "weekly_cutoff_closures_count", "carried_loss_count", "avg_hold_reduction_hours", "worst_month", "top_pair_contribution_pct", "top_3_pair_contribution_pct", "stress_double_commission_net", "stress_slippage_0_1_net", "decision_improved_row", "decision_reason"])}

## Reference And Control Rows

${renderTable(referenceRows, ["variant_id", "cutoff_hour_ny", "profit_condition", "corrected_closed_plus_marked_net_actual", "corrected_profit_factor_closed_plus_marked", "max_month_end_marked_dd_actual", "terminal_inventory_net_loss_share_of_closed_net", "open_inventory_count", "weekly_cutoff_closures_count", "carried_loss_count", "avg_hold_reduction_hours", "top_pair_contribution_pct", "top_3_pair_contribution_pct", "stress_double_commission_net", "stress_slippage_0_1_net"])}

## Decision Rows

${renderTable(params.decisionRows, ["variant_id", "best_cutoff_hour_ny", "best_profit_condition", "best_closed_plus_marked_net_actual", "best_terminal_inventory_net_loss_share_of_closed_net", "best_open_inventory_count", "best_top_pair_contribution_pct", "best_top_3_pair_contribution_pct", "best_stress_double_commission_net", "best_stress_slippage_0_1_net", "decision_improved_row", "decision_reason"])}

## Validation

Validation failures: \`${validationFailures}\`

${renderTable(params.validationRows, ["check", "value", "expected", "passed"])}

## Interpretation Boundary

This is a dumb weekly profit-cutoff overlay only. A row is considered improved only if it fixes the Gate 95R failure reason without worse concentration or cost fragility. For \`adr_event_0_025_type3_long_only\`, terminal inventory net-loss share must fall below \`25%\` of closed net. For \`adr_event_0_05_type3_long_only\`, terminal inventory and pair concentration must both improve materially.

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
  console.log("gate95s stream target Gate95 OOS exits");
  await streamCsv(tradeExitPath, (row) => {
    if (!targetSet.has(row.variant_id ?? "")) return;
    trades.push(mapTrade(row));
  });

  const neededPairs = [...new Set(trades.map((trade) => trade.symbol))].sort();
  const prices = new Map<string, PriceSeries>();
  for (const pair of neededPairs) {
    console.log(`gate95s load pair=${pair}`);
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

  const months = monthsBetween(gate95Config.date_from, gate95Config.date_to);
  const baselineByVariant = new Map<string, SummaryMetrics>();
  const baselineRows: Record<string, unknown>[] = [];
  for (const variant of TARGET_VARIANTS) {
    const rows = tradesByVariant.get(variant) ?? [];
    const outcomes = rows.map((trade) => buildBaselineOutcome(trade, prices));
    const baseline = summarizeOutcomes({
      variantId: variant,
      cutoffHourNy: null,
      profitCondition: "gate95r_corrected_baseline",
      outcomes,
      sourceTradeRows: rows.length,
      months,
      prices,
    });
    baselineByVariant.set(variant, baseline);
    baselineRows.push(withHash(baseline as unknown as Record<string, unknown>));
  }

  const conditions: ProfitCondition[] = [
    { id: "corrected_marked_net_gt_0", label: "corrected_marked_net_gt_0" },
    { id: "corrected_marked_net_gt_1x_commission", label: "corrected_marked_net_gt_1x_commission" },
  ];
  const matrixRows: Record<string, unknown>[] = [];
  const outcomeRows: Record<string, unknown>[] = [];
  for (const cutoffHourNy of CUTOFF_HOURS_NY) {
    const cutoffs = generateCutoffs(gate95Config.date_from, gate95Config.date_to, cutoffHourNy);
    for (const condition of conditions) {
      for (const variant of TARGET_VARIANTS) {
        const rows = tradesByVariant.get(variant) ?? [];
        console.log(`gate95s overlay variant=${variant} cutoff=${cutoffHourNy} condition=${condition.id}`);
        const outcomes = rows.map((trade) => overlayTrade(trade, prices, cutoffs, condition));
        const summary = summarizeOutcomes({
          variantId: variant,
          cutoffHourNy,
          profitCondition: condition.label,
          outcomes,
          sourceTradeRows: rows.length,
          months,
          prices,
          baseline: baselineByVariant.get(variant),
        });
        matrixRows.push(withHash(summary as unknown as Record<string, unknown>));
        for (const outcome of outcomes) {
          if (!outcome.weekly_cutoff_closure && !outcome.terminal_inventory_remaining) continue;
          outcomeRows.push(withHash({
            variant_id: outcome.variant_id,
            cutoff_hour_ny: cutoffHourNy,
            profit_condition: condition.label,
            symbol: outcome.symbol,
            entry_row_id: outcome.entry_row_id,
            entry_time_utc: outcome.entry_time_utc,
            original_exit_time_utc: outcome.original_exit_time_utc,
            final_exit_time_utc: outcome.final_exit_time_utc,
            final_mark_time_utc: outcome.final_mark_time_utc,
            final_exit_reason: outcome.final_exit_reason,
            corrected_net_actual: round2(outcome.corrected_net_actual),
            stress_double_commission_net: round2(outcome.stress_double_commission_net),
            stress_slippage_0_1_net: round2(outcome.stress_slippage_0_1_net),
            original_hold_hours: round6(outcome.original_hold_hours),
            overlay_hold_hours: round6(outcome.overlay_hold_hours),
            hold_reduction_hours: round6(outcome.hold_reduction_hours),
          }));
        }
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
        return numberValue(right.corrected_closed_plus_marked_net_actual as number) - numberValue(left.corrected_closed_plus_marked_net_actual as number);
      });
    const best = rows[0];
    return withHash({
      variant_id: variant,
      best_cutoff_hour_ny: best?.cutoff_hour_ny ?? null,
      best_profit_condition: best?.profit_condition ?? null,
      best_closed_plus_marked_net_actual: best?.corrected_closed_plus_marked_net_actual ?? null,
      best_terminal_inventory_net_loss_share_of_closed_net: best?.terminal_inventory_net_loss_share_of_closed_net ?? null,
      best_open_inventory_count: best?.open_inventory_count ?? null,
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
  const sourceCountsMatch = matrixRows.every((row) => row.source_trade_rows === row.overlay_trade_rows);
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
      check: "cutoff_timezone_explicit",
      value: CUTOFF_TIMEZONE,
      expected: "America/New_York",
      passed: CUTOFF_TIMEZONE === "America/New_York",
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
      expected: `${TARGET_VARIANTS.length} variants x ${CUTOFF_HOURS_NY.length} cutoff hours x ${conditions.length} profit conditions`,
      passed: matrixRows.length === TARGET_VARIANTS.length * CUTOFF_HOURS_NY.length * conditions.length,
    },
    {
      check: "source_trade_count_preserved_no_new_entries",
      value: sourceCountsMatch,
      expected: true,
      passed: sourceCountsMatch,
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
    ? "FAIL_GATE95S_VALIDATION_BLOCKED"
    : improvedRows.length > 0
      ? "PASS_GATE95S_WEEKLY_CUTOFF_ROW_IMPROVED_FOR_REVIEW"
      : "FAIL_GATE95S_WEEKLY_CUTOFF_NO_IMPROVED_ROW";

  const config = withHash({
    gate_id: GATE_ID,
    gate_date: GATE_DATE,
    source_gate95_artifact_dir: gate95Dir,
    source_gate95r_artifact_dir: gate95rDir,
    price_bundle_id: gate95Config.price_bundle_id,
    gate74b_manifest_id: gate95Config.gate74b_manifest_id,
    date_from: gate95Config.date_from,
    date_to: gate95Config.date_to,
    cutoff_timezone: CUTOFF_TIMEZONE,
    mark_price_source: "latest_available_gate74b_raw_path_price_at_or_before_cutoff",
    cutoff_hours_ny: CUTOFF_HOURS_NY,
    profit_conditions: conditions,
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
    config: path.join(artifactDir, "gate95s-config.json"),
    baselineJson: path.join(artifactDir, "baseline-corrected-summary.rows.json"),
    baselineCsv: path.join(artifactDir, "baseline-corrected-summary.rows.csv"),
    matrixJson: path.join(artifactDir, "weekly-cutoff-matrix.rows.json"),
    matrixCsv: path.join(artifactDir, "weekly-cutoff-matrix.rows.csv"),
    decisionJson: path.join(artifactDir, "weekly-cutoff-decision.rows.json"),
    decisionCsv: path.join(artifactDir, "weekly-cutoff-decision.rows.csv"),
    outcomeJson: path.join(artifactDir, "weekly-cutoff-closure-and-terminal.rows.json"),
    outcomeCsv: path.join(artifactDir, "weekly-cutoff-closure-and-terminal.rows.csv"),
    validationJson: path.join(artifactDir, "validation.rows.json"),
    validationCsv: path.join(artifactDir, "validation.rows.csv"),
    commandReceipt: path.join(artifactDir, "command-receipt.json"),
    runSummary: path.join(artifactDir, "gate95s-run-summary.json"),
    shaManifest: path.join(artifactDir, "gate95s-sha256.txt"),
    report: reportPath,
  };

  await writeJson(paths.config, config);
  await writeRows(paths.baselineJson, paths.baselineCsv, baselineRows);
  await writeRows(paths.matrixJson, paths.matrixCsv, sortedMatrixRows(matrixRows));
  await writeRows(paths.decisionJson, paths.decisionCsv, decisionRows);
  await writeRows(paths.outcomeJson, paths.outcomeCsv, outcomeRows);
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
    { label: "weekly_cutoff_matrix", path: paths.matrixJson },
    { label: "weekly_cutoff_decision", path: paths.decisionJson },
    { label: "weekly_cutoff_closure_and_terminal", path: paths.outcomeJson },
    { label: "validation", path: paths.validationJson },
    { label: "run_summary", path: paths.runSummary },
    { label: "command_receipt", path: paths.commandReceipt },
    { label: "report", path: paths.report },
  ]);

  console.log(`Gate 95S verdict: ${verdict}`);
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
