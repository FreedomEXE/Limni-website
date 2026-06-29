import { mkdir } from "node:fs/promises";
import path from "node:path";

import { closePoolIfInitialized } from "@database/db/client";
import {
  readTradeLegPathWarehouseManifest,
  readTradeLegPathWarehousePairSeries,
  readTradeLegPathWarehouseWeekKeys,
  type TradeLegPathReplayPairWeek,
} from "@engine/research/tradeLegPathWarehouse";
import { sha256Stable } from "@engine/research/hash";

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

const GATE_ID = "Gate 74C: gross-replay-adapter-sanity-pack";
const GATE_DATE = "2026-06-29";
const COMMAND = "npm run engine:gate74c:gross-replay-adapter-sanity-pack";
const DEFAULT_GATE74A_DIR = "docs/research/gates/gate74a/artifacts/gate74a-trade-leg-path-warehouse-protocol-freeze";
const DEFAULT_GATE74B_DIR = "docs/research/gates/gate74b/artifacts/gate74b-trade-leg-path-materialization";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate74c/artifacts/gate74c-gross-replay-adapter-sanity-pack";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate74c/GATE74C_GROSS_REPLAY_ADAPTER_SANITY_PACK_${GATE_DATE}.md`;
const DEFAULT_SPACING_ADR = 0.2;
const TARGETS_ADR = [0.2, 0.3, 0.5, 0.75, 1] as const;

type Gate74aSummary = {
  verdict: string;
  validation: {
    candidate_b_forced28_preserved: boolean;
    replay_adapters_started: boolean;
    policy_optimization_started: boolean;
    risk_layer_started: boolean;
    mt5_live_runtime_started: boolean;
    brain_truth_mutated: boolean;
  };
};

type Gate74bSummary = {
  verdict: string;
  warehouse: {
    manifest_id: string;
    warehouse_hash: string;
    week_count: number;
    pair_week_count: number;
    path_point_count: number;
    chunk_count: number;
  };
  validation: {
    candidate_b_forced28_preserved: boolean;
    no_policy_field_violations: number;
    replay_adapters_started: boolean;
    fixed_adr_target_tests_started: boolean;
    risk_layer_started: boolean;
    mt5_live_runtime_started: boolean;
    brain_truth_mutated: boolean;
    source_mutation_started: boolean;
    exit_promotion_started: boolean;
  };
};

type RuleKind = "weekly_forced_close" | "carry_until_flip" | "pair_net_grid_cycle";

type ReplayRule = {
  rule_id: string;
  rule_family: "control" | "gross_lifecycle";
  kind: RuleKind;
  spacing_adr: number | null;
  target_adr: number | null;
};

type Fill = {
  entry_price: number;
  entry_timestamp_utc: string;
  fill_index: number;
};

type Cycle = {
  side: "LONG" | "SHORT";
  cycle_start_week_open_utc: string;
  cycle_start_timestamp_utc: string;
  anchor_price: number;
  cycle_adr_pct: number;
  fills: Fill[];
  next_adverse_fill_index: number;
};

type PairRuleStats = {
  rule_id: string;
  pair: string;
  closed_total_adr: number;
  final_equity_adr: number;
  final_open_unrealized_adr: number;
  closed_events: number[];
  closed_by_week: Map<string, number>;
  equity_snapshot_by_week: Map<string, number>;
  entries: number;
  cycle_starts: number;
  cycle_closes: number;
  target_cycle_closes: number;
  flip_cycle_closes: number;
  closed_fills: number;
  max_fills_per_cycle: number;
  max_open_loss_adr: number;
  flip_loss_total_adr: number;
  flip_loss_events: number;
  carried_weekend_cycles: number;
  max_closed_cycle_hold_hours: number;
  total_closed_cycle_hold_hours: number;
  oldest_final_open_cycle_age_hours: number;
  final_open_cycles: number;
  last_mark_price: number | null;
  last_timestamp_utc: string | null;
  current_cycle: Cycle | null;
};

type GlobalRuleStats = {
  rule: ReplayRule;
  closed_events: number[];
  closed_by_week: Map<string, number>;
  equity_snapshot_by_week: Map<string, number>;
  pair_summaries: PairSummaryRow[];
  entries: number;
  cycle_starts: number;
  cycle_closes: number;
  target_cycle_closes: number;
  flip_cycle_closes: number;
  closed_fills: number;
  max_fills_per_cycle: number;
  max_open_loss_adr: number;
  flip_loss_total_adr: number;
  flip_loss_events: number;
  carried_weekend_cycles: number;
  max_closed_cycle_hold_hours: number;
  total_closed_cycle_hold_hours: number;
  oldest_final_open_cycle_age_hours: number;
  final_open_cycles: number;
};

type AdapterSummaryRow = {
  rule_id: string;
  rule_family: string;
  target_adr: number | null;
  spacing_adr: number | null;
  closed_total_adr: number;
  equity_total_adr: number;
  final_open_unrealized_adr: number;
  closed_profit_factor: number | null;
  equity_profit_factor: number | null;
  closed_weekly_profit_factor: number | null;
  equity_max_drawdown_adr: number;
  closed_weekly_max_drawdown_adr: number;
  profitable_equity_week_rate: number;
  entries: number;
  cycle_starts: number;
  cycle_closes: number;
  target_cycle_closes: number;
  flip_cycle_closes: number;
  closed_fills: number;
  max_fills_per_cycle: number;
  max_open_loss_adr: number;
  flip_loss_total_adr: number;
  flip_loss_events: number;
  carried_weekend_cycles: number;
  average_closed_cycle_hold_hours: number | null;
  max_closed_cycle_hold_hours: number;
  oldest_final_open_cycle_age_hours: number;
  final_open_cycles: number;
  top20_week_equity_adr: number;
  top20_week_equity_retention_vs_weekly_forced: number | null;
  content_hash?: string;
};

type WeeklyRow = {
  rule_id: string;
  week_open_utc: string;
  year: number;
  closed_week_adr: number;
  equity_snapshot_adr: number;
  equity_delta_adr: number;
};

type PairSummaryRow = {
  rule_id: string;
  pair: string;
  closed_total_adr: number;
  final_equity_adr: number;
  final_open_unrealized_adr: number;
  entries: number;
  cycle_starts: number;
  cycle_closes: number;
  target_cycle_closes: number;
  flip_cycle_closes: number;
  max_fills_per_cycle: number;
  max_open_loss_adr: number;
  flip_loss_total_adr: number;
  carried_weekend_cycles: number;
  oldest_final_open_cycle_age_hours: number;
};

type AnnualRow = {
  rule_id: string;
  year: number;
  weeks: number;
  closed_total_adr: number;
  equity_total_adr: number;
  closed_weekly_profit_factor: number | null;
  equity_profit_factor: number | null;
  profitable_equity_week_rate: number;
};

type Gate74cSummary = {
  gate_id: string;
  command: string;
  generated_at: string;
  git_commit: string;
  verdict: string;
  warehouse: Record<string, unknown>;
  adapter_scope: Record<string, unknown>;
  validation: Record<string, unknown>;
  top_rules_by_equity: AdapterSummaryRow[];
  top_rules_by_closed: AdapterSummaryRow[];
  artifacts: Record<string, string>;
};

function parseOptions() {
  const args = parseArgMap();
  const maxWeeksRaw = args.get("--max-weeks");
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate74aDir: args.get("--gate74a-dir") ?? DEFAULT_GATE74A_DIR,
    gate74bDir: args.get("--gate74b-dir") ?? DEFAULT_GATE74B_DIR,
    manifestId: args.get("--manifest-id"),
    maxWeeks: maxWeeksRaw ? Number(maxWeeksRaw) : null,
    logProgress: process.argv.includes("--log-progress"),
  };
}

function round6(value: number) {
  return round(value, 6) ?? value;
}

function ruleSet(): ReplayRule[] {
  return [
    {
      rule_id: "WEEKLY_FORCED_CLOSE",
      rule_family: "control",
      kind: "weekly_forced_close",
      spacing_adr: null,
      target_adr: null,
    },
    {
      rule_id: "CARRY_UNTIL_FLIP",
      rule_family: "control",
      kind: "carry_until_flip",
      spacing_adr: null,
      target_adr: null,
    },
    ...TARGETS_ADR.map((target) => ({
      rule_id: `PAIR_NET_GRID_CYCLE_TARGET_${formatAdr(target)}_SPACING_020_RESTART_UNTIL_FLIP`,
      rule_family: "gross_lifecycle" as const,
      kind: "pair_net_grid_cycle" as const,
      spacing_adr: DEFAULT_SPACING_ADR,
      target_adr: target,
    })),
  ];
}

function formatAdr(value: number) {
  return String(Math.round(value * 100)).padStart(3, "0");
}

function createPairStats(rule: ReplayRule, pair: string): PairRuleStats {
  return {
    rule_id: rule.rule_id,
    pair,
    closed_total_adr: 0,
    final_equity_adr: 0,
    final_open_unrealized_adr: 0,
    closed_events: [],
    closed_by_week: new Map(),
    equity_snapshot_by_week: new Map(),
    entries: 0,
    cycle_starts: 0,
    cycle_closes: 0,
    target_cycle_closes: 0,
    flip_cycle_closes: 0,
    closed_fills: 0,
    max_fills_per_cycle: 0,
    max_open_loss_adr: 0,
    flip_loss_total_adr: 0,
    flip_loss_events: 0,
    carried_weekend_cycles: 0,
    max_closed_cycle_hold_hours: 0,
    total_closed_cycle_hold_hours: 0,
    oldest_final_open_cycle_age_hours: 0,
    final_open_cycles: 0,
    last_mark_price: null,
    last_timestamp_utc: null,
    current_cycle: null,
  };
}

function createGlobalStats(rule: ReplayRule): GlobalRuleStats {
  return {
    rule,
    closed_events: [],
    closed_by_week: new Map(),
    equity_snapshot_by_week: new Map(),
    pair_summaries: [],
    entries: 0,
    cycle_starts: 0,
    cycle_closes: 0,
    target_cycle_closes: 0,
    flip_cycle_closes: 0,
    closed_fills: 0,
    max_fills_per_cycle: 0,
    max_open_loss_adr: 0,
    flip_loss_total_adr: 0,
    flip_loss_events: 0,
    carried_weekend_cycles: 0,
    max_closed_cycle_hold_hours: 0,
    total_closed_cycle_hold_hours: 0,
    oldest_final_open_cycle_age_hours: 0,
    final_open_cycles: 0,
  };
}

function addToMap(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
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

function startCycle(stats: PairRuleStats, row: TradeLegPathReplayPairWeek, markPrice: number, timestampUtc: string) {
  stats.current_cycle = {
    side: row.candidate_b_side,
    cycle_start_week_open_utc: row.week_open_utc,
    cycle_start_timestamp_utc: timestampUtc,
    anchor_price: markPrice,
    cycle_adr_pct: row.pair_adr_pct,
    fills: [{ entry_price: markPrice, entry_timestamp_utc: timestampUtc, fill_index: 0 }],
    next_adverse_fill_index: 1,
  };
  stats.entries += 1;
  stats.cycle_starts += 1;
  stats.max_fills_per_cycle = Math.max(stats.max_fills_per_cycle, 1);
}

function closeCycle(options: {
  stats: PairRuleStats;
  markPrice: number;
  timestampUtc: string;
  weekOpenUtc: string;
  reason: "target" | "flip";
}) {
  const cycle = options.stats.current_cycle;
  if (!cycle) return 0;
  const realized = round6(cycleNetPnlAdr(cycle, options.markPrice));
  options.stats.closed_total_adr = round6(options.stats.closed_total_adr + realized);
  options.stats.closed_events.push(realized);
  addToMap(options.stats.closed_by_week, options.weekOpenUtc, realized);
  options.stats.cycle_closes += 1;
  options.stats.closed_fills += cycle.fills.length;
  if (options.reason === "target") options.stats.target_cycle_closes += 1;
  if (options.reason === "flip") {
    options.stats.flip_cycle_closes += 1;
    if (realized < 0) {
      options.stats.flip_loss_total_adr = round6(options.stats.flip_loss_total_adr + realized);
      options.stats.flip_loss_events += 1;
    }
  }
  const holdHours = (Date.parse(options.timestampUtc) - Date.parse(cycle.cycle_start_timestamp_utc)) / 3_600_000;
  if (Number.isFinite(holdHours) && holdHours >= 0) {
    options.stats.total_closed_cycle_hold_hours += holdHours;
    options.stats.max_closed_cycle_hold_hours = Math.max(options.stats.max_closed_cycle_hold_hours, holdHours);
  }
  options.stats.current_cycle = null;
  return realized;
}

function addAdverseGridFills(options: {
  stats: PairRuleStats;
  spacingAdr: number;
  markPrice: number;
  timestampUtc: string;
}) {
  const cycle = options.stats.current_cycle;
  if (!cycle) return;
  const directed = directedMoveFromCycle(cycle, options.markPrice);
  while (directed <= -options.spacingAdr * cycle.next_adverse_fill_index) {
    const fillIndex = cycle.next_adverse_fill_index;
    cycle.fills.push({
      entry_price: priceAtDirectedMove(cycle, -options.spacingAdr * fillIndex),
      entry_timestamp_utc: options.timestampUtc,
      fill_index: fillIndex,
    });
    options.stats.entries += 1;
    cycle.next_adverse_fill_index += 1;
    options.stats.max_fills_per_cycle = Math.max(options.stats.max_fills_per_cycle, cycle.fills.length);
  }
}

function updateOpenRisk(stats: PairRuleStats, markPrice: number) {
  if (!stats.current_cycle) return 0;
  const open = round6(cycleNetPnlAdr(stats.current_cycle, markPrice));
  stats.max_open_loss_adr = Math.min(stats.max_open_loss_adr, open);
  return open;
}

function replayWeeklyForcedClose(pair: string, rows: TradeLegPathReplayPairWeek[], selectedWeeks: string[]) {
  const stats = createPairStats({
    rule_id: "WEEKLY_FORCED_CLOSE",
    rule_family: "control",
    kind: "weekly_forced_close",
    spacing_adr: null,
    target_adr: null,
  }, pair);
  let cumulative = 0;
  const rowsByWeek = new Map(rows.map((row) => [row.week_open_utc, row]));
  for (const week of selectedWeeks) {
    const row = rowsByWeek.get(week);
    const value = row ? row.friday_close_adr : 0;
    cumulative = round6(cumulative + value);
    stats.closed_total_adr = cumulative;
    stats.closed_events.push(value);
    addToMap(stats.closed_by_week, week, value);
    stats.equity_snapshot_by_week.set(week, cumulative);
  }
  stats.final_equity_adr = cumulative;
  return stats;
}

function replayLifecycleRule(rule: ReplayRule, pair: string, rows: TradeLegPathReplayPairWeek[], selectedWeeks: string[]) {
  const stats = createPairStats(rule, pair);
  const rowsByWeek = new Map(rows.map((row) => [row.week_open_utc, row]));
  for (const week of selectedWeeks) {
    const row = rowsByWeek.get(week);
    if (!row) {
      stats.equity_snapshot_by_week.set(week, round6(stats.closed_total_adr + (stats.current_cycle && stats.last_mark_price !== null ? cycleNetPnlAdr(stats.current_cycle, stats.last_mark_price) : 0)));
      continue;
    }
    const payload = row.path_payload;
    for (let index = 0; index < payload.timestamp_utc.length; index += 1) {
      const timestamp = payload.timestamp_utc[index]!;
      const directedClose = payload.directed_close_adr[index] ?? 0;
      const markPrice = markPriceFromDirectedClose(row, directedClose);
      stats.last_mark_price = markPrice;
      stats.last_timestamp_utc = timestamp;
      if (stats.current_cycle && stats.current_cycle.side !== row.candidate_b_side) {
        closeCycle({
          stats,
          markPrice,
          timestampUtc: timestamp,
          weekOpenUtc: row.week_open_utc,
          reason: "flip",
        });
      }
      if (!stats.current_cycle) startCycle(stats, row, markPrice, timestamp);
      if (rule.kind === "pair_net_grid_cycle") {
        addAdverseGridFills({
          stats,
          spacingAdr: rule.spacing_adr ?? DEFAULT_SPACING_ADR,
          markPrice,
          timestampUtc: timestamp,
        });
      }
      const open = updateOpenRisk(stats, markPrice);
      if (rule.kind === "pair_net_grid_cycle" && rule.target_adr !== null && open >= rule.target_adr) {
        closeCycle({
          stats,
          markPrice,
          timestampUtc: timestamp,
          weekOpenUtc: row.week_open_utc,
          reason: "target",
        });
        startCycle(stats, row, markPrice, timestamp);
      }
    }
    const open = stats.current_cycle && stats.last_mark_price !== null ? cycleNetPnlAdr(stats.current_cycle, stats.last_mark_price) : 0;
    stats.equity_snapshot_by_week.set(week, round6(stats.closed_total_adr + open));
    if (stats.current_cycle) stats.carried_weekend_cycles += 1;
  }
  const finalOpen = stats.current_cycle && stats.last_mark_price !== null ? cycleNetPnlAdr(stats.current_cycle, stats.last_mark_price) : 0;
  stats.final_open_unrealized_adr = round6(finalOpen);
  stats.final_equity_adr = round6(stats.closed_total_adr + finalOpen);
  stats.final_open_cycles = stats.current_cycle ? 1 : 0;
  if (stats.current_cycle && stats.last_timestamp_utc) {
    const ageHours = (Date.parse(stats.last_timestamp_utc) - Date.parse(stats.current_cycle.cycle_start_timestamp_utc)) / 3_600_000;
    stats.oldest_final_open_cycle_age_hours = Number.isFinite(ageHours) && ageHours > 0 ? round6(ageHours) : 0;
  }
  return stats;
}

function mergePairStats(global: GlobalRuleStats, pairStats: PairRuleStats, selectedWeeks: string[]) {
  global.closed_events.push(...pairStats.closed_events);
  for (const week of selectedWeeks) {
    addToMap(global.closed_by_week, week, pairStats.closed_by_week.get(week) ?? 0);
    addToMap(global.equity_snapshot_by_week, week, pairStats.equity_snapshot_by_week.get(week) ?? 0);
  }
  global.entries += pairStats.entries;
  global.cycle_starts += pairStats.cycle_starts;
  global.cycle_closes += pairStats.cycle_closes;
  global.target_cycle_closes += pairStats.target_cycle_closes;
  global.flip_cycle_closes += pairStats.flip_cycle_closes;
  global.closed_fills += pairStats.closed_fills;
  global.max_fills_per_cycle = Math.max(global.max_fills_per_cycle, pairStats.max_fills_per_cycle);
  global.max_open_loss_adr = Math.min(global.max_open_loss_adr, pairStats.max_open_loss_adr);
  global.flip_loss_total_adr = round6(global.flip_loss_total_adr + pairStats.flip_loss_total_adr);
  global.flip_loss_events += pairStats.flip_loss_events;
  global.carried_weekend_cycles += pairStats.carried_weekend_cycles;
  global.max_closed_cycle_hold_hours = Math.max(global.max_closed_cycle_hold_hours, pairStats.max_closed_cycle_hold_hours);
  global.total_closed_cycle_hold_hours += pairStats.total_closed_cycle_hold_hours;
  global.oldest_final_open_cycle_age_hours = Math.max(global.oldest_final_open_cycle_age_hours, pairStats.oldest_final_open_cycle_age_hours);
  global.final_open_cycles += pairStats.final_open_cycles;
  global.pair_summaries.push({
    rule_id: pairStats.rule_id,
    pair: pairStats.pair,
    closed_total_adr: round6(pairStats.closed_total_adr),
    final_equity_adr: round6(pairStats.final_equity_adr),
    final_open_unrealized_adr: round6(pairStats.final_open_unrealized_adr),
    entries: pairStats.entries,
    cycle_starts: pairStats.cycle_starts,
    cycle_closes: pairStats.cycle_closes,
    target_cycle_closes: pairStats.target_cycle_closes,
    flip_cycle_closes: pairStats.flip_cycle_closes,
    max_fills_per_cycle: pairStats.max_fills_per_cycle,
    max_open_loss_adr: round6(pairStats.max_open_loss_adr),
    flip_loss_total_adr: round6(pairStats.flip_loss_total_adr),
    carried_weekend_cycles: pairStats.carried_weekend_cycles,
    oldest_final_open_cycle_age_hours: round6(pairStats.oldest_final_open_cycle_age_hours),
  });
}

function weeklyRowsForRule(stats: GlobalRuleStats, selectedWeeks: string[]) {
  const rows: WeeklyRow[] = [];
  let previousEquity = 0;
  for (const week of selectedWeeks) {
    const snapshot = round6(stats.equity_snapshot_by_week.get(week) ?? previousEquity);
    const delta = round6(snapshot - previousEquity);
    rows.push({
      rule_id: stats.rule.rule_id,
      week_open_utc: week,
      year: new Date(week).getUTCFullYear(),
      closed_week_adr: round6(stats.closed_by_week.get(week) ?? 0),
      equity_snapshot_adr: snapshot,
      equity_delta_adr: delta,
    });
    previousEquity = snapshot;
  }
  return rows;
}

function maxDrawdownFromValues(values: number[]) {
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const value of values) {
    equity += value;
    peak = Math.max(peak, equity);
    maxDd = Math.min(maxDd, equity - peak);
  }
  return round6(maxDd);
}

function summarizeRule(stats: GlobalRuleStats, weeklyRows: WeeklyRow[], topWeeks: Set<string>, topWeekBaselineAdr: number): AdapterSummaryRow {
  const equityDeltas = weeklyRows.map((row) => row.equity_delta_adr);
  const closedWeeks = weeklyRows.map((row) => row.closed_week_adr);
  const closedTotal = round6(stats.closed_events.reduce((sum, value) => sum + value, 0));
  const equityTotal = round6(equityDeltas.reduce((sum, value) => sum + value, 0));
  const top20WeekEquity = round6(weeklyRows.filter((row) => topWeeks.has(row.week_open_utc)).reduce((sum, row) => sum + row.equity_delta_adr, 0));
  const averageHold = stats.cycle_closes > 0 ? round6(stats.total_closed_cycle_hold_hours / stats.cycle_closes) : null;
  return {
    rule_id: stats.rule.rule_id,
    rule_family: stats.rule.rule_family,
    target_adr: stats.rule.target_adr,
    spacing_adr: stats.rule.spacing_adr,
    closed_total_adr: closedTotal,
    equity_total_adr: equityTotal,
    final_open_unrealized_adr: round6(equityTotal - closedTotal),
    closed_profit_factor: profitFactor(stats.closed_events),
    equity_profit_factor: profitFactor(equityDeltas),
    closed_weekly_profit_factor: profitFactor(closedWeeks),
    equity_max_drawdown_adr: maxDrawdownFromValues(equityDeltas),
    closed_weekly_max_drawdown_adr: maxDrawdownFromValues(closedWeeks),
    profitable_equity_week_rate: round6(equityDeltas.filter((value) => value > 0).length / Math.max(1, equityDeltas.length)),
    entries: stats.entries,
    cycle_starts: stats.cycle_starts,
    cycle_closes: stats.cycle_closes,
    target_cycle_closes: stats.target_cycle_closes,
    flip_cycle_closes: stats.flip_cycle_closes,
    closed_fills: stats.closed_fills,
    max_fills_per_cycle: stats.max_fills_per_cycle,
    max_open_loss_adr: round6(stats.max_open_loss_adr),
    flip_loss_total_adr: round6(stats.flip_loss_total_adr),
    flip_loss_events: stats.flip_loss_events,
    carried_weekend_cycles: stats.carried_weekend_cycles,
    average_closed_cycle_hold_hours: averageHold,
    max_closed_cycle_hold_hours: round6(stats.max_closed_cycle_hold_hours),
    oldest_final_open_cycle_age_hours: round6(stats.oldest_final_open_cycle_age_hours),
    final_open_cycles: stats.final_open_cycles,
    top20_week_equity_adr: top20WeekEquity,
    top20_week_equity_retention_vs_weekly_forced: topWeekBaselineAdr === 0 ? null : round6(top20WeekEquity / topWeekBaselineAdr),
  };
}

function annualRows(weeklyRows: WeeklyRow[]) {
  const byYear = new Map<number, WeeklyRow[]>();
  for (const row of weeklyRows) {
    const rows = byYear.get(row.year) ?? [];
    rows.push(row);
    byYear.set(row.year, rows);
  }
  const output: AnnualRow[] = [];
  for (const [year, rows] of [...byYear.entries()].sort(([left], [right]) => left - right)) {
    const closed = rows.map((row) => row.closed_week_adr);
    const equity = rows.map((row) => row.equity_delta_adr);
    output.push({
      rule_id: rows[0]?.rule_id ?? "",
      year,
      weeks: rows.length,
      closed_total_adr: round6(closed.reduce((sum, value) => sum + value, 0)),
      equity_total_adr: round6(equity.reduce((sum, value) => sum + value, 0)),
      closed_weekly_profit_factor: profitFactor(closed),
      equity_profit_factor: profitFactor(equity),
      profitable_equity_week_rate: round6(equity.filter((value) => value > 0).length / Math.max(1, equity.length)),
    });
  }
  return output;
}

function addHashes(rows: AdapterSummaryRow[]) {
  return rows.map((row) => ({
    ...row,
    content_hash: sha256Stable(row),
  }));
}

function tableRows(rows: AdapterSummaryRow[]) {
  return rows.map((row) => ({
    rule_id: row.rule_id,
    closed: row.closed_total_adr,
    equity: row.equity_total_adr,
    eq_pf: row.equity_profit_factor,
    eq_dd: row.equity_max_drawdown_adr,
    win_rate: row.profitable_equity_week_rate,
    max_fills: row.max_fills_per_cycle,
    max_open_loss: row.max_open_loss_adr,
    flip_loss: row.flip_loss_total_adr,
    top20_ret: row.top20_week_equity_retention_vs_weekly_forced,
  }));
}

function renderReport(summary: Gate74cSummary, adapterRows: AdapterSummaryRow[]) {
  return [
    "# Gate 74C Gross Replay Adapter Sanity Pack",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Replays a small gross-only adapter pack from the frozen Gate 74B trade-leg path warehouse.",
    "- Tests independent pair net-grid cycle exits first; account-level equity exits are not active policy in this gate.",
    "- Keeps grid spacing fixed at `0.2 ADR`; only net cycle target varies from `0.2` to `1.0 ADR`.",
    "- Applies no spread, slippage, swap, commission, risk sizing, pair pruning, or promotion logic.",
    "",
    "## Warehouse",
    "",
    "```json",
    JSON.stringify(summary.warehouse, null, 2),
    "```",
    "",
    "## Adapter Results",
    "",
    renderTable(tableRows(adapterRows), ["rule_id", "closed", "equity", "eq_pf", "eq_dd", "win_rate", "max_fills", "max_open_loss", "flip_loss", "top20_ret"]),
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Adapter summary rows: \`${summary.artifacts.adapterSummaryRows}\``,
    `- Weekly equity rows: \`${summary.artifacts.weeklyEquityRows}\``,
    `- Pair summary rows: \`${summary.artifacts.pairSummaryRows}\``,
    `- Annual rows: \`${summary.artifacts.annualRows}\``,
    `- Top-week retention: \`${summary.artifacts.topWeekRetention}\``,
    `- Summary: \`${summary.artifacts.summaryJson}\``,
    `- SHA identity: \`${summary.artifacts.shaIdentity}\``,
    "",
    "## Stop Line",
    "",
    "Gate 74C is gross replay discovery only. Costs, account-level equity exits, risk/correlation pruning, pair selection, promotion, MT5/live/runtime, source mutation, Brain mutation, and optimized spacing matrices remain closed unless explicitly opened.",
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

  const gate74a = await readJson<Gate74aSummary>(path.join(options.gate74aDir, "gate74a-summary.json"));
  const gate74b = await readJson<Gate74bSummary>(path.join(options.gate74bDir, "gate74b-summary.json"));
  const manifestId = options.manifestId ?? gate74b.warehouse.manifest_id;
  const manifest = await readTradeLegPathWarehouseManifest(manifestId);
  if (!manifest) throw new Error(`Gate 74C requires completed Gate 74B warehouse manifest: ${manifestId}`);
  if (manifest.status !== "complete") throw new Error(`Gate 74B warehouse is not complete: ${manifestId} status=${manifest.status}`);
  const allWeeks = await readTradeLegPathWarehouseWeekKeys(manifestId);
  const selectedWeeks = allWeeks.slice(0, options.maxWeeks ?? undefined);
  const rules = ruleSet();
  const globals = new Map(rules.map((rule) => [rule.rule_id, createGlobalStats(rule)]));
  const startedAt = Date.now();

  for (const [pairIndex, pair] of manifest.universe_symbols.entries()) {
    const rows = await readTradeLegPathWarehousePairSeries({
      manifestId,
      pair,
      weeks: selectedWeeks,
    });
    const rowsByWeek = new Set(rows.map((row) => row.week_open_utc));
    if (rows.length !== selectedWeeks.length || selectedWeeks.some((week) => !rowsByWeek.has(week))) {
      throw new Error(`Incomplete Gate 74B pair series for ${pair}: rows=${rows.length}, weeks=${selectedWeeks.length}`);
    }
    for (const rule of rules) {
      const pairStats = rule.kind === "weekly_forced_close"
        ? replayWeeklyForcedClose(pair, rows, selectedWeeks)
        : replayLifecycleRule(rule, pair, rows, selectedWeeks);
      mergePairStats(globals.get(rule.rule_id)!, pairStats, selectedWeeks);
    }
    if (options.logProgress) {
      console.log(`gate74c pair=${pairIndex + 1}/${manifest.universe_symbols.length} ${pair}`);
    }
  }

  const weeklyRows = [...globals.values()].flatMap((stats) => weeklyRowsForRule(stats, selectedWeeks));
  const weeklyForcedRows = weeklyRows.filter((row) => row.rule_id === "WEEKLY_FORCED_CLOSE");
  const top20Weeks = [...weeklyForcedRows]
    .sort((left, right) => right.equity_delta_adr - left.equity_delta_adr)
    .slice(0, Math.min(20, weeklyForcedRows.length));
  const topWeeks = new Set(top20Weeks.map((row) => row.week_open_utc));
  const topWeekBaselineAdr = round6(top20Weeks.reduce((sum, row) => sum + row.equity_delta_adr, 0));
  const adapterRows = addHashes([...globals.values()].map((stats) => summarizeRule(
    stats,
    weeklyRows.filter((row) => row.rule_id === stats.rule.rule_id),
    topWeeks,
    topWeekBaselineAdr,
  )));
  const pairRows = [...globals.values()].flatMap((stats) => stats.pair_summaries);
  const annual = [...globals.values()].flatMap((stats) => annualRows(weeklyRows.filter((row) => row.rule_id === stats.rule.rule_id)));
  const topWeekRetention = adapterRows.map((row) => ({
    rule_id: row.rule_id,
    top20_week_equity_adr: row.top20_week_equity_adr,
    top20_week_equity_retention_vs_weekly_forced: row.top20_week_equity_retention_vs_weekly_forced,
  }));
  const runtimeSeconds = round6((Date.now() - startedAt) / 1000);
  const artifacts = {
    adapterSummaryRows: toRepoRelative(path.join(artifactDir, "gross-replay-adapter-summary.rows.json")),
    weeklyEquityRows: toRepoRelative(path.join(artifactDir, "gross-replay-weekly-equity.rows.json")),
    pairSummaryRows: toRepoRelative(path.join(artifactDir, "gross-replay-pair-summary.rows.json")),
    annualRows: toRepoRelative(path.join(artifactDir, "gross-replay-annual.rows.json")),
    topWeekRetention: toRepoRelative(path.join(artifactDir, "top-week-retention.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate74c-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate74c-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const pass =
    gate74a.verdict.startsWith("PASS_") &&
    gate74b.verdict.startsWith("PASS_") &&
    gate74b.warehouse.manifest_id === manifest.manifest_id &&
    gate74b.warehouse.warehouse_hash === manifest.warehouse_hash &&
    gate74b.validation.candidate_b_forced28_preserved &&
    gate74b.validation.no_policy_field_violations === 0 &&
    selectedWeeks.length === (options.maxWeeks ?? gate74b.warehouse.week_count) &&
    manifest.universe_symbols.length === 28 &&
    rules.length === 7 &&
    adapterRows.length === rules.length &&
    weeklyRows.length === rules.length * selectedWeeks.length &&
    pairRows.length === rules.length * manifest.universe_symbols.length;
  const summary: Gate74cSummary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass
      ? "PASS_GATE74C_GROSS_REPLAY_ADAPTER_SANITY_PACK__PAIR_GRID_LIFECYCLE_VISIBLE_NO_PROMOTION"
      : "FAIL_GATE74C_GROSS_REPLAY_ADAPTER_SANITY_PACK",
    warehouse: {
      manifest_id: manifest.manifest_id,
      warehouse_hash: manifest.warehouse_hash,
      contract_id: manifest.contract_id,
      path_payload_codec: manifest.path_payload_codec,
      week_count: selectedWeeks.length,
      pair_count: manifest.universe_symbols.length,
      pair_week_rows_replayed: selectedWeeks.length * manifest.universe_symbols.length,
      source_path_point_count: options.maxWeeks === null ? manifest.path_point_count : "partial-max-weeks-run",
      gate74b_summary_hash_matched: gate74b.warehouse.warehouse_hash === manifest.warehouse_hash,
    },
    adapter_scope: {
      gross_only: true,
      cost_model_applied: false,
      spread_slippage_swap_commission_applied: false,
      pair_level_grid_cycles: true,
      account_level_equity_exit_policy_active: false,
      spacing_adr_fixed: DEFAULT_SPACING_ADR,
      targets_adr: [...TARGETS_ADR],
      crossing_semantics: "close-mark only",
      cycle_adr_anchor: "cycle-start ADR pct",
      unresolved_cycles_force_closed_on_week_end: false,
      unresolved_cycles_closed_on_candidate_b_flip: true,
    },
    validation: {
      gate74a_passed: gate74a.verdict.startsWith("PASS_"),
      gate74b_passed: gate74b.verdict.startsWith("PASS_"),
      gate74b_manifest_complete: manifest.status === "complete",
      warehouse_hash_matches_gate74b_summary: gate74b.warehouse.warehouse_hash === manifest.warehouse_hash,
      adapter_count: rules.length,
      expected_adapter_count: 7,
      selected_weeks: selectedWeeks.length,
      selected_pairs: manifest.universe_symbols.length,
      weekly_rows: weeklyRows.length,
      pair_summary_rows: pairRows.length,
      annual_rows: annual.length,
      gross_only: true,
      costs_applied: false,
      raw_m1_rebuild_performed: false,
      fixed_adr_spacing_matrix_started: false,
      account_equity_exit_policy_started: false,
      pair_pruning_started: false,
      risk_layer_started: false,
      exit_promotion_started: false,
      mt5_live_runtime_started: false,
      brain_truth_mutated: false,
      source_mutation_started: false,
      runtime_seconds: runtimeSeconds,
    },
    top_rules_by_equity: [...adapterRows].sort((left, right) => right.equity_total_adr - left.equity_total_adr).slice(0, 5),
    top_rules_by_closed: [...adapterRows].sort((left, right) => right.closed_total_adr - left.closed_total_adr).slice(0, 5),
    artifacts,
  };

  await writeJson(path.join(artifactDir, "gross-replay-adapter-summary.rows.json"), adapterRows);
  await writeJson(path.join(artifactDir, "gross-replay-weekly-equity.rows.json"), weeklyRows);
  await writeJson(path.join(artifactDir, "gross-replay-pair-summary.rows.json"), pairRows);
  await writeJson(path.join(artifactDir, "gross-replay-annual.rows.json"), annual);
  await writeJson(path.join(artifactDir, "top-week-retention.json"), topWeekRetention);
  await writeJson(path.join(artifactDir, "gate74c-summary.json"), summary);
  await writeText(reportPath, renderReport(summary, adapterRows));
  await writeShaManifest(path.join(artifactDir, "gate74c-sha256.txt"), GATE_ID, COMMAND, [
    { label: "adapter_summary_rows", path: path.join(artifactDir, "gross-replay-adapter-summary.rows.json") },
    { label: "weekly_equity_rows", path: path.join(artifactDir, "gross-replay-weekly-equity.rows.json") },
    { label: "pair_summary_rows", path: path.join(artifactDir, "gross-replay-pair-summary.rows.json") },
    { label: "annual_rows", path: path.join(artifactDir, "gross-replay-annual.rows.json") },
    { label: "top_week_retention", path: path.join(artifactDir, "top-week-retention.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate74c-summary.json") },
    { label: "report", path: reportPath },
  ]);
  if (!pass) throw new Error(summary.verdict);
  console.log(summary.verdict);
  console.log(JSON.stringify({ validation: summary.validation, top_rules_by_equity: summary.top_rules_by_equity, artifacts }, null, 2));
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
