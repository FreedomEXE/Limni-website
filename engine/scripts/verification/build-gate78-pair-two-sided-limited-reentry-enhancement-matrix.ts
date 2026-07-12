import { mkdir } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import { closePoolIfInitialized, query } from "@database/db/client";
import { sha256Stable } from "@engine/research/hash";
import {
  readTradeLegPathWarehouseManifest,
  readTradeLegPathWarehousePairSeries,
  readTradeLegPathWarehouseWeekKeys,
  type TradeLegPathColumnarPayload,
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

const GATE_ID = "Gate 78: pair-two-sided-limited-reentry-enhancement-matrix";
const GATE_DATE = "2026-06-29";
const COMMAND = "npm run engine:gate78:pair-two-sided-limited-reentry-enhancement-matrix";
const DEFAULT_GATE74B_DIR = "docs/research/gates/gate74b/artifacts/gate74b-trade-leg-path-materialization";
const DEFAULT_GATE74E_DIR = "docs/research/gates/gate74e/artifacts/gate74e-pair-net-grid-tail-containment-adapter-pack";
const DEFAULT_GATE75A_DIR = "docs/research/gates/gate75a/artifacts/gate75a-broad-exit-family-taxonomy-protocol-freeze";
const DEFAULT_GATE76_DIR = "docs/research/gates/gate76/artifacts/gate76-pair-directional-two-sided-grid-reset-limit-lifecycle-discovery";
const DEFAULT_GATE77_DIR = "docs/research/gates/gate77/artifacts/gate77-pair-two-sided-reset-limit-confirmation-failure-anatomy";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate78/artifacts/gate78-pair-two-sided-limited-reentry-enhancement-matrix";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate78/GATE78_PAIR_TWO_SIDED_LIMITED_REENTRY_ENHANCEMENT_MATRIX_${GATE_DATE}.md`;

const FOCUS_RULE_ID = "PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP";
const FOCUS_CLOSED_ADR = 14381.312614;
const FOCUS_EQUITY_ADR = 9901.156008;
const FOCUS_FINAL_OPEN_ADR = -4480.156606;
const FOCUS_MAX_DRAWDOWN_ADR = -5462.545131;
const FOCUS_FLIP_LOSS_ADR = -10815.950986;
const GATE76_T150_RULE_ID = "PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP";
const GATE77_T075_L3_RULE_ID = "PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK";
const GATE77_T100_L3_RULE_ID = "PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK";
const GATE77_T125_L3_RULE_ID = "PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK";
const SPACING_ADR = 0.2;
const PAIR_RESET_LIMIT = 3;
const LIMITED_REENTRY_TARGETS = [0.75, 1, 1.25] as const;
const FINAL_RESET_RUNNER_FRACTIONS = [0.25, 0.5] as const;
const ACCOUNT_EMERGENCY_SL_BANDS = [-3, -5] as const;

type Side = "LONG" | "SHORT";
type RuleFamily =
  | "control"
  | "adverse_only_pair_net_grid"
  | "pair_directional_two_sided_grid"
  | "pair_reset_limit"
  | "pair_final_reset_runner"
  | "account_emergency_sl_reference";
type RuleScope = "pair" | "account";
type RuleKind = "weekly_forced_close" | "carry_until_flip" | "grid";
type CloseReason = "weekly_forced_close" | "target" | "flip" | "sample_end" | "account_reset" | "account_emergency_sl";
type FillKind = "initial" | "adverse_recovery" | "favorable_expansion";
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

type AccountWeekDbRow = {
  week_open_utc: Date | string;
  pair: string;
  candidate_b_side: Side;
  candidate_row_key: string;
  decision_hash: string;
  direction_streak_id: string;
  entry_timestamp_utc: Date | string;
  friday_cutoff_timestamp_utc: Date | string;
  pair_adr_pct: string | number;
  entry_price: string | number | null;
  mfe_adr: string | number;
  mae_adr: string | number;
  friday_close_adr: string | number;
  path_payload_compressed: Buffer;
};

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
  runner_only: boolean;
  runner_fraction: number | null;
};

type PairMark = {
  row: ReplayRow;
  mark_price: number;
  timestamp_utc: string;
};

type CloseEvent = {
  rule_id: string;
  rule_family: RuleFamily;
  scope: RuleScope;
  pair: string;
  week_open_utc: string;
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
  reference_only: boolean;
  closed_total_adr: number;
  final_equity_adr: number;
  equity_profit_factor: number | null;
  max_equity_drawdown_adr: number;
  final_open_unrealized_adr: number;
  closed_adr_retention_vs_gate74e_focus: number | null;
  final_equity_retention_vs_gate74e_focus: number | null;
  top20_winner_retention_vs_weekly_forced: number | null;
  worst_week_loss_adr: number;
  worst_5_week_loss_adr: number;
  worst_13_week_loss_adr: number;
  negative_years: number;
  profitable_week_rate: number;
  closed_cycles: number;
  target_reset_cycles: number;
  account_reset_events: number;
  account_emergency_sl_events: number;
  flip_loss_adr: number;
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
  close_events: CloseEvent[];
  account_reset_events: number;
  generated_account_replay: boolean;
  runner_final_open_by_pair: Map<string, number>;
  account_emergency_sl_by_week: Map<string, number>;
  account_emergency_sl_events: number;
};

type AccountRuleState = {
  rule: ReplayRule;
  current_by_pair: Map<string, Cycle>;
  last_mark_by_pair: Map<string, PairMark>;
  reset_count_week: number;
  pair_reset_count_week: Map<string, number>;
  pair_stopped_this_week: Set<string>;
  stopped_this_week: boolean;
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

function formatAdr(value: number) {
  return String(value).replace(".", "").padEnd(3, "0");
}

function ruleSet(): ReplayRule[] {
  const controls: ReplayRule[] = [
    {
      rule_id: "WEEKLY_FORCED_CLOSE",
      rule_family: "control",
      scope: "pair",
      kind: "weekly_forced_close",
      target_adr: null,
      spacing_adr: null,
      two_sided_grid: false,
      pair_reset_limit_per_week: null,
      account_reset_limit_per_week: null,
      runner_fraction: null,
      account_emergency_sl_adr: null,
      base_rule_id: null,
      reference_only: false,
      review_role: "weekly_forced_close_control",
    },
    {
      rule_id: "CARRY_UNTIL_FLIP",
      rule_family: "control",
      scope: "pair",
      kind: "carry_until_flip",
      target_adr: null,
      spacing_adr: null,
      two_sided_grid: false,
      pair_reset_limit_per_week: null,
      account_reset_limit_per_week: null,
      runner_fraction: null,
      account_emergency_sl_adr: null,
      base_rule_id: null,
      reference_only: false,
      review_role: "carry_unresolved_until_candidate_b_flip_control",
    },
    {
      rule_id: FOCUS_RULE_ID,
      rule_family: "adverse_only_pair_net_grid",
      scope: "pair",
      kind: "grid",
      target_adr: 0.75,
      spacing_adr: SPACING_ADR,
      two_sided_grid: false,
      pair_reset_limit_per_week: null,
      account_reset_limit_per_week: null,
      runner_fraction: null,
      account_emergency_sl_adr: null,
      base_rule_id: null,
      reference_only: false,
      review_role: "gate74e_adverse_only_focus_baseline",
    },
  ];

  const gate76NoLimit = {
    rule_id: GATE76_T150_RULE_ID,
    rule_family: "pair_directional_two_sided_grid" as const,
    scope: "pair" as const,
    kind: "grid" as const,
    target_adr: 1.5,
    spacing_adr: SPACING_ADR,
    two_sided_grid: true,
    pair_reset_limit_per_week: null,
    account_reset_limit_per_week: null,
    runner_fraction: null,
    account_emergency_sl_adr: null,
    base_rule_id: null,
    reference_only: false,
    review_role: "gate76_best_unrestricted_two_sided_reference",
  };

  const limitedReentryBaselines = LIMITED_REENTRY_TARGETS.map((target) => ({
    rule_id: `PAIR_TWO_SIDED_GRID_T${formatAdr(target)}_S020_STOP_AFTER_${PAIR_RESET_LIMIT}_PAIR_RESETS_WEEK`,
    rule_family: "pair_reset_limit" as const,
    scope: "pair" as const,
    kind: "grid" as const,
    target_adr: target,
    spacing_adr: SPACING_ADR,
    two_sided_grid: true,
    pair_reset_limit_per_week: PAIR_RESET_LIMIT,
    account_reset_limit_per_week: null,
    runner_fraction: null,
    account_emergency_sl_adr: null,
    base_rule_id: null,
    reference_only: false,
    review_role: "gate77_confirmed_limited_reentry_baseline",
  }));

  const runnerRows = LIMITED_REENTRY_TARGETS.flatMap((target) => (
    FINAL_RESET_RUNNER_FRACTIONS.map((runnerFraction) => ({
      rule_id: `PAIR_TWO_SIDED_GRID_T${formatAdr(target)}_S020_L3_FINAL_RESET_RUNNER_${formatAdr(runnerFraction)}`,
      rule_family: "pair_final_reset_runner" as const,
      scope: "pair" as const,
      kind: "grid" as const,
      target_adr: target,
      spacing_adr: SPACING_ADR,
      two_sided_grid: true,
      pair_reset_limit_per_week: PAIR_RESET_LIMIT,
      account_reset_limit_per_week: null,
      runner_fraction: runnerFraction,
      account_emergency_sl_adr: null,
      base_rule_id: `PAIR_TWO_SIDED_GRID_T${formatAdr(target)}_S020_STOP_AFTER_${PAIR_RESET_LIMIT}_PAIR_RESETS_WEEK`,
      reference_only: false,
      review_role: "final_reset_runner_preservation_fixed_row",
    }))
  ));

  return [...controls, gate76NoLimit, ...limitedReentryBaselines, ...runnerRows];
}

function accountEmergencyRules(baseRunnerRule: ReplayRule): ReplayRule[] {
  const baseT100 = {
    rule_id: GATE77_T100_L3_RULE_ID,
    rule_family: "account_emergency_sl_reference" as const,
    scope: "account" as const,
    kind: "grid" as const,
    target_adr: 1,
    spacing_adr: SPACING_ADR,
    two_sided_grid: true,
    pair_reset_limit_per_week: PAIR_RESET_LIMIT,
    account_reset_limit_per_week: null,
    runner_fraction: null,
    base_rule_id: GATE77_T100_L3_RULE_ID,
    reference_only: true,
    review_role: "account_emergency_sl_reference_on_t100_l3_base",
  };
  const bestRunner = {
    rule_id: baseRunnerRule.rule_id,
    rule_family: "account_emergency_sl_reference" as const,
    scope: "account" as const,
    kind: "grid" as const,
    target_adr: baseRunnerRule.target_adr,
    spacing_adr: SPACING_ADR,
    two_sided_grid: true,
    pair_reset_limit_per_week: PAIR_RESET_LIMIT,
    account_reset_limit_per_week: null,
    runner_fraction: baseRunnerRule.runner_fraction,
    base_rule_id: baseRunnerRule.rule_id,
    reference_only: true,
    review_role: "account_emergency_sl_reference_on_best_runner_row",
  };
  return [baseT100, bestRunner].flatMap((template) => (
    ACCOUNT_EMERGENCY_SL_BANDS.map((band) => ({
      ...template,
      rule_id: `${template.rule_id}_ACCOUNT_EMERGENCY_SL_${String(Math.abs(band)).replace(".", "")}ADR`,
      account_emergency_sl_adr: band,
    }))
  ));
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
}) {
  return {
    cycle_id: `${options.rule.rule_id}|${options.pair}|${options.serial}`,
    rule_id: options.rule.rule_id,
    pair: options.pair,
    side: options.row.candidate_b_side,
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
    runner_only: false,
    runner_fraction: null,
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

function closeCycle(options: {
  stats: RuleStats;
  cycle: Cycle;
  closeReason: CloseReason;
  markPrice: number;
  timestampUtc: string;
  weekOpenUtc: string;
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
    week_open_utc: options.weekOpenUtc,
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
      ["target", "account_reset"].includes(options.closeReason) &&
      realized > 0,
    runner_event_kind: runnerEventKind,
    closed_fraction: options.closedFraction ?? (options.cycle.runner_only ? options.cycle.runner_fraction ?? 1 : 1),
    runner_fraction: options.runnerFraction ?? options.cycle.runner_fraction,
  };
  options.stats.close_events.push(event);
  if (options.closeReason !== "sample_end") {
    addToMap(options.stats.closed_by_week, options.weekOpenUtc, realized);
  } else {
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
      week_open_utc: row.week_open_utc,
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
      runner_event_kind: "none",
      closed_fraction: 1,
      runner_fraction: null,
    };
    stats.close_events.push(event);
  }
}

function replayPairRulesForPair(pair: string, rows: ReplayRow[], selectedWeeks: string[], rules: ReplayRule[], statsByRule: Map<string, RuleStats>) {
  for (const rule of rules.filter((candidate) => candidate.kind === "weekly_forced_close")) {
    replayWeeklyForcedClose(rule, pair, rows, statsByRule.get(rule.rule_id)!);
  }

  type PairRuleState = {
    rule: ReplayRule;
    stats: RuleStats;
    current: Cycle | null;
    serial: number;
    lastMarkPrice: number | null;
    lastTimestampUtc: string | null;
    currentWeek: string | null;
    resetsThisPairWeek: number;
    stoppedThisPairWeek: boolean;
  };

  const states: PairRuleState[] = rules
    .filter((rule) => rule.kind !== "weekly_forced_close")
    .map((rule) => ({
      rule,
      stats: statsByRule.get(rule.rule_id)!,
      current: null,
      serial: 0,
      lastMarkPrice: null,
      lastTimestampUtc: null,
      currentWeek: null,
      resetsThisPairWeek: 0,
      stoppedThisPairWeek: false,
    }));

  function snapshot(state: PairRuleState, week: string) {
    const open = state.current && state.lastMarkPrice !== null ? round6(cycleNetPnlAdr(state.current, state.lastMarkPrice)) : 0;
    if (state.current && state.lastMarkPrice !== null && state.lastTimestampUtc !== null) {
      observeCycle(state.current, state.lastMarkPrice, state.lastTimestampUtc);
    }
    addToMap(state.stats.open_by_week, week, open);
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

        if (state.current && state.current.side !== row.candidate_b_side) {
          closeCycle({ stats: state.stats, cycle: state.current, closeReason: "flip", markPrice, timestampUtc: timestamp, weekOpenUtc: row.week_open_utc });
          state.current = null;
        }

        if (!state.current && !state.stoppedThisPairWeek) {
          state.serial += 1;
          state.current = startCycle({ rule: state.rule, pair, row, markPrice, timestampUtc: timestamp, serial: state.serial });
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
            closeCycle({ stats: state.stats, cycle: state.current, closeReason: "target", markPrice, timestampUtc: timestamp, weekOpenUtc: row.week_open_utc });
            state.resetsThisPairWeek = nextResetCount;
            state.current = null;
            if (finalAllowedReset) {
              state.stoppedThisPairWeek = true;
            } else {
              state.serial += 1;
              state.current = startCycle({ rule: state.rule, pair, row, markPrice, timestampUtc: timestamp, serial: state.serial });
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
  }
}

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function decodePayload(buffer: Buffer) {
  return JSON.parse(gunzipSync(buffer).toString("utf8")) as TradeLegPathColumnarPayload;
}

async function loadWeekRows(manifestId: string, symbols: string[], week: string): Promise<ReplayRow[]> {
  const rows = await query<AccountWeekDbRow>(
    `SELECT week_open_utc, pair, candidate_b_side, candidate_row_key,
            decision_hash, direction_streak_id, entry_timestamp_utc,
            friday_cutoff_timestamp_utc, pair_adr_pct, entry_price,
            mfe_adr, mae_adr, friday_close_adr, path_payload_compressed
       FROM research_trade_leg_path_pair_weeks
      WHERE manifest_id = $1
        AND week_open_utc = $2::timestamptz
        AND pair = ANY($3::text[])
      ORDER BY pair ASC`,
    [manifestId, new Date(week).toISOString(), symbols],
  );
  if (rows.length !== symbols.length) {
    throw new Error(`Missing Gate 74B week rows: ${week} rows=${rows.length}/${symbols.length}`);
  }
  return rows.map((row) => ({
    week_open_utc: iso(row.week_open_utc),
    pair: row.pair,
    candidate_b_side: row.candidate_b_side,
    candidate_row_key: row.candidate_row_key,
    decision_hash: row.decision_hash,
    direction_streak_id: row.direction_streak_id,
    entry_timestamp_utc: iso(row.entry_timestamp_utc),
    friday_cutoff_timestamp_utc: iso(row.friday_cutoff_timestamp_utc),
    pair_adr_pct: Number(row.pair_adr_pct),
    entry_price: row.entry_price === null ? null : Number(row.entry_price),
    mfe_adr: Number(row.mfe_adr),
    mae_adr: Number(row.mae_adr),
    friday_close_adr: Number(row.friday_close_adr),
    path_payload: decodePayload(row.path_payload_compressed),
  }));
}

function synchronizedTimestamps(rows: ReplayRow[]) {
  const [first] = rows;
  if (!first) return [];
  const base = first.path_payload.timestamp_utc;
  const aligned = rows.every((row) => (
    row.path_payload.timestamp_utc.length === base.length &&
    row.path_payload.timestamp_utc[0] === base[0] &&
    row.path_payload.timestamp_utc.at(-1) === base.at(-1)
  ));
  if (aligned) return base;
  return [...new Set(rows.flatMap((row) => row.path_payload.timestamp_utc))].sort();
}

function initAccountStates(rules: ReplayRule[]) {
  return new Map(rules.map((rule) => [rule.rule_id, {
    rule,
    current_by_pair: new Map<string, Cycle>(),
    last_mark_by_pair: new Map<string, PairMark>(),
    reset_count_week: 0,
    pair_reset_count_week: new Map<string, number>(),
    pair_stopped_this_week: new Set<string>(),
    stopped_this_week: false,
  } satisfies AccountRuleState]));
}

function accountOpenAdr(state: AccountRuleState) {
  let open = 0;
  for (const [pair, cycle] of state.current_by_pair.entries()) {
    const mark = state.last_mark_by_pair.get(pair);
    if (mark) open = round6(open + cycleNetPnlAdr(cycle, mark.mark_price));
  }
  return open;
}

function accountWeekEquityAdr(state: AccountRuleState, stats: RuleStats, weekOpenUtc: string) {
  return round6((stats.closed_by_week.get(weekOpenUtc) ?? 0) + accountOpenAdr(state));
}

function closeAllAccountCycles(options: {
  stats: RuleStats;
  state: AccountRuleState;
  reason: CloseReason;
  timestampUtc: string;
  weekOpenUtc: string;
}) {
  for (const [pair, cycle] of [...options.state.current_by_pair.entries()]) {
    const mark = options.state.last_mark_by_pair.get(pair);
    if (!mark) continue;
    closeCycle({
      stats: options.stats,
      cycle,
      closeReason: options.reason,
      markPrice: mark.mark_price,
      timestampUtc: options.timestampUtc,
      weekOpenUtc: options.weekOpenUtc,
    });
    options.state.current_by_pair.delete(pair);
  }
}

async function replayAccountRules(options: {
  manifestId: string;
  symbols: string[];
  weeks: string[];
  rules: ReplayRule[];
  statsByRule: Map<string, RuleStats>;
  logProgress: boolean;
}) {
  if (options.rules.length === 0) return;
  const states = initAccountStates(options.rules);
  const serials = new Map<string, number>();

  for (let weekIndex = 0; weekIndex < options.weeks.length; weekIndex += 1) {
    const week = options.weeks[weekIndex]!;
    if (options.logProgress) console.log(`gate78 account replay week=${weekIndex + 1}/${options.weeks.length} ${week}`);
    const rows = await loadWeekRows(options.manifestId, options.symbols, week);
    const cursorByPair = new Map(rows.map((row) => [row.pair, 0]));
    const timestamps = synchronizedTimestamps(rows);

    for (const state of states.values()) {
      state.reset_count_week = 0;
      state.pair_reset_count_week.clear();
      state.pair_stopped_this_week.clear();
      state.stopped_this_week = false;
    }

    for (const timestamp of timestamps) {
      for (const row of rows) {
        const cursor = cursorByPair.get(row.pair) ?? 0;
        if (row.path_payload.timestamp_utc[cursor] !== timestamp) continue;
        const markPrice = markPriceFromDirectedClose(row, row.path_payload.directed_close_adr[cursor]!);
        cursorByPair.set(row.pair, cursor + 1);

        for (const state of states.values()) {
          const stats = options.statsByRule.get(state.rule.rule_id)!;
          state.last_mark_by_pair.set(row.pair, { row, mark_price: markPrice, timestamp_utc: timestamp });
          const current = state.current_by_pair.get(row.pair);
          if (current && current.side !== row.candidate_b_side) {
            closeCycle({ stats, cycle: current, closeReason: "flip", markPrice, timestampUtc: timestamp, weekOpenUtc: week });
            state.current_by_pair.delete(row.pair);
          }
          if (!state.current_by_pair.has(row.pair) && !state.stopped_this_week && !state.pair_stopped_this_week.has(row.pair)) {
            const nextSerial = (serials.get(`${state.rule.rule_id}|${row.pair}`) ?? 0) + 1;
            serials.set(`${state.rule.rule_id}|${row.pair}`, nextSerial);
            state.current_by_pair.set(row.pair, startCycle({ rule: state.rule, pair: row.pair, row, markPrice, timestampUtc: timestamp, serial: nextSerial }));
          }
          const cycle = state.current_by_pair.get(row.pair);
          if (!cycle || state.rule.spacing_adr === null) continue;
          if (!cycle.runner_only) {
            const added = addGridFills({
              cycle,
              markPrice,
              timestampUtc: timestamp,
              spacingAdr: state.rule.spacing_adr,
              twoSided: state.rule.two_sided_grid,
            });
            if (added.addedAdverse > 0 || added.addedExpansion > 0) {
              incrementMap(stats.fill_count_by_week, week, added.addedAdverse + added.addedExpansion);
              incrementMap(stats.adverse_fill_count_by_week, week, added.addedAdverse);
              incrementMap(stats.expansion_fill_count_by_week, week, added.addedExpansion);
            }
          }
          observeCycle(cycle, markPrice, timestamp);
        }
      }

      for (const state of states.values()) {
        const stats = options.statsByRule.get(state.rule.rule_id)!;
        if (
          !state.stopped_this_week &&
          state.rule.account_emergency_sl_adr !== null &&
          accountWeekEquityAdr(state, stats, week) <= state.rule.account_emergency_sl_adr
        ) {
          incrementMap(stats.account_emergency_sl_by_week, week);
          stats.account_emergency_sl_events += 1;
          closeAllAccountCycles({ stats, state, reason: "account_emergency_sl", timestampUtc: timestamp, weekOpenUtc: week });
          state.stopped_this_week = true;
          continue;
        }

        if (state.stopped_this_week || state.rule.target_adr === null) continue;
        for (const [pair, cycle] of [...state.current_by_pair.entries()]) {
          if (cycle.runner_only) continue;
          const mark = state.last_mark_by_pair.get(pair);
          if (!mark) continue;
          const open = round6(cycleNetPnlAdr(cycle, mark.mark_price));
          if (open < state.rule.target_adr) continue;

          const nextResetCount = (state.pair_reset_count_week.get(pair) ?? 0) + 1;
          state.pair_reset_count_week.set(pair, nextResetCount);
          const finalAllowedReset = state.rule.pair_reset_limit_per_week !== null && nextResetCount >= state.rule.pair_reset_limit_per_week;
          if (finalAllowedReset && state.rule.runner_fraction !== null) {
            closeFinalResetWithRunner({
              stats,
              cycle,
              markPrice: mark.mark_price,
              timestampUtc: timestamp,
              weekOpenUtc: week,
              runnerFraction: state.rule.runner_fraction,
            });
            state.pair_stopped_this_week.add(pair);
          } else {
            closeCycle({ stats, cycle, closeReason: "target", markPrice: mark.mark_price, timestampUtc: timestamp, weekOpenUtc: week });
            state.current_by_pair.delete(pair);
            if (finalAllowedReset) {
              state.pair_stopped_this_week.add(pair);
            } else if (!state.stopped_this_week) {
              const nextSerial = (serials.get(`${state.rule.rule_id}|${pair}`) ?? 0) + 1;
              serials.set(`${state.rule.rule_id}|${pair}`, nextSerial);
              state.current_by_pair.set(pair, startCycle({
                rule: state.rule,
                pair,
                row: mark.row,
                markPrice: mark.mark_price,
                timestampUtc: timestamp,
                serial: nextSerial,
              }));
            }
          }
        }
      }
    }

    for (const state of states.values()) {
      const stats = options.statsByRule.get(state.rule.rule_id)!;
      stats.generated_account_replay = true;
      addToMap(stats.open_by_week, week, accountOpenAdr(state));
    }
  }

  const lastWeek = options.weeks.at(-1)!;
  for (const state of states.values()) {
    const stats = options.statsByRule.get(state.rule.rule_id)!;
    for (const [pair, cycle] of state.current_by_pair.entries()) {
      const mark = state.last_mark_by_pair.get(pair);
      if (!mark) continue;
      closeCycle({ stats, cycle, closeReason: "sample_end", markPrice: mark.mark_price, timestampUtc: mark.timestamp_utc, weekOpenUtc: lastWeek });
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

function summarizeRule(stats: RuleStats, weeklyRows: WeeklyRow[], topWeeks: Set<string>, top20BaselineAdr: number): AdapterSummaryRow {
  const closedEvents = stats.close_events.filter((event) => event.close_reason !== "sample_end");
  const finalEquity = weeklyRows.at(-1)?.equity_snapshot_adr ?? 0;
  const finalOpen = weeklyRows.at(-1)?.open_unrealized_adr ?? 0;
  const byYear = new Map<string, number>();
  for (const row of weeklyRows) addToMap(byYear, String(yearFromWeek(row.week_open_utc)), row.equity_delta_adr);
  const top20Equity = round6(weeklyRows.filter((row) => topWeeks.has(row.week_open_utc)).reduce((sum, row) => sum + row.equity_delta_adr, 0));
  const negativeCycles = stats.close_events.filter((event) => event.went_negative);
  const recovered = negativeCycles.filter((event) => event.recovered_to_positive_close);
  const sortedWeekly = weeklyRows.map((row) => row.equity_delta_adr).sort((left, right) => left - right);
  const closedTotal = round6(closedEvents.reduce((sum, event) => sum + event.realized_or_open_adr, 0));
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
    reference_only: stats.rule.reference_only,
    closed_total_adr: closedTotal,
    final_equity_adr: round6(finalEquity),
    equity_profit_factor: profitFactor(weeklyRows.map((row) => row.equity_delta_adr)),
    max_equity_drawdown_adr: maxDrawdown(weeklyRows),
    final_open_unrealized_adr: round6(finalOpen),
    closed_adr_retention_vs_gate74e_focus: FOCUS_CLOSED_ADR === 0 ? null : round6(closedTotal / FOCUS_CLOSED_ADR),
    final_equity_retention_vs_gate74e_focus: FOCUS_EQUITY_ADR === 0 ? null : round6(finalEquity / FOCUS_EQUITY_ADR),
    top20_winner_retention_vs_weekly_forced: top20BaselineAdr === 0 ? null : round6(top20Equity / top20BaselineAdr),
    worst_week_loss_adr: round6(sortedWeekly[0] ?? 0),
    worst_5_week_loss_adr: round6(sortedWeekly.slice(0, 5).reduce((sum, value) => sum + value, 0)),
    worst_13_week_loss_adr: round6(sortedWeekly.slice(0, 13).reduce((sum, value) => sum + value, 0)),
    negative_years: [...byYear.values()].filter((value) => value < 0).length,
    profitable_week_rate: round6(weeklyRows.filter((row) => row.equity_delta_adr > 0).length / Math.max(1, weeklyRows.length)),
    closed_cycles: closedEvents.length,
    target_reset_cycles: closedEvents.filter((event) => event.close_reason === "target").length,
    account_reset_events: stats.account_reset_events,
    account_emergency_sl_events: stats.account_emergency_sl_events,
    flip_loss_adr: round6(closedEvents.filter((event) => event.close_reason === "flip" && event.realized_or_open_adr < 0).reduce((sum, event) => sum + event.realized_or_open_adr, 0)),
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

function resetCountRows(statsByRule: Map<string, RuleStats>) {
  const weekly: Array<Record<string, unknown>> = [];
  const pair: Array<Record<string, unknown>> = [];
  for (const stats of statsByRule.values()) {
    for (const [week, count] of stats.reset_by_week.entries()) {
      weekly.push({
        rule_id: stats.rule.rule_id,
        rule_family: stats.rule.rule_family,
        week_open_utc: week,
        reset_count: count,
        pair_reset_count: stats.pair_reset_by_week.get(week) ?? 0,
        account_reset_count: stats.account_reset_by_week.get(week) ?? 0,
        account_emergency_sl_count: stats.account_emergency_sl_by_week.get(week) ?? 0,
      });
    }
    for (const [week, count] of stats.account_emergency_sl_by_week.entries()) {
      if (stats.reset_by_week.has(week)) continue;
      weekly.push({
        rule_id: stats.rule.rule_id,
        rule_family: stats.rule.rule_family,
        week_open_utc: week,
        reset_count: stats.reset_by_week.get(week) ?? 0,
        pair_reset_count: stats.pair_reset_by_week.get(week) ?? 0,
        account_reset_count: stats.account_reset_by_week.get(week) ?? 0,
        account_emergency_sl_count: count,
      });
    }
    for (const [symbol, count] of stats.reset_by_pair.entries()) {
      pair.push({ rule_id: stats.rule.rule_id, rule_family: stats.rule.rule_family, pair: symbol, reset_count: count });
    }
  }
  return { weekly, pair };
}

function tailRows(statsByRule: Map<string, RuleStats>) {
  const byPair: Array<Record<string, unknown>> = [];
  const byCurrency = new Map<string, { rule_id: string; rule_family: RuleFamily; currency: string; value: number; pair_count: number }>();
  for (const stats of statsByRule.values()) {
    for (const [symbol, value] of stats.final_open_by_pair.entries()) {
      byPair.push({
        rule_id: stats.rule.rule_id,
        rule_family: stats.rule.rule_family,
        pair: symbol,
        final_open_unrealized_adr: round6(value),
      });
      const base = symbol.slice(0, 3);
      const quote = symbol.slice(3, 6);
      for (const currency of [base, quote]) {
        const key = `${stats.rule.rule_id}|${currency}`;
        const current = byCurrency.get(key) ?? { rule_id: stats.rule.rule_id, rule_family: stats.rule.rule_family, currency, value: 0, pair_count: 0 };
        current.value = round6(current.value + value);
        current.pair_count += 1;
        byCurrency.set(key, current);
      }
    }
  }
  return {
    byPair: byPair.sort((left, right) => Number(left.final_open_unrealized_adr) - Number(right.final_open_unrealized_adr)),
    byCurrency: [...byCurrency.values()].map((row) => ({
      rule_id: row.rule_id,
      rule_family: row.rule_family,
      currency: row.currency,
      final_open_unrealized_adr: round6(row.value),
      contributing_pairs: row.pair_count,
    })).sort((left, right) => left.rule_id.localeCompare(right.rule_id) || Number(left.final_open_unrealized_adr) - Number(right.final_open_unrealized_adr)),
  };
}

function expansionAttributionRows(summaryRows: AdapterSummaryRow[]) {
  const focus = summaryRows.find((row) => row.rule_id === FOCUS_RULE_ID);
  if (!focus) return [];
  return summaryRows
    .filter((row) => row.rule_family === "pair_directional_two_sided_grid")
    .map((row) => ({
      rule_id: row.rule_id,
      target_adr: row.target_adr,
      closed_delta_vs_adverse_focus: round6(row.closed_total_adr - focus.closed_total_adr),
      final_equity_delta_vs_adverse_focus: round6(row.final_equity_adr - focus.final_equity_adr),
      max_drawdown_delta_vs_adverse_focus: round6(row.max_equity_drawdown_adr - focus.max_equity_drawdown_adr),
      final_open_delta_vs_adverse_focus: round6(row.final_open_unrealized_adr - focus.final_open_unrealized_adr),
      giveback_delta_vs_adverse_focus: round6(row.total_giveback_adr - focus.total_giveback_adr),
      closed_adr_from_recovery_fills: row.closed_adr_from_recovery_fills,
      closed_adr_from_expansion_fills: row.closed_adr_from_expansion_fills,
      adverse_recovery_fill_count: row.adverse_recovery_fill_count,
      favorable_expansion_fill_count: row.favorable_expansion_fill_count,
      interpretation:
        row.final_equity_adr > focus.final_equity_adr && row.max_equity_drawdown_adr >= focus.max_equity_drawdown_adr
          ? "expansion_improved_equity_without_worse_drawdown"
          : row.closed_total_adr > focus.closed_total_adr && row.final_equity_adr <= focus.final_equity_adr
            ? "expansion_added_closed_harvest_but_giveback_or_open_loss_offset_it"
            : "expansion_not_superior_to_adverse_focus_on_first_pass",
    }));
}

function ruleRows(weeklyRows: WeeklyRow[], ruleId: string) {
  return weeklyRows.filter((row) => row.rule_id === ruleId);
}

function top20Adr(weeklyRows: WeeklyRow[], topWeeks: Set<string>) {
  return round6(weeklyRows.filter((row) => topWeeks.has(row.week_open_utc)).reduce((sum, row) => sum + row.equity_delta_adr, 0));
}

function openTailAttribution(statsByRule: Map<string, RuleStats>, candidateRuleId: string, baselineRuleId: string) {
  const candidate = statsByRule.get(candidateRuleId);
  const baseline = statsByRule.get(baselineRuleId);
  if (!candidate || !baseline) return null;
  const pairs = new Set([...candidate.final_open_by_pair.keys(), ...baseline.final_open_by_pair.keys()]);
  const pairDeltas = [...pairs].map((pair) => {
    const baselineOpen = baseline.final_open_by_pair.get(pair) ?? 0;
    const candidateOpen = candidate.final_open_by_pair.get(pair) ?? 0;
    return {
      pair,
      open_improvement_adr: round6(candidateOpen - baselineOpen),
      baseline_final_open_unrealized_adr: round6(baselineOpen),
      candidate_final_open_unrealized_adr: round6(candidateOpen),
    };
  });
  const positive = pairDeltas.filter((row) => row.open_improvement_adr > 0);
  const totalPositive = round6(positive.reduce((sum, row) => sum + row.open_improvement_adr, 0));
  const audNzd = positive.find((row) => row.pair === "AUDNZD")?.open_improvement_adr ?? 0;
  const audPairs = round6(positive.filter((row) => row.pair.includes("AUD")).reduce((sum, row) => sum + row.open_improvement_adr, 0));
  const audNzdShare = totalPositive === 0 ? 0 : round6(audNzd / totalPositive);
  const audShare = totalPositive === 0 ? 0 : round6(audPairs / totalPositive);
  const topPairs = positive
    .sort((left, right) => right.open_improvement_adr - left.open_improvement_adr)
    .slice(0, 5);
  const concentrationRead =
    totalPositive <= 0
      ? "no_open_tail_reduction"
      : audNzdShare >= 0.4
        ? "concentrated_audnzd_tail_suppression"
        : audShare >= 0.65
          ? "concentrated_aud_tail_suppression"
          : positive.length >= 10
            ? "distributed_lifecycle_behavior"
            : "mixed_or_moderately_concentrated_tail_reduction";
  return {
    open_tail_improved_pair_count: positive.length,
    open_tail_worsened_pair_count: pairDeltas.filter((row) => row.open_improvement_adr < 0).length,
    total_positive_open_tail_improvement_adr: totalPositive,
    audnzd_open_tail_improvement_adr: round6(audNzd),
    audnzd_share_of_positive_open_tail_improvement: audNzdShare,
    aud_pair_open_tail_improvement_adr: audPairs,
    aud_pair_share_of_positive_open_tail_improvement: audShare,
    top_open_tail_improvement_pairs: topPairs,
    concentration_read: concentrationRead,
  };
}

function rightTailRetentionRows(options: {
  weeklyRows: WeeklyRow[];
  adapterRows: AdapterSummaryRow[];
  top20Weeks: Set<string>;
}) {
  const adapterByRule = new Map(options.adapterRows.map((row) => [row.rule_id, row]));
  const t150 = adapterByRule.get(GATE76_T150_RULE_ID);
  if (!t150) return [];
  const t150Top20 = top20Adr(ruleRows(options.weeklyRows, GATE76_T150_RULE_ID), options.top20Weeks);
  return options.adapterRows
    .filter((row) => row.rule_family !== "control")
    .map((row) => {
      const candidateTop20 = top20Adr(ruleRows(options.weeklyRows, row.rule_id), options.top20Weeks);
      return {
        rule_id: row.rule_id,
        rule_family: row.rule_family,
        reference_only: row.reference_only,
        target_adr: row.target_adr,
        runner_fraction: row.runner_fraction,
        account_emergency_sl_adr: row.account_emergency_sl_adr,
        top20_winner_adr: candidateTop20,
        t150_top20_winner_adr: t150Top20,
        top20_winner_retention_delta_vs_t150_adr: round6(candidateTop20 - t150Top20),
        top20_winner_retention_loss_vs_t150_adr: round6(Math.max(0, t150Top20 - candidateTop20)),
        closed_delta_vs_t150_adr: round6(row.closed_total_adr - t150.closed_total_adr),
        final_equity_delta_vs_t150_adr: round6(row.final_equity_adr - t150.final_equity_adr),
        max_drawdown_improvement_vs_t150_adr: round6(row.max_equity_drawdown_adr - t150.max_equity_drawdown_adr),
        final_open_improvement_vs_t150_adr: round6(row.final_open_unrealized_adr - t150.final_open_unrealized_adr),
        flip_loss_improvement_vs_t150_adr: round6(row.flip_loss_adr - t150.flip_loss_adr),
      };
    });
}

function runnerContributionRows(statsByRule: Map<string, RuleStats>) {
  return [...statsByRule.values()]
    .filter((stats) => stats.rule.runner_fraction !== null)
    .map((stats) => {
      const partial = stats.close_events.filter((event) => event.runner_event_kind === "final_reset_partial_close");
      const flip = stats.close_events.filter((event) => event.runner_event_kind === "runner_flip_close");
      const sampleEnd = stats.close_events.filter((event) => event.runner_event_kind === "runner_sample_end_open");
      const emergency = stats.close_events.filter((event) => event.runner_event_kind === "runner_account_emergency_sl_close");
      const runnerClosedAdr = round6([...flip, ...emergency].reduce((sum, event) => sum + event.realized_or_open_adr, 0));
      const runnerOpenAdr = round6(sampleEnd.reduce((sum, event) => sum + event.realized_or_open_adr, 0));
      return {
        rule_id: stats.rule.rule_id,
        rule_family: stats.rule.rule_family,
        scope: stats.rule.scope,
        base_rule_id: stats.rule.base_rule_id,
        target_adr: stats.rule.target_adr,
        runner_fraction: stats.rule.runner_fraction,
        account_emergency_sl_adr: stats.rule.account_emergency_sl_adr,
        final_reset_partial_close_count: partial.length,
        final_reset_partial_closed_adr: round6(partial.reduce((sum, event) => sum + event.realized_or_open_adr, 0)),
        runner_flip_close_count: flip.length,
        runner_flip_closed_adr: round6(flip.reduce((sum, event) => sum + event.realized_or_open_adr, 0)),
        runner_account_emergency_sl_close_count: emergency.length,
        runner_account_emergency_sl_closed_adr: round6(emergency.reduce((sum, event) => sum + event.realized_or_open_adr, 0)),
        runner_sample_end_open_count: sampleEnd.length,
        runner_sample_end_open_adr: runnerOpenAdr,
        runner_total_marked_contribution_adr: round6(runnerClosedAdr + runnerOpenAdr),
      };
    });
}

function gate78RunnerRankingRows(options: {
  adapterRows: AdapterSummaryRow[];
  weeklyRows: WeeklyRow[];
  top20Weeks: Set<string>;
}) {
  const t100 = options.adapterRows.find((row) => row.rule_id === GATE77_T100_L3_RULE_ID);
  if (!t100) return [];
  return options.adapterRows
    .filter((row) => row.rule_family === "pair_final_reset_runner")
    .map((row) => {
      const top20 = top20Adr(ruleRows(options.weeklyRows, row.rule_id), options.top20Weeks);
      const score = round6(
        row.final_equity_adr +
        row.max_equity_drawdown_adr +
        row.final_open_unrealized_adr +
        row.flip_loss_adr +
        row.worst_13_week_loss_adr +
        row.closed_total_adr * 0.25 +
        top20 * 0.25
      );
      return {
        rule_id: row.rule_id,
        base_rule_id: row.base_rule_id,
        target_adr: row.target_adr,
        runner_fraction: row.runner_fraction,
        gate78_research_rank_score: score,
        final_equity_adr: row.final_equity_adr,
        equity_profit_factor: row.equity_profit_factor,
        max_equity_drawdown_adr: row.max_equity_drawdown_adr,
        final_open_unrealized_adr: row.final_open_unrealized_adr,
        flip_loss_adr: row.flip_loss_adr,
        worst_13_week_loss_adr: row.worst_13_week_loss_adr,
        closed_total_adr: row.closed_total_adr,
        top20_winner_adr: top20,
        final_equity_delta_vs_t100_l3: round6(row.final_equity_adr - t100.final_equity_adr),
        drawdown_delta_vs_t100_l3: round6(row.max_equity_drawdown_adr - t100.max_equity_drawdown_adr),
        open_delta_vs_t100_l3: round6(row.final_open_unrealized_adr - t100.final_open_unrealized_adr),
        flip_loss_delta_vs_t100_l3: round6(row.flip_loss_adr - t100.flip_loss_adr),
        interpretation:
          row.final_equity_adr > t100.final_equity_adr &&
          row.max_equity_drawdown_adr >= t100.max_equity_drawdown_adr &&
          row.final_open_unrealized_adr >= t100.final_open_unrealized_adr
            ? "runner_improved_harvest_without_reopening_tail_vs_t100_l3"
            : row.final_equity_adr > t100.final_equity_adr
              ? "runner_improved_equity_but_reopened_some_tail_vs_t100_l3"
              : "runner_did_not_improve_t100_l3_balance",
      };
    })
    .sort((left, right) => right.gate78_research_rank_score - left.gate78_research_rank_score);
}

function accountEmergencyAttributionRows(options: {
  adapterRows: AdapterSummaryRow[];
  statsByRule: Map<string, RuleStats>;
}) {
  const adapterByRule = new Map(options.adapterRows.map((row) => [row.rule_id, row]));
  return options.adapterRows
    .filter((row) => row.rule_family === "account_emergency_sl_reference")
    .map((row) => {
      const baseline = row.base_rule_id ? adapterByRule.get(row.base_rule_id) : undefined;
      const stats = options.statsByRule.get(row.rule_id);
      const emergencyEvents = stats?.close_events.filter((event) => event.close_reason === "account_emergency_sl") ?? [];
      return {
        rule_id: row.rule_id,
        base_rule_id: row.base_rule_id,
        account_emergency_sl_adr: row.account_emergency_sl_adr,
        emergency_breach_count: stats?.account_emergency_sl_events ?? 0,
        emergency_closed_cycle_count: emergencyEvents.length,
        emergency_closed_adr: round6(emergencyEvents.reduce((sum, event) => sum + event.realized_or_open_adr, 0)),
        final_equity_adr: row.final_equity_adr,
        closed_total_adr: row.closed_total_adr,
        max_equity_drawdown_adr: row.max_equity_drawdown_adr,
        final_open_unrealized_adr: row.final_open_unrealized_adr,
        flip_loss_adr: row.flip_loss_adr,
        final_equity_delta_vs_base_adr: baseline ? round6(row.final_equity_adr - baseline.final_equity_adr) : null,
        closed_delta_vs_base_adr: baseline ? round6(row.closed_total_adr - baseline.closed_total_adr) : null,
        max_drawdown_improvement_vs_base_adr: baseline ? round6(row.max_equity_drawdown_adr - baseline.max_equity_drawdown_adr) : null,
        final_open_improvement_vs_base_adr: baseline ? round6(row.final_open_unrealized_adr - baseline.final_open_unrealized_adr) : null,
        flip_loss_improvement_vs_base_adr: baseline ? round6(row.flip_loss_adr - baseline.flip_loss_adr) : null,
        interpretation:
          !baseline
            ? "missing_base_row"
            : row.final_equity_adr > baseline.final_equity_adr && row.max_equity_drawdown_adr >= baseline.max_equity_drawdown_adr
              ? "reference_sl_improved_survivability_and_equity"
              : row.max_equity_drawdown_adr >= baseline.max_equity_drawdown_adr && row.final_equity_adr <= baseline.final_equity_adr
                ? "reference_sl_clipped_tail_but_gave_up_harvest"
                : "reference_sl_not_superior_to_base",
      };
    });
}

function failureAnatomyRows(options: {
  weeklyRows: WeeklyRow[];
  adapterRows: AdapterSummaryRow[];
  statsByRule: Map<string, RuleStats>;
  top20Weeks: Set<string>;
}) {
  const adapterByRule = new Map(options.adapterRows.map((row) => [row.rule_id, row]));
  const comparisons = options.adapterRows
    .filter((row) => row.rule_family === "pair_final_reset_runner" && row.base_rule_id !== null)
    .map((row) => ({
      role: `runner_${formatAdr(row.target_adr ?? 0)}_${formatAdr(row.runner_fraction ?? 0)}_vs_${row.base_rule_id}`,
      candidateRuleId: row.rule_id,
      baselineRuleId: row.base_rule_id!,
    }));

  return comparisons.map(({ role, candidateRuleId, baselineRuleId }) => {
    const candidateRows = ruleRows(options.weeklyRows, candidateRuleId);
    const baselineRows = ruleRows(options.weeklyRows, baselineRuleId);
    const baselineByWeek = new Map(baselineRows.map((row) => [row.week_open_utc, row]));
    const weeklyDeltas = candidateRows.map((candidate) => {
      const baseline = baselineByWeek.get(candidate.week_open_utc);
      const baselineEquity = baseline?.equity_delta_adr ?? 0;
      return {
        week_open_utc: candidate.week_open_utc,
        candidate_equity_delta_adr: candidate.equity_delta_adr,
        baseline_equity_delta_adr: baselineEquity,
        delta_vs_no_limit_adr: round6(candidate.equity_delta_adr - baselineEquity),
      };
    });
    const helps = weeklyDeltas.filter((row) => row.delta_vs_no_limit_adr > 0);
    const hurts = weeklyDeltas.filter((row) => row.delta_vs_no_limit_adr < 0);
    const candidate = adapterByRule.get(candidateRuleId);
    const baseline = adapterByRule.get(baselineRuleId);
    if (!candidate || !baseline) throw new Error(`Missing failure anatomy rows for ${candidateRuleId} vs ${baselineRuleId}`);
    const candidateTop20 = top20Adr(candidateRows, options.top20Weeks);
    const baselineTop20 = top20Adr(baselineRows, options.top20Weeks);
    const tail = openTailAttribution(options.statsByRule, candidateRuleId, baselineRuleId);
    return {
      comparison_role: role,
      candidate_rule_id: candidateRuleId,
      baseline_rule_id: baselineRuleId,
      helped_week_count: helps.length,
      helped_total_adr: round6(helps.reduce((sum, row) => sum + row.delta_vs_no_limit_adr, 0)),
      hurt_week_count: hurts.length,
      hurt_total_adr: round6(hurts.reduce((sum, row) => sum + row.delta_vs_no_limit_adr, 0)),
      net_equity_delta_vs_base_adr: round6(candidate.final_equity_adr - baseline.final_equity_adr),
      closed_delta_vs_base_adr: round6(candidate.closed_total_adr - baseline.closed_total_adr),
      max_drawdown_improvement_vs_base_adr: round6(candidate.max_equity_drawdown_adr - baseline.max_equity_drawdown_adr),
      final_open_improvement_vs_base_adr: round6(candidate.final_open_unrealized_adr - baseline.final_open_unrealized_adr),
      flip_loss_improvement_vs_base_adr: round6(candidate.flip_loss_adr - baseline.flip_loss_adr),
      worst_week_loss_improvement_vs_base_adr: round6(candidate.worst_week_loss_adr - baseline.worst_week_loss_adr),
      worst_5_week_loss_improvement_vs_base_adr: round6(candidate.worst_5_week_loss_adr - baseline.worst_5_week_loss_adr),
      worst_13_week_loss_improvement_vs_base_adr: round6(candidate.worst_13_week_loss_adr - baseline.worst_13_week_loss_adr),
      top20_winner_adr_candidate: candidateTop20,
      top20_winner_adr_base: baselineTop20,
      top20_winner_retention_loss_vs_base_adr: round6(Math.max(0, baselineTop20 - candidateTop20)),
      top20_winner_retention_delta_vs_base_adr: round6(candidateTop20 - baselineTop20),
      reset_count_delta_vs_base: candidate.target_reset_cycles - baseline.target_reset_cycles,
      fill_count_delta_vs_base: round6(candidate.fill_count - baseline.fill_count),
      expansion_fill_count_delta_vs_base: round6(candidate.favorable_expansion_fill_count - baseline.favorable_expansion_fill_count),
      recovery_rate_delta_vs_base: candidate.negative_cycle_recovery_rate === null || baseline.negative_cycle_recovery_rate === null
        ? null
        : round6(candidate.negative_cycle_recovery_rate - baseline.negative_cycle_recovery_rate),
      tail_reduction_attribution: tail,
      top_help_weeks: helps.sort((left, right) => right.delta_vs_no_limit_adr - left.delta_vs_no_limit_adr).slice(0, 5),
      top_hurt_weeks: hurts.sort((left, right) => left.delta_vs_no_limit_adr - right.delta_vs_no_limit_adr).slice(0, 5),
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

function tableRows(rows: AdapterSummaryRow[]) {
  return rows.map((row) => ({
    rule_id: row.rule_id,
    family: row.rule_family,
    runner: row.runner_fraction,
    account_sl: row.account_emergency_sl_adr,
    reference_only: row.reference_only,
    closed: row.closed_total_adr,
    equity: row.final_equity_adr,
    eq_pf: row.equity_profit_factor,
    dd: row.max_equity_drawdown_adr,
    open: row.final_open_unrealized_adr,
    worst1: row.worst_week_loss_adr,
    worst5: row.worst_5_week_loss_adr,
    worst13: row.worst_13_week_loss_adr,
    neg_years: row.negative_years,
    profitable_week_rate: row.profitable_week_rate,
    top20: row.top20_winner_retention_vs_weekly_forced,
    recovery: row.negative_cycle_recovery_rate,
    flip_loss: row.flip_loss_adr,
    resets: row.target_reset_cycles + row.account_reset_events,
    account_sl_events: row.account_emergency_sl_events,
    fills: row.fill_count,
    adverse: row.adverse_recovery_fill_count,
    expansion: row.favorable_expansion_fill_count,
  }));
}

function renderReport(options: {
  summary: Record<string, unknown>;
  adapterRows: AdapterSummaryRow[];
  failureRows: Array<Record<string, unknown>>;
  runnerRankingRows: Array<Record<string, unknown>>;
  rightTailRows: Array<Record<string, unknown>>;
  accountEmergencyRows: Array<Record<string, unknown>>;
}) {
  return [
    "# Gate 78 Pair Two-Sided Limited-Reentry Enhancement Matrix",
    "",
    `Generated: \`${new Date().toISOString()}\``,
    "",
    "## Verdict",
    "",
    `\`${options.summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Tests only final-reset runner preservation and reference-only account emergency SL diagnostics.",
    "- Uses spacing 0.2 ADR, pair reset limit 3, targets 0.75/1.0/1.25, runner fractions 25%/50%, and account emergency bands -3/-5 ADR.",
    "- Reproduces Gate 74E, Gate 76 T150, and Gate 77 T075/T100/T125 L3 rows before comparison.",
    "- Does not run costs, risk/correlation pruning, pair/date exclusions, source mutation, Brain mutation, MT5/live/app/runtime, or promotion.",
    "",
    "## Adapter Ranking",
    "",
    renderTable(tableRows(options.adapterRows), ["rule_id", "family", "runner", "account_sl", "reference_only", "closed", "equity", "eq_pf", "dd", "open", "worst1", "worst5", "worst13", "neg_years", "profitable_week_rate", "top20", "recovery", "flip_loss", "resets", "account_sl_events", "fills", "adverse", "expansion"]),
    "",
    "## Runner Ranking",
    "",
    renderTable(options.runnerRankingRows, ["rule_id", "base_rule_id", "target_adr", "runner_fraction", "gate78_research_rank_score", "final_equity_adr", "max_equity_drawdown_adr", "final_open_unrealized_adr", "flip_loss_adr", "closed_total_adr", "top20_winner_adr", "interpretation"]),
    "",
    "## Right-Tail Retention Versus T150",
    "",
    renderTable(options.rightTailRows, ["rule_id", "rule_family", "target_adr", "runner_fraction", "account_emergency_sl_adr", "top20_winner_retention_delta_vs_t150_adr", "top20_winner_retention_loss_vs_t150_adr", "closed_delta_vs_t150_adr", "final_equity_delta_vs_t150_adr", "max_drawdown_improvement_vs_t150_adr"]),
    "",
    "## Account Emergency SL Reference Rows",
    "",
    renderTable(options.accountEmergencyRows, ["rule_id", "base_rule_id", "account_emergency_sl_adr", "emergency_breach_count", "emergency_closed_cycle_count", "emergency_closed_adr", "final_equity_delta_vs_base_adr", "closed_delta_vs_base_adr", "max_drawdown_improvement_vs_base_adr", "interpretation"]),
    "",
    "## Failure Anatomy",
    "",
    renderTable(options.failureRows, ["comparison_role", "candidate_rule_id", "baseline_rule_id", "helped_week_count", "hurt_week_count", "net_equity_delta_vs_base_adr", "closed_delta_vs_base_adr", "max_drawdown_improvement_vs_base_adr", "final_open_improvement_vs_base_adr", "flip_loss_improvement_vs_base_adr", "top20_winner_retention_loss_vs_base_adr"]),
    "",
    "## Interpretation Rule",
    "",
    "- Tail concentration is reporting-only and is not a reason to exclude pairs.",
    "- Account emergency SL rows are reference-only diagnostics and are not ranking tricks.",
    "- Runner rows are not ranked by final equity or closed PnL alone.",
    "- If runner preservation reopens the no-limit negative tail, the failure anatomy and right-tail artifacts call it out.",
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
    "Gate 78 is enhancement-matrix evidence only. Do not promote, start costs, risk, pair pruning, Gate 75B, Gate 79, MT5/live, app/runtime, retuning, or source mutation unless Freedom explicitly opens the next scope.",
    "",
  ].join("\n");
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
  let rules = ruleSet();
  const pairRules = rules.filter((rule) => rule.scope === "pair");
  const statsByRule = new Map(rules.map((rule) => [rule.rule_id, createStats(rule)]));

  for (let pairIndex = 0; pairIndex < manifest.universe_symbols.length; pairIndex += 1) {
    const pair = manifest.universe_symbols[pairIndex]!;
    if (options.logProgress) console.log(`gate78 pair replay pair=${pairIndex + 1}/${manifest.universe_symbols.length} ${pair}`);
    const rows = await readTradeLegPathWarehousePairSeries({ manifestId, pair, weeks: selectedWeeks });
    if (rows.length !== selectedWeeks.length) throw new Error(`Missing pair series rows for ${pair}: ${rows.length}/${selectedWeeks.length}`);
    replayPairRulesForPair(pair, rows, selectedWeeks, pairRules, statsByRule);
  }

  let weeklyRows = rules.flatMap((rule) => weeklyRowsForRule(statsByRule.get(rule.rule_id)!, selectedWeeks));
  let weeklyForcedRows = weeklyRows.filter((row) => row.rule_id === "WEEKLY_FORCED_CLOSE");
  const top20Weeks = [...weeklyForcedRows]
    .sort((left, right) => right.equity_delta_adr - left.equity_delta_adr)
    .slice(0, 20)
    .map((row) => row.week_open_utc);
  const top20WeekSet = new Set(top20Weeks);
  const top20BaselineAdr = round6(weeklyForcedRows.filter((row) => top20WeekSet.has(row.week_open_utc)).reduce((sum, row) => sum + row.equity_delta_adr, 0));
  let adapterRows = withHashes(rules.map((rule) => summarizeRule(statsByRule.get(rule.rule_id)!, weeklyRows.filter((row) => row.rule_id === rule.rule_id), top20WeekSet, top20BaselineAdr)));
  const initialRunnerRankingRows = gate78RunnerRankingRows({ adapterRows, weeklyRows, top20Weeks: top20WeekSet });
  const bestRunnerRuleId = initialRunnerRankingRows[0]?.rule_id;
  const bestRunnerRule = rules.find((rule) => rule.rule_id === bestRunnerRuleId);
  if (!bestRunnerRule) throw new Error("Gate 78 could not select a best final-reset runner row for account emergency diagnostics");
  const accountRules = accountEmergencyRules(bestRunnerRule);
  rules = [...rules, ...accountRules];
  for (const rule of accountRules) statsByRule.set(rule.rule_id, createStats(rule));

  await replayAccountRules({
    manifestId,
    symbols: manifest.universe_symbols,
    weeks: selectedWeeks,
    rules: accountRules,
    statsByRule,
    logProgress: options.logProgress,
  });

  weeklyRows = rules.flatMap((rule) => weeklyRowsForRule(statsByRule.get(rule.rule_id)!, selectedWeeks));
  weeklyForcedRows = weeklyRows.filter((row) => row.rule_id === "WEEKLY_FORCED_CLOSE");
  adapterRows = withHashes(rules.map((rule) => summarizeRule(statsByRule.get(rule.rule_id)!, weeklyRows.filter((row) => row.rule_id === rule.rule_id), top20WeekSet, top20BaselineAdr)));
  const annual = withHashes(rules.flatMap((rule) => annualRows(weeklyRows.filter((row) => row.rule_id === rule.rule_id))));
  const resetRows = resetCountRows(statsByRule);
  const tails = tailRows(statsByRule);
  const expansionRows = withHashes(expansionAttributionRows(adapterRows));
  const fillAttributionRows = withHashes(adapterRows.map((row) => ({
    rule_id: row.rule_id,
    rule_family: row.rule_family,
    initial_fill_closed_adr: row.closed_adr_from_initial_fills,
    recovery_fill_closed_adr: row.closed_adr_from_recovery_fills,
    expansion_fill_closed_adr: row.closed_adr_from_expansion_fills,
    adverse_recovery_fill_count: row.adverse_recovery_fill_count,
    favorable_expansion_fill_count: row.favorable_expansion_fill_count,
  })));
  const failureRows = withHashes(failureAnatomyRows({
    weeklyRows,
    adapterRows,
    statsByRule,
    top20Weeks: top20WeekSet,
  }));
  const runnerRows = withHashes(runnerContributionRows(statsByRule));
  const runnerRankingRows = withHashes(gate78RunnerRankingRows({ adapterRows, weeklyRows, top20Weeks: top20WeekSet }));
  const rightTailRows = withHashes(rightTailRetentionRows({ weeklyRows, adapterRows, top20Weeks: top20WeekSet }));
  const accountEmergencyRows = withHashes(accountEmergencyAttributionRows({ adapterRows, statsByRule }));

  const bestByEquity = [...adapterRows].filter((row) => !row.reference_only).sort((left, right) => right.final_equity_adr - left.final_equity_adr)[0]!;
  const focus = adapterRows.find((row) => row.rule_id === FOCUS_RULE_ID)!;
  const gate76AdapterByRule = new Map(gate76AdapterRows.map((row) => [row.rule_id, row]));
  const gate77AdapterByRule = new Map(gate77AdapterRows.map((row) => [row.rule_id, row]));
  const adapterByRule = new Map(adapterRows.map((row) => [row.rule_id, row]));
  const gate76T150Reproduced = adapterRowsMatch(adapterByRule.get(GATE76_T150_RULE_ID), gate76AdapterByRule.get(GATE76_T150_RULE_ID));
  const gate77T075L3Reproduced = adapterRowsMatch(adapterByRule.get(GATE77_T075_L3_RULE_ID), gate77AdapterByRule.get(GATE77_T075_L3_RULE_ID));
  const gate77T100L3Reproduced = adapterRowsMatch(adapterByRule.get(GATE77_T100_L3_RULE_ID), gate77AdapterByRule.get(GATE77_T100_L3_RULE_ID));
  const gate77T125L3Reproduced = adapterRowsMatch(adapterByRule.get(GATE77_T125_L3_RULE_ID), gate77AdapterByRule.get(GATE77_T125_L3_RULE_ID));
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
    pair_two_sided_target_count: LIMITED_REENTRY_TARGETS.length,
    t150_no_limit_reference_included: adapterByRule.has(GATE76_T150_RULE_ID),
    account_reset_target_count: 0,
    final_reset_runner_row_count: adapterRows.filter((row) => row.rule_family === "pair_final_reset_runner").length,
    final_reset_runner_fractions: FINAL_RESET_RUNNER_FRACTIONS,
    account_emergency_sl_reference_row_count: adapterRows.filter((row) => row.rule_family === "account_emergency_sl_reference").length,
    account_emergency_sl_bands: ACCOUNT_EMERGENCY_SL_BANDS,
    account_level_emergency_sl_replay_started: accountRules.length === 4 && accountRules.every((rule) => statsByRule.get(rule.rule_id)?.generated_account_replay === true),
    account_emergency_rows_reference_only: accountRules.every((rule) => rule.reference_only),
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
    validation.fixed_rule_count === 17 &&
    validation.final_reset_runner_row_count === 6 &&
    validation.account_emergency_sl_reference_row_count === 4 &&
    validation.account_level_emergency_sl_replay_started &&
    validation.account_emergency_rows_reference_only &&
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
    validation.closed_and_equity_reported_side_by_side;
  const verdict = passed
    ? "PASS_GATE78_PAIR_TWO_SIDED_LIMITED_REENTRY_ENHANCEMENT_MATRIX__RUNNER_AND_REFERENCE_SL_VISIBLE_NO_PROMOTION"
    : "FAIL_GATE78_PAIR_TWO_SIDED_LIMITED_REENTRY_ENHANCEMENT_MATRIX";

  const artifacts = {
    adapterSummaryRows: toRepoRelative(path.join(options.artifactDir, "adapter-summary.rows.json")),
    weeklyEquityRows: toRepoRelative(path.join(options.artifactDir, "weekly-equity-truth.rows.json")),
    annualRows: toRepoRelative(path.join(options.artifactDir, "annual-summary.rows.json")),
    expansionAttributionRows: toRepoRelative(path.join(options.artifactDir, "expansion-attribution-vs-adverse-focus.rows.json")),
    fillSideAttributionRows: toRepoRelative(path.join(options.artifactDir, "fill-side-attribution.rows.json")),
    runnerContributionRows: toRepoRelative(path.join(options.artifactDir, "runner-contribution.rows.json")),
    runnerRankingRows: toRepoRelative(path.join(options.artifactDir, "runner-ranking.rows.json")),
    rightTailRetentionRows: toRepoRelative(path.join(options.artifactDir, "right-tail-retention.rows.json")),
    accountEmergencySlRows: toRepoRelative(path.join(options.artifactDir, "account-emergency-sl-attribution.rows.json")),
    failureAnatomyRows: toRepoRelative(path.join(options.artifactDir, "failure-anatomy.rows.json")),
    resetCountWeeklyRows: toRepoRelative(path.join(options.artifactDir, "reset-count-week.rows.json")),
    resetCountPairRows: toRepoRelative(path.join(options.artifactDir, "reset-count-pair.rows.json")),
    tailConcentrationPairRows: toRepoRelative(path.join(options.artifactDir, "tail-concentration-pair.rows.json")),
    tailConcentrationCurrencyRows: toRepoRelative(path.join(options.artifactDir, "tail-concentration-currency.rows.json")),
    commandReceipt: toRepoRelative(path.join(options.artifactDir, "command-receipt.json")),
    summaryJson: toRepoRelative(path.join(options.artifactDir, "gate78-summary.json")),
    shaIdentity: toRepoRelative(path.join(options.artifactDir, "gate78-sha256.txt")),
    report: toRepoRelative(options.reportPath),
  };

  const commandReceipt = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    mode: "implementation_research_limited_reentry_enhancement_no_promotion",
    matrix_contract: {
      spacing_adr: SPACING_ADR,
      pair_reset_limit_per_week: PAIR_RESET_LIMIT,
      limited_reentry_targets: LIMITED_REENTRY_TARGETS,
      final_reset_runner_fractions: FINAL_RESET_RUNNER_FRACTIONS,
      account_emergency_sl_bands: ACCOUNT_EMERGENCY_SL_BANDS,
      selected_runner_for_account_emergency_sl: bestRunnerRule.rule_id,
      unbounded_parameter_search_started: false,
    },
  };

  const summary = {
    gate_id: GATE_ID,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    command: COMMAND,
    verdict,
    purpose: "test whether limited pair reentry can preserve survivability while restoring some right-tail participation, without broad search or promotion",
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
      gate77_limited_reentry_baselines: LIMITED_REENTRY_TARGETS,
      final_reset_runner_fractions: FINAL_RESET_RUNNER_FRACTIONS,
      account_emergency_sl_bands: ACCOUNT_EMERGENCY_SL_BANDS,
      selected_runner_for_account_emergency_sl: bestRunnerRule.rule_id,
      fixed_rule_count: rules.length,
    },
    best_adapter_by_final_equity: bestByEquity,
    best_final_reset_runner_by_gate78_research_rank: runnerRankingRows[0] ?? null,
    adverse_focus_baseline: focus,
    gate76_best_no_limit_t150: adapterByRule.get(GATE76_T150_RULE_ID) ?? null,
    gate77_t075_l3: adapterByRule.get(GATE77_T075_L3_RULE_ID) ?? null,
    gate77_t100_l3: adapterByRule.get(GATE77_T100_L3_RULE_ID) ?? null,
    gate77_t125_l3: adapterByRule.get(GATE77_T125_L3_RULE_ID) ?? null,
    runner_contribution_attribution: runnerRows,
    runner_failure_anatomy: failureRows,
    right_tail_retention_loss_vs_t150: rightTailRows,
    account_emergency_sl_reference_attribution: accountEmergencyRows,
    validation,
    artifacts,
  };

  await writeJson(path.join(options.artifactDir, "adapter-summary.rows.json"), adapterRows);
  await writeJson(path.join(options.artifactDir, "weekly-equity-truth.rows.json"), withHashes(weeklyRows));
  await writeJson(path.join(options.artifactDir, "annual-summary.rows.json"), annual);
  await writeJson(path.join(options.artifactDir, "expansion-attribution-vs-adverse-focus.rows.json"), expansionRows);
  await writeJson(path.join(options.artifactDir, "fill-side-attribution.rows.json"), fillAttributionRows);
  await writeJson(path.join(options.artifactDir, "runner-contribution.rows.json"), runnerRows);
  await writeJson(path.join(options.artifactDir, "runner-ranking.rows.json"), runnerRankingRows);
  await writeJson(path.join(options.artifactDir, "right-tail-retention.rows.json"), rightTailRows);
  await writeJson(path.join(options.artifactDir, "account-emergency-sl-attribution.rows.json"), accountEmergencyRows);
  await writeJson(path.join(options.artifactDir, "failure-anatomy.rows.json"), failureRows);
  await writeJson(path.join(options.artifactDir, "reset-count-week.rows.json"), withHashes(resetRows.weekly));
  await writeJson(path.join(options.artifactDir, "reset-count-pair.rows.json"), withHashes(resetRows.pair));
  await writeJson(path.join(options.artifactDir, "tail-concentration-pair.rows.json"), withHashes(tails.byPair));
  await writeJson(path.join(options.artifactDir, "tail-concentration-currency.rows.json"), withHashes(tails.byCurrency));
  await writeJson(path.join(options.artifactDir, "command-receipt.json"), commandReceipt);
  await writeJson(path.join(options.artifactDir, "gate78-summary.json"), summary);
  await writeText(options.reportPath, renderReport({ summary, adapterRows, failureRows, runnerRankingRows, rightTailRows, accountEmergencyRows }));
  await writeShaManifest(path.join(options.artifactDir, "gate78-sha256.txt"), GATE_ID, COMMAND, [
    { label: "adapter_summary_rows", path: path.join(options.artifactDir, "adapter-summary.rows.json") },
    { label: "weekly_equity_rows", path: path.join(options.artifactDir, "weekly-equity-truth.rows.json") },
    { label: "annual_rows", path: path.join(options.artifactDir, "annual-summary.rows.json") },
    { label: "expansion_attribution_rows", path: path.join(options.artifactDir, "expansion-attribution-vs-adverse-focus.rows.json") },
    { label: "fill_side_attribution_rows", path: path.join(options.artifactDir, "fill-side-attribution.rows.json") },
    { label: "runner_contribution_rows", path: path.join(options.artifactDir, "runner-contribution.rows.json") },
    { label: "runner_ranking_rows", path: path.join(options.artifactDir, "runner-ranking.rows.json") },
    { label: "right_tail_retention_rows", path: path.join(options.artifactDir, "right-tail-retention.rows.json") },
    { label: "account_emergency_sl_rows", path: path.join(options.artifactDir, "account-emergency-sl-attribution.rows.json") },
    { label: "failure_anatomy_rows", path: path.join(options.artifactDir, "failure-anatomy.rows.json") },
    { label: "reset_count_week_rows", path: path.join(options.artifactDir, "reset-count-week.rows.json") },
    { label: "reset_count_pair_rows", path: path.join(options.artifactDir, "reset-count-pair.rows.json") },
    { label: "tail_concentration_pair_rows", path: path.join(options.artifactDir, "tail-concentration-pair.rows.json") },
    { label: "tail_concentration_currency_rows", path: path.join(options.artifactDir, "tail-concentration-currency.rows.json") },
    { label: "command_receipt", path: path.join(options.artifactDir, "command-receipt.json") },
    { label: "summary_json", path: path.join(options.artifactDir, "gate78-summary.json") },
    { label: "report", path: options.reportPath },
  ]);

  console.log(verdict);
  console.log(JSON.stringify({
    validation,
    best_adapter_by_final_equity: bestByEquity,
    best_final_reset_runner_by_gate78_research_rank: summary.best_final_reset_runner_by_gate78_research_rank,
    gate77_t100_l3: summary.gate77_t100_l3,
    account_emergency_sl_reference_attribution: accountEmergencyRows,
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
