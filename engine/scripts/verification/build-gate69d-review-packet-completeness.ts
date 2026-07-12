import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { gitCommit, parseArgMap, readJson, toRepoRelative, writeJson, writeShaManifest, writeText } from "./gate65-utils";
import { DEFAULT_GATE69A_DIR, DEFAULT_GATE69B_DIR, DEFAULT_GATE69C_DIR, DEFAULT_GATE69D_DIR, GATE69_DATE } from "./gate69-utils";

const GATE_ID = "Gate 69D: review-packet-completeness";
const COMMAND = "npm run engine:gate69d:review-packet-completeness";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate69d/GATE69D_REVIEW_PACKET_COMPLETENESS_${GATE69_DATE}.md`;

const REQUIRED_COMMANDS = [
  "engine:gate69a:final-forced28-lock-contract",
  "engine:gate69b:final-forced28-ledger-replay",
  "engine:gate69c:exit-risk-interface-and-no-drift",
  "engine:gate69d:review-packet-completeness",
];

const REPORT_PATHS = [
  `docs/research/gates/gate69a/GATE69A_FINAL_FORCED28_LOCK_CONTRACT_${GATE69_DATE}.md`,
  `docs/research/gates/gate69b/GATE69B_FINAL_FORCED28_LEDGER_REPLAY_${GATE69_DATE}.md`,
  `docs/research/gates/gate69c/GATE69C_EXIT_RISK_INTERFACE_AND_NO_DRIFT_${GATE69_DATE}.md`,
];

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE69D_DIR,
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
    "# Gate 69D Review Packet Completeness",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Verifies Gate 69A-C artifact paths are repo-visible locally.",
    "- Verifies Gate 69 package commands exist.",
    "- Verifies `docs/backlog/CURRENT_WORK.md` points to Gate 69D.",
    "- Does not add research beyond the Gate 69C interface/no-drift proof.",
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
    "Gate 69D is packaging/completeness only. Exits and risk are not opened.",
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
  const currentWorkPointsToGate69D = currentWorkText.includes("Gate 69D: review-packet-completeness");
  const shaManifests = [
    path.join(DEFAULT_GATE69A_DIR, "gate69a-sha256.txt"),
    path.join(DEFAULT_GATE69B_DIR, "gate69b-sha256.txt"),
    path.join(DEFAULT_GATE69C_DIR, "gate69c-sha256.txt"),
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
  const gate69aSummary = await readJson<Record<string, unknown>>(path.join(DEFAULT_GATE69A_DIR, "gate69a-summary.json"));
  const gate69bSummary = await readJson<Record<string, unknown>>(path.join(DEFAULT_GATE69B_DIR, "gate69b-summary.json"));
  const gate69cSummary = await readJson<Record<string, unknown>>(path.join(DEFAULT_GATE69C_DIR, "gate69c-summary.json"));
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
    local_packet_ready_for_pr_update: missingArtifacts.length === 0 && missingCommands.length === 0 && currentWorkPointsToGate69D,
    live_pr_update_performed_by_script: false,
    reason: "PR body is updated after final commit and push so the final head SHA is live truth.",
    gate69a_verdict: gate69aSummary["verdict"],
    gate69b_verdict: gate69bSummary["verdict"],
    gate69c_verdict: gate69cSummary["verdict"],
  };
  const recoveryStateSummary = {
    gate_id: GATE_ID,
    recovery_files_to_update_after_push: ["C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md"],
    current_work_points_to_gate69d: currentWorkPointsToGate69D,
    final_head_available_before_commit: false,
  };
  const pass = missingArtifacts.length === 0 && missingCommands.length === 0 && currentWorkPointsToGate69D;
  const artifacts = {
    repoVisibleArtifactCheck: toRepoRelative(path.join(artifactDir, "repo-visible-artifact-check.json")),
    prUpdateSummary: toRepoRelative(path.join(artifactDir, "pr-update-summary.json")),
    recoveryStateSummary: toRepoRelative(path.join(artifactDir, "recovery-state-summary.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate69d-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate69d-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_GATE69_REVIEW_PACKET_COMPLETENESS__LOCK_LEDGER_INTERFACE_ARTIFACTS_VISIBLE" : "FAIL_GATE69_REVIEW_PACKET_COMPLETENESS",
    validation: {
      required_commands_present: missingCommands.length === 0,
      missing_commands: missingCommands,
      current_work_points_to_gate69d: currentWorkPointsToGate69D,
      artifact_paths_checked: artifactChecks.length,
      missing_artifact_paths: missingArtifacts.map((row) => row.path),
      new_research_after_gate69c: false,
      exits_risk_started: false,
      pr_update_ready_after_push: prUpdateSummary.local_packet_ready_for_pr_update,
      recovery_state_external_update_required_after_push: true,
    },
    artifacts,
  };

  await writeJson(path.join(artifactDir, "repo-visible-artifact-check.json"), repoVisibleArtifactCheck);
  await writeJson(path.join(artifactDir, "pr-update-summary.json"), prUpdateSummary);
  await writeJson(path.join(artifactDir, "recovery-state-summary.json"), recoveryStateSummary);
  await writeJson(path.join(artifactDir, "gate69d-summary.json"), summary);
  await writeText(reportPath, renderReport(summary));
  await writeShaManifest(path.join(artifactDir, "gate69d-sha256.txt"), GATE_ID, COMMAND, [
    { label: "repo_visible_artifact_check", path: path.join(artifactDir, "repo-visible-artifact-check.json") },
    { label: "pr_update_summary", path: path.join(artifactDir, "pr-update-summary.json") },
    { label: "recovery_state_summary", path: path.join(artifactDir, "recovery-state-summary.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate69d-summary.json") },
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
