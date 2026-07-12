import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  ARCHITECTURE_VERSION,
  DEFAULT_GATE68D_DIR,
  DEFAULT_GATE69A_DIR,
  DEFAULT_GATE69B_DIR,
  DEFAULT_GATE69C_DIR,
  GATE69_DATE,
  LOCKED_DEFAULT_CANDIDATE_ID,
  LOCKED_FINAL_ALGORITHM_ID,
  SHADOW_CANARY_CANDIDATE_ID,
  SHADOW_CANARY_ID,
} from "./gate69-utils";
import { gitCommit, parseArgMap, readJson, toRepoRelative, writeJson, writeShaManifest, writeText } from "./gate65-utils";

const GATE_ID = "Gate 69C: exit-risk-interface-and-no-drift";
const COMMAND = "npm run engine:gate69c:exit-risk-interface-and-no-drift";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate69c/GATE69C_EXIT_RISK_INTERFACE_AND_NO_DRIFT_${GATE69_DATE}.md`;

type Gate69aSummary = {
  verdict: string;
  lock_contract: {
    frozen_reference_capsule_id: string;
    frozen_reference_capsule_sha256: string;
  };
};

type Gate69bSummary = {
  verdict: string;
  ledger_hashes: {
    final_ledger_hash: string;
    shadow_ledger_hash: string;
  };
  validation: {
    replay_deterministic: boolean;
    output_ledgers_include_outcomes: boolean;
  };
};

type Gate68dSummary = {
  verdict: string;
  validation: {
    drift_monitor_can_change_decisions: boolean;
    drift_monitor_can_update_rules: boolean;
    drift_monitor_can_select_better_candidate: boolean;
    risk_exits_execution_fields_mixed_into_brain_truth: boolean;
    adaptive_learning_started: boolean;
  };
};

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE69C_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate68dDir: args.get("--gate68d-dir") ?? DEFAULT_GATE68D_DIR,
    gate69aDir: args.get("--gate69a-dir") ?? DEFAULT_GATE69A_DIR,
    gate69bDir: args.get("--gate69b-dir") ?? DEFAULT_GATE69B_DIR,
  };
}

function requiredString() {
  return { type: "string", minLength: 1 };
}

function renderReport(summary: Record<string, unknown>) {
  return [
    "# Gate 69C Exit/Risk Interface And No-Drift Contract",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Defines the exact Brain output interface exits/risk may consume later.",
    "- Keeps Brain forced-28 truth immutable and separate from later portfolio expression.",
    "- Binds no-drift rules to the Gate 68 capsule and Gate 69 final ledger hashes.",
    "- Does not implement exits, sizing, risk overlays, P&L attribution, execution, MT5/live, or app runtime work.",
    "",
    "## Interface Summary",
    "",
    "```json",
    JSON.stringify(summary.interface_summary, null, 2),
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
    `- Brain output interface schema: \`${summary.artifacts["brainOutputInterfaceSchema"]}\``,
    `- Exit/risk consumption contract: \`${summary.artifacts["exitRiskConsumptionContract"]}\``,
    `- No-drift lock contract: \`${summary.artifacts["noDriftLockContract"]}\``,
    `- Forward handoff contract: \`${summary.artifacts["forwardHandoffContract"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 69C prepares the interface only. Exits and risk are not implemented or opened in this gate.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const gate68d = await readJson<Gate68dSummary>(path.join(options.gate68dDir, "gate68d-summary.json"));
  const gate69a = await readJson<Gate69aSummary>(path.join(options.gate69aDir, "gate69a-summary.json"));
  const gate69b = await readJson<Gate69bSummary>(path.join(options.gate69bDir, "gate69b-summary.json"));
  const brainOutputInterfaceSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Gate 69 Final Forced-28 Brain Output Interface",
    type: "object",
    additionalProperties: false,
    required: [
      "week_open_utc",
      "symbol",
      "base_currency",
      "quote_currency",
      "final_direction",
      "final_side",
      "locked_algorithm_id",
      "default_candidate_id",
      "shadow_candidate_id",
      "frozen_reference_capsule_id",
      "frozen_reference_capsule_sha256",
      "final_ledger_hash",
      "shadow_ledger_hash",
      "decision_hash",
      "reason_codes",
      "warning_active",
      "fallback_used",
      "veto_used",
      "cell_roles",
      "cell_quality_states",
      "scenario_group_key",
      "architecture_version",
      "brain_truth_forced28",
      "risk_can_reduce_trade_expression_later",
      "risk_can_mutate_brain_truth",
    ],
    properties: {
      week_open_utc: requiredString(),
      symbol: requiredString(),
      base_currency: { type: ["string", "null"] },
      quote_currency: { type: ["string", "null"] },
      final_direction: { enum: ["BASE_CURRENCY", "QUOTE_CURRENCY"] },
      final_side: { enum: ["LONG", "SHORT"] },
      locked_algorithm_id: { const: LOCKED_FINAL_ALGORITHM_ID },
      default_candidate_id: { const: LOCKED_DEFAULT_CANDIDATE_ID },
      shadow_candidate_id: { const: SHADOW_CANARY_CANDIDATE_ID },
      frozen_reference_capsule_id: { const: gate69a.lock_contract.frozen_reference_capsule_id },
      frozen_reference_capsule_sha256: { const: gate69a.lock_contract.frozen_reference_capsule_sha256 },
      final_ledger_hash: { const: gate69b.ledger_hashes.final_ledger_hash },
      shadow_ledger_hash: { const: gate69b.ledger_hashes.shadow_ledger_hash },
      decision_hash: requiredString(),
      reason_codes: { type: "array", items: requiredString() },
      warning_active: { type: "boolean" },
      fallback_used: { type: "boolean" },
      veto_used: { type: "boolean" },
      cell_roles: { type: "object" },
      cell_quality_states: { type: "object" },
      scenario_group_key: { type: ["string", "null"] },
      architecture_version: { const: ARCHITECTURE_VERSION },
      brain_truth_forced28: { const: true },
      risk_can_reduce_trade_expression_later: { const: true },
      risk_can_mutate_brain_truth: { const: false },
    },
  };
  const exitRiskConsumptionContract = {
    gate_id: GATE_ID,
    contract_version: "gate69_exit_risk_consumption_contract_v0",
    allowed_consumers_after_future_gate: ["exits", "risk", "portfolio expression"],
    allowed_inputs: [
      "final forced-28 decision ledger rows",
      "Candidate C shadow/canary ledger rows",
      "reason codes",
      "warning/fallback/veto flags",
      "cell roles and quality states",
      "capsule and ledger hashes",
    ],
    forbidden_inputs_for_brain_mutation: ["P&L attribution", "future returns", "portfolio drawdown", "execution fill quality", "live broker outcomes"],
    forbidden_consumer_actions: ["change Brain decisions", "drop pairs from Brain truth", "rewrite final ledger", "promote shadow canary silently", "learn new weights"],
    risk_layer_may_reduce_actual_trade_expression_later: true,
    shadow_ledger_must_retain_all_28_signal_outcomes: true,
    brain_forced28_truth_mutable_by_risk: false,
  };
  const noDriftLockContract = {
    gate_id: GATE_ID,
    contract_version: "gate69_no_drift_lock_contract_v0",
    frozen_reference_capsule_id: gate69a.lock_contract.frozen_reference_capsule_id,
    final_ledger_hash: gate69b.ledger_hashes.final_ledger_hash,
    shadow_ledger_hash: gate69b.ledger_hashes.shadow_ledger_hash,
    immutable_surfaces: ["Candidate B default lock contract", "Candidate C shadow/canary contract", "final forced-28 decision ledger", "shadow canary ledger", "Gate 68 frozen capsule binding"],
    append_only_surfaces: ["future weekly Brain decisions", "future shadow canary decisions", "future closed-week observations", "drift alerts"],
    forbidden_mutations: ["historical ledger rewrite", "silent learning", "rolling retraining", "source mutation", "COT retuning", "Strength retuning", "Regime retuning", "risk mutation of Brain truth"],
    any_change_requires_future_versioned_research_gate: true,
  };
  const forwardHandoffContract = {
    gate_id: GATE_ID,
    contract_version: "gate69_forward_exit_risk_prep_v0",
    next_gate_may_open_exits_or_risk_only_after_explicit_instruction: true,
    current_gate_starts_exits_or_risk: false,
    final_default_algorithm_reference: LOCKED_FINAL_ALGORITHM_ID,
    final_algorithm_name: null,
    default_candidate_id: LOCKED_DEFAULT_CANDIDATE_ID,
    shadow_canary_id: SHADOW_CANARY_ID,
    frozen_reference_capsule_id: gate69a.lock_contract.frozen_reference_capsule_id,
    required_forward_fields: brainOutputInterfaceSchema.required,
  };
  const forbiddenRiskFields = ["position_size", "stop_loss", "take_profit", "risk_budget", "portfolio_weight", "execution_order_type"];
  const schemaText = JSON.stringify(brainOutputInterfaceSchema);
  const forbiddenRiskFieldCount = forbiddenRiskFields.filter((field) => schemaText.includes(field)).length;
  const pass =
    gate68d.verdict.startsWith("PASS_") &&
    gate69a.verdict.startsWith("PASS_") &&
    gate69b.verdict.startsWith("PASS_") &&
    gate69b.validation.replay_deterministic &&
    gate69b.validation.output_ledgers_include_outcomes === false &&
    gate68d.validation.drift_monitor_can_change_decisions === false &&
    gate68d.validation.drift_monitor_can_update_rules === false &&
    gate68d.validation.drift_monitor_can_select_better_candidate === false &&
    gate68d.validation.risk_exits_execution_fields_mixed_into_brain_truth === false &&
    gate68d.validation.adaptive_learning_started === false &&
    exitRiskConsumptionContract.brain_forced28_truth_mutable_by_risk === false &&
    forbiddenRiskFieldCount === 0;
  const artifacts = {
    brainOutputInterfaceSchema: toRepoRelative(path.join(artifactDir, "final-forced28-brain-output-interface.schema.json")),
    exitRiskConsumptionContract: toRepoRelative(path.join(artifactDir, "exit-risk-consumption-contract.json")),
    noDriftLockContract: toRepoRelative(path.join(artifactDir, "no-drift-lock-contract.json")),
    forwardHandoffContract: toRepoRelative(path.join(artifactDir, "forward-exit-risk-prep-handoff-contract.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate69c-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate69c-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_EXIT_RISK_INTERFACE_AND_NO_DRIFT__BRAIN_FORCED28_OUTPUT_ONLY_RISK_MUTATION_FORBIDDEN" : "FAIL_EXIT_RISK_INTERFACE_AND_NO_DRIFT",
    interface_summary: {
      locked_algorithm_id: LOCKED_FINAL_ALGORITHM_ID,
      final_algorithm_name: null,
      default_candidate_id: LOCKED_DEFAULT_CANDIDATE_ID,
      shadow_candidate_id: SHADOW_CANARY_CANDIDATE_ID,
      frozen_reference_capsule_id: gate69a.lock_contract.frozen_reference_capsule_id,
      final_ledger_hash: gate69b.ledger_hashes.final_ledger_hash,
      shadow_ledger_hash: gate69b.ledger_hashes.shadow_ledger_hash,
      risk_can_reduce_trade_expression_later: true,
      risk_can_mutate_brain_truth: false,
    },
    validation: {
      gate68d_passed: gate68d.verdict.startsWith("PASS_"),
      gate69a_passed: gate69a.verdict.startsWith("PASS_"),
      gate69b_passed: gate69b.verdict.startsWith("PASS_"),
      replay_deterministic: gate69b.validation.replay_deterministic,
      output_ledgers_include_outcomes: gate69b.validation.output_ledgers_include_outcomes,
      drift_monitor_can_change_decisions: gate68d.validation.drift_monitor_can_change_decisions,
      drift_monitor_can_update_rules: gate68d.validation.drift_monitor_can_update_rules,
      drift_monitor_can_select_better_candidate: gate68d.validation.drift_monitor_can_select_better_candidate,
      risk_exits_execution_fields_mixed_into_brain_truth: gate68d.validation.risk_exits_execution_fields_mixed_into_brain_truth,
      forbidden_risk_execution_schema_fields_found: forbiddenRiskFieldCount,
      exits_risk_started: false,
      adaptive_learning_started: false,
    },
    artifacts,
  };

  await writeJson(path.join(artifactDir, "final-forced28-brain-output-interface.schema.json"), brainOutputInterfaceSchema);
  await writeJson(path.join(artifactDir, "exit-risk-consumption-contract.json"), exitRiskConsumptionContract);
  await writeJson(path.join(artifactDir, "no-drift-lock-contract.json"), noDriftLockContract);
  await writeJson(path.join(artifactDir, "forward-exit-risk-prep-handoff-contract.json"), forwardHandoffContract);
  await writeJson(path.join(artifactDir, "gate69c-summary.json"), summary);
  await writeText(reportPath, renderReport(summary));
  await writeShaManifest(path.join(artifactDir, "gate69c-sha256.txt"), GATE_ID, COMMAND, [
    { label: "brain_output_interface_schema", path: path.join(artifactDir, "final-forced28-brain-output-interface.schema.json") },
    { label: "exit_risk_consumption_contract", path: path.join(artifactDir, "exit-risk-consumption-contract.json") },
    { label: "no_drift_lock_contract", path: path.join(artifactDir, "no-drift-lock-contract.json") },
    { label: "forward_handoff_contract", path: path.join(artifactDir, "forward-exit-risk-prep-handoff-contract.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate69c-summary.json") },
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
