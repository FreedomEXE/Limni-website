import { execFileSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { getPool, query } from "@database/db/client";
import { sha256Stable, sha256Text } from "@engine/research/hash";

const GATE58C_ID = "Gate 58C: forced-28-cot-strength-directional-arbitration";
const DEFAULT_MATRIX_ROWS_PATH =
  "docs/research/gates/gate58/artifacts/gate58-cot-strength-forensic-matrix/gate58-cot-strength-forensic-matrix.rows.jsonl";
const DEFAULT_GATE58_RESULT_PATH =
  "docs/research/gates/gate58/artifacts/gate58-cot-strength-forensic-matrix/gate58-cot-strength-forensic-matrix.result.json";
const DEFAULT_WAREHOUSE_ID = "gate57a0b_pair_week_path_outcomes_47B8F40AFB3B";
const DEFAULT_PRICE_BUNDLE_ID = "gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate58c/artifacts/gate58c-forced28-directional-arbitration";
const DEFAULT_REPORT_PATH =
  "docs/research/gates/gate58c/GATE58C_FORCED28_COT_STRENGTH_DIRECTIONAL_ARBITRATION_LOCK_TEST_2026-06-27.md";
const EXPECTED_ROWS = 10444;
const EXPECTED_WEEKS = 373;
const EXPECTED_SYMBOLS_PER_WEEK = 28;

type Side = "LONG" | "SHORT";
type CandidateId =
  | "A_COT_ONLY_INTERSECTION"
  | "B_STRENGTH_57E_ONLY_INTERSECTION"
  | "C_STRENGTH_HEALTHY_COT_FALLBACK"
  | "D_COT_PARENT_STRENGTH_HEALTHY_OVERRIDE";
type ProjectionId =
  | "cot_side"
  | "opposite_cot_side"
  | "raw_strength_parent_side"
  | "opposite_raw_strength_parent_side"
  | "gate57e_strength_side"
  | "opposite_gate57e_strength_side";

type CliOptions = {
  matrixRowsPath: string;
  gate58ResultPath: string;
  warehouseId: string;
  priceBundleId: string;
  artifactDir: string;
  reportPath: string;
};

type MatrixRow = {
  week_open_utc: string;
  year: number;
  quarter: string;
  symbol: string;
  price_bundle_id: string;
  warehouse_id: string;
  base_currency: string | null;
  quote_currency: string | null;
  cot_tei_spread: number | null;
  cot_abs_tei_spread: number | null;
  cot_tei_spread_bucket: string;
  cot_side: Side | null;
  cot_tie_flag: boolean;
  cot_carry_forward_flag: boolean;
  cot_carry_previous_flag: boolean;
  strength_score_spread: number | null;
  strength_abs_score_spread: number | null;
  strength_score_spread_bucket: string;
  strength_parent_side: Side | null;
  strength_lifecycle_bucket: string | null;
  strength_phase_bucket: string | null;
  gate57e_side: Side | null;
  adr_grid_long_adr: number | null;
  adr_grid_short_adr: number | null;
  weekly_hold_long_adr: number | null;
  weekly_hold_short_adr: number | null;
  cot_vs_strength_parent: "agree" | "disagree" | "missing";
  cot_vs_gate57e: "agree" | "disagree" | "missing";
  missing_cot_state: boolean;
  missing_strength_state: boolean;
  missing_long_outcome: boolean;
  missing_short_outcome: boolean;
};

type WarehouseOutcomeRow = {
  symbol: string;
  week_open_utc: Date | string;
  direction: Side;
  adr_grid_adr: number | string;
  adr_grid_fills: number | string;
  adr_grid_tp: number | string;
  adr_grid_reset: number | string;
  adr_grid_week_close: number | string;
  adr_grid_missing_price_rows: number | string;
  adr_grid_default_adr_rows: number | string;
  weekly_hold_adr: number | string;
  weekly_hold_missing_price_rows: number | string;
  weekly_hold_default_adr_rows: number | string;
};

type WarehouseOutcome = {
  adr_grid_adr: number;
  adr_grid_fills: number;
  adr_grid_tp: number;
  adr_grid_reset: number;
  adr_grid_week_close: number;
  adr_grid_missing_price_rows: number;
  adr_grid_default_adr_rows: number;
  weekly_hold_adr: number;
  weekly_hold_missing_price_rows: number;
  weekly_hold_default_adr_rows: number;
};

type ScoredRow = {
  row: MatrixRow;
  selectedSide: Side | null;
  sideSource: string;
  outcome: WarehouseOutcome | null;
  adrGridAdr: number | null;
  weeklyHoldAdr: number | null;
};

type Candidate = {
  id: CandidateId;
  label: string;
  family: "baseline" | "hybrid";
  rule: string;
  finalSide: (row: MatrixRow) => { side: Side | null; source: string; reason: string };
};

function parseCli(): CliOptions {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Build ${GATE58C_ID}.

Common:
  --matrix-rows-path=<path>   Default: ${DEFAULT_MATRIX_ROWS_PATH}
  --gate58-result-path=<path> Default: ${DEFAULT_GATE58_RESULT_PATH}
  --warehouse-id=<id>         Default: ${DEFAULT_WAREHOUSE_ID}
  --price-bundle-id=<id>      Default: ${DEFAULT_PRICE_BUNDLE_ID}
  --artifact-dir=<path>       Default: ${DEFAULT_ARTIFACT_DIR}
  --report-path=<path>        Default: ${DEFAULT_REPORT_PATH}

This command consumes the frozen Gate 58 matrix and existing warehouse long/short
outcomes only. It forces exactly 28 pair decisions per supported week and does
not run raw M1 simulation, change COT/Strength logic, add thresholds, add
eligibility filters, skip pair-weeks, run regimes, or promote execution/risk work.`);
    process.exit(0);
  }
  const argValue = (name: string) => {
    const prefix = `--${name}=`;
    return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  };
  return {
    matrixRowsPath: argValue("matrix-rows-path") ?? DEFAULT_MATRIX_ROWS_PATH,
    gate58ResultPath: argValue("gate58-result-path") ?? DEFAULT_GATE58_RESULT_PATH,
    warehouseId: argValue("warehouse-id") ?? DEFAULT_WAREHOUSE_ID,
    priceBundleId: argValue("price-bundle-id") ?? DEFAULT_PRICE_BUNDLE_ID,
    artifactDir: argValue("artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: argValue("report-path") ?? DEFAULT_REPORT_PATH,
  };
}

function currentGitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function dirtyTreeStatus() {
  try {
    const files = execFileSync("git", ["status", "--short", "--untracked-files=all"], { encoding: "utf8" })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    return { status: files.length > 0 ? "dirty" : "clean", files };
  } catch {
    return { status: "unknown", files: [] as string[] };
  }
}

function toRepoRelative(resolvedPath: string) {
  return path.relative(process.cwd(), resolvedPath).replace(/\\/g, "/");
}

function iso(value: Date | string) {
  return new Date(value).toISOString();
}

function round(value: number | null | undefined, digits = 6) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sum(values: Array<number | null | undefined>) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? Number(value) : 0), 0);
}

function mean(values: number[]) {
  return values.length > 0 ? round(sum(values) / values.length, 6) : null;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return round(sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid], 6);
}

function profitFactor(values: number[]) {
  const positives = values.filter((value) => value > 0).reduce((total, value) => total + value, 0);
  const negatives = values.filter((value) => value < 0).reduce((total, value) => total + value, 0);
  if (negatives === 0) return positives > 0 ? null : 0;
  return round(positives / Math.abs(negatives), 6);
}

function maxDrawdown(valuesByWeek: Map<string, number>) {
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const week of [...valuesByWeek.keys()].sort()) {
    equity += valuesByWeek.get(week) ?? 0;
    if (equity > peak) peak = equity;
    const dd = equity - peak;
    if (dd < maxDd) maxDd = dd;
  }
  return round(maxDd, 6) ?? 0;
}

function rOverDrawdown(sumValue: number | null, drawdown: number | null) {
  if (sumValue === null || drawdown === null || drawdown === 0) return null;
  return round(sumValue / Math.abs(drawdown), 6);
}

function outcomeKey(weekOpenUtc: string, symbol: string, direction: Side) {
  return `${weekOpenUtc}|${symbol.toUpperCase()}|${direction}`;
}

function parseJsonlRows(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as MatrixRow);
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort();
}

function countBy<T>(rows: T[], keyFn: (row: T) => string) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = keyFn(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function opposite(side: Side | null) {
  if (side === "LONG") return "SHORT";
  if (side === "SHORT") return "LONG";
  return null;
}

function strengthState(row: MatrixRow) {
  return `${row.strength_lifecycle_bucket ?? "missing"}:${row.strength_phase_bucket ?? "missing"}`;
}

function cotFlagState(row: MatrixRow) {
  return `tie=${row.cot_tie_flag};carry_forward=${row.cot_carry_forward_flag};carry_previous=${row.cot_carry_previous_flag}`;
}

function isWeakOrFragileState(row: MatrixRow) {
  if (row.strength_phase_bucket === "initial") return true;
  if (row.strength_lifecycle_bucket === "extreme" && row.strength_phase_bucket === "persistent") return true;
  if (row.strength_lifecycle_bucket === "extreme" && row.strength_phase_bucket === "flip") return true;
  if (row.strength_lifecycle_bucket === "middle" && row.strength_phase_bucket === "flip") return true;
  return false;
}

function healthyRetainedReason(row: MatrixRow) {
  return isWeakOrFragileState(row) ? `cot_fallback_${strengthState(row)}` : `gate57e_strength_${strengthState(row)}`;
}

function numberValues(rows: MatrixRow[], key: keyof MatrixRow) {
  return rows.map((row) => row[key]).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function spreadDiagnostics(rows: MatrixRow[]) {
  const summarize = (key: keyof MatrixRow) => {
    const values = numberValues(rows, key);
    return {
      count: values.length,
      min: values.length > 0 ? round(Math.min(...values), 6) : null,
      max: values.length > 0 ? round(Math.max(...values), 6) : null,
      mean: mean(values),
      median: median(values),
    };
  };
  return {
    cot_tei_spread: summarize("cot_tei_spread"),
    cot_abs_tei_spread: summarize("cot_abs_tei_spread"),
    strength_score_spread: summarize("strength_score_spread"),
    strength_abs_score_spread: summarize("strength_abs_score_spread"),
  };
}

function duplicateProof(rows: MatrixRow[]) {
  const counts = countBy(rows, (row) => `${row.week_open_utc}|${row.symbol}`);
  const duplicates = Object.entries(counts)
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }));
  return { duplicate_week_symbol_rows: duplicates.length, duplicates };
}

function rowsPerWeekDistribution(rows: MatrixRow[]) {
  const counts = countBy(rows, (row) => row.week_open_utc);
  const entries = Object.entries(counts).sort(([left], [right]) => left.localeCompare(right));
  const values = entries.map(([, count]) => count);
  return {
    weeks: values.length,
    full_weeks_count: values.filter((value) => value === EXPECTED_SYMBOLS_PER_WEEK).length,
    min_rows_per_week: values.length > 0 ? Math.min(...values) : 0,
    max_rows_per_week: values.length > 0 ? Math.max(...values) : 0,
    mean_rows_per_week: mean(values),
    histogram: countBy(values, (value) => String(value)),
    non_full_weeks: entries.filter(([, count]) => count !== EXPECTED_SYMBOLS_PER_WEEK).map(([week_open_utc, rows]) => ({ week_open_utc, rows })),
  };
}

function compactMetric(rows: ScoredRow[]) {
  const adrValues = rows.map((row) => row.adrGridAdr).filter((value): value is number => Number.isFinite(value));
  const holdValues = rows.map((row) => row.weeklyHoldAdr).filter((value): value is number => Number.isFinite(value));
  const adrByWeek = new Map<string, number>();
  const holdByWeek = new Map<string, number>();
  let fills = 0;
  let tp = 0;
  let reset = 0;
  let weekClose = 0;
  let adrMissingPriceRows = 0;
  let adrDefaultAdrRows = 0;
  let holdMissingPriceRows = 0;
  let holdDefaultAdrRows = 0;
  for (const scored of rows) {
    if (Number.isFinite(scored.adrGridAdr)) {
      adrByWeek.set(scored.row.week_open_utc, (adrByWeek.get(scored.row.week_open_utc) ?? 0) + Number(scored.adrGridAdr));
    }
    if (Number.isFinite(scored.weeklyHoldAdr)) {
      holdByWeek.set(scored.row.week_open_utc, (holdByWeek.get(scored.row.week_open_utc) ?? 0) + Number(scored.weeklyHoldAdr));
    }
    if (scored.outcome) {
      fills += scored.outcome.adr_grid_fills;
      tp += scored.outcome.adr_grid_tp;
      reset += scored.outcome.adr_grid_reset;
      weekClose += scored.outcome.adr_grid_week_close;
      adrMissingPriceRows += scored.outcome.adr_grid_missing_price_rows;
      adrDefaultAdrRows += scored.outcome.adr_grid_default_adr_rows;
      holdMissingPriceRows += scored.outcome.weekly_hold_missing_price_rows;
      holdDefaultAdrRows += scored.outcome.weekly_hold_default_adr_rows;
    }
  }
  const adrSum = round(sum(adrValues), 6);
  const adrDd = maxDrawdown(adrByWeek);
  const holdSum = round(sum(holdValues), 6);
  const holdDd = maxDrawdown(holdByWeek);
  return {
    rows: rows.length,
    weeks: new Set(rows.map((row) => row.row.week_open_utc)).size,
    symbols: new Set(rows.map((row) => row.row.symbol)).size,
    selected_long_rows: rows.filter((row) => row.selectedSide === "LONG").length,
    selected_short_rows: rows.filter((row) => row.selectedSide === "SHORT").length,
    missing_selected_side_rows: rows.filter((row) => !row.selectedSide).length,
    missing_selected_outcome_rows: rows.filter((row) => row.selectedSide && !row.outcome).length,
    adr_grid: {
      adr_sum: adrSum,
      adr_mean: mean(adrValues),
      max_drawdown: adrDd,
      r_over_drawdown: rOverDrawdown(adrSum, adrDd),
      row_pf: profitFactor(adrValues),
      fills,
      tp,
      reset,
      week_close: weekClose,
      tp_rate_per_fill: fills > 0 ? round(tp / fills, 6) : null,
      reset_rate_per_fill: fills > 0 ? round(reset / fills, 6) : null,
      week_close_rate_per_fill: fills > 0 ? round(weekClose / fills, 6) : null,
      missing_price_rows: adrMissingPriceRows,
      default_adr_rows: adrDefaultAdrRows,
    },
    weekly_hold: {
      adr_sum: holdSum,
      adr_mean: mean(holdValues),
      max_drawdown: holdDd,
      r_over_drawdown: rOverDrawdown(holdSum, holdDd),
      row_pf: profitFactor(holdValues),
      missing_price_rows: holdMissingPriceRows,
      default_adr_rows: holdDefaultAdrRows,
    },
  };
}

function groupMetrics(rows: ScoredRow[], groupFn: (row: ScoredRow) => Record<string, string>) {
  const groups = new Map<string, { group: Record<string, string>; rows: ScoredRow[] }>();
  for (const row of rows) {
    const group = groupFn(row);
    const key = JSON.stringify(group);
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(row);
    } else {
      groups.set(key, { group, rows: [row] });
    }
  }
  return [...groups.values()]
    .sort((left, right) => JSON.stringify(left.group).localeCompare(JSON.stringify(right.group)))
    .map((entry) => ({
      group: entry.group,
      ...compactMetric(entry.rows),
      spread_diagnostics: spreadDiagnostics(entry.rows.map((row) => row.row)),
    }));
}

function outlierContribution(rows: ScoredRow[]) {
  const byWeek = new Map<string, number>();
  for (const row of rows) {
    if (Number.isFinite(row.adrGridAdr)) {
      byWeek.set(row.row.week_open_utc, (byWeek.get(row.row.week_open_utc) ?? 0) + Number(row.adrGridAdr));
    }
  }
  const sorted = [...byWeek.entries()]
    .map(([week_open_utc, adr_grid_sum]) => ({ week_open_utc, adr_grid_sum: round(adr_grid_sum, 6) ?? 0 }))
    .sort((left, right) => Math.abs(right.adr_grid_sum) - Math.abs(left.adr_grid_sum));
  const totalAbs = sorted.reduce((total, row) => total + Math.abs(row.adr_grid_sum), 0);
  const top5Abs = sorted.slice(0, 5).reduce((total, row) => total + Math.abs(row.adr_grid_sum), 0);
  return {
    top5_abs_week_share: totalAbs > 0 ? round(top5Abs / totalAbs, 6) : null,
    top_abs_weeks: sorted.slice(0, 10),
  };
}

function pairConcentration(pairContribution: ReturnType<typeof groupMetrics>) {
  const values = pairContribution.map((row) => ({
    symbol: row.group.symbol,
    adr_grid_sum: row.adr_grid.adr_sum ?? 0,
  }));
  const totalAbs = values.reduce((total, row) => total + Math.abs(row.adr_grid_sum), 0);
  const top = values.sort((left, right) => Math.abs(right.adr_grid_sum) - Math.abs(left.adr_grid_sum))[0] ?? null;
  return {
    top_abs_pair: top,
    top_abs_pair_share: top && totalAbs > 0 ? round(Math.abs(top.adr_grid_sum) / totalAbs, 6) : null,
  };
}

function sideOutcome(row: MatrixRow, side: Side | null, outcomes: Map<string, WarehouseOutcome>) {
  return side ? outcomes.get(outcomeKey(row.week_open_utc, row.symbol, side)) ?? null : null;
}

function scoreByFinalSide(rows: MatrixRow[], outcomes: Map<string, WarehouseOutcome>, finalSide: (row: MatrixRow) => { side: Side | null; source: string }) {
  return rows.map((row) => {
    const selected = finalSide(row);
    const outcome = sideOutcome(row, selected.side, outcomes);
    return {
      row,
      selectedSide: selected.side,
      sideSource: selected.source,
      outcome,
      adrGridAdr: outcome?.adr_grid_adr ?? null,
      weeklyHoldAdr: outcome?.weekly_hold_adr ?? null,
    };
  });
}

function scoreProjection(rows: MatrixRow[], outcomes: Map<string, WarehouseOutcome>, projection: ProjectionId) {
  const projectionSide = (row: MatrixRow): { side: Side | null; source: string } => {
    if (projection === "cot_side") return { side: row.cot_side, source: projection };
    if (projection === "opposite_cot_side") return { side: opposite(row.cot_side), source: projection };
    if (projection === "raw_strength_parent_side") return { side: row.strength_parent_side, source: projection };
    if (projection === "opposite_raw_strength_parent_side") return { side: opposite(row.strength_parent_side), source: projection };
    if (projection === "gate57e_strength_side") return { side: row.gate57e_side, source: projection };
    return { side: opposite(row.gate57e_side), source: projection };
  };
  return scoreByFinalSide(rows, outcomes, projectionSide);
}

function buildCandidates(): Candidate[] {
  return [
    {
      id: "A_COT_ONLY_INTERSECTION",
      label: "A. COT only on 373-week intersection",
      family: "baseline",
      rule: "Final side equals the locked CLP COT side for every pair-week in the 373-week COT x Strength intersection.",
      finalSide: (row) => ({ side: row.cot_side, source: "cot_side", reason: "locked_cot_side" }),
    },
    {
      id: "B_STRENGTH_57E_ONLY_INTERSECTION",
      label: "B. Gate 57E Strength only on 373-week intersection",
      family: "baseline",
      rule: "Final side equals the locked Gate 57E phase_conditioned_remainder Strength side for every pair-week in the 373-week intersection.",
      finalSide: (row) => ({ side: row.gate57e_side, source: "gate57e_side", reason: "locked_gate57e_strength_side" }),
    },
    {
      id: "C_STRENGTH_HEALTHY_COT_FALLBACK",
      label: "C. Strength healthy state with COT fallback",
      family: "hybrid",
      rule:
        "Use Gate 57E Strength when the Strength lifecycle x phase state is compressed:persistent, compressed:flip, or middle:persistent; otherwise fall back to locked COT.",
      finalSide: (row) =>
        isWeakOrFragileState(row)
          ? { side: row.cot_side, source: "cot_side", reason: healthyRetainedReason(row) }
          : { side: row.gate57e_side, source: "gate57e_side", reason: healthyRetainedReason(row) },
    },
    {
      id: "D_COT_PARENT_STRENGTH_HEALTHY_OVERRIDE",
      label: "D. COT parent with Strength healthy override",
      family: "hybrid",
      rule:
        "Use locked COT by default; override to Gate 57E Strength only for compressed:persistent, compressed:flip, and middle:persistent Strength states.",
      finalSide: (row) =>
        isWeakOrFragileState(row)
          ? { side: row.cot_side, source: "cot_side", reason: healthyRetainedReason(row) }
          : { side: row.gate57e_side, source: "gate57e_side", reason: healthyRetainedReason(row) },
    },
  ];
}

function validateMatrix(rows: MatrixRow[], cli: CliOptions) {
  const weeks = uniqueSorted(rows.map((row) => row.week_open_utc));
  const symbols = uniqueSorted(rows.map((row) => row.symbol));
  const rowsByWeek = rowsPerWeekDistribution(rows);
  const duplicates = duplicateProof(rows);
  return {
    row_count: rows.length,
    expected_row_count: EXPECTED_ROWS,
    week_count: weeks.length,
    expected_week_count: EXPECTED_WEEKS,
    symbol_count: symbols.length,
    expected_symbols_per_week: EXPECTED_SYMBOLS_PER_WEEK,
    rows_per_week: rowsByWeek,
    duplicate_week_symbol_rows: duplicates.duplicate_week_symbol_rows,
    missing_cot_state_rows: rows.filter((row) => row.missing_cot_state || !row.cot_side).length,
    missing_strength_state_rows: rows.filter((row) => row.missing_strength_state || !row.gate57e_side || !row.strength_parent_side).length,
    missing_long_outcomes: rows.filter((row) => row.missing_long_outcome || row.adr_grid_long_adr === null || row.weekly_hold_long_adr === null).length,
    missing_short_outcomes: rows.filter((row) => row.missing_short_outcome || row.adr_grid_short_adr === null || row.weekly_hold_short_adr === null).length,
    price_bundle_mismatch_rows: rows.filter((row) => row.price_bundle_id !== cli.priceBundleId).length,
    warehouse_mismatch_rows: rows.filter((row) => row.warehouse_id !== cli.warehouseId).length,
    first_week: weeks[0] ?? null,
    last_week: weeks[weeks.length - 1] ?? null,
  };
}

async function loadWarehouseOutcomes(cli: CliOptions, rows: MatrixRow[]) {
  const weeks = uniqueSorted(rows.map((row) => row.week_open_utc));
  const symbols = uniqueSorted(rows.map((row) => row.symbol));
  const rowsRead = await query<WarehouseOutcomeRow>(
    `SELECT symbol, week_open_utc, direction, adr_grid_adr, adr_grid_fills,
            adr_grid_tp, adr_grid_reset, adr_grid_week_close,
            adr_grid_missing_price_rows, adr_grid_default_adr_rows,
            weekly_hold_adr, weekly_hold_missing_price_rows, weekly_hold_default_adr_rows
       FROM research_pair_week_path_outcomes
      WHERE manifest_id = $1
        AND price_bundle_id = $2
        AND week_open_utc = ANY($3::timestamptz[])
        AND symbol = ANY($4::text[])
      ORDER BY week_open_utc, symbol, direction`,
    [cli.warehouseId, cli.priceBundleId, weeks, symbols],
  );
  const outcomes = new Map<string, WarehouseOutcome>();
  for (const row of rowsRead) {
    outcomes.set(outcomeKey(iso(row.week_open_utc), row.symbol, row.direction), {
      adr_grid_adr: Number(row.adr_grid_adr),
      adr_grid_fills: Number(row.adr_grid_fills),
      adr_grid_tp: Number(row.adr_grid_tp),
      adr_grid_reset: Number(row.adr_grid_reset),
      adr_grid_week_close: Number(row.adr_grid_week_close),
      adr_grid_missing_price_rows: Number(row.adr_grid_missing_price_rows),
      adr_grid_default_adr_rows: Number(row.adr_grid_default_adr_rows),
      weekly_hold_adr: Number(row.weekly_hold_adr),
      weekly_hold_missing_price_rows: Number(row.weekly_hold_missing_price_rows),
      weekly_hold_default_adr_rows: Number(row.weekly_hold_default_adr_rows),
    });
  }
  return {
    outcomes,
    validation: {
      warehouse_rows_read: rowsRead.length,
      expected_rows: weeks.length * symbols.length * 2,
      missing_directional_outcomes: rows
        .flatMap((row) => [outcomeKey(row.week_open_utc, row.symbol, "LONG"), outcomeKey(row.week_open_utc, row.symbol, "SHORT")])
        .filter((key) => !outcomes.has(key)).length,
    },
  };
}

function scoreSignature(scoredRows: ScoredRow[]) {
  return sha256Text(
    scoredRows
      .map((row) => `${row.row.week_open_utc}|${row.row.symbol}|${row.selectedSide ?? "MISSING"}`)
      .sort()
      .join("\n"),
  );
}

function contributionByCell(candidate: ScoredRow[], baseline: ScoredRow[], groupName: string, groupFn: (row: ScoredRow) => Record<string, string>) {
  const groups = new Map<string, { group: Record<string, string>; candidate: ScoredRow[]; baseline: ScoredRow[] }>();
  const keyFor = (row: ScoredRow) => JSON.stringify(groupFn(row));
  for (const row of candidate) {
    const group = groupFn(row);
    const key = JSON.stringify(group);
    groups.set(key, { group, candidate: [...(groups.get(key)?.candidate ?? []), row], baseline: groups.get(key)?.baseline ?? [] });
  }
  for (const row of baseline) {
    const key = keyFor(row);
    const existing = groups.get(key);
    if (existing) existing.baseline.push(row);
  }
  return {
    group_name: groupName,
    groups: [...groups.values()]
      .sort((left, right) => JSON.stringify(left.group).localeCompare(JSON.stringify(right.group)))
      .map((entry) => {
        const candidateMetric = compactMetric(entry.candidate);
        const baselineMetric = compactMetric(entry.baseline);
        return {
          group: entry.group,
          rows: entry.candidate.length,
          weeks: new Set(entry.candidate.map((row) => row.row.week_open_utc)).size,
          candidate_adr_grid_sum: candidateMetric.adr_grid.adr_sum,
          baseline_adr_grid_sum: baselineMetric.adr_grid.adr_sum,
          adr_grid_delta: round((candidateMetric.adr_grid.adr_sum ?? 0) - (baselineMetric.adr_grid.adr_sum ?? 0), 6),
          candidate_weekly_hold_sum: candidateMetric.weekly_hold.adr_sum,
          baseline_weekly_hold_sum: baselineMetric.weekly_hold.adr_sum,
          weekly_hold_delta: round((candidateMetric.weekly_hold.adr_sum ?? 0) - (baselineMetric.weekly_hold.adr_sum ?? 0), 6),
          spread_diagnostics: spreadDiagnostics(entry.candidate.map((row) => row.row)),
        };
      }),
  };
}

function candidateValidation(scored: ScoredRow[], matrixRows: MatrixRow[]) {
  const rows = scored.map((row) => row.row);
  const rowsByWeek = rowsPerWeekDistribution(rows);
  const duplicates = duplicateProof(rows);
  return {
    rows: scored.length,
    expected_rows: EXPECTED_ROWS,
    weeks: rowsByWeek.weeks,
    expected_weeks: EXPECTED_WEEKS,
    full_weeks_count: rowsByWeek.full_weeks_count,
    duplicate_week_symbol_rows: duplicates.duplicate_week_symbol_rows,
    missing_cot_rows: matrixRows.filter((row) => row.missing_cot_state || !row.cot_side).length,
    missing_strength_rows: matrixRows.filter((row) => row.missing_strength_state || !row.gate57e_side || !row.strength_parent_side).length,
    missing_warehouse_outcomes: scored.filter((row) => row.selectedSide && !row.outcome).length,
    missing_final_side_rows: scored.filter((row) => !row.selectedSide).length,
    non_full_weeks: rowsByWeek.non_full_weeks,
  };
}

function summarizeCandidate(
  candidate: Candidate,
  matrixRows: MatrixRow[],
  outcomes: Map<string, WarehouseOutcome>,
  cotBaselineRows: ScoredRow[],
  strengthBaselineRows: ScoredRow[],
  duplicateOf: CandidateId | null,
) {
  const scored = scoreByFinalSide(matrixRows, outcomes, (row) => candidate.finalSide(row));
  const metrics = compactMetric(scored);
  const calendarYear = groupMetrics(scored, (row) => ({ year: String(row.row.year) }));
  const pairContribution = groupMetrics(scored, (row) => ({ symbol: row.row.symbol }));
  const lifecyclePhaseVsCot = contributionByCell(scored, cotBaselineRows, "strength_lifecycle_phase_vs_cot", (row) => ({
    strength_lifecycle_bucket: row.row.strength_lifecycle_bucket ?? "missing",
    strength_phase_bucket: row.row.strength_phase_bucket ?? "missing",
  }));
  const lifecyclePhaseVsStrength = contributionByCell(scored, strengthBaselineRows, "strength_lifecycle_phase_vs_gate57e", (row) => ({
    strength_lifecycle_bucket: row.row.strength_lifecycle_bucket ?? "missing",
    strength_phase_bucket: row.row.strength_phase_bucket ?? "missing",
  }));
  const agreementContribution = contributionByCell(scored, cotBaselineRows, "cot_vs_gate57e_agreement_vs_cot", (row) => ({
    cot_vs_gate57e: row.row.cot_vs_gate57e,
  }));
  return {
    id: candidate.id,
    label: candidate.label,
    family: candidate.family,
    duplicate_of: duplicateOf,
    rule: candidate.rule,
    validation: candidateValidation(scored, matrixRows),
    metrics,
    calendar_year_adr_grid: calendarYear.map((row) => ({
      year: row.group.year,
      rows: row.rows,
      weeks: row.weeks,
      adr_grid_adr: row.adr_grid.adr_sum,
      adr_grid_max_drawdown: row.adr_grid.max_drawdown,
      adr_grid_r_over_drawdown: row.adr_grid.r_over_drawdown,
      adr_grid_pf: row.adr_grid.row_pf,
      weekly_hold_adr: row.weekly_hold.adr_sum,
    })),
    pair_contribution: pairContribution,
    pair_concentration: pairConcentration(pairContribution),
    top_five_absolute_week_share: outlierContribution(scored),
    contribution_versus_cot_by_strength_lifecycle_phase: lifecyclePhaseVsCot,
    contribution_versus_strength57e_by_strength_lifecycle_phase: lifecyclePhaseVsStrength,
    agreement_disagreement_contribution: agreementContribution,
    side_source_distribution: countBy(scored, (row) => row.sideSource),
    reason_distribution: countBy(
      matrixRows.map((row) => ({ row, selected: candidate.finalSide(row) })),
      (entry) => entry.selected.reason,
    ),
    decision_signature_sha256: scoreSignature(scored),
  };
}

function buildForensicDecomposition(matrixRows: MatrixRow[], outcomes: Map<string, WarehouseOutcome>) {
  const projections: Record<string, unknown> = {};
  const projectionIds: ProjectionId[] = [
    "cot_side",
    "opposite_cot_side",
    "raw_strength_parent_side",
    "opposite_raw_strength_parent_side",
    "gate57e_strength_side",
    "opposite_gate57e_strength_side",
  ];
  for (const projection of projectionIds) {
    const scored = scoreProjection(matrixRows, outcomes, projection);
    projections[projection] = {
      metrics: compactMetric(scored),
      by_year: groupMetrics(scored, (row) => ({ year: String(row.row.year) })),
      by_pair: groupMetrics(scored, (row) => ({ symbol: row.row.symbol })),
      by_cot_vs_gate57e: groupMetrics(scored, (row) => ({ cot_vs_gate57e: row.row.cot_vs_gate57e })),
      by_cot_vs_strength_parent: groupMetrics(scored, (row) => ({ cot_vs_strength_parent: row.row.cot_vs_strength_parent })),
      by_strength_lifecycle_bucket: groupMetrics(scored, (row) => ({ strength_lifecycle_bucket: row.row.strength_lifecycle_bucket ?? "missing" })),
      by_strength_phase_bucket: groupMetrics(scored, (row) => ({ strength_phase_bucket: row.row.strength_phase_bucket ?? "missing" })),
      by_strength_lifecycle_phase: groupMetrics(scored, (row) => ({
        strength_lifecycle_bucket: row.row.strength_lifecycle_bucket ?? "missing",
        strength_phase_bucket: row.row.strength_phase_bucket ?? "missing",
      })),
      by_cot_flag_state: groupMetrics(scored, (row) => ({ cot_flag_state: cotFlagState(row.row) })),
      by_existing_cot_tei_spread_bucket: groupMetrics(scored, (row) => ({ cot_tei_spread_bucket: row.row.cot_tei_spread_bucket })),
      by_existing_strength_score_spread_bucket: groupMetrics(scored, (row) => ({ strength_score_spread_bucket: row.row.strength_score_spread_bucket })),
    };
  }
  return {
    note:
      "Spread summaries are diagnostics only. No COT TEI spread, absolute TEI spread, Strength score spread, or absolute Strength score spread value is used by any candidate rule.",
    projection_outcomes: projections,
    global_spread_diagnostics: spreadDiagnostics(matrixRows),
  };
}

async function maybeReadGate58Reference(resultPath: string) {
  try {
    const text = await readFile(resultPath, "utf8");
    const result = JSON.parse(text) as { reference_summaries?: Record<string, unknown> };
    return result.reference_summaries ?? null;
  } catch {
    return null;
  }
}

function yearStability(metrics: ReturnType<typeof compactMetric>, yearRows: Array<{ year: string; adr_grid_adr: number | null }>) {
  const values = yearRows.map((row) => row.adr_grid_adr).filter((value): value is number => Number.isFinite(value));
  return {
    negative_year_count: values.filter((value) => value < 0).length,
    worst_year_adr_grid: values.length > 0 ? round(Math.min(...values), 6) : null,
    best_year_adr_grid: values.length > 0 ? round(Math.max(...values), 6) : null,
    adr_grid_sum: metrics.adr_grid.adr_sum,
    adr_grid_r_over_drawdown: metrics.adr_grid.r_over_drawdown,
    adr_grid_pf: metrics.adr_grid.row_pf,
  };
}

function topPositiveLifecyclePhaseContribution(candidate: ReturnType<typeof summarizeCandidate>) {
  const groups = candidate.contribution_versus_cot_by_strength_lifecycle_phase.groups
    .filter((group) => Number.isFinite(group.adr_grid_delta) && Number(group.adr_grid_delta) > 0)
    .sort((left, right) => Number(right.adr_grid_delta) - Number(left.adr_grid_delta));
  const top = groups[0] ?? null;
  return {
    top_positive_cell: top
      ? {
          group: top.group,
          rows: top.rows,
          weeks: top.weeks,
          adr_grid_delta_vs_cot: top.adr_grid_delta,
        }
      : null,
    not_tiny_cell_dependent: top ? top.rows >= 392 && top.weeks >= 52 : true,
  };
}

function promotionScreen(candidates: ReturnType<typeof summarizeCandidate>[], cot: ReturnType<typeof summarizeCandidate>, strength: ReturnType<typeof summarizeCandidate>) {
  const cotStability = yearStability(cot.metrics, cot.calendar_year_adr_grid);
  const strengthStability = yearStability(strength.metrics, strength.calendar_year_adr_grid);
  const cotAdr = cot.metrics.adr_grid.adr_sum ?? Number.NEGATIVE_INFINITY;
  const cotRdd = cot.metrics.adr_grid.r_over_drawdown ?? Number.NEGATIVE_INFINITY;
  const cotPf = cot.metrics.adr_grid.row_pf ?? Number.NEGATIVE_INFINITY;
  const rows = candidates.map((candidate) => {
    const stability = yearStability(candidate.metrics, candidate.calendar_year_adr_grid);
    const fullForced28 =
      candidate.validation.rows === EXPECTED_ROWS &&
      candidate.validation.weeks === EXPECTED_WEEKS &&
      candidate.validation.full_weeks_count === EXPECTED_WEEKS &&
      candidate.validation.duplicate_week_symbol_rows === 0 &&
      candidate.validation.missing_final_side_rows === 0 &&
      candidate.validation.missing_warehouse_outcomes === 0;
    const beatsCotAdr = (candidate.metrics.adr_grid.adr_sum ?? Number.NEGATIVE_INFINITY) > cotAdr;
    const beatsCotRdd = (candidate.metrics.adr_grid.r_over_drawdown ?? Number.NEGATIVE_INFINITY) > cotRdd;
    const pfDelta = round((candidate.metrics.adr_grid.row_pf ?? Number.NEGATIVE_INFINITY) - cotPf, 6);
    const pfNotMateriallyWorse = pfDelta !== null && pfDelta >= -0.005;
    const yearStabilityNotDegraded =
      stability.negative_year_count <= cotStability.negative_year_count &&
      stability.negative_year_count <= strengthStability.negative_year_count &&
      (stability.worst_year_adr_grid ?? Number.NEGATIVE_INFINITY) >=
        Math.min(cotStability.worst_year_adr_grid ?? Number.NEGATIVE_INFINITY, strengthStability.worst_year_adr_grid ?? Number.NEGATIVE_INFINITY);
    const topFiveShare = candidate.top_five_absolute_week_share.top5_abs_week_share;
    const topPairShare = candidate.pair_concentration.top_abs_pair_share;
    const topCellContribution = topPositiveLifecyclePhaseContribution(candidate);
    const notTopWeekDependent = topFiveShare === null || topFiveShare < 0.35;
    const notPairDependent = topPairShare === null || topPairShare < 0.25;
    const notTinyCellDependent = topCellContribution.not_tiny_cell_dependent;
    const simpleRule = candidate.rule.length > 0;
    const isHybrid = candidate.family === "hybrid";
    const isUnique = candidate.duplicate_of === null;
    return {
      candidate_id: candidate.id,
      duplicate_of: candidate.duplicate_of,
      family: candidate.family,
      full_forced_28: fullForced28,
      beats_cot_adr_grid_adr: beatsCotAdr,
      beats_cot_rdd: beatsCotRdd,
      pf_delta_vs_cot: pfDelta,
      pf_not_materially_worse: pfNotMateriallyWorse,
      year_stability_not_degraded_vs_both: yearStabilityNotDegraded,
      negative_year_count: stability.negative_year_count,
      worst_year_adr_grid: stability.worst_year_adr_grid,
      top5_abs_week_share: topFiveShare,
      not_top_five_week_dependent: notTopWeekDependent,
      top_abs_pair_share: topPairShare,
      not_pair_dependent: notPairDependent,
      top_positive_lifecycle_phase_delta_vs_cot: topCellContribution.top_positive_cell,
      not_tiny_cell_dependent: notTinyCellDependent,
      simple_one_paragraph_rule: simpleRule,
      evaluated_for_combined_lock: isHybrid && isUnique,
      lock_candidate:
        isHybrid &&
        isUnique &&
        fullForced28 &&
        beatsCotAdr &&
        beatsCotRdd &&
        pfNotMateriallyWorse &&
        yearStabilityNotDegraded &&
        notTopWeekDependent &&
        notPairDependent &&
        notTinyCellDependent &&
        simpleRule,
    };
  });
  return {
    cot_intersection_stability: cotStability,
    strength57e_intersection_stability: strengthStability,
    candidates: rows,
  };
}

function decisionRead(screen: ReturnType<typeof promotionScreen>) {
  const lock = screen.candidates.find((candidate) => candidate.lock_candidate);
  if (lock) {
    return {
      verdict: "PASS_FORCED_28_DIRECTIONAL_LOCK",
      summary:
        "A unique predeclared forced-28 hybrid beats the COT 373-week intersection on ADR Grid and R/DD, does not materially worsen PF, preserves year stability versus both baselines, and is not concentrated in a tiny cell, one pair, or the top five weeks.",
      lock_candidate: lock,
    };
  }
  const alive = screen.candidates.find(
    (candidate) =>
      candidate.evaluated_for_combined_lock &&
      candidate.full_forced_28 &&
      candidate.beats_cot_adr_grid_adr &&
      candidate.beats_cot_rdd &&
      candidate.pf_not_materially_worse,
  );
  if (alive) {
    return {
      verdict: "PASS_WITH_CAVEATS_FORCED_28_ALIVE_NOT_LOCKED",
      summary:
        "A forced-28 hybrid improves the COT 373-week aggregate ADR Grid/R-DD screen, but one or more lock-quality screens fail. Treat it as alive, not locked.",
      best_alive_candidate: alive,
    };
  }
  return {
    verdict: "FAIL_NO_COMBINED_DIRECTIONAL_EDGE_COT_REMAINS_PARENT",
    summary:
      "No unique predeclared forced-28 hybrid cleanly beats the COT 373-week intersection under the forced full-surface promotion criteria. COT remains the parent directional baseline.",
  };
}

function alphaV1Governance() {
  return {
    alpha_id: "ALPHA_V1_COT_PARENT_STRENGTH_HEALTHY_FALLBACK",
    status: "provisional_forced28_directional_lock_for_forward_comparison",
    one_paragraph_rule:
      "Use locked COT side by default for every pair-week. Use locked Gate 57E Strength side only when the Strength state is compressed:persistent, compressed:flip, or middle:persistent. The alpha layer must output exactly 28 pair directions per supported week and must never skip rows.",
    interpretation: [
      "Gate 58C is accepted as the current forced-28 Alpha v1 directional lock, not as a permanent endorsement of the current Strength formulation.",
      "The lock exists to provide a stable baseline for Regime construction.",
      "This is not a final trading system, portfolio-ready system, investor-ready system, live system, risk layer, execution layer, or MT5/app integration.",
    ],
    strength_caveat: [
      "Strength remains provisional signal debt.",
      "Current Strength improved the forced-28 directional surface but lowered PF relative to stronger standalone Strength-quality diagnostics.",
      "PF caveat is real: the result is stronger aggregate forced-28 directional value, not a finished execution-quality portfolio.",
    ],
    future_versioning_rights: [
      "Strength may be revised, removed, or replaced only through a new versioned research gate.",
      "Future Strength changes must compare against COT-only, Alpha v1, Regime-only forced-28 shadow signal when available, and any Alpha v2 arbitration candidate.",
      "No silent Strength retuning, removal, or replacement is allowed inside Regime, risk, execution, MT5/live, or app-integration gates.",
    ],
    sequencing: [
      "Do not run more COT x Strength optimization in this lane.",
      "Do not test more Strength windows, add state cells, or expand the three-state rule into a larger tree before Regime source integrity and Regime shadow-signal work.",
      "Regime may begin from this frozen Alpha v1 baseline after Gate 58C is packaged.",
    ],
    permanent_layering_rule:
      "Alpha layers must force 28 pair-week directions. Risk/portfolio layers may later trade fewer than 28, but the shadow ledger must retain all 28 signal outcomes.",
  };
}

function compactCandidateForReport(candidate: ReturnType<typeof summarizeCandidate>) {
  return {
    id: candidate.id,
    duplicate_of: candidate.duplicate_of,
    rows: candidate.validation.rows,
    weeks: candidate.validation.weeks,
    full_weeks_count: candidate.validation.full_weeks_count,
    duplicate_week_symbol_rows: candidate.validation.duplicate_week_symbol_rows,
    missing_cot_rows: candidate.validation.missing_cot_rows,
    missing_strength_rows: candidate.validation.missing_strength_rows,
    missing_warehouse_outcomes: candidate.validation.missing_warehouse_outcomes,
    adr_grid_adr: candidate.metrics.adr_grid.adr_sum,
    max_drawdown: candidate.metrics.adr_grid.max_drawdown,
    r_over_drawdown: candidate.metrics.adr_grid.r_over_drawdown,
    pf: candidate.metrics.adr_grid.row_pf,
    weekly_hold_adr: candidate.metrics.weekly_hold.adr_sum,
    top5_abs_week_share: candidate.top_five_absolute_week_share.top5_abs_week_share,
    top_abs_pair_share: candidate.pair_concentration.top_abs_pair_share,
    rule: candidate.rule,
  };
}

function renderReport(options: {
  generatedAtUtc: string;
  runtimeCommit: string;
  dirtyTree: ReturnType<typeof dirtyTreeStatus>;
  cli: CliOptions;
  validation: Record<string, unknown>;
  gate58References: Record<string, unknown> | null;
  candidates: ReturnType<typeof summarizeCandidate>[];
  promotionScreen: ReturnType<typeof promotionScreen>;
  decision: ReturnType<typeof decisionRead>;
  alphaGovernance: ReturnType<typeof alphaV1Governance>;
  summaryPath: string;
  decisionRowsPath: string;
  receiptPath: string;
  hashPath: string;
  shaPath: string;
  summaryHash: string;
  decisionRowsHash: string;
  receiptHash: string;
  combinedHash: string;
  runtimeSeconds: number;
}) {
  const compactCandidates = options.candidates.map(compactCandidateForReport);
  const lines = [
    "# Gate 58C Forced-28 COT x Strength Directional Arbitration Lock Test",
    "",
    `Generated: ${options.generatedAtUtc}`,
    "",
    "## Verdict",
    "",
    `${options.decision.verdict}.`,
    "",
    options.decision.summary,
    "",
    "## Boundary",
    "",
    `- Matrix input: \`${options.cli.matrixRowsPath}\``,
    `- Warehouse ID: \`${options.cli.warehouseId}\``,
    `- Price bundle: \`${options.cli.priceBundleId}\``,
    "- COT baseline: `CLP carry-forward + carry-previous tie fill`",
    "- Strength baseline: `phase_conditioned_remainder`",
    "- Window: 373-week COT x Strength intersection only",
    "- Outcome source: frozen Gate 58 matrix plus warehouse long/short outcomes only",
    "- Forced-28 rule: every candidate must output `10,444` rows = `373` weeks x `28` symbols",
    "- Not run: raw M1 simulation, app code, COT source changes, Strength window/source changes, row vetoes, skipped pair-weeks, eligibility filters, pair/calendar exclusions, regimes, risk overlays, execution changes, market-open confirmation, thresholds, buckets, or parameter searches.",
    "",
    "## Artifacts",
    "",
    `- Summary JSON: \`${options.summaryPath}\``,
    `- Summary SHA-256: \`${options.summaryHash}\``,
    `- Candidate row-level decisions JSONL: \`${options.decisionRowsPath}\``,
    `- Candidate row-level decisions SHA-256: \`${options.decisionRowsHash}\``,
    `- Receipt JSON: \`${options.receiptPath}\``,
    `- Receipt SHA-256: \`${options.receiptHash}\``,
    `- Hash manifest JSON: \`${options.hashPath}\``,
    `- Tracked SHA-256 identity file: \`${options.shaPath}\``,
    `- Combined artifact hash: \`${options.combinedHash}\``,
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(options.validation, null, 2),
    "```",
    "",
    "## COT Full Reference",
    "",
    "The COT full 388-week reference is reported separately and is not the direct lock-comparison window.",
    "",
    "```json",
    JSON.stringify(options.gate58References, null, 2),
    "```",
    "",
    "## Candidate Metrics",
    "",
    "```json",
    JSON.stringify(compactCandidates, null, 2),
    "```",
    "",
    "## Promotion Screen",
    "",
    "```json",
    JSON.stringify(options.promotionScreen, null, 2),
    "```",
    "",
    "## Decision Read",
    "",
    "```json",
    JSON.stringify(options.decision, null, 2),
    "```",
    "",
    "## Alpha V1 Governance",
    "",
    "```json",
    JSON.stringify(options.alphaGovernance, null, 2),
    "```",
    "",
    "## Duplicate Decision Surface",
    "",
    "`D_COT_PARENT_STRENGTH_HEALTHY_OVERRIDE` is expected to collapse to Candidate C if the predeclared healthy-state override is identical to Strength-healthy/COT-fallback. Duplicate status is recorded in the candidate summaries and promotion screen.",
    "",
    "## Dirty Tree",
    "",
    `- Run-time git commit: \`${options.runtimeCommit}\``,
    `- Working tree status: \`${options.dirtyTree.status}\``,
    ...(options.dirtyTree.files.length > 0 ? options.dirtyTree.files.map((file) => `- ${file}`) : ["- none"]),
    "",
    "## Command",
    "",
    `\`${process.argv.join(" ")}\``,
    "",
    "## Stop Line",
    "",
    "Stop here. Gate 58C is a forced-28 directional arbitration lock test only. Do not proceed to regimes, risk overlays, execution work, MT5/live, app work, or cleanup.",
    "",
    `Runtime seconds: ${options.runtimeSeconds}`,
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  const startedAt = Date.now();
  const cli = parseCli();
  const runtimeCommit = currentGitCommit();
  const dirtyTree = dirtyTreeStatus();
  const matrixRowsPath = path.resolve(process.cwd(), cli.matrixRowsPath);
  const artifactDir = path.resolve(process.cwd(), cli.artifactDir);
  const reportPath = path.resolve(process.cwd(), cli.reportPath);
  await Promise.all([mkdir(artifactDir, { recursive: true }), mkdir(path.dirname(reportPath), { recursive: true })]);

  const matrixRowsText = await readFile(matrixRowsPath, "utf8");
  const matrixRows = parseJsonlRows(matrixRowsText);
  const matrixRowsHash = sha256Text(matrixRowsText);
  const validation = validateMatrix(matrixRows, cli);
  const { outcomes, validation: warehouseValidation } = await loadWarehouseOutcomes(cli, matrixRows);
  const combinedValidation = { ...validation, warehouse: warehouseValidation };
  const blocked =
    validation.row_count !== EXPECTED_ROWS ||
    validation.week_count !== EXPECTED_WEEKS ||
    validation.rows_per_week.full_weeks_count !== EXPECTED_WEEKS ||
    validation.duplicate_week_symbol_rows !== 0 ||
    validation.missing_cot_state_rows !== 0 ||
    validation.missing_strength_state_rows !== 0 ||
    validation.missing_long_outcomes !== 0 ||
    validation.missing_short_outcomes !== 0 ||
    validation.price_bundle_mismatch_rows !== 0 ||
    validation.warehouse_mismatch_rows !== 0 ||
    warehouseValidation.missing_directional_outcomes !== 0;

  const cotBaselineRows = scoreProjection(matrixRows, outcomes, "cot_side");
  const strengthBaselineRows = scoreProjection(matrixRows, outcomes, "gate57e_strength_side");
  const candidatesBase = buildCandidates();
  const signatures = new Map<string, CandidateId>();
  const duplicateByCandidate = new Map<CandidateId, CandidateId | null>();
  for (const candidate of candidatesBase) {
    const scored = scoreByFinalSide(matrixRows, outcomes, (row) => candidate.finalSide(row));
    const signature = scoreSignature(scored);
    duplicateByCandidate.set(candidate.id, signatures.get(signature) ?? null);
    if (!signatures.has(signature)) signatures.set(signature, candidate.id);
  }
  const candidates = candidatesBase.map((candidate) =>
    summarizeCandidate(
      candidate,
      matrixRows,
      outcomes,
      cotBaselineRows,
      strengthBaselineRows,
      duplicateByCandidate.get(candidate.id) ?? null,
    ),
  );
  const forensicDecomposition = buildForensicDecomposition(matrixRows, outcomes);
  const screen = promotionScreen(
    candidates,
    candidates.find((candidate) => candidate.id === "A_COT_ONLY_INTERSECTION") ?? candidates[0],
    candidates.find((candidate) => candidate.id === "B_STRENGTH_57E_ONLY_INTERSECTION") ?? candidates[1],
  );
  const decision = blocked
    ? {
        verdict: "BLOCKED_EVIDENCE_GAP" as const,
        summary:
          "Gate 58C evidence validation failed before promotion screening. Do not interpret candidate metrics until the evidence gap is repaired.",
      }
    : decisionRead(screen);
  const gate58References = await maybeReadGate58Reference(path.resolve(process.cwd(), cli.gate58ResultPath));

  const decisionRowsPath = path.join(artifactDir, "gate58c-forced28-directional-arbitration.decisions.jsonl");
  const summaryPath = path.join(artifactDir, "gate58c-forced28-directional-arbitration.summary.json");
  const receiptPath = path.join(artifactDir, "gate58c-forced28-directional-arbitration.receipt.json");
  const hashPath = path.join(artifactDir, "gate58c-forced28-directional-arbitration.hash.json");
  const shaPath = path.join(artifactDir, "gate58c-forced28-directional-arbitration.sha256.txt");

  const decisionRowsLines: string[] = [];
  for (const candidate of candidatesBase) {
    const duplicateOf = duplicateByCandidate.get(candidate.id) ?? null;
    for (const row of matrixRows) {
      const selected = candidate.finalSide(row);
      const outcome = sideOutcome(row, selected.side, outcomes);
      decisionRowsLines.push(
        JSON.stringify({
          candidate_id: candidate.id,
          duplicate_of: duplicateOf,
          week_open_utc: row.week_open_utc,
          year: row.year,
          quarter: row.quarter,
          symbol: row.symbol,
          final_side: selected.side,
          side_source: selected.source,
          rule_reason: selected.reason,
          cot_side: row.cot_side,
          strength_parent_side: row.strength_parent_side,
          gate57e_side: row.gate57e_side,
          cot_vs_gate57e: row.cot_vs_gate57e,
          strength_lifecycle_bucket: row.strength_lifecycle_bucket,
          strength_phase_bucket: row.strength_phase_bucket,
          adr_grid_adr: outcome?.adr_grid_adr ?? null,
          weekly_hold_adr: outcome?.weekly_hold_adr ?? null,
          price_bundle_id: row.price_bundle_id,
          warehouse_id: row.warehouse_id,
        }),
      );
    }
  }
  const decisionRowsText = `${decisionRowsLines.join("\n")}\n`;
  const decisionRowsHash = sha256Text(decisionRowsText);
  const alphaGovernance = alphaV1Governance();
  const summaryPayload = {
    gate_id: GATE58C_ID,
    status: decision.verdict,
    generated_at_utc: new Date().toISOString(),
    runtime_commit: runtimeCommit,
    dirty_tree: dirtyTree,
    matrix_rows_path: toRepoRelative(matrixRowsPath),
    matrix_rows_sha256: matrixRowsHash,
    price_bundle_id: cli.priceBundleId,
    warehouse_id: cli.warehouseId,
    validation: combinedValidation,
    cot_full_388_week_reference_separate: gate58References,
    candidates,
    forensic_decomposition: forensicDecomposition,
    promotion_screen: screen,
    decision_read: decision,
    alpha_v1_governance: alphaGovernance,
  };
  const summaryText = `${JSON.stringify(summaryPayload, null, 2)}\n`;
  const summaryHash = sha256Text(summaryText);
  const receiptPayload = {
    gate_id: GATE58C_ID,
    status: decision.verdict,
    generated_at_utc: new Date().toISOString(),
    runtime_commit: runtimeCommit,
    matrix_rows_sha256: matrixRowsHash,
    summary_json_sha256: summaryHash,
    decision_rows_jsonl_sha256: decisionRowsHash,
    validation: combinedValidation,
    candidate_metric_summary: candidates.map(compactCandidateForReport),
    promotion_screen: screen,
    decision_read: decision,
    alpha_v1_governance: alphaGovernance,
    command: "npm run engine:gate58c:forced28-directional-arbitration",
    stop_line:
      "Stop here. Gate 58C is a forced-28 directional arbitration lock test only; no regimes, risk, execution, MT5/live, app work, or cleanup.",
  };
  const receiptText = `${JSON.stringify(receiptPayload, null, 2)}\n`;
  const receiptHash = sha256Text(receiptText);
  const hashPayload = {
    gate_id: GATE58C_ID,
    matrix_rows_sha256: matrixRowsHash,
    decision_rows_jsonl_sha256: decisionRowsHash,
    summary_json_sha256: summaryHash,
    receipt_json_sha256: receiptHash,
    combined_hash: sha256Stable({
      matrix_rows_sha256: matrixRowsHash,
      decision_rows_jsonl_sha256: decisionRowsHash,
      summary_json_sha256: summaryHash,
      receipt_json_sha256: receiptHash,
    }),
  };
  const hashText = `${JSON.stringify(hashPayload, null, 2)}\n`;
  const combinedHash = hashPayload.combined_hash;
  const runtimeSeconds = round((Date.now() - startedAt) / 1000, 1) ?? 0;
  const reportWithoutHash = renderReport({
    generatedAtUtc: new Date().toISOString(),
    runtimeCommit,
    dirtyTree,
    cli,
    validation: combinedValidation,
    gate58References,
    candidates,
    promotionScreen: screen,
    decision,
    alphaGovernance,
    summaryPath: toRepoRelative(summaryPath),
    decisionRowsPath: toRepoRelative(decisionRowsPath),
    receiptPath: toRepoRelative(receiptPath),
    hashPath: toRepoRelative(hashPath),
    shaPath: toRepoRelative(shaPath),
    summaryHash,
    decisionRowsHash,
    receiptHash,
    combinedHash,
    runtimeSeconds,
  });
  const reportHash = sha256Text(reportWithoutHash);
  const reportText = `${reportWithoutHash}Report hash: \`${reportHash}\`\n`;
  const shaText = [
    "# Gate 58C Forced-28 COT x Strength Directional Arbitration identity",
    "",
    `${matrixRowsHash}  ${toRepoRelative(matrixRowsPath)}`,
    `${decisionRowsHash}  ${toRepoRelative(decisionRowsPath)}`,
    `${summaryHash}  ${toRepoRelative(summaryPath)}`,
    `${receiptHash}  ${toRepoRelative(receiptPath)}`,
    `${reportHash}  ${toRepoRelative(reportPath)}.report-text`,
    "",
    `combined_hash ${combinedHash}`,
    "rebuild_command npm run engine:gate58c:forced28-directional-arbitration",
    "",
  ].join("\n");

  await Promise.all([
    writeFile(decisionRowsPath, decisionRowsText, "utf8"),
    writeFile(summaryPath, summaryText, "utf8"),
    writeFile(receiptPath, receiptText, "utf8"),
    writeFile(hashPath, hashText, "utf8"),
    writeFile(shaPath, shaText, "utf8"),
    writeFile(reportPath, reportText, "utf8"),
  ]);

  console.log(`Gate 58C rows: ${matrixRows.length}`);
  console.log(`Warehouse rows read: ${warehouseValidation.warehouse_rows_read}`);
  console.log(`Missing warehouse directional outcomes: ${warehouseValidation.missing_directional_outcomes}`);
  console.log(`Verdict: ${decision.verdict}`);
  console.log(`Summary JSON: ${toRepoRelative(summaryPath)}`);
  console.log(`Summary SHA-256: ${summaryHash}`);
  console.log(`Decision JSONL: ${toRepoRelative(decisionRowsPath)}`);
  console.log(`Decision JSONL SHA-256: ${decisionRowsHash}`);
  console.log(`Report: ${toRepoRelative(reportPath)}`);
  console.log(`Report hash: ${reportHash}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // Pool may not have been created.
    }
    if (process.exitCode && process.exitCode !== 0) {
      process.exit(process.exitCode);
    }
  });
