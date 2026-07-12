import { mkdir } from "node:fs/promises";
import path from "node:path";

import { gitCommit, parseArgMap, renderTable, toRepoRelative, writeJson, writeShaManifest, writeText } from "./gate65-utils";
import { DEFAULT_GATE67B_DIR, GATE67_DATE, buildFinalCandidateContracts } from "./gate67-utils";

const GATE_ID = "Gate 67B: final-forced28-candidate-contract";
const COMMAND = "npm run engine:gate67b:final-forced28-candidate-contract";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate67b/GATE67B_FINAL_FORCED28_CANDIDATE_CONTRACT_${GATE67_DATE}.md`;

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE67B_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
  };
}

function renderReport(summary: Record<string, unknown>, candidateRows: Array<Record<string, unknown>>) {
  return [
    "# Gate 67B Final Forced-28 Candidate Contract",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Defines exactly three unnamed final forced-28 algorithm candidates.",
    "- Collapses Gate 65E router discovery into a small Brain arbitration test set.",
    "- Does not score, promote, name, brand, risk-filter, or execute a final algorithm.",
    "- Uses fixed rules only; no optimized thresholds, learned weights, pair exclusions, or date exclusions.",
    "",
    "## Candidates",
    "",
    renderTable(candidateRows, ["candidate_id", "candidate_label", "complexity", "source_cells"]),
    "",
    "## Rule Boundary",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Candidate contracts: \`${summary.artifacts["contractsJson"]}\``,
    `- Arbitration rules: \`${summary.artifacts["rulesMarkdown"]}\``,
    `- Reason-code contract: \`${summary.artifacts["reasonCodeContract"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 67B stops at candidate contracts. It does not score candidates or promote a final algorithm.",
    "",
  ].join("\n");
}

function rulesMarkdown() {
  return [
    "# Gate 67B Final Forced-28 Arbitration Rules",
    "",
    "The final algorithm remains unnamed. These are candidate contracts only.",
    "",
    "## Candidate A - Macro Anchor Conservative",
    "",
    "- Regime/RRP is the candidate anchor.",
    "- RRP can select direction only when valuation_gap REER confirms it.",
    "- If valuation does not confirm RRP, fallback is Alpha v1 continuity.",
    "- High-confidence clean COT contradiction can warning-veto RRP to Alpha continuity.",
    "- Strength can confirm timing but cannot override.",
    "",
    "## Candidate B - Macro Anchor With COT Warning",
    "",
    "- RRP is anchor.",
    "- High-confidence clean COT contradiction falls back to Alpha v1 continuity.",
    "- Strength confirms timing but cannot override.",
    "- Valuation confirms macro but cannot override by itself.",
    "- Scenario memory is not direct-vote.",
    "",
    "## Candidate C - Scenario-Memory Guarded",
    "",
    "- RRP/valuation anchor is used when valuation confirms RRP; otherwise Alpha continuity is the fallback anchor.",
    "- COT and Strength act as confirm/warn layers.",
    "- Scenario memory can enable veto/fallback only when the Gate 65D cell-agreement group is high-support, covers at least three years, is not low-support flagged, and is not concentrated.",
    "- Scenario memory cannot choose a fresh direction. It only allows COT/Strength clean agreement to veto to their shared direction, or downgrade to Alpha fallback when they are not both direct-vote clean.",
    "",
    "## Fixed Boundary",
    "",
    "- No optimized thresholds.",
    "- No learned weights.",
    "- No pair exclusions.",
    "- No date exclusions.",
    "- No final algorithm name.",
    "- No promotion.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const candidates = buildFinalCandidateContracts();
  const reasonCodeContract = {
    gate_id: GATE_ID,
    contract_version: "gate67b_final_forced28_reason_codes_v0",
    final_algorithm_name: null,
    candidate_test_only: true,
    reason_code_prefixes: {
      A: "Candidate A macro anchor conservative",
      B: "Candidate B macro anchor with COT warning",
      C: "Candidate C scenario-memory guarded",
      QUALITY: "Cell opinion quality state",
      STRENGTH: "Strength confirmation or context",
      VALUATION: "Regime valuation confirmation state",
    },
    required_row_reason_fields: ["reason_codes", "participating_cells", "warning_active", "fallback_used", "veto_used"],
  };
  const pass =
    candidates.length === 3 &&
    candidates.every((candidate) => candidate.final_algorithm_name === null) &&
    candidates.every((candidate) => candidate.no_optimized_thresholds && candidate.no_learned_weights && candidate.no_pair_or_date_exclusions && candidate.no_final_promotion);
  const artifacts = {
    contractsJson: toRepoRelative(path.join(artifactDir, "final-forced28-candidate-contracts.json")),
    rulesMarkdown: toRepoRelative(path.join(artifactDir, "final-forced28-arbitration-rules.md")),
    reasonCodeContract: toRepoRelative(path.join(artifactDir, "final-forced28-reason-code-contract.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate67b-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate67b-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_FINAL_FORCED28_CANDIDATE_CONTRACT__EXACTLY_THREE_UNNAMED_SIMPLE_CANDIDATES" : "FAIL_FINAL_FORCED28_CANDIDATE_CONTRACT",
    candidate_count: candidates.length,
    validation: {
      exactly_three_candidates: candidates.length === 3,
      final_algorithm_name: null,
      final_algorithm_named_or_branded: false,
      optimized_thresholds: false,
      learned_weights: false,
      pair_exclusions: false,
      date_exclusions: false,
      final_promotion: false,
    },
    artifacts,
  };

  await writeJson(path.join(artifactDir, "final-forced28-candidate-contracts.json"), {
    gate_id: GATE_ID,
    final_algorithm_name: null,
    candidates,
  });
  await writeText(path.join(artifactDir, "final-forced28-arbitration-rules.md"), rulesMarkdown());
  await writeJson(path.join(artifactDir, "final-forced28-reason-code-contract.json"), reasonCodeContract);
  await writeJson(path.join(artifactDir, "gate67b-summary.json"), summary);
  await writeText(
    reportPath,
    renderReport(
      summary,
      candidates.map((candidate) => ({
        candidate_id: candidate.candidate_id,
        candidate_label: candidate.candidate_label,
        complexity: candidate.complexity,
        source_cells: candidate.source_cells.join(", "),
      })),
    ),
  );
  await writeShaManifest(path.join(artifactDir, "gate67b-sha256.txt"), GATE_ID, COMMAND, [
    { label: "candidate_contracts", path: path.join(artifactDir, "final-forced28-candidate-contracts.json") },
    { label: "arbitration_rules", path: path.join(artifactDir, "final-forced28-arbitration-rules.md") },
    { label: "reason_code_contract", path: path.join(artifactDir, "final-forced28-reason-code-contract.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate67b-summary.json") },
    { label: "report", path: reportPath },
  ]);

  if (!pass) throw new Error(summary.verdict);
  console.log(summary.verdict);
  console.log(JSON.stringify({ artifacts, validation: summary.validation }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
