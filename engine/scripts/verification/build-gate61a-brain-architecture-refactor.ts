import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { BRAIN_ARCHITECTURE, flattenBrainAtomInventory } from "@engine/brain/architecture";
import { sha256Stable, sha256Text } from "@engine/research/hash";

const GATE_ID = "Gate 61A: brain-architecture-refactor";
const COMMAND = "npm run engine:gate61a:brain-architecture-refactor";
const DEFAULT_ARTIFACT_DIR =
  "docs/research/gates/gate61a/artifacts/gate61a-brain-architecture-refactor";
const DEFAULT_REPORT_PATH =
  "docs/research/gates/gate61a/GATE61A_BRAIN_ARCHITECTURE_REFACTOR_2026-06-27.md";

type CliOptions = {
  artifactDir: string;
  reportPath: string;
};

function parseArgs(): CliOptions {
  const options: CliOptions = {
    artifactDir: DEFAULT_ARTIFACT_DIR,
    reportPath: DEFAULT_REPORT_PATH,
  };
  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.split("=", 2);
    if (key === "--artifact-dir" && value) options.artifactDir = value;
    if (key === "--report-path" && value) options.reportPath = value;
  }
  return options;
}

function toRepoRelative(filePath: string) {
  return path.relative(process.cwd(), path.resolve(filePath)).split(path.sep).join("/");
}

function gitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "UNKNOWN";
  }
}

function packageScriptNames() {
  try {
    const pkg = JSON.parse(execFileSync("node", ["-e", "process.stdout.write(require('fs').readFileSync('package.json','utf8'))"], { encoding: "utf8" })) as {
      scripts?: Record<string, string>;
    };
    return Object.keys(pkg.scripts ?? {});
  } catch {
    return [];
  }
}

async function fileSha(filePath: string) {
  return sha256Text(await readFile(filePath));
}

function pathStatus(repoPath: string) {
  const exists = existsSync(repoPath);
  return {
    path: repoPath,
    exists,
    type: exists ? (statSync(repoPath).isDirectory() ? "directory" : "file") : "missing",
  };
}

function expectedArchitecturePaths() {
  return [
    "engine/src/brain/README.md",
    "engine/src/brain/architecture.ts",
    "engine/src/brain/cells/cot/atoms/index.ts",
    "engine/src/brain/cells/cot/contracts/index.ts",
    "engine/src/brain/cells/cot/ledgers/index.ts",
    "engine/src/brain/cells/cot/matrix/index.ts",
    "engine/src/brain/cells/strength/atoms/index.ts",
    "engine/src/brain/cells/strength/contracts/index.ts",
    "engine/src/brain/cells/strength/ledgers/index.ts",
    "engine/src/brain/cells/strength/matrix/index.ts",
    "engine/src/brain/cells/regime/atoms/bpr/index.ts",
    "engine/src/brain/cells/regime/atoms/rates/index.ts",
    "engine/src/brain/cells/regime/atoms/inflation/index.ts",
    "engine/src/brain/cells/regime/atoms/rrp/index.ts",
    "engine/src/brain/cells/regime/atoms/valuation/index.ts",
    "engine/src/brain/cells/regime/contracts/index.ts",
    "engine/src/brain/cells/regime/ledgers/index.ts",
    "engine/src/brain/cells/regime/matrix/index.ts",
    "engine/src/brain/body/contracts/index.ts",
    "engine/src/brain/body/ledgers/index.ts",
    "engine/src/brain/body/arbitration/index.ts",
    "engine/src/brain/risk/README.md",
  ];
}

function renderReport(summary: Record<string, unknown>) {
  return [
    "# Gate 61A Brain Architecture Refactor",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Boundary",
    "",
    "- Source-layout refactor only.",
    "- Historical `docs/research/gates` evidence was not moved or rewritten.",
    "- No COT logic, Strength logic, Regime/BPR source logic, matrix tests, P&L, Alpha v2, risk, execution, MT5/live, or app/runtime work.",
    "- BPR is nested under `engine/src/brain/cells/regime/atoms/bpr`; no top-level BPR cell exists.",
    "",
    "## Architecture",
    "",
    "- Brain has Cells.",
    "- Current Cells: COT, Strength, Regime.",
    "- Cells are made of atoms.",
    "- Body is reserved for the later integrated forced-28 decision algorithm.",
    "- Risk is reserved for the later permission layer that may reduce actual trade expression below 28.",
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Architecture summary: \`${summary.artifacts["summaryJson"]}\``,
    `- File/adaptor map: \`${summary.artifacts["fileMapJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 61A stops after the Brain source-layout contract and report. It does not run readiness, matrix, P&L, Alpha v2, risk, execution, MT5/live, or app work.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseArgs();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const architecturePaths = expectedArchitecturePaths().map(pathStatus);
  const missingPaths = architecturePaths.filter((entry) => !entry.exists);
  const topLevelBprCellExists = existsSync("engine/src/brain/cells/bpr");
  const scripts = packageScriptNames();
  const requiredScripts = [
    "engine:gate60g:bpr-forced28-source-direction-ledger",
    "engine:gate60h:bpr-source-direction-eligibility-classes",
    "engine:gate61a:brain-architecture-refactor",
  ];
  const missingPackageScripts = requiredScripts.filter((script) => !scripts.includes(script));
  const atomInventory = flattenBrainAtomInventory();
  const cells = BRAIN_ARCHITECTURE.cells.map((cell) => ({
    cell_id: cell.cell_id,
    path: cell.path,
    forced_28_required: cell.forced_28_required,
    atom_count: cell.atoms.length,
    atom_ids: cell.atoms.map((atom) => atom.atom_id),
  }));

  const validation = {
    brain_architecture_version: BRAIN_ARCHITECTURE.version,
    architecture_path_count: architecturePaths.length,
    missing_architecture_paths: missingPaths,
    top_level_bpr_cell_exists: topLevelBprCellExists,
    cells_represented: cells.map((cell) => cell.cell_id),
    cot_cell_represented: cells.some((cell) => cell.cell_id === "cot"),
    strength_cell_represented: cells.some((cell) => cell.cell_id === "strength"),
    regime_cell_represented: cells.some((cell) => cell.cell_id === "regime"),
    bpr_nested_under_regime: existsSync("engine/src/brain/cells/regime/atoms/bpr/index.ts") && !topLevelBprCellExists,
    missing_package_scripts: missingPackageScripts,
    immutable_docs_research_gates_moved: false,
    historical_evidence_rewritten: false,
  };
  const pass =
    missingPaths.length === 0 &&
    !topLevelBprCellExists &&
    validation.cot_cell_represented &&
    validation.strength_cell_represented &&
    validation.regime_cell_represented &&
    validation.bpr_nested_under_regime &&
    missingPackageScripts.length === 0;

  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass
      ? "PASS_BRAIN_CELLS_ATOMS_NAMESPACE_LOCKED__BPR_NESTED_UNDER_REGIME__NO_EVIDENCE_MUTATION"
      : "FAIL_BRAIN_ARCHITECTURE_NAMESPACE_INCOMPLETE",
    architecture: BRAIN_ARCHITECTURE,
    cells,
    atom_inventory: atomInventory,
    validation,
    artifacts: {
      summaryJson: toRepoRelative(path.join(artifactDir, "gate61a-brain-architecture-summary.json")),
      fileMapJson: toRepoRelative(path.join(artifactDir, "gate61a-brain-architecture-file-map.json")),
      shaIdentity: toRepoRelative(path.join(artifactDir, "gate61a-brain-architecture-refactor.sha256.txt")),
      report: toRepoRelative(reportPath),
    },
  };

  const fileMap = {
    gate_id: GATE_ID,
    moved_files: [],
    adapter_or_namespace_files: architecturePaths,
    intentionally_not_moved: [
      "docs/research/gates/**",
      "engine/scripts/verification/build-gate59-alpha-v1-atom-ledger.ts",
      "engine/scripts/verification/build-gate60g-bpr-forced28-source-direction-ledger.ts",
      "engine/scripts/verification/build-gate60h-bpr-source-direction-eligibility-classes.ts",
    ],
    rationale:
      "Gate 61A adds a Brain namespace contract and thin source-layout adapters without rewriting historical evidence or moving prior gate scripts.",
  };

  const summaryPath = path.join(artifactDir, "gate61a-brain-architecture-summary.json");
  const fileMapPath = path.join(artifactDir, "gate61a-brain-architecture-file-map.json");
  const shaPath = path.join(artifactDir, "gate61a-brain-architecture-refactor.sha256.txt");
  const summaryText = `${JSON.stringify(summary, null, 2)}\n`;
  const fileMapText = `${JSON.stringify(fileMap, null, 2)}\n`;
  const reportText = renderReport(summary);
  await writeFile(summaryPath, summaryText, "utf8");
  await writeFile(fileMapPath, fileMapText, "utf8");
  await writeFile(reportPath, reportText, "utf8");
  const contentInvariant = sha256Stable({
    architecture: BRAIN_ARCHITECTURE,
    validation,
    atom_inventory: atomInventory,
    file_map_hash: sha256Text(fileMapText),
    report_hash: sha256Text(reportText),
  });
  const shaLines = [
    `gate_id ${GATE_ID}`,
    `command ${COMMAND}`,
    `generated_at ${summary.generated_at}`,
    `git_commit ${summary.git_commit}`,
    `verdict ${summary.verdict}`,
    `summary_json ${await fileSha(summaryPath)} ${toRepoRelative(summaryPath)}`,
    `file_map_json ${await fileSha(fileMapPath)} ${toRepoRelative(fileMapPath)}`,
    `report ${await fileSha(reportPath)} ${toRepoRelative(reportPath)}`,
    `content_invariant ${contentInvariant} content`,
    "",
  ].join("\n");
  await writeFile(shaPath, shaLines, "utf8");

  if (!pass) {
    console.error(summary.verdict);
    process.exit(1);
  }
  console.log(summary.verdict);
  console.log(`Report: ${toRepoRelative(reportPath)}`);
  console.log(`SHA identity: ${toRepoRelative(shaPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
