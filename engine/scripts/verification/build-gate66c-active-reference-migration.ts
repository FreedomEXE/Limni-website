import { mkdir } from "node:fs/promises";
import path from "node:path";

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

const GATE_ID = "Gate 66C: active-reference-migration";
const COMMAND = "npm run engine:gate66c:active-reference-migration";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate66c/artifacts/gate66c-active-reference-migration";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate66c/GATE66C_ACTIVE_REFERENCE_MIGRATION_NO_DEPRECATED_LAYER_${GATE66_DATE}.md`;
const DEFAULT_GATE66A_DIR = "docs/research/gates/gate66a/artifacts/gate66a-deprecated-architecture-term-inventory";
const DEFAULT_GATE66B_DIR = "docs/research/gates/gate66b/artifacts/gate66b-brain-architecture-contract-v3";

type Gate66aActivePlan = {
  active_change_count: number;
  active_change_plan: Array<{ path: string; line: number | null; token: string; excerpt: string }>;
};

type Gate66bSummary = {
  verdict: string;
  architecture_version: string;
  validation: Record<string, unknown>;
};

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate66aDir: args.get("--gate66a-dir") ?? DEFAULT_GATE66A_DIR,
    gate66bDir: args.get("--gate66b-dir") ?? DEFAULT_GATE66B_DIR,
  };
}

function renderSupersessionManifest(immutableExceptionCount: number) {
  return [
    "# Deprecated Architecture Term Supersession Manifest",
    "",
    "Gate 66 removes the deprecated architecture term from active Limni/Poseidon architecture language.",
    "",
    "## Replacement",
    "",
    "- Brain = full intelligence system.",
    "- Cells = evidence organs inside Brain.",
    "- Atoms = point-in-time source/derived evidence inside each cell.",
    "- Current cells are COT, Strength, and Regime.",
    "- BPR remains inside Regime.",
    "- valuation_gap remains inside Regime.",
    "- The final forced-28 decision algorithm is unnamed and reserved for a future gate.",
    "- Risk remains a later portfolio expression/permission layer and cannot mutate Brain forced-28 decision truth.",
    "",
    "## Historical Receipts",
    "",
    `Historical immutable exceptions listed: \`${immutableExceptionCount}\`.`,
    "",
    "Old Gate 60-65 reports, hash manifests, generated row ledgers, and receipts may still contain the deprecated term because they are historical evidence. They were not rewritten so their content hashes and audit trail remain intact.",
    "",
    "## Forward Rule",
    "",
    "Future active architecture, current recovery state, PR language, package surfaces, and new gate verdicts use neutral final forced-28 algorithm language. Do not invent a branded final algorithm name before Freedom explicitly opens that scope.",
    "",
  ].join("\n");
}

function renderReport(summary: Record<string, unknown>, migrationLedger: Array<Record<string, unknown>>) {
  return [
    "# Gate 66C Active Reference Migration",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Migrates active code/docs/recovery language only.",
    "- Preserves Gate 60-65 historical reports and generated artifacts.",
    "- Adds a supersession manifest for remaining historical references.",
    "- Does not start final forced-28 algorithm design, Alpha v2, risk, execution, app/runtime, source mutation, retuning, or optimization.",
    "",
    "## Migration Ledger",
    "",
    renderTable(migrationLedger, ["path", "change"]),
    "",
    "## Post-Migration Search",
    "",
    "```json",
    JSON.stringify(summary.post_migration_active_search, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Active reference migration ledger: \`${summary.artifacts["migrationLedger"]}\``,
    `- Verdict language migration map: \`${summary.artifacts["verdictMigrationMap"]}\``,
    `- Supersession manifest: \`${summary.artifacts["supersessionManifest"]}\``,
    `- Post-migration active search: \`${summary.artifacts["postMigrationSearchReport"]}\``,
    `- Immutable history exception list: \`${summary.artifacts["immutableHistoryExceptionList"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 66C stops after active reference migration. Gate 66D must verify the final active surface before any next-gate decision.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const gate66aPlan = await readJson<Gate66aActivePlan>(path.join(options.gate66aDir, "active-change-plan.json"));
  const gate66bSummary = await readJson<Gate66bSummary>(path.join(options.gate66bDir, "gate66b-summary.json"));
  const scan = await scanDeprecatedTerms();
  const activeRemaining = scan.active_change_plan.filter((row) => row.category !== "migration_manifest_allowed");
  const pass =
    gate66bSummary.verdict.startsWith("PASS_") &&
    activeRemaining.length === 0 &&
    gate66bSummary.validation["contract_has_deprecated_intermediate_layer"] === false &&
    gate66bSummary.validation["deprecated_namespace_exists"] === false;

  const migrationLedger = [
    { path: "engine/src/brain/architecture.ts", change: "Active contract now exposes Brain -> Cells -> Atoms v3; final algorithm remains unnamed." },
    { path: "engine/src/brain/README.md", change: "Active architecture prose migrated to final forced-28 algorithm and Risk expression boundary." },
    { path: "engine/src/brain/body/*", change: "Deprecated active placeholder namespace removed; no active imports remained." },
    { path: "engine/scripts/verification/gate65-utils.ts", change: "Active policy helper key migrated to allowed_final_algorithm_use with compatibility reader for old artifacts." },
    { path: "engine/scripts/verification/build-gate65*.ts", change: "Active Gate 65 builder language migrated to neutral final forced-28 algorithm wording." },
    { path: "docs/backlog/CURRENT_WORK.md", change: "Current active checklist migrated to Gate 66 terminology." },
    { path: "C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md", change: "Hot recovery state migrated to Gate 66 terminology." },
    { path: "PR #2 body/title", change: "Marked for update after Gate 66D final verification." },
  ];
  const verdictMigrationMap = {
    READY_FOR_BODY_DESIGN_REVIEW: "READY_FOR_FINAL_FORCED28_ALGORITHM_DESIGN_REVIEW",
    NO_BODY: "NO_FINAL_ALGORITHM",
    body_algorithm_started: "final_algorithm_started",
    body_direction_emitted: "final_algorithm_direction_emitted",
    allowed_body_use: "allowed_final_algorithm_use",
    "Body design": "final forced-28 algorithm design",
  };
  const immutableFinal = {
    gate_id: GATE_ID,
    immutable_exception_count: scan.immutable_exception_count,
    remaining_historical_occurrences: scan.immutable_history_exceptions,
  };
  const artifacts = {
    migrationLedger: toRepoRelative(path.join(artifactDir, "active-reference-migration-ledger.json")),
    verdictMigrationMap: toRepoRelative(path.join(artifactDir, "verdict-language-migration-map.json")),
    supersessionManifest: toRepoRelative(path.join(artifactDir, "deprecated-term-supersession-manifest.md")),
    postMigrationSearchReport: toRepoRelative(path.join(artifactDir, "post-migration-active-search-report.json")),
    immutableHistoryExceptionList: toRepoRelative(path.join(artifactDir, "immutable-history-exception-list.final.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate66c-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate66c-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass
      ? "PASS_ACTIVE_REFERENCE_MIGRATION__NO_DEPRECATED_ACTIVE_LAYER__HISTORY_SUPERSEDED_NOT_REWRITTEN"
      : "FAIL_ACTIVE_REFERENCE_MIGRATION_DEPRECATED_ACTIVE_REFERENCES_REMAIN",
    gate66a_active_change_count_before_migration: gate66aPlan.active_change_count,
    architecture_version: gate66bSummary.architecture_version,
    post_migration_active_search: {
      scanned_file_count: scan.scanned_file_count,
      occurrence_count: scan.occurrence_count,
      architecture_context_occurrence_count: scan.architecture_context_occurrence_count,
      active_remaining_count: activeRemaining.length,
      active_remaining_occurrences: activeRemaining,
      immutable_exception_count: scan.immutable_exception_count,
      migration_manifest_allowed_count: scan.classification_summary["migration_manifest_allowed"] ?? 0,
    },
    historical_artifacts_rewritten: false,
    final_algorithm_name: null,
    final_algorithm_status: "reserved_for_future_gate",
    artifacts,
  };

  await writeJson(path.join(artifactDir, "active-reference-migration-ledger.json"), {
    gate_id: GATE_ID,
    changes: migrationLedger,
  });
  await writeJson(path.join(artifactDir, "verdict-language-migration-map.json"), verdictMigrationMap);
  await writeText(path.join(artifactDir, "deprecated-term-supersession-manifest.md"), renderSupersessionManifest(scan.immutable_exception_count));
  await writeJson(path.join(artifactDir, "post-migration-active-search-report.json"), summary.post_migration_active_search);
  await writeJson(path.join(artifactDir, "immutable-history-exception-list.final.json"), immutableFinal);
  await writeJson(path.join(artifactDir, "gate66c-summary.json"), summary);
  await writeText(reportPath, renderReport(summary, migrationLedger));
  await writeShaManifest(path.join(artifactDir, "gate66c-sha256.txt"), GATE_ID, COMMAND, [
    { label: "migration_ledger", path: path.join(artifactDir, "active-reference-migration-ledger.json") },
    { label: "verdict_migration_map", path: path.join(artifactDir, "verdict-language-migration-map.json") },
    { label: "supersession_manifest", path: path.join(artifactDir, "deprecated-term-supersession-manifest.md") },
    { label: "post_migration_search_report", path: path.join(artifactDir, "post-migration-active-search-report.json") },
    { label: "immutable_history_exception_list", path: path.join(artifactDir, "immutable-history-exception-list.final.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate66c-summary.json") },
    { label: "report", path: reportPath },
  ]);

  if (!pass) throw new Error(summary.verdict);
  console.log(summary.verdict);
  console.log(JSON.stringify({ artifacts, post_migration_active_search: summary.post_migration_active_search }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
