import path from "node:path";

import { readJson, readJsonl, round } from "./gate65-utils";
import { DEFAULT_GATE71B_DIR, DEFAULT_GATE71C_DIR, DEFAULT_GATE71D_DIR } from "./gate71-utils";

export const GATE72_DATE = "2026-06-28";
export const GATE72_SCOPE = "Gate 72: candidate-b-exit-matrix-review-shortlist";

export const DEFAULT_GATE72A_DIR = "docs/research/gates/gate72a/artifacts/gate72a-warehouse-manifest-binding-audit";
export const DEFAULT_GATE72B_DIR = "docs/research/gates/gate72b/artifacts/gate72b-matrix-ledger-sanity-review";
export const DEFAULT_GATE72C_DIR = "docs/research/gates/gate72c/artifacts/gate72c-exit-family-ranking-shortlist";
export const DEFAULT_GATE72D_DIR = "docs/research/gates/gate72d/artifacts/gate72d-review-packet-no-promotion";

export const DEFAULT_GATE71A_PROTOCOL_PATH = "docs/research/gates/gate71a/artifacts/gate71a-exit-testing-protocol-freeze/exit-testing-protocol-freeze.json";
export const DEFAULT_GATE71A_ENTRY_MODEL_PATH = "docs/research/gates/gate71a/artifacts/gate71a-exit-testing-protocol-freeze/clean-entry-exposure-model.json";
export const DEFAULT_GATE71A_LEGACY_AUDIT_PATH = "docs/research/gates/gate71a/artifacts/gate71a-exit-testing-protocol-freeze/legacy-adr-grid-coupling-audit.json";
export const DEFAULT_GATE71BM_DIR = "docs/research/gates/gate71b/artifacts/gate71bm-exit-path-materialization-warehouse";
export const DEFAULT_GATE71C_WEEKLY_ROWS_PATH = path.join(DEFAULT_GATE71C_DIR, "exit-baseline-matrix.weekly.rows.jsonl");
export const DEFAULT_GATE71C_CANDIDATE_SUMMARIES_PATH = path.join(DEFAULT_GATE71C_DIR, "exit-baseline-matrix.candidate-summaries.json");
export const DEFAULT_GATE71C_PREDECLARED_MATRIX_PATH = path.join(DEFAULT_GATE71C_DIR, "predeclared-exit-baseline-matrix.json");

export const WEEKLY_HOLD_CONTROL_ID = "CONTROL_WEEKLY_HOLD";
export const LEGACY_ADR_GRID_CONTROL_ID = "CONTROL_LEGACY_ADR_GRID";
export const PAIR_SILO_CONTROL_ID = "CONTROL_PAIR_SILO_1ADR_UNAVAILABLE";

export type Gate72Summary = {
  verdict: string;
  validation: Record<string, unknown>;
  artifacts: Record<string, string>;
};

export type Gate71Summary = {
  verdict: string;
  validation: Record<string, unknown>;
  warehouse?: Record<string, unknown>;
  diagnostic_summary?: Record<string, unknown>;
  artifacts: Record<string, string>;
};

export type Gate71Protocol = {
  protocol_version: string;
  objective: string;
  candidate_b_input: {
    locked_algorithm_id: string;
    default_candidate_id: string;
    candidate_b_ledger_hash: string;
    candidate_b_ledger_file_sha256: string;
    immutable_directional_truth: boolean;
    forced28_preserved: boolean;
  };
  candidate_c_shadow: {
    shadow_candidate_id: string;
    shadow_ledger_hash: string;
    monitoring_only: boolean;
    can_promote_or_override: boolean;
  };
  adr_normalization: {
    target_adr_pct: number;
    account_mapping: string;
    pair_contribution_formula: string;
  };
  price_path: {
    price_bundle_id: string;
    path_resolution: string;
    execution_window: string;
    entry_timestamp: string;
    close_timestamp: string;
    threshold_crossing_semantics: string;
  };
  artifact_policy: Record<string, unknown>;
};

export type CandidateSummary = {
  rule_id: string;
  rule_family: string;
  rule: Record<string, unknown>;
  weeks: number;
  unavailable_weeks: number;
  total_adr: number;
  average_adr_per_week: number;
  median_adr_per_week: number;
  profitable_weeks: number;
  losing_weeks: number;
  flat_weeks: number;
  profitable_week_rate: number;
  worst_week_adr: number;
  worst_5_week_adr_sum: number;
  max_drawdown_adr: number;
  return_to_drawdown: number | null;
  profit_factor_adr: number | null;
  average_winning_week_adr: number;
  average_losing_week_adr: number;
  closed_before_friday_rate: number;
  stopped_out_rate: number;
  negative_years: number;
  worst_5_weeks: Array<{ week_open_utc: string; year: number; exit_adr: number }>;
  annual: Array<{ year: number; weeks: number; total_adr: number; profitable_week_rate: number; worst_week_adr: number }>;
};

export type WeeklyMatrixRow = {
  schema_version: number;
  gate_id: string;
  rule_id: string;
  rule_family: string;
  week_open_utc: string;
  year: number;
  exit_adr: number;
  exit_timestamp_utc: string | null;
  exit_reason: string;
  closed_before_friday: boolean;
  stopped_out: boolean;
  available: boolean;
  candidate_b_ledger_hash: string;
  path_diagnostic_hash: string;
};

export type RankedExitRule = CandidateSummary & {
  adr_retention_vs_weekly_hold: number | null;
  drawdown_ratio_vs_weekly_hold: number | null;
  win_rate_lift_vs_weekly_hold: number;
  tail_risk_not_degraded: boolean;
  total_adr_not_collapsed: boolean;
  year_stability_not_degraded: boolean;
  clean_exit_rule: boolean;
  promotion_eligible: false;
  review_classification: "baseline_control" | "coupled_control" | "unavailable_control" | "review_shortlist" | "watch_only";
  disqualification_reasons: string[];
};

export async function loadGate71Summaries() {
  return {
    gate71bm: await readJson<Gate71Summary>(path.join(DEFAULT_GATE71BM_DIR, "gate71bm-summary.json")),
    gate71b: await readJson<Gate71Summary>(path.join(DEFAULT_GATE71B_DIR, "gate71b-summary.json")),
    gate71c: await readJson<Gate71Summary>(path.join(DEFAULT_GATE71C_DIR, "gate71c-summary.json")),
    gate71d: await readJson<Gate71Summary>(path.join(DEFAULT_GATE71D_DIR, "gate71d-summary.json")),
  };
}

export async function loadGate71ExitMatrixArtifacts() {
  return {
    protocol: await readJson<Gate71Protocol>(DEFAULT_GATE71A_PROTOCOL_PATH),
    candidateSummaries: await readJson<CandidateSummary[]>(DEFAULT_GATE71C_CANDIDATE_SUMMARIES_PATH),
    weeklyRows: await readJsonl<WeeklyMatrixRow>(DEFAULT_GATE71C_WEEKLY_ROWS_PATH),
    predeclaredMatrix: await readJson<Record<string, unknown>>(DEFAULT_GATE71C_PREDECLARED_MATRIX_PATH),
  };
}

export function familyLabel(ruleFamily: string) {
  if (ruleFamily === "global_close_all_stop_week") return "global close-all target";
  if (ruleFamily === "global_target_plus_adverse_stop") return "global target plus adverse stop";
  if (ruleFamily === "basket_profit_floor_trailing") return "basket profit-floor trailing";
  if (ruleFamily === "trail_plus_hard_tp") return "trail plus hard TP";
  if (ruleFamily === "control") return "control";
  return ruleFamily;
}

export function rankExitRules(candidateSummaries: CandidateSummary[]) {
  const weeklyHold = candidateSummaries.find((row) => row.rule_id === WEEKLY_HOLD_CONTROL_ID);
  if (!weeklyHold) throw new Error(`Missing ${WEEKLY_HOLD_CONTROL_ID}`);
  const cleanRules = candidateSummaries.filter((row) => row.rule_family !== "control" && row.unavailable_weeks === 0);
  const shortlistedIds = new Set<string>();
  for (const family of [...new Set(cleanRules.map((row) => row.rule_family))].sort()) {
    const familyRows = cleanRules.filter((row) => row.rule_family === family);
    const bestByBalancedReview = [...familyRows].sort((left, right) => {
      const leftScore = left.profitable_week_rate + Math.min(0.5, left.total_adr / weeklyHold.total_adr);
      const rightScore = right.profitable_week_rate + Math.min(0.5, right.total_adr / weeklyHold.total_adr);
      return rightScore - leftScore || right.total_adr - left.total_adr || left.rule_id.localeCompare(right.rule_id);
    })[0];
    if (bestByBalancedReview) shortlistedIds.add(bestByBalancedReview.rule_id);
  }
  return candidateSummaries
    .map((row): RankedExitRule => {
      const cleanExitRule = row.rule_family !== "control" && row.unavailable_weeks === 0;
      const adrRetention = weeklyHold.total_adr === 0 ? null : round(row.total_adr / weeklyHold.total_adr);
      const drawdownRatio = weeklyHold.max_drawdown_adr === 0 ? null : round(Math.abs(row.max_drawdown_adr) / Math.abs(weeklyHold.max_drawdown_adr));
      const tailRiskNotDegraded =
        row.worst_week_adr >= weeklyHold.worst_week_adr &&
        Math.abs(row.max_drawdown_adr) <= Math.abs(weeklyHold.max_drawdown_adr) &&
        row.worst_5_week_adr_sum >= weeklyHold.worst_5_week_adr_sum;
      const totalAdrNotCollapsed = row.total_adr >= weeklyHold.total_adr * 0.5;
      const yearStabilityNotDegraded = row.negative_years <= weeklyHold.negative_years;
      const disqualificationReasons: string[] = [];
      if (!cleanExitRule) disqualificationReasons.push(row.rule_id === LEGACY_ADR_GRID_CONTROL_ID ? "coupled_entry_exit_control_only" : row.rule_id === WEEKLY_HOLD_CONTROL_ID ? "baseline_control_not_exit_candidate" : "unavailable_control");
      if (row.profitable_week_rate <= weeklyHold.profitable_week_rate) disqualificationReasons.push("no_profitable_week_rate_lift");
      if (!tailRiskNotDegraded) disqualificationReasons.push("tail_risk_degraded_vs_weekly_hold");
      if (!totalAdrNotCollapsed) disqualificationReasons.push("total_adr_below_50pct_of_weekly_hold");
      if (!yearStabilityNotDegraded) disqualificationReasons.push("negative_year_count_worse_than_weekly_hold");
      return {
        ...row,
        adr_retention_vs_weekly_hold: adrRetention,
        drawdown_ratio_vs_weekly_hold: drawdownRatio,
        win_rate_lift_vs_weekly_hold: round(row.profitable_week_rate - weeklyHold.profitable_week_rate) ?? 0,
        tail_risk_not_degraded: tailRiskNotDegraded,
        total_adr_not_collapsed: totalAdrNotCollapsed,
        year_stability_not_degraded: yearStabilityNotDegraded,
        clean_exit_rule: cleanExitRule,
        promotion_eligible: false,
        review_classification: row.rule_id === WEEKLY_HOLD_CONTROL_ID
          ? "baseline_control"
          : row.rule_id === LEGACY_ADR_GRID_CONTROL_ID
            ? "coupled_control"
            : row.rule_id === PAIR_SILO_CONTROL_ID
              ? "unavailable_control"
              : shortlistedIds.has(row.rule_id)
                ? "review_shortlist"
                : "watch_only",
        disqualification_reasons: disqualificationReasons,
      };
    })
    .sort((left, right) => {
      const leftClass = left.review_classification === "review_shortlist" ? 0 : left.review_classification === "baseline_control" ? 1 : left.review_classification === "coupled_control" ? 2 : 3;
      const rightClass = right.review_classification === "review_shortlist" ? 0 : right.review_classification === "baseline_control" ? 1 : right.review_classification === "coupled_control" ? 2 : 3;
      return leftClass - rightClass || right.profitable_week_rate - left.profitable_week_rate || right.total_adr - left.total_adr || left.rule_id.localeCompare(right.rule_id);
    });
}

export function summarizeRankedRules(ranked: RankedExitRule[]) {
  const weeklyHold = ranked.find((row) => row.rule_id === WEEKLY_HOLD_CONTROL_ID);
  const legacyAdrGrid = ranked.find((row) => row.rule_id === LEGACY_ADR_GRID_CONTROL_ID);
  const cleanRules = ranked.filter((row) => row.clean_exit_rule);
  const promotionEligible = ranked.filter((row) => row.promotion_eligible);
  return {
    weekly_hold_control: weeklyHold ? compactRankedRule(weeklyHold) : null,
    legacy_adr_grid_control: legacyAdrGrid ? compactRankedRule(legacyAdrGrid) : null,
    clean_exit_rules_reviewed: cleanRules.length,
    review_shortlist_count: ranked.filter((row) => row.review_classification === "review_shortlist").length,
    promotion_eligible_count: promotionEligible.length,
    best_clean_by_profitable_week_rate: compactRankedRule([...cleanRules].sort((left, right) => right.profitable_week_rate - left.profitable_week_rate)[0]),
    best_clean_by_total_adr: compactRankedRule([...cleanRules].sort((left, right) => right.total_adr - left.total_adr)[0]),
    best_clean_by_tail_drawdown: compactRankedRule([...cleanRules].sort((left, right) => Math.abs(left.max_drawdown_adr) - Math.abs(right.max_drawdown_adr))[0]),
    family_shortlist: ranked.filter((row) => row.review_classification === "review_shortlist").map(compactRankedRule),
  };
}

export function compactRankedRule(row: RankedExitRule | undefined) {
  if (!row) return null;
  return {
    rule_id: row.rule_id,
    family: row.rule_family,
    profitable_week_rate: row.profitable_week_rate,
    total_adr: row.total_adr,
    adr_retention_vs_weekly_hold: row.adr_retention_vs_weekly_hold,
    max_drawdown_adr: row.max_drawdown_adr,
    worst_week_adr: row.worst_week_adr,
    negative_years: row.negative_years,
    return_to_drawdown: row.return_to_drawdown,
    review_classification: row.review_classification,
    promotion_eligible: row.promotion_eligible,
    disqualification_reasons: row.disqualification_reasons,
  };
}
