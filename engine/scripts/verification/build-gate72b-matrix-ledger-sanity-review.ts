import { mkdir } from "node:fs/promises";
import path from "node:path";

import { countBy, gitCommit, parseArgMap, readJson, toRepoRelative, writeJson, writeShaManifest, writeText } from "./gate65-utils";
import { GATE71_EXPECTED_WEEKS } from "./gate71-utils";
import {
  DEFAULT_GATE71C_CANDIDATE_SUMMARIES_PATH,
  DEFAULT_GATE71C_PREDECLARED_MATRIX_PATH,
  DEFAULT_GATE71C_WEEKLY_ROWS_PATH,
  DEFAULT_GATE72A_DIR,
  DEFAULT_GATE72B_DIR,
  GATE72_DATE,
  loadGate71ExitMatrixArtifacts,
  loadGate71Summaries,
  PAIR_SILO_CONTROL_ID,
  WEEKLY_HOLD_CONTROL_ID,
  type Gate72Summary,
} from "./gate72-utils";

const GATE_ID = "Gate 72B: matrix-ledger-sanity-review";
const COMMAND = "npm run engine:gate72b:matrix-ledger-sanity-review";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate72b/GATE72B_MATRIX_LEDGER_SANITY_REVIEW_${GATE72_DATE}.md`;

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE72B_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate72aDir: args.get("--gate72a-dir") ?? DEFAULT_GATE72A_DIR,
  };
}

function renderReport(summary: Record<string, unknown>) {
  return [
    "# Gate 72B Matrix Ledger Sanity Review",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Verifies the Gate 71C matrix result ledger before ranking.",
    "- Confirms rule/week shape, duplicate keys, unavailable controls, Candidate B hash consistency, and warehouse replay flags.",
    "- Does not score new exits or promote any exit.",
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Matrix Integrity",
    "",
    "```json",
    JSON.stringify(summary.matrix_integrity, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Matrix integrity: \`${summary.artifacts["matrixIntegrity"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const gate72a = await readJson<Gate72Summary>(path.join(options.gate72aDir, "gate72a-summary.json"));
  const gate71 = await loadGate71Summaries();
  const { candidateSummaries, weeklyRows, predeclaredMatrix } = await loadGate71ExitMatrixArtifacts();
  const ruleIds = candidateSummaries.map((row) => row.rule_id).sort();
  const weekIds = Array.from(new Set(weeklyRows.map((row) => row.week_open_utc))).sort();
  const expectedRows = ruleIds.length * weekIds.length;
  const ruleWeekCounts = countBy(weeklyRows, (row) => `${row.rule_id}|${row.week_open_utc}`);
  const duplicateRuleWeeks = Object.entries(ruleWeekCounts).filter((entry) => entry[1] > 1).map(([key]) => key);
  const rowRulesMissingFromSummary = Array.from(new Set(weeklyRows.map((row) => row.rule_id))).filter((ruleId) => !ruleIds.includes(ruleId)).sort();
  const summaryRulesMissingFromRows = ruleIds.filter((ruleId) => !weeklyRows.some((row) => row.rule_id === ruleId));
  const hashes = Array.from(new Set(weeklyRows.map((row) => row.candidate_b_ledger_hash))).sort();
  const pathDiagnosticHashesByWeek = new Map<string, Set<string>>();
  for (const row of weeklyRows) {
    const set = pathDiagnosticHashesByWeek.get(row.week_open_utc) ?? new Set<string>();
    set.add(row.path_diagnostic_hash);
    pathDiagnosticHashesByWeek.set(row.week_open_utc, set);
  }
  const inconsistentDiagnosticHashWeeks = [...pathDiagnosticHashesByWeek.entries()]
    .filter((entry) => entry[1].size !== 1)
    .map(([week]) => week);
  const unavailableRows = weeklyRows.filter((row) => !row.available);
  const unavailableByRule = countBy(unavailableRows, (row) => row.rule_id);
  const weeklyHoldRows = weeklyRows.filter((row) => row.rule_id === WEEKLY_HOLD_CONTROL_ID);
  const matrixIntegrity = {
    candidate_summary_count: candidateSummaries.length,
    predeclared_rule_count: Array.isArray(predeclaredMatrix["rules"]) ? (predeclaredMatrix["rules"] as unknown[]).length : null,
    week_count: weekIds.length,
    expected_week_count: GATE71_EXPECTED_WEEKS,
    weekly_matrix_rows: weeklyRows.length,
    expected_weekly_matrix_rows: expectedRows,
    duplicate_rule_week_count: duplicateRuleWeeks.length,
    duplicate_rule_weeks_sample: duplicateRuleWeeks.slice(0, 25),
    row_rules_missing_from_summary: rowRulesMissingFromSummary,
    summary_rules_missing_from_rows: summaryRulesMissingFromRows,
    candidate_b_ledger_hashes: hashes,
    path_diagnostic_hash_count: pathDiagnosticHashesByWeek.size,
    inconsistent_diagnostic_hash_weeks: inconsistentDiagnosticHashWeeks,
    unavailable_rows: unavailableRows.length,
    unavailable_by_rule: unavailableByRule,
    pair_silo_unavailable_only: Object.keys(unavailableByRule).length === 1 && unavailableByRule[PAIR_SILO_CONTROL_ID] === GATE71_EXPECTED_WEEKS,
    weekly_hold_rows: weeklyHoldRows.length,
    gate71c_replay_from_warehouse: gate71.gate71c.validation.exit_policy_replay_from_frozen_warehouse === true,
    gate71c_raw_m1_rebuild_performed: gate71.gate71c.validation.raw_m1_rebuild_performed === true,
    gate71c_exit_promotion_performed: gate71.gate71c.validation.exit_promotion_performed === true,
    legacy_adr_grid_control_only: gate71.gate71c.validation.legacy_adr_grid_control_only === true,
  };
  const pass =
    gate72a.verdict.startsWith("PASS") &&
    gate71.gate71c.verdict.startsWith("PASS_") &&
    candidateSummaries.length === 34 &&
    weekIds.length === GATE71_EXPECTED_WEEKS &&
    weeklyRows.length === expectedRows &&
    duplicateRuleWeeks.length === 0 &&
    rowRulesMissingFromSummary.length === 0 &&
    summaryRulesMissingFromRows.length === 0 &&
    hashes.length === 1 &&
    inconsistentDiagnosticHashWeeks.length === 0 &&
    matrixIntegrity.pair_silo_unavailable_only === true &&
    gate71.gate71c.validation.exit_policy_replay_from_frozen_warehouse === true &&
    gate71.gate71c.validation.raw_m1_rebuild_performed === false &&
    gate71.gate71c.validation.exit_promotion_performed === false &&
    gate71.gate71c.validation.risk_filters_started === false;
  const artifacts = {
    matrixIntegrity: toRepoRelative(path.join(artifactDir, "matrix-ledger-integrity.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate72b-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate72b-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_GATE72B_MATRIX_LEDGER_SANITY_REVIEW__RESULT_LEDGER_SHAPE_VALID_NO_REPLAY_DRIFT" : "FAIL_GATE72B_MATRIX_LEDGER_SANITY_REVIEW",
    validation: {
      gate72a_passed: gate72a.verdict.startsWith("PASS"),
      gate71c_passed: gate71.gate71c.verdict.startsWith("PASS_"),
      rule_count_matches: candidateSummaries.length === 34,
      week_count_matches: weekIds.length === GATE71_EXPECTED_WEEKS,
      weekly_row_count_matches_rule_x_week: weeklyRows.length === expectedRows,
      duplicate_rule_week_rows: duplicateRuleWeeks.length,
      candidate_b_hash_singleton: hashes.length === 1,
      path_diagnostic_hash_singleton_per_week: inconsistentDiagnosticHashWeeks.length === 0,
      unavailable_rows_limited_to_pair_silo_control: matrixIntegrity.pair_silo_unavailable_only === true,
      warehouse_replay_confirmed: gate71.gate71c.validation.exit_policy_replay_from_frozen_warehouse === true,
      raw_m1_rebuild_performed: gate71.gate71c.validation.raw_m1_rebuild_performed === true,
      exit_promotion_performed: gate71.gate71c.validation.exit_promotion_performed === true,
      risk_layer_started: gate71.gate71c.validation.risk_filters_started === true,
    },
    matrix_integrity: matrixIntegrity,
    artifacts,
  };

  await writeJson(path.join(artifactDir, "matrix-ledger-integrity.json"), matrixIntegrity);
  await writeJson(path.join(artifactDir, "gate72b-summary.json"), summary);
  await writeText(reportPath, renderReport(summary));
  await writeShaManifest(path.join(artifactDir, "gate72b-sha256.txt"), GATE_ID, COMMAND, [
    { label: "matrix_integrity", path: path.join(artifactDir, "matrix-ledger-integrity.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate72b-summary.json") },
    { label: "report", path: reportPath },
    { label: "gate71c_candidate_summaries", path: DEFAULT_GATE71C_CANDIDATE_SUMMARIES_PATH },
    { label: "gate71c_weekly_rows", path: DEFAULT_GATE71C_WEEKLY_ROWS_PATH },
    { label: "gate71c_predeclared_matrix", path: DEFAULT_GATE71C_PREDECLARED_MATRIX_PATH },
  ]);

  if (!pass) throw new Error(summary.verdict);
  console.log(summary.verdict);
  console.log(JSON.stringify({ artifacts, validation: summary.validation }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
