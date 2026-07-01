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

const GATE_ID = "Gate 83: raw-hedged-grid-speed-simplification";
const GATE_DATE = "2026-07-01";
const COMMAND = "npm run engine:gate83:raw-hedged-grid-speed-simplification";
const DEFAULT_GATE74B_DIR = "docs/research/gates/gate74b/artifacts/gate74b-trade-leg-path-materialization";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate83/artifacts/raw-hedged-grid-speed-simplification";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate83/GATE83_RAW_HEDGED_GRID_SPEED_SIMPLIFICATION_${GATE_DATE}.md`;
const VARIANT_ID = "RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY";
const TARGET_ADR = 1;
const SPACING_ADR = 0.2;
const COST_FRACTIONS = [0, 0.0025, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5] as const;
const PROFILE_NAMES = ["FAST_SMOKE", "FAST_BASKET", "STRESS_WINDOWS", "FULL_ACCEPTANCE"] as const;
const EXPECTED_FULL_WEEKS = 373;
const EXPECTED_FULL_PAIRS = 28;

type ProfileName = (typeof PROFILE_NAMES)[number];
type Side = "LONG" | "SHORT";
type FillKind = "initial" | "adverse_recovery" | "favorable_expansion";
type CloseReason = "target" | "sample_end";
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
  validation?: {
    candidate_b_forced28_preserved?: boolean;
    raw_m1_rebuild_performed?: boolean;
  };
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
  pair: string;
  side: Side;
  week_open_utc: string;
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
  reset_ordinal_at_start: number;
};

type CloseEvent = {
  variant_id: string;
  speed_profile: ProfileName;
  pair: string;
  side: Side;
  week_open_utc: string;
  close_timestamp_utc: string;
  close_reason: CloseReason;
  realized_or_open_adr: number;
  fill_count: number;
  adverse_fill_count: number;
  expansion_fill_count: number;
  min_pnl_adr: number;
  max_pnl_adr: number;
  went_negative: boolean;
  reset_ordinal_at_start: number;
  completed_reset_ordinal: number | null;
};

type WeeklyGrossRow = {
  variant_id: string;
  speed_profile: ProfileName;
  week_open_utc: string;
  closed_pnl_adr: number;
  open_unrealized_pnl_adr: number;
  equity_delta_adr: number;
  equity_snapshot_adr: number;
  fills: number;
  resets: number;
};

type WeeklyCostRow = WeeklyGrossRow & {
  cost_fraction: number;
  closed_pnl_after_cost_adr: number;
  balance_snapshot_after_cost_adr: number;
  mtm_before_liquidation_cost_adr: number;
  liquidation_mtm_after_estimated_exit_cost_adr: number;
  modeled_entry_cost_adr: number;
  modeled_exit_cost_adr: number;
  modeled_open_liquidation_cost_adr: number;
};

type CostSummaryRow = {
  variant_id: string;
  speed_profile: ProfileName;
  symbol_universe: string;
  date_range: string;
  price_bundle_id: string | null;
  warehouse_manifest_id: string;
  warehouse_hash: string;
  weeks_replayed: number;
  pairs_replayed: number;
  pair_week_rows_replayed: number;
  cost_fraction: number;
  target_adr: number;
  round_trip_cost_adr: number;
  entry_cost_adr: number;
  exit_cost_adr: number;
  final_equity_mtm_adr: number;
  closed_pnl_adr: number;
  closed_pnl_after_cost_adr: number;
  open_unrealized_pnl_adr: number;
  liquidation_mtm_after_estimated_exit_cost_adr: number;
  max_equity_drawdown_adr: number;
  max_liquidation_drawdown_adr: number;
  max_balance_drawdown_adr: number;
  return_dd_ratio: number | null;
  weekly_mtm_profit_factor: number | null;
  weekly_sharpe: number | null;
  weekly_sortino: number | null;
  weekly_win_rate: number;
  fills: number;
  completed_round_trips: number;
  total_modeled_execution_cost_adr: number;
  total_modeled_execution_cost_with_liquidation_adr: number;
  cost_drag_pct_of_gross_profit: number | null;
  max_open_positions: number;
  max_long_positions: number;
  max_short_positions: number;
  worst_open_unrealized_adr: number;
  worst_drawdown_window_start_utc: string | null;
  worst_drawdown_window_end_utc: string | null;
  metric_semantics: "raw_no_boundary_pair_week_replay";
  content_hash?: string;
};

type RuleStats = {
  closed_by_week: Map<string, number>;
  open_by_week: Map<string, number>;
  fill_count_by_week: Map<string, number>;
  reset_count_by_week: Map<string, number>;
  closed_by_pair_week: Map<string, number>;
  open_by_pair_week: Map<string, number>;
  close_events: CloseEvent[];
  max_open_positions: number;
  max_long_positions: number;
  max_short_positions: number;
};

type Options = {
  gate74bDir: string;
  artifactDir: string;
  reportPath: string;
  manifestId: string | null;
  speedProfile: ProfileName;
  onlyPair: string | null;
  pairs: string[] | null;
  maxWeeks: number | null;
  weekFrom: string | null;
  weekTo: string | null;
  logProgress: boolean;
};

function parseOptions(): Options {
  const args = parseArgMap();
  const profileRaw = args.get("--profile") ?? "FAST_SMOKE";
  if (!PROFILE_NAMES.includes(profileRaw as ProfileName)) {
    throw new Error(`Invalid --profile=${profileRaw}. Expected one of ${PROFILE_NAMES.join(",")}`);
  }
  const maxWeeksRaw = args.get("--max-weeks");
  const pairsRaw = args.get("--pairs");
  return {
    gate74bDir: args.get("--gate74b-dir") ?? DEFAULT_GATE74B_DIR,
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    manifestId: args.get("--manifest-id") ?? null,
    speedProfile: profileRaw as ProfileName,
    onlyPair: args.get("--only-pair")?.toUpperCase() ?? null,
    pairs: pairsRaw ? pairsRaw.split(",").map((pair) => pair.trim().toUpperCase()).filter(Boolean) : null,
    maxWeeks: maxWeeksRaw ? Number(maxWeeksRaw) : null,
    weekFrom: args.get("--week-from") ?? null,
    weekTo: args.get("--week-to") ?? null,
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

function pairWeekKey(pair: string, week: string) {
  return `${pair}|${week}`;
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

function createStats(): RuleStats {
  return {
    closed_by_week: new Map(),
    open_by_week: new Map(),
    fill_count_by_week: new Map(),
    reset_count_by_week: new Map(),
    closed_by_pair_week: new Map(),
    open_by_pair_week: new Map(),
    close_events: [],
    max_open_positions: 0,
    max_long_positions: 0,
    max_short_positions: 0,
  };
}

function startCycle(options: {
  pair: string;
  row: ReplayRow;
  side: Side;
  markPrice: number;
  timestampUtc: string;
  serial: number;
  resetOrdinalAtStart: number;
}) {
  return {
    cycle_id: `${VARIANT_ID}|${options.pair}|${options.row.week_open_utc}|${options.side}|${options.serial}`,
    pair: options.pair,
    side: options.side,
    week_open_utc: options.row.week_open_utc,
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
    reset_ordinal_at_start: options.resetOrdinalAtStart,
  } satisfies Cycle;
}

function observeCycle(cycle: Cycle, markPrice: number) {
  const pnl = round6(cycleNetPnlAdr(cycle, markPrice));
  if (pnl < cycle.min_pnl_adr) cycle.min_pnl_adr = pnl;
  if (pnl > cycle.max_pnl_adr) cycle.max_pnl_adr = pnl;
  if (pnl < 0 && cycle.first_negative_timestamp_utc === null) cycle.first_negative_timestamp_utc = cycle.start_timestamp_utc;
}

function addGridFills(options: {
  cycle: Cycle;
  markPrice: number;
  timestampUtc: string;
}) {
  let addedAdverse = 0;
  let addedExpansion = 0;
  const directed = directedMoveFromCycle(options.cycle, options.markPrice);
  while (directed <= -SPACING_ADR * options.cycle.next_adverse_fill_level) {
    const level = options.cycle.next_adverse_fill_level;
    const entryPrice = priceAtDirectedMove(options.cycle, -SPACING_ADR * level);
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
  while (directed >= SPACING_ADR * options.cycle.next_favorable_fill_level) {
    const level = options.cycle.next_favorable_fill_level;
    const entryPrice = priceAtDirectedMove(options.cycle, SPACING_ADR * level);
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
  speedProfile: ProfileName;
  cycle: Cycle;
  closeReason: CloseReason;
  markPrice: number;
  timestampUtc: string;
  completedResetOrdinal?: number | null;
}) {
  observeCycle(options.cycle, options.markPrice);
  const realized = round6(cycleNetPnlAdr(options.cycle, options.markPrice));
  const adverseFillCount = round6(options.cycle.fills.filter((fill) => fill.kind === "adverse_recovery").reduce((sum, fill) => sum + fill.quantity, 0));
  const expansionFillCount = round6(options.cycle.fills.filter((fill) => fill.kind === "favorable_expansion").reduce((sum, fill) => sum + fill.quantity, 0));
  const event: CloseEvent = {
    variant_id: VARIANT_ID,
    speed_profile: options.speedProfile,
    pair: options.cycle.pair,
    side: options.cycle.side,
    week_open_utc: options.cycle.week_open_utc,
    close_timestamp_utc: options.timestampUtc,
    close_reason: options.closeReason,
    realized_or_open_adr: realized,
    fill_count: round6(options.cycle.quantity_sum),
    adverse_fill_count: adverseFillCount,
    expansion_fill_count: expansionFillCount,
    min_pnl_adr: round6(options.cycle.min_pnl_adr),
    max_pnl_adr: round6(options.cycle.max_pnl_adr),
    went_negative: options.cycle.first_negative_timestamp_utc !== null,
    reset_ordinal_at_start: options.cycle.reset_ordinal_at_start,
    completed_reset_ordinal: options.completedResetOrdinal ?? null,
  };
  options.stats.close_events.push(event);
  if (options.closeReason === "target") {
    addToMap(options.stats.closed_by_week, options.cycle.week_open_utc, realized);
    addToMap(options.stats.closed_by_pair_week, pairWeekKey(options.cycle.pair, options.cycle.week_open_utc), realized);
    incrementMap(options.stats.reset_count_by_week, options.cycle.week_open_utc);
  }
  return event;
}

function updateOpenPositionStats(stats: RuleStats, cycles: Array<Cycle | null>) {
  const longPositions = round6(cycles.filter((cycle): cycle is Cycle => cycle !== null && cycle.side === "LONG").reduce((sum, cycle) => sum + cycle.quantity_sum, 0));
  const shortPositions = round6(cycles.filter((cycle): cycle is Cycle => cycle !== null && cycle.side === "SHORT").reduce((sum, cycle) => sum + cycle.quantity_sum, 0));
  const total = round6(longPositions + shortPositions);
  stats.max_open_positions = Math.max(stats.max_open_positions, total);
  stats.max_long_positions = Math.max(stats.max_long_positions, longPositions);
  stats.max_short_positions = Math.max(stats.max_short_positions, shortPositions);
}

function replayPairWeek(stats: RuleStats, speedProfile: ProfileName, pair: string, row: ReplayRow) {
  const currentBySide = new Map<Side, Cycle | null>([["LONG", null], ["SHORT", null]]);
  const resetCountBySide = new Map<Side, number>([["LONG", 0], ["SHORT", 0]]);
  let serial = 0;
  const timestamps = row.path_payload.timestamp_utc;
  const closes = row.path_payload.directed_close_adr;
  for (let index = 0; index < timestamps.length; index += 1) {
    const timestamp = timestamps[index]!;
    const markPrice = markPriceFromDirectedClose(row, closes[index]!);
    for (const side of ["LONG", "SHORT"] as const) {
      let current = currentBySide.get(side);
      if (!current) {
        serial += 1;
        current = startCycle({
          pair,
          row,
          side,
          markPrice,
          timestampUtc: timestamp,
          serial,
          resetOrdinalAtStart: resetCountBySide.get(side) ?? 0,
        });
        currentBySide.set(side, current);
        incrementMap(stats.fill_count_by_week, row.week_open_utc);
      }
      const added = addGridFills({ cycle: current, markPrice, timestampUtc: timestamp });
      if (added.addedAdverse > 0 || added.addedExpansion > 0) {
        incrementMap(stats.fill_count_by_week, row.week_open_utc, added.addedAdverse + added.addedExpansion);
      }
      observeCycle(current, markPrice);
      if (round6(cycleNetPnlAdr(current, markPrice)) >= TARGET_ADR) {
        const nextReset = (resetCountBySide.get(side) ?? 0) + 1;
        closeCycle({
          stats,
          speedProfile,
          cycle: current,
          closeReason: "target",
          markPrice,
          timestampUtc: timestamp,
          completedResetOrdinal: nextReset,
        });
        resetCountBySide.set(side, nextReset);
        currentBySide.set(side, null);
      }
    }
    updateOpenPositionStats(stats, [...currentBySide.values()]);
  }

  const finalTimestamp = timestamps.at(-1);
  const finalClose = closes.at(-1);
  if (finalTimestamp === undefined || finalClose === undefined) {
    throw new Error(`Missing path payload for ${row.week_open_utc} ${pair}`);
  }
  const finalMark = markPriceFromDirectedClose(row, finalClose);
  let pairWeekOpen = 0;
  for (const side of ["LONG", "SHORT"] as const) {
    const current = currentBySide.get(side);
    if (!current) continue;
    const open = round6(cycleNetPnlAdr(current, finalMark));
    pairWeekOpen = round6(pairWeekOpen + open);
    closeCycle({
      stats,
      speedProfile,
      cycle: current,
      closeReason: "sample_end",
      markPrice: finalMark,
      timestampUtc: finalTimestamp,
    });
  }
  addToMap(stats.open_by_week, row.week_open_utc, pairWeekOpen);
  addToMap(stats.open_by_pair_week, pairWeekKey(pair, row.week_open_utc), pairWeekOpen);
}

function weeklyRowsForStats(stats: RuleStats, weeks: string[], speedProfile: ProfileName): WeeklyGrossRow[] {
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
      variant_id: VARIANT_ID,
      speed_profile: speedProfile,
      week_open_utc: week,
      closed_pnl_adr: closed,
      open_unrealized_pnl_adr: open,
      equity_delta_adr: delta,
      equity_snapshot_adr: equity,
      fills: stats.fill_count_by_week.get(week) ?? 0,
      resets: stats.reset_count_by_week.get(week) ?? 0,
    };
  });
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

function drawdownStats(rows: Array<{ week_open_utc: string; value: number }>) {
  let peak = 0;
  let peakWeek: string | null = null;
  let worst = 0;
  let worstStart: string | null = null;
  let worstEnd: string | null = null;
  for (const row of rows) {
    if (row.value > peak) {
      peak = row.value;
      peakWeek = row.week_open_utc;
    }
    const drawdown = round6(row.value - peak);
    if (drawdown < worst) {
      worst = drawdown;
      worstStart = peakWeek;
      worstEnd = row.week_open_utc;
    }
  }
  return { drawdown: round6(worst), start: worstStart, end: worstEnd };
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text.includes(",") || text.includes("\n") || text.includes('"')) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const columns = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  return `${[columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n")}\n`;
}

async function writeRows(jsonPath: string, csvPath: string, rows: Record<string, unknown>[]) {
  await writeJson(jsonPath, rows);
  await writeText(csvPath, toCsv(rows));
}

function withHash<T extends Record<string, unknown>>(row: T): T & { content_hash: string } {
  const copy = { ...row };
  delete copy.content_hash;
  return { ...row, content_hash: sha256Stable(copy) };
}

function buildWeeklyCostRows(stats: RuleStats, weeks: string[], speedProfile: ProfileName, costFraction: number): WeeklyCostRow[] {
  const entryCost = TARGET_ADR * costFraction / 2;
  const exitCost = TARGET_ADR * costFraction / 2;
  let previousMtm = 0;
  let closedCumulative = 0;
  return weeks.map((week) => {
    const events = stats.close_events.filter((event) => event.week_open_utc === week);
    const closedEvents = events.filter((event) => event.close_reason === "target");
    const openEvents = events.filter((event) => event.close_reason === "sample_end");
    const closedGross = round6(stats.closed_by_week.get(week) ?? 0);
    const openGross = round6(stats.open_by_week.get(week) ?? 0);
    const closedEntryCost = round6(closedEvents.reduce((sum, event) => sum + event.fill_count * entryCost, 0));
    const closedExitCost = round6(closedEvents.reduce((sum, event) => sum + event.fill_count * exitCost, 0));
    const openEntryCost = round6(openEvents.reduce((sum, event) => sum + event.fill_count * entryCost, 0));
    const openExitCost = round6(openEvents.reduce((sum, event) => sum + event.fill_count * exitCost, 0));
    const closedAfterCost = round6(closedGross - closedEntryCost - closedExitCost);
    closedCumulative = round6(closedCumulative + closedAfterCost);
    const mtmBeforeLiquidation = round6(closedCumulative + openGross - openEntryCost);
    const liquidationMtm = round6(mtmBeforeLiquidation - openExitCost);
    const delta = round6(mtmBeforeLiquidation - previousMtm);
    previousMtm = mtmBeforeLiquidation;
    return {
      variant_id: VARIANT_ID,
      speed_profile: speedProfile,
      week_open_utc: week,
      cost_fraction: costFraction,
      closed_pnl_adr: closedGross,
      open_unrealized_pnl_adr: openGross,
      equity_delta_adr: delta,
      equity_snapshot_adr: mtmBeforeLiquidation,
      fills: stats.fill_count_by_week.get(week) ?? 0,
      resets: stats.reset_count_by_week.get(week) ?? 0,
      closed_pnl_after_cost_adr: closedAfterCost,
      balance_snapshot_after_cost_adr: closedCumulative,
      mtm_before_liquidation_cost_adr: mtmBeforeLiquidation,
      liquidation_mtm_after_estimated_exit_cost_adr: liquidationMtm,
      modeled_entry_cost_adr: round6(closedEntryCost + openEntryCost),
      modeled_exit_cost_adr: closedExitCost,
      modeled_open_liquidation_cost_adr: openExitCost,
    };
  });
}

function summarizeCostTier(params: {
  stats: RuleStats;
  weeklyCostRows: WeeklyCostRow[];
  costFraction: number;
  speedProfile: ProfileName;
  selectedPairs: string[];
  selectedWeeks: string[];
  manifest: { manifest_id: string; warehouse_hash: string; price_bundle_id?: string | null };
}): CostSummaryRow {
  const rows = params.weeklyCostRows;
  const values = rows.map((row) => row.equity_delta_adr);
  const liquidationValues = rows.map((row) => row.liquidation_mtm_after_estimated_exit_cost_adr);
  const balanceValues = rows.map((row) => row.balance_snapshot_after_cost_adr);
  const equityDrawdown = drawdownStats(rows.map((row) => ({ week_open_utc: row.week_open_utc, value: row.mtm_before_liquidation_cost_adr })));
  const liquidationDrawdown = drawdownStats(rows.map((row) => ({ week_open_utc: row.week_open_utc, value: row.liquidation_mtm_after_estimated_exit_cost_adr })));
  const balanceDrawdown = drawdownStats(rows.map((row) => ({ week_open_utc: row.week_open_utc, value: row.balance_snapshot_after_cost_adr })));
  const final = rows.at(-1);
  const closedEvents = params.stats.close_events.filter((event) => event.close_reason === "target");
  const openEvents = params.stats.close_events.filter((event) => event.close_reason === "sample_end");
  const grossProfit = round6(closedEvents.filter((event) => event.realized_or_open_adr > 0).reduce((sum, event) => sum + event.realized_or_open_adr, 0));
  const roundTripCost = TARGET_ADR * params.costFraction;
  const entryCost = roundTripCost / 2;
  const exitCost = roundTripCost / 2;
  const closedFillCost = round6(closedEvents.reduce((sum, event) => sum + event.fill_count * (entryCost + exitCost), 0));
  const openEntryCost = round6(openEvents.reduce((sum, event) => sum + event.fill_count * entryCost, 0));
  const openExitCost = round6(openEvents.reduce((sum, event) => sum + event.fill_count * exitCost, 0));
  return withHash({
    variant_id: VARIANT_ID,
    speed_profile: params.speedProfile,
    symbol_universe: params.selectedPairs.join(","),
    date_range: `${params.selectedWeeks.at(0) ?? "none"}..${params.selectedWeeks.at(-1) ?? "none"}`,
    price_bundle_id: params.manifest.price_bundle_id ?? null,
    warehouse_manifest_id: params.manifest.manifest_id,
    warehouse_hash: params.manifest.warehouse_hash,
    weeks_replayed: params.selectedWeeks.length,
    pairs_replayed: params.selectedPairs.length,
    pair_week_rows_replayed: params.selectedWeeks.length * params.selectedPairs.length,
    cost_fraction: params.costFraction,
    target_adr: TARGET_ADR,
    round_trip_cost_adr: round6(roundTripCost),
    entry_cost_adr: round6(entryCost),
    exit_cost_adr: round6(exitCost),
    final_equity_mtm_adr: final?.mtm_before_liquidation_cost_adr ?? 0,
    closed_pnl_adr: round6(closedEvents.reduce((sum, event) => sum + event.realized_or_open_adr, 0)),
    closed_pnl_after_cost_adr: final?.balance_snapshot_after_cost_adr ?? 0,
    open_unrealized_pnl_adr: final?.open_unrealized_pnl_adr ?? 0,
    liquidation_mtm_after_estimated_exit_cost_adr: final?.liquidation_mtm_after_estimated_exit_cost_adr ?? 0,
    max_equity_drawdown_adr: equityDrawdown.drawdown,
    max_liquidation_drawdown_adr: liquidationDrawdown.drawdown,
    max_balance_drawdown_adr: balanceDrawdown.drawdown,
    return_dd_ratio: equityDrawdown.drawdown === 0 ? null : round6((final?.mtm_before_liquidation_cost_adr ?? 0) / Math.abs(equityDrawdown.drawdown)),
    weekly_mtm_profit_factor: profitFactor(values),
    weekly_sharpe: weeklySharpe(values),
    weekly_sortino: weeklySortino(values),
    weekly_win_rate: round6(values.filter((value) => value > 0).length / Math.max(1, values.length)),
    fills: round6(params.stats.close_events.reduce((sum, event) => sum + event.fill_count, 0)),
    completed_round_trips: closedEvents.length,
    total_modeled_execution_cost_adr: round6(closedFillCost + openEntryCost),
    total_modeled_execution_cost_with_liquidation_adr: round6(closedFillCost + openEntryCost + openExitCost),
    cost_drag_pct_of_gross_profit: grossProfit === 0 ? null : round6(((closedFillCost + openEntryCost + openExitCost) / grossProfit) * 100),
    max_open_positions: params.stats.max_open_positions,
    max_long_positions: params.stats.max_long_positions,
    max_short_positions: params.stats.max_short_positions,
    worst_open_unrealized_adr: round6(Math.min(...rows.map((row) => row.open_unrealized_pnl_adr), 0)),
    worst_drawdown_window_start_utc: equityDrawdown.start,
    worst_drawdown_window_end_utc: equityDrawdown.end,
    metric_semantics: "raw_no_boundary_pair_week_replay" as const,
    liquidation_path_min_adr: round6(Math.min(...liquidationValues, 0)),
    balance_path_min_adr: round6(Math.min(...balanceValues, 0)),
  });
}

function profileDefaultMaxWeeks(profile: ProfileName) {
  if (profile === "FAST_SMOKE") return 1;
  if (profile === "FAST_BASKET") return 12;
  return null;
}

function resolveSelectedWeeks(allWeeks: string[], options: Options) {
  let weeks = allWeeks;
  if (options.weekFrom) weeks = weeks.filter((week) => week >= options.weekFrom!);
  if (options.weekTo) weeks = weeks.filter((week) => week <= options.weekTo!);
  if (options.speedProfile === "STRESS_WINDOWS" && !options.weekFrom && !options.weekTo) {
    weeks = weeks.filter((week) => (
      (week >= "2020-03-01" && week <= "2020-04-26") ||
      (week >= "2022-09-01" && week <= "2022-11-30") ||
      (week >= "2026-05-01" && week <= "2026-06-07")
    ));
  }
  const limit = options.maxWeeks ?? profileDefaultMaxWeeks(options.speedProfile);
  return limit ? weeks.slice(0, limit) : weeks;
}

function resolveSelectedPairs(universe: string[], options: Options) {
  if (options.onlyPair) {
    if (!universe.includes(options.onlyPair)) throw new Error(`Pair not in manifest universe: ${options.onlyPair}`);
    return [options.onlyPair];
  }
  if (options.pairs) {
    const missing = options.pairs.filter((pair) => !universe.includes(pair));
    if (missing.length > 0) throw new Error(`Pairs not in manifest universe: ${missing.join(",")}`);
    return options.pairs;
  }
  if (options.speedProfile === "FAST_SMOKE") return universe.includes("AUDCAD") ? ["AUDCAD"] : [universe[0]!];
  return universe;
}

function pairContributionRows(params: {
  stats: RuleStats;
  weeklyRows: WeeklyGrossRow[];
  selectedPairs: string[];
  selectedWeeks: string[];
  speedProfile: ProfileName;
}) {
  const drawdown = drawdownStats(params.weeklyRows.map((row) => ({ week_open_utc: row.week_open_utc, value: row.equity_snapshot_adr })));
  if (!drawdown.start || !drawdown.end) return [];
  const windowWeeks = params.selectedWeeks.filter((week) => week >= drawdown.start! && week <= drawdown.end!);
  return params.selectedPairs.map((pair) => {
    let previousEquity = 0;
    let contribution = 0;
    let closedCumulative = 0;
    for (const week of params.selectedWeeks) {
      const key = pairWeekKey(pair, week);
      closedCumulative = round6(closedCumulative + (params.stats.closed_by_pair_week.get(key) ?? 0));
      const equity = round6(closedCumulative + (params.stats.open_by_pair_week.get(key) ?? 0));
      const delta = round6(equity - previousEquity);
      previousEquity = equity;
      if (windowWeeks.includes(week)) contribution = round6(contribution + delta);
    }
    return withHash({
      variant_id: VARIANT_ID,
      speed_profile: params.speedProfile,
      pair,
      drawdown_window_start_utc: drawdown.start,
      drawdown_window_end_utc: drawdown.end,
      gross_mtm_contribution_adr: contribution,
    });
  }).sort((left, right) => left.gross_mtm_contribution_adr - right.gross_mtm_contribution_adr);
}

function buildValidationRows(params: {
  gate74b: Gate74bSummary;
  manifest: { manifest_id: string; warehouse_hash: string; status: string };
  selectedPairs: string[];
  selectedWeeks: string[];
  options: Options;
}) {
  const fullAcceptance = params.options.speedProfile === "FULL_ACCEPTANCE";
  return [
    withHash({ check: "gate74b_verdict", value: params.gate74b.verdict, passed: params.gate74b.verdict.startsWith("PASS_") }),
    withHash({ check: "manifest_complete", value: params.manifest.status, passed: params.manifest.status === "complete" }),
    withHash({ check: "same_manifest_as_gate74b_summary", value: params.manifest.manifest_id, expected: params.gate74b.warehouse.manifest_id, passed: params.manifest.manifest_id === params.gate74b.warehouse.manifest_id }),
    withHash({ check: "same_warehouse_hash_as_gate74b_summary", value: params.manifest.warehouse_hash, expected: params.gate74b.warehouse.warehouse_hash, passed: params.manifest.warehouse_hash === params.gate74b.warehouse.warehouse_hash }),
    withHash({ check: "raw_only_no_direction_signal", value: true, passed: true }),
    withHash({ check: "candidate_b_mutated", value: false, passed: true }),
    withHash({ check: "candidate_b_pair_selection_used", value: false, passed: true }),
    withHash({ check: "candidate_b_side_used_only_for_path_price_reconstruction", value: true, passed: true }),
    withHash({ check: "weekly_execution_boundary_active", value: false, passed: true }),
    withHash({ check: "week_identity_reporting_only", value: true, passed: true }),
    withHash({ check: "grid_cap_active", value: false, passed: true }),
    withHash({ check: "pine_price_anchor_active", value: false, passed: true }),
    withHash({ check: "pair_net_flatten_active", value: false, passed: true }),
    withHash({ check: "cost_ladder_tiers", value: COST_FRACTIONS.join(","), passed: COST_FRACTIONS.length === 9 }),
    withHash({ check: "mt5_ea_touched", value: false, passed: true }),
    withHash({ check: "promotion_claimed", value: false, passed: true }),
    withHash({ check: "full_acceptance_week_count", value: params.selectedWeeks.length, expected: EXPECTED_FULL_WEEKS, passed: !fullAcceptance || params.selectedWeeks.length === EXPECTED_FULL_WEEKS }),
    withHash({ check: "full_acceptance_pair_count", value: params.selectedPairs.length, expected: EXPECTED_FULL_PAIRS, passed: !fullAcceptance || params.selectedPairs.length === EXPECTED_FULL_PAIRS }),
  ];
}

function determineVerdict(validationRows: Array<Record<string, unknown>>) {
  return validationRows.every((row) => row.passed === true)
    ? "PASS_RAW_HEDGED_GRID_SPEED_SIMPLIFICATION_BUILT_NO_PROMOTION"
    : "PARTIAL_RAW_HEDGED_GRID_SPEED_SIMPLIFICATION_WITH_GAPS_NO_PROMOTION";
}

function metricDefinitionRows() {
  return [
    { metric: "final_equity_mtm_adr", definition: "closed PnL after modeled costs plus gross open MTM after modeled entry cost, before open liquidation exit cost" },
    { metric: "liquidation_mtm_after_estimated_exit_cost_adr", definition: "final equity MTM after subtracting estimated exit cost for all open positions" },
    { metric: "closed_pnl_after_cost_adr", definition: "realized target closes after entry and exit execution-cost stress" },
    { metric: "cost_fraction", definition: "round-trip all-in execution cost as a fraction of target ADR" },
    { metric: "weekly_execution_boundary_active", definition: "false for this runner; no Sunday 20 ET or Friday 11 ET artificial action cutoff is applied" },
    { metric: "week_identity_reporting_only", definition: "warehouse week key is retained for grouping and output; strategy opens, fills, closes, and resets inside each available row without old cutoff checks" },
    { metric: "max_equity_drawdown_adr", definition: "peak-to-trough drawdown over weekly mark-to-market snapshots before open liquidation exit cost" },
    { metric: "max_balance_drawdown_adr", definition: "peak-to-trough drawdown over realized balance after modeled costs; secondary to MTM drawdown" },
  ].map(withHash);
}

function renderReport(params: {
  verdict: string;
  summaryRows: CostSummaryRow[];
  validationRows: Array<Record<string, unknown>>;
  metricRows: Array<Record<string, unknown>>;
  artifacts: Record<string, string>;
}) {
  const summaryTable = renderTable(params.summaryRows, [
    "variant_id",
    "speed_profile",
    "weeks_replayed",
    "pairs_replayed",
    "cost_fraction",
    "final_equity_mtm_adr",
    "closed_pnl_after_cost_adr",
    "open_unrealized_pnl_adr",
    "liquidation_mtm_after_estimated_exit_cost_adr",
    "max_equity_drawdown_adr",
    "max_balance_drawdown_adr",
    "return_dd_ratio",
    "weekly_mtm_profit_factor",
    "weekly_win_rate",
    "fills",
    "total_modeled_execution_cost_with_liquidation_adr",
    "cost_drag_pct_of_gross_profit",
    "max_open_positions",
    "worst_drawdown_window_start_utc",
    "worst_drawdown_window_end_utc",
  ]);
  const validationTable = renderTable(params.validationRows, ["check", "value", "expected", "passed"]);
  const metricTable = renderTable(params.metricRows, ["metric", "definition"]);
  const artifactLines = Object.entries(params.artifacts).map(([label, artifactPath]) => `- ${label}: \`${artifactPath}\``).join("\n");
  return `# Gate 83 Raw Hedged Grid Speed Simplification

Generated: \`${new Date().toISOString()}\`

## Verdict

\`${params.verdict}\`

## Scope

- Warehouse/backtester-only speed simplification for raw fully hedged grid mechanics.
- Variant: \`${VARIANT_ID}\`.
- T100/S020 only: target \`${TARGET_ADR}\` ADR and spacing \`${SPACING_ADR}\` ADR.
- No direction signal, no Candidate B pair selection, no COT, Strength, Regime, risk layer, Grid Cap, pair-net flatten, trailing, Pine price-anchor mode, MT5 compile, MT5 Strategy Tester run, optimization, promotion, or live-readiness claim.
- No artificial weekly execution boundary is active in this runner. The old Sunday 20:00 ET to Friday 11:00 ET action window is not used.
- Week identity is retained for warehouse grouping and reporting only. This remains a pair-week warehouse replay, not a cross-week carried-position EA simulator.
- Cost ladder is ADR-normalized all-in execution cost for spread, slippage, and commission.

## Cost Ladder Summary

${summaryTable}

## Metric Definitions

${metricTable}

## Validation

${validationTable}

## Artifacts

${artifactLines}

## Stop Line

Gate 83 is warehouse diagnostic evidence only. MT5 EA simplification, dangerous-fill guard implementation, MT5 compile/tester work, live trading, risk layer, parameter optimization, and promotion remain closed.
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
  const manifestId = options.manifestId ?? gate74b.warehouse.manifest_id;
  const manifest = await readTradeLegPathWarehouseManifest(manifestId);
  if (!manifest) throw new Error(`Missing Gate 74B warehouse manifest: ${manifestId}`);
  if (manifest.status !== "complete") throw new Error(`Gate 74B warehouse is not complete: ${manifestId} status=${manifest.status}`);

  const allWeeks = await readTradeLegPathWarehouseWeekKeys(manifestId);
  const selectedWeeks = resolveSelectedWeeks(allWeeks, options);
  if (selectedWeeks.length === 0) throw new Error("No weeks selected for Gate 83 replay");
  const selectedPairs = resolveSelectedPairs(manifest.universe_symbols, options);
  const stats = createStats();

  for (let pairIndex = 0; pairIndex < selectedPairs.length; pairIndex += 1) {
    const pair = selectedPairs[pairIndex]!;
    if (options.logProgress) console.log(`gate83 raw no-boundary pair=${pairIndex + 1}/${selectedPairs.length} ${pair}`);
    const rows = await readPairSeriesWithRetry({ manifestId, pair, weeks: selectedWeeks, attempts: 3 });
    if (rows.length !== selectedWeeks.length) throw new Error(`Missing pair series rows for ${pair}: ${rows.length}/${selectedWeeks.length}`);
    for (const row of rows) replayPairWeek(stats, options.speedProfile, pair, row);
  }

  const weeklyGrossRows = weeklyRowsForStats(stats, selectedWeeks, options.speedProfile).map(withHash);
  const weeklyCostRows = COST_FRACTIONS.flatMap((costFraction) => buildWeeklyCostRows(stats, selectedWeeks, options.speedProfile, costFraction)).map(withHash);
  const summaryRows = COST_FRACTIONS.map((costFraction) => summarizeCostTier({
    stats,
    weeklyCostRows: weeklyCostRows.filter((row) => row.cost_fraction === costFraction),
    costFraction,
    speedProfile: options.speedProfile,
    selectedPairs,
    selectedWeeks,
    manifest,
  }));
  const pairContribution = pairContributionRows({ stats, weeklyRows: weeklyGrossRows, selectedPairs, selectedWeeks, speedProfile: options.speedProfile });
  const validationRows = buildValidationRows({ gate74b, manifest, selectedPairs, selectedWeeks, options });
  const verdict = determineVerdict(validationRows);
  const metricRows = metricDefinitionRows();

  const paths = {
    summaryJson: path.join(options.artifactDir, "cost-ladder-summary.rows.json"),
    summaryCsv: path.join(options.artifactDir, "cost-ladder-summary.rows.csv"),
    weeklyGrossJson: path.join(options.artifactDir, "weekly-gross-mtm.rows.json"),
    weeklyGrossCsv: path.join(options.artifactDir, "weekly-gross-mtm.rows.csv"),
    weeklyCostJson: path.join(options.artifactDir, "weekly-cost-ladder-mtm.rows.json"),
    weeklyCostCsv: path.join(options.artifactDir, "weekly-cost-ladder-mtm.rows.csv"),
    closeEventsJson: path.join(options.artifactDir, "close-events.rows.json"),
    closeEventsCsv: path.join(options.artifactDir, "close-events.rows.csv"),
    pairContributionJson: path.join(options.artifactDir, "worst-drawdown-pair-contribution.rows.json"),
    pairContributionCsv: path.join(options.artifactDir, "worst-drawdown-pair-contribution.rows.csv"),
    validationJson: path.join(options.artifactDir, "validation.rows.json"),
    validationCsv: path.join(options.artifactDir, "validation.rows.csv"),
    metricDefinitionsJson: path.join(options.artifactDir, "metric-definitions.rows.json"),
    metricDefinitionsCsv: path.join(options.artifactDir, "metric-definitions.rows.csv"),
    commandReceipt: path.join(options.artifactDir, "command-receipt.json"),
    runSummaryJson: path.join(options.artifactDir, "gate83-run-summary.json"),
    shaManifest: path.join(options.artifactDir, "gate83-raw-speed-sha256.txt"),
  };

  const artifactsForReport = Object.fromEntries(Object.entries({ ...paths, report: options.reportPath }).map(([label, artifactPath]) => [label, toRepoRelative(artifactPath)]));

  await writeRows(paths.summaryJson, paths.summaryCsv, summaryRows);
  await writeRows(paths.weeklyGrossJson, paths.weeklyGrossCsv, weeklyGrossRows);
  await writeRows(paths.weeklyCostJson, paths.weeklyCostCsv, weeklyCostRows);
  await writeRows(paths.closeEventsJson, paths.closeEventsCsv, stats.close_events.map(withHash));
  await writeRows(paths.pairContributionJson, paths.pairContributionCsv, pairContribution);
  await writeRows(paths.validationJson, paths.validationCsv, validationRows);
  await writeRows(paths.metricDefinitionsJson, paths.metricDefinitionsCsv, metricRows);
  await writeJson(paths.commandReceipt, {
    gate_id: GATE_ID,
    command: COMMAND,
    speed_profile: options.speedProfile,
    durable_command: `${COMMAND} -- --profile=${options.speedProfile} --artifact-dir=${toRepoRelative(options.artifactDir)} --report-path=${toRepoRelative(options.reportPath)}`,
    git_commit: gitCommit(),
    generated_at: new Date().toISOString(),
    options,
  });
  await writeJson(paths.runSummaryJson, {
    gate_id: GATE_ID,
    verdict,
    variant_id: VARIANT_ID,
    speed_profile: options.speedProfile,
    warehouse_manifest_id: manifest.manifest_id,
    warehouse_hash: manifest.warehouse_hash,
    weeks_replayed: selectedWeeks.length,
    pairs_replayed: selectedPairs.length,
    pair_week_rows_replayed: selectedWeeks.length * selectedPairs.length,
    cost_fractions: COST_FRACTIONS,
    summary_rows: summaryRows,
    validation_rows: validationRows,
  });
  await writeText(options.reportPath, renderReport({ verdict, summaryRows, validationRows, metricRows, artifacts: artifactsForReport }));
  await writeShaManifest(paths.shaManifest, GATE_ID, COMMAND, [
    { label: "summary_json", path: paths.summaryJson },
    { label: "weekly_gross_json", path: paths.weeklyGrossJson },
    { label: "weekly_cost_json", path: paths.weeklyCostJson },
    { label: "close_events_json", path: paths.closeEventsJson },
    { label: "pair_contribution_json", path: paths.pairContributionJson },
    { label: "validation_json", path: paths.validationJson },
    { label: "metric_definitions_json", path: paths.metricDefinitionsJson },
    { label: "command_receipt", path: paths.commandReceipt },
    { label: "run_summary_json", path: paths.runSummaryJson },
    { label: "report", path: options.reportPath },
  ]);

  console.log(JSON.stringify({
    verdict,
    profile: options.speedProfile,
    weeks_replayed: selectedWeeks.length,
    pairs_replayed: selectedPairs.length,
    cost_ladder_rows: summaryRows.length,
    report: toRepoRelative(options.reportPath),
    artifact_dir: toRepoRelative(options.artifactDir),
    gross_final_mtm: summaryRows.find((row) => row.cost_fraction === 0)?.final_equity_mtm_adr ?? null,
    worst_cost_final_mtm: summaryRows.find((row) => row.cost_fraction === 0.5)?.final_equity_mtm_adr ?? null,
  }, null, 2));
}

main().catch(async (error) => {
  console.error(error);
  await closePoolIfInitialized();
  process.exitCode = 1;
}).finally(async () => {
  await closePoolIfInitialized();
});
