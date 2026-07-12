import { mkdir } from "node:fs/promises";
import path from "node:path";

import { getTargetAdrPct } from "@engine/price/adrLookup";
import {
  RESEARCH_DECISION_EVALUATOR_PARAMS,
  RESEARCH_DECISION_EVALUATOR_VERSION,
  RESEARCH_DECISION_PATH_CONTRACT_ID,
} from "@engine/research/decisionManifestEvaluator";

import { fileHash, gitCommit, parseArgMap, readJson, toRepoRelative, writeJson, writeShaManifest, writeText } from "./gate65-utils";
import {
  DEFAULT_CANDIDATE_B_LEDGER_PATH,
  DEFAULT_GATE71A_DIR,
  GATE71_DATE,
  GATE71_PATH_RESOLUTION,
  GATE71_PRICE_BUNDLE_ID,
  loadCandidateBRows,
  validateCandidateBRows,
} from "./gate71-utils";
import {
  DEFAULT_GATE69B_DIR,
  DEFAULT_GATE70A_DIR,
  LOCKED_DEFAULT_CANDIDATE_ID,
  LOCKED_FINAL_ALGORITHM_ID,
  SHADOW_CANARY_CANDIDATE_ID,
} from "./gate70-utils";

const GATE_ID = "Gate 71A: exit-testing-protocol-freeze";
const COMMAND = "npm run engine:gate71a:exit-testing-protocol-freeze";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate71a/GATE71A_EXIT_TESTING_PROTOCOL_FREEZE_${GATE71_DATE}.md`;

type Gate70aSummary = {
  verdict: string;
  validation: {
    candidate_b_read_only: boolean;
    candidate_c_monitoring_only: boolean;
    exits_started: boolean;
    risk_started: boolean;
  };
};

type Gate69bSummary = {
  ledger_hashes: {
    final_ledger_hash: string;
    shadow_ledger_hash: string;
  };
  validation: {
    final_ledger_shape: { forced28_preserved: boolean };
    shadow_ledger_shape: { forced28_preserved: boolean };
  };
};

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE71A_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate70aDir: args.get("--gate70a-dir") ?? DEFAULT_GATE70A_DIR,
    gate69bDir: args.get("--gate69b-dir") ?? DEFAULT_GATE69B_DIR,
    candidateBLedgerPath: args.get("--candidate-b-ledger") ?? DEFAULT_CANDIDATE_B_LEDGER_PATH,
  };
}

function renderReport(summary: Record<string, unknown>) {
  return [
    "# Gate 71A Exit Testing Protocol Freeze",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Freezes the Candidate B exit-testing protocol before diagnostics or matrix scoring.",
    "- Confirms Candidate B is immutable directional truth and Candidate C remains shadow-only.",
    "- Classifies legacy ADR Grid as a coupled entry+exit control, not the foundation for basket-path diagnostics.",
    "- Freezes a clean basket-hold path model for Gate 71B/71C.",
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Protocol freeze: \`${summary.artifacts["protocolFreeze"]}\``,
    `- Entry/exposure model: \`${summary.artifacts["entryExposureModel"]}\``,
    `- Legacy grid coupling audit: \`${summary.artifacts["legacyGridCouplingAudit"]}\``,
    `- Ranking/promotion criteria: \`${summary.artifacts["rankingPromotionCriteria"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 71A freezes the exit-testing protocol only. It does not score exits, select winners, or modify Brain truth.",
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
  const gate69b = await readJson<Gate69bSummary>(path.join(options.gate69bDir, "gate69b-summary.json"));
  const rows = await loadCandidateBRows(options.candidateBLedgerPath);
  const denominator = validateCandidateBRows(rows);
  const candidateBLedgerFileHash = await fileHash(options.candidateBLedgerPath);

  const protocolFreeze = {
    gate_id: GATE_ID,
    protocol_version: "gate71_candidate_b_basket_exit_testing_protocol_v1",
    objective:
      "maximize profitable-week rate subject to no tail-risk degradation, no total-ADR collapse, and no year/regime concentration",
    candidate_b_input: {
      locked_algorithm_id: LOCKED_FINAL_ALGORITHM_ID,
      default_candidate_id: LOCKED_DEFAULT_CANDIDATE_ID,
      candidate_b_ledger_hash: gate69b.ledger_hashes.final_ledger_hash,
      candidate_b_ledger_file_sha256: candidateBLedgerFileHash,
      source_path: toRepoRelative(options.candidateBLedgerPath),
      immutable_directional_truth: true,
      forced28_preserved: denominator.forced28_preserved,
    },
    candidate_c_shadow: {
      shadow_candidate_id: SHADOW_CANARY_CANDIDATE_ID,
      shadow_ledger_hash: gate69b.ledger_hashes.shadow_ledger_hash,
      monitoring_only: true,
      can_promote_or_override: false,
    },
    adr_normalization: {
      target_adr_pct: getTargetAdrPct(),
      account_mapping: "1 ADR = 1 percent account profit under the current ADR-normalized research convention",
      pair_contribution_formula: "directed_raw_return_pct / pair_week_adr_pct",
    },
    price_path: {
      price_bundle_id: GATE71_PRICE_BUNDLE_ID,
      path_resolution: GATE71_PATH_RESOLUTION,
      execution_window: "engine/src/evaluation/executionPriceWindows.ts",
      entry_timestamp: "first loaded path bar open in the execution window",
      close_timestamp: "Friday 11:00 America/New_York execution cutoff",
      threshold_crossing_semantics: "closed-bar/timestamped 1m mark crossing; no intrabar interpolation",
    },
    artifact_policy: {
      weekly_diagnostics_store_compact_metrics: true,
      full_minute_path_not_written_by_default: true,
      reason: "Full 373-week x 1m basket path is regenerated deterministically for matrix execution to avoid a large review artifact.",
    },
  };
  const entryExposureModel = {
    gate_id: GATE_ID,
    model_id: "gate71_clean_weekly_basket_hold_v1",
    model_role: "clean_foundation_for_basket_exit_testing",
    rows_per_week: 28,
    signal_source: "locked Candidate B final_side only",
    entry: "one synthetic basket exposure per pair at first loaded path bar open",
    mark_to_market: "sum of ADR-normalized pair returns on the 1m close-mark path",
    exit_in_gate71b: "none; diagnostics only",
    excluded_behavior: [
      "ADR Grid levels",
      "grid take-profit",
      "grid reset",
      "re-entry",
      "risk filters",
      "fair-value pruning",
      "pair-specific exits",
      "regime-specific exits",
      "direction mutation",
    ],
  };
  const legacyGridCouplingAudit = {
    gate_id: GATE_ID,
    evaluator_version: RESEARCH_DECISION_EVALUATOR_VERSION,
    path_contract_id: RESEARCH_DECISION_PATH_CONTRACT_ID,
    evaluator_params: RESEARCH_DECISION_EVALUATOR_PARAMS.adr_grid,
    coupled_entry_exit_behaviors_found: [
      "grid level entries",
      "per-fill take-profit",
      "reset target",
      "entries stopped for week after reset",
      "week-close liquidation",
    ],
    classification: "coupled_entry_exit_control_only",
    can_be_foundation_for_clean_basket_path: false,
    can_be_gate71_control: true,
  };
  const rankingPromotionCriteria = {
    gate_id: GATE_ID,
    primary_objective:
      "maximize profitable-week rate subject to no tail-risk degradation, no total-ADR collapse, and no year/regime concentration",
    tier_1_weekly_consistency: ["profitable_week_rate", "year_by_year_profitable_week_rate", "no_bad_year_collapse"],
    tier_2_tail_control: ["worst_week", "worst_5_week_cluster", "max_drawdown_adr", "peak_to_friday_giveback_reduction"],
    tier_3_return_quality: ["total_adr_return", "median_weekly_adr", "average_weekly_adr", "return_to_drawdown", "profit_factor_adr"],
    tier_4_simplicity: "prefer simpler global basket rules when performance is close",
    forbidden_promotion_shortcuts: [
      "highest win rate alone",
      "pair-specific optimization in first pass",
      "regime-specific behavior in first pass",
      "hidden date or pair exclusions",
      "future outcome leakage",
    ],
  };

  const pass =
    gate70a.verdict.startsWith("PASS_") &&
    gate70a.validation.candidate_b_read_only &&
    gate70a.validation.candidate_c_monitoring_only &&
    gate70a.validation.exits_started === false &&
    gate70a.validation.risk_started === false &&
    gate69b.validation.final_ledger_shape.forced28_preserved &&
    gate69b.validation.shadow_ledger_shape.forced28_preserved &&
    denominator.forced28_preserved &&
    getTargetAdrPct() === 1 &&
    legacyGridCouplingAudit.classification === "coupled_entry_exit_control_only" &&
    legacyGridCouplingAudit.can_be_foundation_for_clean_basket_path === false;
  const artifacts = {
    protocolFreeze: toRepoRelative(path.join(artifactDir, "exit-testing-protocol-freeze.json")),
    entryExposureModel: toRepoRelative(path.join(artifactDir, "clean-entry-exposure-model.json")),
    legacyGridCouplingAudit: toRepoRelative(path.join(artifactDir, "legacy-adr-grid-coupling-audit.json")),
    rankingPromotionCriteria: toRepoRelative(path.join(artifactDir, "ranking-and-promotion-criteria.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate71a-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate71a-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_GATE71A_EXIT_TESTING_PROTOCOL_FREEZE__CLEAN_BASKET_PATH_REQUIRED" : "FAIL_GATE71A_EXIT_TESTING_PROTOCOL_FREEZE",
    protocol: {
      clean_entry_exposure_model_id: entryExposureModel.model_id,
      legacy_adr_grid_role: legacyGridCouplingAudit.classification,
      path_resolution: GATE71_PATH_RESOLUTION,
      adr_target_pct: getTargetAdrPct(),
    },
    validation: {
      gate70a_passed: gate70a.verdict.startsWith("PASS_"),
      candidate_b_hash_locked: gate69b.ledger_hashes.final_ledger_hash === protocolFreeze.candidate_b_input.candidate_b_ledger_hash,
      candidate_b_forced28_preserved: denominator.forced28_preserved,
      candidate_c_shadow_only: protocolFreeze.candidate_c_shadow.monitoring_only && protocolFreeze.candidate_c_shadow.can_promote_or_override === false,
      adr_normalization_confirmed: getTargetAdrPct() === 1,
      price_bundle_locked: protocolFreeze.price_path.price_bundle_id === GATE71_PRICE_BUNDLE_ID,
      path_resolution_locked: protocolFreeze.price_path.path_resolution === GATE71_PATH_RESOLUTION,
      legacy_adr_grid_coupled: legacyGridCouplingAudit.classification === "coupled_entry_exit_control_only",
      clean_basket_path_required: true,
      exit_matrix_execution_started: false,
      risk_filters_started: false,
      brain_truth_mutated: false,
    },
    artifacts,
  };

  await writeJson(path.join(artifactDir, "exit-testing-protocol-freeze.json"), protocolFreeze);
  await writeJson(path.join(artifactDir, "clean-entry-exposure-model.json"), entryExposureModel);
  await writeJson(path.join(artifactDir, "legacy-adr-grid-coupling-audit.json"), legacyGridCouplingAudit);
  await writeJson(path.join(artifactDir, "ranking-and-promotion-criteria.json"), rankingPromotionCriteria);
  await writeJson(path.join(artifactDir, "gate71a-summary.json"), summary);
  await writeText(reportPath, renderReport(summary));
  await writeShaManifest(path.join(artifactDir, "gate71a-sha256.txt"), GATE_ID, COMMAND, [
    { label: "protocol_freeze", path: path.join(artifactDir, "exit-testing-protocol-freeze.json") },
    { label: "entry_exposure_model", path: path.join(artifactDir, "clean-entry-exposure-model.json") },
    { label: "legacy_grid_coupling_audit", path: path.join(artifactDir, "legacy-adr-grid-coupling-audit.json") },
    { label: "ranking_promotion_criteria", path: path.join(artifactDir, "ranking-and-promotion-criteria.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate71a-summary.json") },
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
