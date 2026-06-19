/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: export-weekly-hold-runback.ts
 *
 * Description:
 * Exports an app-side Weekly Hold runback receipt for one pair. The output is
 * the research record and Pine input source for Gate 33 parity smoke tests.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";
import { listDataSectionWeeks } from "@/lib/dataSectionWeeks";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import {
  filterByModel,
  getCanonicalBasketWeek,
  type BaseBasketModel,
  type BasketDirection,
} from "@/lib/performance/basketSource";
import { getExecutionWeeklyPairReturns } from "@/lib/pairReturns";
import { loadExecutionWeeklyReturnFromHourlyBars } from "@/lib/executionWeeklyReturns";
import { getExecutionWeekWindow } from "@/lib/executionPriceWindows";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "@/lib/performance/adrLookup";
import type { AssetClass } from "@/lib/cotMarkets";

loadEnvConfig(process.cwd());

type WeeklyHoldRunbackRow = {
  weekOpenUtc: string;
  weekLabel: string;
  pineWeekKey: string;
  symbol: string;
  model: BaseBasketModel;
  direction: BasketDirection | "MISSING";
  sourceReportDate: string | null;
  assetClass: AssetClass | null;
  executionOpenUtc: string | null;
  executionEntryCutoffUtc: string | null;
  executionCloseUtc: string | null;
  executionReturnSource: "stored_pair_period_returns" | "derived_canonical_1h" | "missing";
  executionReturnComplete: boolean | null;
  executionReturnWarnings: string[];
  entryPrice: number | null;
  exitPrice: number | null;
  windowHighPrice: number | null;
  windowLowPrice: number | null;
  underlyingRawReturnPct: number | null;
  directedRawReturnPct: number | null;
  maxAdverseRawPct: number | null;
  maxAdverseAdrPct: number | null;
  pairAdrPct: number | null;
  adrSource: "canonical_price_bars" | "asset_default" | "missing";
  appAdrReturnPct: number | null;
  outcome: "WIN" | "LOSS" | "FLAT" | "NO_TRADE" | "MISSING_RETURN" | "MISSING_SIGNAL";
  missingReason: string | null;
  pineInputRow: string | null;
};

const CSV_COLUMNS = [
  "weekOpenUtc",
  "weekLabel",
  "pineWeekKey",
  "symbol",
  "model",
  "direction",
  "sourceReportDate",
  "assetClass",
  "executionOpenUtc",
  "executionEntryCutoffUtc",
  "executionCloseUtc",
  "executionReturnSource",
  "executionReturnComplete",
  "executionReturnWarnings",
  "entryPrice",
  "exitPrice",
  "windowHighPrice",
  "windowLowPrice",
  "underlyingRawReturnPct",
  "directedRawReturnPct",
  "maxAdverseRawPct",
  "maxAdverseAdrPct",
  "pairAdrPct",
  "adrSource",
  "appAdrReturnPct",
  "outcome",
  "missingReason",
  "pineInputRow",
] as const;

type RunbackTotals = {
  rows: number;
  tradeRows: number;
  wins: number;
  losses: number;
  flat: number;
  noTradeRows: number;
  missingSignalRows: number;
  missingReturnRows: number;
  totalRawPct: number;
  totalAppAdrPct: number;
  maxAdverseRawPct: number;
  maxAdverseAdrPct: number;
  avgAdverseRawPct: number;
  avgAdverseAdrPct: number;
  worstDrawdownWeek: string;
};

function argValue(name: string): string | null {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function parsePositiveInt(name: string, fallback: number) {
  const value = argValue(name);
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer.`);
  }
  return parsed;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function parseModel(): BaseBasketModel {
  const value = (argValue("model") ?? "dealer").trim().toLowerCase();
  if (value === "dealer" || value === "commercial" || value === "sentiment" || value === "strength") {
    return value;
  }
  throw new Error("--model must be dealer, commercial, sentiment, or strength.");
}

function defaultOutDir() {
  const fromAppDir = path.basename(process.cwd()).toLowerCase() === "app";
  return fromAppDir
    ? "reports/data-verification/weekly-hold-runback"
    : "app/reports/data-verification/weekly-hold-runback";
}

function round(value: number | null, places = 6) {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function formatNumber(value: number | null, places = 6) {
  return value === null || !Number.isFinite(value) ? "" : value.toFixed(places);
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function toCsv(rows: WeeklyHoldRunbackRow[]) {
  return [
    CSV_COLUMNS.join(","),
    ...rows.map((row) => CSV_COLUMNS.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n");
}

function weekLabel(weekOpenUtc: string) {
  const week = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  return week.isValid ? week.toFormat("yyyy-LL-dd") : weekOpenUtc.slice(0, 10);
}

function pineWeekKey(weekOpenUtc: string) {
  const week = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  return week.isValid ? week.plus({ days: 1 }).toISODate() ?? weekOpenUtc.slice(0, 10) : weekOpenUtc.slice(0, 10);
}

function selectClosedWeeks(allWeeks: string[], currentWeekOpenUtc: string, count: number) {
  return allWeeks
    .map((week) => week.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .filter((week) => week < currentWeekOpenUtc)
    .slice(-count);
}

function filterWeeksByDate(weeks: string[], options: { from: string | null; to: string | null }) {
  return weeks.filter((weekOpenUtc) => {
    const key = pineWeekKey(weekOpenUtc);
    if (options.from && key < options.from) return false;
    if (options.to && key > options.to) return false;
    return true;
  });
}

function directionAdjustedReturn(direction: BasketDirection, underlyingRawReturnPct: number) {
  if (direction === "SHORT") return -underlyingRawReturnPct;
  if (direction === "LONG") return underlyingRawReturnPct;
  return null;
}

function weeklyHoldMaxAdverseRawPct(options: {
  direction: BasketDirection | "MISSING";
  entryPrice: number | null;
  windowHighPrice: number | null;
  windowLowPrice: number | null;
}) {
  if (options.direction !== "LONG" && options.direction !== "SHORT") return null;
  if (
    options.entryPrice === null ||
    options.windowHighPrice === null ||
    options.windowLowPrice === null ||
    !Number.isFinite(options.entryPrice) ||
    options.entryPrice <= 0
  ) {
    return null;
  }

  const adverseMove = options.direction === "SHORT"
    ? options.windowHighPrice - options.entryPrice
    : options.entryPrice - options.windowLowPrice;
  return Math.max(0, (adverseMove / options.entryPrice) * 100);
}

async function resolveExecutionReturn(options: {
  symbol: string;
  weekOpenUtc: string;
  assetClass: AssetClass | null;
  storedRows: Array<{
    symbol: string;
    assetClass: AssetClass;
    returnPct: number;
    openPrice: number;
    closePrice: number;
  }>;
  deriveMissingExecution: boolean;
}) {
  const stored = options.storedRows.find((candidate) => candidate.symbol.toUpperCase() === options.symbol);
  if (stored) {
    return {
      row: stored,
      source: "stored_pair_period_returns" as const,
      complete: true,
      warnings: [] as string[],
    };
  }

  if (!options.deriveMissingExecution || !options.assetClass) {
    return {
      row: null,
      source: "missing" as const,
      complete: null,
      warnings: [] as string[],
    };
  }

  const derived = await loadExecutionWeeklyReturnFromHourlyBars({
    symbol: options.symbol,
    assetClass: options.assetClass,
    weekOpenUtc: options.weekOpenUtc,
  });

  if (!derived) {
    return {
      row: null,
      source: "missing" as const,
      complete: null,
      warnings: [] as string[],
    };
  }

  return {
    row: {
      symbol: derived.symbol,
      assetClass: derived.assetClass,
      returnPct: derived.returnPct,
      openPrice: derived.openPrice,
      closePrice: derived.closePrice,
    },
    source: "derived_canonical_1h" as const,
    complete: derived.complete,
    warnings: derived.warnings,
  };
}

function outcomeFor(direction: BasketDirection | "MISSING", raw: number | null, normalized: number | null) {
  if (direction === "MISSING") return "MISSING_SIGNAL" as const;
  if (direction === "NEUTRAL") return "NO_TRADE" as const;
  if (raw === null || normalized === null) return "MISSING_RETURN" as const;
  if (normalized > 0) return "WIN" as const;
  if (normalized < 0) return "LOSS" as const;
  return "FLAT" as const;
}

function signalReason(metadata: Record<string, unknown> | undefined) {
  const reason = metadata?.reason;
  return typeof reason === "string" && reason.length > 0 ? reason : null;
}

function buildMarkdown(options: {
  generatedAtUtc: string;
  symbol: string;
  model: BaseBasketModel;
  weeksRequested: number;
  fromDate: string | null;
  toDate: string | null;
  deriveMissingExecution: boolean;
  targetAdrPct: number;
  totals: RunbackTotals;
  jsonPath: string;
  csvPath: string;
  pinePath: string;
  pineInput: string;
}) {
  return [
    `# Weekly Hold Runback Receipt - ${options.symbol} ${options.model}`,
    "",
    `Generated: ${options.generatedAtUtc}`,
    "",
    "## Scope",
    "",
    "- Gate: Gate 33 weekly-hold-engine-parity",
    "- Engine lane: Dealer Weekly Hold, execution anchor, ADR-normalized",
    `- Pair: ${options.symbol}`,
    `- Model: ${options.model}`,
    `- Closed weeks requested: ${options.weeksRequested}`,
    `- From displayed week: ${options.fromDate ?? "-"}`,
    `- To displayed week: ${options.toDate ?? "-"}`,
    `- Derive missing execution returns from canonical 1H bars: ${options.deriveMissingExecution ? "yes" : "no"}`,
    `- Target ADR percent: ${options.targetAdrPct}`,
    "",
    "## Totals",
    "",
    `- Rows: ${options.totals.rows}`,
    `- Trade rows: ${options.totals.tradeRows}`,
    `- Wins/Losses/Flat: ${options.totals.wins}/${options.totals.losses}/${options.totals.flat}`,
    `- No trade rows: ${options.totals.noTradeRows}`,
    `- Missing signal rows: ${options.totals.missingSignalRows}`,
    `- Missing return rows: ${options.totals.missingReturnRows}`,
    `- Total raw percent: ${options.totals.totalRawPct.toFixed(6)}`,
    `- Total app ADR percent: ${options.totals.totalAppAdrPct.toFixed(6)}`,
    `- Max raw DD percent: ${options.totals.maxAdverseRawPct.toFixed(6)}`,
    `- Max app ADR DD percent: ${options.totals.maxAdverseAdrPct.toFixed(6)}`,
    `- Avg raw DD percent: ${options.totals.avgAdverseRawPct.toFixed(6)}`,
    `- Avg app ADR DD percent: ${options.totals.avgAdverseAdrPct.toFixed(6)}`,
    `- Worst DD week: ${options.totals.worstDrawdownWeek}`,
    "",
    "## Files",
    "",
    `- JSON: ${options.jsonPath}`,
    `- CSV: ${options.csvPath}`,
    `- Pine input: ${options.pinePath}`,
    "",
    "## Pine Input",
    "",
    "```text",
    options.pineInput,
    "```",
    "",
  ].join("\n");
}

async function main() {
  const symbol = (argValue("symbol") ?? "AUDCAD").trim().toUpperCase();
  const model = parseModel();
  const weeksRequested = parsePositiveInt("weeks", 26);
  const fromDate = argValue("from") ?? null;
  const toDate = argValue("to") ?? null;
  const deriveMissingExecution = hasFlag("derive-missing-execution");
  const outDir = path.resolve(process.cwd(), argValue("out-dir") ?? defaultOutDir());
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const targetAdrPct = getTargetAdrPct();
  const weeks = filterWeeksByDate(
    selectClosedWeeks(await listDataSectionWeeks(), currentWeekOpenUtc, weeksRequested),
    { from: fromDate, to: toDate },
  );

  if (weeks.length === 0) {
    throw new Error("No closed weeks were found for the runback export.");
  }

  const rows: WeeklyHoldRunbackRow[] = [];

  for (const weekOpenUtc of weeks) {
    const [basketWeek, executionReturns, adrMap] = await Promise.all([
      getCanonicalBasketWeek(weekOpenUtc),
      getExecutionWeeklyPairReturns(weekOpenUtc),
      loadWeeklyAdrMap(weekOpenUtc),
    ]);

    const signal = filterByModel(basketWeek, model)
      .find((candidate) => candidate.symbol.toUpperCase() === symbol);
    const signalAssetClass = (signal?.assetClass as AssetClass | undefined) ?? null;
    const storedReturnRow = executionReturns.find((candidate) => candidate.symbol.toUpperCase() === symbol);
    const initialAssetClass = storedReturnRow?.assetClass ?? signalAssetClass;
    const direction = signal?.direction ?? "MISSING";
    const executionReturn = await resolveExecutionReturn({
      symbol,
      weekOpenUtc,
      assetClass: initialAssetClass,
      storedRows: executionReturns,
      deriveMissingExecution,
    });
    const returnRow = executionReturn.row;
    const assetClass = returnRow?.assetClass ?? initialAssetClass;
    const executionWindow = assetClass ? getExecutionWeekWindow(weekOpenUtc, assetClass) : null;
    const drawdownReturn = assetClass
      ? await loadExecutionWeeklyReturnFromHourlyBars({
        symbol,
        assetClass,
        weekOpenUtc,
      })
      : null;
    const directedRaw = returnRow && direction !== "MISSING"
      ? directionAdjustedReturn(direction, returnRow.returnPct)
      : null;
    const pairAdrPct = assetClass ? getAdrPct(adrMap, symbol, assetClass) : null;
    const adrSource = !assetClass ? "missing" : adrMap.has(symbol) ? "canonical_price_bars" : "asset_default";
    const windowHighPrice = drawdownReturn?.highPrice ?? null;
    const windowLowPrice = drawdownReturn?.lowPrice ?? null;
    const maxAdverseRawPct = weeklyHoldMaxAdverseRawPct({
      direction,
      entryPrice: returnRow?.openPrice ?? drawdownReturn?.openPrice ?? null,
      windowHighPrice,
      windowLowPrice,
    });
    const maxAdverseAdrPct = maxAdverseRawPct !== null && pairAdrPct !== null && pairAdrPct > 0
      ? maxAdverseRawPct * (targetAdrPct / pairAdrPct)
      : null;
    const appAdrReturnPct = directedRaw !== null && pairAdrPct !== null && pairAdrPct > 0
      ? directedRaw * (targetAdrPct / pairAdrPct)
      : null;
    const outcome = outcomeFor(direction, directedRaw, appAdrReturnPct);
    const missingReason = direction === "MISSING"
      ? "missing_signal"
      : !returnRow
        ? "missing_execution_return"
        : direction === "NEUTRAL"
          ? signalReason(signal?.metadata) ?? "neutral_signal"
          : null;
    const pasteRow = (direction === "LONG" || direction === "SHORT") && appAdrReturnPct !== null
      ? `${pineWeekKey(weekOpenUtc)},${direction},${formatNumber(pairAdrPct, 6)}`
      : null;

    rows.push({
      weekOpenUtc,
      weekLabel: weekLabel(weekOpenUtc),
      pineWeekKey: pineWeekKey(weekOpenUtc),
      symbol,
      model,
      direction,
      sourceReportDate: signal?.sourceReportDate ?? null,
      assetClass,
      executionOpenUtc: executionWindow?.windowOpenUtc.toISO() ?? null,
      executionEntryCutoffUtc: executionWindow?.entryCutoffUtc.toISO() ?? null,
      executionCloseUtc: executionWindow?.windowCloseUtc.toISO() ?? null,
      executionReturnSource: executionReturn.source,
      executionReturnComplete: executionReturn.complete,
      executionReturnWarnings: executionReturn.warnings,
      entryPrice: round(returnRow?.openPrice ?? null),
      exitPrice: round(returnRow?.closePrice ?? null),
      windowHighPrice: round(windowHighPrice),
      windowLowPrice: round(windowLowPrice),
      underlyingRawReturnPct: round(returnRow?.returnPct ?? null),
      directedRawReturnPct: round(directedRaw),
      maxAdverseRawPct: round(maxAdverseRawPct),
      maxAdverseAdrPct: round(maxAdverseAdrPct),
      pairAdrPct: round(pairAdrPct),
      adrSource,
      appAdrReturnPct: round(appAdrReturnPct),
      outcome,
      missingReason,
      pineInputRow: pasteRow,
    });
  }

  const pineRows = rows.map((row) => row.pineInputRow).filter((row): row is string => Boolean(row));
  const ddRows = rows.filter((row) => row.maxAdverseRawPct !== null || row.maxAdverseAdrPct !== null);
  const worstDrawdownRow = [...rows]
    .filter((row) => row.maxAdverseAdrPct !== null)
    .sort((left, right) => (right.maxAdverseAdrPct ?? 0) - (left.maxAdverseAdrPct ?? 0))[0] ?? null;
  const totals: RunbackTotals = {
    rows: rows.length,
    tradeRows: rows.filter((row) => row.direction === "LONG" || row.direction === "SHORT").length,
    wins: rows.filter((row) => row.outcome === "WIN").length,
    losses: rows.filter((row) => row.outcome === "LOSS").length,
    flat: rows.filter((row) => row.outcome === "FLAT").length,
    noTradeRows: rows.filter((row) => row.outcome === "NO_TRADE").length,
    missingSignalRows: rows.filter((row) => row.outcome === "MISSING_SIGNAL").length,
    missingReturnRows: rows.filter((row) => row.outcome === "MISSING_RETURN").length,
    totalRawPct: round(rows.reduce((sum, row) => sum + (row.directedRawReturnPct ?? 0), 0), 6) ?? 0,
    totalAppAdrPct: round(rows.reduce((sum, row) => sum + (row.appAdrReturnPct ?? 0), 0), 6) ?? 0,
    maxAdverseRawPct: round(Math.max(0, ...rows.map((row) => row.maxAdverseRawPct ?? 0)), 6) ?? 0,
    maxAdverseAdrPct: round(Math.max(0, ...rows.map((row) => row.maxAdverseAdrPct ?? 0)), 6) ?? 0,
    avgAdverseRawPct: round(
      ddRows.length > 0
        ? ddRows.reduce((sum, row) => sum + (row.maxAdverseRawPct ?? 0), 0) / ddRows.length
        : 0,
      6,
    ) ?? 0,
    avgAdverseAdrPct: round(
      ddRows.length > 0
        ? ddRows.reduce((sum, row) => sum + (row.maxAdverseAdrPct ?? 0), 0) / ddRows.length
        : 0,
      6,
    ) ?? 0,
    worstDrawdownWeek: worstDrawdownRow?.pineWeekKey ?? "-",
  };

  const generatedAtUtc = DateTime.utc().toISO();
  const stamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
  const fileStem = `${symbol.toLowerCase()}-${model}-weekly-hold-${weeks.length}w-${stamp}`;
  await mkdir(outDir, { recursive: true });

  const pineInput = pineRows.join("\n");
  const jsonPath = path.join(outDir, `${fileStem}.json`);
  const csvPath = path.join(outDir, `${fileStem}.csv`);
  const pinePath = path.join(outDir, `${fileStem}-pine-input.txt`);
  const mdPath = path.join(outDir, `${fileStem}.md`);

  const receipt = {
    schemaVersion: 1,
    generatedAtUtc,
    researchEngineSeed: true,
    scope: {
      gate: "Gate 33 weekly-hold-engine-parity",
      symbol,
      model,
      weeksRequested,
      closedWeeksOnly: true,
      currentWeekOpenUtc,
      fromDate,
      toDate,
      anchorType: "execution",
      entryStyle: "weekly_hold",
      returnBasis: "ADR Normalized",
      targetAdrPct,
      pineRows: pineRows.length,
      deriveMissingExecution,
    },
    totals,
    pineInput,
    rows,
  };

  await writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await writeFile(csvPath, `${toCsv(rows)}\n`, "utf8");
  await writeFile(pinePath, `${pineInput}\n`, "utf8");
  await writeFile(mdPath, buildMarkdown({
    generatedAtUtc: generatedAtUtc ?? "",
    symbol,
    model,
    weeksRequested,
    fromDate,
    toDate,
    deriveMissingExecution,
    targetAdrPct,
    totals,
    jsonPath,
    csvPath,
    pinePath,
    pineInput,
  }), "utf8");

  console.log(`Weekly Hold runback receipt: ${symbol} ${model}`);
  console.log(`Closed weeks: ${rows.length}`);
  console.log(`Displayed week filter: ${fromDate ?? "-"} -> ${toDate ?? "-"}`);
  console.log(`Derived missing execution returns: ${deriveMissingExecution ? "yes" : "no"}`);
  console.log(`Trade rows: ${totals.tradeRows}`);
  console.log(`Wins/Losses/Flat: ${totals.wins}/${totals.losses}/${totals.flat}`);
  console.log(`No trade / missing signal / missing return: ${totals.noTradeRows}/${totals.missingSignalRows}/${totals.missingReturnRows}`);
  console.log(`Total raw %: ${totals.totalRawPct.toFixed(6)}`);
  console.log(`Total app ADR %: ${totals.totalAppAdrPct.toFixed(6)}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV: ${csvPath}`);
  console.log(`Markdown: ${mdPath}`);
  console.log(`Pine input: ${pinePath}`);
  console.log("");
  console.log("PINE_INPUT_START");
  console.log(pineInput);
  console.log("PINE_INPUT_END");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
