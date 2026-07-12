import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { sha256Stable, sha256Text } from "@engine/research/hash";

const GATE_ID = "Gate 59: alpha-v1-atom-ledger-contract";
const LEDGER_ID = "gate59_alpha_v1_cot_parent_strength_healthy_fallback_atom_ledger";
const SCHEMA_VERSION = "gate59_alpha_v1_atom_ledger_v1";
const ALPHA_ID = "ALPHA_V1_COT_PARENT_STRENGTH_HEALTHY_FALLBACK";
const SOURCE_CANDIDATE_ID = "C_STRENGTH_HEALTHY_COT_FALLBACK";
const DEFAULT_MATRIX_ROWS_PATH =
  "docs/research/gates/gate58/artifacts/gate58-cot-strength-forensic-matrix/gate58-cot-strength-forensic-matrix.rows.jsonl";
const DEFAULT_GATE58C_DECISIONS_PATH =
  "docs/research/gates/gate58c/artifacts/gate58c-forced28-directional-arbitration/gate58c-forced28-directional-arbitration.decisions.jsonl";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate59/artifacts/gate59-alpha-v1-atom-ledger";
const DEFAULT_REPORT_PATH = "docs/research/gates/gate59/GATE59_ALPHA_V1_ATOM_LEDGER_CONTRACT_2026-06-27.md";
const EXPECTED_ROWS = 10444;
const EXPECTED_WEEKS = 373;
const EXPECTED_SYMBOLS_PER_WEEK = 28;
const DEFAULT_PRICE_BUNDLE_ID = "gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953";
const DEFAULT_WAREHOUSE_ID = "gate57a0b_pair_week_path_outcomes_47B8F40AFB3B";

type Side = "LONG" | "SHORT";
type Agreement = "agree" | "disagree" | "missing";
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type CliOptions = {
  matrixRowsPath: string;
  gate58cDecisionsPath: string;
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
  cot_side: Side | null;
  cot_tie_flag: boolean;
  cot_carry_forward_flag: boolean;
  cot_carry_previous_flag: boolean;
  cot_selected_report_date: string | null;
  cot_expected_report_date: string | null;
  cot_report_age_days: number | null;
  cot_lifecycle_state: string;
  cot_lifecycle_lookback_reports: number | null;
  strength_base_score: number | null;
  strength_quote_score: number | null;
  strength_score_spread: number | null;
  strength_abs_score_spread: number | null;
  strength_score_spread_bucket: string;
  strength_parent_side: Side | null;
  strength_lifecycle_bucket: string | null;
  strength_phase_bucket: string | null;
  gate57c_side: Side | null;
  gate57c_action_label: string | null;
  gate57d_side: Side | null;
  gate57d_action_label: string | null;
  gate57e_side: Side | null;
  gate57e_action_label: string | null;
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
  cot_vs_strength_parent: Agreement;
  cot_vs_gate57e: Agreement;
  missing_cot_state: boolean;
  missing_strength_state: boolean;
  missing_long_outcome: boolean;
  missing_short_outcome: boolean;
};

type Gate58CDecisionRow = {
  candidate_id: string;
  duplicate_of: string | null;
  week_open_utc: string;
  year: number;
  quarter: string;
  symbol: string;
  final_side: Side;
  side_source: string;
  rule_reason: string;
  cot_side: Side;
  strength_parent_side: Side;
  gate57e_side: Side;
  cot_vs_gate57e: Agreement;
  strength_lifecycle_bucket: string;
  strength_phase_bucket: string;
  adr_grid_adr: number;
  weekly_hold_adr: number;
  price_bundle_id: string;
  warehouse_id: string;
};

type Validation = {
  row_count: number;
  expected_row_count: number;
  week_count: number;
  expected_week_count: number;
  symbol_count: number;
  expected_symbols_per_week: number;
  full_weeks_count: number;
  duplicate_matrix_week_symbol_rows: number;
  duplicate_candidate_week_symbol_rows: number;
  missing_candidate_rows: number;
  unexpected_candidate_rows: number;
  final_side_mismatch_rows: number;
  rule_source_mismatch_rows: number;
  missing_cot_rows: number;
  missing_strength_rows: number;
  missing_long_outcomes: number;
  missing_short_outcomes: number;
  price_bundle_mismatch_rows: number;
  warehouse_mismatch_rows: number;
  alpha_row_count_ok: boolean;
  forced_28_ok: boolean;
  join_ok: boolean;
  lineage_ok: boolean;
  rule_ok: boolean;
};

type AtomLedgerRow = {
  ledger_id: string;
  schema_version: string;
  alpha_id: string;
  source_candidate_id: string;
  row_key: string;
  week: {
    week_open_utc: string;
    year: number;
    quarter: string;
  };
  instrument: {
    symbol: string;
    base_currency: string | null;
    quote_currency: string | null;
  };
  lineage: {
    price_bundle_id: string;
    warehouse_id: string;
    cot_manifest_id: string;
    strength_parent_manifest_id: string;
    strength_gate57e_manifest_id: string;
    gate58_matrix_rows_sha256: string;
    gate58c_decisions_jsonl_sha256: string;
  };
  cot_atoms: {
    side: Side;
    base_tei: number | null;
    quote_tei: number | null;
    tei_spread: number | null;
    abs_tei_spread: number | null;
    tei_spread_bucket: string;
    tie_flag: boolean;
    carry_forward_flag: boolean;
    carry_previous_flag: boolean;
    selected_report_date: string | null;
    expected_report_date: string | null;
    report_age_days: number | null;
    lifecycle_state: string;
    lifecycle_lookback_reports: number | null;
  };
  strength_atoms: {
    parent_side: Side;
    gate57e_side: Side;
    base_score: number | null;
    quote_score: number | null;
    score_spread: number | null;
    abs_score_spread: number | null;
    score_spread_bucket: string;
    lifecycle_bucket: string;
    phase_bucket: string;
    lifecycle_phase_key: string;
    gate57c_side: Side | null;
    gate57c_action_label: string | null;
    gate57d_side: Side | null;
    gate57d_action_label: string | null;
    gate57e_action_label: string | null;
  };
  arbitration: {
    final_side: Side;
    final_side_source: "COT" | "STRENGTH";
    gate58c_side_source: string;
    gate58c_rule_reason: string;
    healthy_strength_state: boolean;
    healthy_strength_surface: string[];
    cot_vs_strength_parent: Agreement;
    cot_vs_gate57e: Agreement;
    final_side_equals_cot: boolean;
    final_side_equals_gate57e_strength: boolean;
    candidate_d_duplicate_status: "duplicate_of_candidate_c";
  };
  outcomes: {
    adr_grid: OutcomeAtom;
    weekly_hold: OutcomeAtom;
  };
  diagnostics: {
    missing_cot_state: boolean;
    missing_strength_state: boolean;
    missing_long_outcome: boolean;
    missing_short_outcome: boolean;
  };
  regime_placeholder: {
    namespace: "gate60_regime_reserved";
    status: "reserved_unpopulated";
    regime_side: null;
    regime_confidence: null;
    macro_value_side: null;
    macro_flow_side: null;
    regime_agrees_with_cot: null;
    regime_agrees_with_strength: null;
    regime_agrees_with_alpha_v1: null;
  };
};

type OutcomeAtom = {
  long: number;
  short: number;
  chosen: number;
  opposite: number;
  cot: number;
  strength_parent: number;
  strength_gate57e: number;
  chosen_minus_cot: number;
  chosen_minus_strength_parent: number;
  chosen_minus_strength_gate57e: number;
};

function parseCli(): CliOptions {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Build ${GATE_ID}.

Common:
  --matrix-rows-path=<path>       Default: ${DEFAULT_MATRIX_ROWS_PATH}
  --gate58c-decisions-path=<path> Default: ${DEFAULT_GATE58C_DECISIONS_PATH}
  --artifact-dir=<path>           Default: ${DEFAULT_ARTIFACT_DIR}
  --report-path=<path>            Default: ${DEFAULT_REPORT_PATH}

This command freezes the Alpha v1 atom ledger contract from existing Gate 58 and
Gate 58C artifacts only. It does not run raw M1 simulation, change COT or
Strength logic, add Regime, add risk, add execution, or write app code.`);
    process.exit(0);
  }
  const argValue = (name: string) => {
    const prefix = `--${name}=`;
    return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  };
  return {
    matrixRowsPath: argValue("matrix-rows-path") ?? DEFAULT_MATRIX_ROWS_PATH,
    gate58cDecisionsPath: argValue("gate58c-decisions-path") ?? DEFAULT_GATE58C_DECISIONS_PATH,
    artifactDir: argValue("artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: argValue("report-path") ?? DEFAULT_REPORT_PATH,
  };
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  const text = await readFile(filePath, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line) as T;
      } catch (error) {
        throw new Error(`Failed to parse JSONL ${filePath}:${index + 1}: ${(error as Error).message}`);
      }
    });
}

async function hashFile(filePath: string) {
  const bytes = await readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
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

function toRepoRelative(filePath: string) {
  return path.relative(process.cwd(), path.resolve(process.cwd(), filePath)).replaceAll(path.sep, "/");
}

function rowKey(row: { week_open_utc: string; symbol: string }) {
  return `${row.week_open_utc}|${row.symbol}`;
}

function oppositeSide(side: Side): Side {
  return side === "LONG" ? "SHORT" : "LONG";
}

function sideOutcome(side: Side, longOutcome: number | null, shortOutcome: number | null) {
  const value = side === "LONG" ? longOutcome : shortOutcome;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Missing ${side} outcome`);
  }
  return value;
}

function stateKey(row: Pick<MatrixRow, "strength_lifecycle_bucket" | "strength_phase_bucket">) {
  return `${row.strength_lifecycle_bucket ?? "missing"}:${row.strength_phase_bucket ?? "missing"}`;
}

function isHealthyStrengthState(row: Pick<MatrixRow, "strength_lifecycle_bucket" | "strength_phase_bucket">) {
  return (
    (row.strength_lifecycle_bucket === "compressed" && row.strength_phase_bucket === "persistent") ||
    (row.strength_lifecycle_bucket === "compressed" && row.strength_phase_bucket === "flip") ||
    (row.strength_lifecycle_bucket === "middle" && row.strength_phase_bucket === "persistent")
  );
}

function expectedFinalSide(row: MatrixRow) {
  if (!row.cot_side || !row.gate57e_side) {
    throw new Error(`Missing required side for ${rowKey(row)}`);
  }
  return isHealthyStrengthState(row) ? row.gate57e_side : row.cot_side;
}

function expectedFinalSource(row: MatrixRow): "COT" | "STRENGTH" {
  return isHealthyStrengthState(row) ? "STRENGTH" : "COT";
}

function countDuplicates(keys: string[]) {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const key of keys) {
    if (seen.has(key)) {
      duplicates += 1;
    }
    seen.add(key);
  }
  return duplicates;
}

function rowsPerWeek(rows: Array<{ week: { week_open_utc: string }; instrument: { symbol: string } }>) {
  const counts = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = counts.get(row.week.week_open_utc) ?? new Set<string>();
    set.add(row.instrument.symbol);
    counts.set(row.week.week_open_utc, set);
  }
  const histogram: Record<string, number> = {};
  const nonFullWeeks: Array<{ week_open_utc: string; symbol_count: number }> = [];
  for (const [week, symbols] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const count = symbols.size;
    histogram[String(count)] = (histogram[String(count)] ?? 0) + 1;
    if (count !== EXPECTED_SYMBOLS_PER_WEEK) {
      nonFullWeeks.push({ week_open_utc: week, symbol_count: count });
    }
  }
  return {
    weeks: counts.size,
    full_weeks_count: [...counts.values()].filter((symbols) => symbols.size === EXPECTED_SYMBOLS_PER_WEEK).length,
    min_rows_per_week: Math.min(...[...counts.values()].map((symbols) => symbols.size)),
    max_rows_per_week: Math.max(...[...counts.values()].map((symbols) => symbols.size)),
    histogram,
    non_full_weeks: nonFullWeeks,
  };
}

function sumBy<T>(rows: T[], selector: (row: T) => number) {
  return rows.reduce((sum, row) => sum + selector(row), 0);
}

function round6(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function outcomeAtom(row: MatrixRow, finalSide: Side, longField: keyof MatrixRow, shortField: keyof MatrixRow): OutcomeAtom {
  const long = row[longField];
  const short = row[shortField];
  if (typeof long !== "number" || typeof short !== "number") {
    throw new Error(`Missing long/short outcome for ${rowKey(row)}`);
  }
  if (!row.cot_side || !row.strength_parent_side || !row.gate57e_side) {
    throw new Error(`Missing side for outcome atom ${rowKey(row)}`);
  }
  const chosen = sideOutcome(finalSide, long, short);
  const opposite = sideOutcome(oppositeSide(finalSide), long, short);
  const cot = sideOutcome(row.cot_side, long, short);
  const strengthParent = sideOutcome(row.strength_parent_side, long, short);
  const strengthGate57e = sideOutcome(row.gate57e_side, long, short);
  return {
    long,
    short,
    chosen,
    opposite,
    cot,
    strength_parent: strengthParent,
    strength_gate57e: strengthGate57e,
    chosen_minus_cot: round6(chosen - cot),
    chosen_minus_strength_parent: round6(chosen - strengthParent),
    chosen_minus_strength_gate57e: round6(chosen - strengthGate57e),
  };
}

function assertSide(side: Side | null, label: string, key: string): Side {
  if (side !== "LONG" && side !== "SHORT") {
    throw new Error(`Missing ${label} side for ${key}`);
  }
  return side;
}

function buildAtomRow(
  row: MatrixRow,
  decision: Gate58CDecisionRow,
  matrixHash: string,
  decisionsHash: string,
): AtomLedgerRow {
  const key = rowKey(row);
  const cotSide = assertSide(row.cot_side, "COT", key);
  const strengthParentSide = assertSide(row.strength_parent_side, "Strength parent", key);
  const gate57eSide = assertSide(row.gate57e_side, "Gate 57E Strength", key);
  const finalSide = decision.final_side;
  const healthy = isHealthyStrengthState(row);
  return {
    ledger_id: LEDGER_ID,
    schema_version: SCHEMA_VERSION,
    alpha_id: ALPHA_ID,
    source_candidate_id: SOURCE_CANDIDATE_ID,
    row_key: key,
    week: {
      week_open_utc: row.week_open_utc,
      year: row.year,
      quarter: row.quarter,
    },
    instrument: {
      symbol: row.symbol,
      base_currency: row.base_currency,
      quote_currency: row.quote_currency,
    },
    lineage: {
      price_bundle_id: row.price_bundle_id,
      warehouse_id: row.warehouse_id,
      cot_manifest_id: row.cot_manifest_id,
      strength_parent_manifest_id: row.strength_parent_manifest_id,
      strength_gate57e_manifest_id: row.strength_gate57e_manifest_id,
      gate58_matrix_rows_sha256: matrixHash,
      gate58c_decisions_jsonl_sha256: decisionsHash,
    },
    cot_atoms: {
      side: cotSide,
      base_tei: row.cot_base_tei,
      quote_tei: row.cot_quote_tei,
      tei_spread: row.cot_tei_spread,
      abs_tei_spread: row.cot_abs_tei_spread,
      tei_spread_bucket: row.cot_tei_spread_bucket,
      tie_flag: row.cot_tie_flag,
      carry_forward_flag: row.cot_carry_forward_flag,
      carry_previous_flag: row.cot_carry_previous_flag,
      selected_report_date: row.cot_selected_report_date,
      expected_report_date: row.cot_expected_report_date,
      report_age_days: row.cot_report_age_days,
      lifecycle_state: row.cot_lifecycle_state,
      lifecycle_lookback_reports: row.cot_lifecycle_lookback_reports,
    },
    strength_atoms: {
      parent_side: strengthParentSide,
      gate57e_side: gate57eSide,
      base_score: row.strength_base_score,
      quote_score: row.strength_quote_score,
      score_spread: row.strength_score_spread,
      abs_score_spread: row.strength_abs_score_spread,
      score_spread_bucket: row.strength_score_spread_bucket,
      lifecycle_bucket: row.strength_lifecycle_bucket ?? "missing",
      phase_bucket: row.strength_phase_bucket ?? "missing",
      lifecycle_phase_key: stateKey(row),
      gate57c_side: row.gate57c_side,
      gate57c_action_label: row.gate57c_action_label,
      gate57d_side: row.gate57d_side,
      gate57d_action_label: row.gate57d_action_label,
      gate57e_action_label: row.gate57e_action_label,
    },
    arbitration: {
      final_side: finalSide,
      final_side_source: expectedFinalSource(row),
      gate58c_side_source: decision.side_source,
      gate58c_rule_reason: decision.rule_reason,
      healthy_strength_state: healthy,
      healthy_strength_surface: ["compressed:persistent", "compressed:flip", "middle:persistent"],
      cot_vs_strength_parent: row.cot_vs_strength_parent,
      cot_vs_gate57e: row.cot_vs_gate57e,
      final_side_equals_cot: finalSide === cotSide,
      final_side_equals_gate57e_strength: finalSide === gate57eSide,
      candidate_d_duplicate_status: "duplicate_of_candidate_c",
    },
    outcomes: {
      adr_grid: outcomeAtom(row, finalSide, "adr_grid_long_adr", "adr_grid_short_adr"),
      weekly_hold: outcomeAtom(row, finalSide, "weekly_hold_long_adr", "weekly_hold_short_adr"),
    },
    diagnostics: {
      missing_cot_state: row.missing_cot_state,
      missing_strength_state: row.missing_strength_state,
      missing_long_outcome: row.missing_long_outcome,
      missing_short_outcome: row.missing_short_outcome,
    },
    regime_placeholder: {
      namespace: "gate60_regime_reserved",
      status: "reserved_unpopulated",
      regime_side: null,
      regime_confidence: null,
      macro_value_side: null,
      macro_flow_side: null,
      regime_agrees_with_cot: null,
      regime_agrees_with_strength: null,
      regime_agrees_with_alpha_v1: null,
    },
  };
}

function buildContractPayload(inputHashes: { matrixHash: string; decisionsHash: string }) {
  return {
    gate_id: GATE_ID,
    ledger_id: LEDGER_ID,
    schema_version: SCHEMA_VERSION,
    alpha_id: ALPHA_ID,
    status: "frozen_atom_ledger_contract",
    source_candidate_id: SOURCE_CANDIDATE_ID,
    source_artifacts: {
      gate58_matrix_rows_path: DEFAULT_MATRIX_ROWS_PATH,
      gate58_matrix_rows_sha256: inputHashes.matrixHash,
      gate58c_decisions_path: DEFAULT_GATE58C_DECISIONS_PATH,
      gate58c_decisions_sha256: inputHashes.decisionsHash,
    },
    row_contract: {
      primary_key: ["week_open_utc", "symbol"],
      row_count: EXPECTED_ROWS,
      weeks: EXPECTED_WEEKS,
      symbols_per_week: EXPECTED_SYMBOLS_PER_WEEK,
      final_side_values: ["LONG", "SHORT"],
      no_skipped_pair_weeks: true,
      no_row_vetoes: true,
      no_regime_fields_populated_yet: true,
    },
    required_sections: [
      "lineage",
      "cot_atoms",
      "strength_atoms",
      "arbitration",
      "outcomes",
      "diagnostics",
      "regime_placeholder",
    ],
    regime_placeholder_contract: {
      namespace: "gate60_regime_reserved",
      all_values_unpopulated_in_gate59: true,
      future_gate_may_fill: "Gate 60/61 after source-integrity proof and forced-28 Regime shadow signal",
    },
    permanent_layering_rule:
      "Alpha layers force 28 pair-week directions. Risk and portfolio layers may later reduce expression, but the shadow ledger retains all 28 signal outcomes.",
    frozen_areas: [
      "No COT source change",
      "No Strength source/window change",
      "No Regime signal construction",
      "No risk overlay",
      "No execution change",
      "No app code",
      "No new strategy comparison",
    ],
  };
}

function buildValidation(matrixRows: MatrixRow[], candidateRows: Gate58CDecisionRow[], ledgerRows: AtomLedgerRow[]): Validation {
  const matrixKeys = matrixRows.map(rowKey);
  const candidateKeys = candidateRows.map(rowKey);
  const matrixKeySet = new Set(matrixKeys);
  const candidateKeySet = new Set(candidateKeys);
  const missingCandidateRows = matrixKeys.filter((key) => !candidateKeySet.has(key)).length;
  const unexpectedCandidateRows = candidateKeys.filter((key) => !matrixKeySet.has(key)).length;
  const weekStats = rowsPerWeek(ledgerRows);
  const symbols = new Set(ledgerRows.map((row) => row.instrument.symbol));
  let finalSideMismatchRows = 0;
  let ruleSourceMismatchRows = 0;
  for (const atom of ledgerRows) {
    const expectedSource = atom.arbitration.healthy_strength_state ? "STRENGTH" : "COT";
    if (atom.arbitration.final_side_source !== expectedSource) {
      ruleSourceMismatchRows += 1;
    }
    if (atom.arbitration.final_side !== (expectedSource === "STRENGTH" ? atom.strength_atoms.gate57e_side : atom.cot_atoms.side)) {
      finalSideMismatchRows += 1;
    }
  }
  const priceBundleMismatchRows = ledgerRows.filter((row) => row.lineage.price_bundle_id !== DEFAULT_PRICE_BUNDLE_ID).length;
  const warehouseMismatchRows = ledgerRows.filter((row) => row.lineage.warehouse_id !== DEFAULT_WAREHOUSE_ID).length;
  return {
    row_count: ledgerRows.length,
    expected_row_count: EXPECTED_ROWS,
    week_count: weekStats.weeks,
    expected_week_count: EXPECTED_WEEKS,
    symbol_count: symbols.size,
    expected_symbols_per_week: EXPECTED_SYMBOLS_PER_WEEK,
    full_weeks_count: weekStats.full_weeks_count,
    duplicate_matrix_week_symbol_rows: countDuplicates(matrixKeys),
    duplicate_candidate_week_symbol_rows: countDuplicates(candidateKeys),
    missing_candidate_rows: missingCandidateRows,
    unexpected_candidate_rows: unexpectedCandidateRows,
    final_side_mismatch_rows: finalSideMismatchRows,
    rule_source_mismatch_rows: ruleSourceMismatchRows,
    missing_cot_rows: ledgerRows.filter((row) => row.diagnostics.missing_cot_state).length,
    missing_strength_rows: ledgerRows.filter((row) => row.diagnostics.missing_strength_state).length,
    missing_long_outcomes: ledgerRows.filter((row) => row.diagnostics.missing_long_outcome).length,
    missing_short_outcomes: ledgerRows.filter((row) => row.diagnostics.missing_short_outcome).length,
    price_bundle_mismatch_rows: priceBundleMismatchRows,
    warehouse_mismatch_rows: warehouseMismatchRows,
    alpha_row_count_ok: ledgerRows.length === EXPECTED_ROWS,
    forced_28_ok: weekStats.weeks === EXPECTED_WEEKS && weekStats.full_weeks_count === EXPECTED_WEEKS,
    join_ok: missingCandidateRows === 0 && unexpectedCandidateRows === 0,
    lineage_ok: priceBundleMismatchRows === 0 && warehouseMismatchRows === 0,
    rule_ok: finalSideMismatchRows === 0 && ruleSourceMismatchRows === 0,
  };
}

function aggregateLedger(ledgerRows: AtomLedgerRow[]) {
  const sourceCounts: Record<string, number> = {};
  const agreementCounts: Record<string, number> = {};
  const stateCounts: Record<string, number> = {};
  for (const row of ledgerRows) {
    sourceCounts[row.arbitration.final_side_source] = (sourceCounts[row.arbitration.final_side_source] ?? 0) + 1;
    agreementCounts[row.arbitration.cot_vs_gate57e] = (agreementCounts[row.arbitration.cot_vs_gate57e] ?? 0) + 1;
    stateCounts[row.strength_atoms.lifecycle_phase_key] = (stateCounts[row.strength_atoms.lifecycle_phase_key] ?? 0) + 1;
  }
  return {
    final_side_source_counts: sourceCounts,
    cot_vs_gate57e_counts: agreementCounts,
    strength_lifecycle_phase_counts: Object.fromEntries(Object.entries(stateCounts).sort((a, b) => a[0].localeCompare(b[0]))),
    outcome_sums: {
      adr_grid_chosen: round6(sumBy(ledgerRows, (row) => row.outcomes.adr_grid.chosen)),
      adr_grid_candidate_minus_cot: round6(sumBy(ledgerRows, (row) => row.outcomes.adr_grid.chosen_minus_cot)),
      adr_grid_candidate_minus_strength_gate57e: round6(
        sumBy(ledgerRows, (row) => row.outcomes.adr_grid.chosen_minus_strength_gate57e),
      ),
      weekly_hold_chosen: round6(sumBy(ledgerRows, (row) => row.outcomes.weekly_hold.chosen)),
      weekly_hold_candidate_minus_cot: round6(sumBy(ledgerRows, (row) => row.outcomes.weekly_hold.chosen_minus_cot)),
      weekly_hold_candidate_minus_strength_gate57e: round6(
        sumBy(ledgerRows, (row) => row.outcomes.weekly_hold.chosen_minus_strength_gate57e),
      ),
    },
  };
}

function buildReport(options: {
  generatedAt: string;
  validation: Validation;
  aggregate: ReturnType<typeof aggregateLedger>;
  contractPath: string;
  ledgerPath: string;
  summaryPath: string;
  receiptPath: string;
  hashPath: string;
  shaPath: string;
  contractHash: string;
  ledgerHash: string;
  summaryHash: string;
  receiptHash: string;
  verdict: string;
}) {
  const validationJson = JSON.stringify(options.validation, null, 2);
  const aggregateJson = JSON.stringify(options.aggregate, null, 2);
  return [
    "# Gate 59 Alpha v1 Atom Ledger Contract",
    "",
    `Generated: ${options.generatedAt}`,
    "",
    "## Verdict",
    "",
    `${options.verdict}.`,
    "",
    "Gate 59 freezes the Alpha v1 atom ledger contract from existing Gate 58 and Gate 58C artifacts. It is not a new strategy test and does not change COT, Strength, Regime, risk, execution, MT5/live, or app code.",
    "",
    "## Alpha v1 Rule",
    "",
    "Use locked COT side by default for every pair-week. Use locked Gate 57E Strength side only when the Strength state is `compressed:persistent`, `compressed:flip`, or `middle:persistent`. The alpha layer must output exactly 28 pair directions per supported week and must never skip rows.",
    "",
    "## Boundary",
    "",
    `- Alpha id: \`${ALPHA_ID}\``,
    `- Schema version: \`${SCHEMA_VERSION}\``,
    `- Source candidate: \`${SOURCE_CANDIDATE_ID}\``,
    `- Source matrix: \`${DEFAULT_MATRIX_ROWS_PATH}\``,
    `- Source decisions: \`${DEFAULT_GATE58C_DECISIONS_PATH}\``,
    `- Price bundle: \`${DEFAULT_PRICE_BUNDLE_ID}\``,
    `- Warehouse ID: \`${DEFAULT_WAREHOUSE_ID}\``,
    "- Not run: raw M1 simulation, COT source change, Strength source/window change, Regime construction, risk overlay, execution change, MT5/live, app work, row veto, pair/week filter, parameter search, or new threshold.",
    "",
    "## Artifacts",
    "",
    `- Contract JSON: \`${options.contractPath}\``,
    `- Contract SHA-256: \`${options.contractHash}\``,
    `- Atom ledger JSONL: \`${options.ledgerPath}\``,
    `- Atom ledger SHA-256: \`${options.ledgerHash}\``,
    `- Summary JSON: \`${options.summaryPath}\``,
    `- Summary SHA-256: \`${options.summaryHash}\``,
    `- Receipt JSON: \`${options.receiptPath}\``,
    `- Receipt SHA-256: \`${options.receiptHash}\``,
    `- Hash manifest JSON: \`${options.hashPath}\``,
    `- Tracked SHA identity: \`${options.shaPath}\``,
    "",
    "## Validation",
    "",
    "```json",
    validationJson,
    "```",
    "",
    "## Reconciliation",
    "",
    "```json",
    aggregateJson,
    "```",
    "",
    "## Contract Sections",
    "",
    "- `lineage`: price bundle, warehouse, manifest ids, and source artifact hashes.",
    "- `cot_atoms`: COT side, TEI atoms, carry/tie flags, report dates, report age, and lifecycle state.",
    "- `strength_atoms`: parent side, Gate 57E side, score atoms, lifecycle bucket, phase bucket, and prior Gate 57 transforms.",
    "- `arbitration`: final Alpha v1 side, COT/Strength source, healthy-state flag, agreement flags, and Candidate D duplicate status.",
    "- `outcomes`: long, short, chosen, opposite, COT, Strength parent, Gate 57E Strength, and candidate-minus-baseline outcomes for ADR Grid and Weekly Hold.",
    "- `diagnostics`: missing source/outcome flags carried forward from Gate 58.",
    "- `regime_placeholder`: reserved null namespace for later Regime gates only.",
    "",
    "## Stop Line",
    "",
    "Stop here. Gate 59 freezes the Alpha v1 atom ledger contract only. Do not proceed to Regime source integrity, Regime shadow signal, risk, execution, MT5/live, app work, or cleanup in this gate.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseCli();
  const generatedAt = new Date().toISOString();
  const matrixRowsPath = path.resolve(process.cwd(), options.matrixRowsPath);
  const gate58cDecisionsPath = path.resolve(process.cwd(), options.gate58cDecisionsPath);
  const artifactDir = path.resolve(process.cwd(), options.artifactDir);
  const reportPath = path.resolve(process.cwd(), options.reportPath);
  const contractPath = path.join(artifactDir, "gate59-alpha-v1-atom-ledger.contract.json");
  const ledgerPath = path.join(artifactDir, "gate59-alpha-v1-atom-ledger.rows.jsonl");
  const summaryPath = path.join(artifactDir, "gate59-alpha-v1-atom-ledger.summary.json");
  const receiptPath = path.join(artifactDir, "gate59-alpha-v1-atom-ledger.receipt.json");
  const hashPath = path.join(artifactDir, "gate59-alpha-v1-atom-ledger.hash.json");
  const shaPath = path.join(artifactDir, "gate59-alpha-v1-atom-ledger.sha256.txt");

  const [matrixRows, allDecisionRows, matrixHash, decisionsHash] = await Promise.all([
    readJsonl<MatrixRow>(matrixRowsPath),
    readJsonl<Gate58CDecisionRow>(gate58cDecisionsPath),
    hashFile(matrixRowsPath),
    hashFile(gate58cDecisionsPath),
  ]);

  const candidateRows = allDecisionRows.filter((row) => row.candidate_id === SOURCE_CANDIDATE_ID);
  const candidateByKey = new Map(candidateRows.map((row) => [rowKey(row), row]));
  const ledgerRows: AtomLedgerRow[] = [];
  for (const matrixRow of matrixRows) {
    const key = rowKey(matrixRow);
    const decision = candidateByKey.get(key);
    if (!decision) {
      continue;
    }
    const expected = expectedFinalSide(matrixRow);
    if (decision.final_side !== expected) {
      throw new Error(`Gate 58C decision mismatch for ${key}: expected ${expected}, got ${decision.final_side}`);
    }
    ledgerRows.push(buildAtomRow(matrixRow, decision, matrixHash, decisionsHash));
  }
  ledgerRows.sort((a, b) => a.row_key.localeCompare(b.row_key));

  const validation = buildValidation(matrixRows, candidateRows, ledgerRows);
  if (!validation.alpha_row_count_ok || !validation.forced_28_ok || !validation.join_ok || !validation.lineage_ok || !validation.rule_ok) {
    throw new Error(`Gate 59 validation failed: ${JSON.stringify(validation, null, 2)}`);
  }

  const contractPayload = buildContractPayload({ matrixHash, decisionsHash });
  const contractText = `${JSON.stringify(contractPayload, null, 2)}\n`;
  const contractHash = sha256Text(contractText);
  const ledgerText = `${ledgerRows.map((row) => JSON.stringify(row)).join("\n")}\n`;
  const ledgerHash = sha256Text(ledgerText);
  const aggregate = aggregateLedger(ledgerRows);
  const dirty = dirtyTreeStatus();
  const summaryPayload = {
    gate_id: GATE_ID,
    status: "PASS_ALPHA_V1_ATOM_LEDGER_CONTRACT_FROZEN",
    generated_at_utc: generatedAt,
    alpha_id: ALPHA_ID,
    schema_version: SCHEMA_VERSION,
    validation,
    aggregate,
    source_artifact_hashes: {
      gate58_matrix_rows_sha256: matrixHash,
      gate58c_decisions_jsonl_sha256: decisionsHash,
    },
    output_artifact_hashes: {
      contract_json_sha256: contractHash,
      atom_ledger_jsonl_sha256: ledgerHash,
    },
  };
  const summaryText = `${JSON.stringify(summaryPayload, null, 2)}\n`;
  const summaryHash = sha256Text(summaryText);
  const receiptPayload = {
    gate_id: GATE_ID,
    status: "PASS_ALPHA_V1_ATOM_LEDGER_CONTRACT_FROZEN",
    generated_at_utc: generatedAt,
    git_commit: currentGitCommit(),
    dirty_tree: dirty,
    command: "npm run engine:gate59:alpha-v1-atom-ledger",
    validation,
    alpha_id: ALPHA_ID,
    schema_version: SCHEMA_VERSION,
    artifact_hashes: {
      gate58_matrix_rows_sha256: matrixHash,
      gate58c_decisions_jsonl_sha256: decisionsHash,
      contract_json_sha256: contractHash,
      atom_ledger_jsonl_sha256: ledgerHash,
      summary_json_sha256: summaryHash,
    },
    stop_line:
      "Stop here. Gate 59 freezes the Alpha v1 atom ledger contract only; no Regime, risk, execution, MT5/live, app work, or cleanup.",
  };
  const receiptText = `${JSON.stringify(receiptPayload, null, 2)}\n`;
  const receiptHash = sha256Text(receiptText);
  const reportText = buildReport({
    generatedAt,
    validation,
    aggregate,
    contractPath: toRepoRelative(contractPath),
    ledgerPath: toRepoRelative(ledgerPath),
    summaryPath: toRepoRelative(summaryPath),
    receiptPath: toRepoRelative(receiptPath),
    hashPath: toRepoRelative(hashPath),
    shaPath: toRepoRelative(shaPath),
    contractHash,
    ledgerHash,
    summaryHash,
    receiptHash,
    verdict: "PASS_ALPHA_V1_ATOM_LEDGER_CONTRACT_FROZEN",
  });
  const reportHash = sha256Text(reportText);
  const hashPayload = {
    gate_id: GATE_ID,
    generated_at_utc: generatedAt,
    gate58_matrix_rows_sha256: matrixHash,
    gate58c_decisions_jsonl_sha256: decisionsHash,
    contract_json_sha256: contractHash,
    atom_ledger_jsonl_sha256: ledgerHash,
    summary_json_sha256: summaryHash,
    receipt_json_sha256: receiptHash,
    report_text_sha256: reportHash,
    combined_hash: sha256Stable({
      matrix_rows: matrixHash,
      gate58c_decisions: decisionsHash,
      contract_json: contractHash,
      atom_ledger_jsonl: ledgerHash,
      summary_json: summaryHash,
      receipt_json: receiptHash,
      report_text: reportHash,
    }),
  };
  const hashText = `${JSON.stringify(hashPayload, null, 2)}\n`;
  const hashHash = sha256Text(hashText);
  const shaText = [
    "# Gate 59 Alpha v1 atom ledger identity",
    "",
    `${matrixHash}  ${toRepoRelative(matrixRowsPath)}`,
    `${decisionsHash}  ${toRepoRelative(gate58cDecisionsPath)}`,
    `${contractHash}  ${toRepoRelative(contractPath)}`,
    `${ledgerHash}  ${toRepoRelative(ledgerPath)}`,
    `${summaryHash}  ${toRepoRelative(summaryPath)}`,
    `${receiptHash}  ${toRepoRelative(receiptPath)}`,
    `${hashHash}  ${toRepoRelative(hashPath)}`,
    `${reportHash}  ${toRepoRelative(reportPath)}.report-text`,
    "",
    `combined_hash ${hashPayload.combined_hash}`,
    "rebuild_command npm run engine:gate59:alpha-v1-atom-ledger",
    "",
  ].join("\n");

  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(contractPath, contractText, "utf8");
  await writeFile(ledgerPath, ledgerText, "utf8");
  await writeFile(summaryPath, summaryText, "utf8");
  await writeFile(receiptPath, receiptText, "utf8");
  await writeFile(hashPath, hashText, "utf8");
  await writeFile(reportPath, reportText, "utf8");
  await writeFile(shaPath, shaText, "utf8");

  console.log(`Gate 59 atom ledger rows: ${ledgerRows.length}`);
  console.log(`Gate 59 full weeks: ${validation.full_weeks_count}`);
  console.log(`Verdict: PASS_ALPHA_V1_ATOM_LEDGER_CONTRACT_FROZEN`);
  console.log(`Contract JSON SHA-256: ${contractHash}`);
  console.log(`Atom ledger JSONL SHA-256: ${ledgerHash}`);
  console.log(`Report hash: ${reportHash}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
