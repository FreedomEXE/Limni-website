import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  GATE66_DATE,
  gitCommit,
  parseArgMap,
  renderTable,
  scanDeprecatedTerms,
  toRepoRelative,
  writeJson,
  writeJsonl,
  writeShaManifest,
  writeText,
} from "./gate66-utils";

const GATE_ID = "Gate 66A: deprecated-architecture-term-inventory";
const COMMAND = "npm run engine:gate66a:deprecated-architecture-term-inventory";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate66a/artifacts/gate66a-deprecated-architecture-term-inventory";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate66a/GATE66A_DEPRECATED_ARCHITECTURE_TERM_INVENTORY_${GATE66_DATE}.md`;

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
  };
}

function renderReport(summary: Record<string, unknown>, activePlan: Array<Record<string, unknown>>, immutableExceptions: Array<Record<string, unknown>>) {
  return [
    "# Gate 66A Deprecated Architecture Term Inventory",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Inventory and classification only.",
    "- No active architecture migration is performed by Gate 66A.",
    "- Historical Gate 60-65 receipts and hash-bound artifacts are preserved.",
    "",
    "## Classification Summary",
    "",
    "```json",
    JSON.stringify(summary.classification_summary, null, 2),
    "```",
    "",
    "## Active Change Plan",
    "",
    renderTable(
      activePlan.slice(0, 60).map((row) => ({
        path: row.path,
        line: row.line,
        token: row.token,
        category: row.category,
        excerpt: row.excerpt,
      })),
      ["path", "line", "token", "category", "excerpt"],
    ),
    "",
    activePlan.length > 60 ? `Additional active-change rows: \`${activePlan.length - 60}\`.` : "",
    "",
    "## Immutable Historical Exceptions",
    "",
    `Immutable exception rows: \`${immutableExceptions.length}\`. These are listed in the artifact exception list and are not rewritten.`,
    "",
    "## Artifacts",
    "",
    `- Occurrence ledger: \`${summary.artifacts["occurrenceLedger"]}\``,
    `- Classification summary: \`${summary.artifacts["classificationSummary"]}\``,
    `- Active change plan: \`${summary.artifacts["activeChangePlan"]}\``,
    `- Immutable history exception list: \`${summary.artifacts["immutableHistoryExceptionList"]}\``,
    `- Gate summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 66A stops before active architecture edits. Gate 66B may proceed only if this inventory separates active changes from immutable historical exceptions.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const scan = await scanDeprecatedTerms();
  const pass = scan.occurrence_count >= 0 && scan.active_change_plan.every((row) => !row.immutable_exception);
  const artifacts = {
    occurrenceLedger: toRepoRelative(path.join(artifactDir, "deprecated-term-occurrence-ledger.rows.jsonl")),
    classificationSummary: toRepoRelative(path.join(artifactDir, "deprecated-term-classification-summary.json")),
    activeChangePlan: toRepoRelative(path.join(artifactDir, "active-change-plan.json")),
    immutableHistoryExceptionList: toRepoRelative(path.join(artifactDir, "immutable-history-exception-list.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate66a-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate66a-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: scan.generated_at,
    git_commit: gitCommit(),
    verdict: pass
      ? "PASS_DEPRECATED_ARCHITECTURE_TERM_INVENTORY__ACTIVE_CHANGES_SEPARATED_FROM_IMMUTABLE_HISTORY"
      : "FAIL_DEPRECATED_ARCHITECTURE_TERM_INVENTORY_CLASSIFICATION_BLOCKED",
    scanned_file_count: scan.scanned_file_count,
    occurrence_count: scan.occurrence_count,
    architecture_context_occurrence_count: scan.architecture_context_occurrence_count,
    active_change_count: scan.active_change_count,
    immutable_exception_count: scan.immutable_exception_count,
    classification_summary: scan.classification_summary,
    paths_with_deprecated_term: scan.paths_with_deprecated_term,
    json_keys_with_deprecated_term: scan.json_keys_with_deprecated_term,
    verdict_strings_with_deprecated_term: scan.verdict_strings_with_deprecated_term,
    historical_artifacts_rewritten: false,
    artifacts,
  };

  await writeJsonl(path.join(artifactDir, "deprecated-term-occurrence-ledger.rows.jsonl"), scan.occurrences);
  await writeJson(path.join(artifactDir, "deprecated-term-classification-summary.json"), {
    gate_id: GATE_ID,
    classification_summary: scan.classification_summary,
    occurrence_count: scan.occurrence_count,
    architecture_context_occurrence_count: scan.architecture_context_occurrence_count,
    active_change_count: scan.active_change_count,
    immutable_exception_count: scan.immutable_exception_count,
    paths_with_deprecated_term: scan.paths_with_deprecated_term,
    json_keys_with_deprecated_term: scan.json_keys_with_deprecated_term,
    verdict_strings_with_deprecated_term: scan.verdict_strings_with_deprecated_term,
  });
  await writeJson(path.join(artifactDir, "active-change-plan.json"), {
    gate_id: GATE_ID,
    active_change_count: scan.active_change_count,
    active_change_plan: scan.active_change_plan,
    external_current_review_packet: {
      pr: "https://github.com/FreedomEXE/Limni-website/pull/2",
      action_required: "Update PR body/title during Gate 66C after active migration and Gate 66D verification.",
    },
  });
  await writeJson(path.join(artifactDir, "immutable-history-exception-list.json"), {
    gate_id: GATE_ID,
    immutable_exception_count: scan.immutable_exception_count,
    immutable_history_exceptions: scan.immutable_history_exceptions,
  });
  await writeJson(path.join(artifactDir, "gate66a-summary.json"), summary);
  await writeText(reportPath, renderReport(summary, scan.active_change_plan, scan.immutable_history_exceptions));
  await writeShaManifest(path.join(artifactDir, "gate66a-sha256.txt"), GATE_ID, COMMAND, [
    { label: "occurrence_ledger", path: path.join(artifactDir, "deprecated-term-occurrence-ledger.rows.jsonl") },
    { label: "classification_summary", path: path.join(artifactDir, "deprecated-term-classification-summary.json") },
    { label: "active_change_plan", path: path.join(artifactDir, "active-change-plan.json") },
    { label: "immutable_history_exception_list", path: path.join(artifactDir, "immutable-history-exception-list.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate66a-summary.json") },
    { label: "report", path: reportPath },
  ]);

  if (!pass) throw new Error(summary.verdict);
  console.log(summary.verdict);
  console.log(JSON.stringify({ artifacts, active_change_count: scan.active_change_count, immutable_exception_count: scan.immutable_exception_count }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
