import { mkdir } from "node:fs/promises";
import path from "node:path";

import { assertBasketPathWarehouseReady } from "@engine/research/basketPathWarehouse";

import { fileHash, gitCommit, parseArgMap, readJson, toRepoRelative, writeJson, writeShaManifest, writeText } from "./gate65-utils";
import { loadGate69Closeout } from "./gate70-utils";
import {
  buildGate71BasketPathWarehouseConfig,
  buildGate71BasketPathWarehouseManifestId,
  DEFAULT_CANDIDATE_B_LEDGER_PATH,
  DEFAULT_GATE71B_DIR,
  DEFAULT_GATE71C_DIR,
  GATE71_BASKET_PATH_POINT_CONTRACT_ID,
  GATE71_EXPECTED_SYMBOLS_PER_WEEK,
  GATE71_EXPECTED_WEEKS,
  GATE71_PATH_RESOLUTION,
  GATE71_PRICE_BUNDLE_ID,
  loadCandidateBRows,
  loadGate71aSummary,
  validateCandidateBRows,
} from "./gate71-utils";
import {
  DEFAULT_GATE71A_ENTRY_MODEL_PATH,
  DEFAULT_GATE71A_LEGACY_AUDIT_PATH,
  DEFAULT_GATE71A_PROTOCOL_PATH,
  DEFAULT_GATE71BM_DIR,
  DEFAULT_GATE72A_DIR,
  GATE72_DATE,
  type Gate71Protocol,
} from "./gate72-utils";

const GATE_ID = "Gate 72A: warehouse-manifest-binding-audit";
const COMMAND = "npm run engine:gate72a:warehouse-manifest-binding-audit";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate72a/GATE72A_WAREHOUSE_MANIFEST_BINDING_AUDIT_${GATE72_DATE}.md`;
const DEFAULT_GATE68C_SUMMARY_PATH = "docs/research/gates/gate68c/artifacts/gate68c-frozen-seven-year-reference-capsule/gate68c-summary.json";

type Gate68cSummary = {
  verdict: string;
  capsule: {
    capsule_id: string;
    capsule_sha256: string;
  };
};

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE72A_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    manifestId: args.get("--basket-path-warehouse-id"),
    candidateBLedgerPath: args.get("--candidate-b-ledger") ?? DEFAULT_CANDIDATE_B_LEDGER_PATH,
  };
}

function renderReport(summary: Record<string, unknown>) {
  return [
    "# Gate 72A Warehouse / Manifest Binding Audit",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Audits the frozen Gate 71B-M basket path warehouse and Gate 71 protocol bindings before any exit shortlist review.",
    "- Confirms the path warehouse is complete, hash-stable, and config-bound to Candidate B, price bundle, 1m resolution, and clean exposure semantics.",
    "- Distinguishes direct warehouse-manifest fields from transitive upstream lock bindings.",
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Binding Audit",
    "",
    "```json",
    JSON.stringify(summary.binding_audit, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Binding audit: \`${summary.artifacts["bindingAudit"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Caveat",
    "",
    "Gate 68 capsule identity is not a direct field on the basket path warehouse manifest. It is bound transitively through Gate 69B, which binds Candidate B to the Gate 68 capsule, and Gate 71A/71B-M then bind the Candidate B ledger file into the warehouse.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const gate71a = await loadGate71aSummary();
  const protocol = await readJson<Gate71Protocol>(DEFAULT_GATE71A_PROTOCOL_PATH);
  const entryModel = await readJson<Record<string, unknown>>(DEFAULT_GATE71A_ENTRY_MODEL_PATH);
  const legacyAudit = await readJson<Record<string, unknown>>(DEFAULT_GATE71A_LEGACY_AUDIT_PATH);
  const gate68c = await readJson<Gate68cSummary>(DEFAULT_GATE68C_SUMMARY_PATH);
  const gate69 = await loadGate69Closeout();
  const rows = await loadCandidateBRows(options.candidateBLedgerPath);
  const rowShape = validateCandidateBRows(rows);
  const weeks = Array.from(new Set(rows.map((row) => row.week_open_utc))).sort();
  const candidateBLedgerFileHash = (await fileHash(options.candidateBLedgerPath)).toUpperCase();
  const config = buildGate71BasketPathWarehouseConfig({
    rows,
    weeks,
    candidateBLedgerHash: candidateBLedgerFileHash,
    entryExposureModelId: gate71a.protocol.clean_entry_exposure_model_id,
  });
  const expectedManifestId = buildGate71BasketPathWarehouseManifestId(config);
  const manifestId = options.manifestId ?? expectedManifestId;
  const ready = await assertBasketPathWarehouseReady({ manifestId, expectedWeeks: weeks, config });
  const bindingAudit = {
    manifest_id: manifestId,
    expected_manifest_id: expectedManifestId,
    direct_bindings: {
      warehouse_status_complete: ready.manifest.status === "complete",
      config_hash_matches: ready.manifest.config_hash === ready.inspection.config_hash,
      warehouse_hash_matches: ready.manifest.warehouse_hash === ready.inspection.warehouse_hash,
      candidate_b_ledger_file_sha256_bound: ready.manifest.candidate_b_ledger_hash === protocol.candidate_b_input.candidate_b_ledger_file_sha256,
      point_contract_id_bound: ready.manifest.point_contract_id === GATE71_BASKET_PATH_POINT_CONTRACT_ID,
      price_bundle_id_bound: ready.manifest.price_bundle_id === GATE71_PRICE_BUNDLE_ID,
      path_resolution_bound: ready.manifest.path_resolution === GATE71_PATH_RESOLUTION,
      clean_entry_exposure_model_id_bound: ready.manifest.entry_exposure_model_id === gate71a.protocol.clean_entry_exposure_model_id,
      adr_target_pct_bound: ready.manifest.adr_target_pct === protocol.adr_normalization.target_adr_pct,
      universe_symbol_count: ready.manifest.universe_symbols.length,
      week_count: ready.manifest.week_count,
      point_count: ready.manifest.point_count,
    },
    protocol_bindings: {
      objective: protocol.objective,
      adr_account_mapping: protocol.adr_normalization.account_mapping,
      execution_window: protocol.price_path.execution_window,
      entry_timestamp: protocol.price_path.entry_timestamp,
      close_timestamp: protocol.price_path.close_timestamp,
      threshold_crossing_semantics: protocol.price_path.threshold_crossing_semantics,
      spread_slippage_explicit_field_present: false,
      spread_slippage_assumption_for_gate72_review: "no additional spread/slippage layer beyond canonical price marks was introduced in Gate 71 clean basket path evidence",
    },
    transitive_upstream_bindings: {
      gate68_capsule_direct_manifest_field_present: false,
      gate68_capsule_id: gate68c.capsule.capsule_id,
      gate68_capsule_sha256: gate68c.capsule.capsule_sha256,
      gate69b_final_ledger_bound_to_gate68_capsule: gate69.gate69b.validation.final_ledger_bound_to_gate68_capsule,
      gate69b_final_ledger_hash: gate69.gate69b.ledger_hashes.final_ledger_hash,
      gate71a_candidate_b_final_ledger_hash: protocol.candidate_b_input.candidate_b_ledger_hash,
      gate71a_candidate_b_ledger_file_sha256: protocol.candidate_b_input.candidate_b_ledger_file_sha256,
    },
    coverage: {
      expected_weeks: GATE71_EXPECTED_WEEKS,
      expected_symbols_per_week: GATE71_EXPECTED_SYMBOLS_PER_WEEK,
      candidate_b_rows: rowShape.rows,
      candidate_b_weeks: rowShape.weeks,
      full_weeks: rowShape.full_weeks,
      duplicate_week_symbol_rows: rowShape.duplicate_week_symbol_rows,
      warehouse_missing_week_count: ready.inspection.missing_week_count,
      warehouse_duplicate_week_count: ready.inspection.duplicate_week_count,
      warehouse_point_count: ready.inspection.point_count,
    },
    legacy_adr_grid_boundary: {
      classification: legacyAudit.classification,
      can_be_foundation_for_clean_basket_path: legacyAudit.can_be_foundation_for_clean_basket_path,
      can_be_gate71_control: legacyAudit.can_be_gate71_control,
    },
    entry_model_exclusions: entryModel.excluded_behavior,
  };
  const pass =
    gate71a.verdict.startsWith("PASS_") &&
    gate68c.verdict.startsWith("PASS_") &&
    gate69.gate69b.verdict.startsWith("PASS_") &&
    gate69.gate69b.validation.final_ledger_bound_to_gate68_capsule &&
    protocol.candidate_b_input.candidate_b_ledger_hash === gate69.gate69b.ledger_hashes.final_ledger_hash &&
    protocol.candidate_b_input.candidate_b_ledger_file_sha256 === candidateBLedgerFileHash &&
    rowShape.forced28_preserved &&
    ready.manifest.status === "complete" &&
    ready.manifest.manifest_id === expectedManifestId &&
    ready.manifest.price_bundle_id === GATE71_PRICE_BUNDLE_ID &&
    ready.manifest.path_resolution === GATE71_PATH_RESOLUTION &&
    ready.manifest.entry_exposure_model_id === gate71a.protocol.clean_entry_exposure_model_id &&
    ready.inspection.missing_week_count === 0 &&
    ready.inspection.duplicate_week_count === 0 &&
    legacyAudit.can_be_foundation_for_clean_basket_path === false;
  const artifacts = {
    bindingAudit: toRepoRelative(path.join(artifactDir, "warehouse-manifest-binding-audit.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate72a-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate72a-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_WITH_CAVEAT_GATE72A_WAREHOUSE_MANIFEST_BINDING_AUDIT__DIRECT_PATH_BINDING_TRANSITIVE_GATE68" : "FAIL_GATE72A_WAREHOUSE_MANIFEST_BINDING_AUDIT",
    validation: {
      gate71a_passed: gate71a.verdict.startsWith("PASS_"),
      gate68c_passed: gate68c.verdict.startsWith("PASS_"),
      gate69b_passed: gate69.gate69b.verdict.startsWith("PASS_"),
      candidate_b_file_hash_matches_protocol: protocol.candidate_b_input.candidate_b_ledger_file_sha256 === candidateBLedgerFileHash,
      candidate_b_final_ledger_bound_to_gate68_transitively: gate69.gate69b.validation.final_ledger_bound_to_gate68_capsule === true,
      candidate_b_forced28_preserved: rowShape.forced28_preserved,
      manifest_id_matches_config_hash: ready.manifest.manifest_id === expectedManifestId,
      warehouse_ready_and_hash_valid: ready.manifest.status === "complete" && ready.manifest.warehouse_hash === ready.inspection.warehouse_hash,
      clean_entry_exposure_model_bound: ready.manifest.entry_exposure_model_id === gate71a.protocol.clean_entry_exposure_model_id,
      legacy_adr_grid_control_only: legacyAudit.can_be_gate71_control === true && legacyAudit.can_be_foundation_for_clean_basket_path === false,
      spread_slippage_explicit_protocol_field_present: false,
      gate68_capsule_direct_manifest_field_present: false,
      promotion_started: false,
      risk_layer_started: false,
    },
    binding_audit: bindingAudit,
    artifacts,
  };

  await writeJson(path.join(artifactDir, "warehouse-manifest-binding-audit.json"), bindingAudit);
  await writeJson(path.join(artifactDir, "gate72a-summary.json"), summary);
  await writeText(reportPath, renderReport(summary));
  await writeShaManifest(path.join(artifactDir, "gate72a-sha256.txt"), GATE_ID, COMMAND, [
    { label: "binding_audit", path: path.join(artifactDir, "warehouse-manifest-binding-audit.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate72a-summary.json") },
    { label: "report", path: reportPath },
    { label: "gate71bm_summary", path: path.join(DEFAULT_GATE71BM_DIR, "gate71bm-summary.json") },
    { label: "gate71b_summary", path: path.join(DEFAULT_GATE71B_DIR, "gate71b-summary.json") },
    { label: "gate71c_summary", path: path.join(DEFAULT_GATE71C_DIR, "gate71c-summary.json") },
  ]);

  if (!pass) throw new Error(summary.verdict);
  console.log(summary.verdict);
  console.log(JSON.stringify({ artifacts, validation: summary.validation }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
