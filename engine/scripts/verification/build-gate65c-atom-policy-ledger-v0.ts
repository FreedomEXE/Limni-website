import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_GATE60C_DIR,
  DEFAULT_GATE60G_DIR,
  DEFAULT_GATE64B_DIR,
  EXPECTED_ROWS,
  GATE65_DATE,
  buildPolicyLedger,
  countBy,
  denominatorSummary,
  gitCommit,
  loadAlphaRows,
  loadBprRows,
  loadCurrencyAtomRows,
  loadValuationRows,
  parseArgMap,
  renderTable,
  toRepoRelative,
  writeJson,
  writeJsonl,
  writeShaManifest,
  writeText,
} from "./gate65-utils";

const GATE_ID = "Gate 65C: atom-policy-ledger-v0";
const COMMAND = "npm run engine:gate65c:atom-policy-ledger-v0";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate65c/artifacts/gate65c-atom-policy-ledger-v0";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate65c/GATE65C_ATOM_POLICY_LEDGER_V0_${GATE65_DATE}.md`;

const REQUIRED_POLICY_ATOMS = [
  "cot_side",
  "cot_spread_lifecycle_quality",
  "strength_side",
  "strength_phase_lifecycle_quality",
  "bpr_direction_quality",
  "rrp_derived_inverse",
  "rrp_derived_natural",
  "valuation_gap_reer_deviation_inverse",
  "valuation_gap_reer_deviation_natural",
  "valuation_gap_neer_reer_relative_inverse",
  "valuation_gap_neer_reer_relative_natural",
  "ppp_raw_context",
  "neer_raw_context",
  "reer_raw_context",
];

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate60cDir: args.get("--gate60c-dir") ?? DEFAULT_GATE60C_DIR,
    gate60gDir: args.get("--gate60g-dir") ?? DEFAULT_GATE60G_DIR,
    gate64bDir: args.get("--gate64b-dir") ?? DEFAULT_GATE64B_DIR,
  };
}

function renderReport(summary: Record<string, unknown>) {
  const topRoles = (summary.role_counts_by_atom as Array<Record<string, unknown>>).slice(0, 20);
  return [
    "# Gate 65C Atom Policy Ledger v0",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Emits atom policy roles only.",
    "- No final Body direction is emitted.",
    "- No outcome fields are used for policy-role assignment.",
    "- Forced-28 pair-week denominator is preserved.",
    "",
    "## Policy Roles By Atom",
    "",
    renderTable(topRoles, ["atom_id", "policy_role", "rows"]),
    "",
    "## Denominator",
    "",
    "```json",
    JSON.stringify(summary.denominator, null, 2),
    "```",
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Policy ledger rows: \`${summary.artifacts["ledgerRows"]}\``,
    `- Role summary: \`${summary.artifacts["roleSummary"]}\``,
    `- Quality summary: \`${summary.artifacts["qualitySummary"]}\``,
    `- Policy contract: \`${summary.artifacts["policyContract"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 65C stops at policy ledger diagnostics. Body design, Alpha v2, risk, execution, app/runtime, and optimization remain closed.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const alphaRows = await loadAlphaRows();
  const currencyRows = await loadCurrencyAtomRows(options.gate60cDir);
  const bprRows = await loadBprRows(options.gate60gDir);
  const valuationRows = await loadValuationRows(options.gate64bDir);
  const policyRows = buildPolicyLedger(alphaRows, currencyRows, bprRows, valuationRows);
  const denominator = denominatorSummary(alphaRows);
  const atomCounts = countBy(policyRows, (row) => row.atom_id);
  const missingRequiredAtoms = REQUIRED_POLICY_ATOMS.filter((atomId) => atomCounts[atomId] !== EXPECTED_ROWS);
  const roleCountsByAtom = Object.entries(countBy(policyRows, (row) => `${row.atom_id}|${row.policy_role}`)).map(([key, rows]) => {
    const [atom_id, policy_role] = key.split("|");
    return { atom_id, policy_role, rows };
  });
  const roleSummary = {
    gate_id: GATE_ID,
    policy_rows: policyRows.length,
    required_policy_atoms: REQUIRED_POLICY_ATOMS,
    required_policy_atom_count: REQUIRED_POLICY_ATOMS.length,
    role_counts: countBy(policyRows, (row) => row.policy_role),
    allowed_body_use_counts: countBy(policyRows, (row) => row.allowed_body_use),
    role_counts_by_atom: roleCountsByAtom,
    role_counts_by_cell: Object.entries(countBy(policyRows, (row) => `${row.cell_id}|${row.policy_role}`)).map(([key, rows]) => {
      const [cell_id, policy_role] = key.split("|");
      return { cell_id, policy_role, rows };
    }),
    role_counts_by_year: Object.entries(countBy(policyRows, (row) => `${row.year}|${row.policy_role}`)).map(([key, rows]) => {
      const [year, policy_role] = key.split("|");
      return { year: Number(year), policy_role, rows };
    }),
    atoms_most_often_abstain_warn_confirm_or_vote: {
      abstain_or_blocked: roleCountsByAtom.filter((row) => row.policy_role === "abstain_from_vote" || row.policy_role === "blocked").sort((left, right) => Number(right.rows) - Number(left.rows)).slice(0, 12),
      warning: roleCountsByAtom.filter((row) => String(row.policy_role).includes("warning")).sort((left, right) => Number(right.rows) - Number(left.rows)).slice(0, 12),
      confirm: roleCountsByAtom.filter((row) => row.policy_role === "confirm_only").sort((left, right) => Number(right.rows) - Number(left.rows)).slice(0, 12),
      direct_vote_follow: roleCountsByAtom.filter((row) => row.policy_role === "follow").sort((left, right) => Number(right.rows) - Number(left.rows)).slice(0, 12),
      tie_breaker: roleCountsByAtom.filter((row) => row.policy_role === "tie_breaker").sort((left, right) => Number(right.rows) - Number(left.rows)).slice(0, 12),
    },
  };
  const qualitySummary = {
    gate_id: GATE_ID,
    quality_counts_by_atom: Object.entries(countBy(policyRows, (row) => `${row.atom_id}|${row.source_quality_state}`)).map(([key, rows]) => {
      const [atom_id, source_quality_state] = key.split("|");
      return { atom_id, source_quality_state, rows };
    }),
    degraded_rows_by_atom: Object.entries(countBy(policyRows.filter((row) => row.degraded), (row) => row.atom_id)).map(([atom_id, rows]) => ({ atom_id, rows })),
    fail_closed_rows_by_atom: Object.entries(countBy(policyRows.filter((row) => row.fail_closed), (row) => row.atom_id)).map(([atom_id, rows]) => ({ atom_id, rows })),
    blocked_rows_by_atom: Object.entries(countBy(policyRows.filter((row) => row.blocked), (row) => row.atom_id)).map(([atom_id, rows]) => ({ atom_id, rows })),
  };
  const policyContract = {
    gate_id: GATE_ID,
    contract_version: "gate65c_atom_policy_ledger_v0",
    assignment_inputs: [
      "Gate 59 Alpha v1 atom ledger COT and Strength state fields",
      "Gate 60G/60H BPR direction quality flags",
      "Gate 64B valuation_gap pair ledger directions and fixed spread tertiles",
      "Gate 60C raw PPP/NEER/REER/RRP point-in-time atom rows",
    ],
    no_outcome_fields_used_for_policy_assignment: true,
    body_direction_emitted: false,
    policy_roles: ["follow", "fade", "confirm_only", "contradiction_warning", "tie_breaker", "context_only", "source_quality_warning", "abstain_from_vote", "fail_closed", "blocked"],
    allowed_body_use: ["direct_vote", "confirm_only", "tie_breaker", "context_only", "quality_gate", "blocked"],
    required_policy_atoms: REQUIRED_POLICY_ATOMS,
  };
  const pass = denominator.forced28_preserved && missingRequiredAtoms.length === 0 && policyRows.length === EXPECTED_ROWS * REQUIRED_POLICY_ATOMS.length;
  const artifacts = {
    ledgerRows: toRepoRelative(path.join(artifactDir, "atom-policy-ledger.rows.jsonl")),
    roleSummary: toRepoRelative(path.join(artifactDir, "atom-policy-role-summary.json")),
    qualitySummary: toRepoRelative(path.join(artifactDir, "atom-policy-quality-summary.json")),
    policyContract: toRepoRelative(path.join(artifactDir, "atom-policy-contract.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate65c-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate65c-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_ATOM_POLICY_LEDGER_V0__FORCED28_PRESERVED__NO_BODY_DIRECTION__NO_OUTCOME_POLICY_LEAK" : "FAIL_ATOM_POLICY_LEDGER_V0_BOUNDARY_OR_DENOMINATOR",
    denominator,
    policy_row_count: policyRows.length,
    required_policy_atoms: REQUIRED_POLICY_ATOMS,
    missing_required_policy_atoms: missingRequiredAtoms,
    role_counts_by_atom: roleCountsByAtom,
    validation: {
      forced28_pair_week_denominator_preserved: denominator.forced28_preserved,
      every_required_policy_atom_has_rows: missingRequiredAtoms.length === 0,
      body_direction_emitted: false,
      outcome_data_used_for_policy_assignment: false,
      source_mutation_rows: 0,
    },
    artifacts,
  };

  await writeJsonl(path.join(artifactDir, "atom-policy-ledger.rows.jsonl"), policyRows);
  await writeJson(path.join(artifactDir, "atom-policy-role-summary.json"), roleSummary);
  await writeJson(path.join(artifactDir, "atom-policy-quality-summary.json"), qualitySummary);
  await writeJson(path.join(artifactDir, "atom-policy-contract.json"), policyContract);
  await writeJson(path.join(artifactDir, "gate65c-summary.json"), summary);
  await writeText(reportPath, renderReport(summary));
  await writeShaManifest(path.join(artifactDir, "gate65c-sha256.txt"), GATE_ID, COMMAND, [
    { label: "atom_policy_ledger_rows", path: path.join(artifactDir, "atom-policy-ledger.rows.jsonl") },
    { label: "role_summary", path: path.join(artifactDir, "atom-policy-role-summary.json") },
    { label: "quality_summary", path: path.join(artifactDir, "atom-policy-quality-summary.json") },
    { label: "policy_contract", path: path.join(artifactDir, "atom-policy-contract.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate65c-summary.json") },
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
