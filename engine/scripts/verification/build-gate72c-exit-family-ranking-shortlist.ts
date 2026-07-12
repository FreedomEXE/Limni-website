import { mkdir } from "node:fs/promises";
import path from "node:path";

import { gitCommit, parseArgMap, readJson, renderTable, toRepoRelative, writeJson, writeShaManifest, writeText } from "./gate65-utils";
import {
  DEFAULT_GATE72B_DIR,
  DEFAULT_GATE72C_DIR,
  GATE72_DATE,
  compactRankedRule,
  familyLabel,
  loadGate71ExitMatrixArtifacts,
  rankExitRules,
  summarizeRankedRules,
  type Gate72Summary,
  type RankedExitRule,
} from "./gate72-utils";

const GATE_ID = "Gate 72C: exit-family-ranking-shortlist";
const COMMAND = "npm run engine:gate72c:exit-family-ranking-shortlist";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate72c/GATE72C_EXIT_FAMILY_RANKING_SHORTLIST_${GATE72_DATE}.md`;

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE72C_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate72bDir: args.get("--gate72b-dir") ?? DEFAULT_GATE72B_DIR,
  };
}

function tableRows(rows: RankedExitRule[]) {
  return rows.map((row) => ({
    rule_id: row.rule_id,
    family: familyLabel(row.rule_family),
    win_rate: row.profitable_week_rate,
    total_adr: row.total_adr,
    adr_retention: row.adr_retention_vs_weekly_hold,
    max_dd: row.max_drawdown_adr,
    worst_week: row.worst_week_adr,
    neg_years: row.negative_years,
    class: row.review_classification,
    blockers: row.disqualification_reasons.join(", "),
  }));
}

function renderReport(summary: Record<string, unknown>, shortlist: RankedExitRule[]) {
  return [
    "# Gate 72C Exit Family Ranking / Shortlist",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Reviews the full Gate 71C result ledger after Gate 72A/72B integrity checks.",
    "- Ranks predeclared exit rules by profitable-week lift with explicit tail, total ADR, and year-stability constraints.",
    "- Produces a research shortlist only. No exit is promoted.",
    "",
    "## Objective",
    "",
    "`maximize profitable-week rate subject to no tail-risk degradation, no total-ADR collapse, and no year/regime concentration`",
    "",
    "Gate 72C evaluates year stability but does not evaluate regime concentration because no regime labels or filters are introduced in this gate.",
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Shortlist",
    "",
    renderTable(tableRows(shortlist), ["rule_id", "family", "win_rate", "total_adr", "adr_retention", "max_dd", "worst_week", "neg_years", "class", "blockers"]),
    "",
    "## Ranking Summary",
    "",
    "```json",
    JSON.stringify(summary.ranking_summary, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Ranking rows: \`${summary.artifacts["rankingRows"]}\``,
    `- Review shortlist: \`${summary.artifacts["reviewShortlist"]}\``,
    `- Ranking summary: \`${summary.artifacts["rankingSummary"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Strategic Read",
    "",
    "The high win-rate rules do what expected: they clip many weeks green. The problem is that clean exit rules still collapse total ADR versus weekly hold, and most worsen year stability. This packet is a shortlist for further review, not a promotion packet.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const gate72b = await readJson<Gate72Summary>(path.join(options.gate72bDir, "gate72b-summary.json"));
  const { candidateSummaries } = await loadGate71ExitMatrixArtifacts();
  const ranked = rankExitRules(candidateSummaries);
  const rankingSummary = summarizeRankedRules(ranked);
  const shortlist = ranked.filter((row) => row.review_classification === "review_shortlist");
  const promotionEligible = ranked.filter((row) => row.promotion_eligible);
  const cleanShortlist = shortlist.filter((row) => row.clean_exit_rule);
  const familyCoverage = Object.fromEntries(
    [...new Set(candidateSummaries.filter((row) => row.rule_family !== "control").map((row) => row.rule_family))]
      .sort()
      .map((family) => [family, cleanShortlist.some((row) => row.rule_family === family)]),
  );
  const noCleanRulePassesAllConstraints = ranked
    .filter((row) => row.clean_exit_rule)
    .every((row) => !(row.tail_risk_not_degraded && row.total_adr_not_collapsed && row.year_stability_not_degraded));
  const pass =
    gate72b.verdict.startsWith("PASS") &&
    candidateSummaries.length === 34 &&
    shortlist.length === 4 &&
    Object.values(familyCoverage).every(Boolean) &&
    promotionEligible.length === 0 &&
    noCleanRulePassesAllConstraints;
  const artifacts = {
    rankingRows: toRepoRelative(path.join(artifactDir, "exit-family-ranking.rows.json")),
    reviewShortlist: toRepoRelative(path.join(artifactDir, "exit-family-review-shortlist.json")),
    rankingSummary: toRepoRelative(path.join(artifactDir, "exit-family-ranking-summary.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate72c-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate72c-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_GATE72C_EXIT_FAMILY_RANKING_SHORTLIST__NO_CLEAN_PROMOTION_CANDIDATE" : "FAIL_GATE72C_EXIT_FAMILY_RANKING_SHORTLIST",
    validation: {
      gate72b_passed: gate72b.verdict.startsWith("PASS"),
      candidate_summary_count: candidateSummaries.length,
      review_shortlist_count: shortlist.length,
      family_coverage: familyCoverage,
      promotion_eligible_count: promotionEligible.length,
      no_clean_rule_passes_all_constraints: noCleanRulePassesAllConstraints,
      total_adr_collapse_threshold: "clean exit total ADR must be at least 50 percent of weekly-hold total ADR for promotion consideration",
      year_stability_threshold: "negative year count must be no worse than weekly hold for promotion consideration",
      regime_concentration_evaluated: false,
      exit_promotion_performed: false,
      risk_layer_started: false,
    },
    ranking_summary: rankingSummary,
    artifacts,
  };

  await writeJson(path.join(artifactDir, "exit-family-ranking.rows.json"), ranked);
  await writeJson(path.join(artifactDir, "exit-family-review-shortlist.json"), shortlist.map(compactRankedRule));
  await writeJson(path.join(artifactDir, "exit-family-ranking-summary.json"), rankingSummary);
  await writeJson(path.join(artifactDir, "gate72c-summary.json"), summary);
  await writeText(reportPath, renderReport(summary, shortlist));
  await writeShaManifest(path.join(artifactDir, "gate72c-sha256.txt"), GATE_ID, COMMAND, [
    { label: "ranking_rows", path: path.join(artifactDir, "exit-family-ranking.rows.json") },
    { label: "review_shortlist", path: path.join(artifactDir, "exit-family-review-shortlist.json") },
    { label: "ranking_summary", path: path.join(artifactDir, "exit-family-ranking-summary.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate72c-summary.json") },
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
