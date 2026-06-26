import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { getPool } from "@database/db/client";
import {
  buildGate57BFridayRelativeStrength15wManifests,
  GATE55E_PRICE_BUNDLE_ID,
  GATE57B_DEFAULT_FROM_WEEK,
  GATE57B_DEFAULT_TO_WEEK_EXCLUSIVE,
  GATE57B_GATE_ID,
  GATE57B_LOOKBACK_WEEKS,
  type Gate57BFrs15ManifestSignalId,
} from "@engine/signals/strength/fridayRelativeStrength15wManifest";
import { sha256Stable, sha256Text } from "@engine/research/hash";

type CliOptions = {
  fromWeek: string;
  toWeekExclusive: string;
  lookbackWeeks: number;
  closeLookbackMinutes: number;
  outDir: string;
  receiptPath: string;
  summaryPath: string;
};

const DEFAULT_SIGNAL_IDS: Gate57BFrs15ManifestSignalId[] = [
  "parent_selected",
  "parent_fade",
  "compressed_selected",
  "middle_selected",
  "extreme_selected",
  "no_extreme_selected",
  "persistent_selected",
  "flip_selected",
];

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
Generate Gate 57B Friday-only 15-week relative Strength lifecycle manifests.

Common:
  --out-dir=<path>                  Default: engine/reports/gate57b-friday-strength15w/manifests
  --summary-path=<path>             Default: engine/reports/gate57b-friday-strength15w/manifest-summary.json
  --receipt-path=<path>             Default: docs/research/gates/gate57/receipts/GATE57B_FRIDAY_STRENGTH_15W_MANIFEST_BUILD_2026-06-26.md
  --from-week=<iso>                 Default: ${GATE57B_DEFAULT_FROM_WEEK}
  --to-week=<iso>                   Exclusive. Default: ${GATE57B_DEFAULT_TO_WEEK_EXCLUSIVE}
  --lookback-weeks=<n>              Default: ${GATE57B_LOOKBACK_WEEKS}
  --close-lookback-minutes=<n>      Default: 2880

Signals emitted:
  ${DEFAULT_SIGNAL_IDS.join(", ")}

This command derives Friday-only frozen decision manifests. It does not score,
run raw M1 ADR Grid simulation, use market-open confirmation, retune COT,
combine COT+Strength, run regimes, add risk overlays, or promote live/MT5 work.
`.trim();
}

function parseCli(): CliOptions {
  if (hasFlag("help") || hasFlag("h")) {
    console.log(helpText());
    process.exit(0);
  }
  return {
    fromWeek: argValue("from-week") ?? GATE57B_DEFAULT_FROM_WEEK,
    toWeekExclusive: argValue("to-week") ?? GATE57B_DEFAULT_TO_WEEK_EXCLUSIVE,
    lookbackWeeks: parsePositiveInteger(argValue("lookback-weeks"), GATE57B_LOOKBACK_WEEKS),
    closeLookbackMinutes: parsePositiveInteger(argValue("close-lookback-minutes"), 2880),
    outDir: argValue("out-dir") ?? path.join("engine", "reports", "gate57b-friday-strength15w", "manifests"),
    summaryPath: argValue("summary-path") ?? path.join(
      "engine",
      "reports",
      "gate57b-friday-strength15w",
      "manifest-summary.json",
    ),
    receiptPath: argValue("receipt-path") ?? path.join(
      "docs",
      "research",
      "gates",
      "gate57",
      "receipts",
      "GATE57B_FRIDAY_STRENGTH_15W_MANIFEST_BUILD_2026-06-26.md",
    ),
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

function manifestFileName(signalId: Gate57BFrs15ManifestSignalId) {
  return `gate57b-friday-relative-strength-15w-${signalId}.manifest.json`;
}

function renderReceipt(options: {
  generatedAtUtc: string;
  cli: CliOptions;
  runtimeCommit: string;
  dirtyTree: ReturnType<typeof dirtyTreeStatus>;
  summaryPath: string;
  sourceSummaryHash: string;
  manifestRows: Array<{
    signalId: Gate57BFrs15ManifestSignalId;
    path: string;
    manifestHash: string | undefined;
    fileSha256: string;
    rows: number;
    weeks: number;
    longRows: number;
    shortRows: number;
  }>;
  source: Awaited<ReturnType<typeof buildGate57BFridayRelativeStrength15wManifests>>["source"];
}) {
  const fullParentWeeks = options.source.shape.parent_selected.weeks;
  const lines = [
    "# Gate 57B Friday Strength 15W Manifest Build",
    "",
    `Generated: ${options.generatedAtUtc}`,
    "",
    "## Result",
    "",
    `- Gate: ${GATE57B_GATE_ID}`,
    `- Price bundle ID: \`${GATE55E_PRICE_BUNDLE_ID}\``,
    `- Lookback weeks: \`${options.source.lookbackWeeks}\``,
    `- Friday close lookup: latest 1m bar close at or before Friday freeze within \`${options.source.closeLookbackMinutes}\` minutes`,
    `- Run-time git commit: \`${options.runtimeCommit}\``,
    `- Working tree status: \`${options.dirtyTree.status}\``,
    `- Ignored summary JSON: \`${options.summaryPath}\``,
    `- Source summary hash: \`${options.sourceSummaryHash}\``,
    "",
    "## Coverage",
    "",
    `- Requested trade weeks: ${options.source.weeks.length}`,
    `- Supported trade weeks: ${options.source.supportedWeeks.length}`,
    `- Unsupported trade weeks: ${options.source.unsupportedWeeks.length}`,
    `- Parent selected weeks: ${fullParentWeeks}`,
    `- Parent selected rows: ${options.source.shape.parent_selected.rows}`,
    `- Parent non-full weeks: ${options.source.shape.parent_selected.nonFullParentWeeks.length}`,
    `- Price lookup requests: ${options.source.priceLookupRequests}`,
    `- Missing price lookups: ${options.source.missingPriceLookups}`,
    `- First supported week: ${options.source.supportedWeeks[0]?.weekOpenUtc ?? "-"}`,
    `- Last supported week: ${options.source.supportedWeeks.at(-1)?.weekOpenUtc ?? "-"}`,
    "",
    "## Manifests",
    "",
    "| Signal | Rows | Weeks | Long | Short | Manifest hash | File SHA-256 | Path |",
    "|---|---:|---:|---:|---:|---|---|---|",
    ...options.manifestRows.map((row) =>
      `| ${row.signalId} | ${row.rows} | ${row.weeks} | ${row.longRows} | ${row.shortRows} | \`${row.manifestHash}\` | \`${row.fileSha256}\` | \`${row.path}\` |`),
    "",
    "## Boundary",
    "",
    "This command emits Friday-only 15-week relative Strength manifests. It does not use market-open confirmation, run raw M1 ADR Grid simulation, score results, retune COT, combine COT+Strength, run regimes, optimize execution, add risk overlays, or promote live/MT5 work.",
    "",
    "## Dirty Tree Files",
    "",
    ...(options.dirtyTree.files.length > 0 ? options.dirtyTree.files.map((file) => `- ${file}`) : ["- none"]),
    "",
    "## Command",
    "",
    `\`${process.argv.join(" ")}\``,
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  const started = Date.now();
  const cli = parseCli();
  const outDir = path.resolve(process.cwd(), cli.outDir);
  const receiptPath = path.resolve(process.cwd(), cli.receiptPath);
  const summaryPath = path.resolve(process.cwd(), cli.summaryPath);
  const runtimeCommit = currentGitCommit();
  const dirtyTree = dirtyTreeStatus();
  console.log(
    [
      "Gate 57B Friday 15W manifest build",
      `from=${cli.fromWeek}`,
      `toExclusive=${cli.toWeekExclusive}`,
      `lookbackWeeks=${cli.lookbackWeeks}`,
      `closeLookbackMinutes=${cli.closeLookbackMinutes}`,
    ].join(" | "),
  );
  const build = await buildGate57BFridayRelativeStrength15wManifests({
    fromWeek: cli.fromWeek,
    toWeekExclusive: cli.toWeekExclusive,
    lookbackWeeks: cli.lookbackWeeks,
    closeLookbackMinutes: cli.closeLookbackMinutes,
    signalIds: DEFAULT_SIGNAL_IDS,
  });

  await Promise.all([
    mkdir(outDir, { recursive: true }),
    mkdir(path.dirname(receiptPath), { recursive: true }),
    mkdir(path.dirname(summaryPath), { recursive: true }),
  ]);

  const manifestRows: Array<{
    signalId: Gate57BFrs15ManifestSignalId;
    path: string;
    manifestHash: string | undefined;
    fileSha256: string;
    rows: number;
    weeks: number;
    longRows: number;
    shortRows: number;
  }> = [];
  for (const signalId of DEFAULT_SIGNAL_IDS) {
    const manifest = build.manifests[signalId];
    const target = path.join(outDir, manifestFileName(signalId));
    const text = `${JSON.stringify(manifest, null, 2)}\n`;
    await writeFile(target, text, "utf8");
    const shape = build.source.shape[signalId];
    manifestRows.push({
      signalId,
      path: toRepoRelative(target),
      manifestHash: manifest.manifest_hash,
      fileSha256: sha256Text(text),
      rows: shape.rows,
      weeks: shape.weeks,
      longRows: shape.longRows,
      shortRows: shape.shortRows,
    });
  }

  const summary = {
    generated_at_utc: new Date().toISOString(),
    gate_id: GATE57B_GATE_ID,
    price_bundle_id: GATE55E_PRICE_BUNDLE_ID,
    lookback_weeks: build.source.lookbackWeeks,
    close_lookback_minutes: build.source.closeLookbackMinutes,
    requested_weeks: build.source.weeks.length,
    supported_weeks: build.source.supportedWeeks.length,
    unsupported_weeks: build.source.unsupportedWeeks.map((week) => ({
      week_open_utc: week.weekOpenUtc,
      decision_timestamp_utc: week.decisionTimestampUtc,
      lookback_timestamp_utc: week.lookbackTimestampUtc,
      missing_reason: week.missingReason,
    })),
    shape: build.source.shape,
    manifest_rows: manifestRows,
    first_supported_week: build.source.supportedWeeks[0]?.weekOpenUtc ?? null,
    last_supported_week: build.source.supportedWeeks.at(-1)?.weekOpenUtc ?? null,
    runtime_seconds: Math.round((Date.now() - started) / 100) / 10,
  };
  const summaryText = `${JSON.stringify(summary, null, 2)}\n`;
  await writeFile(summaryPath, summaryText, "utf8");

  const sourceSummaryHash = sha256Stable({
    source: build.source,
    manifestRows,
    summary_file_sha256: sha256Text(summaryText),
  });
  const receiptWithoutHash = renderReceipt({
    generatedAtUtc: new Date().toISOString(),
    cli,
    runtimeCommit,
    dirtyTree,
    summaryPath: toRepoRelative(summaryPath),
    sourceSummaryHash,
    manifestRows,
    source: build.source,
  });
  const receiptHash = sha256Text(receiptWithoutHash);
  const receiptText = `${receiptWithoutHash}Runtime seconds: ${summary.runtime_seconds}\n\nReceipt hash: \`${receiptHash}\`\n`;
  await writeFile(receiptPath, receiptText, "utf8");

  console.log(`Generated manifests: ${manifestRows.length}`);
  for (const row of manifestRows) {
    console.log(`${row.signalId}: rows=${row.rows} weeks=${row.weeks} hash=${row.manifestHash} path=${row.path}`);
  }
  console.log(`Summary: ${toRepoRelative(summaryPath)}`);
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
