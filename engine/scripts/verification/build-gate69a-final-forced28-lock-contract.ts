import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_GATE67C_DIR,
  DEFAULT_GATE68C_DIR,
  DEFAULT_GATE68E_DIR,
  DEFAULT_GATE69A_DIR,
  FINAL_ALGORITHM_NAME,
  GATE69_DATE,
  LOCKED_DEFAULT_CANDIDATE_ID,
  LOCKED_FINAL_ALGORITHM_ID,
  REJECTED_SELECTOR_CANDIDATE_ID,
  SHADOW_CANARY_CANDIDATE_ID,
  SHADOW_CANARY_ID,
  loadGate68Capsule,
  metricDelta,
} from "./gate69-utils";
import { fileHash, gitCommit, parseArgMap, readJson, renderTable, toRepoRelative, writeJson, writeShaManifest, writeText } from "./gate65-utils";

const GATE_ID = "Gate 69A: final-forced28-lock-contract";
const COMMAND = "npm run engine:gate69a:final-forced28-lock-contract";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate69a/GATE69A_FINAL_FORCED28_LOCK_CONTRACT_${GATE69_DATE}.md`;

type Gate67cSummary = {
  verdict: string;
  candidate_count: number;
  findings: {
    best_adr_grid_rdd_candidate: { candidate_id: string };
    best_adr_grid_pf_candidate: { candidate_id: string };
    best_zero_negative_year_candidate: { candidate_id: string; negative_adr_grid_years: number } | null;
  };
};

type Gate68eSummary = {
  verdict: string;
  readiness_verdict: string;
  best_candidate_review: Record<string, unknown>;
  mode_selector_lock_recommendation: {
    candidate_d_accepted_for_next_lock_gate: boolean;
    recommended_default_lock_target: string;
    recommended_shadow_or_canary: string;
    rationale: string;
  };
  validation: {
    hard_blocker_count: number;
    adaptive_learning_started: boolean;
    exits_risk_started: boolean;
  };
};

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE69A_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate67cDir: args.get("--gate67c-dir") ?? DEFAULT_GATE67C_DIR,
    gate68cDir: args.get("--gate68c-dir") ?? DEFAULT_GATE68C_DIR,
    gate68eDir: args.get("--gate68e-dir") ?? DEFAULT_GATE68E_DIR,
  };
}

function renderReport(summary: Record<string, unknown>) {
  const evidence = summary["lock_evidence"] as Record<string, unknown>;
  const table = renderTable(evidence["metric_table"] as Array<Record<string, unknown>>, [
    "role",
    "candidate_id",
    "adr_grid",
    "rdd",
    "pf",
    "weekly_hold",
    "weekly_hold_rdd",
    "negative_years",
  ]);
  return [
    "# Gate 69A Final Forced-28 Lock Contract",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Locks Candidate B as the default unnamed final forced-28 algorithm.",
    "- Carries Candidate C as a frozen shadow/canary comparator.",
    "- Rejects Candidate D as a lock target without retesting or adding Candidate E.",
    "- Binds the lock to the Gate 68 frozen reference capsule.",
    "- Does not name, brand, risk-filter, size, exit, execute, learn, retune, or mutate sources.",
    "",
    "## Lock Evidence",
    "",
    table,
    "",
    "## Contract",
    "",
    "```json",
    JSON.stringify(summary["lock_contract"], null, 2),
    "```",
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Lock contract: \`${summary.artifacts["lockContract"]}\``,
    `- Shadow canary contract: \`${summary.artifacts["shadowCanaryContract"]}\``,
    `- Lock evidence: \`${summary.artifacts["lockEvidence"]}\``,
    `- Lock decision memo: \`${summary.artifacts["lockDecisionMemo"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 69A locks the default and shadow references only. Exits/risk are not opened here.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const gate67c = await readJson<Gate67cSummary>(path.join(options.gate67cDir, "gate67c-summary.json"));
  const gate68e = await readJson<Gate68eSummary>(path.join(options.gate68eDir, "gate68e-summary.json"));
  const { summary: gate68c, manifest: capsuleManifest } = await loadGate68Capsule(options.gate68cDir);
  const gate67cRowsHash = await fileHash(path.join(options.gate67cDir, "final-forced28-test-matrix.rows.jsonl"));
  const gate68cManifestHash = await fileHash(path.join(options.gate68cDir, "frozen-reference-capsule.manifest.json"));
  const gate68eSummaryHash = await fileHash(path.join(options.gate68eDir, "gate68e-summary.json"));
  const defaultMetric = gate68e.best_candidate_review["best_adr_grid_rdd"] as Record<string, unknown>;
  const shadowMetric = gate68e.best_candidate_review["best_zero_negative_years"] as Record<string, unknown>;
  const candidateDMetric = gate68e.best_candidate_review["candidate_d"] as Record<string, unknown>;
  const lockEvidence = {
    gate_id: GATE_ID,
    metric_table: [
      metricTableRow("default_lock", defaultMetric),
      metricTableRow("shadow_canary", shadowMetric),
      metricTableRow("rejected_selector", candidateDMetric),
    ],
    default_vs_shadow_delta: metricDelta(defaultMetric as never, shadowMetric as never),
    default_candidate_source: "Gate 67C best ADR Grid R/DD and PF, confirmed by Gate 68E recommendation.",
    shadow_candidate_source: "Gate 67C zero-negative-year and Gate 68E shadow/canary recommendation.",
    rejected_selector_source: "Gate 68B/68E Candidate D genuinely new but not lock-ready.",
    input_hashes: {
      gate67c_rows_hash: gate67cRowsHash,
      gate68c_manifest_hash: gate68cManifestHash,
      gate68e_summary_hash: gate68eSummaryHash,
      capsule_sha256: gate68c.capsule.capsule_sha256,
    },
  };
  const lockContract = {
    gate_id: GATE_ID,
    contract_version: "gate69_final_forced28_lock_contract_v0",
    locked_algorithm_id: LOCKED_FINAL_ALGORITHM_ID,
    final_algorithm_name: FINAL_ALGORITHM_NAME,
    final_algorithm_status: "locked_unnamed_default_forced28",
    architecture_version: "gate66_brain_cells_atoms_v3",
    brain_path: "Brain -> Cells -> Atoms -> unnamed final forced-28 algorithm",
    default_candidate_id: LOCKED_DEFAULT_CANDIDATE_ID,
    default_candidate_role: "default_final_forced28_decision_source",
    shadow_candidate_id: SHADOW_CANARY_CANDIDATE_ID,
    shadow_canary_id: SHADOW_CANARY_ID,
    shadow_candidate_role: "frozen_shadow_canary_robustness_comparator",
    rejected_lock_target_candidate_ids: [REJECTED_SELECTOR_CANDIDATE_ID],
    forbidden_new_candidate_ids: ["candidate_e", "candidate_f", "new_mode_selector", "adaptive_router"],
    frozen_reference_capsule_id: gate68c.capsule.capsule_id,
    frozen_reference_capsule_sha256: gate68c.capsule.capsule_sha256,
    gate68_capsule_manifest_hash: gate68cManifestHash,
    candidate_b_decision_signature_sha256: defaultMetric["decision_signature_sha256"],
    candidate_c_shadow_signature_sha256: shadowMetric["decision_signature_sha256"],
    no_final_name_or_branding: true,
    no_mode_selector: true,
    no_adaptive_learning: true,
    no_rolling_retraining: true,
    no_source_mutation: true,
    no_retuning: true,
    no_optimized_thresholds: true,
    no_learned_weights: true,
    no_pair_or_date_exclusions: true,
    no_risk_or_exit_logic_started: true,
  };
  const shadowCanaryContract = {
    gate_id: GATE_ID,
    contract_version: "gate69_shadow_canary_contract_v0",
    shadow_canary_id: SHADOW_CANARY_ID,
    shadow_candidate_id: SHADOW_CANARY_CANDIDATE_ID,
    shadow_role: "robustness comparator and zero-negative-year canary",
    default_decision_mutation_allowed: false,
    risk_or_execution_permission_allowed: false,
    future_use_requires_explicit_gate: true,
    frozen_reference_capsule_id: gate68c.capsule.capsule_id,
    candidate_c_metrics: shadowMetric,
  };
  const lockDecisionMemo = [
    "# Gate 69A Lock Decision Memo",
    "",
    "Candidate B is locked as the default unnamed final forced-28 algorithm.",
    "",
    "Candidate C is carried as a frozen shadow/canary and cannot mutate the default Brain decision ledger.",
    "",
    "Candidate D is rejected as a lock target. Gate 69 does not retest D and does not add Candidate E.",
    "",
    `Gate 68 capsule: \`${gate68c.capsule.capsule_id}\``,
    `Capsule SHA: \`${gate68c.capsule.capsule_sha256}\``,
    "",
  ].join("\n");
  const pass =
    gate67c.verdict.startsWith("PASS_") &&
    gate68c.verdict.startsWith("PASS_") &&
    gate68e.verdict.startsWith("PASS_") &&
    gate68e.validation.hard_blocker_count === 0 &&
    gate68e.mode_selector_lock_recommendation.candidate_d_accepted_for_next_lock_gate === false &&
    gate68e.mode_selector_lock_recommendation.recommended_default_lock_target === LOCKED_DEFAULT_CANDIDATE_ID &&
    gate68e.mode_selector_lock_recommendation.recommended_shadow_or_canary === SHADOW_CANARY_CANDIDATE_ID &&
    gate67c.findings.best_adr_grid_rdd_candidate.candidate_id === LOCKED_DEFAULT_CANDIDATE_ID &&
    gate67c.findings.best_adr_grid_pf_candidate.candidate_id === LOCKED_DEFAULT_CANDIDATE_ID &&
    gate67c.findings.best_zero_negative_year_candidate?.candidate_id === SHADOW_CANARY_CANDIDATE_ID &&
    capsuleManifest.final_algorithm_name === null &&
    lockContract.no_mode_selector &&
    lockContract.no_risk_or_exit_logic_started;
  const artifacts = {
    lockContract: toRepoRelative(path.join(artifactDir, "final-forced28-lock-contract.json")),
    shadowCanaryContract: toRepoRelative(path.join(artifactDir, "candidate-c-shadow-canary-contract.json")),
    lockEvidence: toRepoRelative(path.join(artifactDir, "lock-evidence.json")),
    lockDecisionMemo: toRepoRelative(path.join(artifactDir, "lock-decision-memo.md")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate69a-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate69a-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_FINAL_FORCED28_LOCK_CONTRACT__CANDIDATE_B_DEFAULT_CANDIDATE_C_SHADOW_NO_SELECTOR" : "FAIL_FINAL_FORCED28_LOCK_CONTRACT",
    lock_contract: lockContract,
    lock_evidence: lockEvidence,
    validation: {
      gate67c_passed: gate67c.verdict.startsWith("PASS_"),
      gate68c_passed: gate68c.verdict.startsWith("PASS_"),
      gate68e_passed: gate68e.verdict.startsWith("PASS_"),
      hard_blocker_count: gate68e.validation.hard_blocker_count,
      default_candidate_is_best_adr_grid_rdd: gate67c.findings.best_adr_grid_rdd_candidate.candidate_id === LOCKED_DEFAULT_CANDIDATE_ID,
      default_candidate_is_best_adr_grid_pf: gate67c.findings.best_adr_grid_pf_candidate.candidate_id === LOCKED_DEFAULT_CANDIDATE_ID,
      shadow_candidate_is_zero_negative_year_candidate: gate67c.findings.best_zero_negative_year_candidate?.candidate_id === SHADOW_CANARY_CANDIDATE_ID,
      candidate_d_rejected_for_lock: gate68e.mode_selector_lock_recommendation.candidate_d_accepted_for_next_lock_gate === false,
      new_candidate_added: false,
      final_algorithm_name: null,
      risk_exits_started: false,
      adaptive_learning_started: false,
    },
    artifacts,
  };

  await writeJson(path.join(artifactDir, "final-forced28-lock-contract.json"), lockContract);
  await writeJson(path.join(artifactDir, "candidate-c-shadow-canary-contract.json"), shadowCanaryContract);
  await writeJson(path.join(artifactDir, "lock-evidence.json"), lockEvidence);
  await writeText(path.join(artifactDir, "lock-decision-memo.md"), lockDecisionMemo);
  await writeJson(path.join(artifactDir, "gate69a-summary.json"), summary);
  await writeText(reportPath, renderReport(summary));
  await writeShaManifest(path.join(artifactDir, "gate69a-sha256.txt"), GATE_ID, COMMAND, [
    { label: "lock_contract", path: path.join(artifactDir, "final-forced28-lock-contract.json") },
    { label: "shadow_canary_contract", path: path.join(artifactDir, "candidate-c-shadow-canary-contract.json") },
    { label: "lock_evidence", path: path.join(artifactDir, "lock-evidence.json") },
    { label: "lock_decision_memo", path: path.join(artifactDir, "lock-decision-memo.md") },
    { label: "summary_json", path: path.join(artifactDir, "gate69a-summary.json") },
    { label: "report", path: reportPath },
  ]);

  if (!pass) throw new Error(summary.verdict);
  console.log(summary.verdict);
  console.log(JSON.stringify({ artifacts, validation: summary.validation }, null, 2));
}

function metricTableRow(role: string, row: Record<string, unknown>) {
  const adrGrid = row["adr_grid"] as Record<string, unknown>;
  const weeklyHold = row["weekly_hold"] as Record<string, unknown>;
  return {
    role,
    candidate_id: row["candidate_id"],
    adr_grid: adrGrid["adr_sum"],
    rdd: adrGrid["r_over_drawdown"],
    pf: adrGrid["row_pf"],
    weekly_hold: weeklyHold["adr_sum"],
    weekly_hold_rdd: weeklyHold["r_over_drawdown"],
    negative_years: row["negative_adr_grid_years"],
  };
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
