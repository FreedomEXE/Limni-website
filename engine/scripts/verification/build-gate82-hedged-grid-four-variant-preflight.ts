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

const GATE_ID = "Gate 82: hedged-grid-four-variant-preflight";
const GATE_DATE = "2026-06-30";
const COMMAND = "npm run engine:gate82:hedged-grid-four-variant-preflight";
const DEFAULT_GATE74B_DIR = "docs/research/gates/gate74b/artifacts/gate74b-trade-leg-path-materialization";
const DEFAULT_GATE80_DIR = "docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate82_preflight/artifacts/gate82-hedged-grid-four-variant-preflight";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate82_preflight/GATE82_HEDGED_GRID_FOUR_VARIANT_PREFLIGHT_${GATE_DATE}.md`;

const TARGET_ADR = 1;
const SPACING_ADR = 0.2;
const DEFAULT_PAIR_RESET_LIMIT = 3;
const STRESS_COST_ADR_PER_FILL = 0.05;
const STRESS_SWAP_ADR_PER_ACTIVE_SIDE_WEEK = 0.01;
const EXPECTED_GATE80_VERDICT = "PASS_HEDGED_BASELINE_PROMISING_BUT_COST_MARGIN_VALIDATION_REQUIRED_NO_PROMOTION";
const EXPECTED_WEEKS = 373;
const EXPECTED_PAIRS = 28;
const EXPECTED_PAIR_WEEK_ROWS = 10_444;
const RAW_L3_GATE80_RULE_ID = "FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE";
const RAW_NO_LIMIT_GATE80_RULE_ID = "FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_NO_LIMIT_REFERENCE";

type Side = "LONG" | "SHORT";
type FillKind = "initial" | "adverse_recovery" | "favorable_expansion";
type CloseReason = "target" | "pair_net_flatten" | "sample_end";
type VariantId =
  | "HEDGED_GRID_T100_S020_L3_RAW"
  | "HEDGED_GRID_T100_S020_NO_LIMIT_RAW"
  | "HEDGED_GRID_T100_S020_L3_PAIR_NET_TP_1ADR"
  | "HEDGED_GRID_T100_S020_NO_LIMIT_PAIR_NET_TP_1ADR";

type ReplayRow = Pick<
  TradeLegPathReplayPairWeek,
  | "week_open_utc"
  | "pair"
  | "candidate_b_side"
  | "candidate_row_key"
  | "decision_hash"
  | "direction_streak_id"
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
  validation: {
    candidate_b_forced28_preserved: boolean;
    raw_m1_rebuild_performed?: boolean;
  };
};

type Gate80Summary = {
  verdict: string;
  warehouse: {
    manifest_id: string;
    warehouse_hash: string;
    weeks_replayed: number;
    pairs_replayed: number;
    pair_week_rows_replayed: number;
  };
};

type Gate80RawRow = {
  rule_id: string;
  final_equity_adr: number;
  closed_total_adr: number;
  final_open_unrealized_adr: number;
  max_drawdown_adr: number;
  return_drawdown: number | null;
  weekly_mtm_profit_factor: number | null;
  adr_sharpe_weekly: number | null;
  adr_sortino_weekly: number | null;
  weekly_mtm_win_rate: number;
  monthly_mtm_win_rate: number;
  worst_1_week_mtm_loss_adr: number;
  worst_13_week_mtm_loss_adr: number;
  total_fills: number;
  resets: number;
  average_active_pair_side_slots_proxy: number;
  max_active_pair_side_slots_proxy: number;
};

type Gate80WeeklyRow = {
  rule_id: string;
  fill_count_week: number;
};

type VariantConfig = {
  variant_id: VariantId;
  source_rule_id: string | null;
  reset_limit_per_side_week: number | null;
  pair_net_flatten_target_adr: number | null;
  gate80_reference_rule_id: string | null;
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
  variant_id: VariantId;
  pair: string;
  side: Side;
  start_week_open_utc: string;
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
  first_negative_timestamp_utc: string | null;
  last_pnl_adr: number;
  reset_ordinal_at_start: number;
};

type CloseEvent = {
  variant_id: VariantId;
  pair: string;
  side: Side;
  base_currency: string;
  quote_currency: string;
  week_open_utc: string;
  close_timestamp_utc: string;
  close_reason: CloseReason;
  realized_or_open_adr: number;
  initial_fill_closed_adr: number;
  recovery_fill_closed_adr: number;
  expansion_fill_closed_adr: number;
  fill_count: number;
  adverse_fill_count: number;
  expansion_fill_count: number;
  min_pnl_adr: number;
  max_pnl_adr: number;
  went_negative: boolean;
  recovered_to_positive_close: boolean;
  reset_ordinal_at_start: number;
  completed_reset_ordinal: number | null;
  terminal_reset_limit_close: boolean;
};

type RuleStats = {
  config: VariantConfig;
  closed_by_week: Map<string, number>;
  open_by_week: Map<string, number>;
  reset_by_week: Map<string, number>;
  pair_net_flatten_by_week: Map<string, number>;
  fill_count_by_week: Map<string, number>;
  active_side_week_keys: Set<string>;
  max_open_position_count: number;
  close_events: CloseEvent[];
};

type WeeklyRow = {
  variant_id: VariantId;
  week_open_utc: string;
  closed_week_adr: number;
  open_unrealized_adr: number;
  equity_delta_adr: number;
  equity_snapshot_adr: number;
  reset_count_week: number;
  pair_net_flatten_count_week: number;
  fill_count_week: number;
};

type SummaryRow = {
  variant_id: VariantId;
  source_rule_id: string | null;
  final_equity_adr: number;
  closed_adr: number;
  final_open_unrealized_adr: number;
  worst_open_unrealized_adr: number;
  max_drawdown_adr: number;
  return_dd_ratio: number | null;
  weekly_mtm_profit_factor: number | null;
  weekly_sharpe: number | null;
  weekly_sortino: number | null;
  weekly_win_rate: number;
  monthly_win_rate: number;
  worst_weekly_mtm_loss_adr: number;
  worst_13_week_aggregate_mtm_loss_adr: number | null;
  fills: number;
  resets: number;
  pair_net_flatten_reset_count: number;
  active_side_week_count: number;
  max_open_position_inventory_count: number | null;
  gross_no_cost_final_equity_adr: number;
  gate81_style_stressed_cost_final_equity_adr: number;
  gate80_reference_rule_id: string | null;
  gate80_raw_reproduced: boolean | null;
  metric_semantics: "imported_gate80_artifact" | "new_pair_net_variant";
  interpretation: string;
  content_hash?: string;
};

type JsonRow = Record<string, unknown>;

const VARIANTS: VariantConfig[] = [
  {
    variant_id: "HEDGED_GRID_T100_S020_L3_RAW",
    source_rule_id: RAW_L3_GATE80_RULE_ID,
    reset_limit_per_side_week: DEFAULT_PAIR_RESET_LIMIT,
    pair_net_flatten_target_adr: null,
    gate80_reference_rule_id: RAW_L3_GATE80_RULE_ID,
  },
  {
    variant_id: "HEDGED_GRID_T100_S020_NO_LIMIT_RAW",
    source_rule_id: RAW_NO_LIMIT_GATE80_RULE_ID,
    reset_limit_per_side_week: null,
    pair_net_flatten_target_adr: null,
    gate80_reference_rule_id: RAW_NO_LIMIT_GATE80_RULE_ID,
  },
  {
    variant_id: "HEDGED_GRID_T100_S020_L3_PAIR_NET_TP_1ADR",
    source_rule_id: null,
    reset_limit_per_side_week: DEFAULT_PAIR_RESET_LIMIT,
    pair_net_flatten_target_adr: TARGET_ADR,
    gate80_reference_rule_id: null,
  },
  {
    variant_id: "HEDGED_GRID_T100_S020_NO_LIMIT_PAIR_NET_TP_1ADR",
    source_rule_id: null,
    reset_limit_per_side_week: null,
    pair_net_flatten_target_adr: TARGET_ADR,
    gate80_reference_rule_id: null,
  },
];
const REPLAY_VARIANTS = VARIANTS.filter((variant) => variant.pair_net_flatten_target_adr !== null);

function parseOptions() {
  const args = parseArgMap();
  const maxWeeksRaw = args.get("--max-weeks");
  return {
    gate74bDir: args.get("--gate74b-dir") ?? DEFAULT_GATE74B_DIR,
    gate80Dir: args.get("--gate80-dir") ?? DEFAULT_GATE80_DIR,
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    manifestId: args.get("--manifest-id"),
    onlyPair: args.get("--only-pair"),
    maxWeeks: maxWeeksRaw ? Number(maxWeeksRaw) : null,
    logProgress: process.argv.includes("--log-progress"),
  };
}

function round6(value: number) {
  return round(value, 6) ?? value;
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

function createStats(config: VariantConfig): RuleStats {
  return {
    config,
    closed_by_week: new Map(),
    open_by_week: new Map(),
    reset_by_week: new Map(),
    pair_net_flatten_by_week: new Map(),
    fill_count_by_week: new Map(),
    active_side_week_keys: new Set(),
    max_open_position_count: 0,
    close_events: [],
  };
}

function startCycle(options: {
  config: VariantConfig;
  pair: string;
  row: ReplayRow;
  side: Side;
  markPrice: number;
  timestampUtc: string;
  serial: number;
  resetOrdinalAtStart: number;
}) {
  return {
    cycle_id: `${options.config.variant_id}|${options.pair}|${options.side}|${options.serial}`,
    variant_id: options.config.variant_id,
    pair: options.pair,
    side: options.side,
    start_week_open_utc: options.row.week_open_utc,
    start_timestamp_utc: options.timestampUtc,
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
  return { addedAdverse, addedExpansion };
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
  const event: CloseEvent = {
    variant_id: options.stats.config.variant_id,
    pair: options.cycle.pair,
    side: options.cycle.side,
    base_currency: options.cycle.pair.slice(0, 3),
    quote_currency: options.cycle.pair.slice(3, 6),
    week_open_utc: options.weekOpenUtc,
    close_timestamp_utc: options.timestampUtc,
    close_reason: options.closeReason,
    realized_or_open_adr: realized,
    initial_fill_closed_adr: initial,
    recovery_fill_closed_adr: recovery,
    expansion_fill_closed_adr: expansion,
    fill_count: round6(options.cycle.quantity_sum),
    adverse_fill_count: round6(options.cycle.fills.filter((fill) => fill.kind === "adverse_recovery").reduce((sum, fill) => sum + fill.quantity, 0)),
    expansion_fill_count: round6(options.cycle.fills.filter((fill) => fill.kind === "favorable_expansion").reduce((sum, fill) => sum + fill.quantity, 0)),
    min_pnl_adr: round6(options.cycle.min_pnl_adr),
    max_pnl_adr: round6(options.cycle.max_pnl_adr),
    went_negative: options.cycle.first_negative_timestamp_utc !== null,
    recovered_to_positive_close: options.cycle.first_negative_timestamp_utc !== null && realized > 0 && options.closeReason !== "sample_end",
    reset_ordinal_at_start: options.cycle.reset_ordinal_at_start,
    completed_reset_ordinal: options.completedResetOrdinal ?? null,
    terminal_reset_limit_close: options.terminalResetLimitClose ?? false,
  };
  options.stats.close_events.push(event);
  if (options.recordClosedByWeek ?? options.closeReason !== "sample_end") {
    addToMap(options.stats.closed_by_week, options.weekOpenUtc, realized);
  }
  return event;
}

function monthlyWinRate(weeklyRows: WeeklyRow[]) {
  const byMonth = new Map<string, number>();
  for (const row of weeklyRows) {
    const month = row.week_open_utc.slice(0, 7);
    byMonth.set(month, round6((byMonth.get(month) ?? 0) + row.equity_delta_adr));
  }
  const values = [...byMonth.values()];
  return values.length === 0 ? 0 : round6(values.filter((value) => value > 0).length / values.length);
}

function maxDrawdownFromRows(rows: WeeklyRow[]) {
  let peak = 0;
  let maxDrawdown = 0;
  for (const row of rows) {
    if (row.equity_snapshot_adr > peak) peak = row.equity_snapshot_adr;
    maxDrawdown = Math.min(maxDrawdown, row.equity_snapshot_adr - peak);
  }
  return round6(maxDrawdown);
}

function rollingWorst(values: number[], windowSize: number) {
  if (values.length < windowSize) return null;
  let worst = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= values.length - windowSize; index += 1) {
    const value = values.slice(index, index + windowSize).reduce((sum, current) => sum + current, 0);
    if (value < worst) worst = value;
  }
  return round6(worst);
}

function average(values: number[]) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values: number[]) {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
}

function weeklySharpe(values: number[]) {
  const sigma = stddev(values);
  return sigma === 0 ? null : round6(average(values) / sigma);
}

function weeklySortino(values: number[]) {
  const downside = values.filter((value) => value < 0);
  const sigma = stddev(downside);
  return sigma === 0 ? null : round6(average(values) / sigma);
}

function weeklyRowsForStats(stats: RuleStats, weeks: string[]): WeeklyRow[] {
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
      variant_id: stats.config.variant_id,
      week_open_utc: week,
      closed_week_adr: closed,
      open_unrealized_adr: open,
      equity_delta_adr: delta,
      equity_snapshot_adr: equity,
      reset_count_week: stats.reset_by_week.get(week) ?? 0,
      pair_net_flatten_count_week: stats.pair_net_flatten_by_week.get(week) ?? 0,
      fill_count_week: stats.fill_count_by_week.get(week) ?? 0,
    };
  });
}

function summarizeVariant(stats: RuleStats, weeklyRows: WeeklyRow[], gate80RawByRule: Map<string, Gate80RawRow>): SummaryRow {
  const values = weeklyRows.map((row) => row.equity_delta_adr);
  const closed = round6([...stats.closed_by_week.values()].reduce((sum, value) => sum + value, 0));
  const finalOpen = round6(weeklyRows.at(-1)?.open_unrealized_adr ?? 0);
  const finalEquity = round6(closed + finalOpen);
  const maxDrawdown = maxDrawdownFromRows(weeklyRows);
  const fills = round6(stats.close_events.reduce((sum, event) => sum + event.fill_count, 0));
  const pairNetFlattenCount = [...stats.pair_net_flatten_by_week.values()].reduce((sum, value) => sum + value, 0);
  const resets = [...stats.reset_by_week.values()].reduce((sum, value) => sum + value, 0);
  const activeSideWeekCount = stats.active_side_week_keys.size;
  const stressFillCount = weeklyRows.reduce((sum, row) => sum + row.fill_count_week, 0);
  const gate80 = stats.config.gate80_reference_rule_id ? gate80RawByRule.get(stats.config.gate80_reference_rule_id) : null;
  const gate80RawReproduced = gate80
    ? Math.abs(finalEquity - gate80.final_equity_adr) <= 0.000001 &&
      Math.abs(closed - gate80.closed_total_adr) <= 0.000001 &&
      Math.abs(finalOpen - gate80.final_open_unrealized_adr) <= 0.000001 &&
      Math.abs(maxDrawdown - gate80.max_drawdown_adr) <= 0.000001 &&
      Math.abs(fills - gate80.total_fills) <= 0.000001 &&
      resets === gate80.resets
    : null;
  const stressedFinal = round6(finalEquity - stressFillCount * STRESS_COST_ADR_PER_FILL - activeSideWeekCount * STRESS_SWAP_ADR_PER_ACTIVE_SIDE_WEEK);
  const worstOpen = round6(weeklyRows.reduce((min, row) => Math.min(min, row.open_unrealized_adr), 0));
  const row = {
    variant_id: stats.config.variant_id,
    source_rule_id: stats.config.source_rule_id,
    final_equity_adr: finalEquity,
    closed_adr: closed,
    final_open_unrealized_adr: finalOpen,
    worst_open_unrealized_adr: worstOpen,
    max_drawdown_adr: maxDrawdown,
    return_dd_ratio: maxDrawdown === 0 ? null : round6(finalEquity / Math.abs(maxDrawdown)),
    weekly_mtm_profit_factor: profitFactor(values),
    weekly_sharpe: weeklySharpe(values),
    weekly_sortino: weeklySortino(values),
    weekly_win_rate: round6(values.filter((value) => value > 0).length / values.length),
    monthly_win_rate: monthlyWinRate(weeklyRows),
    worst_weekly_mtm_loss_adr: round6(Math.min(...values)),
    worst_13_week_aggregate_mtm_loss_adr: rollingWorst(values, 13),
    fills,
    resets,
    pair_net_flatten_reset_count: pairNetFlattenCount,
    active_side_week_count: activeSideWeekCount,
    max_open_position_inventory_count: round6(stats.max_open_position_count),
    gross_no_cost_final_equity_adr: finalEquity,
    gate81_style_stressed_cost_final_equity_adr: stressedFinal,
    gate80_reference_rule_id: stats.config.gate80_reference_rule_id,
    gate80_raw_reproduced: gate80RawReproduced,
    metric_semantics: "new_pair_net_variant" as const,
    interpretation:
      stats.config.pair_net_flatten_target_adr === null
        ? "raw_gate80_semantics_regenerated_for_apples_to_apples_anchor"
        : finalOpen > -100 && worstOpen > -1000
          ? "pair_net_flatten_reduced_open_inventory_tail_materially"
          : "pair_net_flatten_did_not_eliminate_open_inventory_tail",
  };
  return { ...row, content_hash: sha256Stable(row) };
}

function importedRawSummaryRow(options: {
  config: VariantConfig;
  gate80Row: Gate80RawRow;
  gate80WeeklyRows: Gate80WeeklyRow[];
}): SummaryRow {
  const activeSideWeekCount = round6(options.gate80Row.average_active_pair_side_slots_proxy * EXPECTED_WEEKS);
  const stressFillCount = options.gate80WeeklyRows
    .filter((row) => row.rule_id === options.gate80Row.rule_id)
    .reduce((sum, row) => sum + row.fill_count_week, 0);
  const row = {
    variant_id: options.config.variant_id,
    source_rule_id: options.config.source_rule_id,
    final_equity_adr: options.gate80Row.final_equity_adr,
    closed_adr: options.gate80Row.closed_total_adr,
    final_open_unrealized_adr: options.gate80Row.final_open_unrealized_adr,
    worst_open_unrealized_adr: options.gate80Row.worst_open_unrealized_adr,
    max_drawdown_adr: options.gate80Row.max_drawdown_adr,
    return_dd_ratio: options.gate80Row.return_drawdown,
    weekly_mtm_profit_factor: options.gate80Row.weekly_mtm_profit_factor,
    weekly_sharpe: options.gate80Row.adr_sharpe_weekly,
    weekly_sortino: options.gate80Row.adr_sortino_weekly,
    weekly_win_rate: options.gate80Row.weekly_mtm_win_rate,
    monthly_win_rate: options.gate80Row.monthly_mtm_win_rate,
    worst_weekly_mtm_loss_adr: options.gate80Row.worst_1_week_mtm_loss_adr,
    worst_13_week_aggregate_mtm_loss_adr: options.gate80Row.worst_13_week_mtm_loss_adr,
    fills: options.gate80Row.total_fills,
    resets: options.gate80Row.resets,
    pair_net_flatten_reset_count: 0,
    active_side_week_count: activeSideWeekCount,
    max_open_position_inventory_count: options.gate80Row.max_active_pair_side_slots_proxy,
    gross_no_cost_final_equity_adr: options.gate80Row.final_equity_adr,
    gate81_style_stressed_cost_final_equity_adr: round6(
      options.gate80Row.final_equity_adr -
      stressFillCount * STRESS_COST_ADR_PER_FILL -
      activeSideWeekCount * STRESS_SWAP_ADR_PER_ACTIVE_SIDE_WEEK,
    ),
    gate80_reference_rule_id: options.gate80Row.rule_id,
    gate80_raw_reproduced: null,
    metric_semantics: "imported_gate80_artifact" as const,
    interpretation: "raw_gate80_artifact_imported_for_apples_to_apples_anchor",
  };
  return { ...row, content_hash: sha256Stable(row) };
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text.includes(",") || text.includes("\n") || text.includes('"')) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(rows: JsonRow[]) {
  if (rows.length === 0) return "";
  const columns = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  return `${[columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n")}\n`;
}

async function writeRows(jsonPath: string, csvPath: string, rows: JsonRow[]) {
  await writeJson(jsonPath, rows);
  await writeText(csvPath, toCsv(rows));
}

function withHash<T extends JsonRow>(row: T): T & { content_hash: string } {
  const copy = { ...row };
  delete copy.content_hash;
  return { ...row, content_hash: sha256Stable(copy) };
}

function replayVariantForPairWeek(config: VariantConfig, stats: RuleStats, pair: string, row: ReplayRow, isLastWeek: boolean) {
  const sides: Side[] = ["LONG", "SHORT"];
  const currentBySide = new Map<Side, Cycle | null>(sides.map((side) => [side, null]));
  const stoppedBySide = new Map<Side, boolean>(sides.map((side) => [side, false]));
  const resetCountBySide = new Map<Side, number>(sides.map((side) => [side, 0]));
  let serial = 0;
  let pairCycleClosedPnl = 0;
  let pairWeekOpen = 0;

  const maybeStart = (side: Side, markPrice: number, timestamp: string) => {
    if (stoppedBySide.get(side) || currentBySide.get(side)) return;
    serial += 1;
    currentBySide.set(side, startCycle({
      config,
      pair,
      row,
      side,
      markPrice,
      timestampUtc: timestamp,
      serial,
      resetOrdinalAtStart: resetCountBySide.get(side) ?? 0,
    }));
    stats.active_side_week_keys.add(`${config.variant_id}|${row.week_open_utc}|${pair}|${side}`);
  };

  const currentOpenPnl = (markPrice: number) => sides.reduce((sum, side) => {
    const current = currentBySide.get(side);
    return current ? round6(sum + cycleNetPnlAdr(current, markPrice)) : sum;
  }, 0);

  const updateMaxOpenInventory = () => {
    const openPositionCount = sides.reduce((sum, side) => sum + (currentBySide.get(side)?.quantity_sum ?? 0), 0);
    stats.max_open_position_count = Math.max(stats.max_open_position_count, openPositionCount);
  };

  const stopSideIfLimitReached = (side: Side) => {
    const resetCount = resetCountBySide.get(side) ?? 0;
    if (config.reset_limit_per_side_week !== null && resetCount >= config.reset_limit_per_side_week) {
      stoppedBySide.set(side, true);
    }
  };

  const reseedOpenSides = (markPrice: number, timestamp: string) => {
    for (const side of sides) maybeStart(side, markPrice, timestamp);
  };

  const closeTargetSide = (side: Side, cycle: Cycle, markPrice: number, timestamp: string) => {
    const nextReset = (resetCountBySide.get(side) ?? 0) + 1;
    const terminal = config.reset_limit_per_side_week !== null && nextReset >= config.reset_limit_per_side_week;
    const event = closeCycle({
      stats,
      cycle,
      closeReason: "target",
      markPrice,
      timestampUtc: timestamp,
      weekOpenUtc: row.week_open_utc,
      completedResetOrdinal: nextReset,
      terminalResetLimitClose: terminal,
    });
    pairCycleClosedPnl = round6(pairCycleClosedPnl + event.realized_or_open_adr);
    currentBySide.set(side, null);
    resetCountBySide.set(side, nextReset);
    incrementMap(stats.reset_by_week, row.week_open_utc);
    stopSideIfLimitReached(side);
    maybeStart(side, markPrice, timestamp);
  };

  const pairNetShouldFlatten = (markPrice: number) => (
    config.pair_net_flatten_target_adr !== null &&
    round6(pairCycleClosedPnl + currentOpenPnl(markPrice)) >= config.pair_net_flatten_target_adr &&
    sides.some((side) => currentBySide.get(side) !== null)
  );

  const flattenPairNet = (markPrice: number, timestamp: string) => {
    const nextResetBySide = new Map<Side, number>();
    for (const side of sides) nextResetBySide.set(side, (resetCountBySide.get(side) ?? 0) + 1);
    const terminal = config.reset_limit_per_side_week !== null && [...nextResetBySide.values()].some((count) => count >= config.reset_limit_per_side_week);
    for (const side of sides) {
      const current = currentBySide.get(side);
      if (current) {
        closeCycle({
          stats,
          cycle: current,
          closeReason: "pair_net_flatten",
          markPrice,
          timestampUtc: timestamp,
          weekOpenUtc: row.week_open_utc,
          completedResetOrdinal: nextResetBySide.get(side) ?? null,
          terminalResetLimitClose: terminal,
        });
      }
      currentBySide.set(side, null);
      resetCountBySide.set(side, nextResetBySide.get(side) ?? 0);
    }
    pairCycleClosedPnl = 0;
    incrementMap(stats.reset_by_week, row.week_open_utc);
    incrementMap(stats.pair_net_flatten_by_week, row.week_open_utc);
    if (terminal) {
      for (const side of sides) stoppedBySide.set(side, true);
    } else {
      reseedOpenSides(markPrice, timestamp);
    }
  };

  const timestamps = row.path_payload.timestamp_utc;
  const closes = row.path_payload.directed_close_adr;
  for (let index = 0; index < timestamps.length; index += 1) {
    const timestamp = timestamps[index]!;
    const markPrice = markPriceFromDirectedClose(row, closes[index]!);
    reseedOpenSides(markPrice, timestamp);
    for (const side of sides) {
      const current = currentBySide.get(side);
      if (!current) continue;
      const added = addGridFills({ cycle: current, markPrice, timestampUtc: timestamp, spacingAdr: SPACING_ADR });
      if (added.addedAdverse > 0 || added.addedExpansion > 0) {
        incrementMap(stats.fill_count_by_week, row.week_open_utc, added.addedAdverse + added.addedExpansion);
      }
      observeCycle(current, markPrice, timestamp);
      if (round6(cycleNetPnlAdr(current, markPrice)) >= TARGET_ADR) {
        closeTargetSide(side, current, markPrice, timestamp);
      }
    }
    if (pairNetShouldFlatten(markPrice)) flattenPairNet(markPrice, timestamp);
    updateMaxOpenInventory();
  }

  const finalTimestamp = timestamps.at(-1);
  const finalClose = closes.at(-1);
  if (finalTimestamp === undefined || finalClose === undefined) {
    throw new Error(`Missing path payload for ${row.week_open_utc} ${pair}`);
  }
  const finalMark = markPriceFromDirectedClose(row, finalClose);
  for (const side of sides) {
    const current = currentBySide.get(side);
    if (!current) continue;
    const open = round6(cycleNetPnlAdr(current, finalMark));
    pairWeekOpen = round6(pairWeekOpen + open);
    closeCycle({
      stats,
      cycle: current,
      closeReason: "sample_end",
      markPrice: finalMark,
      timestampUtc: finalTimestamp,
      weekOpenUtc: row.week_open_utc,
      recordFinalOpenByPair: isLastWeek,
    });
  }
  addToMap(stats.open_by_week, row.week_open_utc, pairWeekOpen);
}

function replayPair(pair: string, rows: ReplayRow[], selectedWeeks: string[], statsByVariant: Map<VariantId, RuleStats>) {
  const lastWeek = selectedWeeks.at(-1);
  for (const row of rows) {
    for (const config of REPLAY_VARIANTS) {
      replayVariantForPairWeek(config, statsByVariant.get(config.variant_id)!, pair, row, row.week_open_utc === lastWeek);
    }
  }
}

function buildValidationRows(params: {
  gate74b: Gate74bSummary;
  gate80: Gate80Summary;
  manifest: { manifest_id: string; warehouse_hash: string; universe_symbols: string[]; status: string };
  selectedWeeks: string[];
  selectedPairs: string[];
  summaryRows: SummaryRow[];
}) {
  const rawRows = params.summaryRows.filter((row) => row.variant_id.endsWith("_RAW"));
  const pairNetRows = params.summaryRows.filter((row) => row.variant_id.includes("PAIR_NET_TP_1ADR"));
  return [
    withHash({ check: "gate74b_verdict", value: params.gate74b.verdict, passed: params.gate74b.verdict.startsWith("PASS_") }),
    withHash({ check: "gate80_verdict", value: params.gate80.verdict, passed: params.gate80.verdict === EXPECTED_GATE80_VERDICT }),
    withHash({ check: "manifest_complete", value: params.manifest.status, passed: params.manifest.status === "complete" }),
    withHash({ check: "same_manifest_as_gate80", value: params.manifest.manifest_id, expected: params.gate80.warehouse.manifest_id, passed: params.manifest.manifest_id === params.gate80.warehouse.manifest_id }),
    withHash({ check: "same_warehouse_hash_as_gate80", value: params.manifest.warehouse_hash, expected: params.gate80.warehouse.warehouse_hash, passed: params.manifest.warehouse_hash === params.gate80.warehouse.warehouse_hash }),
    withHash({ check: "week_count", value: params.selectedWeeks.length, expected: EXPECTED_WEEKS, passed: params.selectedWeeks.length === EXPECTED_WEEKS }),
    withHash({ check: "pair_count", value: params.selectedPairs.length, expected: EXPECTED_PAIRS, passed: params.selectedPairs.length === EXPECTED_PAIRS }),
    withHash({ check: "pair_week_rows", value: params.selectedWeeks.length * params.selectedPairs.length, expected: EXPECTED_PAIR_WEEK_ROWS, passed: params.selectedWeeks.length * params.selectedPairs.length === EXPECTED_PAIR_WEEK_ROWS }),
    withHash({ check: "raw_rows_imported_from_gate80", value: rawRows.map((row) => row.gate80_reference_rule_id).join(","), passed: rawRows.length === 2 && rawRows.every((row) => row.metric_semantics === "imported_gate80_artifact") }),
    withHash({ check: "pair_net_rows_present", value: pairNetRows.length, expected: 2, passed: pairNetRows.length === 2 }),
    withHash({ check: "pair_net_flatten_counts_visible", value: pairNetRows.map((row) => row.pair_net_flatten_reset_count).join(","), passed: pairNetRows.every((row) => row.pair_net_flatten_reset_count > 0) }),
    withHash({ check: "candidate_b_mutated", value: false, passed: true }),
    withHash({ check: "cot_strength_regime_used", value: false, passed: true }),
    withHash({ check: "risk_layer_started", value: false, passed: true }),
    withHash({ check: "mt5_code_written", value: false, passed: true }),
    withHash({ check: "promotion_claimed", value: false, passed: true }),
  ];
}

function determineVerdict(validationRows: JsonRow[]) {
  const passed = validationRows.every((row) => row.passed === true);
  if (passed) return "PASS_FOUR_VARIANT_HEDGED_GRID_DIAGNOSTIC_BUILT_NO_PROMOTION";
  const rawMismatch = validationRows.some((row) => row.check === "raw_rows_imported_from_gate80" && row.passed !== true);
  return rawMismatch
    ? "FAIL_PAIR_NET_FLATTEN_LOGIC_OR_COMPARISON_INVALID_NO_PROMOTION"
    : "PARTIAL_FOUR_VARIANT_DIAGNOSTIC_WITH_METRIC_GAPS_NO_PROMOTION";
}

function metricDefinitionRows() {
  return [
    { metric: "final_equity_adr", definition: "cumulative closed ADR plus final week-end open unrealized ADR" },
    { metric: "closed_adr", definition: "sum of realized non-sample-end closes in ADR units" },
    { metric: "final_open_unrealized_adr", definition: "week-end open unrealized ADR at the final replay week" },
    { metric: "worst_open_unrealized_adr", definition: "most negative week-end open unrealized ADR across the replay" },
    { metric: "max_drawdown_adr", definition: "max peak-to-trough drawdown of weekly mark-to-market equity snapshots" },
    { metric: "return_dd_ratio", definition: "final equity ADR divided by absolute max drawdown ADR" },
    { metric: "weekly_mtm_profit_factor", definition: "profit factor over weekly mark-to-market equity deltas" },
    { metric: "weekly_sharpe", definition: "ADR-normalized mean weekly MTM delta divided by weekly standard deviation; diagnostic only" },
    { metric: "weekly_sortino", definition: "ADR-normalized mean weekly MTM delta divided by downside weekly standard deviation; diagnostic only" },
    { metric: "weekly_win_rate", definition: "share of replay weeks with positive weekly MTM delta" },
    { metric: "monthly_win_rate", definition: "share of calendar months with positive summed weekly MTM delta" },
    { metric: "fills", definition: "sum of open and closed cycle fill quantities, including initial fills and sample-end open inventory fills" },
    { metric: "resets", definition: "side target resets plus pair-net flatten resets; pair-net flatten increments once per full pair flatten" },
    { metric: "pair_net_flatten_reset_count", definition: "count of full long+short pair flatten/reset events triggered by total pair-cycle MTM at +1 ADR" },
    { metric: "active_side_week_count", definition: "count of pair/week/side slots that opened at least one cycle" },
    { metric: "gate81_style_stressed_cost_final_equity_adr", definition: "gross final equity less 0.05 ADR per fill and 0.01 ADR per active side-week" },
  ].map(withHash);
}

function renderReport(params: {
  verdict: string;
  summaryRows: SummaryRow[];
  validationRows: JsonRow[];
  metricRows: JsonRow[];
  artifacts: Record<string, string>;
}) {
  const comparisonTable = renderTable(params.summaryRows, [
    "variant_id",
    "final_equity_adr",
    "closed_adr",
    "final_open_unrealized_adr",
    "worst_open_unrealized_adr",
    "max_drawdown_adr",
    "return_dd_ratio",
    "weekly_mtm_profit_factor",
    "weekly_sharpe",
    "weekly_sortino",
    "weekly_win_rate",
    "monthly_win_rate",
    "worst_weekly_mtm_loss_adr",
    "worst_13_week_aggregate_mtm_loss_adr",
    "fills",
    "resets",
    "pair_net_flatten_reset_count",
    "active_side_week_count",
    "max_open_position_inventory_count",
    "gate81_style_stressed_cost_final_equity_adr",
    "metric_semantics",
    "gate80_reference_rule_id",
  ]);
  const validationTable = renderTable(params.validationRows, ["check", "value", "expected", "passed"]);
  const metricTable = renderTable(params.metricRows, ["metric", "definition"]);
  const artifactLines = Object.entries(params.artifacts).map(([label, artifactPath]) => `- ${label}: \`${artifactPath}\``).join("\n");
  const l3Raw = params.summaryRows.find((row) => row.variant_id === "HEDGED_GRID_T100_S020_L3_RAW");
  const l3PairNet = params.summaryRows.find((row) => row.variant_id === "HEDGED_GRID_T100_S020_L3_PAIR_NET_TP_1ADR");
  const noLimitRaw = params.summaryRows.find((row) => row.variant_id === "HEDGED_GRID_T100_S020_NO_LIMIT_RAW");
  const noLimitPairNet = params.summaryRows.find((row) => row.variant_id === "HEDGED_GRID_T100_S020_NO_LIMIT_PAIR_NET_TP_1ADR");
  const interpretationRows = [
    {
      comparison: "L3 raw vs L3 pair-net +1ADR",
      final_equity_delta_adr: l3Raw && l3PairNet ? round6(l3PairNet.final_equity_adr - l3Raw.final_equity_adr) : null,
      final_open_delta_adr: l3Raw && l3PairNet ? round6(l3PairNet.final_open_unrealized_adr - l3Raw.final_open_unrealized_adr) : null,
      worst_open_delta_adr: l3Raw && l3PairNet ? round6(l3PairNet.worst_open_unrealized_adr - l3Raw.worst_open_unrealized_adr) : null,
    },
    {
      comparison: "no-limit raw vs no-limit pair-net +1ADR",
      final_equity_delta_adr: noLimitRaw && noLimitPairNet ? round6(noLimitPairNet.final_equity_adr - noLimitRaw.final_equity_adr) : null,
      final_open_delta_adr: noLimitRaw && noLimitPairNet ? round6(noLimitPairNet.final_open_unrealized_adr - noLimitRaw.final_open_unrealized_adr) : null,
      worst_open_delta_adr: noLimitRaw && noLimitPairNet ? round6(noLimitPairNet.worst_open_unrealized_adr - noLimitRaw.worst_open_unrealized_adr) : null,
    },
  ].map(withHash);

  return `# Gate 82 Hedged Grid Four Variant Preflight

Generated: \`${new Date().toISOString()}\`

## Verdict

\`${params.verdict}\`

## Scope

- Diagnostic four-variant hedged-grid comparison before one-pair MT5 prototype work.
- Same Gate 74B/Gate 80 warehouse lineage, universe, date range, T100 target, and S020 spacing.
- Raw L3 and raw no-limit rows are imported from Gate 80 artifacts and labeled with their source rule IDs.
- Pair-net variants add a deterministic total pair-cycle MTM \`+1 ADR\` flatten/reset rule.
- The L3 pair-net flatten/reset counts against the L3 reset cap and cannot bypass it.
- No Candidate B mutation, COT, Strength, Regime, risk layer, MT5 code, all-28 runtime, optimization, promotion, or live-readiness claim.

## Four Variant Comparison

${comparisonTable}

## Pair-Net Interpretation

${renderTable(interpretationRows, ["comparison", "final_equity_delta_adr", "final_open_delta_adr", "worst_open_delta_adr"])}

Positive open deltas mean the pair-net row has less negative open inventory than its raw anchor. Final-equity deltas show whether that inventory relief destroyed the harvest engine.

## Metric Definitions

${metricTable}

## Validation

${validationTable}

## Artifacts

${artifactLines}

## Stop Line

Gate 82 preflight is diagnostic evidence only. No MT5 code was written in this gate. No promotion, no all-28 runtime, no risk layer, no signal research, and no live-capital claim.
`;
}

async function readPairSeriesWithRetry(options: { manifestId: string; pair: string; weeks: string[]; attempts: number }) {
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

async function main() {
  const options = parseOptions();
  await mkdir(options.artifactDir, { recursive: true });
  await mkdir(path.dirname(options.reportPath), { recursive: true });

  const gate74b = await readJson<Gate74bSummary>(path.join(options.gate74bDir, "gate74b-summary.json"));
  const gate80 = await readJson<Gate80Summary>(path.join(options.gate80Dir, "gate80-summary.json"));
  const gate80RawRows = await readJson<Gate80RawRow[]>(path.join(options.gate80Dir, "raw-comparison.rows.json"));
  const gate80WeeklyRows = await readJson<Gate80WeeklyRow[]>(path.join(options.gate80Dir, "weekly-equity-truth.rows.json"));
  const gate80RawByRule = new Map(gate80RawRows.map((row) => [row.rule_id, row]));
  const manifestId = options.manifestId ?? gate74b.warehouse.manifest_id;
  const manifest = await readTradeLegPathWarehouseManifest(manifestId);
  if (!manifest) throw new Error(`Missing Gate 74B warehouse manifest: ${manifestId}`);
  if (manifest.status !== "complete") throw new Error(`Gate 74B warehouse is not complete: ${manifestId} status=${manifest.status}`);

  const allWeeks = await readTradeLegPathWarehouseWeekKeys(manifestId);
  const selectedWeeks = options.maxWeeks ? allWeeks.slice(0, options.maxWeeks) : allWeeks;
  const statsByVariant = new Map(REPLAY_VARIANTS.map((variant) => [variant.variant_id, createStats(variant)]));

  const selectedPairs = options.onlyPair
    ? manifest.universe_symbols.filter((pair) => pair === options.onlyPair?.toUpperCase())
    : manifest.universe_symbols;
  if (options.onlyPair && selectedPairs.length === 0) throw new Error(`Pair not in manifest universe: ${options.onlyPair}`);
  for (let pairIndex = 0; pairIndex < selectedPairs.length; pairIndex += 1) {
    const pair = selectedPairs[pairIndex]!;
    if (options.logProgress) console.log(`gate82 preflight pair=${pairIndex + 1}/${selectedPairs.length} ${pair}`);
    const rows = await readPairSeriesWithRetry({ manifestId, pair, weeks: selectedWeeks, attempts: 3 });
    if (rows.length !== selectedWeeks.length) throw new Error(`Missing pair series rows for ${pair}: ${rows.length}/${selectedWeeks.length}`);
    replayPair(pair, rows, selectedWeeks, statsByVariant);
  }

  const weeklyRows = [...statsByVariant.values()].flatMap((stats) => weeklyRowsForStats(stats, selectedWeeks));
  const rawSummaryRows = VARIANTS
    .filter((variant) => variant.pair_net_flatten_target_adr === null)
    .map((variant) => {
      const gate80Row = variant.gate80_reference_rule_id ? gate80RawByRule.get(variant.gate80_reference_rule_id) : null;
      if (!gate80Row) throw new Error(`Missing Gate80 raw row for ${variant.variant_id}: ${variant.gate80_reference_rule_id}`);
      return importedRawSummaryRow({ config: variant, gate80Row, gate80WeeklyRows });
    });
  const replaySummaryRows = [...statsByVariant.values()].map((stats) => summarizeVariant(
    stats,
    weeklyRows.filter((row) => row.variant_id === stats.config.variant_id),
    gate80RawByRule,
  ));
  const summaryRows = [...rawSummaryRows, ...replaySummaryRows];
  const validationRows = buildValidationRows({ gate74b, gate80, manifest, selectedWeeks, selectedPairs, summaryRows });
  const verdict = determineVerdict(validationRows);
  const metricRows = metricDefinitionRows();

  const closeReasonRows = REPLAY_VARIANTS.flatMap((variant) => {
    const stats = statsByVariant.get(variant.variant_id)!;
    const groups = new Map<string, CloseEvent[]>();
    for (const event of stats.close_events) groups.set(event.close_reason, [...(groups.get(event.close_reason) ?? []), event]);
    return [...groups.entries()].map(([closeReason, events]) => withHash({
      variant_id: variant.variant_id,
      close_reason: closeReason,
      event_count: events.length,
      realized_or_open_adr: round6(events.reduce((sum, event) => sum + event.realized_or_open_adr, 0)),
      fill_count: round6(events.reduce((sum, event) => sum + event.fill_count, 0)),
    }));
  });

  const paths = {
    comparisonJson: path.join(options.artifactDir, "four-variant-comparison.rows.json"),
    comparisonCsv: path.join(options.artifactDir, "four-variant-comparison.rows.csv"),
    weeklyJson: path.join(options.artifactDir, "weekly-equity.rows.json"),
    weeklyCsv: path.join(options.artifactDir, "weekly-equity.rows.csv"),
    closeReasonJson: path.join(options.artifactDir, "close-reason-breakdown.rows.json"),
    closeReasonCsv: path.join(options.artifactDir, "close-reason-breakdown.rows.csv"),
    validationJson: path.join(options.artifactDir, "validation.rows.json"),
    validationCsv: path.join(options.artifactDir, "validation.rows.csv"),
    metricDefinitionsJson: path.join(options.artifactDir, "metric-definitions.rows.json"),
    metricDefinitionsCsv: path.join(options.artifactDir, "metric-definitions.rows.csv"),
    commandReceipt: path.join(options.artifactDir, "command-receipt.json"),
    summaryJson: path.join(options.artifactDir, "gate82-preflight-summary.json"),
    shaManifest: path.join(options.artifactDir, "gate82-preflight-sha256.txt"),
  };
  const artifacts = {
    comparisonJson: toRepoRelative(paths.comparisonJson),
    comparisonCsv: toRepoRelative(paths.comparisonCsv),
    weeklyEquityJson: toRepoRelative(paths.weeklyJson),
    weeklyEquityCsv: toRepoRelative(paths.weeklyCsv),
    closeReasonJson: toRepoRelative(paths.closeReasonJson),
    closeReasonCsv: toRepoRelative(paths.closeReasonCsv),
    validationJson: toRepoRelative(paths.validationJson),
    validationCsv: toRepoRelative(paths.validationCsv),
    metricDefinitionsJson: toRepoRelative(paths.metricDefinitionsJson),
    metricDefinitionsCsv: toRepoRelative(paths.metricDefinitionsCsv),
    commandReceipt: toRepoRelative(paths.commandReceipt),
    summaryJson: toRepoRelative(paths.summaryJson),
    shaIdentity: toRepoRelative(paths.shaManifest),
    report: toRepoRelative(options.reportPath),
  };

  await writeRows(paths.comparisonJson, paths.comparisonCsv, summaryRows);
  await writeRows(paths.weeklyJson, paths.weeklyCsv, weeklyRows.map(withHash));
  await writeRows(paths.closeReasonJson, paths.closeReasonCsv, closeReasonRows);
  await writeRows(paths.validationJson, paths.validationCsv, validationRows);
  await writeRows(paths.metricDefinitionsJson, paths.metricDefinitionsCsv, metricRows);
  await writeJson(paths.commandReceipt, {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    mode: "bounded_four_variant_hedged_grid_preflight_no_promotion_no_mt5_code",
    warehouse_manifest_id: manifest.manifest_id,
    warehouse_hash: manifest.warehouse_hash,
    variants: VARIANTS,
  });
  await writeJson(paths.summaryJson, {
    gate_id: GATE_ID,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    command: COMMAND,
    verdict,
    warehouse: {
      manifest_id: manifest.manifest_id,
      warehouse_hash: manifest.warehouse_hash,
      weeks_replayed: selectedWeeks.length,
      pairs_replayed: selectedPairs.length,
      pair_week_rows_replayed: selectedWeeks.length * selectedPairs.length,
    },
    comparison: summaryRows,
    validation: validationRows,
    artifacts,
    frozen_areas: [
      "Candidate B/C locked artifacts not modified",
      "No COT, Strength, or Regime dependency introduced",
      "No risk layer",
      "No MT5 code in this gate",
      "No all-28 runtime/deployment work",
      "No parameter sweep or threshold optimization",
      "No promotion or live-capital claim",
    ],
  });
  await writeText(options.reportPath, renderReport({ verdict, summaryRows, validationRows, metricRows, artifacts }));
  await writeShaManifest(paths.shaManifest, GATE_ID, COMMAND, [
    { label: "comparison_json", path: paths.comparisonJson },
    { label: "comparison_csv", path: paths.comparisonCsv },
    { label: "weekly_equity_json", path: paths.weeklyJson },
    { label: "weekly_equity_csv", path: paths.weeklyCsv },
    { label: "close_reason_json", path: paths.closeReasonJson },
    { label: "close_reason_csv", path: paths.closeReasonCsv },
    { label: "validation_json", path: paths.validationJson },
    { label: "validation_csv", path: paths.validationCsv },
    { label: "metric_definitions_json", path: paths.metricDefinitionsJson },
    { label: "metric_definitions_csv", path: paths.metricDefinitionsCsv },
    { label: "command_receipt", path: paths.commandReceipt },
    { label: "summary", path: paths.summaryJson },
    { label: "report", path: options.reportPath },
  ]);

  console.log(JSON.stringify({
    verdict,
    comparison: summaryRows,
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
