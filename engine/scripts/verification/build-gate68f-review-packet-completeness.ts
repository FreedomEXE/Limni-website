import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { gitCommit, parseArgMap, readJson, toRepoRelative, writeJson, writeShaManifest, writeText } from "./gate65-utils";
import {
  DEFAULT_GATE68A_DIR,
  DEFAULT_GATE68B_DIR,
  DEFAULT_GATE68C_DIR,
  DEFAULT_GATE68D_DIR,
  DEFAULT_GATE68E_DIR,
  DEFAULT_GATE68F_DIR,
  GATE68_DATE,
} from "./gate68-utils";

const GATE_ID = "Gate 68F: review-packet-completeness";
const COMMAND = "npm run engine:gate68f:review-packet-completeness";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate68f/GATE68F_REVIEW_PACKET_COMPLETENESS_${GATE68_DATE}.md`;

const REQUIRED_COMMANDS = [
  "engine:gate68a:brain-mode-selector-contract",
  "engine:gate68b:brain-mode-selector-test-matrix",
  "engine:gate68c:frozen-seven-year-reference-capsule",
  "engine:gate68d:forward-decision-receipt-and-drift-monitor",
  "engine:gate68e:architecture-lock-readiness-review",
  "engine:gate68f:review-packet-completeness",
];

const REPORT_PATHS = [
  `docs/research/gates/gate68a/GATE68A_BRAIN_MODE_SELECTOR_CONTRACT_${GATE68_DATE}.md`,
  `docs/research/gates/gate68b/GATE68B_BRAIN_MODE_SELECTOR_TEST_MATRIX_${GATE68_DATE}.md`,
  `docs/research/gates/gate68c/GATE68C_FROZEN_SEVEN_YEAR_REFERENCE_CAPSULE_${GATE68_DATE}.md`,
  `docs/research/gates/gate68d/GATE68D_FORWARD_DECISION_RECEIPT_AND_DRIFT_MONITOR_CONTRACT_${GATE68_DATE}.md`,
  `docs/research/gates/gate68e/GATE68E_ARCHITECTURE_LOCK_READINESS_REVIEW_${GATE68_DATE}.md`,
];

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE68F_DIR,
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
    "# Gate 68F Review Packet Completeness",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Verifies Gate 68A-E artifact paths are repo-visible locally.",
    "- Verifies Gate 68 package commands exist.",
    "- Verifies `docs/backlog/CURRENT_WORK.md` points to Gate 68F.",
    "- Does not add research beyond Gate 68E.",
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
    `- PR update summary: \`${summary.artifacts["prUpdateSummary"]}\``,
    `- Recovery state summary: \`${summary.artifacts["recoveryStateSummary"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 68F is packaging/completeness only. Gate 69 is not opened.",
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
  const currentWorkPointsToGate68F = currentWorkText.includes("Gate 68F: review-packet-completeness");
  const shaManifests = [
    path.join(DEFAULT_GATE68A_DIR, "gate68a-sha256.txt"),
    path.join(DEFAULT_GATE68B_DIR, "gate68b-sha256.txt"),
    path.join(DEFAULT_GATE68C_DIR, "gate68c-sha256.txt"),
    path.join(DEFAULT_GATE68D_DIR, "gate68d-sha256.txt"),
    path.join(DEFAULT_GATE68E_DIR, "gate68e-sha256.txt"),
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
  const gate68bSummary = await readJson<Record<string, unknown>>(path.join(DEFAULT_GATE68B_DIR, "brain-mode-selector-test-summary.json"));
  const gate68cSummary = await readJson<Record<string, unknown>>(path.join(DEFAULT_GATE68C_DIR, "gate68c-summary.json"));
  const gate68eSummary = await readJson<Record<string, unknown>>(path.join(DEFAULT_GATE68E_DIR, "gate68e-summary.json"));
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
    local_packet_ready_for_pr_update: missingArtifacts.length === 0 && missingCommands.length === 0 && currentWorkPointsToGate68F,
    live_pr_update_performed_by_script: false,
    reason: "PR body is updated after final commit and push so the final head SHA is live truth.",
    gate68b_candidate_d_review: gate68bSummary["candidate_d_review"],
    gate68c_capsule: gate68cSummary["capsule"],
    gate68e_readiness_verdict: gate68eSummary["readiness_verdict"],
  };
  const recoveryStateSummary = {
    gate_id: GATE_ID,
    recovery_files_to_update_after_push: ["C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md"],
    current_work_points_to_gate68f: currentWorkPointsToGate68F,
    final_head_available_before_commit: false,
  };
  const pass = missingArtifacts.length === 0 && missingCommands.length === 0 && currentWorkPointsToGate68F;
  const artifacts = {
    repoVisibleArtifactCheck: toRepoRelative(path.join(artifactDir, "repo-visible-artifact-check.json")),
    prUpdateSummary: toRepoRelative(path.join(artifactDir, "pr-update-summary.json")),
    recoveryStateSummary: toRepoRelative(path.join(artifactDir, "recovery-state-summary.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate68f-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate68f-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_REVIEW_PACKET_COMPLETENESS__GATE68_ARTIFACTS_REPO_VISIBLE__COMMANDS_PRESENT" : "FAIL_REVIEW_PACKET_COMPLETENESS",
    validation: {
      required_commands_present: missingCommands.length === 0,
      missing_commands: missingCommands,
      current_work_points_to_gate68f: currentWorkPointsToGate68F,
      artifact_paths_checked: artifactChecks.length,
      missing_artifact_paths: missingArtifacts.map((row) => row.path),
      new_research_after_gate68e: false,
      pr_update_ready_after_push: prUpdateSummary.local_packet_ready_for_pr_update,
      recovery_state_external_update_required_after_push: true,
    },
    artifacts,
  };

  await writeJson(path.join(artifactDir, "repo-visible-artifact-check.json"), repoVisibleArtifactCheck);
  await writeJson(path.join(artifactDir, "pr-update-summary.json"), prUpdateSummary);
  await writeJson(path.join(artifactDir, "recovery-state-summary.json"), recoveryStateSummary);
  await writeJson(path.join(artifactDir, "gate68f-summary.json"), summary);
  await writeText(reportPath, renderReport(summary));
  await writeShaManifest(path.join(artifactDir, "gate68f-sha256.txt"), GATE_ID, COMMAND, [
    { label: "repo_visible_artifact_check", path: path.join(artifactDir, "repo-visible-artifact-check.json") },
    { label: "pr_update_summary", path: path.join(artifactDir, "pr-update-summary.json") },
    { label: "recovery_state_summary", path: path.join(artifactDir, "recovery-state-summary.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate68f-summary.json") },
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
