import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { getPool } from "@database/db/client";
import {
  buildGate55GFridayStrengthManifests,
  GATE55E_PRICE_BUNDLE_ID,
  GATE55G_DEFAULT_FROM_WEEK,
  GATE55G_DEFAULT_TO_WEEK_EXCLUSIVE,
  GATE55G_DEFAULT_WINDOWS,
  GATE56E_GATE_ID,
  type Gate55GStrengthManifestSignalId,
} from "@engine/signals/strength/fridayStrengthManifest";
import type { HistoricalStrengthWindow } from "@engine/signals/strength/historicalStrength";
import { sha256Stable, sha256Text } from "@engine/research/hash";

type CliOptions = {
  fromWeek: string;
  toWeekExclusive: string;
  windows: HistoricalStrengthWindow[];
  cadenceMinutes: number;
  fridayBackwardMinutes: number;
  minPairCoveragePct: number;
  batchWeeks: number;
  outDir: string;
  receiptPath: string;
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

function helpText() {
  return `
Generate Gate 56E equivalent Gate 55G Friday Strength selected/fade manifests.

Common:
  --out-dir=<path>             Default: docs/research/gates/gate56/manifests
  --receipt-path=<path>        Default: docs/research/gates/gate56/receipts/GATE56E_GATE55G_EQUIVALENT_MANIFEST_BUILD_2026-06-25.md
  --from-week=<iso>            Default: ${GATE55G_DEFAULT_FROM_WEEK}
  --to-week=<iso>              Exclusive. Default: ${GATE55G_DEFAULT_TO_WEEK_EXCLUSIVE}
  --windows=1h,4h,24h,1w,1m    Gate 55G default.
  --batch-weeks=<n>            Default: 16.

This command derives frozen decision manifests only. It does not score,
bucket, regime-filter, combine COT+Strength, optimize execution, or promote
live/MT5 work.
`.trim();
}

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseNumber(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseWindow(value: string): HistoricalStrengthWindow {
  if (
    value === "15m" ||
    value === "30m" ||
    value === "1h" ||
    value === "4h" ||
    value === "24h" ||
    value === "1w" ||
    value === "1m"
  ) {
    return value;
  }
  throw new Error(`Unsupported strength window: ${value}`);
}

function parseWindows(value: string | null): HistoricalStrengthWindow[] {
  if (!value) return GATE55G_DEFAULT_WINDOWS;
  return [...new Set(value.split(",").map((item) => parseWindow(item.trim())).filter(Boolean))];
}

function parseCli(): CliOptions {
  if (hasFlag("help") || hasFlag("h")) {
    console.log(helpText());
    process.exit(0);
  }
  return {
    fromWeek: argValue("from-week") ?? GATE55G_DEFAULT_FROM_WEEK,
    toWeekExclusive: argValue("to-week") ?? GATE55G_DEFAULT_TO_WEEK_EXCLUSIVE,
    windows: parseWindows(argValue("windows")),
    cadenceMinutes: parsePositiveInteger(argValue("cadence-minutes") ?? argValue("cadence"), 15),
    fridayBackwardMinutes: parsePositiveInteger(argValue("friday-backward-minutes"), 60),
    minPairCoveragePct: Math.max(0, Math.min(100, parseNumber(argValue("min-pair-coverage-pct"), 100))),
    batchWeeks: parsePositiveInteger(argValue("batch-weeks"), 16),
    outDir: argValue("out-dir") ?? path.join("docs", "research", "gates", "gate56", "manifests"),
    receiptPath: argValue("receipt-path") ?? path.join(
      "docs",
      "research",
      "gates",
      "gate56",
      "receipts",
      "GATE56E_GATE55G_EQUIVALENT_MANIFEST_BUILD_2026-06-25.md",
    ),
  };
}

function assertCanonicalDbOnly() {
  const localMode = process.env.LIMNI_M1_WAREHOUSE?.trim();
  const localPath = process.env.LIMNI_M1_SQLITE_PATH?.trim();
  if (localMode || localPath) {
    throw new Error(
      [
        "Gate 56E manifest parity must use canonical_price_bars, not local SQLite staging.",
        `Unset LIMNI_M1_WAREHOUSE and LIMNI_M1_SQLITE_PATH before running. mode=${localMode ?? "-"} path=${localPath ?? "-"}`,
      ].join(" "),
    );
  }
}

function toRepoRelative(resolvedPath: string) {
  return path.relative(process.cwd(), resolvedPath).replace(/\\/g, "/");
}

function manifestFileName(signalId: Gate55GStrengthManifestSignalId) {
  return `gate56e-gate55g-friday-strength-${signalId}-equivalent.manifest.json`;
}

function summarizeManifest(manifest: Awaited<ReturnType<typeof buildGate55GFridayStrengthManifests>>["manifests"][Gate55GStrengthManifestSignalId]) {
  return {
    manifest_id: manifest.manifest_id,
    signal_id: manifest.signal_id,
    manifest_hash: manifest.manifest_hash,
    rows: manifest.decisions.length,
    long_rows: manifest.decisions.filter((row) => row.side === "LONG").length,
    short_rows: manifest.decisions.filter((row) => row.side === "SHORT").length,
  };
}

function renderReceipt(options: {
  generatedAtUtc: string;
  cli: CliOptions;
  selectedPath: string;
  fadePath: string;
  selectedHash: string;
  fadeHash: string;
  sourceHash: string;
  build: Awaited<ReturnType<typeof buildGate55GFridayStrengthManifests>>;
}) {
  const expectedRows = options.build.source.weeks.length * 28;
  const selected = summarizeManifest(options.build.manifests.selected);
  const fade = summarizeManifest(options.build.manifests.fade);
  const lines = [
    "# Gate 56E Gate 55G Equivalent Manifest Build",
    "",
    `Generated: ${options.generatedAtUtc}`,
    "",
    "## Result",
    "",
    `- Gate: ${GATE56E_GATE_ID}`,
    `- Price bundle ID: \`${GATE55E_PRICE_BUNDLE_ID}\``,
    `- Selected manifest: \`${options.selectedPath}\``,
    `- Fade manifest: \`${options.fadePath}\``,
    `- Selected manifest file SHA-256: \`${options.selectedHash}\``,
    `- Fade manifest file SHA-256: \`${options.fadeHash}\``,
    `- Source summary hash: \`${options.sourceHash}\``,
    "",
    "## Coverage",
    "",
    `- Weeks: ${options.build.source.weeks.length}`,
    `- Expected rows: ${expectedRows}`,
    `- Selected source rows: ${options.build.source.decisions.length}`,
    `- Full source weeks: ${options.build.source.sourceWeeks.filter((row) => row.retainedRows === 28).length}`,
    `- Non-full source weeks: ${options.build.source.sourceWeeks.filter((row) => row.retainedRows !== 28).length}`,
    `- Snapshot times: ${options.build.source.snapshotTimes}`,
    `- Snapshot rows: ${options.build.source.snapshotRows}`,
    `- Complete snapshot rows: ${options.build.source.completeSnapshotRows}`,
    `- Incomplete snapshot rows: ${options.build.source.incompleteSnapshotRows}`,
    `- Source coverage range: ${options.build.source.minCoveragePct}% to ${options.build.source.maxCoveragePct}%`,
    "",
    "## Manifest Rows",
    "",
    "| Manifest | Rows | Long | Short | Manifest hash |",
    "|---|---:|---:|---:|---|",
    `| selected | ${selected.rows} | ${selected.long_rows} | ${selected.short_rows} | \`${selected.manifest_hash}\` |`,
    `| fade | ${fade.rows} | ${fade.long_rows} | ${fade.short_rows} | \`${fade.manifest_hash}\` |`,
    "",
    "## Command",
    "",
    `\`${process.argv.join(" ")}\``,
    "",
    "## Boundary",
    "",
    "This command emits frozen equivalent selected/fade decision manifests only. It does not score results, run Strength buckets, run regime filters, restate COT, combine COT+Strength, optimize execution, add risk overlays, create a new backtest engine, or promote live/MT5 work.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  assertCanonicalDbOnly();
  const options = parseCli();
  const outDir = path.resolve(process.cwd(), options.outDir);
  const receiptPath = path.resolve(process.cwd(), options.receiptPath);

  const build = await buildGate55GFridayStrengthManifests({
    fromWeek: options.fromWeek,
    toWeekExclusive: options.toWeekExclusive,
    windows: options.windows,
    cadenceMinutes: options.cadenceMinutes,
    fridayBackwardMinutes: options.fridayBackwardMinutes,
    minPairCoveragePct: options.minPairCoveragePct,
    batchWeeks: options.batchWeeks,
    onProgress: (message) => console.log(message),
  });

  const selectedPath = path.join(outDir, manifestFileName("selected"));
  const fadePath = path.join(outDir, manifestFileName("fade"));
  const selectedText = `${JSON.stringify(build.manifests.selected, null, 2)}\n`;
  const fadeText = `${JSON.stringify(build.manifests.fade, null, 2)}\n`;
  const sourceSummary = {
    weeks: build.source.weeks,
    sourceWeeks: build.source.sourceWeeks,
    snapshotTimes: build.source.snapshotTimes,
    snapshotRows: build.source.snapshotRows,
    completeSnapshotRows: build.source.completeSnapshotRows,
    incompleteSnapshotRows: build.source.incompleteSnapshotRows,
    minCoveragePct: build.source.minCoveragePct,
    maxCoveragePct: build.source.maxCoveragePct,
  };
  const sourceHash = sha256Stable(sourceSummary);

  await Promise.all([
    mkdir(outDir, { recursive: true }),
    mkdir(path.dirname(receiptPath), { recursive: true }),
  ]);

  await Promise.all([
    writeFile(selectedPath, selectedText, "utf8"),
    writeFile(fadePath, fadeText, "utf8"),
  ]);

  const receiptWithoutHash = renderReceipt({
    generatedAtUtc: new Date().toISOString(),
    cli: options,
    selectedPath: toRepoRelative(selectedPath),
    fadePath: toRepoRelative(fadePath),
    selectedHash: sha256Text(selectedText),
    fadeHash: sha256Text(fadeText),
    sourceHash,
    build,
  });
  const receiptHash = sha256Text(receiptWithoutHash);
  const receiptText = `${receiptWithoutHash}Receipt hash: \`${receiptHash}\`\n`;
  await writeFile(receiptPath, receiptText, "utf8");

  console.log(`Selected manifest: ${toRepoRelative(selectedPath)}`);
  console.log(`Fade manifest: ${toRepoRelative(fadePath)}`);
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
