import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_GATE65C_DIR,
  DEFAULT_GATE65D_DIR,
  DEFAULT_GATE65E_DIR,
  DEFAULT_GATE64C_DIR,
  EXPECTED_ROWS,
  countBy,
  gitCommit,
  parseArgMap,
  renderTable,
  toRepoRelative,
  writeJson,
  writeJsonl,
  writeShaManifest,
  writeText,
} from "./gate65-utils";
import {
  DEFAULT_GATE67A_DIR,
  DEFAULT_GATE67C_DIR,
  GATE67_DATE,
  Gate67ScoredCandidate,
  buildCellOpinionLedger,
  candidateRankings,
  compactGate67Candidate,
  flattenDecisionRows,
  gate67ReferenceComparison,
  loadGate67Inputs,
  scoreGate67Candidates,
} from "./gate67-utils";

const GATE_ID = "Gate 67C: final-forced28-test-matrix";
const COMMAND = "npm run engine:gate67c:final-forced28-test-matrix";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate67c/GATE67C_FINAL_FORCED28_TEST_MATRIX_${GATE67_DATE}.md`;

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE67C_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate64cDir: args.get("--gate64c-dir") ?? DEFAULT_GATE64C_DIR,
    gate65cDir: args.get("--gate65c-dir") ?? DEFAULT_GATE65C_DIR,
    gate65dDir: args.get("--gate65d-dir") ?? DEFAULT_GATE65D_DIR,
    gate65eDir: args.get("--gate65e-dir") ?? DEFAULT_GATE65E_DIR,
    gate67aDir: args.get("--gate67a-dir") ?? DEFAULT_GATE67A_DIR,
  };
}

function renderReport(summary: Record<string, unknown>, rows: Gate67ScoredCandidate[]) {
  const tableRows = [...rows]
    .sort((left, right) => (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999))
    .map((row) => ({
      candidate_id: row.candidate_id,
      adr: row.adr_grid.adr_sum,
      dd: row.adr_grid.max_drawdown,
      rdd: row.adr_grid.r_over_drawdown,
      pf: row.adr_grid.row_pf,
      wh: row.weekly_hold.adr_sum,
      wh_pf: row.weekly_hold.row_pf,
      neg_years: row.negative_adr_grid_years,
      warnings: row.warning_rows,
      fallback: row.fallback_rows,
      veto: row.veto_rows,
    }));
  return [
    "# Gate 67C Final Forced-28 Test Matrix",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Scores exactly the three Gate 67B unnamed final forced-28 candidates.",
    "- Preserves 10,444 rows, 373 weeks, 28 pairs per week, and zero duplicate pair-weeks for every candidate.",
    "- Uses outcome fields only after fixed decisions are emitted.",
    "- Does not promote a candidate, start risk, or add more candidates.",
    "",
    "## Candidate Metrics",
    "",
    renderTable(tableRows, ["candidate_id", "adr", "dd", "rdd", "pf", "wh", "wh_pf", "neg_years", "warnings", "fallback", "veto"]),
    "",
    "## Best Candidate Review",
    "",
    "```json",
    JSON.stringify(summary.findings, null, 2),
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
    `- Matrix rows: \`${summary.artifacts["matrixRows"]}\``,
    `- Test summary: \`${summary.artifacts["testSummary"]}\``,
    `- Best candidate review: \`${summary.artifacts["bestCandidateReview"]}\``,
    `- Year diagnostics: \`${summary.artifacts["yearDiagnostics"]}\``,
    `- Policy participation: \`${summary.artifacts["policyParticipation"]}\``,
    `- Reason-code diagnostics: \`${summary.artifacts["reasonCodeDiagnostics"]}\``,
    `- Signature collapse: \`${summary.artifacts["signatureCollapse"]}\``,
    `- Comparison vs Gate 64/65: \`${summary.artifacts["comparisonVsGate64_65"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 67C stops at the fixed three-candidate test matrix. No final algorithm is named or promoted.",
    "",
  ].join("\n");
}

function bestReviewMarkdown(rows: Gate67ScoredCandidate[], comparison: ReturnType<typeof gate67ReferenceComparison>) {
  const rankings = candidateRankings(rows);
  const bestRdd = rankings.best_adr_grid_rdd[0];
  const bestPf = rankings.best_adr_grid_pf[0];
  const bestZero = rankings.best_zero_negative_years[0] ?? null;
  const lines = [
    "# Gate 67C Best Candidate Review",
    "",
    "No promotion. The final forced-28 algorithm remains unnamed.",
    "",
    "## Best ADR Grid R/DD",
    "",
    JSON.stringify(compactGate67Candidate(bestRdd), null, 2),
    "",
    "## Best ADR Grid PF",
    "",
    JSON.stringify(compactGate67Candidate(bestPf), null, 2),
    "",
    "## Best Zero-Negative-Year Candidate",
    "",
    JSON.stringify(bestZero ? compactGate67Candidate(bestZero) : null, null, 2),
    "",
    "## Signature Collapse",
    "",
    JSON.stringify(comparison.signature_collapse, null, 2),
    "",
  ];
  return lines.join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const inputs = await loadGate67Inputs({
    gate64cDir: options.gate64cDir,
    gate65cDir: options.gate65cDir,
    gate65dDir: options.gate65dDir,
    gate65eDir: options.gate65eDir,
  });
  const opinionRows = buildCellOpinionLedger(inputs.alphaRows, inputs.policyRows, inputs.scenarioRows);
  const scored = scoreGate67Candidates(inputs.alphaRows, opinionRows, inputs.policyRows, inputs.scenarioRows, inputs.scenarioGroups);
  const decisionRows = flattenDecisionRows(scored);
  const rankings = candidateRankings(scored);
  const comparison = gate67ReferenceComparison(scored, inputs.gate64cRows, inputs.gate65eRows);
  const signatureCollapse = {
    gate_id: GATE_ID,
    entries: comparison.signature_collapse,
    genuinely_new_candidate_count: comparison.signature_collapse.filter((entry) => entry.genuinely_new_vs_gate64_65).length,
  };
  const yearDiagnostics = {
    gate_id: GATE_ID,
    candidates: scored.map((row) => ({
      candidate_id: row.candidate_id,
      adr_grid: row.adr_grid,
      weekly_hold: row.weekly_hold,
      negative_adr_grid_years: row.negative_adr_grid_years,
      worst_adr_grid_year: row.worst_adr_grid_year,
      annual_summary: row.annual_summary,
    })),
  };
  const policyParticipation = {
    gate_id: GATE_ID,
    candidates: scored.map((row) => ({
      candidate_id: row.candidate_id,
      selected_direction_counts: row.selected_direction_counts,
      participating_cell_counts: row.participating_cell_counts,
      cell_role_counts: row.cell_role_counts,
      cell_quality_counts: row.cell_quality_counts,
      source_quality_exposure: row.source_quality_exposure,
      warning_rows: row.warning_rows,
      fallback_rows: row.fallback_rows,
      veto_rows: row.veto_rows,
    })),
  };
  const reasonCodeDiagnostics = {
    gate_id: GATE_ID,
    candidates: scored.map((row) => ({
      candidate_id: row.candidate_id,
      reason_code_counts: row.reason_code_counts,
      warning_rows: row.warning_rows,
      fallback_rows: row.fallback_rows,
      veto_rows: row.veto_rows,
    })),
  };
  const duplicateCandidateRows = scored.filter((row) => row.duplicate_row_count !== 0);
  const pass =
    scored.length === 3 &&
    scored.every((row) => row.forced28_row_count === EXPECTED_ROWS && row.duplicate_row_count === 0 && row.missing_outcome_rows === 0) &&
    decisionRows.length === EXPECTED_ROWS * 3 &&
    duplicateCandidateRows.length === 0;
  const artifacts = {
    matrixRows: toRepoRelative(path.join(artifactDir, "final-forced28-test-matrix.rows.jsonl")),
    testSummary: toRepoRelative(path.join(artifactDir, "final-forced28-test-summary.json")),
    bestCandidateReview: toRepoRelative(path.join(artifactDir, "final-forced28-best-candidate-review.md")),
    yearDiagnostics: toRepoRelative(path.join(artifactDir, "final-forced28-year-by-year-diagnostics.json")),
    policyParticipation: toRepoRelative(path.join(artifactDir, "final-forced28-policy-participation.json")),
    reasonCodeDiagnostics: toRepoRelative(path.join(artifactDir, "final-forced28-reason-code-diagnostics.json")),
    signatureCollapse: toRepoRelative(path.join(artifactDir, "final-forced28-signature-collapse.json")),
    comparisonVsGate64_65: toRepoRelative(path.join(artifactDir, "final-forced28-comparison-vs-gate64-65.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate67c-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate67c-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const findings = {
    best_adr_grid_rdd_candidate: compactGate67Candidate(rankings.best_adr_grid_rdd[0]),
    best_adr_grid_pf_candidate: compactGate67Candidate(rankings.best_adr_grid_pf[0]),
    best_zero_negative_year_candidate: rankings.best_zero_negative_years[0] ? compactGate67Candidate(rankings.best_zero_negative_years[0]) : null,
    best_weekly_hold_candidate: compactGate67Candidate(rankings.best_weekly_hold[0]),
    genuinely_new_candidate_count: signatureCollapse.genuinely_new_candidate_count,
    no_promotion: true,
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_FINAL_FORCED28_TEST_MATRIX__EXACTLY_THREE_CANDIDATES__FORCED28_PRESERVED__NO_PROMOTION" : "FAIL_FINAL_FORCED28_TEST_MATRIX",
    candidate_count: scored.length,
    decision_row_count: decisionRows.length,
    selected_direction_counts_by_candidate: Object.fromEntries(scored.map((row) => [row.candidate_id, row.selected_direction_counts])),
    reason_code_count: countBy(decisionRows.flatMap((row) => row.reason_codes), (reason) => reason),
    findings,
    validation: {
      exactly_three_candidates_scored: scored.length === 3,
      forced28_preserved_for_every_candidate: scored.every((row) => row.forced28_row_count === EXPECTED_ROWS && row.duplicate_row_count === 0),
      decision_rows: decisionRows.length,
      expected_decision_rows: EXPECTED_ROWS * 3,
      outcome_fields_used_for_decision_logic: false,
      outcome_fields_used_for_scoring_only: true,
      pair_exclusions: 0,
      date_exclusions: 0,
      optimized_thresholds: false,
      learned_weights: false,
      final_promotion: false,
    },
    artifacts,
  };

  await writeJsonl(path.join(artifactDir, "final-forced28-test-matrix.rows.jsonl"), decisionRows);
  await writeJson(path.join(artifactDir, "final-forced28-test-summary.json"), summary);
  await writeText(path.join(artifactDir, "final-forced28-best-candidate-review.md"), bestReviewMarkdown(scored, comparison));
  await writeJson(path.join(artifactDir, "final-forced28-year-by-year-diagnostics.json"), yearDiagnostics);
  await writeJson(path.join(artifactDir, "final-forced28-policy-participation.json"), policyParticipation);
  await writeJson(path.join(artifactDir, "final-forced28-reason-code-diagnostics.json"), reasonCodeDiagnostics);
  await writeJson(path.join(artifactDir, "final-forced28-signature-collapse.json"), signatureCollapse);
  await writeJson(path.join(artifactDir, "final-forced28-comparison-vs-gate64-65.json"), comparison);
  await writeJson(path.join(artifactDir, "gate67c-summary.json"), summary);
  await writeText(reportPath, renderReport(summary, scored));
  await writeShaManifest(path.join(artifactDir, "gate67c-sha256.txt"), GATE_ID, COMMAND, [
    { label: "matrix_rows", path: path.join(artifactDir, "final-forced28-test-matrix.rows.jsonl") },
    { label: "test_summary", path: path.join(artifactDir, "final-forced28-test-summary.json") },
    { label: "best_candidate_review", path: path.join(artifactDir, "final-forced28-best-candidate-review.md") },
    { label: "year_diagnostics", path: path.join(artifactDir, "final-forced28-year-by-year-diagnostics.json") },
    { label: "policy_participation", path: path.join(artifactDir, "final-forced28-policy-participation.json") },
    { label: "reason_code_diagnostics", path: path.join(artifactDir, "final-forced28-reason-code-diagnostics.json") },
    { label: "signature_collapse", path: path.join(artifactDir, "final-forced28-signature-collapse.json") },
    { label: "comparison_vs_gate64_65", path: path.join(artifactDir, "final-forced28-comparison-vs-gate64-65.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate67c-summary.json") },
    { label: "report", path: reportPath },
  ]);

  if (!pass) throw new Error(summary.verdict);
  console.log(summary.verdict);
  console.log(JSON.stringify({ artifacts, findings }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
