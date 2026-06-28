import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { BRAIN_ARCHITECTURE, BRAIN_ARCHITECTURE_VERSION, flattenBrainAtomInventory } from "@engine/brain/architecture";

import {
  GATE66_DATE,
  gitCommit,
  parseArgMap,
  readJson,
  renderTable,
  toRepoRelative,
  writeJson,
  writeShaManifest,
  writeText,
} from "./gate66-utils";

const GATE_ID = "Gate 66B: brain-architecture-contract-v3";
const COMMAND = "npm run engine:gate66b:brain-architecture-contract-v3";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate66b/artifacts/gate66b-brain-architecture-contract-v3";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate66b/GATE66B_BRAIN_ARCHITECTURE_CONTRACT_V3_NO_DEPRECATED_LAYER_${GATE66_DATE}.md`;
const DEFAULT_GATE65A_CONTRACT = "docs/research/gates/gate65a/artifacts/gate65a-brain-atom-contract-v2-sync/brain-atom-contract-v2.json";

type Gate65aContract = {
  architecture?: Record<string, unknown>;
  atom_inventory?: unknown[];
};

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    previousContractPath: args.get("--previous-contract") ?? DEFAULT_GATE65A_CONTRACT,
  };
}

function renderReport(summary: Record<string, unknown>) {
  const cellRows = BRAIN_ARCHITECTURE.cells.map((cell) => ({
    cell_id: cell.cell_id,
    path: cell.path,
    atom_count: cell.atoms.length,
    forced_28_required: cell.forced_28_required,
  }));
  return [
    "# Gate 66B Brain Architecture Contract v3",
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
    "- The final forced-28 decision algorithm is unnamed and reserved for a future gate.",
    "- Risk remains a later portfolio expression layer and cannot mutate Brain forced-28 decision truth.",
    "",
    renderTable(cellRows, ["cell_id", "path", "atom_count", "forced_28_required"]),
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Contract v3: \`${summary.artifacts["contractJson"]}\``,
    `- v2 to v3 diff: \`${summary.artifacts["diffJson"]}\``,
    `- Active source change ledger: \`${summary.artifacts["activeSourceChangeLedger"]}\``,
    `- Removed or renamed paths: \`${summary.artifacts["removedOrRenamedPaths"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 66B stops at architecture contract v3. It does not start final forced-28 algorithm design, Alpha v2, risk, exits, execution, app/runtime work, source mutation, retuning, optimized threshold search, learned weights, pair exclusions, or date exclusions.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const previousContract = await readJson<Gate65aContract>(options.previousContractPath);
  const atomInventory = flattenBrainAtomInventory();
  const contractHasDeprecatedLayer = Object.prototype.hasOwnProperty.call(BRAIN_ARCHITECTURE, "body");
  const deprecatedNamespaceExists = existsSync(path.resolve("engine/src/brain/body"));
  const cells = BRAIN_ARCHITECTURE.cells.map((cell) => cell.cell_id).sort();
  const pass =
    BRAIN_ARCHITECTURE_VERSION === "gate66_brain_cells_atoms_v3" &&
    BRAIN_ARCHITECTURE.architecture_version === "gate66_brain_cells_atoms_v3" &&
    BRAIN_ARCHITECTURE.hierarchy === "Brain -> Cells -> Atoms" &&
    BRAIN_ARCHITECTURE.deprecated_terms_removed_from_active_contracts === true &&
    !contractHasDeprecatedLayer &&
    !deprecatedNamespaceExists &&
    JSON.stringify(cells) === JSON.stringify(["cot", "regime", "strength"]) &&
    BRAIN_ARCHITECTURE.final_algorithm_name === null &&
    BRAIN_ARCHITECTURE.final_algorithm_status === "reserved_for_future_gate" &&
    BRAIN_ARCHITECTURE.forced28_decision_required === true &&
    BRAIN_ARCHITECTURE.forced28_decision_truth.final_algorithm_started === false &&
    BRAIN_ARCHITECTURE.risk.risk_may_reduce_expression_later === true &&
    BRAIN_ARCHITECTURE.risk.risk_may_mutate_forced28_decision_truth === false;

  const activeSourceChangeLedger = [
    {
      path: "engine/src/brain/architecture.ts",
      change: "promoted active contract to gate66_brain_cells_atoms_v3; removed deprecated intermediate layer; reserved unnamed final forced-28 algorithm.",
    },
    {
      path: "engine/src/brain/README.md",
      change: "updated active architecture prose to Brain -> Cells -> Atoms and risk as later portfolio expression.",
    },
    {
      path: "engine/scripts/verification/build-gate65a-brain-atom-contract-v2-sync.ts",
      change: "compatibility update so the historical Gate 65A builder reads the v3 neutral final-algorithm boundary if rerun.",
    },
  ];
  const removedOrRenamedPaths = [
    {
      previous_path: "engine/src/brain/body/arbitration/index.ts",
      current_path: null,
      reason: "deprecated placeholder namespace removed; no active imports.",
    },
    {
      previous_path: "engine/src/brain/body/contracts/index.ts",
      current_path: null,
      reason: "deprecated placeholder namespace removed; no active imports.",
    },
    {
      previous_path: "engine/src/brain/body/ledgers/index.ts",
      current_path: null,
      reason: "deprecated placeholder namespace removed; no active imports.",
    },
  ];
  const artifacts = {
    contractJson: toRepoRelative(path.join(artifactDir, "brain-architecture-v3.contract.json")),
    diffJson: toRepoRelative(path.join(artifactDir, "architecture-v2-to-v3-diff.json")),
    activeSourceChangeLedger: toRepoRelative(path.join(artifactDir, "active-source-change-ledger.json")),
    removedOrRenamedPaths: toRepoRelative(path.join(artifactDir, "removed-or-renamed-paths.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate66b-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate66b-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const diff = {
    gate_id: GATE_ID,
    previous_contract_path: toRepoRelative(options.previousContractPath),
    previous_architecture_version: previousContract.architecture?.["version"] ?? null,
    current_architecture_version: BRAIN_ARCHITECTURE.architecture_version,
    removed_contract_keys: ["body"],
    added_contract_keys: [
      "architecture_version",
      "hierarchy",
      "deprecated_terms_removed_from_active_contracts",
      "final_algorithm_name",
      "final_algorithm_status",
      "final_algorithm_placeholder",
      "forced28_decision_required",
      "forced28_decision_truth",
    ],
    preserved_cells: cells,
    previous_atom_count: previousContract.atom_inventory?.length ?? null,
    current_atom_count: atomInventory.length,
    final_algorithm_name: BRAIN_ARCHITECTURE.final_algorithm_name,
    final_algorithm_status: BRAIN_ARCHITECTURE.final_algorithm_status,
    risk_boundary: BRAIN_ARCHITECTURE.risk,
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass
      ? "PASS_BRAIN_ARCHITECTURE_CONTRACT_V3__BRAIN_CELLS_ATOMS_ONLY__FINAL_ALGORITHM_UNNAMED"
      : "FAIL_BRAIN_ARCHITECTURE_CONTRACT_V3_BOUNDARY_BROKEN",
    architecture_version: BRAIN_ARCHITECTURE.architecture_version,
    validation: {
      hierarchy: BRAIN_ARCHITECTURE.hierarchy,
      deprecated_terms_removed_from_active_contracts: BRAIN_ARCHITECTURE.deprecated_terms_removed_from_active_contracts,
      contract_has_deprecated_intermediate_layer: contractHasDeprecatedLayer,
      deprecated_namespace_exists: deprecatedNamespaceExists,
      cells,
      final_algorithm_name: BRAIN_ARCHITECTURE.final_algorithm_name,
      final_algorithm_status: BRAIN_ARCHITECTURE.final_algorithm_status,
      final_algorithm_started: BRAIN_ARCHITECTURE.forced28_decision_truth.final_algorithm_started,
      forced28_decision_required: BRAIN_ARCHITECTURE.forced28_decision_required,
      risk_may_reduce_expression_later: BRAIN_ARCHITECTURE.risk.risk_may_reduce_expression_later,
      risk_may_mutate_forced28_decision_truth: BRAIN_ARCHITECTURE.risk.risk_may_mutate_forced28_decision_truth,
      historical_artifacts_rewritten: false,
    },
    artifacts,
  };

  await writeJson(path.join(artifactDir, "brain-architecture-v3.contract.json"), {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: summary.generated_at,
    architecture: BRAIN_ARCHITECTURE,
    atom_inventory: atomInventory,
  });
  await writeJson(path.join(artifactDir, "architecture-v2-to-v3-diff.json"), diff);
  await writeJson(path.join(artifactDir, "active-source-change-ledger.json"), {
    gate_id: GATE_ID,
    changes: activeSourceChangeLedger,
  });
  await writeJson(path.join(artifactDir, "removed-or-renamed-paths.json"), {
    gate_id: GATE_ID,
    removed_or_renamed_paths: removedOrRenamedPaths,
  });
  await writeJson(path.join(artifactDir, "gate66b-summary.json"), summary);
  await writeText(reportPath, renderReport(summary));
  await writeShaManifest(path.join(artifactDir, "gate66b-sha256.txt"), GATE_ID, COMMAND, [
    { label: "contract_json", path: path.join(artifactDir, "brain-architecture-v3.contract.json") },
    { label: "diff_json", path: path.join(artifactDir, "architecture-v2-to-v3-diff.json") },
    { label: "active_source_change_ledger", path: path.join(artifactDir, "active-source-change-ledger.json") },
    { label: "removed_or_renamed_paths", path: path.join(artifactDir, "removed-or-renamed-paths.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate66b-summary.json") },
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
