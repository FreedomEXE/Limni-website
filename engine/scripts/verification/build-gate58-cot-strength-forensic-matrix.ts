import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { getPool, query } from "@database/db/client";
import {
  buildGate54ClpCotRestatementManifest,
  GATE54_CLP_LOOKBACK_REPORTS,
  GATE55E_PRICE_BUNDLE_ID,
  GATE56F_SIGNAL_ID,
  validateGate54ClpManifestShape,
} from "@engine/signals/cot/gate54ClpManifest";
import {
  buildGate57BFridayRelativeStrength15wManifests,
  GATE57B_DEFAULT_FROM_WEEK,
  GATE57B_DEFAULT_TO_WEEK_EXCLUSIVE,
  GATE57B_LOOKBACK_WEEKS,
  GATE57E_FEATURE_BUNDLE_ID,
  GATE57E_GATE_ID,
  GATE57E_HYPOTHESIS_ID,
  type Gate57BFrs15ManifestSignalId,
} from "@engine/signals/strength/fridayRelativeStrength15wManifest";
import { assertPairWeekPathOutcomeWarehouseReady } from "@engine/research/pairWeekPathOutcomeWarehouse";
import { sha256Stable, sha256Text } from "@engine/research/hash";
import type { ResearchDecisionManifest, ResearchDecisionRow, ResearchDecisionSide } from "@engine/research/decisionManifest";

const GATE58_ID = "Gate 58: cot-strength-forensic-matrix";
const DEFAULT_WAREHOUSE_ID = "gate57a0b_pair_week_path_outcomes_47B8F40AFB3B";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate58/artifacts/gate58-cot-strength-forensic-matrix";
const DEFAULT_RECEIPT_PATH = "docs/research/gates/gate58/GATE58_COT_STRENGTH_FORENSIC_MATRIX_2026-06-27.md";
const FX_SYMBOLS_PER_WEEK = 28;

const GATE57E_SIGNAL_IDS: Gate57BFrs15ManifestSignalId[] = [
  "parent_selected",
  "binary_lifecycle_selected_else_extreme_fade",
  "compressed_selected_remainder_fade",
  "phase_conditioned_remainder",
  "phase_conditioned_all28",
];

type CliOptions = {
  warehouseId: string;
  artifactDir: string;
  receiptPath: string;
};

type WarehouseOutcomeRow = {
  symbol: string;
  week_open_utc: Date | string;
  direction: ResearchDecisionSide;
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

type MatrixRow = {
  week_open_utc: string;
  year: number;
  quarter: string;
  symbol: string;
  price_bundle_id: string;
  warehouse_id: string;
  cot_manifest_id: string;
  strength_parent_manifest_id: string;
  strength_gate57e_manifest_id: string;
  base_currency: string | null;
  quote_currency: string | null;
  cot_base_tei: number | null;
  cot_quote_tei: number | null;
  cot_tei_spread: number | null;
  cot_abs_tei_spread: number | null;
  cot_tei_spread_bucket: string;
  cot_side: ResearchDecisionSide | null;
  cot_tie_flag: boolean;
  cot_carry_forward_flag: boolean;
  cot_carry_previous_flag: boolean;
  cot_selected_report_date: string | null;
  cot_expected_report_date: string | null;
  cot_report_age_days: number | null;
  cot_lifecycle_state: string | null;
  cot_lifecycle_lookback_reports: number;
  strength_base_score: number | null;
  strength_quote_score: number | null;
  strength_score_spread: number | null;
  strength_abs_score_spread: number | null;
  strength_score_spread_bucket: string;
  strength_parent_side: ResearchDecisionSide | null;
  strength_lifecycle_bucket: string | null;
  strength_phase_bucket: string | null;
  gate57c_side: ResearchDecisionSide | null;
  gate57c_action_label: "selected" | "fade" | null;
  gate57d_side: ResearchDecisionSide | null;
  gate57d_action_label: "selected" | "fade" | null;
  gate57e_side: ResearchDecisionSide | null;
  gate57e_action_label: "selected" | "fade" | null;
  adr_grid_long_adr: number | null;
  adr_grid_short_adr: number | null;
  adr_grid_long_minus_short: number | null;
  weekly_hold_long_adr: number | null;
  weekly_hold_short_adr: number | null;
  weekly_hold_long_minus_short: number | null;
  cot_side_adr_grid_outcome: number | null;
  cot_side_weekly_hold_outcome: number | null;
  strength_parent_side_adr_grid_outcome: number | null;
  strength_parent_side_weekly_hold_outcome: number | null;
  gate57e_side_adr_grid_outcome: number | null;
  gate57e_side_weekly_hold_outcome: number | null;
  cot_vs_strength_parent: "agree" | "disagree" | "missing";
  cot_vs_gate57e: "agree" | "disagree" | "missing";
  missing_cot_state: boolean;
  missing_strength_state: boolean;
  missing_long_outcome: boolean;
  missing_short_outcome: boolean;
};

type GroupSummary = {
  group: Record<string, string>;
  rows: number;
  weeks: number;
  symbols: number;
  adr_grid_long_sum: number;
  adr_grid_short_sum: number;
  adr_grid_edge_sum: number;
  adr_grid_edge_mean: number | null;
  adr_grid_edge_median: number | null;
  weekly_hold_long_sum: number;
  weekly_hold_short_sum: number;
  weekly_hold_edge_sum: number;
  weekly_hold_edge_mean: number | null;
  weekly_hold_edge_median: number | null;
  cot_side_adr_grid_sum: number;
  strength_parent_side_adr_grid_sum: number;
  gate57e_side_adr_grid_sum: number;
  cot_side_weekly_hold_sum: number;
  strength_parent_side_weekly_hold_sum: number;
  gate57e_side_weekly_hold_sum: number;
  adr_grid_edge_row_pf: number | null;
  gate57e_adr_grid_row_pf: number | null;
  adr_grid_edge_max_drawdown: number;
  gate57e_adr_grid_max_drawdown: number;
  top5_abs_weekly_edge_share: number | null;
};

function argValue(name: string): string | null {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function helpText() {
  return `
Build the Gate 58 COT x Strength forensic matrix.

Common:
  --warehouse-id=<id>      Default: ${DEFAULT_WAREHOUSE_ID}
  --artifact-dir=<path>    Default: ${DEFAULT_ARTIFACT_DIR}
  --receipt-path=<path>    Default: ${DEFAULT_RECEIPT_PATH}

This command builds a frozen pair-week forensic panel from locked COT state,
locked FRS15 Strength state, and durable warehouse long/short outcomes. It does
not run raw M1 ADR Grid simulation, change COT or Strength logic, run regimes,
add risk overlays, or promote a final combined strategy.
`.trim();
}

function parseCli(): CliOptions {
  if (hasFlag("help") || hasFlag("h")) {
    console.log(helpText());
    process.exit(0);
  }
  return {
    warehouseId: argValue("warehouse-id") ?? DEFAULT_WAREHOUSE_ID,
    artifactDir: argValue("artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    receiptPath: argValue("receipt-path") ?? DEFAULT_RECEIPT_PATH,
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
    const status = execFileSync("git", ["status", "--short", "--untracked-files=all"], { encoding: "utf8" }).trim();
    return {
      status: status.length > 0 ? "dirty" : "clean",
      files: status ? status.split(/\r?\n/) : [],
    };
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

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function metricValue(row: ResearchDecisionRow, key: string) {
  return numberValue(row.signal_scores?.[key]);
}

function metaString(row: ResearchDecisionRow, key: string) {
  const value = row.source_metadata?.[key];
  return typeof value === "string" ? value : null;
}

function parseYear(weekOpenUtc: string) {
  return new Date(weekOpenUtc).getUTCFullYear();
}

function parseQuarter(weekOpenUtc: string) {
  const date = new Date(weekOpenUtc);
  const year = date.getUTCFullYear();
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${year}-Q${quarter}`;
}

function keyFor(weekOpenUtc: string, symbol: string) {
  return `${weekOpenUtc}|${symbol.toUpperCase()}`;
}

function outcomeKey(weekOpenUtc: string, symbol: string, direction: ResearchDecisionSide) {
  return `${weekOpenUtc}|${symbol.toUpperCase()}|${direction}`;
}

function sideAgreement(left: ResearchDecisionSide | null, right: ResearchDecisionSide | null) {
  if (!left || !right) return "missing" as const;
  return left === right ? "agree" as const : "disagree" as const;
}

function actionLabel(parent: ResearchDecisionSide | null, side: ResearchDecisionSide | null) {
  if (!parent || !side) return null;
  return parent === side ? "selected" as const : "fade" as const;
}

function sideOutcome(side: ResearchDecisionSide | null, long: WarehouseOutcome | null, short: WarehouseOutcome | null, metric: "adr_grid" | "weekly_hold") {
  const outcome = side === "LONG" ? long : side === "SHORT" ? short : null;
  if (!outcome) return null;
  return metric === "adr_grid" ? outcome.adr_grid_adr : outcome.weekly_hold_adr;
}

function manifestDecisionIndex(manifest: ResearchDecisionManifest) {
  return new Map(manifest.decisions.map((row) => [keyFor(row.week_open_utc, row.symbol), row]));
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort();
}

function quantile(sortedValues: number[], q: number) {
  if (sortedValues.length === 0) return null;
  const position = (sortedValues.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  const current = sortedValues[base]!;
  const next = sortedValues[base + 1];
  return next === undefined ? current : current + rest * (next - current);
}

function median(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  return round(quantile(sorted, 0.5), 6);
}

function makeQuantileBucketer(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  const q1 = quantile(sorted, 0.25);
  const q2 = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  return {
    thresholds: { q1: round(q1), q2: round(q2), q3: round(q3) },
    bucket(value: number | null | undefined) {
      if (value === null || value === undefined || !Number.isFinite(value) || q1 === null || q2 === null || q3 === null) {
        return "missing";
      }
      if (value <= q1) return "q1_low";
      if (value <= q2) return "q2_mid_low";
      if (value <= q3) return "q3_mid_high";
      return "q4_high";
    },
  };
}

function profitFactor(values: number[]) {
  const positives = values.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const negatives = values.filter((value) => value < 0).reduce((sum, value) => sum + value, 0);
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

function sum(values: Array<number | null | undefined>) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? Number(value) : 0), 0);
}

function mean(values: number[]) {
  return values.length > 0 ? round(sum(values) / values.length, 6) : null;
}

function groupRows(rows: MatrixRow[], fields: Array<keyof MatrixRow>) {
  const groups = new Map<string, MatrixRow[]>();
  for (const row of rows) {
    const group = Object.fromEntries(fields.map((field) => [String(field), String(row[field] ?? "missing")]));
    const key = JSON.stringify(group);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()]
    .map(([key, groupRowsForKey]) => ({ group: JSON.parse(key) as Record<string, string>, rows: groupRowsForKey }))
    .sort((left, right) => JSON.stringify(left.group).localeCompare(JSON.stringify(right.group)));
}

function summarizeGroup(group: Record<string, string>, rows: MatrixRow[]): GroupSummary {
  const edgeValues = rows.map((row) => row.adr_grid_long_minus_short).filter((value): value is number => Number.isFinite(value));
  const holdEdgeValues = rows.map((row) => row.weekly_hold_long_minus_short).filter((value): value is number => Number.isFinite(value));
  const gate57eValues = rows.map((row) => row.gate57e_side_adr_grid_outcome).filter((value): value is number => Number.isFinite(value));
  const edgeByWeek = new Map<string, number>();
  const gate57eByWeek = new Map<string, number>();
  for (const row of rows) {
    edgeByWeek.set(row.week_open_utc, (edgeByWeek.get(row.week_open_utc) ?? 0) + (row.adr_grid_long_minus_short ?? 0));
    gate57eByWeek.set(row.week_open_utc, (gate57eByWeek.get(row.week_open_utc) ?? 0) + (row.gate57e_side_adr_grid_outcome ?? 0));
  }
  const absWeeklyEdges = [...edgeByWeek.values()].map(Math.abs).sort((left, right) => right - left);
  const absTotal = absWeeklyEdges.reduce((total, value) => total + value, 0);
  return {
    group,
    rows: rows.length,
    weeks: new Set(rows.map((row) => row.week_open_utc)).size,
    symbols: new Set(rows.map((row) => row.symbol)).size,
    adr_grid_long_sum: round(sum(rows.map((row) => row.adr_grid_long_adr)), 6) ?? 0,
    adr_grid_short_sum: round(sum(rows.map((row) => row.adr_grid_short_adr)), 6) ?? 0,
    adr_grid_edge_sum: round(sum(edgeValues), 6) ?? 0,
    adr_grid_edge_mean: mean(edgeValues),
    adr_grid_edge_median: median(edgeValues),
    weekly_hold_long_sum: round(sum(rows.map((row) => row.weekly_hold_long_adr)), 6) ?? 0,
    weekly_hold_short_sum: round(sum(rows.map((row) => row.weekly_hold_short_adr)), 6) ?? 0,
    weekly_hold_edge_sum: round(sum(holdEdgeValues), 6) ?? 0,
    weekly_hold_edge_mean: mean(holdEdgeValues),
    weekly_hold_edge_median: median(holdEdgeValues),
    cot_side_adr_grid_sum: round(sum(rows.map((row) => row.cot_side_adr_grid_outcome)), 6) ?? 0,
    strength_parent_side_adr_grid_sum: round(sum(rows.map((row) => row.strength_parent_side_adr_grid_outcome)), 6) ?? 0,
    gate57e_side_adr_grid_sum: round(sum(rows.map((row) => row.gate57e_side_adr_grid_outcome)), 6) ?? 0,
    cot_side_weekly_hold_sum: round(sum(rows.map((row) => row.cot_side_weekly_hold_outcome)), 6) ?? 0,
    strength_parent_side_weekly_hold_sum: round(sum(rows.map((row) => row.strength_parent_side_weekly_hold_outcome)), 6) ?? 0,
    gate57e_side_weekly_hold_sum: round(sum(rows.map((row) => row.gate57e_side_weekly_hold_outcome)), 6) ?? 0,
    adr_grid_edge_row_pf: profitFactor(edgeValues),
    gate57e_adr_grid_row_pf: profitFactor(gate57eValues),
    adr_grid_edge_max_drawdown: maxDrawdown(edgeByWeek),
    gate57e_adr_grid_max_drawdown: maxDrawdown(gate57eByWeek),
    top5_abs_weekly_edge_share: absTotal > 0 ? round(absWeeklyEdges.slice(0, 5).reduce((total, value) => total + value, 0) / absTotal, 6) : null,
  };
}

function summarize(rows: MatrixRow[], fields: Array<keyof MatrixRow>) {
  return groupRows(rows, fields).map((entry) => summarizeGroup(entry.group, entry.rows));
}

function topBottom<T>(items: T[], selector: (item: T) => number | null | undefined, count = 8) {
  const scored = items
    .map((item) => ({ item, score: selector(item) }))
    .filter((entry): entry is { item: T; score: number } => Number.isFinite(entry.score));
  const desc = [...scored].sort((left, right) => right.score - left.score).slice(0, count).map((entry) => entry.item);
  const asc = [...scored].sort((left, right) => left.score - right.score).slice(0, count).map((entry) => entry.item);
  return { top: desc, bottom: asc };
}

async function readWarehouseOutcomes(warehouseId: string, weeks: string[], symbols: string[]) {
  const rows = await query<WarehouseOutcomeRow>(
    `SELECT symbol, week_open_utc, direction, adr_grid_adr, adr_grid_fills,
            adr_grid_tp, adr_grid_reset, adr_grid_week_close,
            adr_grid_missing_price_rows, adr_grid_default_adr_rows,
            weekly_hold_adr, weekly_hold_missing_price_rows,
            weekly_hold_default_adr_rows
       FROM research_pair_week_path_outcomes
      WHERE manifest_id = $1
        AND week_open_utc = ANY($2::timestamptz[])
        AND symbol = ANY($3::text[])
      ORDER BY week_open_utc ASC, symbol ASC, direction ASC`,
    [warehouseId, weeks, symbols],
  );
  const outcomes = new Map<string, WarehouseOutcome>();
  for (const row of rows) {
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
  return outcomes;
}

function buildReferenceSummary(options: {
  label: string;
  rows: ResearchDecisionRow[];
  outcomesByKey: Map<string, WarehouseOutcome>;
}) {
  const values = options.rows.map((row) => {
    const outcome = options.outcomesByKey.get(outcomeKey(row.week_open_utc, row.symbol, row.side));
    return {
      week: row.week_open_utc,
      adrGrid: outcome?.adr_grid_adr ?? null,
      weeklyHold: outcome?.weekly_hold_adr ?? null,
    };
  });
  const adrValues = values.map((row) => row.adrGrid).filter((value): value is number => Number.isFinite(value));
  const holdValues = values.map((row) => row.weeklyHold).filter((value): value is number => Number.isFinite(value));
  const adrByWeek = new Map<string, number>();
  const holdByWeek = new Map<string, number>();
  for (const row of values) {
    adrByWeek.set(row.week, (adrByWeek.get(row.week) ?? 0) + (row.adrGrid ?? 0));
    holdByWeek.set(row.week, (holdByWeek.get(row.week) ?? 0) + (row.weeklyHold ?? 0));
  }
  return {
    label: options.label,
    rows: options.rows.length,
    weeks: new Set(options.rows.map((row) => row.week_open_utc)).size,
    missing_outcomes: values.filter((row) => row.adrGrid === null || row.weeklyHold === null).length,
    adr_grid_sum: round(sum(adrValues), 6),
    adr_grid_mean: mean(adrValues),
    adr_grid_row_pf: profitFactor(adrValues),
    adr_grid_max_drawdown: maxDrawdown(adrByWeek),
    weekly_hold_sum: round(sum(holdValues), 6),
    weekly_hold_mean: mean(holdValues),
    weekly_hold_row_pf: profitFactor(holdValues),
    weekly_hold_max_drawdown: maxDrawdown(holdByWeek),
  };
}

function renderReceipt(options: {
  generatedAtUtc: string;
  cli: CliOptions;
  runtimeCommit: string;
  dirtyTree: ReturnType<typeof dirtyTreeStatus>;
  resultPath: string;
  resultHash: string;
  hashPath: string;
  rowsPath: string;
  rowsHash: string;
  summaryPath: string;
  summaryHash: string;
  validation: Record<string, unknown>;
  referenceSummaries: Record<string, unknown>;
  topPatterns: Record<string, unknown>;
  runtimeSeconds: number;
}) {
  const lines = [
    "# Gate 58 COT x Strength Forensic Matrix",
    "",
    `Generated: ${options.generatedAtUtc}`,
    "",
    "## Verdict",
    "",
    "PASS_WAREHOUSE_ONLY_FORENSIC_MATRIX_BUILT_NO_DIRECTIONAL_PROMOTION.",
    "",
    "Gate 58 builds a frozen pair-week forensic matrix for the COT x FRS15 Strength state surface. It does not promote a final combined directional rule.",
    "",
    "## Boundary",
    "",
    `- COT baseline: \`CLP carry-forward + carry-previous tie fill\``,
    `- Strength baseline: \`phase_conditioned_remainder\``,
    `- Price bundle: \`${GATE55E_PRICE_BUNDLE_ID}\``,
    `- Warehouse ID: \`${options.cli.warehouseId}\``,
    "- Runtime mode: warehouse outcome reads only for path outcomes",
    "- Not run: raw M1 ADR Grid simulation, COT source changes, Strength source/window changes, regimes, risk overlays, MT5/live/app work, new evaluator, or final combined-system selection.",
    "",
    "## Artifacts",
    "",
    `- Matrix rows JSONL: \`${options.rowsPath}\``,
    `- Matrix rows SHA-256: \`${options.rowsHash}\``,
    `- Summary JSON: \`${options.summaryPath}\``,
    `- Summary SHA-256: \`${options.summaryHash}\``,
    `- Result JSON: \`${options.resultPath}\``,
    `- Result SHA-256: \`${options.resultHash}\``,
    `- Hash JSON: \`${options.hashPath}\``,
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(options.validation, null, 2),
    "```",
    "",
    "## Reference Summaries",
    "",
    "```json",
    JSON.stringify(options.referenceSummaries, null, 2),
    "```",
    "",
    "## Top/Bottom Diagnostic Clusters",
    "",
    "```json",
    JSON.stringify(options.topPatterns, null, 2),
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
    "Stop here. Gate 58 is descriptive only. Any candidate combined directional rule discovered from this matrix must be tested in a later confirmation gate.",
    "",
    `Runtime seconds: ${options.runtimeSeconds}`,
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  const startedAt = Date.now();
  const cli = parseCli();
  const artifactDir = path.resolve(process.cwd(), cli.artifactDir);
  const receiptPath = path.resolve(process.cwd(), cli.receiptPath);
  const runtimeCommit = currentGitCommit();
  const dirtyTree = dirtyTreeStatus();

  const cotBuild = await buildGate54ClpCotRestatementManifest();
  cotBuild.shape = validateGate54ClpManifestShape(cotBuild.manifest, 388, 10864);
  const strengthBuild = await buildGate57BFridayRelativeStrength15wManifests({
    fromWeek: GATE57B_DEFAULT_FROM_WEEK,
    toWeekExclusive: GATE57B_DEFAULT_TO_WEEK_EXCLUSIVE,
    lookbackWeeks: GATE57B_LOOKBACK_WEEKS,
    closeLookbackMinutes: 2880,
    signalIds: GATE57E_SIGNAL_IDS,
    gateId: GATE57E_GATE_ID,
    hypothesisId: GATE57E_HYPOTHESIS_ID,
    featureBundleId: GATE57E_FEATURE_BUNDLE_ID,
    manifestIdPrefix: "gate57e_frs15_phase_conditioned_remainder",
    signalIdPrefix: "gate57e_frs15",
    rowIdPrefix: "gate57e",
    decisionScopePrefix: "fx_28pair_weekly_frs15_phase_conditioned_remainder",
    sourceContextIds: [
      "docs/research/GATE55E_FROZEN_CANONICAL_PRICE_BUNDLE_V1_RECEIPT_2026-06-24.md",
      "docs/research/gates/gate57/GATE57A0B_DURABLE_PAIR_WEEK_PATH_OUTCOME_WAREHOUSE_2026-06-26.md",
      "docs/research/gates/gate57/GATE57B_FRIDAY_STRENGTH_15W_RELATIVE_LIFECYCLE_2026-06-26.md",
      "docs/research/gates/gate57/GATE57C_FRS15_BINARY_LIFECYCLE_RULE_TEST_2026-06-26.md",
      "docs/research/gates/gate57/GATE57D_FRS15_COMPRESSED_GO_REMAINDER_FADE_RULE_2026-06-26.md",
    ],
  });

  const symbols = cotBuild.manifest.universe.symbols;
  const cotWeeks = uniqueSorted(cotBuild.manifest.decisions.map((row) => row.week_open_utc));
  const strengthWeeks = uniqueSorted(strengthBuild.source.supportedWeeks.map((week) => week.weekOpenUtc));
  const strengthWeekSet = new Set(strengthWeeks);
  const cotWeekSet = new Set(cotWeeks);
  const intersectionWeeks = cotWeeks.filter((week) => strengthWeekSet.has(week));
  const unsupportedStrengthWeeks = strengthBuild.source.unsupportedWeeks.map((week) => week.weekOpenUtc);
  const unsupportedStrengthSet = new Set(unsupportedStrengthWeeks);
  const cotOnlyWeeks = cotWeeks.filter((week) => !strengthWeekSet.has(week));
  const cotOnlyWarmupWeeks = cotOnlyWeeks.filter((week) => unsupportedStrengthSet.has(week));
  const cotOnlyNonStrengthRequestedWeeks = cotOnlyWeeks.filter((week) => !unsupportedStrengthSet.has(week));

  const warehouseReadiness = await assertPairWeekPathOutcomeWarehouseReady({
    manifestId: cli.warehouseId,
    expectedSymbols: symbols,
    expectedWeeks: cotWeeks,
  });
  if (warehouseReadiness.manifest.price_bundle_id !== GATE55E_PRICE_BUNDLE_ID) {
    throw new Error(`Warehouse price bundle mismatch: ${warehouseReadiness.manifest.price_bundle_id}`);
  }

  const outcomesByKey = await readWarehouseOutcomes(cli.warehouseId, cotWeeks, symbols);
  const cotByKey = manifestDecisionIndex(cotBuild.manifest);
  const strengthParentByKey = manifestDecisionIndex(strengthBuild.manifests.parent_selected);
  const gate57cByKey = manifestDecisionIndex(strengthBuild.manifests.binary_lifecycle_selected_else_extreme_fade);
  const gate57dByKey = manifestDecisionIndex(strengthBuild.manifests.compressed_selected_remainder_fade);
  const gate57eByKey = manifestDecisionIndex(strengthBuild.manifests.phase_conditioned_remainder);
  const policyByWeek = new Map(cotBuild.source.policyRows.map((row) => [row.weekOpenUtc, row]));

  const cotAbsSpreads = intersectionWeeks.flatMap((week) => symbols.map((symbol) =>
    Math.abs(metricValue(cotByKey.get(keyFor(week, symbol))!, "tei_spread_base_minus_quote") ?? Number.NaN)));
  const strengthAbsSpreads = strengthBuild.source.decisions.map((row) => row.absScoreSpread);
  const cotSpreadBuckets = makeQuantileBucketer(cotAbsSpreads);
  const strengthSpreadBuckets = makeQuantileBucketer(strengthAbsSpreads);

  const matrixRows: MatrixRow[] = [];
  let missingCotStateRows = 0;
  let missingStrengthStateRows = 0;
  let missingLongOutcomes = 0;
  let missingShortOutcomes = 0;

  for (const week of intersectionWeeks) {
    const policy = policyByWeek.get(week);
    for (const symbol of symbols) {
      const key = keyFor(week, symbol);
      const cot = cotByKey.get(key) ?? null;
      const parent = strengthParentByKey.get(key) ?? null;
      const gate57c = gate57cByKey.get(key) ?? null;
      const gate57d = gate57dByKey.get(key) ?? null;
      const gate57e = gate57eByKey.get(key) ?? null;
      const long = outcomesByKey.get(outcomeKey(week, symbol, "LONG")) ?? null;
      const short = outcomesByKey.get(outcomeKey(week, symbol, "SHORT")) ?? null;
      if (!cot) missingCotStateRows += 1;
      if (!parent || !gate57e) missingStrengthStateRows += 1;
      if (!long) missingLongOutcomes += 1;
      if (!short) missingShortOutcomes += 1;

      const cotSpread = cot ? metricValue(cot, "tei_spread_base_minus_quote") : null;
      const strengthSpread = parent ? metricValue(parent, "score_spread") : null;
      const strengthAbsSpread = parent ? metricValue(parent, "abs_score_spread") : null;
      const parentSide = parent?.side ?? null;
      const gate57eSide = gate57e?.side ?? null;
      const source = cot ? metaString(cot, "source") : null;
      const cotSelectedReportDate = cot ? metaString(cot, "selected_report_date") : null;
      const cotExpectedReportDate = policy?.expectedReportDate ?? null;
      const cotCarryForward = Boolean(
        cotSelectedReportDate &&
        cotExpectedReportDate &&
        cotSelectedReportDate !== cotExpectedReportDate,
      ) || Boolean(policy?.classification.includes("carry_forward"));

      matrixRows.push({
        week_open_utc: week,
        year: parseYear(week),
        quarter: parseQuarter(week),
        symbol,
        price_bundle_id: GATE55E_PRICE_BUNDLE_ID,
        warehouse_id: cli.warehouseId,
        cot_manifest_id: cotBuild.manifest.manifest_id,
        strength_parent_manifest_id: strengthBuild.manifests.parent_selected.manifest_id,
        strength_gate57e_manifest_id: strengthBuild.manifests.phase_conditioned_remainder.manifest_id,
        base_currency: cot ? metaString(cot, "base_currency") : parent ? metaString(parent, "base_currency") : null,
        quote_currency: cot ? metaString(cot, "quote_currency") : parent ? metaString(parent, "quote_currency") : null,
        cot_base_tei: cot ? metricValue(cot, "base_tei") : null,
        cot_quote_tei: cot ? metricValue(cot, "quote_tei") : null,
        cot_tei_spread: cotSpread === null ? null : round(cotSpread),
        cot_abs_tei_spread: cotSpread === null ? null : round(Math.abs(cotSpread)),
        cot_tei_spread_bucket: cotSpreadBuckets.bucket(cotSpread === null ? null : Math.abs(cotSpread)),
        cot_side: cot?.side ?? null,
        cot_tie_flag: source === "carry_previous_clp_side" || Math.abs(cotSpread ?? Number.NaN) < 1e-9,
        cot_carry_forward_flag: cotCarryForward,
        cot_carry_previous_flag: source === "carry_previous_clp_side",
        cot_selected_report_date: cotSelectedReportDate,
        cot_expected_report_date: cotExpectedReportDate,
        cot_report_age_days: policy?.reportAgeDays ?? null,
        cot_lifecycle_state: policy?.classification ?? null,
        cot_lifecycle_lookback_reports: GATE54_CLP_LOOKBACK_REPORTS,
        strength_base_score: parent ? metricValue(parent, "base_score") : null,
        strength_quote_score: parent ? metricValue(parent, "quote_score") : null,
        strength_score_spread: strengthSpread === null ? null : round(strengthSpread),
        strength_abs_score_spread: strengthAbsSpread === null ? null : round(strengthAbsSpread),
        strength_score_spread_bucket: strengthSpreadBuckets.bucket(strengthAbsSpread),
        strength_parent_side: parentSide,
        strength_lifecycle_bucket: parent ? metaString(parent, "lifecycle_bucket") : null,
        strength_phase_bucket: parent ? metaString(parent, "phase_bucket") : null,
        gate57c_side: gate57c?.side ?? null,
        gate57c_action_label: actionLabel(parentSide, gate57c?.side ?? null),
        gate57d_side: gate57d?.side ?? null,
        gate57d_action_label: actionLabel(parentSide, gate57d?.side ?? null),
        gate57e_side: gate57eSide,
        gate57e_action_label: actionLabel(parentSide, gate57eSide),
        adr_grid_long_adr: long ? round(long.adr_grid_adr) : null,
        adr_grid_short_adr: short ? round(short.adr_grid_adr) : null,
        adr_grid_long_minus_short: long && short ? round(long.adr_grid_adr - short.adr_grid_adr) : null,
        weekly_hold_long_adr: long ? round(long.weekly_hold_adr) : null,
        weekly_hold_short_adr: short ? round(short.weekly_hold_adr) : null,
        weekly_hold_long_minus_short: long && short ? round(long.weekly_hold_adr - short.weekly_hold_adr) : null,
        cot_side_adr_grid_outcome: sideOutcome(cot?.side ?? null, long, short, "adr_grid"),
        cot_side_weekly_hold_outcome: sideOutcome(cot?.side ?? null, long, short, "weekly_hold"),
        strength_parent_side_adr_grid_outcome: sideOutcome(parentSide, long, short, "adr_grid"),
        strength_parent_side_weekly_hold_outcome: sideOutcome(parentSide, long, short, "weekly_hold"),
        gate57e_side_adr_grid_outcome: sideOutcome(gate57eSide, long, short, "adr_grid"),
        gate57e_side_weekly_hold_outcome: sideOutcome(gate57eSide, long, short, "weekly_hold"),
        cot_vs_strength_parent: sideAgreement(cot?.side ?? null, parentSide),
        cot_vs_gate57e: sideAgreement(cot?.side ?? null, gate57eSide),
        missing_cot_state: !cot,
        missing_strength_state: !parent || !gate57e,
        missing_long_outcome: !long,
        missing_short_outcome: !short,
      });
    }
  }

  const duplicateKeys = new Set<string>();
  const seenKeys = new Set<string>();
  const rowCountsByWeek: Record<string, number> = {};
  for (const row of matrixRows) {
    const key = keyFor(row.week_open_utc, row.symbol);
    if (seenKeys.has(key)) duplicateKeys.add(key);
    seenKeys.add(key);
    rowCountsByWeek[row.week_open_utc] = (rowCountsByWeek[row.week_open_utc] ?? 0) + 1;
  }
  const nonFullWeeks = Object.entries(rowCountsByWeek)
    .filter(([, count]) => count !== FX_SYMBOLS_PER_WEEK)
    .map(([week, count]) => ({ week_open_utc: week, rows: count }));

  const referenceSummaries = {
    cot_full_388_week_baseline: buildReferenceSummary({
      label: "COT full 388-week baseline",
      rows: cotBuild.manifest.decisions,
      outcomesByKey,
    }),
    cot_only_warmup_remainder: buildReferenceSummary({
      label: "COT-only FRS15 warmup remainder",
      rows: cotBuild.manifest.decisions.filter((row) => cotOnlyWarmupWeeks.includes(row.week_open_utc)),
      outcomesByKey,
    }),
    cot_intersection_373_week_reference: buildReferenceSummary({
      label: "COT side on 373-week intersection",
      rows: cotBuild.manifest.decisions.filter((row) => intersectionWeeks.includes(row.week_open_utc)),
      outcomesByKey,
    }),
    strength_parent_intersection_reference: buildReferenceSummary({
      label: "FRS15 parent selected side on 373-week intersection",
      rows: strengthBuild.manifests.parent_selected.decisions,
      outcomesByKey,
    }),
    strength_gate57e_intersection_reference: buildReferenceSummary({
      label: "Gate 57E phase_conditioned_remainder side on 373-week intersection",
      rows: strengthBuild.manifests.phase_conditioned_remainder.decisions,
      outcomesByKey,
    }),
  };

  const summaries = {
    cot_state_x_strength_state: summarize(matrixRows, ["cot_side", "strength_lifecycle_bucket", "strength_phase_bucket"]),
    cot_spread_bucket_x_strength_spread_bucket: summarize(matrixRows, ["cot_tei_spread_bucket", "strength_score_spread_bucket"]),
    cot_spread_bucket_x_strength_lifecycle: summarize(matrixRows, ["cot_tei_spread_bucket", "strength_lifecycle_bucket"]),
    cot_spread_bucket_x_strength_phase: summarize(matrixRows, ["cot_tei_spread_bucket", "strength_phase_bucket"]),
    cot_side_x_strength_parent_side: summarize(matrixRows, ["cot_side", "strength_parent_side"]),
    cot_side_x_gate57e_strength_side_action: summarize(matrixRows, ["cot_side", "gate57e_side", "gate57e_action_label"]),
    lifecycle_x_phase: summarize(matrixRows, ["strength_lifecycle_bucket", "strength_phase_bucket"]),
    agreement_disagreement: summarize(matrixRows, ["cot_vs_strength_parent", "cot_vs_gate57e"]),
    pair_level: summarize(matrixRows, ["symbol"]),
    base_currency_level: summarize(matrixRows, ["base_currency"]),
    quote_currency_level: summarize(matrixRows, ["quote_currency"]),
    year_by_year: summarize(matrixRows, ["year"]),
    quarter_by_quarter: summarize(matrixRows, ["quarter"]),
  };

  const clusterPool = [
    ...summaries.cot_state_x_strength_state,
    ...summaries.cot_spread_bucket_x_strength_spread_bucket,
    ...summaries.cot_spread_bucket_x_strength_lifecycle,
    ...summaries.cot_spread_bucket_x_strength_phase,
    ...summaries.cot_side_x_strength_parent_side,
    ...summaries.cot_side_x_gate57e_strength_side_action,
    ...summaries.lifecycle_x_phase,
    ...summaries.agreement_disagreement,
  ];
  const weekSummaries = summarize(matrixRows, ["week_open_utc"]);
  const topBottomClusters = {
    by_adr_grid_long_minus_short_mean: topBottom(clusterPool, (row) => row.adr_grid_edge_mean),
    by_gate57e_adr_grid_sum: topBottom(clusterPool, (row) => row.gate57e_side_adr_grid_sum),
    by_weekly_hold_long_minus_short_mean: topBottom(clusterPool, (row) => row.weekly_hold_edge_mean),
    by_adr_grid_edge_row_pf: topBottom(clusterPool, (row) => row.adr_grid_edge_row_pf),
    by_gate57e_drawdown: topBottom(clusterPool, (row) => row.gate57e_adr_grid_max_drawdown),
    outlier_weeks_by_abs_gate57e_adr: topBottom(weekSummaries, (row) => Math.abs(row.gate57e_side_adr_grid_sum), 12),
    outlier_weeks_by_abs_long_minus_short: topBottom(weekSummaries, (row) => Math.abs(row.adr_grid_edge_sum), 12),
  };

  const validation = {
    row_count: matrixRows.length,
    expected_row_count: intersectionWeeks.length * symbols.length,
    week_count: intersectionWeeks.length,
    rows_per_week_expected: FX_SYMBOLS_PER_WEEK,
    non_full_weeks: nonFullWeeks,
    duplicate_week_symbol_rows: [...duplicateKeys].sort(),
    missing_cot_state_rows: missingCotStateRows,
    missing_strength_state_rows: missingStrengthStateRows,
    missing_warehouse_outcomes: missingLongOutcomes + missingShortOutcomes,
    missing_long_outcomes: missingLongOutcomes,
    missing_short_outcomes: missingShortOutcomes,
    long_short_outcome_complete_rows: matrixRows.filter((row) => !row.missing_long_outcome && !row.missing_short_outcome).length,
    intersection_window: {
      cot_weeks: cotWeeks.length,
      strength_supported_weeks: strengthWeeks.length,
      intersection_weeks: intersectionWeeks.length,
      first_intersection_week: intersectionWeeks[0] ?? null,
      last_intersection_week: intersectionWeeks.at(-1) ?? null,
      cot_only_weeks_total: cotOnlyWeeks.length,
      cot_only_warmup_weeks: cotOnlyWarmupWeeks,
      cot_only_non_strength_requested_weeks: cotOnlyNonStrengthRequestedWeeks,
      strength_unsupported_warmup_weeks: unsupportedStrengthWeeks,
    },
    cot_shape: cotBuild.shape,
    strength_shape: strengthBuild.source.shape.phase_conditioned_remainder,
    warehouse_inspection: warehouseReadiness.inspection,
  };

  const artifactPaths = {
    rowsPath: path.join(artifactDir, "gate58-cot-strength-forensic-matrix.rows.jsonl"),
    summaryPath: path.join(artifactDir, "gate58-cot-strength-forensic-matrix.summary.json"),
    resultPath: path.join(artifactDir, "gate58-cot-strength-forensic-matrix.result.json"),
    hashPath: path.join(artifactDir, "gate58-cot-strength-forensic-matrix.hash.json"),
  };
  await Promise.all([
    mkdir(artifactDir, { recursive: true }),
    mkdir(path.dirname(receiptPath), { recursive: true }),
  ]);

  const rowsText = `${matrixRows.map((row) => JSON.stringify(row)).join("\n")}\n`;
  const rowsHash = sha256Text(rowsText);
  const summaryPayload = {
    gate_id: GATE58_ID,
    generated_at_utc: new Date().toISOString(),
    price_bundle_id: GATE55E_PRICE_BUNDLE_ID,
    warehouse_id: cli.warehouseId,
    bucket_thresholds: {
      cot_abs_tei_spread: cotSpreadBuckets.thresholds,
      strength_abs_score_spread: strengthSpreadBuckets.thresholds,
    },
    summaries,
    top_bottom_clusters: topBottomClusters,
  };
  const summaryText = `${JSON.stringify(summaryPayload, null, 2)}\n`;
  const summaryHash = sha256Text(summaryText);
  const resultPayload = {
    gate_id: GATE58_ID,
    status: "PASS_WAREHOUSE_ONLY_FORENSIC_MATRIX_BUILT_NO_DIRECTIONAL_PROMOTION",
    generated_at_utc: new Date().toISOString(),
    runtime_commit: runtimeCommit,
    dirty_tree: dirtyTree,
    price_bundle_id: GATE55E_PRICE_BUNDLE_ID,
    warehouse_id: cli.warehouseId,
    cot_baseline: {
      signal_id: GATE56F_SIGNAL_ID,
      manifest_id: cotBuild.manifest.manifest_id,
      manifest_hash: cotBuild.manifest.manifest_hash,
      signal_version: cotBuild.manifest.signal_version,
    },
    strength_baseline: {
      signal_id: strengthBuild.manifests.phase_conditioned_remainder.signal_id,
      manifest_id: strengthBuild.manifests.phase_conditioned_remainder.manifest_id,
      manifest_hash: strengthBuild.manifests.phase_conditioned_remainder.manifest_hash,
      signal_version: strengthBuild.manifests.phase_conditioned_remainder.signal_version,
    },
    validation,
    reference_summaries: referenceSummaries,
    artifact_hashes: {
      rows_jsonl_sha256: rowsHash,
      summary_json_sha256: summaryHash,
    },
    artifact_paths: {
      rows_jsonl: toRepoRelative(artifactPaths.rowsPath),
      summary_json: toRepoRelative(artifactPaths.summaryPath),
    },
  };
  const resultText = `${JSON.stringify(resultPayload, null, 2)}\n`;
  const resultHash = sha256Text(resultText);
  const hashPayload = {
    gate_id: GATE58_ID,
    rows_jsonl_sha256: rowsHash,
    summary_json_sha256: summaryHash,
    result_json_sha256: resultHash,
    combined_hash: sha256Stable({
      rows_jsonl_sha256: rowsHash,
      summary_json_sha256: summaryHash,
      result_json_sha256: resultHash,
    }),
  };
  const hashText = `${JSON.stringify(hashPayload, null, 2)}\n`;
  const runtimeSeconds = round((Date.now() - startedAt) / 1000, 1) ?? 0;
  const receiptWithoutHash = renderReceipt({
    generatedAtUtc: new Date().toISOString(),
    cli,
    runtimeCommit,
    dirtyTree,
    resultPath: toRepoRelative(artifactPaths.resultPath),
    resultHash,
    hashPath: toRepoRelative(artifactPaths.hashPath),
    rowsPath: toRepoRelative(artifactPaths.rowsPath),
    rowsHash,
    summaryPath: toRepoRelative(artifactPaths.summaryPath),
    summaryHash,
    validation,
    referenceSummaries,
    topPatterns: topBottomClusters,
    runtimeSeconds,
  });
  const receiptHash = sha256Text(receiptWithoutHash);
  const receiptText = `${receiptWithoutHash}Receipt hash: \`${receiptHash}\`\n`;

  await Promise.all([
    writeFile(artifactPaths.rowsPath, rowsText, "utf8"),
    writeFile(artifactPaths.summaryPath, summaryText, "utf8"),
    writeFile(artifactPaths.resultPath, resultText, "utf8"),
    writeFile(artifactPaths.hashPath, hashText, "utf8"),
    writeFile(receiptPath, receiptText, "utf8"),
  ]);

  console.log(`Gate 58 matrix rows: ${matrixRows.length}`);
  console.log(`Intersection weeks: ${intersectionWeeks.length}`);
  console.log(`Missing COT state rows: ${missingCotStateRows}`);
  console.log(`Missing Strength state rows: ${missingStrengthStateRows}`);
  console.log(`Missing warehouse outcomes: ${missingLongOutcomes + missingShortOutcomes}`);
  console.log(`Rows JSONL: ${toRepoRelative(artifactPaths.rowsPath)}`);
  console.log(`Rows SHA-256: ${rowsHash}`);
  console.log(`Summary JSON: ${toRepoRelative(artifactPaths.summaryPath)}`);
  console.log(`Summary SHA-256: ${summaryHash}`);
  console.log(`Result JSON: ${toRepoRelative(artifactPaths.resultPath)}`);
  console.log(`Result SHA-256: ${resultHash}`);
  console.log(`Hash JSON: ${toRepoRelative(artifactPaths.hashPath)}`);
  console.log(`Receipt: ${toRepoRelative(receiptPath)}`);
  console.log(`Receipt hash: ${receiptHash}`);
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
