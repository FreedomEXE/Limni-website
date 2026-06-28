import { mkdir } from "node:fs/promises";
import path from "node:path";

import { gitCommit, parseArgMap, readJson, toRepoRelative, writeJson, writeShaManifest, writeText } from "./gate65-utils";
import {
  DEFAULT_GATE70A_DIR,
  DEFAULT_GATE70B_DIR,
  GATE70_DATE,
  LOCKED_DEFAULT_CANDIDATE_ID,
  LOCKED_FINAL_ALGORITHM_ID,
  requiredString,
} from "./gate70-utils";

const GATE_ID = "Gate 70B: exit-expression-interface-preflight";
const COMMAND = "npm run engine:gate70b:exit-expression-interface-preflight";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate70b/GATE70B_EXIT_EXPRESSION_INTERFACE_PREFLIGHT_${GATE70_DATE}.md`;

type Gate70aSummary = {
  verdict: string;
  validation: { candidate_b_read_only: boolean; candidate_c_monitoring_only: boolean; exits_started: boolean; risk_started: boolean };
};

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE70B_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate70aDir: args.get("--gate70a-dir") ?? DEFAULT_GATE70A_DIR,
  };
}

function renderReport(summary: Record<string, unknown>) {
  return [
    "# Gate 70B Exit Expression Interface Preflight",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Defines how a later exit layer may consume the locked Candidate B Brain ledger.",
    "- Exit layer may change trade management/expression only, not weekly signal truth.",
    "- Does not build an exit matrix, choose exit policies, optimize thresholds, or score outcomes.",
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Exit input schema: \`${summary.artifacts["exitInputSchema"]}\``,
    `- Exit output schema: \`${summary.artifacts["exitOutputSchema"]}\``,
    `- Exit research boundary: \`${summary.artifacts["exitResearchBoundary"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 70B defines the exit interface only. No exit policies are tested or selected.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const gate70a = await readJson<Gate70aSummary>(path.join(options.gate70aDir, "gate70a-summary.json"));
  const exitInputSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Gate 70B Exit Expression Input",
    type: "object",
    additionalProperties: false,
    required: [
      "week_open_utc",
      "symbol",
      "final_direction",
      "final_side",
      "decision_hash",
      "locked_algorithm_id",
      "default_candidate_id",
      "final_ledger_hash",
      "frozen_reference_capsule_id",
      "price_bundle_id",
      "brain_truth_forced28",
    ],
    properties: {
      week_open_utc: requiredString(),
      symbol: requiredString(),
      final_direction: { enum: ["BASE_CURRENCY", "QUOTE_CURRENCY"] },
      final_side: { enum: ["LONG", "SHORT"] },
      decision_hash: requiredString(),
      locked_algorithm_id: { const: LOCKED_FINAL_ALGORITHM_ID },
      default_candidate_id: { const: LOCKED_DEFAULT_CANDIDATE_ID },
      final_ledger_hash: requiredString(),
      frozen_reference_capsule_id: requiredString(),
      price_bundle_id: { const: "gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953" },
      brain_truth_forced28: { const: true },
    },
  };
  const exitOutputSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Gate 70B Exit Expression Output",
    type: "object",
    additionalProperties: false,
    required: [
      "week_open_utc",
      "symbol",
      "decision_hash",
      "final_direction",
      "final_side",
      "exit_expression_id",
      "exit_contract_version",
      "trade_management_events",
      "brain_direction_mutated",
      "brain_ledger_row_dropped",
      "output_hash",
    ],
    properties: {
      week_open_utc: requiredString(),
      symbol: requiredString(),
      decision_hash: requiredString(),
      final_direction: { enum: ["BASE_CURRENCY", "QUOTE_CURRENCY"] },
      final_side: { enum: ["LONG", "SHORT"] },
      exit_expression_id: requiredString(),
      exit_contract_version: requiredString(),
      trade_management_events: { type: "array", items: { type: "object" } },
      brain_direction_mutated: { const: false },
      brain_ledger_row_dropped: { const: false },
      output_hash: requiredString(),
    },
  };
  const exitResearchBoundary = {
    gate_id: GATE_ID,
    contract_version: "gate70_exit_expression_boundary_v0",
    allowed_future_research_after_explicit_gate: [
      "exit timing",
      "hold duration",
      "trade management event rules",
      "post-entry/post-open expression choices",
      "exit-policy comparison against locked Candidate B inputs",
    ],
    forbidden_in_gate70: ["exit policy scoring", "threshold optimization", "parameter search", "candidate selection", "live execution", "risk sizing"],
    forbidden_always_without_new_direction_gate: ["weekly direction rewrite", "Candidate B mutation", "Candidate C promotion", "Candidate D reopen", "Candidate E creation"],
    exit_layer_may_change_trade_management: true,
    exit_layer_may_change_weekly_signal_truth: false,
    exit_layer_may_drop_brain_rows: false,
    output_must_reference_input_decision_hash: true,
    output_must_retain_forced28_shadow_trace: true,
  };
  const pass =
    gate70a.verdict.startsWith("PASS_") &&
    gate70a.validation.candidate_b_read_only &&
    gate70a.validation.candidate_c_monitoring_only &&
    gate70a.validation.exits_started === false &&
    gate70a.validation.risk_started === false &&
    exitResearchBoundary.exit_layer_may_change_weekly_signal_truth === false &&
    exitResearchBoundary.exit_layer_may_drop_brain_rows === false &&
    exitOutputSchema.properties.brain_direction_mutated.const === false;
  const artifacts = {
    exitInputSchema: toRepoRelative(path.join(artifactDir, "exit-expression-input.schema.json")),
    exitOutputSchema: toRepoRelative(path.join(artifactDir, "exit-expression-output.schema.json")),
    exitResearchBoundary: toRepoRelative(path.join(artifactDir, "exit-expression-research-boundary.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate70b-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate70b-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_EXIT_EXPRESSION_INTERFACE_PREFLIGHT__MANAGEMENT_ONLY_NO_DIRECTION_MUTATION" : "FAIL_EXIT_EXPRESSION_INTERFACE_PREFLIGHT",
    validation: {
      gate70a_passed: gate70a.verdict.startsWith("PASS_"),
      candidate_b_read_only: gate70a.validation.candidate_b_read_only,
      exit_layer_may_change_trade_management: exitResearchBoundary.exit_layer_may_change_trade_management,
      exit_layer_may_change_weekly_signal_truth: exitResearchBoundary.exit_layer_may_change_weekly_signal_truth,
      exit_layer_may_drop_brain_rows: exitResearchBoundary.exit_layer_may_drop_brain_rows,
      exit_policy_scoring_started: false,
      optimized_threshold_search_started: false,
      live_execution_started: false,
    },
    artifacts,
  };

  await writeJson(path.join(artifactDir, "exit-expression-input.schema.json"), exitInputSchema);
  await writeJson(path.join(artifactDir, "exit-expression-output.schema.json"), exitOutputSchema);
  await writeJson(path.join(artifactDir, "exit-expression-research-boundary.json"), exitResearchBoundary);
  await writeJson(path.join(artifactDir, "gate70b-summary.json"), summary);
  await writeText(reportPath, renderReport(summary));
  await writeShaManifest(path.join(artifactDir, "gate70b-sha256.txt"), GATE_ID, COMMAND, [
    { label: "exit_input_schema", path: path.join(artifactDir, "exit-expression-input.schema.json") },
    { label: "exit_output_schema", path: path.join(artifactDir, "exit-expression-output.schema.json") },
    { label: "exit_research_boundary", path: path.join(artifactDir, "exit-expression-research-boundary.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate70b-summary.json") },
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
