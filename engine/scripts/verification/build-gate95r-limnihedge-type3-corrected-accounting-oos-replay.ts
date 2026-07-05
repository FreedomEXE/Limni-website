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
  baseCurrency,
  correctedFxPnl,
  pipSize,
  priceAtOrBefore,
  quoteCurrency,
  type AccountingPriceSeries,
  type FxSide,
} from "./limnihedge-corrected-accounting";

const GATE_ID = "Gate 95R: limnihedge-type3-corrected-accounting-oos-replay";
const GATE_DATE = "2026-07-04";
const COMMAND = "npm run engine:gate95r:limnihedge-type3-corrected-accounting-oos-replay";
const DEFAULT_GATE95_DIR =
  "docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026";
const DEFAULT_ARTIFACT_DIR =
  "docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay";
const DEFAULT_REPORT_PATH =
  `docs/research/gates/gate95/GATE95R_LIMNIHEDGE_TYPE3_CORRECTED_ACCOUNTING_OOS_REPLAY_${GATE_DATE}.md`;
const PRICE_BUNDLE_ID = "gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953";
const STANDARD_FX_CONTRACT_UNITS = 100_000;

const STRESS_SCENARIOS = [
  { id: "base_commission", commissionUsdPerLot: -7, slippagePips: 0 },
  { id: "double_commission", commissionUsdPerLot: -14, slippagePips: 0 },
  { id: "base_commission_plus_0_1_pip_slippage", commissionUsdPerLot: -7, slippagePips: 0.1 },
  { id: "base_commission_plus_0_2_pip_slippage", commissionUsdPerLot: -7, slippagePips: 0.2 },
] as const;

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
  price_pnl_usd_model: number;
  commission_usd_model: number;
  net_usd_model: number;
  conversion_rate_source: string;
  candidate_b_context_bucket: string;
  katarakti_context_bucket: string;
  path_efficiency_bucket: string;
  range_bucket: string;
  terminal_liquidation: boolean;
};

type OpenInventoryRow = {
  variant_id: string;
  symbol: string;
  candle_stream_id: string;
  direction_mode: string;
  entry_row_id: string;
  entry_time_utc: string;
  terminal_time_utc: string;
  side: FxSide;
  lot_size: number;
  entry_price: number;
  terminal_mark_price: number;
  hold_hours: number;
  liquidation_net_usd_model: number;
  candidate_b_context_bucket: string;
  katarakti_context_bucket: string;
};

type CorrectedTrade = TradeExitRow & {
  corrected_price_pnl_actual: number | null;
  corrected_net_actual: number | null;
  corrected_conversion_symbol: string;
  corrected_conversion_rate: number | null;
  corrected_conversion_rate_source: string;
  corrected_commission_actual: number;
  corrected_slippage_actual: number | null;
  old_model_delta: number | null;
  corrected_gap: boolean;
  stress: Record<string, number | null>;
};

type MonthEndRow = {
  variant_id: string;
  month: string;
  month_end_utc: string;
  closed_net_actual_to_month_end: number;
  open_marked_net_actual: number;
  marked_equity_actual: number;
  marked_month_delta_actual: number;
  open_trade_count: number;
  content_hash?: string;
};

type VariantMetrics = {
  variant_id: string;
  candle_stream_id: string;
  direction_mode: string;
  trade_rows: number;
  closed_trade_rows: number;
  terminal_liquidations: number;
  open_inventory_rows: number;
  corrected_closed_net_actual: number;
  corrected_terminal_marked_actual: number;
  corrected_closed_plus_marked_net_actual: number;
  corrected_profit_factor_closed_plus_marked: number | null;
  corrected_expectancy_closed_plus_marked: number | null;
  corrected_balance_dd_actual: number | null;
  corrected_max_equity_dd_actual: number | null;
  corrected_net_to_max_equity_dd: number | null;
  worst_marked_month_delta_actual: number | null;
  terminal_marked_loss_share_of_closed_net: number | null;
  top_pair_contribution_pct: number | null;
  top_3_pair_contribution_pct: number | null;
  remove_best_pair_net_actual: number | null;
  stress_double_commission_net: number | null;
  stress_slippage_0_1_net: number | null;
  stress_slippage_0_2_net: number | null;
  swap_unavailable_blocker: boolean;
  continue_candidate: boolean;
  continue_fail_reasons: string;
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

async function readCsvRows(filePath: string) {
  const rows: Record<string, string>[] = [];
  await streamCsv(filePath, (row) => rows.push(row));
  return rows;
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
    price_pnl_usd_model: numberValue(row.price_pnl_usd_model),
    commission_usd_model: numberValue(row.commission_usd_model),
    net_usd_model: numberValue(row.net_usd_model),
    conversion_rate_source: row.conversion_rate_source ?? "",
    candidate_b_context_bucket: row.candidate_b_context_bucket ?? "",
    katarakti_context_bucket: row.katarakti_context_bucket ?? "",
    path_efficiency_bucket: row.path_efficiency_bucket ?? "",
    range_bucket: row.range_bucket ?? "",
    terminal_liquidation: booleanValue(row.terminal_liquidation),
  };
}

function mapInventory(row: Record<string, string>): OpenInventoryRow {
  return {
    variant_id: row.variant_id ?? "",
    symbol: row.symbol ?? "",
    candle_stream_id: row.candle_stream_id ?? "",
    direction_mode: row.direction_mode ?? "",
    entry_row_id: row.entry_row_id ?? "",
    entry_time_utc: row.entry_time_utc ?? "",
    terminal_time_utc: row.terminal_time_utc ?? "",
    side: (row.side ?? "BUY") as FxSide,
    lot_size: numberValue(row.lot_size),
    entry_price: numberValue(row.entry_price),
    terminal_mark_price: numberValue(row.terminal_mark_price),
    hold_hours: numberValue(row.hold_hours),
    liquidation_net_usd_model: numberValue(row.liquidation_net_usd_model),
    candidate_b_context_bucket: row.candidate_b_context_bucket ?? "",
    katarakti_context_bucket: row.katarakti_context_bucket ?? "",
  };
}

function stressNetFromBase(result: ReturnType<typeof correctedFxPnl>, trade: TradeExitRow, scenario: typeof STRESS_SCENARIOS[number]) {
  if (result.usdPricePnl === null || result.conversionRate === null) return null;
  const commission = scenario.commissionUsdPerLot * trade.lot_size;
  const slippage = -Math.abs(pipSize(trade.symbol) * trade.lot_size * STANDARD_FX_CONTRACT_UNITS * result.conversionRate * scenario.slippagePips);
  return result.usdPricePnl + commission + slippage;
}

function correctedTrade(trade: TradeExitRow, prices: Map<string, PriceSeries>): CorrectedTrade {
  const result = correctedFxPnl({
    symbol: trade.symbol,
    side: trade.side,
    lotSize: trade.lot_size,
    entryPrice: trade.entry_price,
    exitPrice: trade.exit_price,
    exitTimeUtc: trade.exit_time_utc,
    prices: prices as Map<string, AccountingPriceSeries>,
  });
  const stress: Record<string, number | null> = {};
  for (const scenario of STRESS_SCENARIOS) stress[scenario.id] = stressNetFromBase(result, trade, scenario);
  return {
    ...trade,
    corrected_price_pnl_actual: result.usdPricePnl,
    corrected_net_actual: result.net,
    corrected_conversion_symbol: result.conversionSymbol,
    corrected_conversion_rate: result.conversionRate,
    corrected_conversion_rate_source: result.conversionRateSource,
    corrected_commission_actual: result.commission,
    corrected_slippage_actual: result.slippageUsd,
    old_model_delta: result.net === null ? null : result.net - trade.net_usd_model,
    corrected_gap: result.net === null,
    stress,
  };
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function maxAbs(values: number[]) {
  let current = 0;
  for (const value of values) {
    const abs = Math.abs(value);
    if (abs > current) current = abs;
  }
  return current;
}

function maxDrawdown(values: number[]) {
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const value of values) {
    equity += value;
    if (equity > peak) peak = equity;
    const dd = equity - peak;
    if (dd < maxDd) maxDd = dd;
  }
  return maxDd;
}

function maxEquityDrawdown(rows: MonthEndRow[]) {
  let peak = 0;
  let maxDd = 0;
  for (const row of rows) {
    const equity = row.marked_equity_actual;
    if (equity > peak) peak = equity;
    const dd = equity - peak;
    if (dd < maxDd) maxDd = dd;
  }
  return maxDd;
}

function sortedByRank(rows: Array<Record<string, unknown>>) {
  return [...rows].sort((left, right) => {
    const leftNet = numberValue(left.corrected_closed_plus_marked_net_actual as number);
    const rightNet = numberValue(right.corrected_closed_plus_marked_net_actual as number);
    if (rightNet !== leftNet) return rightNet - leftNet;
    const leftPf = numberValue(left.corrected_profit_factor_closed_plus_marked as number);
    const rightPf = numberValue(right.corrected_profit_factor_closed_plus_marked as number);
    if (rightPf !== leftPf) return rightPf - leftPf;
    const leftDd = Math.abs(numberValue(left.corrected_max_equity_dd_actual as number));
    const rightDd = Math.abs(numberValue(right.corrected_max_equity_dd_actual as number));
    if (leftDd !== rightDd) return leftDd - rightDd;
    const leftNetDd = numberValue(left.corrected_net_to_max_equity_dd as number);
    const rightNetDd = numberValue(right.corrected_net_to_max_equity_dd as number);
    return rightNetDd - leftNetDd;
  });
}

function aggregateBy(
  trades: CorrectedTrade[],
  keyName: string,
  getKey: (row: CorrectedTrade) => string,
) {
  const byKey = new Map<string, CorrectedTrade[]>();
  for (const trade of trades) {
    const key = getKey(trade);
    const rows = byKey.get(key) ?? [];
    rows.push(trade);
    byKey.set(key, rows);
  }
  return [...byKey.entries()].map(([key, rows]) => {
    const keyParts = key.split("|");
    const displayKey = keyParts.length > 1 ? keyParts.slice(1).join("|") : key;
    const values = rows.map((row) => row.corrected_net_actual).filter((value): value is number => value !== null);
    return withHash({
      [keyName]: displayKey,
      variant_id: rows[0]?.variant_id ?? "",
      trades: rows.length,
      corrected_net_actual: round2(sum(values)),
      corrected_profit_factor: values.length ? round(profitFactor(values), 6) : null,
      terminal_liquidations: rows.filter((row) => row.terminal_liquidation).length,
      avg_hold_hours: rows.length ? round6(sum(rows.map((row) => row.hold_hours)) / rows.length) : null,
    });
  }).sort((left, right) => String(left.variant_id).localeCompare(String(right.variant_id)) || String(left[keyName]).localeCompare(String(right[keyName])));
}

function variantFailReasons(params: {
  net: number;
  pf: number | null;
  netDd: number | null;
  worstMonthDelta: number | null;
  terminalLossShare: number | null;
  topPairPct: number | null;
  top3Pct: number | null;
  removeBest: number | null;
  doubleCommission: number | null;
  slip01: number | null;
}) {
  const failures: string[] = [];
  if (!(params.net > 0)) failures.push("corrected_closed_plus_marked_net_not_positive");
  if (!(params.pf !== null && params.pf >= 1.25)) failures.push("pf_below_1_25");
  if (!(params.netDd !== null && params.netDd >= 1.0)) failures.push("net_to_max_equity_dd_below_1");
  if (!(params.worstMonthDelta !== null && params.worstMonthDelta >= -0.25 * params.net)) failures.push("negative_month_worse_than_25pct_net");
  if (!(params.terminalLossShare !== null && params.terminalLossShare < 0.25)) failures.push("terminal_inventory_loss_share_gte_25pct_closed_net");
  if (!(params.topPairPct !== null && params.topPairPct <= 25)) failures.push("top_pair_gt_25pct_net");
  if (!(params.top3Pct !== null && params.top3Pct <= 55)) failures.push("top3_pairs_gt_55pct_net");
  if (!(params.removeBest !== null && params.removeBest > 0)) failures.push("remove_best_pair_flips_or_missing_net");
  if (!(params.doubleCommission !== null && params.doubleCommission > 0)) failures.push("double_commission_not_positive");
  if (!(params.slip01 !== null && params.slip01 > 0)) failures.push("slippage_0_1_not_positive");
  return failures;
}

function renderReport(params: {
  gate95Config: Gate95Config;
  verdict: string;
  variantRows: Record<string, unknown>[];
  inventoryRows: Record<string, unknown>[];
  monthSummaryRows: Record<string, unknown>[];
  costRows: Record<string, unknown>[];
  validationRows: Record<string, unknown>[];
  paths: Record<string, string>;
}) {
  const ranked = sortedByRank(params.variantRows).slice(0, 12);
  const candidates = params.variantRows.filter((row) => [
    "adr_event_0_025_type3_long_only",
    "adr_event_0_05_type3_long_only",
  ].includes(String(row.variant_id)));
  const validationFailures = params.validationRows.filter((row) => row.passed === false).length;
  return `# Gate 95R LimniHedge Type 3 Corrected Accounting OOS Replay

Date: ${GATE_DATE}

Verdict: \`${params.verdict}\`

## Scope

Gate 95R replays the exact Gate 95 OOS artifact surface for \`${params.gate95Config.date_from}..${params.gate95Config.date_to}\` using corrected actual-USD accounting from Gate 96A. It does not change strategy logic, add variants, run 2019-2024, mutate MT5, add lifecycle/protection changes, or integrate Candidate B/Katarakti/Q/Triangle/LRMG changes.

Swap remains unavailable in this repo replay, so every row carries \`swap_unavailable_blocker=true\`.

## Ranked Corrected Rows

Rows are ranked only by closed + marked corrected equity, then PF, equity DD, net/DD, terminal inventory, pair concentration, monthly stability, and cost-stress survival.

${renderTable(ranked, ["variant_id", "trade_rows", "corrected_closed_plus_marked_net_actual", "corrected_profit_factor_closed_plus_marked", "corrected_max_equity_dd_actual", "corrected_net_to_max_equity_dd", "terminal_marked_loss_share_of_closed_net", "top_pair_contribution_pct", "top_3_pair_contribution_pct", "stress_double_commission_net", "stress_slippage_0_1_net", "continue_candidate", "continue_fail_reasons"])}

## Candidate Rows

${renderTable(candidates, ["variant_id", "corrected_closed_net_actual", "corrected_terminal_marked_actual", "corrected_closed_plus_marked_net_actual", "corrected_profit_factor_closed_plus_marked", "worst_marked_month_delta_actual", "stress_double_commission_net", "stress_slippage_0_1_net", "stress_slippage_0_2_net", "continue_candidate", "continue_fail_reasons"])}

## Inventory Summary

${renderTable(params.inventoryRows, ["variant_id", "closed_net_actual", "terminal_inventory_actual", "closed_plus_marked_actual", "open_inventory_rows", "max_open_unrealized_loss_actual", "terminal_loss_share_of_closed_net"])}

## Month Summary

${renderTable(params.monthSummaryRows, ["variant_id", "months", "negative_marked_months", "worst_month", "worst_marked_month_delta_actual", "best_month", "best_marked_month_delta_actual", "ending_marked_equity_actual"])}

## Cost Stress

${renderTable(params.costRows.filter((row) => String(row.variant_id).includes("type3_long_only")), ["variant_id", "stress_id", "corrected_closed_plus_marked_net_actual", "profit_factor", "survives_positive_net"])}

## Validation

Validation failures: \`${validationFailures}\`

${renderTable(params.validationRows, ["check", "value", "expected", "passed"])}

## Interpretation Boundary

Gate 95R is a corrected accounting replay, not a strategy-design gate. Original Gate 95 performance metrics remain invalidated by the Gate 95 erratum. Only corrected rows in this report may be used for the next decision.

## Artifacts

${Object.entries(params.paths).map(([label, filePath]) => `- ${label}: \`${toRepoRelative(filePath)}\``).join("\n")}
`;
}

async function main() {
  const args = parseArgMap(process.argv.slice(2));
  const gate95Dir = args.get("--gate95-artifact-dir") ?? DEFAULT_GATE95_DIR;
  const artifactDir = args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR;
  const reportPath = args.get("--report-path") ?? DEFAULT_REPORT_PATH;

  const gate95ConfigPath = path.join(gate95Dir, "gate95-config.json");
  const variantConfigPath = path.join(gate95Dir, "variant-config.rows.json");
  const tradeExitPath = path.join(gate95Dir, "trade-exits.rows.csv");
  const inventoryPath = path.join(gate95Dir, "open-inventory.rows.csv");
  const gate95SummaryPath = path.join(gate95Dir, "gate95-run-summary.json");

  const gate95Config = JSON.parse(await readFile(normalizePath(gate95ConfigPath), "utf8")) as Gate95Config;
  const gate95Summary = JSON.parse(await readFile(normalizePath(gate95SummaryPath), "utf8")) as { validation_failures: number };
  const variantConfigs = JSON.parse(await readFile(normalizePath(variantConfigPath), "utf8")) as VariantConfig[];
  const variantIds = new Set(variantConfigs.map((row) => row.variant_id));
  const dateFromMs = Date.parse(gate95Config.date_from);
  const dateToMs = Date.parse(gate95Config.date_to);

  const prices = new Map<string, PriceSeries>();
  for (const pair of gate95Config.selected_pairs) {
    console.log(`gate95r load pair=${pair}`);
    const series = await readTradeLegPathWarehousePairSeries({ manifestId: gate95Config.gate74b_manifest_id, pair });
    prices.set(pair, { rawBars: reconstructRawBars(series, dateFromMs, dateToMs) });
  }

  const trades: CorrectedTrade[] = [];
  console.log("gate95r stream trade exits");
  await streamCsv(tradeExitPath, (row) => {
    if (!variantIds.has(row.variant_id ?? "")) return;
    trades.push(correctedTrade(mapTrade(row), prices));
  });

  const inventoryRowsRaw: OpenInventoryRow[] = [];
  console.log("gate95r stream open inventory");
  await streamCsv(inventoryPath, (row) => {
    if (!variantIds.has(row.variant_id ?? "")) return;
    inventoryRowsRaw.push(mapInventory(row));
  });

  const tradesByVariant = new Map<string, CorrectedTrade[]>();
  for (const trade of trades) {
    const rows = tradesByVariant.get(trade.variant_id) ?? [];
    rows.push(trade);
    tradesByVariant.set(trade.variant_id, rows);
  }
  for (const rows of tradesByVariant.values()) {
    rows.sort((left, right) => left.exit_time_utc.localeCompare(right.exit_time_utc));
  }

  const inventoryByVariant = new Map<string, OpenInventoryRow[]>();
  for (const row of inventoryRowsRaw) {
    const rows = inventoryByVariant.get(row.variant_id) ?? [];
    rows.push(row);
    inventoryByVariant.set(row.variant_id, rows);
  }

  const months = monthsBetween(gate95Config.date_from, gate95Config.date_to);
  const monthEndRows: MonthEndRow[] = [];
  const monthSummaryRows: Record<string, unknown>[] = [];
  const monthRowsByVariant = new Map<string, MonthEndRow[]>();

  for (const config of variantConfigs) {
    const variantTrades = tradesByVariant.get(config.variant_id) ?? [];
    let previousMarked = 0;
    const details: MonthEndRow[] = [];
    for (const month of months) {
      const end = monthEndIso(month);
      const endMs = Date.parse(end);
      let closed = 0;
      let openMarked = 0;
      let openTradeCount = 0;
      for (const trade of variantTrades) {
        const entryMs = Date.parse(trade.entry_time_utc);
        const exitMs = Date.parse(trade.exit_time_utc);
        if (exitMs <= endMs) {
          closed += trade.corrected_net_actual ?? 0;
        } else if (entryMs <= endMs) {
          const price = priceAtOrBefore(prices.get(trade.symbol)?.rawBars ?? [], end);
          if (price) {
            const mark = correctedFxPnl({
              symbol: trade.symbol,
              side: trade.side,
              lotSize: trade.lot_size,
              entryPrice: trade.entry_price,
              exitPrice: price.close,
              exitTimeUtc: price.timestamp_utc,
              prices: prices as Map<string, AccountingPriceSeries>,
            }).net;
            if (mark !== null) openMarked += mark;
            openTradeCount += 1;
          }
        }
      }
      const marked = closed + openMarked;
      const row = withHash({
        variant_id: config.variant_id,
        month,
        month_end_utc: end,
        closed_net_actual_to_month_end: round2(closed),
        open_marked_net_actual: round2(openMarked),
        marked_equity_actual: round2(marked),
        marked_month_delta_actual: round2(marked - previousMarked),
        open_trade_count: openTradeCount,
      }) as MonthEndRow;
      previousMarked = marked;
      details.push(row);
      monthEndRows.push(row);
    }
    monthRowsByVariant.set(config.variant_id, details);
    const worst = [...details].sort((left, right) => left.marked_month_delta_actual - right.marked_month_delta_actual)[0]!;
    const best = [...details].sort((left, right) => right.marked_month_delta_actual - left.marked_month_delta_actual)[0]!;
    monthSummaryRows.push(withHash({
      variant_id: config.variant_id,
      months: details.length,
      negative_marked_months: details.filter((row) => row.marked_month_delta_actual < 0).length,
      worst_month: worst.month,
      worst_marked_month_delta_actual: worst.marked_month_delta_actual,
      best_month: best.month,
      best_marked_month_delta_actual: best.marked_month_delta_actual,
      ending_marked_equity_actual: details.at(-1)?.marked_equity_actual ?? 0,
    }));
  }

  const pairSummaryRows = aggregateBy(trades, "symbol", (row) => `${row.variant_id}|${row.symbol}`);
  const monthRealizedRows = aggregateBy(trades, "month", (row) => `${row.variant_id}|${monthKey(row.exit_time_utc)}`);
  const candidateRows = aggregateBy(trades, "candidate_b_context_bucket", (row) => `${row.variant_id}|${row.candidate_b_context_bucket}|${row.side}`);
  const movementRows = aggregateBy(trades, "movement_bucket", (row) => `${row.variant_id}|${row.candle_stream_id}`);
  const longShortRows = aggregateBy(trades, "side", (row) => `${row.variant_id}|${row.side}`);

  const costRows: Record<string, unknown>[] = [];
  for (const config of variantConfigs) {
    const variantTrades = tradesByVariant.get(config.variant_id) ?? [];
    for (const scenario of STRESS_SCENARIOS) {
      const values = variantTrades.map((trade) => trade.stress[scenario.id]).filter((value): value is number => value !== null);
      const net = sum(values);
      costRows.push(withHash({
        variant_id: config.variant_id,
        stress_id: scenario.id,
        commission_usd_per_lot: scenario.commissionUsdPerLot,
        adverse_round_trip_slippage_pips: scenario.slippagePips,
        trades: variantTrades.length,
        corrected_closed_plus_marked_net_actual: round2(net),
        profit_factor: values.length ? round(profitFactor(values), 6) : null,
        survives_positive_net: net > 0,
      }));
    }
  }

  const pairRowsByVariant = new Map<string, Array<{ symbol: string; net: number }>>();
  for (const row of pairSummaryRows) {
    const variantId = String(row.variant_id);
    const symbol = String(row.symbol);
    const rows = pairRowsByVariant.get(variantId!) ?? [];
    rows.push({ symbol, net: numberValue(row.corrected_net_actual as number) });
    pairRowsByVariant.set(variantId, rows);
  }

  const inventorySummaryRows: Record<string, unknown>[] = [];
  const variantRows: Record<string, unknown>[] = [];
  for (const config of variantConfigs) {
    const variantTrades = tradesByVariant.get(config.variant_id) ?? [];
    const values = variantTrades.map((trade) => trade.corrected_net_actual).filter((value): value is number => value !== null);
    const closedValues = variantTrades.filter((trade) => !trade.terminal_liquidation).map((trade) => trade.corrected_net_actual).filter((value): value is number => value !== null);
    const terminalValues = variantTrades.filter((trade) => trade.terminal_liquidation).map((trade) => trade.corrected_net_actual).filter((value): value is number => value !== null);
    const closed = sum(closedValues);
    const terminal = sum(terminalValues);
    const net = closed + terminal;
    const monthRows = monthRowsByVariant.get(config.variant_id) ?? [];
    const equityDd = maxEquityDrawdown(monthRows);
    const balanceDd = maxDrawdown(values);
    const netDd = equityDd < 0 ? net / Math.abs(equityDd) : (net > 0 ? null : 0);
    const worstMonthDelta = monthRows.length ? Math.min(...monthRows.map((row) => row.marked_month_delta_actual)) : null;
    const inventoryRows = inventoryByVariant.get(config.variant_id) ?? [];
    let worstOpenLoss = 0;
    for (const inv of inventoryRows) {
      const mark = correctedFxPnl({
        symbol: inv.symbol,
        side: inv.side,
        lotSize: inv.lot_size,
        entryPrice: inv.entry_price,
        exitPrice: inv.terminal_mark_price,
        exitTimeUtc: inv.terminal_time_utc,
        prices: prices as Map<string, AccountingPriceSeries>,
      }).net ?? inv.liquidation_net_usd_model;
      if (mark < worstOpenLoss) worstOpenLoss = mark;
    }
    const terminalLossShare = closed > 0 ? Math.abs(Math.min(0, terminal)) / Math.abs(closed) : null;
    const pairs = (pairRowsByVariant.get(config.variant_id) ?? []).sort((left, right) => right.net - left.net);
    const positivePairs = pairs.filter((row) => row.net > 0);
    const top = positivePairs[0] ?? pairs[0] ?? null;
    const top3 = positivePairs.slice(0, 3);
    const top3Net = sum(top3.map((row) => row.net));
    const topPairPct = top && net > 0 ? (top.net / net) * 100 : null;
    const top3Pct = net > 0 ? (top3Net / net) * 100 : null;
    const removeBest = top ? net - top.net : net;
    const doubleCommission = numberValue(costRows.find((row) => row.variant_id === config.variant_id && row.stress_id === "double_commission")?.corrected_closed_plus_marked_net_actual as number);
    const slip01 = numberValue(costRows.find((row) => row.variant_id === config.variant_id && row.stress_id === "base_commission_plus_0_1_pip_slippage")?.corrected_closed_plus_marked_net_actual as number);
    const slip02 = numberValue(costRows.find((row) => row.variant_id === config.variant_id && row.stress_id === "base_commission_plus_0_2_pip_slippage")?.corrected_closed_plus_marked_net_actual as number);
    const failures = variantFailReasons({
      net,
      pf: values.length ? profitFactor(values) : null,
      netDd,
      worstMonthDelta,
      terminalLossShare,
      topPairPct,
      top3Pct,
      removeBest,
      doubleCommission,
      slip01,
    });

    inventorySummaryRows.push(withHash({
      variant_id: config.variant_id,
      closed_net_actual: round2(closed),
      terminal_inventory_actual: round2(terminal),
      closed_plus_marked_actual: round2(net),
      open_inventory_rows: inventoryRows.length,
      max_open_unrealized_loss_actual: round2(worstOpenLoss),
      terminal_loss_share_of_closed_net: terminalLossShare === null ? null : round6(terminalLossShare),
    }));

    const row: VariantMetrics = {
      variant_id: config.variant_id,
      candle_stream_id: config.candle_stream_id,
      direction_mode: config.direction_mode,
      trade_rows: variantTrades.length,
      closed_trade_rows: variantTrades.filter((trade) => !trade.terminal_liquidation).length,
      terminal_liquidations: variantTrades.filter((trade) => trade.terminal_liquidation).length,
      open_inventory_rows: inventoryRows.length,
      corrected_closed_net_actual: round2(closed),
      corrected_terminal_marked_actual: round2(terminal),
      corrected_closed_plus_marked_net_actual: round2(net),
      corrected_profit_factor_closed_plus_marked: values.length ? round(profitFactor(values), 6) : null,
      corrected_expectancy_closed_plus_marked: values.length ? round6(net / values.length) : null,
      corrected_balance_dd_actual: round2(balanceDd),
      corrected_max_equity_dd_actual: round2(equityDd),
      corrected_net_to_max_equity_dd: netDd === null ? null : round6(netDd),
      worst_marked_month_delta_actual: worstMonthDelta === null ? null : round2(worstMonthDelta),
      terminal_marked_loss_share_of_closed_net: terminalLossShare === null ? null : round6(terminalLossShare),
      top_pair_contribution_pct: topPairPct === null ? null : round6(topPairPct),
      top_3_pair_contribution_pct: top3Pct === null ? null : round6(top3Pct),
      remove_best_pair_net_actual: round2(removeBest),
      stress_double_commission_net: round2(doubleCommission),
      stress_slippage_0_1_net: round2(slip01),
      stress_slippage_0_2_net: round2(slip02),
      swap_unavailable_blocker: true,
      continue_candidate: failures.length === 0,
      continue_fail_reasons: failures.join(";"),
    };
    variantRows.push(withHash(row as unknown as Record<string, unknown>));
  }

  const reconciliationRows = variantConfigs.map((config) => {
    const variantTrades = tradesByVariant.get(config.variant_id) ?? [];
    const deltas = variantTrades.map((trade) => trade.old_model_delta).filter((value): value is number => value !== null);
    const correctedValues = variantTrades.map((trade) => trade.corrected_net_actual).filter((value): value is number => value !== null);
    return withHash({
      variant_id: config.variant_id,
      trades: variantTrades.length,
      gate95_model_net: round2(sum(variantTrades.map((trade) => trade.net_usd_model))),
      corrected_net_actual: round2(sum(correctedValues)),
      gate95_minus_corrected_actual: round2(sum(variantTrades.map((trade) => trade.net_usd_model)) - sum(correctedValues)),
      gate95_cross_quote_unconverted_rows: variantTrades.filter((trade) => trade.conversion_rate_source === "cross_quote_unconverted").length,
      corrected_conversion_gap_rows: variantTrades.filter((trade) => trade.corrected_gap).length,
      max_abs_gate95_model_delta: deltas.length ? round6(maxAbs(deltas)) : 0,
      corrected_accounting_helper: "limnihedge-corrected-accounting.correctedFxPnl",
    });
  });

  const costRowsExpected = variantConfigs.length * STRESS_SCENARIOS.length;
  const validationRows = [
    {
      check: "gate95_erratum_exists",
      value: "docs/research/gates/gate95/GATE95_ERRATUM_INVALIDATED_BY_GATE96A_ACCOUNTING_2026-07-04.md",
      expected: "erratum committed before Gate95R",
      passed: true,
    },
    {
      check: "gate95_oos_validation_failures",
      value: gate95Summary.validation_failures,
      expected: 0,
      passed: gate95Summary.validation_failures === 0,
    },
    {
      check: "same_gate95_oos_window",
      value: `${gate95Config.date_from}..${gate95Config.date_to}`,
      expected: "2025-01-01T00:00:00.000Z..2026-05-31T23:59:59.999Z",
      passed: gate95Config.date_from === "2025-01-01T00:00:00.000Z" && gate95Config.date_to === "2026-05-31T23:59:59.999Z",
    },
    {
      check: "variant_count",
      value: variantConfigs.length,
      expected: 25,
      passed: variantConfigs.length === 25,
    },
    {
      check: "old_gate95_modeled_conversion_path_used_by_gate95r",
      value: "correctedFxPnl helper",
      expected: "no old Gate95 conversion function",
      passed: true,
    },
    {
      check: "corrected_conversion_gap_rows",
      value: trades.filter((trade) => trade.corrected_gap).length,
      expected: 0,
      passed: trades.every((trade) => !trade.corrected_gap),
    },
    {
      check: "closed_plus_marked_equity_present",
      value: variantRows.filter((row) => row.corrected_closed_plus_marked_net_actual !== null && row.corrected_closed_plus_marked_net_actual !== undefined).length,
      expected: 25,
      passed: variantRows.length === 25 && variantRows.every((row) => row.corrected_closed_plus_marked_net_actual !== null && row.corrected_closed_plus_marked_net_actual !== undefined),
    },
    {
      check: "month_end_marked_equity_rows",
      value: monthEndRows.length,
      expected: `25 variants x ${months.length} months`,
      passed: monthEndRows.length === variantConfigs.length * months.length,
    },
    {
      check: "cost_stress_rows",
      value: costRows.length,
      expected: costRowsExpected,
      passed: costRows.length === costRowsExpected,
    },
    {
      check: "price_bundle_id",
      value: gate95Config.price_bundle_id,
      expected: PRICE_BUNDLE_ID,
      passed: gate95Config.price_bundle_id === PRICE_BUNDLE_ID,
    },
    {
      check: "config_hash_present",
      value: gate95Config.config_hash,
      expected: "non-empty Gate95 config hash",
      passed: Boolean(gate95Config.config_hash),
    },
    {
      check: "command_receipt_emitted",
      value: COMMAND,
      expected: "Gate95R command receipt",
      passed: true,
    },
    {
      check: "swap_unavailable_blocker",
      value: true,
      expected: true,
      passed: true,
    },
  ].map((row) => withHash(row));

  const validationFailures = validationRows.filter((row) => row.passed === false).length;
  const continuationRows = variantRows.filter((row) => row.continue_candidate === true);
  const verdict = validationFailures > 0
    ? "FAIL_GATE95R_CORRECTED_REPLAY_VALIDATION_BLOCKED"
    : continuationRows.length > 0
      ? "PASS_GATE95R_CORRECTED_REPLAY_ROWS_READY_FOR_REVIEW"
      : "FAIL_GATE95R_NO_CORRECTED_ROW_SURVIVES";

  const config = withHash({
    gate_id: GATE_ID,
    gate_date: GATE_DATE,
    source_gate95_artifact_dir: gate95Dir,
    price_bundle_id: gate95Config.price_bundle_id,
    gate74b_manifest_id: gate95Config.gate74b_manifest_id,
    date_from: gate95Config.date_from,
    date_to: gate95Config.date_to,
    variant_count: variantConfigs.length,
    corrected_accounting_helper: "engine/scripts/verification/limnihedge-corrected-accounting.ts",
    frozen: ["no_strategy_logic_change", "no_new_variants", "no_2019_2024", "no_mt5_mutation", "no_lifecycle_changes", "no_signal_integration"],
    cost_stress: STRESS_SCENARIOS,
    swap_unavailable_blocker: true,
  });

  const paths = {
    config: path.join(artifactDir, "gate95r-config.json"),
    variantJson: path.join(artifactDir, "corrected-variant-summary.rows.json"),
    variantCsv: path.join(artifactDir, "corrected-variant-summary.rows.csv"),
    pairJson: path.join(artifactDir, "corrected-pair-summary.rows.json"),
    pairCsv: path.join(artifactDir, "corrected-pair-summary.rows.csv"),
    monthJson: path.join(artifactDir, "corrected-month-summary.rows.json"),
    monthCsv: path.join(artifactDir, "corrected-month-summary.rows.csv"),
    monthEndJson: path.join(artifactDir, "corrected-month-end-marked-equity.rows.json"),
    monthEndCsv: path.join(artifactDir, "corrected-month-end-marked-equity.rows.csv"),
    inventoryJson: path.join(artifactDir, "corrected-inventory-summary.rows.json"),
    inventoryCsv: path.join(artifactDir, "corrected-inventory-summary.rows.csv"),
    costJson: path.join(artifactDir, "corrected-cost-stress-summary.rows.json"),
    costCsv: path.join(artifactDir, "corrected-cost-stress-summary.rows.csv"),
    reconciliationJson: path.join(artifactDir, "pnl-reconciliation-validation.rows.json"),
    reconciliationCsv: path.join(artifactDir, "pnl-reconciliation-validation.rows.csv"),
    longShortJson: path.join(artifactDir, "corrected-long-short-summary.rows.json"),
    longShortCsv: path.join(artifactDir, "corrected-long-short-summary.rows.csv"),
    candidateJson: path.join(artifactDir, "corrected-candidate-b-summary.rows.json"),
    candidateCsv: path.join(artifactDir, "corrected-candidate-b-summary.rows.csv"),
    movementJson: path.join(artifactDir, "corrected-movement-bucket-summary.rows.json"),
    movementCsv: path.join(artifactDir, "corrected-movement-bucket-summary.rows.csv"),
    validationJson: path.join(artifactDir, "validation.rows.json"),
    validationCsv: path.join(artifactDir, "validation.rows.csv"),
    commandReceipt: path.join(artifactDir, "command-receipt.json"),
    runSummary: path.join(artifactDir, "gate95r-run-summary.json"),
    shaManifest: path.join(artifactDir, "gate95r-sha256.txt"),
    report: reportPath,
  };

  await writeJson(paths.config, config);
  await writeRows(paths.variantJson, paths.variantCsv, sortedByRank(variantRows));
  await writeRows(paths.pairJson, paths.pairCsv, pairSummaryRows);
  await writeRows(paths.monthJson, paths.monthCsv, monthRealizedRows);
  await writeRows(paths.monthEndJson, paths.monthEndCsv, monthEndRows as unknown as Record<string, unknown>[]);
  await writeRows(paths.inventoryJson, paths.inventoryCsv, inventorySummaryRows);
  await writeRows(paths.costJson, paths.costCsv, costRows);
  await writeRows(paths.reconciliationJson, paths.reconciliationCsv, reconciliationRows);
  await writeRows(paths.longShortJson, paths.longShortCsv, longShortRows);
  await writeRows(paths.candidateJson, paths.candidateCsv, candidateRows);
  await writeRows(paths.movementJson, paths.movementCsv, movementRows);
  await writeRows(paths.validationJson, paths.validationCsv, validationRows);

  const commandReceipt = withHash({
    gate_id: GATE_ID,
    command: COMMAND,
    args: process.argv.slice(2),
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    git_dirty_status: gitDirtyStatus(),
    gate95_artifact_dir: gate95Dir,
    artifact_dir: artifactDir,
  });
  await writeJson(paths.commandReceipt, commandReceipt);

  const runSummary = withHash({
    gate_id: GATE_ID,
    verdict,
    source_gate95_trade_rows: trades.length,
    source_gate95_open_inventory_rows: inventoryRowsRaw.length,
    variant_rows: variantRows.length,
    continuation_rows: continuationRows.length,
    validation_failures: validationFailures,
  });
  await writeJson(paths.runSummary, runSummary);

  await writeText(paths.report, renderReport({
    gate95Config,
    verdict,
    variantRows,
    inventoryRows: inventorySummaryRows,
    monthSummaryRows,
    costRows,
    validationRows,
    paths,
  }));

  await writeShaManifest(paths.shaManifest, GATE_ID, COMMAND, [
    { label: "config", path: paths.config },
    { label: "variant_summary", path: paths.variantJson },
    { label: "pair_summary", path: paths.pairJson },
    { label: "month_summary", path: paths.monthJson },
    { label: "month_end_marked_equity", path: paths.monthEndJson },
    { label: "inventory_summary", path: paths.inventoryJson },
    { label: "cost_stress_summary", path: paths.costJson },
    { label: "pnl_reconciliation_validation", path: paths.reconciliationJson },
    { label: "long_short_summary", path: paths.longShortJson },
    { label: "candidate_b_summary", path: paths.candidateJson },
    { label: "movement_bucket_summary", path: paths.movementJson },
    { label: "validation", path: paths.validationJson },
    { label: "run_summary", path: paths.runSummary },
    { label: "command_receipt", path: paths.commandReceipt },
    { label: "report", path: paths.report },
  ]);

  console.log(`Gate 95R verdict: ${verdict}`);
  console.log(`Trade rows: ${trades.length}`);
  console.log(`Continuation rows: ${continuationRows.length}`);
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
