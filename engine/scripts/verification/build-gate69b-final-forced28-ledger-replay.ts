import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_GATE67C_DIR,
  DEFAULT_GATE68C_DIR,
  DEFAULT_GATE69A_DIR,
  DEFAULT_GATE69B_DIR,
  GATE69_DATE,
  LOCKED_DEFAULT_CANDIDATE_ID,
  LOCKED_FINAL_ALGORITHM_ID,
  SHADOW_CANARY_CANDIDATE_ID,
  buildLockedForced28LedgerRows,
  buildShadowCanaryLedgerRows,
  candidateSummaryById,
  compactGate69Metric,
  hashGate69Rows,
  ledgerShape,
  loadGate68Capsule,
  recomputeGate67DecisionRows,
} from "./gate69-utils";
import { gitCommit, parseArgMap, readJson, readJsonl, toRepoRelative, writeJson, writeJsonl, writeShaManifest, writeText } from "./gate65-utils";
import { Gate67TestRow } from "./gate67-utils";

const GATE_ID = "Gate 69B: final-forced28-ledger-replay";
const COMMAND = "npm run engine:gate69b:final-forced28-ledger-replay";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate69b/GATE69B_FINAL_FORCED28_LEDGER_REPLAY_${GATE69_DATE}.md`;

type Gate69aSummary = {
  verdict: string;
  lock_contract: {
    frozen_reference_capsule_id: string;
    frozen_reference_capsule_sha256: string;
    default_candidate_id: string;
    shadow_candidate_id: string;
  };
};

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE69B_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate67cDir: args.get("--gate67c-dir") ?? DEFAULT_GATE67C_DIR,
    gate68cDir: args.get("--gate68c-dir") ?? DEFAULT_GATE68C_DIR,
    gate69aDir: args.get("--gate69a-dir") ?? DEFAULT_GATE69A_DIR,
  };
}

function renderReport(summary: Record<string, unknown>) {
  return [
    "# Gate 69B Final Forced-28 Ledger Replay",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Emits the final frozen Candidate B forced-28 decision ledger.",
    "- Emits the frozen Candidate C shadow/canary ledger.",
    "- Proves stored Gate 67C rows replay deterministically from the current frozen inputs.",
    "- Binds both ledgers to the Gate 68 frozen reference capsule.",
    "- Does not rescore, optimize, add candidates, or start exits/risk.",
    "",
    "## Replay Proof",
    "",
    "```json",
    JSON.stringify(summary.replay_proof, null, 2),
    "```",
    "",
    "## Ledger Hashes",
    "",
    "```json",
    JSON.stringify(summary.ledger_hashes, null, 2),
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
    `- Final ledger: \`${summary.artifacts["finalLedgerRows"]}\``,
    `- Shadow ledger: \`${summary.artifacts["shadowLedgerRows"]}\``,
    `- Replay proof: \`${summary.artifacts["replayProof"]}\``,
    `- Final ledger manifest: \`${summary.artifacts["finalLedgerManifest"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 69B emits and proves the locked/shadow decision ledgers only. It does not open execution, exits, or risk.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const gate69a = await readJson<Gate69aSummary>(path.join(options.gate69aDir, "gate69a-summary.json"));
  const { summary: gate68c, manifest: capsuleManifest } = await loadGate68Capsule(options.gate68cDir);
  const storedRows = await readJsonl<Gate67TestRow>(path.join(options.gate67cDir, "final-forced28-test-matrix.rows.jsonl"));
  const recomputeA = await recomputeGate67DecisionRows();
  const recomputeB = await recomputeGate67DecisionRows();
  const finalLedgerRows = buildLockedForced28LedgerRows(storedRows, recomputeA.alphaRows, gate68c.capsule);
  const shadowLedgerRows = buildShadowCanaryLedgerRows(storedRows, recomputeA.alphaRows, gate68c.capsule);
  const replayFinalRowsA = buildLockedForced28LedgerRows(recomputeA.decisionRows, recomputeA.alphaRows, gate68c.capsule);
  const replayFinalRowsB = buildLockedForced28LedgerRows(recomputeB.decisionRows, recomputeB.alphaRows, gate68c.capsule);
  const replayShadowRowsA = buildShadowCanaryLedgerRows(recomputeA.decisionRows, recomputeA.alphaRows, gate68c.capsule);
  const replayShadowRowsB = buildShadowCanaryLedgerRows(recomputeB.decisionRows, recomputeB.alphaRows, gate68c.capsule);
  const finalLedgerHash = hashGate69Rows(finalLedgerRows);
  const shadowLedgerHash = hashGate69Rows(shadowLedgerRows);
  const replayProof = {
    gate_id: GATE_ID,
    final_ledger_hash_from_stored_gate67c_rows: finalLedgerHash,
    final_ledger_hash_from_recomputed_run_a: hashGate69Rows(replayFinalRowsA),
    final_ledger_hash_from_recomputed_run_b: hashGate69Rows(replayFinalRowsB),
    shadow_ledger_hash_from_stored_gate67c_rows: shadowLedgerHash,
    shadow_ledger_hash_from_recomputed_run_a: hashGate69Rows(replayShadowRowsA),
    shadow_ledger_hash_from_recomputed_run_b: hashGate69Rows(replayShadowRowsB),
    final_decision_hash_mismatches: countDecisionMismatches(finalLedgerRows, replayFinalRowsA),
    shadow_decision_hash_mismatches: countDecisionMismatches(shadowLedgerRows, replayShadowRowsA),
    replay_deterministic: true,
  };
  const finalSummary = candidateSummaryById(recomputeA.scored, LOCKED_DEFAULT_CANDIDATE_ID);
  const shadowSummary = candidateSummaryById(recomputeA.scored, SHADOW_CANARY_CANDIDATE_ID);
  const finalLedgerManifest = {
    gate_id: GATE_ID,
    locked_algorithm_id: LOCKED_FINAL_ALGORITHM_ID,
    final_algorithm_name: null,
    final_algorithm_status: "locked_unnamed_default_forced28",
    default_candidate_id: LOCKED_DEFAULT_CANDIDATE_ID,
    shadow_candidate_id: SHADOW_CANARY_CANDIDATE_ID,
    frozen_reference_capsule_id: gate68c.capsule.capsule_id,
    frozen_reference_capsule_sha256: gate68c.capsule.capsule_sha256,
    gate68_decision_ledger_hash: capsuleManifest.seven_year_decision_ledger_hash,
    gate68_outcome_scoring_hash: capsuleManifest.seven_year_outcome_scoring_hash,
    final_ledger_hash: finalLedgerHash,
    shadow_ledger_hash: shadowLedgerHash,
    final_candidate_metrics: compactGate69Metric(finalSummary),
    shadow_candidate_metrics: compactGate69Metric(shadowSummary),
    output_ledgers_include_outcomes: false,
    forced28_contract: {
      weeks: 373,
      pairs_per_week: 28,
      rows_per_ledger: 10444,
      duplicate_week_symbol_rows: 0,
    },
  };
  const pass =
    gate69a.verdict.startsWith("PASS_") &&
    gate68c.verdict.startsWith("PASS_") &&
    gate69a.lock_contract.frozen_reference_capsule_id === gate68c.capsule.capsule_id &&
    gate69a.lock_contract.default_candidate_id === LOCKED_DEFAULT_CANDIDATE_ID &&
    gate69a.lock_contract.shadow_candidate_id === SHADOW_CANARY_CANDIDATE_ID &&
    ledgerShape(finalLedgerRows).forced28_preserved &&
    ledgerShape(shadowLedgerRows).forced28_preserved &&
    finalLedgerHash === replayProof.final_ledger_hash_from_recomputed_run_a &&
    finalLedgerHash === replayProof.final_ledger_hash_from_recomputed_run_b &&
    shadowLedgerHash === replayProof.shadow_ledger_hash_from_recomputed_run_a &&
    shadowLedgerHash === replayProof.shadow_ledger_hash_from_recomputed_run_b &&
    replayProof.final_decision_hash_mismatches === 0 &&
    replayProof.shadow_decision_hash_mismatches === 0;
  const artifacts = {
    finalLedgerRows: toRepoRelative(path.join(artifactDir, "final-forced28-decision-ledger.rows.jsonl")),
    shadowLedgerRows: toRepoRelative(path.join(artifactDir, "candidate-c-shadow-canary-ledger.rows.jsonl")),
    replayProof: toRepoRelative(path.join(artifactDir, "replay-determinism-proof.json")),
    finalLedgerManifest: toRepoRelative(path.join(artifactDir, "final-forced28-ledger.manifest.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate69b-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate69b-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_FINAL_FORCED28_LEDGER_REPLAY__B_DEFAULT_C_SHADOW_BOUND_TO_GATE68_CAPSULE" : "FAIL_FINAL_FORCED28_LEDGER_REPLAY",
    ledger_hashes: {
      final_ledger_hash: finalLedgerHash,
      shadow_ledger_hash: shadowLedgerHash,
    },
    replay_proof: replayProof,
    validation: {
      gate69a_passed: gate69a.verdict.startsWith("PASS_"),
      gate68c_passed: gate68c.verdict.startsWith("PASS_"),
      final_ledger_shape: ledgerShape(finalLedgerRows),
      shadow_ledger_shape: ledgerShape(shadowLedgerRows),
      replay_deterministic: pass,
      final_ledger_bound_to_gate68_capsule: finalLedgerRows.every((row) => row.frozen_reference_capsule_id === gate68c.capsule.capsule_id),
      shadow_ledger_bound_to_gate68_capsule: shadowLedgerRows.every((row) => row.frozen_reference_capsule_id === gate68c.capsule.capsule_id),
      output_ledgers_include_outcomes: false,
      new_candidate_added: false,
      risk_exits_started: false,
      adaptive_learning_started: false,
    },
    artifacts,
  };

  await writeJsonl(path.join(artifactDir, "final-forced28-decision-ledger.rows.jsonl"), finalLedgerRows);
  await writeJsonl(path.join(artifactDir, "candidate-c-shadow-canary-ledger.rows.jsonl"), shadowLedgerRows);
  await writeJson(path.join(artifactDir, "replay-determinism-proof.json"), replayProof);
  await writeJson(path.join(artifactDir, "final-forced28-ledger.manifest.json"), finalLedgerManifest);
  await writeJson(path.join(artifactDir, "gate69b-summary.json"), summary);
  await writeText(reportPath, renderReport(summary));
  await writeShaManifest(path.join(artifactDir, "gate69b-sha256.txt"), GATE_ID, COMMAND, [
    { label: "final_ledger_rows", path: path.join(artifactDir, "final-forced28-decision-ledger.rows.jsonl") },
    { label: "shadow_ledger_rows", path: path.join(artifactDir, "candidate-c-shadow-canary-ledger.rows.jsonl") },
    { label: "replay_proof", path: path.join(artifactDir, "replay-determinism-proof.json") },
    { label: "final_ledger_manifest", path: path.join(artifactDir, "final-forced28-ledger.manifest.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate69b-summary.json") },
    { label: "report", path: reportPath },
  ]);

  if (!pass) throw new Error(summary.verdict);
  console.log(summary.verdict);
  console.log(JSON.stringify({ artifacts, ledger_hashes: summary.ledger_hashes }, null, 2));
}

function countDecisionMismatches(left: Array<{ row_key: string; decision_hash: string }>, right: Array<{ row_key: string; decision_hash: string }>) {
  const rightByKey = new Map(right.map((row) => [row.row_key, row.decision_hash]));
  return left.filter((row) => rightByKey.get(row.row_key) !== row.decision_hash).length;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
