import { mkdir } from "node:fs/promises";
import path from "node:path";

import { fileHash, gitCommit, parseArgMap, toRepoRelative, writeJson, writeShaManifest, writeText } from "./gate65-utils";
import {
  DEFAULT_GATE69A_DIR,
  DEFAULT_GATE69B_DIR,
  DEFAULT_GATE69C_DIR,
  DEFAULT_GATE69D_DIR,
  DEFAULT_GATE70A_DIR,
  GATE70_DATE,
  LOCKED_DEFAULT_CANDIDATE_ID,
  LOCKED_FINAL_ALGORITHM_ID,
  SHADOW_CANARY_CANDIDATE_ID,
  SHADOW_CANARY_ID,
  baseNoMutationAssertions,
  gate70PassGate69Inputs,
  loadGate69Closeout,
} from "./gate70-utils";

const GATE_ID = "Gate 70A: locked-brain-input-preflight";
const COMMAND = "npm run engine:gate70a:locked-brain-input-preflight";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate70a/GATE70A_LOCKED_BRAIN_INPUT_PREFLIGHT_${GATE70_DATE}.md`;

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE70A_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate69aDir: args.get("--gate69a-dir") ?? DEFAULT_GATE69A_DIR,
    gate69bDir: args.get("--gate69b-dir") ?? DEFAULT_GATE69B_DIR,
    gate69cDir: args.get("--gate69c-dir") ?? DEFAULT_GATE69C_DIR,
    gate69dDir: args.get("--gate69d-dir") ?? DEFAULT_GATE69D_DIR,
  };
}

function renderReport(summary: Record<string, unknown>) {
  return [
    "# Gate 70A Locked Brain Input Preflight",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Locks Candidate B ledger as the read-only input for later exits/risk work.",
    "- Locks Candidate C shadow ledger as monitoring-only.",
    "- Binds both ledgers to the Gate 68 capsule and Gate 69 replay proof.",
    "- Does not evaluate exits, risk, portfolio pruning, execution, or live trading.",
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Candidate B input contract: \`${summary.artifacts["candidateBInputContract"]}\``,
    `- Candidate C monitoring contract: \`${summary.artifacts["candidateCMonitoringContract"]}\``,
    `- Input hash binding: \`${summary.artifacts["inputHashBinding"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 70A is input preflight only. Exits/risk may consume later, but cannot mutate Brain truth.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const gate69 = await loadGate69Closeout(options);
  const finalLedgerPath = path.join(options.gate69bDir, "final-forced28-decision-ledger.rows.jsonl");
  const shadowLedgerPath = path.join(options.gate69bDir, "candidate-c-shadow-canary-ledger.rows.jsonl");
  const finalLedgerFileHash = await fileHash(finalLedgerPath);
  const shadowLedgerFileHash = await fileHash(shadowLedgerPath);
  const candidateBInputContract = {
    gate_id: GATE_ID,
    contract_version: "gate70_candidate_b_readonly_input_contract_v0",
    input_role: "locked_directional_truth_source",
    locked_algorithm_id: LOCKED_FINAL_ALGORITHM_ID,
    candidate_id: LOCKED_DEFAULT_CANDIDATE_ID,
    final_algorithm_name: null,
    read_only: true,
    mutable_by_exit_layer: false,
    mutable_by_risk_layer: false,
    forced28_rows: gate69.gate69b.validation.final_ledger_shape.rows,
    weeks: gate69.gate69b.validation.final_ledger_shape.weeks,
    pairs_per_week: gate69.gate69b.validation.final_ledger_shape.expected_symbols_per_week,
    semantic_ledger_hash: gate69.gate69b.ledger_hashes.final_ledger_hash,
    file_sha256: finalLedgerFileHash,
    source_path: toRepoRelative(finalLedgerPath),
    frozen_reference_capsule_id: gate69.gate69a.lock_contract.frozen_reference_capsule_id,
    frozen_reference_capsule_sha256: gate69.gate69a.lock_contract.frozen_reference_capsule_sha256,
    allowed_future_consumers_after_explicit_gate: ["exit expression research", "risk / portfolio expression research"],
    forbidden_consumer_actions: ["rewrite direction", "drop pair from Brain truth", "change reason codes", "promote a new direction candidate", "learn new weights"],
  };
  const candidateCMonitoringContract = {
    gate_id: GATE_ID,
    contract_version: "gate70_candidate_c_shadow_monitoring_contract_v0",
    shadow_canary_id: SHADOW_CANARY_ID,
    candidate_id: SHADOW_CANARY_CANDIDATE_ID,
    monitoring_only: true,
    mutable_by_exit_layer: false,
    mutable_by_risk_layer: false,
    can_override_candidate_b: false,
    can_block_candidate_b_expression_without_future_gate: false,
    forced28_rows: gate69.gate69b.validation.shadow_ledger_shape.rows,
    semantic_ledger_hash: gate69.gate69b.ledger_hashes.shadow_ledger_hash,
    file_sha256: shadowLedgerFileHash,
    source_path: toRepoRelative(shadowLedgerPath),
    allowed_future_use: ["robustness comparison", "canary alerts", "post-close monitoring"],
    forbidden_future_use_without_gate: ["default promotion", "silent risk veto", "live execution control", "direction rewrite"],
  };
  const inputHashBinding = {
    gate_id: GATE_ID,
    gate69_verdicts: {
      gate69a: gate69.gate69a.verdict,
      gate69b: gate69.gate69b.verdict,
      gate69c: gate69.gate69c.verdict,
      gate69d: gate69.gate69d.verdict,
    },
    final_ledger_hash: gate69.gate69b.ledger_hashes.final_ledger_hash,
    final_ledger_file_sha256: finalLedgerFileHash,
    shadow_ledger_hash: gate69.gate69b.ledger_hashes.shadow_ledger_hash,
    shadow_ledger_file_sha256: shadowLedgerFileHash,
    capsule_id: gate69.gate69a.lock_contract.frozen_reference_capsule_id,
    capsule_sha256: gate69.gate69a.lock_contract.frozen_reference_capsule_sha256,
    replay_deterministic: gate69.gate69b.validation.replay_deterministic,
    no_mutation_assertions: baseNoMutationAssertions(),
  };
  const pass =
    gate70PassGate69Inputs(gate69) &&
    finalLedgerFileHash === "92C9E090F14B3EF2F96C78E749D9783F0F8F0E8E6CEA4900FDEFB115ED1BAD03" &&
    shadowLedgerFileHash === "B21018FB5B5394277EB1C4A503BBC509E63EDDED90B1757BE63088515DFDE91E" &&
    candidateBInputContract.read_only &&
    candidateBInputContract.mutable_by_exit_layer === false &&
    candidateBInputContract.mutable_by_risk_layer === false &&
    candidateCMonitoringContract.monitoring_only &&
    candidateCMonitoringContract.can_override_candidate_b === false;
  const artifacts = {
    candidateBInputContract: toRepoRelative(path.join(artifactDir, "candidate-b-readonly-input-contract.json")),
    candidateCMonitoringContract: toRepoRelative(path.join(artifactDir, "candidate-c-shadow-monitoring-contract.json")),
    inputHashBinding: toRepoRelative(path.join(artifactDir, "locked-input-hash-binding.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate70a-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate70a-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_LOCKED_BRAIN_INPUT_PREFLIGHT__B_READONLY_C_MONITORING_ONLY" : "FAIL_LOCKED_BRAIN_INPUT_PREFLIGHT",
    validation: {
      gate69_inputs_passed: gate70PassGate69Inputs(gate69),
      final_ledger_file_hash_matches_gate69: candidateBInputContract.file_sha256 === "92C9E090F14B3EF2F96C78E749D9783F0F8F0E8E6CEA4900FDEFB115ED1BAD03",
      shadow_ledger_file_hash_matches_gate69: candidateCMonitoringContract.file_sha256 === "B21018FB5B5394277EB1C4A503BBC509E63EDDED90B1757BE63088515DFDE91E",
      candidate_b_read_only: candidateBInputContract.read_only,
      candidate_c_monitoring_only: candidateCMonitoringContract.monitoring_only,
      exits_started: false,
      risk_started: false,
      mt5_live_started: false,
      learning_started: false,
    },
    artifacts,
  };

  await writeJson(path.join(artifactDir, "candidate-b-readonly-input-contract.json"), candidateBInputContract);
  await writeJson(path.join(artifactDir, "candidate-c-shadow-monitoring-contract.json"), candidateCMonitoringContract);
  await writeJson(path.join(artifactDir, "locked-input-hash-binding.json"), inputHashBinding);
  await writeJson(path.join(artifactDir, "gate70a-summary.json"), summary);
  await writeText(reportPath, renderReport(summary));
  await writeShaManifest(path.join(artifactDir, "gate70a-sha256.txt"), GATE_ID, COMMAND, [
    { label: "candidate_b_input_contract", path: path.join(artifactDir, "candidate-b-readonly-input-contract.json") },
    { label: "candidate_c_monitoring_contract", path: path.join(artifactDir, "candidate-c-shadow-monitoring-contract.json") },
    { label: "input_hash_binding", path: path.join(artifactDir, "locked-input-hash-binding.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate70a-summary.json") },
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
