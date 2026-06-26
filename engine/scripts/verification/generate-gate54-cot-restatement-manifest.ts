import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { getPool } from "@database/db/client";
import {
  buildGate54ClpCotRestatementManifest,
  GATE55E_PRICE_BUNDLE_ID,
  GATE56F_GATE_ID,
  validateGate54ClpManifestShape,
} from "@engine/signals/cot/gate54ClpManifest";
import { sha256Stable, sha256Text } from "@engine/research/hash";

type CliOptions = {
  outDir: string;
  receiptPath: string;
  expectedWeeks: number;
  expectedRows: number;
};

function argValue(name: string): string | null {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function helpText() {
  return `
Generate the Gate 56F locked Gate 54 CLP COT restatement manifest.

Common:
  --out-dir=<path>             Default: docs/research/gates/gate56/manifests
  --receipt-path=<path>        Default: docs/research/gates/gate56/receipts/GATE56F_GATE54_COT_RESTATEMENT_MANIFEST_BUILD_2026-06-26.md
  --expected-weeks=<n>         Default: 388
  --expected-rows=<n>          Default: 10864

This command emits and validates a frozen decision manifest only. It does not
score, retune COT, change CLP tie policy, create a COT evaluator, run Strength
buckets, run regimes, combine COT+Strength, optimize execution, add risk
overlays, or promote live/MT5 work.
`.trim();
}

function parseCli(): CliOptions {
  if (hasFlag("help") || hasFlag("h")) {
    console.log(helpText());
    process.exit(0);
  }
  return {
    outDir: argValue("out-dir") ?? path.join("docs", "research", "gates", "gate56", "manifests"),
    receiptPath: argValue("receipt-path") ?? path.join(
      "docs",
      "research",
      "gates",
      "gate56",
      "receipts",
      "GATE56F_GATE54_COT_RESTATEMENT_MANIFEST_BUILD_2026-06-26.md",
    ),
    expectedWeeks: parsePositiveInteger(argValue("expected-weeks"), 388),
    expectedRows: parsePositiveInteger(argValue("expected-rows"), 10864),
  };
}

function toRepoRelative(resolvedPath: string) {
  return path.relative(process.cwd(), resolvedPath).replace(/\\/g, "/");
}

function currentGitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function dirtyTreeStatus() {
  try {
    const status = execFileSync("git", ["status", "--short", "--untracked-files=all"], { encoding: "utf8" }).trim();
    return {
      status: status.length > 0 ? "dirty" : "clean",
      files: status ? status.split(/\r?\n/) : [],
    };
  } catch {
    return { status: "unknown", files: [] };
  }
}

function commandText() {
  return process.argv.join(" ");
}

function manifestPath(outDir: string) {
  return path.join(outDir, "gate56f-locked-gate54-clp-cot-restatement.manifest.json");
}

function renderReceipt(options: {
  generatedAtUtc: string;
  cli: CliOptions;
  manifestPath: string;
  manifestFileSha256: string;
  sourceSummaryHash: string;
  build: Awaited<ReturnType<typeof buildGate54ClpCotRestatementManifest>>;
  runtimeCommit: string;
  dirtyTree: ReturnType<typeof dirtyTreeStatus>;
}) {
  const lines = [
    "# Gate 56F Gate 54 COT Restatement Manifest Build",
    "",
    `Generated: ${options.generatedAtUtc}`,
    "",
    "## Result",
    "",
    `- Gate: ${GATE56F_GATE_ID}`,
    `- Price bundle ID: \`${GATE55E_PRICE_BUNDLE_ID}\``,
    `- Manifest: \`${options.manifestPath}\``,
    `- Manifest hash: \`${options.build.manifest.manifest_hash}\``,
    `- Manifest file SHA-256: \`${options.manifestFileSha256}\``,
    `- Config hash: \`${options.build.manifest.config_hash}\``,
    `- Source summary hash: \`${options.sourceSummaryHash}\``,
    `- Run-time git commit: \`${options.runtimeCommit}\``,
    `- Working tree status: \`${options.dirtyTree.status}\``,
    "",
    "## Shape Validation",
    "",
    `- Passed: ${options.build.shape.passed}`,
    `- Rows: ${options.build.shape.rows}/${options.cli.expectedRows}`,
    `- Weeks: ${options.build.shape.weeks}/${options.cli.expectedWeeks}`,
    `- First week: ${options.build.shape.firstWeek ?? "-"}`,
    `- Last week: ${options.build.shape.lastWeek ?? "-"}`,
    `- Long rows: ${options.build.shape.longRows}`,
    `- Short rows: ${options.build.shape.shortRows}`,
    `- Duplicate week/symbol rows: ${options.build.shape.duplicateRows.length}`,
    `- Non-full weeks: ${options.build.shape.nonFullWeeks.length}`,
    "",
    "## Source",
    "",
    `- Matrix dataset: ${options.build.source.dataset.dataset_id} / ${options.build.source.dataset.dataset_hash}`,
    `- COT report dates: ${options.build.source.lifecycle.snapshotCount}`,
    `- COT date range: ${options.build.source.lifecycle.firstStoredReportDate} -> ${options.build.source.lifecycle.lastStoredReportDate}`,
    `- CLP lifecycle lookback reports: ${options.build.source.lifecycle.lifecycleLookback}`,
    `- First lifecycle report date: ${options.build.source.lifecycle.lifecycleFirstReportDate}`,
    `- Missing metric windows: ${options.build.source.lifecycle.missingMetricWindows}`,
    `- Tie rows: ${options.build.source.tieCases.length}`,
    `- Carry-previous tie rows: ${options.build.source.tieCases.filter((row) => row.carryPreviousSide).length}`,
    "",
    "## Dirty Tree Files",
    "",
    ...(options.dirtyTree.files.length > 0 ? options.dirtyTree.files.map((file) => `- ${file}`) : ["- none"]),
    "",
    "## Command",
    "",
    "`npm run engine:gate54:cot-manifest -- --expected-weeks=388 --expected-rows=10864`",
    "",
    "Generated local command:",
    "",
    `\`${commandText()}\``,
    "",
    "## Boundary",
    "",
    "This command emits and validates a frozen COT decision manifest only. It does not score results, retune COT, change CLP carry-forward or tie-fill policy, create a COT-specific evaluator, run Strength buckets, run regime filters, combine COT+Strength, optimize execution, add risk overlays, or promote live/MT5 work.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  const started = Date.now();
  const cli = parseCli();
  const outDir = path.resolve(process.cwd(), cli.outDir);
  const receiptPath = path.resolve(process.cwd(), cli.receiptPath);
  const generatedAtUtc = new Date().toISOString();
  const runtimeCommit = currentGitCommit();
  const dirtyTree = dirtyTreeStatus();

  const build = await buildGate54ClpCotRestatementManifest();
  build.shape = validateGate54ClpManifestShape(build.manifest, cli.expectedWeeks, cli.expectedRows);

  const targetManifestPath = path.join(outDir, path.basename(manifestPath(outDir)));
  const manifestText = `${JSON.stringify(build.manifest, null, 2)}\n`;
  const sourceSummary = {
    weeks: build.source.weeks,
    policyRows: build.source.policyRows,
    tieCases: build.source.tieCases,
    lifecycle: build.source.lifecycle,
    shape: build.shape,
  };
  const sourceSummaryHash = sha256Stable(sourceSummary);
  const receiptWithoutHash = renderReceipt({
    generatedAtUtc,
    cli,
    manifestPath: toRepoRelative(targetManifestPath),
    manifestFileSha256: sha256Text(manifestText),
    sourceSummaryHash,
    build,
    runtimeCommit,
    dirtyTree,
  });
  const receiptHash = sha256Text(receiptWithoutHash);
  const receiptText = `${receiptWithoutHash}Runtime seconds: ${Math.round((Date.now() - started) / 100) / 10}\n\nReceipt hash: \`${receiptHash}\`\n`;

  await Promise.all([
    mkdir(outDir, { recursive: true }),
    mkdir(path.dirname(receiptPath), { recursive: true }),
  ]);

  await Promise.all([
    writeFile(targetManifestPath, manifestText, "utf8"),
    writeFile(receiptPath, receiptText, "utf8"),
  ]);

  if (!build.shape.passed) {
    console.error(`Gate 56F COT manifest shape failed. Receipt: ${toRepoRelative(receiptPath)}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Manifest: ${toRepoRelative(targetManifestPath)}`);
  console.log(`Manifest hash: ${build.manifest.manifest_hash}`);
  console.log(`Manifest file SHA-256: ${sha256Text(manifestText)}`);
  console.log(`Rows: ${build.shape.rows}`);
  console.log(`Weeks: ${build.shape.weeks}`);
  console.log(`Long rows: ${build.shape.longRows}`);
  console.log(`Short rows: ${build.shape.shortRows}`);
  console.log(`Receipt: ${toRepoRelative(receiptPath)}`);
  console.log(`Receipt hash: ${receiptHash}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // Pool may not have been created.
    }
    if (process.exitCode && process.exitCode !== 0) {
      process.exit(process.exitCode);
    }
  });
