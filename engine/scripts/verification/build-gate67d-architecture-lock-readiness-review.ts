import { mkdir } from "node:fs/promises";
import path from "node:path";

import { gitCommit, parseArgMap, readJson, renderTable, toRepoRelative, writeJson, writeShaManifest, writeText } from "./gate65-utils";
import { DEFAULT_GATE66B_DIR, DEFAULT_GATE67C_DIR, DEFAULT_GATE67D_DIR, GATE67_DATE } from "./gate67-utils";

const GATE_ID = "Gate 67D: architecture-lock-readiness-review";
const COMMAND = "npm run engine:gate67d:architecture-lock-readiness-review";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate67d/GATE67D_ARCHITECTURE_LOCK_READINESS_REVIEW_${GATE67_DATE}.md`;
const DEFAULT_GATE66D_DIR = "docs/research/gates/gate66d/artifacts/gate66d-architecture-terminology-verification";

type CandidateMetric = {
  candidate_id: string;
  adr_grid: { adr_sum: number | null; max_drawdown: number; r_over_drawdown: number | null; row_pf: number | null };
  weekly_hold: { adr_sum: number | null; max_drawdown: number; r_over_drawdown: number | null; row_pf: number | null };
  negative_adr_grid_years: number;
  degraded_row_count: number;
  warning_rows: number;
  fallback_rows: number;
  veto_rows: number;
  decision_signature_sha256: string;
};

type Gate67cSummary = {
  verdict: string;
  findings: {
    best_adr_grid_rdd_candidate: CandidateMetric;
    best_adr_grid_pf_candidate: CandidateMetric;
    best_zero_negative_year_candidate: CandidateMetric | null;
    genuinely_new_candidate_count: number;
  };
  validation: {
    exactly_three_candidates_scored: boolean;
    forced28_preserved_for_every_candidate: boolean;
    final_promotion: boolean;
  };
};

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE67D_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate66bDir: args.get("--gate66b-dir") ?? DEFAULT_GATE66B_DIR,
    gate66dDir: args.get("--gate66d-dir") ?? DEFAULT_GATE66D_DIR,
    gate67cDir: args.get("--gate67c-dir") ?? DEFAULT_GATE67C_DIR,
  };
}

function renderReport(summary: Record<string, unknown>, blockerRows: Array<Record<string, unknown>>) {
  return [
    "# Gate 67D Architecture Lock Readiness Review",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.readiness_verdict}\``,
    "",
    "## Scope",
    "",
    "- Reviews Gate 66 architecture proof and Gate 67A-C candidate evidence.",
    "- Does not lock, name, brand, risk-filter, or execute the final algorithm.",
    "- Recommends the next gate only.",
    "",
    "## Best Candidate Review",
    "",
    "```json",
    JSON.stringify(summary.best_candidate_review, null, 2),
    "```",
    "",
    "## Blockers",
    "",
    blockerRows.length > 0 ? renderTable(blockerRows, ["severity", "blocker", "evidence"]) : "No hard blockers found for opening a final lock gate.",
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
    `- Blockers: \`${summary.artifacts["blockersJson"]}\``,
    `- Recommended next gate: \`${summary.artifacts["recommendedNextGate"]}\``,
    `- Cross-gate hash manifest: \`${summary.artifacts["crossGateHashManifest"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 67D stops at readiness review. It does not start exits, risk, execution, or live work.",
    "",
  ].join("\n");
}

function candidateIsGoodEnough(candidate: CandidateMetric | null) {
  return Boolean(candidate && (candidate.adr_grid.r_over_drawdown ?? 0) > 5 && (candidate.adr_grid.row_pf ?? 0) > 1.15 && candidate.negative_adr_grid_years <= 1);
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const architecture = await readJson<Record<string, unknown>>(path.join(options.gate66bDir, "brain-architecture-v3.contract.json"));
  const activeSearch = await readJson<{ active_remaining_count?: number; final_active_remaining_count?: number }>(path.join(options.gate66dDir, "final-active-search-report.json"));
  const activeRemainingCount = activeSearch.final_active_remaining_count ?? activeSearch.active_remaining_count ?? 0;
  const gate67c = await readJson<Gate67cSummary>(path.join(options.gate67cDir, "gate67c-summary.json"));
  const bestRdd = gate67c.findings.best_adr_grid_rdd_candidate;
  const bestPf = gate67c.findings.best_adr_grid_pf_candidate;
  const bestZero = gate67c.findings.best_zero_negative_year_candidate;
  const blockers: Array<{ severity: "hard" | "soft"; blocker: string; evidence: string }> = [];
  const architectureJson = JSON.stringify(architecture);
  if (!architectureJson.includes("Brain -> Cells -> Atoms")) blockers.push({ severity: "hard", blocker: "architecture_not_brain_cells_atoms", evidence: "Gate 66B contract hierarchy mismatch" });
  if (activeRemainingCount !== 0) blockers.push({ severity: "hard", blocker: "deprecated_architecture_term_still_active", evidence: String(activeRemainingCount) });
  if (!gate67c.validation.exactly_three_candidates_scored) blockers.push({ severity: "hard", blocker: "candidate_count_not_three", evidence: JSON.stringify(gate67c.validation) });
  if (!gate67c.validation.forced28_preserved_for_every_candidate) blockers.push({ severity: "hard", blocker: "forced28_not_preserved", evidence: JSON.stringify(gate67c.validation) });
  if (gate67c.validation.final_promotion) blockers.push({ severity: "hard", blocker: "candidate_promoted_prematurely", evidence: JSON.stringify(gate67c.validation) });
  if (!candidateIsGoodEnough(bestRdd) && !candidateIsGoodEnough(bestZero)) blockers.push({ severity: "hard", blocker: "no_candidate_meets_minimum_readiness_profile", evidence: JSON.stringify({ bestRdd, bestZero }) });
  if (bestPf.warning_rows + bestPf.fallback_rows + bestPf.veto_rows > 5_000) blockers.push({ severity: "soft", blocker: "highest_pf_candidate_has_high_warning_or_fallback_exposure", evidence: String(bestPf.warning_rows + bestPf.fallback_rows + bestPf.veto_rows) });
  const hardBlockers = blockers.filter((blocker) => blocker.severity === "hard");
  const readinessVerdict =
    hardBlockers.length === 0
      ? "READY_TO_LOCK_BRAIN_CELLS_ATOMS_ARCHITECTURE_AND_OPEN_EXITS_RISK_PREP"
      : activeRemainingCount !== 0
        ? "BLOCKED_REQUIRES_EVIDENCE_REPAIR"
        : "NOT_READY_REQUIRES_MORE_FORCED28_ALGORITHM_DIAGNOSTICS";
  const recommendedNextGate =
    readinessVerdict === "READY_TO_LOCK_BRAIN_CELLS_ATOMS_ARCHITECTURE_AND_OPEN_EXITS_RISK_PREP"
      ? "Gate 68: Final forced-28 algorithm lock and exit/risk preparation"
      : "Gate 68: Forced-28 algorithm diagnostic repair";
  const artifacts = {
    readinessSummary: toRepoRelative(path.join(artifactDir, "architecture-lock-readiness-summary.json")),
    blockersJson: toRepoRelative(path.join(artifactDir, "architecture-lock-blockers.json")),
    recommendedNextGate: toRepoRelative(path.join(artifactDir, "recommended-next-gate.md")),
    crossGateHashManifest: toRepoRelative(path.join(artifactDir, "gate67d-cross-gate-hash-manifest.txt")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate67d-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    readiness_verdict: readinessVerdict,
    best_candidate_review: {
      best_adr_grid_rdd_candidate: bestRdd,
      best_adr_grid_pf_candidate: bestPf,
      best_zero_negative_year_candidate: bestZero,
      good_enough_to_become_default_in_next_gate: hardBlockers.length === 0,
      genuinely_new_candidate_count: gate67c.findings.genuinely_new_candidate_count,
    },
    blockers,
    recommended_next_gate: recommendedNextGate,
    validation: {
      active_architecture_brain_cells_atoms: architectureJson.includes("Brain -> Cells -> Atoms"),
      deprecated_layer_active_remaining_count: activeRemainingCount,
      final_algorithm_remains_unnamed: architectureJson.includes('"final_algorithm_name":null') || architectureJson.includes('"final_algorithm_name": null'),
      exactly_three_candidates_tested: gate67c.validation.exactly_three_candidates_scored,
      forced28_preserved: gate67c.validation.forced28_preserved_for_every_candidate,
      final_promotion_started: gate67c.validation.final_promotion,
      exits_risk_started: false,
    },
    artifacts,
  };
  const recommendedNextGateText = [
    "# Gate 67D Recommended Next Gate",
    "",
    `Readiness verdict: \`${readinessVerdict}\``,
    "",
    `Recommended next gate: \`${recommendedNextGate}\``,
    "",
    "This recommendation does not open the next gate by itself.",
    "",
  ].join("\n");
  const crossGateManifest = [
    `gate_id ${GATE_ID}`,
    `generated_at ${summary.generated_at}`,
    `git_commit ${summary.git_commit}`,
    `gate66b_contract ${toRepoRelative(path.join(options.gate66bDir, "brain-architecture-v3.contract.json"))}`,
    `gate66d_active_search ${toRepoRelative(path.join(options.gate66dDir, "final-active-search-report.json"))}`,
    `gate67c_summary ${toRepoRelative(path.join(options.gate67cDir, "gate67c-summary.json"))}`,
  ].join("\n");

  await writeJson(path.join(artifactDir, "architecture-lock-readiness-summary.json"), summary);
  await writeJson(path.join(artifactDir, "architecture-lock-blockers.json"), { gate_id: GATE_ID, blockers });
  await writeText(path.join(artifactDir, "recommended-next-gate.md"), recommendedNextGateText);
  await writeText(path.join(artifactDir, "gate67d-cross-gate-hash-manifest.txt"), `${crossGateManifest}\n`);
  await writeText(reportPath, renderReport(summary, blockers));
  await writeShaManifest(path.join(artifactDir, "gate67d-sha256.txt"), GATE_ID, COMMAND, [
    { label: "readiness_summary", path: path.join(artifactDir, "architecture-lock-readiness-summary.json") },
    { label: "blockers_json", path: path.join(artifactDir, "architecture-lock-blockers.json") },
    { label: "recommended_next_gate", path: path.join(artifactDir, "recommended-next-gate.md") },
    { label: "cross_gate_hash_manifest", path: path.join(artifactDir, "gate67d-cross-gate-hash-manifest.txt") },
    { label: "report", path: reportPath },
  ]);

  if (hardBlockers.some((blocker) => blocker.blocker === "deprecated_architecture_term_still_active" || blocker.blocker === "forced28_not_preserved")) {
    throw new Error(readinessVerdict);
  }
  console.log(readinessVerdict);
  console.log(JSON.stringify({ artifacts, blockers }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
