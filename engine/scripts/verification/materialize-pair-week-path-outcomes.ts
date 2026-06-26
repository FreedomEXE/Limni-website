import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { getPool } from "@database/db/client";
import { PAIRS_BY_ASSET_CLASS } from "@engine/contracts/cotPairs";
import type { ResearchDecisionAssetClass } from "@engine/research/decisionManifest";
import { type ResearchDecisionPathResolution } from "@engine/research/decisionManifestEvaluator";
import { sha256Stable, sha256Text } from "@engine/research/hash";
import {
  buildPairWeekPathOutcomeManifestId,
  buildPairWeekPathOutcomeWarehouseConfig,
  hashPairWeekPathOutcomeWarehouseConfig,
  materializePairWeekPathOutcomeWarehouse,
  readPairWeekPathOutcomeWarehouseManifest,
} from "@engine/research/pairWeekPathOutcomeWarehouse";

const GATE55E_PRICE_BUNDLE_ID = "gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953";
const DEFAULT_GATE55E_AUDIT_JSON = "archive/app/reports/data-verification/gate55/gate55e-canonical-fx-m1-bundle-20260624T232148Z.json";
const DEFAULT_OUT_DIR = "docs/research/gates/gate57/artifacts/gate57a0b-pair-week-path-outcomes";

type CliOptions = {
  priceBundleId: string;
  assetClass: ResearchDecisionAssetClass;
  pathResolution: ResearchDecisionPathResolution;
  gate55eAuditJson: string;
  outDir: string;
  manifestId: string | null;
  overwrite: boolean;
  logProgress: boolean;
  clearRuntimeCacheBetweenWeeks: boolean;
  expectedWeeks: number | null;
  expectedSymbols: number | null;
  expectedRows: number | null;
  maxWeeks: number | null;
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

function numberArg(name: string): number | null {
  const raw = argValue(name);
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`Invalid --${name}: ${raw}`);
  return Math.floor(value);
}

function parseAssetClass(raw: string | null): ResearchDecisionAssetClass {
  const value = (raw ?? "fx").trim();
  if (value === "fx" || value === "indices" || value === "commodities" || value === "crypto") return value;
  throw new Error(`Unsupported --asset-class: ${raw}`);
}

function parsePathResolution(raw: string | null): ResearchDecisionPathResolution {
  const value = (raw ?? "1m").trim().toLowerCase();
  if (value === "1m" || value === "m1") return "1m";
  if (value === "1h" || value === "h1") return "1h";
  throw new Error(`Unsupported --path-resolution: ${raw}`);
}

function helpText() {
  return `
Materialize durable pair-week path outcomes for ResearchDecisionManifest aggregation.

Common:
  --price-bundle-id=<id>            Default: Gate 55E frozen FX M1 bundle.
  --asset-class=fx                  Default: fx.
  --path-resolution=1m|1h           Default: 1m.
  --gate55e-audit-json=<path>       Default: ${DEFAULT_GATE55E_AUDIT_JSON}
  --out-dir=<path>                  Default: ${DEFAULT_OUT_DIR}
  --manifest-id=<id>                Optional deterministic warehouse id override.
  --overwrite                       Required to rebuild an existing warehouse id.
  --clear-runtime-cache-between-weeks
  --log-progress
  --expected-weeks=<n>
  --expected-symbols=<n>
  --expected-rows=<n>
  --max-weeks=<n>                   Diagnostic smoke only; changes the config hash.
`.trim();
}

function parseCli(): CliOptions {
  if (hasFlag("help") || hasFlag("h")) {
    console.log(helpText());
    process.exit(0);
  }
  return {
    priceBundleId: argValue("price-bundle-id") ?? GATE55E_PRICE_BUNDLE_ID,
    assetClass: parseAssetClass(argValue("asset-class")),
    pathResolution: parsePathResolution(argValue("path-resolution")),
    gate55eAuditJson: argValue("gate55e-audit-json") ?? DEFAULT_GATE55E_AUDIT_JSON,
    outDir: argValue("out-dir") ?? DEFAULT_OUT_DIR,
    manifestId: argValue("manifest-id"),
    overwrite: hasFlag("overwrite"),
    logProgress: hasFlag("log-progress"),
    clearRuntimeCacheBetweenWeeks: hasFlag("clear-runtime-cache-between-weeks"),
    expectedWeeks: numberArg("expected-weeks"),
    expectedSymbols: numberArg("expected-symbols"),
    expectedRows: numberArg("expected-rows"),
    maxWeeks: numberArg("max-weeks"),
  };
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

async function readGate55EWeeks(auditJsonPath: string) {
  const raw = await readFile(path.resolve(process.cwd(), auditJsonPath), "utf8");
  const parsed = JSON.parse(raw) as {
    weekRows?: Array<{ weekOpenUtc?: string }>;
  };
  const weeks = (parsed.weekRows ?? [])
    .map((row) => row.weekOpenUtc)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).toISOString())
    .sort();
  if (weeks.length === 0) {
    throw new Error(`No weekRows found in Gate 55E audit JSON: ${auditJsonPath}`);
  }
  return weeks;
}

function renderReceipt(options: {
  generatedAtUtc: string;
  gitCommit: string;
  command: string;
  manifestPayloadPath: string;
  hashesPath: string;
  result: Awaited<ReturnType<typeof materializePairWeekPathOutcomeWarehouse>>;
  warehouseManifestHash: string;
}) {
  const inspection = options.result.inspection;
  return [
    "# Gate 57A0B Pair-Week Path Outcome Warehouse Materialization",
    "",
    `Generated: ${options.generatedAtUtc}`,
    "",
    "## Result",
    "",
    `- Manifest ID: \`${options.result.manifestId}\``,
    `- Price bundle ID: \`${options.result.config.price_bundle_id}\``,
    `- Asset class: \`${options.result.config.asset_class}\``,
    `- Path resolution: \`${options.result.config.path_resolution}\``,
    `- Evaluator version: \`${options.result.config.evaluator_version}\``,
    `- Path contract ID: \`${options.result.config.path_contract_id}\``,
    `- Evaluator params hash: \`${options.result.config.evaluator_params_hash}\``,
    `- Config hash: \`${options.result.configHash}\``,
    `- Warehouse hash: \`${options.result.warehouseHash}\``,
    `- Warehouse manifest hash: \`${options.warehouseManifestHash}\``,
    `- Git commit: \`${options.gitCommit}\``,
    "",
    "## Coverage",
    "",
    `- Weeks: \`${options.result.config.weeks.length}\``,
    `- Symbols: \`${options.result.config.symbols.length}\``,
    `- Directions: \`${options.result.config.directions.length}\``,
    `- Expected rows: \`${inspection.expected_rows}\``,
    `- Materialized rows: \`${inspection.row_count}\``,
    `- Missing outcome count: \`${inspection.missing_outcome_count}\``,
    `- Duplicate outcome count: \`${inspection.duplicate_outcome_count}\``,
    `- Row counts by evaluator: \`${JSON.stringify(inspection.row_counts_by_evaluator)}\``,
    `- Row counts by direction: \`${JSON.stringify(inspection.row_counts_by_direction)}\``,
    "",
    "Full row counts by symbol and week are in the warehouse manifest JSON.",
    "",
    "## Runtime Controls",
    "",
    `- Cold materialization runtime seconds: \`${options.result.runtimeSeconds}\``,
    `- Clear runtime cache between weeks: \`${options.result.cache.clearAllCalls > 0}\``,
    `- Runtime cache gets/hits/misses: \`${options.result.cache.gets}/${options.result.cache.hits}/${options.result.cache.misses}\``,
    `- Runtime cache clear-all calls: \`${options.result.cache.clearAllCalls}\``,
    "",
    "Runtime/cache settings are memory and speed controls only. They are not signal logic, strategy logic, or evaluator semantics.",
    "",
    "## Files",
    "",
    `- Warehouse manifest JSON: ${options.manifestPayloadPath}`,
    `- Hashes JSON: ${options.hashesPath}`,
    "",
    "## Command",
    "",
    `\`${options.command}\``,
    "",
    "## Boundary",
    "",
    "This materializes strategy-agnostic pair-week long/short path outcomes only. It does not change COT logic, Strength logic, ADR Grid semantics, Weekly Hold semantics, regimes, risk overlays, or live/MT5 behavior.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseCli();
  const symbols = PAIRS_BY_ASSET_CLASS[options.assetClass].map((row) => row.pair.toUpperCase()).sort();
  let weeks = await readGate55EWeeks(options.gate55eAuditJson);
  if (options.maxWeeks !== null) {
    weeks = weeks.slice(0, options.maxWeeks);
  }
  const expectedWeeks = options.expectedWeeks ?? weeks.length;
  const expectedSymbols = options.expectedSymbols ?? symbols.length;
  const expectedRows = options.expectedRows ?? expectedWeeks * expectedSymbols * 2;
  if (weeks.length !== expectedWeeks) throw new Error(`Expected ${expectedWeeks} weeks, got ${weeks.length}.`);
  if (symbols.length !== expectedSymbols) throw new Error(`Expected ${expectedSymbols} symbols, got ${symbols.length}.`);
  if (weeks.length * symbols.length * 2 !== expectedRows) {
    throw new Error(`Expected ${expectedRows} rows, got ${weeks.length * symbols.length * 2}.`);
  }

  const config = buildPairWeekPathOutcomeWarehouseConfig({
    priceBundleId: options.priceBundleId,
    assetClass: options.assetClass,
    pathResolution: options.pathResolution,
    symbols,
    weeks,
  });
  const manifestId = options.manifestId ?? buildPairWeekPathOutcomeManifestId(config);
  const result = await materializePairWeekPathOutcomeWarehouse({
    manifestId,
    priceBundleId: options.priceBundleId,
    assetClass: options.assetClass,
    pathResolution: options.pathResolution,
    symbols,
    weeks,
    overwrite: options.overwrite,
    clearRuntimeCacheBetweenWeeks: options.clearRuntimeCacheBetweenWeeks,
    logProgress: options.logProgress,
  });
  const dbManifest = await readPairWeekPathOutcomeWarehouseManifest(result.manifestId);
  const generatedAtUtc = new Date().toISOString();
  const payload = {
    schema_version: 1,
    generated_at_utc: generatedAtUtc,
    git_commit: currentGitCommit(),
    command: commandText(),
    db_manifest: dbManifest,
    config: result.config,
    config_hash: hashPairWeekPathOutcomeWarehouseConfig(result.config),
    warehouse_hash: result.warehouseHash,
    inspection: result.inspection,
    cold_materialization_runtime_seconds: result.runtimeSeconds,
    runtime_cache: result.cache,
  };
  const warehouseManifestHash = sha256Stable(payload);
  const outDir = path.resolve(process.cwd(), options.outDir);
  const manifestPathAbs = path.join(outDir, `${result.manifestId}.warehouse-manifest.json`);
  const hashesPathAbs = path.join(outDir, `${result.manifestId}.hashes.json`);
  const receiptPathAbs = path.join(outDir, `${result.manifestId}.receipt.md`);
  const manifestPathRel = path.relative(process.cwd(), manifestPathAbs).replace(/\\/g, "/");
  const hashesPathRel = path.relative(process.cwd(), hashesPathAbs).replace(/\\/g, "/");
  const receiptWithoutHash = renderReceipt({
    generatedAtUtc,
    gitCommit: payload.git_commit,
    command: payload.command,
    manifestPayloadPath: manifestPathRel,
    hashesPath: hashesPathRel,
    result,
    warehouseManifestHash,
  });
  const receiptHash = sha256Text(`${receiptWithoutHash}\n`);
  const receiptText = `${receiptWithoutHash}\nReceipt hash: \`${receiptHash}\`\n`;
  const manifestText = `${JSON.stringify({ ...payload, warehouse_manifest_hash: warehouseManifestHash }, null, 2)}\n`;
  const hashes = {
    schema_version: 1,
    generated_at_utc: generatedAtUtc,
    manifest_id: result.manifestId,
    config_hash: result.configHash,
    warehouse_hash: result.warehouseHash,
    warehouse_manifest_hash: warehouseManifestHash,
    warehouse_manifest_file_sha256: sha256Text(manifestText),
    receipt_hash: receiptHash,
    receipt_file_sha256: sha256Text(receiptText),
  };

  await mkdir(outDir, { recursive: true });
  await Promise.all([
    writeFile(manifestPathAbs, manifestText, "utf8"),
    writeFile(hashesPathAbs, `${JSON.stringify(hashes, null, 2)}\n`, "utf8"),
    writeFile(receiptPathAbs, receiptText, "utf8"),
  ]);

  console.log(`Warehouse manifest ID: ${result.manifestId}`);
  console.log(`Warehouse hash: ${result.warehouseHash}`);
  console.log(`Warehouse manifest hash: ${warehouseManifestHash}`);
  console.log(`Rows: ${result.inspection.row_count}/${result.inspection.expected_rows}`);
  console.log(`Missing outcomes: ${result.inspection.missing_outcome_count}`);
  console.log(`Duplicate outcomes: ${result.inspection.duplicate_outcome_count}`);
  console.log(`Cold materialization runtime seconds: ${result.runtimeSeconds}`);
  console.log(`Warehouse manifest JSON: ${manifestPathRel}`);
  console.log(`Hashes: ${hashesPathRel}`);
  console.log(`Receipt: ${path.relative(process.cwd(), receiptPathAbs).replace(/\\/g, "/")}`);
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
