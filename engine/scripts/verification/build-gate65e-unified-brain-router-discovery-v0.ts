import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_GATE64C_DIR,
  DEFAULT_GATE65A_DIR,
  DEFAULT_GATE65B_DIR,
  DEFAULT_GATE65C_DIR,
  DEFAULT_GATE65D_DIR,
  EXPECTED_ROWS,
  GATE65_DATE,
  AlphaLedgerRow,
  AtomPolicyLedgerRow,
  CandidateContract,
  CandidateSummary,
  Decision,
  Direction,
  ScenarioMemoryRow,
  compactCandidate,
  directionFromSide,
  gitCommit,
  loadAlphaRows,
  loadGate64cRows,
  majorityVote,
  opposite,
  parseArgMap,
  policyRowsByAlpha,
  rankCandidateRows,
  readJson,
  readJsonl,
  renderTable,
  scoreCandidate,
  toRepoRelative,
  writeJson,
  writeJsonl,
  writeShaManifest,
  writeText,
} from "./gate65-utils";

const GATE_ID = "Gate 65E: unified-brain-router-discovery-v0";
const COMMAND = "npm run engine:gate65e:unified-brain-router-discovery-v0";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate65e/artifacts/gate65e-unified-brain-router-discovery-v0";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate65e/GATE65E_UNIFIED_BRAIN_ROUTER_DISCOVERY_V0_${GATE65_DATE}.md`;

type ScenarioGroupSummaryFile = {
  grouping_summaries: {
    cell_agreement_state_key: Array<{
      group_key: string;
      support_count: number;
      years_covered: number;
      descriptive_reliability_hint: string;
    }>;
  };
};

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate64cDir: args.get("--gate64c-dir") ?? DEFAULT_GATE64C_DIR,
    gate65aDir: args.get("--gate65a-dir") ?? DEFAULT_GATE65A_DIR,
    gate65bDir: args.get("--gate65b-dir") ?? DEFAULT_GATE65B_DIR,
    gate65cDir: args.get("--gate65c-dir") ?? DEFAULT_GATE65C_DIR,
    gate65dDir: args.get("--gate65d-dir") ?? DEFAULT_GATE65D_DIR,
  };
}

function contract(candidate_id: string, family: string, label: string, atom_keys: string[], source_cells: string[], complexity: number, dependency_rule: string): CandidateContract {
  return {
    candidate_id,
    family,
    label,
    candidate_direction_kind: "candidate_composite_direction",
    atom_keys,
    source_cells,
    transform_version: `gate65e_${candidate_id}_v0`,
    tie_rule: "predeclared fixed router order; no optimized thresholds or learned weights",
    dependency_rule,
    complexity,
    discovery_only: true,
  };
}

function decision(direction: Direction, directionSource: string, atomVotes: Record<string, Direction>, policyRoles: Record<string, number>, scenarioKey: string | null, degraded = false, degradedReasons: string[] = []): Decision {
  return { direction, direction_source: directionSource, degraded, degraded_reasons: degradedReasons, atom_votes: atomVotes, policy_roles: policyRoles, scenario_group_key: scenarioKey };
}

function renderReport(summary: Record<string, unknown>, rows: CandidateSummary[]) {
  const tableRows = [...rows]
    .sort((left, right) => (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999))
    .slice(0, 12)
    .map((row) => ({
      candidate_id: row.candidate_id,
      adr: row.adr_grid.adr_sum,
      dd: row.adr_grid.max_drawdown,
      rdd: row.adr_grid.r_over_drawdown,
      pf: row.adr_grid.row_pf,
      wh: row.weekly_hold.adr_sum,
      wh_pf: row.weekly_hold.row_pf,
      neg_years: row.negative_adr_grid_years,
      signature_match: (summary.signature_findings as Record<string, unknown>)[row.candidate_id] ?? "",
    }));
  return [
    "# Gate 65E Unified Brain Router Discovery v0",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Discovery-only unified Brain router matrix.",
    "- Forced-28 rows preserved; no pair/date exclusions.",
    "- Router families are fixed and predeclared.",
    "- No final Body lock, Alpha v2 promotion, risk, learned weights, or threshold optimization.",
    "",
    "## Best Router Candidates By ADR Grid R/DD",
    "",
    renderTable(tableRows, ["candidate_id", "adr", "dd", "rdd", "pf", "wh", "wh_pf", "neg_years", "signature_match"]),
    "",
    "## Findings",
    "",
    "```json",
    JSON.stringify(summary.findings, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Candidate contracts: \`${summary.artifacts["candidateContracts"]}\``,
    `- Router matrix rows: \`${summary.artifacts["matrixRows"]}\``,
    `- Router summary: \`${summary.artifacts["routerSummary"]}\``,
    `- Best candidates: \`${summary.artifacts["bestCandidates"]}\``,
    `- PF rankings: \`${summary.artifacts["pfRankings"]}\``,
    `- Year diagnostics: \`${summary.artifacts["yearDiagnostics"]}\``,
    `- Policy participation: \`${summary.artifacts["policyParticipation"]}\``,
    `- Scenario exposure: \`${summary.artifacts["scenarioExposure"]}\``,
    `- Signature collapse: \`${summary.artifacts["signatureCollapse"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 65E stops at discovery-only router evidence. It does not emit final Body decisions or promote Alpha v2.",
    "",
  ].join("\n");
}

function bestCandidatesMarkdown(rows: CandidateSummary[]) {
  const sections: Array<[string, CandidateSummary[]]> = [
    ["Best ADR Grid R/DD", [...rows].sort((left, right) => (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999))],
    ["Best ADR Grid PF", [...rows].sort((left, right) => (right.adr_grid.row_pf ?? -999) - (left.adr_grid.row_pf ?? -999))],
    ["Best Zero-Negative-Year", [...rows].filter((row) => row.negative_adr_grid_years === 0).sort((left, right) => (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999))],
    ["Best Weekly Hold PF", [...rows].sort((left, right) => (right.weekly_hold.row_pf ?? -999) - (left.weekly_hold.row_pf ?? -999))],
  ];
  const lines = ["# Gate 65E Brain Router Best Candidates", "", "Discovery-only. No Body lock, Alpha v2 promotion, risk, execution, app/runtime, or optimized thresholds.", ""];
  for (const [title, candidates] of sections) {
    lines.push(`## ${title}`, "", "| Rank | Candidate | ADR | DD | R/DD | PF | Weekly Hold | WH PF | Degraded | Negative Years |", "|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|");
    candidates.slice(0, 10).forEach((row, index) => {
      lines.push(`| ${index + 1} | ${row.candidate_id} | ${row.adr_grid.adr_sum} | ${row.adr_grid.max_drawdown} | ${row.adr_grid.r_over_drawdown} | ${row.adr_grid.row_pf} | ${row.weekly_hold.adr_sum} | ${row.weekly_hold.row_pf} | ${row.degraded_row_count} | ${row.negative_adr_grid_years} |`);
    });
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const alphaRows = await loadAlphaRows();
  const policyRows = await readJsonl<AtomPolicyLedgerRow>(path.join(options.gate65cDir, "atom-policy-ledger.rows.jsonl"));
  const scenarioRows = await readJsonl<ScenarioMemoryRow>(path.join(options.gate65dDir, "scenario-memory.rows.jsonl"));
  const scenarioGroupFile = await readJson<ScenarioGroupSummaryFile>(path.join(options.gate65dDir, "scenario-group-summary.json"));
  const gate64cRows = await loadGate64cRows(options.gate64cDir);
  const gate65aSummary = await readJson<Record<string, unknown>>(path.join(options.gate65aDir, "gate65a-summary.json"));
  const gate65bSummary = await readJson<Record<string, unknown>>(path.join(options.gate65bDir, "gate65b-summary.json"));
  const policiesByAlpha = policyRowsByAlpha(policyRows);
  const scenarioByAlpha = new Map(scenarioRows.map((row) => [row.alpha_row_key, row]));
  const cellGroupHints = new Map(scenarioGroupFile.grouping_summaries.cell_agreement_state_key.map((row) => [row.group_key, row]));

  const policy = (row: AlphaLedgerRow, atomId: string) => policiesByAlpha.get(row.row_key)?.find((entry) => entry.atom_id === atomId);
  const sourceDirection = (row: AlphaLedgerRow, atomId: string, fallback: Direction = "BASE_CURRENCY") => policy(row, atomId)?.source_direction ?? fallback;
  const roleCount = (row: AlphaLedgerRow, atomId: string) => {
    const role = policy(row, atomId)?.policy_role ?? "blocked";
    return { [role]: 1 };
  };
  const scenarioKey = (row: AlphaLedgerRow) => scenarioByAlpha.get(row.row_key)?.cell_agreement_state_key ?? null;
  const alphaDirection = (row: AlphaLedgerRow) => directionFromSide(row.arbitration.final_side);
  const rrp = (row: AlphaLedgerRow) => sourceDirection(row, "rrp_derived_inverse", alphaDirection(row));
  const cot = (row: AlphaLedgerRow) => sourceDirection(row, "cot_side", alphaDirection(row));
  const strength = (row: AlphaLedgerRow) => sourceDirection(row, "strength_side", alphaDirection(row));
  const bpr = (row: AlphaLedgerRow) => sourceDirection(row, "bpr_direction_quality", rrp(row));
  const valuationReer = (row: AlphaLedgerRow) => sourceDirection(row, "valuation_gap_reer_deviation_inverse", rrp(row));
  const valuationRelative = (row: AlphaLedgerRow) => sourceDirection(row, "valuation_gap_neer_reer_relative_inverse", rrp(row));
  const policyAllowsDirectVote = (row: AlphaLedgerRow, atomId: string) => policy(row, atomId)?.allowed_body_use === "direct_vote";
  const valuationRelativeExtreme = (row: AlphaLedgerRow) => policy(row, "valuation_gap_neer_reer_relative_inverse")?.policy_role === "follow";
  const cotHighConfidence = (row: AlphaLedgerRow) => policy(row, "cot_side")?.allowed_body_use === "direct_vote";

  const candidates: Array<{ contract: CandidateContract; directionFor: (row: AlphaLedgerRow) => Decision }> = [
    {
      contract: contract(
        "macro_anchor_timing_confirm_rrp_valuation_relative",
        "macro_anchor_timing_confirm",
        "RRP macro anchor when valuation-relative or timing cells confirm, else Alpha fallback",
        ["rrp_derived", "valuation_gap_neer_reer_relative", "cot_side", "strength_gate57e_side", "alpha_v1_final_side"],
        ["regime", "cot", "strength", "alpha_v1"],
        5,
        "RRP is primary macro anchor; valuation-relative or COT/Strength confirmation keeps it active; otherwise Alpha v1 fallback",
      ),
      directionFor: (row) => {
        const confirmed = rrp(row) === valuationRelative(row) || rrp(row) === cot(row) || rrp(row) === strength(row);
        const direction = confirmed ? rrp(row) : alphaDirection(row);
        return decision(direction, confirmed ? "rrp_anchor_confirmed" : "alpha_fallback_unconfirmed_rrp_anchor", { rrp: rrp(row), valuation_relative: valuationRelative(row), cot: cot(row), strength: strength(row), alpha: alphaDirection(row) }, { ...roleCount(row, "rrp_derived_inverse"), ...roleCount(row, "valuation_gap_neer_reer_relative_inverse") }, scenarioKey(row));
      },
    },
    {
      contract: contract(
        "macro_anchor_crowding_warning_rrp_cot_extreme",
        "macro_anchor_crowding_warning",
        "RRP macro anchor with COT extreme contradiction warning fallback",
        ["rrp_derived", "cot_side", "alpha_v1_final_side"],
        ["regime", "cot", "alpha_v1"],
        3,
        "RRP dominates unless high-confidence COT contradicts, then Alpha v1 fallback is used as warning route",
      ),
      directionFor: (row) => {
        const warned = cotHighConfidence(row) && cot(row) !== rrp(row);
        return decision(warned ? alphaDirection(row) : rrp(row), warned ? "alpha_fallback_cot_extreme_warning" : "rrp_anchor_no_cot_warning", { rrp: rrp(row), cot: cot(row), alpha: alphaDirection(row) }, { ...roleCount(row, "cot_side"), ...roleCount(row, "rrp_derived_inverse") }, scenarioKey(row), warned, warned ? ["cot_extreme_contradiction_warning"] : []);
      },
    },
    {
      contract: contract(
        "valuation_confirmation_router_rrp_reer_else_alpha",
        "valuation_confirmation_router",
        "RRP direct vote only when valuation REER inverse agrees, else Alpha fallback",
        ["rrp_derived", "valuation_gap_reer_deviation", "alpha_v1_final_side"],
        ["regime", "alpha_v1"],
        3,
        "RRP is active only with valuation REER confirmation; otherwise fallback to frozen Alpha v1",
      ),
      directionFor: (row) => decision(rrp(row) === valuationReer(row) ? rrp(row) : alphaDirection(row), rrp(row) === valuationReer(row) ? "rrp_confirmed_by_valuation_reer" : "alpha_fallback_rrp_valuation_disagree", { rrp: rrp(row), valuation_reer: valuationReer(row), alpha: alphaDirection(row) }, { ...roleCount(row, "rrp_derived_inverse"), ...roleCount(row, "valuation_gap_reer_deviation_inverse") }, scenarioKey(row)),
    },
    {
      contract: contract(
        "strength_timing_router_strength_direct_else_rrp",
        "strength_timing_router",
        "Strength votes only when its policy is direct-vote, else RRP dominates",
        ["strength_gate57e_side", "rrp_derived"],
        ["strength", "regime"],
        2,
        "Strength participates only where policy ledger allows direct vote",
      ),
      directionFor: (row) => decision(policyAllowsDirectVote(row, "strength_side") ? strength(row) : rrp(row), policyAllowsDirectVote(row, "strength_side") ? "strength_direct_vote_policy" : "rrp_fallback_strength_not_direct", { strength: strength(row), rrp: rrp(row) }, { ...roleCount(row, "strength_side"), ...roleCount(row, "rrp_derived_inverse") }, scenarioKey(row)),
    },
    {
      contract: contract(
        "cot_crowding_router_cot_high_conf_else_rrp",
        "cot_crowding_router",
        "COT votes only in high-confidence spread states, else RRP dominates",
        ["cot_side", "rrp_derived"],
        ["cot", "regime"],
        2,
        "COT participates only where policy ledger allows direct vote",
      ),
      directionFor: (row) => decision(policyAllowsDirectVote(row, "cot_side") ? cot(row) : rrp(row), policyAllowsDirectVote(row, "cot_side") ? "cot_direct_vote_policy" : "rrp_fallback_cot_not_direct", { cot: cot(row), rrp: rrp(row) }, { ...roleCount(row, "cot_side"), ...roleCount(row, "rrp_derived_inverse") }, scenarioKey(row)),
    },
    {
      contract: contract(
        "bpr_quality_aware_router_bpr_promotion_else_rrp",
        "bpr_quality_aware_router",
        "BPR participates only where quality policy allows direct vote, else RRP dominates",
        ["bpr", "rrp_derived"],
        ["regime"],
        2,
        "BPR direct vote only for promotion-eligible rows; degraded/ineligible BPR may warn but cannot direct-vote",
      ),
      directionFor: (row) => decision(policyAllowsDirectVote(row, "bpr_direction_quality") ? bpr(row) : rrp(row), policyAllowsDirectVote(row, "bpr_direction_quality") ? "bpr_direct_vote_quality_eligible" : "rrp_fallback_bpr_quality_not_direct", { bpr: bpr(row), rrp: rrp(row) }, { ...roleCount(row, "bpr_direction_quality"), ...roleCount(row, "rrp_derived_inverse") }, scenarioKey(row), !policyAllowsDirectVote(row, "bpr_direction_quality"), policyAllowsDirectVote(row, "bpr_direction_quality") ? [] : ["bpr_not_direct_vote_quality"]),
    },
    {
      contract: contract(
        "scenario_memory_confirmation_router_cell_agreement_support112",
        "scenario_memory_confirmation_router",
        "Scenario memory uses fixed cell-agreement groups with support >=112 rows",
        ["scenario_memory", "alpha_v1_final_side", "rrp_derived"],
        ["scenario_memory", "alpha_v1", "regime"],
        3,
        "If cell-agreement scenario memory has fixed support >=112 and signals direct/fade, route Alpha follow/fade; otherwise RRP fallback",
      ),
      directionFor: (row) => {
        const scenario = scenarioByAlpha.get(row.row_key);
        const hint = scenario ? cellGroupHints.get(scenario.cell_agreement_state_key) : undefined;
        const supported = Boolean(hint && hint.support_count >= 112 && hint.years_covered >= 3);
        if (supported && hint?.descriptive_reliability_hint === "historically_reliable_direct_vote_reference") {
          return decision(alphaDirection(row), "scenario_memory_supported_alpha_follow", { alpha: alphaDirection(row), rrp: rrp(row) }, { scenario_memory_supported: 1 }, scenarioKey(row));
        }
        if (supported && hint?.descriptive_reliability_hint === "historically_dangerous_or_fade_candidate_reference") {
          return decision(opposite(alphaDirection(row)), "scenario_memory_supported_alpha_fade", { alpha_fade: opposite(alphaDirection(row)), rrp: rrp(row) }, { scenario_memory_supported: 1 }, scenarioKey(row), true, ["scenario_memory_fade_reference"]);
        }
        return decision(rrp(row), "rrp_fallback_scenario_memory_low_or_mixed_support", { rrp: rrp(row), alpha: alphaDirection(row) }, { scenario_memory_low_or_mixed_support: 1 }, scenarioKey(row));
      },
    },
    {
      contract: contract(
        "conservative_router_rrp_valuation_confirmed_else_alpha",
        "conservative_router",
        "Conservative zero-negative-year continuity: RRP only when valuation REER confirms, else Alpha",
        ["rrp_derived", "valuation_gap_reer_deviation", "alpha_v1_final_side"],
        ["regime", "alpha_v1"],
        3,
        "Conservative router mirrors the fixed zero-negative-year Gate 64C condition for review, without promotion",
      ),
      directionFor: (row) => decision(rrp(row) === valuationReer(row) ? rrp(row) : alphaDirection(row), rrp(row) === valuationReer(row) ? "conservative_rrp_valuation_confirmed" : "conservative_alpha_fallback", { rrp: rrp(row), valuation_reer: valuationReer(row), alpha: alphaDirection(row) }, { ...roleCount(row, "rrp_derived_inverse"), ...roleCount(row, "valuation_gap_reer_deviation_inverse") }, scenarioKey(row)),
    },
    {
      contract: contract(
        "pf_reporting_router_rrp_inverse_continuity",
        "pf_router",
        "PF reporting router: RRP inverse continuity reference",
        ["rrp_derived"],
        ["regime"],
        1,
        "PF is reported for the fixed RRP inverse continuity router; no PF target optimization is performed",
      ),
      directionFor: (row) => decision(rrp(row), "rrp_inverse_pf_reporting_reference", { rrp: rrp(row) }, { ...roleCount(row, "rrp_derived_inverse") }, scenarioKey(row)),
    },
    {
      contract: contract(
        "valuation_relative_extreme_macro_anchor_else_rrp",
        "macro_anchor_timing_confirm",
        "Valuation-relative extreme macro anchor, else RRP inverse",
        ["valuation_gap_neer_reer_relative", "rrp_derived"],
        ["regime"],
        2,
        "Use valuation-relative inverse only where fixed Gate 65C policy marks it direct-vote extreme; otherwise RRP inverse",
      ),
      directionFor: (row) => decision(valuationRelativeExtreme(row) ? valuationRelative(row) : rrp(row), valuationRelativeExtreme(row) ? "valuation_relative_extreme_direct_vote" : "rrp_fallback_valuation_relative_not_extreme", { valuation_relative: valuationRelative(row), rrp: rrp(row) }, { ...roleCount(row, "valuation_gap_neer_reer_relative_inverse"), ...roleCount(row, "rrp_derived_inverse") }, scenarioKey(row)),
    },
    {
      contract: contract(
        "macro_anchor_unanimous_cells_else_rrp",
        "macro_anchor_timing_confirm",
        "Use COT/Strength/RRP unanimous state else RRP inverse",
        ["cot_side", "strength_gate57e_side", "rrp_derived"],
        ["cot", "strength", "regime"],
        3,
        "COT and Strength can only override by unanimity with RRP; otherwise RRP remains macro fallback",
      ),
      directionFor: (row) => {
        const vote = majorityVote(
          [
            { direction: cot(row), direction_source: "cot", degraded: false, degraded_reasons: [], atom_votes: { cot: cot(row) } },
            { direction: strength(row), direction_source: "strength", degraded: false, degraded_reasons: [], atom_votes: { strength: strength(row) } },
            { direction: rrp(row), direction_source: "rrp", degraded: false, degraded_reasons: [], atom_votes: { rrp: rrp(row) } },
          ],
          rrp(row),
          "macro_anchor_unanimous_cells_else_rrp",
        );
        const unanimous = cot(row) === strength(row) && strength(row) === rrp(row);
        return decision(unanimous ? vote.direction : rrp(row), unanimous ? "cot_strength_rrp_unanimous" : "rrp_fallback_no_unanimity", { cot: cot(row), strength: strength(row), rrp: rrp(row) }, { ...roleCount(row, "cot_side"), ...roleCount(row, "strength_side"), ...roleCount(row, "rrp_derived_inverse") }, scenarioKey(row));
      },
    },
  ];

  const routerRows = candidates.map((candidate) => scoreCandidate(candidate.contract, alphaRows, candidate.directionFor));
  const gate64cBySignature = new Map(gate64cRows.map((row) => [row.decision_signature_sha256, row]));
  const signatureGroups = new Map<string, CandidateSummary[]>();
  for (const row of routerRows) signatureGroups.set(row.decision_signature_sha256, [...(signatureGroups.get(row.decision_signature_sha256) ?? []), row]);
  const signatureCollapse = [...signatureGroups.entries()].map(([decision_signature_sha256, rows]) => ({
    decision_signature_sha256,
    router_candidate_ids: rows.map((row) => row.candidate_id),
    equivalent_gate64c_candidate_id: gate64cBySignature.get(decision_signature_sha256)?.candidate_id ?? null,
    candidate_count: rows.length,
  }));
  const signatureFindings = Object.fromEntries(
    routerRows.map((row) => [row.candidate_id, gate64cBySignature.get(row.decision_signature_sha256)?.candidate_id ?? "new_signature_vs_gate64c"]),
  );
  const pfRankings = rankCandidateRows(routerRows);
  const yearDiagnostics = {
    gate_id: GATE_ID,
    candidates: routerRows.map((row) => ({
      candidate_id: row.candidate_id,
      adr_grid: row.adr_grid,
      weekly_hold: row.weekly_hold,
      negative_adr_grid_years: row.negative_adr_grid_years,
      worst_adr_grid_year: row.worst_adr_grid_year,
      annual_summary: row.annual_summary,
    })),
  };
  const policyParticipation = {
    gate_id: GATE_ID,
    candidates: routerRows.map((row) => ({
      candidate_id: row.candidate_id,
      atom_participation_counts: row.atom_participation_counts,
      policy_role_participation: row.policy_role_participation,
      degraded_or_warning_rows: row.degraded_or_warning_rows,
      fallback_rows: row.fallback_rows,
    })),
  };
  const scenarioExposure = {
    gate_id: GATE_ID,
    fixed_support_rule: "scenario cell-agreement group support >= 112 rows and years_covered >= 3",
    candidates: routerRows.map((row) => ({
      candidate_id: row.candidate_id,
      scenario_memory_exposure: row.scenario_memory_exposure,
    })),
  };
  const topRdd = [...routerRows].sort((left, right) => (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999))[0];
  const bestPf = pfRankings.best_adr_grid_pf[0];
  const zeroNegative = pfRankings.best_zero_negative_years[0] ?? null;
  const pass =
    routerRows.length === candidates.length &&
    routerRows.every((row) => row.forced28_row_count === EXPECTED_ROWS && row.duplicate_row_count === 0) &&
    gate65aSummary["verdict"] !== undefined &&
    gate65bSummary["verdict"] !== undefined;
  const artifacts = {
    candidateContracts: toRepoRelative(path.join(artifactDir, "brain-router-candidate-contracts.json")),
    matrixRows: toRepoRelative(path.join(artifactDir, "brain-router-matrix.rows.jsonl")),
    routerSummary: toRepoRelative(path.join(artifactDir, "brain-router-summary.json")),
    bestCandidates: toRepoRelative(path.join(artifactDir, "brain-router-best-candidates.md")),
    pfRankings: toRepoRelative(path.join(artifactDir, "brain-router-pf-rankings.json")),
    yearDiagnostics: toRepoRelative(path.join(artifactDir, "brain-router-year-by-year-diagnostics.json")),
    policyParticipation: toRepoRelative(path.join(artifactDir, "brain-router-policy-participation.json")),
    scenarioExposure: toRepoRelative(path.join(artifactDir, "brain-router-scenario-memory-exposure.json")),
    signatureCollapse: toRepoRelative(path.join(artifactDir, "brain-router-signature-collapse.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate65e-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_UNIFIED_BRAIN_ROUTER_DISCOVERY_V0__FORCED28_PRESERVED__DISCOVERY_ONLY_NO_BODY" : "FAIL_UNIFIED_BRAIN_ROUTER_DISCOVERY_V0_BOUNDARY_OR_DENOMINATOR",
    candidate_count: routerRows.length,
    validation: {
      forced28_preserved: routerRows.every((row) => row.forced28_row_count === EXPECTED_ROWS),
      pair_exclusions: 0,
      date_exclusions: 0,
      optimized_threshold_search: false,
      learned_weights: false,
      body_direction_treated_as_final: false,
      alpha_v2_started: false,
      risk_started: false,
    },
    findings: {
      best_by_adr_grid_rdd: compactCandidate(topRdd),
      best_by_adr_grid_pf: compactCandidate(bestPf),
      best_zero_negative_year_candidate: zeroNegative ? compactCandidate(zeroNegative) : null,
      router_signatures_matching_gate64c: signatureCollapse.filter((row) => row.equivalent_gate64c_candidate_id !== null).length,
      genuinely_new_router_signatures: signatureCollapse.filter((row) => row.equivalent_gate64c_candidate_id === null).length,
      pf_improved_but_robustness_caveat:
        bestPf.candidate_id !== topRdd.candidate_id && ((bestPf.negative_adr_grid_years > topRdd.negative_adr_grid_years) || (bestPf.adr_grid.r_over_drawdown ?? 0) < (topRdd.adr_grid.r_over_drawdown ?? 0)),
      no_final_promotion: true,
    },
    signature_findings: signatureFindings,
    artifacts,
  };

  await writeJson(path.join(artifactDir, "brain-router-candidate-contracts.json"), {
    gate_id: GATE_ID,
    candidates: candidates.map((candidate) => candidate.contract),
  });
  await writeJsonl(path.join(artifactDir, "brain-router-matrix.rows.jsonl"), routerRows);
  await writeJson(path.join(artifactDir, "brain-router-summary.json"), summary);
  await writeText(path.join(artifactDir, "brain-router-best-candidates.md"), bestCandidatesMarkdown(routerRows));
  await writeJson(path.join(artifactDir, "brain-router-pf-rankings.json"), {
    gate_id: GATE_ID,
    ranking_views: pfRankings,
  });
  await writeJson(path.join(artifactDir, "brain-router-year-by-year-diagnostics.json"), yearDiagnostics);
  await writeJson(path.join(artifactDir, "brain-router-policy-participation.json"), policyParticipation);
  await writeJson(path.join(artifactDir, "brain-router-scenario-memory-exposure.json"), scenarioExposure);
  await writeJson(path.join(artifactDir, "brain-router-signature-collapse.json"), {
    gate_id: GATE_ID,
    entries: signatureCollapse,
  });
  await writeText(reportPath, renderReport(summary, routerRows));
  await writeShaManifest(path.join(artifactDir, "gate65e-sha256.txt"), GATE_ID, COMMAND, [
    { label: "candidate_contracts", path: path.join(artifactDir, "brain-router-candidate-contracts.json") },
    { label: "matrix_rows", path: path.join(artifactDir, "brain-router-matrix.rows.jsonl") },
    { label: "router_summary", path: path.join(artifactDir, "brain-router-summary.json") },
    { label: "best_candidates", path: path.join(artifactDir, "brain-router-best-candidates.md") },
    { label: "pf_rankings", path: path.join(artifactDir, "brain-router-pf-rankings.json") },
    { label: "year_diagnostics", path: path.join(artifactDir, "brain-router-year-by-year-diagnostics.json") },
    { label: "policy_participation", path: path.join(artifactDir, "brain-router-policy-participation.json") },
    { label: "scenario_exposure", path: path.join(artifactDir, "brain-router-scenario-memory-exposure.json") },
    { label: "signature_collapse", path: path.join(artifactDir, "brain-router-signature-collapse.json") },
    { label: "report", path: reportPath },
  ]);

  if (!pass) throw new Error(summary.verdict);
  console.log(summary.verdict);
  console.log(JSON.stringify({ artifacts, findings: summary.findings }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
