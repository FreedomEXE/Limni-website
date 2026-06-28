import { mkdir } from "node:fs/promises";
import path from "node:path";

import { CandidateSummary, fileHash, gitCommit, parseArgMap, readJson, renderTable, toRepoRelative, writeJson, writeShaManifest, writeText } from "./gate65-utils";
import { CANDIDATE_D_ID, DEFAULT_GATE68A_DIR, DEFAULT_GATE68B_DIR, DEFAULT_GATE68C_DIR, DEFAULT_GATE68D_DIR, DEFAULT_GATE68E_DIR, GATE68_DATE } from "./gate68-utils";

const GATE_ID = "Gate 68E: architecture-lock-readiness-review";
const COMMAND = "npm run engine:gate68e:architecture-lock-readiness-review";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate68e/GATE68E_ARCHITECTURE_LOCK_READINESS_REVIEW_${GATE68_DATE}.md`;

type CompactCandidate = Pick<CandidateSummary, "candidate_id" | "family" | "adr_grid" | "weekly_hold" | "degraded_row_count" | "negative_adr_grid_years" | "worst_adr_grid_year" | "decision_signature_sha256"> & {
  mode_counts?: Record<string, number> | null;
};

type Gate68bSummary = {
  verdict: string;
  candidate_metrics: CompactCandidate[];
  candidate_d_review: {
    candidate_d: CompactCandidate;
    mode_counts: Record<string, number>;
    reason_code_counts: Record<string, number>;
    delta_vs_candidate_b: Record<string, number>;
    delta_vs_candidate_c: Record<string, number>;
    signature_collapse: Record<string, unknown>;
    improved_vs_candidate_b_on_adr_grid_rdd: boolean;
    preserves_candidate_c_zero_negative_years: boolean;
  };
  validation: Record<string, unknown>;
};

type GateSummary = {
  verdict: string;
  validation: Record<string, unknown>;
  artifacts?: Record<string, string>;
  capsule?: Record<string, string>;
};

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE68E_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate68aDir: args.get("--gate68a-dir") ?? DEFAULT_GATE68A_DIR,
    gate68bDir: args.get("--gate68b-dir") ?? DEFAULT_GATE68B_DIR,
    gate68cDir: args.get("--gate68c-dir") ?? DEFAULT_GATE68C_DIR,
    gate68dDir: args.get("--gate68d-dir") ?? DEFAULT_GATE68D_DIR,
  };
}

function renderReport(summary: Record<string, unknown>, blockerRows: Array<Record<string, unknown>>) {
  return [
    "# Gate 68E Architecture Lock Readiness Review",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.readiness_verdict}\``,
    "",
    "## Scope",
    "",
    "- Reviews Gate 68A-D evidence for final forced-28 architecture lock readiness.",
    "- Accepts or rejects Candidate D clearly.",
    "- Does not lock, name, promote, start risk, start exits, start execution, or start adaptive learning.",
    "",
    "## Candidate D Decision",
    "",
    "```json",
    JSON.stringify(summary.mode_selector_lock_recommendation, null, 2),
    "```",
    "",
    "## Blockers",
    "",
    blockerRows.length > 0 ? renderTable(blockerRows, ["severity", "blocker", "evidence"]) : "No hard evidence blockers found.",
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Readiness summary: \`${summary.artifacts["readinessSummary"]}\``,
    `- Mode selector lock recommendation: \`${summary.artifacts["modeSelectorLockRecommendation"]}\``,
    `- Blockers: \`${summary.artifacts["blockersJson"]}\``,
    `- Frozen capsule review: \`${summary.artifacts["frozenCapsuleReview"]}\``,
    `- No-drift readiness review: \`${summary.artifacts["noDriftReadinessReview"]}\``,
    `- Recommended next gate: \`${summary.artifacts["recommendedNextGate"]}\``,
    `- Cross-gate hash manifest: \`${summary.artifacts["crossGateHashManifest"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 68E is readiness review only. It does not start Gate 69, exits, risk, execution, app/runtime, source mutation, retuning, or learning.",
    "",
  ].join("\n");
}

function bestBy<T extends CompactCandidate>(rows: T[], getScore: (row: T) => number) {
  return [...rows].sort((left, right) => getScore(right) - getScore(left))[0];
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const gate68a = await readJson<GateSummary>(path.join(options.gate68aDir, "gate68a-summary.json"));
  const gate68b = await readJson<Gate68bSummary>(path.join(options.gate68bDir, "brain-mode-selector-test-summary.json"));
  const gate68c = await readJson<GateSummary>(path.join(options.gate68cDir, "gate68c-summary.json"));
  const gate68d = await readJson<GateSummary>(path.join(options.gate68dDir, "gate68d-summary.json"));
  const candidates = gate68b.candidate_metrics;
  const candidateD = candidates.find((row) => row.candidate_id === CANDIDATE_D_ID);
  const candidateB = candidates.find((row) => row.candidate_id === "candidate_b_macro_anchor_with_cot_warning");
  const candidateC = candidates.find((row) => row.candidate_id === "candidate_c_scenario_memory_guarded");
  const blockers: Array<{ severity: "hard" | "soft"; blocker: string; evidence: string }> = [];

  for (const [gate, summary] of [
    ["68A", gate68a],
    ["68B", gate68b],
    ["68C", gate68c],
    ["68D", gate68d],
  ] as const) {
    if (!summary.verdict.startsWith("PASS_")) blockers.push({ severity: "hard", blocker: `gate${gate.toLowerCase()}_did_not_pass`, evidence: summary.verdict });
  }
  if (!candidateD) blockers.push({ severity: "hard", blocker: "candidate_d_metrics_missing", evidence: "Gate 68B candidate metrics did not include Candidate D." });
  if (!candidateB) blockers.push({ severity: "hard", blocker: "candidate_b_reference_missing", evidence: "Gate 68B candidate metrics did not include Candidate B." });
  if (!candidateC) blockers.push({ severity: "hard", blocker: "candidate_c_reference_missing", evidence: "Gate 68B candidate metrics did not include Candidate C." });
  if (candidateD && candidateB && !gate68b.candidate_d_review.improved_vs_candidate_b_on_adr_grid_rdd) {
    blockers.push({
      severity: "soft",
      blocker: "candidate_d_weaker_than_candidate_b_on_adr_grid_rdd",
      evidence: JSON.stringify(gate68b.candidate_d_review.delta_vs_candidate_b),
    });
  }
  if (candidateD && candidateC && !gate68b.candidate_d_review.preserves_candidate_c_zero_negative_years) {
    blockers.push({
      severity: "soft",
      blocker: "candidate_d_does_not_preserve_candidate_c_zero_negative_years",
      evidence: JSON.stringify({ candidate_d_negative_years: candidateD.negative_adr_grid_years, candidate_c_negative_years: candidateC.negative_adr_grid_years }),
    });
  }
  if ((gate68d.validation.drift_monitor_can_change_decisions as boolean) || (gate68d.validation.drift_monitor_can_update_rules as boolean)) {
    blockers.push({ severity: "hard", blocker: "drift_monitor_can_mutate_rules_or_decisions", evidence: JSON.stringify(gate68d.validation) });
  }

  const hardBlockers = blockers.filter((blocker) => blocker.severity === "hard");
  const candidateDReady =
    hardBlockers.length === 0 &&
    gate68b.candidate_d_review.improved_vs_candidate_b_on_adr_grid_rdd &&
    gate68b.candidate_d_review.preserves_candidate_c_zero_negative_years &&
    Boolean(candidateD);
  const readinessVerdict = hardBlockers.length > 0
    ? "BLOCKED_REQUIRES_EVIDENCE_REPAIR"
    : candidateDReady
      ? "READY_TO_LOCK_BRAIN_MODE_SELECTOR_AND_PREPARE_EXITS_RISK"
      : "NOT_READY_LOCK_CANDIDATE_B_REFERENCE_AND_CARRY_C_SHADOW";
  const recommendedNextGate =
    readinessVerdict === "READY_TO_LOCK_BRAIN_MODE_SELECTOR_AND_PREPARE_EXITS_RISK"
      ? "Gate 69: Final forced-28 architecture lock and exit/risk preparation"
      : readinessVerdict === "BLOCKED_REQUIRES_EVIDENCE_REPAIR"
        ? "Gate 69: Evidence repair before final forced-28 architecture lock"
        : "Gate 69: Mode selector repair / fallback lock";
  const modeSelectorLockRecommendation = {
    candidate_d_accepted_for_next_lock_gate: candidateDReady,
    recommended_default_lock_target: candidateDReady ? CANDIDATE_D_ID : "candidate_b_macro_anchor_with_cot_warning",
    recommended_shadow_or_canary: candidateDReady ? "candidate_c_scenario_memory_guarded" : "candidate_c_scenario_memory_guarded",
    rationale: candidateDReady
      ? "Candidate D improved enough and preserved zero-negative-year behavior."
      : "Candidate D is trackable and genuinely new, but it is weaker than Candidate B on ADR Grid R/DD and does not preserve Candidate C zero-negative-year behavior.",
    candidate_d_mode_counts: gate68b.candidate_d_review.mode_counts,
    candidate_d_signature_collapse: gate68b.candidate_d_review.signature_collapse,
  };
  const frozenCapsuleReview = {
    gate_id: GATE_ID,
    capsule_id: gate68c.capsule?.capsule_id ?? null,
    capsule_sha256: gate68c.capsule?.capsule_sha256 ?? null,
    complete: gate68c.verdict.startsWith("PASS_"),
    no_drift_contract_present: gate68c.validation.no_drift_contract_explicit === true,
    future_observations_append_only: gate68c.validation.future_observations_append_only === true,
  };
  const noDriftReadinessReview = {
    gate_id: GATE_ID,
    forward_receipt_usable: gate68d.validation.future_weekly_receipt_schema_complete === true,
    drift_monitor_alert_only: gate68d.validation.drift_monitor_alert_only === true,
    can_change_decisions: gate68d.validation.drift_monitor_can_change_decisions,
    can_update_rules: gate68d.validation.drift_monitor_can_update_rules,
    can_select_better_candidate: gate68d.validation.drift_monitor_can_select_better_candidate,
  };
  const bestCandidateReview = {
    best_adr_grid_rdd: bestBy(candidates, (row) => row.adr_grid.r_over_drawdown ?? -999),
    best_adr_grid_pf: bestBy(candidates, (row) => row.adr_grid.row_pf ?? -999),
    best_zero_negative_years: bestBy(candidates.filter((row) => row.negative_adr_grid_years === 0), (row) => row.adr_grid.row_pf ?? -999) ?? null,
    best_weekly_hold: bestBy(candidates, (row) => row.weekly_hold.r_over_drawdown ?? -999),
    candidate_d: candidateD,
  };
  const crossGateEntries = await Promise.all(
    [
      path.join(options.gate68aDir, "gate68a-sha256.txt"),
      path.join(options.gate68bDir, "gate68b-sha256.txt"),
      path.join(options.gate68cDir, "gate68c-sha256.txt"),
      path.join(options.gate68dDir, "gate68d-sha256.txt"),
    ].map(async (filePath) => `${await fileHash(filePath)} ${toRepoRelative(filePath)}`),
  );
  const artifacts = {
    readinessSummary: toRepoRelative(path.join(artifactDir, "architecture-lock-readiness-summary.json")),
    modeSelectorLockRecommendation: toRepoRelative(path.join(artifactDir, "mode-selector-lock-recommendation.json")),
    blockersJson: toRepoRelative(path.join(artifactDir, "architecture-lock-blockers.json")),
    frozenCapsuleReview: toRepoRelative(path.join(artifactDir, "frozen-reference-capsule-review.json")),
    noDriftReadinessReview: toRepoRelative(path.join(artifactDir, "no-drift-readiness-review.json")),
    recommendedNextGate: toRepoRelative(path.join(artifactDir, "recommended-next-gate.md")),
    crossGateHashManifest: toRepoRelative(path.join(artifactDir, "gate68e-cross-gate-hash-manifest.txt")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate68e-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const pass = hardBlockers.length === 0 && ["READY_TO_LOCK_BRAIN_MODE_SELECTOR_AND_PREPARE_EXITS_RISK", "NOT_READY_LOCK_CANDIDATE_B_REFERENCE_AND_CARRY_C_SHADOW"].includes(readinessVerdict);
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_ARCHITECTURE_LOCK_READINESS_REVIEW__CLEAR_VERDICT_NO_RISK_EXITS_LEARNING_STARTED" : "FAIL_ARCHITECTURE_LOCK_READINESS_REVIEW",
    readiness_verdict: readinessVerdict,
    best_candidate_review: bestCandidateReview,
    mode_selector_lock_recommendation: modeSelectorLockRecommendation,
    blockers,
    recommended_next_gate: recommendedNextGate,
    validation: {
      gates_68a_through_68d_passed: [gate68a, gate68b, gate68c, gate68d].every((summary) => summary.verdict.startsWith("PASS_")),
      clear_readiness_verdict: Boolean(readinessVerdict),
      candidate_d_accepted_or_rejected_clearly: true,
      frozen_reference_capsule_complete: frozenCapsuleReview.complete,
      no_drift_contract_complete: noDriftReadinessReview.drift_monitor_alert_only && noDriftReadinessReview.can_change_decisions === false,
      forward_weekly_receipt_usable: noDriftReadinessReview.forward_receipt_usable,
      adaptive_learning_started: false,
      exits_risk_started: false,
      hard_blocker_count: hardBlockers.length,
      soft_blocker_count: blockers.length - hardBlockers.length,
    },
    artifacts,
  };
  const recommendedNextGateText = [
    "# Gate 68E Recommended Next Gate",
    "",
    `Readiness verdict: \`${readinessVerdict}\``,
    "",
    `Recommended next gate: \`${recommendedNextGate}\``,
    "",
    "This recommendation does not open Gate 69 by itself.",
    "",
  ].join("\n");
  const crossGateHashManifest = [`gate_id ${GATE_ID}`, `generated_at ${summary.generated_at}`, `git_commit ${summary.git_commit}`, ...crossGateEntries].join("\n");

  await writeJson(path.join(artifactDir, "architecture-lock-readiness-summary.json"), summary);
  await writeJson(path.join(artifactDir, "mode-selector-lock-recommendation.json"), modeSelectorLockRecommendation);
  await writeJson(path.join(artifactDir, "architecture-lock-blockers.json"), { gate_id: GATE_ID, blockers });
  await writeJson(path.join(artifactDir, "frozen-reference-capsule-review.json"), frozenCapsuleReview);
  await writeJson(path.join(artifactDir, "no-drift-readiness-review.json"), noDriftReadinessReview);
  await writeText(path.join(artifactDir, "recommended-next-gate.md"), recommendedNextGateText);
  await writeText(path.join(artifactDir, "gate68e-cross-gate-hash-manifest.txt"), `${crossGateHashManifest}\n`);
  await writeJson(path.join(artifactDir, "gate68e-summary.json"), summary);
  await writeText(reportPath, renderReport(summary, blockers));
  await writeShaManifest(path.join(artifactDir, "gate68e-sha256.txt"), GATE_ID, COMMAND, [
    { label: "readiness_summary", path: path.join(artifactDir, "architecture-lock-readiness-summary.json") },
    { label: "mode_selector_lock_recommendation", path: path.join(artifactDir, "mode-selector-lock-recommendation.json") },
    { label: "blockers_json", path: path.join(artifactDir, "architecture-lock-blockers.json") },
    { label: "frozen_capsule_review", path: path.join(artifactDir, "frozen-reference-capsule-review.json") },
    { label: "no_drift_readiness_review", path: path.join(artifactDir, "no-drift-readiness-review.json") },
    { label: "recommended_next_gate", path: path.join(artifactDir, "recommended-next-gate.md") },
    { label: "cross_gate_hash_manifest", path: path.join(artifactDir, "gate68e-cross-gate-hash-manifest.txt") },
    { label: "summary_json", path: path.join(artifactDir, "gate68e-summary.json") },
    { label: "report", path: reportPath },
  ]);

  if (!pass) throw new Error(summary.verdict);
  console.log(readinessVerdict);
  console.log(JSON.stringify({ artifacts, mode_selector_lock_recommendation: modeSelectorLockRecommendation, blockers }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
