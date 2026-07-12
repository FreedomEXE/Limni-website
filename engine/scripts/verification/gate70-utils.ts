import path from "node:path";

import { readJson } from "./gate65-utils";
import {
  ARCHITECTURE_VERSION,
  DEFAULT_GATE69A_DIR,
  DEFAULT_GATE69B_DIR,
  DEFAULT_GATE69C_DIR,
  DEFAULT_GATE69D_DIR,
  LOCKED_DEFAULT_CANDIDATE_ID,
  LOCKED_FINAL_ALGORITHM_ID,
  SHADOW_CANARY_CANDIDATE_ID,
  SHADOW_CANARY_ID,
} from "./gate69-utils";

export const GATE70_DATE = "2026-06-28";
export const GATE70_SCOPE = "Gate 70: exit-risk-interface-preflight";

export const DEFAULT_GATE70A_DIR = "docs/research/gates/gate70a/artifacts/gate70a-locked-brain-input-preflight";
export const DEFAULT_GATE70B_DIR = "docs/research/gates/gate70b/artifacts/gate70b-exit-expression-interface-preflight";
export const DEFAULT_GATE70C_DIR = "docs/research/gates/gate70c/artifacts/gate70c-risk-portfolio-expression-preflight";
export const DEFAULT_GATE70D_DIR = "docs/research/gates/gate70d/artifacts/gate70d-review-packet-completeness";

export { ARCHITECTURE_VERSION, DEFAULT_GATE69A_DIR, DEFAULT_GATE69B_DIR, DEFAULT_GATE69C_DIR, DEFAULT_GATE69D_DIR };
export { LOCKED_DEFAULT_CANDIDATE_ID, LOCKED_FINAL_ALGORITHM_ID, SHADOW_CANARY_CANDIDATE_ID, SHADOW_CANARY_ID };

export type Gate69aSummary = {
  verdict: string;
  lock_contract: {
    locked_algorithm_id: string;
    final_algorithm_name: null;
    default_candidate_id: string;
    shadow_candidate_id: string;
    shadow_canary_id: string;
    frozen_reference_capsule_id: string;
    frozen_reference_capsule_sha256: string;
    no_mode_selector: boolean;
    no_risk_or_exit_logic_started: boolean;
  };
  validation: {
    candidate_d_rejected_for_lock: boolean;
    new_candidate_added: boolean;
    risk_exits_started: boolean;
    adaptive_learning_started: boolean;
  };
};

export type Gate69bSummary = {
  verdict: string;
  ledger_hashes: {
    final_ledger_hash: string;
    shadow_ledger_hash: string;
  };
  validation: {
    final_ledger_shape: { rows: number; weeks: number; expected_symbols_per_week: number; duplicate_week_symbol_rows: number; forced28_preserved: boolean };
    shadow_ledger_shape: { rows: number; weeks: number; expected_symbols_per_week: number; duplicate_week_symbol_rows: number; forced28_preserved: boolean };
    replay_deterministic: boolean;
    final_ledger_bound_to_gate68_capsule: boolean;
    shadow_ledger_bound_to_gate68_capsule: boolean;
    output_ledgers_include_outcomes: boolean;
    risk_exits_started: boolean;
    adaptive_learning_started: boolean;
  };
};

export type Gate69cSummary = {
  verdict: string;
  interface_summary: {
    locked_algorithm_id: string;
    final_algorithm_name: null;
    default_candidate_id: string;
    shadow_candidate_id: string;
    frozen_reference_capsule_id: string;
    final_ledger_hash: string;
    shadow_ledger_hash: string;
    risk_can_reduce_trade_expression_later: boolean;
    risk_can_mutate_brain_truth: boolean;
  };
  validation: {
    replay_deterministic: boolean;
    output_ledgers_include_outcomes: boolean;
    drift_monitor_can_change_decisions: boolean;
    drift_monitor_can_update_rules: boolean;
    drift_monitor_can_select_better_candidate: boolean;
    risk_exits_execution_fields_mixed_into_brain_truth: boolean;
    forbidden_risk_execution_schema_fields_found: number;
    exits_risk_started: boolean;
    adaptive_learning_started: boolean;
  };
};

export type Gate69dSummary = {
  verdict: string;
  validation: {
    required_commands_present: boolean;
    missing_commands: string[];
    missing_artifact_paths: string[];
    new_research_after_gate69c: boolean;
    exits_risk_started: boolean;
  };
};

export async function loadGate69Closeout(options: {
  gate69aDir?: string;
  gate69bDir?: string;
  gate69cDir?: string;
  gate69dDir?: string;
} = {}) {
  return {
    gate69a: await readJson<Gate69aSummary>(path.join(options.gate69aDir ?? DEFAULT_GATE69A_DIR, "gate69a-summary.json")),
    gate69b: await readJson<Gate69bSummary>(path.join(options.gate69bDir ?? DEFAULT_GATE69B_DIR, "gate69b-summary.json")),
    gate69c: await readJson<Gate69cSummary>(path.join(options.gate69cDir ?? DEFAULT_GATE69C_DIR, "gate69c-summary.json")),
    gate69d: await readJson<Gate69dSummary>(path.join(options.gate69dDir ?? DEFAULT_GATE69D_DIR, "gate69d-summary.json")),
  };
}

export function requiredString() {
  return { type: "string", minLength: 1 };
}

export function baseNoMutationAssertions() {
  return {
    brain_truth_mutable_by_exits: false,
    brain_truth_mutable_by_risk: false,
    candidate_b_direction_mutable: false,
    candidate_c_shadow_can_promote_itself: false,
    candidate_d_reopen_allowed: false,
    candidate_e_allowed: false,
    learning_allowed: false,
    source_retuning_allowed: false,
    mt5_live_allowed: false,
  };
}

export function gate70PassGate69Inputs(gate69: Awaited<ReturnType<typeof loadGate69Closeout>>) {
  return (
    gate69.gate69a.verdict.startsWith("PASS_") &&
    gate69.gate69b.verdict.startsWith("PASS_") &&
    gate69.gate69c.verdict.startsWith("PASS_") &&
    gate69.gate69d.verdict.startsWith("PASS_") &&
    gate69.gate69a.lock_contract.default_candidate_id === LOCKED_DEFAULT_CANDIDATE_ID &&
    gate69.gate69a.lock_contract.shadow_candidate_id === SHADOW_CANARY_CANDIDATE_ID &&
    gate69.gate69a.lock_contract.locked_algorithm_id === LOCKED_FINAL_ALGORITHM_ID &&
    gate69.gate69b.validation.final_ledger_shape.forced28_preserved &&
    gate69.gate69b.validation.shadow_ledger_shape.forced28_preserved &&
    gate69.gate69b.validation.replay_deterministic &&
    gate69.gate69c.validation.exits_risk_started === false &&
    gate69.gate69c.validation.adaptive_learning_started === false &&
    gate69.gate69c.interface_summary.risk_can_mutate_brain_truth === false
  );
}
