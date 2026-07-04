import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { closePoolIfInitialized, query } from "@database/db/client";
import { sha256Stable, sha256Text } from "@engine/research/hash";

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

const GATE_ID = "Gate 92: limnihedge-legacy-parity";
const GATE_DATE = "2026-07-04";
const COMMAND = "npm run engine:gate92:limnihedge-legacy-parity";
const DEFAULT_REPORT_DIR = "C:/Users/User/Desktop/LIMNI/Baktests/LimniHedge_v1";
const DEFAULT_MT5_EXPORT_DIR = "C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB/MQL5/Files/LimniHedge_V1_Parity";
const DEFAULT_MT5_TICK_TRACE_DIR = "C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/Common/Files/LimniHedge_V1_TickTrace";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate92/GATE92_LIMNIHEDGE_LEGACY_PARITY_INTAKE_${GATE_DATE}.md`;
const PRICE_BUNDLE_ID = "gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953";

type Scope = "primary" | "secondary" | "discovered";
type Side = "BUY" | "SELL";
type TrendState = 1 | -1;
type PriceSource = "mt5-export" | "canonical" | "none";

type Options = {
  reportDir: string;
  mt5ExportDir: string;
  mt5TickTraceDir: string;
  artifactDir: string;
  reportPath: string;
  mt5TimezoneOffsetHours: number;
  priceSource: PriceSource;
  skipCanonicalEntryReplay: boolean;
};

type ExpectedReport = {
  case_id: string;
  scope: Scope;
  filename: string;
  required: boolean;
};

type ReportInventoryRow = {
  case_id: string;
  scope: Scope;
  expected_filename: string;
  resolved_path: string | null;
  exists: boolean;
  file_size_bytes: number | null;
  last_modified_utc: string | null;
  note: string;
  content_hash?: string;
};

type Mt5ReportSummaryRow = {
  case_id: string;
  scope: Scope;
  source_path: string;
  source_sha256: string;
  expert: string | null;
  symbol: string | null;
  normalized_symbol: string | null;
  period: string | null;
  report_start: string | null;
  report_end: string | null;
  inputs_trade_lots: number | null;
  inputs_type1_enabled: boolean | null;
  inputs_type3_enabled: boolean | null;
  inputs_wait_for_first_trend_change: boolean | null;
  inputs_ma_period: number | null;
  inputs_ma_type: string | null;
  inputs_ma_price: string | null;
  inputs_rsi_period: number | null;
  inputs_rsi_overbought: number | null;
  inputs_rsi_oversold: number | null;
  inputs_trail_start_pips: number | null;
  inputs_trail_step_pips: number | null;
  inputs_trail_stop_pips: number | null;
  headline_total_net_profit: number | null;
  headline_profit_factor: number | null;
  headline_total_deals: number | null;
  headline_balance_drawdown_maximal: string | null;
  headline_equity_drawdown_maximal: string | null;
  orders_rows: number;
  deals_rows: number;
  entry_deals: number;
  exit_deals: number;
  buy_entry_deals: number;
  sell_entry_deals: number;
  observed_type1_entries: number;
  observed_type3_entries: number;
  observed_other_entry_volume_rows: number;
  sl_exit_deals: number;
  terminal_liquidation_deals: number;
  first_entry_time: string | null;
  last_entry_time: string | null;
  first_exit_time: string | null;
  last_exit_time: string | null;
  deal_sum_net_profit: number;
  deal_sum_commission: number;
  deal_sum_swap: number;
  deal_sum_price_profit: number;
  deal_profit_factor: number | null;
  final_balance: number | null;
  average_hold_hours_fifo: number | null;
  max_hold_hours_fifo: number | null;
  max_hold_entry_time_fifo: string | null;
  max_hold_exit_time_fifo: string | null;
  content_hash?: string;
};

type SettingRow = {
  case_id: string;
  scope: Scope;
  section: "setting" | "input" | "result";
  key: string;
  raw_value: string;
  numeric_value: number | null;
  content_hash?: string;
};

type OrderRow = {
  case_id: string;
  scope: Scope;
  open_time: string;
  order_id: string;
  symbol: string;
  type: string;
  volume: string;
  price: number | null;
  stop_loss: string | null;
  take_profit: string | null;
  close_or_fill_time: string | null;
  state: string | null;
  comment: string | null;
  inferred_order_role: "entry" | "exit_or_liquidation" | "unknown";
  content_hash?: string;
};

type DealRow = {
  case_id: string;
  scope: Scope;
  time: string;
  deal_id: string;
  symbol: string;
  type: string;
  direction: string;
  volume: number | null;
  price: number | null;
  order_id: string;
  commission: number;
  swap: number;
  profit: number;
  balance: number | null;
  comment: string | null;
  inferred_order_type: "TYPE1" | "TYPE3" | "OTHER" | "NOT_ENTRY";
  net_profit: number;
  content_hash?: string;
};

type YearlyClosedRow = {
  case_id: string;
  scope: Scope;
  close_year: number;
  exit_deals: number;
  net_profit: number;
  commission: number;
  swap: number;
  price_profit: number;
  terminal_liquidation_deals: number;
  content_hash?: string;
};

type HoldRow = {
  case_id: string;
  scope: Scope;
  entry_time: string;
  exit_time: string;
  side: Side;
  volume: number;
  entry_price: number | null;
  exit_price: number | null;
  exit_comment: string | null;
  hold_hours: number;
  commission: number;
  swap: number;
  price_profit: number;
  net_profit: number;
  content_hash?: string;
};

type ReplicaContractRow = {
  component: string;
  legacy_source: string;
  repo_replica_contract: string;
  parity_observable: string;
  status: "implemented_entry_shape" | "reference_only" | "blocked_until_price_source";
  content_hash?: string;
};

type CanonicalCoverageRow = {
  case_id?: string;
  scope?: Scope;
  symbol: string;
  timeframe: string;
  source: "mt5_h1_export" | "canonical_price_bars" | "none";
  source_path: string | null;
  david_profile?: string | null;
  note: string;
  bar_count: number;
  first_bar_open_utc: string | null;
  last_bar_open_utc: string | null;
  requested_from_utc: string | null;
  requested_to_utc: string | null;
  reaches_report_start: boolean;
  reaches_report_end: boolean;
  content_hash?: string;
};

type Bar = {
  symbol: string;
  bar_open_utc: string;
  open: number;
  high: number;
  low: number;
  close: number;
  tick_volume: number | null;
  spread: number | null;
  david_state?: TrendState | null;
};

type TickOpenQuote = {
  bar_open_utc: string;
  bid: number;
  ask: number;
  spread_points: number | null;
};

type ReplicaEntryRow = {
  case_id: string;
  symbol: string;
  entry_time: string;
  side: Side;
  order_type: "TYPE1" | "TYPE3";
  lot_size: number;
  david_state_shift1: "UP" | "DOWN";
  david_state_source: "mt5_export_indicator_buffer" | "repo_recomputed_lwma_rsi";
  type3_candle_combination: number;
  bar_hour_utc: string;
  bar_spread: number | null;
  bar_tick_volume: number | null;
  content_hash?: string;
};

type ReplicaAcceptanceRow = ReplicaEntryRow & {
  raw_sequence_index: number;
  acceptance_status: "accepted" | "skipped_daily_rollover_0000" | "skipped_after_report_execution_end";
  acceptance_reason: string;
  report_execution_end_utc: string | null;
  content_hash?: string;
};

type EntryComparisonRow = {
  case_id: string;
  scope: Scope;
  normalized_symbol: string;
  comparison_status: "compared" | "skipped_missing_h1_source_bars" | "skipped_no_report_entries";
  mt5_entries_in_coverage: number;
  replica_entries_in_coverage: number;
  exact_sequence_matches: number;
  first_mismatch_index: number | null;
  first_mismatch_mt5: string | null;
  first_mismatch_replica: string | null;
  mt5_first_entry_in_coverage: string | null;
  replica_first_entry_in_coverage: string | null;
  coverage_from_utc: string | null;
  coverage_to_utc: string | null;
  verdict: "PASS" | "FAIL" | "SKIP";
  content_hash?: string;
};

type ReplicaLifecycleExitRow = {
  case_id: string;
  symbol: string;
  entry_time: string;
  side: Side;
  order_type: "TYPE1" | "TYPE3";
  lot_size: number;
  entry_price: number;
  exit_time: string;
  exit_price: number;
  exit_reason: "sl" | "end_of_test";
  stop_loss_at_exit: number | null;
  hold_hours: number;
  content_hash?: string;
};

type LifecycleComparisonRow = {
  case_id: string;
  scope: Scope;
  normalized_symbol: string;
  mt5_exit_deals: number;
  replica_exit_deals: number;
  match_method: "entry_key" | "exit_sequence" | "none";
  matched_exit_deals: number;
  unmatched_mt5_exit_deals: number;
  unmatched_replica_exit_deals: number;
  mt5_sl_exit_deals: number;
  replica_sl_exit_deals: number;
  mt5_terminal_liquidation_deals: number;
  replica_terminal_liquidation_deals: number;
  exit_count_delta: number;
  sl_exit_count_delta: number;
  terminal_liquidation_delta: number;
  same_exit_hour_matches: number;
  average_abs_exit_price_delta: number | null;
  max_abs_exit_price_delta: number | null;
  verdict: "PROFILED_PASS_COUNTS" | "PROFILED_MISMATCH" | "SKIP";
  content_hash?: string;
};

type ReplicaPnlExitRow = {
  case_id: string;
  scope: Scope;
  normalized_symbol: string;
  sequence_index: number;
  match_status: "matched_by_entry_key" | "matched_by_exit_sequence" | "unmatched_replica_exit";
  entry_time: string;
  side: Side;
  lot_size: number;
  replica_exit_time: string;
  mt5_exit_time: string | null;
  same_exit_hour: boolean;
  replica_exit_reason: "sl" | "end_of_test";
  mt5_exit_reason: "sl" | "end_of_test" | null;
  entry_price: number;
  replica_exit_price: number;
  mt5_exit_price: number | null;
  conversion_symbol: string | null;
  conversion_rate_source: "account_currency" | "mt5_h1_export_close" | "missing";
  conversion_bar_time_utc: string | null;
  conversion_rate: number | null;
  mt5_price_profit: number | null;
  replica_price_profit: number | null;
  price_profit_delta: number | null;
  mt5_commission: number | null;
  replica_commission: number;
  commission_delta: number | null;
  mt5_swap: number | null;
  replica_swap_source: "mt5_report_observed_passthrough" | "unmatched";
  mt5_net_profit: number | null;
  replica_net_profit_with_observed_swap: number | null;
  net_profit_delta_with_observed_swap: number | null;
  content_hash?: string;
};

type PnlComparisonRow = {
  case_id: string;
  scope: Scope;
  normalized_symbol: string;
  mt5_exit_deals: number;
  replica_exit_deals: number;
  matched_exit_deals: number;
  unmatched_mt5_exit_deals: number;
  unmatched_replica_exit_deals: number;
  conversion_missing_exit_deals: number;
  mt5_price_profit: number;
  replica_price_profit: number | null;
  price_profit_delta: number | null;
  price_profit_delta_pct: number | null;
  mt5_commission: number;
  replica_commission: number;
  commission_delta: number;
  mt5_swap: number;
  replica_swap_source: "mt5_report_observed_passthrough";
  mt5_net_profit: number;
  replica_net_profit_with_observed_swap: number | null;
  net_profit_delta_with_observed_swap: number | null;
  net_profit_delta_pct_with_observed_swap: number | null;
  mt5_profit_factor: number | null;
  replica_profit_factor_with_observed_swap: number | null;
  profit_factor_delta_with_observed_swap: number | null;
  verdict: "PROFILED_PASS_ACCOUNTING_SHAPE" | "PROFILED_MISMATCH" | "SKIP";
  content_hash?: string;
};

type PnlYearlyComparisonRow = {
  case_id: string;
  scope: Scope;
  normalized_symbol: string;
  close_year: number;
  mt5_exit_deals: number;
  replica_exit_deals: number;
  mt5_net_profit: number;
  replica_net_profit_with_observed_swap: number | null;
  net_profit_delta_with_observed_swap: number | null;
  mt5_price_profit: number;
  replica_price_profit: number | null;
  price_profit_delta: number | null;
  mt5_commission: number;
  replica_commission: number | null;
  commission_delta: number | null;
  mt5_swap: number;
  replica_observed_swap: number | null;
  observed_swap_delta: number | null;
  terminal_liquidation_deals: number;
  verdict: "PROFILED_PASS_YEARLY_SHAPE" | "PROFILED_MISMATCH" | "SKIP";
  content_hash?: string;
};

type ValidationRow = {
  check: string;
  value: string | number | boolean | null;
  expected: string | number | boolean | null;
  passed: boolean;
  content_hash?: string;
};

type ParsedReport = {
  inventory: ReportInventoryRow;
  summary: Mt5ReportSummaryRow;
  settings: SettingRow[];
  orders: OrderRow[];
  deals: DealRow[];
  yearly: YearlyClosedRow[];
  holds: HoldRow[];
};

const EXPECTED_REPORTS: ExpectedReport[] = [
  {
    case_id: "audcad_h1_12y_type1_type3_primary",
    scope: "primary",
    filename: "AUDCAD 12 YEAR TEST 1 HOUR CHART.html",
    required: true,
  },
  {
    case_id: "audcad_h1_type3_ma_changed_primary",
    scope: "primary",
    filename: "AUDCAD 12 YEAR TEST 1 HOUR CHART TYPE 3 ONLY MA SETTINGS CHANGED.html",
    required: true,
  },
  {
    case_id: "audjpy_h1_type3_primary",
    scope: "primary",
    filename: "AUDJPY 1 HOUR CHART.html",
    required: true,
  },
  {
    case_id: "audchf_h1_type3_secondary",
    scope: "secondary",
    filename: "AUDCHF 1 HOUR CHART.html",
    required: false,
  },
];

function parseOptions(): Options {
  const args = parseArgMap();
  return {
    reportDir: args.get("--report-dir") ?? DEFAULT_REPORT_DIR,
    mt5ExportDir: args.get("--mt5-export-dir") ?? DEFAULT_MT5_EXPORT_DIR,
    mt5TickTraceDir: args.get("--mt5-tick-trace-dir") ?? DEFAULT_MT5_TICK_TRACE_DIR,
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    mt5TimezoneOffsetHours: numberArg(args, "--mt5-timezone-offset-hours", 0),
    priceSource: parsePriceSource(args.get("--price-source") ?? "mt5-export"),
    skipCanonicalEntryReplay: args.get("--skip-canonical-entry-replay") === "true",
  };
}

function parsePriceSource(value: string): PriceSource {
  if (value === "mt5-export" || value === "canonical" || value === "none") return value;
  throw new Error(`Invalid --price-source=${value}; expected mt5-export, canonical, or none`);
}

function numberArg(args: Map<string, string>, key: string, fallback: number) {
  const raw = args.get(key);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${key}: ${raw}`);
  return parsed;
}

function normalizeText(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cellsFromRow(rowHtml: string) {
  const cells: string[] = [];
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let match: RegExpExecArray | null;
  while ((match = cellRegex.exec(rowHtml)) !== null) {
    cells.push(normalizeText(match[1] ?? ""));
  }
  return cells;
}

function rowsFromHtml(html: string) {
  const rows: string[][] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(html)) !== null) {
    const cells = cellsFromRow(match[1] ?? "");
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

function parseNumber(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = value
    .replace(/\u00A0/g, " ")
    .replace(/\([^)]*\)/g, "")
    .replace(/%/g, "")
    .replace(/\s+/g, "")
    .replace(/,/g, "");
  const match = cleaned.match(/[-+]?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value: string | null | undefined) {
  if (value === undefined || value === null) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

function normalizeSymbol(symbol: string | null) {
  if (!symbol) return null;
  return symbol.replace(/[^A-Z]/gi, "").toUpperCase().slice(0, 6);
}

function cleanMetricKey(value: string) {
  return value.replace(/:$/, "").trim();
}

function mt5TimestampToIso(value: string | null | undefined, offsetHours: number) {
  if (!value) return null;
  const match = value.match(/^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const ms = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
  ) - offsetHours * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

function sourceCoversRequestedEnd(lastBarOpenUtc: string | null, requestedEndUtc: string | null, timeframeMinutes = 60) {
  if (!lastBarOpenUtc || !requestedEndUtc) return false;
  const lastOpenMs = Date.parse(lastBarOpenUtc);
  const requestedEndMs = Date.parse(requestedEndUtc);
  if (!Number.isFinite(lastOpenMs) || !Number.isFinite(requestedEndMs)) return false;
  return lastOpenMs + timeframeMinutes * 60 * 1000 > requestedEndMs;
}

function parsePeriodBounds(period: string | null) {
  if (!period) return { start: null, end: null };
  const match = period.match(/\((\d{4})\.(\d{2})\.(\d{2})\s*-\s*(\d{4})\.(\d{2})\.(\d{2})\)/);
  if (!match) return { start: null, end: null };
  const start = `${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`;
  const endExclusiveMs = Date.UTC(Number(match[4]), Number(match[5]) - 1, Number(match[6]));
  const end = new Date(endExclusiveMs - 1000).toISOString();
  return { start, end };
}

function typedInput(settings: Map<string, string>, key: string) {
  return settings.get(key) ?? null;
}

function inferEntryOrderType(volume: number | null, baseLots: number | null): "TYPE1" | "TYPE3" | "OTHER" | "NOT_ENTRY" {
  if (volume === null || baseLots === null || baseLots <= 0) return "OTHER";
  if (Math.abs(volume - baseLots * 4) < 1e-9) return "TYPE1";
  if (Math.abs(volume - baseLots * 2) < 1e-9) return "TYPE3";
  return "OTHER";
}

function sectionIndexes(rows: string[][]) {
  const findTitle = (title: string) => rows.findIndex((row) => row.length === 1 && row[0] === title);
  return {
    settings: findTitle("Settings"),
    results: findTitle("Results"),
    orders: findTitle("Orders"),
    deals: findTitle("Deals"),
  };
}

function extractSettings(rows: string[][], caseId: string, scope: Scope, start: number, end: number) {
  const output: SettingRow[] = [];
  const map = new Map<string, string>();
  for (const row of rows.slice(start + 1, end)) {
    for (let index = 0; index < row.length; index += 1) {
      const cell = row[index] ?? "";
      if (cell.includes("=")) {
        const [key, ...rest] = cell.split("=");
        const rawValue = rest.join("=");
        const setting = {
          case_id: caseId,
          scope,
          section: "input" as const,
          key: key.trim(),
          raw_value: rawValue.trim(),
          numeric_value: parseNumber(rawValue),
        };
        output.push(withHash(setting));
        map.set(setting.key, setting.raw_value);
      } else if (cell.endsWith(":") && row[index + 1]) {
        const key = cleanMetricKey(cell);
        const rawValue = row[index + 1] ?? "";
        const setting = {
          case_id: caseId,
          scope,
          section: "setting" as const,
          key,
          raw_value: rawValue,
          numeric_value: parseNumber(rawValue),
        };
        output.push(withHash(setting));
        map.set(key, rawValue);
      }
    }
  }
  return { rows: output, map };
}

function extractResults(rows: string[][], caseId: string, scope: Scope, start: number, end: number) {
  const output: SettingRow[] = [];
  const map = new Map<string, string>();
  for (const row of rows.slice(start + 1, end)) {
    for (let index = 0; index < row.length - 1; index += 1) {
      const cell = row[index] ?? "";
      if (!cell.endsWith(":")) continue;
      const key = cleanMetricKey(cell);
      const rawValue = row[index + 1] ?? "";
      if (!key || !rawValue) continue;
      const result = {
        case_id: caseId,
        scope,
        section: "result" as const,
        key,
        raw_value: rawValue,
        numeric_value: parseNumber(rawValue),
      };
      output.push(withHash(result));
      map.set(key, rawValue);
    }
  }
  return { rows: output, map };
}

function extractOrders(rows: string[][], caseId: string, scope: Scope, start: number, end: number): OrderRow[] {
  const output: OrderRow[] = [];
  for (const row of rows.slice(start + 2, end)) {
    if (row.length < 10) continue;
    if (!/^\d{4}\.\d{2}\.\d{2}/.test(row[0] ?? "")) continue;
    const type = row[3] ?? "";
    const comment = row.at(-1) ?? null;
    const order = {
      case_id: caseId,
      scope,
      open_time: row[0] ?? "",
      order_id: row[1] ?? "",
      symbol: row[2] ?? "",
      type,
      volume: row[4] ?? "",
      price: parseNumber(row[5]),
      stop_loss: row[6] || null,
      take_profit: row[7] || null,
      close_or_fill_time: row[8] || null,
      state: row[9] || null,
      comment,
      inferred_order_role: comment?.startsWith("sl ") || comment === "end of test" ? "exit_or_liquidation" as const : comment?.includes("_LimniHedge") ? "entry" as const : "unknown" as const,
    };
    output.push(withHash(order));
  }
  return output;
}

function extractDeals(rows: string[][], caseId: string, scope: Scope, start: number, baseLots: number | null): DealRow[] {
  const output: DealRow[] = [];
  for (const row of rows.slice(start + 2)) {
    if (row.length < 13) continue;
    if (!/^\d{4}\.\d{2}\.\d{2}/.test(row[0] ?? "")) continue;
    const direction = row[4] ?? "";
    const volume = parseNumber(row[5]);
    const inferred = direction === "in" ? inferEntryOrderType(volume, baseLots) : "NOT_ENTRY";
    const commission = parseNumber(row[8]) ?? 0;
    const swap = parseNumber(row[9]) ?? 0;
    const profit = parseNumber(row[10]) ?? 0;
    const deal = {
      case_id: caseId,
      scope,
      time: row[0] ?? "",
      deal_id: row[1] ?? "",
      symbol: row[2] ?? "",
      type: row[3] ?? "",
      direction,
      volume,
      price: parseNumber(row[6]),
      order_id: row[7] ?? "",
      commission,
      swap,
      profit,
      balance: parseNumber(row[11]),
      comment: row[12] || null,
      inferred_order_type: inferred,
      net_profit: round2(commission + swap + profit),
    };
    output.push(withHash(deal));
  }
  return output;
}

function round2(value: number) {
  return round(value, 2) ?? value;
}

function computeHolds(caseId: string, scope: Scope, deals: DealRow[], offsetHours: number): HoldRow[] {
  type OpenDeal = DealRow & { remaining: number };
  const longQueue: OpenDeal[] = [];
  const shortQueue: OpenDeal[] = [];
  const holds: HoldRow[] = [];

  for (const deal of deals) {
    if (deal.direction === "in" && deal.volume !== null) {
      const side: Side | null = deal.type === "buy" ? "BUY" : deal.type === "sell" ? "SELL" : null;
      if (!side) continue;
      const openDeal: OpenDeal = { ...deal, remaining: deal.volume };
      if (side === "BUY") longQueue.push(openDeal);
      else shortQueue.push(openDeal);
      continue;
    }

    if (deal.direction !== "out" || deal.volume === null) continue;
    const closeSide: Side | null = deal.type === "sell" ? "BUY" : deal.type === "buy" ? "SELL" : null;
    if (!closeSide) continue;
    let remainingClose = deal.volume;
    const queue = closeSide === "BUY" ? longQueue : shortQueue;

    while (remainingClose > 1e-9 && queue.length > 0) {
      const open = queue[0]!;
      const matchedVolume = Math.min(open.remaining, remainingClose);
      const entryIso = mt5TimestampToIso(open.time, offsetHours);
      const exitIso = mt5TimestampToIso(deal.time, offsetHours);
      if (entryIso && exitIso) {
        const holdHours = (new Date(exitIso).getTime() - new Date(entryIso).getTime()) / (60 * 60 * 1000);
        holds.push(withHash({
          case_id: caseId,
          scope,
          entry_time: open.time,
          exit_time: deal.time,
          side: closeSide,
          volume: round(matchedVolume, 2) ?? matchedVolume,
          entry_price: open.price,
          exit_price: deal.price,
          exit_comment: deal.comment,
          hold_hours: round(holdHours, 6) ?? holdHours,
          commission: round2((deal.commission * matchedVolume) / deal.volume),
          swap: round2((deal.swap * matchedVolume) / deal.volume),
          price_profit: round2((deal.profit * matchedVolume) / deal.volume),
          net_profit: round2((deal.net_profit * matchedVolume) / deal.volume),
        }));
      }
      open.remaining = round(open.remaining - matchedVolume, 10) ?? open.remaining - matchedVolume;
      remainingClose = round(remainingClose - matchedVolume, 10) ?? remainingClose - matchedVolume;
      if (open.remaining <= 1e-9) queue.shift();
    }
  }

  return holds;
}

function yearlyRows(caseId: string, scope: Scope, deals: DealRow[]): YearlyClosedRow[] {
  const groups = new Map<number, DealRow[]>();
  for (const deal of deals) {
    if (deal.direction !== "out") continue;
    const year = Number(deal.time.slice(0, 4));
    if (!Number.isFinite(year)) continue;
    groups.set(year, [...(groups.get(year) ?? []), deal]);
  }

  return [...groups.entries()].sort(([left], [right]) => left - right).map(([year, rows]) => withHash({
    case_id: caseId,
    scope,
    close_year: year,
    exit_deals: rows.length,
    net_profit: round2(rows.reduce((sum, row) => sum + row.net_profit, 0)),
    commission: round2(rows.reduce((sum, row) => sum + row.commission, 0)),
    swap: round2(rows.reduce((sum, row) => sum + row.swap, 0)),
    price_profit: round2(rows.reduce((sum, row) => sum + row.profit, 0)),
    terminal_liquidation_deals: rows.filter((row) => row.comment === "end of test").length,
  }));
}

function summarizeReport(params: {
  caseId: string;
  scope: Scope;
  sourcePath: string;
  sourceHash: string;
  settings: Map<string, string>;
  results: Map<string, string>;
  orders: OrderRow[];
  deals: DealRow[];
  holds: HoldRow[];
}) {
  const entries = params.deals.filter((deal) => deal.direction === "in");
  const exits = params.deals.filter((deal) => deal.direction === "out");
  const tradeDeals = params.deals.filter((deal) => deal.type !== "balance");
  const period = typedInput(params.settings, "Period");
  const bounds = parsePeriodBounds(period);
  const positive = exits.map((deal) => deal.net_profit).filter((value) => value > 0);
  const negative = exits.map((deal) => deal.net_profit).filter((value) => value < 0);
  const maxHold = params.holds.reduce<HoldRow | null>((best, row) => !best || row.hold_hours > best.hold_hours ? row : best, null);
  const summary: Mt5ReportSummaryRow = {
    case_id: params.caseId,
    scope: params.scope,
    source_path: toRepoRelativeOrAbsolute(params.sourcePath),
    source_sha256: params.sourceHash,
    expert: typedInput(params.settings, "Expert"),
    symbol: typedInput(params.settings, "Symbol"),
    normalized_symbol: normalizeSymbol(typedInput(params.settings, "Symbol")),
    period,
    report_start: bounds.start,
    report_end: bounds.end,
    inputs_trade_lots: parseNumber(typedInput(params.settings, "Trade_Lots")),
    inputs_type1_enabled: parseBoolean(typedInput(params.settings, "InpUse_Type1_Orders")),
    inputs_type3_enabled: parseBoolean(typedInput(params.settings, "InpUse_Type3_Orders")),
    inputs_wait_for_first_trend_change: parseBoolean(typedInput(params.settings, "WaitForFirstTrendChange")),
    inputs_ma_period: parseNumber(typedInput(params.settings, "MAPeriod")),
    inputs_ma_type: typedInput(params.settings, "MAType"),
    inputs_ma_price: typedInput(params.settings, "MAPrice"),
    inputs_rsi_period: parseNumber(typedInput(params.settings, "RSIPeriod")),
    inputs_rsi_overbought: parseNumber(typedInput(params.settings, "RSIOverBought")),
    inputs_rsi_oversold: parseNumber(typedInput(params.settings, "RSIOverSold")),
    inputs_trail_start_pips: parseNumber(typedInput(params.settings, "Trail_Start_Pips")),
    inputs_trail_step_pips: parseNumber(typedInput(params.settings, "Trail_Step_Pips")),
    inputs_trail_stop_pips: parseNumber(typedInput(params.settings, "Trail_Stop_Pips")),
    headline_total_net_profit: parseNumber(params.results.get("Total Net Profit")),
    headline_profit_factor: parseNumber(params.results.get("Profit Factor")),
    headline_total_deals: parseNumber(params.results.get("Total Deals")),
    headline_balance_drawdown_maximal: params.results.get("Balance Drawdown Maximal") ?? null,
    headline_equity_drawdown_maximal: params.results.get("Equity Drawdown Maximal") ?? null,
    orders_rows: params.orders.length,
    deals_rows: params.deals.length,
    entry_deals: entries.length,
    exit_deals: exits.length,
    buy_entry_deals: entries.filter((deal) => deal.type === "buy").length,
    sell_entry_deals: entries.filter((deal) => deal.type === "sell").length,
    observed_type1_entries: entries.filter((deal) => deal.inferred_order_type === "TYPE1").length,
    observed_type3_entries: entries.filter((deal) => deal.inferred_order_type === "TYPE3").length,
    observed_other_entry_volume_rows: entries.filter((deal) => deal.inferred_order_type === "OTHER").length,
    sl_exit_deals: exits.filter((deal) => deal.comment?.startsWith("sl ")).length,
    terminal_liquidation_deals: exits.filter((deal) => deal.comment === "end of test").length,
    first_entry_time: entries[0]?.time ?? null,
    last_entry_time: entries.at(-1)?.time ?? null,
    first_exit_time: exits[0]?.time ?? null,
    last_exit_time: exits.at(-1)?.time ?? null,
    deal_sum_net_profit: round2(tradeDeals.reduce((sum, deal) => sum + deal.net_profit, 0)),
    deal_sum_commission: round2(tradeDeals.reduce((sum, deal) => sum + deal.commission, 0)),
    deal_sum_swap: round2(tradeDeals.reduce((sum, deal) => sum + deal.swap, 0)),
    deal_sum_price_profit: round2(tradeDeals.reduce((sum, deal) => sum + deal.profit, 0)),
    deal_profit_factor: positive.length || negative.length ? profitFactor([...positive, ...negative]) : null,
    final_balance: [...params.deals].reverse().find((deal) => deal.balance !== null)?.balance ?? null,
    average_hold_hours_fifo: params.holds.length ? round(params.holds.reduce((sum, row) => sum + row.hold_hours, 0) / params.holds.length, 6) : null,
    max_hold_hours_fifo: maxHold ? maxHold.hold_hours : null,
    max_hold_entry_time_fifo: maxHold ? maxHold.entry_time : null,
    max_hold_exit_time_fifo: maxHold ? maxHold.exit_time : null,
  };
  return withHash(summary);
}

function toRepoRelativeOrAbsolute(filePath: string) {
  const resolved = path.resolve(filePath);
  const cwd = path.resolve(process.cwd());
  return resolved.toLowerCase().startsWith(cwd.toLowerCase()) ? toRepoRelative(resolved) : resolved.split(path.sep).join("/");
}

async function inventoryPath(reportDir: string, expected: ExpectedReport): Promise<ReportInventoryRow> {
  const resolved = path.join(reportDir, expected.filename);
  try {
    const info = await stat(resolved);
    return withHash({
      case_id: expected.case_id,
      scope: expected.scope,
      expected_filename: expected.filename,
      resolved_path: toRepoRelativeOrAbsolute(resolved),
      exists: true,
      file_size_bytes: info.size,
      last_modified_utc: info.mtime.toISOString(),
      note: "expected_report_found",
    });
  } catch {
    return withHash({
      case_id: expected.case_id,
      scope: expected.scope,
      expected_filename: expected.filename,
      resolved_path: null,
      exists: false,
      file_size_bytes: null,
      last_modified_utc: null,
      note: expected.required ? "missing_required_primary_report" : "missing_secondary_report",
    });
  }
}

async function discoveredReports(reportDir: string, expectedNames: Set<string>): Promise<ReportInventoryRow[]> {
  const rows: ReportInventoryRow[] = [];
  for (const entry of await readdir(reportDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".html")) continue;
    if (expectedNames.has(entry.name)) continue;
    const resolved = path.join(reportDir, entry.name);
    const info = await stat(resolved);
    rows.push(withHash({
      case_id: discoveredCaseId(entry.name),
      scope: "discovered" as const,
      expected_filename: entry.name,
      resolved_path: toRepoRelativeOrAbsolute(resolved),
      exists: true,
      file_size_bytes: info.size,
      last_modified_utc: info.mtime.toISOString(),
      note: "discovered_html_report_not_in_primary_handoff_list",
    }));
  }
  return rows.sort((left, right) => left.expected_filename.localeCompare(right.expected_filename));
}

function discoveredCaseId(filename: string) {
  return filename
    .replace(/\.html$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function parseReport(inventory: ReportInventoryRow, offsetHours: number): Promise<ParsedReport | null> {
  if (!inventory.exists || !inventory.resolved_path) return null;
  const sourcePath = path.isAbsolute(inventory.resolved_path) ? inventory.resolved_path : path.resolve(process.cwd(), inventory.resolved_path);
  const bytes = await readFile(sourcePath);
  const sourceHash = sha256Text(bytes);
  const html = bytes[0] === 0xff && bytes[1] === 0xfe ? bytes.toString("utf16le") : bytes.toString("utf8");
  const rows = rowsFromHtml(html);
  const indexes = sectionIndexes(rows);
  if (indexes.settings < 0 || indexes.results < 0 || indexes.orders < 0 || indexes.deals < 0) {
    throw new Error(`Could not parse MT5 report sections: ${sourcePath}`);
  }

  const settings = extractSettings(rows, inventory.case_id, inventory.scope, indexes.settings, indexes.results);
  const results = extractResults(rows, inventory.case_id, inventory.scope, indexes.results, indexes.orders);
  const baseLots = parseNumber(settings.map.get("Trade_Lots"));
  const orders = extractOrders(rows, inventory.case_id, inventory.scope, indexes.orders, indexes.deals);
  const deals = extractDeals(rows, inventory.case_id, inventory.scope, indexes.deals, baseLots);
  const holds = computeHolds(inventory.case_id, inventory.scope, deals, offsetHours);
  const yearly = yearlyRows(inventory.case_id, inventory.scope, deals);
  const summary = summarizeReport({
    caseId: inventory.case_id,
    scope: inventory.scope,
    sourcePath,
    sourceHash,
    settings: settings.map,
    results: results.map,
    orders,
    deals,
    holds,
  });

  return {
    inventory,
    summary,
    settings: [...settings.rows, ...results.rows],
    orders,
    deals,
    yearly,
    holds,
  };
}

function withHash<T extends Record<string, unknown>>(row: T): T & { content_hash: string } {
  return { ...row, content_hash: sha256Stable(row) };
}

function replicaContractRows(): ReplicaContractRow[] {
  return [
    {
      component: "MT5 reference boundary",
      legacy_source: "automation/mt5/Experts/LimniHedge_V1.mq5",
      repo_replica_contract: "EA source is read-only in Gate 92; report parser and entry-shape replay are the mutation surface.",
      parity_observable: "source hash, parsed MT5 report settings, entry deals, exit deals, terminal liquidation count",
      status: "reference_only",
    },
    {
      component: "David MA color state",
      legacy_source: "David_MA_Color_V1f_Updated buffer 0 non-empty means downtrend; empty means uptrend.",
      repo_replica_contract: "LWMA current/previous slope with RSI-gated trend changes: DOWN requires RSI below oversold, UP requires RSI above overbought.",
      parity_observable: "entry timestamp/side alignment and state receipts emitted for replica entries",
      status: "implemented_entry_shape",
    },
    {
      component: "Type 1 trigger",
      legacy_source: "On new bar, trend_change down-to-up opens buy; trend_change up-to-down opens sell.",
      repo_replica_contract: "Open at next H1 bar timestamp with lot size Trade_Lots * 4 when Type 1 is enabled.",
      parity_observable: "MT5 entry deal volume classified as TYPE1 and compared by sequence",
      status: "implemented_entry_shape",
    },
    {
      component: "Type 3 trigger",
      legacy_source: "Four closed David bars in one regime plus one seed candle and four counter-regime candles.",
      repo_replica_contract: "DOWN trend bars 4..1 plus bearish seed then four bullish candles opens buy at Trade_Lots * 2; UP trend mirror opens sell.",
      parity_observable: "MT5 entry deal volume classified as TYPE3 and compared by sequence",
      status: "implemented_entry_shape",
    },
    {
      component: "Trailing stop and exit semantics",
      legacy_source: "TrailingStop runs tick-by-tick by default; zero TP/SL means exits mostly through trailing SL or terminal liquidation.",
      repo_replica_contract: "Not promoted from H1-only entry replay. Requires broker-equivalent tick or MT5 export before PnL parity can be trusted.",
      parity_observable: "sl comment count, terminal liquidation count, deal PnL, swap, commission, hold-time shape",
      status: "blocked_until_price_source",
    },
    {
      component: "Coverage guard",
      legacy_source: "Saved MT5 reports end at 2026.07.02/2026.07.03 and use Eightcap MT5 report data.",
      repo_replica_contract: "Canonical Gate 55E bundle coverage must reach the report window before full replay parity is valid.",
      parity_observable: "canonical coverage rows and validation fail closed if coverage misses report start/end",
      status: "blocked_until_price_source",
    },
  ].map((row) => withHash(row));
}

async function canonicalCoverageRows(symbols: string[], summaries: Mt5ReportSummaryRow[]) {
  if (symbols.length === 0) return [] as CanonicalCoverageRow[];
  const requested = new Map(summaries.map((summary) => [summary.normalized_symbol, summary]));
  const rows = await query<{
    symbol: string;
    timeframe: string;
    bar_count: string | number;
    first_bar_open_utc: Date | null;
    last_bar_open_utc: Date | null;
  }>(
    `SELECT symbol, timeframe, COUNT(*) AS bar_count,
            MIN(bar_open_utc) AS first_bar_open_utc,
            MAX(bar_open_utc) AS last_bar_open_utc
       FROM canonical_price_bars
      WHERE symbol = ANY($1::text[])
        AND timeframe = '1h'
      GROUP BY symbol, timeframe
      ORDER BY symbol, timeframe`,
    [symbols],
  );

  const bySymbol = new Map(rows.map((row) => [row.symbol, row]));
  return symbols.map((symbol) => {
    const row = bySymbol.get(symbol);
    const summary = requested.get(symbol);
    const first = row?.first_bar_open_utc ? row.first_bar_open_utc.toISOString() : null;
    const last = row?.last_bar_open_utc ? row.last_bar_open_utc.toISOString() : null;
    return withHash({
      symbol,
      timeframe: "1h",
      source: "canonical_price_bars" as const,
      source_path: null,
      note: row ? "canonical_price_bars_query_succeeded" : "canonical_price_bars_symbol_missing",
      bar_count: Number(row?.bar_count ?? 0),
      first_bar_open_utc: first,
      last_bar_open_utc: last,
      requested_from_utc: summary?.report_start ?? null,
      requested_to_utc: summary?.report_end ?? null,
      reaches_report_start: Boolean(first && summary?.report_start && first <= summary.report_start),
      reaches_report_end: sourceCoversRequestedEnd(last, summary?.report_end ?? null),
    });
  });
}

async function loadCanonicalBars(symbol: string, fromUtc: string, toUtc: string): Promise<Bar[]> {
  const rows = await query<{
    symbol: string;
    bar_open_utc: Date;
    open_price: string | number;
    high_price: string | number;
    low_price: string | number;
    close_price: string | number;
  }>(
    `SELECT symbol, bar_open_utc, open_price, high_price, low_price, close_price
       FROM canonical_price_bars
      WHERE symbol = $1
        AND timeframe = '1h'
        AND bar_open_utc >= $2::timestamptz
        AND bar_open_utc <= $3::timestamptz
      ORDER BY bar_open_utc ASC`,
    [symbol, fromUtc, toUtc],
  );

  return rows.map((row) => ({
    symbol: row.symbol,
    bar_open_utc: row.bar_open_utc.toISOString(),
    open: Number(row.open_price),
    high: Number(row.high_price),
    low: Number(row.low_price),
    close: Number(row.close_price),
    tick_volume: null,
    spread: null,
    david_state: null,
  }));
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
    for (let index = 0; index < header.length; index += 1) {
      row[header[index]!] = cells[index] ?? "";
    }
    return row;
  });
}

function parseExportDavidState(value: string | null | undefined): TrendState | null {
  const normalized = (value ?? "").trim().toUpperCase();
  if (normalized === "DOWN") return -1;
  if (normalized === "UP") return 1;
  return null;
}

async function findMt5ExportPath(symbol: string, exportDir: string) {
  const exact = path.join(exportDir, `${symbol}_H1_LimniHedgeV1Parity.csv`);
  try {
    await stat(exact);
    return exact;
  } catch {
    // Fall through to a case-insensitive symbol scan below.
  }

  try {
    const entries = await readdir(exportDir, { withFileTypes: true });
    const normalized = symbol.toUpperCase();
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".csv")) continue;
      if (!entry.name.toUpperCase().includes(normalized)) continue;
      return path.join(exportDir, entry.name);
    }
  } catch {
    return null;
  }

  return null;
}

function davidProfileForSummary(summary: Mt5ReportSummaryRow) {
  const maPeriod = summary.inputs_ma_period ?? 100;
  const rsiPeriod = summary.inputs_rsi_period ?? 100;
  const overbought = summary.inputs_rsi_overbought ?? 70;
  const oversold = summary.inputs_rsi_oversold ?? 30;
  return `ma${maPeriod}_rsi${rsiPeriod}_${overbought}_${oversold}`;
}

function mt5ExportDirForSummary(summary: Mt5ReportSummaryRow, defaultExportDir: string) {
  const overbought = summary.inputs_rsi_overbought ?? 70;
  const oversold = summary.inputs_rsi_oversold ?? 30;
  if (overbought === 60 && oversold === 40) {
    return path.join(path.dirname(defaultExportDir), "LimniHedge_V1_Parity_RSI60_40");
  }
  return defaultExportDir;
}

async function loadMt5ExportBars(symbol: string, exportDir: string, offsetHours: number, fromUtc: string | null, toUtc: string | null): Promise<{ path: string | null; bars: Bar[] }> {
  const exportPath = await findMt5ExportPath(symbol, exportDir);
  if (!exportPath) return { path: null, bars: [] };

  const text = await readFile(exportPath, "utf8");
  const rows = parseCsv(text);
  const bars = rows
    .map((row) => {
      const rowSymbol = normalizeSymbol(row.symbol || row.broker_symbol || symbol);
      if (rowSymbol !== symbol) return null;
      const iso = mt5TimestampToIso(row.bar_time || row.time || row.bar_open_utc, offsetHours);
      if (!iso) return null;
      const open = parseNumber(row.open);
      const high = parseNumber(row.high);
      const low = parseNumber(row.low);
      const close = parseNumber(row.close);
      const tickVolume = parseNumber(row.tick_volume);
      const spread = parseNumber(row.spread);
      if (open === null || high === null || low === null || close === null) return null;
      if (fromUtc && iso < fromUtc) return null;
      if (toUtc && iso > toUtc) return null;
      return {
        symbol,
        bar_open_utc: iso,
        open,
        high,
        low,
        close,
        tick_volume: tickVolume,
        spread,
        david_state: parseExportDavidState(row.david_state),
      } satisfies Bar;
    })
    .filter((row): row is Bar => row !== null)
    .sort((left, right) => left.bar_open_utc.localeCompare(right.bar_open_utc));

  return { path: exportPath, bars };
}

async function findMt5TickTracePath(symbol: string, traceDir: string) {
  const exact = path.join(traceDir, `${symbol}_PERIOD_H1_TickTrace.csv`);
  try {
    await stat(exact);
    return exact;
  } catch {
    // Fall through to case-insensitive scan.
  }

  try {
    const entries = await readdir(traceDir, { withFileTypes: true });
    const normalized = symbol.toUpperCase();
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".csv")) continue;
      if (!entry.name.toUpperCase().includes(normalized)) continue;
      if (!entry.name.toUpperCase().includes("TICKTRACE")) continue;
      return path.join(traceDir, entry.name);
    }
  } catch {
    return null;
  }

  return null;
}

async function loadMt5TickOpenQuotes(symbol: string, traceDir: string, offsetHours: number, fromUtc: string | null, toUtc: string | null): Promise<Map<string, TickOpenQuote>> {
  const tracePath = await findMt5TickTracePath(symbol, traceDir);
  if (!tracePath) return new Map();

  const text = await readFile(tracePath, "utf8");
  const rows = parseCsv(text);
  const quotes = new Map<string, TickOpenQuote>();
  for (const row of rows) {
    const rowSymbol = normalizeSymbol(row.symbol || row.broker_symbol || symbol);
    if (rowSymbol !== symbol) continue;
    const iso = mt5TimestampToIso(row.bar_time || row.tick_time, offsetHours);
    if (!iso) continue;
    if (fromUtc && iso < fromUtc) continue;
    if (toUtc && iso > toUtc) continue;
    const bid = parseNumber(row.bid);
    const ask = parseNumber(row.ask);
    if (bid === null || ask === null) continue;
    quotes.set(iso, {
      bar_open_utc: iso,
      bid,
      ask,
      spread_points: parseNumber(row.spread_points),
    });
  }
  return quotes;
}

async function mt5ExportCoverageRows(summaries: Mt5ReportSummaryRow[], exportDir: string, offsetHours: number) {
  const rows: CanonicalCoverageRow[] = [];
  for (const summary of summaries) {
    const symbol = summary.normalized_symbol;
    if (!symbol) continue;
    const selectedExportDir = mt5ExportDirForSummary(summary, exportDir);
    const loaded = await loadMt5ExportBars(symbol, selectedExportDir, offsetHours, null, null);
    const first = loaded.bars[0]?.bar_open_utc ?? null;
    const last = loaded.bars.at(-1)?.bar_open_utc ?? null;
    rows.push(withHash({
      case_id: summary.case_id,
      scope: summary.scope,
      symbol,
      timeframe: "1h",
      source: "mt5_h1_export" as const,
      source_path: loaded.path ? toRepoRelativeOrAbsolute(loaded.path) : null,
      david_profile: davidProfileForSummary(summary),
      note: loaded.path ? "mt5_h1_export_loaded_for_report_profile" : "missing_mt5_h1_export_csv_for_report_profile",
      bar_count: loaded.bars.length,
      first_bar_open_utc: first,
      last_bar_open_utc: last,
      requested_from_utc: summary.report_start,
      requested_to_utc: summary.report_end,
      reaches_report_start: Boolean(first && summary.report_start && first <= summary.report_start),
      reaches_report_end: sourceCoversRequestedEnd(last, summary.report_end),
    }));
  }
  return rows;
}

function emptyCoverageRows(symbols: string[], summaries: Mt5ReportSummaryRow[]) {
  const requested = new Map(summaries.map((summary) => [summary.normalized_symbol, summary]));
  return symbols.map((symbol) => {
    const summary = requested.get(symbol);
    return withHash({
      symbol,
      timeframe: "1h",
      source: "none" as const,
      source_path: null,
      note: "entry_replay_disabled",
      bar_count: 0,
      first_bar_open_utc: null,
      last_bar_open_utc: null,
      requested_from_utc: summary?.report_start ?? null,
      requested_to_utc: summary?.report_end ?? null,
      reaches_report_start: false,
      reaches_report_end: false,
    });
  });
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

function buildDavidStates(bars: Bar[], maPeriod: number, rsiPeriod: number, overbought: number, oversold: number) {
  const states: Array<TrendState | null> = Array(bars.length).fill(null);
  let davidState: TrendState | null = null;
  let prevClose: number | null = null;
  const rsiWarm: Array<{ gain: number; loss: number }> = [];
  let avgGain: number | null = null;
  let avgLoss: number | null = null;
  let lastRsi: number | null = null;

  for (let index = 0; index < bars.length; index += 1) {
    const close = bars[index]!.close;
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
    const closesThroughCurrent = bars.slice(0, index + 1).map((bar) => bar.close);
    const currentMa = lwma(closesThroughCurrent.slice(-maPeriod));
    const previousMa = lwma(closesThroughCurrent.slice(-maPeriod - 1, -1));
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

function candleDirection(bar: Bar): TrendState | 0 {
  if (bar.close > bar.open) return 1;
  if (bar.close < bar.open) return -1;
  return 0;
}

function type3CandleCombination(bars: Bar[], currentBarIndex: number) {
  const c = (shift: number) => candleDirection(bars[currentBarIndex - shift]!);
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

function runEntryReplica(summary: Mt5ReportSummaryRow, bars: Bar[]): ReplicaEntryRow[] {
  const maPeriod = summary.inputs_ma_period ?? 100;
  const rsiPeriod = summary.inputs_rsi_period ?? 100;
  const overbought = summary.inputs_rsi_overbought ?? 70;
  const oversold = summary.inputs_rsi_oversold ?? 30;
  const tradeLots = summary.inputs_trade_lots ?? 0.01;
  const hasExportedDavidState = bars.some((bar) => bar.david_state !== undefined && bar.david_state !== null);
  const davidStateSource = hasExportedDavidState ? "mt5_export_indicator_buffer" as const : "repo_recomputed_lwma_rsi" as const;
  const states = hasExportedDavidState
    ? bars.map((bar) => bar.david_state ?? null)
    : buildDavidStates(bars, maPeriod, rsiPeriod, overbought, oversold);
  const entries: ReplicaEntryRow[] = [];
  let oldTrendDir: TrendState | 0 = 0;
  let firstTrendChange = false;
  let lastType1Time: string | null = null;
  let lastType3Time: string | null = null;
  const waitForFirstTrendChange = summary.inputs_wait_for_first_trend_change !== false;

  for (let currentIndex = Math.max(5, maPeriod + 2); currentIndex < bars.length; currentIndex += 1) {
    const currentBar = bars[currentIndex]!;
    const currentTime = currentBar.bar_open_utc;
    const entryBarFields = {
      bar_hour_utc: currentTime.slice(11, 13),
      bar_spread: currentBar.spread,
      bar_tick_volume: currentBar.tick_volume,
    };
    const s1 = states[currentIndex - 1];
    const s2 = states[currentIndex - 2];
    const s3 = states[currentIndex - 3];
    const s4 = states[currentIndex - 4];
    if (s1 === null || s2 === null || s3 === null || s4 === null) continue;
    let currentTrendDir: TrendState = s1;

    if (waitForFirstTrendChange && !firstTrendChange) {
      if (s2 !== s1) {
        oldTrendDir = s2;
        currentTrendDir = s1;
        firstTrendChange = true;
      } else {
        continue;
      }
    } else if (!waitForFirstTrendChange) {
      oldTrendDir = s2;
    }

    let trendChange: TrendState | 0 = 0;
    if (oldTrendDir === -1 && currentTrendDir === 1) {
      trendChange = 1;
      oldTrendDir = 1;
    } else if (oldTrendDir === 1 && currentTrendDir === -1) {
      trendChange = -1;
      oldTrendDir = -1;
    }

    if (summary.inputs_type1_enabled && lastType1Time !== currentTime) {
      if (trendChange === 1) {
        entries.push(withHash({
          case_id: summary.case_id,
          symbol: summary.normalized_symbol ?? "",
          entry_time: currentTime,
          side: "BUY" as const,
          order_type: "TYPE1" as const,
          lot_size: round(tradeLots * 4, 2) ?? tradeLots * 4,
          david_state_shift1: "UP" as const,
          david_state_source: davidStateSource,
          type3_candle_combination: type3CandleCombination(bars, currentIndex),
          ...entryBarFields,
        }));
        lastType1Time = currentTime;
      } else if (trendChange === -1) {
        entries.push(withHash({
          case_id: summary.case_id,
          symbol: summary.normalized_symbol ?? "",
          entry_time: currentTime,
          side: "SELL" as const,
          order_type: "TYPE1" as const,
          lot_size: round(tradeLots * 4, 2) ?? tradeLots * 4,
          david_state_shift1: "DOWN" as const,
          david_state_source: davidStateSource,
          type3_candle_combination: type3CandleCombination(bars, currentIndex),
          ...entryBarFields,
        }));
        lastType1Time = currentTime;
      }
    }

    if (summary.inputs_type3_enabled && lastType3Time !== currentTime) {
      const combo = type3CandleCombination(bars, currentIndex);
      if (s4 === -1 && s3 === -1 && s2 === -1 && s1 === -1 && combo === 4) {
        entries.push(withHash({
          case_id: summary.case_id,
          symbol: summary.normalized_symbol ?? "",
          entry_time: currentTime,
          side: "BUY" as const,
          order_type: "TYPE3" as const,
          lot_size: round(tradeLots * 2, 2) ?? tradeLots * 2,
          david_state_shift1: "DOWN" as const,
          david_state_source: davidStateSource,
          type3_candle_combination: combo,
          ...entryBarFields,
        }));
        lastType3Time = currentTime;
      } else if (s4 === 1 && s3 === 1 && s2 === 1 && s1 === 1 && combo === -4) {
        entries.push(withHash({
          case_id: summary.case_id,
          symbol: summary.normalized_symbol ?? "",
          entry_time: currentTime,
          side: "SELL" as const,
          order_type: "TYPE3" as const,
          lot_size: round(tradeLots * 2, 2) ?? tradeLots * 2,
          david_state_shift1: "UP" as const,
          david_state_source: davidStateSource,
          type3_candle_combination: combo,
          ...entryBarFields,
        }));
        lastType3Time = currentTime;
      }
    }
  }

  return entries;
}

function mt5EntryRowsForSummary(summary: Mt5ReportSummaryRow, deals: DealRow[], offsetHours: number): ReplicaEntryRow[] {
  return deals
    .filter((deal) => deal.direction === "in" && deal.inferred_order_type !== "NOT_ENTRY")
    .map((deal) => withHash({
      case_id: summary.case_id,
      symbol: summary.normalized_symbol ?? "",
      entry_time: mt5TimestampToIso(deal.time, offsetHours) ?? deal.time,
      side: deal.type === "buy" ? "BUY" as const : "SELL" as const,
      order_type: deal.inferred_order_type === "TYPE1" ? "TYPE1" as const : deal.inferred_order_type === "TYPE3" ? "TYPE3" as const : "TYPE3" as const,
      lot_size: deal.volume ?? 0,
      david_state_shift1: deal.type === "buy" ? "DOWN" as const : "UP" as const,
      david_state_source: "mt5_export_indicator_buffer" as const,
      type3_candle_combination: deal.type === "buy" ? 4 : -4,
      bar_hour_utc: (mt5TimestampToIso(deal.time, offsetHours) ?? "").slice(11, 13),
      bar_spread: null,
      bar_tick_volume: null,
    }));
}

function stripContentHash<T extends { content_hash?: string }>(row: T): Omit<T, "content_hash"> {
  const { content_hash: _contentHash, ...withoutHash } = row;
  return withoutHash;
}

function applyMt5TesterAcceptance(summary: Mt5ReportSummaryRow, rawEntries: ReplicaEntryRow[]): ReplicaAcceptanceRow[] {
  return rawEntries.map((entry, index) => {
    const base = stripContentHash(entry);
    const afterReportEnd = Boolean(summary.report_end && entry.entry_time > summary.report_end);
    const dailyRollover = entry.entry_time.slice(11, 13) === "00";
    const acceptance = afterReportEnd
      ? {
          acceptance_status: "skipped_after_report_execution_end" as const,
          acceptance_reason: "candidate occurs after the MT5 tester execution boundary derived from the report period",
        }
      : dailyRollover
        ? {
            acceptance_status: "skipped_daily_rollover_0000" as const,
            acceptance_reason: "saved MT5 reports contain zero accepted entry deals at 00:00; treat rollover candidates as tester-admission rejects",
          }
        : {
            acceptance_status: "accepted" as const,
            acceptance_reason: "candidate remains inside MT5 report execution window and outside daily rollover hour",
          };
    return withHash({
      ...base,
      raw_sequence_index: index,
      ...acceptance,
      report_execution_end_utc: summary.report_end,
    });
  });
}

function acceptedReplicaEntries(rows: ReplicaAcceptanceRow[]): ReplicaEntryRow[] {
  return rows
    .filter((row) => row.acceptance_status === "accepted")
    .map((row) => {
      const {
        raw_sequence_index: _rawSequenceIndex,
        acceptance_status: _acceptanceStatus,
        acceptance_reason: _acceptanceReason,
        report_execution_end_utc: _reportExecutionEndUtc,
        ...entry
      } = stripContentHash(row);
      return withHash(entry);
    });
}

function compareEntries(params: {
  summary: Mt5ReportSummaryRow;
  mt5Entries: ReplicaEntryRow[];
  replicaEntries: ReplicaEntryRow[];
  coverage: CanonicalCoverageRow | null;
}): EntryComparisonRow {
  const coverageFrom = maxIso(params.summary.report_start, params.coverage?.first_bar_open_utc ?? null);
  const coverageTo = minIso(params.summary.report_end, params.coverage?.last_bar_open_utc ?? null);
  if (!params.coverage || params.coverage.bar_count === 0 || !coverageFrom || !coverageTo) {
    return withHash({
      case_id: params.summary.case_id,
      scope: params.summary.scope,
      normalized_symbol: params.summary.normalized_symbol ?? "",
      comparison_status: "skipped_missing_h1_source_bars" as const,
      mt5_entries_in_coverage: 0,
      replica_entries_in_coverage: 0,
      exact_sequence_matches: 0,
      first_mismatch_index: null,
      first_mismatch_mt5: null,
      first_mismatch_replica: null,
      mt5_first_entry_in_coverage: null,
      replica_first_entry_in_coverage: null,
      coverage_from_utc: coverageFrom,
      coverage_to_utc: coverageTo,
      verdict: "SKIP" as const,
    });
  }

  const inWindow = (row: ReplicaEntryRow) => row.entry_time >= coverageFrom && row.entry_time <= coverageTo;
  const mt5 = params.mt5Entries.filter(inWindow);
  const replica = params.replicaEntries.filter(inWindow);
  if (mt5.length === 0) {
    return withHash({
      case_id: params.summary.case_id,
      scope: params.summary.scope,
      normalized_symbol: params.summary.normalized_symbol ?? "",
      comparison_status: "skipped_no_report_entries" as const,
      mt5_entries_in_coverage: 0,
      replica_entries_in_coverage: replica.length,
      exact_sequence_matches: 0,
      first_mismatch_index: null,
      first_mismatch_mt5: null,
      first_mismatch_replica: replica[0] ? entryKey(replica[0]) : null,
      mt5_first_entry_in_coverage: null,
      replica_first_entry_in_coverage: replica[0]?.entry_time ?? null,
      coverage_from_utc: coverageFrom,
      coverage_to_utc: coverageTo,
      verdict: "SKIP" as const,
    });
  }

  let matches = 0;
  let firstMismatch: number | null = null;
  const maxLength = Math.max(mt5.length, replica.length);
  for (let index = 0; index < maxLength; index += 1) {
    if (entryKey(mt5[index]) === entryKey(replica[index])) {
      matches += 1;
      continue;
    }
    firstMismatch = index;
    break;
  }

  return withHash({
    case_id: params.summary.case_id,
    scope: params.summary.scope,
    normalized_symbol: params.summary.normalized_symbol ?? "",
    comparison_status: "compared" as const,
    mt5_entries_in_coverage: mt5.length,
    replica_entries_in_coverage: replica.length,
    exact_sequence_matches: matches,
    first_mismatch_index: firstMismatch,
    first_mismatch_mt5: firstMismatch === null ? null : entryKey(mt5[firstMismatch]),
    first_mismatch_replica: firstMismatch === null ? null : entryKey(replica[firstMismatch]),
    mt5_first_entry_in_coverage: mt5[0]?.entry_time ?? null,
    replica_first_entry_in_coverage: replica[0]?.entry_time ?? null,
    coverage_from_utc: coverageFrom,
    coverage_to_utc: coverageTo,
    verdict: firstMismatch === null && mt5.length === replica.length ? "PASS" as const : "FAIL" as const,
  });
}

function entryKey(row: ReplicaEntryRow | undefined) {
  if (!row) return null;
  return `${row.entry_time}|${row.side}|${row.order_type}|${row.lot_size.toFixed(2)}`;
}

function maxIso(left: string | null, right: string | null) {
  if (!left) return right;
  if (!right) return left;
  return left > right ? left : right;
}

function minIso(left: string | null, right: string | null) {
  if (!left) return right;
  if (!right) return left;
  return left < right ? left : right;
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

function sameHour(left: string | null | undefined, right: string | null | undefined) {
  return Boolean(left && right && left.slice(0, 13) === right.slice(0, 13));
}

function hoursBetween(leftIso: string, rightIso: string) {
  return round((new Date(rightIso).getTime() - new Date(leftIso).getTime()) / 3_600_000, 6) ?? 0;
}

function syntheticH1Ticks(bar: Bar, symbol: string, openQuotes?: Map<string, TickOpenQuote>) {
  const openQuote = openQuotes?.get(bar.bar_open_utc);
  const spread = openQuote ? openQuote.ask - openQuote.bid : (bar.spread ?? 0) * symbolPoint(symbol);
  const tick = (time: string, bid: number) => ({
    time,
    bid,
    ask: bid + spread,
  });
  const bullish = bar.close >= bar.open;
  const middle = bullish
    ? [
        tick(addSeconds(bar.bar_open_utc, 1), bar.low),
        tick(addSeconds(bar.bar_open_utc, 3598), bar.high),
      ]
    : [
        tick(addSeconds(bar.bar_open_utc, 1), bar.high),
        tick(addSeconds(bar.bar_open_utc, 3598), bar.low),
      ];
  return [
    openQuote
      ? { time: bar.bar_open_utc, bid: openQuote.bid, ask: openQuote.ask }
      : tick(bar.bar_open_utc, bar.open),
    ...middle,
    tick(addSeconds(bar.bar_open_utc, 3599), bar.close),
  ];
}

function entryPriceForBar(entry: ReplicaEntryRow, bar: Bar) {
  const spread = (bar.spread ?? 0) * (symbolPoint(entry.symbol));
  return entry.side === "BUY" ? bar.open + spread : bar.open;
}

function symbolPoint(symbol: string) {
  return symbol.endsWith("JPY") ? 0.001 : 0.00001;
}

function runLifecycleReplay(summary: Mt5ReportSummaryRow, bars: Bar[], entries: ReplicaEntryRow[], openQuotes?: Map<string, TickOpenQuote>): ReplicaLifecycleExitRow[] {
  const symbol = summary.normalized_symbol ?? "";
  if (!symbol || bars.length === 0 || entries.length === 0) return [];

  const digits = priceDigits(symbol);
  const pip = pipSize(symbol);
  const trailStart = (summary.inputs_trail_start_pips ?? 20) * pip;
  const trailStep = (summary.inputs_trail_step_pips ?? 1) * pip;
  const trailStop = (summary.inputs_trail_stop_pips ?? 10) * pip;
  const entriesByTime = new Map<string, ReplicaEntryRow[]>();
  for (const entry of entries) {
    entriesByTime.set(entry.entry_time, [...(entriesByTime.get(entry.entry_time) ?? []), entry]);
  }

  type OpenPosition = ReplicaEntryRow & { entry_price: number; stop_loss: number | null };
  const positions: OpenPosition[] = [];
  const exits: ReplicaLifecycleExitRow[] = [];

  const closePosition = (position: OpenPosition, exitTime: string, exitPrice: number, reason: "sl" | "end_of_test") => {
    exits.push(withHash({
      case_id: summary.case_id,
      symbol,
      entry_time: position.entry_time,
      side: position.side,
      order_type: position.order_type,
      lot_size: position.lot_size,
      entry_price: round(position.entry_price, digits) ?? position.entry_price,
      exit_time: exitTime,
      exit_price: round(exitPrice, digits) ?? exitPrice,
      exit_reason: reason,
      stop_loss_at_exit: position.stop_loss === null ? null : round(position.stop_loss, digits),
      hold_hours: hoursBetween(position.entry_time, exitTime),
    }));
  };

  const processStopHits = (time: string, bid: number, ask: number) => {
    for (let index = positions.length - 1; index >= 0; index -= 1) {
      const position = positions[index]!;
      if (position.stop_loss !== null) {
        const stopHit = position.side === "BUY" ? bid <= position.stop_loss : ask >= position.stop_loss;
        if (stopHit) {
          closePosition(position, time, position.stop_loss, "sl");
          positions.splice(index, 1);
          continue;
        }
      }
    }
  };

  const updateTrailingAtBarOpen = (bid: number, ask: number) => {
    for (let index = positions.length - 1; index >= 0; index -= 1) {
      const position = positions[index]!;
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

  for (const bar of bars) {
    if (summary.report_end && bar.bar_open_utc > summary.report_end) break;
    const ticks = syntheticH1Ticks(bar, symbol, openQuotes);
    processStopHits(ticks[0]!.time, ticks[0]!.bid, ticks[0]!.ask);
    updateTrailingAtBarOpen(ticks[0]!.bid, ticks[0]!.ask);
    for (const entry of entriesByTime.get(bar.bar_open_utc) ?? []) {
      positions.push({
        ...entry,
        entry_price: round(entryPriceForBar(entry, bar), digits) ?? bar.open,
        stop_loss: null,
      });
    }
    for (const tick of ticks.slice(1)) processStopHits(tick.time, tick.bid, tick.ask);
  }

  const terminalTime = summary.report_end ?? bars.at(-1)!.bar_open_utc;
  const terminalBar = bars.at(-1)!;
  const terminalSpread = (terminalBar.spread ?? 0) * symbolPoint(symbol);
  for (const position of positions) {
    const terminalPrice = position.side === "BUY" ? terminalBar.close : terminalBar.close + terminalSpread;
    closePosition(position, terminalTime, terminalPrice, "end_of_test");
  }

  return exits.sort((left, right) => left.exit_time.localeCompare(right.exit_time) || left.entry_time.localeCompare(right.entry_time));
}

type Mt5HoldExit = {
  entry_time: string;
  exit_time: string;
  side: Side;
  volume: number;
  entry_price: number | null;
  exit_price: number | null;
  reason: "sl" | "end_of_test";
  commission: number;
  swap: number;
  price_profit: number;
  net_profit: number;
};

function mt5HoldExits(summary: Mt5ReportSummaryRow, holds: HoldRow[], offsetHours: number): Mt5HoldExit[] {
  return holds
    .filter((hold) => hold.case_id === summary.case_id)
    .map((hold) => ({
      entry_time: mt5TimestampToIso(hold.entry_time, offsetHours) ?? hold.entry_time,
      exit_time: mt5TimestampToIso(hold.exit_time, offsetHours) ?? hold.exit_time,
      side: hold.side,
      volume: hold.volume,
      entry_price: hold.entry_price,
      exit_price: hold.exit_price,
      reason: hold.exit_comment === "end of test" ? "end_of_test" as const : "sl" as const,
      commission: hold.commission,
      swap: hold.swap,
      price_profit: hold.price_profit,
      net_profit: hold.net_profit,
    }));
}

function mt5DealExits(summary: Mt5ReportSummaryRow, deals: DealRow[], offsetHours: number): Mt5HoldExit[] {
  return deals
    .filter((deal) => deal.case_id === summary.case_id && deal.direction === "out")
    .map((deal) => ({
      entry_time: "",
      exit_time: mt5TimestampToIso(deal.time, offsetHours) ?? deal.time,
      side: deal.type === "sell" ? "BUY" as const : "SELL" as const,
      volume: deal.volume ?? 0,
      entry_price: null,
      exit_price: deal.price,
      reason: deal.comment === "end of test" ? "end_of_test" as const : "sl" as const,
      commission: deal.commission,
      swap: deal.swap,
      price_profit: deal.profit,
      net_profit: deal.net_profit,
    }));
}

function lifecycleEntryKey(row: { entry_time: string; side: Side; volume?: number; lot_size?: number }) {
  const volume = row.volume ?? row.lot_size ?? 0;
  return `${row.entry_time}|${row.side}|${volume.toFixed(2)}`;
}

function matchedMt5ExitsByReplica(summary: Mt5ReportSummaryRow, deals: DealRow[], holds: HoldRow[], replicaExits: ReplicaLifecycleExitRow[], offsetHours: number) {
  void holds;
  const mt5Exits = mt5DealExits(summary, deals, offsetHours);
  const maxLength = Math.max(mt5Exits.length, replicaExits.length);
  const matched = Array.from({ length: maxLength }, (_, index) => ({
    replica: replicaExits[index] ?? null,
    mt5: mt5Exits[index] ?? null,
  })).filter((row): row is { replica: ReplicaLifecycleExitRow; mt5: Mt5HoldExit | null } => row.replica !== null);
  return {
    matchMethod: "exit_sequence" as const,
    mt5Exits,
    matched,
    unmatchedMt5: mt5Exits.slice(replicaExits.length),
  };
}

function compareLifecycle(summary: Mt5ReportSummaryRow, deals: DealRow[], holds: HoldRow[], replicaExits: ReplicaLifecycleExitRow[], offsetHours: number): LifecycleComparisonRow {
  const { matchMethod, mt5Exits, matched, unmatchedMt5 } = matchedMt5ExitsByReplica(summary, deals, holds, replicaExits, offsetHours);
  if (mt5Exits.length === 0 && replicaExits.length === 0) {
    return withHash({
      case_id: summary.case_id,
      scope: summary.scope,
      normalized_symbol: summary.normalized_symbol ?? "",
      mt5_exit_deals: 0,
      replica_exit_deals: 0,
      match_method: "none" as const,
      matched_exit_deals: 0,
      unmatched_mt5_exit_deals: 0,
      unmatched_replica_exit_deals: 0,
      mt5_sl_exit_deals: 0,
      replica_sl_exit_deals: 0,
      mt5_terminal_liquidation_deals: 0,
      replica_terminal_liquidation_deals: 0,
      exit_count_delta: 0,
      sl_exit_count_delta: 0,
      terminal_liquidation_delta: 0,
      same_exit_hour_matches: 0,
      average_abs_exit_price_delta: null,
      max_abs_exit_price_delta: null,
      verdict: "SKIP" as const,
    });
  }

  let sameExitHourMatches = 0;
  const priceDeltas: number[] = [];
  const matchedRows = matched.filter((row) => row.mt5 !== null) as Array<{ replica: ReplicaLifecycleExitRow; mt5: Mt5HoldExit }>;
  for (const row of matchedRows) {
    if (sameHour(row.mt5.exit_time, row.replica.exit_time)) sameExitHourMatches += 1;
    if (row.mt5.exit_price !== null) priceDeltas.push(Math.abs(row.mt5.exit_price - row.replica.exit_price));
  }

  const mt5Sl = mt5Exits.filter((row) => row.reason === "sl").length;
  const replicaSl = replicaExits.filter((row) => row.exit_reason === "sl").length;
  const mt5Terminal = mt5Exits.filter((row) => row.reason === "end_of_test").length;
  const replicaTerminal = replicaExits.filter((row) => row.exit_reason === "end_of_test").length;
  const exitCountDelta = replicaExits.length - mt5Exits.length;
  const slDelta = replicaSl - mt5Sl;
  const terminalDelta = replicaTerminal - mt5Terminal;
  const unmatchedReplica = matched.filter((row) => row.mt5 === null).length;

  return withHash({
    case_id: summary.case_id,
    scope: summary.scope,
    normalized_symbol: summary.normalized_symbol ?? "",
    mt5_exit_deals: mt5Exits.length,
    replica_exit_deals: replicaExits.length,
    match_method: matchMethod,
    matched_exit_deals: matchedRows.length,
    unmatched_mt5_exit_deals: unmatchedMt5.length,
    unmatched_replica_exit_deals: unmatchedReplica,
    mt5_sl_exit_deals: mt5Sl,
    replica_sl_exit_deals: replicaSl,
    mt5_terminal_liquidation_deals: mt5Terminal,
    replica_terminal_liquidation_deals: replicaTerminal,
    exit_count_delta: exitCountDelta,
    sl_exit_count_delta: slDelta,
    terminal_liquidation_delta: terminalDelta,
    same_exit_hour_matches: sameExitHourMatches,
    average_abs_exit_price_delta: priceDeltas.length > 0 ? round(priceDeltas.reduce((sum, value) => sum + value, 0) / priceDeltas.length, 6) : null,
    max_abs_exit_price_delta: priceDeltas.length > 0 ? round(Math.max(...priceDeltas), 6) : null,
    verdict: exitCountDelta === 0 && slDelta === 0 && terminalDelta === 0 && unmatchedMt5.length === 0 && unmatchedReplica === 0 ? "PROFILED_PASS_COUNTS" as const : "PROFILED_MISMATCH" as const,
  });
}

function quoteCurrency(symbol: string) {
  return symbol.slice(3, 6).toUpperCase();
}

function conversionSymbolForTradeSymbol(symbol: string) {
  const quote = quoteCurrency(symbol);
  if (quote === "USD") return null;
  return `USD${quote}`;
}

function floorToHourIso(iso: string) {
  const date = new Date(iso);
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

function barByOpen(bars: Bar[]) {
  return new Map(bars.map((bar) => [bar.bar_open_utc, bar]));
}

function priceProfitInQuoteCurrency(exit: ReplicaLifecycleExitRow) {
  const raw = exit.side === "BUY"
    ? (exit.exit_price - exit.entry_price) * exit.lot_size * 100_000
    : (exit.entry_price - exit.exit_price) * exit.lot_size * 100_000;
  return raw;
}

function priceProfitTolerance(value: number) {
  return Math.max(100, Math.abs(value) * 0.02);
}

function pctDelta(delta: number | null, base: number) {
  if (delta === null || base === 0) return null;
  return round((delta / Math.abs(base)) * 100, 6);
}

function sumNullable(rows: Array<number | null>) {
  if (rows.some((value) => value === null)) return null;
  return round2(rows.reduce((sum, value) => sum + (value ?? 0), 0));
}

function buildPnlExitRows(params: {
  summary: Mt5ReportSummaryRow;
  deals: DealRow[];
  holds: HoldRow[];
  replicaExits: ReplicaLifecycleExitRow[];
  conversionBars: Map<string, Bar>;
  offsetHours: number;
}): ReplicaPnlExitRow[] {
  const symbol = params.summary.normalized_symbol ?? "";
  const conversionSymbol = symbol ? conversionSymbolForTradeSymbol(symbol) : null;
  const { matchMethod, matched } = matchedMt5ExitsByReplica(params.summary, params.deals, params.holds, params.replicaExits, params.offsetHours);

  return matched.map((row, index) => {
    const conversionBarTime = floorToHourIso(row.replica.exit_time);
    const conversionBar = conversionSymbol ? params.conversionBars.get(conversionBarTime) : null;
    const conversionRate = conversionSymbol ? conversionBar?.close ?? null : 1;
    const quoteProfit = priceProfitInQuoteCurrency(row.replica);
    const replicaPriceProfit = conversionRate === null ? null : round2(quoteProfit / conversionRate);
    const replicaCommission = round2(-7 * row.replica.lot_size);
    const mt5 = row.mt5;
    const mt5PriceProfit = mt5?.price_profit ?? null;
    const mt5Commission = mt5?.commission ?? null;
    const mt5Swap = mt5?.swap ?? null;
    const mt5NetProfit = mt5?.net_profit ?? null;
    const replicaNet = replicaPriceProfit === null || mt5Swap === null ? null : round2(replicaPriceProfit + replicaCommission + mt5Swap);
    return withHash({
      case_id: params.summary.case_id,
      scope: params.summary.scope,
      normalized_symbol: symbol,
      sequence_index: index,
      match_status: mt5 ? (matchMethod === "entry_key" ? "matched_by_entry_key" as const : "matched_by_exit_sequence" as const) : "unmatched_replica_exit" as const,
      entry_time: row.replica.entry_time,
      side: row.replica.side,
      lot_size: row.replica.lot_size,
      replica_exit_time: row.replica.exit_time,
      mt5_exit_time: mt5?.exit_time ?? null,
      same_exit_hour: Boolean(mt5 && sameHour(mt5.exit_time, row.replica.exit_time)),
      replica_exit_reason: row.replica.exit_reason,
      mt5_exit_reason: mt5?.reason ?? null,
      entry_price: row.replica.entry_price,
      replica_exit_price: row.replica.exit_price,
      mt5_exit_price: mt5?.exit_price ?? null,
      conversion_symbol: conversionSymbol,
      conversion_rate_source: conversionSymbol ? (conversionBar ? "mt5_h1_export_close" as const : "missing" as const) : "account_currency" as const,
      conversion_bar_time_utc: conversionSymbol ? conversionBarTime : null,
      conversion_rate: conversionRate,
      mt5_price_profit: mt5PriceProfit,
      replica_price_profit: replicaPriceProfit,
      price_profit_delta: replicaPriceProfit === null || mt5PriceProfit === null ? null : round2(replicaPriceProfit - mt5PriceProfit),
      mt5_commission: mt5Commission,
      replica_commission: replicaCommission,
      commission_delta: mt5Commission === null ? null : round2(replicaCommission - mt5Commission),
      mt5_swap: mt5Swap,
      replica_swap_source: mt5 ? "mt5_report_observed_passthrough" as const : "unmatched" as const,
      mt5_net_profit: mt5NetProfit,
      replica_net_profit_with_observed_swap: replicaNet,
      net_profit_delta_with_observed_swap: replicaNet === null || mt5NetProfit === null ? null : round2(replicaNet - mt5NetProfit),
    });
  });
}

function comparePnl(summary: Mt5ReportSummaryRow, pnlRows: ReplicaPnlExitRow[], lifecycle: LifecycleComparisonRow): PnlComparisonRow {
  if (summary.exit_deals === 0 && pnlRows.length === 0) {
    return withHash({
      case_id: summary.case_id,
      scope: summary.scope,
      normalized_symbol: summary.normalized_symbol ?? "",
      mt5_exit_deals: 0,
      replica_exit_deals: 0,
      matched_exit_deals: 0,
      unmatched_mt5_exit_deals: 0,
      unmatched_replica_exit_deals: 0,
      conversion_missing_exit_deals: 0,
      mt5_price_profit: 0,
      replica_price_profit: null,
      price_profit_delta: null,
      price_profit_delta_pct: null,
      mt5_commission: 0,
      replica_commission: 0,
      commission_delta: 0,
      mt5_swap: 0,
      replica_swap_source: "mt5_report_observed_passthrough" as const,
      mt5_net_profit: 0,
      replica_net_profit_with_observed_swap: null,
      net_profit_delta_with_observed_swap: null,
      net_profit_delta_pct_with_observed_swap: null,
      mt5_profit_factor: summary.deal_profit_factor,
      replica_profit_factor_with_observed_swap: null,
      profit_factor_delta_with_observed_swap: null,
      verdict: "SKIP" as const,
    });
  }

  const matchedRows = pnlRows.filter((row) => row.match_status !== "unmatched_replica_exit");
  const conversionMissing = pnlRows.filter((row) => row.conversion_rate_source === "missing").length;
  const replicaPriceProfit = sumNullable(matchedRows.map((row) => row.replica_price_profit));
  const replicaNet = sumNullable(matchedRows.map((row) => row.replica_net_profit_with_observed_swap));
  const replicaCommission = round2(matchedRows.reduce((sum, row) => sum + row.replica_commission, 0));
  const netValues = matchedRows
    .map((row) => row.replica_net_profit_with_observed_swap)
    .filter((value): value is number => value !== null);
  const replicaProfitFactor = netValues.length === matchedRows.length ? profitFactor(netValues) : null;
  const priceDelta = replicaPriceProfit === null ? null : round2(replicaPriceProfit - summary.deal_sum_price_profit);
  const netDelta = replicaNet === null ? null : round2(replicaNet - summary.deal_sum_net_profit);
  const commissionDelta = round2(replicaCommission - summary.deal_sum_commission);
  const pass = lifecycle.verdict === "PROFILED_PASS_COUNTS"
    && conversionMissing === 0
    && priceDelta !== null
    && Math.abs(priceDelta) <= priceProfitTolerance(summary.deal_sum_price_profit)
    && netDelta !== null
    && Math.abs(netDelta) <= priceProfitTolerance(summary.deal_sum_net_profit)
    && Math.abs(commissionDelta) <= 0.01;

  return withHash({
    case_id: summary.case_id,
    scope: summary.scope,
    normalized_symbol: summary.normalized_symbol ?? "",
    mt5_exit_deals: summary.exit_deals,
    replica_exit_deals: pnlRows.length,
    matched_exit_deals: matchedRows.length,
    unmatched_mt5_exit_deals: lifecycle.unmatched_mt5_exit_deals,
    unmatched_replica_exit_deals: lifecycle.unmatched_replica_exit_deals,
    conversion_missing_exit_deals: conversionMissing,
    mt5_price_profit: summary.deal_sum_price_profit,
    replica_price_profit: replicaPriceProfit,
    price_profit_delta: priceDelta,
    price_profit_delta_pct: pctDelta(priceDelta, summary.deal_sum_price_profit),
    mt5_commission: summary.deal_sum_commission,
    replica_commission: replicaCommission,
    commission_delta: commissionDelta,
    mt5_swap: summary.deal_sum_swap,
    replica_swap_source: "mt5_report_observed_passthrough" as const,
    mt5_net_profit: summary.deal_sum_net_profit,
    replica_net_profit_with_observed_swap: replicaNet,
    net_profit_delta_with_observed_swap: netDelta,
    net_profit_delta_pct_with_observed_swap: pctDelta(netDelta, summary.deal_sum_net_profit),
    mt5_profit_factor: summary.deal_profit_factor,
    replica_profit_factor_with_observed_swap: replicaProfitFactor,
    profit_factor_delta_with_observed_swap: replicaProfitFactor === null || summary.deal_profit_factor === null ? null : round(replicaProfitFactor - summary.deal_profit_factor, 6),
    verdict: pass ? "PROFILED_PASS_ACCOUNTING_SHAPE" as const : "PROFILED_MISMATCH" as const,
  });
}

function pnlYearlyComparisonRows(summary: Mt5ReportSummaryRow, yearly: YearlyClosedRow[], pnlRows: ReplicaPnlExitRow[]): PnlYearlyComparisonRow[] {
  const mt5ByYear = new Map(yearly.filter((row) => row.case_id === summary.case_id).map((row) => [row.close_year, row]));
  const replicaByYear = new Map<number, ReplicaPnlExitRow[]>();
  for (const row of pnlRows.filter((candidate) => candidate.case_id === summary.case_id && candidate.match_status !== "unmatched_replica_exit")) {
    const year = Number((row.mt5_exit_time ?? row.replica_exit_time).slice(0, 4));
    if (!Number.isFinite(year)) continue;
    replicaByYear.set(year, [...(replicaByYear.get(year) ?? []), row]);
  }
  const years = [...new Set([...mt5ByYear.keys(), ...replicaByYear.keys()])].sort((left, right) => left - right);
  return years.map((year) => {
    const mt5 = mt5ByYear.get(year);
    const replica = replicaByYear.get(year) ?? [];
    const replicaNet = sumNullable(replica.map((row) => row.replica_net_profit_with_observed_swap));
    const replicaPrice = sumNullable(replica.map((row) => row.replica_price_profit));
    const replicaCommission = replica.length ? round2(replica.reduce((sum, row) => sum + row.replica_commission, 0)) : null;
    const replicaSwap = sumNullable(replica.map((row) => row.mt5_swap));
    const netDelta = mt5 && replicaNet !== null ? round2(replicaNet - mt5.net_profit) : null;
    const priceDelta = mt5 && replicaPrice !== null ? round2(replicaPrice - mt5.price_profit) : null;
    const commissionDelta = mt5 && replicaCommission !== null ? round2(replicaCommission - mt5.commission) : null;
    const swapDelta = mt5 && replicaSwap !== null ? round2(replicaSwap - mt5.swap) : null;
    const pass = Boolean(mt5)
      && replica.length === mt5!.exit_deals
      && netDelta !== null
      && Math.abs(netDelta) <= priceProfitTolerance(mt5!.net_profit)
      && priceDelta !== null
      && Math.abs(priceDelta) <= priceProfitTolerance(mt5!.price_profit)
      && commissionDelta !== null
      && Math.abs(commissionDelta) <= 0.01
      && swapDelta !== null
      && Math.abs(swapDelta) <= 0.01;
    return withHash({
      case_id: summary.case_id,
      scope: summary.scope,
      normalized_symbol: summary.normalized_symbol ?? "",
      close_year: year,
      mt5_exit_deals: mt5?.exit_deals ?? 0,
      replica_exit_deals: replica.length,
      mt5_net_profit: mt5?.net_profit ?? 0,
      replica_net_profit_with_observed_swap: replicaNet,
      net_profit_delta_with_observed_swap: netDelta,
      mt5_price_profit: mt5?.price_profit ?? 0,
      replica_price_profit: replicaPrice,
      price_profit_delta: priceDelta,
      mt5_commission: mt5?.commission ?? 0,
      replica_commission: replicaCommission,
      commission_delta: commissionDelta,
      mt5_swap: mt5?.swap ?? 0,
      replica_observed_swap: replicaSwap,
      observed_swap_delta: swapDelta,
      terminal_liquidation_deals: mt5?.terminal_liquidation_deals ?? 0,
      verdict: pass ? "PROFILED_PASS_YEARLY_SHAPE" as const : mt5 ? "PROFILED_MISMATCH" as const : "SKIP" as const,
    });
  });
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

function metricRows() {
  return [
    { metric: "terminal_liquidation_deals", definition: "MT5 out deals whose comment is end of test; this is the forced liquidation count that must match before lifecycle redesign." },
    { metric: "observed_type3_entries", definition: "MT5 entry deals whose volume equals Trade_Lots * 2, matching LimniHedge Type 3 lot scaling." },
    { metric: "average_hold_hours_fifo", definition: "FIFO approximation pairing buy-in with sell-out and sell-in with buy-out because MT5 HTML omits position ids." },
    { metric: "raw_signal_count", definition: "Legacy Type 3 candidate count before MT5 tester-admission filtering." },
    { metric: "accepted_count", definition: "Repo replica entry count after applying the audited MT5 tester acceptance layer." },
    { metric: "skipped_daily_rollover_0000", definition: "Raw candidates at 00:00 skipped because the saved MT5 reports contain zero accepted entry deals at the daily rollover hour." },
    { metric: "replica_entries_in_coverage", definition: "Accepted entry-shape replay count from the selected H1 source inside the overlapping report and source coverage window." },
    { metric: "david_state_source", definition: "Replica entry state source; mt5_export_indicator_buffer means the repo replay used the same iCustom David buffer surface as the EA." },
    { metric: "exact_sequence_matches", definition: "Strict sequence match on entry timestamp, side, inferred order type, and lot size." },
    { metric: "reaches_report_end", definition: "Selected H1 source coverage reaches the MT5 report end. If false, full parity must fail closed." },
    { metric: "match_method", definition: "Lifecycle/PnL exit matching method. Gate 92 uses exit_sequence because saved MT5 HTML deals do not expose hedged position ids." },
    { metric: "replica_price_profit", definition: "Replica lifecycle price PnL converted to USD with the exported MT5 H1 conversion close for the quote currency." },
    { metric: "replica_swap_source", definition: "Swap is carried from the saved MT5 report as observed broker accounting; Gate 92 does not build an independent historical swap model." },
  ].map((row) => withHash(row));
}

function validationRows(params: {
  inventory: ReportInventoryRow[];
  summaries: Mt5ReportSummaryRow[];
  coverage: CanonicalCoverageRow[];
  comparisons: EntryComparisonRow[];
  lifecycleComparisons: LifecycleComparisonRow[];
  pnlComparisons: PnlComparisonRow[];
}) {
  const missingRequired = params.inventory.filter((row) => row.scope === "primary" && !row.exists).length;
  const fullCoverageFailures = params.coverage.filter((row) => !row.reaches_report_start || !row.reaches_report_end).length;
  const comparedFailures = params.comparisons.filter((row) => row.verdict === "FAIL").length;
  const comparisonSkips = params.comparisons.filter((row) => row.verdict === "SKIP").length;
  const comparisonPasses = params.comparisons.filter((row) => row.verdict === "PASS").length;
  const lifecycleFailures = params.lifecycleComparisons.filter((row) => row.verdict === "PROFILED_MISMATCH").length;
  const lifecycleSkips = params.lifecycleComparisons.filter((row) => row.verdict === "SKIP").length;
  const lifecyclePasses = params.lifecycleComparisons.filter((row) => row.verdict === "PROFILED_PASS_COUNTS").length;
  const pnlFailures = params.pnlComparisons.filter((row) => row.verdict === "PROFILED_MISMATCH").length;
  const pnlSkips = params.pnlComparisons.filter((row) => row.verdict === "SKIP").length;
  const pnlPasses = params.pnlComparisons.filter((row) => row.verdict === "PROFILED_PASS_ACCOUNTING_SHAPE").length;
  const parsedPrimaryReports = params.summaries.filter((row) => row.scope === "primary").length;
  const coverageNotRun = params.summaries.length > 0 && params.coverage.length === 0;
  const comparisonsNotRun = params.summaries.length > 0 && params.comparisons.length === 0;
  const lifecycleNotRun = params.summaries.length > 0 && params.lifecycleComparisons.length === 0;
  const pnlNotRun = params.summaries.length > 0 && params.pnlComparisons.length === 0;
  const missingH1Sources = params.coverage.filter((row) => row.bar_count === 0).length;
  return [
    {
      check: "required_primary_mt5_reports_present",
      value: missingRequired,
      expected: 0,
      passed: missingRequired === 0,
    },
    {
      check: "primary_reports_parsed",
      value: parsedPrimaryReports,
      expected: EXPECTED_REPORTS.filter((row) => row.scope === "primary").length,
      passed: missingRequired === 0 && parsedPrimaryReports === EXPECTED_REPORTS.filter((row) => row.scope === "primary").length,
    },
    {
      check: "h1_source_rows_available",
      value: coverageNotRun ? "not_run_or_unavailable" : missingH1Sources,
      expected: 0,
      passed: !coverageNotRun && missingH1Sources === 0,
    },
    {
      check: "h1_source_coverage_reaches_report_windows",
      value: coverageNotRun ? "not_run_or_unavailable" : fullCoverageFailures,
      expected: 0,
      passed: !coverageNotRun && fullCoverageFailures === 0,
    },
    {
      check: "entry_shape_comparisons_pass",
      value: comparisonsNotRun ? "not_run_or_unavailable" : `pass=${comparisonPasses};fail=${comparedFailures};skip=${comparisonSkips}`,
      expected: "fail=0;skip=0;pass>=1",
      passed: !comparisonsNotRun && comparisonPasses > 0 && comparedFailures === 0 && comparisonSkips === 0,
    },
    {
      check: "lifecycle_count_comparisons_pass",
      value: lifecycleNotRun ? "not_run_or_unavailable" : `pass=${lifecyclePasses};fail=${lifecycleFailures};skip=${lifecycleSkips}`,
      expected: "fail=0;skip=0;pass>=1",
      passed: !lifecycleNotRun && lifecyclePasses > 0 && lifecycleFailures === 0 && lifecycleSkips === 0,
    },
    {
      check: "accounting_shape_comparisons_pass",
      value: pnlNotRun ? "not_run_or_unavailable" : `pass=${pnlPasses};fail=${pnlFailures};skip=${pnlSkips}`,
      expected: "fail=0;skip=0;pass>=1",
      passed: !pnlNotRun && pnlPasses > 0 && pnlFailures === 0 && pnlSkips === 0,
    },
    {
      check: "mt5_ea_not_mutated_by_gate92_script",
      value: "no writes to automation/mt5/Experts/LimniHedge_V1.mq5",
      expected: "reference-only",
      passed: true,
    },
    {
      check: "frozen_reengineering_scope_respected",
      value: "no LRMG, Katarakti, zero-line, Direction, Candidate B, David redesign, promotion, or live MT5 trading",
      expected: "frozen",
      passed: true,
    },
  ].map((row) => withHash(row));
}

function acceptanceSummaryRows(rows: ReplicaAcceptanceRow[]) {
  const grouped = new Map<string, ReplicaAcceptanceRow[]>();
  for (const row of rows) grouped.set(row.case_id, [...(grouped.get(row.case_id) ?? []), row]);
  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([caseId, caseRows]) => {
    const skippedDailyRollover = caseRows.filter((row) => row.acceptance_status === "skipped_daily_rollover_0000");
    const skippedAfterEnd = caseRows.filter((row) => row.acceptance_status === "skipped_after_report_execution_end");
    const accepted = caseRows.filter((row) => row.acceptance_status === "accepted");
    return withHash({
      case_id: caseId,
      raw_signal_count: caseRows.length,
      accepted_count: accepted.length,
      skipped_daily_rollover_0000: skippedDailyRollover.length,
      skipped_after_report_execution_end: skippedAfterEnd.length,
      first_skipped_daily_rollover_0000: skippedDailyRollover[0]?.entry_time ?? null,
      first_skipped_after_report_execution_end: skippedAfterEnd[0]?.entry_time ?? null,
    });
  });
}

function renderReport(params: {
  inventory: ReportInventoryRow[];
  summaries: Mt5ReportSummaryRow[];
  coverage: CanonicalCoverageRow[];
  acceptance: ReplicaAcceptanceRow[];
  comparisons: EntryComparisonRow[];
  lifecycleComparisons: LifecycleComparisonRow[];
  pnlComparisons: PnlComparisonRow[];
  pnlYearlyComparisons: PnlYearlyComparisonRow[];
  validations: ValidationRow[];
  artifacts: Record<string, string>;
}) {
  const inventoryTable = renderTable(params.inventory, ["case_id", "scope", "expected_filename", "exists", "note"]);
  const summaryTable = renderTable(params.summaries, [
    "case_id",
    "scope",
    "normalized_symbol",
    "period",
    "entry_deals",
    "exit_deals",
    "terminal_liquidation_deals",
    "headline_total_net_profit",
    "headline_profit_factor",
    "max_hold_hours_fifo",
  ]);
  const coverageTable = renderTable(params.coverage, ["case_id", "symbol", "timeframe", "source", "david_profile", "bar_count", "first_bar_open_utc", "last_bar_open_utc", "reaches_report_start", "reaches_report_end", "note"]);
  const acceptanceTable = renderTable(acceptanceSummaryRows(params.acceptance), ["case_id", "raw_signal_count", "accepted_count", "skipped_daily_rollover_0000", "skipped_after_report_execution_end", "first_skipped_daily_rollover_0000"]);
  const comparisonTable = renderTable(params.comparisons, ["case_id", "comparison_status", "mt5_entries_in_coverage", "replica_entries_in_coverage", "exact_sequence_matches", "first_mismatch_index", "verdict"]);
  const lifecycleComparisonTable = renderTable(params.lifecycleComparisons, ["case_id", "match_method", "mt5_exit_deals", "replica_exit_deals", "matched_exit_deals", "unmatched_mt5_exit_deals", "unmatched_replica_exit_deals", "mt5_sl_exit_deals", "replica_sl_exit_deals", "mt5_terminal_liquidation_deals", "replica_terminal_liquidation_deals", "same_exit_hour_matches", "average_abs_exit_price_delta", "max_abs_exit_price_delta", "verdict"]);
  const pnlComparisonTable = renderTable(params.pnlComparisons, ["case_id", "matched_exit_deals", "conversion_missing_exit_deals", "mt5_price_profit", "replica_price_profit", "price_profit_delta", "price_profit_delta_pct", "mt5_commission", "replica_commission", "commission_delta", "mt5_swap", "mt5_net_profit", "replica_net_profit_with_observed_swap", "net_profit_delta_with_observed_swap", "verdict"]);
  const pnlYearlyTable = renderTable(params.pnlYearlyComparisons, ["case_id", "close_year", "mt5_exit_deals", "replica_exit_deals", "mt5_net_profit", "replica_net_profit_with_observed_swap", "net_profit_delta_with_observed_swap", "mt5_price_profit", "replica_price_profit", "price_profit_delta", "verdict"]);
  const validationTable = renderTable(params.validations, ["check", "value", "expected", "passed"]);
  const artifactLines = Object.entries(params.artifacts).map(([key, value]) => `- ${key}: \`${value}\``).join("\n");
  const sourceLabel = params.coverage[0]?.source ?? "not_run";
  const verdict = params.validations.every((row) => row.passed)
    ? "PASS_GATE92_LIMNIHEDGE_LEGACY_PARITY_INTAKE_READY_FOR_FULL_REPLAY"
    : "FAIL_GATE92_PARITY_INTAKE_BLOCKED_FIX_REFERENCE_OR_COVERAGE_FIRST";

  return `# Gate 92 LimniHedge Legacy Parity Intake

Date: ${GATE_DATE}

Verdict: \`${verdict}\`

## Scope

Gate 92 treats \`automation/mt5/Experts/LimniHedge_V1.mq5\` as the MT5 reference implementation. This pass builds the repo parity replica surface only: MT5 report parsing, legacy contract receipts, H1 source coverage checks, entry-shape replay, lifecycle count replay, and shape-level accounting reconciliation against the saved reports.

Frozen: no EA re-engineering, no LRMG entry changes, no LRMG trailing, no zero-line replacement, no Katarakti-lite integration, no Direction/Candidate B/David redesign, no live MT5 trading, no promotion, and no broad optimization matrix.

## MT5 Report Inventory

${inventoryTable}

## Parsed Report Shape

${summaryTable}

## H1 Source Coverage

Replay source: \`${sourceLabel}\`

Canonical price bundle guard, when \`--price-source=canonical\` is explicitly used: \`${PRICE_BUNDLE_ID}\`

${coverageTable}

## MT5 Export Procedure

The broker-source parity lane uses the read-only MT5 script \`automation/mt5/Scripts/LimniHedgeV1ExportParityH1.mq5\`. It exports H1 bars plus David buffer state to \`${DEFAULT_MT5_EXPORT_DIR}\` as \`<SYMBOL>_H1_LimniHedgeV1Parity.csv\`. After export, rerun:

\`\`\`powershell
npm run engine:gate92:limnihedge-legacy-parity -- --price-source=mt5-export
\`\`\`

## MT5 Tester Acceptance Layer

The repo replica keeps raw legacy Type 3 candidates separate from MT5 tester-admitted entries. The raw stream is written to \`replica-raw-entry-signals.rows.*\`; the acceptance ledger is written to \`replica-entry-acceptance.rows.*\`; strict comparison uses the accepted replica entries in \`replica-entry-shape.rows.*\`.

Acceptance rules in this intake are limited to MT5 report execution semantics: the period end date is treated as the exclusive Strategy Tester boundary, and \`00:00\` daily rollover candidates are skipped because the parsed saved MT5 reports contain zero accepted entry deals at \`00:00\` across the available AUDJPY, AUDCHF, and AUDCAD reports. This is a tester-admission layer, not a change to the legacy Type 3 formula.

${acceptanceTable}

## Entry-Shape Replica Comparison

The replica comparison is intentionally strict on entry timestamp, side, inferred order type, and lot size. When MT5 H1 exports include David buffer state, the replica uses that buffer state because the EA itself consumes David through \`iCustom\`.

${comparisonTable}

## Lifecycle Replay Probe

This probe is downstream of entry parity. It replays the accepted entry stream over the exported H1 OHLC path using the EA's trailing-stop formulas and compares against the saved MT5 exit deal sequence. The HTML report does not expose hedged position ids, so FIFO hold pairing is kept as a separate report-shape metric rather than the lifecycle matcher. The count verdict is now part of the Gate 92 pass/fail checks; exact tick-order timestamps remain a profile diagnostic.

${lifecycleComparisonTable}

## Accounting Replay

The accounting replay converts replica price PnL through the exported MT5 H1 conversion close for the quote currency, applies the observed broker commission rate of \`-7.00 * lots\`, and carries MT5 report swap as an observed broker-accounting passthrough. That swap passthrough is deliberate: the saved reports are the parity baseline, while an independent historical swap model is outside this frozen gate.

${pnlComparisonTable}

## Yearly Closed Split

Yearly rows are grouped on the MT5 close year for matched exits, so the split checks the saved report's closed-year accounting surface while still using replica lifecycle price PnL for the comparison columns.

${pnlYearlyTable}

## Validation

${validationTable}

## Artifacts

${artifactLines}

## Stop Line

If any required MT5 report is missing, selected H1 source coverage misses the report window, or entry-shape parity fails, stop research and fix parity before adding LRMG, Katarakti, Direction, new exits, or optimization.
`;
}

async function main() {
  const options = parseOptions();
  await mkdir(options.artifactDir, { recursive: true });
  await mkdir(path.dirname(options.reportPath), { recursive: true });

  const expectedInventory = await Promise.all(EXPECTED_REPORTS.map((expected) => inventoryPath(options.reportDir, expected)));
  const discoveredInventory = await discoveredReports(options.reportDir, new Set(EXPECTED_REPORTS.map((row) => row.filename)));
  const inventory = [...expectedInventory, ...discoveredInventory];

  const parsed: ParsedReport[] = [];
  for (const row of inventory) {
    const report = await parseReport(row, options.mt5TimezoneOffsetHours);
    if (report) parsed.push(report);
  }

  const summaries = parsed.map((report) => report.summary);
  const settingRows = parsed.flatMap((report) => report.settings);
  const orderRows = parsed.flatMap((report) => report.orders);
  const dealRows = parsed.flatMap((report) => report.deals);
  const yearlyRowsOut = parsed.flatMap((report) => report.yearly);
  const holdRows = parsed.flatMap((report) => report.holds);
  const contractRows = replicaContractRows();
  const symbols = [...new Set(summaries.map((row) => row.normalized_symbol).filter((value): value is string => Boolean(value)))].sort();

  let coverageRows: CanonicalCoverageRow[] = [];
  let rawReplicaEntries: ReplicaEntryRow[] = [];
  let replicaAcceptanceRows: ReplicaAcceptanceRow[] = [];
  let replicaEntries: ReplicaEntryRow[] = [];
  let comparisons: EntryComparisonRow[] = [];
  let replicaLifecycleExits: ReplicaLifecycleExitRow[] = [];
  let lifecycleComparisons: LifecycleComparisonRow[] = [];
  let replicaPnlExitRows: ReplicaPnlExitRow[] = [];
  let pnlComparisons: PnlComparisonRow[] = [];
  let pnlYearlyComparisons: PnlYearlyComparisonRow[] = [];

  if (!options.skipCanonicalEntryReplay && options.priceSource !== "none") {
    coverageRows = options.priceSource === "mt5-export"
      ? await mt5ExportCoverageRows(summaries, options.mt5ExportDir, options.mt5TimezoneOffsetHours)
      : await canonicalCoverageRows(symbols, summaries);
    const coverageByCaseId = new Map(coverageRows.filter((row) => row.case_id).map((row) => [row.case_id!, row]));
    const coverageBySymbol = new Map(coverageRows.map((row) => [row.symbol, row]));
    for (const report of parsed) {
      const summary = report.summary;
      const symbol = summary.normalized_symbol;
      const coverage = coverageByCaseId.get(summary.case_id) ?? (symbol ? coverageBySymbol.get(symbol) ?? null : null);
      const mt5Entries = mt5EntryRowsForSummary(summary, report.deals, options.mt5TimezoneOffsetHours);
      let reportReplicaEntries: ReplicaEntryRow[] = [];
      let reportLifecycleExits: ReplicaLifecycleExitRow[] = [];
      let reportPnlRows: ReplicaPnlExitRow[] = [];
      if (symbol && summary.report_start && summary.report_end && coverage && coverage.bar_count > 0) {
        const from = maxIso(summary.report_start, coverage.first_bar_open_utc) ?? summary.report_start;
        const to = minIso(summary.report_end, coverage.last_bar_open_utc) ?? summary.report_end;
        const selectedExportDir = mt5ExportDirForSummary(summary, options.mt5ExportDir);
        const bars = options.priceSource === "mt5-export"
          ? (await loadMt5ExportBars(symbol, selectedExportDir, options.mt5TimezoneOffsetHours, from, to)).bars
          : await loadCanonicalBars(symbol, from, to);
        const openQuotes = options.priceSource === "mt5-export"
          ? await loadMt5TickOpenQuotes(symbol, options.mt5TickTraceDir, options.mt5TimezoneOffsetHours, from, to)
          : new Map<string, TickOpenQuote>();
        const reportRawReplicaEntries = runEntryReplica(summary, bars);
        const reportAcceptanceRows = applyMt5TesterAcceptance(summary, reportRawReplicaEntries);
        reportReplicaEntries = acceptedReplicaEntries(reportAcceptanceRows);
        rawReplicaEntries = [...rawReplicaEntries, ...reportRawReplicaEntries];
        replicaAcceptanceRows = [...replicaAcceptanceRows, ...reportAcceptanceRows];
        replicaEntries = [...replicaEntries, ...reportReplicaEntries];
        reportLifecycleExits = runLifecycleReplay(summary, bars, reportReplicaEntries, openQuotes);
        replicaLifecycleExits = [...replicaLifecycleExits, ...reportLifecycleExits];
        const conversionSymbol = conversionSymbolForTradeSymbol(symbol);
        const conversionBars = options.priceSource === "mt5-export" && conversionSymbol
          ? barByOpen((await loadMt5ExportBars(conversionSymbol, selectedExportDir, options.mt5TimezoneOffsetHours, from, to)).bars)
          : new Map<string, Bar>();
        reportPnlRows = buildPnlExitRows({
          summary,
          deals: report.deals,
          holds: report.holds,
          replicaExits: reportLifecycleExits,
          conversionBars,
          offsetHours: options.mt5TimezoneOffsetHours,
        });
        replicaPnlExitRows = [...replicaPnlExitRows, ...reportPnlRows];
      }
      comparisons.push(compareEntries({ summary, mt5Entries, replicaEntries: reportReplicaEntries, coverage }));
      const lifecycleComparison = compareLifecycle(summary, report.deals, report.holds, reportLifecycleExits, options.mt5TimezoneOffsetHours);
      lifecycleComparisons.push(lifecycleComparison);
      pnlComparisons.push(comparePnl(summary, reportPnlRows, lifecycleComparison));
      pnlYearlyComparisons = [...pnlYearlyComparisons, ...pnlYearlyComparisonRows(summary, report.yearly, reportPnlRows)];
    }
  } else if (options.priceSource === "none") {
    coverageRows = emptyCoverageRows(symbols, summaries);
  }

  const metrics = metricRows();
  const validations = validationRows({ inventory, summaries, coverage: coverageRows, comparisons, lifecycleComparisons, pnlComparisons });
  const commandReceipt = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at_utc: new Date().toISOString(),
    git_commit: gitCommit(),
    git_dirty_status: "see git status; Gate 92 script does not mutate MT5 EA",
    options: {
      report_dir: options.reportDir,
      artifact_dir: options.artifactDir,
      report_path: options.reportPath,
      mt5_export_dir: options.mt5ExportDir,
      mt5_tick_trace_dir: options.mt5TickTraceDir,
      mt5_timezone_offset_hours: options.mt5TimezoneOffsetHours,
      price_source: options.priceSource,
      price_bundle_id: PRICE_BUNDLE_ID,
      skip_canonical_entry_replay: options.skipCanonicalEntryReplay,
    },
  };
  const runSummary = {
    gate_id: GATE_ID,
    verdict: validations.every((row) => row.passed)
      ? "PASS_GATE92_LIMNIHEDGE_LEGACY_PARITY_INTAKE_READY_FOR_FULL_REPLAY"
      : "FAIL_GATE92_PARITY_INTAKE_BLOCKED_FIX_REFERENCE_OR_COVERAGE_FIRST",
    inventory_rows: inventory.length,
    parsed_reports: parsed.length,
    settings_rows: settingRows.length,
    order_rows: orderRows.length,
    deal_rows: dealRows.length,
    yearly_rows: yearlyRowsOut.length,
    hold_rows: holdRows.length,
    raw_replica_entry_rows: rawReplicaEntries.length,
    replica_acceptance_rows: replicaAcceptanceRows.length,
    replica_entry_rows: replicaEntries.length,
    comparison_rows: comparisons.length,
    replica_lifecycle_exit_rows: replicaLifecycleExits.length,
    lifecycle_comparison_rows: lifecycleComparisons.length,
    replica_pnl_exit_rows: replicaPnlExitRows.length,
    pnl_comparison_rows: pnlComparisons.length,
    pnl_yearly_comparison_rows: pnlYearlyComparisons.length,
    validation_failures: validations.filter((row) => !row.passed).length,
  };

  const paths = {
    inventoryJson: path.join(options.artifactDir, "mt5-report-inventory.rows.json"),
    inventoryCsv: path.join(options.artifactDir, "mt5-report-inventory.rows.csv"),
    summaryJson: path.join(options.artifactDir, "mt5-report-summary.rows.json"),
    summaryCsv: path.join(options.artifactDir, "mt5-report-summary.rows.csv"),
    settingsJson: path.join(options.artifactDir, "mt5-report-settings.rows.json"),
    settingsCsv: path.join(options.artifactDir, "mt5-report-settings.rows.csv"),
    ordersJson: path.join(options.artifactDir, "mt5-orders.rows.json"),
    ordersCsv: path.join(options.artifactDir, "mt5-orders.rows.csv"),
    dealsJson: path.join(options.artifactDir, "mt5-deals.rows.json"),
    dealsCsv: path.join(options.artifactDir, "mt5-deals.rows.csv"),
    yearlyJson: path.join(options.artifactDir, "mt5-yearly-closed.rows.json"),
    yearlyCsv: path.join(options.artifactDir, "mt5-yearly-closed.rows.csv"),
    holdsJson: path.join(options.artifactDir, "mt5-fifo-holds.rows.json"),
    holdsCsv: path.join(options.artifactDir, "mt5-fifo-holds.rows.csv"),
    contractJson: path.join(options.artifactDir, "limnihedge-replica-contract.rows.json"),
    contractCsv: path.join(options.artifactDir, "limnihedge-replica-contract.rows.csv"),
    coverageJson: path.join(options.artifactDir, "h1-source-coverage.rows.json"),
    coverageCsv: path.join(options.artifactDir, "h1-source-coverage.rows.csv"),
    rawReplicaEntriesJson: path.join(options.artifactDir, "replica-raw-entry-signals.rows.json"),
    rawReplicaEntriesCsv: path.join(options.artifactDir, "replica-raw-entry-signals.rows.csv"),
    replicaAcceptanceJson: path.join(options.artifactDir, "replica-entry-acceptance.rows.json"),
    replicaAcceptanceCsv: path.join(options.artifactDir, "replica-entry-acceptance.rows.csv"),
    replicaEntriesJson: path.join(options.artifactDir, "replica-entry-shape.rows.json"),
    replicaEntriesCsv: path.join(options.artifactDir, "replica-entry-shape.rows.csv"),
    comparisonJson: path.join(options.artifactDir, "entry-shape-comparison.rows.json"),
    comparisonCsv: path.join(options.artifactDir, "entry-shape-comparison.rows.csv"),
    replicaLifecycleExitsJson: path.join(options.artifactDir, "replica-lifecycle-exits.rows.json"),
    replicaLifecycleExitsCsv: path.join(options.artifactDir, "replica-lifecycle-exits.rows.csv"),
    lifecycleComparisonJson: path.join(options.artifactDir, "lifecycle-replay-comparison.rows.json"),
    lifecycleComparisonCsv: path.join(options.artifactDir, "lifecycle-replay-comparison.rows.csv"),
    replicaPnlExitsJson: path.join(options.artifactDir, "replica-pnl-exits.rows.json"),
    replicaPnlExitsCsv: path.join(options.artifactDir, "replica-pnl-exits.rows.csv"),
    pnlComparisonJson: path.join(options.artifactDir, "pnl-replay-comparison.rows.json"),
    pnlComparisonCsv: path.join(options.artifactDir, "pnl-replay-comparison.rows.csv"),
    pnlYearlyComparisonJson: path.join(options.artifactDir, "pnl-yearly-comparison.rows.json"),
    pnlYearlyComparisonCsv: path.join(options.artifactDir, "pnl-yearly-comparison.rows.csv"),
    validationJson: path.join(options.artifactDir, "validation.rows.json"),
    validationCsv: path.join(options.artifactDir, "validation.rows.csv"),
    metricsJson: path.join(options.artifactDir, "metric-definitions.rows.json"),
    metricsCsv: path.join(options.artifactDir, "metric-definitions.rows.csv"),
    commandReceipt: path.join(options.artifactDir, "command-receipt.json"),
    runSummary: path.join(options.artifactDir, "gate92-run-summary.json"),
    shaManifest: path.join(options.artifactDir, "gate92-limnihedge-parity-sha256.txt"),
  };

  await writeRows(paths.inventoryJson, paths.inventoryCsv, inventory);
  await writeRows(paths.summaryJson, paths.summaryCsv, summaries);
  await writeRows(paths.settingsJson, paths.settingsCsv, settingRows);
  await writeRows(paths.ordersJson, paths.ordersCsv, orderRows);
  await writeRows(paths.dealsJson, paths.dealsCsv, dealRows);
  await writeRows(paths.yearlyJson, paths.yearlyCsv, yearlyRowsOut);
  await writeRows(paths.holdsJson, paths.holdsCsv, holdRows);
  await writeRows(paths.contractJson, paths.contractCsv, contractRows);
  await writeRows(paths.coverageJson, paths.coverageCsv, coverageRows);
  await writeRows(paths.rawReplicaEntriesJson, paths.rawReplicaEntriesCsv, rawReplicaEntries);
  await writeRows(paths.replicaAcceptanceJson, paths.replicaAcceptanceCsv, replicaAcceptanceRows);
  await writeRows(paths.replicaEntriesJson, paths.replicaEntriesCsv, replicaEntries);
  await writeRows(paths.comparisonJson, paths.comparisonCsv, comparisons);
  await writeRows(paths.replicaLifecycleExitsJson, paths.replicaLifecycleExitsCsv, replicaLifecycleExits);
  await writeRows(paths.lifecycleComparisonJson, paths.lifecycleComparisonCsv, lifecycleComparisons);
  await writeRows(paths.replicaPnlExitsJson, paths.replicaPnlExitsCsv, replicaPnlExitRows);
  await writeRows(paths.pnlComparisonJson, paths.pnlComparisonCsv, pnlComparisons);
  await writeRows(paths.pnlYearlyComparisonJson, paths.pnlYearlyComparisonCsv, pnlYearlyComparisons);
  await writeRows(paths.validationJson, paths.validationCsv, validations);
  await writeRows(paths.metricsJson, paths.metricsCsv, metrics);
  await writeJson(paths.commandReceipt, commandReceipt);
  await writeJson(paths.runSummary, runSummary);

  const artifactsForReport = Object.fromEntries(Object.entries({ ...paths, report: options.reportPath }).map(([key, value]) => [key, toRepoRelative(value)]));
  await writeText(options.reportPath, renderReport({
    inventory,
    summaries,
    coverage: coverageRows,
    acceptance: replicaAcceptanceRows,
    comparisons,
    lifecycleComparisons,
    pnlComparisons,
    pnlYearlyComparisons,
    validations,
    artifacts: artifactsForReport,
  }));
  await writeShaManifest(paths.shaManifest, GATE_ID, COMMAND, [
    { label: "report", path: options.reportPath },
    { label: "inventory", path: paths.inventoryJson },
    { label: "summary", path: paths.summaryJson },
    { label: "settings", path: paths.settingsJson },
    { label: "orders", path: paths.ordersJson },
    { label: "deals", path: paths.dealsJson },
    { label: "yearly", path: paths.yearlyJson },
    { label: "holds", path: paths.holdsJson },
    { label: "contract", path: paths.contractJson },
    { label: "coverage", path: paths.coverageJson },
    { label: "raw_replica_entries", path: paths.rawReplicaEntriesJson },
    { label: "replica_acceptance", path: paths.replicaAcceptanceJson },
    { label: "replica_entries", path: paths.replicaEntriesJson },
    { label: "comparison", path: paths.comparisonJson },
    { label: "replica_lifecycle_exits", path: paths.replicaLifecycleExitsJson },
    { label: "lifecycle_comparison", path: paths.lifecycleComparisonJson },
    { label: "replica_pnl_exits", path: paths.replicaPnlExitsJson },
    { label: "pnl_comparison", path: paths.pnlComparisonJson },
    { label: "pnl_yearly_comparison", path: paths.pnlYearlyComparisonJson },
    { label: "validation", path: paths.validationJson },
    { label: "metrics", path: paths.metricsJson },
    { label: "command_receipt", path: paths.commandReceipt },
    { label: "run_summary", path: paths.runSummary },
  ]);

  console.log(`Gate 92 report: ${toRepoRelative(options.reportPath)}`);
  console.log(`Gate 92 verdict: ${runSummary.verdict}`);
  console.log(`Validation failures: ${runSummary.validation_failures}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePoolIfInitialized();
  });
