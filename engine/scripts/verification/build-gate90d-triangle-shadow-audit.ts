import { mkdir } from "node:fs/promises";
import path from "node:path";

import { DateTime } from "luxon";

import { closePoolIfInitialized } from "@database/db/client";
import { sha256Stable } from "@engine/research/hash";
import {
  readTradeLegPathWarehouseManifest,
  readTradeLegPathWarehouseWeekKeys,
  readTradeLegPathWarehouseWeekRows,
  type TradeLegPathReplayPairWeek,
} from "@engine/research/tradeLegPathWarehouse";

import {
  gitCommit,
  parseArgMap,
  readJson,
  renderTable,
  round,
  toRepoRelative,
  writeJson,
  writeShaManifest,
  writeText,
} from "./gate65-utils";

const GATE_ID = "Gate 90D: triangle-reversion-grid-shadow-audit";
const GATE_DATE = "2026-07-03";
const COMMAND = "npm run engine:gate90d:triangle-shadow-audit";
const DEFAULT_MANIFEST_ID = "gate74b_trade_leg_path_ECDE7C4A6553";
const DEFAULT_WEEK_FROM = "2022-01-10T00:00:00.000Z";
const DEFAULT_WEEK_LIMIT = 5;
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate90/artifacts/gate90d-design-question-diagnostic-oos4-5w";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate90/GATE90D_FEATURE_LEDGER_DESIGN_QUESTION_DIAGNOSTIC_${GATE_DATE}.md`;
const DEFAULT_CLOSE_EVENTS_CSV =
  "docs/research/gates/gate90/artifacts/gate90d-start-trace-oos4-refresh/close-events.rows.csv";
const FORMULA_ID = "gate90d_ltrg_feature_ledger_design_question_diagnostic_2026_07_03";
const PATH_EFFICIENCY_LOW_MAX = 0.35;
const PATH_EFFICIENCY_HIGH_MIN = 0.65;
const RANGE_FLOOR_MIN_ADR = 0.5;
const RANGE_FLOOR_QUANTUM_MULTIPLE = 3;
const RANGE_EXPANDED_MIN_RATIO = 1.1;
const RANGE_COMPRESSED_MAX_RATIO = 0.9;
const COST_FLOOR_MULTIPLE = 8;
const SPACING_FORMULA_ID = "gate90d_range_box_slots_cost_clamped_v0";
const DEFAULT_TARGET_GRID_SLOTS = 3;
const DEFAULT_MIN_SPACING_ADR = 0.2;
const DEFAULT_MAX_SPACING_ADR = 0.3;
const DEFAULT_MIN_SIGNAL_BRICK_ADR = 0.0125;
const DEFAULT_MAX_SIGNAL_BRICK_ADR = 0.075;
const START_MODE_GEOMETRY_BASIS = "adr_event_harvestable_chop_candidate";
const DAVID_DIAGNOSTIC_SETTINGS = {
  maPeriod: 50,
  rsiPeriod: 50,
  rsiOverbought: 60,
  rsiOversold: 40,
  signalClock: "adr_event",
  signalAdrBrick: 0.1,
} as const;

type Side = "LONG" | "SHORT";
type DavidState = "UP" | "DOWN";
type StartModeId =
  | "strict_sweep_rejection_displacement"
  | "relaxed_sweep_rejection"
  | "first_mean_extension_touch"
  | "candidate_b_geometry_start"
  | "david_contra_geometry_start";
type ReplayRow = Pick<
  TradeLegPathReplayPairWeek,
  "week_open_utc" | "pair" | "candidate_b_side" | "pair_adr_pct" | "entry_price" | "path_payload"
>;

type Options = {
  manifestId: string;
  artifactDir: string;
  reportPath: string;
  weekFrom: string;
  weekTo: string | null;
  weekLimit: number;
  pairs: string[] | null;
  signalAdrBrick: number;
  gridQuantumAdr: number;
  targetGridSlots: number;
  minSpacingAdr: number;
  maxSpacingAdr: number;
  allInCostAdr: number;
  costFloorMultiple: number;
  closeEventsCsv: string | null;
  lockQuantumAdr: number;
  logProgress: boolean;
};

type Bar = {
  index: number;
  timestamp_utc: string;
  timestamp_ms: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type SessionWindow = {
  id: string;
  boxModel: "archived_utc" | "ny_clean_et";
  session: "NY" | "ASIA_LONDON";
  rangeStartMs: number;
  rangeEndMs: number;
  entryStartMs: number;
  entryEndMs: number;
};

type TriggerCandidateRow = {
  row_key: string;
  week_open_utc: string;
  pair: string;
  candidate_b_side: Side;
  trigger_side: Side;
  candidate_b_alignment: number;
  candidate_b_contra_alignment: number;
  session_id: string;
  session_label: string;
  range_start_utc: string;
  range_end_utc: string;
  entry_start_utc: string;
  entry_end_utc: string;
  session_range_adr: number | null;
  entry_path_efficiency: number | null;
  entry_range_adr: number | null;
  path_efficiency_week: number | null;
  range_ratio_pair: number | null;
  efficiency_bucket: string;
  range_floor_adr: number;
  range_condition_pass: boolean | null;
  range_expansion_bucket: string;
  geometry_regime: string;
  geometry_harvestable_candidate: boolean;
  grid_quantum_adr: number;
  signal_adr_brick: number;
  adaptive_spacing_formula_id: string;
  adaptive_spacing_raw_adr: number | null;
  adaptive_spacing_adr: number | null;
  adaptive_spacing_range_floor_adr: number | null;
  adaptive_range_condition_pass: boolean | null;
  adaptive_signal_adr_brick: number | null;
  adaptive_spacing_tradability_pass: boolean | null;
  sweep_timestamp_utc: string;
  rejection_timestamp_utc: string;
  displacement_timestamp_utc: string;
  sweep_depth_adr: number;
  sweep_required_adr: number;
  displacement_body_adr: number;
  displacement_required_adr: number;
  sweep_to_entry_bars: number;
  signal_form: "1_BAR" | "2_BAR";
  bb_sweep_context: boolean | null;
  family_alignment_context: number | null;
  base_currency_strength: number | null;
  quote_currency_strength: number | null;
  content_hash: string;
};

type PairWeekFeatureRow = {
  row_key: string;
  week_open_utc: string;
  pair: string;
  candidate_b_side: Side;
  path_efficiency_week: number | null;
  week_range_adr: number | null;
  range_ratio_pair: number | null;
  efficiency_bucket: "low" | "mid" | "high" | "unknown";
  range_floor_adr: number;
  range_condition_pass: boolean | null;
  range_expansion_bucket: "compressed" | "normal" | "expanded" | "unknown";
  geometry_regime: string;
  geometry_harvestable_candidate: boolean;
  all_in_cost_adr: number | null;
  cost_floor_multiple: number;
  cost_floor_quantum_adr: number | null;
  cost_safe_quantum_pass: boolean | null;
  grid_quantum_adr: number;
  signal_adr_brick: number;
  adaptive_spacing_formula_id: string;
  adaptive_spacing_raw_adr: number | null;
  adaptive_spacing_adr: number | null;
  adaptive_spacing_range_floor_adr: number | null;
  adaptive_range_condition_pass: boolean | null;
  adaptive_signal_adr_brick: number | null;
  adaptive_spacing_tradability_pass: boolean | null;
  trigger_candidates: number;
  long_trigger_candidates: number;
  short_trigger_candidates: number;
  first_trigger_timestamp_utc: string | null;
  family_alignment_long_context: number | null;
  family_alignment_short_context: number | null;
  content_hash: string;
};

type SessionGeometryRow = {
  row_key: string;
  week_open_utc: string;
  pair: string;
  candidate_b_side: Side;
  session_id: string;
  session_label: string;
  range_start_utc: string;
  range_end_utc: string;
  entry_start_utc: string;
  entry_end_utc: string;
  session_range_adr: number | null;
  entry_path_efficiency: number | null;
  entry_range_adr: number | null;
  range_ratio_pair: number | null;
  efficiency_bucket: "low" | "mid" | "high" | "unknown";
  range_floor_adr: number;
  range_condition_pass: boolean | null;
  range_expansion_bucket: "compressed" | "normal" | "expanded" | "unknown";
  geometry_regime: string;
  geometry_harvestable_candidate: boolean;
  adaptive_spacing_formula_id: string;
  adaptive_spacing_raw_adr: number | null;
  adaptive_spacing_adr: number | null;
  adaptive_spacing_range_floor_adr: number | null;
  adaptive_range_condition_pass: boolean | null;
  adaptive_signal_adr_brick: number | null;
  adaptive_spacing_tradability_pass: boolean | null;
  trigger_candidates: number;
  long_trigger_candidates: number;
  short_trigger_candidates: number;
  content_hash: string;
};

type LockShadowRow = {
  row_key: string;
  source_close_events_csv: string;
  variant_id: string;
  pair: string;
  side: Side;
  close_reason: string;
  close_timestamp_utc: string;
  anchor_week_open_utc: string;
  fill_count: number;
  adverse_fill_count: number;
  price_pnl_adr: number;
  min_pnl_adr: number;
  max_pnl_adr: number;
  cycle_quantum_adr: number;
  mfe_units: number | null;
  lockout_1q_add_block: boolean;
  lockout_2q_add_block: boolean;
  lock_floor_adr: number | null;
  lock_shadow_state: "no_lock_mfe" | "protected_or_above_floor" | "would_have_preserved_mfe";
  shadow_preserved_adr: number;
  profit_stop_receipt_mode: "receipt_only";
  profit_stop_floor_adr: number | null;
  profit_stop_shadow_preserved_adr: number;
  content_hash: string;
};

type DesignQuestionDiagnosticRow = {
  row_key: string;
  question_scope: "path_efficiency_box_heat_alignment_centerline";
  week_open_utc: string;
  pair: string;
  candidate_b_side: Side;
  box_model: "archived_utc" | "ny_clean_et";
  session_id: string;
  session_label: string;
  range_start_utc: string;
  range_end_utc: string;
  entry_start_utc: string;
  entry_end_utc: string;
  session_range_adr: number | null;
  pe_m1_1_session: number | null;
  pe_adr_event_1_session: number | null;
  pe_m1_5_session_avg: number | null;
  pe_m1_fast_slow_ema: number | null;
  entry_range_adr: number | null;
  range_condition_pass: boolean | null;
  geometry_regime_m1: string;
  geometry_harvestable_candidate_m1: boolean;
  archived_utc_trigger_candidates: number;
  centerline_only_blocked_candidate: boolean;
  centerline_only_diagnostic_status: "blocked_diagnostic_only" | "not_applicable";
  neutral_alignment_allow_distance_adr: number | null;
  neutral_alignment_penalty_distance_adr: number | null;
  pair_heat: number | null;
  account_heat: number | null;
  selected_heat: number | null;
  heat_formula: "max_pair_account";
  profit_stop_mode: "receipt_only";
  content_hash: string;
};

type DavidDiagnosticSnapshot = {
  timestamp_utc: string | null;
  david_state: DavidState | null;
  david_raw_state: DavidState | null;
  david_ma: number | null;
  rsi: number | null;
};

type StartModeDiagnosticRow = {
  row_key: string;
  question_scope: "start_mode_inside_valid_geometry";
  week_open_utc: string;
  pair: string;
  candidate_b_side: Side;
  box_model: "archived_utc" | "ny_clean_et";
  session_id: string;
  session_label: string;
  start_mode_id: StartModeId;
  start_status: "found" | "blocked_no_start" | "blocked_no_david_side";
  start_side: Side | null;
  start_timestamp_utc: string | null;
  trigger_basis:
    | "strict_katarakti"
    | "sweep_rejection"
    | "session_mid_extension"
    | "candidate_b_session_mid_extension"
    | "david_contra_session_mid_extension";
  valid_geometry_basis: typeof START_MODE_GEOMETRY_BASIS;
  geometry_regime_m1: string;
  geometry_regime_adr_event: string;
  geometry_harvestable_candidate_m1: boolean;
  geometry_harvestable_candidate_adr_event: boolean;
  session_range_adr: number | null;
  pe_m1_1_session: number | null;
  pe_adr_event_1_session: number | null;
  entry_range_adr: number | null;
  adaptive_spacing_adr: number | null;
  required_extension_adr: number | null;
  session_mid_price: number | null;
  start_price: number | null;
  start_distance_from_mid_adr: number | null;
  start_delay_minutes_from_entry_start: number | null;
  relaxed_sweep_rejection_candidates: number;
  strict_sweep_rejection_displacement_candidates: number;
  candidate_b_alignment: number | null;
  david_alignment: number | null;
  david_state_at_start: DavidState | null;
  david_raw_state_at_start: DavidState | null;
  david_ma_at_start: number | null;
  david_rsi_at_start: number | null;
  sweep_timestamp_utc: string | null;
  rejection_timestamp_utc: string | null;
  displacement_timestamp_utc: string | null;
  sweep_depth_adr: number | null;
  displacement_body_adr: number | null;
  eod_flatten_timestamp_utc: string | null;
  eod_mfe_adr: number | null;
  eod_mae_adr: number | null;
  eod_mfe_quantum_units: number | null;
  eod_mfe_timestamp_utc: string | null;
  eod_mae_timestamp_utc: string | null;
  eod_close_pnl_adr: number | null;
  eod_hit_1q: boolean | null;
  eod_hit_2q: boolean | null;
  eod_hit_3q: boolean | null;
  next_day_flatten_timestamp_utc: string | null;
  next_day_mfe_adr: number | null;
  next_day_mae_adr: number | null;
  next_day_mfe_quantum_units: number | null;
  next_day_close_pnl_adr: number | null;
  next_day_hit_1q: boolean | null;
  next_day_hit_2q: boolean | null;
  next_day_hit_3q: boolean | null;
  full_available_mfe_adr: number | null;
  full_available_mae_adr: number | null;
  full_available_mfe_quantum_units: number | null;
  hold_until_profit_first_positive_timestamp_utc: string | null;
  hold_until_profit_first_1q_timestamp_utc: string | null;
  hold_until_profit_first_2q_timestamp_utc: string | null;
  hold_until_profit_first_3q_timestamp_utc: string | null;
  content_hash: string;
};

type StartModeSummaryRow = {
  box_model: "archived_utc" | "ny_clean_et";
  start_mode_id: StartModeId;
  valid_geometry_sessions: number;
  found_starts: number;
  blocked_no_start: number;
  blocked_no_david_side: number;
  long_starts: number;
  short_starts: number;
  candidate_b_aligned_starts: number;
  david_aligned_starts: number;
  avg_pe_m1_1_session: number | null;
  avg_pe_adr_event_1_session: number | null;
  avg_session_range_adr: number | null;
  avg_adaptive_spacing_adr: number | null;
  avg_start_delay_minutes: number | null;
  avg_start_distance_from_mid_adr: number | null;
  avg_eod_mfe_adr: number | null;
  avg_eod_mae_adr: number | null;
  eod_hit_1q_starts: number;
  eod_hit_2q_starts: number;
  eod_hit_3q_starts: number;
  avg_next_day_mfe_adr: number | null;
  avg_next_day_mae_adr: number | null;
  next_day_hit_1q_starts: number;
  next_day_hit_2q_starts: number;
  next_day_hit_3q_starts: number;
  avg_full_available_mfe_adr: number | null;
  full_available_hit_1q_starts: number;
  full_available_hit_2q_starts: number;
  full_available_hit_3q_starts: number;
  content_hash: string;
};

type StartTraceabilityRow = {
  row_key: string;
  source_close_events_csv: string;
  variant_id: string;
  activation_rule_id: string;
  cycle_id: string;
  pair: string;
  side: Side;
  close_reason: string;
  anchor_week_open_utc: string;
  start_timestamp_utc: string | null;
  close_timestamp_utc: string;
  fill_count: number;
  price_pnl_adr: number | null;
  price_pnl_usd: number | null;
  commission_usd: number | null;
  swap_usd: number | null;
  net_usd: number | null;
  min_pnl_adr: number | null;
  max_pnl_adr: number | null;
  geometry_source: "matched_trigger_session" | "pair_week_fallback" | "none";
  geometry_regime: string | null;
  range_condition_pass: boolean | null;
  geometry_harvestable_candidate: boolean | null;
  matched_trigger_row_key: string | null;
  matched_trigger_displacement_timestamp_utc: string | null;
  minutes_from_trigger_to_start: number | null;
  start_trace_status:
    | "missing_start_timestamp"
    | "invalid_start_timestamp"
    | "matched_prior_trigger"
    | "no_in_session_trigger";
  content_hash: string;
};

type StartTraceabilityVariantSummaryRow = {
  variant_id: string;
  activation_rule_id: string;
  start_trace_status: StartTraceabilityRow["start_trace_status"];
  rows: number;
  session_flatten_rows: number;
  target_rows: number;
  net_usd: number | null;
  avg_net_usd: number | null;
  gross_profit_usd: number | null;
  gross_loss_abs_usd: number | null;
  profit_factor: number | null;
  win_pct: number | null;
  avg_price_pnl_adr: number | null;
  avg_max_pnl_adr: number | null;
  avg_minutes_from_trigger_to_start: number | null;
  content_hash: string;
};

type StartTraceabilityGeometrySummaryRow = {
  start_trace_status: StartTraceabilityRow["start_trace_status"];
  geometry_source: StartTraceabilityRow["geometry_source"];
  geometry_regime: string;
  range_condition_pass: boolean | null;
  geometry_harvestable_candidate: boolean | null;
  rows: number;
  session_flatten_rows: number;
  target_rows: number;
  net_usd: number | null;
  avg_net_usd: number | null;
  gross_profit_usd: number | null;
  gross_loss_abs_usd: number | null;
  profit_factor: number | null;
  win_pct: number | null;
  avg_price_pnl_adr: number | null;
  avg_max_pnl_adr: number | null;
  avg_minutes_from_trigger_to_start: number | null;
  content_hash: string;
};

type GeometryRegimeSummaryRow = {
  geometry_regime: string;
  pair_weeks: number;
  trigger_candidates: number;
  long_trigger_candidates: number;
  short_trigger_candidates: number;
  avg_path_efficiency_week: number | null;
  avg_week_range_adr: number | null;
  avg_range_ratio_pair: number | null;
  avg_adaptive_spacing_adr: number | null;
  range_condition_pass_pair_weeks: number;
  adaptive_range_condition_pass_pair_weeks: number;
  harvestable_candidate_pair_weeks: number;
  content_hash: string;
};

type SessionGeometryRegimeSummaryRow = {
  geometry_regime: string;
  sessions: number;
  trigger_candidates: number;
  long_trigger_candidates: number;
  short_trigger_candidates: number;
  avg_entry_path_efficiency: number | null;
  avg_session_range_adr: number | null;
  avg_entry_range_adr: number | null;
  avg_adaptive_spacing_adr: number | null;
  range_condition_pass_sessions: number;
  adaptive_range_condition_pass_sessions: number;
  harvestable_candidate_sessions: number;
  content_hash: string;
};

type StartTraceabilitySummaryRow = {
  start_trace_status: StartTraceabilityRow["start_trace_status"];
  rows: number;
  session_flatten_rows: number;
  target_rows: number;
  net_usd: number | null;
  avg_net_usd: number | null;
  gross_profit_usd: number | null;
  gross_loss_abs_usd: number | null;
  profit_factor: number | null;
  win_pct: number | null;
  avg_minutes_from_trigger_to_start: number | null;
  content_hash: string;
};

type SummaryRow = {
  scope: string;
  rows: number;
  weeks: number | null;
  pairs: number | null;
  trigger_candidates?: number;
  pairs_with_trigger?: number;
  long_triggers?: number;
  short_triggers?: number;
  lock_shadow_rows?: number;
  lock_preserve_candidates?: number;
  shadow_preserved_adr?: number | null;
  content_hash: string;
};

type TriggerContextSummaryRow = {
  bucket: string;
  trigger_candidates: number;
  distinct_pair_weeks: number;
  long_triggers: number;
  short_triggers: number;
  bb_true: number;
  family_positive: number;
  candidate_b_aligned: number;
  candidate_b_contra_aligned: number;
  content_hash: string;
};

type LockVariantSummaryRow = {
  variant_id: string;
  close_reason: string;
  rows: number;
  preserve_candidates: number;
  shadow_preserved_adr: number;
  avg_shadow_preserved_adr: number | null;
  no_lock_mfe_rows: number;
  protected_or_above_floor_rows: number;
  content_hash: string;
};

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function writeRows(basePath: string, rows: Record<string, unknown>[]) {
  await writeJson(`${basePath}.json`, rows);
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const csv = rows.length
    ? [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n")
    : "";
  await writeText(`${basePath}.csv`, csv ? `${csv}\n` : "");
}

function withHash<T extends Record<string, unknown>>(row: T): T & { content_hash: string } {
  const clean = { ...row };
  delete clean.content_hash;
  return { ...row, content_hash: sha256Stable(clean) };
}

function parseOptions(): Options {
  const args = parseArgMap();
  const pairsRaw = args.get("--pairs")?.trim();
  const closeEventsRaw = args.get("--close-events-csv");
  return {
    manifestId: args.get("--manifest-id") ?? DEFAULT_MANIFEST_ID,
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    weekFrom: args.get("--week-from") ?? DEFAULT_WEEK_FROM,
    weekTo: args.get("--week-to") ?? null,
    weekLimit: Number(args.get("--week-limit") ?? DEFAULT_WEEK_LIMIT),
    pairs: pairsRaw ? pairsRaw.split(",").map((pair) => pair.trim().toUpperCase()).filter(Boolean) : null,
    signalAdrBrick: Number(args.get("--signal-adr-brick") ?? 0.05),
    gridQuantumAdr: Number(args.get("--grid-quantum-adr") ?? 0.2),
    targetGridSlots: Number(args.get("--target-grid-slots") ?? DEFAULT_TARGET_GRID_SLOTS),
    minSpacingAdr: Number(args.get("--min-spacing-adr") ?? DEFAULT_MIN_SPACING_ADR),
    maxSpacingAdr: Number(args.get("--max-spacing-adr") ?? DEFAULT_MAX_SPACING_ADR),
    allInCostAdr: Number(args.get("--all-in-cost-adr") ?? 0),
    costFloorMultiple: Number(args.get("--cost-floor-multiple") ?? COST_FLOOR_MULTIPLE),
    closeEventsCsv: closeEventsRaw === "none" ? null : closeEventsRaw ?? DEFAULT_CLOSE_EVENTS_CSV,
    lockQuantumAdr: Number(args.get("--lock-quantum-adr") ?? args.get("--grid-quantum-adr") ?? 0.2),
    logProgress: args.get("--log-progress") === "1" || args.get("--log-progress") === "true",
  };
}

function iso(ms: number) {
  return new Date(ms).toISOString();
}

function dayStartMs(timestampMs: number) {
  const date = new Date(timestampMs);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function markPriceFromDirectedAdr(row: ReplayRow, directedAdr: number) {
  if (row.entry_price === null || row.entry_price <= 0) throw new Error(`Missing entry price for ${row.week_open_utc} ${row.pair}`);
  const signedPct = (directedAdr * row.pair_adr_pct) / 100;
  return row.candidate_b_side === "LONG"
    ? row.entry_price * (1 + signedPct)
    : row.entry_price * (1 - signedPct);
}

function barsFromRow(row: ReplayRow): Bar[] {
  const bars: Bar[] = [];
  for (let index = 0; index < row.path_payload.timestamp_utc.length; index += 1) {
    const values = [
      markPriceFromDirectedAdr(row, row.path_payload.directed_open_adr[index]!),
      markPriceFromDirectedAdr(row, row.path_payload.directed_high_adr[index]!),
      markPriceFromDirectedAdr(row, row.path_payload.directed_low_adr[index]!),
      markPriceFromDirectedAdr(row, row.path_payload.directed_close_adr[index]!),
    ];
    bars.push({
      index,
      timestamp_utc: row.path_payload.timestamp_utc[index]!,
      timestamp_ms: Date.parse(row.path_payload.timestamp_utc[index]!),
      open: values[0]!,
      high: Math.max(...values),
      low: Math.min(...values),
      close: values[3]!,
    });
  }
  return bars;
}

function priceMoveAdr(row: ReplayRow, from: number, to: number) {
  if (row.entry_price === null || row.entry_price <= 0 || row.pair_adr_pct <= 0) return null;
  return ((to - from) / row.entry_price) * 100 / row.pair_adr_pct;
}

function rangeAdr(row: ReplayRow, high: number, low: number) {
  if (row.entry_price === null || row.entry_price <= 0 || row.pair_adr_pct <= 0) return null;
  return ((high - low) / row.entry_price) * 100 / row.pair_adr_pct;
}

function pathEfficiency(bars: Bar[]) {
  if (bars.length < 2) return null;
  const signal = Math.abs(bars.at(-1)!.close - bars[0]!.close);
  let noise = 0;
  for (let index = 1; index < bars.length; index += 1) noise += Math.abs(bars[index]!.close - bars[index - 1]!.close);
  return noise > 0 ? signal / noise : null;
}

function adrEventBars(row: ReplayRow, bars: Bar[], brickAdr: number) {
  if (!bars.length || brickAdr <= 0) return bars;
  const sampled: Bar[] = [bars[0]!];
  let lastClose = bars[0]!.close;
  for (const bar of bars.slice(1)) {
    const movedAdr = Math.abs(priceMoveAdr(row, lastClose, bar.close) ?? 0);
    if (movedAdr >= brickAdr) {
      sampled.push(bar);
      lastClose = bar.close;
    }
  }
  return sampled;
}

function closePriceMoveAdr(from: number, to: number, pairAdrPct: number) {
  if (from <= 0 || pairAdrPct <= 0) return 0;
  return ((to - from) / from) * 100 / pairAdrPct;
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

type DavidDiagnosticBook = {
  bars: Bar[];
  prevClose: number | null;
  rsiWarm: Array<{ gain: number; loss: number }>;
  rsiAvgGain: number | null;
  rsiAvgLoss: number | null;
  lastRsi: number | null;
  davidState: DavidState | null;
  davidRawState: DavidState | null;
  eventOpen: number | null;
  lastSignal: DavidDiagnosticSnapshot;
};

function createDavidDiagnosticBook(): DavidDiagnosticBook {
  return {
    bars: [],
    prevClose: null,
    rsiWarm: [],
    rsiAvgGain: null,
    rsiAvgLoss: null,
    lastRsi: null,
    davidState: null,
    davidRawState: null,
    eventOpen: null,
    lastSignal: {
      timestamp_utc: null,
      david_state: null,
      david_raw_state: null,
      david_ma: null,
      rsi: null,
    },
  };
}

function updateDiagnosticRsi(book: DavidDiagnosticBook, close: number) {
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
    if (book.rsiWarm.length < DAVID_DIAGNOSTIC_SETTINGS.rsiPeriod) return null;
    book.rsiAvgGain = book.rsiWarm.reduce((sum, row) => sum + row.gain, 0) / DAVID_DIAGNOSTIC_SETTINGS.rsiPeriod;
    book.rsiAvgLoss = book.rsiWarm.reduce((sum, row) => sum + row.loss, 0) / DAVID_DIAGNOSTIC_SETTINGS.rsiPeriod;
  } else {
    book.rsiAvgGain = ((book.rsiAvgGain * (DAVID_DIAGNOSTIC_SETTINGS.rsiPeriod - 1)) + gain) / DAVID_DIAGNOSTIC_SETTINGS.rsiPeriod;
    book.rsiAvgLoss = ((book.rsiAvgLoss * (DAVID_DIAGNOSTIC_SETTINGS.rsiPeriod - 1)) + loss) / DAVID_DIAGNOSTIC_SETTINGS.rsiPeriod;
  }
  book.lastRsi = book.rsiAvgLoss === 0
    ? 100
    : 100 - (100 / (1 + ((book.rsiAvgGain ?? 0) / book.rsiAvgLoss)));
  return book.lastRsi;
}

function updateDiagnosticDavidState(book: DavidDiagnosticBook) {
  if (book.bars.length < DAVID_DIAGNOSTIC_SETTINGS.maPeriod + 1) return null;
  const closes = book.bars.map((bar) => bar.close);
  const currentMa = lwma(closes.slice(-DAVID_DIAGNOSTIC_SETTINGS.maPeriod));
  const previousMa = lwma(closes.slice(-DAVID_DIAGNOSTIC_SETTINGS.maPeriod - 1, -1));
  const rawState: DavidState = previousMa > currentMa ? "DOWN" : "UP";
  book.davidRawState = rawState;
  if (book.davidState === null) {
    book.davidState = rawState;
    return currentMa;
  }
  if (rawState === book.davidState) return currentMa;
  if (rawState === "DOWN") {
    if (book.lastRsi !== null && book.lastRsi < DAVID_DIAGNOSTIC_SETTINGS.rsiOversold) book.davidState = "DOWN";
    return currentMa;
  }
  if (book.lastRsi !== null && book.lastRsi > DAVID_DIAGNOSTIC_SETTINGS.rsiOverbought) book.davidState = "UP";
  return currentMa;
}

function updateDavidDiagnosticWithEventBar(book: DavidDiagnosticBook, bar: Bar) {
  book.bars.push(bar);
  const maxHistory = DAVID_DIAGNOSTIC_SETTINGS.maPeriod + 2;
  if (book.bars.length > maxHistory) book.bars.shift();
  updateDiagnosticRsi(book, bar.close);
  const davidMa = updateDiagnosticDavidState(book);
  book.lastSignal = {
    timestamp_utc: bar.timestamp_utc,
    david_state: book.davidState,
    david_raw_state: book.davidRawState,
    david_ma: davidMa,
    rsi: book.lastRsi,
  };
}

function updateDavidDiagnosticBook(book: DavidDiagnosticBook, row: ReplayRow, m1Bar: Bar) {
  if (book.eventOpen === null) {
    book.eventOpen = m1Bar.close;
    return;
  }
  let moveAdr = closePriceMoveAdr(book.eventOpen, m1Bar.close, row.pair_adr_pct);
  while (Math.abs(moveAdr) >= DAVID_DIAGNOSTIC_SETTINGS.signalAdrBrick) {
    const direction = moveAdr > 0 ? 1 : -1;
    const eventOpen = book.eventOpen;
    const eventClose = eventOpen * (1 + direction * DAVID_DIAGNOSTIC_SETTINGS.signalAdrBrick * row.pair_adr_pct / 100);
    updateDavidDiagnosticWithEventBar(book, {
      ...m1Bar,
      open: eventOpen,
      high: Math.max(eventOpen, eventClose),
      low: Math.min(eventOpen, eventClose),
      close: eventClose,
    });
    book.eventOpen = eventClose;
    moveAdr = closePriceMoveAdr(book.eventOpen, m1Bar.close, row.pair_adr_pct);
  }
}

function buildDavidDiagnosticSnapshots(row: ReplayRow, bars: Bar[]) {
  const book = createDavidDiagnosticBook();
  const snapshots = new Map<number, DavidDiagnosticSnapshot>();
  for (const bar of bars) {
    updateDavidDiagnosticBook(book, row, bar);
    snapshots.set(bar.index, { ...book.lastSignal });
  }
  return snapshots;
}

function davidContraSide(snapshot: DavidDiagnosticSnapshot | null | undefined) {
  if (snapshot?.david_state === "UP") return "SHORT";
  if (snapshot?.david_state === "DOWN") return "LONG";
  return null;
}

function buildSessionWindows(bars: Bar[]): SessionWindow[] {
  if (!bars.length) return [];
  const startDay = dayStartMs(bars[0]!.timestamp_ms);
  const endDay = dayStartMs(bars.at(-1)!.timestamp_ms) + 86_400_000;
  const windows: SessionWindow[] = [];
  for (let day = startDay; day <= endDay; day += 86_400_000) {
    windows.push({
      id: `ny|${iso(day).slice(0, 10)}`,
      boxModel: "archived_utc",
      session: "NY",
      rangeStartMs: day,
      rangeEndMs: day + 13 * 3_600_000,
      entryStartMs: day + 13 * 3_600_000,
      entryEndMs: day + 21 * 3_600_000,
    });
    windows.push({
      id: `asia_london|${iso(day + 86_400_000).slice(0, 10)}`,
      boxModel: "archived_utc",
      session: "ASIA_LONDON",
      rangeStartMs: day + 13 * 3_600_000,
      rangeEndMs: day + 21 * 3_600_000,
      entryStartMs: day + 86_400_000,
      entryEndMs: day + 86_400_000 + 13 * 3_600_000,
    });
  }
  return windows;
}

function nyLocalMs(date: DateTime, hour: number, minute: number) {
  return date.set({ hour, minute, second: 0, millisecond: 0 }).toUTC().toMillis();
}

function buildNyCleanSessionWindows(bars: Bar[]): SessionWindow[] {
  if (!bars.length) return [];
  const startLocal = DateTime.fromMillis(bars[0]!.timestamp_ms, { zone: "utc" }).setZone("America/New_York").startOf("day").minus({ days: 1 });
  const endLocal = DateTime.fromMillis(bars.at(-1)!.timestamp_ms, { zone: "utc" }).setZone("America/New_York").startOf("day").plus({ days: 1 });
  const windows: SessionWindow[] = [];
  for (let day = startLocal; day <= endLocal; day = day.plus({ days: 1 })) {
    const morningRangeStart = nyLocalMs(day.minus({ days: 1 }), 18, 5);
    const morningRangeEnd = nyLocalMs(day, 8, 0);
    const morningEntryEnd = nyLocalMs(day, 15, 45);
    windows.push({
      id: `ny_clean_morning|${day.toISODate()}`,
      boxModel: "ny_clean_et",
      session: "NY",
      rangeStartMs: morningRangeStart,
      rangeEndMs: morningRangeEnd,
      entryStartMs: morningRangeEnd,
      entryEndMs: morningEntryEnd,
    });
    const eveningRangeStart = nyLocalMs(day, 8, 0);
    const eveningRangeEnd = nyLocalMs(day, 15, 45);
    const eveningEntryStart = nyLocalMs(day, 18, 5);
    const eveningEntryEnd = nyLocalMs(day.plus({ days: 1 }), 8, 0);
    windows.push({
      id: `ny_clean_evening|${day.toISODate()}`,
      boxModel: "ny_clean_et",
      session: "ASIA_LONDON",
      rangeStartMs: eveningRangeStart,
      rangeEndMs: eveningRangeEnd,
      entryStartMs: eveningEntryStart,
      entryEndMs: eveningEntryEnd,
    });
  }
  return windows;
}

function buildDiagnosticSessionWindows(bars: Bar[]) {
  return [...buildSessionWindows(bars), ...buildNyCleanSessionWindows(bars)];
}

function barsBetween(bars: Bar[], startMs: number, endMs: number) {
  return bars.filter((bar) => bar.timestamp_ms >= startMs && bar.timestamp_ms < endMs);
}

function stddev(values: number[]) {
  if (!values.length) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function bbContext(bars: Bar[], index: number, side: Side) {
  const window = bars.slice(Math.max(0, index - 20), index);
  if (window.length < 20) return null;
  const closes = window.map((bar) => bar.close);
  const mean = closes.reduce((sum, value) => sum + value, 0) / closes.length;
  const sd = stddev(closes);
  if (sd === null) return null;
  const upper = mean + 2 * sd;
  const lower = mean - 2 * sd;
  const bar = bars[index]!;
  return side === "LONG" ? bar.low <= lower : bar.high >= upper;
}

function displacementPass(row: ReplayRow, bar: Bar, side: Side, requiredAdr: number) {
  const candleRange = bar.high - bar.low;
  if (candleRange <= 0) return { passed: false, bodyAdr: null };
  const bodyAdr = Math.abs(priceMoveAdr(row, bar.open, bar.close) ?? 0);
  const correctDirection = side === "LONG" ? bar.close > bar.open : bar.close < bar.open;
  if (!correctDirection || bodyAdr < requiredAdr) return { passed: false, bodyAdr };
  const closeZone = side === "LONG"
    ? (bar.high - bar.close) / candleRange
    : (bar.close - bar.low) / candleRange;
  return { passed: closeZone <= 0.3, bodyAdr };
}

function baseCurrency(pair: string) {
  return pair.slice(0, 3);
}

function quoteCurrency(pair: string) {
  return pair.slice(3, 6);
}

function sideSign(side: Side) {
  return side === "LONG" ? 1 : -1;
}

function actualReturnAdr(row: ReplayRow, bars: Bar[]) {
  if (bars.length < 2) return null;
  return priceMoveAdr(row, bars[0]!.close, bars.at(-1)!.close);
}

function triggerFamilyContext(pair: string, side: Side, strengths: Map<string, number>) {
  const base = strengths.get(baseCurrency(pair));
  const quote = strengths.get(quoteCurrency(pair));
  if (base === undefined || quote === undefined) return { family: null, base: base ?? null, quote: quote ?? null };
  const family = side === "LONG" ? Math.min(base, -quote) : Math.min(-base, quote);
  return { family, base, quote };
}

function computeCurrencyStrength(rows: ReplayRow[], barsByKey: Map<string, Bar[]>) {
  const values = new Map<string, number[]>();
  for (const row of rows) {
    const bars = barsByKey.get(`${row.week_open_utc}|${row.pair}`) ?? [];
    const ret = actualReturnAdr(row, bars);
    if (ret === null) continue;
    const base = baseCurrency(row.pair);
    const quote = quoteCurrency(row.pair);
    values.set(base, [...(values.get(base) ?? []), ret]);
    values.set(quote, [...(values.get(quote) ?? []), -ret]);
  }
  const strengths = new Map<string, number>();
  for (const [currency, rowsForCurrency] of values) {
    strengths.set(currency, rowsForCurrency.reduce((sum, value) => sum + value, 0) / rowsForCurrency.length);
  }
  return strengths;
}

function detectTriggers(options: {
  row: ReplayRow;
  bars: Bar[];
  pathEfficiencyWeek: number | null;
  rangeRatioPair: number | null;
  gridQuantumAdr: number;
  signalAdrBrick: number;
  allInCostAdr: number;
  costFloorMultiple: number;
  targetGridSlots: number;
  minSpacingAdr: number;
  maxSpacingAdr: number;
  strengths: Map<string, number>;
}) {
  const triggerRows: TriggerCandidateRow[] = [];
  const sweepRequiredAdr = Math.max(options.signalAdrBrick, 0.25 * options.gridQuantumAdr);
  const displacementRequiredAdr = sweepRequiredAdr;
  for (const window of buildSessionWindows(options.bars)) {
    const rangeBars = barsBetween(options.bars, window.rangeStartMs, window.rangeEndMs);
    const entryBars = barsBetween(options.bars, window.entryStartMs, window.entryEndMs);
    if (!rangeBars.length || !entryBars.length) continue;
    const rangeHigh = Math.max(...rangeBars.map((bar) => bar.high));
    const rangeLow = Math.min(...rangeBars.map((bar) => bar.low));
    const sessionRangeAdr = rangeAdr(options.row, rangeHigh, rangeLow);
    const entryHigh = Math.max(...entryBars.map((bar) => bar.high));
    const entryLow = Math.min(...entryBars.map((bar) => bar.low));
    const entryPathEfficiency = pathEfficiency(entryBars);
    const entryRangeAdr = rangeAdr(options.row, entryHigh, entryLow);
    const geometry = geometryRegime({
      pathEfficiencyWeek: entryPathEfficiency,
      weekRangeAdr: sessionRangeAdr,
      rangeRatioPair: options.rangeRatioPair,
      gridQuantumAdr: options.gridQuantumAdr,
      allInCostAdr: options.allInCostAdr,
      costFloorMultiple: options.costFloorMultiple,
    });
    const spacing = adaptiveSpacing({
      rangeAdr: sessionRangeAdr,
      targetGridSlots: options.targetGridSlots,
      minSpacingAdr: options.minSpacingAdr,
      maxSpacingAdr: options.maxSpacingAdr,
      allInCostAdr: options.allInCostAdr,
      costFloorMultiple: options.costFloorMultiple,
    });
    for (let pos = 0; pos < entryBars.length; pos += 1) {
      const sweepBar = entryBars[pos]!;
      const directionalCandidates: Array<{ side: Side; depthAdr: number }> = [];
      const downDepth = rangeAdr(options.row, rangeLow, sweepBar.low);
      const upDepth = rangeAdr(options.row, sweepBar.high, rangeHigh);
      if (downDepth !== null && downDepth >= sweepRequiredAdr) directionalCandidates.push({ side: "LONG", depthAdr: downDepth });
      if (upDepth !== null && upDepth >= sweepRequiredAdr) directionalCandidates.push({ side: "SHORT", depthAdr: upDepth });
      for (const candidate of directionalCandidates) {
        const rejectionBars = [sweepBar, entryBars[pos + 1]].filter((bar): bar is Bar => Boolean(bar));
        const rejection = rejectionBars.find((bar) => candidate.side === "LONG" ? bar.close > rangeLow : bar.close < rangeHigh);
        if (!rejection) continue;
        const displacementBars = [rejection, options.bars[rejection.index + 1]].filter((bar): bar is Bar => {
          if (!bar) return false;
          return bar.timestamp_ms >= window.entryStartMs && bar.timestamp_ms < window.entryEndMs;
        });
        const displacement = displacementBars
          .map((bar) => ({ bar, result: displacementPass(options.row, bar, candidate.side, displacementRequiredAdr) }))
          .find((row) => row.result.passed);
        if (!displacement) continue;
        const context = triggerFamilyContext(options.row.pair, candidate.side, options.strengths);
        const raw: Omit<TriggerCandidateRow, "content_hash"> = {
          row_key: [
            options.row.week_open_utc,
            options.row.pair,
            window.id,
            candidate.side,
            sweepBar.timestamp_utc,
            displacement.bar.timestamp_utc,
          ].join("|"),
          week_open_utc: options.row.week_open_utc,
          pair: options.row.pair,
          candidate_b_side: options.row.candidate_b_side,
          trigger_side: candidate.side,
          candidate_b_alignment: sideSign(candidate.side) * sideSign(options.row.candidate_b_side),
          candidate_b_contra_alignment: sideSign(candidate.side) * -sideSign(options.row.candidate_b_side),
          session_id: window.id,
          session_label: window.session,
          range_start_utc: iso(window.rangeStartMs),
          range_end_utc: iso(window.rangeEndMs),
          entry_start_utc: iso(window.entryStartMs),
          entry_end_utc: iso(window.entryEndMs),
          session_range_adr: round(sessionRangeAdr),
          entry_path_efficiency: round(entryPathEfficiency),
          entry_range_adr: round(entryRangeAdr),
          path_efficiency_week: round(options.pathEfficiencyWeek),
          range_ratio_pair: round(options.rangeRatioPair),
          efficiency_bucket: geometry.efficiencyBucket,
          range_floor_adr: round(geometry.rangeFloorAdr)!,
          range_condition_pass: geometry.rangeConditionPass,
          range_expansion_bucket: geometry.rangeExpansionBucket,
          geometry_regime: geometry.geometryRegime,
          geometry_harvestable_candidate: geometry.geometryHarvestableCandidate,
          grid_quantum_adr: options.gridQuantumAdr,
          signal_adr_brick: options.signalAdrBrick,
          adaptive_spacing_formula_id: spacing.formulaId,
          adaptive_spacing_raw_adr: spacing.rawSpacingAdr,
          adaptive_spacing_adr: spacing.spacingAdr,
          adaptive_spacing_range_floor_adr: spacing.rangeFloorAdr,
          adaptive_range_condition_pass: spacing.rangeConditionPass,
          adaptive_signal_adr_brick: spacing.signalBrickAdr,
          adaptive_spacing_tradability_pass: spacing.tradabilityPass,
          sweep_timestamp_utc: sweepBar.timestamp_utc,
          rejection_timestamp_utc: rejection.timestamp_utc,
          displacement_timestamp_utc: displacement.bar.timestamp_utc,
          sweep_depth_adr: round(candidate.depthAdr)!,
          sweep_required_adr: round(sweepRequiredAdr)!,
          displacement_body_adr: round(displacement.result.bodyAdr)!,
          displacement_required_adr: round(displacementRequiredAdr)!,
          sweep_to_entry_bars: displacement.bar.index - sweepBar.index,
          signal_form: rejection.index === sweepBar.index ? "1_BAR" : "2_BAR",
          bb_sweep_context: bbContext(options.bars, sweepBar.index, candidate.side),
          family_alignment_context: round(context.family),
          base_currency_strength: round(context.base),
          quote_currency_strength: round(context.quote),
        };
        triggerRows.push(withHash(raw));
      }
    }
  }
  return triggerRows;
}

function rangeRatioForRows(pairRows: Array<{ week: string; rangeAdr: number | null }>) {
  const output = new Map<string, number | null>();
  let fast: number | null = null;
  let slow: number | null = null;
  const fastAlpha = 2 / (5 + 1);
  const slowAlpha = 2 / (20 + 1);
  for (const row of pairRows) {
    if (row.rangeAdr === null) {
      output.set(row.week, null);
      continue;
    }
    fast = fast === null ? row.rangeAdr : fast + fastAlpha * (row.rangeAdr - fast);
    slow = slow === null ? row.rangeAdr : slow + slowAlpha * (row.rangeAdr - slow);
    output.set(row.week, slow > 0 ? Math.min(2, Math.max(0.5, fast / slow)) : null);
  }
  return output;
}

function average(values: Array<number | null | undefined>) {
  const clean = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!clean.length) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function optionalNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

type HeatMaps = {
  pairHeat: Map<string, number>;
  accountHeat: Map<string, number>;
};

function pressureFromCloseRows(rows: Record<string, string>[]) {
  const fillPressure = Math.min(1, rows.length / 100);
  const depthPressure = Math.min(1, Math.max(0, ...rows.map((row) => Number(row.adverse_fill_count ?? 0))) / 20);
  const targetNet = rows
    .filter((row) => row.close_reason === "target")
    .reduce((sum, row) => sum + Math.max(0, Number(row.net_usd ?? 0)), 0);
  const flattenNetAbs = Math.abs(rows
    .filter((row) => row.close_reason === "session_flatten")
    .reduce((sum, row) => sum + Number(row.net_usd ?? 0), 0));
  const flattenPressure = targetNet > 0 ? Math.min(1, flattenNetAbs / targetNet) : flattenNetAbs > 0 ? 1 : 0;
  return Math.max(fillPressure, depthPressure, flattenPressure);
}

function buildHeatMaps(closeEventRows: Record<string, string>[]): HeatMaps {
  const pairGroups = new Map<string, Record<string, string>[]>();
  const weekGroups = new Map<string, Record<string, string>[]>();
  for (const row of closeEventRows) {
    const week = row.anchor_week_open_utc ?? "";
    const pair = row.pair ?? "";
    if (!week || !pair) continue;
    const pairKey = `${week}|${pair}`;
    pairGroups.set(pairKey, [...(pairGroups.get(pairKey) ?? []), row]);
    weekGroups.set(week, [...(weekGroups.get(week) ?? []), row]);
  }
  const pairHeat = new Map<string, number>();
  for (const [key, rows] of pairGroups) pairHeat.set(key, pressureFromCloseRows(rows));
  const accountHeat = new Map<string, number>();
  for (const [week, rows] of weekGroups) accountHeat.set(week, pressureFromCloseRows(rows));
  return { pairHeat, accountHeat };
}

function clampValue(min: number, max: number, value: number) {
  return Math.max(min, Math.min(max, value));
}

function adaptiveSpacing(options: {
  rangeAdr: number | null;
  targetGridSlots: number;
  minSpacingAdr: number;
  maxSpacingAdr: number;
  allInCostAdr: number;
  costFloorMultiple: number;
}) {
  const rawSpacing = options.rangeAdr !== null && options.targetGridSlots > 0
    ? options.rangeAdr / options.targetGridSlots
    : null;
  const costFloorAdr = options.allInCostAdr > 0 ? options.costFloorMultiple * options.allInCostAdr : null;
  const spacingFloor = Math.max(options.minSpacingAdr, costFloorAdr ?? 0);
  const unclamped = rawSpacing === null ? null : Math.max(rawSpacing, spacingFloor);
  const spacingAdr = unclamped === null ? null : clampValue(options.minSpacingAdr, options.maxSpacingAdr, unclamped);
  const rangeFloorAdr = spacingAdr === null ? null : Math.max(RANGE_FLOOR_MIN_ADR, options.targetGridSlots * spacingAdr);
  const adaptiveRangePass = options.rangeAdr === null || rangeFloorAdr === null
    ? null
    : options.rangeAdr + 1e-9 >= rangeFloorAdr;
  const signalBrickAdr = spacingAdr === null
    ? null
    : clampValue(DEFAULT_MIN_SIGNAL_BRICK_ADR, DEFAULT_MAX_SIGNAL_BRICK_ADR, spacingAdr / 4);
  const tradabilityPass = costFloorAdr === null ? null : costFloorAdr <= options.maxSpacingAdr;
  return {
    formulaId: SPACING_FORMULA_ID,
    rawSpacingAdr: round(rawSpacing),
    spacingAdr: round(spacingAdr),
    rangeFloorAdr: round(rangeFloorAdr),
    rangeConditionPass: adaptiveRangePass,
    signalBrickAdr: round(signalBrickAdr),
    tradabilityPass,
  };
}

function geometryRegime(options: {
  pathEfficiencyWeek: number | null;
  weekRangeAdr: number | null;
  rangeRatioPair: number | null;
  gridQuantumAdr: number;
  allInCostAdr: number;
  costFloorMultiple: number;
}) {
  const efficiencyBucket = options.pathEfficiencyWeek === null
    ? "unknown"
    : options.pathEfficiencyWeek <= PATH_EFFICIENCY_LOW_MAX
      ? "low"
      : options.pathEfficiencyWeek >= PATH_EFFICIENCY_HIGH_MIN
        ? "high"
        : "mid";
  const rangeFloorAdr = Math.max(RANGE_FLOOR_MIN_ADR, RANGE_FLOOR_QUANTUM_MULTIPLE * options.gridQuantumAdr);
  const rangeConditionPass = options.weekRangeAdr === null ? null : options.weekRangeAdr >= rangeFloorAdr;
  const rangeExpansionBucket = options.rangeRatioPair === null
    ? "unknown"
    : options.rangeRatioPair >= RANGE_EXPANDED_MIN_RATIO
      ? "expanded"
      : options.rangeRatioPair <= RANGE_COMPRESSED_MAX_RATIO
        ? "compressed"
        : "normal";
  const costFloorQuantumAdr = options.allInCostAdr > 0 ? options.costFloorMultiple * options.allInCostAdr : null;
  const costSafeQuantumPass = costFloorQuantumAdr === null ? null : options.gridQuantumAdr >= costFloorQuantumAdr;
  let regime = "unknown";
  if (efficiencyBucket === "low" && rangeConditionPass === true) regime = "harvestable_chop_candidate";
  else if (efficiencyBucket === "low" && rangeConditionPass === false) regime = "dead_chop_cost_churn";
  else if (efficiencyBucket === "high" && rangeExpansionBucket === "expanded") regime = "efficient_expanding_tail_risk";
  else if (efficiencyBucket === "high" && rangeConditionPass === true) regime = "efficient_range_tail_risk";
  else if (efficiencyBucket === "high" && rangeConditionPass === false) regime = "directional_drift_low_harvest";
  else if (efficiencyBucket === "mid" && rangeConditionPass === true) regime = "mixed_range_watch";
  else if (efficiencyBucket === "mid" && rangeConditionPass === false) regime = "mixed_low_range_churn";
  const harvestable = regime === "harvestable_chop_candidate" && costSafeQuantumPass !== false;
  return {
    efficiencyBucket,
    rangeFloorAdr,
    rangeConditionPass,
    rangeExpansionBucket,
    costFloorQuantumAdr,
    costSafeQuantumPass,
    geometryRegime: regime,
    geometryHarvestableCandidate: harvestable,
  };
}

type StartModeCandidate = {
  side: Side;
  timestampUtc: string;
  timestampMs: number;
  barIndex: number;
  startPrice: number;
  distanceFromMidAdr: number | null;
  sweepTimestampUtc: string | null;
  rejectionTimestampUtc: string | null;
  displacementTimestampUtc: string | null;
  sweepDepthAdr: number | null;
  displacementBodyAdr: number | null;
  davidSnapshot: DavidDiagnosticSnapshot | null;
};

function sideAlignment(left: Side | null, right: Side | null) {
  if (!left || !right) return null;
  return left === right ? 1 : -1;
}

function sideDistanceFromMidAdr(row: ReplayRow, side: Side, midPrice: number, price: number) {
  const moveAdr = priceMoveAdr(row, midPrice, price);
  if (moveAdr === null) return null;
  return side === "LONG" ? -moveAdr : moveAdr;
}

function firstByTimestamp(candidates: StartModeCandidate[]) {
  return [...candidates].sort((left, right) => left.timestampMs - right.timestampMs)[0] ?? null;
}

type ExcursionReceipt = {
  horizonEndUtc: string | null;
  mfeAdr: number | null;
  maeAdr: number | null;
  mfeTimestampUtc: string | null;
  maeTimestampUtc: string | null;
  closePnlAdr: number | null;
  hit1q: boolean | null;
  hit2q: boolean | null;
  hit3q: boolean | null;
};

function nextNyFlattenMsAfter(timestampMs: number) {
  const local = DateTime.fromMillis(timestampMs, { zone: "utc" }).setZone("America/New_York");
  let flatten = local.set({ hour: 16, minute: 0, second: 0, millisecond: 0 });
  if (local.toMillis() >= flatten.toMillis()) flatten = flatten.plus({ days: 1 });
  return flatten.toUTC().toMillis();
}

function sideHighLowExcursionAdr(row: ReplayRow, side: Side, entryPrice: number, bar: Bar) {
  const highMove = priceMoveAdr(row, entryPrice, bar.high);
  const lowMove = priceMoveAdr(row, entryPrice, bar.low);
  if (highMove === null || lowMove === null) return { favorable: null, adverse: null };
  if (side === "LONG") return { favorable: highMove, adverse: -lowMove };
  return { favorable: -lowMove, adverse: highMove };
}

function sideClosePnlAdr(row: ReplayRow, side: Side, entryPrice: number, closePrice: number) {
  const move = priceMoveAdr(row, entryPrice, closePrice);
  if (move === null) return null;
  return side === "LONG" ? move : -move;
}

function excursionReceipt(options: {
  row: ReplayRow;
  bars: Bar[];
  candidate: StartModeCandidate | null;
  horizonEndMs: number | null;
  quantumAdr: number | null;
}) {
  if (!options.candidate || options.horizonEndMs === null) {
    return {
      horizonEndUtc: options.horizonEndMs === null ? null : iso(options.horizonEndMs),
      mfeAdr: null,
      maeAdr: null,
      mfeTimestampUtc: null,
      maeTimestampUtc: null,
      closePnlAdr: null,
      hit1q: null,
      hit2q: null,
      hit3q: null,
    } satisfies ExcursionReceipt;
  }
  const horizonBars = options.bars.filter((bar) =>
    bar.index > options.candidate!.barIndex &&
    bar.timestamp_ms <= options.horizonEndMs!
  );
  let mfeAdr = 0;
  let maeAdr = 0;
  let mfeTimestampUtc = options.candidate.timestampUtc;
  let maeTimestampUtc = options.candidate.timestampUtc;
  for (const bar of horizonBars) {
    const excursion = sideHighLowExcursionAdr(options.row, options.candidate.side, options.candidate.startPrice, bar);
    if (excursion.favorable !== null && excursion.favorable > mfeAdr) {
      mfeAdr = excursion.favorable;
      mfeTimestampUtc = bar.timestamp_utc;
    }
    if (excursion.adverse !== null && excursion.adverse > maeAdr) {
      maeAdr = excursion.adverse;
      maeTimestampUtc = bar.timestamp_utc;
    }
  }
  const closeBar = [...horizonBars].reverse()[0] ?? null;
  const closePnlAdr = closeBar
    ? sideClosePnlAdr(options.row, options.candidate.side, options.candidate.startPrice, closeBar.close)
    : null;
  const quantum = options.quantumAdr && options.quantumAdr > 0 ? options.quantumAdr : null;
  return {
    horizonEndUtc: iso(options.horizonEndMs),
    mfeAdr: round(mfeAdr),
    maeAdr: round(maeAdr),
    mfeTimestampUtc,
    maeTimestampUtc,
    closePnlAdr: round(closePnlAdr),
    hit1q: quantum === null ? null : mfeAdr + 1e-9 >= quantum,
    hit2q: quantum === null ? null : mfeAdr + 1e-9 >= 2 * quantum,
    hit3q: quantum === null ? null : mfeAdr + 1e-9 >= 3 * quantum,
  } satisfies ExcursionReceipt;
}

function firstTargetHitTimestamp(options: {
  row: ReplayRow;
  bars: Bar[];
  candidate: StartModeCandidate | null;
  targetAdr: number;
}) {
  if (!options.candidate) return null;
  const horizonBars = options.bars.filter((bar) => bar.index > options.candidate!.barIndex);
  for (const bar of horizonBars) {
    const excursion = sideHighLowExcursionAdr(options.row, options.candidate.side, options.candidate.startPrice, bar);
    if (excursion.favorable !== null && excursion.favorable + 1e-9 >= options.targetAdr) return bar.timestamp_utc;
  }
  return null;
}

function sweepRejectionCandidates(options: {
  row: ReplayRow;
  bars: Bar[];
  window: SessionWindow;
  rangeHigh: number;
  rangeLow: number;
  sweepRequiredAdr: number;
  displacementRequiredAdr: number;
  davidSnapshots: Map<number, DavidDiagnosticSnapshot>;
}) {
  const entryBars = barsBetween(options.bars, options.window.entryStartMs, options.window.entryEndMs);
  const candidates: StartModeCandidate[] = [];
  for (let pos = 0; pos < entryBars.length; pos += 1) {
    const sweepBar = entryBars[pos]!;
    const directionalCandidates: Array<{ side: Side; depthAdr: number }> = [];
    const downDepth = rangeAdr(options.row, options.rangeLow, sweepBar.low);
    const upDepth = rangeAdr(options.row, sweepBar.high, options.rangeHigh);
    if (downDepth !== null && downDepth >= options.sweepRequiredAdr) directionalCandidates.push({ side: "LONG", depthAdr: downDepth });
    if (upDepth !== null && upDepth >= options.sweepRequiredAdr) directionalCandidates.push({ side: "SHORT", depthAdr: upDepth });
    for (const candidate of directionalCandidates) {
      const rejectionBars = [sweepBar, entryBars[pos + 1]].filter((bar): bar is Bar => Boolean(bar));
      const rejection = rejectionBars.find((bar) => candidate.side === "LONG" ? bar.close > options.rangeLow : bar.close < options.rangeHigh);
      if (!rejection) continue;
      const displacementBars = [rejection, options.bars[rejection.index + 1]].filter((bar): bar is Bar => {
        if (!bar) return false;
        return bar.timestamp_ms >= options.window.entryStartMs && bar.timestamp_ms < options.window.entryEndMs;
      });
      const displacement = displacementBars
        .map((bar) => ({ bar, result: displacementPass(options.row, bar, candidate.side, options.displacementRequiredAdr) }))
        .find((row) => row.result.passed);
      candidates.push({
        side: candidate.side,
        timestampUtc: (displacement?.bar ?? rejection).timestamp_utc,
        timestampMs: (displacement?.bar ?? rejection).timestamp_ms,
        barIndex: (displacement?.bar ?? rejection).index,
        startPrice: (displacement?.bar ?? rejection).close,
        distanceFromMidAdr: null,
        sweepTimestampUtc: sweepBar.timestamp_utc,
        rejectionTimestampUtc: rejection.timestamp_utc,
        displacementTimestampUtc: displacement?.bar.timestamp_utc ?? null,
        sweepDepthAdr: round(candidate.depthAdr),
        displacementBodyAdr: round(displacement?.result.bodyAdr),
        davidSnapshot: options.davidSnapshots.get((displacement?.bar ?? rejection).index) ?? null,
      });
    }
  }
  return candidates;
}

function meanExtensionCandidate(options: {
  row: ReplayRow;
  entryBars: Bar[];
  rangeMid: number;
  requiredExtensionAdr: number;
  davidSnapshots: Map<number, DavidDiagnosticSnapshot>;
  sideForBar?: (bar: Bar) => Side | null;
}) {
  const candidates: StartModeCandidate[] = [];
  for (const bar of options.entryBars) {
    const sides = options.sideForBar
      ? [options.sideForBar(bar)].filter((side): side is Side => Boolean(side))
      : ["LONG", "SHORT"] as Side[];
    for (const side of sides) {
      const touchPrice = side === "LONG" ? bar.low : bar.high;
      const distance = sideDistanceFromMidAdr(options.row, side, options.rangeMid, touchPrice);
      if (distance === null || distance < options.requiredExtensionAdr) continue;
      candidates.push({
        side,
        timestampUtc: bar.timestamp_utc,
        timestampMs: bar.timestamp_ms,
        barIndex: bar.index,
        startPrice: bar.close,
        distanceFromMidAdr: round(distance),
        sweepTimestampUtc: null,
        rejectionTimestampUtc: null,
        displacementTimestampUtc: null,
        sweepDepthAdr: null,
        displacementBodyAdr: null,
        davidSnapshot: options.davidSnapshots.get(bar.index) ?? null,
      });
    }
    if (candidates.length) break;
  }
  return firstByTimestamp(candidates);
}

function buildStartModeRow(options: {
  row: ReplayRow;
  bars: Bar[];
  window: SessionWindow;
  modeId: StartModeId;
  triggerBasis: StartModeDiagnosticRow["trigger_basis"];
  candidate: StartModeCandidate | null;
  blockedStatus: "blocked_no_start" | "blocked_no_david_side";
  geometryM1: ReturnType<typeof geometryRegime>;
  geometryAdrEvent: ReturnType<typeof geometryRegime>;
  sessionRangeAdr: number | null;
  peM1: number | null;
  peAdrEvent: number | null;
  entryRangeAdr: number | null;
  spacingAdr: number | null;
  requiredExtensionAdr: number | null;
  rangeMid: number | null;
  entryStartMs: number;
  relaxedCandidateCount: number;
  strictCandidateCount: number;
}) {
  const davidSide = davidContraSide(options.candidate?.davidSnapshot ?? null);
  const startSide = options.candidate?.side ?? null;
  const startDelay = options.candidate
    ? (options.candidate.timestampMs - options.entryStartMs) / 60_000
    : null;
  const eodFlattenMs = options.candidate ? nextNyFlattenMsAfter(options.candidate.timestampMs) : null;
  const nextDayFlattenMs = eodFlattenMs === null ? null : nextNyFlattenMsAfter(eodFlattenMs + 60_000);
  const fullAvailableEndMs = options.bars.at(-1)?.timestamp_ms ?? null;
  const eodExcursion = excursionReceipt({
    row: options.row,
    bars: options.bars,
    candidate: options.candidate,
    horizonEndMs: eodFlattenMs,
    quantumAdr: options.spacingAdr,
  });
  const nextDayExcursion = excursionReceipt({
    row: options.row,
    bars: options.bars,
    candidate: options.candidate,
    horizonEndMs: nextDayFlattenMs,
    quantumAdr: options.spacingAdr,
  });
  const fullAvailableExcursion = excursionReceipt({
    row: options.row,
    bars: options.bars,
    candidate: options.candidate,
    horizonEndMs: fullAvailableEndMs,
    quantumAdr: options.spacingAdr,
  });
  const firstPositiveTimestamp = firstTargetHitTimestamp({
    row: options.row,
    bars: options.bars,
    candidate: options.candidate,
    targetAdr: 0.000001,
  });
  const first1qTimestamp = options.spacingAdr === null ? null : firstTargetHitTimestamp({
    row: options.row,
    bars: options.bars,
    candidate: options.candidate,
    targetAdr: options.spacingAdr,
  });
  const first2qTimestamp = options.spacingAdr === null ? null : firstTargetHitTimestamp({
    row: options.row,
    bars: options.bars,
    candidate: options.candidate,
    targetAdr: 2 * options.spacingAdr,
  });
  const first3qTimestamp = options.spacingAdr === null ? null : firstTargetHitTimestamp({
    row: options.row,
    bars: options.bars,
    candidate: options.candidate,
    targetAdr: 3 * options.spacingAdr,
  });
  const raw: Omit<StartModeDiagnosticRow, "content_hash"> = {
    row_key: [
      options.row.week_open_utc,
      options.row.pair,
      options.window.boxModel,
      options.window.id,
      options.modeId,
    ].join("|"),
    question_scope: "start_mode_inside_valid_geometry",
    week_open_utc: options.row.week_open_utc,
    pair: options.row.pair,
    candidate_b_side: options.row.candidate_b_side,
    box_model: options.window.boxModel,
    session_id: options.window.id,
    session_label: options.window.session,
    start_mode_id: options.modeId,
    start_status: options.candidate ? "found" : options.blockedStatus,
    start_side: startSide,
    start_timestamp_utc: options.candidate?.timestampUtc ?? null,
    trigger_basis: options.triggerBasis,
    valid_geometry_basis: START_MODE_GEOMETRY_BASIS,
    geometry_regime_m1: options.geometryM1.geometryRegime,
    geometry_regime_adr_event: options.geometryAdrEvent.geometryRegime,
    geometry_harvestable_candidate_m1: options.geometryM1.geometryHarvestableCandidate,
    geometry_harvestable_candidate_adr_event: options.geometryAdrEvent.geometryHarvestableCandidate,
    session_range_adr: round(options.sessionRangeAdr),
    pe_m1_1_session: round(options.peM1),
    pe_adr_event_1_session: round(options.peAdrEvent),
    entry_range_adr: round(options.entryRangeAdr),
    adaptive_spacing_adr: options.spacingAdr,
    required_extension_adr: round(options.requiredExtensionAdr),
    session_mid_price: round(options.rangeMid),
    start_price: round(options.candidate?.startPrice),
    start_distance_from_mid_adr: round(options.candidate?.distanceFromMidAdr),
    start_delay_minutes_from_entry_start: round(startDelay),
    relaxed_sweep_rejection_candidates: options.relaxedCandidateCount,
    strict_sweep_rejection_displacement_candidates: options.strictCandidateCount,
    candidate_b_alignment: sideAlignment(startSide, options.row.candidate_b_side),
    david_alignment: sideAlignment(startSide, davidSide),
    david_state_at_start: options.candidate?.davidSnapshot?.david_state ?? null,
    david_raw_state_at_start: options.candidate?.davidSnapshot?.david_raw_state ?? null,
    david_ma_at_start: round(options.candidate?.davidSnapshot?.david_ma),
    david_rsi_at_start: round(options.candidate?.davidSnapshot?.rsi),
    sweep_timestamp_utc: options.candidate?.sweepTimestampUtc ?? null,
    rejection_timestamp_utc: options.candidate?.rejectionTimestampUtc ?? null,
    displacement_timestamp_utc: options.candidate?.displacementTimestampUtc ?? null,
    sweep_depth_adr: options.candidate?.sweepDepthAdr ?? null,
    displacement_body_adr: options.candidate?.displacementBodyAdr ?? null,
    eod_flatten_timestamp_utc: eodExcursion.horizonEndUtc,
    eod_mfe_adr: eodExcursion.mfeAdr,
    eod_mae_adr: eodExcursion.maeAdr,
    eod_mfe_quantum_units: options.spacingAdr && eodExcursion.mfeAdr !== null ? round(eodExcursion.mfeAdr / options.spacingAdr) : null,
    eod_mfe_timestamp_utc: eodExcursion.mfeTimestampUtc,
    eod_mae_timestamp_utc: eodExcursion.maeTimestampUtc,
    eod_close_pnl_adr: eodExcursion.closePnlAdr,
    eod_hit_1q: eodExcursion.hit1q,
    eod_hit_2q: eodExcursion.hit2q,
    eod_hit_3q: eodExcursion.hit3q,
    next_day_flatten_timestamp_utc: nextDayExcursion.horizonEndUtc,
    next_day_mfe_adr: nextDayExcursion.mfeAdr,
    next_day_mae_adr: nextDayExcursion.maeAdr,
    next_day_mfe_quantum_units: options.spacingAdr && nextDayExcursion.mfeAdr !== null ? round(nextDayExcursion.mfeAdr / options.spacingAdr) : null,
    next_day_close_pnl_adr: nextDayExcursion.closePnlAdr,
    next_day_hit_1q: nextDayExcursion.hit1q,
    next_day_hit_2q: nextDayExcursion.hit2q,
    next_day_hit_3q: nextDayExcursion.hit3q,
    full_available_mfe_adr: fullAvailableExcursion.mfeAdr,
    full_available_mae_adr: fullAvailableExcursion.maeAdr,
    full_available_mfe_quantum_units: options.spacingAdr && fullAvailableExcursion.mfeAdr !== null ? round(fullAvailableExcursion.mfeAdr / options.spacingAdr) : null,
    hold_until_profit_first_positive_timestamp_utc: firstPositiveTimestamp,
    hold_until_profit_first_1q_timestamp_utc: first1qTimestamp,
    hold_until_profit_first_2q_timestamp_utc: first2qTimestamp,
    hold_until_profit_first_3q_timestamp_utc: first3qTimestamp,
  };
  return withHash(raw);
}

function buildStartModeDiagnostics(options: {
  row: ReplayRow;
  bars: Bar[];
  rangeRatioPair: number | null;
  gridQuantumAdr: number;
  allInCostAdr: number;
  costFloorMultiple: number;
  targetGridSlots: number;
  minSpacingAdr: number;
  maxSpacingAdr: number;
}) {
  const rows: StartModeDiagnosticRow[] = [];
  const davidSnapshots = buildDavidDiagnosticSnapshots(options.row, options.bars);
  const sweepRequiredAdr = Math.max(DAVID_DIAGNOSTIC_SETTINGS.signalAdrBrick, 0.25 * options.gridQuantumAdr);
  const displacementRequiredAdr = sweepRequiredAdr;
  for (const window of buildDiagnosticSessionWindows(options.bars)) {
    const rangeBars = barsBetween(options.bars, window.rangeStartMs, window.rangeEndMs);
    const entryBars = barsBetween(options.bars, window.entryStartMs, window.entryEndMs);
    if (!rangeBars.length || !entryBars.length) continue;
    const rangeHigh = Math.max(...rangeBars.map((bar) => bar.high));
    const rangeLow = Math.min(...rangeBars.map((bar) => bar.low));
    const rangeMid = (rangeHigh + rangeLow) / 2;
    const sessionRangeAdr = rangeAdr(options.row, rangeHigh, rangeLow);
    const entryHigh = Math.max(...entryBars.map((bar) => bar.high));
    const entryLow = Math.min(...entryBars.map((bar) => bar.low));
    const entryRangeAdr = rangeAdr(options.row, entryHigh, entryLow);
    const peM1 = pathEfficiency(entryBars);
    const peAdrEvent = pathEfficiency(adrEventBars(options.row, entryBars, DAVID_DIAGNOSTIC_SETTINGS.signalAdrBrick));
    const geometryM1 = geometryRegime({
      pathEfficiencyWeek: peM1,
      weekRangeAdr: sessionRangeAdr,
      rangeRatioPair: options.rangeRatioPair,
      gridQuantumAdr: options.gridQuantumAdr,
      allInCostAdr: options.allInCostAdr,
      costFloorMultiple: options.costFloorMultiple,
    });
    const geometryAdrEvent = geometryRegime({
      pathEfficiencyWeek: peAdrEvent,
      weekRangeAdr: sessionRangeAdr,
      rangeRatioPair: options.rangeRatioPair,
      gridQuantumAdr: options.gridQuantumAdr,
      allInCostAdr: options.allInCostAdr,
      costFloorMultiple: options.costFloorMultiple,
    });
    if (!geometryAdrEvent.geometryHarvestableCandidate) continue;
    const spacing = adaptiveSpacing({
      rangeAdr: sessionRangeAdr,
      targetGridSlots: options.targetGridSlots,
      minSpacingAdr: options.minSpacingAdr,
      maxSpacingAdr: options.maxSpacingAdr,
      allInCostAdr: options.allInCostAdr,
      costFloorMultiple: options.costFloorMultiple,
    });
    const requiredExtensionAdr = spacing.spacingAdr ?? options.gridQuantumAdr;
    const sweepCandidates = sweepRejectionCandidates({
      row: options.row,
      bars: options.bars,
      window,
      rangeHigh,
      rangeLow,
      sweepRequiredAdr,
      displacementRequiredAdr,
      davidSnapshots,
    });
    const strictCandidates = sweepCandidates.filter((candidate) => candidate.displacementTimestampUtc !== null);
    const strictCandidate = firstByTimestamp(strictCandidates);
    const relaxedCandidate = firstByTimestamp(sweepCandidates);
    const meanCandidate = meanExtensionCandidate({
      row: options.row,
      entryBars,
      rangeMid,
      requiredExtensionAdr,
      davidSnapshots,
    });
    const candidateBStart = meanExtensionCandidate({
      row: options.row,
      entryBars,
      rangeMid,
      requiredExtensionAdr,
      davidSnapshots,
      sideForBar: () => options.row.candidate_b_side,
    });
    let davidSideSeen = false;
    const davidStart = meanExtensionCandidate({
      row: options.row,
      entryBars,
      rangeMid,
      requiredExtensionAdr,
      davidSnapshots,
      sideForBar: (bar) => {
        const side = davidContraSide(davidSnapshots.get(bar.index));
        if (side) davidSideSeen = true;
        return side;
      },
    });
    const base = {
      row: options.row,
      bars: options.bars,
      window,
      geometryM1,
      geometryAdrEvent,
      sessionRangeAdr,
      peM1,
      peAdrEvent,
      entryRangeAdr,
      spacingAdr: spacing.spacingAdr,
      requiredExtensionAdr,
      rangeMid,
      entryStartMs: window.entryStartMs,
      relaxedCandidateCount: sweepCandidates.length,
      strictCandidateCount: strictCandidates.length,
    };
    rows.push(buildStartModeRow({
      ...base,
      modeId: "strict_sweep_rejection_displacement",
      triggerBasis: "strict_katarakti",
      candidate: strictCandidate,
      blockedStatus: "blocked_no_start",
    }));
    rows.push(buildStartModeRow({
      ...base,
      modeId: "relaxed_sweep_rejection",
      triggerBasis: "sweep_rejection",
      candidate: relaxedCandidate,
      blockedStatus: "blocked_no_start",
    }));
    rows.push(buildStartModeRow({
      ...base,
      modeId: "first_mean_extension_touch",
      triggerBasis: "session_mid_extension",
      candidate: meanCandidate,
      blockedStatus: "blocked_no_start",
    }));
    rows.push(buildStartModeRow({
      ...base,
      modeId: "candidate_b_geometry_start",
      triggerBasis: "candidate_b_session_mid_extension",
      candidate: candidateBStart,
      blockedStatus: "blocked_no_start",
    }));
    rows.push(buildStartModeRow({
      ...base,
      modeId: "david_contra_geometry_start",
      triggerBasis: "david_contra_session_mid_extension",
      candidate: davidStart,
      blockedStatus: davidSideSeen ? "blocked_no_start" : "blocked_no_david_side",
    }));
  }
  return rows;
}

function buildSessionGeometryRows(options: {
  row: ReplayRow;
  bars: Bar[];
  rangeRatioPair: number | null;
  gridQuantumAdr: number;
  allInCostAdr: number;
  costFloorMultiple: number;
  targetGridSlots: number;
  minSpacingAdr: number;
  maxSpacingAdr: number;
  triggerRows: TriggerCandidateRow[];
}) {
  return buildSessionWindows(options.bars).flatMap((window) => {
    const rangeBars = barsBetween(options.bars, window.rangeStartMs, window.rangeEndMs);
    const entryBars = barsBetween(options.bars, window.entryStartMs, window.entryEndMs);
    if (!rangeBars.length || !entryBars.length) return [] as SessionGeometryRow[];
    const rangeHigh = Math.max(...rangeBars.map((bar) => bar.high));
    const rangeLow = Math.min(...rangeBars.map((bar) => bar.low));
    const entryHigh = Math.max(...entryBars.map((bar) => bar.high));
    const entryLow = Math.min(...entryBars.map((bar) => bar.low));
    const sessionRangeAdr = rangeAdr(options.row, rangeHigh, rangeLow);
    const entryRangeAdr = rangeAdr(options.row, entryHigh, entryLow);
    const entryEfficiency = pathEfficiency(entryBars);
    const geometry = geometryRegime({
      pathEfficiencyWeek: entryEfficiency,
      weekRangeAdr: sessionRangeAdr,
      rangeRatioPair: options.rangeRatioPair,
      gridQuantumAdr: options.gridQuantumAdr,
      allInCostAdr: options.allInCostAdr,
      costFloorMultiple: options.costFloorMultiple,
    });
    const spacing = adaptiveSpacing({
      rangeAdr: sessionRangeAdr,
      targetGridSlots: options.targetGridSlots,
      minSpacingAdr: options.minSpacingAdr,
      maxSpacingAdr: options.maxSpacingAdr,
      allInCostAdr: options.allInCostAdr,
      costFloorMultiple: options.costFloorMultiple,
    });
    const sessionTriggers = options.triggerRows.filter((trigger) => trigger.session_id === window.id);
    return [withHash({
      row_key: `${options.row.week_open_utc}|${options.row.pair}|${window.id}`,
      week_open_utc: options.row.week_open_utc,
      pair: options.row.pair,
      candidate_b_side: options.row.candidate_b_side,
      session_id: window.id,
      session_label: window.session,
      range_start_utc: iso(window.rangeStartMs),
      range_end_utc: iso(window.rangeEndMs),
      entry_start_utc: iso(window.entryStartMs),
      entry_end_utc: iso(window.entryEndMs),
      session_range_adr: round(sessionRangeAdr),
      entry_path_efficiency: round(entryEfficiency),
      entry_range_adr: round(entryRangeAdr),
      range_ratio_pair: round(options.rangeRatioPair),
      efficiency_bucket: geometry.efficiencyBucket,
      range_floor_adr: round(geometry.rangeFloorAdr)!,
      range_condition_pass: geometry.rangeConditionPass,
      range_expansion_bucket: geometry.rangeExpansionBucket,
      geometry_regime: geometry.geometryRegime,
      geometry_harvestable_candidate: geometry.geometryHarvestableCandidate,
      adaptive_spacing_formula_id: spacing.formulaId,
      adaptive_spacing_raw_adr: spacing.rawSpacingAdr,
      adaptive_spacing_adr: spacing.spacingAdr,
      adaptive_spacing_range_floor_adr: spacing.rangeFloorAdr,
      adaptive_range_condition_pass: spacing.rangeConditionPass,
      adaptive_signal_adr_brick: spacing.signalBrickAdr,
      adaptive_spacing_tradability_pass: spacing.tradabilityPass,
      trigger_candidates: sessionTriggers.length,
      long_trigger_candidates: sessionTriggers.filter((trigger) => trigger.trigger_side === "LONG").length,
      short_trigger_candidates: sessionTriggers.filter((trigger) => trigger.trigger_side === "SHORT").length,
    })];
  });
}

function buildDesignQuestionDiagnostics(options: {
  row: ReplayRow;
  bars: Bar[];
  rangeRatioPair: number | null;
  gridQuantumAdr: number;
  signalAdrBrick: number;
  allInCostAdr: number;
  costFloorMultiple: number;
  heatMaps: HeatMaps;
  triggerRows: TriggerCandidateRow[];
}) {
  const rows: Omit<DesignQuestionDiagnosticRow, "content_hash" | "pe_m1_5_session_avg" | "pe_m1_fast_slow_ema">[] = [];
  for (const window of buildDiagnosticSessionWindows(options.bars)) {
    const rangeBars = barsBetween(options.bars, window.rangeStartMs, window.rangeEndMs);
    const entryBars = barsBetween(options.bars, window.entryStartMs, window.entryEndMs);
    if (!rangeBars.length || !entryBars.length) continue;
    const rangeHigh = Math.max(...rangeBars.map((bar) => bar.high));
    const rangeLow = Math.min(...rangeBars.map((bar) => bar.low));
    const entryHigh = Math.max(...entryBars.map((bar) => bar.high));
    const entryLow = Math.min(...entryBars.map((bar) => bar.low));
    const sessionRangeAdr = rangeAdr(options.row, rangeHigh, rangeLow);
    const entryRangeAdr = rangeAdr(options.row, entryHigh, entryLow);
    const peM1 = pathEfficiency(entryBars);
    const peAdrEvent = pathEfficiency(adrEventBars(options.row, entryBars, options.signalAdrBrick));
    const geometry = geometryRegime({
      pathEfficiencyWeek: peM1,
      weekRangeAdr: sessionRangeAdr,
      rangeRatioPair: options.rangeRatioPair,
      gridQuantumAdr: options.gridQuantumAdr,
      allInCostAdr: options.allInCostAdr,
      costFloorMultiple: options.costFloorMultiple,
    });
    const spacing = adaptiveSpacing({
      rangeAdr: sessionRangeAdr,
      targetGridSlots: DEFAULT_TARGET_GRID_SLOTS,
      minSpacingAdr: DEFAULT_MIN_SPACING_ADR,
      maxSpacingAdr: DEFAULT_MAX_SPACING_ADR,
      allInCostAdr: options.allInCostAdr,
      costFloorMultiple: options.costFloorMultiple,
    });
    const archivedTriggers = window.boxModel === "archived_utc"
      ? options.triggerRows.filter((trigger) => trigger.session_id === window.id).length
      : 0;
    const pairHeat = options.heatMaps.pairHeat.get(`${options.row.week_open_utc}|${options.row.pair}`) ?? null;
    const accountHeat = options.heatMaps.accountHeat.get(options.row.week_open_utc) ?? null;
    const selectedHeat = pairHeat === null && accountHeat === null
      ? null
      : Math.max(pairHeat ?? 0, accountHeat ?? 0);
    const centerlineBlocked = geometry.geometryHarvestableCandidate && archivedTriggers === 0;
    rows.push({
      row_key: [
        options.row.week_open_utc,
        options.row.pair,
        window.boxModel,
        window.id,
      ].join("|"),
      question_scope: "path_efficiency_box_heat_alignment_centerline",
      week_open_utc: options.row.week_open_utc,
      pair: options.row.pair,
      candidate_b_side: options.row.candidate_b_side,
      box_model: window.boxModel,
      session_id: window.id,
      session_label: window.session,
      range_start_utc: iso(window.rangeStartMs),
      range_end_utc: iso(window.rangeEndMs),
      entry_start_utc: iso(window.entryStartMs),
      entry_end_utc: iso(window.entryEndMs),
      session_range_adr: round(sessionRangeAdr),
      pe_m1_1_session: round(peM1),
      pe_adr_event_1_session: round(peAdrEvent),
      entry_range_adr: round(entryRangeAdr),
      range_condition_pass: geometry.rangeConditionPass,
      geometry_regime_m1: geometry.geometryRegime,
      geometry_harvestable_candidate_m1: geometry.geometryHarvestableCandidate,
      archived_utc_trigger_candidates: archivedTriggers,
      centerline_only_blocked_candidate: centerlineBlocked,
      centerline_only_diagnostic_status: centerlineBlocked ? "blocked_diagnostic_only" : "not_applicable",
      neutral_alignment_allow_distance_adr: spacing.spacingAdr,
      neutral_alignment_penalty_distance_adr: spacing.spacingAdr === null ? null : round(spacing.spacingAdr * 1.25),
      pair_heat: round(pairHeat),
      account_heat: round(accountHeat),
      selected_heat: round(selectedHeat),
      heat_formula: "max_pair_account",
      profit_stop_mode: "receipt_only",
    });
  }
  return rows;
}

function addRollingPathEfficiencyDiagnostics(rows: Array<Omit<DesignQuestionDiagnosticRow, "content_hash" | "pe_m1_5_session_avg" | "pe_m1_fast_slow_ema">>) {
  const groups = new Map<string, Array<Omit<DesignQuestionDiagnosticRow, "content_hash" | "pe_m1_5_session_avg" | "pe_m1_fast_slow_ema">>>();
  for (const row of rows) {
    const key = `${row.pair}|${row.box_model}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const output: DesignQuestionDiagnosticRow[] = [];
  for (const groupRows of groups.values()) {
    const sorted = [...groupRows].sort((left, right) => left.entry_start_utc.localeCompare(right.entry_start_utc));
    let fast: number | null = null;
    let slow: number | null = null;
    const fastAlpha = 2 / (5 + 1);
    const slowAlpha = 2 / (20 + 1);
    const prior: number[] = [];
    for (const row of sorted) {
      const value = row.pe_m1_1_session;
      if (value !== null) {
        prior.push(value);
        fast = fast === null ? value : fast + fastAlpha * (value - fast);
        slow = slow === null ? value : slow + slowAlpha * (value - slow);
      }
      const lastFive = prior.slice(-5);
      output.push(withHash({
        ...row,
        pe_m1_5_session_avg: lastFive.length ? round(lastFive.reduce((sum, current) => sum + current, 0) / lastFive.length) : null,
        pe_m1_fast_slow_ema: fast !== null && slow !== null ? round(fast - slow) : null,
      }));
    }
  }
  return output.sort((left, right) =>
    left.week_open_utc.localeCompare(right.week_open_utc) ||
    left.pair.localeCompare(right.pair) ||
    left.box_model.localeCompare(right.box_model) ||
    left.entry_start_utc.localeCompare(right.entry_start_utc)
  );
}

async function loadRows(options: Options) {
  const allWeeks = await readTradeLegPathWarehouseWeekKeys(options.manifestId);
  const fromMs = Date.parse(options.weekFrom);
  const toMs = options.weekTo ? Date.parse(options.weekTo) : Number.POSITIVE_INFINITY;
  const selectedWeeks = allWeeks
    .filter((week) => Date.parse(week) >= fromMs && Date.parse(week) <= toMs)
    .slice(0, options.weekLimit);
  const rows: ReplayRow[] = [];
  for (const week of selectedWeeks) {
    if (options.logProgress) console.log(`gate90d loading week=${week}`);
    const weekRows = await readTradeLegPathWarehouseWeekRows({
      manifestId: options.manifestId,
      weekOpenUtc: week,
      pairs: options.pairs ?? undefined,
    });
    rows.push(...weekRows.map((row) => ({
      week_open_utc: row.week_open_utc,
      pair: row.pair,
      candidate_b_side: row.candidate_b_side,
      pair_adr_pct: row.pair_adr_pct,
      entry_price: row.entry_price,
      path_payload: row.path_payload,
    })));
  }
  return { selectedWeeks, rows };
}

async function readCsvRows(filePath: string) {
  const text = await import("node:fs/promises").then((fs) => fs.readFile(filePath, "utf8"));
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [] as Record<string, string>[];
  const headers = lines[0]!.split(",");
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function lockFloor(maxPnlAdr: number, quantumAdr: number) {
  if (maxPnlAdr >= 3 * quantumAdr) return Math.max(0.5 * quantumAdr, maxPnlAdr - quantumAdr);
  if (maxPnlAdr >= 2 * quantumAdr) return 0.5 * quantumAdr;
  if (maxPnlAdr >= quantumAdr) return 0;
  return null;
}

function profitStopReceiptFloor(maxPnlAdr: number, quantumAdr: number) {
  if (maxPnlAdr >= 3 * quantumAdr) return Math.max(0.5 * quantumAdr, maxPnlAdr - quantumAdr);
  if (maxPnlAdr >= 2 * quantumAdr) return 0.5 * quantumAdr;
  if (maxPnlAdr >= quantumAdr) return 0;
  return null;
}

async function buildLockRows(options: Options) {
  if (!options.closeEventsCsv) return [] as LockShadowRow[];
  const csvRows = await readCsvRows(options.closeEventsCsv);
  return csvRows.map((row, index) => {
    const maxPnlAdr = Number(row.max_pnl_adr ?? 0);
    const pricePnlAdr = Number(row.price_pnl_adr ?? 0);
    const floor = lockFloor(maxPnlAdr, options.lockQuantumAdr);
    const profitStopFloor = profitStopReceiptFloor(maxPnlAdr, options.lockQuantumAdr);
    const shadowPreserved = floor !== null && pricePnlAdr < floor ? floor - pricePnlAdr : 0;
    const profitStopPreserved = profitStopFloor !== null && pricePnlAdr < profitStopFloor ? profitStopFloor - pricePnlAdr : 0;
    const state: LockShadowRow["lock_shadow_state"] = floor === null
      ? "no_lock_mfe"
      : shadowPreserved > 0
        ? "would_have_preserved_mfe"
        : "protected_or_above_floor";
    const raw: Omit<LockShadowRow, "content_hash"> = {
      row_key: `${row.variant_id}|${index}|${row.pair}|${row.side}|${row.close_timestamp_utc}`,
      source_close_events_csv: toRepoRelative(options.closeEventsCsv!),
      variant_id: row.variant_id ?? "",
      pair: row.pair ?? "",
      side: (row.side as Side) ?? "LONG",
      close_reason: row.close_reason ?? "",
      close_timestamp_utc: row.close_timestamp_utc ?? "",
      anchor_week_open_utc: row.anchor_week_open_utc ?? "",
      fill_count: Number(row.fill_count ?? 0),
      adverse_fill_count: Number(row.adverse_fill_count ?? 0),
      price_pnl_adr: round(pricePnlAdr)!,
      min_pnl_adr: round(Number(row.min_pnl_adr ?? 0))!,
      max_pnl_adr: round(maxPnlAdr)!,
      cycle_quantum_adr: options.lockQuantumAdr,
      mfe_units: round(maxPnlAdr / options.lockQuantumAdr),
      lockout_1q_add_block: maxPnlAdr >= options.lockQuantumAdr,
      lockout_2q_add_block: maxPnlAdr >= 2 * options.lockQuantumAdr,
      lock_floor_adr: round(floor),
      lock_shadow_state: state,
      shadow_preserved_adr: round(shadowPreserved)!,
      profit_stop_receipt_mode: "receipt_only",
      profit_stop_floor_adr: round(profitStopFloor),
      profit_stop_shadow_preserved_adr: round(profitStopPreserved)!,
    };
    return withHash(raw);
  });
}

function aggregateSummary(options: {
  selectedWeeks: string[];
  pairFeatures: PairWeekFeatureRow[];
  triggerRows: TriggerCandidateRow[];
  lockRows: LockShadowRow[];
}) {
  const triggerSummary: Omit<SummaryRow, "content_hash"> = {
    scope: "trigger_feature_ledger",
    rows: options.pairFeatures.length,
    weeks: options.selectedWeeks.length,
    pairs: new Set(options.pairFeatures.map((row) => row.pair)).size,
    trigger_candidates: options.triggerRows.length,
    pairs_with_trigger: new Set(options.triggerRows.map((row) => `${row.week_open_utc}|${row.pair}`)).size,
    long_triggers: options.triggerRows.filter((row) => row.trigger_side === "LONG").length,
    short_triggers: options.triggerRows.filter((row) => row.trigger_side === "SHORT").length,
  };
  const lockPreserve = options.lockRows.filter((row) => row.lock_shadow_state === "would_have_preserved_mfe");
  const lockSummary: Omit<SummaryRow, "content_hash"> = {
    scope: "lock_shadow_ledger",
    rows: options.lockRows.length,
    weeks: new Set(options.lockRows.map((row) => row.anchor_week_open_utc)).size || null,
    pairs: new Set(options.lockRows.map((row) => row.pair)).size || null,
    lock_shadow_rows: options.lockRows.length,
    lock_preserve_candidates: lockPreserve.length,
    shadow_preserved_adr: round(lockPreserve.reduce((sum, row) => sum + row.shadow_preserved_adr, 0)),
  };
  return [withHash(triggerSummary), withHash(lockSummary)];
}

function triggerContextSummary(triggerRows: TriggerCandidateRow[]) {
  const buckets: Array<{ bucket: string; rows: TriggerCandidateRow[] }> = [
    { bucket: "all", rows: triggerRows },
    { bucket: "candidate_b_aligned", rows: triggerRows.filter((row) => row.candidate_b_alignment > 0) },
    { bucket: "candidate_b_contra_aligned", rows: triggerRows.filter((row) => row.candidate_b_contra_alignment > 0) },
    { bucket: "bb_true", rows: triggerRows.filter((row) => row.bb_sweep_context === true) },
    { bucket: "family_positive", rows: triggerRows.filter((row) => (row.family_alignment_context ?? 0) > 0) },
  ];
  return buckets.map(({ bucket, rows }) => withHash({
    bucket,
    trigger_candidates: rows.length,
    distinct_pair_weeks: new Set(rows.map((row) => `${row.week_open_utc}|${row.pair}`)).size,
    long_triggers: rows.filter((row) => row.trigger_side === "LONG").length,
    short_triggers: rows.filter((row) => row.trigger_side === "SHORT").length,
    bb_true: rows.filter((row) => row.bb_sweep_context === true).length,
    family_positive: rows.filter((row) => (row.family_alignment_context ?? 0) > 0).length,
    candidate_b_aligned: rows.filter((row) => row.candidate_b_alignment > 0).length,
    candidate_b_contra_aligned: rows.filter((row) => row.candidate_b_contra_alignment > 0).length,
  }));
}

function lockVariantSummary(lockRows: LockShadowRow[]) {
  const groups = new Map<string, LockShadowRow[]>();
  for (const row of lockRows) {
    const key = `${row.variant_id}|${row.close_reason}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()]
    .map(([key, rows]) => {
      const [variantId, closeReason] = key.split("|");
      const preserveRows = rows.filter((row) => row.lock_shadow_state === "would_have_preserved_mfe");
      const preserved = preserveRows.reduce((sum, row) => sum + row.shadow_preserved_adr, 0);
      return withHash({
        variant_id: variantId ?? "",
        close_reason: closeReason ?? "",
        rows: rows.length,
        preserve_candidates: preserveRows.length,
        shadow_preserved_adr: round(preserved)!,
        avg_shadow_preserved_adr: preserveRows.length ? round(preserved / preserveRows.length) : null,
        no_lock_mfe_rows: rows.filter((row) => row.lock_shadow_state === "no_lock_mfe").length,
        protected_or_above_floor_rows: rows.filter((row) => row.lock_shadow_state === "protected_or_above_floor").length,
      });
    })
    .sort((left, right) => right.shadow_preserved_adr - left.shadow_preserved_adr || right.preserve_candidates - left.preserve_candidates || left.variant_id.localeCompare(right.variant_id));
}

function geometryRegimeSummary(pairFeatures: PairWeekFeatureRow[]) {
  const groups = new Map<string, PairWeekFeatureRow[]>();
  for (const row of pairFeatures) groups.set(row.geometry_regime, [...(groups.get(row.geometry_regime) ?? []), row]);
  return [...groups.entries()]
    .map(([regime, rows]): GeometryRegimeSummaryRow => withHash({
      geometry_regime: regime,
      pair_weeks: rows.length,
      trigger_candidates: rows.reduce((sum, row) => sum + row.trigger_candidates, 0),
      long_trigger_candidates: rows.reduce((sum, row) => sum + row.long_trigger_candidates, 0),
      short_trigger_candidates: rows.reduce((sum, row) => sum + row.short_trigger_candidates, 0),
      avg_path_efficiency_week: round(average(rows.map((row) => row.path_efficiency_week))),
      avg_week_range_adr: round(average(rows.map((row) => row.week_range_adr))),
      avg_range_ratio_pair: round(average(rows.map((row) => row.range_ratio_pair))),
      avg_adaptive_spacing_adr: round(average(rows.map((row) => row.adaptive_spacing_adr))),
      range_condition_pass_pair_weeks: rows.filter((row) => row.range_condition_pass === true).length,
      adaptive_range_condition_pass_pair_weeks: rows.filter((row) => row.adaptive_range_condition_pass === true).length,
      harvestable_candidate_pair_weeks: rows.filter((row) => row.geometry_harvestable_candidate).length,
    }))
    .sort((left, right) => right.pair_weeks - left.pair_weeks || left.geometry_regime.localeCompare(right.geometry_regime));
}

function sessionGeometryRegimeSummary(sessionRows: SessionGeometryRow[]) {
  const groups = new Map<string, SessionGeometryRow[]>();
  for (const row of sessionRows) groups.set(row.geometry_regime, [...(groups.get(row.geometry_regime) ?? []), row]);
  return [...groups.entries()]
    .map(([regime, rows]): SessionGeometryRegimeSummaryRow => withHash({
      geometry_regime: regime,
      sessions: rows.length,
      trigger_candidates: rows.reduce((sum, row) => sum + row.trigger_candidates, 0),
      long_trigger_candidates: rows.reduce((sum, row) => sum + row.long_trigger_candidates, 0),
      short_trigger_candidates: rows.reduce((sum, row) => sum + row.short_trigger_candidates, 0),
      avg_entry_path_efficiency: round(average(rows.map((row) => row.entry_path_efficiency))),
      avg_session_range_adr: round(average(rows.map((row) => row.session_range_adr))),
      avg_entry_range_adr: round(average(rows.map((row) => row.entry_range_adr))),
      avg_adaptive_spacing_adr: round(average(rows.map((row) => row.adaptive_spacing_adr))),
      range_condition_pass_sessions: rows.filter((row) => row.range_condition_pass === true).length,
      adaptive_range_condition_pass_sessions: rows.filter((row) => row.adaptive_range_condition_pass === true).length,
      harvestable_candidate_sessions: rows.filter((row) => row.geometry_harvestable_candidate).length,
    }))
    .sort((left, right) => right.sessions - left.sessions || left.geometry_regime.localeCompare(right.geometry_regime));
}

function startModeSummary(rows: StartModeDiagnosticRow[]) {
  const groups = new Map<string, StartModeDiagnosticRow[]>();
  for (const row of rows) {
    const key = `${row.box_model}|${row.start_mode_id}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()]
    .map(([key, matching]): StartModeSummaryRow => {
      const [boxModel = "archived_utc", startModeId = "strict_sweep_rejection_displacement"] = key.split("|");
      const found = matching.filter((row) => row.start_status === "found");
      return withHash({
        box_model: boxModel as StartModeSummaryRow["box_model"],
        start_mode_id: startModeId as StartModeId,
        valid_geometry_sessions: matching.length,
        found_starts: found.length,
        blocked_no_start: matching.filter((row) => row.start_status === "blocked_no_start").length,
        blocked_no_david_side: matching.filter((row) => row.start_status === "blocked_no_david_side").length,
        long_starts: found.filter((row) => row.start_side === "LONG").length,
        short_starts: found.filter((row) => row.start_side === "SHORT").length,
        candidate_b_aligned_starts: found.filter((row) => row.candidate_b_alignment === 1).length,
        david_aligned_starts: found.filter((row) => row.david_alignment === 1).length,
        avg_pe_m1_1_session: round(average(matching.map((row) => row.pe_m1_1_session))),
        avg_pe_adr_event_1_session: round(average(matching.map((row) => row.pe_adr_event_1_session))),
        avg_session_range_adr: round(average(matching.map((row) => row.session_range_adr))),
        avg_adaptive_spacing_adr: round(average(matching.map((row) => row.adaptive_spacing_adr))),
        avg_start_delay_minutes: round(average(found.map((row) => row.start_delay_minutes_from_entry_start))),
        avg_start_distance_from_mid_adr: round(average(found.map((row) => row.start_distance_from_mid_adr))),
        avg_eod_mfe_adr: round(average(found.map((row) => row.eod_mfe_adr))),
        avg_eod_mae_adr: round(average(found.map((row) => row.eod_mae_adr))),
        eod_hit_1q_starts: found.filter((row) => row.eod_hit_1q === true).length,
        eod_hit_2q_starts: found.filter((row) => row.eod_hit_2q === true).length,
        eod_hit_3q_starts: found.filter((row) => row.eod_hit_3q === true).length,
        avg_next_day_mfe_adr: round(average(found.map((row) => row.next_day_mfe_adr))),
        avg_next_day_mae_adr: round(average(found.map((row) => row.next_day_mae_adr))),
        next_day_hit_1q_starts: found.filter((row) => row.next_day_hit_1q === true).length,
        next_day_hit_2q_starts: found.filter((row) => row.next_day_hit_2q === true).length,
        next_day_hit_3q_starts: found.filter((row) => row.next_day_hit_3q === true).length,
        avg_full_available_mfe_adr: round(average(found.map((row) => row.full_available_mfe_adr))),
        full_available_hit_1q_starts: found.filter((row) => row.hold_until_profit_first_1q_timestamp_utc !== null).length,
        full_available_hit_2q_starts: found.filter((row) => row.hold_until_profit_first_2q_timestamp_utc !== null).length,
        full_available_hit_3q_starts: found.filter((row) => row.hold_until_profit_first_3q_timestamp_utc !== null).length,
      });
    })
    .sort((left, right) =>
      left.box_model.localeCompare(right.box_model) ||
      left.start_mode_id.localeCompare(right.start_mode_id)
    );
}

function buildStartTraceabilityRows(options: {
  closeEventRows: Record<string, string>[];
  closeEventsCsv: string | null;
  triggerRows: TriggerCandidateRow[];
  pairFeatures: PairWeekFeatureRow[];
}) {
  if (!options.closeEventsCsv) return [] as StartTraceabilityRow[];
  const triggerGroups = new Map<string, TriggerCandidateRow[]>();
  for (const trigger of options.triggerRows) {
    const key = `${trigger.week_open_utc}|${trigger.pair}|${trigger.trigger_side}`;
    triggerGroups.set(key, [...(triggerGroups.get(key) ?? []), trigger].sort((left, right) => left.displacement_timestamp_utc.localeCompare(right.displacement_timestamp_utc)));
  }
  const featureByPairWeek = new Map(options.pairFeatures.map((row) => [`${row.week_open_utc}|${row.pair}`, row]));
  return options.closeEventRows.map((row, index) => {
    const week = row.anchor_week_open_utc ?? "";
    const pair = row.pair ?? "";
    const side = (row.side as Side) ?? "LONG";
    const startRaw = (row.start_timestamp_utc ?? "").trim();
    const feature = featureByPairWeek.get(`${week}|${pair}`);
    let matched: TriggerCandidateRow | null = null;
    let status: StartTraceabilityRow["start_trace_status"] = "missing_start_timestamp";
    let minutesFromTrigger: number | null = null;
    if (startRaw) {
      const startMs = Date.parse(startRaw);
      if (!Number.isFinite(startMs)) {
        status = "invalid_start_timestamp";
      } else {
        const candidates = triggerGroups.get(`${week}|${pair}|${side}`) ?? [];
        matched = [...candidates]
          .reverse()
          .find((trigger) => Date.parse(trigger.displacement_timestamp_utc) <= startMs && startMs <= Date.parse(trigger.entry_end_utc)) ?? null;
        if (matched) {
          status = "matched_prior_trigger";
          minutesFromTrigger = (startMs - Date.parse(matched.displacement_timestamp_utc)) / 60_000;
        } else {
          status = "no_in_session_trigger";
        }
      }
    }
    return withHash({
      row_key: `${row.variant_id ?? ""}|${row.cycle_id ?? index}|${pair}|${side}|${row.close_timestamp_utc ?? ""}`,
      source_close_events_csv: toRepoRelative(options.closeEventsCsv!),
      variant_id: row.variant_id ?? "",
      activation_rule_id: row.activation_rule_id ?? "",
      cycle_id: row.cycle_id ?? "",
      pair,
      side,
      close_reason: row.close_reason ?? "",
      anchor_week_open_utc: week,
      start_timestamp_utc: startRaw || null,
      close_timestamp_utc: row.close_timestamp_utc ?? "",
      fill_count: Number(row.fill_count ?? 0),
      price_pnl_adr: round(optionalNumber(row.price_pnl_adr)),
      price_pnl_usd: round(optionalNumber(row.price_pnl_usd)),
      commission_usd: round(optionalNumber(row.commission_usd)),
      swap_usd: round(optionalNumber(row.swap_usd)),
      net_usd: round(optionalNumber(row.net_usd)),
      min_pnl_adr: round(optionalNumber(row.min_pnl_adr)),
      max_pnl_adr: round(optionalNumber(row.max_pnl_adr)),
      geometry_source: matched ? "matched_trigger_session" : feature ? "pair_week_fallback" : "none",
      geometry_regime: matched?.geometry_regime ?? feature?.geometry_regime ?? null,
      range_condition_pass: matched?.range_condition_pass ?? feature?.range_condition_pass ?? null,
      geometry_harvestable_candidate: matched?.geometry_harvestable_candidate ?? feature?.geometry_harvestable_candidate ?? null,
      matched_trigger_row_key: matched?.row_key ?? null,
      matched_trigger_displacement_timestamp_utc: matched?.displacement_timestamp_utc ?? null,
      minutes_from_trigger_to_start: round(minutesFromTrigger),
      start_trace_status: status,
    });
  });
}

function startTraceabilitySummary(rows: StartTraceabilityRow[]) {
  const statuses: StartTraceabilityRow["start_trace_status"][] = [
    "missing_start_timestamp",
    "invalid_start_timestamp",
    "matched_prior_trigger",
    "no_in_session_trigger",
  ];
  return statuses.map((status): StartTraceabilitySummaryRow => {
    const matching = rows.filter((row) => row.start_trace_status === status);
    const netValues = matching.map((row) => row.net_usd).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const grossProfit = netValues.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
    const grossLossAbs = Math.abs(netValues.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
    const netUsd = netValues.reduce((sum, value) => sum + value, 0);
    return withHash({
      start_trace_status: status,
      rows: matching.length,
      session_flatten_rows: matching.filter((row) => row.close_reason === "session_flatten").length,
      target_rows: matching.filter((row) => row.close_reason === "target").length,
      net_usd: netValues.length ? round(netUsd) : null,
      avg_net_usd: netValues.length ? round(netUsd / netValues.length) : null,
      gross_profit_usd: netValues.length ? round(grossProfit) : null,
      gross_loss_abs_usd: netValues.length ? round(grossLossAbs) : null,
      profit_factor: grossLossAbs > 0 ? round(grossProfit / grossLossAbs) : grossProfit > 0 ? null : null,
      win_pct: netValues.length ? round(100 * netValues.filter((value) => value > 0).length / netValues.length) : null,
      avg_minutes_from_trigger_to_start: round(average(matching.map((row) => row.minutes_from_trigger_to_start))),
    });
  });
}

function startTraceabilityVariantSummary(rows: StartTraceabilityRow[]) {
  const groups = new Map<string, StartTraceabilityRow[]>();
  for (const row of rows) {
    const key = `${row.variant_id}|${row.activation_rule_id}|${row.start_trace_status}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()]
    .map(([key, matching]): StartTraceabilityVariantSummaryRow => {
      const [variantId = "", activationRuleId = "", status = "missing_start_timestamp"] = key.split("|");
      const netValues = matching.map((row) => row.net_usd).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
      const grossProfit = netValues.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
      const grossLossAbs = Math.abs(netValues.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
      const netUsd = netValues.reduce((sum, value) => sum + value, 0);
      return withHash({
        variant_id: variantId,
        activation_rule_id: activationRuleId,
        start_trace_status: status as StartTraceabilityRow["start_trace_status"],
        rows: matching.length,
        session_flatten_rows: matching.filter((row) => row.close_reason === "session_flatten").length,
        target_rows: matching.filter((row) => row.close_reason === "target").length,
        net_usd: netValues.length ? round(netUsd) : null,
        avg_net_usd: netValues.length ? round(netUsd / netValues.length) : null,
        gross_profit_usd: netValues.length ? round(grossProfit) : null,
        gross_loss_abs_usd: netValues.length ? round(grossLossAbs) : null,
        profit_factor: grossLossAbs > 0 ? round(grossProfit / grossLossAbs) : grossProfit > 0 ? null : null,
        win_pct: netValues.length ? round(100 * netValues.filter((value) => value > 0).length / netValues.length) : null,
        avg_price_pnl_adr: round(average(matching.map((row) => row.price_pnl_adr))),
        avg_max_pnl_adr: round(average(matching.map((row) => row.max_pnl_adr))),
        avg_minutes_from_trigger_to_start: round(average(matching.map((row) => row.minutes_from_trigger_to_start))),
      });
    })
    .sort((left, right) => left.variant_id.localeCompare(right.variant_id) || left.start_trace_status.localeCompare(right.start_trace_status));
}

function startTraceabilityGeometrySummary(rows: StartTraceabilityRow[]) {
  const groups = new Map<string, StartTraceabilityRow[]>();
  for (const row of rows) {
    const key = [
      row.start_trace_status,
      row.geometry_source,
      row.geometry_regime ?? "none",
      row.range_condition_pass === null ? "null" : String(row.range_condition_pass),
      row.geometry_harvestable_candidate === null ? "null" : String(row.geometry_harvestable_candidate),
    ].join("|");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()]
    .map(([key, matching]): StartTraceabilityGeometrySummaryRow => {
      const [status = "missing_start_timestamp", geometrySource = "none", geometryRegime = "none", rangePassRaw = "null", harvestableRaw = "null"] = key.split("|");
      const netValues = matching.map((row) => row.net_usd).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
      const grossProfit = netValues.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
      const grossLossAbs = Math.abs(netValues.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
      const netUsd = netValues.reduce((sum, value) => sum + value, 0);
      return withHash({
        start_trace_status: status as StartTraceabilityRow["start_trace_status"],
        geometry_source: geometrySource as StartTraceabilityRow["geometry_source"],
        geometry_regime: geometryRegime,
        range_condition_pass: rangePassRaw === "null" ? null : rangePassRaw === "true",
        geometry_harvestable_candidate: harvestableRaw === "null" ? null : harvestableRaw === "true",
        rows: matching.length,
        session_flatten_rows: matching.filter((row) => row.close_reason === "session_flatten").length,
        target_rows: matching.filter((row) => row.close_reason === "target").length,
        net_usd: netValues.length ? round(netUsd) : null,
        avg_net_usd: netValues.length ? round(netUsd / netValues.length) : null,
        gross_profit_usd: netValues.length ? round(grossProfit) : null,
        gross_loss_abs_usd: netValues.length ? round(grossLossAbs) : null,
        profit_factor: grossLossAbs > 0 ? round(grossProfit / grossLossAbs) : grossProfit > 0 ? null : null,
        win_pct: netValues.length ? round(100 * netValues.filter((value) => value > 0).length / netValues.length) : null,
        avg_price_pnl_adr: round(average(matching.map((row) => row.price_pnl_adr))),
        avg_max_pnl_adr: round(average(matching.map((row) => row.max_pnl_adr))),
        avg_minutes_from_trigger_to_start: round(average(matching.map((row) => row.minutes_from_trigger_to_start))),
      });
    })
    .sort((left, right) =>
      left.start_trace_status.localeCompare(right.start_trace_status) ||
      left.geometry_source.localeCompare(right.geometry_source) ||
      right.rows - left.rows ||
      left.geometry_regime.localeCompare(right.geometry_regime)
    );
}

async function main() {
  const options = parseOptions();
  await mkdir(options.artifactDir, { recursive: true });
  const manifest = await readTradeLegPathWarehouseManifest(options.manifestId);
  const { selectedWeeks, rows } = await loadRows(options);
  const barsByKey = new Map(rows.map((row) => [`${row.week_open_utc}|${row.pair}`, barsFromRow(row)]));
  const closeEventRows = options.closeEventsCsv ? await readCsvRows(options.closeEventsCsv) : [];
  const heatMaps = buildHeatMaps(closeEventRows);
  const strengthsByWeek = new Map<string, Map<string, number>>();
  for (const week of selectedWeeks) {
    const weekRows = rows.filter((row) => row.week_open_utc === week);
    strengthsByWeek.set(week, computeCurrencyStrength(weekRows, barsByKey));
  }

  const rawRangeRows = rows.map((row) => {
    const bars = barsByKey.get(`${row.week_open_utc}|${row.pair}`) ?? [];
    return {
      pair: row.pair,
      week: row.week_open_utc,
      rangeAdr: bars.length ? rangeAdr(row, Math.max(...bars.map((bar) => bar.high)), Math.min(...bars.map((bar) => bar.low))) : null,
    };
  });
  const rangeRatios = new Map<string, number | null>();
  for (const pair of [...new Set(rawRangeRows.map((row) => row.pair))].sort()) {
    const ratios = rangeRatioForRows(rawRangeRows.filter((row) => row.pair === pair).sort((left, right) => left.week.localeCompare(right.week)));
    for (const [week, value] of ratios) rangeRatios.set(`${week}|${pair}`, value);
  }

  const triggerRows: TriggerCandidateRow[] = [];
  const pairFeatures: PairWeekFeatureRow[] = [];
  const sessionGeometryRows: SessionGeometryRow[] = [];
  const designQuestionDiagnosticBaseRows: Array<Omit<DesignQuestionDiagnosticRow, "content_hash" | "pe_m1_5_session_avg" | "pe_m1_fast_slow_ema">> = [];
  const startModeDiagnosticRows: StartModeDiagnosticRow[] = [];
  for (const row of rows) {
    const bars = barsByKey.get(`${row.week_open_utc}|${row.pair}`) ?? [];
    const pe = pathEfficiency(bars);
    const rr = rangeRatios.get(`${row.week_open_utc}|${row.pair}`) ?? null;
    const weekRangeAdr = rawRangeRows.find((rangeRow) => rangeRow.week === row.week_open_utc && rangeRow.pair === row.pair)?.rangeAdr ?? null;
    const geometry = geometryRegime({
      pathEfficiencyWeek: pe,
      weekRangeAdr,
      rangeRatioPair: rr,
      gridQuantumAdr: options.gridQuantumAdr,
      allInCostAdr: options.allInCostAdr,
      costFloorMultiple: options.costFloorMultiple,
    });
    const strengths = strengthsByWeek.get(row.week_open_utc) ?? new Map();
    const rowTriggers = detectTriggers({
      row,
      bars,
      pathEfficiencyWeek: pe,
      rangeRatioPair: rr,
      gridQuantumAdr: options.gridQuantumAdr,
      signalAdrBrick: options.signalAdrBrick,
      allInCostAdr: options.allInCostAdr,
      costFloorMultiple: options.costFloorMultiple,
      targetGridSlots: options.targetGridSlots,
      minSpacingAdr: options.minSpacingAdr,
      maxSpacingAdr: options.maxSpacingAdr,
      strengths,
    });
    triggerRows.push(...rowTriggers);
    designQuestionDiagnosticBaseRows.push(...buildDesignQuestionDiagnostics({
      row,
      bars,
      rangeRatioPair: rr,
      gridQuantumAdr: options.gridQuantumAdr,
      signalAdrBrick: options.signalAdrBrick,
      allInCostAdr: options.allInCostAdr,
      costFloorMultiple: options.costFloorMultiple,
      heatMaps,
      triggerRows: rowTriggers,
    }));
    startModeDiagnosticRows.push(...buildStartModeDiagnostics({
      row,
      bars,
      rangeRatioPair: rr,
      gridQuantumAdr: options.gridQuantumAdr,
      allInCostAdr: options.allInCostAdr,
      costFloorMultiple: options.costFloorMultiple,
      targetGridSlots: options.targetGridSlots,
      minSpacingAdr: options.minSpacingAdr,
      maxSpacingAdr: options.maxSpacingAdr,
    }));
    sessionGeometryRows.push(...buildSessionGeometryRows({
      row,
      bars,
      rangeRatioPair: rr,
      gridQuantumAdr: options.gridQuantumAdr,
      allInCostAdr: options.allInCostAdr,
      costFloorMultiple: options.costFloorMultiple,
      targetGridSlots: options.targetGridSlots,
      minSpacingAdr: options.minSpacingAdr,
      maxSpacingAdr: options.maxSpacingAdr,
      triggerRows: rowTriggers,
    }));
    const longContext = triggerFamilyContext(row.pair, "LONG", strengths);
    const shortContext = triggerFamilyContext(row.pair, "SHORT", strengths);
    const spacing = adaptiveSpacing({
      rangeAdr: weekRangeAdr,
      targetGridSlots: options.targetGridSlots,
      minSpacingAdr: options.minSpacingAdr,
      maxSpacingAdr: options.maxSpacingAdr,
      allInCostAdr: options.allInCostAdr,
      costFloorMultiple: options.costFloorMultiple,
    });
    const rawFeature: Omit<PairWeekFeatureRow, "content_hash"> = {
      row_key: `${row.week_open_utc}|${row.pair}`,
      week_open_utc: row.week_open_utc,
      pair: row.pair,
      candidate_b_side: row.candidate_b_side,
      path_efficiency_week: round(pe),
      week_range_adr: round(weekRangeAdr),
      range_ratio_pair: round(rr),
      efficiency_bucket: geometry.efficiencyBucket,
      range_floor_adr: round(geometry.rangeFloorAdr)!,
      range_condition_pass: geometry.rangeConditionPass,
      range_expansion_bucket: geometry.rangeExpansionBucket,
      geometry_regime: geometry.geometryRegime,
      geometry_harvestable_candidate: geometry.geometryHarvestableCandidate,
      all_in_cost_adr: options.allInCostAdr > 0 ? round(options.allInCostAdr) : null,
      cost_floor_multiple: options.costFloorMultiple,
      cost_floor_quantum_adr: round(geometry.costFloorQuantumAdr),
      cost_safe_quantum_pass: geometry.costSafeQuantumPass,
      grid_quantum_adr: options.gridQuantumAdr,
      signal_adr_brick: options.signalAdrBrick,
      adaptive_spacing_formula_id: spacing.formulaId,
      adaptive_spacing_raw_adr: spacing.rawSpacingAdr,
      adaptive_spacing_adr: spacing.spacingAdr,
      adaptive_spacing_range_floor_adr: spacing.rangeFloorAdr,
      adaptive_range_condition_pass: spacing.rangeConditionPass,
      adaptive_signal_adr_brick: spacing.signalBrickAdr,
      adaptive_spacing_tradability_pass: spacing.tradabilityPass,
      trigger_candidates: rowTriggers.length,
      long_trigger_candidates: rowTriggers.filter((trigger) => trigger.trigger_side === "LONG").length,
      short_trigger_candidates: rowTriggers.filter((trigger) => trigger.trigger_side === "SHORT").length,
      first_trigger_timestamp_utc: rowTriggers.map((trigger) => trigger.sweep_timestamp_utc).sort()[0] ?? null,
      family_alignment_long_context: round(longContext.family),
      family_alignment_short_context: round(shortContext.family),
    };
    pairFeatures.push(withHash(rawFeature));
  }

  const designQuestionDiagnosticRows = addRollingPathEfficiencyDiagnostics(designQuestionDiagnosticBaseRows);
  const lockRows = await buildLockRows(options);
  const summaryRows = aggregateSummary({ selectedWeeks, pairFeatures, triggerRows, lockRows });
  const triggerContextRows = triggerContextSummary(triggerRows);
  const lockVariantRows = lockVariantSummary(lockRows);
  const geometryRegimeRows = geometryRegimeSummary(pairFeatures);
  const sessionGeometryRegimeRows = sessionGeometryRegimeSummary(sessionGeometryRows);
  const startModeSummaryRows = startModeSummary(startModeDiagnosticRows);
  const startTraceRows = buildStartTraceabilityRows({
    closeEventRows,
    closeEventsCsv: options.closeEventsCsv,
    triggerRows,
    pairFeatures,
  });
  const startTraceSummaryRows = startTraceabilitySummary(startTraceRows);
  const startTraceVariantSummaryRows = startTraceabilityVariantSummary(startTraceRows);
  const startTraceGeometrySummaryRows = startTraceabilityGeometrySummary(startTraceRows);
  const formulaContract = {
    formula_id: FORMULA_ID,
    status: "feature_ledger_contract_no_replay",
    structural_constants: {
      path_efficiency_low_max: PATH_EFFICIENCY_LOW_MAX,
      path_efficiency_high_min: PATH_EFFICIENCY_HIGH_MIN,
      range_floor_min_adr: RANGE_FLOOR_MIN_ADR,
      range_floor_quantum_multiple: RANGE_FLOOR_QUANTUM_MULTIPLE,
      range_expanded_min_ratio: RANGE_EXPANDED_MIN_RATIO,
      range_compressed_max_ratio: RANGE_COMPRESSED_MAX_RATIO,
      cost_floor_multiple: options.costFloorMultiple,
      grid_quantum_adr: options.gridQuantumAdr,
      signal_adr_brick: options.signalAdrBrick,
      adaptive_spacing_formula_id: SPACING_FORMULA_ID,
      target_grid_slots: options.targetGridSlots,
      min_spacing_adr: options.minSpacingAdr,
      max_spacing_adr: options.maxSpacingAdr,
      min_signal_brick_adr: DEFAULT_MIN_SIGNAL_BRICK_ADR,
      max_signal_brick_adr: DEFAULT_MAX_SIGNAL_BRICK_ADR,
      sweep_depth_quantum_multiple: 0.25,
      displacement_body_quantum_multiple: 0.25,
      displacement_close_zone: 0.3,
      diagnostic_box_models: ["archived_utc", "ny_clean_et"],
      diagnostic_path_efficiency_modes: ["m1_1_session", "adr_event_1_session", "m1_5_session_avg", "m1_fast_slow_ema"],
      start_mode_geometry_basis: START_MODE_GEOMETRY_BASIS,
      start_mode_diagnostics: [
        "strict_sweep_rejection_displacement",
        "relaxed_sweep_rejection",
        "first_mean_extension_touch",
        "candidate_b_geometry_start",
        "david_contra_geometry_start",
      ],
      start_mode_david_settings: DAVID_DIAGNOSTIC_SETTINGS,
      excursion_receipts: {
        terms: ["MFE_maximum_favorable_excursion", "MAE_maximum_adverse_excursion"],
        horizons: ["next_ny_1600_flatten", "one_additional_ny_1600_flatten", "full_available_pair_week_path"],
        target_unit_receipts: ["1Q", "2Q", "3Q"],
        same_bar_lookahead_policy: "exclude_start_bar_high_low",
      },
      heat_formula: "max(pair_heat, account_heat)",
      neutral_alignment_penalty_distance_multiplier: 1.25,
      lockout_receipt_thresholds: ["1Q_add_block", "2Q_add_block"],
      profit_stop_mode: "receipt_only",
    },
    data_contracts: {
      warehouse_manifest_id: options.manifestId,
      warehouse_hash: manifest.warehouse_hash,
      price_bundle_id: manifest.price_bundle_id,
      canonical_m1_source: "gate74b path_payload timestamped M1 OHLC reconstruction",
      close_event_source: options.closeEventsCsv ? toRepoRelative(options.closeEventsCsv) : null,
    },
    point_in_time_contract: "feature ledger only; replay-grade decisions must use prior completed sessions or current-session state observed at decision timestamp",
    v0_gate_switches: {
      candidate_b_required_for_replay_starts: true,
      centerline_only_reversion: "diagnostic_only",
      bb_context: "log_only",
      family_context: "log_only",
      full_handshake: "disabled",
      profit_stop: "receipt_only_unless_explicit_replay_mode",
    },
  };
  const formulaConfig = {
    receipt_generated_at_utc: new Date().toISOString(),
    formula_contract_hash: sha256Stable(formulaContract),
    formula_contract: formulaContract,
    content_hash: sha256Stable(formulaContract),
  };
  const config = withHash({
    gate_id: GATE_ID,
    generated_at_utc: new Date().toISOString(),
    git_commit: gitCommit(),
    command: COMMAND,
    manifest_id: options.manifestId,
    warehouse_hash: manifest.warehouse_hash,
    price_bundle_id: manifest.price_bundle_id,
    selected_weeks: selectedWeeks,
    selected_pairs: options.pairs ?? manifest.universe_symbols,
    signal_adr_brick: options.signalAdrBrick,
    grid_quantum_adr: options.gridQuantumAdr,
    adaptive_spacing_formula_id: SPACING_FORMULA_ID,
    target_grid_slots: options.targetGridSlots,
    min_spacing_adr: options.minSpacingAdr,
    max_spacing_adr: options.maxSpacingAdr,
    all_in_cost_adr: options.allInCostAdr > 0 ? options.allInCostAdr : null,
    cost_floor_multiple: options.costFloorMultiple,
    formula_contract_hash: formulaConfig.formula_contract_hash,
    close_events_csv: options.closeEventsCsv ? toRepoRelative(options.closeEventsCsv) : null,
    lock_quantum_adr: options.lockQuantumAdr,
    scope_boundary: "feature_and_shadow_audit_only_no_trading_replay_no_full_handshake",
  });

  const configPath = path.join(options.artifactDir, "gate90d-config.json");
  const formulaConfigPath = path.join(options.artifactDir, "gate90d-formula-config.json");
  const featureBase = path.join(options.artifactDir, "pair-week-feature.rows");
  const sessionGeometryBase = path.join(options.artifactDir, "session-geometry.rows");
  const designQuestionDiagnosticBase = path.join(options.artifactDir, "design-question-diagnostic.rows");
  const startModeDiagnosticBase = path.join(options.artifactDir, "start-mode-diagnostic.rows");
  const startModeSummaryBase = path.join(options.artifactDir, "start-mode-summary.rows");
  const triggerBase = path.join(options.artifactDir, "katarakti-trigger-candidates.rows");
  const lockBase = path.join(options.artifactDir, "grid-lock-shadow.rows");
  const summaryBase = path.join(options.artifactDir, "gate90d-summary.rows");
  const triggerContextBase = path.join(options.artifactDir, "trigger-context-summary.rows");
  const lockVariantBase = path.join(options.artifactDir, "grid-lock-shadow-by-variant.rows");
  const geometryRegimeBase = path.join(options.artifactDir, "geometry-regime-summary.rows");
  const sessionGeometryRegimeBase = path.join(options.artifactDir, "session-geometry-regime-summary.rows");
  const startTraceBase = path.join(options.artifactDir, "start-traceability.rows");
  const startTraceSummaryBase = path.join(options.artifactDir, "start-traceability-summary.rows");
  const startTraceVariantSummaryBase = path.join(options.artifactDir, "start-traceability-by-variant.rows");
  const startTraceGeometrySummaryBase = path.join(options.artifactDir, "start-traceability-by-geometry.rows");
  const shaPath = path.join(options.artifactDir, "gate90d-triangle-shadow-audit-sha256.txt");

  await writeJson(configPath, config);
  await writeJson(formulaConfigPath, formulaConfig);
  await writeRows(featureBase, pairFeatures);
  await writeRows(sessionGeometryBase, sessionGeometryRows as unknown as Array<Record<string, unknown>>);
  await writeRows(designQuestionDiagnosticBase, designQuestionDiagnosticRows as unknown as Array<Record<string, unknown>>);
  await writeRows(startModeDiagnosticBase, startModeDiagnosticRows as unknown as Array<Record<string, unknown>>);
  await writeRows(startModeSummaryBase, startModeSummaryRows as unknown as Array<Record<string, unknown>>);
  await writeRows(triggerBase, triggerRows);
  await writeRows(lockBase, lockRows);
  await writeRows(summaryBase, summaryRows);
  await writeRows(triggerContextBase, triggerContextRows);
  await writeRows(lockVariantBase, lockVariantRows);
  await writeRows(geometryRegimeBase, geometryRegimeRows as unknown as Array<Record<string, unknown>>);
  await writeRows(sessionGeometryRegimeBase, sessionGeometryRegimeRows as unknown as Array<Record<string, unknown>>);
  await writeRows(startTraceBase, startTraceRows as unknown as Array<Record<string, unknown>>);
  await writeRows(startTraceSummaryBase, startTraceSummaryRows as unknown as Array<Record<string, unknown>>);
  await writeRows(startTraceVariantSummaryBase, startTraceVariantSummaryRows as unknown as Array<Record<string, unknown>>);
  await writeRows(startTraceGeometrySummaryBase, startTraceGeometrySummaryRows as unknown as Array<Record<string, unknown>>);

  const startTraceSummaryByStatus = new Map(startTraceSummaryRows.map((row) => [row.start_trace_status, row]));
  const missingStartTraceRows = startTraceSummaryByStatus.get("missing_start_timestamp")?.rows ?? 0;
  const matchedStartTraceRows = startTraceSummaryByStatus.get("matched_prior_trigger")?.rows ?? 0;
  const noInSessionTriggerRows = startTraceSummaryByStatus.get("no_in_session_trigger")?.rows ?? 0;
  const startTraceRead =
    !options.closeEventsCsv
      ? "- No close-event source was supplied, so `start-traceability.rows.*` is empty for this pass."
      : missingStartTraceRows === startTraceRows.length
        ? "- The supplied close-event source does not include cycle start timestamps, so this generated pass reports those rows as `missing_start_timestamp`."
        : matchedStartTraceRows > 0
          ? `- The supplied close-event source includes cycle start timestamps; this pass matched ${matchedStartTraceRows} close events to prior in-session trigger candidates and left ${noInSessionTriggerRows} without a valid same-session trigger.`
          : `- The supplied close-event source includes cycle start timestamps, but no close events matched a prior in-session trigger candidate; ${noInSessionTriggerRows} rows remain ` +
            "`no_in_session_trigger`.";
  const archivedDiagnosticRows = designQuestionDiagnosticRows.filter((row) => row.box_model === "archived_utc");
  const nyCleanDiagnosticRows = designQuestionDiagnosticRows.filter((row) => row.box_model === "ny_clean_et");
  const lockout1qRows = lockRows.filter((row) => row.lockout_1q_add_block);
  const lockout2qRows = lockRows.filter((row) => row.lockout_2q_add_block);
  const profitStopPreserveRows = lockRows.filter((row) => row.profit_stop_shadow_preserved_adr > 0);
  const designQuestionRead = [
    `- Design-question ledger rows: \`${designQuestionDiagnosticRows.length}\` total; archived UTC \`${archivedDiagnosticRows.length}\`, NY-clean ET \`${nyCleanDiagnosticRows.length}\`.`,
    `- Harvestable geometry rows: archived UTC \`${archivedDiagnosticRows.filter((row) => row.geometry_harvestable_candidate_m1).length}\`, NY-clean ET \`${nyCleanDiagnosticRows.filter((row) => row.geometry_harvestable_candidate_m1).length}\`.`,
    `- Blocked centerline-only diagnostic rows: archived UTC \`${archivedDiagnosticRows.filter((row) => row.centerline_only_blocked_candidate).length}\`, NY-clean ET \`${nyCleanDiagnosticRows.filter((row) => row.centerline_only_blocked_candidate).length}\`; these remain blocked diagnostics, not replay starts.`,
    `- Average PE comparison: archived UTC M1 \`${round(average(archivedDiagnosticRows.map((row) => row.pe_m1_1_session)))}\` vs ADR-event \`${round(average(archivedDiagnosticRows.map((row) => row.pe_adr_event_1_session)))}\`; NY-clean ET M1 \`${round(average(nyCleanDiagnosticRows.map((row) => row.pe_m1_1_session)))}\` vs ADR-event \`${round(average(nyCleanDiagnosticRows.map((row) => row.pe_adr_event_1_session)))}\`.`,
    `- Lockout/profit receipts: \`${lockout1qRows.length}\` rows hit 1Q add-block, \`${lockout2qRows.length}\` rows hit 2Q add-block, profit-stop remains receipt-only with \`${profitStopPreserveRows.length}\` preserve candidates.`,
  ];
  const startModeSummaryByKey = new Map(startModeSummaryRows.map((row) => [`${row.box_model}|${row.start_mode_id}`, row]));
  const startModeFound = (boxModel: StartModeSummaryRow["box_model"], modeId: StartModeId) =>
    startModeSummaryByKey.get(`${boxModel}|${modeId}`)?.found_starts ?? 0;
  const startModeValid = (boxModel: StartModeSummaryRow["box_model"], modeId: StartModeId) =>
    startModeSummaryByKey.get(`${boxModel}|${modeId}`)?.valid_geometry_sessions ?? 0;
  const startModeRead = [
    `- Start-mode diagnostic rows: \`${startModeDiagnosticRows.length}\` across ADR-event harvestable geometry sessions; archived UTC denominator \`${startModeValid("archived_utc", "strict_sweep_rejection_displacement")}\`, NY-clean ET denominator \`${startModeValid("ny_clean_et", "strict_sweep_rejection_displacement")}\`.`,
    `- Strict versus relaxed starts: archived UTC strict \`${startModeFound("archived_utc", "strict_sweep_rejection_displacement")}\`, relaxed \`${startModeFound("archived_utc", "relaxed_sweep_rejection")}\`; NY-clean ET strict \`${startModeFound("ny_clean_et", "strict_sweep_rejection_displacement")}\`, relaxed \`${startModeFound("ny_clean_et", "relaxed_sweep_rejection")}\`.`,
    `- Geometry-only start shapes: archived UTC mean-extension \`${startModeFound("archived_utc", "first_mean_extension_touch")}\`, Candidate B \`${startModeFound("archived_utc", "candidate_b_geometry_start")}\`, David contra \`${startModeFound("archived_utc", "david_contra_geometry_start")}\`; NY-clean ET mean-extension \`${startModeFound("ny_clean_et", "first_mean_extension_touch")}\`, Candidate B \`${startModeFound("ny_clean_et", "candidate_b_geometry_start")}\`, David contra \`${startModeFound("ny_clean_et", "david_contra_geometry_start")}\`.`,
    "- Start-mode rows now include MFE/MAE excursion receipts: next NY 16:00 flatten, one additional NY 16:00 flatten, and full available pair-week path, with 1Q/2Q/3Q target-hit flags.",
    `- David diagnostic settings: \`${DAVID_DIAGNOSTIC_SETTINGS.signalClock}\`, brick \`${DAVID_DIAGNOSTIC_SETTINGS.signalAdrBrick} ADR\`, LWMA \`${DAVID_DIAGNOSTIC_SETTINGS.maPeriod}\`, RSI \`${DAVID_DIAGNOSTIC_SETTINGS.rsiPeriod}\`, OB/OS \`${DAVID_DIAGNOSTIC_SETTINGS.rsiOverbought}/${DAVID_DIAGNOSTIC_SETTINGS.rsiOversold}\`.`,
  ];

  const report = [
    "# Gate 90D Feature Ledger And Start Mode Diagnostic",
    "",
    `Generated: ${GATE_DATE}`,
    "",
    "## Verdict",
    "",
    "`PASS_GATE90D_FEATURE_LEDGER_START_MODES_LOGGED_NO_REPLAY_NO_FULL_HANDSHAKE`",
    "",
    "This extends the Gate 90D feature ledger before replay freeze. It is not a trading replay, not an MT5 build, and not a full currency-family handshake implementation.",
    "",
    "## Scope",
    "",
    `- Warehouse manifest: \`${options.manifestId}\``,
    `- Price bundle: \`${manifest.price_bundle_id}\``,
    `- Weeks: \`${selectedWeeks.at(0) ?? "none"}..${selectedWeeks.at(-1) ?? "none"}\` (${selectedWeeks.length})`,
    `- Pairs: \`${new Set(rows.map((row) => row.pair)).size}\``,
    `- Grid quantum used for trigger/lock shadow: \`${options.gridQuantumAdr} ADR\``,
    `- Signal brick: \`${options.signalAdrBrick} ADR\``,
    `- Adaptive spacing receipt: \`${SPACING_FORMULA_ID}\`, \`${options.targetGridSlots}\` target slots, \`${options.minSpacingAdr}..${options.maxSpacingAdr} ADR\` rails`,
    "- Design-question diagnostics: M1/ADR-event path efficiency, archived UTC versus NY-clean boxes, 1-session/5-session/EMA PE, max(pair, account) heat, blocked centerline-only opportunities, neutral-alignment penalty distance, lockout thresholds, and profit-stop receipt-only state.",
    "- Start-mode diagnostics: strict sweep/rejection/displacement, relaxed sweep/rejection, first session-mid extension touch, Candidate B geometry start, and David contra geometry start inside ADR-event harvestable geometry.",
    `- Close-event source: \`${options.closeEventsCsv ? toRepoRelative(options.closeEventsCsv) : "none"}\``,
    "",
    "## Summary",
    "",
    renderTable(summaryRows as unknown as Array<Record<string, unknown>>, ["scope", "rows", "weeks", "pairs", "trigger_candidates", "pairs_with_trigger", "long_triggers", "short_triggers", "lock_preserve_candidates", "shadow_preserved_adr"]),
    "",
    "## Trigger Context",
    "",
    renderTable(triggerContextRows as unknown as Array<Record<string, unknown>>, ["bucket", "trigger_candidates", "distinct_pair_weeks", "long_triggers", "short_triggers", "bb_true", "family_positive", "candidate_b_aligned", "candidate_b_contra_aligned"]),
    "",
    "## Geometry Regimes",
    "",
    renderTable(geometryRegimeRows as unknown as Array<Record<string, unknown>>, ["geometry_regime", "pair_weeks", "trigger_candidates", "avg_path_efficiency_week", "avg_week_range_adr", "avg_range_ratio_pair", "avg_adaptive_spacing_adr", "range_condition_pass_pair_weeks", "adaptive_range_condition_pass_pair_weeks", "harvestable_candidate_pair_weeks"]),
    "",
    "## Session Geometry Regimes",
    "",
    renderTable(sessionGeometryRegimeRows as unknown as Array<Record<string, unknown>>, ["geometry_regime", "sessions", "trigger_candidates", "avg_entry_path_efficiency", "avg_session_range_adr", "avg_entry_range_adr", "avg_adaptive_spacing_adr", "range_condition_pass_sessions", "adaptive_range_condition_pass_sessions", "harvestable_candidate_sessions"]),
    "",
    "## Design Question Diagnostics",
    "",
    renderTable(designQuestionDiagnosticRows.slice(0, 20) as unknown as Array<Record<string, unknown>>, ["box_model", "session_label", "pe_m1_1_session", "pe_adr_event_1_session", "pe_m1_5_session_avg", "pe_m1_fast_slow_ema", "geometry_regime_m1", "centerline_only_blocked_candidate", "neutral_alignment_allow_distance_adr", "neutral_alignment_penalty_distance_adr", "pair_heat", "account_heat", "selected_heat"]),
    "",
    "## Design Question Read",
    "",
    ...designQuestionRead,
    "",
    "## Start Mode Diagnostics",
    "",
    renderTable(startModeSummaryRows as unknown as Array<Record<string, unknown>>, ["box_model", "start_mode_id", "valid_geometry_sessions", "found_starts", "blocked_no_start", "blocked_no_david_side", "avg_start_delay_minutes", "avg_start_distance_from_mid_adr", "avg_eod_mfe_adr", "avg_eod_mae_adr", "eod_hit_1q_starts", "eod_hit_2q_starts", "eod_hit_3q_starts", "avg_next_day_mfe_adr", "next_day_hit_1q_starts", "next_day_hit_2q_starts", "next_day_hit_3q_starts", "avg_full_available_mfe_adr", "full_available_hit_1q_starts", "full_available_hit_2q_starts", "full_available_hit_3q_starts"]),
    "",
    "## Start Mode Sample",
    "",
    renderTable(startModeDiagnosticRows.filter((row) => row.start_status === "found").slice(0, 20) as unknown as Array<Record<string, unknown>>, ["box_model", "session_label", "start_mode_id", "start_side", "start_timestamp_utc", "pe_adr_event_1_session", "adaptive_spacing_adr", "start_distance_from_mid_adr", "eod_mfe_adr", "eod_mae_adr", "eod_mfe_quantum_units", "next_day_mfe_adr", "full_available_mfe_adr", "hold_until_profit_first_1q_timestamp_utc", "candidate_b_alignment", "david_alignment"]),
    "",
    "## Start Mode Read",
    "",
    ...startModeRead,
    "",
    "## Lock Shadow By Variant",
    "",
    renderTable(lockVariantRows.slice(0, 12) as unknown as Array<Record<string, unknown>>, ["variant_id", "close_reason", "rows", "preserve_candidates", "shadow_preserved_adr", "avg_shadow_preserved_adr"]),
    "",
    "## Start Traceability",
    "",
    renderTable(startTraceSummaryRows as unknown as Array<Record<string, unknown>>, ["start_trace_status", "rows", "session_flatten_rows", "target_rows", "net_usd", "avg_net_usd", "profit_factor", "win_pct", "avg_minutes_from_trigger_to_start"]),
    "",
    "## Start Traceability By Variant",
    "",
    renderTable(startTraceVariantSummaryRows as unknown as Array<Record<string, unknown>>, ["variant_id", "start_trace_status", "rows", "session_flatten_rows", "target_rows", "net_usd", "avg_net_usd", "profit_factor", "win_pct", "avg_minutes_from_trigger_to_start"]),
    "",
    "## Start Traceability By Geometry",
    "",
    renderTable(startTraceGeometrySummaryRows as unknown as Array<Record<string, unknown>>, ["start_trace_status", "geometry_source", "geometry_regime", "rows", "session_flatten_rows", "target_rows", "net_usd", "avg_net_usd", "profit_factor", "win_pct", "avg_minutes_from_trigger_to_start"]),
    "",
    "## Read",
    "",
    `- Formula contract hash: \`${formulaConfig.formula_contract_hash}\`.`,
    "- `pair-week-feature.rows.*` records week-level path efficiency, range ratio, range-condition pass/fail, geometry regime, derived grid quantum, signal brick, and log-only family context.",
    "- `session-geometry.rows.*` records the same efficiency/range regime test at Katarakti session-box resolution so low-efficiency dead churn is not confused with harvestable chop.",
    "- `design-question-diagnostic.rows.*` logs the open Gate 90D design questions side by side before any replay freeze: M1 versus ADR-event PE, archived UTC versus NY-clean boxes, 1-session/5-session/EMA PE, max(pair, account) heat, blocked centerline-only rows, neutral alignment allow-versus-penalty distance, and profit-stop receipt-only state.",
    "- `start-mode-diagnostic.rows.*` compares strict, relaxed, session-mid extension, Candidate B geometry, and David contra geometry starts inside the same ADR-event harvestable geometry denominator.",
    "- `start-mode-diagnostic.rows.*` also records MFE/MAE, EOD flatten PnL, next-day hold what-if, full available path MFE, and 1Q/2Q/3Q target-hit timestamps/flags so larger-target hypotheses remain visible without changing replay state.",
    "- `start-mode-summary.rows.*` groups those start modes and excursion receipts by box model so v1 can choose a handshake shape before any replay freeze.",
    "- Adaptive spacing receipts use completed session range divided into fixed slots, then apply cost/min/max rails; they are feature receipts only in this pass, not trading replay controls.",
    "- `katarakti-trigger-candidates.rows.*` records session sweep / rejection / displacement trigger candidates in ADR/grid units.",
    "- `geometry-regime-summary.rows.*` separates harvestable chop candidates from dead chop, efficient tail risk, and mixed regimes.",
    "- `grid-lock-shadow.rows.*` reads existing full-stat close events and estimates where a grid-unit lock floor could have preserved MFE.",
    "- `start-traceability.rows.*` matches close-event cycle starts to prior Katarakti trigger candidates when source close events include `start_timestamp_utc`, then carries close-event outcome fields for start-gate shadow scoring.",
    "- `start-traceability-by-variant.rows.*` compares matched versus unmatched start outcomes by source variant without mutating replay state.",
    "- `start-traceability-by-geometry.rows.*` separates matched harvestable geometry from matched dead-chop geometry before any trading replay is attempted.",
    startTraceRead,
    "",
    "## Post-Review Caveat",
    "",
    "After outsider review, the Gate 90D proposal splits lock behavior into default",
    "entry/add lockout versus optional explicit profit-stop. The `grid-lock-shadow`",
    "rows in this report are therefore protection receipts only. They show where MFE",
    "giveback might be worth controlling; they do not prove forced-close replay",
    "behavior, lockout timing, or that protection would have acted before session",
    "flatten. The next evidence pass must distinguish lockout receipts from",
    "profit-stop receipts using start-level traceability and after-cost basket",
    "quantum units.",
    "",
    "## Artifacts",
    "",
    `- \`${toRepoRelative(`${featureBase}.csv`)}\``,
    `- \`${toRepoRelative(`${sessionGeometryBase}.csv`)}\``,
    `- \`${toRepoRelative(`${designQuestionDiagnosticBase}.csv`)}\``,
    `- \`${toRepoRelative(`${startModeDiagnosticBase}.csv`)}\``,
    `- \`${toRepoRelative(`${startModeSummaryBase}.csv`)}\``,
    `- \`${toRepoRelative(`${triggerBase}.csv`)}\``,
    `- \`${toRepoRelative(`${lockBase}.csv`)}\``,
    `- \`${toRepoRelative(`${summaryBase}.csv`)}\``,
    `- \`${toRepoRelative(`${triggerContextBase}.csv`)}\``,
    `- \`${toRepoRelative(`${lockVariantBase}.csv`)}\``,
    `- \`${toRepoRelative(`${geometryRegimeBase}.csv`)}\``,
    `- \`${toRepoRelative(`${sessionGeometryRegimeBase}.csv`)}\``,
    `- \`${toRepoRelative(`${startTraceBase}.csv`)}\``,
    `- \`${toRepoRelative(`${startTraceSummaryBase}.csv`)}\``,
    `- \`${toRepoRelative(`${startTraceVariantSummaryBase}.csv`)}\``,
    `- \`${toRepoRelative(`${startTraceGeometrySummaryBase}.csv`)}\``,
    `- \`${toRepoRelative(configPath)}\``,
    `- \`${toRepoRelative(formulaConfigPath)}\``,
    `- \`${toRepoRelative(shaPath)}\``,
    "",
    "## Stop Line",
    "",
    "No Triangle trading replay, no long matrix, no 2020 year run, no MT5/live/app work, and no full seven-pair handshake gating were performed.",
    "",
  ].join("\n");
  await writeText(options.reportPath, report);
  await writeShaManifest(shaPath, GATE_ID, COMMAND, [
    { label: "config", path: configPath },
    { label: "formula_config", path: formulaConfigPath },
    { label: "pair_week_features_json", path: `${featureBase}.json` },
    { label: "session_geometry_json", path: `${sessionGeometryBase}.json` },
    { label: "design_question_diagnostic_json", path: `${designQuestionDiagnosticBase}.json` },
    { label: "start_mode_diagnostic_json", path: `${startModeDiagnosticBase}.json` },
    { label: "start_mode_summary_json", path: `${startModeSummaryBase}.json` },
    { label: "katarakti_trigger_candidates_json", path: `${triggerBase}.json` },
    { label: "grid_lock_shadow_json", path: `${lockBase}.json` },
    { label: "summary_json", path: `${summaryBase}.json` },
    { label: "trigger_context_summary_json", path: `${triggerContextBase}.json` },
    { label: "grid_lock_shadow_by_variant_json", path: `${lockVariantBase}.json` },
    { label: "geometry_regime_summary_json", path: `${geometryRegimeBase}.json` },
    { label: "session_geometry_regime_summary_json", path: `${sessionGeometryRegimeBase}.json` },
    { label: "start_traceability_json", path: `${startTraceBase}.json` },
    { label: "start_traceability_summary_json", path: `${startTraceSummaryBase}.json` },
    { label: "start_traceability_by_variant_json", path: `${startTraceVariantSummaryBase}.json` },
    { label: "start_traceability_by_geometry_json", path: `${startTraceGeometrySummaryBase}.json` },
    { label: "report", path: options.reportPath },
  ]);

  console.log(`Gate 90D shadow audit complete: ${toRepoRelative(options.reportPath)}`);
  console.log(`Trigger candidates: ${triggerRows.length}`);
  console.log(`Lock rows: ${lockRows.length}`);
}

main()
  .catch((error) => {
    console.error("gate90d triangle shadow audit failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePoolIfInitialized();
  });
