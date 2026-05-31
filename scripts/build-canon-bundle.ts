/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: build-canon-bundle.ts
 *
 * Description:
 * Materializes immutable release canon artifacts from the trade ledger.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildClosedHistoryBundle } from "@/lib/basket/basketSummaries";
import { ALL_PERFORMANCE_ASSET_SELECTION } from "@/lib/performance/performanceAssetScope";
import {
  buildStrategySelectionKey,
  listVisibleStrategyBootstrapSelections,
} from "@/lib/performance/strategySelection";
import {
  canonFileNameForStrategyVariant,
  type CanonArtifact,
} from "@/lib/canon/canonArtifact";
import { releaseManifestSchema, type ReleaseManifest } from "@/lib/version/releaseManifest";

type Args = {
  version: string;
  generatedAt?: string;
};

function loadLocalEnv() {
  for (const file of [".env", ".env.local"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx);
      let value = trimmed.slice(idx + 1);
      if (
        (value.startsWith("\"") && value.endsWith("\""))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] ??= value;
    }
  }
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const parsed: Args = { version: "v2" };
  for (const arg of args) {
    if (arg.startsWith("--version=")) parsed.version = arg.slice("--version=".length);
    else if (arg.startsWith("--generated-at=")) parsed.generatedAt = arg.slice("--generated-at=".length);
  }
  return parsed;
}

function sha256(value: string) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function stableJson(value: unknown) {
  return JSON.stringify(value);
}

function strategyVariantFromSelectionKey(selectionKey: string) {
  return selectionKey.replaceAll(":", "-");
}

function releaseDateToGeneratedAt(releasedAt: string) {
  const parsed = new Date(releasedAt.includes("T") ? releasedAt : `${releasedAt}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return releasedAt;
  return parsed.toISOString();
}

async function readManifest(root: string) {
  const manifestPath = path.join(root, "release-manifest.json");
  const raw = JSON.parse(await readFile(manifestPath, "utf8"));
  return {
    manifestPath,
    manifest: releaseManifestSchema.parse(raw),
  };
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main() {
  loadLocalEnv();
  const root = process.cwd();
  const args = parseArgs();
  const { manifestPath, manifest } = await readManifest(root);
  if (manifest.appVersion !== args.version) {
    throw new Error(`Manifest appVersion ${manifest.appVersion} does not match --version=${args.version}`);
  }

  const canonGeneratedAt = args.generatedAt ?? releaseDateToGeneratedAt(manifest.releasedAt);
  const releaseDir = path.join(root, "releases", args.version);
  const canonDir = path.join(releaseDir, "canon");
  await mkdir(canonDir, { recursive: true });

  const selections = listVisibleStrategyBootstrapSelections();
  const variants = selections.map((selection) =>
    strategyVariantFromSelectionKey(buildStrategySelectionKey(selection)),
  );

  const manifestVariants: ReleaseManifest["canon"]["variants"] = [];
  const aggregateSource = [];
  let aggregateRows = 0;

  for (const strategyVariant of variants) {
    const bundle = await buildClosedHistoryBundle({
      strategyVariant,
      scope: ALL_PERFORMANCE_ASSET_SELECTION,
    });
    const frozenBundle = {
      ...bundle,
      scope: [...ALL_PERFORMANCE_ASSET_SELECTION],
      generatedAt: canonGeneratedAt,
    };
    const sourceHash = sha256(stableJson(frozenBundle.rows));
    const artifact: CanonArtifact = {
      metadata: {
        appVersion: manifest.appVersion,
        semanticVersion: manifest.semanticVersion,
        releasedAt: manifest.releasedAt,
        canonGeneratedAt,
        strategyVariant,
        sourceLedgerRowCount: frozenBundle.rows.length,
        sourceHash,
      },
      bundle: frozenBundle,
    };
    const file = canonFileNameForStrategyVariant(strategyVariant);
    await writeJson(path.join(canonDir, file), artifact);
    const fileRaw = await readFile(path.join(canonDir, file), "utf8");
    const fileHash = sha256(fileRaw);
    aggregateRows += frozenBundle.rows.length;
    aggregateSource.push({ strategyVariant, sourceHash, rowCount: frozenBundle.rows.length });
    manifestVariants.push({
      strategyVariant,
      file,
      rowCount: frozenBundle.rows.length,
      sha256: fileHash,
    });
    console.log(`${strategyVariant}: ${frozenBundle.rows.length} rows -> ${file} ${fileHash}`);
  }

  const nextManifest: ReleaseManifest = {
    ...manifest,
    canon: {
      generatedAt: canonGeneratedAt,
      sourceLedgerRowCount: aggregateRows,
      sourceHash: sha256(stableJson(aggregateSource)),
      variants: manifestVariants,
    },
  };
  releaseManifestSchema.parse(nextManifest);
  await writeJson(manifestPath, nextManifest);
  await mkdir(releaseDir, { recursive: true });
  await writeJson(path.join(releaseDir, "manifest.json"), nextManifest);
  console.log(`Materialized ${manifestVariants.length} canon artifacts in ${canonDir}`);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
