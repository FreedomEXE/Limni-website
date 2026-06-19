import {
  RESEARCH_MATRIX_DATASET_VERSION,
  RESEARCH_MATRIX_LOGIC_VERSION,
  RESEARCH_MATRIX_QUESTION_SURFACES,
  RESEARCH_MATRIX_WAREHOUSE_TABLES,
  estimateResearchMatrixWarehouseRows,
} from "../../src/lib/research/matrixDataset";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";
import { getCanonicalHourlyCoverage } from "../../src/lib/canonicalHourlyBars";
import { PAIRS_BY_ASSET_CLASS } from "../../src/lib/cotPairs";
import { listSnapshotDates } from "../../src/lib/cotStore";
import { deriveCotReportDate } from "../../src/lib/dataSectionWeeks";
import { getPool } from "../../src/lib/db";
import { filterByModel, getCanonicalBasketWeekForModels } from "../../src/lib/performance/basketSource";
import { readLocalM1CoverageRows, shouldUseLocalM1Warehouse } from "../../src/lib/research/localM1Warehouse";
import {
  readFxWeeklyStrengthContexts,
  type FxWeeklyStrengthDecisionPointId,
  type HistoricalStrengthWindow,
} from "../../src/lib/strength/historicalStrength";
import { formatTradingWeekLabelIsoDate, normalizeWeekOpenUtc } from "../../src/lib/weekAnchor";

loadEnvConfig(process.cwd());

const FX_PAIRS = PAIRS_BY_ASSET_CLASS.fx.map((row) => row.pair.toUpperCase());
const FX_PAIR_SET = new Set(FX_PAIRS);
const DEFAULT_STRENGTH_WINDOWS: HistoricalStrengthWindow[] = ["1h", "4h", "24h"];
const DEFAULT_HEDGED_GRID_RECEIPT_DIR = "app/reports/data-verification/fx-hedged-adr-grid";
const DEFAULT_COVERAGE_MANIFEST_OUT_DIR = "app/reports/data-verification/research-matrix-coverage";
const SHUTDOWN_2025_FROM = "2025-10-06";
const SHUTDOWN_2025_TO = "2025-12-30";

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv
    .slice(2)
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length) ?? null;
}

function hasFlag(name: string) {
  return process.argv.slice(2).includes(`--${name}`);
}

function parseNumberArg(name: string, fallback: number) {
  const value = argValue(name);
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatInt(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function runEstimate() {
  const years = parseNumberArg("years", 7);
  const weeks = parseNumberArg("weeks", Math.ceil(years * 52));
  const pairs = parseNumberArg("pairs", 28);
  const variants = parseNumberArg("variants", 64);
  const averageFillsPerPairSide = parseNumberArg("average-fills-per-pair-side", 8);
  const estimate = estimateResearchMatrixWarehouseRows({
    weeks,
    pairs,
    variants,
    averageFillsPerPairSide,
  });

  console.log(`Research matrix dataset version: ${RESEARCH_MATRIX_DATASET_VERSION}`);
  console.log(`Research matrix logic version: ${RESEARCH_MATRIX_LOGIC_VERSION}`);
  console.log(`Tables: ${RESEARCH_MATRIX_WAREHOUSE_TABLES.join(", ")}`);
  console.log(`Question surfaces: ${RESEARCH_MATRIX_QUESTION_SURFACES.join(", ")}`);
  console.log(
    [
      "Row estimate",
      `weeks=${estimate.weeks}`,
      `pairs=${estimate.pairs}`,
      `variants=${estimate.variants}`,
      `sourceContexts=${formatInt(estimate.sourceContextRows)}`,
      `baseTradeOpportunities=${formatInt(estimate.baseTradeOpportunityRows)}`,
      `pairDecisions=${formatInt(estimate.pairDecisionRows)}`,
      `variantWeeks=${formatInt(estimate.variantWeekRows)}`,
      `tradeEvents=${formatInt(estimate.tradeEventRows)}`,
    ].join(" | "),
  );
}

type ReceiptInventoryEntry = {
  path: string;
  weekLabel: string;
  weekOpenUtc: string;
  generatedAtUtc: string | null;
  expectedPairCount: number | null;
  missingSymbols: number;
  defaultAdrSymbols: number;
  pathPoints: number | null;
};

type ManifestWeek = {
  year: number;
  weekLabel: string;
  weekOpenUtc: string;
  regime: "clean" | "source_shutdown";
  included: boolean;
  exclusionReason: string | null;
  cotReportDate: string;
  cotSnapshotAvailable: boolean;
};

type ReceiptCoverage = {
  available: boolean;
  count: number;
  latestPath: string | null;
  latestGeneratedAtUtc: string | null;
  expectedPairCount: number | null;
  missingSymbols: number | null;
  defaultAdrSymbols: number | null;
  pathPoints: number | null;
  valid: boolean;
};

type StrengthPointCoverage = {
  availableRows: number;
  directionalRows: number;
  missingRows: number;
  longRows: number;
  shortRows: number;
  neutralRows: number;
  resolvedTimes: string[];
};

type SourceDirectionCoverage = {
  dealerDirectionalRows: number;
  commercialDirectionalRows: number;
  dealerMissingSnapshotRows: number;
  commercialMissingSnapshotRows: number;
  dealerCommercialAgreementRows: number;
};

type WeekManifestRow = ManifestWeek & {
  receipt: ReceiptCoverage;
  m1Status: "complete" | "partial" | "missing" | "in_progress" | "not_checked";
  m1WeakPairs: string[];
  strength: Record<FxWeeklyStrengthDecisionPointId, StrengthPointCoverage>;
  sourceContext: SourceDirectionCoverage;
  ready: boolean;
  blockers: string[];
};

type YearManifest = {
  year: number;
  includedWeeks: number;
  excludedWeeks: number;
  priorFreezeWeeks: string[];
  requiredM1Weeks: number;
  m1Summary: {
    complete: number;
    partial: number;
    missing: number;
    inProgress: number;
    lowestCoveragePct: number;
  };
  receiptWeeksAvailable: number;
  receiptWeeksValid: number;
  cotWeeksAvailable: number;
  fridayStrengthCompleteWeeks: number;
  marketOpenStrengthCompleteWeeks: number;
  sourceAgreementDirectionalWeeks: number;
  readyWeeks: number;
  blockers: Record<string, number>;
  weeks: WeekManifestRow[];
};

type CoverageManifest = {
  schemaVersion: 1;
  generatedAtUtc: string;
  scope: {
    gate: "Gate 44: reusable-seven-year-matrix-dataset";
    fromYear: number;
    toYear: number;
    latestDisplayWeek: string;
    includeShutdown2025: boolean;
    receiptDir: string;
    strengthWindows: HistoricalStrengthWindow[];
  };
  years: YearManifest[];
};

function parseIntegerArg(name: string, fallback: number) {
  const value = argValue(name);
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`Invalid --${name} value: ${value}`);
  return parsed;
}

function normalizeDisplayWeekDate(value: string) {
  const parsed = DateTime.fromISO(value, { zone: "utc" });
  if (!parsed.isValid) throw new Error(`Invalid display week date: ${value}`);
  return parsed.toISODate() ?? value.slice(0, 10);
}

function defaultLatestDisplayWeek() {
  const now = DateTime.utc();
  const monday = now.setZone("America/New_York").startOf("week");
  const latestClosedMonday = monday.minus({ weeks: 1 });
  return latestClosedMonday.toISODate() ?? now.toISODate() ?? "2026-06-08";
}

function displayWeekToWeekOpenUtc(displayWeek: string) {
  const normalized = normalizeWeekOpenUtc(displayWeek);
  if (!normalized) throw new Error(`Unable to normalize display week: ${displayWeek}`);
  return normalized;
}

function buildYearWeeks(options: {
  year: number;
  latestDisplayWeek: string;
  includeShutdown2025: boolean;
}): ManifestWeek[] {
  const latestDisplay = DateTime.fromISO(options.latestDisplayWeek, { zone: "utc" });
  const start = DateTime.utc(options.year, 1, 1).startOf("day");
  const end = DateTime.utc(options.year, 12, 31).startOf("day");
  const firstMonday = start.plus({ days: (8 - start.weekday) % 7 });
  const rows: ManifestWeek[] = [];

  for (let cursor = firstMonday; cursor <= end && cursor <= latestDisplay; cursor = cursor.plus({ weeks: 1 })) {
    const weekLabel = cursor.toISODate() ?? "";
    const shutdownWeek = weekLabel >= SHUTDOWN_2025_FROM && weekLabel <= SHUTDOWN_2025_TO;
    const included = options.includeShutdown2025 || !shutdownWeek;
    const weekOpenUtc = displayWeekToWeekOpenUtc(weekLabel);
    rows.push({
      year: options.year,
      weekLabel,
      weekOpenUtc,
      regime: shutdownWeek ? "source_shutdown" : "clean",
      included,
      exclusionReason: included ? null : "source_shutdown_report_dates_2025-09-30_to_2025-12-23",
      cotReportDate: deriveCotReportDate(weekOpenUtc),
      cotSnapshotAvailable: false,
    });
  }

  return rows;
}

function priorFreezeWeeksFor(weeks: ManifestWeek[]) {
  const firstIncluded = weeks.find((week) => week.included);
  if (!firstIncluded) return [];
  const firstLabel = DateTime.fromISO(firstIncluded.weekLabel, { zone: "utc" });
  if (!firstLabel.isValid) return [];
  return [displayWeekToWeekOpenUtc(firstLabel.minus({ weeks: 1 }).toISODate() ?? firstIncluded.weekLabel)];
}

async function readReceiptInventory(receiptDir: string): Promise<Map<string, ReceiptInventoryEntry[]>> {
  const absoluteDir = path.resolve(process.cwd(), receiptDir);
  let names: string[] = [];
  try {
    names = await readdir(absoluteDir);
  } catch {
    return new Map();
  }

  const byWeek = new Map<string, ReceiptInventoryEntry[]>();
  for (const name of names.filter((entry) => entry.endsWith(".json"))) {
    const fullPath = path.join(absoluteDir, name);
    try {
      const raw = JSON.parse(await readFile(fullPath, "utf8"));
      const weekOpenUtc = typeof raw?.scope?.weekOpenUtc === "string" ? raw.scope.weekOpenUtc : "";
      const weekLabel = typeof raw?.scope?.weekLabel === "string"
        ? raw.scope.weekLabel
        : weekOpenUtc
          ? formatTradingWeekLabelIsoDate(weekOpenUtc)
          : "";
      if (!weekLabel) continue;
      const entry: ReceiptInventoryEntry = {
        path: path.relative(process.cwd(), fullPath).replaceAll("\\", "/"),
        weekLabel,
        weekOpenUtc,
        generatedAtUtc: typeof raw?.generatedAtUtc === "string" ? raw.generatedAtUtc : null,
        expectedPairCount: Number.isFinite(Number(raw?.scope?.expectedPairCount))
          ? Number(raw.scope.expectedPairCount)
          : null,
        missingSymbols: Array.isArray(raw?.coverage?.missingSymbols) ? raw.coverage.missingSymbols.length : 0,
        defaultAdrSymbols: Array.isArray(raw?.coverage?.defaultAdrSymbols) ? raw.coverage.defaultAdrSymbols.length : 0,
        pathPoints: Number.isFinite(Number(raw?.coverage?.pathPoints)) ? Number(raw.coverage.pathPoints) : null,
      };
      const existing = byWeek.get(weekLabel) ?? [];
      existing.push(entry);
      byWeek.set(weekLabel, existing);
    } catch {
      // Ignore malformed generated files; missing/invalid weeks remain visible in the manifest.
    }
  }
  return byWeek;
}

function latestReceiptForWeek(
  week: ManifestWeek,
  inventory: Map<string, ReceiptInventoryEntry[]>,
): ReceiptCoverage {
  const entries = [...(inventory.get(week.weekLabel) ?? [])]
    .sort((left, right) =>
      String(right.generatedAtUtc ?? "").localeCompare(String(left.generatedAtUtc ?? "")));
  const latest = entries[0] ?? null;
  const valid = Boolean(
    latest
    && latest.expectedPairCount === FX_PAIRS.length
    && latest.missingSymbols === 0
    && latest.defaultAdrSymbols === 0
    && (latest.pathPoints ?? 0) > 0,
  );
  return {
    available: entries.length > 0,
    count: entries.length,
    latestPath: latest?.path ?? null,
    latestGeneratedAtUtc: latest?.generatedAtUtc ?? null,
    expectedPairCount: latest?.expectedPairCount ?? null,
    missingSymbols: latest?.missingSymbols ?? null,
    defaultAdrSymbols: latest?.defaultAdrSymbols ?? null,
    pathPoints: latest?.pathPoints ?? null,
    valid,
  };
}

function emptyStrengthPoint(): StrengthPointCoverage {
  return {
    availableRows: 0,
    directionalRows: 0,
    missingRows: FX_PAIRS.length,
    longRows: 0,
    shortRows: 0,
    neutralRows: 0,
    resolvedTimes: [],
  };
}

function summarizeStrengthPoint(rows: Array<{
  available: boolean;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  resolvedTimeUtc: string | null;
}>): StrengthPointCoverage {
  const resolvedTimes = [...new Set(rows.map((row) => row.resolvedTimeUtc).filter((value): value is string => Boolean(value)))].sort();
  return {
    availableRows: rows.filter((row) => row.available).length,
    directionalRows: rows.filter((row) => row.available && (row.direction === "LONG" || row.direction === "SHORT")).length,
    missingRows: FX_PAIRS.length - rows.filter((row) => row.available).length,
    longRows: rows.filter((row) => row.available && row.direction === "LONG").length,
    shortRows: rows.filter((row) => row.available && row.direction === "SHORT").length,
    neutralRows: rows.filter((row) => row.available && row.direction === "NEUTRAL").length,
    resolvedTimes,
  };
}

async function readYearStrengthCoverage(weeks: ManifestWeek[]) {
  const includedWeekOpenUtcs = weeks.filter((week) => week.included).map((week) => week.weekOpenUtc);
  const contexts = await readFxWeeklyStrengthContexts({
    weekOpenUtcs: includedWeekOpenUtcs,
    pairs: FX_PAIRS,
    windows: DEFAULT_STRENGTH_WINDOWS,
  });
  const byWeek = new Map(contexts.map((context) => [context.weekOpenUtc, context]));
  return byWeek;
}

async function readYearSourceCoverage(weeks: ManifestWeek[]) {
  const byWeek = new Map<string, SourceDirectionCoverage>();
  for (const week of weeks.filter((row) => row.included)) {
    const source = await getCanonicalBasketWeekForModels(week.weekOpenUtc, ["dealer", "commercial"]);
    const dealerRows = filterByModel(source, "dealer")
      .filter((row) => row.assetClass === "fx" && FX_PAIR_SET.has(row.symbol.toUpperCase()));
    const commercialRows = filterByModel(source, "commercial")
      .filter((row) => row.assetClass === "fx" && FX_PAIR_SET.has(row.symbol.toUpperCase()));
    const commercialByPair = new Map(commercialRows.map((row) => [row.symbol.toUpperCase(), row]));
    let agreementRows = 0;
    for (const dealer of dealerRows) {
      const commercial = commercialByPair.get(dealer.symbol.toUpperCase());
      if (
        commercial
        && dealer.direction === commercial.direction
        && (dealer.direction === "LONG" || dealer.direction === "SHORT")
      ) {
        agreementRows += 1;
      }
    }
    byWeek.set(week.weekOpenUtc, {
      dealerDirectionalRows: dealerRows.filter((row) => row.direction === "LONG" || row.direction === "SHORT").length,
      commercialDirectionalRows: commercialRows.filter((row) => row.direction === "LONG" || row.direction === "SHORT").length,
      dealerMissingSnapshotRows: dealerRows.filter((row) => row.metadata?.reason === "missing_snapshot").length,
      commercialMissingSnapshotRows: commercialRows.filter((row) => row.metadata?.reason === "missing_snapshot").length,
      dealerCommercialAgreementRows: agreementRows,
    });
  }
  return byWeek;
}

async function readManifestM1Coverage(weeks: string[]) {
  if (shouldUseLocalM1Warehouse("1m")) {
    const rows = readLocalM1CoverageRows({
      assetClass: "fx",
      symbols: FX_PAIRS,
      weeks,
    });
    const coveragePcts = rows.map((row) => row.coveragePct).filter(Number.isFinite);
    return {
      rows,
      summary: {
        complete: rows.filter((row) => row.status === "complete").length,
        partial: rows.filter((row) => row.status === "partial").length,
        missing: rows.filter((row) => row.status === "missing").length,
        inProgress: rows.filter((row) => row.status === "in_progress").length,
        lowestCoveragePct: coveragePcts.length > 0 ? Math.min(...coveragePcts) : 0,
      },
    };
  }

  return getCanonicalHourlyCoverage({
    assetClass: "fx",
    symbols: FX_PAIRS,
    weeks,
    timeframe: "1m",
  });
}

function countBlockers(rows: WeekManifestRow[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    for (const blocker of row.blockers) {
      acc[blocker] = (acc[blocker] ?? 0) + 1;
    }
    return acc;
  }, {});
}

function buildMarkdown(manifest: CoverageManifest, jsonPath: string) {
  const yearRow = (year: YearManifest) =>
    `| ${year.year} | ${year.includedWeeks} | ${year.excludedWeeks} | ${year.priorFreezeWeeks.length} | ${year.receiptWeeksValid}/${year.includedWeeks} | ${year.m1Summary.complete}/${year.requiredM1Weeks * FX_PAIRS.length} | ${year.m1Summary.partial} | ${year.m1Summary.missing} | ${year.fridayStrengthCompleteWeeks}/${year.includedWeeks} | ${year.marketOpenStrengthCompleteWeeks}/${year.includedWeeks} | ${year.cotWeeksAvailable}/${year.includedWeeks} | ${year.sourceAgreementDirectionalWeeks}/${year.includedWeeks} | ${year.readyWeeks}/${year.includedWeeks} | ${Object.entries(year.blockers).map(([key, count]) => `${key}:${count}`).join("; ") || "-"} |`;

  const blockedWeekRows = manifest.years.flatMap((year) =>
    year.weeks
      .filter((week) => week.included && !week.ready)
      .slice(0, 30)
      .map((week) =>
        `| ${year.year} | ${week.weekLabel} | ${week.receipt.available ? "Y" : "N"} | ${week.m1Status} | ${week.strength.friday_close.directionalRows}/28 | ${week.strength.market_open_confirmation.directionalRows}/28 | ${week.cotSnapshotAvailable ? "Y" : "N"} | ${week.sourceContext.dealerCommercialAgreementRows}/28 | ${week.blockers.join("; ")} |`),
  );

  return [
    "# Gate 44 Research Matrix Coverage Manifest",
    "",
    `Generated: ${manifest.generatedAtUtc}`,
    "",
    "## Scope",
    "",
    "- Coverage manifest only. No strategy variant simulation or optimization.",
    "- Receipt availability, M1 path coverage, Strength decision context, COT availability, and Dealer/Commercial source context are separate checks.",
    "- Market-open Strength uses FX market-truth open from the Gate 43 context, not the later execution window.",
    `- Years: ${manifest.scope.fromYear}-${manifest.scope.toYear}`,
    `- Latest display week: ${manifest.scope.latestDisplayWeek}`,
    `- 2025 shutdown weeks included: ${manifest.scope.includeShutdown2025}`,
    "",
    "## Year Summary",
    "",
    "| Year | Included Weeks | Excluded Weeks | Prior Freeze Weeks | Valid Receipts | Complete M1 Rows | Partial M1 Rows | Missing M1 Rows | Friday Strength | Market-Open Strength | COT Reports | Dealer/Commercial Agreement | Ready Weeks | Blockers |",
    "|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|",
    ...manifest.years.map(yearRow),
    "",
    "## Blocked Included Weeks",
    "",
    "| Year | Week | Receipt | M1 | Friday Strength | Market-Open Strength | COT | D/C Agree | Blockers |",
    "|---:|---|---:|---|---:|---:|---:|---:|---|",
    ...(blockedWeekRows.length > 0 ? blockedWeekRows : ["| - | - | - | - | - | - | - | - | - |"]),
    "",
    "## Files",
    "",
    `- JSON: ${jsonPath}`,
    "",
  ].join("\n");
}

async function buildCoverageManifest(): Promise<CoverageManifest> {
  const fromYear = parseIntegerArg("from-year", parseIntegerArg("year", 2019));
  const toYear = parseIntegerArg("to-year", parseIntegerArg("year", 2026));
  const latestDisplayWeek = normalizeDisplayWeekDate(argValue("latest-display-week") ?? defaultLatestDisplayWeek());
  const includeShutdown2025 = hasFlag("include-shutdown-2025");
  const receiptDir = argValue("receipt-dir") ?? DEFAULT_HEDGED_GRID_RECEIPT_DIR;
  const receiptInventory = await readReceiptInventory(receiptDir);
  const cotDates = new Set(await listSnapshotDates("fx"));
  const years: YearManifest[] = [];

  for (let year = fromYear; year <= toYear; year += 1) {
    const weeks = buildYearWeeks({ year, latestDisplayWeek, includeShutdown2025 })
      .map((week) => ({
        ...week,
        cotSnapshotAvailable: cotDates.has(week.cotReportDate),
      }));
    const includedWeeks = weeks.filter((week) => week.included);
    const priorFreezeWeeks = priorFreezeWeeksFor(weeks);
    const requiredM1Weeks = [...new Set([...priorFreezeWeeks, ...includedWeeks.map((week) => week.weekOpenUtc)])].sort();
    const m1Coverage = await readManifestM1Coverage(requiredM1Weeks);
    const m1ByWeek = new Map<string, typeof m1Coverage.rows>(
      requiredM1Weeks.map((weekOpenUtc) => [
        weekOpenUtc,
        m1Coverage.rows.filter((row) => row.weekOpenUtc === weekOpenUtc),
      ]),
    );
    const strengthByWeek = await readYearStrengthCoverage(weeks);
    const sourceByWeek = await readYearSourceCoverage(weeks);

    const rows: WeekManifestRow[] = weeks.map((week) => {
      const receipt = latestReceiptForWeek(week, receiptInventory);
      const m1Rows = m1ByWeek.get(week.weekOpenUtc) ?? [];
      const m1WeakRows = m1Rows.filter((row) => row.status !== "complete");
      const context = strengthByWeek.get(week.weekOpenUtc);
      const fridayRows = context?.rows.filter((row) => row.pointId === "friday_close") ?? [];
      const marketOpenRows = context?.rows.filter((row) => row.pointId === "market_open_confirmation") ?? [];
      const strength = {
        friday_close: fridayRows.length ? summarizeStrengthPoint(fridayRows) : emptyStrengthPoint(),
        market_open_confirmation: marketOpenRows.length ? summarizeStrengthPoint(marketOpenRows) : emptyStrengthPoint(),
      };
      const sourceContext = sourceByWeek.get(week.weekOpenUtc) ?? {
        dealerDirectionalRows: 0,
        commercialDirectionalRows: 0,
        dealerMissingSnapshotRows: FX_PAIRS.length,
        commercialMissingSnapshotRows: FX_PAIRS.length,
        dealerCommercialAgreementRows: 0,
      };
      const blockers = week.included ? [
        ...(!receipt.valid ? ["missing_or_invalid_receipt"] : []),
        ...(m1WeakRows.length > 0 ? ["m1_week_not_complete"] : []),
        ...(strength.friday_close.directionalRows !== FX_PAIRS.length ? ["friday_strength_not_28_28"] : []),
        ...(strength.market_open_confirmation.directionalRows !== FX_PAIRS.length ? ["market_open_strength_not_28_28"] : []),
        ...(!week.cotSnapshotAvailable ? ["missing_cot_report"] : []),
      ] : [];
      return {
        ...week,
        receipt,
        m1Status: m1WeakRows.length === 0 && m1Rows.length > 0
          ? "complete"
          : m1WeakRows[0]?.status ?? "not_checked",
        m1WeakPairs: m1WeakRows.map((row) => `${row.symbol}:${row.status}:${row.coveragePct}%`),
        strength,
        sourceContext,
        ready: week.included && blockers.length === 0,
        blockers,
      };
    });

    const priorM1Rows = priorFreezeWeeks.flatMap((weekOpenUtc) => m1ByWeek.get(weekOpenUtc) ?? []);
    const priorM1Blockers = priorM1Rows.filter((row) => row.status !== "complete").length;
    if (priorM1Blockers > 0) {
      const firstIncluded = rows.find((row) => row.included);
      if (firstIncluded && !firstIncluded.blockers.includes("prior_freeze_m1_not_complete")) {
        firstIncluded.blockers.push("prior_freeze_m1_not_complete");
        firstIncluded.ready = false;
      }
    }

    years.push({
      year,
      includedWeeks: includedWeeks.length,
      excludedWeeks: weeks.filter((week) => !week.included).length,
      priorFreezeWeeks,
      requiredM1Weeks: requiredM1Weeks.length,
      m1Summary: m1Coverage.summary,
      receiptWeeksAvailable: rows.filter((row) => row.included && row.receipt.available).length,
      receiptWeeksValid: rows.filter((row) => row.included && row.receipt.valid).length,
      cotWeeksAvailable: rows.filter((row) => row.included && row.cotSnapshotAvailable).length,
      fridayStrengthCompleteWeeks: rows.filter((row) =>
        row.included && row.strength.friday_close.directionalRows === FX_PAIRS.length).length,
      marketOpenStrengthCompleteWeeks: rows.filter((row) =>
        row.included && row.strength.market_open_confirmation.directionalRows === FX_PAIRS.length).length,
      sourceAgreementDirectionalWeeks: rows.filter((row) =>
        row.included && row.sourceContext.dealerCommercialAgreementRows > 0).length,
      readyWeeks: rows.filter((row) => row.ready).length,
      blockers: countBlockers(rows),
      weeks: rows,
    });
  }

  return {
    schemaVersion: 1,
    generatedAtUtc: DateTime.utc().toISO() ?? new Date().toISOString(),
    scope: {
      gate: "Gate 44: reusable-seven-year-matrix-dataset",
      fromYear,
      toYear,
      latestDisplayWeek,
      includeShutdown2025,
      receiptDir,
      strengthWindows: DEFAULT_STRENGTH_WINDOWS,
    },
    years,
  };
}

async function runCoverageManifest() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for --coverage-manifest.");
  }
  const manifest = await buildCoverageManifest();
  for (const year of manifest.years) {
    console.log(
      [
        `year=${year.year}`,
        `includedWeeks=${year.includedWeeks}`,
        `validReceipts=${year.receiptWeeksValid}/${year.includedWeeks}`,
        `m1=${year.m1Summary.complete}/${year.requiredM1Weeks * FX_PAIRS.length} complete`,
        `strengthFriday=${year.fridayStrengthCompleteWeeks}/${year.includedWeeks}`,
        `strengthOpen=${year.marketOpenStrengthCompleteWeeks}/${year.includedWeeks}`,
        `cot=${year.cotWeeksAvailable}/${year.includedWeeks}`,
        `ready=${year.readyWeeks}/${year.includedWeeks}`,
        `blockers=${Object.entries(year.blockers).map(([key, count]) => `${key}:${count}`).join(";") || "-"}`,
      ].join(" | "),
    );
  }

  if (hasFlag("write")) {
    const outDir = path.resolve(process.cwd(), argValue("out-dir") ?? DEFAULT_COVERAGE_MANIFEST_OUT_DIR);
    await mkdir(outDir, { recursive: true });
    const stamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
    const jsonPath = path.join(outDir, `research-matrix-coverage-manifest-${manifest.scope.fromYear}-${manifest.scope.toYear}-${stamp}.json`);
    const mdPath = jsonPath.replace(/\.json$/, ".md");
    await writeFile(jsonPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await writeFile(mdPath, buildMarkdown(manifest, path.relative(process.cwd(), jsonPath).replaceAll("\\", "/")), "utf8");
    console.log(`Coverage manifest JSON: ${jsonPath}`);
    console.log(`Coverage manifest Markdown: ${mdPath}`);
  }
}

async function main() {
  if (hasFlag("coverage-manifest")) {
    await runCoverageManifest();
    return;
  }
  runEstimate();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (!hasFlag("coverage-manifest")) return;
    try {
      await getPool().end();
    } catch {
      // Pool may not have been created if argument/env validation failed.
    }
  });
