import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { getPool } from "@/lib/db";
import {
  attachResearchDecisionManifestHash,
  assertResearchDecisionManifestHash,
  getResearchDecisionManifestIdentity,
  type ResearchDecisionManifest,
} from "@/lib/research/decisionManifest";
import {
  evaluateResearchDecisionManifest,
  RESEARCH_DECISION_EVALUATOR_VERSION,
  type ResearchDecisionEvaluatorId,
  type ResearchDecisionPathResolution,
} from "@/lib/research/decisionManifestEvaluator";
import { sha256Stable, sha256Text } from "@/lib/research/hash";
import {
  appendResearchRunRegistryEntry,
  buildResearchRunEquivalenceKey,
  findEquivalentResearchRun,
  hashResearchRunEquivalenceKey,
  readResearchRunRegistry,
  type ResearchRunRegistryStatus,
} from "@/lib/research/researchRunRegistry";

type CliOptions = {
  manifestPath: string;
  outDir: string;
  docsReceiptDir: string | null;
  noDocCopy: boolean;
  registryPath: string | null;
  artifactGate: string | null;
  priceBundleId: string | null;
  pathResolution: ResearchDecisionPathResolution;
  evaluators: ResearchDecisionEvaluatorId[];
  status: ResearchRunRegistryStatus;
  rerunReason: string | null;
  supersedes: string[];
  logProgress: boolean;
  clearRuntimeCacheBetweenWeeks: boolean;
  noRegistryWrite: boolean;
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

function parsePathResolution(raw: string | null): ResearchDecisionPathResolution {
  const value = (raw ?? "1m").trim().toLowerCase();
  if (value === "1m" || value === "m1") return "1m";
  if (value === "1h" || value === "h1") return "1h";
  throw new Error(`Unsupported --path-resolution value: ${raw}`);
}

function parseEvaluators(raw: string | null): ResearchDecisionEvaluatorId[] {
  const values = (raw ?? "adr_grid,weekly_hold")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const evaluators = values.map((value) => {
    if (value === "adr_grid" || value === "weekly_hold") return value;
    throw new Error(`Unsupported evaluator: ${value}`);
  });
  return Array.from(new Set(evaluators));
}

function parseStatus(raw: string | null): ResearchRunRegistryStatus {
  const value = (raw ?? "diagnostic").trim();
  if (
    value === "exploratory" ||
    value === "diagnostic" ||
    value === "blocked" ||
    value === "accepted" ||
    value === "superseded" ||
    value === "archived"
  ) {
    return value;
  }
  throw new Error(`Unsupported --status value: ${raw}`);
}

function parseCsv(raw: string | null) {
  return raw
    ? raw.split(",").map((value) => value.trim()).filter(Boolean)
    : [];
}

function helpText() {
  return `
Evaluate a ResearchDecisionManifest through the blessed research evaluator.

Required:
  --manifest=<path>                 ResearchDecisionManifest JSON.

Common:
  --out-dir=<path>                  Default: app/reports/data-verification/<gate>
  --artifact-gate=<gate55>          Output grouping. Default inferred from manifest gate_id.
  --price-bundle-id=<id>            Optional guard; must match manifest price_bundle_id.
  --path-resolution=1m|1h           Default: 1m.
  --evaluators=adr_grid,weekly_hold Default: both.
  --status=diagnostic|exploratory|blocked|accepted|superseded|archived
  --rerun-reason=<text>             Required to rerun a materially equivalent input.
  --registry-path=<path>            Default: <out-dir>/registry/research-run-registry.jsonl.
  --no-registry-write               Writes artifacts without registry append; not blessed for final evidence.
  --no-doc-copy                     Do not copy receipt into docs/research/gates/<gate>/receipts.
  --log-progress                    Print per-week scoring progress.
  --clear-runtime-cache-between-weeks

This command does not derive signals. It scores an already frozen decision manifest.
`.trim();
}

function parseCli(): CliOptions {
  if (hasFlag("help") || hasFlag("h")) {
    console.log(helpText());
    process.exit(0);
  }
  const manifestPath = argValue("manifest");
  if (!manifestPath) throw new Error("--manifest is required.");
  const artifactGate = argValue("artifact-gate");
  const outDir = argValue("out-dir") ?? "";
  return {
    manifestPath,
    outDir,
    docsReceiptDir: argValue("docs-receipt-dir"),
    noDocCopy: hasFlag("no-doc-copy"),
    registryPath: argValue("registry-path"),
    artifactGate,
    priceBundleId: argValue("price-bundle-id"),
    pathResolution: parsePathResolution(argValue("path-resolution")),
    evaluators: parseEvaluators(argValue("evaluators")),
    status: parseStatus(argValue("status")),
    rerunReason: argValue("rerun-reason"),
    supersedes: parseCsv(argValue("supersedes")),
    logProgress: hasFlag("log-progress"),
    clearRuntimeCacheBetweenWeeks: hasFlag("clear-runtime-cache-between-weeks"),
    noRegistryWrite: hasFlag("no-registry-write"),
  };
}

function slug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "research";
}

function inferArtifactGate(gateId: string) {
  const match = gateId.match(/gate\s*([0-9]+)/i);
  return match ? `gate${match[1]}` : slug(gateId);
}

function currentGitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" }).trim();
  } catch {
    return "UNKNOWN";
  }
}

function commandText() {
  return process.argv.join(" ");
}

async function readManifest(manifestPath: string) {
  const raw = await readFile(path.resolve(process.cwd(), manifestPath), "utf8");
  return JSON.parse(raw) as ResearchDecisionManifest;
}

function buildRunId(options: {
  artifactGate: string;
  hypothesisId: string;
  signalId: string;
  manifestHash: string;
}) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return [
    options.artifactGate,
    slug(options.hypothesisId),
    slug(options.signalId),
    stamp,
    options.manifestHash.slice(0, 8),
  ].join("-");
}

function renderReceipt(options: {
  runId: string;
  generatedAtUtc: string;
  command: string;
  gitCommit: string;
  result: Awaited<ReturnType<typeof evaluateResearchDecisionManifest>>;
  manifestPath: string;
  resultPath: string;
  hashesPath: string;
  registryPath: string | null;
  status: ResearchRunRegistryStatus;
  rerunReason: string | null;
}) {
  const lines = [
    `# ${options.result.manifest.gate_id} Research Decision Manifest Evaluation`,
    "",
    `Generated: ${options.generatedAtUtc}`,
    "",
    "## Result",
    "",
    `- Run ID: \`${options.runId}\``,
    `- Status: \`${options.status}\``,
    `- Hypothesis: \`${options.result.manifest.hypothesis_id}\``,
    `- Signal: \`${options.result.manifest.signal_id}\` / \`${options.result.manifest.signal_version}\``,
    `- Decision scope: \`${options.result.manifest.decision_scope}\``,
    `- Price bundle ID: \`${options.result.manifest.price_bundle_id}\``,
    `- Feature bundle ID: \`${options.result.manifest.feature_bundle_id ?? "-"}\``,
    `- Manifest hash: \`${options.result.manifest.manifest_hash}\``,
    `- Evaluator version: \`${options.result.evaluator.evaluator_version}\``,
    `- Evaluators: \`${options.result.evaluator.evaluators.join(",")}\``,
    `- Path resolution: \`${options.result.evaluator.path_resolution}\``,
    `- Git commit: \`${options.gitCommit}\``,
    `- Rerun reason: ${options.rerunReason ?? "-"}`,
    "",
    "## Coverage",
    "",
    `- Weeks: ${options.result.coverage.weeks}`,
    `- Universe symbols: ${options.result.coverage.universe_symbols}`,
    `- Decision rows: ${options.result.coverage.decision_rows}`,
    `- Long rows: ${options.result.coverage.long_rows}`,
    `- Short rows: ${options.result.coverage.short_rows}`,
    "",
    "## Metrics",
    "",
    "| Evaluator | Weeks | Rows | ADR | DD | R/DD | PF | Win rate | Missing price rows | Fills | TP | Reset | Week close |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...options.result.summaries.map((summary) =>
      `| ${summary.evaluator} | ${summary.weeks} | ${summary.decision_rows} | ${summary.total_adr.toFixed(4)} | ${summary.max_drawdown_adr.toFixed(4)} | ${summary.return_to_drawdown ?? "-"} | ${summary.profit_factor_adr ?? "-"} | ${summary.weekly_win_rate_active ?? "-"} | ${summary.missing_price_rows} | ${summary.fills ?? "-"} | ${summary.tp ?? "-"} | ${summary.reset ?? "-"} | ${summary.week_close ?? "-"} |`),
    "",
    "## Files",
    "",
    `- Manifest: ${options.manifestPath}`,
    `- Result: ${options.resultPath}`,
    `- Hashes: ${options.hashesPath}`,
    `- Registry: ${options.registryPath ?? "-"}`,
    "",
    "## Command",
    "",
    `\`${options.command}\``,
    "",
    "## Boundary",
    "",
    "This command scores a frozen manifest only. Signal derivation, bucket construction, regime filters, COT retuning, COT+Strength combination, execution optimization, risk overlays, live/MT5, and final system selection remain outside this receipt.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  const options = parseCli();
  const manifestInput = await readManifest(options.manifestPath);
  const manifestHash = assertResearchDecisionManifestHash(manifestInput);
  const manifest = attachResearchDecisionManifestHash(manifestInput);
  const identity = getResearchDecisionManifestIdentity(manifest);

  if (options.priceBundleId && options.priceBundleId !== identity.price_bundle_id) {
    throw new Error(`--price-bundle-id ${options.priceBundleId} does not match manifest price_bundle_id ${identity.price_bundle_id}.`);
  }

  const artifactGate = options.artifactGate ?? inferArtifactGate(identity.gate_id);
  const outDir = path.resolve(process.cwd(), options.outDir || path.join("app", "reports", "data-verification", artifactGate));
  const registryPath = options.noRegistryWrite
    ? null
    : path.resolve(process.cwd(), options.registryPath ?? path.join(outDir, "registry", "research-run-registry.jsonl"));

  const duplicateKey = buildResearchRunEquivalenceKey({
    input_manifest_hash: manifestHash,
    price_bundle_id: identity.price_bundle_id,
    feature_bundle_id: identity.feature_bundle_id,
    source_context_ids: identity.source_context_ids,
    evaluator_version: RESEARCH_DECISION_EVALUATOR_VERSION,
    evaluators: options.evaluators,
    path_resolution: options.pathResolution,
    config_hash: identity.config_hash,
  });
  const equivalenceKeyHash = hashResearchRunEquivalenceKey(duplicateKey);

  if (registryPath && !options.rerunReason) {
    const registry = await readResearchRunRegistry(registryPath);
    const duplicate = findEquivalentResearchRun(registry, duplicateKey);
    if (duplicate) {
      console.log(`Equivalent research run already exists: ${duplicate.run_id}`);
      console.log(`Receipt: ${duplicate.receipt_path}`);
      console.log(`Result: ${duplicate.result_path}`);
      console.log(`Equivalence key: ${duplicate.equivalence_key_hash}`);
      return;
    }
  }

  const runId = buildRunId({
    artifactGate,
    hypothesisId: identity.hypothesis_id,
    signalId: identity.signal_id,
    manifestHash,
  });

  const manifestPath = path.join(outDir, "manifests", `${runId}.manifest.json`);
  const resultPath = path.join(outDir, "results", `${runId}.result.json`);
  const receiptPath = path.join(outDir, "runs", `${runId}.receipt.md`);
  const hashesPath = path.join(outDir, "hashes", `${runId}.hashes.json`);
  const docsReceiptDir = options.docsReceiptDir
    ? path.resolve(process.cwd(), options.docsReceiptDir)
    : path.resolve(process.cwd(), "docs", "research", "gates", artifactGate, "receipts");
  const docsReceiptPath = options.noDocCopy ? null : path.join(docsReceiptDir, `${runId}.md`);

  const result = await evaluateResearchDecisionManifest({
    manifest,
    pathResolution: options.pathResolution,
    evaluators: options.evaluators,
    logProgress: options.logProgress,
    clearRuntimeCacheBetweenWeeks: options.clearRuntimeCacheBetweenWeeks,
  });

  const gitCommit = currentGitCommit();
  const generatedAtUtc = new Date().toISOString();
  const normalizedManifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  const resultText = `${JSON.stringify(result, null, 2)}\n`;
  const receiptWithoutHash = renderReceipt({
    runId,
    generatedAtUtc,
    command: commandText(),
    gitCommit,
    result,
    manifestPath,
    resultPath,
    hashesPath,
    registryPath,
    status: options.status,
    rerunReason: options.rerunReason,
  });
  const receiptHash = sha256Text(receiptWithoutHash);
  const receiptText = `${receiptWithoutHash}Receipt hash: \`${receiptHash}\`\n`;
  const hashes = {
    schema_version: 1,
    run_id: runId,
    generated_at_utc: generatedAtUtc,
    equivalence_key_hash: equivalenceKeyHash,
    manifest_hash: identity.manifest_hash,
    manifest_file_sha256: sha256Text(normalizedManifestText),
    result_hash: sha256Stable(result),
    result_file_sha256: sha256Text(resultText),
    receipt_hash: receiptHash,
    receipt_file_sha256: sha256Text(receiptText),
    config_hash: identity.config_hash,
    price_bundle_id: identity.price_bundle_id,
    evaluator_version: RESEARCH_DECISION_EVALUATOR_VERSION,
  };
  const hashesText = `${JSON.stringify(hashes, null, 2)}\n`;

  await Promise.all([
    mkdir(path.dirname(manifestPath), { recursive: true }),
    mkdir(path.dirname(resultPath), { recursive: true }),
    mkdir(path.dirname(receiptPath), { recursive: true }),
    mkdir(path.dirname(hashesPath), { recursive: true }),
    docsReceiptPath ? mkdir(path.dirname(docsReceiptPath), { recursive: true }) : Promise.resolve(),
  ]);
  await Promise.all([
    writeFile(manifestPath, normalizedManifestText, "utf8"),
    writeFile(resultPath, resultText, "utf8"),
    writeFile(receiptPath, receiptText, "utf8"),
    writeFile(hashesPath, hashesText, "utf8"),
    docsReceiptPath ? writeFile(docsReceiptPath, receiptText, "utf8") : Promise.resolve(),
  ]);

  if (registryPath) {
    await appendResearchRunRegistryEntry(registryPath, {
      schema_version: 1,
      run_id: runId,
      gate_id: identity.gate_id,
      hypothesis_id: identity.hypothesis_id,
      command: commandText(),
      git_commit: gitCommit,
      input_manifest_hash: identity.manifest_hash,
      price_bundle_id: identity.price_bundle_id,
      feature_bundle_id: identity.feature_bundle_id,
      source_context_ids: identity.source_context_ids,
      evaluator_version: RESEARCH_DECISION_EVALUATOR_VERSION,
      evaluators: options.evaluators,
      path_resolution: options.pathResolution,
      config_hash: identity.config_hash,
      output_result_hash: hashes.result_file_sha256,
      receipt_hash: receiptHash,
      status: options.status,
      supersedes: options.supersedes,
      superseded_by: null,
      rerun_reason: options.rerunReason,
      equivalence_key_hash: equivalenceKeyHash,
      manifest_path: manifestPath,
      result_path: resultPath,
      receipt_path: receiptPath,
      hashes_path: hashesPath,
      created_at_utc: generatedAtUtc,
    });
  }

  console.log(`Research run: ${runId}`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Result: ${resultPath}`);
  console.log(`Receipt: ${receiptPath}`);
  console.log(`Hashes: ${hashesPath}`);
  console.log(`Registry: ${registryPath ?? "-"}`);
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
