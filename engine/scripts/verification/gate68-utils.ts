import path from "node:path";

import { sha256Stable, sha256Text } from "@engine/research/hash";

import {
  AlphaLedgerRow,
  AtomPolicyLedgerRow,
  CandidateContract,
  CandidateSummary,
  Direction,
  Gate64cCandidateRow,
  ScenarioMemoryRow,
  countBy,
  policyRowsByAlpha,
  rankCandidateRows,
  readJson,
  readJsonl,
  round,
  scoreCandidate,
  sideFromDirection,
} from "./gate65-utils";
import {
  CellId,
  CellOpinionPacket,
  CellOpinionQualityState,
  DEFAULT_GATE67A_DIR,
  DEFAULT_GATE67B_DIR,
  DEFAULT_GATE67C_DIR,
  DEFAULT_GATE67D_DIR,
  FinalCandidateId,
  Gate67Decision,
  Gate67ScoredCandidate,
  Gate67TestRow,
  ScenarioGroupSummary,
  buildCellOpinionLedger,
  buildFinalCandidateContracts,
  cellOpinionsByAlpha,
  compactGate67Candidate,
  flattenDecisionRows,
  gate67ReferenceComparison,
  loadGate67Inputs,
  makeCandidateDecisionFn,
  scenarioGroupIsRobust,
  scenarioGroupMap,
  scenarioMap,
  scoreGate67Candidates,
} from "./gate67-utils";

export const GATE68_DATE = "2026-06-28";
export const GATE68_SCOPE = "Gate 68: brain-mode-selector-and-frozen-reference-capsule";

export const DEFAULT_GATE68A_DIR = "docs/research/gates/gate68a/artifacts/gate68a-brain-mode-selector-contract";
export const DEFAULT_GATE68B_DIR = "docs/research/gates/gate68b/artifacts/gate68b-brain-mode-selector-test-matrix";
export const DEFAULT_GATE68C_DIR = "docs/research/gates/gate68c/artifacts/gate68c-frozen-seven-year-reference-capsule";
export const DEFAULT_GATE68D_DIR = "docs/research/gates/gate68d/artifacts/gate68d-forward-decision-receipt-and-drift-monitor";
export const DEFAULT_GATE68E_DIR = "docs/research/gates/gate68e/artifacts/gate68e-architecture-lock-readiness-review";
export const DEFAULT_GATE68F_DIR = "docs/research/gates/gate68f/artifacts/gate68f-review-packet-completeness";

export type BrainMode = "NORMAL" | "PROTECTION" | "CONSERVATIVE";
export type CandidateDId = "candidate_d_brain_mode_selector";
export type Gate68CandidateId = FinalCandidateId | CandidateDId;

export const CANDIDATE_D_ID: CandidateDId = "candidate_d_brain_mode_selector";

export const MODE_TO_CANDIDATE: Record<BrainMode, FinalCandidateId> = {
  NORMAL: "candidate_b_macro_anchor_with_cot_warning",
  PROTECTION: "candidate_c_scenario_memory_guarded",
  CONSERVATIVE: "candidate_a_macro_anchor_conservative",
};

export type Gate68BrainDecision = Gate67Decision & {
  selected_mode: BrainMode;
  selected_candidate_mode_source: FinalCandidateId;
  mode_reason_codes: string[];
  selector_reason_code: string;
  scenario_memory_used: boolean;
  source_quality_warning_active: boolean;
  conservative_mode_active: boolean;
  protection_mode_active: boolean;
  normal_mode_active: boolean;
};

export type Gate68TestRow = Omit<Gate67TestRow, "candidate_id" | "content_hash"> & {
  candidate_id: Gate68CandidateId;
  selected_mode: BrainMode;
  selected_candidate_mode_source: FinalCandidateId;
  mode_selector_applied: boolean;
  mode_reason_codes: string[];
  selector_reason_code: string;
  scenario_memory_used: boolean;
  source_quality_warning_active: boolean;
  conservative_mode_active: boolean;
  protection_mode_active: boolean;
  normal_mode_active: boolean;
  content_hash: string;
};

export type Gate68ScoredCandidate = (Gate67ScoredCandidate | CandidateSummary) & {
  candidate_id: Gate68CandidateId;
  mode_counts?: Record<string, number>;
  mode_reason_code_counts?: Record<string, number>;
  mode_counts_by_year?: Array<{ year: number; selected_mode: BrainMode; rows: number }>;
  mode_counts_by_pair?: Array<{ symbol: string; selected_mode: BrainMode; rows: number }>;
  scenario_memory_usage_counts?: Record<string, number>;
  decision_rows: Gate68TestRow[];
};

export function buildBrainModeSelectorContract() {
  return {
    gate_id: "Gate 68A: brain-mode-selector-contract",
    selector_id: CANDIDATE_D_ID,
    selector_label: "Candidate D - Brain Mode Selector",
    contract_version: "gate68_brain_mode_selector_v0",
    architecture_version: "gate66_brain_cells_atoms_v3",
    brain_contract: "Brain -> Cells -> Atoms",
    final_algorithm_name: null,
    final_algorithm_status: "candidate_test_only_unnamed",
    exactly_one_combined_selector: true,
    default_mode: "NORMAL" satisfies BrainMode,
    modes: [
      {
        mode: "NORMAL" satisfies BrainMode,
        behavior_candidate_id: MODE_TO_CANDIDATE.NORMAL,
        behavior_label: "Candidate B - Macro Anchor with COT Warning",
        purpose: "Default macro-anchor behavior with COT high-confidence warning/fallback inside the mode.",
      },
      {
        mode: "PROTECTION" satisfies BrainMode,
        behavior_candidate_id: MODE_TO_CANDIDATE.PROTECTION,
        behavior_label: "Candidate C - Scenario-Memory Guarded",
        purpose: "Use only when fixed scenario-memory and cell-state context says robust protection is required.",
      },
      {
        mode: "CONSERVATIVE" satisfies BrainMode,
        behavior_candidate_id: MODE_TO_CANDIDATE.CONSERVATIVE,
        behavior_label: "Candidate A - Macro Anchor Conservative",
        purpose: "Use when source quality, macro-anchor confirmation, or evidence clarity is degraded or ambiguous.",
      },
    ],
    selector_rules: [
      {
        rule_id: "SELECT_CONSERVATIVE_ON_DEGRADED_OR_AMBIGUOUS_EVIDENCE",
        priority: 1,
        selected_mode: "CONSERVATIVE" satisfies BrainMode,
        inputs_used: ["cell_quality", "cell_role", "warning_active", "source-quality warning flags"],
        description:
          "If any cell opinion is degraded or fail-closed, or the Regime cell is not an ANCHOR, use Candidate A conservative behavior. This is a source-quality and macro-anchor rule only.",
      },
      {
        rule_id: "SELECT_PROTECTION_ON_ROBUST_SCENARIO_GUARD",
        priority: 2,
        selected_mode: "PROTECTION" satisfies BrainMode,
        inputs_used: ["scenario support count", "scenario years covered", "scenario low-support flag", "scenario concentration flags", "COT vs Strength vs Regime agreement"],
        description:
          "If the already-defined Candidate C guard would activate from robust scenario memory and clean COT/Strength agreement against the anchor, use Candidate C protection behavior.",
      },
      {
        rule_id: "SELECT_NORMAL_DEFAULT",
        priority: 3,
        selected_mode: "NORMAL" satisfies BrainMode,
        inputs_used: ["default mode only", "COT warning remains inside Candidate B behavior"],
        description: "Otherwise use Candidate B normal behavior.",
      },
    ],
    allowed_mode_selection_inputs: [
      "cell role",
      "cell quality",
      "cell confidence",
      "direct_vote_allowed",
      "warning_active",
      "COT vs Regime agreement",
      "Strength vs Regime agreement",
      "valuation confirmation via Regime role",
      "scenario support count",
      "scenario years covered",
      "scenario low-support flag",
      "scenario concentration flags",
      "source-quality warning flags",
      "reason codes from cell opinions",
    ],
    forbidden_mode_selection_inputs: [
      "ADR Grid outcome",
      "Weekly Hold outcome",
      "future returns",
      "future data",
      "best historical candidate per week",
      "learned weights",
      "optimized thresholds",
      "pair exclusions",
      "date exclusions",
    ],
    no_adaptive_learning: true,
    no_self_modifying_model: true,
    no_rolling_retraining: true,
    no_optimized_thresholds: true,
    no_learned_weights: true,
    no_pair_or_date_exclusions: true,
    no_final_algorithm_name: true,
    no_final_promotion: true,
  };
}

export function buildBrainModeSelectorModeMap() {
  return {
    gate_id: "Gate 68A: brain-mode-selector-contract",
    selector_id: CANDIDATE_D_ID,
    mode_count: 3,
    modes: MODE_TO_CANDIDATE,
  };
}

export function buildBrainModeSelectorReasonCodeContract() {
  return {
    gate_id: "Gate 68A: brain-mode-selector-contract",
    contract_version: "gate68_brain_mode_selector_reason_codes_v0",
    selector_reason_codes: {
      SELECT_CONSERVATIVE_ON_DEGRADED_OR_AMBIGUOUS_EVIDENCE: "Candidate A conservative behavior selected by source quality or macro-anchor ambiguity.",
      SELECT_PROTECTION_ON_ROBUST_SCENARIO_GUARD: "Candidate C protection behavior selected by robust scenario-memory guard.",
      SELECT_NORMAL_DEFAULT: "Candidate B normal behavior selected by default.",
    },
    mode_reason_code_prefixes: {
      MODE_CONSERVATIVE: "Conservative mode selector diagnostics.",
      MODE_PROTECTION: "Protection mode selector diagnostics.",
      MODE_NORMAL: "Normal mode selector diagnostics.",
    },
    candidate_reason_codes_preserved: true,
    outcome_fields_allowed_in_reason_codes: false,
  };
}

export function buildBrainModeSelectorRulesMarkdown() {
  return [
    "# Gate 68A Brain Mode Selector Rules",
    "",
    "The final algorithm remains unnamed. Candidate D is a single deterministic selector over the three Gate 67 candidates.",
    "",
    "## Modes",
    "",
    "- `NORMAL` maps to `candidate_b_macro_anchor_with_cot_warning`.",
    "- `PROTECTION` maps to `candidate_c_scenario_memory_guarded`.",
    "- `CONSERVATIVE` maps to `candidate_a_macro_anchor_conservative`.",
    "",
    "## Priority",
    "",
    "1. Select `CONSERVATIVE` when source quality or macro-anchor evidence is degraded, fail-closed, mixed, or ambiguous.",
    "2. Select `PROTECTION` when the fixed Candidate C robust scenario guard activates from point-in-time state.",
    "3. Otherwise select `NORMAL`.",
    "",
    "## Fixed Boundary",
    "",
    "- Scenario memory cannot choose a new direction; it can only select `PROTECTION` or leave `NORMAL` safe.",
    "- Strength may confirm or warn; it cannot create a fourth mode.",
    "- COT high-confidence crowding contradiction remains inside `NORMAL` mode behavior.",
    "- Candidate A/B/C behavior is unchanged.",
    "- No outcomes, optimized thresholds, learned weights, pair exclusions, or date exclusions are mode-selection inputs.",
    "",
  ].join("\n");
}

export function buildCandidateDContract(): CandidateContract & {
  candidate_id: CandidateDId;
  final_algorithm_name: null;
  final_algorithm_status: "candidate_test_only_unnamed";
} {
  return {
    candidate_id: CANDIDATE_D_ID,
    family: "brain_mode_selector",
    label: "Candidate D - Brain Mode Selector",
    candidate_direction_kind: "candidate_composite_direction",
    atom_keys: ["rrp_derived_inverse", "valuation_gap_reer_deviation_inverse", "cot_side", "strength_side", "scenario_memory", "alpha_v1_final_side"],
    source_cells: ["regime", "cot", "strength"],
    transform_version: "gate68_brain_mode_selector_v0",
    tie_rule: "Fixed mode priority: conservative source-quality guard, protection scenario guard, else normal default.",
    dependency_rule: "Select NORMAL, PROTECTION, or CONSERVATIVE mode from point-in-time cell opinions and scenario-memory support only; then delegate unchanged behavior to Gate 67 Candidate B, C, or A.",
    complexity: 6,
    discovery_only: true,
    final_algorithm_name: null,
    final_algorithm_status: "candidate_test_only_unnamed",
  };
}

export function makeBrainModeSelectorDecisionFn(
  opinionsByAlpha: Map<string, Record<CellId, CellOpinionPacket>>,
  policyRows: AtomPolicyLedgerRow[],
  scenarioRows: ScenarioMemoryRow[],
  scenarioGroups: ScenarioGroupSummary[],
) {
  const policiesByAlpha = policyRowsByAlpha(policyRows);
  const scenariosByAlpha = scenarioMap(scenarioRows);
  const groupsByKey = scenarioGroupMap(scenarioGroups);
  const candidateA = makeCandidateDecisionFn(MODE_TO_CANDIDATE.CONSERVATIVE, opinionsByAlpha, policiesByAlpha, scenariosByAlpha, groupsByKey);
  const candidateB = makeCandidateDecisionFn(MODE_TO_CANDIDATE.NORMAL, opinionsByAlpha, policiesByAlpha, scenariosByAlpha, groupsByKey);
  const candidateC = makeCandidateDecisionFn(MODE_TO_CANDIDATE.PROTECTION, opinionsByAlpha, policiesByAlpha, scenariosByAlpha, groupsByKey);

  return (row: AlphaLedgerRow): Gate68BrainDecision => {
    const opinions = opinionsByAlpha.get(row.row_key);
    const conservative = candidateA(row);
    const normal = candidateB(row);
    const protection = candidateC(row);
    const modeSelection = selectBrainMode(row, opinions, protection, scenariosByAlpha, groupsByKey);
    const selected = modeSelection.selected_mode === "CONSERVATIVE" ? conservative : modeSelection.selected_mode === "PROTECTION" ? protection : normal;
    const selectedCandidate = MODE_TO_CANDIDATE[modeSelection.selected_mode];
    const reasonCodes = [...selected.reason_codes, ...modeSelection.mode_reason_codes];
    return {
      ...selected,
      selected_mode: modeSelection.selected_mode,
      selected_candidate_mode_source: selectedCandidate,
      selector_reason_code: modeSelection.selector_reason_code,
      reason_codes: reasonCodes,
      mode_reason_codes: modeSelection.mode_reason_codes,
      scenario_memory_used: modeSelection.scenario_memory_used,
      source_quality_warning_active: modeSelection.source_quality_warning_active,
      conservative_mode_active: modeSelection.selected_mode === "CONSERVATIVE",
      protection_mode_active: modeSelection.selected_mode === "PROTECTION",
      normal_mode_active: modeSelection.selected_mode === "NORMAL",
      policy_roles: { ...selected.policy_roles, [modeSelection.selector_reason_code]: 1 },
      degraded: selected.degraded || modeSelection.source_quality_warning_active || modeSelection.selected_mode !== "NORMAL",
      degraded_reasons: [...selected.degraded_reasons, ...modeSelection.mode_reason_codes],
    };
  };
}

function selectBrainMode(
  row: AlphaLedgerRow,
  opinions: Record<CellId, CellOpinionPacket> | undefined,
  protectionDecision: Gate67Decision,
  scenariosByAlpha: Map<string, ScenarioMemoryRow>,
  groupsByKey: Map<string, ScenarioGroupSummary>,
): {
  selected_mode: BrainMode;
  selector_reason_code: string;
  mode_reason_codes: string[];
  scenario_memory_used: boolean;
  source_quality_warning_active: boolean;
} {
  const scenario = scenariosByAlpha.get(row.row_key);
  const group = scenario ? groupsByKey.get(scenario.cell_agreement_state_key) : undefined;
  const robustScenarioGuard = protectionDecision.reason_codes.includes("C_SCENARIO_MEMORY_ROBUST_GUARD_ENABLED") && scenarioGroupIsRobust(group);
  if (!opinions) {
    return {
      selected_mode: "CONSERVATIVE",
      selector_reason_code: "SELECT_CONSERVATIVE_ON_DEGRADED_OR_AMBIGUOUS_EVIDENCE",
      mode_reason_codes: ["MODE_CONSERVATIVE_MISSING_CELL_OPINIONS"],
      scenario_memory_used: false,
      source_quality_warning_active: true,
    };
  }
  const qualityStates = [opinions.cot.quality_state, opinions.strength.quality_state, opinions.regime.quality_state];
  const degradedQuality = qualityStates.some((quality) => quality !== "CLEAN");
  const macroAnchorAmbiguous = opinions.regime.role !== "ANCHOR";
  if (degradedQuality || macroAnchorAmbiguous) {
    return {
      selected_mode: "CONSERVATIVE",
      selector_reason_code: "SELECT_CONSERVATIVE_ON_DEGRADED_OR_AMBIGUOUS_EVIDENCE",
      mode_reason_codes: [
        degradedQuality ? "MODE_CONSERVATIVE_CELL_QUALITY_NOT_CLEAN" : "MODE_CONSERVATIVE_CELL_QUALITY_CLEAN",
        macroAnchorAmbiguous ? "MODE_CONSERVATIVE_MACRO_ANCHOR_NOT_CLEAN" : "MODE_CONSERVATIVE_MACRO_ANCHOR_CLEAN",
        ...qualityStates.map((quality) => `MODE_CONSERVATIVE_QUALITY_${quality}`),
      ],
      scenario_memory_used: Boolean(scenario),
      source_quality_warning_active: degradedQuality || opinions.cot.warning_active || opinions.strength.warning_active || opinions.regime.warning_active,
    };
  }
  if (robustScenarioGuard) {
    return {
      selected_mode: "PROTECTION",
      selector_reason_code: "SELECT_PROTECTION_ON_ROBUST_SCENARIO_GUARD",
      mode_reason_codes: ["MODE_PROTECTION_SCENARIO_MEMORY_ROBUST_GUARD_ENABLED"],
      scenario_memory_used: true,
      source_quality_warning_active: false,
    };
  }
  return {
    selected_mode: "NORMAL",
    selector_reason_code: "SELECT_NORMAL_DEFAULT",
    mode_reason_codes: ["MODE_NORMAL_DEFAULT"],
    scenario_memory_used: Boolean(scenario),
    source_quality_warning_active: false,
  };
}

export async function loadGate68Inputs(options: Parameters<typeof loadGate67Inputs>[0] = {}) {
  return loadGate67Inputs(options);
}

export function scoreGate68Candidates(
  alphaRows: AlphaLedgerRow[],
  opinions: CellOpinionPacket[],
  policyRows: AtomPolicyLedgerRow[],
  scenarioRows: ScenarioMemoryRow[],
  scenarioGroups: ScenarioGroupSummary[],
) {
  const gate67Scored = scoreGate67Candidates(alphaRows, opinions, policyRows, scenarioRows, scenarioGroups);
  const opinionsByAlpha = cellOpinionsByAlpha(opinions);
  const directionFor = makeBrainModeSelectorDecisionFn(opinionsByAlpha, policyRows, scenarioRows, scenarioGroups);
  const candidateDContract = buildCandidateDContract();
  const candidateDScore = scoreCandidate(candidateDContract, alphaRows, directionFor) as CandidateSummary & { candidate_id: CandidateDId };
  const referenceRows = flattenDecisionRows(gate67Scored).map(referenceGate67RowToGate68Row);
  const candidateDRows = buildCandidateDRows(alphaRows, directionFor, opinionsByAlpha);
  const candidateD = {
    ...candidateDScore,
    warning_rows: candidateDRows.filter((row) => row.warning_active).length,
    fallback_rows: candidateDRows.filter((row) => row.fallback_used).length,
    veto_rows: candidateDRows.filter((row) => row.veto_used).length,
    reason_code_counts: countBy(candidateDRows.flatMap((row) => row.reason_codes), (reason) => reason),
    participating_cell_counts: countBy(candidateDRows.flatMap((row) => row.participating_cells), (cell) => cell),
    cell_role_counts: countBy(candidateDRows.flatMap((row) => Object.entries(row.cell_roles).map(([cell, role]) => `${cell}|${role}`)), (key) => key),
    cell_quality_counts: countBy(candidateDRows.flatMap((row) => Object.entries(row.cell_quality_states).map(([cell, quality]) => `${cell}|${quality}`)), (key) => key),
    source_quality_exposure: countBy(candidateDRows.flatMap((row) => Object.values(row.cell_quality_states)), (quality) => quality),
    mode_counts: countBy(candidateDRows, (row) => row.selected_mode),
    mode_reason_code_counts: countBy(candidateDRows.flatMap((row) => row.mode_reason_codes), (reason) => reason),
    mode_counts_by_year: countByModeYear(candidateDRows),
    mode_counts_by_pair: countByModePair(candidateDRows),
    scenario_memory_usage_counts: countBy(candidateDRows, (row) => (row.scenario_memory_used ? "scenario_memory_used" : "scenario_memory_not_used")),
    decision_rows: candidateDRows,
  } satisfies Gate68ScoredCandidate;
  const references = gate67Scored.map((row) => ({
    ...row,
    decision_rows: referenceRows.filter((decisionRow) => decisionRow.candidate_id === row.candidate_id),
  })) as Gate68ScoredCandidate[];
  return [...references, candidateD] as Gate68ScoredCandidate[];
}

function referenceGate67RowToGate68Row(row: Gate67TestRow): Gate68TestRow {
  const selectedMode = referenceModeForCandidate(row.candidate_id);
  const base = {
    ...row,
    selected_mode: selectedMode,
    selected_candidate_mode_source: row.candidate_id,
    mode_selector_applied: false,
    mode_reason_codes: [`REFERENCE_${selectedMode}_MODE`],
    selector_reason_code: `REFERENCE_${selectedMode}_MODE_SOURCE`,
    scenario_memory_used: row.scenario_group_key !== null,
    source_quality_warning_active: Object.values(row.cell_quality_states).some((quality) => quality !== "CLEAN"),
    conservative_mode_active: selectedMode === "CONSERVATIVE",
    protection_mode_active: selectedMode === "PROTECTION",
    normal_mode_active: selectedMode === "NORMAL",
  };
  return { ...base, content_hash: sha256Stable({ ...base, content_hash: undefined }) };
}

function referenceModeForCandidate(candidateId: FinalCandidateId): BrainMode {
  if (candidateId === MODE_TO_CANDIDATE.CONSERVATIVE) return "CONSERVATIVE";
  if (candidateId === MODE_TO_CANDIDATE.PROTECTION) return "PROTECTION";
  return "NORMAL";
}

function buildCandidateDRows(
  alphaRows: AlphaLedgerRow[],
  directionFor: (row: AlphaLedgerRow) => Gate68BrainDecision,
  opinionsByAlpha: Map<string, Record<CellId, CellOpinionPacket>>,
): Gate68TestRow[] {
  return alphaRows.map((row) => {
    const decision = directionFor(row);
    const side = sideFromDirection(decision.direction);
    const opinions = opinionsByAlpha.get(row.row_key);
    const base = {
      row_key: `${CANDIDATE_D_ID}|${row.row_key}`,
      candidate_id: CANDIDATE_D_ID,
      week_open_utc: row.week.week_open_utc,
      year: row.week.year,
      symbol: row.instrument.symbol,
      selected_direction: decision.direction,
      selected_side: side,
      adr_grid_adr: side === "LONG" ? row.outcomes.adr_grid.long : row.outcomes.adr_grid.short,
      weekly_hold_adr: side === "LONG" ? row.outcomes.weekly_hold.long : row.outcomes.weekly_hold.short,
      participating_cells: decision.participating_cells,
      reason_codes: decision.reason_codes,
      warning_active: decision.warning_active,
      fallback_used: decision.fallback_used,
      veto_used: decision.veto_used,
      cell_roles: {
        cot: opinions?.cot.role ?? "ABSTAIN",
        strength: opinions?.strength.role ?? "ABSTAIN",
        regime: opinions?.regime.role ?? "ABSTAIN",
      },
      cell_quality_states: {
        cot: opinions?.cot.quality_state ?? "FAIL_CLOSED",
        strength: opinions?.strength.quality_state ?? "FAIL_CLOSED",
        regime: opinions?.regime.quality_state ?? "FAIL_CLOSED",
      } satisfies Record<CellId, CellOpinionQualityState>,
      scenario_group_key: decision.scenario_group_key ?? null,
      decision_signature_component: `${row.row_key}|${decision.direction}`,
      selected_mode: decision.selected_mode,
      selected_candidate_mode_source: decision.selected_candidate_mode_source,
      mode_selector_applied: true,
      mode_reason_codes: decision.mode_reason_codes,
      selector_reason_code: decision.selector_reason_code,
      scenario_memory_used: decision.scenario_memory_used,
      source_quality_warning_active: decision.source_quality_warning_active,
      conservative_mode_active: decision.conservative_mode_active,
      protection_mode_active: decision.protection_mode_active,
      normal_mode_active: decision.normal_mode_active,
    } satisfies Omit<Gate68TestRow, "content_hash">;
    return { ...base, content_hash: sha256Stable(base) };
  });
}

function countByModeYear(rows: Gate68TestRow[]) {
  return Object.entries(countBy(rows, (row) => `${row.year}|${row.selected_mode}`)).map(([key, rows]) => {
    const [year, selected_mode] = key.split("|");
    return { year: Number(year), selected_mode: selected_mode as BrainMode, rows };
  });
}

function countByModePair(rows: Gate68TestRow[]) {
  return Object.entries(countBy(rows, (row) => `${row.symbol}|${row.selected_mode}`)).map(([key, rows]) => {
    const [symbol, selected_mode] = key.split("|");
    return { symbol, selected_mode: selected_mode as BrainMode, rows };
  });
}

export function flattenGate68DecisionRows(rows: Gate68ScoredCandidate[]) {
  return rows.flatMap((row) => row.decision_rows);
}

export function gate68ModeDiagnostics(rows: Gate68TestRow[]) {
  const candidateDRows = rows.filter((row) => row.candidate_id === CANDIDATE_D_ID);
  return {
    gate_id: "Gate 68B: brain-mode-selector-test-matrix",
    candidate_id: CANDIDATE_D_ID,
    selected_mode_counts: countBy(candidateDRows, (row) => row.selected_mode),
    mode_counts_by_year: countByModeYear(candidateDRows),
    mode_counts_by_pair: countByModePair(candidateDRows),
    selector_reason_code_counts: countBy(candidateDRows, (row) => row.selector_reason_code),
    mode_reason_code_counts: countBy(candidateDRows.flatMap((row) => row.mode_reason_codes), (reason) => reason),
    warning_counts: countBy(candidateDRows, (row) => (row.warning_active ? "warning_active" : "warning_inactive")),
    fallback_counts: countBy(candidateDRows, (row) => (row.fallback_used ? "fallback_used" : "fallback_not_used")),
    veto_counts: countBy(candidateDRows, (row) => (row.veto_used ? "veto_used" : "veto_not_used")),
    scenario_memory_usage_counts: countBy(candidateDRows, (row) => (row.scenario_memory_used ? "scenario_memory_used" : "scenario_memory_not_used")),
    cell_participation_counts: countBy(candidateDRows.flatMap((row) => row.participating_cells), (cell) => cell),
    source_quality_exposure: countBy(candidateDRows.flatMap((row) => Object.values(row.cell_quality_states)), (quality) => quality),
  };
}

export function gate68ReferenceComparison(rows: Gate68ScoredCandidate[], gate64cRows: Gate64cCandidateRow[], gate65eRows: CandidateSummary[]) {
  const gate67Rows = rows.filter((row) => row.candidate_id !== CANDIDATE_D_ID);
  const gate67Comparison = gate67ReferenceComparison(gate67Rows as Gate67ScoredCandidate[], gate64cRows, gate65eRows);
  const signatures = new Map<string, { gate64c_candidate_id?: string; gate65e_candidate_id?: string; gate67_candidate_id?: string }>();
  for (const row of gate64cRows) signatures.set(row.decision_signature_sha256, { ...(signatures.get(row.decision_signature_sha256) ?? {}), gate64c_candidate_id: row.candidate_id });
  for (const row of gate65eRows) signatures.set(row.decision_signature_sha256, { ...(signatures.get(row.decision_signature_sha256) ?? {}), gate65e_candidate_id: row.candidate_id });
  for (const row of gate67Rows) signatures.set(row.decision_signature_sha256, { ...(signatures.get(row.decision_signature_sha256) ?? {}), gate67_candidate_id: row.candidate_id });
  return {
    references: {
      ...gate67Comparison.references,
      gate67_candidate_a_reference: compactGate67Candidate(gate67Rows.find((row) => row.candidate_id === MODE_TO_CANDIDATE.CONSERVATIVE)!),
      gate67_candidate_b_reference: compactGate67Candidate(gate67Rows.find((row) => row.candidate_id === MODE_TO_CANDIDATE.NORMAL)!),
      gate67_candidate_c_reference: compactGate67Candidate(gate67Rows.find((row) => row.candidate_id === MODE_TO_CANDIDATE.PROTECTION)!),
    },
    signature_collapse: rows.map((row) => ({
      candidate_id: row.candidate_id,
      decision_signature_sha256: row.decision_signature_sha256,
      equivalent_gate64c_candidate_id: signatures.get(row.decision_signature_sha256)?.gate64c_candidate_id ?? null,
      equivalent_gate65e_candidate_id: signatures.get(row.decision_signature_sha256)?.gate65e_candidate_id ?? null,
      equivalent_gate67_candidate_id: row.candidate_id === CANDIDATE_D_ID ? signatures.get(row.decision_signature_sha256)?.gate67_candidate_id ?? null : row.candidate_id,
      genuinely_new_vs_gate64_65_67: !signatures.has(row.decision_signature_sha256),
    })),
  };
}

export function gate68CandidateRankings(rows: Gate68ScoredCandidate[]) {
  const rankings = rankCandidateRows(rows as CandidateSummary[]);
  return {
    best_adr_grid_rdd: [...rows].sort((left, right) => (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999)),
    best_adr_grid_pf: rankings.best_adr_grid_pf as Gate68ScoredCandidate[],
    best_weekly_hold: [...rows].sort((left, right) => (right.weekly_hold.r_over_drawdown ?? -999) - (left.weekly_hold.r_over_drawdown ?? -999)),
    best_zero_negative_years: rankings.best_zero_negative_years as Gate68ScoredCandidate[],
    best_low_warning_fallback: [...rows].sort((left, right) => (warningFallbackVeto(left) - warningFallbackVeto(right))),
  };
}

function warningFallbackVeto(row: Gate68ScoredCandidate) {
  return (row.warning_rows ?? 0) + (row.fallback_rows ?? 0) + (row.veto_rows ?? 0);
}

export function compactGate68Candidate(row: Gate68ScoredCandidate | CandidateSummary | Gate64cCandidateRow) {
  return {
    candidate_id: row.candidate_id,
    family: row.family,
    adr_grid: row.adr_grid,
    weekly_hold: row.weekly_hold,
    degraded_row_count: row.degraded_row_count,
    negative_adr_grid_years: row.negative_adr_grid_years,
    worst_adr_grid_year: row.worst_adr_grid_year,
    decision_signature_sha256: row.decision_signature_sha256,
    mode_counts: "mode_counts" in row ? row.mode_counts ?? null : null,
  };
}

export function hashGate68Rows(rows: unknown[]) {
  return sha256Text(rows.map((row) => JSON.stringify(row)).join("\n"));
}

export async function readGate68Summary<T>(artifactDir: string, fileName: string) {
  return readJson<T>(path.join(artifactDir, fileName));
}

export async function readGate68Rows<T>(artifactDir: string, fileName: string) {
  return readJsonl<T>(path.join(artifactDir, fileName));
}

export function gate68MetricDelta(left: CandidateSummary, right: CandidateSummary) {
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
