import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

loadEnvConfig(process.cwd());

import { PAIRS_BY_ASSET_CLASS } from "../../src/lib/cotPairs";
import { getPool } from "../../src/lib/db";
import {
  buildFxStrengthHistoryIndex,
  buildFxWeeklyStrengthContextFromIndex,
  deriveFxStrengthHistoryAtTimesFromM1,
  FX_M1_STRENGTH_DERIVATION_VERSION,
  getFxWeeklyStrengthDecisionPoints,
  INSTITUTIONAL_M1_PAIR_COVERAGE_PCT,
  type FxWeeklyPairStrengthDecision,
  type FxWeeklyStrengthDecisionPointId,
  type HistoricalStrengthWindow,
} from "../../src/lib/strength/historicalStrength";
import { normalizeWeekOpenUtc } from "../../src/lib/weekAnchor";

const GATE = "Gate 55F: canonical-strength-source-context-proof";
const PRICE_BUNDLE_ID = "gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953";
const DEFAULT_FROM_WEEK = "2019-01-07T00:00:00.000Z";
const DEFAULT_TO_WEEK = "2026-06-08T00:00:00.000Z";
const DEFAULT_OUT_DIR = path.join("app", "reports", "data-verification", "gate55");
const DEFAULT_WINDOWS: HistoricalStrengthWindow[] = ["1h", "4h", "24h", "1w", "1m"];
const POINT_IDS: FxWeeklyStrengthDecisionPointId[] = ["friday_close", "market_open_confirmation"];
const FX_PAIRS = PAIRS_BY_ASSET_CLASS.fx.map((row) => row.pair.toUpperCase());

type CliOptions = {
  fromWeek: string;
  toWeek: string;
  windows: HistoricalStrengthWindow[];
  cadenceMinutes: number;
  marketOpenForwardMinutes: number;
  holidayMarketOpenForwardMinutes: number;
  fridayBackwardMinutes: number;
  minPairCoveragePct: number;
  batchWeeks: number;
  outDir: string;
  noWrite: boolean;
};

type PointWeekSummary = {
  weekOpenUtc: string;
  pointId: FxWeeklyStrengthDecisionPointId;
  rows: number;
  availableRows: number;
  directionalRows: number;
  fullWindowRows: number;
  partialWindowRows: number;
  missingRows: number;
  longRows: number;
  shortRows: number;
  neutralRows: number;
  minAvailableWindows: number;
  maxAvailableWindows: number;
  missingWindowLookups: number;
  resolvedMinUtc: string | null;
  resolvedMaxUtc: string | null;
  missingReasons: Record<string, number>;
};

type PointSummary = {
  pointId: FxWeeklyStrengthDecisionPointId;
  weeks: number;
  parentRows: number;
  retainedRows: number;
  removedRows: number;
  fullSignalWeeks: number;
  fullHorizonWeeks: number;
  partialSignalWeeks: number;
  unavailableWeeks: number;
  partialHorizonWeeks: number;
  longRows: number;
  shortRows: number;
  neutralRows: number;
  missingWindowLookups: number;
  minAvailableWindows: number;
  maxAvailableWindows: number;
  missingReasons: Record<string, number>;
};

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function hasFlag(name: string) {
  return process.argv.slice(2).includes(`--${name}`);
}

function parsePositiveInteger(value: string | null, fallback: number) {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseNumber(value: string | null, fallback: number) {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeIso(value: string, label: string) {
  const normalizedWeek = normalizeWeekOpenUtc(value);
  if (normalizedWeek) return normalizedWeek;
  const parsed = DateTime.fromISO(value, { zone: "utc" });
  if (!parsed.isValid) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed.toUTC().toISO() ?? value;
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
  if (!value) return DEFAULT_WINDOWS;
  return [...new Set(value.split(",").map((item) => parseWindow(item.trim())).filter(Boolean))];
}

function parseCli(): CliOptions {
  return {
    fromWeek: normalizeIso(argValue("from-week") ?? DEFAULT_FROM_WEEK, "from-week"),
    toWeek: normalizeIso(argValue("to-week") ?? DEFAULT_TO_WEEK, "to-week"),
    windows: parseWindows(argValue("windows")),
    cadenceMinutes: parsePositiveInteger(argValue("cadence-minutes") ?? argValue("cadence"), 15),
    marketOpenForwardMinutes: parsePositiveInteger(
      argValue("market-open-forward-minutes") ?? argValue("monday-open-forward-minutes"),
      180,
    ),
    holidayMarketOpenForwardMinutes: parsePositiveInteger(argValue("holiday-market-open-forward-minutes"), 2880),
    fridayBackwardMinutes: parsePositiveInteger(argValue("friday-backward-minutes"), 60),
    minPairCoveragePct: Math.max(
      0,
      Math.min(100, parseNumber(argValue("min-pair-coverage-pct"), INSTITUTIONAL_M1_PAIR_COVERAGE_PCT)),
    ),
    batchWeeks: parsePositiveInteger(argValue("batch-weeks"), 8),
    outDir: argValue("out-dir") ?? DEFAULT_OUT_DIR,
    noWrite: hasFlag("no-write"),
  };
}

function assertCanonicalDbOnly() {
  const localMode = process.env.LIMNI_M1_WAREHOUSE?.trim();
  const localPath = process.env.LIMNI_M1_SQLITE_PATH?.trim();
  if (localMode || localPath) {
    throw new Error(
      [
        "Gate 55F source-context proof must use canonical_price_bars, not local SQLite staging.",
        `Unset LIMNI_M1_WAREHOUSE and LIMNI_M1_SQLITE_PATH before running. mode=${localMode ?? "-"} path=${localPath ?? "-"}`,
      ].join(" "),
    );
  }
}

function generateWeeks(fromWeek: string, toWeek: string) {
  const from = DateTime.fromISO(fromWeek, { zone: "utc" });
  const to = DateTime.fromISO(toWeek, { zone: "utc" });
  if (!from.isValid || !to.isValid || to <= from) {
    throw new Error(`Invalid week range: from=${fromWeek} to=${toWeek}`);
  }
  const weeks: string[] = [];
  for (let cursor = from; cursor.toMillis() < to.toMillis(); cursor = cursor.plus({ weeks: 1 })) {
    weeks.push(cursor.toUTC().toISO() ?? cursor.toJSDate().toISOString());
  }
  return weeks;
}

function chunkArray<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function weeklyContextSnapshotTimes(options: {
  weeks: string[];
  cadenceMinutes: number;
  marketOpenForwardMinutes: number;
  holidayMarketOpenForwardMinutes: number;
  fridayBackwardMinutes: number;
}) {
  const times = new Set<string>();
  const cadence = Math.max(1, Math.floor(options.cadenceMinutes));

  for (const weekOpenUtc of options.weeks) {
    for (const point of getFxWeeklyStrengthDecisionPoints(weekOpenUtc, {
      marketOpenForwardMinutes: options.marketOpenForwardMinutes,
    })) {
      const requested = DateTime.fromISO(point.requestedTimeUtc, { zone: "utc" });
      if (!requested.isValid) continue;
      if (point.lookupMode === "at_or_after") {
        const maxForward = marketOpenForwardMinutesForWeek(weekOpenUtc, options);
        for (let offset = 0; offset <= maxForward; offset += cadence) {
          times.add(requested.plus({ minutes: offset }).toUTC().toISO() ?? point.requestedTimeUtc);
        }
      } else {
        const backward = Math.max(0, Math.floor(options.fridayBackwardMinutes));
        for (let offset = backward; offset >= 0; offset -= cadence) {
          times.add(requested.minus({ minutes: offset }).toUTC().toISO() ?? point.requestedTimeUtc);
        }
      }
    }
  }

  return [...times].sort();
}

function marketOpenForwardMinutesForWeek(
  weekOpenUtc: string,
  options: Pick<CliOptions, "marketOpenForwardMinutes" | "holidayMarketOpenForwardMinutes">,
) {
  const week = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (!week.isValid) return options.marketOpenForwardMinutes;
  const monthDay = week.toFormat("MM-dd");
  const isHolidayReopenWeek = monthDay === "12-25" ||
    monthDay === "12-26" ||
    monthDay === "01-01" ||
    monthDay === "01-02";
  return isHolidayReopenWeek
    ? Math.max(options.marketOpenForwardMinutes, options.holidayMarketOpenForwardMinutes)
    : options.marketOpenForwardMinutes;
}

function countBy<T>(rows: T[], key: (row: T) => string | null | undefined) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const value = key(row);
    if (!value) continue;
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function minIso(values: Array<string | null>) {
  const millis = values
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));
  return millis.length > 0 ? new Date(Math.min(...millis)).toISOString() : null;
}

function maxIso(values: Array<string | null>) {
  const millis = values
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));
  return millis.length > 0 ? new Date(Math.max(...millis)).toISOString() : null;
}

function summarizePointWeek(options: {
  weekOpenUtc: string;
  pointId: FxWeeklyStrengthDecisionPointId;
  rows: FxWeeklyPairStrengthDecision[];
  windowCount: number;
}): PointWeekSummary {
  const rows = options.rows;
  const availableRows = rows.filter((row) => row.available).length;
  const directionalRows = rows.filter((row) => row.available && (row.direction === "LONG" || row.direction === "SHORT")).length;
  const fullWindowRows = rows.filter((row) => row.available && row.availableWindows === options.windowCount).length;
  const partialWindowRows = rows.filter((row) =>
    row.available && row.availableWindows > 0 && row.availableWindows < options.windowCount).length;
  const availableWindowCounts = rows.map((row) => row.availableWindows);
  return {
    weekOpenUtc: options.weekOpenUtc,
    pointId: options.pointId,
    rows: rows.length,
    availableRows,
    directionalRows,
    fullWindowRows,
    partialWindowRows,
    missingRows: rows.length - availableRows,
    longRows: rows.filter((row) => row.available && row.direction === "LONG").length,
    shortRows: rows.filter((row) => row.available && row.direction === "SHORT").length,
    neutralRows: rows.filter((row) => !row.available || row.direction === "NEUTRAL").length,
    minAvailableWindows: availableWindowCounts.length > 0 ? Math.min(...availableWindowCounts) : 0,
    maxAvailableWindows: availableWindowCounts.length > 0 ? Math.max(...availableWindowCounts) : 0,
    missingWindowLookups: rows.reduce(
      (sum, row) => sum + row.windows.filter((window) => !window.available).length,
      0,
    ),
    resolvedMinUtc: minIso(rows.map((row) => row.resolvedTimeUtc)),
    resolvedMaxUtc: maxIso(rows.map((row) => row.resolvedTimeUtc)),
    missingReasons: countBy(rows, (row) => row.missingReason),
  };
}

function summarizePoint(pointId: FxWeeklyStrengthDecisionPointId, weeks: PointWeekSummary[]): PointSummary {
  const rows = weeks.filter((week) => week.pointId === pointId);
  const parentRows = rows.reduce((sum, row) => sum + row.rows, 0);
  const retainedRows = rows.reduce((sum, row) => sum + row.directionalRows, 0);
  const removedRows = parentRows - retainedRows;
  const minAvailableWindows = rows.length > 0
    ? Math.min(...rows.map((row) => row.minAvailableWindows))
    : 0;
  const maxAvailableWindows = rows.length > 0
    ? Math.max(...rows.map((row) => row.maxAvailableWindows))
    : 0;
  const missingReasons: Record<string, number> = {};
  for (const row of rows) {
    for (const [reason, count] of Object.entries(row.missingReasons)) {
      missingReasons[reason] = (missingReasons[reason] ?? 0) + count;
    }
  }

  return {
    pointId,
    weeks: rows.length,
    parentRows,
    retainedRows,
    removedRows,
    fullSignalWeeks: rows.filter((row) => row.directionalRows === row.rows).length,
    fullHorizonWeeks: rows.filter((row) => row.fullWindowRows === row.rows).length,
    partialSignalWeeks: rows.filter((row) => row.directionalRows > 0 && row.directionalRows < row.rows).length,
    unavailableWeeks: rows.filter((row) => row.directionalRows === 0).length,
    partialHorizonWeeks: rows.filter((row) => row.directionalRows === row.rows && row.fullWindowRows < row.rows).length,
    longRows: rows.reduce((sum, row) => sum + row.longRows, 0),
    shortRows: rows.reduce((sum, row) => sum + row.shortRows, 0),
    neutralRows: rows.reduce((sum, row) => sum + row.neutralRows, 0),
    missingWindowLookups: rows.reduce((sum, row) => sum + row.missingWindowLookups, 0),
    minAvailableWindows,
    maxAvailableWindows,
    missingReasons,
  };
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function formatPointTable(pointSummaries: PointSummary[]) {
  return pointSummaries.map((row) =>
    `| ${row.pointId} | ${row.weeks} | ${row.parentRows} | ${row.retainedRows} | ${row.removedRows} | ${row.fullSignalWeeks} | ${row.fullHorizonWeeks} | ${row.partialSignalWeeks} | ${row.partialHorizonWeeks} | ${row.unavailableWeeks} | ${row.longRows} | ${row.shortRows} | ${row.missingWindowLookups} | ${row.minAvailableWindows}-${row.maxAvailableWindows} |`,
  );
}

function formatWeekTable(rows: PointWeekSummary[]) {
  return rows.slice(0, 60).map((row) =>
    `| ${row.weekOpenUtc.slice(0, 10)} | ${row.pointId} | ${row.directionalRows}/${row.rows} | ${row.fullWindowRows}/${row.rows} | ${row.minAvailableWindows}-${row.maxAvailableWindows} | ${row.missingWindowLookups} | ${row.resolvedMinUtc ?? "-"} | ${row.resolvedMaxUtc ?? "-"} | ${Object.entries(row.missingReasons).map(([key, count]) => `${key}:${count}`).join("; ") || "-"} |`,
  );
}

function renderMarkdown(receipt: {
  status: string;
  generatedAtUtc: string;
  receiptHash: string;
  options: CliOptions;
  identity: Record<string, unknown>;
  summary: Record<string, unknown>;
  pointSummaries: PointSummary[];
  nonFullSignalWeeks: PointWeekSummary[];
  nonFullHorizonWeeks: PointWeekSummary[];
  files: { json: string; markdown: string };
}) {
  const lines = [
    "# Gate 55F Canonical Strength Source Context Proof",
    "",
    `Generated: ${receipt.generatedAtUtc}`,
    "",
    "## Result",
    "",
    `- Status: ${receipt.status}`,
    `- Gate: ${GATE}`,
    `- Price bundle ID: \`${PRICE_BUNDLE_ID}\``,
    `- Derivation version: \`${FX_M1_STRENGTH_DERIVATION_VERSION}\``,
    "- Source mutation by this script: false",
    "- Local SQLite staging source allowed: false",
    "- No COT+Strength combination: true",
    "- No regime/risk/execution/live work: true",
    "- No selected-vs-fade performance run: true",
    "",
    "## Scope",
    "",
    `- Weeks: ${receipt.options.fromWeek} through before ${receipt.options.toWeek}`,
    `- Week count: ${receipt.summary.weeks}`,
    `- FX pairs: ${receipt.summary.pairs}`,
    `- Windows: ${receipt.options.windows.join(", ")}`,
    `- Pair-window coverage threshold: ${receipt.options.minPairCoveragePct}%`,
    `- Market-open forward search: ${receipt.options.marketOpenForwardMinutes} minutes`,
    `- Holiday market-open forward search: ${receipt.options.holidayMarketOpenForwardMinutes} minutes`,
    `- Friday backward search: ${receipt.options.fridayBackwardMinutes} minutes`,
    `- Snapshot cadence: ${receipt.options.cadenceMinutes} minutes`,
    `- Batch weeks: ${receipt.options.batchWeeks}`,
    "",
    "## Point Coverage",
    "",
    "| Point | Weeks | Parent rows | Retained rows | Removed rows | Full signal weeks | Full horizon weeks | Partial signal weeks | Partial horizon weeks | Unavailable weeks | Long rows | Short rows | Missing window lookups | Available windows range |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|",
    ...formatPointTable(receipt.pointSummaries),
    "",
    "## Derived Snapshot Coverage",
    "",
    `- Snapshot times: ${receipt.summary.snapshotTimes}`,
    `- Snapshot rows: ${receipt.summary.snapshotRows}`,
    `- Complete snapshot rows: ${receipt.summary.completeSnapshotRows}`,
    `- Incomplete snapshot rows: ${receipt.summary.incompleteSnapshotRows}`,
    `- Coverage range: ${receipt.summary.minCoveragePct}% to ${receipt.summary.maxCoveragePct}%`,
    "",
    "Incomplete snapshot rows are permitted only outside the retained full-horizon decision set. Retained baseline rows above require all requested Strength windows to be available for the pair decision.",
    "",
    "## Non-Full Signal Weeks",
    "",
    receipt.nonFullSignalWeeks.length === 0
      ? "None."
      : "| Week | Point | Directional rows | Full-window rows | Available window range | Missing window lookups | Resolved min | Resolved max | Missing reasons |",
    ...(receipt.nonFullSignalWeeks.length === 0
      ? []
      : [
          "|---|---|---:|---:|---|---:|---|---|---|",
          ...formatWeekTable(receipt.nonFullSignalWeeks),
        ]),
    "",
    "## Non-Full Horizon Weeks",
    "",
    receipt.nonFullHorizonWeeks.length === 0
      ? "None."
      : "| Week | Point | Directional rows | Full-window rows | Available window range | Missing window lookups | Resolved min | Resolved max | Missing reasons |",
    ...(receipt.nonFullHorizonWeeks.length === 0
      ? []
      : [
          "|---|---|---:|---:|---|---:|---|---|---|",
          ...formatWeekTable(receipt.nonFullHorizonWeeks),
        ]),
    "",
    "## Decision Boundary",
    "",
    "Gate 55F proves whether canonical M1-derived Friday Strength decision context can produce complete weekly 28-pair matrices. It does not choose selected, fade, buckets, thresholds, horizons by PnL, or a final Strength baseline.",
    "",
    "## Files",
    "",
    `- JSON: ${receipt.files.json}`,
    `- Markdown: ${receipt.files.markdown}`,
    "",
    `Receipt hash: \`${receipt.receiptHash}\``,
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  assertCanonicalDbOnly();
  const options = parseCli();
  const weeks = generateWeeks(options.fromWeek, options.toWeek);
  if (weeks.length === 0) throw new Error("No weeks selected.");

  const startedAt = Date.now();
  const pointWeeks: PointWeekSummary[] = [];
  let snapshotTimes = 0;
  let snapshotRows = 0;
  let completeSnapshotRows = 0;
  let incompleteSnapshotRows = 0;
  let minCoveragePct = Number.POSITIVE_INFINITY;
  let maxCoveragePct = Number.NEGATIVE_INFINITY;

  const batches = chunkArray(weeks, options.batchWeeks);
  for (const [batchIndex, batchWeeks] of batches.entries()) {
    const batchStartedAt = Date.now();
    const times = weeklyContextSnapshotTimes({
      weeks: batchWeeks,
      cadenceMinutes: options.cadenceMinutes,
      marketOpenForwardMinutes: options.marketOpenForwardMinutes,
      holidayMarketOpenForwardMinutes: options.holidayMarketOpenForwardMinutes,
      fridayBackwardMinutes: options.fridayBackwardMinutes,
    });
    const derived = await deriveFxStrengthHistoryAtTimesFromM1({
      snapshotTimesUtc: times,
      windows: options.windows,
      minPairCoveragePct: options.minPairCoveragePct,
    });
    const index = buildFxStrengthHistoryIndex(derived.snapshots);
    snapshotTimes += derived.summary.snapshotsGenerated;
    snapshotRows += derived.summary.rowsGenerated;
    completeSnapshotRows += derived.summary.completeRows;
    incompleteSnapshotRows += derived.summary.incompleteRows;
    minCoveragePct = Math.min(minCoveragePct, derived.summary.minCoveragePct);
    maxCoveragePct = Math.max(maxCoveragePct, derived.summary.maxCoveragePct);

    for (const weekOpenUtc of batchWeeks) {
      const context = buildFxWeeklyStrengthContextFromIndex({
        weekOpenUtc,
        index,
        pairs: FX_PAIRS,
        windows: options.windows,
        marketOpenForwardMinutes: marketOpenForwardMinutesForWeek(weekOpenUtc, options),
      });
      for (const pointId of POINT_IDS) {
        pointWeeks.push(summarizePointWeek({
          weekOpenUtc,
          pointId,
          rows: context.rows.filter((row) => row.pointId === pointId),
          windowCount: options.windows.length,
        }));
      }
    }

    console.log(
      [
        `batch=${batchIndex + 1}/${batches.length}`,
        `weeks=${batchWeeks[0]?.slice(0, 10)}..${batchWeeks.at(-1)?.slice(0, 10)}`,
        `snapshotTimes=${derived.summary.snapshotsGenerated}`,
        `rows=${derived.summary.rowsGenerated}`,
        `completeRows=${derived.summary.completeRows}`,
        `elapsed=${((Date.now() - batchStartedAt) / 1000).toFixed(2)}s`,
      ].join(" | "),
    );
  }

  const pointSummaries = POINT_IDS.map((pointId) => summarizePoint(pointId, pointWeeks));
  const nonFullSignalWeeks = pointWeeks.filter((row) => row.directionalRows !== row.rows);
  const nonFullHorizonWeeks = pointWeeks.filter((row) => row.fullWindowRows !== row.rows);
  const allPointsFullSignal = pointSummaries.every((row) => row.fullSignalWeeks === weeks.length && row.removedRows === 0);
  const allPointsFullHorizon = pointSummaries.every((row) => row.fullHorizonWeeks === weeks.length);
  const status = allPointsFullSignal && allPointsFullHorizon
    ? "PASS_CANONICAL_STRENGTH_SOURCE_CONTEXT_28_28_FULL_HORIZON"
    : allPointsFullSignal
      ? "PASS_CANONICAL_STRENGTH_SOURCE_CONTEXT_28_28_WITH_PARTIAL_HORIZON_CAVEATS"
      : "BLOCKED_CANONICAL_STRENGTH_SOURCE_CONTEXT_NOT_28_28";

  const receiptBase = {
    status,
    gate: GATE,
    generatedAtUtc: new Date().toISOString(),
    noWrite: options.noWrite,
    identity: {
      priceBundleId: PRICE_BUNDLE_ID,
      priceBundleReceipt: "docs/research/GATE55E_FROZEN_CANONICAL_PRICE_BUNDLE_V1_RECEIPT_2026-06-24.md",
      derivationVersion: FX_M1_STRENGTH_DERIVATION_VERSION,
      sourceTable: "canonical_price_bars",
      sourceTimeframe: "1m",
      sourceProvider: "canonical_price_bars",
      localSqliteSourceAllowed: false,
      localSqliteEnv: {
        LIMNI_M1_WAREHOUSE: process.env.LIMNI_M1_WAREHOUSE ?? null,
        LIMNI_M1_SQLITE_PATH: process.env.LIMNI_M1_SQLITE_PATH ?? null,
      },
    },
    options,
    summary: {
      weeks: weeks.length,
      pairs: FX_PAIRS.length,
      expectedParentRowsPerPoint: weeks.length * FX_PAIRS.length,
      points: POINT_IDS,
      snapshotTimes,
      snapshotRows,
      completeSnapshotRows,
      incompleteSnapshotRows,
      minCoveragePct: Number.isFinite(minCoveragePct) ? Number(minCoveragePct.toFixed(4)) : 0,
      maxCoveragePct: Number.isFinite(maxCoveragePct) ? Number(maxCoveragePct.toFixed(4)) : 0,
      elapsedSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(2)),
    },
    pointSummaries,
    nonFullSignalWeeks,
    nonFullHorizonWeeks,
    hardLocks: {
      noCotStrengthCombination: true,
      noRegimeFilters: true,
      noBprRrpRetests: true,
      noPppNeerReer: true,
      noExecutionOptimization: true,
      noRiskOverlay: true,
      noMt5LiveBot: true,
      noFinalSystemSelection: true,
      noSelectedVsFadePerformanceRun: true,
    },
    command: process.argv.join(" "),
  };
  const receiptHash = sha256(JSON.stringify(receiptBase));
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  await mkdir(options.outDir, { recursive: true });
  const jsonPath = path.join(options.outDir, `gate55f-strength-source-context-${stamp}.json`);
  const mdPath = path.join(options.outDir, `gate55f-strength-source-context-${stamp}.md`);
  const receipt = {
    ...receiptBase,
    receiptHash,
    files: {
      json: jsonPath,
      markdown: mdPath,
    },
  };

  if (!options.noWrite) {
    await writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    await writeFile(mdPath, renderMarkdown(receipt), "utf8");
  }

  console.log(`Gate 55F status: ${status}`);
  console.log(`Weeks: ${weeks.length}`);
  for (const point of pointSummaries) {
    console.log(
      [
        `point=${point.pointId}`,
        `retained=${point.retainedRows}/${point.parentRows}`,
        `fullSignalWeeks=${point.fullSignalWeeks}/${point.weeks}`,
        `fullHorizonWeeks=${point.fullHorizonWeeks}/${point.weeks}`,
        `missingWindowLookups=${point.missingWindowLookups}`,
      ].join(" | "),
    );
  }
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);
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
  });
