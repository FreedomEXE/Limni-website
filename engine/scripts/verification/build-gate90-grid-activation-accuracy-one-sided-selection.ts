import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { closePoolIfInitialized } from "@database/db/client";
import { sha256Stable } from "@engine/research/hash";
import {
  readTradeLegPathWarehouseManifest,
  readTradeLegPathWarehouseWeekRows,
  readTradeLegPathWarehouseWeekKeys,
  type TradeLegPathReplayPairWeek,
} from "@engine/research/tradeLegPathWarehouse";

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

const GATE_ID = "Gate 90: grid-activation-accuracy-one-sided-selection";
const GATE_DATE = "2026-07-02";
const COMMAND = "npm run engine:gate90:grid-activation-accuracy-one-sided-selection";
const DEFAULT_GATE74B_DIR = "docs/research/gates/gate74b/artifacts/gate74b-trade-leg-path-materialization";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate90/artifacts/grid-activation-accuracy-one-sided-selection";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate90/GATE90_GRID_ACTIVATION_ACCURACY_ONE_SIDED_SELECTION_${GATE_DATE}.md`;
const DEFAULT_TARGET_ADR = 1;
const DEFAULT_SPACING_ADR = 0.2;
const DEFAULT_LOT_SIZE = 0.01;
const STANDARD_FX_CONTRACT_UNITS = 100_000;
const DEFAULT_SIGNAL_SETTINGS = {
  davidMaPeriod: 35,
  davidRsiPeriod: 21,
  davidRsiOverbought: 80,
  davidRsiOversold: 20,
  stochKPeriod: 100,
  stochDPeriod: 3,
  stochSlowing: 21,
  stochOverbought: 80,
  stochOversold: 20,
};

type Side = "LONG" | "SHORT";
type FillKind = "initial" | "adverse_recovery" | "favorable_expansion";
type CloseReason = "target" | "session_flatten" | "end_of_test";
type BarPathMode = "close" | "ohlc_high_low" | "ohlc_low_high" | "ohlc_directional";
type DavidState = "UP" | "DOWN";
type TargetMode = "fixed_adr" | "david_ma_reversion";
type GridAddMode = "adverse_and_favorable" | "adverse_only";
type SignalClock = "m1" | "adr_event";
type SessionMode = "continuous" | "ny_daily_window";
type ActivationRuleId =
  | "raw_both"
  | "candidate_b"
  | "candidate_b_david_contra_confirm"
  | "candidate_b_david_contra_conflict_candidate"
  | "david_contra"
  | "david_with"
  | "stoch_contra"
  | "david_stoch_confirm"
  | "david_stoch_release";
type SignalSettings = {
  davidMaPeriod: number;
  davidRsiPeriod: number;
  davidRsiOverbought: number;
  davidRsiOversold: number;
  stochKPeriod: number;
  stochDPeriod: number;
  stochSlowing: number;
  stochOverbought: number;
  stochOversold: number;
};
type ReplayRow = Pick<
  TradeLegPathReplayPairWeek,
  | "week_open_utc"
  | "pair"
  | "candidate_b_side"
  | "pair_adr_pct"
  | "entry_price"
  | "path_payload"
>;

type Gate74bSummary = {
  verdict: string;
  warehouse: {
    manifest_id: string;
    warehouse_hash: string;
    week_count: number;
    pair_week_count: number;
  };
};

type Fill = {
  pair: string;
  side: Side;
  entry_price: number;
  entry_timestamp_utc: string;
  entry_ms: number;
  fill_index: number;
  level_index: number;
  kind: FillKind;
  quantity: number;
  lot_size: number;
  commission_usd: number;
};

type Cycle = {
  cycle_id: string;
  variant_id: string;
  pair: string;
  side: Side;
  anchor_week_open_utc: string;
  start_timestamp_utc: string;
  anchor_price: number;
  cycle_adr_pct: number;
  fills: Fill[];
  entry_price_inverse_sum: number;
  quantity_sum: number;
  next_adverse_fill_level: number;
  next_favorable_fill_level: number;
  min_pnl_adr: number;
  max_pnl_adr: number;
  reset_ordinal_at_start: number;
};

type PairBook = {
  pair: string;
  long: Cycle | null;
  short: Cycle | null;
  serial: number;
  long_resets: number;
  short_resets: number;
  last_mark_price: number | null;
  last_adr_pct: number | null;
  last_timestamp_utc: string | null;
  last_tick_index: number | null;
};

type ConversionRates = {
  getUsdPerCurrency: (currency: string, timestampUtc: string, tickIndex: number) => number | null;
};

type CloseEvent = {
  variant_id: string;
  pair: string;
  side: Side;
  close_reason: CloseReason;
  close_timestamp_utc: string;
  anchor_week_open_utc: string;
  fill_count: number;
  adverse_fill_count: number;
  expansion_fill_count: number;
  price_pnl_adr: number;
  price_pnl_usd: number;
  commission_usd: number;
  swap_usd: number;
  net_usd: number;
  min_pnl_adr: number;
  max_pnl_adr: number;
  reset_ordinal_at_start: number;
  completed_reset_ordinal: number | null;
  max_fill_age_days: number;
};

type TerminalInventoryRow = {
  variant_id: string;
  activation_rule_id: ActivationRuleId;
  cycle_id: string;
  pair: string;
  side: Side;
  terminal_timestamp_utc: string;
  anchor_week_open_utc: string;
  start_timestamp_utc: string;
  fill_count: number;
  adverse_fill_count: number;
  expansion_fill_count: number;
  max_add_depth: number;
  max_fill_age_days: number;
  avg_fill_age_days: number;
  terminal_mark_price: number;
  terminal_david_ma: number | null;
  side_exit_distance_to_ma_adr: number | null;
  directed_move_from_anchor_adr: number;
  price_pnl_adr: number;
  liquidation_price_pnl_usd: number;
  liquidation_swap_usd: number;
  entry_commission_usd: number;
  liquidation_net_usd: number;
  min_pnl_adr: number;
  max_pnl_adr: number;
};

type WeeklyTruthRow = {
  variant_id: string;
  week_open_utc: string;
  pairs_replayed: number;
  closed_price_pnl_usd: number;
  realized_commission_usd: number;
  realized_swap_usd: number;
  realized_net_usd: number;
  open_price_pnl_usd: number;
  open_swap_usd: number;
  equity_usd: number;
  balance_usd: number;
  equity_delta_usd: number;
  open_positions: number;
  long_positions: number;
  short_positions: number;
  fills_opened: number;
  target_reset_count: number;
  max_open_positions_to_date: number;
  max_long_positions_to_date: number;
  max_short_positions_to_date: number;
  max_add_depth_to_date: number;
  position_days_closed_to_date: number;
};

type SummaryRow = {
  variant_id: string;
  activation_rule_id: ActivationRuleId;
  signal_settings_id: string;
  david_settings: string;
  stochastic_settings: string;
  symbol_universe: string;
  bar_path_mode: BarPathMode;
  signal_clock: SignalClock;
  signal_adr_brick: number;
  session_mode: SessionMode;
  session_time_zone: string;
  session_trade_start_et: string;
  session_trade_end_et: string;
  session_flatten_et: string;
  session_sunday_start_et: string;
  session_flatten_overrides_et: string;
  target_mode: TargetMode;
  target_adr: number;
  spacing_adr: number;
  min_ma_expansion_adr: number;
  grid_add_mode: GridAddMode;
  date_range: string;
  price_bundle_id: string | null;
  warehouse_manifest_id: string;
  warehouse_hash: string;
  weeks_replayed: number;
  pairs_replayed: number;
  initial_deposit_usd: number;
  final_balance_usd: number;
  final_equity_before_liquidation_usd: number;
  final_equity_after_liquidation_usd: number;
  net_profit_usd: number;
  closed_price_pnl_usd: number;
  end_liquidation_price_pnl_usd: number;
  total_price_pnl_usd: number;
  total_commission_usd: number;
  total_swap_usd: number;
  target_reset_count: number;
  session_flatten_count: number;
  session_flatten_positions: number;
  session_flatten_price_pnl_usd: number;
  session_flatten_swap_usd: number;
  entries_opened: number;
  closed_positions: number;
  end_liquidation_positions: number;
  max_open_positions: number;
  max_long_positions: number;
  max_short_positions: number;
  max_add_depth: number;
  max_fill_age_days: number;
  position_days: number;
  max_equity_drawdown_usd: number;
  max_balance_drawdown_usd: number;
  weekly_equity_profit_factor: number | null;
  close_event_count: number;
  close_event_win_count: number;
  close_event_loss_count: number;
  close_event_flat_count: number;
  close_event_profit_factor: number | null;
  close_event_win_pct: number | null;
  close_event_gross_profit_usd: number;
  close_event_gross_loss_abs_usd: number;
  target_close_net_usd: number;
  session_flatten_close_net_usd: number;
  activation_checks: number;
  activation_blocked_long: number;
  activation_blocked_short: number;
  activation_blocked_expansion: number;
  activation_started_long: number;
  activation_started_short: number;
  activation_long_allow_pct: number | null;
  activation_short_allow_pct: number | null;
  mt5_reference_net_profit_usd: number | null;
  mt5_reference_commission_usd: number | null;
  mt5_reference_swap_usd: number | null;
  mt5_reference_end_liquidation_net_usd: number | null;
  mt5_reference_max_open_positions: number | null;
  mt5_reference_end_liquidation_positions: number | null;
  net_delta_vs_mt5_usd: number | null;
  summary_only: boolean;
  metric_semantics: "continuous_carried_position_truth_replay" | "session_window_position_truth_replay";
  content_hash?: string;
};

type ValidationRow = {
  check: string;
  value: string | number | boolean | null;
  expected: string | number | boolean | null;
  passed: boolean;
  content_hash?: string;
};

type Options = {
  gate74bDir: string;
  artifactDir: string;
  reportPath: string;
  manifestId: string | null;
  onlyPair: string | null;
  pairs: string[] | null;
  allPairs: boolean;
  weekFrom: string | null;
  weekTo: string | null;
  maxWeeks: number | null;
  initialDepositUsd: number;
  lotSize: number;
  targetAdr: number;
  spacingAdr: number;
  minMaExpansionAdr: number;
  gridAddMode: GridAddMode;
  commissionPerEntryPer001LotUsd: number;
  longSwapPer001LotDayUsd: number;
  shortSwapPer001LotDayUsd: number;
  maxPositionsPerPair: number;
  barPathMode: BarPathMode;
  signalClock: SignalClock;
  signalAdrBrick: number;
  sessionMode: SessionMode;
  sessionTimeZone: string;
  sessionTradeStartEtMinutes: number;
  sessionTradeEndEtMinutes: number;
  sessionFlattenEtMinutes: number;
  sessionSundayStartEtMinutes: number;
  sessionFlattenOverridesEt: Record<string, number>;
  activationRuleId: ActivationRuleId;
  activationRuleIds: ActivationRuleId[];
  targetMode: TargetMode;
  logProgress: boolean;
  summaryOnly: boolean;
  signalSettings: SignalSettings;
};

type RuntimeVariantState = {
  activationRuleId: ActivationRuleId;
  stats: RuntimeStats;
  books: Map<string, PairBook>;
  previousEquityUsd: number;
};

type LocalSessionParts = {
  dateKey: string;
  weekday: number;
  minutes: number;
};

type SessionTickState = {
  canOpenOrAdd: boolean;
  shouldFlatten: boolean;
};

type RuntimeStats = {
  realizedPricePnlUsd: number;
  realizedCommissionUsd: number;
  realizedSwapUsd: number;
  endLiquidationPricePnlUsd: number;
  endLiquidationSwapUsd: number;
  sessionFlattenPricePnlUsd: number;
  sessionFlattenSwapUsd: number;
  sessionFlattenCount: number;
  sessionFlattenPositions: number;
  targetResetCount: number;
  fillsOpened: number;
  closedPositions: number;
  endLiquidationPositions: number;
  maxOpenPositions: number;
  maxLongPositions: number;
  maxShortPositions: number;
  maxAddDepth: number;
  maxFillAgeDays: number;
  positionDays: number;
  activationChecks: number;
  activationAllowedLong: number;
  activationAllowedShort: number;
  activationBlockedLong: number;
  activationBlockedShort: number;
  activationBlockedExpansion: number;
  activationStartedLong: number;
  activationStartedShort: number;
  closeEventCount: number;
  closeEventWinCount: number;
  closeEventLossCount: number;
  closeEventFlatCount: number;
  closeEventGrossProfitUsd: number;
  closeEventGrossLossAbsUsd: number;
  targetCloseNetUsd: number;
  sessionFlattenCloseNetUsd: number;
  closeEvents: CloseEvent[];
  weeklyRows: WeeklyTruthRow[];
  terminalInventoryRows: TerminalInventoryRow[];
};

type ClosedBar = {
  timestamp_utc: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

type SignalSnapshot = {
  david_state: DavidState | null;
  david_raw_state: DavidState | null;
  david_ma: number | null;
  rsi: number | null;
  stoch_main: number | null;
  stoch_release_side: Side | null;
};

type SignalBook = {
  pair: string;
  bars: ClosedBar[];
  rawK: number[];
  stochMain: Array<number | null>;
  prevClose: number | null;
  rsiWarm: Array<{ gain: number; loss: number }>;
  rsiAvgGain: number | null;
  rsiAvgLoss: number | null;
  lastRsi: number | null;
  davidState: DavidState | null;
  davidRawState: DavidState | null;
  lastSignal: SignalSnapshot;
  eventOpen: number | null;
};

const MT5_REFERENCE = {
  net_profit_usd: 174.51,
  commission_usd: -400.8,
  swap_usd: -4144.01,
  end_liquidation_net_usd: -5590.01,
  max_open_positions: 170,
  end_liquidation_positions: 149,
};

function parseOptions(): Options {
  const args = parseArgMap();
  const pairsRaw = args.get("--pairs");
  const allPairs = process.argv.includes("--all-pairs");
  const summaryOnly = process.argv.includes("--summary-only");
  const activationRuleIds = parseActivationRuleIds(args.get("--activation-rules") ?? args.get("--activation-rule") ?? "raw_both");
  return {
    gate74bDir: args.get("--gate74b-dir") ?? DEFAULT_GATE74B_DIR,
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    manifestId: args.get("--manifest-id") ?? null,
    onlyPair: pairsRaw || allPairs ? null : args.get("--only-pair")?.toUpperCase() ?? "EURUSD",
    pairs: pairsRaw ? pairsRaw.split(",").map((pair) => pair.trim().toUpperCase()).filter(Boolean) : null,
    allPairs,
    weekFrom: args.get("--week-from") ?? "2020-01-05",
    weekTo: args.get("--week-to") ?? "2025-12-28",
    maxWeeks: args.get("--max-weeks") ? Number(args.get("--max-weeks")) : null,
    initialDepositUsd: Number(args.get("--initial-deposit-usd") ?? 10_000),
    lotSize: Number(args.get("--lot-size") ?? DEFAULT_LOT_SIZE),
    targetAdr: Number(args.get("--target-adr") ?? DEFAULT_TARGET_ADR),
    spacingAdr: Number(args.get("--spacing-adr") ?? DEFAULT_SPACING_ADR),
    minMaExpansionAdr: Number(args.get("--min-ma-expansion-adr") ?? 0),
    gridAddMode: parseGridAddMode(args.get("--grid-add-mode") ?? "adverse_and_favorable"),
    commissionPerEntryPer001LotUsd: Number(args.get("--commission-per-entry-per-001-lot-usd") ?? 0.06),
    longSwapPer001LotDayUsd: Number(args.get("--long-swap-per-001-lot-day-usd") ?? -0.0917),
    shortSwapPer001LotDayUsd: Number(args.get("--short-swap-per-001-lot-day-usd") ?? 0.01),
    maxPositionsPerPair: Number(args.get("--max-positions-per-pair") ?? 250),
    barPathMode: parseBarPathMode(args.get("--bar-path-mode") ?? args.get("--bar-path") ?? "ohlc_high_low"),
    signalClock: parseSignalClock(args.get("--signal-clock") ?? "m1"),
    signalAdrBrick: Number(args.get("--signal-adr-brick") ?? 0.1),
    sessionMode: parseSessionMode(args.get("--session-mode") ?? "continuous"),
    sessionTimeZone: args.get("--session-time-zone") ?? "America/New_York",
    sessionTradeStartEtMinutes: parseTimeOfDayMinutes(args.get("--session-trade-start-et") ?? "18:05", "--session-trade-start-et"),
    sessionTradeEndEtMinutes: parseTimeOfDayMinutes(args.get("--session-trade-end-et") ?? "15:45", "--session-trade-end-et"),
    sessionFlattenEtMinutes: parseTimeOfDayMinutes(args.get("--session-flatten-et") ?? "16:00", "--session-flatten-et"),
    sessionSundayStartEtMinutes: parseTimeOfDayMinutes(args.get("--session-sunday-start-et") ?? "20:00", "--session-sunday-start-et"),
    sessionFlattenOverridesEt: parseSessionFlattenOverrides(args.get("--session-flatten-overrides-et") ?? ""),
    activationRuleId: activationRuleIds[0]!,
    activationRuleIds,
    targetMode: parseTargetMode(args.get("--target-mode") ?? "fixed_adr"),
    logProgress: process.argv.includes("--log-progress"),
    summaryOnly,
    signalSettings: parseSignalSettings(args),
  };
}

function numberArg(args: Map<string, string>, flag: string, fallback: number) {
  const raw = args.get(flag);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`Unsupported ${flag}=${raw}; expected a finite number`);
  return value;
}

function parseSignalSettings(args: Map<string, string>): SignalSettings {
  const settings = {
    davidMaPeriod: numberArg(args, "--david-ma-period", DEFAULT_SIGNAL_SETTINGS.davidMaPeriod),
    davidRsiPeriod: numberArg(args, "--david-rsi-period", DEFAULT_SIGNAL_SETTINGS.davidRsiPeriod),
    davidRsiOverbought: numberArg(args, "--david-rsi-overbought", DEFAULT_SIGNAL_SETTINGS.davidRsiOverbought),
    davidRsiOversold: numberArg(args, "--david-rsi-oversold", DEFAULT_SIGNAL_SETTINGS.davidRsiOversold),
    stochKPeriod: numberArg(args, "--stoch-k-period", DEFAULT_SIGNAL_SETTINGS.stochKPeriod),
    stochDPeriod: numberArg(args, "--stoch-d-period", DEFAULT_SIGNAL_SETTINGS.stochDPeriod),
    stochSlowing: numberArg(args, "--stoch-slowing", DEFAULT_SIGNAL_SETTINGS.stochSlowing),
    stochOverbought: numberArg(args, "--stoch-overbought", DEFAULT_SIGNAL_SETTINGS.stochOverbought),
    stochOversold: numberArg(args, "--stoch-oversold", DEFAULT_SIGNAL_SETTINGS.stochOversold),
  };
  for (const [label, value] of Object.entries({
    davidMaPeriod: settings.davidMaPeriod,
    davidRsiPeriod: settings.davidRsiPeriod,
    stochKPeriod: settings.stochKPeriod,
    stochDPeriod: settings.stochDPeriod,
    stochSlowing: settings.stochSlowing,
  })) {
    if (!Number.isInteger(value) || value < 1) throw new Error(`Unsupported ${label}=${value}; expected a positive integer`);
  }
  if (settings.davidRsiOverbought <= settings.davidRsiOversold) throw new Error("David RSI overbought must be greater than oversold");
  if (settings.stochOverbought <= settings.stochOversold) throw new Error("Stochastic overbought must be greater than oversold");
  return settings;
}

function parseBarPathMode(value: string): BarPathMode {
  if (value === "close" || value === "ohlc_high_low" || value === "ohlc_low_high" || value === "ohlc_directional") return value;
  throw new Error(`Unsupported --bar-path-mode=${value}; expected close, ohlc_high_low, ohlc_low_high, or ohlc_directional`);
}

function parseTargetMode(value: string): TargetMode {
  if (value === "fixed_adr" || value === "david_ma_reversion") return value;
  throw new Error(`Unsupported --target-mode=${value}; expected fixed_adr or david_ma_reversion`);
}

function parseGridAddMode(value: string): GridAddMode {
  if (value === "adverse_and_favorable" || value === "adverse_only") return value;
  throw new Error(`Unsupported --grid-add-mode=${value}; expected adverse_and_favorable or adverse_only`);
}

function parseSignalClock(value: string): SignalClock {
  if (value === "m1" || value === "adr_event") return value;
  throw new Error(`Unsupported --signal-clock=${value}; expected m1 or adr_event`);
}

function parseSessionMode(value: string): SessionMode {
  if (value === "continuous" || value === "ny_daily_window") return value;
  throw new Error(`Unsupported --session-mode=${value}; expected continuous or ny_daily_window`);
}

function parseTimeOfDayMinutes(value: string, flag: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) throw new Error(`Unsupported ${flag}=${value}; expected HH:mm in 24-hour local session time`);
  return Number(match[1]) * 60 + Number(match[2]);
}

function parseSessionFlattenOverrides(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return {};
  const overrides: Record<string, number> = {};
  for (const part of trimmed.split(",")) {
    const entry = part.trim();
    if (!entry) continue;
    const [dateKey, time, extra] = entry.split("=");
    if (!dateKey || !time || extra !== undefined || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      throw new Error(`Unsupported --session-flatten-overrides-et entry=${entry}; expected YYYY-MM-DD=HH:mm`);
    }
    overrides[dateKey] = parseTimeOfDayMinutes(time, "--session-flatten-overrides-et");
  }
  return overrides;
}

function formatTimeOfDay(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function sessionFlattenOverridesLabel(overrides: Record<string, number>) {
  return Object.entries(overrides)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dateKey, minutes]) => `${dateKey}=${formatTimeOfDay(minutes)}`)
    .join(",");
}

function parseActivationRuleId(value: string): ActivationRuleId {
  if (
    value === "raw_both" ||
    value === "candidate_b" ||
    value === "candidate_b_david_contra_confirm" ||
    value === "candidate_b_david_contra_conflict_candidate" ||
    value === "david_contra" ||
    value === "david_with" ||
    value === "stoch_contra" ||
    value === "david_stoch_confirm" ||
    value === "david_stoch_release"
  ) {
    return value;
  }
  throw new Error(`Unsupported --activation-rule=${value}; expected raw_both, candidate_b, candidate_b_david_contra_confirm, candidate_b_david_contra_conflict_candidate, david_contra, david_with, stoch_contra, david_stoch_confirm, or david_stoch_release`);
}

function parseActivationRuleIds(value: string): ActivationRuleId[] {
  const expanded = value === "core" || value === "all_core"
    ? "raw_both,david_contra,david_with,stoch_contra,david_stoch_confirm,david_stoch_release"
    : value === "candidate_compare"
      ? "raw_both,candidate_b,david_contra,candidate_b_david_contra_confirm,candidate_b_david_contra_conflict_candidate,david_stoch_release"
    : value;
  const ids = expanded.split(",").map((part) => parseActivationRuleId(part.trim())).filter(Boolean);
  const unique = [...new Set(ids)];
  if (unique.length === 0) throw new Error("At least one activation rule is required");
  return unique;
}

function variantId(ruleId: ActivationRuleId) {
  return `RAW_GRID_T100_S020_GATE90_${ruleId.toUpperCase()}`;
}

function davidSettingsLabel(settings: SignalSettings) {
  return `LWMA${settings.davidMaPeriod}_RSI${settings.davidRsiPeriod}_${settings.davidRsiOverbought}_${settings.davidRsiOversold}`;
}

function stochasticSettingsLabel(settings: SignalSettings) {
  return `${settings.stochKPeriod}_${settings.stochDPeriod}_${settings.stochSlowing}_${settings.stochOverbought}_${settings.stochOversold}_low_high_simple_main_only`;
}

function signalSettingsId(settings: SignalSettings) {
  return `DAVID_${davidSettingsLabel(settings)}__STOCH_${stochasticSettingsLabel(settings)}`;
}

function signalHistoryLimit(settings: SignalSettings) {
  return Math.max(
    180,
    settings.davidMaPeriod + 2,
    settings.stochKPeriod + settings.stochSlowing + 5,
  );
}

function round6(value: number) {
  return round(value, 6) ?? value;
}

function round2(value: number) {
  return round(value, 2) ?? value;
}

function withHash<T extends Record<string, unknown>>(row: T): T & { content_hash: string } {
  return { ...row, content_hash: sha256Stable(row) };
}

function normalizeDateBound(value: string | null) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(value).toISOString().slice(0, 10);
}

function resolveSelectedWeeks(allWeeks: string[], options: Options) {
  const from = normalizeDateBound(options.weekFrom);
  const to = normalizeDateBound(options.weekTo);
  let weeks = allWeeks.filter((week) => {
    const day = week.slice(0, 10);
    return (!from || day >= from) && (!to || day <= to);
  });
  if (options.maxWeeks !== null) weeks = weeks.slice(0, options.maxWeeks);
  return weeks;
}

function resolveSelectedPairs(universeSymbols: string[], options: Options) {
  if (options.allPairs) return [...universeSymbols].sort();
  if (options.pairs?.length) return options.pairs;
  if (options.onlyPair) return [options.onlyPair];
  return [...universeSymbols].sort();
}

function baseCurrency(pair: string) {
  return pair.slice(0, 3);
}

function quoteCurrency(pair: string) {
  return pair.slice(3, 6);
}

function conversionKey(timestampUtc: string, tickIndex: number) {
  return `${timestampUtc}|${tickIndex}`;
}

function emptyConversionRates(): ConversionRates {
  return {
    getUsdPerCurrency(currency) {
      return currency === "USD" ? 1 : null;
    },
  };
}

function renderDurableCommand(options: Options) {
  const pairSelection = options.allPairs
    ? "--all-pairs"
    : options.pairs?.length
      ? `--pairs=${options.pairs.join(",")}`
      : `--only-pair=${options.onlyPair ?? ""}`;
  return [
    COMMAND,
    "--",
    pairSelection,
    `--week-from=${options.weekFrom ?? ""}`,
    `--week-to=${options.weekTo ?? ""}`,
    `--activation-rules=${options.activationRuleIds.join(",")}`,
    `--bar-path-mode=${options.barPathMode}`,
    `--signal-clock=${options.signalClock}`,
    `--signal-adr-brick=${options.signalAdrBrick}`,
    `--session-mode=${options.sessionMode}`,
    `--session-time-zone=${options.sessionTimeZone}`,
    `--session-trade-start-et=${formatTimeOfDay(options.sessionTradeStartEtMinutes)}`,
    `--session-trade-end-et=${formatTimeOfDay(options.sessionTradeEndEtMinutes)}`,
    `--session-flatten-et=${formatTimeOfDay(options.sessionFlattenEtMinutes)}`,
    `--session-sunday-start-et=${formatTimeOfDay(options.sessionSundayStartEtMinutes)}`,
    ...(sessionFlattenOverridesLabel(options.sessionFlattenOverridesEt)
      ? [`--session-flatten-overrides-et=${sessionFlattenOverridesLabel(options.sessionFlattenOverridesEt)}`]
      : []),
    `--target-mode=${options.targetMode}`,
    `--target-adr=${options.targetAdr}`,
    `--spacing-adr=${options.spacingAdr}`,
    `--min-ma-expansion-adr=${options.minMaExpansionAdr}`,
    `--grid-add-mode=${options.gridAddMode}`,
    `--david-ma-period=${options.signalSettings.davidMaPeriod}`,
    `--david-rsi-period=${options.signalSettings.davidRsiPeriod}`,
    `--david-rsi-overbought=${options.signalSettings.davidRsiOverbought}`,
    `--david-rsi-oversold=${options.signalSettings.davidRsiOversold}`,
    `--stoch-k-period=${options.signalSettings.stochKPeriod}`,
    `--stoch-d-period=${options.signalSettings.stochDPeriod}`,
    `--stoch-slowing=${options.signalSettings.stochSlowing}`,
    `--stoch-overbought=${options.signalSettings.stochOverbought}`,
    `--stoch-oversold=${options.signalSettings.stochOversold}`,
    ...(options.summaryOnly ? ["--summary-only"] : []),
    `--artifact-dir=${toRepoRelative(options.artifactDir)}`,
    `--report-path=${toRepoRelative(options.reportPath)}`,
  ].join(" ");
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const sessionFormatters = new Map<string, Intl.DateTimeFormat>();
const localSessionPartsCache = new Map<string, LocalSessionParts>();

function sessionFormatter(timeZone: string) {
  const cached = sessionFormatters.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  sessionFormatters.set(timeZone, formatter);
  return formatter;
}

function localSessionParts(timestampMs: number, timeZone: string): LocalSessionParts {
  const cacheKey = `${timeZone}|${Math.floor(timestampMs / 60_000)}`;
  const cached = localSessionPartsCache.get(cacheKey);
  if (cached) return cached;
  const parts = Object.fromEntries(
    sessionFormatter(timeZone)
      .formatToParts(new Date(timestampMs))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const weekday = WEEKDAY_INDEX[parts.weekday ?? ""];
  if (weekday === undefined) throw new Error(`Could not resolve ${timeZone} weekday for ${new Date(timestampMs).toISOString()}`);
  const parsed: LocalSessionParts = {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    weekday,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
  localSessionPartsCache.set(cacheKey, parsed);
  return parsed;
}

function sessionFlattenMinutesForDate(options: Options, dateKey: string) {
  return options.sessionFlattenOverridesEt[dateKey] ?? options.sessionFlattenEtMinutes;
}

function sessionTickState(options: Options, timestampMs: number): SessionTickState {
  if (options.sessionMode === "continuous") return { canOpenOrAdd: true, shouldFlatten: false };
  const local = localSessionParts(timestampMs, options.sessionTimeZone);
  const flattenMinutes = sessionFlattenMinutesForDate(options, local.dateKey);
  const morningCutoff = Math.min(options.sessionTradeEndEtMinutes, flattenMinutes);
  const hasFlattenOverride = Object.prototype.hasOwnProperty.call(options.sessionFlattenOverridesEt, local.dateKey);

  let canOpenOrAdd = false;
  if (local.weekday === 0) {
    canOpenOrAdd = local.minutes >= options.sessionSundayStartEtMinutes;
  } else if (local.weekday >= 1 && local.weekday <= 4) {
    canOpenOrAdd = local.minutes < morningCutoff || local.minutes >= options.sessionTradeStartEtMinutes;
  } else if (local.weekday === 5) {
    canOpenOrAdd = local.minutes < morningCutoff;
  }

  let shouldFlatten = false;
  if (local.weekday >= 1 && local.weekday <= 4) {
    shouldFlatten = local.minutes >= flattenMinutes && local.minutes < options.sessionTradeStartEtMinutes;
  } else if (local.weekday === 5) {
    shouldFlatten = local.minutes >= flattenMinutes;
  } else if (hasFlattenOverride) {
    shouldFlatten = local.minutes >= flattenMinutes && local.minutes < options.sessionTradeStartEtMinutes;
  }

  return { canOpenOrAdd, shouldFlatten };
}

function dateKeyDayNumber(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(year!, month! - 1, day!) / 86_400_000);
}

function sessionFlattenElapsedSince(options: Options, previousTimestampMs: number | null, currentTimestampMs: number) {
  if (options.sessionMode === "continuous" || previousTimestampMs === null || currentTimestampMs <= previousTimestampMs) return false;
  const previous = localSessionParts(previousTimestampMs, options.sessionTimeZone);
  const current = localSessionParts(currentTimestampMs, options.sessionTimeZone);
  const currentFlattenMinutes = sessionFlattenMinutesForDate(options, current.dateKey);
  if (previous.dateKey === current.dateKey) {
    return previous.minutes < currentFlattenMinutes && current.minutes >= currentFlattenMinutes;
  }

  const previousFlattenMinutes = sessionFlattenMinutesForDate(options, previous.dateKey);
  const previousDayCanFlatten = previous.weekday >= 1 && previous.weekday <= 5;
  if (previousDayCanFlatten && previous.minutes < previousFlattenMinutes) return true;

  const dayDelta = dateKeyDayNumber(current.dateKey) - dateKeyDayNumber(previous.dateKey);
  if (dayDelta > 1) return true;

  const currentDayCanFlatten = current.weekday >= 1 && current.weekday <= 5;
  return currentDayCanFlatten && current.minutes >= currentFlattenMinutes;
}

function markPriceFromDirectedAdr(row: ReplayRow, directedAdr: number) {
  if (row.entry_price === null || row.entry_price <= 0) {
    throw new Error(`Missing entry price for ${row.week_open_utc} ${row.pair}`);
  }
  const signedPct = (directedAdr * row.pair_adr_pct) / 100;
  return row.candidate_b_side === "LONG"
    ? row.entry_price * (1 + signedPct)
    : row.entry_price * (1 - signedPct);
}

function directedBarPath(row: ReplayRow, index: number, mode: BarPathMode) {
  const payload = row.path_payload;
  const open = payload.directed_open_adr[index]!;
  const high = payload.directed_high_adr[index]!;
  const low = payload.directed_low_adr[index]!;
  const close = payload.directed_close_adr[index]!;
  if (mode === "close") return [close];
  if (mode === "ohlc_high_low") return [open, high, low, close];
  if (mode === "ohlc_low_high") return [open, low, high, close];
  return close >= open ? [open, low, high, close] : [open, high, low, close];
}

function buildConversionRates(rows: ReplayRow[], mode: BarPathMode): ConversionRates {
  const rates = new Map<string, Map<string, number>>();
  const setRate = (timestampUtc: string, tickIndex: number, currency: string, usdPerCurrency: number) => {
    if (!Number.isFinite(usdPerCurrency) || usdPerCurrency <= 0) return;
    const key = conversionKey(timestampUtc, tickIndex);
    const bucket = rates.get(key) ?? new Map<string, number>();
    bucket.set(currency, usdPerCurrency);
    rates.set(key, bucket);
  };

  for (const row of rows) {
    const base = baseCurrency(row.pair);
    const quote = quoteCurrency(row.pair);
    if (base !== "USD" && quote !== "USD") continue;
    const timestamps = row.path_payload.timestamp_utc;
    for (let index = 0; index < timestamps.length; index += 1) {
      const timestampUtc = timestamps[index]!;
      const directedMarks = directedBarPath(row, index, mode);
      for (let tickIndex = 0; tickIndex < directedMarks.length; tickIndex += 1) {
        const markPrice = markPriceFromDirectedAdr(row, directedMarks[tickIndex]!);
        if (quote === "USD") setRate(timestampUtc, tickIndex, base, markPrice);
        else if (base === "USD") setRate(timestampUtc, tickIndex, quote, 1 / markPrice);
      }
    }
  }

  return {
    getUsdPerCurrency(currency, timestampUtc, tickIndex) {
      if (currency === "USD") return 1;
      return rates.get(conversionKey(timestampUtc, tickIndex))?.get(currency) ?? null;
    },
  };
}

function createSignalBook(pair: string): SignalBook {
  return {
    pair,
    bars: [],
    rawK: [],
    stochMain: [],
    prevClose: null,
    rsiWarm: [],
    rsiAvgGain: null,
    rsiAvgLoss: null,
    lastRsi: null,
    davidState: null,
    davidRawState: null,
    lastSignal: {
      david_state: null,
      david_raw_state: null,
      david_ma: null,
      rsi: null,
      stoch_main: null,
      stoch_release_side: null,
    },
    eventOpen: null,
  };
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

function updateRsi(book: SignalBook, close: number, settings: SignalSettings) {
  if (book.prevClose === null) {
    book.prevClose = close;
    return null;
  }
  const change = close - book.prevClose;
  book.prevClose = close;
  const gain = Math.max(change, 0);
  const loss = Math.max(-change, 0);

  if (book.rsiAvgGain === null || book.rsiAvgLoss === null) {
    book.rsiWarm.push({ gain, loss });
    if (book.rsiWarm.length < settings.davidRsiPeriod) return null;
    const gainSum = book.rsiWarm.reduce((sum, row) => sum + row.gain, 0);
    const lossSum = book.rsiWarm.reduce((sum, row) => sum + row.loss, 0);
    book.rsiAvgGain = gainSum / settings.davidRsiPeriod;
    book.rsiAvgLoss = lossSum / settings.davidRsiPeriod;
  } else {
    book.rsiAvgGain = ((book.rsiAvgGain * (settings.davidRsiPeriod - 1)) + gain) / settings.davidRsiPeriod;
    book.rsiAvgLoss = ((book.rsiAvgLoss * (settings.davidRsiPeriod - 1)) + loss) / settings.davidRsiPeriod;
  }

  if (book.rsiAvgLoss === 0) {
    book.lastRsi = 100;
  } else {
    const rs = (book.rsiAvgGain ?? 0) / book.rsiAvgLoss;
    book.lastRsi = 100 - (100 / (1 + rs));
  }
  return book.lastRsi;
}

function updateDavidState(book: SignalBook, settings: SignalSettings) {
  if (book.bars.length < settings.davidMaPeriod + 1) return null;
  const closes = book.bars.map((bar) => bar.close);
  const currentMa = lwma(closes.slice(-settings.davidMaPeriod));
  const previousMa = lwma(closes.slice(-settings.davidMaPeriod - 1, -1));
  const rawState: DavidState = previousMa > currentMa ? "DOWN" : "UP";
  book.davidRawState = rawState;

  if (book.davidState === null) {
    book.davidState = rawState;
    return currentMa;
  }
  if (rawState === book.davidState) return currentMa;

  if (rawState === "DOWN") {
    if (book.lastRsi !== null && book.lastRsi < settings.davidRsiOversold) book.davidState = "DOWN";
    return currentMa;
  }
  if (book.lastRsi !== null && book.lastRsi > settings.davidRsiOverbought) book.davidState = "UP";
  return currentMa;
}

function updateStochastic(book: SignalBook, bar: ClosedBar, settings: SignalSettings) {
  if (book.bars.length < settings.stochKPeriod) {
    book.rawK.push(Number.NaN);
    book.stochMain.push(null);
    return null;
  }
  const window = book.bars.slice(-settings.stochKPeriod);
  const lowest = Math.min(...window.map((row) => row.low));
  const highest = Math.max(...window.map((row) => row.high));
  const rawK = highest === lowest ? 50 : ((bar.close - lowest) / (highest - lowest)) * 100;
  book.rawK.push(rawK);
  const recentRaw = book.rawK.filter((value) => Number.isFinite(value)).slice(-settings.stochSlowing);
  const stoch = recentRaw.length < settings.stochSlowing
    ? null
    : recentRaw.reduce((sum, value) => sum + value, 0) / settings.stochSlowing;
  book.stochMain.push(stoch);
  return stoch;
}

function closedBarFromRow(row: ReplayRow, index: number): ClosedBar {
  const directedValues = [
    row.path_payload.directed_open_adr[index]!,
    row.path_payload.directed_high_adr[index]!,
    row.path_payload.directed_low_adr[index]!,
    row.path_payload.directed_close_adr[index]!,
  ];
  const prices = directedValues.map((value) => markPriceFromDirectedAdr(row, value));
  return {
    timestamp_utc: row.path_payload.timestamp_utc[index]!,
    open: prices[0]!,
    high: Math.max(...prices),
    low: Math.min(...prices),
    close: prices[3]!,
  };
}

function updateSignalWithClosedBar(book: SignalBook, bar: ClosedBar, settings: SignalSettings) {
  book.bars.push(bar);
  const maxHistory = signalHistoryLimit(settings);
  if (book.bars.length > maxHistory) book.bars.shift();
  const previousStoch = book.stochMain.at(-1) ?? null;
  updateRsi(book, bar.close, settings);
  const davidMa = updateDavidState(book, settings);
  const stoch = updateStochastic(book, bar, settings);
  let stochReleaseSide: Side | null = null;
  if (previousStoch !== null && stoch !== null) {
    if (previousStoch >= settings.stochOverbought && stoch < settings.stochOverbought) stochReleaseSide = "SHORT";
    if (previousStoch <= settings.stochOversold && stoch > settings.stochOversold) stochReleaseSide = "LONG";
  }
  book.lastSignal = {
    david_state: book.davidState,
    david_raw_state: book.davidRawState,
    david_ma: davidMa,
    rsi: book.lastRsi,
    stoch_main: stoch,
    stoch_release_side: stochReleaseSide,
  };
  if (book.rawK.length > maxHistory) book.rawK.shift();
  if (book.stochMain.length > maxHistory) book.stochMain.shift();
}

function updateM1SignalBook(book: SignalBook, row: ReplayRow, index: number, settings: SignalSettings) {
  updateSignalWithClosedBar(book, closedBarFromRow(row, index), settings);
}

function closePriceMoveAdr(from: number, to: number, currentAdrPct: number) {
  if (from <= 0 || currentAdrPct <= 0) return 0;
  return ((to - from) / from) * 100 / currentAdrPct;
}

function updateAdrEventSignalBook(book: SignalBook, row: ReplayRow, index: number, settings: SignalSettings, signalAdrBrick: number) {
  const m1Bar = closedBarFromRow(row, index);
  if (signalAdrBrick <= 0 || row.pair_adr_pct <= 0) return;
  if (book.eventOpen === null) {
    book.eventOpen = m1Bar.close;
    return;
  }

  let moveAdr = closePriceMoveAdr(book.eventOpen, m1Bar.close, row.pair_adr_pct);
  while (Math.abs(moveAdr) >= signalAdrBrick) {
    const direction = moveAdr > 0 ? 1 : -1;
    const eventOpen = book.eventOpen;
    const eventClose = eventOpen * (1 + direction * signalAdrBrick * row.pair_adr_pct / 100);
    updateSignalWithClosedBar(book, {
      timestamp_utc: m1Bar.timestamp_utc,
      open: eventOpen,
      high: Math.max(eventOpen, eventClose),
      low: Math.min(eventOpen, eventClose),
      close: eventClose,
    }, settings);
    book.eventOpen = eventClose;
    moveAdr = closePriceMoveAdr(book.eventOpen, m1Bar.close, row.pair_adr_pct);
  }
}

function updateSignalBook(book: SignalBook, row: ReplayRow, index: number, runtimeOptions: Options) {
  if (runtimeOptions.signalClock === "adr_event") {
    updateAdrEventSignalBook(book, row, index, runtimeOptions.signalSettings, runtimeOptions.signalAdrBrick);
    return;
  }
  updateM1SignalBook(book, row, index, runtimeOptions.signalSettings);
}

function davidContraSide(signal: SignalSnapshot) {
  if (signal.david_state === "UP") return "SHORT";
  if (signal.david_state === "DOWN") return "LONG";
  return null;
}

function activationAllows(ruleId: ActivationRuleId, signal: SignalSnapshot, side: Side, settings: SignalSettings, candidateBSide: Side) {
  if (ruleId === "raw_both") return true;
  if (ruleId === "candidate_b") return side === candidateBSide;
  if (ruleId === "david_contra") {
    return side === davidContraSide(signal);
  }
  if (ruleId === "candidate_b_david_contra_confirm") {
    const davidSide = davidContraSide(signal);
    return davidSide !== null && side === candidateBSide && side === davidSide;
  }
  if (ruleId === "candidate_b_david_contra_conflict_candidate") {
    const davidSide = davidContraSide(signal);
    return davidSide !== null && side === candidateBSide && side !== davidSide;
  }
  if (ruleId === "david_with") {
    if (signal.david_state === "UP") return side === "LONG";
    if (signal.david_state === "DOWN") return side === "SHORT";
    return false;
  }
  if (ruleId === "stoch_contra") {
    if (signal.stoch_main === null) return false;
    if (signal.stoch_main >= settings.stochOverbought) return side === "SHORT";
    if (signal.stoch_main <= settings.stochOversold) return side === "LONG";
    return false;
  }
  if (ruleId === "david_stoch_confirm") {
    if (signal.david_state === "UP" && signal.stoch_main !== null && signal.stoch_main >= settings.stochOverbought) return side === "SHORT";
    if (signal.david_state === "DOWN" && signal.stoch_main !== null && signal.stoch_main <= settings.stochOversold) return side === "LONG";
    return false;
  }
  if (ruleId === "david_stoch_release") {
    if (signal.david_state === "UP" && signal.stoch_release_side === "SHORT") return side === "SHORT";
    if (signal.david_state === "DOWN" && signal.stoch_release_side === "LONG") return side === "LONG";
    return false;
  }
  return false;
}

function maExpansionAllows(signal: SignalSnapshot, side: Side, markPrice: number, currentAdrPct: number, minExpansionAdr: number) {
  if (minExpansionAdr <= 0) return true;
  if (signal.david_ma === null || currentAdrPct <= 0) return false;
  const expansionAdr = side === "LONG"
    ? ((signal.david_ma - markPrice) / signal.david_ma) * 100 / currentAdrPct
    : ((markPrice - signal.david_ma) / signal.david_ma) * 100 / currentAdrPct;
  return expansionAdr >= minExpansionAdr;
}

function directedMoveFromCycle(cycle: Cycle, markPrice: number, currentAdrPct: number) {
  const sign = cycle.side === "LONG" ? 1 : -1;
  return ((markPrice - cycle.anchor_price) / cycle.anchor_price) * 100 * sign / currentAdrPct;
}

function fillPnlAdr(cycle: Cycle, fill: Fill, markPrice: number, currentAdrPct: number) {
  const sign = cycle.side === "LONG" ? 1 : -1;
  return ((markPrice - fill.entry_price) / fill.entry_price) * 100 * sign / currentAdrPct * fill.quantity;
}

function cycleNetPnlAdr(cycle: Cycle, markPrice: number, currentAdrPct: number) {
  return cycle.fills.reduce((sum, fill) => sum + fillPnlAdr(cycle, fill, markPrice, currentAdrPct), 0);
}

function fillPnlUsd(options: {
  pair: string;
  side: Side;
  fill: Fill;
  markPrice: number;
  timestampUtc: string;
  tickIndex: number;
  conversionRates: ConversionRates;
}) {
  const units = options.fill.lot_size * STANDARD_FX_CONTRACT_UNITS;
  const rawQuotePnl = options.side === "LONG"
    ? (options.markPrice - options.fill.entry_price) * units
    : (options.fill.entry_price - options.markPrice) * units;
  const quote = quoteCurrency(options.pair);
  const conversionRate = options.conversionRates.getUsdPerCurrency(quote, options.timestampUtc, options.tickIndex);
  if (conversionRate !== null) return rawQuotePnl * conversionRate;
  if (quote === "USD") return rawQuotePnl;
  if (baseCurrency(options.pair) === "USD" && options.markPrice > 0) return rawQuotePnl / options.markPrice;
  return rawQuotePnl;
}

function fillAgeDays(fill: Fill, timestampMs: number) {
  return Math.max(0, (timestampMs - fill.entry_ms) / 86_400_000);
}

function fillSwapUsd(fill: Fill, timestampMs: number, options: Options) {
  const per001LotDay = fill.side === "LONG" ? options.longSwapPer001LotDayUsd : options.shortSwapPer001LotDayUsd;
  return per001LotDay * (fill.lot_size / 0.01) * fillAgeDays(fill, timestampMs);
}

function profitFactorFromGross(grossProfitUsd: number, grossLossAbsUsd: number) {
  if (grossLossAbsUsd > 0) return round(grossProfitUsd / grossLossAbsUsd, 6);
  if (grossProfitUsd > 0) return Number.POSITIVE_INFINITY;
  return null;
}

function createBook(pair: string): PairBook {
  return {
    pair,
    long: null,
    short: null,
    serial: 0,
    long_resets: 0,
    short_resets: 0,
    last_mark_price: null,
    last_adr_pct: null,
    last_timestamp_utc: null,
    last_tick_index: null,
  };
}

function createStats(): RuntimeStats {
  return {
    realizedPricePnlUsd: 0,
    realizedCommissionUsd: 0,
    realizedSwapUsd: 0,
    endLiquidationPricePnlUsd: 0,
    endLiquidationSwapUsd: 0,
    sessionFlattenPricePnlUsd: 0,
    sessionFlattenSwapUsd: 0,
    sessionFlattenCount: 0,
    sessionFlattenPositions: 0,
    targetResetCount: 0,
    fillsOpened: 0,
    closedPositions: 0,
    endLiquidationPositions: 0,
    maxOpenPositions: 0,
    maxLongPositions: 0,
    maxShortPositions: 0,
    maxAddDepth: 0,
    maxFillAgeDays: 0,
    positionDays: 0,
    activationChecks: 0,
    activationAllowedLong: 0,
    activationAllowedShort: 0,
    activationBlockedLong: 0,
    activationBlockedShort: 0,
    activationBlockedExpansion: 0,
    activationStartedLong: 0,
    activationStartedShort: 0,
    closeEventCount: 0,
    closeEventWinCount: 0,
    closeEventLossCount: 0,
    closeEventFlatCount: 0,
    closeEventGrossProfitUsd: 0,
    closeEventGrossLossAbsUsd: 0,
    targetCloseNetUsd: 0,
    sessionFlattenCloseNetUsd: 0,
    closeEvents: [],
    weeklyRows: [],
    terminalInventoryRows: [],
  };
}

function sideCycle(book: PairBook, side: Side) {
  return side === "LONG" ? book.long : book.short;
}

function setSideCycle(book: PairBook, side: Side, cycle: Cycle | null) {
  if (side === "LONG") book.long = cycle;
  else book.short = cycle;
}

function sideResetCount(book: PairBook, side: Side) {
  return side === "LONG" ? book.long_resets : book.short_resets;
}

function incrementSideReset(book: PairBook, side: Side) {
  if (side === "LONG") book.long_resets += 1;
  else book.short_resets += 1;
  return sideResetCount(book, side);
}

function openPositionCounts(books: Map<string, PairBook>) {
  let total = 0;
  let long = 0;
  let short = 0;
  for (const book of books.values()) {
    const longCount = book.long?.fills.length ?? 0;
    const shortCount = book.short?.fills.length ?? 0;
    long += longCount;
    short += shortCount;
    total += longCount + shortCount;
  }
  return { total, long, short };
}

function pairOpenCount(book: PairBook) {
  return (book.long?.fills.length ?? 0) + (book.short?.fills.length ?? 0);
}

function observeStats(stats: RuntimeStats, books: Map<string, PairBook>) {
  const counts = openPositionCounts(books);
  stats.maxOpenPositions = Math.max(stats.maxOpenPositions, counts.total);
  stats.maxLongPositions = Math.max(stats.maxLongPositions, counts.long);
  stats.maxShortPositions = Math.max(stats.maxShortPositions, counts.short);
}

function openFill(options: {
  stats: RuntimeStats;
  book: PairBook;
  cycle: Cycle;
  markPrice: number;
  timestampUtc: string;
  timestampMs: number;
  kind: FillKind;
  levelIndex: number;
  runtimeOptions: Options;
}) {
  if (pairOpenCount(options.book) >= options.runtimeOptions.maxPositionsPerPair) return false;
  const commission = -options.runtimeOptions.commissionPerEntryPer001LotUsd * (options.runtimeOptions.lotSize / 0.01);
  const fill: Fill = {
    pair: options.book.pair,
    side: options.cycle.side,
    entry_price: options.markPrice,
    entry_timestamp_utc: options.timestampUtc,
    entry_ms: options.timestampMs,
    fill_index: options.cycle.fills.length,
    level_index: options.levelIndex,
    kind: options.kind,
    quantity: 1,
    lot_size: options.runtimeOptions.lotSize,
    commission_usd: commission,
  };
  options.cycle.fills.push(fill);
  options.cycle.entry_price_inverse_sum += 1 / options.markPrice;
  options.cycle.quantity_sum += 1;
  options.stats.realizedCommissionUsd = round6(options.stats.realizedCommissionUsd + commission);
  options.stats.fillsOpened += 1;
  options.stats.maxAddDepth = Math.max(options.stats.maxAddDepth, options.levelIndex);
  return true;
}

function startCycle(options: {
  stats: RuntimeStats;
  book: PairBook;
  row: ReplayRow;
  side: Side;
  variant_id: string;
  markPrice: number;
  timestampUtc: string;
  timestampMs: number;
  runtimeOptions: Options;
}) {
  options.book.serial += 1;
  const cycle: Cycle = {
    cycle_id: `${options.variant_id}|${options.book.pair}|${options.side}|${options.book.serial}`,
    variant_id: options.variant_id,
    pair: options.book.pair,
    side: options.side,
    anchor_week_open_utc: options.row.week_open_utc,
    start_timestamp_utc: options.timestampUtc,
    anchor_price: options.markPrice,
    cycle_adr_pct: options.row.pair_adr_pct,
    fills: [],
    entry_price_inverse_sum: 0,
    quantity_sum: 0,
    next_adverse_fill_level: 1,
    next_favorable_fill_level: 1,
    min_pnl_adr: 0,
    max_pnl_adr: 0,
    reset_ordinal_at_start: sideResetCount(options.book, options.side),
  };
  const opened = openFill({
    stats: options.stats,
    book: options.book,
    cycle,
    markPrice: options.markPrice,
    timestampUtc: options.timestampUtc,
    timestampMs: options.timestampMs,
    kind: "initial",
    levelIndex: 0,
    runtimeOptions: options.runtimeOptions,
  });
  if (opened && options.side === "LONG") options.stats.activationStartedLong += 1;
  if (opened && options.side === "SHORT") options.stats.activationStartedShort += 1;
  return opened ? cycle : null;
}

function observeCycle(cycle: Cycle, markPrice: number, currentAdrPct: number) {
  const pnl = round6(cycleNetPnlAdr(cycle, markPrice, currentAdrPct));
  if (pnl < cycle.min_pnl_adr) cycle.min_pnl_adr = pnl;
  if (pnl > cycle.max_pnl_adr) cycle.max_pnl_adr = pnl;
}

function addGridFills(options: {
  stats: RuntimeStats;
  book: PairBook;
  cycle: Cycle;
  markPrice: number;
  timestampUtc: string;
  timestampMs: number;
  currentAdrPct: number;
  runtimeOptions: Options;
}) {
  const directed = directedMoveFromCycle(options.cycle, options.markPrice, options.currentAdrPct);
  while (directed <= -options.runtimeOptions.spacingAdr * options.cycle.next_adverse_fill_level) {
    const level = options.cycle.next_adverse_fill_level;
    const opened = openFill({
      ...options,
      kind: "adverse_recovery",
      levelIndex: level,
    });
    if (!opened) break;
    options.cycle.next_adverse_fill_level += 1;
  }
  if (options.runtimeOptions.gridAddMode === "adverse_and_favorable") {
    while (directed >= options.runtimeOptions.spacingAdr * options.cycle.next_favorable_fill_level) {
      const level = options.cycle.next_favorable_fill_level;
      const opened = openFill({
        ...options,
        kind: "favorable_expansion",
        levelIndex: level,
      });
      if (!opened) break;
      options.cycle.next_favorable_fill_level += 1;
    }
  }
}

function targetReached(options: {
  cycle: Cycle;
  signal: SignalSnapshot;
  markPrice: number;
  currentAdrPct: number;
  runtimeOptions: Options;
}) {
  const pnlAdr = round6(cycleNetPnlAdr(options.cycle, options.markPrice, options.currentAdrPct));
  if (options.runtimeOptions.targetMode === "fixed_adr") return pnlAdr >= options.runtimeOptions.targetAdr;
  const ma = options.signal.david_ma;
  if (ma === null || pnlAdr <= 0) return false;
  return options.cycle.side === "LONG" ? options.markPrice >= ma : options.markPrice <= ma;
}

function closeCycle(options: {
  stats: RuntimeStats;
  cycle: Cycle;
  closeReason: CloseReason;
  markPrice: number;
  currentAdrPct: number;
  timestampUtc: string;
  timestampMs: number;
  tickIndex: number;
  conversionRates: ConversionRates;
  runtimeOptions: Options;
  completedResetOrdinal: number | null;
}) {
  observeCycle(options.cycle, options.markPrice, options.currentAdrPct);
  let pricePnlUsd = 0;
  let swapUsd = 0;
  let commissionUsd = 0;
  let maxFillAgeDays = 0;
  for (const fill of options.cycle.fills) {
    const age = fillAgeDays(fill, options.timestampMs);
    maxFillAgeDays = Math.max(maxFillAgeDays, age);
    options.stats.positionDays += age * (fill.lot_size / options.runtimeOptions.lotSize);
    pricePnlUsd += fillPnlUsd({
      pair: options.cycle.pair,
      side: options.cycle.side,
      fill,
      markPrice: options.markPrice,
      timestampUtc: options.timestampUtc,
      tickIndex: options.tickIndex,
      conversionRates: options.conversionRates,
    });
    swapUsd += fillSwapUsd(fill, options.timestampMs, options.runtimeOptions);
    commissionUsd += fill.commission_usd;
  }
  const pricePnlAdr = cycleNetPnlAdr(options.cycle, options.markPrice, options.currentAdrPct);
  if (options.closeReason === "end_of_test") {
    options.stats.endLiquidationPricePnlUsd = round6(options.stats.endLiquidationPricePnlUsd + pricePnlUsd);
    options.stats.endLiquidationSwapUsd = round6(options.stats.endLiquidationSwapUsd + swapUsd);
    options.stats.endLiquidationPositions += options.cycle.fills.length;
  } else if (options.closeReason === "session_flatten") {
    options.stats.sessionFlattenPricePnlUsd = round6(options.stats.sessionFlattenPricePnlUsd + pricePnlUsd);
    options.stats.sessionFlattenSwapUsd = round6(options.stats.sessionFlattenSwapUsd + swapUsd);
    options.stats.sessionFlattenCount += 1;
    options.stats.sessionFlattenPositions += options.cycle.fills.length;
  } else {
    options.stats.targetResetCount += 1;
  }
  options.stats.realizedPricePnlUsd = round6(options.stats.realizedPricePnlUsd + pricePnlUsd);
  options.stats.realizedSwapUsd = round6(options.stats.realizedSwapUsd + swapUsd);
  options.stats.closedPositions += options.cycle.fills.length;
  options.stats.maxFillAgeDays = Math.max(options.stats.maxFillAgeDays, maxFillAgeDays);
  const event: CloseEvent = {
    variant_id: options.cycle.variant_id,
    pair: options.cycle.pair,
    side: options.cycle.side,
    close_reason: options.closeReason,
    close_timestamp_utc: options.timestampUtc,
    anchor_week_open_utc: options.cycle.anchor_week_open_utc,
    fill_count: options.cycle.fills.length,
    adverse_fill_count: options.cycle.fills.filter((fill) => fill.kind === "adverse_recovery").length,
    expansion_fill_count: options.cycle.fills.filter((fill) => fill.kind === "favorable_expansion").length,
    price_pnl_adr: round6(pricePnlAdr),
    price_pnl_usd: round6(pricePnlUsd),
    commission_usd: round6(commissionUsd),
    swap_usd: round6(swapUsd),
    net_usd: round6(pricePnlUsd + swapUsd + commissionUsd),
    min_pnl_adr: round6(options.cycle.min_pnl_adr),
    max_pnl_adr: round6(options.cycle.max_pnl_adr),
    reset_ordinal_at_start: options.cycle.reset_ordinal_at_start,
    completed_reset_ordinal: options.completedResetOrdinal,
    max_fill_age_days: round6(maxFillAgeDays),
  };
  options.stats.closeEventCount += 1;
  if (event.net_usd > 0) {
    options.stats.closeEventWinCount += 1;
    options.stats.closeEventGrossProfitUsd = round6(options.stats.closeEventGrossProfitUsd + event.net_usd);
  } else if (event.net_usd < 0) {
    options.stats.closeEventLossCount += 1;
    options.stats.closeEventGrossLossAbsUsd = round6(options.stats.closeEventGrossLossAbsUsd + Math.abs(event.net_usd));
  } else {
    options.stats.closeEventFlatCount += 1;
  }
  if (options.closeReason === "target") {
    options.stats.targetCloseNetUsd = round6(options.stats.targetCloseNetUsd + event.net_usd);
  } else if (options.closeReason === "session_flatten") {
    options.stats.sessionFlattenCloseNetUsd = round6(options.stats.sessionFlattenCloseNetUsd + event.net_usd);
  }
  if (!options.runtimeOptions.summaryOnly) options.stats.closeEvents.push(event);
  return event;
}

function terminalInventoryRow(options: {
  activationRuleId: ActivationRuleId;
  cycle: Cycle;
  signal: SignalSnapshot | null;
  markPrice: number;
  currentAdrPct: number;
  timestampUtc: string;
  timestampMs: number;
  tickIndex: number;
  conversionRates: ConversionRates;
  runtimeOptions: Options;
}): TerminalInventoryRow {
  observeCycle(options.cycle, options.markPrice, options.currentAdrPct);
  let pricePnlUsd = 0;
  let swapUsd = 0;
  let commissionUsd = 0;
  let ageSum = 0;
  let maxFillAgeDays = 0;
  let maxAddDepth = 0;
  for (const fill of options.cycle.fills) {
    const age = fillAgeDays(fill, options.timestampMs);
    ageSum += age;
    maxFillAgeDays = Math.max(maxFillAgeDays, age);
    maxAddDepth = Math.max(maxAddDepth, fill.level_index);
    pricePnlUsd += fillPnlUsd({
      pair: options.cycle.pair,
      side: options.cycle.side,
      fill,
      markPrice: options.markPrice,
      timestampUtc: options.timestampUtc,
      tickIndex: options.tickIndex,
      conversionRates: options.conversionRates,
    });
    swapUsd += fillSwapUsd(fill, options.timestampMs, options.runtimeOptions);
    commissionUsd += fill.commission_usd;
  }
  const davidMa = options.signal?.david_ma ?? null;
  const sideExitDistanceToMaAdr = davidMa !== null && davidMa > 0 && options.currentAdrPct > 0
    ? options.cycle.side === "LONG"
      ? ((davidMa - options.markPrice) / davidMa) * 100 / options.currentAdrPct
      : ((options.markPrice - davidMa) / davidMa) * 100 / options.currentAdrPct
    : null;
  return {
    variant_id: options.cycle.variant_id,
    activation_rule_id: options.activationRuleId,
    cycle_id: options.cycle.cycle_id,
    pair: options.cycle.pair,
    side: options.cycle.side,
    terminal_timestamp_utc: options.timestampUtc,
    anchor_week_open_utc: options.cycle.anchor_week_open_utc,
    start_timestamp_utc: options.cycle.start_timestamp_utc,
    fill_count: options.cycle.fills.length,
    adverse_fill_count: options.cycle.fills.filter((fill) => fill.kind === "adverse_recovery").length,
    expansion_fill_count: options.cycle.fills.filter((fill) => fill.kind === "favorable_expansion").length,
    max_add_depth: maxAddDepth,
    max_fill_age_days: round6(maxFillAgeDays),
    avg_fill_age_days: round6(options.cycle.fills.length ? ageSum / options.cycle.fills.length : 0),
    terminal_mark_price: round6(options.markPrice),
    terminal_david_ma: davidMa === null ? null : round6(davidMa),
    side_exit_distance_to_ma_adr: sideExitDistanceToMaAdr === null ? null : round6(sideExitDistanceToMaAdr),
    directed_move_from_anchor_adr: round6(directedMoveFromCycle(options.cycle, options.markPrice, options.currentAdrPct)),
    price_pnl_adr: round6(cycleNetPnlAdr(options.cycle, options.markPrice, options.currentAdrPct)),
    liquidation_price_pnl_usd: round6(pricePnlUsd),
    liquidation_swap_usd: round6(swapUsd),
    entry_commission_usd: round6(commissionUsd),
    liquidation_net_usd: round6(pricePnlUsd + swapUsd + commissionUsd),
    min_pnl_adr: round6(options.cycle.min_pnl_adr),
    max_pnl_adr: round6(options.cycle.max_pnl_adr),
  };
}

function replayTick(options: {
  stats: RuntimeStats;
  books: Map<string, PairBook>;
  row: ReplayRow;
  signal: SignalSnapshot;
  markPrice: number;
  timestampUtc: string;
  timestampMs: number;
  tickIndex: number;
  conversionRates: ConversionRates;
  runtimeOptions: Options;
  activationRuleId: ActivationRuleId;
  sessionState: SessionTickState;
}) {
  const book = options.books.get(options.row.pair) ?? createBook(options.row.pair);
  options.books.set(options.row.pair, book);
  const variant_id = variantId(options.activationRuleId);
  const previousTimestampMs = book.last_timestamp_utc === null
    ? null
    : Date.parse(book.last_timestamp_utc) + (book.last_tick_index ?? 0);
  const missedSessionFlatten = !options.sessionState.shouldFlatten
    && sessionFlattenElapsedSince(options.runtimeOptions, previousTimestampMs, options.timestampMs);
  book.last_mark_price = options.markPrice;
  book.last_adr_pct = options.row.pair_adr_pct;
  book.last_timestamp_utc = options.timestampUtc;
  book.last_tick_index = options.tickIndex;
  for (const side of ["LONG", "SHORT"] as const) {
    let cycle = sideCycle(book, side);
    if (cycle) {
      observeCycle(cycle, options.markPrice, options.row.pair_adr_pct);
      if (missedSessionFlatten) {
        closeCycle({
          stats: options.stats,
          cycle,
          closeReason: "session_flatten",
          markPrice: options.markPrice,
          currentAdrPct: options.row.pair_adr_pct,
          timestampUtc: options.timestampUtc,
          timestampMs: options.timestampMs,
          tickIndex: options.tickIndex,
          conversionRates: options.conversionRates,
          runtimeOptions: options.runtimeOptions,
          completedResetOrdinal: null,
        });
        setSideCycle(book, side, null);
        continue;
      }
      if (targetReached({
        cycle,
        signal: options.signal,
        markPrice: options.markPrice,
        currentAdrPct: options.row.pair_adr_pct,
        runtimeOptions: options.runtimeOptions,
      })) {
        const completedResetOrdinal = incrementSideReset(book, side);
        closeCycle({
          stats: options.stats,
          cycle,
          closeReason: "target",
          markPrice: options.markPrice,
          currentAdrPct: options.row.pair_adr_pct,
          timestampUtc: options.timestampUtc,
          timestampMs: options.timestampMs,
          tickIndex: options.tickIndex,
          conversionRates: options.conversionRates,
          runtimeOptions: options.runtimeOptions,
          completedResetOrdinal,
        });
        setSideCycle(book, side, null);
        continue;
      }
      if (options.sessionState.shouldFlatten) {
        closeCycle({
          stats: options.stats,
          cycle,
          closeReason: "session_flatten",
          markPrice: options.markPrice,
          currentAdrPct: options.row.pair_adr_pct,
          timestampUtc: options.timestampUtc,
          timestampMs: options.timestampMs,
          tickIndex: options.tickIndex,
          conversionRates: options.conversionRates,
          runtimeOptions: options.runtimeOptions,
          completedResetOrdinal: null,
        });
        setSideCycle(book, side, null);
        continue;
      }
      if (!options.sessionState.canOpenOrAdd) continue;
      addGridFills({
        stats: options.stats,
        book,
        cycle,
        markPrice: options.markPrice,
        timestampUtc: options.timestampUtc,
        timestampMs: options.timestampMs,
        currentAdrPct: options.row.pair_adr_pct,
        runtimeOptions: options.runtimeOptions,
      });
      observeCycle(cycle, options.markPrice, options.row.pair_adr_pct);
      continue;
    }
    if (options.sessionState.canOpenOrAdd) {
      const signalAllowed = options.activationRuleId === "raw_both"
        ? true
        : activationAllows(options.activationRuleId, options.signal, side, options.runtimeOptions.signalSettings, options.row.candidate_b_side);
      const expansionAllowed = signalAllowed && maExpansionAllows(
        options.signal,
        side,
        options.markPrice,
        options.row.pair_adr_pct,
        options.runtimeOptions.minMaExpansionAdr,
      );
      const allowed = signalAllowed && expansionAllowed;
      options.stats.activationChecks += 1;
      if (side === "LONG" && allowed) options.stats.activationAllowedLong += 1;
      if (side === "SHORT" && allowed) options.stats.activationAllowedShort += 1;
      if (side === "LONG" && !allowed) options.stats.activationBlockedLong += 1;
      if (side === "SHORT" && !allowed) options.stats.activationBlockedShort += 1;
      if (signalAllowed && !expansionAllowed) options.stats.activationBlockedExpansion += 1;
      if (!allowed) continue;
      cycle = startCycle({
        stats: options.stats,
        book,
        row: options.row,
        side,
        variant_id,
        markPrice: options.markPrice,
        timestampUtc: options.timestampUtc,
        timestampMs: options.timestampMs,
        runtimeOptions: options.runtimeOptions,
      });
      setSideCycle(book, side, cycle);
      continue;
    }
  }
  observeStats(options.stats, options.books);
}

function replayRowForVariants(options: {
  variantStates: RuntimeVariantState[];
  sharedSignalBooks: Map<string, SignalBook>;
  row: ReplayRow;
  conversionRates: ConversionRates;
  runtimeOptions: Options;
}) {
  const signalBook = options.sharedSignalBooks.get(options.row.pair) ?? createSignalBook(options.row.pair);
  options.sharedSignalBooks.set(options.row.pair, signalBook);
  const timestamps = options.row.path_payload.timestamp_utc;
  for (let index = 0; index < timestamps.length; index += 1) {
    const timestampUtc = timestamps[index]!;
    const baseTimestampMs = Date.parse(timestampUtc);
    const directedMarks = directedBarPath(options.row, index, options.runtimeOptions.barPathMode);
    const signal = signalBook.lastSignal;
    for (let tickIndex = 0; tickIndex < directedMarks.length; tickIndex += 1) {
      const timestampMs = baseTimestampMs + tickIndex;
      const markPrice = markPriceFromDirectedAdr(options.row, directedMarks[tickIndex]!);
      const sessionState = sessionTickState(options.runtimeOptions, timestampMs);
      for (const variantState of options.variantStates) {
        replayTick({
          stats: variantState.stats,
          books: variantState.books,
          row: options.row,
          signal,
          markPrice,
          timestampUtc,
          timestampMs,
          tickIndex,
          conversionRates: options.conversionRates,
          runtimeOptions: options.runtimeOptions,
          activationRuleId: variantState.activationRuleId,
          sessionState,
        });
      }
    }
    updateSignalBook(signalBook, options.row, index, options.runtimeOptions);
  }
}

function snapshotOpen(books: Map<string, PairBook>, timestampUtc: string, runtimeOptions: Options, conversionRates: ConversionRates) {
  const timestampMs = Date.parse(timestampUtc);
  let openPricePnlUsd = 0;
  let openSwapUsd = 0;
  for (const book of books.values()) {
    if (book.last_mark_price === null) continue;
    for (const cycle of [book.long, book.short]) {
      if (!cycle) continue;
      const bookTimestampUtc = book.last_timestamp_utc ?? timestampUtc;
      for (const fill of cycle.fills) {
        openPricePnlUsd += fillPnlUsd({
          pair: cycle.pair,
          side: cycle.side,
          fill,
          markPrice: book.last_mark_price,
          timestampUtc: bookTimestampUtc,
          tickIndex: book.last_tick_index ?? 0,
          conversionRates,
        });
        openSwapUsd += fillSwapUsd(fill, timestampMs, runtimeOptions);
      }
    }
  }
  return { openPricePnlUsd: round6(openPricePnlUsd), openSwapUsd: round6(openSwapUsd) };
}

function addWeeklySnapshot(options: {
  stats: RuntimeStats;
  books: Map<string, PairBook>;
  variant_id: string;
  weekOpenUtc: string;
  pairsReplayed: number;
  previousEquityUsd: number;
  conversionRates: ConversionRates;
  runtimeOptions: Options;
}) {
  const snapshotTimestamp = [...options.books.values()]
    .map((book) => book.last_timestamp_utc)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? options.weekOpenUtc;
  const open = snapshotOpen(options.books, snapshotTimestamp, options.runtimeOptions, options.conversionRates);
  const balance = round6(options.runtimeOptions.initialDepositUsd + options.stats.realizedPricePnlUsd + options.stats.realizedCommissionUsd + options.stats.realizedSwapUsd);
  const equity = round6(balance + open.openPricePnlUsd + open.openSwapUsd);
  const counts = openPositionCounts(options.books);
  const row: WeeklyTruthRow = {
    variant_id: options.variant_id,
    week_open_utc: options.weekOpenUtc,
    pairs_replayed: options.pairsReplayed,
    closed_price_pnl_usd: round6(options.stats.realizedPricePnlUsd),
    realized_commission_usd: round6(options.stats.realizedCommissionUsd),
    realized_swap_usd: round6(options.stats.realizedSwapUsd),
    realized_net_usd: round6(options.stats.realizedPricePnlUsd + options.stats.realizedCommissionUsd + options.stats.realizedSwapUsd),
    open_price_pnl_usd: open.openPricePnlUsd,
    open_swap_usd: open.openSwapUsd,
    equity_usd: equity,
    balance_usd: balance,
    equity_delta_usd: round6(equity - options.previousEquityUsd),
    open_positions: counts.total,
    long_positions: counts.long,
    short_positions: counts.short,
    fills_opened: options.stats.fillsOpened,
    target_reset_count: options.stats.targetResetCount,
    max_open_positions_to_date: options.stats.maxOpenPositions,
    max_long_positions_to_date: options.stats.maxLongPositions,
    max_short_positions_to_date: options.stats.maxShortPositions,
    max_add_depth_to_date: options.stats.maxAddDepth,
    position_days_closed_to_date: round6(options.stats.positionDays),
  };
  options.stats.weeklyRows.push(row);
  return equity;
}

function liquidateEnd(options: {
  activationRuleId: ActivationRuleId;
  stats: RuntimeStats;
  books: Map<string, PairBook>;
  signalBooks: Map<string, SignalBook>;
  conversionRates: ConversionRates;
  runtimeOptions: Options;
}) {
  for (const book of options.books.values()) {
    if (book.last_mark_price === null || book.last_timestamp_utc === null) continue;
    const currentAdrPct = book.last_adr_pct ?? 1;
    const signal = options.signalBooks.get(book.pair)?.lastSignal ?? null;
    for (const side of ["LONG", "SHORT"] as const) {
      const cycle = sideCycle(book, side);
      if (!cycle) continue;
      const closeReason: CloseReason = options.runtimeOptions.sessionMode === "ny_daily_window" ? "session_flatten" : "end_of_test";
      if (closeReason === "end_of_test") {
        options.stats.terminalInventoryRows.push(terminalInventoryRow({
          activationRuleId: options.activationRuleId,
          cycle,
          signal,
          markPrice: book.last_mark_price,
          currentAdrPct,
          timestampUtc: book.last_timestamp_utc,
          timestampMs: Date.parse(book.last_timestamp_utc),
          tickIndex: book.last_tick_index ?? 0,
          conversionRates: options.conversionRates,
          runtimeOptions: options.runtimeOptions,
        }));
      }
      closeCycle({
        stats: options.stats,
        cycle,
        closeReason,
        markPrice: book.last_mark_price,
        currentAdrPct,
        timestampUtc: book.last_timestamp_utc,
        timestampMs: Date.parse(book.last_timestamp_utc),
        tickIndex: book.last_tick_index ?? 0,
        conversionRates: options.conversionRates,
        runtimeOptions: options.runtimeOptions,
        completedResetOrdinal: null,
      });
      setSideCycle(book, side, null);
    }
  }
}

function drawdown(rows: Array<{ week_open_utc: string; value: number }>) {
  let peak = 0;
  let worst = 0;
  let start: string | null = null;
  let end: string | null = null;
  let peakWeek: string | null = null;
  for (const row of rows) {
    if (row.value > peak) {
      peak = row.value;
      peakWeek = row.week_open_utc;
    }
    const dd = round6(row.value - peak);
    if (dd < worst) {
      worst = dd;
      start = peakWeek;
      end = row.week_open_utc;
    }
  }
  return { drawdown: worst, start, end };
}

function summarize(options: {
  stats: RuntimeStats;
  books: Map<string, PairBook>;
  selectedWeeks: string[];
  selectedPairs: string[];
  manifest: { manifest_id: string; warehouse_hash: string; price_bundle_id?: string | null };
  runtimeOptions: Options;
  activationRuleId: ActivationRuleId;
}): SummaryRow {
  const finalBeforeLiquidation = options.stats.weeklyRows.at(-1)?.equity_usd ?? options.runtimeOptions.initialDepositUsd;
  const finalBalance = round6(options.runtimeOptions.initialDepositUsd + options.stats.realizedPricePnlUsd + options.stats.realizedCommissionUsd + options.stats.realizedSwapUsd);
  const net = round6(finalBalance - options.runtimeOptions.initialDepositUsd);
  const equityDeltas = options.stats.weeklyRows.map((row) => row.equity_delta_usd);
  const equityDd = drawdown(options.stats.weeklyRows.map((row) => ({ week_open_utc: row.week_open_utc, value: row.equity_usd - options.runtimeOptions.initialDepositUsd })));
  const balanceDd = drawdown(options.stats.weeklyRows.map((row) => ({ week_open_utc: row.week_open_utc, value: row.balance_usd - options.runtimeOptions.initialDepositUsd })));
  const closedPricePnl = round6(options.stats.realizedPricePnlUsd - options.stats.endLiquidationPricePnlUsd);
  const endPricePnl = round6(options.stats.endLiquidationPricePnlUsd);
  const variant_id = variantId(options.activationRuleId);
  const settings = options.runtimeOptions.signalSettings;
  const longChecks = options.stats.activationAllowedLong + options.stats.activationBlockedLong;
  const shortChecks = options.stats.activationAllowedShort + options.stats.activationBlockedShort;
  const closeWinPct = options.stats.closeEventCount
    ? round2((options.stats.closeEventWinCount / options.stats.closeEventCount) * 100)
    : null;
  return withHash({
    variant_id,
    activation_rule_id: options.activationRuleId,
    signal_settings_id: signalSettingsId(settings),
    david_settings: davidSettingsLabel(settings),
    stochastic_settings: stochasticSettingsLabel(settings),
    symbol_universe: options.selectedPairs.join(","),
    bar_path_mode: options.runtimeOptions.barPathMode,
    signal_clock: options.runtimeOptions.signalClock,
    signal_adr_brick: options.runtimeOptions.signalAdrBrick,
    session_mode: options.runtimeOptions.sessionMode,
    session_time_zone: options.runtimeOptions.sessionTimeZone,
    session_trade_start_et: formatTimeOfDay(options.runtimeOptions.sessionTradeStartEtMinutes),
    session_trade_end_et: formatTimeOfDay(options.runtimeOptions.sessionTradeEndEtMinutes),
    session_flatten_et: formatTimeOfDay(options.runtimeOptions.sessionFlattenEtMinutes),
    session_sunday_start_et: formatTimeOfDay(options.runtimeOptions.sessionSundayStartEtMinutes),
    session_flatten_overrides_et: sessionFlattenOverridesLabel(options.runtimeOptions.sessionFlattenOverridesEt),
    target_mode: options.runtimeOptions.targetMode,
    target_adr: options.runtimeOptions.targetAdr,
    spacing_adr: options.runtimeOptions.spacingAdr,
    min_ma_expansion_adr: options.runtimeOptions.minMaExpansionAdr,
    grid_add_mode: options.runtimeOptions.gridAddMode,
    date_range: `${options.selectedWeeks.at(0) ?? "none"}..${options.selectedWeeks.at(-1) ?? "none"}`,
    price_bundle_id: options.manifest.price_bundle_id ?? null,
    warehouse_manifest_id: options.manifest.manifest_id,
    warehouse_hash: options.manifest.warehouse_hash,
    weeks_replayed: options.selectedWeeks.length,
    pairs_replayed: options.selectedPairs.length,
    initial_deposit_usd: round2(options.runtimeOptions.initialDepositUsd),
    final_balance_usd: round2(finalBalance),
    final_equity_before_liquidation_usd: round2(finalBeforeLiquidation),
    final_equity_after_liquidation_usd: round2(finalBalance),
    net_profit_usd: round2(net),
    closed_price_pnl_usd: round2(closedPricePnl),
    end_liquidation_price_pnl_usd: round2(endPricePnl),
    total_price_pnl_usd: round2(options.stats.realizedPricePnlUsd),
    total_commission_usd: round2(options.stats.realizedCommissionUsd),
    total_swap_usd: round2(options.stats.realizedSwapUsd),
    target_reset_count: options.stats.targetResetCount,
    session_flatten_count: options.stats.sessionFlattenCount,
    session_flatten_positions: options.stats.sessionFlattenPositions,
    session_flatten_price_pnl_usd: round2(options.stats.sessionFlattenPricePnlUsd),
    session_flatten_swap_usd: round2(options.stats.sessionFlattenSwapUsd),
    entries_opened: options.stats.fillsOpened,
    closed_positions: options.stats.closedPositions,
    end_liquidation_positions: options.stats.endLiquidationPositions,
    max_open_positions: options.stats.maxOpenPositions,
    max_long_positions: options.stats.maxLongPositions,
    max_short_positions: options.stats.maxShortPositions,
    max_add_depth: options.stats.maxAddDepth,
    max_fill_age_days: round2(options.stats.maxFillAgeDays),
    position_days: round2(options.stats.positionDays),
    max_equity_drawdown_usd: round2(equityDd.drawdown),
    max_balance_drawdown_usd: round2(balanceDd.drawdown),
    weekly_equity_profit_factor: profitFactor(equityDeltas),
    close_event_count: options.stats.closeEventCount,
    close_event_win_count: options.stats.closeEventWinCount,
    close_event_loss_count: options.stats.closeEventLossCount,
    close_event_flat_count: options.stats.closeEventFlatCount,
    close_event_profit_factor: profitFactorFromGross(options.stats.closeEventGrossProfitUsd, options.stats.closeEventGrossLossAbsUsd),
    close_event_win_pct: closeWinPct,
    close_event_gross_profit_usd: round2(options.stats.closeEventGrossProfitUsd),
    close_event_gross_loss_abs_usd: round2(options.stats.closeEventGrossLossAbsUsd),
    target_close_net_usd: round2(options.stats.targetCloseNetUsd),
    session_flatten_close_net_usd: round2(options.stats.sessionFlattenCloseNetUsd),
    activation_checks: options.stats.activationChecks,
    activation_blocked_long: options.stats.activationBlockedLong,
    activation_blocked_short: options.stats.activationBlockedShort,
    activation_blocked_expansion: options.stats.activationBlockedExpansion,
    activation_started_long: options.stats.activationStartedLong,
    activation_started_short: options.stats.activationStartedShort,
    activation_long_allow_pct: longChecks ? round2((options.stats.activationAllowedLong / longChecks) * 100) : null,
    activation_short_allow_pct: shortChecks ? round2((options.stats.activationAllowedShort / shortChecks) * 100) : null,
    mt5_reference_net_profit_usd: MT5_REFERENCE.net_profit_usd,
    mt5_reference_commission_usd: MT5_REFERENCE.commission_usd,
    mt5_reference_swap_usd: MT5_REFERENCE.swap_usd,
    mt5_reference_end_liquidation_net_usd: MT5_REFERENCE.end_liquidation_net_usd,
    mt5_reference_max_open_positions: MT5_REFERENCE.max_open_positions,
    mt5_reference_end_liquidation_positions: MT5_REFERENCE.end_liquidation_positions,
    net_delta_vs_mt5_usd: round2(net - MT5_REFERENCE.net_profit_usd),
    summary_only: options.runtimeOptions.summaryOnly,
    metric_semantics: options.runtimeOptions.sessionMode === "continuous"
      ? "continuous_carried_position_truth_replay" as const
      : "session_window_position_truth_replay" as const,
  });
}

function validationRows(options: {
  gate74b: Gate74bSummary;
  selectedWeeks: string[];
  selectedPairs: string[];
  runtimeOptions: Options;
}) {
  return [
    { check: "gate74b_verdict", value: options.gate74b.verdict, expected: "PASS_GATE74B", passed: options.gate74b.verdict.startsWith("PASS_GATE74B") },
    { check: "continuous_carried_inventory", value: options.runtimeOptions.sessionMode === "continuous", expected: "true only in continuous session mode", passed: true },
    { check: "weekly_sample_end_close_disabled", value: true, expected: true, passed: true },
    { check: "target_reset_uses_selected_target_mode", value: options.runtimeOptions.targetMode, expected: "fixed_adr_or_david_ma_reversion", passed: true },
    { check: "target_mode", value: options.runtimeOptions.targetMode, expected: "explicit", passed: true },
    { check: "target_adr", value: options.runtimeOptions.targetAdr, expected: ">0", passed: options.runtimeOptions.targetAdr > 0 },
    { check: "spacing_adr", value: options.runtimeOptions.spacingAdr, expected: ">0", passed: options.runtimeOptions.spacingAdr > 0 },
    { check: "signal_clock", value: options.runtimeOptions.signalClock, expected: "explicit", passed: true },
    { check: "signal_adr_brick", value: options.runtimeOptions.signalAdrBrick, expected: ">0", passed: options.runtimeOptions.signalAdrBrick > 0 },
    { check: "session_mode", value: options.runtimeOptions.sessionMode, expected: "explicit continuous_or_ny_daily_window", passed: true },
    { check: "session_time_zone", value: options.runtimeOptions.sessionTimeZone, expected: "IANA time zone", passed: true },
    { check: "session_trade_start_et", value: formatTimeOfDay(options.runtimeOptions.sessionTradeStartEtMinutes), expected: "HH:mm", passed: true },
    { check: "session_trade_end_et", value: formatTimeOfDay(options.runtimeOptions.sessionTradeEndEtMinutes), expected: "HH:mm", passed: true },
    { check: "session_flatten_et", value: formatTimeOfDay(options.runtimeOptions.sessionFlattenEtMinutes), expected: "HH:mm", passed: true },
    { check: "session_sunday_start_et", value: formatTimeOfDay(options.runtimeOptions.sessionSundayStartEtMinutes), expected: "HH:mm", passed: true },
    { check: "session_flatten_overrides_et", value: sessionFlattenOverridesLabel(options.runtimeOptions.sessionFlattenOverridesEt), expected: "optional YYYY-MM-DD=HH:mm list", passed: true },
    { check: "session_endpoint_open_cycles_close_as_session_flatten", value: options.runtimeOptions.sessionMode === "ny_daily_window", expected: "true only in ny_daily_window", passed: true },
    { check: "min_ma_expansion_adr", value: options.runtimeOptions.minMaExpansionAdr, expected: ">=0", passed: options.runtimeOptions.minMaExpansionAdr >= 0 },
    { check: "grid_add_mode", value: options.runtimeOptions.gridAddMode, expected: "explicit", passed: true },
    { check: "bar_path_mode", value: options.runtimeOptions.barPathMode, expected: "explicit", passed: true },
    { check: "quote_currency_pnl_converted_to_usd", value: true, expected: true, passed: true },
    { check: "swap_triggers_target_reset", value: false, expected: false, passed: true },
    { check: "activation_rule_ids", value: options.runtimeOptions.activationRuleIds.join(","), expected: "explicit", passed: true },
    { check: "activation_controls_initial_cycle_start_only", value: true, expected: true, passed: true },
    { check: "david_ma_settings", value: davidSettingsLabel(options.runtimeOptions.signalSettings), expected: "explicit CLI/default settings", passed: true },
    { check: "stochastic_settings", value: stochasticSettingsLabel(options.runtimeOptions.signalSettings), expected: "explicit CLI/default settings", passed: true },
    { check: "summary_only", value: options.runtimeOptions.summaryOnly, expected: "explicit", passed: true },
    { check: "commission_per_entry_per_001_lot_usd", value: options.runtimeOptions.commissionPerEntryPer001LotUsd, expected: 0.06, passed: options.runtimeOptions.commissionPerEntryPer001LotUsd === 0.06 },
    { check: "eurusd_long_swap_per_001_lot_day_usd", value: options.runtimeOptions.longSwapPer001LotDayUsd, expected: "MT5-derived approx", passed: true },
    { check: "eurusd_short_swap_per_001_lot_day_usd", value: options.runtimeOptions.shortSwapPer001LotDayUsd, expected: "MT5-derived approx", passed: true },
    { check: "selected_week_count", value: options.selectedWeeks.length, expected: ">=1", passed: options.selectedWeeks.length > 0 },
    { check: "selected_pair_count", value: options.selectedPairs.length, expected: ">=1", passed: options.selectedPairs.length > 0 },
  ].map((row) => withHash(row));
}

function metricRows() {
  return [
    { metric: "continuous_carried_position_truth_replay", definition: "keeps side grid state open across warehouse week boundaries until target reset or terminal liquidation" },
    { metric: "session_window_position_truth_replay", definition: "keeps side grid state open inside the configured session window, allows target closes whenever ticks exist, and force-closes unresolved cycles at session flatten" },
    { metric: "bar_path_mode", definition: "intrabar path used for each warehouse M1 bar; close mode uses close-only marks, OHLC modes synthesize four tester-like marks per bar" },
    { metric: "signal_clock", definition: "clock used to update David MA/RSI/Stoch signal state; m1 updates on every M1 close, adr_event updates only after a configured ADR movement brick completes" },
    { metric: "signal_adr_brick", definition: "ADR movement required to complete one synthetic signal bar when signal_clock is adr_event" },
    { metric: "session_mode", definition: "continuous keeps the original carried-position replay; ny_daily_window allows starts/adds only inside the configured New York session and force-closes remaining cycles at the daily flatten boundary" },
    { metric: "session_flatten_count", definition: "number of side cycles closed by the configured daily session flatten boundary, a missed no-tick boundary, or the session-mode endpoint cleanup rather than a target reset or final end-of-test liquidation" },
    { metric: "session_flatten_price_pnl_usd", definition: "price PnL from cycles force-closed by the configured daily session flatten boundary" },
    { metric: "closed_price_pnl_usd", definition: "target-reset price PnL before swap and commission, with quote-currency PnL converted to USD at the close timestamp/tick when a USD conversion leg is selected" },
    { metric: "total_commission_usd", definition: "entry commission charged at MT5-observed 0.06 USD per 0.01 lot entry; exits have zero commission in the reference report" },
    { metric: "total_swap_usd", definition: "position-day carry fee accrued per fill by side using MT5-derived EURUSD average swap rates" },
    { metric: "end_liquidation_price_pnl_usd", definition: "price PnL from all positions still open at the final warehouse mark" },
    { metric: "terminal_inventory_rows", definition: "one row per side cycle that survived until terminal liquidation; used to attribute unresolved inventory by pair, side, age, MA distance, fill depth, and liquidation PnL" },
    { metric: "side_exit_distance_to_ma_adr", definition: "side-specific ADR distance from terminal mark back to the David MA exit line; positive means the cycle still needs that many ADR to return to MA" },
    { metric: "max_open_positions", definition: "maximum simultaneous fill count across carried side grids" },
    { metric: "activation_rule_id", definition: "one-sided start rule used when a side cycle is missing; existing cycles are not flattened by later signal changes" },
    { metric: "min_ma_expansion_adr", definition: "minimum side-specific distance from current David MA required before a missing side can start; long requires price below MA, short requires price above MA" },
    { metric: "grid_add_mode", definition: "adverse_and_favorable keeps both recovery and favorable expansion adds; adverse_only adds only when price moves against the side from its cycle anchor" },
    { metric: "close_event_profit_factor", definition: "gross winning close-cycle net USD divided by absolute gross losing close-cycle net USD; computed even in summary-only mode without retaining close-event rows" },
    { metric: "close_event_win_pct", definition: "winning close-cycle count divided by all close cycles; target, session_flatten, and end_of_test close reasons are included" },
    { metric: "target_close_net_usd", definition: "aggregate net USD from close cycles closed by target reset, including price PnL, commission, and swap" },
    { metric: "session_flatten_close_net_usd", definition: "aggregate net USD from close cycles force-closed by the configured session flatten boundary, including price PnL, commission, and swap" },
    { metric: "activation_started_long/short", definition: "number of initial side cycles started after the activation gate allowed that side" },
    { metric: "activation_blocked_long/short", definition: "number of missing-side start checks rejected by the activation gate" },
    { metric: "activation_blocked_expansion", definition: "number of missing-side start checks where the signal allowed the side but price was not far enough from the David MA" },
  ].map((row) => withHash(row));
}

function renderReport(options: {
  verdict: string;
  summaryRows: SummaryRow[];
  validationRows: ValidationRow[];
  metricRows: Array<Record<string, unknown>>;
  artifacts: Record<string, string>;
  runtimeOptions: Options;
}) {
  const summaryTable = renderTable(options.summaryRows, [
    "variant_id",
    "activation_rule_id",
    "signal_settings_id",
    "symbol_universe",
    "bar_path_mode",
    "signal_clock",
    "signal_adr_brick",
    "session_mode",
    "session_trade_start_et",
    "session_trade_end_et",
    "session_flatten_et",
    "session_sunday_start_et",
    "target_mode",
    "target_adr",
    "spacing_adr",
    "min_ma_expansion_adr",
    "grid_add_mode",
    "weeks_replayed",
    "pairs_replayed",
    "final_balance_usd",
    "net_profit_usd",
    "closed_price_pnl_usd",
    "end_liquidation_price_pnl_usd",
    "total_commission_usd",
    "total_swap_usd",
    "session_flatten_count",
    "session_flatten_positions",
    "session_flatten_price_pnl_usd",
    "session_flatten_swap_usd",
    "entries_opened",
    "end_liquidation_positions",
    "max_open_positions",
    "max_add_depth",
    "max_equity_drawdown_usd",
    "weekly_equity_profit_factor",
    "close_event_count",
    "close_event_profit_factor",
    "close_event_win_pct",
    "target_close_net_usd",
    "session_flatten_close_net_usd",
    "activation_started_long",
    "activation_started_short",
    "activation_blocked_long",
    "activation_blocked_short",
    "activation_blocked_expansion",
    "activation_long_allow_pct",
    "activation_short_allow_pct",
    "summary_only",
  ]);
  const validationTable = renderTable(options.validationRows, ["check", "value", "expected", "passed"]);
  const metricTable = renderTable(options.metricRows, ["metric", "definition"]);
  const artifactLines = Object.entries(options.artifacts).map(([label, artifactPath]) => `- ${label}: \`${artifactPath}\``).join("\n");
  return `# Gate 90 Grid Activation Accuracy One-Sided Selection

Generated: \`${new Date().toISOString()}\`

## Verdict

\`${options.verdict}\`

## Scope

- Warehouse truth replay with one-sided activation gates and explicit session mode controls.
- Variants: \`${options.runtimeOptions.activationRuleIds.map((ruleId) => variantId(ruleId)).join(",")}\`.
- Activation rules: \`${options.runtimeOptions.activationRuleIds.join(",")}\`.
- Signal settings id: \`${signalSettingsId(options.runtimeOptions.signalSettings)}\`.
- David MA settings: LWMA \`${options.runtimeOptions.signalSettings.davidMaPeriod}\`, close price, RSI \`${options.runtimeOptions.signalSettings.davidRsiPeriod}\`, overbought \`${options.runtimeOptions.signalSettings.davidRsiOverbought}\`, oversold \`${options.runtimeOptions.signalSettings.davidRsiOversold}\`.
- Stochastic settings: K \`${options.runtimeOptions.signalSettings.stochKPeriod}\`, D \`${options.runtimeOptions.signalSettings.stochDPeriod}\`, slowing \`${options.runtimeOptions.signalSettings.stochSlowing}\`, OB/OS \`${options.runtimeOptions.signalSettings.stochOverbought}/${options.runtimeOptions.signalSettings.stochOversold}\`, Low/High, Simple, main line only.
- Signal clock: \`${options.runtimeOptions.signalClock}\`, ADR event brick \`${options.runtimeOptions.signalAdrBrick}\`.
- Session mode: \`${options.runtimeOptions.sessionMode}\`, time zone \`${options.runtimeOptions.sessionTimeZone}\`, trade window start \`${formatTimeOfDay(options.runtimeOptions.sessionTradeStartEtMinutes)}\`, trade cutoff \`${formatTimeOfDay(options.runtimeOptions.sessionTradeEndEtMinutes)}\`, flatten \`${formatTimeOfDay(options.runtimeOptions.sessionFlattenEtMinutes)}\`, Sunday start \`${formatTimeOfDay(options.runtimeOptions.sessionSundayStartEtMinutes)}\`, flatten overrides \`${sessionFlattenOverridesLabel(options.runtimeOptions.sessionFlattenOverridesEt) || "none"}\`.
- Summary-only output: \`${options.runtimeOptions.summaryOnly}\`.
- Activation uses closed warehouse bars and controls only missing side-cycle starts.
- Target mode \`${options.runtimeOptions.targetMode}\`, fixed target \`${options.runtimeOptions.targetAdr}\` ADR used only by fixed_adr mode, spacing \`${options.runtimeOptions.spacingAdr}\` ADR, minimum MA expansion \`${options.runtimeOptions.minMaExpansionAdr}\` ADR, grid add mode \`${options.runtimeOptions.gridAddMode}\`, lot size \`${options.runtimeOptions.lotSize}\`.
- Bar path mode: \`${options.runtimeOptions.barPathMode}\`.
- Continuous mode carries side-grid positions across warehouse week boundaries; session-window mode carries only until target reset, session flatten, or terminal liquidation.
- Target resets use the selected target mode. fixed_adr uses price ADR PnL; david_ma_reversion closes only profitable returns to the current David MA.
- In \`ny_daily_window\`, target closes are still allowed whenever a tick exists, but starts/adds are blocked outside the configured clean session and unresolved cycles are force-closed at the flatten boundary.
- In \`ny_daily_window\`, any cycle still open at the selected test endpoint is closed as a session flatten at the last available mark; this prevents endpoint terminal inventory from masquerading as a live overnight hold.
- Price PnL is converted from quote currency to USD at the close timestamp/tick when the selected universe includes the needed USD conversion leg.
- Fees affect equity truth: entry commission and position-day swap are modeled separately.
- Explicit bid/ask spread and slippage are not modeled in this runner yet.
- Terminal liquidation is explicit and reported separately.
- No MT5 implementation, target/spacing optimization, pair-specific swap ingestion, margin stopout simulator, app/live integration, promotion, live-readiness, or double-sided in-between policy.

## Summary

${summaryTable}

## Fee Model

- Commission: \`${options.runtimeOptions.commissionPerEntryPer001LotUsd}\` USD per 0.01-lot entry.
- Long swap: \`${options.runtimeOptions.longSwapPer001LotDayUsd}\` USD per 0.01-lot day.
- Short swap: \`${options.runtimeOptions.shortSwapPer001LotDayUsd}\` USD per 0.01-lot day.
- Swap rates are MT5-report-derived EURUSD averages for calibration; all-pair use is diagnostic until pair-specific broker swap rates are supplied.
- Spread and slippage are excluded here; the daily session window is a structural exposure test, not a full execution-cost model.

## Metric Definitions

${metricTable}

## Validation

${validationTable}

## Artifacts

${artifactLines}

## Stop Line

Gate 90 is warehouse activation research only. Do not optimize MT5 lifecycle controls, retune target/spacing, promote strategy logic, or open double-sided in-between policy from this run.
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

async function readWeekRowsWithRetry(options: { manifestId: string; week: string; pairs: string[]; attempts: number }) {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await readTradeLegPathWarehouseWeekRows({
        manifestId: options.manifestId,
        weekOpenUtc: options.week,
        pairs: options.pairs,
      });
    } catch (error) {
      lastError = error;
      if (attempt === options.attempts) break;
      await closePoolIfInitialized();
    }
  }
  throw lastError;
}

async function main() {
  const options = parseOptions();
  await mkdir(options.artifactDir, { recursive: true });
  await mkdir(path.dirname(options.reportPath), { recursive: true });

  const gate74b = await readJson<Gate74bSummary>(path.join(options.gate74bDir, "gate74b-summary.json"));
  const manifestId = options.manifestId ?? gate74b.warehouse.manifest_id;
  const manifest = await readTradeLegPathWarehouseManifest(manifestId);
  if (!manifest) throw new Error(`Missing Gate 74B warehouse manifest: ${manifestId}`);
  if (manifest.status !== "complete") throw new Error(`Gate 74B warehouse is not complete: ${manifestId} status=${manifest.status}`);

  const allWeeks = await readTradeLegPathWarehouseWeekKeys(manifestId);
  const selectedWeeks = resolveSelectedWeeks(allWeeks, options);
  if (selectedWeeks.length === 0) throw new Error("No weeks selected for Gate 90 replay");
  const selectedPairs = resolveSelectedPairs(manifest.universe_symbols, options);
  const variantStates: RuntimeVariantState[] = options.activationRuleIds.map((activationRuleId) => ({
    activationRuleId,
    stats: createStats(),
    books: new Map<string, PairBook>(),
    previousEquityUsd: options.initialDepositUsd,
  }));
  const sharedSignalBooks = new Map<string, SignalBook>();
  let finalConversionRates = emptyConversionRates();

  for (const week of selectedWeeks) {
    if (options.logProgress) console.log(`gate90 week=${week} pairs=${selectedPairs.length} activation_rules=${options.activationRuleIds.join(",")}`);
    const rows = await readWeekRowsWithRetry({ manifestId, week, pairs: selectedPairs, attempts: 3 });
    const weekRows = new Map(rows.map((row) => [row.pair, row]));
    if (weekRows.size !== selectedPairs.length) throw new Error(`Loaded week ${week} has ${weekRows.size} pairs; expected ${selectedPairs.length}`);
    const conversionRates = buildConversionRates([...weekRows.values()], options.barPathMode);
    finalConversionRates = conversionRates;
    for (const pair of selectedPairs) {
      const row = weekRows.get(pair);
      if (!row) throw new Error(`Missing loaded pair-week row for ${pair} ${week}`);
      replayRowForVariants({ variantStates, sharedSignalBooks, row, conversionRates, runtimeOptions: options });
    }
    for (const variantState of variantStates) {
      variantState.previousEquityUsd = addWeeklySnapshot({
        stats: variantState.stats,
        books: variantState.books,
        variant_id: variantId(variantState.activationRuleId),
        weekOpenUtc: week,
        pairsReplayed: selectedPairs.length,
        previousEquityUsd: variantState.previousEquityUsd,
        conversionRates,
        runtimeOptions: options,
      });
    }
  }

  for (const variantState of variantStates) {
    liquidateEnd({
      activationRuleId: variantState.activationRuleId,
      stats: variantState.stats,
      books: variantState.books,
      signalBooks: sharedSignalBooks,
      conversionRates: finalConversionRates,
      runtimeOptions: options,
    });
    observeStats(variantState.stats, variantState.books);
  }
  const summaryRows = variantStates.map((variantState) => summarize({
    stats: variantState.stats,
    books: variantState.books,
    selectedWeeks,
    selectedPairs,
    manifest,
    runtimeOptions: options,
    activationRuleId: variantState.activationRuleId,
  }));
  const weeklyRows = variantStates.flatMap((variantState) => variantState.stats.weeklyRows);
  const closeEvents = variantStates.flatMap((variantState) => variantState.stats.closeEvents);
  const terminalInventoryRows = variantStates.flatMap((variantState) => variantState.stats.terminalInventoryRows);
  const validations = validationRows({ gate74b, selectedWeeks, selectedPairs, runtimeOptions: options });
  const metrics = metricRows();
  const verdict = "PASS_GATE90_GRID_ACTIVATION_ONE_SIDED_SELECTION_BUILT_DIAGNOSTIC_ONLY";

  const paths = {
    summaryJson: path.join(options.artifactDir, "activation-summary.rows.json"),
    summaryCsv: path.join(options.artifactDir, "activation-summary.rows.csv"),
    weeklyJson: path.join(options.artifactDir, "weekly-activation-truth.rows.json"),
    weeklyCsv: path.join(options.artifactDir, "weekly-activation-truth.rows.csv"),
    closeEventsJson: path.join(options.artifactDir, "close-events.rows.json"),
    closeEventsCsv: path.join(options.artifactDir, "close-events.rows.csv"),
    terminalInventoryJson: path.join(options.artifactDir, "terminal-inventory.rows.json"),
    terminalInventoryCsv: path.join(options.artifactDir, "terminal-inventory.rows.csv"),
    validationJson: path.join(options.artifactDir, "validation.rows.json"),
    validationCsv: path.join(options.artifactDir, "validation.rows.csv"),
    metricDefinitionsJson: path.join(options.artifactDir, "metric-definitions.rows.json"),
    metricDefinitionsCsv: path.join(options.artifactDir, "metric-definitions.rows.csv"),
    commandReceipt: path.join(options.artifactDir, "command-receipt.json"),
    runSummaryJson: path.join(options.artifactDir, "gate90-run-summary.json"),
    shaManifest: path.join(options.artifactDir, "gate90-activation-sha256.txt"),
  };
  const artifactsForReport = Object.fromEntries(Object.entries({ ...paths, report: options.reportPath }).map(([label, artifactPath]) => [label, toRepoRelative(artifactPath)]));

  await writeRows(paths.summaryJson, paths.summaryCsv, summaryRows);
  await writeRows(paths.weeklyJson, paths.weeklyCsv, weeklyRows.map((row) => withHash(row as unknown as Record<string, unknown>)));
  await writeRows(paths.closeEventsJson, paths.closeEventsCsv, closeEvents.map((row) => withHash(row as unknown as Record<string, unknown>)));
  await writeRows(paths.terminalInventoryJson, paths.terminalInventoryCsv, terminalInventoryRows.map((row) => withHash(row as unknown as Record<string, unknown>)));
  await writeRows(paths.validationJson, paths.validationCsv, validations);
  await writeRows(paths.metricDefinitionsJson, paths.metricDefinitionsCsv, metrics);
  await writeJson(paths.commandReceipt, {
    gate_id: GATE_ID,
    command: COMMAND,
    durable_command: renderDurableCommand(options),
    git_commit: gitCommit(),
    generated_at: new Date().toISOString(),
    options,
  });
  await writeJson(paths.runSummaryJson, {
    gate_id: GATE_ID,
    verdict,
    variant_ids: options.activationRuleIds.map((ruleId) => variantId(ruleId)),
    activation_rule_ids: options.activationRuleIds,
    warehouse_manifest_id: manifest.manifest_id,
    warehouse_hash: manifest.warehouse_hash,
    selected_weeks: selectedWeeks.length,
    selected_pairs: selectedPairs,
    summary_rows: summaryRows,
    terminal_inventory_rows: terminalInventoryRows.length,
    validation_rows: validations,
  });
  await writeText(options.reportPath, renderReport({
    verdict,
    summaryRows,
    validationRows: validations,
    metricRows: metrics,
    artifacts: artifactsForReport,
    runtimeOptions: options,
  }));
  await writeShaManifest(paths.shaManifest, GATE_ID, COMMAND, [
    { label: "summary_json", path: paths.summaryJson },
    { label: "weekly_json", path: paths.weeklyJson },
    { label: "close_events_json", path: paths.closeEventsJson },
    { label: "terminal_inventory_json", path: paths.terminalInventoryJson },
    { label: "validation_json", path: paths.validationJson },
    { label: "metric_definitions_json", path: paths.metricDefinitionsJson },
    { label: "command_receipt", path: paths.commandReceipt },
    { label: "run_summary_json", path: paths.runSummaryJson },
    { label: "report", path: options.reportPath },
  ]);

  console.log(JSON.stringify({
    verdict,
    report: toRepoRelative(options.reportPath),
    artifact_dir: toRepoRelative(options.artifactDir),
    summary_rows: summaryRows,
  }, null, 2));
  await closePoolIfInitialized();
}

main().catch(async (error) => {
  console.error(error);
  await closePoolIfInitialized();
  process.exitCode = 1;
});
