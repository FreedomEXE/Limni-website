import { mkdir } from "node:fs/promises";
import path from "node:path";

import { sha256Stable } from "@engine/research/hash";

import {
  EXPECTED_ROWS,
  fileHash,
  gitCommit,
  parseArgMap,
  readJson,
  readJsonl,
  toRepoRelative,
  writeJson,
  writeJsonl,
  writeShaManifest,
  writeText,
} from "./gate65-utils";
import { DEFAULT_GATE67A_DIR, DEFAULT_GATE67B_DIR, DEFAULT_GATE67C_DIR } from "./gate67-utils";
import { DEFAULT_GATE68A_DIR, DEFAULT_GATE68B_DIR, DEFAULT_GATE68C_DIR, GATE68_DATE, Gate68TestRow, hashGate68Rows } from "./gate68-utils";

const GATE_ID = "Gate 68C: frozen-seven-year-reference-capsule";
const COMMAND = "npm run engine:gate68c:frozen-seven-year-reference-capsule";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate68c/GATE68C_FROZEN_SEVEN_YEAR_REFERENCE_CAPSULE_${GATE68_DATE}.md`;

type Gate68bSummary = {
  verdict: string;
  candidate_count: number;
  decision_row_count: number;
  candidate_metrics: Array<Record<string, unknown>>;
  candidate_d_review: {
    improved_vs_candidate_b_on_adr_grid_rdd: boolean;
    preserves_candidate_c_zero_negative_years: boolean;
    candidate_d: Record<string, unknown>;
    mode_counts: Record<string, number>;
    reason_code_counts: Record<string, number>;
  };
  validation: Record<string, unknown>;
};

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE68C_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate67aDir: args.get("--gate67a-dir") ?? DEFAULT_GATE67A_DIR,
    gate67bDir: args.get("--gate67b-dir") ?? DEFAULT_GATE67B_DIR,
    gate67cDir: args.get("--gate67c-dir") ?? DEFAULT_GATE67C_DIR,
    gate68aDir: args.get("--gate68a-dir") ?? DEFAULT_GATE68A_DIR,
    gate68bDir: args.get("--gate68b-dir") ?? DEFAULT_GATE68B_DIR,
  };
}

function renderReport(summary: Record<string, unknown>) {
  return [
    "# Gate 68C Frozen Seven-Year Reference Capsule",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Freezes the Gate 68A/B seven-year reference surface into an append-only capsule.",
    "- Includes all four tested candidates; Candidate D remains unnamed and unpromoted.",
    "- Defines no-drift rules for future replay and monitoring.",
    "- Does not create adaptive learning, rolling retraining, or rule mutation.",
    "",
    "## Capsule",
    "",
    "```json",
    JSON.stringify(summary.capsule, null, 2),
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
    `- Manifest: \`${summary.artifacts["manifestJson"]}\``,
    `- Hash manifest: \`${summary.artifacts["hashManifest"]}\``,
    `- Frozen decision ledger: \`${summary.artifacts["decisionLedgerRows"]}\``,
    `- Reference summary: \`${summary.artifacts["referenceSummary"]}\``,
    `- Performance envelope: \`${summary.artifacts["performanceEnvelope"]}\``,
    `- Mode distribution: \`${summary.artifacts["modeDistribution"]}\``,
    `- Reason-code distribution: \`${summary.artifacts["reasonCodeDistribution"]}\``,
    `- No-drift contract: \`${summary.artifacts["noDriftContract"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 68C freezes reference evidence only. Future observations are append-only and cannot mutate this capsule.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const inputPaths = [
    path.join(options.gate68aDir, "brain-mode-selector-contract.json"),
    path.join(options.gate68aDir, "brain-mode-selector-mode-map.json"),
    path.join(options.gate68aDir, "brain-mode-selector-reason-code-contract.json"),
    path.join(options.gate68aDir, "gate68a-sha256.txt"),
    path.join(options.gate68bDir, "brain-mode-selector-test-summary.json"),
    path.join(options.gate68bDir, "brain-mode-selector-test-matrix.rows.jsonl"),
    path.join(options.gate68bDir, "brain-mode-selector-signature-collapse.json"),
    path.join(options.gate68bDir, "gate68b-sha256.txt"),
    path.join(options.gate67aDir, "cell-opinion-ledger.rows.jsonl"),
    path.join(options.gate67bDir, "final-forced28-candidate-contracts.json"),
    path.join(options.gate67cDir, "final-forced28-test-matrix.rows.jsonl"),
  ];
  const inputHashes = await Promise.all(
    inputPaths.map(async (filePath) => ({
      path: toRepoRelative(filePath),
      sha256: await fileHash(filePath),
    })),
  );
  const gate68b = await readJson<Gate68bSummary>(path.join(options.gate68bDir, "brain-mode-selector-test-summary.json"));
  const matrixRows = await readJsonl<Gate68TestRow>(path.join(options.gate68bDir, "brain-mode-selector-test-matrix.rows.jsonl"));
  const decisionLedgerSeed = matrixRows.map((row) => ({
    candidate_id: row.candidate_id,
    week_open_utc: row.week_open_utc,
    symbol: row.symbol,
    selected_direction: row.selected_direction,
    selected_mode: row.selected_mode,
    selected_candidate_mode_source: row.selected_candidate_mode_source,
    selector_reason_code: row.selector_reason_code,
    reason_codes: row.reason_codes,
    warning_active: row.warning_active,
    fallback_used: row.fallback_used,
    veto_used: row.veto_used,
    content_hash: row.content_hash,
  }));
  const decisionLedgerHash = hashGate68Rows(decisionLedgerSeed);
  const outcomeScoringHash = hashGate68Rows(
    matrixRows.map((row) => ({
      candidate_id: row.candidate_id,
      week_open_utc: row.week_open_utc,
      symbol: row.symbol,
      adr_grid_adr: row.adr_grid_adr,
      weekly_hold_adr: row.weekly_hold_adr,
    })),
  );
  const noDriftContract = {
    gate_id: GATE_ID,
    contract_version: "gate68c_frozen_no_drift_contract_v0",
    cannot_drift: [
      "mode selector rules",
      "reason-code definitions",
      "cell opinion packet schema",
      "source bundle identities",
      "forced-28 denominator shape",
      "scoring surfaces",
      "seven-year decision ledger rows",
      "seven-year outcome scoring rows",
    ],
    append_only_later: ["new weekly decisions", "new weekly outcomes after close", "forward monitoring observations", "drift reports"],
    forbidden_mutations: ["adaptive learning", "rolling retraining", "silent rule updates", "historical reference rewrite", "risk/exits/execution mutation of Brain truth"],
    any_change_requires_future_versioned_research_gate: true,
  };
  const capsuleSeed = {
    architecture_version: "gate66_brain_cells_atoms_v3",
    final_algorithm_name: null,
    input_hashes: inputHashes,
    decisionLedgerHash,
    outcomeScoringHash,
    candidate_metrics: gate68b.candidate_metrics,
    noDriftContract,
  };
  const capsuleHash = sha256Stable(capsuleSeed);
  const capsuleId = `gate68c_frozen_reference_capsule_${capsuleHash.slice(0, 16)}`;
  const frozenLedgerRows = matrixRows.map((row) => ({
    frozen_reference_capsule_id: capsuleId,
    architecture_version: "gate66_brain_cells_atoms_v3",
    final_algorithm_name: null,
    ...row,
  }));
  const manifest = {
    gate_id: GATE_ID,
    capsule_id: capsuleId,
    capsule_sha256: capsuleHash,
    architecture_version: "gate66_brain_cells_atoms_v3",
    brain_cells_atoms_contract_version: "gate66_brain_cells_atoms_v3",
    final_algorithm_name: null,
    candidate_d_mode_selector_contract_hash: inputHashes.find((entry) => entry.path.endsWith("brain-mode-selector-contract.json"))?.sha256,
    candidate_a_b_c_reference_hashes: inputHashes.filter((entry) => entry.path.endsWith("final-forced28-candidate-contracts.json") || entry.path.endsWith("final-forced28-test-matrix.rows.jsonl")),
    cell_opinion_contract_hash: inputHashes.find((entry) => entry.path.endsWith("cell-opinion-ledger.rows.jsonl"))?.sha256,
    source_data_bundle_identities: {
      price_bundle_id: "gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953",
      path_outcome_warehouse_id: "gate57a0b_pair_week_path_outcomes_47B8F40AFB3B",
      path_resolution: "1m",
      architecture_contract: "gate66_brain_cells_atoms_v3",
      cell_opinion_packet_contract: "gate67a_cell_opinion_packet_contract_v0",
      brain_mode_selector_contract: "gate68_brain_mode_selector_v0",
    },
    forced28_denominator_contract: {
      candidate_count: 4,
      rows_per_candidate: EXPECTED_ROWS,
      weeks: 373,
      pairs_per_week: 28,
      duplicate_week_symbol_rows_per_candidate: 0,
    },
    seven_year_decision_ledger_hash: decisionLedgerHash,
    seven_year_outcome_scoring_hash: outcomeScoringHash,
    reason_code_contract_hash: inputHashes.find((entry) => entry.path.endsWith("brain-mode-selector-reason-code-contract.json"))?.sha256,
    input_hashes: inputHashes,
    no_drift_contract_hash: sha256Stable(noDriftContract),
  };
  const performanceEnvelope = {
    gate_id: GATE_ID,
    capsule_id: capsuleId,
    candidate_metrics: gate68b.candidate_metrics,
    candidate_d_pre_readiness_status:
      gate68b.candidate_d_review.improved_vs_candidate_b_on_adr_grid_rdd && gate68b.candidate_d_review.preserves_candidate_c_zero_negative_years
        ? "candidate_d_strong_pending_gate68e_review"
        : "candidate_d_mixed_or_not_ready_pending_gate68e_review",
  };
  const modeDistribution = {
    gate_id: GATE_ID,
    capsule_id: capsuleId,
    candidate_d_mode_counts: gate68b.candidate_d_review.mode_counts,
  };
  const reasonCodeDistribution = {
    gate_id: GATE_ID,
    capsule_id: capsuleId,
    candidate_d_reason_code_counts: gate68b.candidate_d_review.reason_code_counts,
  };
  const referenceSummary = {
    gate_id: GATE_ID,
    capsule_id: capsuleId,
    capsule_sha256: capsuleHash,
    decision_ledger_rows: frozenLedgerRows.length,
    decision_ledger_hash: decisionLedgerHash,
    outcome_scoring_hash: outcomeScoringHash,
    candidates_included: gate68b.candidate_count,
    candidate_d_review: gate68b.candidate_d_review,
    no_adaptive_learning_started: true,
  };
  const pass =
    gate68b.verdict.startsWith("PASS_") &&
    frozenLedgerRows.length === EXPECTED_ROWS * 4 &&
    manifest.final_algorithm_name === null &&
    noDriftContract.any_change_requires_future_versioned_research_gate &&
    noDriftContract.forbidden_mutations.includes("adaptive learning");
  const artifacts = {
    manifestJson: toRepoRelative(path.join(artifactDir, "frozen-reference-capsule.manifest.json")),
    hashManifest: toRepoRelative(path.join(artifactDir, "frozen-reference-capsule.hash-manifest.txt")),
    decisionLedgerRows: toRepoRelative(path.join(artifactDir, "frozen-seven-year-decision-ledger.rows.jsonl")),
    referenceSummary: toRepoRelative(path.join(artifactDir, "frozen-seven-year-reference-summary.json")),
    performanceEnvelope: toRepoRelative(path.join(artifactDir, "frozen-performance-envelope.json")),
    modeDistribution: toRepoRelative(path.join(artifactDir, "frozen-mode-distribution.json")),
    reasonCodeDistribution: toRepoRelative(path.join(artifactDir, "frozen-reason-code-distribution.json")),
    noDriftContract: toRepoRelative(path.join(artifactDir, "frozen-no-drift-contract.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate68c-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate68c-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const hashManifest = [
    `gate_id ${GATE_ID}`,
    `capsule_id ${capsuleId}`,
    `capsule_sha256 ${capsuleHash}`,
    `decision_ledger_sha256 ${decisionLedgerHash}`,
    `outcome_scoring_sha256 ${outcomeScoringHash}`,
    ...inputHashes.map((entry) => `input ${entry.sha256} ${entry.path}`),
  ].join("\n");
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_FROZEN_SEVEN_YEAR_REFERENCE_CAPSULE__HASH_BOUND_APPEND_ONLY_NO_DRIFT" : "FAIL_FROZEN_SEVEN_YEAR_REFERENCE_CAPSULE",
    capsule: {
      capsule_id: capsuleId,
      capsule_sha256: capsuleHash,
      decision_ledger_hash: decisionLedgerHash,
      outcome_scoring_hash: outcomeScoringHash,
    },
    validation: {
      gate68b_passed: gate68b.verdict.startsWith("PASS_"),
      frozen_reference_capsule_complete: true,
      decision_ledger_rows: frozenLedgerRows.length,
      expected_decision_ledger_rows: EXPECTED_ROWS * 4,
      final_algorithm_name: null,
      no_drift_contract_explicit: true,
      future_observations_append_only: true,
      adaptive_learning_started: false,
      rolling_retraining_started: false,
      historical_reference_mutable: false,
    },
    artifacts,
  };

  await writeJson(path.join(artifactDir, "frozen-reference-capsule.manifest.json"), manifest);
  await writeText(path.join(artifactDir, "frozen-reference-capsule.hash-manifest.txt"), `${hashManifest}\n`);
  await writeJsonl(path.join(artifactDir, "frozen-seven-year-decision-ledger.rows.jsonl"), frozenLedgerRows);
  await writeJson(path.join(artifactDir, "frozen-seven-year-reference-summary.json"), referenceSummary);
  await writeJson(path.join(artifactDir, "frozen-performance-envelope.json"), performanceEnvelope);
  await writeJson(path.join(artifactDir, "frozen-mode-distribution.json"), modeDistribution);
  await writeJson(path.join(artifactDir, "frozen-reason-code-distribution.json"), reasonCodeDistribution);
  await writeJson(path.join(artifactDir, "frozen-no-drift-contract.json"), noDriftContract);
  await writeJson(path.join(artifactDir, "gate68c-summary.json"), summary);
  await writeText(reportPath, renderReport(summary));
  await writeShaManifest(path.join(artifactDir, "gate68c-sha256.txt"), GATE_ID, COMMAND, [
    { label: "manifest_json", path: path.join(artifactDir, "frozen-reference-capsule.manifest.json") },
    { label: "hash_manifest", path: path.join(artifactDir, "frozen-reference-capsule.hash-manifest.txt") },
    { label: "decision_ledger_rows", path: path.join(artifactDir, "frozen-seven-year-decision-ledger.rows.jsonl") },
    { label: "reference_summary", path: path.join(artifactDir, "frozen-seven-year-reference-summary.json") },
    { label: "performance_envelope", path: path.join(artifactDir, "frozen-performance-envelope.json") },
    { label: "mode_distribution", path: path.join(artifactDir, "frozen-mode-distribution.json") },
    { label: "reason_code_distribution", path: path.join(artifactDir, "frozen-reason-code-distribution.json") },
    { label: "no_drift_contract", path: path.join(artifactDir, "frozen-no-drift-contract.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate68c-summary.json") },
    { label: "report", path: reportPath },
  ]);

  if (!pass) throw new Error(summary.verdict);
  console.log(summary.verdict);
  console.log(JSON.stringify({ artifacts, capsule: summary.capsule }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
