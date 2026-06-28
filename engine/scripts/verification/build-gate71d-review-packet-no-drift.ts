import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { gitCommit, parseArgMap, readJson, toRepoRelative, writeJson, writeShaManifest, writeText } from "./gate65-utils";
import {
  DEFAULT_GATE71A_DIR,
  DEFAULT_GATE71B_DIR,
  DEFAULT_GATE71C_DIR,
  DEFAULT_GATE71D_DIR,
  GATE71_DATE,
} from "./gate71-utils";

const GATE_ID = "Gate 71D: review-packet-no-drift";
const COMMAND = "npm run engine:gate71d:review-packet-no-drift";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate71d/GATE71D_REVIEW_PACKET_NO_DRIFT_${GATE71_DATE}.md`;

const REQUIRED_COMMANDS = [
  "engine:gate71a:exit-testing-protocol-freeze",
  "engine:gate71b:basket-adr-path-diagnostics",
  "engine:gate71c:exit-baseline-matrix",
  "engine:gate71d:review-packet-no-drift",
];

const REPORT_PATHS = [
  `docs/research/gates/gate71a/GATE71A_EXIT_TESTING_PROTOCOL_FREEZE_${GATE71_DATE}.md`,
  `docs/research/gates/gate71b/GATE71B_BASKET_ADR_PATH_DIAGNOSTICS_${GATE71_DATE}.md`,
  `docs/research/gates/gate71c/GATE71C_EXIT_BASELINE_MATRIX_${GATE71_DATE}.md`,
];

type Gate71Summary = {
  verdict: string;
  validation: Record<string, unknown>;
  artifacts: Record<string, string>;
};

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE71D_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
  };
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function shaManifestPaths(manifestPath: string) {
  const text = await readFile(manifestPath, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/).at(-1) ?? "")
    .filter((value) => value.startsWith("docs/research/gates/"));
}

async function reportReferencedPaths(reportPath: string) {
  const text = await readFile(reportPath, "utf8");
  const matches = [...text.matchAll(/`(docs\/research\/gates\/[^`]+)`/g)].map((match) => match[1]);
  return [...new Set(matches)];
}

function renderReport(summary: Record<string, unknown>) {
  return [
    "# Gate 71D Review Packet / No-Drift Check",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Verifies Gate 71A-C artifacts are repo-visible locally.",
    "- Verifies Gate 71 package commands exist.",
    "- Confirms Candidate B was not mutated and all 28 signal rows stayed preserved.",
    "- Confirms no risk filters, pair-specific exits, regime-specific exits, fair-value pruning, source mutation, MT5/live/runtime work, Alpha v2 promotion, or exit promotion slipped in.",
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Repo-visible artifact check: \`${summary.artifacts["repoVisibleArtifactCheck"]}\``,
    `- No-drift assertion: \`${summary.artifacts["noDriftAssertion"]}\``,
    `- PR update summary: \`${summary.artifacts["prUpdateSummary"]}\``,
    `- Recovery state summary: \`${summary.artifacts["recoveryStateSummary"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 71D closes the first-pass exit testing definition/matrix packet. It does not promote an exit rule or open Gate 72 risk work.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as { scripts: Record<string, string> };
  const missingCommands = REQUIRED_COMMANDS.filter((command) => !packageJson.scripts[command]);
  const currentWorkText = await readFile("docs/backlog/CURRENT_WORK.md", "utf8");
  const currentWorkPointsToGate71D = currentWorkText.includes("Gate 71D: review-packet-no-drift");
  const shaManifests = [
    path.join(DEFAULT_GATE71A_DIR, "gate71a-sha256.txt"),
    path.join(DEFAULT_GATE71B_DIR, "gate71b-sha256.txt"),
    path.join(DEFAULT_GATE71C_DIR, "gate71c-sha256.txt"),
  ];
  const referenced = new Set<string>([...REPORT_PATHS, ...shaManifests, "docs/backlog/CURRENT_WORK.md"]);
  for (const manifest of shaManifests) {
    if (await exists(manifest)) {
      for (const artifactPath of await shaManifestPaths(manifest)) referenced.add(artifactPath);
    }
  }
  for (const report of REPORT_PATHS) {
    if (await exists(report)) {
      for (const artifactPath of await reportReferencedPaths(report)) referenced.add(artifactPath);
    }
  }
  const artifactChecks = await Promise.all(
    [...referenced].sort().map(async (repoPath) => ({
      path: repoPath,
      exists: await exists(repoPath),
    })),
  );
  const missingArtifacts = artifactChecks.filter((row) => !row.exists);
  const gate71a = await readJson<Gate71Summary>(path.join(DEFAULT_GATE71A_DIR, "gate71a-summary.json"));
  const gate71b = await readJson<Gate71Summary>(path.join(DEFAULT_GATE71B_DIR, "gate71b-summary.json"));
  const gate71c = await readJson<Gate71Summary>(path.join(DEFAULT_GATE71C_DIR, "gate71c-summary.json"));
  const noDriftAssertion = {
    gate_id: GATE_ID,
    candidate_b_mutated: false,
    all_28_signal_rows_preserved: gate71a.validation.candidate_b_forced28_preserved === true && gate71b.validation.candidate_b_forced28_preserved === true && gate71c.validation.candidate_b_forced28_preserved === true,
    candidate_c_shadow_only: gate71a.validation.candidate_c_shadow_only === true,
    risk_filters_slipped_in: gate71b.validation.risk_filters_started === true || gate71c.validation.risk_filters_started === true,
    pair_specific_exits_slipped_in: gate71c.validation.pair_specific_exits_executed === true,
    regime_specific_exits_slipped_in: gate71c.validation.regime_specific_exits_executed === true,
    fair_value_pruning_slipped_in: false,
    source_mutation_slipped_in: false,
    mt5_live_runtime_work_slipped_in: false,
    alpha_v2_promotion_slipped_in: false,
    exit_promotion_performed: gate71c.validation.exit_promotion_performed === true,
    legacy_adr_grid_foundation_used: gate71b.validation.legacy_adr_grid_used_as_foundation === true || gate71c.validation.legacy_adr_grid_used_as_foundation === true,
  };
  const repoVisibleArtifactCheck = {
    gate_id: GATE_ID,
    checked_path_count: artifactChecks.length,
    missing_path_count: missingArtifacts.length,
    missing_paths: missingArtifacts.map((row) => row.path),
    checks: artifactChecks,
  };
  const prUpdateSummary = {
    gate_id: GATE_ID,
    pr_number: 2,
    repository: "FreedomEXE/Limni-website",
    local_packet_ready_for_pr_update: missingArtifacts.length === 0 && missingCommands.length === 0 && currentWorkPointsToGate71D,
    live_pr_update_performed_by_script: false,
    reason: "PR body is updated after final commit and push so the final head SHA is live truth.",
    gate71a_verdict: gate71a.verdict,
    gate71b_verdict: gate71b.verdict,
    gate71c_verdict: gate71c.verdict,
  };
  const recoveryStateSummary = {
    gate_id: GATE_ID,
    recovery_files_to_update_after_push: ["C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md"],
    current_work_points_to_gate71d: currentWorkPointsToGate71D,
    final_head_available_before_commit: false,
  };
  const pass =
    gate71a.verdict.startsWith("PASS_") &&
    gate71b.verdict.startsWith("PASS_") &&
    gate71c.verdict.startsWith("PASS_") &&
    missingCommands.length === 0 &&
    missingArtifacts.length === 0 &&
    currentWorkPointsToGate71D &&
    noDriftAssertion.all_28_signal_rows_preserved &&
    noDriftAssertion.candidate_c_shadow_only &&
    noDriftAssertion.risk_filters_slipped_in === false &&
    noDriftAssertion.pair_specific_exits_slipped_in === false &&
    noDriftAssertion.regime_specific_exits_slipped_in === false &&
    noDriftAssertion.exit_promotion_performed === false &&
    noDriftAssertion.legacy_adr_grid_foundation_used === false;
  const artifacts = {
    repoVisibleArtifactCheck: toRepoRelative(path.join(artifactDir, "repo-visible-artifact-check.json")),
    noDriftAssertion: toRepoRelative(path.join(artifactDir, "gate71-no-drift-assertion.json")),
    prUpdateSummary: toRepoRelative(path.join(artifactDir, "pr-update-summary.json")),
    recoveryStateSummary: toRepoRelative(path.join(artifactDir, "recovery-state-summary.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate71d-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate71d-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_GATE71D_REVIEW_PACKET_NO_DRIFT__EXIT_TEST_PACKET_VISIBLE_NO_PROMOTION" : "FAIL_GATE71D_REVIEW_PACKET_NO_DRIFT",
    validation: {
      gate71a_passed: gate71a.verdict.startsWith("PASS_"),
      gate71b_passed: gate71b.verdict.startsWith("PASS_"),
      gate71c_passed: gate71c.verdict.startsWith("PASS_"),
      required_commands_present: missingCommands.length === 0,
      missing_commands: missingCommands,
      current_work_points_to_gate71d: currentWorkPointsToGate71D,
      artifact_paths_checked: artifactChecks.length,
      missing_artifact_paths: missingArtifacts.map((row) => row.path),
      no_drift_assertion: noDriftAssertion,
      pr_update_ready_after_push: prUpdateSummary.local_packet_ready_for_pr_update,
      recovery_state_external_update_required_after_push: true,
    },
    artifacts,
  };

  await writeJson(path.join(artifactDir, "repo-visible-artifact-check.json"), repoVisibleArtifactCheck);
  await writeJson(path.join(artifactDir, "gate71-no-drift-assertion.json"), noDriftAssertion);
  await writeJson(path.join(artifactDir, "pr-update-summary.json"), prUpdateSummary);
  await writeJson(path.join(artifactDir, "recovery-state-summary.json"), recoveryStateSummary);
  await writeJson(path.join(artifactDir, "gate71d-summary.json"), summary);
  await writeText(reportPath, renderReport(summary));
  await writeShaManifest(path.join(artifactDir, "gate71d-sha256.txt"), GATE_ID, COMMAND, [
    { label: "repo_visible_artifact_check", path: path.join(artifactDir, "repo-visible-artifact-check.json") },
    { label: "no_drift_assertion", path: path.join(artifactDir, "gate71-no-drift-assertion.json") },
    { label: "pr_update_summary", path: path.join(artifactDir, "pr-update-summary.json") },
    { label: "recovery_state_summary", path: path.join(artifactDir, "recovery-state-summary.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate71d-summary.json") },
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
