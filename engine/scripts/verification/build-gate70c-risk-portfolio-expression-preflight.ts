import { mkdir } from "node:fs/promises";
import path from "node:path";

import { gitCommit, parseArgMap, readJson, toRepoRelative, writeJson, writeShaManifest, writeText } from "./gate65-utils";
import {
  DEFAULT_GATE70A_DIR,
  DEFAULT_GATE70B_DIR,
  DEFAULT_GATE70C_DIR,
  GATE70_DATE,
  LOCKED_FINAL_ALGORITHM_ID,
  SHADOW_CANARY_ID,
  requiredString,
} from "./gate70-utils";

const GATE_ID = "Gate 70C: risk-portfolio-expression-preflight";
const COMMAND = "npm run engine:gate70c:risk-portfolio-expression-preflight";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate70c/GATE70C_RISK_PORTFOLIO_EXPRESSION_PREFLIGHT_${GATE70_DATE}.md`;

type Gate70aSummary = {
  verdict: string;
  validation: { candidate_b_read_only: boolean; candidate_c_monitoring_only: boolean; exits_started: boolean; risk_started: boolean };
};

type Gate70bSummary = {
  verdict: string;
  validation: {
    exit_layer_may_change_weekly_signal_truth: boolean;
    exit_layer_may_drop_brain_rows: boolean;
    exit_policy_scoring_started: boolean;
    live_execution_started: boolean;
  };
};

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE70C_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate70aDir: args.get("--gate70a-dir") ?? DEFAULT_GATE70A_DIR,
    gate70bDir: args.get("--gate70b-dir") ?? DEFAULT_GATE70B_DIR,
  };
}

function renderReport(summary: Record<string, unknown>) {
  return [
    "# Gate 70C Risk / Portfolio Expression Preflight",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Defines how a later risk/portfolio layer may consume the locked Brain output.",
    "- Risk may reduce actual trade expression, but cannot mutate Candidate B direction truth.",
    "- Candidate C remains monitoring-only.",
    "- Does not run risk pruning, portfolio expression matrices, sizing, execution, or P&L attribution.",
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Risk expression input schema: \`${summary.artifacts["riskExpressionInputSchema"]}\``,
    `- Risk expression output schema: \`${summary.artifacts["riskExpressionOutputSchema"]}\``,
    `- Portfolio expression boundary: \`${summary.artifacts["portfolioExpressionBoundary"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 70C is risk-interface preflight only. Risk/pruning matrices are not opened.",
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
  const gate70b = await readJson<Gate70bSummary>(path.join(options.gate70bDir, "gate70b-summary.json"));
  const riskExpressionInputSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Gate 70C Risk / Portfolio Expression Input",
    type: "object",
    additionalProperties: false,
    required: ["week_open_utc", "symbol", "decision_hash", "locked_algorithm_id", "final_direction", "final_side", "forced28_brain_truth", "shadow_canary_id"],
    properties: {
      week_open_utc: requiredString(),
      symbol: requiredString(),
      decision_hash: requiredString(),
      locked_algorithm_id: { const: LOCKED_FINAL_ALGORITHM_ID },
      final_direction: { enum: ["BASE_CURRENCY", "QUOTE_CURRENCY"] },
      final_side: { enum: ["LONG", "SHORT"] },
      forced28_brain_truth: { const: true },
      shadow_canary_id: { const: SHADOW_CANARY_ID },
    },
  };
  const riskExpressionOutputSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Gate 70C Risk / Portfolio Expression Output",
    type: "object",
    additionalProperties: false,
    required: [
      "week_open_utc",
      "symbol",
      "decision_hash",
      "final_direction",
      "final_side",
      "expression_permission",
      "expression_reason_codes",
      "brain_direction_mutated",
      "brain_ledger_row_removed",
      "shadow_ledger_row_removed",
      "output_hash",
    ],
    properties: {
      week_open_utc: requiredString(),
      symbol: requiredString(),
      decision_hash: requiredString(),
      final_direction: { enum: ["BASE_CURRENCY", "QUOTE_CURRENCY"] },
      final_side: { enum: ["LONG", "SHORT"] },
      expression_permission: { enum: ["EXPRESS_TRADE", "REDUCE_OR_SKIP_EXPRESSION"] },
      expression_reason_codes: { type: "array", items: requiredString() },
      brain_direction_mutated: { const: false },
      brain_ledger_row_removed: { const: false },
      shadow_ledger_row_removed: { const: false },
      output_hash: requiredString(),
    },
  };
  const portfolioExpressionBoundary = {
    gate_id: GATE_ID,
    contract_version: "gate70_portfolio_expression_boundary_v0",
    allowed_future_research_after_explicit_gate: [
      "trade expression permission",
      "portfolio-level exposure pruning",
      "risk budget comparison",
      "correlation or concentration controls",
      "drawdown-aware expression reduction",
    ],
    forbidden_in_gate70: ["risk matrix scoring", "portfolio pruning run", "position sizing", "P&L attribution", "execution routing", "live trading"],
    risk_may_reduce_actual_trade_expression_later: true,
    risk_may_mutate_brain_truth: false,
    risk_may_remove_rows_from_shadow_ledger: false,
    candidate_c_shadow_monitoring_only: true,
    alpha_and_regime_layers_remain_forced28: true,
    mt5_live_closed: true,
    learning_append_only_alert_only: true,
  };
  const pass =
    gate70a.verdict.startsWith("PASS_") &&
    gate70b.verdict.startsWith("PASS_") &&
    gate70a.validation.candidate_b_read_only &&
    gate70a.validation.candidate_c_monitoring_only &&
    gate70b.validation.exit_layer_may_change_weekly_signal_truth === false &&
    gate70b.validation.exit_layer_may_drop_brain_rows === false &&
    gate70b.validation.exit_policy_scoring_started === false &&
    gate70b.validation.live_execution_started === false &&
    portfolioExpressionBoundary.risk_may_reduce_actual_trade_expression_later &&
    portfolioExpressionBoundary.risk_may_mutate_brain_truth === false &&
    portfolioExpressionBoundary.risk_may_remove_rows_from_shadow_ledger === false &&
    portfolioExpressionBoundary.mt5_live_closed;
  const artifacts = {
    riskExpressionInputSchema: toRepoRelative(path.join(artifactDir, "risk-expression-input.schema.json")),
    riskExpressionOutputSchema: toRepoRelative(path.join(artifactDir, "risk-expression-output.schema.json")),
    portfolioExpressionBoundary: toRepoRelative(path.join(artifactDir, "portfolio-expression-boundary.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate70c-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate70c-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_RISK_PORTFOLIO_EXPRESSION_PREFLIGHT__MAY_REDUCE_EXPRESSION_NOT_BRAIN_TRUTH" : "FAIL_RISK_PORTFOLIO_EXPRESSION_PREFLIGHT",
    validation: {
      gate70a_passed: gate70a.verdict.startsWith("PASS_"),
      gate70b_passed: gate70b.verdict.startsWith("PASS_"),
      risk_may_reduce_actual_trade_expression_later: portfolioExpressionBoundary.risk_may_reduce_actual_trade_expression_later,
      risk_may_mutate_brain_truth: portfolioExpressionBoundary.risk_may_mutate_brain_truth,
      risk_may_remove_rows_from_shadow_ledger: portfolioExpressionBoundary.risk_may_remove_rows_from_shadow_ledger,
      candidate_c_shadow_monitoring_only: portfolioExpressionBoundary.candidate_c_shadow_monitoring_only,
      risk_matrix_scoring_started: false,
      portfolio_pruning_started: false,
      p_and_l_attribution_started: false,
      mt5_live_started: false,
      learning_started: false,
    },
    artifacts,
  };

  await writeJson(path.join(artifactDir, "risk-expression-input.schema.json"), riskExpressionInputSchema);
  await writeJson(path.join(artifactDir, "risk-expression-output.schema.json"), riskExpressionOutputSchema);
  await writeJson(path.join(artifactDir, "portfolio-expression-boundary.json"), portfolioExpressionBoundary);
  await writeJson(path.join(artifactDir, "gate70c-summary.json"), summary);
  await writeText(reportPath, renderReport(summary));
  await writeShaManifest(path.join(artifactDir, "gate70c-sha256.txt"), GATE_ID, COMMAND, [
    { label: "risk_expression_input_schema", path: path.join(artifactDir, "risk-expression-input.schema.json") },
    { label: "risk_expression_output_schema", path: path.join(artifactDir, "risk-expression-output.schema.json") },
    { label: "portfolio_expression_boundary", path: path.join(artifactDir, "portfolio-expression-boundary.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate70c-summary.json") },
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
