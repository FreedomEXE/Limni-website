import { execFileSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { getPool, query } from "@database/db/client";
import { sha256Stable, sha256Text } from "@engine/research/hash";

const GATE58B_ID = "Gate 58B: cot-strength-directional-hypothesis-confirmation";
const DEFAULT_MATRIX_ROWS_PATH =
  "docs/research/gates/gate58/artifacts/gate58-cot-strength-forensic-matrix/gate58-cot-strength-forensic-matrix.rows.jsonl";
const DEFAULT_GATE58_RESULT_PATH =
  "docs/research/gates/gate58/artifacts/gate58-cot-strength-forensic-matrix/gate58-cot-strength-forensic-matrix.result.json";
const DEFAULT_WAREHOUSE_ID = "gate57a0b_pair_week_path_outcomes_47B8F40AFB3B";
const DEFAULT_PRICE_BUNDLE_ID = "gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate58b/artifacts/gate58b-cot-strength-hypothesis-confirmation";
const DEFAULT_RECEIPT_PATH =
  "docs/research/gates/gate58b/GATE58B_COT_STRENGTH_DIRECTIONAL_HYPOTHESIS_CONFIRMATION_2026-06-27.md";

type Side = "LONG" | "SHORT";
type SideSource = "cot_side" | "gate57e_side";

type CliOptions = {
  matrixRowsPath: string;
  gate58ResultPath: string;
  warehouseId: string;
  priceBundleId: string;
  artifactDir: string;
  receiptPath: string;
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
  cot_side: Side | null;
  strength_lifecycle_bucket: string | null;
  strength_phase_bucket: string | null;
  gate57e_side: Side | null;
  gate57e_action_label: "selected" | "fade" | null;
  adr_grid_long_adr: number | null;
  adr_grid_short_adr: number | null;
  weekly_hold_long_adr: number | null;
  weekly_hold_short_adr: number | null;
  cot_side_adr_grid_outcome: number | null;
  cot_side_weekly_hold_outcome: number | null;
  gate57e_side_adr_grid_outcome: number | null;
  gate57e_side_weekly_hold_outcome: number | null;
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

type Hypothesis = {
  id: string;
  label: string;
  family: "directional_candidate" | "eligibility_reference" | "diagnostic_reference";
  sideSources: SideSource[];
  retained: (row: MatrixRow) => boolean;
  removedReason: (row: MatrixRow) => string;
};

type ScoredRow = {
  row: MatrixRow;
  selectedSide: Side | null;
  outcome: WarehouseOutcome | null;
  adrGridAdr: number | null;
  weeklyHoldAdr: number | null;
};

function parseCli(): CliOptions {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Build ${GATE58B_ID}.

Common:
  --matrix-rows-path=<path>   Default: ${DEFAULT_MATRIX_ROWS_PATH}
  --gate58-result-path=<path> Default: ${DEFAULT_GATE58_RESULT_PATH}
  --warehouse-id=<id>         Default: ${DEFAULT_WAREHOUSE_ID}
  --price-bundle-id=<id>      Default: ${DEFAULT_PRICE_BUNDLE_ID}
  --artifact-dir=<path>       Default: ${DEFAULT_ARTIFACT_DIR}
  --receipt-path=<path>       Default: ${DEFAULT_RECEIPT_PATH}

This command consumes the frozen Gate 58 matrix and existing warehouse outcome
rows only. It tests a small predeclared hypothesis set and does not run raw M1
simulation, change COT/Strength logic, add thresholds, run regimes, or promote
an uncaveated final combined system.`);
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
    receiptPath: argValue("receipt-path") ?? DEFAULT_RECEIPT_PATH,
  };
}

function currentGitCommit() {
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

function dirtyTreeStatus() {
  const status = execFileSync("git", ["status", "--short", "--untracked-files=all"], { encoding: "utf8" })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return { status: status.length > 0 ? "dirty" : "clean", files: status };
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

function rowsPerWeekDistribution(rows: MatrixRow[]) {
  const counts = countBy(rows, (row) => row.week_open_utc);
  const values = Object.values(counts);
  return {
    weeks: values.length,
    min_rows_per_week: values.length > 0 ? Math.min(...values) : 0,
    max_rows_per_week: values.length > 0 ? Math.max(...values) : 0,
    mean_rows_per_week: mean(values),
    histogram: countBy(values, (value) => String(value)),
  };
}

function currencyDistribution(rows: MatrixRow[]) {
  const base: Record<string, number> = {};
  const quote: Record<string, number> = {};
  const involvement: Record<string, number> = {};
  for (const row of rows) {
    if (row.base_currency) {
      base[row.base_currency] = (base[row.base_currency] ?? 0) + 1;
      involvement[row.base_currency] = (involvement[row.base_currency] ?? 0) + 1;
    }
    if (row.quote_currency) {
      quote[row.quote_currency] = (quote[row.quote_currency] ?? 0) + 1;
      involvement[row.quote_currency] = (involvement[row.quote_currency] ?? 0) + 1;
    }
  }
  const sort = (record: Record<string, number>) =>
    Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
  return { base: sort(base), quote: sort(quote), involvement: sort(involvement) };
}

function duplicateProof(rows: MatrixRow[]) {
  const counts = countBy(rows, (row) => `${row.week_open_utc}|${row.symbol}`);
  const duplicates = Object.entries(counts)
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }));
  return { duplicate_week_symbol_rows: duplicates.length, duplicates };
}

function strengthState(row: MatrixRow) {
  return `${row.strength_lifecycle_bucket ?? "missing"}:${row.strength_phase_bucket ?? "missing"}`;
}

function isInitialState(row: MatrixRow) {
  return row.strength_phase_bucket === "initial";
}

function isWeakOrFragileState(row: MatrixRow) {
  if (isInitialState(row)) return true;
  if (row.strength_lifecycle_bucket === "extreme" && row.strength_phase_bucket === "persistent") return true;
  if (row.strength_lifecycle_bucket === "extreme" && row.strength_phase_bucket === "flip") return true;
  if (row.strength_lifecycle_bucket === "middle" && row.strength_phase_bucket === "flip") return true;
  return false;
}

function isConstructiveState(row: MatrixRow) {
  if (row.strength_lifecycle_bucket === "compressed" && row.strength_phase_bucket === "persistent") return true;
  if (row.strength_lifecycle_bucket === "compressed" && row.strength_phase_bucket === "flip") return true;
  if (row.strength_lifecycle_bucket === "middle" && row.strength_phase_bucket === "persistent") return true;
  return false;
}

function weakStateReason(row: MatrixRow) {
  if (isInitialState(row)) return "initial_bucket_non_promotable";
  if (row.strength_lifecycle_bucket === "extreme" && row.strength_phase_bucket === "persistent") return "weak_extreme_persistent";
  if (row.strength_lifecycle_bucket === "extreme" && row.strength_phase_bucket === "flip") return "fragile_extreme_flip";
  if (row.strength_lifecycle_bucket === "middle" && row.strength_phase_bucket === "flip") return "weak_middle_flip";
  return `retained_or_other_${strengthState(row)}`;
}

function sideFor(row: MatrixRow, source: SideSource) {
  return source === "cot_side" ? row.cot_side : row.gate57e_side;
}

function scoreRows(rows: MatrixRow[], sideSource: SideSource, outcomes: Map<string, WarehouseOutcome>): ScoredRow[] {
  return rows.map((row) => {
    const selectedSide = sideFor(row, sideSource);
    const outcome = selectedSide ? outcomes.get(outcomeKey(row.week_open_utc, row.symbol, selectedSide)) ?? null : null;
    return {
      row,
      selectedSide,
      outcome,
      adrGridAdr: outcome?.adr_grid_adr ?? null,
      weeklyHoldAdr: outcome?.weekly_hold_adr ?? null,
    };
  });
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

function metricsByField(rows: ScoredRow[], field: "year" | "quarter") {
  const groups = new Map<string, ScoredRow[]>();
  for (const row of rows) {
    const key = String(row.row[field]);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, groupRows]) => ({ [field]: key, ...compactMetric(groupRows) }));
}

function leaveOneYearOut(rows: ScoredRow[]) {
  const years = uniqueSorted(rows.map((row) => String(row.row.year)));
  return years.map((year) => {
    const kept = rows.filter((row) => String(row.row.year) !== year);
    return { excluded_year: year, excluded_rows: rows.length - kept.length, ...compactMetric(kept) };
  });
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

function metricDelta(left: ReturnType<typeof compactMetric>, right: ReturnType<typeof compactMetric>) {
  const adrLeft = left.adr_grid.adr_sum;
  const adrRight = right.adr_grid.adr_sum;
  const holdLeft = left.weekly_hold.adr_sum;
  const holdRight = right.weekly_hold.adr_sum;
  return {
    rows_delta: left.rows - right.rows,
    adr_grid_adr_sum_delta: adrLeft !== null && adrRight !== null ? round(adrLeft - adrRight, 6) : null,
    adr_grid_max_drawdown_delta: round(left.adr_grid.max_drawdown - right.adr_grid.max_drawdown, 6),
    adr_grid_r_over_drawdown_delta:
      left.adr_grid.r_over_drawdown !== null && right.adr_grid.r_over_drawdown !== null
        ? round(left.adr_grid.r_over_drawdown - right.adr_grid.r_over_drawdown, 6)
        : null,
    adr_grid_pf_delta:
      left.adr_grid.row_pf !== null && right.adr_grid.row_pf !== null ? round(left.adr_grid.row_pf - right.adr_grid.row_pf, 6) : null,
    weekly_hold_adr_sum_delta: holdLeft !== null && holdRight !== null ? round(holdLeft - holdRight, 6) : null,
  };
}

function fullMetrics(rows: MatrixRow[], sideSource: SideSource, outcomes: Map<string, WarehouseOutcome>) {
  const scored = scoreRows(rows, sideSource, outcomes);
  return {
    ...compactMetric(scored),
    year_by_year: metricsByField(scored, "year"),
    quarter_by_quarter: metricsByField(scored, "quarter"),
    leave_one_year_out: leaveOneYearOut(scored),
    outlier_week_contribution: outlierContribution(scored),
  };
}

function validateMatrix(rows: MatrixRow[], cli: CliOptions) {
  const weeks = uniqueSorted(rows.map((row) => row.week_open_utc));
  const rowsByWeek = rowsPerWeekDistribution(rows);
  const duplicates = duplicateProof(rows);
  return {
    row_count: rows.length,
    expected_row_count: 10444,
    week_count: weeks.length,
    expected_week_count: 373,
    rows_per_week: rowsByWeek,
    duplicate_week_symbol_rows: duplicates.duplicate_week_symbol_rows,
    missing_cot_state_rows: rows.filter((row) => row.missing_cot_state || !row.cot_side).length,
    missing_strength_state_rows: rows.filter((row) => row.missing_strength_state || !row.gate57e_side).length,
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

function buildHypotheses(): Hypothesis[] {
  return [
    {
      id: "A_cot_side_strength_weak_state_veto",
      label: "A. COT side with Strength weak-state veto",
      family: "directional_candidate",
      sideSources: ["cot_side"],
      retained: (row) => !isWeakOrFragileState(row),
      removedReason: weakStateReason,
    },
    {
      id: "B_gate57e_strength_side_weak_state_veto",
      label: "B. Gate 57E Strength side with weak-state veto",
      family: "directional_candidate",
      sideSources: ["gate57e_side"],
      retained: (row) => !isWeakOrFragileState(row),
      removedReason: weakStateReason,
    },
    {
      id: "C_constructive_state_eligibility_dual_side",
      label: "C. Constructive-state eligibility layer with COT and Strength side readouts",
      family: "eligibility_reference",
      sideSources: ["cot_side", "gate57e_side"],
      retained: isConstructiveState,
      removedReason: (row) => (isConstructiveState(row) ? "retained_constructive" : weakStateReason(row)),
    },
    {
      id: "D1_agreement_only_reference",
      label: "D1. COT/Gate57E agreement-only reference",
      family: "diagnostic_reference",
      sideSources: ["cot_side"],
      retained: (row) => row.cot_vs_gate57e === "agree",
      removedReason: (row) => `not_agreement_${row.cot_vs_gate57e}`,
    },
    {
      id: "D2_disagreement_only_dual_side_reference",
      label: "D2. COT/Gate57E disagreement-only dual-side reference",
      family: "diagnostic_reference",
      sideSources: ["cot_side", "gate57e_side"],
      retained: (row) => row.cot_vs_gate57e === "disagree",
      removedReason: (row) => `not_disagreement_${row.cot_vs_gate57e}`,
    },
  ];
}

function summarizeHypothesis(
  hypothesis: Hypothesis,
  rows: MatrixRow[],
  outcomes: Map<string, WarehouseOutcome>,
  baselines: Record<string, ReturnType<typeof compactMetric>>,
) {
  const retainedRows = rows.filter(hypothesis.retained);
  const removedRows = rows.filter((row) => !hypothesis.retained(row));
  const sideSourceMetrics: Record<string, unknown> = {};
  for (const sideSource of hypothesis.sideSources) {
    const retainedScored = scoreRows(retainedRows, sideSource, outcomes);
    const removedScored = scoreRows(removedRows, sideSource, outcomes);
    const retained = fullMetrics(retainedRows, sideSource, outcomes);
    const removed = compactMetric(removedScored);
    sideSourceMetrics[sideSource] = {
      retained,
      removed,
      retained_vs_removed_delta: metricDelta(compactMetric(retainedScored), removed),
      comparison_vs_cot_intersection: metricDelta(compactMetric(retainedScored), baselines.cot_intersection),
      comparison_vs_strength_intersection: metricDelta(compactMetric(retainedScored), baselines.strength_gate57e_intersection),
    };
  }
  return {
    id: hypothesis.id,
    label: hypothesis.label,
    family: hypothesis.family,
    retained_rows: retainedRows.length,
    removed_rows: removedRows.length,
    retained_weeks: new Set(retainedRows.map((row) => row.week_open_utc)).size,
    rows_per_week_distribution: rowsPerWeekDistribution(retainedRows),
    pair_distribution: countBy(retainedRows, (row) => row.symbol),
    currency_distribution: currencyDistribution(retainedRows),
    strength_state_distribution: countBy(retainedRows, strengthState),
    removed_reason_distribution: countBy(removedRows, hypothesis.removedReason),
    duplicate_proof: duplicateProof(retainedRows),
    missing_outcome_proof: {
      missing_long_outcomes: retainedRows.filter((row) => row.missing_long_outcome).length,
      missing_short_outcomes: retainedRows.filter((row) => row.missing_short_outcome).length,
      missing_selected_outcome_rows_by_side_source: Object.fromEntries(
        hypothesis.sideSources.map((source) => [
          source,
          scoreRows(retainedRows, source, outcomes).filter((row) => row.selectedSide && !row.outcome).length,
        ]),
      ),
    },
    side_source_metrics: sideSourceMetrics,
  };
}

function candidateScreen(hypotheses: ReturnType<typeof summarizeHypothesis>[], baselines: Record<string, ReturnType<typeof compactMetric>>) {
  const candidates: Array<Record<string, unknown>> = [];
  for (const hypothesis of hypotheses.filter((entry) => entry.family === "directional_candidate")) {
    const metricsBySource = hypothesis.side_source_metrics as Record<string, { retained: ReturnType<typeof fullMetrics> }>;
    for (const [sideSource, metrics] of Object.entries(metricsBySource)) {
      const retained = metrics.retained;
      const cot = baselines.cot_intersection;
      const strength = baselines.strength_gate57e_intersection;
      const adr = retained.adr_grid.adr_sum ?? Number.NEGATIVE_INFINITY;
      const cotAdr = cot.adr_grid.adr_sum ?? Number.NEGATIVE_INFINITY;
      const strengthAdr = strength.adr_grid.adr_sum ?? Number.NEGATIVE_INFINITY;
      const beatsAdr = adr > cotAdr && adr > strengthAdr;
      const preservesDd = retained.adr_grid.max_drawdown >= cot.adr_grid.max_drawdown && retained.adr_grid.max_drawdown >= strength.adr_grid.max_drawdown;
      const preservesRdd =
        retained.adr_grid.r_over_drawdown !== null &&
        cot.adr_grid.r_over_drawdown !== null &&
        strength.adr_grid.r_over_drawdown !== null &&
        retained.adr_grid.r_over_drawdown >= cot.adr_grid.r_over_drawdown &&
        retained.adr_grid.r_over_drawdown >= strength.adr_grid.r_over_drawdown;
      const preservesPf =
        retained.adr_grid.row_pf !== null &&
        cot.adr_grid.row_pf !== null &&
        strength.adr_grid.row_pf !== null &&
        retained.adr_grid.row_pf >= cot.adr_grid.row_pf &&
        retained.adr_grid.row_pf >= strength.adr_grid.row_pf;
      const negativeYears = retained.year_by_year.filter((year) => year.adr_grid.adr_sum !== null && year.adr_grid.adr_sum < 0).length;
      const outlierShare = retained.outlier_week_contribution.top5_abs_week_share;
      candidates.push({
        hypothesis_id: hypothesis.id,
        side_source: sideSource,
        retained_rows: hypothesis.retained_rows,
        beats_both_adr_grid_adr: beatsAdr,
        preserves_or_improves_dd: preservesDd,
        preserves_or_improves_rdd: preservesRdd,
        preserves_or_improves_pf: preservesPf,
        negative_year_count: negativeYears,
        top5_abs_week_share: outlierShare,
        lock_candidate:
          beatsAdr === true &&
          preservesDd === true &&
          preservesRdd === true &&
          preservesPf === true &&
          negativeYears <= 1 &&
          (outlierShare === null || outlierShare < 0.35),
      });
    }
  }
  return candidates;
}

function decisionRead(screen: Array<Record<string, unknown>>) {
  const lockCandidate = screen.find((entry) => entry.lock_candidate === true);
  if (lockCandidate) {
    return {
      verdict: "PASS_COMBINED_DIRECTIONAL_LOCK_CANDIDATE_REQUIRES_REVIEW",
      summary:
        "At least one predeclared hypothesis beat both 373-week baselines on ADR Grid while preserving DD/R-DD/PF and passing the stability/outlier screen. Treat as a lock candidate requiring human review, not as an automatic final system promotion.",
      lock_candidate: lockCandidate,
    };
  }
  const aggregateAlive = screen.find(
    (entry) =>
      entry.beats_both_adr_grid_adr === true &&
      entry.preserves_or_improves_dd === true &&
      entry.preserves_or_improves_rdd === true &&
      entry.preserves_or_improves_pf === true,
  );
  if (aggregateAlive) {
    return {
      verdict: "PASS_WITH_CAVEATS_STRENGTH_VETO_ALIVE_NO_LOCK_YEAR_STABILITY_CAVEAT",
      summary:
        "A predeclared hypothesis improves aggregate ADR Grid ADR, DD, R-DD, and PF versus both 373-week baselines, but the year-stability screen is not clean. Treat it as an alive combined-directional candidate, not a lock.",
      lock_candidate: null,
      best_alive_candidate: aggregateAlive,
    };
  }
  return {
    verdict: "PASS_NO_COMBINED_DIRECTIONAL_LOCK_CONFIRMED",
    summary:
      "No predeclared hypothesis clearly improves both 373-week baselines while preserving the required quality metrics. Keep COT and Strength as separate baselines for now.",
    lock_candidate: null,
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

function renderReceipt(options: {
  generatedAtUtc: string;
  runtimeCommit: string;
  dirtyTree: ReturnType<typeof dirtyTreeStatus>;
  cli: CliOptions;
  validation: Record<string, unknown>;
  referenceSummaries: Record<string, unknown> | null;
  baselines: Record<string, unknown>;
  hypotheses: unknown[];
  candidateScreen: unknown[];
  decisionRead: unknown;
  resultPath: string;
  resultHash: string;
  hashPath: string;
  shaPath: string;
  combinedHash: string;
  runtimeSeconds: number;
}) {
  const lines = [
    "# Gate 58B COT x Strength Directional Hypothesis Confirmation",
    "",
    `Generated: ${options.generatedAtUtc}`,
    "",
    "## Verdict",
    "",
    `${(options.decisionRead as { verdict?: string }).verdict ?? "PENDING_REVIEW_DIRECTIONAL_CONFIRMATION_EVIDENCE_BUILT_NO_REGIMES_NO_RISK"}.`,
    "",
    "Gate 58B tests only the small predeclared hypothesis set from the accepted Gate 58 forensic matrix. It does not run a new exploratory scan, optimize thresholds, add regimes, or promote an uncaveated final combined system.",
    "",
    "## Boundary",
    "",
    `- Matrix input: \`${options.cli.matrixRowsPath}\``,
    `- Warehouse ID: \`${options.cli.warehouseId}\``,
    `- Price bundle: \`${options.cli.priceBundleId}\``,
    "- COT baseline: `CLP carry-forward + carry-previous tie fill`",
    "- Strength baseline: `phase_conditioned_remainder`",
    "- Window: 373-week COT x Strength intersection only",
    "- Outcome source: Gate 58 matrix plus existing warehouse outcome rows for ADR component counts",
    "- Not run: raw M1 ADR Grid simulation, COT source changes, Strength source/window changes, new buckets/windows/deciles/thresholds, regimes, risk overlays, MT5/live/app work, new evaluator/backtest engine.",
    "",
    "## Artifacts",
    "",
    `- Result JSON: \`${options.resultPath}\``,
    `- Result SHA-256: \`${options.resultHash}\``,
    `- Hash JSON: \`${options.hashPath}\``,
    `- Tracked SHA-256 identity file: \`${options.shaPath}\``,
    `- Combined artifact hash: \`${options.combinedHash}\``,
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(options.validation, null, 2),
    "```",
    "",
    "## Gate 58 References",
    "",
    "```json",
    JSON.stringify(options.referenceSummaries, null, 2),
    "```",
    "",
    "## Baselines",
    "",
    "```json",
    JSON.stringify(options.baselines, null, 2),
    "```",
    "",
    "## Hypotheses",
    "",
    "```json",
    JSON.stringify(options.hypotheses, null, 2),
    "```",
    "",
    "## Candidate Screen",
    "",
    "```json",
    JSON.stringify(options.candidateScreen, null, 2),
    "```",
    "",
    "## Decision Read",
    "",
    "```json",
    JSON.stringify(options.decisionRead, null, 2),
    "```",
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
    "Stop here. Gate 58B is a confirmation gate only. Do not start regimes, risk overlays, execution work, MT5/live, app work, or final combined-system selection in this run.",
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
  const receiptPath = path.resolve(process.cwd(), cli.receiptPath);
  await Promise.all([mkdir(artifactDir, { recursive: true }), mkdir(path.dirname(receiptPath), { recursive: true })]);

  const matrixRowsText = await readFile(matrixRowsPath, "utf8");
  const matrixRows = parseJsonlRows(matrixRowsText);
  const matrixHash = sha256Text(matrixRowsText);
  const validation = validateMatrix(matrixRows, cli);
  const { outcomes, validation: warehouseValidation } = await loadWarehouseOutcomes(cli, matrixRows);
  const cotBaseline = compactMetric(scoreRows(matrixRows, "cot_side", outcomes));
  const strengthBaseline = compactMetric(scoreRows(matrixRows, "gate57e_side", outcomes));
  const baselines = {
    cot_intersection: cotBaseline,
    strength_gate57e_intersection: strengthBaseline,
  };
  const hypotheses = buildHypotheses().map((hypothesis) => summarizeHypothesis(hypothesis, matrixRows, outcomes, baselines));
  const screen = candidateScreen(hypotheses, baselines);
  const decision = decisionRead(screen);
  const referenceSummaries = await maybeReadGate58Reference(path.resolve(process.cwd(), cli.gate58ResultPath));
  const resultPath = path.join(artifactDir, "gate58b-cot-strength-hypothesis-confirmation.result.json");
  const hashPath = path.join(artifactDir, "gate58b-cot-strength-hypothesis-confirmation.hash.json");
  const shaPath = path.join(artifactDir, "gate58b-cot-strength-hypothesis-confirmation.sha256.txt");
  const resultPayload = {
    gate_id: GATE58B_ID,
    status: decision.verdict,
    generated_at_utc: new Date().toISOString(),
    runtime_commit: runtimeCommit,
    dirty_tree: dirtyTree,
    matrix_rows_path: toRepoRelative(matrixRowsPath),
    matrix_rows_sha256: matrixHash,
    price_bundle_id: cli.priceBundleId,
    warehouse_id: cli.warehouseId,
    validation: {
      ...validation,
      warehouse: warehouseValidation,
    },
    gate58_reference_summaries: referenceSummaries,
    baselines,
    hypotheses,
    candidate_screen: screen,
    decision_read: decision,
  };
  const resultText = `${JSON.stringify(resultPayload, null, 2)}\n`;
  const resultHash = sha256Text(resultText);
  const hashPayload = {
    gate_id: GATE58B_ID,
    matrix_rows_sha256: matrixHash,
    result_json_sha256: resultHash,
    combined_hash: sha256Stable({ matrix_rows_sha256: matrixHash, result_json_sha256: resultHash }),
  };
  const hashText = `${JSON.stringify(hashPayload, null, 2)}\n`;
  const combinedHash = hashPayload.combined_hash;
  const runtimeSeconds = round((Date.now() - startedAt) / 1000, 1) ?? 0;
  const receiptWithoutHash = renderReceipt({
    generatedAtUtc: new Date().toISOString(),
    runtimeCommit,
    dirtyTree,
    cli,
    validation: { ...validation, warehouse: warehouseValidation },
    referenceSummaries,
    baselines,
    hypotheses,
    candidateScreen: screen,
    decisionRead: decision,
    resultPath: toRepoRelative(resultPath),
    resultHash,
    hashPath: toRepoRelative(hashPath),
    shaPath: toRepoRelative(shaPath),
    combinedHash,
    runtimeSeconds,
  });
  const receiptHash = sha256Text(receiptWithoutHash);
  const receiptText = `${receiptWithoutHash}Receipt hash: \`${receiptHash}\`\n`;
  const shaText = [
    "# Gate 58B COT x Strength Directional Hypothesis Confirmation identity",
    "",
    `${matrixHash}  ${toRepoRelative(matrixRowsPath)}`,
    `${resultHash}  ${toRepoRelative(resultPath)}`,
    `${receiptHash}  ${toRepoRelative(receiptPath)}.receipt-text`,
    "",
    `combined_hash ${combinedHash}`,
    "rebuild_command npm run engine:gate58b:cot-strength-hypothesis-confirmation",
    "",
  ].join("\n");

  await Promise.all([
    writeFile(resultPath, resultText, "utf8"),
    writeFile(hashPath, hashText, "utf8"),
    writeFile(shaPath, shaText, "utf8"),
    writeFile(receiptPath, receiptText, "utf8"),
  ]);

  console.log(`Gate 58B rows: ${matrixRows.length}`);
  console.log(`Warehouse rows read: ${warehouseValidation.warehouse_rows_read}`);
  console.log(`Missing warehouse directional outcomes: ${warehouseValidation.missing_directional_outcomes}`);
  console.log(`Result JSON: ${toRepoRelative(resultPath)}`);
  console.log(`Result SHA-256: ${resultHash}`);
  console.log(`Hash JSON: ${toRepoRelative(hashPath)}`);
  console.log(`Receipt: ${toRepoRelative(receiptPath)}`);
  console.log(`Receipt hash: ${receiptHash}`);
  console.log(`Candidate screen: ${JSON.stringify(screen)}`);
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
