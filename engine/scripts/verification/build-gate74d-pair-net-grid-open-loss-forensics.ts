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

const GATE_ID = "Gate 74D: pair-net-grid-open-loss-forensics";
const GATE_DATE = "2026-06-29";
const COMMAND = "npm run engine:gate74d:pair-net-grid-open-loss-forensics";
const DEFAULT_GATE74B_DIR = "docs/research/gates/gate74b/artifacts/gate74b-trade-leg-path-materialization";
const DEFAULT_GATE74C_DIR = "docs/research/gates/gate74c/artifacts/gate74c-gross-replay-adapter-sanity-pack";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate74d/artifacts/gate74d-pair-net-grid-open-loss-forensics";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate74d/GATE74D_PAIR_NET_GRID_OPEN_LOSS_FORENSICS_${GATE_DATE}.md`;

type RuleKind = "weekly_forced_close" | "carry_until_flip" | "pair_net_grid_cycle";
type CloseReason = "target" | "flip" | "sample_end";

type Gate74bSummary = {
  verdict: string;
  warehouse: {
    manifest_id: string;
    warehouse_hash: string;
    week_count: number;
    pair_week_count: number;
    path_point_count: number;
  };
};

type Gate74cSummary = {
  verdict: string;
  warehouse: {
    manifest_id: string;
    warehouse_hash: string;
    week_count: number;
    pair_count: number;
    pair_week_rows_replayed: number;
  };
  adapter_scope: Record<string, unknown>;
  validation: {
    gross_only: boolean;
    costs_applied: boolean;
    raw_m1_rebuild_performed: boolean;
    account_equity_exit_policy_started: boolean;
    pair_pruning_started: boolean;
    risk_layer_started: boolean;
    exit_promotion_started: boolean;
    mt5_live_runtime_started: boolean;
    brain_truth_mutated: boolean;
    source_mutation_started: boolean;
  };
  top_rules_by_equity: Array<{
    rule_id: string;
    target_adr: number | null;
    spacing_adr: number | null;
    closed_total_adr: number;
    equity_total_adr: number;
  }>;
};

type ReplayRule = {
  rule_id: string;
  rule_family: "control" | "gross_lifecycle" | "narrow_robustness";
  kind: RuleKind;
  target_adr: number | null;
  spacing_adr: number | null;
  review_role: string;
};

type Fill = {
  entry_price: number;
  entry_timestamp_utc: string;
  fill_index: number;
};

type Cycle = {
  cycle_id: string;
  rule_id: string;
  pair: string;
  side: "LONG" | "SHORT";
  direction_streak_id: string;
  candidate_row_key: string;
  decision_hash: string;
  start_week_open_utc: string;
  start_timestamp_utc: string;
  start_year: number;
  anchor_price: number;
  cycle_adr_pct: number;
  fills: Fill[];
  next_adverse_fill_index: number;
  min_pnl_adr: number;
  min_pnl_timestamp_utc: string;
  max_pnl_adr: number;
  max_pnl_timestamp_utc: string;
  first_negative_timestamp_utc: string | null;
  last_pnl_adr: number;
};

type PairWeeklySnapshot = {
  rule_id: string;
  pair: string;
  week_open_utc: string;
  year: number;
  closed_week_adr: number;
  closed_cumulative_adr: number;
  open_unrealized_adr: number;
  equity_snapshot_adr: number;
  open_cycle_id: string | null;
  open_cycle_fill_count: number;
  open_cycle_age_hours: number | null;
  open_cycle_min_pnl_adr: number | null;
};

type CycleRecord = {
  rule_id: string;
  pair: string;
  cycle_id: string;
  side: "LONG" | "SHORT";
  close_reason: CloseReason;
  direction_streak_id: string;
  candidate_row_key: string;
  start_week_open_utc: string;
  start_timestamp_utc: string;
  start_year: number;
  close_week_open_utc: string;
  close_timestamp_utc: string;
  close_year: number;
  realized_or_open_adr: number;
  fill_count: number;
  age_hours: number;
  min_pnl_adr: number;
  max_pnl_adr: number;
  first_negative_timestamp_utc: string | null;
  went_negative: boolean;
  recovered_to_target_after_negative: boolean;
  time_from_first_negative_to_close_hours: number | null;
  previously_positive: boolean;
  previously_half_target: boolean;
  target_adr: number | null;
  spacing_adr: number | null;
};

type PairRuleReplay = {
  rule: ReplayRule;
  pair: string;
  closed_events: number[];
  weekly_snapshots: PairWeeklySnapshot[];
  cycle_records: CycleRecord[];
};

type WeeklyEquityRow = {
  rule_id: string;
  week_open_utc: string;
  year: number;
  closed_week_adr: number;
  closed_cumulative_adr: number;
  open_unrealized_adr: number;
  equity_snapshot_adr: number;
  equity_delta_adr: number;
};

type DrawdownWindow = {
  rule_id: string;
  drawdown_start_week_open_utc: string | null;
  drawdown_trough_week_open_utc: string;
  peak_equity_adr: number;
  trough_equity_adr: number;
  drawdown_adr: number;
};

type RuleForensicsRow = {
  rule_id: string;
  rule_family: string;
  review_role: string;
  target_adr: number | null;
  spacing_adr: number | null;
  closed_total_adr: number;
  final_equity_adr: number;
  final_open_unrealized_adr: number;
  closed_profit_factor: number | null;
  equity_profit_factor: number | null;
  equity_max_drawdown_adr: number;
  time_underwater_week_rate: number;
  entries: number;
  closed_cycles: number;
  target_closed_cycles: number;
  flip_closed_cycles: number;
  final_open_cycles: number;
  final_open_loss_adr: number;
  final_open_loss_ratio_to_closed: number | null;
  worst_final_open_cycle_adr: number | null;
  worst_final_open_cycle_pair: string | null;
  max_fill_count: number;
  max_open_cycle_age_hours: number;
  negative_cycles: number;
  negative_cycles_recovered_to_target: number;
  negative_cycle_recovery_rate: number | null;
  flip_loss_cycles: number;
  flip_loss_total_adr: number;
  flip_loss_average_adr: number | null;
  content_hash?: string;
};

function parseOptions() {
  const args = parseArgMap();
  const maxWeeksRaw = args.get("--max-weeks");
  return {
    gate74bDir: args.get("--gate74b-dir") ?? DEFAULT_GATE74B_DIR,
    gate74cDir: args.get("--gate74c-dir") ?? DEFAULT_GATE74C_DIR,
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
  return String(Math.round(value * 100)).padStart(3, "0");
}

function ruleSet(): ReplayRule[] {
  return [
    {
      rule_id: "WEEKLY_FORCED_CLOSE",
      rule_family: "control",
      kind: "weekly_forced_close",
      target_adr: null,
      spacing_adr: null,
      review_role: "weekly_forced_close_control",
    },
    {
      rule_id: "CARRY_UNTIL_FLIP",
      rule_family: "control",
      kind: "carry_until_flip",
      target_adr: null,
      spacing_adr: null,
      review_role: "carry_until_flip_control",
    },
    ...[
      { target: 0.5, spacing: 0.2, role: "gate74c_top3_target_sensitivity" },
      { target: 0.75, spacing: 0.2, role: "gate74c_best_adapter_focus" },
      { target: 1, spacing: 0.2, role: "gate74c_top3_target_sensitivity" },
      { target: 0.75, spacing: 0.15, role: "narrow_spacing_sensitivity" },
      { target: 0.75, spacing: 0.25, role: "narrow_spacing_sensitivity" },
    ].map(({ target, spacing, role }) => ({
      rule_id: `PAIR_NET_GRID_CYCLE_TARGET_${formatAdr(target)}_SPACING_${formatAdr(spacing)}_RESTART_UNTIL_FLIP`,
      rule_family: role === "narrow_spacing_sensitivity" ? "narrow_robustness" as const : "gross_lifecycle" as const,
      kind: "pair_net_grid_cycle" as const,
      target_adr: target,
      spacing_adr: spacing,
      review_role: role,
    })),
  ];
}

function markPriceFromDirectedClose(row: TradeLegPathReplayPairWeek, directedCloseAdr: number) {
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
  return ((markPrice - fill.entry_price) / fill.entry_price) * 100 * sign / cycle.cycle_adr_pct;
}

function cycleNetPnlAdr(cycle: Cycle, markPrice: number) {
  return cycle.fills.reduce((sum, fill) => sum + fillPnlAdr(cycle, fill, markPrice), 0);
}

function hoursBetween(start: string, end: string) {
  const hours = (Date.parse(end) - Date.parse(start)) / 3_600_000;
  return Number.isFinite(hours) ? round6(Math.max(0, hours)) : 0;
}

function startCycle(options: {
  rule: ReplayRule;
  pair: string;
  row: TradeLegPathReplayPairWeek;
  markPrice: number;
  timestampUtc: string;
  cycleSerial: number;
}) {
  return {
    cycle_id: `${options.rule.rule_id}|${options.pair}|${options.cycleSerial}`,
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
    fills: [{ entry_price: options.markPrice, entry_timestamp_utc: options.timestampUtc, fill_index: 0 }],
    next_adverse_fill_index: 1,
    min_pnl_adr: 0,
    min_pnl_timestamp_utc: options.timestampUtc,
    max_pnl_adr: 0,
    max_pnl_timestamp_utc: options.timestampUtc,
    first_negative_timestamp_utc: null,
    last_pnl_adr: 0,
  } satisfies Cycle;
}

function observeCycle(cycle: Cycle, markPrice: number, timestampUtc: string) {
  const pnl = round6(cycleNetPnlAdr(cycle, markPrice));
  cycle.last_pnl_adr = pnl;
  if (pnl < cycle.min_pnl_adr) {
    cycle.min_pnl_adr = pnl;
    cycle.min_pnl_timestamp_utc = timestampUtc;
  }
  if (pnl > cycle.max_pnl_adr) {
    cycle.max_pnl_adr = pnl;
    cycle.max_pnl_timestamp_utc = timestampUtc;
  }
  if (pnl < 0 && cycle.first_negative_timestamp_utc === null) {
    cycle.first_negative_timestamp_utc = timestampUtc;
  }
  return pnl;
}

function addAdverseGridFills(options: {
  cycle: Cycle;
  spacingAdr: number;
  markPrice: number;
  timestampUtc: string;
}) {
  const directed = directedMoveFromCycle(options.cycle, options.markPrice);
  while (directed <= -options.spacingAdr * options.cycle.next_adverse_fill_index) {
    const fillIndex = options.cycle.next_adverse_fill_index;
    options.cycle.fills.push({
      entry_price: priceAtDirectedMove(options.cycle, -options.spacingAdr * fillIndex),
      entry_timestamp_utc: options.timestampUtc,
      fill_index: fillIndex,
    });
    options.cycle.next_adverse_fill_index += 1;
  }
}

function cycleRecord(options: {
  rule: ReplayRule;
  cycle: Cycle;
  closeReason: CloseReason;
  markPrice: number;
  timestampUtc: string;
  weekOpenUtc: string;
}) {
  const pnl = round6(cycleNetPnlAdr(options.cycle, options.markPrice));
  const wentNegative = options.cycle.first_negative_timestamp_utc !== null;
  const targetAfterNegative = wentNegative && options.closeReason === "target";
  return {
    rule_id: options.rule.rule_id,
    pair: options.cycle.pair,
    cycle_id: options.cycle.cycle_id,
    side: options.cycle.side,
    close_reason: options.closeReason,
    direction_streak_id: options.cycle.direction_streak_id,
    candidate_row_key: options.cycle.candidate_row_key,
    start_week_open_utc: options.cycle.start_week_open_utc,
    start_timestamp_utc: options.cycle.start_timestamp_utc,
    start_year: options.cycle.start_year,
    close_week_open_utc: options.weekOpenUtc,
    close_timestamp_utc: options.timestampUtc,
    close_year: new Date(options.weekOpenUtc).getUTCFullYear(),
    realized_or_open_adr: pnl,
    fill_count: options.cycle.fills.length,
    age_hours: hoursBetween(options.cycle.start_timestamp_utc, options.timestampUtc),
    min_pnl_adr: round6(options.cycle.min_pnl_adr),
    max_pnl_adr: round6(options.cycle.max_pnl_adr),
    first_negative_timestamp_utc: options.cycle.first_negative_timestamp_utc,
    went_negative: wentNegative,
    recovered_to_target_after_negative: targetAfterNegative,
    time_from_first_negative_to_close_hours: wentNegative
      ? hoursBetween(options.cycle.first_negative_timestamp_utc!, options.timestampUtc)
      : null,
    previously_positive: options.cycle.max_pnl_adr > 0,
    previously_half_target: options.rule.target_adr === null ? false : options.cycle.max_pnl_adr >= options.rule.target_adr / 2,
    target_adr: options.rule.target_adr,
    spacing_adr: options.rule.spacing_adr,
  } satisfies CycleRecord;
}

function replayWeeklyForcedClose(rule: ReplayRule, pair: string, rows: TradeLegPathReplayPairWeek[], selectedWeeks: string[]): PairRuleReplay {
  const rowsByWeek = new Map(rows.map((row) => [row.week_open_utc, row]));
  let cumulative = 0;
  const closedEvents: number[] = [];
  const weekly: PairWeeklySnapshot[] = [];
  for (const week of selectedWeeks) {
    const value = round6(rowsByWeek.get(week)?.friday_close_adr ?? 0);
    cumulative = round6(cumulative + value);
    closedEvents.push(value);
    weekly.push({
      rule_id: rule.rule_id,
      pair,
      week_open_utc: week,
      year: new Date(week).getUTCFullYear(),
      closed_week_adr: value,
      closed_cumulative_adr: cumulative,
      open_unrealized_adr: 0,
      equity_snapshot_adr: cumulative,
      open_cycle_id: null,
      open_cycle_fill_count: 0,
      open_cycle_age_hours: null,
      open_cycle_min_pnl_adr: null,
    });
  }
  return { rule, pair, closed_events: closedEvents, weekly_snapshots: weekly, cycle_records: [] };
}

function replayLifecycleRule(rule: ReplayRule, pair: string, rows: TradeLegPathReplayPairWeek[], selectedWeeks: string[]): PairRuleReplay {
  const rowsByWeek = new Map(rows.map((row) => [row.week_open_utc, row]));
  const closedEvents: number[] = [];
  const weekly: PairWeeklySnapshot[] = [];
  const cycles: CycleRecord[] = [];
  const closedByWeek = new Map<string, number>();
  let closedTotal = 0;
  let current: Cycle | null = null;
  let lastMarkPrice: number | null = null;
  let lastTimestampUtc: string | null = null;
  let lastWeekOpenUtc = selectedWeeks[0] ?? "";
  let cycleSerial = 0;

  function closeCurrent(reason: "target" | "flip", markPrice: number, timestampUtc: string, weekOpenUtc: string) {
    if (!current) return;
    observeCycle(current, markPrice, timestampUtc);
    const record = cycleRecord({ rule, cycle: current, closeReason: reason, markPrice, timestampUtc, weekOpenUtc });
    cycles.push(record);
    closedEvents.push(record.realized_or_open_adr);
    closedTotal = round6(closedTotal + record.realized_or_open_adr);
    closedByWeek.set(weekOpenUtc, round6((closedByWeek.get(weekOpenUtc) ?? 0) + record.realized_or_open_adr));
    current = null;
  }

  for (const week of selectedWeeks) {
    lastWeekOpenUtc = week;
    const row = rowsByWeek.get(week);
    if (!row) {
      const open = current && lastMarkPrice !== null ? observeCycle(current, lastMarkPrice, lastTimestampUtc ?? week) : 0;
      weekly.push({
        rule_id: rule.rule_id,
        pair,
        week_open_utc: week,
        year: new Date(week).getUTCFullYear(),
        closed_week_adr: round6(closedByWeek.get(week) ?? 0),
        closed_cumulative_adr: round6(closedTotal),
        open_unrealized_adr: round6(open),
        equity_snapshot_adr: round6(closedTotal + open),
        open_cycle_id: current?.cycle_id ?? null,
        open_cycle_fill_count: current?.fills.length ?? 0,
        open_cycle_age_hours: current && lastTimestampUtc ? hoursBetween(current.start_timestamp_utc, lastTimestampUtc) : null,
        open_cycle_min_pnl_adr: current ? round6(current.min_pnl_adr) : null,
      });
      continue;
    }
    const payload = row.path_payload;
    for (let index = 0; index < payload.timestamp_utc.length; index += 1) {
      const timestamp = payload.timestamp_utc[index]!;
      const markPrice = markPriceFromDirectedClose(row, payload.directed_close_adr[index] ?? 0);
      lastMarkPrice = markPrice;
      lastTimestampUtc = timestamp;
      if (current && current.side !== row.candidate_b_side) {
        closeCurrent("flip", markPrice, timestamp, row.week_open_utc);
      }
      if (!current) {
        cycleSerial += 1;
        current = startCycle({ rule, pair, row, markPrice, timestampUtc: timestamp, cycleSerial });
      }
      if (rule.kind === "pair_net_grid_cycle") {
        addAdverseGridFills({
          cycle: current,
          spacingAdr: rule.spacing_adr ?? 0.2,
          markPrice,
          timestampUtc: timestamp,
        });
      }
      const open = observeCycle(current, markPrice, timestamp);
      if (rule.kind === "pair_net_grid_cycle" && rule.target_adr !== null && open >= rule.target_adr) {
        closeCurrent("target", markPrice, timestamp, row.week_open_utc);
        cycleSerial += 1;
        current = startCycle({ rule, pair, row, markPrice, timestampUtc: timestamp, cycleSerial });
      }
    }
    const open = current && lastMarkPrice !== null ? observeCycle(current, lastMarkPrice, lastTimestampUtc ?? week) : 0;
    weekly.push({
      rule_id: rule.rule_id,
      pair,
      week_open_utc: week,
      year: new Date(week).getUTCFullYear(),
      closed_week_adr: round6(closedByWeek.get(week) ?? 0),
      closed_cumulative_adr: round6(closedTotal),
      open_unrealized_adr: round6(open),
      equity_snapshot_adr: round6(closedTotal + open),
      open_cycle_id: current?.cycle_id ?? null,
      open_cycle_fill_count: current?.fills.length ?? 0,
      open_cycle_age_hours: current && lastTimestampUtc ? hoursBetween(current.start_timestamp_utc, lastTimestampUtc) : null,
      open_cycle_min_pnl_adr: current ? round6(current.min_pnl_adr) : null,
    });
  }
  if (current && lastMarkPrice !== null) {
    observeCycle(current, lastMarkPrice, lastTimestampUtc ?? lastWeekOpenUtc);
    cycles.push(cycleRecord({
      rule,
      cycle: current,
      closeReason: "sample_end",
      markPrice: lastMarkPrice,
      timestampUtc: lastTimestampUtc ?? lastWeekOpenUtc,
      weekOpenUtc: lastWeekOpenUtc,
    }));
  }
  return { rule, pair, closed_events: closedEvents, weekly_snapshots: weekly, cycle_records: cycles };
}

function aggregateWeekly(rows: PairWeeklySnapshot[], rule: ReplayRule, selectedWeeks: string[]) {
  const byWeek = new Map<string, PairWeeklySnapshot[]>();
  for (const row of rows) {
    const group = byWeek.get(row.week_open_utc) ?? [];
    group.push(row);
    byWeek.set(row.week_open_utc, group);
  }
  const output: WeeklyEquityRow[] = [];
  let previousEquity = 0;
  for (const week of selectedWeeks) {
    const group = byWeek.get(week) ?? [];
    const equity = round6(group.reduce((sum, row) => sum + row.equity_snapshot_adr, 0));
    output.push({
      rule_id: rule.rule_id,
      week_open_utc: week,
      year: new Date(week).getUTCFullYear(),
      closed_week_adr: round6(group.reduce((sum, row) => sum + row.closed_week_adr, 0)),
      closed_cumulative_adr: round6(group.reduce((sum, row) => sum + row.closed_cumulative_adr, 0)),
      open_unrealized_adr: round6(group.reduce((sum, row) => sum + row.open_unrealized_adr, 0)),
      equity_snapshot_adr: equity,
      equity_delta_adr: round6(equity - previousEquity),
    });
    previousEquity = equity;
  }
  return output;
}

function drawdownWindow(rows: WeeklyEquityRow[]): DrawdownWindow {
  let peak = 0;
  let peakWeek: string | null = null;
  let troughWeek = rows[0]?.week_open_utc ?? "";
  let troughEquity = 0;
  let maxDrawdown = 0;
  let startWeek: string | null = null;
  for (const row of rows) {
    if (row.equity_snapshot_adr > peak) {
      peak = row.equity_snapshot_adr;
      peakWeek = row.week_open_utc;
    }
    const drawdown = round6(row.equity_snapshot_adr - peak);
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
      troughWeek = row.week_open_utc;
      troughEquity = row.equity_snapshot_adr;
      startWeek = peakWeek;
    }
  }
  return {
    rule_id: rows[0]?.rule_id ?? "",
    drawdown_start_week_open_utc: startWeek,
    drawdown_trough_week_open_utc: troughWeek,
    peak_equity_adr: round6(peak),
    trough_equity_adr: round6(troughEquity),
    drawdown_adr: round6(maxDrawdown),
  };
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return round6(sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!);
}

function average(values: number[]) {
  return values.length === 0 ? null : round6(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function maxValue(values: number[]) {
  return values.length === 0 ? null : round6(Math.max(...values));
}

function minValue(values: number[]) {
  return values.length === 0 ? null : round6(Math.min(...values));
}

function ageBucket(hours: number) {
  if (hours < 24) return "lt_1d";
  if (hours < 168) return "1d_to_1w";
  if (hours < 720) return "1w_to_1m";
  if (hours < 2160) return "1m_to_3m";
  if (hours < 4320) return "3m_to_6m";
  return "gt_6m";
}

function groupSum<T>(rows: T[], keyFn: (row: T) => string, valueFn: (row: T) => number) {
  const map = new Map<string, { key: string; count: number; value: number }>();
  for (const row of rows) {
    const key = keyFn(row);
    const current = map.get(key) ?? { key, count: 0, value: 0 };
    current.count += 1;
    current.value = round6(current.value + valueFn(row));
    map.set(key, current);
  }
  return [...map.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function withHashes<T extends Record<string, unknown>>(rows: T[]) {
  return rows.map((row) => ({ ...row, content_hash: sha256Stable(row) }));
}

function ruleSummary(options: {
  rule: ReplayRule;
  weeklyRows: WeeklyEquityRow[];
  cycleRecords: CycleRecord[];
  closedEvents: number[];
  drawdown: DrawdownWindow;
}) {
  const closedTotal = round6(options.closedEvents.reduce((sum, value) => sum + value, 0));
  const equityDeltas = options.weeklyRows.map((row) => row.equity_delta_adr);
  const finalEquity = round6(options.weeklyRows.at(-1)?.equity_snapshot_adr ?? 0);
  const finalOpen = round6(finalEquity - closedTotal);
  const finalOpenCycles = options.cycleRecords.filter((row) => row.close_reason === "sample_end");
  const negativeCycles = options.cycleRecords.filter((row) => row.went_negative);
  const recovered = negativeCycles.filter((row) => row.recovered_to_target_after_negative);
  const flipLossCycles = options.cycleRecords.filter((row) => row.close_reason === "flip" && row.realized_or_open_adr < 0);
  const underwaterWeeks = (() => {
    let peak = 0;
    let count = 0;
    for (const row of options.weeklyRows) {
      peak = Math.max(peak, row.equity_snapshot_adr);
      if (row.equity_snapshot_adr < peak) count += 1;
    }
    return count;
  })();
  const worstFinalOpen = [...finalOpenCycles].sort((left, right) => left.realized_or_open_adr - right.realized_or_open_adr)[0];
  return {
    rule_id: options.rule.rule_id,
    rule_family: options.rule.rule_family,
    review_role: options.rule.review_role,
    target_adr: options.rule.target_adr,
    spacing_adr: options.rule.spacing_adr,
    closed_total_adr: closedTotal,
    final_equity_adr: finalEquity,
    final_open_unrealized_adr: finalOpen,
    closed_profit_factor: profitFactor(options.closedEvents),
    equity_profit_factor: profitFactor(equityDeltas),
    equity_max_drawdown_adr: options.drawdown.drawdown_adr,
    time_underwater_week_rate: round6(underwaterWeeks / Math.max(1, options.weeklyRows.length)),
    entries: options.cycleRecords.reduce((sum, row) => sum + row.fill_count, 0),
    closed_cycles: options.cycleRecords.filter((row) => row.close_reason !== "sample_end").length,
    target_closed_cycles: options.cycleRecords.filter((row) => row.close_reason === "target").length,
    flip_closed_cycles: options.cycleRecords.filter((row) => row.close_reason === "flip").length,
    final_open_cycles: finalOpenCycles.length,
    final_open_loss_adr: round6(finalOpenCycles.reduce((sum, row) => sum + Math.min(0, row.realized_or_open_adr), 0)),
    final_open_loss_ratio_to_closed: closedTotal === 0 ? null : round6(Math.abs(finalOpen) / Math.abs(closedTotal)),
    worst_final_open_cycle_adr: worstFinalOpen ? round6(worstFinalOpen.realized_or_open_adr) : null,
    worst_final_open_cycle_pair: worstFinalOpen?.pair ?? null,
    max_fill_count: maxValue(options.cycleRecords.map((row) => row.fill_count)) ?? 0,
    max_open_cycle_age_hours: maxValue(finalOpenCycles.map((row) => row.age_hours)) ?? 0,
    negative_cycles: negativeCycles.length,
    negative_cycles_recovered_to_target: recovered.length,
    negative_cycle_recovery_rate: negativeCycles.length === 0 ? null : round6(recovered.length / negativeCycles.length),
    flip_loss_cycles: flipLossCycles.length,
    flip_loss_total_adr: round6(flipLossCycles.reduce((sum, row) => sum + row.realized_or_open_adr, 0)),
    flip_loss_average_adr: average(flipLossCycles.map((row) => row.realized_or_open_adr)),
  } satisfies RuleForensicsRow;
}

function recoverySummary(rule: ReplayRule, records: CycleRecord[]) {
  const negative = records.filter((row) => row.went_negative);
  const recovered = negative.filter((row) => row.recovered_to_target_after_negative);
  const neverRecovered = negative.filter((row) => !row.recovered_to_target_after_negative);
  const recoveredTimes = recovered
    .map((row) => row.time_from_first_negative_to_close_hours)
    .filter((value): value is number => value !== null);
  return {
    rule_id: rule.rule_id,
    target_adr: rule.target_adr,
    spacing_adr: rule.spacing_adr,
    negative_cycles: negative.length,
    negative_cycles_recovered_to_target: recovered.length,
    negative_recovery_rate: negative.length === 0 ? null : round6(recovered.length / negative.length),
    never_recovered_before_flip_or_sample_end: neverRecovered.length,
    median_time_to_recovery_hours: median(recoveredTimes),
    average_time_to_recovery_hours: average(recoveredTimes),
    max_time_to_recovery_hours: maxValue(recoveredTimes),
    median_mae_before_target_adr: median(recovered.map((row) => row.min_pnl_adr)),
    worst_mae_before_target_adr: minValue(recovered.map((row) => row.min_pnl_adr)),
    median_mae_never_recovered_adr: median(neverRecovered.map((row) => row.min_pnl_adr)),
    worst_mae_never_recovered_adr: minValue(neverRecovered.map((row) => row.min_pnl_adr)),
  };
}

function flipLossSummary(rule: ReplayRule, records: CycleRecord[]) {
  const losses = records.filter((row) => row.close_reason === "flip" && row.realized_or_open_adr < 0);
  return {
    rule_id: rule.rule_id,
    target_adr: rule.target_adr,
    spacing_adr: rule.spacing_adr,
    flip_loss_count: losses.length,
    flip_loss_total_adr: round6(losses.reduce((sum, row) => sum + row.realized_or_open_adr, 0)),
    flip_loss_average_adr: average(losses.map((row) => row.realized_or_open_adr)),
    flip_loss_median_adr: median(losses.map((row) => row.realized_or_open_adr)),
    flip_loss_worst_adr: minValue(losses.map((row) => row.realized_or_open_adr)),
    median_age_at_flip_hours: median(losses.map((row) => row.age_hours)),
    median_fill_count_at_flip: median(losses.map((row) => row.fill_count)),
    previously_positive_count: losses.filter((row) => row.previously_positive).length,
    previously_positive_rate: losses.length === 0 ? null : round6(losses.filter((row) => row.previously_positive).length / losses.length),
    previously_half_target_count: losses.filter((row) => row.previously_half_target).length,
    previously_half_target_rate: losses.length === 0 ? null : round6(losses.filter((row) => row.previously_half_target).length / losses.length),
  };
}

function pairContributionRows(options: {
  rule: ReplayRule;
  pairSnapshots: PairWeeklySnapshot[];
  drawdown: DrawdownWindow;
}) {
  const startWeek = options.drawdown.drawdown_start_week_open_utc;
  const troughWeek = options.drawdown.drawdown_trough_week_open_utc;
  const byPairWeek = new Map(options.pairSnapshots.map((row) => [`${row.pair}|${row.week_open_utc}`, row]));
  const pairs = [...new Set(options.pairSnapshots.map((row) => row.pair))].sort();
  return pairs.map((pair) => {
    const start = startWeek ? byPairWeek.get(`${pair}|${startWeek}`) : null;
    const trough = byPairWeek.get(`${pair}|${troughWeek}`);
    const startEquity = start?.equity_snapshot_adr ?? 0;
    const troughEquity = trough?.equity_snapshot_adr ?? 0;
    return {
      rule_id: options.rule.rule_id,
      pair,
      drawdown_start_week_open_utc: startWeek,
      drawdown_trough_week_open_utc: troughWeek,
      pair_equity_delta_from_peak_to_trough: round6(troughEquity - startEquity),
      closed_delta_from_peak_to_trough: round6((trough?.closed_cumulative_adr ?? 0) - (start?.closed_cumulative_adr ?? 0)),
      open_unrealized_at_trough: round6(trough?.open_unrealized_adr ?? 0),
      open_cycle_fill_count_at_trough: trough?.open_cycle_fill_count ?? 0,
      open_cycle_age_hours_at_trough: trough?.open_cycle_age_hours ?? null,
      open_cycle_min_pnl_adr_at_trough: trough?.open_cycle_min_pnl_adr ?? null,
    };
  }).sort((left, right) => left.pair_equity_delta_from_peak_to_trough - right.pair_equity_delta_from_peak_to_trough);
}

function currencyContributionRows(pairRows: ReturnType<typeof pairContributionRows>) {
  const byCurrency = new Map<string, { currency: string; allocated_pair_equity_delta: number; allocated_open_unrealized_at_trough: number; pair_count: number }>();
  for (const row of pairRows) {
    const currencies = [row.pair.slice(0, 3), row.pair.slice(3, 6)];
    for (const currency of currencies) {
      const current = byCurrency.get(currency) ?? {
        currency,
        allocated_pair_equity_delta: 0,
        allocated_open_unrealized_at_trough: 0,
        pair_count: 0,
      };
      current.allocated_pair_equity_delta = round6(current.allocated_pair_equity_delta + row.pair_equity_delta_from_peak_to_trough / 2);
      current.allocated_open_unrealized_at_trough = round6(current.allocated_open_unrealized_at_trough + row.open_unrealized_at_trough / 2);
      current.pair_count += 1;
      byCurrency.set(currency, current);
    }
  }
  return [...byCurrency.values()].sort((left, right) => left.allocated_pair_equity_delta - right.allocated_pair_equity_delta);
}

function renderReport(summary: Record<string, unknown>, ruleRows: RuleForensicsRow[], recoveryRows: Array<Record<string, unknown>>, flipRows: Array<Record<string, unknown>>) {
  const focus = ruleRows.find((row) => row.rule_id === "PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP");
  return [
    "# Gate 74D Pair Net-Grid Open-Loss Forensics",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Replays Gate 74C-style lifecycle adapters from the frozen Gate 74B trade-leg path warehouse.",
    "- Focuses on unresolved open-loss inventory, drawdown decomposition, flip losses, recovery, and narrow target/spacing robustness.",
    "- Applies no costs, risk sizing, pair pruning, account-level equity exit policy, signal mutation, MT5/live/runtime work, or promotion logic.",
    "",
    "## Focus Adapter",
    "",
    "```json",
    JSON.stringify(focus ?? null, null, 2),
    "```",
    "",
    "## Rule Forensics",
    "",
    renderTable(ruleRows.map((row) => ({
      rule_id: row.rule_id,
      closed: row.closed_total_adr,
      equity: row.final_equity_adr,
      open: row.final_open_unrealized_adr,
      eq_pf: row.equity_profit_factor,
      dd: row.equity_max_drawdown_adr,
      recovery: row.negative_cycle_recovery_rate,
      flip_loss: row.flip_loss_total_adr,
      max_fills: row.max_fill_count,
    })), ["rule_id", "closed", "equity", "open", "eq_pf", "dd", "recovery", "flip_loss", "max_fills"]),
    "",
    "## Recovery Summary",
    "",
    renderTable(recoveryRows, ["rule_id", "negative_cycles", "negative_cycles_recovered_to_target", "negative_recovery_rate", "median_time_to_recovery_hours", "worst_mae_never_recovered_adr"]),
    "",
    "## Flip Loss Summary",
    "",
    renderTable(flipRows, ["rule_id", "flip_loss_count", "flip_loss_total_adr", "flip_loss_worst_adr", "median_age_at_flip_hours", "previously_positive_rate"]),
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    "```json",
    JSON.stringify(summary.artifacts, null, 2),
    "```",
    "",
    "## Stop Line",
    "",
    "Gate 74D is forensic review only. Cost validation, account-level equity exits, broad spacing optimization, risk/correlation pruning, pair selection, promotion, MT5/live/runtime work, source mutation, and Brain mutation remain closed unless explicitly opened.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  if (options.maxWeeks !== null && (!Number.isInteger(options.maxWeeks) || options.maxWeeks <= 0)) {
    throw new Error(`Invalid --max-weeks: ${options.maxWeeks}`);
  }
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const gate74b = await readJson<Gate74bSummary>(path.join(options.gate74bDir, "gate74b-summary.json"));
  const gate74c = await readJson<Gate74cSummary>(path.join(options.gate74cDir, "gate74c-summary.json"));
  const manifestId = options.manifestId ?? gate74b.warehouse.manifest_id;
  const manifest = await readTradeLegPathWarehouseManifest(manifestId);
  if (!manifest) throw new Error(`Gate 74D requires completed Gate 74B warehouse manifest: ${manifestId}`);
  if (manifest.status !== "complete") throw new Error(`Gate 74B warehouse is not complete: ${manifestId} status=${manifest.status}`);

  const allWeeks = await readTradeLegPathWarehouseWeekKeys(manifestId);
  const selectedWeeks = allWeeks.slice(0, options.maxWeeks ?? undefined);
  const rules = ruleSet();
  const pairSnapshotsByRule = new Map<string, PairWeeklySnapshot[]>();
  const cyclesByRule = new Map<string, CycleRecord[]>();
  const closedEventsByRule = new Map<string, number[]>();
  const startedAt = Date.now();

  for (const [pairIndex, pair] of manifest.universe_symbols.entries()) {
    const rows = await readTradeLegPathWarehousePairSeries({ manifestId, pair, weeks: selectedWeeks });
    const rowsByWeek = new Set(rows.map((row) => row.week_open_utc));
    if (rows.length !== selectedWeeks.length || selectedWeeks.some((week) => !rowsByWeek.has(week))) {
      throw new Error(`Incomplete Gate 74B pair series for ${pair}: rows=${rows.length}, weeks=${selectedWeeks.length}`);
    }
    for (const rule of rules) {
      const replay = rule.kind === "weekly_forced_close"
        ? replayWeeklyForcedClose(rule, pair, rows, selectedWeeks)
        : replayLifecycleRule(rule, pair, rows, selectedWeeks);
      pairSnapshotsByRule.set(rule.rule_id, [...(pairSnapshotsByRule.get(rule.rule_id) ?? []), ...replay.weekly_snapshots]);
      cyclesByRule.set(rule.rule_id, [...(cyclesByRule.get(rule.rule_id) ?? []), ...replay.cycle_records]);
      closedEventsByRule.set(rule.rule_id, [...(closedEventsByRule.get(rule.rule_id) ?? []), ...replay.closed_events]);
    }
    if (options.logProgress) console.log(`gate74d pair=${pairIndex + 1}/${manifest.universe_symbols.length} ${pair}`);
  }

  const weeklyRowsByRule = new Map<string, WeeklyEquityRow[]>();
  const drawdownsByRule = new Map<string, DrawdownWindow>();
  const ruleRows: RuleForensicsRow[] = [];
  const allWeeklyRows: WeeklyEquityRow[] = [];
  const allDrawdownPairRows: ReturnType<typeof pairContributionRows> = [];
  const allDrawdownCurrencyRows: Array<Record<string, unknown>> = [];

  for (const rule of rules) {
    const pairSnapshots = pairSnapshotsByRule.get(rule.rule_id) ?? [];
    const weeklyRows = aggregateWeekly(pairSnapshots, rule, selectedWeeks);
    const drawdown = drawdownWindow(weeklyRows);
    weeklyRowsByRule.set(rule.rule_id, weeklyRows);
    drawdownsByRule.set(rule.rule_id, drawdown);
    allWeeklyRows.push(...weeklyRows);
    const pairContrib = pairContributionRows({ rule, pairSnapshots, drawdown });
    allDrawdownPairRows.push(...pairContrib.map((row) => ({ ...row, content_hash: sha256Stable(row) })));
    allDrawdownCurrencyRows.push(...currencyContributionRows(pairContrib).map((row) => ({
      rule_id: rule.rule_id,
      drawdown_trough_week_open_utc: drawdown.drawdown_trough_week_open_utc,
      allocation_method: "split_50_50_pair_equity_delta",
      ...row,
      content_hash: sha256Stable({ rule_id: rule.rule_id, drawdown_trough_week_open_utc: drawdown.drawdown_trough_week_open_utc, ...row }),
    })));
    ruleRows.push(ruleSummary({
      rule,
      weeklyRows,
      cycleRecords: cyclesByRule.get(rule.rule_id) ?? [],
      closedEvents: closedEventsByRule.get(rule.rule_id) ?? [],
      drawdown,
    }));
  }

  const lifecycleRules = rules.filter((rule) => rule.kind !== "weekly_forced_close");
  const finalOpenRows = withHashes(lifecycleRules.flatMap((rule) => (cyclesByRule.get(rule.rule_id) ?? [])
    .filter((row) => row.close_reason === "sample_end")
    .sort((left, right) => left.realized_or_open_adr - right.realized_or_open_adr)));
  const finalOpenByPair = withHashes(groupSum(finalOpenRows, (row) => `${row.rule_id}|${row.pair}`, (row) => row.realized_or_open_adr)
    .map((row) => ({ rule_id: row.key.split("|")[0], pair: row.key.split("|")[1], final_open_cycles: row.count, final_open_unrealized_adr: row.value })));
  const finalOpenByStartYear = withHashes(groupSum(finalOpenRows, (row) => `${row.rule_id}|${row.start_year}`, (row) => row.realized_or_open_adr)
    .map((row) => ({ rule_id: row.key.split("|")[0], start_year: Number(row.key.split("|")[1]), final_open_cycles: row.count, final_open_unrealized_adr: row.value })));
  const finalOpenByAge = withHashes(groupSum(finalOpenRows, (row) => `${row.rule_id}|${ageBucket(row.age_hours)}`, (row) => row.realized_or_open_adr)
    .map((row) => ({ rule_id: row.key.split("|")[0], age_bucket: row.key.split("|")[1], final_open_cycles: row.count, final_open_unrealized_adr: row.value })));
  const finalOpenByStreak = withHashes(groupSum(finalOpenRows, (row) => `${row.rule_id}|${row.direction_streak_id}`, (row) => row.realized_or_open_adr)
    .map((row) => ({ rule_id: row.key.split("|")[0], direction_streak_id: row.key.split("|")[1], final_open_cycles: row.count, final_open_unrealized_adr: row.value }))
    .sort((left, right) => left.final_open_unrealized_adr - right.final_open_unrealized_adr)
    .slice(0, 100));

  const recoveryRows = withHashes(lifecycleRules.map((rule) => recoverySummary(rule, cyclesByRule.get(rule.rule_id) ?? [])));
  const flipRows = withHashes(lifecycleRules.map((rule) => flipLossSummary(rule, cyclesByRule.get(rule.rule_id) ?? [])));
  const worstFlipLossCycles = withHashes(lifecycleRules.flatMap((rule) => (cyclesByRule.get(rule.rule_id) ?? [])
    .filter((row) => row.close_reason === "flip" && row.realized_or_open_adr < 0))
    .sort((left, right) => left.realized_or_open_adr - right.realized_or_open_adr)
    .slice(0, 250));
  const worstNeverRecoveredCycles = withHashes(lifecycleRules.flatMap((rule) => (cyclesByRule.get(rule.rule_id) ?? [])
    .filter((row) => row.went_negative && !row.recovered_to_target_after_negative))
    .sort((left, right) => left.min_pnl_adr - right.min_pnl_adr)
    .slice(0, 250));
  const worst10Weeks = withHashes(rules.flatMap((rule) => [...(weeklyRowsByRule.get(rule.rule_id) ?? [])]
    .sort((left, right) => left.equity_delta_adr - right.equity_delta_adr)
    .slice(0, 10)
    .map((row) => ({ ...row, rank_type: "worst_equity_delta" }))));
  const best10ClosedWeeks = withHashes(rules.flatMap((rule) => [...(weeklyRowsByRule.get(rule.rule_id) ?? [])]
    .sort((left, right) => right.closed_week_adr - left.closed_week_adr)
    .slice(0, 10)
    .map((row) => ({ ...row, rank_type: "best_closed_harvest" }))));

  const hashedRuleRows = withHashes(ruleRows);
  const drawdownRows = withHashes([...drawdownsByRule.values()]);
  const weeklyRows = withHashes(allWeeklyRows);
  const runtimeSeconds = round6((Date.now() - startedAt) / 1000);
  const focusRule = "PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP";
  const focus = ruleRows.find((row) => row.rule_id === focusRule);
  const gate74cFocus = gate74c.top_rules_by_equity.find((row) => row.rule_id === focusRule);
  const focusClosedMatchesGate74c = options.maxWeeks !== null || (
    focus !== undefined &&
    gate74cFocus !== undefined &&
    Math.abs(focus.closed_total_adr - gate74cFocus.closed_total_adr) <= 0.000001
  );
  const focusEquityMatchesGate74c = options.maxWeeks !== null || (
    focus !== undefined &&
    gate74cFocus !== undefined &&
    Math.abs(focus.final_equity_adr - gate74cFocus.equity_total_adr) <= 0.000001
  );
  const pass =
    gate74b.verdict.startsWith("PASS_") &&
    gate74c.verdict.startsWith("PASS_") &&
    gate74c.validation.gross_only &&
    gate74c.validation.costs_applied === false &&
    gate74c.validation.raw_m1_rebuild_performed === false &&
    gate74c.validation.risk_layer_started === false &&
    gate74c.validation.exit_promotion_started === false &&
    gate74b.warehouse.manifest_id === manifest.manifest_id &&
    gate74b.warehouse.warehouse_hash === manifest.warehouse_hash &&
    selectedWeeks.length === (options.maxWeeks ?? gate74b.warehouse.week_count) &&
    manifest.universe_symbols.length === 28 &&
    rules.length === 7 &&
    weeklyRows.length === rules.length * selectedWeeks.length &&
    Boolean(focus) &&
    focusClosedMatchesGate74c &&
    focusEquityMatchesGate74c;

  const artifacts = {
    ruleForensicsRows: toRepoRelative(path.join(artifactDir, "rule-forensics.rows.json")),
    weeklyEquityTruthRows: toRepoRelative(path.join(artifactDir, "weekly-equity-truth.rows.json")),
    finalOpenInventoryRows: toRepoRelative(path.join(artifactDir, "final-open-inventory.rows.json")),
    finalOpenByPairRows: toRepoRelative(path.join(artifactDir, "final-open-by-pair.rows.json")),
    finalOpenByStartYearRows: toRepoRelative(path.join(artifactDir, "final-open-by-start-year.rows.json")),
    finalOpenByAgeRows: toRepoRelative(path.join(artifactDir, "final-open-by-age.rows.json")),
    finalOpenByStreakRows: toRepoRelative(path.join(artifactDir, "final-open-by-streak.rows.json")),
    drawdownRows: toRepoRelative(path.join(artifactDir, "drawdown-windows.rows.json")),
    drawdownPairContributors: toRepoRelative(path.join(artifactDir, "drawdown-pair-contributors.rows.json")),
    drawdownCurrencyContributors: toRepoRelative(path.join(artifactDir, "drawdown-currency-contributors.rows.json")),
    flipLossSummaryRows: toRepoRelative(path.join(artifactDir, "flip-loss-summary.rows.json")),
    worstFlipLossCycles: toRepoRelative(path.join(artifactDir, "worst-flip-loss-cycles.rows.json")),
    recoverySummaryRows: toRepoRelative(path.join(artifactDir, "recovery-summary.rows.json")),
    worstNeverRecoveredCycles: toRepoRelative(path.join(artifactDir, "worst-never-recovered-cycles.rows.json")),
    worst10Weeks: toRepoRelative(path.join(artifactDir, "worst-10-equity-weeks.rows.json")),
    best10ClosedWeeks: toRepoRelative(path.join(artifactDir, "best-10-closed-harvest-weeks.rows.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate74d-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate74d-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass
      ? "PASS_GATE74D_PAIR_NET_GRID_OPEN_LOSS_FORENSICS__UNRESOLVED_INVENTORY_AND_DRAWDOWN_ANATOMY_VISIBLE"
      : "FAIL_GATE74D_PAIR_NET_GRID_OPEN_LOSS_FORENSICS",
    warehouse: {
      manifest_id: manifest.manifest_id,
      warehouse_hash: manifest.warehouse_hash,
      contract_id: manifest.contract_id,
      path_payload_codec: manifest.path_payload_codec,
      week_count: selectedWeeks.length,
      pair_count: manifest.universe_symbols.length,
      pair_week_rows_replayed: selectedWeeks.length * manifest.universe_symbols.length,
      source_path_point_count: options.maxWeeks === null ? manifest.path_point_count : "partial-max-weeks-run",
    },
    focus_adapter: focus,
    validation: {
      gate74b_passed: gate74b.verdict.startsWith("PASS_"),
      gate74c_passed: gate74c.verdict.startsWith("PASS_"),
      gate74b_manifest_complete: manifest.status === "complete",
      warehouse_hash_matches_gate74b_summary: gate74b.warehouse.warehouse_hash === manifest.warehouse_hash,
      selected_weeks: selectedWeeks.length,
      selected_pairs: manifest.universe_symbols.length,
      controls_replayed: rules.filter((rule) => rule.rule_family === "control").length,
      lifecycle_rules_replayed: rules.filter((rule) => rule.kind === "pair_net_grid_cycle").length,
      weekly_rows: weeklyRows.length,
      final_open_inventory_rows: finalOpenRows.length,
      focus_closed_matches_gate74c: focusClosedMatchesGate74c,
      focus_equity_matches_gate74c: focusEquityMatchesGate74c,
      gross_only: true,
      costs_applied: false,
      raw_m1_rebuild_performed: false,
      account_equity_exit_policy_started: false,
      broad_spacing_matrix_started: false,
      narrow_spacing_robustness_check: true,
      pair_pruning_started: false,
      risk_layer_started: false,
      exit_promotion_started: false,
      mt5_live_runtime_started: false,
      brain_truth_mutated: false,
      source_mutation_started: false,
      runtime_seconds: runtimeSeconds,
    },
    artifacts,
  };

  await writeJson(path.join(artifactDir, "rule-forensics.rows.json"), hashedRuleRows);
  await writeJson(path.join(artifactDir, "weekly-equity-truth.rows.json"), weeklyRows);
  await writeJson(path.join(artifactDir, "final-open-inventory.rows.json"), finalOpenRows);
  await writeJson(path.join(artifactDir, "final-open-by-pair.rows.json"), finalOpenByPair);
  await writeJson(path.join(artifactDir, "final-open-by-start-year.rows.json"), finalOpenByStartYear);
  await writeJson(path.join(artifactDir, "final-open-by-age.rows.json"), finalOpenByAge);
  await writeJson(path.join(artifactDir, "final-open-by-streak.rows.json"), finalOpenByStreak);
  await writeJson(path.join(artifactDir, "drawdown-windows.rows.json"), drawdownRows);
  await writeJson(path.join(artifactDir, "drawdown-pair-contributors.rows.json"), allDrawdownPairRows);
  await writeJson(path.join(artifactDir, "drawdown-currency-contributors.rows.json"), allDrawdownCurrencyRows);
  await writeJson(path.join(artifactDir, "flip-loss-summary.rows.json"), flipRows);
  await writeJson(path.join(artifactDir, "worst-flip-loss-cycles.rows.json"), worstFlipLossCycles);
  await writeJson(path.join(artifactDir, "recovery-summary.rows.json"), recoveryRows);
  await writeJson(path.join(artifactDir, "worst-never-recovered-cycles.rows.json"), worstNeverRecoveredCycles);
  await writeJson(path.join(artifactDir, "worst-10-equity-weeks.rows.json"), worst10Weeks);
  await writeJson(path.join(artifactDir, "best-10-closed-harvest-weeks.rows.json"), best10ClosedWeeks);
  await writeJson(path.join(artifactDir, "gate74d-summary.json"), summary);
  await writeText(reportPath, renderReport(summary, hashedRuleRows, recoveryRows, flipRows));
  await writeShaManifest(path.join(artifactDir, "gate74d-sha256.txt"), GATE_ID, COMMAND, [
    { label: "rule_forensics_rows", path: path.join(artifactDir, "rule-forensics.rows.json") },
    { label: "weekly_equity_truth_rows", path: path.join(artifactDir, "weekly-equity-truth.rows.json") },
    { label: "final_open_inventory_rows", path: path.join(artifactDir, "final-open-inventory.rows.json") },
    { label: "final_open_by_pair_rows", path: path.join(artifactDir, "final-open-by-pair.rows.json") },
    { label: "final_open_by_start_year_rows", path: path.join(artifactDir, "final-open-by-start-year.rows.json") },
    { label: "final_open_by_age_rows", path: path.join(artifactDir, "final-open-by-age.rows.json") },
    { label: "final_open_by_streak_rows", path: path.join(artifactDir, "final-open-by-streak.rows.json") },
    { label: "drawdown_rows", path: path.join(artifactDir, "drawdown-windows.rows.json") },
    { label: "drawdown_pair_contributors", path: path.join(artifactDir, "drawdown-pair-contributors.rows.json") },
    { label: "drawdown_currency_contributors", path: path.join(artifactDir, "drawdown-currency-contributors.rows.json") },
    { label: "flip_loss_summary_rows", path: path.join(artifactDir, "flip-loss-summary.rows.json") },
    { label: "worst_flip_loss_cycles", path: path.join(artifactDir, "worst-flip-loss-cycles.rows.json") },
    { label: "recovery_summary_rows", path: path.join(artifactDir, "recovery-summary.rows.json") },
    { label: "worst_never_recovered_cycles", path: path.join(artifactDir, "worst-never-recovered-cycles.rows.json") },
    { label: "worst_10_weeks", path: path.join(artifactDir, "worst-10-equity-weeks.rows.json") },
    { label: "best_10_closed_weeks", path: path.join(artifactDir, "best-10-closed-harvest-weeks.rows.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate74d-summary.json") },
    { label: "report", path: reportPath },
  ]);
  if (!pass) throw new Error(summary.verdict);
  console.log(summary.verdict);
  console.log(JSON.stringify({
    validation: summary.validation,
    focus_adapter: focus,
    top_final_open_by_pair: finalOpenByPair
      .filter((row) => row.rule_id === focusRule)
      .sort((left, right) => left.final_open_unrealized_adr - right.final_open_unrealized_adr)
      .slice(0, 8),
    artifacts,
  }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePoolIfInitialized();
    if (process.exitCode && process.exitCode !== 0) process.exit(process.exitCode);
  });
