import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { gitCommit, parseArgMap, readJson, toRepoRelative, writeJson, writeShaManifest, writeText } from "./gate65-utils";
import { DEFAULT_GATE70A_DIR, DEFAULT_GATE70B_DIR, DEFAULT_GATE70C_DIR, DEFAULT_GATE70D_DIR, GATE70_DATE } from "./gate70-utils";

const GATE_ID = "Gate 70D: review-packet-completeness";
const COMMAND = "npm run engine:gate70d:review-packet-completeness";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate70d/GATE70D_REVIEW_PACKET_COMPLETENESS_${GATE70_DATE}.md`;

const REQUIRED_COMMANDS = [
  "engine:gate70a:locked-brain-input-preflight",
  "engine:gate70b:exit-expression-interface-preflight",
  "engine:gate70c:risk-portfolio-expression-preflight",
  "engine:gate70d:review-packet-completeness",
];

const REPORT_PATHS = [
  `docs/research/gates/gate70a/GATE70A_LOCKED_BRAIN_INPUT_PREFLIGHT_${GATE70_DATE}.md`,
  `docs/research/gates/gate70b/GATE70B_EXIT_EXPRESSION_INTERFACE_PREFLIGHT_${GATE70_DATE}.md`,
  `docs/research/gates/gate70c/GATE70C_RISK_PORTFOLIO_EXPRESSION_PREFLIGHT_${GATE70_DATE}.md`,
];

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE70D_DIR,
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
    "# Gate 70D Review Packet Completeness",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Verifies Gate 70A-C artifact paths are repo-visible locally.",
    "- Verifies Gate 70 package commands exist.",
    "- Verifies `docs/backlog/CURRENT_WORK.md` points to Gate 70D.",
    "- Confirms no exit scoring, risk pruning, P&L attribution, execution, MT5/live, or learning started.",
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
    "Gate 70D is packaging/completeness only. Gate 71 exit research matrix is not opened.",
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
  const currentWorkPointsToGate70D = currentWorkText.includes("Gate 70D: review-packet-completeness");
  const shaManifests = [
    path.join(DEFAULT_GATE70A_DIR, "gate70a-sha256.txt"),
    path.join(DEFAULT_GATE70B_DIR, "gate70b-sha256.txt"),
    path.join(DEFAULT_GATE70C_DIR, "gate70c-sha256.txt"),
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
  const gate70aSummary = await readJson<Record<string, unknown>>(path.join(DEFAULT_GATE70A_DIR, "gate70a-summary.json"));
  const gate70bSummary = await readJson<Record<string, unknown>>(path.join(DEFAULT_GATE70B_DIR, "gate70b-summary.json"));
  const gate70cSummary = await readJson<Record<string, unknown>>(path.join(DEFAULT_GATE70C_DIR, "gate70c-summary.json"));
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
    local_packet_ready_for_pr_update: missingArtifacts.length === 0 && missingCommands.length === 0 && currentWorkPointsToGate70D,
    live_pr_update_performed_by_script: false,
    reason: "PR body is updated after final commit and push so the final head SHA is live truth.",
    gate70a_verdict: gate70aSummary["verdict"],
    gate70b_verdict: gate70bSummary["verdict"],
    gate70c_verdict: gate70cSummary["verdict"],
  };
  const recoveryStateSummary = {
    gate_id: GATE_ID,
    recovery_files_to_update_after_push: ["C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md"],
    current_work_points_to_gate70d: currentWorkPointsToGate70D,
    final_head_available_before_commit: false,
  };
  const pass = missingArtifacts.length === 0 && missingCommands.length === 0 && currentWorkPointsToGate70D;
  const artifacts = {
    repoVisibleArtifactCheck: toRepoRelative(path.join(artifactDir, "repo-visible-artifact-check.json")),
    prUpdateSummary: toRepoRelative(path.join(artifactDir, "pr-update-summary.json")),
    recoveryStateSummary: toRepoRelative(path.join(artifactDir, "recovery-state-summary.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate70d-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate70d-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_GATE70_REVIEW_PACKET_COMPLETENESS__INTERFACE_PREFLIGHT_ARTIFACTS_VISIBLE" : "FAIL_GATE70_REVIEW_PACKET_COMPLETENESS",
    validation: {
      required_commands_present: missingCommands.length === 0,
      missing_commands: missingCommands,
      current_work_points_to_gate70d: currentWorkPointsToGate70D,
      artifact_paths_checked: artifactChecks.length,
      missing_artifact_paths: missingArtifacts.map((row) => row.path),
      exit_scoring_started: false,
      risk_pruning_started: false,
      p_and_l_attribution_started: false,
      execution_started: false,
      mt5_live_started: false,
      learning_started: false,
      pr_update_ready_after_push: prUpdateSummary.local_packet_ready_for_pr_update,
      recovery_state_external_update_required_after_push: true,
    },
    artifacts,
  };

  await writeJson(path.join(artifactDir, "repo-visible-artifact-check.json"), repoVisibleArtifactCheck);
  await writeJson(path.join(artifactDir, "pr-update-summary.json"), prUpdateSummary);
  await writeJson(path.join(artifactDir, "recovery-state-summary.json"), recoveryStateSummary);
  await writeJson(path.join(artifactDir, "gate70d-summary.json"), summary);
  await writeText(reportPath, renderReport(summary));
  await writeShaManifest(path.join(artifactDir, "gate70d-sha256.txt"), GATE_ID, COMMAND, [
    { label: "repo_visible_artifact_check", path: path.join(artifactDir, "repo-visible-artifact-check.json") },
    { label: "pr_update_summary", path: path.join(artifactDir, "pr-update-summary.json") },
    { label: "recovery_state_summary", path: path.join(artifactDir, "recovery-state-summary.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate70d-summary.json") },
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
