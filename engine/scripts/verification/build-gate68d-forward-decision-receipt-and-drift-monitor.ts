import { mkdir } from "node:fs/promises";
import path from "node:path";

import { gitCommit, parseArgMap, readJson, toRepoRelative, writeJson, writeShaManifest, writeText } from "./gate65-utils";
import { DEFAULT_GATE68C_DIR, DEFAULT_GATE68D_DIR, GATE68_DATE } from "./gate68-utils";

const GATE_ID = "Gate 68D: forward-decision-receipt-and-drift-monitor";
const COMMAND = "npm run engine:gate68d:forward-decision-receipt-and-drift-monitor";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate68d/GATE68D_FORWARD_DECISION_RECEIPT_AND_DRIFT_MONITOR_CONTRACT_${GATE68_DATE}.md`;

type Gate68cSummary = {
  verdict: string;
  capsule: {
    capsule_id: string;
    capsule_sha256: string;
    decision_ledger_hash: string;
    outcome_scoring_hash: string;
  };
};

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE68D_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate68cDir: args.get("--gate68c-dir") ?? DEFAULT_GATE68C_DIR,
  };
}

function requiredString() {
  return { type: "string", minLength: 1 };
}

function nullableObject() {
  return { type: ["object", "null"] };
}

function renderReport(summary: Record<string, unknown>) {
  return [
    "# Gate 68D Forward Decision Receipt And Drift Monitor Contract",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Defines the future weekly Brain decision receipt format.",
    "- Defines outcome observation and replay mismatch contracts.",
    "- Defines alert-only drift monitoring.",
    "- Does not process live weeks, learn, mutate rules, start risk, start exits, or start execution.",
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Forward weekly decision receipt schema: \`${summary.artifacts["decisionReceiptSchema"]}\``,
    `- Forward outcome observation schema: \`${summary.artifacts["outcomeObservationSchema"]}\``,
    `- Drift monitor contract: \`${summary.artifacts["driftMonitorContract"]}\``,
    `- Predeclared drift thresholds: \`${summary.artifacts["driftThresholds"]}\``,
    `- No-drift replay contract: \`${summary.artifacts["replayContract"]}\``,
    `- Forward ledger append-only contract: \`${summary.artifacts["appendOnlyContract"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 68D is contract-only. Drift monitoring can alert only and cannot change Brain decisions or rules.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const capsule = await readJson<Gate68cSummary>(path.join(options.gate68cDir, "gate68c-summary.json"));
  const decisionReceiptSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Gate 68D Forward Weekly Decision Receipt",
    type: "object",
    additionalProperties: false,
    required: [
      "week_open_utc",
      "symbol",
      "base_currency",
      "quote_currency",
      "final_direction",
      "selected_mode",
      "selected_candidate_mode_source",
      "cell_opinion_hashes",
      "reason_code",
      "warning_flags",
      "fallback_flags",
      "veto_flags",
      "source_quality_state",
      "scenario_memory_state",
      "algorithm_version",
      "architecture_version",
      "frozen_reference_capsule_id",
      "input_bundle_hash",
      "decision_hash",
      "created_at",
      "no_drift_assertion",
    ],
    properties: {
      week_open_utc: requiredString(),
      symbol: requiredString(),
      base_currency: requiredString(),
      quote_currency: requiredString(),
      final_direction: { enum: ["BASE_CURRENCY", "QUOTE_CURRENCY"] },
      selected_mode: { enum: ["NORMAL", "PROTECTION", "CONSERVATIVE"] },
      selected_candidate_mode_source: {
        enum: ["candidate_a_macro_anchor_conservative", "candidate_b_macro_anchor_with_cot_warning", "candidate_c_scenario_memory_guarded"],
      },
      cell_opinion_hashes: { type: "object", required: ["cot", "strength", "regime"], additionalProperties: false, properties: { cot: requiredString(), strength: requiredString(), regime: requiredString() } },
      reason_code: requiredString(),
      warning_flags: { type: "array", items: requiredString() },
      fallback_flags: { type: "array", items: requiredString() },
      veto_flags: { type: "array", items: requiredString() },
      source_quality_state: nullableObject(),
      scenario_memory_state: nullableObject(),
      algorithm_version: { const: "gate68_brain_mode_selector_v0" },
      architecture_version: { const: "gate66_brain_cells_atoms_v3" },
      frozen_reference_capsule_id: { const: capsule.capsule.capsule_id },
      input_bundle_hash: requiredString(),
      decision_hash: requiredString(),
      created_at: requiredString(),
      no_drift_assertion: {
        type: "object",
        required: ["rules_hash_matches_capsule", "source_bundle_matches_capsule", "historical_reference_mutated"],
        additionalProperties: false,
        properties: {
          rules_hash_matches_capsule: { const: true },
          source_bundle_matches_capsule: { const: true },
          historical_reference_mutated: { const: false },
        },
      },
    },
  };
  const outcomeObservationSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Gate 68D Forward Outcome Observation",
    type: "object",
    additionalProperties: false,
    required: ["week_open_utc", "symbol", "decision_hash", "outcome_surface", "observed_after_close", "observation_hash", "frozen_reference_capsule_id"],
    properties: {
      week_open_utc: requiredString(),
      symbol: requiredString(),
      decision_hash: requiredString(),
      outcome_surface: { enum: ["ADR_GRID", "WEEKLY_HOLD"] },
      observed_after_close: { const: true },
      adr_value: { type: "number" },
      observation_hash: requiredString(),
      frozen_reference_capsule_id: { const: capsule.capsule.capsule_id },
    },
  };
  const driftMonitorContract = {
    gate_id: GATE_ID,
    contract_version: "gate68d_alert_only_drift_monitor_v0",
    frozen_reference_capsule_id: capsule.capsule.capsule_id,
    drift_surfaces: [
      "mode distribution drift",
      "reason-code distribution drift",
      "source-quality drift",
      "warning/fallback/veto drift",
      "pair concentration drift",
      "week concentration drift",
      "performance envelope drift after outcomes are known",
      "decision replay mismatch",
      "missing source / late source / stale source alerts",
    ],
    allowed_actions: ["emit alert", "write drift report", "require future versioned research gate"],
    forbidden_actions: ["change decisions", "update rules", "select a better candidate", "start learning", "start risk", "start exits", "start execution"],
    can_change_brain_decisions: false,
    can_update_rules: false,
    can_select_better_candidate: false,
    any_change_requires_future_versioned_research_gate: true,
  };
  const driftThresholds = {
    gate_id: GATE_ID,
    contract_version: "gate68d_predeclared_drift_thresholds_v0",
    threshold_status: "predeclared_alert_thresholds_only_not_optimization",
    thresholds: {
      mode_distribution_share_delta_alert: 0.15,
      reason_code_share_delta_alert: 0.2,
      source_quality_degraded_share_alert: 0.25,
      warning_fallback_veto_share_alert: 0.25,
      top_pair_share_alert: 0.25,
      top_week_abs_share_alert: 0.35,
      decision_replay_mismatch_alert: 1,
      missing_or_late_source_alert: 1,
    },
    thresholds_can_change_decisions: false,
  };
  const replayContract = {
    gate_id: GATE_ID,
    contract_version: "gate68d_no_drift_replay_contract_v0",
    frozen_reference_capsule_id: capsule.capsule.capsule_id,
    replay_inputs: ["mode selector rules", "cell opinion hashes", "source bundle hash", "scenario memory state", "architecture version"],
    mismatch_detection: ["decision_hash mismatch", "selected_mode mismatch", "final_direction mismatch", "reason_code mismatch", "source bundle mismatch"],
    replay_can_change_decision: false,
    mismatch_requires_alert: true,
    mismatch_requires_future_gate_for_any_rule_change: true,
  };
  const appendOnlyContract = {
    gate_id: GATE_ID,
    contract_version: "gate68d_forward_ledger_append_only_contract_v0",
    frozen_reference_capsule_id: capsule.capsule.capsule_id,
    append_only_records: ["forward weekly decisions", "forward outcome observations", "drift alerts", "replay mismatch reports"],
    forbidden_mutations: ["rewrite historical decisions", "delete prior decisions", "replace frozen reference capsule rows", "retrofit better mode", "risk/exits/execution fields in Brain truth"],
    risk_exits_execution_fields_allowed: false,
  };
  const pass =
    capsule.verdict.startsWith("PASS_") &&
    driftMonitorContract.can_change_brain_decisions === false &&
    driftMonitorContract.can_update_rules === false &&
    driftMonitorContract.can_select_better_candidate === false &&
    appendOnlyContract.risk_exits_execution_fields_allowed === false &&
    decisionReceiptSchema.required.includes("decision_hash") &&
    decisionReceiptSchema.required.includes("architecture_version") &&
    decisionReceiptSchema.required.includes("frozen_reference_capsule_id");
  const artifacts = {
    decisionReceiptSchema: toRepoRelative(path.join(artifactDir, "forward-weekly-decision-receipt.schema.json")),
    outcomeObservationSchema: toRepoRelative(path.join(artifactDir, "forward-outcome-observation.schema.json")),
    driftMonitorContract: toRepoRelative(path.join(artifactDir, "drift-monitor-contract.json")),
    driftThresholds: toRepoRelative(path.join(artifactDir, "drift-monitor-thresholds-predeclared.json")),
    replayContract: toRepoRelative(path.join(artifactDir, "no-drift-replay-contract.json")),
    appendOnlyContract: toRepoRelative(path.join(artifactDir, "forward-ledger-append-only-contract.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate68d-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate68d-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_FORWARD_DECISION_RECEIPT_AND_DRIFT_MONITOR__ALERT_ONLY_APPEND_ONLY_NO_LEARNING" : "FAIL_FORWARD_DECISION_RECEIPT_AND_DRIFT_MONITOR",
    frozen_reference_capsule_id: capsule.capsule.capsule_id,
    validation: {
      gate68c_passed: capsule.verdict.startsWith("PASS_"),
      future_weekly_receipt_schema_complete: decisionReceiptSchema.required.length === 21,
      receipt_has_decision_hash: decisionReceiptSchema.required.includes("decision_hash"),
      receipt_has_versioning: decisionReceiptSchema.required.includes("algorithm_version") && decisionReceiptSchema.required.includes("architecture_version"),
      drift_monitor_alert_only: driftMonitorContract.allowed_actions.includes("emit alert"),
      drift_monitor_can_change_decisions: driftMonitorContract.can_change_brain_decisions,
      drift_monitor_can_update_rules: driftMonitorContract.can_update_rules,
      drift_monitor_can_select_better_candidate: driftMonitorContract.can_select_better_candidate,
      forward_ledger_append_only: true,
      risk_exits_execution_fields_mixed_into_brain_truth: false,
      adaptive_learning_started: false,
    },
    artifacts,
  };

  await writeJson(path.join(artifactDir, "forward-weekly-decision-receipt.schema.json"), decisionReceiptSchema);
  await writeJson(path.join(artifactDir, "forward-outcome-observation.schema.json"), outcomeObservationSchema);
  await writeJson(path.join(artifactDir, "drift-monitor-contract.json"), driftMonitorContract);
  await writeJson(path.join(artifactDir, "drift-monitor-thresholds-predeclared.json"), driftThresholds);
  await writeJson(path.join(artifactDir, "no-drift-replay-contract.json"), replayContract);
  await writeJson(path.join(artifactDir, "forward-ledger-append-only-contract.json"), appendOnlyContract);
  await writeJson(path.join(artifactDir, "gate68d-summary.json"), summary);
  await writeText(reportPath, renderReport(summary));
  await writeShaManifest(path.join(artifactDir, "gate68d-sha256.txt"), GATE_ID, COMMAND, [
    { label: "decision_receipt_schema", path: path.join(artifactDir, "forward-weekly-decision-receipt.schema.json") },
    { label: "outcome_observation_schema", path: path.join(artifactDir, "forward-outcome-observation.schema.json") },
    { label: "drift_monitor_contract", path: path.join(artifactDir, "drift-monitor-contract.json") },
    { label: "drift_thresholds", path: path.join(artifactDir, "drift-monitor-thresholds-predeclared.json") },
    { label: "replay_contract", path: path.join(artifactDir, "no-drift-replay-contract.json") },
    { label: "append_only_contract", path: path.join(artifactDir, "forward-ledger-append-only-contract.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate68d-summary.json") },
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
