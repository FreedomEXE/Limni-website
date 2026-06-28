import { mkdir } from "node:fs/promises";
import path from "node:path";

import { BRAIN_ARCHITECTURE, flattenBrainAtomInventory } from "@engine/brain/architecture";

import {
  DEFAULT_GATE61A_DIR,
  DEFAULT_GATE64A_DIR,
  DEFAULT_GATE64B_DIR,
  DEFAULT_GATE64C_DIR,
  denominatorSummary,
  fileHash,
  GATE65_DATE,
  gitCommit,
  loadAlphaRows,
  parseArgMap,
  readJson,
  renderTable,
  toRepoRelative,
  writeJson,
  writeShaManifest,
  writeText,
} from "./gate65-utils";

const GATE_ID = "Gate 65A: brain-atom-contract-v2-sync";
const COMMAND = "npm run engine:gate65a:brain-atom-contract-v2-sync";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate65a/artifacts/gate65a-brain-atom-contract-v2-sync";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate65a/GATE65A_BRAIN_ATOM_CONTRACT_V2_SYNC_${GATE65_DATE}.md`;

type FormulaContractsFile = {
  formula_contracts: Array<{
    formula_id: string;
    formula_version: string | null;
    status: "emitted" | "fail_closed";
    label: string;
    fail_closed_reason: string | null;
  }>;
};

type Gate61aSummary = {
  architecture?: {
    version: string;
    cells: Array<{ cell_id: string; atoms: Array<{ atom_id: string }> }>;
    body?: Record<string, unknown>;
    final_algorithm_status?: string;
    final_algorithm_name?: string | null;
    risk?: Record<string, unknown>;
  };
};

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate61aDir: args.get("--gate61a-dir") ?? DEFAULT_GATE61A_DIR,
    gate64aDir: args.get("--gate64a-dir") ?? DEFAULT_GATE64A_DIR,
    gate64bDir: args.get("--gate64b-dir") ?? DEFAULT_GATE64B_DIR,
    gate64cDir: args.get("--gate64c-dir") ?? DEFAULT_GATE64C_DIR,
  };
}

function atomIdsFromGate61A(summary: Gate61aSummary) {
  return new Set((summary.architecture?.cells ?? []).flatMap((cell) => cell.atoms.map((atom) => atom.atom_id)));
}

function renderReport(summary: Record<string, unknown>, contractRows: Array<Record<string, unknown>>) {
  const visibleRows = contractRows.filter((row) => String(row.cell_id) === "regime");
  return [
    "# Gate 65A Brain Atom Contract v2 Sync",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Contract sync only.",
    "- Gate 64B valuation-gap emitted formulas are now contract-visible Regime derived atoms.",
    "- Gate 64B fail-closed valuation-gap variants remain explicit fail-closed formula entries.",
    "- No historical Gate 59-64 artifacts were rewritten.",
    "- The final forced-28 decision algorithm remains unnamed and reserved for a future gate.",
    "- Risk remains a later portfolio permission/expression layer.",
    "",
    "## Regime Contract Surface",
    "",
    renderTable(
      visibleRows.map((row) => ({
        atom_id: row.atom_id,
        class: row.atom_class,
        status: row.status,
        source_gate: row.source_gate,
        role: row.forced_28_role,
      })),
      ["atom_id", "class", "status", "source_gate", "role"],
    ),
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Brain Atom Contract v2: \`${summary.artifacts["contractJson"]}\``,
    `- Diff vs Gate 61A: \`${summary.artifacts["diffJson"]}\``,
    `- Valuation-gap sync report: \`${summary.artifacts["syncReport"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 65A stops at contract sync. It does not start final forced-28 algorithm design, Alpha v2, risk, execution, app/runtime work, source mutation, or optimization.",
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
  const gate61aSummary = await readJson<Gate61aSummary>(path.join(options.gate61aDir, "gate61a-brain-architecture-summary.json"));
  const expectedInventory = await readJson<Record<string, unknown>>(path.join(options.gate64aDir, "expected-atom-inventory.contract.json"));
  const gate64aMissing = await readJson<Record<string, unknown>>(path.join(options.gate64aDir, "missing-atom-report.json"));
  const formulaContracts = await readJson<FormulaContractsFile>(path.join(options.gate64bDir, "valuation-gap-formula-contracts.json"));
  const gate64cSummary = await readJson<Record<string, unknown>>(path.join(options.gate64cDir, "gate64c-summary.json"));

  const contractRows = flattenBrainAtomInventory().map((atom) => ({
    ...atom,
    contract_version: BRAIN_ARCHITECTURE.version,
  }));
  const gate61aAtomIds = atomIdsFromGate61A(gate61aSummary);
  const currentAtomIds = new Set(contractRows.map((row) => row.atom_id));
  const addedAtoms = contractRows.filter((row) => !gate61aAtomIds.has(row.atom_id));
  const removedAtoms = [...gate61aAtomIds].filter((atomId) => !currentAtomIds.has(atomId));
  const valuationContracts = formulaContracts.formula_contracts.filter((contract) => contract.formula_id.startsWith("valuation_gap_"));
  const emittedFormulaIds = valuationContracts.filter((contract) => contract.status === "emitted").map((contract) => contract.formula_id);
  const failClosedFormulaIds = valuationContracts.filter((contract) => contract.status === "fail_closed").map((contract) => contract.formula_id);
  const emittedVisible = emittedFormulaIds.every((formulaId) => currentAtomIds.has(formulaId));
  const failClosedVisible = failClosedFormulaIds.every((formulaId) => {
    const atom = contractRows.find((row) => row.atom_id === formulaId);
    return atom?.atom_class === "fail_closed" && atom.status === "fail_closed";
  });
  const denominator = denominatorSummary(alphaRows);
  const finalAlgorithmReserved =
    BRAIN_ARCHITECTURE.final_algorithm_name === null &&
    BRAIN_ARCHITECTURE.final_algorithm_status === "reserved_for_future_gate" &&
    BRAIN_ARCHITECTURE.forced28_decision_truth.final_algorithm_started === false;
  const riskReserved =
    BRAIN_ARCHITECTURE.risk.status.includes("reserved") &&
    BRAIN_ARCHITECTURE.risk.risk_may_reduce_expression_later === true &&
    BRAIN_ARCHITECTURE.risk.risk_may_mutate_forced28_decision_truth === false;
  const pass = emittedVisible && failClosedVisible && denominator.forced28_preserved && finalAlgorithmReserved && riskReserved && removedAtoms.length === 0;

  const artifacts = {
    contractJson: toRepoRelative(path.join(artifactDir, "brain-atom-contract-v2.json")),
    diffJson: toRepoRelative(path.join(artifactDir, "brain-atom-contract-v2-diff-vs-gate61a.json")),
    syncReport: toRepoRelative(path.join(artifactDir, "valuation-gap-architecture-sync-report.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate65a-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate65a-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const diff = {
    gate_id: GATE_ID,
    previous_version: gate61aSummary.architecture?.version ?? "unknown",
    current_version: BRAIN_ARCHITECTURE.version,
    added_atoms: addedAtoms,
    removed_atoms: removedAtoms,
    changed_boundary: {
      deprecated_intermediate_layer: { previous: gate61aSummary.architecture?.body ?? null, current: null },
      final_algorithm: {
        previous_status: gate61aSummary.architecture?.final_algorithm_status ?? null,
        current_status: BRAIN_ARCHITECTURE.final_algorithm_status,
        current_name: BRAIN_ARCHITECTURE.final_algorithm_name,
      },
      risk: { previous: gate61aSummary.architecture?.risk ?? null, current: BRAIN_ARCHITECTURE.risk },
    },
  };
  const syncReport = {
    gate_id: GATE_ID,
    expected_inventory_source: toRepoRelative(path.join(options.gate64aDir, "expected-atom-inventory.contract.json")),
    expected_inventory_hash: await fileHash(path.join(options.gate64aDir, "expected-atom-inventory.contract.json")),
    gate64a_missing_atom_report: gate64aMissing,
    gate64b_formula_contracts: valuationContracts,
    emitted_formula_ids: emittedFormulaIds,
    fail_closed_formula_ids: failClosedFormulaIds,
    emitted_formula_ids_visible_in_brain_contract: emittedVisible,
    fail_closed_formula_ids_visible_in_brain_contract: failClosedVisible,
    gate64c_denominator: gate64cSummary["denominator"],
    contract_denominator: denominator,
    historical_evidence_rewritten: false,
    final_algorithm_started: false,
    risk_started: false,
    alpha_v2_started: false,
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass
      ? "PASS_BRAIN_ATOM_CONTRACT_V2_SYNC__VALUATION_GAP_VISIBLE__FAIL_CLOSED_VARIANTS_EXPLICIT__FORCED28_UNCHANGED"
      : "FAIL_BRAIN_ATOM_CONTRACT_V2_SYNC_BOUNDARY_BROKEN",
    brain_architecture_version: BRAIN_ARCHITECTURE.version,
    denominator,
    validation: {
      emitted_valuation_gap_formulas_visible: emittedVisible,
      fail_closed_valuation_gap_variants_visible: failClosedVisible,
      removed_gate61a_atoms: removedAtoms,
      final_algorithm_reserved: finalAlgorithmReserved,
      risk_reserved: riskReserved,
      forced28_preserved: denominator.forced28_preserved,
      historical_evidence_rewritten: false,
      final_algorithm_started: false,
      risk_started: false,
      alpha_v2_started: false,
    },
    artifacts,
    expected_inventory_snapshot: expectedInventory,
  };

  await writeJson(path.join(artifactDir, "brain-atom-contract-v2.json"), {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: summary.generated_at,
    architecture: BRAIN_ARCHITECTURE,
    atom_inventory: contractRows,
  });
  await writeJson(path.join(artifactDir, "brain-atom-contract-v2-diff-vs-gate61a.json"), diff);
  await writeJson(path.join(artifactDir, "valuation-gap-architecture-sync-report.json"), syncReport);
  await writeJson(path.join(artifactDir, "gate65a-summary.json"), summary);
  await writeText(reportPath, renderReport(summary, contractRows));
  await writeShaManifest(path.join(artifactDir, "gate65a-sha256.txt"), GATE_ID, COMMAND, [
    { label: "contract_json", path: path.join(artifactDir, "brain-atom-contract-v2.json") },
    { label: "diff_json", path: path.join(artifactDir, "brain-atom-contract-v2-diff-vs-gate61a.json") },
    { label: "sync_report", path: path.join(artifactDir, "valuation-gap-architecture-sync-report.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate65a-summary.json") },
    { label: "report", path: reportPath },
  ]);

  if (!pass) {
    throw new Error(summary.verdict);
  }
  console.log(summary.verdict);
  console.log(JSON.stringify({ artifacts: summary.artifacts, validation: summary.validation }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
