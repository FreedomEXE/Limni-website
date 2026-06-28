import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_GATE65A_DIR,
  DEFAULT_GATE65B_DIR,
  DEFAULT_GATE65C_DIR,
  DEFAULT_GATE65D_DIR,
  DEFAULT_GATE65E_DIR,
  GATE65_DATE,
  CandidateSummary,
  compactCandidate,
  fileHash,
  gitCommit,
  parseArgMap,
  rankCandidateRows,
  readJson,
  readJsonl,
  renderTable,
  toRepoRelative,
  writeJson,
  writeShaManifest,
  writeText,
} from "./gate65-utils";

const GATE_ID = "Gate 65F: brain-architecture-readiness-review";
const COMMAND = "npm run engine:gate65f:brain-architecture-readiness-review";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate65f/artifacts/gate65f-brain-architecture-readiness-review";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate65f/GATE65F_BRAIN_ARCHITECTURE_READINESS_REVIEW_${GATE65_DATE}.md`;

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate65aDir: args.get("--gate65a-dir") ?? DEFAULT_GATE65A_DIR,
    gate65bDir: args.get("--gate65b-dir") ?? DEFAULT_GATE65B_DIR,
    gate65cDir: args.get("--gate65c-dir") ?? DEFAULT_GATE65C_DIR,
    gate65dDir: args.get("--gate65d-dir") ?? DEFAULT_GATE65D_DIR,
    gate65eDir: args.get("--gate65e-dir") ?? DEFAULT_GATE65E_DIR,
  };
}

function verdictPassed(summary: Record<string, unknown>) {
  return String(summary["verdict"] ?? "").startsWith("PASS_");
}

function renderReport(summary: Record<string, unknown>, routerRows: CandidateSummary[]) {
  const bestRows = [
    ["Highest PF", summary.findings["highest_pf_candidate"]],
    ["Highest Robust PF", summary.findings["highest_robust_pf_candidate"]],
    ["Best Zero-Negative-Year", summary.findings["best_zero_negative_year_candidate"]],
    ["Best Balanced", summary.findings["best_balanced_candidate"]],
  ].map(([label, value]) => ({ label, candidate: (value as { candidate_id?: string } | null)?.candidate_id ?? "none", detail: JSON.stringify(value) }));
  return [
    "# Gate 65F Brain Architecture Readiness Review",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Readiness Verdict",
    "",
    `\`${summary.readiness_verdict}\``,
    "",
    "## Scope",
    "",
    "- Consolidates Gate 65A through Gate 65E.",
    "- Does not start Body design.",
    "- Does not promote Alpha v2.",
    "- Does not open risk, execution, MT5/live, app/runtime, source mutation, retuning, or optimization.",
    "",
    "## Gate Verdicts",
    "",
    "```json",
    JSON.stringify(summary.gate_verdicts, null, 2),
    "```",
    "",
    "## Candidate Findings",
    "",
    renderTable(bestRows, ["label", "candidate", "detail"]),
    "",
    "## Blockers Before Body",
    "",
    "```json",
    JSON.stringify(summary.blockers_before_body, null, 2),
    "```",
    "",
    "## Interpretation",
    "",
    "- `READY_FOR_BODY_DESIGN_REVIEW` means the evidence packet is ready for Freedom to decide whether to open a later Body design gate.",
    "- It is not a Body design, not Alpha v2, and not a router promotion.",
    `- Router rows reviewed: \`${routerRows.length}\`.`,
    "",
    "## Required Next Human Decision",
    "",
    "```json",
    JSON.stringify(summary.required_next_human_decision, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Readiness summary: \`${summary.artifacts["readinessSummary"]}\``,
    `- Blockers: \`${summary.artifacts["blockersJson"]}\``,
    `- Recommended next gate: \`${summary.artifacts["recommendedNextGate"]}\``,
    `- Cross-gate hash manifest: \`${summary.artifacts["crossGateHashManifest"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Stop after Gate 65F. Do not proceed to final Body design, Alpha v2 promotion, risk, exits, execution, MT5/live, app/runtime work, source mutation, COT/Strength retuning, broad Brain source consolidation, optimized threshold search, learned weights, pair exclusions, or date exclusions.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const gate65a = await readJson<Record<string, unknown>>(path.join(options.gate65aDir, "gate65a-summary.json"));
  const gate65b = await readJson<Record<string, unknown>>(path.join(options.gate65bDir, "gate65b-summary.json"));
  const gate65c = await readJson<Record<string, unknown>>(path.join(options.gate65cDir, "gate65c-summary.json"));
  const gate65d = await readJson<Record<string, unknown>>(path.join(options.gate65dDir, "gate65d-summary.json"));
  const gate65e = await readJson<Record<string, unknown>>(path.join(options.gate65eDir, "brain-router-summary.json"));
  const routerRows = await readJsonl<CandidateSummary>(path.join(options.gate65eDir, "brain-router-matrix.rows.jsonl"));
  const rankings = rankCandidateRows(routerRows);
  const balanced = [...routerRows].sort(
    (left, right) =>
      ((right.adr_grid.r_over_drawdown ?? 0) + (right.weekly_hold.r_over_drawdown ?? 0)) -
      ((left.adr_grid.r_over_drawdown ?? 0) + (left.weekly_hold.r_over_drawdown ?? 0)),
  )[0];
  const highestPf = rankings.best_adr_grid_pf[0] ?? null;
  const highestRobustPf = rankings.best_robust_pf[0] ?? null;
  const zeroNegative = rankings.best_zero_negative_years[0] ?? null;
  const lowDegradation = rankings.best_low_degradation[0] ?? null;
  const gatePasses = [gate65a, gate65b, gate65c, gate65d, gate65e].every(verdictPassed);
  const valuationVisible = Boolean((gate65a["validation"] as { emitted_valuation_gap_formulas_visible?: boolean } | undefined)?.emitted_valuation_gap_formulas_visible);
  const scenarioCounts = gate65d["group_counts"] as Record<string, number> | undefined;
  const routerFindings = gate65e["findings"] as Record<string, unknown> | undefined;
  const newRouterSignatures = Number(routerFindings?.["genuinely_new_router_signatures"] ?? 0);
  const blockers = [
    ...(gatePasses ? [] : [{ blocker_id: "gate65_verdict_failure", severity: "hard", detail: "At least one Gate 65 sub-gate failed." }]),
    ...(valuationVisible ? [] : [{ blocker_id: "valuation_gap_not_contract_visible", severity: "hard", detail: "Gate 65A did not prove valuation_gap contract visibility." }]),
    {
      blocker_id: "body_design_not_open",
      severity: "expected_stop_line",
      detail: "Freedom has not opened Body design; Gate 65F is review-only.",
    },
    {
      blocker_id: "scenario_memory_requires_human_review",
      severity: "review",
      detail: "Scenario memory is descriptive and retrospective; Freedom must decide whether it is useful enough for a Body design gate.",
    },
  ];
  const hardBlockers = blockers.filter((blocker) => blocker.severity === "hard");
  const readinessVerdict = hardBlockers.length > 0
    ? "BLOCKED_REQUIRES_EVIDENCE_REPAIR"
    : newRouterSignatures > 0
      ? "READY_FOR_BODY_DESIGN_REVIEW"
      : "NOT_READY_REQUIRES_MORE_ARCHITECTURE_DIAGNOSTICS";
  const recommendedNextGate =
    readinessVerdict === "READY_FOR_BODY_DESIGN_REVIEW"
      ? {
          gate: "Gate 66: Body design review preflight",
          decision: "Open only if Freedom accepts Gate 65F evidence and chooses a router family to design around.",
          frozen_areas: ["Alpha v2 promotion", "risk/execution/live/app work", "source mutation", "optimized threshold search", "pair/date exclusions"],
        }
      : {
          gate: "Gate 66: Brain architecture diagnostic repair",
          decision: "Repair the blocker before any Body design.",
          frozen_areas: ["Body design", "Alpha v2 promotion", "risk/execution/live/app work"],
        };
  const crossGateEntries = [
    { label: "gate65a_summary", path: path.join(options.gate65aDir, "gate65a-summary.json") },
    { label: "gate65a_sha", path: path.join(options.gate65aDir, "gate65a-sha256.txt") },
    { label: "gate65b_summary", path: path.join(options.gate65bDir, "gate65b-summary.json") },
    { label: "gate65b_sha", path: path.join(options.gate65bDir, "gate65b-sha256.txt") },
    { label: "gate65c_summary", path: path.join(options.gate65cDir, "gate65c-summary.json") },
    { label: "gate65c_sha", path: path.join(options.gate65cDir, "gate65c-sha256.txt") },
    { label: "gate65d_summary", path: path.join(options.gate65dDir, "gate65d-summary.json") },
    { label: "gate65d_sha", path: path.join(options.gate65dDir, "gate65d-sha256.txt") },
    { label: "gate65e_summary", path: path.join(options.gate65eDir, "brain-router-summary.json") },
    { label: "gate65e_sha", path: path.join(options.gate65eDir, "gate65e-sha256.txt") },
  ];
  const artifacts = {
    readinessSummary: toRepoRelative(path.join(artifactDir, "gate65f-readiness-summary.json")),
    blockersJson: toRepoRelative(path.join(artifactDir, "gate65f-blockers.json")),
    recommendedNextGate: toRepoRelative(path.join(artifactDir, "gate65f-recommended-next-gate.md")),
    crossGateHashManifest: toRepoRelative(path.join(artifactDir, "gate65f-cross-gate-hash-manifest.txt")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate65f-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    readiness_verdict: readinessVerdict,
    verdict:
      hardBlockers.length === 0
        ? "PASS_BRAIN_ARCHITECTURE_READINESS_REVIEW_PACKET__STOP_AFTER_GATE65F"
        : "FAIL_BRAIN_ARCHITECTURE_READINESS_REVIEW_PACKET_BLOCKED",
    gate_verdicts: {
      gate65a: gate65a["verdict"],
      gate65b: gate65b["verdict"],
      gate65c: gate65c["verdict"],
      gate65d: gate65d["verdict"],
      gate65e: gate65e["verdict"],
    },
    findings: {
      valuation_gap_contract_visible: valuationVisible,
      highest_pf_candidate: highestPf ? compactCandidate(highestPf) : null,
      highest_robust_pf_candidate: highestRobustPf ? compactCandidate(highestRobustPf) : null,
      best_zero_negative_year_candidate: zeroNegative ? compactCandidate(zeroNegative) : null,
      best_balanced_candidate: balanced ? compactCandidate(balanced) : null,
      best_low_degradation_candidate: lowDegradation ? compactCandidate(lowDegradation) : null,
      pf_materially_improved_vs_gate64c: Boolean(routerFindings?.["pf_improved_but_robustness_caveat"]),
      genuinely_new_router_signatures: newRouterSignatures,
      scenario_memory_added_information:
        scenarioCounts !== undefined && Object.values(scenarioCounts).some((count) => count > 2)
          ? "scenario memory adds grouped descriptive reliability/caveat surfaces, but remains retrospective and review-only"
          : "scenario memory did not materially expand beyond known candidate behavior",
    },
    blockers_before_body: blockers,
    required_next_human_decision: [
      "open Body design gate",
      "run more architecture diagnostics",
      "repair atom policy/scenario memory",
      "stop",
    ],
    recommended_next_gate: recommendedNextGate,
    stop_line_confirmed: true,
    artifacts,
  };

  const crossLines = [`gate_id ${GATE_ID}`, `command ${COMMAND}`, `generated_at ${summary.generated_at}`, `git_commit ${summary.git_commit}`];
  for (const entry of crossGateEntries) crossLines.push(`${entry.label} ${await fileHash(entry.path)} ${toRepoRelative(entry.path)}`);
  await writeText(path.join(artifactDir, "gate65f-cross-gate-hash-manifest.txt"), `${crossLines.join("\n")}\n`);
  await writeJson(path.join(artifactDir, "gate65f-readiness-summary.json"), summary);
  await writeJson(path.join(artifactDir, "gate65f-blockers.json"), {
    gate_id: GATE_ID,
    readiness_verdict: readinessVerdict,
    blockers_before_body: blockers,
  });
  await writeText(
    path.join(artifactDir, "gate65f-recommended-next-gate.md"),
    [
      "# Gate 65F Recommended Next Gate",
      "",
      `Readiness verdict: \`${readinessVerdict}\``,
      "",
      `Recommended gate: \`${recommendedNextGate.gate}\``,
      "",
      recommendedNextGate.decision,
      "",
      "Frozen areas remain: Body design until explicitly opened, Alpha v2, risk, exits, execution, MT5/live, app/runtime, source mutation, retuning, broad source consolidation, optimized thresholds, learned weights, pair exclusions, and date exclusions.",
      "",
    ].join("\n"),
  );
  await writeText(reportPath, renderReport(summary, routerRows));
  await writeShaManifest(path.join(artifactDir, "gate65f-sha256.txt"), GATE_ID, COMMAND, [
    { label: "readiness_summary", path: path.join(artifactDir, "gate65f-readiness-summary.json") },
    { label: "blockers", path: path.join(artifactDir, "gate65f-blockers.json") },
    { label: "recommended_next_gate", path: path.join(artifactDir, "gate65f-recommended-next-gate.md") },
    { label: "cross_gate_hash_manifest", path: path.join(artifactDir, "gate65f-cross-gate-hash-manifest.txt") },
    { label: "report", path: reportPath },
  ]);

  if (hardBlockers.length > 0) throw new Error(summary.verdict);
  console.log(summary.verdict);
  console.log(JSON.stringify({ artifacts, readiness_verdict: readinessVerdict, findings: summary.findings }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
