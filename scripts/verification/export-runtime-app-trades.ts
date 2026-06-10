/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: export-runtime-app-trades.ts
 *
 * Description:
 * Exports current computeWeeklyHold() runtime ADR Grid rows using the same
 * app-vs-indicator row contract as the database-backed verification export.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getBiasSource, getEntryStyle, getRiskOverlay } from "@/lib/performance/strategyConfig";
import { computeWeeklyHold, type WeeklyHoldTrade } from "@/lib/performance/weeklyHoldEngine";

type SystemId = "tiered" | "tandem" | "agreement" | "selector";
type RowKind = "grid" | "fill";

type VerificationRow = {
  source: "app";
  system: SystemId;
  strategyVariant: string;
  anchorType: "execution";
  weekOpenUtc: string;
  rowKind: RowKind;
  gridKey: string;
  parentTradeId: string | null;
  tradeId: string;
  pair: string;
  direction: "LONG" | "SHORT";
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
  capViolated: boolean;
};

const SYSTEM_BIASES: Record<SystemId, string> = {
  tiered: "tiered_4w",
  tandem: "tandem",
  agreement: "agree_3of4",
  selector: "selector",
};

const CSV_COLUMNS = [
  "source",
  "system",
  "strategyVariant",
  "anchorType",
  "weekOpenUtc",
  "rowKind",
  "gridKey",
  "parentTradeId",
  "tradeId",
  "pair",
  "direction",
  "sourceModel",
  "tier",
  "fillSeq",
  "entryUtc",
  "exitUtc",
  "entryPrice",
  "exitPrice",
  "returnRawPct",
  "returnAdrNormalizedPct",
  "adrPct",
  "exitReason",
  "activeFillsAtEntry",
  "capThresholdAtEntry",
  "capViolated",
] as const;

const INDICATOR_TEMPLATE_COLUMNS = CSV_COLUMNS.filter((column) => (
  column !== "parentTradeId" && column !== "tradeId" && column !== "capViolated"
));

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] != null) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function argValue(name: string): string | null {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function parseSystems(): SystemId[] {
  const value = argValue("system") ?? "tiered";
  if (value === "all") return ["tiered", "tandem", "agreement", "selector"];
  const systems = value.split(",").map((item) => item.trim()).filter(Boolean);
  for (const system of systems) {
    if (!(system in SYSTEM_BIASES)) {
      throw new Error(`Unsupported --system value "${system}". Use ${Object.keys(SYSTEM_BIASES).join(", ")}, or all.`);
    }
  }
  return systems as SystemId[];
}

function parseSymbols() {
  return (argValue("symbols") ?? argValue("symbol") ?? "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
}

function finiteOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function strategyVariant(system: SystemId, riskOverlayId: string) {
  const bias = SYSTEM_BIASES[system];
  return `${bias}-adr_grid-${riskOverlayId}`;
}

function gridKeyFor(row: Pick<VerificationRow, "weekOpenUtc" | "system" | "sourceModel" | "tier" | "pair" | "direction">) {
  return [
    row.weekOpenUtc,
    row.system,
    row.sourceModel ?? "",
    row.tier ?? "",
    row.pair,
    row.direction,
  ].join("|");
}

function rowId(prefix: string, row: Pick<VerificationRow, "strategyVariant" | "weekOpenUtc" | "gridKey" | "fillSeq">) {
  return [
    prefix,
    row.strategyVariant,
    row.weekOpenUtc,
    row.gridKey,
    row.fillSeq ?? "grid",
  ].join("|");
}

function toFillRow(options: {
  system: SystemId;
  strategyVariant: string;
  weekOpenUtc: string;
  trade: WeeklyHoldTrade;
}): VerificationRow {
  const base = {
    source: "app" as const,
    system: options.system,
    strategyVariant: options.strategyVariant,
    anchorType: "execution" as const,
    weekOpenUtc: options.weekOpenUtc,
    rowKind: "fill" as const,
    parentTradeId: null,
    tradeId: "",
    pair: options.trade.symbol.toUpperCase(),
    direction: options.trade.direction,
    sourceModel: options.trade.source,
    tier: options.trade.tier,
    fillSeq: options.trade.detail?.tradeNumber ?? null,
    entryUtc: options.trade.detail?.entryTimeUtc ?? null,
    exitUtc: options.trade.detail?.exitTimeUtc ?? null,
    entryPrice: finiteOrNull(options.trade.openPrice),
    exitPrice: finiteOrNull(options.trade.closePrice),
    returnRawPct: finiteOrNull(options.trade.rawReturnPct ?? options.trade.returnPct),
    returnAdrNormalizedPct: finiteOrNull(options.trade.normalizedReturnPct),
    adrPct: finiteOrNull(options.trade.adrPct ?? options.trade.detail?.adrPct),
    exitReason: options.trade.detail?.exitReason ?? null,
    activeFillsAtEntry: options.trade.detail?.capActiveFillsAtEntry ?? null,
    capThresholdAtEntry: options.trade.detail?.capThresholdAtEntry ?? null,
    capViolated: options.trade.detail?.capViolated ?? false,
  };
  const gridKey = gridKeyFor(base);
  return {
    ...base,
    gridKey,
    parentTradeId: rowId("runtime-grid", { ...base, gridKey }),
    tradeId: rowId("runtime-fill", { ...base, gridKey }),
  };
}

function toGridRows(fillRows: VerificationRow[]) {
  const groups = new Map<string, VerificationRow[]>();
  for (const row of fillRows) {
    groups.set(row.gridKey, [...(groups.get(row.gridKey) ?? []), row]);
  }
  return Array.from(groups.values()).map((group) => {
    const first = group[0]!;
    const entryUtc = group.map((row) => row.entryUtc).filter(Boolean).sort()[0] ?? null;
    const exitUtc = group.map((row) => row.exitUtc).filter(Boolean).sort().at(-1) ?? null;
    const rawValues = group.map((row) => row.returnRawPct).filter((value): value is number => value !== null);
    const adrValues = group.map((row) => row.returnAdrNormalizedPct).filter((value): value is number => value !== null);
    const row: VerificationRow = {
      ...first,
      rowKind: "grid",
      parentTradeId: null,
      tradeId: rowId("runtime-grid", first),
      fillSeq: null,
      entryUtc,
      exitUtc,
      entryPrice: first.entryPrice,
      exitPrice: group.at(-1)?.exitPrice ?? first.exitPrice,
      returnRawPct: rawValues.length === group.length
        ? rawValues.reduce((sum, value) => sum + value, 0)
        : null,
      returnAdrNormalizedPct: adrValues.length === group.length
        ? adrValues.reduce((sum, value) => sum + value, 0)
        : null,
      exitReason: "grid_parent",
      activeFillsAtEntry: group.reduce<number | null>((max, fill) => {
        if (fill.activeFillsAtEntry === null) return max;
        return max === null ? fill.activeFillsAtEntry : Math.max(max, fill.activeFillsAtEntry);
      }, null),
      capThresholdAtEntry: group.find((fill) => fill.capThresholdAtEntry !== null)?.capThresholdAtEntry ?? null,
      capViolated: group.some((fill) => fill.capViolated),
    };
    return row;
  });
}

function rowSort(left: VerificationRow, right: VerificationRow) {
  return (
    left.weekOpenUtc.localeCompare(right.weekOpenUtc) ||
    left.system.localeCompare(right.system) ||
    left.strategyVariant.localeCompare(right.strategyVariant) ||
    left.pair.localeCompare(right.pair) ||
    (left.sourceModel ?? "").localeCompare(right.sourceModel ?? "") ||
    (left.tier ?? -1) - (right.tier ?? -1) ||
    left.direction.localeCompare(right.direction) ||
    (left.rowKind === right.rowKind ? 0 : left.rowKind === "grid" ? -1 : 1) ||
    (left.fillSeq ?? Number.MAX_SAFE_INTEGER) - (right.fillSeq ?? Number.MAX_SAFE_INTEGER) ||
    (left.entryUtc ?? "").localeCompare(right.entryUtc ?? "")
  );
}

function formatNumber(value: number | null) {
  return value === null ? "" : String(Number(value.toFixed(8)));
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const raw = typeof value === "number" ? formatNumber(value) : String(value);
  return /[",\r\n]/.test(raw) ? `"${raw.replaceAll("\"", "\"\"")}"` : raw;
}

function toCsv(rows: VerificationRow[]) {
  return `${[
    CSV_COLUMNS.join(","),
    ...rows.map((row) => CSV_COLUMNS.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n")}\n`;
}

function indicatorTemplateCsv() {
  return `${INDICATOR_TEMPLATE_COLUMNS.join(",")}\n`;
}

function weeklyTotals(rows: VerificationRow[]) {
  const gridRows = rows.filter((row) => row.rowKind === "grid");
  const groups = new Map<string, VerificationRow[]>();
  for (const row of gridRows) {
    const key = `${row.system}|${row.strategyVariant}|${row.weekOpenUtc}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return Array.from(groups.values()).map((group) => {
    const first = group[0]!;
    const rawValues = group.map((row) => row.returnRawPct).filter((value): value is number => value !== null);
    const adrValues = group.map((row) => row.returnAdrNormalizedPct).filter((value): value is number => value !== null);
    return {
      system: first.system,
      strategyVariant: first.strategyVariant,
      weekOpenUtc: first.weekOpenUtc,
      gridCount: group.length,
      fillCount: rows.filter((row) => row.rowKind === "fill" && row.system === first.system && row.strategyVariant === first.strategyVariant && row.weekOpenUtc === first.weekOpenUtc).length,
      returnRawPct: rawValues.reduce((sum, value) => sum + value, 0),
      returnAdrNormalizedPct: adrValues.length === group.length
        ? adrValues.reduce((sum, value) => sum + value, 0)
        : null,
    };
  }).sort((left, right) => (
    left.weekOpenUtc.localeCompare(right.weekOpenUtc) ||
    left.system.localeCompare(right.system)
  ));
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFile(path.resolve(process.cwd(), ".env"));

  const weekOpenUtc = argValue("week");
  if (!weekOpenUtc) {
    throw new Error("Usage: npm run verification:export-runtime-app -- --week <weekOpenUtc> [--system tiered] [--f2 none|pair_fill_cap] [--symbol EURUSD] [--template]");
  }

  const f2 = argValue("f2") ?? "none";
  const entryStyle = getEntryStyle("adr_grid");
  const riskOverlay = getRiskOverlay(f2);
  if (!entryStyle) throw new Error("Missing ADR Grid entry style config.");
  if (!riskOverlay) throw new Error(`Unsupported --f2 value "${f2}".`);

  const systems = parseSystems();
  const symbols = new Set(parseSymbols());
  const rows: VerificationRow[] = [];

  for (const system of systems) {
    const biasSource = getBiasSource(SYSTEM_BIASES[system]);
    if (!biasSource) throw new Error(`Missing bias source for system "${system}".`);
    const variant = strategyVariant(system, riskOverlay.id);
    const result = await computeWeeklyHold(biasSource, weekOpenUtc, entryStyle, riskOverlay);
    const fillRows = result.trades
      .filter((trade) => symbols.size === 0 || symbols.has(trade.symbol.toUpperCase()))
      .map((trade) => toFillRow({ system, strategyVariant: variant, weekOpenUtc, trade }));
    rows.push(...toGridRows(fillRows), ...fillRows);
  }

  rows.sort(rowSort);

  const outDir = path.resolve(process.cwd(), argValue("out-dir") ?? "reports/data-verification/runtime");
  await mkdir(outDir, { recursive: true });
  const symbolSlug = symbols.size > 0
    ? Array.from(symbols).sort().join("-").toLowerCase()
    : "all-symbols";
  const slug = `${systems.join("-")}-adr_grid-${riskOverlay.id}-${weekOpenUtc.slice(0, 10)}-${symbolSlug}`;
  const jsonPath = path.join(outDir, `${slug}-runtime-app-trades.json`);
  const csvPath = path.join(outDir, `${slug}-runtime-app-trades.csv`);
  const templatePath = path.join(outDir, `${slug}-indicator-template.csv`);

  const totals = weeklyTotals(rows);
  await writeFile(jsonPath, JSON.stringify({
    schemaVersion: 1,
    generatedAtUtc: new Date().toISOString(),
    source: "app",
    sourceMode: "runtime",
    systems,
    strategyVariants: systems.map((system) => strategyVariant(system, riskOverlay.id)),
    anchorType: "execution",
    filters: {
      week: weekOpenUtc,
      f1: "adr_grid",
      f2: riskOverlay.id,
      symbols: Array.from(symbols),
    },
    counts: {
      rows: rows.length,
      grids: rows.filter((row) => row.rowKind === "grid").length,
      fills: rows.filter((row) => row.rowKind === "fill").length,
    },
    weeklyTotals: totals,
    rows,
  }, null, 2));
  await writeFile(csvPath, toCsv(rows));
  if (hasFlag("template")) {
    await writeFile(templatePath, indicatorTemplateCsv());
  }

  console.log(`[verification] Exported ${rows.length} runtime rows`);
  console.log(`[verification] JSON: ${jsonPath}`);
  console.log(`[verification] CSV:  ${csvPath}`);
  if (hasFlag("template")) console.log(`[verification] Indicator template: ${templatePath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
