import { mkdir } from "node:fs/promises";
import path from "node:path";

import { sha256Stable } from "@engine/research/hash";

import { fileHash, gitCommit, parseArgMap, readJson, toRepoRelative, writeJson, writeShaManifest, writeText } from "./gate65-utils";
import { loadGate69Closeout } from "./gate70-utils";
import {
  DEFAULT_CANDIDATE_B_LEDGER_PATH,
  GATE71_ASSET_CLASS,
  GATE71_EXPECTED_ROWS,
  GATE71_EXPECTED_SYMBOLS_PER_WEEK,
  GATE71_EXPECTED_WEEKS,
  GATE71_PATH_RESOLUTION,
  GATE71_PRICE_BUNDLE_ID,
  loadCandidateBRows,
  validateCandidateBRows,
} from "./gate71-utils";
import { DEFAULT_GATE71A_PROTOCOL_PATH, DEFAULT_GATE71BM_DIR, type Gate71Protocol } from "./gate72-utils";

const GATE74_DATE = "2026-06-29";
const GATE_ID = "Gate 74A: trade-leg-path-warehouse-protocol-freeze";
const COMMAND = "npm run engine:gate74a:trade-leg-path-warehouse-protocol-freeze";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate74a/artifacts/gate74a-trade-leg-path-warehouse-protocol-freeze";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate74a/GATE74A_TRADE_LEG_PATH_WAREHOUSE_PROTOCOL_FREEZE_${GATE74_DATE}.md`;
const DEFAULT_GATE73C_SUMMARY_PATH = "docs/research/gates/gate73c/artifacts/gate73c-direction-continuation-lifecycle/gate73c-summary.json";
const DEFAULT_GATE71BM_SUMMARY_PATH = path.join(DEFAULT_GATE71BM_DIR, "gate71bm-summary.json");

type Gate71bmSummary = {
  verdict: string;
  warehouse: {
    manifest_id: string;
    warehouse_hash: string;
    point_contract_id: string;
    price_bundle_id: string;
    path_resolution: string;
    candidate_b_ledger_hash: string;
    entry_exposure_model_id: string;
    adr_target_pct: number;
    weeks: number;
    point_count: number;
  };
  validation: {
    clean_entry_exposure_model_id: string;
    legacy_adr_grid_used_as_foundation: boolean;
    exit_policy_replay_started: boolean;
    risk_layer_started: boolean;
    brain_truth_mutated: boolean;
  };
};

type Gate73cSummary = {
  verdict: string;
  validation: {
    candidate_b_forced28_preserved: boolean;
    candidate_b_ledger_hash_matches_gate71bm: boolean;
    gate71bm_passed: boolean;
    raw_m1_rebuild_performed: boolean;
    dynamic_intrweek_exit_matrix_started: boolean;
    continuation_lifecycle_diagnostic_only: boolean;
    exit_promotion_performed: boolean;
    risk_layer_started: boolean;
    brain_truth_mutated: boolean;
    weeks_reviewed: number;
    pair_week_rows: number;
    symbols: number;
  };
};

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    candidateBLedgerPath: args.get("--candidate-b-ledger") ?? DEFAULT_CANDIDATE_B_LEDGER_PATH,
    gate71ProtocolPath: args.get("--gate71a-protocol") ?? DEFAULT_GATE71A_PROTOCOL_PATH,
    gate71bmSummaryPath: args.get("--gate71bm-summary") ?? DEFAULT_GATE71BM_SUMMARY_PATH,
    gate73cSummaryPath: args.get("--gate73c-summary") ?? DEFAULT_GATE73C_SUMMARY_PATH,
  };
}

function withHash<T extends Record<string, unknown>>(value: T) {
  return { ...value, content_hash: sha256Stable(value) };
}

function renderReport(summary: {
  generated_at: string;
  verdict: string;
  key_decisions: Record<string, unknown>;
  validation: Record<string, unknown>;
  artifacts: Record<string, string>;
}) {
  return [
    "# Gate 74A Trade-Leg Path Warehouse Protocol Freeze",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Freezes the policy-neutral trade-leg path warehouse contract before materialization.",
    "- Keeps warehouse base data separate from replay adapter policy decisions.",
    "- Defines intrabar crossing semantics and mandatory closed-vs-equity accounting.",
    "- Does not build the warehouse, replay policies, promote exits, start risk, or touch MT5/live/runtime.",
    "",
    "## Key Decisions",
    "",
    "```json",
    JSON.stringify(summary.key_decisions, null, 2),
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
    `- Protocol freeze: \`${summary.artifacts.protocolFreeze}\``,
    `- Base warehouse contract: \`${summary.artifacts.baseWarehouseContract}\``,
    `- Replay adapter contract: \`${summary.artifacts.replayAdapterContract}\``,
    `- Intrabar crossing contract: \`${summary.artifacts.intrabarCrossingContract}\``,
    `- No-drift assertions: \`${summary.artifacts.noDriftAssertions}\``,
    `- Summary: \`${summary.artifacts.summaryJson}\``,
    `- SHA identity: \`${summary.artifacts.shaIdentity}\``,
    "",
    "## Stop Line",
    "",
    "Gate 74A freezes the protocol only. Gate 74B materialization, Gate 74C replay adapters, Gate 74D review, risk, MT5/live, runtime work, source mutation, and exit promotion remain closed until explicitly opened.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const gate69 = await loadGate69Closeout();
  const gate71Protocol = await readJson<Gate71Protocol>(options.gate71ProtocolPath);
  const gate71bm = await readJson<Gate71bmSummary>(options.gate71bmSummaryPath);
  const gate73c = await readJson<Gate73cSummary>(options.gate73cSummaryPath);
  const candidateRows = await loadCandidateBRows(options.candidateBLedgerPath);
  const candidateShape = validateCandidateBRows(candidateRows);
  const candidateBLedgerFileHash = (await fileHash(options.candidateBLedgerPath)).toUpperCase();

  const forbiddenScope = [
    "warehouse materialization",
    "policy replay scoring",
    "exit promotion",
    "risk layer",
    "pair-specific optimization",
    "regime-specific exits",
    "fair-value pruning",
    "source mutation",
    "Candidate B mutation",
    "Candidate C defaulting",
    "COT retuning",
    "Strength retuning",
    "Regime retuning",
    "MT5/live/runtime work",
  ];

  const protocolFreeze = withHash({
    gate_id: GATE_ID,
    protocol_version: "gate74_trade_leg_path_warehouse_protocol_v1",
    objective:
      "freeze a policy-neutral trade-leg path warehouse contract so expensive path materialization can be reused by many replay adapters",
    core_rule: "base warehouse stores path primitives; replay adapters express policy decisions",
    upstream_bindings: {
      locked_algorithm_id: gate71Protocol.candidate_b_input.locked_algorithm_id,
      default_candidate_id: gate71Protocol.candidate_b_input.default_candidate_id,
      candidate_b_final_ledger_hash: gate69.gate69b.ledger_hashes.final_ledger_hash,
      candidate_b_ledger_file_sha256: candidateBLedgerFileHash,
      gate71bm_basket_path_manifest_id: gate71bm.warehouse.manifest_id,
      gate71bm_basket_path_warehouse_hash: gate71bm.warehouse.warehouse_hash,
      gate73c_verdict: gate73c.verdict,
      candidate_b_immutable_directional_truth: true,
      candidate_c_shadow_only: true,
    },
    path_contract: {
      asset_class: GATE71_ASSET_CLASS,
      price_bundle_id: GATE71_PRICE_BUNDLE_ID,
      path_resolution: GATE71_PATH_RESOLUTION,
      adr_target_pct: gate71Protocol.adr_normalization.target_adr_pct,
      adr_account_mapping: gate71Protocol.adr_normalization.account_mapping,
      entry_reference: "first loaded path bar open in the execution window",
      weekly_cutoff_reference: "Friday execution cutoff inherited from Gate 71 clean path protocol",
      timestamp_order: "strict ascending UTC timestamps per week and pair",
    },
    gate74a_only: {
      materialization_started: false,
      replay_adapters_started: false,
      optimization_started: false,
      promotion_started: false,
      risk_started: false,
    },
    forbidden_scope: forbiddenScope,
  });

  const baseWarehouseContract = withHash({
    gate_id: GATE_ID,
    contract_id: "gate74_trade_leg_path_base_primitives_v1",
    design_rule: "policy-neutral primitive layer only",
    allowed_base_primitives: [
      "Candidate B week/pair/direction identity",
      "direction streak identity",
      "direction flip boundary identity",
      "frozen price bundle identity",
      "ADR normalization identity",
      "directed pair OHLC ADR path by timestamp",
      "basket contribution ADR path by timestamp",
      "MFE and MAE to date",
      "first green and first red timestamps",
      "precomputed first-touch threshold indexes as acceleration hints",
      "coverage rows",
      "chunk hashes",
      "manifest receipts",
    ],
    forbidden_base_fields: [
      "policy_id",
      "policy_decision",
      "open_state",
      "closed_state",
      "close_reason",
      "realized_policy_pnl",
      "unrealized_policy_pnl",
      "policy_drawdown",
      "promotion_flag",
      "risk_sizing",
    ],
    required_manifest_fields: [
      "manifest_id",
      "contract_id",
      "status",
      "config_hash",
      "warehouse_hash",
      "candidate_b_ledger_file_sha256",
      "candidate_b_final_ledger_hash",
      "price_bundle_id",
      "path_resolution",
      "adr_target_pct",
      "week_count",
      "pair_week_count",
      "path_point_count",
      "chunk_count",
      "generated_at",
      "git_commit",
    ],
    required_path_point_fields: [
      "week_open_utc",
      "timestamp_utc",
      "pair",
      "candidate_b_side",
      "direction_streak_id",
      "directed_open_adr",
      "directed_high_adr",
      "directed_low_adr",
      "directed_close_adr",
      "basket_contribution_close_adr",
      "mfe_adr_to_date",
      "mae_adr_to_date",
      "first_green_timestamp_utc",
      "first_red_timestamp_utc",
      "direction_still_valid",
      "flip_boundary_utc",
      "coverage_state",
      "content_hash",
    ],
    threshold_precompute_policy: {
      role: "optional acceleration, not policy truth",
      base_path_remains_authoritative: true,
      suggested_thresholds_adr: [-5, -3, -2, -1.5, -1, -0.75, -0.5, -0.25, 0, 0.1, 0.2, 0.25, 0.3, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 5],
    },
  });

  const intrabarCrossingContract = withHash({
    gate_id: GATE_ID,
    contract_id: "gate74_intrabar_crossing_semantics_v1",
    source_resolution: GATE71_PATH_RESOLUTION,
    base_storage: "store directed OHLC ADR per path minute and close-mark ADR per path minute",
    close_mark_replay_semantics: "timestamped close only; no intrabar ambiguity",
    touch_based_replay_semantics: {
      primary_review_mode: "conservative ordering when favorable and adverse thresholds are both touched inside the same minute",
      required_sensitivity_modes: ["favorable_first", "adverse_first"],
      ambiguous_bar_policy: "flag explicitly; no promotion claim may depend on unresolved ambiguous bars",
      tick_data_available: false,
    },
    first_touch_rows_must_include: [
      "threshold_adr",
      "first_touch_timestamp_utc",
      "first_touch_bar_open_utc",
      "touch_source: close|high_low",
      "ambiguous_same_bar_crossing",
      "opposite_thresholds_also_touched",
    ],
  });

  const replayAdapterContract = withHash({
    gate_id: GATE_ID,
    contract_id: "gate74_replay_adapter_interface_v1",
    input: {
      base_warehouse_manifest_id: "required",
      policy_id: "required",
      policy_version: "required",
      policy_config_hash: "required",
      crossing_semantics_id: intrabarCrossingContract.contract_id,
    },
    replay_outputs_own: [
      "open and closed state",
      "policy decisions",
      "close/reset events",
      "closed PnL",
      "mark-to-market equity PnL",
      "realized drawdown",
      "unrealized drawdown",
      "policy-specific performance",
      "event reason codes",
    ],
    mandatory_metrics: [
      "closed_total_adr",
      "equity_total_adr",
      "closed_profit_factor",
      "equity_profit_factor",
      "closed_max_drawdown_adr",
      "equity_max_drawdown_adr",
      "worst_open_loss_adr",
      "max_simultaneous_open_grids",
      "max_simultaneous_losing_grids",
      "time_underwater",
      "recovery_before_flip_rate",
      "loss_at_flip_distribution",
    ],
    first_sanity_adapters_allowed_after_materialization: [
      "weekly_forced_close",
      "legacy_adr_grid_control",
      "carry_until_flip",
      "close_profitable_hold_unresolved_until_flip",
      "fixed_reset_threshold_diagnostics",
    ],
    adapters_forbidden_in_gate74a: true,
  });

  const noDriftAssertions = withHash({
    gate_id: GATE_ID,
    candidate_b_read_only: true,
    candidate_c_shadow_only: true,
    atom_policies_changed: false,
    source_mutation: false,
    pair_date_exclusions: false,
    risk_layer_started: false,
    mt5_live_runtime_started: false,
    exit_promotion_started: false,
    base_warehouse_materialized: false,
    replay_policy_scored: false,
    policy_outputs_separated_from_base_path_data: true,
  });

  const pass =
    gate69.gate69b.verdict.startsWith("PASS_") &&
    gate69.gate69b.validation.final_ledger_shape.forced28_preserved &&
    gate71Protocol.candidate_b_input.candidate_b_ledger_file_sha256 === candidateBLedgerFileHash &&
    gate71Protocol.candidate_b_input.immutable_directional_truth === true &&
    gate71Protocol.candidate_c_shadow.monitoring_only === true &&
    gate71bm.verdict.startsWith("PASS_") &&
    gate71bm.validation.exit_policy_replay_started === false &&
    gate71bm.validation.legacy_adr_grid_used_as_foundation === false &&
    gate73c.verdict.startsWith("PASS_") &&
    gate73c.validation.continuation_lifecycle_diagnostic_only === true &&
    gate73c.validation.raw_m1_rebuild_performed === false &&
    gate73c.validation.dynamic_intrweek_exit_matrix_started === false &&
    gate73c.validation.exit_promotion_performed === false &&
    candidateShape.forced28_preserved &&
    candidateShape.rows === GATE71_EXPECTED_ROWS &&
    candidateShape.weeks === GATE71_EXPECTED_WEEKS &&
    gate71Protocol.price_path.price_bundle_id === GATE71_PRICE_BUNDLE_ID &&
    gate71Protocol.price_path.path_resolution === GATE71_PATH_RESOLUTION &&
    protocolFreeze.gate74a_only.materialization_started === false &&
    replayAdapterContract.adapters_forbidden_in_gate74a === true &&
    noDriftAssertions.policy_outputs_separated_from_base_path_data === true;

  const artifacts = {
    protocolFreeze: toRepoRelative(path.join(artifactDir, "trade-leg-path-warehouse-protocol-freeze.json")),
    baseWarehouseContract: toRepoRelative(path.join(artifactDir, "base-warehouse-contract.json")),
    replayAdapterContract: toRepoRelative(path.join(artifactDir, "replay-adapter-interface-contract.json")),
    intrabarCrossingContract: toRepoRelative(path.join(artifactDir, "intrabar-crossing-semantics-contract.json")),
    noDriftAssertions: toRepoRelative(path.join(artifactDir, "no-drift-assertions.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate74a-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate74a-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass
      ? "PASS_GATE74A_TRADE_LEG_PATH_WAREHOUSE_PROTOCOL_FREEZE__POLICY_NEUTRAL_PRIMITIVES_ONLY"
      : "FAIL_GATE74A_TRADE_LEG_PATH_WAREHOUSE_PROTOCOL_FREEZE",
    key_decisions: {
      base_warehouse_stores_policy_decisions: false,
      replay_adapters_store_policy_decisions: true,
      intrabar_ambiguity_explicitly_flagged: true,
      closed_and_equity_pnl_required_for_every_replay: true,
      close_profitable_hold_unresolved_until_flip_is_adapter_only: true,
      gate74a_materialization_started: false,
    },
    validation: {
      gate69b_passed: gate69.gate69b.verdict.startsWith("PASS_"),
      gate71bm_passed: gate71bm.verdict.startsWith("PASS_"),
      gate73c_passed: gate73c.verdict.startsWith("PASS_"),
      candidate_b_forced28_preserved: candidateShape.forced28_preserved,
      candidate_b_rows: candidateShape.rows,
      expected_candidate_b_rows: GATE71_EXPECTED_ROWS,
      candidate_b_weeks: candidateShape.weeks,
      expected_candidate_b_weeks: GATE71_EXPECTED_WEEKS,
      expected_symbols_per_week: GATE71_EXPECTED_SYMBOLS_PER_WEEK,
      candidate_b_file_hash_matches_gate71_protocol: gate71Protocol.candidate_b_input.candidate_b_ledger_file_sha256 === candidateBLedgerFileHash,
      gate73c_was_diagnostic_only: gate73c.validation.continuation_lifecycle_diagnostic_only,
      raw_m1_rebuild_performed: false,
      base_warehouse_materialization_started: false,
      replay_adapters_started: false,
      policy_optimization_started: false,
      exit_promotion_started: false,
      risk_layer_started: false,
      mt5_live_runtime_started: false,
      brain_truth_mutated: false,
      source_mutation_started: false,
    },
    protocol_contract_hashes: {
      protocol_freeze: protocolFreeze.content_hash,
      base_warehouse_contract: baseWarehouseContract.content_hash,
      intrabar_crossing_contract: intrabarCrossingContract.content_hash,
      replay_adapter_contract: replayAdapterContract.content_hash,
      no_drift_assertions: noDriftAssertions.content_hash,
    },
    next_gate_options: [
      "Gate 74B: materialize the policy-neutral trade-leg path base warehouse",
      "Gate 74C: replay adapter sanity pack after 74B exists",
      "Gate 74D: no-drift review packet after adapter sanity evidence exists",
    ],
    forbidden_scope: forbiddenScope,
    artifacts,
  };

  await writeJson(path.join(artifactDir, "trade-leg-path-warehouse-protocol-freeze.json"), protocolFreeze);
  await writeJson(path.join(artifactDir, "base-warehouse-contract.json"), baseWarehouseContract);
  await writeJson(path.join(artifactDir, "replay-adapter-interface-contract.json"), replayAdapterContract);
  await writeJson(path.join(artifactDir, "intrabar-crossing-semantics-contract.json"), intrabarCrossingContract);
  await writeJson(path.join(artifactDir, "no-drift-assertions.json"), noDriftAssertions);
  await writeJson(path.join(artifactDir, "gate74a-summary.json"), summary);
  await writeText(reportPath, renderReport(summary));
  await writeShaManifest(path.join(artifactDir, "gate74a-sha256.txt"), GATE_ID, COMMAND, [
    { label: "protocol_freeze", path: path.join(artifactDir, "trade-leg-path-warehouse-protocol-freeze.json") },
    { label: "base_warehouse_contract", path: path.join(artifactDir, "base-warehouse-contract.json") },
    { label: "replay_adapter_contract", path: path.join(artifactDir, "replay-adapter-interface-contract.json") },
    { label: "intrabar_crossing_contract", path: path.join(artifactDir, "intrabar-crossing-semantics-contract.json") },
    { label: "no_drift_assertions", path: path.join(artifactDir, "no-drift-assertions.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate74a-summary.json") },
    { label: "report", path: reportPath },
    { label: "gate73c_summary", path: options.gate73cSummaryPath },
    { label: "gate71bm_summary", path: options.gate71bmSummaryPath },
  ]);

  if (!pass) throw new Error(summary.verdict);
  console.log(summary.verdict);
  console.log(JSON.stringify({ artifacts, validation: summary.validation, key_decisions: summary.key_decisions }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
