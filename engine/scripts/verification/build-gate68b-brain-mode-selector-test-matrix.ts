import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_GATE64C_DIR,
  DEFAULT_GATE65C_DIR,
  DEFAULT_GATE65D_DIR,
  DEFAULT_GATE65E_DIR,
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
  CANDIDATE_D_ID,
  DEFAULT_GATE68B_DIR,
  GATE68_DATE,
  Gate68ScoredCandidate,
  compactGate68Candidate,
  flattenGate68DecisionRows,
  gate68CandidateRankings,
  gate68MetricDelta,
  gate68ModeDiagnostics,
  gate68ReferenceComparison,
  loadGate68Inputs,
  scoreGate68Candidates,
} from "./gate68-utils";
import { buildCellOpinionLedger } from "./gate67-utils";

const GATE_ID = "Gate 68B: brain-mode-selector-test-matrix";
const COMMAND = "npm run engine:gate68b:brain-mode-selector-test-matrix";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate68b/GATE68B_BRAIN_MODE_SELECTOR_TEST_MATRIX_${GATE68_DATE}.md`;

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE68B_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate64cDir: args.get("--gate64c-dir") ?? DEFAULT_GATE64C_DIR,
    gate65cDir: args.get("--gate65c-dir") ?? DEFAULT_GATE65C_DIR,
    gate65dDir: args.get("--gate65d-dir") ?? DEFAULT_GATE65D_DIR,
    gate65eDir: args.get("--gate65e-dir") ?? DEFAULT_GATE65E_DIR,
  };
}

function renderReport(summary: Record<string, unknown>, rows: Gate68ScoredCandidate[]) {
  const tableRows = [...rows]
    .sort((left, right) => (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999))
    .map((row) => ({
      candidate_id: row.candidate_id,
      adr: row.adr_grid.adr_sum,
      dd: row.adr_grid.max_drawdown,
      rdd: row.adr_grid.r_over_drawdown,
      pf: row.adr_grid.row_pf,
      wh: row.weekly_hold.adr_sum,
      wh_rdd: row.weekly_hold.r_over_drawdown,
      wh_pf: row.weekly_hold.row_pf,
      neg_years: row.negative_adr_grid_years,
      warnings: row.warning_rows ?? row.degraded_row_count,
      fallback: row.fallback_rows ?? 0,
      veto: row.veto_rows ?? 0,
    }));
  return [
    "# Gate 68B Brain Mode Selector Test Matrix",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Scores exactly four candidates: Gate 67 Candidate A, B, C, and Candidate D Brain Mode Selector.",
    "- Candidate D emits one forced-28 decision and one mode per pair-week.",
    "- Outcomes are used only after fixed decisions are emitted.",
    "- No candidate promotion, optimized threshold search, learned weights, pair exclusions, or date exclusions are introduced.",
    "",
    "## Candidate Metrics",
    "",
    renderTable(tableRows, ["candidate_id", "adr", "dd", "rdd", "pf", "wh", "wh_rdd", "wh_pf", "neg_years", "warnings", "fallback", "veto"]),
    "",
    "## Candidate D Findings",
    "",
    "```json",
    JSON.stringify(summary.candidate_d_review, null, 2),
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
    `- Mode diagnostics: \`${summary.artifacts["modeDiagnostics"]}\``,
    `- Year diagnostics: \`${summary.artifacts["yearDiagnostics"]}\``,
    `- Reason-code diagnostics: \`${summary.artifacts["reasonCodeDiagnostics"]}\``,
    `- Policy participation: \`${summary.artifacts["policyParticipation"]}\``,
    `- Signature collapse: \`${summary.artifacts["signatureCollapse"]}\``,
    `- Comparison vs Gate 64-67: \`${summary.artifacts["comparisonVsGate64_67"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 68B stops at the four-candidate test matrix. Candidate D is not promoted or named.",
    "",
  ].join("\n");
}

function bestReviewMarkdown(rows: Gate68ScoredCandidate[], comparison: ReturnType<typeof gate68ReferenceComparison>) {
  const rankings = gate68CandidateRankings(rows);
  const candidateD = rows.find((row) => row.candidate_id === CANDIDATE_D_ID)!;
  const candidateB = rows.find((row) => row.candidate_id === "candidate_b_macro_anchor_with_cot_warning")!;
  const candidateC = rows.find((row) => row.candidate_id === "candidate_c_scenario_memory_guarded")!;
  return [
    "# Gate 68B Best Candidate Review",
    "",
    "No promotion. Candidate D is tested only.",
    "",
    "## Best ADR Grid R/DD",
    "",
    "```json",
    JSON.stringify(compactGate68Candidate(rankings.best_adr_grid_rdd[0]), null, 2),
    "```",
    "",
    "## Best ADR Grid PF",
    "",
    "```json",
    JSON.stringify(compactGate68Candidate(rankings.best_adr_grid_pf[0]), null, 2),
    "```",
    "",
    "## Best Zero-Negative-Year Candidate",
    "",
    "```json",
    JSON.stringify(rankings.best_zero_negative_years[0] ? compactGate68Candidate(rankings.best_zero_negative_years[0]) : null, null, 2),
    "```",
    "",
    "## Candidate D Delta",
    "",
    "```json",
    JSON.stringify(
      {
        vs_candidate_b: gate68MetricDelta(candidateD, candidateB),
        vs_candidate_c: gate68MetricDelta(candidateD, candidateC),
      },
      null,
      2,
    ),
    "```",
    "",
    "## Signature Collapse",
    "",
    "```json",
    JSON.stringify(comparison.signature_collapse, null, 2),
    "```",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const inputs = await loadGate68Inputs({
    gate64cDir: options.gate64cDir,
    gate65cDir: options.gate65cDir,
    gate65dDir: options.gate65dDir,
    gate65eDir: options.gate65eDir,
  });
  const opinionRows = buildCellOpinionLedger(inputs.alphaRows, inputs.policyRows, inputs.scenarioRows);
  const scored = scoreGate68Candidates(inputs.alphaRows, opinionRows, inputs.policyRows, inputs.scenarioRows, inputs.scenarioGroups);
  const decisionRows = flattenGate68DecisionRows(scored);
  const candidateD = scored.find((row) => row.candidate_id === CANDIDATE_D_ID)!;
  const candidateB = scored.find((row) => row.candidate_id === "candidate_b_macro_anchor_with_cot_warning")!;
  const candidateC = scored.find((row) => row.candidate_id === "candidate_c_scenario_memory_guarded")!;
  const rankings = gate68CandidateRankings(scored);
  const comparison = gate68ReferenceComparison(scored, inputs.gate64cRows, inputs.gate65eRows);
  const modeDiagnostics = gate68ModeDiagnostics(decisionRows);
  const signatureCollapse = {
    gate_id: GATE_ID,
    entries: comparison.signature_collapse,
    candidate_d_genuinely_new_vs_gate64_65_67: comparison.signature_collapse.find((row) => row.candidate_id === CANDIDATE_D_ID)?.genuinely_new_vs_gate64_65_67 ?? false,
    candidate_d_equivalent_gate67_candidate_id: comparison.signature_collapse.find((row) => row.candidate_id === CANDIDATE_D_ID)?.equivalent_gate67_candidate_id ?? null,
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
    candidate_d_mode_counts_by_year: modeDiagnostics.mode_counts_by_year,
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
      warning_rows: row.warning_rows ?? row.degraded_row_count,
      fallback_rows: row.fallback_rows ?? 0,
      veto_rows: row.veto_rows ?? 0,
      mode_counts: row.mode_counts ?? null,
    })),
  };
  const reasonCodeDiagnostics = {
    gate_id: GATE_ID,
    candidates: scored.map((row) => ({
      candidate_id: row.candidate_id,
      reason_code_counts: row.reason_code_counts ?? countBy(row.decision_rows.flatMap((decisionRow) => decisionRow.reason_codes), (reason) => reason),
      mode_reason_code_counts: row.mode_reason_code_counts ?? null,
      warning_rows: row.warning_rows ?? row.degraded_row_count,
      fallback_rows: row.fallback_rows ?? 0,
      veto_rows: row.veto_rows ?? 0,
    })),
  };
  const expectedDecisionRows = EXPECTED_ROWS * 4;
  const candidateDRows = decisionRows.filter((row) => row.candidate_id === CANDIDATE_D_ID);
  const pass =
    scored.length === 4 &&
    scored.every((row) => row.forced28_row_count === EXPECTED_ROWS && row.duplicate_row_count === 0 && row.missing_outcome_rows === 0) &&
    decisionRows.length === expectedDecisionRows &&
    candidateDRows.length === EXPECTED_ROWS &&
    candidateDRows.every((row) => ["NORMAL", "PROTECTION", "CONSERVATIVE"].includes(row.selected_mode));
  const artifacts = {
    matrixRows: toRepoRelative(path.join(artifactDir, "brain-mode-selector-test-matrix.rows.jsonl")),
    testSummary: toRepoRelative(path.join(artifactDir, "brain-mode-selector-test-summary.json")),
    bestCandidateReview: toRepoRelative(path.join(artifactDir, "brain-mode-selector-best-candidate-review.md")),
    modeDiagnostics: toRepoRelative(path.join(artifactDir, "brain-mode-selector-mode-diagnostics.json")),
    yearDiagnostics: toRepoRelative(path.join(artifactDir, "brain-mode-selector-year-by-year-diagnostics.json")),
    reasonCodeDiagnostics: toRepoRelative(path.join(artifactDir, "brain-mode-selector-reason-code-diagnostics.json")),
    policyParticipation: toRepoRelative(path.join(artifactDir, "brain-mode-selector-policy-participation.json")),
    signatureCollapse: toRepoRelative(path.join(artifactDir, "brain-mode-selector-signature-collapse.json")),
    comparisonVsGate64_67: toRepoRelative(path.join(artifactDir, "brain-mode-selector-comparison-vs-gate64-67.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate68b-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate68b-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const candidateDReview = {
    candidate_d: compactGate68Candidate(candidateD),
    mode_counts: candidateD.mode_counts,
    reason_code_counts: candidateD.reason_code_counts,
    delta_vs_candidate_b: gate68MetricDelta(candidateD, candidateB),
    delta_vs_candidate_c: gate68MetricDelta(candidateD, candidateC),
    signature_collapse: signatureCollapse.entries.find((row) => row.candidate_id === CANDIDATE_D_ID),
    improved_vs_candidate_b_on_adr_grid_rdd: (candidateD.adr_grid.r_over_drawdown ?? 0) >= (candidateB.adr_grid.r_over_drawdown ?? 0),
    preserves_candidate_c_zero_negative_years: candidateD.negative_adr_grid_years === 0,
    no_promotion: true,
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_BRAIN_MODE_SELECTOR_TEST_MATRIX__EXACTLY_FOUR_CANDIDATES__FORCED28_PRESERVED__NO_PROMOTION" : "FAIL_BRAIN_MODE_SELECTOR_TEST_MATRIX",
    candidate_count: scored.length,
    decision_row_count: decisionRows.length,
    candidate_metrics: scored.map(compactGate68Candidate),
    candidate_d_review: candidateDReview,
    findings: {
      best_adr_grid_rdd_candidate: compactGate68Candidate(rankings.best_adr_grid_rdd[0]),
      best_adr_grid_pf_candidate: compactGate68Candidate(rankings.best_adr_grid_pf[0]),
      best_zero_negative_year_candidate: rankings.best_zero_negative_years[0] ? compactGate68Candidate(rankings.best_zero_negative_years[0]) : null,
      best_weekly_hold_candidate: compactGate68Candidate(rankings.best_weekly_hold[0]),
      candidate_d_genuinely_new_vs_gate64_65_67: signatureCollapse.candidate_d_genuinely_new_vs_gate64_65_67,
      candidate_d_equivalent_gate67_candidate_id: signatureCollapse.candidate_d_equivalent_gate67_candidate_id,
      no_promotion: true,
    },
    validation: {
      exactly_four_candidates_scored: scored.length === 4,
      candidate_d_has_one_forced28_direction_per_pair_week: candidateDRows.length === EXPECTED_ROWS,
      candidate_d_has_one_mode_per_pair_week: candidateDRows.every((row) => ["NORMAL", "PROTECTION", "CONSERVATIVE"].includes(row.selected_mode)),
      forced28_preserved_for_every_candidate: scored.every((row) => row.forced28_row_count === EXPECTED_ROWS && row.duplicate_row_count === 0),
      decision_rows: decisionRows.length,
      expected_decision_rows: expectedDecisionRows,
      outcome_fields_used_for_mode_selection: false,
      outcome_fields_used_for_scoring_only: true,
      pair_exclusions: 0,
      date_exclusions: 0,
      optimized_thresholds: false,
      learned_weights: false,
      final_promotion: false,
    },
    artifacts,
  };

  await writeJsonl(path.join(artifactDir, "brain-mode-selector-test-matrix.rows.jsonl"), decisionRows);
  await writeJson(path.join(artifactDir, "brain-mode-selector-test-summary.json"), summary);
  await writeText(path.join(artifactDir, "brain-mode-selector-best-candidate-review.md"), bestReviewMarkdown(scored, comparison));
  await writeJson(path.join(artifactDir, "brain-mode-selector-mode-diagnostics.json"), modeDiagnostics);
  await writeJson(path.join(artifactDir, "brain-mode-selector-year-by-year-diagnostics.json"), yearDiagnostics);
  await writeJson(path.join(artifactDir, "brain-mode-selector-reason-code-diagnostics.json"), reasonCodeDiagnostics);
  await writeJson(path.join(artifactDir, "brain-mode-selector-policy-participation.json"), policyParticipation);
  await writeJson(path.join(artifactDir, "brain-mode-selector-signature-collapse.json"), signatureCollapse);
  await writeJson(path.join(artifactDir, "brain-mode-selector-comparison-vs-gate64-67.json"), comparison);
  await writeJson(path.join(artifactDir, "gate68b-summary.json"), summary);
  await writeText(reportPath, renderReport(summary, scored));
  await writeShaManifest(path.join(artifactDir, "gate68b-sha256.txt"), GATE_ID, COMMAND, [
    { label: "matrix_rows", path: path.join(artifactDir, "brain-mode-selector-test-matrix.rows.jsonl") },
    { label: "test_summary", path: path.join(artifactDir, "brain-mode-selector-test-summary.json") },
    { label: "best_candidate_review", path: path.join(artifactDir, "brain-mode-selector-best-candidate-review.md") },
    { label: "mode_diagnostics", path: path.join(artifactDir, "brain-mode-selector-mode-diagnostics.json") },
    { label: "year_diagnostics", path: path.join(artifactDir, "brain-mode-selector-year-by-year-diagnostics.json") },
    { label: "reason_code_diagnostics", path: path.join(artifactDir, "brain-mode-selector-reason-code-diagnostics.json") },
    { label: "policy_participation", path: path.join(artifactDir, "brain-mode-selector-policy-participation.json") },
    { label: "signature_collapse", path: path.join(artifactDir, "brain-mode-selector-signature-collapse.json") },
    { label: "comparison_vs_gate64_67", path: path.join(artifactDir, "brain-mode-selector-comparison-vs-gate64-67.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate68b-summary.json") },
    { label: "report", path: reportPath },
  ]);

  if (!pass) throw new Error(summary.verdict);
  console.log(summary.verdict);
  console.log(JSON.stringify({ artifacts, candidate_d_review: candidateDReview }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
