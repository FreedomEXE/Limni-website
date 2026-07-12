import path from "node:path";

import { sha256Stable, sha256Text } from "@engine/research/hash";

import {
  DEFAULT_GATE64C_DIR,
  DEFAULT_GATE65C_DIR,
  DEFAULT_GATE65D_DIR,
  DEFAULT_GATE65E_DIR,
  EXPECTED_ROWS,
  EXPECTED_SYMBOLS_PER_WEEK,
  EXPECTED_WEEKS,
  AlphaLedgerRow,
  AtomPolicyLedgerRow,
  CandidateContract,
  CandidateSummary,
  Decision,
  Direction,
  Gate64cCandidateRow,
  ScenarioMemoryRow,
  countBy,
  directionFromSide,
  finalAlgorithmUse,
  loadAlphaRows,
  loadGate64cRows,
  policyRowsByAlpha,
  rankCandidateRows,
  readJson,
  readJsonl,
  round,
  scoreCandidate,
  sideFromDirection,
} from "./gate65-utils";

export const GATE67_DATE = "2026-06-28";
export const GATE67_SCOPE = "Gate 67: final-forced28-algorithm-preflight";

export const DEFAULT_GATE67A_DIR = "docs/research/gates/gate67a/artifacts/gate67a-cell-opinion-packet-contract";
export const DEFAULT_GATE67B_DIR = "docs/research/gates/gate67b/artifacts/gate67b-final-forced28-candidate-contract";
export const DEFAULT_GATE67C_DIR = "docs/research/gates/gate67c/artifacts/gate67c-final-forced28-test-matrix";
export const DEFAULT_GATE67D_DIR = "docs/research/gates/gate67d/artifacts/gate67d-architecture-lock-readiness-review";
export const DEFAULT_GATE67E_DIR = "docs/research/gates/gate67e/artifacts/gate67e-review-packet-completeness";
export const DEFAULT_GATE66B_DIR = "docs/research/gates/gate66b/artifacts/gate66b-brain-architecture-contract-v3";

export type CellId = "cot" | "strength" | "regime";
export type OpinionDirection = Direction | "ABSTAIN";
export type CellOpinionRole = "ANCHOR" | "CONFIRM" | "WARNING" | "TIE_BREAKER" | "CONTEXT" | "ABSTAIN";
export type CellOpinionConfidence = "LOW" | "MEDIUM" | "HIGH";
export type CellOpinionQualityState = "CLEAN" | "CAUTION" | "DEGRADED" | "FAIL_CLOSED";

export type CellOpinionPacket = {
  row_key: string;
  alpha_row_key: string;
  week_open_utc: string;
  year: number;
  symbol: string;
  cell_id: CellId;
  primary_direction: OpinionDirection;
  role: CellOpinionRole;
  confidence: CellOpinionConfidence;
  quality_state: CellOpinionQualityState;
  direct_vote_allowed: boolean;
  warning_active: boolean;
  confirmation_target?: string;
  source_atom_ids: string[];
  reason_codes: string[];
  content_hash: string;
};

export type ScenarioGroupSummary = {
  grouping_key: string;
  group_key: string;
  support_count: number;
  weeks_covered: number;
  years_covered: number;
  concentration?: {
    top_pair?: { symbol: string; rows: number; share: number | null } | null;
    top_week?: { week_open_utc: string; rows: number; share: number | null } | null;
    top_year?: { year: string; rows: number; share: number | null } | null;
  };
  low_support_warning: boolean;
};

export type Gate67Inputs = {
  alphaRows: AlphaLedgerRow[];
  policyRows: AtomPolicyLedgerRow[];
  scenarioRows: ScenarioMemoryRow[];
  scenarioGroups: ScenarioGroupSummary[];
  gate64cRows: Gate64cCandidateRow[];
  gate65eRows: CandidateSummary[];
  architectureContract: Record<string, unknown>;
};

export type FinalCandidateId =
  | "candidate_a_macro_anchor_conservative"
  | "candidate_b_macro_anchor_with_cot_warning"
  | "candidate_c_scenario_memory_guarded";

export type Gate67CandidateContract = CandidateContract & {
  candidate_id: FinalCandidateId;
  candidate_label: string;
  final_algorithm_name: null;
  final_algorithm_status: "candidate_test_only_unnamed";
  no_optimized_thresholds: true;
  no_learned_weights: true;
  no_pair_or_date_exclusions: true;
  no_final_promotion: true;
};

export type Gate67Decision = Decision & {
  reason_codes: string[];
  participating_cells: CellId[];
  warning_active: boolean;
  fallback_used: boolean;
  veto_used: boolean;
};

export type Gate67TestRow = {
  row_key: string;
  candidate_id: FinalCandidateId;
  week_open_utc: string;
  year: number;
  symbol: string;
  selected_direction: Direction;
  selected_side: "LONG" | "SHORT";
  adr_grid_adr: number;
  weekly_hold_adr: number;
  participating_cells: CellId[];
  reason_codes: string[];
  warning_active: boolean;
  fallback_used: boolean;
  veto_used: boolean;
  cell_roles: Record<CellId, CellOpinionRole>;
  cell_quality_states: Record<CellId, CellOpinionQualityState>;
  scenario_group_key: string | null;
  decision_signature_component: string;
  content_hash: string;
};

export type Gate67ScoredCandidate = CandidateSummary & {
  candidate_id: FinalCandidateId;
  warning_rows: number;
  fallback_rows: number;
  veto_rows: number;
  reason_code_counts: Record<string, number>;
  participating_cell_counts: Record<string, number>;
  cell_role_counts: Record<string, number>;
  cell_quality_counts: Record<string, number>;
  source_quality_exposure: Record<string, number>;
  decision_rows: Gate67TestRow[];
};

export function alphaDirection(row: AlphaLedgerRow): Direction {
  return directionFromSide(row.arbitration.final_side);
}

export function toCellOpinionKey(alphaRowKey: string, cellId: CellId) {
  return `${alphaRowKey}|${cellId}`;
}

export function policyKey(alphaRowKey: string, atomId: string) {
  return `${alphaRowKey}|${atomId}`;
}

export function policyMap(policyRows: AtomPolicyLedgerRow[]) {
  return new Map(policyRows.map((row) => [policyKey(row.alpha_row_key, row.atom_id), row]));
}

export function scenarioMap(scenarioRows: ScenarioMemoryRow[]) {
  return new Map(scenarioRows.map((row) => [row.alpha_row_key, row]));
}

export function scenarioGroupMap(groups: ScenarioGroupSummary[]) {
  return new Map(groups.map((row) => [row.group_key, row]));
}

export async function loadGate67Inputs(options: {
  gate64cDir?: string;
  gate65cDir?: string;
  gate65dDir?: string;
  gate65eDir?: string;
  gate66bDir?: string;
} = {}): Promise<Gate67Inputs> {
  const gate65dDir = options.gate65dDir ?? DEFAULT_GATE65D_DIR;
  const scenarioGroupFile = await readJson<{
    grouping_summaries: { cell_agreement_state_key: ScenarioGroupSummary[] };
  }>(path.join(gate65dDir, "scenario-group-summary.json"));
  return {
    alphaRows: await loadAlphaRows(),
    policyRows: await readJsonl<AtomPolicyLedgerRow>(path.join(options.gate65cDir ?? DEFAULT_GATE65C_DIR, "atom-policy-ledger.rows.jsonl")),
    scenarioRows: await readJsonl<ScenarioMemoryRow>(path.join(gate65dDir, "scenario-memory.rows.jsonl")),
    scenarioGroups: scenarioGroupFile.grouping_summaries.cell_agreement_state_key,
    gate64cRows: await loadGate64cRows(options.gate64cDir ?? DEFAULT_GATE64C_DIR),
    gate65eRows: await readJsonl<CandidateSummary>(path.join(options.gate65eDir ?? DEFAULT_GATE65E_DIR, "brain-router-matrix.rows.jsonl")),
    architectureContract: await readJson<Record<string, unknown>>(path.join(options.gate66bDir ?? DEFAULT_GATE66B_DIR, "brain-architecture-v3.contract.json")),
  };
}

export function buildCellOpinionLedger(alphaRows: AlphaLedgerRow[], policyRows: AtomPolicyLedgerRow[], scenarioRows: ScenarioMemoryRow[]) {
  const policies = policyMap(policyRows);
  const scenarios = scenarioMap(scenarioRows);
  const rows: CellOpinionPacket[] = [];
  for (const alphaRow of alphaRows) {
    const scenario = scenarios.get(alphaRow.row_key);
    rows.push(cotOpinion(alphaRow, policies, scenario));
    rows.push(strengthOpinion(alphaRow, policies, scenario));
    rows.push(regimeOpinion(alphaRow, policies, scenario));
  }
  return rows;
}

function cotOpinion(alphaRow: AlphaLedgerRow, policies: Map<string, AtomPolicyLedgerRow>, scenario: ScenarioMemoryRow | undefined): CellOpinionPacket {
  const cot = policies.get(policyKey(alphaRow.row_key, "cot_side"));
  const rrp = policies.get(policyKey(alphaRow.row_key, "rrp_derived_inverse"));
  const direct = cot ? finalAlgorithmUse(cot) === "direct_vote" : false;
  const quality = opinionQuality([cot]);
  const direction = cot?.source_direction ?? "ABSTAIN";
  const contradictsRrp = direction !== "ABSTAIN" && rrp?.source_direction !== null && rrp?.source_direction !== undefined && direction !== rrp.source_direction;
  const role: CellOpinionRole = quality === "FAIL_CLOSED" ? "ABSTAIN" : direct && contradictsRrp ? "WARNING" : direct ? "CONFIRM" : quality === "CLEAN" ? "CONTEXT" : "WARNING";
  const confidence: CellOpinionConfidence = quality === "FAIL_CLOSED" || quality === "DEGRADED" ? "LOW" : direct ? "HIGH" : "MEDIUM";
  return opinionPacket(alphaRow, "cot", direction, role, confidence, quality, direct, role === "WARNING", "regime.rrp_derived_inverse", ["cot_side", "cot_spread_lifecycle_quality", scenario ? "scenario_memory_context" : "scenario_memory_missing"], [
    direct ? "COT_DIRECT_VOTE_ALLOWED_BY_POLICY" : "COT_CONFIRM_OR_CONTEXT_ONLY",
    contradictsRrp ? "COT_CONTRADICTS_RRP_ANCHOR" : "COT_DOES_NOT_CONTRADICT_RRP_ANCHOR",
    qualityReason(quality),
  ]);
}

function strengthOpinion(alphaRow: AlphaLedgerRow, policies: Map<string, AtomPolicyLedgerRow>, scenario: ScenarioMemoryRow | undefined): CellOpinionPacket {
  const strength = policies.get(policyKey(alphaRow.row_key, "strength_side"));
  const rrp = policies.get(policyKey(alphaRow.row_key, "rrp_derived_inverse"));
  const direct = strength ? finalAlgorithmUse(strength) === "direct_vote" : false;
  const quality = opinionQuality([strength]);
  const direction = strength?.source_direction ?? "ABSTAIN";
  const confirmsRrp = direction !== "ABSTAIN" && direction === rrp?.source_direction;
  const role: CellOpinionRole = quality === "FAIL_CLOSED" ? "ABSTAIN" : quality !== "CLEAN" ? "WARNING" : direct && !confirmsRrp ? "TIE_BREAKER" : confirmsRrp ? "CONFIRM" : "CONTEXT";
  const confidence: CellOpinionConfidence = quality === "FAIL_CLOSED" || quality === "DEGRADED" ? "LOW" : direct ? "HIGH" : "MEDIUM";
  return opinionPacket(alphaRow, "strength", direction, role, confidence, quality, direct, role === "WARNING", "regime.rrp_derived_inverse", ["strength_side", "strength_phase_lifecycle_quality", scenario ? "scenario_memory_context" : "scenario_memory_missing"], [
    direct ? "STRENGTH_DIRECT_VOTE_ALLOWED_BY_POLICY" : "STRENGTH_CONFIRM_OR_CONTEXT_ONLY",
    confirmsRrp ? "STRENGTH_CONFIRMS_RRP_ANCHOR" : "STRENGTH_DOES_NOT_CONFIRM_RRP_ANCHOR",
    qualityReason(quality),
  ]);
}

function regimeOpinion(alphaRow: AlphaLedgerRow, policies: Map<string, AtomPolicyLedgerRow>, scenario: ScenarioMemoryRow | undefined): CellOpinionPacket {
  const rrp = policies.get(policyKey(alphaRow.row_key, "rrp_derived_inverse"));
  const valuationReer = policies.get(policyKey(alphaRow.row_key, "valuation_gap_reer_deviation_inverse"));
  const valuationRelative = policies.get(policyKey(alphaRow.row_key, "valuation_gap_neer_reer_relative_inverse"));
  const bpr = policies.get(policyKey(alphaRow.row_key, "bpr_direction_quality"));
  const quality = opinionQuality([rrp, valuationReer, valuationRelative, bpr]);
  const direction = rrp?.source_direction ?? "ABSTAIN";
  const valuationConfirms = direction !== "ABSTAIN" && (direction === valuationReer?.source_direction || direction === valuationRelative?.source_direction);
  const direct = rrp ? finalAlgorithmUse(rrp) === "direct_vote" : false;
  const role: CellOpinionRole = quality === "FAIL_CLOSED" ? "ABSTAIN" : valuationConfirms ? "ANCHOR" : "CONTEXT";
  const confidence: CellOpinionConfidence = quality === "FAIL_CLOSED" || quality === "DEGRADED" ? "LOW" : valuationConfirms ? "HIGH" : "MEDIUM";
  return opinionPacket(alphaRow, "regime", direction, role, confidence, quality, direct, quality !== "CLEAN", undefined, ["rrp_derived_inverse", "valuation_gap_reer_deviation_inverse", "valuation_gap_neer_reer_relative_inverse", "bpr_direction_quality", scenario ? "scenario_memory_context" : "scenario_memory_missing"], [
    valuationConfirms ? "REGIME_RRP_CONFIRMED_BY_VALUATION" : "REGIME_RRP_NOT_CONFIRMED_BY_VALUATION",
    bpr && finalAlgorithmUse(bpr) === "direct_vote" ? "BPR_DIRECT_VOTE_ALLOWED_BY_POLICY" : "BPR_CONTEXT_WARNING_OR_BLOCKED",
    qualityReason(quality),
  ]);
}

function opinionQuality(rows: Array<AtomPolicyLedgerRow | undefined>): CellOpinionQualityState {
  if (rows.some((row) => row?.fail_closed || row?.blocked)) return "FAIL_CLOSED";
  if (rows.some((row) => row?.degraded)) return "DEGRADED";
  if (rows.some((row) => row?.policy_role.includes("warning") || row?.allowed_final_algorithm_use === "quality_gate")) return "CAUTION";
  return "CLEAN";
}

function qualityReason(quality: CellOpinionQualityState) {
  return `QUALITY_${quality}`;
}

function opinionPacket(
  alphaRow: AlphaLedgerRow,
  cellId: CellId,
  direction: OpinionDirection,
  role: CellOpinionRole,
  confidence: CellOpinionConfidence,
  qualityState: CellOpinionQualityState,
  directVoteAllowed: boolean,
  warningActive: boolean,
  confirmationTarget: string | undefined,
  sourceAtomIds: string[],
  reasonCodes: string[],
): CellOpinionPacket {
  const base = {
    row_key: `${alphaRow.row_key}|${cellId}`,
    alpha_row_key: alphaRow.row_key,
    week_open_utc: alphaRow.week.week_open_utc,
    year: alphaRow.week.year,
    symbol: alphaRow.instrument.symbol,
    cell_id: cellId,
    primary_direction: direction,
    role,
    confidence,
    quality_state: qualityState,
    direct_vote_allowed: directVoteAllowed,
    warning_active: warningActive,
    ...(confirmationTarget ? { confirmation_target: confirmationTarget } : {}),
    source_atom_ids: sourceAtomIds,
    reason_codes: reasonCodes,
  };
  return { ...base, content_hash: sha256Stable(base) };
}

export function cellOpinionsByAlpha(opinions: CellOpinionPacket[]) {
  const map = new Map<string, Record<CellId, CellOpinionPacket>>();
  for (const opinion of opinions) {
    const current = map.get(opinion.alpha_row_key) ?? ({} as Record<CellId, CellOpinionPacket>);
    current[opinion.cell_id] = opinion;
    map.set(opinion.alpha_row_key, current);
  }
  return map;
}

export function buildFinalCandidateContracts(): Gate67CandidateContract[] {
  return [
    candidateContract(
      "candidate_a_macro_anchor_conservative",
      "Candidate A - Macro Anchor Conservative",
      ["rrp_derived_inverse", "valuation_gap_reer_deviation_inverse", "cot_side", "strength_side", "alpha_v1_final_side"],
      ["regime", "cot", "strength"],
      "Use RRP only when valuation_gap confirms; otherwise fallback to Alpha continuity. COT can warning-veto only in high-confidence contradiction; Strength confirms but cannot override.",
      4,
    ),
    candidateContract(
      "candidate_b_macro_anchor_with_cot_warning",
      "Candidate B - Macro Anchor with COT Warning",
      ["rrp_derived_inverse", "valuation_gap_reer_deviation_inverse", "cot_side", "strength_side", "alpha_v1_final_side"],
      ["regime", "cot", "strength"],
      "RRP is anchor. High-confidence COT crowding contradiction falls back to Alpha continuity. Strength confirms timing; valuation confirms macro but does not override alone.",
      3,
    ),
    candidateContract(
      "candidate_c_scenario_memory_guarded",
      "Candidate C - Scenario-Memory Guarded",
      ["rrp_derived_inverse", "valuation_gap_reer_deviation_inverse", "cot_side", "strength_side", "scenario_memory", "alpha_v1_final_side"],
      ["regime", "cot", "strength"],
      "RRP/valuation anchor with COT and Strength confirm/warn. Scenario memory can enable veto/fallback only for high-support, multi-year, non-concentrated groups; it cannot directly choose a new direction.",
      5,
    ),
  ];
}

function candidateContract(
  candidateId: FinalCandidateId,
  label: string,
  atomKeys: string[],
  sourceCells: CellId[],
  dependencyRule: string,
  complexity: number,
): Gate67CandidateContract {
  return {
    candidate_id: candidateId,
    family: "final_forced28_candidate",
    label,
    candidate_label: label,
    candidate_direction_kind: "candidate_composite_direction",
    atom_keys: atomKeys,
    source_cells: sourceCells,
    transform_version: `gate67_${candidateId}_v0`,
    tie_rule: "Fixed Brain arbitration fallback order; no optimized thresholds, learned weights, pair exclusions, or date exclusions.",
    dependency_rule: dependencyRule,
    complexity,
    discovery_only: true,
    final_algorithm_name: null,
    final_algorithm_status: "candidate_test_only_unnamed",
    no_optimized_thresholds: true,
    no_learned_weights: true,
    no_pair_or_date_exclusions: true,
    no_final_promotion: true,
  };
}

export function makeCandidateDecisionFn(
  candidateId: FinalCandidateId,
  opinionsByAlpha: Map<string, Record<CellId, CellOpinionPacket>>,
  policiesByAlpha: Map<string, AtomPolicyLedgerRow[]>,
  scenariosByAlpha: Map<string, ScenarioMemoryRow>,
  groupsByKey: Map<string, ScenarioGroupSummary>,
) {
  return (row: AlphaLedgerRow): Gate67Decision => {
    const opinions = opinionsByAlpha.get(row.row_key);
    if (!opinions) return gate67Decision(alphaDirection(row), "MISSING_CELL_OPINIONS_ALPHA_FALLBACK", ["MISSING_CELL_OPINIONS_ALPHA_FALLBACK"], [], false, true, false);
    const policies = policiesByAlpha.get(row.row_key) ?? [];
    const atom = (atomId: string) => policies.find((policy) => policy.atom_id === atomId);
    const atomDirection = (atomId: string, fallback: Direction) => atom(atomId)?.source_direction ?? fallback;
    const alpha = alphaDirection(row);
    const rrp = atomDirection("rrp_derived_inverse", alpha);
    const valuation = atomDirection("valuation_gap_reer_deviation_inverse", rrp);
    const cot = opinions.cot.primary_direction === "ABSTAIN" ? alpha : opinions.cot.primary_direction;
    const strength = opinions.strength.primary_direction === "ABSTAIN" ? alpha : opinions.strength.primary_direction;
    const valuationConfirms = rrp === valuation;
    const cotHighWarning = opinions.cot.direct_vote_allowed && opinions.cot.quality_state === "CLEAN" && cot !== rrp;
    const strengthConfirms = strength === rrp && opinions.strength.quality_state === "CLEAN";
    const scenario = scenariosByAlpha.get(row.row_key);
    const scenarioGroup = scenario ? groupsByKey.get(scenario.cell_agreement_state_key) : undefined;
    const robustScenario = scenarioGroupIsRobust(scenarioGroup);
    if (candidateId === "candidate_a_macro_anchor_conservative") {
      if (!valuationConfirms) {
        return gate67Decision(alpha, "A_ALPHA_FALLBACK_VALUATION_DID_NOT_CONFIRM_RRP", ["A_ALPHA_FALLBACK_VALUATION_DID_NOT_CONFIRM_RRP"], ["regime"], false, true, false, scenario?.cell_agreement_state_key);
      }
      if (cotHighWarning) {
        return gate67Decision(alpha, "A_COT_HIGH_CONF_WARNING_FALLBACK_ALPHA", ["A_COT_HIGH_CONF_WARNING_FALLBACK_ALPHA", strengthConfirms ? "STRENGTH_CONFIRMED_RRP" : "STRENGTH_DID_NOT_CONFIRM_RRP"], ["regime", "cot", "strength"], true, true, true, scenario?.cell_agreement_state_key);
      }
      return gate67Decision(rrp, "A_RRP_VALUATION_CONFIRMED_ANCHOR", ["A_RRP_VALUATION_CONFIRMED_ANCHOR", strengthConfirms ? "STRENGTH_CONFIRMED_RRP" : "STRENGTH_CONTEXT_ONLY"], ["regime", "cot", "strength"], false, false, false, scenario?.cell_agreement_state_key);
    }
    if (candidateId === "candidate_b_macro_anchor_with_cot_warning") {
      if (cotHighWarning) {
        return gate67Decision(alpha, "B_COT_HIGH_CONF_WARNING_FALLBACK_ALPHA", ["B_COT_HIGH_CONF_WARNING_FALLBACK_ALPHA", valuationConfirms ? "VALUATION_CONFIRMED_RRP" : "VALUATION_CONTEXT_ONLY"], ["regime", "cot", "strength"], true, true, true, scenario?.cell_agreement_state_key);
      }
      return gate67Decision(rrp, "B_RRP_ANCHOR_NO_COT_WARNING", ["B_RRP_ANCHOR_NO_COT_WARNING", valuationConfirms ? "VALUATION_CONFIRMED_RRP" : "VALUATION_CONTEXT_ONLY", strengthConfirms ? "STRENGTH_CONFIRMED_RRP" : "STRENGTH_CONTEXT_ONLY"], ["regime", "cot", "strength"], false, false, false, scenario?.cell_agreement_state_key);
    }
    const anchor = valuationConfirms ? rrp : alpha;
    const cotStrengthCleanAgreement = opinions.cot.quality_state === "CLEAN" && opinions.strength.quality_state === "CLEAN" && cot === strength;
    if (robustScenario && cotStrengthCleanAgreement && cot !== anchor) {
      const bothDirect = opinions.cot.direct_vote_allowed && opinions.strength.direct_vote_allowed;
      if (bothDirect) {
        return gate67Decision(cot, "C_SCENARIO_GUARDED_COT_STRENGTH_CLEAN_AGREEMENT_FALLBACK", ["C_SCENARIO_MEMORY_ROBUST_GUARD_ENABLED", "COT_STRENGTH_CLEAN_DIRECT_AGREEMENT", valuationConfirms ? "VALUATION_CONFIRMED_RRP" : "VALUATION_DID_NOT_CONFIRM_RRP"], ["regime", "cot", "strength"], true, true, true, scenario?.cell_agreement_state_key);
      }
      return gate67Decision(alpha, "C_SCENARIO_GUARDED_VETO_TO_ALPHA_FALLBACK", ["C_SCENARIO_MEMORY_ROBUST_GUARD_ENABLED", "COT_STRENGTH_AGREE_BUT_NOT_BOTH_DIRECT", valuationConfirms ? "VALUATION_CONFIRMED_RRP" : "VALUATION_DID_NOT_CONFIRM_RRP"], ["regime", "cot", "strength"], true, true, true, scenario?.cell_agreement_state_key);
    }
    return gate67Decision(anchor, valuationConfirms ? "C_RRP_VALUATION_ANCHOR_NO_SCENARIO_VETO" : "C_ALPHA_FALLBACK_NO_VALUATION_CONFIRMATION", [robustScenario ? "C_SCENARIO_MEMORY_ROBUST_NO_VETO" : "C_SCENARIO_MEMORY_LOW_SUPPORT_OR_CONCENTRATED", valuationConfirms ? "VALUATION_CONFIRMED_RRP" : "VALUATION_DID_NOT_CONFIRM_RRP"], ["regime", "cot", "strength"], false, !valuationConfirms, false, scenario?.cell_agreement_state_key);
  };
}

function gate67Decision(
  direction: Direction,
  directionSource: string,
  reasonCodes: string[],
  participatingCells: CellId[],
  warningActive: boolean,
  fallbackUsed: boolean,
  vetoUsed: boolean,
  scenarioGroupKey: string | null = null,
): Gate67Decision {
  return {
    direction,
    direction_source: directionSource,
    degraded: warningActive,
    degraded_reasons: warningActive ? reasonCodes : [],
    atom_votes: Object.fromEntries(participatingCells.map((cell) => [cell, direction])),
    policy_roles: Object.fromEntries(reasonCodes.map((reason) => [reason, 1])),
    scenario_group_key: scenarioGroupKey,
    reason_codes: reasonCodes,
    participating_cells: participatingCells,
    warning_active: warningActive,
    fallback_used: fallbackUsed,
    veto_used: vetoUsed,
  };
}

export function scenarioGroupIsRobust(group: ScenarioGroupSummary | undefined) {
  if (!group) return false;
  const pairShare = group.concentration?.top_pair?.share ?? 0;
  const weekShare = group.concentration?.top_week?.share ?? 0;
  const yearShare = group.concentration?.top_year?.share ?? 0;
  return group.support_count >= 112 && group.years_covered >= 3 && !group.low_support_warning && pairShare <= 0.35 && weekShare <= 0.2 && yearShare <= 0.5;
}

export function scoreGate67Candidates(
  alphaRows: AlphaLedgerRow[],
  opinions: CellOpinionPacket[],
  policyRows: AtomPolicyLedgerRow[],
  scenarioRows: ScenarioMemoryRow[],
  scenarioGroups: ScenarioGroupSummary[],
) {
  const contracts = buildFinalCandidateContracts();
  const opinionsByAlpha = cellOpinionsByAlpha(opinions);
  const policiesByAlpha = policyRowsByAlpha(policyRows);
  const scenariosByAlpha = scenarioMap(scenarioRows);
  const groupsByKey = scenarioGroupMap(scenarioGroups);
  return contracts.map((contract) => {
    const directionFor = makeCandidateDecisionFn(contract.candidate_id, opinionsByAlpha, policiesByAlpha, scenariosByAlpha, groupsByKey);
    const summary = scoreCandidate(contract, alphaRows, directionFor) as CandidateSummary & { candidate_id: FinalCandidateId };
    const decisionRows = buildGate67TestRows(contract.candidate_id, alphaRows, directionFor, opinionsByAlpha);
    return {
      ...summary,
      warning_rows: decisionRows.filter((row) => row.warning_active).length,
      fallback_rows: decisionRows.filter((row) => row.fallback_used).length,
      veto_rows: decisionRows.filter((row) => row.veto_used).length,
      reason_code_counts: countBy(decisionRows.flatMap((row) => row.reason_codes), (reason) => reason),
      participating_cell_counts: countBy(decisionRows.flatMap((row) => row.participating_cells), (cell) => cell),
      cell_role_counts: countBy(decisionRows.flatMap((row) => Object.entries(row.cell_roles).map(([cell, role]) => `${cell}|${role}`)), (key) => key),
      cell_quality_counts: countBy(decisionRows.flatMap((row) => Object.entries(row.cell_quality_states).map(([cell, quality]) => `${cell}|${quality}`)), (key) => key),
      source_quality_exposure: countBy(decisionRows.flatMap((row) => Object.values(row.cell_quality_states)), (quality) => quality),
      decision_rows: decisionRows,
    } satisfies Gate67ScoredCandidate;
  });
}

function buildGate67TestRows(
  candidateId: FinalCandidateId,
  alphaRows: AlphaLedgerRow[],
  directionFor: (row: AlphaLedgerRow) => Gate67Decision,
  opinionsByAlpha: Map<string, Record<CellId, CellOpinionPacket>>,
) {
  return alphaRows.map((row) => {
    const decision = directionFor(row);
    const side = sideFromDirection(decision.direction);
    const opinions = opinionsByAlpha.get(row.row_key);
    const base = {
      row_key: `${candidateId}|${row.row_key}`,
      candidate_id: candidateId,
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
      },
      scenario_group_key: decision.scenario_group_key ?? null,
      decision_signature_component: `${row.row_key}|${decision.direction}`,
    } satisfies Omit<Gate67TestRow, "content_hash">;
    return { ...base, content_hash: sha256Stable(base) };
  });
}

export function flattenDecisionRows(rows: Gate67ScoredCandidate[]) {
  return rows.flatMap((row) => row.decision_rows);
}

export function compactGate67Candidate(row: Gate67ScoredCandidate | CandidateSummary | Gate64cCandidateRow) {
  return {
    candidate_id: row.candidate_id,
    family: row.family,
    adr_grid: row.adr_grid,
    weekly_hold: row.weekly_hold,
    degraded_row_count: row.degraded_row_count,
    negative_adr_grid_years: row.negative_adr_grid_years,
    worst_adr_grid_year: row.worst_adr_grid_year,
    decision_signature_sha256: row.decision_signature_sha256,
  };
}

export function gate67ReferenceComparison(rows: Gate67ScoredCandidate[], gate64cRows: Gate64cCandidateRow[], gate65eRows: CandidateSummary[]) {
  const gate64cTopRdd = [...gate64cRows].sort((left, right) => (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999))[0];
  const gate64cZeroNegative = [...gate64cRows].filter((row) => row.negative_adr_grid_years === 0).sort((left, right) => (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999))[0] ?? null;
  const gate65eTopRdd = [...gate65eRows].sort((left, right) => (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999))[0];
  const gate65eRankings = rankCandidateRows(gate65eRows);
  const gate65eBestPf = gate65eRankings.best_adr_grid_pf[0];
  const gate65eZeroNegative = gate65eRankings.best_zero_negative_years[0] ?? null;
  const rrpInverse = gate64cRows.find((row) => row.candidate_id === "gate63_rrp_derived_inverse") ?? null;
  const alphaContinuity = gate64cRows.find((row) => row.candidate_id === "gate63_alpha_v1_frozen_final_side") ?? null;
  const signatures = new Map<string, { gate64c_candidate_id?: string; gate65e_candidate_id?: string }>();
  for (const row of gate64cRows) signatures.set(row.decision_signature_sha256, { ...(signatures.get(row.decision_signature_sha256) ?? {}), gate64c_candidate_id: row.candidate_id });
  for (const row of gate65eRows) signatures.set(row.decision_signature_sha256, { ...(signatures.get(row.decision_signature_sha256) ?? {}), gate65e_candidate_id: row.candidate_id });
  return {
    references: {
      gate64c_top_rdd: compactGate67Candidate(gate64cTopRdd),
      gate64c_zero_negative_year: gate64cZeroNegative ? compactGate67Candidate(gate64cZeroNegative) : null,
      gate65e_best_rdd_router: compactGate67Candidate(gate65eTopRdd),
      gate65e_highest_pf_router: compactGate67Candidate(gate65eBestPf),
      gate65e_zero_negative_year_router: gate65eZeroNegative ? compactGate67Candidate(gate65eZeroNegative) : null,
      rrp_inverse_continuity: rrpInverse ? compactGate67Candidate(rrpInverse) : null,
      alpha_v1_continuity: alphaContinuity ? compactGate67Candidate(alphaContinuity) : null,
    },
    signature_collapse: rows.map((row) => ({
      candidate_id: row.candidate_id,
      decision_signature_sha256: row.decision_signature_sha256,
      equivalent_gate64c_candidate_id: signatures.get(row.decision_signature_sha256)?.gate64c_candidate_id ?? null,
      equivalent_gate65e_candidate_id: signatures.get(row.decision_signature_sha256)?.gate65e_candidate_id ?? null,
      genuinely_new_vs_gate64_65: !signatures.has(row.decision_signature_sha256),
    })),
  };
}

export function candidateRankings(rows: Gate67ScoredCandidate[]) {
  const rankings = rankCandidateRows(rows);
  return {
    best_adr_grid_rdd: [...rows].sort((left, right) => (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999)),
    best_adr_grid_pf: rankings.best_adr_grid_pf,
    best_weekly_hold: [...rows].sort((left, right) => (right.weekly_hold.r_over_drawdown ?? -999) - (left.weekly_hold.r_over_drawdown ?? -999)),
    best_zero_negative_years: rankings.best_zero_negative_years,
    best_low_warning_fallback: [...rows].sort((left, right) => left.warning_rows + left.fallback_rows + left.veto_rows - (right.warning_rows + right.fallback_rows + right.veto_rows)),
  };
}

export function forced28Validation(rowCount: number, duplicateRows: number, weeks: number, fullWeeks: number) {
  return {
    rows: rowCount,
    expected_rows: EXPECTED_ROWS,
    weeks,
    expected_weeks: EXPECTED_WEEKS,
    expected_symbols_per_week: EXPECTED_SYMBOLS_PER_WEEK,
    full_weeks: fullWeeks,
    duplicate_week_symbol_rows: duplicateRows,
    forced28_preserved: rowCount === EXPECTED_ROWS && duplicateRows === 0 && weeks === EXPECTED_WEEKS && fullWeeks === EXPECTED_WEEKS,
  };
}

export function summarizeCellOpinions(rows: CellOpinionPacket[]) {
  const cells: CellId[] = ["cot", "strength", "regime"];
  return {
    total_rows: rows.length,
    expected_rows: EXPECTED_ROWS * cells.length,
    rows_by_cell: countBy(rows, (row) => row.cell_id),
    role_counts_by_cell: Object.entries(countBy(rows, (row) => `${row.cell_id}|${row.role}`)).map(([key, count]) => {
      const [cell_id, role] = key.split("|");
      return { cell_id, role, rows: count };
    }),
    quality_counts_by_cell: Object.entries(countBy(rows, (row) => `${row.cell_id}|${row.quality_state}`)).map(([key, count]) => {
      const [cell_id, quality_state] = key.split("|");
      return { cell_id, quality_state, rows: count };
    }),
    year_counts_by_cell_role: Object.entries(countBy(rows, (row) => `${row.year}|${row.cell_id}|${row.role}`)).map(([key, count]) => {
      const [year, cell_id, role] = key.split("|");
      return { year: Number(year), cell_id, role, rows: count };
    }),
    direct_vote_allowed_by_cell: Object.entries(countBy(rows.filter((row) => row.direct_vote_allowed), (row) => row.cell_id)).map(([cell_id, count]) => ({ cell_id, rows: count })),
    warning_active_by_cell: Object.entries(countBy(rows.filter((row) => row.warning_active), (row) => row.cell_id)).map(([cell_id, count]) => ({ cell_id, rows: count })),
  };
}

export function hashRows(rows: unknown[]) {
  return sha256Text(rows.map((row) => JSON.stringify(row)).join("\n"));
}

export function compactMetric(value: number | null) {
  return round(value, 6);
}
