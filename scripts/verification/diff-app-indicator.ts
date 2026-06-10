/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: diff-app-indicator.ts
 *
 * Description:
 * Compares app-side verification exports against TradingView indicator exports
 * using the shared ADR Grid + Pair Fill Cap row contract.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type SourceName = "app" | "indicator";
type RowKind = "grid" | "fill";

type NormalizedRow = {
  source: SourceName;
  system: string;
  strategyVariant: string | null;
  anchorType: string | null;
  weekOpenUtc: string;
  rowKind: RowKind;
  gridKey: string;
  pair: string;
  direction: string | null;
  sourceModel: string | null;
  tier: number | null;
  fillSeq: number | null;
  entryUtc: string | null;
  exitUtc: string | null;
  entryPrice: number | null;
  exitPrice: number | null;
  returnRawPct: number | null;
  returnAdrNormalizedPct: number | null;
  adrPct: number | null;
  exitReason: string | null;
  activeFillsAtEntry: number | null;
  capThresholdAtEntry: number | null;
};

type FieldMismatch = {
  field: keyof NormalizedRow;
  app: unknown;
  indicator: unknown;
  tolerance?: number;
};

type DiffRecord = {
  key: string;
  status: "missing_in_indicator" | "unexpected_indicator" | "field_mismatch";
  app?: NormalizedRow;
  indicator?: NormalizedRow;
  mismatches?: FieldMismatch[];
};

type WeeklyDiff = {
  key: string;
  app?: Totals;
  indicator?: Totals;
  mismatches: FieldMismatch[];
};

type Totals = {
  system: string;
  weekOpenUtc: string;
  gridCount: number;
  fillCount: number;
  returnRawPct: number;
  returnAdrNormalizedPct: number | null;
};

const REQUIRED_COLUMNS = [
  "system",
  "weekOpenUtc",
  "rowKind",
  "pair",
  "direction",
  "entryUtc",
  "exitUtc",
  "entryPrice",
  "exitPrice",
  "returnRawPct",
] as const;

const STRING_FIELDS: Array<keyof NormalizedRow> = [
  "system",
  "weekOpenUtc",
  "rowKind",
  "gridKey",
  "pair",
  "direction",
  "sourceModel",
  "entryUtc",
  "exitUtc",
];

const OPTIONAL_STRING_FIELDS: Array<keyof NormalizedRow> = [
  "exitReason",
];

const NUMBER_FIELDS: Array<{ field: keyof NormalizedRow; tolerance: number }> = [
  { field: "tier", tolerance: 0 },
  { field: "fillSeq", tolerance: 0 },
  { field: "entryPrice", tolerance: 0.00001 },
  { field: "exitPrice", tolerance: 0.00001 },
  { field: "returnRawPct", tolerance: 0.0001 },
  { field: "returnAdrNormalizedPct", tolerance: 0.0001 },
  { field: "adrPct", tolerance: 0.0001 },
  { field: "activeFillsAtEntry", tolerance: 0 },
  { field: "capThresholdAtEntry", tolerance: 0 },
];

const COLUMN_ALIASES: Record<string, keyof NormalizedRow> = {
  source: "source",
  system: "system",
  strategyvariant: "strategyVariant",
  strategy_variant: "strategyVariant",
  anchortype: "anchorType",
  anchor_type: "anchorType",
  weekopenutc: "weekOpenUtc",
  week_open_utc: "weekOpenUtc",
  rowkind: "rowKind",
  row_kind: "rowKind",
  gridkey: "gridKey",
  grid_key: "gridKey",
  pair: "pair",
  symbol: "pair",
  direction: "direction",
  sourcemodel: "sourceModel",
  source_model: "sourceModel",
  model: "sourceModel",
  tier: "tier",
  fillseq: "fillSeq",
  fill_seq: "fillSeq",
  fillorder: "fillSeq",
  fill_order: "fillSeq",
  entryutc: "entryUtc",
  entry_utc: "entryUtc",
  exitutc: "exitUtc",
  exit_utc: "exitUtc",
  entryprice: "entryPrice",
  entry_price: "entryPrice",
  exitprice: "exitPrice",
  exit_price: "exitPrice",
  returnrawpct: "returnRawPct",
  return_raw_pct: "returnRawPct",
  raw_pct: "returnRawPct",
  returnadrnormalizedpct: "returnAdrNormalizedPct",
  return_adr_normalized_pct: "returnAdrNormalizedPct",
  adr_normalized_pct: "returnAdrNormalizedPct",
  adrpct: "adrPct",
  adr_pct: "adrPct",
  exitreason: "exitReason",
  exit_reason: "exitReason",
  activefillsatentry: "activeFillsAtEntry",
  active_fills_at_entry: "activeFillsAtEntry",
  capthresholdatentry: "capThresholdAtEntry",
  cap_threshold_at_entry: "capThresholdAtEntry",
};

function argValue(name: string): string | null {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function parseCsv(input: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        i += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [headers, ...records] = rows.filter((csvRow) => csvRow.some((value) => value.trim().length > 0));
  if (!headers) return [];
  return records.map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])));
}

function normalizeHeader(header: string) {
  return header.trim().replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
}

function normalizeIso(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value).trim() : parsed.toISOString();
}

function normalizeString(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapRawRow(raw: Record<string, unknown>, fallbackSource: SourceName): NormalizedRow {
  const mapped: Partial<Record<keyof NormalizedRow, unknown>> = {};
  for (const [header, value] of Object.entries(raw)) {
    const target = COLUMN_ALIASES[normalizeHeader(header)];
    if (target) mapped[target] = value;
  }

  const row: NormalizedRow = {
    source: fallbackSource,
    system: normalizeString(mapped.system)?.toLowerCase() ?? "",
    strategyVariant: normalizeString(mapped.strategyVariant),
    anchorType: normalizeString(mapped.anchorType),
    weekOpenUtc: normalizeIso(mapped.weekOpenUtc) ?? "",
    rowKind: normalizeString(mapped.rowKind)?.toLowerCase() === "fill" ? "fill" : "grid",
    gridKey: normalizeString(mapped.gridKey) ?? "",
    pair: normalizeString(mapped.pair)?.toUpperCase() ?? "",
    direction: normalizeString(mapped.direction)?.toUpperCase() ?? null,
    sourceModel: normalizeString(mapped.sourceModel)?.toLowerCase() ?? null,
    tier: normalizeNumber(mapped.tier),
    fillSeq: normalizeNumber(mapped.fillSeq),
    entryUtc: normalizeIso(mapped.entryUtc),
    exitUtc: normalizeIso(mapped.exitUtc),
    entryPrice: normalizeNumber(mapped.entryPrice),
    exitPrice: normalizeNumber(mapped.exitPrice),
    returnRawPct: normalizeNumber(mapped.returnRawPct),
    returnAdrNormalizedPct: normalizeNumber(mapped.returnAdrNormalizedPct),
    adrPct: normalizeNumber(mapped.adrPct),
    exitReason: normalizeString(mapped.exitReason),
    activeFillsAtEntry: normalizeNumber(mapped.activeFillsAtEntry),
    capThresholdAtEntry: normalizeNumber(mapped.capThresholdAtEntry),
  };

  if (!row.gridKey) {
    row.gridKey = [
      row.weekOpenUtc,
      row.system,
      row.sourceModel ?? "",
      row.tier ?? "",
      row.pair,
      row.direction ?? "",
    ].join("|");
  }

  return row;
}

function validateRows(rows: NormalizedRow[], label: string) {
  const missing: string[] = [];
  rows.forEach((row, index) => {
    for (const column of REQUIRED_COLUMNS) {
      if (row[column] === null || row[column] === "") {
        missing.push(`${label} row ${index + 1}: missing ${column}`);
      }
    }
  });
  if (missing.length > 0) {
    throw new Error(`Invalid ${label} export:\n${missing.slice(0, 20).join("\n")}`);
  }
}

async function loadRows(filePath: string, fallbackSource: SourceName): Promise<NormalizedRow[]> {
  const raw = await readFile(filePath, "utf8");
  if (filePath.endsWith(".json")) {
    const parsed = JSON.parse(raw) as { rows?: Record<string, unknown>[] } | Record<string, unknown>[];
    const rows = Array.isArray(parsed) ? parsed : parsed.rows ?? [];
    return rows.map((row) => mapRawRow(row, fallbackSource));
  }
  return parseCsv(raw).map((row) => mapRawRow(row, fallbackSource));
}

function identityKey(row: NormalizedRow) {
  return [
    row.weekOpenUtc,
    row.system,
    row.sourceModel ?? "",
    row.tier ?? "",
    row.pair,
    row.direction ?? "",
    row.rowKind,
    row.rowKind === "fill" ? row.fillSeq ?? "" : "grid",
  ].join("|");
}

function valuesMatch(left: unknown, right: unknown, tolerance = 0) {
  if (left === null || left === undefined || left === "") {
    return right === null || right === undefined || right === "";
  }
  if (right === null || right === undefined || right === "") return false;
  if (typeof left === "number" || typeof right === "number") {
    const leftNum = Number(left);
    const rightNum = Number(right);
    if (!Number.isFinite(leftNum) || !Number.isFinite(rightNum)) return false;
    return Math.abs(leftNum - rightNum) <= tolerance;
  }
  return String(left) === String(right);
}

function compareRows(app: NormalizedRow, indicator: NormalizedRow) {
  const mismatches: FieldMismatch[] = [];
  for (const field of STRING_FIELDS) {
    if (!valuesMatch(app[field], indicator[field])) {
      mismatches.push({ field, app: app[field], indicator: indicator[field] });
    }
  }
  for (const field of OPTIONAL_STRING_FIELDS) {
    const appValue = app[field];
    const indicatorValue = indicator[field];
    if (
      appValue !== null &&
      appValue !== undefined &&
      appValue !== "" &&
      indicatorValue !== null &&
      indicatorValue !== undefined &&
      indicatorValue !== "" &&
      !valuesMatch(appValue, indicatorValue)
    ) {
      mismatches.push({ field, app: appValue, indicator: indicatorValue });
    }
  }
  for (const { field, tolerance } of NUMBER_FIELDS) {
    if (!valuesMatch(app[field], indicator[field], tolerance)) {
      mismatches.push({ field, app: app[field], indicator: indicator[field], tolerance });
    }
  }
  return mismatches;
}

function totals(rows: NormalizedRow[]): Totals[] {
  const groups = new Map<string, NormalizedRow[]>();
  for (const row of rows) {
    const key = `${row.system}|${row.weekOpenUtc}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return Array.from(groups.entries()).map(([key, group]) => {
    const [system, weekOpenUtc] = key.split("|");
    const gridRows = group.filter((row) => row.rowKind === "grid");
    const fillRows = group.filter((row) => row.rowKind === "fill");
    const adrValues = gridRows
      .map((row) => row.returnAdrNormalizedPct)
      .filter((value): value is number => value !== null);
    return {
      system: system ?? "",
      weekOpenUtc: weekOpenUtc ?? "",
      gridCount: gridRows.length,
      fillCount: fillRows.length,
      returnRawPct: gridRows.reduce((sum, row) => sum + (row.returnRawPct ?? 0), 0),
      returnAdrNormalizedPct: adrValues.length === gridRows.length
        ? adrValues.reduce((sum, value) => sum + value, 0)
        : null,
    };
  });
}

function compareTotals(appRows: NormalizedRow[], indicatorRows: NormalizedRow[]) {
  const appTotals = new Map(totals(appRows).map((total) => [`${total.system}|${total.weekOpenUtc}`, total]));
  const indicatorTotals = new Map(totals(indicatorRows).map((total) => [`${total.system}|${total.weekOpenUtc}`, total]));
  const keys = new Set([...appTotals.keys(), ...indicatorTotals.keys()]);
  const diffs: WeeklyDiff[] = [];

  for (const key of Array.from(keys).sort()) {
    const app = appTotals.get(key);
    const indicator = indicatorTotals.get(key);
    const mismatches: FieldMismatch[] = [];
    if (!app || !indicator) {
      diffs.push({ key, app, indicator, mismatches });
      continue;
    }
    for (const field of ["gridCount", "fillCount", "returnRawPct", "returnAdrNormalizedPct"] as const) {
      const tolerance = field.startsWith("return") ? 0.0001 : 0;
      if (!valuesMatch(app[field], indicator[field], tolerance)) {
        mismatches.push({ field: field as keyof NormalizedRow, app: app[field], indicator: indicator[field], tolerance });
      }
    }
    if (mismatches.length > 0) diffs.push({ key, app, indicator, mismatches });
  }

  return diffs;
}

async function main() {
  const appPath = argValue("app");
  const indicatorPath = argValue("indicator");
  if (!appPath || !indicatorPath) {
    throw new Error("Usage: npm run verification:diff -- --app <app-export.json|csv> --indicator <indicator-export.csv|json>");
  }

  const appRows = await loadRows(path.resolve(process.cwd(), appPath), "app");
  const indicatorRows = await loadRows(path.resolve(process.cwd(), indicatorPath), "indicator");
  validateRows(appRows, "app");
  validateRows(indicatorRows, "indicator");

  const appByKey = new Map(appRows.map((row) => [identityKey(row), row]));
  const indicatorByKey = new Map(indicatorRows.map((row) => [identityKey(row), row]));
  const keys = new Set([...appByKey.keys(), ...indicatorByKey.keys()]);
  const rowDiffs: DiffRecord[] = [];

  for (const key of Array.from(keys).sort()) {
    const app = appByKey.get(key);
    const indicator = indicatorByKey.get(key);
    if (!app) {
      rowDiffs.push({ key, status: "unexpected_indicator", indicator });
      continue;
    }
    if (!indicator) {
      rowDiffs.push({ key, status: "missing_in_indicator", app });
      continue;
    }
    const mismatches = compareRows(app, indicator);
    if (mismatches.length > 0) {
      rowDiffs.push({ key, status: "field_mismatch", app, indicator, mismatches });
    }
  }

  const weeklyDiffs = compareTotals(appRows, indicatorRows);
  const outDir = path.resolve(process.cwd(), argValue("out-dir") ?? "reports/data-verification/diffs");
  await mkdir(outDir, { recursive: true });
  const outputPath = path.join(outDir, `app-vs-indicator-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const summary = {
    schemaVersion: 1,
    generatedAtUtc: new Date().toISOString(),
    appPath,
    indicatorPath,
    counts: {
      appRows: appRows.length,
      indicatorRows: indicatorRows.length,
      rowDiffs: rowDiffs.length,
      weeklyDiffs: weeklyDiffs.length,
      missingInIndicator: rowDiffs.filter((diff) => diff.status === "missing_in_indicator").length,
      unexpectedIndicator: rowDiffs.filter((diff) => diff.status === "unexpected_indicator").length,
      fieldMismatches: rowDiffs.filter((diff) => diff.status === "field_mismatch").length,
    },
    weeklyDiffs,
    rowDiffs,
  };
  await writeFile(outputPath, JSON.stringify(summary, null, 2));

  console.log(`[verification] Compared ${appRows.length} app rows against ${indicatorRows.length} indicator rows`);
  console.log(`[verification] Row diffs: ${rowDiffs.length}`);
  console.log(`[verification] Weekly diffs: ${weeklyDiffs.length}`);
  console.log(`[verification] Output: ${outputPath}`);
  if (rowDiffs.length > 0 || weeklyDiffs.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
