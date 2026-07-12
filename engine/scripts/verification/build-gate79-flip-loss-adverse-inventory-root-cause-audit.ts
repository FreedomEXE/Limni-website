import { mkdir } from "node:fs/promises";
import path from "node:path";

import { closePoolIfInitialized } from "@database/db/client";
import { sha256Stable } from "@engine/research/hash";
import {
  readTradeLegPathWarehouseManifest,
  readTradeLegPathWarehousePairSeries,
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

const GATE_ID = "Gate 79: flip-loss-and-adverse-inventory-root-cause-audit";
const GATE_DATE = "2026-06-30";
const COMMAND = "npm run engine:gate79:flip-loss-adverse-inventory-root-cause-audit";
const DEFAULT_GATE74B_DIR = "docs/research/gates/gate74b/artifacts/gate74b-trade-leg-path-materialization";
const DEFAULT_GATE74E_DIR = "docs/research/gates/gate74e/artifacts/gate74e-pair-net-grid-tail-containment-adapter-pack";
const DEFAULT_GATE75A_DIR = "docs/research/gates/gate75a/artifacts/gate75a-broad-exit-family-taxonomy-protocol-freeze";
const DEFAULT_GATE76_DIR = "docs/research/gates/gate76/artifacts/gate76-pair-directional-two-sided-grid-reset-limit-lifecycle-discovery";
const DEFAULT_GATE77_DIR = "docs/research/gates/gate77/artifacts/gate77-pair-two-sided-reset-limit-confirmation-failure-anatomy";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate79/GATE79_FLIP_LOSS_ADVERSE_INVENTORY_ROOT_CAUSE_AUDIT_${GATE_DATE}.md`;

const FOCUS_RULE_ID = "PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP";
const FOCUS_CLOSED_ADR = 14381.312614;
const FOCUS_EQUITY_ADR = 9901.156008;
const FOCUS_FINAL_OPEN_ADR = -4480.156606;
const FOCUS_MAX_DRAWDOWN_ADR = -5462.545131;
const FOCUS_FLIP_LOSS_ADR = -10815.950986;
const GATE76_T150_RULE_ID = "PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP";
const GATE79_T075_L2_RULE_ID = "PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK";
const GATE77_T075_L3_RULE_ID = "PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK";
const GATE77_T100_L3_RULE_ID = "PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK";
const GATE77_T125_L3_RULE_ID = "PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK";
const GATE79_FULLY_HEDGED_RULE_ID = "FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE";
const SPACING_ADR = 0.2;
const DEFAULT_PAIR_RESET_LIMIT = 3;
const FLIP_WAREHOUSE_RECOVERY_ADR = 0;
const FLIP_WAREHOUSE_EXPIRY_HOURS = 13 * 7 * 24;
const FLIP_WAREHOUSE_HARD_LOSS_ADR = -15;
const FLIP_GRACE_HOURS = 7 * 24;
const FLIP_SMALL_LOSS_THRESHOLD_ADR = -3;
const TARGET_RETURN_SCALE_PERCENT = 700;
const CURRENT_T100_SCALE_PERCENT = 69;
const TARGET_MAX_DRAWDOWN_PERCENT = 30;
const REQUIRED_TARGET_ADR_AT_SCALE = round6(13772.999764 * (TARGET_RETURN_SCALE_PERCENT / CURRENT_T100_SCALE_PERCENT));

type Side = "LONG" | "SHORT";
type RuleFamily =
  | "control"
  | "adverse_only_pair_net_grid"
  | "pair_directional_two_sided_grid"
  | "pair_reset_limit"
  | "flip_counterfactual"
  | "fully_hedged_reference";
type RuleScope = "pair" | "account";
type RuleKind = "weekly_forced_close" | "carry_until_flip" | "grid" | "fully_hedged_weekly_grid";
type CloseReason =
  | "weekly_forced_close"
  | "target"
  | "flip"
  | "sample_end"
  | "account_reset"
  | "account_emergency_sl"
  | "warehouse_recovery"
  | "warehouse_expiry"
  | "warehouse_hard_loss"
  | "grace_expiry";
type FillKind = "initial" | "adverse_recovery" | "favorable_expansion";
type FlipPolicy =
  | "current_forced_flip_close"
  | "warehouse_losing_flip_no_new_fills"
  | "grace_window_losing_flip_no_new_fills"
  | "close_small_loss_warehouse_large_loss"
  | "no_flip_force_no_new_fills";
type InventoryState = "profitable" | "losing" | "neutral" | "mixed_profitable" | "mixed_losing";
type RunnerEventKind =
  | "none"
  | "final_reset_partial_close"
  | "runner_flip_close"
  | "runner_sample_end_open"
  | "runner_account_emergency_sl_close";
type ReplayRow = Pick<
  TradeLegPathReplayPairWeek,
  | "week_open_utc"
  | "pair"
  | "candidate_b_side"
  | "candidate_row_key"
  | "decision_hash"
  | "direction_streak_id"
  | "entry_timestamp_utc"
  | "friday_cutoff_timestamp_utc"
  | "pair_adr_pct"
  | "entry_price"
  | "mfe_adr"
  | "mae_adr"
  | "friday_close_adr"
  | "path_payload"
>;

type Gate74bSummary = {
  verdict: string;
  warehouse: {
    manifest_id: string;
    warehouse_hash: string;
    week_count: number;
    pair_week_count: number;
    path_point_count: number;
    candidate_b_final_ledger_hash: string;
    candidate_b_ledger_file_sha256: string;
  };
  validation: {
    candidate_b_forced28_preserved: boolean;
    no_policy_field_violations: number;
    raw_m1_rebuild_performed?: boolean;
  };
};

type Gate74eSummary = {
  verdict: string;
  focus_adapter: AdapterSummaryRow;
  best_adapter_by_final_equity: AdapterSummaryRow;
  validation: {
    focus_closed_matches_gate74c: boolean;
    focus_equity_matches_gate74c: boolean;
    focus_closed_matches_gate74d: boolean;
    focus_equity_matches_gate74d: boolean;
    gross_only: boolean;
    costs_applied: boolean;
    raw_m1_rebuild_performed: boolean;
    exact_account_level_synchronous_containment_started: boolean;
    pair_pruning_started: boolean;
    audnzd_excluded: boolean;
    risk_layer_started: boolean;
    exit_promotion_started: boolean;
  };
};

type Gate75aSummary = {
  verdict: string;
  validation: {
    gate75b_matrix_execution_started: boolean;
    broad_parameter_matrix_started: boolean;
    costs_applied: boolean;
    risk_layer_started: boolean;
    pair_pruning_started: boolean;
    audnzd_excluded: boolean;
    fair_value_pruning_started: boolean;
    exit_promotion_started: boolean;
    brain_truth_mutated: boolean;
    source_mutation_started: boolean;
  };
};

type ReplayRule = {
  rule_id: string;
  rule_family: RuleFamily;
  scope: RuleScope;
  kind: RuleKind;
  target_adr: number | null;
  spacing_adr: number | null;
  two_sided_grid: boolean;
  pair_reset_limit_per_week: number | null;
  account_reset_limit_per_week: number | null;
  runner_fraction: number | null;
  account_emergency_sl_adr: number | null;
  base_rule_id: string | null;
  flip_policy: FlipPolicy;
  flip_loss_threshold_adr: number | null;
  warehouse_recovery_adr: number | null;
  warehouse_expiry_hours: number | null;
  warehouse_hard_loss_adr: number | null;
  reference_only: boolean;
  review_role: string;
};

type Fill = {
  entry_price: number;
  entry_timestamp_utc: string;
  fill_index: number;
  level_index: number;
  kind: FillKind;
  quantity: number;
};

type Cycle = {
  cycle_id: string;
  rule_id: string;
  pair: string;
  side: Side;
  direction_streak_id: string;
  candidate_row_key: string;
  decision_hash: string;
  start_week_open_utc: string;
  start_timestamp_utc: string;
  start_year: number;
  anchor_price: number;
  cycle_adr_pct: number;
  fills: Fill[];
  entry_price_inverse_sum: number;
  quantity_sum: number;
  next_adverse_fill_level: number;
  next_favorable_fill_level: number;
  min_pnl_adr: number;
  max_pnl_adr: number;
  first_negative_timestamp_utc: string | null;
  last_pnl_adr: number;
  reset_ordinal_at_start: number;
  runner_only: boolean;
  runner_fraction: number | null;
  warehoused: boolean;
  warehouse_started_timestamp_utc: string | null;
  warehouse_policy: FlipPolicy | null;
};

type CloseEvent = {
  rule_id: string;
  rule_family: RuleFamily;
  scope: RuleScope;
  pair: string;
  side: Side;
  base_currency: string;
  quote_currency: string;
  week_open_utc: string;
  start_week_open_utc: string;
  start_timestamp_utc: string;
  close_timestamp_utc: string;
  close_reason: CloseReason;
  realized_or_open_adr: number;
  initial_fill_closed_adr: number;
  recovery_fill_closed_adr: number;
  expansion_fill_closed_adr: number;
  fill_count: number;
  adverse_fill_count: number;
  expansion_fill_count: number;
  age_hours: number;
  min_pnl_adr: number;
  max_pnl_adr: number;
  giveback_adr: number;
  went_negative: boolean;
  recovered_to_positive_close: boolean;
  inventory_state_at_close: InventoryState;
  reset_ordinal_at_start: number;
  completed_reset_ordinal: number | null;
  terminal_reset_limit_close: boolean;
  flip_policy: FlipPolicy;
  was_warehoused: boolean;
  warehouse_duration_hours: number | null;
  warehouse_exit_reason: CloseReason | null;
  runner_event_kind: RunnerEventKind;
  closed_fraction: number;
  runner_fraction: number | null;
};

type WeeklyRow = {
  rule_id: string;
  rule_family: RuleFamily;
  scope: RuleScope;
  week_open_utc: string;
  closed_week_adr: number;
  open_unrealized_adr: number;
  equity_delta_adr: number;
  equity_snapshot_adr: number;
  reset_count_week: number;
  pair_reset_count_week: number;
  account_reset_count_week: number;
  account_emergency_sl_count_week: number;
  fill_count_week: number;
  adverse_fill_count_week: number;
  expansion_fill_count_week: number;
};

type AdapterSummaryRow = {
  rule_id: string;
  rule_family: RuleFamily;
  scope: RuleScope;
  target_adr: number | null;
  spacing_adr: number | null;
  two_sided_grid: boolean;
  reset_limit_per_week: number | null;
  runner_fraction: number | null;
  account_emergency_sl_adr: number | null;
  base_rule_id: string | null;
  flip_policy: FlipPolicy;
  fully_hedged_reference: boolean;
  reference_only: boolean;
  closed_total_adr: number;
  final_equity_adr: number;
  equity_profit_factor: number | null;
  closed_profit_factor: number | null;
  max_equity_drawdown_adr: number;
  final_open_unrealized_adr: number;
  worst_week_end_open_unrealized_adr: number;
  closed_adr_retention_vs_gate74e_focus: number | null;
  final_equity_retention_vs_gate74e_focus: number | null;
  top20_winner_retention_vs_weekly_forced: number | null;
  worst_week_loss_adr: number;
  worst_5_week_loss_adr: number;
  worst_13_week_loss_adr: number;
  negative_years: number;
  mtm_weekly_win_rate: number;
  closed_weekly_win_rate: number;
  mtm_monthly_win_rate: number;
  closed_monthly_win_rate: number;
  time_in_drawdown_weeks: number;
  longest_drawdown_weeks: number;
  equity_curve_roughness_adr: number;
  closed_cycles: number;
  target_reset_cycles: number;
  account_reset_events: number;
  account_emergency_sl_events: number;
  flip_loss_adr: number;
  flip_event_count: number;
  warehouse_position_count: number;
  warehouse_recovered_count: number;
  warehouse_recovery_rate: number | null;
  warehouse_final_unresolved_loss_adr: number;
  average_warehouse_duration_hours: number | null;
  max_warehouse_duration_hours: number | null;
  negative_cycles: number;
  recovered_negative_cycles: number;
  negative_cycle_recovery_rate: number | null;
  fill_count: number;
  adverse_recovery_fill_count: number;
  favorable_expansion_fill_count: number;
  closed_adr_from_initial_fills: number;
  closed_adr_from_recovery_fills: number;
  closed_adr_from_expansion_fills: number;
  average_closed_cycle_hold_hours: number | null;
  max_cycle_mfe_adr: number | null;
  total_giveback_adr: number;
  content_hash?: string;
};

type RuleStats = {
  rule: ReplayRule;
  closed_by_week: Map<string, number>;
  open_by_week: Map<string, number>;
  reset_by_week: Map<string, number>;
  pair_reset_by_week: Map<string, number>;
  account_reset_by_week: Map<string, number>;
  fill_count_by_week: Map<string, number>;
  adverse_fill_count_by_week: Map<string, number>;
  expansion_fill_count_by_week: Map<string, number>;
  reset_by_pair: Map<string, number>;
  final_open_by_pair: Map<string, number>;
  open_by_pair_week: Map<string, number>;
  close_events: CloseEvent[];
  account_reset_events: number;
  generated_account_replay: boolean;
  runner_final_open_by_pair: Map<string, number>;
  account_emergency_sl_by_week: Map<string, number>;
  account_emergency_sl_events: number;
};

function parseOptions() {
  const args = parseArgMap();
  const maxWeeksRaw = args.get("--max-weeks");
  return {
    gate74bDir: args.get("--gate74b-dir") ?? DEFAULT_GATE74B_DIR,
    gate74eDir: args.get("--gate74e-dir") ?? DEFAULT_GATE74E_DIR,
    gate75aDir: args.get("--gate75a-dir") ?? DEFAULT_GATE75A_DIR,
    gate76Dir: args.get("--gate76-dir") ?? DEFAULT_GATE76_DIR,
    gate77Dir: args.get("--gate77-dir") ?? DEFAULT_GATE77_DIR,
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    manifestId: args.get("--manifest-id"),
    maxWeeks: maxWeeksRaw ? Number(maxWeeksRaw) : null,
    logProgress: process.argv.includes("--log-progress"),
  };
}

function round6(value: number) {
  return round(value, 6) ?? value;
}

function baseRule(options: {
  rule_id: string;
  rule_family: RuleFamily;
  target_adr: number | null;
  pair_reset_limit_per_week: number | null;
  two_sided_grid: boolean;
  base_rule_id?: string | null;
  flip_policy?: FlipPolicy;
  reference_only?: boolean;
  review_role: string;
  kind?: RuleKind;
}) {
  return {
    rule_id: options.rule_id,
    rule_family: options.rule_family,
    scope: "pair" as const,
    kind: options.kind ?? "grid" as const,
    target_adr: options.target_adr,
    spacing_adr: options.target_adr === null ? null : SPACING_ADR,
    two_sided_grid: options.two_sided_grid,
    pair_reset_limit_per_week: options.pair_reset_limit_per_week,
    account_reset_limit_per_week: null,
    runner_fraction: null,
    account_emergency_sl_adr: null,
    base_rule_id: options.base_rule_id ?? null,
    flip_policy: options.flip_policy ?? "current_forced_flip_close",
    flip_loss_threshold_adr: options.flip_policy === "close_small_loss_warehouse_large_loss" ? FLIP_SMALL_LOSS_THRESHOLD_ADR : null,
    warehouse_recovery_adr: options.flip_policy && options.flip_policy !== "current_forced_flip_close" ? FLIP_WAREHOUSE_RECOVERY_ADR : null,
    warehouse_expiry_hours:
      options.flip_policy === "warehouse_losing_flip_no_new_fills" ||
      options.flip_policy === "close_small_loss_warehouse_large_loss"
        ? FLIP_WAREHOUSE_EXPIRY_HOURS
        : options.flip_policy === "grace_window_losing_flip_no_new_fills"
          ? FLIP_GRACE_HOURS
          : null,
    warehouse_hard_loss_adr:
      options.flip_policy === "warehouse_losing_flip_no_new_fills" ||
      options.flip_policy === "close_small_loss_warehouse_large_loss"
        ? FLIP_WAREHOUSE_HARD_LOSS_ADR
        : null,
    reference_only: options.reference_only ?? false,
    review_role: options.review_role,
  } satisfies ReplayRule;
}

function ruleSet(): ReplayRule[] {
  const weeklyForced = baseRule({
    rule_id: "WEEKLY_FORCED_CLOSE",
    rule_family: "control",
    kind: "weekly_forced_close",
    target_adr: null,
    pair_reset_limit_per_week: null,
    two_sided_grid: false,
    review_role: "weekly_forced_close_control",
  });
  const carryUntilFlip = baseRule({
    rule_id: "CARRY_UNTIL_FLIP",
    rule_family: "control",
    kind: "carry_until_flip",
    target_adr: null,
    pair_reset_limit_per_week: null,
    two_sided_grid: false,
    review_role: "carry_unresolved_until_candidate_b_flip_control",
  });
  const auditBaselines = [
    baseRule({
      rule_id: FOCUS_RULE_ID,
      rule_family: "adverse_only_pair_net_grid",
      target_adr: 0.75,
      pair_reset_limit_per_week: null,
      two_sided_grid: false,
      review_role: "gate74e_adverse_only_focus_reference",
    }),
    baseRule({
      rule_id: GATE76_T150_RULE_ID,
      rule_family: "pair_directional_two_sided_grid",
      target_adr: 1.5,
      pair_reset_limit_per_week: null,
      two_sided_grid: true,
      review_role: "gate76_best_unrestricted_two_sided_reference",
    }),
    baseRule({
      rule_id: GATE79_T075_L2_RULE_ID,
      rule_family: "pair_reset_limit",
      target_adr: 0.75,
      pair_reset_limit_per_week: 2,
      two_sided_grid: true,
      review_role: "gate79_required_t075_l2_limited_reentry_baseline",
    }),
    baseRule({
      rule_id: GATE77_T075_L3_RULE_ID,
      rule_family: "pair_reset_limit",
      target_adr: 0.75,
      pair_reset_limit_per_week: DEFAULT_PAIR_RESET_LIMIT,
      two_sided_grid: true,
      review_role: "gate77_confirmed_t075_l3_limited_reentry_baseline",
    }),
    baseRule({
      rule_id: GATE77_T100_L3_RULE_ID,
      rule_family: "pair_reset_limit",
      target_adr: 1,
      pair_reset_limit_per_week: DEFAULT_PAIR_RESET_LIMIT,
      two_sided_grid: true,
      review_role: "gate77_primary_t100_l3_diagnostic_specimen",
    }),
    baseRule({
      rule_id: GATE77_T125_L3_RULE_ID,
      rule_family: "pair_reset_limit",
      target_adr: 1.25,
      pair_reset_limit_per_week: DEFAULT_PAIR_RESET_LIMIT,
      two_sided_grid: true,
      review_role: "gate77_t125_l3_tail_reference",
    }),
  ];
  const counterfactualPolicies: Array<{ policy: FlipPolicy; suffix: string; role: string }> = [
    { policy: "warehouse_losing_flip_no_new_fills", suffix: "FLIP_LOSER_WAREHOUSE", role: "fixed_recovery_expiry_hard_loss_warehouse_diagnostic" },
    { policy: "grace_window_losing_flip_no_new_fills", suffix: "FLIP_GRACE_1W", role: "fixed_one_week_grace_window_diagnostic" },
    { policy: "close_small_loss_warehouse_large_loss", suffix: "FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR", role: "fixed_large_loss_threshold_warehouse_diagnostic" },
    { policy: "no_flip_force_no_new_fills", suffix: "NO_FLIP_FORCE_DIAGNOSTIC", role: "pure_no_flip_force_visibility_diagnostic" },
  ];
  const counterfactuals = auditBaselines.flatMap((baseline) => (
    counterfactualPolicies.map(({ policy, suffix, role }) => baseRule({
      rule_id: `${baseline.rule_id}__${suffix}`,
      rule_family: "flip_counterfactual",
      target_adr: baseline.target_adr,
      pair_reset_limit_per_week: baseline.pair_reset_limit_per_week,
      two_sided_grid: baseline.two_sided_grid,
      base_rule_id: baseline.rule_id,
      flip_policy: policy,
      reference_only: true,
      review_role: role,
    }))
  ));
  const fullyHedgedReference = baseRule({
    rule_id: GATE79_FULLY_HEDGED_RULE_ID,
    rule_family: "fully_hedged_reference",
    kind: "fully_hedged_weekly_grid",
    target_adr: 1,
    pair_reset_limit_per_week: DEFAULT_PAIR_RESET_LIMIT,
    two_sided_grid: true,
    reference_only: true,
    review_role: "fully_hedged_long_and_short_every_pair_weekly_execution_edge_diagnostic",
  });

  return [weeklyForced, carryUntilFlip, ...auditBaselines, ...counterfactuals, fullyHedgedReference];
}

function createStats(rule: ReplayRule): RuleStats {
  return {
    rule,
    closed_by_week: new Map(),
    open_by_week: new Map(),
    reset_by_week: new Map(),
    pair_reset_by_week: new Map(),
    account_reset_by_week: new Map(),
    fill_count_by_week: new Map(),
    adverse_fill_count_by_week: new Map(),
    expansion_fill_count_by_week: new Map(),
    reset_by_pair: new Map(),
    final_open_by_pair: new Map(),
    open_by_pair_week: new Map(),
    close_events: [],
    account_reset_events: 0,
    generated_account_replay: false,
    runner_final_open_by_pair: new Map(),
    account_emergency_sl_by_week: new Map(),
    account_emergency_sl_events: 0,
  };
}

function addToMap(map: Map<string, number>, key: string, value: number) {
  map.set(key, round6((map.get(key) ?? 0) + value));
}

function incrementMap(map: Map<string, number>, key: string, value = 1) {
  map.set(key, (map.get(key) ?? 0) + value);
}

function markPriceFromDirectedClose(row: ReplayRow, directedCloseAdr: number) {
  if (row.entry_price === null || row.entry_price <= 0) {
    throw new Error(`Missing entry price for ${row.week_open_utc} ${row.pair}`);
  }
  const signedPct = (directedCloseAdr * row.pair_adr_pct) / 100;
  return row.candidate_b_side === "LONG"
    ? row.entry_price * (1 + signedPct)
    : row.entry_price * (1 - signedPct);
}

function priceAtDirectedMove(cycle: Cycle, directedMoveAdr: number) {
  const signedPct = (directedMoveAdr * cycle.cycle_adr_pct) / 100;
  return cycle.side === "LONG"
    ? cycle.anchor_price * (1 + signedPct)
    : cycle.anchor_price * (1 - signedPct);
}

function directedMoveFromCycle(cycle: Cycle, markPrice: number) {
  const sign = cycle.side === "LONG" ? 1 : -1;
  return ((markPrice - cycle.anchor_price) / cycle.anchor_price) * 100 * sign / cycle.cycle_adr_pct;
}

function fillPnlAdr(cycle: Cycle, fill: Fill, markPrice: number) {
  const sign = cycle.side === "LONG" ? 1 : -1;
  return ((markPrice - fill.entry_price) / fill.entry_price) * 100 * sign / cycle.cycle_adr_pct * fill.quantity;
}

function cycleNetPnlAdr(cycle: Cycle, markPrice: number) {
  const scalar = 100 / cycle.cycle_adr_pct;
  return cycle.side === "LONG"
    ? (markPrice * cycle.entry_price_inverse_sum - cycle.quantity_sum) * scalar
    : (cycle.quantity_sum - markPrice * cycle.entry_price_inverse_sum) * scalar;
}

function hoursBetween(start: string, end: string) {
  const hours = (Date.parse(end) - Date.parse(start)) / 3_600_000;
  return Number.isFinite(hours) ? round6(Math.max(0, hours)) : 0;
}

function startCycle(options: {
  rule: ReplayRule;
  pair: string;
  row: ReplayRow;
  markPrice: number;
  timestampUtc: string;
  serial: number;
  resetOrdinalAtStart: number;
  sideOverride?: Side;
}) {
  return {
    cycle_id: `${options.rule.rule_id}|${options.pair}|${options.serial}`,
    rule_id: options.rule.rule_id,
    pair: options.pair,
    side: options.sideOverride ?? options.row.candidate_b_side,
    direction_streak_id: options.row.direction_streak_id,
    candidate_row_key: options.row.candidate_row_key,
    decision_hash: options.row.decision_hash,
    start_week_open_utc: options.row.week_open_utc,
    start_timestamp_utc: options.timestampUtc,
    start_year: new Date(options.row.week_open_utc).getUTCFullYear(),
    anchor_price: options.markPrice,
    cycle_adr_pct: options.row.pair_adr_pct,
    fills: [{
      entry_price: options.markPrice,
      entry_timestamp_utc: options.timestampUtc,
      fill_index: 0,
      level_index: 0,
      kind: "initial" as const,
      quantity: 1,
    }],
    entry_price_inverse_sum: 1 / options.markPrice,
    quantity_sum: 1,
    next_adverse_fill_level: 1,
    next_favorable_fill_level: 1,
    min_pnl_adr: 0,
    max_pnl_adr: 0,
    first_negative_timestamp_utc: null,
    last_pnl_adr: 0,
    reset_ordinal_at_start: options.resetOrdinalAtStart,
    runner_only: false,
    runner_fraction: null,
    warehoused: false,
    warehouse_started_timestamp_utc: null,
    warehouse_policy: null,
  } satisfies Cycle;
}

function observeCycle(cycle: Cycle, markPrice: number, timestampUtc: string) {
  const pnl = round6(cycleNetPnlAdr(cycle, markPrice));
  cycle.last_pnl_adr = pnl;
  if (pnl < cycle.min_pnl_adr) cycle.min_pnl_adr = pnl;
  if (pnl > cycle.max_pnl_adr) cycle.max_pnl_adr = pnl;
  if (pnl < 0 && cycle.first_negative_timestamp_utc === null) cycle.first_negative_timestamp_utc = timestampUtc;
}

function addGridFills(options: {
  cycle: Cycle;
  markPrice: number;
  timestampUtc: string;
  spacingAdr: number;
  twoSided: boolean;
}) {
  let addedAdverse = 0;
  let addedExpansion = 0;
  const directed = directedMoveFromCycle(options.cycle, options.markPrice);
  while (directed <= -options.spacingAdr * options.cycle.next_adverse_fill_level) {
    const level = options.cycle.next_adverse_fill_level;
    const entryPrice = priceAtDirectedMove(options.cycle, -options.spacingAdr * level);
    options.cycle.fills.push({
      entry_price: entryPrice,
      entry_timestamp_utc: options.timestampUtc,
      fill_index: options.cycle.fills.length,
      level_index: level,
      kind: "adverse_recovery",
      quantity: 1,
    });
    options.cycle.entry_price_inverse_sum += 1 / entryPrice;
    options.cycle.quantity_sum += 1;
    options.cycle.next_adverse_fill_level += 1;
    addedAdverse += 1;
  }
  if (options.twoSided) {
    while (directed >= options.spacingAdr * options.cycle.next_favorable_fill_level) {
      const level = options.cycle.next_favorable_fill_level;
      const entryPrice = priceAtDirectedMove(options.cycle, options.spacingAdr * level);
      options.cycle.fills.push({
        entry_price: entryPrice,
        entry_timestamp_utc: options.timestampUtc,
        fill_index: options.cycle.fills.length,
        level_index: level,
        kind: "favorable_expansion",
        quantity: 1,
      });
      options.cycle.entry_price_inverse_sum += 1 / entryPrice;
      options.cycle.quantity_sum += 1;
      options.cycle.next_favorable_fill_level += 1;
      addedExpansion += 1;
    }
  }
  return { addedAdverse, addedExpansion };
}

function cloneCycleWithFraction(cycle: Cycle, fraction: number) {
  return {
    ...cycle,
    fills: cycle.fills.map((fill) => ({ ...fill, quantity: round6(fill.quantity * fraction) })),
    entry_price_inverse_sum: round6(cycle.entry_price_inverse_sum * fraction),
    quantity_sum: round6(cycle.quantity_sum * fraction),
    min_pnl_adr: round6(cycle.min_pnl_adr * fraction),
    max_pnl_adr: round6(cycle.max_pnl_adr * fraction),
    last_pnl_adr: round6(cycle.last_pnl_adr * fraction),
  } satisfies Cycle;
}

function scaleCycleToRunner(cycle: Cycle, runnerFraction: number) {
  cycle.fills = cycle.fills.map((fill) => ({ ...fill, quantity: round6(fill.quantity * runnerFraction) }));
  cycle.entry_price_inverse_sum = round6(cycle.entry_price_inverse_sum * runnerFraction);
  cycle.quantity_sum = round6(cycle.quantity_sum * runnerFraction);
  cycle.min_pnl_adr = round6(cycle.min_pnl_adr * runnerFraction);
  cycle.max_pnl_adr = round6(cycle.max_pnl_adr * runnerFraction);
  cycle.last_pnl_adr = round6(cycle.last_pnl_adr * runnerFraction);
  cycle.runner_only = true;
  cycle.runner_fraction = runnerFraction;
}

function inventoryState(realized: number, components: number[]): InventoryState {
  const hasPositive = components.some((value) => value > 0);
  const hasNegative = components.some((value) => value < 0);
  if (realized > 0 && hasNegative) return "mixed_profitable";
  if (realized < 0 && hasPositive) return "mixed_losing";
  if (realized > 0) return "profitable";
  if (realized < 0) return "losing";
  return "neutral";
}

function closeCycle(options: {
  stats: RuleStats;
  cycle: Cycle;
  closeReason: CloseReason;
  markPrice: number;
  timestampUtc: string;
  weekOpenUtc: string;
  completedResetOrdinal?: number | null;
  terminalResetLimitClose?: boolean;
  recordClosedByWeek?: boolean;
  recordFinalOpenByPair?: boolean;
  runnerEventKind?: RunnerEventKind;
  closedFraction?: number;
  runnerFraction?: number | null;
}) {
  observeCycle(options.cycle, options.markPrice, options.timestampUtc);
  const realized = round6(cycleNetPnlAdr(options.cycle, options.markPrice));
  let initial = 0;
  let recovery = 0;
  let expansion = 0;
  for (const fill of options.cycle.fills) {
    const pnl = round6(fillPnlAdr(options.cycle, fill, options.markPrice));
    if (fill.kind === "initial") initial = round6(initial + pnl);
    if (fill.kind === "adverse_recovery") recovery = round6(recovery + pnl);
    if (fill.kind === "favorable_expansion") expansion = round6(expansion + pnl);
  }
  const adverseFillCount = round6(options.cycle.fills.filter((fill) => fill.kind === "adverse_recovery").reduce((sum, fill) => sum + fill.quantity, 0));
  const expansionFillCount = round6(options.cycle.fills.filter((fill) => fill.kind === "favorable_expansion").reduce((sum, fill) => sum + fill.quantity, 0));
  const runnerEventKind = options.runnerEventKind ?? (
    options.cycle.runner_only
      ? options.closeReason === "sample_end"
        ? "runner_sample_end_open"
        : options.closeReason === "account_emergency_sl"
          ? "runner_account_emergency_sl_close"
          : "runner_flip_close"
      : "none"
  );
  const event: CloseEvent = {
    rule_id: options.stats.rule.rule_id,
    rule_family: options.stats.rule.rule_family,
    scope: options.stats.rule.scope,
    pair: options.cycle.pair,
    side: options.cycle.side,
    base_currency: options.cycle.pair.slice(0, 3),
    quote_currency: options.cycle.pair.slice(3, 6),
    week_open_utc: options.weekOpenUtc,
    start_week_open_utc: options.cycle.start_week_open_utc,
    start_timestamp_utc: options.cycle.start_timestamp_utc,
    close_timestamp_utc: options.timestampUtc,
    close_reason: options.closeReason,
    realized_or_open_adr: realized,
    initial_fill_closed_adr: initial,
    recovery_fill_closed_adr: recovery,
    expansion_fill_closed_adr: expansion,
    fill_count: round6(options.cycle.quantity_sum),
    adverse_fill_count: adverseFillCount,
    expansion_fill_count: expansionFillCount,
    age_hours: hoursBetween(options.cycle.start_timestamp_utc, options.timestampUtc),
    min_pnl_adr: round6(options.cycle.min_pnl_adr),
    max_pnl_adr: round6(options.cycle.max_pnl_adr),
    giveback_adr: round6(options.cycle.max_pnl_adr - realized),
    went_negative: options.cycle.first_negative_timestamp_utc !== null,
    recovered_to_positive_close:
      options.cycle.first_negative_timestamp_utc !== null &&
      ["target", "account_reset", "warehouse_recovery"].includes(options.closeReason) &&
      realized > 0,
    inventory_state_at_close: inventoryState(realized, [initial, recovery, expansion]),
    reset_ordinal_at_start: options.cycle.reset_ordinal_at_start,
    completed_reset_ordinal: options.completedResetOrdinal ?? null,
    terminal_reset_limit_close: options.terminalResetLimitClose ?? false,
    flip_policy: options.stats.rule.flip_policy,
    was_warehoused: options.cycle.warehoused,
    warehouse_duration_hours: options.cycle.warehouse_started_timestamp_utc === null
      ? null
      : hoursBetween(options.cycle.warehouse_started_timestamp_utc, options.timestampUtc),
    warehouse_exit_reason: options.cycle.warehoused ? options.closeReason : null,
    runner_event_kind: runnerEventKind,
    closed_fraction: options.closedFraction ?? (options.cycle.runner_only ? options.cycle.runner_fraction ?? 1 : 1),
    runner_fraction: options.runnerFraction ?? options.cycle.runner_fraction,
  };
  options.stats.close_events.push(event);
  const recordClosedByWeek = options.recordClosedByWeek ?? options.closeReason !== "sample_end";
  const recordFinalOpenByPair = options.recordFinalOpenByPair ?? options.closeReason === "sample_end";
  if (recordClosedByWeek) {
    addToMap(options.stats.closed_by_week, options.weekOpenUtc, realized);
  }
  if (recordFinalOpenByPair) {
    addToMap(options.stats.final_open_by_pair, options.cycle.pair, realized);
    if (runnerEventKind === "runner_sample_end_open") {
      addToMap(options.stats.runner_final_open_by_pair, options.cycle.pair, realized);
    }
  }
  if (options.closeReason === "target") {
    incrementMap(options.stats.reset_by_week, options.weekOpenUtc);
    incrementMap(options.stats.pair_reset_by_week, options.weekOpenUtc);
    incrementMap(options.stats.reset_by_pair, options.cycle.pair);
  }
  if (options.closeReason === "account_reset") {
    incrementMap(options.stats.reset_by_week, options.weekOpenUtc);
    incrementMap(options.stats.account_reset_by_week, options.weekOpenUtc);
    incrementMap(options.stats.reset_by_pair, options.cycle.pair);
    options.stats.account_reset_events += 1;
  }
  return event;
}

function closeFinalResetWithRunner(options: {
  stats: RuleStats;
  cycle: Cycle;
  markPrice: number;
  timestampUtc: string;
  weekOpenUtc: string;
  runnerFraction: number;
}) {
  const closedFraction = round6(1 - options.runnerFraction);
  const closedSlice = cloneCycleWithFraction(options.cycle, closedFraction);
  closeCycle({
    stats: options.stats,
    cycle: closedSlice,
    closeReason: "target",
    markPrice: options.markPrice,
    timestampUtc: options.timestampUtc,
    weekOpenUtc: options.weekOpenUtc,
    runnerEventKind: "final_reset_partial_close",
    closedFraction,
    runnerFraction: options.runnerFraction,
  });
  scaleCycleToRunner(options.cycle, options.runnerFraction);
}

function replayWeeklyForcedClose(rule: ReplayRule, pair: string, rows: ReplayRow[], stats: RuleStats) {
  for (const row of rows) {
    const value = round6(row.friday_close_adr);
    addToMap(stats.closed_by_week, row.week_open_utc, value);
    const event: CloseEvent = {
      rule_id: rule.rule_id,
      rule_family: rule.rule_family,
      scope: rule.scope,
      pair,
      side: row.candidate_b_side,
      base_currency: pair.slice(0, 3),
      quote_currency: pair.slice(3, 6),
      week_open_utc: row.week_open_utc,
      start_week_open_utc: row.week_open_utc,
      start_timestamp_utc: row.entry_timestamp_utc,
      close_timestamp_utc: row.friday_cutoff_timestamp_utc,
      close_reason: "weekly_forced_close",
      realized_or_open_adr: value,
      initial_fill_closed_adr: value,
      recovery_fill_closed_adr: 0,
      expansion_fill_closed_adr: 0,
      fill_count: 1,
      adverse_fill_count: 0,
      expansion_fill_count: 0,
      age_hours: hoursBetween(row.entry_timestamp_utc, row.friday_cutoff_timestamp_utc),
      min_pnl_adr: row.mae_adr,
      max_pnl_adr: row.mfe_adr,
      giveback_adr: round6(row.mfe_adr - value),
      went_negative: row.mae_adr < 0,
      recovered_to_positive_close: row.mae_adr < 0 && value > 0,
      inventory_state_at_close: value > 0 ? "profitable" : value < 0 ? "losing" : "neutral",
      reset_ordinal_at_start: 0,
      completed_reset_ordinal: null,
      terminal_reset_limit_close: false,
      flip_policy: rule.flip_policy,
      was_warehoused: false,
      warehouse_duration_hours: null,
      warehouse_exit_reason: null,
      runner_event_kind: "none",
      closed_fraction: 1,
      runner_fraction: null,
    };
    stats.close_events.push(event);
  }
}

function pairWeekKey(weekOpenUtc: string, pair: string) {
  return `${weekOpenUtc}|${pair}`;
}

function markPairWeekOpen(stats: RuleStats, weekOpenUtc: string, pair: string, value: number) {
  addToMap(stats.open_by_week, weekOpenUtc, value);
  addToMap(stats.open_by_pair_week, pairWeekKey(weekOpenUtc, pair), value);
}

function shouldWarehouseLosingFlip(rule: ReplayRule, lossAdr: number) {
  if (lossAdr >= 0) return false;
  if (rule.flip_policy === "current_forced_flip_close") return false;
  if (rule.flip_policy === "close_small_loss_warehouse_large_loss") return lossAdr < FLIP_SMALL_LOSS_THRESHOLD_ADR;
  return true;
}

function warehouseCycle(cycle: Cycle, rule: ReplayRule, timestampUtc: string) {
  cycle.warehoused = true;
  cycle.warehouse_started_timestamp_utc = timestampUtc;
  cycle.warehouse_policy = rule.flip_policy;
}

function warehouseExitReason(rule: ReplayRule, cycle: Cycle, pnl: number, timestampUtc: string): CloseReason | null {
  const warehouseStarted = cycle.warehouse_started_timestamp_utc;
  const warehouseAgeHours = warehouseStarted === null ? 0 : hoursBetween(warehouseStarted, timestampUtc);
  if (rule.warehouse_recovery_adr !== null && pnl >= rule.warehouse_recovery_adr) return "warehouse_recovery";
  if (rule.flip_policy === "grace_window_losing_flip_no_new_fills" && warehouseAgeHours >= FLIP_GRACE_HOURS) return "grace_expiry";
  if (rule.warehouse_hard_loss_adr !== null && pnl <= rule.warehouse_hard_loss_adr) return "warehouse_hard_loss";
  if (rule.warehouse_expiry_hours !== null && warehouseAgeHours >= rule.warehouse_expiry_hours) return "warehouse_expiry";
  return null;
}

function replayPairRulesForPair(pair: string, rows: ReplayRow[], selectedWeeks: string[], rules: ReplayRule[], statsByRule: Map<string, RuleStats>) {
  for (const rule of rules.filter((candidate) => candidate.kind === "weekly_forced_close")) {
    replayWeeklyForcedClose(rule, pair, rows, statsByRule.get(rule.rule_id)!);
  }

  type PairRuleState = {
    rule: ReplayRule;
    stats: RuleStats;
    current: Cycle | null;
    warehoused: Cycle[];
    serial: number;
    lastMarkPrice: number | null;
    lastTimestampUtc: string | null;
    currentWeek: string | null;
    resetsThisPairWeek: number;
    stoppedThisPairWeek: boolean;
  };

  const states: PairRuleState[] = rules
    .filter((rule) => rule.kind !== "weekly_forced_close" && rule.kind !== "fully_hedged_weekly_grid")
    .map((rule) => ({
      rule,
      stats: statsByRule.get(rule.rule_id)!,
      current: null,
      warehoused: [],
      serial: 0,
      lastMarkPrice: null,
      lastTimestampUtc: null,
      currentWeek: null,
      resetsThisPairWeek: 0,
      stoppedThisPairWeek: false,
    }));

  function snapshot(state: PairRuleState, week: string) {
    let open = state.current && state.lastMarkPrice !== null ? round6(cycleNetPnlAdr(state.current, state.lastMarkPrice)) : 0;
    if (state.current && state.lastMarkPrice !== null && state.lastTimestampUtc !== null) {
      observeCycle(state.current, state.lastMarkPrice, state.lastTimestampUtc);
    }
    if (state.lastMarkPrice !== null && state.lastTimestampUtc !== null) {
      for (const cycle of state.warehoused) {
        observeCycle(cycle, state.lastMarkPrice, state.lastTimestampUtc);
        open = round6(open + cycleNetPnlAdr(cycle, state.lastMarkPrice));
      }
    }
    markPairWeekOpen(state.stats, week, pair, open);
  }

  function processWarehoused(state: PairRuleState, markPrice: number, timestamp: string, week: string) {
    for (const cycle of [...state.warehoused]) {
      observeCycle(cycle, markPrice, timestamp);
      const pnl = round6(cycleNetPnlAdr(cycle, markPrice));
      const reason = warehouseExitReason(state.rule, cycle, pnl, timestamp);
      if (!reason) continue;
      closeCycle({
        stats: state.stats,
        cycle,
        closeReason: reason,
        markPrice,
        timestampUtc: timestamp,
        weekOpenUtc: week,
      });
      state.warehoused = state.warehoused.filter((candidate) => candidate.cycle_id !== cycle.cycle_id);
    }
  }

  for (const row of rows) {
    for (const state of states) {
      if (state.currentWeek !== row.week_open_utc) {
        if (state.currentWeek !== null) snapshot(state, state.currentWeek);
        state.currentWeek = row.week_open_utc;
        state.resetsThisPairWeek = 0;
        state.stoppedThisPairWeek = false;
      }
    }

    const timestamps = row.path_payload.timestamp_utc;
    const closes = row.path_payload.directed_close_adr;
    for (let index = 0; index < timestamps.length; index += 1) {
      const timestamp = timestamps[index]!;
      const markPrice = markPriceFromDirectedClose(row, closes[index]!);

      for (const state of states) {
        state.lastMarkPrice = markPrice;
        state.lastTimestampUtc = timestamp;
        processWarehoused(state, markPrice, timestamp, row.week_open_utc);

        if (state.current && state.current.side !== row.candidate_b_side) {
          observeCycle(state.current, markPrice, timestamp);
          const flipPnl = round6(cycleNetPnlAdr(state.current, markPrice));
          if (shouldWarehouseLosingFlip(state.rule, flipPnl)) {
            warehouseCycle(state.current, state.rule, timestamp);
            state.warehoused.push(state.current);
          } else {
            closeCycle({ stats: state.stats, cycle: state.current, closeReason: "flip", markPrice, timestampUtc: timestamp, weekOpenUtc: row.week_open_utc });
          }
          state.current = null;
        }

        if (!state.current && !state.stoppedThisPairWeek) {
          state.serial += 1;
          state.current = startCycle({
            rule: state.rule,
            pair,
            row,
            markPrice,
            timestampUtc: timestamp,
            serial: state.serial,
            resetOrdinalAtStart: state.resetsThisPairWeek,
          });
        }
        if (!state.current) continue;

        if (state.rule.kind === "grid" && state.rule.spacing_adr !== null && !state.current.runner_only) {
          const added = addGridFills({
            cycle: state.current,
            markPrice,
            timestampUtc: timestamp,
            spacingAdr: state.rule.spacing_adr,
            twoSided: state.rule.two_sided_grid,
          });
          if (added.addedAdverse > 0 || added.addedExpansion > 0) {
            incrementMap(state.stats.fill_count_by_week, row.week_open_utc, added.addedAdverse + added.addedExpansion);
            incrementMap(state.stats.adverse_fill_count_by_week, row.week_open_utc, added.addedAdverse);
            incrementMap(state.stats.expansion_fill_count_by_week, row.week_open_utc, added.addedExpansion);
          }
        }

        observeCycle(state.current, markPrice, timestamp);
        const open = round6(cycleNetPnlAdr(state.current, markPrice));
        if (state.rule.kind === "grid" && state.rule.target_adr !== null && !state.current.runner_only && open >= state.rule.target_adr) {
          const nextResetCount = state.resetsThisPairWeek + 1;
          const finalAllowedReset = state.rule.pair_reset_limit_per_week !== null && nextResetCount >= state.rule.pair_reset_limit_per_week;
          if (finalAllowedReset && state.rule.runner_fraction !== null) {
            closeFinalResetWithRunner({
              stats: state.stats,
              cycle: state.current,
              markPrice,
              timestampUtc: timestamp,
              weekOpenUtc: row.week_open_utc,
              runnerFraction: state.rule.runner_fraction,
            });
            state.resetsThisPairWeek = nextResetCount;
            state.stoppedThisPairWeek = true;
          } else {
            closeCycle({
              stats: state.stats,
              cycle: state.current,
              closeReason: "target",
              markPrice,
              timestampUtc: timestamp,
              weekOpenUtc: row.week_open_utc,
              completedResetOrdinal: nextResetCount,
              terminalResetLimitClose: finalAllowedReset,
            });
            state.resetsThisPairWeek = nextResetCount;
            state.current = null;
            if (finalAllowedReset) {
              state.stoppedThisPairWeek = true;
            } else {
              state.serial += 1;
              state.current = startCycle({
                rule: state.rule,
                pair,
                row,
                markPrice,
                timestampUtc: timestamp,
                serial: state.serial,
                resetOrdinalAtStart: state.resetsThisPairWeek,
              });
            }
          }
        }
      }
    }
  }

  for (const state of states) {
    if (state.currentWeek !== null) snapshot(state, state.currentWeek);
    for (const missingWeek of selectedWeeks) {
      if (!state.stats.open_by_week.has(missingWeek)) addToMap(state.stats.open_by_week, missingWeek, 0);
    }
    if (state.current && state.lastMarkPrice !== null && state.lastTimestampUtc !== null && state.currentWeek !== null) {
      closeCycle({ stats: state.stats, cycle: state.current, closeReason: "sample_end", markPrice: state.lastMarkPrice, timestampUtc: state.lastTimestampUtc, weekOpenUtc: state.currentWeek });
    }
    if (state.lastMarkPrice !== null && state.lastTimestampUtc !== null && state.currentWeek !== null) {
      for (const cycle of state.warehoused) {
        closeCycle({
          stats: state.stats,
          cycle,
          closeReason: "sample_end",
          markPrice: state.lastMarkPrice,
          timestampUtc: state.lastTimestampUtc,
          weekOpenUtc: state.currentWeek,
        });
      }
    }
  }
}

function replayFullyHedgedWeeklyForPair(pair: string, rows: ReplayRow[], selectedWeeks: string[], rules: ReplayRule[], statsByRule: Map<string, RuleStats>) {
  const hedgedRules = rules.filter((rule) => rule.kind === "fully_hedged_weekly_grid");
  if (hedgedRules.length === 0) return;
  const lastWeek = selectedWeeks.at(-1);

  for (const rule of hedgedRules) {
    const stats = statsByRule.get(rule.rule_id)!;
    let serial = 0;

    for (const row of rows) {
      let pairWeekOpen = 0;
      for (const side of ["LONG", "SHORT"] as const) {
        let current: Cycle | null = null;
        let resetCount = 0;
        let stopped = false;
        const timestamps = row.path_payload.timestamp_utc;
        const closes = row.path_payload.directed_close_adr;

        for (let index = 0; index < timestamps.length; index += 1) {
          const timestamp = timestamps[index]!;
          const markPrice = markPriceFromDirectedClose(row, closes[index]!);
          if (!current && !stopped) {
            serial += 1;
            current = startCycle({
              rule,
              pair,
              row,
              markPrice,
              timestampUtc: timestamp,
              serial,
              resetOrdinalAtStart: resetCount,
              sideOverride: side,
            });
          }
          if (!current) continue;

          if (rule.spacing_adr !== null) {
            const added = addGridFills({
              cycle: current,
              markPrice,
              timestampUtc: timestamp,
              spacingAdr: rule.spacing_adr,
              twoSided: rule.two_sided_grid,
            });
            if (added.addedAdverse > 0 || added.addedExpansion > 0) {
              incrementMap(stats.fill_count_by_week, row.week_open_utc, added.addedAdverse + added.addedExpansion);
              incrementMap(stats.adverse_fill_count_by_week, row.week_open_utc, added.addedAdverse);
              incrementMap(stats.expansion_fill_count_by_week, row.week_open_utc, added.addedExpansion);
            }
          }

          observeCycle(current, markPrice, timestamp);
          const open = round6(cycleNetPnlAdr(current, markPrice));
          if (rule.target_adr !== null && open >= rule.target_adr) {
            const nextResetCount = resetCount + 1;
            const finalAllowedReset = rule.pair_reset_limit_per_week !== null && nextResetCount >= rule.pair_reset_limit_per_week;
            closeCycle({
              stats,
              cycle: current,
              closeReason: "target",
              markPrice,
              timestampUtc: timestamp,
              weekOpenUtc: row.week_open_utc,
              completedResetOrdinal: nextResetCount,
              terminalResetLimitClose: finalAllowedReset,
            });
            resetCount = nextResetCount;
            current = null;
            if (finalAllowedReset) {
              stopped = true;
            }
          }
        }

        if (current) {
          const timestamp = row.path_payload.timestamp_utc.at(-1)!;
          const markPrice = markPriceFromDirectedClose(row, row.path_payload.directed_close_adr.at(-1)!);
          const open = round6(cycleNetPnlAdr(current, markPrice));
          pairWeekOpen = round6(pairWeekOpen + open);
          closeCycle({
            stats,
            cycle: current,
            closeReason: "sample_end",
            markPrice,
            timestampUtc: timestamp,
            weekOpenUtc: row.week_open_utc,
            recordFinalOpenByPair: row.week_open_utc === lastWeek,
          });
        }
      }
      markPairWeekOpen(stats, row.week_open_utc, pair, pairWeekOpen);
    }
  }
}

function weeklyRowsForRule(stats: RuleStats, weeks: string[]): WeeklyRow[] {
  let previousEquity = 0;
  let closedCumulative = 0;
  return weeks.map((week) => {
    const closed = round6(stats.closed_by_week.get(week) ?? 0);
    closedCumulative = round6(closedCumulative + closed);
    const open = round6(stats.open_by_week.get(week) ?? 0);
    const equity = round6(closedCumulative + open);
    const delta = round6(equity - previousEquity);
    previousEquity = equity;
    return {
      rule_id: stats.rule.rule_id,
      rule_family: stats.rule.rule_family,
      scope: stats.rule.scope,
      week_open_utc: week,
      closed_week_adr: closed,
      open_unrealized_adr: open,
      equity_delta_adr: delta,
      equity_snapshot_adr: equity,
      reset_count_week: stats.reset_by_week.get(week) ?? 0,
      pair_reset_count_week: stats.pair_reset_by_week.get(week) ?? 0,
      account_reset_count_week: stats.account_reset_by_week.get(week) ?? 0,
      account_emergency_sl_count_week: stats.account_emergency_sl_by_week.get(week) ?? 0,
      fill_count_week: stats.fill_count_by_week.get(week) ?? 0,
      adverse_fill_count_week: stats.adverse_fill_count_by_week.get(week) ?? 0,
      expansion_fill_count_week: stats.expansion_fill_count_by_week.get(week) ?? 0,
    };
  });
}

function maxDrawdown(rows: WeeklyRow[]) {
  let peak = 0;
  let maxDd = 0;
  for (const row of rows) {
    if (row.equity_snapshot_adr > peak) peak = row.equity_snapshot_adr;
    const dd = round6(row.equity_snapshot_adr - peak);
    if (dd < maxDd) maxDd = dd;
  }
  return round6(maxDd);
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return round6(sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!);
}

function yearFromWeek(weekOpenUtc: string) {
  return new Date(weekOpenUtc).getUTCFullYear();
}

function monthFromWeek(weekOpenUtc: string) {
  return weekOpenUtc.slice(0, 7);
}

function rollingWorst(values: number[], windowSize: number) {
  if (values.length < windowSize) return null;
  let worst = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= values.length - windowSize; index += 1) {
    const total = round6(values.slice(index, index + windowSize).reduce((sum, value) => sum + value, 0));
    if (total < worst) worst = total;
  }
  return round6(worst);
}

function drawdownDurationStats(rows: WeeklyRow[]) {
  let peak = 0;
  let timeInDrawdown = 0;
  let longestDrawdown = 0;
  let currentDrawdown = 0;
  for (const row of rows) {
    if (row.equity_snapshot_adr > peak) peak = row.equity_snapshot_adr;
    if (row.equity_snapshot_adr < peak) {
      timeInDrawdown += 1;
      currentDrawdown += 1;
      longestDrawdown = Math.max(longestDrawdown, currentDrawdown);
    } else {
      currentDrawdown = 0;
    }
  }
  return { timeInDrawdown, longestDrawdown };
}

function summarizeRule(stats: RuleStats, weeklyRows: WeeklyRow[], topWeeks: Set<string>, top20BaselineAdr: number): AdapterSummaryRow {
  const closedEvents = stats.close_events.filter((event) => event.close_reason !== "sample_end");
  const finalEquity = weeklyRows.at(-1)?.equity_snapshot_adr ?? 0;
  const finalOpen = weeklyRows.at(-1)?.open_unrealized_adr ?? 0;
  const byYear = new Map<string, number>();
  for (const row of weeklyRows) addToMap(byYear, String(yearFromWeek(row.week_open_utc)), row.equity_delta_adr);
  const byMonth = new Map<string, { mtm: number; closed: number }>();
  for (const row of weeklyRows) {
    const month = monthFromWeek(row.week_open_utc);
    const current = byMonth.get(month) ?? { mtm: 0, closed: 0 };
    current.mtm = round6(current.mtm + row.equity_delta_adr);
    current.closed = round6(current.closed + row.closed_week_adr);
    byMonth.set(month, current);
  }
  const top20Equity = round6(weeklyRows.filter((row) => topWeeks.has(row.week_open_utc)).reduce((sum, row) => sum + row.equity_delta_adr, 0));
  const negativeCycles = stats.close_events.filter((event) => event.went_negative);
  const recovered = negativeCycles.filter((event) => event.recovered_to_positive_close);
  const weeklyMtmValues = weeklyRows.map((row) => row.equity_delta_adr);
  const weeklyClosedValues = weeklyRows.map((row) => row.closed_week_adr);
  const closedTotal = round6(closedEvents.reduce((sum, event) => sum + event.realized_or_open_adr, 0));
  const warehouseEvents = stats.close_events.filter((event) => event.was_warehoused);
  const warehouseFinal = warehouseEvents.filter((event) => event.close_reason === "sample_end");
  const warehouseRecovered = warehouseEvents.filter((event) => event.close_reason === "warehouse_recovery");
  const warehouseDurations = warehouseEvents.map((event) => event.warehouse_duration_hours).filter((value): value is number => value !== null);
  const drawdownDurations = drawdownDurationStats(weeklyRows);
  return {
    rule_id: stats.rule.rule_id,
    rule_family: stats.rule.rule_family,
    scope: stats.rule.scope,
    target_adr: stats.rule.target_adr,
    spacing_adr: stats.rule.spacing_adr,
    two_sided_grid: stats.rule.two_sided_grid,
    reset_limit_per_week: stats.rule.pair_reset_limit_per_week ?? stats.rule.account_reset_limit_per_week,
    runner_fraction: stats.rule.runner_fraction,
    account_emergency_sl_adr: stats.rule.account_emergency_sl_adr,
    base_rule_id: stats.rule.base_rule_id,
    flip_policy: stats.rule.flip_policy,
    fully_hedged_reference: stats.rule.kind === "fully_hedged_weekly_grid",
    reference_only: stats.rule.reference_only,
    closed_total_adr: closedTotal,
    final_equity_adr: round6(finalEquity),
    equity_profit_factor: profitFactor(weeklyMtmValues),
    closed_profit_factor: profitFactor(weeklyClosedValues),
    max_equity_drawdown_adr: maxDrawdown(weeklyRows),
    final_open_unrealized_adr: round6(finalOpen),
    worst_week_end_open_unrealized_adr: round6(weeklyRows.reduce((min, row) => Math.min(min, row.open_unrealized_adr), 0)),
    closed_adr_retention_vs_gate74e_focus: FOCUS_CLOSED_ADR === 0 ? null : round6(closedTotal / FOCUS_CLOSED_ADR),
    final_equity_retention_vs_gate74e_focus: FOCUS_EQUITY_ADR === 0 ? null : round6(finalEquity / FOCUS_EQUITY_ADR),
    top20_winner_retention_vs_weekly_forced: top20BaselineAdr === 0 ? null : round6(top20Equity / top20BaselineAdr),
    worst_week_loss_adr: round6(Math.min(...weeklyMtmValues, 0)),
    worst_5_week_loss_adr: rollingWorst(weeklyMtmValues, 5) ?? 0,
    worst_13_week_loss_adr: rollingWorst(weeklyMtmValues, 13) ?? 0,
    negative_years: [...byYear.values()].filter((value) => value < 0).length,
    mtm_weekly_win_rate: round6(weeklyMtmValues.filter((value) => value > 0).length / Math.max(1, weeklyMtmValues.length)),
    closed_weekly_win_rate: round6(weeklyClosedValues.filter((value) => value > 0).length / Math.max(1, weeklyClosedValues.length)),
    mtm_monthly_win_rate: round6([...byMonth.values()].filter((value) => value.mtm > 0).length / Math.max(1, byMonth.size)),
    closed_monthly_win_rate: round6([...byMonth.values()].filter((value) => value.closed > 0).length / Math.max(1, byMonth.size)),
    time_in_drawdown_weeks: drawdownDurations.timeInDrawdown,
    longest_drawdown_weeks: drawdownDurations.longestDrawdown,
    equity_curve_roughness_adr: round6(weeklyMtmValues.reduce((sum, value) => sum + Math.abs(value), 0) / Math.max(1, weeklyMtmValues.length)),
    closed_cycles: closedEvents.length,
    target_reset_cycles: closedEvents.filter((event) => event.close_reason === "target").length,
    account_reset_events: stats.account_reset_events,
    account_emergency_sl_events: stats.account_emergency_sl_events,
    flip_loss_adr: round6(closedEvents.filter((event) => event.close_reason === "flip" && event.realized_or_open_adr < 0).reduce((sum, event) => sum + event.realized_or_open_adr, 0)),
    flip_event_count: closedEvents.filter((event) => event.close_reason === "flip").length,
    warehouse_position_count: warehouseEvents.length,
    warehouse_recovered_count: warehouseRecovered.length,
    warehouse_recovery_rate: warehouseEvents.length === 0 ? null : round6(warehouseRecovered.length / warehouseEvents.length),
    warehouse_final_unresolved_loss_adr: round6(warehouseFinal.filter((event) => event.realized_or_open_adr < 0).reduce((sum, event) => sum + event.realized_or_open_adr, 0)),
    average_warehouse_duration_hours: median(warehouseDurations),
    max_warehouse_duration_hours: warehouseDurations.length === 0 ? null : round6(Math.max(...warehouseDurations)),
    negative_cycles: negativeCycles.length,
    recovered_negative_cycles: recovered.length,
    negative_cycle_recovery_rate: negativeCycles.length === 0 ? null : round6(recovered.length / negativeCycles.length),
    fill_count: round6(closedEvents.reduce((sum, event) => sum + event.fill_count, 0)),
    adverse_recovery_fill_count: round6(closedEvents.reduce((sum, event) => sum + event.adverse_fill_count, 0)),
    favorable_expansion_fill_count: round6(closedEvents.reduce((sum, event) => sum + event.expansion_fill_count, 0)),
    closed_adr_from_initial_fills: round6(closedEvents.reduce((sum, event) => sum + event.initial_fill_closed_adr, 0)),
    closed_adr_from_recovery_fills: round6(closedEvents.reduce((sum, event) => sum + event.recovery_fill_closed_adr, 0)),
    closed_adr_from_expansion_fills: round6(closedEvents.reduce((sum, event) => sum + event.expansion_fill_closed_adr, 0)),
    average_closed_cycle_hold_hours: median(closedEvents.map((event) => event.age_hours)),
    max_cycle_mfe_adr: closedEvents.length === 0 ? null : round6(closedEvents.reduce((max, event) => Math.max(max, event.max_pnl_adr), Number.NEGATIVE_INFINITY)),
    total_giveback_adr: round6(closedEvents.reduce((sum, event) => sum + Math.max(0, event.giveback_adr), 0)),
  };
}

function annualRows(weeklyRows: WeeklyRow[]) {
  const grouped = new Map<string, WeeklyRow[]>();
  for (const row of weeklyRows) {
    const key = `${row.rule_id}|${yearFromWeek(row.week_open_utc)}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return [...grouped.values()].map((rows) => ({
    rule_id: rows[0]!.rule_id,
    rule_family: rows[0]!.rule_family,
    year: yearFromWeek(rows[0]!.week_open_utc),
    equity_delta_adr: round6(rows.reduce((sum, row) => sum + row.equity_delta_adr, 0)),
    closed_adr: round6(rows.reduce((sum, row) => sum + row.closed_week_adr, 0)),
    final_open_unrealized_adr: rows.at(-1)!.open_unrealized_adr,
    profitable_weeks: rows.filter((row) => row.equity_delta_adr > 0).length,
    weeks: rows.length,
  }));
}

function groupKey(parts: Array<string | number | null>) {
  return parts.map((part) => String(part ?? "")).join("|");
}

function closeReasonBucket(event: CloseEvent) {
  if (event.close_reason === "target" && event.terminal_reset_limit_close) return "terminal_reset_limit_close";
  if (event.close_reason === "target") return "target_reset_close";
  if (event.close_reason === "weekly_forced_close") return "weekly_close";
  if (event.close_reason === "flip") return "candidate_b_flip_close";
  if (event.close_reason === "sample_end") return "data_end_open_inventory";
  return event.close_reason;
}

function closeReasonBreakdownRows(statsByRule: Map<string, RuleStats>) {
  const grouped = new Map<string, { stats: RuleStats; bucket: string; events: CloseEvent[] }>();
  for (const stats of statsByRule.values()) {
    for (const event of stats.close_events) {
      const bucket = closeReasonBucket(event);
      const key = groupKey([stats.rule.rule_id, bucket]);
      const current = grouped.get(key) ?? { stats, bucket, events: [] };
      current.events.push(event);
      grouped.set(key, current);
    }
  }
  return [...grouped.values()].map(({ stats, bucket, events }) => ({
    rule_id: stats.rule.rule_id,
    rule_family: stats.rule.rule_family,
    base_rule_id: stats.rule.base_rule_id,
    flip_policy: stats.rule.flip_policy,
    close_reason_bucket: bucket,
    event_count: events.length,
    adr: round6(events.reduce((sum, event) => sum + event.realized_or_open_adr, 0)),
    loss_adr: round6(events.filter((event) => event.realized_or_open_adr < 0).reduce((sum, event) => sum + event.realized_or_open_adr, 0)),
    win_count: events.filter((event) => event.realized_or_open_adr > 0).length,
    loss_count: events.filter((event) => event.realized_or_open_adr < 0).length,
    median_event_adr: median(events.map((event) => event.realized_or_open_adr)),
    worst_event_adr: round6(Math.min(...events.map((event) => event.realized_or_open_adr), 0)),
    average_age_hours: round6(events.reduce((sum, event) => sum + event.age_hours, 0) / Math.max(1, events.length)),
  }));
}

function currencyContribution(events: CloseEvent[]) {
  const byCurrency = new Map<string, number>();
  for (const event of events) {
    addToMap(byCurrency, event.base_currency, event.realized_or_open_adr);
    addToMap(byCurrency, event.quote_currency, event.realized_or_open_adr);
  }
  return [...byCurrency.entries()]
    .map(([currency, adr]) => ({ currency, adr: round6(adr) }))
    .sort((left, right) => left.adr - right.adr);
}

function flipAnatomyRows(statsByRule: Map<string, RuleStats>) {
  const rows: Array<Record<string, unknown>> = [];
  for (const stats of statsByRule.values()) {
    const flipEvents = stats.close_events.filter((event) => event.close_reason === "flip");
    const flipLossEvents = flipEvents.filter((event) => event.realized_or_open_adr < 0);
    const pairRows = [...new Set(flipEvents.map((event) => event.pair))].map((pair) => {
      const events = flipEvents.filter((event) => event.pair === pair);
      return { pair, adr: round6(events.reduce((sum, event) => sum + event.realized_or_open_adr, 0)) };
    }).sort((left, right) => left.adr - right.adr);
    const currencyRows = currencyContribution(flipEvents);
    rows.push({
      rule_id: stats.rule.rule_id,
      rule_family: stats.rule.rule_family,
      base_rule_id: stats.rule.base_rule_id,
      flip_policy: stats.rule.flip_policy,
      flip_event_count: flipEvents.length,
      flip_loss_event_count: flipLossEvents.length,
      total_flip_loss_adr: round6(flipLossEvents.reduce((sum, event) => sum + event.realized_or_open_adr, 0)),
      total_flip_adr: round6(flipEvents.reduce((sum, event) => sum + event.realized_or_open_adr, 0)),
      average_flip_loss_adr: flipLossEvents.length === 0 ? null : round6(flipLossEvents.reduce((sum, event) => sum + event.realized_or_open_adr, 0) / flipLossEvents.length),
      median_flip_loss_adr: median(flipLossEvents.map((event) => event.realized_or_open_adr)),
      worst_flip_loss_adr: round6(Math.min(...flipLossEvents.map((event) => event.realized_or_open_adr), 0)),
      profitable_inventory_flip_count: flipEvents.filter((event) => event.inventory_state_at_close === "profitable" || event.inventory_state_at_close === "mixed_profitable").length,
      losing_inventory_flip_count: flipEvents.filter((event) => event.inventory_state_at_close === "losing" || event.inventory_state_at_close === "mixed_losing").length,
      mixed_inventory_flip_count: flipEvents.filter((event) => event.inventory_state_at_close.startsWith("mixed")).length,
      average_open_state_before_flip_adr: flipEvents.length === 0 ? null : round6(flipEvents.reduce((sum, event) => sum + event.realized_or_open_adr, 0) / flipEvents.length),
      median_reset_ordinal_at_flip: median(flipEvents.map((event) => event.reset_ordinal_at_start)),
      median_inventory_age_hours_at_flip: median(flipEvents.map((event) => event.age_hours)),
      worst_pair: pairRows[0]?.pair ?? null,
      worst_pair_flip_adr: pairRows[0]?.adr ?? null,
      worst_currency: currencyRows[0]?.currency ?? null,
      worst_currency_flip_adr: currencyRows[0]?.adr ?? null,
    });
  }
  return rows;
}

function ordinalBucket(event: CloseEvent) {
  if (event.terminal_reset_limit_close) return `terminal_after_reset_${event.completed_reset_ordinal ?? event.reset_ordinal_at_start}`;
  if (event.reset_ordinal_at_start === 0) return "initial_cycle";
  return `reset_${event.reset_ordinal_at_start}`;
}

function resetOrdinalRows(statsByRule: Map<string, RuleStats>) {
  const grouped = new Map<string, { stats: RuleStats; bucket: string; events: CloseEvent[] }>();
  for (const stats of statsByRule.values()) {
    for (const event of stats.close_events) {
      if (event.close_reason === "weekly_forced_close") continue;
      const bucket = ordinalBucket(event);
      const key = groupKey([stats.rule.rule_id, bucket]);
      const current = grouped.get(key) ?? { stats, bucket, events: [] };
      current.events.push(event);
      grouped.set(key, current);
    }
  }
  return [...grouped.values()].map(({ stats, bucket, events }) => {
    const nonOpen = events.filter((event) => event.close_reason !== "sample_end");
    const wins = nonOpen.filter((event) => event.realized_or_open_adr > 0).map((event) => event.realized_or_open_adr);
    const losses = nonOpen.filter((event) => event.realized_or_open_adr < 0).map((event) => event.realized_or_open_adr);
    const negativePair = [...new Set(events.map((event) => event.pair))].map((pair) => ({
      pair,
      adr: round6(events.filter((event) => event.pair === pair && event.realized_or_open_adr < 0).reduce((sum, event) => sum + event.realized_or_open_adr, 0)),
    })).sort((left, right) => left.adr - right.adr)[0];
    return {
      rule_id: stats.rule.rule_id,
      rule_family: stats.rule.rule_family,
      base_rule_id: stats.rule.base_rule_id,
      flip_policy: stats.rule.flip_policy,
      reset_ordinal_bucket: bucket,
      event_count: events.length,
      closed_adr: round6(nonOpen.reduce((sum, event) => sum + event.realized_or_open_adr, 0)),
      open_unrealized_adr: round6(events.filter((event) => event.close_reason === "sample_end").reduce((sum, event) => sum + event.realized_or_open_adr, 0)),
      win_rate: round6(wins.length / Math.max(1, nonOpen.length)),
      average_win_adr: wins.length === 0 ? null : round6(wins.reduce((sum, value) => sum + value, 0) / wins.length),
      average_loss_adr: losses.length === 0 ? null : round6(losses.reduce((sum, value) => sum + value, 0) / losses.length),
      worst_loss_adr: round6(Math.min(...losses, 0)),
      average_adverse_excursion_adr: round6(events.reduce((sum, event) => sum + event.min_pnl_adr, 0) / Math.max(1, events.length)),
      flip_loss_adr: round6(events.filter((event) => event.close_reason === "flip" && event.realized_or_open_adr < 0).reduce((sum, event) => sum + event.realized_or_open_adr, 0)),
      final_open_loss_adr: round6(events.filter((event) => event.close_reason === "sample_end" && event.realized_or_open_adr < 0).reduce((sum, event) => sum + event.realized_or_open_adr, 0)),
      worst_pair: negativePair?.pair ?? null,
      worst_pair_loss_adr: negativePair?.adr ?? null,
    };
  });
}

function ageBucket(ageHours: number) {
  const weeks = ageHours / (24 * 7);
  if (weeks <= 1) return "same_week";
  if (weeks <= 2) return "1_2_weeks";
  if (weeks <= 4) return "3_4_weeks";
  if (weeks <= 8) return "5_8_weeks";
  if (weeks <= 13) return "9_13_weeks";
  return "13_plus_weeks";
}

function ageBucketRows(statsByRule: Map<string, RuleStats>) {
  const grouped = new Map<string, { stats: RuleStats; bucket: string; events: CloseEvent[] }>();
  for (const stats of statsByRule.values()) {
    for (const event of stats.close_events) {
      if (event.close_reason === "weekly_forced_close") continue;
      const bucket = ageBucket(event.age_hours);
      const key = groupKey([stats.rule.rule_id, bucket]);
      const current = grouped.get(key) ?? { stats, bucket, events: [] };
      current.events.push(event);
      grouped.set(key, current);
    }
  }
  return [...grouped.values()].map(({ stats, bucket, events }) => {
    const wentNegative = events.filter((event) => event.went_negative);
    const recovered = wentNegative.filter((event) => event.recovered_to_positive_close);
    const recoveryHours = recovered.map((event) => event.age_hours);
    const worstPair = [...new Set(events.map((event) => event.pair))].map((pair) => ({
      pair,
      adr: round6(events.filter((event) => event.pair === pair).reduce((sum, event) => sum + Math.min(0, event.realized_or_open_adr), 0)),
    })).sort((left, right) => left.adr - right.adr)[0];
    const worstCurrency = currencyContribution(events.filter((event) => event.realized_or_open_adr < 0))[0];
    return {
      rule_id: stats.rule.rule_id,
      rule_family: stats.rule.rule_family,
      base_rule_id: stats.rule.base_rule_id,
      flip_policy: stats.rule.flip_policy,
      age_bucket: bucket,
      event_count: events.length,
      open_loss_adr: round6(events.filter((event) => event.close_reason === "sample_end" && event.realized_or_open_adr < 0).reduce((sum, event) => sum + event.realized_or_open_adr, 0)),
      realized_loss_adr: round6(events.filter((event) => event.close_reason !== "sample_end" && event.realized_or_open_adr < 0).reduce((sum, event) => sum + event.realized_or_open_adr, 0)),
      flip_loss_adr: round6(events.filter((event) => event.close_reason === "flip" && event.realized_or_open_adr < 0).reduce((sum, event) => sum + event.realized_or_open_adr, 0)),
      recovery_rate: wentNegative.length === 0 ? null : round6(recovered.length / wentNegative.length),
      average_time_to_recovery_hours: median(recoveryHours),
      worst_pair: worstPair?.pair ?? null,
      worst_pair_loss_adr: worstPair?.adr ?? null,
      worst_currency: worstCurrency?.currency ?? null,
      worst_currency_loss_adr: worstCurrency?.adr ?? null,
    };
  });
}

function pairCurrencyAttributionRows(statsByRule: Map<string, RuleStats>) {
  const pairRows: Array<Record<string, unknown>> = [];
  const currencyRows = new Map<string, Record<string, unknown> & { closed_adr: number; final_open_unrealized_adr: number; flip_loss_adr: number }>();
  for (const stats of statsByRule.values()) {
    const pairs = new Set([
      ...stats.close_events.map((event) => event.pair),
      ...[...stats.final_open_by_pair.keys()],
    ]);
    for (const pair of pairs) {
      const events = stats.close_events.filter((event) => event.pair === pair);
      const closedAdr = round6(events.filter((event) => event.close_reason !== "sample_end").reduce((sum, event) => sum + event.realized_or_open_adr, 0));
      const finalOpen = round6(stats.final_open_by_pair.get(pair) ?? 0);
      const flipLoss = round6(events.filter((event) => event.close_reason === "flip" && event.realized_or_open_adr < 0).reduce((sum, event) => sum + event.realized_or_open_adr, 0));
      const worstOpen = round6(Math.min(...[...stats.open_by_pair_week.entries()]
        .filter(([key]) => key.endsWith(`|${pair}`))
        .map(([, value]) => value), 0));
      pairRows.push({
        rule_id: stats.rule.rule_id,
        rule_family: stats.rule.rule_family,
        base_rule_id: stats.rule.base_rule_id,
        flip_policy: stats.rule.flip_policy,
        pair,
        closed_adr: closedAdr,
        mtm_adr: round6(closedAdr + finalOpen),
        final_open_unrealized_adr: finalOpen,
        worst_week_end_open_unrealized_adr: worstOpen,
        flip_loss_adr: flipLoss,
        target_reset_adr: round6(events.filter((event) => event.close_reason === "target").reduce((sum, event) => sum + event.realized_or_open_adr, 0)),
        sample_end_event_count: events.filter((event) => event.close_reason === "sample_end").length,
      });
      for (const currency of [pair.slice(0, 3), pair.slice(3, 6)]) {
        const key = groupKey([stats.rule.rule_id, currency]);
        const current = currencyRows.get(key) ?? {
          rule_id: stats.rule.rule_id,
          rule_family: stats.rule.rule_family,
          base_rule_id: stats.rule.base_rule_id,
          flip_policy: stats.rule.flip_policy,
          currency,
          closed_adr: 0,
          final_open_unrealized_adr: 0,
          flip_loss_adr: 0,
          pair_count: 0,
        };
        current.closed_adr = round6(current.closed_adr + closedAdr);
        current.final_open_unrealized_adr = round6(current.final_open_unrealized_adr + finalOpen);
        current.flip_loss_adr = round6(current.flip_loss_adr + flipLoss);
        current.pair_count = Number(current.pair_count) + 1;
        currencyRows.set(key, current);
      }
    }
  }
  return {
    pairRows: pairRows.sort((left, right) => String(left.rule_id).localeCompare(String(right.rule_id)) || Number(left.mtm_adr) - Number(right.mtm_adr)),
    currencyRows: [...currencyRows.values()]
      .map((row) => ({ ...row, mtm_adr: round6(row.closed_adr + row.final_open_unrealized_adr) }))
      .sort((left, right) => String(left.rule_id).localeCompare(String(right.rule_id)) || Number(left.mtm_adr) - Number(right.mtm_adr)),
  };
}

function audnzdSentinelRows(pairRows: Array<Record<string, unknown>>, resetRows: Array<Record<string, unknown>>, ageRows: Array<Record<string, unknown>>) {
  const audnzdRows = pairRows.filter((row) => row.pair === "AUDNZD");
  return audnzdRows.map((row) => {
    const ruleId = String(row.rule_id);
    const resetDamage = resetRows
      .filter((candidate) => candidate.rule_id === ruleId)
      .sort((left, right) => Number(left.final_open_loss_adr) + Number(left.flip_loss_adr) - (Number(right.final_open_loss_adr) + Number(right.flip_loss_adr)))[0];
    const ageDamage = ageRows
      .filter((candidate) => candidate.rule_id === ruleId)
      .sort((left, right) => Number(left.open_loss_adr) + Number(left.flip_loss_adr) - (Number(right.open_loss_adr) + Number(right.flip_loss_adr)))[0];
    return {
      rule_id: ruleId,
      rule_family: row.rule_family,
      base_rule_id: row.base_rule_id,
      flip_policy: row.flip_policy,
      audnzd_closed_adr: row.closed_adr,
      audnzd_mtm_adr: row.mtm_adr,
      audnzd_final_open_unrealized_adr: row.final_open_unrealized_adr,
      audnzd_worst_open_unrealized_adr: row.worst_week_end_open_unrealized_adr,
      audnzd_flip_loss_adr: row.flip_loss_adr,
      worst_reset_ordinal_bucket: resetDamage?.reset_ordinal_bucket ?? null,
      worst_reset_ordinal_damage_adr: resetDamage ? round6(Number(resetDamage.final_open_loss_adr ?? 0) + Number(resetDamage.flip_loss_adr ?? 0)) : null,
      worst_age_bucket: ageDamage?.age_bucket ?? null,
      worst_age_bucket_damage_adr: ageDamage ? round6(Number(ageDamage.open_loss_adr ?? 0) + Number(ageDamage.flip_loss_adr ?? 0)) : null,
      sentinel_read: "reporting_only_no_audnzd_exclusion",
    };
  });
}

function adapterRowsMatch(left: AdapterSummaryRow | undefined, right: AdapterSummaryRow | undefined) {
  if (!left || !right) return false;
  const fields: Array<keyof AdapterSummaryRow> = [
    "closed_total_adr",
    "final_equity_adr",
    "equity_profit_factor",
    "max_equity_drawdown_adr",
    "final_open_unrealized_adr",
    "flip_loss_adr",
    "fill_count",
    "target_reset_cycles",
  ];
  return fields.every((field) => {
    const leftValue = left[field];
    const rightValue = right[field];
    if (typeof leftValue === "number" && typeof rightValue === "number") return Math.abs(leftValue - rightValue) <= 0.000001;
    return leftValue === rightValue;
  });
}

function withHashes<T extends Record<string, unknown>>(rows: T[]) {
  return rows.map((row) => ({ ...row, content_hash: sha256Stable(row) }));
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const stringValue = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\r\n]/.test(stringValue)) return `"${stringValue.replace(/"/g, '""')}"`;
  return stringValue;
}

function reportCell(value: unknown) {
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

async function writeCsv(filePath: string, rows: Array<Record<string, unknown>>) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((column) => csvEscape(row[column])).join(","));
  await writeText(filePath, `${lines.join("\n")}\n`);
}

async function writeRows<T extends object>(jsonPath: string, csvPath: string, rows: T[]) {
  await writeJson(jsonPath, rows);
  await writeCsv(csvPath, rows.map((row) => row as Record<string, unknown>));
}

function tableRows(rows: AdapterSummaryRow[]) {
  return rows.map((row) => ({
    rule_id: row.rule_id,
    family: row.rule_family,
    flip_policy: row.flip_policy,
    runner: row.runner_fraction,
    account_sl: row.account_emergency_sl_adr,
    reference_only: row.reference_only,
    closed: row.closed_total_adr,
    equity: row.final_equity_adr,
    eq_pf: row.equity_profit_factor,
    closed_pf: row.closed_profit_factor,
    dd: row.max_equity_drawdown_adr,
    open: row.final_open_unrealized_adr,
    worst_open: row.worst_week_end_open_unrealized_adr,
    worst1: row.worst_week_loss_adr,
    worst5: row.worst_5_week_loss_adr,
    worst13: row.worst_13_week_loss_adr,
    neg_years: row.negative_years,
    mtm_weekly_win_rate: row.mtm_weekly_win_rate,
    closed_weekly_win_rate: row.closed_weekly_win_rate,
    mtm_monthly_win_rate: row.mtm_monthly_win_rate,
    top20: row.top20_winner_retention_vs_weekly_forced,
    recovery: row.negative_cycle_recovery_rate,
    flip_loss: row.flip_loss_adr,
    warehouse_recovery_rate: row.warehouse_recovery_rate,
    resets: row.target_reset_cycles + row.account_reset_events,
    account_sl_events: row.account_emergency_sl_events,
    fills: row.fill_count,
    adverse: row.adverse_recovery_fill_count,
    expansion: row.favorable_expansion_fill_count,
  }));
}

function counterfactualTableRows(adapterRows: AdapterSummaryRow[]) {
  const byRule = new Map(adapterRows.map((row) => [row.rule_id, row]));
  return adapterRows
    .filter((row) => row.rule_family === "flip_counterfactual")
    .map((row) => {
      const base = row.base_rule_id ? byRule.get(row.base_rule_id) : undefined;
      return {
        rule_id: row.rule_id,
        base_rule_id: row.base_rule_id,
        flip_policy: row.flip_policy,
        closed_total_adr: row.closed_total_adr,
        final_equity_adr: row.final_equity_adr,
        final_open_unrealized_adr: row.final_open_unrealized_adr,
        worst_week_end_open_unrealized_adr: row.worst_week_end_open_unrealized_adr,
        flip_loss_adr: row.flip_loss_adr,
        max_equity_drawdown_adr: row.max_equity_drawdown_adr,
        worst_13_week_loss_adr: row.worst_13_week_loss_adr,
        closed_weekly_win_rate: row.closed_weekly_win_rate,
        mtm_weekly_win_rate: row.mtm_weekly_win_rate,
        warehouse_position_count: row.warehouse_position_count,
        warehouse_recovery_rate: row.warehouse_recovery_rate,
        warehouse_final_unresolved_loss_adr: row.warehouse_final_unresolved_loss_adr,
        average_warehouse_duration_hours: row.average_warehouse_duration_hours,
        max_warehouse_duration_hours: row.max_warehouse_duration_hours,
        equity_delta_vs_base_adr: base ? round6(row.final_equity_adr - base.final_equity_adr) : null,
        open_delta_vs_base_adr: base ? round6(row.final_open_unrealized_adr - base.final_open_unrealized_adr) : null,
        drawdown_delta_vs_base_adr: base ? round6(row.max_equity_drawdown_adr - base.max_equity_drawdown_adr) : null,
        flip_loss_delta_vs_base_adr: base ? round6(row.flip_loss_adr - base.flip_loss_adr) : null,
        transfer_read:
          !base
            ? "missing_base"
            : row.flip_loss_adr > base.flip_loss_adr && row.final_open_unrealized_adr < base.final_open_unrealized_adr
              ? "reduced_flip_loss_but_transferred_damage_to_open_inventory"
              : row.flip_loss_adr > base.flip_loss_adr && row.final_equity_adr > base.final_equity_adr
                ? "reduced_flip_loss_and_improved_mtm"
                : "did_not_improve_flip_tail_balance",
      };
    });
}

function hedgedBenchmarkRows(adapterRows: AdapterSummaryRow[]) {
  const t100 = adapterRows.find((row) => row.rule_id === GATE77_T100_L3_RULE_ID);
  const hedged = adapterRows.find((row) => row.rule_id === GATE79_FULLY_HEDGED_RULE_ID);
  if (!t100 || !hedged) return [];
  return [{
    diagnostic: "fully_hedged_long_short_28_pairs_weekly_vs_directional_t100_l3",
    directional_rule_id: t100.rule_id,
    hedged_rule_id: hedged.rule_id,
    directional_final_equity_adr: t100.final_equity_adr,
    hedged_final_equity_adr: hedged.final_equity_adr,
    equity_edge_vs_hedged_adr: round6(t100.final_equity_adr - hedged.final_equity_adr),
    directional_max_drawdown_adr: t100.max_equity_drawdown_adr,
    hedged_max_drawdown_adr: hedged.max_equity_drawdown_adr,
    drawdown_edge_vs_hedged_adr: round6(t100.max_equity_drawdown_adr - hedged.max_equity_drawdown_adr),
    directional_worst_13_week_loss_adr: t100.worst_13_week_loss_adr,
    hedged_worst_13_week_loss_adr: hedged.worst_13_week_loss_adr,
    directional_mtm_weekly_win_rate: t100.mtm_weekly_win_rate,
    hedged_mtm_weekly_win_rate: hedged.mtm_weekly_win_rate,
    edge_read:
      t100.final_equity_adr > hedged.final_equity_adr && t100.max_equity_drawdown_adr >= hedged.max_equity_drawdown_adr
        ? "directional_candidate_beats_hedged_reference_on_equity_and_drawdown"
        : t100.final_equity_adr > hedged.final_equity_adr
          ? "directional_candidate_beats_hedged_reference_on_equity_only"
          : "hedged_reference_matches_or_beats_directional_candidate_gross_edge_warning",
  }];
}

function returnTargetGapRows(adapterRows: AdapterSummaryRow[]) {
  const t100 = adapterRows.find((row) => row.rule_id === GATE77_T100_L3_RULE_ID);
  if (!t100) return [];
  const leverageMultiple = t100.final_equity_adr === 0 ? null : round6(REQUIRED_TARGET_ADR_AT_SCALE / t100.final_equity_adr);
  return [{
    rule_id: t100.rule_id,
    target_return_percent_7y: TARGET_RETURN_SCALE_PERCENT,
    current_scale_percent_7y: CURRENT_T100_SCALE_PERCENT,
    target_max_drawdown_percent: TARGET_MAX_DRAWDOWN_PERCENT,
    required_adr_return_at_same_scale: REQUIRED_TARGET_ADR_AT_SCALE,
    current_final_equity_adr: t100.final_equity_adr,
    current_adr_return_gap: round6(REQUIRED_TARGET_ADR_AT_SCALE - t100.final_equity_adr),
    leverage_multiple_to_target_if_linear: leverageMultiple,
    current_max_drawdown_adr: t100.max_equity_drawdown_adr,
    linearly_scaled_drawdown_adr_to_target: leverageMultiple === null ? null : round6(t100.max_equity_drawdown_adr * leverageMultiple),
    leverage_read: leverageMultiple !== null && Math.abs(t100.max_equity_drawdown_adr * leverageMultiple) > Math.abs(t100.max_equity_drawdown_adr) * 5
      ? "leverage_alone_would_scale_tail_risk_materially"
      : "leverage_gap_not_assessed",
  }];
}

function decisionTableRows(adapterRows: AdapterSummaryRow[]) {
  return adapterRows.map((row) => {
    const closedIllusion = row.closed_weekly_win_rate - row.mtm_weekly_win_rate > 0.2 && row.final_open_unrealized_adr < -500;
    const openTail = row.final_open_unrealized_adr < -1500 || row.worst_week_end_open_unrealized_adr < -2500;
    const returnTooWeak = row.final_equity_adr < REQUIRED_TARGET_ADR_AT_SCALE * 0.5;
    const flipDefect = row.flip_loss_adr < -5000;
    const candidateWorthResearch =
      row.rule_id === GATE77_T100_L3_RULE_ID ||
      (row.rule_family === "flip_counterfactual" && row.final_equity_adr > 0 && row.max_equity_drawdown_adr > -3000);
    return {
      rule_id: row.rule_id,
      rule_family: row.rule_family,
      base_rule_id: row.base_rule_id,
      flip_policy: row.flip_policy,
      harvest_engine_promising: row.closed_total_adr > FOCUS_CLOSED_ADR * 0.75 && row.final_equity_adr > FOCUS_EQUITY_ADR * 0.75,
      flip_logic_is_main_defect: flipDefect,
      open_tail_defect_unresolved: openTail,
      audnzd_currency_tail_unacceptable: false,
      closed_pnl_illusion: closedIllusion,
      return_too_weak: returnTooWeak,
      candidate_worth_further_research: candidateWorthResearch,
      reject: row.final_equity_adr <= 0 || (returnTooWeak && openTail && !candidateWorthResearch),
    };
  });
}

function determineVerdict(adapterRows: AdapterSummaryRow[], counterfactualRows: Array<Record<string, unknown>>, hedgedRows: Array<Record<string, unknown>>) {
  const t100 = adapterRows.find((row) => row.rule_id === GATE77_T100_L3_RULE_ID);
  if (!t100) return "FAIL_LIMITED_REENTRY_FAMILY_TOO_WEAK_FOR_TARGET_NO_PROMOTION";
  const hedgedRead = String(hedgedRows[0]?.edge_read ?? "");
  if (hedgedRead.startsWith("hedged_reference")) return "FAIL_LIMITED_REENTRY_FAMILY_TOO_WEAK_FOR_TARGET_NO_PROMOTION";
  const t100Counterfactuals = counterfactualRows.filter((row) => row.base_rule_id === GATE77_T100_L3_RULE_ID);
  const improvesWithoutTransfer = t100Counterfactuals.some((row) => (
    Number(row.flip_loss_delta_vs_base_adr ?? 0) > 1000 &&
    Number(row.equity_delta_vs_base_adr ?? 0) > 0 &&
    Number(row.open_delta_vs_base_adr ?? 0) > -500
  ));
  if (improvesWithoutTransfer) return "PASS_FLIP_LOSS_IS_PRIMARY_FIXABLE_DEFECT_NO_PROMOTION";
  const transfersDamage = t100Counterfactuals.some((row) => (
    Number(row.flip_loss_delta_vs_base_adr ?? 0) > 1000 &&
    Number(row.open_delta_vs_base_adr ?? 0) < -1000
  ));
  if (transfersDamage) return "FAIL_COUNTERFACTUALS_TRANSFER_LOSS_TO_OPEN_INVENTORY_NO_PROMOTION";
  if (t100.final_open_unrealized_adr < -2000 || t100.worst_week_end_open_unrealized_adr < -2500) {
    return "PASS_OPEN_TAIL_REMAINS_PRIMARY_DEFECT_NO_PROMOTION";
  }
  return "PASS_HARVEST_ENGINE_PROMISING_BUT_RETURN_TARGET_GAP_REMAINS_NO_PROMOTION";
}

function answerRows(options: {
  adapterRows: AdapterSummaryRow[];
  flipRows: Array<Record<string, unknown>>;
  resetRows: Array<Record<string, unknown>>;
  ageRows: Array<Record<string, unknown>>;
  hedgedRows: Array<Record<string, unknown>>;
}) {
  const t100 = options.adapterRows.find((row) => row.rule_id === GATE77_T100_L3_RULE_ID);
  const t100Flip = options.flipRows.find((row) => row.rule_id === GATE77_T100_L3_RULE_ID);
  const resetWorst = options.resetRows
    .filter((row) => row.rule_id === GATE77_T100_L3_RULE_ID)
    .sort((left, right) => Number(left.flip_loss_adr ?? 0) + Number(left.final_open_loss_adr ?? 0) - (Number(right.flip_loss_adr ?? 0) + Number(right.final_open_loss_adr ?? 0)))[0];
  const ageWorst = options.ageRows
    .filter((row) => row.rule_id === GATE77_T100_L3_RULE_ID)
    .sort((left, right) => Number(left.open_loss_adr ?? 0) + Number(left.flip_loss_adr ?? 0) - (Number(right.open_loss_adr ?? 0) + Number(right.flip_loss_adr ?? 0)))[0];
  return [
    {
      question: "Are strong closed weekly wins being offset by unresolved adverse open inventory?",
      answer: t100 && t100.closed_weekly_win_rate - t100.mtm_weekly_win_rate > 0.2 && t100.final_open_unrealized_adr < 0 ? "yes" : "not_primary",
      evidence: t100 ? `closed_weekly=${t100.closed_weekly_win_rate} mtm_weekly=${t100.mtm_weekly_win_rate} final_open=${t100.final_open_unrealized_adr}` : "missing_t100",
    },
    {
      question: "Is Candidate B flip handling the main source of realized damage?",
      answer: t100Flip && Number(t100Flip.total_flip_loss_adr) < -5000 ? "material_realized_damage" : "not_material",
      evidence: t100Flip ? `flip_loss=${t100Flip.total_flip_loss_adr} flip_events=${t100Flip.flip_event_count}` : "missing_flip_row",
    },
    {
      question: "Is the third reset actually dangerous?",
      answer: resetWorst?.reset_ordinal_bucket === "terminal_after_reset_3" || resetWorst?.reset_ordinal_bucket === "reset_2" ? "third_reset_or_terminal_visible" : "not_obviously_third_reset",
      evidence: resetWorst ? `worst_bucket=${resetWorst.reset_ordinal_bucket}` : "missing_reset_row",
    },
    {
      question: "At what age does adverse inventory become toxic?",
      answer: ageWorst?.age_bucket ?? "unknown",
      evidence: ageWorst ? `open_loss=${ageWorst.open_loss_adr} flip_loss=${ageWorst.flip_loss_adr}` : "missing_age_row",
    },
    {
      question: "Does directional T100/L3 beat the fully hedged long-short weekly reference?",
      answer: options.hedgedRows[0]?.edge_read ?? "missing_hedged_reference",
      evidence: options.hedgedRows[0] ?? null,
    },
  ];
}

function renderReport(options: {
  summary: Record<string, unknown>;
  adapterRows: AdapterSummaryRow[];
  closeReasonRows: Array<Record<string, unknown>>;
  flipRows: Array<Record<string, unknown>>;
  resetOrdinalRows: Array<Record<string, unknown>>;
  ageRows: Array<Record<string, unknown>>;
  hedgedRows: Array<Record<string, unknown>>;
  answerRows: Array<Record<string, unknown>>;
  decisionRows: Array<Record<string, unknown>>;
}) {
  return [
    "# Gate 79 Flip-Loss and Adverse Inventory Root-Cause Audit",
    "",
    `Generated: \`${new Date().toISOString()}\``,
    "",
    "## Verdict",
    "",
    `\`${options.summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Forensic replay audit of required baselines, fixed flip-policy counterfactuals, and a fully hedged weekly long-short diagnostic reference.",
    "- Uses the Gate 74B trade-leg path warehouse; Candidate B directions remain read-only.",
    "- The fully hedged row is a gross reference only: both long and short on all 28 pairs each week using T100/S020/L3, week-bounded.",
    "- Does not run costs, risk/correlation pruning, pair/date exclusions, AUDNZD exclusion, source mutation, Brain mutation, MT5/live/app/runtime, freeze, or promotion.",
    "",
    "## MTM Scorecard",
    "",
    renderTable(tableRows(options.adapterRows), ["rule_id", "family", "flip_policy", "reference_only", "closed", "equity", "eq_pf", "closed_pf", "dd", "open", "worst_open", "worst1", "worst5", "worst13", "mtm_weekly_win_rate", "closed_weekly_win_rate", "mtm_monthly_win_rate", "flip_loss", "warehouse_recovery_rate", "fills", "adverse", "expansion"]),
    "",
    "## Direct Answers",
    "",
    renderTable(options.answerRows.map((row) => ({ ...row, evidence: reportCell(row.evidence) })), ["question", "answer", "evidence"]),
    "",
    "## Fully Hedged Diagnostic",
    "",
    renderTable(options.hedgedRows, ["diagnostic", "directional_final_equity_adr", "hedged_final_equity_adr", "equity_edge_vs_hedged_adr", "directional_max_drawdown_adr", "hedged_max_drawdown_adr", "edge_read"]),
    "",
    "## Close Reason Breakdown",
    "",
    renderTable(options.closeReasonRows.slice(0, 80), ["rule_id", "flip_policy", "close_reason_bucket", "event_count", "adr", "loss_adr", "median_event_adr", "worst_event_adr", "average_age_hours"]),
    "",
    "## Flip Anatomy",
    "",
    renderTable(options.flipRows, ["rule_id", "flip_policy", "flip_event_count", "total_flip_loss_adr", "average_flip_loss_adr", "worst_flip_loss_adr", "losing_inventory_flip_count", "mixed_inventory_flip_count", "median_reset_ordinal_at_flip", "median_inventory_age_hours_at_flip", "worst_pair", "worst_currency"]),
    "",
    "## Reset Ordinal and Age",
    "",
    renderTable(options.resetOrdinalRows.slice(0, 80), ["rule_id", "flip_policy", "reset_ordinal_bucket", "event_count", "closed_adr", "open_unrealized_adr", "win_rate", "worst_loss_adr", "flip_loss_adr", "final_open_loss_adr", "worst_pair"]),
    "",
    renderTable(options.ageRows.slice(0, 80), ["rule_id", "flip_policy", "age_bucket", "event_count", "open_loss_adr", "realized_loss_adr", "flip_loss_adr", "recovery_rate", "average_time_to_recovery_hours", "worst_pair", "worst_currency"]),
    "",
    "## Decision Table",
    "",
    renderTable(options.decisionRows, ["rule_id", "rule_family", "flip_policy", "harvest_engine_promising", "flip_logic_is_main_defect", "open_tail_defect_unresolved", "closed_pnl_illusion", "return_too_weak", "candidate_worth_further_research", "reject"]),
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(options.summary.validation, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    ...Object.entries(options.summary.artifacts as Record<string, string>).map(([label, value]) => `- ${label}: \`${value}\``),
    "",
    "## Stop Line",
    "",
    "Gate 79 is forensic evidence only. Do not promote, freeze, start costs, risk, pair pruning, AUDNZD exclusion, MT5/live, app/runtime, retuning, or source mutation unless Freedom explicitly opens the next scope.",
    "",
  ].join("\n");
}

async function readPairSeriesWithRetry(options: {
  manifestId: string;
  pair: string;
  weeks: string[];
  attempts: number;
}) {
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
      await closePoolIfInitialized();
      if (attempt < options.attempts) {
        await new Promise((resolve) => {
          setTimeout(resolve, 1000 * attempt);
        });
      }
    }
  }
  throw lastError;
}

async function main() {
  const options = parseOptions();
  await mkdir(options.artifactDir, { recursive: true });
  await mkdir(path.dirname(options.reportPath), { recursive: true });

  const gate74b = await readJson<Gate74bSummary>(path.join(options.gate74bDir, "gate74b-summary.json"));
  const gate74e = await readJson<Gate74eSummary>(path.join(options.gate74eDir, "gate74e-summary.json"));
  const gate75a = await readJson<Gate75aSummary>(path.join(options.gate75aDir, "gate75a-summary.json"));
  const gate76AdapterRows = await readJson<AdapterSummaryRow[]>(path.join(options.gate76Dir, "adapter-summary.rows.json"));
  const gate77AdapterRows = await readJson<AdapterSummaryRow[]>(path.join(options.gate77Dir, "adapter-summary.rows.json"));
  const manifestId = options.manifestId ?? gate74b.warehouse.manifest_id;
  const manifest = await readTradeLegPathWarehouseManifest(manifestId);
  if (!manifest) throw new Error(`Gate 78 requires completed Gate 74B warehouse manifest: ${manifestId}`);
  if (manifest.status !== "complete") throw new Error(`Gate 74B warehouse is not complete: ${manifestId} status=${manifest.status}`);

  const allWeeks = await readTradeLegPathWarehouseWeekKeys(manifestId);
  const selectedWeeks = options.maxWeeks ? allWeeks.slice(0, options.maxWeeks) : allWeeks;
  const rules = ruleSet();
  const pairRules = rules.filter((rule) => rule.scope === "pair");
  const statsByRule = new Map(rules.map((rule) => [rule.rule_id, createStats(rule)]));

  for (let pairIndex = 0; pairIndex < manifest.universe_symbols.length; pairIndex += 1) {
    const pair = manifest.universe_symbols[pairIndex]!;
    if (options.logProgress) console.log(`gate79 pair replay pair=${pairIndex + 1}/${manifest.universe_symbols.length} ${pair}`);
    const rows = await readPairSeriesWithRetry({ manifestId, pair, weeks: selectedWeeks, attempts: 3 });
    if (rows.length !== selectedWeeks.length) throw new Error(`Missing pair series rows for ${pair}: ${rows.length}/${selectedWeeks.length}`);
    replayPairRulesForPair(pair, rows, selectedWeeks, pairRules, statsByRule);
    replayFullyHedgedWeeklyForPair(pair, rows, selectedWeeks, pairRules, statsByRule);
  }

  const weeklyRows = rules.flatMap((rule) => weeklyRowsForRule(statsByRule.get(rule.rule_id)!, selectedWeeks));
  const weeklyForcedRows = weeklyRows.filter((row) => row.rule_id === "WEEKLY_FORCED_CLOSE");
  const top20Weeks = [...weeklyForcedRows]
    .sort((left, right) => right.equity_delta_adr - left.equity_delta_adr)
    .slice(0, 20)
    .map((row) => row.week_open_utc);
  const top20WeekSet = new Set(top20Weeks);
  const top20BaselineAdr = round6(weeklyForcedRows.filter((row) => top20WeekSet.has(row.week_open_utc)).reduce((sum, row) => sum + row.equity_delta_adr, 0));
  const adapterRows = withHashes(rules.map((rule) => summarizeRule(statsByRule.get(rule.rule_id)!, weeklyRows.filter((row) => row.rule_id === rule.rule_id), top20WeekSet, top20BaselineAdr)));
  const annual = withHashes(rules.flatMap((rule) => annualRows(weeklyRows.filter((row) => row.rule_id === rule.rule_id))));
  const closeReasonRows = withHashes(closeReasonBreakdownRows(statsByRule));
  const flipRows = withHashes(flipAnatomyRows(statsByRule));
  const resetOrdinalAuditRows = withHashes(resetOrdinalRows(statsByRule));
  const ageAuditRows = withHashes(ageBucketRows(statsByRule));
  const pairCurrency = pairCurrencyAttributionRows(statsByRule);
  const pairAttributionRows = withHashes(pairCurrency.pairRows);
  const currencyAttributionRows = withHashes(pairCurrency.currencyRows);
  const audnzdRows = withHashes(audnzdSentinelRows(pairAttributionRows, resetOrdinalAuditRows, ageAuditRows));
  const counterfactualRows = withHashes(counterfactualTableRows(adapterRows));
  const hedgedRows = withHashes(hedgedBenchmarkRows(adapterRows));
  const returnGapRows = withHashes(returnTargetGapRows(adapterRows));
  const decisionRows = withHashes(decisionTableRows(adapterRows));
  const directAnswerRows = withHashes(answerRows({ adapterRows, flipRows, resetRows: resetOrdinalAuditRows, ageRows: ageAuditRows, hedgedRows }));

  const bestByEquity = [...adapterRows].filter((row) => !row.reference_only).sort((left, right) => right.final_equity_adr - left.final_equity_adr)[0]!;
  const focus = adapterRows.find((row) => row.rule_id === FOCUS_RULE_ID)!;
  const gate76AdapterByRule = new Map(gate76AdapterRows.map((row) => [row.rule_id, row]));
  const gate77AdapterByRule = new Map(gate77AdapterRows.map((row) => [row.rule_id, row]));
  const adapterByRule = new Map(adapterRows.map((row) => [row.rule_id, row]));
  const gate76T150Reproduced = adapterRowsMatch(adapterByRule.get(GATE76_T150_RULE_ID), gate76AdapterByRule.get(GATE76_T150_RULE_ID));
  const gate77T075L3Reproduced = adapterRowsMatch(adapterByRule.get(GATE77_T075_L3_RULE_ID), gate77AdapterByRule.get(GATE77_T075_L3_RULE_ID));
  const gate77T100L3Reproduced = adapterRowsMatch(adapterByRule.get(GATE77_T100_L3_RULE_ID), gate77AdapterByRule.get(GATE77_T100_L3_RULE_ID));
  const gate77T125L3Reproduced = adapterRowsMatch(adapterByRule.get(GATE77_T125_L3_RULE_ID), gate77AdapterByRule.get(GATE77_T125_L3_RULE_ID));
  const verdict = determineVerdict(adapterRows, counterfactualRows, hedgedRows);
  const validation = {
    gate74b_passed: gate74b.verdict.startsWith("PASS_"),
    gate74e_passed: gate74e.verdict.startsWith("PASS_"),
    gate75a_passed_and_closed: gate75a.verdict.startsWith("PASS_"),
    gate75a_matrix_not_executed_by_this_gate: gate75a.validation.gate75b_matrix_execution_started === false,
    manifest_complete: manifest.status === "complete",
    warehouse_hash_matches_gate74b_summary: manifest.warehouse_hash === gate74b.warehouse.warehouse_hash,
    candidate_b_forced28_preserved: gate74b.validation.candidate_b_forced28_preserved,
    candidate_b_directions_mutated: false,
    pairs_replayed: manifest.universe_symbols.length,
    audnzd_excluded: !manifest.universe_symbols.includes("AUDNZD"),
    weeks_replayed: selectedWeeks.length,
    expected_weeks_replayed: options.maxWeeks ?? gate74b.warehouse.week_count,
    pair_week_rows_replayed: selectedWeeks.length * manifest.universe_symbols.length,
    fixed_rule_count: rules.length,
    expected_fixed_rule_count: 33,
    required_baseline_rows_present:
      adapterByRule.has(FOCUS_RULE_ID) &&
      adapterByRule.has(GATE76_T150_RULE_ID) &&
      adapterByRule.has(GATE79_T075_L2_RULE_ID) &&
      adapterByRule.has(GATE77_T075_L3_RULE_ID) &&
      adapterByRule.has(GATE77_T100_L3_RULE_ID) &&
      adapterByRule.has(GATE77_T125_L3_RULE_ID),
    t150_no_limit_reference_included: adapterByRule.has(GATE76_T150_RULE_ID),
    flip_counterfactual_row_count: adapterRows.filter((row) => row.rule_family === "flip_counterfactual").length,
    expected_flip_counterfactual_row_count: 24,
    fully_hedged_reference_included: adapterByRule.has(GATE79_FULLY_HEDGED_RULE_ID),
    fully_hedged_reference_is_reference_only: adapterByRule.get(GATE79_FULLY_HEDGED_RULE_ID)?.reference_only === true,
    account_reset_target_count: 0,
    account_level_emergency_sl_replay_started: false,
    pair_series_only_account_reset_claim_started: false,
    unbounded_parameter_search_started: false,
    costs_applied: false,
    spread_slippage_swap_commission_applied: false,
    risk_layer_started: false,
    correlation_pruning_started: false,
    pair_pruning_started: false,
    fair_value_pruning_started: false,
    exit_promotion_started: false,
    mt5_live_runtime_started: false,
    app_runtime_started: false,
    brain_truth_mutated: false,
    source_mutation_started: false,
    candidate_c_promotion_started: false,
    candidate_d_retest_started: false,
    candidate_e_started: false,
    alpha_v2_started: false,
    focus_closed_matches_gate74e: Math.abs(focus.closed_total_adr - FOCUS_CLOSED_ADR) <= 0.000001,
    focus_equity_matches_gate74e: Math.abs(focus.final_equity_adr - FOCUS_EQUITY_ADR) <= 0.000001,
    focus_open_matches_gate74e: Math.abs(focus.final_open_unrealized_adr - FOCUS_FINAL_OPEN_ADR) <= 0.000001,
    focus_drawdown_matches_gate74e: Math.abs(focus.max_equity_drawdown_adr - FOCUS_MAX_DRAWDOWN_ADR) <= 0.000001,
    focus_flip_loss_matches_gate74e: Math.abs(focus.flip_loss_adr - FOCUS_FLIP_LOSS_ADR) <= 0.000001,
    gate76_best_no_limit_t150_reproduced: gate76T150Reproduced,
    gate77_t075_l3_reproduced: gate77T075L3Reproduced,
    gate77_t100_l3_reproduced: gate77T100L3Reproduced,
    gate77_t125_l3_reproduced: gate77T125L3Reproduced,
    gate77_limited_reentry_rows_reproduced_before_comparison: gate77T075L3Reproduced && gate77T100L3Reproduced && gate77T125L3Reproduced,
    gate76_and_gate77_key_rows_reproduced_before_comparison: gate76T150Reproduced && gate77T075L3Reproduced && gate77T100L3Reproduced && gate77T125L3Reproduced,
    fill_level_trailing_started: false,
    closed_and_equity_reported_side_by_side: adapterRows.every((row) => Number.isFinite(row.closed_total_adr) && Number.isFinite(row.final_equity_adr)),
    csv_scorecards_written: true,
    close_reason_breakdown_written: closeReasonRows.length > 0,
    reset_ordinal_breakdown_written: resetOrdinalAuditRows.length > 0,
    age_bucket_breakdown_written: ageAuditRows.length > 0,
    audnzd_sentinel_written: audnzdRows.length > 0,
    hedged_edge_diagnostic_written: hedgedRows.length === 1,
  };
  const passed =
    validation.gate74b_passed &&
    validation.gate74e_passed &&
    validation.gate75a_passed_and_closed &&
    validation.gate75a_matrix_not_executed_by_this_gate &&
    validation.manifest_complete &&
    validation.warehouse_hash_matches_gate74b_summary &&
    validation.candidate_b_forced28_preserved &&
    !validation.candidate_b_directions_mutated &&
    validation.pairs_replayed === 28 &&
    !validation.audnzd_excluded &&
    validation.weeks_replayed === validation.expected_weeks_replayed &&
    validation.pair_week_rows_replayed === gate74b.warehouse.pair_week_count &&
    validation.fixed_rule_count === validation.expected_fixed_rule_count &&
    validation.required_baseline_rows_present &&
    validation.flip_counterfactual_row_count === validation.expected_flip_counterfactual_row_count &&
    validation.fully_hedged_reference_included &&
    validation.fully_hedged_reference_is_reference_only &&
    !validation.account_level_emergency_sl_replay_started &&
    !validation.pair_series_only_account_reset_claim_started &&
    !validation.unbounded_parameter_search_started &&
    !validation.costs_applied &&
    !validation.spread_slippage_swap_commission_applied &&
    !validation.risk_layer_started &&
    !validation.correlation_pruning_started &&
    !validation.pair_pruning_started &&
    !validation.fair_value_pruning_started &&
    !validation.exit_promotion_started &&
    !validation.mt5_live_runtime_started &&
    !validation.app_runtime_started &&
    !validation.brain_truth_mutated &&
    !validation.source_mutation_started &&
    !validation.candidate_c_promotion_started &&
    !validation.candidate_d_retest_started &&
    !validation.candidate_e_started &&
    !validation.alpha_v2_started &&
    validation.focus_closed_matches_gate74e &&
    validation.focus_equity_matches_gate74e &&
    validation.focus_open_matches_gate74e &&
    validation.focus_drawdown_matches_gate74e &&
    validation.focus_flip_loss_matches_gate74e &&
    validation.gate76_and_gate77_key_rows_reproduced_before_comparison &&
    !validation.fill_level_trailing_started &&
    validation.closed_and_equity_reported_side_by_side &&
    validation.csv_scorecards_written &&
    validation.close_reason_breakdown_written &&
    validation.reset_ordinal_breakdown_written &&
    validation.age_bucket_breakdown_written &&
    validation.audnzd_sentinel_written &&
    validation.hedged_edge_diagnostic_written;
  const finalVerdict = passed ? verdict : "FAIL_LIMITED_REENTRY_FAMILY_TOO_WEAK_FOR_TARGET_NO_PROMOTION";

  const artifacts = {
    scorecardRowsJson: toRepoRelative(path.join(options.artifactDir, "gate79-scorecard.rows.json")),
    scorecardRowsCsv: toRepoRelative(path.join(options.artifactDir, "gate79-scorecard.rows.csv")),
    weeklyEquityRowsJson: toRepoRelative(path.join(options.artifactDir, "weekly-equity-truth.rows.json")),
    weeklyEquityRowsCsv: toRepoRelative(path.join(options.artifactDir, "weekly-equity-truth.rows.csv")),
    annualRowsJson: toRepoRelative(path.join(options.artifactDir, "annual-summary.rows.json")),
    annualRowsCsv: toRepoRelative(path.join(options.artifactDir, "annual-summary.rows.csv")),
    closeReasonRowsJson: toRepoRelative(path.join(options.artifactDir, "close-reason-breakdown.rows.json")),
    closeReasonRowsCsv: toRepoRelative(path.join(options.artifactDir, "close-reason-breakdown.rows.csv")),
    flipAnatomyRowsJson: toRepoRelative(path.join(options.artifactDir, "flip-loss-anatomy.rows.json")),
    flipAnatomyRowsCsv: toRepoRelative(path.join(options.artifactDir, "flip-loss-anatomy.rows.csv")),
    resetOrdinalRowsJson: toRepoRelative(path.join(options.artifactDir, "reset-ordinal-breakdown.rows.json")),
    resetOrdinalRowsCsv: toRepoRelative(path.join(options.artifactDir, "reset-ordinal-breakdown.rows.csv")),
    ageBucketRowsJson: toRepoRelative(path.join(options.artifactDir, "age-bucket-breakdown.rows.json")),
    ageBucketRowsCsv: toRepoRelative(path.join(options.artifactDir, "age-bucket-breakdown.rows.csv")),
    pairAttributionRowsJson: toRepoRelative(path.join(options.artifactDir, "pair-tail-attribution.rows.json")),
    pairAttributionRowsCsv: toRepoRelative(path.join(options.artifactDir, "pair-tail-attribution.rows.csv")),
    currencyAttributionRowsJson: toRepoRelative(path.join(options.artifactDir, "currency-tail-attribution.rows.json")),
    currencyAttributionRowsCsv: toRepoRelative(path.join(options.artifactDir, "currency-tail-attribution.rows.csv")),
    audnzdSentinelRowsJson: toRepoRelative(path.join(options.artifactDir, "audnzd-sentinel.rows.json")),
    audnzdSentinelRowsCsv: toRepoRelative(path.join(options.artifactDir, "audnzd-sentinel.rows.csv")),
    counterfactualRowsJson: toRepoRelative(path.join(options.artifactDir, "flip-policy-counterfactual.rows.json")),
    counterfactualRowsCsv: toRepoRelative(path.join(options.artifactDir, "flip-policy-counterfactual.rows.csv")),
    fullyHedgedBenchmarkRowsJson: toRepoRelative(path.join(options.artifactDir, "fully-hedged-benchmark.rows.json")),
    fullyHedgedBenchmarkRowsCsv: toRepoRelative(path.join(options.artifactDir, "fully-hedged-benchmark.rows.csv")),
    returnTargetGapRowsJson: toRepoRelative(path.join(options.artifactDir, "return-target-gap.rows.json")),
    returnTargetGapRowsCsv: toRepoRelative(path.join(options.artifactDir, "return-target-gap.rows.csv")),
    decisionRowsJson: toRepoRelative(path.join(options.artifactDir, "final-decision-table.rows.json")),
    decisionRowsCsv: toRepoRelative(path.join(options.artifactDir, "final-decision-table.rows.csv")),
    directAnswerRowsJson: toRepoRelative(path.join(options.artifactDir, "direct-answers.rows.json")),
    directAnswerRowsCsv: toRepoRelative(path.join(options.artifactDir, "direct-answers.rows.csv")),
    commandReceipt: toRepoRelative(path.join(options.artifactDir, "command-receipt.json")),
    summaryJson: toRepoRelative(path.join(options.artifactDir, "gate79-summary.json")),
    shaIdentity: toRepoRelative(path.join(options.artifactDir, "gate79-sha256.txt")),
    report: toRepoRelative(options.reportPath),
  };

  const commandReceipt = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    mode: "implementation_research_flip_loss_adverse_inventory_audit_no_promotion",
    audit_contract: {
      spacing_adr: SPACING_ADR,
      default_pair_reset_limit_per_week: DEFAULT_PAIR_RESET_LIMIT,
      flip_warehouse_recovery_adr: FLIP_WAREHOUSE_RECOVERY_ADR,
      flip_warehouse_expiry_hours: FLIP_WAREHOUSE_EXPIRY_HOURS,
      flip_warehouse_hard_loss_adr: FLIP_WAREHOUSE_HARD_LOSS_ADR,
      flip_grace_hours: FLIP_GRACE_HOURS,
      flip_small_loss_threshold_adr: FLIP_SMALL_LOSS_THRESHOLD_ADR,
      fully_hedged_reference_rule_id: GATE79_FULLY_HEDGED_RULE_ID,
      unbounded_parameter_search_started: false,
    },
  };

  const summary = {
    gate_id: GATE_ID,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    command: COMMAND,
    verdict: finalVerdict,
    purpose: "determine whether flip-loss logic and unresolved adverse inventory are damaging a real limited two-sided grid harvest engine, with a fully hedged long-short diagnostic benchmark",
    warehouse: {
      manifest_id: manifest.manifest_id,
      warehouse_hash: manifest.warehouse_hash,
      weeks_replayed: selectedWeeks.length,
      pairs_replayed: manifest.universe_symbols.length,
      pair_week_rows_replayed: selectedWeeks.length * manifest.universe_symbols.length,
      gate74b_summary_hash_matched: manifest.warehouse_hash === gate74b.warehouse.warehouse_hash,
    },
    baseline_binding: {
      gate74e_focus_rule_id: FOCUS_RULE_ID,
      gate74e_focus_closed_adr: FOCUS_CLOSED_ADR,
      gate74e_focus_final_equity_adr: FOCUS_EQUITY_ADR,
      gate74e_focus_final_open_unrealized_adr: FOCUS_FINAL_OPEN_ADR,
      gate74e_focus_max_drawdown_adr: FOCUS_MAX_DRAWDOWN_ADR,
      gate75a_closed_as_prior_packet: true,
      gate76_best_no_limit_t150_reproduced: validation.gate76_best_no_limit_t150_reproduced,
      gate77_limited_reentry_rows_reproduced_before_comparison: validation.gate77_limited_reentry_rows_reproduced_before_comparison,
    },
    matrix_scope: {
      controls: rules.filter((rule) => rule.rule_family === "control").length,
      adverse_only_focus_baseline: 1,
      gate76_t150_no_limit_reference: 1,
      gate79_t075_l2_baseline: 1,
      gate77_limited_reentry_baselines: [GATE77_T075_L3_RULE_ID, GATE77_T100_L3_RULE_ID, GATE77_T125_L3_RULE_ID],
      fixed_flip_counterfactual_rows: validation.flip_counterfactual_row_count,
      fully_hedged_reference_row: GATE79_FULLY_HEDGED_RULE_ID,
      fixed_rule_count: rules.length,
    },
    best_adapter_by_final_equity: bestByEquity,
    adverse_focus_baseline: focus,
    gate76_best_no_limit_t150: adapterByRule.get(GATE76_T150_RULE_ID) ?? null,
    gate79_t075_l2: adapterByRule.get(GATE79_T075_L2_RULE_ID) ?? null,
    gate77_t075_l3: adapterByRule.get(GATE77_T075_L3_RULE_ID) ?? null,
    gate77_t100_l3: adapterByRule.get(GATE77_T100_L3_RULE_ID) ?? null,
    gate77_t125_l3: adapterByRule.get(GATE77_T125_L3_RULE_ID) ?? null,
    fully_hedged_reference: adapterByRule.get(GATE79_FULLY_HEDGED_RULE_ID) ?? null,
    direct_answers: directAnswerRows,
    hedged_benchmark: hedgedRows,
    return_target_gap: returnGapRows,
    final_decision_table: decisionRows,
    validation,
    artifacts,
  };

  await writeRows(path.join(options.artifactDir, "gate79-scorecard.rows.json"), path.join(options.artifactDir, "gate79-scorecard.rows.csv"), adapterRows);
  await writeRows(path.join(options.artifactDir, "weekly-equity-truth.rows.json"), path.join(options.artifactDir, "weekly-equity-truth.rows.csv"), withHashes(weeklyRows));
  await writeRows(path.join(options.artifactDir, "annual-summary.rows.json"), path.join(options.artifactDir, "annual-summary.rows.csv"), annual);
  await writeRows(path.join(options.artifactDir, "close-reason-breakdown.rows.json"), path.join(options.artifactDir, "close-reason-breakdown.rows.csv"), closeReasonRows);
  await writeRows(path.join(options.artifactDir, "flip-loss-anatomy.rows.json"), path.join(options.artifactDir, "flip-loss-anatomy.rows.csv"), flipRows);
  await writeRows(path.join(options.artifactDir, "reset-ordinal-breakdown.rows.json"), path.join(options.artifactDir, "reset-ordinal-breakdown.rows.csv"), resetOrdinalAuditRows);
  await writeRows(path.join(options.artifactDir, "age-bucket-breakdown.rows.json"), path.join(options.artifactDir, "age-bucket-breakdown.rows.csv"), ageAuditRows);
  await writeRows(path.join(options.artifactDir, "pair-tail-attribution.rows.json"), path.join(options.artifactDir, "pair-tail-attribution.rows.csv"), pairAttributionRows);
  await writeRows(path.join(options.artifactDir, "currency-tail-attribution.rows.json"), path.join(options.artifactDir, "currency-tail-attribution.rows.csv"), currencyAttributionRows);
  await writeRows(path.join(options.artifactDir, "audnzd-sentinel.rows.json"), path.join(options.artifactDir, "audnzd-sentinel.rows.csv"), audnzdRows);
  await writeRows(path.join(options.artifactDir, "flip-policy-counterfactual.rows.json"), path.join(options.artifactDir, "flip-policy-counterfactual.rows.csv"), counterfactualRows);
  await writeRows(path.join(options.artifactDir, "fully-hedged-benchmark.rows.json"), path.join(options.artifactDir, "fully-hedged-benchmark.rows.csv"), hedgedRows);
  await writeRows(path.join(options.artifactDir, "return-target-gap.rows.json"), path.join(options.artifactDir, "return-target-gap.rows.csv"), returnGapRows);
  await writeRows(path.join(options.artifactDir, "final-decision-table.rows.json"), path.join(options.artifactDir, "final-decision-table.rows.csv"), decisionRows);
  await writeRows(path.join(options.artifactDir, "direct-answers.rows.json"), path.join(options.artifactDir, "direct-answers.rows.csv"), directAnswerRows);
  await writeJson(path.join(options.artifactDir, "command-receipt.json"), commandReceipt);
  await writeJson(path.join(options.artifactDir, "gate79-summary.json"), summary);
  await writeText(options.reportPath, renderReport({
    summary,
    adapterRows,
    closeReasonRows,
    flipRows,
    resetOrdinalRows: resetOrdinalAuditRows,
    ageRows: ageAuditRows,
    hedgedRows,
    answerRows: directAnswerRows,
    decisionRows,
  }));
  await writeShaManifest(path.join(options.artifactDir, "gate79-sha256.txt"), GATE_ID, COMMAND, [
    { label: "scorecard_rows_json", path: path.join(options.artifactDir, "gate79-scorecard.rows.json") },
    { label: "scorecard_rows_csv", path: path.join(options.artifactDir, "gate79-scorecard.rows.csv") },
    { label: "weekly_equity_rows_json", path: path.join(options.artifactDir, "weekly-equity-truth.rows.json") },
    { label: "weekly_equity_rows_csv", path: path.join(options.artifactDir, "weekly-equity-truth.rows.csv") },
    { label: "annual_rows_json", path: path.join(options.artifactDir, "annual-summary.rows.json") },
    { label: "annual_rows_csv", path: path.join(options.artifactDir, "annual-summary.rows.csv") },
    { label: "close_reason_rows_json", path: path.join(options.artifactDir, "close-reason-breakdown.rows.json") },
    { label: "close_reason_rows_csv", path: path.join(options.artifactDir, "close-reason-breakdown.rows.csv") },
    { label: "flip_anatomy_rows_json", path: path.join(options.artifactDir, "flip-loss-anatomy.rows.json") },
    { label: "flip_anatomy_rows_csv", path: path.join(options.artifactDir, "flip-loss-anatomy.rows.csv") },
    { label: "reset_ordinal_rows_json", path: path.join(options.artifactDir, "reset-ordinal-breakdown.rows.json") },
    { label: "reset_ordinal_rows_csv", path: path.join(options.artifactDir, "reset-ordinal-breakdown.rows.csv") },
    { label: "age_bucket_rows_json", path: path.join(options.artifactDir, "age-bucket-breakdown.rows.json") },
    { label: "age_bucket_rows_csv", path: path.join(options.artifactDir, "age-bucket-breakdown.rows.csv") },
    { label: "pair_attribution_rows_json", path: path.join(options.artifactDir, "pair-tail-attribution.rows.json") },
    { label: "pair_attribution_rows_csv", path: path.join(options.artifactDir, "pair-tail-attribution.rows.csv") },
    { label: "currency_attribution_rows_json", path: path.join(options.artifactDir, "currency-tail-attribution.rows.json") },
    { label: "currency_attribution_rows_csv", path: path.join(options.artifactDir, "currency-tail-attribution.rows.csv") },
    { label: "audnzd_sentinel_rows_json", path: path.join(options.artifactDir, "audnzd-sentinel.rows.json") },
    { label: "audnzd_sentinel_rows_csv", path: path.join(options.artifactDir, "audnzd-sentinel.rows.csv") },
    { label: "counterfactual_rows_json", path: path.join(options.artifactDir, "flip-policy-counterfactual.rows.json") },
    { label: "counterfactual_rows_csv", path: path.join(options.artifactDir, "flip-policy-counterfactual.rows.csv") },
    { label: "fully_hedged_benchmark_rows_json", path: path.join(options.artifactDir, "fully-hedged-benchmark.rows.json") },
    { label: "fully_hedged_benchmark_rows_csv", path: path.join(options.artifactDir, "fully-hedged-benchmark.rows.csv") },
    { label: "return_target_gap_rows_json", path: path.join(options.artifactDir, "return-target-gap.rows.json") },
    { label: "return_target_gap_rows_csv", path: path.join(options.artifactDir, "return-target-gap.rows.csv") },
    { label: "decision_rows_json", path: path.join(options.artifactDir, "final-decision-table.rows.json") },
    { label: "decision_rows_csv", path: path.join(options.artifactDir, "final-decision-table.rows.csv") },
    { label: "direct_answer_rows_json", path: path.join(options.artifactDir, "direct-answers.rows.json") },
    { label: "direct_answer_rows_csv", path: path.join(options.artifactDir, "direct-answers.rows.csv") },
    { label: "command_receipt", path: path.join(options.artifactDir, "command-receipt.json") },
    { label: "summary_json", path: path.join(options.artifactDir, "gate79-summary.json") },
    { label: "report", path: options.reportPath },
  ]);

  console.log(finalVerdict);
  console.log(JSON.stringify({
    validation,
    best_adapter_by_final_equity: bestByEquity,
    gate77_t100_l3: summary.gate77_t100_l3,
    hedged_benchmark: hedgedRows,
    direct_answers: directAnswerRows,
    artifacts,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePoolIfInitialized();
  });
