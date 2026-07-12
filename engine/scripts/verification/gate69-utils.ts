import path from "node:path";

import { sha256Stable, sha256Text } from "@engine/research/hash";

import {
  AlphaLedgerRow,
  EXPECTED_ROWS,
  EXPECTED_SYMBOLS_PER_WEEK,
  EXPECTED_WEEKS,
  countBy,
  readJson,
  round,
} from "./gate65-utils";
import {
  FinalCandidateId,
  Gate67ScoredCandidate,
  Gate67TestRow,
  DEFAULT_GATE67C_DIR,
  buildCellOpinionLedger,
  flattenDecisionRows,
  loadGate67Inputs,
  scoreGate67Candidates,
} from "./gate67-utils";
import { DEFAULT_GATE68C_DIR, DEFAULT_GATE68D_DIR, DEFAULT_GATE68E_DIR } from "./gate68-utils";

export { DEFAULT_GATE67C_DIR, DEFAULT_GATE68C_DIR, DEFAULT_GATE68D_DIR, DEFAULT_GATE68E_DIR };

export const GATE69_DATE = "2026-06-28";
export const GATE69_SCOPE = "Gate 69: final-forced28-algorithm-lock-and-exit-risk-prep";

export const DEFAULT_GATE69A_DIR = "docs/research/gates/gate69a/artifacts/gate69a-final-forced28-lock-contract";
export const DEFAULT_GATE69B_DIR = "docs/research/gates/gate69b/artifacts/gate69b-final-forced28-ledger-replay";
export const DEFAULT_GATE69C_DIR = "docs/research/gates/gate69c/artifacts/gate69c-exit-risk-interface-and-no-drift";
export const DEFAULT_GATE69D_DIR = "docs/research/gates/gate69d/artifacts/gate69d-review-packet-completeness";

export const LOCKED_FINAL_ALGORITHM_ID = "gate69_locked_unnamed_forced28_candidate_b_default";
export const SHADOW_CANARY_ID = "gate69_shadow_candidate_c_canary";
export const LOCKED_DEFAULT_CANDIDATE_ID: FinalCandidateId = "candidate_b_macro_anchor_with_cot_warning";
export const SHADOW_CANARY_CANDIDATE_ID: FinalCandidateId = "candidate_c_scenario_memory_guarded";
export const REJECTED_SELECTOR_CANDIDATE_ID = "candidate_d_brain_mode_selector";
export const ARCHITECTURE_VERSION = "gate66_brain_cells_atoms_v3";
export const FINAL_ALGORITHM_NAME = null;

export type Gate68CapsuleSummary = {
  verdict: string;
  capsule: {
    capsule_id: string;
    capsule_sha256: string;
    decision_ledger_hash: string;
    outcome_scoring_hash: string;
  };
};

export type Gate68CapsuleManifest = {
  gate_id: string;
  capsule_id: string;
  capsule_sha256: string;
  architecture_version: string;
  final_algorithm_name: null;
  seven_year_decision_ledger_hash: string;
  seven_year_outcome_scoring_hash: string;
  input_hashes: Array<{ path: string; sha256: string }>;
  no_drift_contract_hash: string;
};

export type LockedForced28LedgerRow = {
  row_key: string;
  locked_algorithm_id: typeof LOCKED_FINAL_ALGORITHM_ID;
  final_algorithm_name: null;
  final_algorithm_status: "locked_unnamed_default_forced28";
  architecture_version: typeof ARCHITECTURE_VERSION;
  frozen_reference_capsule_id: string;
  frozen_reference_capsule_sha256: string;
  default_candidate_id: typeof LOCKED_DEFAULT_CANDIDATE_ID;
  shadow_candidate_id: typeof SHADOW_CANARY_CANDIDATE_ID;
  week_open_utc: string;
  year: number;
  symbol: string;
  base_currency: string | null;
  quote_currency: string | null;
  final_direction: Gate67TestRow["selected_direction"];
  final_side: Gate67TestRow["selected_side"];
  participating_cells: Gate67TestRow["participating_cells"];
  reason_codes: string[];
  warning_active: boolean;
  fallback_used: boolean;
  veto_used: boolean;
  cell_roles: Gate67TestRow["cell_roles"];
  cell_quality_states: Gate67TestRow["cell_quality_states"];
  scenario_group_key: string | null;
  source_decision_row_key: string;
  source_decision_content_hash: string;
  source_decision_signature_component: string;
  decision_hash: string;
};

export type ShadowCanaryLedgerRow = {
  row_key: string;
  shadow_canary_id: typeof SHADOW_CANARY_ID;
  shadow_candidate_id: typeof SHADOW_CANARY_CANDIDATE_ID;
  shadow_role: "frozen_shadow_canary_robustness_comparator";
  mutates_default_decision: false;
  architecture_version: typeof ARCHITECTURE_VERSION;
  frozen_reference_capsule_id: string;
  frozen_reference_capsule_sha256: string;
  week_open_utc: string;
  year: number;
  symbol: string;
  base_currency: string | null;
  quote_currency: string | null;
  shadow_direction: Gate67TestRow["selected_direction"];
  shadow_side: Gate67TestRow["selected_side"];
  participating_cells: Gate67TestRow["participating_cells"];
  reason_codes: string[];
  warning_active: boolean;
  fallback_used: boolean;
  veto_used: boolean;
  cell_roles: Gate67TestRow["cell_roles"];
  cell_quality_states: Gate67TestRow["cell_quality_states"];
  scenario_group_key: string | null;
  source_decision_row_key: string;
  source_decision_content_hash: string;
  source_decision_signature_component: string;
  decision_hash: string;
};

export function hashGate69Rows(rows: unknown[]) {
  return sha256Text(rows.map((row) => JSON.stringify(row)).join("\n"));
}

export async function loadGate68Capsule(gate68cDir = DEFAULT_GATE68C_DIR) {
  const summary = await readJson<Gate68CapsuleSummary>(path.join(gate68cDir, "gate68c-summary.json"));
  const manifest = await readJson<Gate68CapsuleManifest>(path.join(gate68cDir, "frozen-reference-capsule.manifest.json"));
  return { summary, manifest };
}

export function buildAlphaByWeekSymbol(alphaRows: AlphaLedgerRow[]) {
  return new Map(alphaRows.map((row) => [`${row.week.week_open_utc}|${row.instrument.symbol}`, row]));
}

export function selectCandidateRows(rows: Gate67TestRow[], candidateId: FinalCandidateId) {
  return rows.filter((row) => row.candidate_id === candidateId).sort(compareWeekSymbol);
}

export function buildLockedForced28LedgerRows(rows: Gate67TestRow[], alphaRows: AlphaLedgerRow[], capsule: Gate68CapsuleSummary["capsule"]) {
  const alphaByWeekSymbol = buildAlphaByWeekSymbol(alphaRows);
  return selectCandidateRows(rows, LOCKED_DEFAULT_CANDIDATE_ID).map((row) => {
    const alpha = alphaByWeekSymbol.get(`${row.week_open_utc}|${row.symbol}`);
    const base = {
      row_key: `${LOCKED_FINAL_ALGORITHM_ID}|${row.week_open_utc}|${row.symbol}`,
      locked_algorithm_id: LOCKED_FINAL_ALGORITHM_ID,
      final_algorithm_name: FINAL_ALGORITHM_NAME,
      final_algorithm_status: "locked_unnamed_default_forced28" as const,
      architecture_version: ARCHITECTURE_VERSION,
      frozen_reference_capsule_id: capsule.capsule_id,
      frozen_reference_capsule_sha256: capsule.capsule_sha256,
      default_candidate_id: LOCKED_DEFAULT_CANDIDATE_ID,
      shadow_candidate_id: SHADOW_CANARY_CANDIDATE_ID,
      week_open_utc: row.week_open_utc,
      year: row.year,
      symbol: row.symbol,
      base_currency: alpha?.instrument.base_currency ?? null,
      quote_currency: alpha?.instrument.quote_currency ?? null,
      final_direction: row.selected_direction,
      final_side: row.selected_side,
      participating_cells: row.participating_cells,
      reason_codes: row.reason_codes,
      warning_active: row.warning_active,
      fallback_used: row.fallback_used,
      veto_used: row.veto_used,
      cell_roles: row.cell_roles,
      cell_quality_states: row.cell_quality_states,
      scenario_group_key: row.scenario_group_key,
      source_decision_row_key: row.row_key,
      source_decision_content_hash: row.content_hash,
      source_decision_signature_component: row.decision_signature_component,
    };
    return { ...base, decision_hash: sha256Stable(base) } satisfies LockedForced28LedgerRow;
  });
}

export function buildShadowCanaryLedgerRows(rows: Gate67TestRow[], alphaRows: AlphaLedgerRow[], capsule: Gate68CapsuleSummary["capsule"]) {
  const alphaByWeekSymbol = buildAlphaByWeekSymbol(alphaRows);
  return selectCandidateRows(rows, SHADOW_CANARY_CANDIDATE_ID).map((row) => {
    const alpha = alphaByWeekSymbol.get(`${row.week_open_utc}|${row.symbol}`);
    const base = {
      row_key: `${SHADOW_CANARY_ID}|${row.week_open_utc}|${row.symbol}`,
      shadow_canary_id: SHADOW_CANARY_ID,
      shadow_candidate_id: SHADOW_CANARY_CANDIDATE_ID,
      shadow_role: "frozen_shadow_canary_robustness_comparator" as const,
      mutates_default_decision: false as const,
      architecture_version: ARCHITECTURE_VERSION,
      frozen_reference_capsule_id: capsule.capsule_id,
      frozen_reference_capsule_sha256: capsule.capsule_sha256,
      week_open_utc: row.week_open_utc,
      year: row.year,
      symbol: row.symbol,
      base_currency: alpha?.instrument.base_currency ?? null,
      quote_currency: alpha?.instrument.quote_currency ?? null,
      shadow_direction: row.selected_direction,
      shadow_side: row.selected_side,
      participating_cells: row.participating_cells,
      reason_codes: row.reason_codes,
      warning_active: row.warning_active,
      fallback_used: row.fallback_used,
      veto_used: row.veto_used,
      cell_roles: row.cell_roles,
      cell_quality_states: row.cell_quality_states,
      scenario_group_key: row.scenario_group_key,
      source_decision_row_key: row.row_key,
      source_decision_content_hash: row.content_hash,
      source_decision_signature_component: row.decision_signature_component,
    };
    return { ...base, decision_hash: sha256Stable(base) } satisfies ShadowCanaryLedgerRow;
  });
}

export async function recomputeGate67DecisionRows() {
  const inputs = await loadGate67Inputs();
  const opinions = buildCellOpinionLedger(inputs.alphaRows, inputs.policyRows, inputs.scenarioRows);
  const scored = scoreGate67Candidates(inputs.alphaRows, opinions, inputs.policyRows, inputs.scenarioRows, inputs.scenarioGroups);
  return {
    alphaRows: inputs.alphaRows,
    scored,
    decisionRows: flattenDecisionRows(scored),
  };
}

export function forced28Shape(rows: Array<{ week_open_utc: string; symbol: string }>) {
  const duplicateCount = rows.length - new Set(rows.map((row) => `${row.week_open_utc}|${row.symbol}`)).size;
  const symbolsByWeek = countBy(rows, (row) => row.week_open_utc);
  const weeks = Object.keys(symbolsByWeek).length;
  const fullWeeks = Object.values(symbolsByWeek).filter((count) => count === EXPECTED_SYMBOLS_PER_WEEK).length;
  return {
    rows: rows.length,
    expected_rows: EXPECTED_ROWS,
    weeks,
    expected_weeks: EXPECTED_WEEKS,
    expected_symbols_per_week: EXPECTED_SYMBOLS_PER_WEEK,
    full_weeks: fullWeeks,
    duplicate_week_symbol_rows: duplicateCount,
    forced28_preserved: rows.length === EXPECTED_ROWS && weeks === EXPECTED_WEEKS && fullWeeks === EXPECTED_WEEKS && duplicateCount === 0,
  };
}

export function ledgerShape(rows: Array<{ week_open_utc: string; symbol: string }>) {
  return forced28Shape(rows);
}

export function candidateSummaryById(rows: Gate67ScoredCandidate[], candidateId: FinalCandidateId) {
  const row = rows.find((entry) => entry.candidate_id === candidateId);
  if (!row) throw new Error(`Missing candidate summary: ${candidateId}`);
  return row;
}

export function compactGate69Metric(row: Gate67ScoredCandidate) {
  return {
    candidate_id: row.candidate_id,
    adr_grid: row.adr_grid,
    weekly_hold: row.weekly_hold,
    negative_adr_grid_years: row.negative_adr_grid_years,
    worst_adr_grid_year: row.worst_adr_grid_year,
    degraded_row_count: row.degraded_row_count,
    decision_signature_sha256: row.decision_signature_sha256,
  };
}

export function compareWeekSymbol(left: { week_open_utc: string; symbol: string }, right: { week_open_utc: string; symbol: string }) {
  if (left.week_open_utc !== right.week_open_utc) return left.week_open_utc.localeCompare(right.week_open_utc);
  return left.symbol.localeCompare(right.symbol);
}

export function metricDelta(left: Gate67ScoredCandidate, right: Gate67ScoredCandidate) {
  return {
    adr_grid_adr_delta: round((left.adr_grid.adr_sum ?? 0) - (right.adr_grid.adr_sum ?? 0)),
    adr_grid_rdd_delta: round((left.adr_grid.r_over_drawdown ?? 0) - (right.adr_grid.r_over_drawdown ?? 0)),
    adr_grid_pf_delta: round((left.adr_grid.row_pf ?? 0) - (right.adr_grid.row_pf ?? 0)),
    weekly_hold_adr_delta: round((left.weekly_hold.adr_sum ?? 0) - (right.weekly_hold.adr_sum ?? 0)),
    weekly_hold_rdd_delta: round((left.weekly_hold.r_over_drawdown ?? 0) - (right.weekly_hold.r_over_drawdown ?? 0)),
    weekly_hold_pf_delta: round((left.weekly_hold.row_pf ?? 0) - (right.weekly_hold.row_pf ?? 0)),
    negative_adr_grid_year_delta: left.negative_adr_grid_years - right.negative_adr_grid_years,
  };
}
