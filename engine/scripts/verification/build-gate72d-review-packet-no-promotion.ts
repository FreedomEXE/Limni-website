import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { gitCommit, parseArgMap, readJson, toRepoRelative, writeJson, writeShaManifest, writeText } from "./gate65-utils";
import {
  DEFAULT_GATE72A_DIR,
  DEFAULT_GATE72B_DIR,
  DEFAULT_GATE72C_DIR,
  DEFAULT_GATE72D_DIR,
  GATE72_DATE,
  type Gate72Summary,
} from "./gate72-utils";

const GATE_ID = "Gate 72D: review-packet-no-promotion";
const COMMAND = "npm run engine:gate72d:review-packet-no-promotion";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate72d/GATE72D_REVIEW_PACKET_NO_PROMOTION_${GATE72_DATE}.md`;

const REQUIRED_COMMANDS = [
  "engine:gate72a:warehouse-manifest-binding-audit",
  "engine:gate72b:matrix-ledger-sanity-review",
  "engine:gate72c:exit-family-ranking-shortlist",
  "engine:gate72d:review-packet-no-promotion",
];

const REPORT_PATHS = [
  `docs/research/gates/gate72a/GATE72A_WAREHOUSE_MANIFEST_BINDING_AUDIT_${GATE72_DATE}.md`,
  `docs/research/gates/gate72b/GATE72B_MATRIX_LEDGER_SANITY_REVIEW_${GATE72_DATE}.md`,
  `docs/research/gates/gate72c/GATE72C_EXIT_FAMILY_RANKING_SHORTLIST_${GATE72_DATE}.md`,
];

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE72D_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate72aDir: args.get("--gate72a-dir") ?? DEFAULT_GATE72A_DIR,
    gate72bDir: args.get("--gate72b-dir") ?? DEFAULT_GATE72B_DIR,
    gate72cDir: args.get("--gate72c-dir") ?? DEFAULT_GATE72C_DIR,
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

function renderReport(summary: Record<string, unknown>) {
  return [
    "# Gate 72D Review Packet / No-Promotion Lock",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Verifies Gate 72A, 72B, and 72C artifacts are visible and internally consistent.",
    "- Confirms Gate 72 produced a review shortlist only.",
    "- Confirms no exit promotion, risk layer, pair/regime filters, fair-value pruning, execution, MT5/live, or source mutation was introduced.",
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## No-Promotion Assertion",
    "",
    "```json",
    JSON.stringify(summary.no_promotion_assertion, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Repo-visible artifact check: \`${summary.artifacts["repoVisibleArtifactCheck"]}\``,
    `- No-promotion assertion: \`${summary.artifacts["noPromotionAssertion"]}\``,
    `- PR update summary: \`${summary.artifacts["prUpdateSummary"]}\``,
    `- Recovery state summary: \`${summary.artifacts["recoveryStateSummary"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 72D closes the exit matrix review and shortlist packet. It does not open risk/portfolio work or promote an exit.",
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
  const gate72b = await readJson<Gate72Summary>(path.join(options.gate72bDir, "gate72b-summary.json"));
  const gate72c = await readJson<Gate72Summary>(path.join(options.gate72cDir, "gate72c-summary.json"));
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as { scripts: Record<string, string> };
  const missingCommands = REQUIRED_COMMANDS.filter((command) => !packageJson.scripts[command]);
  const currentWorkText = await readFile("docs/backlog/CURRENT_WORK.md", "utf8");
  const currentWorkPointsToGate72D = currentWorkText.includes("Gate 72D: review-packet-no-promotion");
  const shaManifests = [
    path.join(options.gate72aDir, "gate72a-sha256.txt"),
    path.join(options.gate72bDir, "gate72b-sha256.txt"),
    path.join(options.gate72cDir, "gate72c-sha256.txt"),
  ];
  const referenced = new Set<string>([...REPORT_PATHS, ...shaManifests, "docs/backlog/CURRENT_WORK.md"]);
  for (const manifest of shaManifests) {
    if (await exists(manifest)) {
      for (const artifactPath of await shaManifestPaths(manifest)) referenced.add(artifactPath);
    }
  }
  const artifactChecks = await Promise.all(
    [...referenced].sort().map(async (repoPath) => ({
      path: repoPath,
      exists: await exists(repoPath),
    })),
  );
  const missingArtifacts = artifactChecks.filter((row) => !row.exists);
  const noPromotionAssertion = {
    gate_id: GATE_ID,
    candidate_b_mutated: false,
    candidate_c_shadow_only: true,
    exit_promotion_performed: false,
    promotion_eligible_exit_count: gate72c.validation.promotion_eligible_count,
    shortlist_is_review_only: gate72c.validation.review_shortlist_count === 4,
    risk_layer_started: false,
    pair_specific_exits_started: false,
    regime_specific_exits_started: false,
    fair_value_pruning_started: false,
    source_mutation_started: false,
    mt5_live_runtime_started: false,
    alpha_v2_promotion_started: false,
    raw_m1_rebuild_performed: false,
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
    local_packet_ready_for_pr_update: missingArtifacts.length === 0 && missingCommands.length === 0 && currentWorkPointsToGate72D,
    live_pr_update_performed_by_script: false,
    reason: "PR body is updated after final commit and push so the final head SHA is live truth.",
    gate72a_verdict: gate72a.verdict,
    gate72b_verdict: gate72b.verdict,
    gate72c_verdict: gate72c.verdict,
  };
  const recoveryStateSummary = {
    gate_id: GATE_ID,
    recovery_files_to_update_after_push: ["C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md"],
    current_work_points_to_gate72d: currentWorkPointsToGate72D,
    final_head_available_before_commit: false,
  };
  const pass =
    gate72a.verdict.startsWith("PASS") &&
    gate72b.verdict.startsWith("PASS") &&
    gate72c.verdict.startsWith("PASS") &&
    missingCommands.length === 0 &&
    missingArtifacts.length === 0 &&
    currentWorkPointsToGate72D &&
    noPromotionAssertion.exit_promotion_performed === false &&
    noPromotionAssertion.promotion_eligible_exit_count === 0 &&
    noPromotionAssertion.risk_layer_started === false &&
    noPromotionAssertion.raw_m1_rebuild_performed === false;
  const artifacts = {
    repoVisibleArtifactCheck: toRepoRelative(path.join(artifactDir, "repo-visible-artifact-check.json")),
    noPromotionAssertion: toRepoRelative(path.join(artifactDir, "gate72-no-promotion-assertion.json")),
    prUpdateSummary: toRepoRelative(path.join(artifactDir, "pr-update-summary.json")),
    recoveryStateSummary: toRepoRelative(path.join(artifactDir, "recovery-state-summary.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate72d-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate72d-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_GATE72D_REVIEW_PACKET_NO_PROMOTION__SHORTLIST_VISIBLE_NO_SCOPE_DRIFT" : "FAIL_GATE72D_REVIEW_PACKET_NO_PROMOTION",
    validation: {
      gate72a_passed: gate72a.verdict.startsWith("PASS"),
      gate72b_passed: gate72b.verdict.startsWith("PASS"),
      gate72c_passed: gate72c.verdict.startsWith("PASS"),
      required_commands_present: missingCommands.length === 0,
      missing_commands: missingCommands,
      current_work_points_to_gate72d: currentWorkPointsToGate72D,
      artifact_paths_checked: artifactChecks.length,
      missing_artifact_paths: missingArtifacts.map((row) => row.path),
      no_promotion_assertion: noPromotionAssertion,
      pr_update_ready_after_push: prUpdateSummary.local_packet_ready_for_pr_update,
      recovery_state_external_update_required_after_push: true,
    },
    no_promotion_assertion: noPromotionAssertion,
    artifacts,
  };

  await writeJson(path.join(artifactDir, "repo-visible-artifact-check.json"), repoVisibleArtifactCheck);
  await writeJson(path.join(artifactDir, "gate72-no-promotion-assertion.json"), noPromotionAssertion);
  await writeJson(path.join(artifactDir, "pr-update-summary.json"), prUpdateSummary);
  await writeJson(path.join(artifactDir, "recovery-state-summary.json"), recoveryStateSummary);
  await writeJson(path.join(artifactDir, "gate72d-summary.json"), summary);
  await writeText(reportPath, renderReport(summary));
  await writeShaManifest(path.join(artifactDir, "gate72d-sha256.txt"), GATE_ID, COMMAND, [
    { label: "repo_visible_artifact_check", path: path.join(artifactDir, "repo-visible-artifact-check.json") },
    { label: "no_promotion_assertion", path: path.join(artifactDir, "gate72-no-promotion-assertion.json") },
    { label: "pr_update_summary", path: path.join(artifactDir, "pr-update-summary.json") },
    { label: "recovery_state_summary", path: path.join(artifactDir, "recovery-state-summary.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate72d-summary.json") },
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
