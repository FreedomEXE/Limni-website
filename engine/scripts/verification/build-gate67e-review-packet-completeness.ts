import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { gitCommit, parseArgMap, toRepoRelative, writeJson, writeShaManifest, writeText } from "./gate65-utils";
import {
  DEFAULT_GATE67A_DIR,
  DEFAULT_GATE67B_DIR,
  DEFAULT_GATE67C_DIR,
  DEFAULT_GATE67D_DIR,
  DEFAULT_GATE67E_DIR,
  GATE67_DATE,
} from "./gate67-utils";

const GATE_ID = "Gate 67E: review-packet-completeness";
const COMMAND = "npm run engine:gate67e:review-packet-completeness";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate67e/GATE67E_REVIEW_PACKET_COMPLETENESS_${GATE67_DATE}.md`;

const REQUIRED_COMMANDS = [
  "engine:gate67a:cell-opinion-packet-contract",
  "engine:gate67b:final-forced28-candidate-contract",
  "engine:gate67c:final-forced28-test-matrix",
  "engine:gate67d:architecture-lock-readiness-review",
  "engine:gate67e:review-packet-completeness",
];

const REPORT_PATHS = [
  `docs/research/gates/gate67a/GATE67A_CELL_OPINION_PACKET_CONTRACT_${GATE67_DATE}.md`,
  `docs/research/gates/gate67b/GATE67B_FINAL_FORCED28_CANDIDATE_CONTRACT_${GATE67_DATE}.md`,
  `docs/research/gates/gate67c/GATE67C_FINAL_FORCED28_TEST_MATRIX_${GATE67_DATE}.md`,
  `docs/research/gates/gate67d/GATE67D_ARCHITECTURE_LOCK_READINESS_REVIEW_${GATE67_DATE}.md`,
];

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE67E_DIR,
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
    "# Gate 67E Review Packet Completeness",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Verifies Gate 67A-D artifact paths are repo-visible locally.",
    "- Verifies Gate 67 package commands exist.",
    "- Does not add research beyond Gate 67D.",
    "- Live PR and recovery state are updated after the final commit/push so the final head is truthful.",
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
    "Gate 67E is packaging/completeness only. No exits, risk, execution, app/runtime, source mutation, retuning, optimized thresholds, learned weights, pair exclusions, or date exclusions are started.",
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
  const shaManifests = [
    path.join(DEFAULT_GATE67A_DIR, "gate67a-sha256.txt"),
    path.join(DEFAULT_GATE67B_DIR, "gate67b-sha256.txt"),
    path.join(DEFAULT_GATE67C_DIR, "gate67c-sha256.txt"),
    path.join(DEFAULT_GATE67D_DIR, "gate67d-sha256.txt"),
  ];
  const referenced = new Set<string>([...REPORT_PATHS, ...shaManifests]);
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
    local_packet_ready_for_pr_update: missingArtifacts.length === 0 && missingCommands.length === 0,
    live_pr_update_performed_by_script: false,
    reason: "PR body must be updated after commit/push so final head SHA is live truth.",
  };
  const recoveryStateSummary = {
    gate_id: GATE_ID,
    recovery_files_to_update_after_push: [
      "C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md",
      "docs/backlog/CURRENT_WORK.md",
    ],
    final_head_available_before_commit: false,
  };
  const pass = missingArtifacts.length === 0 && missingCommands.length === 0;
  const artifacts = {
    repoVisibleArtifactCheck: toRepoRelative(path.join(artifactDir, "repo-visible-artifact-check.json")),
    prUpdateSummary: toRepoRelative(path.join(artifactDir, "pr-update-summary.json")),
    recoveryStateSummary: toRepoRelative(path.join(artifactDir, "recovery-state-summary.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate67e-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate67e-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_REVIEW_PACKET_COMPLETENESS__ARTIFACTS_REPO_VISIBLE__COMMANDS_PRESENT" : "FAIL_REVIEW_PACKET_COMPLETENESS",
    validation: {
      required_commands_present: missingCommands.length === 0,
      missing_commands: missingCommands,
      artifact_paths_checked: artifactChecks.length,
      missing_artifact_paths: missingArtifacts.map((row) => row.path),
      new_research_after_readiness_review: false,
      uncommitted_work_expected_until_final_commit: true,
    },
    artifacts,
  };

  await writeJson(path.join(artifactDir, "repo-visible-artifact-check.json"), repoVisibleArtifactCheck);
  await writeJson(path.join(artifactDir, "pr-update-summary.json"), prUpdateSummary);
  await writeJson(path.join(artifactDir, "recovery-state-summary.json"), recoveryStateSummary);
  await writeJson(path.join(artifactDir, "gate67e-summary.json"), summary);
  await writeText(reportPath, renderReport(summary));
  await writeShaManifest(path.join(artifactDir, "gate67e-sha256.txt"), GATE_ID, COMMAND, [
    { label: "repo_visible_artifact_check", path: path.join(artifactDir, "repo-visible-artifact-check.json") },
    { label: "pr_update_summary", path: path.join(artifactDir, "pr-update-summary.json") },
    { label: "recovery_state_summary", path: path.join(artifactDir, "recovery-state-summary.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate67e-summary.json") },
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
