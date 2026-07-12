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
  GATE57C_FEATURE_BUNDLE_ID,
  GATE57C_GATE_ID,
  GATE57C_HYPOTHESIS_ID,
  GATE57D_FEATURE_BUNDLE_ID,
  GATE57D_GATE_ID,
  GATE57D_HYPOTHESIS_ID,
  GATE57E_FEATURE_BUNDLE_ID,
  GATE57E_GATE_ID,
  GATE57E_HYPOTHESIS_ID,
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
  signalIds: Gate57BFrs15ManifestSignalId[];
  gateId: string;
  hypothesisId: string;
  featureBundleId: string;
  manifestIdPrefix: string;
  signalIdPrefix: string;
  rowIdPrefix: string;
  decisionScopePrefix: string;
  manifestFilePrefix: string;
  receiptTitle: string;
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

const GATE57C_SIGNAL_IDS: Gate57BFrs15ManifestSignalId[] = [
  "compressed_selected",
  "middle_selected",
  "extreme_selected",
  "compressed_fade",
  "middle_fade",
  "extreme_fade",
  "binary_lifecycle_selected_else_extreme_fade",
  "parent_selected",
  "parent_fade",
  "no_extreme_selected",
];

const GATE57D_SIGNAL_IDS: Gate57BFrs15ManifestSignalId[] = [
  "parent_selected",
  "parent_fade",
  "binary_lifecycle_selected_else_extreme_fade",
  "compressed_selected_remainder_fade",
  "compressed_selected_middle_fade_extreme_selected",
];

const GATE57E_SIGNAL_IDS: Gate57BFrs15ManifestSignalId[] = [
  "parent_selected",
  "binary_lifecycle_selected_else_extreme_fade",
  "compressed_selected_remainder_fade",
  "phase_conditioned_remainder",
  "phase_conditioned_all28",
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

function parseSignalIds(value: string | null, fallback: Gate57BFrs15ManifestSignalId[]) {
  if (!value) return fallback;
  const valid = new Set<Gate57BFrs15ManifestSignalId>([
    "parent_selected",
    "parent_fade",
    "compressed_selected",
    "middle_selected",
    "extreme_selected",
    "compressed_fade",
    "middle_fade",
    "extreme_fade",
    "no_extreme_selected",
    "persistent_selected",
    "flip_selected",
    "binary_lifecycle_selected_else_extreme_fade",
    "compressed_selected_remainder_fade",
    "compressed_selected_middle_fade_extreme_selected",
    "phase_conditioned_remainder",
    "phase_conditioned_all28",
  ]);
  const parsed = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  for (const signalId of parsed) {
    if (!valid.has(signalId as Gate57BFrs15ManifestSignalId)) {
      throw new Error(`Unknown Gate 57B/57C/57D/57E FRS15 signal id: ${signalId}`);
    }
  }
  return [...new Set(parsed as Gate57BFrs15ManifestSignalId[])];
}

function helpText() {
  return `
Generate Friday-only 15-week relative Strength lifecycle manifests for Gate 57B, Gate 57C, Gate 57D, or Gate 57E.

Common:
  --preset=gate57b|gate57c|gate57d|gate57e  Default: gate57b
  --out-dir=<path>                  Default: engine/reports/gate57b-friday-strength15w/manifests
  --summary-path=<path>             Default: engine/reports/gate57b-friday-strength15w/manifest-summary.json
  --receipt-path=<path>             Default: docs/research/gates/gate57/receipts/GATE57B_FRIDAY_STRENGTH_15W_MANIFEST_BUILD_2026-06-26.md
  --signals=<a,b,c>                 Optional signal id allow-list
  --from-week=<iso>                 Default: ${GATE57B_DEFAULT_FROM_WEEK}
  --to-week=<iso>                   Exclusive. Default: ${GATE57B_DEFAULT_TO_WEEK_EXCLUSIVE}
  --lookback-weeks=<n>              Default: ${GATE57B_LOOKBACK_WEEKS}
  --close-lookback-minutes=<n>      Default: 2880

Default Gate 57B signals:
  ${DEFAULT_SIGNAL_IDS.join(", ")}

Default Gate 57C signals:
  ${GATE57C_SIGNAL_IDS.join(", ")}

Default Gate 57D signals:
  ${GATE57D_SIGNAL_IDS.join(", ")}

Default Gate 57E signals:
  ${GATE57E_SIGNAL_IDS.join(", ")}

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
  const preset = argValue("preset") ?? "gate57b";
  if (preset !== "gate57b" && preset !== "gate57c" && preset !== "gate57d" && preset !== "gate57e") {
    throw new Error(`Unsupported preset: ${preset}`);
  }
  const gate57c = preset === "gate57c";
  const gate57d = preset === "gate57d";
  const gate57e = preset === "gate57e";
  const defaultOutDir = gate57e
    ? path.join("engine", "reports", "gate57e-frs15-phase-conditioned-remainder", "manifests")
    : gate57d
    ? path.join("engine", "reports", "gate57d-frs15-compressed-remainder-fade", "manifests")
    : gate57c
      ? path.join("engine", "reports", "gate57c-frs15-binary-lifecycle", "manifests")
      : path.join("engine", "reports", "gate57b-friday-strength15w", "manifests");
  const defaultSummaryPath = gate57e
    ? path.join("engine", "reports", "gate57e-frs15-phase-conditioned-remainder", "manifest-summary.json")
    : gate57d
    ? path.join("engine", "reports", "gate57d-frs15-compressed-remainder-fade", "manifest-summary.json")
    : gate57c
      ? path.join("engine", "reports", "gate57c-frs15-binary-lifecycle", "manifest-summary.json")
      : path.join("engine", "reports", "gate57b-friday-strength15w", "manifest-summary.json");
  const defaultReceiptPath = path.join(
    "docs",
    "research",
    "gates",
    "gate57",
    "receipts",
    gate57e
      ? "GATE57E_FRS15_PHASE_CONDITIONED_REMAINDER_MANIFEST_BUILD_2026-06-26.md"
      : gate57d
      ? "GATE57D_FRS15_COMPRESSED_GO_REMAINDER_FADE_MANIFEST_BUILD_2026-06-26.md"
      : gate57c
        ? "GATE57C_FRS15_BINARY_LIFECYCLE_MANIFEST_BUILD_2026-06-26.md"
        : "GATE57B_FRIDAY_STRENGTH_15W_MANIFEST_BUILD_2026-06-26.md",
  );
  return {
    fromWeek: argValue("from-week") ?? GATE57B_DEFAULT_FROM_WEEK,
    toWeekExclusive: argValue("to-week") ?? GATE57B_DEFAULT_TO_WEEK_EXCLUSIVE,
    lookbackWeeks: parsePositiveInteger(argValue("lookback-weeks"), GATE57B_LOOKBACK_WEEKS),
    closeLookbackMinutes: parsePositiveInteger(argValue("close-lookback-minutes"), 2880),
    outDir: argValue("out-dir") ?? defaultOutDir,
    summaryPath: argValue("summary-path") ?? defaultSummaryPath,
    receiptPath: argValue("receipt-path") ?? defaultReceiptPath,
    signalIds: parseSignalIds(
      argValue("signals"),
      gate57e ? GATE57E_SIGNAL_IDS : gate57d ? GATE57D_SIGNAL_IDS : gate57c ? GATE57C_SIGNAL_IDS : DEFAULT_SIGNAL_IDS,
    ),
    gateId: argValue("gate-id") ?? (gate57e ? GATE57E_GATE_ID : gate57d ? GATE57D_GATE_ID : gate57c ? GATE57C_GATE_ID : GATE57B_GATE_ID),
    hypothesisId: argValue("hypothesis-id") ?? (
      gate57e ? GATE57E_HYPOTHESIS_ID : gate57d ? GATE57D_HYPOTHESIS_ID : gate57c ? GATE57C_HYPOTHESIS_ID : "friday_strength_15w_relative_lifecycle"
    ),
    featureBundleId: argValue("feature-bundle-id") ?? (
      gate57e ? GATE57E_FEATURE_BUNDLE_ID : gate57d ? GATE57D_FEATURE_BUNDLE_ID : gate57c ? GATE57C_FEATURE_BUNDLE_ID : "gate57b_friday_relative_strength_15w_v1"
    ),
    manifestIdPrefix: argValue("manifest-id-prefix") ?? (
      gate57e ? "gate57e_frs15_phase_conditioned_remainder" : gate57d ? "gate57d_frs15_compressed_remainder_fade" : gate57c ? "gate57c_frs15_binary_lifecycle" : "gate57b_friday_relative_strength_15w"
    ),
    signalIdPrefix: argValue("signal-id-prefix") ?? (gate57e ? "gate57e_frs15" : gate57d ? "gate57d_frs15" : gate57c ? "gate57c_frs15" : "gate57b_frs15"),
    rowIdPrefix: argValue("row-id-prefix") ?? (gate57e ? "gate57e" : gate57d ? "gate57d" : gate57c ? "gate57c" : "gate57b"),
    decisionScopePrefix: argValue("decision-scope-prefix") ?? (
      gate57e ? "fx_28pair_weekly_frs15_phase_conditioned_remainder" : gate57d ? "fx_28pair_weekly_frs15_compressed_remainder_fade" : gate57c ? "fx_28pair_weekly_frs15_binary_lifecycle" : "fx_28pair_weekly_friday_relative_strength_15w"
    ),
    manifestFilePrefix: argValue("manifest-file-prefix") ?? (
      gate57e ? "gate57e-frs15-phase-conditioned-remainder" : gate57d ? "gate57d-frs15-compressed-remainder-fade" : gate57c ? "gate57c-frs15-binary-lifecycle" : "gate57b-friday-relative-strength-15w"
    ),
    receiptTitle: argValue("receipt-title") ?? (
      gate57e ? "Gate 57E FRS15 Phase-Conditioned Remainder Manifest Build" : gate57d ? "Gate 57D FRS15 Compressed-Go Remainder-Fade Manifest Build" : gate57c ? "Gate 57C FRS15 Binary Lifecycle Manifest Build" : "Gate 57B Friday Strength 15W Manifest Build"
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

function manifestFileName(signalId: Gate57BFrs15ManifestSignalId, prefix: string) {
  return `${prefix}-${signalId}.manifest.json`;
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
    `# ${options.cli.receiptTitle}`,
    "",
    `Generated: ${options.generatedAtUtc}`,
    "",
    "## Result",
    "",
    `- Gate: ${options.cli.gateId}`,
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
      cli.receiptTitle,
      `from=${cli.fromWeek}`,
      `toExclusive=${cli.toWeekExclusive}`,
      `lookbackWeeks=${cli.lookbackWeeks}`,
      `closeLookbackMinutes=${cli.closeLookbackMinutes}`,
      `signals=${cli.signalIds.join(",")}`,
    ].join(" | "),
  );
  const build = await buildGate57BFridayRelativeStrength15wManifests({
    fromWeek: cli.fromWeek,
    toWeekExclusive: cli.toWeekExclusive,
    lookbackWeeks: cli.lookbackWeeks,
    closeLookbackMinutes: cli.closeLookbackMinutes,
    signalIds: cli.signalIds,
    gateId: cli.gateId,
    hypothesisId: cli.hypothesisId,
    featureBundleId: cli.featureBundleId,
    manifestIdPrefix: cli.manifestIdPrefix,
    signalIdPrefix: cli.signalIdPrefix,
    rowIdPrefix: cli.rowIdPrefix,
    decisionScopePrefix: cli.decisionScopePrefix,
    sourceContextIds: [
      "docs/research/GATE55E_FROZEN_CANONICAL_PRICE_BUNDLE_V1_RECEIPT_2026-06-24.md",
      "docs/research/gates/gate57/GATE57A0B_DURABLE_PAIR_WEEK_PATH_OUTCOME_WAREHOUSE_2026-06-26.md",
      ...(cli.gateId === GATE57C_GATE_ID || cli.gateId === GATE57D_GATE_ID || cli.gateId === GATE57E_GATE_ID
        ? ["docs/research/gates/gate57/GATE57B_FRIDAY_STRENGTH_15W_RELATIVE_LIFECYCLE_2026-06-26.md"]
        : []),
      ...(cli.gateId === GATE57D_GATE_ID || cli.gateId === GATE57E_GATE_ID
        ? ["docs/research/gates/gate57/GATE57C_FRS15_BINARY_LIFECYCLE_RULE_TEST_2026-06-26.md"]
        : []),
      ...(cli.gateId === GATE57E_GATE_ID
        ? ["docs/research/gates/gate57/GATE57D_FRS15_COMPRESSED_GO_REMAINDER_FADE_RULE_2026-06-26.md"]
        : []),
    ],
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
  for (const signalId of cli.signalIds) {
    const manifest = build.manifests[signalId];
    const target = path.join(outDir, manifestFileName(signalId, cli.manifestFilePrefix));
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
    gate_id: cli.gateId,
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
