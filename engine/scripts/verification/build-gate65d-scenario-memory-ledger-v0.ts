import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_GATE65B_DIR,
  DEFAULT_GATE65C_DIR,
  EXPECTED_ROWS,
  GATE65_DATE,
  AtomPolicyLedgerRow,
  buildScenarioMemoryRows,
  countBy,
  denominatorSummary,
  gitCommit,
  loadAlphaRows,
  parseArgMap,
  readJson,
  readJsonl,
  renderTable,
  scenarioGroupSummaries,
  toRepoRelative,
  writeJson,
  writeJsonl,
  writeShaManifest,
  writeText,
} from "./gate65-utils";

const GATE_ID = "Gate 65D: scenario-memory-ledger-v0";
const COMMAND = "npm run engine:gate65d:scenario-memory-ledger-v0";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate65d/artifacts/gate65d-scenario-memory-ledger-v0";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate65d/GATE65D_SCENARIO_MEMORY_LEDGER_V0_${GATE65_DATE}.md`;
const GROUPING_KEYS = [
  "exact_state_key",
  "cell_agreement_state_key",
  "macro_value_state_key",
  "source_quality_state_key",
  "cot_strength_disagreement_state_key",
  "rrp_valuation_agreement_state_key",
] as const;

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate65bDir: args.get("--gate65b-dir") ?? DEFAULT_GATE65B_DIR,
    gate65cDir: args.get("--gate65c-dir") ?? DEFAULT_GATE65C_DIR,
  };
}

function renderReport(summary: Record<string, unknown>, groupSummary: Record<string, Array<Record<string, unknown>>>) {
  const compact = (rows: Array<Record<string, unknown>>) =>
    rows.slice(0, 10).map((row) => ({
      group_key: String(row.group_key).slice(0, 80),
      support: row.support_count,
      years: row.years_covered,
      follow_pf: (row.adr_grid_follow as { row_pf?: number | null }).row_pf,
      fade_pf: (row.adr_grid_fade as { row_pf?: number | null }).row_pf,
      hint: row.descriptive_reliability_hint,
      low_support: row.low_support_warning,
    }));
  return [
    "# Gate 65D Scenario Memory Ledger v0",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Descriptive memory ledger only.",
    "- Fingerprints are built from point-in-time atom and policy state fields.",
    "- Outcomes are used only in retrospective group summaries.",
    "- No final forced-28 algorithm direction, hidden optimized group, or final decision is emitted.",
    "",
    "## Group Summary Samples",
    "",
    "### Cell Agreement State",
    "",
    renderTable(compact(groupSummary.cell_agreement_state_key), ["group_key", "support", "years", "follow_pf", "fade_pf", "hint", "low_support"]),
    "",
    "### RRP / Valuation Agreement State",
    "",
    renderTable(compact(groupSummary.rrp_valuation_agreement_state_key), ["group_key", "support", "years", "follow_pf", "fade_pf", "hint", "low_support"]),
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Scenario rows: \`${summary.artifacts["scenarioRows"]}\``,
    `- Group summary: \`${summary.artifacts["groupSummary"]}\``,
    `- Scenario policy/outcome summary: \`${summary.artifacts["policyOutcomeSummary"]}\``,
    `- Low-support report: \`${summary.artifacts["lowSupportReport"]}\``,
    `- Scenario memory contract: \`${summary.artifacts["scenarioContract"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 65D stops at descriptive scenario-memory evidence. It does not open final forced-28 algorithm design, Alpha v2, risk, execution, or optimization.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const alphaRows = await loadAlphaRows();
  const policyRows = await readJsonl<AtomPolicyLedgerRow>(path.join(options.gate65cDir, "atom-policy-ledger.rows.jsonl"));
  const gate65bSummary = await readJson<Record<string, unknown>>(path.join(options.gate65bDir, "gate65b-summary.json"));
  const scenarioRows = buildScenarioMemoryRows(alphaRows, policyRows);
  const groupSummary = Object.fromEntries(GROUPING_KEYS.map((key) => [key, scenarioGroupSummaries(scenarioRows, key)]));
  const lowSupportEntries = Object.fromEntries(
    Object.entries(groupSummary).map(([key, rows]) => [
      key,
      rows
        .filter((row) => row.low_support_warning)
        .slice(0, 500)
        .map((row) => ({
          grouping_key: row.grouping_key,
          group_key: row.group_key,
          support_count: row.support_count,
          years_covered: row.years_covered,
          descriptive_reliability_hint: row.descriptive_reliability_hint,
        })),
    ]),
  );
  const policyOutcomeSummary = {
    gate_id: GATE_ID,
    descriptive_only: true,
    policy_role_exposure: countBy(policyRows, (row) => row.policy_role),
    scenario_group_counts: Object.fromEntries(Object.entries(groupSummary).map(([key, rows]) => [key, rows.length])),
    high_support_reliability_hints: Object.fromEntries(
      Object.entries(groupSummary).map(([key, rows]) => [
        key,
        countBy(
          rows.filter((row) => !row.low_support_warning),
          (row) => row.descriptive_reliability_hint,
        ),
      ]),
    ),
    gate65b_pf_surface_reference: {
      verdict: gate65bSummary["verdict"],
      summary_path: toRepoRelative(path.join(options.gate65bDir, "gate65b-summary.json")),
    },
  };
  const scenarioContract = {
    gate_id: GATE_ID,
    contract_version: "gate65d_scenario_memory_ledger_v0",
    fingerprint_inputs: [
      "COT direction/tier/lifecycle/source-quality state",
      "Strength direction/phase/lifecycle state",
      "RRP inverse direction",
      "valuation_gap REER and NEER/REER relative direction/tier",
      "BPR direction and quality class",
      "fixed agreement graph",
      "calendar-only year/quarter metadata",
    ],
    grouping_keys: GROUPING_KEYS,
    outcomes_used_only_for_retrospective_group_summaries: true,
    optimized_groups_created: false,
    final_algorithm_direction_emitted: false,
  };
  const denominator = denominatorSummary(alphaRows);
  const pass = denominator.forced28_preserved && scenarioRows.length === EXPECTED_ROWS && policyRows.length > EXPECTED_ROWS;
  const artifacts = {
    scenarioRows: toRepoRelative(path.join(artifactDir, "scenario-memory.rows.jsonl")),
    groupSummary: toRepoRelative(path.join(artifactDir, "scenario-group-summary.json")),
    policyOutcomeSummary: toRepoRelative(path.join(artifactDir, "scenario-policy-outcome-summary.json")),
    lowSupportReport: toRepoRelative(path.join(artifactDir, "low-support-scenario-report.json")),
    scenarioContract: toRepoRelative(path.join(artifactDir, "scenario-memory-contract.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate65d-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate65d-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_SCENARIO_MEMORY_LEDGER_V0__DESCRIPTIVE_ONLY__NO_FINAL_ALGORITHM_DIRECTION__LOW_SUPPORT_FLAGGED" : "FAIL_SCENARIO_MEMORY_LEDGER_V0_BOUNDARY_OR_DENOMINATOR",
    denominator,
    scenario_rows: scenarioRows.length,
    group_counts: Object.fromEntries(Object.entries(groupSummary).map(([key, rows]) => [key, rows.length])),
    low_support_group_counts: Object.fromEntries(Object.entries(groupSummary).map(([key, rows]) => [key, rows.filter((row) => row.low_support_warning).length])),
    validation: {
      scenario_memory_descriptive_only: true,
      fingerprints_point_in_time_or_calendar_only: true,
      outcomes_used_only_for_retrospective_scoring_summaries: true,
      optimized_groups_created: false,
      final_algorithm_direction_emitted: false,
      forced28_preserved: denominator.forced28_preserved,
      low_support_groups_explicitly_flagged: true,
    },
    artifacts,
  };

  await writeJsonl(path.join(artifactDir, "scenario-memory.rows.jsonl"), scenarioRows);
  await writeJson(path.join(artifactDir, "scenario-group-summary.json"), {
    gate_id: GATE_ID,
    grouping_summaries: groupSummary,
  });
  await writeJson(path.join(artifactDir, "scenario-policy-outcome-summary.json"), policyOutcomeSummary);
  await writeJson(path.join(artifactDir, "low-support-scenario-report.json"), {
    gate_id: GATE_ID,
    low_support_definition: "support_count < 112 rows or fewer than 3 years covered",
    entries: lowSupportEntries,
  });
  await writeJson(path.join(artifactDir, "scenario-memory-contract.json"), scenarioContract);
  await writeJson(path.join(artifactDir, "gate65d-summary.json"), summary);
  await writeText(reportPath, renderReport(summary, groupSummary as Record<string, Array<Record<string, unknown>>>));
  await writeShaManifest(path.join(artifactDir, "gate65d-sha256.txt"), GATE_ID, COMMAND, [
    { label: "scenario_memory_rows", path: path.join(artifactDir, "scenario-memory.rows.jsonl") },
    { label: "scenario_group_summary", path: path.join(artifactDir, "scenario-group-summary.json") },
    { label: "scenario_policy_outcome_summary", path: path.join(artifactDir, "scenario-policy-outcome-summary.json") },
    { label: "low_support_scenario_report", path: path.join(artifactDir, "low-support-scenario-report.json") },
    { label: "scenario_memory_contract", path: path.join(artifactDir, "scenario-memory-contract.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate65d-summary.json") },
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
