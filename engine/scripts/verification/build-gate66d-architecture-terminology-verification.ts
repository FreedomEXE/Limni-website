import { mkdir } from "node:fs/promises";
import path from "node:path";

import { BRAIN_ARCHITECTURE } from "@engine/brain/architecture";

import {
  GATE66_DATE,
  gitCommit,
  parseArgMap,
  readJson,
  renderTable,
  scanDeprecatedTerms,
  toRepoRelative,
  writeJson,
  writeShaManifest,
  writeText,
} from "./gate66-utils";

const GATE_ID = "Gate 66D: architecture-terminology-verification";
const COMMAND = "npm run engine:gate66d:architecture-terminology-verification";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate66d/artifacts/gate66d-architecture-terminology-verification";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate66d/GATE66D_ARCHITECTURE_TERMINOLOGY_VERIFICATION_${GATE66_DATE}.md`;
const DEFAULT_GATE66B_DIR = "docs/research/gates/gate66b/artifacts/gate66b-brain-architecture-contract-v3";
const DEFAULT_GATE66C_DIR = "docs/research/gates/gate66c/artifacts/gate66c-active-reference-migration";

type PackageJson = { scripts?: Record<string, string> };
type SummaryFile = { verdict?: string; architecture_version?: string; validation?: Record<string, unknown> };

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate66bDir: args.get("--gate66b-dir") ?? DEFAULT_GATE66B_DIR,
    gate66cDir: args.get("--gate66c-dir") ?? DEFAULT_GATE66C_DIR,
  };
}

function renderReport(summary: Record<string, unknown>) {
  const commandRows = (summary.package_commands as string[]).map((command) => ({ command }));
  return [
    "# Gate 66D Architecture Terminology Verification",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Active Architecture",
    "",
    "- Brain -> Cells -> Atoms.",
    "- Current cells: COT, Strength, Regime.",
    "- BPR remains inside Regime.",
    "- valuation_gap remains inside Regime.",
    "- Final forced-28 algorithm name: `null`.",
    "- Risk remains a later portfolio expression layer and cannot mutate Brain forced-28 decision truth.",
    "",
    "## Package Commands",
    "",
    renderTable(commandRows, ["command"]),
    "",
    "## Verification",
    "",
    "```json",
    JSON.stringify(summary.verification, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Final active search report: \`${summary.artifacts["finalActiveSearchReport"]}\``,
    `- Architecture v3 verification summary: \`${summary.artifacts["architectureVerificationSummary"]}\``,
    `- Remaining historical occurrence manifest: \`${summary.artifacts["remainingHistoricalOccurrenceManifest"]}\``,
    `- Next gate recommendation: \`${summary.artifacts["nextGateRecommendation"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Stop after Gate 66D. Do not proceed to final forced-28 algorithm design, naming the final algorithm, Alpha v2, risk, exits, execution, MT5/live, app/runtime, source mutation, retuning, broad source consolidation, optimized threshold search, learned weights, pair exclusions, or date exclusions unless Freedom explicitly opens that scope.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const packageJson = await readJson<PackageJson>("package.json");
  const gate66bSummary = await readJson<SummaryFile>(path.join(options.gate66bDir, "gate66b-summary.json"));
  const gate66cSummary = await readJson<SummaryFile>(path.join(options.gate66cDir, "gate66c-summary.json"));
  const scan = await scanDeprecatedTerms();
  const activeRemaining = scan.active_change_plan.filter((row) => row.category !== "migration_manifest_allowed");
  const requiredCommands = [
    "engine:gate66a:deprecated-architecture-term-inventory",
    "engine:gate66b:brain-architecture-contract-v3",
    "engine:gate66c:active-reference-migration",
    "engine:gate66d:architecture-terminology-verification",
  ];
  const packageCommandsPresent = requiredCommands.every((command) => Boolean(packageJson.scripts?.[command]));
  const architectureVerification = {
    architecture_version: BRAIN_ARCHITECTURE.architecture_version,
    hierarchy: BRAIN_ARCHITECTURE.hierarchy,
    deprecated_terms_removed_from_active_contracts: BRAIN_ARCHITECTURE.deprecated_terms_removed_from_active_contracts,
    deprecated_intermediate_layer_present: Object.prototype.hasOwnProperty.call(BRAIN_ARCHITECTURE, "body"),
    cells: BRAIN_ARCHITECTURE.cells.map((cell) => cell.cell_id).sort(),
    final_algorithm_name: BRAIN_ARCHITECTURE.final_algorithm_name,
    final_algorithm_status: BRAIN_ARCHITECTURE.final_algorithm_status,
    final_algorithm_started: BRAIN_ARCHITECTURE.forced28_decision_truth.final_algorithm_started,
    final_algorithm_named: BRAIN_ARCHITECTURE.forced28_decision_truth.final_algorithm_named,
    forced28_decision_required: BRAIN_ARCHITECTURE.forced28_decision_required,
    risk_may_reduce_expression_later: BRAIN_ARCHITECTURE.risk.risk_may_reduce_expression_later,
    risk_may_mutate_forced28_decision_truth: BRAIN_ARCHITECTURE.risk.risk_may_mutate_forced28_decision_truth,
  };
  const architecturePass =
    architectureVerification.architecture_version === "gate66_brain_cells_atoms_v3" &&
    architectureVerification.hierarchy === "Brain -> Cells -> Atoms" &&
    architectureVerification.deprecated_terms_removed_from_active_contracts === true &&
    architectureVerification.deprecated_intermediate_layer_present === false &&
    JSON.stringify(architectureVerification.cells) === JSON.stringify(["cot", "regime", "strength"]) &&
    architectureVerification.final_algorithm_name === null &&
    architectureVerification.final_algorithm_status === "reserved_for_future_gate" &&
    architectureVerification.final_algorithm_started === false &&
    architectureVerification.final_algorithm_named === false &&
    architectureVerification.forced28_decision_required === true &&
    architectureVerification.risk_may_reduce_expression_later === true &&
    architectureVerification.risk_may_mutate_forced28_decision_truth === false;
  const scopeVerification = {
    final_algorithm_design_started: false,
    alpha_v2_promotion_started: false,
    risk_started: false,
    exits_started: false,
    execution_started: false,
    mt5_live_started: false,
    app_runtime_started: false,
    source_mutation_started: false,
    cot_strength_regime_retuning_started: false,
    optimized_threshold_search_started: false,
    learned_weights_started: false,
    pair_or_date_exclusions_started: false,
  };
  const pass =
    gate66bSummary.verdict?.startsWith("PASS_") === true &&
    gate66cSummary.verdict?.startsWith("PASS_") === true &&
    activeRemaining.length === 0 &&
    packageCommandsPresent &&
    architecturePass &&
    Object.values(scopeVerification).every((value) => value === false);
  const artifacts = {
    finalActiveSearchReport: toRepoRelative(path.join(artifactDir, "final-active-search-report.json")),
    architectureVerificationSummary: toRepoRelative(path.join(artifactDir, "architecture-v3-verification-summary.json")),
    remainingHistoricalOccurrenceManifest: toRepoRelative(path.join(artifactDir, "remaining-historical-occurrence-manifest.json")),
    nextGateRecommendation: toRepoRelative(path.join(artifactDir, "next-gate-recommendation.md")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate66d-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate66d-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const nextGateRecommendation = [
    "# Gate 66D Next Gate Recommendation",
    "",
    "Recommended only if Freedom explicitly opens it:",
    "",
    "`Gate 67: Final forced-28 algorithm design preflight`",
    "",
    "Alternative neutral wording if Freedom wants to avoid implying design is approved:",
    "",
    "`Gate 67: Unnamed final algorithm design preflight`",
    "",
    "Do not name or design the final algorithm until that gate is explicitly opened.",
    "",
  ].join("\n");
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass
      ? "PASS_DEPRECATED_ARCHITECTURE_TERM_REMOVED_FROM_ACTIVE_SURFACE__BRAIN_CELLS_ATOMS_V3_LOCKED__FINAL_ALGORITHM_UNNAMED"
      : "FAIL_ARCHITECTURE_TERMINOLOGY_VERIFICATION_BLOCKED",
    architecture_version: BRAIN_ARCHITECTURE.architecture_version,
    package_commands: requiredCommands,
    verification: {
      gate66b_verdict: gate66bSummary.verdict,
      gate66c_verdict: gate66cSummary.verdict,
      active_remaining_count: activeRemaining.length,
      active_remaining_occurrences: activeRemaining,
      immutable_exception_count: scan.immutable_exception_count,
      migration_manifest_allowed_count: scan.classification_summary["migration_manifest_allowed"] ?? 0,
      package_commands_present: packageCommandsPresent,
      architecture_pass: architecturePass,
      architecture: architectureVerification,
      scope: scopeVerification,
      historical_artifacts_rewritten: false,
    },
    final_algorithm_name: BRAIN_ARCHITECTURE.final_algorithm_name,
    final_algorithm_status: BRAIN_ARCHITECTURE.final_algorithm_status,
    forced28_boundary_status: "forced28_decision_truth_required_and_preserved",
    risk_boundary_status: "risk_later_expression_only_cannot_mutate_forced28_truth",
    next_gate_recommendation: "Gate 67: Final forced-28 algorithm design preflight",
    artifacts,
  };

  await writeJson(path.join(artifactDir, "final-active-search-report.json"), {
    gate_id: GATE_ID,
    active_remaining_count: activeRemaining.length,
    active_remaining_occurrences: activeRemaining,
    immutable_exception_count: scan.immutable_exception_count,
    migration_manifest_allowed_count: scan.classification_summary["migration_manifest_allowed"] ?? 0,
    classification_summary: scan.classification_summary,
  });
  await writeJson(path.join(artifactDir, "architecture-v3-verification-summary.json"), {
    gate_id: GATE_ID,
    architecture_pass: architecturePass,
    architecture: architectureVerification,
  });
  await writeJson(path.join(artifactDir, "remaining-historical-occurrence-manifest.json"), {
    gate_id: GATE_ID,
    immutable_exception_count: scan.immutable_exception_count,
    remaining_historical_occurrences: scan.immutable_history_exceptions,
  });
  await writeText(path.join(artifactDir, "next-gate-recommendation.md"), nextGateRecommendation);
  await writeJson(path.join(artifactDir, "gate66d-summary.json"), summary);
  await writeText(reportPath, renderReport(summary));
  await writeShaManifest(path.join(artifactDir, "gate66d-sha256.txt"), GATE_ID, COMMAND, [
    { label: "final_active_search_report", path: path.join(artifactDir, "final-active-search-report.json") },
    { label: "architecture_v3_verification_summary", path: path.join(artifactDir, "architecture-v3-verification-summary.json") },
    { label: "remaining_historical_occurrence_manifest", path: path.join(artifactDir, "remaining-historical-occurrence-manifest.json") },
    { label: "next_gate_recommendation", path: path.join(artifactDir, "next-gate-recommendation.md") },
    { label: "summary_json", path: path.join(artifactDir, "gate66d-summary.json") },
    { label: "report", path: reportPath },
  ]);

  if (!pass) throw new Error(summary.verdict);
  console.log(summary.verdict);
  console.log(JSON.stringify({ artifacts, verification: summary.verification }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
