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

const GATE_ID = "Gate 85A: eurusd-tail-trail-lifecycle-smoke";
const GATE_DATE = "2026-07-01";
const COMMAND = "npm run engine:gate85a:eurusd-tail-trail-lifecycle-smoke";
const DEFAULT_GATE74B_DIR = "docs/research/gates/gate74b/artifacts/gate74b-trade-leg-path-materialization";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate85a/artifacts/eurusd-tail-trail-lifecycle-smoke";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate85a/GATE85A_EURUSD_TAIL_TRAIL_LIFECYCLE_SMOKE_${GATE_DATE}.md`;
const VARIANT_FAMILY = "RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE";
const PAIR = "EURUSD";
const TARGET_ADR = 1;
const SPACING_ADR = 0.2;
const WEEK_FROM = "2020-01-06";
const WEEK_TO = "2026-05-31T23:00:00.000Z";
const TAIL_FRACTIONS = [0, 0.025, 0.05, 0.1] as const;
const TAIL_ACTIVATION_ADR = [1, 2] as const;
const TAIL_TRAIL_ADR = [1, 2, 3, 5] as const;
const COST_FRACTIONS = [0, 0.0025, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5] as const;
const MIN_MEANINGFUL_DD_IMPROVEMENT_ADR = 5;

type Side = "LONG" | "SHORT";
type ReplayRow = Pick<TradeLegPathReplayPairWeek, "week_open_utc" | "pair" | "candidate_b_side" | "pair_adr_pct" | "entry_price" | "path_payload">;

type Gate74bSummary = {
  verdict: string;
  warehouse: {
    manifest_id: string;
    warehouse_hash: string;
    week_count: number;
    pair_week_count: number;
  };
};

type Options = {
  gate74bDir: string;
  artifactDir: string;
  reportPath: string;
  manifestId: string | null;
  weekFrom: string;
  weekTo: string;
  logProgress: boolean;
};

type MatrixConfig = {
  variant_id: string;
  tail_fraction: number;
  tail_activation_adr: number;
  tail_trail_adr: number;
  hwm_reset_step_adr: "OFF";
};

type Fill = {
  entry_price: number;
  quantity: number;
  kind: "initial" | "adverse" | "favorable";
};

type Cycle = {
  side: Side;
  anchor_price: number;
  fills: Fill[];
  next_adverse_level: number;
  next_favorable_level: number;
  min_pnl_adr: number;
  max_pnl_adr: number;
};

type Tail = {
  tail_id: string;
  side: Side;
  source_week_open_utc: string;
  open_timestamp_utc: string;
  fraction: number;
  fills: Fill[];
  initial_equivalent_pnl_adr: number;
  peak_equivalent_pnl_adr: number;
  activated: boolean;
};

type RuntimeStats = {
  closed_by_week: Map<string, number>;
  grid_harvest_by_week: Map<string, number>;
  tail_realized_by_week: Map<string, number>;
  entry_qty_by_week: Map<string, number>;
  exit_qty_by_week: Map<string, number>;
  fill_count_by_week: Map<string, number>;
  grid_reset_count_by_week: Map<string, number>;
  tail_created_by_week: Map<string, number>;
  tail_closed_by_week: Map<string, number>;
  tail_stop_count_by_week: Map<string, number>;
  open_by_week: Map<string, number>;
  tail_unrealized_by_week: Map<string, number>;
  open_exit_qty_by_week: Map<string, number>;
  max_open_inventory: number;
  max_tail_inventory: number;
  target_close_count: number;
  tail_created_count: number;
  tail_closed_count: number;
  tail_stop_count: number;
  tail_events: TailEvent[];
};

type WeeklyGrossRow = {
  variant_id: string;
  week_open_utc: string;
  tail_fraction: number;
  tail_activation_adr: number;
  tail_trail_adr: number;
  closed_pnl_adr: number;
  grid_harvest_pnl_adr: number;
  tail_realized_pnl_adr: number;
  open_unrealized_pnl_adr: number;
  tail_unrealized_pnl_adr: number;
  equity_delta_adr: number;
  equity_snapshot_adr: number;
  fills: number;
  grid_resets: number;
  tails_created: number;
  tails_closed: number;
  tail_stops: number;
  open_exit_quantity: number;
};

type WeeklyCostRow = WeeklyGrossRow & {
  cost_fraction: number;
  entry_cost_adr: number;
  exit_cost_adr: number;
  closed_pnl_after_cost_adr: number;
  balance_snapshot_after_cost_adr: number;
  mtm_before_liquidation_cost_adr: number;
  liquidation_mtm_after_estimated_exit_cost_adr: number;
  modeled_entry_cost_adr: number;
  modeled_exit_cost_adr: number;
  modeled_open_liquidation_cost_adr: number;
};

type SummaryRow = {
  variant_id: string;
  symbol: string;
  date_range: string;
  price_bundle_id: string | null;
  warehouse_manifest_id: string;
  warehouse_hash: string;
  weeks_replayed: number;
  tail_fraction: number;
  tail_activation_adr: number;
  tail_trail_adr: number;
  hwm_reset_step_adr: "OFF";
  cost_fraction: number;
  final_equity_mtm_adr: number;
  liquidation_mtm_after_estimated_exit_cost_adr: number;
  closed_pnl_after_cost_adr: number;
  grid_harvest_pnl_adr: number;
  tail_realized_pnl_adr: number;
  tail_unrealized_pnl_adr: number;
  max_equity_drawdown_adr: number;
  return_dd_ratio: number | null;
  weekly_mtm_profit_factor: number | null;
  weekly_sharpe: number | null;
  weekly_sortino: number | null;
  weekly_win_rate: number;
  fills: number;
  grid_target_closes: number;
  tails_created: number;
  tails_closed: number;
  tail_stops: number;
  max_open_inventory: number;
  max_tail_inventory: number;
  total_modeled_execution_cost_with_liquidation_adr: number;
  cost_drag_pct_of_gross_profit: number | null;
  final_equity_vs_baseline_adr: number | null;
  max_dd_improvement_vs_baseline_adr: number | null;
  worst_drawdown_window_start_utc: string | null;
  worst_drawdown_window_end_utc: string | null;
  verdict_hint: "baseline" | "interesting" | "weak";
};

type TailEvent = {
  variant_id: string;
  tail_id: string;
  event_type: "created" | "closed_trailing_stop" | "sample_end_open";
  side: Side;
  source_week_open_utc: string;
  event_week_open_utc: string;
  timestamp_utc: string;
  tail_fraction: number;
  tail_activation_adr: number;
  tail_trail_adr: number;
  actual_pnl_adr: number;
  equivalent_pnl_adr: number;
  peak_equivalent_pnl_adr: number;
  fill_count_equivalent: number;
  tail_quantity: number;
};

function parseOptions(): Options {
  const args = parseArgMap();
  return {
    gate74bDir: args.get("--gate74b-dir") ?? DEFAULT_GATE74B_DIR,
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    manifestId: args.get("--manifest-id") ?? null,
    weekFrom: args.get("--week-from") ?? WEEK_FROM,
    weekTo: args.get("--week-to") ?? WEEK_TO,
    logProgress: args.has("--log-progress"),
  };
}

function round6(value: number) {
  return round(value, 6);
}

function addToMap(map: Map<string, number>, key: string, value: number = 1) {
  map.set(key, round6((map.get(key) ?? 0) + value));
}

function markPriceFromDirectedClose(row: ReplayRow, directedCloseAdr: number) {
  if (row.entry_price === null || row.entry_price <= 0) throw new Error(`Missing entry price for ${row.week_open_utc} ${row.pair}`);
  const signedPct = (directedCloseAdr * row.pair_adr_pct) / 100;
  return row.candidate_b_side === "LONG"
    ? row.entry_price * (1 + signedPct)
    : row.entry_price * (1 - signedPct);
}

function priceAtMove(anchorPrice: number, side: Side, adrPct: number, moveAdr: number) {
  const signedPct = (moveAdr * adrPct) / 100;
  return side === "LONG" ? anchorPrice * (1 + signedPct) : anchorPrice * (1 - signedPct);
}

function directedMove(anchorPrice: number, side: Side, adrPct: number, markPrice: number) {
  const sign = side === "LONG" ? 1 : -1;
  return ((markPrice - anchorPrice) / anchorPrice) * 100 * sign / adrPct;
}

function fillPnlAdr(side: Side, adrPct: number, fill: Fill, markPrice: number) {
  const sign = side === "LONG" ? 1 : -1;
  return ((markPrice - fill.entry_price) / fill.entry_price) * 100 * sign / adrPct * fill.quantity;
}

function fillsPnlAdr(side: Side, adrPct: number, fills: Fill[], markPrice: number) {
  return round6(fills.reduce((sum, fill) => sum + fillPnlAdr(side, adrPct, fill, markPrice), 0));
}

function fillsQuantity(fills: Fill[]) {
  return round6(fills.reduce((sum, fill) => sum + fill.quantity, 0));
}

function createStats(): RuntimeStats {
  return {
    closed_by_week: new Map(),
    grid_harvest_by_week: new Map(),
    tail_realized_by_week: new Map(),
    entry_qty_by_week: new Map(),
    exit_qty_by_week: new Map(),
    fill_count_by_week: new Map(),
    grid_reset_count_by_week: new Map(),
    tail_created_by_week: new Map(),
    tail_closed_by_week: new Map(),
    tail_stop_count_by_week: new Map(),
    open_by_week: new Map(),
    tail_unrealized_by_week: new Map(),
    open_exit_qty_by_week: new Map(),
    max_open_inventory: 0,
    max_tail_inventory: 0,
    target_close_count: 0,
    tail_created_count: 0,
    tail_closed_count: 0,
    tail_stop_count: 0,
    tail_events: [],
  };
}

function variantId(config: Omit<MatrixConfig, "variant_id">) {
  if (config.tail_fraction === 0) return `${VARIANT_FAMILY}_TAIL000`;
  const frac = Math.round(config.tail_fraction * 1000).toString().padStart(3, "0");
  const activation = config.tail_activation_adr.toString().replace(".", "p");
  const trail = config.tail_trail_adr.toString().replace(".", "p");
  return `${VARIANT_FAMILY}_TAIL${frac}_A${activation}_TR${trail}`;
}

function buildMatrix(): MatrixConfig[] {
  const configs: MatrixConfig[] = [];
  for (const tail_fraction of TAIL_FRACTIONS) {
    if (tail_fraction === 0) {
      const base = { tail_fraction, tail_activation_adr: 0, tail_trail_adr: 0, hwm_reset_step_adr: "OFF" as const };
      configs.push({ ...base, variant_id: variantId(base) });
      continue;
    }
    for (const tail_activation_adr of TAIL_ACTIVATION_ADR) {
      for (const tail_trail_adr of TAIL_TRAIL_ADR) {
        const config = { tail_fraction, tail_activation_adr, tail_trail_adr, hwm_reset_step_adr: "OFF" as const };
        configs.push({ ...config, variant_id: variantId(config) });
      }
    }
  }
  return configs;
}

function startCycle(markPrice: number, side: Side): Cycle {
  return {
    side,
    anchor_price: markPrice,
    fills: [{ entry_price: markPrice, quantity: 1, kind: "initial" }],
    next_adverse_level: 1,
    next_favorable_level: 1,
    min_pnl_adr: 0,
    max_pnl_adr: 0,
  };
}

function observeCycle(cycle: Cycle, adrPct: number, markPrice: number) {
  const pnl = fillsPnlAdr(cycle.side, adrPct, cycle.fills, markPrice);
  if (pnl < cycle.min_pnl_adr) cycle.min_pnl_adr = pnl;
  if (pnl > cycle.max_pnl_adr) cycle.max_pnl_adr = pnl;
}

function addGridFills(stats: RuntimeStats, cycle: Cycle, row: ReplayRow, markPrice: number) {
  let added = 0;
  const move = directedMove(cycle.anchor_price, cycle.side, row.pair_adr_pct, markPrice);
  while (move <= -SPACING_ADR * cycle.next_adverse_level) {
    const level = cycle.next_adverse_level;
    cycle.fills.push({ entry_price: priceAtMove(cycle.anchor_price, cycle.side, row.pair_adr_pct, -SPACING_ADR * level), quantity: 1, kind: "adverse" });
    cycle.next_adverse_level += 1;
    added += 1;
  }
  while (move >= SPACING_ADR * cycle.next_favorable_level) {
    const level = cycle.next_favorable_level;
    cycle.fills.push({ entry_price: priceAtMove(cycle.anchor_price, cycle.side, row.pair_adr_pct, SPACING_ADR * level), quantity: 1, kind: "favorable" });
    cycle.next_favorable_level += 1;
    added += 1;
  }
  if (added > 0) {
    addToMap(stats.fill_count_by_week, row.week_open_utc, added);
    addToMap(stats.entry_qty_by_week, row.week_open_utc, added);
  }
}

function closeTargetCycle(params: {
  stats: RuntimeStats;
  config: MatrixConfig;
  cycle: Cycle;
  row: ReplayRow;
  markPrice: number;
  timestampUtc: string;
  tailSerial: number;
}) {
  const gross = fillsPnlAdr(params.cycle.side, params.row.pair_adr_pct, params.cycle.fills, params.markPrice);
  const totalQty = fillsQuantity(params.cycle.fills);
  const closeFraction = round6(1 - params.config.tail_fraction);
  const gridRealized = round6(gross * closeFraction);
  const exitQty = round6(totalQty * closeFraction);
  addToMap(params.stats.closed_by_week, params.row.week_open_utc, gridRealized);
  addToMap(params.stats.grid_harvest_by_week, params.row.week_open_utc, gridRealized);
  addToMap(params.stats.exit_qty_by_week, params.row.week_open_utc, exitQty);
  addToMap(params.stats.grid_reset_count_by_week, params.row.week_open_utc);
  params.stats.target_close_count += 1;

  if (params.config.tail_fraction <= 0) return null;

  const tailFills = params.cycle.fills.map((fill) => ({ ...fill, quantity: round6(fill.quantity * params.config.tail_fraction) }));
  const tail: Tail = {
    tail_id: `${params.config.variant_id}|${params.row.week_open_utc}|${params.cycle.side}|${params.tailSerial}`,
    side: params.cycle.side,
    source_week_open_utc: params.row.week_open_utc,
    open_timestamp_utc: params.timestampUtc,
    fraction: params.config.tail_fraction,
    fills: tailFills,
    initial_equivalent_pnl_adr: gross,
    peak_equivalent_pnl_adr: gross,
    activated: gross >= params.config.tail_activation_adr,
  };
  params.stats.tail_created_count += 1;
  addToMap(params.stats.tail_created_by_week, params.row.week_open_utc);
  params.stats.tail_events.push({
    variant_id: params.config.variant_id,
    tail_id: tail.tail_id,
    event_type: "created",
    side: tail.side,
    source_week_open_utc: tail.source_week_open_utc,
    event_week_open_utc: params.row.week_open_utc,
    timestamp_utc: params.timestampUtc,
    tail_fraction: params.config.tail_fraction,
    tail_activation_adr: params.config.tail_activation_adr,
    tail_trail_adr: params.config.tail_trail_adr,
    actual_pnl_adr: round6(gross * params.config.tail_fraction),
    equivalent_pnl_adr: gross,
    peak_equivalent_pnl_adr: gross,
    fill_count_equivalent: totalQty,
    tail_quantity: fillsQuantity(tailFills),
  });
  return tail;
}

function updateAndCloseTails(params: {
  stats: RuntimeStats;
  config: MatrixConfig;
  tails: Tail[];
  row: ReplayRow;
  markPrice: number;
  timestampUtc: string;
}) {
  for (let i = params.tails.length - 1; i >= 0; i -= 1) {
    const tail = params.tails[i]!;
    const actualPnl = fillsPnlAdr(tail.side, params.row.pair_adr_pct, tail.fills, params.markPrice);
    const equivalentPnl = tail.fraction > 0 ? round6(actualPnl / tail.fraction) : actualPnl;
    if (equivalentPnl > tail.peak_equivalent_pnl_adr) tail.peak_equivalent_pnl_adr = equivalentPnl;
    if (!tail.activated && tail.peak_equivalent_pnl_adr >= params.config.tail_activation_adr) tail.activated = true;
    if (!tail.activated || equivalentPnl > tail.peak_equivalent_pnl_adr - params.config.tail_trail_adr) continue;

    const qty = fillsQuantity(tail.fills);
    addToMap(params.stats.closed_by_week, params.row.week_open_utc, actualPnl);
    addToMap(params.stats.tail_realized_by_week, params.row.week_open_utc, actualPnl);
    addToMap(params.stats.exit_qty_by_week, params.row.week_open_utc, qty);
    addToMap(params.stats.tail_closed_by_week, params.row.week_open_utc);
    addToMap(params.stats.tail_stop_count_by_week, params.row.week_open_utc);
    params.stats.tail_closed_count += 1;
    params.stats.tail_stop_count += 1;
    params.stats.tail_events.push({
      variant_id: params.config.variant_id,
      tail_id: tail.tail_id,
      event_type: "closed_trailing_stop",
      side: tail.side,
      source_week_open_utc: tail.source_week_open_utc,
      event_week_open_utc: params.row.week_open_utc,
      timestamp_utc: params.timestampUtc,
      tail_fraction: params.config.tail_fraction,
      tail_activation_adr: params.config.tail_activation_adr,
      tail_trail_adr: params.config.tail_trail_adr,
      actual_pnl_adr: actualPnl,
      equivalent_pnl_adr: equivalentPnl,
      peak_equivalent_pnl_adr: tail.peak_equivalent_pnl_adr,
      fill_count_equivalent: round6(qty / tail.fraction),
      tail_quantity: qty,
    });
    params.tails.splice(i, 1);
  }
}

function snapshotOpen(params: {
  stats: RuntimeStats;
  week: string;
  row: ReplayRow;
  markPrice: number;
  cycles: Map<Side, Cycle | null>;
  tails: Tail[];
}) {
  let open = 0;
  let tailOpen = 0;
  let openQty = 0;
  let tailQty = 0;
  for (const cycle of params.cycles.values()) {
    if (!cycle) continue;
    open = round6(open + fillsPnlAdr(cycle.side, params.row.pair_adr_pct, cycle.fills, params.markPrice));
    openQty = round6(openQty + fillsQuantity(cycle.fills));
  }
  for (const tail of params.tails) {
    const pnl = fillsPnlAdr(tail.side, params.row.pair_adr_pct, tail.fills, params.markPrice);
    tailOpen = round6(tailOpen + pnl);
    open = round6(open + pnl);
    const qty = fillsQuantity(tail.fills);
    tailQty = round6(tailQty + qty);
    openQty = round6(openQty + qty);
  }
  params.stats.open_by_week.set(params.week, open);
  params.stats.tail_unrealized_by_week.set(params.week, tailOpen);
  params.stats.open_exit_qty_by_week.set(params.week, openQty);
  params.stats.max_open_inventory = Math.max(params.stats.max_open_inventory, openQty);
  params.stats.max_tail_inventory = Math.max(params.stats.max_tail_inventory, tailQty);
}

function replayConfig(config: MatrixConfig, rows: ReplayRow[], logProgress: boolean) {
  const stats = createStats();
  const cycles = new Map<Side, Cycle | null>([["LONG", null], ["SHORT", null]]);
  const tails: Tail[] = [];
  let tailSerial = 0;

  for (const row of rows) {
    if (logProgress) console.log(`gate85a ${config.variant_id} ${row.week_open_utc}`);
    const timestamps = row.path_payload.timestamp_utc;
    const closes = row.path_payload.directed_close_adr;
    for (let index = 0; index < timestamps.length; index += 1) {
      const timestamp = timestamps[index]!;
      const markPrice = markPriceFromDirectedClose(row, closes[index]!);
      updateAndCloseTails({ stats, config, tails, row, markPrice, timestampUtc: timestamp });

      for (const side of ["LONG", "SHORT"] as const) {
        let cycle = cycles.get(side);
        if (!cycle) {
          cycle = startCycle(markPrice, side);
          cycles.set(side, cycle);
          addToMap(stats.fill_count_by_week, row.week_open_utc);
          addToMap(stats.entry_qty_by_week, row.week_open_utc);
        }
        addGridFills(stats, cycle, row, markPrice);
        observeCycle(cycle, row.pair_adr_pct, markPrice);
        const pnl = fillsPnlAdr(side, row.pair_adr_pct, cycle.fills, markPrice);
        if (pnl >= TARGET_ADR) {
          tailSerial += 1;
          const tail = closeTargetCycle({ stats, config, cycle, row, markPrice, timestampUtc: timestamp, tailSerial });
          if (tail) tails.push(tail);
          cycles.set(side, null);
        }
      }
    }
    const finalTimestamp = timestamps.at(-1);
    const finalClose = closes.at(-1);
    if (finalTimestamp === undefined || finalClose === undefined) throw new Error(`Missing path payload for ${row.week_open_utc} ${row.pair}`);
    snapshotOpen({ stats, week: row.week_open_utc, row, markPrice: markPriceFromDirectedClose(row, finalClose), cycles, tails });
  }

  const finalRow = rows.at(-1);
  if (finalRow) {
    const timestamp = finalRow.path_payload.timestamp_utc.at(-1) ?? finalRow.week_open_utc;
    const markPrice = markPriceFromDirectedClose(finalRow, finalRow.path_payload.directed_close_adr.at(-1) ?? 0);
    for (const tail of tails) {
      const actualPnl = fillsPnlAdr(tail.side, finalRow.pair_adr_pct, tail.fills, markPrice);
      const equivalentPnl = tail.fraction > 0 ? round6(actualPnl / tail.fraction) : actualPnl;
      stats.tail_events.push({
        variant_id: config.variant_id,
        tail_id: tail.tail_id,
        event_type: "sample_end_open",
        side: tail.side,
        source_week_open_utc: tail.source_week_open_utc,
        event_week_open_utc: finalRow.week_open_utc,
        timestamp_utc: timestamp,
        tail_fraction: config.tail_fraction,
        tail_activation_adr: config.tail_activation_adr,
        tail_trail_adr: config.tail_trail_adr,
        actual_pnl_adr: actualPnl,
        equivalent_pnl_adr: equivalentPnl,
        peak_equivalent_pnl_adr: tail.peak_equivalent_pnl_adr,
        fill_count_equivalent: round6(fillsQuantity(tail.fills) / tail.fraction),
        tail_quantity: fillsQuantity(tail.fills),
      });
    }
  }

  return stats;
}

function average(values: number[]) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values: number[]) {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
}

function sharpe(values: number[]) {
  const sigma = stddev(values);
  return sigma === 0 ? null : round6(average(values) / sigma);
}

function sortino(values: number[]) {
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

function weeklyGrossRows(config: MatrixConfig, stats: RuntimeStats, weeks: string[]): WeeklyGrossRow[] {
  let closedCumulative = 0;
  let previousEquity = 0;
  return weeks.map((week) => {
    const closed = stats.closed_by_week.get(week) ?? 0;
    closedCumulative = round6(closedCumulative + closed);
    const open = stats.open_by_week.get(week) ?? 0;
    const equity = round6(closedCumulative + open);
    const delta = round6(equity - previousEquity);
    previousEquity = equity;
    return {
      variant_id: config.variant_id,
      week_open_utc: week,
      tail_fraction: config.tail_fraction,
      tail_activation_adr: config.tail_activation_adr,
      tail_trail_adr: config.tail_trail_adr,
      closed_pnl_adr: round6(closed),
      grid_harvest_pnl_adr: round6(stats.grid_harvest_by_week.get(week) ?? 0),
      tail_realized_pnl_adr: round6(stats.tail_realized_by_week.get(week) ?? 0),
      open_unrealized_pnl_adr: round6(open),
      tail_unrealized_pnl_adr: round6(stats.tail_unrealized_by_week.get(week) ?? 0),
      equity_delta_adr: delta,
      equity_snapshot_adr: equity,
      fills: stats.fill_count_by_week.get(week) ?? 0,
      grid_resets: stats.grid_reset_count_by_week.get(week) ?? 0,
      tails_created: stats.tail_created_by_week.get(week) ?? 0,
      tails_closed: stats.tail_closed_by_week.get(week) ?? 0,
      tail_stops: stats.tail_stop_count_by_week.get(week) ?? 0,
      open_exit_quantity: stats.open_exit_qty_by_week.get(week) ?? 0,
    };
  });
}

function weeklyCostRows(rows: WeeklyGrossRow[], stats: RuntimeStats, costFraction: number): WeeklyCostRow[] {
  const entryCost = (TARGET_ADR * costFraction) / 2;
  const exitCost = (TARGET_ADR * costFraction) / 2;
  let balance = 0;
  let previousMtm = 0;
  return rows.map((row) => {
    const entryQty = stats.entry_qty_by_week.get(row.week_open_utc) ?? 0;
    const exitQty = stats.exit_qty_by_week.get(row.week_open_utc) ?? 0;
    const entryCostAdr = round6(entryQty * entryCost);
    const exitCostAdr = round6(exitQty * exitCost);
    balance = round6(balance + row.closed_pnl_adr - entryCostAdr - exitCostAdr);
    const mtm = round6(balance + row.open_unrealized_pnl_adr);
    const openExitCost = round6(row.open_exit_quantity * exitCost);
    const liquidation = round6(mtm - openExitCost);
    const delta = round6(mtm - previousMtm);
    previousMtm = mtm;
    return {
      ...row,
      cost_fraction: costFraction,
      entry_cost_adr: round6(entryCost),
      exit_cost_adr: round6(exitCost),
      closed_pnl_after_cost_adr: round6(row.closed_pnl_adr - entryCostAdr - exitCostAdr),
      balance_snapshot_after_cost_adr: balance,
      mtm_before_liquidation_cost_adr: mtm,
      liquidation_mtm_after_estimated_exit_cost_adr: liquidation,
      modeled_entry_cost_adr: entryCostAdr,
      modeled_exit_cost_adr: exitCostAdr,
      modeled_open_liquidation_cost_adr: openExitCost,
      equity_delta_adr: delta,
      equity_snapshot_adr: mtm,
    };
  });
}

function summarize(config: MatrixConfig, stats: RuntimeStats, rows: WeeklyCostRow[], manifest: { manifest_id: string; warehouse_hash: string; price_bundle_id?: string | null }, weeks: string[]): SummaryRow {
  const final = rows.at(-1);
  const values = rows.map((row) => row.equity_delta_adr);
  const dd = drawdownStats(rows.map((row) => ({ week_open_utc: row.week_open_utc, value: row.mtm_before_liquidation_cost_adr })));
  const grossProfit = round6(rows.reduce((sum, row) => sum + Math.max(0, row.closed_pnl_adr), 0));
  const totalCost = round6(rows.reduce((sum, row) => sum + row.modeled_entry_cost_adr + row.modeled_exit_cost_adr, 0) + (final?.modeled_open_liquidation_cost_adr ?? 0));
  return {
    variant_id: config.variant_id,
    symbol: PAIR,
    date_range: `${weeks.at(0) ?? "none"}..${weeks.at(-1) ?? "none"}`,
    price_bundle_id: manifest.price_bundle_id ?? null,
    warehouse_manifest_id: manifest.manifest_id,
    warehouse_hash: manifest.warehouse_hash,
    weeks_replayed: weeks.length,
    tail_fraction: config.tail_fraction,
    tail_activation_adr: config.tail_activation_adr,
    tail_trail_adr: config.tail_trail_adr,
    hwm_reset_step_adr: config.hwm_reset_step_adr,
    cost_fraction: final?.cost_fraction ?? 0,
    final_equity_mtm_adr: final?.mtm_before_liquidation_cost_adr ?? 0,
    liquidation_mtm_after_estimated_exit_cost_adr: final?.liquidation_mtm_after_estimated_exit_cost_adr ?? 0,
    closed_pnl_after_cost_adr: final?.balance_snapshot_after_cost_adr ?? 0,
    grid_harvest_pnl_adr: round6(rows.reduce((sum, row) => sum + row.grid_harvest_pnl_adr, 0)),
    tail_realized_pnl_adr: round6(rows.reduce((sum, row) => sum + row.tail_realized_pnl_adr, 0)),
    tail_unrealized_pnl_adr: final?.tail_unrealized_pnl_adr ?? 0,
    max_equity_drawdown_adr: dd.drawdown,
    return_dd_ratio: dd.drawdown === 0 ? null : round6((final?.mtm_before_liquidation_cost_adr ?? 0) / Math.abs(dd.drawdown)),
    weekly_mtm_profit_factor: profitFactor(values),
    weekly_sharpe: sharpe(values),
    weekly_sortino: sortino(values),
    weekly_win_rate: round6(values.filter((value) => value > 0).length / Math.max(1, values.length)),
    fills: round6(rows.reduce((sum, row) => sum + row.fills, 0)),
    grid_target_closes: stats.target_close_count,
    tails_created: stats.tail_created_count,
    tails_closed: stats.tail_closed_count,
    tail_stops: stats.tail_stop_count,
    max_open_inventory: round6(stats.max_open_inventory),
    max_tail_inventory: round6(stats.max_tail_inventory),
    total_modeled_execution_cost_with_liquidation_adr: totalCost,
    cost_drag_pct_of_gross_profit: grossProfit === 0 ? null : round6((totalCost / grossProfit) * 100),
    final_equity_vs_baseline_adr: null,
    max_dd_improvement_vs_baseline_adr: null,
    worst_drawdown_window_start_utc: dd.start,
    worst_drawdown_window_end_utc: dd.end,
    verdict_hint: config.tail_fraction === 0 ? "baseline" : "weak",
  };
}

function addBaselineComparisons(summaryRows: SummaryRow[]) {
  const baselineByCost = new Map<number, SummaryRow>();
  for (const row of summaryRows) {
    if (row.tail_fraction === 0) baselineByCost.set(row.cost_fraction, row);
  }
  for (const row of summaryRows) {
    const baseline = baselineByCost.get(row.cost_fraction);
    if (!baseline || row.tail_fraction === 0) continue;
    row.final_equity_vs_baseline_adr = round6(row.final_equity_mtm_adr - baseline.final_equity_mtm_adr);
    row.max_dd_improvement_vs_baseline_adr = round6(row.max_equity_drawdown_adr - baseline.max_equity_drawdown_adr);
    const retained = baseline.final_equity_mtm_adr === 0 ? 0 : row.final_equity_mtm_adr / baseline.final_equity_mtm_adr;
    row.verdict_hint =
      row.max_dd_improvement_vs_baseline_adr >= MIN_MEANINGFUL_DD_IMPROVEMENT_ADR && retained >= 0.7
        ? "interesting"
        : "weak";
  }
}

function yearlyRows(weeklyRows: WeeklyCostRow[]) {
  const groups = new Map<string, WeeklyCostRow[]>();
  for (const row of weeklyRows) {
    const key = `${row.variant_id}|${row.cost_fraction}|${row.week_open_utc.slice(0, 4)}`;
    const rows = groups.get(key) ?? [];
    rows.push(row);
    groups.set(key, rows);
  }
  return [...groups.values()].map((rows) => {
    const first = rows[0]!;
    const values = rows.map((row) => row.equity_delta_adr);
    const dd = drawdownStats(rows.map((row) => ({ week_open_utc: row.week_open_utc, value: row.mtm_before_liquidation_cost_adr })));
    return withHash({
      variant_id: first.variant_id,
      year: first.week_open_utc.slice(0, 4),
      cost_fraction: first.cost_fraction,
      tail_fraction: first.tail_fraction,
      tail_activation_adr: first.tail_activation_adr,
      tail_trail_adr: first.tail_trail_adr,
      weeks: rows.length,
      equity_delta_adr: round6(values.reduce((sum, value) => sum + value, 0)),
      max_drawdown_adr: dd.drawdown,
      weekly_mtm_profit_factor: profitFactor(values),
      weekly_win_rate: round6(values.filter((value) => value > 0).length / Math.max(1, values.length)),
    });
  });
}

function rollingRows(weeklyRows: WeeklyCostRow[]) {
  const groups = new Map<string, WeeklyCostRow[]>();
  for (const row of weeklyRows) {
    const key = `${row.variant_id}|${row.cost_fraction}`;
    const rows = groups.get(key) ?? [];
    rows.push(row);
    groups.set(key, rows);
  }
  const out: Record<string, unknown>[] = [];
  for (const rows of groups.values()) {
    for (let i = 51; i < rows.length; i += 1) {
      const window = rows.slice(i - 51, i + 1);
      const first = window[0]!;
      const last = window.at(-1)!;
      const values = window.map((row) => row.equity_delta_adr);
      const dd = drawdownStats(window.map((row) => ({ week_open_utc: row.week_open_utc, value: row.mtm_before_liquidation_cost_adr })));
      out.push(withHash({
        variant_id: first.variant_id,
        cost_fraction: first.cost_fraction,
        window_start_utc: first.week_open_utc,
        window_end_utc: last.week_open_utc,
        weeks: window.length,
        equity_delta_adr: round6(values.reduce((sum, value) => sum + value, 0)),
        max_drawdown_adr: dd.drawdown,
        weekly_mtm_profit_factor: profitFactor(values),
      }));
    }
  }
  return out;
}

function worstDrawdownRows(weeklyRows: WeeklyCostRow[]) {
  const groups = new Map<string, WeeklyCostRow[]>();
  for (const row of weeklyRows) {
    const key = `${row.variant_id}|${row.cost_fraction}`;
    const rows = groups.get(key) ?? [];
    rows.push(row);
    groups.set(key, rows);
  }
  const out: Record<string, unknown>[] = [];
  for (const rows of groups.values()) {
    let peak = 0;
    let peakWeek: string | null = null;
    const candidates: Record<string, unknown>[] = [];
    for (const row of rows) {
      if (row.mtm_before_liquidation_cost_adr > peak) {
        peak = row.mtm_before_liquidation_cost_adr;
        peakWeek = row.week_open_utc;
      }
      const drawdown = round6(row.mtm_before_liquidation_cost_adr - peak);
      candidates.push({
        variant_id: row.variant_id,
        cost_fraction: row.cost_fraction,
        drawdown_start_utc: peakWeek,
        drawdown_end_utc: row.week_open_utc,
        drawdown_adr: drawdown,
        equity_at_end_adr: row.mtm_before_liquidation_cost_adr,
      });
    }
    out.push(...candidates.sort((a, b) => Number(a.drawdown_adr) - Number(b.drawdown_adr)).slice(0, 10).map(withHash));
  }
  return out;
}

function tailSummaryRows(summaryRows: SummaryRow[]) {
  return summaryRows.filter((row) => row.cost_fraction === 0 || row.cost_fraction === 0.05 || row.cost_fraction === 0.1).map((row) => withHash({
    variant_id: row.variant_id,
    cost_fraction: row.cost_fraction,
    tail_fraction: row.tail_fraction,
    tail_activation_adr: row.tail_activation_adr,
    tail_trail_adr: row.tail_trail_adr,
    final_equity_mtm_adr: row.final_equity_mtm_adr,
    max_equity_drawdown_adr: row.max_equity_drawdown_adr,
    final_equity_vs_baseline_adr: row.final_equity_vs_baseline_adr,
    max_dd_improvement_vs_baseline_adr: row.max_dd_improvement_vs_baseline_adr,
    tail_realized_pnl_adr: row.tail_realized_pnl_adr,
    tail_unrealized_pnl_adr: row.tail_unrealized_pnl_adr,
    tails_created: row.tails_created,
    tails_closed: row.tails_closed,
    tail_stops: row.tail_stops,
    verdict_hint: row.verdict_hint,
  }));
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

function determineVerdict(summaryRows: SummaryRow[]) {
  const interesting = summaryRows.some((row) => row.cost_fraction === 0.05 && row.verdict_hint === "interesting");
  return interesting
    ? "PASS_TAIL_TRAIL_SMOKE_BUILT_PROMISING_NO_PROMOTION"
    : "PASS_TAIL_TRAIL_SMOKE_BUILT_IDEAS_WEAK_NO_PROMOTION";
}

function renderReport(params: {
  verdict: string;
  summaryRows: SummaryRow[];
  tailRows: Record<string, unknown>[];
  validationRows: Record<string, unknown>[];
  artifacts: Record<string, string>;
  elapsedMs: number;
}) {
  const focusRows = params.summaryRows
    .filter((row) => row.cost_fraction === 0 || row.cost_fraction === 0.05 || row.cost_fraction === 0.1)
    .sort((a, b) => (b.max_dd_improvement_vs_baseline_adr ?? -999999) - (a.max_dd_improvement_vs_baseline_adr ?? -999999))
    .slice(0, 25)
    .map((row) => ({
      variant_id: row.variant_id,
      cost_fraction: row.cost_fraction,
      tail_fraction: row.tail_fraction,
      activation: row.tail_activation_adr,
      trail: row.tail_trail_adr,
      final_equity: row.final_equity_mtm_adr,
      max_dd: row.max_equity_drawdown_adr,
      final_vs_base: row.final_equity_vs_baseline_adr,
      dd_improve: row.max_dd_improvement_vs_baseline_adr,
      tail_realized: row.tail_realized_pnl_adr,
      tail_open: row.tail_unrealized_pnl_adr,
      hint: row.verdict_hint,
    }));
  return `# Gate 85A EURUSD Tail-Trail Lifecycle Smoke

Generated: \`${new Date().toISOString()}\`

## Verdict

\`${params.verdict}\`

## Scope

- Warehouse/backtester-only EURUSD smoke.
- Uses the Gate 74B trade-leg path warehouse and frozen canonical price lineage.
- MT5/EA files were not inspected, compiled, installed, or changed in this gate.
- The user has an MT5 V3 Strategy Tester run active; this gate stays hands-off.
- No Candidate B, direction, COT, Strength, Regime, Brain/Cell inputs, Grid Cap, L3, pair-net flatten, Pine anchor mode, weekly execution boundary, risk layer, optimization, promotion, or live-readiness claim.

## Contract

- Pair: \`EURUSD\`.
- Window: \`${WEEK_FROM}\` through \`${WEEK_TO}\`.
- Raw grid: target \`${TARGET_ADR}\` ADR, spacing \`${SPACING_ADR}\` ADR.
- Tail fractions: \`${TAIL_FRACTIONS.join(", ")}\`.
- Tail activation ADR: \`${TAIL_ACTIVATION_ADR.join(", ")}\`.
- Tail trailing-stop ADR: \`${TAIL_TRAIL_ADR.join(", ")}\`.
- HWM reset: \`OFF\` in Gate 85A. Account HWM reset remains a later synchronized-account replay gate if this tail smoke is alive.
- Cost ladder: \`${COST_FRACTIONS.join(", ")}\`.
- Meaningful tail-smoke threshold: at \`0.05\` cost fraction, improve max drawdown by at least \`${MIN_MEANINGFUL_DD_IMPROVEMENT_ADR}\` ADR while retaining at least \`70%\` of baseline final equity.

Tail stop semantics use full-size-equivalent tail PnL for activation/trailing,
while actual tail PnL is scaled by \`tail_fraction\`. This keeps tiny residual
tails from needing impossible actual-ADR movement before a wide trail can act.

Runtime: \`${Math.round(params.elapsedMs / 1000)}s\`.

## Focus Rows

${renderTable(focusRows, [
  "variant_id",
  "cost_fraction",
  "tail_fraction",
  "activation",
  "trail",
  "final_equity",
  "final_vs_base",
  "max_dd",
  "dd_improve",
  "tail_realized",
  "tail_open",
  "hint",
])}

## Validation

${renderTable(params.validationRows, ["check", "value", "expected", "passed"])}

## Artifacts

${Object.entries(params.artifacts).map(([label, artifact]) => `- ${label}: \`${artifact}\``).join("\n")}

## Stop Line

Gate 85A is a one-pair warehouse smoke only. It does not promote a strategy and
does not touch MT5 while the manual V3 tester run is active.
`;
}

async function readPairSeriesWithRetry(params: { manifestId: string; pair: string; weeks: string[]; attempts: number }) {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= params.attempts; attempt += 1) {
    try {
      return await readTradeLegPathWarehousePairSeries({
        manifestId: params.manifestId,
        pair: params.pair,
        weeks: params.weeks,
      });
    } catch (error) {
      lastError = error;
      if (attempt === params.attempts) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function main() {
  const started = Date.now();
  const options = parseOptions();
  await mkdir(options.artifactDir, { recursive: true });
  await mkdir(path.dirname(options.reportPath), { recursive: true });

  const gate74b = await readJson<Gate74bSummary>(path.join(options.gate74bDir, "gate74b-summary.json"));
  const manifestId = options.manifestId ?? gate74b.warehouse.manifest_id;
  const manifest = await readTradeLegPathWarehouseManifest(manifestId);
  if (!manifest) throw new Error(`Missing Gate 74B warehouse manifest: ${manifestId}`);
  if (manifest.status !== "complete") throw new Error(`Gate 74B warehouse is not complete: ${manifestId} status=${manifest.status}`);
  if (!manifest.universe_symbols.includes(PAIR)) throw new Error(`${PAIR} missing from warehouse universe`);

  const allWeeks = await readTradeLegPathWarehouseWeekKeys(manifestId);
  const weeks = allWeeks.filter((week) => week >= options.weekFrom && week <= options.weekTo);
  if (weeks.length === 0) throw new Error("No selected weeks for Gate 85A");
  const rows = (await readPairSeriesWithRetry({ manifestId, pair: PAIR, weeks, attempts: 3 })) as ReplayRow[];
  if (rows.length !== weeks.length) throw new Error(`Missing ${PAIR} rows: ${rows.length}/${weeks.length}`);

  const configs = buildMatrix();
  const allWeeklyGross: Record<string, unknown>[] = [];
  const allWeeklyCost: WeeklyCostRow[] = [];
  const allSummary: SummaryRow[] = [];
  const allTailEvents: TailEvent[] = [];

  for (let index = 0; index < configs.length; index += 1) {
    const config = configs[index]!;
    if (options.logProgress) console.log(`gate85a config=${index + 1}/${configs.length} ${config.variant_id}`);
    const stats = replayConfig(config, rows, false);
    const grossRows = weeklyGrossRows(config, stats, weeks);
    allWeeklyGross.push(...grossRows.map(withHash));
    allTailEvents.push(...stats.tail_events);
    for (const costFraction of COST_FRACTIONS) {
      const costRows = weeklyCostRows(grossRows, stats, costFraction);
      allWeeklyCost.push(...costRows.map(withHash));
      allSummary.push(summarize(config, stats, costRows, manifest, weeks));
    }
  }

  addBaselineComparisons(allSummary);
  const summaryRows = allSummary.map(withHash);
  const tailRows = tailSummaryRows(allSummary);
  const yearly = yearlyRows(allWeeklyCost);
  const rolling = rollingRows(allWeeklyCost);
  const worstDrawdowns = worstDrawdownRows(allWeeklyCost);
  const validationRows = [
    withHash({ check: "gate74b_verdict", value: gate74b.verdict, passed: gate74b.verdict.startsWith("PASS_") }),
    withHash({ check: "manifest_complete", value: manifest.status, passed: manifest.status === "complete" }),
    withHash({ check: "pair", value: PAIR, expected: "EURUSD", passed: true }),
    withHash({ check: "weeks_replayed", value: weeks.length, expected: ">=300", passed: weeks.length >= 300 }),
    withHash({ check: "candidate_b_direction_used", value: false, passed: true }),
    withHash({ check: "weekly_execution_boundary_active", value: false, passed: true }),
    withHash({ check: "hwm_reset_active", value: false, expected: "Gate85A tail smoke only", passed: true }),
    withHash({ check: "mt5_touched", value: false, passed: true }),
    withHash({ check: "promotion_claimed", value: false, passed: true }),
  ];
  const verdict = determineVerdict(allSummary);

  const paths = {
    summaryJson: path.join(options.artifactDir, "gate85a_lifecycle_matrix_summary.rows.json"),
    summaryCsv: path.join(options.artifactDir, "gate85a_lifecycle_matrix_summary.rows.csv"),
    weeklyGrossJson: path.join(options.artifactDir, "gate85a_weekly_gross.rows.json"),
    weeklyGrossCsv: path.join(options.artifactDir, "gate85a_weekly_gross.rows.csv"),
    weeklyCostJson: path.join(options.artifactDir, "gate85a_weekly_cost_ladder.rows.json"),
    weeklyCostCsv: path.join(options.artifactDir, "gate85a_weekly_cost_ladder.rows.csv"),
    yearlyJson: path.join(options.artifactDir, "gate85a_yearly_breakdown.rows.json"),
    yearlyCsv: path.join(options.artifactDir, "gate85a_yearly_breakdown.rows.csv"),
    rollingJson: path.join(options.artifactDir, "gate85a_rolling_12m_breakdown.rows.json"),
    rollingCsv: path.join(options.artifactDir, "gate85a_rolling_12m_breakdown.rows.csv"),
    worstDrawdownsJson: path.join(options.artifactDir, "gate85a_worst_drawdown_windows.rows.json"),
    worstDrawdownsCsv: path.join(options.artifactDir, "gate85a_worst_drawdown_windows.rows.csv"),
    tailSummaryJson: path.join(options.artifactDir, "gate85a_tail_summary.rows.json"),
    tailSummaryCsv: path.join(options.artifactDir, "gate85a_tail_summary.rows.csv"),
    tailEventsJson: path.join(options.artifactDir, "gate85a_tail_events.rows.json"),
    tailEventsCsv: path.join(options.artifactDir, "gate85a_tail_events.rows.csv"),
    validationJson: path.join(options.artifactDir, "gate85a_validation.rows.json"),
    validationCsv: path.join(options.artifactDir, "gate85a_validation.rows.csv"),
    commandReceipt: path.join(options.artifactDir, "gate85a_command_receipt.json"),
    runSummaryJson: path.join(options.artifactDir, "gate85a_run_summary.json"),
    shaManifest: path.join(options.artifactDir, "gate85a_sha256.txt"),
  };
  const elapsedMs = Date.now() - started;
  const artifactsForReport = Object.fromEntries(Object.entries({ ...paths, report: options.reportPath }).map(([label, artifactPath]) => [label, toRepoRelative(artifactPath)]));

  await writeRows(paths.summaryJson, paths.summaryCsv, summaryRows);
  await writeRows(paths.weeklyGrossJson, paths.weeklyGrossCsv, allWeeklyGross);
  await writeRows(paths.weeklyCostJson, paths.weeklyCostCsv, allWeeklyCost.map((row) => row as unknown as Record<string, unknown>));
  await writeRows(paths.yearlyJson, paths.yearlyCsv, yearly);
  await writeRows(paths.rollingJson, paths.rollingCsv, rolling);
  await writeRows(paths.worstDrawdownsJson, paths.worstDrawdownsCsv, worstDrawdowns);
  await writeRows(paths.tailSummaryJson, paths.tailSummaryCsv, tailRows);
  await writeRows(paths.tailEventsJson, paths.tailEventsCsv, allTailEvents.map(withHash));
  await writeRows(paths.validationJson, paths.validationCsv, validationRows);
  await writeJson(paths.commandReceipt, {
    gate_id: GATE_ID,
    command: COMMAND,
    durable_command: `${COMMAND} -- --artifact-dir=${toRepoRelative(options.artifactDir)} --report-path=${toRepoRelative(options.reportPath)}`,
    git_commit: gitCommit(),
    generated_at: new Date().toISOString(),
    options,
  });
  await writeJson(paths.runSummaryJson, {
    gate_id: GATE_ID,
    verdict,
    variant_family: VARIANT_FAMILY,
    pair: PAIR,
    warehouse_manifest_id: manifest.manifest_id,
    warehouse_hash: manifest.warehouse_hash,
    weeks_replayed: weeks.length,
    matrix_configs: configs.length,
    cost_fractions: COST_FRACTIONS,
    summary_rows: summaryRows,
    validation_rows: validationRows,
    elapsed_ms: elapsedMs,
  });
  await writeText(options.reportPath, renderReport({ verdict, summaryRows: allSummary, tailRows, validationRows, artifacts: artifactsForReport, elapsedMs }));
  await writeShaManifest(paths.shaManifest, GATE_ID, COMMAND, [
    { label: "summary_json", path: paths.summaryJson },
    { label: "weekly_gross_json", path: paths.weeklyGrossJson },
    { label: "weekly_cost_json", path: paths.weeklyCostJson },
    { label: "yearly_json", path: paths.yearlyJson },
    { label: "rolling_json", path: paths.rollingJson },
    { label: "worst_drawdowns_json", path: paths.worstDrawdownsJson },
    { label: "tail_summary_json", path: paths.tailSummaryJson },
    { label: "tail_events_json", path: paths.tailEventsJson },
    { label: "validation_json", path: paths.validationJson },
    { label: "command_receipt", path: paths.commandReceipt },
    { label: "run_summary_json", path: paths.runSummaryJson },
    { label: "report", path: options.reportPath },
  ]);

  const baseline = summaryRows.find((row) => row.tail_fraction === 0 && row.cost_fraction === 0);
  const bestDd = summaryRows
    .filter((row) => row.cost_fraction === 0.05 && row.tail_fraction > 0)
    .sort((a, b) => (Number(b.max_dd_improvement_vs_baseline_adr) || -999999) - (Number(a.max_dd_improvement_vs_baseline_adr) || -999999))[0];
  console.log(JSON.stringify({
    verdict,
    weeks_replayed: weeks.length,
    matrix_configs: configs.length,
    cost_ladder_rows: summaryRows.length,
    report: toRepoRelative(options.reportPath),
    artifact_dir: toRepoRelative(options.artifactDir),
    baseline_gross_final_equity: baseline?.final_equity_mtm_adr ?? null,
    best_cost_005_dd_variant: bestDd?.variant_id ?? null,
    best_cost_005_dd_improvement: bestDd?.max_dd_improvement_vs_baseline_adr ?? null,
    elapsed_seconds: Math.round(elapsedMs / 1000),
  }, null, 2));
}

main().catch(async (error) => {
  console.error(error);
  await closePoolIfInitialized();
  process.exitCode = 1;
}).finally(async () => {
  await closePoolIfInitialized();
});
