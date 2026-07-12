import { mkdir } from "node:fs/promises";
import path from "node:path";

import { sha256Stable, sha256Text } from "@engine/research/hash";

import {
  DEFAULT_GATE64C_DIR,
  EXPECTED_ROWS,
  GATE65_DATE,
  Gate64cCandidateRow,
  compactCandidate,
  gitCommit,
  loadGate64cRows,
  parseArgMap,
  rankCandidateRows,
  readJson,
  renderTable,
  toRepoRelative,
  writeJson,
  writeShaManifest,
  writeText,
} from "./gate65-utils";

const GATE_ID = "Gate 65B: decision-signature-pf-surface";
const COMMAND = "npm run engine:gate65b:decision-signature-pf-surface";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate65b/artifacts/gate65b-decision-signature-pf-surface";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate65b/GATE65B_DECISION_SIGNATURE_PF_SURFACE_${GATE65_DATE}.md`;

type Gate64cSummary = {
  ranking_views?: Record<string, Gate64cCandidateRow[]>;
  denominator?: Record<string, unknown>;
};

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate64cDir: args.get("--gate64c-dir") ?? DEFAULT_GATE64C_DIR,
  };
}

function metricsProfile(row: Gate64cCandidateRow) {
  return sha256Stable({
    adr_grid: row.adr_grid,
    weekly_hold: row.weekly_hold,
    annual_summary: row.annual_summary,
    selected_direction_counts: row.selected_direction_counts,
    degraded_row_count: row.degraded_row_count,
    negative_adr_grid_years: row.negative_adr_grid_years,
  });
}

function collapse(rows: Gate64cCandidateRow[]) {
  const bySignature = new Map<string, Gate64cCandidateRow[]>();
  for (const row of rows) bySignature.set(row.decision_signature_sha256, [...(bySignature.get(row.decision_signature_sha256) ?? []), row]);
  return [...bySignature.entries()]
    .map(([decision_signature_sha256, signatureRows]) => {
      const representative = [...signatureRows].sort(
        (left, right) =>
          left.degraded_row_count - right.degraded_row_count ||
          left.negative_adr_grid_years - right.negative_adr_grid_years ||
          (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999) ||
          left.candidate_id.localeCompare(right.candidate_id),
      )[0];
      return {
        decision_signature_sha256,
        canonical_candidate_id: representative.candidate_id,
        candidate_count: signatureRows.length,
        candidate_ids: signatureRows.map((row) => row.candidate_id).sort(),
        same_metrics_profile: new Set(signatureRows.map(metricsProfile)).size === 1,
        canonical_metrics: compactCandidate(representative),
        equivalent_candidates: signatureRows.filter((row) => row.candidate_id !== representative.candidate_id).map(compactCandidate),
      };
    })
    .sort((left, right) => right.candidate_count - left.candidate_count || left.canonical_candidate_id.localeCompare(right.canonical_candidate_id));
}

function bestAfterCollapse(rows: Gate64cCandidateRow[], collapsed: ReturnType<typeof collapse>) {
  const representatives = collapsed.flatMap((entry) => rows.find((row) => row.candidate_id === entry.canonical_candidate_id) ?? []);
  return rankCandidateRows(representatives);
}

function compare(row: Gate64cCandidateRow | undefined, reference: Gate64cCandidateRow | undefined) {
  if (!row || !reference) return null;
  return {
    candidate_id: row.candidate_id,
    reference_candidate_id: reference.candidate_id,
    adr_grid_pf_delta: row.adr_grid.row_pf !== null && reference.adr_grid.row_pf !== null ? Number((row.adr_grid.row_pf - reference.adr_grid.row_pf).toFixed(6)) : null,
    weekly_hold_pf_delta: row.weekly_hold.row_pf !== null && reference.weekly_hold.row_pf !== null ? Number((row.weekly_hold.row_pf - reference.weekly_hold.row_pf).toFixed(6)) : null,
    adr_grid_rdd_delta: row.adr_grid.r_over_drawdown !== null && reference.adr_grid.r_over_drawdown !== null ? Number((row.adr_grid.r_over_drawdown - reference.adr_grid.r_over_drawdown).toFixed(6)) : null,
    negative_year_delta: row.negative_adr_grid_years - reference.negative_adr_grid_years,
    degraded_row_delta: row.degraded_row_count - reference.degraded_row_count,
    same_signature: row.decision_signature_sha256 === reference.decision_signature_sha256,
  };
}

function renderReport(summary: Record<string, unknown>, pfRanking: Record<string, Gate64cCandidateRow[]>) {
  const compact = (rows: Gate64cCandidateRow[]) =>
    rows.slice(0, 8).map((row) => ({
      candidate_id: row.candidate_id,
      adr_pf: row.adr_grid.row_pf,
      wh_pf: row.weekly_hold.row_pf,
      adr_rdd: row.adr_grid.r_over_drawdown,
      degraded: row.degraded_row_count,
      negative_years: row.negative_adr_grid_years,
    }));
  return [
    "# Gate 65B Decision-Signature Collapse and PF Surface",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Diagnostic/evidence gate only.",
    "- Reads Gate 64C matrix rows and summaries.",
    "- Collapses decision-equivalent candidates before interpreting PF.",
    "- Does not create new candidate rules, optimize thresholds, or promote a candidate.",
    "",
    "## Signature Collapse",
    "",
    "```json",
    JSON.stringify(summary.signature_collapse, null, 2),
    "```",
    "",
    "## PF Rankings",
    "",
    "### ADR Grid PF",
    "",
    renderTable(compact(pfRanking.best_adr_grid_pf), ["candidate_id", "adr_pf", "wh_pf", "adr_rdd", "degraded", "negative_years"]),
    "",
    "### Weekly Hold PF",
    "",
    renderTable(compact(pfRanking.best_weekly_hold_pf), ["candidate_id", "adr_pf", "wh_pf", "adr_rdd", "degraded", "negative_years"]),
    "",
    "### Combined PF",
    "",
    renderTable(compact(pfRanking.best_combined_pf), ["candidate_id", "adr_pf", "wh_pf", "adr_rdd", "degraded", "negative_years"]),
    "",
    "## Findings",
    "",
    "```json",
    JSON.stringify(summary.findings, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Decision signature collapse: \`${summary.artifacts["collapseJson"]}\``,
    `- PF ranking surface: \`${summary.artifacts["pfRankingJson"]}\``,
    `- PF year stability diagnostics: \`${summary.artifacts["yearDiagnosticsJson"]}\``,
    `- PF comparison: \`${summary.artifacts["comparisonJson"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 65B stops after PF/signature diagnostics. It does not promote any Gate 64C or new candidate.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const rows = await loadGate64cRows(options.gate64cDir);
  const gate64cSummary = await readJson<Gate64cSummary>(path.join(options.gate64cDir, "gate64c-summary.json"));
  const collapsed = collapse(rows);
  const pfRanking = rankCandidateRows(rows) as Record<string, Gate64cCandidateRow[]>;
  const collapsedRanking = bestAfterCollapse(rows, collapsed) as Record<string, Gate64cCandidateRow[]>;
  const topRdd = rows.find((row) => row.candidate_id === "valuation_gap_relative_inverse_extreme_else_rrp_inverse");
  const gate63Rrp = rows.find((row) => row.candidate_id === "gate63_rrp_derived_inverse");
  const zeroNegative = rows.find((row) => row.candidate_id === "rrp_inverse_when_agrees_valuation_reer_else_alpha");
  const bestAdrPf = pfRanking.best_adr_grid_pf[0];
  const bestRobustPf = pfRanking.best_robust_pf[0];
  const bestCollapsedPf = collapsedRanking.best_adr_grid_pf[0];
  const duplicateSignatures = collapsed.filter((entry) => entry.candidate_count > 1);
  const meaningfulThreshold = 0.02;
  const findings = {
    candidate_count: rows.length,
    decision_signature_count: collapsed.length,
    duplicate_signature_count: duplicateSignatures.length,
    duplicate_candidate_count: duplicateSignatures.reduce((total, entry) => total + entry.candidate_count - 1, 0),
    highest_adr_grid_pf_candidate: compactCandidate(bestAdrPf),
    highest_robust_pf_candidate: compactCandidate(bestRobustPf),
    highest_pf_after_signature_collapse: compactCandidate(bestCollapsedPf),
    improves_pf_meaningfully_over_gate64c_top_rdd: (bestAdrPf.adr_grid.row_pf ?? 0) - (topRdd?.adr_grid.row_pf ?? 0) >= meaningfulThreshold,
    improves_pf_meaningfully_over_gate63_rrp_inverse: (bestAdrPf.adr_grid.row_pf ?? 0) - (gate63Rrp?.adr_grid.row_pf ?? 0) >= meaningfulThreshold,
    improves_pf_meaningfully_over_gate64c_zero_negative: (bestAdrPf.adr_grid.row_pf ?? 0) - (zeroNegative?.adr_grid.row_pf ?? 0) >= meaningfulThreshold,
    no_new_candidate_rules_created: true,
    no_threshold_optimization: true,
    no_candidate_promoted: true,
  };
  const comparison = {
    references: {
      gate64c_top_rdd: topRdd ? compactCandidate(topRdd) : null,
      gate63_rrp_inverse_reference: gate63Rrp ? compactCandidate(gate63Rrp) : null,
      gate64c_zero_negative_year_reference: zeroNegative ? compactCandidate(zeroNegative) : null,
    },
    best_adr_pf_vs_gate64c_top_rdd: compare(bestAdrPf, topRdd),
    best_adr_pf_vs_gate63_rrp_inverse: compare(bestAdrPf, gate63Rrp),
    best_adr_pf_vs_gate64c_zero_negative: compare(bestAdrPf, zeroNegative),
    best_robust_pf_vs_gate64c_top_rdd: compare(bestRobustPf, topRdd),
  };
  const yearDiagnostics = {
    diagnostic_only: true,
    selection_rule: "top PF and collapsed-PF representatives",
    rows: [...new Map([...pfRanking.best_adr_grid_pf.slice(0, 10), ...pfRanking.best_weekly_hold_pf.slice(0, 10), ...collapsedRanking.best_adr_grid_pf.slice(0, 10)].map((row) => [row.candidate_id, row])).values()].map((row) => ({
      candidate_id: row.candidate_id,
      adr_grid: row.adr_grid,
      weekly_hold: row.weekly_hold,
      negative_adr_grid_years: row.negative_adr_grid_years,
      worst_adr_grid_year: row.worst_adr_grid_year,
      annual_summary: row.annual_summary,
      annual_profile_hash: sha256Stable(row.annual_summary),
    })),
  };
  const pass = rows.length > 0 && rows.every((row) => row.forced28_row_count === EXPECTED_ROWS) && collapsed.length > 0 && pfRanking.best_adr_grid_pf.length > 0;
  const artifacts = {
    collapseJson: toRepoRelative(path.join(artifactDir, "decision-signature-collapse.json")),
    pfRankingJson: toRepoRelative(path.join(artifactDir, "pf-ranking-surface.json")),
    yearDiagnosticsJson: toRepoRelative(path.join(artifactDir, "pf-year-stability-diagnostics.json")),
    comparisonJson: toRepoRelative(path.join(artifactDir, "pf-comparison-vs-gate64c.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate65b-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate65b-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_DECISION_SIGNATURE_COLLAPSE_AND_PF_SURFACE__NO_PROMOTION" : "FAIL_DECISION_SIGNATURE_OR_PF_SURFACE_UNVERIFIED",
    gate64c_denominator: gate64cSummary.denominator,
    signature_collapse: {
      candidate_count: rows.length,
      decision_signature_count: collapsed.length,
      duplicate_signature_count: duplicateSignatures.length,
      duplicate_candidate_count: findings.duplicate_candidate_count,
      matrix_source_hash: sha256Text(JSON.stringify(rows.map((row) => row.content_hash ?? row.decision_signature_sha256))),
    },
    findings,
    validation: {
      every_candidate_mapped_to_signature: rows.every((row) => typeof row.decision_signature_sha256 === "string" && row.decision_signature_sha256.length > 0),
      pf_rankings_emitted: pfRanking.best_adr_grid_pf.length > 0 && pfRanking.best_weekly_hold_pf.length > 0,
      duplicate_candidates_identified: true,
      no_new_strategy_optimization: true,
      no_candidate_promoted: true,
    },
    artifacts,
  };

  await writeJson(path.join(artifactDir, "decision-signature-collapse.json"), {
    gate_id: GATE_ID,
    entries: collapsed,
  });
  await writeJson(path.join(artifactDir, "pf-ranking-surface.json"), {
    gate_id: GATE_ID,
    ranking_views: pfRanking,
    collapsed_ranking_views: collapsedRanking,
  });
  await writeJson(path.join(artifactDir, "pf-year-stability-diagnostics.json"), yearDiagnostics);
  await writeJson(path.join(artifactDir, "pf-comparison-vs-gate64c.json"), comparison);
  await writeJson(path.join(artifactDir, "gate65b-summary.json"), summary);
  await writeText(reportPath, renderReport(summary, pfRanking));
  await writeShaManifest(path.join(artifactDir, "gate65b-sha256.txt"), GATE_ID, COMMAND, [
    { label: "decision_signature_collapse", path: path.join(artifactDir, "decision-signature-collapse.json") },
    { label: "pf_ranking_surface", path: path.join(artifactDir, "pf-ranking-surface.json") },
    { label: "pf_year_stability_diagnostics", path: path.join(artifactDir, "pf-year-stability-diagnostics.json") },
    { label: "pf_comparison", path: path.join(artifactDir, "pf-comparison-vs-gate64c.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate65b-summary.json") },
    { label: "report", path: reportPath },
  ]);

  if (!pass) throw new Error(summary.verdict);
  console.log(summary.verdict);
  console.log(JSON.stringify({ artifacts, findings }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
